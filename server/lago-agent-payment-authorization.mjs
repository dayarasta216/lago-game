import { AsyncLocalStorage } from "node:async_hooks";

import {
  SUBSCRIPTION_POLICY,
  validateBillingPeriod
} from "./lago-agent-subscription-contract.mjs";

import {
  validAccountId
} from "./lago-agent-memory-contract.mjs";

import {
  validSolanaSignature,
  validatePaymentQuote,
  buildPaymentMemo
} from "./lago-solana-payment-verifier.mjs";

import {
  createLagoSubscriptionLedger
} from "./lago-agent-subscription-ledger.mjs";

/*
 * LAGO GAME
 * R2.7F1 — PAYMENT AUTHORIZATION SERVICE
 *
 * Authenticated payment confirmation.
 * Trusted server quote lookup.
 * Finalized Solana verification.
 * Atomic subscription credit.
 * Global replay protection.
 *
 * No private keys.
 * No automatic payments.
 * No trading authorization.
 */

export const PAYMENT_AUTHORIZATION_VERSION = 1;

const POLICY = SUBSCRIPTION_POLICY;

const EVIDENCE_FIELDS = Object.freeze([
  "accountId",
  "quoteId",
  "product",
  "chain",
  "network",
  "tokenMint",
  "payerWallet",
  "treasuryWallet",
  "sourceTokenAccount",
  "destinationTokenAccount",
  "amountBaseUnits",
  "tokenDecimals"
]);

const RETRYABLE_RPC_ERRORS = new Set([
  "transaction_not_found",
  "transaction_not_finalized",
  "transaction_details_unavailable",
  "solana_rpc_unavailable"
]);

const SAFE_LEDGER_ERRORS = new Set([
  "payment_already_used",
  "payment_not_verified",
  "subscription_ledger_unavailable",
  "billing_period_rejected",
  "ledger_closed"
]);


/*
 * STANDARD REJECTION
 */

function reject(reason, retryable = false) {
  return Object.freeze({
    ok: false,
    reason,
    retryable,
    paymentRecorded: false,
    serverVerified: false,
    entitled: false,
    aiEnabled: false,
    tradingAuthorized: false
  });
}


/*
 * VERIFY TRUSTED RPC EVIDENCE
 *
 * RPC finality alone is insufficient.
 * Evidence must match the original
 * server-generated payment quote.
 */

function matchesEvidence(
  result,
  quote,
  transactionSignature,
  currentTime
) {

  if (
    result?.ok !== true ||
    result.evidenceValid !== true ||
    result.networkVerified !== true ||
    result.finalityVerified !== true ||
    result.confirmationStatus !== "finalized" ||
    !Number.isSafeInteger(result.slot) ||
    result.slot < 0 ||
    !Number.isSafeInteger(currentTime)
  ) {
    return false;
  }

  const evidence = result.evidence;

  if (
    !evidence ||
    typeof evidence !== "object" ||
    evidence.transactionSignature !==
      transactionSignature ||
    evidence.memo !==
      buildPaymentMemo(quote.quoteId)
  ) {
    return false;
  }

  for (const field of EVIDENCE_FIELDS) {
    if (evidence[field] !== quote[field]) {
      return false;
    }
  }

  const blockTime = evidence.blockTime;

  return (
    Number.isSafeInteger(blockTime) &&
    blockTime >= quote.issuedAtSeconds &&
    blockTime < quote.expiresAtSeconds &&
    blockTime <= Math.floor(currentTime / 1000)
  );

}


/*
 * PAYMENT AUTHORIZATION FACTORY
 */

export function createLagoPaymentAuthorization({

  directory,

  projectRoot,

  sessionStore,

  quoteStore,

  rpc,

  now = () => Date.now()

} = {}) {

  if (
    typeof sessionStore?.restoreSession !==
      "function"
  ) {
    throw new Error(
      "payment_session_store_required"
    );
  }

  if (
    typeof quoteStore?.getQuote !==
      "function"
  ) {
    throw new Error(
      "payment_quote_store_required"
    );
  }

  if (
    typeof rpc?.verifyQuotedPayment !==
      "function"
  ) {
    throw new Error(
      "trusted_payment_rpc_required"
    );
  }

  if (typeof now !== "function") {
    throw new Error(
      "invalid_payment_clock"
    );
  }

  /*
   * Isolate authentication context for
   * concurrent asynchronous requests.
   */

  const requestContext =
    new AsyncLocalStorage();

  let closed = false;


  /*
   * AUTHENTICATE SERVER SESSION
   */

  async function authenticate(sessionToken) {

    if (
      typeof sessionToken !== "string" ||
      sessionToken.length === 0 ||
      sessionToken.length > 256
    ) {
      return null;
    }

    const result =
      await sessionStore.restoreSession(
        sessionToken
      );

    const timestamp = now();

    if (
      result?.ok !== true ||
      !validAccountId(
        result.account?.accountId
      ) ||
      !Number.isSafeInteger(timestamp) ||
      !Number.isFinite(
        Date.parse(result.expiresAt)
      ) ||
      Date.parse(result.expiresAt) <=
        timestamp
    ) {
      return null;
    }

    return Object.freeze({
      accountId: result.account.accountId,
      expiresAt: result.expiresAt
    });

  }


  /*
   * READ ORIGINAL SERVER QUOTE
   *
   * Never accept a quote supplied
   * directly by the browser.
   */

  function loadQuote(accountId, quoteId) {

    const result = quoteStore.getQuote({
      accountId,
      quoteId
    });

    if (
      result?.ok !== true ||
      result.quoteStored !== true ||
      !validatePaymentQuote(result.quote) ||
      result.quote.accountId !== accountId ||
      result.quote.quoteId !== quoteId ||
      result.memo !== buildPaymentMemo(quoteId)
    ) {
      return null;
    }

    return Object.freeze({
      ...result.quote
    });

  }


  /*
   * INTERNAL LEDGER VERIFIER
   *
   * This function is not publicly exposed.
   * It is invoked by the subscription
   * ledger when a new payment needs
   * independent verification.
   */

  async function verifyPayment(request) {

    const context =
      requestContext.getStore();

    if (
      closed ||
      !context ||
      context.accountId !== request.accountId ||
      context.quoteId !== request.quoteId ||
      context.transactionSignature !==
        request.transactionSignature
    ) {
      return null;
    }

    try {

      const quote = context.quote;

      /*
       * Fetch trusted blockchain evidence.
       */

      const rpcResult =
        await rpc.verifyQuotedPayment({
          quote,
          transactionSignature:
            request.transactionSignature
        });

      if (rpcResult?.ok !== true) {

        if (
          RETRYABLE_RPC_ERRORS.has(
            rpcResult?.reason
          )
        ) {
          context.failure =
            rpcResult.reason;
        }

        return null;
      }

      if (
        !matchesEvidence(
          rpcResult,
          quote,
          request.transactionSignature,
          now()
        )
      ) {
        context.failure =
          "payment_evidence_mismatch";

        return null;
      }

      /*
       * Recheck session after RPC.
       */

      const current =
        await authenticate(
          context.sessionToken
        );

      if (
        closed ||
        !current ||
        current.accountId !==
          request.accountId
      ) {
        context.failure =
          "payment_session_changed";

        return null;
      }

      /*
       * Recheck trusted evidence and clock.
       */

      if (
        !matchesEvidence(
          rpcResult,
          quote,
          request.transactionSignature,
          now()
        )
      ) {
        context.failure =
          "payment_evidence_mismatch";

        return null;
      }

      /*
       * Canonical creditable receipt.
       *
       * Only the internal ledger can
       * consume this object.
       */

      return Object.freeze({
        serverVerified: true,
        confirmationStatus: "finalized",

        accountId: quote.accountId,
        quoteId: quote.quoteId,

        transactionSignature:
          request.transactionSignature,

        product: quote.product,
        chain: quote.chain,
        network: quote.network,
        tokenMint: quote.tokenMint,

        payerWallet: quote.payerWallet,

        treasuryWallet:
          quote.treasuryWallet,

        amountBaseUnits:
          quote.amountBaseUnits,

        tokenDecimals:
          quote.tokenDecimals,

        blockTime:
          rpcResult.evidence.blockTime,

        slot: rpcResult.slot,

        tradingAuthorized: false
      });

    } catch {

      context.failure =
        "payment_verification_unavailable";

      return null;

    }

  }


  /*
   * PRIVATE SUBSCRIPTION LEDGER
   *
   * Global payment registry is installed
   * automatically by the ledger.
   */

  const ledger = createLagoSubscriptionLedger({
    directory,
    projectRoot,
    verifyPayment,
    now
  });


  /*
   * CONFIRM SUBSCRIPTION PAYMENT
   *
   * Accepted request fields:
   *
   * sessionToken
   * quoteId
   * transactionSignature
   *
   * All other fields are ignored.
   */

  async function confirmPayment({

    sessionToken,

    quoteId,

    transactionSignature

  } = {}) {

    if (closed) {
      return reject(
        "payment_service_closed"
      );
    }

    if (
      !buildPaymentMemo(quoteId) ||
      !validSolanaSignature(
        transactionSignature
      )
    ) {
      return reject(
        "invalid_payment_request"
      );
    }

    try {

      /*
       * 1. Authenticate account.
       */

      const account =
        await authenticate(sessionToken);

      if (!account) {
        return reject(
          "authentication_required"
        );
      }

      /*
       * 2. Load original server quote.
       */

      const quote = loadQuote(
        account.accountId,
        quoteId
      );

      if (!quote) {
        return reject(
          "payment_quote_not_found"
        );
      }

      /*
       * Expired quotes remain eligible
       * for settlement when blockTime
       * was inside the original window.
       */

      const timestamp = now();

      if (
        !Number.isSafeInteger(timestamp) ||
        timestamp >= Date.parse(
          account.expiresAt
        ) ||
        quote.issuedAtSeconds >
          Math.floor(timestamp / 1000)
      ) {
        return reject(
          "payment_session_or_clock_invalid"
        );
      }

      if (closed) {
        return reject(
          "payment_service_closed"
        );
      }

      /*
       * 3. Isolated request context.
       */

      const context = {
        sessionToken,

        accountId:
          account.accountId,

        quoteId,
        transactionSignature,
        quote,

        failure: null
      };

      /*
       * 4. Verify and atomically record.
       */

      const payment =
        await requestContext.run(

          context,

          () => ledger.applyPayment({
            accountId:
              account.accountId,

            quoteId,
            transactionSignature
          })

        );

      if (payment?.ok !== true) {

        if (
          payment?.reason ===
            "payment_not_verified" &&
          context.failure
        ) {

          return reject(
            context.failure,

            RETRYABLE_RPC_ERRORS.has(
              context.failure
            ) ||
            context.failure ===
              "payment_verification_unavailable"
          );

        }

        const reason =
          SAFE_LEDGER_ERRORS.has(
            payment?.reason
          )

            ? payment.reason

            : "payment_recording_unavailable";

        return reject(
          reason,

          reason ===
            "subscription_ledger_unavailable" ||
          reason ===
            "payment_recording_unavailable"
        );

      }

      /*
       * 5. Verify canonical ledger response.
       */

      if (
        payment.recorded !== true ||
        payment.accountId !==
          account.accountId ||
        payment.quoteId !== quoteId ||
        payment.transactionSignature !==
          transactionSignature ||
        !validateBillingPeriod(
          payment.period
        ) ||
        typeof payment.duplicate !==
          "boolean"
      ) {
        return reject(
          "payment_record_integrity_failed",
          true
        );
      }

      /*
       * 6. Return recorded billing period.
       *
       * Subscription access is granted
       * by a separate entitlement service.
       */

      return Object.freeze({
        ok: true,

        version:
          PAYMENT_AUTHORIZATION_VERSION,

        product: POLICY.product,

        accountId:
          account.accountId,

        quoteId,
        transactionSignature,

        duplicate:
          payment.duplicate,

        paymentRecorded: true,

        period:
          payment.period,

        billingModel:
          POLICY.billingModel,

        billingInterval:
          POLICY.billingInterval,

        billingIntervalCount: 1,

        currency:
          POLICY.currency,

        autoRenewal: false,

        serverVerified: false,

        entitled: false,

        aiEnabled: false,

        tradingAuthorized: false
      });

    } catch {

      return reject(
        "payment_authorization_unavailable",
        true
      );

    }

  }


  /*
   * CLOSE PRIVATE LEDGER
   */

  function close() {

    if (!closed) {
      closed = true;
      ledger.close();
    }

  }


  /*
   * SERVER-ONLY PUBLIC INTERFACE
   *
   * Never expose the internal verifier
   * or unrestricted ledger access.
   */

  return Object.freeze({

    version:
      PAYMENT_AUTHORIZATION_VERSION,

    confirmPayment,

    close,

    getPolicy() {

      return Object.freeze({

        authenticationRequired: true,

        serverQuoteRequired: true,

        clientQuoteTrusted: false,

        clientReceiptTrusted: false,

        clientAccountIdTrusted: false,

        trustedRpcRequired: true,

        finalizedTransactionRequired: true,

        exactPaymentEvidenceRequired: true,

        sessionRecheckRequired: true,

        isolatedRequestContext: true,

        globalReplayProtectionRequired: true,

        atomicCreditRequired: true,

        idempotentRetriesSupported: true,

        delayedFinalizationSupported: true,

        automaticPaymentsEnabled: false,

        entitlementActivationEnabled: false,

        tradingAuthorizationGranted: false

      });

    }

  });

}

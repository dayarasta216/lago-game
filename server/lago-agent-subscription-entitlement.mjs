import {
  SUBSCRIPTION_POLICY
} from "./lago-agent-subscription-contract.mjs";

import {
  validAccountId
} from "./lago-agent-memory-contract.mjs";

import {
  createLagoSubscriptionLedger
} from "./lago-agent-subscription-ledger.mjs";

/*
 * LAGO GAME
 * R2.7F2 — SUBSCRIPTION ENTITLEMENT ENGINE
 *
 * Server-authoritative subscription access.
 * Account-level entitlement.
 * Calendar-based expiration.
 * Fail closed by default.
 *
 * No client-side activation.
 * No automatic payments.
 * No trading authorization.
 */

export const SUBSCRIPTION_ENTITLEMENT_VERSION = 1;

const POLICY = SUBSCRIPTION_POLICY;

const STATUSES = Object.freeze([
  "inactive",
  "active",
  "expired",
  "scheduled"
]);

const DAY_MS = 86400000;


/*
 * STANDARD REJECTION
 */

function reject(reason) {

  return Object.freeze({

    ok: false,

    reason,

    accountId: null,

    status: "unavailable",

    subscriptionStatus: "unavailable",

    serverVerified: false,

    entitled: false,

    aiEnabled: false,

    chatEnabled: false,

    memoryEnabled: false,

    learningEnabled: false,

    marketAnalysisEnabled: false,

    tradingEnabled: false,

    tradingAuthorized: false

  });

}


/*
 * CLOCK VALIDATION
 */

function validClock(value) {

  return (

    Number.isSafeInteger(value) &&

    Number.isFinite(
      new Date(value).getTime()
    )

  );

}


/*
 * CANONICAL UTC TIMESTAMP
 */

function validTimestamp(value) {

  if (

    typeof value !== "string" ||

    !Number.isFinite(Date.parse(value))

  ) {

    return false;

  }

  const date = new Date(value);

  return (

    date.toISOString() === value &&

    date.getUTCFullYear() >= 2000 &&

    date.getUTCFullYear() <= 9998

  );

}


/*
 * VALIDATE TRUSTED LEDGER STATE
 */

function validLedgerState(
  state,
  accountId,
  timestamp
) {

  if (

    !validClock(timestamp) ||

    state?.ok !== true ||

    state.accountId !== accountId ||

    state.product !== POLICY.product ||

    state.billingModel !==
      POLICY.billingModel ||

    state.billingInterval !==
      POLICY.billingInterval ||

    state.billingIntervalCount !== 1 ||

    state.currency !== POLICY.currency ||

    state.tokenMint !== POLICY.tokenMint ||

    state.autoRenewal !== false ||

    !STATUSES.includes(state.status)

  ) {

    return false;

  }


  /*
   * Active subscription.
   *
   * Exact expiration boundary:
   * start <= now < end
   */

  if (state.status === "active") {

    if (

      !validTimestamp(
        state.currentPeriodStart
      ) ||

      !validTimestamp(
        state.currentPeriodEnd
      ) ||

      !validTimestamp(
        state.paidThrough
      ) ||

      !validTimestamp(
        state.latestPeriodEnd
      )

    ) {

      return false;

    }

    const start = Date.parse(
      state.currentPeriodStart
    );

    const end = Date.parse(
      state.currentPeriodEnd
    );

    const paidThrough = Date.parse(
      state.paidThrough
    );

    const latest = Date.parse(
      state.latestPeriodEnd
    );

    return (

      start <= timestamp &&

      timestamp < end &&

      start < end &&

      paidThrough >= end &&

      latest >= paidThrough

    );

  }


  /*
   * Non-active subscriptions must not
   * contain a currently active period.
   */

  if (

    state.currentPeriodStart !== null ||

    state.currentPeriodEnd !== null ||

    state.paidThrough !== null ||

    state.daysRemaining !== 0

  ) {

    return false;

  }


  if (state.status === "inactive") {

    return state.latestPeriodEnd === null;

  }


  if (

    !validTimestamp(
      state.latestPeriodEnd
    )

  ) {

    return false;

  }


  if (state.status === "expired") {

    return (

      Date.parse(state.latestPeriodEnd) <=
        timestamp

    );

  }


  if (state.status === "scheduled") {

    return (

      Date.parse(state.latestPeriodEnd) >
        timestamp

    );

  }

  return false;

}


/*
 * ENTITLEMENT FACTORY
 *
 * verifiedLedgerEnabled must only
 * be enabled after production payment
 * infrastructure is independently
 * verified and securely configured.
 */

export function createLagoSubscriptionEntitlement({

  directory,

  projectRoot,

  sessionStore,

  verifiedLedgerEnabled = false,

  now = () => Date.now()

} = {}) {

  if (

    typeof sessionStore?.restoreSession !==
      "function"

  ) {

    throw new Error(
      "entitlement_session_store_required"
    );

  }


  if (typeof now !== "function") {

    throw new Error(
      "invalid_entitlement_clock"
    );

  }


  if (

    typeof verifiedLedgerEnabled !==
      "boolean"

  ) {

    throw new Error(
      "invalid_entitlement_configuration"
    );

  }


  /*
   * Open existing subscription ledger.
   *
   * No payment verifier is supplied.
   * This service cannot credit payments.
   */

  const ledger = createLagoSubscriptionLedger({

    directory,

    projectRoot,

    verifyPayment: null,

    now

  });


  const ledgerPolicy = ledger.getPolicy();


  if (

    ledgerPolicy.atomicCredit !== true ||

    ledgerPolicy.globalPaymentRegistryEnabled !==
      true ||

    ledgerPolicy.crossProductReplayProtection !==
      true ||

    ledgerPolicy.atomicPaymentClaim !== true ||

    ledgerPolicy.immutablePaymentHistory !==
      true

  ) {

    ledger.close();

    throw new Error(
      "entitlement_ledger_policy_mismatch"
    );

  }


  let closed = false;


  /*
   * PROJECT SUBSCRIPTION STATE
   */

  function projectSubscription(
    state,
    timestamp
  ) {

    const active =
      state.status === "active";

    const entitled =

      verifiedLedgerEnabled === true &&

      active;


    const daysRemaining = active

      ? Math.max(

          0,

          Math.ceil(

            (

              Date.parse(state.paidThrough) -

              timestamp

            ) / DAY_MS

          )

        )

      : 0;


    const currentPeriodDaysRemaining = active

      ? Math.max(

          0,

          Math.ceil(

            (

              Date.parse(state.currentPeriodEnd) -

              timestamp

            ) / DAY_MS

          )

        )

      : 0;


    let reason = null;


    if (!verifiedLedgerEnabled) {

      reason =
        "subscription_entitlement_disabled";

    } else if (state.status === "expired") {

      reason =
        "subscription_expired";

    } else if (state.status === "scheduled") {

      reason =
        "subscription_not_started";

    } else if (!active) {

      reason =
        "active_subscription_required";

    }


    return Object.freeze({

      ok: true,

      version:
        SUBSCRIPTION_ENTITLEMENT_VERSION,

      accountId:
        state.accountId,

      product:
        POLICY.product,

      subscriptionScope:
        POLICY.subscriptionScope,

      maxActiveAgents: 1,

      billingModel:
        POLICY.billingModel,

      billingInterval:
        POLICY.billingInterval,

      billingIntervalCount: 1,

      billingTimezone:
        POLICY.billingTimezone,

      currency:
        POLICY.currency,

      chain:
        POLICY.chain,

      network:
        POLICY.network,

      tokenMint:
        POLICY.tokenMint,


      /*
       * Billing state
       */

      status:
        state.status,

      subscriptionStatus:
        state.status,

      accessStatus:

        entitled
          ? "entitled"
          : "locked",

      currentPeriodStart:
        state.currentPeriodStart,

      currentPeriodEnd:
        state.currentPeriodEnd,

      paidThrough:
        state.paidThrough,

      latestPeriodEnd:
        state.latestPeriodEnd,

      daysRemaining,

      currentPeriodDaysRemaining,

      nextBillingAt: null,

      autoRenewal: false,

      manualRenewal: true,

      freeTrial: false,

      unlockWithXP: false,

      unlockWithSP: false,


      /*
       * Subscription authorization
       */

      serverVerified:
        verifiedLedgerEnabled,

      entitled,

      subscriptionEntitlementGranted:
        entitled,


      /*
       * Subscription entitlement is
       * not operational AI access.
       *
       * Character ownership, consent
       * and runtime authorization
       * remain separate requirements.
       */

      aiEnabled: false,

      chatEnabled: false,

      memoryEnabled: false,

      learningEnabled: false,

      marketAnalysisEnabled: false,

      tradingEnabled: false,

      tradingAuthorized: false,

      externalModelTrainingAuthorized: false,

      characterAuthorizationRequired: true,

      memoryConsentRequired: true,

      runtimeAuthorizationRequired: true,

      separateTradingAuthorizationRequired: true,


      /*
       * Preserve player data
       */

      preserveCharacterOnExpiry: true,

      preserveMemoryOnExpiry: true,

      preserveProgressOnExpiry: true,

      ownerMemoryManagementRequiresSubscription:
        false,

      checkedAt:
        new Date(timestamp).toISOString(),

      reason

    });

  }


  /*
   * INTERNAL SUBSCRIPTION PROVIDER
   *
   * Compatible with the existing
   * server memory authorization module.
   *
   * accountId must come from a
   * trusted authenticated server context.
   *
   * Do not expose directly over HTTP.
   */

  function getSubscription(input = {}) {

    if (closed) {

      return reject(
        "entitlement_service_closed"
      );

    }


    const accountId =
      input?.accountId;


    if (!validAccountId(accountId)) {

      return reject(
        "invalid_account_id"
      );

    }


    try {

      const state =
        ledger.getState(accountId);

      const timestamp = now();


      if (

        !validLedgerState(

          state,

          accountId,

          timestamp

        )

      ) {

        return reject(
          "subscription_state_unavailable"
        );

      }


      return projectSubscription(

        state,

        timestamp

      );

    } catch {

      return reject(
        "subscription_entitlement_unavailable"
      );

    }

  }


  /*
   * AUTHENTICATED SUBSCRIPTION STATE
   *
   * No client account identifiers,
   * dates, payment claims or permissions
   * are accepted.
   */

  async function getState(input = {}) {

    if (closed) {

      return reject(
        "entitlement_service_closed"
      );

    }


    const sessionToken =
      input?.sessionToken;


    if (

      typeof sessionToken !== "string" ||

      sessionToken.trim().length === 0 ||

      sessionToken.length > 256

    ) {

      return reject(
        "authentication_required"
      );

    }


    try {

      const session =

        await sessionStore.restoreSession(

          sessionToken

        );


      if (

        session?.ok !== true ||

        !validAccountId(
          session.account?.accountId
        ) ||

        !validTimestamp(
          session.expiresAt
        )

      ) {

        return reject(
          "authentication_required"
        );

      }


      const timestamp = now();


      if (

        !validClock(timestamp) ||

        Date.parse(session.expiresAt) <=
          timestamp

      ) {

        return reject(
          "session_expired"
        );

      }


      const accountId =
        session.account.accountId;


      const state =
        getSubscription({

          accountId

        });


      if (state.ok !== true) {

        return state;

      }


      /*
       * Recheck expiration immediately
       * before returning account state.
       */

      const completedAt = now();


      if (

        !validClock(completedAt) ||

        Date.parse(session.expiresAt) <=
          completedAt

      ) {

        return reject(
          "session_expired"
        );

      }


      if (

        state.status === "active" &&

        Date.parse(state.currentPeriodEnd) <=
          completedAt

      ) {

        return reject(
          "subscription_state_changed"
        );

      }


      if (closed) {

        return reject(
          "entitlement_service_closed"
        );

      }


      return state;

    } catch {

      return reject(
        "subscription_entitlement_unavailable"
      );

    }

  }


  /*
   * CLOSE SERVICE
   */

  function close() {

    if (!closed) {

      closed = true;

      ledger.close();

    }

  }


  /*
   * IMMUTABLE SERVER INTERFACE
   */

  return Object.freeze({

    version:
      SUBSCRIPTION_ENTITLEMENT_VERSION,

    getSubscription,

    getState,

    close,

    getPolicy() {

      return Object.freeze({

        subscriptionScope: "account",

        billingInterval: "month",

        maxActiveAgents: 1,

        verifiedLedgerEnabled,

        disabledByDefault: true,

        serverAuthenticationRequired: true,

        verifiedPaymentHistoryRequired: true,

        globalReplayProtectionRequired: true,

        clientEntitlementTrusted: false,

        clientAccountIdTrusted: false,

        clientExpirationTrusted: false,

        automaticPaymentsEnabled: false,

        autoRenewal: false,

        freeTrial: false,

        unlockWithXP: false,

        unlockWithSP: false,

        preserveCharacterOnExpiry: true,

        preserveMemoryOnExpiry: true,

        preserveProgressOnExpiry: true,

        ownerMemoryManagementRequiresSubscription:
          false,

        characterAuthorizationRequired: true,

        memoryConsentRequired: true,

        runtimeAuthorizationRequired: true,

        tradingAuthorizationGranted: false,

        failClosed: true

      });

    }

  });

}

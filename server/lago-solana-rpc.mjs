
import { randomUUID } from "node:crypto";

import {
  validSolanaSignature,
  validatePaymentQuote,
  verifySolanaPaymentEvidence
} from "./lago-solana-payment-verifier.mjs";


/*
 * LAGO GAME
 * R2.7D2 — TRUSTED SOLANA RPC
 *
 * Server-only RPC transport.
 *
 * Mainnet genesis verification.
 * Finalized transaction verification.
 * Strict response validation.
 * Request timeout.
 * Response size protection.
 *
 * No wallet private keys.
 * No transaction broadcasting.
 * No automatic payments.
 * No entitlement activation.
 */

export const SOLANA_RPC_VERSION = 1;


export const MAINNET_GENESIS_HASH =
  "5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d";


const MAX_RESPONSE_BYTES =
  1024 * 1024;

const DEFAULT_TIMEOUT_MS =
  10000;


const POLICY = Object.freeze({

  chain: "solana",

  network: "mainnet-beta",

  commitment: "finalized",

  encoding: "jsonParsed",

  maxSupportedTransactionVersion: 0,

  supportedPaymentVersion: "legacy",

  genesisHashVerificationRequired: true,

  signatureStatusVerificationRequired: true,

  transactionSlotMatchRequired: true,

  httpsRequired: true,

  redirectsAllowed: false,

  clientRpcSelectionAllowed: false,

  clientTransactionEvidenceTrusted: false,

  maxResponseBytes: MAX_RESPONSE_BYTES,

  transactionBroadcastEnabled: false,

  automaticPaymentsEnabled: false,

  entitlementActivationEnabled: false

});


/*
 * STANDARD REJECTION
 */

function reject(reason) {

  return Object.freeze({

    ok: false,

    reason,

    finalityVerified: false,

    serverVerified: false,

    entitled: false,

    aiEnabled: false,

    tradingAuthorized: false

  });

}


/*
 * VALIDATE SERVER RPC CONFIGURATION
 */

function validateRpcUrl(value) {

  if (

    typeof value !== "string" ||

    value.trim().length === 0

  ) {

    throw new Error(
      "solana_rpc_url_required"
    );

  }


  let url;


  try {

    url = new URL(value);

  } catch {

    throw new Error(
      "invalid_solana_rpc_url"
    );

  }


  if (

    url.protocol !== "https:" ||

    !url.hostname ||

    url.username ||

    url.password ||

    url.hash

  ) {

    throw new Error(
      "insecure_solana_rpc_url"
    );

  }


  return url.href;

}


/*
 * SAFE INTEGER VALIDATION
 */

function validSlot(value) {

  return (

    Number.isSafeInteger(value) &&

    value >= 0

  );

}


/*
 * LIMITED RESPONSE READER
 *
 * Bound decompressed response size.
 * Never log raw provider responses.
 */

async function readResponse(
  response,
  controller
) {

  if (!response?.ok) {

    controller.abort();

    throw new Error(
      "rpc_http_error"
    );

  }


  const contentLength =
    response.headers.get(
      "content-length"
    );


  if (

    contentLength !== null &&

    Number(contentLength) >
      MAX_RESPONSE_BYTES

  ) {

    controller.abort();

    throw new Error(
      "rpc_response_too_large"
    );

  }


  if (

    typeof response.body?.getReader !==
      "function"

  ) {

    throw new Error(
      "rpc_response_body_missing"
    );

  }


  const reader =
    response.body.getReader();


  const chunks = [];

  let total = 0;


  try {

    while (true) {

      const { done, value } =
        await reader.read();


      if (done) {

        break;

      }


      total += value.byteLength;


      if (total > MAX_RESPONSE_BYTES) {

        controller.abort();

        throw new Error(
          "rpc_response_too_large"
        );

      }


      chunks.push(
        Buffer.from(value)
      );

    }


    const raw =
      Buffer.concat(
        chunks,
        total
      ).toString("utf8");


    return JSON.parse(raw);

  } finally {

    reader.releaseLock();

  }

}


/*
 * SERVER RPC FACTORY
 *
 * rpcUrl and fetchImpl must originate
 * exclusively from server configuration.
 */

export function createLagoSolanaRpc({

  rpcUrl,

  fetchImpl = globalThis.fetch,

  timeoutMs = DEFAULT_TIMEOUT_MS

} = {}) {

  const endpoint =
    validateRpcUrl(rpcUrl);


  if (typeof fetchImpl !== "function") {

    throw new Error(
      "rpc_fetch_unavailable"
    );

  }


  if (

    !Number.isInteger(timeoutMs) ||

    timeoutMs < 1000 ||

    timeoutMs > 30000

  ) {

    throw new Error(
      "invalid_rpc_timeout"
    );

  }


  /*
   * INTERNAL JSON-RPC REQUEST
   *
   * Not exposed to the client.
   */

  async function request(
    method,
    params = []
  ) {

    const id = randomUUID();


    const controller =
      new AbortController();


    const timer = setTimeout(

      () => controller.abort(),

      timeoutMs

    );


    try {

      const response =
        await fetchImpl(endpoint, {

          method: "POST",

          headers: {

            "Content-Type":
              "application/json",

            "Accept":
              "application/json"

          },

          redirect: "error",

          cache: "no-store",

          signal: controller.signal,

          body: JSON.stringify({

            jsonrpc: "2.0",

            id,

            method,

            params

          })

        });


      const result =
        await readResponse(

          response,

          controller

        );


      if (

        !result ||

        typeof result !== "object" ||

        Array.isArray(result) ||

        result.jsonrpc !== "2.0" ||

        result.id !== id ||

        Object.hasOwn(result, "error") ||

        !Object.hasOwn(result, "result")

      ) {

        throw new Error(
          "invalid_rpc_response"
        );

      }


      return result.result;

    } finally {

      clearTimeout(timer);

      controller.abort();

    }

  }


  /*
   * VERIFY MAINNET NETWORK
   *
   * The full genesis hash is required.
   * Devnet and testnet are rejected.
   */

  async function verifyNetwork() {

    try {

      const genesisHash =
        await request(
          "getGenesisHash"
        );


      if (

        genesisHash !==
          MAINNET_GENESIS_HASH

      ) {

        return reject(
          "solana_network_mismatch"
        );

      }


      return Object.freeze({

        ok: true,

        network:
          POLICY.network,

        genesisHash,

        networkVerified: true

      });

    } catch {

      return reject(
        "solana_rpc_unavailable"
      );

    }

  }


  /*
   * FETCH FINALIZED TRANSACTION
   *
   * Never accept transaction data
   * supplied by a browser.
   */

  async function getFinalizedTransaction(

    transactionSignature

  ) {

    if (

      !validSolanaSignature(
        transactionSignature
      )

    ) {

      return reject(
        "invalid_transaction_signature"
      );

    }


    /*
     * 1. NETWORK VERIFICATION
     */

    const network =
      await verifyNetwork();


    if (!network.ok) {

      return network;

    }


    try {

      /*
       * 2. SIGNATURE STATUS
       */

      const statuses =
        await request(

          "getSignatureStatuses",

          [

            [transactionSignature],

            {

              searchTransactionHistory:
                true

            }

          ]

        );


      if (

        !Array.isArray(statuses?.value) ||

        statuses.value.length !== 1 ||

        !validSlot(
          statuses.context?.slot
        )

      ) {

        return reject(
          "invalid_signature_status_response"
        );

      }


      const status =
        statuses.value[0];


      if (status === null) {

        return reject(
          "transaction_not_found"
        );

      }


      if (

        !status ||

        !validSlot(status.slot) ||

        status.slot >
          statuses.context.slot

      ) {

        return reject(
          "invalid_signature_status"
        );

      }


      if (status.err !== null) {

        return reject(
          "transaction_failed"
        );

      }


      if (

        status.confirmationStatus !==
          "finalized" ||

        status.confirmations !== null

      ) {

        return reject(
          "transaction_not_finalized"
        );

      }


      /*
       * 3. FETCH TRANSACTION DETAILS
       */

      const transaction =
        await request(

          "getTransaction",

          [

            transactionSignature,

            {

              commitment:
                POLICY.commitment,

              encoding:
                POLICY.encoding,

              maxSupportedTransactionVersion:
                POLICY.maxSupportedTransactionVersion

            }

          ]

        );


      if (transaction === null) {

        return reject(
          "transaction_details_unavailable"
        );

      }


      if (

        !transaction ||

        !transaction.meta ||

        !transaction.transaction ||

        !validSlot(transaction.slot)

      ) {

        return reject(
          "invalid_transaction_response"
        );

      }


      /*
       * 4. CROSS-CHECK SLOT
       */

      if (

        transaction.slot !==
          status.slot

      ) {

        return reject(
          "transaction_slot_mismatch"
        );

      }


      if (transaction.meta.err !== null) {

        return reject(
          "transaction_failed"
        );

      }


      /*
       * 5. CROSS-CHECK SIGNATURE
       */

      const signatures =
        transaction.transaction.signatures;


      if (

        !Array.isArray(signatures) ||

        signatures.length === 0 ||

        signatures[0] !==
          transactionSignature

      ) {

        return reject(
          "transaction_signature_mismatch"
        );

      }


      return Object.freeze({

        ok: true,

        version:
          SOLANA_RPC_VERSION,

        network:
          POLICY.network,

        networkVerified: true,

        finalityVerified: true,

        confirmationStatus:
          "finalized",

        transactionSignature,

        slot: transaction.slot,

        transaction,

        serverVerified: false,

        entitled: false,

        aiEnabled: false,

        tradingAuthorized: false

      });

    } catch {

      return reject(
        "solana_rpc_unavailable"
      );

    }

  }


  /*
   * COMBINED RPC AND EVIDENCE VERIFICATION
   *
   * Internal operation.
   *
   * The quote must come from trusted
   * server storage.
   *
   * Until quote ownership and authenticity
   * are independently verified, this
   * result is NOT a creditable receipt.
   */

  async function verifyQuotedPayment({

    quote,

    transactionSignature

  } = {}) {

    try {

      /*
       * Snapshot quote before async RPC.
       */

      const snapshot =
        Object.freeze({
          ...quote
        });


      if (

        !validatePaymentQuote(snapshot)

      ) {

        return reject(
          "invalid_payment_quote"
        );

      }


      const rpcResult =
        await getFinalizedTransaction(

          transactionSignature

        );


      if (rpcResult.ok !== true) {

        return rpcResult;

      }


      const verification =
        verifySolanaPaymentEvidence({

          quote: snapshot,

          transactionSignature,

          transaction:
            rpcResult.transaction

        });


      if (verification.ok !== true) {

        return verification;

      }


      return Object.freeze({

        ok: true,

        version:
          SOLANA_RPC_VERSION,

        evidenceValid: true,

        evidence:
          verification.evidence,

        networkVerified: true,

        finalityVerified: true,

        confirmationStatus:
          "finalized",

        slot:
          rpcResult.slot,

        /*
         * Trusted quote store and
         * authenticated payment service
         * are still required.
         */

        quoteAuthenticityVerified: false,

        serverVerified: false,

        ledgerCreditAuthorized: false,

        entitled: false,

        aiEnabled: false,

        tradingAuthorized: false

      });

    } catch {

      return reject(
        "payment_verification_unavailable"
      );

    }

  }


  /*
   * INTERNAL SERVER API
   *
   * No generic RPC method.
   * No exposed endpoint or API keys.
   */

  return Object.freeze({

    version:
      SOLANA_RPC_VERSION,

    verifyNetwork,

    getFinalizedTransaction,

    verifyQuotedPayment,

    getPolicy() {

      return POLICY;

    }

  });

}

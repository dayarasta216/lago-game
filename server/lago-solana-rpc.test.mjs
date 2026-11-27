
import test from "node:test";
import assert from "node:assert/strict";

import {
  SOLANA_RPC_VERSION,
  MAINNET_GENESIS_HASH,
  createLagoSolanaRpc
} from "./lago-solana-rpc.mjs";

import {
  SUBSCRIPTION_POLICY
} from "./lago-agent-subscription-contract.mjs";

import {
  TOKEN_PROGRAM_ID,
  MEMO_PROGRAM_ID,
  buildPaymentMemo
} from "./lago-solana-payment-verifier.mjs";


/*
 * LAGO GAME
 * R2.7D2A — TRUSTED RPC SECURITY TESTS
 *
 * Mock RPC transport.
 * Real verification modules.
 *
 * No external network access.
 * No real transactions.
 * No private keys.
 * No AI entitlement.
 */

const RPC_URL =
  "https://rpc.example.test";

const SIGNATURE =
  "1".repeat(63) + "2";

const FOREIGN_SIGNATURE =
  "1".repeat(63) + "3";

const PAYER =
  "1".repeat(31) + "2";

const TREASURY =
  "1".repeat(31) + "3";

const SOURCE =
  "1".repeat(31) + "4";

const DESTINATION =
  "1".repeat(31) + "5";

const SLOT = 100000;

const ISSUED = 1801396800;

const POLICY =
  SUBSCRIPTION_POLICY;


/*
 * SERVER QUOTE FIXTURE
 */

function makeQuote() {

  return {

    schemaVersion: 1,

    quoteId: "a".repeat(32),

    accountId:
      "lago_" + "A".repeat(22),

    product: POLICY.product,

    billingModel: "subscription",

    billingInterval: "month",

    billingIntervalCount: 1,

    chain: POLICY.chain,

    network: POLICY.network,

    tokenMint: POLICY.tokenMint,

    tokenProgram: TOKEN_PROGRAM_ID,

    payerWallet: PAYER,

    treasuryWallet: TREASURY,

    sourceTokenAccount: SOURCE,

    destinationTokenAccount: DESTINATION,

    tokenDecimals: 6,

    amountBaseUnits: "1000000",

    issuedAtSeconds: ISSUED,

    expiresAtSeconds: ISSUED + 900

  };

}


/*
 * TOKEN BALANCE FIXTURE
 */

function balance(
  quote,
  accountIndex,
  owner,
  amount
) {

  return {

    accountIndex,

    owner,

    mint: quote.tokenMint,

    programId: TOKEN_PROGRAM_ID,

    uiTokenAmount: {

      amount,

      decimals: quote.tokenDecimals

    }

  };

}


/*
 * FINALIZED TRANSACTION FIXTURE
 */

function makeTransaction(
  quote = makeQuote()
) {

  return {

    slot: SLOT,

    version: "legacy",

    blockTime: ISSUED + 10,

    transaction: {

      signatures: [SIGNATURE],

      message: {

        accountKeys: [

          {

            pubkey: PAYER,

            signer: true,

            writable: true

          },

          {

            pubkey: SOURCE,

            signer: false,

            writable: true

          },

          {

            pubkey: DESTINATION,

            signer: false,

            writable: true

          },

          {

            pubkey: quote.tokenMint,

            signer: false,

            writable: false

          },

          {

            pubkey: TOKEN_PROGRAM_ID,

            signer: false,

            writable: false

          },

          {

            pubkey: MEMO_PROGRAM_ID,

            signer: false,

            writable: false

          }

        ],

        instructions: [

          {

            programId: MEMO_PROGRAM_ID,

            parsed:
              buildPaymentMemo(quote.quoteId)

          },

          {

            programId: TOKEN_PROGRAM_ID,

            parsed: {

              type: "transferChecked",

              info: {

                authority: PAYER,

                source: SOURCE,

                destination: DESTINATION,

                mint: quote.tokenMint,

                tokenAmount: {

                  amount:
                    quote.amountBaseUnits,

                  decimals:
                    quote.tokenDecimals

                }

              }

            }

          }

        ]

      }

    },

    meta: {

      err: null,

      innerInstructions: [],

      preTokenBalances: [

        balance(
          quote,
          1,
          PAYER,
          "1000000"
        ),

        balance(
          quote,
          2,
          TREASURY,
          "0"
        )

      ],

      postTokenBalances: [

        balance(
          quote,
          1,
          PAYER,
          "0"
        ),

        balance(
          quote,
          2,
          TREASURY,
          "1000000"
        )

      ]

    }

  };

}


/*
 * FINALIZED SIGNATURE STATUS
 */

function makeStatus(changes = {}) {

  return {

    context: {

      slot: SLOT + 100

    },

    value: [

      {

        slot: SLOT,

        err: null,

        confirmations: null,

        confirmationStatus: "finalized",

        ...changes

      }

    ]

  };

}


/*
 * MOCK RPC FIXTURE
 */

function fixture(handlers = {}) {

  const quote = makeQuote();

  const transaction =
    makeTransaction(quote);

  const calls = [];

  const optionsSeen = [];


  const defaults = {

    getGenesisHash() {

      return MAINNET_GENESIS_HASH;

    },

    getSignatureStatuses() {

      return makeStatus();

    },

    getTransaction() {

      return transaction;

    }

  };


  const rpc = createLagoSolanaRpc({

    rpcUrl: RPC_URL,

    async fetchImpl(url, options) {

      assert.equal(

        url,

        RPC_URL + "/"

      );

      const request =
        JSON.parse(options.body);

      calls.push(request);

      optionsSeen.push(options);


      const handler =
        handlers[request.method] ||

        defaults[request.method];


      if (!handler) {

        throw new Error(
          "unexpected_rpc_method"
        );

      }


      const result =
        await handler(
          request,
          options
        );


      if (result instanceof Response) {

        return result;

      }


      return new Response(

        JSON.stringify({

          jsonrpc: "2.0",

          id: request.id,

          result

        }),

        {

          status: 200,

          headers: {

            "Content-Type":
              "application/json"

          }

        }

      );

    }

  });


  return {

    rpc,

    quote,

    transaction,

    calls,

    optionsSeen,

    verify() {

      return rpc.verifyQuotedPayment({

        quote,

        transactionSignature:
          SIGNATURE

      });

    }

  };

}


function assertRejected(result, reason) {

  assert.equal(result.ok, false);

  assert.equal(result.reason, reason);

  assert.equal(result.serverVerified, false);

  assert.equal(result.entitled, false);

  assert.equal(result.aiEnabled, false);

  assert.equal(result.tradingAuthorized, false);

}


/*
 * TEST 01 — RPC CONFIGURATION
 */

test("requires secure server RPC configuration", () => {

  for (const rpcUrl of [

    null,

    "",

    "invalid",

    "http://rpc.example.test",

    "ftp://rpc.example.test",

    "https://user:password@rpc.example.test",

    "https://rpc.example.test/#fragment"

  ]) {

    assert.throws(

      () => createLagoSolanaRpc({

        rpcUrl

      })

    );

  }


  assert.throws(

    () => createLagoSolanaRpc({

      rpcUrl: RPC_URL,

      fetchImpl: null

    }),

    /rpc_fetch_unavailable/

  );


  for (const timeoutMs of [

    0,

    999,

    30001,

    Infinity,

    1000.5

  ]) {

    assert.throws(

      () => createLagoSolanaRpc({

        rpcUrl: RPC_URL,

        timeoutMs

      }),

      /invalid_rpc_timeout/

    );

  }

});


/*
 * TEST 02 — MAINNET IDENTITY
 */

test("verifies the canonical Solana mainnet genesis hash", async () => {

  assert.equal(

    MAINNET_GENESIS_HASH,

    "5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d"

  );

  const fx = fixture();

  const result =
    await fx.rpc.verifyNetwork();

  assert.equal(result.ok, true);

  assert.equal(

    result.network,

    "mainnet-beta"

  );

  assert.equal(
    result.networkVerified,
    true
  );

});


/*
 * TEST 03 — WRONG NETWORK
 */

test("rejects a different genesis hash before transaction lookup", async () => {

  const fx = fixture({

    getGenesisHash() {

      return "foreign-genesis-hash";

    }

  });

  const result =
    await fx.rpc.getFinalizedTransaction(
      SIGNATURE
    );

  assertRejected(

    result,

    "solana_network_mismatch"

  );

  assert.equal(fx.calls.length, 1);

});


/*
 * TEST 04 — INVALID SIGNATURE
 */

test("rejects invalid signatures before making RPC requests", async () => {

  const fx = fixture();

  const result =
    await fx.rpc.getFinalizedTransaction(
      "invalid"
    );

  assertRejected(

    result,

    "invalid_transaction_signature"

  );

  assert.equal(fx.calls.length, 0);

});


/*
 * TEST 05 — FINALIZED TRANSACTION
 */

test("retrieves finalized transaction evidence", async () => {

  const fx = fixture();

  const result =
    await fx.rpc.getFinalizedTransaction(
      SIGNATURE
    );

  assert.equal(result.ok, true);

  assert.equal(
    result.version,
    SOLANA_RPC_VERSION
  );

  assert.equal(
    result.networkVerified,
    true
  );

  assert.equal(
    result.finalityVerified,
    true
  );

  assert.equal(
    result.confirmationStatus,
    "finalized"
  );

  assert.equal(result.slot, SLOT);

  assert.deepEqual(

    result.transaction,

    fx.transaction

  );

  assert.equal(
    result.serverVerified,
    false
  );

});


/*
 * TEST 06 — RPC REQUEST CONTRACT
 */

test("uses strict finalized RPC request settings", async () => {

  const fx = fixture();

  assert.equal(

    (
      await fx.rpc.getFinalizedTransaction(
        SIGNATURE
      )
    ).ok,

    true

  );

  assert.deepEqual(

    fx.calls.map(
      item => item.method
    ),

    [

      "getGenesisHash",

      "getSignatureStatuses",

      "getTransaction"

    ]

  );

  assert.deepEqual(

    fx.calls[1].params,

    [

      [SIGNATURE],

      { searchTransactionHistory: true }

    ]

  );

  assert.deepEqual(

    fx.calls[2].params,

    [

      SIGNATURE,

      {

        commitment: "finalized",

        encoding: "jsonParsed",

        maxSupportedTransactionVersion: 0

      }

    ]

  );

  const ids =
    fx.calls.map(item => item.id);

  assert.equal(
    new Set(ids).size,
    3
  );

  for (const options of fx.optionsSeen) {

    assert.equal(
      options.method,
      "POST"
    );

    assert.equal(
      options.redirect,
      "error"
    );

    assert.equal(
      options.cache,
      "no-store"
    );

    assert.ok(options.signal);

  }

});


/*
 * TEST 07 — TRANSACTION NOT FOUND
 */

test("rejects missing signature history", async () => {

  const fx = fixture({

    getSignatureStatuses() {

      return {

        context: { slot: SLOT },

        value: [null]

      };

    }

  });

  assertRejected(

    await fx.rpc.getFinalizedTransaction(
      SIGNATURE
    ),

    "transaction_not_found"

  );

  assert.equal(fx.calls.length, 2);

});


/*
 * TEST 08 — UNFINALIZED TRANSACTION
 */

test("rejects processed and confirmed transactions", async () => {

  for (const confirmationStatus of [

    "processed",

    "confirmed",

    null

  ]) {

    const fx = fixture({

      getSignatureStatuses() {

        return makeStatus({

          confirmationStatus,

          confirmations: 1

        });

      }

    });

    assertRejected(

      await fx.rpc.getFinalizedTransaction(
        SIGNATURE
      ),

      "transaction_not_finalized"

    );

    assert.equal(fx.calls.length, 2);

  }

});


/*
 * TEST 09 — INCONSISTENT FINALITY
 */

test("rejects inconsistent finalized confirmation metadata", async () => {

  const fx = fixture({

    getSignatureStatuses() {

      return makeStatus({

        confirmationStatus: "finalized",

        confirmations: 1

      });

    }

  });

  assertRejected(

    await fx.rpc.getFinalizedTransaction(
      SIGNATURE
    ),

    "transaction_not_finalized"

  );

});


/*
 * TEST 10 — FAILED STATUS
 */

test("rejects failed transactions in signature status", async () => {

  const fx = fixture({

    getSignatureStatuses() {

      return makeStatus({

        err: {

          InstructionError: [

            1,

            { Custom: 1 }

          ]

        }

      });

    }

  });

  assertRejected(

    await fx.rpc.getFinalizedTransaction(
      SIGNATURE
    ),

    "transaction_failed"

  );

});


/*
 * TEST 11 — MALFORMED STATUS RESPONSE
 */

test("rejects malformed signature status responses", async () => {

  const invalid = [

    null,

    {},

    {

      context: { slot: SLOT },

      value: []

    },

    {

      context: { slot: -1 },

      value: [null]

    },

    {

      context: { slot: SLOT },

      value: [null, null]

    }

  ];

  for (const response of invalid) {

    const fx = fixture({

      getSignatureStatuses() {

        return response;

      }

    });

    assertRejected(

      await fx.rpc.getFinalizedTransaction(
        SIGNATURE
      ),

      "invalid_signature_status_response"

    );

  }

});


/*
 * TEST 12 — INVALID STATUS SLOT
 */

test("rejects invalid or inconsistent signature slots", async () => {

  for (const slot of [

    -1,

    1.5,

    null,

    SLOT + 101

  ]) {

    const fx = fixture({

      getSignatureStatuses() {

        return makeStatus({ slot });

      }

    });

    assertRejected(

      await fx.rpc.getFinalizedTransaction(
        SIGNATURE
      ),

      "invalid_signature_status"

    );

  }

});


/*
 * TEST 13 — MISSING TRANSACTION
 */

test("rejects unavailable finalized transaction details", async () => {

  const fx = fixture({

    getTransaction() {

      return null;

    }

  });

  assertRejected(

    await fx.rpc.getFinalizedTransaction(
      SIGNATURE
    ),

    "transaction_details_unavailable"

  );

});


/*
 * TEST 14 — INVALID TRANSACTION RESPONSE
 */

test("rejects malformed transaction details", async () => {

  for (const response of [

    {},

    {

      slot: SLOT,

      transaction: {}

    },

    {

      slot: -1,

      transaction: {},

      meta: {}

    }

  ]) {

    const fx = fixture({

      getTransaction() {

        return response;

      }

    });

    assertRejected(

      await fx.rpc.getFinalizedTransaction(
        SIGNATURE
      ),

      "invalid_transaction_response"

    );

  }

});


/*
 * TEST 15 — SLOT SUBSTITUTION
 */

test("rejects transaction details from a different slot", async () => {

  const fx = fixture();

  fx.transaction.slot =
    SLOT + 1;

  assertRejected(

    await fx.rpc.getFinalizedTransaction(
      SIGNATURE
    ),

    "transaction_slot_mismatch"

  );

});


/*
 * TEST 16 — TRANSACTION FAILURE
 */

test("rejects failed transaction details despite finalized status", async () => {

  const fx = fixture();

  fx.transaction.meta.err = {

    InstructionError: [

      1,

      { Custom: 1 }

    ]

  };

  assertRejected(

    await fx.rpc.getFinalizedTransaction(
      SIGNATURE
    ),

    "transaction_failed"

  );

});


/*
 * TEST 17 — SIGNATURE SUBSTITUTION
 */

test("rejects returned transaction with a different signature", async () => {

  const fx = fixture();

  fx.transaction.transaction.signatures = [

    FOREIGN_SIGNATURE

  ];

  assertRejected(

    await fx.rpc.getFinalizedTransaction(
      SIGNATURE
    ),

    "transaction_signature_mismatch"

  );

});


/*
 * TEST 18 — JSON-RPC ID MISMATCH
 */

test("rejects JSON-RPC responses with unrelated request identifiers", async () => {

  const fx = fixture({

    getGenesisHash() {

      return new Response(

        JSON.stringify({

          jsonrpc: "2.0",

          id: "unrelated-id",

          result: MAINNET_GENESIS_HASH

        })

      );

    }

  });

  assertRejected(

    await fx.rpc.verifyNetwork(),

    "solana_rpc_unavailable"

  );

});


/*
 * TEST 19 — JSON-RPC ERRORS
 */

test("rejects RPC error responses even when a result is included", async () => {

  const fx = fixture({

    getGenesisHash(request) {

      return new Response(

        JSON.stringify({

          jsonrpc: "2.0",

          id: request.id,

          result: MAINNET_GENESIS_HASH,

          error: {

            code: -32603,

            message: "Synthetic RPC error"

          }

        })

      );

    }

  });

  assertRejected(

    await fx.rpc.verifyNetwork(),

    "solana_rpc_unavailable"

  );

});


/*
 * TEST 20 — HTTP FAILURE
 */

test("fails closed on unsuccessful HTTP responses", async () => {

  for (const status of [

    401,

    403,

    429,

    500,

    503

  ]) {

    const fx = fixture({

      getGenesisHash() {

        return new Response(

          "Synthetic failure",

          { status }

        );

      }

    });

    assertRejected(

      await fx.rpc.verifyNetwork(),

      "solana_rpc_unavailable"

    );

  }

});


/*
 * TEST 21 — INVALID JSON
 */

test("rejects invalid JSON responses", async () => {

  const fx = fixture({

    getGenesisHash() {

      return new Response(
        "not valid JSON"
      );

    }

  });

  assertRejected(

    await fx.rpc.verifyNetwork(),

    "solana_rpc_unavailable"

  );

});


/*
 * TEST 22 — CONTENT LENGTH LIMIT
 */

test("rejects responses exceeding declared size limit", async () => {

  const fx = fixture({

    getGenesisHash() {

      return new Response(

        "{}",

        {

          headers: {

            "Content-Length":
              String(1024 * 1024 + 1)

          }

        }

      );

    }

  });

  assertRejected(

    await fx.rpc.verifyNetwork(),

    "solana_rpc_unavailable"

  );

});


/*
 * TEST 23 — STREAM SIZE LIMIT
 */

test("rejects oversized response bodies without content length", async () => {

  const fx = fixture({

    getGenesisHash() {

      const body = new ReadableStream({

        start(controller) {

          controller.enqueue(

            new Uint8Array(
              1024 * 1024 + 1
            )

          );

          controller.close();

        }

      });

      return new Response(body);

    }

  });

  assertRejected(

    await fx.rpc.verifyNetwork(),

    "solana_rpc_unavailable"

  );

});


/*
 * TEST 24 — NETWORK ERROR PRIVACY
 */

test("does not expose provider secrets or internal network errors", async () => {

  const fx = fixture({

    getGenesisHash() {

      throw new Error(
        "SYNTHETIC_PRIVATE_RPC_KEY"
      );

    }

  });

  const result =
    await fx.rpc.verifyNetwork();

  assertRejected(

    result,

    "solana_rpc_unavailable"

  );

  assert.equal(

    JSON.stringify(result).includes(
      "SYNTHETIC_PRIVATE_RPC_KEY"
    ),

    false

  );

});


/*
 * TEST 25 — REQUEST TIMEOUT
 */

test("aborts stalled RPC requests", async () => {

  let aborted = false;

  const rpc = createLagoSolanaRpc({

    rpcUrl: RPC_URL,

    timeoutMs: 1000,

    fetchImpl(url, options) {

      return new Promise(

        (resolve, reject) => {

          options.signal.addEventListener(

            "abort",

            () => {

              aborted = true;

              reject(

                new Error("aborted")

              );

            },

            { once: true }

          );

        }

      );

    }

  });

  const result =
    await rpc.verifyNetwork();

  assertRejected(

    result,

    "solana_rpc_unavailable"

  );

  assert.equal(aborted, true);

});


/*
 * TEST 26 — COMBINED PAYMENT VERIFICATION
 */

test("combines finalized RPC data with strict payment evidence verification", async () => {

  const fx = fixture();

  const result =
    await fx.verify();

  assert.equal(result.ok, true);

  assert.equal(
    result.evidenceValid,
    true
  );

  assert.equal(
    result.networkVerified,
    true
  );

  assert.equal(
    result.finalityVerified,
    true
  );

  assert.equal(

    result.evidence.amountBaseUnits,

    "1000000"

  );

  assert.equal(

    result.evidence.quoteId,

    fx.quote.quoteId

  );

  assert.equal(
    result.slot,
    SLOT
  );

});


/*
 * TEST 27 — QUOTE VALIDATION
 */

test("rejects invalid quotes before contacting RPC", async () => {

  const fx = fixture();

  const result =
    await fx.rpc.verifyQuotedPayment({

      quote: {

        ...fx.quote,

        amountBaseUnits: "0"

      },

      transactionSignature:
        SIGNATURE

    });

  assertRejected(

    result,

    "invalid_payment_quote"

  );

  assert.equal(fx.calls.length, 0);

});


/*
 * TEST 28 — PAYMENT TAMPERING
 */

test("rejects finalized transactions with incorrect treasury credit", async () => {

  const fx = fixture();

  fx.transaction.meta.postTokenBalances[1]
    .uiTokenAmount.amount = "999999";

  assertRejected(

    await fx.verify(),

    "payment_balance_mismatch"

  );

});


/*
 * TEST 29 — NO FALSE LEDGER CREDIT
 */

test("RPC verification alone cannot activate paid AI", async () => {

  const fx = fixture();

  const result =
    await fx.verify();

  assert.equal(result.ok, true);

  assert.equal(
    result.quoteAuthenticityVerified,
    false
  );

  assert.equal(
    result.serverVerified,
    false
  );

  assert.equal(
    result.ledgerCreditAuthorized,
    false
  );

  assert.equal(
    result.entitled,
    false
  );

  assert.equal(
    result.aiEnabled,
    false
  );

  assert.equal(
    result.tradingAuthorized,
    false
  );

});


/*
 * TEST 30 — RPC POLICY
 */

test("exposes read-only server RPC security policy", () => {

  const fx = fixture();

  const policy =
    fx.rpc.getPolicy();

  assert.equal(

    policy.commitment,

    "finalized"

  );

  assert.equal(
    policy.httpsRequired,
    true
  );

  assert.equal(
    policy.redirectsAllowed,
    false
  );

  assert.equal(
    policy.clientRpcSelectionAllowed,
    false
  );

  assert.equal(
    policy.clientTransactionEvidenceTrusted,
    false
  );

  assert.equal(
    policy.transactionBroadcastEnabled,
    false
  );

  assert.equal(
    policy.automaticPaymentsEnabled,
    false
  );

  assert.equal(
    policy.entitlementActivationEnabled,
    false
  );

  assert.equal(

    policy.maxResponseBytes,

    1024 * 1024

  );

  assert.equal(
    Object.isFrozen(policy),
    true
  );

  assert.equal(
    Object.hasOwn(fx.rpc, "request"),
    false
  );

  assert.equal(
    Object.hasOwn(fx.rpc, "rpcUrl"),
    false
  );

});

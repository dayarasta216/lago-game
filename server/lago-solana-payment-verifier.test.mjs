
import test from "node:test";
import assert from "node:assert/strict";

import {
  SUBSCRIPTION_POLICY
} from "./lago-agent-subscription-contract.mjs";

import {
  PAYMENT_VERIFIER_VERSION,
  TOKEN_PROGRAM_ID,
  MEMO_PROGRAM_ID,
  validSolanaPublicKey,
  validSolanaSignature,
  buildPaymentMemo,
  validatePaymentQuote,
  verifySolanaPaymentEvidence,
  getPaymentVerifierPolicy
} from "./lago-solana-payment-verifier.mjs";


/*
 * LAGO GAME
 * R2.7D1 — PAYMENT VERIFIER SECURITY TESTS
 *
 * Synthetic Solana transaction evidence.
 * No live RPC.
 * No wallet private keys.
 * No real transactions.
 * No entitlement activation.
 */

const POLICY = SUBSCRIPTION_POLICY;

const ACCOUNT =
  "lago_" + "A".repeat(22);

const QUOTE_ID =
  "a".repeat(32);

const PAYER =
  "1".repeat(31) + "2";

const TREASURY =
  "1".repeat(31) + "3";

const SOURCE =
  "1".repeat(31) + "4";

const DESTINATION =
  "1".repeat(31) + "5";

const FOREIGN =
  "1".repeat(31) + "6";

const SIGNATURE =
  "1".repeat(63) + "2";

const FOREIGN_SIGNATURE =
  "1".repeat(63) + "3";

const ISSUED =
  1801396800;

const EXPIRES =
  ISSUED + 900;

const MAX_U64 =
  18446744073709551615n;


/*
 * SYNTHETIC SERVER QUOTE
 */

function makeQuote(changes = {}) {

  return {

    schemaVersion: 1,

    quoteId: QUOTE_ID,

    accountId: ACCOUNT,

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

    expiresAtSeconds: EXPIRES,

    ...changes

  };

}


/*
 * SYNTHETIC TOKEN BALANCE
 */

function tokenBalance(
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

      amount: String(amount),

      decimals: quote.tokenDecimals

    }

  };

}


/*
 * SYNTHETIC TRANSACTION
 *
 * Mirrors the expected jsonParsed
 * Solana RPC response structure.
 */

function makeTransaction(
  quote = makeQuote()
) {

  const amount =
    BigInt(quote.amountBaseUnits);

  return {

    version: "legacy",

    blockTime:
      quote.issuedAtSeconds + 10,

    transaction: {

      signatures: [SIGNATURE],

      message: {

        accountKeys: [

          {

            pubkey: quote.payerWallet,

            signer: true,

            writable: true

          },

          {

            pubkey: quote.sourceTokenAccount,

            signer: false,

            writable: true

          },

          {

            pubkey: quote.destinationTokenAccount,

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

                authority:
                  quote.payerWallet,

                source:
                  quote.sourceTokenAccount,

                destination:
                  quote.destinationTokenAccount,

                mint:
                  quote.tokenMint,

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

        tokenBalance(

          quote,
          1,
          quote.payerWallet,
          amount

        ),

        tokenBalance(

          quote,
          2,
          quote.treasuryWallet,
          0n

        )

      ],

      postTokenBalances: [

        tokenBalance(

          quote,
          1,
          quote.payerWallet,
          0n

        ),

        tokenBalance(

          quote,
          2,
          quote.treasuryWallet,
          amount

        )

      ]

    }

  };

}


/*
 * VERIFICATION FIXTURE
 */

function fixture() {

  const quote = makeQuote();

  const transaction =
    makeTransaction(quote);

  function verify(changes = {}) {

    return verifySolanaPaymentEvidence({

      quote,

      transactionSignature: SIGNATURE,

      transaction,

      ...changes

    });

  }

  return {

    quote,

    transaction,

    verify,

    keys:
      transaction.transaction.message.accountKeys,

    instructions:
      transaction.transaction.message.instructions,

    transfer:
      transaction.transaction.message
        .instructions[1].parsed.info,

    meta:
      transaction.meta

  };

}


function assertRejected(result, reason) {

  assert.equal(result.ok, false);

  assert.equal(result.evidenceValid, false);

  assert.equal(result.serverVerified, false);

  assert.equal(result.entitled, false);

  assert.equal(result.aiEnabled, false);

  assert.equal(result.tradingAuthorized, false);

  assert.equal(result.reason, reason);

}


/*
 * TEST 01 — BASE58 VALIDATION
 */

test("validates Solana address and signature byte lengths", () => {

  assert.equal(
    validSolanaPublicKey(PAYER),
    true
  );

  assert.equal(
    validSolanaPublicKey(POLICY.tokenMint),
    true
  );

  assert.equal(
    validSolanaSignature(SIGNATURE),
    true
  );

  for (const invalid of [

    null,

    "",

    "0".repeat(44),

    "1".repeat(31),

    "1".repeat(33),

    "1".repeat(89)

  ]) {

    assert.equal(
      validSolanaPublicKey(invalid),
      false
    );

  }

  assert.equal(
    validSolanaSignature(PAYER),
    false
  );

  assert.equal(
    validSolanaSignature("1".repeat(65)),
    false
  );

});


/*
 * TEST 02 — PAYMENT MEMO
 */

test("creates canonical payment memo identifiers", () => {

  assert.equal(

    buildPaymentMemo(QUOTE_ID),

    "LAGO-SUB-V1:" + QUOTE_ID

  );

  for (const invalid of [

    null,

    "",

    "a".repeat(31),

    "a".repeat(33),

    "Z".repeat(32),

    ACCOUNT

  ]) {

    assert.equal(
      buildPaymentMemo(invalid),
      null
    );

  }

});


/*
 * TEST 03 — VALID QUOTE
 */

test("accepts a structurally valid subscription quote", () => {

  assert.equal(
    validatePaymentQuote(makeQuote()),
    true
  );

});


/*
 * TEST 04 — INVALID QUOTES
 */

test("rejects malformed and incompatible payment quotes", () => {

  const invalid = [

    { schemaVersion: 2 },

    { accountId: "guest" },

    { quoteId: "invalid-quote" },

    { product: "unknown-product" },

    { billingModel: "purchase" },

    { billingInterval: "year" },

    { billingIntervalCount: 2 },

    { chain: "ethereum" },

    { network: "devnet" },

    { tokenMint: FOREIGN },

    { tokenProgram: FOREIGN },

    { payerWallet: "invalid" },

    { treasuryWallet: PAYER },

    { destinationTokenAccount: SOURCE },

    { sourceTokenAccount: "invalid" },

    { tokenDecimals: -1 },

    { tokenDecimals: 19 },

    { tokenDecimals: 6.5 },

    { amountBaseUnits: "0" },

    { amountBaseUnits: "-1" },

    { amountBaseUnits: "1.5" },

    { amountBaseUnits: "0001" },

    { amountBaseUnits: 1000000 },

    { amountBaseUnits: String(MAX_U64 + 1n) },

    { issuedAtSeconds: 0 },

    { issuedAtSeconds: NaN },

    { expiresAtSeconds: ISSUED },

    { expiresAtSeconds: ISSUED + 901 }

  ];

  for (const changes of invalid) {

    assert.equal(

      validatePaymentQuote(
        makeQuote(changes)
      ),

      false,

      JSON.stringify(changes)

    );

  }

  assert.equal(validatePaymentQuote(null), false);

});


/*
 * TEST 05 — VALID TRANSACTION
 */

test("accepts matching payment transaction evidence", () => {

  const fx = fixture();

  const result = fx.verify();

  assert.equal(result.ok, true);

  assert.equal(result.evidenceValid, true);

  assert.equal(
    result.version,
    PAYMENT_VERIFIER_VERSION
  );

  assert.equal(
    result.evidence.accountId,
    ACCOUNT
  );

  assert.equal(
    result.evidence.quoteId,
    QUOTE_ID
  );

  assert.equal(
    result.evidence.transactionSignature,
    SIGNATURE
  );

  assert.equal(
    result.evidence.tokenMint,
    POLICY.tokenMint
  );

  assert.equal(
    result.evidence.amountBaseUnits,
    "1000000"
  );

  assert.equal(
    result.evidence.payerWallet,
    PAYER
  );

  assert.equal(
    result.evidence.treasuryWallet,
    TREASURY
  );

  assert.ok(Object.isFrozen(result.evidence));

});


/*
 * TEST 06 — EXACT LARGE TOKEN AMOUNTS
 */

test("verifies u64 token amounts without rounding", () => {

  const quote = makeQuote({

    amountBaseUnits:
      String(MAX_U64)

  });

  const transaction =
    makeTransaction(quote);

  const result =
    verifySolanaPaymentEvidence({

      quote,

      transactionSignature: SIGNATURE,

      transaction

    });

  assert.equal(result.ok, true);

  assert.equal(

    result.evidence.amountBaseUnits,

    "18446744073709551615"

  );

});


/*
 * TEST 07 — PAYMENT TIME WINDOW
 */

test("enforces inclusive issue and exclusive expiry boundaries", () => {

  const fx = fixture();

  fx.transaction.blockTime =
    ISSUED - 1;

  assertRejected(

    fx.verify(),

    "transaction_outside_quote_window"

  );

  fx.transaction.blockTime = ISSUED;

  assert.equal(fx.verify().ok, true);

  fx.transaction.blockTime = EXPIRES - 1;

  assert.equal(fx.verify().ok, true);

  for (const invalid of [

    EXPIRES,

    EXPIRES + 1,

    null,

    NaN

  ]) {

    fx.transaction.blockTime = invalid;

    assertRejected(

      fx.verify(),

      "transaction_outside_quote_window"

    );

  }

});


/*
 * TEST 08 — SIGNATURE MISMATCH
 */

test("rejects invalid and substituted transaction signatures", () => {

  const fx = fixture();

  assertRejected(

    fx.verify({

      transactionSignature: "invalid"

    }),

    "invalid_transaction_signature"

  );

  assertRejected(

    fx.verify({

      transactionSignature:
        FOREIGN_SIGNATURE

    }),

    "transaction_signature_mismatch"

  );

  fx.transaction.transaction.signatures.push(
    FOREIGN_SIGNATURE
  );

  assertRejected(

    fx.verify(),

    "transaction_signature_mismatch"

  );

});


/*
 * TEST 09 — MISSING EVIDENCE
 */

test("rejects missing transaction evidence", () => {

  const fx = fixture();

  for (const transaction of [

    null,

    {},

    { transaction: {} }

  ]) {

    assertRejected(

      fx.verify({ transaction }),

      "transaction_unavailable"

    );

  }

});


/*
 * TEST 10 — FAILED TRANSACTION
 */

test("rejects failed Solana transactions", () => {

  const fx = fixture();

  fx.meta.err = {

    InstructionError: [

      1,

      { Custom: 1 }

    ]

  };

  assertRejected(

    fx.verify(),

    "transaction_failed"

  );

});


/*
 * TEST 11 — UNSUPPORTED VERSION
 */

test("rejects unsupported transaction versions", () => {

  const fx = fixture();

  fx.transaction.version = 0;

  assertRejected(

    fx.verify(),

    "unsupported_transaction_version"

  );

});


/*
 * TEST 12 — PAYER AUTHORIZATION
 */

test("requires the quoted payer as the only signer", () => {

  const mutations = [

    fx => {

      fx.keys[0].signer = false;

    },

    fx => {

      fx.keys[0].pubkey = FOREIGN;

    },

    fx => {

      fx.keys[1].signer = true;

    },

    fx => {

      fx.keys[0].writable = false;

    }

  ];

  for (const mutate of mutations) {

    const fx = fixture();

    mutate(fx);

    assertRejected(

      fx.verify(),

      "payer_signature_mismatch"

    );

  }

});


/*
 * TEST 13 — INVALID ACCOUNT LIST
 */

test("rejects malformed and duplicate transaction accounts", () => {

  const fx = fixture();

  fx.keys.push({

    ...fx.keys[0]

  });

  assertRejected(

    fx.verify(),

    "invalid_transaction_accounts"

  );

  const malformed = fixture();

  malformed.keys[0].pubkey = "invalid";

  assertRejected(

    malformed.verify(),

    "invalid_transaction_accounts"

  );

});


/*
 * TEST 14 — TOKEN ACCOUNT MISMATCH
 */

test("requires the exact writable token accounts", () => {

  const mutations = [

    fx => {

      fx.keys[1].pubkey = FOREIGN;

    },

    fx => {

      fx.keys[2].pubkey = FOREIGN;

    },

    fx => {

      fx.keys[2].writable = false;

    }

  ];

  for (const mutate of mutations) {

    const fx = fixture();

    mutate(fx);

    assertRejected(

      fx.verify(),

      "payment_token_account_mismatch"

    );

  }

});


/*
 * TEST 15 — QUOTE MEMO MISMATCH
 */

test("rejects substituted quote identifiers and memo programs", () => {

  const fx = fixture();

  fx.instructions[0].parsed =
    buildPaymentMemo("b".repeat(32));

  assertRejected(

    fx.verify(),

    "payment_memo_mismatch"

  );

  const foreign = fixture();

  foreign.instructions[0].programId = FOREIGN;

  assertRejected(

    foreign.verify(),

    "payment_memo_mismatch"

  );

});


/*
 * TEST 16 — EXTRA INSTRUCTIONS
 */

test("rejects missing and additional payment instructions", () => {

  const extra = fixture();

  extra.instructions.push({

    programId: FOREIGN

  });

  assertRejected(

    extra.verify(),

    "unexpected_payment_instructions"

  );

  const missing = fixture();

  missing.instructions.pop();

  assertRejected(

    missing.verify(),

    "unexpected_payment_instructions"

  );

});


/*
 * TEST 17 — TOKEN PROGRAM
 */

test("requires the configured SPL Token Program and TransferChecked", () => {

  const wrongProgram = fixture();

  wrongProgram.instructions[1].programId =
    FOREIGN;

  assertRejected(

    wrongProgram.verify(),

    "invalid_payment_instruction"

  );

  const wrongType = fixture();

  wrongType.instructions[1].parsed.type =
    "transfer";

  assertRejected(

    wrongType.verify(),

    "invalid_payment_instruction"

  );

});


/*
 * TEST 18 — INNER INSTRUCTIONS
 */

test("rejects unexpected nested instructions", () => {

  const fx = fixture();

  fx.meta.innerInstructions = [

    {

      index: 1,

      instructions: [

        { programId: FOREIGN }

      ]

    }

  ];

  assertRejected(

    fx.verify(),

    "unexpected_inner_instructions"

  );

  fx.meta.innerInstructions = null;

  assertRejected(

    fx.verify(),

    "unexpected_inner_instructions"

  );

});


/*
 * TEST 19 — TRANSFER TAMPERING
 */

test("rejects modified transfer amount mint authority and destination", () => {

  const mutations = [

    fx => {

      fx.transfer.authority = FOREIGN;

    },

    fx => {

      fx.transfer.source = FOREIGN;

    },

    fx => {

      fx.transfer.destination = FOREIGN;

    },

    fx => {

      fx.transfer.mint = FOREIGN;

    },

    fx => {

      fx.transfer.tokenAmount.amount =
        "999999";

    },

    fx => {

      fx.transfer.tokenAmount.amount =
        "1000001";

    },

    fx => {

      fx.transfer.tokenAmount.decimals = 9;

    }

  ];

  for (const mutate of mutations) {

    const fx = fixture();

    mutate(fx);

    assertRejected(

      fx.verify(),

      "payment_transfer_mismatch"

    );

  }

});


/*
 * TEST 20 — INVALID BALANCE EVIDENCE
 */

test("rejects missing foreign and duplicate token balance metadata", () => {

  const mutations = [

    fx => {

      fx.meta.preTokenBalances = [];

    },

    fx => {

      fx.meta.postTokenBalances = null;

    },

    fx => {

      fx.meta.preTokenBalances[0].owner =
        FOREIGN;

    },

    fx => {

      fx.meta.postTokenBalances[1].owner =
        FOREIGN;

    },

    fx => {

      fx.meta.postTokenBalances[1].mint =
        FOREIGN;

    },

    fx => {

      fx.meta.postTokenBalances[1].programId =
        FOREIGN;

    },

    fx => {

      fx.meta.preTokenBalances[0]
        .uiTokenAmount.decimals = 9;

    },

    fx => {

      fx.meta.preTokenBalances.push({

        ...fx.meta.preTokenBalances[0]

      });

    },

    fx => {

      fx.meta.postTokenBalances[1]
        .uiTokenAmount.amount = "-100";

    }

  ];

  for (const mutate of mutations) {

    const fx = fixture();

    mutate(fx);

    assertRejected(

      fx.verify(),

      "payment_balance_evidence_unavailable"

    );

  }

});


/*
 * TEST 21 — INCORRECT BALANCE CHANGES
 */

test("requires exact source debit and treasury credit", () => {

  const underpaid = fixture();

  underpaid.meta.postTokenBalances[1]
    .uiTokenAmount.amount = "999999";

  assertRejected(

    underpaid.verify(),

    "payment_balance_mismatch"

  );

  const insufficientDebit = fixture();

  insufficientDebit.meta.postTokenBalances[0]
    .uiTokenAmount.amount = "1";

  assertRejected(

    insufficientDebit.verify(),

    "payment_balance_mismatch"

  );

  const overpaid = fixture();

  overpaid.meta.postTokenBalances[1]
    .uiTokenAmount.amount = "1000001";

  assertRejected(

    overpaid.verify(),

    "payment_balance_mismatch"

  );

});


/*
 * TEST 22 — NO FALSE ENTITLEMENT
 */

test("valid evidence does not authorize subscriptions or trading", () => {

  const fx = fixture();

  const result = fx.verify();

  const policy =
    getPaymentVerifierPolicy();

  assert.equal(result.ok, true);

  assert.equal(result.evidenceValid, true);

  assert.equal(result.serverVerified, false);

  assert.equal(result.finalityVerified, false);

  assert.equal(result.entitled, false);

  assert.equal(result.aiEnabled, false);

  assert.equal(result.tradingAuthorized, false);

  assert.equal(

    policy.requiredCommitment,

    "finalized"

  );

  assert.equal(

    policy.trustedRpcRequired,

    true

  );

  assert.equal(

    policy.serverQuoteRequired,

    true

  );

  assert.equal(

    policy.automaticPaymentEnabled,

    false

  );

  assert.equal(

    policy.entitlementActivationEnabled,

    false

  );

});

import test from "node:test";
import assert from "node:assert/strict";

import { DatabaseSync } from "node:sqlite";
import { mkdtemp, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  createLagoAccountSessionStore
} from "./lago-account-session-store.mjs";

import {
  SUBSCRIPTION_POLICY
} from "./lago-agent-subscription-contract.mjs";

import {
  TOKEN_PROGRAM_ID,
  MEMO_PROGRAM_ID,
  buildPaymentMemo
} from "./lago-solana-payment-verifier.mjs";

import {
  MAINNET_GENESIS_HASH,
  createLagoSolanaRpc
} from "./lago-solana-rpc.mjs";

import {
  createLagoPaymentQuotes
} from "./lago-agent-payment-quotes.mjs";

import {
  PAYMENT_AUTHORIZATION_VERSION,
  createLagoPaymentAuthorization
} from "./lago-agent-payment-authorization.mjs";

/*
 * LAGO GAME
 * R2.7F1A — PAYMENT AUTHORIZATION TESTS
 *
 * Real session store.
 * Real quote database.
 * Real RPC verification modules.
 * Real subscription ledger.
 * Real global payment registry.
 *
 * Simulated blockchain transport.
 * No actual token transfers.
 */

const POLICY = SUBSCRIPTION_POLICY;

const PAYER_A = "1".repeat(31) + "2";
const PAYER_B = "1".repeat(31) + "3";
const TREASURY = "1".repeat(31) + "4";

const SOURCE_A = "1".repeat(31) + "5";
const SOURCE_B = "1".repeat(31) + "6";
const DESTINATION = "1".repeat(31) + "7";
const FOREIGN = "1".repeat(31) + "8";

const SIGNATURE_A = "1".repeat(63) + "2";
const SIGNATURE_B = "1".repeat(63) + "3";
const SIGNATURE_C = "1".repeat(63) + "4";

const INITIAL_TIME = Date.parse(
  "2027-01-31T12:00:00.000Z"
);

const SLOT = 100000;

const CONFIG = Object.freeze({
  network: POLICY.network,
  tokenMint: POLICY.tokenMint,
  tokenProgram: TOKEN_PROGRAM_ID,
  treasuryWallet: TREASURY,
  destinationTokenAccount: DESTINATION,
  tokenDecimals: 6,
  amountBaseUnits: "1000000"
});


/*
 * SYNTHETIC TOKEN BALANCES
 */

function balance(quote, index, owner, amount) {

  return {
    accountIndex: index,
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
 * SYNTHETIC SOLANA TRANSACTION
 */

function makeTransaction(quote, signature) {

  return {

    slot: SLOT,

    version: "legacy",

    blockTime: quote.issuedAtSeconds,

    transaction: {

      signatures: [signature],

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
            parsed: buildPaymentMemo(quote.quoteId)
          },

          {
            programId: TOKEN_PROGRAM_ID,

            parsed: {

              type: "transferChecked",

              info: {
                authority: quote.payerWallet,
                source: quote.sourceTokenAccount,
                destination: quote.destinationTokenAccount,
                mint: quote.tokenMint,

                tokenAmount: {
                  amount: quote.amountBaseUnits,
                  decimals: quote.tokenDecimals
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
          quote.payerWallet,
          quote.amountBaseUnits
        ),

        balance(
          quote,
          2,
          quote.treasuryWallet,
          "0"
        )

      ],

      postTokenBalances: [

        balance(
          quote,
          1,
          quote.payerWallet,
          "0"
        ),

        balance(
          quote,
          2,
          quote.treasuryWallet,
          quote.amountBaseUnits
        )

      ]

    }

  };

}


/*
 * FULL PAYMENT INTEGRATION FIXTURE
 */

async function fixture(t, overrides = {}) {

  const root = await mkdtemp(
    join(tmpdir(), "lago-payment-auth-")
  );

  const projectRoot = join(root, "project");
  const directory = join(root, "private-payments");

  await mkdir(projectRoot);

  let currentTime = INITIAL_TIME;

  const now = () => currentTime;

  const services = [];
  const quoteStores = [];

  t.after(async () => {

    for (const service of services) {
      service.close();
    }

    for (const store of quoteStores) {
      store.close();
    }

    await rm(root, {
      recursive: true,
      force: true
    });

  });


  /*
   * REAL ACCOUNT AND SESSION STORE
   */

  const sessions = createLagoAccountSessionStore({

    filePath: join(root, "accounts.json"),

    now

  });

  async function createPlayer(id, wallet) {

    const result =
      await sessions.upsertVerifiedTelegramUser({
        id,
        username: "synthetic_" + id
      });

    assert.equal(result.ok, true);

    const accountId = result.account.accountId;

    assert.equal(
      (await sessions.bindWallet(accountId, wallet)).ok,
      true
    );

    const session = await sessions.createSession(
      accountId,
      { ttlSeconds: 3600 }
    );

    assert.equal(session.ok, true);

    return {
      accountId,
      wallet,
      token: session.token
    };

  }

  const playerA = await createPlayer("100001", PAYER_A);
  const playerB = await createPlayer("100002", PAYER_B);


  /*
   * REAL SERVER QUOTE STORE
   */

  const quoteStore = createLagoPaymentQuotes({

    directory,

    projectRoot,

    sessionStore: sessions,

    paymentConfig: CONFIG,

    now,

    async resolvePaymentContext(request) {

      return {

        serverVerified: true,
        walletOwnershipVerified: true,
        tokenAccountsVerified: true,

        accountId: request.accountId,

        network: CONFIG.network,
        tokenMint: CONFIG.tokenMint,
        tokenProgram: CONFIG.tokenProgram,
        tokenDecimals: CONFIG.tokenDecimals,

        payerWallet: request.payerWallet,

        sourceTokenAccount:
          request.payerWallet === PAYER_A
            ? SOURCE_A
            : SOURCE_B,

        treasuryWallet: TREASURY,
        destinationTokenAccount: DESTINATION

      };

    }

  });

  quoteStores.push(quoteStore);


  /*
   * MOCK BLOCKCHAIN TRANSPORT
   *
   * RPC verification itself is real.
   */

  const transactions = new Map();
  const rpcCalls = [];

  const controls = {

    genesisHash: MAINNET_GENESIS_HASH,

    confirmationStatus: "finalized",

    statusError: null,

    transportError: false,

    beforeTransaction: null

  };


  const rpc = createLagoSolanaRpc({

    rpcUrl: "https://rpc.example.test",

    async fetchImpl(url, options) {

      const request = JSON.parse(options.body);

      rpcCalls.push(request.method);

      if (controls.transportError) {

        throw new Error(
          "SYNTHETIC_PRIVATE_RPC_SECRET"
        );

      }

      let result;

      switch (request.method) {

        case "getGenesisHash":

          result = controls.genesisHash;

          break;


        case "getSignatureStatuses": {

          const signature = request.params[0][0];

          result = {

            context: {
              slot: SLOT + 100
            },

            value: [

              transactions.has(signature)

                ? {
                    slot: SLOT,

                    err: controls.statusError,

                    confirmationStatus:
                      controls.confirmationStatus,

                    confirmations:
                      controls.confirmationStatus ===
                        "finalized"
                        ? null
                        : 1
                  }

                : null

            ]

          };

          break;

        }


        case "getTransaction": {

          if (controls.beforeTransaction) {

            await controls.beforeTransaction(
              request.params[0]
            );

          }

          result = transactions.get(
            request.params[0]
          ) || null;

          break;

        }


        default:

          throw new Error(
            "unexpected_rpc_method"
          );

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
            "Content-Type": "application/json"
          }
        }

      );

    }

  });


  /*
   * REAL PAYMENT AUTHORIZATION SERVICE
   */

  function createService(changes = {}) {

    const service = createLagoPaymentAuthorization({

      directory,
      projectRoot,

      sessionStore: sessions,
      quoteStore,
      rpc,
      now,

      ...overrides,
      ...changes

    });

    services.push(service);

    return service;

  }

  const service = createService();


  /*
   * ISSUE SERVER QUOTE
   */

  async function issue(
    player = playerA,
    signature = SIGNATURE_A
  ) {

    const issued = await quoteStore.createQuote({

      sessionToken: player.token

    });

    assert.equal(issued.ok, true);

    const quote = issued.quote;

    const transaction =
      makeTransaction(quote, signature);

    transactions.set(signature, transaction);

    return {

      quote,

      transaction,

      request: {

        sessionToken: player.token,

        quoteId: quote.quoteId,

        transactionSignature: signature

      }

    };

  }


  /*
   * READ DATABASE FOR ASSERTIONS
   */

  function readDatabase(callback) {

    const db = new DatabaseSync(

      join(directory, "lago-subscriptions.sqlite"),

      { readOnly: true }

    );

    try {

      return callback(db);

    } finally {

      db.close();

    }

  }


  function countPayments() {

    return readDatabase(db => {

      return {

        payments: db.prepare(`
          SELECT COUNT(*) AS total
          FROM subscription_payments
        `).get().total,

        claims: db.prepare(`
          SELECT COUNT(*) AS total
          FROM payment_claims
        `).get().total

      };

    });

  }


  return {

    service,
    createService,

    sessions,
    quoteStore,

    playerA,
    playerB,

    transactions,
    rpcCalls,
    controls,

    issue,
    readDatabase,
    countPayments,

    advance(milliseconds) {
      currentTime += milliseconds;
    }

  };

}


function assertRejected(result, reason) {

  assert.equal(result.ok, false);
  assert.equal(result.reason, reason);

  assert.equal(result.paymentRecorded, false);
  assert.equal(result.serverVerified, false);
  assert.equal(result.entitled, false);
  assert.equal(result.aiEnabled, false);
  assert.equal(result.tradingAuthorized, false);

}


function assertEmpty(fx) {

  assert.deepEqual(fx.countPayments(), {
    payments: 0,
    claims: 0
  });

}


/*
 * TEST 01 — REQUIRED DEPENDENCIES
 */

test("requires trusted payment authorization dependencies", () => {

  assert.throws(
    () => createLagoPaymentAuthorization(),
    /payment_session_store_required/
  );

  const sessionStore = {
    async restoreSession() {
      return null;
    }
  };

  assert.throws(
    () => createLagoPaymentAuthorization({
      sessionStore
    }),
    /payment_quote_store_required/
  );

  assert.throws(
    () => createLagoPaymentAuthorization({
      sessionStore,
      quoteStore: {
        getQuote() {
          return null;
        }
      }
    }),
    /trusted_payment_rpc_required/
  );

});


/*
 * TEST 02 — COMPLETE PAYMENT PIPELINE
 */

test("records a finalized subscription through the complete payment pipeline", async t => {

  const fx = await fixture(t);

  const payment = await fx.issue();

  const result = await fx.service.confirmPayment(
    payment.request
  );

  assert.equal(result.ok, true);
  assert.equal(result.paymentRecorded, true);
  assert.equal(result.duplicate, false);

  assert.equal(
    result.accountId,
    fx.playerA.accountId
  );

  assert.equal(
    result.period.currentPeriodStart,
    "2027-01-31T12:00:00.000Z"
  );

  assert.equal(
    result.period.currentPeriodEnd,
    "2027-02-28T12:00:00.000Z"
  );

  assert.deepEqual(fx.countPayments(), {
    payments: 1,
    claims: 1
  });

  assert.deepEqual(fx.rpcCalls, [
    "getGenesisHash",
    "getSignatureStatuses",
    "getTransaction"
  ]);

});


/*
 * TEST 03 — INVALID SIGNATURE AND QUOTE
 */

test("rejects malformed payment requests before RPC", async t => {

  const fx = await fixture(t);
  const payment = await fx.issue();

  for (const changes of [

    { quoteId: "invalid" },

    { transactionSignature: "invalid" },

    { quoteId: null },

    { transactionSignature: null }

  ]) {

    assertRejected(

      await fx.service.confirmPayment({

        ...payment.request,
        ...changes

      }),

      "invalid_payment_request"

    );

  }

  assert.equal(fx.rpcCalls.length, 0);

  assertEmpty(fx);

});


/*
 * TEST 04 — INVALID SESSION
 */

test("rejects unauthenticated payment confirmations", async t => {

  const fx = await fixture(t);
  const payment = await fx.issue();

  for (const sessionToken of [

    null,
    "",
    "invalid-session",
    "a".repeat(257)

  ]) {

    assertRejected(

      await fx.service.confirmPayment({

        ...payment.request,
        sessionToken

      }),

      "authentication_required"

    );

  }

  assert.equal(fx.rpcCalls.length, 0);

  assertEmpty(fx);

});


/*
 * TEST 05 — FOREIGN QUOTE
 */

test("rejects a valid quote submitted by another account", async t => {

  const fx = await fixture(t);
  const payment = await fx.issue();

  assertRejected(

    await fx.service.confirmPayment({

      ...payment.request,

      sessionToken: fx.playerB.token

    }),

    "payment_quote_not_found"

  );

  assert.equal(fx.rpcCalls.length, 0);

  assertEmpty(fx);

});


/*
 * TEST 06 — UNKNOWN QUOTE
 */

test("rejects payment requests without a persisted server quote", async t => {

  const fx = await fixture(t);

  assertRejected(

    await fx.service.confirmPayment({

      sessionToken: fx.playerA.token,

      quoteId: "a".repeat(32),

      transactionSignature: SIGNATURE_A

    }),

    "payment_quote_not_found"

  );

  assert.equal(fx.rpcCalls.length, 0);

  assertEmpty(fx);

});


/*
 * TEST 07 — CLIENT INJECTION
 */

test("ignores client supplied prices accounts and payment evidence", async t => {

  const fx = await fixture(t);
  const payment = await fx.issue();

  const result = await fx.service.confirmPayment({

    ...payment.request,

    accountId: fx.playerB.accountId,

    amountBaseUnits: "1",

    treasuryWallet: FOREIGN,

    quote: {
      ...payment.quote,
      amountBaseUnits: "1"
    },

    serverVerified: true,

    entitled: true,

    aiEnabled: true,

    tradingAuthorized: true

  });

  assert.equal(result.ok, true);
  assert.equal(result.accountId, fx.playerA.accountId);

  const row = fx.readDatabase(db =>

    db.prepare(`
      SELECT *
      FROM subscription_payments
    `).get()

  );

  assert.equal(row.account_id, fx.playerA.accountId);
  assert.equal(row.amount_base_units, "1000000");
  assert.equal(row.treasury_wallet, TREASURY);

  assert.equal(result.entitled, false);
  assert.equal(result.tradingAuthorized, false);

});


/*
 * TEST 08 — WRONG NETWORK
 */

test("rejects payment evidence from a different network", async t => {

  const fx = await fixture(t);
  const payment = await fx.issue();

  fx.controls.genesisHash = "foreign-network";

  assertRejected(

    await fx.service.confirmPayment(payment.request),

    "payment_not_verified"

  );

  assertEmpty(fx);

});


/*
 * TEST 09 — UNFINALIZED PAYMENT
 */

test("allows retry when a transaction is not finalized", async t => {

  const fx = await fixture(t);
  const payment = await fx.issue();

  fx.controls.confirmationStatus = "confirmed";

  const pending = await fx.service.confirmPayment(
    payment.request
  );

  assertRejected(
    pending,
    "transaction_not_finalized"
  );

  assert.equal(pending.retryable, true);

  assertEmpty(fx);

  fx.controls.confirmationStatus = "finalized";

  const finalized = await fx.service.confirmPayment(
    payment.request
  );

  assert.equal(finalized.ok, true);

  assert.deepEqual(fx.countPayments(), {
    payments: 1,
    claims: 1
  });

});


/*
 * TEST 10 — TRANSACTION NOT FOUND
 */

test("allows retry while a transaction is unavailable", async t => {

  const fx = await fixture(t);
  const payment = await fx.issue();

  fx.transactions.delete(SIGNATURE_A);

  const result = await fx.service.confirmPayment(
    payment.request
  );

  assertRejected(result, "transaction_not_found");

  assert.equal(result.retryable, true);

  assertEmpty(fx);

});


/*
 * TEST 11 — FAILED TRANSACTION
 */

test("does not credit failed blockchain transactions", async t => {

  const fx = await fixture(t);
  const payment = await fx.issue();

  fx.controls.statusError = {
    InstructionError: [1, { Custom: 1 }]
  };

  assertRejected(

    await fx.service.confirmPayment(payment.request),

    "payment_not_verified"

  );

  assertEmpty(fx);

});


/*
 * TEST 12 — PAYMENT TAMPERING
 */

test("rejects finalized transactions with altered payment parameters", async t => {

  const fx = await fixture(t);
  const payment = await fx.issue();

  const mutations = [

    tx => {
      tx.transaction.message.instructions[0].parsed =
        "foreign-memo";
    },

    tx => {
      tx.transaction.message.instructions[1]
        .parsed.info.tokenAmount.amount = "1";
    },

    tx => {
      tx.transaction.message.instructions[1]
        .parsed.info.destination = FOREIGN;
    },

    tx => {
      tx.meta.postTokenBalances[1]
        .uiTokenAmount.amount = "999999";
    }

  ];

  for (const mutate of mutations) {

    const tx = structuredClone(
      payment.transaction
    );

    mutate(tx);

    fx.transactions.set(SIGNATURE_A, tx);

    assertRejected(

      await fx.service.confirmPayment(payment.request),

      "payment_not_verified"

    );

    assertEmpty(fx);

  }

});


/*
 * TEST 13 — DELAYED FINALIZATION
 */

test("accepts valid payments finalized after quote expiration", async t => {

  const fx = await fixture(t);
  const payment = await fx.issue();

  fx.advance(901 * 1000);

  const result = await fx.service.confirmPayment(
    payment.request
  );

  assert.equal(result.ok, true);
  assert.equal(result.paymentRecorded, true);

});


/*
 * TEST 14 — PAYMENT OUTSIDE QUOTE WINDOW
 */

test("rejects transactions executed outside the quote validity window", async t => {

  const fx = await fixture(t);
  const payment = await fx.issue();

  fx.advance(901 * 1000);

  payment.transaction.blockTime =
    payment.quote.expiresAtSeconds;

  assertRejected(

    await fx.service.confirmPayment(payment.request),

    "payment_not_verified"

  );

  assertEmpty(fx);

});


/*
 * TEST 15 — FUTURE BLOCK TIME
 */

test("rejects blockchain timestamps in the future", async t => {

  const fx = await fixture(t);
  const payment = await fx.issue();

  payment.transaction.blockTime =
    payment.quote.issuedAtSeconds + 60;

  assertRejected(

    await fx.service.confirmPayment(payment.request),

    "payment_evidence_mismatch"

  );

  assertEmpty(fx);

});


/*
 * TEST 16 — SESSION REVOKED DURING RPC
 */

test("rechecks account authorization after blockchain verification", async t => {

  const fx = await fixture(t);
  const payment = await fx.issue();

  fx.controls.beforeTransaction = async () => {

    await fx.sessions.revokeSession(
      fx.playerA.token
    );

  };

  assertRejected(

    await fx.service.confirmPayment(payment.request),

    "payment_session_changed"

  );

  assertEmpty(fx);

});


/*
 * TEST 17 — SESSION EXPIRED DURING RPC
 */

test("rejects payment when session expires during verification", async t => {

  const fx = await fixture(t);
  const payment = await fx.issue();

  fx.controls.beforeTransaction = async () => {

    fx.advance(3600 * 1000);

  };

  assertRejected(

    await fx.service.confirmPayment(payment.request),

    "payment_session_changed"

  );

  assertEmpty(fx);

});


/*
 * TEST 18 — IDEMPOTENT PAYMENT
 */

test("does not verify or credit the same payment twice", async t => {

  const fx = await fixture(t);
  const payment = await fx.issue();

  const first = await fx.service.confirmPayment(
    payment.request
  );

  const second = await fx.service.confirmPayment(
    payment.request
  );

  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.equal(second.duplicate, true);

  assert.deepEqual(first.period, second.period);

  assert.equal(fx.rpcCalls.length, 3);

  assert.deepEqual(fx.countPayments(), {
    payments: 1,
    claims: 1
  });

});


/*
 * TEST 19 — GLOBAL SIGNATURE REPLAY
 */

test("rejects a recorded signature submitted with a different quote", async t => {

  const fx = await fixture(t);

  const first = await fx.issue();

  assert.equal(

    (await fx.service.confirmPayment(first.request)).ok,

    true

  );

  const second = await fx.issue(
    fx.playerA,
    SIGNATURE_B
  );

  assertRejected(

    await fx.service.confirmPayment({

      ...second.request,

      transactionSignature: SIGNATURE_A

    }),

    "payment_already_used"

  );

  assert.deepEqual(fx.countPayments(), {
    payments: 1,
    claims: 1
  });

});


/*
 * TEST 20 — CONCURRENT DUPLICATE REQUESTS
 */

test("credits concurrent identical requests exactly once", async t => {

  const fx = await fixture(t);
  const payment = await fx.issue();

  const results = await Promise.all(

    Array.from(
      { length: 20 },
      () => fx.service.confirmPayment(payment.request)
    )

  );

  assert.ok(results.every(result => result.ok));

  assert.equal(

    results.filter(
      result => result.duplicate === false
    ).length,

    1

  );

  assert.deepEqual(fx.countPayments(), {
    payments: 1,
    claims: 1
  });

});


/*
 * TEST 21 — CONCURRENT ACCOUNT ISOLATION
 */

test("isolates concurrent payment contexts for separate accounts", async t => {

  const fx = await fixture(t);

  const a = await fx.issue(
    fx.playerA,
    SIGNATURE_A
  );

  const b = await fx.issue(
    fx.playerB,
    SIGNATURE_B
  );

  const [resultA, resultB] = await Promise.all([

    fx.service.confirmPayment(a.request),

    fx.service.confirmPayment(b.request)

  ]);

  assert.equal(resultA.ok, true);
  assert.equal(resultB.ok, true);

  assert.equal(resultA.accountId, fx.playerA.accountId);
  assert.equal(resultB.accountId, fx.playerB.accountId);

  assert.deepEqual(fx.countPayments(), {
    payments: 2,
    claims: 2
  });

  const rows = fx.readDatabase(db =>

    db.prepare(`
      SELECT account_id, payer_wallet
      FROM subscription_payments
    `).all()

  );

  const wallets = new Map(

    rows.map(row => [
      row.account_id,
      row.payer_wallet
    ])

  );

  assert.equal(
    wallets.get(fx.playerA.accountId),
    PAYER_A
  );

  assert.equal(
    wallets.get(fx.playerB.accountId),
    PAYER_B
  );

});


/*
 * TEST 22 — MONTHLY RENEWAL
 */

test("preserves unused subscription time during early renewal", async t => {

  const fx = await fixture(t);

  const first = await fx.issue();

  assert.equal(

    (await fx.service.confirmPayment(first.request)).ok,

    true

  );

  fx.advance(600 * 1000);

  const second = await fx.issue(
    fx.playerA,
    SIGNATURE_B
  );

  const renewal = await fx.service.confirmPayment(
    second.request
  );

  assert.equal(renewal.ok, true);

  assert.equal(

    renewal.period.currentPeriodStart,

    "2027-02-28T12:00:00.000Z"

  );

  assert.equal(

    renewal.period.currentPeriodEnd,

    "2027-03-31T12:00:00.000Z"

  );

  assert.deepEqual(fx.countPayments(), {
    payments: 2,
    claims: 2
  });

});


/*
 * TEST 23 — PERSISTENCE
 */

test("preserves recorded payment identity after service restart", async t => {

  const fx = await fixture(t);
  const payment = await fx.issue();

  const first = await fx.service.confirmPayment(
    payment.request
  );

  assert.equal(first.ok, true);

  fx.service.close();

  const restarted = fx.createService();

  const retry = await restarted.confirmPayment(
    payment.request
  );

  assert.equal(retry.ok, true);
  assert.equal(retry.duplicate, true);

  assert.deepEqual(first.period, retry.period);

  assert.deepEqual(fx.countPayments(), {
    payments: 1,
    claims: 1
  });

});


/*
 * TEST 24 — RPC FAILURE PRIVACY
 */

test("does not expose provider secrets on network failure", async t => {

  const fx = await fixture(t);
  const payment = await fx.issue();

  fx.controls.transportError = true;

  const result = await fx.service.confirmPayment(
    payment.request
  );

  assertRejected(result, "solana_rpc_unavailable");

  assert.equal(result.retryable, true);

  assert.equal(

    JSON.stringify(result).includes(
      "SYNTHETIC_PRIVATE_RPC_SECRET"
    ),

    false

  );

  assertEmpty(fx);

});


/*
 * TEST 25 — NO AUTOMATIC ENTITLEMENT
 */

test("confirmed payment does not grant AI or trading permissions automatically", async t => {

  const fx = await fixture(t);
  const payment = await fx.issue();

  const result = await fx.service.confirmPayment(
    payment.request
  );

  assert.equal(result.ok, true);

  assert.equal(result.paymentRecorded, true);

  assert.equal(result.serverVerified, false);

  assert.equal(result.entitled, false);

  assert.equal(result.aiEnabled, false);

  assert.equal(result.tradingAuthorized, false);

  assert.equal(result.autoRenewal, false);

  assert.equal(

    JSON.stringify(result).includes(
      fx.playerA.token
    ),

    false

  );

});


/*
 * TEST 26 — CLOSED SERVICE
 */

test("rejects payment confirmation after service closure", async t => {

  const fx = await fixture(t);
  const payment = await fx.issue();

  fx.service.close();

  assertRejected(

    await fx.service.confirmPayment(payment.request),

    "payment_service_closed"

  );

  assertEmpty(fx);

});


/*
 * TEST 27 — SECURITY POLICY
 */

test("exposes immutable payment authorization policy", async t => {

  const fx = await fixture(t);

  const policy = fx.service.getPolicy();

  assert.equal(
    fx.service.version,
    PAYMENT_AUTHORIZATION_VERSION
  );

  assert.equal(policy.authenticationRequired, true);
  assert.equal(policy.serverQuoteRequired, true);
  assert.equal(policy.clientQuoteTrusted, false);
  assert.equal(policy.clientReceiptTrusted, false);
  assert.equal(policy.clientAccountIdTrusted, false);

  assert.equal(policy.finalizedTransactionRequired, true);
  assert.equal(policy.sessionRecheckRequired, true);
  assert.equal(policy.isolatedRequestContext, true);

  assert.equal(policy.globalReplayProtectionRequired, true);
  assert.equal(policy.atomicCreditRequired, true);

  assert.equal(policy.automaticPaymentsEnabled, false);
  assert.equal(policy.entitlementActivationEnabled, false);
  assert.equal(policy.tradingAuthorizationGranted, false);

  assert.equal(Object.isFrozen(policy), true);

  assert.equal(
    Object.hasOwn(fx.service, "verifyPayment"),
    false
  );

  assert.equal(
    Object.hasOwn(fx.service, "ledger"),
    false
  );

});

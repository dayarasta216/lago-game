
import test from "node:test";
import assert from "node:assert/strict";

import {
  mkdtemp,
  mkdir,
  rm,
  stat
} from "node:fs/promises";

import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

import {
  createLagoAccountSessionStore
} from "./lago-account-session-store.mjs";

import {
  SUBSCRIPTION_POLICY
} from "./lago-agent-subscription-contract.mjs";

import {
  TOKEN_PROGRAM_ID,
  validatePaymentQuote,
  buildPaymentMemo
} from "./lago-solana-payment-verifier.mjs";

import {
  createLagoPaymentQuotes
} from "./lago-agent-payment-quotes.mjs";


/*
 * LAGO GAME
 * R2.7D3A — PAYMENT QUOTE SECURITY TESTS
 *
 * Real SQLite quote storage.
 * Real account and session storage.
 * Synthetic verified wallet context.
 *
 * No real funds.
 * No blockchain transactions.
 * No production credentials.
 */

const POLICY = SUBSCRIPTION_POLICY;

const PAYER_A = "1".repeat(31) + "2";

const PAYER_B = "1".repeat(31) + "3";

const TREASURY = "1".repeat(31) + "4";

const SOURCE_A = "1".repeat(31) + "5";

const SOURCE_B = "1".repeat(31) + "6";

const DESTINATION = "1".repeat(31) + "7";

const FOREIGN = "1".repeat(31) + "8";

const INITIAL_TIME =
  Date.parse("2027-01-31T12:00:00.000Z");


/*
 * SYNTHETIC SERVER CONFIGURATION
 */

function makeConfig(changes = {}) {

  return {

    network: POLICY.network,

    tokenMint: POLICY.tokenMint,

    tokenProgram: TOKEN_PROGRAM_ID,

    treasuryWallet: TREASURY,

    destinationTokenAccount: DESTINATION,

    tokenDecimals: 6,

    amountBaseUnits: "1000000",

    ...changes

  };

}


/*
 * SYNTHETIC VERIFIED PAYMENT CONTEXT
 */

function makeContext(request, changes = {}) {

  return {

    serverVerified: true,

    walletOwnershipVerified: true,

    tokenAccountsVerified: true,

    accountId: request.accountId,

    network: POLICY.network,

    tokenMint: POLICY.tokenMint,

    tokenProgram: TOKEN_PROGRAM_ID,

    tokenDecimals: 6,

    payerWallet: request.payerWallet,

    sourceTokenAccount:

      request.payerWallet === PAYER_A

        ? SOURCE_A

        : SOURCE_B,

    treasuryWallet: TREASURY,

    destinationTokenAccount: DESTINATION,

    ...changes

  };

}


/*
 * INTEGRATION FIXTURE
 */

async function fixture(t, overrides = {}) {

  const root = await mkdtemp(

    join(
      tmpdir(),
      "lago-quote-test-"
    )

  );


  const instances = [];


  t.after(async () => {

    for (const instance of instances) {

      instance.close();

    }

    await rm(root, {

      recursive: true,

      force: true

    });

  });


  const projectRoot =
    join(root, "project");

  const directory =
    join(root, "private-quotes");

  await mkdir(projectRoot);


  let currentTime = INITIAL_TIME;

  let contextCalls = 0;

  const now = () => currentTime;


  /*
   * REAL ACCOUNT STORAGE
   */

  const sessions =
    createLagoAccountSessionStore({

      filePath:
        join(root, "accounts.json"),

      now

    });


  const a =
    await sessions.upsertVerifiedTelegramUser({

      id: "100001",

      username: "synthetic_a"

    });


  const b =
    await sessions.upsertVerifiedTelegramUser({

      id: "100002",

      username: "synthetic_b"

    });


  assert.equal(a.ok, true);
  assert.equal(b.ok, true);


  const accountIdA =
    a.account.accountId;

  const accountIdB =
    b.account.accountId;


  /*
   * INTERNAL WALLET BINDING
   *
   * Test fixture only.
   * Not cryptographic wallet proof.
   */

  assert.equal(

    (
      await sessions.bindWallet(
        accountIdA,
        PAYER_A
      )
    ).ok,

    true

  );


  assert.equal(

    (
      await sessions.bindWallet(
        accountIdB,
        PAYER_B
      )
    ).ok,

    true

  );


  const sessionA =
    await sessions.createSession(

      accountIdA,

      { ttlSeconds: 3600 }

    );


  const sessionB =
    await sessions.createSession(

      accountIdB,

      { ttlSeconds: 3600 }

    );


  assert.equal(sessionA.ok, true);
  assert.equal(sessionB.ok, true);


  const options = {

    directory,

    projectRoot,

    sessionStore: sessions,

    paymentConfig: makeConfig(),

    now,

    async resolvePaymentContext(request) {

      contextCalls += 1;

      return makeContext(request);

    },

    ...overrides

  };


  function createStore(changes = {}) {

    const store =
      createLagoPaymentQuotes({

        ...options,

        ...changes

      });


    instances.push(store);

    return store;

  }


  const store = createStore();


  return {

    root,

    directory,

    projectRoot,

    sessions,

    store,

    createStore,

    accountIdA,

    accountIdB,

    tokenA: sessionA.token,

    tokenB: sessionB.token,

    databaseFile:

      join(
        directory,
        "lago-payment-quotes.sqlite"
      ),

    issue(changes = {}) {

      return store.createQuote({

        sessionToken: sessionA.token,

        ...changes

      });

    },

    advance(milliseconds) {

      currentTime += milliseconds;

    },

    getContextCalls() {

      return contextCalls;

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
 * TEST 01 — REQUIRED SERVICES
 */

test("requires valid server quote configuration", () => {

  assert.throws(

    () => createLagoPaymentQuotes(),

    /quote_session_store_required/

  );


  const sessionStore = {

    async restoreSession() {

      return null;

    }

  };


  assert.throws(

    () => createLagoPaymentQuotes({

      sessionStore,

      resolvePaymentContext: true

    }),

    /invalid_payment_context_provider/

  );


  assert.throws(

    () => createLagoPaymentQuotes({

      sessionStore,

      now: 100

    }),

    /invalid_quote_clock/

  );

});


/*
 * TEST 02 — INVALID PAYMENT CONFIGURATION
 */

test("rejects unsafe server pricing and token configuration", () => {

  const invalid = [

    { network: "devnet" },

    { tokenMint: FOREIGN },

    { tokenProgram: FOREIGN },

    { treasuryWallet: "invalid" },

    { destinationTokenAccount: "invalid" },

    { tokenDecimals: -1 },

    { tokenDecimals: 19 },

    { tokenDecimals: 6.5 },

    { amountBaseUnits: "0" },

    { amountBaseUnits: "-100" },

    { amountBaseUnits: "1.25" },

    { amountBaseUnits: 1000000 },

    { amountBaseUnits: "0001" },

    {

      amountBaseUnits:
        "18446744073709551616"

    }

  ];


  for (const changes of invalid) {

    assert.throws(

      () => createLagoPaymentQuotes({

        sessionStore: {

          async restoreSession() {

            return null;

          }

        },

        paymentConfig:
          makeConfig(changes)

      }),

      /invalid_server_payment_configuration/

    );

  }

});


/*
 * TEST 03 — MISSING PRICE
 */

test("cannot issue quotes without payment configuration", async t => {

  const fx = await fixture(t, {

    paymentConfig: null

  });


  assertRejected(

    await fx.issue(),

    "payment_configuration_unavailable"

  );

  assert.equal(fx.getContextCalls(), 0);

});


/*
 * TEST 04 — MISSING CONTEXT PROVIDER
 */

test("cannot issue quotes without trusted payment context", async t => {

  const fx = await fixture(t, {

    resolvePaymentContext: null

  });


  assertRejected(

    await fx.issue(),

    "payment_context_unavailable"

  );

});


/*
 * TEST 05 — VALID QUOTE
 */

test("creates a canonical authenticated monthly payment quote", async t => {

  const fx = await fixture(t);

  const result = await fx.issue();

  assert.equal(result.ok, true);

  assert.equal(result.quoteStored, true);

  assert.equal(
    validatePaymentQuote(result.quote),
    true
  );

  assert.equal(
    result.quote.accountId,
    fx.accountIdA
  );

  assert.equal(
    result.quote.payerWallet,
    PAYER_A
  );

  assert.equal(
    result.quote.sourceTokenAccount,
    SOURCE_A
  );

  assert.equal(
    result.quote.treasuryWallet,
    TREASURY
  );

  assert.equal(
    result.quote.destinationTokenAccount,
    DESTINATION
  );

  assert.equal(
    result.quote.amountBaseUnits,
    "1000000"
  );

  assert.match(

    result.quote.quoteId,

    /^[a-f0-9]{32}$/

  );

  assert.equal(

    result.memo,

    buildPaymentMemo(
      result.quote.quoteId
    )

  );

  assert.equal(

    result.quote.expiresAtSeconds -
      result.quote.issuedAtSeconds,

    900

  );

  assert.equal(
    Object.isFrozen(result.quote),
    true
  );

});


/*
 * TEST 06 — UNIQUE QUOTE IDENTIFIERS
 */

test("generates distinct identifiers for new payment quotes", async t => {

  const fx = await fixture(t);

  const results = [

    await fx.issue(),

    await fx.issue(),

    await fx.issue()

  ];

  assert.ok(

    results.every(
      result => result.ok === true
    )

  );

  assert.equal(

    new Set(

      results.map(
        result => result.quote.quoteId
      )

    ).size,

    3

  );

});


/*
 * TEST 07 — CLIENT FIELD INJECTION
 */

test("ignores client pricing wallet and account overrides", async t => {

  const fx = await fixture(t);

  const result =
    await fx.issue({

      accountId: fx.accountIdB,

      quoteId: "a".repeat(32),

      payerWallet: PAYER_B,

      treasuryWallet: FOREIGN,

      amountBaseUnits: "1",

      tokenDecimals: 18,

      expiresAtSeconds: 9999999999,

      serverVerified: true,

      entitled: true

    });

  assert.equal(result.ok, true);

  assert.equal(
    result.quote.accountId,
    fx.accountIdA
  );

  assert.equal(
    result.quote.payerWallet,
    PAYER_A
  );

  assert.equal(
    result.quote.treasuryWallet,
    TREASURY
  );

  assert.equal(
    result.quote.amountBaseUnits,
    "1000000"
  );

  assert.equal(
    result.quote.tokenDecimals,
    6
  );

  assert.equal(result.entitled, false);

});


/*
 * TEST 08 — INVALID SESSION
 */

test("denies unauthenticated payment quote requests", async t => {

  const fx = await fixture(t);

  for (const sessionToken of [

    null,

    "",

    "invalid-session",

    "a".repeat(257)

  ]) {

    assertRejected(

      await fx.issue({
        sessionToken
      }),

      "authentication_required"

    );

  }

  assert.equal(fx.getContextCalls(), 0);

});


/*
 * TEST 09 — EXPIRED SESSION
 */

test("rejects expired sessions before payment verification", async t => {

  const fx = await fixture(t);

  fx.advance(3600 * 1000);

  assertRejected(

    await fx.issue(),

    "authentication_required"

  );

  assert.equal(fx.getContextCalls(), 0);

});


/*
 * TEST 10 — REVOKED SESSION
 */

test("cannot create quotes after logout", async t => {

  const fx = await fixture(t);

  await fx.sessions.revokeSession(
    fx.tokenA
  );

  assertRejected(

    await fx.issue(),

    "authentication_required"

  );

});


/*
 * TEST 11 — INVALID PAYMENT CONTEXT
 */

test("rejects unverified wallet and token account metadata", async t => {

  let changes = {};


  const fx = await fixture(t, {

    async resolvePaymentContext(request) {

      return makeContext(
        request,
        changes
      );

    }

  });


  const invalid = [

    { serverVerified: false },

    { walletOwnershipVerified: false },

    { tokenAccountsVerified: false },

    { accountId: fx.accountIdB },

    { network: "devnet" },

    { tokenMint: FOREIGN },

    { tokenProgram: FOREIGN },

    { tokenDecimals: 9 },

    { treasuryWallet: FOREIGN },

    { destinationTokenAccount: FOREIGN },

    { payerWallet: PAYER_B },

    { sourceTokenAccount: "invalid" },

    { sourceTokenAccount: DESTINATION }

  ];


  for (const entry of invalid) {

    changes = entry;

    assertRejected(

      await fx.issue(),

      "payment_context_not_verified"

    );

  }

});


/*
 * TEST 12 — SESSION REVOKED DURING VERIFICATION
 */

test("rechecks session after asynchronous wallet verification", async t => {

  let revoke;

  const fx = await fixture(t, {

    async resolvePaymentContext(request) {

      await revoke();

      return makeContext(request);

    }

  });

  revoke = () =>

    fx.sessions.revokeSession(
      fx.tokenA
    );


  assertRejected(

    await fx.issue(),

    "payment_session_changed"

  );

});


/*
 * TEST 13 — SESSION EXPIRES DURING VERIFICATION
 */

test("does not issue quotes after session expiration during verification", async t => {

  let advance;

  const fx = await fixture(t, {

    async resolvePaymentContext(request) {

      advance();

      return makeContext(request);

    }

  });

  advance = () =>

    fx.advance(3600 * 1000);


  assertRejected(

    await fx.issue(),

    "payment_session_changed"

  );

});


/*
 * TEST 14 — QUOTE ACCOUNT ISOLATION
 */

test("cannot retrieve a payment quote under another account", async t => {

  const fx = await fixture(t);

  const issued = await fx.issue();

  assert.equal(issued.ok, true);


  const foreign = fx.store.getQuote({

    accountId: fx.accountIdB,

    quoteId: issued.quote.quoteId

  });


  assertRejected(

    foreign,

    "payment_quote_not_found"

  );

});


/*
 * TEST 15 — PERSISTENT QUOTE STORAGE
 */

test("preserves payment quotes across database restart", async t => {

  const fx = await fixture(t);

  const issued = await fx.issue();

  assert.equal(issued.ok, true);

  fx.store.close();


  const restarted =
    fx.createStore();


  const restored =
    restarted.getQuote({

      accountId: fx.accountIdA,

      quoteId: issued.quote.quoteId

    });

  assert.equal(restored.ok, true);

  assert.deepEqual(

    restored.quote,

    issued.quote

  );

  assert.equal(

    restored.memo,

    issued.memo

  );

});


/*
 * TEST 16 — EXPIRED QUOTE RETENTION
 */

test("retains expired quotes for delayed transaction finalization", async t => {

  const fx = await fixture(t);

  const issued = await fx.issue();

  assert.equal(issued.ok, true);

  fx.advance(901 * 1000);


  const restored =
    fx.store.getQuote({

      accountId: fx.accountIdA,

      quoteId: issued.quote.quoteId

    });


  assert.equal(restored.ok, true);

  assert.deepEqual(

    restored.quote,

    issued.quote

  );

  assert.equal(
    restored.paymentVerified,
    false
  );

});


/*
 * TEST 17 — ACTIVE QUOTE LIMIT
 */

test("limits each account to three unexpired quotes", async t => {

  const fx = await fixture(t);

  for (let index = 0; index < 3; index++) {

    assert.equal(

      (await fx.issue()).ok,

      true

    );

  }


  assertRejected(

    await fx.issue(),

    "active_quote_limit_reached"

  );

});


/*
 * TEST 18 — EXACT QUOTE EXPIRATION
 */

test("allows new quotes at the exact expiration boundary", async t => {

  const fx = await fixture(t);

  for (let index = 0; index < 3; index++) {

    assert.equal(

      (await fx.issue()).ok,

      true

    );

  }


  fx.advance(899 * 1000);


  assertRejected(

    await fx.issue(),

    "active_quote_limit_reached"

  );


  fx.advance(1000);


  assert.equal(

    (await fx.issue()).ok,

    true

  );

});


/*
 * TEST 19 — INDEPENDENT ACCOUNT LIMITS
 */

test("maintains independent quote limits for different accounts", async t => {

  const fx = await fixture(t);


  for (let index = 0; index < 3; index++) {

    assert.equal(

      (await fx.issue()).ok,

      true

    );

  }


  const second =
    await fx.store.createQuote({

      sessionToken: fx.tokenB

    });


  assert.equal(second.ok, true);

  assert.equal(

    second.quote.accountId,

    fx.accountIdB

  );

  assert.equal(

    second.quote.payerWallet,

    PAYER_B

  );

});


/*
 * TEST 20 — CONCURRENT REQUESTS
 */

test("enforces quote limits under concurrent creation requests", async t => {

  const fx = await fixture(t);


  const results = await Promise.all(

    Array.from(

      { length: 20 },

      () => fx.issue()

    )

  );


  const successful =
    results.filter(
      result => result.ok === true
    );


  const rejected =
    results.filter(

      result =>

        result.reason ===
          "active_quote_limit_reached"

    );


  assert.equal(successful.length, 3);

  assert.equal(rejected.length, 17);

});


/*
 * TEST 21 — MULTIPLE DATABASE CONNECTIONS
 */

test("enforces quote limits across database connections", async t => {

  const fx = await fixture(t);

  const second = fx.createStore();


  const results = await Promise.all(

    Array.from(

      { length: 10 },

      (_, index) =>

        index % 2 === 0

          ? fx.issue()

          : second.createQuote({

              sessionToken: fx.tokenA

            })

    )

  );


  assert.equal(

    results.filter(
      result => result.ok === true
    ).length,

    3

  );


  assert.equal(

    results.filter(

      result =>

        result.reason ===
          "active_quote_limit_reached"

    ).length,

    7

  );

});


/*
 * TEST 22 — PRIVATE DATABASE LOCATION
 */

test("requires private quote storage outside the project", async t => {

  const fx = await fixture(t);


  assert.throws(

    () => fx.createStore({

      directory:

        join(
          fx.projectRoot,
          "quotes"
        )

    }),

    /quote_directory_inside_project/

  );


  if (process.platform !== "win32") {

    const directoryInfo =
      await stat(fx.directory);

    const databaseInfo =
      await stat(fx.databaseFile);


    assert.equal(

      directoryInfo.mode & 0o077,

      0

    );

    assert.equal(

      databaseInfo.mode & 0o077,

      0

    );

  }

});


/*
 * TEST 23 — CORRUPTED QUOTE RECORD
 */

test("rejects inconsistent persisted quote identity", async t => {

  const fx = await fixture(t);

  const issued = await fx.issue();

  assert.equal(issued.ok, true);


  const db =
    new DatabaseSync(
      fx.databaseFile
    );


  try {

    db.prepare(`

      UPDATE subscription_quotes

      SET quote_json = ?

      WHERE quote_id = ?

    `).run(

      JSON.stringify({

        ...issued.quote,

        accountId: fx.accountIdB

      }),

      issued.quote.quoteId

    );

  } finally {

    db.close();

  }


  assertRejected(

    fx.store.getQuote({

      accountId: fx.accountIdA,

      quoteId: issued.quote.quoteId

    }),

    "quote_integrity_check_failed"

  );

});


/*
 * TEST 24 — EXACT INTEGER PRICE
 */

test("preserves large token prices without precision loss", async t => {

  const amount =
    "18446744073709551615";


  const fx = await fixture(t, {

    paymentConfig: makeConfig({

      amountBaseUnits: amount

    })

  });


  const issued = await fx.issue();

  assert.equal(issued.ok, true);


  const restored =
    fx.store.getQuote({

      accountId: fx.accountIdA,

      quoteId: issued.quote.quoteId

    });


  assert.equal(restored.ok, true);

  assert.equal(

    restored.quote.amountBaseUnits,

    amount

  );

  assert.equal(

    typeof restored.quote.amountBaseUnits,

    "string"

  );

});


/*
 * TEST 25 — PROVIDER ERROR PRIVACY
 */

test("does not expose private payment context provider errors", async t => {

  const fx = await fixture(t, {

    async resolvePaymentContext() {

      throw new Error(

        "SYNTHETIC_PRIVATE_PROVIDER_SECRET"

      );

    }

  });


  const result = await fx.issue();


  assertRejected(

    result,

    "quote_creation_unavailable"

  );


  assert.equal(

    JSON.stringify(result).includes(

      "SYNTHETIC_PRIVATE_PROVIDER_SECRET"

    ),

    false

  );

});


/*
 * TEST 26 — NO FALSE PAYMENT ACTIVATION
 */

test("stored payment quotes cannot activate paid AI", async t => {

  const fx = await fixture(t);

  const result = await fx.issue();

  assert.equal(result.ok, true);

  assert.equal(result.quoteStored, true);

  assert.equal(result.paymentVerified, false);

  assert.equal(result.serverVerified, false);

  assert.equal(result.entitled, false);

  assert.equal(result.aiEnabled, false);

  assert.equal(result.tradingAuthorized, false);

  assert.equal(

    JSON.stringify(result).includes(
      fx.tokenA
    ),

    false

  );

});


/*
 * TEST 27 — CLOSED QUOTE DATABASE
 */

test("rejects operations after quote database closure", async t => {

  const fx = await fixture(t);

  fx.store.close();


  assertRejected(

    await fx.issue(),

    "quote_store_closed"

  );


  assertRejected(

    fx.store.getQuote({

      accountId: fx.accountIdA,

      quoteId: "a".repeat(32)

    }),

    "quote_store_closed"

  );

});


/*
 * TEST 28 — SECURITY POLICY
 */

test("exposes immutable server payment quote policy", async t => {

  const fx = await fixture(t);

  const policy =
    fx.store.getPolicy();


  assert.equal(policy.storage, "sqlite");

  assert.equal(
    policy.quoteLifetimeSeconds,
    900
  );

  assert.equal(
    policy.maxActiveQuotesPerAccount,
    3
  );

  assert.equal(
    policy.quoteIdEntropyBits,
    128
  );

  assert.equal(
    policy.accountAuthenticationRequired,
    true
  );

  assert.equal(
    policy.walletOwnershipRequired,
    true
  );

  assert.equal(
    policy.verifiedTokenAccountsRequired,
    true
  );

  assert.equal(
    policy.clientPricingTrusted,
    false
  );

  assert.equal(
    policy.preserveExpiredQuotes,
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

  assert.equal(
    Object.isFrozen(policy),
    true
  );

});

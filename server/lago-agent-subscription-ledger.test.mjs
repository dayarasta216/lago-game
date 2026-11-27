
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

import {
  DatabaseSync
} from "node:sqlite";

import {
  SUBSCRIPTION_POLICY
} from "./lago-agent-subscription-contract.mjs";

import {
  createLagoSubscriptionLedger
} from "./lago-agent-subscription-ledger.mjs";


/*
 * LAGO GAME
 * R2.7C1 — SUBSCRIPTION LEDGER TESTS
 *
 * Real SQLite database.
 * Synthetic payment verification.
 * No blockchain transactions.
 * No real token transfers.
 */

const ACCOUNT_A =
  "lago_" + "A".repeat(22);

const ACCOUNT_B =
  "lago_" + "B".repeat(22);

const PAYER =
  "A".repeat(44);

const TREASURY =
  "B".repeat(44);

const SIGNATURE_A =
  "C".repeat(88);

const SIGNATURE_B =
  "D".repeat(88);

const SIGNATURE_C =
  "E".repeat(88);

const POLICY =
  SUBSCRIPTION_POLICY;


/*
 * SYNTHETIC PAYMENT RECEIPT
 */

function receipt(request, changes = {}) {

  return {

    serverVerified: true,

    confirmationStatus: "finalized",

    accountId:
      request.accountId,

    quoteId:
      request.quoteId,

    transactionSignature:
      request.transactionSignature,

    product:
      POLICY.product,

    chain:
      POLICY.chain,

    network:
      POLICY.network,

    tokenMint:
      POLICY.tokenMint,

    payerWallet: PAYER,

    treasuryWallet: TREASURY,

    amountBaseUnits: "1000000",

    ...changes

  };

}


/*
 * TEST FIXTURE
 */

async function fixture(t, overrides = {}) {

  const root = await mkdtemp(

    join(
      tmpdir(),
      "lago-subscription-test-"
    )

  );


  const projectRoot =
    join(root, "project");

  const directory =
    join(root, "private-ledger");


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


  await mkdir(projectRoot);


  let currentTime =
    Date.parse(
      "2027-01-31T12:00:00.000Z"
    );


  let verificationCalls = 0;


  const options = {

    directory,

    projectRoot,

    now: () => currentTime,

    async verifyPayment(request) {

      verificationCalls += 1;

      return receipt(request);

    },

    ...overrides

  };


  function createLedger(changes = {}) {

    const ledger =
      createLagoSubscriptionLedger({

        ...options,

        ...changes

      });


    instances.push(ledger);

    return ledger;

  }


  const ledger = createLedger();


  const request = Object.freeze({

    accountId: ACCOUNT_A,

    quoteId: "quote-a",

    transactionSignature:
      SIGNATURE_A

  });


  return {

    root,

    directory,

    projectRoot,

    ledger,

    request,

    createLedger,

    databaseFile:

      join(
        directory,
        "lago-subscriptions.sqlite"
      ),

    apply(changes = {}) {

      return ledger.applyPayment({

        ...request,

        ...changes

      });

    },

    setTime(value) {

      currentTime =
        Date.parse(value);

    },

    getVerificationCalls() {

      return verificationCalls;

    }

  };

}


/*
 * TEST 01 — INITIAL STATE
 */

test(
  "starts without an active subscription",
  async t => {

    const fx = await fixture(t);

    const state =
      fx.ledger.getState(ACCOUNT_A);

    assert.equal(state.ok, true);
    assert.equal(state.status, "inactive");
    assert.equal(state.entitled, false);
    assert.equal(state.aiEnabled, false);
    assert.equal(state.paidThrough, null);
    assert.equal(state.daysRemaining, 0);

  }
);


/*
 * TEST 02 — FIRST PAYMENT
 */

test(
  "records one verified monthly payment",
  async t => {

    const fx = await fixture(t);

    const result = await fx.apply();

    assert.equal(result.ok, true);
    assert.equal(result.recorded, true);
    assert.equal(result.duplicate, false);

    assert.equal(

      result.period.currentPeriodStart,

      "2027-01-31T12:00:00.000Z"

    );

    assert.equal(

      result.period.currentPeriodEnd,

      "2027-02-28T12:00:00.000Z"

    );

    const state =
      fx.ledger.getState(ACCOUNT_A);

    assert.equal(state.status, "active");
    assert.equal(state.daysRemaining, 28);

  }
);


/*
 * TEST 03 — PERSISTENCE
 */

test(
  "preserves subscriptions after reopening the database",
  async t => {

    const fx = await fixture(t);

    assert.equal(
      (await fx.apply()).ok,
      true
    );

    fx.ledger.close();

    const restarted =
      fx.createLedger();

    const state =
      restarted.getState(ACCOUNT_A);

    assert.equal(state.ok, true);
    assert.equal(state.status, "active");

    assert.equal(

      state.paidThrough,

      "2027-02-28T12:00:00.000Z"

    );

  }
);


/*
 * TEST 04 — IDEMPOTENT RETRY
 */

test(
  "repeated payment requests do not extend access twice",
  async t => {

    const fx = await fixture(t);

    const first =
      await fx.apply();

    const duplicate =
      await fx.apply();

    assert.equal(first.ok, true);
    assert.equal(duplicate.ok, true);
    assert.equal(duplicate.duplicate, true);

    assert.deepEqual(

      duplicate.period,

      first.period

    );

    assert.equal(
      fx.getVerificationCalls(),
      1
    );

  }
);


/*
 * TEST 05 — SIGNATURE REPLAY
 */

test(
  "rejects a used signature with another quote",
  async t => {

    const fx = await fixture(t);

    assert.equal(
      (await fx.apply()).ok,
      true
    );

    const replay =
      await fx.apply({

        quoteId: "different-quote"

      });

    assert.equal(replay.ok, false);

    assert.equal(

      replay.reason,

      "payment_already_used"

    );

  }
);


/*
 * TEST 06 — QUOTE REPLAY
 */

test(
  "rejects a used quote with another signature",
  async t => {

    const fx = await fixture(t);

    assert.equal(
      (await fx.apply()).ok,
      true
    );

    const replay =
      await fx.apply({

        transactionSignature:
          SIGNATURE_B

      });

    assert.equal(replay.ok, false);

    assert.equal(

      replay.reason,

      "payment_already_used"

    );

  }
);


/*
 * TEST 07 — CROSS-ACCOUNT REPLAY
 */

test(
  "cannot credit another account using a recorded payment",
  async t => {

    const fx = await fixture(t);

    assert.equal(
      (await fx.apply()).ok,
      true
    );

    const replay =
      await fx.apply({

        accountId: ACCOUNT_B

      });

    assert.equal(replay.ok, false);

    assert.equal(

      replay.reason,

      "payment_already_used"

    );

    assert.equal(

      fx.ledger.getState(
        ACCOUNT_B
      ).status,

      "inactive"

    );

  }
);


/*
 * TEST 08 — EARLY RENEWAL
 */

test(
  "early renewal preserves the currently active period",
  async t => {

    const fx = await fixture(t);

    assert.equal(
      (await fx.apply()).ok,
      true
    );

    fx.setTime(
      "2027-02-10T12:00:00.000Z"
    );

    const renewal =
      await fx.apply({

        quoteId: "quote-b",

        transactionSignature:
          SIGNATURE_B

      });

    assert.equal(renewal.ok, true);

    assert.equal(

      renewal.period.currentPeriodStart,

      "2027-02-28T12:00:00.000Z"

    );

    assert.equal(

      renewal.period.currentPeriodEnd,

      "2027-03-31T12:00:00.000Z"

    );

    const state =
      fx.ledger.getState(ACCOUNT_A);

    assert.equal(state.status, "active");

    assert.equal(

      state.currentPeriodEnd,

      "2027-02-28T12:00:00.000Z"

    );

    assert.equal(

      state.paidThrough,

      "2027-03-31T12:00:00.000Z"

    );

  }
);


/*
 * TEST 09 — MULTIPLE PREPAID MONTHS
 */

test(
  "preserves multiple contiguous prepaid months",
  async t => {

    const fx = await fixture(t);

    assert.equal(
      (await fx.apply()).ok,
      true
    );

    fx.setTime(
      "2027-02-10T12:00:00.000Z"
    );

    assert.equal(

      (
        await fx.apply({

          quoteId: "quote-b",

          transactionSignature:
            SIGNATURE_B

        })
      ).ok,

      true

    );

    assert.equal(

      (
        await fx.apply({

          quoteId: "quote-c",

          transactionSignature:
            SIGNATURE_C

        })
      ).ok,

      true

    );

    const state =
      fx.ledger.getState(ACCOUNT_A);

    assert.equal(state.status, "active");

    assert.equal(

      state.paidThrough,

      "2027-04-30T12:00:00.000Z"

    );

    fx.setTime(
      "2027-03-01T12:00:00.000Z"
    );

    const next =
      fx.ledger.getState(ACCOUNT_A);

    assert.equal(next.status, "active");

    assert.equal(

      next.currentPeriodStart,

      "2027-02-28T12:00:00.000Z"

    );

    assert.equal(

      next.paidThrough,

      "2027-04-30T12:00:00.000Z"

    );

  }
);


/*
 * TEST 10 — EXACT EXPIRATION
 */

test(
  "expires at the exact paid period boundary",
  async t => {

    const fx = await fixture(t);

    assert.equal(
      (await fx.apply()).ok,
      true
    );

    fx.setTime(
      "2027-02-28T11:59:59.999Z"
    );

    assert.equal(

      fx.ledger.getState(
        ACCOUNT_A
      ).status,

      "active"

    );

    fx.setTime(
      "2027-02-28T12:00:00.000Z"
    );

    const state =
      fx.ledger.getState(ACCOUNT_A);

    assert.equal(state.status, "expired");
    assert.equal(state.daysRemaining, 0);
    assert.equal(state.entitled, false);

  }
);


/*
 * TEST 11 — RENEWAL AFTER EXPIRATION
 */

test(
  "starts a new monthly period after expiration",
  async t => {

    const fx = await fixture(t);

    assert.equal(
      (await fx.apply()).ok,
      true
    );

    fx.setTime(
      "2027-03-08T09:00:00.000Z"
    );

    const renewed =
      await fx.apply({

        quoteId: "quote-b",

        transactionSignature:
          SIGNATURE_B

      });

    assert.equal(renewed.ok, true);

    assert.equal(

      renewed.period.currentPeriodStart,

      "2027-03-08T09:00:00.000Z"

    );

    assert.equal(

      renewed.period.currentPeriodEnd,

      "2027-04-08T09:00:00.000Z"

    );

    assert.equal(

      renewed.period.billingAnchorDay,

      8

    );

  }
);


/*
 * TEST 12 — ACCOUNT ISOLATION
 */

test(
  "maintains separate subscriptions for different accounts",
  async t => {

    const fx = await fixture(t);

    assert.equal(
      (await fx.apply()).ok,
      true
    );

    fx.setTime(
      "2027-02-03T12:00:00.000Z"
    );

    assert.equal(

      (
        await fx.apply({

          accountId: ACCOUNT_B,

          quoteId: "quote-b",

          transactionSignature:
            SIGNATURE_B

        })
      ).ok,

      true

    );

    const a =
      fx.ledger.getState(ACCOUNT_A);

    const b =
      fx.ledger.getState(ACCOUNT_B);

    assert.equal(a.status, "active");
    assert.equal(b.status, "active");

    assert.equal(

      a.paidThrough,

      "2027-02-28T12:00:00.000Z"

    );

    assert.equal(

      b.paidThrough,

      "2027-03-03T12:00:00.000Z"

    );

  }
);


/*
 * TEST 13 — MISSING PAYMENT VERIFIER
 */

test(
  "cannot record payments without a server verifier",
  async t => {

    const fx = await fixture(t, {

      verifyPayment: null

    });

    const result =
      await fx.apply();

    assert.equal(result.ok, false);

    assert.equal(

      result.reason,

      "payment_verifier_unavailable"

    );

    assert.equal(

      fx.ledger.getState(
        ACCOUNT_A
      ).status,

      "inactive"

    );

  }
);


/*
 * TEST 14 — INVALID RECEIPTS
 */

test(
  "rejects incorrect and unverified payment receipts",
  async t => {

    const invalid = [

      { serverVerified: false },

      { confirmationStatus: "confirmed" },

      { accountId: ACCOUNT_B },

      { quoteId: "wrong-quote" },

      { transactionSignature: SIGNATURE_B },

      { product: "different-product" },

      { chain: "ethereum" },

      { network: "devnet" },

      { tokenMint: "wrong-mint" },

      { payerWallet: "invalid" },

      { treasuryWallet: "invalid" },

      { treasuryWallet: PAYER },

      { amountBaseUnits: "0" },

      { amountBaseUnits: "-100" },

      { amountBaseUnits: "1.25" },

      { amountBaseUnits: "01" },

      { amountBaseUnits: 1000000 },

      {

        amountBaseUnits:
          "18446744073709551616"

      }

    ];


    let changes = {};


    const fx = await fixture(t, {

      async verifyPayment(request) {

        return receipt(
          request,
          changes
        );

      }

    });


    for (const entry of invalid) {

      changes = entry;

      const result =
        await fx.apply();

      assert.equal(

        result.ok,

        false,

        JSON.stringify(entry)

      );

      assert.equal(

        result.reason,

        "payment_not_verified"

      );

    }


    assert.equal(

      fx.ledger.getState(
        ACCOUNT_A
      ).status,

      "inactive"

    );

  }
);


/*
 * TEST 15 — CLIENT FIELD INJECTION
 */

test(
  "ignores payment evidence supplied in client request fields",
  async t => {

    const fx = await fixture(t, {

      async verifyPayment() {

        return null;

      }

    });


    const result =
      await fx.apply({

        serverVerified: true,

        confirmationStatus: "finalized",

        amountBaseUnits: "1000000",

        entitled: true,

        aiEnabled: true,

        currentPeriodEnd:
          "2099-01-01T00:00:00.000Z"

      });


    assert.equal(result.ok, false);

    assert.equal(

      result.reason,

      "payment_not_verified"

    );

    assert.equal(result.entitled, false);

  }
);


/*
 * TEST 16 — CONCURRENT DUPLICATE
 */

test(
  "credits concurrent identical requests only once",
  async t => {

    const fx = await fixture(t);

    const results = await Promise.all(

      Array.from(

        { length: 20 },

        () => fx.apply()

      )

    );

    assert.ok(

      results.every(
        result => result.ok === true
      )

    );

    assert.equal(

      results.filter(

        result =>
          result.duplicate === false

      ).length,

      1

    );

    assert.equal(

      results.filter(

        result =>
          result.duplicate === true

      ).length,

      19

    );

    assert.equal(

      fx.ledger.getState(
        ACCOUNT_A
      ).paidThrough,

      "2027-02-28T12:00:00.000Z"

    );

  }
);


/*
 * TEST 17 — TWO DATABASE CONNECTIONS
 */

test(
  "prevents duplicate credit across ledger connections",
  async t => {

    const fx = await fixture(t);

    const second =
      fx.createLedger();

    const results =
      await Promise.all([

        fx.apply(),

        second.applyPayment(
          fx.request
        )

      ]);

    assert.ok(

      results.every(
        result => result.ok === true
      )

    );

    assert.equal(

      results.filter(

        result =>
          result.duplicate === false

      ).length,

      1

    );

    assert.equal(

      second.getState(
        ACCOUNT_A
      ).paidThrough,

      "2027-02-28T12:00:00.000Z"

    );

  }
);


/*
 * TEST 18 — PERSISTENT REPLAY PROTECTION
 */

test(
  "preserves replay protection after restart",
  async t => {

    const fx = await fixture(t);

    assert.equal(
      (await fx.apply()).ok,
      true
    );

    fx.ledger.close();

    const restarted =
      fx.createLedger();

    const replay =
      await restarted.applyPayment(
        fx.request
      );

    assert.equal(replay.ok, true);
    assert.equal(replay.duplicate, true);

    const foreign =
      await restarted.applyPayment({

        ...fx.request,

        accountId: ACCOUNT_B

      });

    assert.equal(foreign.ok, false);

    assert.equal(

      foreign.reason,

      "payment_already_used"

    );

  }
);


/*
 * TEST 19 — PRIVATE DATABASE
 */

test(
  "requires private storage outside the project",
  async t => {

    const fx = await fixture(t);

    assert.throws(

      () => createLagoSubscriptionLedger({

        directory:

          join(
            fx.projectRoot,
            "ledger"
          ),

        projectRoot:
          fx.projectRoot

      }),

      /subscription_directory_inside_project/

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

  }
);


/*
 * TEST 20 — EXACT AMOUNT STORAGE
 */

test(
  "stores token base units without numeric precision loss",
  async t => {

    const amount =
      "18446744073709551615";

    const fx = await fixture(t, {

      async verifyPayment(request) {

        return receipt(request, {

          amountBaseUnits: amount

        });

      }

    });


    assert.equal(
      (await fx.apply()).ok,
      true
    );


    const reader =
      new DatabaseSync(

        fx.databaseFile,

        { readOnly: true }

      );


    try {

      const row =
        reader.prepare(`

          SELECT amount_base_units

          FROM subscription_payments

          WHERE transaction_signature = ?

        `).get(SIGNATURE_A);


      assert.equal(

        typeof row.amount_base_units,

        "string"

      );

      assert.equal(

        row.amount_base_units,

        amount

      );

    } finally {

      reader.close();

    }

  }
);


/*
 * TEST 21 — VERIFIER FAILURE
 */

test(
  "does not expose internal payment verification errors",
  async t => {

    const fx = await fixture(t, {

      async verifyPayment() {

        throw new Error(
          "SYNTHETIC_PRIVATE_RPC_ERROR"
        );

      }

    });


    const result =
      await fx.apply();

    assert.equal(result.ok, false);

    assert.equal(

      result.reason,

      "subscription_ledger_unavailable"

    );

    assert.equal(

      JSON.stringify(result).includes(
        "SYNTHETIC_PRIVATE_RPC_ERROR"
      ),

      false

    );

  }
);


/*
 * TEST 22 — NO AUTOMATIC AI ACTIVATION
 */

test(
  "recorded billing does not automatically authorize AI or trading",
  async t => {

    const fx = await fixture(t);

    const payment =
      await fx.apply();

    const state =
      fx.ledger.getState(ACCOUNT_A);

    assert.equal(payment.ok, true);
    assert.equal(payment.entitled, false);
    assert.equal(payment.aiEnabled, false);
    assert.equal(payment.serverVerified, false);

    assert.equal(state.status, "active");
    assert.equal(state.entitled, false);
    assert.equal(state.aiEnabled, false);
    assert.equal(state.autoRenewal, false);
    assert.equal(state.tradingAuthorized, false);

  }
);


/*
 * TEST 23 — CLOSED DATABASE
 */

test(
  "rejects operations after closing the ledger",
  async t => {

    const fx = await fixture(t);

    fx.ledger.close();

    const payment =
      await fx.apply();

    const state =
      fx.ledger.getState(ACCOUNT_A);

    assert.equal(payment.ok, false);
    assert.equal(payment.reason, "ledger_closed");

    assert.equal(state.ok, false);
    assert.equal(state.reason, "ledger_closed");

  }
);

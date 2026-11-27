import test from "node:test";
import assert from "node:assert/strict";

import { DatabaseSync } from "node:sqlite";
import { mkdtemp, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  SUBSCRIPTION_POLICY
} from "./lago-agent-subscription-contract.mjs";

import {
  createLagoSubscriptionLedger
} from "./lago-agent-subscription-ledger.mjs";

import {
  PAYMENT_REGISTRY_VERSION,
  installGlobalPaymentRegistry
} from "./lago-payment-registry.mjs";

/*
 * LAGO GAME
 * R2.7E2 — GLOBAL PAYMENT REGISTRY TESTS
 *
 * Real SQLite transactions.
 * Synthetic payment evidence.
 * No real token transfers.
 */

const POLICY = SUBSCRIPTION_POLICY;

const ACCOUNT_A = "lago_" + "A".repeat(22);
const ACCOUNT_B = "lago_" + "B".repeat(22);

const SIGNATURE_A = "1".repeat(63) + "2";
const SIGNATURE_B = "1".repeat(63) + "3";
const SIGNATURE_C = "1".repeat(63) + "4";

const PAYER = "1".repeat(31) + "5";
const TREASURY = "1".repeat(31) + "6";

const QUOTE_A = "a".repeat(32);
const QUOTE_B = "b".repeat(32);
const QUOTE_C = "c".repeat(32);

const NOW = Date.parse("2027-01-31T12:00:00.000Z");
const RECORDED_AT = new Date(NOW).toISOString();


/*
 * SYNTHETIC VERIFIED RECEIPT
 */

function makeReceipt(request) {
  return {
    ...request,
    serverVerified: true,
    confirmationStatus: "finalized",
    product: POLICY.product,
    chain: POLICY.chain,
    network: POLICY.network,
    tokenMint: POLICY.tokenMint,
    payerWallet: PAYER,
    treasuryWallet: TREASURY,
    amountBaseUnits: "1000000"
  };
}


/*
 * SHARED DATABASE FIXTURE
 */

async function fixture(t, overrides = {}) {

  const root = await mkdtemp(
    join(tmpdir(), "lago-registry-test-")
  );

  const projectRoot = join(root, "project");
  const directory = join(root, "private-payments");

  await mkdir(projectRoot);

  const connections = [];
  const ledgers = [];

  t.after(async () => {

    for (const db of connections) {
      db.close();
    }

    for (const ledger of ledgers) {
      ledger.close();
    }

    await rm(root, {
      recursive: true,
      force: true
    });

  });

  let verificationCalls = 0;

  const options = {
    directory,
    projectRoot,
    now: () => NOW,

    async verifyPayment(request) {
      verificationCalls++;
      return makeReceipt(request);
    },

    ...overrides
  };

  function createLedger() {
    const ledger = createLagoSubscriptionLedger(options);
    ledgers.push(ledger);
    return ledger;
  }

  const ledger = createLedger();

  const file = join(
    directory,
    "lago-subscriptions.sqlite"
  );

  function connect() {

    const db = new DatabaseSync(file, {
      timeout: 5000
    });

    connections.push(db);

    db.exec("PRAGMA busy_timeout = 5000");
    db.exec("PRAGMA recursive_triggers = ON");

    return db;
  }

  const db = connect();

  const registry = installGlobalPaymentRegistry(db);

  const request = {
    accountId: ACCOUNT_A,
    quoteId: QUOTE_A,
    transactionSignature: SIGNATURE_A
  };

  /*
   * Synthetic second paid product.
   * Tests cross-product protection.
   */

  db.exec(`
    CREATE TABLE test_product_payments (
      transaction_signature TEXT PRIMARY KEY NOT NULL,
      quote_id TEXT UNIQUE NOT NULL,
      account_id TEXT NOT NULL,
      recorded_at TEXT NOT NULL
    ) STRICT;

    CREATE TRIGGER test_product_register_claim
    AFTER INSERT ON test_product_payments
    BEGIN
      INSERT INTO payment_claims (
        chain,
        network,
        transaction_signature,
        quote_id,
        account_id,
        product,
        recorded_at
      ) VALUES (
        'solana',
        'mainnet-beta',
        NEW.transaction_signature,
        NEW.quote_id,
        NEW.account_id,
        'test-premium-product',
        NEW.recorded_at
      );
    END;
  `);

  function otherProduct(changes = {}) {

    const payment = {
      ...request,
      ...changes
    };

    return db.prepare(`
      INSERT INTO test_product_payments (
        transaction_signature,
        quote_id,
        account_id,
        recorded_at
      ) VALUES (?, ?, ?, ?)
    `).run(
      payment.transactionSignature,
      payment.quoteId,
      payment.accountId,
      RECORDED_AT
    );
  }

  function count(table) {

    const allowed = [
      "payment_claims",
      "subscription_payments",
      "test_product_payments"
    ];

    if (!allowed.includes(table)) {
      throw new Error("invalid_test_table");
    }

    return db.prepare(
      `SELECT COUNT(*) AS total FROM ${table}`
    ).get().total;
  }

  return {
    db,
    registry,
    ledger,
    request,
    createLedger,
    connect,
    otherProduct,
    count,

    apply(changes = {}) {
      return ledger.applyPayment({
        ...request,
        ...changes
      });
    },

    getVerificationCalls() {
      return verificationCalls;
    }
  };
}


/*
 * LEGACY SCHEMA FOR MIGRATION TESTS
 */

function legacyDatabase(t) {

  const db = new DatabaseSync(":memory:");

  t.after(() => db.close());

  db.exec(`
    CREATE TABLE subscription_payments (
      transaction_signature TEXT PRIMARY KEY NOT NULL,
      quote_id TEXT UNIQUE NOT NULL,
      account_id TEXT NOT NULL,
      paid_at TEXT NOT NULL
    ) STRICT;
  `);

  return db;
}


function insertLegacyPayment(db, changes = {}) {

  const record = {
    transactionSignature: SIGNATURE_A,
    quoteId: QUOTE_A,
    accountId: ACCOUNT_A,
    recordedAt: RECORDED_AT,
    ...changes
  };

  db.prepare(`
    INSERT INTO subscription_payments (
      transaction_signature,
      quote_id,
      account_id,
      paid_at
    ) VALUES (?, ?, ?, ?)
  `).run(
    record.transactionSignature,
    record.quoteId,
    record.accountId,
    record.recordedAt
  );
}


/*
 * TEST 01 — REQUIRED DATABASE
 */

test("requires an existing subscription database", t => {

  assert.throws(
    () => installGlobalPaymentRegistry(null),
    /payment_registry_database_required/
  );

  const db = new DatabaseSync(":memory:");
  t.after(() => db.close());

  assert.throws(
    () => installGlobalPaymentRegistry(db),
    /subscription_schema_required/
  );

});


/*
 * TEST 02 — EMPTY REGISTRY
 */

test("starts with an empty payment registry", async t => {

  const fx = await fixture(t);

  assert.equal(fx.count("payment_claims"), 0);

  const result = fx.registry.findBySignature(
    SIGNATURE_A
  );

  assert.equal(result.ok, true);
  assert.equal(result.found, false);
  assert.equal(result.claim, null);

});


/*
 * TEST 03 — ATOMIC REGISTRATION
 */

test("registers subscription and global claim together", async t => {

  const fx = await fixture(t);

  const payment = await fx.apply();

  assert.equal(payment.ok, true);
  assert.equal(fx.count("subscription_payments"), 1);
  assert.equal(fx.count("payment_claims"), 1);

  const result = fx.registry.findBySignature(
    SIGNATURE_A
  );

  assert.equal(result.ok, true);
  assert.equal(result.found, true);

  assert.equal(result.claim.accountId, ACCOUNT_A);
  assert.equal(result.claim.quoteId, QUOTE_A);
  assert.equal(result.claim.product, POLICY.product);
  assert.equal(result.claim.network, POLICY.network);
  assert.equal(result.claim.recordedAt, RECORDED_AT);

});


/*
 * TEST 04 — QUOTE LOOKUP
 */

test("returns the same claim by signature and quote", async t => {

  const fx = await fixture(t);

  assert.equal((await fx.apply()).ok, true);

  const signature = fx.registry.findBySignature(
    SIGNATURE_A
  );

  const quote = fx.registry.findByQuote(
    QUOTE_A
  );

  assert.deepEqual(signature.claim, quote.claim);
  assert.equal(Object.isFrozen(quote.claim), true);

});


/*
 * TEST 05 — IDEMPOTENT RETRY
 */

test("does not create additional claims on payment retry", async t => {

  const fx = await fixture(t);

  const first = await fx.apply();
  const retry = await fx.apply();

  assert.equal(first.ok, true);
  assert.equal(first.duplicate, false);

  assert.equal(retry.ok, true);
  assert.equal(retry.duplicate, true);

  assert.deepEqual(first.period, retry.period);

  assert.equal(fx.count("payment_claims"), 1);
  assert.equal(fx.count("subscription_payments"), 1);
  assert.equal(fx.getVerificationCalls(), 1);

});


/*
 * TEST 06 — SIGNATURE REPLAY
 */

test("rejects reused transaction signatures", async t => {

  const fx = await fixture(t);

  assert.equal((await fx.apply()).ok, true);

  const result = await fx.apply({
    quoteId: QUOTE_B
  });

  assert.equal(result.ok, false);
  assert.equal(result.reason, "payment_already_used");
  assert.equal(fx.count("payment_claims"), 1);

});


/*
 * TEST 07 — QUOTE REPLAY
 */

test("rejects reused payment quote identifiers", async t => {

  const fx = await fixture(t);

  assert.equal((await fx.apply()).ok, true);

  const result = await fx.apply({
    transactionSignature: SIGNATURE_B
  });

  assert.equal(result.ok, false);
  assert.equal(result.reason, "payment_already_used");
  assert.equal(fx.count("payment_claims"), 1);

});


/*
 * TEST 08 — ACCOUNT REPLAY
 */

test("rejects payment reuse by another account", async t => {

  const fx = await fixture(t);

  assert.equal((await fx.apply()).ok, true);

  const result = await fx.apply({
    accountId: ACCOUNT_B
  });

  assert.equal(result.ok, false);
  assert.equal(result.reason, "payment_already_used");

  assert.equal(
    fx.ledger.getState(ACCOUNT_B).status,
    "inactive"
  );

});


/*
 * TEST 09 — OTHER PRODUCT FIRST
 */

test("rejects subscriptions using another product payment", async t => {

  const fx = await fixture(t);

  fx.otherProduct();

  const result = await fx.apply();

  assert.equal(result.ok, false);
  assert.equal(result.reason, "payment_already_used");

  assert.equal(fx.count("payment_claims"), 1);
  assert.equal(fx.count("subscription_payments"), 0);
  assert.equal(fx.getVerificationCalls(), 0);

});


/*
 * TEST 10 — SUBSCRIPTION FIRST
 */

test("rejects another product using a subscription payment", async t => {

  const fx = await fixture(t);

  assert.equal((await fx.apply()).ok, true);

  assert.throws(
    () => fx.otherProduct(),
    /global_payment_already_used/
  );

  assert.equal(fx.count("test_product_payments"), 0);
  assert.equal(fx.count("subscription_payments"), 1);
  assert.equal(fx.count("payment_claims"), 1);

});


/*
 * TEST 11 — CROSS-PRODUCT QUOTE REPLAY
 */

test("rejects quote reuse between different products", async t => {

  const fx = await fixture(t);

  assert.equal((await fx.apply()).ok, true);

  assert.throws(

    () => fx.otherProduct({
      transactionSignature: SIGNATURE_B
    }),

    /global_payment_already_used/

  );

  assert.equal(fx.count("test_product_payments"), 0);
  assert.equal(fx.count("payment_claims"), 1);

});


/*
 * TEST 12 — INDEPENDENT PAYMENTS
 */

test("accepts independent payments for different products", async t => {

  const fx = await fixture(t);

  assert.equal((await fx.apply()).ok, true);

  fx.otherProduct({
    transactionSignature: SIGNATURE_B,
    quoteId: QUOTE_B
  });

  assert.equal(fx.count("payment_claims"), 2);
  assert.equal(fx.count("subscription_payments"), 1);
  assert.equal(fx.count("test_product_payments"), 1);

});


/*
 * TEST 13 — TWO IDENTIFIER CONFLICTS
 */

test("rejects requests combining identifiers from separate claims", async t => {

  const fx = await fixture(t);

  assert.equal((await fx.apply()).ok, true);

  fx.otherProduct({
    transactionSignature: SIGNATURE_B,
    quoteId: QUOTE_B
  });

  const result = await fx.apply({
    transactionSignature: SIGNATURE_A,
    quoteId: QUOTE_B
  });

  assert.equal(result.ok, false);
  assert.equal(result.reason, "payment_already_used");
  assert.equal(fx.count("payment_claims"), 2);

});


/*
 * TEST 14 — CLAIM UPDATE PROTECTION
 */

test("prevents modifying registered payment claims", async t => {

  const fx = await fixture(t);

  assert.equal((await fx.apply()).ok, true);

  assert.throws(() => {

    fx.db.prepare(`
      UPDATE payment_claims
      SET account_id = ?
      WHERE transaction_signature = ?
    `).run(ACCOUNT_B, SIGNATURE_A);

  }, /payment_claims_are_immutable/);

});


/*
 * TEST 15 — CLAIM DELETE PROTECTION
 */

test("prevents deleting registered payment claims", async t => {

  const fx = await fixture(t);

  assert.equal((await fx.apply()).ok, true);

  assert.throws(() => {

    fx.db.prepare(`
      DELETE FROM payment_claims
      WHERE transaction_signature = ?
    `).run(SIGNATURE_A);

  }, /payment_claims_are_immutable/);

  assert.equal(fx.count("payment_claims"), 1);

});


/*
 * TEST 16 — REPLACE BYPASS PROTECTION
 */

test("prevents replacing payment claims through INSERT OR REPLACE", async t => {

  const fx = await fixture(t);

  assert.equal((await fx.apply()).ok, true);

  assert.throws(() => {

    fx.db.prepare(`
      INSERT OR REPLACE INTO payment_claims (
        chain,
        network,
        transaction_signature,
        quote_id,
        account_id,
        product,
        recorded_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      POLICY.chain,
      POLICY.network,
      SIGNATURE_A,
      QUOTE_C,
      ACCOUNT_B,
      "test-premium-product",
      RECORDED_AT
    );

  }, /global_payment_already_used/);

  const original = fx.registry.findBySignature(
    SIGNATURE_A
  );

  assert.equal(original.claim.accountId, ACCOUNT_A);
  assert.equal(original.claim.product, POLICY.product);

});


/*
 * TEST 17 — SUBSCRIPTION UPDATE PROTECTION
 */

test("prevents modification of financial subscription history", async t => {

  const fx = await fixture(t);

  assert.equal((await fx.apply()).ok, true);

  assert.throws(() => {

    fx.db.prepare(`
      UPDATE subscription_payments
      SET period_end = ?
      WHERE transaction_signature = ?
    `).run(
      "2099-01-01T00:00:00.000Z",
      SIGNATURE_A
    );

  }, /subscription_payments_are_immutable/);

});


/*
 * TEST 18 — SUBSCRIPTION DELETE PROTECTION
 */

test("prevents deletion of financial subscription history", async t => {

  const fx = await fixture(t);

  assert.equal((await fx.apply()).ok, true);

  assert.throws(() => {

    fx.db.prepare(`
      DELETE FROM subscription_payments
      WHERE transaction_signature = ?
    `).run(SIGNATURE_A);

  }, /subscription_payments_are_immutable/);

  assert.equal(fx.count("subscription_payments"), 1);

});


/*
 * TEST 19 — TRANSACTION ROLLBACK
 */

test("rolls back product payment and global claim together", async t => {

  const fx = await fixture(t);

  fx.db.exec("BEGIN IMMEDIATE");

  fx.otherProduct();

  assert.equal(fx.count("payment_claims"), 1);
  assert.equal(fx.count("test_product_payments"), 1);

  fx.db.exec("ROLLBACK");

  assert.equal(fx.count("payment_claims"), 0);
  assert.equal(fx.count("test_product_payments"), 0);

  assert.equal((await fx.apply()).ok, true);

});


/*
 * TEST 20 — VERIFICATION FAILURE
 */

test("does not register unverified payments", async t => {

  const fx = await fixture(t, {
    async verifyPayment() {
      return null;
    }
  });

  const result = await fx.apply();

  assert.equal(result.ok, false);
  assert.equal(result.reason, "payment_not_verified");
  assert.equal(fx.count("payment_claims"), 0);
  assert.equal(fx.count("subscription_payments"), 0);

});


/*
 * TEST 21 — CONCURRENT CREDIT
 */

test("registers only one claim across concurrent ledger connections", async t => {

  const fx = await fixture(t);

  const second = fx.createLedger();

  const results = await Promise.all(

    Array.from(
      { length: 20 },
      (_, index) => index % 2 === 0
        ? fx.apply()
        : second.applyPayment(fx.request)
    )

  );

  assert.ok(results.every(item => item.ok));

  assert.equal(
    results.filter(item => !item.duplicate).length,
    1
  );

  assert.equal(fx.count("payment_claims"), 1);
  assert.equal(fx.count("subscription_payments"), 1);

});


/*
 * TEST 22 — REPLAY DURING VERIFICATION
 */

test("rechecks global payment claims after asynchronous verification", async t => {

  let beginOtherProduct;

  const fx = await fixture(t, {

    async verifyPayment(request) {

      beginOtherProduct();

      return makeReceipt(request);

    }

  });

  beginOtherProduct = () => fx.otherProduct();

  const result = await fx.apply();

  assert.equal(result.ok, false);
  assert.equal(result.reason, "payment_already_used");

  assert.equal(fx.count("subscription_payments"), 0);
  assert.equal(fx.count("payment_claims"), 1);
  assert.equal(fx.count("test_product_payments"), 1);

});


/*
 * TEST 23 — PERSISTENT REPLAY PROTECTION
 */

test("preserves global payment claims after ledger restart", async t => {

  const fx = await fixture(t);

  assert.equal((await fx.apply()).ok, true);

  fx.ledger.close();

  const restarted = fx.createLedger();

  const retry = await restarted.applyPayment(
    fx.request
  );

  assert.equal(retry.ok, true);
  assert.equal(retry.duplicate, true);

  assert.equal(fx.count("payment_claims"), 1);
  assert.equal(fx.count("subscription_payments"), 1);

});


/*
 * TEST 24 — LEGACY MIGRATION
 */

test("migrates existing subscription payments into the global registry", t => {

  const db = legacyDatabase(t);

  insertLegacyPayment(db);

  insertLegacyPayment(db, {
    transactionSignature: SIGNATURE_B,
    quoteId: QUOTE_B,
    accountId: ACCOUNT_B
  });

  const registry = installGlobalPaymentRegistry(db);

  const first = registry.findBySignature(
    SIGNATURE_A
  );

  const second = registry.findByQuote(
    QUOTE_B
  );

  assert.equal(first.found, true);
  assert.equal(second.found, true);

  assert.equal(first.claim.accountId, ACCOUNT_A);
  assert.equal(second.claim.accountId, ACCOUNT_B);

  assert.equal(first.claim.product, POLICY.product);

  assert.equal(
    db.prepare(
      "SELECT COUNT(*) AS total FROM payment_claims"
    ).get().total,
    2
  );

});


/*
 * TEST 25 — IDEMPOTENT MIGRATION
 */

test("does not duplicate claims when installing the registry again", t => {

  const db = legacyDatabase(t);

  insertLegacyPayment(db);

  installGlobalPaymentRegistry(db);
  installGlobalPaymentRegistry(db);
  installGlobalPaymentRegistry(db);

  assert.equal(
    db.prepare(
      "SELECT COUNT(*) AS total FROM payment_claims"
    ).get().total,
    1
  );

});


/*
 * TEST 26 — MIGRATION CONFLICT
 */

test("rejects inconsistent preexisting payment claims", t => {

  const db = legacyDatabase(t);

  installGlobalPaymentRegistry(db);

  db.prepare(`
    INSERT INTO payment_claims (
      chain,
      network,
      transaction_signature,
      quote_id,
      account_id,
      product,
      recorded_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    POLICY.chain,
    POLICY.network,
    SIGNATURE_A,
    QUOTE_A,
    ACCOUNT_B,
    POLICY.product,
    RECORDED_AT
  );

  assert.throws(
    () => installGlobalPaymentRegistry(db),
    /payment_registry_integrity_failed/
  );

  assert.equal(
    db.prepare(
      "SELECT COUNT(*) AS total FROM payment_claims"
    ).get().total,
    1
  );

});


/*
 * TEST 27 — INVALID LOOKUPS
 */

test("rejects malformed payment registry identifiers", async t => {

  const fx = await fixture(t);

  assert.equal(
    fx.registry.findBySignature("invalid").ok,
    false
  );

  assert.equal(
    fx.registry.findByQuote(null).ok,
    false
  );

  assert.equal(
    fx.registry.findByQuote("a".repeat(129)).ok,
    false
  );

});


/*
 * TEST 28 — NO AUTOMATIC ENTITLEMENT
 */

test("global claims do not authorize paid AI or trading", async t => {

  const fx = await fixture(t);

  const payment = await fx.apply();

  const claim = fx.registry.findBySignature(
    SIGNATURE_A
  ).claim;

  assert.equal(payment.ok, true);
  assert.equal(payment.entitled, false);
  assert.equal(payment.aiEnabled, false);

  assert.equal(claim.entitlementGranted, false);
  assert.equal(claim.tradingAuthorized, false);

});


/*
 * TEST 29 — SECURITY POLICY
 */

test("exposes immutable global payment security policy", async t => {

  const fx = await fixture(t);

  const policy = fx.registry.getPolicy();
  const ledgerPolicy = fx.ledger.getPolicy();

  assert.equal(
    fx.registry.version,
    PAYMENT_REGISTRY_VERSION
  );

  assert.equal(policy.appendOnly, true);
  assert.equal(policy.uniqueTransactionPerNetwork, true);
  assert.equal(policy.uniqueQuotePerNetwork, true);
  assert.equal(policy.atomicProductCreditRequired, true);
  assert.equal(policy.clientClaimsAllowed, false);
  assert.equal(policy.entitlementActivationEnabled, false);

  assert.equal(
    ledgerPolicy.globalPaymentRegistryEnabled,
    true
  );

  assert.equal(
    ledgerPolicy.crossProductReplayProtection,
    true
  );

  assert.equal(
    ledgerPolicy.atomicPaymentClaim,
    true
  );

  assert.equal(Object.isFrozen(policy), true);

});

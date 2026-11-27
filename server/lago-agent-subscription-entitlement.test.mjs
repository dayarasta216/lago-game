import test from "node:test";
import assert from "node:assert/strict";

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
  createLagoSubscriptionLedger
} from "./lago-agent-subscription-ledger.mjs";

import {
  SUBSCRIPTION_ENTITLEMENT_VERSION,
  createLagoSubscriptionEntitlement
} from "./lago-agent-subscription-entitlement.mjs";

import {
  createLagoMemoryAccess
} from "./lago-agent-memory-access.mjs";

/*
 * LAGO GAME
 * R2.7F2A — SUBSCRIPTION ENTITLEMENT TESTS
 *
 * Real account sessions.
 * Real SQLite subscription ledger.
 * Real global payment registry.
 * Real entitlement engine.
 * Real memory access control.
 *
 * Synthetic payment receipts.
 * No blockchain transactions.
 * No real funds.
 */

const POLICY = SUBSCRIPTION_POLICY;

const PAYER = "1".repeat(31) + "2";
const TREASURY = "1".repeat(31) + "3";

const START = "2027-01-31T12:00:00.000Z";
const END = "2027-02-28T12:00:00.000Z";

const INITIAL_TIME = Date.parse(START);


/*
 * INTEGRATION FIXTURE
 */

async function fixture(t) {

  const root = await mkdtemp(
    join(tmpdir(), "lago-entitlement-test-")
  );

  const projectRoot = join(root, "project");
  const directory = join(root, "private-payments");

  await mkdir(projectRoot);

  const services = [];

  let currentTime = INITIAL_TIME;
  let paymentSequence = 0;

  const now = () => currentTime;

  t.after(async () => {

    for (const service of services.reverse()) {
      service.close();
    }

    await rm(root, {
      recursive: true,
      force: true
    });

  });


  /*
   * REAL ACCOUNT SESSION STORE
   */

  const sessions = createLagoAccountSessionStore({
    filePath: join(root, "accounts.json"),
    now
  });

  async function createPlayer(id) {

    const result =
      await sessions.upsertVerifiedTelegramUser({
        id,
        username: "synthetic_" + id
      });

    assert.equal(result.ok, true);

    const accountId = result.account.accountId;

    const session = await sessions.createSession(
      accountId,
      { ttlSeconds: 3600 }
    );

    assert.equal(session.ok, true);

    return {
      accountId,
      token: session.token
    };

  }

  const playerA = await createPlayer("100001");
  const playerB = await createPlayer("100002");


  /*
   * REAL SUBSCRIPTION LEDGER
   *
   * Test-only payment verifier.
   */

  const ledger = createLagoSubscriptionLedger({

    directory,
    projectRoot,
    now,

    async verifyPayment(request) {

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

  });

  services.push(ledger);


  /*
   * ENTITLEMENT SERVICES
   */

  function createService(changes = {}) {

    const service =
      createLagoSubscriptionEntitlement({

        directory,
        projectRoot,

        sessionStore: sessions,

        now,

        ...changes

      });

    services.push(service);

    return service;

  }

  /*
   * Production default must remain disabled.
   */

  const disabled = createService();

  /*
   * Enabled exclusively inside this test fixture.
   */

  const enabled = createService({
    verifiedLedgerEnabled: true
  });


  /*
   * REGISTER SYNTHETIC PAYMENT
   */

  async function pay(player = playerA) {

    paymentSequence++;

    const alphabet =
      "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

    const signature =
      "1".repeat(63) +
      alphabet[paymentSequence - 1];

    const quoteId =
      paymentSequence.toString(16).padStart(32, "0");

    const payment = await ledger.applyPayment({

      accountId: player.accountId,

      quoteId,

      transactionSignature: signature

    });

    assert.equal(payment.ok, true);

    return payment;

  }


  /*
   * CREATE FRESH AUTHENTICATED SESSION
   */

  async function refreshSession(player = playerA) {

    const session = await sessions.createSession(

      player.accountId,

      { ttlSeconds: 3600 }

    );

    assert.equal(session.ok, true);

    return session.token;

  }


  /*
   * REAL MEMORY ACCESS CONTROL
   *
   * Character ownership and consent
   * providers are synthetic.
   */

  function createMemoryAccess(
    entitlement = enabled,
    changes = {}
  ) {

    return createLagoMemoryAccess({

      sessionStore: sessions,

      now,

      getSubscription:
        entitlement.getSubscription,

      async getCharacterAccess({
        accountId,
        characterId
      }) {

        return {

          serverVerified: true,

          accountId,
          characterId,

          owned: true,

          activeCharacterId: "lago",

          memoryAccessAllowed: true

        };

      },

      async getConsent({
        accountId,
        characterId
      }) {

        return {

          serverVerified: true,

          accountId,
          characterId,

          granted: true,

          allowedCategories: [
            "owner",
            "conversation",
            "gameplay",
            "learning"
          ],

          learningAllowed: true

        };

      },

      ...changes

    });

  }


  return {

    sessions,

    playerA,
    playerB,

    ledger,

    enabled,
    disabled,

    createService,
    createMemoryAccess,

    pay,
    refreshSession,

    state(
      service = enabled,
      player = playerA
    ) {

      return service.getSubscription({
        accountId: player.accountId
      });

    },

    setTime(value) {

      currentTime = typeof value === "number"
        ? value
        : Date.parse(value);

    }

  };

}


/*
 * ASSERTIONS
 */

function assertRuntimeLocked(state) {

  for (const field of [

    "aiEnabled",
    "chatEnabled",
    "memoryEnabled",
    "learningEnabled",
    "marketAnalysisEnabled",
    "tradingEnabled",
    "tradingAuthorized"

  ]) {

    assert.equal(
      state[field],
      false,
      field
    );

  }

}


function assertDenied(result, reason) {

  assert.equal(result.ok, false);
  assert.equal(result.reason, reason);

  assert.equal(result.serverVerified, false);
  assert.equal(result.entitled, false);

  assertRuntimeLocked(result);

}


/*
 * TEST 01 — REQUIRED DEPENDENCIES
 */

test("requires valid entitlement configuration", () => {

  assert.throws(

    () => createLagoSubscriptionEntitlement(),

    /entitlement_session_store_required/

  );

  const sessionStore = {
    async restoreSession() {
      return null;
    }
  };

  assert.throws(

    () => createLagoSubscriptionEntitlement({
      sessionStore,
      now: null
    }),

    /invalid_entitlement_clock/

  );

  assert.throws(

    () => createLagoSubscriptionEntitlement({
      sessionStore,
      verifiedLedgerEnabled: "true"
    }),

    /invalid_entitlement_configuration/

  );

});


/*
 * TEST 02 — NO SUBSCRIPTION
 */

test("does not grant entitlement without a recorded subscription", async t => {

  const fx = await fixture(t);

  const state = fx.state();

  assert.equal(state.ok, true);
  assert.equal(state.status, "inactive");
  assert.equal(state.entitled, false);
  assert.equal(state.accessStatus, "locked");

  assert.equal(state.currentPeriodStart, null);
  assert.equal(state.currentPeriodEnd, null);
  assert.equal(state.daysRemaining, 0);

  assert.equal(
    state.reason,
    "active_subscription_required"
  );

  assertRuntimeLocked(state);

});


/*
 * TEST 03 — DISABLED BY DEFAULT
 */

test("keeps recorded subscriptions locked when entitlement is disabled", async t => {

  const fx = await fixture(t);

  await fx.pay();

  const state = fx.state(fx.disabled);

  assert.equal(state.ok, true);
  assert.equal(state.status, "active");

  assert.equal(state.serverVerified, false);
  assert.equal(state.entitled, false);
  assert.equal(state.accessStatus, "locked");

  assert.equal(
    state.reason,
    "subscription_entitlement_disabled"
  );

  assertRuntimeLocked(state);

});


/*
 * TEST 04 — ACTIVE SUBSCRIPTION
 */

test("grants account entitlement for an active recorded billing period", async t => {

  const fx = await fixture(t);

  await fx.pay();

  const state = await fx.enabled.getState({

    sessionToken: fx.playerA.token

  });

  assert.equal(state.ok, true);
  assert.equal(state.status, "active");

  assert.equal(state.accountId, fx.playerA.accountId);

  assert.equal(state.serverVerified, true);
  assert.equal(state.entitled, true);

  assert.equal(
    state.subscriptionEntitlementGranted,
    true
  );

  assert.equal(state.accessStatus, "entitled");

  assert.equal(state.currentPeriodStart, START);
  assert.equal(state.currentPeriodEnd, END);

  assert.equal(state.daysRemaining, 28);
  assert.equal(state.currentPeriodDaysRemaining, 28);

  assert.equal(state.reason, null);

});


/*
 * TEST 05 — EXACT EXPIRATION
 */

test("expires subscription at the exact end of its billing period", async t => {

  const fx = await fixture(t);

  await fx.pay();

  fx.setTime(Date.parse(END) - 1);

  const before = fx.state();

  assert.equal(before.entitled, true);
  assert.equal(before.daysRemaining, 1);

  fx.setTime(END);

  const expired = fx.state();

  assert.equal(expired.ok, true);
  assert.equal(expired.status, "expired");
  assert.equal(expired.entitled, false);

  assert.equal(expired.currentPeriodStart, null);
  assert.equal(expired.currentPeriodEnd, null);
  assert.equal(expired.daysRemaining, 0);

  assert.equal(expired.reason, "subscription_expired");

  assertRuntimeLocked(expired);

});


/*
 * TEST 06 — FUTURE PERIOD
 */

test("does not grant access before a recorded period starts", async t => {

  const fx = await fixture(t);

  await fx.pay();

  /*
   * Simulate a clock rollback to test
   * a future scheduled billing period.
   */

  fx.setTime(INITIAL_TIME - 1000);

  const state = fx.state();

  assert.equal(state.ok, true);
  assert.equal(state.status, "scheduled");
  assert.equal(state.entitled, false);

  assert.equal(
    state.reason,
    "subscription_not_started"
  );

});


/*
 * TEST 07 — PREPAID RENEWAL
 */

test("preserves unused time and the original monthly billing anchor", async t => {

  const fx = await fixture(t);

  await fx.pay();
  await fx.pay();

  const state = fx.state();

  assert.equal(state.entitled, true);

  assert.equal(state.currentPeriodStart, START);
  assert.equal(state.currentPeriodEnd, END);

  assert.equal(
    state.paidThrough,
    "2027-03-31T12:00:00.000Z"
  );

  assert.equal(state.daysRemaining, 59);
  assert.equal(state.currentPeriodDaysRemaining, 28);

  fx.setTime(END);

  const renewed = fx.state();

  assert.equal(renewed.entitled, true);

  assert.equal(
    renewed.currentPeriodStart,
    END
  );

  assert.equal(
    renewed.currentPeriodEnd,
    "2027-03-31T12:00:00.000Z"
  );

  assert.equal(renewed.daysRemaining, 31);

});


/*
 * TEST 08 — REACTIVATION
 */

test("starts a new paid period after subscription expiration", async t => {

  const fx = await fixture(t);

  await fx.pay();

  const restart = "2027-03-05T12:00:00.000Z";

  fx.setTime(restart);

  assert.equal(fx.state().entitled, false);

  await fx.pay();

  const state = fx.state();

  assert.equal(state.status, "active");
  assert.equal(state.entitled, true);

  assert.equal(
    state.currentPeriodStart,
    restart
  );

  assert.equal(
    state.currentPeriodEnd,
    "2027-04-05T12:00:00.000Z"
  );

});


/*
 * TEST 09 — ACCOUNT ISOLATION
 */

test("does not share paid subscription access between accounts", async t => {

  const fx = await fixture(t);

  await fx.pay(fx.playerA);

  const a = fx.state(
    fx.enabled,
    fx.playerA
  );

  const b = fx.state(
    fx.enabled,
    fx.playerB
  );

  assert.equal(a.entitled, true);
  assert.equal(b.entitled, false);

  assert.equal(b.status, "inactive");

  assert.notEqual(
    a.accountId,
    b.accountId
  );

});


/*
 * TEST 10 — CLIENT INJECTION
 */

test("ignores client account entitlement and expiration overrides", async t => {

  const fx = await fixture(t);

  await fx.pay(fx.playerA);

  const result = await fx.enabled.getState({

    sessionToken: fx.playerB.token,

    accountId: fx.playerA.accountId,

    serverVerified: true,

    entitled: true,

    aiEnabled: true,

    status: "active",

    currentPeriodEnd:
      "2099-01-01T00:00:00.000Z",

    verifiedLedgerEnabled: true

  });

  assert.equal(result.ok, true);

  assert.equal(
    result.accountId,
    fx.playerB.accountId
  );

  assert.equal(result.status, "inactive");
  assert.equal(result.entitled, false);

  assertRuntimeLocked(result);

});


/*
 * TEST 11 — INVALID SESSION
 */

test("rejects unauthenticated subscription state requests", async t => {

  const fx = await fixture(t);

  for (const sessionToken of [

    null,
    "",
    "   ",
    "invalid-session",
    "a".repeat(257)

  ]) {

    assertDenied(

      await fx.enabled.getState({
        sessionToken
      }),

      "authentication_required"

    );

  }

});


/*
 * TEST 12 — REVOKED SESSION
 */

test("denies authenticated subscription lookup after logout", async t => {

  const fx = await fixture(t);

  await fx.pay();

  await fx.sessions.revokeSession(
    fx.playerA.token
  );

  assertDenied(

    await fx.enabled.getState({

      sessionToken: fx.playerA.token

    }),

    "authentication_required"

  );

  /*
   * Logout does not remove paid history.
   */

  assert.equal(fx.state().entitled, true);

});


/*
 * TEST 13 — EXPIRED SESSION
 */

test("requires fresh authentication after session expiration", async t => {

  const fx = await fixture(t);

  await fx.pay();

  fx.setTime(
    INITIAL_TIME + 3600 * 1000
  );

  assertDenied(

    await fx.enabled.getState({

      sessionToken: fx.playerA.token

    }),

    "authentication_required"

  );

  const newToken = await fx.refreshSession();

  const restored = await fx.enabled.getState({

    sessionToken: newToken

  });

  assert.equal(restored.entitled, true);

});


/*
 * TEST 14 — PERSISTENCE
 */

test("restores subscription entitlement after service restart", async t => {

  const fx = await fixture(t);

  await fx.pay();

  const original = fx.state();

  fx.enabled.close();

  const restarted = fx.createService({

    verifiedLedgerEnabled: true

  });

  const restored = fx.state(restarted);

  assert.equal(restored.entitled, true);

  assert.deepEqual(
    restored,
    original
  );

});


/*
 * TEST 15 — RUNTIME SEPARATION
 */

test("subscription entitlement does not activate unrestricted AI or trading", async t => {

  const fx = await fixture(t);

  await fx.pay();

  const state = fx.state();

  assert.equal(state.entitled, true);

  assertRuntimeLocked(state);

  assert.equal(
    state.characterAuthorizationRequired,
    true
  );

  assert.equal(
    state.memoryConsentRequired,
    true
  );

  assert.equal(
    state.runtimeAuthorizationRequired,
    true
  );

  assert.equal(
    state.separateTradingAuthorizationRequired,
    true
  );

  assert.equal(
    state.externalModelTrainingAuthorized,
    false
  );

});


/*
 * TEST 16 — INVALID ACCOUNT
 */

test("rejects malformed internal subscription account identifiers", async t => {

  const fx = await fixture(t);

  for (const accountId of [

    null,
    "",
    "guest",
    "../private",
    "lago_invalid"

  ]) {

    assertDenied(

      fx.enabled.getSubscription({
        accountId
      }),

      "invalid_account_id"

    );

  }

});


/*
 * TEST 17 — INVALID CLOCK
 */

test("fails closed when subscription clock is unavailable", async t => {

  const fx = await fixture(t);

  await fx.pay();

  fx.setTime(NaN);

  assertDenied(

    fx.enabled.getSubscription({

      accountId: fx.playerA.accountId

    }),

    "subscription_state_unavailable"

  );

});


/*
 * TEST 18 — PROVIDER ERROR PRIVACY
 */

test("does not expose internal session provider errors", async t => {

  const fx = await fixture(t);

  const service = fx.createService({

    verifiedLedgerEnabled: true,

    sessionStore: {

      async restoreSession() {

        throw new Error(
          "SYNTHETIC_PRIVATE_SESSION_SECRET"
        );

      }

    }

  });

  const result = await service.getState({

    sessionToken: fx.playerA.token

  });

  assertDenied(

    result,

    "subscription_entitlement_unavailable"

  );

  assert.equal(

    JSON.stringify(result).includes(
      "SYNTHETIC_PRIVATE_SESSION_SECRET"
    ),

    false

  );

});


/*
 * TEST 19 — CLOSED SERVICE
 */

test("rejects all state requests after entitlement service closure", async t => {

  const fx = await fixture(t);

  fx.enabled.close();

  assertDenied(

    fx.enabled.getSubscription({

      accountId: fx.playerA.accountId

    }),

    "entitlement_service_closed"

  );

  assertDenied(

    await fx.enabled.getState({

      sessionToken: fx.playerA.token

    }),

    "entitlement_service_closed"

  );

});


/*
 * TEST 20 — MEMORY AUTHORIZATION
 */

test("supports scoped memory authorization for subscribed agents", async t => {

  const fx = await fixture(t);

  await fx.pay();

  const access = fx.createMemoryAccess();

  const result = await access.authorize({

    sessionToken: fx.playerA.token,

    characterId: "lago",

    action: "recall",

    category: "conversation"

  });

  assert.equal(result.ok, true);
  assert.equal(result.authorized, true);
  assert.equal(result.subscriptionVerified, true);
  assert.equal(result.consentVerified, true);

  assert.equal(

    result.identity.accountId,

    fx.playerA.accountId

  );

  assert.equal(result.tradingAuthorized, false);

});


/*
 * TEST 21 — DISABLED MEMORY ENTITLEMENT
 */

test("denies AI memory recall when subscription entitlement is disabled", async t => {

  const fx = await fixture(t);

  await fx.pay();

  const access = fx.createMemoryAccess(
    fx.disabled
  );

  const result = await access.authorize({

    sessionToken: fx.playerA.token,

    characterId: "lago",

    action: "recall",

    category: "conversation"

  });

  assert.equal(result.ok, false);
  assert.equal(result.authorized, false);

  assert.equal(

    result.reason,

    "active_subscription_required"

  );

});


/*
 * TEST 22 — OWNER MEMORY RIGHTS
 */

test("preserves owner memory management rights after subscription expiration", async t => {

  const fx = await fixture(t);

  await fx.pay();

  fx.setTime(END);

  const token = await fx.refreshSession();

  const access = fx.createMemoryAccess();

  const recall = await access.authorize({

    sessionToken: token,

    characterId: "lago",

    action: "recall",

    category: "conversation"

  });

  assert.equal(recall.authorized, false);

  assert.equal(
    recall.reason,
    "active_subscription_required"
  );

  for (const action of [

    "review",
    "export",
    "delete",
    "clear"

  ]) {

    const owner = await access.authorize({

      sessionToken: token,

      characterId: "lago",

      action

    });

    assert.equal(owner.ok, true);
    assert.equal(owner.authorized, true);

    assert.equal(owner.ownerManagement, true);

    assert.equal(
      owner.subscriptionRequired,
      false
    );

  }

});


/*
 * TEST 23 — CONSENT AND CHARACTER OWNERSHIP
 */

test("does not bypass memory consent or active character restrictions", async t => {

  const fx = await fixture(t);

  await fx.pay();

  const noConsent = fx.createMemoryAccess(

    fx.enabled,

    { getConsent: null }

  );

  const denied = await noConsent.authorize({

    sessionToken: fx.playerA.token,

    characterId: "lago",

    action: "recall",

    category: "conversation"

  });

  assert.equal(denied.authorized, false);

  assert.equal(

    denied.reason,

    "consent_service_unavailable"

  );

  const access = fx.createMemoryAccess();

  const inactive = await access.authorize({

    sessionToken: fx.playerA.token,

    characterId: "comic_pink_snail",

    action: "recall",

    category: "conversation"

  });

  assert.equal(inactive.authorized, false);

  assert.equal(

    inactive.reason,

    "active_character_required"

  );

});


/*
 * TEST 24 — IMMUTABLE SECURITY POLICY
 */

test("exposes immutable account subscription policy without payment mutation access", async t => {

  const fx = await fixture(t);

  const policy = fx.enabled.getPolicy();
  const disabledPolicy = fx.disabled.getPolicy();

  assert.equal(

    fx.enabled.version,

    SUBSCRIPTION_ENTITLEMENT_VERSION

  );

  assert.equal(policy.subscriptionScope, "account");
  assert.equal(policy.maxActiveAgents, 1);
  assert.equal(policy.billingInterval, "month");

  assert.equal(policy.disabledByDefault, true);

  assert.equal(
    disabledPolicy.verifiedLedgerEnabled,
    false
  );

  assert.equal(
    policy.verifiedLedgerEnabled,
    true
  );

  assert.equal(policy.autoRenewal, false);
  assert.equal(policy.freeTrial, false);
  assert.equal(policy.unlockWithXP, false);
  assert.equal(policy.unlockWithSP, false);

  assert.equal(policy.preserveCharacterOnExpiry, true);
  assert.equal(policy.preserveMemoryOnExpiry, true);
  assert.equal(policy.preserveProgressOnExpiry, true);

  assert.equal(

    policy.ownerMemoryManagementRequiresSubscription,

    false

  );

  assert.equal(policy.tradingAuthorizationGranted, false);

  assert.equal(Object.isFrozen(policy), true);

  assert.equal(

    Object.hasOwn(fx.enabled, "applyPayment"),

    false

  );

  assert.equal(

    Object.hasOwn(fx.enabled, "ledger"),

    false

  );

});

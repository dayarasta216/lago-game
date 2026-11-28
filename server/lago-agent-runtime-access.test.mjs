import test from "node:test";
import assert from "node:assert/strict";

import { mkdtemp, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  RUNTIME_ACCESS_VERSION,
  createLagoRuntimeAccess
} from "./lago-agent-runtime-access.mjs";

import {
  createLagoAccountSessionStore
} from "./lago-account-session-store.mjs";

import {
  createLagoSubscriptionLedger
} from "./lago-agent-subscription-ledger.mjs";

import {
  createLagoSubscriptionEntitlement
} from "./lago-agent-subscription-entitlement.mjs";

import {
  SUBSCRIPTION_POLICY
} from "./lago-agent-subscription-contract.mjs";

import {
  createMemoryIdentity
} from "./lago-agent-memory-contract.mjs";

import {
  createLagoCharacterStore
} from "./lago-agent-character-store.mjs";

/*
 * LAGO GAME
 * R2.8A1 — RUNTIME AUTHORIZATION SECURITY TESTS
 *
 * Real account sessions.
 * Real subscription ledger.
 * Real entitlement engine.
 * Synthetic character ownership.
 *
 * No real payments.
 * No AI execution.
 * No trading.
 */

const POLICY = SUBSCRIPTION_POLICY;

const START = Date.parse(
  "2027-01-31T12:00:00.000Z"
);

const END = Date.parse(
  "2027-02-28T12:00:00.000Z"
);

const PAYER = "1".repeat(31) + "2";
const TREASURY = "1".repeat(31) + "3";

const CHARACTER = "lago";
const OTHER_CHARACTER = "comic_pink_snail";


/*
 * REAL SERVER INTEGRATION FIXTURE
 */

async function fixture(t) {
  const root = await mkdtemp(
    join(tmpdir(), "lago-runtime-access-")
  );

  const projectRoot = join(root, "project");
  const directory = join(root, "payments");

  const services = [];

  let clock = START;
  let sequence = 0;

  const now = () => clock;

  t.after(async () => {
    for (const service of services.reverse()) {
      service.close();
    }

    await rm(root, {
      recursive: true,
      force: true
    });
  });

  await mkdir(projectRoot);

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

  function createEntitlement(enabled) {
    const service =
      createLagoSubscriptionEntitlement({
        directory,
        projectRoot,
        sessionStore: sessions,
        verifiedLedgerEnabled: enabled,
        now
      });

    services.push(service);

    return service;
  }

  const entitlement = createEntitlement(true);
  const disabledEntitlement = createEntitlement(false);


/*
 * REAL SERVER CHARACTER OWNERSHIP
 *
 * Persistent SQLite character registry.
 * Independent account collections.
 * Canonical selection revisions.
 */

const characterStore = createLagoCharacterStore({
  directory: join(root, "private-characters"),
  projectRoot,
  trustedGrantsEnabled: true,
  now
});

services.push(characterStore);

for (const player of [playerA, playerB]) {
  const initialized =
    characterStore.initializeAccount({
      accountId: player.accountId
    });

  assert.equal(initialized.ok, true);
  assert.equal(initialized.selectionRevision, 1);
}

const granted =
  characterStore.recordTrustedGrant({
    accountId: playerA.accountId,
    characterId: OTHER_CHARACTER
  });

assert.equal(granted.ok, true);
assert.equal(granted.granted, true);

async function getCharacterAccess({
  accountId,
  characterId
}) {
  return characterStore.getCharacterAccess({
    accountId,
    characterId
  });
}

  function createRuntime(changes = {}) {
    return createLagoRuntimeAccess({
      sessionStore: sessions,
      getCharacterAccess,
      getSubscription: entitlement.getSubscription,
      runtimeEnabled: true,
      now,
      ...changes
    });
  }

  const runtime = createRuntime();


  /*
   * SYNTHETIC PAYMENT
   */

  async function pay(player = playerA) {
    sequence++;

    const alphabet =
      "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

    const result = await ledger.applyPayment({
      accountId: player.accountId,

      quoteId:
        sequence.toString(16).padStart(32, "0"),

      transactionSignature:
        "1".repeat(63) + alphabet[sequence - 1]
    });

    assert.equal(result.ok, true);

    return result;
  }

  function input(player = playerA, changes = {}) {
    return {
      sessionToken: player.token,
      characterId: CHARACTER,
      action: "chat",
      ...changes
    };
  }

  return {
    sessions,
    playerA,
    playerB,
    entitlement,
    disabledEntitlement,
    runtime,
    createRuntime,
    getCharacterAccess,
    pay,
    input,

    authorize(changes = {}) {
      return runtime.authorize(
        input(playerA, changes)
      );
    },

   characterStore,

select(player, characterId) {
  const result =
    characterStore.selectCharacter({
      accountId: player.accountId,
      characterId
    });

  assert.equal(result.ok, true);

  return result;
},

    setTime(value) {
      clock = value;
    },

    advance(milliseconds) {
      clock += milliseconds;
    },

    async renewSession(player = playerA) {
      const session = await sessions.createSession(
        player.accountId,
        { ttlSeconds: 3600 }
      );

      assert.equal(session.ok, true);

      player.token = session.token;

      return session.token;
    }
  };
}


/*
 * COMMON ASSERTIONS
 */

function assertDenied(result, reason) {
  assert.equal(result.ok, false);
  assert.equal(result.authorized, false);
  assert.equal(result.runtimeAuthorized, false);
  assert.equal(result.identity, null);
  assert.equal(result.action, null);
  assert.equal(result.memoryAuthorized, false);
  assert.equal(result.tradingAuthorized, false);

  assert.equal(
    result.externalModelTrainingAuthorized,
    false
  );

  assert.equal(result.reason, reason);
  assert.equal(Object.isFrozen(result), true);
}

function assertAllowed(
  result,
  player,
  characterId = CHARACTER,
  action = "chat"
) {
  assert.equal(result.ok, true);
  assert.equal(result.authorized, true);
  assert.equal(result.runtimeAuthorized, true);

  assert.equal(result.version, RUNTIME_ACCESS_VERSION);
  assert.equal(result.action, action);

  assert.equal(result.sessionVerified, true);
  assert.equal(result.characterVerified, true);
  assert.equal(result.subscriptionVerified, true);

  assert.deepEqual(
    result.identity,
    createMemoryIdentity(
      player.accountId,
      characterId
    )
  );

  assert.equal(result.memoryAuthorized, false);
  assert.equal(result.learningAuthorized, false);
  assert.equal(result.tradingAuthorized, false);

  assert.equal(
    result.externalModelTrainingAuthorized,
    false
  );

  assert.equal(result.reason, null);

  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(result.identity), true);
}


/*
 * TEST 01 — REQUIRED CONFIGURATION
 */

test("requires valid runtime configuration", () => {
  assert.throws(
    () => createLagoRuntimeAccess(),
    /runtime_session_store_required/
  );

  const sessionStore = {
    async restoreSession() {
      return null;
    }
  };

  for (const changes of [
    { runtimeEnabled: "true" },
    { now: null }
  ]) {
    assert.throws(
      () => createLagoRuntimeAccess({
        sessionStore,
        ...changes
      }),
      /invalid_runtime_configuration/
    );
  }

  assert.throws(
    () => createLagoRuntimeAccess({
      sessionStore,
      getCharacterAccess: true
    }),
    /invalid_character_access_provider/
  );

  assert.throws(
    () => createLagoRuntimeAccess({
      sessionStore,
      getSubscription: {}
    }),
    /invalid_subscription_provider/
  );
});


/*
 * TEST 02 — DISABLED BY DEFAULT
 */

test("keeps runtime disabled by default", async t => {
  const fx = await fixture(t);

  await fx.pay();

  const runtime = createLagoRuntimeAccess({
    sessionStore: fx.sessions,
    getCharacterAccess: fx.getCharacterAccess,
    getSubscription: fx.entitlement.getSubscription
  });

  assertDenied(
    await runtime.authorize(fx.input()),
    "runtime_disabled"
  );

  assert.equal(
    runtime.getPolicy().runtimeEnabled,
    false
  );
});


/*
 * TEST 03 — MALFORMED REQUESTS
 */

test("rejects malformed runtime requests", async t => {
  const fx = await fixture(t);

  for (const input of [
    null,
    [],
    true,
    123,
    "chat"
  ]) {
    assertDenied(
      await fx.runtime.authorize(input),
      "invalid_runtime_request"
    );
  }
});


/*
 * TEST 04 — UNSUPPORTED OPERATIONS
 */

test("rejects trading memory and external training operations", async t => {
  const fx = await fixture(t);

  await fx.pay();

  for (const action of [
    "trade",
    "buy",
    "sell",
    "withdraw",
    "collect",
    "recall",
    "learn",
    "train",
    "memory",
    "market-analysis",
    "CHAT",
    null
  ]) {
    assertDenied(
      await fx.authorize({ action }),
      "runtime_action_not_allowed"
    );
  }
});


/*
 * TEST 05 — INVALID CHARACTERS
 */

test("rejects unknown character identities", async t => {
  const fx = await fixture(t);

  for (const characterId of [
    "",
    null,
    "unknown",
    "LAGO",
    "../lago",
    {}
  ]) {
    assertDenied(
      await fx.authorize({ characterId }),
      "invalid_character"
    );
  }
});


/*
 * TEST 06 — MISSING SESSION
 */

test("requires a valid session token", async t => {
  const fx = await fixture(t);

  for (const sessionToken of [
    "",
    " ",
    null,
    123,
    "invalid-session",
    "a".repeat(257)
  ]) {
    assertDenied(
      await fx.authorize({ sessionToken }),
      "authentication_required"
    );
  }
});


/*
 * TEST 07 — NO SUBSCRIPTION
 */

test("does not authorize AI without an active subscription", async t => {
  const fx = await fixture(t);

  assertDenied(
    await fx.authorize(),
    "active_subscription_required"
  );
});


/*
 * TEST 08 — UNVERIFIED BILLING
 */

test("rejects recorded subscriptions when entitlement is disabled", async t => {
  const fx = await fixture(t);

  await fx.pay();

  const runtime = fx.createRuntime({
    getSubscription:
      fx.disabledEntitlement.getSubscription
  });

  assertDenied(
    await runtime.authorize(fx.input()),
    "active_subscription_required"
  );
});


/*
 * TEST 09 — AUTHORIZED CHAT
 */

test("authorizes chat for a verified subscribed active character", async t => {
  const fx = await fixture(t);

  await fx.pay();

  const result = await fx.authorize();

  assertAllowed(result, fx.playerA);

  assert.equal(
    Date.parse(result.issuedAt),
    START
  );

 const issuedAt = Date.parse(result.issuedAt);
const validUntil = Date.parse(result.validUntil);

assert.ok(Number.isFinite(validUntil));

assert.ok(
  validUntil > issuedAt,
  "Authorization must have a positive lifetime"
);

assert.ok(
  validUntil <= START + 5000,
  "Authorization must not exceed the shared deadline"
);

assert.ok(
  validUntil <= Date.parse(result.currentPeriodEnd),
  "Authorization must not exceed the subscription period"
);
  assert.equal(
    Date.parse(result.currentPeriodEnd),
    END
  );
});


/*
 * TEST 10 — MARKET ANALYSIS
 */

test("authorizes market analysis without granting trading access", async t => {
  const fx = await fixture(t);

  await fx.pay();

  const result = await fx.authorize({
    action: "market_analysis"
  });

  assertAllowed(
    result,
    fx.playerA,
    CHARACTER,
    "market_analysis"
  );
});


/*
 * TEST 11 — ACCOUNT ISOLATION
 */

test("does not transfer subscription access between accounts", async t => {
  const fx = await fixture(t);

  await fx.pay(fx.playerA);

  assertAllowed(
    await fx.authorize(),
    fx.playerA
  );

  assertDenied(
    await fx.runtime.authorize(
      fx.input(fx.playerB)
    ),
    "active_subscription_required"
  );
});


/*
 * TEST 12 — CHARACTER OWNERSHIP
 */

test("rejects characters not owned by the account", async t => {
  const fx = await fixture(t);

  await fx.pay(fx.playerB);

  const selection =
    fx.characterStore.selectCharacter({
      accountId: fx.playerB.accountId,
      characterId: OTHER_CHARACTER
    });

  assert.equal(selection.ok, false);

  assert.equal(
    selection.reason,
    "character_not_owned"
  );

  assertDenied(
    await fx.runtime.authorize(
      fx.input(fx.playerB, {
        characterId: OTHER_CHARACTER
      })
    ),
    "character_access_denied"
  );

  const state = fx.characterStore.getState({
    accountId: fx.playerB.accountId
  });

  assert.equal(
    state.activeCharacterId,
    CHARACTER
  );

  assert.equal(state.selectionRevision, 1);

  assert.deepEqual(
    state.ownedCharacterIds,
    [CHARACTER]
  );
});


/*
 * TEST 13 — INACTIVE CHARACTER
 */

test("rejects owned characters that are not currently active", async t => {
  const fx = await fixture(t);

  await fx.pay();

  assertDenied(
    await fx.authorize({
      characterId: OTHER_CHARACTER
    }),
    "character_access_denied"
  );
});


/*
 * TEST 14 — CHARACTER SWITCH
 */

test("authorizes only the newly selected owned character", async t => {
  const fx = await fixture(t);

  await fx.pay();

  fx.select(
    fx.playerA,
    OTHER_CHARACTER
  );

  assertDenied(
    await fx.authorize(),
    "character_access_denied"
  );

  assertAllowed(
    await fx.authorize({
      characterId: OTHER_CHARACTER
    }),
    fx.playerA,
    OTHER_CHARACTER
  );
});


/*
 * TEST 15 — CLIENT PERMISSION INJECTION
 */

test("ignores client-supplied account and authorization fields", async t => {
  const fx = await fixture(t);

  const injection = {
    accountId: fx.playerB.accountId,
    entitled: true,
    serverVerified: true,
    runtimeAuthorized: true,
    tradingAuthorized: true,
    memoryAuthorized: true,
    subscription: {
      status: "active"
    }
  };

  assertDenied(
    await fx.authorize(injection),
    "active_subscription_required"
  );

  await fx.pay();

  assertAllowed(
    await fx.authorize(injection),
    fx.playerA
  );
});


/*
 * TEST 16 — MISSING PROVIDERS
 */

test("fails closed without trusted authorization providers", async t => {
  const fx = await fixture(t);

  assertDenied(
    await fx.createRuntime({
      getCharacterAccess: null
    }).authorize(fx.input()),

    "character_access_unavailable"
  );

  assertDenied(
    await fx.createRuntime({
      getSubscription: null
    }).authorize(fx.input()),

    "subscription_service_unavailable"
  );
});


/*
 * TEST 17 — INVALID OWNERSHIP RESPONSES
 */

test("rejects invalid character ownership evidence", async t => {
  const fx = await fixture(t);

  await fx.pay();

  const valid = await fx.getCharacterAccess({
    accountId: fx.playerA.accountId,
    characterId: CHARACTER
  });

  for (const changes of [
    { serverVerified: false },
    { accountId: fx.playerB.accountId },
    { characterId: OTHER_CHARACTER },
    { activeCharacterId: OTHER_CHARACTER },
    { owned: false },
    { owned: "true" }
  ]) {
    const runtime = fx.createRuntime({
      async getCharacterAccess() {
        return {
          ...valid,
          ...changes
        };
      }
    });

    assertDenied(
      await runtime.authorize(fx.input()),
      "character_access_denied"
    );
  }
});


/*
 * TEST 18 — INVALID SUBSCRIPTION RESPONSES
 */

test("rejects inconsistent trusted subscription evidence", async t => {
  const fx = await fixture(t);

  await fx.pay();

  const valid = fx.entitlement.getSubscription({
    accountId: fx.playerA.accountId
  });

  const mutations = [
    { ok: false },
    { accountId: fx.playerB.accountId },
    { serverVerified: false },
    { entitled: false },
    { subscriptionEntitlementGranted: false },
    { status: "inactive" },
    { subscriptionStatus: "expired" },
    { product: "foreign-product" },
    { billingModel: "one-time" },
    { billingInterval: "year" },
    { billingIntervalCount: 12 },
    { subscriptionScope: "character" },
    { maxActiveAgents: 2 },
    { currency: "USD" },
    { chain: "ethereum" },
    { network: "devnet" },
    { tokenMint: "foreign-mint" },
    { autoRenewal: true },
    { currentPeriodStart: "invalid-date" },
    { currentPeriodEnd: "invalid-date" },
    {
      currentPeriodStart:
        new Date(START + 1000).toISOString()
    },
    {
      currentPeriodEnd:
        new Date(START).toISOString()
    }
  ];

  for (const changes of mutations) {
    const runtime = fx.createRuntime({
      async getSubscription() {
        return {
          ...valid,
          ...changes
        };
      }
    });

    assertDenied(
      await runtime.authorize(fx.input()),
      "active_subscription_required"
    );
  }
});


/*
 * TEST 19 — REVOKED SESSION
 */

test("rejects revoked server sessions", async t => {
  const fx = await fixture(t);

  await fx.pay();

  await fx.sessions.revokeSession(
    fx.playerA.token
  );

  assertDenied(
    await fx.authorize(),
    "authentication_required"
  );
});


/*
 * TEST 20 — EXPIRED SESSION
 */

test("rejects expired server sessions", async t => {
  const fx = await fixture(t);

  await fx.pay();

  fx.advance(3600000);

  assertDenied(
    await fx.authorize(),
    "authentication_required"
  );
});


/*
 * TEST 21 — REVOCATION DURING VERIFICATION
 */

test("rejects sessions revoked during subscription verification", async t => {
  const fx = await fixture(t);

  await fx.pay();

  const runtime = fx.createRuntime({
    async getSubscription(input) {
      const state =
        fx.entitlement.getSubscription(input);

      await fx.sessions.revokeSession(
        fx.playerA.token
      );

      return state;
    }
  });

  assertDenied(
    await runtime.authorize(fx.input()),
    "runtime_session_changed"
  );
});


/*
 * TEST 22 — CHARACTER CHANGE DURING VERIFICATION
 */

test("rejects character switches during subscription verification", async t => {
  const fx = await fixture(t);

  await fx.pay();

  const runtime = fx.createRuntime({
    async getSubscription(input) {
      fx.select(
        fx.playerA,
        OTHER_CHARACTER
      );

      return fx.entitlement.getSubscription(
        input
      );
    }
  });

  assertDenied(
    await runtime.authorize(fx.input()),
    "character_context_changed"
  );
});


/*
 * TEST 23 — EXACT SUBSCRIPTION EXPIRATION
 */

test("rejects subscriptions at their exact expiration boundary", async t => {
  const fx = await fixture(t);

  await fx.pay();

  fx.setTime(END);

  await fx.renewSession();

  assertDenied(
    await fx.authorize(),
    "active_subscription_required"
  );
});


/*
 * TEST 24 — EXPIRATION DURING VERIFICATION
 */

test("rejects subscriptions expiring during runtime verification", async t => {
  const fx = await fixture(t);

  await fx.pay();

  fx.setTime(END - 1);

  await fx.renewSession();

  let checks = 0;

  const runtime = fx.createRuntime({
    async getCharacterAccess(input) {
      checks++;

      if (checks === 2) {
        fx.advance(1);
      }

      return fx.getCharacterAccess(input);
    }
  });

  assertDenied(
    await runtime.authorize(fx.input()),
    "subscription_expired"
  );
});


/*
 * TEST 25 — DECISION EXPIRATION
 */

test("limits authorization lifetime to the paid period end", async t => {
  const fx = await fixture(t);

  await fx.pay();

  fx.setTime(END - 1000);

  await fx.renewSession();

  const result = await fx.authorize();

  assertAllowed(result, fx.playerA);

  assert.equal(
    Date.parse(result.validUntil),
    END
  );
});


/*
 * TEST 26 — VERIFICATION AGE LIMIT
 */

test("rejects verification results reaching the five second age limit", async t => {
  const fx = await fixture(t);

  await fx.pay();

  const runtime = fx.createRuntime({
    async getSubscription(input) {
      fx.advance(5000);

      return fx.entitlement.getSubscription(
        input
      );
    }
  });

  assertDenied(
    await runtime.authorize(fx.input()),
    "runtime_verification_timeout"
  );
});


/*
 * TEST 27 — INVALID CLOCK
 */

test("rejects invalid and backwards-moving verification clocks", async t => {
  const fx = await fixture(t);

  await fx.pay();

  for (const value of [
    NaN,
    Infinity,
    1.5
  ]) {
    assertDenied(
      await fx.createRuntime({
        now: () => value
      }).authorize(fx.input()),

      "invalid_runtime_clock"
    );
  }

  const runtime = fx.createRuntime({
    async getSubscription(input) {
      fx.advance(-1);

      return fx.entitlement.getSubscription(
        input
      );
    }
  });

  assertDenied(
    await runtime.authorize(fx.input()),
    "invalid_runtime_clock"
  );
});


/*
 * TEST 28 — PROVIDER EXCEPTION PRIVACY
 */

test("sanitizes provider errors without exposing private information", async t => {
  const fx = await fixture(t);

  await fx.pay();

  const runtime = fx.createRuntime({
    async getCharacterAccess() {
      throw new Error(
        "SYNTHETIC_PRIVATE_SERVER_SECRET"
      );
    }
  });

  const result = await runtime.authorize(
    fx.input()
  );

  assertDenied(
    result,
    "runtime_authorization_unavailable"
  );

  assert.equal(
    JSON.stringify(result).includes(
      "SYNTHETIC_PRIVATE_SERVER_SECRET"
    ),
    false
  );

  assert.equal(
    JSON.stringify(result).includes(
      fx.playerA.token
    ),
    false
  );
});


/*
 * TEST 29 — IMMUTABLE RUNTIME POLICY
 */

test("enforces immutable account scoped runtime policy", async t => {
  const fx = await fixture(t);

  const policy = fx.runtime.getPolicy();

  assert.equal(policy.subscriptionRequired, true);
  assert.equal(policy.billingInterval, "month");
  assert.equal(policy.maxActiveAgents, 1);

  assert.equal(
    policy.characterOwnershipRequired,
    true
  );

  assert.equal(
    policy.activeCharacterRequired,
    true
  );

  assert.equal(
    policy.runtimeEnabledByDefault,
    false
  );

  assert.equal(
    policy.memoryAuthorizationSeparate,
    true
  );

  assert.equal(
    policy.tradingAuthorizationSeparate,
    true
  );

  assert.equal(
    policy.externalModelTrainingEnabled,
    false
  );

  assert.equal(
    policy.clientPermissionsTrusted,
    false
  );

  assert.equal(policy.maxDecisionAgeMs, 5000);
  assert.equal(policy.failClosed, true);

  assert.deepEqual(
    fx.runtime.getActions(),
    ["chat", "market_analysis"]
  );

  assert.equal(Object.isFrozen(policy), true);
  assert.equal(Object.isFrozen(fx.runtime), true);

  assert.equal(
    Object.isFrozen(fx.runtime.getActions()),
    true
  );
});

/*
 * LAGO GAME
 * R2.8A3 — AUTHORIZATION HARDENING REGRESSION
 *
 * Shared verification deadline.
 * Monotonic timing.
 * Provider cancellation.
 * Late response isolation.
 */

function deferredRuntimeResult() {
  let resolve;
  let reject;

  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
}


/*
 * TEST 30 — INITIAL SESSION DEADLINE
 */

test("includes initial session restoration in the verification deadline", async t => {
  const fx = await fixture(t);

  await fx.pay();

  const runtime = fx.createRuntime({
    sessionStore: {
      async restoreSession(token) {
        fx.advance(5000);
        return fx.sessions.restoreSession(token);
      }
    }
  });

  assertDenied(
    await runtime.authorize(fx.input()),
    "runtime_verification_timeout"
  );
});


/*
 * TEST 31 — SHARED PROVIDER BUDGET
 */

test("uses one cumulative time budget across authorization providers", async t => {
  const fx = await fixture(t);

  await fx.pay();

  const runtime = fx.createRuntime({
    sessionStore: {
      async restoreSession(token) {
        fx.advance(1000);
        return fx.sessions.restoreSession(token);
      }
    },

    async getCharacterAccess(input) {
      fx.advance(1000);
      return fx.getCharacterAccess(input);
    },

    async getSubscription(input) {
      fx.advance(1000);
      return fx.entitlement.getSubscription(input);
    }
  });

  assertDenied(
    await runtime.authorize(fx.input()),
    "runtime_verification_timeout"
  );
});


/*
 * TEST 32 — REMAINING DECISION LIFETIME
 */

test("subtracts verification latency from the authorization lifetime", async t => {
  const fx = await fixture(t);

  await fx.pay();

  const runtime = fx.createRuntime({
    async getSubscription(input) {
      fx.advance(2000);

      return fx.entitlement.getSubscription(input);
    }
  });

  const result = await runtime.authorize(
    fx.input()
  );

  assertAllowed(result, fx.playerA);

  const issuedAt = Date.parse(result.issuedAt);
  const validUntil = Date.parse(result.validUntil);

  assert.equal(issuedAt, START + 2000);

  assert.ok(validUntil > issuedAt);

  assert.ok(validUntil <= START + 5000);

  assert.ok(validUntil - issuedAt <= 3000);
});


/*
 * TEST 33 — SHARED ABORT SIGNAL
 */

test("passes the same cancellation signal to every verification provider", async t => {
  const fx = await fixture(t);

  await fx.pay();

  const signals = [];

  const runtime = fx.createRuntime({
    sessionStore: {
      async restoreSession(token, options) {
        signals.push(options.signal);

        return fx.sessions.restoreSession(token);
      }
    },

    async getCharacterAccess(input, options) {
      signals.push(options.signal);

      return fx.getCharacterAccess(input);
    },

    async getSubscription(input, options) {
      signals.push(options.signal);

      return fx.entitlement.getSubscription(input);
    }
  });

  const result = await runtime.authorize(
    fx.input()
  );

  assertAllowed(result, fx.playerA);

  assert.equal(signals.length, 5);

  for (const signal of signals) {
    assert.ok(signal instanceof AbortSignal);
    assert.equal(signal, signals[0]);
    assert.equal(signal.aborted, false);
  }
});


/*
 * TEST 34 — NO PROVIDER EXECUTION AFTER TIMEOUT
 */

test("does not invoke subsequent providers after the shared deadline", async t => {
  const fx = await fixture(t);

  await fx.pay();

  let characterCalls = 0;
  let subscriptionCalls = 0;

  const runtime = fx.createRuntime({
    sessionStore: {
      async restoreSession(token) {
        fx.advance(5000);

        return fx.sessions.restoreSession(token);
      }
    },

    async getCharacterAccess(input) {
      characterCalls++;

      return fx.getCharacterAccess(input);
    },

    async getSubscription(input) {
      subscriptionCalls++;

      return fx.entitlement.getSubscription(input);
    }
  });

  assertDenied(
    await runtime.authorize(fx.input()),
    "runtime_verification_timeout"
  );

  assert.equal(characterCalls, 0);
  assert.equal(subscriptionCalls, 0);
});


/*
 * TEST 35 — REAL TIMER AND STALLED PROVIDERS
 */

test("cancels stalled providers even when they ignore AbortSignal", {
  timeout: 15000
}, async t => {
  const fx = await fixture(t);

  await fx.pay();

  const pendingSession = deferredRuntimeResult();
  const pendingCharacter = deferredRuntimeResult();
  const pendingSubscription = deferredRuntimeResult();

  const signals = [];

  const sessionRuntime = fx.createRuntime({
    sessionStore: {
      restoreSession(token, options) {
        signals.push(options.signal);

        return pendingSession.promise;
      }
    }
  });

  const characterRuntime = fx.createRuntime({
    getCharacterAccess(input, options) {
      signals.push(options.signal);

      return pendingCharacter.promise;
    }
  });

  const subscriptionRuntime = fx.createRuntime({
    getSubscription(input, options) {
      signals.push(options.signal);

      return pendingSubscription.promise;
    }
  });

  /*
   * Run three independent timeout scenarios
   * concurrently.
   */

  const results = await Promise.all([
    sessionRuntime.authorize(fx.input()),
    characterRuntime.authorize(fx.input()),
    subscriptionRuntime.authorize(fx.input())
  ]);

  for (const result of results) {
    assertDenied(
      result,
      "runtime_verification_timeout"
    );
  }

  assert.equal(signals.length, 3);

  for (const signal of signals) {
    assert.equal(signal.aborted, true);
  }

  assert.equal(new Set(signals).size, 3);

  /*
   * Late provider responses must not
   * modify previously denied decisions.
   */

  pendingSession.resolve(
    await fx.sessions.restoreSession(
      fx.playerA.token
    )
  );

  pendingCharacter.resolve(
    await fx.getCharacterAccess({
      accountId: fx.playerA.accountId,
      characterId: CHARACTER
    })
  );

  pendingSubscription.resolve(
    fx.entitlement.getSubscription({
      accountId: fx.playerA.accountId
    })
  );

  await new Promise(resolve =>
    setImmediate(resolve)
  );

  for (const result of results) {
    assertDenied(
      result,
      "runtime_verification_timeout"
    );
  }

  /*
   * A new independent request may succeed.
   */

  assertAllowed(
    await fx.authorize(),
    fx.playerA
  );
});


/*
 * TEST 36 — COOPERATIVE PROVIDER CANCELLATION
 */

test("notifies cooperative providers when verification expires", {
  timeout: 15000
}, async t => {
  const fx = await fixture(t);

  await fx.pay();

  let receivedAbort = false;

  const runtime = fx.createRuntime({
    getSubscription(input, options) {
      return new Promise((resolve, reject) => {
        options.signal.addEventListener(
          "abort",

          () => {
            receivedAbort = true;

            reject(
              new Error("provider_cancelled")
            );
          },

          { once: true }
        );
      });
    }
  });

  const result = await runtime.authorize(
    fx.input()
  );

  assertDenied(
    result,
    "runtime_verification_timeout"
  );

  assert.equal(receivedAbort, true);
});


/*
 * TEST 37 — CLOCK ROLLBACK DURING FIRST CALL
 */

test("rejects clock rollback during initial authentication", async t => {
  const fx = await fixture(t);

  await fx.pay();

  const runtime = fx.createRuntime({
    sessionStore: {
      async restoreSession(token) {
        fx.advance(-1);

        return fx.sessions.restoreSession(token);
      }
    }
  });

  assertDenied(
    await runtime.authorize(fx.input()),
    "invalid_runtime_clock"
  );
});


/*
 * TEST 38 — SESSION EXPIRATION BOUNDARY
 */

test("limits runtime authorization to the remaining session lifetime", async t => {
  const fx = await fixture(t);

  await fx.pay();

  fx.setTime(START + 3600000 - 1000);

  const result = await fx.authorize();

  assertAllowed(result, fx.playerA);

  assert.equal(
    Date.parse(result.validUntil),
    START + 3600000
  );
});


/*
 * TEST 39 — SESSION EXPIRATION DURING CHECKS
 */

test("rejects sessions expiring during asynchronous verification", async t => {
  const fx = await fixture(t);

  await fx.pay();

  fx.setTime(START + 3600000 - 1000);

  const runtime = fx.createRuntime({
    async getSubscription(input) {
      fx.advance(1000);

      return fx.entitlement.getSubscription(input);
    }
  });

  assertDenied(
    await runtime.authorize(fx.input()),
    "runtime_session_changed"
  );
});


/*
 * TEST 40 — CONCURRENT ACCOUNT ISOLATION
 */

test("isolates concurrent runtime decisions for different accounts", async t => {
  const fx = await fixture(t);

  await fx.pay(fx.playerA);
  await fx.pay(fx.playerB);

  const results = await Promise.all([
    fx.runtime.authorize(
      fx.input(fx.playerA)
    ),

    fx.runtime.authorize(
      fx.input(fx.playerB, {
        action: "market_analysis"
      })
    )
  ]);

  assertAllowed(
    results[0],
    fx.playerA
  );

  assertAllowed(
    results[1],
    fx.playerB,
    CHARACTER,
    "market_analysis"
  );

  assert.notEqual(
    results[0].identity.agentId,
    results[1].identity.agentId
  );

  assert.notEqual(
    results[0].identity.accountId,
    results[1].identity.accountId
  );
});


/*
 * TEST 41 — HARDENED SECURITY POLICY
 */

test("publishes the immutable shared deadline security policy", async t => {
  const fx = await fixture(t);

  const policy = fx.runtime.getPolicy();

  assert.equal(
    policy.verificationTimeoutMs,
    5000
  );

  assert.equal(
    policy.sharedVerificationDeadline,
    true
  );

  assert.equal(
    policy.monotonicClockRequired,
    true
  );

  assert.equal(
    policy.providerCancellationSupported,
    true
  );

  assert.equal(
    policy.verificationLatencyConsumesDecisionLifetime,
    true
  );

  assert.equal(
    policy.memoryAuthorizationSeparate,
    true
  );

  assert.equal(
    policy.tradingAuthorizationSeparate,
    true
  );

  assert.equal(policy.failClosed, true);

  assert.equal(Object.isFrozen(policy), true);
});

/*
 * LAGO GAME
 * R2.8B4-PREP — REAL CHARACTER REVISION TESTS
 */


/*
 * TEST 42 — REAL OWNERSHIP PROVIDER
 */

test("uses persistent character ownership for runtime authorization", async t => {
  const fx = await fixture(t);

  await fx.pay();

  const access = await fx.getCharacterAccess({
    accountId: fx.playerA.accountId,
    characterId: CHARACTER
  });

  assert.equal(access.ok, true);
  assert.equal(access.serverVerified, true);
  assert.equal(access.owned, true);
  assert.equal(access.active, true);
  assert.equal(access.selectionRevision, 1);

  assertAllowed(
    await fx.authorize(),
    fx.playerA
  );
});


/*
 * TEST 43 — PERSISTENT SELECTION REVISION
 */

test("increments persistent selection revision when the active agent changes", async t => {
  const fx = await fixture(t);

  await fx.pay();

  const first = await fx.getCharacterAccess({
    accountId: fx.playerA.accountId,
    characterId: CHARACTER
  });

  assert.equal(first.selectionRevision, 1);

  const selected = fx.select(
    fx.playerA,
    OTHER_CHARACTER
  );

  assert.equal(selected.changed, true);

  assert.equal(selected.selectionRevision, 2);

  const current = await fx.getCharacterAccess({
    accountId: fx.playerA.accountId,
    characterId: OTHER_CHARACTER
  });

  assert.equal(current.active, true);

  assert.equal(current.selectionRevision, 2);

  assertDenied(
    await fx.authorize(),
    "character_access_denied"
  );

  assertAllowed(
    await fx.authorize({
      characterId: OTHER_CHARACTER
    }),
    fx.playerA,
    OTHER_CHARACTER
  );
});


/*
 * TEST 44 — ABA SELECTION REVISION
 */

test("distinguishes identical active characters across different selection revisions", async t => {
  const fx = await fixture(t);

  await fx.pay();

  const first = await fx.getCharacterAccess({
    accountId: fx.playerA.accountId,
    characterId: CHARACTER
  });

  fx.select(
    fx.playerA,
    OTHER_CHARACTER
  );

  fx.select(
    fx.playerA,
    CHARACTER
  );

  const current = await fx.getCharacterAccess({
    accountId: fx.playerA.accountId,
    characterId: CHARACTER
  });

  assert.equal(
    current.characterId,
    first.characterId
  );

  assert.equal(
    current.activeCharacterId,
    first.activeCharacterId
  );

  assert.equal(current.active, true);
  assert.equal(current.owned, true);

  assert.equal(first.selectionRevision, 1);

  assert.equal(current.selectionRevision, 3);

  assert.notEqual(
    first.selectionRevision,
    current.selectionRevision
  );

  const history = fx.characterStore.getHistory({
    accountId: fx.playerA.accountId
  });

  assert.equal(history.ok, true);

  assert.deepEqual(
    history.items.map(
      item => item.selectionRevision
    ),
    [3, 2, 1]
  );
});


/*
 * TEST 45 — ACCOUNT REVISION ISOLATION
 */

test("isolates persistent character selection revisions between accounts", async t => {
  const fx = await fixture(t);

  await fx.pay(fx.playerA);

  await fx.pay(fx.playerB);

  fx.select(
    fx.playerA,
    OTHER_CHARACTER
  );

  fx.select(
    fx.playerA,
    CHARACTER
  );

  const accessA = await fx.getCharacterAccess({
    accountId: fx.playerA.accountId,
    characterId: CHARACTER
  });

  const accessB = await fx.getCharacterAccess({
    accountId: fx.playerB.accountId,
    characterId: CHARACTER
  });

  assert.equal(accessA.selectionRevision, 3);

  assert.equal(accessB.selectionRevision, 1);

  assert.notEqual(
    accessA.accountId,
    accessB.accountId
  );

  const results = await Promise.all([
    fx.runtime.authorize(
      fx.input(fx.playerA)
    ),

    fx.runtime.authorize(
      fx.input(fx.playerB)
    )
  ]);

  assertAllowed(
    results[0],
    fx.playerA
  );

  assertAllowed(
    results[1],
    fx.playerB
  );
});

/*
 * LAGO GAME
 * R2.8B4A — SELECTION REVISION SECURITY
 *
 * Persistent revision binding.
 * ABA change detection.
 * Strict ownership evidence.
 * Client revision isolation.
 * Immutable authorization decisions.
 */


/*
 * TEST 46 — VERIFIED REVISION
 */

test("binds successful runtime authorization to the server selection revision", async t => {
  const fx = await fixture(t);

  await fx.pay();

  const result = await fx.authorize();

  assertAllowed(result, fx.playerA);

  assert.equal(
    result.selectionRevision,
    1
  );

  assert.equal(
    result.selectionRevisionVerified,
    true
  );

  assert.equal(
    result.executionReauthorizationRequired,
    true
  );

  assert.equal(
    Object.isFrozen(result),
    true
  );
});


/*
 * TEST 47 — INVALID INITIAL REVISION
 */

test("rejects invalid initial character selection revisions", async t => {
  const fx = await fixture(t);

  await fx.pay();

  for (const selectionRevision of [
    undefined,
    null,
    0,
    -1,
    1.5,
    "1",
    true,
    NaN,
    Infinity,
    Number.MAX_SAFE_INTEGER + 1,
    {}
  ]) {
    let subscriptionCalls = 0;

    const runtime = fx.createRuntime({
      async getCharacterAccess(input) {
        return {
          ...await fx.getCharacterAccess(input),
          selectionRevision
        };
      },

      async getSubscription(input) {
        subscriptionCalls++;

        return fx.entitlement.getSubscription(
          input
        );
      }
    });

    const result = await runtime.authorize(
      fx.input()
    );

    assertDenied(
      result,
      "character_access_denied"
    );

    assert.equal(subscriptionCalls, 0);

    assert.equal(
      result.selectionRevision,
      null
    );

    assert.equal(
      result.selectionRevisionVerified,
      false
    );
  }
});


/*
 * TEST 48 — INVALID RECHECK REVISION
 */

test("rejects invalid selection revisions returned by the second ownership check", async t => {
  const fx = await fixture(t);

  await fx.pay();

  for (const selectionRevision of [
    undefined,
    null,
    0,
    -1,
    1.5,
    "1",
    NaN,
    Infinity
  ]) {
    let checks = 0;

    const runtime = fx.createRuntime({
      async getCharacterAccess(input) {
        checks++;

        const access =
          await fx.getCharacterAccess(input);

        if (checks === 2) {
          return {
            ...access,
            selectionRevision
          };
        }

        return access;
      }
    });

    assertDenied(
      await runtime.authorize(
        fx.input()
      ),
      "character_context_changed"
    );

    assert.equal(checks, 2);
  }
});


/*
 * TEST 49 — STRICT OWNERSHIP CONTRACT
 */

test("requires successful and explicitly active character ownership evidence", async t => {
  const fx = await fixture(t);

  await fx.pay();

  for (const changes of [
    { ok: false },
    { ok: undefined },
    { active: false },
    { active: undefined },
    { active: "true" },
    { active: 1 },
    { owned: false },
    { serverVerified: false }
  ]) {
    const runtime = fx.createRuntime({
      async getCharacterAccess(input) {
        return {
          ...await fx.getCharacterAccess(input),
          ...changes
        };
      }
    });

    assertDenied(
      await runtime.authorize(
        fx.input()
      ),
      "character_access_denied"
    );
  }
});


/*
 * TEST 50 — ABA DURING VERIFICATION
 */

test("rejects switching away and back to the original character during subscription verification", async t => {
  const fx = await fixture(t);

  await fx.pay();

  const runtime = fx.createRuntime({
    async getSubscription(input) {
      fx.select(
        fx.playerA,
        OTHER_CHARACTER
      );

      fx.select(
        fx.playerA,
        CHARACTER
      );

      return fx.entitlement.getSubscription(
        input
      );
    }
  });

  const result = await runtime.authorize(
    fx.input()
  );

  assertDenied(
    result,
    "character_selection_revision_changed"
  );

  const state = fx.characterStore.getState({
    accountId: fx.playerA.accountId
  });

  assert.equal(
    state.activeCharacterId,
    CHARACTER
  );

  assert.equal(
    state.selectionRevision,
    3
  );

  assert.equal(
    result.selectionRevision,
    null
  );

  const fresh = await fx.authorize();

  assertAllowed(fresh, fx.playerA);

  assert.equal(
    fresh.selectionRevision,
    3
  );
});


/*
 * TEST 51 — FORWARD REVISION MISMATCH
 */

test("rejects a newer revision during the final character recheck", async t => {
  const fx = await fixture(t);

  await fx.pay();

  let checks = 0;

  const runtime = fx.createRuntime({
    async getCharacterAccess(input) {
      checks++;

      const access =
        await fx.getCharacterAccess(input);

      return {
        ...access,
        selectionRevision:
          checks === 1 ? 1 : 2
      };
    }
  });

  assertDenied(
    await runtime.authorize(fx.input()),
    "character_selection_revision_changed"
  );

  assert.equal(checks, 2);
});


/*
 * TEST 52 — REVISION ROLLBACK
 */

test("rejects rollback to an older character selection revision", async t => {
  const fx = await fixture(t);

  await fx.pay();

  fx.select(
    fx.playerA,
    OTHER_CHARACTER
  );

  fx.select(
    fx.playerA,
    CHARACTER
  );

  let checks = 0;

  const runtime = fx.createRuntime({
    async getCharacterAccess(input) {
      checks++;

      const access =
        await fx.getCharacterAccess(input);

      return {
        ...access,

        selectionRevision:
          checks === 1
            ? access.selectionRevision
            : 1
      };
    }
  });

  assertDenied(
    await runtime.authorize(fx.input()),
    "character_selection_revision_changed"
  );
});


/*
 * TEST 53 — IDEMPOTENT SELECTION
 */

test("preserves authorization revision when selecting the already active character", async t => {
  const fx = await fixture(t);

  await fx.pay();

  const runtime = fx.createRuntime({
    async getSubscription(input) {
      const selected = fx.select(
        fx.playerA,
        CHARACTER
      );

      assert.equal(
        selected.changed,
        false
      );

      assert.equal(
        selected.selectionRevision,
        1
      );

      return fx.entitlement.getSubscription(
        input
      );
    }
  });

  const result = await runtime.authorize(
    fx.input()
  );

  assertAllowed(result, fx.playerA);

  assert.equal(
    result.selectionRevision,
    1
  );
});


/*
 * TEST 54 — CLIENT REVISION INJECTION
 */

test("ignores client supplied selection revisions and authorization flags", async t => {
  const fx = await fixture(t);

  await fx.pay();

  const result = await fx.authorize({
    selectionRevision: 999999,
    selectionRevisionVerified: true,
    executionReauthorizationRequired: false,
    activeCharacterId: OTHER_CHARACTER,
    memoryAuthorized: true,
    learningAuthorized: true,
    tradingAuthorized: true
  });

  assertAllowed(
    result,
    fx.playerA
  );

  assert.equal(
    result.selectionRevision,
    1
  );

  assert.equal(
    result.selectionRevisionVerified,
    true
  );

  assert.equal(
    result.executionReauthorizationRequired,
    true
  );

  assert.equal(result.memoryAuthorized, false);
  assert.equal(result.learningAuthorized, false);
  assert.equal(result.tradingAuthorized, false);
});


/*
 * TEST 55 — MUTABLE PROVIDER EVIDENCE
 */

test("captures the initial revision independently of later provider object mutation", async t => {
  const fx = await fixture(t);

  await fx.pay();

  const evidence = {
    ...await fx.getCharacterAccess({
      accountId: fx.playerA.accountId,
      characterId: CHARACTER
    })
  };

  const runtime = fx.createRuntime({
    async getCharacterAccess() {
      return evidence;
    },

    async getSubscription(input) {
      evidence.selectionRevision = 2;

      return fx.entitlement.getSubscription(
        input
      );
    }
  });

  assertDenied(
    await runtime.authorize(
      fx.input()
    ),
    "character_selection_revision_changed"
  );
});


/*
 * TEST 56 — HISTORICAL DECISION SNAPSHOT
 */

test("keeps previously issued decisions immutable after character selection changes", async t => {
  const fx = await fixture(t);

  await fx.pay();

  const original = await fx.authorize();

  assertAllowed(
    original,
    fx.playerA
  );

  assert.equal(
    original.selectionRevision,
    1
  );

  fx.select(
    fx.playerA,
    OTHER_CHARACTER
  );

  fx.select(
    fx.playerA,
    CHARACTER
  );

  const fresh = await fx.authorize();

  assertAllowed(
    fresh,
    fx.playerA
  );

  assert.equal(
    original.selectionRevision,
    1
  );

  assert.equal(
    fresh.selectionRevision,
    3
  );

  assert.deepEqual(
    original.identity,
    fresh.identity
  );

  assert.notEqual(
    original.selectionRevision,
    fresh.selectionRevision
  );

  assert.equal(
    original.executionReauthorizationRequired,
    true
  );

  assert.equal(
    Object.isFrozen(original),
    true
  );
});


/*
 * TEST 57 — ACCOUNT REVISION BINDING
 */

test("binds concurrent authorization decisions to independent account revisions", async t => {
  const fx = await fixture(t);

  await fx.pay(fx.playerA);
  await fx.pay(fx.playerB);

  fx.select(
    fx.playerA,
    OTHER_CHARACTER
  );

  fx.select(
    fx.playerA,
    CHARACTER
  );

  const [resultA, resultB] =
    await Promise.all([
      fx.runtime.authorize(
        fx.input(fx.playerA)
      ),

      fx.runtime.authorize(
        fx.input(fx.playerB)
      )
    ]);

  assertAllowed(resultA, fx.playerA);
  assertAllowed(resultB, fx.playerB);

  assert.equal(
    resultA.selectionRevision,
    3
  );

  assert.equal(
    resultB.selectionRevision,
    1
  );

  assert.equal(
    resultA.selectionRevisionVerified,
    true
  );

  assert.equal(
    resultB.selectionRevisionVerified,
    true
  );

  assert.notEqual(
    resultA.identity.accountId,
    resultB.identity.accountId
  );
});


/*
 * TEST 58 — FAIL CLOSED REVISION CONTRACT
 */

test("removes revision evidence and all execution permissions from denied decisions", async t => {
  const fx = await fixture(t);

  const result = await fx.authorize();

  assertDenied(
    result,
    "active_subscription_required"
  );

  assert.equal(
    result.selectionRevision,
    null
  );

  assert.equal(
    result.selectionRevisionVerified,
    false
  );

  assert.equal(result.learningAuthorized, false);
  assert.equal(result.memoryAuthorized, false);
  assert.equal(result.tradingAuthorized, false);

  assert.equal(
    result.externalModelTrainingAuthorized,
    false
  );
});


/*
 * TEST 59 — REVISION SECURITY POLICY
 */

test("publishes immutable server revision authorization policy", async t => {
  const fx = await fixture(t);

  const policy = fx.runtime.getPolicy();

  assert.equal(
    policy.activeCharacterRequired,
    true
  );

  assert.equal(
    policy.selectionRevisionRequired,
    true
  );

  assert.equal(
    policy.selectionRevisionServerVerified,
    true
  );

  assert.equal(
    policy.selectionRevisionBoundAuthorization,
    true
  );

  assert.equal(
    policy.selectionRevisionRecheckRequired,
    true
  );

  assert.equal(
    policy.clientSelectionRevisionTrusted,
    false
  );

  assert.equal(
    policy.executionReauthorizationRequired,
    true
  );

  assert.equal(
    policy.failClosed,
    true
  );

  assert.equal(
    Object.isFrozen(policy),
    true
  );
});

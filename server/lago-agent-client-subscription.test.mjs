import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";

/*
 * LAGO GAME
 * R2.7H1A — CLIENT SUBSCRIPTION SECURITY TESTS
 *
 * Real frontend subscription module.
 * Isolated browser simulation.
 * Deterministic timers.
 * Synthetic server responses.
 *
 * No real payments.
 * No external network requests.
 */

const SOURCE = readFileSync(
  new URL("../lago-agent-access.js", import.meta.url),
  "utf8"
);

const ACCOUNT_A = "lago_" + "A".repeat(22);
const ACCOUNT_B = "lago_" + "B".repeat(22);

const START = "2027-01-31T12:00:00.000Z";
const END = "2027-02-28T12:00:00.000Z";

const TOKEN_MINT =
  "J9BmsKsS6PH7QGxDWA43YVbsmTxavgFmu5ScSDzWpump";


/*
 * SERVER SUBSCRIPTION RESPONSE
 */

function subscription(
  accountId = ACCOUNT_A,
  changes = {}
) {

  return {
    ok: true,

    accountId,

    product: "personal-ai-agent",

    billingModel: "subscription",
    billingInterval: "month",
    billingIntervalCount: 1,

    subscriptionScope: "account",
    maxActiveAgents: 1,

    currency: "LAGO",
    tokenMint: TOKEN_MINT,

    chain: "solana",
    network: "mainnet-beta",

    autoRenewal: false,

    status: "active",
    subscriptionStatus: "active",

    serverVerified: true,
    entitled: true,
    subscriptionEntitlementGranted: true,

    currentPeriodStart: START,
    currentPeriodEnd: END,
    paidThrough: END,
    latestPeriodEnd: END,

    checkedAt: START,

    ...changes
  };

}


function response(
  state = subscription(),
  status = 200
) {

  return new Response(

    JSON.stringify({
      ok: true,
      subscription: state
    }),

    {
      status,

      headers: {
        "Content-Type": "application/json"
      }
    }

  );

}


function deferred() {

  let resolve;
  let reject;

  const promise = new Promise((res, rej) => {

    resolve = res;
    reject = rej;

  });

  return { promise, resolve, reject };

}


async function flush() {

  await new Promise(resolve =>
    setImmediate(resolve)
  );

}


/*
 * ISOLATED BROWSER FIXTURE
 */

function fixture() {

  let auth = {
    authenticated: false,
    loading: false,
    accountId: "",
    lastError: ""
  };

  let character = {
    characterId: "lago",
    characterName: "Lago"
  };

  let clock = 0;
  let timerSequence = 0;

  const timers = new Map();

  const calls = [];
  const events = [];

  const document = new EventTarget();
  const windowEvents = new EventTarget();

  document.hidden = false;

  class SyntheticCustomEvent extends Event {

    constructor(type, options = {}) {

      super(type);

      this.detail = options.detail;

    }

  }

  document.addEventListener(
    "lago:agent-access-state",
    event => events.push(event.detail)
  );

  let provider = async () =>
    response(subscription(auth.accountId));

  const sandbox = {

    document,

    CustomEvent: SyntheticCustomEvent,

    AbortController,

    performance: {
      now: () => clock
    },

    setTimeout(callback, milliseconds) {

      const id = ++timerSequence;

      timers.set(id, {
        callback,
        milliseconds
      });

      return id;

    },

    clearTimeout(id) {

      timers.delete(id);

    },

    addEventListener(type, handler) {

      windowEvents.addEventListener(
        type,
        handler
      );

    },

    async fetch(url, options) {

      calls.push({ url, options });

      return provider(url, options);

    },

    LAGO_AUTH_BACKEND: {

      getState() {
        return { ...auth };
      }

    },

    LAGO_MINIGAMES: {

      getContext() {
        return { ...character };
      }

    },

    localStorage: {

      getItem() {
        throw new Error("unexpected_storage_read");
      },

      setItem() {
        throw new Error("unexpected_storage_write");
      },

      removeItem() {
        throw new Error("unexpected_storage_mutation");
      }

    }

  };

  sandbox.window = sandbox;

  const runtime = createContext(sandbox);

  runInContext(SOURCE, runtime, {
    filename: "lago-agent-access.js",
    timeout: 5000
  });

  const api = sandbox.LAGO_AGENT_ACCESS;

  function emitAuth() {

    document.dispatchEvent(
      new SyntheticCustomEvent(
        "lago:backend-auth-state"
      )
    );

  }

  return {

    api,
    calls,
    events,
    timers,
    sandbox,

    state() {
      return api.getState();
    },

    setProvider(nextProvider) {
      provider = nextProvider;
    },

    async login(accountId = ACCOUNT_A) {

      auth = {
        authenticated: true,
        loading: false,
        accountId,
        lastError: ""
      };

      emitAuth();

      await flush();

      return api.getState();

    },

    logout() {

      auth = {
        authenticated: false,
        loading: false,
        accountId: "",
        lastError: ""
      };

      emitAuth();

    },

    setAuth(changes) {

      auth = { ...auth, ...changes };

      emitAuth();

    },

    select(characterId, characterName) {

      character = {
        characterId,
        characterName
      };

      document.dispatchEvent(
        new Event("lago:character-equipped")
      );

    },

    advance(milliseconds) {

      clock += milliseconds;

    },

    fireTimer(milliseconds) {

      const entry = [...timers.entries()]
        .find(([, timer]) =>
          timer.milliseconds === milliseconds
        );

      assert.ok(
        entry,
        "Expected timer: " + milliseconds
      );

      const [id, timer] = entry;

      timers.delete(id);

      timer.callback();

    },

    visibility(hidden) {

      document.hidden = hidden;

      document.dispatchEvent(
        new Event("visibilitychange")
      );

    },

    windowEvent(type) {

      windowEvents.dispatchEvent(
        new Event(type)
      );

    }

  };

}


/*
 * ACCESS ASSERTIONS
 */

function assertRuntimeLocked(fx) {

  const state = fx.state();

  for (const field of [

    "aiEnabled",
    "chatEnabled",
    "memoryEnabled",
    "learningEnabled",
    "marketAnalysisEnabled",
    "tradingEnabled",
    "tradingAuthorized",
    "checkoutAvailable",
    "renewalAvailable"

  ]) {

    assert.equal(state[field], false, field);

  }

  assert.equal(fx.api.canUseAI(), false);
  assert.equal(fx.api.canTrade(), false);

}


function assertUnavailable(fx) {

  const state = fx.state();

  assert.equal(
    state.subscriptionStateAvailable,
    false
  );

  assert.equal(state.entitled, false);
  assert.equal(state.serverVerified, false);

  assert.equal(state.currentPeriodStart, null);
  assert.equal(state.currentPeriodEnd, null);

  assertRuntimeLocked(fx);

}


/*
 * TEST 01 — GUEST
 */

test("does not request subscriptions for unauthenticated guests", async () => {

  const fx = fixture();

  await fx.api.refresh();

  assert.equal(fx.calls.length, 0);
  assert.equal(fx.state().authenticated, false);
  assert.equal(fx.timers.size, 0);

  assertUnavailable(fx);

});


/*
 * TEST 02 — ACTIVE SUBSCRIPTION
 */

test("accepts valid server billing state without activating AI", async () => {

  const fx = fixture();

  const state = await fx.login();

  assert.equal(state.accountId, ACCOUNT_A);
  assert.equal(state.subscriptionStatus, "active");
  assert.equal(state.subscriptionStateAvailable, true);

  assert.equal(state.serverVerified, true);
  assert.equal(state.entitled, true);

  assert.equal(state.currentPeriodStart, START);
  assert.equal(state.currentPeriodEnd, END);
  assert.equal(state.daysRemaining, 28);

  assert.equal(state.loading, false);

  assertRuntimeLocked(fx);

});


/*
 * TEST 03 — DISABLED ENTITLEMENT
 */

test("displays recorded billing state while entitlement is disabled", async () => {

  const fx = fixture();

  fx.setProvider(async () =>
    response(subscription(ACCOUNT_A, {

      serverVerified: false,
      entitled: false,
      subscriptionEntitlementGranted: false

    }))
  );

  const state = await fx.login();

  assert.equal(state.subscriptionStatus, "active");
  assert.equal(state.subscriptionStateAvailable, true);
  assert.equal(state.entitled, false);

  assert.equal(
    state.reason,
    "subscription_entitlement_disabled"
  );

  assertRuntimeLocked(fx);

});


/*
 * TEST 04 — NON-ACTIVE SUBSCRIPTIONS
 */

test("keeps inactive expired and scheduled subscriptions locked", async () => {

  const fx = fixture();

  await fx.login();

  const cases = [

    ["inactive", null, START],

    ["expired", END, END],

    ["scheduled", END, START]

  ];

  for (const [status, latestPeriodEnd, checkedAt] of cases) {

    fx.setProvider(async () =>
      response(subscription(ACCOUNT_A, {

        status,
        subscriptionStatus: status,

        entitled: false,
        subscriptionEntitlementGranted: false,

        currentPeriodStart: null,
        currentPeriodEnd: null,
        paidThrough: null,
        latestPeriodEnd,
        checkedAt

      }))
    );

    await fx.api.refresh();

    const state = fx.state();

    assert.equal(state.subscriptionStatus, status);
    assert.equal(state.subscriptionStateAvailable, true);
    assert.equal(state.entitled, false);
    assert.equal(state.daysRemaining, 0);

    assertRuntimeLocked(fx);

  }

});


/*
 * TEST 05 — RESPONSE VALIDATION
 */

test("rejects inconsistent subscription response fields", async () => {

  const fx = fixture();

  await fx.login();

  const mutations = [

    { accountId: ACCOUNT_B },

    { product: "foreign-product" },

    { billingModel: "one-time" },

    { billingInterval: "year" },

    { billingIntervalCount: 12 },

    { currency: "USD" },

    { tokenMint: "foreign-mint" },

    { chain: "ethereum" },

    { network: "devnet" },

    { maxActiveAgents: 10 },

    { subscriptionScope: "character" },

    { autoRenewal: true },

    { serverVerified: "true" },

    { entitled: "true" },

    { entitled: false },

    { subscriptionEntitlementGranted: false },

    { status: "unknown" },

    { subscriptionStatus: "expired" },

    { checkedAt: "invalid-date" },

    { currentPeriodStart: END },

    { currentPeriodEnd: START },

    { paidThrough: START },

    { latestPeriodEnd: START },

    { currentPeriodEnd: null }

  ];

  for (const changes of mutations) {

    fx.setProvider(async () =>
      response(subscription(ACCOUNT_A, changes))
    );

    await fx.api.refresh();

    assertUnavailable(fx);

    assert.equal(
      fx.state().reason,
      "invalid_subscription_response"
    );

  }

});


/*
 * TEST 06 — REQUEST SECURITY
 */

test("uses a fixed same-origin endpoint without client identity parameters", async () => {

  const fx = fixture();

  await fx.login();

  assert.equal(fx.calls.length, 1);

  const request = fx.calls[0];

  assert.equal(
    request.url,
    "/api/subscription/state"
  );

  assert.equal(request.options.method, "GET");
  assert.equal(request.options.credentials, "same-origin");
  assert.equal(request.options.cache, "no-store");
  assert.equal(request.options.redirect, "error");

  assert.equal(
    request.options.headers.Accept,
    "application/json"
  );

  assert.equal(
    Object.hasOwn(request.options, "body"),
    false
  );

});


/*
 * TEST 07 — LOGOUT
 */

test("clears subscription data immediately after logout", async () => {

  const fx = fixture();

  await fx.login();

  assert.equal(fx.state().entitled, true);

  fx.logout();

  assertUnavailable(fx);

  assert.equal(fx.state().accountId, null);
  assert.equal(fx.timers.size, 0);

});


/*
 * TEST 08 — CROSS-ACCOUNT RACE
 */

test("ignores late subscription responses from a previous account", async () => {

  const fx = fixture();

  const first = deferred();
  const second = deferred();

  fx.setProvider(() => first.promise);

  await fx.login(ACCOUNT_A);

  const oldSignal =
    fx.calls[0].options.signal;

  fx.setProvider(() => second.promise);

  await fx.login(ACCOUNT_B);

  assert.equal(oldSignal.aborted, true);

  second.resolve(
    response(subscription(ACCOUNT_B))
  );

  await flush();

  assert.equal(fx.state().accountId, ACCOUNT_B);

  first.resolve(
    response(subscription(ACCOUNT_A))
  );

  await flush();

  assert.equal(fx.state().accountId, ACCOUNT_B);
  assert.equal(fx.state().entitled, true);

  assertRuntimeLocked(fx);

});


/*
 * TEST 09 — SAME-ACCOUNT REQUEST RACE
 */

test("does not overwrite new subscription state with an older response", async () => {

  const fx = fixture();

  await fx.login();

  const first = deferred();
  const second = deferred();

  fx.setProvider(() => first.promise);

  const older = fx.api.refresh();

  fx.setProvider(() => second.promise);

  const newer = fx.api.refresh();

  second.resolve(
    response(subscription(ACCOUNT_A, {

      serverVerified: false,
      entitled: false,
      subscriptionEntitlementGranted: false

    }))
  );

  await newer;

  first.resolve(
    response(subscription())
  );

  await older;

  assert.equal(
    fx.state().subscriptionStateAvailable,
    true
  );

  assert.equal(fx.state().entitled, false);
  assert.equal(fx.state().serverVerified, false);

});


/*
 * TEST 10 — CHARACTER SWITCH
 */

test("preserves account subscription when switching characters", async () => {

  const fx = fixture();

  await fx.login();

  const before = fx.state();

  fx.select("comic_pink_snail", "Sola");

  const after = fx.state();

  assert.equal(after.characterId, "comic_pink_snail");
  assert.equal(after.characterName, "Sola");

  assert.equal(after.accountId, before.accountId);
  assert.equal(after.entitled, before.entitled);

  assert.equal(
    after.currentPeriodEnd,
    before.currentPeriodEnd
  );

  assert.equal(fx.calls.length, 1);

  assertRuntimeLocked(fx);

});


/*
 * TEST 11 — STALE SNAPSHOT
 */

test("invalidates subscription snapshots at the maximum allowed age", async () => {

  const fx = fixture();

  await fx.login();

  fx.advance(59999);

  assert.equal(fx.state().entitled, true);

  fx.advance(1);

  assertUnavailable(fx);

});


/*
 * TEST 12 — EXACT EXPIRATION
 */

test("stops displaying active entitlement at the exact period end", async () => {

  const fx = fixture();

  const checkedAt = new Date(
    Date.parse(END) - 1000
  ).toISOString();

  fx.setProvider(async () =>
    response(subscription(ACCOUNT_A, { checkedAt }))
  );

  await fx.login();

  fx.advance(999);

  assert.equal(fx.state().entitled, true);

  fx.advance(1);

  assertUnavailable(fx);

});


/*
 * TEST 13 — AUTHENTICATION FAILURE
 */

test("clears billing state when the server returns HTTP 401", async () => {

  const fx = fixture();

  await fx.login();

  fx.setProvider(async () =>
    new Response("{}", { status: 401 })
  );

  await fx.api.refresh();

  assertUnavailable(fx);

  assert.equal(
    fx.state().reason,
    "authentication_required"
  );

  assert.equal(fx.state().loading, false);

});


/*
 * TEST 14 — UNAVAILABLE OR INVALID API
 */

test("fails closed on HTTP errors HTML and malformed JSON", async () => {

  const fx = fixture();

  await fx.login();

  const providers = [

    async () =>
      new Response("{}", { status: 503 }),

    async () =>
      new Response("{}", { status: 404 }),

    async () =>
      new Response("<html>Not found</html>", {

        headers: {
          "Content-Type": "text/html"
        }

      }),

    async () =>
      new Response("{broken-json", {

        headers: {
          "Content-Type": "application/json"
        }

      })

  ];

  for (const provider of providers) {

    fx.setProvider(provider);

    await fx.api.refresh();

    assertUnavailable(fx);

    assert.equal(fx.state().loading, false);

  }

});


/*
 * TEST 15 — NETWORK FAILURE
 */

test("does not preserve entitlement after a failed network refresh", async () => {

  const fx = fixture();

  await fx.login();

  fx.setProvider(async () => {

    throw new Error("SYNTHETIC_PRIVATE_ERROR");

  });

  await fx.api.refresh();

  assertUnavailable(fx);

  assert.equal(
    fx.state().reason,
    "subscription_service_unavailable"
  );

  assert.equal(

    JSON.stringify(fx.state()).includes(
      "SYNTHETIC_PRIVATE_ERROR"
    ),

    false

  );

});


/*
 * TEST 16 — REQUEST TIMEOUT
 */

test("aborts pending subscription requests after ten seconds", async () => {

  const fx = fixture();

  await fx.login();

  fx.setProvider((url, options) =>
    new Promise((resolve, reject) => {

      options.signal.addEventListener(
        "abort",

        () => reject(
          new Error("request_aborted")
        ),

        { once: true }
      );

    })
  );

  const pending = fx.api.refresh();

  assert.equal(fx.state().loading, true);

  fx.fireTimer(10000);

  await pending;

  assertUnavailable(fx);

  assert.equal(fx.state().loading, false);

  assert.equal(
    fx.state().reason,
    "subscription_request_timeout"
  );

});


/*
 * TEST 17 — PERIODIC REFRESH
 */

test("refreshes visible authenticated subscriptions every thirty seconds", async () => {

  const fx = fixture();

  await fx.login();

  assert.equal(fx.calls.length, 1);

  fx.advance(30000);

  fx.fireTimer(30000);

  await flush();

  assert.equal(fx.calls.length, 2);

  assert.equal(fx.state().entitled, true);

  assert.equal(
    [...fx.timers.values()].filter(
      timer => timer.milliseconds === 30000
    ).length,
    1
  );

});


/*
 * TEST 18 — VISIBILITY
 */

test("clears subscription snapshots when hidden and refreshes on return", async () => {

  const fx = fixture();

  await fx.login();

  fx.visibility(true);

  assertUnavailable(fx);

  assert.equal(fx.timers.size, 0);

  fx.visibility(false);

  await flush();

  assert.equal(fx.calls.length, 2);
  assert.equal(fx.state().entitled, true);

});


/*
 * TEST 19 — OFFLINE AND ONLINE
 */

test("invalidates subscription state offline and refreshes after reconnecting", async () => {

  const fx = fixture();

  await fx.login();

  fx.windowEvent("offline");

  assertUnavailable(fx);

  assert.equal(fx.timers.size, 0);

  fx.windowEvent("online");

  await flush();

  assert.equal(fx.calls.length, 2);
  assert.equal(fx.state().entitled, true);

});


/*
 * TEST 20 — IMMUTABLE POLICY
 */

test("keeps operational permissions locked despite server response flags", async () => {

  const fx = fixture();

  fx.setProvider(async () =>
    response(subscription(ACCOUNT_A, {

      aiEnabled: true,
      chatEnabled: true,
      memoryEnabled: true,
      learningEnabled: true,
      marketAnalysisEnabled: true,
      tradingEnabled: true,
      tradingAuthorized: true,
      checkoutAvailable: true,
      renewalAvailable: true

    }))
  );

  await fx.login();

  assert.equal(fx.state().entitled, true);

  assertRuntimeLocked(fx);

  const policy = fx.api.getPolicy();

  assert.equal(policy.maxActiveAgents, 1);
  assert.equal(policy.subscriptionScope, "account");

  assert.equal(policy.autoRenewal, false);
  assert.equal(policy.freeTrial, false);

  assert.equal(policy.unlockWithXP, false);
  assert.equal(policy.unlockWithSP, false);

  assert.equal(policy.localEntitlementTrusted, false);
  assert.equal(policy.persistentClientCache, false);

  assert.equal(policy.preserveMemoryOnExpiry, true);
  assert.equal(policy.preserveCharacterOnExpiry, true);
  assert.equal(policy.preserveProgressOnExpiry, true);

  assert.equal(Object.isFrozen(policy), true);
  assert.equal(Object.isFrozen(fx.state()), true);

});
/*
 * LAGO GAME
 * R2.7H1C — CLIENT RELIABILITY REGRESSION TESTS
 *
 * Request cancellation.
 * Network latency accounting.
 * Browser lifecycle protection.
 * Final asynchronous state consistency.
 */


/*
 * TEST 21 — FINAL ERROR STATE
 */

test("returns final state after unsuccessful subscription refresh", async () => {

  const fx = fixture();

  await fx.login();

  const cases = [

    [
      async () => new Response("{}", {
        status: 401
      }),
      "authentication_required"
    ],

    [
      async () => new Response("{}", {
        status: 503
      }),
      "subscription_service_unavailable"
    ],

    [
      async () => new Response("<html>Error</html>", {
        headers: {
          "Content-Type": "text/html"
        }
      }),
      "invalid_subscription_response"
    ],

    [
      async () => response(
        subscription(ACCOUNT_B)
      ),
      "invalid_subscription_response"
    ]

  ];

  for (const [provider, expectedReason] of cases) {

    fx.setProvider(provider);

    const returned = await fx.api.refresh();

    assert.equal(returned.loading, false);

    assert.equal(
      returned.reason,
      expectedReason
    );

    assert.equal(
      returned.subscriptionStateAvailable,
      false
    );

    assert.equal(returned.entitled, false);

    assert.deepEqual(returned, fx.state());

    assertUnavailable(fx);

  }

});


/*
 * TEST 22 — FINAL SUCCESS STATE
 */

test("returns completed subscription state after successful refresh", async () => {

  const fx = fixture();

  await fx.login();

  const returned = await fx.api.refresh();

  assert.equal(returned.loading, false);

  assert.equal(
    returned.subscriptionStateAvailable,
    true
  );

  assert.equal(returned.entitled, true);

  assert.deepEqual(returned, fx.state());

  assertRuntimeLocked(fx);

});


/*
 * TEST 23 — UNCOOPERATIVE NETWORK TRANSPORT
 */

test("completes timeout even when network transport ignores abort signals", async () => {

  const fx = fixture();

  await fx.login();

  const transport = deferred();

  fx.setProvider(() => transport.promise);

  const pending = fx.api.refresh();

  assert.equal(fx.state().loading, true);

  const signal =
    fx.calls.at(-1).options.signal;

  fx.fireTimer(10000);

  const result = await pending;

  assert.equal(signal.aborted, true);

  assert.equal(result.loading, false);

  assert.equal(
    result.reason,
    "subscription_request_timeout"
  );

  assertUnavailable(fx);

  transport.resolve(response());

  await flush();

  assertUnavailable(fx);

});


/*
 * TEST 24 — STALLED JSON RESPONSE
 */

test("cancels stalled response body parsing", async () => {

  const fx = fixture();

  await fx.login();

  const body = deferred();

  let parsingStarted = false;

  fx.setProvider(async () => ({

    ok: true,

    status: 200,

    headers: new Headers({
      "Content-Type": "application/json"
    }),

    json() {

      parsingStarted = true;

      return body.promise;

    }

  }));

  const pending = fx.api.refresh();

  await flush();

  assert.equal(parsingStarted, true);
  assert.equal(fx.state().loading, true);

  fx.fireTimer(10000);

  const result = await pending;

  assert.equal(result.loading, false);

  assert.equal(
    result.reason,
    "subscription_request_timeout"
  );

  body.resolve({
    ok: true,
    subscription: subscription()
  });

  await flush();

  assertUnavailable(fx);

});


/*
 * TEST 25 — DEADLINE WITHOUT TIMER EXECUTION
 */

test("rejects responses arriving after the request deadline", async () => {

  const fx = fixture();

  await fx.login();

  const transport = deferred();

  fx.setProvider(() => transport.promise);

  const pending = fx.api.refresh();

  /*
   * Simulate delayed browser timers.
   */

  fx.advance(10000);

  transport.resolve(response());

  const result = await pending;

  assert.equal(result.loading, false);

  assert.equal(
    result.reason,
    "subscription_request_timeout"
  );

  assertUnavailable(fx);

});


/*
 * TEST 26 — NETWORK LATENCY ACCOUNTING
 */

test("includes network latency in subscription freshness calculation", async () => {

  const fx = fixture();

  await fx.login();

  const transport = deferred();

  fx.setProvider(() => transport.promise);

  const pending = fx.api.refresh();

  fx.advance(5000);

  transport.resolve(response());

  await pending;

  assert.equal(fx.state().entitled, true);

  fx.advance(54999);

  assert.equal(fx.state().entitled, true);

  fx.advance(1);

  assertUnavailable(fx);

});


/*
 * TEST 27 — EXPIRATION DURING TRANSPORT
 */

test("does not display entitlement that expires during network transit", async () => {

  const fx = fixture();

  await fx.login();

  const transport = deferred();

  fx.setProvider(() => transport.promise);

  const pending = fx.api.refresh();

  const checkedAt = new Date(
    Date.parse(END) - 1000
  ).toISOString();

  fx.advance(1000);

  transport.resolve(

    response(
      subscription(ACCOUNT_A, {
        checkedAt
      })
    )

  );

  const returned = await pending;

  assert.equal(returned.loading, false);

  assert.equal(returned.entitled, false);

  assertUnavailable(fx);

});


/*
 * TEST 28 — INVALID MONOTONIC CLOCK
 */

test("fails closed when the request clock moves backwards", async () => {

  const fx = fixture();

  await fx.login();

  const transport = deferred();

  fx.setProvider(() => transport.promise);

  const pending = fx.api.refresh();

  fx.advance(-100);

  transport.resolve(response());

  const returned = await pending;

  assert.equal(
    returned.reason,
    "subscription_request_timeout"
  );

  assertUnavailable(fx);

});


/*
 * TEST 29 — HIDDEN PAGE REFRESH
 */

test("does not start manual refreshes in a hidden page", async () => {

  const fx = fixture();

  await fx.login();

  fx.visibility(true);

  const previousCalls = fx.calls.length;

  const result = await fx.api.refresh();

  assert.equal(
    fx.calls.length,
    previousCalls
  );

  assert.equal(result.loading, false);

  assert.equal(fx.timers.size, 0);

  assertUnavailable(fx);

});


/*
 * TEST 30 — HIDDEN AUTHENTICATION
 */

test("does not request subscriptions when login occurs in a hidden page", async () => {

  const fx = fixture();

  fx.visibility(true);

  await fx.login();

  assert.equal(fx.calls.length, 0);

  assertUnavailable(fx);

  fx.visibility(false);

  await flush();

  assert.equal(fx.calls.length, 1);

  assert.equal(fx.state().entitled, true);

});


/*
 * TEST 31 — PAGE SUSPENSION
 */

test("suspends subscription refreshes after pagehide", async () => {

  const fx = fixture();

  await fx.login();

  fx.windowEvent("pagehide");

  assertUnavailable(fx);

  assert.equal(fx.timers.size, 0);

  const previousCalls = fx.calls.length;

  await fx.api.refresh();

  fx.windowEvent("online");

  await flush();

  assert.equal(
    fx.calls.length,
    previousCalls
  );

  fx.windowEvent("pageshow");

  await flush();

  assert.equal(
    fx.calls.length,
    previousCalls + 1
  );

  assert.equal(fx.state().entitled, true);

});


/*
 * TEST 32 — PAGEHIDE DURING REQUEST
 */

test("cancels pending subscriptions when the page is suspended", async () => {

  const fx = fixture();

  await fx.login();

  const transport = deferred();

  fx.setProvider(() => transport.promise);

  const pending = fx.api.refresh();

  const signal =
    fx.calls.at(-1).options.signal;

  fx.windowEvent("pagehide");

  await pending;

  assert.equal(signal.aborted, true);

  transport.resolve(response());

  await flush();

  assertUnavailable(fx);

  assert.equal(fx.timers.size, 0);

});


/*
 * TEST 33 — OFFLINE REFRESH BLOCK
 */

test("does not perform subscription requests while offline", async () => {

  const fx = fixture();

  await fx.login();

  fx.windowEvent("offline");

  const previousCalls = fx.calls.length;

  await fx.api.refresh();

  fx.setAuth({
    lastError: ""
  });

  await flush();

  assert.equal(
    fx.calls.length,
    previousCalls
  );

  assertUnavailable(fx);

  fx.windowEvent("online");

  await flush();

  assert.equal(
    fx.calls.length,
    previousCalls + 1
  );

  assert.equal(fx.state().entitled, true);

});


/*
 * TEST 34 — ONLINE WHILE HIDDEN
 */

test("does not refresh hidden subscriptions on network reconnect", async () => {

  const fx = fixture();

  await fx.login();

  fx.visibility(true);

  fx.windowEvent("offline");

  const previousCalls = fx.calls.length;

  fx.windowEvent("online");

  await flush();

  assert.equal(
    fx.calls.length,
    previousCalls
  );

  assertUnavailable(fx);

  fx.visibility(false);

  await flush();

  assert.equal(
    fx.calls.length,
    previousCalls + 1
  );

});


/*
 * TEST 35 — CANCELLED REQUEST ISOLATION
 */

test("allows superseded requests to settle without waiting for their transport", async () => {

  const fx = fixture();

  await fx.login();

  const transport = deferred();

  fx.setProvider(() => transport.promise);

  const older = fx.api.refresh();

  const signal =
    fx.calls.at(-1).options.signal;

  fx.setProvider(async () =>
    response(subscription())
  );

  const newer = fx.api.refresh();

  await newer;
  await older;

  assert.equal(signal.aborted, true);

  assert.equal(fx.state().loading, false);

  assert.equal(fx.state().entitled, true);

  /*
   * The older transport completes later.
   */

  transport.resolve(

    response(subscription(ACCOUNT_A, {

      serverVerified: false,

      entitled: false,

      subscriptionEntitlementGranted: false

    }))

  );

  await flush();

  assert.equal(fx.state().entitled, true);

  assertRuntimeLocked(fx);

});


/*
 * TEST 36 — MISSING TIMER API
 */

test("fails closed when required browser timer support is unavailable", async () => {

  const fx = fixture();

  await fx.login();

  fx.sandbox.clearTimeout = undefined;

  const returned = await fx.api.refresh();

  assert.equal(returned.loading, false);

  assert.equal(

    returned.reason,

    "subscription_service_unavailable"

  );

  assertUnavailable(fx);

});


/*
 * TEST 37 — BROWSER NETWORK STATUS
 */

test("honors the browser offline status without an offline event", async () => {

  const fx = fixture();

  await fx.login();

  fx.sandbox.navigator = {

    onLine: false

  };

  assertUnavailable(fx);

  const previousCalls = fx.calls.length;

  await fx.api.refresh();

  assert.equal(
    fx.calls.length,
    previousCalls
  );

  fx.sandbox.navigator.onLine = true;

  fx.windowEvent("online");

  await flush();

  assert.equal(
    fx.calls.length,
    previousCalls + 1
  );

  assert.equal(fx.state().entitled, true);

});

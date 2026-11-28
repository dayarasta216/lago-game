import test from "node:test";

import assert from "node:assert/strict";

import {
  AI_BUDGET_VERSION,

  AI_BUDGET_LIMITS,

  getAIBudgetWindows,

  createEmptyAIBudgetUsage,

  createLagoAIBudget

} from "./lago-agent-ai-budget.mjs";

import {
  validAccountId
} from "./lago-agent-memory-contract.mjs";


/*
 * R2.8C4 — AI BUDGET SECURITY TESTS
 */

const NOW = Date.parse(
  "2027-01-31T12:00:00.000Z"
);

const ACCOUNT = "a".repeat(64);

const OTHER = "b".repeat(64);


function fixture(changes = {}) {
  const budget = createLagoAIBudget({
    now: () => NOW,

    ...changes
  });

  assert.equal(
    validAccountId(ACCOUNT),
    true
  );

  const usage =
    createEmptyAIBudgetUsage({
      accountId: ACCOUNT,

      now: NOW
    });

  assert.ok(usage);

  function evaluate(
    requestChanges = {},
    usageChanges = {}
  ) {
    return budget.evaluate({
      accountId: ACCOUNT,

      inputTokens: 100,

      maxOutputTokens: 200,

      usage: {
        ...usage,

        ...usageChanges
      },

      ...requestChanges
    });
  }

  return {
    budget,

    usage,

    evaluate
  };
}

function denied(result, reason) {
  assert.equal(result.ok, false);

  assert.equal(result.allowed, false);

  assert.equal(result.reason, reason);

  assert.equal(
    result.reservationCreated,
    false
  );

  assert.equal(
    result.providerDispatchAuthorized,
    false
  );

  assert.equal(
    result.tradingAuthorized,
    false
  );

  assert.equal(
    Object.isFrozen(result),
    true
  );
}


/*
 * TEST 01
 */

test("R2.8C4 validates trusted configuration", () => {
  assert.throws(
    () => createLagoAIBudget({
      limits: null
    }),

    /invalid_ai_budget_limits/
  );

  assert.throws(
    () => createLagoAIBudget({
      now: null
    }),

    /invalid_ai_budget_clock/
  );

  for (const changes of [
    { dailyTokens: 0 },

    { dailyTokens: -1 },

    { monthlyTokens: 1 },

    { dailyRequests: 1.5 },

    { maxInputTokens: 4097 },

    { maxOutputTokens: 1025 },

    { maxOutputTokens: Infinity },

    { foreignField: true }
  ]) {
    assert.throws(
      () => createLagoAIBudget({
        limits: {
          ...AI_BUDGET_LIMITS,

          ...changes
        }
      }),

      /invalid_ai_budget_limits/
    );
  }
});


/*
 * TEST 02
 */

test("R2.8C4 uses exact UTC budget windows", () => {
  assert.deepEqual(
    getAIBudgetWindows(NOW),

    {
      dailyKey: "2027-01-31",

      monthlyKey: "2027-01",

      dailyResetAt:
        "2027-02-01T00:00:00.000Z",

      monthlyResetAt:
        "2027-02-01T00:00:00.000Z"
    }
  );

  const leap = getAIBudgetWindows(
    Date.parse(
      "2028-02-29T23:59:59.999Z"
    )
  );

  assert.equal(
    leap.dailyResetAt,

    "2028-03-01T00:00:00.000Z"
  );

  assert.equal(
    leap.monthlyResetAt,

    "2028-03-01T00:00:00.000Z"
  );
});


/*
 * TEST 03
 */

test("R2.8C4 estimates input and maximum output", () => {
  const fx = fixture();

  const result = fx.evaluate();

  assert.equal(result.ok, true);

  assert.equal(result.allowed, true);

  assert.equal(
    result.version,

    AI_BUDGET_VERSION
  );

  assert.equal(
    result.estimatedTokens,

    300
  );

  assert.equal(
    result.remainingDailyTokens,

    49700
  );

  assert.equal(
    result.remainingMonthlyTokens,

    999700
  );

  assert.equal(
    result.remainingDailyRequests,

    99
  );

  assert.equal(
    result.reservationCreated,

    false
  );

  assert.equal(
    result.providerDispatchAuthorized,

    false
  );

  assert.equal(
    Object.isFrozen(result),

    true
  );
});


/*
 * TEST 04
 */

test("R2.8C4 rejects untrusted request fields", () => {
  const fx = fixture();

  for (const changes of [
    { characterId: "lago" },

    { dailyTokens: 999999999 },

    { monthlyTokens: 999999999 },

    { tradingAuthorized: true },

    { providerDispatchAuthorized: true }
  ]) {
    denied(
      fx.evaluate(changes),

      "invalid_ai_budget_request"
    );
  }
});


/*
 * TEST 05
 */

test("R2.8C4 rejects foreign account usage", () => {
  const fx = fixture();

  denied(
    fx.evaluate(
      {},

      { accountId: OTHER }
    ),

    "invalid_ai_budget_usage"
  );
});


/*
 * TEST 06
 */

test("R2.8C4 rejects missing and stale usage", () => {
  const fx = fixture();

  denied(
    fx.evaluate({
      usage: null
    }),

    "invalid_ai_budget_usage"
  );

  denied(
    fx.evaluate(
      {},

      { dailyKey: "2027-01-30" }
    ),

    "invalid_ai_budget_usage"
  );

  denied(
    fx.evaluate(
      {},

      { monthlyKey: "2026-12" }
    ),

    "invalid_ai_budget_usage"
  );
});


/*
 * TEST 07
 */

test("R2.8C4 validates input and output limits", () => {
  const fx = fixture();

  for (const changes of [
    { inputTokens: 0 },

    { inputTokens: -1 },

    { inputTokens: 4097 },

    { inputTokens: "100" },

    { maxOutputTokens: 0 },

    { maxOutputTokens: 1025 },

    { maxOutputTokens: 1.5 },

    { maxOutputTokens: Infinity }
  ]) {
    denied(
      fx.evaluate(changes),

      "ai_request_token_limit_exceeded"
    );
  }
});


/*
 * TEST 08
 */

test("R2.8C4 blocks exhausted daily token quota", () => {
  const fx = fixture();

  denied(
    fx.evaluate(
      {},

      {
        dailyUsedTokens: 49900,

        monthlyUsedTokens: 49900
      }
    ),

    "ai_daily_token_budget_exceeded"
  );
});


/*
 * TEST 09
 */

test("R2.8C4 blocks exhausted monthly token quota", () => {
  const fx = fixture();

  denied(
    fx.evaluate(
      {},

      {
        dailyUsedTokens: 100,

        monthlyUsedTokens: 999900
      }
    ),

    "ai_monthly_token_budget_exceeded"
  );
});


/*
 * TEST 10
 */

test("R2.8C4 blocks exhausted request quota", () => {
  const fx = fixture();

  denied(
    fx.evaluate(
      {},

      {
        dailyRequests: 100
      }
    ),

    "ai_daily_request_quota_exceeded"
  );
});


/*
 * TEST 11
 */

test("R2.8C4 counts outstanding token reservations", () => {
  const fx = fixture();

  denied(
    fx.evaluate(
      {},

      {
        dailyUsedTokens: 49000,

        monthlyUsedTokens: 49000,

        dailyReservedTokens: 900,

        monthlyReservedTokens: 900
      }
    ),

    "ai_daily_token_budget_exceeded"
  );
});


/*
 * TEST 12
 */

test("R2.8C4 counts outstanding request reservations", () => {
  const fx = fixture();

  denied(
    fx.evaluate(
      {},

      {
        dailyRequests: 99,

        dailyReservedRequests: 1
      }
    ),

    "ai_daily_request_quota_exceeded"
  );
});


/*
 * TEST 13
 */

test("R2.8C4 accepts exact remaining quota", () => {
  const fx = fixture();

  const result = fx.evaluate(
    {},

    {
      dailyUsedTokens: 49700,

      monthlyUsedTokens: 999700,

      dailyRequests: 99
    }
  );

  assert.equal(result.ok, true);

  assert.equal(
    result.remainingDailyTokens,

    0
  );

  assert.equal(
    result.remainingMonthlyTokens,

    0
  );

  assert.equal(
    result.remainingDailyRequests,

    0
  );
});


/*
 * TEST 14
 */

test("R2.8C4 rejects invalid usage counters", () => {
  const fx = fixture();

  for (const changes of [
    { dailyUsedTokens: -1 },

    { monthlyUsedTokens: Infinity },

    { dailyReservedTokens: 1.5 },

    { monthlyReservedTokens: "100" },

    { dailyRequests: NaN },

    { dailyReservedRequests: -1 },

    { dailyUsedTokens: 100 }
  ]) {
    denied(
      fx.evaluate({}, changes),

      "invalid_ai_budget_usage"
    );
  }
});


/*
 * TEST 15
 */

test("R2.8C4 rejects counter overflow", () => {
  const fx = fixture();

  denied(
    fx.evaluate(
      {},

      {
        dailyUsedTokens:
          Number.MAX_SAFE_INTEGER,

        monthlyUsedTokens:
          Number.MAX_SAFE_INTEGER
      }
    ),

    "ai_budget_counter_overflow"
  );
});


/*
 * TEST 16
 */

test("R2.8C4 rejects invalid clock", () => {
  const fx = fixture({
    now: () => NaN
  });

  denied(
    fx.evaluate(),

    "invalid_ai_budget_clock"
  );
});


/*
 * TEST 17
 */

test("R2.8C4 rejects accessor and hidden properties", () => {
  const fx = fixture();

  let getterCalled = false;

  const input = {
    accountId: ACCOUNT,

    inputTokens: 100,

    maxOutputTokens: 200,

    usage: fx.usage
  };

  Object.defineProperty(
    input,

    "inputTokens",

    {
      enumerable: true,

      get() {
        getterCalled = true;

        return 100;
      }
    }
  );

  denied(
    fx.budget.evaluate(input),

    "invalid_ai_budget_request"
  );

  assert.equal(
    getterCalled,

    false
  );

  const usage = {
    ...fx.usage
  };

  Object.defineProperty(
    usage,

    "hidden",

    {
      value: true,

      enumerable: false
    }
  );

  denied(
    fx.evaluate({ usage }),

    "invalid_ai_budget_usage"
  );
});


/*
 * TEST 18
 */

test("R2.8C4 maintains immutable policy and limits", () => {
  const limits = {
    ...AI_BUDGET_LIMITS
  };

  const fx = fixture({
    limits
  });

  limits.dailyTokens = 999999999;

  assert.equal(
    fx.budget.getLimits().dailyTokens,

    50000
  );

  assert.equal(
    Object.isFrozen(
      fx.budget.getLimits()
    ),

    true
  );

  const policy = fx.budget.getPolicy();

  assert.equal(
    policy.accountScoped,

    true
  );

  assert.equal(
    policy.characterSwitchResetsBudget,

    false
  );

  assert.equal(
    policy.atomicReservationEnabled,

    false
  );

  assert.equal(
    policy.providerDispatchAuthorized,

    false
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

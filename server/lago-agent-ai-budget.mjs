import {
  validAccountId
} from "./lago-agent-memory-contract.mjs";

/*
 * LAGO GAME
 * R2.8C4 — AI TOKEN BUDGET ENGINE
 *
 * Deterministic account-level quota evaluation.
 * Server-controlled limits.
 * UTC usage windows.
 * Integer-safe accounting.
 * Fail-closed validation.
 *
 * No persistent storage.
 * No atomic reservation.
 * No provider dispatch.
 * No payment authorization.
 * No trading execution.
 */

export const AI_BUDGET_VERSION = 1;

export const AI_BUDGET_LIMITS = Object.freeze({
  dailyTokens: 50000,
  monthlyTokens: 1000000,

  dailyRequests: 100,

  maxInputTokens: 4096,
  maxOutputTokens: 1024
});

const POLICY = Object.freeze({
  accountScoped: true,

  characterScoped: false,

  characterSwitchResetsBudget: false,

  clientLimitsTrusted: false,

  clientUsageTrusted: false,

  serverUsageRequired: true,

  utcDailyWindows: true,

  utcMonthlyWindows: true,

  inputAndOutputCounted: true,

  maximumOutputReservedInEstimate: true,

  pendingReservationsCounted: true,

  persistentStorageEnabled: false,

  atomicReservationEnabled: false,

  providerDispatchAuthorized: false,

  tradingAuthorized: false,

  failClosed: true
});


/*
 * VALIDATION
 */

function exactFields(value, fields) {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    return false;
  }

  const proto =
    Object.getPrototypeOf(value);

  if (
    proto !== Object.prototype &&
    proto !== null
  ) {
    return false;
  }

  if (
    Reflect.ownKeys(value).length !==
      fields.length
  ) {
    return false;
  }

  return fields.every(field => {
    const descriptor =
      Object.getOwnPropertyDescriptor(
        value,
        field
      );

    return Boolean(
      descriptor &&
      Object.hasOwn(
        descriptor,
        "value"
      )
    );
  });
}

function validCounter(value) {
  return (
    Number.isSafeInteger(value) &&
    value >= 0
  );
}

function validPositive(value) {
  return (
    Number.isSafeInteger(value) &&
    value > 0
  );
}

function safeAdd(...values) {
  let total = 0;

  for (const value of values) {
    if (!validCounter(value)) {
      return null;
    }

    total += value;

    if (!Number.isSafeInteger(total)) {
      return null;
    }
  }

  return total;
}

function validTimestamp(value) {
  if (
    !Number.isSafeInteger(value)
  ) {
    return false;
  }

  const date = new Date(value);

  return (
    Number.isFinite(date.getTime()) &&
    date.getUTCFullYear() >= 2000 &&
    date.getUTCFullYear() <= 9998
  );
}


/*
 * UTC USAGE WINDOWS
 */

export function getAIBudgetWindows(now) {
  if (!validTimestamp(now)) {
    return null;
  }

  const date = new Date(now);

  const year = date.getUTCFullYear();

  const month = date.getUTCMonth();

  const day = date.getUTCDate();

  return Object.freeze({
    dailyKey:
      date.toISOString().slice(0, 10),

    monthlyKey:
      date.toISOString().slice(0, 7),

    dailyResetAt:
      new Date(
        Date.UTC(
          year,
          month,
          day + 1
        )
      ).toISOString(),

    monthlyResetAt:
      new Date(
        Date.UTC(
          year,
          month + 1,
          1
        )
      ).toISOString()
  });
}


/*
 * VALIDATE TRUSTED LIMITS
 */

function normalizeLimits(limits) {
  if (
    !exactFields(limits, [
      "dailyTokens",
      "monthlyTokens",
      "dailyRequests",
      "maxInputTokens",
      "maxOutputTokens"
    ])
  ) {
    return null;
  }

  for (const value of Object.values(limits)) {
    if (!validPositive(value)) {
      return null;
    }
  }

  if (
    limits.dailyTokens >
      limits.monthlyTokens ||

    limits.maxInputTokens >
      AI_BUDGET_LIMITS.maxInputTokens ||

    limits.maxOutputTokens >
      AI_BUDGET_LIMITS.maxOutputTokens
  ) {
    return null;
  }

  return Object.freeze({
    ...limits
  });
}


/*
 * TRUSTED USAGE SNAPSHOT
 */

const USAGE_FIELDS = Object.freeze([
  "accountId",

  "dailyKey",
  "monthlyKey",

  "dailyUsedTokens",
  "monthlyUsedTokens",

  "dailyReservedTokens",
  "monthlyReservedTokens",

  "dailyRequests",
  "dailyReservedRequests"
]);

export function createEmptyAIBudgetUsage({
  accountId,
  now
} = {}) {
  if (!validAccountId(accountId)) {
    return null;
  }

  const windows =
    getAIBudgetWindows(now);

  if (!windows) {
    return null;
  }

  return Object.freeze({
    accountId,

    dailyKey:
      windows.dailyKey,

    monthlyKey:
      windows.monthlyKey,

    dailyUsedTokens: 0,
    monthlyUsedTokens: 0,

    dailyReservedTokens: 0,
    monthlyReservedTokens: 0,

    dailyRequests: 0,
    dailyReservedRequests: 0
  });
}

function normalizeUsage(
  usage,
  accountId,
  windows
) {
  if (
    !exactFields(
      usage,
      USAGE_FIELDS
    ) ||

    usage.accountId !== accountId ||

    usage.dailyKey !==
      windows.dailyKey ||

    usage.monthlyKey !==
      windows.monthlyKey
  ) {
    return null;
  }

  for (const field of USAGE_FIELDS.slice(3)) {
    if (!validCounter(usage[field])) {
      return null;
    }
  }

  if (
    usage.dailyUsedTokens >
      usage.monthlyUsedTokens ||

    usage.dailyReservedTokens >
      usage.monthlyReservedTokens
  ) {
    return null;
  }

  return Object.freeze({
    ...usage
  });
}


/*
 * SAFE REJECTION
 */

function reject(reason) {
  return Object.freeze({
    ok: false,

    version:
      AI_BUDGET_VERSION,

    allowed: false,

    accountId: null,

    estimatedTokens: null,

    remainingDailyTokens: null,

    remainingMonthlyTokens: null,

    remainingDailyRequests: null,

    windows: null,

    reservationCreated: false,

    providerDispatchAuthorized: false,

    tradingAuthorized: false,

    reason
  });
}


/*
 * BUDGET ENGINE
 */

export function createLagoAIBudget({
  limits = AI_BUDGET_LIMITS,

  now = () => Date.now()
} = {}) {
  const configuredLimits =
    normalizeLimits(limits);

  if (!configuredLimits) {
    throw new Error(
      "invalid_ai_budget_limits"
    );
  }

  if (typeof now !== "function") {
    throw new Error(
      "invalid_ai_budget_clock"
    );
  }


  function evaluate(input) {
    try {
      if (
        !exactFields(input, [
          "accountId",
          "inputTokens",
          "maxOutputTokens",
          "usage"
        ])
      ) {
        return reject(
          "invalid_ai_budget_request"
        );
      }

      const {
        accountId,
        inputTokens,
        maxOutputTokens,
        usage
      } = input;

      if (!validAccountId(accountId)) {
        return reject(
          "invalid_ai_budget_account"
        );
      }

      if (
        !validPositive(inputTokens) ||

        inputTokens >
          configuredLimits.maxInputTokens ||

        !validPositive(maxOutputTokens) ||

        maxOutputTokens >
          configuredLimits.maxOutputTokens
      ) {
        return reject(
          "ai_request_token_limit_exceeded"
        );
      }

      const windows =
        getAIBudgetWindows(now());

      if (!windows) {
        return reject(
          "invalid_ai_budget_clock"
        );
      }

      const current = normalizeUsage(
        usage,
        accountId,
        windows
      );

      if (!current) {
        return reject(
          "invalid_ai_budget_usage"
        );
      }

      const estimatedTokens = safeAdd(
        inputTokens,
        maxOutputTokens
      );

      const dailyTotal = safeAdd(
        current.dailyUsedTokens,

        current.dailyReservedTokens,

        estimatedTokens
      );

      const monthlyTotal = safeAdd(
        current.monthlyUsedTokens,

        current.monthlyReservedTokens,

        estimatedTokens
      );

      const requestTotal = safeAdd(
        current.dailyRequests,

        current.dailyReservedRequests,

        1
      );

      if (
        estimatedTokens === null ||
        dailyTotal === null ||
        monthlyTotal === null ||
        requestTotal === null
      ) {
        return reject(
          "ai_budget_counter_overflow"
        );
      }

      if (
        requestTotal >
          configuredLimits.dailyRequests
      ) {
        return reject(
          "ai_daily_request_quota_exceeded"
        );
      }

      if (
        dailyTotal >
          configuredLimits.dailyTokens
      ) {
        return reject(
          "ai_daily_token_budget_exceeded"
        );
      }

      if (
        monthlyTotal >
          configuredLimits.monthlyTokens
      ) {
        return reject(
          "ai_monthly_token_budget_exceeded"
        );
      }

      return Object.freeze({
        ok: true,

        version:
          AI_BUDGET_VERSION,

        allowed: true,

        accountId,

        estimatedTokens,

        remainingDailyTokens:
          configuredLimits.dailyTokens -
          dailyTotal,

        remainingMonthlyTokens:
          configuredLimits.monthlyTokens -
          monthlyTotal,

        remainingDailyRequests:
          configuredLimits.dailyRequests -
          requestTotal,

        windows,

        reservationCreated: false,

        providerDispatchAuthorized: false,

        tradingAuthorized: false,

        reason: null
      });

    } catch {
      return reject(
        "ai_budget_unavailable"
      );
    }
  }


  return Object.freeze({
    version:
      AI_BUDGET_VERSION,

    evaluate,

    getLimits() {
      return configuredLimits;
    },

    getPolicy() {
      return POLICY;
    }
  });
}

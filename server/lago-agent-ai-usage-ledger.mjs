import { DatabaseSync } from "node:sqlite";

import {
  mkdirSync, realpathSync, lstatSync,
  openSync, closeSync
} from "node:fs";

import {
  resolve, join, sep, isAbsolute
} from "node:path";

import {
  validAccountId
} from "./lago-agent-memory-contract.mjs";

import {
  getAIBudgetWindows
} from "./lago-agent-ai-budget.mjs";

/*
 * LAGO GAME
 * R2.8C4A — PERSISTENT AI USAGE LEDGER
 *
 * Trusted completed usage only.
 * No reservation, provider dispatch
 * or payment authorization.
 */

export const AI_USAGE_LEDGER_VERSION = 1;

const MAX = Number.MAX_SAFE_INTEGER;

const POLICY = Object.freeze({
  storage: "sqlite",
  accountScoped: true,
  privateDirectoryRequired: true,
  idempotentUsageRecording: true,
  utcWindows: true,
  atomicReservationEnabled: false,
  providerDispatchAuthorized: false,
  tradingAuthorized: false
});


/*
 * PRIVATE DATABASE LOCATION
 */

function inside(parent, target) {
  return target === parent ||
    target.startsWith(
      parent.endsWith(sep)
        ? parent
        : parent + sep
    );
}

function privatePath(directory, projectRoot) {
  if (
    typeof directory !== "string" ||
    typeof projectRoot !== "string" ||
    !isAbsolute(directory) ||
    !isAbsolute(projectRoot)
  ) {
    throw new Error(
      "absolute_ai_usage_paths_required"
    );
  }

  const root = realpathSync(projectRoot);

  const requested = resolve(directory);

  if (
    inside(resolve(projectRoot), requested) ||
    inside(root, requested)
  ) {
    throw new Error(
      "ai_usage_directory_inside_project"
    );
  }

  mkdirSync(requested, {
    recursive: true,
    mode: 0o700
  });

  const dir = realpathSync(requested);

  if (inside(root, dir)) {
    throw new Error(
      "ai_usage_directory_inside_project"
    );
  }

  const d = lstatSync(dir);

  if (
    !d.isDirectory() ||
    (
      process.platform !== "win32" &&
      (d.mode & 0o077) !== 0
    )
  ) {
    throw new Error(
      "insecure_ai_usage_directory"
    );
  }

  const file = join(
    dir,
    "lago-ai-usage.sqlite"
  );

  try {
    closeSync(
      openSync(file, "wx", 0o600)
    );
  } catch (error) {
    if (error?.code !== "EEXIST") {
      throw error;
    }
  }

  const f = lstatSync(file);

  if (
    !f.isFile() ||
    f.isSymbolicLink() ||
    f.nlink !== 1 ||
    (
      process.platform !== "win32" &&
      (f.mode & 0o077) !== 0
    )
  ) {
    throw new Error(
      "insecure_ai_usage_database"
    );
  }

  return file;
}


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

  return (
    (
      proto === Object.prototype ||
      proto === null
    ) &&
    Reflect.ownKeys(value).length ===
      fields.length &&
    fields.every(field =>
      Object.hasOwn(
        Object.getOwnPropertyDescriptor(
          value,
          field
        ) ?? {},
        "value"
      )
    )
  );
}

function counter(value) {
  return (
    Number.isSafeInteger(value) &&
    value >= 0
  );
}

function validRequestId(value) {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
      .test(value)
  );
}

function reject(reason) {
  return Object.freeze({
    ok: false,
    version: AI_USAGE_LEDGER_VERSION,

    recorded: false,
    duplicate: false,
    usage: null,

    providerDispatchAuthorized: false,
    tradingAuthorized: false,

    reason
  });
}


/*
 * LEDGER FACTORY
 */

export function createLagoAIUsageLedger({
  directory,
  projectRoot,
  now = () => Date.now()
} = {}) {
  if (typeof now !== "function") {
    throw new Error(
      "invalid_ai_usage_clock"
    );
  }

  const db = new DatabaseSync(
    privatePath(directory, projectRoot)
  );

  let closed = false;

  let find, insert, latest, aggregate;

  try {
    db.exec(`
      PRAGMA busy_timeout = 5000;
      PRAGMA journal_mode = DELETE;
      PRAGMA synchronous = FULL;
    `);

    db.exec("BEGIN IMMEDIATE");

    try {
      const version = db.prepare(
        "PRAGMA user_version"
      ).get().user_version;

      if (
        version !== 0 &&
        version !== AI_USAGE_LEDGER_VERSION
      ) {
        throw new Error(
          "unsupported_ai_usage_schema"
        );
      }

      if (version === 0) {
        db.exec(`
          CREATE TABLE ai_usage_events (

            request_id
              TEXT PRIMARY KEY NOT NULL,

            account_id
              TEXT NOT NULL,

            recorded_at_ms
              INTEGER NOT NULL,

            input_tokens
              INTEGER NOT NULL
              CHECK(
                input_tokens BETWEEN 0 AND ${MAX}
              ),

            output_tokens
              INTEGER NOT NULL
              CHECK(
                output_tokens BETWEEN 0 AND ${MAX}
              ),

            CHECK(
              input_tokens + output_tokens
                BETWEEN 1 AND ${MAX}
            )

          ) STRICT;

          CREATE INDEX ai_usage_account_time_idx
            ON ai_usage_events(
              account_id,
              recorded_at_ms
            );

          PRAGMA user_version = 1;
        `);
      }

      db.exec("COMMIT");

    } catch (error) {
      db.exec("ROLLBACK");

      throw error;
    }

    find = db.prepare(`
      SELECT *
      FROM ai_usage_events
      WHERE request_id = ?
    `);

    insert = db.prepare(`
      INSERT INTO ai_usage_events (
        request_id,
        account_id,
        recorded_at_ms,
        input_tokens,
        output_tokens
      )
      VALUES (?, ?, ?, ?, ?)
    `);

    latest = db.prepare(`
      SELECT MAX(recorded_at_ms) AS last_time
      FROM ai_usage_events
      WHERE account_id = ?
    `);

    aggregate = db.prepare(`
      SELECT

        COALESCE(
          SUM(
            CASE WHEN recorded_at_ms >= ?
              THEN input_tokens + output_tokens
              ELSE 0
            END
          ), 0
        ) AS daily_tokens,

        COALESCE(
          SUM(input_tokens + output_tokens),
          0
        ) AS monthly_tokens,

        COALESCE(
          SUM(
            CASE WHEN recorded_at_ms >= ?
              THEN 1 ELSE 0
            END
          ), 0
        ) AS daily_requests

      FROM ai_usage_events

      WHERE account_id = ?
        AND recorded_at_ms >= ?
        AND recorded_at_ms < ?
    `);

  } catch (error) {
    db.close();

    throw error;
  }


  /*
   * IMMUTABLE EVENT RESULT
   */

  function eventResult(row, duplicate) {
    return Object.freeze({
      ok: true,
      version: AI_USAGE_LEDGER_VERSION,

      recorded: true,
      duplicate,

      requestId: row.request_id,
      accountId: row.account_id,

      recordedAt:
        new Date(
          row.recorded_at_ms
        ).toISOString(),

      inputTokens: row.input_tokens,
      outputTokens: row.output_tokens,

      totalTokens:
        row.input_tokens +
        row.output_tokens,

      providerDispatchAuthorized: false,
      tradingAuthorized: false,

      reason: null
    });
  }


  /*
   * RECORD TRUSTED USAGE
   *
   * Internal server API only.
   * Never accept these counters
   * directly from a browser.
   */

  function recordUsage(input) {
    if (closed) {
      return reject(
        "ai_usage_ledger_closed"
      );
    }

    try {
      if (
        !exactFields(input, [
          "requestId",
          "accountId",
          "inputTokens",
          "outputTokens"
        ])
      ) {
        return reject(
          "invalid_ai_usage_request"
        );
      }

      const {
        requestId,
        accountId,
        inputTokens,
        outputTokens
      } = input;

      if (
        !validRequestId(requestId) ||
        !validAccountId(accountId) ||
        !counter(inputTokens) ||
        !counter(outputTokens) ||
        !counter(inputTokens + outputTokens) ||
        inputTokens + outputTokens === 0
      ) {
        return reject(
          "invalid_ai_usage_request"
        );
      }

      db.exec("BEGIN IMMEDIATE");

      let committed = false;

      try {
        const existing = find.get(requestId);

        if (existing) {
          if (
            existing.account_id !== accountId ||
            existing.input_tokens !== inputTokens ||
            existing.output_tokens !== outputTokens
          ) {
            return reject(
              "ai_usage_request_conflict"
            );
          }

          return eventResult(existing, true);
        }

        const timestamp = now();

        if (!getAIBudgetWindows(timestamp)) {
          return reject(
            "invalid_ai_usage_clock"
          );
        }

        const last =
          latest.get(accountId).last_time;

        if (
          last !== null &&
          timestamp < last
        ) {
          return reject(
            "ai_usage_clock_regressed"
          );
        }

        insert.run(
          requestId,
          accountId,
          timestamp,
          inputTokens,
          outputTokens
        );

        const result = eventResult(
          find.get(requestId),
          false
        );

        db.exec("COMMIT");

        committed = true;

        return result;

      } finally {
        if (!committed) {
          db.exec("ROLLBACK");
        }
      }

    } catch {
      return reject(
        "ai_usage_ledger_unavailable"
      );
    }
  }


  /*
   * BUDGET-COMPATIBLE USAGE SNAPSHOT
   */

  function getUsage(accountId) {
    if (closed) {
      return reject(
        "ai_usage_ledger_closed"
      );
    }

    if (!validAccountId(accountId)) {
      return reject(
        "invalid_ai_usage_account"
      );
    }

    try {
      db.exec("BEGIN");

      try {
        const timestamp = now();

        const windows =
          getAIBudgetWindows(timestamp);

        if (!windows) {
          return reject(
            "invalid_ai_usage_clock"
          );
        }

        const last =
          latest.get(accountId).last_time;

        if (
          last !== null &&
          timestamp < last
        ) {
          return reject(
            "ai_usage_clock_regressed"
          );
        }

        const dayStart = Date.parse(
          windows.dailyKey +
          "T00:00:00.000Z"
        );

        const monthStart = Date.parse(
          windows.monthlyKey +
          "-01T00:00:00.000Z"
        );

        const row = aggregate.get(
          dayStart,
          dayStart,
          accountId,
          monthStart,
          Date.parse(windows.monthlyResetAt)
        );

        if (
          ![
            row.daily_tokens,
            row.monthly_tokens,
            row.daily_requests
          ].every(counter)
        ) {
          return reject(
            "ai_usage_counter_overflow"
          );
        }

        const usage = Object.freeze({
          accountId,

          dailyKey: windows.dailyKey,
          monthlyKey: windows.monthlyKey,

          dailyUsedTokens:
            row.daily_tokens,

          monthlyUsedTokens:
            row.monthly_tokens,

          dailyReservedTokens: 0,
          monthlyReservedTokens: 0,

          dailyRequests:
            row.daily_requests,

          dailyReservedRequests: 0
        });

        return Object.freeze({
          ok: true,
          version: AI_USAGE_LEDGER_VERSION,

          usage,

          providerDispatchAuthorized: false,
          tradingAuthorized: false,

          reason: null
        });

      } finally {
        db.exec("ROLLBACK");
      }

    } catch {
      return reject(
        "ai_usage_ledger_unavailable"
      );
    }
  }


  /*
   * SHUTDOWN
   */

  function close() {
    if (!closed) {
      db.close();

      closed = true;
    }
  }

  return Object.freeze({
    version: AI_USAGE_LEDGER_VERSION,

    recordUsage,
    getUsage,
    close,

    getPolicy: () => POLICY
  });
}

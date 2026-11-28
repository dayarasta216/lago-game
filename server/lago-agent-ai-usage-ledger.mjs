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
  AI_BUDGET_LIMITS,
  createLagoAIBudget,
  getAIBudgetWindows
} from "./lago-agent-ai-budget.mjs";


/*
 * LAGO GAME
 * R2.8C5 — ATOMIC AI USAGE RESERVATION
 *
 * Persistent completed usage.
 * Atomic account-level reservations.
 * SQLite schema migration.
 * Cross-window reservation protection.
 *
 * No provider dispatch.
 * No automatic reservation release.
 * No settlement.
 * No trading execution.
 */

export const AI_USAGE_LEDGER_VERSION = 1;

const SCHEMA_VERSION = 2;

const MAX = Number.MAX_SAFE_INTEGER;

const POLICY = Object.freeze({
  storage: "sqlite",
  accountScoped: true,
  privateDirectoryRequired: true,
  idempotentUsageRecording: true,
  utcWindows: true,

  atomicReservationEnabled: true,

  pendingReservationsCarryAcrossWindows: true,

  automaticReservationRelease: false,

  settlementEnabled: false,

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
  return Number.isSafeInteger(value) &&
    value >= 0;
}

function validRequestId(value) {
  return typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
      .test(value);
}

function reject(reason) {
  return Object.freeze({
    ok: false,

    version:
      AI_USAGE_LEDGER_VERSION,

    recorded: false,

    reserved: false,

    reservationCreated: false,

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

  limits = AI_BUDGET_LIMITS,

  now = () => Date.now()

} = {}) {

  if (typeof now !== "function") {
    throw new Error(
      "invalid_ai_usage_clock"
    );
  }

  const configuredLimits =
    createLagoAIBudget({
      limits
    }).getLimits();

  const db = new DatabaseSync(
    privatePath(
      directory,
      projectRoot
    )
  );

  let closed = false;

  let find, insert, latest, aggregate;

  let findReservation,
    insertReservation,
    pending;


  /*
   * SYNCHRONOUS SQLITE TRANSACTION
   */

  function transaction(mode, operation) {
    db.exec(mode);

    let committed = false;

    try {
      const result = operation();

      db.exec("COMMIT");

      committed = true;

      return result;

    } finally {
      if (!committed) {
        db.exec("ROLLBACK");
      }
    }
  }


  /*
   * DATABASE INITIALIZATION
   * SCHEMA V1 -> V2 MIGRATION
   */

  try {
    db.exec(`
      PRAGMA busy_timeout = 5000;
      PRAGMA journal_mode = DELETE;
      PRAGMA synchronous = FULL;
    `);

    transaction("BEGIN IMMEDIATE", () => {
      const version = db.prepare(
        "PRAGMA user_version"
      ).get().user_version;

      if (
        ![0, 1, SCHEMA_VERSION]
          .includes(version)
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
        `);
      }

      if (version < SCHEMA_VERSION) {
        db.exec(`
          CREATE TABLE ai_usage_reservations (

            request_id
              TEXT PRIMARY KEY NOT NULL,

            account_id
              TEXT NOT NULL,

            reserved_at_ms
              INTEGER NOT NULL,

            input_tokens
              INTEGER NOT NULL
              CHECK(
                input_tokens BETWEEN 1 AND 4096
              ),

            max_output_tokens
              INTEGER NOT NULL
              CHECK(
                max_output_tokens BETWEEN 1 AND 1024
              )

          ) STRICT;

          CREATE INDEX ai_usage_reservations_account_idx
            ON ai_usage_reservations(
              account_id
            );

          PRAGMA user_version = 2;
        `);
      }
    });


    /*
     * PREPARED STATEMENTS
     */

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

    findReservation = db.prepare(`
      SELECT *
      FROM ai_usage_reservations
      WHERE request_id = ?
    `);

    insertReservation = db.prepare(`
      INSERT INTO ai_usage_reservations (
        request_id,
        account_id,
        reserved_at_ms,
        input_tokens,
        max_output_tokens
      )
      VALUES (?, ?, ?, ?, ?)
    `);

    pending = db.prepare(`
      SELECT

        COALESCE(
          SUM(
            input_tokens + max_output_tokens
          ), 0
        ) AS tokens,

        COUNT(*) AS requests,

        MAX(reserved_at_ms) AS last_time

      FROM ai_usage_reservations
      WHERE account_id = ?
    `);

  } catch (error) {
    db.close();

    throw error;
  }


  /*
   * CONSISTENT USAGE SNAPSHOT
   *
   * Must run inside a transaction.
   *
   * All unresolved reservations count
   * against both UTC usage windows.
   */

  function readUsage(accountId, timestamp) {
    const windows =
      getAIBudgetWindows(timestamp);

    if (!windows) {
      return reject(
        "invalid_ai_usage_clock"
      );
    }

    const last =
      latest.get(accountId).last_time;

    const held =
      pending.get(accountId);

    if (
      (
        last !== null &&
        timestamp < last
      ) ||
      (
        held.last_time !== null &&
        timestamp < held.last_time
      )
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
        row.daily_requests,
        held.tokens,
        held.requests
      ].every(counter)
    ) {
      return reject(
        "ai_usage_counter_overflow"
      );
    }

    const usage = Object.freeze({
      accountId,

      dailyKey:
        windows.dailyKey,

      monthlyKey:
        windows.monthlyKey,

      dailyUsedTokens:
        row.daily_tokens,

      monthlyUsedTokens:
        row.monthly_tokens,

      dailyReservedTokens:
        held.tokens,

      monthlyReservedTokens:
        held.tokens,

      dailyRequests:
        row.daily_requests,

      dailyReservedRequests:
        held.requests
    });

    return Object.freeze({
      ok: true,

      version:
        AI_USAGE_LEDGER_VERSION,

      usage,

      providerDispatchAuthorized: false,

      tradingAuthorized: false,

      reason: null
    });
  }


  /*
   * IMMUTABLE COMPLETED EVENT
   */

  function eventResult(row, duplicate) {
    return Object.freeze({
      ok: true,

      version:
        AI_USAGE_LEDGER_VERSION,

      recorded: true,

      duplicate,

      requestId:
        row.request_id,

      accountId:
        row.account_id,

      recordedAt:
        new Date(
          row.recorded_at_ms
        ).toISOString(),

      inputTokens:
        row.input_tokens,

      outputTokens:
        row.output_tokens,

      totalTokens:
        row.input_tokens +
        row.output_tokens,

      providerDispatchAuthorized: false,

      tradingAuthorized: false,

      reason: null
    });
  }


  /*
   * IMMUTABLE RESERVATION RESULT
   */

  function reservationResult(row, duplicate) {
    return Object.freeze({
      ok: true,

      version:
        AI_USAGE_LEDGER_VERSION,

      reserved: true,

      reservationCreated:
        !duplicate,

      duplicate,

      requestId:
        row.request_id,

      accountId:
        row.account_id,

      reservedAt:
        new Date(
          row.reserved_at_ms
        ).toISOString(),

      inputTokens:
        row.input_tokens,

      maxOutputTokens:
        row.max_output_tokens,

      estimatedTokens:
        row.input_tokens +
        row.max_output_tokens,

      providerDispatchAuthorized: false,

      tradingAuthorized: false,

      reason: null
    });
  }


  /*
   * LEGACY COMPLETED USAGE RECORDING
   *
   * Cannot settle a reserved request.
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

      return transaction(
        "BEGIN IMMEDIATE",

        () => {
          if (
            findReservation.get(requestId)
          ) {
            return reject(
              "ai_usage_request_reserved"
            );
          }

          const existing =
            find.get(requestId);

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

            return eventResult(
              existing,
              true
            );
          }

          const timestamp = now();

          if (
            !getAIBudgetWindows(timestamp)
          ) {
            return reject(
              "invalid_ai_usage_clock"
            );
          }

          const last =
            latest.get(accountId).last_time;

          const lastHeld =
            pending.get(accountId).last_time;

          if (
            (
              last !== null &&
              timestamp < last
            ) ||
            (
              lastHeld !== null &&
              timestamp < lastHeld
            )
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

          return eventResult(
            find.get(requestId),
            false
          );
        }
      );

    } catch {
      return reject(
        "ai_usage_ledger_unavailable"
      );
    }
  }


  /*
   * PUBLIC INTERNAL USAGE SNAPSHOT
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
      return transaction(
        "BEGIN",

        () => readUsage(
          accountId,
          now()
        )
      );

    } catch {
      return reject(
        "ai_usage_ledger_unavailable"
      );
    }
  }


  /*
   * ATOMIC USAGE RESERVATION
   *
   * Trusted server-side requests only.
   *
   * No external operations or await
   * while the write lock is held.
   */

  function reserveUsage(input) {
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
          "maxOutputTokens"
        ])
      ) {
        return reject(
          "invalid_ai_reservation_request"
        );
      }

      const {
        requestId,
        accountId,
        inputTokens,
        maxOutputTokens
      } = input;

      if (
        !validRequestId(requestId) ||
        !validAccountId(accountId) ||

        !counter(inputTokens) ||
        !counter(maxOutputTokens) ||

        inputTokens === 0 ||
        maxOutputTokens === 0 ||

        inputTokens >
          AI_BUDGET_LIMITS.maxInputTokens ||

        maxOutputTokens >
          AI_BUDGET_LIMITS.maxOutputTokens
      ) {
        return reject(
          "invalid_ai_reservation_request"
        );
      }

      return transaction(
        "BEGIN IMMEDIATE",

        () => {
          if (find.get(requestId)) {
            return reject(
              "ai_usage_request_conflict"
            );
          }

          const timestamp = now();

          const snapshot = readUsage(
            accountId,
            timestamp
          );

          if (!snapshot.ok) {
            return snapshot;
          }

          const existing =
            findReservation.get(requestId);

          if (existing) {
            if (
              existing.account_id !== accountId ||

              existing.input_tokens !==
                inputTokens ||

              existing.max_output_tokens !==
                maxOutputTokens
            ) {
              return reject(
                "ai_usage_request_conflict"
              );
            }

            return reservationResult(
              existing,
              true
            );
          }

          /*
           * Evaluate budget from the
           * transaction-protected snapshot.
           */

          const decision =
            createLagoAIBudget({
              limits: configuredLimits,

              now: () => timestamp

            }).evaluate({
              accountId,
              inputTokens,
              maxOutputTokens,

              usage: snapshot.usage
            });

          if (
            !decision.ok ||
            !decision.allowed
          ) {
            return reject(
              decision.reason
            );
          }

          /*
           * Insert before releasing
           * the exclusive write reservation.
           */

          insertReservation.run(
            requestId,
            accountId,
            timestamp,
            inputTokens,
            maxOutputTokens
          );

          return reservationResult(
            findReservation.get(requestId),
            false
          );
        }
      );

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


  /*
   * INTERNAL SERVER API
   */

  return Object.freeze({
    version:
      AI_USAGE_LEDGER_VERSION,

    recordUsage,

    getUsage,

    reserveUsage,

    close,

    getPolicy: () => POLICY
  });
}

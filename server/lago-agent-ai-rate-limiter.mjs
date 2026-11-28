import { DatabaseSync } from "node:sqlite";

import { randomUUID } from "node:crypto";

import {
  mkdirSync,
  realpathSync,
  lstatSync,
  openSync,
  closeSync
} from "node:fs";

import {
  resolve,
  relative,
  join,
  sep,
  isAbsolute
} from "node:path";

import {
  validAccountId
} from "./lago-agent-memory-contract.mjs";


/*
 * LAGO GAME
 * R2.8C6C2 — PERSISTENT AI RATE LIMITER
 *
 * Sliding rate windows.
 * Account and global request limits.
 * Atomic concurrency claims.
 * Persistent restart protection.
 * Server-generated request identifiers.
 *
 * No provider dispatch authorization.
 * No automatic release of active claims.
 * No trading authorization.
 */

export const AI_RATE_LIMITER_VERSION = 1;

const MINUTE = 60000;

const HOUR = 3600000;

export const AI_RATE_LIMITS = Object.freeze({
  accountPerMinute: 6,

  accountPerHour: 60,

  accountMaxActive: 1,

  globalPerMinute: 120,

  globalPerHour: 1200,

  globalMaxActive: 16
});

const POLICY = Object.freeze({
  storage: "sqlite",

  accountScoped: true,

  globalLimitsEnabled: true,

  slidingWindows: true,

  atomicAdmission: true,

  persistentActiveClaims: true,

  automaticClaimExpiry: false,

  serverGeneratedRequestIds: true,

  clientLimitsTrusted: false,

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

function normalizeLimits(value) {
  const fields =
    Object.keys(AI_RATE_LIMITS);

  if (!exactFields(value, fields)) {
    throw new Error(
      "invalid_ai_rate_limits"
    );
  }

  const limits = {};

  for (const field of fields) {
    const n = value[field];

    if (
      !Number.isSafeInteger(n) ||
      n < 1 ||
      n > 1000000
    ) {
      throw new Error(
        "invalid_ai_rate_limits"
      );
    }

    limits[field] = n;
  }

  if (
    limits.accountPerMinute >
      limits.accountPerHour ||

    limits.globalPerMinute >
      limits.globalPerHour ||

    limits.accountPerMinute >
      limits.globalPerMinute ||

    limits.accountPerHour >
      limits.globalPerHour ||

    limits.accountMaxActive >
      limits.globalMaxActive
  ) {
    throw new Error(
      "invalid_ai_rate_limits"
    );
  }

  return Object.freeze(limits);
}

function validClock(value) {
  if (!Number.isSafeInteger(value)) {
    return false;
  }

  const date = new Date(value);

  return (
    Number.isFinite(date.getTime()) &&
    date.getUTCFullYear() >= 2000 &&
    date.getUTCFullYear() <= 9998
  );
}

function validRequestId(value) {
  return (
    typeof value === "string" &&

    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
      .test(value)
  );
}

function validDirectory(value) {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.trim() === value &&
    !value.includes("\0") &&
    isAbsolute(value)
  );
}

function inside(parent, target) {
  const path = relative(parent, target);

  return (
    path === "" ||

    (
      path !== ".." &&
      !path.startsWith(".." + sep) &&
      !isAbsolute(path)
    )
  );
}


/*
 * PRIVATE STORAGE
 */

function preparePath(directory, projectRoot) {
  if (
    !validDirectory(directory) ||
    !validDirectory(projectRoot)
  ) {
    throw new Error(
      "absolute_ai_rate_paths_required"
    );
  }

  const root =
    realpathSync(projectRoot);

  const requested =
    resolve(directory);

  if (
    inside(resolve(projectRoot), requested) ||
    inside(root, requested)
  ) {
    throw new Error(
      "ai_rate_directory_inside_project"
    );
  }

  mkdirSync(requested, {
    recursive: true,
    mode: 0o700
  });

  const entry = lstatSync(requested);

  if (
    !entry.isDirectory() ||
    entry.isSymbolicLink()
  ) {
    throw new Error(
      "insecure_ai_rate_directory"
    );
  }

  const dir =
    realpathSync(requested);

  if (inside(root, dir)) {
    throw new Error(
      "ai_rate_directory_inside_project"
    );
  }

  if (
    process.platform !== "win32" &&
    (lstatSync(dir).mode & 0o077) !== 0
  ) {
    throw new Error(
      "insecure_ai_rate_directory"
    );
  }

  const file = join(
    dir,
    "lago-ai-rate.sqlite"
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

  const info = lstatSync(file);

  if (
    !info.isFile() ||
    info.isSymbolicLink() ||
    info.nlink !== 1 ||

    (
      process.platform !== "win32" &&
      (info.mode & 0o077) !== 0
    )
  ) {
    throw new Error(
      "insecure_ai_rate_database"
    );
  }

  return file;
}


/*
 * SAFE RESULT
 */

function reject(reason) {
  return Object.freeze({
    ok: false,

    version:
      AI_RATE_LIMITER_VERSION,

    admitted: false,

    released: false,

    duplicate: false,

    requestId: null,

    accountId: null,

    providerDispatchAuthorized: false,

    tradingAuthorized: false,

    reason
  });
}

function project(row, duplicate = false) {
  return Object.freeze({
    ok: true,

    version:
      AI_RATE_LIMITER_VERSION,

    requestId:
      row.request_id,

    accountId:
      row.account_id,

    admitted:
      row.released_at_ms === null,

    released:
      row.released_at_ms !== null,

    duplicate,

    acquiredAt:
      new Date(
        row.acquired_at_ms
      ).toISOString(),

    releasedAt:
      row.released_at_ms === null
        ? null
        : new Date(
            row.released_at_ms
          ).toISOString(),

    providerDispatchAuthorized: false,

    tradingAuthorized: false,

    reason: null
  });
}


/*
 * RATE LIMITER FACTORY
 */

export function createLagoAIRateLimiter({

  directory,

  projectRoot,

  limits = AI_RATE_LIMITS,

  now = () => Date.now()

} = {}) {

  const configured =
    normalizeLimits(limits);

  const configJSON =
    JSON.stringify(configured);

  if (typeof now !== "function") {
    throw new Error(
      "invalid_ai_rate_clock"
    );
  }

  const db = new DatabaseSync(
    preparePath(directory, projectRoot)
  );

  let closed = false;

  let metadata,
    updateClock,
    find,
    insert,
    finish,
    accountRate,
    globalRate,
    accountActive,
    globalActive;


  /*
   * ATOMIC SQLITE TRANSACTION
   */

  function transaction(operation) {
    db.exec("BEGIN IMMEDIATE");

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
   * DATABASE SCHEMA
   */

  try {
    db.exec(`
      PRAGMA busy_timeout = 5000;
      PRAGMA journal_mode = DELETE;
      PRAGMA synchronous = FULL;
    `);

    transaction(() => {
      const version = db.prepare(
        "PRAGMA user_version"
      ).get().user_version;

      if (
        version !== 0 &&
        version !== 1
      ) {
        throw new Error(
          "unsupported_ai_rate_schema"
        );
      }

      if (version === 0) {
        db.exec(`
          CREATE TABLE ai_rate_metadata (

            id INTEGER PRIMARY KEY
              CHECK(id = 1),

            config_json TEXT NOT NULL,

            last_ms INTEGER NOT NULL
              CHECK(last_ms >= 0)

          ) STRICT;

          CREATE TABLE ai_rate_claims (

            request_id TEXT PRIMARY KEY
              NOT NULL,

            account_id TEXT NOT NULL,

            acquired_at_ms INTEGER
              NOT NULL,

            released_at_ms INTEGER,

            CHECK (
              released_at_ms IS NULL
              OR released_at_ms >= acquired_at_ms
            )

          ) STRICT;

          CREATE INDEX ai_rate_account_time_idx
            ON ai_rate_claims (
              account_id,
              acquired_at_ms
            );

          CREATE INDEX ai_rate_global_time_idx
            ON ai_rate_claims (
              acquired_at_ms
            );

          CREATE INDEX ai_rate_active_idx
            ON ai_rate_claims (
              account_id
            )
            WHERE released_at_ms IS NULL;

          PRAGMA user_version = 1;
        `);

        db.prepare(`
          INSERT INTO ai_rate_metadata
          VALUES (1, ?, 0)
        `).run(configJSON);
      }

      const stored = db.prepare(`
        SELECT config_json
        FROM ai_rate_metadata
        WHERE id = 1
      `).get();

      /*
       * All processes using the same
       * database must use identical limits.
       */

      if (
        !stored ||
        stored.config_json !== configJSON
      ) {
        throw new Error(
          "ai_rate_configuration_mismatch"
        );
      }
    });

    metadata = db.prepare(`
      SELECT *
      FROM ai_rate_metadata
      WHERE id = 1
    `);

    updateClock = db.prepare(`
      UPDATE ai_rate_metadata
      SET last_ms = ?
      WHERE id = 1
    `);

    find = db.prepare(`
      SELECT *
      FROM ai_rate_claims
      WHERE request_id = ?
    `);

    insert = db.prepare(`
      INSERT INTO ai_rate_claims (
        request_id,
        account_id,
        acquired_at_ms,
        released_at_ms
      )
      VALUES (?, ?, ?, NULL)
    `);

    finish = db.prepare(`
      UPDATE ai_rate_claims
      SET released_at_ms = ?

      WHERE request_id = ?
        AND account_id = ?
        AND released_at_ms IS NULL
    `);

    accountRate = db.prepare(`
      SELECT COUNT(*) AS total
      FROM ai_rate_claims
      WHERE account_id = ?
        AND acquired_at_ms > ?
    `);

    globalRate = db.prepare(`
      SELECT COUNT(*) AS total
      FROM ai_rate_claims
      WHERE acquired_at_ms > ?
    `);

    accountActive = db.prepare(`
      SELECT COUNT(*) AS total
      FROM ai_rate_claims
      WHERE account_id = ?
        AND released_at_ms IS NULL
    `);

    globalActive = db.prepare(`
      SELECT COUNT(*) AS total
      FROM ai_rate_claims
      WHERE released_at_ms IS NULL
    `);

  } catch (error) {
    db.close();

    throw error;
  }


  /*
   * GLOBAL CLOCK VALIDATION
   *
   * Prevent rollback after restart
   * or between server processes.
   */

  function clock() {
    const timestamp = now();

    if (!validClock(timestamp)) {
      return {
        ok: false,
        reason: "invalid_ai_rate_clock"
      };
    }

    const stored = metadata.get();

    if (
      !stored ||
      stored.config_json !== configJSON ||
      !Number.isSafeInteger(stored.last_ms) ||
      stored.last_ms < 0
    ) {
      return {
        ok: false,
        reason: "ai_rate_integrity_failed"
      };
    }

    if (timestamp < stored.last_ms) {
      return {
        ok: false,
        reason: "ai_rate_clock_regressed"
      };
    }

    return {
      ok: true,
      timestamp
    };
  }

  function count(statement, ...args) {
    const value =
      statement.get(...args)?.total;

    if (
      !Number.isSafeInteger(value) ||
      value < 0
    ) {
      throw new Error(
        "ai_rate_counter_invalid"
      );
    }

    return value;
  }


  /*
   * ATOMIC REQUEST ADMISSION
   *
   * accountId must come from trusted
   * authenticated runtime infrastructure.
   *
   * Never expose this method directly
   * to untrusted client requests.
   */

  function acquire(input) {
    if (closed) {
      return reject(
        "ai_rate_limiter_closed"
      );
    }

    try {
      if (
        !exactFields(input, [
          "accountId"
        ]) ||

        !validAccountId(input.accountId)
      ) {
        return reject(
          "invalid_ai_rate_request"
        );
      }

      const { accountId } = input;

      return transaction(() => {
        const current = clock();

        if (!current.ok) {
          return reject(
            current.reason
          );
        }

        const timestamp =
          current.timestamp;

        if (
          count(
            accountActive,
            accountId
          ) >= configured.accountMaxActive
        ) {
          return reject(
            "ai_account_concurrency_exceeded"
          );
        }

        if (
          count(globalActive) >=
            configured.globalMaxActive
        ) {
          return reject(
            "ai_global_concurrency_exceeded"
          );
        }

        if (
          count(
            accountRate,
            accountId,
            timestamp - MINUTE
          ) >= configured.accountPerMinute
        ) {
          return reject(
            "ai_account_minute_rate_exceeded"
          );
        }

        if (
          count(
            accountRate,
            accountId,
            timestamp - HOUR
          ) >= configured.accountPerHour
        ) {
          return reject(
            "ai_account_hour_rate_exceeded"
          );
        }

        if (
          count(
            globalRate,
            timestamp - MINUTE
          ) >= configured.globalPerMinute
        ) {
          return reject(
            "ai_global_minute_rate_exceeded"
          );
        }

        if (
          count(
            globalRate,
            timestamp - HOUR
          ) >= configured.globalPerHour
        ) {
          return reject(
            "ai_global_hour_rate_exceeded"
          );
        }

        /*
         * No client-supplied request IDs.
         */

        const requestId =
          randomUUID();

        insert.run(
          requestId,
          accountId,
          timestamp
        );

        if (
          updateClock.run(timestamp)
            .changes !== 1
        ) {
          throw new Error(
            "ai_rate_clock_update_failed"
          );
        }

        return project(
          find.get(requestId)
        );
      });

    } catch {
      return reject(
        "ai_rate_limiter_unavailable"
      );
    }
  }


  /*
   * RELEASE COMPLETED REQUEST
   *
   * Releases concurrency only.
   * Does not refund rate counters.
   *
   * Call only after trusted execution
   * has definitively stopped.
   */

  function release(input) {
    if (closed) {
      return reject(
        "ai_rate_limiter_closed"
      );
    }

    try {
      if (
        !exactFields(input, [
          "accountId",
          "requestId"
        ]) ||

        !validAccountId(input.accountId) ||

        !validRequestId(input.requestId)
      ) {
        return reject(
          "invalid_ai_rate_request"
        );
      }

      const {
        accountId,
        requestId
      } = input;

      return transaction(() => {
        const current = clock();

        if (!current.ok) {
          return reject(
            current.reason
          );
        }

        const row = find.get(requestId);

        if (
          !row ||
          row.account_id !== accountId
        ) {
          return reject(
            "ai_rate_claim_not_found"
          );
        }

        if (
          row.released_at_ms !== null
        ) {
          return project(row, true);
        }

        if (
          finish.run(
            current.timestamp,

            requestId,

            accountId
          ).changes !== 1
        ) {
          throw new Error(
            "ai_rate_release_failed"
          );
        }

        if (
          updateClock.run(
            current.timestamp
          ).changes !== 1
        ) {
          throw new Error(
            "ai_rate_clock_update_failed"
          );
        }

        return project(
          find.get(requestId)
        );
      });

    } catch {
      return reject(
        "ai_rate_limiter_unavailable"
      );
    }
  }


  /*
   * SERVICE SHUTDOWN
   *
   * Never delete active claims
   * during shutdown.
   */

  function close() {
    if (!closed) {
      closed = true;

      db.close();
    }
  }

  return Object.freeze({
    version:
      AI_RATE_LIMITER_VERSION,

    acquire,

    release,

    close,

    getLimits: () => configured,

    getPolicy: () => POLICY
  });
}

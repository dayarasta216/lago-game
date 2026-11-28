import { DatabaseSync } from "node:sqlite";

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
  performance
} from "node:perf_hooks";

import {
  validAccountId,
  validCharacterId
} from "./lago-agent-memory-contract.mjs";


/*
 * LAGO GAME
 * R2.8C6C1 — PERSISTENT AI CONSENT STORE
 *
 * Explicit authenticated consent.
 * Account and model scoped.
 * Immutable consent history.
 * Atomic revision checks.
 * Private persistent storage.
 *
 * No provider activation.
 * No memory authorization.
 * No external training authorization.
 * No trading authorization.
 */

export const AI_CONSENT_VERSION = 1;

export const AI_CONSENT_POLICY_VERSION = 1;

const PROVIDER = "openai";

const PURPOSE = "ai_inference";

const AUTH_TIMEOUT_MS = 5000;

const MAX = Number.MAX_SAFE_INTEGER;


const POLICY = Object.freeze({
  explicitConsentRequired: true,

  defaultGranted: false,

  accountScoped: true,

  modelScoped: true,

  policyVersionRequired: true,

  persistentHistoryEnabled: true,

  atomicRevisionChecks: true,

  revocationWithoutSubscription: true,

  clientAccountIdTrusted: false,

  providerDispatchAuthorized: false,

  memoryAuthorized: false,

  externalModelTrainingAuthorized: false,

  tradingAuthorized: false
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

function validModel(value) {
  return (
    typeof value === "string" &&

    /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/
      .test(value)
  );
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

function validRevision(value) {
  return (
    Number.isSafeInteger(value) &&
    value >= 0
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
 * PRIVATE DATABASE PATH
 */

function privatePath(directory, projectRoot) {
  if (
    !validDirectory(directory) ||
    !validDirectory(projectRoot)
  ) {
    throw new Error(
      "absolute_ai_consent_paths_required"
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
      "ai_consent_directory_inside_project"
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
      "insecure_ai_consent_directory"
    );
  }

  const dir =
    realpathSync(requested);

  if (inside(root, dir)) {
    throw new Error(
      "ai_consent_directory_inside_project"
    );
  }

  if (
    process.platform !== "win32" &&

    (lstatSync(dir).mode & 0o077) !== 0
  ) {
    throw new Error(
      "insecure_ai_consent_directory"
    );
  }

  const file = join(
    dir,

    "lago-ai-consent.sqlite"
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
      "insecure_ai_consent_database"
    );
  }

  return file;
}


/*
 * SAFE FAILURE
 */

function reject(reason) {
  return Object.freeze({
    ok: false,

    version: AI_CONSENT_VERSION,

    granted: false,

    revision: null,

    providerDispatchAuthorized: false,

    memoryAuthorized: false,

    externalModelTrainingAuthorized: false,

    tradingAuthorized: false,

    reason
  });
}


/*
 * CONSENT SERVICE FACTORY
 */

export function createLagoAIConsentStore({

  directory,

  projectRoot,

  sessionStore,

  model,

  now = () => Date.now()

} = {}) {

  if (
    typeof sessionStore?.restoreSession !==
      "function"
  ) {
    throw new Error(
      "ai_consent_session_store_required"
    );
  }

  if (!validModel(model)) {
    throw new Error(
      "invalid_ai_consent_model"
    );
  }

  if (typeof now !== "function") {
    throw new Error(
      "invalid_ai_consent_clock"
    );
  }

  const db = new DatabaseSync(
    privatePath(directory, projectRoot)
  );

  let closed = false;

  let latest, insert;


  /*
   * ATOMIC TRANSACTION
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
   *
   * Append-only consent revisions.
   * No messages or API credentials.
   */

  try {
    db.exec(`
      PRAGMA busy_timeout = 5000;

      PRAGMA journal_mode = DELETE;

      PRAGMA synchronous = FULL;

      PRAGMA recursive_triggers = ON;
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
          "unsupported_ai_consent_schema"
        );
      }

      if (version === 0) {
        db.exec(`
          CREATE TABLE ai_consent_events (

            account_id TEXT NOT NULL,

            provider_id TEXT NOT NULL
              CHECK(provider_id = 'openai'),

            model TEXT NOT NULL,

            revision INTEGER NOT NULL
              CHECK(revision BETWEEN 1 AND ${MAX}),

            policy_version INTEGER NOT NULL
              CHECK(policy_version >= 1),

            granted INTEGER NOT NULL
              CHECK(granted IN (0, 1)),

            recorded_at_ms INTEGER NOT NULL,

            PRIMARY KEY (
              account_id,
              provider_id,
              model,
              revision
            )

          ) STRICT;

          CREATE TRIGGER
            ai_consent_events_no_update

          BEFORE UPDATE ON ai_consent_events

          BEGIN
            SELECT RAISE(
              ABORT,
              'ai_consent_history_immutable'
            );
          END;

          CREATE TRIGGER
            ai_consent_events_no_delete

          BEFORE DELETE ON ai_consent_events

          BEGIN
            SELECT RAISE(
              ABORT,
              'ai_consent_history_immutable'
            );
          END;

          CREATE TRIGGER
            ai_consent_events_no_replace

          BEFORE INSERT ON ai_consent_events

          WHEN EXISTS (
            SELECT 1
            FROM ai_consent_events

            WHERE account_id = NEW.account_id

              AND provider_id = NEW.provider_id

              AND model = NEW.model

              AND revision = NEW.revision
          )

          BEGIN
            SELECT RAISE(
              ABORT,
              'ai_consent_history_immutable'
            );
          END;

          PRAGMA user_version = 1;
        `);
      }
    });

    latest = db.prepare(`
      SELECT *
      FROM ai_consent_events

      WHERE account_id = ?

        AND provider_id = ?

        AND model = ?

      ORDER BY revision DESC

      LIMIT 1
    `);

    insert = db.prepare(`
      INSERT INTO ai_consent_events (

        account_id,

        provider_id,

        model,

        revision,

        policy_version,

        granted,

        recorded_at_ms

      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

  } catch (error) {
    db.close();

    throw error;
  }


  /*
   * BOUNDED SESSION AUTHENTICATION
   *
   * The authenticated account comes
   * from the session store, never
   * from the client request body.
   */

  async function authenticate(sessionToken) {
    if (
      typeof sessionToken !== "string" ||

      sessionToken.length < 1 ||

      sessionToken.length > 256 ||

      sessionToken.trim() !== sessionToken
    ) {
      return null;
    }

    const startedAt = now();

    if (!validClock(startedAt)) {
      return null;
    }

    const monotonicStart =
      performance.now();

    const controller =
      new AbortController();

    let timer;

    try {
      const result = await Promise.race([
        Promise.resolve().then(() =>
          sessionStore.restoreSession(
            sessionToken,

            {
              signal: controller.signal
            }
          )
        ),

        new Promise(resolve => {
          timer = setTimeout(() => {
            controller.abort();

            resolve(null);

          }, AUTH_TIMEOUT_MS);
        })
      ]);

      if (
        result?.ok !== true ||

        !validAccountId(
          result.account?.accountId
        ) ||

        typeof result.expiresAt !== "string"
      ) {
        return null;
      }

      const expiresAt =
        Date.parse(result.expiresAt);

      if (
        !validClock(expiresAt) ||

        new Date(expiresAt).toISOString() !==
          result.expiresAt
      ) {
        return null;
      }

      const auth = {
        accountId:
          result.account.accountId,

        expiresAt,

        startedAt,

        monotonicStart
      };

      return sessionActive(auth, now())
        ? Object.freeze(auth)
        : null;

    } finally {
      clearTimeout(timer);

      controller.abort();
    }
  }


  function sessionActive(auth, timestamp) {
    return (
      !closed &&

      validClock(timestamp) &&

      timestamp >= auth.startedAt &&

      timestamp < auth.expiresAt &&

      timestamp - auth.startedAt <
        AUTH_TIMEOUT_MS &&

      performance.now() -
        auth.monotonicStart <
        AUTH_TIMEOUT_MS
    );
  }


  /*
   * VALIDATED CONSENT STATE
   */

  function readRow(accountId, timestamp) {
    if (!validClock(timestamp)) {
      throw new Error(
        "invalid_ai_consent_clock"
      );
    }

    const row = latest.get(
      accountId,

      PROVIDER,

      model
    );

    if (!row) {
      return null;
    }

    if (
      !validRevision(row.revision) ||

      row.revision === 0 ||

      ![0, 1].includes(row.granted) ||

      !Number.isSafeInteger(
        row.policy_version
      ) ||

      row.policy_version < 1 ||

      !validClock(row.recorded_at_ms) ||

      timestamp < row.recorded_at_ms
    ) {
      throw new Error(
        "invalid_ai_consent_history"
      );
    }

    return row;
  }


  function projectState(
    accountId,
    row,
    changed = false
  ) {
    return Object.freeze({
      ok: true,

      version: AI_CONSENT_VERSION,

      accountId,

      providerId: PROVIDER,

      model,

      purpose: PURPOSE,

      policyVersion:
        AI_CONSENT_POLICY_VERSION,

      revision:
        row?.revision ?? 0,

      granted: Boolean(
        row?.granted === 1 &&

        row.policy_version ===
          AI_CONSENT_POLICY_VERSION
      ),

      changed,

      updatedAt: row
        ? new Date(
            row.recorded_at_ms
          ).toISOString()
        : null,

      providerDispatchAuthorized: false,

      memoryAuthorized: false,

      externalModelTrainingAuthorized: false,

      tradingAuthorized: false,

      reason: null
    });
  }


  /*
   * AUTHENTICATED STATE READ
   */

  async function getConsentState(input) {
    if (closed) {
      return reject(
        "ai_consent_store_closed"
      );
    }

    try {
      if (
        !exactFields(input, [
          "sessionToken"
        ])
      ) {
        return reject(
          "invalid_ai_consent_request"
        );
      }

      const auth =
        await authenticate(
          input.sessionToken
        );

      if (!auth) {
        return reject(
          "authentication_required"
        );
      }

      const timestamp = now();

      if (!sessionActive(auth, timestamp)) {
        return reject(
          "authentication_required"
        );
      }

      return projectState(
        auth.accountId,

        readRow(
          auth.accountId,
          timestamp
        )
      );

    } catch {
      return reject(
        "ai_consent_store_unavailable"
      );
    }
  }


  /*
   * EXPLICIT CONSENT UPDATE
   *
   * Revision compare-and-swap prevents
   * stale browser requests from silently
   * restoring previously revoked consent.
   */

  async function setConsent(input) {
    if (closed) {
      return reject(
        "ai_consent_store_closed"
      );
    }

    try {
      if (
        !exactFields(input, [
          "sessionToken",

          "granted",

          "policyVersion",

          "expectedRevision"
        ])
      ) {
        return reject(
          "invalid_ai_consent_request"
        );
      }

      const {
        sessionToken,

        granted,

        policyVersion,

        expectedRevision
      } = input;

      if (
        typeof granted !== "boolean" ||

        !validRevision(expectedRevision) ||

        !Number.isSafeInteger(policyVersion) ||

        policyVersion < 1
      ) {
        return reject(
          "invalid_ai_consent_request"
        );
      }

      if (
        granted &&

        policyVersion !==
          AI_CONSENT_POLICY_VERSION
      ) {
        return reject(
          "ai_consent_policy_version_mismatch"
        );
      }

      const auth =
        await authenticate(sessionToken);

      if (!auth) {
        return reject(
          "authentication_required"
        );
      }

      if (closed) {
        return reject(
          "ai_consent_store_closed"
        );
      }

      return transaction(() => {
        const timestamp = now();

        if (!sessionActive(auth, timestamp)) {
          return reject(
            "authentication_required"
          );
        }

        const accountId =
          auth.accountId;

        const row = readRow(
          accountId,
          timestamp
        );

        const revision =
          row?.revision ?? 0;

        if (
          expectedRevision !== revision
        ) {
          return reject(
            "ai_consent_revision_conflict"
          );
        }

        /*
         * Exact state retry.
         * No duplicate history entry.
         */

        if (
          (
            !row &&
            granted === false
          ) ||

          (
            row &&

            row.granted === Number(granted) &&

            row.policy_version ===
              AI_CONSENT_POLICY_VERSION
          )
        ) {
          return projectState(
            accountId,
            row
          );
        }

        if (revision >= MAX) {
          return reject(
            "ai_consent_revision_limit"
          );
        }

        /*
         * Recheck session after acquiring
         * the SQLite write lock.
         */

        const recordedAt = now();

        if (
          recordedAt < timestamp ||

          !sessionActive(auth, recordedAt)
        ) {
          return reject(
            "authentication_required"
          );
        }

        insert.run(
          accountId,

          PROVIDER,

          model,

          revision + 1,

          AI_CONSENT_POLICY_VERSION,

          Number(granted),

          recordedAt
        );

        return projectState(
          accountId,

          readRow(
            accountId,

            recordedAt
          ),

          true
        );
      });

    } catch {
      return reject(
        "ai_consent_store_unavailable"
      );
    }
  }


  /*
   * TRUSTED GATEWAY CONSENT CHECK
   *
   * Returns revision only if the
   * current consent is valid.
   *
   * Account identity must originate
   * from authenticated runtime access.
   */

  function getProcessingConsentRevision(
    context,
    options = {}
  ) {
    if (closed) {
      return null;
    }

    try {
      if (
        !(options.signal instanceof AbortSignal) ||

        options.signal.aborted ||

        !exactFields(context, [
          "accountId",

          "characterId",

          "providerId",

          "model",

          "purpose"
        ])
      ) {
        return null;
      }

      if (
        !validAccountId(context.accountId) ||

        !validCharacterId(context.characterId) ||

        context.providerId !== PROVIDER ||

        context.model !== model ||

        context.purpose !== PURPOSE
      ) {
        return null;
      }

      const row = readRow(
        context.accountId,

        now()
      );

      if (
        options.signal.aborted ||

        row?.granted !== 1 ||

        row.policy_version !==
          AI_CONSENT_POLICY_VERSION
      ) {
        return null;
      }

      return row.revision;

    } catch {
      return null;
    }
  }


  /*
   * Existing Gateway boolean contract.
   */

  function getProcessingConsent(
    context,
    options
  ) {
    return (
      getProcessingConsentRevision(
        context,

        options
      ) !== null
    );
  }


  /*
   * SERVICE SHUTDOWN
   */

  function close() {
    if (closed) {
      return;
    }

    closed = true;

    db.close();
  }


  return Object.freeze({
    version: AI_CONSENT_VERSION,

    getConsentState,

    setConsent,

    getProcessingConsent,

    getProcessingConsentRevision,

    close,

    getPolicy: () => POLICY
  });
}

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
  join,
  sep,
  isAbsolute
} from "node:path";

import {
  validAccountId,
  validCharacterId,
  getMemoryCharacters
} from "./lago-agent-memory-contract.mjs";

/*
 * LAGO GAME
 * R2.8B — SERVER CHARACTER OWNERSHIP
 *
 * Persistent account-scoped character ownership.
 * One active personal agent per account.
 * Atomic character selection.
 * Persistent selection history.
 *
 * Internal server module only.
 * No client ownership imports.
 * No payment authorization.
 * No AI or trading authorization.
 */

export const CHARACTER_STORE_VERSION = 1;

const STARTER_CHARACTER = "lago";
const MAX_HISTORY_LIMIT = 100;

const CHARACTERS = Object.freeze([
  ...getMemoryCharacters()
]);

const POLICY = Object.freeze({
  ownershipScope: "account",
  starterCharacterId: STARTER_CHARACTER,
  maxActiveAgents: 1,
  maxOwnedCharacters: CHARACTERS.length,
  persistentOwnership: true,
  persistentSelectionHistory: true,
  atomicCharacterSelection: true,
  clientOwnershipTrusted: false,
  clientPaymentTrusted: false,
  automaticPaidCharacterGrants: false,
  preserveOwnershipOnSubscriptionExpiry: true,
  preserveMemoryOnCharacterSwitch: true,
  preserveProgressOnCharacterSwitch: true,
  subscriptionRequiredForCollection: false,
  tradingAuthorizationGranted: false,
  failClosed: true
});


/*
 * COMMON VALIDATION
 */

function inside(parent, target) {
  return (
    parent === target ||
    target.startsWith(
      parent.endsWith(sep)
        ? parent
        : parent + sep
    )
  );
}

function reject(reason) {
  return Object.freeze({
    ok: false,
    serverVerified: false,
    reason,
    aiEnabled: false,
    tradingAuthorized: false
  });
}

function canonicalTimestamp(now) {
  const value = now();

  if (
    !Number.isSafeInteger(value) ||
    !Number.isFinite(new Date(value).getTime())
  ) {
    throw new Error("invalid_character_clock");
  }

  return new Date(value).toISOString();
}


/*
 * PRIVATE DATABASE LOCATION
 */

function prepareDatabasePath(
  directory,
  projectRoot
) {
  if (
    typeof directory !== "string" ||
    typeof projectRoot !== "string" ||
    !isAbsolute(directory) ||
    !isAbsolute(projectRoot)
  ) {
    throw new Error(
      "absolute_character_paths_required"
    );
  }

  const root = realpathSync(projectRoot);
  const requestedDirectory = resolve(directory);

  if (
    inside(
      resolve(projectRoot),
      requestedDirectory
    )
  ) {
    throw new Error(
      "character_directory_inside_project"
    );
  }

  mkdirSync(requestedDirectory, {
    recursive: true,
    mode: 0o700
  });

  const directoryEntry = lstatSync(
    requestedDirectory
  );

  if (
    !directoryEntry.isDirectory() ||
    directoryEntry.isSymbolicLink()
  ) {
    throw new Error(
      "insecure_character_directory"
    );
  }

  const privateDirectory = realpathSync(
    requestedDirectory
  );

  if (inside(root, privateDirectory)) {
    throw new Error(
      "character_directory_inside_project"
    );
  }

  const info = lstatSync(privateDirectory);

  if (
    process.platform !== "win32" &&
    (info.mode & 0o077) !== 0
  ) {
    throw new Error(
      "insecure_character_directory"
    );
  }

  const file = join(
    privateDirectory,
    "lago-characters.sqlite"
  );

  try {
    const fd = openSync(file, "wx", 0o600);

    closeSync(fd);

  } catch (error) {
    if (error?.code !== "EEXIST") {
      throw error;
    }
  }

  const fileInfo = lstatSync(file);

  if (
    !fileInfo.isFile() ||
    fileInfo.isSymbolicLink() ||
    fileInfo.nlink !== 1 ||
    (
      process.platform !== "win32" &&
      (fileInfo.mode & 0o077) !== 0
    )
  ) {
    throw new Error(
      "insecure_character_database"
    );
  }

  return file;
}


/*
 * SERVER CHARACTER STORE
 */

export function createLagoCharacterStore({
  directory,
  projectRoot,
  trustedGrantsEnabled = false,
  now = () => Date.now()
} = {}) {

  if (
    typeof trustedGrantsEnabled !== "boolean" ||
    typeof now !== "function"
  ) {
    throw new Error(
      "invalid_character_store_configuration"
    );
  }

  const file = prepareDatabasePath(
    directory,
    projectRoot
  );

  const db = new DatabaseSync(file, {
    enableForeignKeyConstraints: true
  });

  let closed = false;


  /*
   * DATABASE SCHEMA
   */

  try {

    db.exec(`
      PRAGMA journal_mode = DELETE;
      PRAGMA synchronous = FULL;
      PRAGMA foreign_keys = ON;
      PRAGMA busy_timeout = 5000;

      CREATE TABLE IF NOT EXISTS character_catalog (
        character_id TEXT PRIMARY KEY NOT NULL
      ) STRICT;

      CREATE TABLE IF NOT EXISTS character_ownership (
        account_id TEXT NOT NULL,
        character_id TEXT NOT NULL,
        acquired_at TEXT NOT NULL,
        acquisition_source TEXT NOT NULL,

        PRIMARY KEY (
          account_id,
          character_id
        ),

        FOREIGN KEY (character_id)
          REFERENCES character_catalog(character_id),

        CHECK (
          acquisition_source IN (
            'starter',
            'trusted_grant'
          )
        ),

        CHECK (
          acquisition_source <> 'starter'
          OR character_id = 'lago'
        )

      ) STRICT;

      CREATE TABLE IF NOT EXISTS character_profiles (
        account_id TEXT PRIMARY KEY NOT NULL,
        active_character_id TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        selection_revision INTEGER NOT NULL,

        FOREIGN KEY (
          account_id,
          active_character_id
        ) REFERENCES character_ownership (
          account_id,
          character_id
        ),

        CHECK (selection_revision >= 1),

        CHECK (updated_at >= created_at)

      ) STRICT;

      CREATE TABLE IF NOT EXISTS character_selection_history (
        account_id TEXT NOT NULL,
        selection_revision INTEGER NOT NULL,
        previous_character_id TEXT,
        character_id TEXT NOT NULL,
        selected_at TEXT NOT NULL,

        PRIMARY KEY (
          account_id,
          selection_revision
        ),

        FOREIGN KEY (account_id)
          REFERENCES character_profiles(account_id),

        FOREIGN KEY (
          account_id,
          character_id
        ) REFERENCES character_ownership (
          account_id,
          character_id
        ),

        FOREIGN KEY (
          account_id,
          previous_character_id
        ) REFERENCES character_ownership (
          account_id,
          character_id
        ),

        CHECK (selection_revision >= 1),

        CHECK (
          (
            selection_revision = 1
            AND previous_character_id IS NULL
          )
          OR
          (
            selection_revision > 1
            AND previous_character_id IS NOT NULL
            AND previous_character_id <> character_id
          )
        )

      ) STRICT;

      CREATE TRIGGER IF NOT EXISTS
        character_ownership_immutable_update
      BEFORE UPDATE ON character_ownership
      BEGIN
        SELECT RAISE(
          ABORT,
          'character_ownership_immutable'
        );
      END;

      CREATE TRIGGER IF NOT EXISTS
        character_ownership_immutable_delete
      BEFORE DELETE ON character_ownership
      BEGIN
        SELECT RAISE(
          ABORT,
          'character_ownership_immutable'
        );
      END;

      CREATE TRIGGER IF NOT EXISTS
        character_history_immutable_update
      BEFORE UPDATE ON character_selection_history
      BEGIN
        SELECT RAISE(
          ABORT,
          'character_history_immutable'
        );
      END;

      CREATE TRIGGER IF NOT EXISTS
        character_history_immutable_delete
      BEFORE DELETE ON character_selection_history
      BEGIN
        SELECT RAISE(
          ABORT,
          'character_history_immutable'
        );
      END;
    `);

    const insertCatalog = db.prepare(`
      INSERT OR IGNORE INTO character_catalog (
        character_id
      ) VALUES (?)
    `);

    for (const characterId of CHARACTERS) {
      insertCatalog.run(characterId);
    }

    const foreignKeyErrors = db.prepare(
      "PRAGMA foreign_key_check"
    ).all();

    if (foreignKeyErrors.length !== 0) {
      throw new Error(
        "character_database_integrity_failed"
      );
    }

  } catch (error) {
    db.close();
    throw error;
  }


  /*
   * PREPARED STATEMENTS
   */

  const findProfile = db.prepare(`
    SELECT *
    FROM character_profiles
    WHERE account_id = ?
  `);

  const findOwnership = db.prepare(`
    SELECT *
    FROM character_ownership
    WHERE account_id = ?
      AND character_id = ?
  `);

  const listOwnership = db.prepare(`
    SELECT
      character_id,
      acquired_at,
      acquisition_source
    FROM character_ownership
    WHERE account_id = ?
    ORDER BY character_id ASC
  `);

  const insertOwnership = db.prepare(`
    INSERT INTO character_ownership (
      account_id,
      character_id,
      acquired_at,
      acquisition_source
    ) VALUES (?, ?, ?, ?)
  `);

  const insertProfile = db.prepare(`
    INSERT INTO character_profiles (
      account_id,
      active_character_id,
      created_at,
      updated_at,
      selection_revision
    ) VALUES (?, ?, ?, ?, 1)
  `);

  const updateProfile = db.prepare(`
    UPDATE character_profiles
    SET
      active_character_id = ?,
      updated_at = ?,
      selection_revision = ?
    WHERE account_id = ?
      AND selection_revision = ?
  `);

  const insertHistory = db.prepare(`
    INSERT INTO character_selection_history (
      account_id,
      selection_revision,
      previous_character_id,
      character_id,
      selected_at
    ) VALUES (?, ?, ?, ?, ?)
  `);

  const listHistory = db.prepare(`
    SELECT *
    FROM character_selection_history
    WHERE account_id = ?
      AND selection_revision < ?
    ORDER BY selection_revision DESC
    LIMIT ?
  `);

  const findAccess = db.prepare(`
    SELECT
      p.account_id,
      p.active_character_id,
      p.selection_revision,

      CASE
        WHEN o.character_id IS NULL THEN 0
        ELSE 1
      END AS owned

    FROM character_profiles AS p

    LEFT JOIN character_ownership AS o
      ON o.account_id = p.account_id
      AND o.character_id = ?

    WHERE p.account_id = ?
  `);


  /*
   * SYNCHRONOUS DATABASE TRANSACTION
   */

  function transaction(operation, write = true) {
    db.exec(
      write ? "BEGIN IMMEDIATE" : "BEGIN"
    );

    try {

      const result = operation();

      db.exec("COMMIT");

      return result;

    } catch (error) {

      try {
        db.exec("ROLLBACK");
      } catch {
        // Preserve the original error.
      }

      throw error;

    }
  }


  /*
   * CANONICAL COLLECTION STATE
   */

  function projectState(accountId) {
    const profile = findProfile.get(accountId);

    if (!profile) {
      return reject(
        "character_profile_not_initialized"
      );
    }

    const ownedCharacters = listOwnership
      .all(accountId)
      .map(row => {

        if (!validCharacterId(row.character_id)) {
          throw new Error(
            "invalid_stored_character"
          );
        }

        return Object.freeze({
          characterId: row.character_id,
          acquiredAt: row.acquired_at,
          acquisitionSource:
            row.acquisition_source
        });

      });

    if (
      !validCharacterId(
        profile.active_character_id
      ) ||
      !Number.isSafeInteger(
        profile.selection_revision
      ) ||
      profile.selection_revision < 1 ||
      !ownedCharacters.some(
        item =>
          item.characterId ===
          profile.active_character_id
      )
    ) {
      throw new Error(
        "invalid_character_profile"
      );
    }

    return Object.freeze({
      ok: true,
      version: CHARACTER_STORE_VERSION,
      serverVerified: true,
      accountId,

      activeCharacterId:
        profile.active_character_id,

      selectionRevision:
        profile.selection_revision,

      ownedCharacters:
        Object.freeze(ownedCharacters),

      ownedCharacterIds:
        Object.freeze(
          ownedCharacters.map(
            item => item.characterId
          )
        ),

      createdAt: profile.created_at,
      updatedAt: profile.updated_at,

      maxActiveAgents: 1,

      aiEnabled: false,
      tradingAuthorized: false,

      reason: null
    });
  }


  /*
   * INITIALIZE AUTHENTICATED ACCOUNT
   *
   * Internal trusted server operation.
   * Must not be exposed directly to clients.
   */

  function initializeAccount({ accountId } = {}) {
    if (closed) {
      return reject("character_store_closed");
    }

    if (!validAccountId(accountId)) {
      return reject("invalid_account_id");
    }

    try {

      return transaction(() => {

        if (findProfile.get(accountId)) {

          return Object.freeze({
            ...projectState(accountId),
            initialized: false
          });

        }

        const timestamp = canonicalTimestamp(now);

        insertOwnership.run(
          accountId,
          STARTER_CHARACTER,
          timestamp,
          "starter"
        );

        insertProfile.run(
          accountId,
          STARTER_CHARACTER,
          timestamp,
          timestamp
        );

        insertHistory.run(
          accountId,
          1,
          null,
          STARTER_CHARACTER,
          timestamp
        );

        return Object.freeze({
          ...projectState(accountId),
          initialized: true
        });

      });

    } catch {
      return reject(
        "character_initialization_unavailable"
      );
    }
  }


  /*
   * READ COLLECTION
   */

  function getState({ accountId } = {}) {
    if (closed) {
      return reject("character_store_closed");
    }

    if (!validAccountId(accountId)) {
      return reject("invalid_account_id");
    }

    try {

      return transaction(
        () => projectState(accountId),
        false
      );

    } catch {
      return reject(
        "character_state_unavailable"
      );
    }
  }


  /*
   * TRUSTED INTERNAL OWNERSHIP GRANT
   *
   * Disabled by default.
   *
   * This is NOT a payment verifier.
   * Future purchase authorization must
   * independently verify payment, price,
   * daily limits and replay protection.
   */

  function recordTrustedGrant({
    accountId,
    characterId
  } = {}) {

    if (closed) {
      return reject("character_store_closed");
    }

    if (!trustedGrantsEnabled) {
      return reject("character_grants_disabled");
    }

    if (!validAccountId(accountId)) {
      return reject("invalid_account_id");
    }

    if (!validCharacterId(characterId)) {
      return reject("invalid_character");
    }

    try {

      return transaction(() => {

        const profile = findProfile.get(
          accountId
        );

        if (!profile) {
          return reject(
            "character_profile_not_initialized"
          );
        }

        if (
          findOwnership.get(
            accountId,
            characterId
          )
        ) {

          return Object.freeze({
            ...projectState(accountId),
            granted: false,
            alreadyOwned: true
          });

        }

        const timestamp = canonicalTimestamp(now);

        if (timestamp < profile.updated_at) {
          return reject("character_clock_rollback");
        }

        insertOwnership.run(
          accountId,
          characterId,
          timestamp,
          "trusted_grant"
        );

        return Object.freeze({
          ...projectState(accountId),
          granted: true,
          alreadyOwned: false
        });

      });

    } catch {
      return reject(
        "character_grant_unavailable"
      );
    }
  }


  /*
   * SELECT ONE OWNED CHARACTER
   *
   * Selection does not create ownership,
   * charge a payment or activate AI.
   */

  function selectCharacter({
    accountId,
    characterId
  } = {}) {

    if (closed) {
      return reject("character_store_closed");
    }

    if (!validAccountId(accountId)) {
      return reject("invalid_account_id");
    }

    if (!validCharacterId(characterId)) {
      return reject("invalid_character");
    }

    try {

      return transaction(() => {

        const profile = findProfile.get(
          accountId
        );

        if (!profile) {
          return reject(
            "character_profile_not_initialized"
          );
        }

        if (
          !findOwnership.get(
            accountId,
            characterId
          )
        ) {
          return reject("character_not_owned");
        }

        if (
          profile.active_character_id ===
          characterId
        ) {

          return Object.freeze({
            ...projectState(accountId),
            changed: false
          });

        }

        const timestamp = canonicalTimestamp(now);

        if (timestamp < profile.updated_at) {
          return reject(
            "character_clock_rollback"
          );
        }

        const revision =
          profile.selection_revision + 1;

        if (!Number.isSafeInteger(revision)) {
          return reject(
            "character_revision_limit"
          );
        }

        const updated = updateProfile.run(
          characterId,
          timestamp,
          revision,
          accountId,
          profile.selection_revision
        );

        if (updated.changes !== 1) {
          throw new Error(
            "character_selection_conflict"
          );
        }

        insertHistory.run(
          accountId,
          revision,
          profile.active_character_id,
          characterId,
          timestamp
        );

        return Object.freeze({
          ...projectState(accountId),
          changed: true
        });

      });

    } catch {
      return reject(
        "character_selection_unavailable"
      );
    }
  }


  /*
   * TRUSTED CHARACTER ACCESS PROVIDER
   *
   * Compatible with:
   * - createLagoRuntimeAccess
   * - createLagoMemoryAccess
   */

  function getCharacterAccess({
    accountId,
    characterId
  } = {}) {

    if (closed) {
      return reject("character_store_closed");
    }

    if (!validAccountId(accountId)) {
      return reject("invalid_account_id");
    }

    if (!validCharacterId(characterId)) {
      return reject("invalid_character");
    }

    try {

      const row = findAccess.get(
        characterId,
        accountId
      );

      if (!row) {
        return reject(
          "character_profile_not_initialized"
        );
      }

      if (
        !validCharacterId(
          row.active_character_id
        ) ||
        !Number.isSafeInteger(
          row.selection_revision
        ) ||
        row.selection_revision < 1
      ) {
        return reject(
          "character_state_unavailable"
        );
      }

      const owned = row.owned === 1;

      const active =
        row.active_character_id ===
        characterId;

      return Object.freeze({
        ok: true,
        serverVerified: true,

        accountId,
        characterId,

        owned,
        active,

        activeCharacterId:
          row.active_character_id,

        selectionRevision:
          row.selection_revision,

        memoryAccessAllowed: owned,

        runtimeAuthorized: false,
        aiEnabled: false,
        tradingAuthorized: false,

        reason: owned
          ? null
          : "character_not_owned"
      });

    } catch {
      return reject(
        "character_access_unavailable"
      );
    }
  }


  /*
   * PAGINATED SELECTION HISTORY
   */

  function getHistory({
    accountId,
    beforeRevision = Number.MAX_SAFE_INTEGER,
    limit = 50
  } = {}) {

    if (closed) {
      return reject("character_store_closed");
    }

    if (!validAccountId(accountId)) {
      return reject("invalid_account_id");
    }

    if (
      !Number.isSafeInteger(beforeRevision) ||
      beforeRevision < 1 ||
      !Number.isSafeInteger(limit) ||
      limit < 1 ||
      limit > MAX_HISTORY_LIMIT
    ) {
      return reject(
        "invalid_character_history_request"
      );
    }

    try {

      return transaction(() => {

        if (!findProfile.get(accountId)) {
          return reject(
            "character_profile_not_initialized"
          );
        }

        const rows = listHistory.all(
          accountId,
          beforeRevision,
          limit + 1
        );

        const hasMore = rows.length > limit;

        const items = rows
          .slice(0, limit)
          .map(row => Object.freeze({

            selectionRevision:
              row.selection_revision,

            previousCharacterId:
              row.previous_character_id,

            characterId:
              row.character_id,

            selectedAt:
              row.selected_at

          }));

        return Object.freeze({
          ok: true,
          serverVerified: true,
          accountId,

          items: Object.freeze(items),

          hasMore,

          nextBeforeRevision:
            hasMore
              ? items.at(-1).selectionRevision
              : null,

          reason: null
        });

      }, false);

    } catch {
      return reject(
        "character_history_unavailable"
      );
    }
  }


  /*
   * SERVICE LIFECYCLE
   */

  function close() {
    if (!closed) {
      closed = true;
      db.close();
    }
  }


  /*
   * INTERNAL SERVER API
   */

  return Object.freeze({
    version: CHARACTER_STORE_VERSION,

    initializeAccount,
    getState,
    recordTrustedGrant,
    selectCharacter,
    getCharacterAccess,
    getHistory,
    close,

    getCharacters() {
      return CHARACTERS;
    },

    getPolicy() {
      return Object.freeze({
        ...POLICY,
        trustedGrantsEnabled
      });
    }
  });

}

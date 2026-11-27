import test from "node:test";
import assert from "node:assert/strict";

import { DatabaseSync } from "node:sqlite";

import {
  mkdtemp,
  mkdir,
  rm,
  stat,
  chmod
} from "node:fs/promises";

import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  CHARACTER_STORE_VERSION,
  createLagoCharacterStore
} from "./lago-agent-character-store.mjs";

import {
  getMemoryCharacters
} from "./lago-agent-memory-contract.mjs";

/*
 * LAGO GAME
 * R2.8B1 — CHARACTER OWNERSHIP SECURITY TESTS
 *
 * Real SQLite storage.
 * Account isolation.
 * Atomic character selection.
 * Persistent ownership and history.
 *
 * No payments.
 * No external services.
 * No production data.
 */

const ACCOUNT_A = "lago_" + "A".repeat(22);
const ACCOUNT_B = "lago_" + "B".repeat(22);

const STARTER = "lago";
const SOLA = "comic_pink_snail";
const MIKI = "comic_goose";

const START = Date.parse(
  "2027-01-31T12:00:00.000Z"
);


/*
 * ISOLATED SQLITE FIXTURE
 */

async function fixture(t, changes = {}) {
  const root = await mkdtemp(
    join(tmpdir(), "lago-character-store-")
  );

  const projectRoot = join(root, "project");
  const directory = join(root, "private-characters");

  const file = join(
    directory,
    "lago-characters.sqlite"
  );

  const services = [];

  let clock = START;

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

  function open(options = {}) {
    const service = createLagoCharacterStore({
      directory,
      projectRoot,
      now: () => clock,
      trustedGrantsEnabled: true,
      ...changes,
      ...options
    });

    services.push(service);

    return service;
  }

  const store = open();

  return {
    root,
    directory,
    projectRoot,
    file,
    store,
    open,

    initialize(accountId = ACCOUNT_A) {
      return store.initializeAccount({
        accountId
      });
    },

    state(accountId = ACCOUNT_A) {
      return store.getState({
        accountId
      });
    },

    grant(
      characterId,
      accountId = ACCOUNT_A
    ) {
      return store.recordTrustedGrant({
        accountId,
        characterId
      });
    },

    select(
      characterId,
      accountId = ACCOUNT_A
    ) {
      return store.selectCharacter({
        accountId,
        characterId
      });
    },

    access(
      characterId,
      accountId = ACCOUNT_A
    ) {
      return store.getCharacterAccess({
        accountId,
        characterId
      });
    },

    history(options = {}) {
      return store.getHistory({
        accountId: ACCOUNT_A,
        ...options
      });
    },

    advance(milliseconds) {
      clock += milliseconds;
    },

    setTime(value) {
      clock = value;
    }
  };
}


/*
 * COMMON ASSERTIONS
 */

function assertDenied(result, reason) {
  assert.equal(result.ok, false);
  assert.equal(result.serverVerified, false);
  assert.equal(result.reason, reason);

  assert.equal(result.aiEnabled, false);
  assert.equal(result.tradingAuthorized, false);

  assert.equal(Object.isFrozen(result), true);
}

function assertCollection(
  state,
  accountId,
  activeCharacterId,
  owned
) {
  assert.equal(state.ok, true);
  assert.equal(state.serverVerified, true);

  assert.equal(
    state.version,
    CHARACTER_STORE_VERSION
  );

  assert.equal(state.accountId, accountId);

  assert.equal(
    state.activeCharacterId,
    activeCharacterId
  );

  assert.deepEqual(
    [...state.ownedCharacterIds].sort(),
    [...owned].sort()
  );

  assert.equal(state.maxActiveAgents, 1);
  assert.equal(state.aiEnabled, false);
  assert.equal(state.tradingAuthorized, false);
  assert.equal(state.reason, null);

  assert.equal(Object.isFrozen(state), true);

  assert.equal(
    Object.isFrozen(state.ownedCharacters),
    true
  );

  assert.equal(
    Object.isFrozen(state.ownedCharacterIds),
    true
  );
}

function initializeAndGrant(fx) {
  assert.equal(
    fx.initialize().ok,
    true
  );

  assert.equal(
    fx.grant(SOLA).granted,
    true
  );
}


/*
 * TEST 01 — INVALID CONFIGURATION
 */

test("requires valid character store configuration", () => {
  assert.throws(
    () => createLagoCharacterStore({
      trustedGrantsEnabled: "true"
    }),
    /invalid_character_store_configuration/
  );

  assert.throws(
    () => createLagoCharacterStore({
      now: null
    }),
    /invalid_character_store_configuration/
  );

  assert.throws(
    () => createLagoCharacterStore(),
    /absolute_character_paths_required/
  );
});


/*
 * TEST 02 — UNKNOWN ACCOUNT
 */

test("does not create ownership during read operations", async t => {
  const fx = await fixture(t);

  assertDenied(
    fx.state(),
    "character_profile_not_initialized"
  );

  assertDenied(
    fx.access(STARTER),
    "character_profile_not_initialized"
  );

  assertDenied(
    fx.history(),
    "character_profile_not_initialized"
  );
});


/*
 * TEST 03 — STARTER CHARACTER
 */

test("initializes an account with exactly one starter character", async t => {
  const fx = await fixture(t);

  const state = fx.initialize();

  assertCollection(
    state,
    ACCOUNT_A,
    STARTER,
    [STARTER]
  );

  assert.equal(state.initialized, true);

  assert.equal(
    state.selectionRevision,
    1
  );

  assert.equal(
    state.ownedCharacters[0].acquisitionSource,
    "starter"
  );

  const history = fx.history();

  assert.equal(history.ok, true);
  assert.equal(history.items.length, 1);

  assert.equal(
    history.items[0].previousCharacterId,
    null
  );

  assert.equal(
    history.items[0].characterId,
    STARTER
  );
});


/*
 * TEST 04 — IDEMPOTENT INITIALIZATION
 */

test("does not reset an existing character collection", async t => {
  const fx = await fixture(t);

  initializeAndGrant(fx);

  fx.select(SOLA);

  const result = fx.initialize();

  assert.equal(result.initialized, false);

  assertCollection(
    result,
    ACCOUNT_A,
    SOLA,
    [STARTER, SOLA]
  );

  assert.equal(result.selectionRevision, 2);

  assert.equal(
    fx.history().items.length,
    2
  );
});


/*
 * TEST 05 — INVALID IDENTITIES
 */

test("rejects invalid account and character identities", async t => {
  const fx = await fixture(t);

  for (const accountId of [
    "",
    null,
    {},
    "unknown",
    "../account",
    "lago_" + "A".repeat(23)
  ]) {
    assertDenied(
      fx.initialize(accountId),
      "invalid_account_id"
    );

    assertDenied(
      fx.state(accountId),
      "invalid_account_id"
    );
  }

  fx.initialize();

  for (const characterId of [
    "",
    null,
    {},
    "unknown",
    "LAGO",
    "../lago"
  ]) {
    assertDenied(
      fx.grant(characterId),
      "invalid_character"
    );

    assertDenied(
      fx.select(characterId),
      "invalid_character"
    );

    assertDenied(
      fx.access(characterId),
      "invalid_character"
    );
  }
});


/*
 * TEST 06 — DISABLED GRANTS
 */

test("keeps trusted ownership grants disabled by default", async t => {
  const fx = await fixture(t);

  const store = createLagoCharacterStore({
    directory: fx.directory,
    projectRoot: fx.projectRoot
  });

  t.after(() => store.close());

  store.initializeAccount({
    accountId: ACCOUNT_A
  });

  assertDenied(
    store.recordTrustedGrant({
      accountId: ACCOUNT_A,
      characterId: SOLA
    }),
    "character_grants_disabled"
  );

  assert.equal(
    store.getPolicy().trustedGrantsEnabled,
    false
  );
});


/*
 * TEST 07 — UNINITIALIZED GRANTS
 */

test("rejects ownership grants for uninitialized accounts", async t => {
  const fx = await fixture(t);

  assertDenied(
    fx.grant(SOLA),
    "character_profile_not_initialized"
  );
});


/*
 * TEST 08 — TRUSTED OWNERSHIP
 */

test("adds an owned character without changing the active agent", async t => {
  const fx = await fixture(t);

  fx.initialize();

  const result = fx.grant(SOLA);

  assertCollection(
    result,
    ACCOUNT_A,
    STARTER,
    [STARTER, SOLA]
  );

  assert.equal(result.granted, true);
  assert.equal(result.alreadyOwned, false);
  assert.equal(result.selectionRevision, 1);

  const granted = result.ownedCharacters.find(
    item => item.characterId === SOLA
  );

  assert.equal(
    granted.acquisitionSource,
    "trusted_grant"
  );
});


/*
 * TEST 09 — DUPLICATE GRANT
 */

test("handles repeated ownership grants without duplicate records", async t => {
  const fx = await fixture(t);

  initializeAndGrant(fx);

  const before = fx.state();

  fx.advance(1000);

  const result = fx.grant(SOLA);

  assert.equal(result.granted, false);
  assert.equal(result.alreadyOwned, true);

  assert.deepEqual(
    result.ownedCharacters,
    before.ownedCharacters
  );

  assert.equal(
    result.selectionRevision,
    before.selectionRevision
  );
});


/*
 * TEST 10 — UNOWNED CHARACTER
 */

test("does not allow selection of characters outside the collection", async t => {
  const fx = await fixture(t);

  fx.initialize();

  assertDenied(
    fx.select(SOLA),
    "character_not_owned"
  );

  assertCollection(
    fx.state(),
    ACCOUNT_A,
    STARTER,
    [STARTER]
  );

  assert.equal(fx.state().selectionRevision, 1);
});


/*
 * TEST 11 — ACTIVE CHARACTER SELECTION
 */

test("selects an owned character and records the selection revision", async t => {
  const fx = await fixture(t);

  initializeAndGrant(fx);

  fx.advance(1000);

  const result = fx.select(SOLA);

  assertCollection(
    result,
    ACCOUNT_A,
    SOLA,
    [STARTER, SOLA]
  );

  assert.equal(result.changed, true);
  assert.equal(result.selectionRevision, 2);

  assert.equal(
    Date.parse(result.updatedAt),
    START + 1000
  );

  const item = fx.history().items[0];

  assert.equal(item.selectionRevision, 2);
  assert.equal(item.previousCharacterId, STARTER);
  assert.equal(item.characterId, SOLA);
});


/*
 * TEST 12 — REPEATED SELECTION
 */

test("does not create new history when selecting the same character", async t => {
  const fx = await fixture(t);

  initializeAndGrant(fx);

  fx.select(SOLA);

  const before = fx.state();

  fx.advance(1000);

  const result = fx.select(SOLA);

  assert.equal(result.changed, false);

  assert.equal(
    result.selectionRevision,
    before.selectionRevision
  );

  assert.equal(
    result.updatedAt,
    before.updatedAt
  );

  assert.equal(fx.history().items.length, 2);
});


/*
 * TEST 13 — ACCOUNT ISOLATION
 */

test("isolates character ownership and selection between accounts", async t => {
  const fx = await fixture(t);

  fx.initialize(ACCOUNT_A);
  fx.initialize(ACCOUNT_B);

  fx.grant(SOLA, ACCOUNT_A);

  fx.select(SOLA, ACCOUNT_A);

  assertDenied(
    fx.select(SOLA, ACCOUNT_B),
    "character_not_owned"
  );

  assertCollection(
    fx.state(ACCOUNT_A),
    ACCOUNT_A,
    SOLA,
    [STARTER, SOLA]
  );

  assertCollection(
    fx.state(ACCOUNT_B),
    ACCOUNT_B,
    STARTER,
    [STARTER]
  );

  assert.equal(
    fx.history({
      accountId: ACCOUNT_B
    }).items.length,
    1
  );
});


/*
 * TEST 14 — CHARACTER ACCESS CONTRACT
 */

test("distinguishes ownership active selection and memory access", async t => {
  const fx = await fixture(t);

  initializeAndGrant(fx);

  const active = fx.access(STARTER);

  assert.equal(active.ok, true);
  assert.equal(active.serverVerified, true);
  assert.equal(active.owned, true);
  assert.equal(active.active, true);
  assert.equal(active.memoryAccessAllowed, true);

  const inactive = fx.access(SOLA);

  assert.equal(inactive.owned, true);
  assert.equal(inactive.active, false);
  assert.equal(inactive.memoryAccessAllowed, true);

  const unowned = fx.access(MIKI);

  assert.equal(unowned.owned, false);
  assert.equal(unowned.active, false);
  assert.equal(unowned.memoryAccessAllowed, false);

  for (const result of [
    active,
    inactive,
    unowned
  ]) {
    assert.equal(result.accountId, ACCOUNT_A);
    assert.equal(result.runtimeAuthorized, false);
    assert.equal(result.aiEnabled, false);
    assert.equal(result.tradingAuthorized, false);
  }
});


/*
 * TEST 15 — HISTORY PAGINATION
 */

test("returns stable paginated selection history", async t => {
  const fx = await fixture(t);

  initializeAndGrant(fx);

  for (const characterId of [
    SOLA,
    STARTER,
    SOLA,
    STARTER
  ]) {
    fx.advance(1000);

    assert.equal(
      fx.select(characterId).changed,
      true
    );
  }

  const first = fx.history({
    limit: 2
  });

  assert.deepEqual(
    first.items.map(
      item => item.selectionRevision
    ),
    [5, 4]
  );

  assert.equal(first.hasMore, true);
  assert.equal(first.nextBeforeRevision, 4);

  const second = fx.history({
    limit: 2,
    beforeRevision: first.nextBeforeRevision
  });

  assert.deepEqual(
    second.items.map(
      item => item.selectionRevision
    ),
    [3, 2]
  );

  const third = fx.history({
    limit: 2,
    beforeRevision: second.nextBeforeRevision
  });

  assert.deepEqual(
    third.items.map(
      item => item.selectionRevision
    ),
    [1]
  );

  assert.equal(third.hasMore, false);
  assert.equal(third.nextBeforeRevision, null);
});


/*
 * TEST 16 — TRANSACTION ROLLBACK
 */

test("rolls back selection when history persistence fails", async t => {
  const fx = await fixture(t);

  initializeAndGrant(fx);

  const db = new DatabaseSync(fx.file);

  try {
    db.exec(`
      CREATE TRIGGER synthetic_history_failure
      BEFORE INSERT ON character_selection_history
      WHEN NEW.selection_revision > 1
      BEGIN
        SELECT RAISE(
          ABORT,
          'synthetic_history_failure'
        );
      END;
    `);
  } finally {
    db.close();
  }

  assertDenied(
    fx.select(SOLA),
    "character_selection_unavailable"
  );

  assertCollection(
    fx.state(),
    ACCOUNT_A,
    STARTER,
    [STARTER, SOLA]
  );

  assert.equal(fx.state().selectionRevision, 1);
  assert.equal(fx.history().items.length, 1);
});


/*
 * TEST 17 — DATABASE FOREIGN KEYS
 */

test("database rejects selecting a character not owned by the account", async t => {
  const fx = await fixture(t);

  fx.initialize(ACCOUNT_A);
  fx.initialize(ACCOUNT_B);

  fx.grant(SOLA, ACCOUNT_B);

  const db = new DatabaseSync(fx.file, {
    enableForeignKeyConstraints: true
  });

  try {
    assert.throws(
      () => db.prepare(`
        UPDATE character_profiles
        SET active_character_id = ?
        WHERE account_id = ?
      `).run(SOLA, ACCOUNT_A),
      /FOREIGN KEY constraint failed/
    );
  } finally {
    db.close();
  }

  assert.equal(
    fx.state().activeCharacterId,
    STARTER
  );
});


/*
 * TEST 18 — IMMUTABLE OWNERSHIP
 */

test("rejects direct updates and deletion of ownership records", async t => {
  const fx = await fixture(t);

  initializeAndGrant(fx);

  const db = new DatabaseSync(fx.file);

  try {
    assert.throws(
      () => db.prepare(`
        UPDATE character_ownership
        SET acquired_at = ?
        WHERE account_id = ?
          AND character_id = ?
      `).run(
        "2027-02-01T00:00:00.000Z",
        ACCOUNT_A,
        SOLA
      ),
      /character_ownership_immutable/
    );

    assert.throws(
      () => db.prepare(`
        DELETE FROM character_ownership
        WHERE account_id = ?
          AND character_id = ?
      `).run(ACCOUNT_A, SOLA),
      /character_ownership_immutable/
    );
  } finally {
    db.close();
  }

  assert.equal(fx.access(SOLA).owned, true);
});


/*
 * TEST 19 — IMMUTABLE HISTORY
 */

test("rejects direct modification of selection history", async t => {
  const fx = await fixture(t);

  initializeAndGrant(fx);

  fx.select(SOLA);

  const db = new DatabaseSync(fx.file);

  try {
    assert.throws(
      () => db.prepare(`
        UPDATE character_selection_history
        SET selected_at = ?
        WHERE account_id = ?
      `).run(
        "2027-02-01T00:00:00.000Z",
        ACCOUNT_A
      ),
      /character_history_immutable/
    );

    assert.throws(
      () => db.prepare(`
        DELETE FROM character_selection_history
        WHERE account_id = ?
      `).run(ACCOUNT_A),
      /character_history_immutable/
    );
  } finally {
    db.close();
  }

  assert.equal(fx.history().items.length, 2);
});


/*
 * TEST 20 — CLOCK ROLLBACK
 */

test("rejects character changes after the server clock moves backwards", async t => {
  const fx = await fixture(t);

  initializeAndGrant(fx);

  fx.advance(1000);

  fx.select(SOLA);

  fx.setTime(START);

  assertDenied(
    fx.select(STARTER),
    "character_clock_rollback"
  );

  assertDenied(
    fx.grant(MIKI),
    "character_clock_rollback"
  );

  assert.equal(
    fx.state().activeCharacterId,
    SOLA
  );

  assert.equal(fx.access(MIKI).owned, false);
});


/*
 * TEST 21 — PERSISTENCE AFTER RESTART
 */

test("preserves character ownership selection and history after reopening", async t => {
  const fx = await fixture(t);

  initializeAndGrant(fx);

  fx.grant(MIKI);
  fx.select(SOLA);
  fx.select(MIKI);

  const before = fx.state();
  const history = fx.history();

  fx.store.close();

  const reopened = fx.open();

  assert.deepEqual(
    reopened.getState({
      accountId: ACCOUNT_A
    }),
    before
  );

  assert.deepEqual(
    reopened.getHistory({
      accountId: ACCOUNT_A
    }),
    history
  );
});


/*
 * TEST 22 — MULTIPLE DATABASE CONNECTIONS
 */

test("preserves one active character across independent store connections", async t => {
  const fx = await fixture(t);

  initializeAndGrant(fx);

  const second = fx.open();

  const firstResult = fx.select(SOLA);

  assert.equal(
    firstResult.selectionRevision,
    2
  );

  const secondResult = second.selectCharacter({
    accountId: ACCOUNT_A,
    characterId: STARTER
  });

  assert.equal(secondResult.changed, true);
  assert.equal(secondResult.selectionRevision, 3);

  assert.equal(
    fx.state().activeCharacterId,
    STARTER
  );

  assert.equal(
    second.getState({
      accountId: ACCOUNT_A
    }).activeCharacterId,
    STARTER
  );

  assert.equal(fx.history().items.length, 3);
});


/*
 * TEST 23 — INVALID HISTORY REQUEST
 */

test("rejects invalid history limits and pagination cursors", async t => {
  const fx = await fixture(t);

  fx.initialize();

  for (const limit of [
    0,
    -1,
    101,
    1.5,
    "10",
    Infinity
  ]) {
    assertDenied(
      fx.history({ limit }),
      "invalid_character_history_request"
    );
  }

  for (const beforeRevision of [
    0,
    -1,
    1.5,
    "2",
    Infinity
  ]) {
    assertDenied(
      fx.history({ beforeRevision }),
      "invalid_character_history_request"
    );
  }
});


/*
 * TEST 24 — PRIVATE STORAGE
 */

test("stores character databases outside the public project", async t => {
  const fx = await fixture(t);

  assert.throws(
    () => createLagoCharacterStore({
      directory: "./relative-characters",
      projectRoot: fx.projectRoot
    }),
    /absolute_character_paths_required/
  );

  assert.throws(
    () => createLagoCharacterStore({
      directory: join(
        fx.projectRoot,
        "characters"
      ),
      projectRoot: fx.projectRoot
    }),
    /character_directory_inside_project/
  );

  const directoryInfo = await stat(
    fx.directory
  );

  const fileInfo = await stat(
    fx.file
  );

  assert.equal(directoryInfo.isDirectory(), true);
  assert.equal(fileInfo.isFile(), true);
  assert.equal(fileInfo.nlink, 1);

  if (process.platform !== "win32") {
    assert.equal(directoryInfo.mode & 0o077, 0);
    assert.equal(fileInfo.mode & 0o077, 0);
  }
});


/*
 * TEST 25 — INSECURE PERMISSIONS
 */

test("rejects insecure character database permissions", async t => {
  const fx = await fixture(t);

  if (process.platform === "win32") {
    return;
  }

  fx.store.close();

  await chmod(fx.file, 0o644);

  try {
    assert.throws(
      () => fx.open(),
      /insecure_character_database/
    );
  } finally {
    await chmod(fx.file, 0o600);
  }
});


/*
 * TEST 26 — CLOSED STORE
 */

test("fails closed after character store shutdown", async t => {
  const fx = await fixture(t);

  initializeAndGrant(fx);

  fx.store.close();
  fx.store.close();

  for (const result of [
    fx.initialize(),
    fx.state(),
    fx.grant(MIKI),
    fx.select(SOLA),
    fx.access(STARTER),
    fx.history()
  ]) {
    assertDenied(
      result,
      "character_store_closed"
    );
  }
});


/*
 * TEST 27 — CANONICAL CHARACTER CATALOG
 */

test("uses the shared canonical character registry", async t => {
  const fx = await fixture(t);

  const characters = fx.store.getCharacters();

  assert.deepEqual(
    characters,
    getMemoryCharacters()
  );

  assert.equal(characters.length, 10);

  assert.equal(
    new Set(characters).size,
    10
  );

  assert.equal(Object.isFrozen(characters), true);
});


/*
 * TEST 28 — IMMUTABLE SECURITY POLICY
 */

test("enforces the account scoped character ownership policy", async t => {
  const fx = await fixture(t);

  const policy = fx.store.getPolicy();

  assert.equal(policy.ownershipScope, "account");
  assert.equal(policy.starterCharacterId, STARTER);
  assert.equal(policy.maxActiveAgents, 1);
  assert.equal(policy.maxOwnedCharacters, 10);

  assert.equal(policy.persistentOwnership, true);
  assert.equal(policy.persistentSelectionHistory, true);
  assert.equal(policy.atomicCharacterSelection, true);

  assert.equal(policy.clientOwnershipTrusted, false);
  assert.equal(policy.clientPaymentTrusted, false);
  assert.equal(policy.automaticPaidCharacterGrants, false);

  assert.equal(
    policy.preserveOwnershipOnSubscriptionExpiry,
    true
  );

  assert.equal(
    policy.preserveMemoryOnCharacterSwitch,
    true
  );

  assert.equal(
    policy.preserveProgressOnCharacterSwitch,
    true
  );

  assert.equal(
    policy.subscriptionRequiredForCollection,
    false
  );

  assert.equal(
    policy.tradingAuthorizationGranted,
    false
  );

  assert.equal(policy.failClosed, true);
  assert.equal(Object.isFrozen(policy), true);
  assert.equal(Object.isFrozen(fx.store), true);
});

/*
 * LAGO GAME
 * R2.8B2A — CHARACTER HARDENING REGRESSION
 *
 * Database replacement protection.
 * History integrity.
 * Live profile verification.
 * Atomic initialization.
 * Acquisition clock protection.
 *
 * All database mutations below are
 * performed on isolated test fixtures.
 */

function withCharacterDatabase(fx, operation) {
  const db = new DatabaseSync(fx.file, {
    enableForeignKeyConstraints: true
  });

  try {
    return operation(db);
  } finally {
    db.close();
  }
}


/*
 * TEST 29 — OWNERSHIP REPLACEMENT
 */

test("blocks INSERT OR REPLACE against existing ownership records", async t => {
  const fx = await fixture(t);

  initializeAndGrant(fx);

  const before = fx.state();

  withCharacterDatabase(fx, db => {
    db.exec("PRAGMA recursive_triggers = OFF");

    assert.throws(
      () => db.prepare(`
        INSERT OR REPLACE INTO character_ownership (
          account_id,
          character_id,
          acquired_at,
          acquisition_source
        ) VALUES (?, ?, ?, ?)
      `).run(
        ACCOUNT_A,
        SOLA,
        new Date(START + 1000).toISOString(),
        "trusted_grant"
      ),

      /character_ownership_immutable/
    );
  });

  assert.deepEqual(
    fx.state(),
    before
  );
});


/*
 * TEST 30 — PROFILE REPLACEMENT
 */

test("blocks replacement of an existing character profile", async t => {
  const fx = await fixture(t);

  initializeAndGrant(fx);

  fx.select(SOLA);

  const before = fx.state();

  withCharacterDatabase(fx, db => {
    assert.throws(
      () => db.prepare(`
        INSERT OR REPLACE INTO character_profiles (
          account_id,
          active_character_id,
          created_at,
          updated_at,
          selection_revision
        ) VALUES (?, ?, ?, ?, ?)
      `).run(
        ACCOUNT_A,
        STARTER,
        before.createdAt,
        before.updatedAt,
        1
      ),

      /character_profile_already_exists/
    );
  });

  assert.deepEqual(
    fx.state(),
    before
  );
});


/*
 * TEST 31 — HISTORY REPLACEMENT
 */

test("blocks replacement of existing selection history", async t => {
  const fx = await fixture(t);

  initializeAndGrant(fx);

  fx.select(SOLA);

  const before = fx.history();

  withCharacterDatabase(fx, db => {
    db.exec("PRAGMA recursive_triggers = OFF");

    assert.throws(
      () => db.prepare(`
        INSERT OR REPLACE INTO character_selection_history
        SELECT *
        FROM character_selection_history
        WHERE account_id = ?
          AND selection_revision = 2
      `).run(ACCOUNT_A),

      /character_history_immutable/
    );
  });

  assert.deepEqual(
    fx.history(),
    before
  );
});


/*
 * TEST 32 — UNEXPECTED FUTURE REVISION
 */

test("rejects history entries that do not match the current profile revision", async t => {
  const fx = await fixture(t);

  initializeAndGrant(fx);

  withCharacterDatabase(fx, db => {
    assert.throws(
      () => db.prepare(`
        INSERT INTO character_selection_history (
          account_id,
          selection_revision,
          previous_character_id,
          character_id,
          selected_at
        ) VALUES (?, ?, ?, ?, ?)
      `).run(
        ACCOUNT_A,
        2,
        STARTER,
        SOLA,
        new Date(START).toISOString()
      ),

      /character_history_profile_mismatch/
    );
  });

  assert.equal(
    fx.history().items.length,
    1
  );

  assert.equal(
    fx.state().selectionRevision,
    1
  );
});


/*
 * TEST 33 — INVALID HISTORY SEQUENCE
 */

test("rejects history entries with an incorrect previous character", async t => {
  const fx = await fixture(t);

  initializeAndGrant(fx);

  assert.equal(
    fx.grant(MIKI).granted,
    true
  );

  withCharacterDatabase(fx, db => {
    db.exec("BEGIN IMMEDIATE");

    try {
      db.prepare(`
        UPDATE character_profiles
        SET
          active_character_id = ?,
          selection_revision = 2
        WHERE account_id = ?
      `).run(SOLA, ACCOUNT_A);

      assert.throws(
        () => db.prepare(`
          INSERT INTO character_selection_history (
            account_id,
            selection_revision,
            previous_character_id,
            character_id,
            selected_at
          ) VALUES (?, ?, ?, ?, ?)
        `).run(
          ACCOUNT_A,
          2,
          MIKI,
          SOLA,
          new Date(START).toISOString()
        ),

        /character_history_sequence_invalid/
      );

    } finally {
      db.exec("ROLLBACK");
    }
  });

  assert.equal(
    fx.state().activeCharacterId,
    STARTER
  );

  assert.equal(
    fx.state().selectionRevision,
    1
  );

  assert.equal(
    fx.history().items.length,
    1
  );
});


/*
 * TEST 34 — LIVE PROFILE INTEGRITY
 */

test("denies character access when the profile diverges from selection history", async t => {
  const fx = await fixture(t);

  initializeAndGrant(fx);

  withCharacterDatabase(fx, db => {
    db.prepare(`
      UPDATE character_profiles
      SET active_character_id = ?
      WHERE account_id = ?
    `).run(SOLA, ACCOUNT_A);
  });

  assertDenied(
    fx.state(),
    "character_state_unavailable"
  );

  assertDenied(
    fx.access(STARTER),
    "character_access_unavailable"
  );

  assertDenied(
    fx.access(SOLA),
    "character_access_unavailable"
  );

  assertDenied(
    fx.select(STARTER),
    "character_selection_unavailable"
  );

  assertDenied(
    fx.grant(MIKI),
    "character_grant_unavailable"
  );
});


/*
 * TEST 35 — STARTUP PROFILE AUDIT
 */

test("rejects a database with mismatched profile and history during startup", async t => {
  const fx = await fixture(t);

  initializeAndGrant(fx);

  fx.store.close();

  withCharacterDatabase(fx, db => {
    db.prepare(`
      UPDATE character_profiles
      SET active_character_id = ?
      WHERE account_id = ?
    `).run(SOLA, ACCOUNT_A);
  });

  assert.throws(
    () => fx.open(),

    /character_database_integrity_failed/
  );
});


/*
 * TEST 36 — ORPHANED OWNERSHIP
 */

test("rejects orphaned ownership during startup integrity audit", async t => {
  const fx = await fixture(t);

  fx.initialize();

  fx.store.close();

  withCharacterDatabase(fx, db => {
    db.prepare(`
      INSERT INTO character_ownership (
        account_id,
        character_id,
        acquired_at,
        acquisition_source
      ) VALUES (?, ?, ?, ?)
    `).run(
      ACCOUNT_B,
      SOLA,
      new Date(START).toISOString(),
      "trusted_grant"
    );
  });

  assert.throws(
    () => fx.open(),

    /character_database_integrity_failed/
  );
});


/*
 * TEST 37 — MISSING INTERMEDIATE REVISION
 */

test("detects gaps in persistent selection history during startup", async t => {
  const fx = await fixture(t);

  initializeAndGrant(fx);

  assert.equal(
    fx.select(SOLA).changed,
    true
  );

  assert.equal(
    fx.select(STARTER).changed,
    true
  );

  fx.store.close();

  /*
   * Simulate privileged database damage.
   */

  withCharacterDatabase(fx, db => {
    db.exec(`
      DROP TRIGGER
        character_history_immutable_delete
    `);

    db.prepare(`
      DELETE FROM character_selection_history
      WHERE account_id = ?
        AND selection_revision = 2
    `).run(ACCOUNT_A);
  });

  assert.throws(
    () => fx.open(),

    /character_database_integrity_failed/
  );
});


/*
 * TEST 38 — ACQUISITION CLOCK ROLLBACK
 */

test("rejects grants and selection before the latest acquisition timestamp", async t => {
  const fx = await fixture(t);

  fx.initialize();

  fx.advance(2000);

  assert.equal(
    fx.grant(SOLA).granted,
    true
  );

  fx.setTime(START + 1000);

  assertDenied(
    fx.grant(MIKI),
    "character_clock_rollback"
  );

  assertDenied(
    fx.select(SOLA),
    "character_clock_rollback"
  );

  assertCollection(
    fx.state(),
    ACCOUNT_A,
    STARTER,
    [STARTER, SOLA]
  );

  assert.equal(
    fx.state().selectionRevision,
    1
  );

  /*
   * Resume after the clock catches up.
   */

  fx.setTime(START + 2000);

  assert.equal(
    fx.select(SOLA).changed,
    true
  );

  assert.equal(
    fx.state().selectionRevision,
    2
  );
});


/*
 * TEST 39 — INVALID SERVER CLOCK
 */

test("rejects writes when the character server clock is invalid", async t => {
  const fx = await fixture(t);

  initializeAndGrant(fx);

  const before = fx.state();

  for (const invalidTime of [
    NaN,
    Infinity,
    1.5
  ]) {
    fx.setTime(invalidTime);

    assertDenied(
      fx.grant(MIKI),
      "character_grant_unavailable"
    );

    assertDenied(
      fx.select(SOLA),
      "character_selection_unavailable"
    );

    assertDenied(
      fx.initialize(ACCOUNT_B),
      "character_initialization_unavailable"
    );
  }

  assert.deepEqual(
    fx.state(),
    before
  );

  assertDenied(
    fx.state(ACCOUNT_B),
    "character_profile_not_initialized"
  );
});


/*
 * TEST 40 — INVALID STORED ACQUISITION
 */

test("rejects collection projection containing invalid acquisition timestamps", async t => {
  const fx = await fixture(t);

  initializeAndGrant(fx);

  withCharacterDatabase(fx, db => {
    db.prepare(`
      INSERT INTO character_ownership (
        account_id,
        character_id,
        acquired_at,
        acquisition_source
      ) VALUES (?, ?, ?, ?)
    `).run(
      ACCOUNT_A,
      MIKI,
      "invalid-timestamp",
      "trusted_grant"
    );
  });

  assertDenied(
    fx.state(),
    "character_state_unavailable"
  );

  assertDenied(
    fx.select(SOLA),
    "character_selection_unavailable"
  );
});


/*
 * TEST 41 — ATOMIC INITIALIZATION
 */

test("rolls back starter ownership when initial history persistence fails", async t => {
  const fx = await fixture(t);

  withCharacterDatabase(fx, db => {
    db.exec(`
      CREATE TRIGGER synthetic_initial_history_failure
      BEFORE INSERT ON character_selection_history
      WHEN NEW.selection_revision = 1
      BEGIN
        SELECT RAISE(
          ABORT,
          'synthetic_initial_history_failure'
        );
      END;
    `);
  });

  assertDenied(
    fx.initialize(),
    "character_initialization_unavailable"
  );

  assertDenied(
    fx.state(),
    "character_profile_not_initialized"
  );

  withCharacterDatabase(fx, db => {
    const ownership = db.prepare(`
      SELECT COUNT(*) AS total
      FROM character_ownership
      WHERE account_id = ?
    `).get(ACCOUNT_A);

    const profiles = db.prepare(`
      SELECT COUNT(*) AS total
      FROM character_profiles
      WHERE account_id = ?
    `).get(ACCOUNT_A);

    const history = db.prepare(`
      SELECT COUNT(*) AS total
      FROM character_selection_history
      WHERE account_id = ?
    `).get(ACCOUNT_A);

    assert.equal(ownership.total, 0);
    assert.equal(profiles.total, 0);
    assert.equal(history.total, 0);

    db.exec(`
      DROP TRIGGER synthetic_initial_history_failure
    `);
  });

  assertCollection(
    fx.initialize(),
    ACCOUNT_A,
    STARTER,
    [STARTER]
  );
});


import test from "node:test";
import assert from "node:assert/strict";

import {
  randomBytes,
  createHash
} from "node:crypto";

import {
  mkdtemp,
  mkdir,
  readFile,
  writeFile,
  copyFile,
  readdir,
  stat,
  rm
} from "node:fs/promises";

import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  createMemoryIdentity,
  createMemoryRecord,
  validateMemoryRecord,
  memoryBelongsTo
} from "./lago-agent-memory-contract.mjs";

import {
  createLagoAgentMemoryStore
} from "./lago-agent-memory-store.mjs";


/*
 * LAGO GAME
 * R2.6E2 — MEMORY SECURITY TESTS
 *
 * Synthetic data only.
 * Temporary directories.
 * No production keys or records.
 */

const ACCOUNT_A =
  "lago_" + "A".repeat(22);

const ACCOUNT_B =
  "lago_" + "B".repeat(22);

const LAGO_A =
  createMemoryIdentity(
    ACCOUNT_A,
    "lago"
  );

const LAGO_B =
  createMemoryIdentity(
    ACCOUNT_B,
    "lago"
  );

const SOLA_A =
  createMemoryIdentity(
    ACCOUNT_A,
    "comic_pink_snail"
  );


/*
 * ISOLATED TEST FIXTURE
 */

async function fixture(t) {

  const base = await mkdtemp(
    join(tmpdir(), "lago-memory-test-")
  );

  t.after(async () => {

    await rm(base, {
      recursive: true,
      force: true
    });

  });


  const projectRoot =
    join(base, "project");

  const directory =
    join(base, "private-memory");


  await mkdir(projectRoot, {
    mode: 0o700
  });


  const encryptionKey =
    randomBytes(32);


  function createStore(overrides = {}) {

    return createLagoAgentMemoryStore({

      directory,

      projectRoot,

      encryptionKey,

      ...overrides

    });

  }


  function file(identity) {

    const partition =
      createHash("sha256")
        .update(identity.agentId, "utf8")
        .digest("hex");

    return join(
      directory,
      partition + ".memory"
    );

  }


  return {

    base,

    directory,

    projectRoot,

    encryptionKey,

    store: createStore(),

    createStore,

    file

  };

}


function record(
  identity,
  content = "Synthetic test memory."
) {

  const entry =
    createMemoryRecord({

      accountId:
        identity.accountId,

      characterId:
        identity.characterId,

      category: "owner",

      content,

      importance: 75

    });


  assert.ok(entry);

  assert.equal(
    validateMemoryRecord(entry),
    true
  );

  return entry;

}


/*
 * TEST 01 — CANONICAL IDENTITY
 */

test(
  "memory identities isolate accounts and characters",
  () => {

    assert.ok(LAGO_A);
    assert.ok(LAGO_B);
    assert.ok(SOLA_A);

    assert.notEqual(
      LAGO_A.agentId,
      LAGO_B.agentId
    );

    assert.notEqual(
      LAGO_A.agentId,
      SOLA_A.agentId
    );

    const entry = record(LAGO_A);

    assert.equal(
      memoryBelongsTo(entry, LAGO_A),
      true
    );

    assert.equal(
      memoryBelongsTo(entry, LAGO_B),
      false
    );

    assert.equal(
      memoryBelongsTo(entry, SOLA_A),
      false
    );

  }
);


/*
 * TEST 02 — INVALID CONFIGURATION
 */

test(
  "rejects insecure storage configuration",
  async t => {

    const fx = await fixture(t);

    assert.throws(
      () => fx.createStore({
        encryptionKey: Buffer.alloc(16)
      }),
      /memory_encryption_key_required/
    );

    assert.throws(
      () => fx.createStore({
        directory: "relative-directory"
      }),
      /absolute_memory_paths_required/
    );

    assert.throws(
      () => fx.createStore({
        directory: join(
          fx.projectRoot,
          "private-memory"
        )
      }),
      /memory_directory_inside_project/
    );

  }
);


/*
 * TEST 03 — PERSISTENCE
 */

test(
  "persists memory across store instances",
  async t => {

    const fx = await fixture(t);

    const empty =
      await fx.store.list(LAGO_A);

    assert.equal(empty.count, 0);


    const entry = record(
      LAGO_A,
      "Persistent synthetic memory."
    );

    const added =
      await fx.store.add(
        LAGO_A,
        entry
      );

    assert.equal(added.ok, true);
    assert.equal(added.count, 1);


    const restarted =
      fx.createStore();

    const restored =
      await restarted.list(LAGO_A);

    assert.equal(restored.count, 1);

    assert.deepEqual(
      restored.records[0],
      entry
    );

  }
);


/*
 * TEST 04 — ENCRYPTION AT REST
 */

test(
  "encrypts private content and uses fresh IVs",
  async t => {

    const fx = await fixture(t);

    const secret =
      "LAGO_SYNTHETIC_PRIVATE_MEMORY_001";

    const entry = record(
      LAGO_A,
      secret
    );

    await fx.store.add(
      LAGO_A,
      entry
    );


    const file = fx.file(LAGO_A);

    const firstRaw =
      await readFile(file, "utf8");

    const first =
      JSON.parse(firstRaw);


    assert.equal(
      firstRaw.includes(secret),
      false
    );

    assert.equal(
      firstRaw.includes(
        LAGO_A.accountId
      ),
      false
    );

    assert.equal(
      first.algorithm,
      "aes-256-gcm"
    );

    assert.equal(
      Buffer.from(first.iv, "base64").length,
      12
    );

    assert.equal(
      Buffer.from(first.tag, "base64").length,
      16
    );


    await fx.store.add(
      LAGO_A,
      record(LAGO_A, "Second memory.")
    );


    const second = JSON.parse(
      await readFile(file, "utf8")
    );

    assert.notEqual(
      first.iv,
      second.iv
    );


    if (process.platform !== "win32") {

      const info = await stat(file);

      assert.equal(
        info.mode & 0o077,
        0
      );

    }

  }
);


/*
 * TEST 05 — ACCOUNT ISOLATION
 */

test(
  "separates users with the same character",
  async t => {

    const fx = await fixture(t);

    const a = record(
      LAGO_A,
      "Player A memory."
    );

    const b = record(
      LAGO_B,
      "Player B memory."
    );


    await fx.store.add(LAGO_A, a);
    await fx.store.add(LAGO_B, b);


    const resultA =
      await fx.store.list(LAGO_A);

    const resultB =
      await fx.store.list(LAGO_B);


    assert.deepEqual(
      resultA.records,
      [a]
    );

    assert.deepEqual(
      resultB.records,
      [b]
    );


    const rejected =
      await fx.store.add(
        LAGO_B,
        a
      );

    assert.equal(rejected.ok, false);

    assert.equal(
      rejected.reason,
      "identity_mismatch"
    );


    assert.equal(
      (await fx.store.remove(
        LAGO_B,
        a.memoryId
      )).reason,
      "memory_not_found"
    );

  }
);


/*
 * TEST 06 — CHARACTER ISOLATION
 */

test(
  "preserves separate memories for each character",
  async t => {

    const fx = await fixture(t);

    const lago = record(
      LAGO_A,
      "Lago memory."
    );

    const sola = record(
      SOLA_A,
      "Sola memory."
    );


    await fx.store.add(LAGO_A, lago);
    await fx.store.add(SOLA_A, sola);


    assert.deepEqual(
      (await fx.store.list(LAGO_A)).records,
      [lago]
    );

    assert.deepEqual(
      (await fx.store.list(SOLA_A)).records,
      [sola]
    );


    await fx.store.clear(SOLA_A);


    assert.equal(
      (await fx.store.list(SOLA_A)).count,
      0
    );

    assert.equal(
      (await fx.store.list(LAGO_A)).count,
      1
    );

  }
);


/*
 * TEST 07 — DUPLICATE AND INVALID RECORDS
 */

test(
  "rejects duplicate and malformed records",
  async t => {

    const fx = await fixture(t);

    const entry = record(LAGO_A);

    await fx.store.add(LAGO_A, entry);


    const duplicate =
      await fx.store.add(
        LAGO_A,
        entry
      );

    assert.equal(
      duplicate.reason,
      "duplicate_memory_id"
    );


    const invalid =
      await fx.store.add(
        LAGO_A,
        {
          ...entry,
          importance: 101
        }
      );

    assert.equal(
      invalid.reason,
      "invalid_memory_record"
    );


    assert.equal(
      (await fx.store.list(LAGO_A)).count,
      1
    );

  }
);


/*
 * TEST 08 — WRONG ENCRYPTION KEY
 */

test(
  "rejects decryption using an incorrect key",
  async t => {

    const fx = await fixture(t);

    await fx.store.add(
      LAGO_A,
      record(LAGO_A)
    );


    const wrongKey =
      Buffer.from(fx.encryptionKey);

    wrongKey[0] ^= 1;


    const wrongStore =
      fx.createStore({
        encryptionKey: wrongKey
      });


    await assert.rejects(
      wrongStore.list(LAGO_A),
      /memory_integrity_check_failed/
    );


    assert.equal(
      (await fx.store.list(LAGO_A)).count,
      1
    );

  }
);


/*
 * TEST 09 — TAMPER DETECTION
 */

test(
  "rejects tampered files without overwriting them",
  async t => {

    const fx = await fixture(t);

    await fx.store.add(
      LAGO_A,
      record(LAGO_A)
    );


    const file = fx.file(LAGO_A);

    const envelope = JSON.parse(
      await readFile(file, "utf8")
    );


    const ciphertext = Buffer.from(
      envelope.ciphertext,
      "base64"
    );

    ciphertext[0] ^= 1;

    envelope.ciphertext =
      ciphertext.toString("base64");


    const corrupted =
      JSON.stringify(envelope);

    await writeFile(
      file,
      corrupted,
      "utf8"
    );


    await assert.rejects(
      fx.store.list(LAGO_A),
      /memory_integrity_check_failed/
    );


    await assert.rejects(
      fx.store.add(
        LAGO_A,
        record(LAGO_A, "New memory.")
      ),
      /memory_integrity_check_failed/
    );


    assert.equal(
      await readFile(file, "utf8"),
      corrupted
    );

  }
);


/*
 * TEST 10 — PARTITION SUBSTITUTION
 */

test(
  "rejects encrypted files copied between identities",
  async t => {

    const fx = await fixture(t);

    await fx.store.add(
      LAGO_A,
      record(LAGO_A)
    );


    await copyFile(
      fx.file(LAGO_A),
      fx.file(LAGO_B)
    );


    await assert.rejects(
      fx.store.list(LAGO_B),
      /memory_integrity_check_failed/
    );


    assert.equal(
      (await fx.store.list(LAGO_A)).count,
      1
    );

  }
);


/*
 * TEST 11 — DELETION
 */

test(
  "persists individual and complete deletion",
  async t => {

    const fx = await fixture(t);

    const a = record(LAGO_A, "Memory A");
    const b = record(LAGO_A, "Memory B");

    await fx.store.add(LAGO_A, a);
    await fx.store.add(LAGO_A, b);


    const removed =
      await fx.store.remove(
        LAGO_A,
        a.memoryId
      );

    assert.equal(removed.ok, true);
    assert.equal(removed.deletedCount, 1);


    const restarted =
      fx.createStore();

    assert.deepEqual(
      (await restarted.list(LAGO_A)).records,
      [b]
    );


    const cleared =
      await restarted.clear(LAGO_A);

    assert.equal(cleared.ok, true);
    assert.equal(cleared.deletedCount, 1);


    assert.equal(
      (await fx.createStore().list(LAGO_A)).count,
      0
    );

  }
);


/*
 * TEST 12 — CONCURRENT WRITES
 */

test(
  "serializes concurrent writes without losing records",
  async t => {

    const fx = await fixture(t);

    const entries = Array.from(
      { length: 25 },
      (_, index) => record(
        LAGO_A,
        "Concurrent memory " + index
      )
    );


    const results = await Promise.all(

      entries.map(
        entry => fx.store.add(
          LAGO_A,
          entry
        )
      )

    );


    assert.ok(
      results.every(
        result => result.ok === true
      )
    );


    const restored =
      await fx.createStore().list(LAGO_A);

    assert.equal(restored.count, 25);

    assert.deepEqual(
      new Set(
        restored.records.map(
          item => item.memoryId
        )
      ),
      new Set(
        entries.map(
          item => item.memoryId
        )
      )
    );


    const files =
      await readdir(fx.directory);

    assert.equal(
      files.some(
        name => name.endsWith(".tmp")
      ),
      false
    );

  }
);


/*
 * TEST 13 — STORAGE CAPACITY
 */

test(
  "enforces the per-character memory limit",
  async t => {

    const fx = await fixture(t);

    const results = await Promise.all(

      Array.from(
        { length: 201 },
        (_, index) => fx.store.add(
          LAGO_A,
          record(
            LAGO_A,
            "Capacity test " + index
          )
        )
      )

    );


    assert.equal(
      results.filter(
        result => result.ok === true
      ).length,
      200
    );

    assert.equal(
      results[200].reason,
      "memory_limit_reached"
    );

    assert.equal(
      (await fx.store.list(LAGO_A)).count,
      200
    );

  }
);


import test from "node:test";
import assert from "node:assert/strict";

import { randomBytes } from "node:crypto";

import {
  mkdtemp,
  mkdir,
  rm
} from "node:fs/promises";

import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  createLagoAccountSessionStore
} from "./lago-account-session-store.mjs";

import {
  createMemoryIdentity,
  createMemoryRecord
} from "./lago-agent-memory-contract.mjs";

import {
  createLagoAgentMemoryStore
} from "./lago-agent-memory-store.mjs";

import {
  createLagoMemoryAccess
} from "./lago-agent-memory-access.mjs";

import {
  createLagoMemoryManagement
} from "./lago-agent-memory-management.mjs";


/*
 * LAGO GAME
 * R2.6G1 — MEMORY MANAGEMENT TESTS
 *
 * Real session store.
 * Real encrypted memory store.
 * Real access control.
 * Real memory management.
 *
 * Synthetic character access provider.
 * No production accounts or keys.
 */

const LAGO = "lago";

const SOLA = "comic_pink_snail";


/*
 * INTEGRATION FIXTURE
 */

async function fixture(t) {

  const base = await mkdtemp(

    join(
      tmpdir(),
      "lago-management-test-"
    )

  );


  t.after(async () => {

    await rm(base, {

      recursive: true,

      force: true

    });

  });


  const projectRoot =
    join(base, "project");

  await mkdir(projectRoot);


  let currentTime =
    Date.parse(
      "2026-11-15T12:00:00.000Z"
    );


  const now =
    () => currentTime;


  /*
   * REAL ACCOUNT AND SESSION STORE
   */

  const sessions =
    createLagoAccountSessionStore({

      filePath:
        join(base, "accounts.json"),

      now

    });


  const accountA =
    await sessions.upsertVerifiedTelegramUser({

      id: "100001",

      username: "synthetic_a"

    });


  const accountB =
    await sessions.upsertVerifiedTelegramUser({

      id: "100002",

      username: "synthetic_b"

    });


  assert.equal(accountA.ok, true);
  assert.equal(accountB.ok, true);


  const accountIdA =
    accountA.account.accountId;

  const accountIdB =
    accountB.account.accountId;


  const sessionA =
    await sessions.createSession(

      accountIdA,

      { ttlSeconds: 3600 }

    );


  const sessionB =
    await sessions.createSession(

      accountIdB,

      { ttlSeconds: 3600 }

    );


  assert.equal(sessionA.ok, true);
  assert.equal(sessionB.ok, true);


  /*
   * SYNTHETIC CHARACTER OWNERSHIP
   */

  const ownership = new Map([

    [
      accountIdA,
      new Set([LAGO, SOLA])
    ],

    [
      accountIdB,
      new Set([LAGO])
    ]

  ]);


  /*
   * REAL ACCESS CONTROL
   *
   * No AI subscription.
   * No AI memory consent.
   *
   * Owner management must still work.
   */

  const access =
    createLagoMemoryAccess({

      sessionStore: sessions,

      now,

      async getCharacterAccess({

        accountId,

        characterId

      }) {

        const owned =

          ownership
            .get(accountId)
            ?.has(characterId) === true;


        return {

          serverVerified: true,

          accountId,

          characterId,

          owned,

          memoryAccessAllowed: owned,

          activeCharacterId: LAGO

        };

      },

      getConsent: null,

      getSubscription: null

    });


  /*
   * REAL ENCRYPTED STORAGE
   */

  const storageOptions = {

    directory:
      join(base, "private-memory"),

    projectRoot,

    encryptionKey:
      randomBytes(32)

  };


  const memoryStore =
    createLagoAgentMemoryStore(
      storageOptions
    );


  const management =
    createLagoMemoryManagement({

      access,

      memoryStore

    });


  const identityA =
    createMemoryIdentity(
      accountIdA,
      LAGO
    );

  const identityB =
    createMemoryIdentity(
      accountIdB,
      LAGO
    );

  const identitySola =
    createMemoryIdentity(
      accountIdA,
      SOLA
    );


  /*
   * INSERT SYNTHETIC TEST RECORD
   *
   * Internal fixture only.
   * Not a public collection endpoint.
   */

  async function seed(

    identity,

    category = "owner",

    content = "Synthetic memory."

  ) {

    const record =
      createMemoryRecord({

        accountId:
          identity.accountId,

        characterId:
          identity.characterId,

        category,

        content,

        importance: 70

      });


    assert.ok(record);


    const result =
      await memoryStore.add(
        identity,
        record
      );


    assert.equal(result.ok, true);

    return record;

  }


  return {

    sessions,

    access,

    memoryStore,

    management,

    storageOptions,

    ownership,

    identityA,

    identityB,

    identitySola,

    tokenA: sessionA.token,

    tokenB: sessionB.token,

    seed,

    advance(milliseconds) {

      currentTime += milliseconds;

    }

  };

}


/*
 * TEST 01 — REQUIRED SERVICES
 */

test(
  "requires authorization and storage services",
  () => {

    assert.throws(

      () => createLagoMemoryManagement({}),

      /memory_access_service_required/

    );


    assert.throws(

      () => createLagoMemoryManagement({

        access: {

          authorize: async () => null

        }

      }),

      /memory_store_required/

    );

  }
);


/*
 * TEST 02 — OWNER MEMORY REVIEW
 */

test(
  "allows authenticated memory review without subscription",
  async t => {

    const fx = await fixture(t);


    await fx.seed(
      fx.identityA,
      "owner",
      "Player preference."
    );


    await fx.seed(
      fx.identityA,
      "gameplay",
      "Completed game."
    );


    const result =
      await fx.management.review({

        sessionToken: fx.tokenA,

        characterId: LAGO

      });


    assert.equal(result.ok, true);

    assert.equal(
      result.records.length,
      2
    );

    assert.equal(
      result.summary.totalRecords,
      2
    );

    assert.equal(
      result.summary.maxRecords,
      200
    );

    assert.equal(
      result.summary.remainingRecords,
      198
    );

    assert.equal(
      result.summary.usagePercent,
      1
    );

    assert.equal(
      result.summary.categories.owner,
      1
    );

    assert.equal(
      result.summary.categories.gameplay,
      1
    );

    assert.equal(
      result.summary.categories.trading,
      0
    );

  }
);


/*
 * TEST 03 — ACCOUNT ISOLATION
 */

test(
  "never exposes another account's memory",
  async t => {

    const fx = await fixture(t);


    const a =
      await fx.seed(

        fx.identityA,

        "owner",

        "Private memory A."

      );


    const b =
      await fx.seed(

        fx.identityB,

        "owner",

        "Private memory B."

      );


    const result =
      await fx.management.review({

        sessionToken: fx.tokenB,

        characterId: LAGO,

        accountId:
          fx.identityA.accountId,

        identity:
          fx.identityA

      });


    assert.equal(result.ok, true);

    assert.deepEqual(
      result.records,
      [b]
    );


    assert.equal(

      JSON.stringify(result).includes(
        a.content
      ),

      false

    );

  }
);


/*
 * TEST 04 — CHARACTER ISOLATION
 */

test(
  "keeps active and inactive character memories separate",
  async t => {

    const fx = await fixture(t);


    const lago =
      await fx.seed(
        fx.identityA
      );


    const sola =
      await fx.seed(
        fx.identitySola
      );


    const lagoResult =
      await fx.management.review({

        sessionToken: fx.tokenA,

        characterId: LAGO

      });


    const solaResult =
      await fx.management.review({

        sessionToken: fx.tokenA,

        characterId: SOLA

      });


    assert.deepEqual(
      lagoResult.records,
      [lago]
    );


    assert.deepEqual(
      solaResult.records,
      [sola]
    );


    const forbidden =
      await fx.management.review({

        sessionToken: fx.tokenB,

        characterId: SOLA

      });


    assert.deepEqual(forbidden, {

      ok: false,

      reason: "memory_access_denied"

    });

  }
);


/*
 * TEST 05 — MEMORY EXPORT
 */

test(
  "exports only canonical owner memory records",
  async t => {

    const fx = await fixture(t);


    const entry =
      await fx.seed(
        fx.identityA
      );


    await fx.seed(
      fx.identityB
    );


    const result =
      await fx.management.exportMemory({

        sessionToken: fx.tokenA,

        characterId: LAGO

      });


    assert.equal(result.ok, true);

    assert.equal(

      result.filename,

      "lago-memory-lago.json"

    );

    assert.equal(

      result.contentType,

      "application/json; charset=utf-8"

    );

    assert.equal(

      result.data.format,

      "lago-personal-memory"

    );

    assert.equal(
      result.data.exportVersion,
      1
    );

    assert.ok(

      Number.isFinite(
        Date.parse(
          result.data.exportedAt
        )
      )

    );


    assert.deepEqual(

      result.data.records,

      [entry]

    );


    assert.equal(

      JSON.stringify(result).includes(
        fx.tokenA
      ),

      false

    );


    assert.equal(

      JSON.stringify(result).includes(

        fx.storageOptions
          .encryptionKey
          .toString("base64")

      ),

      false

    );

  }
);


/*
 * TEST 06 — INDIVIDUAL DELETION
 */

test(
  "deletes only the requested memory",
  async t => {

    const fx = await fixture(t);


    const first =
      await fx.seed(
        fx.identityA
      );


    const second =
      await fx.seed(
        fx.identityA
      );


    const deleted =
      await fx.management.deleteMemory({

        sessionToken: fx.tokenA,

        characterId: LAGO,

        memoryId: first.memoryId

      });


    assert.equal(deleted.ok, true);

    assert.equal(
      deleted.deletedCount,
      1
    );

    assert.equal(
      deleted.remainingRecords,
      1
    );


    const restarted =
      createLagoAgentMemoryStore(
        fx.storageOptions
      );


    const remaining =
      await restarted.list(
        fx.identityA
      );


    assert.deepEqual(

      remaining.records,

      [second]

    );

  }
);


/*
 * TEST 07 — CROSS-ACCOUNT DELETION
 */

test(
  "cannot delete another account's memory",
  async t => {

    const fx = await fixture(t);


    const entry =
      await fx.seed(
        fx.identityA
      );


    const result =
      await fx.management.deleteMemory({

        sessionToken: fx.tokenB,

        characterId: LAGO,

        memoryId: entry.memoryId,

        accountId:
          fx.identityA.accountId

      });


    assert.deepEqual(result, {

      ok: false,

      reason: "memory_not_found"

    });


    assert.deepEqual(

      (
        await fx.memoryStore.list(
          fx.identityA
        )
      ).records,

      [entry]

    );

  }
);


/*
 * TEST 08 — CLEAR CONFIRMATION
 */

test(
  "requires confirmation before clearing memory",
  async t => {

    const fx = await fixture(t);


    await fx.seed(
      fx.identityA
    );


    for (const confirmation of [

      null,

      false,

      true,

      "DELETE",

      ""

    ]) {

      const result =
        await fx.management.clearMemory({

          sessionToken: fx.tokenA,

          characterId: LAGO,

          confirmation

        });


      assert.deepEqual(result, {

        ok: false,

        reason:
          "clear_confirmation_required"

      });

    }


    assert.equal(

      (
        await fx.memoryStore.list(
          fx.identityA
        )
      ).count,

      1

    );

  }
);


/*
 * TEST 09 — ISOLATED CLEAR
 */

test(
  "clears only the selected character partition",
  async t => {

    const fx = await fixture(t);


    await fx.seed(fx.identityA);
    await fx.seed(fx.identityA);

    await fx.seed(fx.identityB);
    await fx.seed(fx.identitySola);


    const result =
      await fx.management.clearMemory({

        sessionToken: fx.tokenA,

        characterId: LAGO,

        confirmation:
          "CLEAR_CHARACTER_MEMORY"

      });


    assert.equal(result.ok, true);

    assert.equal(result.deletedCount, 2);

    assert.equal(result.remainingRecords, 0);

    assert.equal(result.accountPreserved, true);

    assert.equal(result.characterPreserved, true);


    assert.equal(

      (
        await fx.memoryStore.list(
          fx.identityA
        )
      ).count,

      0

    );


    assert.equal(

      (
        await fx.memoryStore.list(
          fx.identityB
        )
      ).count,

      1

    );


    assert.equal(

      (
        await fx.memoryStore.list(
          fx.identitySola
        )
      ).count,

      1

    );


    assert.equal(

      (
        await fx.sessions.restoreSession(
          fx.tokenA
        )
      ).ok,

      true

    );

  }
);


/*
 * TEST 10 — SESSION REVOCATION
 */

test(
  "denies memory operations after logout",
  async t => {

    const fx = await fixture(t);


    const entry =
      await fx.seed(
        fx.identityA
      );


    await fx.sessions.revokeSession(
      fx.tokenA
    );


    const input = {

      sessionToken: fx.tokenA,

      characterId: LAGO

    };


    const results = [

      await fx.management.review(input),

      await fx.management.exportMemory(input),

      await fx.management.deleteMemory({

        ...input,

        memoryId: entry.memoryId

      }),

      await fx.management.clearMemory({

        ...input,

        confirmation:
          "CLEAR_CHARACTER_MEMORY"

      })

    ];


    for (const result of results) {

      assert.deepEqual(result, {

        ok: false,

        reason: "memory_access_denied"

      });

    }


    assert.equal(

      (
        await fx.memoryStore.list(
          fx.identityA
        )
      ).count,

      1

    );

  }
);


/*
 * TEST 11 — SESSION EXPIRATION
 */

test(
  "denies expired sessions while preserving memory",
  async t => {

    const fx = await fixture(t);


    await fx.seed(
      fx.identityA
    );


    fx.advance(
      3600 * 1000
    );


    const result =
      await fx.management.review({

        sessionToken: fx.tokenA,

        characterId: LAGO

      });


    assert.deepEqual(result, {

      ok: false,

      reason: "memory_access_denied"

    });


    assert.equal(

      (
        await fx.memoryStore.list(
          fx.identityA
        )
      ).count,

      1

    );

  }
);


/*
 * TEST 12 — AI ACCESS REMAINS LOCKED
 */

test(
  "owner management does not activate paid AI",
  async t => {

    const fx = await fixture(t);


    await fx.seed(
      fx.identityA
    );


    const review =
      await fx.management.review({

        sessionToken: fx.tokenA,

        characterId: LAGO

      });


    assert.equal(review.ok, true);


    const recall =
      await fx.access.authorize({

        sessionToken: fx.tokenA,

        characterId: LAGO,

        action: "recall",

        category: "owner"

      });


    assert.equal(recall.ok, false);

    assert.equal(recall.authorized, false);

    assert.equal(recall.tradingAuthorized, false);

    assert.equal(

      recall.reason,

      "consent_service_unavailable"

    );

  }
);


/*
 * TEST 13 — FOREIGN STORE RECORD
 */

test(
  "rejects foreign records returned by storage",
  async t => {

    const fx = await fixture(t);


    const foreign =
      await fx.seed(
        fx.identityB
      );


    const management =
      createLagoMemoryManagement({

        access: fx.access,

        memoryStore: {

          ...fx.memoryStore,

          async list() {

            return {

              ok: true,

              count: 1,

              records: [foreign]

            };

          }

        }

      });


    const result =
      await management.review({

        sessionToken: fx.tokenA,

        characterId: LAGO

      });


    assert.deepEqual(result, {

      ok: false,

      reason:
        "memory_management_unavailable"

    });

  }
);


/*
 * TEST 14 — STORAGE FAILURE
 */

test(
  "never exposes internal storage errors",
  async t => {

    const fx = await fixture(t);


    const management =
      createLagoMemoryManagement({

        access: fx.access,

        memoryStore: {

          ...fx.memoryStore,

          async list() {

            throw new Error(
              "SYNTHETIC_PRIVATE_STORAGE_ERROR"
            );

          }

        }

      });


    const result =
      await management.review({

        sessionToken: fx.tokenA,

        characterId: LAGO

      });


    assert.equal(result.ok, false);


    assert.equal(

      result.reason,

      "memory_management_unavailable"

    );


    assert.equal(

      JSON.stringify(result).includes(
        "SYNTHETIC_PRIVATE_STORAGE_ERROR"
      ),

      false

    );

  }
);

import test from "node:test";
import assert from "node:assert/strict";

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
  createLagoCharacterStore
} from "./lago-agent-character-store.mjs";

import {
  CHARACTER_SERVICE_VERSION,
  createLagoCharacterService
} from "./lago-agent-character-service.mjs";

/*
 * LAGO GAME
 * R2.8B3A — AUTHENTICATED CHARACTER SERVICE TESTS
 *
 * Real account sessions.
 * Real SQLite character ownership.
 * Account isolation.
 * Strict response projection.
 * Session expiration and cancellation.
 *
 * No real payments.
 * No AI execution.
 * No trading.
 */

const START = Date.parse(
  "2027-01-31T12:00:00.000Z"
);

const STARTER = "lago";
const SOLA = "comic_pink_snail";
const MIKI = "comic_goose";

const LOCKED_FIELDS = Object.freeze([
  "aiEnabled",
  "runtimeAuthorized",
  "memoryAuthorized",
  "learningAuthorized",
  "tradingAuthorized",
  "externalModelTrainingAuthorized"
]);


/*
 * REAL SERVER FIXTURE
 */

async function fixture(t) {
  const root = await mkdtemp(
    join(tmpdir(), "lago-character-service-")
  );

  const projectRoot = join(root, "project");
  const directory = join(root, "private-characters");

  let clock = START;

  const now = () => clock;

  const services = [];

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

  const sessions = createLagoAccountSessionStore({
    filePath: join(root, "accounts.json"),
    now
  });

  async function createPlayer(id) {
    const account =
      await sessions.upsertVerifiedTelegramUser({
        id,
        username: "synthetic_" + id
      });

    assert.equal(account.ok, true);

    const accountId = account.account.accountId;

    const session = await sessions.createSession(
      accountId,
      { ttlSeconds: 3600 }
    );

    assert.equal(session.ok, true);

    return {
      accountId,
      token: session.token
    };
  }

  const playerA = await createPlayer("100001");
  const playerB = await createPlayer("100002");

  const characterStore = createLagoCharacterStore({
    directory,
    projectRoot,
    trustedGrantsEnabled: true,
    now
  });

  services.push(characterStore);

  function createService(changes = {}) {
    const service = createLagoCharacterService({
      sessionStore: sessions,
      characterStore,
      now,
      ...changes
    });

    services.push(service);

    return service;
  }

  const service = createService();

  function input(
    player = playerA,
    changes = {}
  ) {
    return {
      sessionToken: player.token,
      ...changes
    };
  }

  return {
    sessions,
    characterStore,
    playerA,
    playerB,
    service,
    createService,
    input,

    initialize(player = playerA) {
      return service.initializeAccount(
        input(player)
      );
    },

    state(player = playerA) {
      return service.getState(
        input(player)
      );
    },

    select(
      characterId,
      player = playerA
    ) {
      return service.selectCharacter(
        input(player, { characterId })
      );
    },

    history(
      changes = {},
      player = playerA
    ) {
      return service.getHistory(
        input(player, changes)
      );
    },

    grant(
      characterId,
      player = playerA
    ) {
      return characterStore.recordTrustedGrant({
        accountId: player.accountId,
        characterId
      });
    },

    rawState(player = playerA) {
      return characterStore.getState({
        accountId: player.accountId
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

function assertLocked(result) {
  for (const field of LOCKED_FIELDS) {
    assert.equal(
      result[field],
      false,
      field
    );
  }
}

function assertDenied(result, reason) {
  assert.equal(result.ok, false);
  assert.equal(result.authenticated, false);
  assert.equal(result.serverVerified, false);

  assert.equal(result.accountId, null);
  assert.equal(result.activeCharacterId, null);
  assert.equal(result.selectionRevision, null);

  assert.deepEqual(result.ownedCharacters, []);
  assert.deepEqual(result.ownedCharacterIds, []);

  assert.equal(result.reason, reason);

  assert.equal(Object.isFrozen(result), true);

  assertLocked(result);
}

function assertAuthenticated(result, player) {
  assert.equal(result.ok, true);
  assert.equal(result.authenticated, true);
  assert.equal(result.serverVerified, true);

  assert.equal(
    result.version,
    CHARACTER_SERVICE_VERSION
  );

  assert.equal(
    result.accountId,
    player.accountId
  );

  assert.equal(result.reason, null);

  assert.equal(Object.isFrozen(result), true);

  assertLocked(result);
}

function assertCollection(
  result,
  player,
  active,
  owned
) {
  assertAuthenticated(result, player);

  assert.equal(
    result.activeCharacterId,
    active
  );

  assert.deepEqual(
    [...result.ownedCharacterIds].sort(),
    [...owned].sort()
  );

  assert.equal(result.maxActiveAgents, 1);

  assert.equal(
    Object.isFrozen(result.ownedCharacters),
    true
  );

  assert.equal(
    Object.isFrozen(result.ownedCharacterIds),
    true
  );

  for (const item of result.ownedCharacters) {
    assert.equal(Object.isFrozen(item), true);
  }
}

async function initializeAndGrant(fx) {
  assert.equal(
    (await fx.initialize()).ok,
    true
  );

  assert.equal(
    fx.grant(SOLA).granted,
    true
  );
}


/*
 * TEST 01 — REQUIRED CONFIGURATION
 */

test("requires valid character service dependencies", () => {
  assert.throws(
    () => createLagoCharacterService(),
    /character_session_store_required/
  );

  const sessionStore = {
    async restoreSession() {
      return null;
    }
  };

  assert.throws(
    () => createLagoCharacterService({
      sessionStore
    }),
    /character_store_required/
  );

  const characterStore = {
    initializeAccount() {},
    getState() {},
    selectCharacter() {},
    getHistory() {}
  };

  assert.throws(
    () => createLagoCharacterService({
      sessionStore,
      characterStore,
      now: null
    }),
    /invalid_character_service_clock/
  );
});


/*
 * TEST 02 — GUEST ACCESS
 */

test("rejects all character operations without authentication", async t => {
  const fx = await fixture(t);

  const results = await Promise.all([
    fx.service.initializeAccount(),
    fx.service.getState(),
    fx.service.selectCharacter({
      characterId: STARTER
    }),
    fx.service.getHistory()
  ]);

  for (const result of results) {
    assertDenied(
      result,
      "authentication_required"
    );
  }

  assert.equal(
    fx.rawState().reason,
    "character_profile_not_initialized"
  );
});


/*
 * TEST 03 — INVALID SESSION TOKENS
 */

test("rejects invalid and oversized session tokens", async t => {
  const fx = await fixture(t);

  for (const sessionToken of [
    null,
    "",
    " ",
    123,
    {},
    "invalid-token",
    "a".repeat(257),
    " " + fx.playerA.token
  ]) {
    assertDenied(
      await fx.service.initializeAccount({
        sessionToken
      }),
      "authentication_required"
    );
  }
});


/*
 * TEST 04 — MALFORMED REQUESTS
 */

test("rejects malformed character service requests", async t => {
  const fx = await fixture(t);

  for (const value of [
    null,
    [],
    true,
    42,
    "invalid"
  ]) {
    assertDenied(
      await fx.service.getState(value),
      "invalid_character_service_request"
    );
  }
});


/*
 * TEST 05 — AUTHENTICATED INITIALIZATION
 */

test("initializes the authenticated account starter collection", async t => {
  const fx = await fixture(t);

  const result = await fx.initialize();

  assertCollection(
    result,
    fx.playerA,
    STARTER,
    [STARTER]
  );

  assert.equal(result.initialized, true);
  assert.equal(result.selectionRevision, 1);

  assert.equal(
    result.ownedCharacters[0].acquisitionSource,
    "starter"
  );

  assert.equal(
    fx.rawState().activeCharacterId,
    STARTER
  );
});


/*
 * TEST 06 — IDEMPOTENT INITIALIZATION
 */

test("preserves existing ownership and selection during reinitialization", async t => {
  const fx = await fixture(t);

  await initializeAndGrant(fx);

  await fx.select(SOLA);

  const result = await fx.initialize();

  assertCollection(
    result,
    fx.playerA,
    SOLA,
    [STARTER, SOLA]
  );

  assert.equal(result.initialized, false);
  assert.equal(result.selectionRevision, 2);
});


/*
 * TEST 07 — UNINITIALIZED ACCOUNT READ
 */

test("does not silently create ownership during collection reads", async t => {
  const fx = await fixture(t);

  assertDenied(
    await fx.state(),
    "character_profile_not_initialized"
  );

  assertDenied(
    await fx.history(),
    "character_profile_not_initialized"
  );
});


/*
 * TEST 08 — ACCOUNT INJECTION
 */

test("rejects client supplied account identifiers in every operation", async t => {
  const fx = await fixture(t);

  await fx.initialize(fx.playerA);
  await fx.initialize(fx.playerB);

  const injected = {
    sessionToken: fx.playerA.token,
    accountId: fx.playerB.accountId
  };

  const results = await Promise.all([
    fx.service.initializeAccount(injected),

    fx.service.getState(injected),

    fx.service.selectCharacter({
      ...injected,
      characterId: STARTER
    }),

    fx.service.getHistory(injected)
  ]);

  for (const result of results) {
    assertDenied(
      result,
      "invalid_character_service_request"
    );
  }
});


/*
 * TEST 09 — PERMISSION INJECTION
 */

test("rejects client supplied ownership and authorization flags", async t => {
  const fx = await fixture(t);

  await fx.initialize();

  for (const changes of [
    { owned: true },
    { entitled: true },
    { serverVerified: true },
    { runtimeAuthorized: true },
    { tradingAuthorized: true },
    { paymentVerified: true },
    { ownedCharacterIds: [SOLA] }
  ]) {
    assertDenied(
      await fx.service.selectCharacter({
        ...fx.input(),
        characterId: SOLA,
        ...changes
      }),
      "invalid_character_service_request"
    );
  }

  assertCollection(
    await fx.state(),
    fx.playerA,
    STARTER,
    [STARTER]
  );
});


/*
 * TEST 10 — INVALID CHARACTER
 */

test("rejects invalid character identifiers before selection", async t => {
  const fx = await fixture(t);

  await fx.initialize();

  for (const characterId of [
    "",
    null,
    {},
    "unknown",
    "LAGO",
    "../lago"
  ]) {
    assertDenied(
      await fx.select(characterId),
      "invalid_character"
    );
  }
});


/*
 * TEST 11 — UNOWNED CHARACTER
 */

test("does not permit selection of an unowned character", async t => {
  const fx = await fixture(t);

  await fx.initialize();

  assertDenied(
    await fx.select(SOLA),
    "character_not_owned"
  );

  assertCollection(
    await fx.state(),
    fx.playerA,
    STARTER,
    [STARTER]
  );
});


/*
 * TEST 12 — AUTHENTICATED SELECTION
 */

test("selects an owned character without granting AI permissions", async t => {
  const fx = await fixture(t);

  await initializeAndGrant(fx);

  fx.advance(1000);

  const result = await fx.select(SOLA);

  assertCollection(
    result,
    fx.playerA,
    SOLA,
    [STARTER, SOLA]
  );

  assert.equal(result.changed, true);
  assert.equal(result.selectionRevision, 2);
});


/*
 * TEST 13 — REPEATED SELECTION
 */

test("does not increase revision for repeated active character selection", async t => {
  const fx = await fixture(t);

  await initializeAndGrant(fx);

  await fx.select(SOLA);

  const result = await fx.select(SOLA);

  assertAuthenticated(result, fx.playerA);

  assert.equal(result.changed, false);
  assert.equal(result.selectionRevision, 2);

  const history = await fx.history();

  assert.equal(history.items.length, 2);
});


/*
 * TEST 14 — ACCOUNT ISOLATION
 */

test("isolates authenticated collections and active agents", async t => {
  const fx = await fixture(t);

  await fx.initialize(fx.playerA);
  await fx.initialize(fx.playerB);

  fx.grant(SOLA, fx.playerA);

  await fx.select(SOLA, fx.playerA);

  assertDenied(
    await fx.select(SOLA, fx.playerB),
    "character_not_owned"
  );

  assertCollection(
    await fx.state(fx.playerA),
    fx.playerA,
    SOLA,
    [STARTER, SOLA]
  );

  assertCollection(
    await fx.state(fx.playerB),
    fx.playerB,
    STARTER,
    [STARTER]
  );
});


/*
 * TEST 15 — HISTORY PAGINATION
 */

test("returns authenticated contiguous paginated selection history", async t => {
  const fx = await fixture(t);

  await initializeAndGrant(fx);

  for (const characterId of [
    SOLA,
    STARTER,
    SOLA,
    STARTER
  ]) {
    fx.advance(1000);

    assert.equal(
      (await fx.select(characterId)).changed,
      true
    );
  }

  const first = await fx.history({
    limit: 2
  });

  assertAuthenticated(first, fx.playerA);

  assert.deepEqual(
    first.items.map(
      item => item.selectionRevision
    ),
    [5, 4]
  );

  assert.equal(first.hasMore, true);
  assert.equal(first.nextBeforeRevision, 4);

  const second = await fx.history({
    limit: 2,
    beforeRevision: first.nextBeforeRevision
  });

  assertAuthenticated(second, fx.playerA);

  assert.deepEqual(
    second.items.map(
      item => item.selectionRevision
    ),
    [3, 2]
  );

  const third = await fx.history({
    limit: 2,
    beforeRevision: second.nextBeforeRevision
  });

  assertAuthenticated(third, fx.playerA);

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
 * TEST 16 — EMPTY HISTORY PAGE
 */

test("returns an empty terminal history page for revision one cursor", async t => {
  const fx = await fixture(t);

  await fx.initialize();

  const result = await fx.history({
    beforeRevision: 1
  });

  assertAuthenticated(result, fx.playerA);

  assert.deepEqual(result.items, []);
  assert.equal(result.hasMore, false);
  assert.equal(result.nextBeforeRevision, null);
});


/*
 * TEST 17 — INVALID HISTORY REQUESTS
 */

test("rejects invalid pagination cursors and history limits", async t => {
  const fx = await fixture(t);

  await fx.initialize();

  for (const limit of [
    0,
    -1,
    101,
    1.5,
    "10",
    null,
    Infinity
  ]) {
    assertDenied(
      await fx.history({ limit }),
      "invalid_character_history_request"
    );
  }

  for (const beforeRevision of [
    0,
    -1,
    1.5,
    "2",
    null,
    Infinity
  ]) {
    assertDenied(
      await fx.history({ beforeRevision }),
      "invalid_character_history_request"
    );
  }
});


/*
 * TEST 18 — REVOKED SESSION
 */

test("rejects character operations after server session revocation", async t => {
  const fx = await fixture(t);

  await initializeAndGrant(fx);

  await fx.sessions.revokeSession(
    fx.playerA.token
  );

  assertDenied(
    await fx.state(),
    "authentication_required"
  );

  assertDenied(
    await fx.select(SOLA),
    "authentication_required"
  );

  assertDenied(
    await fx.history(),
    "authentication_required"
  );

  assert.equal(
    fx.rawState().activeCharacterId,
    STARTER
  );
});


/*
 * TEST 19 — EXPIRED SESSION
 */

test("rejects access at the exact server session expiration boundary", async t => {
  const fx = await fixture(t);

  await fx.initialize();

  fx.advance(3600000);

  assertDenied(
    await fx.state(),
    "authentication_required"
  );
});


/*
 * TEST 20 — MALFORMED SESSION EVIDENCE
 */

test("rejects invalid trusted session responses", async t => {
  const fx = await fixture(t);

  await fx.initialize();

  const valid = await fx.sessions.restoreSession(
    fx.playerA.token
  );

  for (const changes of [
    { ok: false },
    { account: null },
    {
      account: {
        accountId: "invalid"
      }
    },
    { expiresAt: "invalid-date" },
    {
      expiresAt: new Date(START).toISOString()
    },
    {
      expiresAt: "2027-02-01T00:00:00Z"
    }
  ]) {
    const service = fx.createService({
      sessionStore: {
        async restoreSession() {
          return {
            ...valid,
            ...changes
          };
        }
      }
    });

    assertDenied(
      await service.getState(fx.input()),
      "authentication_required"
    );
  }
});


/*
 * TEST 21 — CROSS ACCOUNT STORE RESPONSE
 */

test("rejects collection responses belonging to another account", async t => {
  const fx = await fixture(t);

  await fx.initialize(fx.playerA);
  await fx.initialize(fx.playerB);

  const service = fx.createService({
    characterStore: {
      ...fx.characterStore,

      getState() {
        return fx.rawState(fx.playerB);
      }
    }
  });

  assertDenied(
    await service.getState(fx.input()),
    "invalid_character_store_response"
  );
});


/*
 * TEST 22 — INVALID COLLECTION EVIDENCE
 */

test("rejects malformed and inconsistent collection responses", async t => {
  const fx = await fixture(t);

  await initializeAndGrant(fx);

  const valid = fx.rawState();

  const mutations = [
    { serverVerified: false },
    { version: 999 },
    { maxActiveAgents: 2 },
    { activeCharacterId: MIKI },
    { selectionRevision: 0 },
    { selectionRevision: 1.5 },
    { createdAt: "invalid" },
    { updatedAt: "invalid" },
    { ownedCharacters: [] },
    { ownedCharacterIds: [] },
    {
      ownedCharacterIds: [
        STARTER,
        STARTER
      ]
    },
    {
      ownedCharacters: [
        valid.ownedCharacters[0],
        valid.ownedCharacters[0]
      ]
    },
    {
      ownedCharacters:
        valid.ownedCharacters.map(item => ({
          ...item,
          acquisitionSource: "client_import"
        }))
    },
    {
      ownedCharacters:
        valid.ownedCharacters.map(item => ({
          ...item,
          acquiredAt: "invalid-date"
        }))
    }
  ];

  for (const changes of mutations) {
    const service = fx.createService({
      characterStore: {
        ...fx.characterStore,

        getState() {
          return {
            ...valid,
            ...changes
          };
        }
      }
    });

    assertDenied(
      await service.getState(fx.input()),
      "invalid_character_store_response"
    );
  }
});


/*
 * TEST 23 — RESPONSE FIELD PROJECTION
 */

test("does not expose arbitrary store data or inherited AI permissions", async t => {
  const fx = await fixture(t);

  await initializeAndGrant(fx);

  const service = fx.createService({
    characterStore: {
      ...fx.characterStore,

      getState() {
        const valid = fx.rawState();

        return {
          ...valid,

          privateKey: "SYNTHETIC_SECRET",
          sessionToken: fx.playerA.token,
          aiEnabled: true,
          tradingAuthorized: true,

          ownedCharacters:
            valid.ownedCharacters.map(item => ({
              ...item,
              privateData: "SYNTHETIC_SECRET"
            }))
        };
      }
    }
  });

  const result = await service.getState(
    fx.input()
  );

  assertAuthenticated(result, fx.playerA);

  const serialized = JSON.stringify(result);

  assert.equal(
    serialized.includes("SYNTHETIC_SECRET"),
    false
  );

  assert.equal(
    serialized.includes(fx.playerA.token),
    false
  );

  assert.equal(
    Object.hasOwn(result, "privateKey"),
    false
  );
});


/*
 * TEST 24 — INCORRECT SELECTION RESPONSE
 */

test("rejects successful selection responses for the wrong character", async t => {
  const fx = await fixture(t);

  await initializeAndGrant(fx);

  const service = fx.createService({
    characterStore: {
      ...fx.characterStore,

      selectCharacter() {
        return {
          ...fx.rawState(),
          changed: true
        };
      }
    }
  });

  assertDenied(
    await service.selectCharacter(
      fx.input(fx.playerA, {
        characterId: SOLA
      })
    ),
    "invalid_character_store_response"
  );
});


/*
 * TEST 25 — MALFORMED HISTORY EVIDENCE
 */

test("rejects inconsistent selection history responses", async t => {
  const fx = await fixture(t);

  await initializeAndGrant(fx);

  await fx.select(SOLA);
  await fx.select(STARTER);

  const valid = fx.characterStore.getHistory({
    accountId: fx.playerA.accountId
  });

  const mutations = [
    { serverVerified: false },
    { accountId: fx.playerB.accountId },
    { items: [] },
    { hasMore: true },
    { nextBeforeRevision: 2 },
    {
      items: [
        valid.items[0],
        valid.items[2]
      ]
    },
    {
      items: [...valid.items].reverse()
    },
    {
      items: valid.items.map(
        (item, index) =>
          index === 0
            ? {
                ...item,
                selectedAt: "invalid"
              }
            : item
      )
    }
  ];

  for (const changes of mutations) {
    const service = fx.createService({
      characterStore: {
        ...fx.characterStore,

        getHistory() {
          return {
            ...valid,
            ...changes
          };
        }
      }
    });

    assertDenied(
      await service.getHistory(fx.input()),
      "invalid_character_history_response"
    );
  }
});


/*
 * TEST 26 — AUTHENTICATION DEADLINE
 */

test("does not execute character writes after authentication timeout", async t => {
  const fx = await fixture(t);

  let writes = 0;

  const service = fx.createService({
    sessionStore: {
      async restoreSession(token) {
        fx.advance(5000);

        return fx.sessions.restoreSession(
          token
        );
      }
    },

    characterStore: {
      ...fx.characterStore,

      initializeAccount(input) {
        writes++;

        return fx.characterStore
          .initializeAccount(input);
      }
    }
  });

  assertDenied(
    await service.initializeAccount(
      fx.input()
    ),
    "character_service_timeout"
  );

  assert.equal(writes, 0);
});


/*
 * TEST 27 — STALLED SESSION PROVIDER
 */

test("cancels stalled session restoration and ignores late responses", {
  timeout: 15000
}, async t => {
  const fx = await fixture(t);

  let resolvePending;
  let capturedSignal;
  let writes = 0;

  const pending = new Promise(resolve => {
    resolvePending = resolve;
  });

  const service = fx.createService({
    sessionStore: {
      restoreSession(token, options) {
        capturedSignal = options.signal;

        return pending;
      }
    },

    characterStore: {
      ...fx.characterStore,

      initializeAccount(input) {
        writes++;

        return fx.characterStore
          .initializeAccount(input);
      }
    }
  });

  const result = await service.initializeAccount(
    fx.input()
  );

  assertDenied(
    result,
    "character_service_timeout"
  );

  assert.ok(
    capturedSignal instanceof AbortSignal
  );

  assert.equal(capturedSignal.aborted, true);

  resolvePending(
    await fx.sessions.restoreSession(
      fx.playerA.token
    )
  );

  await new Promise(resolve =>
    setImmediate(resolve)
  );

  assert.equal(writes, 0);

  assertDenied(
    result,
    "character_service_timeout"
  );
});


/*
 * TEST 28 — CLOCK ROLLBACK
 */

test("rejects a backwards moving authentication clock", async t => {
  const fx = await fixture(t);

  const service = fx.createService({
    sessionStore: {
      async restoreSession(token) {
        fx.advance(-1);

        return fx.sessions.restoreSession(
          token
        );
      }
    }
  });

  assertDenied(
    await service.initializeAccount(
      fx.input()
    ),
    "invalid_character_service_clock"
  );
});


/*
 * TEST 29 — RESPONSE EXPIRATION
 */

test("does not disclose collection state after session expiration during store execution", async t => {
  const fx = await fixture(t);

  await fx.initialize();

  fx.setTime(
    START + 3600000 - 1000
  );

  const service = fx.createService({
    characterStore: {
      ...fx.characterStore,

      getState(input) {
        const result =
          fx.characterStore.getState(input);

        fx.advance(1000);

        return result;
      }
    }
  });

  assertDenied(
    await service.getState(fx.input()),
    "session_expired"
  );
});


/*
 * TEST 30 — SAFE PROVIDER ERRORS
 */

test("sanitizes unexpected session and character store errors", async t => {
  const fx = await fixture(t);

  await fx.initialize();

  const services = [
    fx.createService({
      sessionStore: {
        async restoreSession() {
          throw new Error(
            "SYNTHETIC_PRIVATE_SECRET"
          );
        }
      }
    }),

    fx.createService({
      characterStore: {
        ...fx.characterStore,

        getState() {
          throw new Error(
            "SYNTHETIC_PRIVATE_SECRET"
          );
        }
      }
    }),

    fx.createService({
      characterStore: {
        ...fx.characterStore,

        getState() {
          return {
            ok: false,
            reason: "SYNTHETIC_PRIVATE_SECRET"
          };
        }
      }
    })
  ];

  for (const service of services) {
    const result = await service.getState(
      fx.input()
    );

    assertDenied(
      result,
      "character_service_unavailable"
    );

    assert.equal(
      JSON.stringify(result).includes(
        "SYNTHETIC_PRIVATE_SECRET"
      ),
      false
    );
  }
});


/*
 * TEST 31 — CONCURRENT ACCOUNT ACCESS
 */

test("isolates concurrent authenticated requests for separate accounts", async t => {
  const fx = await fixture(t);

  const initialized = await Promise.all([
    fx.initialize(fx.playerA),
    fx.initialize(fx.playerB)
  ]);

  assertAuthenticated(
    initialized[0],
    fx.playerA
  );

  assertAuthenticated(
    initialized[1],
    fx.playerB
  );

  fx.grant(SOLA, fx.playerA);
  fx.grant(MIKI, fx.playerB);

  const selected = await Promise.all([
    fx.select(SOLA, fx.playerA),
    fx.select(MIKI, fx.playerB)
  ]);

  assertCollection(
    selected[0],
    fx.playerA,
    SOLA,
    [STARTER, SOLA]
  );

  assertCollection(
    selected[1],
    fx.playerB,
    MIKI,
    [STARTER, MIKI]
  );
});


/*
 * TEST 32 — SERVICE SHUTDOWN
 */

test("rejects operations after service shutdown without closing injected stores", async t => {
  const fx = await fixture(t);

  await fx.initialize();

  fx.service.close();
  fx.service.close();

  for (const result of [
    await fx.initialize(),
    await fx.state(),
    await fx.select(STARTER),
    await fx.history()
  ]) {
    assertDenied(
      result,
      "character_service_closed"
    );
  }

  assert.equal(
    fx.rawState().ok,
    true
  );
});


/*
 * TEST 33 — IMMUTABLE POLICY
 */

test("exposes only authenticated collection operations and immutable security policy", async t => {
  const fx = await fixture(t);

  const policy = fx.service.getPolicy();

  assert.equal(
    policy.serverAuthenticationRequired,
    true
  );

  assert.equal(policy.ownershipScope, "account");
  assert.equal(policy.maxActiveAgents, 1);

  assert.equal(policy.clientAccountIdTrusted, false);
  assert.equal(policy.clientOwnershipTrusted, false);
  assert.equal(policy.clientPermissionsTrusted, false);
  assert.equal(policy.clientPaymentTrusted, false);

  assert.equal(policy.ownershipGrantExposed, false);
  assert.equal(policy.purchaseExecutionEnabled, false);

  assert.equal(
    policy.subscriptionRequiredForCollection,
    false
  );

  assert.equal(
    policy.subscriptionRequiredForSelection,
    false
  );

  assert.equal(policy.aiAuthorizationSeparate, true);
  assert.equal(policy.memoryAuthorizationSeparate, true);
  assert.equal(policy.tradingAuthorizationSeparate, true);

  assert.equal(policy.authorizationTimeoutMs, 5000);
  assert.equal(policy.maxHistoryLimit, 100);
  assert.equal(policy.failClosed, true);

  assert.equal(
    fx.service.recordTrustedGrant,
    undefined
  );

  assert.equal(
    fx.service.getCharacterAccess,
    undefined
  );

  assert.equal(Object.isFrozen(policy), true);
  assert.equal(Object.isFrozen(fx.service), true);
});

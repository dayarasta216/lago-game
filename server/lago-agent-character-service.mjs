import { performance } from "node:perf_hooks";

import {
  validAccountId,
  validCharacterId,
  getMemoryCharacters
} from "./lago-agent-memory-contract.mjs";

import {
  CHARACTER_STORE_VERSION
} from "./lago-agent-character-store.mjs";

/*
 * LAGO GAME
 * R2.8B3 — AUTHENTICATED CHARACTER SERVICE
 *
 * Server session authentication.
 * Account-scoped character collection.
 * Authenticated starter initialization.
 * Authenticated character selection.
 * Bounded selection history.
 *
 * No client ownership grants.
 * No payment execution.
 * No AI execution.
 * No trading authorization.
 */

export const CHARACTER_SERVICE_VERSION = 1;

const AUTHORIZATION_TIMEOUT_MS = 5000;

const MAX_HISTORY_LIMIT = 100;

const MAX_CHARACTERS =
  getMemoryCharacters().length;

const TIMEOUT = Symbol("character_service_timeout");

const POLICY = Object.freeze({
  serverAuthenticationRequired: true,
  ownershipScope: "account",
  maxActiveAgents: 1,

  clientAccountIdTrusted: false,
  clientOwnershipTrusted: false,
  clientPermissionsTrusted: false,
  clientPaymentTrusted: false,

  authenticatedInitialization: true,
  authenticatedCollectionRead: true,
  authenticatedCharacterSelection: true,
  authenticatedHistoryRead: true,

  subscriptionRequiredForCollection: false,
  subscriptionRequiredForSelection: false,

  ownershipGrantExposed: false,
  purchaseExecutionEnabled: false,

  aiAuthorizationSeparate: true,
  memoryAuthorizationSeparate: true,
  tradingAuthorizationSeparate: true,

  authorizationTimeoutMs:
    AUTHORIZATION_TIMEOUT_MS,

  maxHistoryLimit: MAX_HISTORY_LIMIT,

  failClosed: true
});

const OPERATIONS = Object.freeze({
  initialize: Object.freeze([
    "sessionToken"
  ]),

  state: Object.freeze([
    "sessionToken"
  ]),

  select: Object.freeze([
    "sessionToken",
    "characterId"
  ]),

  history: Object.freeze([
    "sessionToken",
    "beforeRevision",
    "limit"
  ])
});

const SAFE_STORE_ERRORS = Object.freeze([
  "character_profile_not_initialized",
  "character_not_owned",
  "character_clock_rollback",
  "character_revision_limit",
  "character_store_closed",
  "character_initialization_unavailable",
  "character_state_unavailable",
  "character_selection_unavailable",
  "character_history_unavailable"
]);


/*
 * SAFE REJECTION
 */

function reject(reason) {
  return Object.freeze({
    ok: false,

    version: CHARACTER_SERVICE_VERSION,

    authenticated: false,
    serverVerified: false,

    accountId: null,
    activeCharacterId: null,
    selectionRevision: null,

    ownedCharacters: Object.freeze([]),
    ownedCharacterIds: Object.freeze([]),

    aiEnabled: false,
    runtimeAuthorized: false,
    memoryAuthorized: false,
    learningAuthorized: false,
    tradingAuthorized: false,
    externalModelTrainingAuthorized: false,

    reason
  });
}


/*
 * VALIDATION
 */

function validObject(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
  );
}

function validClock(value) {
  return (
    Number.isSafeInteger(value) &&
    Number.isFinite(
      new Date(value).getTime()
    )
  );
}

function parseTimestamp(value) {
  if (typeof value !== "string") {
    return null;
  }

  const timestamp = Date.parse(value);

  if (
    !Number.isFinite(timestamp) ||
    new Date(timestamp).toISOString() !== value
  ) {
    return null;
  }

  return timestamp;
}

function validRevision(value) {
  return (
    Number.isSafeInteger(value) &&
    value >= 1
  );
}

function validSessionToken(value) {
  return (
    typeof value === "string" &&
    value.length >= 1 &&
    value.length <= 256 &&
    value.trim() === value
  );
}


/*
 * SERVER SESSION NORMALIZATION
 */

function normalizeSession(session, timestamp) {
  if (
    session?.ok !== true ||
    !validAccountId(
      session.account?.accountId
    )
  ) {
    return null;
  }

  const expiresAt = parseTimestamp(
    session.expiresAt
  );

  if (
    expiresAt === null ||
    expiresAt <= timestamp
  ) {
    return null;
  }

  return Object.freeze({
    accountId: session.account.accountId,
    expiresAt
  });
}


/*
 * BOUNDED SESSION RESTORATION
 */

async function restoreSessionWithinDeadline(
  sessionStore,
  sessionToken
) {
  const controller = new AbortController();

  let timer;

  const deadline = new Promise(resolve => {
    timer = setTimeout(() => {
      resolve(TIMEOUT);

      controller.abort();
    }, AUTHORIZATION_TIMEOUT_MS);
  });

  try {
    return await Promise.race([

      Promise.resolve().then(() =>
        sessionStore.restoreSession(
          sessionToken,
          {
            signal: controller.signal
          }
        )
      ),

      deadline

    ]);

  } finally {
    clearTimeout(timer);
  }
}


/*
 * SAFE STORE ERROR PROJECTION
 */

function projectStoreFailure(result) {
  if (
    SAFE_STORE_ERRORS.includes(
      result?.reason
    )
  ) {
    return reject(result.reason);
  }

  return reject(
    "character_service_unavailable"
  );
}


/*
 * AUTHENTICATED COLLECTION PROJECTION
 */

function projectCollection(
  result,
  accountId,
  operation
) {
  if (result?.ok !== true) {
    return projectStoreFailure(result);
  }

  if (
    result.serverVerified !== true ||
    result.version !== CHARACTER_STORE_VERSION ||
    result.accountId !== accountId ||
    !validCharacterId(
      result.activeCharacterId
    ) ||
    !validRevision(
      result.selectionRevision
    ) ||
    result.maxActiveAgents !== 1 ||
    !Array.isArray(
      result.ownedCharacters
    ) ||
    !Array.isArray(
      result.ownedCharacterIds
    ) ||
    result.ownedCharacters.length < 1 ||
    result.ownedCharacters.length >
      MAX_CHARACTERS
  ) {
    return reject(
      "invalid_character_store_response"
    );
  }

  const createdAt = parseTimestamp(
    result.createdAt
  );

  const updatedAt = parseTimestamp(
    result.updatedAt
  );

  if (
    createdAt === null ||
    updatedAt === null ||
    updatedAt < createdAt
  ) {
    return reject(
      "invalid_character_store_response"
    );
  }

  const ids = new Set();

  const ownedCharacters = [];

  for (const item of result.ownedCharacters) {

    const acquiredAt = parseTimestamp(
      item?.acquiredAt
    );

    if (
      !validCharacterId(
        item?.characterId
      ) ||
      ids.has(item.characterId) ||
      acquiredAt === null ||
      acquiredAt < createdAt
    ) {
      return reject(
        "invalid_character_store_response"
      );
    }

    if (
      item.characterId === "lago"
    ) {

      if (
        item.acquisitionSource !== "starter" ||
        acquiredAt !== createdAt
      ) {
        return reject(
          "invalid_character_store_response"
        );
      }

    } else if (
      item.acquisitionSource !== "trusted_grant"
    ) {
      return reject(
        "invalid_character_store_response"
      );
    }

    ids.add(item.characterId);

    ownedCharacters.push(
      Object.freeze({
        characterId: item.characterId,
        acquiredAt: item.acquiredAt,

        acquisitionSource:
          item.acquisitionSource
      })
    );
  }

  if (
    !ids.has("lago") ||
    !ids.has(result.activeCharacterId) ||
    result.ownedCharacterIds.length !==
      ids.size ||
    new Set(
      result.ownedCharacterIds
    ).size !== ids.size ||
    !result.ownedCharacterIds.every(
      id => ids.has(id)
    )
  ) {
    return reject(
      "invalid_character_store_response"
    );
  }

  const extra = {};

  if (operation === "initialize") {
    if (
      typeof result.initialized !== "boolean"
    ) {
      return reject(
        "invalid_character_store_response"
      );
    }

    extra.initialized = result.initialized;
  }

  if (operation === "select") {
    if (
      typeof result.changed !== "boolean"
    ) {
      return reject(
        "invalid_character_store_response"
      );
    }

    extra.changed = result.changed;
  }

  return Object.freeze({
    ok: true,

    version: CHARACTER_SERVICE_VERSION,

    authenticated: true,
    serverVerified: true,

    accountId,

    activeCharacterId:
      result.activeCharacterId,

    selectionRevision:
      result.selectionRevision,

    ownedCharacters:
      Object.freeze(ownedCharacters),

    ownedCharacterIds:
      Object.freeze([...ids]),

    createdAt: result.createdAt,
    updatedAt: result.updatedAt,

    maxActiveAgents: 1,

    ...extra,

    aiEnabled: false,
    runtimeAuthorized: false,
    memoryAuthorized: false,
    learningAuthorized: false,
    tradingAuthorized: false,
    externalModelTrainingAuthorized: false,

    reason: null
  });
}


/*
 * SAFE SELECTION HISTORY PROJECTION
 */

function projectHistory(
  result,
  accountId,
  state,
  beforeRevision,
  limit
) {
  if (result?.ok !== true) {
    return projectStoreFailure(result);
  }

  if (
    result.serverVerified !== true ||
    result.accountId !== accountId ||
    !Array.isArray(result.items) ||
    result.items.length > limit ||
    typeof result.hasMore !== "boolean"
  ) {
    return reject(
      "invalid_character_history_response"
    );
  }

  const items = [];

  let previousRevision = beforeRevision;

  let previousItem = null;

  const owned = new Set(
    state.ownedCharacterIds
  );

  for (const item of result.items) {

    const selectedAt = parseTimestamp(
      item?.selectedAt
    );

    if (
      !validRevision(
        item?.selectionRevision
      ) ||
      item.selectionRevision >=
        previousRevision ||
      item.selectionRevision >
        state.selectionRevision ||
      !validCharacterId(
        item.characterId
      ) ||
      !owned.has(item.characterId) ||
      selectedAt === null ||
      selectedAt <
        Date.parse(state.createdAt) ||
      selectedAt >
        Date.parse(state.updatedAt)
    ) {
      return reject(
        "invalid_character_history_response"
      );
    }

    if (item.selectionRevision === 1) {

      if (
        item.previousCharacterId !== null ||
        item.characterId !== "lago" ||
        item.selectedAt !== state.createdAt
      ) {
        return reject(
          "invalid_character_history_response"
        );
      }

    } else if (
      !validCharacterId(
        item.previousCharacterId
      ) ||
      !owned.has(
        item.previousCharacterId
      ) ||
      item.previousCharacterId ===
        item.characterId
    ) {
      return reject(
        "invalid_character_history_response"
      );
    }

    if (
      previousItem &&
      (
        previousItem.selectionRevision !==
          item.selectionRevision + 1 ||

        previousItem.previousCharacterId !==
          item.characterId ||

        Date.parse(
          previousItem.selectedAt
        ) < selectedAt
      )
    ) {
      return reject(
        "invalid_character_history_response"
      );
    }

    if (
      item.selectionRevision ===
        state.selectionRevision &&
      (
        item.characterId !==
          state.activeCharacterId ||

        item.selectedAt !==
          state.updatedAt
      )
    ) {
      return reject(
        "invalid_character_history_response"
      );
    }

    const projected = Object.freeze({
      selectionRevision:
        item.selectionRevision,

      previousCharacterId:
        item.previousCharacterId,

      characterId:
        item.characterId,

      selectedAt:
        item.selectedAt
    });

    items.push(projected);

    previousRevision =
      item.selectionRevision;

    previousItem = projected;
  }

  const expectedFirstRevision = Math.min(
    state.selectionRevision,
    beforeRevision - 1
  );

  const expectedCount = Math.min(
    limit,
    expectedFirstRevision
  );

  if (
    items.length !== expectedCount ||
    (
      items.length > 0 &&
      items[0].selectionRevision !==
        expectedFirstRevision
    )
  ) {
    return reject(
      "invalid_character_history_response"
    );
  }

  const expectedHasMore =
    items.length > 0 &&
    items.at(-1).selectionRevision > 1;

  const expectedCursor = expectedHasMore
    ? items.at(-1).selectionRevision
    : null;

  if (
    result.hasMore !== expectedHasMore ||
    result.nextBeforeRevision !==
      expectedCursor
  ) {
    return reject(
      "invalid_character_history_response"
    );
  }

  return Object.freeze({
    ok: true,

    version: CHARACTER_SERVICE_VERSION,

    authenticated: true,
    serverVerified: true,

    accountId,

    activeCharacterId:
      state.activeCharacterId,

    selectionRevision:
      state.selectionRevision,

    items: Object.freeze(items),

    hasMore: expectedHasMore,

    nextBeforeRevision: expectedCursor,

    aiEnabled: false,
    runtimeAuthorized: false,
    memoryAuthorized: false,
    learningAuthorized: false,
    tradingAuthorized: false,
    externalModelTrainingAuthorized: false,

    reason: null
  });
}


/*
 * CHARACTER SERVICE FACTORY
 */

export function createLagoCharacterService({
  sessionStore,
  characterStore,
  now = () => Date.now()
} = {}) {

  if (
    typeof sessionStore?.restoreSession !==
      "function"
  ) {
    throw new Error(
      "character_session_store_required"
    );
  }

  for (const method of [
    "initializeAccount",
    "getState",
    "selectCharacter",
    "getHistory"
  ]) {
    if (
      typeof characterStore?.[method] !==
        "function"
    ) {
      throw new Error(
        "character_store_required"
      );
    }
  }

  if (typeof now !== "function") {
    throw new Error(
      "invalid_character_service_clock"
    );
  }

  let closed = false;


  /*
   * AUTHENTICATE AND EXECUTE
   *
   * The character store is synchronous.
   * No asynchronous operation is placed
   * between final session validation
   * and the store operation.
   */

  async function execute(
    operation,
    input
  ) {

    if (closed) {
      return reject(
        "character_service_closed"
      );
    }

    try {

      if (!validObject(input)) {
        return reject(
          "invalid_character_service_request"
        );
      }

      const allowedFields =
        OPERATIONS[operation];

      if (
        !allowedFields ||
        !Object.keys(input).every(
          key => allowedFields.includes(key)
        )
      ) {
        return reject(
          "invalid_character_service_request"
        );
      }

      const sessionToken = input.sessionToken;

      const characterId = input.characterId;

      const beforeRevision =
        input.beforeRevision === undefined
          ? Number.MAX_SAFE_INTEGER
          : input.beforeRevision;

      const limit =
        input.limit === undefined
          ? 50
          : input.limit;

      if (!validSessionToken(sessionToken)) {
        return reject(
          "authentication_required"
        );
      }

      if (
        operation === "select" &&
        !validCharacterId(characterId)
      ) {
        return reject(
          "invalid_character"
        );
      }

      if (
        operation === "history" &&
        (
          !validRevision(beforeRevision) ||
          !Number.isSafeInteger(limit) ||
          limit < 1 ||
          limit > MAX_HISTORY_LIMIT
        )
      ) {
        return reject(
          "invalid_character_history_request"
        );
      }


      /*
       * 1. Start authentication budget.
       */

      const startedAt = now();

      const monotonicStart =
        performance.now();

      if (!validClock(startedAt)) {
        return reject(
          "invalid_character_service_clock"
        );
      }


      /*
       * 2. Restore server-owned session.
       */

      const restored =
        await restoreSessionWithinDeadline(
          sessionStore,
          sessionToken
        );

      if (closed) {
        return reject(
          "character_service_closed"
        );
      }

      if (restored === TIMEOUT) {
        return reject(
          "character_service_timeout"
        );
      }

      const authenticatedAt = now();

      if (
        !validClock(authenticatedAt) ||
        authenticatedAt < startedAt
      ) {
        return reject(
          "invalid_character_service_clock"
        );
      }

      if (
        authenticatedAt - startedAt >=
          AUTHORIZATION_TIMEOUT_MS ||

        performance.now() - monotonicStart >=
          AUTHORIZATION_TIMEOUT_MS
      ) {
        return reject(
          "character_service_timeout"
        );
      }

      const session = normalizeSession(
        restored,
        authenticatedAt
      );

      if (!session) {
        return reject(
          "authentication_required"
        );
      }

      /*
       * Account identity originates only
       * from the authenticated session.
       */

      const accountId = session.accountId;

      let result;


      /*
       * 3. Execute account-scoped operation.
       */

      switch (operation) {

        case "initialize": {

          const state =
            characterStore.initializeAccount({
              accountId
            });

          result = projectCollection(
            state,
            accountId,
            operation
          );

          break;
        }

        case "state": {

          result = projectCollection(
            characterStore.getState({
              accountId
            }),
            accountId,
            operation
          );

          break;
        }

        case "select": {

          result = projectCollection(
            characterStore.selectCharacter({
              accountId,
              characterId
            }),
            accountId,
            operation
          );

          if (
            result.ok === true &&
            result.activeCharacterId !==
              characterId
          ) {
            return reject(
              "invalid_character_store_response"
            );
          }

          break;
        }

        case "history": {

          const state = projectCollection(
            characterStore.getState({
              accountId
            }),
            accountId,
            "state"
          );

          if (!state.ok) {
            return state;
          }

          result = projectHistory(

            characterStore.getHistory({
              accountId,
              beforeRevision,
              limit
            }),

            accountId,
            state,
            beforeRevision,
            limit

          );

          break;
        }

        default:

          return reject(
            "invalid_character_service_request"
          );

      }


      /*
       * 4. Verify response-time boundaries.
       *
       * A completed synchronous database
       * transaction is not rolled back
       * by this response check.
       */

      const finishedAt = now();

      if (
        !validClock(finishedAt) ||
        finishedAt < authenticatedAt
      ) {
        return reject(
          "invalid_character_service_clock"
        );
      }

      if (
        finishedAt >= session.expiresAt
      ) {
        return reject(
          "session_expired"
        );
      }

      if (
        finishedAt - startedAt >=
          AUTHORIZATION_TIMEOUT_MS ||

        performance.now() - monotonicStart >=
          AUTHORIZATION_TIMEOUT_MS
      ) {
        return reject(
          "character_service_timeout"
        );
      }

      if (closed) {
        return reject(
          "character_service_closed"
        );
      }

      return result;

    } catch {

      return reject(
        "character_service_unavailable"
      );

    }
  }


  /*
   * AUTHENTICATED PUBLIC OPERATIONS
   */

  function initializeAccount(input = {}) {
    return execute(
      "initialize",
      input
    );
  }

  function getState(input = {}) {
    return execute(
      "state",
      input
    );
  }

  function selectCharacter(input = {}) {
    return execute(
      "select",
      input
    );
  }

  function getHistory(input = {}) {
    return execute(
      "history",
      input
    );
  }


  /*
   * SERVICE LIFECYCLE
   *
   * Injected stores belong to the
   * server bootstrap lifecycle.
   */

  function close() {
    closed = true;
  }


  /*
   * IMMUTABLE SERVICE INTERFACE
   */

  return Object.freeze({

    version: CHARACTER_SERVICE_VERSION,

    initializeAccount,

    getState,

    selectCharacter,

    getHistory,

    close,

    getPolicy() {
      return POLICY;
    }

  });

}

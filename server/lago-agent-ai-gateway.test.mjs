import test from "node:test";
import assert from "node:assert/strict";

import { mkdtemp, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  AI_GATEWAY_VERSION,
  createLagoAIGateway
} from "./lago-agent-ai-gateway.mjs";

import {
  createLagoRuntimeAccess
} from "./lago-agent-runtime-access.mjs";

import {
  createLagoAccountSessionStore
} from "./lago-account-session-store.mjs";

import {
  createLagoCharacterStore
} from "./lago-agent-character-store.mjs";

import {
  createLagoSubscriptionLedger
} from "./lago-agent-subscription-ledger.mjs";

import {
  createLagoSubscriptionEntitlement
} from "./lago-agent-subscription-entitlement.mjs";

import {
  SUBSCRIPTION_POLICY
} from "./lago-agent-subscription-contract.mjs";

/*
 * LAGO GAME
 * R2.8C1 — AI GATEWAY SECURITY TESTS
 *
 * Real account authentication.
 * Real persistent character ownership.
 * Real subscription authorization.
 * Synthetic payment verification.
 * Synthetic AI provider.
 *
 * No external network requests.
 * No real payments or trading.
 */

const START = Date.parse(
  "2027-01-31T12:00:00.000Z"
);

const CHARACTER = "lago";
const OTHER = "comic_pink_snail";

const PROVIDER = "synthetic-provider";
const MODEL = "synthetic-model-v1";

const MESSAGE = "Analyze the current market context.";

const LOCKED_FIELDS = Object.freeze([
  "runtimeAuthorized",
  "memoryAuthorized",
  "learningAuthorized",
  "tradingAuthorized",
  "externalModelTrainingAuthorized"
]);

function reply(changes = {}) {
  return {
    text: "Synthetic agent response.",

    usage: {
      inputTokens: 24,
      outputTokens: 8
    },

    finishReason: "stop",

    ...changes
  };
}

function deferred() {
  let resolve;
  let reject;

  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });

  return { promise, resolve, reject };
}


/*
 * REAL SERVER INTEGRATION FIXTURE
 */

async function fixture(t) {
  const root = await mkdtemp(
    join(tmpdir(), "lago-ai-gateway-")
  );

  const projectRoot = join(root, "project");
  const directory = join(root, "payments");

  const services = [];
  const calls = [];
  const requests = [];
  const consentRequests = [];

  let clock = START;
  let sequence = 0;
  let processingConsent = true;

  const now = () => clock;

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
    const result =
      await sessions.upsertVerifiedTelegramUser({
        id,
        username: "synthetic_" + id
      });

    assert.equal(result.ok, true);

    const accountId = result.account.accountId;

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
    directory: join(root, "private-characters"),
    projectRoot,
    trustedGrantsEnabled: true,
    now
  });

  services.push(characterStore);

  for (const player of [playerA, playerB]) {
    assert.equal(
      characterStore.initializeAccount({
        accountId: player.accountId
      }).ok,
      true
    );
  }

  assert.equal(
    characterStore.recordTrustedGrant({
      accountId: playerA.accountId,
      characterId: OTHER
    }).granted,
    true
  );

  const ledger = createLagoSubscriptionLedger({
    directory,
    projectRoot,
    now,

    async verifyPayment(request) {
      return {
        ...request,

        serverVerified: true,
        confirmationStatus: "finalized",

        product: SUBSCRIPTION_POLICY.product,
        chain: SUBSCRIPTION_POLICY.chain,
        network: SUBSCRIPTION_POLICY.network,
        tokenMint: SUBSCRIPTION_POLICY.tokenMint,

        payerWallet: "1".repeat(31) + "2",
        treasuryWallet: "1".repeat(31) + "3",

        amountBaseUnits: "1000000"
      };
    }
  });

  services.push(ledger);

  const entitlement =
    createLagoSubscriptionEntitlement({
      directory,
      projectRoot,
      sessionStore: sessions,
      verifiedLedgerEnabled: true,
      now
    });

  services.push(entitlement);

  const runtime = createLagoRuntimeAccess({
    sessionStore: sessions,

    getCharacterAccess:
      characterStore.getCharacterAccess,

    getSubscription:
      entitlement.getSubscription,

    runtimeEnabled: true,

    now
  });

  function createGateway(changes = {}) {
    const gateway = createLagoAIGateway({
      runtimeAccess: {
        async authorize(input) {
          calls.push("authorize");

          return runtime.authorize(input);
        }
      },

      async getProcessingConsent(context, options) {
        calls.push("consent");

        consentRequests.push({
          context,
          signal: options.signal
        });

        return processingConsent;
      },

      async generate(request, options) {
        calls.push("generate");

        requests.push({
          request,
          signal: options.signal
        });

        return reply();
      },

      providerId: PROVIDER,
      model: MODEL,

      enabled: true,

      now,

      ...changes
    });

    services.push(gateway);

    return gateway;
  }

  const gateway = createGateway();

  async function pay(player = playerA) {
    sequence++;

    const alphabet =
      "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

    const result = await ledger.applyPayment({
      accountId: player.accountId,

      quoteId:
        sequence.toString(16).padStart(32, "0"),

      transactionSignature:
        "1".repeat(63) + alphabet[sequence - 1]
    });

    assert.equal(result.ok, true);

    return result;
  }

  function input(player = playerA, changes = {}) {
    return {
      sessionToken: player.token,
      characterId: CHARACTER,
      action: "chat",
      message: MESSAGE,

      ...changes
    };
  }

  function select(
    characterId,
    player = playerA
  ) {
    const result = characterStore.selectCharacter({
      accountId: player.accountId,
      characterId
    });

    assert.equal(result.ok, true);

    return result;
  }

  return {
    sessions,
    characterStore,
    runtime,

    playerA,
    playerB,

    gateway,
    createGateway,

    calls,
    requests,
    consentRequests,

    pay,
    input,
    select,

    execute(changes = {}) {
      return gateway.execute(
        input(playerA, changes)
      );
    },

    setConsent(value) {
      processingConsent = value;
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
    assert.equal(result[field], false, field);
  }
}

function assertDenied(result, reason) {
  assert.equal(result.ok, false);
  assert.equal(result.version, AI_GATEWAY_VERSION);

  assert.equal(result.identity, null);
  assert.equal(result.action, null);
  assert.equal(result.selectionRevision, null);

  assert.equal(result.text, null);
  assert.equal(result.usage, null);

  assert.equal(result.inferenceCompleted, false);
  assert.equal(result.reason, reason);

  assert.equal(Object.isFrozen(result), true);

  assertLocked(result);
}

function assertCompleted(
  result,
  player,
  characterId = CHARACTER,
  revision = 1
) {
  assert.equal(result.ok, true);
  assert.equal(result.version, AI_GATEWAY_VERSION);

  assert.equal(result.inferenceCompleted, true);

  assert.equal(
    result.identity.accountId,
    player.accountId
  );

  assert.equal(
    result.identity.characterId,
    characterId
  );

  assert.equal(result.selectionRevision, revision);
  assert.equal(result.providerId, PROVIDER);
  assert.equal(result.model, MODEL);

  assert.equal(result.reason, null);

  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(result.identity), true);
  assert.equal(Object.isFrozen(result.usage), true);

  assertLocked(result);
}


/*
 * TEST 01 — CONFIGURATION
 */

test("requires valid AI gateway configuration", () => {
  assert.throws(
    () => createLagoAIGateway(),
    /ai_runtime_access_required/
  );

  const runtimeAccess = {
    async authorize() {
      return null;
    }
  };

  for (const [changes, reason] of [
    [
      { generate: true },
      /invalid_ai_provider_adapter/
    ],
    [
      { getProcessingConsent: true },
      /invalid_ai_processing_consent_provider/
    ],
    [
      { enabled: "true" },
      /invalid_ai_gateway_configuration/
    ],
    [
      { now: null },
      /invalid_ai_gateway_configuration/
    ],
    [
      { providerId: "invalid provider" },
      /invalid_ai_provider_id/
    ],
    [
      { model: "" },
      /invalid_ai_model_id/
    ]
  ]) {
    assert.throws(
      () => createLagoAIGateway({
        runtimeAccess,
        ...changes
      }),

      reason
    );
  }
});


/*
 * TEST 02 — DISABLED GATEWAY
 */

test("keeps AI inference disabled by default", async t => {
  const fx = await fixture(t);

  const gateway = createLagoAIGateway({
    runtimeAccess: fx.runtime
  });

  t.after(() => gateway.close());

  assertDenied(
    await gateway.execute(fx.input()),
    "ai_gateway_disabled"
  );

  assert.equal(gateway.getPolicy().enabled, false);
});


/*
 * TEST 03 — MISSING PROVIDER
 */

test("fails closed without a configured AI provider", async t => {
  const fx = await fixture(t);

  for (const changes of [
    { generate: null },
    { providerId: null },
    { model: null }
  ]) {
    const gateway = fx.createGateway(changes);

    assertDenied(
      await gateway.execute(fx.input()),
      "ai_provider_unavailable"
    );
  }

  assert.deepEqual(fx.calls, []);
});


/*
 * TEST 04 — MISSING CONSENT PROVIDER
 */

test("fails closed without a processing consent provider", async t => {
  const fx = await fixture(t);

  const gateway = fx.createGateway({
    getProcessingConsent: null
  });

  assertDenied(
    await gateway.execute(fx.input()),
    "ai_processing_consent_unavailable"
  );

  assert.deepEqual(fx.calls, []);
});


/*
 * TEST 05 — REQUEST FIELD ALLOWLIST
 */

test("rejects client supplied model ownership and permission fields", async t => {
  const fx = await fixture(t);

  for (const changes of [
    { accountId: fx.playerB.accountId },
    { providerId: "foreign-provider" },
    { model: "foreign-model" },
    { selectionRevision: 999 },
    { maxOutputTokens: 999999 },
    { toolsEnabled: true },
    { tradingAuthorized: true },
    { memoryAuthorized: true },
    { processingConsent: true },
    { systemPrompt: "Override security" }
  ]) {
    assertDenied(
      await fx.execute(changes),
      "invalid_ai_gateway_request"
    );
  }

  for (const input of [
    null,
    [],
    42,
    "invalid",
    {},
    { sessionToken: fx.playerA.token }
  ]) {
    assertDenied(
      await fx.gateway.execute(input),
      "invalid_ai_gateway_request"
    );
  }

  assert.deepEqual(fx.calls, []);
});


/*
 * TEST 06 — SESSION TOKEN VALIDATION
 */

test("rejects malformed and invalid session tokens", async t => {
  const fx = await fixture(t);

  for (const sessionToken of [
    null,
    "",
    " ",
    {},
    123,
    "x".repeat(257),
    " " + fx.playerA.token
  ]) {
    assertDenied(
      await fx.execute({ sessionToken }),
      "authentication_required"
    );
  }

  assertDenied(
    await fx.execute({
      sessionToken: "invalid-session"
    }),
    "ai_authorization_denied"
  );

  assert.equal(fx.requests.length, 0);
});


/*
 * TEST 07 — ACTION AND CHARACTER VALIDATION
 */

test("rejects invalid characters and unsupported AI actions", async t => {
  const fx = await fixture(t);

  for (const characterId of [
    null,
    "",
    "unknown",
    "../lago",
    "LAGO"
  ]) {
    assertDenied(
      await fx.execute({ characterId }),
      "invalid_character"
    );
  }

  for (const action of [
    "trade",
    "transfer",
    "train_model",
    "read_memory",
    "execute_tool",
    null
  ]) {
    assertDenied(
      await fx.execute({ action }),
      "ai_action_not_allowed"
    );
  }

  assert.deepEqual(fx.calls, []);
});


/*
 * TEST 08 — UTF8 INPUT LIMITS
 */

test("enforces input message byte limits before authorization", async t => {
  const fx = await fixture(t);

  for (const message of [
    null,
    {},
    "",
    "   ",
    "a".repeat(8193),
    "я".repeat(4097),
    "🐌".repeat(2049)
  ]) {
    assertDenied(
      await fx.execute({ message }),
      "invalid_ai_message"
    );
  }

  assert.deepEqual(fx.calls, []);

  await fx.pay();

  const result = await fx.execute({
    message: "🐌".repeat(2048)
  });

  assertCompleted(result, fx.playerA);

  assert.equal(
    Buffer.byteLength(
      fx.requests[0].request.message,
      "utf8"
    ),
    8192
  );
});


/*
 * TEST 09 — SUBSCRIPTION REQUIRED
 */

test("does not dispatch inference without active subscription", async t => {
  const fx = await fixture(t);

  assertDenied(
    await fx.execute(),
    "ai_authorization_denied"
  );

  assert.deepEqual(fx.calls, ["authorize"]);
  assert.equal(fx.requests.length, 0);
});


/*
 * TEST 10 — INACTIVE AND UNOWNED CHARACTERS
 */

test("rejects inference for inactive or unowned characters", async t => {
  const fx = await fixture(t);

  await fx.pay(fx.playerA);
  await fx.pay(fx.playerB);

  assertDenied(
    await fx.execute({
      characterId: OTHER
    }),
    "ai_authorization_denied"
  );

  assertDenied(
    await fx.gateway.execute(
      fx.input(fx.playerB, {
        characterId: OTHER
      })
    ),
    "ai_authorization_denied"
  );

  assert.equal(fx.requests.length, 0);
});


/*
 * TEST 11 — COMPLETE INFERENCE LIFECYCLE
 */

test("executes one authorized inference with three authorization checks", async t => {
  const fx = await fixture(t);

  await fx.pay();

  const result = await fx.execute();

  assertCompleted(result, fx.playerA);

  assert.deepEqual(fx.calls, [
    "authorize",
    "consent",
    "authorize",
    "generate",
    "consent",
    "authorize"
  ]);

  assert.equal(result.text, reply().text);

  assert.deepEqual(result.usage, {
    inputTokens: 24,
    outputTokens: 8,
    totalTokens: 32
  });

  assert.equal(fx.requests.length, 1);
  assert.equal(fx.consentRequests.length, 2);

  assert.equal(
    fx.requests[0].signal.aborted,
    true
  );
});


/*
 * TEST 12 — MINIMAL PROVIDER REQUEST
 */

test("does not forward server identity or authentication metadata to AI", async t => {
  const fx = await fixture(t);

  await fx.pay();

  assertCompleted(
    await fx.execute(),
    fx.playerA
  );

  const { request, signal } = fx.requests[0];

  assert.deepEqual(request, {
    providerId: PROVIDER,
    model: MODEL,

    characterId: CHARACTER,
    action: "chat",
    message: MESSAGE,

    maxInputTokens: 4096,
    maxOutputTokens: 1024,
    maxOutputBytes: 16384,

    toolsEnabled: false,
    store: false,
    trainingAllowed: false,
    streaming: false
  });

  const serialized = JSON.stringify(request);

  assert.equal(
    serialized.includes(fx.playerA.token),
    false
  );

  assert.equal(
    serialized.includes(fx.playerA.accountId),
    false
  );

  assert.equal(Object.isFrozen(request), true);
  assert.ok(signal instanceof AbortSignal);

  for (const item of fx.consentRequests) {
    assert.deepEqual(item.context, {
      accountId: fx.playerA.accountId,
      characterId: CHARACTER,
      providerId: PROVIDER,
      model: MODEL,
      purpose: "ai_inference"
    });

    assert.equal(
      Object.isFrozen(item.context),
      true
    );

    assert.equal(item.signal, signal);
  }
});


/*
 * TEST 13 — EXPLICIT PROCESSING CONSENT
 */

test("requires explicit boolean processing consent", async t => {
  const fx = await fixture(t);

  await fx.pay();

  for (const value of [
    false,
    null,
    undefined,
    "true",
    1,
    { allowed: true }
  ]) {
    fx.setConsent(value);

    assertDenied(
      await fx.execute(),
      "ai_processing_consent_required"
    );
  }

  assert.equal(fx.requests.length, 0);
});


/*
 * TEST 14 — PRE-DISPATCH CHARACTER SWITCH
 */

test("blocks provider dispatch after the active character changes", async t => {
  const fx = await fixture(t);

  await fx.pay();

  const gateway = fx.createGateway({
    async getProcessingConsent() {
      fx.select(OTHER);

      return true;
    }
  });

  assertDenied(
    await gateway.execute(fx.input()),
    "ai_authorization_context_changed"
  );

  assert.equal(fx.requests.length, 0);
});


/*
 * TEST 15 — PRE-DISPATCH ABA
 */

test("rejects changed character revision before inference dispatch", async t => {
  const fx = await fixture(t);

  await fx.pay();

  const gateway = fx.createGateway({
    async getProcessingConsent() {
      fx.select(OTHER);
      fx.select(CHARACTER);

      return true;
    }
  });

  assertDenied(
    await gateway.execute(fx.input()),
    "ai_authorization_context_changed"
  );

  assert.equal(fx.requests.length, 0);
});


/*
 * TEST 16 — SESSION REVOCATION BEFORE DISPATCH
 */

test("blocks inference when the session is revoked before dispatch", async t => {
  const fx = await fixture(t);

  await fx.pay();

  const gateway = fx.createGateway({
    async getProcessingConsent() {
      await fx.sessions.revokeSession(
        fx.playerA.token
      );

      return true;
    }
  });

  assertDenied(
    await gateway.execute(fx.input()),
    "ai_authorization_context_changed"
  );

  assert.equal(fx.requests.length, 0);
});


/*
 * TEST 17 — CHARACTER SWITCH DURING INFERENCE
 */

test("discards inference output after the active agent changes", async t => {
  const fx = await fixture(t);

  await fx.pay();

  const gateway = fx.createGateway({
    async generate() {
      fx.select(OTHER);

      return reply();
    }
  });

  assertDenied(
    await gateway.execute(fx.input()),
    "ai_authorization_context_changed"
  );
});


/*
 * TEST 18 — ABA DURING INFERENCE
 */

test("discards inference output after switching away and back", async t => {
  const fx = await fixture(t);

  await fx.pay();

  const gateway = fx.createGateway({
    async generate() {
      fx.select(OTHER);
      fx.select(CHARACTER);

      return reply();
    }
  });

  assertDenied(
    await gateway.execute(fx.input()),
    "ai_authorization_context_changed"
  );

  const fresh = await fx.execute();

  assertCompleted(
    fresh,
    fx.playerA,
    CHARACTER,
    3
  );
});


/*
 * TEST 19 — CONSENT REVOCATION
 */

test("discards generated output after processing consent is withdrawn", async t => {
  const fx = await fixture(t);

  await fx.pay();

  const gateway = fx.createGateway({
    async generate() {
      fx.setConsent(false);

      return reply();
    }
  });

  assertDenied(
    await gateway.execute(fx.input()),
    "ai_processing_consent_changed"
  );
});


/*
 * TEST 20 — SESSION REVOCATION DURING INFERENCE
 */

test("does not disclose output after server session revocation", async t => {
  const fx = await fixture(t);

  await fx.pay();

  const gateway = fx.createGateway({
    async generate() {
      await fx.sessions.revokeSession(
        fx.playerA.token
      );

      return reply();
    }
  });

  assertDenied(
    await gateway.execute(fx.input()),
    "ai_authorization_context_changed"
  );
});


/*
 * TEST 21 — SESSION EXPIRATION DURING INFERENCE
 */

test("does not disclose output after session expiration", async t => {
  const fx = await fixture(t);

  await fx.pay();

  fx.setTime(
    START + 3600000 - 1000
  );

  const gateway = fx.createGateway({
    async generate() {
      fx.advance(1000);

      return reply();
    }
  });

  assertDenied(
    await gateway.execute(fx.input()),
    "ai_authorization_context_changed"
  );
});


/*
 * TEST 22 — INVALID PROVIDER RESPONSES
 */

test("rejects malformed incomplete and oversized provider responses", async t => {
  const fx = await fixture(t);

  await fx.pay();

  const invalidResponses = [
    null,
    {},
    [],

    reply({ text: "" }),
    reply({ text: null }),
    reply({ text: "   " }),

    reply({
      text: "a".repeat(16385)
    }),

    reply({
      text: "🐌".repeat(4097)
    }),

    reply({ finishReason: "length" }),
    reply({ finishReason: "tool_calls" }),

    reply({ usage: null }),

    reply({
      usage: {
        inputTokens: 4097,
        outputTokens: 8
      }
    }),

    reply({
      usage: {
        inputTokens: 24,
        outputTokens: 1025
      }
    }),

    reply({
      usage: {
        inputTokens: -1,
        outputTokens: 8
      }
    }),

    reply({
      usage: {
        inputTokens: 1,
        outputTokens: 0
      }
    }),

    reply({
      usage: {
        inputTokens: "24",
        outputTokens: 8
      }
    }),

    reply({
      usage: {
        inputTokens: 24,
        outputTokens: 1.5
      }
    }),

    reply({
      usage: {
        inputTokens: Infinity,
        outputTokens: 8
      }
    }),

    reply({
      privateData: "SYNTHETIC_SECRET"
    }),

    reply({
      toolCalls: []
    }),

    reply({
      usage: {
        inputTokens: 24,
        outputTokens: 8,
        totalTokens: 32
      }
    })
  ];

  for (const response of invalidResponses) {
    const gateway = fx.createGateway({
      async generate() {
        return response;
      }
    });

    assertDenied(
      await gateway.execute(fx.input()),
      "invalid_ai_provider_response"
    );
  }
});


/*
 * TEST 23 — EXACT RESPONSE BOUNDARIES
 */

test("accepts valid output at configured byte and token boundaries", async t => {
  const fx = await fixture(t);

  await fx.pay();

  const gateway = fx.createGateway({
    async generate() {
      return reply({
        text: "🐌".repeat(4096),

        usage: {
          inputTokens: 4096,
          outputTokens: 1024
        }
      });
    }
  });

  const result = await gateway.execute(
    fx.input()
  );

  assertCompleted(result, fx.playerA);

  assert.equal(
    Buffer.byteLength(result.text, "utf8"),
    16384
  );

  assert.equal(result.usage.totalTokens, 5120);
});


/*
 * TEST 24 — INVALID RUNTIME AUTHORIZATION
 */

test("rejects malformed runtime authorization evidence", async t => {
  const fx = await fixture(t);

  await fx.pay();

  for (const changes of [
    { ok: false },
    { version: 999 },
    { authorized: false },
    { runtimeAuthorized: false },
    { sessionVerified: false },
    { characterVerified: false },
    { subscriptionVerified: false },
    { selectionRevisionVerified: false },
    { executionReauthorizationRequired: false },
    { selectionRevision: 0 },
    { selectionRevision: "1" },
    { identity: null },
    { action: "trade" },
    { memoryAuthorized: true },
    { learningAuthorized: true },
    { tradingAuthorized: true },
    { externalModelTrainingAuthorized: true },
    { issuedAt: "invalid" },
    {
      issuedAt:
        new Date(START + 1).toISOString()
    },
    {
      validUntil:
        new Date(START).toISOString()
    },
    {
      validUntil:
        new Date(START + 6000).toISOString()
    },
    {
      currentPeriodEnd:
        new Date(START).toISOString()
    }
  ]) {
    const gateway = fx.createGateway({
      runtimeAccess: {
        async authorize(input) {
          return {
            ...await fx.runtime.authorize(input),
            ...changes
          };
        }
      }
    });

    assertDenied(
      await gateway.execute(fx.input()),
      "ai_authorization_denied"
    );
  }

  assert.equal(fx.requests.length, 0);
});


/*
 * TEST 25 — ACCOUNT CONTEXT MISMATCH
 */

test("rejects account identity changes between authorization checks", async t => {
  const fx = await fixture(t);

  await fx.pay(fx.playerA);
  await fx.pay(fx.playerB);

  let checks = 0;

  const gateway = fx.createGateway({
    runtimeAccess: {
      async authorize(input) {
        checks++;

        if (checks === 1) {
          return fx.runtime.authorize(input);
        }

        return fx.runtime.authorize({
          ...input,
          sessionToken: fx.playerB.token
        });
      }
    }
  });

  assertDenied(
    await gateway.execute(fx.input()),
    "ai_authorization_context_changed"
  );

  assert.equal(fx.requests.length, 0);
});


/*
 * TEST 26 — SHARED DEADLINE AND CLOCK
 */

test("rejects expired inference budgets and backwards moving clocks", async t => {
  const fx = await fixture(t);

  await fx.pay();

  let capturedSignal;

  const timed = fx.createGateway({
    async generate(request, options) {
      capturedSignal = options.signal;

      fx.advance(30000);

      return reply();
    }
  });

  assertDenied(
    await timed.execute(fx.input()),
    "ai_gateway_timeout"
  );

  assert.equal(capturedSignal.aborted, true);

  fx.setTime(START);

  const rollback = fx.createGateway({
    async generate() {
      fx.advance(-1);

      return reply();
    }
  });

  assertDenied(
    await rollback.execute(fx.input()),
    "invalid_ai_gateway_clock"
  );

  fx.setTime(NaN);

  assertDenied(
    await fx.execute(),
    "invalid_ai_gateway_clock"
  );
});


/*
 * TEST 27 — CANCELLATION DURING SHUTDOWN
 */

test("cancels stalled inference on shutdown and discards late results", {
  timeout: 10000
}, async t => {
  const fx = await fixture(t);

  await fx.pay();

  const entered = deferred();
  const pending = deferred();

  let capturedSignal;

  const gateway = fx.createGateway({
    generate(request, options) {
      capturedSignal = options.signal;

      entered.resolve();

      return pending.promise;
    }
  });

  const execution = gateway.execute(
    fx.input()
  );

  await entered.promise;

  assert.equal(capturedSignal.aborted, false);

  gateway.close();

  const result = await execution;

  assertDenied(result, "ai_gateway_closed");

  assert.equal(capturedSignal.aborted, true);

  pending.resolve(reply());

  await new Promise(resolve =>
    setImmediate(resolve)
  );

  assertDenied(result, "ai_gateway_closed");

  assertDenied(
    await gateway.execute(fx.input()),
    "ai_gateway_closed"
  );

  gateway.close();
});


/*
 * TEST 28 — SAFE PROVIDER ERRORS
 */

test("sanitizes provider failures without exposing secrets or retrying", async t => {
  const fx = await fixture(t);

  await fx.pay();

  let executions = 0;

  const gateway = fx.createGateway({
    async generate() {
      executions++;

      throw new Error(
        "SYNTHETIC_PRIVATE_API_KEY"
      );
    }
  });

  const result = await gateway.execute(
    fx.input()
  );

  assertDenied(result, "ai_gateway_unavailable");

  assert.equal(executions, 1);

  assert.equal(
    JSON.stringify(result).includes(
      "SYNTHETIC_PRIVATE_API_KEY"
    ),
    false
  );

  const consentFailure = fx.createGateway({
    async getProcessingConsent() {
      throw new Error("PRIVATE_CONSENT_ERROR");
    }
  });

  assertDenied(
    await consentFailure.execute(fx.input()),
    "ai_gateway_unavailable"
  );
});


/*
 * TEST 29 — CONCURRENT ACCOUNT ISOLATION
 */

test("isolates concurrent inference results and active character revisions", async t => {
  const fx = await fixture(t);

  await fx.pay(fx.playerA);
  await fx.pay(fx.playerB);

  fx.select(OTHER);

  const gateway = fx.createGateway({
    async generate(request) {
      return reply({
        text: request.characterId
      });
    }
  });

  const [resultA, resultB] = await Promise.all([
    gateway.execute(
      fx.input(fx.playerA, {
        characterId: OTHER
      })
    ),

    gateway.execute(
      fx.input(fx.playerB, {
        action: "market_analysis"
      })
    )
  ]);

  assertCompleted(
    resultA,
    fx.playerA,
    OTHER,
    2
  );

  assertCompleted(
    resultB,
    fx.playerB,
    CHARACTER,
    1
  );

  assert.equal(resultA.text, OTHER);
  assert.equal(resultB.text, CHARACTER);

  assert.equal(
    resultB.action,
    "market_analysis"
  );

  assert.notEqual(
    resultA.identity.agentId,
    resultB.identity.agentId
  );
});


/*
 * TEST 30 — IMMUTABLE SECURITY POLICY
 */

test("publishes immutable AI limits and fail closed execution policy", async t => {
  const fx = await fixture(t);

  const policy = fx.gateway.getPolicy();
  const limits = fx.gateway.getLimits();

  for (const field of [
    "disabledByDefault",
    "providerIndependent",
    "serverAuthenticationRequired",
    "subscriptionRequired",
    "activeCharacterRequired",
    "selectionRevisionRequired",
    "processingConsentRequired",
    "preDispatchAuthorizationRequired",
    "postInferenceAuthorizationRequired",
    "failClosed"
  ]) {
    assert.equal(policy[field], true, field);
  }

  for (const field of [
    "clientProviderSelectionAllowed",
    "clientModelSelectionAllowed",
    "clientLimitsTrusted",
    "automaticMemoryCollectionEnabled",
    "externalModelTrainingAuthorized",
    "providerToolsEnabled",
    "streamingEnabled",
    "automaticRetriesEnabled",
    "tradingAuthorized"
  ]) {
    assert.equal(policy[field], false, field);
  }

  assert.deepEqual(limits, {
    timeoutMs: 30000,
    maxAuthorizationAgeMs: 5000,
    maxInputBytes: 8192,
    maxOutputBytes: 16384,
    maxInputTokens: 4096,
    maxOutputTokens: 1024
  });

  assert.deepEqual(
    fx.gateway.getActions(),
    ["chat", "market_analysis"]
  );

  assert.equal(policy.providerConfigured, true);
  assert.equal(policy.consentProviderConfigured, true);

  assert.equal(Object.isFrozen(policy), true);
  assert.equal(Object.isFrozen(limits), true);
  assert.equal(Object.isFrozen(fx.gateway), true);
  assert.equal(
    Object.isFrozen(fx.gateway.getActions()),
    true
  );
});

/*
 * R2.8C3A
 * GENERATION AUTHORIZATION INTEGRATION
 */

function generationContext(request) {
  return {
    providerId: request.providerId,
    model: request.model,
    characterId: request.characterId,
    action: request.action,
    inputTokens: 24,
    maxOutputTokens: request.maxOutputTokens
  };
}

test(
  "R2.8C3A authorizes generation after token counting",
  async t => {
    const fx = await fixture(t);

    await fx.pay();

    let generationCalls = 0;

    const gateway = fx.createGateway({
      requireGenerationAuthorization: true,

      async generate(request, options) {
        assert.equal(
          typeof options.beforeGeneration,
          "function"
        );

        const authorized =
          await options.beforeGeneration(
            generationContext(request),
            { signal: options.signal }
          );

        assert.equal(authorized, true);

        generationCalls++;

        return reply();
      }
    });

    const result = await gateway.execute(
      fx.input()
    );

    assertCompleted(result, fx.playerA);

    assert.equal(generationCalls, 1);

    assert.equal(
      gateway.getPolicy()
        .generationAuthorizationRequired,
      true
    );
  }
);


test(
  "R2.8C3A blocks changed processing consent",
  async t => {
    const fx = await fixture(t);

    await fx.pay();

    let generationCalls = 0;

    const gateway = fx.createGateway({
      requireGenerationAuthorization: true,

      async generate(request, options) {
        fx.setConsent(false);

        const allowed =
          await options.beforeGeneration(
            generationContext(request),
            { signal: options.signal }
          );

        if (allowed) {
          generationCalls++;
        }

        return reply();
      }
    });

    assertDenied(
      await gateway.execute(fx.input()),
      "ai_generation_authorization_denied"
    );

    assert.equal(generationCalls, 0);
  }
);


test(
  "R2.8C3A blocks changed character selection",
  async t => {
    const fx = await fixture(t);

    await fx.pay();

    const gateway = fx.createGateway({
      requireGenerationAuthorization: true,

      async generate(request, options) {
        fx.select(OTHER);

        const allowed =
          await options.beforeGeneration(
            generationContext(request),
            { signal: options.signal }
          );

        assert.equal(allowed, false);

        return reply();
      }
    });

    assertDenied(
      await gateway.execute(fx.input()),
      "ai_generation_authorization_denied"
    );
  }
);


test(
  "R2.8C3A rejects skipped authorization",
  async t => {
    const fx = await fixture(t);

    await fx.pay();

    const gateway = fx.createGateway({
      requireGenerationAuthorization: true,

      async generate() {
        return reply();
      }
    });

    assertDenied(
      await gateway.execute(fx.input()),
      "ai_generation_authorization_denied"
    );
  }
);


test(
  "R2.8C3A rejects duplicate authorization",
  async t => {
    const fx = await fixture(t);

    await fx.pay();

    const gateway = fx.createGateway({
      requireGenerationAuthorization: true,

      async generate(request, options) {
        const context =
          generationContext(request);

        const config = {
          signal: options.signal
        };

        assert.equal(
          await options.beforeGeneration(
            context,
            config
          ),
          true
        );

        assert.equal(
          await options.beforeGeneration(
            context,
            config
          ),
          false
        );

        return reply();
      }
    });

    assertDenied(
      await gateway.execute(fx.input()),
      "ai_generation_authorization_denied"
    );
  }
);


test(
  "R2.8C3A rejects unauthorized token count",
  async t => {
    const fx = await fixture(t);

    await fx.pay();

    const gateway = fx.createGateway({
      requireGenerationAuthorization: true,

      async generate(request, options) {
        const allowed =
          await options.beforeGeneration(
            {
              ...generationContext(request),
              inputTokens: 999999
            },
            { signal: options.signal }
          );

        assert.equal(allowed, false);

        return reply();
      }
    });

    assertDenied(
      await gateway.execute(fx.input()),
      "ai_generation_authorization_denied"
    );
  }
);


test(
  "R2.8C3A rejects usage above authorized tokens",
  async t => {
    const fx = await fixture(t);

    await fx.pay();

    const gateway = fx.createGateway({
      requireGenerationAuthorization: true,

      async generate(request, options) {
        assert.equal(
          await options.beforeGeneration(
            generationContext(request),
            { signal: options.signal }
          ),
          true
        );

        return reply({
          usage: {
            inputTokens: 25,
            outputTokens: 8
          }
        });
      }
    });

    assertDenied(
      await gateway.execute(fx.input()),
      "ai_generation_token_usage_exceeded"
    );
  }
);


test(
  "R2.8C3A forbids disabling OpenAI authorization",
  () => {
    assert.throws(
      () => createLagoAIGateway({
        runtimeAccess: {
          async authorize() {
            return null;
          }
        },

        providerId: "openai",

        requireGenerationAuthorization: false
      }),

      /ai_generation_authorization_required/
    );
  }
);

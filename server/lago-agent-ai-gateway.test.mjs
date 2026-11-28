import {
  createLagoAIConsentStore,
  AI_CONSENT_POLICY_VERSION
} from "./lago-agent-ai-consent-store.mjs";

import {
  createLagoAIRateLimiter,
  AI_RATE_LIMITS
} from "./lago-agent-ai-rate-limiter.mjs";

import {
  createLagoAIUsageLedger
} from "./lago-agent-ai-usage-ledger.mjs";

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

    function createUsageLedger(limits) {
    const ledger = createLagoAIUsageLedger({
      directory: join(
        root,
        "private-ai-usage"
      ),

      projectRoot,

      limits,

      now
    });

    services.push(ledger);

    return ledger;
  }

    function createSecurityStores(
    limits = AI_RATE_LIMITS
  ) {
    const consentStore =
      createLagoAIConsentStore({
        directory: join(
          root,
          "private-consent"
        ),

        projectRoot,

        sessionStore: sessions,

        model: MODEL,

        now
      });

    services.push(consentStore);

    const rateLimiter =
      createLagoAIRateLimiter({
        directory: join(
          root,
          "private-rate"
        ),

        projectRoot,

        limits,

        now
      });

    services.push(rateLimiter);

    return {
      consentStore,

      rateLimiter
    };
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
    createUsageLedger,
        createSecurityStores,
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

/*
 * LAGO GAME
 * R2.8C3B — GATEWAY + OPENAI INTEGRATION
 *
 * Real gateway.
 * Real OpenAI adapter.
 * Real authentication and entitlement.
 * Synthetic HTTP transport.
 *
 * No real API calls.
 * No real credentials.
 * No billable inference.
 */

import {
  createLagoOpenAIAdapter
} from "./lago-agent-openai-adapter.mjs";

const R28C3B_COUNT_URL =
  "https://api.openai.com/v1/responses/input_tokens";

const R28C3B_GENERATE_URL =
  "https://api.openai.com/v1/responses";

function r28c3bJSON(value, status = 200) {
  return new Response(
    JSON.stringify(value),
    {
      status,

      headers: {
        "content-type": "application/json"
      }
    }
  );
}

function r28c3bOutput(inputTokens = 24) {
  return {
    object: "response",
    status: "completed",
    model: MODEL,

    error: null,
    incomplete_details: null,

    store: false,
    tools: [],

    output: [
      {
        type: "message",
        role: "assistant",
        status: "completed",

        content: [
          {
            type: "output_text",
            text: "Integrated agent response.",
            annotations: []
          }
        ]
      }
    ],

    usage: {
      input_tokens: inputTokens,
      output_tokens: 8,
      total_tokens: inputTokens + 8
    }
  };
}


async function r28c3bFixture(t, config = {}) {
    const fx = await fixture(t);

  const usageLedger =
    config.withoutLedger === true
      ? null
      : fx.createUsageLedger(
          config.limits
        );

    const security =
    config.guarded === true
      ? fx.createSecurityStores(
          config.rateLimits
        )
      : null;

  if (
    security !== null &&
    config.grantConsent !== false
  ) {
    const granted =
      await security.consentStore.setConsent({
        sessionToken:
          fx.playerA.token,

        granted: true,

        policyVersion:
          AI_CONSENT_POLICY_VERSION,

        expectedRevision: 0
      });

    assert.equal(
      granted.ok,
      true,
      granted.reason
    );
  }
  
  const httpCalls = [];

  let gateway = null;

  const adapter = createLagoOpenAIAdapter({
    apiKey: "synthetic-integration-key",

    model: MODEL,

    enabled: true,

    requireGenerationAuthorization: true,

    async fetchImpl(url, options) {
      const body = JSON.parse(options.body);

      httpCalls.push({
        url,
        body,
        signal: options.signal
      });

      if (url === R28C3B_COUNT_URL) {
        fx.calls.push("count");

        if (config.onCount) {
          await config.onCount(fx, gateway);
        }

        return r28c3bJSON({
          object: "response.input_tokens",

          input_tokens:
            config.inputTokens ?? 24
        });
      }

      if (url === R28C3B_GENERATE_URL) {
        fx.calls.push("generation");

        if (config.onGenerate) {
          await config.onGenerate(
            fx,
            gateway
          );
        }

        return r28c3bJSON(
          r28c3bOutput(
            config.outputInputTokens ?? 24
          )
        );
      }

      throw new Error(
        "unexpected_integration_endpoint"
      );
    }
  });

  t.after(() => adapter.close());

    gateway = fx.createGateway({
    providerId: "openai",

    model: MODEL,

    generate: adapter.generate,

        usageLedger,

    ...(security === null
      ? {}
      : {
          rateLimiter:
            security.rateLimiter,

          getProcessingConsent:
            security.consentStore
              .getProcessingConsent,

          getProcessingConsentRevision:
            security.consentStore
              .getProcessingConsentRevision
        })
    });

  if (config.paid !== false) {
    await fx.pay();
  }

  return {
    fx,

        adapter,

    gateway,

        usageLedger,

    security,

    httpCalls,

    execute(changes = {}) {
      return gateway.execute(
        fx.input(
          fx.playerA,
          changes
        )
      );
    }
  };
}


function r28c3bAssertCountOnly(env) {
  assert.deepEqual(
    env.httpCalls.map(call => call.url),
    [R28C3B_COUNT_URL]
  );
}


/*
 * TEST 01
 *
 * Full authorized inference.
 */

test(
  "R2.8C3B executes real gateway and adapter",
  async t => {
    const env = await r28c3bFixture(t);

    const result = await env.execute();

    assert.equal(
      result.ok,
      true,
      result.reason
    );

    assert.equal(
      result.providerId,
      "openai"
    );

    assert.equal(result.model, MODEL);

    assert.equal(
      result.identity.accountId,
      env.fx.playerA.accountId
    );

    assert.equal(
      result.identity.characterId,
      CHARACTER
    );

    assert.equal(
      result.selectionRevision,
      1
    );

    assert.equal(
      result.text,
      "Integrated agent response."
    );

    assert.deepEqual(result.usage, {
      inputTokens: 24,
      outputTokens: 8,
      totalTokens: 32
    });

    assertLocked(result);

    assert.deepEqual(
      env.httpCalls.map(call => call.url),
      [
        R28C3B_COUNT_URL,
        R28C3B_GENERATE_URL
      ]
    );

    assert.deepEqual(
      env.fx.calls,
      [
        "authorize",
        "consent",
        "authorize",
        "count",
        "consent",
        "authorize",
        "generation",
        "consent",
        "authorize"
      ]
    );
  }
);


/*
 * TEST 02
 *
 * No subscription means no HTTP.
 */

test(
  "R2.8C3B blocks all HTTP without subscription",
  async t => {
    const env = await r28c3bFixture(t, {
      paid: false
    });

    assertDenied(
      await env.execute(),
      "ai_authorization_denied"
    );

    assert.deepEqual(
      env.httpCalls,
      []
    );
  }
);


/*
 * TEST 03
 *
 * Invalid session means no HTTP.
 */

test(
  "R2.8C3B blocks invalid session before HTTP",
  async t => {
    const env = await r28c3bFixture(t);

    assertDenied(
      await env.execute({
        sessionToken: "invalid-session"
      }),

      "ai_authorization_denied"
    );

    assert.deepEqual(
      env.httpCalls,
      []
    );
  }
);


/*
 * TEST 04
 *
 * Consent revoked during token counting.
 */

test(
  "R2.8C3B blocks generation after consent revocation",
  async t => {
    const env = await r28c3bFixture(t, {
      onCount(fx) {
        fx.setConsent(false);
      }
    });

    assertDenied(
      await env.execute(),
      "ai_generation_authorization_denied"
    );

    r28c3bAssertCountOnly(env);
  }
);


/*
 * TEST 05
 *
 * Character changed during token counting.
 */

test(
  "R2.8C3B blocks generation after character switch",
  async t => {
    const env = await r28c3bFixture(t, {
      onCount(fx) {
        fx.select(OTHER);
      }
    });

    assertDenied(
      await env.execute(),
      "ai_generation_authorization_denied"
    );

    r28c3bAssertCountOnly(env);
  }
);


/*
 * TEST 06
 *
 * Character changed away and back.
 * Persistent revision must still differ.
 */

test(
  "R2.8C3B blocks stale character revision",
  async t => {
    const env = await r28c3bFixture(t, {
      onCount(fx) {
        fx.select(OTHER);
        fx.select(CHARACTER);
      }
    });

    assertDenied(
      await env.execute(),
      "ai_generation_authorization_denied"
    );

    r28c3bAssertCountOnly(env);
  }
);


/*
 * TEST 07
 *
 * Session expires during token counting.
 */

test(
  "R2.8C3B blocks generation after session expiry",
  async t => {
    const env = await r28c3bFixture(t, {
      onCount(fx) {
        fx.advance(3600001);
      }
    });

    const result = await env.execute();

    assert.equal(result.ok, false);

    assert.equal(
      result.inferenceCompleted,
      false
    );

    assert.equal(result.text, null);

    assertLocked(result);

    r28c3bAssertCountOnly(env);
  }
);


/*
 * TEST 08
 *
 * Input token limit.
 */

test(
  "R2.8C3B blocks excessive input token count",
  async t => {
    const env = await r28c3bFixture(t, {
      inputTokens: 4097
    });

    const result = await env.execute();

    assert.equal(result.ok, false);
    assert.equal(result.text, null);

    assertLocked(result);

    r28c3bAssertCountOnly(env);
  }
);


/*
 * TEST 09
 *
 * Consent revoked after generation.
 */

test(
  "R2.8C3B discards output after consent withdrawal",
  async t => {
    const env = await r28c3bFixture(t, {
      onGenerate(fx) {
        fx.setConsent(false);
      }
    });

    assertDenied(
      await env.execute(),
      "ai_processing_consent_changed"
    );

    assert.equal(
      env.httpCalls.length,
      2
    );
  }
);


/*
 * TEST 10
 *
 * Active character changed after generation.
 */

test(
  "R2.8C3B discards output after character switch",
  async t => {
    const env = await r28c3bFixture(t, {
      onGenerate(fx) {
        fx.select(OTHER);
      }
    });

    assertDenied(
      await env.execute(),
      "ai_authorization_context_changed"
    );

    assert.equal(
      env.httpCalls.length,
      2
    );
  }
);


/*
 * TEST 11
 *
 * Actual usage exceeds counted tokens.
 */

test(
  "R2.8C3B rejects usage exceeding authorization",
  async t => {
    const env = await r28c3bFixture(t, {
      inputTokens: 24,

      outputInputTokens: 25
    });

    assertDenied(
      await env.execute(),
      "ai_generation_token_usage_exceeded"
    );

    assert.equal(
      env.httpCalls.length,
      2
    );
  }
);


/*
 * TEST 12
 *
 * Gateway closes during token counting.
 */

test(
  "R2.8C3B blocks generation after gateway shutdown",
  async t => {
    const env = await r28c3bFixture(t, {
      onCount(fx, gateway) {
        gateway.close();
      }
    });

    assertDenied(
      await env.execute(),
      "ai_gateway_closed"
    );

    r28c3bAssertCountOnly(env);

    assert.equal(
      env.httpCalls[0].signal.aborted,
      true
    );
  }
);


/*
 * TEST 13
 *
 * No private identity information in HTTP.
 */

test(
  "R2.8C3B never sends account credentials to provider",
  async t => {
    const env = await r28c3bFixture(t);

    const result = await env.execute();

    assert.equal(
      result.ok,
      true,
      result.reason
    );

    for (const call of env.httpCalls) {
      const serialized =
        JSON.stringify(call.body);

      assert.equal(
        serialized.includes(
          env.fx.playerA.token
        ),
        false
      );

      assert.equal(
        serialized.includes(
          env.fx.playerA.accountId
        ),
        false
      );

      assert.equal(
        serialized.includes(
          "synthetic-integration-key"
        ),
        false
      );

      assert.deepEqual(
        call.body.tools,
        []
      );

      assert.equal(
        call.body.tool_choice,
        "none"
      );

      for (const field of [
        "sessionToken",
        "accountId",
        "selectionRevision",
        "wallet",
        "memory",
        "apiKey"
      ]) {
        assert.equal(
          Object.hasOwn(
            call.body,
            field
          ),

          false
        );
      }
    }
  }
);


/*
 * TEST 14
 *
 * Provider context cannot change after
 * token counting.
 */

test(
  "R2.8C3B preserves identical counted and generated context",
  async t => {
    const env = await r28c3bFixture(t);

    const result = await env.execute();

    assert.equal(
      result.ok,
      true,
      result.reason
    );

    const [count, generate] =
      env.httpCalls;

    assert.deepEqual(
      generate.body,
      {
        ...count.body,

        store: false,
        stream: false,
        background: false,

        max_output_tokens: 1024
      }
    );

    assert.equal(
      count.signal,
      generate.signal
    );

    assert.equal(
      generate.signal.aborted,
      true
    );
  }
);

/*
 * LAGO GAME
 * R2.8C5B
 * GATEWAY BUDGET INTEGRATION TESTS
 */

const R28C5B_LIMITS = Object.freeze({
  dailyTokens: 1050,

  monthlyTokens: 5000,

  dailyRequests: 100,

  maxInputTokens: 4096,

  maxOutputTokens: 1024
});

function r28c5bUsage(env) {
  const result =
    env.usageLedger.getUsage(
      env.fx.playerA.accountId
    );

  assert.equal(
    result.ok,
    true,
    result.reason
  );

  return result.usage;
}

function r28c5bPending(env) {
  const result =
    env.usageLedger.listPendingReservations(
      env.fx.playerA.accountId
    );

  assert.equal(
    result.ok,
    true,
    result.reason
  );

  return result.reservations;
}


/*
 * TEST 01 — MANDATORY LEDGER
 */

test(
  "R2.8C5B blocks OpenAI without persistent usage ledger",
  async t => {
    const env = await r28c3bFixture(t, {
      withoutLedger: true
    });

    assertDenied(
      await env.execute(),

      "ai_usage_ledger_required"
    );

    assert.deepEqual(
      env.httpCalls,
      []
    );
  }
);


/*
 * TEST 02 — CONFIGURATION
 */

test(
  "R2.8C5B rejects malformed ledger configuration",
  () => {
    assert.throws(
      () => createLagoAIGateway({
        runtimeAccess: {
          async authorize() {
            return null;
          }
        },

        providerId: "openai",

        usageLedger: {}
      }),

      /invalid_ai_usage_ledger/
    );
  }
);


/*
 * TEST 03 — RESERVE BEFORE HTTP
 */

test(
  "R2.8C5B reserves and claims dispatch before paid generation",
  async t => {
    let env;

    let inspected = false;

    env = await r28c3bFixture(t, {
      onGenerate() {
        const usage =
          r28c5bUsage(env);

        assert.equal(
          usage.dailyReservedTokens,
          1048
        );

        assert.equal(
          usage.dailyUsedTokens,
          0
        );

        const pending =
          r28c5bPending(env);

        assert.equal(
          pending.length,
          1
        );

        assert.equal(
          pending[0].state,
          "dispatched"
        );

        inspected = true;
      }
    });

    const result =
      await env.execute();

    assert.equal(
      result.ok,
      true,
      result.reason
    );

    assert.equal(inspected, true);

    const usage =
      r28c5bUsage(env);

    assert.equal(
      usage.dailyUsedTokens,
      32
    );

    assert.equal(
      usage.dailyReservedTokens,
      0
    );

    assert.equal(
      usage.dailyRequests,
      1
    );

    assert.equal(
      usage.dailyReservedRequests,
      0
    );

    assert.deepEqual(
      r28c5bPending(env),
      []
    );
  }
);


/*
 * TEST 04 — EXHAUSTED QUOTA
 */

test(
  "R2.8C5B exhausted budget prevents paid generation",
  async t => {
    const env = await r28c3bFixture(t, {
      limits: R28C5B_LIMITS
    });

    const first =
      await env.execute();

    assert.equal(
      first.ok,
      true,
      first.reason
    );

    assertDenied(
      await env.execute(),

      "ai_daily_token_budget_exceeded"
    );

    assert.deepEqual(
      env.httpCalls.map(
        call => call.url
      ),

      [
        R28C3B_COUNT_URL,

        R28C3B_GENERATE_URL,

        R28C3B_COUNT_URL
      ]
    );

    assert.equal(
      r28c5bUsage(env).dailyUsedTokens,
      32
    );

    assert.equal(
      r28c5bUsage(env).dailyReservedTokens,
      0
    );
  }
);


/*
 * TEST 05 — UNKNOWN OUTCOME
 */

test(
  "R2.8C5B provider failure retains uncertain usage",
  async t => {
    const env = await r28c3bFixture(t, {
      limits: R28C5B_LIMITS,

      onGenerate() {
        throw new Error(
          "synthetic_network_failure"
        );
      }
    });

    assertDenied(
      await env.execute(),

      "ai_gateway_unavailable"
    );

    const pending =
      r28c5bPending(env);

    assert.equal(
      pending.length,
      1
    );

    assert.equal(
      pending[0].state,
      "uncertain"
    );

    assert.equal(
      r28c5bUsage(env).dailyReservedTokens,
      1048
    );

    assert.equal(
      r28c5bUsage(env).dailyUsedTokens,
      0
    );

    assertDenied(
      await env.execute(),

      "ai_daily_token_budget_exceeded"
    );

    assert.equal(
      env.httpCalls.filter(
        call => call.url ===
          R28C3B_GENERATE_URL
      ).length,

      1
    );
  }
);


/*
 * TEST 06 — CONSENT AFTER GENERATION
 */

test(
  "R2.8C5B settles cost before rejecting withdrawn consent",
  async t => {
    const env = await r28c3bFixture(t, {
      onGenerate(fx) {
        fx.setConsent(false);
      }
    });

    assertDenied(
      await env.execute(),

      "ai_processing_consent_changed"
    );

    const usage =
      r28c5bUsage(env);

    assert.equal(
      usage.dailyUsedTokens,
      32
    );

    assert.equal(
      usage.dailyReservedTokens,
      0
    );

    assert.deepEqual(
      r28c5bPending(env),
      []
    );
  }
);


/*
 * TEST 07 — CONSENT BEFORE GENERATION
 */

test(
  "R2.8C5B denies revoked consent without creating reservation",
  async t => {
    const env = await r28c3bFixture(t, {
      onCount(fx) {
        fx.setConsent(false);
      }
    });

    assertDenied(
      await env.execute(),

      "ai_generation_authorization_denied"
    );

    r28c3bAssertCountOnly(env);

    assert.equal(
      r28c5bUsage(env).dailyUsedTokens,
      0
    );

    assert.equal(
      r28c5bUsage(env).dailyReservedTokens,
      0
    );

    assert.deepEqual(
      r28c5bPending(env),
      []
    );
  }
);


/*
 * TEST 08 — PROVIDER OVERAGE
 */

test(
  "R2.8C5B accounts for provider overage without disclosing output",
  async t => {
    const env = await r28c3bFixture(t, {
      inputTokens: 24,

      outputInputTokens: 25
    });

    assertDenied(
      await env.execute(),

      "ai_generation_token_usage_exceeded"
    );

    assert.equal(
      r28c5bUsage(env).dailyUsedTokens,
      33
    );

    assert.equal(
      r28c5bUsage(env).dailyReservedTokens,
      0
    );
  }
);


/*
 * TEST 09 — ACCOUNT ISOLATION
 */

test(
  "R2.8C5B usage remains isolated by authenticated account",
  async t => {
    const env =
      await r28c3bFixture(t);

    const result =
      await env.execute();

    assert.equal(
      result.ok,
      true,
      result.reason
    );

    const foreign =
      env.usageLedger.getUsage(
        env.fx.playerB.accountId
      );

    assert.equal(
      foreign.ok,
      true,
      foreign.reason
    );

    assert.equal(
      foreign.usage.dailyUsedTokens,
      0
    );

    assert.equal(
      foreign.usage.dailyReservedTokens,
      0
    );

    assert.equal(
      r28c5bUsage(env).dailyUsedTokens,
      32
    );
  }
);


/*
 * TEST 10 — CLOSED LEDGER
 */

test(
  "R2.8C5B unavailable ledger fails closed before generation",
  async t => {
    const env =
      await r28c3bFixture(t);

    env.usageLedger.close();

    assertDenied(
      await env.execute(),

      "ai_usage_reservation_failed"
    );

    r28c3bAssertCountOnly(env);
  }
);


/*
 * TEST 11 — GATEWAY POLICY
 */

test(
  "R2.8C5B exposes mandatory accounting policy",
  async t => {
    const env =
      await r28c3bFixture(t);

    const policy =
      env.gateway.getPolicy();

    assert.equal(
      policy.usageLedgerConfigured,
      true
    );

    assert.equal(
      policy.usageReservationRequired,
      true
    );

    assert.equal(
      policy.atomicUsageReservationEnabled,
      true
    );

    assert.equal(
      policy.usageSettlementEnabled,
      true
    );

    assert.equal(
      policy.openAIBudgetBypassAllowed,
      false
    );

    assert.equal(
      policy.clientUsageCountersTrusted,
      false
    );

    assert.ok(
      Object.isFrozen(policy)
    );
  }
);

/*
 * LAGO GAME
 * R2.8C6C3A — CONSENT AND RATE INTEGRATION
 */

async function changeGuardedConsent(
  env,
  granted,
  expectedRevision
) {
  const result =
    await env.security.consentStore.setConsent({
      sessionToken:
        env.fx.playerA.token,

      granted,

      expectedRevision,

      policyVersion:
        AI_CONSENT_POLICY_VERSION
    });

  assert.equal(
    result.ok,
    true,
    result.reason
  );

  return result;
}


/*
 * TEST 01 — DEFAULT CONSENT DENIAL
 */

test(
  "R2.8C6C3A denies inference without persistent consent",
  async t => {
    const env = await r28c3bFixture(t, {
      guarded: true,

      grantConsent: false
    });

    assertDenied(
      await env.execute(),

      "ai_processing_consent_required"
    );

    assert.deepEqual(
      env.httpCalls,
      []
    );

    assert.equal(
      r28c5bUsage(env).dailyUsedTokens,
      0
    );
  }
);


/*
 * TEST 02 — FULL GUARDED EXECUTION
 */

test(
  "R2.8C6C3A executes guarded inference and releases completed slot",
  async t => {
    const env = await r28c3bFixture(t, {
      guarded: true
    });

    for (let i = 0; i < 2; i++) {
      const result = await env.execute();

      assert.equal(
        result.ok,
        true,
        result.reason
      );
    }

    assert.equal(
      env.httpCalls.length,
      4
    );

    assert.equal(
      r28c5bUsage(env).dailyUsedTokens,
      64
    );

    assert.deepEqual(
      r28c5bPending(env),
      []
    );
  }
);


/*
 * TEST 03 — RATE BEFORE TOKEN COUNT
 */

test(
  "R2.8C6C3A exhausted rate blocks all subsequent provider HTTP",
  async t => {
    const env = await r28c3bFixture(t, {
      guarded: true,

      rateLimits: {
        ...AI_RATE_LIMITS,

        accountPerMinute: 1
      }
    });

    const first = await env.execute();

    assert.equal(
      first.ok,
      true,
      first.reason
    );

    assertDenied(
      await env.execute(),

      "ai_account_minute_rate_exceeded"
    );

    assert.equal(
      env.httpCalls.length,
      2
    );
  }
);


/*
 * TEST 04 — ACTIVE CONCURRENCY SLOT
 */

test(
  "R2.8C6C3A blocks concurrent inference before provider counting",
  async t => {
    const env = await r28c3bFixture(t, {
      guarded: true
    });

    const limiter =
      env.security.rateLimiter;

    const identity = {
      accountId:
        env.fx.playerA.accountId
    };

    const claim =
      limiter.acquire(identity);

    assert.equal(
      claim.ok,
      true,
      claim.reason
    );

    assertDenied(
      await env.execute(),

      "ai_account_concurrency_exceeded"
    );

    assert.deepEqual(
      env.httpCalls,
      []
    );

    assert.equal(
      limiter.release({
        ...identity,

        requestId:
          claim.requestId
      }).ok,
      true
    );

    const result =
      await env.execute();

    assert.equal(
      result.ok,
      true,
      result.reason
    );
  }
);


/*
 * TEST 05 — REVOKE AND REGRANT
 * DURING TOKEN COUNT
 */

test(
  "R2.8C6C3A rejects changed consent revision before paid generation",
  async t => {
    let env;

    env = await r28c3bFixture(t, {
      guarded: true,

      async onCount() {
        await changeGuardedConsent(
          env,
          false,
          1
        );

        await changeGuardedConsent(
          env,
          true,
          2
        );
      }
    });

    assertDenied(
      await env.execute(),

      "ai_generation_authorization_denied"
    );

    r28c3bAssertCountOnly(env);

    assert.equal(
      r28c5bUsage(env).dailyReservedTokens,
      0
    );
  }
);


/*
 * TEST 06 — REVOKE AND REGRANT
 * DURING GENERATION
 */

test(
  "R2.8C6C3A settles usage but rejects changed consent after inference",
  async t => {
    let env;

    env = await r28c3bFixture(t, {
      guarded: true,

      async onGenerate() {
        await changeGuardedConsent(
          env,
          false,
          1
        );

        await changeGuardedConsent(
          env,
          true,
          2
        );
      }
    });

    assertDenied(
      await env.execute(),

      "ai_processing_consent_changed"
    );

    assert.equal(
      r28c5bUsage(env).dailyUsedTokens,
      32
    );

    assert.equal(
      r28c5bUsage(env).dailyReservedTokens,
      0
    );
  }
);


/*
 * TEST 07 — RATE STORAGE FAILURE
 */

test(
  "R2.8C6C3A fails closed when rate storage is unavailable",
  async t => {
    const env = await r28c3bFixture(t, {
      guarded: true
    });

    env.security.rateLimiter.close();

    assertDenied(
      await env.execute(),

      "ai_rate_admission_failed"
    );

    assert.deepEqual(
      env.httpCalls,
      []
    );
  }
);


/*
 * TEST 08 — PROVIDER ERROR ACCOUNTING
 */

test(
  "R2.8C6C3A releases finished local execution without refunding uncertain usage",
  async t => {
    const env = await r28c3bFixture(t, {
      guarded: true,

      onGenerate() {
        throw new Error(
          "synthetic_provider_error"
        );
      }
    });

    assertDenied(
      await env.execute(),

      "ai_gateway_unavailable"
    );

    assert.equal(
      r28c5bPending(env)[0].state,
      "uncertain"
    );

    assert.equal(
      r28c5bUsage(env).dailyReservedTokens,
      1048
    );

    const limiter =
      env.security.rateLimiter;

    const claim = limiter.acquire({
      accountId:
        env.fx.playerA.accountId
    });

    assert.equal(
      claim.ok,
      true,
      claim.reason
    );

    assert.equal(
      limiter.release({
        requestId:
          claim.requestId,

        accountId:
          claim.accountId
      }).ok,
      true
    );
  }
);

/*
 * R2.8C6C3B
 * FULL PROVIDER SERVICE INTEGRATION
 */

import {
  createLagoAIProviderService
} from "./lago-agent-ai-provider-service.mjs";


test(
  "R2.8C6C3B full service enforces consent rate limits and persistent usage",

  async t => {
    const fx = await fixture(t);

    await fx.pay();

    const root = await mkdtemp(
      join(
        tmpdir(),
        "lago-full-provider-"
      )
    );

    const projectRoot = join(
      root,
      "project"
    );

    const directory = join(
      root,
      "private-ai"
    );

    let service = null;

    t.after(async () => {
      if (service !== null) {
        await service.close();
      }

      await rm(root, {
        recursive: true,
        force: true
      });
    });

    await mkdir(projectRoot);

    const calls = [];

    const config = {
      env: {
        LAGO_AI_PROVIDER_ENABLED: "1",

        LAGO_OPENAI_API_KEY:
          "synthetic-full-provider-key",

        LAGO_OPENAI_MODEL:
          MODEL,

        LAGO_AI_USAGE_DATA_DIR:
          directory
      },

      projectRoot,

      sessionStore: fx.sessions,

      runtimeAccess: fx.runtime,

      now: () => START,

      rateLimits: {
        ...AI_RATE_LIMITS,

        accountPerMinute: 1
      },

      async fetchImpl(url, options) {
        calls.push(url);

        if (
          url === R28C3B_COUNT_URL
        ) {
          return r28c3bJSON({
            object:
              "response.input_tokens",

            input_tokens: 24
          });
        }

        if (
          url === R28C3B_GENERATE_URL
        ) {
          return r28c3bJSON(
            r28c3bOutput()
          );
        }

        throw new Error(
          "unexpected_provider_endpoint"
        );
      }
    };

    service =
      createLagoAIProviderService(
        config
      );


    /*
     * No consent — no HTTP.
     */

    assertDenied(
      await service.execute(
        fx.input()
      ),

      "ai_processing_consent_required"
    );

    assert.deepEqual(calls, []);


    /*
     * Authenticated explicit consent.
     */

    const granted =
      await service.setConsent({
        sessionToken:
          fx.playerA.token,

        granted: true,

        policyVersion:
          AI_CONSENT_POLICY_VERSION,

        expectedRevision: 0
      });

    assert.equal(
      granted.ok,
      true,
      granted.reason
    );

    assert.equal(granted.revision, 1);


    /*
     * Protected successful inference.
     */

    const result =
      await service.execute(
        fx.input()
      );

    assert.equal(
      result.ok,
      true,
      result.reason
    );

    assert.equal(
      result.usage.totalTokens,
      32
    );

    assertLocked(result);

    assert.deepEqual(
      calls,

      [
        R28C3B_COUNT_URL,
        R28C3B_GENERATE_URL
      ]
    );


    /*
     * Rate exhaustion before counting.
     */

    assertDenied(
      await service.execute(
        fx.input()
      ),

      "ai_account_minute_rate_exceeded"
    );

    assert.equal(calls.length, 2);


    /*
     * Reopen all persistent stores.
     */

    await service.close();

    service =
      createLagoAIProviderService(
        config
      );

    const restored =
      await service.getConsentState({
        sessionToken:
          fx.playerA.token
      });

    assert.equal(
      restored.granted,
      true
    );

    assert.equal(
      restored.revision,
      1
    );

    assertDenied(
      await service.execute(
        fx.input()
      ),

      "ai_account_minute_rate_exceeded"
    );

    assert.equal(calls.length, 2);


    /*
     * Verify persisted usage directly
     * through a separate trusted ledger.
     */

    const accounting =
      createLagoAIUsageLedger({
        directory,

        projectRoot,

        now: () => START
      });

    try {
      const usage =
        accounting.getUsage(
          fx.playerA.accountId
        );

      assert.equal(
        usage.ok,
        true,
        usage.reason
      );

      assert.equal(
        usage.usage.dailyUsedTokens,
        32
      );

      assert.equal(
        usage.usage.dailyReservedTokens,
        0
      );

    } finally {
      accounting.close();
    }


    /*
     * Revocation remains effective
     * even with a persistent rate limit.
     */

    const revoked =
      await service.setConsent({
        sessionToken:
          fx.playerA.token,

        granted: false,

        policyVersion:
          AI_CONSENT_POLICY_VERSION,

        expectedRevision: 1
      });

    assert.equal(
      revoked.ok,
      true,
      revoked.reason
    );

    assert.equal(
      revoked.granted,
      false
    );

    assertDenied(
      await service.execute(
        fx.input()
      ),

      "ai_processing_consent_required"
    );

    assert.equal(calls.length, 2);
  }
);

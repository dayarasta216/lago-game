import { performance } from "node:perf_hooks";

import {
  validCharacterId,
  validateMemoryIdentity,
  createMemoryIdentity
} from "./lago-agent-memory-contract.mjs";

import {
  RUNTIME_ACCESS_VERSION
} from "./lago-agent-runtime-access.mjs";

/*
 * LAGO GAME
 * R2.8C — AI PROVIDER GATEWAY
 *
 * Provider-independent inference boundary.
 * Server-authorized requests only.
 * Persistent character revision binding.
 * Explicit processing consent.
 * Bounded input, output and execution time.
 *
 * No external tools.
 * No memory collection.
 * No model training.
 * No trading execution.
 */

export const AI_GATEWAY_VERSION = 1;

const ACTIONS = Object.freeze([
  "chat",
  "market_analysis"
]);

const LIMITS = Object.freeze({
  timeoutMs: 30000,
  maxAuthorizationAgeMs: 5000,
  maxInputBytes: 8192,
  maxOutputBytes: 16384,
  maxInputTokens: 4096,
  maxOutputTokens: 1024
});

const POLICY = Object.freeze({
  disabledByDefault: true,
  providerIndependent: true,
  serverAuthenticationRequired: true,
  subscriptionRequired: true,
  activeCharacterRequired: true,
  selectionRevisionRequired: true,
  processingConsentRequired: true,
  preDispatchAuthorizationRequired: true,
  postInferenceAuthorizationRequired: true,
  clientProviderSelectionAllowed: false,
  clientModelSelectionAllowed: false,
  clientLimitsTrusted: false,
  automaticMemoryCollectionEnabled: false,
  externalModelTrainingAuthorized: false,
  providerToolsEnabled: false,
  streamingEnabled: false,
  automaticRetriesEnabled: false,
  tradingAuthorized: false,
  failClosed: true
});

const TIMEOUT = Symbol("ai_gateway_timeout");
const CLOSED = Symbol("ai_gateway_closed");
const INVALID_CLOCK = Symbol("invalid_ai_gateway_clock");
const AUTHORIZATION_EXPIRED = Symbol("ai_authorization_expired");


/*
 * COMMON VALIDATION
 */

function plainObject(value) {
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);

  return (
    prototype === Object.prototype ||
    prototype === null
  );
}

function exactFields(value, fields) {
  return (
    plainObject(value) &&
    Object.keys(value).length === fields.length &&
    fields.every(
      field => Object.hasOwn(value, field)
    )
  );
}

function validClock(value) {
  return (
    Number.isSafeInteger(value) &&
    Number.isFinite(new Date(value).getTime())
  );
}

function parseTimestamp(value) {
  if (typeof value !== "string") {
    return null;
  }

  const timestamp = Date.parse(value);

  return (
    Number.isFinite(timestamp) &&
    new Date(timestamp).toISOString() === value
  )
    ? timestamp
    : null;
}

function validIdentifier(value) {
  return (
    typeof value === "string" &&
    /^[A-Za-z0-9_.:/-]{1,128}$/.test(value)
  );
}

function validText(value, maxBytes) {
  return (
    typeof value === "string" &&
    value.length <= maxBytes &&
    value.trim().length > 0 &&
    Buffer.byteLength(value, "utf8") <= maxBytes
  );
}

function reject(reason) {
  return Object.freeze({
    ok: false,
    version: AI_GATEWAY_VERSION,

    identity: null,
    action: null,
    selectionRevision: null,

    text: null,
    usage: null,

    inferenceCompleted: false,
    runtimeAuthorized: false,

    memoryAuthorized: false,
    learningAuthorized: false,
    tradingAuthorized: false,
    externalModelTrainingAuthorized: false,

    reason
  });
}


/*
 * SERVER AUTHORIZATION CONTRACT
 */

function normalizeAuthorization(
  decision,
  characterId,
  action,
  timestamp
) {
  if (
    decision?.ok !== true ||
    decision.version !== RUNTIME_ACCESS_VERSION ||
    decision.authorized !== true ||
    decision.runtimeAuthorized !== true ||
    decision.sessionVerified !== true ||
    decision.characterVerified !== true ||
    decision.subscriptionVerified !== true ||
    decision.selectionRevisionVerified !== true ||
    decision.executionReauthorizationRequired !== true ||
    decision.action !== action ||
    !validateMemoryIdentity(decision.identity) ||
    decision.identity.characterId !== characterId ||
    !Number.isSafeInteger(
      decision.selectionRevision
    ) ||
    decision.selectionRevision < 1 ||
    decision.memoryAuthorized !== false ||
    decision.learningAuthorized !== false ||
    decision.tradingAuthorized !== false ||
    decision.externalModelTrainingAuthorized !== false
  ) {
    return null;
  }

  const issuedAt = parseTimestamp(
    decision.issuedAt
  );

  const validUntil = parseTimestamp(
    decision.validUntil
  );

  const periodEnd = parseTimestamp(
    decision.currentPeriodEnd
  );

  if (
    issuedAt === null ||
    validUntil === null ||
    periodEnd === null ||
    issuedAt > timestamp ||
    validUntil <= timestamp ||
    validUntil <= issuedAt ||
    validUntil > periodEnd ||
    validUntil - issuedAt >
      LIMITS.maxAuthorizationAgeMs
  ) {
    return null;
  }

  return Object.freeze({
    identity: createMemoryIdentity(
      decision.identity.accountId,
      characterId
    ),

    action,

    selectionRevision:
      decision.selectionRevision,

    issuedAt,
    validUntil
  });
}

function sameContext(first, second) {
  return Boolean(
    first &&
    second &&
    first.identity.accountId ===
      second.identity.accountId &&
    first.identity.agentId ===
      second.identity.agentId &&
    first.action === second.action &&
    first.selectionRevision ===
      second.selectionRevision
  );
}


/*
 * PROVIDER RESPONSE VALIDATION
 */

function normalizeProviderResponse(response) {
  if (
    !exactFields(response, [
      "text",
      "usage",
      "finishReason"
    ]) ||
    response.finishReason !== "stop" ||
    !validText(
      response.text,
      LIMITS.maxOutputBytes
    ) ||
    !exactFields(response.usage, [
      "inputTokens",
      "outputTokens"
    ])
  ) {
    return null;
  }

  const {
    inputTokens,
    outputTokens
  } = response.usage;

  if (
    !Number.isSafeInteger(inputTokens) ||
    !Number.isSafeInteger(outputTokens) ||
    inputTokens < 1 ||
    outputTokens < 1 ||
    inputTokens > LIMITS.maxInputTokens ||
    outputTokens > LIMITS.maxOutputTokens
  ) {
    return null;
  }

  return Object.freeze({
    text: response.text,

    usage: Object.freeze({
      inputTokens,
      outputTokens,

      totalTokens:
        inputTokens + outputTokens
    })
  });
}


/*
 * AI GATEWAY FACTORY
 */

export function createLagoAIGateway({
  runtimeAccess,
  generate = null,
  getProcessingConsent = null,

  providerId = null,
  model = null,

  enabled = false,

  now = () => Date.now()
} = {}) {
  if (
    typeof runtimeAccess?.authorize !== "function"
  ) {
    throw new Error(
      "ai_runtime_access_required"
    );
  }

  if (
    generate !== null &&
    typeof generate !== "function"
  ) {
    throw new Error(
      "invalid_ai_provider_adapter"
    );
  }

  if (
    getProcessingConsent !== null &&
    typeof getProcessingConsent !== "function"
  ) {
    throw new Error(
      "invalid_ai_processing_consent_provider"
    );
  }

  if (
    typeof enabled !== "boolean" ||
    typeof now !== "function"
  ) {
    throw new Error(
      "invalid_ai_gateway_configuration"
    );
  }

  if (
    providerId !== null &&
    !validIdentifier(providerId)
  ) {
    throw new Error(
      "invalid_ai_provider_id"
    );
  }

  if (
    model !== null &&
    !validIdentifier(model)
  ) {
    throw new Error(
      "invalid_ai_model_id"
    );
  }

  let closed = false;

  const activeControllers = new Set();


  /*
   * EXECUTE ONE AUTHORIZED INFERENCE
   */

  async function execute(input = {}) {
    if (closed) {
      return reject("ai_gateway_closed");
    }

    let controller = null;
    let timer = null;
    let onAbort = null;

    try {
      if (
        !exactFields(input, [
          "sessionToken",
          "characterId",
          "action",
          "message"
        ])
      ) {
        return reject(
          "invalid_ai_gateway_request"
        );
      }

      const {
        sessionToken,
        characterId,
        action,
        message
      } = input;

      if (
        typeof sessionToken !== "string" ||
        sessionToken.length < 1 ||
        sessionToken.length > 256 ||
        sessionToken.trim() !== sessionToken
      ) {
        return reject(
          "authentication_required"
        );
      }

      if (!validCharacterId(characterId)) {
        return reject("invalid_character");
      }

      if (!ACTIONS.includes(action)) {
        return reject(
          "ai_action_not_allowed"
        );
      }

      if (
        !validText(
          message,
          LIMITS.maxInputBytes
        )
      ) {
        return reject(
          "invalid_ai_message"
        );
      }

      if (!enabled) {
        return reject(
          "ai_gateway_disabled"
        );
      }

      if (
        !generate ||
        !providerId ||
        !model
      ) {
        return reject(
          "ai_provider_unavailable"
        );
      }

      if (!getProcessingConsent) {
        return reject(
          "ai_processing_consent_unavailable"
        );
      }


      /*
       * SHARED INFERENCE DEADLINE
       */

      const startedAt = now();

      if (!validClock(startedAt)) {
        throw INVALID_CLOCK;
      }

      let lastCheckedAt = startedAt;

      const monotonicStart =
        performance.now();

      controller = new AbortController();

      const signal = controller.signal;

      activeControllers.add(controller);

      const cancelled = new Promise(resolve => {
        onAbort = () => resolve(TIMEOUT);

        signal.addEventListener(
          "abort",
          onAbort,
          { once: true }
        );
      });

      timer = setTimeout(
        () => controller.abort(),
        LIMITS.timeoutMs
      );

      function check() {
        if (closed) {
          throw CLOSED;
        }

        const current = now();

        if (
          !validClock(current) ||
          current < lastCheckedAt
        ) {
          throw INVALID_CLOCK;
        }

        lastCheckedAt = current;

        const elapsed =
          performance.now() - monotonicStart;

        if (
          signal.aborted ||
          current - startedAt >=
            LIMITS.timeoutMs ||
          !Number.isFinite(elapsed) ||
          elapsed < 0 ||
          elapsed >= LIMITS.timeoutMs
        ) {
          controller.abort();

          throw TIMEOUT;
        }

        return current;
      }

      async function run(operation) {
        check();

        const task = Promise.resolve(
          operation(signal)
        );

        const result = await Promise.race([
          task,
          cancelled
        ]);

        if (closed) {
          throw CLOSED;
        }

        if (result === TIMEOUT) {
          throw TIMEOUT;
        }

        check();

        return result;
      }


      /*
       * AUTHENTICATION INPUT
       *
       * Never forwarded to the model.
       */

      const authorizationInput =
        Object.freeze({
          sessionToken,
          characterId,
          action
        });

      async function authorize() {
        const decision = await run(
          () => runtimeAccess.authorize(
            authorizationInput
          )
        );

        return normalizeAuthorization(
          decision,
          characterId,
          action,
          check()
        );
      }


      /*
       * 1. AUTHENTICATE AGENT CONTEXT
       */

      const initial = await authorize();

      if (!initial) {
        return reject(
          "ai_authorization_denied"
        );
      }


      /*
       * 2. VERIFY PROCESSING CONSENT
       *
       * Consent provider is trusted
       * server-side infrastructure.
       */

      const consentContext = Object.freeze({
        accountId:
          initial.identity.accountId,

        characterId,

        providerId,
        model,

        purpose: "ai_inference"
      });

      const consent = await run(
        signal => getProcessingConsent(
          consentContext,
          { signal }
        )
      );

      if (consent !== true) {
        return reject(
          "ai_processing_consent_required"
        );
      }


      /*
       * 3. REAUTHORIZE BEFORE DISPATCH
       */

      const current = await authorize();

      if (!sameContext(initial, current)) {
        return reject(
          "ai_authorization_context_changed"
        );
      }


      /*
       * 4. MINIMAL PROVIDER REQUEST
       *
       * No account IDs.
       * No session tokens.
       * No wallet credentials.
       * No private memory records.
       *
       * The adapter must enforce these
       * limits before external dispatch.
       */

      const providerRequest = Object.freeze({
        providerId,
        model,

        characterId,
        action,

        message,

        maxInputTokens:
          LIMITS.maxInputTokens,

        maxOutputTokens:
          LIMITS.maxOutputTokens,

        maxOutputBytes:
          LIMITS.maxOutputBytes,

        toolsEnabled: false,
        store: false,
        trainingAllowed: false,
        streaming: false
      });


      /*
       * 5. EXECUTE PROVIDER
       */

      const rawResponse = await run(
        signal => {
          if (
            check() >= current.validUntil
          ) {
            throw AUTHORIZATION_EXPIRED;
          }

          return generate(
            providerRequest,
            { signal }
          );
        }
      );

      const response =
        normalizeProviderResponse(
          rawResponse
        );

      if (!response) {
        return reject(
          "invalid_ai_provider_response"
        );
      }


      /*
       * 6. RECHECK PROCESSING CONSENT
       */

      const remainingConsent = await run(
        signal => getProcessingConsent(
          consentContext,
          { signal }
        )
      );

      if (remainingConsent !== true) {
        return reject(
          "ai_processing_consent_changed"
        );
      }


      /*
       * 7. REAUTHORIZE BEFORE DISCLOSURE
       *
       * Discard the generated response
       * if the active agent, account,
       * session or subscription changed.
       */

      const finalAuthorization =
        await authorize();

      if (
        !sameContext(
          initial,
          finalAuthorization
        )
      ) {
        return reject(
          "ai_authorization_context_changed"
        );
      }

      const completedAt = check();

      if (
        completedAt >=
          finalAuthorization.validUntil
      ) {
        throw AUTHORIZATION_EXPIRED;
      }


      /*
       * 8. SAFE INFERENCE RESULT
       *
       * A completed response does not
       * authorize another operation.
       */

      return Object.freeze({
        ok: true,
        version: AI_GATEWAY_VERSION,

        identity:
          initial.identity,

        action,

        selectionRevision:
          initial.selectionRevision,

        providerId,
        model,

        text: response.text,

        usage: response.usage,

        startedAt:
          new Date(startedAt).toISOString(),

        completedAt:
          new Date(completedAt).toISOString(),

        inferenceCompleted: true,

        runtimeAuthorized: false,
        memoryAuthorized: false,
        learningAuthorized: false,
        tradingAuthorized: false,
        externalModelTrainingAuthorized: false,

        reason: null
      });

    } catch (error) {
      if (closed || error === CLOSED) {
        return reject(
          "ai_gateway_closed"
        );
      }

      if (error === TIMEOUT) {
        return reject(
          "ai_gateway_timeout"
        );
      }

      if (error === INVALID_CLOCK) {
        return reject(
          "invalid_ai_gateway_clock"
        );
      }

      if (error === AUTHORIZATION_EXPIRED) {
        return reject(
          "ai_authorization_expired"
        );
      }

      return reject(
        "ai_gateway_unavailable"
      );

    } finally {
      if (timer !== null) {
        clearTimeout(timer);
      }

      if (controller) {
        if (onAbort) {
          controller.signal.removeEventListener(
            "abort",
            onAbort
          );
        }

        activeControllers.delete(controller);

        controller.abort();
      }
    }
  }


  /*
   * SERVICE SHUTDOWN
   */

  function close() {
    if (closed) {
      return;
    }

    closed = true;

    for (const controller of activeControllers) {
      controller.abort();
    }
  }


  /*
   * INTERNAL SERVER INTERFACE
   */

  return Object.freeze({
    version: AI_GATEWAY_VERSION,

    execute,
    close,

    getActions() {
      return ACTIONS;
    },

    getLimits() {
      return LIMITS;
    },

    getPolicy() {
      return Object.freeze({
        ...POLICY,

        enabled,

        providerConfigured: Boolean(
          generate &&
          providerId &&
          model
        ),

        consentProviderConfigured:
          Boolean(getProcessingConsent)
      });
    }
  });
}

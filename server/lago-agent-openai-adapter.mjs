import { performance } from "node:perf_hooks";

import {
  validCharacterId
} from "./lago-agent-memory-contract.mjs";

/*
 * LAGO GAME
 * R2.8C2 — OPENAI PROVIDER ADAPTER
 *
 * Server-only Responses API integration.
 * Input token counting before generation.
 * Fixed HTTPS endpoints.
 * Bounded response reading.
 * Explicit model configuration.
 *
 * Disabled by default.
 * No external tools.
 * No automatic retries.
 * No streaming.
 * No trading execution.
 */

export const OPENAI_ADAPTER_VERSION = 1;

const PROVIDER_ID = "openai";

const ENDPOINTS = Object.freeze({
  count:
    "https://api.openai.com/v1/responses/input_tokens",

  generate:
    "https://api.openai.com/v1/responses"
});

const LIMITS = Object.freeze({
  timeoutMs: 25000,
  maxInputBytes: 8192,
  maxOutputBytes: 16384,
  maxInputTokens: 4096,
  maxOutputTokens: 1024,
  maxResponseBytes: 262144
});

const ACTIONS = Object.freeze([
  "chat",
  "market_analysis"
]);

const REQUEST_FIELDS = Object.freeze([
  "providerId",
  "model",
  "characterId",
  "action",
  "message",
  "maxInputTokens",
  "maxOutputTokens",
  "maxOutputBytes",
  "toolsEnabled",
  "store",
  "trainingAllowed",
  "streaming"
]);

const POLICY = Object.freeze({
  serverOnly: true,
  disabledByDefault: true,
  fixedEndpoint: true,
  httpsRequired: true,
  redirectsAllowed: false,
  serverModelConfigurationRequired: true,
  clientModelSelectionAllowed: false,
  inputTokenCountingRequired: true,
  responseStorageRequested: false,
  externalToolsEnabled: false,
  streamingEnabled: false,
  automaticRetriesEnabled: false,
  rawProviderErrorsExposed: false,
  tradingAuthorized: false,
  failClosed: true
});


/*
 * SAFE INTERNAL ERRORS
 */

class AdapterError extends Error {
  constructor(code) {
    super(code);

    this.name = "LagoOpenAIAdapterError";
  }
}

function fail(code) {
  throw new AdapterError(code);
}


/*
 * VALIDATION
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
  if (!plainObject(value)) {
    return false;
  }

  const keys = Reflect.ownKeys(value);

  if (keys.length !== fields.length) {
    return false;
  }

  return fields.every(field => {
    const descriptor =
      Object.getOwnPropertyDescriptor(
        value,
        field
      );

    return Boolean(
      descriptor &&
      Object.hasOwn(descriptor, "value")
    );
  });
}

function validModel(value) {
  return (
    typeof value === "string" &&
    /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/
      .test(value)
  );
}

function validAPIKey(value) {
  return (
    typeof value === "string" &&
    /^[\x21-\x7E]{1,512}$/.test(value)
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

function validLimit(value, maximum) {
  return (
    Number.isSafeInteger(value) &&
    value >= 1 &&
    value <= maximum
  );
}


/*
 * BASE INSTRUCTIONS
 *
 * Full character personality and memory
 * will be assembled by the personal
 * agent runtime in later stages.
 */

function createInstructions(characterId, action) {
  const common = [
    "You are a fictional personal AI agent in LAGO GAME.",
    "Your character identifier is " + characterId + ".",
    "Respond in the language of the user.",
    "Do not claim to have access to private accounts or wallets.",
    "Do not request authentication secrets or wallet recovery phrases.",
    "You cannot execute transactions, trades or external tools.",
    "Never claim that a transaction or trade has been executed.",
    "Do not guarantee investment returns.",
    "Distinguish verified facts from assumptions."
  ];

  if (action === "market_analysis") {
    common.push(
      "Provide educational market analysis.",
      "You have no live market data in this request.",
      "Do not invent current market prices or events.",
      "Explain material uncertainty and financial risks."
    );
  }

  return common.join("\n");
}


/*
 * BOUNDED JSON RESPONSE READER
 */

async function readBoundedJSON(response, check) {
  if (
    !response ||
    response.ok !== true ||
    response.status !== 200 ||
    response.redirected === true
  ) {
    fail("openai_http_error");
  }

  const contentType =
    response.headers.get("content-type");

  if (
    typeof contentType !== "string" ||
    contentType
      .split(";")[0]
      .trim()
      .toLowerCase() !== "application/json"
  ) {
    fail("openai_invalid_content_type");
  }

  const declaredLength =
    response.headers.get("content-length");

  if (declaredLength !== null) {
    if (!/^[0-9]+$/.test(declaredLength)) {
      fail("openai_invalid_content_length");
    }

    const size = Number(declaredLength);

    if (
      !Number.isSafeInteger(size) ||
      size > LIMITS.maxResponseBytes
    ) {
      fail("openai_response_too_large");
    }
  }

  if (
    !response.body ||
    typeof response.body.getReader !== "function"
  ) {
    fail("openai_response_body_unavailable");
  }

  const reader = response.body.getReader();

  const chunks = [];

  let total = 0;
  let complete = false;

  try {
    while (true) {
      check();

      const { done, value } =
        await reader.read();

      check();

      if (done) {
        complete = true;

        break;
      }

      if (!(value instanceof Uint8Array)) {
        fail("openai_invalid_response_chunk");
      }

      total += value.byteLength;

      if (total > LIMITS.maxResponseBytes) {
        fail("openai_response_too_large");
      }

      chunks.push(Buffer.from(value));
    }

    if (total === 0) {
      fail("openai_empty_response");
    }

    let parsed;

    try {
      const bytes = Buffer.concat(
        chunks,
        total
      );

      const text = new TextDecoder(
        "utf-8",
        { fatal: true }
      ).decode(bytes);

      parsed = JSON.parse(text);

    } catch {
      fail("openai_invalid_json");
    }

    if (!plainObject(parsed)) {
      fail("openai_invalid_json");
    }

    return parsed;

  } finally {
    if (!complete) {
      try {
        reader.cancel().catch(() => {});
      } catch {
        // Do not expose transport errors.
      }
    }

    reader.releaseLock();
  }
}


/*
 * INPUT TOKEN COUNT VALIDATION
 */

function normalizeTokenCount(
  result,
  maxInputTokens
) {
  if (
    result?.object !== "response.input_tokens" ||
    !Number.isSafeInteger(result.input_tokens) ||
    result.input_tokens < 1
  ) {
    fail("openai_invalid_token_count");
  }

  if (result.input_tokens > maxInputTokens) {
    fail("openai_input_token_limit_exceeded");
  }

  return result.input_tokens;
}


/*
 * RESPONSES API OUTPUT VALIDATION
 */

function normalizeResponse(
  response,
  request,
  expectedModel
) {
  if (
    response?.object !== "response" ||
    response.status !== "completed" ||
    response.model !== expectedModel ||
    response.error != null ||
    response.incomplete_details != null ||
    response.store !== false ||
    !Array.isArray(response.output) ||
    !Array.isArray(response.tools) ||
    response.tools.length !== 0
  ) {
    fail("openai_invalid_generation_response");
  }

  const parts = [];

  let outputBytes = 0;

  for (const item of response.output) {
    if (!plainObject(item)) {
      fail("openai_invalid_output_item");
    }

    /*
     * Reasoning metadata is not returned
     * to the player.
     */

    if (item.type === "reasoning") {
      continue;
    }

    if (
      item.type !== "message" ||
      item.role !== "assistant" ||
      item.status !== "completed" ||
      !Array.isArray(item.content)
    ) {
      fail("openai_unsupported_output_item");
    }

    for (const content of item.content) {
      if (
        !plainObject(content) ||
        content.type !== "output_text" ||
        typeof content.text !== "string"
      ) {
        fail("openai_unsupported_output_content");
      }

      const bytes = Buffer.byteLength(
        content.text,
        "utf8"
      );

      outputBytes += bytes;

      if (outputBytes > request.maxOutputBytes) {
        fail("openai_output_byte_limit_exceeded");
      }

      parts.push(content.text);
    }
  }

  const text = parts.join("");

  if (
    !validText(
      text,
      request.maxOutputBytes
    )
  ) {
    fail("openai_empty_text_output");
  }

  const usage = response.usage;

  if (
    !plainObject(usage) ||
    !validLimit(
      usage.input_tokens,
      request.maxInputTokens
    ) ||
    !validLimit(
      usage.output_tokens,
      request.maxOutputTokens
    ) ||
    usage.total_tokens !==
      usage.input_tokens + usage.output_tokens
  ) {
    fail("openai_invalid_token_usage");
  }

  return Object.freeze({
    text,

    usage: Object.freeze({
      inputTokens:
        usage.input_tokens,

      outputTokens:
        usage.output_tokens
    }),

    finishReason: "stop"
  });
}


/*
 * OPENAI ADAPTER FACTORY
 */

export function createLagoOpenAIAdapter({
  apiKey = null,
  model = null,
  enabled = false,
  requireGenerationAuthorization = false,
  fetchImpl = globalThis.fetch
} = {}) {
  if (
  typeof enabled !== "boolean" ||
  typeof requireGenerationAuthorization !== "boolean"
) {
    throw new Error(
      "invalid_openai_adapter_configuration"
    );
  }

  if (typeof fetchImpl !== "function") {
    throw new Error(
      "openai_fetch_required"
    );
  }

  if (
    apiKey !== null &&
    !validAPIKey(apiKey)
  ) {
    throw new Error(
      "invalid_openai_api_key"
    );
  }

  if (
    model !== null &&
    !validModel(model)
  ) {
    throw new Error(
      "invalid_openai_model"
    );
  }

  if (
    enabled &&
    (!apiKey || !model)
  ) {
    throw new Error(
      "openai_configuration_required"
    );
  }

  let closed = false;

  let secret = apiKey;

  const controllers = new Set();


  /*
   * SINGLE PROVIDER INFERENCE
   */

  async function generate(
    request,
    options = {}
  ) {
    if (closed) {
      fail("openai_adapter_closed");
    }

    if (!enabled) {
      fail("openai_adapter_disabled");
    }

    let controller = null;
    let timer = null;
    let externalSignal = null;
    let abortListener = null;
    let cancellationListener = null;

    try {
      if (
        !exactFields(
          request,
          REQUEST_FIELDS
        )
      ) {
        fail("invalid_openai_request");
      }

      if (
        request.providerId !== PROVIDER_ID ||
        request.model !== model ||
        !validCharacterId(request.characterId) ||
        !ACTIONS.includes(request.action) ||
        !validText(
          request.message,
          LIMITS.maxInputBytes
        ) ||
        !validLimit(
          request.maxInputTokens,
          LIMITS.maxInputTokens
        ) ||
        !validLimit(
          request.maxOutputTokens,
          LIMITS.maxOutputTokens
        ) ||
        !validLimit(
          request.maxOutputBytes,
          LIMITS.maxOutputBytes
        ) ||
        request.toolsEnabled !== false ||
        request.store !== false ||
        request.trainingAllowed !== false ||
        request.streaming !== false
      ) {
        fail("invalid_openai_request");
      }

      /*
 * R2.8C3 — PRE-GENERATION AUTHORIZATION
 *
 * Trusted internal server callback.
 * Never obtained from client input.
 */

const beforeGeneration =
  options?.beforeGeneration;

if (
  beforeGeneration !== undefined &&
  typeof beforeGeneration !== "function"
) {
  fail(
    "invalid_openai_generation_authorizer"
  );
}

if (
  requireGenerationAuthorization &&
  typeof beforeGeneration !== "function"
) {
  fail(
    "openai_generation_authorization_required"
  );
}

      externalSignal = options?.signal;

      if (
        !(externalSignal instanceof AbortSignal)
      ) {
        fail("openai_abort_signal_required");
      }

      if (externalSignal.aborted) {
        fail("openai_request_cancelled");
      }

      /*
       * Snapshot trusted request fields
       * before asynchronous operations.
       */

      const input = Object.freeze({
        ...request
      });

      const startedAt = performance.now();

      controller = new AbortController();

      const signal = controller.signal;

      controllers.add(controller);

      abortListener = () => controller.abort();

      externalSignal.addEventListener(
        "abort",
        abortListener,
        { once: true }
      );

      if (externalSignal.aborted) {
        controller.abort();
      }

      timer = setTimeout(
        () => controller.abort(),
        LIMITS.timeoutMs
      );

      function check() {
        if (closed) {
          fail("openai_adapter_closed");
        }

        if (externalSignal.aborted) {
          fail("openai_request_cancelled");
        }

        if (
          signal.aborted ||
          performance.now() - startedAt >=
            LIMITS.timeoutMs
        ) {
          controller.abort();

          fail("openai_request_timeout");
        }
      }

      const cancelled = new Promise((_, reject) => {
        cancellationListener = () => {
          reject(
            new AdapterError(
              closed
                ? "openai_adapter_closed"
                : externalSignal.aborted
                  ? "openai_request_cancelled"
                  : "openai_request_timeout"
            )
          );
        };

        signal.addEventListener(
          "abort",
          cancellationListener,
          { once: true }
        );
      });

      /*
       * Only predefined server endpoints
       * can receive the API credential.
       */

      async function post(endpoint, body) {
        check();

        const operation = (async () => {
          const response = await fetchImpl(
            endpoint,
            {
              method: "POST",

              headers: {
                "Authorization":
                  "Bearer " + secret,

                "Content-Type":
                  "application/json",

                "Accept":
                  "application/json"
              },

              body: JSON.stringify(body),

              redirect: "error",
              cache: "no-store",

              signal
            }
          );

          check();

          if (
            response.url &&
            response.url !== endpoint
          ) {
            fail("openai_unexpected_response_url");
          }

          return readBoundedJSON(
            response,
            check
          );
        })();

        const result = await Promise.race([
          operation,
          cancelled
        ]);

        check();

        return result;
      }

      /*
       * Identical model context for token
       * counting and inference.
       */

      const context = {
        model,

        instructions: createInstructions(
          input.characterId,
          input.action
        ),

        input: [
          {
            role: "user",

            content: [
              {
                type: "input_text",
                text: input.message
              }
            ]
          }
        ],

        tools: [],
        tool_choice: "none",
        truncation: "disabled"
      };


      /*
       * 1. COUNT INPUT TOKENS
       */

      const countResponse = await post(
        ENDPOINTS.count,
        context
      );

      const inputTokens = normalizeTokenCount(
  countResponse,
  input.maxInputTokens
);

check();


/*
 * R2.8C3 — GENERATION AUTHORIZATION BARRIER
 *
 * Token counting is complete.
 * Actual inference must not start until
 * the trusted server confirms access.
 *
 * The authorization callback shares
 * the adapter cancellation deadline.
 */

if (beforeGeneration) {
  const authorizationContext =
    Object.freeze({
      providerId: PROVIDER_ID,
      model,

      characterId:
        input.characterId,

      action:
        input.action,

      inputTokens,

      maxOutputTokens:
        input.maxOutputTokens
    });

  const authorizationTask =
    Promise.resolve().then(() => {
      check();

      return beforeGeneration(
        authorizationContext,
        { signal }
      );
    });

  const authorized =
    await Promise.race([
      authorizationTask,
      cancelled
    ]);

  check();

  if (authorized !== true) {
    fail(
      "openai_generation_authorization_denied"
    );
  }
}

check();

      /*
       * 2. REQUEST MODEL INFERENCE
       */

      const response = await post(
        ENDPOINTS.generate,
        {
          ...context,

          store: false,
          stream: false,
          background: false,

          max_output_tokens:
            input.maxOutputTokens
        }
      );

      check();


      /*
       * 3. VALIDATE PROVIDER OUTPUT
       */

      const result = normalizeResponse(
        response,
        input,
        model
      );

      check();

      return result;

    } catch (error) {
      if (closed) {
        fail("openai_adapter_closed");
      }

      if (error instanceof AdapterError) {
        throw error;
      }

      if (externalSignal?.aborted) {
        fail("openai_request_cancelled");
      }

      if (controller?.signal.aborted) {
        fail("openai_request_timeout");
      }

      /*
       * Never expose raw provider errors,
       * request headers or credentials.
       */

      fail("openai_request_failed");

    } finally {
      if (timer !== null) {
        clearTimeout(timer);
      }

      if (
        externalSignal &&
        abortListener
      ) {
        externalSignal.removeEventListener(
          "abort",
          abortListener
        );
      }

      if (controller) {
        if (cancellationListener) {
          controller.signal.removeEventListener(
            "abort",
            cancellationListener
          );
        }

        controllers.delete(controller);

        controller.abort();
      }
    }
  }


  /*
   * ADAPTER SHUTDOWN
   */

  function close() {
    if (closed) {
      return;
    }

    closed = true;

    for (const controller of controllers) {
      controller.abort();
    }

    secret = null;
  }


  /*
   * IMMUTABLE SERVER INTERFACE
   */

  return Object.freeze({
    version: OPENAI_ADAPTER_VERSION,

    providerId: PROVIDER_ID,

    model,

    generate,

    close,

    getLimits() {
      return LIMITS;
    },

    getPolicy() {
      return Object.freeze({
        ...POLICY,

enabled,

generationAuthorizationSupported: true,

generationAuthorizationRequired:
  requireGenerationAuthorization,

generationAuthorizationAfterTokenCount: true,

generationAuthorizationSharesDeadline: true,

clientGenerationAuthorizationTrusted: false,

        configured: Boolean(
          secret && model
        ),

        closed
      });
    }
  });
}

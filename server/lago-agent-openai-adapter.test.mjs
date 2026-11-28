import test from "node:test";
import assert from "node:assert/strict";

import {
  OPENAI_ADAPTER_VERSION,
  createLagoOpenAIAdapter
} from "./lago-agent-openai-adapter.mjs";

/*
 * LAGO GAME
 * R2.8C2A — OPENAI ADAPTER SECURITY TESTS
 *
 * Synthetic HTTP transport.
 * Real Response and ReadableStream objects.
 * No network access.
 * No real API credentials.
 * No billable inference.
 */

const KEY = "synthetic-test-key";
const MODEL = "synthetic-model-v1";

const COUNT_URL =
  "https://api.openai.com/v1/responses/input_tokens";

const GENERATE_URL =
  "https://api.openai.com/v1/responses";

const MESSAGE = "Analyze the market context.";

function request(changes = {}) {
  return {
    providerId: "openai",
    model: MODEL,
    characterId: "lago",
    action: "chat",
    message: MESSAGE,

    maxInputTokens: 4096,
    maxOutputTokens: 1024,
    maxOutputBytes: 16384,

    toolsEnabled: false,
    store: false,
    trainingAllowed: false,
    streaming: false,

    ...changes
  };
}

function tokenCount(inputTokens = 24) {
  return {
    object: "response.input_tokens",
    input_tokens: inputTokens
  };
}

function generation(changes = {}) {
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
            text: "Synthetic agent response.",
            annotations: []
          }
        ]
      }
    ],

    usage: {
      input_tokens: 24,
      output_tokens: 8,
      total_tokens: 32
    },

    ...changes
  };
}

function json(value, options = {}) {
  return new Response(
    JSON.stringify(value),
    {
      status: 200,

      ...options,

      headers: {
        "content-type": "application/json",

        ...options.headers
      }
    }
  );
}

function deferred() {
  let resolve;
  let reject;

  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });

  return {
    promise,
    resolve,
    reject
  };
}

function fixture(t, changes = {}) {
  const calls = [];

  const controller = new AbortController();

  const adapter = createLagoOpenAIAdapter({
    apiKey: KEY,
    model: MODEL,
    enabled: true,

    async fetchImpl(url, options) {
      calls.push({
        url,
        options,
        body: JSON.parse(options.body)
      });

      if (url === COUNT_URL) {
        return json(tokenCount());
      }

      if (url === GENERATE_URL) {
        return json(generation());
      }

      throw new Error(
        "unexpected_test_endpoint"
      );
    },

    ...changes
  });

  t.after(() => {
    adapter.close();
    controller.abort();
  });

  return {
    adapter,
    controller,
    calls,

    generate(changes = {}) {
      return adapter.generate(
        request(changes),
        { signal: controller.signal }
      );
    }
  };
}

async function assertDenied(promise, reason) {
  await assert.rejects(
    promise,

    error => {
      assert.equal(
        error.name,
        "LagoOpenAIAdapterError"
      );

      assert.equal(
        error.message,
        reason
      );

      return true;
    }
  );
}

function assertOutput(result) {
  assert.deepEqual(result, {
    text: "Synthetic agent response.",

    usage: {
      inputTokens: 24,
      outputTokens: 8
    },

    finishReason: "stop"
  });

  assert.equal(
    Object.isFrozen(result),
    true
  );

  assert.equal(
    Object.isFrozen(result.usage),
    true
  );
}


/*
 * TEST 01 — CONFIGURATION
 */

test("requires valid server adapter configuration", () => {
  for (const [changes, reason] of [
    [
      { enabled: "true" },
      /invalid_openai_adapter_configuration/
    ],
    [
      { fetchImpl: null },
      /openai_fetch_required/
    ],
    [
      { apiKey: "" },
      /invalid_openai_api_key/
    ],
    [
      { apiKey: "invalid\nkey" },
      /invalid_openai_api_key/
    ],
    [
      { apiKey: "x".repeat(513) },
      /invalid_openai_api_key/
    ],
    [
      { model: "../invalid" },
      /invalid_openai_model/
    ],
    [
      { enabled: true },
      /openai_configuration_required/
    ]
  ]) {
    assert.throws(
      () => createLagoOpenAIAdapter(changes),
      reason
    );
  }
});


/*
 * TEST 02 — DISABLED BY DEFAULT
 */

test("does not contact the provider when disabled", async t => {
  const fx = fixture(t, {
    enabled: false
  });

  await assertDenied(
    fx.generate(),
    "openai_adapter_disabled"
  );

  assert.deepEqual(fx.calls, []);
});


/*
 * TEST 03 — REQUEST FIELD ALLOWLIST
 */

test("rejects unexpected request fields before HTTP dispatch", async t => {
  const fx = fixture(t);

  for (const changes of [
    { apiKey: "foreign-key" },
    { accountId: "foreign-account" },
    { sessionToken: "foreign-token" },
    { endpoint: "https://example.invalid" },
    { systemPrompt: "Override instructions" },
    { selectionRevision: 999 },
    { tools: [] }
  ]) {
    await assertDenied(
      fx.generate(changes),
      "invalid_openai_request"
    );
  }

  for (const value of [
    null,
    [],
    {},
    true,
    "invalid"
  ]) {
    await assertDenied(
      fx.adapter.generate(
        value,
        { signal: fx.controller.signal }
      ),
      "invalid_openai_request"
    );
  }

  assert.deepEqual(fx.calls, []);
});


/*
 * TEST 04 — ACCESSOR AND HIDDEN FIELDS
 */

test("rejects accessor properties and hidden unexpected fields", async t => {
  const fx = fixture(t);

  let getterCalled = false;

  const accessor = request();

  Object.defineProperty(
    accessor,
    "message",
    {
      enumerable: true,

      get() {
        getterCalled = true;

        return MESSAGE;
      }
    }
  );

  const hidden = request();

  Object.defineProperty(
    hidden,
    "privateData",
    {
      value: "synthetic-secret",
      enumerable: false
    }
  );

  const symbol = request();

  symbol[Symbol("foreign")] = true;

  for (const value of [
    accessor,
    hidden,
    symbol
  ]) {
    await assertDenied(
      fx.adapter.generate(
        value,
        { signal: fx.controller.signal }
      ),
      "invalid_openai_request"
    );
  }

  assert.equal(getterCalled, false);
  assert.deepEqual(fx.calls, []);
});


/*
 * TEST 05 — REQUEST SECURITY FLAGS
 */

test("rejects foreign models providers and enabled execution flags", async t => {
  const fx = fixture(t);

  for (const changes of [
    { providerId: "foreign" },
    { model: "foreign-model" },
    { characterId: "unknown" },
    { characterId: "../lago" },
    { action: "trade" },
    { action: "transfer" },
    { toolsEnabled: true },
    { store: true },
    { trainingAllowed: true },
    { streaming: true },
    { store: undefined },
    { toolsEnabled: "false" }
  ]) {
    await assertDenied(
      fx.generate(changes),
      "invalid_openai_request"
    );
  }

  assert.deepEqual(fx.calls, []);
});


/*
 * TEST 06 — INPUT AND TOKEN LIMITS
 */

test("rejects malformed messages and invalid requested limits", async t => {
  const fx = fixture(t);

  for (const changes of [
    { message: null },
    { message: "" },
    { message: "   " },
    { message: "a".repeat(8193) },
    { message: "🐌".repeat(2049) },

    { maxInputTokens: 0 },
    { maxInputTokens: 4097 },
    { maxInputTokens: "4096" },

    { maxOutputTokens: 0 },
    { maxOutputTokens: 1025 },
    { maxOutputTokens: 1.5 },

    { maxOutputBytes: 0 },
    { maxOutputBytes: 16385 },
    { maxOutputBytes: Infinity }
  ]) {
    await assertDenied(
      fx.generate(changes),
      "invalid_openai_request"
    );
  }

  assert.deepEqual(fx.calls, []);
});


/*
 * TEST 07 — REQUIRED ABORT SIGNAL
 */

test("requires an actual non-aborted cancellation signal", async t => {
  const fx = fixture(t);

  await assertDenied(
    fx.adapter.generate(request()),
    "openai_abort_signal_required"
  );

  await assertDenied(
    fx.adapter.generate(
      request(),
      { signal: {} }
    ),
    "openai_abort_signal_required"
  );

  fx.controller.abort();

  await assertDenied(
    fx.generate(),
    "openai_request_cancelled"
  );

  assert.deepEqual(fx.calls, []);
});


/*
 * TEST 08 — TRANSPORT CONTRACT
 */

test("uses fixed HTTPS endpoints and identical preflight context", async t => {
  const fx = fixture(t);

  assertOutput(
    await fx.generate()
  );

  assert.equal(fx.calls.length, 2);

  const [count, generate] = fx.calls;

  assert.equal(count.url, COUNT_URL);
  assert.equal(generate.url, GENERATE_URL);

  for (const call of fx.calls) {
    assert.equal(call.options.method, "POST");

    assert.equal(
      call.options.headers.Authorization,
      "Bearer " + KEY
    );

    assert.equal(
      call.options.headers["Content-Type"],
      "application/json"
    );

    assert.equal(
      call.options.headers.Accept,
      "application/json"
    );

    assert.equal(call.options.redirect, "error");
    assert.equal(call.options.cache, "no-store");

    assert.ok(
      call.options.signal instanceof AbortSignal
    );

    assert.equal(
      JSON.stringify(call.body).includes(KEY),
      false
    );
  }

  assert.equal(
    count.options.signal,
    generate.options.signal
  );

  assert.deepEqual(generate.body, {
    ...count.body,

    store: false,
    stream: false,
    background: false,

    max_output_tokens: 1024
  });

  assert.equal(count.body.model, MODEL);

  assert.deepEqual(count.body.tools, []);

  assert.equal(count.body.tool_choice, "none");
  assert.equal(count.body.truncation, "disabled");

  assert.deepEqual(count.body.input, [
    {
      role: "user",

      content: [
        {
          type: "input_text",
          text: MESSAGE
        }
      ]
    }
  ]);

  assert.equal(
    generate.options.signal.aborted,
    true
  );
});


/*
 * TEST 09 — MARKET ANALYSIS INSTRUCTIONS
 */

test("adds market risk instructions without claiming live market access", async t => {
  const fx = fixture(t);

  assertOutput(
    await fx.generate({
      characterId: "comic_pink_snail",
      action: "market_analysis"
    })
  );

  const instructions =
    fx.calls[0].body.instructions;

  assert.match(
    instructions,
    /comic_pink_snail/
  );

  assert.match(
    instructions,
    /no live market data/i
  );

  assert.match(
    instructions,
    /financial risks/i
  );

  assert.match(
    instructions,
    /cannot execute transactions/i
  );
});


/*
 * TEST 10 — INPUT TOKEN PREFLIGHT
 */

test("blocks inference when input tokens exceed the requested budget", async t => {
  let calls = 0;

  const fx = fixture(t, {
    async fetchImpl(url) {
      calls++;

      assert.equal(url, COUNT_URL);

      return json(tokenCount(4097));
    }
  });

  await assertDenied(
    fx.generate(),
    "openai_input_token_limit_exceeded"
  );

  assert.equal(calls, 1);
});


/*
 * TEST 11 — INVALID TOKEN COUNT
 */

test("rejects malformed token counting responses", async t => {
  for (const value of [
    {},
    { input_tokens: 24 },
    tokenCount(0),
    tokenCount(-1),
    tokenCount(1.5),
    tokenCount("24"),
    tokenCount(null),

    {
      object: "foreign",
      input_tokens: 24
    }
  ]) {
    let calls = 0;

    const fx = fixture(t, {
      async fetchImpl() {
        calls++;

        return json(value);
      }
    });

    await assertDenied(
      fx.generate(),
      "openai_invalid_token_count"
    );

    assert.equal(calls, 1);
  }
});


/*
 * TEST 12 — HTTP ERRORS
 */

test("rejects unsuccessful HTTP responses without retries", async t => {
  for (const status of [
    201,
    301,
    400,
    401,
    403,
    429,
    500,
    503
  ]) {
    let calls = 0;

    const fx = fixture(t, {
      async fetchImpl() {
        calls++;

        return json(
          { error: "private-provider-error" },
          { status }
        );
      }
    });

    await assertDenied(
      fx.generate(),
      "openai_http_error"
    );

    assert.equal(calls, 1);
  }
});


/*
 * TEST 13 — REDIRECT PROTECTION
 */

test("rejects redirected and unexpected response URLs", async t => {
  const redirected = fixture(t, {
    async fetchImpl() {
      const response = json(tokenCount());

      Object.defineProperty(
        response,
        "redirected",
        { value: true }
      );

      return response;
    }
  });

  await assertDenied(
    redirected.generate(),
    "openai_http_error"
  );

  const foreign = fixture(t, {
    async fetchImpl() {
      const response = json(tokenCount());

      Object.defineProperty(
        response,
        "url",
        {
          value: "https://example.invalid"
        }
      );

      return response;
    }
  });

  await assertDenied(
    foreign.generate(),
    "openai_unexpected_response_url"
  );
});


/*
 * TEST 14 — CONTENT TYPE
 */

test("rejects non-JSON response content types", async t => {
  for (const contentType of [
    "text/html",
    "text/plain",
    "application/octet-stream"
  ]) {
    const fx = fixture(t, {
      async fetchImpl() {
        return new Response("invalid", {
          headers: {
            "content-type": contentType
          }
        });
      }
    });

    await assertDenied(
      fx.generate(),
      "openai_invalid_content_type"
    );
  }
});


/*
 * TEST 15 — DECLARED CONTENT LENGTH
 */

test("rejects oversized and invalid declared content lengths", async t => {
  for (const [length, reason] of [
    [
      "262145",
      "openai_response_too_large"
    ],
    [
      "999999999999999999999",
      "openai_response_too_large"
    ],
    [
      "-1",
      "openai_invalid_content_length"
    ],
    [
      "invalid",
      "openai_invalid_content_length"
    ]
  ]) {
    const fx = fixture(t, {
      async fetchImpl() {
        return json(tokenCount(), {
          headers: {
            "content-length": length
          }
        });
      }
    });

    await assertDenied(
      fx.generate(),
      reason
    );
  }
});


/*
 * TEST 16 — STREAMING BODY LIMIT
 */

test("bounds response bytes independently of content length", async t => {
  let cancelled = false;

  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(
        new Uint8Array(131072)
      );

      controller.enqueue(
        new Uint8Array(131073)
      );
    },

    cancel() {
      cancelled = true;
    }
  });

  const fx = fixture(t, {
    async fetchImpl() {
      return new Response(stream, {
        headers: {
          "content-type": "application/json"
        }
      });
    }
  });

  await assertDenied(
    fx.generate(),
    "openai_response_too_large"
  );

  assert.equal(cancelled, true);
});


/*
 * TEST 17 — JSON AND UTF8 VALIDATION
 */

test("rejects invalid JSON invalid UTF8 and non-object response data", async t => {
  for (const body of [
    "{",
    "not-json",
    "null",
    "[]",
    "\"string\"",

    new Uint8Array([
      0x7b,
      0xff,
      0x7d
    ])
  ]) {
    const fx = fixture(t, {
      async fetchImpl() {
        return new Response(body, {
          headers: {
            "content-type": "application/json"
          }
        });
      }
    });

    await assertDenied(
      fx.generate(),
      "openai_invalid_json"
    );
  }
});


/*
 * TEST 18 — EMPTY RESPONSE
 */

test("rejects missing and empty provider response bodies", async t => {
  const missing = fixture(t, {
    async fetchImpl() {
      return new Response(null, {
        headers: {
          "content-type": "application/json"
        }
      });
    }
  });

  await assertDenied(
    missing.generate(),
    "openai_response_body_unavailable"
  );

  const empty = fixture(t, {
    async fetchImpl() {
      return new Response("", {
        headers: {
          "content-type": "application/json"
        }
      });
    }
  });

  await assertDenied(
    empty.generate(),
    "openai_empty_response"
  );
});


/*
 * TEST 19 — GENERATION RESPONSE CONTRACT
 */

test("rejects incomplete failed and inconsistent generation responses", async t => {
  for (const changes of [
    { object: "foreign" },
    { status: "incomplete" },
    { status: "failed" },
    { model: "foreign-model" },
    { error: { message: "failure" } },
    { incomplete_details: { reason: "limit" } },
    { store: true },
    { store: undefined },
    { output: null },
    { tools: null },
    { tools: [{ type: "function" }] }
  ]) {
    const fx = fixture(t, {
      async fetchImpl(url) {
        return url === COUNT_URL
          ? json(tokenCount())
          : json(generation(changes));
      }
    });

    await assertDenied(
      fx.generate(),
      "openai_invalid_generation_response"
    );
  }
});


/*
 * TEST 20 — UNSUPPORTED OUTPUT ITEMS
 */

test("rejects tool execution and unsupported output message types", async t => {
  for (const item of [
    { type: "function_call" },
    { type: "computer_call" },
    { type: "web_search_call" },

    {
      type: "message",
      role: "user",
      status: "completed",
      content: []
    },

    {
      type: "message",
      role: "assistant",
      status: "incomplete",
      content: []
    }
  ]) {
    const fx = fixture(t, {
      async fetchImpl(url) {
        return url === COUNT_URL
          ? json(tokenCount())
          : json(generation({
              output: [item]
            }));
      }
    });

    await assertDenied(
      fx.generate(),
      "openai_unsupported_output_item"
    );
  }
});


/*
 * TEST 21 — UNSUPPORTED CONTENT
 */

test("rejects refusals and non-text output content", async t => {
  for (const content of [
    { type: "refusal", refusal: "Refused" },
    { type: "output_image" },
    { type: "output_text", text: null },
    { type: "output_text", text: {} }
  ]) {
    const fx = fixture(t, {
      async fetchImpl(url) {
        return url === COUNT_URL
          ? json(tokenCount())
          : json(generation({
              output: [
                {
                  type: "message",
                  role: "assistant",
                  status: "completed",
                  content: [content]
                }
              ]
            }));
      }
    });

    await assertDenied(
      fx.generate(),
      "openai_unsupported_output_content"
    );
  }
});


/*
 * TEST 22 — OUTPUT BYTE LIMITS
 */

test("rejects oversized output and accepts exact UTF8 boundaries", async t => {
  const makeOutput = text => generation({
    output: [
      {
        type: "message",
        role: "assistant",
        status: "completed",

        content: [
          {
            type: "output_text",
            text
          }
        ]
      }
    ]
  });

  const oversized = fixture(t, {
    async fetchImpl(url) {
      return url === COUNT_URL
        ? json(tokenCount())
        : json(makeOutput(
            "🐌".repeat(4097)
          ));
    }
  });

  await assertDenied(
    oversized.generate(),
    "openai_output_byte_limit_exceeded"
  );

  const exact = fixture(t, {
    async fetchImpl(url) {
      return url === COUNT_URL
        ? json(tokenCount())
        : json(makeOutput(
            "🐌".repeat(4096)
          ));
    }
  });

  const result = await exact.generate();

  assert.equal(
    Buffer.byteLength(result.text, "utf8"),
    16384
  );
});


/*
 * TEST 23 — TOKEN USAGE
 */

test("rejects invalid or excessive provider token usage", async t => {
  for (const usage of [
    null,

    {
      input_tokens: 4097,
      output_tokens: 8,
      total_tokens: 4105
    },

    {
      input_tokens: 24,
      output_tokens: 1025,
      total_tokens: 1049
    },

    {
      input_tokens: 24,
      output_tokens: 0,
      total_tokens: 24
    },

    {
      input_tokens: 24,
      output_tokens: 1.5,
      total_tokens: 25.5
    },

    {
      input_tokens: "24",
      output_tokens: 8,
      total_tokens: 32
    },

    {
      input_tokens: 24,
      output_tokens: 8,
      total_tokens: 999
    }
  ]) {
    const fx = fixture(t, {
      async fetchImpl(url) {
        return url === COUNT_URL
          ? json(tokenCount())
          : json(generation({ usage }));
      }
    });

    await assertDenied(
      fx.generate(),
      "openai_invalid_token_usage"
    );
  }
});


/*
 * TEST 24 — SAFE OUTPUT PROJECTION
 */

test("returns only normalized text usage and finish reason", async t => {
  const fx = fixture(t, {
    async fetchImpl(url) {
      if (url === COUNT_URL) {
        return json(tokenCount());
      }

      const response = generation();

      response.privateData =
        "SYNTHETIC_PRIVATE_DATA";

      response.output.unshift({
        type: "reasoning",

        summary: [
          {
            type: "summary_text",
            text: "SYNTHETIC_REASONING"
          }
        ]
      });

      return json(response);
    }
  });

  const result = await fx.generate();

  assertOutput(result);

  const serialized = JSON.stringify(result);

  assert.equal(
    serialized.includes("SYNTHETIC_PRIVATE_DATA"),
    false
  );

  assert.equal(
    serialized.includes("SYNTHETIC_REASONING"),
    false
  );
});


/*
 * TEST 25 — IMMUTABLE REQUEST SNAPSHOT
 */

test("preserves request context across asynchronous token counting", async t => {
  const entered = deferred();
  const pending = deferred();

  const bodies = [];

  const fx = fixture(t, {
    async fetchImpl(url, options) {
      bodies.push(
        JSON.parse(options.body)
      );

      if (url === COUNT_URL) {
        entered.resolve();

        return pending.promise;
      }

      return json(generation());
    }
  });

  const input = request();

  const execution = fx.adapter.generate(
    input,
    { signal: fx.controller.signal }
  );

  await entered.promise;

  input.message = "Changed message";
  input.model = "foreign-model";
  input.maxOutputTokens = 999999;
  input.toolsEnabled = true;

  pending.resolve(
    json(tokenCount())
  );

  assertOutput(await execution);

  assert.equal(bodies.length, 2);

  assert.deepEqual(
    bodies[1].input,
    bodies[0].input
  );

  assert.equal(bodies[1].model, MODEL);
  assert.equal(bodies[1].max_output_tokens, 1024);
  assert.deepEqual(bodies[1].tools, []);
});


/*
 * TEST 26 — CANCEL TOKEN COUNTING
 */

test("cancels stalled preflight and never starts generation", {
  timeout: 10000
}, async t => {
  const entered = deferred();
  const pending = deferred();

  let signal;
  let calls = 0;

  const fx = fixture(t, {
    fetchImpl(url, options) {
      calls++;

      signal = options.signal;

      entered.resolve();

      return pending.promise;
    }
  });

  const execution = fx.generate();

  await entered.promise;

  fx.controller.abort();

  await assertDenied(
    execution,
    "openai_request_cancelled"
  );

  assert.equal(signal.aborted, true);

  pending.resolve(
    json(tokenCount())
  );

  await new Promise(resolve =>
    setImmediate(resolve)
  );

  assert.equal(calls, 1);
});


/*
 * TEST 27 — CANCEL INFERENCE
 */

test("cancels stalled generation and ignores late responses", {
  timeout: 10000
}, async t => {
  const entered = deferred();
  const pending = deferred();

  let signal;
  let calls = 0;

  const fx = fixture(t, {
    async fetchImpl(url, options) {
      calls++;

      if (url === COUNT_URL) {
        return json(tokenCount());
      }

      signal = options.signal;

      entered.resolve();

      return pending.promise;
    }
  });

  const execution = fx.generate();

  await entered.promise;

  fx.controller.abort();

  await assertDenied(
    execution,
    "openai_request_cancelled"
  );

  assert.equal(signal.aborted, true);

  pending.resolve(
    json(generation())
  );

  await new Promise(resolve =>
    setImmediate(resolve)
  );

  assert.equal(calls, 2);
});


/*
 * TEST 28 — ADAPTER SHUTDOWN
 */

test("cancels all active requests and disables the closed adapter", {
  timeout: 10000
}, async t => {
  const entered = deferred();
  const pending = deferred();

  const signals = [];

  const fx = fixture(t, {
    fetchImpl(url, options) {
      signals.push(options.signal);

      if (signals.length === 2) {
        entered.resolve();
      }

      return pending.promise;
    }
  });

  const first = fx.generate();
  const second = fx.generate();

  const results = Promise.allSettled([
    first,
    second
  ]);

  await entered.promise;

  fx.adapter.close();
  fx.adapter.close();

  for (const result of await results) {
    assert.equal(result.status, "rejected");

    assert.equal(
      result.reason.message,
      "openai_adapter_closed"
    );
  }

  for (const signal of signals) {
    assert.equal(signal.aborted, true);
  }

  pending.resolve(json(tokenCount()));

  assert.equal(
    fx.adapter.getPolicy().configured,
    false
  );

  assert.equal(
    fx.adapter.getPolicy().closed,
    true
  );

  await assertDenied(
    fx.generate(),
    "openai_adapter_closed"
  );
});


/*
 * TEST 29 — ERROR SANITIZATION
 */

test("sanitizes transport failures without leaking credentials or retrying", async t => {
  let calls = 0;

  const fx = fixture(t, {
    async fetchImpl() {
      calls++;

      throw new Error(
        "PRIVATE_TRANSPORT_ERROR " + KEY
      );
    }
  });

  await assertDenied(
    fx.generate(),
    "openai_request_failed"
  );

  assert.equal(calls, 1);

  assert.equal(
    JSON.stringify(fx.adapter).includes(KEY),
    false
  );
});


/*
 * TEST 30 — IMMUTABLE POLICY
 */

test("publishes immutable server adapter limits and security policy", async t => {
  const fx = fixture(t);

  const policy = fx.adapter.getPolicy();
  const limits = fx.adapter.getLimits();

  assert.equal(
    fx.adapter.version,
    OPENAI_ADAPTER_VERSION
  );

  assert.equal(
    fx.adapter.providerId,
    "openai"
  );

  for (const field of [
    "serverOnly",
    "disabledByDefault",
    "fixedEndpoint",
    "httpsRequired",
    "serverModelConfigurationRequired",
    "inputTokenCountingRequired",
    "failClosed"
  ]) {
    assert.equal(
      policy[field],
      true,
      field
    );
  }

  for (const field of [
    "redirectsAllowed",
    "clientModelSelectionAllowed",
    "responseStorageRequested",
    "externalToolsEnabled",
    "streamingEnabled",
    "automaticRetriesEnabled",
    "rawProviderErrorsExposed",
    "tradingAuthorized"
  ]) {
    assert.equal(
      policy[field],
      false,
      field
    );
  }

  assert.deepEqual(limits, {
    timeoutMs: 25000,
    maxInputBytes: 8192,
    maxOutputBytes: 16384,
    maxInputTokens: 4096,
    maxOutputTokens: 1024,
    maxResponseBytes: 262144
  });

  assert.equal(policy.enabled, true);
  assert.equal(policy.configured, true);
  assert.equal(policy.closed, false);

  assert.equal(
    Object.isFrozen(fx.adapter),
    true
  );

  assert.equal(
    Object.isFrozen(policy),
    true
  );

  assert.equal(
    Object.isFrozen(limits),
    true
  );
});

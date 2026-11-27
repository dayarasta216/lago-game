import test from "node:test";
import { request as httpRequest } from "node:http";
import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  createLagoHttpServer
} from "./http-app.mjs";

/*
 * LAGO GAME
 * R2.7F3A — SUBSCRIPTION HTTP SECURITY TESTS
 *
 * Real local HTTP server.
 * Synthetic subscription services.
 * No external network requests.
 * No real payments.
 * No production credentials.
 */

const SESSION_TOKEN = "synthetic-session-token";

const ACCOUNT_ID =
  "lago_" + "A".repeat(22);

const QUOTE_ID = "a".repeat(32);

const SIGNATURE =
  "1".repeat(63) + "2";

const STATE_PATH =
  "/api/subscription/state";

const QUOTE_PATH =
  "/api/subscription/quote";

const CONFIRM_PATH =
  "/api/subscription/confirm";

const PAYMENT_BODY = Object.freeze({
  quoteId: QUOTE_ID,
  transactionSignature: SIGNATURE
});


/*
 * HTTP SERVER FIXTURE
 */

async function fixture(t, overrides = {}) {

  const root = await mkdtemp(
    join(tmpdir(), "lago-subscription-http-")
  );

  const calls = [];

  const controls = {
    failure: null,
    throwError: false,
    invalidQuote: false,
    invalidPayment: false
  };


  /*
   * SYNTHETIC AUTHENTICATION
   */

  function authenticate(input) {

    if (controls.throwError) {

      throw new Error(
        "SYNTHETIC_PRIVATE_SERVER_SECRET"
      );

    }

    if (input.sessionToken !== SESSION_TOKEN) {

      return {
        ok: false,
        reason: "authentication_required"
      };

    }

    if (controls.failure) {
      return controls.failure;
    }

    return null;

  }


  /*
   * SYNTHETIC SUBSCRIPTION SERVICES
   */

  const subscriptionServices = {

    entitlement: {

      async getState(input) {

        calls.push({
          operation: "state",
          input
        });

        const failure = authenticate(input);

        if (failure) {
          return failure;
        }

        return {

          ok: true,

          accountId: ACCOUNT_ID,

          product: "personal-ai-agent",

          status: "inactive",

          subscriptionStatus: "inactive",

          billingModel: "subscription",

          billingInterval: "month",

          billingIntervalCount: 1,

          currentPeriodStart: null,

          currentPeriodEnd: null,

          serverVerified: false,

          entitled: false,

          aiEnabled: false,

          tradingAuthorized: false

        };

      }

    },

    quoteStore: {

      async createQuote(input) {

        calls.push({
          operation: "quote",
          input
        });

        const failure = authenticate(input);

        if (failure) {
          return failure;
        }

        if (controls.invalidQuote) {
          return { ok: true };
        }

        return {

          ok: true,

          quoteStored: true,

          quote: {

            quoteId: QUOTE_ID,

            accountId: ACCOUNT_ID,

            product: "personal-ai-agent",

            amountBaseUnits: "1000000"

          },

          memo: "LAGO-SUB-V1:" + QUOTE_ID,

          paymentVerified: false,

          entitled: false,

          aiEnabled: false

        };

      }

    },

    authorization: {

      async confirmPayment(input) {

        calls.push({
          operation: "confirm",
          input
        });

        const failure = authenticate(input);

        if (failure) {
          return failure;
        }

        if (controls.invalidPayment) {
          return { ok: true };
        }

        return {

          ok: true,

          accountId: ACCOUNT_ID,

          quoteId: input.quoteId,

          transactionSignature:
            input.transactionSignature,

          paymentRecorded: true,

          duplicate: false,

          entitled: false,

          aiEnabled: false,

          tradingAuthorized: false

        };

      }

    }

  };


  /*
   * REAL LOCAL HTTP SERVER
   */

  const server = createLagoHttpServer({

    projectRoot: root,

    store: {},

    botToken: "",

    cookieSecure: false,

    subscriptionServices,

    ...overrides

  });

  t.after(async () => {

    try {

      if (server.listening) {

        await new Promise((resolve, reject) => {

          server.close(error => {

            if (error) {
              reject(error);
            } else {
              resolve();
            }

          });

          server.closeAllConnections();

        });

      }

    } finally {

      await rm(root, {
        recursive: true,
        force: true
      });

    }

  });

  const listening = once(server, "listening");

  server.listen(0, "127.0.0.1");

  await listening;

  const origin =
    "http://127.0.0.1:" +
    server.address().port;


  /*
   * REAL HTTP REQUEST HELPER
   */

  async function request(
    path,
    options = {}
  ) {

    const {

      method = "GET",

      authenticated = true,

      sameOrigin = true,

      body,

      headers: customHeaders = {}

    } = options;

    const headers = {

      Accept: "application/json"

    };

    if (authenticated) {

      headers.Cookie =
        "lago_session=" + SESSION_TOKEN;

    }

    if (
      sameOrigin &&
      method !== "GET" &&
      method !== "HEAD"
    ) {

      headers.Origin = origin;

      headers["Sec-Fetch-Site"] =
        "same-origin";

    }

    if (body !== undefined) {

      headers["Content-Type"] =
        "application/json";

    }

    Object.assign(
      headers,
      customHeaders
    );

    const response = await fetch(

      origin + path,

      {

        method,

        headers,

        body: body === undefined

          ? undefined

          : typeof body === "string"

            ? body

            : JSON.stringify(body),

        redirect: "manual",

        signal: AbortSignal.timeout(5000)

      }

    );

    const data = await response.json();

    return {

      status: response.status,

      headers: response.headers,

      data

    };

  }

  return {

    server,

    origin,

    calls,

    controls,

    request,

    state(options = {}) {

      return request(
        STATE_PATH,
        options
      );

    },

    quote(options = {}) {

      return request(
        QUOTE_PATH,
        {

          method: "POST",

          body: {},

          ...options

        }
      );

    },

    confirm(options = {}) {

      return request(
        CONFIRM_PATH,
        {

          method: "POST",

          body: PAYMENT_BODY,

          ...options

        }
      );

    }

  };

}


/*
 * ASSERT SAFE API ERROR
 */

function assertError(
  result,
  status,
  reason
) {

  assert.equal(
    result.status,
    status
  );

  assert.equal(
    result.data.ok,
    false
  );

  assert.equal(
    result.data.error,
    reason
  );

  assert.equal(
    result.headers.get("cache-control"),
    "no-store"
  );

}


/*
 * TEST 01 — DISABLED SERVICES
 */

test("returns service unavailable without subscription services", async t => {

  const fx = await fixture(t, {
    subscriptionServices: null
  });

  for (const result of [

    await fx.state(),

    await fx.quote(),

    await fx.confirm()

  ]) {

    assertError(
      result,
      503,
      "subscription_service_unavailable"
    );

  }

});


/*
 * TEST 02 — REQUIRED SESSION COOKIE
 */

test("requires session cookie on every subscription route", async t => {

  const fx = await fixture(t);

  for (const result of [

    await fx.state({
      authenticated: false
    }),

    await fx.quote({
      authenticated: false
    }),

    await fx.confirm({
      authenticated: false
    })

  ]) {

    assertError(
      result,
      401,
      "authentication_required"
    );

  }

  assert.equal(fx.calls.length, 0);

});


/*
 * TEST 03 — HTTP METHODS
 */

test("rejects unsupported methods and returns the Allow header", async t => {

  const fx = await fixture(t);

  const state = await fx.request(
    STATE_PATH,
    {
      method: "POST",
      body: {}
    }
  );

  assertError(
    state,
    405,
    "method_not_allowed"
  );

  assert.equal(
    state.headers.get("allow"),
    "GET"
  );

  for (const path of [
    QUOTE_PATH,
    CONFIRM_PATH
  ]) {

    const result =
      await fx.request(path);

    assertError(
      result,
      405,
      "method_not_allowed"
    );

    assert.equal(
      result.headers.get("allow"),
      "POST"
    );

  }

  assert.equal(fx.calls.length, 0);

});


/*
 * TEST 04 — URL PARAMETERS
 */

test("rejects subscription data supplied in URL query parameters", async t => {

  const fx = await fixture(t);

  for (const [path, method] of [

    [STATE_PATH, "GET"],

    [QUOTE_PATH, "POST"],

    [CONFIRM_PATH, "POST"]

  ]) {

    const result = await fx.request(

      path + "?accountId=foreign-account",

      { method }

    );

    assertError(
      result,
      400,
      "subscription_query_not_allowed"
    );

  }

  assert.equal(fx.calls.length, 0);

});


/*
 * TEST 05 — FOREIGN ORIGIN
 */

test("rejects cross-origin payment mutations", async t => {

  const fx = await fixture(t);

  for (const operation of [
    fx.quote,
    fx.confirm
  ]) {

    const result = await operation({

      headers: {

        Origin:
          "https://foreign.example.test"

      }

    });

    assertError(
      result,
      403,
      "origin_not_allowed"
    );

  }

  assert.equal(fx.calls.length, 0);

});


/*
 * TEST 06 — MISSING ORIGIN
 */

test("requires explicit origin for payment mutations", async t => {

  const fx = await fixture(t);

  assertError(

    await fx.quote({
      sameOrigin: false
    }),

    403,

    "origin_not_allowed"

  );

  assertError(

    await fx.confirm({
      sameOrigin: false
    }),

    403,

    "origin_not_allowed"

  );

  assert.equal(fx.calls.length, 0);

});


/*
 * TEST 07 — ORIGIN SCHEME
 */

test("rejects an origin with the wrong scheme", async t => {

  const fx = await fixture(t);

  const result = await fx.confirm({

    headers: {

      Origin: fx.origin.replace(
        "http://",
        "https://"
      )

    }

  });

  assertError(
    result,
    403,
    "origin_not_allowed"
  );

  assert.equal(fx.calls.length, 0);

});


/*
 * TEST 08 — FETCH METADATA
 */

test("rejects cross-site fetch metadata on payment routes", async t => {

  const fx = await fixture(t);

  for (const site of [
    "cross-site",
    "same-site",
    "none"
  ]) {

    const result = await fx.confirm({

      headers: {
        "Sec-Fetch-Site": site
      }

    });

    assertError(
      result,
      403,
      "origin_not_allowed"
    );

  }

  assert.equal(fx.calls.length, 0);

});


/*
 * TEST 09 — CONTENT TYPE
 */

test("requires JSON content type on payment routes", async t => {

  const fx = await fixture(t);

  for (const type of [

    "text/plain",

    "application/x-www-form-urlencoded",

    "multipart/form-data"

  ]) {

    assertError(

      await fx.confirm({

        headers: {
          "Content-Type": type
        }

      }),

      415,

      "application_json_required"

    );

  }

  assert.equal(fx.calls.length, 0);

});


/*
 * TEST 10 — INVALID JSON
 */

test("rejects malformed JSON before calling payment services", async t => {

  const fx = await fixture(t);

  assertError(

    await fx.confirm({
      body: "{invalid-json"
    }),

    400,

    "invalid_json"

  );

  assert.equal(fx.calls.length, 0);

});


/*
 * TEST 11 — NON-OBJECT JSON
 */

test("rejects non-object JSON request bodies", async t => {

  const fx = await fixture(t);

  for (const body of [

    "null",

    "[]",

    "123",

    "true",

    '"payment"'

  ]) {

    assertError(

      await fx.confirm({ body }),

      400,

      "invalid_json"

    );

  }

  assert.equal(fx.calls.length, 0);

});


/*
 * TEST 12 — QUOTE FIELD INJECTION
 */

test("rejects browser-controlled quote pricing and identity fields", async t => {

  const fx = await fixture(t);

  for (const body of [

    { accountId: ACCOUNT_ID },

    { amountBaseUnits: "1" },

    { treasuryWallet: "foreign-wallet" },

    { tokenDecimals: 18 },

    { sessionToken: SESSION_TOKEN },

    { entitled: true }

  ]) {

    assertError(

      await fx.quote({ body }),

      400,

      "unexpected_payment_fields"

    );

  }

  assert.equal(fx.calls.length, 0);

});


/*
 * TEST 13 — CONFIRM FIELD INJECTION
 */

test("rejects client-provided payment evidence and permissions", async t => {

  const fx = await fixture(t);

  for (const extra of [

    { accountId: ACCOUNT_ID },

    { sessionToken: SESSION_TOKEN },

    { amountBaseUnits: "1" },

    { serverVerified: true },

    { entitled: true },

    { aiEnabled: true },

    { transaction: {} },

    { receipt: {} },

    { quote: {} }

  ]) {

    assertError(

      await fx.confirm({

        body: {

          ...PAYMENT_BODY,

          ...extra

        }

      }),

      400,

      "unexpected_payment_fields"

    );

  }

  assert.equal(fx.calls.length, 0);

});


/*
 * TEST 14 — PAYMENT IDENTIFIER VALIDATION
 */

test("rejects malformed quote and transaction identifiers", async t => {

  const fx = await fixture(t);

  for (const body of [

    {},

    { quoteId: QUOTE_ID },

    {
      ...PAYMENT_BODY,
      quoteId: "invalid"
    },

    {
      ...PAYMENT_BODY,
      quoteId: QUOTE_ID.toUpperCase()
    },

    {
      ...PAYMENT_BODY,
      transactionSignature: null
    },

    {
      ...PAYMENT_BODY,
      transactionSignature: "0".repeat(64)
    },

    {
      ...PAYMENT_BODY,
      transactionSignature: "1".repeat(89)
    }

  ]) {

    assertError(

      await fx.confirm({ body }),

      400,

      "invalid_payment_request"

    );

  }

  assert.equal(fx.calls.length, 0);

});


/*
 * TEST 15 — SUBSCRIPTION STATE
 */

test("returns authenticated account subscription state", async t => {

  const fx = await fixture(t);

  const result = await fx.state();

  assert.equal(result.status, 200);

  assert.equal(result.data.ok, true);

  assert.equal(

    result.data.subscription.accountId,

    ACCOUNT_ID

  );

  assert.equal(

    result.data.subscription.status,

    "inactive"

  );

  assert.equal(

    result.data.subscription.entitled,

    false

  );

  assert.deepEqual(fx.calls, [

    {

      operation: "state",

      input: {
        sessionToken: SESSION_TOKEN
      }

    }

  ]);

});


/*
 * TEST 16 — SERVER QUOTE
 */

test("returns a server-generated payment quote", async t => {

  const fx = await fixture(t);

  const result = await fx.quote();

  assert.equal(result.status, 201);
  assert.equal(result.data.ok, true);

  assert.equal(
    result.data.quote.quoteId,
    QUOTE_ID
  );

  assert.equal(
    result.data.quote.amountBaseUnits,
    "1000000"
  );

  assert.equal(
    result.data.memo,
    "LAGO-SUB-V1:" + QUOTE_ID
  );

  assert.equal(
    result.data.paymentVerified,
    false
  );

  assert.equal(
    result.data.entitled,
    false
  );

  assert.deepEqual(fx.calls, [

    {

      operation: "quote",

      input: {
        sessionToken: SESSION_TOKEN
      }

    }

  ]);

});


/*
 * TEST 17 — PAYMENT CONFIRMATION
 */

test("forwards only authenticated payment identifiers", async t => {

  const fx = await fixture(t);

  const result = await fx.confirm();

  assert.equal(result.status, 200);
  assert.equal(result.data.ok, true);

  assert.equal(
    result.data.paymentRecorded,
    true
  );

  assert.equal(
    result.data.payment.quoteId,
    QUOTE_ID
  );

  assert.equal(
    result.data.entitled,
    false
  );

  assert.equal(
    result.data.aiEnabled,
    false
  );

  assert.equal(
    result.data.tradingAuthorized,
    false
  );

  assert.deepEqual(fx.calls, [

    {

      operation: "confirm",

      input: {

        sessionToken: SESSION_TOKEN,

        quoteId: QUOTE_ID,

        transactionSignature: SIGNATURE

      }

    }

  ]);

});


/*
 * TEST 18 — INVALID SESSION
 */

test("delegates session verification to trusted server services", async t => {

  const fx = await fixture(t);

  const result = await fx.state({

    headers: {

      Cookie:
        "lago_session=invalid-session"

    }

  });

  assertError(
    result,
    401,
    "authentication_required"
  );

  assert.equal(fx.calls.length, 1);

});


/*
 * TEST 19 — SAFE ERROR MAPPING
 */

test("maps trusted service failures to expected HTTP status codes", async t => {

  const fx = await fixture(t);

  const cases = [

    ["authentication_required", 401],

    ["session_expired", 401],

    ["payment_session_changed", 401],

    ["invalid_payment_request", 400],

    ["payment_quote_not_found", 404],

    ["payment_already_used", 409],

    ["transaction_not_finalized", 409],

    ["transaction_not_found", 409],

    ["payment_evidence_mismatch", 422],

    ["payment_not_verified", 422],

    ["active_quote_limit_reached", 429],

    ["solana_rpc_unavailable", 503],

    ["payment_configuration_unavailable", 503],

    ["subscription_ledger_unavailable", 503]

  ];

  for (const [reason, status] of cases) {

    fx.controls.failure = {

      ok: false,

      reason,

      retryable:
        reason === "transaction_not_finalized"

    };

    const result = await fx.confirm();

    assertError(
      result,
      status,
      reason
    );

    assert.equal(

      result.data.retryable,

      status === 429 ||

      status === 503 ||

      reason === "transaction_not_finalized"

    );

  }

});


/*
 * TEST 20 — UNKNOWN ERROR PRIVACY
 */

test("does not expose unknown provider failure messages", async t => {

  const fx = await fixture(t);

  fx.controls.failure = {

    ok: false,

    reason:
      "SYNTHETIC_PRIVATE_PROVIDER_SECRET"

  };

  const result = await fx.confirm();

  assertError(

    result,

    503,

    "subscription_service_unavailable"

  );

  assert.equal(

    JSON.stringify(result.data).includes(
      "SYNTHETIC_PRIVATE_PROVIDER_SECRET"
    ),

    false

  );

});


/*
 * TEST 21 — PROVIDER EXCEPTIONS
 */

test("returns sanitized errors when payment services throw", async t => {

  const fx = await fixture(t);

  fx.controls.throwError = true;

  for (const result of [

    await fx.state(),

    await fx.quote(),

    await fx.confirm()

  ]) {

    assertError(

      result,

      503,

      "subscription_service_unavailable"

    );

    assert.equal(
      result.data.retryable,
      true
    );

    assert.equal(

      JSON.stringify(result.data).includes(
        "SYNTHETIC_PRIVATE_SERVER_SECRET"
      ),

      false

    );

  }

});


/*
 * TEST 22 — INVALID SUCCESS RESPONSES
 */

test("rejects incomplete quote and payment success responses", async t => {

  const fx = await fixture(t);

  fx.controls.invalidQuote = true;

  assertError(

    await fx.quote(),

    503,

    "subscription_service_unavailable"

  );

  fx.controls.invalidPayment = true;

  assertError(

    await fx.confirm(),

    503,

    "payment_recording_unavailable"

  );

});


/*
 * TEST 23 — RESPONSE PRIVACY
 */

test("prevents caching and session token exposure in API responses", async t => {

  const fx = await fixture(t);

  for (const result of [

    await fx.state(),

    await fx.quote(),

    await fx.confirm()

  ]) {

    assert.equal(

      result.headers.get("cache-control"),

      "no-store"

    );

    assert.match(

      result.headers.get("content-type"),

      /^application\/json/

    );

    assert.equal(

      JSON.stringify(result.data).includes(
        SESSION_TOKEN
      ),

      false

    );

    assert.equal(

      result.headers.get(
        "access-control-allow-origin"
      ),

      null

    );

  }

});


/*
 * TEST 24 — EXISTING API COMPATIBILITY
 */

test("preserves health wallet protection and unknown API behavior", async t => {

  const fx = await fixture(t);

  const health = await fx.request(
    "/api/health"
  );

  assert.equal(health.status, 200);

  assert.equal(
    health.data.service,
    "lago-backend"
  );

  assertError(

    await fx.request(
      "/api/account/wallet"
    ),

    501,

    "wallet_proof_required"

  );

  assertError(

    await fx.request(
      "/api/subscription/unknown"
    ),

    404,

    "not_found"

  );

  assert.equal(fx.calls.length, 0);

});

/*
 * LAGO GAME
 * R2.7F3C — HTTP HARDENING TESTS
 *
 * Real HTTP transport.
 * Bounded JSON parsing.
 * Cookie ambiguity protection.
 * Strict UTF-8 validation.
 * Solana signature validation.
 */

const BODY_LIMIT = 32 * 1024;


/*
 * RAW HTTP REQUEST HELPER
 *
 * Supports binary request bodies
 * and chunked transfer encoding.
 */

function rawPaymentRequest(
  fx,
  {
    path = CONFIRM_PATH,
    chunks = [],
    headers = {}
  } = {}
) {

  return new Promise((resolve, reject) => {

    const target = new URL(
      path,
      fx.origin
    );

    const request = httpRequest(

      target,

      {

        method: "POST",

        headers: {

          Cookie:
            "lago_session=" + SESSION_TOKEN,

          Origin: fx.origin,

          "Sec-Fetch-Site": "same-origin",

          "Content-Type": "application/json",

          ...headers

        }

      },

      response => {

        const received = [];

        response.on("data", chunk => {
          received.push(chunk);
        });

        response.on("error", reject);

        response.on("end", () => {

          try {

            resolve({

              status: response.statusCode,

              headers: new Headers(
                response.headers
              ),

              data: JSON.parse(
                Buffer.concat(received)
                  .toString("utf8")
              )

            });

          } catch (error) {

            reject(error);

          }

        });

      }

    );

    request.on("error", reject);

    request.setTimeout(5000, () => {

      request.destroy(
        new Error("test_request_timeout")
      );

    });

    for (const chunk of chunks) {

      request.write(chunk);

    }

    request.end();

  });

}


/*
 * TEST 25 — SECURITY HEADERS
 */

test("applies security headers to subscription API responses", async t => {

  const fx = await fixture(t);

  const responses = [

    await fx.state(),

    await fx.quote(),

    await fx.confirm(),

    await fx.state({
      authenticated: false
    })

  ];

  for (const result of responses) {

    assert.equal(
      result.headers.get("cache-control"),
      "no-store"
    );

    assert.equal(
      result.headers.get("x-content-type-options"),
      "nosniff"
    );

    assert.equal(
      result.headers.get("x-frame-options"),
      "DENY"
    );

    assert.equal(
      result.headers.get("referrer-policy"),
      "no-referrer"
    );

    assert.equal(
      result.headers.get(
        "cross-origin-resource-policy"
      ),
      "same-origin"
    );

  }

});


/*
 * TEST 26 — DUPLICATE SESSION COOKIES
 */

test("rejects ambiguous duplicate session cookies", async t => {

  const fx = await fixture(t);

  const cookies = [

    `lago_session=${SESSION_TOKEN}; lago_session=foreign`,

    `lago_session=foreign; lago_session=${SESSION_TOKEN}`,

    `lago_session=${SESSION_TOKEN}; lago_session=${SESSION_TOKEN}`,

    `lago_session=foreign; lago_session=other; lago_session=${SESSION_TOKEN}`

  ];

  for (const Cookie of cookies) {

    assertError(

      await fx.state({
        headers: { Cookie }
      }),

      401,

      "authentication_required"

    );

  }

  assert.equal(fx.calls.length, 0);

});


/*
 * TEST 27 — MALFORMED COOKIE ENCODING
 */

test("rejects malformed session cookie encoding", async t => {

  const fx = await fixture(t);

  for (const value of [

    "%",

    "%ZZ",

    "%E0%A4%A",

    "%FF"

  ]) {

    assertError(

      await fx.state({

        headers: {

          Cookie: "lago_session=" + value

        }

      }),

      401,

      "authentication_required"

    );

  }

  assert.equal(fx.calls.length, 0);

});


/*
 * TEST 28 — MALFORMED DUPLICATE COOKIE
 */

test("does not recover ambiguous sessions from duplicate malformed cookies", async t => {

  const fx = await fixture(t);

  for (const Cookie of [

    `lago_session=%ZZ; lago_session=${SESSION_TOKEN}`,

    `lago_session=${SESSION_TOKEN}; lago_session=%ZZ`

  ]) {

    assertError(

      await fx.state({
        headers: { Cookie }
      }),

      401,

      "authentication_required"

    );

  }

  assert.equal(fx.calls.length, 0);

});


/*
 * TEST 29 — SPECIAL COOKIE PROPERTIES
 */

test("isolates session cookies from special object property names", async t => {

  const fx = await fixture(t);

  const result = await fx.state({

    headers: {

      Cookie: [

        "__proto__=foreign",

        "constructor=foreign",

        "prototype=foreign",

        "toString=foreign",

        `lago_session=${SESSION_TOKEN}`

      ].join("; ")

    }

  });

  assert.equal(result.status, 200);

  assert.deepEqual(fx.calls, [

    {

      operation: "state",

      input: {
        sessionToken: SESSION_TOKEN
      }

    }

  ]);

});


/*
 * TEST 30 — UNRELATED DUPLICATE COOKIES
 */

test("preserves valid sessions with unrelated duplicate cookies", async t => {

  const fx = await fixture(t);

  const result = await fx.state({

    headers: {

      Cookie:
        `theme=dark; theme=light; lago_session=${SESSION_TOKEN}`

    }

  });

  assert.equal(result.status, 200);

  assert.equal(fx.calls.length, 1);

});


/*
 * TEST 31 — ENCODED SESSION COOKIE
 */

test("decodes valid percent-encoded session cookies", async t => {

  const fx = await fixture(t);

  const encoded = Array.from(
    SESSION_TOKEN,
    character => "%" +
      character.charCodeAt(0)
        .toString(16)
        .padStart(2, "0")
  ).join("");

  const result = await fx.state({

    headers: {

      Cookie: "lago_session=" + encoded

    }

  });

  assert.equal(result.status, 200);

  assert.equal(

    fx.calls[0].input.sessionToken,

    SESSION_TOKEN

  );

});


/*
 * TEST 32 — SESSION LENGTH LIMIT
 */

test("rejects oversized session cookies before service execution", async t => {

  const fx = await fixture(t);

  assertError(

    await fx.state({

      headers: {

        Cookie:
          "lago_session=" + "a".repeat(257)

      }

    }),

    401,

    "authentication_required"

  );

  assert.equal(fx.calls.length, 0);

});


/*
 * TEST 33 — CONTENT LENGTH LIMIT
 */

test("returns HTTP 413 for oversized JSON bodies", async t => {

  const fx = await fixture(t);

  const result = await fx.confirm({

    body: {

      ...PAYMENT_BODY,

      padding: "x".repeat(BODY_LIMIT)

    }

  });

  assertError(

    result,

    413,

    "body_too_large"

  );

  assert.equal(

    result.headers.get("connection"),

    "close"

  );

  assert.equal(fx.calls.length, 0);

});


/*
 * TEST 34 — EXACT BODY SIZE LIMIT
 */

test("accepts valid JSON at the exact body size limit", async t => {

  const fx = await fixture(t);

  const json = JSON.stringify(
    PAYMENT_BODY
  );

  const padding =
    BODY_LIMIT - Buffer.byteLength(json);

  const body =
    json + " ".repeat(padding);

  assert.equal(
    Buffer.byteLength(body),
    BODY_LIMIT
  );

  const result = await fx.confirm({
    body
  });

  assert.equal(result.status, 200);

  assert.equal(fx.calls.length, 1);

});


/*
 * TEST 35 — ONE BYTE OVER LIMIT
 */

test("rejects JSON exceeding the body limit by one byte", async t => {

  const fx = await fixture(t);

  const json = JSON.stringify(
    PAYMENT_BODY
  );

  const body = json + " ".repeat(

    BODY_LIMIT -
    Buffer.byteLength(json) +
    1

  );

  assertError(

    await fx.confirm({ body }),

    413,

    "body_too_large"

  );

  assert.equal(fx.calls.length, 0);

});


/*
 * TEST 36 — CHUNKED OVERSIZED REQUEST
 */

test("rejects oversized chunked request bodies without calling payment services", async t => {

  const fx = await fixture(t);

  const result = await rawPaymentRequest(

    fx,

    {

      headers: {

        "Transfer-Encoding": "chunked"

      },

      chunks: [

        Buffer.alloc(
          BODY_LIMIT / 2,
          32
        ),

        Buffer.alloc(
          BODY_LIMIT / 2,
          32
        ),

        Buffer.from(" ")

      ]

    }

  );

  assertError(

    result,

    413,

    "body_too_large"

  );

  assert.equal(

    result.headers.get("connection"),

    "close"

  );

  assert.equal(fx.calls.length, 0);

});


/*
 * TEST 37 — VALID CHUNKED JSON
 */

test("accepts valid JSON split across HTTP chunks", async t => {

  const fx = await fixture(t);

  const body = JSON.stringify(
    PAYMENT_BODY
  );

  const result = await rawPaymentRequest(

    fx,

    {

      headers: {

        "Transfer-Encoding": "chunked"

      },

      chunks: [

        Buffer.from(body.slice(0, 10)),

        Buffer.from(body.slice(10, 30)),

        Buffer.from(body.slice(30))

      ]

    }

  );

  assert.equal(result.status, 200);

  assert.equal(
    result.data.paymentRecorded,
    true
  );

  assert.equal(fx.calls.length, 1);

});


/*
 * TEST 38 — MALFORMED UTF-8
 */

test("rejects malformed UTF-8 in JSON bodies", async t => {

  const fx = await fixture(t);

  const body = Buffer.concat([

    Buffer.from('{"quoteId":"'),

    Buffer.from([0xc3, 0x28]),

    Buffer.from('"}')

  ]);

  const result = await rawPaymentRequest(

    fx,

    {

      headers: {

        "Content-Length":
          String(body.length)

      },

      chunks: [body]

    }

  );

  assertError(

    result,

    400,

    "invalid_json"

  );

  assert.equal(fx.calls.length, 0);

});


/*
 * TEST 39 — BYTE-BASED BODY LIMIT
 */

test("enforces request limits by bytes rather than character count", async t => {

  const fx = await fixture(t);

  const body = JSON.stringify({

    ...PAYMENT_BODY,

    padding: "🐌".repeat(9000)

  });

  assert.ok(body.length < BODY_LIMIT);

  assert.ok(

    Buffer.byteLength(body) >
      BODY_LIMIT

  );

  assertError(

    await fx.confirm({ body }),

    413,

    "body_too_large"

  );

  assert.equal(fx.calls.length, 0);

});


/*
 * TEST 40 — DECODED SIGNATURE LENGTH
 */

test("rejects base58 signatures that do not decode to 64 bytes", async t => {

  const fx = await fixture(t);

  const invalidSignatures = [

    "1".repeat(63) + "z" + "z",

    "1".repeat(65),

    "1".repeat(88),

    "z".repeat(88),

    "2".repeat(64)

  ];

  for (const transactionSignature of invalidSignatures) {

    assertError(

      await fx.confirm({

        body: {

          ...PAYMENT_BODY,

          transactionSignature

        }

      }),

      400,

      "invalid_payment_request"

    );

  }

  assert.equal(fx.calls.length, 0);

});


/*
 * TEST 41 — CANONICAL SIGNATURE
 */

test("accepts structurally valid 64-byte Solana signatures", async t => {

  const fx = await fixture(t);

  const signature =
    "1".repeat(63) + "3";

  const result = await fx.confirm({

    body: {

      quoteId: QUOTE_ID,

      transactionSignature: signature

    }

  });

  assert.equal(result.status, 200);

  assert.equal(

    fx.calls[0].input.transactionSignature,

    signature

  );

});


/*
 * TEST 42 — RECOVERY AFTER OVERSIZED BODY
 */

test("continues serving valid requests after rejecting oversized JSON", async t => {

  const fx = await fixture(t);

  assertError(

    await fx.confirm({

      body: "x".repeat(
        BODY_LIMIT + 1
      )

    }),

    413,

    "body_too_large"

  );

  assert.equal(fx.calls.length, 0);

  const result = await fx.confirm();

  assert.equal(result.status, 200);

  assert.equal(fx.calls.length, 1);

});


/*
 * TEST 43 — PROTOTYPE FIELD INJECTION
 */

test("rejects special JSON properties on payment routes", async t => {

  const fx = await fixture(t);

  for (const body of [

    '{"__proto__":{"entitled":true}}',

    '{"constructor":{"prototype":{"entitled":true}}}',

    '{"prototype":{"serverVerified":true}}'

  ]) {

    assertError(

      await fx.quote({ body }),

      400,

      "unexpected_payment_fields"

    );

  }

  assert.equal(fx.calls.length, 0);

});


/*
 * TEST 44 — PROTECTED ERROR RESPONSES
 */

test("applies security headers to oversized and malformed request errors", async t => {

  const fx = await fixture(t);

  const results = [

    await fx.confirm({
      body: "{invalid"
    }),

    await fx.confirm({

      body: "x".repeat(
        BODY_LIMIT + 1
      )

    })

  ];

  for (const result of results) {

    assert.equal(

      result.headers.get(
        "x-content-type-options"
      ),

      "nosniff"

    );

    assert.equal(

      result.headers.get(
        "cross-origin-resource-policy"
      ),

      "same-origin"

    );

    assert.equal(

      result.headers.get(
        "cache-control"
      ),

      "no-store"

    );

  }

  assert.equal(fx.calls.length, 0);

});

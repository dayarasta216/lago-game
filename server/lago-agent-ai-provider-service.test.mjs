import test from "node:test";

import assert from "node:assert/strict";

import {
  mkdtempSync,
  mkdirSync,
  rmSync,
  existsSync,
  statSync
} from "node:fs";

import {
  tmpdir
} from "node:os";

import {
  join
} from "node:path";

import {
  createLagoAIProviderService,
  AI_PROVIDER_SERVICE_VERSION
} from "./lago-agent-ai-provider-service.mjs";


/*
 * LAGO GAME
 * R2.8C6A — BOOTSTRAP SECURITY TESTS
 *
 * Synthetic credentials.
 * Real SQLite.
 * No external HTTP requests.
 * No billable inference.
 */

const KEY =
  "synthetic-provider-test-secret";

const MODEL =
  "synthetic-model-v1";

const NOW = Date.parse(
  "2027-01-31T12:00:00.000Z"
);


function fixture(t) {
  const root = mkdtempSync(
    join(tmpdir(), "lago-provider-")
  );

  const projectRoot =
    join(root, "project");

  const directory =
    join(root, "private-ai");

  mkdirSync(projectRoot);

  const services = [];

  let networkCalls = 0;

  let authorizationCalls = 0;

  const env = {
    LAGO_AI_PROVIDER_ENABLED: "1",

    LAGO_OPENAI_API_KEY: KEY,

    LAGO_OPENAI_MODEL: MODEL,

    LAGO_AI_USAGE_DATA_DIR: directory
  };

  const config = {
    env,

    projectRoot,

    now: () => NOW,

    runtimeAccess: {
      async authorize() {
        authorizationCalls++;

        return null;
      }
    },

    async getProcessingConsent() {
      return true;
    },

    async fetchImpl() {
      networkCalls++;

      throw new Error(
        "unexpected_external_request"
      );
    }
  };

  t.after(() => {
    for (const service of services) {
      service.close();
    }

    rmSync(root, {
      recursive: true,
      force: true
    });
  });

  function open(changes = {}) {
    const service =
      createLagoAIProviderService({
        ...config,

        ...changes
      });

    if (service) {
      services.push(service);
    }

    return service;
  }

  return {
    root,

    directory,

    projectRoot,

    env,

    config,

    open,

    networkCalls: () =>
      networkCalls,

    authorizationCalls: () =>
      authorizationCalls
  };
}


function input() {
  return {
    sessionToken: "synthetic-session",

    characterId: "lago",

    action: "chat",

    message: "Hello Lago."
  };
}


/*
 * TEST 01 — DISABLED BY DEFAULT
 */

test(
  "R2.8C6A disabled provider creates no services or files",
  t => {
    const fx = fixture(t);

    for (const value of [
      undefined,
      "",
      "0"
    ]) {
      assert.equal(
        fx.open({
          env: {
            ...fx.env,

            LAGO_AI_PROVIDER_ENABLED:
              value
          }
        }),

        null
      );
    }

    assert.equal(
      existsSync(fx.directory),

      false
    );

    assert.equal(
      fx.networkCalls(),

      0
    );
  }
);


/*
 * TEST 02 — EXACT ACTIVATION FLAG
 */

test(
  "R2.8C6A rejects ambiguous activation values",
  t => {
    const fx = fixture(t);

    for (const value of [
      true,
      1,
      "true",
      "yes",
      " 1",
      "1 ",
      "2",
      null
    ]) {
      assert.throws(
        () => fx.open({
          env: {
            ...fx.env,

            LAGO_AI_PROVIDER_ENABLED:
              value
          }
        }),

        /invalid_ai_provider_activation/
      );
    }

    assert.equal(
      existsSync(fx.directory),

      false
    );
  }
);


/*
 * TEST 03 — REQUIRED CREDENTIALS
 */

test(
  "R2.8C6A requires valid server API credentials",
  t => {
    const fx = fixture(t);

    for (const value of [
      undefined,
      null,
      "",
      "key with spaces",
      "key\n",
      "x".repeat(513)
    ]) {
      assert.throws(
        () => fx.open({
          env: {
            ...fx.env,

            LAGO_OPENAI_API_KEY:
              value
          }
        }),

        /invalid_ai_provider_api_key/
      );
    }

    assert.equal(
      existsSync(fx.directory),

      false
    );

    assert.equal(
      fx.networkCalls(),

      0
    );
  }
);


/*
 * TEST 04 — MODEL VALIDATION
 */

test(
  "R2.8C6A rejects malformed model configuration",
  t => {
    const fx = fixture(t);

    for (const value of [
      undefined,
      null,
      "",
      "../model",
      "model with spaces",
      "x".repeat(129)
    ]) {
      assert.throws(
        () => fx.open({
          env: {
            ...fx.env,

            LAGO_OPENAI_MODEL:
              value
          }
        }),

        /invalid_ai_provider_model/
      );
    }

    assert.equal(
      existsSync(fx.directory),

      false
    );
  }
);


/*
 * TEST 05 — TRUSTED DEPENDENCIES
 */

test(
  "R2.8C6A requires runtime authorization and consent",
  t => {
    const fx = fixture(t);

    assert.throws(
      () => fx.open({
        runtimeAccess: null
      }),

      /ai_runtime_access_required/
    );

    assert.throws(
      () => fx.open({
        getProcessingConsent: null
      }),

      /ai_processing_consent_required/
    );

    assert.throws(
      () => fx.open({
        fetchImpl: null
      }),

      /invalid_ai_provider_dependencies/
    );

    assert.throws(
      () => fx.open({
        now: null
      }),

      /invalid_ai_provider_dependencies/
    );

    assert.equal(
      existsSync(fx.directory),

      false
    );
  }
);


/*
 * TEST 06 — PRIVATE STORAGE
 */

test(
  "R2.8C6A requires private absolute storage outside project",
  t => {
    const fx = fixture(t);

    assert.throws(
      () => fx.open({
        env: {
          ...fx.env,

          LAGO_AI_USAGE_DATA_DIR:
            "relative-data"
        }
      }),

      /invalid_ai_provider_usage_directory/
    );

    assert.throws(
      () => fx.open({
        env: {
          ...fx.env,

          LAGO_AI_USAGE_DATA_DIR:
            join(
              fx.projectRoot,
              "public-data"
            )
        }
      }),

      /ai_provider_bootstrap_failed/
    );

    assert.equal(
      fx.networkCalls(),

      0
    );
  }
);


/*
 * TEST 07 — SUCCESSFUL BOOTSTRAP
 */

test(
  "R2.8C6A initializes real accounting without external requests",
  t => {
    const fx = fixture(t);

    const service = fx.open();

    assert.equal(
      service.version,

      AI_PROVIDER_SERVICE_VERSION
    );

    const database = join(
      fx.directory,

      "lago-ai-usage.sqlite"
    );

    assert.equal(
      existsSync(database),

      true
    );

    if (process.platform !== "win32") {
      assert.equal(
        statSync(database).mode & 0o077,

        0
      );
    }

    assert.equal(
      fx.networkCalls(),

      0
    );

    assert.ok(
      Object.isFrozen(service)
    );
  }
);


/*
 * TEST 08 — MANDATORY SECURITY POLICY
 */

test(
  "R2.8C6A enforces authorization and persistent accounting",
  t => {
    const service =
      fixture(t).open();

    const policy =
      service.getPolicy();

    for (const field of [
      "generationAuthorizationRequired",

      "usageLedgerConfigured",

      "usageReservationRequired",

      "atomicUsageReservationEnabled",

      "usageSettlementEnabled",

      "persistentUsageRequired",

      "serverCredentialsOnly"
    ]) {
      assert.equal(
        policy[field],

        true,

        field
      );
    }

    for (const field of [
      "apiKeyExposed",

      "rawAdapterExposed",

      "publicEndpointEnabled",

      "openAIAuthorizationBypassAllowed",

      "openAIBudgetBypassAllowed",

      "clientUsageCountersTrusted",

      "tradingAuthorized"
    ]) {
      assert.equal(
        policy[field],

        false,

        field
      );
    }

    assert.ok(
      Object.isFrozen(policy)
    );
  }
);


/*
 * TEST 09 — CREDENTIAL ISOLATION
 */

test(
  "R2.8C6A never exposes credentials or raw adapter",
  t => {
    const fx = fixture(t);

    const service = fx.open();

    assert.deepEqual(
      Object.keys(service).sort(),

      [
        "version",
        "execute",
        "close",
        "getPolicy"
      ].sort()
    );

    assert.equal(
      JSON.stringify(service)
        .includes(KEY),

      false
    );

    assert.equal(
      JSON.stringify(
        service.getPolicy()
      ).includes(KEY),

      false
    );

    assert.equal(
      service.apiKey,

      undefined
    );

    assert.equal(
      service.generate,

      undefined
    );

    assert.equal(
      service.usageLedger,

      undefined
    );
  }
);


/*
 * TEST 10 — AUTHORIZATION FAILURE
 */

test(
  "R2.8C6A rejects unauthorized player before network dispatch",
  async t => {
    const fx = fixture(t);

    const service = fx.open();

    const result =
      await service.execute(input());

    assert.equal(
      result.ok,

      false
    );

    assert.equal(
      result.reason,

      "ai_authorization_denied"
    );

    assert.equal(
      result.text,

      null
    );

    assert.equal(
      result.tradingAuthorized,

      false
    );

    assert.equal(
      fx.authorizationCalls(),

      1
    );

    assert.equal(
      fx.networkCalls(),

      0
    );
  }
);


/*
 * TEST 11 — SAFE SHUTDOWN
 */

test(
  "R2.8C6A closed service never executes inference",
  async t => {
    const fx = fixture(t);

    const service = fx.open();

    service.close();

    service.close();

    assert.equal(
      service.getPolicy()
        .serviceClosed,

      true
    );

    assert.equal(
      service.getPolicy().active,

      false
    );

    const result =
      await service.execute(input());

    assert.equal(
      result.ok,

      false
    );

    assert.equal(
      result.reason,

      "ai_gateway_closed"
    );

    assert.equal(
      fx.networkCalls(),

      0
    );
  }
);


/*
 * TEST 12 — SANITIZED STARTUP ERRORS
 */

test(
  "R2.8C6A sanitizes bootstrap errors and denies startup",
  t => {
    const fx = fixture(t);

    assert.throws(
      () => fx.open({
        limits: null
      }),

      error => {
        assert.equal(
          error.message,

          "ai_provider_bootstrap_failed"
        );

        assert.equal(
          String(error).includes(KEY),

          false
        );

        return true;
      }
    );

    assert.equal(
      fx.networkCalls(),

      0
    );
  }
);

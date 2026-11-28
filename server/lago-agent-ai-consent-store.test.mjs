import test from "node:test";

import assert from "node:assert/strict";

import { DatabaseSync } from "node:sqlite";

import {
  mkdtempSync,
  mkdirSync,
  rmSync,
  statSync,
  chmodSync
} from "node:fs";

import { tmpdir } from "node:os";

import { join } from "node:path";

import {
  createLagoAccountSessionStore
} from "./lago-account-session-store.mjs";

import {
  createLagoAIConsentStore,

  AI_CONSENT_POLICY_VERSION

} from "./lago-agent-ai-consent-store.mjs";


/*
 * LAGO GAME
 * R2.8C6C1 — CONSENT SECURITY TESTS
 *
 * Real account sessions.
 * Real persistent SQLite.
 * No OpenAI requests.
 * No external network.
 */

const START = Date.parse(
  "2027-01-31T12:00:00.000Z"
);

const MODEL = "synthetic-model-v1";


async function fixture(t) {
  const root = mkdtempSync(
    join(tmpdir(), "lago-ai-consent-")
  );

  const projectRoot = join(
    root,
    "project"
  );

  const directory = join(
    root,
    "private-consent"
  );

  mkdirSync(projectRoot);

  const services = [];

  let clock = START;

  const now = () => clock;

  t.after(() => {
    for (const service of services) {
      service.close();
    }

    rmSync(root, {
      recursive: true,
      force: true
    });
  });

  const sessions =
    createLagoAccountSessionStore({
      filePath: join(
        root,

        "accounts.json"
      ),

      now
    });

  async function player(id) {
    const account =
      await sessions.upsertVerifiedTelegramUser({
        id,

        username:
          "synthetic_" + id
      });

    assert.equal(account.ok, true);

    const accountId =
      account.account.accountId;

    const session =
      await sessions.createSession(
        accountId,

        {
          ttlSeconds: 3600
        }
      );

    assert.equal(session.ok, true);

    return {
      accountId,

      token: session.token
    };
  }

  const A = await player("100001");

  const B = await player("100002");

  const config = {
    directory,

    projectRoot,

    sessionStore: sessions,

    model: MODEL,

    now
  };

  function open(changes = {}) {
    const service =
      createLagoAIConsentStore({
        ...config,

        ...changes
      });

    services.push(service);

    return service;
  }

  function request(
    player = A,

    granted = true,

    expectedRevision = 0,

    changes = {}
  ) {
    return {
      sessionToken: player.token,

      granted,

      policyVersion:
        AI_CONSENT_POLICY_VERSION,

      expectedRevision,

      ...changes
    };
  }

  function context(
    player = A,
    changes = {}
  ) {
    return {
      accountId: player.accountId,

      characterId: "lago",

      providerId: "openai",

      model: MODEL,

      purpose: "ai_inference",

      ...changes
    };
  }

  return {
    root,

    directory,

    projectRoot,

    sessions,

    config,

    A,

    B,

    open,

    request,

    context,

    setTime: value => {
      clock = value;
    }
  };
}


function options() {
  return {
    signal:
      new AbortController().signal
  };
}


function denied(result, reason) {
  assert.equal(result.ok, false);

  assert.equal(
    result.granted,
    false
  );

  assert.equal(result.reason, reason);

  for (const field of [
    "providerDispatchAuthorized",

    "memoryAuthorized",

    "externalModelTrainingAuthorized",

    "tradingAuthorized"
  ]) {
    assert.equal(
      result[field],
      false,

      field
    );
  }
}


/*
 * TEST 01 — DEFAULT DENIAL
 */

test(
  "R2.8C6C1 defaults to no processing consent",
  async t => {
    const fx = await fixture(t);

    const store = fx.open();

    const state =
      await store.getConsentState({
        sessionToken: fx.A.token
      });

    assert.equal(state.ok, true);

    assert.equal(state.granted, false);

    assert.equal(state.revision, 0);

    assert.equal(state.updatedAt, null);

    assert.equal(
      store.getProcessingConsent(
        fx.context(),

        options()
      ),

      false
    );
  }
);


/*
 * TEST 02 — EXPLICIT GRANT
 */

test(
  "R2.8C6C1 records authenticated explicit consent",
  async t => {
    const fx = await fixture(t);

    const store = fx.open();

    const result =
      await store.setConsent(
        fx.request()
      );

    assert.equal(
      result.ok,
      true,
      result.reason
    );

    assert.equal(result.granted, true);

    assert.equal(result.changed, true);

    assert.equal(result.revision, 1);

    assert.equal(
      result.accountId,
      fx.A.accountId
    );

    assert.equal(
      result.externalModelTrainingAuthorized,
      false
    );

    assert.equal(
      result.providerDispatchAuthorized,
      false
    );

    assert.equal(
      store.getProcessingConsent(
        fx.context(),

        options()
      ),

      true
    );

    assert.equal(
      store.getProcessingConsentRevision(
        fx.context(),

        options()
      ),

      1
    );

    assert.ok(Object.isFrozen(result));
  }
);


/*
 * TEST 03 — PERSISTENCE
 */

test(
  "R2.8C6C1 preserves consent and revocation across restart",
  async t => {
    const fx = await fixture(t);

    const first = fx.open();

    assert.equal(
      (await first.setConsent(
        fx.request()
      )).ok,

      true
    );

    first.close();

    const second = fx.open();

    assert.equal(
      second.getProcessingConsent(
        fx.context(),

        options()
      ),

      true
    );

    const revoked =
      await second.setConsent(
        fx.request(
          fx.A,

          false,

          1
        )
      );

    assert.equal(revoked.ok, true);

    assert.equal(revoked.granted, false);

    assert.equal(revoked.revision, 2);

    second.close();

    const next = fx.open();

    assert.equal(
      next.getProcessingConsent(
        fx.context(),

        options()
      ),

      false
    );

    const state =
      await next.getConsentState({
        sessionToken: fx.A.token
      });

    assert.equal(state.revision, 2);
  }
);


/*
 * TEST 04 — ACCOUNT ISOLATION
 */

test(
  "R2.8C6C1 isolates consent between authenticated players",
  async t => {
    const fx = await fixture(t);

    const store = fx.open();

    assert.equal(
      (await store.setConsent(
        fx.request(fx.A)
      )).ok,

      true
    );

    assert.equal(
      store.getProcessingConsent(
        fx.context(fx.B),

        options()
      ),

      false
    );

    const state =
      await store.getConsentState({
        sessionToken: fx.B.token
      });

    assert.equal(state.granted, false);

    assert.equal(state.revision, 0);

    denied(
      await store.setConsent(
        fx.request(
          fx.B,

          true,

          0,

          {
            accountId: fx.A.accountId
          }
        )
      ),

      "invalid_ai_consent_request"
    );
  }
);


/*
 * TEST 05 — MODEL AND PURPOSE SCOPE
 */

test(
  "R2.8C6C1 never transfers consent to another model or purpose",
  async t => {
    const fx = await fixture(t);

    const store = fx.open();

    assert.equal(
      (await store.setConsent(
        fx.request()
      )).ok,

      true
    );

    for (const changes of [
      { model: "foreign-model" },

      { providerId: "foreign-provider" },

      { purpose: "external_training" },

      { characterId: "unknown-character" }
    ]) {
      assert.equal(
        store.getProcessingConsent(
          fx.context(fx.A, changes),

          options()
        ),

        false
      );
    }

    const other = fx.open({
      model: "synthetic-model-v2"
    });

    assert.equal(
      other.getProcessingConsent(
        fx.context(fx.A, {
          model: "synthetic-model-v2"
        }),

        options()
      ),

      false
    );
  }
);


/*
 * TEST 06 — POLICY VERSION
 */

test(
  "R2.8C6C1 requires current policy version for new grants",
  async t => {
    const fx = await fixture(t);

    const store = fx.open();

    denied(
      await store.setConsent(
        fx.request(
          fx.A,

          true,

          0,

          {
            policyVersion: 999
          }
        )
      ),

      "ai_consent_policy_version_mismatch"
    );

    assert.equal(
      store.getProcessingConsent(
        fx.context(),

        options()
      ),

      false
    );
  }
);


/*
 * TEST 07 — STALE REVISION
 */

test(
  "R2.8C6C1 stale requests cannot restore revoked consent",
  async t => {
    const fx = await fixture(t);

    const first = fx.open();

    const second = fx.open();

    assert.equal(
      (await first.setConsent(
        fx.request()
      )).ok,

      true
    );

    const revoked =
      await second.setConsent(
        fx.request(
          fx.A,

          false,

          1
        )
      );

    assert.equal(revoked.ok, true);

    denied(
      await first.setConsent(
        fx.request(
          fx.A,

          true,

          1
        )
      ),

      "ai_consent_revision_conflict"
    );

    assert.equal(
      first.getProcessingConsent(
        fx.context(),

        options()
      ),

      false
    );

    const newGrant =
      await first.setConsent(
        fx.request(
          fx.A,

          true,

          2
        )
      );

    assert.equal(newGrant.ok, true);

    assert.equal(newGrant.revision, 3);
  }
);


/*
 * TEST 08 — CONCURRENT UPDATES
 */

test(
  "R2.8C6C1 concurrent updates cannot create duplicate revisions",
  async t => {
    const fx = await fixture(t);

    const first = fx.open();

    const second = fx.open();

    const results = await Promise.all([
      first.setConsent(
        fx.request()
      ),

      second.setConsent(
        fx.request()
      )
    ]);

    assert.equal(
      results.filter(r => r.ok).length,

      1
    );

    denied(
      results.find(r => !r.ok),

      "ai_consent_revision_conflict"
    );

    const retry =
      await first.setConsent(
        fx.request(
          fx.A,

          true,

          1
        )
      );

    assert.equal(retry.ok, true);

    assert.equal(retry.changed, false);

    assert.equal(retry.revision, 1);
  }
);


/*
 * TEST 09 — AUTHENTICATION
 */

test(
  "R2.8C6C1 rejects invalid expired and revoked sessions",
  async t => {
    const fx = await fixture(t);

    const store = fx.open();

    denied(
      await store.setConsent({
        ...fx.request(),

        sessionToken: "invalid-session"
      }),

      "authentication_required"
    );

    await fx.sessions.revokeSession(
      fx.A.token
    );

    denied(
      await store.setConsent(
        fx.request()
      ),

      "authentication_required"
    );

    fx.setTime(
      START + 3600001
    );

    denied(
      await store.getConsentState({
        sessionToken: fx.B.token
      }),

      "authentication_required"
    );
  }
);


/*
 * TEST 10 — MALFORMED REQUESTS
 */

test(
  "R2.8C6C1 rejects client permission overrides and getter fields",
  async t => {
    const fx = await fixture(t);

    const store = fx.open();

    for (const input of [
      null,

      {},

      {
        ...fx.request(),

        granted: "true"
      },

      {
        ...fx.request(),

        expectedRevision: -1
      },

      {
        ...fx.request(),

        externalModelTrainingAuthorized: true
      }
    ]) {
      denied(
        await store.setConsent(input),

        "invalid_ai_consent_request"
      );
    }

    let accessed = false;

    const input = fx.request();

    Object.defineProperty(
      input,

      "granted",

      {
        enumerable: true,

        get() {
          accessed = true;

          return true;
        }
      }
    );

    denied(
      await store.setConsent(input),

      "invalid_ai_consent_request"
    );

    assert.equal(accessed, false);
  }
);


/*
 * TEST 11 — ABORT AND CLOCK
 */

test(
  "R2.8C6C1 fails closed for aborted checks and invalid clocks",
  async t => {
    const fx = await fixture(t);

    const store = fx.open();

    assert.equal(
      (await store.setConsent(
        fx.request()
      )).ok,

      true
    );

    const controller =
      new AbortController();

    controller.abort();

    assert.equal(
      store.getProcessingConsent(
        fx.context(),

        {
          signal: controller.signal
        }
      ),

      false
    );

    assert.equal(
      store.getProcessingConsent(
        fx.context()
      ),

      false
    );

    fx.setTime(START - 1);

    assert.equal(
      store.getProcessingConsent(
        fx.context(),

        options()
      ),

      false
    );

    fx.setTime(NaN);

    assert.equal(
      store.getProcessingConsent(
        fx.context(),

        options()
      ),

      false
    );
  }
);


/*
 * TEST 12 — IMMUTABLE HISTORY
 */

test(
  "R2.8C6C1 protects persistent consent history from update delete and replace",
  async t => {
    const fx = await fixture(t);

    const store = fx.open();

    assert.equal(
      (await store.setConsent(
        fx.request()
      )).ok,

      true
    );

    const db = new DatabaseSync(
      join(
        fx.directory,

        "lago-ai-consent.sqlite"
      )
    );

    try {
      assert.throws(
        () => db.exec(`
          UPDATE ai_consent_events
          SET granted = 0
        `),

        /ai_consent_history_immutable/
      );

      assert.throws(
        () => db.exec(`
          DELETE FROM ai_consent_events
        `),

        /ai_consent_history_immutable/
      );

      assert.throws(
        () => db.exec(`
          INSERT OR REPLACE
          INTO ai_consent_events

          SELECT *

          FROM ai_consent_events
        `),

        /ai_consent_history_immutable/
      );

    } finally {
      db.close();
    }

    assert.equal(
      store.getProcessingConsent(
        fx.context(),

        options()
      ),

      true
    );
  }
);


/*
 * TEST 13 — PRIVATE STORAGE
 */

test(
  "R2.8C6C1 requires private storage outside public project",
  async t => {
    const fx = await fixture(t);

    assert.throws(
      () => fx.open({
        directory: join(
          fx.projectRoot,

          "public-consent"
        )
      }),

      /ai_consent_directory_inside_project/
    );

    assert.throws(
      () => fx.open({
        directory: "relative-data"
      }),

      /absolute_ai_consent_paths_required/
    );

    const store = fx.open();

    if (process.platform !== "win32") {
      const file = join(
        fx.directory,

        "lago-ai-consent.sqlite"
      );

      assert.equal(
        statSync(file).mode & 0o077,

        0
      );

      store.close();

      chmodSync(
        fx.directory,

        0o755
      );

      assert.throws(
        () => fx.open(),

        /insecure_ai_consent_directory/
      );
    }
  }
);


/*
 * TEST 14 — SHUTDOWN
 */

test(
  "R2.8C6C1 closed service denies consent checks and mutations",
  async t => {
    const fx = await fixture(t);

    const store = fx.open();

    assert.equal(
      (await store.setConsent(
        fx.request()
      )).ok,

      true
    );

    store.close();

    store.close();

    denied(
      await store.setConsent(
        fx.request()
      ),

      "ai_consent_store_closed"
    );

    denied(
      await store.getConsentState({
        sessionToken: fx.A.token
      }),

      "ai_consent_store_closed"
    );

    assert.equal(
      store.getProcessingConsent(
        fx.context(),

        options()
      ),

      false
    );

    assert.equal(
      store.getProcessingConsentRevision(
        fx.context(),

        options()
      ),

      null
    );
  }
);

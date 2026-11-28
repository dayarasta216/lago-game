import test from "node:test";

import assert from "node:assert/strict";

import {
  mkdtempSync,
  mkdirSync,
  rmSync,
  statSync,
  chmodSync
} from "node:fs";

import { tmpdir } from "node:os";

import { join } from "node:path";

import { Worker } from "node:worker_threads";

import { once } from "node:events";

import {
  createLagoAIRateLimiter,

  AI_RATE_LIMITS

} from "./lago-agent-ai-rate-limiter.mjs";


/*
 * LAGO GAME
 * R2.8C6C2 — RATE LIMIT SECURITY TESTS
 *
 * Real persistent SQLite.
 * Isolated synthetic accounts.
 * Concurrent worker execution.
 * No external provider requests.
 */

const START = Date.parse(
  "2027-01-31T12:00:00.000Z"
);

const A = "lago_" + "a".repeat(22);

const B = "lago_" + "b".repeat(22);

const C = "lago_" + "c".repeat(22);

const TEST_LIMITS = Object.freeze({
  accountPerMinute: 2,

  accountPerHour: 4,

  accountMaxActive: 1,

  globalPerMinute: 3,

  globalPerHour: 6,

  globalMaxActive: 2
});


function fixture(t, changes = {}) {
  const root = mkdtempSync(
    join(tmpdir(), "lago-ai-rate-")
  );

  const projectRoot = join(
    root,
    "project"
  );

  const directory = join(
    root,
    "private-rate"
  );

  mkdirSync(projectRoot);

  let time = START;

  const services = [];

  const config = {
    directory,

    projectRoot,

    limits: {
      ...TEST_LIMITS,

      ...changes
    },

    now: () => time
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

  function open(overrides = {}) {
    const service =
      createLagoAIRateLimiter({
        ...config,

        ...overrides
      });

    services.push(service);

    return service;
  }

  return {
    root,

    directory,

    projectRoot,

    config,

    open,

    setTime(value) {
      time = value;
    }
  };
}


function acquire(
  limiter,
  accountId = A
) {
  const result =
    limiter.acquire({ accountId });

  assert.equal(
    result.ok,
    true,
    result.reason
  );

  assert.equal(
    result.admitted,
    true
  );

  assert.equal(
    result.providerDispatchAuthorized,
    false
  );

  return result;
}


function release(limiter, claim) {
  const result = limiter.release({
    accountId: claim.accountId,

    requestId: claim.requestId
  });

  assert.equal(
    result.ok,
    true,
    result.reason
  );

  assert.equal(
    result.released,
    true
  );

  return result;
}


function complete(
  limiter,
  accountId = A
) {
  return release(
    limiter,

    acquire(limiter, accountId)
  );
}


function denied(result, reason) {
  assert.equal(result.ok, false);

  assert.equal(result.reason, reason);

  assert.equal(result.admitted, false);

  assert.equal(
    result.providerDispatchAuthorized,
    false
  );

  assert.equal(
    result.tradingAuthorized,
    false
  );

  assert.ok(Object.isFrozen(result));
}


/*
 * TEST 01 — CONFIGURATION
 */

test(
  "R2.8C6C2 validates immutable server rate limits",
  t => {
    const fx = fixture(t);

    const limiter = fx.open({
      limits: AI_RATE_LIMITS
    });

    assert.deepEqual(
      limiter.getLimits(),

      AI_RATE_LIMITS
    );

    assert.ok(
      Object.isFrozen(
        limiter.getLimits()
      )
    );

    assert.ok(
      Object.isFrozen(
        limiter.getPolicy()
      )
    );

    for (const changes of [
      { accountPerMinute: 0 },

      { accountPerHour: -1 },

      { globalPerHour: Infinity },

      { accountMaxActive: 17 },

      { globalPerMinute: 1201 },

      { foreignField: true }
    ]) {
      assert.throws(
        () => fx.open({
          limits: {
            ...AI_RATE_LIMITS,

            ...changes
          }
        }),

        /invalid_ai_rate_limits/
      );
    }
  }
);


/*
 * TEST 02 — ACCOUNT CONCURRENCY
 */

test(
  "R2.8C6C2 permits only one active request per account",
  t => {
    const fx = fixture(t);

    const first = fx.open();

    const second = fx.open();

    const claim = acquire(first);

    denied(
      second.acquire({
        accountId: A
      }),

      "ai_account_concurrency_exceeded"
    );

    release(second, claim);

    acquire(first);
  }
);


/*
 * TEST 03 — SLIDING MINUTE
 */

test(
  "R2.8C6C2 enforces exact sliding minute window",
  t => {
    const fx = fixture(t);

    const l = fx.open();

    complete(l);

    complete(l);

    denied(
      l.acquire({ accountId: A }),

      "ai_account_minute_rate_exceeded"
    );

    fx.setTime(START + 59999);

    denied(
      l.acquire({ accountId: A }),

      "ai_account_minute_rate_exceeded"
    );

    fx.setTime(START + 60000);

    acquire(l);
  }
);


/*
 * TEST 04 — SLIDING HOUR
 */

test(
  "R2.8C6C2 enforces exact sliding hour window",
  t => {
    const fx = fixture(t);

    const l = fx.open();

    complete(l);

    complete(l);

    fx.setTime(START + 60000);

    complete(l);

    complete(l);

    fx.setTime(START + 3599999);

    denied(
      l.acquire({ accountId: A }),

      "ai_account_hour_rate_exceeded"
    );

    fx.setTime(START + 3600000);

    acquire(l);
  }
);


/*
 * TEST 05 — GLOBAL CONCURRENCY
 */

test(
  "R2.8C6C2 shares global concurrency across accounts",
  t => {
    const l = fixture(t).open();

    const first = acquire(l, A);

    acquire(l, B);

    denied(
      l.acquire({ accountId: C }),

      "ai_global_concurrency_exceeded"
    );

    release(l, first);

    acquire(l, C);
  }
);


/*
 * TEST 06 — GLOBAL MINUTE RATE
 */

test(
  "R2.8C6C2 limits project-wide requests per minute",
  t => {
    const fx = fixture(t);

    const l = fx.open();

    complete(l, A);

    complete(l, B);

    complete(l, C);

    denied(
      l.acquire({ accountId: A }),

      "ai_global_minute_rate_exceeded"
    );

    fx.setTime(START + 60000);

    acquire(l, A);
  }
);


/*
 * TEST 07 — GLOBAL HOUR RATE
 */

test(
  "R2.8C6C2 limits project-wide requests per hour",
  t => {
    const fx = fixture(t);

    const l = fx.open();

    for (const accountId of [A, B, C]) {
      complete(l, accountId);
    }

    fx.setTime(START + 60000);

    for (const accountId of [A, B, C]) {
      complete(l, accountId);
    }

    fx.setTime(START + 120000);

    denied(
      l.acquire({ accountId: C }),

      "ai_global_hour_rate_exceeded"
    );

    fx.setTime(START + 3600000);

    acquire(l, C);
  }
);


/*
 * TEST 08 — PERSISTENCE
 */

test(
  "R2.8C6C2 retains active claims and rates after reopening",
  t => {
    const fx = fixture(t);

    const first = fx.open();

    const claim = acquire(first);

    first.close();

    const next = fx.open();

    denied(
      next.acquire({
        accountId: A
      }),

      "ai_account_concurrency_exceeded"
    );

    release(next, claim);

    complete(next);

    next.close();

    const restored = fx.open();

    denied(
      restored.acquire({
        accountId: A
      }),

      "ai_account_minute_rate_exceeded"
    );
  }
);


/*
 * TEST 09 — NO AUTOMATIC EXPIRY
 */

test(
  "R2.8C6C2 never silently releases unfinished claims",
  t => {
    const fx = fixture(t);

    const first = fx.open();

    const claim = acquire(first);

    first.close();

    fx.setTime(
      START + 86400000
    );

    const next = fx.open();

    denied(
      next.acquire({
        accountId: A
      }),

      "ai_account_concurrency_exceeded"
    );

    release(next, claim);

    acquire(next);
  }
);


/*
 * TEST 10 — RELEASE ISOLATION
 */

test(
  "R2.8C6C2 release is account-scoped and idempotent",
  t => {
    const l = fixture(t).open();

    const claim = acquire(l);

    denied(
      l.release({
        accountId: B,

        requestId: claim.requestId
      }),

      "ai_rate_claim_not_found"
    );

    const first = release(l, claim);

    assert.equal(
      first.duplicate,

      false
    );

    assert.deepEqual(
      release(l, claim),

      {
        ...first,

        duplicate: true
      }
    );

    complete(l);

    denied(
      l.acquire({ accountId: A }),

      "ai_account_minute_rate_exceeded"
    );
  }
);


/*
 * TEST 11 — CLOCK ROLLBACK
 */

test(
  "R2.8C6C2 fails closed on invalid and regressed global clock",
  t => {
    const fx = fixture(t);

    const l = fx.open();

    const claim = acquire(l);

    fx.setTime(START + 1000);

    release(l, claim);

    l.close();

    const next = fx.open();

    fx.setTime(START);

    denied(
      next.acquire({
        accountId: B
      }),

      "ai_rate_clock_regressed"
    );

    fx.setTime(NaN);

    denied(
      next.acquire({
        accountId: B
      }),

      "invalid_ai_rate_clock"
    );

    fx.setTime(START + 1000);

    acquire(next, B);
  }
);


/*
 * TEST 12 — CONFIGURATION CONSISTENCY
 */

test(
  "R2.8C6C2 rejects conflicting policies on the same database",
  t => {
    const fx = fixture(t);

    fx.open();

    assert.throws(
      () => fx.open({
        limits: {
          ...TEST_LIMITS,

          globalMaxActive: 3
        }
      }),

      /ai_rate_configuration_mismatch/
    );

    const next = fx.open();

    acquire(next);
  }
);


/*
 * TEST 13 — MALFORMED INPUT
 */

test(
  "R2.8C6C2 rejects client IDs limits and accessor fields",
  t => {
    const l = fixture(t).open();

    for (const input of [
      null,

      {},

      { accountId: "bad" },

      {
        accountId: A,

        requestId: "client-id"
      },

      {
        accountId: A,

        globalMaxActive: 10000
      }
    ]) {
      denied(
        l.acquire(input),

        "invalid_ai_rate_request"
      );
    }

    let accessed = false;

    const input = {};

    Object.defineProperty(
      input,

      "accountId",

      {
        enumerable: true,

        get() {
          accessed = true;
          return A;
        }
      }
    );

    denied(
      l.acquire(input),

      "invalid_ai_rate_request"
    );

    assert.equal(accessed, false);

    acquire(l);
  }
);


/*
 * TEST 14 — PRIVATE STORAGE
 */

test(
  "R2.8C6C2 requires private SQLite storage",
  t => {
    const fx = fixture(t);

    assert.throws(
      () => fx.open({
        directory: join(
          fx.projectRoot,
          "public-rate"
        )
      }),

      /ai_rate_directory_inside_project/
    );

    assert.throws(
      () => fx.open({
        directory: "relative-rate"
      }),

      /absolute_ai_rate_paths_required/
    );

    const l = fx.open();

    if (process.platform !== "win32") {
      const database = join(
        fx.directory,
        "lago-ai-rate.sqlite"
      );

      assert.equal(
        statSync(database).mode & 0o077,

        0
      );

      l.close();

      chmodSync(
        fx.directory,

        0o755
      );

      assert.throws(
        () => fx.open(),

        /insecure_ai_rate_directory/
      );
    }
  }
);


/*
 * TEST 15 — SHUTDOWN
 */

test(
  "R2.8C6C2 closed limiter denies admission and release",
  t => {
    const l = fixture(t).open();

    const claim = acquire(l);

    l.close();

    l.close();

    denied(
      l.acquire({ accountId: A }),

      "ai_rate_limiter_closed"
    );

    denied(
      l.release({
        accountId: claim.accountId,

        requestId: claim.requestId
      }),

      "ai_rate_limiter_closed"
    );
  }
);


/*
 * TEST 16 — CONCURRENT WORKERS
 */

test(
  "R2.8C6C2 concurrent workers cannot claim the same account slot",

  {
    timeout: 15000
  },

  async t => {
    const fx = fixture(t);

    fx.open().close();

    const workers = [1, 2].map(
      () => new Worker(`

        const {
          parentPort,

          workerData
        } = require("node:worker_threads");

        (async () => {
          const {
            createLagoAIRateLimiter

          } = await import(
            workerData.url
          );

          const limiter =
            createLagoAIRateLimiter({
              ...workerData.config,

              now: () => workerData.now
            });

          parentPort.once(
            "message",

            () => {
              try {
                parentPort.postMessage(
                  limiter.acquire({
                    accountId:
                      workerData.accountId
                  })
                );

              } finally {
                limiter.close();
              }
            }
          );

          parentPort.postMessage("ready");

        })().catch(error => {
          throw error;
        });

      `, {
        eval: true,

        workerData: {
          url: new URL(
            "./lago-agent-ai-rate-limiter.mjs",

            import.meta.url
          ).href,

          config: {
            directory:
              fx.directory,

            projectRoot:
              fx.projectRoot,

            limits:
              TEST_LIMITS
          },

          accountId: A,

          now: START
        }
      })
    );

    try {
      const ready = await Promise.all(
        workers.map(
          w => once(w, "message")
        )
      );

      assert.deepEqual(
        ready,

        [["ready"], ["ready"]]
      );

      const responses = Promise.all(
        workers.map(
          w => once(w, "message")
        )
      );

      for (const w of workers) {
        w.postMessage("go");
      }

      const results =
        (await responses)
          .map(([result]) => result);

      assert.equal(
        results.filter(r => r.ok).length,

        1
      );

      denied(
        results.find(r => !r.ok),

        "ai_account_concurrency_exceeded"
      );

      const next = fx.open();

      denied(
        next.acquire({
          accountId: A
        }),

        "ai_account_concurrency_exceeded"
      );

      release(
        next,

        results.find(r => r.ok)
      );

      acquire(next);

    } finally {
      await Promise.all(
        workers.map(
          w => w.terminate()
        )
      );
    }
  }
);

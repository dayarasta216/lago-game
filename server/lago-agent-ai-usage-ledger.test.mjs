import test from "node:test";

import assert from "node:assert/strict";

import {
  mkdtempSync,
  mkdirSync,
  rmSync,
  statSync,
  chmodSync,
  symlinkSync
} from "node:fs";

import { tmpdir } from "node:os";

import { join } from "node:path";

import {
  createLagoAIUsageLedger
} from "./lago-agent-ai-usage-ledger.mjs";

/*
 * R2.8C4A — PERSISTENT LEDGER TESTS
 */

const START = Date.parse(
  "2027-01-30T12:00:00.000Z"
);

const A = "lago_" + "a".repeat(22);

const B = "lago_" + "b".repeat(22);

const id = n =>
  "00000000-0000-4000-8000-" +
  String(n).padStart(12, "0");


function fixture(t) {
  const root = mkdtempSync(
    join(tmpdir(), "lago-ai-usage-")
  );

  const projectRoot =
    join(root, "project");

  const directory =
    join(root, "private-usage");

  mkdirSync(projectRoot);

  let clock = START;

  const services = [];

  const config = {
    directory,
    projectRoot,
    now: () => clock
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

  function open() {
    const service =
      createLagoAIUsageLedger(config);

    services.push(service);

    return service;
  }

  return {
    root,
    config,
    open,

    setTime: value => {
      clock = value;
    }
  };
}


function event(n = 1, changes = {}) {
  return {
    requestId: id(n),
    accountId: A,

    inputTokens: 24,
    outputTokens: 8,

    ...changes
  };
}

function read(ledger, accountId = A) {
  const result =
    ledger.getUsage(accountId);

  assert.equal(
    result.ok,
    true,
    result.reason
  );

  return result.usage;
}

function denied(result, reason) {
  assert.equal(result.ok, false);

  assert.equal(result.reason, reason);

  assert.equal(
    result.providerDispatchAuthorized,
    false
  );

  assert.equal(
    result.tradingAuthorized,
    false
  );
}


/*
 * TEST 01 — EMPTY SNAPSHOT
 */

test(
  "R2.8C4A returns a fresh budget-compatible usage snapshot",
  t => {
    const l = fixture(t).open();

    assert.deepEqual(read(l), {
      accountId: A,

      dailyKey: "2027-01-30",
      monthlyKey: "2027-01",

      dailyUsedTokens: 0,
      monthlyUsedTokens: 0,

      dailyReservedTokens: 0,
      monthlyReservedTokens: 0,

      dailyRequests: 0,
      dailyReservedRequests: 0
    });

    assert.ok(
      Object.isFrozen(read(l))
    );
  }
);


/*
 * TEST 02 — PERSISTENCE
 */

test(
  "R2.8C4A persists input and output usage across reopen",
  t => {
    const fx = fixture(t);

    const l = fx.open();

    const result =
      l.recordUsage(event());

    assert.equal(
      result.ok,
      true,
      result.reason
    );

    assert.equal(result.totalTokens, 32);
    assert.equal(result.inputTokens, 24);
    assert.equal(result.outputTokens, 8);
    assert.equal(result.duplicate, false);

    assert.equal(
      result.providerDispatchAuthorized,
      false
    );

    l.close();

    const next = fx.open();

    assert.equal(
      read(next).dailyUsedTokens,
      32
    );

    assert.equal(
      read(next).monthlyUsedTokens,
      32
    );

    assert.equal(
      read(next).dailyRequests,
      1
    );
  }
);


/*
 * TEST 03 — IDEMPOTENCY
 */

test(
  "R2.8C4A exact retry across connections and windows is idempotent",
  t => {
    const fx = fixture(t);

    const first = fx.open();

    const result =
      first.recordUsage(event());

    assert.equal(
      result.ok,
      true,
      result.reason
    );

    fx.setTime(
      Date.parse("2027-02-01T00:00:00.000Z")
    );

    const second = fx.open();

    const duplicate =
      second.recordUsage(event());

    assert.deepEqual(duplicate, {
      ...result,
      duplicate: true
    });

    assert.equal(
      read(second).monthlyUsedTokens,
      0
    );

    assert.equal(
      read(second).dailyRequests,
      0
    );
  }
);


/*
 * TEST 04 — REQUEST CONFLICT
 */

test(
  "R2.8C4A rejects conflicting request identifiers",
  t => {
    const l = fixture(t).open();

    assert.equal(
      l.recordUsage(event()).ok,
      true
    );

    denied(
      l.recordUsage(
        event(1, { accountId: B })
      ),
      "ai_usage_request_conflict"
    );

    denied(
      l.recordUsage(
        event(1, { outputTokens: 9 })
      ),
      "ai_usage_request_conflict"
    );

    assert.equal(
      read(l).dailyRequests,
      1
    );

    assert.equal(
      read(l, B).dailyUsedTokens,
      0
    );
  }
);


/*
 * TEST 05 — ACCOUNT ISOLATION
 */

test(
  "R2.8C4A isolates accounts and aggregates multiple requests",
  t => {
    const l = fixture(t).open();

    for (const e of [
      event(1),

      event(2, {
        inputTokens: 5,
        outputTokens: 0
      }),

      event(3, {
        accountId: B
      })
    ]) {
      assert.equal(
        l.recordUsage(e).ok,
        true
      );
    }

    assert.equal(
      read(l).dailyUsedTokens,
      37
    );

    assert.equal(
      read(l).dailyRequests,
      2
    );

    assert.equal(
      read(l, B).dailyUsedTokens,
      32
    );

    assert.equal(
      read(l, B).dailyRequests,
      1
    );
  }
);


/*
 * TEST 06 — UTC WINDOW ROLLOVER
 */

test(
  "R2.8C4A resets daily and monthly windows without deleting history",
  t => {
    const fx = fixture(t);

    const l = fx.open();

    assert.equal(
      l.recordUsage(event(1)).ok,
      true
    );

    fx.setTime(
      Date.parse("2027-01-31T00:00:00.000Z")
    );

    assert.equal(
      read(l).dailyUsedTokens,
      0
    );

    assert.equal(
      read(l).monthlyUsedTokens,
      32
    );

    assert.equal(
      l.recordUsage(event(2)).ok,
      true
    );

    assert.equal(
      read(l).dailyUsedTokens,
      32
    );

    assert.equal(
      read(l).monthlyUsedTokens,
      64
    );

    fx.setTime(
      Date.parse("2027-02-01T00:00:00.000Z")
    );

    assert.equal(
      read(l).dailyUsedTokens,
      0
    );

    assert.equal(
      read(l).monthlyUsedTokens,
      0
    );

    assert.equal(
      l.recordUsage(event(1)).duplicate,
      true
    );
  }
);


/*
 * TEST 07 — INVALID INPUT
 */

test(
  "R2.8C4A rejects malformed and foreign fields",
  t => {
    const l = fixture(t).open();

    for (const e of [
      null,
      {},

      event(1, {
        accountId: "bad"
      }),

      event(1, {
        requestId: "bad"
      }),

      event(1, {
        inputTokens: -1
      }),

      event(1, {
        outputTokens: 0.5
      }),

      event(1, {
        inputTokens: 0,
        outputTokens: 0
      }),

      event(1, {
        inputTokens: Number.MAX_SAFE_INTEGER,
        outputTokens: 1
      }),

      event(1, {
        characterId: "lago"
      }),

      event(1, {
        recordedAt: "2020-01-01"
      })
    ]) {
      denied(
        l.recordUsage(e),
        "invalid_ai_usage_request"
      );
    }

    denied(
      l.getUsage("bad"),
      "invalid_ai_usage_account"
    );

    assert.equal(
      read(l).dailyRequests,
      0
    );
  }
);


/*
 * TEST 08 — ACCESSOR PROTECTION
 */

test(
  "R2.8C4A rejects getter and hidden fields",
  t => {
    const l = fixture(t).open();

    let accessed = false;

    const e = event();

    Object.defineProperty(
      e,
      "inputTokens",
      {
        enumerable: true,

        get() {
          accessed = true;
          return 24;
        }
      }
    );

    denied(
      l.recordUsage(e),
      "invalid_ai_usage_request"
    );

    assert.equal(accessed, false);

    const hidden = event();

    Object.defineProperty(
      hidden,
      "extra",
      { value: true }
    );

    denied(
      l.recordUsage(hidden),
      "invalid_ai_usage_request"
    );
  }
);


/*
 * TEST 09 — CLOCK PROTECTION
 */

test(
  "R2.8C4A fails closed for invalid or regressed clock",
  t => {
    const fx = fixture(t);

    const l = fx.open();

    assert.equal(
      l.recordUsage(event()).ok,
      true
    );

    fx.setTime(NaN);

    denied(
      l.getUsage(A),
      "invalid_ai_usage_clock"
    );

    denied(
      l.recordUsage(event(2)),
      "invalid_ai_usage_clock"
    );

    fx.setTime(START - 1);

    denied(
      l.getUsage(A),
      "ai_usage_clock_regressed"
    );

    denied(
      l.recordUsage(event(2)),
      "ai_usage_clock_regressed"
    );

    fx.setTime(START);

    assert.equal(
      read(l).dailyUsedTokens,
      32
    );
  }
);


/*
 * TEST 10 — INTEGER OVERFLOW
 */

test(
  "R2.8C4A fails closed on aggregate integer overflow",
  t => {
    const l = fixture(t).open();

    assert.equal(
      l.recordUsage(
        event(1, {
          inputTokens: Number.MAX_SAFE_INTEGER,
          outputTokens: 0
        })
      ).ok,
      true
    );

    assert.equal(
      l.recordUsage(
        event(2, {
          inputTokens: 1,
          outputTokens: 0
        })
      ).ok,
      true
    );

    const result = l.getUsage(A);

    assert.equal(result.ok, false);

    assert.equal(result.usage, null);
  }
);


/*
 * TEST 11 — PRIVATE DIRECTORY
 */

test(
  "R2.8C4A requires private storage outside project",
  t => {
    const fx = fixture(t);

    assert.throws(
      () => createLagoAIUsageLedger({
        ...fx.config,

        directory: join(
          fx.config.projectRoot,
          "usage"
        )
      }),
      /ai_usage_directory_inside_project/
    );

    assert.throws(
      () => createLagoAIUsageLedger({
        ...fx.config,

        directory: "relative"
      }),
      /absolute_ai_usage_paths_required/
    );

    const l = fx.open();

    assert.equal(
      l.getPolicy().privateDirectoryRequired,
      true
    );

    if (process.platform !== "win32") {
      assert.equal(
        statSync(fx.config.directory).mode &
          0o077,
        0
      );

      assert.equal(
        statSync(
          join(
            fx.config.directory,
            "lago-ai-usage.sqlite"
          )
        ).mode & 0o077,
        0
      );

      l.close();

      chmodSync(
        fx.config.directory,
        0o755
      );

      assert.throws(
        () => fx.open(),
        /insecure_ai_usage_directory/
      );
    }
  }
);


/*
 * TEST 12 — SYMBOLIC LINKS
 */

test(
  "R2.8C4A rejects database symbolic links",
  {
    skip: process.platform === "win32"
  },
  t => {
    const fx = fixture(t);

    const l = fx.open();

    l.close();

    const file = join(
      fx.config.directory,
      "lago-ai-usage.sqlite"
    );

    const target = join(
      fx.root,
      "target.sqlite"
    );

    rmSync(file);

    symlinkSync(target, file);

    assert.throws(
      () => fx.open(),
      /insecure_ai_usage_database/
    );
  }
);


/*
 * TEST 13 — CLOSED LEDGER
 */

test(
  "R2.8C4A closed ledger denies access and never authorizes generation",
  t => {
    const l = fixture(t).open();

    const policy = l.getPolicy();

        assert.equal(
      policy.atomicReservationEnabled,
      true
    );

    assert.equal(
      policy.providerDispatchAuthorized,
      false
    );

    assert.ok(Object.isFrozen(policy));

    l.close();
    l.close();

    denied(
      l.getUsage(A),
      "ai_usage_ledger_closed"
    );

    denied(
      l.recordUsage(event()),
      "ai_usage_ledger_closed"
    );
  }
);

/*
 * LAGO GAME
 * R2.8C5 — ATOMIC RESERVATION TESTS
 */

import { DatabaseSync } from "node:sqlite";

import { Worker } from "node:worker_threads";

import { once } from "node:events";


function reservation(n = 1, changes = {}) {
  return {
    requestId: id(n),

    accountId: A,

    inputTokens: 24,

    maxOutputTokens: 8,

    ...changes
  };
}

const RESERVATION_LIMITS = Object.freeze({
  dailyTokens: 64,

  monthlyTokens: 128,

  dailyRequests: 3,

  maxInputTokens: 4096,

  maxOutputTokens: 1024
});

function reservationFixture(t, changes = {}) {
  const fx = fixture(t);

  fx.config.limits = {
    ...RESERVATION_LIMITS,
    ...changes
  };

  return fx;
}


/*
 * TEST 01 — COMPLETED + RESERVED USAGE
 */

test(
  "R2.8C5 reserves maximum output and counts completed usage",
  t => {
    const l =
      reservationFixture(t).open();

    assert.equal(
      l.recordUsage(event(1)).ok,
      true
    );

    const r =
      l.reserveUsage(reservation(2));

    assert.equal(r.ok, true, r.reason);

    assert.equal(
      r.reservationCreated,
      true
    );

    assert.equal(r.estimatedTokens, 32);

    assert.equal(
      r.providerDispatchAuthorized,
      false
    );

    assert.equal(
      r.tradingAuthorized,
      false
    );

    assert.ok(Object.isFrozen(r));

    const usage = read(l);

    assert.equal(
      usage.dailyUsedTokens,
      32
    );

    assert.equal(
      usage.dailyReservedTokens,
      32
    );

    assert.equal(
      usage.monthlyReservedTokens,
      32
    );

    assert.equal(
      usage.dailyReservedRequests,
      1
    );

    denied(
      l.reserveUsage(reservation(3)),

      "ai_daily_token_budget_exceeded"
    );
  }
);


/*
 * TEST 02 — SHARED QUOTA
 */

test(
  "R2.8C5 competing connections share one quota",
  t => {
    const fx = reservationFixture(t, {
      dailyTokens: 32
    });

    const first = fx.open();

    const second = fx.open();

    assert.equal(
      first.reserveUsage(
        reservation(1)
      ).ok,
      true
    );

    denied(
      second.reserveUsage(
        reservation(2)
      ),

      "ai_daily_token_budget_exceeded"
    );

    assert.equal(
      read(second).dailyReservedTokens,
      32
    );
  }
);


/*
 * TEST 03 — RESERVATION IDEMPOTENCY
 */

test(
  "R2.8C5 retries are idempotent after reopening",
  t => {
    const fx = reservationFixture(t);

    const l = fx.open();

    const first =
      l.reserveUsage(reservation());

    assert.equal(
      first.ok,
      true,
      first.reason
    );

    l.close();

    const next = fx.open();

    assert.deepEqual(
      next.reserveUsage(reservation()),

      {
        ...first,

        duplicate: true,

        reservationCreated: false
      }
    );

    assert.equal(
      read(next).dailyReservedRequests,
      1
    );
  }
);


/*
 * TEST 04 — ACCOUNT ISOLATION
 */

test(
  "R2.8C5 denies cross-account and changed reservation replay",
  t => {
    const l =
      reservationFixture(t).open();

    assert.equal(
      l.reserveUsage(reservation()).ok,
      true
    );

    denied(
      l.reserveUsage(
        reservation(1, {
          accountId: B
        })
      ),

      "ai_usage_request_conflict"
    );

    denied(
      l.reserveUsage(
        reservation(1, {
          maxOutputTokens: 9
        })
      ),

      "ai_usage_request_conflict"
    );

    assert.equal(
      l.reserveUsage(
        reservation(2, {
          accountId: B
        })
      ).ok,
      true
    );

    assert.equal(
      read(l).dailyReservedTokens,
      32
    );

    assert.equal(
      read(l, B).dailyReservedTokens,
      32
    );
  }
);


/*
 * TEST 05 — CROSS-TABLE REPLAY
 */

test(
  "R2.8C5 denies recording reserved IDs and reserving recorded IDs",
  t => {
    const l =
      reservationFixture(t).open();

    assert.equal(
      l.recordUsage(event(1)).ok,
      true
    );

    denied(
      l.reserveUsage(reservation(1)),

      "ai_usage_request_conflict"
    );

    assert.equal(
      l.reserveUsage(reservation(2)).ok,
      true
    );

    denied(
      l.recordUsage(event(2)),

      "ai_usage_request_reserved"
    );

    assert.equal(
      read(l).dailyUsedTokens,
      32
    );

    assert.equal(
      read(l).dailyReservedTokens,
      32
    );
  }
);


/*
 * TEST 06 — UTC ROLLOVER
 */

test(
  "R2.8C5 carries pending reservations across UTC windows",
  t => {
    const fx = reservationFixture(t, {
      dailyTokens: 32
    });

    const l = fx.open();

    assert.equal(
      l.reserveUsage(reservation()).ok,
      true
    );

    fx.setTime(
      Date.parse(
        "2027-02-01T00:00:00.000Z"
      )
    );

    const usage = read(l);

    assert.equal(
      usage.monthlyKey,
      "2027-02"
    );

    assert.equal(
      usage.dailyReservedTokens,
      32
    );

    assert.equal(
      usage.monthlyReservedTokens,
      32
    );

    denied(
      l.reserveUsage(reservation(2)),

      "ai_daily_token_budget_exceeded"
    );
  }
);


/*
 * TEST 07 — REQUEST AND MONTHLY LIMITS
 */

test(
  "R2.8C5 enforces daily request and monthly quota",
  t => {
    const l = reservationFixture(t, {
      dailyRequests: 1
    }).open();

    assert.equal(
      l.reserveUsage(reservation()).ok,
      true
    );

    denied(
      l.reserveUsage(reservation(2)),

      "ai_daily_request_quota_exceeded"
    );

    const fx = reservationFixture(t, {
      dailyTokens: 64,

      monthlyTokens: 64
    });

    const m = fx.open();

    assert.equal(
      m.recordUsage(
        event(1, {
          inputTokens: 48,

          outputTokens: 0
        })
      ).ok,
      true
    );

    fx.setTime(
      Date.parse(
        "2027-01-31T00:00:00.000Z"
      )
    );

    denied(
      m.reserveUsage(reservation(2)),

      "ai_monthly_token_budget_exceeded"
    );
  }
);


/*
 * TEST 08 — MALFORMED INPUT AND CLOCK
 */

test(
  "R2.8C5 rejects invalid input and regressed clock",
  t => {
    const fx = reservationFixture(t);

    const l = fx.open();

    for (const value of [
      null,

      {},

      reservation(1, {
        inputTokens: 0
      }),

      reservation(1, {
        maxOutputTokens: 1025
      }),

      reservation(1, {
        accountId: "bad"
      }),

      reservation(1, {
        usage: {}
      })
    ]) {
      denied(
        l.reserveUsage(value),

        "invalid_ai_reservation_request"
      );
    }

    assert.equal(
      l.reserveUsage(reservation()).ok,
      true
    );

    fx.setTime(START - 1);

    denied(
      l.reserveUsage(reservation(2)),

      "ai_usage_clock_regressed"
    );

    fx.setTime(NaN);

    denied(
      l.reserveUsage(reservation(2)),

      "invalid_ai_usage_clock"
    );

    l.close();

    denied(
      l.reserveUsage(reservation(2)),

      "ai_usage_ledger_closed"
    );
  }
);


/*
 * TEST 09 — DATABASE MIGRATION
 */

test(
  "R2.8C5 migrates schema v1 without deleting usage",
  t => {
    const fx = fixture(t);

    const first = fx.open();

    assert.equal(
      first.recordUsage(event()).ok,
      true
    );

    first.close();

    const db = new DatabaseSync(
      join(
        fx.config.directory,

        "lago-ai-usage.sqlite"
      )
    );

    try {
      db.exec(`
        DROP TABLE ai_usage_reservations;

        PRAGMA user_version = 1;
      `);

    } finally {
      db.close();
    }

    const next = fx.open();

    assert.equal(
      read(next).dailyUsedTokens,
      32
    );

    assert.equal(
      next.reserveUsage(
        reservation(2)
      ).ok,
      true
    );

    assert.equal(
      read(next).dailyReservedTokens,
      32
    );
  }
);


/*
 * TEST 10 — REAL CONCURRENT WORKERS
 */

test(
  "R2.8C5 two workers cannot reserve the same remaining quota",

  { timeout: 15000 },

  async t => {
    const fx = fixture(t);

    fx.open().close();

    const workers = [1, 2].map(
      n => new Worker(`

        const {
          parentPort,
          workerData
        } = require("node:worker_threads");

        (async () => {
          const {
            createLagoAIUsageLedger

          } = await import(workerData.url);

          const ledger =
            createLagoAIUsageLedger({
              ...workerData.config,

              now: () => workerData.now
            });

          parentPort.once("message", () => {
            try {
              parentPort.postMessage(
                ledger.reserveUsage(
                  workerData.request
                )
              );

            } finally {
              ledger.close();
            }
          });

          parentPort.postMessage("ready");

        })().catch(error => {
          throw error;
        });

      `, {
        eval: true,

        workerData: {
          url: new URL(
            "./lago-agent-ai-usage-ledger.mjs",

            import.meta.url
          ).href,

          config: {
            directory:
              fx.config.directory,

            projectRoot:
              fx.config.projectRoot,

            limits: {
              ...RESERVATION_LIMITS,

              dailyTokens: 32
            }
          },

          now: START,

          request: reservation(n)
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
        results.filter(
          r => r.ok
        ).length,

        1
      );

      assert.equal(
        results.filter(
          r => r.reservationCreated
        ).length,

        1
      );

      denied(
        results.find(r => !r.ok),

        "ai_daily_token_budget_exceeded"
      );

      assert.equal(
        read(fx.open()).dailyReservedTokens,

        32
      );

    } finally {
      await Promise.all(
        workers.map(
          w => w.terminate()
        )
      );
    }
  }
);

/*
 * LAGO GAME
 * R2.8C5A
 * SETTLEMENT AND RECOVERY TESTS
 */

function lifecycleInput(
  n = 1,
  accountId = A
) {
  return {
    requestId: id(n),

    accountId
  };
}

function reserveAndDispatch(
  ledger,
  n = 1
) {
  const reserved =
    ledger.reserveUsage(
      reservation(n)
    );

  assert.equal(
    reserved.ok,
    true,
    reserved.reason
  );

  const dispatched =
    ledger.markDispatched(
      lifecycleInput(n)
    );

  assert.equal(
    dispatched.ok,
    true,
    dispatched.reason
  );

  assert.equal(
    dispatched.state,
    "dispatched"
  );

  return dispatched;
}


/*
 * TEST 01 — SINGLE DISPATCH CLAIM
 */

test(
  "R2.8C5A dispatch claim is single-use across connections",
  t => {
    const fx = reservationFixture(t);

    const first = fx.open();

    const second = fx.open();

    reserveAndDispatch(first);

    denied(
      second.markDispatched(
        lifecycleInput()
      ),

      "ai_reservation_invalid_state"
    );

    denied(
      second.reserveUsage(
        reservation()
      ),

      "ai_reservation_already_processed"
    );

    assert.equal(
      read(second).dailyReservedTokens,
      32
    );
  }
);


/*
 * TEST 02 — EXACT SETTLEMENT
 */

test(
  "R2.8C5A atomically replaces reservation with actual usage",
  t => {
    const l =
      reservationFixture(t).open();

    reserveAndDispatch(l);

    const result = l.settleUsage(
      event(1, {
        inputTokens: 24,

        outputTokens: 3
      })
    );

    assert.equal(
      result.ok,
      true,
      result.reason
    );

    assert.equal(result.settled, true);

    assert.equal(result.state, "settled");

    assert.equal(
      result.estimatedTokens,
      32
    );

    assert.equal(
      result.actualTokens,
      27
    );

    assert.equal(
      result.releasedTokens,
      5
    );

    assert.equal(
      result.exceededReservation,
      false
    );

    assert.equal(
      result.providerDispatchAuthorized,
      false
    );

    const usage = read(l);

    assert.equal(
      usage.dailyUsedTokens,
      27
    );

    assert.equal(
      usage.monthlyUsedTokens,
      27
    );

    assert.equal(
      usage.dailyReservedTokens,
      0
    );

    assert.equal(
      usage.monthlyReservedTokens,
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
  }
);


/*
 * TEST 03 — IDEMPOTENT SETTLEMENT
 */

test(
  "R2.8C5A exact settlement retry cannot double charge",
  t => {
    const fx = reservationFixture(t);

    const l = fx.open();

    reserveAndDispatch(l);

    const first =
      l.settleUsage(event());

    assert.equal(
      first.ok,
      true,
      first.reason
    );

    l.close();

    const next = fx.open();

    const duplicate =
      next.settleUsage(event());

    assert.deepEqual(
      duplicate,

      {
        ...first,

        duplicate: true
      }
    );

    denied(
      next.settleUsage(
        event(1, {
          outputTokens: 7
        })
      ),

      "ai_usage_request_conflict"
    );

    assert.equal(
      read(next).dailyUsedTokens,
      32
    );

    assert.equal(
      read(next).dailyRequests,
      1
    );
  }
);


/*
 * TEST 04 — SAFE CANCELLATION
 */

test(
  "R2.8C5A cancellation releases only undispatched reservations",
  t => {
    const l = reservationFixture(t, {
      dailyTokens: 32
    }).open();

    assert.equal(
      l.reserveUsage(
        reservation()
      ).ok,
      true
    );

    const cancelled =
      l.cancelReservation(
        lifecycleInput()
      );

    assert.equal(
      cancelled.ok,
      true,
      cancelled.reason
    );

    assert.equal(
      cancelled.state,
      "cancelled"
    );

    assert.equal(
      read(l).dailyReservedTokens,
      0
    );

    assert.equal(
      read(l).dailyUsedTokens,
      0
    );

    assert.equal(
      l.cancelReservation(
        lifecycleInput()
      ).duplicate,

      true
    );

    denied(
      l.markDispatched(
        lifecycleInput()
      ),

      "ai_reservation_invalid_state"
    );

    denied(
      l.reserveUsage(
        reservation()
      ),

      "ai_reservation_already_processed"
    );

    reserveAndDispatch(l, 2);
  }
);


/*
 * TEST 05 — NO CANCELLATION
 * AFTER DISPATCH
 */

test(
  "R2.8C5A never releases dispatched usage through cancellation",
  t => {
    const l =
      reservationFixture(t).open();

    reserveAndDispatch(l);

    denied(
      l.cancelReservation(
        lifecycleInput()
      ),

      "ai_reservation_invalid_state"
    );

    assert.equal(
      read(l).dailyReservedTokens,
      32
    );
  }
);


/*
 * TEST 06 — UNCERTAIN PROVIDER OUTCOME
 */

test(
  "R2.8C5A uncertain usage remains reserved across restart and rollover",
  t => {
    const fx = reservationFixture(t);

    const l = fx.open();

    reserveAndDispatch(l);

    const uncertain =
      l.markUncertain(
        lifecycleInput()
      );

    assert.equal(
      uncertain.ok,
      true,
      uncertain.reason
    );

    assert.equal(
      uncertain.state,
      "uncertain"
    );

    l.close();

    fx.setTime(
      Date.parse(
        "2027-02-01T00:00:00.000Z"
      )
    );

    const next = fx.open();

    assert.equal(
      read(next).dailyReservedTokens,
      32
    );

    assert.equal(
      read(next).monthlyReservedTokens,
      32
    );

    const recovery =
      next.listPendingReservations(A);

    assert.equal(recovery.ok, true);

    assert.equal(
      recovery.reservations.length,
      1
    );

    assert.equal(
      recovery.reservations[0].state,
      "uncertain"
    );

    denied(
      next.cancelReservation(
        lifecycleInput()
      ),

      "ai_reservation_invalid_state"
    );

    const settled =
      next.settleUsage(event());

    assert.equal(
      settled.ok,
      true,
      settled.reason
    );

    assert.equal(
      read(next).dailyUsedTokens,
      32
    );

    assert.equal(
      read(next).dailyReservedTokens,
      0
    );
  }
);


/*
 * TEST 07 — ACTUAL USAGE OVERAGE
 */

test(
  "R2.8C5A records verified usage even above reservation",
  t => {
    const l =
      reservationFixture(t).open();

    reserveAndDispatch(l);

    const result =
      l.settleUsage(
        event(1, {
          outputTokens: 16
        })
      );

    assert.equal(
      result.ok,
      true,
      result.reason
    );

    assert.equal(
      result.exceededReservation,
      true
    );

    assert.equal(
      result.actualTokens,
      40
    );

    assert.equal(
      result.releasedTokens,
      0
    );

    assert.equal(
      read(l).dailyUsedTokens,
      40
    );

    assert.equal(
      read(l).dailyReservedTokens,
      0
    );
  }
);


/*
 * TEST 08 — ACCOUNT ISOLATION
 */

test(
  "R2.8C5A rejects foreign lifecycle and settlement operations",
  t => {
    const l =
      reservationFixture(t).open();

    reserveAndDispatch(l);

    denied(
      l.markUncertain(
        lifecycleInput(1, B)
      ),

      "ai_reservation_not_found"
    );

    denied(
      l.settleUsage(
        event(1, {
          accountId: B
        })
      ),

      "ai_reservation_not_found"
    );

    assert.equal(
      l.listPendingReservations(B)
        .reservations.length,

      0
    );

    assert.equal(
      read(l).dailyReservedTokens,
      32
    );

    assert.equal(
      read(l, B).dailyUsedTokens,
      0
    );
  }
);


/*
 * TEST 09 — INVALID TRANSITIONS
 */

test(
  "R2.8C5A rejects settlement before dispatch and invalid input",
  t => {
    const l =
      reservationFixture(t).open();

    assert.equal(
      l.reserveUsage(
        reservation()
      ).ok,
      true
    );

    denied(
      l.settleUsage(event()),

      "ai_reservation_invalid_state"
    );

    denied(
      l.markUncertain(
        lifecycleInput()
      ),

      "ai_reservation_invalid_state"
    );

    denied(
      l.markDispatched({
        ...lifecycleInput(),

        state: "dispatched"
      }),

      "invalid_ai_lifecycle_request"
    );

    assert.equal(
      l.markDispatched(
        lifecycleInput()
      ).ok,

      true
    );

    denied(
      l.settleUsage(
        event(1, {
          outputTokens: -1
        })
      ),

      "invalid_ai_settlement_request"
    );

    assert.equal(
      read(l).dailyReservedTokens,
      32
    );
  }
);


/*
 * TEST 10 — CLOCK AND TERMINAL HISTORY
 */

test(
  "R2.8C5A terminal state retains clock regression protection",
  t => {
    const fx =
      reservationFixture(t);

    const l = fx.open();

    assert.equal(
      l.reserveUsage(
        reservation()
      ).ok,

      true
    );

    fx.setTime(START + 1000);

    assert.equal(
      l.cancelReservation(
        lifecycleInput()
      ).ok,

      true
    );

    fx.setTime(START);

    denied(
      l.reserveUsage(
        reservation(2)
      ),

      "ai_usage_clock_regressed"
    );

    fx.setTime(START + 1000);

    assert.equal(
      read(l).dailyReservedTokens,
      0
    );
  }
);


/*
 * TEST 11 — RECOVERY AFTER REOPEN
 */

test(
  "R2.8C5A recovery lists unfinished requests without releasing them",
  t => {
    const fx =
      reservationFixture(t);

    const l = fx.open();

    assert.equal(
      l.reserveUsage(
        reservation(1)
      ).ok,
      true
    );

    reserveAndDispatch(l, 2);

    l.close();

    const next = fx.open();

    const recovery =
      next.listPendingReservations(A);

    assert.equal(
      recovery.ok,
      true
    );

    assert.deepEqual(
      recovery.reservations.map(
        r => r.state
      ),

      [
        "reserved",
        "dispatched"
      ]
    );

    assert.equal(
      read(next).dailyReservedTokens,
      64
    );

    assert.equal(
      recovery.providerDispatchAuthorized,
      false
    );

    assert.ok(
      Object.isFrozen(
        recovery.reservations
      )
    );
  }
);


/*
 * TEST 12 — V2 SCHEMA MIGRATION
 */

test(
  "R2.8C5A migrates v2 and preserves unfinished reservations",
  t => {
    const fx = fixture(t);

    fx.open().close();

    const db = new DatabaseSync(
      join(
        fx.config.directory,

        "lago-ai-usage.sqlite"
      )
    );

    try {
      db.exec(`
        DROP TABLE ai_usage_reservations;

        CREATE TABLE ai_usage_reservations (
          request_id TEXT PRIMARY KEY NOT NULL,
          account_id TEXT NOT NULL,
          reserved_at_ms INTEGER NOT NULL,
          input_tokens INTEGER NOT NULL,
          max_output_tokens INTEGER NOT NULL
        ) STRICT;

        CREATE INDEX
          ai_usage_reservations_account_idx

        ON ai_usage_reservations(account_id);

        PRAGMA user_version = 2;
      `);

      db.prepare(`
        INSERT INTO ai_usage_reservations
        VALUES (?, ?, ?, ?, ?)
      `).run(
        id(1),

        A,

        START,

        24,

        8
      );

    } finally {
      db.close();
    }

    const next = fx.open();

    assert.equal(
      read(next).dailyReservedTokens,
      32
    );

    const recovery =
      next.listPendingReservations(A);

    assert.equal(
      recovery.reservations[0].state,

      "reserved"
    );

    assert.equal(
      next.markDispatched(
        lifecycleInput()
      ).ok,

      true
    );

    assert.equal(
      next.settleUsage(event()).ok,

      true
    );

    assert.equal(
      read(next).dailyUsedTokens,
      32
    );
  }
);

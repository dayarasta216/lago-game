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
      false
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

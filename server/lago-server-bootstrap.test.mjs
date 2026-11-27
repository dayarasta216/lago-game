import test from "node:test";
import assert from "node:assert/strict";

import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { once } from "node:events";

import {
  mkdtemp,
  mkdir,
  readdir,
  copyFile,
  stat,
  chmod,
  rm
} from "node:fs/promises";

import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import { DatabaseSync } from "node:sqlite";

import {
  createLagoAccountSessionStore
} from "./lago-account-session-store.mjs";

import {
  createLagoSubscriptionLedger
} from "./lago-agent-subscription-ledger.mjs";

import {
  SUBSCRIPTION_POLICY
} from "./lago-agent-subscription-contract.mjs";

/*
 * LAGO GAME
 * R2.7G1 — SERVER BOOTSTRAP TESTS
 *
 * Real isolated Node.js processes.
 * Real HTTP requests.
 * Real SQLite databases.
 * Real account sessions.
 *
 * No production accounts.
 * No real blockchain transactions.
 * No external network requests.
 */

const SOURCE_DIRECTORY = fileURLToPath(
  new URL("./", import.meta.url)
);

const SIGNATURE = "1".repeat(63) + "2";

const QUOTE_ID = "a".repeat(32);

const PAYER = "1".repeat(31) + "2";

const TREASURY = "1".repeat(31) + "3";

const POLICY = SUBSCRIPTION_POLICY;

const STATE_PATH = "/api/subscription/state";

const QUOTE_PATH = "/api/subscription/quote";

const CONFIRM_PATH = "/api/subscription/confirm";

const TIMEOUT_MS = 10000;


/*
 * BOUNDED ASYNC OPERATION
 */

async function within(
  promise,
  timeout = TIMEOUT_MS
) {

  let timer;

  try {

    return await Promise.race([

      promise,

      new Promise((_, reject) => {

        timer = setTimeout(() => {

          reject(
            new Error("bootstrap_test_timeout")
          );

        }, timeout);

      })

    ]);

  } finally {

    clearTimeout(timer);

  }

}


/*
 * RESERVE AVAILABLE LOCAL PORT
 */

async function reservePort() {

  const socket = createServer();

  const listening = once(socket, "listening");

  socket.listen(0, "127.0.0.1");

  await listening;

  return {

    port: socket.address().port,

    async close() {

      if (socket.listening) {

        await new Promise((resolve, reject) => {

          socket.close(error => {

            if (error) {
              reject(error);
            } else {
              resolve();
            }

          });

        });

      }

    }

  };

}


/*
 * ISOLATED SERVER FIXTURE
 */

async function fixture(t) {

  const root = await mkdtemp(
    join(tmpdir(), "lago-bootstrap-test-")
  );

  const projectRoot = join(root, "project");

  const serverDirectory = join(
    projectRoot,
    "server"
  );

  const paymentDirectory = join(
    root,
    "private-payments"
  );

  const children = [];

  const reservations = [];

  t.after(async () => {

    for (const processHandle of children) {

      if (!processHandle.finished) {

        processHandle.child.kill("SIGKILL");

      }

      await within(
        processHandle.done
      );

    }

    for (const reservation of reservations) {

      await reservation.close();

    }

    await rm(root, {
      recursive: true,
      force: true
    });

  });

  await mkdir(serverDirectory, {
    recursive: true
  });


  /*
   * Copy server modules only.
   *
   * Never copy runtime data,
   * existing accounts or secrets.
   */

  const entries = await readdir(
    SOURCE_DIRECTORY,
    { withFileTypes: true }
  );

  for (const entry of entries) {

    if (

      entry.isFile() &&

      entry.name.endsWith(".mjs") &&

      !entry.name.endsWith(".test.mjs")

    ) {

      await copyFile(

        join(
          SOURCE_DIRECTORY,
          entry.name
        ),

        join(
          serverDirectory,
          entry.name
        )

      );

    }

  }


  /*
   * SEED ISOLATED ACCOUNT STORE
   */

  const sessions =
    createLagoAccountSessionStore({

      filePath: join(
        serverDirectory,
        "data",
        "lago-auth.json"
      )

    });

  async function createPlayer(id) {

    const result =
      await sessions.upsertVerifiedTelegramUser({

        id,

        username: "synthetic_" + id

      });

    assert.equal(result.ok, true);

    const accountId =
      result.account.accountId;

    const session =
      await sessions.createSession(

        accountId,

        { ttlSeconds: 3600 }

      );

    assert.equal(session.ok, true);

    return {

      accountId,

      token: session.token

    };

  }

  const playerA =
    await createPlayer("100001");

  const playerB =
    await createPlayer("100002");


  /*
   * START REAL SERVER PROCESS
   */

  async function launch({

    directory = paymentDirectory,

    port = null,

    env = {},

    expectReady = true

  } = {}) {

    if (port === null) {

      const reservation =
        await reservePort();

      reservations.push(reservation);

      port = reservation.port;

      await reservation.close();

    }

    /*
     * Explicit test environment.
     *
     * Production secrets and Node
     * preload options are not inherited.
     */

    const childEnv = {

      PATH: process.env.PATH || "",

      NODE_ENV: "test",

      LAGO_HOST: "127.0.0.1",

      PORT: String(port),

      LAGO_TELEGRAM_BOT_TOKEN: "",

      LAGO_COOKIE_SECURE: "0",

      LAGO_PAYMENT_DATA_DIR:
        directory || "",

      ...env

    };

    if (process.platform === "win32") {

      childEnv.SystemRoot =
        process.env.SystemRoot || "";

    }

    const child = spawn(

      process.execPath,

      [
        join(serverDirectory, "server.mjs")
      ],

      {

        cwd: projectRoot,

        env: childEnv,

        stdio: [
          "ignore",
          "pipe",
          "pipe"
        ]

      }

    );

    const handle = {

      child,

      stdout: "",

      stderr: "",

      finished: false,

      origin:
        "http://127.0.0.1:" + port

    };

    children.push(handle);

    child.stdout.setEncoding("utf8");

    child.stderr.setEncoding("utf8");

    child.stdout.on("data", chunk => {

      handle.stdout += chunk;

    });

    child.stderr.on("data", chunk => {

      handle.stderr += chunk;

    });

    handle.done = new Promise(resolve => {

      child.once("close", (code, signal) => {

        handle.finished = true;

        resolve({

          code,

          signal

        });

      });

      child.once("error", error => {

        handle.stderr += String(error);

      });

    });


    /*
     * Await actual startup marker.
     */

    if (expectReady) {

      const deadline =
        Date.now() + TIMEOUT_MS;

      while (

        !handle.stdout.includes(
          "Live trading: DISABLED"
        )

      ) {

        if (handle.finished) {

          throw new Error(

            "bootstrap_process_exited: " +
            handle.stderr

          );

        }

        if (Date.now() >= deadline) {

          throw new Error(
            "bootstrap_startup_timeout"
          );

        }

        await delay(20);

      }

    }


    /*
     * REAL HTTP CLIENT
     */

    handle.request = async (

      path,

      {

        method = "GET",

        token = playerA.token,

        body

      } = {}

    ) => {

      const headers = {

        Accept: "application/json"

      };

      if (token) {

        headers.Cookie =
          "lago_session=" + token;

      }

      if (method === "POST") {

        headers.Origin =
          handle.origin;

        headers["Sec-Fetch-Site"] =
          "same-origin";

        headers["Content-Type"] =
          "application/json";

      }

      const response = await fetch(

        handle.origin + path,

        {

          method,

          headers,

          body: body === undefined

            ? undefined

            : JSON.stringify(body),

          redirect: "manual",

          signal:
            AbortSignal.timeout(5000)

        }

      );

      return {

        status: response.status,

        headers: response.headers,

        data: await response.json()

      };

    };


    handle.stop = async (
      signal = "SIGTERM"
    ) => {

      if (!handle.finished) {

        child.kill(signal);

      }

      return within(handle.done);

    };

    return handle;

  }


  /*
   * CREATE TEST-ONLY SUBSCRIPTION
   */

  async function seedPayment(
    player = playerA
  ) {

    const ledger =
      createLagoSubscriptionLedger({

        directory: paymentDirectory,

        projectRoot,

        async verifyPayment(request) {

          return {

            ...request,

            serverVerified: true,

            confirmationStatus: "finalized",

            product: POLICY.product,

            chain: POLICY.chain,

            network: POLICY.network,

            tokenMint: POLICY.tokenMint,

            payerWallet: PAYER,

            treasuryWallet: TREASURY,

            amountBaseUnits: "1000000"

          };

        }

      });

    try {

      const result =
        await ledger.applyPayment({

          accountId: player.accountId,

          quoteId: QUOTE_ID,

          transactionSignature: SIGNATURE

        });

      assert.equal(result.ok, true);

      return result;

    } finally {

      ledger.close();

    }

  }


  return {

    root,

    projectRoot,

    paymentDirectory,

    playerA,

    playerB,

    launch,

    seedPayment,

    async reservePort() {

      const reservation =
        await reservePort();

      reservations.push(reservation);

      return reservation;

    }

  };

}


/*
 * ASSERTIONS
 */

function assertError(
  result,
  status,
  reason
) {

  assert.equal(result.status, status);

  assert.equal(result.data.ok, false);

  assert.equal(result.data.error, reason);

  assert.equal(

    result.headers.get("cache-control"),

    "no-store"

  );

}


function assertLocked(subscription) {

  for (const field of [

    "serverVerified",

    "entitled",

    "aiEnabled",

    "chatEnabled",

    "memoryEnabled",

    "learningEnabled",

    "marketAnalysisEnabled",

    "tradingEnabled",

    "tradingAuthorized"

  ]) {

    assert.equal(

      subscription[field],

      false,

      field

    );

  }

}


/*
 * TEST 01 — DEFAULT SERVER
 */

test("starts without payment storage and keeps subscription routes disabled", async t => {

  const fx = await fixture(t);

  const server = await fx.launch({

    directory: ""

  });

  assert.match(

    server.stdout,

    /Subscription storage: NOT CONFIGURED/

  );

  const health = await server.request(
    "/api/health"
  );

  assert.equal(health.status, 200);

  assert.equal(
    health.data.authConfigured,
    false
  );

  assertError(

    await server.request(STATE_PATH),

    503,

    "subscription_service_unavailable"

  );

  await assert.rejects(

    stat(fx.paymentDirectory),

    { code: "ENOENT" }

  );

});


/*
 * TEST 02 — PRIVATE DATABASES
 */

test("creates subscription databases outside the project", async t => {

  const fx = await fixture(t);

  const server = await fx.launch();

  assert.match(

    server.stdout,

    /Subscription storage: READY/

  );

  const directory = await stat(
    fx.paymentDirectory
  );

  assert.equal(
    directory.isDirectory(),
    true
  );

  if (process.platform !== "win32") {

    assert.equal(
      directory.mode & 0o077,
      0
    );

  }

  for (const filename of [

    "lago-subscriptions.sqlite",

    "lago-payment-quotes.sqlite"

  ]) {

    const info = await stat(

      join(
        fx.paymentDirectory,
        filename
      )

    );

    assert.equal(info.isFile(), true);

    assert.equal(info.nlink, 1);

    if (process.platform !== "win32") {

      assert.equal(
        info.mode & 0o077,
        0
      );

    }

  }

});


/*
 * TEST 03 — REAL SESSION STATE
 */

test("returns subscription state using real persisted account authentication", async t => {

  const fx = await fixture(t);

  const server = await fx.launch();

  const result = await server.request(
    STATE_PATH
  );

  assert.equal(result.status, 200);

  assert.equal(result.data.ok, true);

  const subscription =
    result.data.subscription;

  assert.equal(

    subscription.accountId,

    fx.playerA.accountId

  );

  assert.equal(
    subscription.status,
    "inactive"
  );

  assertLocked(subscription);

  assert.equal(

    subscription.reason,

    "subscription_entitlement_disabled"

  );

});


/*
 * TEST 04 — INVALID SESSION
 */

test("rejects missing and invalid sessions in the real server process", async t => {

  const fx = await fixture(t);

  const server = await fx.launch();

  for (const token of [

    "",

    "invalid-session"

  ]) {

    assertError(

      await server.request(

        STATE_PATH,

        { token }

      ),

      401,

      "authentication_required"

    );

  }

});


/*
 * TEST 05 — PAYMENT DISABLED
 */

test("keeps quote issuance and payment confirmation disabled", async t => {

  const fx = await fixture(t);

  const server = await fx.launch();

  assertError(

    await server.request(

      QUOTE_PATH,

      {

        method: "POST",

        body: {}

      }

    ),

    503,

    "payment_configuration_unavailable"

  );

  assertError(

    await server.request(

      CONFIRM_PATH,

      {

        method: "POST",

        body: {

          quoteId: QUOTE_ID,

          transactionSignature: SIGNATURE

        }

      }

    ),

    503,

    "subscription_service_unavailable"

  );

  const db = new DatabaseSync(

    join(

      fx.paymentDirectory,

      "lago-subscriptions.sqlite"

    ),

    { readOnly: true }

  );

  try {

    const payments = db.prepare(`

      SELECT COUNT(*) AS total

      FROM subscription_payments

    `).get().total;

    const claims = db.prepare(`

      SELECT COUNT(*) AS total

      FROM payment_claims

    `).get().total;

    assert.equal(payments, 0);

    assert.equal(claims, 0);

  } finally {

    db.close();

  }

});


/*
 * TEST 06 — ACCOUNT ISOLATION
 */

test("isolates recorded subscription state between authenticated accounts", async t => {

  const fx = await fixture(t);

  await fx.seedPayment(fx.playerA);

  const server = await fx.launch();

  const [a, b] = await Promise.all([

    server.request(

      STATE_PATH,

      { token: fx.playerA.token }

    ),

    server.request(

      STATE_PATH,

      { token: fx.playerB.token }

    )

  ]);

  assert.equal(a.status, 200);

  assert.equal(b.status, 200);

  assert.equal(

    a.data.subscription.accountId,

    fx.playerA.accountId

  );

  assert.equal(

    b.data.subscription.accountId,

    fx.playerB.accountId

  );

  assert.equal(

    a.data.subscription.status,

    "active"

  );

  assert.equal(

    b.data.subscription.status,

    "inactive"

  );

  assertLocked(a.data.subscription);

  assertLocked(b.data.subscription);

});


/*
 * TEST 07 — RESTART PERSISTENCE
 */

test("preserves subscription history and global claims after server restart", {

  skip: process.platform === "win32"

}, async t => {

  const fx = await fixture(t);

  const payment = await fx.seedPayment();

  const first = await fx.launch();

  const initial = await first.request(
    STATE_PATH
  );

  assert.equal(initial.status, 200);

  assert.equal(

    (await first.stop()).code,

    0

  );

  const restarted = await fx.launch();

  const restored = await restarted.request(
    STATE_PATH
  );

  assert.equal(restored.status, 200);

  assert.equal(

    restored.data.subscription.currentPeriodStart,

    payment.period.currentPeriodStart

  );

  assert.equal(

    restored.data.subscription.currentPeriodEnd,

    payment.period.currentPeriodEnd

  );

  assertLocked(
    restored.data.subscription
  );

  const db = new DatabaseSync(

    join(

      fx.paymentDirectory,

      "lago-subscriptions.sqlite"

    ),

    { readOnly: true }

  );

  try {

    const claim = db.prepare(`

      SELECT account_id, quote_id, product

      FROM payment_claims

      WHERE transaction_signature = ?

    `).get(SIGNATURE);

    assert.equal(
      claim.account_id,
      fx.playerA.accountId
    );

    assert.equal(
      claim.quote_id,
      QUOTE_ID
    );

    assert.equal(
      claim.product,
      POLICY.product
    );

  } finally {

    db.close();

  }

});


/*
 * TEST 08 — RELATIVE DIRECTORY
 */

test("rejects relative payment storage configuration", async t => {

  const fx = await fixture(t);

  const server = await fx.launch({

    directory: "relative-payments",

    expectReady: false

  });

  const result = await within(
    server.done
  );

  assert.equal(result.code, 1);

  assert.match(

    server.stderr,

    /absolute_payment_directory_required/

  );

  assert.doesNotMatch(

    server.stdout,

    /Subscription storage: READY/

  );

});


/*
 * TEST 09 — PROJECT DIRECTORY
 */

test("rejects payment storage inside the public project", async t => {

  const fx = await fixture(t);

  const directory = join(

    fx.projectRoot,

    "unsafe-payment-data"

  );

  const server = await fx.launch({

    directory,

    expectReady: false

  });

  const result = await within(
    server.done
  );

  assert.equal(result.code, 1);

  assert.match(

    server.stderr,

    /subscription_bootstrap_failed/

  );

  await assert.rejects(

    stat(directory),

    { code: "ENOENT" }

  );

});


/*
 * TEST 10 — INSECURE PERMISSIONS
 */

test("rejects payment directories with insecure permissions", {

  skip: process.platform === "win32"

}, async t => {

  const fx = await fixture(t);

  await mkdir(fx.paymentDirectory, {

    mode: 0o755

  });

  await chmod(

    fx.paymentDirectory,

    0o755

  );

  const server = await fx.launch({

    expectReady: false

  });

  const result = await within(
    server.done
  );

  assert.equal(result.code, 1);

  assert.match(

    server.stderr,

    /subscription_bootstrap_failed/

  );

  await assert.rejects(

    stat(

      join(

        fx.paymentDirectory,

        "lago-subscriptions.sqlite"

      )

    ),

    { code: "ENOENT" }

  );

});


/*
 * TEST 11 — INVALID PORT
 */

test("rejects invalid server port configuration", async t => {

  const fx = await fixture(t);

  const server = await fx.launch({

    port: 65536,

    expectReady: false

  });

  const result = await within(
    server.done
  );

  assert.equal(result.code, 1);

  assert.match(

    server.stderr,

    /invalid_server_port/

  );

});


/*
 * TEST 12 — OCCUPIED PORT
 */

test("exits safely when the configured server port is occupied", async t => {

  const fx = await fixture(t);

  const reserved = await fx.reservePort();

  const server = await fx.launch({

    port: reserved.port,

    expectReady: false

  });

  const result = await within(
    server.done
  );

  assert.equal(result.code, 1);

  assert.match(

    server.stderr,

    /\[LAGO\] HTTP server error/

  );

  assert.doesNotMatch(

    server.stdout,

    /Subscription storage: READY/

  );

});


/*
 * TEST 13 — GRACEFUL SHUTDOWN
 */

test("gracefully closes HTTP and subscription services on shutdown", {

  skip: process.platform === "win32"

}, async t => {

  const fx = await fixture(t);

  for (const signal of [

    "SIGTERM",

    "SIGINT"

  ]) {

    const server = await fx.launch();

    const health = await server.request(
      "/api/health"
    );

    assert.equal(health.status, 200);

    const result = await server.stop(
      signal
    );

    assert.equal(result.code, 0);

    assert.equal(result.signal, null);

    assert.match(

      server.stdout,

      /Subscription services closed/

    );

    assert.doesNotMatch(

      server.stderr,

      /shutdown failed/

    );

  }

});

/*
 * LAGO GAME
 * R2.7I — FINAL SUBSCRIPTION INTEGRATION
 *
 * Real frontend authentication.
 * Real frontend subscription module.
 * Real HTTP server.
 * Real account sessions.
 * Real SQLite storage.
 *
 * Synthetic browser environment.
 * No real blockchain payments.
 */

import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";

const AUTH_CLIENT_SOURCE = readFileSync(
  new URL("../lago-auth-backend.js", import.meta.url),
  "utf8"
);

const ACCESS_CLIENT_SOURCE = readFileSync(
  new URL("../lago-agent-access.js", import.meta.url),
  "utf8"
);


/*
 * INTEGRATED BROWSER FIXTURE
 */

async function createIntegratedBrowser(
  t,
  server,
  initialToken = ""
) {

  let cookieToken = initialToken;

  let character = {
    characterId: "lago",
    characterName: "Lago"
  };

  const calls = [];
  const accessEvents = [];

  const document = new EventTarget();
  const windowEvents = new EventTarget();

  document.hidden = false;

  class SyntheticCustomEvent extends Event {

    constructor(type, options = {}) {

      super(type);

      this.detail = options.detail;

    }

  }

  document.addEventListener(
    "lago:agent-access-state",
    event => accessEvents.push(event.detail)
  );


  /*
   * Browser transport adapter.
   *
   * Simulates automatic same-origin
   * HttpOnly cookie transport.
   *
   * Response data comes exclusively
   * from the real HTTP server.
   */

  async function browserFetch(
    path,
    options = {}
  ) {

    const url = new URL(
      path,
      server.origin
    );

    assert.equal(
      url.origin,
      server.origin
    );

    const method =
      options.method || "GET";

    const headers =
      new Headers(options.headers || {});

    if (

      cookieToken &&

      (
        options.credentials === "include" ||
        options.credentials === "same-origin"
      )

    ) {

      headers.set(
        "Cookie",
        "lago_session=" + cookieToken
      );

    }

    if (method === "POST") {

      headers.set(
        "Origin",
        server.origin
      );

      headers.set(
        "Sec-Fetch-Site",
        "same-origin"
      );

    }

    calls.push({

      path: url.pathname,

      method,

      credentials: options.credentials

    });

    const result = await fetch(

      url,

      {

        ...options,

        method,

        headers,

        redirect: "error",

        signal: options.signal ||
          AbortSignal.timeout(5000)

      }

    );

    const setCookie =
      result.headers.get("set-cookie");

    if (

      setCookie &&

      /^lago_session=;/.test(setCookie)

    ) {

      cookieToken = "";

    }

    return result;

  }


  /*
   * Isolated client runtime.
   */

  const sandbox = {

    console,

    document,

    CustomEvent: SyntheticCustomEvent,

    AbortController,

    performance,

    setTimeout,

    clearTimeout,

    navigator: {
      onLine: true
    },

    fetch: browserFetch,

    addEventListener(type, handler) {

      windowEvents.addEventListener(
        type,
        handler
      );

    },

    LAGO_MINIGAMES: {

      getContext() {
        return { ...character };
      }

    },

    localStorage: {

      getItem() {

        throw new Error(
          "unexpected_persistent_storage_read"
        );

      },

      setItem() {

        throw new Error(
          "unexpected_persistent_storage_write"
        );

      },

      removeItem() {

        throw new Error(
          "unexpected_persistent_storage_mutation"
        );

      }

    }

  };

  sandbox.window = sandbox;

  const runtime =
    createContext(sandbox);

  t.after(() => {

    windowEvents.dispatchEvent(
      new Event("pagehide")
    );

  });


  /*
   * Load actual authentication client.
   */

  const initialAuthEvent = once(

    document,

    "lago:backend-auth-state"

  );

  runInContext(

    AUTH_CLIENT_SOURCE,

    runtime,

    {

      filename: "lago-auth-backend.js",

      timeout: 5000

    }

  );

  await within(initialAuthEvent);

  const auth =
    sandbox.LAGO_AUTH_BACKEND;


  /*
   * Load actual subscription client.
   */

  runInContext(

    ACCESS_CLIENT_SOURCE,

    runtime,

    {

      filename: "lago-agent-access.js",

      timeout: 5000

    }

  );

  const access =
    sandbox.LAGO_AGENT_ACCESS;

  await within(access.refresh());


  return {

    auth,

    access,

    calls,

    accessEvents,

    state() {

      return access.getState();

    },

    async refresh() {

      return within(access.refresh());

    },

    async switchAccount(token) {

      cookieToken = token;

      const result = await within(
        auth.restoreSession()
      );

      assert.equal(result.ok, true);

      return within(access.refresh());

    },

    select(characterId, characterName) {

      character = {

        characterId,

        characterName

      };

      document.dispatchEvent(

        new Event(
          "lago:character-equipped"
        )

      );

      return access.getState();

    },

    async logout() {

      await within(auth.logout());

      return access.getState();

    }

  };

}


/*
 * INTEGRATION ASSERTIONS
 */

function assertClientLocked(browser) {

  const state = browser.state();

  assertLocked(state);

  assert.equal(state.checkoutAvailable, false);
  assert.equal(state.renewalAvailable, false);

  assert.equal(state.autoRenewal, false);

  assert.equal(
    browser.access.canUseAI(),
    false
  );

  assert.equal(
    browser.access.canTrade(),
    false
  );

}


/*
 * TEST 14 — PRODUCTION SCRIPT CONTRACT
 */

test("loads the updated subscription module after authentication", () => {

  const html = readFileSync(

    new URL("../index.html", import.meta.url),

    "utf8"

  );

  const authPosition =
    html.indexOf(
      'src="lago-auth-backend.js?v=2"'
    );

  const accessPosition =
    html.indexOf(
      'src="lago-agent-access.js?v=3"'
    );

  const contextPosition =
    html.indexOf(
      'src="lago-agent-context.js?v=1"'
    );

  const chatPosition =
    html.indexOf(
      'src="lago-agent-chat.js?v=3"'
    );

  assert.ok(authPosition >= 0);

  assert.ok(
    accessPosition > authPosition
  );

  assert.ok(
    contextPosition > accessPosition
  );

  assert.ok(
    chatPosition > accessPosition
  );

  assert.equal(

    (
      html.match(
        /src="lago-agent-access\.js(?:\?[^"]*)?"/g
      ) || []
    ).length,

    1

  );

});


/*
 * TEST 15 — UNAUTHENTICATED BROWSER
 */

test("keeps an unauthenticated browser outside the subscription API", async t => {

  const fx = await fixture(t);

  const server = await fx.launch();

  const browser =
    await createIntegratedBrowser(

      t,

      server

    );

  assert.equal(

    browser.auth.getState().authenticated,

    false

  );

  assert.equal(
    browser.state().accountId,
    null
  );

  assert.equal(

    browser.state().subscriptionStateAvailable,

    false

  );

  assert.equal(

    browser.calls.filter(
      call => call.path === STATE_PATH
    ).length,

    0

  );

  assertClientLocked(browser);

});


/*
 * TEST 16 — REAL ACCOUNT RESTORATION
 */

test("restores authenticated account and inactive subscription through real HTTP", async t => {

  const fx = await fixture(t);

  const server = await fx.launch();

  const browser =
    await createIntegratedBrowser(

      t,

      server,

      fx.playerA.token

    );

  const auth =
    browser.auth.getState();

  const state =
    browser.state();

  assert.equal(auth.authenticated, true);

  assert.equal(
    auth.accountId,
    fx.playerA.accountId
  );

  assert.equal(
    state.accountId,
    fx.playerA.accountId
  );

  assert.equal(
    state.subscriptionStatus,
    "inactive"
  );

  assert.equal(
    state.subscriptionStateAvailable,
    true
  );

  assert.equal(state.loading, false);

  assert.equal(

    state.reason,

    "subscription_entitlement_disabled"

  );

  assertClientLocked(browser);

});


/*
 * TEST 17 — ACTIVE BILLING STATE
 */

test("displays real recorded billing periods without enabling AI or trading", async t => {

  const fx = await fixture(t);

  const payment =
    await fx.seedPayment();

  const server = await fx.launch();

  const browser =
    await createIntegratedBrowser(

      t,

      server,

      fx.playerA.token

    );

  const state = browser.state();

  assert.equal(
    state.subscriptionStatus,
    "active"
  );

  assert.equal(

    state.currentPeriodStart,

    payment.period.currentPeriodStart

  );

  assert.equal(

    state.currentPeriodEnd,

    payment.period.currentPeriodEnd

  );

  assert.ok(state.daysRemaining > 0);

  assert.equal(
    state.subscriptionStateAvailable,
    true
  );

  assertClientLocked(browser);


  /*
   * Character selection must not
   * change account billing state.
   */

  const requestCount =
    browser.calls.length;

  const selected = browser.select(

    "comic_pink_snail",

    "Sola"

  );

  assert.equal(
    selected.characterName,
    "Sola"
  );

  assert.equal(
    selected.characterId,
    "comic_pink_snail"
  );

  assert.equal(
    selected.accountId,
    fx.playerA.accountId
  );

  assert.equal(

    selected.currentPeriodEnd,

    state.currentPeriodEnd

  );

  assert.equal(
    browser.calls.length,
    requestCount
  );

  assertClientLocked(browser);

});


/*
 * TEST 18 — ACCOUNT ISOLATION
 */

test("never transfers subscription history between real authenticated accounts", async t => {

  const fx = await fixture(t);

  await fx.seedPayment(
    fx.playerA
  );

  const server = await fx.launch();

  const browser =
    await createIntegratedBrowser(

      t,

      server,

      fx.playerA.token

    );

  assert.equal(

    browser.state().subscriptionStatus,

    "active"

  );

  const second =
    await browser.switchAccount(
      fx.playerB.token
    );

  assert.equal(
    second.accountId,
    fx.playerB.accountId
  );

  assert.equal(
    second.subscriptionStatus,
    "inactive"
  );

  assert.equal(
    second.currentPeriodStart,
    null
  );

  assert.equal(
    second.currentPeriodEnd,
    null
  );

  assertClientLocked(browser);


  /*
   * Return to the original account.
   */

  const restored =
    await browser.switchAccount(
      fx.playerA.token
    );

  assert.equal(
    restored.accountId,
    fx.playerA.accountId
  );

  assert.equal(
    restored.subscriptionStatus,
    "active"
  );

  assert.ok(
    restored.currentPeriodEnd
  );

  assertClientLocked(browser);

});


/*
 * TEST 19 — REAL LOGOUT
 */

test("clears client billing state and revokes the real server session on logout", async t => {

  const fx = await fixture(t);

  await fx.seedPayment();

  const server = await fx.launch();

  const browser =
    await createIntegratedBrowser(

      t,

      server,

      fx.playerA.token

    );

  assert.equal(

    browser.state().subscriptionStatus,

    "active"

  );

  const state = await browser.logout();

  assert.equal(

    browser.auth.getState().authenticated,

    false

  );

  assert.equal(state.accountId, null);

  assert.equal(
    state.currentPeriodEnd,
    null
  );

  assert.equal(

    state.subscriptionStateAvailable,

    false

  );

  assertClientLocked(browser);


  /*
   * Verify actual server revocation.
   */

  assertError(

    await server.request(

      STATE_PATH,

      {

        token: fx.playerA.token

      }

    ),

    401,

    "authentication_required"

  );

});


/*
 * TEST 20 — EXTERNAL SESSION REVOCATION
 */

test("removes subscription state after server-side session revocation", async t => {

  const fx = await fixture(t);

  await fx.seedPayment();

  const server = await fx.launch();

  const browser =
    await createIntegratedBrowser(

      t,

      server,

      fx.playerA.token

    );

  const revoked = await server.request(

    "/api/auth/logout",

    {

      method: "POST",

      token: fx.playerA.token

    }

  );

  assert.equal(revoked.status, 200);

  const state =
    await browser.refresh();

  assert.equal(

    state.subscriptionStateAvailable,

    false

  );

  assert.equal(

    state.reason,

    "authentication_required"

  );

  assert.equal(
    state.currentPeriodEnd,
    null
  );

  assertClientLocked(browser);


  /*
   * Restore authentication again
   * to synchronize the account module.
   */

  const authResult = await within(

    browser.auth.restoreSession()

  );

  assert.equal(authResult.ok, false);

  assert.equal(

    browser.auth.getState().authenticated,

    false

  );

  assert.equal(
    browser.state().accountId,
    null
  );

});


/*
 * TEST 21 — DISABLED BACKEND
 */

test("fails closed when the real subscription backend is not configured", async t => {

  const fx = await fixture(t);

  const server = await fx.launch({

    directory: ""

  });

  const browser =
    await createIntegratedBrowser(

      t,

      server,

      fx.playerA.token

    );

  assert.equal(

    browser.auth.getState().authenticated,

    true

  );

  const state = browser.state();

  assert.equal(

    state.subscriptionStateAvailable,

    false

  );

  assert.equal(

    state.subscriptionStatus,

    "unavailable"

  );

  assert.equal(

    state.reason,

    "subscription_service_unavailable"

  );

  assert.equal(state.loading, false);

  assertClientLocked(browser);

});

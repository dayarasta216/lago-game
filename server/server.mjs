import {
  createLagoRuntimeServices
} from "./lago-agent-runtime-services.mjs";

import {
  dirname,
  resolve,
  isAbsolute
} from "node:path";

import {
  fileURLToPath
} from "node:url";

import {
  createLagoAccountSessionStore
} from "./lago-account-session-store.mjs";

import {
  createLagoHttpServer
} from "./http-app.mjs";

import {
  createLagoPaymentQuotes
} from "./lago-agent-payment-quotes.mjs";

import {
  createLagoSubscriptionEntitlement
} from "./lago-agent-subscription-entitlement.mjs";

/*
 * LAGO GAME
 * R2.7G — SERVER BOOTSTRAP
 *
 * Account authentication.
 * Subscription storage.
 * Subscription HTTP integration.
 * Controlled service lifecycle.
 *
 * Live payments disabled.
 * AI entitlement disabled.
 * No trading authorization.
 */

const currentDirectory = dirname(
  fileURLToPath(import.meta.url)
);

const projectRoot = resolve(
  currentDirectory,
  ".."
);


/*
 * SERVER CONFIGURATION
 */

const host = String(
  process.env.LAGO_HOST ||
  "127.0.0.1"
);

const port = Number(
  process.env.PORT ||
  process.env.LAGO_PORT ||
  8787
);

const botToken = String(
  process.env.LAGO_TELEGRAM_BOT_TOKEN ||
  ""
).trim();

const production =
  process.env.NODE_ENV === "production";

const cookieSecure =
  production ||
  process.env.LAGO_COOKIE_SECURE === "1";


/*
 * PRIVATE PAYMENT STORAGE
 *
 * Explicit absolute directory.
 * Must remain outside projectRoot.
 *
 * No implicit database migration
 * to a different storage location.
 */

const paymentDirectory = String(
  process.env.LAGO_PAYMENT_DATA_DIR ||
  ""
).trim();


if (
  !Number.isInteger(port) ||
  port < 1 ||
  port > 65535
) {

  throw new Error(
    "invalid_server_port"
  );

}

if (
  paymentDirectory &&
  !isAbsolute(paymentDirectory)
) {

  throw new Error(
    "absolute_payment_directory_required"
  );

}


/*
 * ACCOUNT AND SESSION STORE
 *
 * Preserve existing account storage
 * and authenticated player identity.
 */

const store =
  createLagoAccountSessionStore();


/*
 * SUBSCRIPTION SERVICE LIFECYCLE
 */

const managedServices = [];

let subscriptionServices = null;

let runtimeServices = null;

let servicesClosed = false;


function closeSubscriptionServices() {

  if (servicesClosed) {
    return;
  }

  servicesClosed = true;

  while (managedServices.length > 0) {

    const service =
      managedServices.pop();

    try {

      service.close();

    } catch {

      console.error(
        "[LAGO] Subscription service shutdown failed"
      );

      process.exitCode = 1;

    }

  }

}


/*
 * INITIALIZE SUBSCRIPTION CORE
 *
 * Explicit storage configuration
 * is required before initialization.
 */

function initializeSubscriptionServices() {

  if (!paymentDirectory) {

    return null;

  }

  /*
   * 1. Subscription entitlement engine.
   *
   * Opens subscription ledger and
   * installs global payment registry.
   *
   * Entitlement remains disabled.
   */

  const entitlement =
    createLagoSubscriptionEntitlement({

      directory: paymentDirectory,

      projectRoot,

      sessionStore: store,

      verifiedLedgerEnabled: false

    });

  managedServices.push(
    entitlement
  );


  /*
   * 2. Persistent payment quote store.
   *
   * No trusted price configuration.
   * No verified wallet context.
   *
   * New quote issuance is disabled.
   */

  const quoteStore =
    createLagoPaymentQuotes({

      directory: paymentDirectory,

      projectRoot,

      sessionStore: store,

      paymentConfig: null,

      resolvePaymentContext: null

    });

  managedServices.push(
    quoteStore
  );


  /*
   * 3. Payment authorization.
   *
   * Intentionally unavailable until:
   *
   * - Cryptographic wallet ownership.
   * - Verified token configuration.
   * - Trusted mainnet RPC.
   * - Verified treasury configuration.
   * - Production payment controls.
   */

  return Object.freeze({

    entitlement,

    quoteStore,

    authorization: null

  });

}


/*
 * FAIL-CLOSED INITIALIZATION
 */

try {

  subscriptionServices =
    initializeSubscriptionServices();

} catch {

  closeSubscriptionServices();

  throw new Error(
    "subscription_bootstrap_failed"
  );

}

/*
 * R2.8C6B — MANAGED RUNTIME SERVICES
 *
 * Character storage is optional.
 * Explicit configuration only.
 * AI activation remains disabled.
 */

try {

  runtimeServices =
    createLagoRuntimeServices({

      env: process.env,

      projectRoot,

      sessionStore: store,

      entitlement:
        subscriptionServices?.entitlement ??
        null

    });

  if (runtimeServices !== null) {

    managedServices.push(
      runtimeServices
    );

  }

} catch {

  closeSubscriptionServices();

  throw new Error(
    "runtime_bootstrap_failed"
  );

}

/*
 * CREATE MAIN HTTP SERVER
 */

let server;

try {

  server = createLagoHttpServer({

    projectRoot,

    store,

    botToken,

    cookieSecure,

    subscriptionServices

  });

} catch {

  closeSubscriptionServices();

  throw new Error(
    "http_server_initialization_failed"
  );

}


/*
 * SERVER LIFECYCLE
 */

let shuttingDown = false;


server.once("close", () => {

  closeSubscriptionServices();

});


server.on("error", () => {

  console.error(
    "[LAGO] HTTP server error"
  );

  process.exitCode = 1;

  if (server.listening) {

    shutdown("SERVER_ERROR");

  } else {

    closeSubscriptionServices();

  }

});


/*
 * START SERVER
 */

try {

  server.listen(
    port,
    host,
    () => {

      console.log("");

      console.log(
        "=== LAGO BACKEND ==="
      );

      console.log(
        `URL: http://${host}:${port}`
      );

      console.log(
        `Telegram auth: ${
          botToken
            ? "CONFIGURED"
            : "NOT CONFIGURED"
        }`
      );

      console.log(
        `Cookie Secure: ${
          cookieSecure
            ? "YES"
            : "NO (LOCAL DEVELOPMENT)"
        }`
      );

      console.log(
        `Subscription storage: ${
          subscriptionServices
            ? "READY"
            : "NOT CONFIGURED"
        }`
      );

      console.log(
        `Subscription API: ${
          subscriptionServices
            ? "STATE AVAILABLE"
            : "DISABLED"
        }`
      );

      console.log(
        "Payment quotes: DISABLED"
      );

      console.log(
        "Payment confirmation: DISABLED"
      );

      console.log(
        "AI entitlement: DISABLED"
      );

            console.log(
        `Character storage: ${
          runtimeServices
            ? "READY"
            : "NOT CONFIGURED"
        }`
      );

      console.log(
        "AI runtime: DISABLED"
      );

      console.log(
        "AI provider: LOCKED"
      );
      
      console.log(
        "Live trading: DISABLED"
      );

      console.log(
        "===================="
      );

      console.log("");

    }
  );

} catch {

  closeSubscriptionServices();

  throw new Error(
    "http_server_start_failed"
  );

}


/*
 * GRACEFUL SHUTDOWN
 *
 * Stop accepting new requests.
 * Close idle HTTP connections.
 * Close SQLite databases after
 * the HTTP server has stopped.
 */

function shutdown(signal) {

  if (shuttingDown) {
    return;
  }

  shuttingDown = true;

  console.log(
    `\n${signal}: shutting down Lago backend`
  );

  server.close(error => {

    if (error) {

      process.exitCode = 1;

      console.error(
        "[LAGO] HTTP shutdown failed"
      );

    }

    closeSubscriptionServices();

    console.log(
      "[LAGO] Subscription services closed"
    );

  });

  server.closeIdleConnections();

}


process.on(
  "SIGINT",
  () => shutdown("SIGINT")
);

process.on(
  "SIGTERM",
  () => shutdown("SIGTERM")
);

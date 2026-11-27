
import { DatabaseSync } from "node:sqlite";
import { randomBytes } from "node:crypto";

import {
  mkdirSync,
  realpathSync,
  lstatSync,
  openSync,
  closeSync
} from "node:fs";

import {
  resolve,
  join,
  sep,
  isAbsolute
} from "node:path";

import {
  SUBSCRIPTION_POLICY
} from "./lago-agent-subscription-contract.mjs";

import {
  validAccountId
} from "./lago-agent-memory-contract.mjs";

import {
  TOKEN_PROGRAM_ID,
  validSolanaPublicKey,
  buildPaymentMemo,
  validatePaymentQuote
} from "./lago-solana-payment-verifier.mjs";


/*
 * LAGO GAME
 * R2.7D3 — SERVER PAYMENT QUOTES
 *
 * Persistent server-generated quotes.
 * Authenticated account binding.
 * Trusted wallet ownership provider.
 * Server-controlled pricing.
 * Exact integer token amounts.
 *
 * No client pricing.
 * No automatic payments.
 * No entitlement activation.
 */

export const PAYMENT_QUOTES_VERSION = 1;

const POLICY = SUBSCRIPTION_POLICY;

const QUOTE_LIFETIME_SECONDS = 900;

const MAX_ACTIVE_QUOTES = 3;

const MAX_U64 = 18446744073709551615n;


/*
 * STANDARD REJECTION
 */

function reject(reason) {

  return Object.freeze({

    ok: false,

    reason,

    serverVerified: false,

    entitled: false,

    aiEnabled: false,

    tradingAuthorized: false

  });

}


/*
 * VALIDATE SERVER PRICE
 */

function validAmount(value) {

  return (

    typeof value === "string" &&

    /^[1-9][0-9]{0,19}$/.test(value) &&

    BigInt(value) <= MAX_U64

  );

}


/*
 * PRIVATE STORAGE
 */

function isInside(parent, target) {

  return (

    target === parent ||

    target.startsWith(

      parent.endsWith(sep)

        ? parent

        : parent + sep

    )

  );

}


function prepareDatabasePath(
  directory,
  projectRoot
) {

  if (

    typeof directory !== "string" ||

    typeof projectRoot !== "string" ||

    !isAbsolute(directory) ||

    !isAbsolute(projectRoot)

  ) {

    throw new Error(
      "absolute_quote_paths_required"
    );

  }


  const root = realpathSync(projectRoot);

  const requested = resolve(directory);


  if (

    isInside(
      resolve(projectRoot),
      requested
    ) ||

    isInside(root, requested)

  ) {

    throw new Error(
      "quote_directory_inside_project"
    );

  }


  mkdirSync(requested, {

    recursive: true,

    mode: 0o700

  });


  const privateDirectory =
    realpathSync(requested);


  if (isInside(root, privateDirectory)) {

    throw new Error(
      "quote_directory_inside_project"
    );

  }


  const info =
    lstatSync(privateDirectory);


  if (

    !info.isDirectory() ||

    (

      process.platform !== "win32" &&

      (info.mode & 0o077) !== 0

    )

  ) {

    throw new Error(
      "insecure_quote_directory"
    );

  }


  const file = join(

    privateDirectory,

    "lago-payment-quotes.sqlite"

  );


  try {

    const fd =
      openSync(file, "wx", 0o600);

    closeSync(fd);

  } catch (error) {

    if (error?.code !== "EEXIST") {

      throw error;

    }

  }


  const databaseInfo =
    lstatSync(file);


  if (

    !databaseInfo.isFile() ||

    databaseInfo.isSymbolicLink() ||

    databaseInfo.nlink !== 1 ||

    (

      process.platform !== "win32" &&

      (databaseInfo.mode & 0o077) !== 0

    )

  ) {

    throw new Error(
      "insecure_quote_database"
    );

  }


  return file;

}


/*
 * SERVER PAYMENT CONFIGURATION
 *
 * No default price.
 * No default treasury wallet.
 * Missing configuration disables
 * new payment quote creation.
 */

function normalizeConfig(config) {

  if (config === null) {

    return null;

  }


  if (

    !config ||

    config.network !== POLICY.network ||

    config.tokenMint !== POLICY.tokenMint ||

    config.tokenProgram !== TOKEN_PROGRAM_ID ||

    !validSolanaPublicKey(
      config.treasuryWallet
    ) ||

    !validSolanaPublicKey(
      config.destinationTokenAccount
    ) ||

    !Number.isInteger(
      config.tokenDecimals
    ) ||

    config.tokenDecimals < 0 ||

    config.tokenDecimals > 18 ||

    !validAmount(
      config.amountBaseUnits
    )

  ) {

    throw new Error(
      "invalid_server_payment_configuration"
    );

  }


  return Object.freeze({

    network:
      config.network,

    tokenMint:
      config.tokenMint,

    tokenProgram:
      config.tokenProgram,

    treasuryWallet:
      config.treasuryWallet,

    destinationTokenAccount:
      config.destinationTokenAccount,

    tokenDecimals:
      config.tokenDecimals,

    amountBaseUnits:
      config.amountBaseUnits

  });

}


/*
 * TRUSTED PAYMENT CONTEXT
 *
 * The provider must independently
 * verify wallet ownership and
 * on-chain token account metadata.
 *
 * The provider is NOT implemented
 * by this module.
 */

function validatePaymentContext(

  context,

  account,

  config

) {

  return Boolean(

    context &&

    context.serverVerified === true &&

    context.walletOwnershipVerified === true &&

    context.tokenAccountsVerified === true &&

    context.accountId ===
      account.accountId &&

    context.network ===
      config.network &&

    context.tokenMint ===
      config.tokenMint &&

    context.tokenProgram ===
      config.tokenProgram &&

    context.tokenDecimals ===
      config.tokenDecimals &&

    context.treasuryWallet ===
      config.treasuryWallet &&

    context.destinationTokenAccount ===
      config.destinationTokenAccount &&

    context.payerWallet ===
      account.walletPublicKey &&

    validSolanaPublicKey(
      context.payerWallet
    ) &&

    validSolanaPublicKey(
      context.sourceTokenAccount
    ) &&

    context.payerWallet !==
      config.treasuryWallet &&

    context.sourceTokenAccount !==
      config.destinationTokenAccount

  );

}


/*
 * SERVER QUOTE FACTORY
 */

export function createLagoPaymentQuotes({

  directory,

  projectRoot,

  sessionStore,

  paymentConfig = null,

  resolvePaymentContext = null,

  now = () => Date.now()

} = {}) {

  if (

    typeof sessionStore?.restoreSession !==
      "function"

  ) {

    throw new Error(
      "quote_session_store_required"
    );

  }


  if (

    resolvePaymentContext !== null &&

    typeof resolvePaymentContext !==
      "function"

  ) {

    throw new Error(
      "invalid_payment_context_provider"
    );

  }


  if (typeof now !== "function") {

    throw new Error(
      "invalid_quote_clock"
    );

  }


  const config =
    normalizeConfig(paymentConfig);


  const file =
    prepareDatabasePath(

      directory,

      projectRoot

    );


  const db = new DatabaseSync(file, {

    timeout: 5000

  });


  try {

    db.exec(`

      PRAGMA journal_mode = DELETE;

      PRAGMA synchronous = FULL;

      PRAGMA busy_timeout = 5000;


      CREATE TABLE IF NOT EXISTS
        subscription_quotes (

        quote_id
          TEXT PRIMARY KEY NOT NULL,

        account_id
          TEXT NOT NULL,

        issued_at
          INTEGER NOT NULL,

        expires_at
          INTEGER NOT NULL,

        quote_json
          TEXT NOT NULL,

        CHECK (
          expires_at > issued_at
        )

      ) STRICT;


      CREATE INDEX IF NOT EXISTS
        subscription_quotes_account_idx

      ON subscription_quotes (

        account_id,

        expires_at

      );

    `);

  } catch (error) {

    db.close();

    throw error;

  }


  let closed = false;


  const insertQuote = db.prepare(`

    INSERT INTO subscription_quotes (

      quote_id,

      account_id,

      issued_at,

      expires_at,

      quote_json

    ) VALUES (?, ?, ?, ?, ?)

  `);


  const findQuote = db.prepare(`

    SELECT *

    FROM subscription_quotes

    WHERE quote_id = ?

      AND account_id = ?

  `);


  const countActive = db.prepare(`

    SELECT COUNT(*) AS total

    FROM subscription_quotes

    WHERE account_id = ?

      AND expires_at > ?

  `);


  /*
   * AUTHENTICATE ACCOUNT
   *
   * Never trust accountId supplied
   * by the browser.
   */

  async function authenticate(sessionToken) {

    if (

      typeof sessionToken !== "string" ||

      sessionToken.length === 0 ||

      sessionToken.length > 256

    ) {

      return null;

    }


    const result =
      await sessionStore.restoreSession(
        sessionToken
      );


    const timestamp = now();


    if (

      result?.ok !== true ||

      !validAccountId(
        result.account?.accountId
      ) ||

      !Number.isSafeInteger(timestamp) ||

      !Number.isFinite(
        Date.parse(result.expiresAt)
      ) ||

      Date.parse(result.expiresAt) <=
        timestamp

    ) {

      return null;

    }


    return Object.freeze({

      accountId:
        result.account.accountId,

      walletPublicKey:
        result.account.walletPublicKey || "",

      expiresAt:
        result.expiresAt

    });

  }


  /*
   * ISSUE NEW SERVER QUOTE
   */

  async function createQuote({

    sessionToken

  } = {}) {

    if (closed) {

      return reject(
        "quote_store_closed"
      );

    }


    if (!config) {

      return reject(
        "payment_configuration_unavailable"
      );

    }


    if (

      typeof resolvePaymentContext !==
        "function"

    ) {

      return reject(
        "payment_context_unavailable"
      );

    }


    try {

      const account =
        await authenticate(sessionToken);


      if (!account) {

        return reject(
          "authentication_required"
        );

      }


      const context =
        await resolvePaymentContext({

          accountId:
            account.accountId,

          payerWallet:
            account.walletPublicKey,

          tokenMint:
            config.tokenMint,

          treasuryWallet:
            config.treasuryWallet,

          destinationTokenAccount:
            config.destinationTokenAccount

        });


      if (

        !validatePaymentContext(

          context,

          account,

          config

        )

      ) {

        return reject(
          "payment_context_not_verified"
        );

      }


      /*
       * Copy provider data before
       * performing another async call.
       */

      const payerWallet =
        context.payerWallet;

      const sourceTokenAccount =
        context.sourceTokenAccount;


      /*
       * Recheck authenticated session
       * after external verification.
       */

      const current =
        await authenticate(sessionToken);


      if (

        !current ||

        current.accountId !==
          account.accountId ||

        current.walletPublicKey !==
          payerWallet

      ) {

        return reject(
          "payment_session_changed"
        );

      }


      if (closed) {

        return reject(
          "quote_store_closed"
        );

      }


      const timestamp = now();


      if (

        !Number.isSafeInteger(timestamp) ||

        timestamp >=
          Date.parse(current.expiresAt)

      ) {

        return reject(
          "payment_session_expired"
        );

      }


      const issuedAtSeconds =
        Math.floor(timestamp / 1000);


      const expiresAtSeconds =
        issuedAtSeconds +
        QUOTE_LIFETIME_SECONDS;


      /*
       * Server-generated 128-bit quote ID.
       */

      const quote = Object.freeze({

        schemaVersion: 1,

        quoteId:
          randomBytes(16).toString("hex"),

        accountId:
          current.accountId,

        product:
          POLICY.product,

        billingModel:
          POLICY.billingModel,

        billingInterval:
          POLICY.billingInterval,

        billingIntervalCount: 1,

        chain:
          POLICY.chain,

        network:
          config.network,

        tokenMint:
          config.tokenMint,

        tokenProgram:
          config.tokenProgram,

        payerWallet,

        treasuryWallet:
          config.treasuryWallet,

        sourceTokenAccount,

        destinationTokenAccount:
          config.destinationTokenAccount,

        tokenDecimals:
          config.tokenDecimals,

        amountBaseUnits:
          config.amountBaseUnits,

        issuedAtSeconds,

        expiresAtSeconds

      });


      if (!validatePaymentQuote(quote)) {

        return reject(
          "invalid_generated_quote"
        );

      }


      /*
       * ATOMIC QUOTE CREATION
       *
       * Limit active unpaid offers.
       * Never overwrite existing quotes.
       */

      db.exec("BEGIN IMMEDIATE");

      let committed = false;


      try {

        const active =
          countActive.get(

            current.accountId,

            issuedAtSeconds

          );


        if (active.total >= MAX_ACTIVE_QUOTES) {

          return reject(
            "active_quote_limit_reached"
          );

        }


        insertQuote.run(

          quote.quoteId,

          quote.accountId,

          quote.issuedAtSeconds,

          quote.expiresAtSeconds,

          JSON.stringify(quote)

        );


        db.exec("COMMIT");

        committed = true;


        return Object.freeze({

          ok: true,

          quote,

          memo:
            buildPaymentMemo(
              quote.quoteId
            ),

          quoteStored: true,

          paymentVerified: false,

          serverVerified: false,

          entitled: false,

          aiEnabled: false,

          tradingAuthorized: false

        });

      } finally {

        if (!committed) {

          db.exec("ROLLBACK");

        }

      }

    } catch {

      return reject(
        "quote_creation_unavailable"
      );

    }

  }


  /*
   * READ PERSISTED SERVER QUOTE
   *
   * Internal server API.
   *
   * accountId must originate from
   * authenticated server context.
   *
   * Expired quotes are retained:
   * valid payments may become
   * finalized after quote expiration.
   */

  function getQuote({

    accountId,

    quoteId

  } = {}) {

    if (closed) {

      return reject(
        "quote_store_closed"
      );

    }


    if (

      !validAccountId(accountId) ||

      !buildPaymentMemo(quoteId)

    ) {

      return reject(
        "invalid_quote_lookup"
      );

    }


    try {

      const row =
        findQuote.get(

          quoteId,

          accountId

        );


      if (!row) {

        return reject(
          "payment_quote_not_found"
        );

      }


      const quote =
        JSON.parse(row.quote_json);


      if (

        !validatePaymentQuote(quote) ||

        quote.quoteId !== quoteId ||

        quote.accountId !== accountId ||

        quote.issuedAtSeconds !==
          row.issued_at ||

        quote.expiresAtSeconds !==
          row.expires_at

      ) {

        return reject(
          "quote_integrity_check_failed"
        );

      }


      return Object.freeze({

        ok: true,

        quote:
          Object.freeze(quote),

        memo:
          buildPaymentMemo(quoteId),

        quoteStored: true,

        paymentVerified: false,

        serverVerified: false,

        entitled: false,

        tradingAuthorized: false

      });

    } catch {

      return reject(
        "quote_lookup_unavailable"
      );

    }

  }


  /*
   * CLOSE DATABASE
   */

  function close() {

    if (!closed) {

      db.close();

      closed = true;

    }

  }


  /*
   * INTERNAL SERVER API
   */

  return Object.freeze({

    version:
      PAYMENT_QUOTES_VERSION,

    createQuote,

    getQuote,

    close,

    getPolicy() {

      return Object.freeze({

        storage: "sqlite",

        quoteLifetimeSeconds:
          QUOTE_LIFETIME_SECONDS,

        maxActiveQuotesPerAccount:
          MAX_ACTIVE_QUOTES,

        quoteIdEntropyBits: 128,

        accountAuthenticationRequired: true,

        walletOwnershipRequired: true,

        verifiedTokenAccountsRequired: true,

        serverPricingRequired: true,

        clientPricingTrusted: false,

        preserveExpiredQuotes: true,

        automaticPaymentEnabled: false,

        entitlementActivationEnabled: false,

        paymentConfigurationAvailable:
          config !== null,

        paymentContextProviderAvailable:

          typeof resolvePaymentContext ===
            "function"

      });

    }

  });

}

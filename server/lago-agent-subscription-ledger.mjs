

import { DatabaseSync } from "node:sqlite";

import {
  installGlobalPaymentRegistry
} from "./lago-payment-registry.mjs";


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
  SUBSCRIPTION_VERSION,
  SUBSCRIPTION_POLICY,
  createBillingPeriod,
  validateBillingPeriod,
  getBillingPeriodStatus
} from "./lago-agent-subscription-contract.mjs";

import {
  validAccountId
} from "./lago-agent-memory-contract.mjs";


/*
 * LAGO GAME
 * R2.7C — SUBSCRIPTION LEDGER
 *
 * Persistent SQLite billing history.
 * Atomic payment credit.
 * Global signature uniqueness
 * within this subscription ledger.
 *
 * Internal server module only.
 *
 * No direct blockchain verification.
 * No client-side entitlement.
 * No automatic payments.
 * No trading authorization.
 */

export const SUBSCRIPTION_LEDGER_VERSION = 1;

const POLICY = SUBSCRIPTION_POLICY;

const MAX_TOKEN_AMOUNT =
  18446744073709551615n;


/*
 * VALIDATION
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


function validQuoteId(value) {

  return (

    typeof value === "string" &&

    /^[A-Za-z0-9_-]{1,128}$/
      .test(value)

  );

}


function validSignature(value) {

  return (

    typeof value === "string" &&

    /^[1-9A-HJ-NP-Za-km-z]{64,88}$/
      .test(value)

  );

}


function validWallet(value) {

  return (

    typeof value === "string" &&

    /^[1-9A-HJ-NP-Za-km-z]{32,44}$/
      .test(value)

  );

}


function validAmount(value) {

  return (

    typeof value === "string" &&

    /^[1-9][0-9]{0,19}$/
      .test(value) &&

    BigInt(value) <= MAX_TOKEN_AMOUNT

  );

}


function reject(reason) {

  return Object.freeze({

    ok: false,

    reason,

    entitled: false,

    aiEnabled: false,

    tradingAuthorized: false

  });

}


/*
 * VERIFIED RECEIPT CONTRACT
 *
 * Structural checks only.
 * The injected payment verifier
 * must independently verify Solana,
 * wallet ownership, quote binding,
 * exact amount and destination.
 */

function validReceipt(
  receipt,
  request
) {

  return Boolean(

    receipt &&

    receipt.serverVerified === true &&

    receipt.confirmationStatus ===
      "finalized" &&

    receipt.accountId ===
      request.accountId &&

    receipt.quoteId ===
      request.quoteId &&

    receipt.transactionSignature ===
      request.transactionSignature &&

    receipt.product ===
      POLICY.product &&

    receipt.chain === POLICY.chain &&

    receipt.network === POLICY.network &&

    receipt.tokenMint === POLICY.tokenMint &&

    validWallet(receipt.payerWallet) &&

    validWallet(receipt.treasuryWallet) &&

    receipt.payerWallet !==
      receipt.treasuryWallet &&

    validAmount(receipt.amountBaseUnits)

  );

}


/*
 * PRIVATE DATABASE LOCATION
 */

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
      "absolute_subscription_paths_required"
    );

  }


  const root =
    realpathSync(projectRoot);

  const requestedDirectory =
    resolve(directory);


  if (

    isInside(
      resolve(projectRoot),
      requestedDirectory
    )

  ) {

    throw new Error(
      "subscription_directory_inside_project"
    );

  }


  mkdirSync(

    requestedDirectory,

    {

      recursive: true,

      mode: 0o700

    }

  );


  const privateDirectory =
    realpathSync(requestedDirectory);


  if (

    isInside(
      root,
      privateDirectory
    )

  ) {

    throw new Error(
      "subscription_directory_inside_project"
    );

  }


  const directoryInfo =
    lstatSync(privateDirectory);


  if (

    !directoryInfo.isDirectory() ||

    (

      process.platform !== "win32" &&

      (directoryInfo.mode & 0o077) !== 0

    )

  ) {

    throw new Error(
      "insecure_subscription_directory"
    );

  }


  const file = join(

    privateDirectory,

    "lago-subscriptions.sqlite"

  );


  /*
   * Create with restricted permissions.
   * Never replace an existing database.
   */

  try {

    const fd =
      openSync(file, "wx", 0o600);

    closeSync(fd);

  } catch (error) {

    if (error?.code !== "EEXIST") {

      throw error;

    }

  }


  const info =
    lstatSync(file);


  if (

    !info.isFile() ||

    info.isSymbolicLink() ||

    info.nlink !== 1 ||

    (

      process.platform !== "win32" &&

      (info.mode & 0o077) !== 0

    )

  ) {

    throw new Error(
      "insecure_subscription_database"
    );

  }


  return file;

}


/*
 * RECONSTRUCT CANONICAL PERIOD
 */

function toPeriod(row) {

  if (!row) {

    return null;

  }


  const period = Object.freeze({

    schemaVersion:
      SUBSCRIPTION_VERSION,

    billingModel:
      POLICY.billingModel,

    billingInterval:
      POLICY.billingInterval,

    billingIntervalCount: 1,

    billingAnchorDay:
      row.billing_anchor_day,

    paidAt:
      row.paid_at,

    currentPeriodStart:
      row.period_start,

    currentPeriodEnd:
      row.period_end

  });


  if (!validateBillingPeriod(period)) {

    throw new Error(
      "invalid_subscription_period"
    );

  }


  return period;

}


/*
 * SERVER LEDGER FACTORY
 */

export function createLagoSubscriptionLedger({

  directory,

  projectRoot,

  verifyPayment = null,

  now = () => Date.now()

} = {}) {

  if (

    verifyPayment !== null &&

    typeof verifyPayment !== "function"

  ) {

    throw new Error(
      "invalid_payment_verifier"
    );

  }


  if (typeof now !== "function") {

    throw new Error(
      "invalid_subscription_clock"
    );

  }


  const file = prepareDatabasePath(

    directory,

    projectRoot

  );


  const db = new DatabaseSync(

    file,

    {

      timeout: 5000,

      enableForeignKeyConstraints: true

    }

  );


  /*
   * DATABASE SCHEMA
   */

  try {

    db.exec(`

      PRAGMA journal_mode = DELETE;

      PRAGMA synchronous = FULL;

      CREATE TABLE IF NOT EXISTS
        subscription_payments (

        transaction_signature
          TEXT PRIMARY KEY NOT NULL,

        quote_id
          TEXT UNIQUE NOT NULL,

        account_id
          TEXT NOT NULL,

        payer_wallet
          TEXT NOT NULL,

        treasury_wallet
          TEXT NOT NULL,

        token_mint
          TEXT NOT NULL,

        amount_base_units
          TEXT NOT NULL,

        paid_at
          TEXT NOT NULL,

        period_start
          TEXT NOT NULL,

        period_end
          TEXT NOT NULL,

        billing_anchor_day
          INTEGER NOT NULL,

        CHECK (
          billing_anchor_day
          BETWEEN 1 AND 31
        ),

        CHECK (
          period_end > period_start
        ),

        UNIQUE (
          account_id,
          period_start
        )

      ) STRICT;


      CREATE INDEX IF NOT EXISTS
        subscription_account_period_idx

      ON subscription_payments (

        account_id,

        period_start,

        period_end

      );

   
    `);

    /*
     * R2.7E1 — Install shared payment registry.
     *
     * Migrate existing payment history.
     * Register atomic payment claims.
     * Abort startup on integrity failure.
     */

    db.exec("PRAGMA busy_timeout = 5000");

    installGlobalPaymentRegistry(db);

  } catch (error) {

    db.close();

    throw error;

  }



  let closed = false;


  /*
   * PREPARED DATABASE STATEMENTS
   */

  const findSignature = db.prepare(`

    SELECT *

    FROM subscription_payments

    WHERE transaction_signature = ?

  `);


 
const findPaymentClaims = db.prepare(`

    SELECT *

    FROM payment_claims

    WHERE chain = ?

      AND network = ?

      AND (

        transaction_signature = ?

        OR quote_id = ?

      )

  `);



  const latestPeriod = db.prepare(`

    SELECT *

    FROM subscription_payments

    WHERE account_id = ?

    ORDER BY period_start DESC

    LIMIT 1

  `);


  const activePeriod = db.prepare(`

    SELECT *

    FROM subscription_payments

    WHERE account_id = ?

      AND period_start <= ?

      AND period_end > ?

    ORDER BY period_start DESC

    LIMIT 1

  `);


  const futurePeriods = db.prepare(`

    SELECT *

    FROM subscription_payments

    WHERE account_id = ?

      AND period_start >= ?

    ORDER BY period_start ASC

  `);


  const insertPayment = db.prepare(`

    INSERT INTO subscription_payments (

      transaction_signature,

      quote_id,

      account_id,

      payer_wallet,

      treasury_wallet,

      token_mint,

      amount_base_units,

      paid_at,

      period_start,

      period_end,

      billing_anchor_day

    ) VALUES (

      ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?

    )

  `);


  /*
   * IDEMPOTENT PAYMENT RESULT
   */

  function paymentResult(
    row,
    duplicate
  ) {

    return Object.freeze({

      ok: true,

      duplicate,

      recorded: true,

      accountId:
        row.account_id,

      quoteId:
        row.quote_id,

      transactionSignature:
        row.transaction_signature,

      period:
        toPeriod(row),

      serverVerified: false,

      entitled: false,

      aiEnabled: false,

      tradingAuthorized: false

    });

  }


  /*
   * CHECK PAYMENT REPLAY
   *
   * A retry is idempotent only when
   * account, quote and signature match.
   */

  <CodeBlock language="javascript" editable>
function checkReplay(request) {


/*
* One query checks both unique
* identifiers across all products.
*/

const claims = findPaymentClaims.all(

POLICY.chain,

POLICY.network,

request.transactionSignature,

request.quoteId

);

/*
* Payment has not been registered.
*/

if (claims.length === 0) {

return null;

}

/*
* Only an exact retry for the same
* account, product, signature and
* quote may return an existing credit.
*/

if (claims.length === 1) {

const claim = claims[0];

if (

claim.product ===
POLICY.product &&

claim.account_id ===
request.accountId &&

claim.quote_id ===
request.quoteId &&

claim.transaction_signature ===
request.transactionSignature

) {

const row = findSignature.get(

request.transactionSignature

);

/*
* Global registry and subscription
* ledger must agree.
*/

if (

!row ||

row.account_id !==
claim.account_id ||

row.quote_id !==
claim.quote_id ||

row.transaction_signature !==
claim.transaction_signature ||

row.paid_at !==
claim.recorded_at

) {

throw new Error(

"payment_registry_integrity_failed"

);

}

return paymentResult(

row,

true

);

}

}

/*
* Used by another product, account
* or payment quote.
*/

return reject(

"payment_already_used"

);

}
</CodeBlock>

  /*
   * RECORD VERIFIED PAYMENT
   *
   * accountId must come from an
   * authenticated server session.
   *
   * Never expose this method directly
   * to untrusted browser input.
   */

  async function applyPayment({

    accountId,

    quoteId,

    transactionSignature

  } = {}) {

    if (closed) {

      return reject("ledger_closed");

    }


    if (

      !validAccountId(accountId) ||

      !validQuoteId(quoteId) ||

      !validSignature(
        transactionSignature
      )

    ) {

      return reject(
        "invalid_payment_request"
      );

    }


    if (typeof verifyPayment !== "function") {

      return reject(
        "payment_verifier_unavailable"
      );

    }


    const request = Object.freeze({

      accountId,

      quoteId,

      transactionSignature

    });


    try {

      const existing =
        checkReplay(request);

      if (existing) {

        return existing;

      }


      /*
       * External verification runs
       * before the database transaction.
       */

      const receipt =
        await verifyPayment(request);


      if (!validReceipt(receipt, request)) {

        return reject(
          "payment_not_verified"
        );

      }


      /*
       * Copy trusted receipt fields.
       */

      const payment = {

        payerWallet:
          receipt.payerWallet,

        treasuryWallet:
          receipt.treasuryWallet,

        tokenMint:
          receipt.tokenMint,

        amountBaseUnits:
          receipt.amountBaseUnits

      };


      if (closed) {

        return reject("ledger_closed");

      }


      /*
       * ATOMIC CREDIT
       *
       * Recheck replay after obtaining
       * the database write lock.
       */

      db.exec("BEGIN IMMEDIATE");

      let committed = false;


      try {

        const replay =
          checkReplay(request);


        if (replay) {

          return replay;

        }


        const timestamp = now();

        if (!Number.isSafeInteger(timestamp)) {

          return reject(
            "invalid_subscription_clock"
          );

        }


        const paidAt =
          new Date(timestamp)
            .toISOString();


        const previous =
          toPeriod(

            latestPeriod.get(accountId)

          );


        const period =
          createBillingPeriod({

            paidAt,

            previousPeriod: previous

          });


        if (!period) {

          return reject(
            "billing_period_rejected"
          );

        }


        insertPayment.run(

          transactionSignature,

          quoteId,

          accountId,

          payment.payerWallet,

          payment.treasuryWallet,

          payment.tokenMint,

          payment.amountBaseUnits,

          period.paidAt,

          period.currentPeriodStart,

          period.currentPeriodEnd,

          period.billingAnchorDay

        );


        const saved =
          findSignature.get(
            transactionSignature
          );


        const result =
          paymentResult(saved, false);


        db.exec("COMMIT");

        committed = true;


        return result;

      } finally {

        if (!committed) {

          db.exec("ROLLBACK");

        }

      }

    } catch {

      return reject(
        "subscription_ledger_unavailable"
      );

    }

  }


  /*
   * READ SUBSCRIPTION STATUS
   *
   * Locate the currently active period,
   * not simply the most recent payment.
   *
   * Include contiguous prepaid months.
   *
   * Descriptive state only.
   */

  function getState(accountId) {

    if (closed) {

      return reject("ledger_closed");

    }


    if (!validAccountId(accountId)) {

      return reject(
        "invalid_account_id"
      );

    }


    try {

      const timestamp = now();


      if (!Number.isSafeInteger(timestamp)) {

        return reject(
          "invalid_subscription_clock"
        );

      }


      const iso =
        new Date(timestamp)
          .toISOString();


      const active = toPeriod(

        activePeriod.get(

          accountId,

          iso,

          iso

        )

      );


      const latest = toPeriod(

        latestPeriod.get(accountId)

      );


      const status = active

        ? "active"

        : latest

          ? getBillingPeriodStatus(

              latest,

              timestamp

            )

          : "inactive";


      let paidThrough =
        active?.currentPeriodEnd || null;


      if (active) {

        const future =
          futurePeriods.all(

            accountId,

            active.currentPeriodEnd

          );


        for (const row of future) {

          const period =
            toPeriod(row);


          if (

            period.currentPeriodStart !==
              paidThrough

          ) {

            break;

          }


          paidThrough =
            period.currentPeriodEnd;

        }

      }


      return Object.freeze({

        ok: true,

        version:
          SUBSCRIPTION_LEDGER_VERSION,

        accountId,

        product: POLICY.product,

        billingModel:
          POLICY.billingModel,

        billingInterval:
          POLICY.billingInterval,

        billingIntervalCount: 1,

        currency:
          POLICY.currency,

        tokenMint:
          POLICY.tokenMint,

        status,

        currentPeriodStart:

          active?.currentPeriodStart ||
          null,

        currentPeriodEnd:

          active?.currentPeriodEnd ||
          null,

        paidThrough,

        latestPeriodEnd:

          latest?.currentPeriodEnd ||
          null,

        daysRemaining:

          paidThrough

            ? Math.max(

                0,

                Math.ceil(

                  (

                    Date.parse(paidThrough) -

                    timestamp

                  ) / 86400000

                )

              )

            : 0,

        autoRenewal: false,

        paymentVerifierConfigured:

          typeof verifyPayment ===
            "function",

        serverVerified: false,

        entitled: false,

        aiEnabled: false,

        tradingAuthorized: false

      });

    } catch {

      return reject(
        "subscription_ledger_unavailable"
      );

    }

  }


  /*
   * CLOSE DATABASE CONNECTION
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
      SUBSCRIPTION_LEDGER_VERSION,

    applyPayment,

    getState,

    close,

    getPolicy() {

      return Object.freeze({

        storage: "sqlite",

        atomicCredit: true,

        uniqueTransactionSignature: true,

       <CodeBlock language="javascript" editable>
uniqueQuoteId: true,


globalPaymentRegistryEnabled: true,

crossProductReplayProtection: true,

sharedPaymentDatabaseRequired: true,

atomicPaymentClaim: true,

immutablePaymentHistory: true,
</CodeBlock>

        preserveBillingHistory: true,

        privateDirectoryRequired: true,

        amountStorage: "base_unit_string",

        paymentVerificationRequired: true,

        entitlementActivationEnabled: false,

        tradingAuthorizationGranted: false

      });

    }

  });

}


import {
  SUBSCRIPTION_POLICY
} from "./lago-agent-subscription-contract.mjs";


/*
 * LAGO GAME
 * R2.7E — GLOBAL PAYMENT REGISTRY
 *
 * Shared database replay protection.
 * One transaction = one product credit.
 *
 * Atomic SQL triggers.
 * Existing subscription migration.
 * Append-only payment claims.
 *
 * Must use the same SQLite database
 * as all paid product ledgers.
 *
 * No blockchain verification.
 * No payment execution.
 * No entitlement activation.
 */

export const PAYMENT_REGISTRY_VERSION = 1;

const CHAIN = SUBSCRIPTION_POLICY.chain;
const NETWORK = SUBSCRIPTION_POLICY.network;
const PRODUCT = SUBSCRIPTION_POLICY.product;


/*
 * REGISTRY POLICY
 */

const POLICY = Object.freeze({

  version: PAYMENT_REGISTRY_VERSION,

  storage: "sqlite",

  chain: CHAIN,

  network: NETWORK,

  uniqueTransactionPerNetwork: true,

  uniqueQuotePerNetwork: true,

  appendOnly: true,

  atomicProductCreditRequired: true,

  sharedProductDatabaseRequired: true,

  existingSubscriptionMigration: true,

  clientClaimsAllowed: false,

  paymentVerificationRequired: true,

  entitlementActivationEnabled: false,

  tradingAuthorizationGranted: false

});


/*
 * INPUT VALIDATION
 *
 * Compatible with existing
 * subscription ledger records.
 *
 * Actual cryptographic signature
 * verification remains mandatory.
 */

function validSignature(value) {

  return (

    typeof value === "string" &&

    /^[1-9A-HJ-NP-Za-km-z]{64,88}$/
      .test(value)

  );

}


function validQuoteId(value) {

  return (

    typeof value === "string" &&

    /^[A-Za-z0-9_-]{1,128}$/
      .test(value)

  );

}


/*
 * PROJECT CANONICAL CLAIM
 */

function projectClaim(row) {

  if (!row) {

    return null;

  }


  return Object.freeze({

    chain:
      row.chain,

    network:
      row.network,

    transactionSignature:
      row.transaction_signature,

    quoteId:
      row.quote_id,

    accountId:
      row.account_id,

    product:
      row.product,

    recordedAt:
      row.recorded_at,

    entitlementGranted: false,

    tradingAuthorized: false

  });

}


/*
 * INSTALL SHARED REGISTRY
 *
 * Subscription schema must already
 * exist in the supplied database.
 *
 * Must be called outside an existing
 * database transaction.
 */

export function installGlobalPaymentRegistry(db) {

  if (

    typeof db?.exec !== "function" ||

    typeof db?.prepare !== "function"

  ) {

    throw new Error(
      "payment_registry_database_required"
    );

  }


  /*
   * Ensure REPLACE operations cannot
   * silently bypass delete triggers.
   */

  db.exec("PRAGMA recursive_triggers = ON");


  db.exec("BEGIN IMMEDIATE");

  let committed = false;


  try {

    /*
     * Confirm existing subscription
     * table before installing triggers.
     */

    const existing = db.prepare(`

      SELECT name

      FROM sqlite_master

      WHERE type = 'table'

        AND name = 'subscription_payments'

    `).get();


    if (!existing) {

      throw new Error(
        "subscription_schema_required"
      );

    }


    /*
     * SHARED PAYMENT CLAIMS
     *
     * Unique across every registered
     * product on the same network.
     */

    db.exec(`

      CREATE TABLE IF NOT EXISTS
        payment_claims (

        chain
          TEXT NOT NULL,

        network
          TEXT NOT NULL,

        transaction_signature
          TEXT NOT NULL,

        quote_id
          TEXT NOT NULL,

        account_id
          TEXT NOT NULL,

        product
          TEXT NOT NULL,

        recorded_at
          TEXT NOT NULL,

        PRIMARY KEY (

          chain,

          network,

          transaction_signature

        ),

        UNIQUE (

          chain,

          network,

          quote_id

        ),

        CHECK (length(chain) > 0),

        CHECK (length(network) > 0),

        CHECK (length(transaction_signature) > 0),

        CHECK (length(quote_id) > 0),

        CHECK (length(account_id) > 0),

        CHECK (length(product) > 0),

        CHECK (length(recorded_at) > 0)

      ) STRICT;


      CREATE INDEX IF NOT EXISTS
        payment_claims_account_idx

      ON payment_claims (

        account_id,

        product

      );


      /*
       * EXPLICIT DUPLICATE PROTECTION
       *
       * RAISE(ABORT) prevents
       * INSERT OR REPLACE from replacing
       * an existing payment claim.
       */

      CREATE TRIGGER IF NOT EXISTS
        payment_claims_reject_duplicate

      BEFORE INSERT ON payment_claims

      WHEN EXISTS (

        SELECT 1

        FROM payment_claims

        WHERE chain = NEW.chain

          AND network = NEW.network

          AND (

            transaction_signature =
              NEW.transaction_signature

            OR quote_id = NEW.quote_id

          )

      )

      BEGIN

        SELECT RAISE(

          ABORT,

          'global_payment_already_used'

        );

      END;


      /*
       * APPEND-ONLY CLAIM HISTORY
       */

      CREATE TRIGGER IF NOT EXISTS
        payment_claims_prevent_update

      BEFORE UPDATE ON payment_claims

      BEGIN

        SELECT RAISE(

          ABORT,

          'payment_claims_are_immutable'

        );

      END;


      CREATE TRIGGER IF NOT EXISTS
        payment_claims_prevent_delete

      BEFORE DELETE ON payment_claims

      BEGIN

        SELECT RAISE(

          ABORT,

          'payment_claims_are_immutable'

        );

      END;

    `);


    /*
     * MIGRATE EXISTING SUBSCRIPTIONS
     *
     * Skip only exact matching claims.
     * Conflicting existing claims
     * must abort the migration.
     */

    const migrate = db.prepare(`

      INSERT INTO payment_claims (

        chain,

        network,

        transaction_signature,

        quote_id,

        account_id,

        product,

        recorded_at

      )

      SELECT

        ?,

        ?,

        s.transaction_signature,

        s.quote_id,

        s.account_id,

        ?,

        s.paid_at

      FROM subscription_payments AS s

      WHERE NOT EXISTS (

        SELECT 1

        FROM payment_claims AS p

        WHERE p.chain = ?

          AND p.network = ?

          AND p.transaction_signature =
            s.transaction_signature

          AND p.quote_id = s.quote_id

          AND p.account_id = s.account_id

          AND p.product = ?

          AND p.recorded_at = s.paid_at

      )

    `);


    migrate.run(

      CHAIN,

      NETWORK,

      PRODUCT,

      CHAIN,

      NETWORK,

      PRODUCT

    );


    /*
     * CHECK MIGRATION CONSISTENCY
     *
     * A subscription claim must have
     * its matching subscription row.
     */

    const orphan = db.prepare(`

      SELECT p.transaction_signature

      FROM payment_claims AS p

      WHERE p.chain = ?

        AND p.network = ?

        AND p.product = ?

        AND NOT EXISTS (

          SELECT 1

          FROM subscription_payments AS s

          WHERE s.transaction_signature =
            p.transaction_signature

            AND s.quote_id = p.quote_id

            AND s.account_id = p.account_id

            AND s.paid_at = p.recorded_at

        )

      LIMIT 1

    `).get(

      CHAIN,

      NETWORK,

      PRODUCT

    );


    if (orphan) {

      throw new Error(
        "payment_registry_integrity_failed"
      );

    }


    /*
     * ATOMIC SUBSCRIPTION CLAIM
     *
     * Constants below match the
     * current subscription policy.
     *
     * The trigger participates in
     * the subscription transaction.
     */

    if (

      CHAIN !== "solana" ||

      NETWORK !== "mainnet-beta" ||

      PRODUCT !== "personal-ai-agent"

    ) {

      throw new Error(
        "payment_registry_policy_mismatch"
      );

    }


    db.exec(`

      CREATE TRIGGER IF NOT EXISTS
        subscription_register_payment_claim

      AFTER INSERT ON subscription_payments

      BEGIN

        INSERT INTO payment_claims (

          chain,

          network,

          transaction_signature,

          quote_id,

          account_id,

          product,

          recorded_at

        ) VALUES (

          'solana',

          'mainnet-beta',

          NEW.transaction_signature,

          NEW.quote_id,

          NEW.account_id,

          'personal-ai-agent',

          NEW.paid_at

        );

      END;


      /*
       * Subscription payment records
       * are financial history.
       *
       * Do not mutate or remove them.
       */

      CREATE TRIGGER IF NOT EXISTS
        subscription_prevent_payment_update

      BEFORE UPDATE ON subscription_payments

      BEGIN

        SELECT RAISE(

          ABORT,

          'subscription_payments_are_immutable'

        );

      END;


      CREATE TRIGGER IF NOT EXISTS
        subscription_prevent_payment_delete

      BEFORE DELETE ON subscription_payments

      BEGIN

        SELECT RAISE(

          ABORT,

          'subscription_payments_are_immutable'

        );

      END;

    `);


    db.exec("COMMIT");

    committed = true;

  } finally {

    if (!committed) {

      db.exec("ROLLBACK");

    }

  }


  /*
   * INTERNAL READ-ONLY LOOKUP
   */

  const findSignature = db.prepare(`

    SELECT *

    FROM payment_claims

    WHERE chain = ?

      AND network = ?

      AND transaction_signature = ?

  `);


  const findQuote = db.prepare(`

    SELECT *

    FROM payment_claims

    WHERE chain = ?

      AND network = ?

      AND quote_id = ?

  `);


  function findBySignature(signature) {

    if (!validSignature(signature)) {

      return Object.freeze({

        ok: false,

        reason: "invalid_transaction_signature",

        claim: null

      });

    }


    try {

      const claim = projectClaim(

        findSignature.get(

          CHAIN,

          NETWORK,

          signature

        )

      );


      return Object.freeze({

        ok: true,

        found: claim !== null,

        claim

      });

    } catch {

      return Object.freeze({

        ok: false,

        reason: "payment_registry_unavailable",

        claim: null

      });

    }

  }


  function findByQuote(quoteId) {

    if (!validQuoteId(quoteId)) {

      return Object.freeze({

        ok: false,

        reason: "invalid_quote_id",

        claim: null

      });

    }


    try {

      const claim = projectClaim(

        findQuote.get(

          CHAIN,

          NETWORK,

          quoteId

        )

      );


      return Object.freeze({

        ok: true,

        found: claim !== null,

        claim

      });

    } catch {

      return Object.freeze({

        ok: false,

        reason: "payment_registry_unavailable",

        claim: null

      });

    }

  }


  /*
   * SERVER-ONLY REGISTRY API
   *
   * No arbitrary public claim method.
   * Claims are written atomically
   * by paid product SQL triggers.
   */

  return Object.freeze({

    version:
      PAYMENT_REGISTRY_VERSION,

    findBySignature,

    findByQuote,

    getPolicy() {

      return POLICY;

    }

  });

}

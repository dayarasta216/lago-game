(() => {
  "use strict";

  /*
   * =========================================================
   * LAGO PREMIUM PURCHASE CONTRACT — v1
   * =========================================================
   *
   * Client-side contract only.
   *
   * NO fake $LAGO.
   * NO localStorage unlock.
   * NO client-side entitlement.
   * NO private keys.
   *
   * Real payment arrives in R0.5E.
   */

  const CONTRACT_VERSION =
    1;


  const PROTOCOL =
    "lago-premium-v1";


  const CHAIN =
    "solana";


  const TOKEN_SYMBOL =
    "$LAGO";


  /*
   * Production values remain empty
   * until the real mint / treasury /
   * backend endpoints are fixed.
   */
 const PAYMENT_CONFIG =
  Object.freeze({

    quoteEndpoint:
      "",

    verifyEndpoint:
      ""

  });


  function cleanString(
    value
  ) {

    return String(
      value ?? ""
    ).trim();

  }


  function makeClientRequestId() {

    try {

      if (
        globalThis.crypto &&
        typeof globalThis.crypto.randomUUID ===
          "function"
      ) {

        return globalThis.crypto
          .randomUUID();

      }

    } catch {
      // Fallback below.
    }


    return [
      "lago",
      Date.now()
        .toString(36),
      Math.random()
        .toString(36)
        .slice(2)
    ].join("-");

  }


  function getConfigurationStatus() {

   const tokenStatus =
  window.LAGO_TOKEN_CONFIG
    ?.validateIdentity
    ?.();


const tokenMint =
  cleanString(
    tokenStatus
      ?.identity
      ?.mint
  );


const treasuryWallet =
  cleanString(
    tokenStatus
      ?.identity
      ?.treasuryWallet
  );


    const quoteEndpoint =
      cleanString(
        PAYMENT_CONFIG.quoteEndpoint
      );


    const verifyEndpoint =
      cleanString(
        PAYMENT_CONFIG.verifyEndpoint
      );


    return {

      configured:
  Boolean(
    tokenStatus
      ?.ready === true &&
    quoteEndpoint &&
    verifyEndpoint
  ),

      chain:
        CHAIN,

      tokenSymbol:
        TOKEN_SYMBOL,

      tokenMint,

      treasuryWallet,

      quoteEndpoint,

      verifyEndpoint

    };

  }


  function buildTapAutoPurchaseRequest() {

    const account =
      window.LAGO_ACCOUNT;


    if (
      !account ||
      typeof account.getTapAutoUpgradeState !==
        "function"
    ) {

      return {
        ok:
          false,

        reason:
          "account_unavailable"
      };

    }


    const auto =
      account
        .getTapAutoUpgradeState();


    if (
      !auto ||
      auto.maxed === true
    ) {

      return {
        ok:
          false,

        reason:
          "max"
      };

    }


    const currentLevel =
      Math.max(
        0,
        Math.floor(
          Number(
            auto.level
          ) || 0
        )
      );


    const targetLevel =
      Math.max(
        currentLevel + 1,

        Math.floor(
          Number(
            auto.nextLevel
          ) ||
          currentLevel + 1
        )
      );


    /*
     * This is NOT a trusted quote.
     *
     * Backend will calculate:
     *
     * USD price
     * current $LAGO amount
     * exact mint
     * treasury
     * expiry
     */
    return {

      ok:
        true,

      request: {

        protocol:
          PROTOCOL,

        contractVersion:
          CONTRACT_VERSION,

        clientRequestId:
          makeClientRequestId(),

        productType:
          "tap-auto-upgrade",

        catalogKey:
          `tap-auto-level-${targetLevel}`,

        gameId:
          "tap-lago",

        currentLevel,

        targetLevel,

        entitlement: {

          type:
            "tap-auto-level",

          level:
            targetLevel

        },

        payment: {

          chain:
            CHAIN,

          tokenSymbol:
            TOKEN_SYMBOL,

          quoteMode:
            "server-live-quote",

          tokenMint:
            null,

          treasuryWallet:
            null,

          amountBaseUnits:
            null,

          tokenDecimals:
            null,

          usdPriceCents:
            null,

          quoteId:
            null,

          expiresAt:
            null

        },

        verification: {

          required:
            true,

          authority:
            "backend",

          transactionSignature:
            null,

          replayProtected:
            true

        }

      }

    };

  }


  function validateQuoteShape(
    quote,
    request
  ) {

    if (
      !quote ||
      typeof quote !==
        "object" ||
      !request ||
      typeof request !==
        "object"
    ) {

      return false;

    }


    const amountBaseUnits =
      cleanString(
        quote.amountBaseUnits
      );


    const expiresAt =
      Date.parse(
        cleanString(
          quote.expiresAt
        )
      );


    return Boolean(

      cleanString(
        quote.quoteId
      ) &&

      quote.protocol ===
        PROTOCOL &&

      quote.productType ===
        request.productType &&

      quote.catalogKey ===
        request.catalogKey &&

      Number(
        quote.targetLevel
      ) ===
        request.targetLevel &&

      quote.chain ===
        CHAIN &&

      cleanString(
        quote.tokenMint
      ) &&

      cleanString(
        quote.treasuryWallet
      ) &&

      /^\d+$/.test(
        amountBaseUnits
      ) &&

      BigInt(
        amountBaseUnits
      ) > 0n &&

      Number.isInteger(
        Number(
          quote.tokenDecimals
        )
      ) &&

      Number(
        quote.tokenDecimals
      ) >= 0 &&

      Number(
        quote.tokenDecimals
      ) <= 18 &&

      Number.isFinite(
        expiresAt
      ) &&

      expiresAt >
        Date.now()

    );

  }


  async function beginTapAutoPurchase() {

    const built =
      buildTapAutoPurchaseRequest();


    if (
      !built.ok
    ) {

      return built;

    }


    const config =
      getConfigurationStatus();


    /*
     * Fail closed.
     *
     * Until real production configuration
     * exists, NOTHING can be purchased.
     */
    if (
      !config.configured
    ) {

      return {

        ok:
          false,

        reason:
          "payment_not_configured",

        request:
          built.request

      };

    }


    /*
     * R0.5E later:
     *
     * request quote
     * → validate quote
     * → Phantom
     * → transaction
     * → backend verification
     * → entitlement sync
     */
    return {

      ok:
        false,

      reason:
        "payment_backend_not_connected",

      request:
        built.request

    };

  }


  window.LAGO_PREMIUM =
    Object.freeze({

      version:
        CONTRACT_VERSION,

      protocol:
        PROTOCOL,

      getConfigurationStatus,

      buildTapAutoPurchaseRequest,

      validateQuoteShape,

      beginTapAutoPurchase

    });

})();

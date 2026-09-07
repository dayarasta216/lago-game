(() => {
  "use strict";

  /*
   * =========================================================
   * $LAGO — CANONICAL TOKEN IDENTITY
   * R0.5E1
   * =========================================================
   *
   * One source of truth for:
   *
   * Solana network
   * real $LAGO mint
   * token decimals
   * treasury wallet
   * Pump.fun identity
   *
   * IMPORTANT:
   *
   * Empty production values mean:
   * FAIL CLOSED.
   *
   * The game must NEVER invent
   * a fake $LAGO balance.
   */

  const VERSION =
    1;


  const CHAIN =
    "solana";


  const NETWORK =
    "mainnet-beta";


  /*
   * Fill these only after
   * the real production token
   * and treasury are confirmed.
   */
  const TOKEN_MINT =
    "";


  const TOKEN_DECIMALS =
    null;


  const TREASURY_WALLET =
    "";


  const PUMP_FUN_URL =
    "";


  function cleanString(
    value
  ) {

    return String(
      value ?? ""
    ).trim();

  }


  function isBase58Address(
    value
  ) {

    const text =
      cleanString(
        value
      );


    /*
     * Solana public keys are
     * Base58 encoded.
     *
     * This is only a structural
     * client-side check.
     *
     * Real validation occurs
     * against Solana / backend.
     */
    return (
      text.length >= 32 &&
      text.length <= 44 &&
      /^[1-9A-HJ-NP-Za-km-z]+$/
        .test(text)
    );

  }


  function getIdentity() {

    return {

      version:
        VERSION,

      chain:
        CHAIN,

      network:
        NETWORK,

      symbol:
        "$LAGO",

      mint:
        cleanString(
          TOKEN_MINT
        ),

      decimals:
        Number.isInteger(
          TOKEN_DECIMALS
        )
          ? TOKEN_DECIMALS
          : null,

      treasuryWallet:
        cleanString(
          TREASURY_WALLET
        ),

      pumpFunUrl:
        cleanString(
          PUMP_FUN_URL
        )

    };

  }


  function validateIdentity() {

    const identity =
      getIdentity();


    const validMint =
      isBase58Address(
        identity.mint
      );


    const validTreasury =
      isBase58Address(
        identity.treasuryWallet
      );


    const validDecimals =
      Number.isInteger(
        identity.decimals
      ) &&
      identity.decimals >= 0 &&
      identity.decimals <= 18;


    const validPumpFunUrl =
      identity.pumpFunUrl
        .startsWith(
          "https://"
        );


    return {

      ready:
        validMint &&
        validTreasury &&
        validDecimals &&
        validPumpFunUrl,

      validMint,

      validTreasury,

      validDecimals,

      validPumpFunUrl,

      identity

    };

  }


  function requireProductionIdentity() {

    const status =
      validateIdentity();


    if (
      !status.ready
    ) {

      throw new Error(
        "$LAGO production identity is not configured"
      );

    }


    return status.identity;

  }


  window.LAGO_TOKEN_CONFIG =
    Object.freeze({

      version:
        VERSION,

      getIdentity,

      validateIdentity,

      requireProductionIdentity,

      isBase58Address

    });

})();

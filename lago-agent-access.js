
(() => {
  "use strict";

  /*
   * LAGO GAME
   * R1.8H — Premium AI access foundation.
   *
   * Fail-closed access policy.
   *
   * Game characters and AI licenses
   * are separate products.
   *
   * AI can only be activated after
   * server-verified $LAGO payment.
   *
   * No localStorage licenses.
   * No free activation.
   * No XP-based activation.
   * No client-side payment bypass.
   */

  const VERSION = 1;

  const POLICY = Object.freeze({

    product: "personal-ai-agent",

    currency: "LAGO",

    network: "solana",

    tokenMint:
      "J9BmsKsS6PH7QGxDWA43YVbsmTxavgFmu5ScSDzWpump",

    maxActiveAgents: 1,

    purchaseCooldownMs:
      24 * 60 * 60 * 1000,

    freeAccess: false,

    unlockWithXP: false,

    unlockWithSP: false,

    serverVerificationRequired: true

  });


  function getCharacter() {

    const context =
      window.LAGO_MINIGAMES
        ?.getContext?.();

    return {

      id:
        String(
          context?.characterId || "lago"
        ),

      name:
        String(
          context?.characterName || "Lago"
        )

    };

  }


  function getState() {

    const character = getCharacter();

    return Object.freeze({

      version: VERSION,

      product: POLICY.product,

      status: "locked",

      entitled: false,

      aiEnabled: false,

      chatEnabled: false,

      memoryEnabled: false,

      learningEnabled: false,

      marketAnalysisEnabled: false,

      tradingEnabled: false,

      characterId: character.id,

      characterName: character.name,

      currency: POLICY.currency,

      tokenMint: POLICY.tokenMint,

      network: POLICY.network,

      checkoutAvailable: false,

      serverVerified: false,

      price: null,

      reason: "payment_service_unavailable"

    });

  }


  function getPolicy() {

    return POLICY;

  }


  function canUseAI() {

    /*
     * Access remains locked until a
     * trusted backend verifies payment
     * and provides an active entitlement.
     */

    return false;

  }


  function canTrade() {

    /*
     * Paid AI access alone does not
     * authorize financial operations.
     *
     * Separate trading authorization
     * and risk controls are required.
     */

    return false;

  }


  function emit() {

    document.dispatchEvent(

      new CustomEvent(
        "lago:agent-access-state",
        {
          detail: getState()
        }
      )

    );

  }


  document.addEventListener(

    "lago:character-equipped",

    emit

  );


  window.LAGO_AGENT_ACCESS =
    Object.freeze({

      version: VERSION,

      getState,

      getPolicy,

      canUseAI,

      canTrade

    });


  document.dispatchEvent(

    new CustomEvent(
      "lago:agent-access-ready",
      {
        detail: getState()
      }
    )

  );

})();

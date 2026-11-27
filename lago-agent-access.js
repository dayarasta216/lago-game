
(() => {
  "use strict";

  /*
   * LAGO GAME
   * R1.10A — Monthly AI subscription.
   *
   * Free gameplay.
   * Paid AI intelligence.
   * Server-verified subscription.
   */

  const VERSION = 2;

  const POLICY = Object.freeze({

    product: "personal-ai-agent",

    billingModel: "subscription",

    billingInterval: "month",

    billingIntervalCount: 1,

    currency: "LAGO",

    network: "solana",

    tokenMint:
      "J9BmsKsS6PH7QGxDWA43YVbsmTxavgFmu5ScSDzWpump",

    subscriptionScope: "account",

    maxActiveAgents: 1,

    autoRenewal: false,

    freeTrial: false,

    freeAccess: false,

    unlockWithXP: false,

    unlockWithSP: false,

    preserveCharacterOnExpiry: true,

    preserveMemoryOnExpiry: true,

    preserveProgressOnExpiry: true,

    serverVerificationRequired: true,

    separateTradingAuthorization: true

  });


  function getCharacter() {

    const context =
      window.LAGO_MINIGAMES
        ?.getContext?.();

    return {

      id: String(
        context?.characterId || "lago"
      ),

      name: String(
        context?.characterName || "Lago"
      )

    };

  }


  function getState() {

    const character = getCharacter();

    return Object.freeze({

      version: VERSION,

      product: POLICY.product,

      billingModel: POLICY.billingModel,

      billingInterval: POLICY.billingInterval,

      billingIntervalCount: 1,

      subscriptionScope:
        POLICY.subscriptionScope,

      subscriptionStatus: "inactive",

      subscriptionId: null,

      subscriptionStartedAt: null,

      currentPeriodStart: null,

      currentPeriodEnd: null,

      nextBillingAt: null,

      daysRemaining: null,

      autoRenewal: false,

      renewalAvailable: false,

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
     * Future backend requirements:
     *
     * Verified account identity.
     * Verified $LAGO payment.
     * Active subscription.
     * Valid server-side expiry date.
     *
     * No local activation.
     */

    return false;

  }


  function canTrade() {

    /*
     * Requires active subscription
     * and separate trading authorization.
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

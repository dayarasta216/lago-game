
(() => {
  "use strict";

  /*
   * LAGO GAME
   * R1.8J1 — Premium AI chat access.
   *
   * No scripted AI replies.
   * No simulated intelligence.
   * No free AI activation.
   * Server-verified entitlement required.
   */

  const VERSION = 3;

  const MAX_MESSAGE_LENGTH = 500;

  let lastStateKey = "";


  function clean(value) {

    return String(
      value ?? ""
    ).trim();

  }


  function getContext() {

    const account =
      window.LAGO_ACCOUNT;

    const runtime =
      window.LAGO_MINIGAMES;

    if (
      !account ||
      !runtime?.getContext
    ) {
      return null;
    }

    const state =
      account.getState?.() || {};

    const auth =
      account.getAuthIdentity?.() || {};

    const context =
      runtime.getContext();

    if (!context) {
      return null;
    }

    return {

      scope: JSON.stringify([

        clean(state.social?.userId),

        clean(auth.provider),

        clean(auth.telegramId),

        clean(auth.walletPublicKey),

        clean(context.characterId)

      ]),

      characterId:
        clean(context.characterId) ||
        "lago",

      characterName:
        clean(context.characterName) ||
        "Lago",

      language:
        clean(state.language) ||
        "en"

    };

  }


 
  /*
   * R1.10C1 — Subscription-aware AI chat.
   */

  function getState() {

    const context = getContext();

    const access =
      window.LAGO_AGENT_ACCESS
        ?.getState?.();

    const subscriptionStatus =
      access?.subscriptionStatus ||
      "inactive";

    const periodEnd =
      Date.parse(
        access?.currentPeriodEnd || ""
      );

    const periodValid =
      Number.isFinite(periodEnd) &&
      periodEnd > Date.now();

    const entitled = Boolean(

      context &&

      access?.billingModel ===
        "subscription" &&

      access?.subscriptionStatus ===
        "active" &&

      access?.serverVerified === true &&

      access?.entitled === true &&

      access?.chatEnabled === true &&

      access?.characterId ===
        context.characterId &&

      periodValid

    );


    /*
     * A valid subscription alone does
     * not mean that an AI backend exists.
     *
     * Chat remains locked until the real
     * authenticated AI service is ready.
     */

    return {

      version: VERSION,

      ready: false,

      mode: "subscription-locked",

      aiConnected: false,

      entitled,

      locked: true,

      billingModel: "subscription",

      billingInterval: "month",

      subscriptionStatus,

      subscriptionRequired: !entitled,

      renewalRequired:
        subscriptionStatus === "expired" ||
        (
          subscriptionStatus === "active" &&
          !periodValid
        ),

      /*
       * Temporary compatibility field
       * for the existing chat interface.
       */

      purchaseRequired: !entitled,

      currentPeriodEnd:
        access?.currentPeriodEnd || null,

      daysRemaining:
        access?.daysRemaining ?? null,

      autoRenewal:
        access?.autoRenewal === true,

      checkoutAvailable:
        access?.checkoutAvailable === true,

      renewalAvailable:
        access?.renewalAvailable === true,

      currency: "LAGO",

      characterId:
        context?.characterId || null,

      characterName:
        context?.characterName || "",

      reason:
        !context
          ? "agent_not_ready"
          : !entitled
            ? "subscription_required"
            : "ai_service_unavailable",

      messages: []

    };

  }



  function emit() {

    document.dispatchEvent(

      new CustomEvent(
        "lago:agent-chat-state",
        {
          detail: getState()
        }
      )

    );

  }


  function send(input) {

    const current = getState();

    if (!current.ready) {

      return {

        ok: false,

        reason: current.reason,

        state: current

      };

    }

    const text = clean(input);

    if (!text) {

      return {
        ok: false,
        reason: "empty_message"
      };

    }

    if (text.length > MAX_MESSAGE_LENGTH) {

      return {
        ok: false,
        reason: "message_too_long"
      };

    }

    /*
     * No request is sent without
     * a real authenticated AI backend.
     */

    return {

      ok: false,

      reason: "ai_service_unavailable"

    };

  }


  function clear() {

    emit();

    return getState();

  }


  function handleContextChange() {

    const context = getContext();

    const state = getState();

    const key = JSON.stringify([

      context?.scope || "",

      state.characterId,

      state.characterName,

      
      state.entitled,

      state.locked,

      state.subscriptionStatus,

      state.subscriptionRequired,

      state.renewalRequired,

      state.currentPeriodEnd,

      state.daysRemaining,

      state.autoRenewal,

      state.checkoutAvailable,

      state.renewalAvailable,

      state.reason


    ]);

    if (key === lastStateKey) {
      return;
    }

    lastStateKey = key;

    emit();

  }


  document.addEventListener(
    "lago:account-state",
    handleContextChange
  );

  document.addEventListener(
    "lago:state",
    handleContextChange
  );

  document.addEventListener(
    "lago:character-equipped",
    handleContextChange
  );

  document.addEventListener(
    "lago:agent-access-ready",
    handleContextChange
  );

  document.addEventListener(
    "lago:agent-access-state",
    handleContextChange
  );


  window.LAGO_AGENT_CHAT =
    Object.freeze({

      version: VERSION,

      getState,

      send,

      clear

    });


  document.dispatchEvent(

    new CustomEvent(
      "lago:agent-chat-ready",
      {
        detail: getState()
      }
    )

  );

})();

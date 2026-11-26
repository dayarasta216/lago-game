
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

  const VERSION = 2;

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


  function getState() {

    const context = getContext();

    const access =
      window.LAGO_AGENT_ACCESS
        ?.getState?.();

    /*
     * No AI backend is connected.
     *
     * The chat remains unavailable
     * even if local state is modified.
     */

    const entitled =
      Boolean(
        context &&
        access?.entitled === true &&
        access?.serverVerified === true &&
        access?.chatEnabled === true &&
        access?.characterId ===
          context.characterId
      );

    return {

      version: VERSION,

      ready: false,

      mode: "premium-locked",

      aiConnected: false,

      entitled,

      locked: true,

      purchaseRequired: !entitled,

      checkoutAvailable:
        access?.checkoutAvailable === true,

      currency: "LAGO",

      characterId:
        context?.characterId || null,

      characterName:
        context?.characterName || "",

      reason:
        !context
          ? "agent_not_ready"
          : !entitled
            ? "purchase_required"
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

      state.checkoutAvailable,

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

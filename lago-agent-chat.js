
(() => {
  "use strict";

  /*
   * LAGO GAME 2.0
   * R1.5A — PERSONAL AGENT CHAT CORE
   *
   * Local dialogue prototype.
   * No external AI requests.
   * No financial operations.
   */

  const VERSION = 1;
  const MAX_MESSAGE_LENGTH = 500;
  const MAX_MESSAGES = 60;

  let activeScope = null;
  let messages = [];
  let sequence = 0;

  function clean(value) {
    return String(value ?? "").trim();
  }

  function getContext() {

    const account = window.LAGO_ACCOUNT;
    const runtime = window.LAGO_MINIGAMES;

    if (!account || !runtime?.getContext) {
      return null;
    }

    const state = account.getState?.() || {};
    const auth = account.getAuthIdentity?.() || {};
    const context = runtime.getContext();

    return {
      scope: JSON.stringify([
        clean(state.social?.userId),
        clean(auth.provider),
        clean(auth.telegramId),
        clean(auth.walletPublicKey),
        clean(context.characterId)
      ]),

      characterId:
        clean(context.characterId) || "lago",

      characterName:
        clean(context.characterName) || "Lago",

      language:
        clean(state.language) || "en"
    };

  }

  function createMessage(role, text, context) {

    return {
      id: ++sequence,
      role,
      text,
      characterId: context.characterId,
      createdAt: Date.now()
    };

  }

  function greeting(context) {

    if (context.language === "ru") {
      return `Я ${context.characterName}, твой персональный агент. Давай знакомиться. Мой AI-мозг пока загружается.`;
    }

    return `I'm ${context.characterName}, your personal agent. Let's get to know each other. My AI brain is still loading.`;

  }

  function syncContext() {

    const context = getContext();

    if (!context) {
      activeScope = null;
      messages = [];
      return null;
    }

    if (activeScope !== context.scope) {

      activeScope = context.scope;

      messages = [
        createMessage(
          "agent",
          greeting(context),
          context
        )
      ];

    }

    return context;

  }

  function getState() {

    const context = syncContext();

    return {
      version: VERSION,

      ready: Boolean(context),

      mode: "local-preview",

      aiConnected: false,

      characterId:
        context?.characterId || null,

      characterName:
        context?.characterName || "",

      messages:
        messages.map(message => ({ ...message }))
    };

  }

  function emit() {

    document.dispatchEvent(
      new CustomEvent("lago:agent-chat-state", {
        detail: getState()
      })
    );

  }

  /*
   * Temporary scripted replies.
   * These are NOT AI-generated answers.
   */

  function localReply(text, context) {

    const input = text.toLowerCase();

    const isRussian = context.language === "ru";

    if (
      /trade|trading|crypto|bitcoin|profit|торг|крипт|прибыл|биткоин/i
        .test(input)
    ) {

      return isRussian
        ? "Торговый движок ещё не подключён. Пока мы можем только знакомиться и тренироваться."
        : "My trading engine isn't connected yet. For now, we can train and get to know each other.";

    }

    if (
      /hello|^hi\b|hey|привет|здравствуй/i
        .test(input)
    ) {

      return isRussian
        ? "Привет! Мой мозг ещё загружается. Но я уже здесь."
        : "Hello! My brain is still loading. But I'm already here.";

    }

    if (
      /train|play|game|игра|играть|тренир/i
        .test(input)
    ) {

      return isRussian
        ? "Готов к тренировке. Когда подключат мой AI-мозг, смогу учиться вместе с тобой."
        : "Ready to train. Once my AI brain is connected, I'll be able to learn with you.";

    }

    if (
      /name|who are|имя|кто ты/i
        .test(input)
    ) {

      return isRussian
        ? `Я ${context.characterName}, твой выбранный персонаж и будущий AI-агент.`
        : `I'm ${context.characterName}, your selected character and future AI agent.`;

    }

    return isRussian
      ? "Я получил сообщение. Полноценный AI пока не подключён."
      : "I received your message. Full AI capabilities aren't connected yet.";

  }

  function send(input) {

    const context = syncContext();

    if (!context) {
      return {
        ok: false,
        reason: "agent_not_ready"
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

    messages.push(
      createMessage("user", text, context),

      createMessage(
        "agent",
        localReply(text, context),
        context
      )
    );

    messages = messages.slice(-MAX_MESSAGES);

    emit();

    return {
      ok: true,
      state: getState()
    };

  }

  function clear() {

    const context = getContext();

    activeScope = context?.scope || null;

    messages = context
      ? [
          createMessage(
            "agent",
            greeting(context),
            context
          )
        ]
      : [];

    emit();

    return getState();

  }

  function handleContextChange() {

    const previousScope = activeScope;

    syncContext();

    if (previousScope !== activeScope) {
      emit();
    }

  }

  document.addEventListener(
    "lago:account-state",
    handleContextChange
  );

  document.addEventListener(
    "lago:state",
    handleContextChange
  );

  window.LAGO_AGENT_CHAT = Object.freeze({

    version: VERSION,

    getState,

    send,

    clear

  });

  document.dispatchEvent(
    new CustomEvent("lago:agent-chat-ready", {
      detail: getState()
    })
  );

})();


(() => {
  "use strict";

  /*
   * LAGO GAME 2.0
   * R1.5B — PERSONAL AGENT CHAT UI
   * Borderless interface
   */

  const VERSION = 3;

  let panel = null;
  let opened = false;

  function installStyles() {

    if (document.getElementById("lgAgentChatStyles")) {
      return;
    }

    const style = document.createElement("style");

    style.id = "lgAgentChatStyles";

    
    style.textContent = `

      /* =================================================
         R1.9D — RESPONSIVE PREMIUM AI CHAT
         ================================================= */

      #lagoModern.lg-chat-docked {

        display: flex;
        flex-direction: column;

        height: 100vh;
        height: 100dvh;

        overflow: hidden;

      }

      #lagoModern.lg-chat-docked
      > .lago-game-area {

        flex: 1 1 0;

        min-height: 0;

        overflow-x: hidden;
        overflow-y: auto;

        overscroll-behavior: contain;

      }


      /* CHAT CONTAINER */

      #lagoModern.lg-chat-docked
      > .lg-agent-chat {

        position: relative;

        z-index: 6;

        display: block;

        box-sizing: border-box;

        flex: 0 0 auto;

        width: min(calc(100% - 32px), 620px);

        min-width: 0;

        margin: 0 auto;

        padding: 8px 0 12px;

        color: var(--lg-text);

        font-family: var(--lg-font);

        text-align: left;

        background: transparent;

        border: none;

        box-shadow: none;

      }

      #lagoModern
      .lg-agent-chat [hidden] {

        display: none !important;

      }


      /* HEADER */

      .lg-agent-header {

        display: flex;

        align-items: center;

        justify-content: space-between;

        gap: 12px;

        min-width: 0;

      }

      .lg-agent-heading {

        flex: 1 1 auto;

        min-width: 0;

      }

      .lg-agent-name {

        color: var(--lg-ai);

        font-size: 12px;
        font-weight: 750;

        line-height: 1.3;

        overflow-wrap: anywhere;

      }

      .lg-agent-status {

        margin-top: 4px;

        color: var(--lg-text-secondary);

        font-size: 10px;

        line-height: 1.3;

        letter-spacing: .04em;

      }


      /* PREMIUM ACCESS BUTTON */

      .lg-agent-toggle {

        flex: 0 0 auto;

        max-width: 52%;

        min-height: 44px;

        padding: 8px 14px;

        border:
          1px solid rgba(169,151,255,.28);

        border-radius: var(--lg-radius-md);

        background: var(--lg-ai-soft);

        color: var(--lg-ai);

        font-family: var(--lg-font);

        font-size: 11px;
        font-weight: 750;

        line-height: 1.35;

        text-align: center;

        white-space: normal;

        cursor: pointer;

        touch-action: manipulation;

      }

      .lg-agent-toggle:disabled {

        opacity: .5;

        cursor: not-allowed;

      }

      .lg-agent-toggle:focus-visible,

      .lg-agent-send:focus-visible {

        outline: 2px solid var(--lg-ai);

        outline-offset: 3px;

      }


      /* CHAT BODY */

      .lg-agent-body {

        margin-top: 6px;

        min-width: 0;

        overflow: visible;

      }

      .lg-agent-messages {

        display: flex;

        flex-direction: column;

        gap: 12px;

        height: clamp(90px, 20vh, 180px);
        height: clamp(90px, 20dvh, 180px);

        min-width: 0;

        padding: 6px 2px;

        overflow-x: hidden;
        overflow-y: auto;

        overscroll-behavior: contain;

        scrollbar-width: thin;

        scrollbar-color:
          var(--lg-border) transparent;

      }


      /* CHAT MESSAGES */

      .lg-agent-message {

        box-sizing: border-box;

        max-width: 90%;

        min-width: 0;

        font-size: 13px;

        line-height: 1.5;

        overflow-wrap: anywhere;

        white-space: pre-wrap;

      }

      .lg-agent-message.agent {

        align-self: flex-start;

        color: var(--lg-text);

      }

      .lg-agent-message.user {

        align-self: flex-end;

        padding: 8px 12px;

        color: var(--lg-accent);

        background: var(--lg-accent-soft);

        border-radius: 14px 14px 4px 14px;

      }

      .lg-agent-message-label {

        display: block;

        margin-bottom: 4px;

        color: var(--lg-ai);

        font-size: 10px;

        font-weight: 700;

      }


      /* MESSAGE COMPOSER */

      .lg-agent-form {

        display: flex;

        align-items: center;

        flex-shrink: 0;

        width: 100%;

        min-height: 44px;

        gap: 8px;

        margin-top: 5px;

      }

      .lg-agent-input {

        box-sizing: border-box;

        display: block;

        flex: 1 1 auto;

        min-width: 0;

        width: 100%;

        height: 44px;

        padding: 10px 12px;

        border: none;

        border-radius: var(--lg-radius-md);

        background: var(--lg-surface);

        color: var(--lg-text);

        font-family: var(--lg-font);

        font-size: 16px;

        outline: none;

        box-shadow: none;

      }

      .lg-agent-input::placeholder {

        color: var(--lg-text-secondary);

        opacity: 1;

      }

      .lg-agent-input:disabled {

        opacity: 1;

        color: var(--lg-text-muted);

        -webkit-text-fill-color:
          var(--lg-text-muted);

        cursor: not-allowed;

      }

      .lg-agent-input:focus-visible {

        outline: 2px solid var(--lg-ai);

        outline-offset: -2px;

      }


      /* SPIRAL SEND BUTTON */

      .lg-agent-send {

        display: grid;

        place-items: center;

        flex: 0 0 44px;

        width: 44px;
        height: 44px;

        padding: 0;

        border: 1px solid var(--lg-accent);

        border-radius: var(--lg-radius-md);

        background: var(--lg-accent);

        color: var(--lg-on-accent);

        cursor: pointer;

        touch-action: manipulation;

      }

      .lg-agent-send svg {

        display: block;

        width: 28px;
        height: 28px;

        pointer-events: none;

      }

      .lg-agent-send:disabled {

        opacity: .4;

        cursor: not-allowed;

      }

      .lg-agent-send:active:not(:disabled) {

        transform: scale(.95);

      }


      /* STATUS AND ACCESS INFORMATION */

      .lg-agent-error {

        margin-top: 5px;

        color: var(--lg-danger);

        font-size: 11px;

        line-height: 1.4;

      }

      .lg-agent-error:empty {

        display: none;

      }

      .lg-agent-note {

        margin-top: 6px;

        color: var(--lg-text-secondary);

        font-size: 10px;

        line-height: 1.4;

      }

      .lg-agent-note:empty {

        display: none;

      }


      /* LOCKED AI STATE */

      .lg-agent-chat[data-ai-locked="true"]
      .lg-agent-status {

        color: var(--lg-ai);

      }

      .lg-agent-chat[data-ai-locked="true"]
      .lg-agent-send {

        border-color: transparent;

        background: var(--lg-surface);

        color: var(--lg-text-muted);

        opacity: 1;

      }

      .lg-agent-chat[data-ai-locked="true"]
      .lg-agent-note {

        display: block;

      }


      /* TABLET AND PHONE */

      @media (max-width: 899px) {

        #lagoModern.lg-chat-docked
        > .lg-agent-chat {

          width: calc(100% - 24px);

          padding: 6px 0 8px;

        }

        .lg-agent-header {

          gap: 8px;

        }

        .lg-agent-messages {

          height: clamp(80px, 18vh, 150px);
          height: clamp(80px, 18dvh, 150px);

        }

      }


      /* SMALL PHONES */

      @media (max-width: 380px) {

        .lg-agent-name {

          font-size: 11px;

        }

        .lg-agent-status {

          font-size: 9px;

        }

        .lg-agent-toggle {

          padding: 6px 9px;

          font-size: 10px;

        }

        .lg-agent-note {

          font-size: 9px;

        }

      }


      /* SHORT DISPLAYS */

      @media (max-height: 600px) {

        #lagoModern.lg-chat-docked
        > .lg-agent-chat {

          padding-top: 4px;

          padding-bottom: 4px;

        }

        .lg-agent-messages {

          height: 64px;

        }

        .lg-agent-body {

          margin-top: 3px;

        }

        .lg-agent-note {

          font-size: 9px;

        }

      }


      /* POINTER DEVICES */

      @media (hover: hover) and (pointer: fine) {

        .lg-agent-toggle:not(:disabled):hover {

          background: rgba(169,151,255,.18);

        }

      }


      /* ACCESSIBILITY */

      @media (prefers-reduced-motion: reduce) {

        .lg-agent-chat * {

          transition: none;

          scroll-behavior: auto;

        }

        .lg-agent-send:active:not(:disabled) {

          transform: none;

        }

      }

    `;



    document.head.appendChild(style);

  }

  function isRussian() {

    return window.LAGO_ACCOUNT
      ?.getState?.()?.language === "ru";

  }

  function setOpened(value) {

    if (!panel) return;

    opened = Boolean(value);

    const body = panel.querySelector(".lg-agent-body");
    const toggle = panel.querySelector(".lg-agent-toggle");

   body.hidden = false;

body.querySelector(
  ".lg-agent-messages"
).hidden = !opened;

    toggle.setAttribute(
      "aria-expanded",
      String(opened)
    );

    document.getElementById("lagoModern")
      ?.classList.toggle("lg-agent-open", opened);

    render();

  }

  function mount() {

    if (panel?.isConnected) {
      return true;
    }

    const center = document.querySelector(
      "#lagoModern .lago-center"
    );

    if (!center || !window.LAGO_AGENT_CHAT) {
      return false;
    }

    installStyles();

    panel = document.createElement("section");

    panel.id = "lagoAgentChat";
    panel.className = "lg-agent-chat";

    panel.innerHTML = `

      <div class="lg-agent-header">

        <div class="lg-agent-heading">

          <div class="lg-agent-name"></div>

          <div class="lg-agent-status"></div>

        </div>

        <button
          class="lg-agent-toggle"
          type="button"
          aria-expanded="false"
          aria-controls="lgAgentChatMessages"
        ></button>

      </div>

      <div
        class="lg-agent-body"
        id="lgAgentChatBody"
        hidden
      >

        <div
         class="lg-agent-messages"
id="lgAgentChatMessages"
          role="log"
          aria-live="polite"
          aria-label="Agent messages"
        ></div>

        <form class="lg-agent-form">

          <input
            class="lg-agent-input"
            type="text"
            maxlength="500"
            autocomplete="off"
            aria-label="Message"
          >

          <button
            class="lg-agent-send"
            type="submit"
            aria-label="Send message"
            disabled
          >

            
<svg
  width="28"
  height="28"
  viewBox="0 0 28 28"
  fill="currentColor"
  aria-hidden="true"
>
  <path d="
    M12.9 27
    C5.5 26.3 0 21.5 0 14.6
    C0 6.9 6.6 1 14 1
    C21.7 1 28 7.2 28 14.7
    C28 21.4 23.2 26.5 17.7 26.5
    C12.2 26.5 7.5 22.1 7.5 16.8
    C7.5 12.4 10.1 9.6 13.8 9.6
    C16.5 9.6 18.6 11.8 18.6 14.4
    C18.6 16 17.5 17.1 16 17.1
    C14.9 17.1 14.2 16.2 14.8 15.5
    C15.7 14.4 14.2 13.7 13.5 14.7
    C12.2 16.5 13.7 18.6 15.8 18.6
    C18.2 18.6 20 16.8 20 14.1
    C20 10.7 17.3 8.1 13.8 8.1
    C9.1 8.1 6.1 12.1 6.1 16.6
    C6.1 21 8.5 24.7 12.9 27
    Z
  "/>
</svg>


          </button>

        </form>

        <div
          class="lg-agent-error"
          role="status"
        ></div>

        <div class="lg-agent-note"></div>

      </div>

    `;

  
    const root =
      document.getElementById("lagoModern");

    const gameArea =
      root.querySelector(".lago-game-area");

    gameArea.after(panel);

    root.classList.add("lg-chat-docked");


    const toggle = panel.querySelector(
      ".lg-agent-toggle"
    );

    const form = panel.querySelector(
      ".lg-agent-form"
    );

    const input = panel.querySelector(
      ".lg-agent-input"
    );

    const send = panel.querySelector(
      ".lg-agent-send"
    );

    
    toggle.addEventListener("click", () => {

      const current =
        window.LAGO_AGENT_CHAT.getState();

      if (current.purchaseRequired === true) {

        const shop = window.LAGO_SHOP;

        if (typeof shop?.show !== "function") {

          panel.querySelector(
            ".lg-agent-error"
          ).textContent = isRussian()
            ? "Магазин недоступен."
            : "Shop unavailable.";

          return;

        }

        setOpened(false);

        shop.show();

        document.getElementById("lagoShopAI")
          ?.scrollIntoView({
            block: "start",
            behavior: "auto"
          });

        return;

      }

      if (!current.ready) {
        return;
      }

      setOpened(!opened);

    });


    input.addEventListener("input", () => {

      send.disabled =
        !input.value.trim() ||
        !window.LAGO_AGENT_CHAT.getState().ready;

    });

    form.addEventListener("submit", event => {

      event.preventDefault();

      const error = panel.querySelector(
        ".lg-agent-error"
      );

      error.textContent = "";

      const result = window.LAGO_AGENT_CHAT.send(
        input.value
      );

      if (!result.ok) {

        error.textContent = isRussian()
          ? "Не удалось отправить сообщение."
          : "Could not send message.";

        return;

      }

      input.value = "";
send.disabled = true;

setOpened(true);


    });

    setOpened(false);

    return true;

  }

  function render(state = null) {

    if (!panel?.isConnected) return;

    const current =
      state || window.LAGO_AGENT_CHAT.getState();

    const ru = isRussian();

    const input = panel.querySelector(
      ".lg-agent-input"
    );

    const send = panel.querySelector(
      ".lg-agent-send"
    );

    const toggle = panel.querySelector(
      ".lg-agent-toggle"
    );

    const log = panel.querySelector(
      ".lg-agent-messages"
    );

    panel.querySelector(
      ".lg-agent-name"
    ).textContent =
      `${current.characterName || "LAGO"} CHAT`;

  
    const purchaseRequired =
      current.purchaseRequired === true;

    const locked =
      current.locked === true ||
      current.ready !== true;

    panel.dataset.aiLocked =
      String(locked);

    panel.querySelector(
      ".lg-agent-status"
    ).textContent = locked
      ? (
          purchaseRequired
            ? (ru ? "AI ЗАБЛОКИРОВАН" : "AI LOCKED")
            : (ru ? "AI НЕДОСТУПЕН" : "AI UNAVAILABLE")
        )
      : (ru ? "AI АКТИВЕН" : "AI ACTIVE");

    panel.querySelector(
      ".lg-agent-note"
    ).textContent = purchaseRequired
      ? (
          ru
            ? "Персональный AI доступен только после покупки за $LAGO."
            : "Personal AI requires a verified $LAGO purchase."
        )
      : locked
        ? (
            ru
              ? "AI-сервис пока недоступен."
              : "AI service is not available yet."
          )
        : "";

    if (locked) {

      opened = false;

      document.getElementById("lagoModern")
        ?.classList.remove("lg-agent-open");

      log.hidden = true;

      input.value = "";

      toggle.removeAttribute("aria-expanded");

      toggle.removeAttribute("aria-controls");

      toggle.disabled = !purchaseRequired;

      toggle.textContent = purchaseRequired
        ? (
            ru
              ? "ПОЛУЧИТЬ AI · $LAGO"
              : "GET AI · $LAGO"
          )
        : (
            ru
              ? "НЕДОСТУПНО"
              : "UNAVAILABLE"
          );

    } else {

      toggle.disabled = false;

      toggle.setAttribute(
        "aria-expanded",
        String(opened)
      );

      toggle.setAttribute(
        "aria-controls",
        "lgAgentChatMessages"
      );

      toggle.textContent = opened
        ? (ru ? "ЗАКРЫТЬ" : "CLOSE")
        : (ru ? "ОБЩАТЬСЯ" : "CHAT");

      log.hidden = !opened;

    }

    input.placeholder = locked
      ? (
          ru
            ? "AI-чат заблокирован..."
            : "AI chat is locked..."
        )
      : (
          ru
            ? "Сообщение персонажу..."
            : "Message your agent..."
        );



    input.setAttribute(
      "aria-label",
      ru ? "Сообщение" : "Message"
    );

    send.setAttribute(
      "aria-label",
      ru ? "Отправить" : "Send message"
    );

    input.disabled = !current.ready;

    send.disabled =
      !current.ready || !input.value.trim();

    log.replaceChildren();

    for (const message of current.messages) {

      const item = document.createElement("div");

      item.className =
        "lg-agent-message " +
        (message.role === "user" ? "user" : "agent");

      if (message.role === "agent") {

        const label = document.createElement("span");

        label.className = "lg-agent-message-label";

        label.textContent =
          current.characterName || "Lago";

        item.appendChild(label);

      }

      const content = document.createElement("span");

      /*
       * Never render messages as HTML.
       * User-provided text stays plain text.
       */

      content.textContent = message.text;

      item.appendChild(content);
      log.appendChild(item);

    }

    if (opened) {
      log.scrollTop = log.scrollHeight;
    }

  }

  document.addEventListener(
    "lago:agent-chat-state",
    event => {

      const state = event.detail;

      if (
        panel &&
        (!state?.ready || state.messages?.length === 1)
      ) {

        panel.querySelector(
          ".lg-agent-input"
        ).value = "";

        panel.querySelector(
          ".lg-agent-error"
        ).textContent = "";

      }

      render(state);

    }
  );

  document.addEventListener(
    "lago:language",
    () => render()
  );

  document.addEventListener(
    "lago:agent-chat-ready",
    mount
  );

  window.LAGO_AGENT_CHAT_UI = Object.freeze({

    version: VERSION,

    mount,

    open() {
      if (mount()) setOpened(true);
    },

    close() {
      setOpened(false);
    }

  });

  if (!mount() && document.readyState === "loading") {

    document.addEventListener(
      "DOMContentLoaded",
      mount,
      { once: true }
    );

  }

})();

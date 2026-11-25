
(() => {
  "use strict";

  /*
   * LAGO GAME 2.0
   * R1.5B — PERSONAL AGENT CHAT UI
   * Borderless interface
   */

  const VERSION = 1;

  let panel = null;
  let opened = false;

  function installStyles() {

    if (document.getElementById("lgAgentChatStyles")) {
      return;
    }

    const style = document.createElement("style");

    style.id = "lgAgentChatStyles";

    style.textContent = `

      #lagoModern .lg-agent-chat {
        box-sizing: border-box;
        flex: 0 0 auto;

        width: min(94%, 520px);
        min-width: 0;

        margin: 8px auto 0;

        color: var(--lg-text);
        font-family: var(--lg-font);
        text-align: left;

        background: transparent;
        border: none;
        box-shadow: none;
      }

      #lagoModern .lg-agent-chat [hidden] {
        display: none !important;
      }

      .lg-agent-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
      }

      .lg-agent-heading {
        flex: 1;
        min-width: 0;
      }

      .lg-agent-name {
        color: var(--lg-ai);
        font-size: 12px;
        font-weight: 750;
        overflow-wrap: anywhere;
      }

      .lg-agent-status {
        margin-top: 3px;
        color: var(--lg-text-secondary);
        font-size: 9px;
        letter-spacing: .06em;
      }

      .lg-agent-toggle {
        min-height: 44px;
        padding: 8px 14px;

        background: var(--lg-ai-soft);
        color: var(--lg-ai);

        border: 1px solid rgba(169,151,255,.24);
        border-radius: var(--lg-radius-md);

        font: 700 11px var(--lg-font);
        cursor: pointer;
        touch-action: manipulation;
      }

      .lg-agent-body {
        margin-top: 10px;
      }

      .lg-agent-messages {
        display: flex;
        flex-direction: column;

        gap: 12px;
        height: 180px;
        padding: 4px 2px;

        overflow-y: auto;
        overscroll-behavior: contain;

        scrollbar-width: thin;
        scrollbar-color: var(--lg-border) transparent;
      }

      .lg-agent-message {
        box-sizing: border-box;

        max-width: 90%;
        min-width: 0;

        font-size: 12px;
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

        margin-bottom: 3px;

        color: var(--lg-ai);

        font-size: 9px;
        font-weight: 700;
        letter-spacing: .06em;
      }

      .lg-agent-form {
        display: flex;
        align-items: center;

        gap: 8px;
        margin-top: 10px;
      }

      .lg-agent-input {
        box-sizing: border-box;

        flex: 1;
        min-width: 0;
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
        color: var(--lg-text-muted);
      }

      .lg-agent-input:focus-visible {
        outline: 2px solid var(--lg-ai);
        outline-offset: -2px;
      }

      .lg-agent-send {
        flex: 0 0 44px;

        width: 44px;
        height: 44px;

        display: grid;
        place-items: center;

        padding: 0;

        border: 1px solid var(--lg-accent);
        border-radius: var(--lg-radius-md);

        background: var(--lg-accent);
        color: var(--lg-on-accent);

        cursor: pointer;
        touch-action: manipulation;
      }

      .lg-agent-send:disabled {
        opacity: .4;
        cursor: default;
      }

      .lg-agent-error {
        margin-top: 6px;

        color: var(--lg-danger);
        font-size: 11px;
      }

      .lg-agent-note {
        margin-top: 7px;

        color: var(--lg-text-secondary);
        font-size: 10px;
        line-height: 1.4;
      }

      /* Keep the chat within the game screen. */

      
/* R1.5D — Always accessible composer */

#lagoModern .lago-game-area {
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior-y: contain;
}

#lagoModern .lago-game-area > .lago-center {
  height: auto;
  min-height: 0;
  overflow: visible;
}

#lagoModern .lg-agent-chat {
  display: block;
  flex-shrink: 0;
  overflow: visible;
  padding-bottom: 10px;
}

#lagoModern .lg-agent-body {
  display: block;
  overflow: visible;
}

#lagoModern .lg-agent-form {
  display: flex;
  flex-shrink: 0;
  width: 100%;
  min-height: 44px;
  overflow: visible;
}

#lagoModern .lg-agent-input {
  display: block;
  visibility: visible;
  opacity: 1;
  min-width: 0;
  font-size: 16px;
}

#lagoModern .lg-agent-send {
  display: grid;
  place-items: center;
  visibility: visible;
  flex-shrink: 0;
}

#lagoModern .lg-agent-send svg {
  display: block;
  width: 28px;
  height: 28px;
  pointer-events: none;
}

#lagoModern .lg-agent-send:disabled {
  opacity: .5;
}

#lagoModern .lg-agent-send:active:not(:disabled) {
  transform: scale(.94);
}

#lagoModern.lg-agent-open .lago-center {
  justify-content: flex-start;
}

@media (max-width: 899px) {

  #lagoModern .lago-game-area {
    grid-template-rows: auto;
  }

  #lagoModern .lago-game-area > .lago-center {
    flex: 0 0 auto;
    width: 100%;
    height: auto;
    min-height: 0;
    overflow: visible;
  }

  #lagoModern .lg-agent-chat {
    width: 94%;
    margin-top: 5px;
  }

  #lagoModern .lg-agent-messages {
    height: clamp(90px, 20dvh, 140px);
  }

}

      @media (prefers-reduced-motion: reduce) {

        .lg-agent-chat * {
          transition: none;
          scroll-behavior: auto;
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
              width="21"
              height="21"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <path d="M12 19V5"/>
              <path d="m5 12 7-7 7 7"/>
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

    center.appendChild(panel);

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

form.scrollIntoView({
  block: "nearest",
  inline: "nearest"
});

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

    panel.querySelector(
      ".lg-agent-status"
    ).textContent = ru
      ? "ЛОКАЛЬНЫЙ РЕЖИМ"
      : "LOCAL PREVIEW";

    panel.querySelector(
      ".lg-agent-note"
    ).textContent = ru
      ? "Тестовые ответы. AI-модель пока не подключена."
      : "Scripted replies. AI model not connected yet.";

    toggle.textContent = opened
      ? (ru ? "ЗАКРЫТЬ" : "CLOSE")
      : (ru ? "ОБЩАТЬСЯ" : "CHAT");

    input.placeholder = ru
      ? "Сообщение персонажу..."
      : "Message your agent...";

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

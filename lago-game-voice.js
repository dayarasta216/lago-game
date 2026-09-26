
/*
 * LAGO GAME — SHARED VOICE CONTROLS
 * Local controls now; WebRTC transport later.
 */

(() => {
  "use strict";

  const VERSION = 1;
  let styleInstalled = false;

  function installStyle() {
    if (styleInstalled) return;
    styleInstalled = true;

    const style = document.createElement("style");

    style.textContent = `
      .lago-voice-panel {
        position: absolute;
        top: 47px;
        right: 10px;
        z-index: 75;
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 5px;
        width: min(265px, calc(100% - 20px));
        padding: 7px;
        border: 1px solid #ffffff29;
        border-radius: 12px;
        background: #111b22ee;
        color: #fff;
        font: 700 11px/1.35 system-ui, sans-serif;
        box-shadow: 0 6px 22px #0005;
      }

      .lago-voice-panel button {
        border: 1px solid #ffffff38;
        border-radius: 8px;
        color: #fff;
        background: #33404c;
        padding: 8px 10px;
        cursor: pointer;
        font: inherit;
        min-height: 35px;
      }

      .lago-voice-panel button[aria-pressed="true"] {
        border-color: #c7ed42;
        background: #455b26;
      }

      .lago-voice-panel button:disabled {
        opacity: .5;
        cursor: not-allowed;
      }

      .lago-voice-status {
        flex: 1 0 100%;
        opacity: .86;
        font-size: 10px;
      }

      .lago-voice-panel[data-placement="inline"] {
        position: static;
        width: auto;
        max-width: 290px;
      }

      @media (max-width: 560px) {
        .lago-voice-panel {
          top: 46px;
          width: min(215px, calc(100% - 18px));
        }

        .lago-voice-panel button {
          padding: 7px;
          font-size: 10px;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function createPanel({
    gameId,
    mount,
    placement = "floating"
  } = {}) {

    if (!(mount instanceof Element)) {
      throw new Error("Voice panel requires a mount element.");
    }

    installStyle();

    const root = document.createElement("section");

    root.className = "lago-voice-panel";
    root.dataset.placement = placement;

    root.setAttribute(
      "aria-label",
      `${gameId || "Game"}: voice chat`
    );

    root.innerHTML = `
      <button type="button" data-voice="enabled" aria-pressed="false">
        VOICE OFF
      </button>

      <button type="button" data-voice="mic" aria-pressed="false">
        MIC OFF
      </button>

      <button type="button" data-voice="sound" aria-pressed="true">
        SOUND ON
      </button>

      <span
        class="lago-voice-status"
        role="status"
        aria-live="polite"
      ></span>
    `;

    mount.appendChild(root);

    const buttons = {
      enabled: root.querySelector('[data-voice="enabled"]'),
      mic: root.querySelector('[data-voice="mic"]'),
      sound: root.querySelector('[data-voice="sound"]')
    };

    const status = root.querySelector(".lago-voice-status");
    const remoteAudio = new Map();

    let voiceEnabled = false;
    let micEnabled = false;
    let soundEnabled = true;
    let connected = false;
    let localStream = null;
    let destroyed = false;
    let busy = false;
    let errorText = "";

    function render() {
      if (destroyed) return;

      buttons.enabled.textContent =
        voiceEnabled ? "VOICE ON" : "VOICE OFF";

      buttons.enabled.setAttribute(
        "aria-pressed",
        String(voiceEnabled)
      );

      buttons.mic.textContent =
        micEnabled ? "MIC ON" : "MIC OFF";

      buttons.mic.setAttribute(
        "aria-pressed",
        String(micEnabled)
      );

      buttons.mic.disabled =
        !voiceEnabled || busy;

      buttons.sound.textContent =
        soundEnabled ? "SOUND ON" : "SOUND OFF";

      buttons.sound.setAttribute(
        "aria-pressed",
        String(soundEnabled)
      );

      status.textContent = errorText || (
        connected
          ? "ГОЛОСОВОЙ КАНАЛ ПОДКЛЮЧЁН"
          : voiceEnabled
            ? "Микрофон локальный · онлайн-аудио позже"
            : "Голосовой чат выключен"
      );
    }

    function stopMicrophone() {
      for (const track of localStream?.getTracks() || []) {
        track.stop();
      }

      localStream = null;
      micEnabled = false;
    }

    function syncOutput() {
      for (const audio of remoteAudio.values()) {
        audio.muted = !voiceEnabled || !soundEnabled;

        if (!audio.muted) {
          audio.play().catch(() => {
            errorText =
              "Нажмите SOUND для разрешения воспроизведения.";
            render();
          });
        }
      }
    }

    buttons.enabled.addEventListener("click", () => {
      voiceEnabled = !voiceEnabled;
      errorText = "";

      if (!voiceEnabled) {
        stopMicrophone();
      }

      syncOutput();
      render();
    });

    buttons.mic.addEventListener("click", async () => {
      if (!voiceEnabled || busy) return;

      errorText = "";

      if (micEnabled) {
        stopMicrophone();
        render();
        return;
      }

      busy = true;
      render();

      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error(
            "Микрофон недоступен: требуется HTTPS и разрешение браузера."
          );
        }

        const stream =
          await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true
            },
            video: false
          });

        if (destroyed || !voiceEnabled) {
          stream.getTracks().forEach(track => track.stop());
        } else {
          localStream = stream;
          micEnabled = true;
        }
      } catch (error) {
        errorText =
          error?.message || "Не удалось включить микрофон.";
      } finally {
        busy = false;
        render();
      }
    });

    buttons.sound.addEventListener("click", () => {
      soundEnabled = !soundEnabled;
      errorText = "";
      syncOutput();
      render();
    });

    render();

    return Object.freeze({
      version: VERSION,

      getLocalStream() {
        return voiceEnabled && micEnabled
          ? localStream
          : null;
      },

      getState() {
        return {
          voiceEnabled,
          micEnabled,
          soundEnabled,
          connected
        };
      },

      setConnected(value) {
        connected = Boolean(value);
        render();
      },

      addRemoteStream(peerId, stream) {
        if (destroyed || !peerId || !stream) return false;

        this.removeRemoteStream(peerId);

        const audio = document.createElement("audio");
        audio.autoplay = true;
        audio.playsInline = true;
        audio.srcObject = stream;
        audio.muted = !voiceEnabled || !soundEnabled;
        audio.style.display = "none";

        root.appendChild(audio);
        remoteAudio.set(String(peerId), audio);
        syncOutput();

        return true;
      },

      removeRemoteStream(peerId) {
        const key = String(peerId);
        const audio = remoteAudio.get(key);

        if (!audio) return false;

        audio.pause();
        audio.srcObject = null;
        audio.remove();
        remoteAudio.delete(key);

        return true;
      },

      destroy() {
        if (destroyed) return;

        destroyed = true;
        stopMicrophone();

        for (const audio of remoteAudio.values()) {
          audio.pause();
          audio.srcObject = null;
          audio.remove();
        }

        remoteAudio.clear();
        root.remove();
      }
    });
  }

  window.LAGO_GAME_VOICE = Object.freeze({
    version: VERSION,
    createPanel
  });
})();

(() => {
  "use strict";

  /* =========================================================
     LAGO INTERNATIONAL LANGUAGE SYSTEM
     English / Русский
     ========================================================= */

  const STORAGE_KEY = "lago_language_v1";

  const LANGUAGES = {
    en: {
      name: "English",
      flag: "🇬🇧"
    },

    ru: {
      name: "Русский",
      flag: "🇷🇺"
    }
  };

  let language =
    localStorage.getItem(STORAGE_KEY) || null;


  /* =========================================================
     TRANSLATIONS
     ========================================================= */

  const T = {

    "💎 МЭ": "💎 MEM",

    "⚡ КЛИК": "⚡ CLICK",

    "🤖 / СЕК": "🤖 / SEC",

    "🛡️ ЗАЩИТА": "🛡️ SHIELD",

    "ULTIMATE BRAINROT SNAIL™":
      "ULTIMATE BRAINROT SNAIL™",

    "Я устааал...":
      "I'm tired...",

    "Ты тупой?":
      "Are you stupid?",

    "Пук! 💨":
      "Fart! 💨",

    "Ой, всё!":
      "Oh, whatever!",

    "Зачем?":
      "Why?",

    "Скучно...":
      "Boring...",

    "Ещё!":
      "Again!",

    "Кто я?":
      "Who am I?",

    "Я улитка":
      "I'm a snail",

    "Лаго тупит":
      "Lago is lagging",

    "Загружаюсь...":
      "Loading...",

    "🧠 Дней без тупости: 0":
      "🧠 Days without brainrot: 0",

    "🍔 КЛИК!":
      "🍔 TAP!",

    "👾 ОГРАБИТЬ":
      "👾 STEAL",

    "⬆ АПГРЕЙД":
      "⬆ UPGRADE",

    "🎨 СОЗДАТЬ МЕМ":
      "🎨 CREATE MEME",

    "📦 МЕМЫ":
      "📦 MEMES",

    "🔗 ПОДЕЛИТЬСЯ":
      "🔗 SHARE",

    "🟣 SOLANA":
      "🟣 SOLANA",

    "⬆ КРИНЖ-МАГАЗИН":
      "⬆ BRAINROT SHOP",

    "📦 МОИ МЕМЫ":
      "📦 MY MEMES",

    "🎨 МЕМ-ЛАБОРАТОРИЯ":
      "🎨 MEME LAB",

    "Название мема, например ПУК-УЛЬТРА":
      "Meme name, e.g. FART-ULTRA",

    "Или нарисуй пальцем:":
      "Or draw with your finger:",

    "🧽 СТЕРЕТЬ":
      "🧽 CLEAR",

    "💾 СОЗДАТЬ":
      "💾 CREATE",

    "Случайный бонус: +1–5 к клику или +1–3 автоклика/сек.":
      "Random bonus: +1–5 per tap or +1–3 auto taps/sec.",

    "Игра работает без кошелька. Подключение нужно для привязки Solana-адреса и записи рекорда через Memo-транзакцию.":
      "The game works without a wallet. Connect one to link your Solana address and record your score through a Memo transaction.",

    "🔌 ПОДКЛЮЧИТЬ PHANTOM":
      "🔌 CONNECT PHANTOM",

    "⛓️ ЗАПИСАТЬ РЕКОРД В SOLANA":
      "⛓️ SAVE SCORE ON SOLANA",

    "Внимание: on-chain запись — настоящая транзакция и требует небольшой комиссии сети.":
      "Warning: on-chain recording is a real transaction and requires a small network fee.",

    "Лаго тупит":
      "Lago is lagging",

    "Кликай по Лаго и собирай Мем-Энергию. Чем больше кликов — тем больше кринжа.":
      "Tap Lago and collect MEM Energy. The more you tap, the more brainrot you create.",

    "ПОНЯЛ. ТЫК.":
      "GOT IT. TAP.",

    "Лаго перестал существовать. Мем-Энергия достигла нуля. Это было тупо.":
      "Lago stopped existing. MEM Energy reached zero. That was stupid.",

    "🐌 ВОЗРОДИТЬ ЛАГО":
      "🐌 REVIVE LAGO",

    "УСИЛЕНИЕ КЛИКА":
      "TAP POWER",

    "АВТОКЛИКЕР":
      "AUTO CLICKER",

    "ЗАЩИТА":
      "SHIELD",

    "+1 МЭ за каждый клик":
      "+1 MEM per tap",

    "+1 МЭ каждую секунду":
      "+1 MEM every second",

    "-10% потерь при краже":
      "-10% losses when stolen",

    "Пока пусто. Создай первый абсолютно бесполезный мем.":
      "Nothing here yet. Create your first completely useless meme.",

    "МЕМ ЛАГО":
      "LAGO MEME",

    "Phantom не найден. Открой игру в браузере Phantom.":
      "Phantom not found. Open the game in the Phantom browser.",

    "SOLANA КОШЕЛЁК ПОДКЛЮЧЁН 🟣":
      "SOLANA WALLET CONNECTED 🟣",

    "Подключение отменено":
      "Connection cancelled",

    "Кошелёк пока не подключён.":
      "Wallet not connected yet.",

    "СПАЛИЛИ!":
      "CAUGHT!",

    "ЗАЩИТА":
      "SHIELD"

  };


  const RU = {

    "💎 MEM": "💎 МЭ",
    "⚡ CLICK": "⚡ КЛИК",
    "🤖 / SEC": "🤖 / СЕК",
    "🛡️ SHIELD": "🛡️ ЗАЩИТА",

    "I'm tired...":
      "Я устааал...",

    "Are you stupid?":
      "Ты тупой?",

    "Fart! 💨":
      "Пук! 💨",

    "Oh, whatever!":
      "Ой, всё!",

    "Why?":
      "Зачем?",

    "Boring...":
      "Скучно...",

    "Again!":
      "Ещё!",

    "Who am I?":
      "Кто я?",

    "I'm a snail":
      "Я улитка",

    "Lago is lagging":
      "Лаго тупит",

    "Loading...":
      "Загружаюсь...",

    "🍔 TAP!":
      "🍔 КЛИК!",

    "👾 STEAL":
      "👾 ОГРАБИТЬ",

    "⬆ UPGRADE":
      "⬆ АПГРЕЙД",

    "🎨 CREATE MEME":
      "🎨 СОЗДАТЬ МЕМ",

    "📦 MEMES":
      "📦 МЕМЫ",

    "🔗 SHARE":
      "🔗 ПОДЕЛИТЬСЯ",

    "⬆ BRAINROT SHOP":
      "⬆ КРИНЖ-МАГАЗИН",

    "📦 MY MEMES":
      "📦 МОИ МЕМЫ",

    "🎨 MEME LAB":
      "🎨 МЕМ-ЛАБОРАТОРИЯ",

    "CLEAR":
      "СТЕРЕТЬ",

    "💾 CREATE":
      "💾 СОЗДАТЬ",

    "🔌 CONNECT PHANTOM":
      "🔌 ПОДКЛЮЧИТЬ PHANTOM",

    "⛓️ SAVE SCORE ON SOLANA":
      "⛓️ ЗАПИСАТЬ РЕКОРД В SOLANA",

    "GOT IT. TAP.":
      "ПОНЯЛ. ТЫК.",

    "🐌 REVIVE LAGO":
      "🐌 ВОЗРОДИТЬ ЛАГО",

    "TAP POWER":
      "УСИЛЕНИЕ КЛИКА",

    "AUTO CLICKER":
      "АВТОКЛИКЕР",

    "TAP POWER":
      "УСИЛЕНИЕ КЛИКА",

    "Nothing here yet. Create your first completely useless meme.":
      "Пока пусто. Создай первый абсолютно бесполезный мем.",

    "Wallet not connected yet.":
      "Кошелёк пока не подключён.",

    "Connection cancelled":
      "Подключение отменено",

    "SOLANA WALLET CONNECTED 🟣":
      "SOLANA КОШЕЛЁК ПОДКЛЮЧЁН 🟣"

  };


  /* =========================================================
     TRANSLATE TEXT
     ========================================================= */

  function translateText(text) {

    if (!text)
      return text;

    const clean =
      text.trim();

    if (!clean)
      return text;

    if (language === "en") {

      if (T[clean])
        return T[clean];

      const match =
        clean.match(
          /^🧠 Дней без тупости: (\d+)$/
        );

      if (match) {

        return `🧠 Days without brainrot: ${match[1]}`;

      }

      return text;

    }


    if (language === "ru") {

      if (RU[clean])
        return RU[clean];

      const match =
        clean.match(
          /^🧠 Days without brainrot: (\d+)$/
        );

      if (match) {

        return `🧠 Дней без тупости: ${match[1]}`;

      }

    }

    return text;

  }


  /* =========================================================
     TRANSLATE DOM
     ========================================================= */

  function translateDOM() {

    document
      .querySelectorAll(
        "body *"
      )
      .forEach(
        element => {

          if (
            element.children.length === 0 &&
            element.childNodes.length
          ) {

            const text =
              element.textContent;

            const translated =
              translateText(text);

            if (
              translated !== text
            ) {

              element.textContent =
                translated;

            }

          }

        }
      );


    document
      .querySelectorAll(
        "[placeholder]"
      )
      .forEach(
        element => {

          const value =
            element.getAttribute(
              "placeholder"
            );

          const translated =
            translateText(value);

          if (
            translated !== value
          ) {

            element.setAttribute(
              "placeholder",
              translated
            );

          }

        }
      );


    document.documentElement.lang =
      language || "en";

  }


  /* =========================================================
     LANGUAGE BUTTON
     ========================================================= */

  function createLanguageButton() {

    if (
      document.querySelector(
        "#lagoLanguageButton"
      )
    )
      return;


    const button =
      document.createElement(
        "button"
      );


    button.id =
      "lagoLanguageButton";


    button.innerHTML =
      "🌐 EN";


    button.addEventListener(
      "click",
      openLanguagePanel
    );


    document.body.appendChild(
      button
    );

  }


  /* =========================================================
     LANGUAGE PANEL
     ========================================================= */

  function openLanguagePanel() {

    let panel =
      document.querySelector(
        "#lagoLanguagePanel"
      );


    if (!panel) {

      panel =
        document.createElement(
          "div"
        );


      panel.id =
        "lagoLanguagePanel";


      panel.innerHTML = `

        <div
          class="lago-language-card"
        >

          <div
            class="lago-language-logo"
          >
            LAGO
          </div>

          <div
            class="lago-language-title"
          >
            CHOOSE LANGUAGE
          </div>

          <div
            class="lago-language-subtitle"
          >
            Select your language
          </div>


          <button
            class="lago-language-option"
            data-lang="en"
          >
            🇬🇧
            <span>
              English
            </span>
          </button>


          <button
            class="lago-language-option"
            data-lang="ru"
          >
            🇷🇺
            <span>
              Русский
            </span>
          </button>


        </div>

      `;


      document.body.appendChild(
        panel
      );


      panel
        .querySelectorAll(
          "[data-lang]"
        )
        .forEach(
          button => {

            button.addEventListener(
              "click",
              () => {

                setLanguage(
                  button.dataset.lang
                );

                panel.remove();

              }
            );

          }
        );

    }


    panel.classList.add(
      "show"
    );

  }


  /* =========================================================
     FIRST VISIT
     ========================================================= */

  function firstVisit() {

    if (
      !localStorage.getItem(
        STORAGE_KEY
      )
    ) {

      setTimeout(
        openLanguagePanel,
        350
      );

    }

  }


  /* =========================================================
     SET LANGUAGE
     ========================================================= */

  function setLanguage(
    lang
  ) {

    if (
      !LANGUAGES[lang]
    )
      return;


    language =
      lang;


    localStorage.setItem(
      STORAGE_KEY,
      language
    );


    document.documentElement.lang =
      language;


    translateDOM();


    updateButton();


    /*
      Force existing game UI
      to render again.
    */

    try {

      if (
        typeof render ===
        "function"
      ) {

        render();

      }

    } catch (e) {}


    /*
      Re-translate after render.
    */

    setTimeout(
      translateDOM,
      30
    );

    setTimeout(
      translateDOM,
      250
    );

  }


  /* =========================================================
     BUTTON UPDATE
     ========================================================= */

  function updateButton() {

    const button =
      document.querySelector(
        "#lagoLanguageButton"
      );


    if (!button)
      return;


    button.innerHTML =
      language === "en"
        ? "🌐 EN"
        : "🌐 RU";

  }


  /* =========================================================
     STYLE
     ========================================================= */

  function injectStyles() {

    const style =
      document.createElement(
        "style"
      );


    style.textContent = `

      #lagoLanguageButton {

        position: fixed;

        top:
          calc(
            10px +
            env(
              safe-area-inset-top
            )
          );

        right:
          10px;

        z-index:
          5000;

        min-width:
          54px;

        height:
          36px;

        padding:
          0 10px;

        border-radius:
          999px;

        background:
          rgba(10,5,12,.88);

        border:
          1px solid
          rgba(204,255,0,.75);

        color:
          #ccff00;

        font-family:
          system-ui,
          sans-serif;

        font-size:
          11px;

        font-weight:
          900;

        backdrop-filter:
          blur(12px);

        box-shadow:
          0 5px 20px
          rgba(0,0,0,.3);

      }


      #lagoLanguagePanel {

        position:
          fixed;

        inset:
          0;

        z-index:
          9000;

        display:
          none;

        align-items:
          center;

        justify-content:
          center;

        padding:
          20px;

        background:
          rgba(0,0,0,.78);

        backdrop-filter:
          blur(18px);

      }


      #lagoLanguagePanel.show {

        display:
          flex;

      }


      .lago-language-card {

        width:
          min(390px, 92vw);

        padding:
          28px 22px;

        border-radius:
          26px;

        background:
          linear-gradient(
            145deg,
            #190a1d,
            #0b0710
          );

        border:
          2px solid
          #ccff00;

        box-shadow:
          8px 8px 0
          #9900ff,
          0 30px 80px
          rgba(0,0,0,.65);

        text-align:
          center;

      }


      .lago-language-logo {

        color:
          #ff44aa;

        font-size:
          48px;

        font-weight:
          1000;

        letter-spacing:
          4px;

        text-shadow:
          4px 4px 0
          #9900ff;

      }


      .lago-language-title {

        margin-top:
          12px;

        color:
          #ccff00;

        font-size:
          18px;

        font-weight:
          1000;

      }


      .lago-language-subtitle {

        margin:
          6px 0 20px;

        color:
          #bca9bc;

        font-family:
          monospace;

        font-size:
          11px;

      }


      .lago-language-option {

        width:
          100%;

        min-height:
          60px;

        display:
          flex;

        align-items:
          center;

        gap:
          14px;

        margin-top:
          10px;

        padding:
          0 18px;

        border-radius:
          15px;

        background:
          #230b2a;

        border:
          2px solid
          rgba(255,68,170,.55);

        color:
          #fff;

        font-size:
          16px;

        font-weight:
          900;

        text-align:
          left;

      }


      .lago-language-option:hover {

        border-color:
          #ccff00;

        background:
          #30103a;

      }


      .lago-language-option:first-letter {

        font-size:
          25px;

      }

    `;


    document.head.appendChild(
      style
    );

  }


  /* =========================================================
     OBSERVE DYNAMIC GAME TEXT
     ========================================================= */

  function observeDOM() {

    const observer =
      new MutationObserver(
        mutations => {

          let changed =
            false;


          for (
            const mutation
            of mutations
          ) {

            if (
              mutation.type ===
              "childList" ||
              mutation.type ===
              "characterData"
            ) {

              changed =
                true;

              break;

            }

          }


          if (changed) {

            translateDOM();

          }

        }
      );


    observer.observe(
      document.body,
      {
        subtree: true,
        childList: true,
        characterData: true
      }
    );

  }


  /* =========================================================
     INIT
     ========================================================= */

  function init() {

    injectStyles();

    createLanguageButton();

    /*
      English is the international
      default.
    */

    if (!language) {

      language = "en";

    }


    translateDOM();

    updateButton();

    observeDOM();

    firstVisit();

  }


  if (
    document.readyState ===
    "loading"
  ) {

    document.addEventListener(
      "DOMContentLoaded",
      init
    );

  } else {

    init();

  }


  window.LAGO_LANGUAGE = {

    set:
      setLanguage,

    get:
      () => language,

    open:
      openLanguagePanel

  };

})();

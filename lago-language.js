(() => {
  "use strict";

  /*
   * LAGO LANGUAGE CORE
   * R0.1
   *
   * One language system.
   * One selector.
   * No duplicated onboarding.
   */

  const STORAGE_KEY = "lago_language_v1";

  const LANGUAGES = [
    { code: "en", flag: "🇬🇧", name: "English", native: "English" },
    { code: "ru", flag: "🇷🇺", name: "Russian", native: "Русский" },
    { code: "de", flag: "🇩🇪", name: "German", native: "Deutsch" },
    { code: "fr", flag: "🇫🇷", name: "French", native: "Français" },
    { code: "es", flag: "🇪🇸", name: "Spanish", native: "Español" },
    { code: "it", flag: "🇮🇹", name: "Italian", native: "Italiano" },
    { code: "pt", flag: "🇵🇹", name: "Portuguese", native: "Português" },
    { code: "nl", flag: "🇳🇱", name: "Dutch", native: "Nederlands" },
    { code: "pl", flag: "🇵🇱", name: "Polish", native: "Polski" },
    { code: "uk", flag: "🇺🇦", name: "Ukrainian", native: "Українська" },
    { code: "cs", flag: "🇨🇿", name: "Czech", native: "Čeština" },
    { code: "sk", flag: "🇸🇰", name: "Slovak", native: "Slovenčina" },
    { code: "hu", flag: "🇭🇺", name: "Hungarian", native: "Magyar" },
    { code: "ro", flag: "🇷🇴", name: "Romanian", native: "Română" },
    { code: "bg", flag: "🇧🇬", name: "Bulgarian", native: "Български" },
    { code: "sr", flag: "🇷🇸", name: "Serbian", native: "Српски" },
    { code: "hr", flag: "🇭🇷", name: "Croatian", native: "Hrvatski" },
    { code: "sl", flag: "🇸🇮", name: "Slovenian", native: "Slovenščina" },
    { code: "el", flag: "🇬🇷", name: "Greek", native: "Ελληνικά" },
    { code: "tr", flag: "🇹🇷", name: "Turkish", native: "Türkçe" },
    { code: "sv", flag: "🇸🇪", name: "Swedish", native: "Svenska" },
    { code: "no", flag: "🇳🇴", name: "Norwegian", native: "Norsk" },
    { code: "da", flag: "🇩🇰", name: "Danish", native: "Dansk" },
    { code: "fi", flag: "🇫🇮", name: "Finnish", native: "Suomi" },
    { code: "et", flag: "🇪🇪", name: "Estonian", native: "Eesti" },
    { code: "lv", flag: "🇱🇻", name: "Latvian", native: "Latviešu" },
    { code: "lt", flag: "🇱🇹", name: "Lithuanian", native: "Lietuvių" },
    { code: "is", flag: "🇮🇸", name: "Icelandic", native: "Íslenska" },

    { code: "zh", flag: "🇨🇳", name: "Chinese", native: "中文" },
    { code: "ja", flag: "🇯🇵", name: "Japanese", native: "日本語" },
    { code: "ko", flag: "🇰🇷", name: "Korean", native: "한국어" },
    { code: "vi", flag: "🇻🇳", name: "Vietnamese", native: "Tiếng Việt" },
    { code: "th", flag: "🇹🇭", name: "Thai", native: "ไทย" },
    { code: "id", flag: "🇮🇩", name: "Indonesian", native: "Bahasa Indonesia" },
    { code: "ms", flag: "🇲🇾", name: "Malay", native: "Bahasa Melayu" },
    { code: "fil", flag: "🇵🇭", name: "Filipino", native: "Filipino" },

    { code: "hi", flag: "🇮🇳", name: "Hindi", native: "हिन्दी" },
    { code: "bn", flag: "🇧🇩", name: "Bengali", native: "বাংলা" },
    { code: "ur", flag: "🇵🇰", name: "Urdu", native: "اردو" },
    { code: "ta", flag: "🇮🇳", name: "Tamil", native: "தமிழ்" },
    { code: "te", flag: "🇮🇳", name: "Telugu", native: "తెలుగు" },
    { code: "mr", flag: "🇮🇳", name: "Marathi", native: "मराठी" },
    { code: "gu", flag: "🇮🇳", name: "Gujarati", native: "ગુજરાતી" },

    { code: "ar", flag: "🇸🇦", name: "Arabic", native: "العربية" },
    { code: "he", flag: "🇮🇱", name: "Hebrew", native: "עברית" },
    { code: "fa", flag: "🇮🇷", name: "Persian", native: "فارسی" },

    { code: "sw", flag: "🇰🇪", name: "Swahili", native: "Kiswahili" },
    { code: "af", flag: "🇿🇦", name: "Afrikaans", native: "Afrikaans" },

    { code: "ka", flag: "🇬🇪", name: "Georgian", native: "ქართული" },
    { code: "hy", flag: "🇦🇲", name: "Armenian", native: "Հայերեն" },
    { code: "az", flag: "🇦🇿", name: "Azerbaijani", native: "Azərbaycan dili" },
    { code: "kk", flag: "🇰🇿", name: "Kazakh", native: "Қазақша" },
    { code: "uz", flag: "🇺🇿", name: "Uzbek", native: "O‘zbekcha" },

    { code: "mn", flag: "🇲🇳", name: "Mongolian", native: "Монгол" },
    { code: "ne", flag: "🇳🇵", name: "Nepali", native: "नेपाली" },

    { code: "sq", flag: "🇦🇱", name: "Albanian", native: "Shqip" },
    { code: "mk", flag: "🇲🇰", name: "Macedonian", native: "Македонски" },
    { code: "bs", flag: "🇧🇦", name: "Bosnian", native: "Bosanski" },

    { code: "ca", flag: "🇪🇸", name: "Catalan", native: "Català" },
    { code: "eu", flag: "🇪🇸", name: "Basque", native: "Euskara" },
    { code: "gl", flag: "🇪🇸", name: "Galician", native: "Galego" },

    { code: "pt-BR", flag: "🇧🇷", name: "Portuguese Brazil", native: "Português Brasil" },
    { code: "es-MX", flag: "🇲🇽", name: "Spanish Mexico", native: "Español México" }
  ];

  /*
   * At this stage only English and Russian
   * have proper interface translation dictionaries.
   *
   * Every other selected locale is preserved,
   * but interface copy falls back to English.
   */

  const EN_TO_RU = {
    "💎 MEM": "💎 МЭ",
    "⚡ CLICK": "⚡ КЛИК",
    "🤖 / SEC": "🤖 / СЕК",
    "🛡️ SHIELD": "🛡️ ЗАЩИТА",

    "I'm tired...": "Я устааал...",
    "Are you stupid?": "Ты тупой?",
    "Fart! 💨": "Пук! 💨",
    "Oh, whatever!": "Ой, всё!",
    "Why?": "Зачем?",
    "Boring...": "Скучно...",
    "Again!": "Ещё!",
    "Who am I?": "Кто я?",
    "I'm a snail": "Я улитка",
    "Lago is lagging": "Лаго тупит",
    "Loading...": "Загружаюсь...",

    "🍔 TAP!": "🍔 КЛИК!",
    "👾 STEAL": "👾 ОГРАБИТЬ",
    "⬆ UPGRADE": "⬆ АПГРЕЙД",
    "🎨 CREATE MEME": "🎨 СОЗДАТЬ МЕМ",
    "📦 MEMES": "📦 МЕМЫ",
    "🔗 SHARE": "🔗 ПОДЕЛИТЬСЯ",

    "⬆ BRAINROT SHOP": "⬆ КРИНЖ-МАГАЗИН",
    "📦 MY MEMES": "📦 МОИ МЕМЫ",
    "🎨 MEME LAB": "🎨 МЕМ-ЛАБОРАТОРИЯ",

    "CLEAR": "СТЕРЕТЬ",
    "💾 CREATE": "💾 СОЗДАТЬ",

    "🔌 CONNECT PHANTOM": "🔌 ПОДКЛЮЧИТЬ PHANTOM",
    "⛓️ SAVE SCORE ON SOLANA": "⛓️ ЗАПИСАТЬ РЕКОРД В SOLANA",

    "GOT IT. TAP.": "ПОНЯЛ. ТЫК.",
    "🐌 REVIVE LAGO": "🐌 ВОЗРОДИТЬ ЛАГО",

    "TAP POWER": "УСИЛЕНИЕ КЛИКА",
    "AUTO CLICKER": "АВТОКЛИКЕР",
    "SHIELD": "ЗАЩИТА",

    "+1 MEM per tap": "+1 МЭ за каждый клик",
    "+1 MEM every second": "+1 МЭ каждую секунду",
    "-10% losses when stolen": "-10% потерь при краже",

    "Nothing here yet. Create your first completely useless meme.":
      "Пока пусто. Создай первый абсолютно бесполезный мем.",

    "Wallet not connected yet.":
      "Кошелёк пока не подключён.",

    "Connection cancelled":
      "Подключение отменено",

    "SOLANA WALLET CONNECTED 🟣":
      "SOLANA КОШЕЛЁК ПОДКЛЮЧЁН 🟣",

    "The game works without a wallet. Connect one to link your Solana address and record your score through a Memo transaction.":
      "Игра работает без кошелька. Подключение нужно для привязки Solana-адреса и записи рекорда через Memo-транзакцию.",

    "Warning: on-chain recording is a real transaction and requires a small network fee.":
      "Внимание: on-chain запись — настоящая транзакция и требует небольшой комиссии сети.",

    "Tap Lago and collect MEM Energy. The more you tap, the more brainrot you create.":
      "Кликай по Лаго и собирай Мем-Энергию. Чем больше кликов — тем больше кринжа.",

    "Lago stopped existing. MEM Energy reached zero. That was stupid.":
      "Лаго перестал существовать. Мем-Энергия достигла нуля. Это было тупо."
    "BRAINROT SNAIL":
  "БРЕЙНРОТ-УЛИТКА",

"PLAY":
  "ИГРАТЬ",

"GAMES":
  "ИГРЫ",

"CREATE":
  "СОЗДАТЬ",

"COLLECTION":
  "КОЛЛЕКЦИЯ",

"SHOP":
  "МАГАЗИН",

"LEVEL":
  "УРОВЕНЬ",

"MEM ENERGY":
  "МЕМ-ЭНЕРГИЯ",

"CLICK POWER":
  "СИЛА КЛИКА",

"PER SECOND":
  "В СЕКУНДУ",

"BRAINROT":
  "БРЕЙНРОТ",

"NEXT LEVEL":
  "СЛЕДУЮЩИЙ УРОВЕНЬ",

"UPGRADE":
  "АПГРЕЙД",

"Make Lago stupider":
  "Сделать Лаго ещё тупее",

"STEAL":
  "ОГРАБИТЬ",

"Do something illegal":
  "Сделать что-нибудь незаконное",

"THE DUMBEST SNAIL ON THE INTERNET":
  "САМАЯ ТУПАЯ УЛИТКА В ИНТЕРНЕТЕ",

"YOUR LAGO":
  "ТВОЙ ЛАГО",

"Name it whatever you want. Nobody knows what Lago is.":
  "Назови его как хочешь. Всё равно никто не знает, что такое Лаго.",

"PROFILE":
  "ПРОФИЛЬ",

"LAGO PLAYER":
  "ИГРОК LAGO",

"UPLOAD AVATAR":
  "ЗАГРУЗИТЬ АВАТАР",

"SAVE PROFILE":
  "СОХРАНИТЬ ПРОФИЛЬ",

"Player name":
  "Имя персонажа",

"DAILY REWARD":
  "ЕЖЕДНЕВНАЯ НАГРАДА",

"CLAIM DAILY REWARD":
  "ЗАБРАТЬ НАГРАДУ",

"CLAIMED TODAY":
  "СЕГОДНЯ УЖЕ ПОЛУЧЕНО",

"ACCOUNT & WALLET":
  "АККАУНТ И КОШЕЛЁК",

"NOT CONNECTED":
  "НЕ ПОДКЛЮЧЁН",

"CONNECT WALLET":
  "ПОДКЛЮЧИТЬ КОШЕЛЁК",

"SIGN IN WITH WALLET":
  "ВОЙТИ ЧЕРЕЗ КОШЕЛЁК",

"SETTINGS":
  "НАСТРОЙКИ",

"CHANGE LANGUAGE":
  "ИЗМЕНИТЬ ЯЗЫК",

"AVAILABLE NOW":
  "ДОСТУПНО",

"COMING SOON":
  "СКОРО",

"Earn MEM and XP across Lago mini-games.":
  "Зарабатывай MEM и XP в мини-играх Lago.",

"TAP LAGO":
  "ТЫКАТЬ LAGO",

"KNIFE CHALLENGE":
  "ИСПЫТАНИЕ НОЖОМ",

"SLOWEST RACE":
  "САМАЯ МЕДЛЕННАЯ ГОНКА",

"BRAIN LOADING":
  "ЗАГРУЗКА МОЗГА",

"DAILY DROP":
  "ЕЖЕДНЕВНЫЙ ДРОП",

"NEW LAGO":
  "НОВЫЙ LAGO",

"You unlocked a new skin!":
  "Ты разблокировал новый скин!",

"FULL COLLECTION":
  "ПОЛНАЯ КОЛЛЕКЦИЯ",

"You own every available skin.":
  "У тебя уже есть все доступные скины.",

"AWESOME":
  "ОТЛИЧНО"
  };

  const RU_TO_EN = Object.fromEntries(
    Object.entries(EN_TO_RU).map(([en, ru]) => [ru, en])
  );

  let language = normalizeLanguage(
    localStorage.getItem(STORAGE_KEY)
  );

  let observer = null;
  let translating = false;

  function normalizeLanguage(value) {
    if (!value) {
      return null;
    }

    const exact = LANGUAGES.find(item => item.code === value);

    if (exact) {
      return exact.code;
    }

    const base = String(value).split("-")[0];

    const fallback = LANGUAGES.find(item => item.code === base);

    return fallback ? fallback.code : null;
  }

  function getLanguageMeta(code = language) {
    return (
      LANGUAGES.find(item => item.code === code) ||
      LANGUAGES[0]
    );
  }

  function getTranslationLanguage() {
    return language === "ru" ? "ru" : "en";
  }

  function translateText(text) {
    if (typeof text !== "string") {
      return text;
    }

    const clean = text.trim();

    if (!clean) {
      return text;
    }

    const target = getTranslationLanguage();

    if (target === "ru") {
      if (EN_TO_RU[clean]) {
        return preserveWhitespace(text, EN_TO_RU[clean]);
      }

      const brainrot =
        clean.match(/^🧠 Days without brainrot:\s*(\d+)$/);

      if (brainrot) {
        return preserveWhitespace(
          text,
          `🧠 Дней без тупости: ${brainrot[1]}`
        );
      }

      return text;
    }

    if (RU_TO_EN[clean]) {
      return preserveWhitespace(text, RU_TO_EN[clean]);
    }

    const brainrot =
      clean.match(/^🧠 Дней без тупости:\s*(\d+)$/);

    if (brainrot) {
      return preserveWhitespace(
        text,
        `🧠 Days without brainrot: ${brainrot[1]}`
      );
    }

    return text;
  }

  function preserveWhitespace(original, translated) {
    const start = original.match(/^\s*/)?.[0] || "";
    const end = original.match(/\s*$/)?.[0] || "";

    return `${start}${translated}${end}`;
  }

  function translateElement(element) {
    if (!(element instanceof Element)) {
      return;
    }

    if (
      element.closest(
        "#lagoLanguagePanel, #lagoOnboarding"
      )
    ) {
      return;
    }

    if (
      element.children.length === 0 &&
      element.childNodes.length === 1 &&
      element.firstChild?.nodeType === Node.TEXT_NODE
    ) {
      const current = element.textContent;
      const translated = translateText(current);

      if (translated !== current) {
        element.textContent = translated;
      }
    }

    if (element.hasAttribute("placeholder")) {
      const current =
        element.getAttribute("placeholder") || "";

      const translated = translateText(current);

      if (translated !== current) {
        element.setAttribute(
          "placeholder",
          translated
        );
      }
    }

    if (element.hasAttribute("title")) {
      const current =
        element.getAttribute("title") || "";

      const translated = translateText(current);

      if (translated !== current) {
        element.setAttribute(
          "title",
          translated
        );
      }
    }
  }

  function translateDOM(root = document.body) {
    if (!root || translating) {
      return;
    }

    translating = true;

    try {
      if (root instanceof Element) {
        translateElement(root);
      }

      root
        .querySelectorAll?.("*")
        .forEach(translateElement);

      document.documentElement.lang =
        language || "en";

      document.documentElement.dir =
        ["ar", "he", "fa", "ur"].includes(language)
          ? "rtl"
          : "ltr";
    } finally {
      translating = false;
    }
  }

  function updateButton() {
    const button =
      document.querySelector(
        "#lagoLanguageButton"
      );

    if (!button) {
      return;
    }

    const meta = getLanguageMeta();

    button.textContent =
      `${meta.flag} ${meta.code.toUpperCase()}`;
  }

  function createLanguageButton() {
    if (
      document.querySelector(
        "#lagoLanguageButton"
      )
    ) {
      updateButton();
      return;
    }

    const button =
      document.createElement("button");

    button.id =
      "lagoLanguageButton";

    button.type =
      "button";

    button.setAttribute(
      "aria-label",
      "Change language"
    );

    button.addEventListener(
      "click",
      open
    );

    document.body.appendChild(button);

    updateButton();
  }

  function injectStyles() {
    if (
      document.querySelector(
        "#lagoLanguageStyles"
      )
    ) {
      return;
    }

    const style =
      document.createElement("style");

    style.id =
      "lagoLanguageStyles";

    style.textContent = `
      #lagoLanguageButton {
  position: fixed;

  top: auto;

  right: 18px;

  bottom:
    calc(
      18px +
      env(safe-area-inset-bottom)
    );
        z-index: 5000;

        min-width: 62px;
        height: 38px;
        padding: 0 12px;

        border: 1px solid rgba(202,255,0,.6);
        border-radius: 999px;

        background: rgba(10,10,14,.88);
        color: #fff;

        font: 800 11px/1
          Inter,
          -apple-system,
          BlinkMacSystemFont,
          "Segoe UI",
          sans-serif;

        cursor: pointer;

        backdrop-filter: blur(14px);
        -webkit-backdrop-filter: blur(14px);

        box-shadow:
          0 8px 28px rgba(0,0,0,.28);

        transition:
          transform .16s ease,
          border-color .16s ease,
          background .16s ease;
      }

      #lagoLanguageButton:hover {
        transform: translateY(-1px);
        border-color: #caff00;
        background: rgba(20,20,25,.96);
      }

      #lagoLanguagePanel {
        position: fixed;
        inset: 0;
        z-index: 100000;

        display: flex;
        align-items: center;
        justify-content: center;

        padding:
          calc(16px + env(safe-area-inset-top))
          16px
          calc(16px + env(safe-area-inset-bottom));

        background:
          radial-gradient(
            circle at 50% 12%,
            rgba(202,255,0,.08),
            transparent 34%
          ),
          rgba(4,5,7,.96);

        backdrop-filter: blur(28px);
        -webkit-backdrop-filter: blur(28px);

        animation:
          lagoLanguageOverlayIn
          .22s ease-out;
      }

      @keyframes lagoLanguageOverlayIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }

      .lago-language-card {
        width: min(980px, 100%);
        max-height: min(860px, 92dvh);

        display: flex;
        flex-direction: column;

        overflow: hidden;

        border:
          1px solid rgba(255,255,255,.10);

        border-radius: 28px;

        background:
          linear-gradient(
            155deg,
            rgba(24,25,30,.98),
            rgba(9,10,13,.99)
          );

        box-shadow:
          0 42px 120px
          rgba(0,0,0,.65);

        color: #fff;

        font-family:
          Inter,
          -apple-system,
          BlinkMacSystemFont,
          "Segoe UI",
          sans-serif;
      }

      .lago-language-header {
        display: grid;
        grid-template-columns:
          1fr auto;

        gap: 16px;

        align-items: start;

        padding:
          28px 28px 18px;
      }

      .lago-language-brand {
        color: #caff00;

        font-size:
          clamp(34px, 6vw, 58px);

        line-height: .9;

        font-weight: 1000;

        letter-spacing: -.07em;
      }

      .lago-language-title {
        margin-top: 16px;

        font-size:
          clamp(20px, 3vw, 30px);

        line-height: 1;

        font-weight: 900;

        letter-spacing: -.04em;
      }

      .lago-language-subtitle {
        margin-top: 8px;

        color:
          rgba(255,255,255,.46);

        font-size: 12px;
        line-height: 1.45;
      }

      .lago-language-close {
        width: 42px;
        height: 42px;

        display: grid;
        place-items: center;

        border:
          1px solid
          rgba(255,255,255,.10);

        border-radius: 50%;

        background:
          rgba(255,255,255,.04);

        color: #fff;

        font-size: 18px;

        cursor: pointer;
      }

      .lago-language-search-wrap {
        padding: 0 28px 18px;
      }

      #lagoLanguageSearch {
        width: 100%;
        height: 52px;

        padding: 0 18px;

        border:
          1px solid
          rgba(255,255,255,.10);

        border-radius: 16px;

        outline: none;

        background:
          rgba(255,255,255,.04);

        color: #fff;

        font:
          700 13px/1
          Inter,
          -apple-system,
          BlinkMacSystemFont,
          "Segoe UI",
          sans-serif;
      }

      #lagoLanguageSearch:focus {
        border-color:
          rgba(202,255,0,.72);

        box-shadow:
          0 0 0 3px
          rgba(202,255,0,.06);
      }

      #lagoLanguageSearch::placeholder {
        color:
          rgba(255,255,255,.28);
      }

      .lago-language-grid-wrap {
        min-height: 0;
        overflow-y: auto;

        padding:
          0 28px 28px;

        overscroll-behavior: contain;
      }

      .lago-language-grid {
        display: grid;

        grid-template-columns:
          repeat(4, minmax(0, 1fr));

        gap: 9px;
      }

      .lago-language-option {
        min-width: 0;
        min-height: 68px;

        display: flex;
        align-items: center;

        gap: 11px;

        padding: 10px 13px;

        border:
          1px solid
          rgba(255,255,255,.08);

        border-radius: 16px;

        background:
          rgba(255,255,255,.035);

        color: #fff;

        text-align: left;

        cursor: pointer;

        transition:
          transform .14s ease,
          border-color .14s ease,
          background .14s ease;
      }

      .lago-language-option:hover {
        transform: translateY(-1px);

        background:
          rgba(255,255,255,.065);

        border-color:
          rgba(202,255,0,.45);
      }

      .lago-language-option.selected {
        border-color: #caff00;

        background:
          rgba(202,255,0,.08);

        box-shadow:
          inset 0 0 0 1px
          rgba(202,255,0,.08);
      }

      .lago-language-flag {
        flex: 0 0 auto;

        font-size: 24px;
      }

      .lago-language-copy {
        min-width: 0;

        display: flex;
        flex-direction: column;

        gap: 3px;
      }

      .lago-language-native {
        overflow: hidden;

        color: #fff;

        font-size: 12px;
        font-weight: 850;

        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .lago-language-english {
        overflow: hidden;

        color:
          rgba(255,255,255,.36);

        font-size: 9px;
        font-weight: 650;

        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .lago-language-empty {
        grid-column: 1 / -1;

        padding: 36px 20px;

        color:
          rgba(255,255,255,.42);

        text-align: center;

        font-size: 12px;
      }

      @media (max-width: 820px) {
        .lago-language-grid {
          grid-template-columns:
            repeat(3, minmax(0, 1fr));
        }
      }

      @media (max-width: 620px) {
      #lagoLanguageButton {
  right: 12px;

  bottom:
    calc(
      84px +
      env(safe-area-inset-bottom)
    );
}
        #lagoLanguagePanel {
          padding:
            env(safe-area-inset-top)
            0
            env(safe-area-inset-bottom);
        }

        .lago-language-card {
          width: 100%;
          max-height: 100dvh;
          height: 100dvh;

          border-radius: 0;
          border-left: 0;
          border-right: 0;
        }

        .lago-language-header {
          padding: 24px 18px 16px;
        }

        .lago-language-search-wrap {
          padding:
            0 18px 14px;
        }

        .lago-language-grid-wrap {
          padding:
            0 18px 24px;
        }

        .lago-language-grid {
          grid-template-columns:
            repeat(2, minmax(0, 1fr));
        }

        .lago-language-option {
          min-height: 64px;
          padding: 9px 10px;
        }

        .lago-language-native {
          font-size: 11px;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function renderLanguageGrid(panel, query = "") {
    const grid =
      panel.querySelector(
        "#lagoLanguageGrid"
      );

    if (!grid) {
      return;
    }

    const normalizedQuery =
      query
        .trim()
        .toLocaleLowerCase();

    const filtered =
      LANGUAGES.filter(item => {
        if (!normalizedQuery) {
          return true;
        }

        const haystack = [
          item.code,
          item.name,
          item.native
        ]
          .join(" ")
          .toLocaleLowerCase();

        return haystack.includes(
          normalizedQuery
        );
      });

    if (!filtered.length) {
      grid.innerHTML = `
        <div class="lago-language-empty">
          No language found.
        </div>
      `;

      return;
    }

    grid.innerHTML =
      filtered
        .map(item => `
          <button
            type="button"
            class="
              lago-language-option
              ${
                item.code === language
                  ? "selected"
                  : ""
              }
            "
            data-language-code="${escapeHtml(
              item.code
            )}"
          >
            <span class="lago-language-flag">
              ${item.flag}
            </span>

            <span class="lago-language-copy">
              <span class="lago-language-native">
                ${escapeHtml(item.native)}
              </span>

              <span class="lago-language-english">
                ${escapeHtml(item.name)}
              </span>
            </span>
          </button>
        `)
        .join("");

    grid
      .querySelectorAll(
        "[data-language-code]"
      )
      .forEach(button => {
        button.addEventListener(
          "click",
          () => {
            setLanguage(
              button.dataset.languageCode
            );

            close();
          }
        );
      });
  }

  function open(options = {}) {
    close();

    const panel =
      document.createElement("div");

    panel.id =
      "lagoLanguagePanel";

    const closable =
      options.closable !== false;

    panel.innerHTML = `
      <div
        class="lago-language-card"
        role="dialog"
        aria-modal="true"
        aria-label="Choose language"
      >
        <div class="lago-language-header">
          <div>
            <div class="lago-language-brand">
              LAGO
            </div>

            <div class="lago-language-title">
              CHOOSE YOUR LANGUAGE
            </div>

            <div class="lago-language-subtitle">
              Pick your language.
              You can change it later.
            </div>
          </div>

          ${
            closable
              ? `
                <button
                  type="button"
                  class="lago-language-close"
                  id="lagoLanguageClose"
                  aria-label="Close"
                >
                  ×
                </button>
              `
              : ""
          }
        </div>

        <div class="lago-language-search-wrap">
          <input
            id="lagoLanguageSearch"
            type="search"
            autocomplete="off"
            spellcheck="false"
            placeholder="Search language..."
            aria-label="Search language"
          >
        </div>

        <div class="lago-language-grid-wrap">
          <div
            class="lago-language-grid"
            id="lagoLanguageGrid"
          ></div>
        </div>
      </div>
    `;

    document.body.appendChild(panel);

    renderLanguageGrid(panel);

    const search =
      panel.querySelector(
        "#lagoLanguageSearch"
      );

    search?.addEventListener(
      "input",
      () => {
        renderLanguageGrid(
          panel,
          search.value
        );
      }
    );

    panel
      .querySelector(
        "#lagoLanguageClose"
      )
      ?.addEventListener(
        "click",
        close
      );

    if (closable) {
      panel.addEventListener(
        "click",
        event => {
          if (event.target === panel) {
            close();
          }
        }
      );
    }

    setTimeout(
      () => search?.focus(),
      30
    );

    return panel;
  }

  function close() {
    document
      .querySelector(
        "#lagoLanguagePanel"
      )
      ?.remove();
  }

  function setLanguage(code) {
    const normalized =
      normalizeLanguage(code);

    if (!normalized) {
      return false;
    }

    language =
      normalized;

    localStorage.setItem(
      STORAGE_KEY,
      language
    );

    document.documentElement.lang =
      language;

    document.documentElement.dir =
      ["ar", "he", "fa", "ur"].includes(language)
        ? "rtl"
        : "ltr";

    /*
     * Keep the unified game state informed.
     */
    try {
      window.LAGO?.setLanguage?.(
        language
      );
    } catch (error) {
      console.warn(
        "[LAGO LANGUAGE] Could not sync game state:",
        error
      );
    }

    translateDOM();
    updateButton();

    document.dispatchEvent(
      new CustomEvent(
        "lago:language",
        {
          detail: {
            language,
            locale:
              getLanguageMeta(language)
          }
        }
      )
    );

    return true;
  }

  function hasSavedLanguage() {
    return Boolean(
      normalizeLanguage(
        localStorage.getItem(
          STORAGE_KEY
        )
      )
    );
  }

  function observeDOM() {
    observer?.disconnect();

    observer =
      new MutationObserver(
        mutations => {
          if (translating) {
            return;
          }

          for (const mutation of mutations) {
            mutation
              .addedNodes
              .forEach(node => {
                if (
                  node.nodeType ===
                  Node.ELEMENT_NODE
                ) {
                  translateDOM(node);
                }
              });
          }
        }
      );

    observer.observe(
      document.body,
      {
        subtree: true,
        childList: true
      }
    );
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function init() {
    injectStyles();

    createLanguageButton();

    /*
     * Important:
     * Do NOT open the first-visit selector here.
     * Onboarding owns the first launch.
     *
     * This removes the duplicate language screen.
     */
    if (!language) {
      language = "en";
    }

    translateDOM();
    updateButton();
    observeDOM();
  }

  window.LAGO_LANGUAGE = {
    set: setLanguage,

    translate: translateText,

    get() {
      return language;
    },

    getMeta() {
      return getLanguageMeta();
    },

    getLanguages() {
      return LANGUAGES.map(
        item => ({ ...item })
      );
    },

    hasSavedLanguage,

    open,

    close,

    translateDOM
  };

  if (
    document.readyState ===
    "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      init,
      { once: true }
    );
  } else {
    init();
  }
})();

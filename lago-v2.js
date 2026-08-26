/* =========================================================
   LAGO 2.0
   International onboarding + living snail + language
   ========================================================= */

(function () {

  "use strict";

  /* -------------------------------------------------------
     LANGUAGE SYSTEM
  ------------------------------------------------------- */

  const LANGUAGES = {
    en: {
      name: "English",
      country: "United States",
      welcome: "WELCOME TO LAGO",
      subtitle: "THE ULTIMATE BRAINROT SNAIL",
      countryLabel: "Country",
      languageLabel: "Language",
      start: "START PLAYING",
      play: "PLAY",
      create: "CREATE",
      collection: "COLLECTION",
      shop: "SHOP",
      profile: "PROFILE",
      energy: "MEM ENERGY",
      power: "CLICK POWER",
      auto: "PER SECOND",
      shield: "SHIELD",
      tap: "TAP TO BRAINROT"
    },

    ru: {
      name: "Русский",
      country: "Россия",
      welcome: "ДОБРО ПОЖАЛОВАТЬ В LAGO",
      subtitle: "УЛИТКА ULTIMATE BRAINROT",
      countryLabel: "Страна",
      languageLabel: "Язык",
      start: "НАЧАТЬ ИГРУ",
      play: "ИГРА",
      create: "СОЗДАТЬ",
      collection: "КОЛЛЕКЦИЯ",
      shop: "МАГАЗИН",
      profile: "ПРОФИЛЬ",
      energy: "МЕМ-ЭНЕРГИЯ",
      power: "СИЛА КЛИКА",
      auto: "В СЕКУНДУ",
      shield: "ЗАЩИТА",
      tap: "КЛИКАЙ ПО LAGO"
    },

    de: {
      name: "Deutsch",
      country: "Germany",
      welcome: "WILLKOMMEN BEI LAGO",
      subtitle: "THE ULTIMATE BRAINROT SNAIL",
      countryLabel: "Land",
      languageLabel: "Sprache",
      start: "STARTEN",
      play: "SPIELEN",
      create: "ERSTELLEN",
      collection: "SAMMLUNG",
      shop: "SHOP",
      profile: "PROFIL",
      energy: "MEM ENERGY",
      power: "KLICKKRAFT",
      auto: "PRO SEKUNDE",
      shield: "SCHUTZ",
      tap: "TAP TO BRAINROT"
    },

    es: {
      name: "Español",
      country: "Spain",
      welcome: "BIENVENIDO A LAGO",
      subtitle: "THE ULTIMATE BRAINROT SNAIL",
      countryLabel: "País",
      languageLabel: "Idioma",
      start: "EMPEZAR",
      play: "JUGAR",
      create: "CREAR",
      collection: "COLECCIÓN",
      shop: "TIENDA",
      profile: "PERFIL",
      energy: "MEM ENERGY",
      power: "PODER DE CLIC",
      auto: "POR SEGUNDO",
      shield: "PROTECCIÓN",
      tap: "TOCA PARA BRAINROT"
    },

    fr: {
      name: "Français",
      country: "France",
      welcome: "BIENVENUE SUR LAGO",
      subtitle: "THE ULTIMATE BRAINROT SNAIL",
      countryLabel: "Pays",
      languageLabel: "Langue",
      start: "COMMENCER",
      play: "JOUER",
      create: "CRÉER",
      collection: "COLLECTION",
      shop: "BOUTIQUE",
      profile: "PROFIL",
      energy: "MEM ENERGY",
      power: "PUISSANCE",
      auto: "PAR SECONDE",
      shield: "PROTECTION",
      tap: "TAP POUR BRAINROT"
    },

    pt: {
      name: "Português",
      country: "Brazil",
      welcome: "BEM-VINDO AO LAGO",
      subtitle: "THE ULTIMATE BRAINROT SNAIL",
      countryLabel: "País",
      languageLabel: "Idioma",
      start: "COMEÇAR",
      play: "JOGAR",
      create: "CRIAR",
      collection: "COLEÇÃO",
      shop: "LOJA",
      profile: "PERFIL",
      energy: "MEM ENERGY",
      power: "PODER DO CLIQUE",
      auto: "POR SEGUNDO",
      shield: "PROTEÇÃO",
      tap: "TOQUE PARA BRAINROT"
    },

    ja: {
      name: "日本語",
      country: "Japan",
      welcome: "LAGOへようこそ",
      subtitle: "THE ULTIMATE BRAINROT SNAIL",
      countryLabel: "国",
      languageLabel: "言語",
      start: "ゲーム開始",
      play: "プレイ",
      create: "作成",
      collection: "コレクション",
      shop: "ショップ",
      profile: "プロフィール",
      energy: "MEM ENERGY",
      power: "クリックパワー",
      auto: "毎秒",
      shield: "シールド",
      tap: "タップしてBRAINROT"
    },

    ko: {
      name: "한국어",
      country: "South Korea",
      welcome: "LAGO에 오신 것을 환영합니다",
      subtitle: "THE ULTIMATE BRAINROT SNAIL",
      countryLabel: "국가",
      languageLabel: "언어",
      start: "게임 시작",
      play: "플레이",
      create: "만들기",
      collection: "컬렉션",
      shop: "상점",
      profile: "프로필",
      energy: "MEM ENERGY",
      power: "클릭 파워",
      auto: "초당",
      shield: "보호",
      tap: "탭하여 BRAINROT"
    }
  };


  /* -------------------------------------------------------
     COUNTRY LIST
  ------------------------------------------------------- */

  const COUNTRIES = [
    ["US", "🇺🇸", "United States", "en"],
    ["GB", "🇬🇧", "United Kingdom", "en"],
    ["DE", "🇩🇪", "Germany", "de"],
    ["FR", "🇫🇷", "France", "fr"],
    ["ES", "🇪🇸", "Spain", "es"],
    ["IT", "🇮🇹", "Italy", "en"],
    ["BR", "🇧🇷", "Brazil", "pt"],
    ["PT", "🇵🇹", "Portugal", "pt"],
    ["JP", "🇯🇵", "Japan", "ja"],
    ["KR", "🇰🇷", "South Korea", "ko"],
    ["RU", "🇷🇺", "Russia", "ru"],
    ["CA", "🇨🇦", "Canada", "en"],
    ["AU", "🇦🇺", "Australia", "en"],
    ["NL", "🇳🇱", "Netherlands", "en"],
    ["SE", "🇸🇪", "Sweden", "en"],
    ["NO", "🇳🇴", "Norway", "en"],
    ["CH", "🇨🇭", "Switzerland", "en"],
    ["OTHER", "🌎", "Other", "en"]
  ];


  /* -------------------------------------------------------
     STORAGE
  ------------------------------------------------------- */

  const STORAGE_KEY = "lago_v2_preferences";

  function loadPreferences() {

    try {

      return JSON.parse(
        localStorage.getItem(STORAGE_KEY) || "null"
      ) || {};

    } catch {

      return {};

    }

  }

  function savePreferences(data) {

    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(data)
    );

  }


  /* -------------------------------------------------------
     LANGUAGE DETECTION
  ------------------------------------------------------- */

  function detectLanguage() {

    const browser =
      navigator.language ||
      navigator.userLanguage ||
      "en";

    const code =
      browser
        .split("-")[0]
        .toLowerCase();

    return LANGUAGES[code]
      ? code
      : "en";

  }


  /* -------------------------------------------------------
     ONBOARDING
  ------------------------------------------------------- */

  function createOnboarding() {

    const saved = loadPreferences();

    const overlay = document.createElement("div");

    overlay.className = "lago-onboarding";

    overlay.id = "lagoOnboarding";

    const countryOptions = COUNTRIES
      .map(c => {

        return `
          <option
            value="${c[0]}"
            data-lang="${c[3]}"
          >
            ${c[1]} ${c[2]}
          </option>
        `;

      })
      .join("");

    overlay.innerHTML = `

      <div class="lago-onboarding-card">

        <div class="lago-onboarding-logo">
          LAGO
        </div>

        <div class="lago-onboarding-title">
          THE ULTIMATE BRAINROT SNAIL
        </div>

        <div class="lago-onboarding-label">
          COUNTRY
        </div>

        <select
          id="lagoCountry"
          class="lago-select"
        >
          ${countryOptions}
        </select>

        <div class="lago-onboarding-label">
          LANGUAGE
        </div>

        <select
          id="lagoLanguage"
          class="lago-select"
        >
          ${Object.entries(LANGUAGES)
            .map(([code, lang]) => `
              <option value="${code}">
                ${lang.name}
              </option>
            `)
            .join("")}
        </select>

        <button
          id="lagoStart"
          class="lago-start"
        >
          START PLAYING
        </button>

      </div>

    `;

    document.body.appendChild(overlay);


    const country =
      overlay.querySelector("#lagoCountry");

    const language =
      overlay.querySelector("#lagoLanguage");

    const start =
      overlay.querySelector("#lagoStart");


    const detected =
      saved.country ||
      COUNTRIES.find(
        c => c[3] === detectLanguage()
      )?.[0] ||
      "US";

    country.value = detected;

    language.value =
      saved.language ||
      country
        .selectedOptions[0]
        ?.dataset.lang ||
      detectLanguage();


    country.addEventListener("change", () => {

      const lang =
        country
          .selectedOptions[0]
          ?.dataset.lang;

      if (lang && LANGUAGES[lang]) {

        language.value = lang;

      }

    });


    start.addEventListener("click", () => {

      const preferences = {

        country: country.value,

        language: language.value,

        completed: true

      };

      savePreferences(preferences);

      applyLanguage(language.value);

      overlay.classList.add("hidden");

      setTimeout(() => {

        overlay.remove();

      }, 400);

    });


    if (saved.completed) {

      overlay.classList.add("hidden");

      setTimeout(() => {

        overlay.remove();

      }, 400);

    }

  }


  /* -------------------------------------------------------
     TRANSLATION
  ------------------------------------------------------- */

  function applyLanguage(code) {

    const lang =
      LANGUAGES[code] ||
      LANGUAGES.en;


    document.documentElement.lang = code;


    const setText = (selector, text) => {

      const el =
        document.querySelector(selector);

      if (el) el.textContent = text;

    };


    setText(".sub", lang.subtitle);

    setText("#energy", document.querySelector("#energy")?.textContent || "0");

    const stats =
      document.querySelectorAll(".stat small");

    if (stats.length >= 4) {

      stats[0].textContent =
        "💎 " + lang.energy;

      stats[1].textContent =
        "⚡ " + lang.power;

      stats[2].textContent =
        "🤖 " + lang.auto;

      stats[3].textContent =
        "🛡️ " + lang.shield;

    }

    const mainButton =
      document.querySelector(".btn.main");

    if (mainButton) {

      mainButton.textContent =
        "🐌 " + lang.tap;

    }

    document
      .querySelectorAll("[data-lago-nav]")
      .forEach(button => {

        const key =
          button.dataset.lagoNav;

        if (lang[key]) {

          button.textContent =
            lang[key];

        }

      });

  }


  /* -------------------------------------------------------
     LIVING SNAIL
  ------------------------------------------------------- */

  function setupLivingSnail() {

    const snail =
      document.querySelector("#snail");

    if (!snail) return;


    /* Random idle personality */

    let idleTimer = null;


    function randomIdle() {

      if (
        document.hidden ||
        snail.classList.contains("lago-hit")
      ) {

        return;

      }


      const type =
        Math.floor(
          Math.random() * 4
        );


      if (type === 0) {

        snail.style.filter =
          "drop-shadow(0 20px 25px rgba(0,0,0,.35)) brightness(1.08)";

        setTimeout(() => {

          snail.style.filter = "";

        }, 280);

      }


      if (type === 1) {

        snail.animate(
          [
            {
              transform:
                "translateY(0) rotate(0deg)"
            },

            {
              transform:
                "translateY(-13px) rotate(-2deg)"
            },

            {
              transform:
                "translateY(0) rotate(0deg)"
            }
          ],
          {
            duration: 650,
            easing: "cubic-bezier(.2,.8,.2,1)"
          }
        );

      }


      if (type === 2) {

        snail.animate(
          [
            {
              transform:
                "scale(1)"
            },

            {
              transform:
                "scale(1.035)"
            },

            {
              transform:
                "scale(1)"
            }
          ],
          {
            duration: 900,
            easing: "ease-in-out"
          }
        );

      }


      if (type === 3) {

        snail.animate(
          [
            {
              transform:
                "rotate(0deg)"
            },

            {
              transform:
                "rotate(-1.8deg)"
            },

            {
              transform:
                "rotate(1.8deg)"
            },

            {
              transform:
                "rotate(0deg)"
            }
          ],
          {
            duration: 700,
            easing: "ease-in-out"
          }
        );

      }

    }


    function scheduleIdle() {

      clearTimeout(idleTimer);

      idleTimer =
        setTimeout(() => {

          randomIdle();

          scheduleIdle();

        }, 3500 + Math.random() * 5000);

    }


    scheduleIdle();


    /* Reset idle after player interaction */

    ["pointerdown", "touchstart"].forEach(eventName => {

      snail.addEventListener(
        eventName,
        () => {

          scheduleIdle();

        },
        {
          passive: true
        }
      );

    });


    /* Add enhanced click reaction */

    snail.addEventListener(
      "animationend",
      () => {

        snail.classList.remove(
          "lago-hit"
        );

      }
    );

  }


  /* -------------------------------------------------------
     INTERCEPT CLICK REACTION
  ------------------------------------------------------- */

  function setupClickAnimation() {

    const snail =
      document.querySelector("#snail");

    if (!snail) return;


    document.addEventListener(
      "click",
      event => {

        const target =
          event.target.closest("#snail");

        if (!target) return;


        snail.classList.remove(
          "lago-hit"
        );

        void snail.offsetWidth;

        snail.classList.add(
          "lago-hit"
        );


        /* little screen pulse */

        const app =
          document.querySelector(".app");

        if (app) {

          app.animate(
            [
              {
                transform: "scale(1)"
              },

              {
                transform: "scale(.997)"
              },

              {
                transform: "scale(1)"
              }
            ],
            {
              duration: 120
            }
          );

        }

      },
      true
    );

  }


  /* -------------------------------------------------------
     NAVIGATION LABELS
  ------------------------------------------------------- */

  function upgradeNavigation() {

    const bottom =
      document.querySelector(".bottom");

    if (!bottom) return;


    const buttons =
      bottom.querySelectorAll(".btn");


    buttons.forEach((button, index) => {

      if (!button.dataset.lagoNav) {

        if (index === 0)
          button.dataset.lagoNav = "play";

        if (index === 1)
          button.dataset.lagoNav = "create";

        if (index === 2)
          button.dataset.lagoNav = "collection";

      }

    });

  }


  /* -------------------------------------------------------
     APP ACTIVATION
  ------------------------------------------------------- */

  function activate() {

    const app =
      document.querySelector(".app");

    if (!app) return;


    app.classList.add(
      "lago-v2-active"
    );


    upgradeNavigation();

    setupLivingSnail();

    setupClickAnimation();

    createOnboarding();


    const saved =
      loadPreferences();


    if (saved.language) {

      applyLanguage(
        saved.language
      );

    } else {

      applyLanguage(
        detectLanguage()
      );

    }

  }


  /* -------------------------------------------------------
     START
  ------------------------------------------------------- */

  if (
    document.readyState ===
    "loading"
  ) {

    document.addEventListener(
      "DOMContentLoaded",
      activate
    );

  } else {

    activate();

  }

})();

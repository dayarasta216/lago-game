(() => {
  "use strict";

  /*
   * LAGO ONBOARDING
   * R0.1
   *
   * First launch has ONE job:
   * choose a language.
   *
   * The actual language screen belongs to
   * window.LAGO_LANGUAGE. This module only
   * decides whether it must be shown once.
   */

  const PROFILE_STORAGE = "lago_profile_v1";
  const LANGUAGE_STORAGE = "lago_language_v1";

  let opening = false;
  let completed = false;


  function readProfile() {
    try {
      const value = JSON.parse(
        localStorage.getItem(PROFILE_STORAGE)
      );

      return value && typeof value === "object"
        ? value
        : {};
    } catch {
      return {};
    }
  }


  function writeProfile(language) {
    const previous = readProfile();

    const next = {
      ...previous,
      language:
        language ||
        previous.language ||
        "en",
      completed: true
    };

    localStorage.setItem(
      PROFILE_STORAGE,
      JSON.stringify(next)
    );

    return next;
  }


  function getStoredLanguage() {
    const direct =
      localStorage.getItem(
        LANGUAGE_STORAGE
      );

    if (direct) {
      return direct;
    }

    const profile =
      readProfile();

    return profile.language || "";
  }


  function hasCompletedOnboarding() {
    const profile =
      readProfile();

    return (
      profile.completed === true ||
      Boolean(
        localStorage.getItem(
          LANGUAGE_STORAGE
        )
      )
    );
  }


  function syncLegacyProfile() {
    const profile =
      readProfile();

    const directLanguage =
      localStorage.getItem(
        LANGUAGE_STORAGE
      );

    /*
     * Migration from the old
     * country -> language onboarding.
     *
     * Existing users must NOT
     * see onboarding again.
     */
    if (
      profile.completed === true &&
      !directLanguage
    ) {
      const legacyLanguage =
        profile.language || "en";

      if (
        window.LAGO_LANGUAGE &&
        typeof
          window.LAGO_LANGUAGE.set ===
          "function"
      ) {
        window.LAGO_LANGUAGE.set(
          legacyLanguage
        );
      } else {
        localStorage.setItem(
          LANGUAGE_STORAGE,
          legacyLanguage
        );
      }
    }

    /*
     * If the new language module
     * already contains a language,
     * sync the old profile for
     * compatibility.
     */
    if (
      directLanguage &&
      profile.completed !== true
    ) {
      writeProfile(
        directLanguage
      );
    }
  }


  function finish(language) {
    if (completed) {
      return;
    }

    const selected =
      language ||
      getStoredLanguage() ||
      "en";

    writeProfile(
      selected
    );

    /*
     * Sync the unified Lago bridge.
     */
    try {
      window.LAGO
        ?.setLanguage
        ?.(selected);
    } catch (error) {
      console.warn(
        "[LAGO ONBOARDING] Could not sync bridge language:",
        error
      );
    }

    completed = true;
    opening = false;

    document.dispatchEvent(
      new CustomEvent(
        "lago:onboarding-complete",
        {
          detail: {
            language: selected
          }
        }
      )
    );
  }


  function onLanguageSelected(
    event
  ) {
    const language =
      event?.detail?.language ||
      getStoredLanguage() ||
      "en";

    finish(
      language
    );
  }


  function open() {
    if (
      opening ||
      completed
    ) {
      return;
    }

    if (
      hasCompletedOnboarding()
    ) {
      completed = true;
      return;
    }

    if (
      !window.LAGO_LANGUAGE ||
      typeof
        window.LAGO_LANGUAGE.open !==
        "function"
    ) {
      /*
       * lago-language.js should
       * load before this file.
       *
       * If it is not ready yet,
       * retry instead of creating
       * another duplicated selector.
       */
      setTimeout(
        open,
        80
      );

      return;
    }

    opening = true;

    /*
     * The SAME language selector
     * is used for onboarding and
     * later manual language changes.
     *
     * On first launch it cannot
     * be closed without choosing.
     */
    window.LAGO_LANGUAGE.open({
      closable: false
    });
  }


  function reset() {
    /*
     * Development helper.
     *
     * Can be called from console:
     *
     * LAGO_ONBOARDING.reset()
     *
     * This lets us test the
     * first-launch flow again.
     */
    localStorage.removeItem(
      PROFILE_STORAGE
    );

    localStorage.removeItem(
      LANGUAGE_STORAGE
    );

    completed = false;
    opening = false;

    window.LAGO_LANGUAGE
      ?.close
      ?.();

    open();
  }


  function init() {
    /*
     * First migrate players
     * from the old onboarding.
     */
    syncLegacyProfile();

    /*
     * Already completed:
     * do not show anything.
     */
    if (
      hasCompletedOnboarding()
    ) {
      completed = true;

      const language =
        getStoredLanguage();

      if (
        language &&
        window.LAGO_LANGUAGE &&
        typeof
          window.LAGO_LANGUAGE.set ===
          "function"
      ) {
        window.LAGO_LANGUAGE.set(
          language
        );
      }

      return;
    }

    /*
     * The language module emits
     * lago:language after the
     * player selects a language.
     */
    document.addEventListener(
      "lago:language",
      onLanguageSelected
    );

    /*
     * Small delay allows the
     * rest of the first frame
     * to initialize cleanly.
     */
    setTimeout(
      open,
      120
    );
  }


  /*
   * PUBLIC API
   */
  window.LAGO_ONBOARDING = {
    open,

    isComplete() {
      return (
        completed ||
        hasCompletedOnboarding()
      );
    },

    getProfile() {
      return {
        ...readProfile()
      };
    },

    reset
  };


  if (
    document.readyState ===
    "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      init,
      {
        once: true
      }
    );
  } else {
    init();
  }

})();
  let selectedCountry =
    profile?.country || "";

  let selectedLanguage =
    profile?.language || "";

  let step = 1;


  function saveProfile() {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        country: selectedCountry,
        language: selectedLanguage,
        completed: true
      })
    );
  }


  function injectStyles() {
    if (
      document.querySelector(
        "#lagoOnboardingStyles"
      )
    ) return;

    const style =
      document.createElement("style");

    style.id =
      "lagoOnboardingStyles";

    style.textContent = `
      #lagoOnboarding {
        position: fixed;
        inset: 0;
        z-index: 99999;

        display: none;
        align-items: center;
        justify-content: center;

        padding: 20px;

        background:
          radial-gradient(
            circle at 50% 35%,
            rgba(204,255,0,.08),
            transparent 30%
          ),
          rgba(4,4,7,.96);

        backdrop-filter: blur(24px);
        -webkit-backdrop-filter: blur(24px);

        font-family:
          Inter,
          -apple-system,
          BlinkMacSystemFont,
          "Segoe UI",
          sans-serif;
      }

      #lagoOnboarding.show {
        display: flex;
      }

      .lago-onboarding-card {
        width: min(460px, 100%);
        max-height: 90dvh;

        overflow: hidden;

        border-radius: 30px;

        background:
          linear-gradient(
            145deg,
            #15171c,
            #090a0d
          );

        border:
          1px solid
          rgba(255,255,255,.10);

        box-shadow:
          0 40px 120px
          rgba(0,0,0,.7);

        color: white;

        animation:
          lagoOnboardingIn
          .45s
          cubic-bezier(.16,1,.3,1);
      }

      @keyframes lagoOnboardingIn {
        from {
          opacity: 0;
          transform:
            translateY(25px)
            scale(.96);
        }

        to {
          opacity: 1;
          transform:
            translateY(0)
            scale(1);
        }
      }

      .lago-onboarding-top {
        padding:
          30px 26px 10px;

        text-align: center;
      }

      .lago-onboarding-logo {
        font-size: 42px;
        line-height: 1;

        font-weight: 1000;
        letter-spacing: -.07em;

        color: #c9ff32;

        text-shadow:
          0 0 35px
          rgba(201,255,50,.15);
      }

      .lago-onboarding-step {
        margin-top: 12px;

        color:
          rgba(255,255,255,.42);

        font-size: 9px;
        font-weight: 900;

        letter-spacing: .16em;
      }

      .lago-onboarding-content {
        padding:
          20px 22px 24px;
      }

      .lago-onboarding-title {
        margin: 0;

        font-size: 27px;
        line-height: 1.05;

        letter-spacing: -.05em;

        font-weight: 950;

        text-align: center;
      }

      .lago-onboarding-subtitle {
        margin:
          10px auto 22px;

        max-width: 330px;

        color:
          rgba(255,255,255,.48);

        font-size: 12px;
        line-height: 1.5;

        text-align: center;
      }

      .lago-country-list {
        display: grid;

        grid-template-columns:
          repeat(2, 1fr);

        gap: 8px;

        max-height: 390px;

        overflow-y: auto;

        padding-right: 2px;
      }

      .lago-country-option,
      .lago-language-option {
        min-height: 58px;

        display: flex;

        align-items: center;

        gap: 11px;

        padding:
          0 14px;

        border-radius: 15px;

        background:
          rgba(255,255,255,.035);

        border:
          1px solid
          rgba(255,255,255,.08);

        color: white;

        text-align: left;

        cursor: pointer;

        transition:
          transform .15s ease,
          background .15s ease,
          border-color .15s ease;
      }

      .lago-country-option:hover,
      .lago-language-option:hover {
        transform:
          translateY(-1px);

        background:
          rgba(255,255,255,.07);
      }

      .lago-country-option.selected,
      .lago-language-option.selected {
        background:
          rgba(201,255,50,.10);

        border-color:
          #c9ff32;

        box-shadow:
          0 0 0 1px
          rgba(201,255,50,.05);
      }

      .lago-country-flag,
      .lago-language-flag {
        font-size: 22px;
        flex: 0 0 auto;
      }

      .lago-country-name,
      .lago-language-name {
        min-width: 0;

        overflow: hidden;

        text-overflow: ellipsis;

        white-space: nowrap;

        font-size: 11px;

        font-weight: 850;
      }

      .lago-onboarding-actions {
        display: flex;

        gap: 8px;

        margin-top: 18px;
      }

      .lago-onboarding-button {
        width: 100%;
        min-height: 54px;

        border-radius: 16px;

        border:
          1px solid
          rgba(255,255,255,.08);

        background:
          rgba(255,255,255,.05);

        color: white;

        font-size: 11px;

        font-weight: 950;

        letter-spacing: .04em;

        cursor: pointer;
      }

      .lago-onboarding-button.primary {
        background:
          #c9ff32;

        border-color:
          #c9ff32;

        color:
          #090a0c;

        box-shadow:
          0 10px 30px
          rgba(201,255,50,.10);
      }

      .lago-onboarding-button:disabled {
        opacity: .35;
        cursor: default;
      }

      .lago-language-list {
        display: grid;

        gap: 10px;
      }

      .lago-language-option {
        min-height: 70px;
      }

      .lago-language-name {
        font-size: 15px;
      }

      .lago-onboarding-back {
        width: 54px;

        flex: 0 0 54px;

        font-size: 16px;
      }

      .lago-onboarding-note {
        margin-top: 13px;

        text-align: center;

        color:
          rgba(255,255,255,.28);

        font-size: 9px;
      }

      @media (max-width: 430px) {
        #lagoOnboarding {
          padding: 12px;
        }

        .lago-onboarding-card {
          border-radius: 25px;
        }

        .lago-onboarding-title {
          font-size: 24px;
        }

        .lago-country-list {
          grid-template-columns:
            repeat(2, 1fr);

          max-height: 340px;
        }

        .lago-country-option {
          min-height: 54px;
          padding: 0 10px;
        }

        .lago-country-name {
          font-size: 9px;
        }
      }
    `;

    document.head.appendChild(style);
  }


  function createPanel() {
    if (
      document.querySelector(
        "#lagoOnboarding"
      )
    ) return;

    const overlay =
      document.createElement("div");

    overlay.id =
      "lagoOnboarding";

    overlay.innerHTML = `
      <div class="lago-onboarding-card">

        <div class="lago-onboarding-top">

          <div class="lago-onboarding-logo">
            LAGO
          </div>

          <div
            class="lago-onboarding-step"
            id="lagoOnboardingStep"
          >
            STEP 1 OF 2
          </div>

        </div>

        <div
          class="lago-onboarding-content"
          id="lagoOnboardingContent"
        ></div>

      </div>
    `;

    document.body.appendChild(overlay);
  }


  function renderCountryStep() {
    step = 1;

    const content =
      document.querySelector(
        "#lagoOnboardingContent"
      );

    const stepLabel =
      document.querySelector(
        "#lagoOnboardingStep"
      );

    if (!content) return;

    stepLabel.textContent =
      "STEP 1 OF 2";

    content.innerHTML = `
      <h1 class="lago-onboarding-title">
        WHERE ARE YOU FROM?
      </h1>

      <p class="lago-onboarding-subtitle">
        Choose your country to personalize
        your LAGO experience.
      </p>

      <div class="lago-country-list">

        ${countries.map(country => `
          <button
            class="
              lago-country-option
              ${
                selectedCountry === country[0]
                  ? "selected"
                  : ""
              }
            "
            data-country="${country[0]}"
          >

            <span class="lago-country-flag">
              ${country[1]}
            </span>

            <span class="lago-country-name">
              ${country[2]}
            </span>

          </button>
        `).join("")}

      </div>

      <div class="lago-onboarding-actions">

        <button
          class="
            lago-onboarding-button
            primary
          "
          id="lagoCountryContinue"
          ${selectedCountry ? "" : "disabled"}
        >
          CONTINUE →
        </button>

      </div>

      <div class="lago-onboarding-note">
        You can change this later.
      </div>
    `;

    content
      .querySelectorAll(
        "[data-country]"
      )
      .forEach(button => {

        button.addEventListener(
          "click",
          () => {

            selectedCountry =
              button.dataset.country;

            renderCountryStep();

          }
        );

      });

    const next =
      document.querySelector(
        "#lagoCountryContinue"
      );

    next?.addEventListener(
      "click",
      renderLanguageStep
    );
  }


  function renderLanguageStep() {
    step = 2;

    const content =
      document.querySelector(
        "#lagoOnboardingContent"
      );

    const stepLabel =
      document.querySelector(
        "#lagoOnboardingStep"
      );

    if (!content) return;

    stepLabel.textContent =
      "STEP 2 OF 2";

    content.innerHTML = `
      <h1 class="lago-onboarding-title">
        CHOOSE YOUR LANGUAGE
      </h1>

      <p class="lago-onboarding-subtitle">
        LAGO is built for everyone.
        Choose how you want to play.
      </p>

      <div class="lago-language-list">

        ${languages.map(lang => `
          <button
            class="
              lago-language-option
              ${
                selectedLanguage === lang[0]
                  ? "selected"
                  : ""
              }
            "
            data-language="${lang[0]}"
          >

            <span class="lago-language-flag">
              ${lang[1]}
            </span>

            <span class="lago-language-name">
              ${lang[2]}
            </span>

          </button>
        `).join("")}

      </div>

      <div class="lago-onboarding-actions">

        <button
          class="
            lago-onboarding-button
            lago-onboarding-back
          "
          id="lagoOnboardingBack"
        >
          ←
        </button>

        <button
          class="
            lago-onboarding-button
            primary
          "
          id="lagoFinishOnboarding"
          ${selectedLanguage ? "" : "disabled"}
        >
          ENTER LAGO →
        </button>

      </div>

      <div class="lago-onboarding-note">
        Your preferences are saved on this device.
      </div>
    `;

    content
      .querySelectorAll(
        "[data-language]"
      )
      .forEach(button => {

        button.addEventListener(
          "click",
          () => {

            selectedLanguage =
              button.dataset.language;

            renderLanguageStep();

          }
        );

      });

    document
      .querySelector(
        "#lagoOnboardingBack"
      )
      ?.addEventListener(
        "click",
        renderCountryStep
      );

    document
      .querySelector(
        "#lagoFinishOnboarding"
      )
      ?.addEventListener(
        "click",
        finish
      );
  }


  function finish() {
    if (
      !selectedCountry ||
      !selectedLanguage
    ) return;

    saveProfile();

    /*
      Connect with our language
      system if it exists.
    */

    if (
      window.LAGO_LANGUAGE &&
      typeof
        window.LAGO_LANGUAGE.set ===
        "function"
    ) {

      window.LAGO_LANGUAGE.set(
        selectedLanguage
      );

    }

    const overlay =
      document.querySelector(
        "#lagoOnboarding"
      );

    if (overlay) {

      overlay.classList.remove(
        "show"
      );

    }

    setTimeout(() => {

      overlay?.remove();

    }, 500);
  }


  function open() {
    createPanel();

    const overlay =
      document.querySelector(
        "#lagoOnboarding"
      );

    if (!overlay) return;

    renderCountryStep();

    overlay.classList.add(
      "show"
    );
  }


  function init() {
    injectStyles();

    /*
      Existing profile means the
      player has already completed
      onboarding.
    */

    if (
      profile?.completed === true
    ) {
      return;
    }

    setTimeout(
      open,
      500
    );
  }


  window.LAGO_ONBOARDING = {
    open
  };


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

})();

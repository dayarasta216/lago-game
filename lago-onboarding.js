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
 

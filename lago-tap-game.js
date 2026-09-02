(() => {
  "use strict";

  /*
   * =========================================================
   * TAP LAGO
   * Mini-Game #001
   *
   * Gameplay owner:
   * - tap
   * - steal
   * - auto income
   *
   * R0.3C3
   * =========================================================
   */


  const runtime =
    window.LAGO_LEGACY_RUNTIME;


  if (!runtime) {

    console.error(
      "[TAP LAGO] Legacy runtime adapter is missing."
    );

    return;

  }


  const PHRASES =
    runtime.getPhrases();


  let autoTimer =
    null;


  function state() {

    return runtime.getState();

  }


  function memeClickBonus() {

    const current =
      state();


    return (
      current.memes || []
    ).reduce(
      (sum, meme) =>
        sum +
        (
          meme.clickBonus ||
          0
        ),
      0
    );

  }


  function memeAutoBonus() {

    const current =
      state();


    return (
      current.memes || []
    ).reduce(
      (sum, meme) =>
        sum +
        (
          meme.autoBonus ||
          0
        ),
      0
    );

  }


  function randomPhrase() {

    if (!PHRASES.length) {

      return "Lago is lagging...";

    }


    return PHRASES[
      Math.floor(
        Math.random() *
        PHRASES.length
      )
    ];

  }


  /*
   * =========================================================
   * TAP
   * =========================================================
   */

  function tap(event = null) {

    const current =
      state();


    const gain =
      current.power +
      memeClickBonus();


    current.energy +=
      gain;


    current.totalClicks++;


    runtime.animateSnail();


    runtime.setSpeech(
      randomPhrase()
    );


    runtime.beep(
      180 +
      Math.random() *
      420,
      0.045
    );


    runtime.spawnFloat(
      `+${gain} МЭ`,
      event
    );


    runtime.checkAchievements();


    runtime.render();


    runtime.save();


    return getState();

  }


  /*
   * =========================================================
   * STEAL
   * =========================================================
   */

  function steal() {

    const current =
      state();


    if (
      current.energy < 5
    ) {

      runtime.toast(
        "Сначала собери хотя бы 5 МЭ 😭"
      );


      runtime.beep(
        90,
        0.1
      );


      return getState();

    }


    const success =
      Math.random() <
      (
        0.40 +
        Math.min(
          0.20,
          current.shield *
          0.02
        )
      );


    const amount =
      Math.max(
        1,
        Math.floor(
          5 +
          Math.random() *
          Math.max(
            10,
            current.energy *
            0.18
          )
        )
      );


    if (success) {

      current.energy +=
        amount;


      current.steals++;


      runtime.toast(
        `👾 ОГРАБИЛ! +${amount} МЭ`
      );


      runtime.beep(
        740,
        0.08
      );


      runtime.beep(
        920,
        0.08
      );

    } else {

      const loss =
        Math.max(
          1,
          Math.floor(
            amount *
            (
              1 -
              current.shield *
              0.1
            )
          )
        );


      current.energy =
        Math.max(
          0,
          current.energy -
          loss
        );


      runtime.toast(
        `🚓 СПАЛИЛИ! -${loss} МЭ`
      );


      runtime.beep(
        120,
        0.14
      );

    }


    if (
      current.energy <= 0
    ) {

      runtime.gameOver();

    }


    runtime.checkAchievements();


    runtime.render();


    runtime.save();


    return getState();

  }


  /*
   * =========================================================
   * AUTO INCOME
   * =========================================================
   */

  function autoTick() {

    const current =
      state();


    if (
      current.auto <= 0
    ) {

      return;

    }


    const gain =
      current.auto +
      memeAutoBonus();


    current.energy +=
      gain;


    runtime.checkAchievements();


    runtime.render();

  }


  function startAuto() {

    if (autoTimer) {
      return;
    }


    autoTimer =
      setInterval(
        autoTick,
        1000
      );

  }


  function stopAuto() {

    if (!autoTimer) {
      return;
    }


    clearInterval(
      autoTimer
    );


    autoTimer =
      null;

  }


  /*
   * =========================================================
   * STATE
   * =========================================================
   */

  function getState() {

    return runtime.getTapState();

  }


  /*
   * =========================================================
   * LEGACY CONTROL COMPATIBILITY
   *
   * Old buttons still work while
   * the old markup exists.
   * =========================================================
   */

  function bindLegacyControls() {

    document
      .getElementById(
        "clickBtn"
      )
      ?.addEventListener(
        "click",
        event => {

          tap(event);

        }
      );


    document
      .getElementById(
        "snail"
      )
      ?.addEventListener(
        "pointerdown",
        event => {

          event.preventDefault();

          tap(event);

        }
      );


    const stealButton =
      document.getElementById(
        "stealBtn"
      );


    if (stealButton) {

      stealButton.onclick =
        steal;

    }

  }


  /*
   * =========================================================
   * PUBLIC GAME MODULE
   * =========================================================
   */

  const game = {

    id:
      "tap-lago",


    name:
      "Tap Lago",


    category:
      "clicker",


    version:
      2,


    tap,


    steal,


    getState,


    startAuto,


    stopAuto,


    openUpgrades() {

      runtime.openUpgrades();

    },


    openCreator() {

      runtime.openCreator();

    },


    share() {

      runtime.share();

    }

  };


  window.LAGO_TAP_GAME =
    game;


  /*
   * Start Mini-Game #001.
   */

  bindLegacyControls();


  startAuto();


  /*
   * Publish one clean state
   * after module startup.
   */

  runtime.render();


  document.dispatchEvent(
    new CustomEvent(
      "lago:game-ready",
      {
        detail: {

          id:
            game.id,

          name:
            game.name,

          category:
            game.category,

          version:
            game.version

        }
      }
    )
  );

})();
    id:
      "tap-lago",

    name:
      "Tap Lago",

    category:
      "clicker",

    version:
      1,


    /*
     * Main gameplay action.
     */

    tap() {

      return runtime.tap();

    },


    /*
     * Risk / steal mechanic.
     */

    steal() {

      return runtime.steal();

    },


    /*
     * Temporary legacy panels.
     *
     * These will later become
     * proper Portal/Game UI.
     */

    openUpgrades() {

      runtime.openUpgrades();

    },


    openCreator() {

      runtime.openCreator();

    },


    share() {

      runtime.share();

    },


    /*
     * Read-only public snapshot.
     */

    getState() {

      return runtime.getTapState();

    }

  };


  /*
   * Public Mini-Game API.
   */

  window.LAGO_TAP_GAME =
    game;


  /*
   * This event will later allow
   * the Lago Game Portal to discover
   * games automatically.
   */

  document.dispatchEvent(
    new CustomEvent(
      "lago:game-ready",
      {
        detail: {

          id:
            game.id,

          name:
            game.name,

          category:
            game.category,

          version:
            game.version

        }
      }
    )
  );

})();

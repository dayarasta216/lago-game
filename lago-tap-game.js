(() => {
  "use strict";

  /*
   * =========================================================
   * TAP LAGO
   * Mini-Game #001
   *
   * Public game module.
   *
   * Current R0.3 stage:
   * gameplay mechanics still live inside
   * lago-legacy-runtime.js.
   *
   * That dependency will be removed in
   * the next extraction stage.
   * =========================================================
   */

  const runtime =
    window.LAGO_LEGACY_RUNTIME;


  if (!runtime) {

    console.error(
      "[TAP LAGO] Legacy runtime adapter is missing. " +
      "Load lago-legacy-runtime.js before lago-tap-game.js."
    );

    return;

  }


  const game = {

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

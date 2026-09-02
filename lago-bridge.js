(() => {
  "use strict";

  /*
   * LAGO GAME BRIDGE
   * Connects the old game with
   * the new international interface.
   */

  const STORAGE = "lago_game_state_v2";

  const defaults = {
    mem: 0,
    xp: 0,
    level: 1,
    clicks: 0,
    skins: [],
    selectedSkin: "default",
    country: "",
    language: "en"
  };

  let state = load();


  function load() {
    try {
      const saved =
        JSON.parse(
          localStorage.getItem(STORAGE)
        );

      return {
        ...defaults,
        ...(saved || {})
      };

    } catch {
      return {
        ...defaults
      };
    }
  }


  function save() {
    localStorage.setItem(
      STORAGE,
      JSON.stringify(state)
    );
  }


  function addMem(amount = 1) {

    amount = Number(amount) || 0;

    state.mem += amount;

    state.xp += Math.max(
      1,
      Math.floor(amount)
    );

    state.clicks++;

    updateLevel();

    save();

    sync();

  }


  function updateLevel() {

    const newLevel =
      Math.floor(
        state.xp / 100
      ) + 1;

    if (
      newLevel >
      state.level
    ) {

      state.level =
        newLevel;

      levelUp();

    }

  }


  function levelUp() {

    const event =
      new CustomEvent(
        "lago:levelup",
        {
          detail: {
            level:
              state.level
          }
        }
      );

    document.dispatchEvent(
      event
    );

  }


  function addSkin(
    skinId
  ) {

    if (!skinId)
      return;

    if (
      !state.skins.includes(
        skinId
      )
    ) {

      state.skins.push(
        skinId
      );

      save();

      sync();

    }

  }


  function selectSkin(
    skinId
  ) {

    if (
      skinId ===
      "default" ||
      state.skins.includes(
        skinId
      )
    ) {

      state.selectedSkin =
        skinId;

      save();

      sync();

    }

  }


  function setCountry(
    country
  ) {

    state.country =
      country;

    save();

  }


  function setLanguage(
    language
  ) {

    state.language =
      language;

    save();

  }

function sync() {

  document.dispatchEvent(
    new CustomEvent(
      "lago:state",
      {
        detail: {
          ...state
        }
      }
    )
  );

}


    if (
      window.LAGO_HOME &&
      typeof
        window.LAGO_HOME
          .updateStats ===
        "function"
    ) {

      window.LAGO_HOME
        .updateStats();

    }

  }


  /*
   * PUBLIC API
   */

  window.LAGO = {

    getState() {
      return {
        ...state
      };
    },

    addMem,

    addSkin,

    selectSkin,

    setCountry,

    setLanguage,

    save,

    sync

  };


  /*
   * Compatibility aliases.
   */

  window.LAGO_GAME =
    window.LAGO;


  /*
   * Listen for the existing
   * game's click events.
   */

  document.addEventListener(
    "click",
    event => {

      const target =
        event.target;

      if (!target)
        return;


      /*
       * We deliberately don't
       * count clicks on buttons,
       * menus or navigation.
       */

      if (
        target.closest(
          "button"
        )
      ) return;


      /*
       * Existing game character.
       */

      if (
        target.closest(
          "#snail"
        )
      ) {

        addMem(1);

      }

    }
  );


/*
 * Publish the initial state
 * to active Lago modules.
 */

sync();

})();

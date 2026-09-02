(() => {
  "use strict";

  /*
   * =========================================================
   * LAGO ACCOUNT CORE
   * R0.3D1
   *
   * One account state for the entire Lago Game platform.
   *
   * Future games:
   * Tap Lago
   * Knife Challenge
   * Slowest Race
   * Brain Loading
   * ...
   *
   * all use the same:
   * MEM / XP / LEVEL / SKINS / STATS
   * =========================================================
   */

  const STORAGE_KEY =
    "lago_account_state_v1";

  const LEGACY_BRIDGE_KEY =
    "lago_game_state_v2";

  const LEGACY_TAP_KEY =
    "lago_brainrot_save_v1";

  const LANGUAGE_KEY =
    "lago_language_v1";

  const SCHEMA_VERSION = 1;


  const defaults = {

    schemaVersion:
      SCHEMA_VERSION,

    mem:
      0,

    xp:
      0,

    level:
      1,

    clicks:
      0,

    skins:
      [],

    selectedSkin:
      "default",

    language:
      "en",

    country:
      "",

    /*
     * Per-game statistics.
     *
     * Example:
     *
     * games["tap-lago"]
     * games["knife-challenge"]
     */

    games:
      {},

    lifetime: {

      memEarned:
        0,

      memSpent:
        0,

      xpEarned:
        0

    },

    updatedAt:
      null

  };


  function clone(
    value
  ) {

    return JSON.parse(
      JSON.stringify(
        value
      )
    );

  }


  function readJSON(
    key
  ) {

    try {

      const raw =
        localStorage.getItem(
          key
        );


      return raw
        ? JSON.parse(raw)
        : null;

    } catch {

      return null;

    }

  }


  function uniqueStrings(
    values
  ) {

    return [
      ...new Set(
        (values || [])
          .filter(
            value =>
              typeof value ===
                "string" &&
              value
          )
      )
    ];

  }


  function sanitize(
    input = {}
  ) {

    const next = {

      ...clone(
        defaults
      ),

      ...(
        input &&
        typeof input === "object"
          ? input
          : {}
      )

    };


    next.schemaVersion =
      SCHEMA_VERSION;


    next.mem =
      Math.max(
        0,
        Number(
          next.mem
        ) || 0
      );


    next.xp =
      Math.max(
        0,
        Number(
          next.xp
        ) || 0
      );


    next.level =
      Math.max(
        1,
        Math.floor(
          Number(
            next.level
          ) || 1
        )
      );


    next.clicks =
      Math.max(
        0,
        Math.floor(
          Number(
            next.clicks
          ) || 0
        )
      );


    next.skins =
      uniqueStrings(
        next.skins
      );


    next.selectedSkin =
      typeof next.selectedSkin ===
        "string" &&
      next.selectedSkin

        ? next.selectedSkin
        : "default";


    next.language =
      typeof next.language ===
        "string" &&
      next.language

        ? next.language
        : "en";


    next.country =
      typeof next.country ===
        "string"

        ? next.country
        : "";


    next.games =

      next.games &&
      typeof next.games ===
        "object" &&
      !Array.isArray(
        next.games
      )

        ? next.games
        : {};


    next.lifetime = {

      ...clone(
        defaults.lifetime
      ),

      ...(
        next.lifetime &&
        typeof next.lifetime ===
          "object"

          ? next.lifetime
          : {}
      )

    };


    next.lifetime.memEarned =
      Math.max(
        0,
        Number(
          next.lifetime.memEarned
        ) || 0
      );


    next.lifetime.memSpent =
      Math.max(
        0,
        Number(
          next.lifetime.memSpent
        ) || 0
      );


    next.lifetime.xpEarned =
      Math.max(
        0,
        Number(
          next.lifetime.xpEarned
        ) || 0
      );


    updateLevel(
      next,
      false
    );


    return next;

  }


  /*
   * =========================================================
   * MIGRATION
   *
   * We DO NOT delete old saves yet.
   *
   * The Account Core reads them once
   * and creates the new unified account.
   * =========================================================
   */

  function migrate() {

    const current =
      readJSON(
        STORAGE_KEY
      );


    if (current) {

      return sanitize(
        current
      );

    }


    const oldBridge =
      readJSON(
        LEGACY_BRIDGE_KEY
      ) || {};


    const oldTap =
      readJSON(
        LEGACY_TAP_KEY
      ) || {};


    const savedLanguage =
      localStorage.getItem(
        LANGUAGE_KEY
      );


    /*
     * Important:
     *
     * Old project had TWO MEM-like
     * balances.
     *
     * We take the larger one,
     * not the sum.
     *
     * This prevents duplicated MEM
     * during migration.
     */

    const bridgeMem =
      Number(
        oldBridge.mem
      ) || 0;


    const tapMem =
      Number(
        oldTap.energy
      ) || 0;


    const mem =
      Math.max(
        0,
        bridgeMem,
        tapMem
      );


    return sanitize({

      mem,

      xp:
        Number(
          oldBridge.xp
        ) || 0,

      level:
        Number(
          oldBridge.level
        ) || 1,

      clicks:
        Math.max(

          Number(
            oldBridge.clicks
          ) || 0,

          Number(
            oldTap.totalClicks
          ) || 0

        ),

      skins:
        oldBridge.skins ||
        [],

      selectedSkin:
        oldBridge.selectedSkin ||
        "default",

      language:
        savedLanguage ||
        oldBridge.language ||
        "en",

      country:
        oldBridge.country ||
        "",

      lifetime: {

        memEarned:
          mem,

        memSpent:
          0,

        xpEarned:
          Number(
            oldBridge.xp
          ) || 0

      }

    });

  }


  let state =
    migrate();


  function snapshot() {

    return clone(
      state
    );

  }


  /*
   * =========================================================
   * LEVEL
   * =========================================================
   */

  function updateLevel(
    target = state,
    announce = true
  ) {

    const previous =
      Math.max(
        1,
        Number(
          target.level
        ) || 1
      );


    const next =
      Math.floor(
        (
          Number(
            target.xp
          ) || 0
        ) / 100
      ) + 1;


    target.level =
      Math.max(
        1,
        next
      );


    if (
      announce &&
      target.level >
      previous
    ) {

      document.dispatchEvent(

        new CustomEvent(
          "lago:levelup",
          {

            detail: {

              level:
                target.level

            }

          }
        )

      );

    }

  }


  /*
   * =========================================================
   * SAVE / EVENTS
   * =========================================================
   */

  function save(
    {
      emit = true
    } = {}
  ) {

    state.updatedAt =
      new Date()
        .toISOString();


    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(
        state
      )
    );


    if (emit) {

      sync();

    }


    return snapshot();

  }


  function sync() {

    const detail =
      snapshot();


    /*
     * New canonical event.
     */

    document.dispatchEvent(

      new CustomEvent(
        "lago:account-state",
        {
          detail
        }
      )

    );


    /*
     * Temporary compatibility
     * for existing modules.
     */

    document.dispatchEvent(

      new CustomEvent(
        "lago:state",
        {
          detail
        }
      )

    );

  }


  /*
   * =========================================================
   * MEM ECONOMY
   * =========================================================
   */

  function creditMem(
    amount = 0,
    options = {}
  ) {

    const value =
      Math.max(
        0,
        Number(
          amount
        ) || 0
      );


    if (!value) {

      return snapshot();

    }


    state.mem +=
      value;


    state.lifetime
      .memEarned +=
      value;


    const xp =
      Math.max(
        0,
        Number(
          options.xp
        ) || 0
      );


    if (xp) {

      state.xp +=
        xp;


      state.lifetime
        .xpEarned +=
        xp;


      updateLevel(
        state,
        true
      );

    }


    if (
      options.countClick ===
      true
    ) {

      state.clicks += 1;

    }


    if (
      options.gameId
    ) {

      const game =
        ensureGame(
          options.gameId
        );


      game.memEarned +=
        value;


      if (xp) {

        game.xpEarned +=
          xp;

      }

    }


    return save();

  }


  function spendMem(
    amount = 0,
    options = {}
  ) {

    const value =
      Math.max(
        0,
        Number(
          amount
        ) || 0
      );


    if (!value) {

      return true;

    }


    if (
      state.mem <
      value
    ) {

      return false;

    }


    state.mem -=
      value;


    state.lifetime
      .memSpent +=
      value;


    if (
      options.gameId
    ) {

      ensureGame(
        options.gameId
      ).memSpent += value;

    }


    save();


    return true;

  }


  /*
   * =========================================================
   * XP
   * =========================================================
   */

  function addXP(
    amount = 0,
    options = {}
  ) {

    const value =
      Math.max(
        0,
        Number(
          amount
        ) || 0
      );


    if (!value) {

      return snapshot();

    }


    state.xp +=
      value;


    state.lifetime
      .xpEarned +=
      value;


    if (
      options.gameId
    ) {

      ensureGame(
        options.gameId
      ).xpEarned +=
        value;

    }


    updateLevel(
      state,
      true
    );


    return save();

  }


  function recordClick(
    amount = 1
  ) {

    state.clicks +=
      Math.max(
        0,
        Math.floor(
          Number(
            amount
          ) || 0
        )
      );


    return save();

  }


  /*
   * =========================================================
   * GAME STATS
   * =========================================================
   */

  function ensureGame(
    gameId
  ) {

    const id =
      String(
        gameId || ""
      ).trim();


    if (!id) {

      throw new Error(
        "gameId is required"
      );

    }


    if (
      !state.games[id]
    ) {

      state.games[id] = {

        plays:
          0,

        bestScore:
          0,

        lastScore:
          0,

        memEarned:
          0,

        memSpent:
          0,

        xpEarned:
          0,

        lastPlayedAt:
          null

      };

    }


    return state.games[id];

  }


  function submitGameResult(
    {
      gameId,
      score = 0,
      mem = 0,
      xp = 0
    } = {}
  ) {

    const game =
      ensureGame(
        gameId
      );


    const safeScore =
      Math.max(
        0,
        Number(
          score
        ) || 0
      );


    const safeMem =
      Math.max(
        0,
        Number(
          mem
        ) || 0
      );


    const safeXP =
      Math.max(
        0,
        Number(
          xp
        ) || 0
      );


    game.plays += 1;


    game.lastScore =
      safeScore;


    game.bestScore =
      Math.max(
        game.bestScore || 0,
        safeScore
      );


    game.lastPlayedAt =
      new Date()
        .toISOString();


    if (safeMem) {

      state.mem +=
        safeMem;


      state.lifetime
        .memEarned +=
        safeMem;


      game.memEarned +=
        safeMem;

    }


    if (safeXP) {

      state.xp +=
        safeXP;


      state.lifetime
        .xpEarned +=
        safeXP;


      game.xpEarned +=
        safeXP;

    }


    updateLevel(
      state,
      true
    );


    return save();

  }


  /*
   * =========================================================
   * INVENTORY
   * =========================================================
   */

  function addSkin(
    skinId
  ) {

    const id =
      String(
        skinId || ""
      ).trim();


    if (!id) {

      return snapshot();

    }


    if (
      !state.skins.includes(
        id
      )
    ) {

      state.skins.push(
        id
      );


      save();

    }


    return snapshot();

  }


  function selectSkin(
    skinId
  ) {

    const id =
      String(
        skinId || ""
      ).trim();


    if (!id) {

      return false;

    }


    if (
      id !== "default" &&
      !state.skins.includes(
        id
      )
    ) {

      return false;

    }


    state.selectedSkin =
      id;


    save();


    return true;

  }


  /*
   * =========================================================
   * PROFILE
   * =========================================================
   */

  function setLanguage(
    language
  ) {

    const value =
      String(
        language || ""
      ).trim();


    if (!value) {

      return false;

    }


    state.language =
      value;


    save();


    return true;

  }


  function setCountry(
    country
  ) {

    state.country =
      String(
        country || ""
      ).trim();


    save();


    return true;

  }


  /*
   * =========================================================
   * PUBLIC ACCOUNT API
   * =========================================================
   */

  const account = {

    version:
      SCHEMA_VERSION,

    getState:
      snapshot,

    save,

    sync,

    creditMem,

    spendMem,

    addXP,

    recordClick,

    submitGameResult,

    addSkin,

    selectSkin,

    setLanguage,

    setCountry

  };


  window.LAGO_ACCOUNT =
    account;


  /*
   * =========================================================
   * TEMPORARY COMPATIBILITY API
   *
   * Existing Collection / Rewards /
   * Language / Modern modules still
   * use window.LAGO.
   * =========================================================
   */

  window.LAGO = {

    getState:
      snapshot,


    /*
     * Preserve old bridge behavior
     * until modules are migrated.
     */

    addMem(
      amount = 1
    ) {

      const value =
        Math.max(
          0,
          Number(
            amount
          ) || 0
        );


      return creditMem(
        value,
        {

          xp:
            Math.max(
              1,
              Math.floor(
                value
              )
            ),

          countClick:
            true,

          gameId:
            "legacy"

        }
      );

    },


    addSkin,

    selectSkin,

    setCountry,

    setLanguage,

    save,

    sync

  };


  window.LAGO_GAME =
    window.LAGO;


  /*
   * Persist migrated account
   * without firing events yet.
   */

  save({
    emit:
      false
  });


  /*
   * First state broadcast.
   */

  if (
    document.readyState ===
    "loading"
  ) {

    document.addEventListener(
      "DOMContentLoaded",
      sync,
      {
        once: true
      }
    );

  } else {

    sync();

  }

})();

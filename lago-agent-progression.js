
(() => {
  "use strict";

  /*
   * LAGO GAME 2.0
   * R1.6A — AGENT PROGRESSION FOUNDATION
   *
   * Read-only adapter for existing Account Core.
   * No balance mutations.
   * No additional storage.
   */

  const VERSION = 1;

  function number(value, fallback = 0) {

    const result = Number(value);

    return Number.isFinite(result)
      ? result
      : fallback;

  }

  function positive(value, fallback = 0) {

    return Math.max(
      0,
      number(value, fallback)
    );

  }

  function clamp(value, min, max) {

    return Math.min(
      max,
      Math.max(min, number(value))
    );

  }

  function percentage(value, max) {

    if (max <= 0) return 0;

    return clamp(
      value / max * 100,
      0,
      100
    );

  }

  function getState() {

    const account = window.LAGO_ACCOUNT;
    const runtime = window.LAGO_MINIGAMES;

    if (
      !account?.getState ||
      !account?.getSPState ||
      !account?.getDumEnergy
    ) {

      return {
        version: VERSION,
        ready: false
      };

    }

    const state = account.getState();

    const sp = account.getSPState();

    const energy = account.getDumEnergy();

    const character =
      runtime?.getContext?.();

    /*
     * Health and stamina are separate.
     */

    const hpMax = positive(
      state.life?.max,
      100
    );

    const hp = clamp(
      state.life?.value,
      0,
      hpMax
    );

    const energyMax = positive(
      energy.max
    );

    const energyValue = clamp(
      energy.dum,
      0,
      energyMax
    );

    /*
     * XP uses permanent lifetime SP earned.
     *
     * Spending SP must not decrease XP.
     */

    const xp = positive(
      sp.lifetimeEarned
    );

    const balance = positive(
      sp.balance
    );

    const level = Math.max(
      1,
      Math.floor(number(sp.level, 1))
    );

    /*
     * Existing Account Core progression:
     * 100 lifetime SP per level.
     */

    const xpPerLevel = 100;

    const levelXP =
      xp % xpPerLevel;

    return {

      version: VERSION,

      ready: true,

      characterId:
        character?.characterId || "lago",

      characterName:
        character?.characterName || "Lago",

      /*
       * Existing progression is account-wide.
       * Per-agent progression arrives later.
       */

      scope: "account",

      health: {

        value: hp,

        max: hpMax,

        percent:
          percentage(hp, hpMax),

        status:
          state.life?.status || "unknown"

      },

      energy: {

        value: energyValue,

        max: energyMax,

        percent:
          percentage(
            energyValue,
            energyMax
          ),

        regenSecondsPerPoint:
          positive(
            energy.regenSecondsPerPoint
          )

      },

      experience: {

        total: xp,

        level,

        currentLevelXP: levelXP,

        requiredLevelXP: xpPerLevel,

        progressPercent:
          percentage(
            levelXP,
            xpPerLevel
          )

      },

      economy: {

        spBalance: balance,

        lifetimeSPEarned: xp,

        lifetimeSPSpent:
          positive(sp.lifetimeSpent)

      },

      agent: {

        bond: null,

        memoryConnected: false,

        aiConnected:
          window.LAGO_AGENT_CHAT
            ?.getState?.()?.aiConnected === true,

        tradingConnected: false

      }

    };

  }

  window.LAGO_AGENT_PROGRESSION =
    Object.freeze({

      version: VERSION,

      getState

    });

})();

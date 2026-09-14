(() => {
  "use strict";

  const VERSION = 1;

  const VALID_STATUSES =
    new Set([
      "available",
      "coming",
      "locked"
    ]);

  const games =
    new Map();

  let activeRun =
    null;

  let runSequence =
    0;


  function clean(value) {
    return String(
      value ?? ""
    ).trim();
  }


  function account() {
    return window.LAGO_ACCOUNT || null;
  }


  function publicGame(game) {

    if (!game) {
      return null;
    }

    return {
      id:
        game.id,

      name:
        game.name,

      description:
        game.description,

      icon:
        game.icon,

      emoji:
        game.emoji,

      status:
        game.status,

      dumCost:
        game.dumCost,

      maxRewardSP:
        game.maxRewardSP,

      requiredCharacter:
        game.requiredCharacter
    };
  }


  function normalizeGame(input = {}) {

    const id =
      clean(
        input.id
      ).toLowerCase();


    if (
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/
        .test(id)
    ) {

      throw new Error(
        "Invalid mini-game id"
      );

    }


    const rawStatus =
      clean(
        input.status
      ).toLowerCase();


    const status =
      VALID_STATUSES.has(
        rawStatus
      )

        ? rawStatus
        : "coming";


    return Object.freeze({

      id,

      name:
        clean(
          input.name
        ) || id,

      description:
        clean(
          input.description
        ),

      icon:
        clean(
          input.icon
        ),

      emoji:
        clean(
          input.emoji
        ),

      status,

      dumCost:
        Math.max(
          0,
          Math.floor(
            Number(
              input.dumCost
            ) || 0
          )
        ),

      maxRewardSP:
        Math.max(
          0,
          Math.floor(
            Number(
              input.maxRewardSP
            ) || 0
          )
        ),

      requiredCharacter:
        clean(
          input.requiredCharacter
        )

    });

  }


  function register(input) {

    const game =
      normalizeGame(
        input
      );


    games.set(
      game.id,
      game
    );


    document.dispatchEvent(
      new CustomEvent(
        "lago:mini-game-registry",
        {
          detail: {
            game:
              publicGame(
                game
              )
          }
        }
      )
    );


    return publicGame(
      game
    );

  }


  function get(id) {

    return publicGame(
      games.get(
        clean(id)
          .toLowerCase()
      ) || null
    );

  }


  function list() {

    return [...games.values()]
      .map(
        publicGame
      );

  }


  function getContext() {

    const api =
      account();


    const state =
      api
        ?.getState
        ?.() || {};


    const selectedSkin =
      clean(
        state.selectedSkin
      ) || "default";


    const isComic =
      window.LAGO_CHARACTERS
        ?.isComicCharacter
        ?.(
          selectedSkin
        ) === true;


    const characterId =
      isComic
        ? selectedSkin
        : "lago";


    const comicCharacter =
      isComic

        ? window.LAGO_CHARACTERS
            ?.getById
            ?.(
              selectedSkin
            ) || null

        : null;


    const dum =
      api
        ?.getDumEnergy
        ?.() || {
          dum: 0,
          max: 0
        };


    const sp =
      api
        ?.getSPState
        ?.() || {
          balance: 0,
          lifetimeEarned: 0,
          level: 1
        };


    return {

      selectedSkin,

      characterId,

      characterName:
        comicCharacter
          ?.name ||
        "Lago",

      dum:
        Math.max(
          0,
          Number(
            dum.dum
          ) || 0
        ),

      dumMax:
        Math.max(
          0,
          Number(
            dum.max
          ) || 0
        ),

      sp:
        Math.max(
          0,
          Number(
            sp.balance
          ) || 0
        ),

      lifetimeSP:
        Math.max(
          0,
          Number(
            sp.lifetimeEarned
          ) || 0
        ),

      level:
        Math.max(
          1,
          Math.floor(
            Number(
              sp.level
            ) || 1
          )
        )

    };

  }


  function checkGame(game) {

    if (!game) {

      return {
        ok: false,
        reason: "missing"
      };

    }


    if (
      game.status !==
      "available"
    ) {

      return {
        ok: false,
        reason:
          game.status
      };

    }


    const context =
      getContext();


    if (
      game.requiredCharacter &&
      context.characterId !==
        game.requiredCharacter
    ) {

      return {
        ok: false,
        reason: "character",

        requiredCharacter:
          game.requiredCharacter,

        context
      };

    }


    if (
      game.dumCost >
      context.dum
    ) {

      return {
        ok: false,
        reason: "dum",

        dumCost:
          game.dumCost,

        context
      };

    }


    return {
      ok: true,
      context
    };

  }


  function open(id) {

    const key =
      clean(id)
        .toLowerCase();


    const game =
      games.get(
        key
      );


    const check =
      checkGame(
        game
      );


    if (!check.ok) {
      return check;
    }


    const detail = {

      game:
        publicGame(
          game
        ),

      context:
        check.context

    };


    document.dispatchEvent(
      new CustomEvent(
        "lago:mini-game-open",
        {
          detail
        }
      )
    );


    return {
      ok: true,
      ...detail
    };

  }


  function beginRun(id) {

    const key =
      clean(id)
        .toLowerCase();


    const game =
      games.get(
        key
      );


    if (activeRun) {

      return {
        ok: false,
        reason: "busy",

        activeRun:
          { ...activeRun }
      };

    }


    const check =
      checkGame(
        game
      );


    if (!check.ok) {
      return check;
    }


    const api =
      account();


    if (
      !api ||
      typeof api
        .spendGameplayResources !==
        "function"
    ) {

      return {
        ok: false,
        reason: "account"
      };

    }


    if (
      game.dumCost > 0
    ) {

      const paid =
        api.spendGameplayResources({

          dum:
            game.dumCost,

          gameId:
            game.id

        });


      if (
        paid?.ok !== true
      ) {

        return {
          ok: false,

          reason:
            paid?.reason ||
            "dum",

          payment:
            paid || null
        };

      }

    }


    const context =
      getContext();


    const sessionId = [

      game.id,

      Date.now(),

      ++runSequence

    ].join(":");


    activeRun =
      Object.freeze({

        sessionId,

        gameId:
          game.id,

        characterId:
          context.characterId,

        selectedSkin:
          context.selectedSkin,

        dumCost:
          game.dumCost,

        startedAt:
          new Date()
            .toISOString()

      });


    document.dispatchEvent(
      new CustomEvent(
        "lago:mini-game-run-start",
        {
          detail: {

            session:
              { ...activeRun },

            game:
              publicGame(
                game
              ),

            context

          }
        }
      )
    );


    return {
      ok: true,

      session:
        { ...activeRun },

      game:
        publicGame(
          game
        ),

      context
    };

  }


  function finishRun(
    {
      sessionId = "",
      score = 0,
      sp = 0
    } = {}
  ) {

    const token =
      clean(
        sessionId
      );


    if (
      !activeRun ||
      token !==
        activeRun.sessionId
    ) {

      return {
        ok: false,
        reason: "session"
      };

    }


    const game =
      games.get(
        activeRun.gameId
      );


    const api =
      account();


    if (
      !game ||
      !api ||
      typeof api
        .submitGameResult !==
        "function"
    ) {

      return {
        ok: false,
        reason: "account"
      };

    }


    const safeScore =
      Math.max(
        0,
        Number(
          score
        ) || 0
      );


    const requestedSP =
      Math.max(
        0,
        Math.floor(
          Number(
            sp
          ) || 0
        )
      );


    /*
     * Client-side safety cap.
     *
     * Later the backend becomes
     * authoritative for rewards.
     */
    const grantedSP =
      Math.min(
        requestedSP,
        game.maxRewardSP
      );


    const session =
      { ...activeRun };


    const accountState =
      api.submitGameResult({

        gameId:
          game.id,

        score:
          safeScore,

        sp:
          grantedSP

      });


    activeRun =
      null;


    const detail = {

      session,

      game:
        publicGame(
          game
        ),

      score:
        safeScore,

      requestedSP,

      grantedSP,

      accountState

    };


    document.dispatchEvent(
      new CustomEvent(
        "lago:mini-game-run-finish",
        {
          detail
        }
      )
    );


    return {
      ok: true,
      ...detail
    };

  }


  function abortRun(
    sessionId = ""
  ) {

    const token =
      clean(
        sessionId
      );


    if (
      !activeRun ||
      token !==
        activeRun.sessionId
    ) {

      return false;

    }


    const session =
      { ...activeRun };


    activeRun =
      null;


    /*
     * No DUM refund after a run
     * has actually started.
     */
    document.dispatchEvent(
      new CustomEvent(
        "lago:mini-game-run-abort",
        {
          detail: {
            session
          }
        }
      )
    );


    return true;

  }


  function getActiveRun() {

    return activeRun
      ? { ...activeRun }
      : null;

  }


  window.LAGO_MINIGAMES =
    Object.freeze({

      version:
        VERSION,

      register,

      get,

      list,

      getContext,

      open,

      beginRun,

      finishRun,

      abortRun,

      getActiveRun

    });


  document.dispatchEvent(
    new CustomEvent(
      "lago:mini-game-runtime-ready",
      {
        detail: {
          version:
            VERSION
        }
      }
    )
  );

})();

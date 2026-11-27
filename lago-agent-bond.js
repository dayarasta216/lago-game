
(() => {

  "use strict";

  /*
   * LAGO GAME
   * R2.5A — AGENT BOND ENGINE
   *
   * Individual gameplay relationship.
   *
   * No subscription rewards.
   * No inactivity penalties.
   * No financial rewards.
   * No account balance mutations.
   */

  const VERSION = 1;
  const SCHEMA_VERSION = 1;

  const MAX_POINTS = 1000;


  /*
   * BOND PROGRESSION LEVELS
   */

  const LEVELS = Object.freeze([

    Object.freeze({
      level: 1,
      id: "first_contact",
      title: "First Contact",
      threshold: 0
    }),

    Object.freeze({
      level: 2,
      id: "familiar",
      title: "Familiar",
      threshold: 200
    }),

    Object.freeze({
      level: 3,
      id: "companion",
      title: "Companion",
      threshold: 400
    }),

    Object.freeze({
      level: 4,
      id: "partner",
      title: "Partner",
      threshold: 600
    }),

    Object.freeze({
      level: 5,
      id: "synchronized",
      title: "Synchronized",
      threshold: 800
    })

  ]);


  /*
   * GAMEPLAY REWARDS
   */

  const REWARDS = Object.freeze({

    tap_accepted: 1,

    game_completed: 10,

    level_up: 5,

    achievement_unlocked: 15

  });


  const POLICY = Object.freeze({

    scope: "account_character",

    freeGameplayProgress: true,

    subscriptionRequired: false,

    paymentRewardsEnabled: false,

    tradingRewardsEnabled: false,

    inactivityDecay: false,

    characterSwitchResetsBond: false,

    financialRiskMultiplier: false,

    maxPoints: MAX_POINTS

  });


  /*
   * HELPERS
   */

  function clean(value) {

    return String(
      value ?? ""
    ).trim();

  }


  function characterExists(characterId) {

    return window.LAGO_AGENT_PERSONALITY
      ?.has?.(characterId) === true;

  }


  function validPoints(points) {

    return (

      Number.isInteger(points) &&

      points >= 0 &&

      points <= MAX_POINTS

    );

  }


  /*
   * CREATE IMMUTABLE STATE
   */

  function createState(characterId, points) {

    const id = clean(characterId);

    if (

      !characterExists(id) ||

      !validPoints(points)

    ) {

      return null;

    }


    return Object.freeze({

      schemaVersion: SCHEMA_VERSION,

      characterId: id,

      points

    });

  }


  function getInitial(characterId) {

    return createState(
      characterId,
      0
    );

  }


  function validateState(state) {

    return Boolean(

      state &&

      state.schemaVersion ===
        SCHEMA_VERSION &&

      characterExists(
        state.characterId
      ) &&

      validPoints(
        state.points
      )

    );

  }


  /*
   * DETERMINE CURRENT LEVEL
   */

  function getLevel(points) {

    if (!validPoints(points)) {

      return null;

    }


    for (
      let i = LEVELS.length - 1;
      i >= 0;
      i--
    ) {

      if (
        points >= LEVELS[i].threshold
      ) {

        return LEVELS[i];

      }

    }


    return LEVELS[0];

  }


  /*
   * CALCULATE BOND PROGRESSION
   */

  function describeState(state) {

    if (!validateState(state)) {

      return null;

    }


    const level =
      getLevel(state.points);

    const nextLevel =
      LEVELS[level.level] || null;

    const target =
      nextLevel?.threshold ??
      MAX_POINTS;

    const range =
      target - level.threshold;

    const current =
      state.points - level.threshold;

    const progress =
      range > 0

        ? Math.min(
            100,
            current / range * 100
          )

        : 100;


    return Object.freeze({

      characterId:
        state.characterId,

      points:
        state.points,

      maxPoints:
        MAX_POINTS,

      percent:
        Math.floor(
          state.points / MAX_POINTS * 100
        ),

      level:
        level.level,

      rank:
        level.id,

      title:
        level.title,

      currentLevelPoints:
        current,

      requiredLevelPoints:
        range,

      levelProgressPercent:
        Math.round(progress * 10) / 10,

      nextLevel:
        nextLevel?.level || null,

      nextLevelTitle:
        nextLevel?.title || null,

      pointsToNextLevel:
        nextLevel

          ? nextLevel.threshold -
            state.points

          : 0,

      completed:
        state.points >= MAX_POINTS

    });

  }


  /*
   * APPLY A GAMEPLAY EVENT
   *
   * Pure calculation only.
   * Event verification and deduplication
   * belong to the future runtime layer.
   */

  function applyEvent(state, eventType) {

    if (!validateState(state)) {

      return null;

    }


    if (

      typeof eventType !== "string" ||

      !Object.prototype.hasOwnProperty.call(

        REWARDS,
        eventType

      )

    ) {

      return null;

    }


    const reward =
      REWARDS[eventType];

    const points =
      Math.min(

        MAX_POINTS,

        state.points + reward

      );


    const nextState =
      createState(

        state.characterId,

        points

      );


    const previousLevel =
      getLevel(state.points);

    const nextLevel =
      getLevel(points);


    return Object.freeze({

      ok: true,

      eventType,

      characterId:
        state.characterId,

      gainedPoints:
        points - state.points,

      levelChanged:

        previousLevel.level !==
        nextLevel.level,

      state: nextState,

      progression:
        describeState(nextState)

    });

  }


  /*
   * CURRENT CHARACTER BASELINE
   */

  function getCurrent() {

    const personality =
      window.LAGO_AGENT_PERSONALITY
        ?.getCurrent?.();

    if (!personality) {

      return null;

    }

    return getInitial(
      personality.characterId
    );

  }


  /*
   * PUBLIC READ-ONLY API
   */

  window.LAGO_AGENT_BOND =
    Object.freeze({

      version: VERSION,

      schemaVersion:
        SCHEMA_VERSION,

      getInitial,

      getCurrent,

      validateState,

      describeState,

      getLevel,

      applyEvent,

      getLevels() {

        return LEVELS;

      },

      getRewards() {

        return REWARDS;

      },

      getPolicy() {

        return POLICY;

      }

    });


  document.dispatchEvent(

    new CustomEvent(

      "lago:agent-bond-ready",

      {

        detail: {

          version: VERSION,

          schemaVersion: SCHEMA_VERSION,

          maxPoints: MAX_POINTS

        }

      }

    )

  );

})();

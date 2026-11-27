
(() => {

  "use strict";

  /*
   * LAGO GAME
   * R2.2C — EMOTIONAL ENGINE
   *
   * Deterministic emotional simulation.
   * Individual character reactions.
   *
   * No AI execution.
   * No account mutations.
   * No financial decisions.
   */

  const VERSION = 1;

  const SCHEMA_VERSION = 1;


  const DIMENSIONS = Object.freeze([

    "mood",
    "trust",
    "motivation",
    "stress",
    "attachment",
    "excitement"

  ]);


  /*
   * SUPPORTED GAME EVENTS
   */

  const EVENTS = Object.freeze({

    game_completed: Object.freeze({

      mood: 5,
      motivation: 4,
      stress: -2,
      excitement: 4

    }),

    game_won: Object.freeze({

      mood: 9,
      motivation: 7,
      stress: -4,
      excitement: 10

    }),

    game_lost: Object.freeze({

      mood: -4,
      motivation: -2,
      stress: 4,
      excitement: 2

    }),

    level_up: Object.freeze({

      mood: 8,
      motivation: 8,
      stress: -3,
      excitement: 8

    }),

    achievement_unlocked: Object.freeze({

      mood: 6,
      motivation: 5,
      excitement: 6

    }),

    positive_interaction: Object.freeze({

      mood: 3,
      trust: 1,
      attachment: 1

    }),

    rest: Object.freeze({

      stress: -6,
      excitement: -4,
      motivation: 2

    })

  });


  /*
   * NUMERIC HELPERS
   */

  function clamp(value) {

    return Math.round(

      Math.max(
        0,
        Math.min(100, value)
      ) * 100

    ) / 100;

  }


  function getDNA(characterId) {

    return window.LAGO_AGENT_DNA
      ?.getById?.(characterId)
      ?.dimensions || null;

  }


  function createState(
    characterId,
    values
  ) {

    return Object.freeze({

      characterId,

      schemaVersion: SCHEMA_VERSION,

      values: Object.freeze({

        ...values

      })

    });

  }


  /*
   * INITIAL EMOTIONAL STATE
   */

  function getInitial(characterId) {

    const id = String(
      characterId ?? ""
    ).trim();

    const dna = getDNA(id);

    if (!dna) {

      return null;

    }

    return createState(id, {

      mood: clamp(

        50 +
        dna.emotionality * 0.12

      ),

      trust: 50,

      motivation: clamp(

        45 +
        dna.curiosity * 0.18 +
        dna.discipline * 0.12

      ),

      stress: clamp(

        10 +
        dna.impulsivity * 0.14 -
        dna.patience * 0.08

      ),

      attachment: 0,

      excitement: clamp(

        15 +
        dna.emotionality * 0.22 +
        dna.curiosity * 0.15

      )

    });

  }


  /*
   * STATE VALIDATION
   */

  function validateState(state) {

    if (

      !state ||

      state.schemaVersion !==
        SCHEMA_VERSION ||

      !getDNA(state.characterId) ||

      !state.values

    ) {

      return false;

    }

    return DIMENSIONS.every(key => {

      const value = state.values[key];

      return (

        typeof value === "number" &&

        Number.isFinite(value) &&

        value >= 0 &&

        value <= 100

      );

    });

  }


  /*
   * PERSONALIZED REACTION
   */

  function reactionMultiplier(
    dna,
    dimension
  ) {

    switch (dimension) {

      case "mood":

        return (
          0.6 +
          dna.emotionality / 100
        );

      case "stress":

        return (
          0.5 +
          dna.impulsivity / 100 -
          dna.patience / 300
        );

      case "excitement":

        return (
          0.5 +
          dna.emotionality / 100
        );

      case "motivation":

        return (
          0.7 +
          dna.discipline / 200 +
          dna.curiosity / 200
        );

      case "trust":

      case "attachment":

        return (
          0.8 +
          dna.sociability / 200
        );

      default:

        return 1;

    }

  }


  /*
   * APPLY GAME EVENT
   *
   * Returns a new state.
   * Never mutates the original state.
   */

  function applyEvent(state, eventType) {

    if (!validateState(state)) {

      return null;

    }

    if (

      typeof eventType !== "string" ||

      !Object.prototype.hasOwnProperty.call(

        EVENTS,
        eventType

      )

    ) {

      return null;

    }

    const dna =
      getDNA(state.characterId);

    const event =
      EVENTS[eventType];

    const next = {};


    for (const key of DIMENSIONS) {

      const delta =
        event[key] || 0;

      const multiplier =
        reactionMultiplier(
          dna,
          key
        );

      next[key] = clamp(

        state.values[key] +

        delta * multiplier

      );

    }


    return createState(

      state.characterId,

      next

    );

  }


  /*
   * NATURAL EMOTIONAL RECOVERY
   *
   * Temporary emotions gradually
   * return toward baseline.
   *
   * No punishment for inactivity.
   * Trust and attachment do not decay.
   */

  function recover(
    state,
    elapsedMinutes
  ) {

    if (

      !validateState(state) ||

      typeof elapsedMinutes !== "number" ||

      !Number.isFinite(elapsedMinutes) ||

      elapsedMinutes < 0

    ) {

      return null;

    }


    const initial =
      getInitial(state.characterId);

    const factor = Math.exp(

      -Math.min(
        elapsedMinutes,
        10080
      ) / 120

    );

    const next = {};


    for (const key of DIMENSIONS) {

      if (

        key === "trust" ||

        key === "attachment"

      ) {

        next[key] =
          state.values[key];

        continue;

      }


      next[key] = clamp(

        initial.values[key] +

        (

          state.values[key] -
          initial.values[key]

        ) * factor

      );

    }


    return createState(

      state.characterId,

      next

    );

  }


  /*
   * DOMINANT EMOTIONAL STATE
   */

  function describeState(state) {

    if (!validateState(state)) {

      return null;

    }

    const value =
      state.values;


    if (value.stress >= 75) {

      return "stressed";

    }


    if (value.mood <= 25) {

      return "disappointed";

    }


    if (

      value.excitement >= 75 &&

      value.mood >= 60

    ) {

      return "excited";

    }


    if (value.mood >= 75) {

      return "happy";

    }


    if (value.motivation >= 75) {

      return "motivated";

    }


    if (value.motivation <= 25) {

      return "low_motivation";

    }


    if (

      value.stress <= 20 &&

      value.excitement <= 35

    ) {

      return "relaxed";

    }


    return "neutral";

  }


  /*
   * CURRENT CHARACTER BASELINE
   */

  function getCurrent() {

    const dna =
      window.LAGO_AGENT_DNA
        ?.getCurrent?.();

    if (!dna) {

      return null;

    }

    return getInitial(
      dna.characterId
    );

  }


  /*
   * PUBLIC READ-ONLY API
   */

  window.LAGO_AGENT_EMOTIONS =
    Object.freeze({

      version: VERSION,

      schemaVersion: SCHEMA_VERSION,

      getDimensions() {

        return DIMENSIONS;

      },

      getSupportedEvents() {

        return Object.freeze(
          Object.keys(EVENTS)
        );

      },

      getInitial,

      getCurrent,

      validateState,

      applyEvent,

      recover,

      describeState

    });


  document.dispatchEvent(

    new CustomEvent(

      "lago:agent-emotions-ready",

      {

        detail: {

          version: VERSION,

          schemaVersion: SCHEMA_VERSION

        }

      }

    )

  );

})();

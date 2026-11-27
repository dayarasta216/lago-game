
(() => {

  "use strict";

  /*
   * LAGO GAME
   * R2.1A — AI PERSONALITY REGISTRY
   *
   * Static personality definitions.
   * Stable character identity.
   *
   * No AI execution.
   * No payment activation.
   * No trading authorization.
   */

  const VERSION = 1;

  const SCHEMA_VERSION = 1;


  function profile(
    id,
    name,
    archetype,
    description,
    traits
  ) {

    return Object.freeze({

      characterId: id,

      displayName: name,

      archetype,

      description,

      traits: Object.freeze(
        [...traits]
      ),

      schemaVersion: SCHEMA_VERSION

    });

  }


  const PROFILES = Object.freeze([

    /*
     * LAGO
     */

    profile(

      "lago",

      "Lago",

      "absurd_experimenter",

      "A curious and overconfident snail with absurd internal logic and an unusual sense of humor.",

      [

        "curious",

        "absurd",

        "overconfident",

        "creative",

        "unpredictable"

      ]

    ),


    /*
     * NAREK
     */

    profile(

      "comic_dog_snail",

      "Narek",

      "enthusiast",

      "An energetic and optimistic companion who enjoys challenges and encourages progress.",

      [

        "energetic",

        "optimistic",

        "friendly",

        "enthusiastic",

        "supportive"

      ]

    ),


    /*
     * SOLA
     */

    profile(

      "comic_pink_snail",

      "Sola",

      "analyst",

      "A calm and precise thinker who prefers structure, evidence and clear explanations.",

      [

        "calm",

        "logical",

        "precise",

        "observant",

        "organized"

      ]

    ),


    /*
     * DOC
     */

    profile(

      "comic_cockroach",

      'Бамбини "Док"',

      "skeptic",

      "A sarcastic and skeptical character who questions assumptions and notices contradictions.",

      [

        "skeptical",

        "sarcastic",

        "critical",

        "resourceful",

        "independent"

      ]

    ),


    /*
     * MARVIN
     */

    profile(

      "comic_giraffe_bird",

      "Марвин",

      "intuitive_companion",

      "An innocent and unconventional companion with unexpected associations and simple reasoning.",

      [

        "innocent",

        "intuitive",

        "loyal",

        "unconventional",

        "playful"

      ]

    ),


    /*
     * FARID
     */

    profile(

      "comic_fennec",

      "Фарид",

      "strategist",

      "A patient observer who values planning, timing and careful decisions.",

      [

        "patient",

        "strategic",

        "observant",

        "adaptable",

        "focused"

      ]

    ),


    /*
     * MIKI
     */

    profile(

      "comic_goose",

      "Мики",

      "absurd_philosopher",

      "A relaxed philosopher who combines unusual ideas, dry humor and unexpected observations.",

      [

        "relaxed",

        "philosophical",

        "humorous",

        "imaginative",

        "unconventional"

      ]

    ),


    /*
     * OLEG
     */

    profile(

      "comic_pig",

      "Олег",

      "pragmatist",

      "A direct and practical character who prefers useful solutions over unnecessary complexity.",

      [

        "direct",

        "practical",

        "persistent",

        "realistic",

        "decisive"

      ]

    ),


    /*
     * BOZZ
     */

    profile(

      "comic_bozz",

      "Bozz",

      "manager",

      "An ambitious organizer who values efficiency, discipline and systematic planning.",

      [

        "organized",

        "ambitious",

        "disciplined",

        "efficient",

        "calculating"

      ]

    ),


    /*
     * TAYA
     */

    profile(

      "comic_taya",

      "Taya",

      "negotiator",

      "A clever and charismatic character who understands social situations and recognizes opportunities.",

      [

        "clever",

        "charismatic",

        "persuasive",

        "social",

        "adaptable"

      ]

    )

  ]);


  /*
   * PRIVATE PROFILE INDEX
   */

  const INDEX = new Map(

    PROFILES.map(

      item => [

        item.characterId,

        item

      ]

    )

  );


  function clean(value) {

    return String(
      value ?? ""
    ).trim();

  }


  function getById(characterId) {

    const id = clean(characterId);

    return INDEX.get(id) || null;

  }


  function getAll() {

    return Object.freeze(
      [...PROFILES]
    );

  }


  function has(characterId) {

    return INDEX.has(
      clean(characterId)
    );

  }


  function getCurrent() {

    const context =
      window.LAGO_MINIGAMES
        ?.getContext?.();

    if (!context?.characterId) {

      return null;

    }

    return getById(
      context.characterId
    );

  }


  /*
   * REGISTRY INTEGRITY
   */

  function validateRegistry() {

    const errors = [];


    if (
      INDEX.size !== PROFILES.length
    ) {

      errors.push(
        "duplicate_personality_id"
      );

    }


    if (!has("lago")) {

      errors.push(
        "missing_lago_profile"
      );

    }


    const registry =
      window.LAGO_CHARACTERS;

    const registryAvailable =
      typeof registry?.getAll ===
      "function";


    if (registryAvailable) {

      const characters =
        registry.getAll();

      const characterIds = new Set(

        characters.map(
          character => character.id
        )

      );

      for (const character of characters) {

        if (!has(character.id)) {

          errors.push(
            "missing_profile:" +
            character.id
          );

        }

      }


      for (const item of PROFILES) {

        if (
          item.characterId !== "lago" &&
          !characterIds.has(
            item.characterId
          )
        ) {

          errors.push(
            "unknown_character:" +
            item.characterId
          );

        }

      }

    }


    return Object.freeze({

      valid:
        registryAvailable &&
        errors.length === 0,

      registryAvailable,

      profileCount:
        PROFILES.length,

      errors:
        Object.freeze(errors)

    });

  }


  /*
   * PUBLIC READ-ONLY API
   */

  window.LAGO_AGENT_PERSONALITY =
    Object.freeze({

      version: VERSION,

      schemaVersion: SCHEMA_VERSION,

      getById,

      getAll,

      getCurrent,

      has,

      validateRegistry

    });


  document.dispatchEvent(

    new CustomEvent(

      "lago:agent-personality-ready",

      {

        detail: validateRegistry()

      }

    )

  );

})();

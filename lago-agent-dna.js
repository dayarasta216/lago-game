
(() => {

  "use strict";

  /*
   * LAGO GAME
   * R2.2A — PERSONALITY DNA
   *
   * Immutable baseline personality.
   * All dimensions use a 0-100 scale.
   *
   * Personality is not intelligence.
   * Personality is not trading permission.
   */


  const VERSION = 1;

  const SCHEMA_VERSION = 1;


  const DIMENSIONS = Object.freeze([

    "curiosity",

    "absurdity",

    "confidence",

    "creativity",

    "discipline",

    "patience",

    "emotionality",

    "impulsivity",

    "analyticalThinking",

    "sociability"

  ]);


  /*
   * CANONICAL PERSONALITY MATRIX
   */

  const MATRIX = Object.freeze({

    lago: Object.freeze([

      95, 100, 92, 88, 15,
      24, 85, 90, 30, 75

    ]),


    comic_dog_snail: Object.freeze([

      85, 45, 72, 70, 65,
      55, 90, 65, 55, 95

    ]),


    comic_pink_snail: Object.freeze([

      80, 12, 65, 72, 95,
      90, 35, 10, 98, 50

    ]),


    comic_cockroach: Object.freeze([

      88, 65, 85, 90, 42,
      65, 45, 55, 92, 45

    ]),


    comic_giraffe_bird: Object.freeze([

      80, 95, 55, 78, 10,
      70, 95, 75, 15, 85

    ]),


    comic_fennec: Object.freeze([

      82, 25, 75, 85, 90,
      98, 40, 15, 95, 65

    ]),


    comic_goose: Object.freeze([

      92, 95, 68, 98, 18,
      88, 62, 40, 65, 80

    ]),


    comic_pig: Object.freeze([

      45, 35, 90, 48, 85,
      55, 50, 50, 80, 60

    ]),


    comic_bozz: Object.freeze([

      70, 15, 95, 75, 98,
      80, 35, 25, 90, 82

    ]),


    comic_taya: Object.freeze([

      88, 45, 93, 95, 70,
      85, 65, 45, 90, 98

    ])

  });


  /*
   * BUILD IMMUTABLE DNA PROFILES
   */

  const INDEX = new Map();


  for (
    const [id, values]
    of Object.entries(MATRIX)
  ) {

    const dimensions = {};

    DIMENSIONS.forEach(

      (key, index) => {

        dimensions[key] =
          values[index];

      }

    );


    INDEX.set(

      id,

      Object.freeze({

        characterId: id,

        schemaVersion: SCHEMA_VERSION,

        dimensions:
          Object.freeze(dimensions),

        mutable: false

      })

    );

  }


  /*
   * PUBLIC READ-ONLY HELPERS
   */

  function getById(characterId) {

    return INDEX.get(

      String(
        characterId ?? ""
      ).trim()

    ) || null;

  }


  function getAll() {

    return Object.freeze(

      [...INDEX.values()]

    );

  }


  function getDimensions() {

    return DIMENSIONS;

  }


  function getCurrent() {

    const personality =
      window.LAGO_AGENT_PERSONALITY
        ?.getCurrent?.();

    if (!personality) {
      return null;
    }

    return getById(
      personality.characterId
    );

  }


  function getTrait(
    characterId,
    dimension
  ) {

    const dna =
      getById(characterId);

    if (
      !dna ||
      !DIMENSIONS.includes(dimension)
    ) {

      return null;

    }

    return dna.dimensions[dimension];

  }


  /*
   * PERSONALITY LABELS
   */

  function describeValue(value) {

    if (

      typeof value !== "number" ||

      !Number.isFinite(value) ||

      value < 0 ||

      value > 100

    ) {

      return null;

    }

    if (value < 20) {
      return "very_low";
    }

    if (value < 40) {
      return "low";
    }

    if (value < 60) {
      return "moderate";
    }

    if (value < 80) {
      return "high";
    }

    return "very_high";

  }


  /*
   * COMBINED PERSONALITY PROFILE
   */

  function getProfile(characterId) {

    const dna =
      getById(characterId);

    const personality =
      window.LAGO_AGENT_PERSONALITY
        ?.getById?.(characterId);

    if (!dna || !personality) {

      return null;

    }

    const intensity = {};


    for (const key of DIMENSIONS) {

      intensity[key] =
        describeValue(
          dna.dimensions[key]
        );

    }


    return Object.freeze({

      characterId:
        personality.characterId,

      displayName:
        personality.displayName,

      archetype:
        personality.archetype,

      description:
        personality.description,

      traits:
        personality.traits,

      dna:
        dna.dimensions,

      intensity:
        Object.freeze(intensity),

      schemaVersion:
        SCHEMA_VERSION

    });

  }


  /*
   * INTEGRITY VALIDATION
   */

  function validateRegistry() {

    const errors = [];

    const personality =
      window.LAGO_AGENT_PERSONALITY;

    const registryAvailable =
      typeof personality?.getAll ===
      "function";


    if (
      new Set(DIMENSIONS).size !==
      DIMENSIONS.length
    ) {

      errors.push(
        "duplicate_dimension"
      );

    }


    for (
      const [id, values]
      of Object.entries(MATRIX)
    ) {

      if (
        values.length !==
        DIMENSIONS.length
      ) {

        errors.push(
          "invalid_dimension_count:" +
          id
        );

      }


      if (

        values.some(

          value =>

            !Number.isInteger(value) ||

            value < 0 ||

            value > 100

        )

      ) {

        errors.push(
          "invalid_dna_value:" + id
        );

      }

    }


    if (registryAvailable) {

      const expected = new Set(

        personality.getAll().map(

          item => item.characterId

        )

      );


      for (const id of expected) {

        if (!INDEX.has(id)) {

          errors.push(
            "missing_dna:" + id
          );

        }

      }


      for (const id of INDEX.keys()) {

        if (!expected.has(id)) {

          errors.push(
            "unknown_character:" + id
          );

        }

      }

    }


    return Object.freeze({

      valid:

        registryAvailable &&

        personality
          .validateRegistry()
          .valid === true &&

        errors.length === 0,

      registryAvailable,

      profileCount:
        INDEX.size,

      dimensionCount:
        DIMENSIONS.length,

      errors:
        Object.freeze(errors)

    });

  }


  /*
   * PUBLIC API
   */

  window.LAGO_AGENT_DNA =
    Object.freeze({

      version: VERSION,

      schemaVersion:
        SCHEMA_VERSION,

      getById,

      getAll,

      getCurrent,

      getDimensions,

      getTrait,

      describeValue,

      getProfile,

      validateRegistry

    });


  document.dispatchEvent(

    new CustomEvent(

      "lago:agent-dna-ready",

      {

        detail:
          validateRegistry()

      }

    )

  );

})();

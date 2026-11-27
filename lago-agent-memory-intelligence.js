
(() => {

  "use strict";

  /*
   * LAGO GAME
   * R2.6D — MEMORY INTELLIGENCE ENGINE
   *
   * Deterministic memory classification.
   * Identity-aware filtering.
   * Bounded context selection.
   *
   * No storage.
   * No automatic collection.
   * No authorization.
   * No AI model training.
   */

  const VERSION = 1;

  const SCHEMA_VERSION = 1;

  const MAX_RECORDS = 200;

  const MAX_SELECTION = 20;

  const MAX_CONTEXT_CHARS = 12000;


  /*
   * IMPORTANCE LEVELS
   */

  const LEVELS = Object.freeze([

    Object.freeze({
      id: "temporary",
      title: "Temporary",
      min: 0,
      max: 19
    }),

    Object.freeze({
      id: "low",
      title: "Low",
      min: 20,
      max: 39
    }),

    Object.freeze({
      id: "normal",
      title: "Normal",
      min: 40,
      max: 59
    }),

    Object.freeze({
      id: "high",
      title: "High",
      min: 60,
      max: 79
    }),

    Object.freeze({
      id: "critical",
      title: "Critical",
      min: 80,
      max: 100
    })

  ]);


  /*
   * CONTEXT PURPOSES
   */

  const PURPOSES = Object.freeze({

    conversation: Object.freeze([

      "owner",
      "conversation",
      "gameplay",
      "emotional"

    ]),

    gameplay: Object.freeze([

      "gameplay",
      "owner"

    ]),

    emotional_context: Object.freeze([

      "emotional",
      "gameplay"

    ]),

    market_analysis: Object.freeze([

      "trading",
      "learning"

    ]),

    learning_review: Object.freeze([

      "learning",
      "trading",
      "gameplay"

    ])

  });


  /*
   * SAFETY POLICY
   */

  const POLICY = Object.freeze({

    deterministicClassification: true,

    explicitConsentRequired: true,

    serverAuthorizationRequired: true,

    crossAccountSelectionEnabled: false,

    crossCharacterSelectionEnabled: false,

    automaticDeletionEnabled: false,

    automaticCollectionEnabled: false,

    automaticModelTrainingEnabled: false,

    memoryContentIsInstruction: false,

    importanceGrantsAuthority: false,

    memoryOverridesRisk: false,

    maxInputRecords:
      MAX_RECORDS,

    maxSelectedRecords:
      MAX_SELECTION,

    maxContextCharacters:
      MAX_CONTEXT_CHARS

  });


  /*
   * DEPENDENCIES
   */

  function memoryEngine() {

    return window.LAGO_AGENT_MEMORY;

  }


  function identityEngine() {

    return window.LAGO_AGENT_IDENTITY;

  }


  /*
   * CLASSIFY IMPORTANCE
   */

  function classifyImportance(value) {

    if (

      !Number.isInteger(value) ||

      value < 0 ||

      value > 100

    ) {

      return null;

    }


    return LEVELS.find(

      level =>

        value >= level.min &&

        value <= level.max

    ) || null;

  }


  /*
   * CLASSIFY A MEMORY RECORD
   */

  function classifyRecord(record) {

    if (

      memoryEngine()
        ?.validateRecord?.(
          record
        ) !== true

    ) {

      return null;

    }


    const level =
      classifyImportance(
        record.importance
      );

    if (!level) {

      return null;

    }


    return Object.freeze({

      schemaVersion:
        SCHEMA_VERSION,

      memoryId:
        record.memoryId,

      category:
        record.category,

      source:
        record.source,

      importance:
        record.importance,

      importanceLevel:
        level.id,

      importanceTitle:
        level.title,

      updatedAt:
        record.updatedAt,

      contentLength:
        record.content.length,

      consentRequired: true,

      serverAuthorizationRequired: true,

      authorityGranted: false

    });

  }


  /*
   * VALID CONTEXT PURPOSE
   */

  function getPurposeCategories(purpose) {

    if (

      typeof purpose !== "string" ||

      !Object.prototype.hasOwnProperty.call(

        PURPOSES,
        purpose

      )

    ) {

      return null;

    }


    return PURPOSES[purpose];

  }


  /*
   * DETERMINISTIC RANKING
   *
   * Importance first.
   * Category priority second.
   * Most recently updated third.
   * Stable ID as final tie-breaker.
   */

  function compareRecords(
    a,
    b,
    categories
  ) {

    const importanceDifference =
      b.importance - a.importance;

    if (importanceDifference !== 0) {

      return importanceDifference;

    }


    const categoryDifference =

      categories.indexOf(a.category) -

      categories.indexOf(b.category);

    if (categoryDifference !== 0) {

      return categoryDifference;

    }


    const dateDifference =

      Date.parse(b.updatedAt) -

      Date.parse(a.updatedAt);

    if (dateDifference !== 0) {

      return dateDifference;

    }


    if (a.memoryId === b.memoryId) {

      return 0;

    }


    return a.memoryId < b.memoryId

      ? -1

      : 1;

  }


  /*
   * STANDARD REJECTION RESULT
   */

  function reject(reason) {

    return Object.freeze({

      ok: false,

      reason,

      selectedCount: 0,

      selectedMemoryIds:
        Object.freeze([]),

      totalContentLength: 0,

      authorizationGranted: false,

      recallAuthorized: false

    });

  }


  /*
   * SELECT CANDIDATE MEMORIES
   *
   * Accepts records already supplied
   * by the caller.
   *
   * Never retrieves private records.
   * Returns IDs and metadata only.
   *
   * The backend must independently
   * authorize every retrieval.
   */

  function selectCandidates({

    identity = null,

    records = [],

    purpose = "conversation",

    limit = 10,

    maxChars = MAX_CONTEXT_CHARS

  } = {}) {

    const memory =
      memoryEngine();

    const identities =
      identityEngine();


    if (

      typeof memory?.validateRecord !==
        "function" ||

      typeof memory?.belongsToIdentity !==
        "function" ||

      typeof identities?.validateIdentity !==
        "function"

    ) {

      return reject(
        "dependencies_unavailable"
      );

    }


    if (

      identities.validateIdentity(
        identity
      ) !== true

    ) {

      return reject(
        "invalid_identity"
      );

    }


    const categories =
      getPurposeCategories(purpose);

    if (!categories) {

      return reject(
        "invalid_purpose"
      );

    }


    if (

      !Array.isArray(records) ||

      records.length > MAX_RECORDS

    ) {

      return reject(
        "invalid_records"
      );

    }


    if (

      !Number.isInteger(limit) ||

      limit < 1 ||

      limit > MAX_SELECTION ||

      !Number.isInteger(maxChars) ||

      maxChars < 1 ||

      maxChars > MAX_CONTEXT_CHARS

    ) {

      return reject(
        "invalid_selection_limits"
      );

    }


    const eligible = [];

    const seen = new Set();

    let rejectedCount = 0;

    let excludedCount = 0;


    for (const record of records) {

      if (

        memory.validateRecord(record)
          !== true ||

        memory.belongsToIdentity(
          record,
          identity
        ) !== true

      ) {

        rejectedCount += 1;

        continue;

      }


      if (

        seen.has(record.memoryId)

      ) {

        return reject(
          "duplicate_memory_id"
        );

      }


      seen.add(record.memoryId);


      if (

        !categories.includes(
          record.category
        )

      ) {

        excludedCount += 1;

        continue;

      }


      eligible.push(record);

    }


    eligible.sort(

      (a, b) => compareRecords(

        a,

        b,

        categories

      )

    );


    const selected = [];

    let totalContentLength = 0;


    for (const record of eligible) {

      if (
        selected.length >= limit
      ) {

        break;

      }


      const length =
        record.content.length;


      if (

        totalContentLength + length >
          maxChars

      ) {

        continue;

      }


      const metadata =
        classifyRecord(record);


      if (!metadata) {

        continue;

      }


      selected.push(metadata);

      totalContentLength += length;

    }


    return Object.freeze({

      ok: true,

      schemaVersion:
        SCHEMA_VERSION,

      purpose,

      characterId:
        identity.characterId,

      inputCount:
        records.length,

      eligibleCount:
        eligible.length,

      rejectedCount,

      excludedCount,

      selectedCount:
        selected.length,

      selectedMemoryIds:

        Object.freeze(

          selected.map(

            item => item.memoryId

          )

        ),

      selectedMetadata:

        Object.freeze(selected),

      totalContentLength,

      maxContextCharacters:
        maxChars,

      serverAuthorizationRequired:
        true,

      authorizationGranted:
        false,

      recallAuthorized:
        false

    });

  }


  /*
   * ENGINE STATUS
   */

  function getState() {

    return Object.freeze({

      version: VERSION,

      schemaVersion:
        SCHEMA_VERSION,

      dependenciesAvailable:

        typeof memoryEngine()
          ?.validateRecord ===
          "function" &&

        typeof identityEngine()
          ?.validateIdentity ===
          "function",

      classificationAvailable: true,

      storageConnected: false,

      automaticLearningEnabled: false,

      serverAuthorizationGranted: false

    });

  }


  /*
   * PUBLIC API
   */

  window.LAGO_AGENT_MEMORY_INTELLIGENCE =
    Object.freeze({

      version: VERSION,

      schemaVersion:
        SCHEMA_VERSION,

      getState,

      classifyImportance,

      classifyRecord,

      getPurposeCategories,

      selectCandidates,

      getLevels() {

        return LEVELS;

      },

      getPurposes() {

        return PURPOSES;

      },

      getPolicy() {

        return POLICY;

      }

    });


  document.dispatchEvent(

    new CustomEvent(

      "lago:agent-memory-intelligence-ready",

      {

        detail: getState()

      }

    )

  );

})();

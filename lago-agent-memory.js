
(() => {

  "use strict";

  /*
   * LAGO GAME
   * R2.6C — PERSONAL AGENT MEMORY CORE
   *
   * Memory schema and validation.
   *
   * No private browser storage.
   * No automatic memory collection.
   * No model training.
   * No server authorization bypass.
   */

  const VERSION = 1;

  const SCHEMA_VERSION = 1;

  const MAX_CONTENT_LENGTH = 4000;


  /*
   * MEMORY CATEGORIES
   */

  const CATEGORIES = Object.freeze({

    owner: Object.freeze({

      title: "Owner Memory",

      description:
        "Explicitly approved player preferences.",

      consentRequired: true

    }),

    conversation: Object.freeze({

      title: "Conversation Memory",

      description:
        "Approved conversation context.",

      consentRequired: true

    }),

    gameplay: Object.freeze({

      title: "Gameplay Memory",

      description:
        "Verified gameplay events and achievements.",

      consentRequired: true

    }),

    emotional: Object.freeze({

      title: "Emotional Memory",

      description:
        "Simulated agent emotional states.",

      consentRequired: true

    }),

    trading: Object.freeze({

      title: "Trading Memory",

      description:
        "Verified analytical and trading research results.",

      consentRequired: true

    }),

    learning: Object.freeze({

      title: "Learning Memory",

      description:
        "Reviewed conclusions derived from experience.",

      consentRequired: true

    })

  });


  /*
   * MEMORY ORIGIN
   */

  const SOURCES = Object.freeze([

    "owner_explicit",

    "conversation",

    "gameplay_event",

    "emotion_simulation",

    "market_research",

    "learning_review"

  ]);


  const CATEGORY_SOURCES = Object.freeze({

    owner: "owner_explicit",

    conversation: "conversation",

    gameplay: "gameplay_event",

    emotional: "emotion_simulation",

    trading: "market_research",

    learning: "learning_review"

  });


  /*
   * PRIVACY POLICY
   */

  const POLICY = Object.freeze({

    scope: "account_character",

    explicitConsentRequired: true,

    serverAuthorizationRequired: true,

    subscriptionRequiredForAIRecall: true,

    preserveMemoryOnSubscriptionExpiry: true,

    ownerCanReviewMemory: true,

    ownerCanDeleteMemory: true,

    ownerCanExportMemory: true,

    privateLocalStorageEnabled: false,

    crossAccountSharingEnabled: false,

    crossCharacterSharingEnabled: false,

    automaticCollectionEnabled: false,

    externalModelTrainingEnabled: false,

    financialCredentialsAllowed: false,

    authenticationSecretsAllowed: false,

    memoryContentIsInstruction: false,

    memoryOverridesRisk: false,

    maxContentLength:
      MAX_CONTENT_LENGTH

  });


  /*
   * HELPERS
   */

  function identityEngine() {

    return window.LAGO_AGENT_IDENTITY;

  }


  function validCategory(value) {

    return (

      typeof value === "string" &&

      Object.prototype.hasOwnProperty.call(

        CATEGORIES,
        value

      )

    );

  }


  function validSource(value) {

    return SOURCES.includes(value);

  }


  function validMemoryId(value) {

    return (

      typeof value === "string" &&

      value.length >= 1 &&

      value.length <= 128 &&

      /^[a-zA-Z0-9_-]+$/.test(value)

    );

  }


  function validImportance(value) {

    return (

      Number.isInteger(value) &&

      value >= 0 &&

      value <= 100

    );

  }


  function validDate(value) {

    if (

      typeof value !== "string" ||

      !Number.isFinite(Date.parse(value))

    ) {

      return false;

    }

    return new Date(value)
      .toISOString() === value;

  }


  function validContent(value) {

    return (

      typeof value === "string" &&

      value.trim().length > 0 &&

      value.length <=
        MAX_CONTENT_LENGTH

    );

  }


  /*
   * MEMORY RECORD VALIDATION
   *
   * Structural validation only.
   * Does not prove consent,
   * provenance or ownership.
   */

  function validateRecord(record) {

    if (

      !record ||

      typeof record !== "object" ||

      Array.isArray(record) ||

      record.schemaVersion !==
        SCHEMA_VERSION

    ) {

      return false;

    }


    if (

      identityEngine()
        ?.validateIdentity?.(
          record.identity
        ) !== true ||

      !validMemoryId(
        record.memoryId
      ) ||

      !validCategory(
        record.category
      ) ||

      !validSource(
        record.source
      ) ||

      !validContent(
        record.content
      ) ||

      !validImportance(
        record.importance
      ) ||

      !validDate(
        record.createdAt
      ) ||

      !validDate(
        record.updatedAt
      )

    ) {

      return false;

    }


    if (

      CATEGORY_SOURCES[
        record.category
      ] !== record.source ||

      Date.parse(record.updatedAt) <
        Date.parse(record.createdAt) ||

      record.consentRequired !== true ||

      record.serverAuthorizationRequired !==
        true

    ) {

      return false;

    }


    return true;

  }


  /*
   * CHECK MEMORY CONTEXT
   *
   * Client-side comparison only.
   * The backend must enforce ownership.
   */

  function belongsToIdentity(
    record,
    identity
  ) {

    if (

      !validateRecord(record) ||

      identityEngine()
        ?.validateIdentity?.(
          identity
        ) !== true

    ) {

      return false;

    }


    return (

      record.identity.accountId ===
        identity.accountId &&

      record.identity.characterId ===
        identity.characterId &&

      record.identity.agentId ===
        identity.agentId

    );

  }


  /*
   * CURRENT MEMORY STATUS
   */

  function getState() {

    const identity =
      identityEngine()?.getCurrent?.()
      || null;


    return Object.freeze({

      version: VERSION,

      schemaVersion:
        SCHEMA_VERSION,

      identityAvailable:
        identity !== null,

      characterId:

        identityEngine()
          ?.getCharacterId?.() || null,

      storageConnected: false,

      serverAuthorized: false,

      consentVerified: false,

      subscriptionVerified: false,

      memoryAvailable: false,

      recallEnabled: false,

      collectionEnabled: false,

      learningEnabled: false,

      reason:

        !identity

          ? "authentication_required"

          : "memory_service_unavailable"

    });

  }


  /*
   * PUBLIC API
   */

  window.LAGO_AGENT_MEMORY =
    Object.freeze({

      version: VERSION,

      schemaVersion:
        SCHEMA_VERSION,

      getState,

      validateRecord,

      belongsToIdentity,

      getCategories() {

        return CATEGORIES;

      },

      getSources() {

        return SOURCES;

      },

      getPolicy() {

        return POLICY;

      },

      canRecall() {

        return false;

      },

      canStore() {

        return false;

      },

      canLearn() {

        return false;

      }

    });


  document.dispatchEvent(

    new CustomEvent(

      "lago:agent-memory-ready",

      {

        detail: getState()

      }

    )

  );

})();

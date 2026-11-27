
(() => {

  "use strict";

  /*
   * LAGO GAME
   * R2.6F — PERSONAL AGENT CONTEXT ENGINE
   *
   * Unified character preview context.
   *
   * No AI execution.
   * No private memory retrieval.
   * No payment bypass.
   * No trading authorization.
   */

  const VERSION = 1;

  const SCHEMA_VERSION = 1;


  /*
   * CONTEXT POLICY
   */

  const POLICY = Object.freeze({

    oneActiveCharacter: true,

    individualPersonality: true,

    individualDNA: true,

    simulatedEmotions: true,

    individualBond: true,

    individualStrategy: true,

    privateMemoryServerOnly: true,

    serverAuthorizationRequired: true,

    subscriptionRequiredForAI: true,

    clientContextTrusted: false,

    localBondGrantsAIAccess: false,

    personalityOverridesRisk: false,

    emotionsOverrideRisk: false,

    memoryOverridesRisk: false,

    tradingAuthorizationGranted: false

  });


  /*
   * DEPENDENCIES
   */

  function getDependencies() {

    return {

      identity:
        window.LAGO_AGENT_IDENTITY,

      personality:
        window.LAGO_AGENT_PERSONALITY,

      dna:
        window.LAGO_AGENT_DNA,

      emotions:
        window.LAGO_AGENT_EMOTIONS,

      communication:
        window.LAGO_AGENT_COMMUNICATION,

      strategy:
        window.LAGO_AGENT_STRATEGY,

      bond:
        window.LAGO_AGENT_BOND_RUNTIME,

      memory:
        window.LAGO_AGENT_MEMORY,

      memoryIntelligence:
        window.LAGO_AGENT_MEMORY_INTELLIGENCE,

      access:
        window.LAGO_AGENT_ACCESS

    };

  }


  /*
   * DEPENDENCY VALIDATION
   */

  function validateDependencies() {

    const dependencies =
      getDependencies();

    const missing = [];

    for (const [name, api] of
      Object.entries(dependencies)
    ) {

      if (!api) {

        missing.push(name);

      }

    }


    return Object.freeze({

      ready:
        missing.length === 0,

      missing:
        Object.freeze(missing),

      total:
        Object.keys(dependencies).length

    });

  }


  /*
   * STANDARD REJECTION
   */

  function unavailable(reason) {

    return Object.freeze({

      version: VERSION,

      schemaVersion:
        SCHEMA_VERSION,

      ready: false,

      reason,

      context: null,

      aiExecutionAuthorized: false,

      memoryRecallAuthorized: false,

      tradingAuthorized: false

    });

  }


  /*
   * CURRENT CHARACTER CONTEXT
   *
   * Client-side descriptive context.
   * Never use as a server authorization.
   */

  function getCurrent() {

    const dependencies =
      validateDependencies();

    if (!dependencies.ready) {

      return unavailable(
        "dependencies_unavailable"
      );

    }


    try {

      const api =
        getDependencies();


      const characterId =
        api.identity.getCharacterId();


      if (

        !characterId ||

        api.personality.has(
          characterId
        ) !== true

      ) {

        return unavailable(
          "character_unavailable"
        );

      }


      /*
       * PERSONALITY AND DNA
       */

      const personality =
        api.personality.getById(
          characterId
        );

      const dna =
        api.dna.getById(
          characterId
        );


      /*
       * SIMULATED BASELINE EMOTIONS
       */

      const emotion =
        api.emotions.getInitial(
          characterId
        );


      if (

        !personality ||

        !dna ||

        !emotion ||

        emotion.characterId !==
          characterId ||

        api.emotions.validateState(
          emotion
        ) !== true

      ) {

        return unavailable(
          "invalid_character_profile"
        );

      }


      /*
       * COMMUNICATION CONTEXT
       */

      const communication =
        api.communication.buildContext(

          characterId,

          emotion

        );


      /*
       * TRADING RESEARCH STRATEGY
       */

      const strategy =
        api.strategy.buildContext(
          characterId
        );


      if (

        !communication ||

        !strategy ||

        communication.characterId !==
          characterId ||

        strategy.characterId !==
          characterId

      ) {

        return unavailable(
          "invalid_agent_context"
        );

      }


      /*
       * LOCAL GAMEPLAY BOND
       *
       * Preview only.
       * Not authoritative server data.
       */

      let bond = null;

      const bondContext =
        api.bond.getContext();

      const bondState =
        api.bond.getState(
          characterId
        );


      if (

        bondContext?.characterId ===
          characterId &&

        bondState?.ready === true &&

        bondState.characterId ===
          characterId &&

        bondState.progression?.characterId ===
          characterId

      ) {

        bond = Object.freeze({

          ...bondState.progression,

          persistence: "local",

          serverVerified: false,

          previewOnly: true

        });

      }


      /*
       * ACCOUNT IDENTITY STATUS
       */

      const identity =
        api.identity.getCurrent();

      const identityAvailable =
        Boolean(

          identity &&

          identity.characterId ===
            characterId &&

          api.identity.isCurrent(
            identity
          )

        );


      /*
       * MEMORY STATUS
       *
       * Never retrieve private content
       * from the browser.
       */

      const memoryState =
        api.memory.getState();

      const intelligenceState =
        api.memoryIntelligence.getState();


      const memory =
        Object.freeze({

          schemaAvailable: true,

          classificationAvailable:

            intelligenceState
              ?.classificationAvailable ===
                true &&

            intelligenceState
              ?.dependenciesAvailable ===
                true,

          storageConnected:

            memoryState
              ?.storageConnected === true,

          privateRecordsIncluded: false,

          recallAuthorized: false,

          collectionAuthorized: false,

          learningAuthorized: false,

          serverAuthorizationRequired: true

        });


      /*
       * MONTHLY SUBSCRIPTION STATUS
       *
       * Informational only.
       */

      const access =
        api.access.getState();


      const subscription =
        Object.freeze({

          billingModel: "subscription",

          billingInterval: "month",

          billingIntervalCount: 1,

          subscriptionRequired: true,

          status:

            access?.characterId ===
              characterId

              ? access.subscriptionStatus

              : "unknown",

          aiExecutionAuthorized: false,

          tradingAuthorized: false

        });


      /*
       * FINAL CHARACTER CHECK
       */

      if (

        api.identity.getCharacterId() !==
          characterId

      ) {

        return unavailable(
          "character_context_changed"
        );

      }


      /*
       * UNIFIED PREVIEW CONTEXT
       */

      const context =
        Object.freeze({

          schemaVersion:
            SCHEMA_VERSION,

          characterId,

          displayName:
            personality.displayName,

          identityAvailable,

          personality,

          dna,

          emotions: Object.freeze({

            simulated: true,

            source: "initial_baseline",

            values: emotion.values,

            mood:

              api.emotions.describeState(
                emotion
              )

          }),

          communication,

          bond,

          strategy,

          memory,

          subscription,

          policy: POLICY,

          previewOnly: true,

          serverAuthorizationRequired: true,

          aiExecutionAuthorized: false,

          tradingAuthorized: false

        });


      return Object.freeze({

        version: VERSION,

        schemaVersion:
          SCHEMA_VERSION,

        ready: true,

        reason: "preview_only",

        context,

        aiExecutionAuthorized: false,

        memoryRecallAuthorized: false,

        tradingAuthorized: false

      });

    } catch {

      return unavailable(
        "agent_context_unavailable"
      );

    }

  }


  /*
   * CONTEXT STATUS
   */

  function getState() {

    const result = getCurrent();


    return Object.freeze({

      version: VERSION,

      schemaVersion:
        SCHEMA_VERSION,

      ready: result.ready,

      characterId:

        result.context?.characterId ||
        null,

      displayName:

        result.context?.displayName ||
        null,

      identityAvailable:

        result.context?.identityAvailable ===
          true,

      personalityAvailable:

        Boolean(
          result.context?.personality
        ),

      dnaAvailable:

        Boolean(
          result.context?.dna
        ),

      emotionsAvailable:

        Boolean(
          result.context?.emotions
        ),

      bondAvailable:

        Boolean(
          result.context?.bond
        ),

      strategyAvailable:

        Boolean(
          result.context?.strategy
        ),

      memorySchemaAvailable:

        result.context?.memory
          ?.schemaAvailable === true,

      privateMemoryAvailable: false,

      aiConnected: false,

      tradingConnected: false,

      reason: result.reason

    });

  }


  /*
   * PUBLIC READ-ONLY API
   */

  window.LAGO_AGENT_CONTEXT =
    Object.freeze({

      version: VERSION,

      schemaVersion:
        SCHEMA_VERSION,

      getCurrent,

      getState,

      validateDependencies,

      getPolicy() {

        return POLICY;

      }

    });


  document.dispatchEvent(

    new CustomEvent(

      "lago:agent-context-ready",

      {

        detail: getState()

      }

    )

  );

})();

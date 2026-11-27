
(() => {

  "use strict";

  /*
   * LAGO GAME
   * R2.6A — PERSONAL AGENT IDENTITY
   *
   * Stable account-character identity.
   *
   * Client identity is not authorization.
   * Private memory requires server checks.
   */

  const VERSION = 1;

  const SCHEMA_VERSION = 1;


  /*
   * IDENTITY POLICY
   */

  const POLICY = Object.freeze({

    ownerIdentity: "server_account_id",

    identityScope: "account_character",

    maxActiveAgents: 1,

    walletBasedIdentity: false,

    usernameBasedIdentity: false,

    guestPrivateMemoryEnabled: false,

    preserveIdentityOnCharacterSwitch: true,

    preserveIdentityOnSubscriptionExpiry: true,

    serverAuthorizationRequired: true,

    clientIdentityAuthorizesMemory: false,

    clientIdentityAuthorizesTrading: false

  });


  /*
   * VALIDATION
   */

  function clean(value) {

    return String(
      value ?? ""
    ).trim();

  }


  function validAccountId(value) {

    return (

      typeof value === "string" &&

      /^lago_[A-Za-z0-9_-]{22}$/
        .test(value)

    );

  }


  function validCharacterId(value) {

    return (

      typeof value === "string" &&

      window.LAGO_AGENT_PERSONALITY
        ?.has?.(value) === true

    );

  }


  /*
   * CURRENT CHARACTER
   */

  function getCharacterId() {

    const account =
      window.LAGO_ACCOUNT;

    const registry =
      window.LAGO_CHARACTERS;


    if (

      typeof account?.getState !==
        "function" ||

      typeof registry?.isComicCharacter !==
        "function"

    ) {

      return null;

    }


    const state =
      account.getState();

    if (!state) {

      return null;

    }


    const selected =
      clean(state.selectedSkin) ||
      "default";


    const characterId =

      registry.isComicCharacter(selected)

        ? selected

        : "lago";


    return validCharacterId(characterId)

      ? characterId

      : null;

  }


  /*
   * READ BACKEND ACCOUNT
   *
   * Never trust local Telegram identity
   * as proof of authentication.
   */

  function getAccountId() {

    const auth =
      window.LAGO_AUTH_BACKEND
        ?.getState?.();


    if (

      !auth ||

      auth.loading === true ||

      auth.authenticated !== true ||

      !validAccountId(auth.accountId)

    ) {

      return null;

    }


    return auth.accountId;

  }


  /*
   * STABLE AGENT IDENTIFIER
   */

  function createIdentity(
    accountId,
    characterId
  ) {

    if (

      !validAccountId(accountId) ||

      !validCharacterId(characterId)

    ) {

      return null;

    }


    const agentId = [

      "lago-agent",

      "v" + SCHEMA_VERSION,

      accountId,

      characterId

    ].join(":");


    return Object.freeze({

      schemaVersion:
        SCHEMA_VERSION,

      agentId,

      accountId,

      characterId,

      scope:
        "account_character",

      serverAuthorizationRequired:
        true

    });

  }


  /*
   * CURRENT IDENTITY
   */

  function getCurrent() {

    const accountId =
      getAccountId();

    const characterId =
      getCharacterId();


    if (!accountId || !characterId) {

      return null;

    }


    return createIdentity(

      accountId,

      characterId

    );

  }


  /*
   * VALIDATE IDENTITY STRUCTURE
   */

  function validateIdentity(identity) {

    if (

      !identity ||

      identity.schemaVersion !==
        SCHEMA_VERSION ||

      identity.scope !==
        "account_character"

    ) {

      return false;

    }


    const expected =
      createIdentity(

        identity.accountId,

        identity.characterId

      );


    return Boolean(

      expected &&

      identity.agentId ===
        expected.agentId &&

      identity.serverAuthorizationRequired ===
        true

    );

  }


  /*
   * CONTEXT COMPARISON
   *
   * Prevent accidental application
   * of another character's response.
   *
   * Not a server access check.
   */

  function isCurrent(identity) {

    if (!validateIdentity(identity)) {

      return false;

    }


    const current =
      getCurrent();


    return Boolean(

      current &&

      current.accountId ===
        identity.accountId &&

      current.characterId ===
        identity.characterId &&

      current.agentId ===
        identity.agentId

    );

  }


  /*
   * IDENTITY STATUS
   */

  function getState() {

    const characterId =
      getCharacterId();

    const identity =
      getCurrent();


    return Object.freeze({

      version: VERSION,

      schemaVersion:
        SCHEMA_VERSION,

      ready:
        identity !== null,

      characterId,

      identity,

      authenticationRequired:
        identity === null,

      privateMemoryAvailable:
        false,

      memoryAuthorizationGranted:
        false,

      tradingAuthorizationGranted:
        false,

      reason:

        !characterId

          ? "character_unavailable"

          : !identity

            ? "authentication_required"

            : "memory_service_unavailable"

    });

  }


  /*
   * NOTIFY CONTEXT CHANGES
   */

  let previousKey = null;


  function emit(force = false) {

    const state =
      getState();


    const key =
      JSON.stringify([

        state.characterId,

        state.identity?.agentId || null,

        state.reason

      ]);


    if (

      !force &&

      key === previousKey

    ) {

      return;

    }


    previousKey = key;


    document.dispatchEvent(

      new CustomEvent(

        "lago:agent-identity-state",

        { detail: state }

      )

    );

  }


  for (const event of [

    "lago:backend-auth-state",

    "lago:character-equipped",

    "lago:account-state",

    "lago:state"

  ]) {

    document.addEventListener(

      event,

      () => emit()

    );

  }


  /*
   * PUBLIC API
   */

  window.LAGO_AGENT_IDENTITY =
    Object.freeze({

      version: VERSION,

      schemaVersion:
        SCHEMA_VERSION,

      getCurrent,

      getState,

      getCharacterId,

      createIdentity,

      validateIdentity,

      isCurrent,

      getPolicy() {

        return POLICY;

      }

    });


  emit(true);


  document.dispatchEvent(

    new CustomEvent(

      "lago:agent-identity-ready",

      {

        detail: getState()

      }

    )

  );

})();

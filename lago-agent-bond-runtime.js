
(() => {

  "use strict";

  /*
   * LAGO GAME
   * R2.5C — AGENT BOND RUNTIME
   *
   * Local gameplay persistence.
   * Account and character separation.
   * Duplicate event protection.
   *
   * No financial entitlement.
   * No subscription activation.
   * No AI execution.
   */

  const VERSION = 1;

  const STORAGE_VERSION = 1;

  const STORAGE_PREFIX =
    "lago.agent.bond.v1:";

  const MAX_EVENTS = 1000;


  /*
   * DEPENDENCIES
   */

  function engine() {

    return window.LAGO_AGENT_BOND;

  }


  function clean(value) {

    return String(
      value ?? ""
    ).trim();

  }


  /*
   * LOCAL ACCOUNT NAMESPACE
   *
   * Not server authentication.
   * Wallet linking does not change bond.
   */

  function getScope() {

    const account =
      window.LAGO_ACCOUNT;

    if (

      typeof account?.getState !==
        "function" ||

      typeof account?.getAuthIdentity !==
        "function"

    ) {

      return null;

    }


    const state =
      account.getState();

    const auth =
      account.getAuthIdentity();


    if (!state || !auth) {

      return null;

    }


    if (

      auth.telegramLinked === true ||

      auth.provider === "telegram"

    ) {

      const id =
        clean(auth.telegramId);

      if (!/^\d+$/.test(id)) {

        return null;

      }

      return "telegram:" + id;

    }


    const localId =
      clean(state.social?.userId);

    return "local:" + (
      localId || "device"
    );

  }


  /*
   * SELECTED CHARACTER
   *
   * Lago skins share Lago's bond.
   */

  function getCharacterId() {

    const account =
      window.LAGO_ACCOUNT;

    const registry =
      window.LAGO_CHARACTERS;

    if (

      !account?.getState ||

      !registry?.isComicCharacter

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


    const id =

      registry.isComicCharacter(selected)

        ? selected

        : "lago";


    return window.LAGO_AGENT_PERSONALITY
      ?.has?.(id) === true

        ? id

        : null;

  }


  function getContext() {

    const scope =
      getScope();

    const characterId =
      getCharacterId();

    if (!scope || !characterId) {

      return null;

    }

    return Object.freeze({

      scope,

      characterId,

      serverVerified: false

    });

  }


  /*
   * INDIVIDUAL STORAGE KEY
   */

  function storageKey(
    scope,
    characterId
  ) {

    return STORAGE_PREFIX +

      encodeURIComponent(scope) +

      ":" +

      encodeURIComponent(characterId);

  }


  /*
   * VALIDATE EVENT IDENTIFIERS
   */

  function validEventId(id) {

    return (

      typeof id === "string" &&

      id.length >= 1 &&

      id.length <= 128 &&

      /^[a-zA-Z0-9:_.-]+$/.test(id)

    );

  }


  /*
   * STORAGE RECORD VALIDATION
   */

  function validateRecord(
    record,
    scope,
    characterId
  ) {

    if (

      !record ||

      record.storageVersion !==
        STORAGE_VERSION ||

      record.scope !== scope ||

      record.state?.characterId !==
        characterId ||

      engine()?.validateState?.(
        record.state
      ) !== true ||

      !Array.isArray(record.eventIds) ||

      record.eventIds.length >
        MAX_EVENTS ||

      record.eventIds.length >
        record.state.points

    ) {

      return false;

    }


    if (

      !record.eventIds.every(validEventId) ||

      new Set(record.eventIds).size !==
        record.eventIds.length

    ) {

      return false;

    }


    return true;

  }


  /*
   * READ PERSISTED BOND
   */

  function readRecord(
    scope,
    characterId
  ) {

    const initial =
      engine()?.getInitial?.(
        characterId
      );

    if (!initial) {

      return {

        ok: false,

        reason: "invalid_character"

      };

    }


    try {

      const raw =
        localStorage.getItem(

          storageKey(
            scope,
            characterId
          )

        );


      if (raw === null) {

        return {

          ok: true,

          record: {

            storageVersion:
              STORAGE_VERSION,

            scope,

            state: initial,

            eventIds: []

          }

        };

      }


      const record =
        JSON.parse(raw);


      if (

        !validateRecord(
          record,
          scope,
          characterId
        )

      ) {

        return {

          ok: false,

          reason: "invalid_storage"

        };

      }


      return {

        ok: true,

        record

      };

    } catch {

      return {

        ok: false,

        reason: "storage_read_failed"

      };

    }

  }


  /*
   * READ CURRENT PROGRESSION
   */

  function getState(
    characterId = getCharacterId()
  ) {

    const scope =
      getScope();

    const id =
      clean(characterId);

    if (!scope || !id || !engine()) {

      return Object.freeze({

        version: VERSION,

        ready: false,

        reason: "runtime_not_ready"

      });

    }


    const result =
      readRecord(scope, id);


    if (!result.ok) {

      return Object.freeze({

        version: VERSION,

        ready: false,

        reason: result.reason

      });

    }


    return Object.freeze({

      version: VERSION,

      ready: true,

      characterId: id,

      persistence: "local",

      serverVerified: false,

      progression:

        engine().describeState(
          result.record.state
        )

    });

  }


  /*
   * COMMIT ACCEPTED GAMEPLAY EVENT
   *
   * Call only from successful
   * gameplay transaction handlers.
   */

  function recordEvent({

    eventId = "",

    eventType = "",

    scope = "",

    characterId = ""

  } = {}) {

    const context =
      getContext();


    if (

      !context ||

      scope !== context.scope ||

      characterId !==
        context.characterId

    ) {

      return {

        ok: false,

        reason: "context_mismatch"

      };

    }


    if (!validEventId(eventId)) {

      return {

        ok: false,

        reason: "invalid_event_id"

      };

    }


    const current =
      readRecord(
        scope,
        characterId
      );


    if (!current.ok) {

      return current;

    }


    const record =
      current.record;


    if (

      record.eventIds.includes(
        eventId
      )

    ) {

      return {

        ok: true,

        duplicate: true,

        gainedPoints: 0,

        state: getState(characterId)

      };

    }


    const result =
      engine().applyEvent(

        record.state,

        eventType

      );


    if (!result?.ok) {

      return {

        ok: false,

        reason: "unsupported_event"

      };

    }


    if (result.gainedPoints === 0) {

      return {

        ok: true,

        duplicate: false,

        gainedPoints: 0,

        state: getState(characterId)

      };

    }


    const next = {

      storageVersion:
        STORAGE_VERSION,

      scope,

      state:
        result.state,

      eventIds: [

        ...record.eventIds,

        eventId

      ]

    };


    if (

      !validateRecord(
        next,
        scope,
        characterId
      )

    ) {

      return {

        ok: false,

        reason: "invalid_next_state"

      };

    }


    /*
     * Persist before publishing.
     */

    try {

      localStorage.setItem(

        storageKey(
          scope,
          characterId
        ),

        JSON.stringify(next)

      );

    } catch {

      return {

        ok: false,

        reason: "storage_write_failed"

      };

    }


    const detail = Object.freeze({

      ok: true,

      duplicate: false,

      eventType,

      characterId,

      gainedPoints:
        result.gainedPoints,

      levelChanged:
        result.levelChanged,

      state:
        getState(characterId)

    });


    document.dispatchEvent(

      new CustomEvent(

        "lago:agent-bond-state",

        { detail }

      )

    );


    return detail;

  }


  /*
   * PUBLIC API
   */

  window.LAGO_AGENT_BOND_RUNTIME =
    Object.freeze({

      version: VERSION,

      getContext,

      getState,

      recordEvent

    });


  document.dispatchEvent(

    new CustomEvent(

      "lago:agent-bond-runtime-ready",

      {

        detail: {

          version: VERSION,

          persistence: "local",

          serverVerified: false

        }

      }

    )

  );

})();

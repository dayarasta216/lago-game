(() => {
  "use strict";


  /*
   * =========================================================
   * LAGO DEVELOPER MODE
   * =========================================================
   *
   * LOCAL DEVELOPMENT / TESTING ONLY.
   *
   * Gives the developer:
   *
   * - all current characters
   * - all current Lago skins
   * - 10,000,000 SP
   * - full DUM
   * - Life = 100
   * - future registered Creator parts
   *
   * IMPORTANT:
   *
   * Before enabling DEV mode we save the player's
   * original account state.
   *
   * DEV OFF restores that original state.
   *
   * This is NOT a security boundary.
   * Before public release:
   *
   * DEV_BUILD_ENABLED = false
   *
   * =========================================================
   */


  const VERSION =
    1;


  /*
   * DEVELOPMENT:
   * true
   *
   * PUBLIC RELEASE:
   * false
   */
  const DEV_BUILD_ENABLED =
    true;


  const FLAG_KEY =
    "lago_dev_full_access_v1";


  const BACKUP_KEY =
    "lago_dev_account_backup_v1";


  /*
   * Must match lago-account-core.js
   */
  const ACCOUNT_KEY =
    "lago_account_state_v2";


  const DEV_SP_TARGET =
    10000000;


  /*
   * Existing Lago skins.
   *
   * These are SKINS,
   * not separate characters.
   */
  const LAGO_SKINS =
    Object.freeze([

      "lime",

      "ocean",

      "galaxy",

      "lava",

      "gold",

      "void",

      "diamond"

    ]);


  /*
   * Prevent recursive maintain loops.
   */
  let maintainQueued =
    false;



  /*
   * =========================================================
   * STATUS
   * =========================================================
   */


  function enabled() {

    if (
      DEV_BUILD_ENABLED !==
      true
    ) {

      return false;

    }


    try {

      return (
        localStorage.getItem(
          FLAG_KEY
        ) ===
        "1"
      );

    } catch {

      return false;

    }

  }



  /*
   * =========================================================
   * BACKUP
   * =========================================================
   *
   * Save original player account only once.
   *
   * We do NOT overwrite backup every reload.
   */


  function backupAccountOnce() {

    try {

      if (
        localStorage.getItem(
          BACKUP_KEY
        ) !==
        null
      ) {

        return true;

      }


      const current =
        localStorage.getItem(
          ACCOUNT_KEY
        );


      localStorage.setItem(

        BACKUP_KEY,

        current === null
          ? "__EMPTY__"
          : current

      );


      return true;

    } catch {

      return false;

    }

  }



  /*
   * =========================================================
   * CHARACTERS
   * =========================================================
   */


  function grantCharacters() {

    const account =
      window.LAGO_ACCOUNT;


    if (!account) {

      return;

    }


    const characters =
      window.LAGO_CHARACTERS
        ?.getAll
        ?.() ||
      [];


    for (
      const character
      of characters
    ) {

      if (
        !character?.id
      ) {

        continue;

      }


      account.addSkin?.(
        character.id
      );

    }

  }



  /*
   * =========================================================
   * LAGO SKINS
   * =========================================================
   */


  function grantLagoSkins() {

    const account =
      window.LAGO_ACCOUNT;


    if (!account) {

      return;

    }


    for (
      const id
      of LAGO_SKINS
    ) {

      account.addSkin?.(
        id
      );

    }

  }



  /*
   * =========================================================
   * SP
   * =========================================================
   */


  function refillSP() {

    const account =
      window.LAGO_ACCOUNT;


    if (!account) {

      return;

    }


    const current =
      Math.max(

        0,

        Number(
          account
            .getSPState
            ?.()
            ?.balance
        ) ||
        0

      );


    if (
      current >=
      DEV_SP_TARGET
    ) {

      return;

    }


    account.addSP?.(

      DEV_SP_TARGET -
      current,

      {
        gameId:
          "developer-access"
      }

    );

  }



  /*
   * =========================================================
   * DUM
   * =========================================================
   */


  function refillDum() {

    const account =
      window.LAGO_ACCOUNT;


    if (!account) {

      return;

    }


    const energy =
      account
        .getDumEnergy
        ?.();


    if (!energy) {

      return;

    }


    const current =
      Math.max(

        0,

        Number(
          energy.dum
        ) ||
        0

      );


    const maximum =
      Math.max(

        0,

        Number(
          energy.max
        ) ||
        0

      );


    if (
      current >=
      maximum
    ) {

      return;

    }


    account.restoreDum?.(

      maximum -
      current

    );

  }



  /*
   * =========================================================
   * LIFE
   * =========================================================
   */


  function refillLife() {

    const account =
      window.LAGO_ACCOUNT;


    if (!account) {

      return;

    }


    const value =
      Number(
        account
          .getState
          ?.()
          ?.life
          ?.value
      );


    if (
      Number.isFinite(
        value
      ) &&
      value >=
      100
    ) {

      return;

    }


    account.setLife?.(
      100
    );

  }



  /*
   * =========================================================
   * CREATURE PARTS
   * =========================================================
   *
   * Future-compatible.
   *
   * When LAGO_PARTS +
   * LAGO_PART_INVENTORY exist,
   * DEV automatically unlocks them.
   */


  function grantCreatorParts() {

    const parts =
      window.LAGO_PARTS
        ?.getAll
        ?.() ||
      [];


    if (
      !Array.isArray(
        parts
      )
    ) {

      return;

    }


    for (
      const part
      of parts
    ) {

      if (
        !part?.id
      ) {

        continue;

      }


      window.LAGO_PART_INVENTORY
        ?.grant
        ?.(
          part.id,
          "developer-access"
        );

    }

  }



  /*
   * =========================================================
   * GRANT EVERYTHING
   * =========================================================
   */


  function grantAll() {

    if (
      !enabled()
    ) {

      return {

        ok:
          false,

        reason:
          "dev_disabled"

      };

    }


    if (
      !window.LAGO_ACCOUNT
    ) {

      return {

        ok:
          false,

        reason:
          "account_unavailable"

      };

    }


    grantLagoSkins();

    grantCharacters();

    refillSP();

    refillDum();

    refillLife();

    grantCreatorParts();


    document.dispatchEvent(

      new CustomEvent(

        "lago:dev-mode",

        {

          detail: {

            enabled:
              true

          }

        }

      )

    );


    return {

      ok:
        true

    };

  }



  /*
   * =========================================================
   * ENABLE
   * =========================================================
   */


  function enable() {

    if (
      !DEV_BUILD_ENABLED
    ) {

      return {

        ok:
          false,

        reason:
          "dev_build_disabled"

      };

    }


    backupAccountOnce();


    try {

      localStorage.setItem(
        FLAG_KEY,
        "1"
      );

    } catch {

      return {

        ok:
          false,

        reason:
          "storage_failed"

      };

    }


    const result =
      grantAll();


    document.dispatchEvent(

      new CustomEvent(

        "lago:dev-mode-enabled",

        {

          detail: {

            enabled:
              true

          }

        }

      )

    );


    return result;

  }



  /*
   * =========================================================
   * RESTORE ORIGINAL ACCOUNT
   * =========================================================
   */


  function restoreOriginalAccount() {

    let backup =
      null;


    try {

      backup =
        localStorage.getItem(
          BACKUP_KEY
        );

    } catch {

      return false;

    }


    if (
      backup ===
      "__EMPTY__"
    ) {

      localStorage.removeItem(
        ACCOUNT_KEY
      );


      return true;

    }


    if (
      backup ===
      null
    ) {

      return false;

    }


    localStorage.setItem(
      ACCOUNT_KEY,
      backup
    );


    return true;

  }



  /*
   * =========================================================
   * DISABLE
   * =========================================================
   */


  function disable(
    {
      restore = true,
      reload = true
    } = {}
  ) {

    if (
      restore
    ) {

      restoreOriginalAccount();

    }


    try {

      localStorage.removeItem(
        FLAG_KEY
      );


      localStorage.removeItem(
        BACKUP_KEY
      );

    } catch {}


    document.dispatchEvent(

      new CustomEvent(

        "lago:dev-mode",

        {

          detail: {

            enabled:
              false

          }

        }

      )

    );


    if (
      reload
    ) {

      location.reload();

    }


    return {

      ok:
        true

    };

  }



  /*
   * =========================================================
   * AUTO MAINTAIN
   * =========================================================
   *
   * If developer spends:
   *
   * SP
   * DUM
   * Life
   *
   * account state changes.
   *
   * Queue one maintenance pass.
   */


  function scheduleMaintain() {

    if (
      !enabled() ||
      maintainQueued
    ) {

      return;

    }


    maintainQueued =
      true;


    queueMicrotask(
      () => {

        maintainQueued =
          false;


        if (
          enabled()
        ) {

          grantAll();

        }

      }
    );

  }


  /*
   * =========================================================
   * ACCOUNT EVENTS
   * =========================================================
   */


  document.addEventListener(
    "lago:state",
    scheduleMaintain
  );


  document.addEventListener(
    "lago:character-unlocked",
    scheduleMaintain
  );


  document.addEventListener(
    "lago:part-inventory",
    scheduleMaintain
  );



  /*
   * =========================================================
   * PUBLIC API
   * =========================================================
   */


  window.LAGO_DEV =
    Object.freeze({

      version:
        VERSION,


      buildEnabled:
        DEV_BUILD_ENABLED,


      enabled,


      enable,


      disable,


      grantAll,


      restoreOriginalAccount

    });



  /*
   * =========================================================
   * INITIALIZATION
   * =========================================================
   */

function initialize() {

  if (
    enabled()
  ) {

    grantAll();

  }

}


if (
  document.readyState ===
  "loading"
) {

  document.addEventListener(
    "DOMContentLoaded",
    initialize,
    {
      once:
        true
    }
  );

} else {

  initialize();

}


})();

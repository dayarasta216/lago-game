(() => {
  "use strict";

  /*
   * =========================================================
   * LAGO WALLET — PHANTOM / SOLANA
   * R0.5E2
   * =========================================================
   *
   * Public wallet connection only.
   *
   * NO private keys.
   * NO transaction signing yet.
   * NO $LAGO balance yet.
   * NO automatic purchases.
   */

  const VERSION =
    1;


  const PROVIDER_ID =
    "phantom-injected";


  const EXPECTED_CHAIN =
    "solana";


  const EXPECTED_NETWORK =
    "mainnet-beta";


  let provider =
    null;


  let listenersBound =
    false;


  const state = {

    installed:
      false,

    connected:
      false,

    connecting:
      false,

    provider:
      PROVIDER_ID,

    publicKey:
      "",

    expectedChain:
      EXPECTED_CHAIN,

    expectedNetwork:
      EXPECTED_NETWORK,

    networkReady:
      false,

    lastError:
      ""

  };


  function snapshot() {

    return {
      ...state
    };

  }


  function emit(
    reason = "update"
  ) {

    document.dispatchEvent(

      new CustomEvent(
        "lago:wallet-state",
        {

          detail: {

            reason,

            ...snapshot()

          }

        }
      )

    );

  }


  /*
   * Phantom official injected
   * Solana provider.
   */
  function getProvider() {

    const candidate =
      window.phantom
        ?.solana;


    if (
      candidate
        ?.isPhantom ===
      true
    ) {

      provider =
        candidate;


      state.installed =
        true;


      return provider;

    }


    provider =
      null;


    state.installed =
      false;


    return null;

  }


  function isValidPublicKey(
    value
  ) {

    const text =
      String(
        value ?? ""
      ).trim();


    const validator =
      window.LAGO_TOKEN_CONFIG
        ?.isBase58Address;


    if (
      typeof validator ===
      "function"
    ) {

      return validator(
        text
      );

    }


    /*
     * Structural fallback only.
     */
    return (

      text.length >= 32 &&

      text.length <= 44 &&

      /^[1-9A-HJ-NP-Za-km-z]+$/
        .test(text)

    );

  }


  /*
   * Important:
   *
   * Phantom connection itself
   * does not prove which RPC
   * our future transaction uses.
   *
   * This guard confirms what
   * Lago EXPECTS to use.
   *
   * Real transaction/network
   * verification comes later
   * on the backend.
   */
  function refreshNetworkGuard() {

    const identity =
      window.LAGO_TOKEN_CONFIG
        ?.getIdentity
        ?.();


    if (!identity) {

      state.expectedChain =
        EXPECTED_CHAIN;


      state.expectedNetwork =
        EXPECTED_NETWORK;


      state.networkReady =
        false;


      return false;

    }


    state.expectedChain =
      String(
        identity.chain || ""
      ).trim();


    state.expectedNetwork =
      String(
        identity.network || ""
      ).trim();


    state.networkReady = (

      state.expectedChain ===
        EXPECTED_CHAIN &&

      state.expectedNetwork ===
        EXPECTED_NETWORK

    );


    return state.networkReady;

  }


  function setPublicKey(
    value,
    reason = "account"
  ) {

    const text =
      String(
        value ?? ""
      ).trim();


    if (
      !text ||
      !isValidPublicKey(
        text
      )
    ) {

      state.publicKey =
        "";


      state.connected =
        false;


      emit(
        reason
      );


      return false;

    }


    state.publicKey =
      text;


    state.connected =
      true;


    state.lastError =
      "";


    emit(
      reason
    );


    return true;

  }


  function clearConnection(
    reason = "disconnect"
  ) {

    state.connected =
      false;


    state.connecting =
      false;


    state.publicKey =
      "";


    emit(
      reason
    );

  }


  /*
   * Phantom can change account
   * while the page is open.
   */
  function bindProviderEvents() {

    const current =
      getProvider();


    if (
      !current ||
      listenersBound ||
      typeof current.on !==
        "function"
    ) {

      return;

    }


    current.on(
      "connect",
      publicKey => {

        const value =

          publicKey
            ?.toString
            ?.() ??

          current.publicKey
            ?.toString
            ?.() ??

          "";


        setPublicKey(
          value,
          "connect"
        );

      }
    );


    current.on(
      "disconnect",
      () => {

        clearConnection(
          "disconnect"
        );

      }
    );


    current.on(
      "accountChanged",
      publicKey => {

        if (!publicKey) {

          clearConnection(
            "accountChanged"
          );


          return;

        }


        setPublicKey(

          publicKey
            ?.toString
            ?.() ??
          publicKey,

          "accountChanged"

        );

      }
    );


    listenersBound =
      true;

  }


  function detect() {

    const current =
      getProvider();


    refreshNetworkGuard();


    bindProviderEvents();


    if (
      current
        ?.isConnected &&
      current.publicKey
    ) {

      setPublicKey(

        current.publicKey
          .toString(),

        "detect"

      );

    } else {

      state.connected =
        false;


      state.publicKey =
        "";


      emit(
        "detect"
      );

    }


    return snapshot();

  }


  /*
   * Explicit user connection.
   *
   * This may open Phantom UI.
   */
  async function connect() {

    const current =
      getProvider();


    refreshNetworkGuard();


    bindProviderEvents();


    if (!current) {

      state.lastError =
        "phantom_not_installed";


      emit(
        "error"
      );


      return {

        ok:
          false,

        reason:
          "phantom_not_installed",

        state:
          snapshot()

      };

    }


    if (
      state.connecting
    ) {

      return {

        ok:
          false,

        reason:
          "connect_in_progress",

        state:
          snapshot()

      };

    }


    state.connecting =
      true;


    state.lastError =
      "";


    emit(
      "connecting"
    );


    try {

      const response =
        await current
          .connect();


      const publicKey =

        response
          ?.publicKey
          ?.toString
          ?.() ??

        current
          .publicKey
          ?.toString
          ?.() ??

        "";


      state.connecting =
        false;


      if (
        !setPublicKey(
          publicKey,
          "connect"
        )
      ) {

        state.lastError =
          "invalid_public_key";


        emit(
          "error"
        );


        return {

          ok:
            false,

          reason:
            "invalid_public_key",

          state:
            snapshot()

        };

      }


      return {

        ok:
          true,

        publicKey:
          state.publicKey,

        state:
          snapshot()

      };

    } catch (
      error
    ) {

      state.connecting =
        false;


      state.lastError =

        error?.code ===
          4001

          ? "user_rejected"

          : "connect_failed";


      emit(
        "error"
      );


      return {

        ok:
          false,

        reason:
          state.lastError,

        state:
          snapshot()

      };

    }

  }


  /*
   * Silent reconnect.
   *
   * Phantom must already trust
   * this site.
   *
   * This must NOT open a popup.
   */
  async function eagerConnect() {

    const current =
      getProvider();


    refreshNetworkGuard();


    bindProviderEvents();


    if (!current) {

      return {

        ok:
          false,

        reason:
          "phantom_not_installed",

        state:
          snapshot()

      };

    }


    try {

      const response =
        await current.connect({

          onlyIfTrusted:
            true

        });


      const publicKey =

        response
          ?.publicKey
          ?.toString
          ?.() ??

        current
          .publicKey
          ?.toString
          ?.() ??

        "";


      if (
        !setPublicKey(
          publicKey,
          "eagerConnect"
        )
      ) {

        return {

          ok:
            false,

          reason:
            "not_trusted",

          state:
            snapshot()

        };

      }


      return {

        ok:
          true,

        publicKey:
          state.publicKey,

        state:
          snapshot()

      };

    } catch {

      /*
       * Expected when site has
       * not been trusted before.
       *
       * Fail silently.
       */
      return {

        ok:
          false,

        reason:
          "not_trusted",

        state:
          snapshot()

      };

    }

  }


  async function disconnect() {

    const current =
      getProvider();


    try {

      if (
        current &&
        typeof current.disconnect ===
          "function"
      ) {

        await current
          .disconnect();

      }

    } catch {

      state.lastError =
        "disconnect_failed";


      emit(
        "error"
      );


      return {

        ok:
          false,

        reason:
          "disconnect_failed",

        state:
          snapshot()

      };

    }


    clearConnection(
      "disconnect"
    );


    return {

      ok:
        true,

      state:
        snapshot()

    };

  }


  function getState() {

    refreshNetworkGuard();


    return snapshot();

  }


  window.LAGO_WALLET =
    Object.freeze({

      version:
        VERSION,

      detect,

      connect,

      eagerConnect,

      disconnect,

      getState,

      getProvider

    });


  /*
   * Detect immediately.
   */
  detect();


  /*
   * Silent trusted reconnect.
   *
   * No popup.
   */
  eagerConnect();

})();

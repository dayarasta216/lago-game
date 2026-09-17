(() => {
  "use strict";

  /*
   * =========================================================
   * LAGO AUTH BRIDGE
   * R0.5E4 INTEGRATION FIX
   * =========================================================
   *
   * Telegram = Lago login identity.
   * Phantom   = connected payment wallet.
   * Backend   = authoritative verified session.
   *
   * Local identity is development fallback only.
   */

  const VERSION =
    3;


  function getBackend() {

    return window.LAGO_AUTH_BACKEND ||
      null;

  }


  function getBackendState() {

    return getBackend()
      ?.getState
      ?.() || {};

  }


  function getTelegramContext() {

    const tg =
      window.Telegram
        ?.WebApp;


    const user =
      tg
        ?.initDataUnsafe
        ?.user;


    const initData =
      String(
        tg?.initData ||
        ""
      ).trim();


    if (
      !tg ||
      !user ||
      !initData
    ) {

      return null;

    }


    return {

      initData,

      user: {

        id:
          String(
            user.id ||
            ""
          ),

        username:
          String(
            user.username ||
            ""
          ),

        displayName:
          [
            user.first_name,
            user.last_name
          ]
            .filter(Boolean)
            .join(" ")
            .trim()

      }

    };

  }


  function getState() {

    const identity =
      window.LAGO_ACCOUNT
        ?.getAuthIdentity
        ?.() || {};


    const wallet =
      window.LAGO_WALLET
        ?.getState
        ?.() || {};


    /*
     * IMPORTANT:
     * Read backend dynamically.
     * Never cache authenticated state
     * at module startup.
     */
    const backend =
      getBackendState();


    const backendAuthenticated =
      backend.authenticated ===
        true;


    const telegramId =
      backendAuthenticated

        ? String(
            backend.telegramId ||
            ""
          )

        : String(
            identity.telegramId ||
            ""
          );


    const telegramUsername =
      backendAuthenticated

        ? String(
            backend.telegramUsername ||
            ""
          )

        : String(
            identity.telegramUsername ||
            ""
          );


    const telegramDisplayName =
      backendAuthenticated

        ? String(
            backend.telegramDisplayName ||
            ""
          )

        : String(
            identity.telegramDisplayName ||
            ""
          );


    const connectedWallet =
      String(
        wallet.publicKey ||
        ""
      ).trim();


    const boundWallet =
      String(
        backendAuthenticated

          ? backend.walletPublicKey ||
            ""

          : identity.walletPublicKey ||
            ""
      ).trim();


    const walletMismatch =
      Boolean(

        wallet.connected ===
          true &&

        connectedWallet &&

        boundWallet &&

        connectedWallet !==
          boundWallet

      );


    return {

      backendReady:
        backend.backendReady ===
          true,

      backendAuthenticated,

      accountId:
        backendAuthenticated

          ? String(
              backend.accountId ||
              ""
            )

          : "",

      telegramLinked:
        backendAuthenticated ||
        identity.telegramLinked ===
          true,

      /*
       * Only backend authentication
       * counts as VERIFIED.
       */
      telegramVerified:
        backendAuthenticated,

      telegramId,

      telegramUsername,

      telegramDisplayName,

      walletLinked:
        Boolean(
          boundWallet
        ),

      boundWallet,

      walletConnected:
        wallet.connected ===
          true,

      connectedWallet,

      walletMismatch

    };

  }


  function emit(
    reason = "update"
  ) {

    document.dispatchEvent(

      new CustomEvent(
        "lago:auth-state",
        {

          detail: {

            reason,

            ...getState()

          }

        }
      )

    );

  }


  /*
   * Local compatibility mirror.
   *
   * This never marks Telegram
   * as server verified.
   */
  function mirrorBackendIdentityLocally() {

    const backend =
      getBackendState();


    const account =
      window.LAGO_ACCOUNT;


    if (
      backend.authenticated !==
        true ||
      !backend.telegramId ||
      !account ||
      typeof account
        .linkTelegramIdentity !==
        "function"
    ) {

      return false;

    }


    account.linkTelegramIdentity({

      id:
        backend.telegramId,

      username:
        backend.telegramUsername ||
        "",

      displayName:
        backend.telegramDisplayName ||
        ""

    });


    return true;

  }


  async function bindConnectedWallet() {

    const wallet =
      window.LAGO_WALLET
        ?.getState
        ?.();


    /*
     * Validate wallet FIRST.
     */
    if (
      !wallet ||
      wallet.connected !==
        true ||
      !wallet.publicKey
    ) {

      return {

        ok:
          false,

        reason:
          "wallet_not_connected"

      };

    }


    const backend =
      getBackend();


    /*
     * Production path.
     *
     * Verified Telegram session
     * → server wallet binding.
     */
    if (
      backend
        ?.getState
        ?.()
        ?.authenticated ===
          true &&
      typeof backend.bindWallet ===
        "function"
    ) {

      const result =
        await backend
          .bindWallet(
            wallet.publicKey
          );


      emit(
        result?.ok

          ? "wallet-server-bound"

          : result?.reason ||
            "wallet-bind-failed"
      );


      return result;

    }


    /*
     * Development fallback.
     */
    const account =
      window.LAGO_ACCOUNT;


    if (
      !account ||
      typeof account
        .linkWalletIdentity !==
        "function"
    ) {

      return {

        ok:
          false,

        reason:
          "account_unavailable"

      };

    }


    const result =
      account
        .linkWalletIdentity(
          wallet.publicKey
        );


    emit(
      result.ok

        ? "wallet-linked"

        : result.reason
    );


    return result;

  }


  async function signInWithTelegram() {

    const backend =
      getBackend();


    const backendReady =
      backend &&
      typeof backend
        .signInWithTelegram ===
        "function" &&
      backend
        .getConfigStatus
        ?.()
        ?.ready ===
          true;


    /*
     * =========================================================
     * PRODUCTION AUTH
     * =========================================================
     */
    if (
      backendReady
    ) {

      const result =
        await backend
          .signInWithTelegram();


      if (
        !result?.ok
      ) {

        return result;

      }


      /*
       * Mirror public identity for
       * existing UI compatibility.
       *
       * Verified status remains backend-only.
       */
      mirrorBackendIdentityLocally();


      /*
       * If Phantom was already connected,
       * bind through SERVER.
       */
      const wallet =
        window.LAGO_WALLET
          ?.getState
          ?.();


      if (
        wallet?.connected &&
        wallet.publicKey
      ) {

        const binding =
          await bindConnectedWallet();


        if (
  binding?.ok !==
    true &&
  binding?.reason !==
    "wallet_binding_not_configured"
) {

          return {

            ok:
              false,

            reason:
              binding?.reason ||
              "wallet_bind_failed",

            authenticated:
              true,

            state:
              getState()

          };

        }

      }


      emit(
        "telegram-verified"
      );


      return {

        ok:
          true,

        verified:
          true,

        state:
          getState()

      };

    }


    /*
     * =========================================================
     * DEVELOPMENT FALLBACK
     * =========================================================
     */

    const context =
      getTelegramContext();


    if (
      !context
    ) {

      return {

        ok:
          false,

        reason:
          "telegram_context_missing"

      };

    }


    const account =
      window.LAGO_ACCOUNT;


    if (
      !account ||
      typeof account
        .linkTelegramIdentity !==
        "function"
    ) {

      return {

        ok:
          false,

        reason:
          "account_unavailable"

      };

    }


    const result =
      account
        .linkTelegramIdentity(
          context.user
        );


    if (
      !result.ok
    ) {

      return result;

    }


    const wallet =
      window.LAGO_WALLET
        ?.getState
        ?.();


    if (
      wallet?.connected &&
      wallet.publicKey
    ) {

      await bindConnectedWallet();

    }


    emit(
      "telegram-linked"
    );


    return {

      ok:
        true,

      /*
       * Local identity is NEVER
       * considered verified.
       */
      verified:
        false,

      state:
        getState()

    };

  }


  /*
   * Phantom connection/account
   * changes update auth UI.
   */
  document.addEventListener(
    "lago:wallet-state",
    () => {

      emit(
        "wallet-state"
      );

    }
  );


  /*
   * Server login / logout /
   * session restore updates auth.
   */
  document.addEventListener(
    "lago:backend-auth-state",
    event => {

      if (
        event?.detail
          ?.authenticated ===
        true
      ) {

        mirrorBackendIdentityLocally();

      }


      emit(
        event?.detail?.reason ||
        "backend-auth-state"
      );

    }
  );


  window.LAGO_AUTH =
    Object.freeze({

      version:
        VERSION,

      getState,

      getTelegramContext,

      signInWithTelegram,

      bindConnectedWallet

    });


    emit(
    "ready"
  );

})();

(() => {
  "use strict";

  /*
   * =========================================================
   * LAGO AUTH BRIDGE
   * R0.5E3
   * =========================================================
   *
   * Telegram = Lago login identity
   * Phantom   = payment wallet
   *
   * This module links the two without
   * treating the wallet as login.
   */

const backend =
  window.LAGO_AUTH_BACKEND
    ?.getState
    ?.() ||
  {};
  
  const VERSION =
    1;


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

      backendAuthenticated:
  backend.authenticated ===
    true,

accountId:
  backend.accountId ||
  "",
      
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
        ?.() ||
      {};


    const wallet =
      window.LAGO_WALLET
        ?.getState
        ?.() ||
      {};


    const connectedWallet =
      String(
        wallet.publicKey ||
        ""
      ).trim();


    const boundWallet =
      String(
        identity.walletPublicKey ||
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

      telegramLinked:
        identity.telegramLinked ===
          true,

      telegramVerified:
  backend.authenticated ===
    true ||
  identity.telegramVerified ===
    true,

      telegramId:
        identity.telegramId ||
        "",

      telegramUsername:
        identity.telegramUsername ||
        "",

      telegramDisplayName:
        identity.telegramDisplayName ||
        "",

      walletLinked:
        identity.walletLinked ===
          true,

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


  async function bindConnectedWallet() {

    const account =
      window.LAGO_ACCOUNT;


    const wallet =
      window.LAGO_WALLET
        ?.getState
        ?.();


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


    if (
      !wallet ||
      wallet.connected !==
        true ||
      !wallet.publicKey
    ) {

      const backend =
  window.LAGO_AUTH_BACKEND;


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

      return {

        ok:
          false,

        reason:
          "wallet_not_connected"

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
  window.LAGO_AUTH_BACKEND;


if (
  backend &&
  typeof backend
    .signInWithTelegram ===
    "function" &&
  backend
    .getConfigStatus
    ?.()
    ?.ready === true
) {

  const result =
    await backend
      .signInWithTelegram();


  if (
    result?.ok
  ) {

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


  return result;

}
    
    const context =
      getTelegramContext();


    if (!context) {

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


    if (!result.ok) {

      return result;

    }


    /*
     * If Phantom is already connected,
     * bind that public wallet too.
     *
     * A mismatching old binding will
     * still fail closed.
     */
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
       * Still false until backend
       * validates Telegram initData.
       */
      verified:
        false,

      state:
        getState()

    };

  }


  /*
   * Wallet session changes do not
   * automatically replace a binding.
   */
  document.addEventListener(
    "lago:wallet-state",
    () => {

      emit(
        "wallet-state"
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

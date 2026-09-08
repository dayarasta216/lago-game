(() => {
  "use strict";

  /*
   * =========================================================
   * LAGO AUTH BACKEND CONTRACT
   * R0.5E4
   * =========================================================
   *
   * Telegram initData:
   * browser → Lago backend
   *
   * Backend verifies Telegram signature
   * and owns the real session.
   *
   * Session transport:
   * Secure + HttpOnly cookie.
   *
   * NEVER store:
   * bot token
   * private keys
   * auth JWT
   * server secret
   * in localStorage.
   */

  const VERSION =
    1;


  /*
   * Empty endpoint config means:
   * FAIL CLOSED.
   *
   * Later this can become:
   *
   * /api/auth/telegram
   * /api/auth/session
   * /api/auth/logout
   * /api/account/wallet
   */
 const CONFIG =
  Object.freeze({

    telegramLoginEndpoint:
      "/api/auth/telegram",

    sessionEndpoint:
      "/api/auth/session",

    logoutEndpoint:
      "/api/auth/logout",

    /*
     * Disabled until Phantom
     * ownership proof is implemented.
     */
    walletBindEndpoint:
      ""

  });
  const state = {

    backendReady:
      false,

    authenticated:
      false,

    loading:
      false,

    accountId:
      "",

    telegramId:
      "",

    telegramUsername:
      "",

    telegramDisplayName:
      "",

    walletPublicKey:
      "",

    lastError:
      ""

  };


  function clean(
    value
  ) {

    return String(
      value ?? ""
    ).trim();

  }


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
        "lago:backend-auth-state",
        {

          detail: {

            reason,

            ...snapshot()

          }

        }
      )

    );

  }


  function getConfigStatus() {

    const telegramLoginEndpoint =
      clean(
        CONFIG.telegramLoginEndpoint
      );


    const sessionEndpoint =
      clean(
        CONFIG.sessionEndpoint
      );


    const logoutEndpoint =
      clean(
        CONFIG.logoutEndpoint
      );


    const walletBindEndpoint =
      clean(
        CONFIG.walletBindEndpoint
      );


   const authReady =
  Boolean(

    telegramLoginEndpoint &&

    sessionEndpoint &&

    logoutEndpoint

  );


const walletBindingReady =
  Boolean(
    walletBindEndpoint
  );


const ready =
  authReady;


    state.backendReady =
      ready;


  return {

  ready,

  authReady,

  walletBindingReady,

  telegramLoginEndpoint,

      sessionEndpoint,

      logoutEndpoint,

      walletBindEndpoint

    };

  }


  function normalizeAccount(
    payload
  ) {

    if (
      !payload ||
      typeof payload !==
        "object"
    ) {

      return null;

    }


    const accountId =
      clean(
        payload.accountId
      );


    const telegram =
      payload.telegram &&
      typeof payload.telegram ===
        "object"

        ? payload.telegram
        : {};


    const telegramId =
      clean(
        telegram.id
      );


    if (
      !accountId ||
      !telegramId
    ) {

      return null;

    }


    return {

      accountId,

      telegramId,

      telegramUsername:
        clean(
          telegram.username
        ),

      telegramDisplayName:
        clean(
          telegram.displayName
        ),

      walletPublicKey:
        clean(
          payload.walletPublicKey
        )

    };

  }


  function applyAuthenticatedAccount(
    payload,
    reason
  ) {

    const account =
      normalizeAccount(
        payload
      );


    if (!account) {

      state.authenticated =
        false;


      state.lastError =
        "invalid_account_payload";


      emit(
        "error"
      );


      return false;

    }


    state.authenticated =
      true;


    state.accountId =
      account.accountId;


    state.telegramId =
      account.telegramId;


    state.telegramUsername =
      account.telegramUsername;


    state.telegramDisplayName =
      account.telegramDisplayName;


    state.walletPublicKey =
      account.walletPublicKey;


    state.lastError =
      "";


    emit(
      reason
    );


    return true;

  }


  function clearSessionState(
    reason = "logout"
  ) {

    state.authenticated =
      false;


    state.loading =
      false;


    state.accountId =
      "";


    state.telegramId =
      "";


    state.telegramUsername =
      "";


    state.telegramDisplayName =
      "";


    state.walletPublicKey =
      "";


    state.lastError =
      "";


    emit(
      reason
    );

  }


  async function requestJSON(
    url,
    options = {}
  ) {

    const response =
      await fetch(
        url,
        {

          credentials:
            "include",

          headers: {

            "Content-Type":
              "application/json",

            ...(
              options.headers ||
              {}
            )

          },

          ...options

        }
      );


    let body =
      null;


    try {

      body =
        await response.json();

    } catch {
      body = null;
    }


    return {

      ok:
        response.ok,

      status:
        response.status,

      body

    };

  }


  /*
   * =========================================================
   * REAL TELEGRAM LOGIN
   * =========================================================
   */
  async function signInWithTelegram() {

    const config =
      getConfigStatus();


    if (
      !config.ready
    ) {

      return {

        ok:
          false,

        reason:
          "backend_not_configured"

      };

    }


    const initData =
      clean(
        window.Telegram
          ?.WebApp
          ?.initData
      );


    /*
     * Send signed raw initData.
     *
     * Do NOT send only
     * initDataUnsafe.user.
     */
    if (!initData) {

      return {

        ok:
          false,

        reason:
          "telegram_context_missing"

      };

    }


    state.loading =
      true;


    state.lastError =
      "";


    emit(
      "login-start"
    );


    try {

      const result =
        await requestJSON(

          config.telegramLoginEndpoint,

          {

            method:
              "POST",

            body:
              JSON.stringify({

                initData

              })

          }

        );


      state.loading =
        false;


      if (
        !result.ok
      ) {

        state.lastError =
          result.status === 401

            ? "telegram_verification_failed"

            : "backend_login_failed";


        emit(
          "error"
        );


        return {

          ok:
            false,

          reason:
            state.lastError,

          status:
            result.status

        };

      }


      if (
        !applyAuthenticatedAccount(
          result.body?.account,
          "login"
        )
      ) {

        return {

          ok:
            false,

          reason:
            "invalid_account_payload"

        };

      }


      return {

        ok:
          true,

        state:
          snapshot()

      };

    } catch {

      state.loading =
        false;


      state.lastError =
        "network_error";


      emit(
        "error"
      );


      return {

        ok:
          false,

        reason:
          "network_error"

      };

    }

  }


  /*
   * =========================================================
   * SESSION RESTORE
   * =========================================================
   *
   * Browser never reads session secret.
   *
   * Cookie is automatically sent
   * through credentials: include.
   */
  async function restoreSession() {

    const config =
      getConfigStatus();


    if (
      !config.ready
    ) {

      return {

        ok:
          false,

        reason:
          "backend_not_configured"

      };

    }


    try {

      const result =
        await requestJSON(

          config.sessionEndpoint,

          {
            method:
              "GET"
          }

        );


      if (
        result.status === 401
      ) {

        clearSessionState(
          "no-session"
        );


        return {

          ok:
            false,

          reason:
            "not_authenticated"

        };

      }


      if (
        !result.ok
      ) {

        return {

          ok:
            false,

          reason:
            "session_request_failed"

        };

      }


      if (
        !applyAuthenticatedAccount(
          result.body?.account,
          "session-restored"
        )
      ) {

        return {

          ok:
            false,

          reason:
            "invalid_account_payload"

        };

      }


      return {

        ok:
          true,

        state:
          snapshot()

      };

    } catch {

      return {

        ok:
          false,

        reason:
          "network_error"

      };

    }

  }


  /*
   * =========================================================
   * WALLET ACCOUNT BINDING
   * =========================================================
   */
  async function bindWallet(
    publicKey
  ) {

    const config =
      getConfigStatus();


  if (
  !config.walletBindingReady
) {

  return {

    ok:
      false,

    reason:
      "wallet_binding_not_configured"

  };

}


    if (
      state.authenticated !==
        true
    ) {

      return {

        ok:
          false,

        reason:
          "authentication_required"

      };

    }


    const wallet =
      clean(
        publicKey
      );


    const isAddress =
      window.LAGO_TOKEN_CONFIG
        ?.isBase58Address;


    if (
      !wallet ||
      (
        typeof isAddress ===
          "function" &&
        !isAddress(
          wallet
        )
      )
    ) {

      return {

        ok:
          false,

        reason:
          "invalid_wallet"

      };

    }


    try {

      const result =
        await requestJSON(

          config.walletBindEndpoint,

          {

            method:
              "POST",

            body:
              JSON.stringify({

                publicKey:
                  wallet

              })

          }

        );


      if (
        !result.ok
      ) {

        return {

          ok:
            false,

          reason:
            result.status === 409

              ? "wallet_already_bound"

              : "wallet_bind_failed",

          status:
            result.status

        };

      }


      if (
        !applyAuthenticatedAccount(
          result.body?.account,
          "wallet-bound"
        )
      ) {

        return {

          ok:
            false,

          reason:
            "invalid_account_payload"

        };

      }


      return {

        ok:
          true,

        state:
          snapshot()

      };

    } catch {

      return {

        ok:
          false,

        reason:
          "network_error"

      };

    }

  }


  async function logout() {

    const config =
      getConfigStatus();


    if (
      !config.ready
    ) {

      clearSessionState(
        "logout"
      );


      return {

        ok:
          false,

        reason:
          "backend_not_configured"

      };

    }


    try {

      await requestJSON(

        config.logoutEndpoint,

        {
          method:
            "POST"
        }

      );

    } catch {
      // Local state still clears.
    }


    clearSessionState(
      "logout"
    );


    return {
      ok:
        true
    };

  }


  function getState() {

    getConfigStatus();


    return snapshot();

  }


  window.LAGO_AUTH_BACKEND =
    Object.freeze({

      version:
        VERSION,

      getState,

      getConfigStatus,

      signInWithTelegram,

      restoreSession,

      bindWallet,

      logout

    });


  /*
   * Fail closed.
   *
   * Until endpoints are configured
   * this performs no authentication.
   */
  restoreSession();

})();

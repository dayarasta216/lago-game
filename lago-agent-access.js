(() => {
  "use strict";

  /*
   * LAGO GAME
   * R2.7H1 — CLIENT SUBSCRIPTION INTEGRATION
   *
   * Server-authoritative billing state.
   * Account-scoped subscription.
   * In-memory state only.
   * Stale response protection.
   *
   * No local AI activation.
   * No automatic payments.
   * No trading authorization.
   */

  const VERSION = 3;

  const STATE_ENDPOINT =
    "/api/subscription/state";

  const REQUEST_TIMEOUT_MS = 10000;

  const REFRESH_INTERVAL_MS = 30000;

  const MAX_STATE_AGE_MS = 60000;

  const DAY_MS = 86400000;

  const POLICY = Object.freeze({

    product: "personal-ai-agent",

    billingModel: "subscription",

    billingInterval: "month",

    billingIntervalCount: 1,

    currency: "LAGO",

    network: "solana",

    chainNetwork: "mainnet-beta",

    tokenMint:
      "J9BmsKsS6PH7QGxDWA43YVbsmTxavgFmu5ScSDzWpump",

    subscriptionScope: "account",

    maxActiveAgents: 1,

    autoRenewal: false,

    manualRenewal: true,

    freeTrial: false,

    freeAccess: false,

    unlockWithXP: false,

    unlockWithSP: false,

    preserveCharacterOnExpiry: true,

    preserveMemoryOnExpiry: true,

    preserveProgressOnExpiry: true,

    serverVerificationRequired: true,

    separateTradingAuthorization: true,

    localEntitlementTrusted: false,

    persistentClientCache: false

  });


  const STATUSES = Object.freeze([

    "inactive",
    "active",
    "expired",
    "scheduled"

  ]);


  let snapshot = null;

  let loading = false;

  let reason = "authentication_required";

  let generation = 0;

  let controller = null;

  let refreshTimer = null;

let pageSuspended = false;

let networkOffline = false;

function canRefreshPage() {

  return (

    document.hidden !== true &&

    pageSuspended !== true &&

    networkOffline !== true &&

    window.navigator?.onLine !== false

  );

}

  /*
   * SERVER ACCOUNT IDENTITY
   */

  function getAuthenticatedAccountId() {

    try {

      const auth =
        window.LAGO_AUTH_BACKEND?.getState?.();

      if (

        auth?.authenticated !== true ||

        auth.loading === true ||

        Boolean(auth.lastError) ||

        typeof auth.accountId !== "string" ||

        !/^lago_[A-Za-z0-9_-]{22}$/.test(
          auth.accountId
        )

      ) {

        return null;

      }

      return auth.accountId;

    } catch {

      return null;

    }

  }


  /*
   * CURRENT GAME CHARACTER
   *
   * Character switching does not
   * change account billing history.
   */

  function getCharacter() {

    const context =
      window.LAGO_MINIGAMES?.getContext?.();

    return {

      id: String(
        context?.characterId || "lago"
      ),

      name: String(
        context?.characterName || "Lago"
      )

    };

  }


  /*
   * CANONICAL SERVER TIMESTAMPS
   */

  function timestamp(value) {

    if (typeof value !== "string") {
      return null;
    }

    const parsed = Date.parse(value);

    if (!Number.isFinite(parsed)) {
      return null;
    }

    if (
      new Date(parsed).toISOString() !== value
    ) {
      return null;
    }

    return parsed;

  }


  function monotonicTime() {

    return typeof window.performance?.now ===
      "function"

      ? window.performance.now()

      : Date.now();

  }


  /*
   * VALIDATE SERVER RESPONSE
   *
   * Accept billing information only.
   * Ignore operational AI permissions.
   */

 function normalizeSubscription(
    state,
    accountId,
    requestStartedAt
  ) {

    if (

      state?.ok !== true ||

      state.accountId !== accountId ||

      state.product !== POLICY.product ||

      state.billingModel !== "subscription" ||

      state.billingInterval !== "month" ||

      state.billingIntervalCount !== 1 ||

      state.subscriptionScope !== "account" ||

      state.maxActiveAgents !== 1 ||

      state.currency !== POLICY.currency ||

      state.tokenMint !== POLICY.tokenMint ||

      state.chain !== "solana" ||

      state.network !== POLICY.chainNetwork ||

      state.autoRenewal !== false ||

      typeof state.serverVerified !== "boolean" ||

      typeof state.entitled !== "boolean" ||

      state.subscriptionEntitlementGranted !==
        state.entitled ||

      !STATUSES.includes(state.status) ||

      state.subscriptionStatus !== state.status

    ) {

      return null;

    }


    const checkedAt =
      timestamp(state.checkedAt);

    if (checkedAt === null) {
      return null;
    }

    const active =
      state.status === "active";

    const expectedEntitlement =
      active && state.serverVerified === true;

    if (
      state.entitled !== expectedEntitlement
    ) {

      return null;

    }


    if (active) {

      const start =
        timestamp(state.currentPeriodStart);

      const end =
        timestamp(state.currentPeriodEnd);

      const paidThrough =
        timestamp(state.paidThrough);

      const latest =
        timestamp(state.latestPeriodEnd);

      if (

        start === null ||

        end === null ||

        paidThrough === null ||

        latest === null ||

        start > checkedAt ||

        checkedAt >= end ||

        end <= start ||

        paidThrough < end ||

        latest < paidThrough

      ) {

        return null;

      }

    } else {

      if (

        state.currentPeriodStart !== null ||

        state.currentPeriodEnd !== null ||

        state.paidThrough !== null

      ) {

        return null;

      }

      if (state.status === "inactive") {

        if (state.latestPeriodEnd !== null) {
          return null;
        }

      } else {

        const latest =
          timestamp(state.latestPeriodEnd);

        if (latest === null) {
          return null;
        }

        if (

          state.status === "expired" &&
          latest > checkedAt

        ) {

          return null;

        }

        if (

          state.status === "scheduled" &&
          latest <= checkedAt

        ) {

          return null;

        }

      }

    }


    return Object.freeze({

      accountId,

      status: state.status,

      serverVerified:
        state.serverVerified,

      entitled:
        expectedEntitlement,

      currentPeriodStart:
        state.currentPeriodStart,

      currentPeriodEnd:
        state.currentPeriodEnd,

      paidThrough:
        state.paidThrough,

      latestPeriodEnd:
        state.latestPeriodEnd,

      checkedAt,

      requestStartedAt
    });

  }


  /*
   * FRESH ACCOUNT-SCOPED SNAPSHOT
   */

  function getFreshSnapshot() {

  if (!snapshot || !canRefreshPage()) {
  return null;
}

    const accountId =
      getAuthenticatedAccountId();

    if (
      !accountId ||
      accountId !== snapshot.accountId
    ) {

      return null;

    }

   const age =
  monotonicTime() - snapshot.requestStartedAt;

    if (

      !Number.isFinite(age) ||

      age < 0 ||

      age >= MAX_STATE_AGE_MS

    ) {

      return null;

    }

    const estimatedServerTime =
      snapshot.checkedAt + age;

    if (

      snapshot.status === "active" &&

      estimatedServerTime >=
        timestamp(snapshot.currentPeriodEnd)

    ) {

      return null;

    }

    return {

      state: snapshot,

      estimatedServerTime

    };

  }


  /*
   * PUBLIC CLIENT STATE
   *
   * Compatibility with existing
   * agent chat and context modules.
   */

  function getState() {

    const character =
      getCharacter();

    const accountId =
      getAuthenticatedAccountId();

    const fresh =
      getFreshSnapshot();

    const subscription =
      fresh?.state || null;

    const entitled =
      subscription?.entitled === true;

    let stateReason;

    if (!accountId) {

      stateReason =
        "authentication_required";

    } else if (loading) {

      stateReason =
        "subscription_loading";

    } else if (!subscription) {

      stateReason = snapshot

        ? "subscription_refresh_required"

        : reason;

    } else if (entitled) {

      stateReason =
        "ai_service_unavailable";

    } else if (
      subscription.serverVerified !== true
    ) {

      stateReason =
        "subscription_entitlement_disabled";

    } else if (
      subscription.status === "expired"
    ) {

      stateReason =
        "subscription_expired";

    } else if (
      subscription.status === "scheduled"
    ) {

      stateReason =
        "subscription_not_started";

    } else {

      stateReason =
        "active_subscription_required";

    }


    return Object.freeze({

      version: VERSION,

      product: POLICY.product,

      billingModel: POLICY.billingModel,

      billingInterval: POLICY.billingInterval,

      billingIntervalCount: 1,

      subscriptionScope: "account",

      maxActiveAgents: 1,

      accountId,

      authenticated:
        accountId !== null,

      loading,

      subscriptionStateAvailable:
        subscription !== null,

      subscriptionStatus:

        subscription?.status ||

        (
          accountId
            ? "unavailable"
            : "inactive"
        ),

      subscriptionId: null,

      subscriptionStartedAt: null,

      currentPeriodStart:
        subscription?.currentPeriodStart || null,

      currentPeriodEnd:
        subscription?.currentPeriodEnd || null,

      paidThrough:
        subscription?.paidThrough || null,

      latestPeriodEnd:
        subscription?.latestPeriodEnd || null,

      daysRemaining:

        subscription?.status === "active"

          ? Math.max(

              0,

              Math.ceil(

                (

                  timestamp(
                    subscription.paidThrough
                  ) -

                  fresh.estimatedServerTime

                ) / DAY_MS

              )

            )

          : subscription
            ? 0
            : null,

      nextBillingAt: null,

      autoRenewal: false,

      manualRenewal: true,

      renewalAvailable: false,

      status: "locked",

      serverVerified:
        subscription?.serverVerified === true,

      entitled,

      subscriptionEntitlementGranted:
        entitled,

      /*
       * Runtime authorization remains
       * separate from billing entitlement.
       */

      aiEnabled: false,

      chatEnabled: false,

      memoryEnabled: false,

      learningEnabled: false,

      marketAnalysisEnabled: false,

      tradingEnabled: false,

      tradingAuthorized: false,

      characterId: character.id,

      characterName: character.name,

      currency: POLICY.currency,

      tokenMint: POLICY.tokenMint,

      network: POLICY.network,

      chainNetwork: POLICY.chainNetwork,

      checkoutAvailable: false,

      price: null,

      preserveCharacterOnExpiry: true,

      preserveMemoryOnExpiry: true,

      preserveProgressOnExpiry: true,

      reason: stateReason

    });

  }


  function emit() {

    document.dispatchEvent(

      new CustomEvent(
        "lago:agent-access-state",
        { detail: getState() }
      )

    );

  }


  /*
   * CANCEL OLD REQUESTS
   */

  function clearRefreshTimer() {

    if (refreshTimer !== null) {

      window.clearTimeout?.(
        refreshTimer
      );

      refreshTimer = null;

    }

  }


  function invalidate(
    nextReason = "subscription_refresh_required"
  ) {

    generation++;

    controller?.abort();

    controller = null;

    clearRefreshTimer();

    snapshot = null;

    loading = false;

    reason = nextReason;

  }


  /*
   * PERIODIC REFRESH
   *
   * Refresh only authenticated,
   * visible clients.
   */

 function scheduleRefresh() {

  clearRefreshTimer();

  if (
    !getAuthenticatedAccountId() ||
    !canRefreshPage() ||
    typeof window.setTimeout !== "function"
  ) {

    return;

  }

  refreshTimer = window.setTimeout(() => {

    refreshTimer = null;

    if (canRefreshPage()) {
      void refresh();
    }

  }, REFRESH_INTERVAL_MS);

}


/*
 * R2.7H1B
 * Abortable asynchronous operation.
 *
 * Cancellation works even when
 * the transport ignores its signal.
 */

async function awaitAbortable(
  operation,
  signal
) {

  if (signal.aborted) {
    throw new Error("request_aborted");
  }

  let onAbort;

  const cancelled = new Promise((_, reject) => {

    onAbort = () => {

      reject(
        new Error("request_aborted")
      );

    };

    signal.addEventListener(
      "abort",
      onAbort,
      { once: true }
    );

  });

  try {

    const task = new Promise(resolve => {

      resolve(operation());

    });

    return await Promise.race([
      task,
      cancelled
    ]);

  } finally {

    signal.removeEventListener(
      "abort",
      onAbort
    );

  }

}


/*
 * FETCH AND VALIDATE SERVER RESPONSE
 */

async function fetchSubscription(
  accountId,
  signal,
  requestStartedAt
) {

  const response = await awaitAbortable(

    () => window.fetch(

      STATE_ENDPOINT,

      {

        method: "GET",

        credentials: "same-origin",

        cache: "no-store",

        redirect: "error",

        headers: {

          Accept: "application/json"

        },

        signal

      }

    ),

    signal

  );

  if (response.status === 401) {

    return {

      snapshot: null,

      reason: "authentication_required"

    };

  }

  if (!response.ok) {

    return {

      snapshot: null,

      reason: "subscription_service_unavailable"

    };

  }

  const contentType =
    response.headers
      .get("content-type") || "";

  if (

    contentType
      .split(";")[0]
      .trim()
      .toLowerCase() !== "application/json"

  ) {

    return {

      snapshot: null,

      reason: "invalid_subscription_response"

    };

  }

  const body = await awaitAbortable(

    () => response.json(),

    signal

  );

  const normalized =
    body?.ok === true

      ? normalizeSubscription(

          body.subscription,

          accountId,

          requestStartedAt

        )

      : null;

  if (!normalized) {

    return {

      snapshot: null,

      reason: "invalid_subscription_response"

    };

  }

  return {

    snapshot: normalized,

    reason: null

  };

}


/*
 * AUTHENTICATED SUBSCRIPTION REFRESH
 */

async function refresh() {

  invalidate();

  const accountId =
    getAuthenticatedAccountId();

  if (!accountId) {

    reason = "authentication_required";

    emit();

    return getState();

  }

  if (!canRefreshPage()) {

    reason = networkOffline ||
      window.navigator?.onLine === false

        ? "subscription_service_unavailable"

        : "subscription_refresh_required";

    emit();

    return getState();

  }

  if (

    typeof window.fetch !== "function" ||

    typeof window.AbortController !==
      "function" ||

    typeof window.setTimeout !==
      "function" ||

    typeof window.clearTimeout !==
      "function"

  ) {

    reason = "subscription_service_unavailable";

    emit();

    return getState();

  }


  const requestGeneration =
    generation;

  const requestController =
    new window.AbortController();

  const requestStartedAt =
    monotonicTime();

  controller = requestController;

  loading = true;

  let timeout = null;


  try {

    timeout = window.setTimeout(() => {

      requestController.abort();

    }, REQUEST_TIMEOUT_MS);

    emit();

    const result =
      await fetchSubscription(

        accountId,

        requestController.signal,

        requestStartedAt

      );


    /*
     * Reject obsolete requests.
     */

    if (generation === requestGeneration) {

      const elapsed =
        monotonicTime() - requestStartedAt;

      if (

        getAuthenticatedAccountId() !==
          accountId ||

        !canRefreshPage()

      ) {

        snapshot = null;

        reason = "subscription_refresh_required";

      } else if (

        requestController.signal.aborted ||

        !Number.isFinite(elapsed) ||

        elapsed < 0 ||

        elapsed >= REQUEST_TIMEOUT_MS

      ) {

        snapshot = null;

        reason = "subscription_request_timeout";

      } else {

        snapshot = result.snapshot;

        reason = result.reason;

      }

    }

  } catch {

    if (generation === requestGeneration) {

      snapshot = null;

      reason =
        requestController.signal.aborted

          ? "subscription_request_timeout"

          : "subscription_service_unavailable";

    }

  } finally {

    if (timeout !== null) {

      window.clearTimeout(timeout);

    }

    if (generation === requestGeneration) {

      controller = null;

      loading = false;

      emit();

      /*
       * An event listener may start
       * a newer refresh synchronously.
       */

      if (generation === requestGeneration) {

        scheduleRefresh();

      }

    }

  }


  /*
   * Return only the final state,
   * after loading has been cleared.
   */

  return getState();

}

  /*
   * AUTHENTICATION CHANGES
   *
   * Never retain the previous account's
   * subscription after logout or switch.
   */

  function handleAuthChange() {

    void refresh();

  }


  /*
   * CHARACTER CHANGES
   *
   * Billing belongs to the account.
   * No additional payment is created.
   */

  function handleCharacterChange() {

    emit();

  }


  function handleVisibilityChange() {

    if (document.hidden === true) {

      invalidate(
        "subscription_refresh_required"
      );

      emit();

      return;

    }

    void refresh();

  }


  document.addEventListener(

    "lago:backend-auth-state",

    handleAuthChange

  );

  document.addEventListener(

    "lago:character-equipped",

    handleCharacterChange

  );

  document.addEventListener(

    "visibilitychange",

    handleVisibilityChange

  );

 window.addEventListener?.(

  "pageshow",

  () => {

    pageSuspended = false;

    handleVisibilityChange();

  }

);

window.addEventListener?.(

  "pagehide",

  () => {

    pageSuspended = true;

    invalidate();

    emit();

  }

);

window.addEventListener?.(

  "online",

  () => {

    networkOffline = false;

    if (canRefreshPage()) {

      void refresh();

    }

  }

);

window.addEventListener?.(

  "offline",

  () => {

    networkOffline = true;

    invalidate(
      "subscription_service_unavailable"
    );

    emit();

  }

);

  /*
   * PUBLIC CLIENT API
   */

  window.LAGO_AGENT_ACCESS =
    Object.freeze({

      version: VERSION,

      getState,

      refresh,

      getPolicy() {

        return POLICY;

      },

      canUseAI() {

        return false;

      },

      canTrade() {

        return false;

      }

    });


  document.dispatchEvent(

    new CustomEvent(

      "lago:agent-access-ready",

      { detail: getState() }

    )

  );


  /*
   * Restore server billing state
   * when an authenticated session
   * is already available.
   */

  if (getAuthenticatedAccountId()) {

    void refresh();

  }

})();

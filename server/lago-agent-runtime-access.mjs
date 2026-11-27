import { performance } from "node:perf_hooks";
import {
  createMemoryIdentity,
  validAccountId,
  validCharacterId
} from "./lago-agent-memory-contract.mjs";

import {
  SUBSCRIPTION_POLICY
} from "./lago-agent-subscription-contract.mjs";

/*
 * LAGO GAME
 * R2.8A — AI RUNTIME AUTHORIZATION
 *
 * One account.
 * One active personal agent.
 * Server-authorized AI operations.
 *
 * Disabled by default.
 * No memory authorization.
 * No external model training.
 * No trading authorization.
 */

export const RUNTIME_ACCESS_VERSION = 1;

const MAX_DECISION_AGE_MS = 5000;

const ACTIONS = Object.freeze([
  "chat",
  "market_analysis"
]);

const POLICY = Object.freeze({
  subscriptionRequired: true,
  billingInterval: "month",
  maxActiveAgents: 1,
  authenticatedAccountRequired: true,
  characterOwnershipRequired: true,
  activeCharacterRequired: true,
  runtimeEnabledByDefault: false,
  memoryAuthorizationSeparate: true,
  tradingAuthorizationSeparate: true,
  externalModelTrainingEnabled: false,
  clientPermissionsTrusted: false,
  maxDecisionAgeMs: MAX_DECISION_AGE_MS,
verificationTimeoutMs: MAX_DECISION_AGE_MS,
sharedVerificationDeadline: true,
monotonicClockRequired: true,
providerCancellationSupported: true,
verificationLatencyConsumesDecisionLifetime: true,
failClosed: true
});

function deny(reason) {
  return Object.freeze({
    ok: false,
    authorized: false,
    runtimeAuthorized: false,
    identity: null,
    action: null,
    memoryAuthorized: false,
    tradingAuthorized: false,
    externalModelTrainingAuthorized: false,
    reason
  });
}

function parseTimestamp(value) {
  if (typeof value !== "string") {
    return null;
  }

  const time = Date.parse(value);

  if (
    !Number.isFinite(time) ||
    new Date(time).toISOString() !== value
  ) {
    return null;
  }

  return time;
}

function validClock(value) {
  return (
    Number.isSafeInteger(value) &&
    Number.isFinite(new Date(value).getTime())
  );
}

function normalizeSession(session, timestamp) {
  if (
    session?.ok !== true ||
    !validAccountId(session.account?.accountId)
  ) {
    return null;
  }

  const expiresAt = parseTimestamp(
    session.expiresAt
  );

  if (
    expiresAt === null ||
    expiresAt <= timestamp
  ) {
    return null;
  }

  return Object.freeze({
    accountId: session.account.accountId,
    expiresAt
  });
}

function characterAllowed(
  access,
  accountId,
  characterId
) {
  return Boolean(
    access?.serverVerified === true &&
    access.accountId === accountId &&
    access.characterId === characterId &&
    access.owned === true &&
    access.activeCharacterId === characterId
  );
}


/*
 * VERIFIED SUBSCRIPTION CONTRACT
 */

function normalizeSubscription(
  subscription,
  accountId,
  timestamp
) {
  if (
    subscription?.ok !== true ||
    subscription.accountId !== accountId ||
    subscription.serverVerified !== true ||
    subscription.entitled !== true ||
    subscription.subscriptionEntitlementGranted !== true ||
    subscription.status !== "active" ||
    subscription.subscriptionStatus !== "active" ||
    subscription.product !== SUBSCRIPTION_POLICY.product ||
    subscription.billingModel !== "subscription" ||
    subscription.billingInterval !== "month" ||
    subscription.billingIntervalCount !== 1 ||
    subscription.subscriptionScope !== "account" ||
    subscription.maxActiveAgents !== 1 ||
    subscription.currency !== SUBSCRIPTION_POLICY.currency ||
    subscription.chain !== SUBSCRIPTION_POLICY.chain ||
    subscription.network !== SUBSCRIPTION_POLICY.network ||
    subscription.tokenMint !== SUBSCRIPTION_POLICY.tokenMint ||
    subscription.autoRenewal !== false
  ) {
    return null;
  }

  const start = parseTimestamp(
    subscription.currentPeriodStart
  );

  const end = parseTimestamp(
    subscription.currentPeriodEnd
  );

  if (
    start === null ||
    end === null ||
    start >= end ||
    start > timestamp ||
    timestamp >= end
  ) {
    return null;
  }

  return Object.freeze({
    start,
    end
  });
}

/*
 * R2.8A2 — VERIFICATION DEADLINE
 *
 * One shared time budget for all providers.
 * Independent monotonic clock.
 * Abortable provider waiting.
 */

const VERIFICATION_TIMEOUT = Symbol(
  "runtime_verification_timeout"
);

const INVALID_RUNTIME_CLOCK = Symbol(
  "invalid_runtime_clock"
);

function createVerificationDeadline(
  now,
  startedAt
) {

  const monotonicStart = performance.now();

  const controller = new AbortController();

  let lastCheckedAt = startedAt;

  const timer = setTimeout(() => {

    controller.abort();

  }, MAX_DECISION_AGE_MS);


  function check() {

    const current = now();

    if (
      !validClock(current) ||
      current < lastCheckedAt
    ) {

      throw INVALID_RUNTIME_CLOCK;

    }

    lastCheckedAt = current;

    const elapsed =
      performance.now() - monotonicStart;

    if (
      controller.signal.aborted ||
      current - startedAt >= MAX_DECISION_AGE_MS ||
      !Number.isFinite(elapsed) ||
      elapsed < 0 ||
      elapsed >= MAX_DECISION_AGE_MS
    ) {

      controller.abort();

      throw VERIFICATION_TIMEOUT;

    }

    return current;

  }


  async function run(operation) {

    check();

    const signal = controller.signal;

    let onAbort;

    const cancelled = new Promise((_, reject) => {

      onAbort = () => {

        reject(VERIFICATION_TIMEOUT);

      };

      signal.addEventListener(
        "abort",
        onAbort,
        { once: true }
      );

    });

    try {

      const task = Promise.resolve().then(() => {

        check();

        return operation(signal);

      });

      const result = await Promise.race([
        task,
        cancelled
      ]);

      check();

      return result;

    } finally {

      signal.removeEventListener(
        "abort",
        onAbort
      );

    }

  }


  function getRemainingTime() {

    const current = check();

    const monotonicElapsed =
      performance.now() - monotonicStart;

    return Math.max(

      0,

      Math.floor(

        Math.min(

          MAX_DECISION_AGE_MS -
            (current - startedAt),

          MAX_DECISION_AGE_MS -
            monotonicElapsed

        )

      )

    );

  }


  function close() {

    clearTimeout(timer);

  }

  return Object.freeze({
    check,
    run,
    getRemainingTime,
    close
  });

}

/*
 * SERVER RUNTIME ACCESS FACTORY
 */

export function createLagoRuntimeAccess({
  sessionStore,
  getCharacterAccess = null,
  getSubscription = null,
  runtimeEnabled = false,
  now = () => Date.now()
} = {}) {

  if (
    typeof sessionStore?.restoreSession !== "function"
  ) {
    throw new Error("runtime_session_store_required");
  }

  if (
    typeof runtimeEnabled !== "boolean" ||
    typeof now !== "function"
  ) {
    throw new Error("invalid_runtime_configuration");
  }

  if (
    getCharacterAccess !== null &&
    typeof getCharacterAccess !== "function"
  ) {
    throw new Error("invalid_character_access_provider");
  }

  if (
    getSubscription !== null &&
    typeof getSubscription !== "function"
  ) {
    throw new Error("invalid_subscription_provider");
  }


  /*
   * AUTHORIZE ONE AI OPERATION
   */

  async function authorize(input = {}) {

  if (
    !input ||
    typeof input !== "object" ||
    Array.isArray(input)
  ) {
    return deny("invalid_runtime_request");
  }

  const {
    sessionToken,
    characterId,
    action
  } = input;

  if (!ACTIONS.includes(action)) {
    return deny("runtime_action_not_allowed");
  }

  if (!validCharacterId(characterId)) {
    return deny("invalid_character");
  }

  if (
    typeof sessionToken !== "string" ||
    sessionToken.trim().length === 0 ||
    sessionToken.length > 256
  ) {
    return deny("authentication_required");
  }

  if (!runtimeEnabled) {
    return deny("runtime_disabled");
  }

  if (
    typeof getCharacterAccess !== "function"
  ) {
    return deny("character_access_unavailable");
  }

  if (
    typeof getSubscription !== "function"
  ) {
    return deny("subscription_service_unavailable");
  }

  let deadline = null;

  try {

    /*
     * 1. Start verification deadline
     * before the first provider call.
     */

    const startedAt = now();

    if (!validClock(startedAt)) {
      return deny("invalid_runtime_clock");
    }

    deadline = createVerificationDeadline(
      now,
      startedAt
    );


    /*
     * 2. Authenticate server session.
     */

    const initialSession = await deadline.run(
      signal => sessionStore.restoreSession(
        sessionToken,
        { signal }
      )
    );

    const session = normalizeSession(
      initialSession,
      deadline.check()
    );

    if (!session) {
      return deny("authentication_required");
    }

    const accountId = session.accountId;


    /*
     * 3. Verify active character ownership.
     */

    const characterAccess = await deadline.run(
      signal => getCharacterAccess(
        {
          accountId,
          characterId
        },
        { signal }
      )
    );

    if (
      !characterAllowed(
        characterAccess,
        accountId,
        characterId
      )
    ) {
      return deny("character_access_denied");
    }


    /*
     * 4. Verify account subscription.
     */

    const subscription = await deadline.run(
      signal => getSubscription(
        { accountId },
        { signal }
      )
    );

    const checkedAt = deadline.check();

    const billing = normalizeSubscription(
      subscription,
      accountId,
      checkedAt
    );

    if (!billing) {
      return deny("active_subscription_required");
    }


    /*
     * 5. Recheck active character.
     */

    const currentAccess = await deadline.run(
      signal => getCharacterAccess(
        {
          accountId,
          characterId
        },
        { signal }
      )
    );

    if (
      !characterAllowed(
        currentAccess,
        accountId,
        characterId
      )
    ) {
      return deny("character_context_changed");
    }


    /*
     * 6. Recheck session after verification.
     */

    const restoredSession = await deadline.run(
      signal => sessionStore.restoreSession(
        sessionToken,
        { signal }
      )
    );

    const finishedAt = deadline.check();

    const currentSession = normalizeSession(
      restoredSession,
      finishedAt
    );

    if (
      !currentSession ||
      currentSession.accountId !== accountId ||
      session.expiresAt <= finishedAt
    ) {
      return deny("runtime_session_changed");
    }

    if (
      finishedAt < billing.start ||
      finishedAt >= billing.end
    ) {
      return deny("subscription_expired");
    }


    /*
     * 7. Create canonical agent identity.
     */

    const identity = createMemoryIdentity(
      accountId,
      characterId
    );

    if (!identity) {
      return deny("invalid_agent_identity");
    }


    /*
     * 8. Limit decision lifetime.
     *
     * Verification latency consumes
     * the shared authorization budget.
     */

    const remainingTime =
      deadline.getRemainingTime();

    if (remainingTime <= 0) {
      return deny("runtime_verification_timeout");
    }

    const validUntil = Math.min(

      session.expiresAt,

      currentSession.expiresAt,

      billing.end,

      startedAt + MAX_DECISION_AGE_MS,

      finishedAt + remainingTime

    );

    if (validUntil <= finishedAt) {
      return deny("runtime_verification_timeout");
    }


    /*
     * 9. Return scoped authorization.
     */

    return Object.freeze({

      ok: true,

      version: RUNTIME_ACCESS_VERSION,

      authorized: true,

      runtimeAuthorized: true,

      action,

      identity,

      sessionVerified: true,

      characterVerified: true,

      subscriptionVerified: true,

      issuedAt:
        new Date(finishedAt).toISOString(),

      validUntil:
        new Date(validUntil).toISOString(),

      currentPeriodEnd:
        new Date(billing.end).toISOString(),

      memoryAuthorized: false,

      learningAuthorized: false,

      tradingAuthorized: false,

      externalModelTrainingAuthorized: false,

      reason: null

    });

  } catch (error) {

    if (error === VERIFICATION_TIMEOUT) {

      return deny(
        "runtime_verification_timeout"
      );

    }

    if (error === INVALID_RUNTIME_CLOCK) {

      return deny(
        "invalid_runtime_clock"
      );

    }

    return deny(
      "runtime_authorization_unavailable"
    );

  } finally {

    deadline?.close();

  }

}

    if (
      !input ||
      typeof input !== "object" ||
      Array.isArray(input)
    ) {
      return deny("invalid_runtime_request");
    }

    const {
      sessionToken,
      characterId,
      action
    } = input;

    if (!ACTIONS.includes(action)) {
      return deny("runtime_action_not_allowed");
    }

    if (!validCharacterId(characterId)) {
      return deny("invalid_character");
    }

    if (
      typeof sessionToken !== "string" ||
      sessionToken.trim().length === 0 ||
      sessionToken.length > 256
    ) {
      return deny("authentication_required");
    }

    if (!runtimeEnabled) {
      return deny("runtime_disabled");
    }

    if (typeof getCharacterAccess !== "function") {
      return deny("character_access_unavailable");
    }

    if (typeof getSubscription !== "function") {
      return deny("subscription_service_unavailable");
    }

    try {

      /*
       * 1. Restore server-owned session.
       */

      const initialSession =
        await sessionStore.restoreSession(
          sessionToken
        );

      const startedAt = now();

      if (!validClock(startedAt)) {
        return deny("invalid_runtime_clock");
      }

      const session = normalizeSession(
        initialSession,
        startedAt
      );

      if (!session) {
        return deny("authentication_required");
      }

      const accountId = session.accountId;

      /*
       * 2. Verify active character ownership.
       */

      const characterAccess =
        await getCharacterAccess({
          accountId,
          characterId
        });

      if (
        !characterAllowed(
          characterAccess,
          accountId,
          characterId
        )
      ) {
        return deny("character_access_denied");
      }

      /*
       * 3. Verify monthly subscription.
       */

      const subscription =
        await getSubscription({
          accountId
        });

      const checkedAt = now();

      if (
        !validClock(checkedAt) ||
        checkedAt < startedAt
      ) {
        return deny("invalid_runtime_clock");
      }

      const billing = normalizeSubscription(
        subscription,
        accountId,
        checkedAt
      );

      if (!billing) {
        return deny("active_subscription_required");
      }

      /*
       * 4. Recheck character selection.
       */

      const currentAccess =
        await getCharacterAccess({
          accountId,
          characterId
        });

      if (
        !characterAllowed(
          currentAccess,
          accountId,
          characterId
        )
      ) {
        return deny("character_context_changed");
      }

      /*
       * 5. Recheck session after async operations.
       */

      const restoredSession =
        await sessionStore.restoreSession(
          sessionToken
        );

      const finishedAt = now();

      if (
        !validClock(finishedAt) ||
        finishedAt < checkedAt
      ) {
        return deny("invalid_runtime_clock");
      }

      if (
        finishedAt - startedAt >=
        MAX_DECISION_AGE_MS
      ) {
        return deny("runtime_verification_timeout");
      }

      const currentSession = normalizeSession(
        restoredSession,
        finishedAt
      );

      if (
        !currentSession ||
        currentSession.accountId !== accountId ||
        session.expiresAt <= finishedAt
      ) {
        return deny("runtime_session_changed");
      }

      if (
        finishedAt < billing.start ||
        finishedAt >= billing.end
      ) {
        return deny("subscription_expired");
      }

      /*
       * 6. Create canonical agent identity.
       */

      const identity = createMemoryIdentity(
        accountId,
        characterId
      );

      if (!identity) {
        return deny("invalid_agent_identity");
      }

      /*
       * 7. Short-lived authorization decision.
       *
       * Internal server result.
       * Not a transferable access token.
       */

      const validUntil = Math.min(
        session.expiresAt,
        currentSession.expiresAt,
        billing.end,
        finishedAt + MAX_DECISION_AGE_MS
      );

      return Object.freeze({
        ok: true,
        version: RUNTIME_ACCESS_VERSION,

        authorized: true,
        runtimeAuthorized: true,

        action,
        identity,

        sessionVerified: true,
        characterVerified: true,
        subscriptionVerified: true,

        issuedAt:
          new Date(finishedAt).toISOString(),

        validUntil:
          new Date(validUntil).toISOString(),

        currentPeriodEnd:
          new Date(billing.end).toISOString(),

        memoryAuthorized: false,
        learningAuthorized: false,
        tradingAuthorized: false,
        externalModelTrainingAuthorized: false,

        reason: null
      });

    } catch {

      return deny(
        "runtime_authorization_unavailable"
      );

    }

  }

  return Object.freeze({
    version: RUNTIME_ACCESS_VERSION,

    authorize,

    getActions() {
      return ACTIONS;
    },

    getPolicy() {
      return Object.freeze({
        ...POLICY,
        runtimeEnabled
      });
    }
  });

}

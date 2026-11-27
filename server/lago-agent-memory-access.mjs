
import {
  createMemoryIdentity,
  validCharacterId,
  validAccountId,
  validMemoryCategory
} from "./lago-agent-memory-contract.mjs";


/*
 * LAGO GAME
 * R2.6E3 — SERVER MEMORY ACCESS CONTROL
 *
 * Server session authentication.
 * Character ownership verification.
 * Consent verification.
 * Monthly subscription verification.
 *
 * Fail closed by default.
 *
 * All verification providers must
 * originate from trusted server services.
 */

export const MEMORY_ACCESS_VERSION = 1;


const OWNER_ACTIONS = Object.freeze([

  "review",

  "export",

  "delete",

  "clear"

]);


const AI_ACTIONS = Object.freeze([

  "collect",

  "recall",

  "learn"

]);


const POLICY = Object.freeze({

  serverAuthenticationRequired: true,

  characterAccessRequired: true,

  activeCharacterRequiredForAI: true,

  explicitConsentRequiredForAI: true,

  monthlySubscriptionRequiredForAI: true,

  subscriptionRequiredForOwnerManagement: false,

  preserveMemoryOnExpiry: true,

  maxActiveAgents: 1,

  trustClientAccountId: false,

  trustClientSubscription: false,

  trustClientConsent: false,

  externalModelTrainingEnabled: false,

  tradingAuthorizationGranted: false,

  failClosed: true

});


/*
 * REJECTION RESULT
 */

function deny(reason) {

  return Object.freeze({

    ok: false,

    authorized: false,

    reason,

    identity: null,

    tradingAuthorized: false

  });

}


/*
 * TIMESTAMP VALIDATION
 */

function validTimestamp(value) {

  return (

    typeof value === "string" &&

    Number.isFinite(Date.parse(value))

  );

}


function validSubscription(

  subscription,

  accountId,

  timestamp

) {

  if (

    !subscription ||

    subscription.accountId !== accountId ||

    subscription.serverVerified !== true ||

    subscription.status !== "active" ||

    subscription.billingModel !== "subscription" ||

    subscription.billingInterval !== "month" ||

    subscription.billingIntervalCount !== 1 ||

    !validTimestamp(
      subscription.currentPeriodStart
    ) ||

    !validTimestamp(
      subscription.currentPeriodEnd
    )

  ) {

    return false;

  }


  const start =
    Date.parse(
      subscription.currentPeriodStart
    );

  const end =
    Date.parse(
      subscription.currentPeriodEnd
    );


  return (

    start <= timestamp &&

    timestamp < end &&

    start < end

  );

}


/*
 * SERVER ACCESS FACTORY
 */

export function createLagoMemoryAccess({

  sessionStore,

  getCharacterAccess = null,

  getConsent = null,

  getSubscription = null,

  now = () => Date.now()

} = {}) {

  if (

    typeof sessionStore?.restoreSession !==
      "function"

  ) {

    throw new Error(
      "session_store_required"
    );

  }


  /*
   * AUTHORIZE ONE MEMORY OPERATION
   *
   * Never accept accountId from
   * the client request.
   */

  async function authorize({

    sessionToken,

    characterId,

    action,

    category = null

  } = {}) {

    const ownerAction =
      OWNER_ACTIONS.includes(action);

    const aiAction =
      AI_ACTIONS.includes(action);


    if (!ownerAction && !aiAction) {

      return deny(
        "invalid_memory_action"
      );

    }


    if (!validCharacterId(characterId)) {

      return deny(
        "invalid_character"
      );

    }


    if (

      aiAction &&

      !validMemoryCategory(category)

    ) {

      return deny(
        "invalid_memory_category"
      );

    }


    if (

      typeof sessionToken !== "string" ||

      sessionToken.trim().length === 0 ||

      sessionToken.length > 256

    ) {

      return deny(
        "authentication_required"
      );

    }


    try {

      /*
       * 1. AUTHENTICATE SESSION
       */

      const session =
        await sessionStore.restoreSession(
          sessionToken
        );


      if (

        session?.ok !== true ||

        !validAccountId(
          session.account?.accountId
        ) ||

        !validTimestamp(
          session.expiresAt
        )

      ) {

        return deny(
          "authentication_required"
        );

      }


      const accountId =
        session.account.accountId;


      const sessionExpiresAt =
        Date.parse(
          session.expiresAt
        );


      if (

        !Number.isFinite(now()) ||

        sessionExpiresAt <= now()

      ) {

        return deny(
          "session_expired"
        );

      }


      /*
       * 2. SERVER CHARACTER ACCESS
       */

      if (

        typeof getCharacterAccess !==
          "function"

      ) {

        return deny(
          "character_access_unavailable"
        );

      }


      const access =
        await getCharacterAccess({

          accountId,

          characterId

        });


      if (

        access?.serverVerified !== true ||

        access.accountId !== accountId ||

        access.characterId !== characterId ||

        access.memoryAccessAllowed !== true

      ) {

        return deny(
          "character_access_denied"
        );

      }


      const identity =
        createMemoryIdentity(

          accountId,

          characterId

        );


      if (!identity) {

        return deny(
          "invalid_memory_identity"
        );

      }


      /*
       * 3. OWNER DATA MANAGEMENT
       *
       * No subscription required.
       * Previously owned character memory
       * may remain accessible to its owner.
       */

      if (ownerAction) {

        if (

          !Number.isFinite(now()) ||

          sessionExpiresAt <= now()

        ) {

          return deny(
            "session_expired"
          );

        }


        return Object.freeze({

          ok: true,

          authorized: true,

          action,

          identity,

          ownerManagement: true,

          subscriptionRequired: false,

          consentRequired: false,

          tradingAuthorized: false

        });

      }


      /*
       * 4. ACTIVE PERSONAL AGENT
       */

      if (

        access.owned !== true ||

        access.activeCharacterId !==
          characterId

      ) {

        return deny(
          "active_character_required"
        );

      }


      /*
       * 5. VERIFY MEMORY CONSENT
       */

      if (

        typeof getConsent !==
          "function"

      ) {

        return deny(
          "consent_service_unavailable"
        );

      }


      const consent =
        await getConsent({

          accountId,

          characterId

        });


      if (

        consent?.serverVerified !== true ||

        consent.accountId !== accountId ||

        consent.characterId !== characterId ||

        consent.granted !== true ||

        !Array.isArray(
          consent.allowedCategories
        ) ||

        !consent.allowedCategories
          .includes(category)

      ) {

        return deny(
          "memory_consent_required"
        );

      }


      /*
       * Learning requires separate
       * explicit owner permission.
       */

      if (

        action === "learn" &&

        consent.learningAllowed !== true

      ) {

        return deny(
          "learning_consent_required"
        );

      }


      /*
       * 6. VERIFY MONTHLY SUBSCRIPTION
       */

      if (

        typeof getSubscription !==
          "function"

      ) {

        return deny(
          "subscription_service_unavailable"
        );

      }


      const subscription =
        await getSubscription({

          accountId

        });


      const timestamp = now();


      if (

        !Number.isFinite(timestamp) ||

        sessionExpiresAt <= timestamp

      ) {

        return deny(
          "session_expired"
        );

      }


      if (

        !validSubscription(

          subscription,

          accountId,

          timestamp

        )

      ) {

        return deny(
          "active_subscription_required"
        );

      }


      /*
       * 7. AUTHORIZE SCOPED AI OPERATION
       *
       * Authorization applies only to
       * this account, character, action
       * and memory category.
       *
       * It does not authorize trading
       * or external model training.
       */

      return Object.freeze({

        ok: true,

        authorized: true,

        action,

        category,

        identity,

        ownerManagement: false,

        subscriptionRequired: true,

        subscriptionVerified: true,

        consentRequired: true,

        consentVerified: true,

        currentPeriodEnd:
          subscription.currentPeriodEnd,

        tradingAuthorized: false,

        externalModelTrainingAuthorized: false

      });

    } catch {

      /*
       * Never expose provider errors,
       * session tokens or private data.
       */

      return deny(
        "memory_authorization_unavailable"
      );

    }

  }


  /*
   * INTERNAL SERVER API
   */

  return Object.freeze({

    version: MEMORY_ACCESS_VERSION,

    authorize,

    getPolicy() {

      return POLICY;

    },

    getOwnerActions() {

      return OWNER_ACTIONS;

    },

    getAIActions() {

      return AI_ACTIONS;

    }

  });

}

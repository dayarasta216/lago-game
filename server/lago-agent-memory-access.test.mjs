
import test from "node:test";
import assert from "node:assert/strict";

import {
  createLagoMemoryAccess
} from "./lago-agent-memory-access.mjs";


/*
 * LAGO GAME
 * R2.6E4 — MEMORY AUTHORIZATION TESTS
 *
 * Synthetic server providers.
 * No production accounts.
 * No real payments.
 */

const ACCOUNT_A =
  "lago_" + "A".repeat(22);

const ACCOUNT_B =
  "lago_" + "B".repeat(22);

const CHARACTER = "lago";

const SESSION_TOKEN =
  "synthetic-test-session";

const NOW =
  Date.parse("2026-11-15T12:00:00.000Z");


/*
 * SERVER PROVIDER FIXTURE
 */

function fixture(overrides = {}) {

  const sessionStore = {

    async restoreSession(token) {

      if (token !== SESSION_TOKEN) {

        return {
          ok: false,
          reason: "invalid_session"
        };

      }

      return {

        ok: true,

        account: {
          accountId: ACCOUNT_A
        },

        expiresAt:
          "2026-12-01T00:00:00.000Z"

      };

    }

  };


  async function getCharacterAccess({

    accountId,
    characterId

  }) {

    return {

      serverVerified: true,

      accountId,

      characterId,

      memoryAccessAllowed: true,

      owned: true,

      activeCharacterId: CHARACTER

    };

  }


  async function getConsent({

    accountId,
    characterId

  }) {

    return {

      serverVerified: true,

      accountId,

      characterId,

      granted: true,

      allowedCategories: [

        "owner",
        "conversation",
        "gameplay",
        "emotional",
        "trading",
        "learning"

      ],

      learningAllowed: true

    };

  }


  async function getSubscription({
    accountId
  }) {

    return {

      accountId,

      serverVerified: true,

      status: "active",

      billingModel: "subscription",

      billingInterval: "month",

      billingIntervalCount: 1,

      currentPeriodStart:
        "2026-11-01T00:00:00.000Z",

      currentPeriodEnd:
        "2026-12-01T00:00:00.000Z"

    };

  }


  const providers = {

    sessionStore,

    getCharacterAccess,

    getConsent,

    getSubscription,

    now: () => NOW,

    ...overrides

  };


  const access =
    createLagoMemoryAccess(providers);


  function authorize(input = {}) {

    return access.authorize({

      sessionToken: SESSION_TOKEN,

      characterId: CHARACTER,

      action: "recall",

      category: "owner",

      ...input

    });

  }


  return {

    access,

    providers,

    authorize

  };

}


function assertDenied(result, reason) {

  assert.equal(result.ok, false);

  assert.equal(result.authorized, false);

  assert.equal(result.identity, null);

  assert.equal(result.tradingAuthorized, false);

  assert.equal(result.reason, reason);

}


/*
 * TEST 01 — FACTORY VALIDATION
 */

test(
  "requires a server session provider",
  () => {

    assert.throws(

      () => createLagoMemoryAccess({}),

      /session_store_required/

    );

  }
);


/*
 * TEST 02 — VALID AI ACCESS
 */

test(
  "authorizes a verified subscribed agent",
  async () => {

    const fx = fixture();

    const result =
      await fx.authorize();

    assert.equal(result.ok, true);

    assert.equal(result.authorized, true);

    assert.equal(
      result.identity.accountId,
      ACCOUNT_A
    );

    assert.equal(
      result.identity.characterId,
      CHARACTER
    );

    assert.equal(
      result.subscriptionVerified,
      true
    );

    assert.equal(
      result.consentVerified,
      true
    );

    assert.equal(
      result.tradingAuthorized,
      false
    );

    assert.equal(
      result.externalModelTrainingAuthorized,
      false
    );

  }
);


/*
 * TEST 03 — INVALID SESSION
 */

test(
  "rejects missing and invalid sessions",
  async () => {

    const fx = fixture();

    for (const token of [

      "",
      null,
      "invalid-session",
      "X".repeat(257)

    ]) {

      assertDenied(

        await fx.authorize({

          sessionToken: token

        }),

        "authentication_required"

      );

    }

  }
);


/*
 * TEST 04 — CLIENT IDENTITY INJECTION
 */

test(
  "ignores client-supplied account identity",
  async () => {

    const fx = fixture();

    const result =
      await fx.authorize({

        accountId: ACCOUNT_B,

        serverVerified: true,

        subscriptionVerified: true,

        consentVerified: true

      });

    assert.equal(result.ok, true);

    assert.equal(

      result.identity.accountId,

      ACCOUNT_A

    );

    assert.notEqual(

      result.identity.accountId,

      ACCOUNT_B

    );

  }
);


/*
 * TEST 05 — INVALID REQUEST
 */

test(
  "rejects invalid actions and categories",
  async () => {

    const fx = fixture();

    assertDenied(

      await fx.authorize({
        action: "admin"
      }),

      "invalid_memory_action"

    );

    assertDenied(

      await fx.authorize({
        characterId: "../private"
      }),

      "invalid_character"

    );

    assertDenied(

      await fx.authorize({
        category: "unknown"
      }),

      "invalid_memory_category"

    );

  }
);


/*
 * TEST 06 — EXPIRED SESSION
 */

test(
  "rejects an expired server session",
  async () => {

    const fx = fixture({

      now: () =>
        Date.parse(
          "2026-12-02T00:00:00.000Z"
        )

    });

    assertDenied(

      await fx.authorize(),

      "session_expired"

    );

  }
);


/*
 * TEST 07 — MISSING CHARACTER SERVICE
 */

test(
  "fails closed without character verification",
  async () => {

    const fx = fixture({

      getCharacterAccess: null

    });

    assertDenied(

      await fx.authorize(),

      "character_access_unavailable"

    );

  }
);


/*
 * TEST 08 — CROSS-ACCOUNT CHARACTER ACCESS
 */

test(
  "rejects character access from another account",
  async () => {

    const fx = fixture({

      async getCharacterAccess() {

        return {

          serverVerified: true,

          accountId: ACCOUNT_B,

          characterId: CHARACTER,

          memoryAccessAllowed: true,

          owned: true,

          activeCharacterId: CHARACTER

        };

      }

    });

    assertDenied(

      await fx.authorize(),

      "character_access_denied"

    );

  }
);


/*
 * TEST 09 — INACTIVE CHARACTER
 */

test(
  "rejects AI recall for an inactive character",
  async () => {

    const fx = fixture();

    assertDenied(

      await fx.authorize({

        characterId: "comic_pink_snail"

      }),

      "active_character_required"

    );

  }
);


/*
 * TEST 10 — UNOWNED CHARACTER
 */

test(
  "rejects AI recall for an unowned character",
  async () => {

    const base = fixture();

    const fx = fixture({

      async getCharacterAccess(input) {

        const access =
          await base.providers
            .getCharacterAccess(input);

        return {

          ...access,

          owned: false

        };

      }

    });

    assertDenied(

      await fx.authorize(),

      "active_character_required"

    );

  }
);


/*
 * TEST 11 — MISSING CONSENT
 */

test(
  "rejects unavailable or revoked consent",
  async () => {

    const unavailable = fixture({

      getConsent: null

    });

    assertDenied(

      await unavailable.authorize(),

      "consent_service_unavailable"

    );


    const base = fixture();

    const revoked = fixture({

      async getConsent(input) {

        const consent =
          await base.providers
            .getConsent(input);

        return {

          ...consent,

          granted: false

        };

      }

    });

    assertDenied(

      await revoked.authorize(),

      "memory_consent_required"

    );

  }
);


/*
 * TEST 12 — CATEGORY CONSENT
 */

test(
  "rejects memory categories outside consent",
  async () => {

    const base = fixture();

    const fx = fixture({

      async getConsent(input) {

        const consent =
          await base.providers
            .getConsent(input);

        return {

          ...consent,

          allowedCategories: ["gameplay"]

        };

      }

    });

    assertDenied(

      await fx.authorize({
        category: "conversation"
      }),

      "memory_consent_required"

    );

  }
);


/*
 * TEST 13 — LEARNING PERMISSION
 */

test(
  "requires separate consent for learning",
  async () => {

    const base = fixture();

    const fx = fixture({

      async getConsent(input) {

        const consent =
          await base.providers
            .getConsent(input);

        return {

          ...consent,

          learningAllowed: false

        };

      }

    });

    assertDenied(

      await fx.authorize({

        action: "learn",

        category: "learning"

      }),

      "learning_consent_required"

    );

    const recall =
      await fx.authorize();

    assert.equal(recall.ok, true);

  }
);


/*
 * TEST 14 — MISSING SUBSCRIPTION SERVICE
 */

test(
  "fails closed without a subscription provider",
  async () => {

    const fx = fixture({

      getSubscription: null

    });

    assertDenied(

      await fx.authorize(),

      "subscription_service_unavailable"

    );

  }
);


/*
 * TEST 15 — INVALID SUBSCRIPTIONS
 */

test(
  "rejects invalid subscription states",
  async () => {

    const base = fixture();

    const invalidStates = [

      { status: "inactive" },

      { status: "expired" },

      { status: "pending" },

      { serverVerified: false },

      { accountId: ACCOUNT_B },

      { billingModel: "purchase" },

      { billingInterval: "year" },

      { billingIntervalCount: 2 },

      { currentPeriodStart: "invalid" },

      { currentPeriodEnd: "invalid" },

      {

        currentPeriodEnd:
          "2026-11-15T12:00:00.000Z"

      },

      {

        currentPeriodStart:
          "2026-11-16T00:00:00.000Z"

      }

    ];


    for (const invalid of invalidStates) {

      const fx = fixture({

        async getSubscription(input) {

          const subscription =
            await base.providers
              .getSubscription(input);

          return {

            ...subscription,

            ...invalid

          };

        }

      });


      assertDenied(

        await fx.authorize(),

        "active_subscription_required"

      );

    }

  }
);


/*
 * TEST 16 — OWNER PRIVACY RIGHTS
 */

test(
  "allows owner management without AI subscription",
  async () => {

    const fx = fixture({

      getSubscription: null,

      getConsent: null

    });


    for (const action of [

      "review",

      "export",

      "delete",

      "clear"

    ]) {

      const result =
        await fx.authorize({
          action
        });


      assert.equal(result.ok, true);

      assert.equal(
        result.ownerManagement,
        true
      );

      assert.equal(
        result.subscriptionRequired,
        false
      );

      assert.equal(
        result.consentRequired,
        false
      );

      assert.equal(
        result.tradingAuthorized,
        false
      );

    }

  }
);


/*
 * TEST 17 — PREVIOUS CHARACTER MEMORY
 */

test(
  "allows authorized owner review of inactive memory",
  async () => {

    const fx = fixture({

      getSubscription: null,

      getConsent: null

    });


    const result =
      await fx.authorize({

        action: "review",

        characterId: "comic_pink_snail"

      });


    assert.equal(result.ok, true);

    assert.equal(

      result.identity.characterId,

      "comic_pink_snail"

    );

  }
);


/*
 * TEST 18 — PROVIDER FAILURE
 */

test(
  "does not expose internal provider errors",
  async () => {

    const fx = fixture({

      async getSubscription() {

        throw new Error(
          "SYNTHETIC_PRIVATE_ERROR"
        );

      }

    });


    const result =
      await fx.authorize();


    assertDenied(

      result,

      "memory_authorization_unavailable"

    );


    assert.equal(

      JSON.stringify(result).includes(
        "SYNTHETIC_PRIVATE_ERROR"
      ),

      false

    );

  }
);


/*
 * TEST 19 — SESSION EXPIRY DURING CHECK
 */

test(
  "rejects sessions expiring during authorization",
  async () => {

    let currentTime = NOW;

    const base = fixture();

    const fx = fixture({

      now: () => currentTime,

      async getSubscription(input) {

        currentTime = Date.parse(
          "2026-12-01T00:00:00.000Z"
        );

        return base.providers
          .getSubscription(input);

      }

    });


    assertDenied(

      await fx.authorize(),

      "session_expired"

    );

  }
);


/*
 * TEST 20 — NO FINANCIAL AUTHORIZATION
 */

test(
  "memory access never authorizes trading",
  async () => {

    const fx = fixture();

    for (const action of [

      "collect",

      "recall",

      "learn"

    ]) {

      const result =
        await fx.authorize({

          action,

          category: "learning"

        });


      assert.equal(result.ok, true);

      assert.equal(

        result.tradingAuthorized,

        false

      );

      assert.equal(

        result.externalModelTrainingAuthorized,

        false

      );

    }

  }
);

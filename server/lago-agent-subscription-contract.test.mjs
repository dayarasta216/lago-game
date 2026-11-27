
import test from "node:test";
import assert from "node:assert/strict";

import {
  SUBSCRIPTION_VERSION,
  SUBSCRIPTION_POLICY,
  addBillingMonth,
  validateBillingPeriod,
  createBillingPeriod,
  getBillingPeriodStatus,
  describeBillingPeriod
} from "./lago-agent-subscription-contract.mjs";


/*
 * LAGO GAME
 * R2.7B — MONTHLY BILLING TESTS
 *
 * Deterministic UTC calendar tests.
 * No real payments.
 * No wallet operations.
 * No entitlement activation.
 */


/*
 * TEST 01 — SUBSCRIPTION POLICY
 */

test(
  "uses one monthly account-level AI subscription",
  () => {

    const policy = SUBSCRIPTION_POLICY;

    assert.equal(SUBSCRIPTION_VERSION, 1);

    assert.equal(
      policy.product,
      "personal-ai-agent"
    );

    assert.equal(
      policy.billingModel,
      "subscription"
    );

    assert.equal(
      policy.billingInterval,
      "month"
    );

    assert.equal(
      policy.billingIntervalCount,
      1
    );

    assert.equal(
      policy.subscriptionScope,
      "account"
    );

    assert.equal(
      policy.maxActiveAgents,
      1
    );

    assert.equal(
      policy.billingTimezone,
      "UTC"
    );

    assert.equal(
      policy.autoRenewal,
      false
    );

    assert.equal(
      policy.freeTrial,
      false
    );

    assert.equal(
      policy.unlockWithXP,
      false
    );

    assert.equal(
      policy.unlockWithSP,
      false
    );

  }
);


/*
 * TEST 02 — TOKEN IDENTITY
 */

test(
  "uses the canonical LAGO token identity",
  () => {

    const policy = SUBSCRIPTION_POLICY;

    assert.equal(
      policy.currency,
      "LAGO"
    );

    assert.equal(
      policy.chain,
      "solana"
    );

    assert.equal(
      policy.network,
      "mainnet-beta"
    );

    assert.equal(

      policy.tokenMint,

      "J9BmsKsS6PH7QGxDWA43YVbsmTxavgFmu5ScSDzWpump"

    );

    assert.equal(

      policy.serverPaymentVerificationRequired,

      true

    );

    assert.equal(

      policy.paymentReplayProtectionRequired,

      true

    );

  }
);


/*
 * TEST 03 — NORMAL MONTH
 */

test(
  "adds one calendar month and preserves UTC time",
  () => {

    assert.equal(

      addBillingMonth(

        "2026-11-15T12:30:45.123Z",

        15

      ),

      "2026-12-15T12:30:45.123Z"

    );

  }
);


/*
 * TEST 04 — SHORT MONTH
 */

test(
  "clamps January 31 to February 28",
  () => {

    assert.equal(

      addBillingMonth(

        "2027-01-31T12:00:00.000Z",

        31

      ),

      "2027-02-28T12:00:00.000Z"

    );

  }
);


/*
 * TEST 05 — LEAP YEAR
 */

test(
  "supports February 29 in leap years",
  () => {

    assert.equal(

      addBillingMonth(

        "2028-01-31T12:00:00.000Z",

        31

      ),

      "2028-02-29T12:00:00.000Z"

    );


    assert.equal(

      addBillingMonth(

        "2028-02-29T12:00:00.000Z",

        31

      ),

      "2028-03-31T12:00:00.000Z"

    );

  }
);


/*
 * TEST 06 — RESTORE BILLING ANCHOR
 */

test(
  "restores the original billing day after February",
  () => {

    const february =
      addBillingMonth(

        "2027-01-31T10:00:00.000Z",

        31

      );


    const march =
      addBillingMonth(
        february,
        31
      );


    const april =
      addBillingMonth(
        march,
        31
      );


    const may =
      addBillingMonth(
        april,
        31
      );


    assert.equal(

      february,

      "2027-02-28T10:00:00.000Z"

    );

    assert.equal(

      march,

      "2027-03-31T10:00:00.000Z"

    );

    assert.equal(

      april,

      "2027-04-30T10:00:00.000Z"

    );

    assert.equal(

      may,

      "2027-05-31T10:00:00.000Z"

    );

  }
);


/*
 * TEST 07 — YEAR TRANSITION
 */

test(
  "supports billing across calendar years",
  () => {

    assert.equal(

      addBillingMonth(

        "2026-12-31T23:59:59.999Z",

        31

      ),

      "2027-01-31T23:59:59.999Z"

    );

  }
);


/*
 * TEST 08 — INVALID CALENDAR INPUT
 */

test(
  "rejects invalid dates and billing anchors",
  () => {

    const timestamp =
      "2026-11-15T12:00:00.000Z";


    for (const anchor of [

      0,

      32,

      -1,

      15.5,

      "15",

      null

    ]) {

      assert.equal(

        addBillingMonth(
          timestamp,
          anchor
        ),

        null

      );

    }


    for (const invalid of [

      null,

      "",

      "invalid",

      "2027-02-30T12:00:00.000Z",

      "2027-01-31",

      "2027-01-31T12:00:00+03:00"

    ]) {

      assert.equal(

        addBillingMonth(
          invalid,
          31
        ),

        null

      );

    }


    assert.equal(

      addBillingMonth(
        timestamp,
        20
      ),

      null

    );

  }
);


/*
 * TEST 09 — INITIAL SUBSCRIPTION
 */

test(
  "creates the initial monthly billing period",
  () => {

    const period =
      createBillingPeriod({

        paidAt:
          "2026-11-15T12:00:00.000Z"

      });


    assert.ok(period);

    assert.equal(

      validateBillingPeriod(period),

      true

    );

    assert.equal(

      period.currentPeriodStart,

      "2026-11-15T12:00:00.000Z"

    );

    assert.equal(

      period.currentPeriodEnd,

      "2026-12-15T12:00:00.000Z"

    );

    assert.equal(

      period.billingAnchorDay,

      15

    );

    assert.equal(

      Object.isFrozen(period),

      true

    );

  }
);


/*
 * TEST 10 — EARLY RENEWAL
 */

test(
  "early renewal preserves unused paid time",
  () => {

    const first =
      createBillingPeriod({

        paidAt:
          "2027-01-31T12:00:00.000Z"

      });


    const second =
      createBillingPeriod({

        paidAt:
          "2027-02-10T12:00:00.000Z",

        previousPeriod: first

      });


    assert.ok(second);

    assert.equal(

      second.currentPeriodStart,

      first.currentPeriodEnd

    );

    assert.equal(

      second.currentPeriodEnd,

      "2027-03-31T12:00:00.000Z"

    );

    assert.equal(

      second.billingAnchorDay,

      31

    );


    const renewalTime =
      Date.parse(second.paidAt);


    assert.equal(

      getBillingPeriodStatus(

        first,

        renewalTime

      ),

      "active"

    );

    assert.equal(

      getBillingPeriodStatus(

        second,

        renewalTime

      ),

      "scheduled"

    );

  }
);


/*
 * TEST 11 — MULTIPLE EARLY RENEWALS
 */

test(
  "preserves contiguous prepaid monthly periods",
  () => {

    const first =
      createBillingPeriod({

        paidAt:
          "2027-01-31T12:00:00.000Z"

      });


    const second =
      createBillingPeriod({

        paidAt:
          "2027-02-10T12:00:00.000Z",

        previousPeriod: first

      });


    const third =
      createBillingPeriod({

        paidAt:
          "2027-02-11T12:00:00.000Z",

        previousPeriod: second

      });


    assert.ok(third);

    assert.equal(

      third.currentPeriodStart,

      "2027-03-31T12:00:00.000Z"

    );

    assert.equal(

      third.currentPeriodEnd,

      "2027-04-30T12:00:00.000Z"

    );

    assert.equal(

      third.billingAnchorDay,

      31

    );

  }
);


/*
 * TEST 12 — RENEWAL AFTER EXPIRY
 */

test(
  "starts a new billing anchor after expiry",
  () => {

    const first =
      createBillingPeriod({

        paidAt:
          "2027-01-31T12:00:00.000Z"

      });


    const renewed =
      createBillingPeriod({

        paidAt:
          "2027-03-08T09:00:00.000Z",

        previousPeriod: first

      });


    assert.ok(renewed);

    assert.equal(

      renewed.currentPeriodStart,

      "2027-03-08T09:00:00.000Z"

    );

    assert.equal(

      renewed.currentPeriodEnd,

      "2027-04-08T09:00:00.000Z"

    );

    assert.equal(

      renewed.billingAnchorDay,

      8

    );

  }
);


/*
 * TEST 13 — EXACT EXPIRY RENEWAL
 */

test(
  "renews continuously at the exact expiry boundary",
  () => {

    const first =
      createBillingPeriod({

        paidAt:
          "2027-01-31T12:00:00.000Z"

      });


    const second =
      createBillingPeriod({

        paidAt:
          first.currentPeriodEnd,

        previousPeriod: first

      });


    assert.ok(second);

    assert.equal(

      second.currentPeriodStart,

      first.currentPeriodEnd

    );

    assert.equal(

      second.currentPeriodEnd,

      "2027-03-31T12:00:00.000Z"

    );

  }
);


/*
 * TEST 14 — BILLING STATUS
 */

test(
  "enforces exact subscription time boundaries",
  () => {

    const period =
      createBillingPeriod({

        paidAt:
          "2026-11-15T12:00:00.000Z"

      });


    const start =
      Date.parse(
        period.currentPeriodStart
      );


    const end =
      Date.parse(
        period.currentPeriodEnd
      );


    assert.equal(

      getBillingPeriodStatus(
        period,
        start - 1
      ),

      "scheduled"

    );

    assert.equal(

      getBillingPeriodStatus(
        period,
        start
      ),

      "active"

    );

    assert.equal(

      getBillingPeriodStatus(
        period,
        end - 1
      ),

      "active"

    );

    assert.equal(

      getBillingPeriodStatus(
        period,
        end
      ),

      "expired"

    );

    assert.equal(

      getBillingPeriodStatus(
        period,
        end + 1
      ),

      "expired"

    );

  }
);


/*
 * TEST 15 — PERIOD TAMPERING
 */

test(
  "rejects malformed and extended billing periods",
  () => {

    const period =
      createBillingPeriod({

        paidAt:
          "2026-11-15T12:00:00.000Z"

      });


    const invalid = [

      { schemaVersion: 99 },

      { billingModel: "purchase" },

      { billingInterval: "year" },

      { billingIntervalCount: 2 },

      { billingAnchorDay: 32 },

      {

        paidAt:
          "2026-11-16T12:00:00.000Z"

      },

      {

        currentPeriodEnd:
          "2027-12-15T12:00:00.000Z"

      },

      {

        currentPeriodEnd:
          "invalid"

      }

    ];


    for (const changes of invalid) {

      assert.equal(

        validateBillingPeriod({

          ...period,

          ...changes

        }),

        false

      );

    }

  }
);


/*
 * TEST 16 — PAYMENT CHRONOLOGY
 */

test(
  "rejects renewal timestamps preceding earlier payment",
  () => {

    const first =
      createBillingPeriod({

        paidAt:
          "2026-11-15T12:00:00.000Z"

      });


    assert.equal(

      createBillingPeriod({

        paidAt:
          "2026-11-14T12:00:00.000Z",

        previousPeriod: first

      }),

      null

    );

  }
);


/*
 * TEST 17 — REMAINING TIME
 */

test(
  "describes remaining billing days correctly",
  () => {

    const period =
      createBillingPeriod({

        paidAt:
          "2026-11-15T12:00:00.000Z"

      });


    const snapshot =
      describeBillingPeriod(

        period,

        Date.parse(
          "2026-12-14T13:00:00.000Z"
        )

      );


    assert.ok(snapshot);

    assert.equal(
      snapshot.status,
      "active"
    );

    assert.equal(
      snapshot.daysRemaining,
      1
    );


    const expired =
      describeBillingPeriod(

        period,

        Date.parse(
          period.currentPeriodEnd
        )

      );


    assert.equal(
      expired.status,
      "expired"
    );

    assert.equal(
      expired.daysRemaining,
      0
    );

  }
);


/*
 * TEST 18 — NO FALSE ENTITLEMENT
 */

test(
  "calendar status never activates paid AI",
  () => {

    const period =
      createBillingPeriod({

        paidAt:
          "2026-11-15T12:00:00.000Z"

      });


    const snapshot =
      describeBillingPeriod(

        period,

        Date.parse(
          "2026-11-20T12:00:00.000Z"
        )

      );


    assert.equal(snapshot.status, "active");

    assert.equal(
      snapshot.serverVerified,
      false
    );

    assert.equal(
      snapshot.entitled,
      false
    );

    assert.equal(
      snapshot.aiEnabled,
      false
    );

    assert.equal(
      snapshot.tradingAuthorized,
      false
    );

    assert.equal(
      snapshot.autoRenewal,
      false
    );

  }
);


/*
 * TEST 19 — DATA PRESERVATION
 */

test(
  "preserves owner data after subscription expiry",
  () => {

    const policy = SUBSCRIPTION_POLICY;

    assert.equal(
      policy.preserveCharacterOnExpiry,
      true
    );

    assert.equal(
      policy.preserveMemoryOnExpiry,
      true
    );

    assert.equal(
      policy.preserveProgressOnExpiry,
      true
    );

    assert.equal(
      policy.ownerMemoryManagementAlwaysAllowed,
      true
    );

    assert.equal(
      policy.separateTradingAuthorizationRequired,
      true
    );

  }
);


/*
 * TEST 20 — INVALID BILLING STATE
 */

test(
  "fails closed for invalid billing state",
  () => {

    assert.equal(

      validateBillingPeriod(null),

      false

    );

    assert.equal(

      createBillingPeriod(),

      null

    );

    assert.equal(

      getBillingPeriodStatus(null),

      "invalid"

    );

    assert.equal(

      describeBillingPeriod(null),

      null

    );


    const period =
      createBillingPeriod({

        paidAt:
          "2026-11-15T12:00:00.000Z"

      });


    assert.equal(

      getBillingPeriodStatus(
        period,
        NaN
      ),

      "invalid"

    );

    assert.equal(

      describeBillingPeriod(
        period,
        Infinity
      ),

      null

    );

  }
);

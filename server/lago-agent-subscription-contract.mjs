
/*
 * LAGO GAME
 * R2.7A — MONTHLY SUBSCRIPTION CONTRACT
 *
 * Server-side billing calendar.
 * Account-level subscription.
 * One active personal AI agent.
 *
 * No payment verification.
 * No automatic payments.
 * No entitlement activation.
 * No trading authorization.
 */

export const SUBSCRIPTION_VERSION = 1;

export const SUBSCRIPTION_POLICY = Object.freeze({

  product: "personal-ai-agent",

  billingModel: "subscription",

  billingInterval: "month",

  billingIntervalCount: 1,

  billingTimezone: "UTC",

  currency: "LAGO",

  chain: "solana",

  network: "mainnet-beta",

  tokenMint:
    "J9BmsKsS6PH7QGxDWA43YVbsmTxavgFmu5ScSDzWpump",

  subscriptionScope: "account",

  maxActiveAgents: 1,

  autoRenewal: false,

  manualRenewal: true,

  preserveUnusedPeriod: true,

  preserveBillingAnchor: true,

  freeTrial: false,

  unlockWithXP: false,

  unlockWithSP: false,

  preserveCharacterOnExpiry: true,

  preserveMemoryOnExpiry: true,

  preserveProgressOnExpiry: true,

  ownerMemoryManagementAlwaysAllowed: true,

  serverPaymentVerificationRequired: true,

  paymentReplayProtectionRequired: true,

  separateTradingAuthorizationRequired: true

});


/*
 * CANONICAL TIMESTAMP VALIDATION
 */

function validTimestamp(value) {

  if (

    typeof value !== "string" ||

    !Number.isFinite(Date.parse(value))

  ) {

    return false;

  }


  const date = new Date(value);


  return (

    date.toISOString() === value &&

    date.getUTCFullYear() >= 2000 &&

    date.getUTCFullYear() <= 9998

  );

}


function validAnchorDay(value) {

  return (

    Number.isInteger(value) &&

    value >= 1 &&

    value <= 31

  );

}


/*
 * CALENDAR HELPERS
 */

function daysInMonth(year, month) {

  return new Date(

    Date.UTC(
      year,
      month + 1,
      0
    )

  ).getUTCDate();

}


function matchesAnchor(date, anchorDay) {

  return date.getUTCDate() === Math.min(

    anchorDay,

    daysInMonth(

      date.getUTCFullYear(),

      date.getUTCMonth()

    )

  );

}


/*
 * ADD ONE CALENDAR MONTH
 *
 * Preserve UTC time.
 * Clamp to the last day of short months.
 * Restore the original anchor when possible.
 */

export function addBillingMonth(
  timestamp,
  anchorDay
) {

  if (

    !validTimestamp(timestamp) ||

    !validAnchorDay(anchorDay)

  ) {

    return null;

  }


  const date = new Date(timestamp);


  if (!matchesAnchor(date, anchorDay)) {

    return null;

  }


  date.setUTCDate(1);

  date.setUTCMonth(
    date.getUTCMonth() + 1
  );


  const maxDay = daysInMonth(

    date.getUTCFullYear(),

    date.getUTCMonth()

  );


  date.setUTCDate(

    Math.min(
      anchorDay,
      maxDay
    )

  );


  const result = date.toISOString();


  return validTimestamp(result)

    ? result

    : null;

}


/*
 * VALIDATE BILLING PERIOD
 *
 * Structural and calendar validation only.
 * Does not prove that payment occurred.
 */

export function validateBillingPeriod(period) {

  if (

    !period ||

    typeof period !== "object" ||

    Array.isArray(period) ||

    period.schemaVersion !==
      SUBSCRIPTION_VERSION ||

    period.billingModel !==
      SUBSCRIPTION_POLICY.billingModel ||

    period.billingInterval !==
      SUBSCRIPTION_POLICY.billingInterval ||

    period.billingIntervalCount !== 1 ||

    !validTimestamp(period.paidAt) ||

    !validTimestamp(period.currentPeriodStart) ||

    !validTimestamp(period.currentPeriodEnd) ||

    !validAnchorDay(period.billingAnchorDay)

  ) {

    return false;

  }


  if (

    Date.parse(period.paidAt) >

      Date.parse(period.currentPeriodStart)

  ) {

    return false;

  }


  const expectedEnd = addBillingMonth(

    period.currentPeriodStart,

    period.billingAnchorDay

  );


  return (

    expectedEnd !== null &&

    expectedEnd === period.currentPeriodEnd

  );

}


/*
 * CREATE NEXT BILLING PERIOD
 *
 * IMPORTANT:
 * paidAt must eventually originate
 * from a verified payment service.
 *
 * This function only calculates dates.
 *
 * Early renewal extends existing access.
 * Renewal after expiry starts a new period.
 */

export function createBillingPeriod({

  paidAt,

  previousPeriod = null

} = {}) {

  if (!validTimestamp(paidAt)) {

    return null;

  }


  if (

    previousPeriod !== null &&

    !validateBillingPeriod(previousPeriod)

  ) {

    return null;

  }


  if (

    previousPeriod &&

    Date.parse(paidAt) <

      Date.parse(previousPeriod.paidAt)

  ) {

    return null;

  }


  let currentPeriodStart = paidAt;


  let billingAnchorDay =

    new Date(paidAt)
      .getUTCDate();


  /*
   * Preserve unused subscription time.
   */

  if (

    previousPeriod &&

    Date.parse(paidAt) <=

      Date.parse(
        previousPeriod.currentPeriodEnd
      )

  ) {

    currentPeriodStart =
      previousPeriod.currentPeriodEnd;

    billingAnchorDay =
      previousPeriod.billingAnchorDay;

  }


  const currentPeriodEnd = addBillingMonth(

    currentPeriodStart,

    billingAnchorDay

  );


  if (!currentPeriodEnd) {

    return null;

  }


  const period = Object.freeze({

    schemaVersion:
      SUBSCRIPTION_VERSION,

    billingModel:
      SUBSCRIPTION_POLICY.billingModel,

    billingInterval:
      SUBSCRIPTION_POLICY.billingInterval,

    billingIntervalCount: 1,

    billingAnchorDay,

    paidAt,

    currentPeriodStart,

    currentPeriodEnd

  });


  return validateBillingPeriod(period)

    ? period

    : null;

}


/*
 * BILLING PERIOD STATUS
 *
 * End boundary is exclusive.
 * No grace period.
 */

export function getBillingPeriodStatus(

  period,

  now = Date.now()

) {

  if (

    !validateBillingPeriod(period) ||

    !Number.isFinite(now)

  ) {

    return "invalid";

  }


  const start = Date.parse(
    period.currentPeriodStart
  );

  const end = Date.parse(
    period.currentPeriodEnd
  );


  if (now < start) {

    return "scheduled";

  }


  if (now >= end) {

    return "expired";

  }


  return "active";

}


/*
 * DESCRIPTIVE BILLING SNAPSHOT
 *
 * A calendar status is NOT an
 * authenticated subscription.
 */

export function describeBillingPeriod(

  period,

  now = Date.now()

) {

  const status =
    getBillingPeriodStatus(
      period,
      now
    );


  if (status === "invalid") {

    return null;

  }


  const remainingMilliseconds =

    Math.max(

      0,

      Date.parse(period.currentPeriodEnd) -
        now

    );


  return Object.freeze({

    schemaVersion:
      SUBSCRIPTION_VERSION,

    product:
      SUBSCRIPTION_POLICY.product,

    billingModel:
      SUBSCRIPTION_POLICY.billingModel,

    billingInterval:
      SUBSCRIPTION_POLICY.billingInterval,

    billingIntervalCount: 1,

    status,

    currentPeriodStart:
      period.currentPeriodStart,

    currentPeriodEnd:
      period.currentPeriodEnd,

    billingAnchorDay:
      period.billingAnchorDay,

    daysRemaining:

      Math.ceil(

        remainingMilliseconds /
          86400000

      ),

    currency:
      SUBSCRIPTION_POLICY.currency,

    tokenMint:
      SUBSCRIPTION_POLICY.tokenMint,

    autoRenewal: false,

    serverVerified: false,

    entitled: false,

    aiEnabled: false,

    tradingAuthorized: false

  });

}

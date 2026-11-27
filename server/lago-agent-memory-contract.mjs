
import { randomUUID } from "node:crypto";

/*
 * LAGO GAME
 * R2.6E — SERVER MEMORY CONTRACT
 *
 * Canonical memory identity.
 * Independent server validation.
 *
 * This module does not authenticate
 * requests or grant memory access.
 */

export const MEMORY_SCHEMA_VERSION = 1;

export const MAX_MEMORY_CONTENT_LENGTH = 4000;


/*
 * SERVER CHARACTER REGISTRY
 */

const CHARACTER_IDS = Object.freeze([

  "lago",
  "comic_dog_snail",
  "comic_pink_snail",
  "comic_cockroach",
  "comic_giraffe_bird",
  "comic_fennec",
  "comic_goose",
  "comic_pig",
  "comic_bozz",
  "comic_taya"

]);


/*
 * CANONICAL MEMORY SOURCES
 */

const CATEGORY_SOURCES = Object.freeze({

  owner: "owner_explicit",

  conversation: "conversation",

  gameplay: "gameplay_event",

  emotional: "emotion_simulation",

  trading: "market_research",

  learning: "learning_review"

});


/*
 * SERVER PRIVACY POLICY
 */

export const MEMORY_POLICY = Object.freeze({

  scope: "account_character",

  serverAuthenticationRequired: true,

  explicitConsentRequired: true,

  subscriptionRequiredForAIRecall: true,

  preserveMemoryOnSubscriptionExpiry: true,

  subscriptionRequiredForOwnerDeletion: false,

  subscriptionRequiredForOwnerExport: false,

  subscriptionRequiredForOwnerReview: false,

  clientSuppliedOwnerTrusted: false,

  clientSuppliedProvenanceTrusted: false,

  crossAccountAccessEnabled: false,

  crossCharacterAccessEnabled: false,

  automaticCollectionEnabled: false,

  financialCredentialsAllowed: false,

  authenticationSecretsAllowed: false,

  externalModelTrainingEnabled: false,

  memoryOverridesRisk: false

});


/*
 * VALIDATION HELPERS
 */

function isObject(value) {

  return (

    value !== null &&

    typeof value === "object" &&

    !Array.isArray(value)

  );

}


export function validAccountId(value) {

  return (

    typeof value === "string" &&

    /^lago_[A-Za-z0-9_-]{22}$/
      .test(value)

  );

}


export function validCharacterId(value) {

  return (

    typeof value === "string" &&

    CHARACTER_IDS.includes(value)

  );

}


export function validMemoryCategory(value) {

  return (

    typeof value === "string" &&

    Object.hasOwn(
      CATEGORY_SOURCES,
      value
    )

  );

}


export function validMemoryId(value) {

  return (

    typeof value === "string" &&

    value.length >= 1 &&

    value.length <= 128 &&

    /^[A-Za-z0-9_-]+$/.test(value)

  );

}


function validImportance(value) {

  return (

    Number.isInteger(value) &&

    value >= 0 &&

    value <= 100

  );

}


function validContent(value) {

  return (

    typeof value === "string" &&

    value.trim().length > 0 &&

    value.length <=
      MAX_MEMORY_CONTENT_LENGTH

  );

}


function validDate(value) {

  return (

    typeof value === "string" &&

    Number.isFinite(Date.parse(value)) &&

    new Date(value).toISOString() === value

  );

}


/*
 * CANONICAL SERVER IDENTITY
 *
 * accountId must originate from
 * an authenticated server session.
 */

export function createMemoryIdentity(
  accountId,
  characterId
) {

  if (

    !validAccountId(accountId) ||

    !validCharacterId(characterId)

  ) {

    return null;

  }


  return Object.freeze({

    schemaVersion:
      MEMORY_SCHEMA_VERSION,

    agentId: [

      "lago-agent",

      "v" + MEMORY_SCHEMA_VERSION,

      accountId,

      characterId

    ].join(":"),

    accountId,

    characterId,

    scope: "account_character",

    serverAuthorizationRequired: true

  });

}


/*
 * VALIDATE IDENTITY
 */

export function validateMemoryIdentity(identity) {

  if (!isObject(identity)) {

    return false;

  }


  const expected =
    createMemoryIdentity(

      identity.accountId,

      identity.characterId

    );


  return Boolean(

    expected &&

    identity.schemaVersion ===
      expected.schemaVersion &&

    identity.agentId ===
      expected.agentId &&

    identity.scope ===
      expected.scope &&

    identity.serverAuthorizationRequired ===
      true

  );

}


/*
 * VALIDATE STORED RECORD
 */

export function validateMemoryRecord(record) {

  if (!isObject(record)) {

    return false;

  }


  if (

    record.schemaVersion !==
      MEMORY_SCHEMA_VERSION ||

    !validateMemoryIdentity(
      record.identity
    ) ||

    !validMemoryId(record.memoryId) ||

    !validMemoryCategory(record.category) ||

    !validContent(record.content) ||

    !validImportance(record.importance) ||

    !validDate(record.createdAt) ||

    !validDate(record.updatedAt)

  ) {

    return false;

  }


  return (

    record.source ===
      CATEGORY_SOURCES[record.category] &&

    Date.parse(record.updatedAt) >=
      Date.parse(record.createdAt) &&

    record.consentRequired === true &&

    record.serverAuthorizationRequired ===
      true

  );

}


/*
 * OWNERSHIP COMPARISON
 *
 * Structural comparison only.
 * Not a substitute for authentication.
 */

export function memoryBelongsTo(
  record,
  identity
) {

  if (

    !validateMemoryRecord(record) ||

    !validateMemoryIdentity(identity)

  ) {

    return false;

  }


  return (

    record.identity.accountId ===
      identity.accountId &&

    record.identity.characterId ===
      identity.characterId &&

    record.identity.agentId ===
      identity.agentId

  );

}


/*
 * CREATE CANONICAL MEMORY RECORD
 *
 * Internal server use only.
 *
 * Caller must verify authentication,
 * character ownership, consent,
 * provenance and applicable access.
 */

export function createMemoryRecord({

  accountId,

  characterId,

  category,

  content,

  importance = 50

} = {}) {

  const identity =
    createMemoryIdentity(

      accountId,

      characterId

    );


  if (

    !identity ||

    !validMemoryCategory(category) ||

    !validContent(content) ||

    !validImportance(importance)

  ) {

    return null;

  }


  const timestamp =
    new Date().toISOString();


  const record = Object.freeze({

    schemaVersion:
      MEMORY_SCHEMA_VERSION,

    memoryId:
      randomUUID(),

    identity,

    category,

    source:
      CATEGORY_SOURCES[category],

    content:
      content.trim(),

    importance,

    createdAt:
      timestamp,

    updatedAt:
      timestamp,

    consentRequired: true,

    serverAuthorizationRequired: true

  });


  return validateMemoryRecord(record)

    ? record

    : null;

}


/*
 * SAFE RECORD PROJECTION
 *
 * Copy canonical fields only.
 * Reject records outside the
 * expected identity.
 */

export function projectMemoryRecord(
  record,
  identity
) {

  if (

    !memoryBelongsTo(
      record,
      identity
    )

  ) {

    return null;

  }


  return Object.freeze({

    schemaVersion:
      MEMORY_SCHEMA_VERSION,

    memoryId:
      record.memoryId,

    identity:
      createMemoryIdentity(

        record.identity.accountId,

        record.identity.characterId

      ),

    category:
      record.category,

    source:
      record.source,

    content:
      record.content,

    importance:
      record.importance,

    createdAt:
      record.createdAt,

    updatedAt:
      record.updatedAt,

    consentRequired: true,

    serverAuthorizationRequired: true

  });

}


/*
 * READ-ONLY REGISTRY
 */

export function getMemoryCharacters() {

  return CHARACTER_IDS;

}


export function getMemoryCategories() {

  return Object.freeze(
    Object.keys(CATEGORY_SOURCES)
  );

}


export function getMemorySource(category) {

  return validMemoryCategory(category)

    ? CATEGORY_SOURCES[category]

    : null;

}

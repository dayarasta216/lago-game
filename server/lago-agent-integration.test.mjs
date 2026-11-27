
import test from "node:test";
import assert from "node:assert/strict";

import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";

import {
  createMemoryIdentity,
  createMemoryRecord,
  validateMemoryRecord,
  getMemoryCharacters
} from "./lago-agent-memory-contract.mjs";


/*
 * LAGO GAME
 * R2.6H — PERSONAL AGENT INTEGRATION TESTS
 *
 * Real frontend agent modules.
 * Isolated JavaScript runtime.
 * Synthetic browser and account adapters.
 * No network requests.
 * No real AI or financial transactions.
 */

const ACCOUNT_A =
  "lago_" + "A".repeat(22);

const ACCOUNT_B =
  "lago_" + "B".repeat(22);

const CHARACTERS =
  getMemoryCharacters();


/*
 * PRODUCTION MODULE LOADING ORDER
 */

const MODULES = Object.freeze([

  "lago-agent-personality.js",

  "lago-agent-dna.js",

  "lago-agent-emotions.js",

  "lago-agent-communication.js",

  "lago-agent-strategy.js",

  "lago-agent-bond.js",

  "lago-agent-bond-runtime.js",

  "lago-agent-identity.js",

  "lago-agent-memory.js",

  "lago-agent-memory-intelligence.js",

  "lago-agent-access.js",

  "lago-agent-context.js"

]);


function readProjectFile(filename) {

  return readFileSync(

    new URL(

      "../" + filename,

      import.meta.url

    ),

    "utf8"

  );

}


/*
 * ISOLATED CLIENT RUNTIME
 */

function fixture() {

  let selectedSkin = "default";

  let localOwner = "synthetic_a";

  let auth = {

    authenticated: false,

    loading: false,

    accountId: null

  };


  const storage = new Map();

  const document = new EventTarget();


  class SyntheticCustomEvent extends Event {

    constructor(type, options = {}) {

      super(type);

      this.detail = options.detail;

    }

  }


  function currentCharacter() {

    return CHARACTERS.includes(selectedSkin)

      ? selectedSkin

      : "lago";

  }


  const sandbox = {

    console,

    document,

    CustomEvent: SyntheticCustomEvent,

    localStorage: {

      getItem(key) {

        return storage.get(key) ?? null;

      },

      setItem(key, value) {

        storage.set(
          String(key),
          String(value)
        );

      },

      removeItem(key) {

        storage.delete(key);

      }

    },


    LAGO_ACCOUNT: {

      getState() {

        return {

          selectedSkin,

          social: {

            userId: localOwner

          }

        };

      },

      getAuthIdentity() {

        return {

          provider: "",

          telegramLinked: false

        };

      }

    },


    LAGO_AUTH_BACKEND: {

      getState() {

        return { ...auth };

      }

    },


    LAGO_CHARACTERS: {

      getAll() {

        return CHARACTERS.map(

          id => ({ id })

        );

      },

      isComicCharacter(id) {

        return (

          id !== "lago" &&

          CHARACTERS.includes(id)

        );

      }

    },


    LAGO_MINIGAMES: {

      getContext() {

        const characterId =
          currentCharacter();

        const personality =
          sandbox.LAGO_AGENT_PERSONALITY
            ?.getById(characterId);

        return {

          characterId,

          characterName:

            personality?.displayName ||

            characterId

        };

      }

    }

  };


  sandbox.window = sandbox;


  const runtime =
    createContext(sandbox);


  for (const filename of MODULES) {

    runInContext(

      readProjectFile(filename),

      runtime,

      {

        filename,

        timeout: 5000

      }

    );

  }


  function emit(name) {

    document.dispatchEvent(

      new SyntheticCustomEvent(name)

    );

  }


  return {

    api: sandbox,

    storage,

    select(characterId) {

      selectedSkin = characterId;

      emit("lago:character-equipped");

    },

    authenticate(accountId) {

      auth = {

        authenticated: true,

        loading: false,

        accountId

      };

      emit("lago:backend-auth-state");

    },

    logout() {

      auth = {

        authenticated: false,

        loading: false,

        accountId: null

      };

      emit("lago:backend-auth-state");

    },

    changeLocalOwner(owner) {

      localOwner = owner;

      emit("lago:account-state");

    }

  };

}


/*
 * TEST 01 — SCRIPT INTEGRATION
 */

test(
  "loads every agent module in production order",
  () => {

    const html =
      readProjectFile("index.html");

    let previousPosition = -1;


    for (const filename of MODULES) {

      const marker =
        'src="' + filename;

      const position =
        html.indexOf(marker);


      assert.ok(

        position > previousPosition,

        "Invalid script order: " + filename

      );


      assert.equal(

        html.indexOf(
          marker,
          position + marker.length
        ),

        -1,

        "Duplicate script: " + filename

      );


      previousPosition = position;

    }

  }
);


/*
 * TEST 02 — DEPENDENCIES
 */

test(
  "initializes all agent context dependencies",
  () => {

    const { api } = fixture();

    const result =
      api.LAGO_AGENT_CONTEXT
        .validateDependencies();


    assert.equal(result.ready, true);

    assert.equal(result.total, 10);

    assert.equal(result.missing.length, 0);

  }
);


/*
 * TEST 03 — ALL CHARACTER PROFILES
 */

test(
  "provides complete profiles for every character",
  () => {

    const fx = fixture();

    const { api } = fx;


    assert.equal(

      api.LAGO_AGENT_PERSONALITY
        .getAll().length,

      10

    );


    assert.equal(

      api.LAGO_AGENT_DNA
        .validateRegistry().valid,

      true

    );


    assert.equal(

      api.LAGO_AGENT_COMMUNICATION
        .validateRegistry().valid,

      true

    );


    assert.equal(

      api.LAGO_AGENT_STRATEGY
        .validateRegistry().valid,

      true

    );


    for (const characterId of CHARACTERS) {

      fx.select(characterId);


      const result =
        api.LAGO_AGENT_CONTEXT.getCurrent();


      assert.equal(

        result.ready,

        true,

        "Context unavailable: " + characterId

      );


      const context = result.context;


      assert.equal(

        context.characterId,

        characterId

      );


      assert.equal(

        context.personality.characterId,

        characterId

      );


      assert.equal(

        context.communication.characterId,

        characterId

      );


      assert.equal(

        context.strategy.characterId,

        characterId

      );


      assert.equal(

        context.emotions.simulated,

        true

      );


      assert.equal(

        context.previewOnly,

        true

      );

    }

  }
);


/*
 * TEST 04 — GUEST RESTRICTIONS
 */

test(
  "guests have previews but no private AI memory",
  () => {

    const { api } = fixture();


    assert.equal(

      api.LAGO_AGENT_IDENTITY.getCurrent(),

      null

    );


    const result =
      api.LAGO_AGENT_CONTEXT.getCurrent();


    assert.equal(result.ready, true);

    assert.equal(

      result.context.identityAvailable,

      false

    );


    assert.equal(

      result.memoryRecallAuthorized,

      false

    );


    assert.equal(

      result.aiExecutionAuthorized,

      false

    );


    assert.equal(

      result.tradingAuthorized,

      false

    );

  }
);


/*
 * TEST 05 — CLIENT AND SERVER IDENTITY
 */

test(
  "uses compatible client and server identities",
  () => {

    const fx = fixture();

    const { api } = fx;


    fx.authenticate(ACCOUNT_A);


    for (const characterId of CHARACTERS) {

      fx.select(characterId);


      const client =
        api.LAGO_AGENT_IDENTITY.getCurrent();


      const server =
        createMemoryIdentity(

          ACCOUNT_A,

          characterId

        );


      assert.deepEqual(

        JSON.parse(JSON.stringify(client)),

        server

      );

    }

  }
);


/*
 * TEST 06 — ACCOUNT SWITCH
 */

test(
  "invalidates the previous client identity on account switch",
  () => {

    const fx = fixture();

    const { api } = fx;


    fx.authenticate(ACCOUNT_A);


    const first =
      api.LAGO_AGENT_IDENTITY.getCurrent();


    assert.equal(

      api.LAGO_AGENT_IDENTITY
        .isCurrent(first),

      true

    );


    fx.authenticate(ACCOUNT_B);


    const second =
      api.LAGO_AGENT_IDENTITY.getCurrent();


    assert.notEqual(

      first.agentId,

      second.agentId

    );


    assert.equal(

      api.LAGO_AGENT_IDENTITY
        .isCurrent(first),

      false

    );


    fx.logout();


    assert.equal(

      api.LAGO_AGENT_IDENTITY.getCurrent(),

      null

    );

  }
);


/*
 * TEST 07 — CHARACTER SWITCH
 */

test(
  "switches personal agent context without mixing identities",
  () => {

    const fx = fixture();

    const { api } = fx;


    fx.authenticate(ACCOUNT_A);

    fx.select("lago");


    const lago =
      api.LAGO_AGENT_IDENTITY.getCurrent();


    fx.select("comic_pink_snail");


    const sola =
      api.LAGO_AGENT_IDENTITY.getCurrent();


    assert.notEqual(

      lago.agentId,

      sola.agentId

    );


    assert.equal(

      api.LAGO_AGENT_IDENTITY.isCurrent(lago),

      false

    );


    assert.equal(

      api.LAGO_AGENT_CONTEXT
        .getCurrent()
        .context.displayName,

      "Sola"

    );


    fx.select("lago");


    assert.equal(

      api.LAGO_AGENT_IDENTITY
        .getCurrent()
        .agentId,

      lago.agentId

    );

  }
);


/*
 * TEST 08 — LOCAL BOND SEPARATION
 */

test(
  "keeps local gameplay bonds separate",
  () => {

    const fx = fixture();

    const { api } = fx;

    const runtime =
      api.LAGO_AGENT_BOND_RUNTIME;


    const context =
      runtime.getContext();


    const reward =
      runtime.recordEvent({

        eventId: "synthetic-tap:1",

        eventType: "tap_accepted",

        scope: context.scope,

        characterId: context.characterId

      });


    assert.equal(reward.ok, true);


    assert.equal(

      runtime.getState()
        .progression.points,

      1

    );


    const duplicate =
      runtime.recordEvent({

        eventId: "synthetic-tap:1",

        eventType: "tap_accepted",

        scope: context.scope,

        characterId: context.characterId

      });


    assert.equal(
      duplicate.duplicate,
      true
    );


    fx.select("comic_pink_snail");


    assert.equal(

      runtime.getState()
        .progression.points,

      0

    );


    fx.select("lago");


    assert.equal(

      runtime.getState()
        .progression.points,

      1

    );


    fx.changeLocalOwner("synthetic_b");


    assert.equal(

      runtime.getState()
        .progression.points,

      0

    );

  }
);


/*
 * TEST 09 — MEMORY SCHEMA COMPATIBILITY
 */

test(
  "validates canonical server records in the client schema",
  () => {

    const fx = fixture();

    const { api } = fx;


    fx.authenticate(ACCOUNT_A);


    const identity =
      api.LAGO_AGENT_IDENTITY.getCurrent();


    const entry =
      createMemoryRecord({

        accountId: ACCOUNT_A,

        characterId: "lago",

        category: "owner",

        content: "Synthetic preference.",

        importance: 80

      });


    assert.equal(

      validateMemoryRecord(entry),

      true

    );


    assert.equal(

      api.LAGO_AGENT_MEMORY
        .validateRecord(entry),

      true

    );


    assert.equal(

      api.LAGO_AGENT_MEMORY
        .belongsToIdentity(entry, identity),

      true

    );


    const metadata =
      api.LAGO_AGENT_MEMORY_INTELLIGENCE
        .classifyRecord(entry);


    assert.equal(

      metadata.importanceLevel,

      "critical"

    );


    assert.equal(

      metadata.authorityGranted,

      false

    );


    assert.equal(

      Object.hasOwn(metadata, "content"),

      false

    );

  }
);


/*
 * TEST 10 — MEMORY CONTEXT FILTERING
 */

test(
  "filters foreign memories and returns only metadata",
  () => {

    const fx = fixture();

    const { api } = fx;


    fx.authenticate(ACCOUNT_A);


    const identity =
      api.LAGO_AGENT_IDENTITY.getCurrent();


    function memory(
      accountId,
      characterId,
      category,
      importance
    ) {

      return createMemoryRecord({

        accountId,

        characterId,

        category,

        importance,

        content: "Synthetic context."

      });

    }


    const high = memory(

      ACCOUNT_A,
      "lago",
      "owner",
      95

    );


    const low = memory(

      ACCOUNT_A,
      "lago",
      "conversation",
      30

    );


    const foreignAccount = memory(

      ACCOUNT_B,
      "lago",
      "owner",
      100

    );


    const foreignCharacter = memory(

      ACCOUNT_A,
      "comic_pink_snail",
      "owner",
      100

    );


    const excluded = memory(

      ACCOUNT_A,
      "lago",
      "trading",
      100

    );


    const result =
      api.LAGO_AGENT_MEMORY_INTELLIGENCE
        .selectCandidates({

          identity,

          records: [

            low,

            foreignAccount,

            foreignCharacter,

            excluded,

            high

          ],

          purpose: "conversation",

          limit: 1

        });


    assert.equal(result.ok, true);

    assert.equal(result.rejectedCount, 2);

    assert.equal(result.excludedCount, 1);

    assert.equal(result.selectedCount, 1);

    assert.equal(

      result.selectedMemoryIds[0],

      high.memoryId

    );


    assert.equal(

      result.recallAuthorized,

      false

    );


    assert.equal(

      result.authorizationGranted,

      false

    );


    assert.equal(

      JSON.stringify(result).includes(
        high.content
      ),

      false

    );

  }
);


/*
 * TEST 11 — PAID AI RESTRICTIONS
 */

test(
  "identity and gameplay do not unlock paid AI",
  () => {

    const fx = fixture();

    const { api } = fx;


    fx.authenticate(ACCOUNT_A);


    const state =
      api.LAGO_AGENT_ACCESS.getState();


    assert.equal(

      state.billingModel,

      "subscription"

    );


    assert.equal(

      state.billingInterval,

      "month"

    );


    assert.equal(state.entitled, false);

    assert.equal(state.serverVerified, false);


    assert.equal(

      api.LAGO_AGENT_ACCESS.canUseAI(),

      false

    );


    assert.equal(

      api.LAGO_AGENT_ACCESS.canTrade(),

      false

    );


    assert.equal(

      api.LAGO_AGENT_MEMORY.canRecall(),

      false

    );


    assert.equal(

      api.LAGO_AGENT_MEMORY.canStore(),

      false

    );


    assert.equal(

      api.LAGO_AGENT_MEMORY.canLearn(),

      false

    );

  }
);


/*
 * TEST 12 — MISSING DEPENDENCIES
 */

test(
  "fails closed when an agent dependency is missing",
  () => {

    const { api } = fixture();


    delete api.LAGO_AGENT_DNA;


    const result =
      api.LAGO_AGENT_CONTEXT.getCurrent();


    assert.equal(result.ready, false);

    assert.equal(result.context, null);


    assert.equal(

      result.reason,

      "dependencies_unavailable"

    );


    assert.equal(

      result.aiExecutionAuthorized,

      false

    );


    assert.equal(

      result.memoryRecallAuthorized,

      false

    );


    assert.equal(

      result.tradingAuthorized,

      false

    );

  }
);

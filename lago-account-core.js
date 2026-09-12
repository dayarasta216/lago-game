(() => {
  "use strict";

  /*
   * =========================================================
   * LAGO ACCOUNT CORE
   * R0.3D1
   *
   * One account state for the entire Lago Game platform.
   *
   * Future games:
   * Tap Lago
   * Knife Challenge
   * Slowest Race
   * Brain Loading
   * ...
   *
   * all use the same:
   * MEM / XP / LEVEL / SKINS / STATS
   * =========================================================
   */

  const STORAGE_KEY =
  "lago_account_state_v2";

const LEGACY_ACCOUNT_KEY =
  "lago_account_state_v1";

const LEGACY_BRIDGE_KEY =
  "lago_game_state_v2";

const LEGACY_TAP_KEY =
  "lago_brainrot_save_v1";

const LANGUAGE_KEY =
  "lago_language_v1";

const SCHEMA_VERSION = 2;


const DUM_DEFAULT_MAX =
  100;


const DUM_REGEN_SECONDS =
  120;


/*
 * TAP LAGO AUTO — FREE GRIND PATH
 *
 * Intentionally expensive.
 *
 * Paid $LAGO purchase / upgrade
 * arrives later in R0.5E.
 */
const TAP_AUTO_MAX_LEVEL =
  10;


const TAP_AUTO_FREE_BASE_LIFETIME_SP =
  30000;


const TAP_AUTO_FREE_BASE_SP_COST =
  25000;


const TAP_AUTO_FREE_DUM_COST =
  100;


const HEIST_BASE_CHANCE =
  0.35;


const HEIST_MIN_CHANCE =
  0.10;


const HEIST_MAX_CHANCE =
  0.75;

  const DOUBLE_CLICK_SP_COST =
  10000;


const defaults = {

  schemaVersion:
    SCHEMA_VERSION,

  mem:
    0,
    xp:
      0,

    level:
      1,

    clicks:
  0,

tapUpgrades: {

  doubleClick:
    false

},
/*
 * =========================================================
 * R0.5 ACCOUNT MODEL
 * =========================================================
 */

economy: {

  /*
   * Real Solana / Pump.fun $LAGO.
   *
   * Old MEM must NEVER become $LAGO.
   */
  lagoBalance:
    0,

  /*
   * Permanent progression.
   */
  sp:
    0,

  level:
    1

},


energy: {

  /*
   * DUM Energy = stamina.
   */
  dum:
    DUM_DEFAULT_MAX,

  max:
    DUM_DEFAULT_MAX,

  /*
   * 1 DUM every 120 sec.
   */
  regenSecondsPerPoint:
    DUM_REGEN_SECONDS,

  updatedAt:
    null,

  /*
   * R0.5B:
   * every 5 Tap Lago taps
   * will cost 1 DUM.
   */
  tapCounter:
    0

},


life: {

  value:
    100,

  max:
    100,

  status:
    "alive",

  lastActiveAt:
    null,

  lastDecayAt:
    null,

  consecutiveDays:
    0

},


heist: {

  skill:
    0,

  heat:
    0,

  attempts:
    0,

  successes:
    0,

  failures:
    0,

  protectedUntil:
    null,

  revenge:
    []

},


social: {

  userId:
    "",

  username:
    "",

  friends:
    [],

  blocked:
    [],

  discoverByWallet:
    false

},

 /*
 * =========================================================
 * ACCOUNT AUTH / IDENTITY
 * =========================================================
 *
 * Telegram = account login.
 * Phantom = payment wallet.
 *
 * Server verification arrives later.
 */
auth: {

  provider:
    "",

  telegramId:
    "",

  telegramUsername:
    "",

  telegramDisplayName:
    "",

  telegramLinked:
    false,

  /*
   * Client MUST NOT set this true.
   * Only verified backend auth
   * will be allowed to do that.
   */
  telegramVerified:
    false,

  telegramLinkedAt:
    null,

  walletPublicKey:
    "",

  walletLinked:
    false,

  walletLinkedAt:
    null

}, 

inventory: {

  protected:
    [],

  raidable:
    [],

  equipped:
    [],

  trophies:
    []

},


skins:
  [],

    selectedSkin:
      "default",

    language:
      "en",

    country:
      "",

    /*
     * Per-game statistics.
     *
     * Example:
     *
     * games["tap-lago"]
     * games["knife-challenge"]
     */

    games:
      {},

    lifetime: {

  /*
   * Canonical R0.5 counters.
   */
  spEarned:
  0,

spSpent:
  0,

dumSpent:
  0,

  dumRegenerated:
    0,

  heistAttempts:
    0,

  heistSuccesses:
    0,


  /*
   * Legacy compatibility.
   */
  memEarned:
    0,

  memSpent:
    0,

  xpEarned:
    0

},

    updatedAt:
      null

  };


  function clone(
    value
  ) {

    return JSON.parse(
      JSON.stringify(
        value
      )
    );

  }


  function readJSON(
    key
  ) {

    try {

      const raw =
        localStorage.getItem(
          key
        );


      return raw
        ? JSON.parse(raw)
        : null;

    } catch {

      return null;

    }

  }


  function uniqueStrings(
    values
  ) {

    return [
      ...new Set(
        (values || [])
          .filter(
            value =>
              typeof value ===
                "string" &&
              value
          )
      )
    ];

   }


function clamp(
  value,
  min,
  max
) {

  return Math.min(
    max,
    Math.max(
      min,
      Number(value) || 0
    )
  );

}


function resolveLifeStatus(
  value,
  max = 100
) {

  const safeMax =
    Math.max(
      1,
      Number(max) || 100
    );


  const life =
    clamp(
      value,
      0,
      safeMax
    );


  const percent =
    (
      life /
      safeMax
    ) *
    100;


  if (
    percent <= 0
  ) {

    return "dead";

  }


  if (
    percent <= 25
  ) {

    return "dying";

  }


  if (
    percent <= 50
  ) {

    return "dumb";

  }


  if (
    percent <= 75
  ) {

    return "tired";

  }


  return "alive";

}

  function sanitize(
    input = {}
  ) {

    const next = {

      ...clone(
        defaults
      ),

      ...(
        input &&
        typeof input === "object"
          ? input
          : {}
      )

    };


    next.schemaVersion =
      SCHEMA_VERSION;


    next.mem =
      Math.max(
        0,
        Number(
          next.mem
        ) || 0
      );


    next.xp =
      Math.max(
        0,
        Number(
          next.xp
        ) || 0
      );


    next.level =
      Math.max(
        1,
        Math.floor(
          Number(
            next.level
          ) || 1
        )
      );


   next.clicks =
  Math.max(
    0,
    Math.floor(
      Number(
        next.clicks
      ) || 0
    )
  );


/*
 * =========================================================
 * ECONOMY v2
 * =========================================================
 */

next.economy = {

  ...clone(
    defaults.economy
  ),

  ...(
    input.economy &&
    typeof input.economy ===
      "object" &&
    !Array.isArray(
      input.economy
    )

      ? input.economy
      : {}
  )

};


/*
 * $LAGO never comes from MEM.
 */
next.economy.lagoBalance =
  Math.max(
    0,
    Number(
      input.economy
        ?.lagoBalance
    ) || 0
  );


/*
 * Existing XP migrates to SP.
 */
next.economy.sp =
  Math.max(
    0,
    Number(
      input.economy
        ?.sp ??
      next.xp
    ) || 0
  );


/*
 * Temporary compatibility.
 */
next.xp =
  next.economy.sp;


/*
 * =========================================================
 * DUM ENERGY
 * =========================================================
 */

next.energy = {

  ...clone(
    defaults.energy
  ),

  ...(
    input.energy &&
    typeof input.energy ===
      "object" &&
    !Array.isArray(
      input.energy
    )

      ? input.energy
      : {}
  )

};


next.energy.max =
  Math.max(
    1,
    Math.floor(
      Number(
        next.energy.max
      ) ||
      DUM_DEFAULT_MAX
    )
  );


next.energy.dum =
  Math.min(
    next.energy.max,

    Math.max(
      0,
      Number(
        next.energy.dum
      ) || 0
    )
  );


next.energy.regenSecondsPerPoint =
  Math.max(
    10,
    Math.floor(
      Number(
        next.energy
          .regenSecondsPerPoint
      ) ||
      DUM_REGEN_SECONDS
    )
  );


next.energy.tapCounter =
  Math.min(
    4,

    Math.max(
      0,
      Math.floor(
        Number(
          next.energy
            .tapCounter
        ) || 0
      )
    )
  );


next.energy.updatedAt =
  typeof next.energy
    .updatedAt ===
    "string"

    ? next.energy.updatedAt
    : null;


/*
 * =========================================================
 * LAGO LIFE
 * =========================================================
 */

next.life = {

  ...clone(
    defaults.life
  ),

  ...(
    input.life &&
    typeof input.life ===
      "object" &&
    !Array.isArray(
      input.life
    )

      ? input.life
      : {}
  )

};


next.life.max =
  Math.max(
    1,
    Math.floor(
      Number(
        next.life.max
      ) || 100
    )
  );


next.life.value =
  Math.min(
    next.life.max,

    Math.max(
      0,
      Number(
        next.life.value
      ) || 0
    )
  );


next.life.status =
  resolveLifeStatus(
    next.life.value,
    next.life.max
  );

/*
 * =========================================================
 * HEIST
 * =========================================================
 */

next.heist = {

  ...clone(
    defaults.heist
  ),

  ...(
    input.heist &&
    typeof input.heist ===
      "object" &&
    !Array.isArray(
      input.heist
    )

      ? input.heist
      : {}
  )

};


next.heist.skill =
  Math.max(
    0,
    Math.floor(
      Number(
        next.heist.skill
      ) || 0
    )
  );


next.heist.heat =
  Math.min(
    100,

    Math.max(
      0,
      Number(
        next.heist.heat
      ) || 0
    )
  );


next.heist.attempts =
  Math.max(
    0,
    Math.floor(
      Number(
        next.heist.attempts
      ) || 0
    )
  );


next.heist.successes =
  Math.max(
    0,
    Math.floor(
      Number(
        next.heist.successes
      ) || 0
    )
  );


next.heist.failures =
  Math.max(
    0,
    Math.floor(
      Number(
        next.heist.failures
      ) || 0
    )
  );


next.heist.revenge =
  Array.isArray(
    next.heist.revenge
  )

    ? next.heist.revenge
    : [];


/*
 * =========================================================
 * SOCIAL
 * =========================================================
 */

next.social = {

  ...clone(
    defaults.social
  ),

  ...(
    input.social &&
    typeof input.social ===
      "object" &&
    !Array.isArray(
      input.social
    )

      ? input.social
      : {}
  )

};


next.social.friends =
  uniqueStrings(
    next.social.friends
  );


next.social.blocked =
  uniqueStrings(
    next.social.blocked
  );

/*
 * =========================================================
 * AUTH / IDENTITY
 * =========================================================
 */

next.auth = {

  ...clone(
    defaults.auth
  ),

  ...(
    input.auth &&
    typeof input.auth ===
      "object" &&
    !Array.isArray(
      input.auth
    )

      ? input.auth
      : {}
  )

};


next.auth.provider =
  String(
    next.auth.provider ||
    ""
  ).trim();


next.auth.telegramId =
  String(
    next.auth.telegramId ||
    ""
  ).trim();


next.auth.telegramUsername =
  String(
    next.auth.telegramUsername ||
    ""
  ).trim();


next.auth.telegramDisplayName =
  String(
    next.auth.telegramDisplayName ||
    ""
  ).trim();


next.auth.telegramLinked =
  Boolean(
    next.auth.telegramLinked &&
    next.auth.telegramId
  );


/*
 * Never trust a persisted
 * client-side "verified" flag.
 *
 * Backend verification will later
 * hydrate authoritative auth state.
 */
next.auth.telegramVerified =
  false;


next.auth.telegramLinkedAt =
  typeof next.auth
    .telegramLinkedAt ===
    "string"

    ? next.auth.telegramLinkedAt
    : null;


next.auth.walletPublicKey =
  String(
    next.auth.walletPublicKey ||
    ""
  ).trim();


next.auth.walletLinked =
  Boolean(
    next.auth.walletLinked &&
    next.auth.walletPublicKey
  );


next.auth.walletLinkedAt =
  typeof next.auth
    .walletLinkedAt ===
    "string"

    ? next.auth.walletLinkedAt
    : null;
    
/*
 * =========================================================
 * INVENTORY
 * =========================================================
 */

next.inventory = {

  ...clone(
    defaults.inventory
  ),

  ...(
    input.inventory &&
    typeof input.inventory ===
      "object" &&
    !Array.isArray(
      input.inventory
    )

      ? input.inventory
      : {}
  )

};


next.inventory.protected =
  uniqueStrings(
    next.inventory.protected
  );


next.inventory.raidable =
  uniqueStrings(
    next.inventory.raidable
  );


next.inventory.equipped =
  uniqueStrings(
    next.inventory.equipped
  );


next.inventory.trophies =
  uniqueStrings(
    next.inventory.trophies
  );


next.skins =
      uniqueStrings(
        next.skins
      );


    next.selectedSkin =
      typeof next.selectedSkin ===
        "string" &&
      next.selectedSkin

        ? next.selectedSkin
        : "default";


    next.language =
      typeof next.language ===
        "string" &&
      next.language

        ? next.language
        : "en";


    next.country =
      typeof next.country ===
        "string"

        ? next.country
        : "";


    next.games =

      next.games &&
      typeof next.games ===
        "object" &&
      !Array.isArray(
        next.games
      )

        ? next.games
        : {};


    next.lifetime = {

      ...clone(
        defaults.lifetime
      ),

      ...(
        next.lifetime &&
        typeof next.lifetime ===
          "object"

          ? next.lifetime
          : {}
      )

    };


    next.lifetime.memEarned =
      Math.max(
        0,
        Number(
          next.lifetime.memEarned
        ) || 0
      );


    next.lifetime.memSpent =
      Math.max(
        0,
        Number(
          next.lifetime.memSpent
        ) || 0
      );


   next.lifetime.xpEarned =
  Math.max(
    0,
    Number(
      next.lifetime.xpEarned
    ) || 0
  );


next.lifetime.spEarned =
  Math.max(

    next.economy.sp,

    Number(
      next.lifetime.spEarned
    ) || 0,

    next.lifetime.xpEarned

  );


next.lifetime.spSpent =
  Math.max(
    0,
    Number(
      next.lifetime.spSpent
    ) || 0
  );


next.lifetime.dumSpent =
  Math.max(
    0,
    Number(
      next.lifetime.dumSpent
    ) || 0
  );


next.lifetime.dumRegenerated =
  Math.max(
    0,
    Number(
      next.lifetime
        .dumRegenerated
    ) || 0
  );


next.lifetime.heistAttempts =
  Math.max(
    0,
    Math.floor(
      Number(
        next.lifetime
          .heistAttempts
      ) || 0
    )
  );


next.lifetime.heistSuccesses =
  Math.max(
    0,
    Math.floor(
      Number(
        next.lifetime
          .heistSuccesses
      ) || 0
    )
  );


updateLevel(
  next,
  false
);


/*
 * Synchronize canonical v2 progression
 * with old compatibility fields.
 */
next.xp =
  next.economy.sp;


next.economy.level =
  next.level;


/*
 * First creation of DUM Energy.
 *
 * Old MEM and old Tap energy
 * are deliberately NOT imported.
 */
if (
  !next.energy.updatedAt
) {

  next.energy.dum =
    next.energy.max;

  next.energy.updatedAt =
    new Date()
      .toISOString();

}


return next;

  }


  /*
   * =========================================================
   * MIGRATION
   *
   * We DO NOT delete old saves yet.
   *
   * The Account Core reads them once
   * and creates the new unified account.
   * =========================================================
   */

  function migrate() {

    const current =
  readJSON(
    STORAGE_KEY
  );


if (current) {

  return sanitize(
    current
  );

}


/*
 * Migration from Account Core v1.
 *
 * We do not delete the old save.
 */
const oldAccount =
  readJSON(
    LEGACY_ACCOUNT_KEY
  );


if (oldAccount) {

  return sanitize(
    oldAccount
  );

}


const oldBridge =
      readJSON(
        LEGACY_BRIDGE_KEY
      ) || {};


    const oldTap =
      readJSON(
        LEGACY_TAP_KEY
      ) || {};


    const savedLanguage =
      localStorage.getItem(
        LANGUAGE_KEY
      );


    /*
     * Important:
     *
     * Old project had TWO MEM-like
     * balances.
     *
     * We take the larger one,
     * not the sum.
     *
     * This prevents duplicated MEM
     * during migration.
     */

    const bridgeMem =
      Number(
        oldBridge.mem
      ) || 0;


    const tapMem =
      Number(
        oldTap.energy
      ) || 0;


    const mem =
      Math.max(
        0,
        bridgeMem,
        tapMem
      );


    return sanitize({

      mem,

      xp:
        Number(
          oldBridge.xp
        ) || 0,

      level:
        Number(
          oldBridge.level
        ) || 1,

      clicks:
        Math.max(

          Number(
            oldBridge.clicks
          ) || 0,

          Number(
            oldTap.totalClicks
          ) || 0

        ),

      skins:
        oldBridge.skins ||
        [],

      selectedSkin:
        oldBridge.selectedSkin ||
        "default",

      language:
        savedLanguage ||
        oldBridge.language ||
        "en",

      country:
        oldBridge.country ||
        "",

      lifetime: {

        memEarned:
          mem,

        memSpent:
          0,

        xpEarned:
          Number(
            oldBridge.xp
          ) || 0

      }

    });

  }


  let state =
    migrate();


  function snapshot() {

    return clone(
      state
    );

  }


  /*
   * =========================================================
   * LEVEL
   * =========================================================
   */

  function updateLevel(
    target = state,
    announce = true
  ) {

    const previous =
      Math.max(
        1,
        Number(
          target.level
        ) || 1
      );


    /*
 * LEVEL is permanent progression.
 *
 * Spending current SP balance
 * must NEVER reduce LEVEL.
 */
const lifetimeSp =
  Math.max(
    0,
    Number(
      target.lifetime
        ?.spEarned ??
      target.xp
    ) || 0
  );


const next =
  Math.floor(
    lifetimeSp / 100
  ) + 1;


   target.level =
  Math.max(
    1,
    next
  );


/*
 * R0.5 canonical progression.
 *
 * Top-level xp / level remain
 * temporary compatibility fields.
 */

if (
  target.economy &&
  typeof target.economy ===
    "object"
) {

 target.xp =
  Math.max(
    0,
    Number(
      target.economy.sp
    ) || 0
  );


target.economy.level =
  target.level;

}


if (
  announce &&
      target.level >
      previous
    ) {

      document.dispatchEvent(

        new CustomEvent(
          "lago:levelup",
          {

            detail: {

              level:
                target.level

            }

          }
        )

      );

    }

  }


  /*
   * =========================================================
   * SAVE / EVENTS
   * =========================================================
   */

  function save(
    {
      emit = true
    } = {}
  ) {

    state.updatedAt =
      new Date()
        .toISOString();


    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(
        state
      )
    );


    if (emit) {

      sync();

    }


    return snapshot();

  }


  function sync() {

    const detail =
      snapshot();


    /*
     * New canonical event.
     */

    document.dispatchEvent(

      new CustomEvent(
        "lago:account-state",
        {
          detail
        }
      )

    );


    /*
     * Temporary compatibility
     * for existing modules.
     */

    document.dispatchEvent(

      new CustomEvent(
        "lago:state",
        {
          detail
        }
      )

    );

  }


  /*
 * =========================================================
 * LEGACY MEM COMPATIBILITY
 * =========================================================
 *
 * MEM is no longer an active currency.
 *
 * Old callers are redirected to SP so
 * legacy modules cannot create or spend
 * a second economy.
 *
 * Persisted mem / lifetime.mem* fields
 * remain read-only migration history.
 */

function creditMem(
  amount = 0,
  options = {}
) {

  const value =
    Math.max(
      0,
      Number(
        amount
      ) || 0
    );


  if (!value) {

    return snapshot();

  }


  if (
    options.countClick ===
    true
  ) {

    state.clicks += 1;

  }

  function roundSPAmount(
  value
) {

  const number =
    Number(
      value
    );


  if (
    !Number.isFinite(
      number
    )
  ) {

    return 0;

  }


  return (
    Math.round(
      number *
      100
    ) /
    100
  );

}


  return addSP(
    value,
    {
      gameId:
        options.gameId ||
        undefined
    }
  );

}


function spendMem(
  amount = 0,
  options = {}
) {

  return spendSP(
    amount,
    {
      gameId:
        options.gameId ||
        undefined
    }
  );

}


/*
 * =========================================================
 * SP — CANONICAL PROGRESSION
 * =========================================================
 */

/*
 * =========================================================
 * SP — CANONICAL PROGRESSION
 * =========================================================
 */

function addSP(
  amount = 0,
  options = {}
) {

  const value =
  Math.max(
    0,
    roundSPAmount(
      amount
    )
  );

  if (!value) {

    return snapshot();

  }


  /*
 * economy.sp is canonical.
 *
 * Top-level xp is only a
 * compatibility mirror for
 * old saves / old modules.
 */

state.balance =
  roundSPAmount(
    Number(
      state.balance
    ) +
    gain
  );


state.xp =
  state.economy.sp;


state.sp.lifetimeEarned =
  roundSPAmount(
    Number(
      state.sp.lifetimeEarned
    ) +
    gain
  );

  if (
    options.gameId
  ) {

    const game =
      ensureGame(
        options.gameId
      );


   game.xpEarned =

      Math.max(
        0,
        Number(
          game.spEarned
        ) || 0
      ) +
      value;

  }


  updateLevel(
    state,
    true
  );


  return save();

}

/*
 * =========================================================
 * SP BALANCE — SPENDABLE GAME CURRENCY
 * =========================================================
 *
 * economy.sp
 * = current spendable SP balance.
 *
 * lifetime.spEarned
 * = permanent progression history.
 *
 * Spending SP must NEVER reduce
 * lifetime.spEarned or LEVEL.
 */

function getSPState() {

  return {

    balance:
  Math.max(
    0,
    roundSPAmount(
      state.sp.balance
    )
  ),

   lifetimeEarned:
  Math.max(
    0,
    roundSPAmount(
      state.sp.lifetimeEarned
    )
  ),

    lifetimeSpent:
      Math.max(
        0,
        Math.floor(
          Number(
            state.lifetime
              ?.spSpent
          ) || 0
        )
      ),

    level:
      Math.max(
        1,
        Math.floor(
          Number(
            state.economy
              ?.level ??
            state.level
          ) || 1
        )
      )

  };

}

function getDoubleClickUpgradeState() {

  const unlocked =
    state
      ?.tapUpgrades
      ?.doubleClick ===
      true;


  return {

    unlocked,

    multiplier:
      unlocked
        ? 2
        : 1,

    spCost:
      DOUBLE_CLICK_SP_COST

  };

}

function unlockDoubleClick() {

  const upgrade =
    getDoubleClickUpgradeState();


  /*
   * Уже куплен.
   */
  if (
    upgrade.unlocked
  ) {

    return {

      ok:
        false,

      reason:
        "owned",

      ...upgrade

    };

  }


  const balance =
    Math.max(
      0,
      roundSPAmount(
        state
          ?.sp
          ?.balance
      )
    );


  /*
   * Не хватает SP.
   */
  if (
    balance <
    DOUBLE_CLICK_SP_COST
  ) {

    return {

      ok:
        false,

      reason:
        "sp",

      balance,

      spCost:
        DOUBLE_CLICK_SP_COST

    };

  }


  /*
   * Покупка производится одной
   * account-транзакцией.
   */
  state.sp.balance =
    roundSPAmount(
      balance -
      DOUBLE_CLICK_SP_COST
    );


  if (
    !state.tapUpgrades ||
    typeof state.tapUpgrades !==
      "object"
  ) {

    state.tapUpgrades = {};

  }


  state.tapUpgrades.doubleClick =
    true;


  save();


  /*
   * Обновляем весь интерфейс аккаунта.
   */
  publishState?.();


  return {

    ok:
      true,

    unlocked:
      true,

    multiplier:
      2,

    spCost:
      DOUBLE_CLICK_SP_COST,

    balance:
      state.sp.balance

  };

}
  
function canSpendSP(
  amount = 0
) {

  const value =
    Math.max(
      0,
      Math.floor(
        Number(
          amount
        ) || 0
      )
    );


  return (
    state.economy.sp >=
    value
  );

}


function spendSP(
  amount,
  meta = {}
) {

  const cost =
    Math.max(
      0,
      roundSPAmount(
        amount
      )
    );


  if (
    cost <= 0
  ) {

    return false;

  }


  if (
    !canSpendSP(
      cost
    )
  ) {

    return false;

  }


  state.sp.balance =
    roundSPAmount(
      Number(
        state.sp.balance
      ) -
      cost
    );


  save();


  publishState?.();


  return true;

}
  /*
 * =========================================================
 * ATOMIC GAMEPLAY RESOURCE COST
 * =========================================================
 *
 * Shared foundation for:
 * AUTO
 * HEIST
 * mini-game helpers
 * gameplay purchases
 *
 * SP + DUM are checked first,
 * then spent together and saved once.
 */
function spendGameplayResources(
  {
    sp = 0,
    dum = 0,
    gameId = ""
  } = {}
) {

  refreshDumEnergy({
    persist:
      false
  });


  const spCost =
    Math.max(
      0,
      Math.floor(
        Number(sp) || 0
      )
    );


  const dumCost =
    Math.max(
      0,
      Math.floor(
        Number(dum) || 0
      )
    );


  if (
    state.economy.sp <
    spCost
  ) {

    return {
      ok:
        false,
      reason:
        "sp",
      spCost,
      dumCost,
      sp:
        state.economy.sp,
      dum:
        state.energy.dum
    };

  }


  if (
    state.energy.dum <
    dumCost
  ) {

    return {
      ok:
        false,
      reason:
        "dum",
      spCost,
      dumCost,
      sp:
        state.economy.sp,
      dum:
        state.energy.dum
    };

  }


  const wasFull =
    state.energy.dum >=
    state.energy.max;


  state.economy.sp -=
    spCost;


  /*
   * XP is still temporary
   * compatibility mirror
   * of CURRENT SP balance.
   */
  state.xp =
    state.economy.sp;


  state.lifetime.spSpent =
    Math.max(
      0,
      Number(
        state.lifetime.spSpent
      ) || 0
    ) +
    spCost;


  state.energy.dum -=
    dumCost;


  state.lifetime.dumSpent =
    Math.max(
      0,
      Number(
        state.lifetime.dumSpent
      ) || 0
    ) +
    dumCost;


  if (
    dumCost > 0 &&
    (
      wasFull ||
      !state.energy.updatedAt
    )
  ) {

    state.energy.updatedAt =
      new Date()
        .toISOString();

  }


  const id =
    String(
      gameId || ""
    ).trim();


  if (id) {

    const game =
      ensureGame(id);


    game.spSpent =
      Math.max(
        0,
        Number(
          game.spSpent
        ) || 0
      ) +
      spCost;


    game.dumSpent =
      Math.max(
        0,
        Number(
          game.dumSpent
        ) || 0
      ) +
      dumCost;

  }


  save();


  return {
    ok:
      true,
    reason:
      "spent",
    spCost,
    dumCost,
    sp:
      state.economy.sp,
    dum:
      state.energy.dum
  };

}
  
  /*
 * =========================================================
 * DUM ENERGY — CANONICAL STAMINA
 * =========================================================
 */


/*
 * Calculates offline regeneration.
 *
 * Current rule:
 * +1 DUM every 120 seconds.
 */
function refreshDumEnergy(
  {
    persist = true
  } = {}
) {

  const now =
    Date.now();


  const max =
    Math.max(
      1,
      Math.floor(
        Number(
          state.energy.max
        ) ||
        DUM_DEFAULT_MAX
      )
    );


  state.energy.max =
    max;


  state.energy.dum =
    clamp(
      state.energy.dum,
      0,
      max
    );


  /*
   * No regeneration is needed
   * while already full.
   */
  if (
    state.energy.dum >=
    max
  ) {

    state.energy.dum =
      max;

    return 0;

  }


  const previousTime =
    Date.parse(
      state.energy.updatedAt ||
      ""
    );


  /*
   * Invalid or missing timestamp:
   * start regeneration from now.
   */
  if (
    !Number.isFinite(
      previousTime
    )
  ) {

    state.energy.updatedAt =
      new Date(now)
        .toISOString();


    if (persist) {

      save();

    }


    return 0;

  }


  const interval =
    Math.max(
      10,
      Math.floor(
        Number(
          state.energy
            .regenSecondsPerPoint
        ) ||
        DUM_REGEN_SECONDS
      )
    ) *
    1000;


  const elapsed =
    Math.max(
      0,
      now -
      previousTime
    );


  const availablePoints =
    Math.floor(
      elapsed /
      interval
    );


  if (
    availablePoints <= 0
  ) {

    return 0;

  }


  const before =
    state.energy.dum;


  state.energy.dum =
    Math.min(
      max,
      before +
      availablePoints
    );


  const gained =
    state.energy.dum -
    before;


  state.lifetime
    .dumRegenerated =
    Math.max(
      0,
      Number(
        state.lifetime
          .dumRegenerated
      ) || 0
    ) +
    gained;


  /*
   * Preserve partial regeneration time
   * if DUM is still below MAX.
   */
  if (
    state.energy.dum <
    max
  ) {

    state.energy.updatedAt =
      new Date(
        previousTime +
        availablePoints *
        interval
      ).toISOString();

  } else {

    state.energy.updatedAt =
      new Date(now)
        .toISOString();

  }


  if (
    persist &&
    gained > 0
  ) {

    save();

  }


  return gained;

}


/*
 * Read current DUM state.
 */
function getDumEnergy() {

  refreshDumEnergy();


  return {

    dum:
      state.energy.dum,

    max:
      state.energy.max,

    regenSecondsPerPoint:
      state.energy
        .regenSecondsPerPoint,

    tapCounter:
      state.energy
        .tapCounter

  };

}


/*
 * Check before an action.
 */
function canSpendDum(
  amount = 0
) {

  refreshDumEnergy();


  const value =
    Math.max(
      0,
      Math.floor(
        Number(
          amount
        ) || 0
      )
    );


  return (
    state.energy.dum >=
    value
  );

}


/*
 * Spend stamina.
 *
 * Examples later:
 *
 * Tap       → 1 / 5 taps
 * Scout     → 2
 * Mini-game → 5+
 * Heist     → 10+
 */
function spendDum(
  amount = 0,
  options = {}
) {

  refreshDumEnergy();


  const value =
    Math.max(
      0,
      Math.floor(
        Number(
          amount
        ) || 0
      )
    );


  if (!value) {

    return true;

  }


  if (
    state.energy.dum <
    value
  ) {

    return false;

  }


  const wasFull =
    state.energy.dum >=
    state.energy.max;


  state.energy.dum -=
    value;


  state.lifetime
    .dumSpent =
    Math.max(
      0,
      Number(
        state.lifetime
          .dumSpent
      ) || 0
    ) +
    value;


  /*
   * The regeneration clock starts
   * as soon as we leave MAX.
   */
  if (
    wasFull ||
    !state.energy.updatedAt
  ) {

    state.energy.updatedAt =
      new Date()
        .toISOString();

  }


  if (
    options.gameId
  ) {

    const game =
      ensureGame(
        options.gameId
      );


    game.dumSpent =
      Math.max(
        0,
        Number(
          game.dumSpent
        ) || 0
      ) +
      value;

  }


  save();


  return true;

}


/*
 * Restore DUM without allowing
 * the balance to exceed MAX.
 */
function restoreDum(
  amount = 0
) {

  refreshDumEnergy();


  const value =
    Math.max(
      0,
      Math.floor(
        Number(
          amount
        ) || 0
      )
    );


  if (!value) {

    return snapshot();

  }


  state.energy.dum =
    Math.min(
      state.energy.max,
      state.energy.dum +
      value
    );


  /*
   * At MAX there is no partially
   * completed regeneration timer.
   */
  
  if (
    state.energy.dum >=
    state.energy.max
  ) {

    state.energy.updatedAt =
      new Date()
        .toISOString();

  }


  return save();

}

  /*
 * =========================================================
 * TAP LAGO — DUM COST
 * =========================================================
 */


/*
 * Tap rule:
 *
 * - player must have at least 1 DUM
 * - every successful tap increments tapCounter
 * - every 5th successful tap spends 1 DUM
 *
 * tapCounter:
 * 0 → 1 → 2 → 3 → 4 → spend 1 → 0
 */
function consumeTapDum(
  options = {}
) {

  /*
   * Apply offline regeneration first,
   * but save only once at the end.
   */
  refreshDumEnergy({
    persist:
      false
  });


  /*
   * Zero DUM means Tap Lago
   * cannot continue.
   */
  if (
    state.energy.dum <= 0
  ) {

    return {

      allowed:
        false,

      spent:
        0,

      dum:
        state.energy.dum,

      max:
        state.energy.max,

      tapCounter:
        state.energy.tapCounter

    };

  }


  const counter =
    Math.max(
      0,
      Math.floor(
        Number(
          state.energy
            .tapCounter
        ) || 0
      )
    );


  const nextCounter =
    counter + 1;


  /*
   * Taps 1–4:
   * no DUM is spent yet.
   */
  if (
    nextCounter < 5
  ) {

    state.energy.tapCounter =
      nextCounter;


    save();


    return {

      allowed:
        true,

      spent:
        0,

      dum:
        state.energy.dum,

      max:
        state.energy.max,

      tapCounter:
        state.energy.tapCounter

    };

  }


  /*
   * Every 5th successful tap:
   * spend exactly 1 DUM.
   */
  const wasFull =
    state.energy.dum >=
    state.energy.max;


  state.energy.dum -=
    1;


  state.energy.tapCounter =
    0;


  state.lifetime
    .dumSpent =
    Math.max(
      0,
      Number(
        state.lifetime
          .dumSpent
      ) || 0
    ) +
    1;


  /*
   * Regeneration clock begins
   * when energy leaves MAX.
   */
  if (
    wasFull ||
    !state.energy.updatedAt
  ) {

    state.energy.updatedAt =
      new Date()
        .toISOString();

  }


  /*
   * Count DUM spent specifically
   * by Tap Lago.
   */
  if (
    options.gameId
  ) {

    const game =
      ensureGame(
        options.gameId
      );


    game.dumSpent =
      Math.max(
        0,
        Number(
          game.dumSpent
        ) || 0
      ) +
      1;

  }


  save();


  return {

    allowed:
      true,

    spent:
      1,

    dum:
      state.energy.dum,

    max:
      state.energy.max,

    tapCounter:
      0

  };

}

/*
 * =========================================================
 * TAP LAGO AUTO
 * =========================================================
 *
 * Canonical Tap Lago AUTO progression.
 *
 * AUTO Level:
 *
 * 0 = 0 SP / sec
 * 1 = 1 SP / sec
 * 2 = 2 SP / sec
 * ...
 *
 * SP is still earned through gameplay.
 * AUTO does not create free DUM.
 */

function getTapAutoState() {

  const game =
    ensureGame(
      "tap-lago"
    );


 const level =
  Math.min(
    TAP_AUTO_MAX_LEVEL,
      Math.max(
        0,

        Math.floor(
          Number(
            game.autoLevel
          ) || 0
        )
      )
    );


  /*
   * Keep canonical value normalized.
   */
  game.autoLevel =
    level;


  return {

    level,

    spPerSecond:
      level

  };

}

 /*
 * =========================================================
 * TAP LAGO AUTO UPGRADE
 * =========================================================
 *
 * FREE:
 * high lifetime progression
 * + spendable SP
 * + full DUM bar
 *
 * PREMIUM:
 * real $LAGO
 * implemented in R0.5E
 */
function getTapAutoUpgradeState() {

  refreshDumEnergy();


  const auto =
    getTapAutoState();


  const maxLevel =
    TAP_AUTO_MAX_LEVEL;


  const maxed =
    auto.level >=
    maxLevel;


  const nextLevel =
    maxed
      ? maxLevel
      : auto.level + 1;


  const multiplier =
    maxed
      ? 0
      : Math.pow(
          2,
          nextLevel - 1
        );


  const requiredLifetimeSp =
    maxed
      ? state.lifetime.spEarned
      : Math.floor(
          TAP_AUTO_FREE_BASE_LIFETIME_SP *
          multiplier
        );


  const spCost =
    maxed
      ? 0
      : Math.floor(
          TAP_AUTO_FREE_BASE_SP_COST *
          multiplier
        );


  const dumCost =
    maxed
      ? 0
      : TAP_AUTO_FREE_DUM_COST;


  const requiredLevel =
    maxed
      ? state.level
      : Math.floor(
          requiredLifetimeSp /
          100
        ) + 1;


  const spState =
    getSPState();


  const enoughLifetime =
    spState.lifetimeEarned >=
    requiredLifetimeSp;


  const enoughLevel =
    spState.level >=
    requiredLevel;


  const enoughSp =
    spState.balance >=
    spCost;


  const enoughDum =
    state.energy.dum >=
    dumCost;


  return {

    level:
      auto.level,

    spPerSecond:
      auto.spPerSecond,

    maxLevel,

    maxed,

    nextLevel,

    requiredLifetimeSp,

    requiredLevel,

    spCost,

    dumCost,

    accountLevel:
      spState.level,

    accountSp:
      spState.balance,

    lifetimeSp:
      spState.lifetimeEarned,

    dum:
      state.energy.dum,

    enoughLifetime,

    enoughLevel,

    enoughSp,

    enoughDum,

    canUpgradeFree:
      !maxed &&
      enoughLifetime &&
      enoughLevel &&
      enoughSp &&
      enoughDum,

    /*
     * Never simulate paid
     * $LAGO purchase locally.
     */
    canUpgradeWithLago:
      false

  };

}


function upgradeTapAuto() {

  const before =
    getTapAutoUpgradeState();


  if (
    before.maxed
  ) {

    return {
      ok:
        false,
      reason:
        "max",
      ...before
    };

  }


  if (
    !before.enoughLifetime ||
    !before.enoughLevel
  ) {

    return {
      ok:
        false,
      reason:
        "progress",
      ...before
    };

  }


  if (
    !before.enoughSp
  ) {

    return {
      ok:
        false,
      reason:
        "sp",
      ...before
    };

  }


  if (
    !before.enoughDum
  ) {

    return {
      ok:
        false,
      reason:
        "dum",
      ...before
    };

  }


  const game =
    ensureGame(
      "tap-lago"
    );


  const previousAutoLevel =
    Math.max(
      0,
      Math.floor(
        Number(
          game.autoLevel
        ) || 0
      )
    );


  game.autoLevel =
    before.nextLevel;


  const paid =
    spendGameplayResources({
      sp:
        before.spCost,
      dum:
        before.dumCost,
      gameId:
        "tap-lago"
    });


  if (
    !paid?.ok
  ) {

    game.autoLevel =
      previousAutoLevel;


    return {
      ok:
        false,
      reason:
        paid?.reason ||
        "payment",
      ...getTapAutoUpgradeState()
    };

  }


  return {
    ok:
      true,
    reason:
      "upgraded",
    ...getTapAutoUpgradeState()
  };

}
  
  /*
 * =========================================================
 * LAGO LIFE — ACCOUNT CONDITION
 * =========================================================
 */


/*
 * ALIVE
 * TIRED
 * DUMB
 * DYING
 * DEAD
 */
function getLifeStatus(
  value =
    state.life.value
) {

  return resolveLifeStatus(
    value,
    state.life.max
  );

}


/*
 * Set Life safely.
 *
 * Used later by inactivity,
 * revive and gameplay systems.
 */
function setLife(
  value
) {

  state.life.value =
    clamp(
      value,
      0,
      state.life.max
    );


  state.life.status =
    getLifeStatus(
      state.life.value
    );


  return save();

}


/*
 * Records meaningful account
 * activity.
 *
 * R0.5C will decide WHICH
 * actions are meaningful enough
 * to call this function.
 */
function markActive() {

  const now =
    new Date()
      .toISOString();


  state.life.lastActiveAt =
    now;


  /*
   * First activity also establishes
   * the decay reference point.
   */
  if (
    !state.life.lastDecayAt
  ) {

    state.life.lastDecayAt =
      now;

  }


  state.life.status =
    getLifeStatus();


  return save();

}

  /*
 * =========================================================
 * HEIST — FOUNDATION
 * =========================================================
 */


/*
 * Weaker Lago Life makes a target
 * easier to raid.
 */
function getHeistLifeBonus(
  status = "alive"
) {

  switch (
    String(status)
      .toLowerCase()
  ) {

    case "dead":
      return 0.25;

    case "dying":
      return 0.18;

    case "dumb":
      return 0.10;

    case "tired":
      return 0.05;

    default:
      return 0;

  }

}


/*
 * Better loot is harder to steal.
 */
function getHeistRarityPenalty(
  rarity = "common"
) {

  switch (
    String(rarity)
      .toLowerCase()
  ) {

    case "secret":
      return 0.28;

    case "mythic":
      return 0.24;

    case "legendary":
      return 0.20;

    case "epic":
      return 0.15;

    case "rare":
      return 0.08;

    default:
      return 0;

  }

}


/*
 * Final probability is always
 * clamped between 10% and 75%.
 */
function calculateHeistChance(
  {
    attackerSkill =
      state.heist.skill,

    attackerHeat =
      state.heist.heat,

    targetLifeStatus =
      "alive",

    targetShield =
      0,

    targetOfflineHours =
      0,

    itemRarity =
      "common",

    repeatAttempts =
      0,

    isRevenge =
      false

  } = {}
) {

  let chance =
    HEIST_BASE_CHANCE;


  /*
   * Skill:
   * +1% per level,
   * maximum +15%.
   */
  chance +=
    Math.min(
      0.15,

      Math.max(
        0,
        Number(
          attackerSkill
        ) || 0
      ) *
      0.01
    );


  /*
   * Target condition.
   */
  chance +=
    getHeistLifeBonus(
      targetLifeStatus
    );


  /*
   * Offline target bonus.
   */
  const offlineHours =
    Math.max(
      0,
      Number(
        targetOfflineHours
      ) || 0
    );


  if (
    offlineHours >= 120
  ) {

    chance +=
      0.10;

  } else if (
    offlineHours >= 48
  ) {

    chance +=
      0.05;

  }


  /*
   * Shield:
   * -3% per level,
   * maximum -27%.
   */
  chance -=
    Math.min(
      0.27,

      Math.max(
        0,
        Number(
          targetShield
        ) || 0
      ) *
      0.03
    );


  /*
   * Rarity protection.
   */
  chance -=
    getHeistRarityPenalty(
      itemRarity
    );


  /*
   * Revenge advantage.
   */
  if (
    isRevenge
  ) {

    chance +=
      0.08;

  }


  /*
   * Repeated attacks against
   * the same target become harder.
   *
   * -5% each,
   * maximum -15%.
   */
  chance -=
    Math.min(
      0.15,

      Math.max(
        0,
        Math.floor(
          Number(
            repeatAttempts
          ) || 0
        )
      ) *
      0.05
    );


  /*
   * HEAT:
   * 100 HEAT = maximum -20%.
   */
  chance -=
    Math.min(
      0.20,

      clamp(
        attackerHeat,
        0,
        100
      ) *
      0.002
    );


  return clamp(
    chance,
    HEIST_MIN_CHANCE,
    HEIST_MAX_CHANCE
  );

}


/*
 * Scouting a player.
 */
function getScoutCost() {

  return 2;

}


/*
 * Base:
 * 10 DUM
 *
 * Repeat:
 * 14 → 18 → 22
 *
 * Revenge:
 * 6 DUM
 */
function getHeistCost(
  {
    repeatAttempts = 0,
    isRevenge = false
  } = {}
) {

  if (
    isRevenge
  ) {

    return 6;

  }


  const repeats =
    Math.max(
      0,
      Math.floor(
        Number(
          repeatAttempts
        ) || 0
      )
    );


  return (
    10 +
    Math.min(
      12,
      repeats * 4
    )
  );

}


/*
 * Increase HEAT safely.
 */
function addHeat(
  amount = 0
) {

  const value =
    Math.max(
      0,
      Number(
        amount
      ) || 0
    );


  state.heist.heat =
    clamp(
      state.heist.heat +
      value,
      0,
      100
    );


  return save();

}


/*
 * Reduce HEAT safely.
 *
 * Later R0.5D can call this
 * periodically.
 */
function coolHeat(
  amount = 5
) {

  const value =
    Math.max(
      0,
      Number(
        amount
      ) || 0
    );


  state.heist.heat =
    clamp(
      state.heist.heat -
      value,
      0,
      100
    );


  return save();

}
  
  /*
   * =========================================================
   * XP
   * =========================================================
   */

  function addXP(
  amount = 0,
  options = {}
) {

  /*
   * Legacy alias.
   *
   * New modules must use addSP().
   */

  return addSP(
    amount,
    options
  );

}

  function recordClick(
    amount = 1
  ) {

    state.clicks +=
      Math.max(
        0,
        Math.floor(
          Number(
            amount
          ) || 0
        )
      );


    return save();

  }


  /*
   * =========================================================
   * GAME STATS
   * =========================================================
   */

  function ensureGame(
    gameId
  ) {

    const id =
      String(
        gameId || ""
      ).trim();


    if (!id) {

      throw new Error(
        "gameId is required"
      );

    }


    if (
      !state.games[id]
    ) {

      state.games[id] = {

        plays:
          0,

        bestScore:
          0,

        lastScore:
          0,

        memEarned:
          0,

        memSpent:
          0,

        xpEarned:
  0,

 spEarned:
  0,

spSpent:
  0,

dumSpent:
  0,

lastPlayedAt:
  null

      };

    }

/*
 * Upgrade old saved game records
 * without deleting statistics.
 */

state.games[id].spEarned =
  Math.max(
    0,
    Number(
      state.games[id]
        .spEarned ??
      state.games[id]
        .xpEarned
    ) || 0
  );

    state.games[id].spSpent =
  Math.max(
    0,
    Number(
      state.games[id]
        .spSpent
    ) || 0
  );


state.games[id].dumSpent =
  Math.max(
    0,
    Number(
      state.games[id]
        .dumSpent
    ) || 0
  );
    return state.games[id];

  }


 function submitGameResult(
  {
    gameId,
    score = 0,
    sp = 0,

    /*
     * Legacy input alias only.
     *
     * New mini-games must submit `sp`.
     */
    xp = 0,

    /*
     * Accepted only so old callers
     * do not crash.
     *
     * MEM grants are ignored.
     */
    mem = 0
  } = {}
) {

  const game =
    ensureGame(
      gameId
    );


  const safeScore =
    Math.max(
      0,
      Number(
        score
      ) || 0
    );


  /*
   * Canonical:
   *
   * sp wins.
   *
   * Legacy xp is accepted only
   * as fallback during migration.
   */
  const safeSP =
    Math.max(
      0,
      Number(
        sp
      ) ||
      Number(
        xp
      ) ||
      0
    );


  /*
   * Explicitly consume the legacy
   * argument without mutating MEM.
   */
  void mem;


  game.plays += 1;


  game.lastScore =
    safeScore;


  game.bestScore =
    Math.max(
      game.bestScore || 0,
      safeScore
    );


  game.lastPlayedAt =
    new Date()
      .toISOString();


  if (safeSP) {

    state.economy.sp +=
      safeSP;


    /*
     * Compatibility mirror only.
     */
    state.xp =
      state.economy.sp;


    state.lifetime
      .spEarned +=
      safeSP;


    game.spEarned =
      Math.max(
        0,
        Number(
          game.spEarned
        ) || 0
      ) +
      safeSP;

  }


  updateLevel(
    state,
    true
  );


  return save();

}


  /*
   * =========================================================
   * INVENTORY
   * =========================================================
   */

  function addSkin(
    skinId
  ) {

    const id =
      String(
        skinId || ""
      ).trim();


    if (!id) {

      return snapshot();

    }


    if (
      !state.skins.includes(
        id
      )
    ) {

      state.skins.push(
        id
      );


      save();

    }


    return snapshot();

  }


  function selectSkin(
    skinId
  ) {

    const id =
      String(
        skinId || ""
      ).trim();


    if (!id) {

      return false;

    }


    if (
      id !== "default" &&
      !state.skins.includes(
        id
      )
    ) {

      return false;

    }


    state.selectedSkin =
      id;


    save();


    return true;

  }

  /*
 * =========================================================
 * ACCOUNT IDENTITY
 * =========================================================
 */

function isSolanaPublicKey(
  value
) {

  const text =
    String(
      value ?? ""
    ).trim();


  return (

    text.length >= 32 &&

    text.length <= 44 &&

    /^[1-9A-HJ-NP-Za-km-z]+$/
      .test(text)

  );

}


function getAuthIdentity() {

  return clone(
    state.auth
  );

}


/*
 * Local Telegram identity intake.
 *
 * IMPORTANT:
 * telegramVerified stays FALSE.
 *
 * Real Telegram initData validation
 * will happen on the Lago backend.
 */
function linkTelegramIdentity(
  {
    id = "",
    username = "",
    displayName = ""
  } = {}
) {

  const telegramId =
    String(
      id ?? ""
    ).trim();


  if (
    !telegramId ||
    !/^\d+$/.test(
      telegramId
    )
  ) {

    return {

      ok:
        false,

      reason:
        "invalid_telegram_id"

    };

  }


  const previousTelegramId =
    state.auth.telegramId;


  /*
   * A completely different Telegram
   * user must NEVER inherit another
   * locally bound wallet.
   */
  if (
    previousTelegramId &&
    previousTelegramId !==
      telegramId
  ) {

    state.auth.walletPublicKey =
      "";


    state.auth.walletLinked =
      false;


    state.auth.walletLinkedAt =
      null;

  }


  state.auth.provider =
    "telegram";


  state.auth.telegramId =
    telegramId;


  state.auth.telegramUsername =
    String(
      username ?? ""
    ).trim();


  state.auth.telegramDisplayName =
    String(
      displayName ?? ""
    ).trim();


  state.auth.telegramLinked =
    true;


  /*
   * Fail closed:
   * browser cannot self-verify Telegram.
   */
  state.auth.telegramVerified =
    false;


  state.auth.telegramLinkedAt =
    new Date()
      .toISOString();


  save();


  return {

    ok:
      true,

    identity:
      getAuthIdentity()

  };

}


/*
 * Bind a CONNECTED public wallet
 * to the current Telegram account.
 *
 * Disconnecting Phantom later does
 * NOT remove this account binding.
 */
function linkWalletIdentity(
  publicKey
) {

  if (
    state.auth.telegramLinked !==
      true ||
    !state.auth.telegramId
  ) {

    return {

      ok:
        false,

      reason:
        "telegram_required"

    };

  }


  const wallet =
    String(
      publicKey ?? ""
    ).trim();


  if (
    !isSolanaPublicKey(
      wallet
    )
  ) {

    return {

      ok:
        false,

      reason:
        "invalid_wallet"

    };

  }


  /*
   * Never silently replace
   * an already bound wallet.
   */
  if (
    state.auth.walletLinked &&
    state.auth.walletPublicKey &&
    state.auth.walletPublicKey !==
      wallet
  ) {

    return {

      ok:
        false,

      reason:
        "wallet_mismatch",

      expectedWallet:
        state.auth.walletPublicKey,

      connectedWallet:
        wallet

    };

  }


  state.auth.walletPublicKey =
    wallet;


  state.auth.walletLinked =
    true;


  if (
    !state.auth.walletLinkedAt
  ) {

    state.auth.walletLinkedAt =
      new Date()
        .toISOString();

  }


  save();


  return {

    ok:
      true,

    identity:
      getAuthIdentity()

  };

}

  /*
   * =========================================================
   * PROFILE
   * =========================================================
   */

  function setLanguage(
    language
  ) {

    const value =
      String(
        language || ""
      ).trim();


    if (!value) {

      return false;

    }


    state.language =
      value;


    save();


    return true;

  }


  function setCountry(
    country
  ) {

    state.country =
      String(
        country || ""
      ).trim();


    save();


    return true;

  }


  /*
   * =========================================================
   * PUBLIC ACCOUNT API
   * =========================================================
   */

  const account = {

    version:
      SCHEMA_VERSION,

    getState:
      snapshot,

    save,

    sync,

   /*
 * Canonical progression
 */

addSP,

getSPState,
    
canSpendSP,

spendSP,

spendGameplayResources,

getDumEnergy,
canSpendDum,

spendDum,

restoreDum,

refreshDumEnergy,

consumeTapDum,

getTapAutoState,

getTapAutoUpgradeState,

upgradeTapAuto,

    getDoubleClickUpgradeState,

unlockDoubleClick,
/*
 * Lago Life
 */
getLifeStatus,

setLife,

markActive,


/*
 * Heist foundation
 */

calculateHeistChance,

getScoutCost,

getHeistCost,

addHeat,

coolHeat,


/*
 * Legacy compatibility
 */

creditMem,

spendMem,

addXP,

recordClick,
    submitGameResult,

    addSkin,

    selectSkin,

    getAuthIdentity,

linkTelegramIdentity,

linkWalletIdentity,

setLanguage,

setCountry
  };


  window.LAGO_ACCOUNT =
    account;


  /*
   * =========================================================
   * TEMPORARY COMPATIBILITY API
   *
   * Existing Collection / Rewards /
   * Language / Modern modules still
   * use window.LAGO.
   * =========================================================
   */

  window.LAGO = {

    getState:
      snapshot,


    /*
     * Preserve old bridge behavior
     * until modules are migrated.
     */

    addMem(
      amount = 1
    ) {

      const value =
        Math.max(
          0,
          Number(
            amount
          ) || 0
        );


      return creditMem(
        value,
        {

          xp:
            Math.max(
              1,
              Math.floor(
                value
              )
            ),

          countClick:
            true,

          gameId:
            "legacy"

        }
      );

    },


    addSkin,

    selectSkin,

    setCountry,

    setLanguage,

    save,

    sync

  };


  window.LAGO_GAME =
    window.LAGO;


  /*
   * Persist migrated account
   * without firing events yet.
   */

  save({
    emit:
      false
  });


  /*
   * First state broadcast.
   */

  if (
    document.readyState ===
    "loading"
  ) {

    document.addEventListener(
      "DOMContentLoaded",
      sync,
      {
        once: true
      }
    );

  } else {

    sync();

  }

})();

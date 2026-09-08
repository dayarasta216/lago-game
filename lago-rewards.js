 (() => {
  "use strict";

  const REWARD_STORAGE =
    "lago_rewards_v1";


  const DAILY_SP_AMOUNT =
  250;


const DAILY_DUM_AMOUNT =
  20;


/*
 * Daily cosmetics are intentionally
 * limited to COMMON / RARE.
 *
 * EPIC / LEGENDARY / MYTHIC
 * are not ordinary Daily Rewards.
 */
const DAILY_SKINS = [

  {
    id:
      "lime",

    name:
      "Lime Lago",

    emoji:
      "🟢",

    rarity:
      "COMMON",

    weight:
      15
  },

  {
    id:
      "ocean",

    name:
      "Ocean Lago",

    emoji:
      "🌊",

    rarity:
      "RARE",

    weight:
      5
  }

];

  function load() {

    try {

      return JSON.parse(
        localStorage.getItem(
          REWARD_STORAGE
        )
      ) || {};

    } catch {

      return {};

    }

  }


  function save(data) {

    localStorage.setItem(
      REWARD_STORAGE,
      JSON.stringify(data)
    );

  }


  function today() {

    const d =
      new Date();

    return [
      d.getFullYear(),
      String(
        d.getMonth() + 1
      ).padStart(2,"0"),
      String(
        d.getDate()
      ).padStart(2,"0")
    ].join("-");

  }


  function getState() {

    return load();

  }


 function pickReward() {

  const account =
    window.LAGO_ACCOUNT;


  if (!account) {

    return null;

  }


  const accountState =
    account.getState?.() || {};


  const owned =
    new Set(
      accountState.skins || []
    );


  const dumState =
    account.getDumEnergy?.() || {

      dum:
        0,

      max:
        100

    };


  const dum =
    Math.max(
      0,
      Math.floor(
        Number(
          dumState.dum
        ) || 0
      )
    );


  const maxDum =
    Math.max(
      1,
      Math.floor(
        Number(
          dumState.max
        ) || 100
      )
    );


  const dumMissing =
    Math.max(
      0,
      maxDum - dum
    );


  /*
   * SP is always available.
   */
  const available = [

    {
      type:
        "sp",

      id:
        "sp-250",

      amount:
        DAILY_SP_AMOUNT,

      name:
        `+${DAILY_SP_AMOUNT} SP`,

      emoji:
        "⚡",

      label:
        "SP",

      title:
        "SP BONUS",

      subtitle:
        "Spend it on Lago upgrades and gameplay.",

      weight:
        50
    }

  ];


  /*
   * Do not waste Daily Reward
   * on an almost-full DUM bar.
   */
  if (
    dumMissing >=
    10
  ) {

    const amount =
      Math.min(
        DAILY_DUM_AMOUNT,
        dumMissing
      );


    available.push({

      type:
        "dum",

      id:
        "dum-energy",

      amount,

      name:
        `+${amount} DUM`,

      emoji:
        "🔋",

      label:
        "DUM",

      title:
        "ENERGY BONUS",

      subtitle:
        "DUM Energy restored.",

      weight:
        30

    });

  }


  /*
   * Only unowned COMMON / RARE
   * cosmetics participate.
   */
  DAILY_SKINS
    .filter(
      skin =>
        !owned.has(
          skin.id
        )
    )
    .forEach(
      skin =>
        available.push({

          type:
            "skin",

          ...skin,

          label:
            skin.rarity,

          title:
            "NEW LAGO",

          subtitle:
            "You unlocked a new skin!"

        })
    );


  const totalWeight =
    available.reduce(
      (
        sum,
        reward
      ) =>
        sum +
        Math.max(
          1,
          Number(
            reward.weight
          ) || 1
        ),
      0
    );


  let roll =
    Math.random() *
    totalWeight;


  for (
    const reward
    of available
  ) {

    roll -=
      Math.max(
        1,
        Number(
          reward.weight
        ) || 1
      );


    if (
      roll <= 0
    ) {

      return reward;

    }

  }


  return (
    available[0] ||
    null
  );

}

  function canClaim() {

    const state =
      getState();

    return (
      state.lastClaim !==
      today()
    );

  }


  function claim() {

  if (
    !canClaim()
  ) {

    return {

      ok:
        false,

      reason:
        "already_claimed"

    };

  }


  const account =
    window.LAGO_ACCOUNT;


  if (!account) {

    return {

      ok:
        false,

      reason:
        "account_unavailable"

    };

  }


  const reward =
    pickReward();


  if (!reward) {

    return {

      ok:
        false,

      reason:
        "reward_unavailable"

    };

  }


  /*
   * =========================================================
   * SP
   * =========================================================
   */
  if (
    reward.type ===
    "sp"
  ) {

    if (
      typeof account.addSP !==
      "function"
    ) {

      return {

        ok:
          false,

        reason:
          "sp_api_unavailable"

      };

    }


    account.addSP(
      reward.amount,
      {
        gameId:
          "daily-reward"
      }
    );

  }


  /*
   * =========================================================
   * DUM
   * =========================================================
   */
  else if (
    reward.type ===
    "dum"
  ) {

    if (
      typeof account.restoreDum !==
      "function"
    ) {

      return {

        ok:
          false,

        reason:
          "dum_api_unavailable"

      };

    }


    account.restoreDum(
      reward.amount
    );

  }


  /*
   * =========================================================
   * COMMON / RARE SKIN
   * =========================================================
   */
  else if (
    reward.type ===
    "skin"
  ) {

    if (
      typeof account.addSkin !==
      "function"
    ) {

      return {

        ok:
          false,

        reason:
          "skin_api_unavailable"

      };

    }


    account.addSkin(
      reward.id
    );

  }


  else {

    return {

      ok:
        false,

      reason:
        "invalid_reward_type"

    };

  }


  const data =
    getState();


  data.lastClaim =
    today();


  data.totalClaims =
    Math.max(
      0,
      Math.floor(
        Number(
          data.totalClaims
        ) || 0
      )
    ) + 1;


  data.lastReward = {

    type:
      reward.type,

    id:
      reward.id || "",

    amount:
      Math.max(
        0,
        Number(
          reward.amount
        ) || 0
      ),

    claimedAt:
      new Date()
        .toISOString()

  };


  save(
    data
  );


  showReward(
    reward
  );


  document.dispatchEvent(

    new CustomEvent(
      "lago:daily-reward",
      {

        detail: {
          ...reward
        }

      }
    )

  );


  return {

    ok:
      true,

    reward: {
      ...reward
    }

  };

}

  function createUI() {

    if (
      document.querySelector(
        "#lagoRewards"
      )
    )
      return;


    const overlay =
      document.createElement(
        "div"
      );

    overlay.id =
      "lagoRewards";


    overlay.innerHTML = `

      <div class="lago-reward-card">

        <button
          class="lago-reward-close"
          id="lagoRewardClose"
        >
          ×
        </button>

        <div
          class="lago-reward-label"
        >
          DAILY REWARD
        </div>

        <div
          class="lago-reward-title"
          id="lagoRewardTitle"
        >
          DAILY REWARD
        </div>

        <div
          class="lago-reward-subtitle"
          id="lagoRewardSubtitle"
        >
          Come back tomorrow for
another reward.
        </div>

        <div
          class="lago-reward-item"
        >
          <div
            class="lago-reward-emoji"
            id="lagoRewardEmoji"
          >
            🎁
          </div>
        </div>

        <div
          class="lago-reward-name"
          id="lagoRewardName"
        >
          Mystery
        </div>

        <div
          class="lago-reward-rarity"
          id="lagoRewardRarity"
        >
          RARE
        </div>

        <button
          class="lago-reward-button"
          id="lagoRewardButton"
        >
          AWESOME
        </button>

      </div>

    `;


    document.body.appendChild(
      overlay
    );


    document
      .querySelector(
        "#lagoRewardClose"
      )
      ?.addEventListener(
        "click",
        hide
      );


    document
      .querySelector(
        "#lagoRewardButton"
      )
      ?.addEventListener(
        "click",
        hide
      );

  }


function showReward(
  reward
) {

  createUI();


  document
    .querySelector(
      "#lagoRewardTitle"
    )
    .textContent =
    reward.title ||
    "DAILY REWARD";


  document
    .querySelector(
      "#lagoRewardSubtitle"
    )
    .textContent =
    reward.subtitle ||
    "Daily reward claimed.";


  document
    .querySelector(
      "#lagoRewardEmoji"
    )
    .textContent =
    reward.emoji ||
    "🎁";


  document
    .querySelector(
      "#lagoRewardName"
    )
    .textContent =
    reward.name ||
    "Reward";


  const rarity =
    document.querySelector(
      "#lagoRewardRarity"
    );


  rarity.textContent =
    reward.label ||
    "BONUS";


  /*
   * Remove visual state
   * left from previous reward.
   */
  rarity.className =
    "lago-reward-rarity";


  if (
    reward.type ===
      "skin" &&
    reward.rarity
  ) {

    rarity.classList.add(
      "lago-rarity-" +
      reward.rarity
        .toLowerCase()
    );

  }


  document
    .querySelector(
      "#lagoRewards"
    )
    .classList.add(
      "active"
    );

}


  function hide() {

    document
      .querySelector(
        "#lagoRewards"
      )
      ?.classList.remove(
        "active"
      );

  }




  /*
   * Public API
   */

  window.LAGO_REWARDS = {

  claim,

  canClaim,

  getState

};

 document.addEventListener(
  "DOMContentLoaded",
  () => {

    /*
     * Daily Reward is now controlled
     * from the User Profile.
     *
     * No floating duplicate button.
     */

    createUI();

  }
);


})();

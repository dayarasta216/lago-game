(() => {
  "use strict";

  const REWARD_STORAGE =
    "lago_rewards_v1";


  const REWARDS = [

    {
      id: "lime",
      name: "Lime Lago",
      emoji: "🟢",
      rarity: "COMMON"
    },

    {
      id: "ocean",
      name: "Ocean Lago",
      emoji: "🌊",
      rarity: "RARE"
    },

    {
      id: "galaxy",
      name: "Galaxy Lago",
      emoji: "🌌",
      rarity: "EPIC"
    },

    {
      id: "lava",
      name: "Lava Lago",
      emoji: "🔥",
      rarity: "EPIC"
    },

    {
      id: "gold",
      name: "Golden Lago",
      emoji: "👑",
      rarity: "LEGENDARY"
    },

    {
      id: "void",
      name: "Void Lago",
      emoji: "🕳️",
      rarity: "MYTHIC"
    },

    {
      id: "diamond",
      name: "Diamond Lago",
      emoji: "💎",
      rarity: "MYTHIC"
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

    const state =
      getState();


    /*
     * Prefer skins that the
     * player doesn't own yet.
     */

    const owned =
      new Set(
        window.LAGO?.getState?.()
          ?.skins || []
      );


    let available =
      REWARDS.filter(
        reward =>
          !owned.has(
            reward.id
          )
      );


    /*
     * If everything is owned,
     * reward MEM instead.
     */

    if (
      available.length === 0
    ) {

      return null;

    }


    /*
     * Higher rarity is less likely.
     */

    const weighted = [];

    available.forEach(
      reward => {

        let weight = 10;

        if (
          reward.rarity ===
          "RARE"
        )
          weight = 6;

        if (
          reward.rarity ===
          "EPIC"
        )
          weight = 3;

        if (
          reward.rarity ===
          "LEGENDARY"
        )
          weight = 1;

        if (
          reward.rarity ===
          "MYTHIC"
        )
          weight = .4;


        for (
          let i = 0;
          i < weight * 10;
          i++
        ) {

          weighted.push(
            reward
          );

        }

      }
    );


    return weighted[
      Math.floor(
        Math.random() *
        weighted.length
      )
    ];

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

    if (!canClaim())
      return;


    const reward =
      pickReward();


    if (!reward) {

      /*
       * All skins owned.
       * Give bonus MEM instead.
       */

      window.LAGO?.addMem?.(
        250
      );

      const data =
        getState();

      data.lastClaim =
        today();

      save(data);

      showBonus();

      return;

    }


    window.LAGO?.addSkin?.(
      reward.id
    );


    const data =
      getState();

    data.lastClaim =
      today();

    data.totalClaims =
      (data.totalClaims || 0) + 1;

    save(data);


    showReward(
      reward
    );

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
          DAILY DROP
        </div>

        <div
          class="lago-reward-title"
          id="lagoRewardTitle"
        >
          NEW LAGO
        </div>

        <div
          class="lago-reward-subtitle"
          id="lagoRewardSubtitle"
        >
          A new item has been added
          to your collection.
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
      "NEW LAGO";


    document
      .querySelector(
        "#lagoRewardSubtitle"
      )
      .textContent =
      "You unlocked a new skin!";


    document
      .querySelector(
        "#lagoRewardEmoji"
      )
      .textContent =
      reward.emoji;


    document
      .querySelector(
        "#lagoRewardName"
      )
      .textContent =
      reward.name;


    const rarity =
      document.querySelector(
        "#lagoRewardRarity"
      );


    rarity.textContent =
      reward.rarity;


    rarity.className =
      "lago-reward-rarity " +
      "lago-rarity-" +
      reward.rarity.toLowerCase();


    document
      .querySelector(
        "#lagoRewards"
      )
      .classList.add(
        "active"
      );

  }


  function showBonus() {

    createUI();


    document
      .querySelector(
        "#lagoRewardTitle"
      )
      .textContent =
      "FULL COLLECTION";


    document
      .querySelector(
        "#lagoRewardSubtitle"
      )
      .textContent =
      "You own every available skin.";


    document
      .querySelector(
        "#lagoRewardEmoji"
      )
      .textContent =
      "💚";


    document
      .querySelector(
        "#lagoRewardName"
      )
      .textContent =
      "+250 MEM";


    document
      .querySelector(
        "#lagoRewardRarity"
      )
      .textContent =
      "BONUS";


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

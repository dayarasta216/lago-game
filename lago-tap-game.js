(() => {
  "use strict";

  /*
   * =========================================================
   * TAP LAGO
   * Mini-Game #001
   *
   * Owns:
   * - tap
   * - steal
   * - auto income
   * - upgrades
   *
   * R0.3C3B
   * =========================================================
   */


  const runtime =
    window.LAGO_LEGACY_RUNTIME;


  if (!runtime) {

    console.error(
      "[TAP LAGO] Legacy runtime adapter is missing."
    );

    return;

  }


  const PHRASES =
    runtime.getPhrases();


  /*
   * =========================================================
   * UPGRADES
   *
   * Original economy preserved 1:1.
   * =========================================================
   */

  const UPGRADES = [

    {
      key: "click",
      icon: "🚀",
      name: "УСИЛЕНИЕ КЛИКА",
     desc: "+1 DUM за каждый клик",
      base: 25,
      max: 50,

      apply(current) {

        current.power++;

      }
    },


    {
      key: "auto",
      icon: "🤖",
      name: "АВТОКЛИКЕР",
     desc: "+1 DUM каждую секунду",
      base: 80,
      max: 50,

      apply(current) {

        current.auto++;

      }
    },


    {
      key: "shield",
      icon: "🛡️",
      name: "ЗАЩИТА",
      desc: "-10% потерь при краже",
      base: 120,
      max: 9,

      apply(current) {

        current.shield++;

      }
    }

  ];


  let autoTimer =
    null;


  function state() {

    return runtime.getState();

  }


  function formatNumber(value) {

    return Math.floor(
      Number(value) || 0
    ).toLocaleString(
      "ru-RU"
    );

  }


  /*
   * =========================================================
   * MEME BONUSES
   *
   * Temporary compatibility with
   * the old meme system.
   * =========================================================
   */

  function memeClickBonus() {

    const current =
      state();


    return (
      current.memes || []
    ).reduce(
      (sum, meme) =>
        sum +
        (
          meme.clickBonus ||
          0
        ),
      0
    );

  }


  function memeAutoBonus() {

    const current =
      state();


    return (
      current.memes || []
    ).reduce(
      (sum, meme) =>
        sum +
        (
          meme.autoBonus ||
          0
        ),
      0
    );

  }


  function randomPhrase() {

    if (!PHRASES.length) {

      return "Lago is lagging...";

    }


    return PHRASES[
      Math.floor(
        Math.random() *
        PHRASES.length
      )
    ];

  }


  /*
   * =========================================================
   * TAP
   * =========================================================
   */

 function tap(
  event = null
) {

  const account =
    window.LAGO_ACCOUNT;


  /*
   * Fail closed.
   *
   * Tap Lago must no longer fall
   * back to the old fake DUM economy.
   */
  if (
    !account ||
    typeof account.consumeTapDum !==
      "function" ||
    typeof account.addSP !==
      "function"
  ) {

    console.error(
      "[TAP LAGO] Account Core DUM/SP API is missing."
    );


    runtime.toast(
      "ACCOUNT CORE ERROR"
    );


    return getState();

  }


  /*
   * Account Core decides whether
   * this tap is allowed and whether
   * this is the 5th tap that costs
   * 1 DUM.
   */
  const dumResult =
    account.consumeTapDum({
      gameId:
        "tap-lago"
    });


  /*
   * DUM = 0:
   * no successful tap,
   * no SP,
   * no click progression.
   */
  if (
    !dumResult ||
    dumResult.allowed !==
      true
  ) {

    runtime.toast(
      "DUM ENERGY 0 😭 WAIT FOR REGEN"
    );


    runtime.beep(
      90,
      0.1
    );


    runtime.setSpeech(
      "Lago is out of energy..."
    );


    return getState();

  }


  const current =
    state();


  /*
   * Old CLICK POWER now becomes
   * SP reward power.
   *
   * It no longer creates DUM.
   */
  const gain =
    Math.max(
      1,

      Math.floor(
        Number(
          current.power
        ) || 1
      ) +

      Math.max(
        0,
        Math.floor(
          Number(
            memeClickBonus()
          ) || 0
        )
      )
    );


  /*
   * Keep old Tap statistics alive
   * during migration.
   */
  current.totalClicks++;


  /*
   * Permanent progression reward.
   */
  account.addSP(
    gain,
    {
      gameId:
        "tap-lago"
    }
  );


  runtime.animateSnail();


  runtime.setSpeech(
    randomPhrase()
  );


  runtime.beep(
    180 +
    Math.random() *
    420,
    0.045
  );


  /*
   * Show the real economy:
   *
   * successful tap → SP
   * every 5th tap → -1 DUM
   */
  runtime.spawnFloat(
    dumResult.spent > 0

      ? `+${gain} SP · -1 DUM`

      : `+${gain} SP`,

    event
  );


  runtime.checkAchievements();


  runtime.render();


  runtime.save();


  return getState();

}


  /*
   * =========================================================
   * STEAL
   * =========================================================
   */

  function steal() {

    const current =
      state();


    if (
      current.energy < 5
    ) {

      runtime.toast(
        "Сначала собери хотя бы 5 DUM 😭"
      );


      runtime.beep(
        90,
        0.1
      );


      return getState();

    }


    const success =
      Math.random() <
      (
        0.40 +
        Math.min(
          0.20,
          current.shield *
          0.02
        )
      );


    const amount =
      Math.max(
        1,
        Math.floor(
          5 +
          Math.random() *
          Math.max(
            10,
            current.energy *
            0.18
          )
        )
      );


    if (success) {

      current.energy +=
        amount;


      current.steals++;


      runtime.toast(
        `👾 ОГРАБИЛ! +${amount} DUM`
      );


      runtime.beep(
        740,
        0.08
      );


      runtime.beep(
        920,
        0.08
      );

    } else {

      const loss =
        Math.max(
          1,
          Math.floor(
            amount *
            (
              1 -
              current.shield *
              0.1
            )
          )
        );


      current.energy =
        Math.max(
          0,
          current.energy -
          loss
        );


      runtime.toast(
        `🚓 СПАЛИЛИ! -${loss} DUM`
      );


      runtime.beep(
        120,
        0.14
      );

    }


    if (
      current.energy <= 0
    ) {

      runtime.gameOver();

    }


    runtime.checkAchievements();


    runtime.render();


    runtime.save();


    return getState();

  }


  /*
   * =========================================================
   * AUTO INCOME
   * =========================================================
   */

  function autoTick() {

    const current =
      state();


    if (
      current.auto <= 0
    ) {

      return;

    }


    const gain =
      current.auto +
      memeAutoBonus();


    current.energy +=
      gain;


    runtime.checkAchievements();


    runtime.render();

  }


  function startAuto() {

    if (autoTimer) {
      return;
    }


    autoTimer =
      setInterval(
        autoTick,
        1000
      );

  }


  function stopAuto() {

    if (!autoTimer) {
      return;
    }


    clearInterval(
      autoTimer
    );


    autoTimer =
      null;

  }


  /*
   * =========================================================
   * UPGRADES
   * =========================================================
   */

  function getUpgrade(key) {

    return (
      UPGRADES.find(
        item =>
          item.key === key
      ) ||
      null
    );

  }


  function upgradeCost(
    upgrade
  ) {

    const current =
      state();


    const level =
      current.upgrades
        ?.[upgrade.key] ||
      0;


    return Math.floor(
      upgrade.base *
      Math.pow(
        1.65,
        level
      )
    );

  }


  function buyUpgrade(key) {

    const current =
      state();


    const upgrade =
      getUpgrade(key);


    if (!upgrade) {

      console.warn(
        `[TAP LAGO] Unknown upgrade: ${key}`
      );

      return false;

    }


    const level =
      current.upgrades
        ?.[upgrade.key] ||
      0;


    if (
      level >=
      upgrade.max
    ) {

      runtime.toast(
        "MAXIMUM КРИНЖ"
      );

      return false;

    }


    const cost =
      upgradeCost(
        upgrade
      );


    if (
      current.energy <
      cost
    ) {

      runtime.toast(
        "Не хватает DUM 😭"
      );


      runtime.beep(
        90,
        0.1
      );


      return false;

    }


    current.energy -=
      cost;


    current.upgrades[
      upgrade.key
    ] =
      level + 1;


    upgrade.apply(
      current
    );


    runtime.beep(
      600,
      0.06
    );


    runtime.toast(
      "АПГРЕЙД! ⬆"
    );


    runtime.render();


    runtime.save();


    return true;

  }


  function renderUpgrades() {

    const list =
      document.getElementById(
        "upgradeList"
      );


    if (!list) {

      return;

    }


    const current =
      state();


    list.innerHTML =
      UPGRADES
        .map(
          upgrade => {

            const level =
              current.upgrades
                ?.[upgrade.key] ||
              0;


            const cost =
              upgradeCost(
                upgrade
              );


            const maxed =
              level >=
              upgrade.max;


            return `
              <div class="card">

                <div>

                  <div
                    style="font-size:20px"
                  >
                    ${upgrade.icon}
                    <b>
                      ${upgrade.name}
                    </b>
                  </div>

                  <div class="desc">
                    ${upgrade.desc}

                    <br>

                    Уровень:
                    ${level}/${upgrade.max}
                  </div>

                </div>

                <button
                  class="buy"
                  data-up="${upgrade.key}"
                  ${
                    maxed
                      ? "disabled"
                      : ""
                  }
                >
                  ${
                    maxed
                      ? "MAX"
                      : "💎 " +
                        formatNumber(
                          cost
                        )
                  }
                </button>

              </div>
            `;

          }
        )
        .join("");


    list
      .querySelectorAll(
        "[data-up]"
      )
      .forEach(
        button => {

          button.onclick =
            () => {

              buyUpgrade(
                button.dataset.up
              );

            };

        }
      );

  }


  function openUpgrades() {

    renderUpgrades();


    runtime.showPanel(
      "upgradePanel"
    );

  }


  /*
   * =========================================================
   * PUBLIC STATE
   * =========================================================
   */

  function getState() {

    return runtime.getTapState();

  }


  /*
   * =========================================================
   * LEGACY CONTROL COMPATIBILITY
   * =========================================================
   */

  function bindLegacyControls() {

    document
      .getElementById(
        "clickBtn"
      )
      ?.addEventListener(
        "click",
        event => {

          tap(event);

        }
      );


    document
      .getElementById(
        "snail"
      )
      ?.addEventListener(
        "pointerdown",
        event => {

          event.preventDefault();

          tap(event);

        }
      );


    const stealButton =
      document.getElementById(
        "stealBtn"
      );


    if (stealButton) {

      stealButton.onclick =
        steal;

    }


    const upgradeButton =
      document.getElementById(
        "upgradeBtn"
      );


    if (upgradeButton) {

      upgradeButton.onclick =
        openUpgrades;

    }

  }


  /*
   * =========================================================
   * PUBLIC MINI-GAME API
   * =========================================================
   */

  const game = {

    id:
      "tap-lago",


    name:
      "Tap Lago",


    category:
      "clicker",


    version:
      3,


    tap,


    steal,


    getState,


    startAuto,


    stopAuto,


    buyUpgrade,


    renderUpgrades,


    openUpgrades,


    openCreator() {

      runtime.openCreator();

    },


    share() {

      runtime.share();

    }

  };


  window.LAGO_TAP_GAME =
    game;


  /*
   * Initialize Mini-Game #001.
   */

  bindLegacyControls();


  startAuto();


  runtime.render();


  /*
   * Announce game to future
   * Lago Game Portal registry.
   */

  document.dispatchEvent(
    new CustomEvent(
      "lago:game-ready",
      {
        detail: {

          id:
            game.id,

          name:
            game.name,

          category:
            game.category,

          version:
            game.version

        }
      }
    )
  );

})();

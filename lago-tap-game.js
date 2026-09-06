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
 * LEGACY TAP UPGRADES
 *
 * Old clicker economy is being
 * decommissioned.
 *
 * Real economy:
 *
 * DUM  = gameplay stamina
 * SP   = permanent progression
 * $LAGO = Solana token
 *
 * No additional Tap currency exists.
 * =========================================================
 */
  
  const UPGRADES = [

    {
      key: "click",
      icon: "🚀",
      name: "УСИЛЕНИЕ КЛИКА",
   desc: "+1 SP за каждый успешный клик",
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
    desc: "AUTO временно отключён",
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
    desc: "Будет перенесено в HEIST",
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
 * =========================================================
 * CANONICAL TAP REWARD
 * =========================================================
 *
 * One successful Tap Lago action
 * always earns exactly 1 SP.
 *
 * Legacy power / memes / auto
 * must not influence permanent
 * account progression.
 *
 * Future character/item bonuses
 * will be implemented explicitly
 * through the Character Engine.
 */
const gain =
  1;


/*
 * Keep old Tap statistics alive
 * during migration.
 */
current.totalClicks++;


/*
 * Permanent account progression.
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

  /*
   * Old local steal economy
   * is permanently disabled.
   *
   * Real player raids arrive
   * in R0.5D Heist Foundation.
   */

  runtime.toast(
    "HEIST ЕЩЁ НЕ ПОДКЛЮЧЁН 🐌"
  );


  runtime.beep(
    120,
    0.08
  );


  return getState();

}


  /*
   * =========================================================
   * AUTO INCOME
   * =========================================================
   */

 function autoTick() {

  /*
   * Legacy passive economy disabled.
   *
   * AUTO will be redesigned later
   * using only canonical Lago
   * progression rules.
   */

  return;

}


function startAuto() {

  /*
   * Do not start the old
   * passive-income timer.
   */

  return;

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


 function buyUpgrade(
  key
) {

  const upgrade =
    getUpgrade(
      key
    );


  if (!upgrade) {

    console.warn(
      `[TAP LAGO] Unknown upgrade: ${key}`
    );

    return false;

  }


  /*
   * Legacy energy-priced upgrades
   * are disabled.
   *
   * R0.5B4.2 will introduce
   * the canonical character/game
   * upgrade rules.
   */

  runtime.toast(
    "UPGRADES ВРЕМЕННО ОТКЛЮЧЕНЫ"
  );


  runtime.beep(
    90,
    0.08
  );


  return false;

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
                disabled
                >
                 ${
  maxed
    ? "MAX"
    : "SOON"
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

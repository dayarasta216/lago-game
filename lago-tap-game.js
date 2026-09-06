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

  const account =
    window.LAGO_ACCOUNT;


  /*
   * Fail closed.
   */
  if (
    !account ||
    typeof account.getTapAutoState !==
      "function" ||
    typeof account.consumeTapDum !==
      "function" ||
    typeof account.addSP !==
      "function"
  ) {

    return;

  }


  const auto =
    account.getTapAutoState();


  const rate =
    Math.max(
      0,

      Math.floor(
        Number(
          auto
            ?.spPerSecond
        ) || 0
      )
    );


  if (
    rate <= 0
  ) {

    return;

  }


  let earned =
    0;


  /*
   * Each AUTO SP behaves like
   * one successful automatic tap.
   *
   * Therefore AUTO and manual Tap
   * share the same DUM tapCounter.
   */
  for (
    let i = 0;
    i < rate;
    i++
  ) {

    const dumResult =
      account.consumeTapDum({
        gameId:
          "tap-lago"
      });


    if (
      !dumResult ||
      dumResult.allowed !==
        true
    ) {

      break;

    }


    account.addSP(
      1,
      {
        gameId:
          "tap-lago"
      }
    );


    earned++;

  }


  if (
    earned <= 0
  ) {

    return;

  }


  /*
   * Refresh visible game/account UI.
   *
   * AUTO does NOT count as a
   * physical player click.
   */
  runtime.render();

}
function startAuto() {

  if (
    autoTimer
  ) {

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


function buyUpgrade(
  key
) {

  /*
   * Only canonical AUTO upgrade
   * exists in Tap Lago now.
   */
  if (
    key !==
    "auto"
  ) {

    return false;

  }


  const account =
    window.LAGO_ACCOUNT;


  if (
    !account ||
    typeof account.upgradeTapAuto !==
      "function"
  ) {

    console.error(
      "[TAP LAGO] AUTO upgrade API is missing."
    );


    runtime.toast(
      "ACCOUNT CORE ERROR"
    );


    return false;

  }


  const result =
    account.upgradeTapAuto();


  if (
    result
      ?.ok ===
      true
  ) {

    runtime.toast(
      `AUTO LEVEL ${result.level} · ${result.spPerSecond} SP/S`
    );


    runtime.beep(
      720,
      0.08
    );


    renderUpgrades();


    runtime.render();


    return true;

  }


  if (
    result
      ?.reason ===
      "max"
  ) {

    runtime.toast(
      "AUTO MAX LEVEL"
    );

    return false;

  }


  if (
    result
      ?.reason ===
      "level"
  ) {

    runtime.toast(
      `NEED LEVEL ${result.requiredLevel} · ${result.requiredSp} SP`
    );

    return false;

  }


  if (
    result
      ?.reason ===
      "dum"
  ) {

    runtime.toast(
      `NEED ${result.dumCost} DUM`
    );

    return false;

  }


  runtime.toast(
    "AUTO UPGRADE FAILED"
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


  const account =
    window.LAGO_ACCOUNT;


  if (
    !account ||
    typeof account
      .getTapAutoUpgradeState !==
      "function"
  ) {

    list.innerHTML =
      `
        <div class="card">
          ACCOUNT CORE ERROR
        </div>
      `;

    return;

  }


  const auto =
    account
      .getTapAutoUpgradeState();


  const nextRate =
    auto.maxed

      ? auto.spPerSecond

      : auto.nextLevel;


  list.innerHTML =
    `
      <div class="card">

        <div>

          <div
            style="font-size:20px"
          >
            🤖
            <b>
              AUTO SP / SEC
            </b>
          </div>


          <div class="desc">

            AUTO LEVEL:
            ${auto.level}/${auto.maxLevel}

            <br>

            CURRENT:
            ${auto.spPerSecond} SP/S

            <br>

            ${
              auto.maxed

                ? "MAX LEVEL"

                : `NEXT: ${nextRate} SP/S`
            }

            ${
              auto.maxed

                ? ""

                : `
                  <br>
                  REQUIRES:
                  LEVEL ${auto.requiredLevel}
                  / ${auto.requiredSp} SP

                  <br>
                  COST:
                  ${auto.dumCost} DUM
                `
            }

          </div>

        </div>


        <button
          class="buy"
          data-up="auto"
          ${
            auto.maxed
              ? "disabled"
              : ""
          }
        >

          ${
            auto.maxed
              ? "MAX"
              : `${auto.dumCost} DUM`
          }

        </button>

      </div>
    `;


  list
    .querySelector(
      '[data-up="auto"]'
    )
    ?.addEventListener(
      "click",
      () => {

        buyUpgrade(
          "auto"
        );

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

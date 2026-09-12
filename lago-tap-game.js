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


const ui =
  window.LAGO_UI;


if (
  !runtime ||
  !ui
) {

  console.error(
    "[TAP LAGO] Required game runtime/UI is missing."
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

  let lastPhysicalTapAt =
  0;


const tapIntervals =
  [];


const DOUBLE_CLICK_COST =
  10000;

  function state() {

    return runtime.getState();

  }

  function publishState() {

  const snapshot =
    getState();


  document.dispatchEvent(
    new CustomEvent(
      "lago:tap-game-state",
      {
        detail:
          snapshot
      }
    )
  );


  return snapshot;

}

  function formatNumber(value) {

    return Math.floor(
      Number(value) || 0
    ).toLocaleString(
      "ru-RU"
    );

  }


  function randomPhrase() {

    if (!PHRASES.length) {

      return "Lago is lagging...";

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
      value
    )
  );

}


function roundSP(
  value
) {

  return (
    Math.round(
      Number(value) *
      100
    ) /
    100
  );

}


function tapStrength(
  sample
) {

  if (
    !sample ||
    (
      sample.pointerType !==
        "touch" &&
      sample.pointerType !==
        "pen"
    )
  ) {

    return 1;

  }


  const minPressure =
    Number(
      sample.minPressure
    ) || 0;


  const maxPressure =
    Number(
      sample.maxPressure
    ) || 0;


  const variablePressure =
    maxPressure > 0 &&
    Math.abs(
      maxPressure -
      minPressure
    ) > 0.025;


  if (
    variablePressure
  ) {

    if (maxPressure >= .80)
      return 5;

    if (maxPressure >= .62)
      return 4;

    if (maxPressure >= .45)
      return 3;

    if (maxPressure >= .28)
      return 2;


    return 1;

  }


  const duration =
    Number(
      sample.duration
    ) || 0;


  if (duration >= 230)
    return 5;

  if (duration >= 175)
    return 4;

  if (duration >= 130)
    return 3;

  if (duration >= 90)
    return 2;


  return 1;

}
    
    return PHRASES[
      Math.floor(
        Math.random() *
        PHRASES.length
      )
    ];

  }

  function playTapSound() {

  try {

    const audio =
      window.LAGO_CHARACTER_AUDIO;


    if (
      audio &&
      typeof audio.playTap ===
        "function"
    ) {

      audio.playTap();

      return;

    }

  } catch (
    error
  ) {

    console.warn(
      "[TAP LAGO AUDIO]",
      error
    );

  }


  /*
   * Emergency sound fallback.
   */
  runtime.beep(
    205,
    0.045,
    "sine"
  );

}

function tapStrengthLabel(
  strength
) {

  switch (
    Number(
      strength
    )
  ) {

    case 5:
      return "MAX";

    case 4:
      return "HARD";

    case 3:
      return "STRONG";

    case 2:
      return "FIRM";

    default:
      return "LIGHT";

  }

}
  
  function tapTempo() {

  const now =
    performance.now();


  /*
   * Первый tap ещё не имеет
   * предыдущего интервала.
   */
  if (
    lastPhysicalTapAt <= 0
  ) {

    lastPhysicalTapAt =
      now;


    return {

      multiplier:
        1,

      antiBot:
        false,

      average:
        Infinity

    };

  }


  const interval =
    now -
    lastPhysicalTapAt;


  lastPhysicalTapAt =
    now;


  /*
   * Храним только последние
   * 5 интервалов.
   */
  tapIntervals.push(
    interval
  );


  if (
    tapIntervals.length > 5
  ) {

    tapIntervals.shift();

  }


  const average =
    tapIntervals.reduce(
      (sum, value) =>
        sum + value,
      0
    ) /
    tapIntervals.length;


  /*
   * Скорость игрока даёт
   * бонус от x1.00 до x1.85.
   */
  let multiplier =
    1;


  if (
    average <= 150
  ) {

    multiplier =
      1.85;

  } else if (
    average <= 190
  ) {

    multiplier =
      1.70;

  } else if (
    average <= 240
  ) {

    multiplier =
      1.55;

  } else if (
    average <= 310
  ) {

    multiplier =
      1.40;

  } else if (
    average <= 390
  ) {

    multiplier =
      1.25;

  } else if (
    average <= 500
  ) {

    multiplier =
      1.10;

  }


  /*
   * Anti-bot.
   *
   * Если последние несколько
   * нажатий идут быстрее примерно
   * 80 мс между тапами,
   * считаем поток подозрительным.
   *
   * Коэффициент скорости остаётся,
   * но сила принудительно = 1.
   *
   * Максимум такого потока:
   *
   * 1 × 1.85 = 1.85 SP
   */
  const antiBot =
    tapIntervals.length >= 4 &&
    average < 80;


  return {

    multiplier,

    antiBot,

    average

  };

}
  
  /*
   * =========================================================
   * TAP
   * =========================================================
   */

function tap(
  event = null,
  sample = null
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


    ui.toast(
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

    ui.toast(
      "DUM ENERGY 0 😭 WAIT FOR REGEN"
    );


    runtime.beep(
      90,
      0.1
    );


    ui.setSpeech(
  "Lago is out of energy..."
);


  return publishState();

  }


  const current =
    state();

  /*
 * =========================================================
 * PHYSICAL TAP POWER
 * =========================================================
 */

const tempo =
  tapTempo();


let strength =
  tapStrength(
    sample
  );


/*
 * Подозрительно быстрый поток:
 * не разрешаем strength 2–5.
 */
if (
  tempo.antiBot
) {

  strength =
    1;

}


/*
 * DOUBLE CLICK upgrade.
 *
 * 0 = обычный reward
 * 1 = reward ×2
 */
const doubleClickUnlocked =
  Number(
    current
      ?.upgrades
      ?.doubleClick
  ) >= 1;


const doubleClickMultiplier =
  (
    doubleClickUnlocked &&
    !tempo.antiBot
  )

    ? 2

    : 1;
/*
 * Финальный SP за один
 * физический tap.
 *
 * MAX без Double Click:
 * 5 × 1.85 = 9.25
 *
 * MAX с Double Click:
 * 5 × 1.85 × 2 = 18.50
 */
const gain =
  roundSP(
    strength *
    tempo.multiplier *
    doubleClickMultiplier
  );

  const strengthLabel =
  tapStrengthLabel(
    strength
  );


const tempoLabel =
  tempo.multiplier > 1

    ? `×${tempo.multiplier.toFixed(
        2
      )}`

    : "";


const doubleClickLabel =
  doubleClickMultiplier === 2

    ? "DOUBLE ×2"

    : "";
  
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


ui.animateTap();


  ui.setSpeech(
  randomPhrase()
);


 playTapSound();

   
  /*
   * Show the real economy:
   *
   * successful tap → SP
   * every 5th tap → -1 DUM
   */
 const spentDum =
  Math.max(
    0,
    Math.floor(
      Number(
        dumResult.spent
      ) || 0
    )
  );

  const gainLabel =
  gain.toLocaleString(
    "en-US",
    {
      minimumFractionDigits:
        Number.isInteger(
          gain
        )
          ? 0
          : 2,

      maximumFractionDigits:
        2
    }
  );

ui.spawnFloat(

  spentDum > 0

    ? `+${gainLabel} SP · -${spentDum} DUM`

    : `+${gainLabel} SP`,

  event,

  {

    strength,

    strengthLabel,

    tempoMultiplier:
      tempo.multiplier,

    tempoLabel,

    doubleClick:
      doubleClickMultiplier === 2,

    doubleClickLabel,

    speedLimited:
      tempo.antiBot === true

  }

);
  
  runtime.checkAchievements();

runtime.render();

   publishState();

runtime.save();


return publishState();

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

  ui.toast(
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

function buyDoubleClick() {

  const current =
    state();


  if (
    Number(
      current
        ?.upgrades
        ?.doubleClick
    ) >= 1
  ) {

    ui.toast(
      "DOUBLE CLICK ALREADY ACTIVE"
    );

    return false;

  }


  const account =
    window.LAGO_ACCOUNT;


  if (
    !account
      ?.canSpendSP
      ?.(
        DOUBLE_CLICK_COST
      )
  ) {

    ui.toast(
      `NEED ${DOUBLE_CLICK_COST.toLocaleString(
        "en-US"
      )} SP`
    );

    return false;

  }


  const spent =
    account
      ?.spendSP
      ?.(
        DOUBLE_CLICK_COST,
        {
          gameId:
            "tap-lago-double-click"
        }
      );


  if (
    spent !== true
  ) {

    ui.toast(
      "DOUBLE CLICK PURCHASE FAILED"
    );

    return false;

  }


  current.upgrades.doubleClick =
    1;


  runtime.save();


  ui.toast(
    "DOUBLE CLICK UNLOCKED · TAP ×2"
  );


  renderUpgrades();

  publishState();


  return true;

}
  
function buyUpgrade(
  key
) {

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

    ui.toast(
      "ACCOUNT CORE ERROR"
    );

    return false;

  }


  const result =
    account.upgradeTapAuto();


  if (
    result?.ok === true
  ) {

    ui.toast(
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
    result?.reason ===
    "max"
  ) {

    ui.toast(
      "AUTO MAX LEVEL"
    );

    return false;

  }


  if (
    result?.reason ===
    "progress"
  ) {

    ui.toast(
      `NEED LEVEL ${result.requiredLevel} · ${formatNumber(
        result.requiredLifetimeSp
      )} LIFETIME SP`
    );

    return false;

  }


  if (
    result?.reason ===
    "sp"
  ) {

    ui.toast(
      `NEED ${formatNumber(
        result.spCost
      )} SP`
    );

    return false;

  }


  if (
    result?.reason ===
    "dum"
  ) {

    ui.toast(
      `NEED ${result.dumCost} DUM`
    );

    return false;

  }


  ui.toast(
    "AUTO UPGRADE FAILED"
  );


  return false;

}

  /*
 * =========================================================
 * PREMIUM AUTO PURCHASE
 * =========================================================
 *
 * Real $LAGO purchase is intentionally
 * fail-closed until R0.5E.
 *
 * No localStorage unlock.
 * No fake balance.
 * No client-side AUTO grant.
 */
async function buyAutoWithLago() {

  const premium =
    window.LAGO_PREMIUM;


  if (
    !premium ||
    typeof premium.beginTapAutoPurchase !==
      "function"
  ) {

    ui.toast(
      "$LAGO PAYMENT SYSTEM NOT READY"
    );

    return false;

  }


  const result =
    await premium
      .beginTapAutoPurchase();


  if (
    result?.reason ===
    "max"
  ) {

    ui.toast(
      "AUTO MAX LEVEL"
    );

    return false;

  }


  if (
    result?.reason ===
      "payment_not_configured" ||
    result?.reason ===
      "payment_backend_not_connected"
  ) {

    ui.toast(
      "$LAGO + PHANTOM SECURE CHECKOUT COMING IN R0.5E"
    );


    runtime.beep(
      110,
      0.06
    );


    return false;

  }


  /*
   * There is deliberately no
   * successful client-side unlock.
   */
  ui.toast(
    "$LAGO PURCHASE NOT VERIFIED"
  );


  return false;

}

function renderUpgrades() {

  const list =
    document.getElementById(
      "upgradeList"
    );


  if (!list) const current =
  state();


const doubleUnlocked =
  Number(
    current
      ?.upgrades
      ?.doubleClick
  ) >= 1;


const doubleHTML =
  `
    <div
      class="card lago-double-click-card"
    >

      <div
        class="lago-auto-upgrade-title"
      >
        ✌️ DOUBLE CLICK
      </div>


      <div
        class="desc"
      >
        EACH PHYSICAL TAP EARNS ×2 SP
      </div>


      ${
        doubleUnlocked

          ? `
            <div
              class="lago-auto-max"
            >
              ACTIVE · ×2 TAP
            </div>
          `

          : `
            <button
              class="buy"
              data-double-click
              type="button"
            >
              UNLOCK · ${DOUBLE_CLICK_COST.toLocaleString(
                "en-US"
              )} SP
            </button>
          `
      }

    </div>
  `; {

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
  doubleHTML +
  `
    <div
      class="card lago-auto-upgrade-card"
      >
list
  .querySelector(
    "[data-double-click]"
  )
  ?.addEventListener(
    "click",
    buyDoubleClick
  );
        <div
          class="lago-auto-upgrade-head"
        >

          <div>

            <div
              class="lago-auto-upgrade-title"
            >
              🤖 AUTO SP / SEC
            </div>

            <div
              class="desc"
            >
              AUTO LEVEL
              ${auto.level}/${auto.maxLevel}
            </div>

          </div>


          <div
            class="lago-auto-rate"
          >
            ${auto.spPerSecond}
            SP/S
          </div>

        </div>


        ${
          auto.maxed

            ? `
              <div
                class="lago-auto-max"
              >
                MAX AUTO LEVEL
              </div>
            `

            : `
              <div
                class="lago-auto-next"
              >
                NEXT LEVEL:
                ${nextRate} SP/S
              </div>


              <div
                class="lago-auto-routes"
              >

                <!-- FREE PATH -->

                <div
                  class="lago-auto-route"
                >

                  <div
                    class="lago-auto-route-title"
                  >
                    FREE GRIND
                  </div>


                  <div
                    class="desc"
                  >

                    REQUIRES

                    <br>

                    LEVEL
                    ${auto.requiredLevel}

                    <br>

                    ${formatNumber(
                      auto.requiredLifetimeSp
                    )}
                    LIFETIME SP

                    <br><br>

                    COST

                    <br>

                    ${formatNumber(
                      auto.spCost
                    )}
                    SP

                    <br>

                    ${auto.dumCost}
                    DUM

                  </div>


                  <button
                    class="buy lago-auto-free-buy"
                    data-up="auto"
                  >
                    FREE GRIND
                  </button>

                </div>


                <!-- PREMIUM PATH -->

                <div
                  class="lago-auto-route lago-auto-route-premium"
                >

                  <div
                    class="lago-auto-route-title"
                  >
                    $LAGO
                  </div>


                  <div
                    class="desc"
                  >

                    REAL SOLANA TOKEN

                    <br>

                    PHANTOM PAYMENT

                    <br><br>

                    LIVE $LAGO PRICE

                    <br>

                    CALCULATED AT CHECKOUT

                    <br><br>

                    NO SP GRIND

                  </div>


                  <button
                    class="buy lago-auto-lago-buy"
                    data-auto-lago
                    type="button"
                  >
                    BUY WITH $LAGO
                  </button>


                  <div
                    class="lago-auto-coming"
                  >
                    ON-CHAIN PAYMENT · R0.5E
                  </div>

                </div>

              </div>
            `
        }

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


  list
    .querySelector(
      "[data-auto-lago]"
    )
    ?.addEventListener(
      "click",
      () => {

        buyAutoWithLago();

      }
    );

}
 function openUpgrades() {

  renderUpgrades();


  ui.openPanel(
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
  5,


    tap,


    steal,


    getState,


    startAuto,


    stopAuto,


    buyUpgrade,


    renderUpgrades,


    openUpgrades,


    openCreator() {

  return window.LAGO_CREATOR
    ?.open
    ?.();

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

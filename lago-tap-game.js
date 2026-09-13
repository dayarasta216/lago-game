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


  let autoTimer =
    null;


  let lastPhysicalTapAt =
    0;


  const tapIntervals =
    [];


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


  function formatNumber(
    value
  ) {

    return Math.floor(
      Number(value) || 0
    ).toLocaleString(
      "ru-RU"
    );

  }


  function randomPhrase() {

    if (
      !PHRASES.length
    ) {

      return "Lago is lagging...";

    }


    return PHRASES[
      Math.floor(
        Math.random() *
        PHRASES.length
      )
    ];

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
      minPressure > 0 &&
      maxPressure > 0 &&
      Math.abs(
        maxPressure -
        minPressure
      ) > 0.025;


    if (
      variablePressure
    ) {

      if (
        maxPressure >= .80
      ) {

        return 5;

      }


      if (
        maxPressure >= .62
      ) {

        return 4;

      }


      if (
        maxPressure >= .45
      ) {

        return 3;

      }


      if (
        maxPressure >= .28
      ) {

        return 2;

      }


      return 1;

    }


    const duration =
      Number(
        sample.duration
      ) || 0;


   /*
 * Pressure-less smartphones.
 *
 * MAX strength must still be possible
 * during a genuinely quick human tap.
 *
 * Otherwise strength 5 at 230 ms
 * could never combine with the
 * <=150 ms ×1.85 tempo tier.
 */

if (
  duration >= 110
) {

  return 5;

}


if (
  duration >= 85
) {

  return 4;

}


if (
  duration >= 65
) {

  return 3;

}


if (
  duration >= 45
) {

  return 2;

}


    return 1;

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
        (
          sum,
          value
        ) =>
          sum +
          value,
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

  function resetTapTempo() {

  lastPhysicalTapAt =
    0;


  tapIntervals.length =
    0;

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
   * Manual Tap Lago now requires
   * ONE atomic Account Core API.
   */
  if (
    !account ||
    typeof account
      .applyTapReward !==
      "function"
  ) {

    console.error(
      "[TAP LAGO] Atomic tap API is missing."
    );


    ui.toast(
      "ACCOUNT CORE ERROR"
    );


    return getState();

  }


  /*
   * =========================================================
   * PHYSICAL TAP
   * =========================================================
   */

  const tempo =
    tapTempo();


  let strength =
    tapStrength(
      sample
    );


  /*
   * Machine-like sustained stream:
   * force physical strength to 1.
   */
  if (
    tempo.antiBot
  ) {

    strength =
      1;

  }


  /*
   * =========================================================
   * DOUBLE CLICK
   * =========================================================
   */

  const doubleClickState =
    account
      .getDoubleClickUpgradeState
      ?.() || {

        unlocked:
          false,

        multiplier:
          1

      };


  const doubleClickUnlocked =
    doubleClickState
      .unlocked ===
      true;


  /*
   * FAST LIMIT never receives
   * permanent ×2 upgrade.
   */
  const doubleClickMultiplier =
    (
      doubleClickUnlocked &&
      !tempo.antiBot
    )

      ? 2

      : 1;


  /*
   * =========================================================
   * REWARD
   * =========================================================
   */

  const gain =
    roundSP(
      strength *
      tempo.multiplier *
      doubleClickMultiplier
    );


  /*
   * =========================================================
   * ONE ACCOUNT TRANSACTION
   * =========================================================
   */

  const result =
    account.applyTapReward(
      gain,
      {
        gameId:
          "tap-lago"
      }
    );


  /*
   * DUM = 0.
   *
   * Failed spam must not preload
   * the fast-tap multiplier.
   */
  if (
    !result ||
    result.allowed !==
      true
  ) {

    resetTapTempo();


    if (
      result?.reason ===
      "dum"
    ) {

      ui.toast(
        "DUM ENERGY 0 😭 WAIT FOR REGEN"
      );


      runtime.beep(
        90,
        .1
      );


      ui.setSpeech(
        "Lago is out of energy..."
      );

    } else {

      ui.toast(
        "TAP FAILED"
      );

    }


    return publishState();

  }

  /*
   * =========================================================
   * FEEDBACK
   * =========================================================
   */

  ui.animateTap();


  ui.setSpeech(
    randomPhrase()
  );


  playTapSound();


  const spentDum =
    Math.max(
      0,
      Math.floor(
        Number(
          result.spent
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
    doubleClickMultiplier ===
      2

      ? "DOUBLE ×2"

      : "";


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
        doubleClickMultiplier ===
        2,

      doubleClickLabel,

      speedLimited:
        tempo.antiBot ===
        true

    }

  );


    /*
   * Account achievements are watched
   * from canonical account-state events.
   *
   * No legacy achievement scan belongs
   * in the physical tap hot path.
   */


  /*
 * Account Core already persisted:
 *
 * SP
 * DUM
 * clicks
 * lifetime
 * level
 * game stats
 *
 * No second localStorage write here.
 */

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

  /*
   * Absolutely no offline/background
   * AUTO income.
   */
  if (
    document.hidden
  ) {

    return;

  }


  const account =
    window.LAGO_ACCOUNT;


  if (
    !account ||
    typeof account
      .getTapAutoState !==
      "function" ||
    typeof account
      .applyAutoReward !==
      "function"
  ) {

    return;

  }


  const auto =
    account
      .getTapAutoState();


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


  /*
   * Entire second of AUTO activity
   * is processed by ONE Account Core
   * transaction.
   */
  const result =
    account
      .applyAutoReward(
        rate,
        {
          gameId:
            "tap-lago"
        }
      );


  if (
    !result ||
    result.ok !==
      true ||
    result.earned <=
      0
  ) {

    return;

  }


  /*
   * Account Core already emitted its
   * canonical account-state event.
   *
   * We only publish Tap Lago's
   * lightweight compatibility state.
   */
  publishState();

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

    if (
      !autoTimer
    ) {

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

  function buyDoubleClick() {

    const account =
      window.LAGO_ACCOUNT;


    if (
      !account ||
      typeof account
        .unlockDoubleClick !==
        "function"
    ) {

      ui.toast(
        "ACCOUNT CORE ERROR"
      );


      return false;

    }


    const result =
      account
        .unlockDoubleClick();


    /*
     * Успешная покупка.
     */
    if (
      result?.ok ===
      true
    ) {

      ui.toast(
        "DOUBLE CLICK UNLOCKED · TAP ×2"
      );


      runtime.beep(
        880,
        .08,
        "sine"
      );


      runtime.beep(
        1320,
        .10,
        "sine"
      );


      renderModernUpgrades();


      runtime.render();


      publishState();


      return true;

    }


    /*
     * Уже куплен.
     */
    if (
      result?.reason ===
      "owned"
    ) {

      ui.toast(
        "DOUBLE CLICK ALREADY ACTIVE"
      );


      return false;

    }


    /*
     * Не хватает SP.
     */
    if (
      result?.reason ===
      "sp"
    ) {

      ui.toast(
        `NEED ${Number(
          result.spCost || 0
        ).toLocaleString(
          "en-US"
        )} SP`
      );


      return false;

    }


    ui.toast(
      "DOUBLE CLICK PURCHASE FAILED"
    );


    return false;

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
      result?.ok ===
      true
    ) {

      ui.toast(
        `AUTO LEVEL ${result.level} · ${result.spPerSecond} SP/S`
      );


      runtime.beep(
        720,
        0.08
      );


      renderModernUpgrades();


      runtime.render();


      publishState();


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


  function ensureModernUpgradeScreen() {

    let root =
      document.getElementById(
        "lagoUpgradeScreen"
      );


    if (
      root
    ) {

      return root;

    }


    root =
      document.createElement(
        "div"
      );


    root.id =
      "lagoUpgradeScreen";


    root.className =
      "lago-upgrade-screen";


    root.innerHTML = `
      <div
        class="lago-upgrade-shell"
      >

        <header
          class="lago-upgrade-header"
        >

          <div>

            <div
              class="lago-upgrade-kicker"
            >
              CHARACTER UPGRADES
            </div>

            <div
              class="lago-upgrade-title"
            >
              UPGRADE LAGO
            </div>

          </div>


          <button
            class="lago-upgrade-close"
            type="button"
            data-upgrade-close
            aria-label="Close upgrades"
          >
            ×
          </button>

        </header>


        <div
          class="lago-upgrade-balance"
        >

          <span>
            SP BALANCE
          </span>

          <strong
            id="lagoUpgradeBalance"
          >
            0 SP
          </strong>

        </div>


        <div
          class="lago-upgrade-grid"
          id="lagoUpgradeGrid"
        ></div>

      </div>
    `;


    document.body.appendChild(
      root
    );


    root
      .querySelector(
        "[data-upgrade-close]"
      )
      ?.addEventListener(
        "click",
        closeUpgrades
      );


    root.addEventListener(
      "click",
      event => {

        if (
          event.target ===
          root
        ) {

          closeUpgrades();

        }

      }
    );


    return root;

  }


  function closeUpgrades() {

    document
      .getElementById(
        "lagoUpgradeScreen"
      )
      ?.classList.remove(
        "show"
      );

  }


  function renderModernUpgrades() {

    const root =
      ensureModernUpgradeScreen();


    const grid =
      root.querySelector(
        "#lagoUpgradeGrid"
      );


    const balanceElement =
      root.querySelector(
        "#lagoUpgradeBalance"
      );


    const account =
      window.LAGO_ACCOUNT;


    if (
      !grid ||
      !account
    ) {

      return;

    }


    /*
     * =========================================================
     * SP BALANCE
     * =========================================================
     */

    const spState =
      account
        .getSPState
        ?.() || {};


    const balance =
      Math.max(
        0,
        Number(
          spState.balance
        ) || 0
      );


    if (
      balanceElement
    ) {

      balanceElement.textContent =
        `${balance.toLocaleString(
          "en-US",
          {
            minimumFractionDigits:
              Number.isInteger(
                balance
              )
                ? 0
                : 2,

            maximumFractionDigits:
              2
          }
        )} SP`;

    }


    /*
     * =========================================================
     * DOUBLE CLICK
     * =========================================================
     */

    const doubleState =
      account
        .getDoubleClickUpgradeState
        ?.() || {

          unlocked:
            false,

          multiplier:
            1,

          spCost:
            0

        };


    const doubleUnlocked =
      doubleState.unlocked ===
      true;


    const doubleCost =
      Math.max(
        0,
        Number(
          doubleState.spCost
        ) || 0
      );


    /*
     * =========================================================
     * AUTO
     * =========================================================
     */

    const auto =
      account
        .getTapAutoUpgradeState
        ?.() || {

          level:
            0,

          maxLevel:
            0,

          spPerSecond:
            0,

          nextLevel:
            0,

          requiredLevel:
            0,

          requiredLifetimeSp:
            0,

          spCost:
            0,

          dumCost:
            0,

          maxed:
            false

        };


    grid.innerHTML = `

      <!-- DOUBLE CLICK -->

      <article
        class="
          lago-upgrade-card
          lago-upgrade-card-double
          ${
            doubleUnlocked
              ? "active"
              : ""
          }
        "
      >

        <div
          class="lago-upgrade-card-top"
        >

          <div
            class="lago-upgrade-icon"
          >
            ✌️
          </div>


          <div
            class="lago-upgrade-status"
          >
            ${
              doubleUnlocked
                ? "ACTIVE"
                : "LOCKED"
            }
          </div>

        </div>


        <div
          class="lago-upgrade-card-name"
        >
          DOUBLE CLICK
        </div>


        <div
          class="lago-upgrade-card-effect"
        >
          ×2 TAP REWARD
        </div>


        <div
          class="lago-upgrade-card-desc"
        >
          Doubles SP earned by legitimate physical taps.
          Fast-limit taps do not receive the ×2 multiplier.
        </div>


        ${
          doubleUnlocked

            ? `
              <div
                class="
                  lago-upgrade-owned
                "
              >
                UNLOCKED
              </div>
            `

            : `
              <button
                class="
                  lago-upgrade-buy
                "
                type="button"
                data-upgrade-double
              >
                UNLOCK · ${doubleCost.toLocaleString(
                  "en-US"
                )} SP
              </button>
            `
        }

      </article>


      <!-- AUTO -->

      <article
        class="
          lago-upgrade-card
          lago-upgrade-card-auto
        "
      >

        <div
          class="lago-upgrade-card-top"
        >

          <div
            class="lago-upgrade-icon"
          >
            🤖
          </div>


          <div
            class="lago-upgrade-status"
          >
            LV ${Number(
              auto.level
            ) || 0}
          </div>

        </div>


        <div
          class="lago-upgrade-card-name"
        >
          AUTO
        </div>


        <div
          class="lago-upgrade-card-effect"
        >
          ${Number(
            auto.spPerSecond
          ) || 0} SP / SEC
        </div>


        ${
          auto.maxed

            ? `
              <div
                class="
                  lago-upgrade-owned
                "
              >
                MAX LEVEL
              </div>
            `

            : `
              <div
                class="lago-upgrade-auto-next"
              >

                <span>
                  NEXT
                </span>

                <strong>
                  ${Number(
                    auto.nextLevel
                  ) || 0} SP/S
                </strong>

              </div>


              <div
                class="lago-upgrade-cost-grid"
              >

                <div>
                  <span>
                    REQUIRED LEVEL
                  </span>

                  <strong>
                    ${Number(
                      auto.requiredLevel
                    ) || 0}
                  </strong>
                </div>


                <div>
                  <span>
                    LIFETIME SP
                  </span>

                  <strong>
                    ${Number(
                      auto.requiredLifetimeSp
                    ).toLocaleString(
                      "en-US"
                    )}
                  </strong>
                </div>


                <div>
                  <span>
                    SP COST
                  </span>

                  <strong>
                    ${Number(
                      auto.spCost
                    ).toLocaleString(
                      "en-US"
                    )}
                  </strong>
                </div>


                <div>
                  <span>
                    DUM COST
                  </span>

                  <strong>
                    ${Number(
                      auto.dumCost
                    ) || 0}
                  </strong>
                </div>

              </div>


              <button
                class="
                  lago-upgrade-buy
                "
                type="button"
                data-upgrade-auto
              >
                UPGRADE AUTO
              </button>


              <button
                class="
                  lago-upgrade-buy
                  lago-upgrade-buy-premium
                "
                type="button"
                data-upgrade-auto-lago
              >
                BUY WITH $LAGO
              </button>
            `
        }

      </article>

    `;


    /*
     * DOUBLE CLICK
     */
    grid
      .querySelector(
        "[data-upgrade-double]"
      )
      ?.addEventListener(
        "click",
        () => {

          buyDoubleClick();

        }
      );


    /*
     * AUTO FREE
     */
    grid
      .querySelector(
        "[data-upgrade-auto]"
      )
      ?.addEventListener(
        "click",
        () => {

          buyUpgrade(
            "auto"
          );

        }
      );


    /*
     * AUTO $LAGO
     */
    grid
      .querySelector(
        "[data-upgrade-auto-lago]"
      )
      ?.addEventListener(
        "click",
        () => {

          buyAutoWithLago();

        }
      );

  }


  function openUpgrades() {

    const root =
      ensureModernUpgradeScreen();


    renderModernUpgrades();


    root.classList.add(
      "show"
    );

  }


  /*
   * =========================================================
   * PUBLIC STATE
   * =========================================================
   */

  function getState() {

  const legacy =
    runtime.getTapState();


  const accountState =
    window.LAGO_ACCOUNT
      ?.getState
      ?.();


  return {

    ...legacy,

    /*
     * Canonical click count.
     *
     * This keeps the UI correct even
     * immediately after page reload,
     * before the first new tap.
     */
    totalClicks:
      Math.max(
        0,
        Math.floor(
          Number(
            accountState
              ?.clicks
          ) || 0
        )
      )

  };

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
      6,


    tap,


    steal,


    getState,


    startAuto,


    stopAuto,


    buyUpgrade,


    openUpgrades,


    closeUpgrades,


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


  publishState();


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

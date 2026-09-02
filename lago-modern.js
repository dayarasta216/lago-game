(() => {

  "use strict";


  function $(id) {
    return document.getElementById(id);
  }


  let tapState = null;


function readTapState() {

  try {

    if (
      window.LAGO_TAP_GAME &&
      typeof window.LAGO_TAP_GAME.getState === "function"
    ) {

      return window.LAGO_TAP_GAME.getState();

    }

  } catch (error) {

    console.warn(
      "[LAGO MODERN] Could not read Tap Lago state:",
      error
    );

  }


  return tapState || {
    energy: 0,
    power: 1,
    auto: 0,
    shield: 0,
    days: 0,
    speech: ""
  };

}

  function createUI() {

    if (
      document.getElementById(
        "lagoModern"
      )
    ) return;


    const root =
      document.createElement("div");

    root.id =
      "lagoModern";


    root.innerHTML = `

      <!-- HEADER -->

      <header
        class="lago-modern-header"
      >

        <div class="lago-brand">

          <div
            class="lago-brand-name"
          >
            LAGO
          </div>

          <div
            class="lago-brand-tag"
          >
            BRAINROT SNAIL
          </div>

        </div>


        <nav
          class="lago-main-nav"
        >

          <button
            class="lago-nav-btn active"
            data-page="play"
          >
            PLAY
          </button>

          <button
            class="lago-nav-btn"
            data-page="create"
          >
            CREATE
          </button>

          <button
            class="lago-nav-btn"
            data-page="collection"
          >
            COLLECTION
          </button>

          <button
            class="lago-nav-btn"
            data-page="shop"
          >
            SHOP
          </button>

        </nav>


        <div
          class="lago-profile"
        >

          <div
            class="lago-profile-icon"
          >
            🐌
          </div>

          <div
            class="lago-profile-text"
          >

            <div
              class="lago-profile-level"
            >
              LEVEL
            </div>

            <div
              class="lago-profile-value"
              id="modernLevel"
            >
              1
            </div>

          </div>

        </div>

      </header>


      <!-- STATS -->

      <section
        class="lago-statbar"
      >

        <div
          class="lago-stat-card"
        >

          <div
            class="lago-stat-label"
          >
            💎 MEM ENERGY
          </div>

          <div
            class="lago-stat-value"
            id="modernEnergy"
          >
            0
          </div>

        </div>


        <div
          class="lago-stat-card"
        >

          <div
            class="lago-stat-label"
          >
            ⚡ CLICK POWER
          </div>

          <div
            class="lago-stat-value"
            id="modernPower"
          >
            1
          </div>

        </div>


        <div
          class="lago-stat-card"
        >

          <div
            class="lago-stat-label"
          >
            🤖 PER SECOND
          </div>

          <div
            class="lago-stat-value"
            id="modernAuto"
          >
            0
          </div>

        </div>


        <div
          class="lago-stat-card"
        >

          <div
            class="lago-stat-label"
          >
            🧠 BRAINROT
          </div>

          <div
            class="lago-stat-value"
            id="modernDays"
          >
            0
          </div>

        </div>

      </section>


      <!-- GAME -->

      <main
        class="lago-game-area"
      >

        <!-- LEFT -->

        <aside
          class="lago-side"
        >

          <div
            class="lago-side-card"
          >

            <div
              class="lago-side-title"
            >
              NEXT LEVEL
            </div>

            <div
              class="lago-side-big"
              id="modernXP"
            >
              0 XP
            </div>

            <div
              class="lago-progress"
            >
              <i
                id="modernProgress"
              ></i>
            </div>

          </div>


          <button
            class="lago-action"
            data-action="upgrade"
          >

            <div
              class="lago-action-icon"
            >
              ⚡
            </div>

            <div>

              <div
                class="lago-action-text"
              >
                UPGRADE
              </div>

              <div
                class="lago-action-sub"
              >
                Make Lago stupider
              </div>

            </div>

          </button>


          <button
            class="lago-action"
            data-action="steal"
          >

            <div
              class="lago-action-icon"
            >
              👾
            </div>

            <div>

              <div
                class="lago-action-text"
              >
                STEAL
              </div>

              <div
                class="lago-action-sub"
              >
                Do something illegal
              </div>

            </div>

          </button>

        </aside>


        <!-- CENTER -->

        <section
          class="lago-center"
        >

          <button
            id="lagoModernDaily"
          >
            🎁 DAILY DROP
          </button>


          <div
            class="lago-center-title"
          >
            LAGO
          </div>


          <div
            class="lago-center-sub"
          >
            THE DUMBEST SNAIL ON THE INTERNET
          </div>


          <div
            class="lago-modern-snail"
            id="modernSnailArea"
          ></div>


          <div
            class="lago-speech"
            id="modernSpeech"
          >
            I HAVE NO IDEA WHAT I'M DOING.
          </div>


          <button
            class="lago-play"
            id="modernPlay"
          >
            🐌 TAP LAGO
          </button>

        </section>


        <!-- RIGHT -->

        <aside
          class="lago-side"
        >

          <div
            class="lago-side-card"
          >

            <div
              class="lago-side-title"
            >
              YOUR LAGO
            </div>

            <div
              class="lago-side-big"
            >
              🐌
            </div>

            <div
              class="lago-side-desc"
            >
              Name it whatever you want.
              Nobody knows what Lago is.
            </div>

          </div>


          <button
            class="lago-action"
            data-action="create"
          >

            <div
              class="lago-action-icon"
            >
              🎨
            </div>

            <div>

              <div
                class="lago-action-text"
              >
                CREATE LAGO
              </div>

              <div
                class="lago-action-sub"
              >
                Make something stupid
              </div>

            </div>

          </button>


          <button
            class="lago-action"
            data-action="collection"
          >

            <div
              class="lago-action-icon"
            >
              🧩
            </div>

            <div>

              <div
                class="lago-action-text"
              >
                COLLECTION
              </div>

              <div
                class="lago-action-sub"
              >
                Your terrible creations
              </div>

            </div>

          </button>

        </aside>

      </main>


      <!-- BOTTOM -->

      <nav
        class="lago-bottom"
      >

        <button
          class="lago-bottom-btn active"
          data-page="play"
        >
          🏠<br>
          PLAY
        </button>

        <button
          class="lago-bottom-btn"
          data-page="create"
        >
          🎨<br>
          CREATE
        </button>

        <button
          class="lago-bottom-btn"
          data-page="collection"
        >
          🧩<br>
          COLLECTION
        </button>

        <button
          class="lago-bottom-btn"
          data-page="shop"
        >
          🛒<br>
          SHOP
        </button>

      </nav>

    `;


    document.body.appendChild(
      root
    );


    /*
     * Move the ORIGINAL snail
     * into our new center.
     */

    const snail =
      $("snail");


    const snailArea =
      $("modernSnailArea");


    if (
      snail &&
      snailArea
    ) {

      snailArea.appendChild(
        snail
      );

    }


    /*
 * Read the initial Tap Lago state
 * through the public game API.
 */

tapState =
  readTapState();


bind();

update(
  tapState
);

    bind();

    update();

  }


function bind() {

  /*
   * Main TAP.
   */

  $("modernPlay")
    ?.addEventListener(
      "click",
      () => {

        window.LAGO_TAP_GAME
          ?.tap
          ?.();

      }
    );


  /*
   * Daily.
   */

  $("lagoModernDaily")
    ?.addEventListener(
      "click",
      () => {

        window.LAGO_REWARDS
          ?.claim
          ?.();

      }
    );


  /*
   * Side actions.
   */

  document
    .querySelectorAll(
      "[data-action]"
    )
    .forEach(
      button => {

        button.addEventListener(
          "click",
          () => {

            const action =
              button.dataset.action;


            if (
              action ===
              "upgrade"
            ) {

              window.LAGO_TAP_GAME
                ?.openUpgrades
                ?.();

              return;

            }


            if (
              action ===
              "steal"
            ) {

              window.LAGO_TAP_GAME
                ?.steal
                ?.();

              return;

            }


            if (
              action ===
              "create"
            ) {

              window.LAGO_TAP_GAME
                ?.openCreator
                ?.();

              return;

            }


            if (
              action ===
              "collection"
            ) {

              window.LAGO_COLLECTION
                ?.show
                ?.();

            }

          }
        );

      }
    );


  /*
   * Navigation.
   */

  document
    .querySelectorAll(
      "[data-page]"
    )
    .forEach(
      button => {

        button.addEventListener(
          "click",
          () => {

            navigate(
              button.dataset.page
            );

          }
        );

      }
    );


  /*
   * Tap Lago publishes its own
   * state after every render.
   */

  document.addEventListener(
    "lago:tap-game-state",
    event => {

      tapState = {
        ...(tapState || {}),
        ...(event.detail || {})
      };

      update(
        tapState
      );

    }
  );


  /*
   * Account-level XP / level state.
   */

  document.addEventListener(
    "lago:state",
    () => {

      update();

    }
  );

}


  function navigate(
  page
) {

  document
    .querySelectorAll(
      "[data-page]"
    )
    .forEach(
      button => {

        button.classList.toggle(
          "active",
          button.dataset.page ===
          page
        );

      }
    );


  if (
    page === "play"
  ) {

    return;

  }


  if (
    page === "create"
  ) {

    window.LAGO_TAP_GAME
      ?.openCreator
      ?.();

    return;

  }


  if (
    page === "collection"
  ) {

    window.LAGO_COLLECTION
      ?.show
      ?.();

    return;

  }


  if (
    page === "shop"
  ) {

    window.LAGO_TAP_GAME
      ?.openUpgrades
      ?.();

  }

}

  function update(
  nextTapState = null
) {

  if (
    nextTapState &&
    typeof nextTapState === "object"
  ) {

    tapState = {
      ...(tapState || {}),
      ...nextTapState
    };

  }


  const game =
    tapState ||
    readTapState();


  tapState =
    game;


  $("modernEnergy")
    ?.replaceChildren(
      String(
        game.energy ?? 0
      )
    );


  $("modernPower")
    ?.replaceChildren(
      String(
        game.power ?? 1
      )
    );


  $("modernAuto")
    ?.replaceChildren(
      String(
        game.auto ?? 0
      )
    );


  $("modernDays")
    ?.replaceChildren(
      String(
        game.days ?? 0
      )
    );


  /*
   * Account-level progress.
   */

  let level = 1;
  let xp = 0;


  try {

    const account =
      window.LAGO
        ?.getState
        ?.();


    if (account) {

      level =
        account.level || 1;

      xp =
        account.xp || 0;

    }

  } catch (error) {

    console.warn(
      "[LAGO MODERN] Could not read account state:",
      error
    );

  }


  $("modernLevel")
    ?.replaceChildren(
      String(level)
    );


  $("modernXP")
    ?.replaceChildren(
      `${xp} XP`
    );


  const bar =
    $("modernProgress");


  if (bar) {

    bar.style.width =
      `${Math.min(
        100,
        xp % 100
      )}%`;

  }


  /*
   * Speech comes from Tap Lago state,
   * not from the legacy #cringe node.
   */

  if (
    game.speech &&
    $("modernSpeech")
  ) {

    $("modernSpeech")
      .textContent =
      String(game.speech)
        .trim()
        .toUpperCase();

  }

}
if (
  document.readyState === "loading"
) {

  document.addEventListener(
    "DOMContentLoaded",
    createUI,
    {
      once: true
    }
  );

} else {

  createUI();

}

})();

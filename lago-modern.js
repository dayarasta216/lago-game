(() => {

  "use strict";


  function $(id) {
    return document.getElementById(id);
  }


  function clickOld(id) {

    const el = $(id);

    if (el) {

      el.click();

    }

  }


  function getNumber(id) {

    const el = $(id);

    if (!el) return "0";

    return el.textContent || "0";

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
     * Move speech text.
     */

    const oldSpeech =
      $("cringe");


    const modernSpeech =
      $("modernSpeech");


    if (
      oldSpeech &&
      modernSpeech
    ) {

      modernSpeech.textContent =
        oldSpeech.textContent;

    }


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

          clickOld(
            "clickBtn"
          );

        }
      );


    /*
     * Daily.
     */

    $("lagoModernDaily")
      ?.addEventListener(
        "click",
        () => {

          if (
            window.LAGO_REWARDS
          ) {

            window.LAGO_REWARDS
              .claim();

          }

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

                clickOld(
                  "upgradeBtn"
                );

              }


              if (
                action ===
                "steal"
              ) {

                clickOld(
                  "stealBtn"
                );

              }


              if (
                action ===
                "create"
              ) {

                clickOld(
                  "createBtn"
                );

              }


              if (
                action ===
                "collection"
              ) {

                if (
                  window.LAGO_COLLECTION
                ) {

                  window.LAGO_COLLECTION
                    .show();

                }

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
     * Existing game state.
     */

    [
      "clickBtn",
      "upgradeBtn",
      "stealBtn"
    ]
      .forEach(
        id => {

          $(id)
            ?.addEventListener(
              "click",
              () => {

                setTimeout(
                  update,
                  20
                );

              }
            );

        }
      );


    /*
     * New bridge state.
     */

    document.addEventListener(
      "lago:state",
      update
    );


    /*
     * Keep UI synced.
     */

    setInterval(
      update,
      400
    );

  }


  function navigate(
    page
  ) {

    /*
     * Highlight buttons.
     */

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

      clickOld(
        "createBtn"
      );

      return;

    }


    if (
      page === "collection"
    ) {

      if (
        window.LAGO_COLLECTION
      ) {

        window.LAGO_COLLECTION
          .show();

      }

      return;

    }


    if (
      page === "shop"
    ) {

      clickOld(
        "upgradeBtn"
      );

      return;

    }

  }


  function update() {

    const energy =
      getNumber("energy");

    const power =
      getNumber("power");

    const auto =
      getNumber("auto");


    $("modernEnergy")
      ?.replaceChildren(
        energy
      );


    $("modernPower")
      ?.replaceChildren(
        power
      );


    $("modernAuto")
      ?.replaceChildren(
        auto
      );


    /*
     * Days / brainrot.
     */

    const days =
      $("days");


    if (days) {

      const match =
        days.textContent
          .match(
            /\d+/
          );


      if (match) {

        $("modernDays")
          .textContent =
          match[0];

      }

    }


    /*
     * Level.
     */

    let level = 1;


    if (
      window.LAGO &&
      window.LAGO.getState
    ) {

      const s =
        window.LAGO
          .getState();


      level =
        s.level || 1;


      $("modernXP")
        ?.replaceChildren(
          `${s.xp || 0} XP`
        );


      const xp =
        s.xp || 0;


      const percent =
        Math.min(
          100,
          xp % 100
        );


      const bar =
        $("modernProgress");


      if (bar) {

        bar.style.width =
          `${percent}%`;

      }

    }


    $("modernLevel")
      ?.replaceChildren(
        level
      );


    /*
     * Speech.
     */

    const oldSpeech =
      $("cringe");


    if (
      oldSpeech &&
      $("modernSpeech")
    ) {

      $("modernSpeech")
        .textContent =
        oldSpeech.textContent
          .trim()
          .toUpperCase();

    }

  }


  document.addEventListener(
    "DOMContentLoaded",
    () => {

      /*
       * Give existing scripts
       * time to initialise.
       */

      setTimeout(
        createUI,
        350
      );

    }
  );


})();

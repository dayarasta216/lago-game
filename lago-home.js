(() => {
  "use strict";

  const ID = "lagoHome2";

  function money(value) {
    value = Number(value) || 0;

    if (value >= 1000000)
      return (
        (value / 1000000)
          .toFixed(1)
          .replace(".0", "") +
        "M"
      );

    if (value >= 1000)
      return (
        (value / 1000)
          .toFixed(1)
          .replace(".0", "") +
        "K"
      );

    return Math.floor(value).toLocaleString();
  }


  function getGameValue(names) {

    for (const name of names) {

      if (
        typeof window[name] ===
        "number"
      ) {
        return window[name];
      }

    }

    return 0;
  }


  function create() {

    if (
      document.querySelector(
        "#" + ID
      )
    ) return;


    const home =
      document.createElement("div");

    home.id = ID;


    home.innerHTML = `

      <div class="lago-home-noise"></div>

      <header class="lago-home-header">

        <div class="lago-home-brand">
          LAGO
        </div>

        <div class="lago-home-profile">

          <div class="lago-home-avatar">
            🐌
          </div>

          <div class="lago-home-level">
            LEVEL <b id="lagoHomeLevel">1</b>
          </div>

        </div>

      </header>


      <section class="lago-home-stats">

        <div class="lago-home-stat">

          <div class="lago-home-stat-label">
            MEM ENERGY
          </div>

          <div
            class="lago-home-stat-value green"
            id="lagoHomeMem"
          >
            0
          </div>

        </div>


        <div class="lago-home-stat">

          <div class="lago-home-stat-label">
            XP
          </div>

          <div
            class="lago-home-stat-value"
            id="lagoHomeXP"
          >
            0
          </div>

        </div>

      </section>


      <main class="lago-home-character">

        <div class="lago-home-glow"></div>

        <div
          class="lago-home-snail"
          id="lagoHomeSnail"
        >

          <div
            class="lago-home-snail-placeholder"
          >
            🐌
          </div>

        </div>


        <button
          class="lago-home-play"
          id="lagoHomePlay"
        >
          PLAY LAGO
        </button>

      </main>


      <nav class="lago-home-nav">

        <button
          class="lago-home-nav-button active"
          data-page="home"
        >
          <span>🏠</span>
          HOME
        </button>

        <button
          class="lago-home-nav-button"
          data-page="create"
        >
          <span>🎨</span>
          CREATE
        </button>

        <button
          class="lago-home-nav-button"
          data-page="collection"
        >
          <span>🧩</span>
          COLLECTION
        </button>

        <button
          class="lago-home-nav-button"
          data-page="shop"
        >
          <span>🛍️</span>
          SHOP
        </button>

      </nav>

    `;


    document.body.appendChild(home);


    bind();

    updateStats();

  }


  function bind() {

    const play =
      document.querySelector(
        "#lagoHomePlay"
      );


    play?.addEventListener(
      "click",
      () => {

        hide();

        /*
          Return control to the
          existing game.
        */

        window.scrollTo({
          top: 0,
          behavior: "smooth"
        });

      }
    );


    document
      .querySelectorAll(
        ".lago-home-nav-button"
      )
      .forEach(button => {

        button.addEventListener(
          "click",
          () => {

            const page =
              button.dataset.page;

            document
              .querySelectorAll(
                ".lago-home-nav-button"
              )
              .forEach(
                b =>
                  b.classList.remove(
                    "active"
                  )
              );

            button.classList.add(
              "active"
            );


            if (
              page === "create" &&
              window.LAGO_CREATOR
            ) {

              window.LAGO_CREATOR.open?.();

              return;

            }


            if (
              page === "collection"
            ) {

              alert(
                "COLLECTION is coming next."
              );

              return;

            }


            if (
              page === "shop"
            ) {

              alert(
                "SHOP is coming next."
              );

              return;

            }

          }
        );

      });

  }


  function updateStats() {

    const mem =
      getGameValue([
        "mem",
        "MEM",
        "energy",
        "score",
        "coins"
      ]);


    const xp =
      getGameValue([
        "xp",
        "XP"
      ]);


    const level =
      getGameValue([
        "level",
        "LEVEL"
      ]);


    const memEl =
      document.querySelector(
        "#lagoHomeMem"
      );

    const xpEl =
      document.querySelector(
        "#lagoHomeXP"
      );

    const levelEl =
      document.querySelector(
        "#lagoHomeLevel"
      );


    if (memEl)
      memEl.textContent =
        money(mem);


    if (xpEl)
      xpEl.textContent =
        money(xp);


    if (levelEl)
      levelEl.textContent =
        level || 1;

  }


  function show() {

    create();

    const home =
      document.querySelector(
        "#" + ID
      );

    if (!home) return;

    updateStats();

    home.classList.add(
      "active"
    );

  }


  function hide() {

    const home =
      document.querySelector(
        "#" + ID
      );

    home?.classList.remove(
      "active"
    );

  }


  window.LAGO_HOME = {
    show,
    hide,
    updateStats
  };


  if (
    document.readyState ===
    "loading"
  ) {

    document.addEventListener(
      "DOMContentLoaded",
      () => {

        /*
          We DON'T automatically
          replace the current game yet.
        */

        create();

      }
    );

  } else {

    create();

  }
  /*
   * LAGO HOME START SCREEN
   */

  function startHome() {

    setTimeout(() => {

      if (
        window.LAGO_HOME &&
        typeof
          window.LAGO_HOME.show ===
          "function"
      ) {

        window.LAGO_HOME.show();

      }

    }, 800);

  }


  document.addEventListener(
    "DOMContentLoaded",
    startHome
  );
})();

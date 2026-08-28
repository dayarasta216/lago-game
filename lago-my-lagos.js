/* =========================================================
   LAGO — MY LAGOS
   ========================================================= */

(() => {

  "use strict";


  const STORAGE =
    "lago_forge_collection_v1";


  let root = null;


  function getCreations() {

    try {

      const data =
        JSON.parse(
          localStorage.getItem(
            STORAGE
          )
        );

      return Array.isArray(
        data?.creations
      )
        ? data.creations
        : [];

    } catch {

      return [];

    }

  }


  function saveCreations(
    creations
  ) {

    try {

      const data =
        JSON.parse(
          localStorage.getItem(
            STORAGE
          )
        ) || {};

      data.creations =
        creations;

      localStorage.setItem(
        STORAGE,
        JSON.stringify(data)
      );

    } catch {}

  }


  /* =========================================================
     CREATE
     ========================================================= */

  function create() {

    if (root)
      return;


    root =
      document.createElement(
        "div"
      );


    root.id =
      "lagoMyLagos";


    root.innerHTML = `

      <header
        class="lago-my-header"
      >

        <button
          class="lago-my-back"
          id="lagoMyBack"
        >
          ←
        </button>


        <div
          class="lago-my-title"
        >
          MY <span>LAGOS</span>
        </div>


        <div
          class="lago-my-count"
          id="lagoMyCount"
        >
          0 LAGOS
        </div>

      </header>


      <main
        class="lago-my-content"
      >

        <section
          class="lago-my-intro"
        >

          <strong>
            YOUR INTERNET'S WORST CREATIONS
          </strong>

          <p>
            Every stupid Lago you create
            belongs here. Mix anything.
            Name anything. Regret nothing.
          </p>

        </section>


        <div
          class="lago-my-grid"
          id="lagoMyGrid"
        ></div>

      </main>

    `;


    document.body.appendChild(
      root
    );


    root
      .querySelector(
        "#lagoMyBack"
      )
      .onclick =
      hide;


    root.addEventListener(
      "click",
      event => {

        if (
          event.target === root
        ) {

          hide();

        }

      }
    );

  }


  /* =========================================================
     OPEN
     ========================================================= */

  function show() {

    create();

    render();

    root.classList.add(
      "show"
    );

  }


  /* =========================================================
     CLOSE
     ========================================================= */

  function hide() {

    root?.classList.remove(
      "show"
    );

  }


  /* =========================================================
     RENDER
     ========================================================= */

  function render() {

    if (!root)
      return;


    const creations =
      getCreations();


    const grid =
      root.querySelector(
        "#lagoMyGrid"
      );


    const counter =
      root.querySelector(
        "#lagoMyCount"
      );


    if (counter) {

      counter.textContent =
        `${creations.length} LAGOS`;

    }


    if (!grid)
      return;


    if (!creations.length) {

      grid.innerHTML = `

        <div
          class="lago-my-empty"
          style="
            grid-column:1/-1;
          "
        >

          <div
            class="lago-my-empty-big"
          >
            🐌
          </div>


          <div
            class="lago-my-empty-title"
          >
            NOTHING STUPID YET
          </div>


          <div
            class="lago-my-empty-text"
          >
            Go to CREATE and make
            something the internet
            absolutely did not ask for.
          </div>


          <button
            class="lago-my-create"
            id="lagoMyCreate"
          >
            🎨 CREATE LAGO
          </button>

        </div>

      `;


      root
        .querySelector(
          "#lagoMyCreate"
        )
        ?.addEventListener(
          "click",
          () => {

            hide();

            window.LAGO_FORGE
              ?.open();

          }
        );


      return;

    }


    grid.innerHTML =
      creations
        .map(
          creation =>
            card(
              creation
            )
        )
        .join("");


    grid
      .querySelectorAll(
        "[data-lago-use]"
      )
      .forEach(
        button => {

          button.onclick =
            () => {

              const id =
                Number(
                  button.dataset
                    .lagoUse
                );


              const creation =
                creations.find(
                  item =>
                    item.id === id
                );


              if (!creation)
                return;


              openCreation(
                creation
              );

            };

        }
      );


    grid
      .querySelectorAll(
        "[data-lago-delete]"
      )
      .forEach(
        button => {

          button.onclick =
            () => {

              const id =
                Number(
                  button.dataset
                    .lagoDelete
                );


              deleteCreation(
                id
              );

            };

        }
      );

  }


  /* =========================================================
     CARD
     ========================================================= */

  function card(
    creation
  ) {

    const name =
      escapeHtml(
        creation.name ||
        "UNKNOWN LAGO"
      );


    const rarity =
      escapeHtml(
        creation.rarity ||
        "COMMON"
      );


    const stupidity =
      Math.min(
        10,
        Math.max(
          1,
          Math.round(
            Number(
              creation.stupidity ||
              1
            ) / 3
          )
        )
      );


    const emoji =
      getPreviewEmoji(
        creation
      );


    return `

      <article
        class="lago-my-card"
      >

        <div
          class="lago-my-visual"
        >

          <div
            class="lago-my-emoji"
          >
            ${emoji}
          </div>

        </div>


        <div
          class="lago-my-info"
        >

          <div
            class="lago-my-name"
            title="${name}"
          >
            ${name}
          </div>


          <div
            class="lago-my-meta"
          >

            <span
              class="lago-my-rarity"
            >
              ${rarity}
            </span>


            <span
              class="lago-my-stupid"
            >
              STUPIDITY ${stupidity}/10
            </span>

          </div>


          <div
            class="lago-my-actions"
          >

            <button
              class="lago-my-use"
              data-lago-use="${creation.id}"
            >
              ✏️ EDIT / USE
            </button>


            <button
              class="lago-my-delete"
              data-lago-delete="${creation.id}"
              title="Delete"
            >
              🗑
            </button>

          </div>

        </div>

      </article>

    `;

  }


  /* =========================================================
     TEMP PREVIEW
     ========================================================= */

  function getPreviewEmoji(
    creation
  ) {

    const parts =
      creation.parts ||
      {};


    /*
     * Until we receive the
     * final Lago artwork,
     * we generate a dumb
     * visual from the chosen
     * components.
     *
     * This will later be replaced
     * by real layered PNG/SVG.
     */

    const bodyMap = {

      frog: "🐸",
      shark: "🦈",
      duck: "🦆",
      alien: "👽",
      toilet: "🚽",
      moai: "🗿",
      worm: "🪱"

    };


    const shellMap = {

      bitcoin: "₿",
      diamond: "💎",
      brain: "🧠",
      pizza: "🍕",
      fire: "🔥",
      planet: "🪐"

    };


    const chaosMap = {

      fire: "🔥",
      money: "💸",
      lightning: "⚡",
      explosion: "💥",
      brain: "🧠",
      radioactive: "☢️"

    };


    if (
      parts.body &&
      bodyMap[
        parts.body
      ]
    ) {

      return bodyMap[
        parts.body
      ];

    }


    if (
      parts.shell &&
      shellMap[
        parts.shell
      ]
    ) {

      return (
        "🐌" +
        shellMap[
          parts.shell
        ]
      );

    }


    if (
      parts.chaos &&
      chaosMap[
        parts.chaos
      ]
    ) {

      return (
        "🐌" +
        chaosMap[
          parts.chaos
        ]
      );

    }


    return "🐌";

  }


  /* =========================================================
     EDIT
     ========================================================= */

  function openCreation(
    creation
  ) {

    hide();


    if (
      !window.LAGO_FORGE
    ) {

      return;

    }


    window.LAGO_FORGE.open();


    setTimeout(
      () => {

        /*
         * The current Forge exposes
         * getCurrent but not a
         * loader yet.
         *
         * We send the creation
         * through a public event.
         */

        document.dispatchEvent(
          new CustomEvent(
            "lago:load-creation",
            {
              detail:
                creation
            }
          )
        );

      },
      100
    );

  }


  /* =========================================================
     DELETE
     ========================================================= */

  function deleteCreation(
    id
  ) {

    const creations =
      getCreations();


    const filtered =
      creations.filter(
        creation =>
          creation.id !== id
      );


    saveCreations(
      filtered
    );


    render();

  }


  /* =========================================================
     ESCAPE
     ========================================================= */

  function escapeHtml(
    value
  ) {

    return String(
      value
    )
      .replace(
        /&/g,
        "&amp;"
      )
      .replace(
        /</g,
        "&lt;"
      )
      .replace(
        />/g,
        "&gt;"
      )
      .replace(
        /"/g,
        "&quot;"
      )
      .replace(
        /'/g,
        "&#039;"
      );

  }


  /* =========================================================
     PUBLIC API
     ========================================================= */

  window.LAGO_MY_LAGOS = {

    show,

    hide,

    render,

    get:
      getCreations

  };


  document.addEventListener(
    "DOMContentLoaded",
    () => {

      create();

    }
  );


})();

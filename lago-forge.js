/* =========================================================
   LAGO FORGE
   User generated stupid snail system
   ========================================================= */

(() => {

  "use strict";


  const SAVE_KEY =
    "lago_forge_collection_v1";


  const CATEGORIES = {

    body: {
      label: "BODY",
      items: [
        ["normal", "🐌", "CLASSIC", "COMMON"],
        ["frog", "🐸", "FROG", "RARE"],
        ["shark", "🦈", "SHARK", "EPIC"],
        ["duck", "🦆", "DUCK", "RARE"],
        ["alien", "👽", "ALIEN", "LEGENDARY"],
        ["toilet", "🚽", "TOILET", "MYTHIC"],
        ["moai", "🗿", "MOAI", "EPIC"],
        ["worm", "🪱", "WORM", "SECRET"]
      ]
    },


    shell: {
      label: "SHELL",
      items: [
        ["classic", "🐚", "CLASSIC", "COMMON"],
        ["bitcoin", "₿", "BITCOIN", "LEGENDARY"],
        ["diamond", "💎", "DIAMOND", "EPIC"],
        ["brain", "🧠", "BRAIN", "MYTHIC"],
        ["pizza", "🍕", "PIZZA", "RARE"],
        ["fire", "🔥", "FIRE", "EPIC"],
        ["planet", "🪐", "PLANET", "LEGENDARY"],
        ["nothing", "❌", "NO SHELL", "SECRET"]
      ]
    },


    face: {
      label: "FACE",
      items: [
        ["normal", "👀", "NORMAL", "COMMON"],
        ["sus", "😳", "SUS", "RARE"],
        ["stupid", "🤪", "STUPID", "EPIC"],
        ["dead", "💀", "DEAD", "RARE"],
        ["money", "🤑", "MONEY", "LEGENDARY"],
        ["cry", "😭", "CRYING", "EPIC"],
        ["sigma", "😐", "SIGMA", "MYTHIC"],
        ["void", "⬛", "VOID", "SECRET"]
      ]
    },


    hat: {
      label: "HAT",
      items: [
        ["none", "🚫", "NOTHING", "COMMON"],
        ["cap", "🧢", "CAP", "RARE"],
        ["crown", "👑", "CROWN", "LEGENDARY"],
        ["cowboy", "🤠", "COWBOY", "EPIC"],
        ["wizard", "🧙", "WIZARD", "MYTHIC"],
        ["banana", "🍌", "BANANA", "RARE"],
        ["traffic", "🚧", "TRAFFIC CONE", "EPIC"],
        ["toilet", "🚽", "TOILET HAT", "SECRET"]
      ]
    },


    chaos: {
      label: "CHAOS",
      items: [
        ["none", "✨", "NOTHING", "COMMON"],
        ["sparkles", "✨", "SPARKLES", "RARE"],
        ["fire", "🔥", "ON FIRE", "EPIC"],
        ["money", "💸", "MONEY RAIN", "LEGENDARY"],
        ["lightning", "⚡", "LIGHTNING", "EPIC"],
        ["explosion", "💥", "EXPLOSION", "MYTHIC"],
        ["brain", "🧠", "BRAINROT", "LEGENDARY"],
        ["radioactive", "☢️", "RADIOACTIVE", "SECRET"]
      ]
    }

  };


  const NAME_WORDS = {

    first: [
      "GIGA",
      "STUPID",
      "FAT",
      "BROKE",
      "SUS",
      "UNEMPLOYED",
      "CRYPTO",
      "WET",
      "ANGRY",
      "DEAD",
      "RICH",
      "FORGOTTEN",
      "ILLEGAL",
      "TOXIC",
      "HOMELESS",
      "SIGMA"
    ],

    second: [
      "FROG",
      "SNAIL",
      "LAGO",
      "TAX",
      "MACHINE",
      "GOBLIN",
      "CEO",
      "TRADER",
      "BOSS",
      "WIZARD",
      "PIZZA",
      "MONSTER",
      "INFLUENCER",
      "BANKER",
      "TOILET"
    ],

    ending: [
      "3000",
      "9000",
      "PRO MAX",
      "DELUXE",
      "ULTRA",
      "SUPREME",
      "XL",
      "420",
      "69",
      "FINAL BOSS",
      "THE THIRD",
      "GOLD EDITION"
    ]

  };


  let state =
    loadCollection();


  let current = {

    body: "normal",
    shell: "classic",
    face: "normal",
    hat: "none",
    chaos: "none",

    name: "CLASSIC LAGO"

  };


  let active =
    "body";


  /* =========================================================
     STORAGE
     ========================================================= */

  function loadCollection() {

    try {

      const saved =
        JSON.parse(
          localStorage.getItem(
            SAVE_KEY
          )
        );

      return {

        skins:
          Array.isArray(saved?.skins)
            ? saved.skins
            : [],

        creations:
          Array.isArray(saved?.creations)
            ? saved.creations
            : []

      };

    } catch {

      return {
        skins: [],
        creations: []
      };

    }

  }


  function saveCollection() {

    localStorage.setItem(
      SAVE_KEY,
      JSON.stringify(state)
    );

  }


  /* =========================================================
     HELPERS
     ========================================================= */

  function random(arr) {

    return arr[
      Math.floor(
        Math.random() *
        arr.length
      )
    ];

  }


  function findItem(
    category,
    id
  ) {

    return CATEGORIES[
      category
    ]?.items.find(
      x => x[0] === id
    );

  }


  function rarityScore() {

    const points = {

      COMMON: 1,
      RARE: 2,
      EPIC: 3,
      LEGENDARY: 4,
      MYTHIC: 5,
      SECRET: 6

    };


    return Object.keys(
      CATEGORIES
    )
      .map(
        category =>
          findItem(
            category,
            current[category]
          )
      )
      .reduce(
        (sum, item) =>
          sum +
          (points[item?.[3]] || 1),
        0
      );

  }


  function rarity() {

    const score =
      rarityScore();


    if (score >= 27)
      return "SECRET";


    if (score >= 23)
      return "MYTHIC";


    if (score >= 18)
      return "LEGENDARY";


    if (score >= 13)
      return "EPIC";


    if (score >= 8)
      return "RARE";


    return "COMMON";

  }


  /* =========================================================
     NAME GENERATOR
     ========================================================= */

  function generateName() {

    return (

      random(
        NAME_WORDS.first
      ) +

      " " +

      random(
        NAME_WORDS.second
      ) +

      " " +

      random(
        NAME_WORDS.ending
      )

    );

  }


  /* =========================================================
     OPEN
     ========================================================= */

  function openForge() {

    let root =
      document.getElementById(
        "lagoForge"
      );


    if (!root) {

      createForge();

      root =
        document.getElementById(
          "lagoForge"
        );

    }


    root.classList.add(
      "show"
    );


    render();

  }


  function closeForge() {

    document
      .getElementById(
        "lagoForge"
      )
      ?.classList.remove(
        "show"
      );

  }


  /* =========================================================
     CREATE UI
     ========================================================= */

  function createForge() {

    const root =
      document.createElement(
        "div"
      );


    root.id =
      "lagoForge";


    root.innerHTML = `

      <div class="lago-forge-window">

        <section
          class="lago-forge-preview"
        >

          <div
            class="lago-forge-preview-label"
          >
            YOUR LAGO
          </div>


          <div
            class="lago-forge-stage"
            id="lagoForgeStage"
          >

            <img
              id="lagoForgeBase"
              alt="LAGO"
            >

          </div>


          <div
            class="lago-forge-name"
            id="lagoForgeName"
          >
            CLASSIC LAGO
          </div>


          <div
            class="lago-forge-rarity"
            id="lagoForgeRarity"
          >
            COMMON
          </div>


          <div
            class="lago-forge-stupid"
            id="lagoForgeStupid"
          >
            STUPIDITY: 1/10
          </div>

        </section>


        <section
          class="lago-forge-controls"
        >

          <header
            class="lago-forge-header"
          >

            <h2
              class="lago-forge-title"
            >
              LAGO <span>FORGE</span>
            </h2>


            <button
              class="lago-forge-close"
              id="lagoForgeClose"
            >
              ×
            </button>

          </header>


          <input
            class="lago-forge-name-input"
            id="lagoForgeNameInput"
            maxlength="32"
            placeholder="NAME YOUR STUPID LAGO..."
          >


          <nav
            class="lago-forge-tabs"
            id="lagoForgeTabs"
          ></nav>


          <div
            class="lago-forge-items"
          >

            <div
              class="lago-forge-grid"
              id="lagoForgeGrid"
            ></div>

          </div>


          <div
            class="lago-forge-chaos"
          >

            <button
              class="random"
              id="lagoForgeRandom"
            >
              🎲 MAKE IT STUPID
            </button>


            <button
              class="save"
              id="lagoForgeSave"
            >
              💾 SAVE MY LAGO
            </button>

          </div>

        </section>

      </div>

    `;


    document.body.appendChild(
      root
    );


    root
      .querySelector(
        "#lagoForgeClose"
      )
      .onclick =
      closeForge;


    root
      .querySelector(
        "#lagoForgeRandom"
      )
      .onclick =
      randomize;


    root
      .querySelector(
        "#lagoForgeSave"
      )
      .onclick =
      saveCreation;


    root
      .querySelector(
        "#lagoForgeNameInput"
      )
      .addEventListener(
        "input",
        event => {

          current.name =
            event.target.value
              .trim()
              .slice(0,32)
              .toUpperCase() ||
            generateName();

          renderPreview();

        }
      );


    root.addEventListener(
      "click",
      event => {

        if (
          event.target === root
        ) {

          closeForge();

        }

      }
    );

  }


  /* =========================================================
     TABS
     ========================================================= */

  function renderTabs() {

    const tabs =
      document.getElementById(
        "lagoForgeTabs"
      );


    if (!tabs)
      return;


    tabs.innerHTML =
      Object.keys(
        CATEGORIES
      )
      .map(
        category => `

          <button
            class="
              lago-forge-tab
              ${
                category === active
                  ? "active"
                  : ""
              }
            "
            data-forge-category="${category}"
          >
            ${
              CATEGORIES[
                category
              ].label
            }
          </button>

        `
      )
      .join("");


    tabs
      .querySelectorAll(
        "[data-forge-category]"
      )
      .forEach(
        button => {

          button.onclick =
            () => {

              active =
                button.dataset
                  .forgeCategory;

              render();

            };

        }
      );

  }


  /* =========================================================
     ITEMS
     ========================================================= */

  function renderItems() {

    const grid =
      document.getElementById(
        "lagoForgeGrid"
      );


    if (!grid)
      return;


    const items =
      CATEGORIES[
        active
      ].items;


    grid.innerHTML =
      items
      .map(
        item => {

          const selected =
            current[
              active
            ] === item[0];


          return `

            <button
              class="
                lago-forge-item
                ${
                  selected
                    ? "selected"
                    : ""
                }
              "
              data-forge-item="${item[0]}"
            >

              <div
                class="lago-forge-item-icon"
              >
                ${item[1]}
              </div>


              <div
                class="lago-forge-item-name"
              >
                ${item[2]}
              </div>


              <div
                class="lago-forge-item-rarity"
              >
                ${item[3]}
              </div>

            </button>

          `;

        }
      )
      .join("");


    grid
      .querySelectorAll(
        "[data-forge-item]"
      )
      .forEach(
        button => {

          button.onclick =
            () => {

              current[
                active
              ] =
                button.dataset
                  .forgeItem;

              render();

              bump();

            };

        }
      );

  }


  /* =========================================================
     PREVIEW
     ========================================================= */

  function renderPreview() {

    const base =
      document.getElementById(
        "lagoForgeBase"
      );


    const original =
      document.getElementById(
        "snail"
      );


    if (
      base &&
      original &&
      original.src
    ) {

      base.src =
        original.src;

    }


    const name =
      document.getElementById(
        "lagoForgeName"
      );


    const rarityElement =
      document.getElementById(
        "lagoForgeRarity"
      );


    const stupidity =
      document.getElementById(
        "lagoForgeStupid"
      );


    if (name) {

      name.textContent =
        current.name ||
        "CLASSIC LAGO";

    }


    if (rarityElement) {

      rarityElement.textContent =
        rarity();

    }


    if (stupidity) {

      const score =
        Math.min(
          10,
          Math.max(
            1,
            Math.round(
              rarityScore() /
              3
            )
          )
        );


      stupidity.textContent =
        `STUPIDITY: ${score}/10`;

    }


    const input =
      document.getElementById(
        "lagoForgeNameInput"
      );


    if (
      input &&
      document.activeElement !== input
    ) {

      input.value =
        current.name ===
        "CLASSIC LAGO"
          ? ""
          : current.name;

    }

  }


  /* =========================================================
     RANDOM
     ========================================================= */

  function randomize() {

    Object.keys(
      CATEGORIES
    )
    .forEach(
      category => {

        current[
          category
        ] =
          random(
            CATEGORIES[
              category
            ].items
          )[0];

      }
    );


    current.name =
      generateName();


    render();


    bump();


    toast(
      "THE INTERNET HAS CREATED SOMETHING WORSE 🐌"
    );

  }


  /* =========================================================
     SAVE
     ========================================================= */

  function saveCreation() {

    const creation = {

      id:
        Date.now(),

      name:
        current.name ||
        generateName(),

      parts: {
        ...current
      },

      rarity:
        rarity(),

      stupidity:
        rarityScore(),

      created:
        new Date()
          .toISOString()

    };


    state.creations.unshift(
      creation
    );


    /*
     * Keep collection reasonable.
     */

    state.creations =
      state.creations.slice(
        0,
        100
      );


    saveCollection();


    toast(
      "LAGO SAVED. IT SHOULD NOT EXIST."
    );


    bump();


    setTimeout(
      closeForge,
      500
    );

  }


  /* =========================================================
     ANIMATION
     ========================================================= */

  function bump() {

    const base =
      document.getElementById(
        "lagoForgeBase"
      );


    if (!base)
      return;


    base.classList.remove(
      "bounce"
    );


    void base.offsetWidth;


    base.classList.add(
      "bounce"
    );

  }


  /* =========================================================
     TOAST
     ========================================================= */

  function toast(
    text
  ) {

    let element =
      document.getElementById(
        "lagoForgeToast"
      );


    if (!element) {

      element =
        document.createElement(
          "div"
        );


      element.id =
        "lagoForgeToast";


      element.style.cssText = `

        position:fixed;
        z-index:15000;

        left:50%;
        bottom:25px;

        transform:
          translateX(-50%);

        padding:
          12px 18px;

        border-radius:
          999px;

        background:
          #ccff00;

        color:
          #090009;

        font:
          1000 10px
          Inter,
          system-ui;

        box-shadow:
          0 15px 40px
          rgba(0,0,0,.45);

        pointer-events:none;

      `;


      document.body.appendChild(
        element
      );

    }


    element.textContent =
      text;


    element.style.display =
      "block";


    clearTimeout(
      element._timer
    );


    element._timer =
      setTimeout(
        () => {

          element.style.display =
            "none";

        },
        1800
      );

  }


  /* =========================================================
     RENDER
     ========================================================= */

  function render() {

    renderTabs();

    renderItems();

    renderPreview();

  }


  /* =========================================================
     CREATE BUTTON BRIDGE
     ========================================================= */

  function installBridge() {

    const create =
      document.getElementById(
        "createBtn"
      );


    if (!create)
      return;


    /*
     * We intentionally replace
     * the old Creator action.
     */

    create.onclick =
      event => {

        event.preventDefault();

        openForge();

      };

  }


  /* =========================================================
     START
     ========================================================= */

  document.addEventListener(
    "DOMContentLoaded",
    () => {

      setTimeout(
        installBridge,
        500
      );

    }
  );


  /*
   * Also catch the new
   * modern interface.
   */

  document.addEventListener(
    "click",
    event => {

      const button =
        event.target.closest(
          '[data-action="create"]'
        );


      if (button) {

        event.preventDefault();

        openForge();

      }

    }
  );


  /*
   * Public API for later.
   */

  window.LAGO_FORGE = {

    open:
      openForge,

    close:
      closeForge,

    getCollection:
      () => state.creations,

    getCurrent:
      () => ({
        ...current
      })

  };


})();

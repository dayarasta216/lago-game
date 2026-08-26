/* =========================================================
   LAGO CREATOR
   Character customization system
   ========================================================= */

(() => {

  "use strict";


  const STORAGE_KEY =
    "lago_character_v1";


  /* =======================================================
     ITEM DATABASE
     ======================================================= */

  const ITEMS = {

    shell: [

      {
        id: "shell_default",
        name: "Classic",
        rarity: "common",
        src: null
      },

      {
        id: "shell_gold",
        name: "Gold",
        rarity: "rare",
        src: null
      },

      {
        id: "shell_void",
        name: "Void",
        rarity: "epic",
        src: null
      },

      {
        id: "shell_cosmic",
        name: "Cosmic",
        rarity: "legendary",
        src: null
      },

      {
        id: "shell_brainrot",
        name: "Brainrot",
        rarity: "mythic",
        src: null
      },

      {
        id: "shell_secret",
        name: "???",
        rarity: "secret",
        src: null
      }

    ],


    eyes: [

      {
        id: "eyes_default",
        name: "Normal",
        rarity: "common",
        src: null
      },

      {
        id: "eyes_cool",
        name: "Cool",
        rarity: "rare",
        src: null
      },

      {
        id: "eyes_laser",
        name: "Laser",
        rarity: "epic",
        src: null
      },

      {
        id: "eyes_cosmic",
        name: "Cosmic",
        rarity: "legendary",
        src: null
      },

      {
        id: "eyes_brain",
        name: "Brainrot",
        rarity: "mythic",
        src: null
      }

    ],


    mouth: [

      {
        id: "mouth_default",
        name: "Classic",
        rarity: "common",
        src: null
      },

      {
        id: "mouth_smile",
        name: "Smile",
        rarity: "rare",
        src: null
      },

      {
        id: "mouth_gold",
        name: "Gold Teeth",
        rarity: "epic",
        src: null
      },

      {
        id: "mouth_fire",
        name: "Fire",
        rarity: "legendary",
        src: null
      }

    ],


    hat: [

      {
        id: "hat_none",
        name: "None",
        rarity: "common",
        src: null
      },

      {
        id: "hat_cap",
        name: "Cap",
        rarity: "rare",
        src: null
      },

      {
        id: "hat_crown",
        name: "Crown",
        rarity: "legendary",
        src: null
      },

      {
        id: "hat_brain",
        name: "Brain",
        rarity: "mythic",
        src: null
      }

    ],


    accessory: [

      {
        id: "accessory_none",
        name: "None",
        rarity: "common",
        src: null
      },

      {
        id: "accessory_chain",
        name: "Chain",
        rarity: "rare",
        src: null
      },

      {
        id: "accessory_sword",
        name: "Sword",
        rarity: "epic",
        src: null
      },

      {
        id: "accessory_aura",
        name: "Aura",
        rarity: "legendary",
        src: null
      }

    ],


    effect: [

      {
        id: "effect_none",
        name: "None",
        rarity: "common",
        src: null
      },

      {
        id: "effect_spark",
        name: "Spark",
        rarity: "rare",
        src: null
      },

      {
        id: "effect_fire",
        name: "Fire",
        rarity: "epic",
        src: null
      },

      {
        id: "effect_cosmic",
        name: "Cosmic",
        rarity: "legendary",
        src: null
      }

    ]

  };


  const CATEGORIES = [

    ["shell", "SHELL"],

    ["eyes", "EYES"],

    ["mouth", "MOUTH"],

    ["hat", "HAT"],

    ["accessory", "ACCESSORY"],

    ["effect", "EFFECT"]

  ];


  /* =======================================================
     STATE
     ======================================================= */

  const defaultCharacter = {

    shell: "shell_default",

    eyes: "eyes_default",

    mouth: "mouth_default",

    hat: "hat_none",

    accessory: "accessory_none",

    effect: "effect_none"

  };


  let character = loadCharacter();


  let activeCategory =
    "shell";


  /* =======================================================
     STORAGE
     ======================================================= */

  function loadCharacter() {

    try {

      const saved =
        JSON.parse(
          localStorage.getItem(
            STORAGE_KEY
          )
        );


      return {
        ...defaultCharacter,
        ...(saved || {})
      };

    } catch {

      return {
        ...defaultCharacter
      };

    }

  }


  function saveCharacter() {

    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(character)
    );

  }


  /* =======================================================
     HELPERS
     ======================================================= */

  function getItem(
    category,
    id
  ) {

    return (
      ITEMS[category] || []
    ).find(
      item =>
        item.id === id
    );

  }


  function getRarityLabel(
    rarity
  ) {

    return String(
      rarity
    ).toUpperCase();

  }


  /* =======================================================
     CREATOR OPEN
     ======================================================= */

  function openCreator() {

    let overlay =
      document.querySelector(
        "#lagoCreator"
      );


    if (!overlay) {

      createCreator();

      overlay =
        document.querySelector(
          "#lagoCreator"
        );

    }


    renderCreator();

    overlay.classList.add(
      "show"
    );

  }


  function closeCreator() {

    const overlay =
      document.querySelector(
        "#lagoCreator"
      );


    if (overlay) {

      overlay.classList.remove(
        "show"
      );

    }

  }


  /* =======================================================
     CREATE UI
     ======================================================= */

  function createCreator() {

    const overlay =
      document.createElement(
        "div"
      );


    overlay.id =
      "lagoCreator";


    overlay.className =
      "lago-creator-overlay";


    overlay.innerHTML = `

      <div class="lago-creator">


        <section
          class="lago-creator-preview"
        >

          <div
            class="lago-creator-preview-title"
          >
            YOUR LAGO
          </div>


          <div
            class="lago-creator-stage"
            id="lagoCreatorStage"
          >

            <img
              id="lagoCreatorBase"
              class="lago-creator-base"
              alt="LAGO"
            >

          </div>


          <div
            id="lagoCreatorName"
            class="lago-creator-name"
          >
            CLASSIC LAGO
          </div>


          <div
            id="lagoCreatorRarity"
            class="lago-creator-rarity"
          >
            COMMON
          </div>

        </section>


        <section
          class="lago-creator-controls"
        >


          <header
            class="lago-creator-header"
          >

            <h2>
              CREATE
            </h2>

            <button
              class="lago-creator-close"
              id="lagoCreatorClose"
            >
              ×
            </button>

          </header>


          <nav
            class="lago-creator-tabs"
            id="lagoCreatorTabs"
          ></nav>


          <div
            class="lago-creator-items"
          >

            <div
              id="lagoCreatorGrid"
              class="lago-creator-grid"
            ></div>

          </div>


          <footer
            class="lago-creator-footer"
          >

            <button
              class="lago-creator-action"
              id="lagoRandomLago"
            >
              🎲 RANDOM
            </button>

            <button
              class="lago-creator-action primary"
              id="lagoSaveLago"
            >
              SAVE LAGO
            </button>

          </footer>


        </section>

      </div>

    `;


    document.body.appendChild(
      overlay
    );


    document
      .querySelector(
        "#lagoCreatorClose"
      )
      .addEventListener(
        "click",
        closeCreator
      );


    overlay.addEventListener(
      "click",
      event => {

        if (
          event.target ===
          overlay
        ) {

          closeCreator();

        }

      }
    );


    document
      .querySelector(
        "#lagoRandomLago"
      )
      .addEventListener(
        "click",
        randomize
      );


    document
      .querySelector(
        "#lagoSaveLago"
      )
      .addEventListener(
        "click",
        () => {

          saveCharacter();

          showToast(
            "LAGO SAVED 🐌"
          );

          closeCreator();

        }
      );


    renderTabs();

  }


  /* =======================================================
     TABS
     ======================================================= */

  function renderTabs() {

    const tabs =
      document.querySelector(
        "#lagoCreatorTabs"
      );


    if (!tabs)
      return;


    tabs.innerHTML =
      CATEGORIES
        .map(
          ([id, label]) => `

            <button
              class="
                lago-creator-tab
                ${id === activeCategory
                  ? "active"
                  : ""}
              "
              data-category="${id}"
            >
              ${label}
            </button>

          `
        )
        .join("");


    tabs
      .querySelectorAll(
        ".lago-creator-tab"
      )
      .forEach(button => {

        button.addEventListener(
          "click",
          () => {

            activeCategory =
              button.dataset.category;

            renderCreator();

          }
        );

      });

  }


  /* =======================================================
     ITEMS
     ======================================================= */

  function renderItems() {

    const grid =
      document.querySelector(
        "#lagoCreatorGrid"
      );


    if (!grid)
      return;


    const items =
      ITEMS[activeCategory] || [];


    grid.innerHTML =
      items
        .map(item => {

          const selected =
            character[
              activeCategory
            ] === item.id;


          const rarity =
            item.rarity;


          return `

            <button
              class="
                lago-item
                rarity-${rarity}
                ${selected
                  ? "selected"
                  : ""}
              "
              data-item-id="${item.id}"
            >

              <div
                class="lago-item-preview"
              >

                ${
                  item.src

                  ? `
                    <img
                      src="${item.src}"
                      class="lago-item-preview"
                      alt=""
                    >
                  `

                  : `
                    <span
                      style="
                        font-size:38px;
                        opacity:.65;
                      "
                    >
                      ${
                        categoryEmoji(
                          activeCategory
                        )
                      }
                    </span>
                  `
                }

              </div>


              <div
                class="lago-item-name"
              >
                ${item.name}
              </div>


              <div
                class="lago-item-rarity"
              >
                ${getRarityLabel(
                  rarity
                )}
              </div>

            </button>

          `;

        })
        .join("");


    grid
      .querySelectorAll(
        ".lago-item"
      )
      .forEach(button => {

        button.addEventListener(
          "click",
          () => {

            character[
              activeCategory
            ] =
              button.dataset.itemId;


            renderCreator();

          }
        );

      });

  }


  function categoryEmoji(
    category
  ) {

    const icons = {

      shell: "🐚",

      eyes: "👀",

      mouth: "😈",

      hat: "🧢",

      accessory: "💎",

      effect: "✨"

    };


    return icons[
      category
    ] || "🐌";

  }


  /* =======================================================
     PREVIEW
     ======================================================= */

  function renderPreview() {

    const base =
      document.querySelector(
        "#lagoCreatorBase"
      );


    if (!base)
      return;


    const original =
      document.querySelector(
        "#snail"
      );


    if (
      original &&
      original.src
    ) {

      base.src =
        original.src;

    }


    const stage =
      document.querySelector(
        "#lagoCreatorStage"
      );


    if (!stage)
      return;


    stage
      .querySelectorAll(
        ".lago-layer"
      )
      .forEach(
        element =>
          element.remove()
      );


    /*
      Real skin images will be added
      here later.

      Every category gets its own
      transparent layer.
    */


    const rarity =
      calculateRarity();


    const name =
      buildName();


    const nameElement =
      document.querySelector(
        "#lagoCreatorName"
      );


    const rarityElement =
      document.querySelector(
        "#lagoCreatorRarity"
      );


    if (nameElement)
      nameElement.textContent =
        name;


    if (rarityElement) {

      rarityElement.textContent =
        rarity
          .toUpperCase();

    }

  }


  /* =======================================================
     RARITY
     ======================================================= */

  function calculateRarity() {

    const values =
      Object.values(
        character
      );


    const selected =
      values
        .map(
          (id, index) => {

            const category =
              Object.keys(
                character
              )[index];


            return getItem(
              category,
              id
            );

          }
        )
        .filter(Boolean);


    const score =
      selected.reduce(
        (
          total,
          item
        ) => {

          const points = {

            common: 1,

            rare: 2,

            epic: 3,

            legendary: 4,

            mythic: 5,

            secret: 6

          };


          return total +
            (
              points[
                item.rarity
              ] || 1
            );

        },

        0
      );


    if (score >= 28)
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


  /* =======================================================
     NAME
     ======================================================= */

  function buildName() {

    const prefixes = {

      common: "CLASSIC",

      rare: "RARE",

      epic: "EPIC",

      legendary: "LEGENDARY",

      mythic: "MYTHIC",

      secret: "SECRET"

    };


    const rarity =
      calculateRarity()
        .toLowerCase();


    const prefix =
      prefixes[
        rarity
      ] || "CLASSIC";


    return `${prefix} LAGO`;

  }


  /* =======================================================
     RANDOM
     ======================================================= */

  function randomize() {

    Object.keys(
      character
    )
    .forEach(
      category => {

        const items =
          ITEMS[
            category
          ] || [];


        if (!items.length)
          return;


        const item =
          items[
            Math.floor(
              Math.random() *
              items.length
            )
          ];


        character[
          category
        ] =
          item.id;

      }
    );


    renderCreator();

    showToast(
      "RANDOM LAGO GENERATED 🐌"
    );

  }


  /* =======================================================
     RENDER
     ======================================================= */

  function renderCreator() {

    renderTabs();

    renderItems();

    renderPreview();

  }


  /* =======================================================
     TOAST
     ======================================================= */

  function showToast(
    message
  ) {

    let toast =
      document.querySelector(
        "#lagoCreatorToast"
      );


    if (!toast) {

      toast =
        document.createElement(
          "div"
        );


      toast.id =
        "lagoCreatorToast";


      toast.style.cssText = `

        position:fixed;

        z-index:10000;

        left:50%;

        bottom:30px;

        transform:
          translateX(-50%);

        padding:
          12px 18px;

        border-radius:
          999px;

        background:
          #c9ff32;

        color:
          #08090d;

        font-family:
          Inter,
          system-ui,
          sans-serif;

        font-size:
          11px;

        font-weight:
          950;

        box-shadow:
          0 15px 40px
          rgba(0,0,0,.35);

      `;


      document.body.appendChild(
        toast
      );

    }


    toast.textContent =
      message;


    toast.style.display =
      "block";


    clearTimeout(
      toast._timer
    );


    toast._timer =
      setTimeout(
        () => {

          toast.style.display =
            "none";

        },

        1800
      );

  }


  /* =======================================================
     ADD CREATE BUTTON
  ======================================================= */

  function addCreateButton() {

    const bottom =
      document.querySelector(
        ".bottom"
      );


    if (!bottom)
      return;


    if (
      document.querySelector(
        "#lagoCreateButton"
      )
    )
      return;


    const button =
      document.createElement(
        "button"
      );


    button.id =
      "lagoCreateButton";


    button.className =
      "btn";


    button.innerHTML =
      "🎨 CREATE";


    button.addEventListener(
      "click",
      openCreator
    );


    /*
      Put Creator before
      existing footer row.
    */


    bottom.insertBefore(
      button,
      bottom.firstChild
    );

  }


  /* =======================================================
     INIT
     ======================================================= */

  function init() {

    addCreateButton();

  }


  if (
    document.readyState ===
    "loading"
  ) {

    document.addEventListener(
      "DOMContentLoaded",
      init
    );

  } else {

    init();

  }


  /* Public API */

  window.LAGO_CREATOR = {

    open:
      openCreator,

    close:
      closeCreator,

    getCharacter:
      () => ({
        ...character
      }),

    save:
      saveCharacter

  };

})();

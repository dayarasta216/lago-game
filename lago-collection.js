(() => {
  "use strict";

  const SKINS = [

    {
      id: "default",
      name: "Classic Lago",
      emoji: "🐌",
      rarity: "COMMON",
      owned: true
    },

    {
      id: "lime",
      name: "Lime",
      emoji: "🐌",
      rarity: "COMMON",
      owned: false
    },

    {
      id: "ocean",
      name: "Ocean",
      emoji: "🌊",
      rarity: "RARE",
      owned: false
    },

    {
      id: "galaxy",
      name: "Galaxy",
      emoji: "🌌",
      rarity: "EPIC",
      owned: false
    },

    {
      id: "lava",
      name: "Lava",
      emoji: "🔥",
      rarity: "EPIC",
      owned: false
    },

    {
      id: "gold",
      name: "Golden Lago",
      emoji: "👑",
      rarity: "LEGENDARY",
      owned: false
    },

    {
      id: "void",
      name: "Void",
      emoji: "🕳️",
      rarity: "MYTHIC",
      owned: false
    },

    {
      id: "diamond",
      name: "Diamond",
      emoji: "💎",
      rarity: "MYTHIC",
      owned: false
    }

  ];


  function state() {

    if (
      window.LAGO &&
      window.LAGO.getState
    ) {

      return window.LAGO.getState();

    }

    return {
      skins: [],
      selectedSkin: "default"
    };

  }


  function create() {

    if (
      document.querySelector(
        "#lagoCollection"
      )
    ) return;


    const page =
      document.createElement(
        "div"
      );

    page.id =
      "lagoCollection";


    page.innerHTML = `

      <header
        class="lago-collection-header"
      >

        <button
          class="lago-collection-back"
          id="lagoCollectionBack"
        >
          ←
        </button>

        <div
          class="lago-collection-title"
        >
          COLLECTION
        </div>

        <div
          class="lago-collection-counter"
          id="lagoCollectionCounter"
        >
          1/8
        </div>

      </header>


      <main
        class="lago-collection-content"
      >

        <section
          class="lago-collection-hero"
        >

          <div
            class="lago-collection-hero-title"
          >
            CURRENT LAGO
          </div>

          <div
            class="lago-collection-current"
            id="lagoCollectionCurrent"
          >
            🐌
          </div>

          <div
            class="lago-collection-current-name"
            id="lagoCollectionCurrentName"
          >
            Classic Lago
          </div>

          <div
            class="lago-collection-current-rarity"
            id="lagoCollectionCurrentRarity"
          >
            COMMON
          </div>

        </section>


        <section
          class="lago-collection-section"
        >

          <div
            class="lago-collection-section-title"
          >
            YOUR COLLECTION
          </div>

          <div
            class="lago-skin-grid"
            id="lagoSkinGrid"
          ></div>

        </section>

      </main>

    `;


    document.body.appendChild(
      page
    );


    document
      .querySelector(
        "#lagoCollectionBack"
      )
      ?.addEventListener(
        "click",
        hide
      );


    render();

  }


  function render() {

    const page =
      document.querySelector(
        "#lagoCollection"
      );

    if (!page)
      return;


    const currentState =
      state();


    const owned =
      currentState.skins || [];


    const selected =
      currentState.selectedSkin ||
      "default";


    /*
     * Classic skin is always owned.
     */

    const unlocked =
      new Set([
        "default",
        ...owned
      ]);


    const count =
      unlocked.size;


    const counter =
      document.querySelector(
        "#lagoCollectionCounter"
      );


    if (counter) {

      counter.textContent =
        `${count}/${SKINS.length}`;

    }


    const selectedData =
      SKINS.find(
        skin =>
          skin.id === selected
      ) ||
      SKINS[0];


    const current =
      document.querySelector(
        "#lagoCollectionCurrent"
      );

    const currentName =
      document.querySelector(
        "#lagoCollectionCurrentName"
      );

    const currentRarity =
      document.querySelector(
        "#lagoCollectionCurrentRarity"
      );


    if (current)
      current.textContent =
        selectedData.emoji;


    if (currentName)
      currentName.textContent =
        selectedData.name;


    if (currentRarity) {

      currentRarity.textContent =
        selectedData.rarity;

      currentRarity.className =
        "lago-collection-current-rarity " +
        rarityClass(
          selectedData.rarity
        );

    }


    const grid =
      document.querySelector(
        "#lagoSkinGrid"
      );


    if (!grid)
      return;


    grid.innerHTML =
      SKINS.map(
        skin => {

          const isOwned =
            unlocked.has(
              skin.id
            );

          const isSelected =
            selected ===
            skin.id;


          return `

            <button
              class="
                lago-skin
                ${isSelected ? "selected" : ""}
                ${!isOwned ? "locked" : ""}
              "
              data-skin="${skin.id}"
            >

              <div
                class="lago-skin-visual"
              >
                ${
                  isOwned
                    ? skin.emoji
                    : "❔"
                }
              </div>

              <div
                class="lago-skin-name"
              >
                ${
                  isOwned
                    ? skin.name
                    : "Mystery Lago"
                }
              </div>

              <div
                class="
                  lago-skin-rarity
                  ${rarityClass(
                    skin.rarity
                  )}
                "
              >
                ${skin.rarity}
              </div>

              ${
                isSelected
                  ? `
                    <div
                      class="lago-skin-check"
                    >
                      ✓
                    </div>
                  `
                  : !isOwned
                    ? `
                      <div
                        class="lago-skin-lock"
                      >
                        🔒
                      </div>
                    `
                    : ""
              }

            </button>

          `;

        }
      ).join("");


    grid
      .querySelectorAll(
        "[data-skin]"
      )
      .forEach(
        button => {

          button.addEventListener(
            "click",
            () => {

              const id =
                button.dataset.skin;


              if (
                !unlocked.has(id)
              ) {

                showLocked();

                return;

              }


              if (
                window.LAGO &&
                window.LAGO
                  .selectSkin
              ) {

window.LAGO
  .selectSkin(id);

}


render();

            }
          );

        }
      );

  }


  function show() {
    create();

    render();


    const page =
      document.querySelector(
        "#lagoCollection"
      );


    page?.classList.add(
      "active"
    );

  }


  function hide() {

    document
      .querySelector(
        "#lagoCollection"
      )
      ?.classList.remove(
        "active"
      );

  }


  /*
   * Allow the game bridge
   * to notify us about changes.
   */

 document.addEventListener(
  "lago:state",
  () => {

    render();

  }
);

 window.LAGO_COLLECTION = {
  show,
  hide,
  render,
  skins: SKINS
};

})();

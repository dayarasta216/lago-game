(() => {
  "use strict";


 const VERSION =
  5;


  const LAGO_CHARACTER =
    Object.freeze({

      id:
        "lago",

      name:
        "Lago",

      asset:
  "./lago-snail.png",

model3d:
  "./assets/model/lago.glb?v=4",

rarity:
  "ORIGINAL"
      
    });


  const LAGO_SKINS =
    Object.freeze([

      {
        id:
          "default",

        name:
          "Classic Lago",

        emoji:
          "🐌",

        rarity:
          "COMMON"
      },

      {
        id:
          "lime",

        name:
          "Lime",

        emoji:
          "🐌",

        rarity:
          "COMMON"
      },

      {
        id:
          "ocean",

        name:
          "Ocean",

        emoji:
          "🌊",

        rarity:
          "RARE"
      },

      {
        id:
          "galaxy",

        name:
          "Galaxy",

        emoji:
          "🌌",

        rarity:
          "EPIC"
      },

      {
        id:
          "lava",

        name:
          "Lava",

        emoji:
          "🔥",

        rarity:
          "EPIC"
      },

      {
        id:
          "gold",

        name:
          "Golden Lago",

        emoji:
          "👑",

        rarity:
          "LEGENDARY"
      },

      {
        id:
          "void",

        name:
          "Void",

        emoji:
          "🕳️",

        rarity:
          "MYTHIC"
      },

      {
        id:
          "diamond",

        name:
          "Diamond",

        emoji:
          "💎",

        rarity:
          "MYTHIC"
      }

    ]);


  const LAST_LAGO_SKIN_KEY =
    "lago_last_lago_skin_v1";


  /*
   * =========================================================
   * STATE
   * =========================================================
   */


  function state() {

    return (
      window.LAGO
        ?.getState
        ?.() ||
      {
        skins: [],
        selectedSkin:
          "default"
      }
    );

  }


  function ownedIds() {

    const value =
      state()
        .skins;


    return new Set(
      Array.isArray(
        value
      )
        ? value
        : []
    );

  }


  /*
   * =========================================================
   * CHARACTER CATALOG
   * =========================================================
   */


  function comicCharacters() {

    return (
      window.LAGO_CHARACTERS
        ?.getAll
        ?.() ||
      []
    );

  }


  function characters() {

    return [

      LAGO_CHARACTER,

      ...comicCharacters()

    ];

  }


  function isComicCharacter(
    id
  ) {

    return (
      window.LAGO_CHARACTERS
        ?.isComicCharacter
        ?.(
          id
        ) ===
      true
    );

  }


  function selectedCharacterId() {

    const selected =
      state()
        .selectedSkin ||
      "default";


    if (
      isComicCharacter(
        selected
      )
    ) {

      return selected;

    }


    return "lago";

  }


  function selectedCharacter() {

    const id =
      selectedCharacterId();


    return (
      characters()
        .find(
          character =>
            character.id ===
            id
        ) ||
      LAGO_CHARACTER
    );

  }


  /*
   * =========================================================
   * LAGO SKIN MEMORY
   * =========================================================
   */


  function rememberLagoSkin(
    id
  ) {

    const skin =
      LAGO_SKINS
        .find(
          item =>
            item.id ===
            id
        );


    if (!skin)
      return;


    try {

      localStorage.setItem(
        LAST_LAGO_SKIN_KEY,
        skin.id
      );

    } catch {}

  }


  function getLastLagoSkin() {

    let id =
      "default";


    try {

      id =
        localStorage.getItem(
          LAST_LAGO_SKIN_KEY
        ) ||
        "default";

    } catch {}


    const skinExists =
      LAGO_SKINS.some(
        skin =>
          skin.id ===
          id
      );


    if (!skinExists) {

      return "default";

    }


    if (
      id !== "default" &&
      !ownedIds().has(
        id
      )
    ) {

      return "default";

    }


    return id;

  }


  /*
   * =========================================================
   * UI HELPERS
   * =========================================================
   */


  function rarityClass(
    rarity
  ) {

    return (
      "lago-rarity-" +
      String(
        rarity ||
        "COMMON"
      )
        .toLowerCase()
    );

  }


  function escapeAttribute(
  value
) {

  return String(
    value ?? ""
  )
    .replaceAll(
      "&",
      "&amp;"
    )
    .replaceAll(
      '"',
      "&quot;"
    )
    .replaceAll(
      "<",
      "&lt;"
    )
    .replaceAll(
      ">",
      "&gt;"
    );

}


function createCharacterVisual(
  character,
  className
) {

  const model3d =
    typeof character
      ?.model3d ===
      "string"
      ? character.model3d.trim()
      : "";


  /*
   * GLB is the primary Collection visual.
   */
  if (model3d) {

    return `
      <div
        class="${className} lago-glb-preview-host"
        data-lago-glb-preview="${escapeAttribute(
          model3d
        )}"
        role="img"
        aria-label="${escapeAttribute(
          character.name
        )}"
      ></div>
    `;

  }


  /*
   * Temporary compatibility fallback.
   */
  const asset =
    typeof character
      ?.asset ===
      "string"
      ? character.asset.trim()
      : "";


  if (!asset) {

    return `
      <div
        class="${className} lago-character-visual-empty"
        role="img"
        aria-label="${escapeAttribute(
          character.name
        )}"
      ></div>
    `;

  }


  return `
    <img
      class="${className}"
      src="${escapeAttribute(
        asset
      )}"
      alt="${escapeAttribute(
        character.name
      )}"
      draggable="false"
    >
  `;

}


function destroyPreviewHosts(
  root
) {

  if (!root) {

    return;

  }


  root
    .querySelectorAll(
      "[data-lago-glb-preview]"
    )
    .forEach(
      host => {

        window.LAGO_CHARACTER_3D
          ?.destroyPreview
          ?.(
            host
          );

      }
    );

}


function mountPreviewHosts(
  root
) {

  const page =
    document.getElementById(
      "lagoCollection"
    );


  /*
   * Do not create WebGL contexts while
   * Collection is hidden.
   */
  if (
    !root ||
    !page
      ?.classList
      .contains(
        "active"
      )
  ) {

    return;

  }


  root
    .querySelectorAll(
      "[data-lago-glb-preview]"
    )
    .forEach(
      host => {

        const model3d =
          host.dataset
            .lagoGlbPreview;


        if (!model3d) {

          return;

        }


        window.LAGO_CHARACTER_3D
          ?.mountPreview
          ?.(
            host,
            model3d
          );

      }
    );

}


  function create() {

    if (
      document.getElementById(
        "lagoCollection"
      )
    ) {

      return;

    }


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
          type="button"
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
          1/6
        </div>

      </header>


      <main
        class="lago-collection-content"
      >

        <!-- =========================================
             CURRENT CHARACTER
             ========================================= -->

        <section
          class="lago-collection-hero"
        >

          <div
            class="lago-collection-hero-title"
          >
            CURRENT CHARACTER
          </div>


          <div
            class="lago-collection-current"
            id="lagoCollectionCurrent"
          ></div>


          <div
            class="lago-collection-current-name"
            id="lagoCollectionCurrentName"
          >
            Lago
          </div>


          <div
            class="lago-collection-current-rarity"
            id="lagoCollectionCurrentRarity"
          >
            ORIGINAL
          </div>

        </section>


        <!-- =========================================
             REAL CHARACTERS
             ========================================= -->

        <section
          class="lago-collection-section"
        >

          <div
            class="lago-collection-section-title"
          >
            CHARACTERS
          </div>


          <div
            class="lago-skin-grid"
            id="lagoCharacterGrid"
          ></div>

        </section>


        <!-- =========================================
             LAGO SKINS
             ========================================= -->

        <section
          class="lago-collection-section"
        >

          <div
            class="lago-collection-section-title"
          >
            LAGO SKINS
          </div>


          <div
            class="lago-skin-grid"
            id="lagoSkinGrid"
          ></div>

        </section>

      </main>


      <div
        class="lago-collection-toast"
        id="lagoCollectionToast"
      ></div>

    `;


    document.body
      .appendChild(
        page
      );


    page
      .querySelector(
        "#lagoCollectionBack"
      )
      ?.addEventListener(
        "click",
        hide
      );

  }


  function toast(
    message
  ) {

    const element =
      document.getElementById(
        "lagoCollectionToast"
      );


    if (!element)
      return;


    element.textContent =
      String(
        message ||
        ""
      );


    element.classList.add(
      "show"
    );


    clearTimeout(
      element._timer
    );


    element._timer =
      setTimeout(
        () => {

          element.classList.remove(
            "show"
          );

        },
        1500
      );

  }


  /*
   * =========================================================
   * EQUIP CHARACTER
   * =========================================================
   */


  function equipCharacter(
    id
  ) {

    /*
     * Returning to Lago restores
     * the player's previous Lago skin.
     */

    if (
      id ===
      "lago"
    ) {

      const skin =
        getLastLagoSkin();


      const ok =
        window.LAGO
          ?.selectSkin
          ?.(
            skin
          );


      if (!ok) {

        toast(
          "EQUIP FAILED"
        );

        return false;

      }


      window.LAGO_CHARACTER_RUNTIME
        ?.apply
        ?.();


      render();


      return true;

    }


    /*
     * Comic character.
     */

    if (
      !isComicCharacter(
        id
      )
    ) {

      return false;

    }


    if (
      !ownedIds().has(
        id
      )
    ) {

      toast(
        "AVAILABLE IN SHOP"
      );

      return false;

    }


    const ok =
      window.LAGO
        ?.selectSkin
        ?.(
          id
        );


    if (!ok) {

      toast(
        "EQUIP FAILED"
      );

      return false;

    }


    window.LAGO_CHARACTER_RUNTIME
      ?.apply
      ?.();


    render();


    return true;

  }


  /*
   * =========================================================
   * EQUIP LAGO SKIN
   * =========================================================
   */


  function equipLagoSkin(
    id
  ) {

    const skin =
      LAGO_SKINS
        .find(
          item =>
            item.id ===
            id
        );


    if (!skin)
      return false;


    const owned =
      id ===
        "default" ||
      ownedIds().has(
        id
      );


    if (!owned) {

      toast(
        "SKIN LOCKED"
      );

      return false;

    }


    const ok =
      window.LAGO
        ?.selectSkin
        ?.(
          id
        );


    if (!ok) {

      toast(
        "EQUIP FAILED"
      );

      return false;

    }


    rememberLagoSkin(
      id
    );


    window.LAGO_CHARACTER_RUNTIME
      ?.apply
      ?.();


    render();


    return true;

  }


  /*
   * =========================================================
   * CURRENT CHARACTER HERO
   * =========================================================
   */


  function renderHero() {

    const character =
      selectedCharacter();


    const visual =
      document.getElementById(
        "lagoCollectionCurrent"
      );


    const name =
      document.getElementById(
        "lagoCollectionCurrentName"
      );


    const rarity =
      document.getElementById(
        "lagoCollectionCurrentRarity"
      );


    if (visual) {

  destroyPreviewHosts(
    visual
  );


  visual.innerHTML =
    createCharacterVisual(
      character,
      "lago-collection-current-image"
    );


  mountPreviewHosts(
    visual
  );

}


    if (name) {

      name.textContent =
        character.name;

    }


    if (rarity) {

      rarity.textContent =
        character.rarity ||
        "COMIC";


      rarity.className =
        "lago-collection-current-rarity " +
        rarityClass(
          character.rarity ||
          "COMIC"
        );

    }

  }


  /*
   * =========================================================
   * CHARACTER GRID
   * =========================================================
   */


  function renderCharacters() {

    const grid =
      document.getElementById(
        "lagoCharacterGrid"
      );


    if (!grid)
      return;


    const catalog =
      characters();


    const selected =
      selectedCharacterId();


    const owned =
      ownedIds();


    const ownedCharacterCount =
      catalog.filter(
        character =>
          character.id ===
            "lago" ||
          owned.has(
            character.id
          )
      ).length;


    const counter =
      document.getElementById(
        "lagoCollectionCounter"
      );


    if (counter) {

      counter.textContent =
        `${ownedCharacterCount}/${catalog.length}`;

    }


    destroyPreviewHosts(
  grid
);


grid.innerHTML =
  catalog
        .map(
          character => {

            const isLago =
              character.id ===
              "lago";


            const isOwned =
              isLago ||
              owned.has(
                character.id
              );


            const isSelected =
              selected ===
              character.id;


            return `

              <button
                type="button"

                class="
                  lago-skin
                  lago-character-card

                  ${
                    !isLago
                      ? "comic-character"
                      : ""
                  }

                  ${
                    isSelected
                      ? "selected"
                      : ""
                  }

                  ${
                    !isOwned
                      ? "locked"
                      : ""
                  }
                "

                data-character="${character.id}"
              >

                <div
                  class="
                    lago-skin-visual
                    lago-character-visual
                  "
                >

                  ${createCharacterVisual(
  character,
  "lago-skin-image"
)}

                </div>


                <div
                  class="lago-skin-name"
                >
                  ${character.name}
                </div>


                <div
                  class="
                    lago-skin-rarity
                    ${
                      rarityClass(
                        character.rarity ||
                        "COMIC"
                      )
                    }
                  "
                >
                  ${
                    character.rarity ||
                    "COMIC"
                  }
                </div>


                ${
                  !isLago
                    ? `
                      <div
                        class="lago-skin-series"
                      >
                        COMIC 01
                      </div>
                    `
                    : `
                      <div
                        class="lago-skin-series"
                      >
                        ORIGINAL
                      </div>
                    `
                }


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
        )
             .join(
        ""
      );


  mountPreviewHosts(
    grid
  );


  grid
    .querySelectorAll(
      "[data-character]"
    )
      .forEach(
        button => {

          button.addEventListener(
            "click",
            () => {

              equipCharacter(
                button.dataset
                  .character
              );

            }
          );

        }
      );

  }


  /*
   * =========================================================
   * LAGO SKINS GRID
   * =========================================================
   */


  function renderSkins() {

    const grid =
      document.getElementById(
        "lagoSkinGrid"
      );


    if (!grid)
      return;


    const currentState =
      state();


    const selected =
      currentState
        .selectedSkin ||
      "default";


    const selectedIsComic =
      isComicCharacter(
        selected
      );


    const owned =
      ownedIds();


    grid.innerHTML =
      LAGO_SKINS
        .map(
          skin => {

            const isOwned =
              skin.id ===
                "default" ||
              owned.has(
                skin.id
              );


            /*
             * A Lago skin can only be
             * visually selected while
             * Lago itself is active.
             */

            const isSelected =
              !selectedIsComic &&
              selected ===
                skin.id;


            return `

              <button
                type="button"

                class="
                  lago-skin

                  ${
                    isSelected
                      ? "selected"
                      : ""
                  }

                  ${
                    !isOwned
                      ? "locked"
                      : ""
                  }
                "

                data-lago-skin="${skin.id}"
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
                    ${
                      rarityClass(
                        skin.rarity
                      )
                    }
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
        )
        .join(
          ""
        );


    grid
      .querySelectorAll(
        "[data-lago-skin]"
      )
      .forEach(
        button => {

          button.addEventListener(
            "click",
            () => {

              equipLagoSkin(
                button.dataset
                  .lagoSkin
              );

            }
          );

        }
      );

  }


  /*
   * =========================================================
   * RENDER
   * =========================================================
   */


  function render() {

    create();


    /*
     * If Lago is currently selected,
     * remember its currently equipped
     * skin before rendering.
     */

    const selected =
      state()
        .selectedSkin ||
      "default";


    if (
      !isComicCharacter(
        selected
      )
    ) {

      rememberLagoSkin(
        selected
      );

    }


    renderHero();

    renderCharacters();

    renderSkins();

  }


  function show() {

  create();


  /*
   * Page must be visible before GLB previews
   * measure their real dimensions.
   */
  document
    .getElementById(
      "lagoCollection"
    )
    ?.classList.add(
      "active"
    );


  render();

}


function hide() {

  const page =
    document.getElementById(
      "lagoCollection"
    );


  if (!page) {

    return;

  }


  /*
   * Release Collection WebGL contexts.
   * They will be recreated next time
   * Collection is opened.
   */
  destroyPreviewHosts(
    page
  );


  page.classList.remove(
    "active"
  );

}


  /*
   * =========================================================
   * EVENTS
   * =========================================================
   */


  document.addEventListener(
    "lago:state",
    render
  );

  document.addEventListener(
  "lago:character-3d-ready",
  () => {

    const page =
      document.getElementById(
        "lagoCollection"
      );


    if (
      page
        ?.classList
        .contains(
          "active"
        )
    ) {

      render();

    }

  }
);

  document.addEventListener(
    "lago:character-unlocked",
    render
  );


  /*
   * =========================================================
   * PUBLIC API
   * =========================================================
   */


  window.LAGO_COLLECTION =
    Object.freeze({

      version:
        VERSION,

      show,

      hide,

      render,

      characters,

      skins:
        LAGO_SKINS

    });


})();
    

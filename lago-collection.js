(() => {
  "use strict";

  const VERSION = 7;


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


  let lastHeroKey =
    "";

  let lastCharactersKey =
    "";

  let lastSkinsKey =
    "";


  function state() {

    return (
      window.LAGO_ACCOUNT
        ?.getState
        ?.() ||

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


  function selectSkin(id) {

    if (
      typeof window.LAGO_ACCOUNT
        ?.selectSkin ===
      "function"
    ) {

      return (
        window.LAGO_ACCOUNT
          .selectSkin(
            id
          ) === true
      );
    }


    return (
      window.LAGO
        ?.selectSkin
        ?.(
          id
        ) === true
    );
  }


  function ownedIds() {

    const value =
      state().skins;


    return new Set(
      Array.isArray(value)
        ? value
        : []
    );
  }


  function comicCharacters() {

    return (
      window.LAGO_CHARACTERS
        ?.getAll
        ?.() || []
    );
  }


  function characters() {

    return [
      LAGO_CHARACTER,
      ...comicCharacters()
    ];
  }


  function isComicCharacter(id) {

    return (
      window.LAGO_CHARACTERS
        ?.isComicCharacter
        ?.(
          id
        ) === true
    );
  }


  function selectedCharacterId() {

    const selected =
      state().selectedSkin ||
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
          item =>
            item.id === id
        ) ||
      LAGO_CHARACTER
    );
  }


  function rememberLagoSkin(id) {

    const exists =
      LAGO_SKINS.some(
        skin =>
          skin.id === id
      );


    if (!exists) {
      return;
    }


    try {

      localStorage.setItem(
        LAST_LAGO_SKIN_KEY,
        id
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


    const exists =
      LAGO_SKINS.some(
        skin =>
          skin.id === id
      );


    if (!exists) {
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


  function rarityClass(rarity) {

    return (
      "lago-rarity-" +
      String(
        rarity ||
        "COMMON"
      ).toLowerCase()
    );
  }


  function escapeAttribute(value) {

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


  /*
   * Hero = GLB first.
   */
  function createHeroVisual(
    character,
    className
  ) {

    const model3d =
      typeof character
        ?.model3d ===
        "string"
        ? character.model3d.trim()
        : "";


    if (model3d) {

      return `
        <div
          class="
            ${className}
            lago-glb-preview-host
          "
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


    return createThumbVisual(
      character,
      className
    );
  }


  /*
   * Grid cards = thumbnail first.
   *
   * This avoids parsing 5–8 GLBs
   * merely to open Collection.
   */
  function createThumbVisual(
    character,
    className
  ) {

    const asset =
      typeof character
        ?.asset ===
        "string"
        ? character.asset.trim()
        : "";


    if (asset) {

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
          loading="lazy"
          decoding="async"
        >
      `;
    }


    const model3d =
      typeof character
        ?.model3d ===
        "string"
        ? character.model3d.trim()
        : "";


    if (model3d) {

      return `
        <div
          class="
            ${className}
            lago-glb-preview-host
          "
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


    return `
      <div
        class="
          ${className}
          lago-character-visual-empty
        "
      ></div>
    `;
  }


  function mountPreviewHosts(root) {

    const page =
      document.getElementById(
        "lagoCollection"
      );


    if (
      !root ||
      !page?.classList.contains(
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

          /*
           * Never regenerate an already
           * completed static snapshot.
           */
          if (
            host.querySelector(
              ".lago-glb-preview-image"
            ) ||
            host
              ._lago3dPreviewController
          ) {
            return;
          }


          const model =
            host.dataset
              .lagoGlbPreview;


          if (!model) {
            return;
          }


          window.LAGO_CHARACTER_3D
            ?.mountPreview
            ?.(
              host,
              model
            );
        }
      );
  }


  function create() {

    let page =
      document.getElementById(
        "lagoCollection"
      );


    if (page) {
      return page;
    }


    page =
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


    document.body.appendChild(
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


    /*
     * Event delegation.
     *
     * Cards can be rebuilt without
     * recreating hundreds of listeners.
     */
    page.addEventListener(
      "click",
      event => {

        const character =
          event.target.closest(
            "[data-character]"
          );


        if (character) {

          equipCharacter(
            character.dataset
              .character
          );

          return;
        }


        const skin =
          event.target.closest(
            "[data-lago-skin]"
          );


        if (skin) {

          equipLagoSkin(
            skin.dataset
              .lagoSkin
          );
        }
      }
    );


    return page;
  }


  function toast(message) {

    const element =
      document.getElementById(
        "lagoCollectionToast"
      );


    if (!element) {
      return;
    }


    element.textContent =
      String(
        message || ""
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


   function notifyCharacterEquipped(
    id
  ) {

    /*
     * Character runtimes already react
     * to structural account state.
     *
     * Keep one semantic equip event for
     * UI / compatibility listeners.
     * Do not invoke renderers directly.
     */
    document.dispatchEvent(
      new CustomEvent(
        "lago:character-equipped",
        {
          detail: {
            id,
            source:
              "collection"
          }
        }
      )
    );

  }


  function equipCharacter(id) {

    if (
      id === "lago"
    ) {

      const skin =
        getLastLagoSkin();


      if (
        !selectSkin(
          skin
        )
      ) {

        toast(
          "EQUIP FAILED"
        );

        return false;
      }


      notifyCharacterEquipped(
        "lago"
      );

      return true;
    }


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


    if (
      !selectSkin(
        id
      )
    ) {

      toast(
        "EQUIP FAILED"
      );

      return false;
    }


    notifyCharacterEquipped(
      id
    );

    return true;
  }


  function equipLagoSkin(id) {

    const skin =
      LAGO_SKINS.find(
        item =>
          item.id === id
      );


    if (!skin) {
      return false;
    }


    const owned =
      id === "default" ||
      ownedIds().has(
        id
      );


    if (!owned) {

      toast(
        "SKIN LOCKED"
      );

      return false;
    }


    if (
      !selectSkin(
        id
      )
    ) {

      toast(
        "EQUIP FAILED"
      );

      return false;
    }


    rememberLagoSkin(
      id
    );


    notifyCharacterEquipped(
      "lago"
    );


    render();

    return true;
  }


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


    const key = [
      character.id,
      character.model3d || "",
      character.asset || ""
    ].join("|");


    if (
      visual &&
      (
        key !== lastHeroKey ||
        visual.childElementCount === 0
      )
    ) {

      lastHeroKey =
        key;


      visual.innerHTML =
        createHeroVisual(
          character,
          "lago-collection-current-image"
        );
    }


    if (visual) {
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


  function renderCharacters() {

    const grid =
      document.getElementById(
        "lagoCharacterGrid"
      );


    if (!grid) {
      return;
    }


    const fullCatalog =
      characters();


    const owned =
      ownedIds();


    const selected =
      selectedCharacterId();


    const mobile =
      window.matchMedia(
        "(max-width: 560px)"
      ).matches;


    /*
     * Smartphone:
     * only actual inventory.
     *
     * Locked character cards are
     * completely absent.
     */
    const catalog =
      mobile
        ? fullCatalog.filter(
            character =>
              character.id ===
                "lago" ||
              owned.has(
                character.id
              )
          )
        : fullCatalog;


    const ownedCount =
      fullCatalog.filter(
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
        `${ownedCount}/${fullCatalog.length}`;
    }


    const key = [
      mobile
        ? "mobile"
        : "desktop",

      selected,

      [...owned]
        .sort()
        .join(","),

      fullCatalog
        .map(
          item =>
            item.id
        )
        .join(",")

    ].join("|");


    if (
      key ===
        lastCharactersKey &&
      grid.childElementCount > 0
    ) {

      mountPreviewHosts(
        grid
      );

      return;
    }


    lastCharactersKey =
      key;


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
                data-character="${escapeAttribute(
                  character.id
                )}"
              >
                <div
                  class="
                    lago-skin-visual
                    lago-character-visual
                  "
                >
                  ${createThumbVisual(
                    character,
                    "lago-skin-image"
                  )}
                </div>

                <div
                  class="lago-skin-name"
                >
                  ${escapeAttribute(
                    character.name
                  )}
                </div>

                <div
                  class="
                    lago-skin-rarity
                    ${rarityClass(
                      character.rarity ||
                      "COMIC"
                    )}
                  "
                >
                  ${
                    character.rarity ||
                    "COMIC"
                  }
                </div>

                <div
                  class="lago-skin-series"
                >
                  ${
                    isLago
                      ? "ORIGINAL"
                      : "COMIC 01"
                  }
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
                    : (
                        !isOwned
                          ? `
                            <div
                              class="lago-skin-lock"
                            >
                              🔒
                            </div>
                          `
                          : ""
                      )
                }
              </button>
            `;
          }
        )
        .join("");


    mountPreviewHosts(
      grid
    );
  }


  function renderSkins() {

    const grid =
      document.getElementById(
        "lagoSkinGrid"
      );


    if (!grid) {
      return;
    }


    const current =
      state().selectedSkin ||
      "default";


    const selectedIsComic =
      isComicCharacter(
        current
      );


    const owned =
      ownedIds();


    const key = [
      current,
      selectedIsComic
        ? "comic"
        : "lago",
      [...owned]
        .sort()
        .join(",")
    ].join("|");


    if (
      key ===
        lastSkinsKey &&
      grid.childElementCount > 0
    ) {
      return;
    }


    lastSkinsKey =
      key;


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


            const isSelected =
              !selectedIsComic &&
              current ===
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
                data-lago-skin="${escapeAttribute(
                  skin.id
                )}"
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
                    : (
                        !isOwned
                          ? `
                            <div
                              class="lago-skin-lock"
                            >
                              🔒
                            </div>
                          `
                          : ""
                      )
                }
              </button>
            `;
          }
        )
        .join("");
  }


  function render() {

    create();


    const selected =
      state().selectedSkin ||
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

    const page =
      create();


    /*
     * Visible first so preview sizes
     * are measured correctly.
     */
    page.classList.add(
      "active"
    );


    render();
  }


  function hide() {

    document
      .getElementById(
        "lagoCollection"
      )
      ?.classList.remove(
        "active"
      );


    /*
     * Do NOT destroy static snapshots.
     *
     * Each GLB preview was converted
     * to an ordinary <img>.
     *
     * Keeping it makes the next
     * Collection open instant.
     */
  }


  function renderCollectionIfOpen() {

    const page =
      document.getElementById(
        "lagoCollection"
      );


    if (
      !page?.classList.contains(
        "active"
      )
    ) {
      return;
    }


    render();
  }


  document.addEventListener(
    "lago:character-equipped",
    renderCollectionIfOpen
  );


  document.addEventListener(
    "lago:character-unlocked",
    () => {

      lastCharactersKey =
        "";


      renderCollectionIfOpen();
    }
  );


  document.addEventListener(
    "lago:character-3d-ready",
    () => {

      const page =
        document.getElementById(
          "lagoCollection"
        );


      if (
        !page?.classList.contains(
          "active"
        )
      ) {
        return;
      }


      mountPreviewHosts(
        page
      );
    }
  );


  const collectionMobileQuery =
    window.matchMedia(
      "(max-width: 560px)"
    );


  collectionMobileQuery
    .addEventListener
    ?.(
      "change",
      () => {

        lastCharactersKey =
          "";


        renderCollectionIfOpen();
      }
    );


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

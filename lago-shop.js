(() => {
  "use strict";

  const VERSION = 3;

  let lastRenderKey = "";


  function account() {
    return window.LAGO_ACCOUNT || null;
  }


  function characters() {
    return (
      window.LAGO_CHARACTERS
        ?.getShopCharacters
        ?.() || []
    );
  }


  function state() {
    return (
      account()
        ?.getState
        ?.() || null
    );
  }


  function ownedSet() {
    const skins =
      state()?.skins;

    return new Set(
      Array.isArray(skins)
        ? skins
        : []
    );
  }


  function currentCharacterId() {
    return String(
      state()?.selectedSkin ||
      "default"
    );
  }


  function spBalance() {
    return Math.max(
      0,
      Number(
        account()
          ?.getSPState
          ?.()
          ?.balance
      ) || 0
    );
  }


  function formatSP(value) {
    return Math.max(
      0,
      Math.floor(
        Number(value) || 0
      )
    ).toLocaleString(
      "en-US"
    );
  }


  function escapeHTML(value) {
    return String(
      value ?? ""
    )
      .replaceAll(
        "&",
        "&amp;"
      )
      .replaceAll(
        "<",
        "&lt;"
      )
      .replaceAll(
        ">",
        "&gt;"
      )
      .replaceAll(
        '"',
        "&quot;"
      )
      .replaceAll(
        "'",
        "&#039;"
      );
  }


  function rarityClass(rarity) {
    return (
      "lago-shop-rarity-" +
      String(
        rarity ||
        "COMMON"
      ).toLowerCase()
    );
  }


  /*
   * Fast card strategy:
   *
   * existing 2D asset first;
   * GLB only when a character
   * has no thumbnail asset.
   *
   * Miki / Oleg currently fall
   * back to GLB.
   */
  function createCharacterVisual(
    character
  ) {

    const asset =
      typeof character?.asset ===
      "string"
        ? character.asset.trim()
        : "";


    if (asset) {
      return `
        <img
          class="lago-shop-character-image"
          src="${escapeHTML(asset)}"
          alt="${escapeHTML(character.name)}"
          draggable="false"
          loading="lazy"
          decoding="async"
        >
      `;
    }


    const model3d =
      typeof character?.model3d ===
      "string"
        ? character.model3d.trim()
        : "";


    if (model3d) {
      return `
        <div
          class="
            lago-shop-character-image
            lago-shop-glb-preview
          "
          data-lago-glb-preview="${escapeHTML(
            model3d
          )}"
          role="img"
          aria-label="${escapeHTML(
            character.name
          )}"
        ></div>
      `;
    }


    return `
      <div
        class="
          lago-shop-character-image
          lago-shop-character-empty
        "
      ></div>
    `;
  }


  function mountPreviewHosts(root) {

    const page =
      document.getElementById(
        "lagoShop"
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
           * Snapshot already exists:
           * do absolutely nothing.
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
        "lagoShop"
      );


    if (page) {
      return page;
    }


    page =
      document.createElement(
        "div"
      );


    page.id =
      "lagoShop";


    page.innerHTML = `
      <header
        class="lago-shop-header"
      >
        <button
          id="lagoShopBack"
          class="lago-shop-back"
          type="button"
          aria-label="Back"
        >
          ←
        </button>

        <div
          class="lago-shop-heading"
        >
          <div
            class="lago-shop-title"
          >
            SHOP
          </div>

          <div
            class="lago-shop-subtitle"
          >
            CHARACTERS
          </div>
        </div>

        <div
          class="lago-shop-balance"
        >
          <span
            id="lagoShopSP"
          >
            0
          </span>

          <span>
            SP
          </span>
        </div>
      </header>

      <main
        class="lago-shop-content"
      >
        <section
          id="lagoShopDev"
          class="lago-shop-dev"
          hidden
        >
          <div
            class="lago-shop-dev-label"
          >
            DEVELOPER ACCESS
          </div>

          <div
            class="lago-shop-dev-text"
          >
            FULL LOCAL TEST ACCESS
          </div>
        </section>

        <section
          class="lago-shop-intro"
        >
          <div
            class="lago-shop-intro-kicker"
          >
            COMIC CHARACTERS
          </div>

          <div
            class="lago-shop-intro-title"
          >
            Choose your character.
          </div>

          <div
            class="lago-shop-intro-copy"
          >
            Characters are complete playable identities,
            not Lago skins.
          </div>
        </section>

        <section
          class="lago-shop-grid"
          id="lagoShopGrid"
        ></section>
      </main>

      <div
        class="lago-shop-toast"
        id="lagoShopToast"
      ></div>
    `;


    document.body.appendChild(
      page
    );


    page
      .querySelector(
        "#lagoShopBack"
      )
      ?.addEventListener(
        "click",
        hide
      );


    page.addEventListener(
      "click",
      onPageClick
    );


    return page;
  }


  function toast(message) {

    const element =
      document.getElementById(
        "lagoShopToast"
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
        1600
      );
  }


  function updateBalance() {

    const element =
      document.getElementById(
        "lagoShopSP"
      );


    if (!element) {
      return;
    }


    element.textContent =
      formatSP(
        spBalance()
      );
  }


  function updateAffordability() {

    const page =
      document.getElementById(
        "lagoShop"
      );


    if (!page) {
      return;
    }


    const balance =
      spBalance();


    page
      .querySelectorAll(
        "[data-shop-buy]"
      )
      .forEach(
        button => {

          const price =
            Math.max(
              0,
              Number(
                button.dataset
                  .shopPrice
              ) || 0
            );


          button.classList.toggle(
            "insufficient",
            balance < price
          );
        }
      );
  }


  function openCollection() {

    hide();

    window.LAGO_COLLECTION
      ?.show
      ?.();
  }


  function buyCharacter(
    characterId
  ) {

    const character =
      window.LAGO_CHARACTERS
        ?.getById
        ?.(
          characterId
        );


    if (
      !character ||
      character.shop
        ?.enabled !== true
    ) {

      toast(
        "CHARACTER NOT AVAILABLE"
      );

      return false;
    }


    const owned =
      ownedSet();


    if (
      owned.has(
        character.id
      )
    ) {

      openCollection();

      return true;
    }


    const price =
      Math.max(
        0,
        Math.floor(
          Number(
            character.shop
              ?.price
          ) || 0
        )
      );


    if (
      String(
        character.shop
          ?.currency || ""
      ).toUpperCase() !==
      "SP"
    ) {

      toast(
        "UNSUPPORTED CURRENCY"
      );

      return false;
    }


    if (
      !account()
        ?.canSpendSP
        ?.(
          price
        )
    ) {

      toast(
        "NOT ENOUGH SP"
      );

      return false;
    }


    const spent =
      account()
        ?.spendSP
        ?.(
          price,
          {
            gameId:
              "character-shop"
          }
        );


    if (
      spent !== true
    ) {

      toast(
        "PURCHASE FAILED"
      );

      return false;
    }


    account()
      ?.addSkin
      ?.(
        character.id
      );


    lastRenderKey =
      "";


    document.dispatchEvent(
      new CustomEvent(
        "lago:character-unlocked",
        {
          detail: {
            id:
              character.id,

            name:
              character.name,

            source:
              "shop",

            currency:
              "SP",

            price
          }
        }
      )
    );


    toast(
      `${character.name} UNLOCKED`
    );


    openCollection();


    return true;
  }


  /*
   * Shop no longer equips directly.
   * CHOOSE leads to Collection.
   */
  function equipCharacter(
    characterId
  ) {

    const character =
      window.LAGO_CHARACTERS
        ?.getById
        ?.(
          characterId
        );


    if (!character) {
      return false;
    }


    if (
      !ownedSet().has(
        character.id
      )
    ) {

      toast(
        "CHARACTER LOCKED"
      );

      return false;
    }


    openCollection();

    return true;
  }


  function onPageClick(event) {

    const buy =
      event.target.closest(
        "[data-shop-buy]"
      );


    if (buy) {

      buyCharacter(
        buy.dataset
          .shopBuy
      );

      return;
    }


    const choose =
      event.target.closest(
        "[data-shop-equip]"
      );


    if (choose) {

      equipCharacter(
        choose.dataset
          .shopEquip
      );
    }
  }


  function characterCard(
    character,
    owned,
    selected,
    balance
  ) {

    const price =
      Math.max(
        0,
        Math.floor(
          Number(
            character.shop
              ?.price
          ) || 0
        )
      );


    const canBuy =
      balance >= price;


    const playtime =
      character
        .playtimeUnlock;


    const hours =
      playtime?.enabled === true
        ? Math.round(
            Math.max(
              0,
              Number(
                playtime.minutes
              ) || 0
            ) / 60
          )
        : 0;


    let actionHTML =
      "";


    if (selected) {

      actionHTML = `
        <button
          class="
            lago-shop-action
            owned
          "
          type="button"
          data-shop-equip="${escapeHTML(
            character.id
          )}"
        >
          COLLECTION
        </button>
      `;

    } else if (owned) {

      actionHTML = `
        <button
          class="
            lago-shop-action
            owned
          "
          type="button"
          data-shop-equip="${escapeHTML(
            character.id
          )}"
        >
          CHOOSE
        </button>
      `;

    } else {

      actionHTML = `
        <button
          class="
            lago-shop-action
            ${
              canBuy
                ? ""
                : "insufficient"
            }
          "
          type="button"
          data-shop-buy="${escapeHTML(
            character.id
          )}"
          data-shop-price="${price}"
        >
          BUY · ${formatSP(
            price
          )} SP
        </button>
      `;
    }


    return `
      <article
        class="
          lago-shop-card
          ${
            owned
              ? "owned"
              : ""
          }
          ${
            selected
              ? "selected"
              : ""
          }
        "
      >
        <div
          class="lago-shop-character-stage"
        >
          ${createCharacterVisual(
            character
          )}
        </div>

        <div
          class="lago-shop-character-info"
        >
          <div
            class="lago-shop-character-top"
          >
            <div
              class="lago-shop-character-name"
            >
              ${escapeHTML(
                character.name
              )}
            </div>

            <div
              class="
                lago-shop-character-rarity
                ${rarityClass(
                  character.rarity
                )}
              "
            >
              ${escapeHTML(
                character.rarity
              )}
            </div>
          </div>

          <div
            class="lago-shop-character-type"
          >
            COMIC CHARACTER
          </div>

          ${
            hours > 0
              ? `
                <div
                  class="lago-shop-free-route"
                >
                  FREE ROUTE · ${hours}H ACTIVE PLAY
                </div>
              `
              : `
                <div
                  class="
                    lago-shop-free-route
                    empty
                  "
                >
                  SHOP EXCLUSIVE
                </div>
              `
          }

          ${actionHTML}
        </div>
      </article>
    `;
  }


  function structuralKey(
    catalog,
    owned,
    current
  ) {

    return [
      VERSION,

      current,

      [...owned]
        .sort()
        .join(","),

      catalog
        .map(
          item =>
            item.id
        )
        .join(","),

      window.LAGO_DEV
        ?.enabled
        ?.() === true
        ? "dev"
        : "normal"

    ].join("|");
  }


  function render(
    force = false
  ) {

    create();

    updateBalance();


    const dev =
      document.getElementById(
        "lagoShopDev"
      );


    if (dev) {
      dev.hidden =
        window.LAGO_DEV
          ?.enabled
          ?.() !== true;
    }


    const grid =
      document.getElementById(
        "lagoShopGrid"
      );


    if (!grid) {
      return;
    }


    const catalog =
      characters();


    const owned =
      ownedSet();


    const current =
      currentCharacterId();


    const key =
      structuralKey(
        catalog,
        owned,
        current
      );


    /*
     * Same catalog already exists.
     *
     * Never rebuild cards just
     * because Shop was reopened.
     */
    if (
      !force &&
      key === lastRenderKey &&
      grid.childElementCount > 0
    ) {

      updateAffordability();

      mountPreviewHosts(
        grid
      );

      return;
    }


    lastRenderKey =
      key;


    if (
      catalog.length === 0
    ) {

      grid.innerHTML = `
        <div
          class="lago-shop-empty"
        >
          NO CHARACTERS AVAILABLE
        </div>
      `;

      return;
    }


    const balance =
      spBalance();


    grid.innerHTML =
      catalog
        .map(
          character =>
            characterCard(
              character,
              owned.has(
                character.id
              ),
              current ===
                character.id,
              balance
            )
        )
        .join("");


    mountPreviewHosts(
      grid
    );
  }


  function show() {

    const page =
      create();


    page.classList.add(
      "active"
    );


    render();
  }


  function hide() {

    document
      .getElementById(
        "lagoShop"
      )
      ?.classList.remove(
        "active"
      );

    /*
     * Static preview images are kept.
     *
     * No live WebGL context belongs
     * to an individual card.
     *
     * Reopening Shop is therefore
     * immediate.
     */
  }


  document.addEventListener(
    "lago:account-state",
    () => {

      const page =
        document.getElementById(
          "lagoShop"
        );


      if (
        !page?.classList.contains(
          "active"
        )
      ) {
        return;
      }


      updateBalance();

      updateAffordability();
    }
  );


  document.addEventListener(
    "lago:character-unlocked",
    () => {

      lastRenderKey =
        "";


      const page =
        document.getElementById(
          "lagoShop"
        );


      if (
        page?.classList.contains(
          "active"
        )
      ) {
        render();
      }
    }
  );


  document.addEventListener(
    "lago:dev-mode",
    () => {

      lastRenderKey =
        "";


      const page =
        document.getElementById(
          "lagoShop"
        );


      if (
        page?.classList.contains(
          "active"
        )
      ) {
        render();
      }
    }
  );


  document.addEventListener(
    "lago:character-3d-ready",
    () => {

      const grid =
        document.getElementById(
          "lagoShopGrid"
        );


      mountPreviewHosts(
        grid
      );
    }
  );


  document.addEventListener(
    "keydown",
    event => {

      if (
        event.key ===
        "Escape"
      ) {
        hide();
      }
    }
  );


  window.LAGO_SHOP =
    Object.freeze({
      version:
        VERSION,

      show,

      hide,

      render,

      buyCharacter,

      equipCharacter
    });

})();

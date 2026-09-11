(() => {
  "use strict";


 const VERSION =
  2;


  /*
   * =========================================================
   * HELPERS
   * =========================================================
   */


  function account() {

    return (
      window.LAGO_ACCOUNT ||
      null
    );

  }


  function characters() {

    return (
      window.LAGO_CHARACTERS
        ?.getShopCharacters
        ?.() ||
      []
    );

  }


  function state() {

    return (
      account()
        ?.getState
        ?.() ||
      null
    );

  }


  function ownedSet() {

    const skins =
      state()
        ?.skins;


    return new Set(
      Array.isArray(
        skins
      )
        ? skins
        : []
    );

  }


  function currentCharacterId() {

    return String(
      state()
        ?.selectedSkin ||
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
      ) ||
      0
    );

  }


  function formatSP(
    value
  ) {

    return (
      Math.max(
        0,
        Math.floor(
          Number(
            value
          ) ||
          0
        )
      )
        .toLocaleString(
          "en-US"
        )
    );

  }


  function escapeHTML(
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


  function rarityClass(
    rarity
  ) {

    return (
      "lago-shop-rarity-" +
      String(
        rarity ||
        "COMMON"
      )
        .toLowerCase()
    );

  }

  function createCharacterVisual(
  character
) {

  const model3d =
    typeof character
      ?.model3d ===
      "string"
      ? character.model3d.trim()
      : "";


  /*
   * Canonical Shop visual = GLB.
   */
  if (
    model3d
  ) {

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


  /*
   * Temporary fallback only.
   */
  const asset =
    typeof character
      ?.asset ===
      "string"
      ? character.asset.trim()
      : "";


  if (
    !asset
  ) {

    return `
      <div
        class="
          lago-shop-character-image
          lago-shop-character-empty
        "
        role="img"
        aria-label="${escapeHTML(
          character.name
        )}"
      ></div>
    `;

  }


  return `
    <img
      class="lago-shop-character-image"
      src="${escapeHTML(
        asset
      )}"
      alt="${escapeHTML(
        character.name
      )}"
      draggable="false"
    >
  `;

}


function destroyPreviewHosts(
  root
) {

  if (
    !root
  ) {

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
      "lagoShop"
    );


  /*
   * Never spend WebGL contexts
   * while Shop is hidden.
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


        if (
          !model3d
        ) {

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


  /*
   * =========================================================
   * PAGE
   * =========================================================
   */


  function create() {

    if (
      document.getElementById(
        "lagoShop"
      )
    ) {

      return;

    }


    const page =
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


    document.body
      .appendChild(
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

  }



  /*
   * =========================================================
   * TOAST
   * =========================================================
   */


  function toast(
    message
  ) {

    const element =
      document.getElementById(
        "lagoShopToast"
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
        1700
      );

  }

function openCollection() {

  hide();


  window.LAGO_COLLECTION
    ?.show
    ?.();

}

  /*
   * =========================================================
   * PURCHASE
   * =========================================================
   */


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
      character
        .shop
        ?.enabled !==
      true
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
            character
              .shop
              ?.price
          ) ||
          0
        )
      );


    const currency =
      String(
        character
          .shop
          ?.currency ||
        ""
      )
        .toUpperCase();


    if (
      currency !==
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


    /*
     * Spend CURRENT SP only.
     *
     * lifetime.spEarned and LEVEL
     * must never decrease.
     */

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


    /*
     * Add permanent local ownership.
     */

    account()
      ?.addSkin
      ?.(
        character.id
      );


    document.dispatchEvent(

      new CustomEvent(

        "lago:character-unlocked",

        {

          detail: {

            id:
              character.id,

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


render();


openCollection();


return true;

}



/*
 * =========================================================
 * EQUIP
 * =========================================================
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



  /*
   * =========================================================
   * CLICK ROUTER
   * =========================================================
   */


  function onPageClick(
    event
  ) {

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


    const equip =
      event.target.closest(
        "[data-shop-equip]"
      );


    if (equip) {

      equipCharacter(
        equip.dataset
          .shopEquip
      );

    }

  }



  /*
   * =========================================================
   * CARD
   * =========================================================
   */


  function characterCard(
    character,
    owned,
    selected,
    balance
  ) {

    const price =
      Math.max(
        0,
        Number(
          character
            .shop
            ?.price
        ) ||
        0
      );


    const canBuy =
      balance >=
      price;


    const playtimeEnabled =
      character
        .playtimeUnlock
        ?.enabled ===
      true;


    const minutes =
      Math.max(
        0,
        Number(
          character
            .playtimeUnlock
            ?.minutes
        ) ||
        0
      );


    const hours =
      minutes > 0
        ? Math.round(
            minutes /
            60
          )
        : 0;


    let actionHTML =
      "";


   if (
  selected
) {

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

    } else if (
  owned
) {

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
            playtimeEnabled &&
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



  /*
   * =========================================================
   * RENDER
   * =========================================================
   */


  function render() {

    create();


    const balance =
      spBalance();


    const balanceElement =
      document.getElementById(
        "lagoShopSP"
      );


    if (balanceElement) {

      balanceElement.textContent =
        formatSP(
          balance
        );

    }


    const dev =
      document.getElementById(
        "lagoShopDev"
      );


    if (dev) {

      dev.hidden =
        !(
          window.LAGO_DEV
            ?.enabled
            ?.() ===
          true
        );

    }


    const grid =
      document.getElementById(
        "lagoShopGrid"
      );


    if (!grid)
      return;

    destroyPreviewHosts(
  grid
);

    const catalog =
      characters();


    const owned =
      ownedSet();


    const current =
      currentCharacterId();


    if (
      catalog.length ===
      0
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
        .join(
          ""
        );

  }

mountPreviewHosts(
  grid
);

  /*
   * =========================================================
   * SHOW / HIDE
   * =========================================================
   */

function show() {

  create();


  /*
   * Show page first so WebGL
   * receives real dimensions.
   */
  document
    .getElementById(
      "lagoShop"
    )
    ?.classList.add(
      "active"
    );


  render();

}


  function hide() {

  const page =
    document.getElementById(
      "lagoShop"
    );


  if (
    !page
  ) {

    return;

  }


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
    "lago:dev-mode",
    render
  );


  document.addEventListener(
    "lago:character-unlocked",
    render
  );

  document.addEventListener(
  "lago:character-3d-ready",
  () => {

    const page =
      document.getElementById(
        "lagoShop"
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



  /*
   * =========================================================
   * PUBLIC API
   * =========================================================
   */


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

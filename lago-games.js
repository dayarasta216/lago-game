(() => {
  "use strict";

  const VERSION = 2;

  let overlay = null;


  const CATALOG = [

    {
      id: "tap-lago",
      name: "TAP LAGO",
      description:
        "Core Lago progression.",
      icon: "snail",
      status: "available",
      dumCost: 0,
      maxRewardSP: 0
    },

    {
      id: "knife-challenge",
      name: "KNIFE CHALLENGE",
      description:
        "Balance, timing and terrible decisions.",
      icon: "knife",
      status: "coming",
      dumCost: 5,
      maxRewardSP: 250
    },

    {
      id: "slowest-race",
      name: "SLOWEST RACE",
      description:
        "Win by being strategically slow.",
      icon: "race",
      status: "coming",
      dumCost: 4,
      maxRewardSP: 200
    },

    {
      id: "brain-loading",
      name: "BRAIN LOADING",
      description:
        "Short logic rounds with Lago rules.",
      icon: "brain",
      status: "coming",
      dumCost: 3,
      maxRewardSP: 150
    },

    {
      id: "miki-greenhouse",
      name: "MIKI'S GREENHOUSE",
      description:
        "Miki's suspicious cartoon greenhouse management game.",
      emoji: "🌿",
      status: "coming",
      dumCost: 5,
      maxRewardSP: 300,

      requiredCharacter:
        "comic_goose"
    }

  ];


  function runtime() {
    return window.LAGO_MINIGAMES || null;
  }


  function registerCatalog() {

    const api =
      runtime();


    if (
      !api ||
      typeof api.register !==
        "function"
    ) {

      return false;

    }


    CATALOG.forEach(
      game => {

        api.register(
          game
        );

      }
    );


    return true;

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
      );

  }


  function gameIcon(game) {

    if (game.icon) {

      return `
        <div
          class="lago-game-card-icon"
          data-lago-icon="${escapeHTML(
            game.icon
          )}"
        ></div>
      `;

    }


    return `
      <div
        class="lago-game-card-icon"
        aria-hidden="true"
      >
        ${escapeHTML(
          game.emoji || "🎮"
        )}
      </div>
    `;

  }


  function cardStatus(
    game,
    context
  ) {

    if (
      game.status !==
      "available"
    ) {

      return "COMING SOON";

    }


    if (
      game.requiredCharacter &&
      game.requiredCharacter !==
        context.characterId
    ) {

      return "CHARACTER LOCKED";

    }


    if (
      game.dumCost >
      context.dum
    ) {

      return "NOT ENOUGH DUM";

    }


    return "AVAILABLE NOW";

  }


  function gameMeta(game) {

    if (
      game.id ===
      "tap-lago"
    ) {

      return "CORE GAME";

    }


    const parts = [];


    if (
      game.dumCost > 0
    ) {

      parts.push(
        `${game.dumCost} DUM / RUN`
      );

    }


    if (
      game.maxRewardSP > 0
    ) {

      parts.push(
        `UP TO ${game.maxRewardSP} SP`
      );

    }


    return parts.join(
      " · "
    );

  }


  function gameCard(
    game,
    context
  ) {

    const available =
      game.status ===
        "available" &&
      (
        !game.requiredCharacter ||
        game.requiredCharacter ===
          context.characterId
      ) &&
      game.dumCost <=
        context.dum;


    return `
      <article
        class="lago-game-card ${
          available
            ? ""
            : "coming"
        }"
      >

        <div>

          ${gameIcon(
            game
          )}

          <div
            class="lago-game-card-name"
          >
            ${escapeHTML(
              game.name
            )}
          </div>

          <div
            class="lago-game-card-status"
          >
            ${escapeHTML(
              cardStatus(
                game,
                context
              )
            )}
          </div>

          <div
            class="lago-game-card-copy"
          >
            ${escapeHTML(
              game.description
            )}
          </div>

          <div
            class="lago-game-card-meta"
          >
            ${escapeHTML(
              gameMeta(
                game
              )
            )}
          </div>

        </div>


        <button
          type="button"
          data-game-open="${escapeHTML(
            game.id
          )}"
          ${
            available
              ? ""
              : "disabled"
          }
        >
          ${
            available
              ? "PLAY"
              : "COMING SOON"
          }
        </button>

      </article>
    `;

  }


  function create() {

    if (overlay) {
      return overlay;
    }


    const style =
      document.createElement(
        "style"
      );


    style.textContent = `

      #lagoGamesOverlay {
        position: fixed;
        inset: 0;

        z-index: 20000;

        display: none;

        overflow-y: auto;

        padding:
          calc(24px + env(safe-area-inset-top))
          20px
          calc(30px + env(safe-area-inset-bottom));

        background:
          #08040a;

        color:
          white;

        font-family:
          Inter,
          system-ui,
          sans-serif;
      }


      #lagoGamesOverlay.active {
        display: block;
      }


      .lago-games-shell {
        width:
          min(1100px,100%);

        margin:
          0 auto;
      }


      .lago-games-header {
        display: flex;

        justify-content:
          space-between;

        align-items:
          flex-start;

        gap:
          20px;

        margin-bottom:
          18px;
      }


      .lago-games-title {
        font-size:
          clamp(34px,6vw,64px);

        font-weight:
          1000;

        letter-spacing:
          -.06em;
      }


      .lago-games-subtitle {
        margin-top:
          7px;

        color:
          rgba(255,255,255,.46);

        font-size:
          11px;

        font-weight:
          800;
      }


      .lago-games-context {
        margin-bottom:
          18px;

        padding:
          11px 13px;

        border:
          1px solid
          rgba(204,255,0,.16);

        border-radius:
          13px;

        color:
          #ccff00;

        background:
          rgba(204,255,0,.045);

        font-size:
          10px;

        font-weight:
          900;
      }


      .lago-games-close {
        width: 44px;
        height: 44px;

        flex:
          0 0 44px;

        border-radius:
          50%;

        border:
          1px solid
          rgba(255,255,255,.12);

        background:
          rgba(255,255,255,.06);

        color:
          white;

        cursor:
          pointer;
      }


      .lago-games-grid {
        display:
          grid;

        grid-template-columns:
          repeat(
            auto-fit,
            minmax(220px,1fr)
          );

        gap:
          14px;
      }


      .lago-game-card {
        min-height:
          250px;

        padding:
          18px;

        display:
          flex;

        flex-direction:
          column;

        justify-content:
          space-between;

        border-radius:
          22px;

        border:
          1px solid
          rgba(255,255,255,.09);

        background:
          rgba(255,255,255,.045);
      }


      .lago-game-card-icon {
        min-height:
          54px;

        display:
          flex;

        align-items:
          center;

        font-size:
          48px;
      }


      .lago-game-card-name {
        margin-top:
          15px;

        font-size:
          20px;

        font-weight:
          900;
      }


      .lago-game-card-status {
        margin-top:
          6px;

        color:
          #ccff00;

        font-size:
          10px;

        font-weight:
          900;
      }


      .lago-game-card-copy {
        min-height:
          34px;

        margin-top:
          8px;

        color:
          rgba(255,255,255,.48);

        font-size:
          10px;

        font-weight:
          700;

        line-height:
          1.45;
      }


      .lago-game-card-meta {
        margin-top:
          10px;

        color:
          rgba(255,255,255,.30);

        font-size:
          8px;

        font-weight:
          900;

        letter-spacing:
          .06em;
      }


      .lago-game-card button {
        width:
          100%;

        margin-top:
          18px;

        padding:
          12px;

        border:
          0;

        border-radius:
          12px;

        background:
          #ccff00;

        color:
          #130614;

        font-weight:
          1000;

        cursor:
          pointer;
      }


      .lago-game-card.coming {
        opacity:
          .52;
      }


      .lago-game-card button:disabled {
        background:
          rgba(255,255,255,.1);

        color:
          rgba(255,255,255,.5);

        cursor:
          default;
      }


      @media (
        max-width:
        560px
      ) {

        #lagoGamesOverlay {
          padding:
            calc(
              14px +
              env(safe-area-inset-top)
            )
            12px
            calc(
              22px +
              env(safe-area-inset-bottom)
            );
        }


        .lago-games-grid {
          grid-template-columns:
            1fr;
        }


        .lago-game-card {
          min-height:
            220px;
        }

      }

    `;


    document.head.appendChild(
      style
    );


    overlay =
      document.createElement(
        "div"
      );


    overlay.id =
      "lagoGamesOverlay";


    overlay.innerHTML = `

      <div class="lago-games-shell">

        <div class="lago-games-header">

          <div>

            <div class="lago-games-title">
              GAMES
            </div>

            <div class="lago-games-subtitle">
              SP · DUM · CHARACTER PROGRESSION
            </div>

          </div>


          <button
            class="lago-games-close lago-overlay-close"
            id="lagoGamesClose"
            type="button"
            aria-label="Close"
          >
            <span
              class="lago-icon-slot"
              data-lago-icon="close"
            ></span>
          </button>

        </div>


        <div
          class="lago-games-context"
          id="lagoGamesContext"
        ></div>


        <div
          class="lago-games-grid"
          id="lagoGamesGrid"
        ></div>

      </div>

    `;


    document.body.appendChild(
      overlay
    );


    window.LAGO_UI
      ?.hydrate
      ?.(
        overlay
      );


    overlay
      .querySelector(
        "#lagoGamesClose"
      )
      ?.addEventListener(
        "click",
        hide
      );


    overlay.addEventListener(
      "click",
      event => {

        const button =
          event.target.closest(
            "[data-game-open]"
          );


        if (
          !button ||
          button.disabled
        ) {

          return;

        }


        const id =
          button.dataset
            .gameOpen;


        /*
         * Tap Lago is already the
         * main PLAY screen.
         */
        if (
          id ===
          "tap-lago"
        ) {

          hide();

          return;

        }


        const result =
          runtime()
            ?.open
            ?.(id);


        if (
          result?.ok ===
          true
        ) {

          hide();

        }

      }
    );


    return overlay;

  }


  function render() {

    create();


    const api =
      runtime();


    if (!api) {
      return;
    }


    const context =
      api.getContext();


    const contextElement =
      overlay.querySelector(
        "#lagoGamesContext"
      );


    if (contextElement) {

      contextElement.textContent =

        `${context.characterName} · ` +

        `${context.dum}/${context.dumMax} DUM · ` +

        `${Math.floor(
          context.sp
        ).toLocaleString(
          "en-US"
        )} SP`;

    }


    const grid =
      overlay.querySelector(
        "#lagoGamesGrid"
      );


    if (grid) {

      grid.innerHTML =
        api.list()
          .map(
            game =>
              gameCard(
                game,
                context
              )
          )
          .join("");

    }


    window.LAGO_UI
      ?.hydrate
      ?.(
        overlay
      );


    window.LAGO_LANGUAGE
      ?.translateDOM
      ?.(
        overlay
      );

  }


  function show() {

    create();

    render();


    overlay.classList.add(
      "active"
    );

  }


  function hide() {

    overlay
      ?.classList.remove(
        "active"
      );

  }


  document.addEventListener(
    "lago:mini-game-registry",
    () => {

      if (
        overlay
          ?.classList.contains(
            "active"
          )
      ) {

        render();

      }

    }
  );


  document.addEventListener(
    "lago:state",
    () => {

      if (
        overlay
          ?.classList.contains(
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


  registerCatalog();


  window.LAGO_GAMES =
    Object.freeze({

      version:
        VERSION,

      show,

      hide,

      render

    });

})();

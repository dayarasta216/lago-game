(() => {
  "use strict";


const VERSION = 73;
  
let overlay = null;


/*
 * Mini-games are loaded only when
 * the player actually opens them.
 */
const gameModulePromises =
  new Map();



const GAME_MODULES = Object.freeze({});

const CATALOG = [
  {
    id: "shell-out",
    name: "SHELL OUT",
    description: "Block puzzle. Build lines and collect points.",
    emoji: "🧩",
    status: "coming",
    dumCost: 0,
    maxRewardSP: 0
  },
  {
    id: "spiral-idiot",
    name: "SPIRAL IDIOT",
    description: "Arrow escape puzzle.",
    emoji: "🌀",
    status: "coming",
    dumCost: 0,
    maxRewardSP: 0
  },
  {
    id: "snail-jam",
    name: "SNAIL JAM",
    description: "Sort colorful slime.",
    emoji: "🎨",
    status: "coming",
    dumCost: 0,
    maxRewardSP: 0
  },
  {
    id: "lago-mines",
    name: "LAGO MINES",
    description: "Classic minesweeper.",
    emoji: "💣",
    status: "coming",
    dumCost: 0,
    maxRewardSP: 0
  },
  {
    id: "lago-snake",
    name: "LAGO SNAKE",
    description: "Classic snake arcade.",
    emoji: "🐍",
    status: "coming",
    dumCost: 0,
    maxRewardSP: 0
  },
  {
    id: "shell-2048",
    name: "SHELL 2048",
    description: "Merge tiles and beat your record.",
    emoji: "🔢",
    status: "coming",
    dumCost: 0,
    maxRewardSP: 0
  },
  {
    id: "lago-cannon",
    name: "LAGO CANNON",
    description: "Aim, launch and hit targets.",
    emoji: "🎯",
    status: "coming",
    dumCost: 0,
    maxRewardSP: 0
  },
  {
    id: "slime-sand",
    name: "SLIME SAND",
    description: "Relaxing sand physics puzzle.",
    emoji: "⏳",
    status: "coming",
    dumCost: 0,
    maxRewardSP: 0
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


 
  const GAME_ICONS = Object.freeze({

    "shell-out": {
      color: "#D1FA65",
      path: "M5 5h7v7H5z M14 5h5v7h-5z M5 14h7v5H5z M14 14h5v5h-5z"
    },

    "spiral-idiot": {
      color: "#A997FF",
      path: "M3 6h15l-4-4 M18 6l-4 4 M21 12H6l4-4 M6 12l4 4 M3 18h15l-4-4 M18 18l-4 4"
    },

    "snail-jam": {
      color: "#F472B6",
      path: "M5 3h4 M6 3v15a2 2 0 0 0 4 0V3 M15 3h4 M14 3v15a3 3 0 0 0 6 0V3 M6 12h4 M14 8h6 M14 14h6"
    },

    "lago-mines": {
      color: "#FB923C",
      path: "M12 5a7 7 0 1 0 0 14 7 7 0 0 0 0-14 M12 2v3 M12 19v3 M2 12h3 M19 12h3 M5 5l2 2 M17 17l2 2 M19 5l-2 2 M5 19l2-2 M9 10h2"
    },

    "lago-snake": {
      color: "#4ADE80",
      path: "M4 20V8a4 4 0 0 1 8 0v8a4 4 0 0 0 8 0V4 M17 4h6 M17 7h6"
    },

    "shell-2048": {
      color: "#60A5FA",
      path: "M3 3h18v18H3z M12 3v18 M3 12h18 M6 6h3v3H6z M15 15h3v3h-3z"
    },

    "lago-cannon": {
      color: "#FACC15",
      path: "M3 15l10-10 5 5-10 10z M13 5l3-3 5 5-3 3 M3 21h18 M19 2h2"
    },

    "slime-sand": {
      color: "#2DD4BF",
      path: "M5 3h14 M5 21h14 M7 3v4l10 10v4 M17 3v4L7 17v4 M10 6h4 M10 18h4"
    }

  });

  function gameIcon(game) {

    const icon = Object.hasOwn(
      GAME_ICONS,
      game.id
    )
      ? GAME_ICONS[game.id]
      : {
          color: "#A1A8B6",
          path: "M4 7h16v10H4z M7 12h6 M10 9v6 M16 10h1 M18 14h1"
        };

    return `
      <div
        class="lago-game-card-icon"
        style="color:${icon.color}"
        aria-hidden="true"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="42"
          height="42"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.6"
          stroke-linecap="round"
          stroke-linejoin="round"
          focusable="false"
          aria-hidden="true"
        >
          <path d="${icon.path}"/>
        </svg>
      </div>
    `;

  }


  
  /*
   * R1.7A — Unified game catalog status.
   */

  function cardStatus(game, context) {

    if (game.status !== "available") {
      return "COMING SOON";
    }

    if (
      game.requiredCharacter &&
      game.requiredCharacter !== context.characterId
    ) {
      return "CHARACTER LOCKED";
    }

    if (
      Number(game.dumCost || 0) >
      Number(context.dum || 0)
    ) {
      return "NOT ENOUGH DUM";
    }

    return "AVAILABLE";

  }

  
  /*
   * R1.7D — Game rewards and account statistics.
   */

  function formatGameNumber(value) {

    const n = Number(value);

    return Math.max(
      0,
      Number.isFinite(n) ? n : 0
    ).toLocaleString("en-US", {
      maximumFractionDigits: 2
    });

  }

  function gameMeta(game, stats = {}) {

    if (game.status !== "available") {
      return "IN DEVELOPMENT";
    }

    const parts = [];

    const cost = Math.max(
      0,
      Number(game.dumCost) || 0
    );

    const reward = Math.max(
      0,
      Number(game.maxRewardSP) || 0
    );

    parts.push(
      cost > 0
        ? `${formatGameNumber(cost)} DUM / RUN`
        : "FREE TO PLAY"
    );

    parts.push(
      reward > 0
        ? `UP TO ${formatGameNumber(reward)} SP`
        : "NO SP REWARD"
    );

    return parts.join(" · ");

  }

  function gameStats(game, stats = {}) {

    if (game.status !== "available") {
      return "";
    }

    const items = [

      {
        label: "PLAYED",
        value: stats.plays
      },

      {
        label: "BEST SCORE",
        value: stats.bestScore
      },

      {
        label: "SP EARNED",
        value: stats.spEarned
      }

    ];

    return `
      <div class="lg-game-statistics">
        ${items.map(item => `
          <div class="lg-game-stat">
            <span>
              ${escapeHTML(item.label)}
            </span>
            <strong>
              ${formatGameNumber(item.value)}
            </strong>
          </div>
        `).join("")}
      </div>
    `;

  }




  function buttonLabel(
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

      return "SELECT CHARACTER";

    }


    if (
      game.dumCost >
      context.dum
    ) {

      return "NEED DUM";

    }


    return "PLAY";

  }


    function gameCard(
    game,
    context
  ) {

    const stats =
      runtime()
        ?.getStats
        ?.(
          game.id
        ) || {};


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


      /* R1.7D — Borderless game statistics */

      .lg-game-statistics {
        display: grid;

        grid-template-columns:
          repeat(3, minmax(0, 1fr));

        gap: 6px;

        margin-top: 16px;
        padding: 4px 0;
      }

      .lg-game-stat {
        display: flex;
        flex-direction: column;

        min-width: 0;
        gap: 5px;

        background: transparent;
        border: none;
        box-shadow: none;
      }

      .lg-game-stat span {
        color: var(--lg-text-muted, #858e9e);

        font-size: 8px;
        font-weight: 650;
        line-height: 1.4;
      }

      .lg-game-stat strong {
        color: var(--lg-text, #f4f6fa);

        font-size: 15px;
        font-weight: 750;

        font-variant-numeric: tabular-nums;
        overflow-wrap: anywhere;
      }

      @media (max-width: 600px) {

        .lg-game-statistics {
          gap: 4px;
        }

        .lg-game-stat strong {
          font-size: 12px;
        }

        .lg-game-stat span {
          font-size: 7px;
        }

      }



          <div
            class="lago-game-card-meta"
          >
            ${escapeHTML(
              gameMeta(
                game,
                stats
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
          ${buttonLabel(
            game,
            context
          )}
        </button>

      </article>
    `;

  }

    async function ensureGameModule(
    gameId
  ) {

    const key =
      String(
        gameId || ""
      ).trim();


    const module =
      GAME_MODULES[
        key
      ];


    /*
     * Games without a separate module
     * do not need lazy loading.
     */
    if (!module) {
      return true;
    }


    if (
      module.ready()
    ) {

      return true;

    }


    /*
     * Never start several imports of
     * the same game from double taps.
     */
    if (
      !gameModulePromises.has(
        key
      )
    ) {

      const promise =
        module
          .load()
          .then(
            () => {

              if (
                !module.ready()
              ) {

                throw new Error(
                  `${key} module loaded but did not become ready`
                );

              }


              return true;

            }
          )
          .catch(
            error => {

              /*
               * Allow RETRY after a
               * failed network/module load.
               */
              gameModulePromises
                .delete(
                  key
                );


              throw error;

            }
          );


      gameModulePromises.set(
        key,
        promise
      );

    }


    return gameModulePromises
      .get(
        key
      );

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

      /* R1.7C — Premium borderless game catalog */

      #lagoGamesOverlay {
        position: fixed;
        inset: 0;
        z-index: 20000;

        display: none;
        box-sizing: border-box;

        overflow-x: hidden;
        overflow-y: auto;

        overscroll-behavior: contain;

        padding:
          calc(24px + env(safe-area-inset-top))
          24px
          calc(30px + env(safe-area-inset-bottom));

        background: var(--lg-bg, #090b10);
        color: var(--lg-text, #f4f6fa);

        font-family:
          var(--lg-font, system-ui, sans-serif);

        -webkit-overflow-scrolling: touch;
      }

      #lagoGamesOverlay.active {
        display: block;
      }

      #lagoGamesOverlay *,
      #lagoGamesOverlay *::before,
      #lagoGamesOverlay *::after {
        box-sizing: border-box;
      }

      .lago-games-shell {
        width: min(1100px, 100%);
        margin: 0 auto;
      }

      .lago-games-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;

        gap: 16px;
        margin-bottom: 20px;
      }

      .lago-games-title {
        font-size: clamp(28px, 5vw, 42px);
        font-weight: 850;
        letter-spacing: -.045em;
        line-height: 1.1;
      }

      .lago-games-subtitle {
        margin-top: 7px;

        color: var(--lg-text-secondary, #a1a8b6);

        font-size: 11px;
        font-weight: 600;
        letter-spacing: .06em;
      }

      .lago-games-context {
        margin-bottom: 24px;
        padding: 6px 0;

        background: transparent;
        border: none;
        box-shadow: none;

        color: var(--lg-ai, #a997ff);

        font-size: 11px;
        font-weight: 650;
        line-height: 1.6;
        overflow-wrap: anywhere;
      }

      .lago-games-close {
        display: grid;
        place-items: center;

        width: 44px;
        height: 44px;
        flex: 0 0 44px;

        border: 1px solid var(--lg-border, #282e39);
        border-radius: 12px;

        background: var(--lg-surface, #141821);
        color: var(--lg-text, #f4f6fa);

        cursor: pointer;
        touch-action: manipulation;
      }

      .lago-games-grid {
        display: grid;

        grid-template-columns:
          repeat(4, minmax(0, 1fr));

        column-gap: 24px;
        row-gap: 32px;
      }

      .lago-game-card {
        display: flex;
        flex-direction: column;
        justify-content: space-between;

        gap: 12px;

        min-width: 0;
        min-height: 200px;

        padding: 12px 4px;

        border: none;
        border-radius: 0;

        background: transparent;
        box-shadow: none;
      }

      .lago-game-card-icon {
        display: flex;
        align-items: center;

        min-height: 48px;
        margin-bottom: 12px;
      }

      .lago-game-card-icon svg {
        display: block;
        width: 42px;
        height: 42px;

        flex-shrink: 0;
        pointer-events: none;
      }

      .lago-game-card-name {
        color: var(--lg-text, #f4f6fa);

        font-size: 17px;
        font-weight: 800;

        letter-spacing: -.025em;
        line-height: 1.25;
        overflow-wrap: anywhere;
      }

      .lago-game-card-status {
        margin-top: 6px;

        color: var(--lg-success, #4ade80);

        font-size: 9px;
        font-weight: 700;
        letter-spacing: .05em;
      }

      .lago-game-card-copy {
        margin-top: 9px;

        color: var(--lg-text-secondary, #a1a8b6);

        font-size: 12px;
        font-weight: 450;
        line-height: 1.5;
      }

      .lago-game-card-meta {
        margin-top: 10px;

        color: var(--lg-text-muted, #858e9e);

        font-size: 10px;
        font-weight: 600;

        line-height: 1.5;
      }

      .lago-game-card button {
        width: 100%;
        min-height: 44px;

        margin-top: auto;
        padding: 10px;

        border: 1px solid var(--lg-accent, #d1fa65);
        border-radius: 10px;

        background: var(--lg-accent, #d1fa65);
        color: var(--lg-on-accent, #11170b);

        font-family: inherit;
        font-size: 11px;
        font-weight: 750;

        cursor: pointer;
        touch-action: manipulation;
      }

      .lago-game-card.coming {
        opacity: 1;
      }

      .lago-game-card.coming
      .lago-game-card-status {
        color: var(--lg-text-muted, #858e9e);
      }

      .lago-game-card button:disabled {
        background: var(--lg-surface, #141821);

        border-color:
          var(--lg-border, #282e39);

        color: var(--lg-text-muted, #858e9e);

        cursor: default;
      }

      #lagoGamesOverlay button:focus-visible {
        outline: 2px solid var(--lg-ai, #a997ff);
        outline-offset: 3px;
      }

      @media (hover: hover) and (pointer: fine) {

        .lago-games-close:hover {
          background: var(--lg-surface-hover, #292f3c);
        }

        .lago-game-card button:not(:disabled):hover {
          filter: brightness(1.08);
        }

      }

      @media (max-width: 899px) {

        .lago-games-grid {
          grid-template-columns:
            repeat(3, minmax(0, 1fr));

          column-gap: 18px;
          row-gap: 24px;
        }

      }

      @media (max-width: 600px) {

        #lagoGamesOverlay {
          padding:
            calc(16px + env(safe-area-inset-top))
            16px
            calc(24px + env(safe-area-inset-bottom));
        }

        .lago-games-grid {
          grid-template-columns:
            repeat(2, minmax(0, 1fr));

          column-gap: 16px;
          row-gap: 22px;
        }

        .lago-game-card {
          min-height: 190px;
          padding: 6px 0;
        }

        .lago-game-card-name {
          font-size: 14px;
        }

        .lago-game-card-icon svg {
          width: 36px;
          height: 36px;
        }

        .lago-game-card-copy {
          font-size: 11px;
        }

        .lago-games-context {
          margin-bottom: 16px;
        }

      }

      @media (max-width: 320px) {

        .lago-games-grid {
          grid-template-columns: minmax(0, 1fr);
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
      async event => {

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
         * TAP LAGO already lives on
         * the main PLAY screen.
         */
        if (
          id ===
          "tap-lago"
        ) {

          hide();

          return;

        }


        const originalText =
          button.textContent;


        button.disabled =
          true;


        button.textContent =
          "LOADING";


        try {

          /*
           * Important:
           *
           * Wait until the mini-game
           * module has EXECUTED and
           * installed its event listener
           * before runtime.open()
           * dispatches the open event.
           */
          await ensureGameModule(
            id
          );


          const result =
            runtime()
              ?.open
              ?.(id);


          if (
            result?.ok ===
            true
          ) {

            hide();

            return;

          }


          console.warn(
            "[LAGO GAMES] Game cannot open:",
            id,
            result
          );


          button.textContent =
            result?.reason ===
            "dum"

              ? "NEED DUM"

              : "RETRY";

        } catch (
          error
        ) {

          console.error(
            "[LAGO GAMES] Module load failed:",
            id,
            error
          );


          button.textContent =
            "RETRY";

        } finally {

          /*
           * If the game opened,
           * Games Hub is already hidden.
           *
           * Otherwise restore the button
           * so player can retry.
           */
          if (
            button.isConnected
          ) {

            button.disabled =
              false;


            if (
              button.textContent ===
              "LOADING"
            ) {

              button.textContent =
                originalText;

            }

          }

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
    "lago:account-state",
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

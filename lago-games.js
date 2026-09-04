(() => {
  "use strict";

  let overlay = null;


  function t(text) {

    return (
      window.LAGO_LANGUAGE
        ?.translate
        ?.(text) ??
      text
    );

  }


  function create() {

    if (overlay) {
      return;
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
          rgba(8,4,10,.96);

        backdrop-filter:
          blur(24px);

        color: white;

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

        align-items: center;

        gap: 20px;

        margin-bottom: 24px;
      }


      .lago-games-title {

        font-size:
          clamp(34px,6vw,64px);

        font-weight: 1000;

        letter-spacing: -.06em;
      }


      .lago-games-close {

        width: 44px;
        height: 44px;

        border-radius: 50%;

        border:
          1px solid
          rgba(255,255,255,.12);

        background:
          rgba(255,255,255,.06);

        color: white;

        cursor: pointer;
      }


      .lago-games-grid {

        display: grid;

        grid-template-columns:
          repeat(
            auto-fit,
            minmax(220px,1fr)
          );

        gap: 14px;
      }


      .lago-game-card {

        min-height: 210px;

        padding: 18px;

        display: flex;

        flex-direction: column;

        justify-content:
          space-between;

        border-radius: 22px;

        border:
          1px solid
          rgba(255,255,255,.09);

        background:
          rgba(255,255,255,.045);
      }


      .lago-game-card-icon {
        font-size: 54px;
      }


      .lago-game-card-name {

        margin-top: 15px;

        font-size: 20px;
        font-weight: 900;
      }


      .lago-game-card-status {

        margin-top: 6px;

        color:
          rgba(255,255,255,.45);

        font-size: 11px;
      }


      .lago-game-card button {

        width: 100%;

        margin-top: 18px;

        padding: 12px;

        border: 0;

        border-radius: 12px;

        background: #ccff00;

        color: #130614;

        font-weight: 1000;

        cursor: pointer;
      }


      .lago-game-card.coming {

        opacity: .46;
      }


      .lago-game-card.coming button {

        background:
          rgba(255,255,255,.1);

        color:
          rgba(255,255,255,.5);

        cursor: default;
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

            <div>
  Spend DUM Energy.
  Earn SP.
  Play together.
</div>

          </div>

         <button
  class="lago-games-close lago-overlay-close"
  id="lagoGamesClose"
  aria-label="Close"
>
  <span
    class="lago-icon-slot"
    data-lago-icon="close"
  ></span>
</button>
        </div>


        <div class="lago-games-grid">

          <article class="lago-game-card">

            <div>

              <div
  class="lago-game-card-icon"
  data-lago-icon="snail"
></div>

              <div class="lago-game-card-name">
                TAP LAGO
              </div>

              <div class="lago-game-card-status">
                AVAILABLE NOW
              </div>

            </div>

            <button
  id="lagoGamesTap"
  class="lago-vector-button"
>
  <span
    class="lago-icon-slot"
    data-lago-icon="play"
  ></span>

  <span>
    PLAY
  </span>
</button>

          </article>


          <article class="lago-game-card coming">

            <div>

             <div
  class="lago-game-card-icon"
  data-lago-icon="knife"
></div>

              <div class="lago-game-card-name">
                KNIFE CHALLENGE
              </div>

              <div class="lago-game-card-status">
                COMING SOON
              </div>

            </div>

            <button>
              COMING SOON
            </button>

          </article>


          <article class="lago-game-card coming">

            <div>

              <div
  class="lago-game-card-icon"
  data-lago-icon="race"
></div>

              <div class="lago-game-card-name">
                SLOWEST RACE
              </div>

              <div class="lago-game-card-status">
                COMING SOON
              </div>

            </div>

            <button>
              COMING SOON
            </button>

          </article>


          <article class="lago-game-card coming">

            <div>

              <div
  class="lago-game-card-icon"
  data-lago-icon="brain"
></div>

              <div class="lago-game-card-name">
                BRAIN LOADING
              </div>

              <div class="lago-game-card-status">
                COMING SOON
              </div>

            </div>

            <button>
              COMING SOON
            </button>

          </article>

        </div>

      </div>

    `;

window.LAGO_LANGUAGE
  ?.translateDOM
  ?.(overlay);
    document.body.appendChild(
      overlay
    );

window.LAGO_UI
  ?.hydrate
  ?.(overlay);
    overlay
      .querySelector(
        "#lagoGamesClose"
      )
      ?.addEventListener(
        "click",
        hide
      );


    overlay
      .querySelector(
        "#lagoGamesTap"
      )
      ?.addEventListener(
        "click",
        hide
      );


    window.LAGO_LANGUAGE
      ?.translateDOM
      ?.(overlay);

  }


  function show() {

    create();

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


  window.LAGO_GAMES = {
    show,
    hide
  };

})();

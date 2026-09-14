(() => {
  "use strict";

  const VERSION = 1;
  const GAME_ID = "knife-challenge";
  const TOTAL_ROUNDS = 8;
  const STARTING_LIVES = 3;
  const ROUND_TIMEOUT_MS = 4200;

  let overlay = null;
  let phase = "closed";
  let sessionId = "";
  let context = null;
  let round = 0;
  let lives = STARTING_LIVES;
  let score = 0;
  let targetCenter = 50;
  let targetWidth = 24;
  let markerPosition = 0;
  let roundStartedAt = 0;
  let frameId = 0;
  let roundTimer = 0;

  const runtime =
    () =>
      window.LAGO_MINIGAMES ||
      null;

  const game =
    () =>
      runtime()
        ?.get
        ?.(
          GAME_ID
        ) ||
      null;

  const element =
    id =>
      overlay
        ?.querySelector(
          `#${id}`
        ) ||
      null;


  function create() {

    if (overlay) {
      return overlay;
    }


    const style =
      document.createElement(
        "style"
      );


    style.textContent = `

      #lagoKnifeGame {

        position:
          fixed;

        inset:
          0;

        z-index:
          22000;

        display:
          none;

        overflow-y:
          auto;

        padding:
          calc(
            16px +
            env(safe-area-inset-top)
          )
          14px
          calc(
            20px +
            env(safe-area-inset-bottom)
          );

        background:
          #08040a;

        color:
          #fff;

        font-family:
          Inter,
          system-ui,
          sans-serif;

      }


      #lagoKnifeGame.active {

        display:
          block;

      }


      .lago-knife-shell {

        width:
          min(
            900px,
            100%
          );

        min-height:
          calc(
            100dvh -
            40px
          );

        margin:
          0 auto;

        display:
          flex;

        flex-direction:
          column;

      }


      .lago-knife-header {

        display:
          flex;

        align-items:
          flex-start;

        justify-content:
          space-between;

        gap:
          16px;

      }


      .lago-knife-title {

        font-size:
          clamp(
            30px,
            6vw,
            58px
          );

        font-weight:
          1000;

        letter-spacing:
          -.06em;

      }


      .lago-knife-subtitle {

        margin-top:
          4px;

        color:
          rgba(
            255,
            255,
            255,
            .42
          );

        font-size:
          10px;

        font-weight:
          900;

      }


      .lago-knife-close {

        width:
          44px;

        height:
          44px;

        flex:
          0 0 44px;

        border:
          1px solid
          rgba(
            255,
            255,
            255,
            .14
          );

        border-radius:
          50%;

        background:
          rgba(
            255,
            255,
            255,
            .06
          );

        color:
          #fff;

        cursor:
          pointer;

      }


      .lago-knife-hud {

        margin-top:
          14px;

        display:
          grid;

        grid-template-columns:
          repeat(
            4,
            minmax(
              0,
              1fr
            )
          );

        gap:
          8px;

      }


      .lago-knife-hud-item {

        padding:
          10px 12px;

        border:
          1px solid
          rgba(
            255,
            255,
            255,
            .08
          );

        border-radius:
          12px;

        background:
          rgba(
            255,
            255,
            255,
            .035
          );

      }


      .lago-knife-hud-label {

        color:
          rgba(
            255,
            255,
            255,
            .34
          );

        font-size:
          8px;

        font-weight:
          900;

      }


      .lago-knife-hud-value {

        margin-top:
          3px;

        color:
          #ccff00;

        font-size:
          15px;

        font-weight:
          1000;

      }


      .lago-knife-stage {

        position:
          relative;

        flex:
          1;

        min-height:
          430px;

        margin-top:
          14px;

        overflow:
          hidden;

        border:
          1px solid
          rgba(
            255,
            255,
            255,
            .08
          );

        border-radius:
          24px;

        background:
          radial-gradient(
            circle at 50% 34%,
            rgba(
              204,
              255,
              0,
              .07
            ),
            transparent
            34%
          ),
          rgba(
            255,
            255,
            255,
            .025
          );

      }


      .lago-knife-character {

        position:
          absolute;

        top:
          24px;

        left:
          50%;

        width:
          min(
            260px,
            58vw
          );

        height:
          190px;

        transform:
          translateX(
            -50%
          );

      }


      .lago-knife-character img,
      .lago-knife-character
      .lago-glb-preview-image {

        width:
          100%;

        height:
          100%;

        object-fit:
          contain;

      }


      .lago-knife-blade-wrap {

        position:
          absolute;

        left:
          7%;

        right:
          7%;

        bottom:
          105px;

        height:
          90px;

      }


      .lago-knife-blade {

        position:
          absolute;

        left:
          0;

        right:
          0;

        top:
          38px;

        height:
          18px;

        background:
          linear-gradient(
            180deg,
            #f4f4f4 0%,
            #8c8c8c 58%,
            #333 100%
          );

        clip-path:
          polygon(
            0 42%,
            92% 0,
            100% 50%,
            92% 100%,
            0 58%
          );

        box-shadow:
          0 12px 30px
          rgba(
            0,
            0,
            0,
            .48
          );

      }


      .lago-knife-target {

        position:
          absolute;

        top:
          18px;

        height:
          58px;

        border:
          2px solid
          #ccff00;

        border-radius:
          10px;

        background:
          rgba(
            204,
            255,
            0,
            .12
          );

        transform:
          translateX(
            -50%
          );

        pointer-events:
          none;

      }


      .lago-knife-marker {

        position:
          absolute;

        top:
          8px;

        width:
          4px;

        height:
          76px;

        border-radius:
          999px;

        background:
          #fff;

        transform:
          translateX(
            -50%
          );

        box-shadow:
          0 0 18px
          rgba(
            255,
            255,
            255,
            .5
          );

        pointer-events:
          none;

      }


      .lago-knife-feedback {

        position:
          absolute;

        left:
          50%;

        bottom:
          58px;

        transform:
          translateX(
            -50%
          );

        min-height:
          24px;

        color:
          #fff;

        font-size:
          14px;

        font-weight:
          1000;

        text-align:
          center;

      }


      .lago-knife-tap {

        position:
          absolute;

        left:
          50%;

        bottom:
          18px;

        transform:
          translateX(
            -50%
          );

        width:
          min(
            360px,
            86%
          );

        padding:
          14px 18px;

        border:
          0;

        border-radius:
          14px;

        background:
          #ccff00;

        color:
          #130614;

        font-size:
          13px;

        font-weight:
          1000;

        cursor:
          pointer;

      }


      .lago-knife-panel {

        position:
          absolute;

        inset:
          0;

        z-index:
          5;

        display:
          grid;

        place-items:
          center;

        padding:
          24px;

        background:
          rgba(
            8,
            4,
            10,
            .88
          );

        backdrop-filter:
          blur(
            10px
          );

      }


      .lago-knife-panel[
        hidden
      ] {

        display:
          none !important;

      }


      .lago-knife-panel-card {

        width:
          min(
            460px,
            100%
          );

        padding:
          24px;

        border:
          1px solid
          rgba(
            255,
            255,
            255,
            .10
          );

        border-radius:
          22px;

        background:
          #120812;

        text-align:
          center;

      }


      .lago-knife-panel-title {

        font-size:
          25px;

        font-weight:
          1000;

      }


      .lago-knife-panel-copy {

        margin-top:
          9px;

        color:
          rgba(
            255,
            255,
            255,
            .52
          );

        font-size:
          11px;

        font-weight:
          700;

        line-height:
          1.5;

      }


      .lago-knife-panel-result {

        margin-top:
          14px;

        color:
          #ccff00;

        font-size:
          17px;

        font-weight:
          1000;

      }


      .lago-knife-panel-actions {

        margin-top:
          18px;

        display:
          grid;

        gap:
          8px;

      }


      .lago-knife-panel-actions
      button {

        padding:
          13px 16px;

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


      .lago-knife-panel-actions
      button.secondary {

        border:
          1px solid
          rgba(
            255,
            255,
            255,
            .10
          );

        background:
          rgba(
            255,
            255,
            255,
            .06
          );

        color:
          #fff;

      }


      @media (
        max-width:
        560px
      ) {

        .lago-knife-hud {

          grid-template-columns:
            repeat(
              2,
              minmax(
                0,
                1fr
              )
            );

        }


        .lago-knife-stage {

          min-height:
            500px;

        }


        .lago-knife-character {

          top:
            34px;

          height:
            210px;

        }


        .lago-knife-blade-wrap {

          bottom:
            126px;

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
      "lagoKnifeGame";


    overlay.innerHTML = `

      <div
        class="lago-knife-shell"
      >

        <header
          class="lago-knife-header"
        >

          <div>

            <div
              class="lago-knife-title"
            >
              KNIFE CHALLENGE
            </div>

            <div
              class="lago-knife-subtitle"
            >
              TAP WHEN THE WHITE LINE IS INSIDE THE LIME ZONE
            </div>

          </div>


          <button
            type="button"
            class="
              lago-knife-close
              lago-overlay-close
            "
            id="lagoKnifeClose"
            aria-label="Close"
          >
            <span
              class="lago-icon-slot"
              data-lago-icon="close"
            ></span>
          </button>

        </header>


        <div
          class="lago-knife-hud"
        >

          <div
            class="lago-knife-hud-item"
          >
            <div
              class="lago-knife-hud-label"
            >
              CHARACTER
            </div>

            <div
              class="lago-knife-hud-value"
              id="lagoKnifeCharacterName"
            >
              Lago
            </div>
          </div>


          <div
            class="lago-knife-hud-item"
          >
            <div
              class="lago-knife-hud-label"
            >
              ROUND
            </div>

            <div
              class="lago-knife-hud-value"
              id="lagoKnifeRound"
            >
              0/${TOTAL_ROUNDS}
            </div>
          </div>


          <div
            class="lago-knife-hud-item"
          >
            <div
              class="lago-knife-hud-label"
            >
              LIVES
            </div>

            <div
              class="lago-knife-hud-value"
              id="lagoKnifeLives"
            >
              ${STARTING_LIVES}
            </div>
          </div>


          <div
            class="lago-knife-hud-item"
          >
            <div
              class="lago-knife-hud-label"
            >
              SCORE
            </div>

            <div
              class="lago-knife-hud-value"
              id="lagoKnifeScore"
            >
              0
            </div>
          </div>

        </div>


        <main
          class="lago-knife-stage"
        >

          <div
            class="
              lago-knife-character
              lago-glb-preview-host
            "
            id="lagoKnifeCharacter"
          ></div>


          <div
            class="lago-knife-blade-wrap"
          >

            <div
              class="lago-knife-blade"
            ></div>

            <div
              class="lago-knife-target"
              id="lagoKnifeTarget"
            ></div>

            <div
              class="lago-knife-marker"
              id="lagoKnifeMarker"
            ></div>

          </div>


          <div
            class="lago-knife-feedback"
            id="lagoKnifeFeedback"
          ></div>


          <button
            type="button"
            class="lago-knife-tap"
            id="lagoKnifeTap"
          >
            TAP / SPACE
          </button>


          <section
            class="lago-knife-panel"
            id="lagoKnifePanel"
          >

            <div
              class="lago-knife-panel-card"
            >

              <div
                class="lago-knife-panel-title"
                id="lagoKnifePanelTitle"
              >
                KNIFE CHALLENGE
              </div>


              <div
                class="lago-knife-panel-copy"
                id="lagoKnifePanelCopy"
              ></div>


              <div
                class="lago-knife-panel-result"
                id="lagoKnifePanelResult"
              ></div>


              <div
                class="lago-knife-panel-actions"
              >

                <button
                  type="button"
                  id="lagoKnifePrimary"
                >
                  START
                </button>


                <button
                  type="button"
                  class="secondary"
                  id="lagoKnifeSecondary"
                >
                  BACK TO GAMES
                </button>

              </div>

            </div>

          </section>

        </main>

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


    element(
      "lagoKnifeClose"
    )
      ?.addEventListener(
        "click",
        closeGame
      );


    element(
      "lagoKnifeTap"
    )
      ?.addEventListener(
        "click",
        () => {
          attempt(
            false
          );
        }
      );


    element(
      "lagoKnifePrimary"
    )
      ?.addEventListener(
        "click",
        startRun
      );


    element(
      "lagoKnifeSecondary"
    )
      ?.addEventListener(
        "click",
        () => {

          closeGame();

          window.LAGO_GAMES
            ?.show
            ?.();

        }
      );


    return overlay;

  }


  function setPanel(
    {
      title = "",
      copy = "",
      result = "",
      primary = "START",
      show = true
    } = {}
  ) {

    const panel =
      element(
        "lagoKnifePanel"
      );


    if (!panel) {
      return;
    }


    panel.hidden =
      !show;


    const titleElement =
      element(
        "lagoKnifePanelTitle"
      );


    if (titleElement) {

      titleElement.textContent =
        title;

    }


    const copyElement =
      element(
        "lagoKnifePanelCopy"
      );


    if (copyElement) {

      copyElement.textContent =
        copy;

    }


    const resultElement =
      element(
        "lagoKnifePanelResult"
      );


    if (resultElement) {

      resultElement.textContent =
        result;

    }


    const primaryElement =
      element(
        "lagoKnifePrimary"
      );


    if (primaryElement) {

      primaryElement.textContent =
        primary;

    }

  }


  function updateHud() {

    const characterName =
      element(
        "lagoKnifeCharacterName"
      );


    if (characterName) {

      characterName.textContent =
        context
          ?.characterName ||
        "Lago";

    }


    const roundElement =
      element(
        "lagoKnifeRound"
      );


    if (roundElement) {

      roundElement.textContent =
        `${round}/${TOTAL_ROUNDS}`;

    }


    const livesElement =
      element(
        "lagoKnifeLives"
      );


    if (livesElement) {

      livesElement.textContent =
        String(
          lives
        );

    }


    const scoreElement =
      element(
        "lagoKnifeScore"
      );


    if (scoreElement) {

      scoreElement.textContent =
        String(
          score
        );

    }

  }


  function clearCharacterVisual() {

    const host =
      element(
        "lagoKnifeCharacter"
      );


    if (!host) {
      return;
    }


    window.LAGO_CHARACTER_3D
      ?.destroyPreview
      ?.(
        host
      );


    host.replaceChildren();

  }


  function mountCharacterVisual() {

    const host =
      element(
        "lagoKnifeCharacter"
      );


    if (
      !host ||
      !context
    ) {

      return;

    }


    clearCharacterVisual();


    if (
      context.characterModel3d &&
      window.LAGO_CHARACTER_3D
        ?.mountPreview
    ) {

      window.LAGO_CHARACTER_3D
        .mountPreview(
          host,
          context.characterModel3d
        );


      return;

    }


    if (
      context.characterAsset
    ) {

      const image =
        document.createElement(
          "img"
        );


      image.src =
        context.characterAsset;


      image.alt =
        context.characterName ||
        "Lago";


      image.draggable =
        false;


      host.appendChild(
        image
      );

    }

  }


  function show(
    detail = {}
  ) {

    create();


    context =
      detail.context ||
      runtime()
        ?.getContext
        ?.() ||
      null;


    phase =
      "intro";


    sessionId =
      "";


    round =
      0;


    lives =
      STARTING_LIVES;


    score =
      0;


    overlay.classList.add(
      "active"
    );


    updateHud();


    mountCharacterVisual();


    const currentGame =
      game();


    const stats =
      runtime()
        ?.getStats
        ?.(
          GAME_ID
        ) || {};


    setPanel({

      title:
        "KNIFE CHALLENGE",

      copy:
        `8 rounds. 3 lives. ${
          currentGame
            ?.dumCost ||
          0
        } DUM per run. Tap when the white line crosses the lime zone.`,

      result:
        stats.plays > 0

          ? `BEST ${Math.floor(
              stats.bestScore ||
              0
            )}`

          : "",

      primary:
        "START",

      show:
        true

    });


    const feedback =
      element(
        "lagoKnifeFeedback"
      );


    if (feedback) {

      feedback.textContent =
        "";

    }

  }


  function closeGame() {

    stopRoundLoop();


    if (
      sessionId
    ) {

      runtime()
        ?.abortRun
        ?.(
          sessionId
        );

    }


    sessionId =
      "";


    phase =
      "closed";


    clearCharacterVisual();


    overlay
      ?.classList.remove(
        "active"
      );

  }


  function startRun() {

    if (
      phase ===
        "running" ||
      phase ===
        "resolving"
    ) {

      return;

    }


    const result =
      runtime()
        ?.beginRun
        ?.(
          GAME_ID
        );


    if (
      result?.ok !==
      true
    ) {

      setPanel({

        title:
          result?.reason ===
          "dum"

            ? "NOT ENOUGH DUM"

            : "RUN CANNOT START",

        copy:
          "Return to Lago, regenerate DUM, then try again.",

        primary:
          "TRY AGAIN",

        show:
          true

      });


      return;

    }


    context =
      result.context ||
      context;


    sessionId =
      result.session
        .sessionId;


    phase =
      "running";


    round =
      0;


    lives =
      STARTING_LIVES;


    score =
      0;


    updateHud();


    setPanel({
      show:
        false
    });


    startNextRound();

  }


  function startNextRound() {

    stopRoundLoop();


    if (
      phase !==
      "running"
    ) {

      return;

    }


    if (
      lives <= 0 ||
      round >=
        TOTAL_ROUNDS
    ) {

      finishGame();

      return;

    }


    round +=
      1;


    targetWidth =
      Math.max(
        12,
        27 -
        round *
        1.7
      );


    targetCenter =
      20 +
      Math.random() *
      60;


    markerPosition =
      0;


    roundStartedAt =
      performance.now();


    const target =
      element(
        "lagoKnifeTarget"
      );


    if (target) {

      target.style.left =
        `${targetCenter}%`;


      target.style.width =
        `${targetWidth}%`;

    }


    const marker =
      element(
        "lagoKnifeMarker"
      );


    if (marker) {

      marker.style.left =
        "0%";

    }


    const feedback =
      element(
        "lagoKnifeFeedback"
      );


    if (feedback) {

      feedback.textContent =
        `ROUND ${round}`;

    }


    updateHud();


    roundTimer =
      window.setTimeout(
        () => {

          attempt(
            true
          );

        },
        ROUND_TIMEOUT_MS
      );


    frameId =
      requestAnimationFrame(
        frame
      );

  }


  function frame(now) {

    if (
      phase !==
      "running"
    ) {

      return;

    }


    const cycleMs =
      Math.max(
        820,
        1750 -
        round *
        90
      );


    const raw =
      (
        (
          now -
          roundStartedAt
        ) %
        cycleMs
      ) /
      cycleMs;


    markerPosition =
      raw <=
      0.5

        ? raw *
          200

        : (
            1 -
            raw
          ) *
          200;


    const marker =
      element(
        "lagoKnifeMarker"
      );


    if (marker) {

      marker.style.left =
        `${markerPosition}%`;

    }


    frameId =
      requestAnimationFrame(
        frame
      );

  }


  function attempt(
    timeoutMiss = false
  ) {

    if (
      phase !==
      "running"
    ) {

      return;

    }


    phase =
      "resolving";


    stopRoundLoop();


    const half =
      targetWidth /
      2;


    const distance =
      Math.abs(
        markerPosition -
        targetCenter
      );


    const hit =
      !timeoutMiss &&
      distance <=
        half;


    const feedback =
      element(
        "lagoKnifeFeedback"
      );


    if (hit) {

      const precision =
        Math.max(
          0,
          1 -
          distance /
          half
        );


      const gained =
        Math.floor(
          100 +
          precision *
          50
        );


      score +=
        gained;


      if (feedback) {

        feedback.textContent =
          `HIT +${gained}`;

      }

    } else {

      lives =
        Math.max(
          0,
          lives -
          1
        );


      if (feedback) {

        feedback.textContent =
          timeoutMiss
            ? "TOO SLOW"
            : "MISS";

      }

    }


    updateHud();


    window.setTimeout(
      () => {

        if (
          phase ===
          "resolving"
        ) {

          phase =
            "running";


          startNextRound();

        }

      },
      520
    );

  }


  function finishGame() {

    stopRoundLoop();


    if (
      !sessionId
    ) {

      return;

    }


    const reward =
      Math.min(

        game()
          ?.maxRewardSP ||
        0,

        Math.floor(
          score *
          0.2
        )

      );


    const result =
      runtime()
        ?.finishRun
        ?.({

          sessionId,

          score,

          sp:
            reward

        });


    sessionId =
      "";


    phase =
      "finished";


    const stats =
      runtime()
        ?.getStats
        ?.(
          GAME_ID
        ) || {};


    setPanel({

      title:
        lives > 0
          ? "RUN COMPLETE"
          : "FELL OFF THE BLADE",

      copy:
        `Score ${Math.floor(
          score
        )}. Best ${Math.floor(
          stats.bestScore ||
          score
        )}.`,

      result:
        result?.ok ===
        true

          ? `+${result.grantedSP} SP`

          : "RESULT NOT SAVED",

      primary:
        "PLAY AGAIN",

      show:
        true

    });

  }


  function stopRoundLoop() {

    if (
      frameId
    ) {

      cancelAnimationFrame(
        frameId
      );


      frameId =
        0;

    }


    if (
      roundTimer
    ) {

      clearTimeout(
        roundTimer
      );


      roundTimer =
        0;

    }

  }


  document.addEventListener(
    "lago:mini-game-open",
    event => {

      if (
        event.detail
          ?.game
          ?.id ===
        GAME_ID
      ) {

        show(
          event.detail
        );

      }

    }
  );


  document.addEventListener(
    "keydown",
    event => {

      if (
        !overlay
          ?.classList.contains(
            "active"
          )
      ) {

        return;

      }


      if (
        event.key ===
        "Escape"
      ) {

        closeGame();

        return;

      }


      if (
        phase ===
          "running" &&
        (
          event.key ===
            " " ||
          event.key ===
            "Enter"
        )
      ) {

        event.preventDefault();


        attempt(
          false
        );

      }

    }
  );


  document.addEventListener(
    "visibilitychange",
    () => {

      if (
        document.hidden &&
        phase ===
          "running"
      ) {

        closeGame();

      }

    }
  );


  window.LAGO_KNIFE_GAME =
    Object.freeze({

      version:
        VERSION,

      show,

      close:
        closeGame

    });

})();

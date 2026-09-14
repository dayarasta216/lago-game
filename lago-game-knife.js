(() => {
  "use strict";

  const VERSION = 3;
  const GAME_ID = "knife-challenge";
  const TOTAL_ROUNDS = 8;
  const STARTING_LIVES = 3;
  const ROUND_TIMEOUT_MS = 4200;
  const RESOLVE_DELAY_MS = 900;

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
  let resolveTimer = 0;

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

  const el =
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
        position: fixed;
        inset: 0;
        z-index: 22000;

        display: none;
        overflow-y: auto;

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
        display: block;
      }


      .lago-knife-shell {
        width:
          min(
            1100px,
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
          560px;

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
          #17110f;

        isolation:
          isolate;

        perspective:
          1200px;
      }


      /*
       * =============================================
       * KITCHEN
       * =============================================
       */

      .lago-kitchen {
        position:
          absolute;

        inset:
          0;

        z-index:
          0;

        background:
          linear-gradient(
            #332c29
            0 52%,
            #9d7c54
            52% 63%,
            #5d3d2b
            63% 100%
          );
      }


      .lago-kitchen-tiles {
        position:
          absolute;

        inset:
          0 0 37%;

        opacity:
          .48;

        background-image:
          linear-gradient(
            rgba(
              255,
              255,
              255,
              .1
            )
            1px,
            transparent
            1px
          ),
          linear-gradient(
            90deg,
            rgba(
              255,
              255,
              255,
              .1
            )
            1px,
            transparent
            1px
          );

        background-size:
          74px 58px;
      }


      .lago-kitchen-cabinet {
        position:
          absolute;

        top:
          20px;

        width:
          180px;

        height:
          96px;

        border:
          4px solid
          #201612;

        border-radius:
          10px;

        background:
          #6e4930;

        box-shadow:
          0 14px 28px
          rgba(
            0,
            0,
            0,
            .18
          );
      }


      .lago-kitchen-cabinet.left {
        left:
          28px;
      }


      .lago-kitchen-cabinet.right {
        right:
          28px;
      }


      .lago-kitchen-hood {
        position:
          absolute;

        top:
          12px;

        left:
          50%;

        width:
          180px;

        height:
          82px;

        transform:
          translateX(
            -50%
          );

        border-radius:
          12px 12px 4px 4px;

        background:
          linear-gradient(
            #666,
            #27292b
          );
      }


      .lago-kitchen-pot {
        position:
          absolute;

        top:
          120px;

        left:
          9%;

        width:
          82px;

        height:
          56px;

        border:
          4px solid
          #151719;

        border-radius:
          8px 8px 28px 28px;

        background:
          linear-gradient(
            135deg,
            #777,
            #252729
          );

        transform:
          rotate(
            -4deg
          );
      }


      .lago-kitchen-pot::after {
        content:
          "";

        position:
          absolute;

        top:
          11px;

        right:
          -54px;

        width:
          58px;

        height:
          10px;

        border-radius:
          999px;

        background:
          #17191b;
      }


      .lago-kitchen-tools {
        position:
          absolute;

        top:
          112px;

        right:
          9%;

        width:
          120px;

        height:
          105px;

        border-bottom:
          5px solid
          #1e1714;
      }


      .lago-kitchen-tools::before,
      .lago-kitchen-tools::after {
        content:
          "";

        position:
          absolute;

        top:
          0;

        width:
          10px;

        height:
          86px;

        border-radius:
          999px;

        background:
          #202224;
      }


      .lago-kitchen-tools::before {
        left:
          30px;

        transform:
          rotate(
            8deg
          );
      }


      .lago-kitchen-tools::after {
        right:
          34px;

        transform:
          rotate(
            -12deg
          );
      }


      .lago-board {
        position:
          absolute;

        left:
          7%;

        right:
          7%;

        bottom:
          54px;

        height:
          220px;

        border:
          5px solid
          #6e4426;

        border-radius:
          22px;

        background:
          linear-gradient(
            90deg,
            #c79255,
            #b97b42,
            #ca9254
          );

        box-shadow:
          0 24px 40px
          rgba(
            0,
            0,
            0,
            .3
          );

        transform:
          rotateX(
            63deg
          );

        transform-origin:
          center bottom;
      }


      .lago-tomato {
        position:
          absolute;

        right:
          9%;

        bottom:
          125px;

        width:
          58px;

        height:
          48px;

        z-index:
          2;

        border:
          4px solid
          #1c120e;

        border-radius:
          52% 48% 48% 52%;

        background:
          #c9342d;
      }


      .lago-tomato::before {
        content:
          "";

        position:
          absolute;

        top:
          -12px;

        left:
          19px;

        width:
          20px;

        height:
          16px;

        background:
          #478531;

        clip-path:
          polygon(
            50% 0,
            65% 35%,
            100% 20%,
            75% 55%,
            100% 80%,
            60% 68%,
            50% 100%,
            40% 67%,
            0 80%,
            25% 53%,
            0 22%,
            38% 34%
          );
      }


      .lago-carrot {
        position:
          absolute;

        right:
          18%;

        bottom:
          88px;

        width:
          26px;

        height:
          82px;

        z-index:
          2;

        border:
          4px solid
          #24140a;

        border-radius:
          14px 14px 70% 70%;

        background:
          #ef7c20;

        transform:
          rotate(
            64deg
          );
      }


      .lago-carrot::before {
        content:
          "";

        position:
          absolute;

        top:
          -28px;

        left:
          -5px;

        width:
          30px;

        height:
          32px;

        background:
          #4f8f3b;

        clip-path:
          polygon(
            50% 100%,
            0 10%,
            34% 24%,
            48% 0,
            63% 27%,
            100% 12%
          );
      }


      /*
       * =============================================
       * PLATE
       * =============================================
       */

      .lago-knife-plate {
        position:
          absolute;

        left:
          50%;

        bottom:
          26px;

        width:
          min(
            360px,
            48vw
          );

        height:
          110px;

        z-index:
          3;

        transform:
          translateX(
            -50%
          )
          rotateX(
            69deg
          );

        border:
          7px solid
          #e8e5dd;

        border-radius:
          50%;

        background:
          radial-gradient(
            ellipse,
            #f7f4eb
            0 48%,
            #d8d5ce
            50% 66%,
            #f5f1e7
            68%
          );

        box-shadow:
          0 24px 34px
          rgba(
            0,
            0,
            0,
            .34
          );
      }


      /*
       * =============================================
       * VOLUMETRIC KNIFE
       * =============================================
       */

      .lago-knife-object {
        position:
          absolute;

        left:
          8%;

        right:
          8%;

        bottom:
          154px;

        height:
          150px;

        z-index:
          5;

        transform:
          rotateZ(
            -2deg
          );
      }


      .lago-knife-handle {
        position:
          absolute;

        left:
          0;

        top:
          53px;

        width:
          24%;

        height:
          46px;

        border:
          4px solid
          #16100d;

        border-radius:
          18px 9px 9px 18px;

        background:
          linear-gradient(
            #553525
            0 45%,
            #2f1c14
            46%
          );

        box-shadow:
          inset
          0 5px
          rgba(
            255,
            255,
            255,
            .07
          ),
          0 15px 18px
          rgba(
            0,
            0,
            0,
            .28
          );

        z-index:
          3;
      }


      .lago-knife-handle::before,
      .lago-knife-handle::after {
        content:
          "";

        position:
          absolute;

        top:
          15px;

        width:
          10px;

        height:
          10px;

        border-radius:
          50%;

        background:
          #b6a68e;

        box-shadow:
          inset
          0 0 0 2px
          #554f47;
      }


      .lago-knife-handle::before {
        left:
          28%;
      }


      .lago-knife-handle::after {
        right:
          22%;
      }


      .lago-knife-guard {
        position:
          absolute;

        left:
          22.5%;

        top:
          47px;

        width:
          20px;

        height:
          60px;

        border:
          3px solid
          #222;

        border-radius:
          7px;

        background:
          linear-gradient(
            #bfc5c8,
            #50575c
          );

        z-index:
          6;
      }


      .lago-knife-blade {
        position:
          absolute;

        left:
          24%;

        right:
          0;

        top:
          36px;

        height:
          68px;

        background:
          linear-gradient(
            #fff 0,
            #d5d8da 15%,
            #9ca2a6 58%,
            #5f6468 78%,
            #282d31
          );

        clip-path:
          polygon(
            0 15%,
            86% 0,
            100% 51%,
            88% 82%,
            0 100%
          );

        box-shadow:
          0 18px 24px
          rgba(
            0,
            0,
            0,
            .4
          );

        z-index:
          2;
      }


      .lago-knife-blade::before {
        content:
          "";

        position:
          absolute;

        left:
          2%;

        right:
          5%;

        top:
          8px;

        height:
          18px;

        background:
          linear-gradient(
            rgba(
              255,
              255,
              255,
              .95
            ),
            rgba(
              255,
              255,
              255,
              .18
            )
          );

        clip-path:
          polygon(
            0 0,
            98% 0,
            100% 100%,
            0 64%
          );
      }


      .lago-knife-edge {
        position:
          absolute;

        left:
          24.8%;

        right:
          2%;

        top:
          96px;

        height:
          9px;

        background:
          linear-gradient(
            #fafafa,
            #84898d
          );

        clip-path:
          polygon(
            0 0,
            92% 0,
            100% 28%,
            91% 100%,
            0 70%
          );

        box-shadow:
          0 5px 7px
          rgba(
            0,
            0,
            0,
            .36
          );

        z-index:
          7;
      }


      /*
       * Safe balance zone.
       */
      .lago-knife-target {
        position:
          absolute;

        top:
          86px;

        height:
          30px;

        border:
          3px solid
          #ccff00;

        border-radius:
          10px;

        background:
          rgba(
            204,
            255,
            0,
            .16
          );

        transform:
          translateX(
            -50%
          );

        box-shadow:
          0 0 20px
          rgba(
            204,
            255,
            0,
            .16
          );

        pointer-events:
          none;

        z-index:
          9;
      }


      /*
       * Old white marker removed.
       * Character itself is the marker.
       */
      .lago-knife-marker {
        display:
          none;
      }


      /*
       * =============================================
       * CHARACTER ON BLADE
       * =============================================
       */

      .lago-knife-character-track {
        position:
          absolute;

        left:
          24%;

        right:
          6%;

        top:
          -8px;

        height:
          128px;

        z-index:
          12;

        pointer-events:
          none;
      }


      .lago-knife-character {
        position:
          absolute;

        left:
          0;

        top:
          0;

        width:
          clamp(
            92px,
            13vw,
            150px
          );

        height:
          114px;

        transform:
          translateX(
            -50%
          );

        transform-origin:
          50% 82%;

        will-change:
          left,
          transform;

        transition:
          filter
          .12s ease;
      }


      .lago-knife-character.running {
        animation:
          lagoKnifeCrawl
          .32s
          steps(
            2,
            end
          )
          infinite;
      }


      .lago-knife-character.hit {
        filter:
          drop-shadow(
            0 0 16px
            rgba(
              204,
              255,
              0,
              .9
            )
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

        pointer-events:
          none;

        user-select:
          none;
      }


      @keyframes
      lagoKnifeCrawl {

        50% {
          margin-top:
            -4px;
        }

      }


      /*
       * =============================================
       * CARTOON CUT + FALL
       * no blood / no gore
       * =============================================
       */

      .lago-knife-fall-layer {
        position:
          absolute;

        inset:
          0;

        z-index:
          30;

        pointer-events:
          none;

        overflow:
          hidden;
      }


      .lago-knife-fall-piece {
        position:
          absolute;

        width:
          clamp(
            92px,
            13vw,
            150px
          );

        height:
          114px;

        left:
          var(
            --fall-left
          );

        top:
          var(
            --fall-top
          );

        transform:
          translate(
            -50%,
            0
          );

        transform-origin:
          center;
      }


      .lago-knife-fall-piece img {
        width:
          100%;

        height:
          100%;

        object-fit:
          contain;
      }


      .lago-knife-fall-piece.left {
        clip-path:
          inset(
            0 50% 0 0
          );

        animation:
          lagoFallLeft
          .82s
          cubic-bezier(
            .25,
            .8,
            .36,
            1
          )
          forwards;
      }


      .lago-knife-fall-piece.right {
        clip-path:
          inset(
            0 0 0 50%
          );

        animation:
          lagoFallRight
          .82s
          cubic-bezier(
            .25,
            .8,
            .36,
            1
          )
          forwards;
      }


      @keyframes
      lagoFallLeft {

        to {
          transform:
            translate(
              -128px,
              235px
            )
            rotate(
              -74deg
            )
            scale(
              .82
            );
        }

      }


      @keyframes
      lagoFallRight {

        to {
          transform:
            translate(
              48px,
              238px
            )
            rotate(
              82deg
            )
            scale(
              .82
            );
        }

      }


      .lago-knife-cut-flash {
        position:
          absolute;

        left:
          24%;

        right:
          4%;

        top:
          92px;

        height:
          5px;

        z-index:
          25;

        opacity:
          0;

        background:
          #fff;

        box-shadow:
          0 0 22px
          rgba(
            255,
            255,
            255,
            .95
          );
      }


      .lago-knife-cut-flash.show {
        animation:
          lagoCutFlash
          .28s
          ease-out;
      }


      @keyframes
      lagoCutFlash {

        0% {
          opacity:
            0;

          transform:
            scaleX(
              .15
            );
        }

        45% {
          opacity:
            1;

          transform:
            scaleX(
              1
            );
        }

        100% {
          opacity:
            0;
        }

      }


      .lago-knife-feedback {
        position:
          absolute;

        left:
          50%;

        bottom:
          76px;

        z-index:
          40;

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

        text-shadow:
          0 3px 8px
          rgba(
            0,
            0,
            0,
            .55
          );
      }


      .lago-knife-tap {
        position:
          absolute;

        left:
          50%;

        bottom:
          20px;

        z-index:
          50;

        transform:
          translateX(
            -50%
          );

        width:
          min(
            390px,
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

        box-shadow:
          0 12px 30px
          rgba(
            0,
            0,
            0,
            .28
          );
      }


      .lago-knife-panel {
        position:
          absolute;

        inset:
          0;

        z-index:
          80;

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
            .86
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
            .1
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
            .1
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
            610px;
        }


        .lago-kitchen-cabinet {
          width:
            118px;

          height:
            74px;
        }


        .lago-kitchen-hood {
          width:
            130px;

          height:
            65px;
        }


        .lago-knife-object {
          left:
            4%;

          right:
            4%;

          bottom:
            178px;
        }


        .lago-knife-plate {
          width:
            280px;

          bottom:
            32px;
        }


        .lago-knife-character,
        .lago-knife-fall-piece {
          width:
            104px;

          height:
            100px;
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

      <div class="lago-knife-shell">

        <header class="lago-knife-header">

          <div>

            <div class="lago-knife-title">
              KNIFE CHALLENGE
            </div>

            <div class="lago-knife-subtitle">
              KEEP THE CHARACTER BALANCED ON THE KNIFE EDGE
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


        <div class="lago-knife-hud">

          <div class="lago-knife-hud-item">

            <div class="lago-knife-hud-label">
              CHARACTER
            </div>

            <div
              class="lago-knife-hud-value"
              id="lagoKnifeCharacterName"
            >
              Lago
            </div>

          </div>


          <div class="lago-knife-hud-item">

            <div class="lago-knife-hud-label">
              ROUND
            </div>

            <div
              class="lago-knife-hud-value"
              id="lagoKnifeRound"
            >
              0/${TOTAL_ROUNDS}
            </div>

          </div>


          <div class="lago-knife-hud-item">

            <div class="lago-knife-hud-label">
              LIVES
            </div>

            <div
              class="lago-knife-hud-value"
              id="lagoKnifeLives"
            >
              ${STARTING_LIVES}
            </div>

          </div>


          <div class="lago-knife-hud-item">

            <div class="lago-knife-hud-label">
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


        <main class="lago-knife-stage">

          <div
            class="lago-kitchen"
            aria-hidden="true"
          >

            <div class="lago-kitchen-tiles"></div>

            <div
              class="
                lago-kitchen-cabinet
                left
              "
            ></div>

            <div
              class="
                lago-kitchen-cabinet
                right
              "
            ></div>

            <div class="lago-kitchen-hood"></div>

            <div class="lago-kitchen-pot"></div>

            <div class="lago-kitchen-tools"></div>

            <div class="lago-board"></div>

            <div class="lago-tomato"></div>

            <div class="lago-carrot"></div>

          </div>


          <div
            class="lago-knife-plate"
            aria-hidden="true"
          ></div>


          <div class="lago-knife-object">

            <div class="lago-knife-handle"></div>

            <div class="lago-knife-guard"></div>

            <div class="lago-knife-blade"></div>

            <div class="lago-knife-edge"></div>

            <div
              class="lago-knife-cut-flash"
              id="lagoKnifeCutFlash"
            ></div>


            <div class="lago-knife-character-track">

              <div
                class="lago-knife-target"
                id="lagoKnifeTarget"
              ></div>

              <div
                class="
                  lago-knife-character
                  lago-glb-preview-host
                "
                id="lagoKnifeCharacter"
              ></div>

            </div>


            <div
              class="lago-knife-marker"
              id="lagoKnifeMarker"
            ></div>

          </div>


          <div
            class="lago-knife-fall-layer"
            id="lagoKnifeFallLayer"
            aria-hidden="true"
          ></div>


          <div
            class="lago-knife-feedback"
            id="lagoKnifeFeedback"
          ></div>


          <button
            type="button"
            class="lago-knife-tap"
            id="lagoKnifeTap"
          >
            BALANCE / TAP
          </button>


          <section
            class="lago-knife-panel"
            id="lagoKnifePanel"
          >

            <div class="lago-knife-panel-card">

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


              <div class="lago-knife-panel-actions">

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


    el(
      "lagoKnifeClose"
    )
      ?.addEventListener(
        "click",
        closeGame
      );


    el(
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


    el(
      "lagoKnifePrimary"
    )
      ?.addEventListener(
        "click",
        startRun
      );


    el(
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
      el(
        "lagoKnifePanel"
      );


    if (!panel) {
      return;
    }


    panel.hidden =
      !show;


    if (
      el(
        "lagoKnifePanelTitle"
      )
    ) {

      el(
        "lagoKnifePanelTitle"
      ).textContent =
        title;

    }


    if (
      el(
        "lagoKnifePanelCopy"
      )
    ) {

      el(
        "lagoKnifePanelCopy"
      ).textContent =
        copy;

    }


    if (
      el(
        "lagoKnifePanelResult"
      )
    ) {

      el(
        "lagoKnifePanelResult"
      ).textContent =
        result;

    }


    if (
      el(
        "lagoKnifePrimary"
      )
    ) {

      el(
        "lagoKnifePrimary"
      ).textContent =
        primary;

    }

  }


  function updateHud() {

    if (
      el(
        "lagoKnifeCharacterName"
      )
    ) {

      el(
        "lagoKnifeCharacterName"
      ).textContent =
        context
          ?.characterName ||
        "Lago";

    }


    if (
      el(
        "lagoKnifeRound"
      )
    ) {

      el(
        "lagoKnifeRound"
      ).textContent =
        `${round}/${TOTAL_ROUNDS}`;

    }


    if (
      el(
        "lagoKnifeLives"
      )
    ) {

      el(
        "lagoKnifeLives"
      ).textContent =
        String(
          lives
        );

    }


    if (
      el(
        "lagoKnifeScore"
      )
    ) {

      el(
        "lagoKnifeScore"
      ).textContent =
        String(
          score
        );

    }

  }


  function clearCharacterVisual() {

    const host =
      el(
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


    host.classList.remove(
      "running",
      "hit"
    );


    host.style.opacity =
      "1";


    host.style.left =
      "0%";


    host.style.transform =
      "translateX(-50%) rotate(0deg)";

  }


  function mountCharacterVisual() {

    const host =
      el(
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


  function clearFallPieces() {

    el(
      "lagoKnifeFallLayer"
    )
      ?.replaceChildren();


    const host =
      el(
        "lagoKnifeCharacter"
      );


    if (host) {

      host.style.opacity =
        "1";

    }

  }


  function resetCharacterForRound() {

    const host =
      el(
        "lagoKnifeCharacter"
      );


    if (!host) {
      return;
    }


    host.style.opacity =
      "1";


    host.classList.remove(
      "hit"
    );


    host.classList.add(
      "running"
    );

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
        `Crawl along the knife edge and keep balance. ${
          currentGame
            ?.dumCost ||
          0
        } DUM per run. Tap while the character is inside the lime balance zone.`,

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


    if (
      el(
        "lagoKnifeFeedback"
      )
    ) {

      el(
        "lagoKnifeFeedback"
      ).textContent =
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


    clearFallPieces();


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


    clearFallPieces();


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
      22 +
      Math.random() *
      56;


    markerPosition =
      0;


    roundStartedAt =
      performance.now();


    clearFallPieces();


    resetCharacterForRound();


    const target =
      el(
        "lagoKnifeTarget"
      );


    if (target) {

      target.style.left =
        `${targetCenter}%`;


      target.style.width =
        `${targetWidth}%`;

    }


    if (
      el(
        "lagoKnifeFeedback"
      )
    ) {

      el(
        "lagoKnifeFeedback"
      ).textContent =
        `ROUND ${round} · HOLD BALANCE`;

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
      .5

        ? raw *
          200

        : (
            1 -
            raw
          ) *
          200;


    const host =
      el(
        "lagoKnifeCharacter"
      );


    if (host) {

      const progress =
        Math.max(
          0,
          Math.min(
            100,
            markerPosition
          )
        );


      const balanceTilt =
        Math.sin(
          (
            now -
            roundStartedAt
          ) /
          95
        ) *
        (
          7 +
          round *
          1.15
        );


      const edgeTilt =
        (
          progress -
          50
        ) *
        .06;


      host.style.left =
        `${progress}%`;


      host.style.transform =
        `translateX(-50%) rotate(${
          balanceTilt +
          edgeTilt
        }deg)`;

    }


    frameId =
      requestAnimationFrame(
        frame
      );

  }


  function getCurrentCharacterImage() {

    const image =
      el(
        "lagoKnifeCharacter"
      )
        ?.querySelector(
          ".lago-glb-preview-image, img"
        );


    const src =
      image
        ?.getAttribute(
          "src"
        );


    if (!src) {
      return null;
    }


    return {

      src,

      alt:
        image.getAttribute(
          "alt"
        ) ||
        context
          ?.characterName ||
        "Lago"

    };

  }


  function spawnSplitFall() {

    const host =
      el(
        "lagoKnifeCharacter"
      );


    const layer =
      el(
        "lagoKnifeFallLayer"
      );


    const stage =
      overlay
        ?.querySelector(
          ".lago-knife-stage"
        );


    if (
      !host ||
      !layer ||
      !stage
    ) {

      return;

    }


    const hostRect =
      host.getBoundingClientRect();


    const stageRect =
      stage.getBoundingClientRect();


    const left =
      hostRect.left -
      stageRect.left +
      hostRect.width /
      2;


    const top =
      hostRect.top -
      stageRect.top;


    const visual =
      getCurrentCharacterImage();


    host.style.opacity =
      "0";


    const flash =
      el(
        "lagoKnifeCutFlash"
      );


    if (flash) {

      flash.classList.remove(
        "show"
      );


      void flash.offsetWidth;


      flash.classList.add(
        "show"
      );

    }


    if (!visual) {
      return;
    }


    [
      "left",
      "right"
    ]
      .forEach(
        side => {

          const piece =
            document.createElement(
              "div"
            );


          piece.className =
            `lago-knife-fall-piece ${side}`;


          piece.style.setProperty(
            "--fall-left",
            `${left}px`
          );


          piece.style.setProperty(
            "--fall-top",
            `${top}px`
          );


          const image =
            document.createElement(
              "img"
            );


          image.src =
            visual.src;


          image.alt =
            visual.alt;


          image.draggable =
            false;


          piece.appendChild(
            image
          );


          layer.appendChild(
            piece
          );

        }
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


    const host =
      el(
        "lagoKnifeCharacter"
      );


    host
      ?.classList.remove(
        "running"
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


      host
        ?.classList.add(
          "hit"
        );


      if (
        el(
          "lagoKnifeFeedback"
        )
      ) {

        el(
          "lagoKnifeFeedback"
        ).textContent =
          `BALANCED +${gained}`;

      }

    } else {

      lives =
        Math.max(
          0,
          lives -
          1
        );


      spawnSplitFall();


      if (
        el(
          "lagoKnifeFeedback"
        )
      ) {

        el(
          "lagoKnifeFeedback"
        ).textContent =
          timeoutMiss

            ? "LOST BALANCE"

            : "CUT — MISSED BALANCE";

      }

    }


    updateHud();


    resolveTimer =
      window.setTimeout(
        () => {

          resolveTimer =
            0;


          if (
            phase ===
            "resolving"
          ) {

            phase =
              "running";


            startNextRound();

          }

        },
        RESOLVE_DELAY_MS
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
          .2
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
          : "CHEF'S PLATE",

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


    if (
      resolveTimer
    ) {

      clearTimeout(
        resolveTimer
      );


      resolveTimer =
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
        sessionId
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

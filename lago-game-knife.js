import * as THREE from "three";

import {
  supportsVolumetricCharacter,
  createVolumetricCharacter,
  disposeVolumetricCharacter
} from "./lago-character-volumetric.js?v=2";

(() => {
  "use strict";


  const VERSION = 15;

  const GAME_ID =
    "knife-challenge";

  const TOTAL_ROUNDS =
    8;

  const STARTING_LIVES =
    3;

  const ROUND_DURATION_MS =
    7600;

  const ROUND_GAP_MS =
    850;

  const FAIL_GAP_MS =
    1250;

  const CHARACTER_ROTATION_X =
    -Math.PI / 2;


  /*
   * World coordinates of the
   * actual sharp knife edge.
   */
  /*
 * Knife is now standing on its side.
 *
 * The character walks on the real
 * upper cutting edge.
 */
const KNIFE_START_X =
  -2.20;

const KNIFE_END_X =
  2.48;

const KNIFE_EDGE_Y =
  1.90;

const KNIFE_EDGE_Z =
  0.05;


const BALANCE_FAIL_LIMIT =
  0.92;

  /*
 * =========================================================
 * AUTOMATIC LEVEL CURVE
 * =========================================================
 *
 * Player never selects difficulty.
 *
 * Every completed level makes
 * the next one harder automatically.
 */
const LEVEL_PROFILES =
  Object.freeze([

    Object.freeze({
      level: 1,
      duration: 9200,
      gravity: .60,
      noise: .12,
      bias: .10,
      control: 2.95,
      damping: .38,
      failLimit: 1.00,
      dangerGrace: .70,
      hazardMin: 3200,
      hazardMax: 4200,
      hazardImpulse: .08,
      startBalance: .035,
      startVelocity: .018,
      scoreMultiplier: .75
    }),

    Object.freeze({
      level: 2,
      duration: 8800,
      gravity: .72,
      noise: .16,
      bias: .14,
      control: 2.90,
      damping: .42,
      failLimit: .98,
      dangerGrace: .62,
      hazardMin: 2800,
      hazardMax: 3800,
      hazardImpulse: .10,
      startBalance: .05,
      startVelocity: .024,
      scoreMultiplier: .85
    }),

    Object.freeze({
      level: 3,
      duration: 8400,
      gravity: .86,
      noise: .20,
      bias: .20,
      control: 2.80,
      damping: .48,
      failLimit: .95,
      dangerGrace: .54,
      hazardMin: 2400,
      hazardMax: 3300,
      hazardImpulse: .13,
      startBalance: .07,
      startVelocity: .032,
      scoreMultiplier: .95
    }),

    Object.freeze({
      level: 4,
      duration: 8000,
      gravity: 1.02,
      noise: .25,
      bias: .25,
      control: 2.70,
      damping: .55,
      failLimit: .92,
      dangerGrace: .47,
      hazardMin: 2000,
      hazardMax: 2900,
      hazardImpulse: .16,
      startBalance: .09,
      startVelocity: .040,
      scoreMultiplier: 1.05
    }),

    Object.freeze({
      level: 5,
      duration: 7600,
      gravity: 1.18,
      noise: .30,
      bias: .31,
      control: 2.60,
      damping: .62,
      failLimit: .89,
      dangerGrace: .40,
      hazardMin: 1650,
      hazardMax: 2500,
      hazardImpulse: .20,
      startBalance: .11,
      startVelocity: .050,
      scoreMultiplier: 1.18
    }),

    Object.freeze({
      level: 6,
      duration: 7200,
      gravity: 1.36,
      noise: .36,
      bias: .37,
      control: 2.50,
      damping: .69,
      failLimit: .86,
      dangerGrace: .34,
      hazardMin: 1350,
      hazardMax: 2100,
      hazardImpulse: .24,
      startBalance: .13,
      startVelocity: .062,
      scoreMultiplier: 1.32
    }),

    Object.freeze({
      level: 7,
      duration: 6800,
      gravity: 1.55,
      noise: .42,
      bias: .44,
      control: 2.42,
      damping: .76,
      failLimit: .83,
      dangerGrace: .29,
      hazardMin: 1050,
      hazardMax: 1750,
      hazardImpulse: .28,
      startBalance: .15,
      startVelocity: .075,
      scoreMultiplier: 1.48
    }),

    Object.freeze({
      level: 8,
      duration: 6300,
      gravity: 1.78,
      noise: .50,
      bias: .52,
      control: 2.35,
      damping: .82,
      failLimit: .79,
      dangerGrace: .24,
      hazardMin: 780,
      hazardMax: 1350,
      hazardImpulse: .34,
      startBalance: .18,
      startVelocity: .090,
      scoreMultiplier: 1.70
    })

  ]);


function currentLevelProfile() {

  const index =
    THREE.MathUtils.clamp(
      round - 1,
      0,
      LEVEL_PROFILES.length - 1
    );


  return LEVEL_PROFILES[
    index
  ];

}

  const pressedKeys =
    new Set();


  let overlay =
    null;

  let canvas =
    null;

  let renderer =
    null;

  let scene =
    null;

  let camera =
    null;

  let resizeObserver =
    null;


  let world =
    null;

  let plateGroup =
    null;

  let characterPivot =
    null;

  let characterModel =
    null;

  let activeModelUrl =
    "";

  let fallPieces =
    [];


  let phase =
    "closed";

  let sessionId =
    "";

  let context =
    null;

  let round =
    0;

  let lives =
    STARTING_LIVES;

  let score =
    0;


  let animationFrame =
    0;

  let resolveTimer =
    0;

  let lastFrameAt =
    0;

  let roundStartedAt =
    0;


  /*
   * Continuous balance physics.
   *
   * -1 = falling left
   *  0 = perfect balance
   * +1 = falling right
   */
  let inputAxis =
    0;

  let balance =
    0;

  let balanceVelocity =
    0;

  let balanceQuality =
    0;

  let walkProgress =
    0;

/*
 * Short unpredictable pushes make
 * balance something the player must
 * constantly correct.
 */
let balanceBias =
  0;


let nextBalanceBiasAt =
  0;

  let nextHazardAt =
  0;


let dangerTime =
  0;
  

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


  /*
   * =======================================================
   * DOM / HUD
   * =======================================================
   */

  function createOverlay() {

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
            14px +
            env(safe-area-inset-top)
          )
          14px
          calc(
            18px +
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
            1180px,
            100%
          );

        min-height:
          calc(
            100dvh -
            32px
          );

        margin:
          0 auto;

        display:
          flex;

        flex-direction:
          column;
      }


      .lago-knife-header {
        display: flex;

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
            5.2vw,
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
          12px;

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


      /*
       * Entire gameplay viewport.
       *
       * Everything behind HUD =
       * real Three.js.
       */
      .lago-knife-stage {
        position:
          relative;

        flex:
          1;

        min-height:
          610px;

        margin-top:
          12px;

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
          #19110d;
      }


      #lagoKnifeCanvas {
        position:
          absolute;

        inset:
          0;

        width:
          100%;

        height:
          100%;

        display:
          block;

        touch-action:
          none;
      }


      .lago-knife-feedback {
        position:
          absolute;

        left:
          50%;

        top:
          18px;

        z-index:
          22;

        transform:
          translateX(
            -50%
          );

        min-width:
          210px;

        padding:
          8px 12px;

        border-radius:
          999px;

        background:
          rgba(
            8,
            4,
            10,
            .62
          );

        color:
          #fff;

        font-size:
          12px;

        font-weight:
          1000;

        text-align:
          center;

        pointer-events:
          none;

        backdrop-filter:
          blur(
            8px
          );
      }


      /*
       * ===================================================
       * SEMICIRCLE BALANCE GAUGE
       * ===================================================
       */

      .lago-balance-ui {
        position:
          absolute;

        left:
          50%;

        bottom:
          72px;

        z-index:
          20;

        width:
          min(
            360px,
            72vw
          );

        transform:
          translateX(
            -50%
          );

        pointer-events:
          none;
      }


      .lago-balance-svg {
        width:
          100%;

        height:
          auto;

        display:
          block;

        overflow:
          visible;

        filter:
          drop-shadow(
            0 5px 12px
            rgba(
              0,
              0,
              0,
              .45
            )
          );
      }


      .lago-balance-arc,
      .lago-balance-safe,
      .lago-balance-danger-left,
      .lago-balance-danger-right {
        fill:
          none;

        stroke-width:
          15;

        stroke-linecap:
          round;
      }


      .lago-balance-arc {
        stroke:
          rgba(
            255,
            255,
            255,
            .22
          );
      }


    .lago-balance-safe {
  stroke:
    #ccff00;

  /*
   * Narrow central safe zone.
   */
  stroke-dasharray:
    18 82;

  stroke-dashoffset:
    -41;
}

      .lago-balance-danger-left,
      .lago-balance-danger-right {
        stroke:
          #ff4b4b;

        stroke-dasharray:
          14 86;
      }


      .lago-balance-danger-left {
        stroke-dashoffset:
          0;
      }


      .lago-balance-danger-right {
        stroke-dashoffset:
          -86;
      }


      .lago-balance-needle {
        stroke:
          #fff;

        stroke-width:
          5;

        stroke-linecap:
          round;

        transform-origin:
          120px 112px;

        transform:
          rotate(
            0deg
          );

        transition:
          stroke
          .12s ease;
      }


      .lago-balance-center {
        fill:
          #fff;
      }


      .lago-balance-labels {
        display:
          flex;

        justify-content:
          space-between;

        margin-top:
          -2px;

        padding:
          0 4px;

        color:
          rgba(
            255,
            255,
            255,
            .75
          );

        font-size:
          9px;

        font-weight:
          1000;

        letter-spacing:
          .08em;
      }


      .lago-balance-status {
        margin-top:
          2px;

        color:
          #ccff00;

        font-size:
          11px;

        font-weight:
          1000;

        text-align:
          center;
      }


      /*
       * Left/right controls.
       */
      .lago-balance-controls {
        position:
          absolute;

        left:
          50%;

        bottom:
          14px;

        z-index:
          25;

        width:
          min(
            520px,
            90%
          );

        transform:
          translateX(
            -50%
          );

        display:
          grid;

        grid-template-columns:
          1fr 1fr;

        gap:
          10px;
      }


      .lago-balance-button {
        min-height:
          48px;

        border:
          1px solid
          rgba(
            255,
            255,
            255,
            .12
          );

        border-radius:
          14px;

        background:
          rgba(
            8,
            4,
            10,
            .78
          );

        color:
          #fff;

        font-size:
          13px;

        font-weight:
          1000;

        cursor:
          pointer;

        user-select:
          none;

        touch-action:
          none;

        backdrop-filter:
          blur(
            10px
          );
      }


      .lago-balance-button:active,
      .lago-balance-button.active {
        border-color:
          #ccff00;

        background:
          #ccff00;

        color:
          #130614;
      }


      /*
       * Intro/result overlay.
       */
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
            .82
          );

        backdrop-filter:
          blur(
            12px
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
            470px,
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
            .55
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
            640px;
        }


        .lago-balance-ui {
          bottom:
            82px;

          width:
            min(
              330px,
              84vw
            );
        }


        .lago-balance-controls {
          width:
            94%;
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
              3D KITCHEN · CRAWL THE EDGE · HOLD BALANCE
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


        <main
          class="lago-knife-stage"
          id="lagoKnifeStage"
        >

          <!-- Real Three.js world -->
          <canvas
            id="lagoKnifeCanvas"
          ></canvas>


          <div
            class="lago-knife-feedback"
            id="lagoKnifeFeedback"
          >
            KEEP THE NEEDLE NEAR CENTER
          </div>


          <!--
            Semicircle game HUD.
            Scene itself remains 3D.
          -->
          <div class="lago-balance-ui">

            <svg
              class="lago-balance-svg"
              viewBox="0 0 240 125"
              aria-label="Balance meter"
            >

              <path
                class="lago-balance-arc"
                d="
                  M20 112
                  A100 100
                  0 0 1
                  220 112
                "
                pathLength="100"
              ></path>


              <path
                class="lago-balance-danger-left"
                d="
                  M20 112
                  A100 100
                  0 0 1
                  220 112
                "
                pathLength="100"
              ></path>


              <path
                class="lago-balance-safe"
                d="
                  M20 112
                  A100 100
                  0 0 1
                  220 112
                "
                pathLength="100"
              ></path>


              <path
                class="lago-balance-danger-right"
                d="
                  M20 112
                  A100 100
                  0 0 1
                  220 112
                "
                pathLength="100"
              ></path>


              <line
                class="lago-balance-needle"
                id="lagoBalanceNeedle"
                x1="120"
                y1="112"
                x2="120"
                y2="28"
              ></line>


              <circle
                class="lago-balance-center"
                cx="120"
                cy="112"
                r="8"
              ></circle>

            </svg>


            <div class="lago-balance-labels">

              <span>
                LEFT
              </span>

              <span>
                BALANCE
              </span>

              <span>
                RIGHT
              </span>

            </div>


            <div
              class="lago-balance-status"
              id="lagoBalanceStatus"
            >
              CENTER
            </div>

          </div>


          <div class="lago-balance-controls">

            <button
              type="button"
              class="lago-balance-button"
              id="lagoBalanceLeft"
            >
              ◀ LEFT
            </button>


            <button
              type="button"
              class="lago-balance-button"
              id="lagoBalanceRight"
            >
              RIGHT ▶
            </button>

          </div>


          <section
            class="lago-knife-panel"
            id="lagoKnifePanel"
          >

            <div class="lago-knife-panel-card">

              <div
                class="lago-knife-panel-title"
                id="lagoKnifePanelTitle"
              >
                KNIFE CHALLENGE 3D
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


    canvas =
      el(
        "lagoKnifeCanvas"
      );


    el(
      "lagoKnifeClose"
    )
      ?.addEventListener(
        "click",
        closeGame
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


    bindBalanceButton(
      el(
        "lagoBalanceLeft"
      ),
      -1
    );


    bindBalanceButton(
      el(
        "lagoBalanceRight"
      ),
      1
    );


    return overlay;

  }


  function bindBalanceButton(
    button,
    direction
  ) {

    if (!button) {
      return;
    }


    const press =
      event => {

        event.preventDefault();


        if (
          phase !==
          "running"
        ) {

          return;

        }


        inputAxis =
          direction;


        button.classList.add(
          "active"
        );


        button
          .setPointerCapture
          ?.(
            event.pointerId
          );

      };


    const release =
      event => {

        if (
          inputAxis ===
          direction
        ) {

          inputAxis =
            0;

        }


        button.classList.remove(
          "active"
        );


        try {

          button
            .releasePointerCapture
            ?.(
              event
                ?.pointerId
            );

        } catch (_) {

          /*
           * Pointer may already
           * be released.
           */

        }

      };


    button.addEventListener(
      "pointerdown",
      press
    );


    button.addEventListener(
      "pointerup",
      release
    );


    button.addEventListener(
      "pointercancel",
      release
    );


    button.addEventListener(
      "pointerleave",
      release
    );

  }


  /*
   * =======================================================
   * THREE.JS
   * =======================================================
   */

  function createRenderer() {

    if (renderer) {
      return;
    }


    renderer =
      new THREE.WebGLRenderer({

        canvas,

        antialias:
          true,

        alpha:
          false,

        powerPreference:
          "high-performance"

      });


    renderer.outputColorSpace =
      THREE.SRGBColorSpace;


    renderer.toneMapping =
      THREE.ACESFilmicToneMapping;


    renderer.toneMappingExposure =
      1.12;


    renderer.shadowMap.enabled =
      true;


    renderer.shadowMap.type =
      THREE.PCFSoftShadowMap;


    /*
     * Required for cartoon 3D
     * split into two halves.
     */
    renderer.localClippingEnabled =
      true;


    scene =
      new THREE.Scene();


    scene.background =
      new THREE.Color(
        0x21160f
      );


    scene.fog =
      new THREE.Fog(
        0x21160f,
        12,
        24
      );

camera =
  new THREE.PerspectiveCamera(
    36,
    1,
    0.1,
    60
  );


/*
 * Lower, closer camera:
 * blade thickness + character volume
 * become much more obvious.
 */
camera.position.set(
  7.25,
  4.35,
  9.25
);


camera.lookAt(
  0,
  1.35,
  .25
);


    scene.add(
      new THREE.HemisphereLight(
        0xfff1d5,
        0x2a1710,
        2.1
      )
    );


    const keyLight =
      new THREE.DirectionalLight(
        0xffffff,
        3.6
      );


    keyLight.position.set(
      3.8,
      8.5,
      5.8
    );


    keyLight.castShadow =
      true;


    keyLight.shadow
  .mapSize
  .set(
    512,
    512
  );


    keyLight.shadow.camera.near =
      .1;

    keyLight.shadow.camera.far =
      24;

    keyLight.shadow.camera.left =
      -8;

    keyLight.shadow.camera.right =
      8;

    keyLight.shadow.camera.top =
      8;

    keyLight.shadow.camera.bottom =
      -8;


    scene.add(
      keyLight
    );


    const warmLight =
      new THREE.PointLight(
        0xffb16b,
        12,
        12,
        2
      );


    warmLight.position.set(
      -4.5,
      3.2,
      2.4
    );


    scene.add(
      warmLight
    );


    world =
      new THREE.Group();


    scene.add(
      world
    );


    buildKitchen();

    buildKnife();

    buildPlate();

    buildVegetables();


    /*
     * Character is its own pivot.
     *
     * We tilt/move this group while
     * leaving original GLB untouched.
     */
    characterPivot =
      new THREE.Group();


    scene.add(
      characterPivot
    );


    resizeObserver =
      new ResizeObserver(
        resizeRenderer
      );


    resizeObserver.observe(
      el(
        "lagoKnifeStage"
      )
    );


    resizeRenderer();

      /*
     * Cool rim light separates the GLB
     * from the kitchen background.
     */
    const rimLight =
      new THREE.DirectionalLight(
        0x9fdcff,
        1.65
      );


    rimLight.position.set(
      -4.5,
      4.8,
      5.5
    );


    scene.add(
      rimLight
    );


    /*
     * Warm local kitchen light.
     */
    const characterLight =
      new THREE.PointLight(
        0xffe0ad,
        7,
        9,
        2
      );


    characterLight.position.set(
      0,
      4.1,
      3.6
    );


    scene.add(
      characterLight
    );

  }

    
  function material(
    color,
    roughness = .7,
    metalness = 0
  ) {

    return new THREE
      .MeshStandardMaterial({

        color,

        roughness,

        metalness

      });

  }


  function box(
    size,
    color,
    position,
    roughness = .7,
    metalness = 0
  ) {

    const mesh =
      new THREE.Mesh(

        new THREE.BoxGeometry(
          size.x,
          size.y,
          size.z
        ),

        material(
          color,
          roughness,
          metalness
        )

      );


    mesh.position.copy(
      position
    );


    mesh.castShadow =
      true;


    mesh.receiveShadow =
      true;


    return mesh;

  }


  /*
   * =======================================================
   * 3D KITCHEN
   * =======================================================
   */

  function buildKitchen() {

    /*
     * Counter.
     */
    world.add(
      box(
        new THREE.Vector3(
          14,
          .55,
          7.2
        ),
        0x5a3827,
        new THREE.Vector3(
          0,
          -.28,
          .45
        ),
        .84
      )
    );


    /*
     * Back wall.
     */
    world.add(
      box(
        new THREE.Vector3(
          14,
          7,
          .34
        ),
        0x3a302c,
        new THREE.Vector3(
          0,
          3.15,
          -3.42
        ),
        .92
      )
    );


    /*
     * Cutting board.
     */
    world.add(
      box(
        new THREE.Vector3(
          10.4,
          .22,
          4.4
        ),
        0xb97842,
        new THREE.Vector3(
          .2,
          .16,
          .55
        ),
        .8
      )
    );


    /*
     * Tile grid behind kitchen.
     */
    const tiles =
      new THREE.GridHelper(
        14,
        14,
        0x74655d,
        0x544842
      );


    tiles.rotation.x =
      Math.PI / 2;


    tiles.position.set(
      0,
      3.15,
      -3.23
    );


    tiles.material.opacity =
      .42;


    tiles.material.transparent =
      true;


    world.add(
      tiles
    );


    /*
     * Cabinets.
     */
    [
      -4.45,
      4.45
    ]
      .forEach(
        x => {

          world.add(
            box(
              new THREE.Vector3(
                3.05,
                1.6,
                .72
              ),
              0x70472f,
              new THREE.Vector3(
                x,
                4.62,
                -2.86
              ),
              .86
            )
          );


          world.add(
            box(
              new THREE.Vector3(
                .58,
                .07,
                .07
              ),
              0x242526,
              new THREE.Vector3(
                x,
                4.02,
                -2.45
              ),
              .35,
              .6
            )
          );

        }
      );


    /*
     * Cooker hood.
     */
    world.add(
      box(
        new THREE.Vector3(
          2.4,
          .7,
          1.2
        ),
        0x54585a,
        new THREE.Vector3(
          0,
          4.42,
          -2.7
        ),
        .34,
        .75
      )
    );


    world.add(
      box(
        new THREE.Vector3(
          1.1,
          1.8,
          .8
        ),
        0x4b4f51,
        new THREE.Vector3(
          0,
          5.65,
          -2.88
        ),
        .34,
        .72
      )
    );


    /*
     * Metal cooking pot.
     */
    const pot =
      new THREE.Mesh(

        new THREE.CylinderGeometry(
          .68,
          .62,
          .72,
          32
        ),

        material(
          0x454a4c,
          .3,
          .72
        )

      );


    pot.position.set(
      -4.25,
      .52,
      -1.65
    );


    pot.castShadow =
      true;


    world.add(
      pot
    );


    world.add(
      box(
        new THREE.Vector3(
          1.2,
          .16,
          .2
        ),
        0x202223,
        new THREE.Vector3(
          -5.05,
          .67,
          -1.65
        ),
        .55,
        .25
      )
    );


    /*
     * Hanging utensils.
     */
    for (
      let i = 0;
      i < 4;
      i++
    ) {

      const utensil =
        new THREE.Mesh(

          new THREE
            .CylinderGeometry(
              .035,
              .045,
              1.5,
              10
            ),

          material(
            0x343638,
            .32,
            .65
          )

        );


      utensil.position.set(

        3.15 +
        i *
        .36,

        2.8 +
        (
          i %
          2
        ) *
        .12,

        -3

      );


      utensil.rotation.z =
        -.08 +
        i *
        .045;


      world.add(
        utensil
      );

    }

      /*
     * =====================================================
     * EXTRA CARTOON KITCHEN PROPS
     * =====================================================
     */


    /*
     * Wooden wall shelf.
     */
    world.add(
      box(
        new THREE.Vector3(
          3.7,
          .15,
          .72
        ),
        0x8d5632,
        new THREE.Vector3(
          -1.85,
          2.82,
          -2.88
        ),
        .78
      )
    );


    /*
     * Colorful ingredient jars.
     */
    [
      {
        x: -2.75,
        color: 0xe6c24c
      },
      {
        x: -1.90,
        color: 0xb64732
      },
      {
        x: -1.05,
        color: 0x5b9d55
      }
    ]
      .forEach(
        item => {

          const jar =
            new THREE.Mesh(

              new THREE
                .CylinderGeometry(
                  .24,
                  .24,
                  .62,
                  20
                ),

              material(
                item.color,
                .55
              )

            );


          jar.position.set(
            item.x,
            3.18,
            -2.72
          );


          jar.castShadow =
            true;


          world.add(
            jar
          );


          const lid =
            new THREE.Mesh(

              new THREE
                .CylinderGeometry(
                  .26,
                  .26,
                  .09,
                  20
                ),

              material(
                0x292929,
                .32,
                .55
              )

            );


          lid.position.set(
            item.x,
            3.535,
            -2.72
          );


          world.add(
            lid
          );

        }
      );


    /*
     * Cartoon frying pan hanging
     * on the wall.
     */
    const pan =
      new THREE.Mesh(

        new THREE
          .CylinderGeometry(
            .62,
            .62,
            .15,
            28
          ),

        material(
          0x252729,
          .36,
          .65
        )

      );


    pan.rotation.x =
      Math.PI /
      2;


    pan.position.set(
      -4.45,
      2.45,
      -3.12
    );


    pan.castShadow =
      true;


    world.add(
      pan
    );


    const panHandle =
      box(
        new THREE.Vector3(
          .24,
          1.35,
          .15
        ),
        0x202122,
        new THREE.Vector3(
          -4.45,
          1.57,
          -3.10
        ),
        .50,
        .35
      );


    panHandle.rotation.z =
      -.15;


    world.add(
      panHandle
    );


    /*
     * Bright chef towel.
     */
    world.add(
      box(
        new THREE.Vector3(
          .95,
          1.15,
          .08
        ),
        0xd85846,
        new THREE.Vector3(
          4.55,
          2.18,
          -3.15
        ),
        .92
      )
    );


    /*
     * Salt + pepper grinders.
     */
    [
      {
        x: -4.50,
        color: 0xf0e8d4
      },
      {
        x: -3.95,
        color: 0x292322
      }
    ]
      .forEach(
        item => {

          const grinder =
            new THREE.Mesh(

              new THREE
                .CylinderGeometry(
                  .15,
                  .20,
                  .72,
                  16
                ),

              material(
                item.color,
                .64
              )

            );


          grinder.position.set(
            item.x,
            .66,
            1.05
          );


          grinder.castShadow =
            true;


          world.add(
            grinder
          );

        }
      );


    /*
     * Small bowl.
     */
    const bowl =
      new THREE.Mesh(

        new THREE
          .CylinderGeometry(
            .58,
            .42,
            .30,
            28,
            1,
            true
          ),

        material(
          0x60a9c4,
          .58
        )

      );


    bowl.position.set(
      -3.15,
      .45,
      2.40
    );


    bowl.castShadow =
      true;


    world.add(
      bowl
    );


    /*
     * Cartoon lemons in the bowl.
     */
    [
      [-3.38, .72, 2.38],
      [-3.00, .72, 2.34],
      [-3.18, .84, 2.58]
    ]
      .forEach(
        position => {

          const lemon =
            new THREE.Mesh(

              new THREE
                .SphereGeometry(
                  .24,
                  18,
                  12
                ),

              material(
                0xf2c932,
                .74
              )

            );


          lemon.position.set(
            ...position
          );


          lemon.scale.set(
            1.18,
            .90,
            .90
          );


          lemon.castShadow =
            true;


          world.add(
            lemon
          );

        }
      );


    /*
     * Chopped vegetables scattered
     * around the cutting board.
     */
    [
      [-2.0, .39, 1.50, 0x67a84a],
      [-1.62, .39, 1.78, 0xe8cd48],
      [2.15, .39, 2.12, 0x67a84a],
      [2.52, .39, 1.88, 0xdd5a38],
      [3.02, .39, 2.32, 0xe8cd48]
    ]
      .forEach(
        item => {

          const cube =
            box(
              new THREE.Vector3(
                .28,
                .22,
                .28
              ),
              item[3],
              new THREE.Vector3(
                item[0],
                item[1],
                item[2]
              ),
              .78
            );


          cube.rotation.y =
            Math.random() *
            Math.PI;


          world.add(
            cube
          );

        }
      );

  }  

  /*
   * =======================================================
   * REAL 3D KNIFE
   * =======================================================
   */

  function buildKnife() {

    const knife =
      new THREE.Group();


    /*
     * Knife stands on its side.
     * Broad blade is vertical.
     * Sharp edge is at the top.
     */
    knife.position.set(
      .10,
      .34,
      .05
    );


    knife.rotation.y =
      -.035;


    world.add(
      knife
    );


    /*
     * Chunky cartoon wooden handle.
     */
    const handle =
      box(
        new THREE.Vector3(
          2.15,
          .60,
          .76
        ),
        0x4a2b1c,
        new THREE.Vector3(
          -3.70,
          .92,
          0
        ),
        .72
      );


    knife.add(
      handle
    );


    /*
     * Lighter top face gives the
     * handle readable 3D volume.
     */
    knife.add(
      box(
        new THREE.Vector3(
          1.92,
          .12,
          .78
        ),
        0x704126,
        new THREE.Vector3(
          -3.70,
          1.18,
          -.01
        ),
        .68
      )
    );


    /*
     * Metal guard.
     */
    knife.add(
      box(
        new THREE.Vector3(
          .22,
          1.30,
          1.00
        ),
        0x70767a,
        new THREE.Vector3(
          -2.56,
          .92,
          0
        ),
        .24,
        .88
      )
    );


    /*
     * Handle rivets.
     */
    [
      -4.13,
      -3.35
    ]
      .forEach(
        x => {

          const rivet =
            new THREE.Mesh(

              new THREE
                .CylinderGeometry(
                  .095,
                  .095,
                  .80,
                  18
                ),

              material(
                0xc5bbaa,
                .24,
                .82
              )

            );


          rivet.rotation.x =
            Math.PI /
            2;


          rivet.position.set(
            x,
            .93,
            0
          );


          rivet.castShadow =
            true;


          knife.add(
            rivet
          );

        }
      );


    /*
     * Vertical chef blade silhouette.
     *
     * Top side is intentionally almost
     * straight: that is the edge the
     * character walks along.
     */
    const shape =
      new THREE.Shape();


    shape.moveTo(
      -2.55,
      -.58
    );


    shape.lineTo(
      2.66,
      -.42
    );


    shape.lineTo(
      3.62,
      .03
    );


    shape.lineTo(
      2.58,
      .62
    );


    shape.lineTo(
      -2.55,
      .62
    );


    shape.closePath();


    const bladeGeometry =
      new THREE.ExtrudeGeometry(
        shape,
        {
          depth:
            .18,

          bevelEnabled:
            true,

          bevelSegments:
            1,

          bevelSize:
            .025,

          bevelThickness:
            .025
        }
      );


    /*
     * Center extrusion around Z=0.
     */
    bladeGeometry.translate(
      0,
      0,
      -.09
    );


    const blade =
      new THREE.Mesh(

        bladeGeometry,

        new THREE
          .MeshStandardMaterial({

            color:
              0xc9cfd2,

            roughness:
              .20,

            metalness:
              .96

          })

      );


    /*
     * IMPORTANT:
     * no Math.PI / 2 rotation here.
     *
     * Blade remains vertical.
     */
    blade.position.set(
      0,
      .90,
      0
    );


    blade.castShadow =
      true;


    blade.receiveShadow =
      true;


    knife.add(
      blade
    );


    /*
     * Dark lower bevel.
     */
    knife.add(
      box(
        new THREE.Vector3(
          5.15,
          .075,
          .20
        ),
        0x72797d,
        new THREE.Vector3(
          -.02,
          .37,
          0
        ),
        .16,
        .92
      )
    );


    /*
     * Bright actual cutting edge.
     *
     * World Y becomes approximately
     * KNIFE_EDGE_Y.
     */
    const edge =
      box(
        new THREE.Vector3(
          5.18,
          .038,
          .17
        ),
        0xf9ffff,
        new THREE.Vector3(
          .02,
          1.53,
          0
        ),
        .08,
        1
      );


    edge.castShadow =
      false;


    knife.add(
      edge
    );


    /*
     * Small reflected highlight down
     * the side of the blade.
     */
    knife.add(
      box(
        new THREE.Vector3(
          4.65,
          .055,
          .19
        ),
        0xeaf2f4,
        new THREE.Vector3(
          -.20,
          1.36,
          -.015
        ),
        .10,
        .94
      )
    );

  }

  function buildPlate() {

    plateGroup =
      new THREE.Group();


    plateGroup.position.set(
      1.2,
      .36,
      2.35
    );


    world.add(
      plateGroup
    );


    const plate =
      new THREE.Mesh(

        new THREE
          .CylinderGeometry(
            1.82,
            2.02,
            .13,
            64
          ),

        material(
          0xeee9dc,
          .42
        )

      );


    plate.receiveShadow =
      true;


    plate.castShadow =
      true;


    plateGroup.add(
      plate
    );


    const ring =
      new THREE.Mesh(

        new THREE
          .TorusGeometry(
            1.52,
            .08,
            12,
            64
          ),

        material(
          0xc8c3b9,
          .5
        )

      );


    ring.rotation.x =
      Math.PI /
      2;


    ring.position.y =
      .09;


    plateGroup.add(
      ring
    );

  }


  function buildVegetables() {

    /*
     * Tomato.
     */
    const tomato =
      new THREE.Mesh(

        new THREE
          .SphereGeometry(
            .42,
            28,
            18
          ),

        material(
          0xc9302c,
          .7
        )

      );


    tomato.scale.y =
      .82;


    tomato.position.set(
      4.55,
      .6,
      1.7
    );


    tomato.castShadow =
      true;


    world.add(
      tomato
    );


    const stem =
      new THREE.Mesh(

        new THREE
          .ConeGeometry(
            .22,
            .32,
            7
          ),

        material(
          0x43843b,
          .8
        )

      );


    stem.position.set(
      4.55,
      .98,
      1.7
    );


    stem.rotation.z =
      .2;


    world.add(
      stem
    );


    /*
     * Carrot.
     */
    const carrot =
      new THREE.Mesh(

        new THREE
          .ConeGeometry(
            .26,
            1.35,
            18
          ),

        material(
          0xe87922,
          .75
        )

      );


    carrot.rotation.z =
      Math.PI /
      2.6;


    carrot.position.set(
      3.85,
      .65,
      2.55
    );


    carrot.castShadow =
      true;


    world.add(
      carrot
    );


    /*
     * Onion.
     */
    const onion =
      new THREE.Mesh(

        new THREE
          .SphereGeometry(
            .34,
            24,
            16
          ),

        material(
          0x7f4a79,
          .74
        )

      );


    onion.scale.y =
      1.12;


    onion.position.set(
      -4.7,
      .58,
      2.15
    );


    onion.castShadow =
      true;


    world.add(
      onion
    );

  }


  function resizeRenderer() {

    if (
      !renderer ||
      !canvas
    ) {

      return;

    }


    const stage =
      el(
        "lagoKnifeStage"
      );


    if (!stage) {
      return;
    }


    const width =
      Math.max(
        1,
        stage.clientWidth
      );


    const height =
      Math.max(
        1,
        stage.clientHeight
      );


    /*
     * Limit pixel ratio on phones.
     */
    renderer.setPixelRatio(
  Math.min(
    window.devicePixelRatio ||
    1,

    window.innerWidth <=
      720

      ? 1.15
      : 1.3
  )
);


    renderer.setSize(
      width,
      height,
      false
    );


    camera.aspect =
      width /
      height;


    camera
      .updateProjectionMatrix();

  }


  /*
   * =======================================================
   * GLB CHARACTER
   * =======================================================
   */

   async function loadCharacter(
    modelUrl
  ) {

    const key =
      String(
        modelUrl ||
        ""
      ).trim();


    if (!key) {

      throw new Error(
        "Missing character model URL"
      );

    }


    const api =
      window.LAGO_CHARACTER_3D;


    if (
      !api ||
      typeof api.cloneModel !==
        "function"
    ) {

      throw new Error(
        "Canonical 3D model cache is not ready"
      );

    }


    /*
     * Reuse Lago's already parsed GLB.
     *
     * No second GLTFLoader.
     * No second GLB parse.
     */
    return api.cloneModel(
      key
    );

  }


    function prepareCharacterForKnife(
    root
  ) {

    /*
     * Canonical GLB is already normalized
     * by LAGO_CHARACTER_3D.
     *
     * Previous 0.62 made characters read
     * like tiny figurines.
     */
    const KNIFE_CHARACTER_SCALE =
      0.90;


    root.scale.multiplyScalar(
      KNIFE_CHARACTER_SCALE
    );


    root.updateMatrixWorld(
      true
    );


    const bounds =
      new THREE.Box3()
        .setFromObject(
          root
        );


    const center =
      bounds.getCenter(
        new THREE.Vector3()
      );


    /*
     * Center horizontally.
     */
    root.position.x -=
      center.x;


    root.position.z -=
      center.z;


    /*
     * Bottom of actual 3D model sits
     * directly on the cutting edge.
     */
    root.position.y -=
      bounds.min.y;


    root.traverse(
      child => {

        if (
          !child.isMesh
        ) {

          return;

        }


        /*
         * Real model shadows are crucial:
         * they stop the character looking
         * like a flat sticker.
         */
        child.castShadow =
          true;


        child.receiveShadow =
          true;

      }
    );


    root.updateMatrixWorld(
      true
    );

  }

  async function mountSelectedCharacter() {

    if (!context) {
      return;
    }


    const characterId =
      String(
        context.characterId ||
        ""
      );


    /*
     * =====================================================
     * VOLUMETRIC CHARACTER PATH
     * =====================================================
     *
     * Marvin uses real generated
     * volumetric Three.js geometry.
     */
    if (
      supportsVolumetricCharacter(
        characterId
      )
    ) {

     const key =
  `volumetric:${characterId}:v2`;;


      /*
       * Already mounted.
       */
      if (
        characterModel &&
        activeModelUrl === key
      ) {

        characterModel.visible =
          true;

        return;

      }


      clearCharacter();


      characterModel =
        createVolumetricCharacter(
          characterId,
          {
            outlines:
              true
          }
        );


      if (!characterModel) {

        throw new Error(
          `Volumetric character failed: ${characterId}`
        );

      }


      /*
       * Important:
       * do NOT call prepareCharacterForKnife().
       *
       * Volumetric model is already
       * built in normal upright XYZ.
       */
      activeModelUrl =
        key;


      characterPivot.add(
        characterModel
      );


      resetCharacterPose();


      console.info(
        "[LAGO KNIFE] volumetric character mounted:",
        characterId
      );


      return;

    }


    /*
     * =====================================================
     * LEGACY GLB FALLBACK
     * =====================================================
     *
     * All characters except Marvin
     * still use canonical GLB cache.
     */
    const url =
      String(
        context.characterModel3d ||
        ""
      ).trim();


    if (!url) {

      throw new Error(
        "Selected character has no GLB"
      );

    }


    if (
      characterModel &&
      activeModelUrl === url
    ) {

      characterModel.visible =
        true;

      return;

    }


    clearCharacter();


    characterModel =
      await loadCharacter(
        url
      );


    prepareCharacterForKnife(
      characterModel
    );


    activeModelUrl =
      url;


    characterPivot.add(
      characterModel
    );


    resetCharacterPose();

  }


  function clearCharacter() {

    clearFallPieces();


    if (
      characterModel &&
      characterPivot
    ) {

      characterPivot.remove(
        characterModel
      );


      /*
       * Generated geometry owns its
       * materials/geometries and must
       * release them explicitly.
       */
      if (
        characterModel
          .userData
          ?.lagoVolumetric ===
        true
      ) {

        disposeVolumetricCharacter(
          characterModel
        );

      }

    }


    characterModel =
      null;


    activeModelUrl =
      "";

  }



  function resetCharacterPose() {

    if (!characterPivot) {
      return;
    }


    characterPivot.visible =
      true;


    characterPivot.position.set(
      KNIFE_START_X,
      KNIFE_EDGE_Y,
      KNIFE_EDGE_Z
    );


    characterPivot.rotation.set(
      0,
      -.12,
      0
    );


    characterPivot.scale.set(
      1,
      1,
      1
    );

  }


  /*
   * =======================================================
   * UI STATE
   * =======================================================
   */

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


   /*
   * Needle directly represents
   * physical character balance.
   */
 function updateBalanceUi() {

  const needle =
    el(
      "lagoBalanceNeedle"
    );


  const status =
    el(
      "lagoBalanceStatus"
    );


  const cfg =
    currentLevelProfile();


  const magnitude =
    Math.abs(
      balance
    );


  const normalized =
    THREE.MathUtils.clamp(

      balance /
      cfg.failLimit,

      -1,

      1

    );


  const degrees =
    normalized *
    78;


  const centerLimit =
    cfg.failLimit *
    .20;


  const warningLimit =
    cfg.failLimit *
    .60;


  if (needle) {

    needle.style.transform =
      `rotate(${degrees}deg)`;


    needle.style.stroke =
      magnitude <
      warningLimit

        ? "#ffffff"

        : "#ff6a5f";

  }


  if (status) {

    status.textContent =
      magnitude <
      centerLimit

        ? `LEVEL ${round} · CENTER`

        : magnitude <
          warningLimit

          ? `LEVEL ${round} · CORRECT`

          : `LEVEL ${round} · DANGER`;


    status.style.color =
      magnitude <
      warningLimit

        ? "#ccff00"

        : "#ff5b52";

  }

}


  /*
   * =======================================================
   * OPEN / CLOSE
   * =======================================================
   */

  async function show(
    detail = {}
  ) {

    createOverlay();

    createRenderer();


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


    balance =
      0;


    balanceVelocity =
      0;


    inputAxis =
      0;


    overlay.classList.add(
      "active"
    );


    resizeRenderer();

    updateHud();

    updateBalanceUi();


    if (
      el(
        "lagoKnifeFeedback"
      )
    ) {

      el(
        "lagoKnifeFeedback"
      ).textContent =
        "KEEP THE NEEDLE NEAR CENTER";

    }


    try {

      await mountSelectedCharacter();

    } catch (
      error
    ) {

      console.error(
        "[LAGO KNIFE] character load failed",
        error
      );

    }


    renderFrame();


    const currentGame =
      game();


    const stats =
      runtime()
        ?.getStats
        ?.(
          GAME_ID
        ) ||
      {};


    setPanel({

      title:
        "KNIFE CHALLENGE 3D",

      copy:
        `Hold LEFT / RIGHT to keep balance while the character crawls along the real 3D blade. ${
          currentGame
            ?.dumCost ||
          0
        } DUM per run.`,

      result:
        stats.plays >
        0

          ? `BEST ${Math.floor(
              stats
                .bestScore ||
              0
            )}`

          : "",

      primary:
        "START",

      show:
        true

    });

  }


  function closeGame() {

    stopLoop();

    clearResolveTimer();


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


    inputAxis =
      0;


    pressedKeys.clear();


    clearFallPieces();


    overlay
      ?.classList.remove(
        "active"
      );

  }


  /*
   * =======================================================
   * RUN
   * =======================================================
   */

  async function startRun() {

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
      result
        .session
        .sessionId;


    round =
      0;


    lives =
      STARTING_LIVES;


    score =
      0;


    phase =
      "running";


    updateHud();


    setPanel({
      show:
        false
    });


    try {

      await mountSelectedCharacter();

    } catch (
      error
    ) {

      console.error(
        "[LAGO KNIFE] character load failed",
        error
      );

    }


    startNextRound();

  }


  function startNextRound() {

  clearResolveTimer();

  clearFallPieces();


  if (
    phase !==
    "running"
  ) {

    return;

  }


  if (
    lives <= 0 ||
    round >= TOTAL_ROUNDS
  ) {

    finishGame();

    return;

  }


  round +=
    1;


  walkProgress =
    0;


  balanceQuality =
    0;


  inputAxis =
    0;


  dangerTime =
    0;


  const cfg =
    currentLevelProfile();


  /*
   * Set the level clock first.
   */
  roundStartedAt =
    performance.now();


  lastFrameAt =
    roundStartedAt;


  balance =
    THREE.MathUtils.randFloat(

      -cfg.startBalance,

      cfg.startBalance

    );


  balanceVelocity =
    THREE.MathUtils.randFloat(

      -cfg.startVelocity,

      cfg.startVelocity

    );


  balanceBias =
    THREE.MathUtils.randFloat(

      -cfg.bias,

      cfg.bias

    );


  nextBalanceBiasAt =
    roundStartedAt +
    THREE.MathUtils.randFloat(
      450,
      900
    );


  nextHazardAt =
    roundStartedAt +
    THREE.MathUtils.randFloat(

      cfg.hazardMin,

      cfg.hazardMax

    );


  resetCharacterPose();

  updateHud();

  updateBalanceUi();


  const feedback =
    el(
      "lagoKnifeFeedback"
    );


  if (feedback) {

    feedback.textContent =
      `LEVEL ${round}/${TOTAL_ROUNDS}`;

  }


  requestLoop();

}
  function requestLoop() {

    stopLoop();


    animationFrame =
      requestAnimationFrame(
        frame
      );

  }


  /*
   * =======================================================
   * BALANCE PHYSICS
   * =======================================================
   */

  function frame(
  now
) {

  animationFrame =
    0;


  if (
    phase !==
    "running"
  ) {

    renderFrame();

    return;

  }


  const cfg =
    currentLevelProfile();


  const dt =
    THREE.MathUtils.clamp(

      (
        now -
        lastFrameAt
      ) /
      1000,

      .001,

      .04

    );


  lastFrameAt =
    now;


  /*
   * Difficulty also rises slightly
   * while approaching knife tip.
   */
  const tipPressure =
    1 +
    walkProgress *
    .24;


  /*
   * Multi-frequency wobble prevents
   * learning one fixed rhythm.
   */
  const noise =

    Math.sin(
      now *
      .0029 +
      round *
      1.31
    ) *
    .58 +

    Math.sin(
      now *
      .0067 +
      round *
      .73
    ) *
    .32 +

    Math.sin(
      now *
      .0121
    ) *
    .16;


  /*
   * Center of gravity slowly shifts.
   */
  if (
    now >=
    nextBalanceBiasAt
  ) {

    balanceBias =
      THREE.MathUtils.randFloat(

        -cfg.bias,

        cfg.bias

      ) *
      tipPressure;


    nextBalanceBiasAt =
      now +
      THREE.MathUtils.randFloat(
        420,
        820
      );

  }


  /*
   * Random kitchen/table impulse.
   *
   * Level 1 rarely gets one.
   * Level 8 gets them frequently.
   */
  if (
    now >=
    nextHazardAt
  ) {

    const impulse =
      THREE.MathUtils.randFloat(

        -cfg.hazardImpulse,

        cfg.hazardImpulse

      ) *
      tipPressure;


    balanceVelocity +=
      impulse;


    nextHazardAt =
      now +
      THREE.MathUtils.randFloat(

        cfg.hazardMin,

        cfg.hazardMax

      );


    const feedback =
      el(
        "lagoKnifeFeedback"
      );


    if (feedback) {

      feedback.textContent =
        impulse < 0

          ? `LEVEL ${round} · HIT ◀`

          : `LEVEL ${round} · HIT ▶`;

    }

  }


  /*
   * Inverted pendulum.
   *
   * Leaning creates additional
   * force in the same direction.
   */
  const unstableForce =
    balance *
    cfg.gravity *
    tipPressure;


  const randomForce =
    (
      noise *
      cfg.noise +
      balanceBias
    ) *
    tipPressure;


  const controlForce =
    inputAxis *
    cfg.control;


  balanceVelocity +=
    (
      unstableForce +
      randomForce +
      controlForce
    ) *
    dt;


  /*
   * Higher levels retain more momentum.
   */
  balanceVelocity *=
    Math.pow(
      cfg.damping,
      dt
    );


  balance +=
    balanceVelocity *
    dt;


  balanceQuality +=
    Math.max(

      0,

      1 -
      Math.abs(
        balance
      ) /
      cfg.failLimit

    ) *
    dt;


  walkProgress =
    THREE.MathUtils.clamp(

      (
        now -
        roundStartedAt
      ) /
      cfg.duration,

      0,

      1

    );


  updateCharacterPose(
    now
  );


  updateBalanceUi();


  updateFallPieces(
    dt
  );


  /*
   * Danger zone has a rescue window.
   *
   * Window becomes shorter each level.
   */
  const dangerEdge =
    cfg.failLimit *
    .70;


  if (
    Math.abs(
      balance
    ) >=
    dangerEdge
  ) {

    dangerTime +=
      dt;

  } else {

    dangerTime =
      Math.max(

        0,

        dangerTime -
        dt *
        2.4

      );

  }


  if (
    dangerTime >=
      cfg.dangerGrace ||

    Math.abs(
      balance
    ) >=
      cfg.failLimit *
      1.10
  ) {

    failRound();

    return;

  }


  if (
    walkProgress >= 1
  ) {

    completeRound();

    return;

  }


  renderFrame();

  requestLoop();

}


    function updateCharacterPose(
    now
  ) {

    if (
      !characterPivot ||
      !characterModel
    ) {

      return;

    }


    const x =
      THREE.MathUtils.lerp(
        KNIFE_START_X,
        KNIFE_END_X,
        walkProgress
      );


    /*
     * Fake gait for non-rigged GLBs.
     *
     * We animate the whole body instead
     * of requiring skeletal animations.
     */
    const stride =
      Math.sin(
        now *
        .014 +
        walkProgress *
        Math.PI *
        10
      );


    const bob =
      Math.abs(
        stride
      ) *
      .055;


    const gaitRock =
      stride *
      .055;


    const yawRock =
      Math.sin(
        now *
        .006
      ) *
      .035;


    /*
     * As balance worsens the whole
     * character physically shifts away
     * from the razor edge.
     */
    const lateral =
      balance *
      .17;


    characterPivot.position.set(

      x,

      KNIFE_EDGE_Y +
      bob,

      KNIFE_EDGE_Z +
      lateral

    );


    /*
     * Face along the blade (+X).
     *
     * X rotation = actual left/right
     * balance over the thin knife edge.
     */
    characterPivot.rotation.set(

      balance *
        .98 +
      gaitRock *
        .20,

      Math.PI /
        2 +
      yawRock,

      gaitRock

    );

  }


  function completeRound() {

    stopLoop();


    phase =
      "resolving";


    inputAxis =
      0;


  const cfg =
  currentLevelProfile();


const averageQuality =
  THREE.MathUtils.clamp(

    balanceQuality /
    (
      cfg.duration /
      1000
    ),

    0,

    1

  );


const gained =
  Math.floor(

    (
      100 +
      averageQuality *
      90 +
      round *
      12
    ) *

    cfg.scoreMultiplier

  );

    score +=
      gained;


    updateHud();


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
        ROUND_GAP_MS
      );


    renderFrame();

  }


  /*
   * =======================================================
   * 3D CUT / FALL
   * =======================================================
   */

  function failRound() {

    stopLoop();


    phase =
      "resolving";


    inputAxis =
      0;


    lives =
      Math.max(
        0,
        lives -
        1
      );


    updateHud();


    if (
      el(
        "lagoKnifeFeedback"
      )
    ) {

      el(
        "lagoKnifeFeedback"
      ).textContent =
        "LOST BALANCE · CUT";

    }


    /*
     * No blood / no gore.
     *
     * GLB itself is duplicated,
     * clipped into two 3D halves
     * and both pieces fall toward
     * the plate.
     */
    createSplitFall();


    const start =
      performance.now();


    let fallFrameAt =
      start;


    const animateFall =
      now => {

        if (
          phase !==
          "resolving"
        ) {

          return;

        }


        const dt =
          THREE.MathUtils.clamp(

            (
              now -
              fallFrameAt
            ) /
            1000,

            .001,
            .04

          );


        fallFrameAt =
          now;


        updateFallPieces(
          dt
        );


        renderFrame();


        if (
          now -
          start <
          1050
        ) {

          animationFrame =
            requestAnimationFrame(
              animateFall
            );

        }

      };


    animationFrame =
      requestAnimationFrame(
        animateFall
      );


    resolveTimer =
      window.setTimeout(
        () => {

          resolveTimer =
            0;


          if (
            phase !==
            "resolving"
          ) {

            return;

          }


          if (
            lives <=
            0
          ) {

            finishGame();

            return;

          }


          phase =
            "running";


          startNextRound();

        },
        FAIL_GAP_MS
      );

  }


  function createSplitFall() {

    clearFallPieces();


    if (
      !characterModel ||
      !characterPivot ||
      !scene
    ) {

      return;

    }


    characterPivot
      .updateMatrixWorld(
        true
      );


    const startPosition =
      new THREE.Vector3();


    const startQuaternion =
      new THREE.Quaternion();


    const startScale =
      new THREE.Vector3();


    characterPivot
      .matrixWorld
      .decompose(
        startPosition,
        startQuaternion,
        startScale
      );


    /*
     * Hide original whole model.
     */
    characterPivot.visible =
      false;


    const plateTarget =
      new THREE.Vector3();


    plateGroup
      ?.getWorldPosition(
        plateTarget
      );


    /*
     * Create actual two clipped
     * copies of same GLB.
     */
    [
      -1,
      1
    ]
      .forEach(
        side => {

          const group =
            new THREE.Group();


          group.position.copy(
            startPosition
          );


          group.quaternion.copy(
            startQuaternion
          );


          group.scale.copy(
            startScale
          );


          const model =
            characterModel
              .clone(
                true
              );


          const plane =
            new THREE.Plane();


          /*
           * Materials must be cloned
           * so clipping doesn't affect
           * original character.
           */
          model.traverse(
            child => {

              if (
                !child.isMesh
              ) {

                return;

              }


              const source =
                Array.isArray(
                  child.material
                )

                  ? child.material

                  : [
                      child.material
                    ];


              const cloned =
                source.map(
                  mat => {

                    const copy =
                      mat.clone();


                    copy.clippingPlanes =
                      [
                        plane
                      ];


                    copy.clipShadows =
                      true;


                    copy.side =
                      THREE.DoubleSide;


                    copy.needsUpdate =
                      true;


                    return copy;

                  }
                );


              child.material =
                Array.isArray(
                  child.material
                )

                  ? cloned

                  : cloned[
                      0
                    ];


              child.castShadow =
                true;


              child.receiveShadow =
                true;

            }
          );


          group.add(
            model
          );


          scene.add(
            group
          );


          fallPieces.push({

            side,

            group,

            plane,

            target:
              plateTarget
                .clone()
                .add(
                  new THREE.Vector3(
                    side *
                    .48,
                    .22,
                    side *
                    .08
                  )
                ),

            velocity:
              new THREE.Vector3(
                side *
                .48,
                -.35,
                1.15
              ),

            rotationSpeed:
              new THREE.Vector3(
                side *
                .75,
                .25,
                side *
                2.4
              ),

            age:
              0

          });

        }
      );

  }


  function updateFallPieces(
    dt
  ) {

    if (
      !fallPieces.length
    ) {

      return;

    }


    const tempPos =
      new THREE.Vector3();


    const tempQuat =
      new THREE.Quaternion();


    fallPieces.forEach(
      piece => {

        piece.age +=
          dt;


        /*
         * Gravity.
         */
        piece.velocity.y -=
          1.9 *
          dt;


        /*
         * Weak attraction toward plate
         * guarantees pieces land there.
         */
        piece.velocity.add(

          piece.target
            .clone()
            .sub(
              piece
                .group
                .position
            )
            .multiplyScalar(
              .85 *
              dt
            )

        );


        piece.group.position
          .addScaledVector(
            piece.velocity,
            dt
          );


        piece.group.rotation.x +=
          piece
            .rotationSpeed
            .x *
          dt;


        piece.group.rotation.y +=
          piece
            .rotationSpeed
            .y *
          dt;


        piece.group.rotation.z +=
          piece
            .rotationSpeed
            .z *
          dt;


        piece.group
          .updateMatrixWorld(
            true
          );


        /*
         * Clipping plane travels
         * with each falling half.
         */
        piece.group
          .getWorldPosition(
            tempPos
          );


        piece.group
          .getWorldQuaternion(
            tempQuat
          );


        const normal =
          new THREE.Vector3(
            piece.side,
            0,
            0
          )
            .applyQuaternion(
              tempQuat
            )
            .normalize();


        piece.plane
          .setFromNormalAndCoplanarPoint(
            normal,
            tempPos
          );


        /*
         * Settle on plate.
         */
        if (
          piece.age >
            .7 &&
          piece
            .group
            .position
            .y <
            .72
        ) {

          piece
            .group
            .position
            .y =
            .72;


          piece.velocity
            .multiplyScalar(
              .55
            );


          piece.velocity.y =
            0;

        }

      }
    );

  }


  function clearFallPieces() {

    if (!scene) {

      fallPieces =
        [];

      return;

    }


    fallPieces.forEach(
      piece => {

        scene.remove(
          piece.group
        );


        /*
         * We cloned materials only.
         * Geometry remains shared/cacheable.
         */
        piece.group.traverse(
          child => {

            if (
              !child.isMesh
            ) {

              return;

            }


            const materials =
              Array.isArray(
                child.material
              )

                ? child.material

                : [
                    child.material
                  ];


            materials.forEach(
              mat =>
                mat
                  ?.dispose
                  ?.()
            );

          }
        );

      }
    );


    fallPieces =
      [];


    if (
      characterPivot
    ) {

      characterPivot.visible =
        true;

    }

  }


  /*
   * =======================================================
   * FINISH
   * =======================================================
   */

  function finishGame() {

    stopLoop();

    clearResolveTimer();


    if (!sessionId) {
      return;
    }


    const reward =
      Math.min(

        game()
          ?.maxRewardSP ||
        0,

        Math.floor(
          score *
          .18
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
        ) ||
      {};


    setPanel({

      title:
        lives >
        0

          ? "RUN COMPLETE"

          : "CHEF'S PLATE",

      copy:
        `Score ${Math.floor(
          score
        )}. Best ${Math.floor(
          stats
            .bestScore ||
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


    renderFrame();

  }


  function renderFrame() {

    if (
      renderer &&
      scene &&
      camera
    ) {

      renderer.render(
        scene,
        camera
      );

    }

  }


  function stopLoop() {

    if (
      !animationFrame
    ) {

      return;

    }


    cancelAnimationFrame(
      animationFrame
    );


    animationFrame =
      0;

  }


  function clearResolveTimer() {

    if (
      !resolveTimer
    ) {

      return;

    }


    clearTimeout(
      resolveTimer
    );


    resolveTimer =
      0;

  }


  /*
   * =======================================================
   * KEYBOARD
   * =======================================================
   */

  function setKeyboardAxis() {

    const left =

      pressedKeys.has(
        "ArrowLeft"
      ) ||

      pressedKeys.has(
        "a"
      ) ||

      pressedKeys.has(
        "A"
      );


    const right =

      pressedKeys.has(
        "ArrowRight"
      ) ||

      pressedKeys.has(
        "d"
      ) ||

      pressedKeys.has(
        "D"
      );


    inputAxis =
      left ===
      right

        ? 0

        : left

          ? -1

          : 1;

  }


  document.addEventListener(
    "keydown",
    event => {

      if (
        !overlay
          ?.classList
          .contains(
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
        [
          "ArrowLeft",
          "ArrowRight",
          "a",
          "A",
          "d",
          "D"
        ]
          .includes(
            event.key
          )
      ) {

        event.preventDefault();


        pressedKeys.add(
          event.key
        );


        setKeyboardAxis();

      }

    }
  );


  document.addEventListener(
    "keyup",
    event => {

      if (
        !overlay
          ?.classList
          .contains(
            "active"
          )
      ) {

        return;

      }


      pressedKeys.delete(
        event.key
      );


      setKeyboardAxis();

    }
  );


  /*
   * No hidden-tab gameplay.
   */
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


  window.addEventListener(
    "blur",
    () => {

      pressedKeys.clear();


      inputAxis =
        0;

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

  /*
   * Explicit module-ready signal.
   *
   * Useful for Games Hub diagnostics
   * and future game loading UI.
   */
  document.dispatchEvent(
    new CustomEvent(
      "lago:knife-game-ready",
      {
        detail: {
          version:
            VERSION
        }
      }
    )
  );
  
})();

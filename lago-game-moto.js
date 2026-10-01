import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

(() => {
  "use strict";

  const VERSION = 6;
  const GAME_ID = "lago-moto";

  const MODEL_URL =
    "./assets/model/game/moto/red-dirt-bike.glb?v=1";

  const PREVIEW_URL =
    "./assets/model/game/moto/red-dirt-bike.png?v=1";

  const DEFAULT_RIDER_MODEL =
    "./assets/model/game/characters/lago.glb?v=1";

  const OPTIMIZED_CHARACTER_NAMES = new Set([
    "lago",
    "narek",
    "sola",
    "doc",
    "marvin",
    "farid",
    "miki",
    "oleg",
    "bozz",
    "taya"
  ]);

  const LEVELS = Object.freeze([
    Object.freeze({
      id: 1,
      name: "РАЗМИНКА",
      difficulty: "ЛЕГКО",

      length: 180,
      maxSpeed: 14,
      acceleration: 10.5,

      gravity: 22,
      jumpPower: 8.6,
      landingLimit: 1.28,

      groundColor: 0x78664b,
      lineColor: 0xcbb083,

      skyColor: 0xa8d8e8,
      mountainColor: 0x7899a0,
      farMountainColor: 0x91b3b8,

      gaps: [
        [61, 67],
        [128, 135]
      ],

      obstacles: [
        {
          x: 33,
          type: "rock",
          size: .75
        },
        {
          x: 95,
          type: "log",
          size: .8
        },
        {
          x: 154,
          type: "rock",
          size: .85
        }
      ],

      checkpoints: [
        60,
        120
      ]
    }),

    Object.freeze({
      id: 2,
      name: "ХОЛМЫ",
      difficulty: "НОРМАЛЬНО",

      length: 230,
      maxSpeed: 15.5,
      acceleration: 11,

      gravity: 23,
      jumpPower: 9,
      landingLimit: 1.16,

      groundColor: 0x725c40,
      lineColor: 0xd0a96f,

      skyColor: 0x93c9df,
      mountainColor: 0x718f8d,
      farMountainColor: 0x86a9a9,

      gaps: [
        [54, 62],
        [118, 128],
        [184, 193]
      ],

      obstacles: [
        {
          x: 38,
          type: "rock",
          size: .8
        },
        {
          x: 82,
          type: "barrier",
          size: .85
        },
        {
          x: 102,
          type: "log",
          size: .9
        },
        {
          x: 151,
          type: "rock",
          size: .95
        },
        {
          x: 211,
          type: "log",
          size: .9
        }
      ],

      checkpoints: [
        75,
        150
      ]
    }),

    Object.freeze({
      id: 3,
      name: "КАНЬОН",
      difficulty: "СЛОЖНО",

      length: 285,
      maxSpeed: 16.5,
      acceleration: 11.4,

      gravity: 24,
      jumpPower: 9.3,
      landingLimit: 1.04,

      groundColor: 0x694c37,
      lineColor: 0xc78c58,

      skyColor: 0x88bdd4,
      mountainColor: 0x806b66,
      farMountainColor: 0x9b8580,

      gaps: [
        [48, 58],
        [96, 108],
        [159, 171],
        [231, 245]
      ],

      obstacles: [
        {
          x: 30,
          type: "barrier",
          size: .8
        },
        {
          x: 78,
          type: "rock",
          size: .9
        },
        {
          x: 132,
          type: "log",
          size: 1
        },
        {
          x: 145,
          type: "rock",
          size: .95
        },
        {
          x: 205,
          type: "barrier",
          size: .9
        },
        {
          x: 264,
          type: "rock",
          size: 1.05
        }
      ],

      checkpoints: [
        90,
        190
      ]
    }),

    Object.freeze({
      id: 4,
      name: "ГОРЫ",
      difficulty: "ОЧЕНЬ СЛОЖНО",

      length: 340,
      maxSpeed: 17,
      acceleration: 11.8,

      gravity: 25,
      jumpPower: 9.5,
      landingLimit: .95,

      groundColor: 0x5e5143,
      lineColor: 0xb8a078,

      skyColor: 0x7eaec3,
      mountainColor: 0x66767a,
      farMountainColor: 0x83969a,

      gaps: [
        [66, 78],
        [121, 136],
        [186, 201],
        [255, 272],
        [311, 322]
      ],

      obstacles: [
        {
          x: 36,
          type: "rock",
          size: .9
        },
        {
          x: 53,
          type: "log",
          size: .9
        },
        {
          x: 101,
          type: "barrier",
          size: .95
        },
        {
          x: 161,
          type: "rock",
          size: 1.05
        },
        {
          x: 224,
          type: "log",
          size: 1
        },
        {
          x: 292,
          type: "barrier",
          size: 1.05
        }
      ],

      checkpoints: [
        110,
        220
      ]
    }),

    Object.freeze({
      id: 5,
      name: "БЕЗУМИЕ",
      difficulty: "ЭКСТРИМ",

      length: 410,
      maxSpeed: 18.5,
      acceleration: 12.3,

      gravity: 26,
      jumpPower: 9.8,
      landingLimit: .86,

      groundColor: 0x554338,
      lineColor: 0xc78863,

      skyColor: 0x6e93a8,
      mountainColor: 0x5b6067,
      farMountainColor: 0x777c82,

      gaps: [
        [55, 68],
        [103, 119],
        [154, 171],
        [214, 232],
        [269, 289],
        [327, 346],
        [382, 395]
      ],

      obstacles: [
        {
          x: 31,
          type: "barrier",
          size: .95
        },
        {
          x: 84,
          type: "rock",
          size: 1.05
        },
        {
          x: 135,
          type: "log",
          size: 1.05
        },
        {
          x: 192,
          type: "barrier",
          size: 1.05
        },
        {
          x: 248,
          type: "rock",
          size: 1.15
        },
        {
          x: 307,
          type: "log",
          size: 1.15
        },
        {
          x: 365,
          type: "barrier",
          size: 1.1
        }
      ],

      checkpoints: [
        135,
        270
      ]
    })
   ]);

  const TRACK_LENGTH_SCALE =
    1.65;

  const RUNTIME_LEVELS =
    Object.freeze(
      LEVELS.map(
        config =>
          Object.freeze({
            ...config,

            length:
              Math.round(
                config.length *
                TRACK_LENGTH_SCALE
              ),

            gaps:
              Object.freeze(
                config.gaps.map(
                  ([start, end]) =>
                    Object.freeze([
                      start *
                      TRACK_LENGTH_SCALE,

                      end *
                      TRACK_LENGTH_SCALE
                    ])
                )
              ),

            obstacles:
              Object.freeze(
                config.obstacles.map(
                  obstacle =>
                    Object.freeze({
                      ...obstacle,

                      x:
                        obstacle.x *
                        TRACK_LENGTH_SCALE
                    })
                )
              ),

            checkpoints:
              Object.freeze(
                config.checkpoints.map(
                  x =>
                    x *
                    TRACK_LENGTH_SCALE
                )
              )
          })
      )
    );

  const START_X = 5;
  const BIKE_HALF_LENGTH =
    1.02;

  const FALL_LIMIT_Y =
    -11;

  let overlay = null;
  let stage = null;
  let canvas = null;

  let renderer = null;
  let scene = null;
  let camera = null;

  let worldRoot = null;

  let trackRoot = null;
  let backgroundRoot = null;
  let obstacleRoot = null;
  let markerRoot = null;

   let bikeRoot = null;
  let riderRoot = null;

    let wheelVisuals = [];

  let wheelSpin =
    0;

  let wheelRadiusWorld =
    .48;

  let motionOffset =
    0;

  let voicePanel = null;

  let modelPromise = null;
  let modelReady = false;

  let riderModelUrl = "";

  let riderRequestId =
    0;

  let animationFrame =
    0;

  let controlsAbort =
    null;

  let lastTime =
    0;

  let accumulator =
    0;

  let active =
    false;

  const keys =
    new Set();

  const touch = {
    gas: false,
    brake: false,
    left: false,
    right: false
  };

  const state = {
    levelIndex: 0,

    x: START_X,
    y: 0,

    vx: 0,
    vy: 0,

    pitch: 0,

    grounded: true,

    playing: false,
    crashed: false,
    finished: false,

    elapsed: 0,

    bestCheckpoint:
      START_X,

    crashReason: ""
  };

    function level() {

    return (
      RUNTIME_LEVELS[
        state.levelIndex
      ] ||
      RUNTIME_LEVELS[0]
    );

  }

  function smoothStep(
    a,
    b,
    value
  ) {

    if (
      a ===
      b
    ) {

      return (
        value <
        a

          ? 0
          : 1
      );

    }

    const t =
      THREE.MathUtils.clamp(

        (
          value -
          a
        ) /
        (
          b -
          a
        ),

        0,
        1

      );

    return (
      t *
      t *
      (
        3 -
        2 *
        t
      )
    );

  }


  function isGap(
    x,
    config = level()
  ) {

    return config.gaps.some(

      (
        [
          start,
          end
        ]
      ) =>

        x >
        start &&

        x <
        end

    );

  }


  function baseTerrain(
    x,
    config = level()
  ) {

    const i =
      config.id;

    const wave =

      Math.sin(
        x *
        (
          .056 +
          i *
          .003
        )
      ) *
      (
        .42 +
        i *
        .09
      ) +

      Math.sin(
        x *
        (
          .125 +
          i *
          .004
        )
      ) *
      (
        .25 +
        i *
        .05
      ) +

      Math.sin(
        x *
        .026 +
        i *
        .8
      ) *
      (
        .55 +
        i *
        .12
      );


    const mountains =

      Math.pow(

        Math.max(
          0,

          Math.sin(

            x *
            (
              .021 +
              i *
              .0015
            ) -
            .6

          )

        ),

        2.4

      ) *

      Math.max(
        0,
        i - 1
      ) *

      1.05;


    return (
      wave +
      mountains
    );

  }


  function rampBoost(
    x,
    config = level()
  ) {

    let boost =
      0;


    for (
      const [
        start,
        end
      ]
      of config.gaps
    ) {

      const approach =

        start -

        (
          7 +
          config.id *
          .7
        );


      const crest =
        start -
        3.7;


      if (
        x >= approach &&
        x <= start
      ) {

        const up =
          smoothStep(
            approach,
            crest,
            x
          );


        const down =

          1 -

          smoothStep(
            crest,
            start,
            x
          );


        boost +=

          Math.min(
            up,
            down
          ) *

          (
            1.45 +
            config.id *
            .2
          );

      }


      const landingEnd =

        end +
        6 +
        config.id *
        .4;


      if (
        x >= end &&
        x <= landingEnd
      ) {

        boost -=

          (
            1 -

            smoothStep(
              end,
              landingEnd,
              x
            )
          ) *

          (
            .35 +
            config.id *
            .06
          );

      }

    }


    return boost;

  }


  function terrain(
    x,
    config = level()
  ) {

    if (
      isGap(
        x,
        config
      )
    ) {

      return null;

    }


    return (

      baseTerrain(
        x,
        config
      ) +

      rampBoost(
        x,
        config
      )

    );

  }


  function nearestGround(
    x,
    config = level()
  ) {

    const direct =
      terrain(
        x,
        config
      );


    if (
      direct !==
      null
    ) {

      return direct;

    }


    for (
      let distance = .25;
      distance <= 4;
      distance += .25
    ) {

      const left =
        terrain(
          x -
          distance,
          config
        );


      const right =
        terrain(
          x +
          distance,
          config
        );


      if (
        left !==
        null
      ) {

        return left;

      }


      if (
        right !==
        null
      ) {

        return right;

      }

    }


    return 0;

  }


  function terrainAngle(
    x,
    config = level()
  ) {

    const left =
      terrain(
        x -
        .55,
        config
      );


    const right =
      terrain(
        x +
        .55,
        config
      );


    if (
      left ===
        null ||

      right ===
        null
    ) {

      return 0;

    }


    return Math.atan2(

      right -
      left,

      1.1

    );

  }


  function makeUI() {

    if (
      overlay
    ) {

      return;

    }


    const style =
      document.createElement(
        "style"
      );


    style.textContent = `

      #lagoMoto {

        position:
          fixed;

        inset:
          0;

        z-index:
          23000;

        display:
          none;

        padding:
          calc(
            8px +
            env(safe-area-inset-top)
          )
          8px
          calc(
            8px +
            env(safe-area-inset-bottom)
          );

        background:
          #0d1620;

        color:
          #fff;

        font:
          800 13px
          system-ui,
          sans-serif;

        overscroll-behavior:
          none;

      }


      #lagoMoto.active {

        display:
          flex;

        flex-direction:
          column;

        gap:
          8px;

      }


      .lm-head {

        display:
          flex;

        align-items:
          center;

        justify-content:
          space-between;

        gap:
          8px;

        min-height:
          46px;

      }


      .lm-title-wrap {

        min-width:
          0;

        display:
          flex;

        align-items:
          baseline;

        gap:
          8px;

      }


      .lm-head h2 {

        margin:
          0;

        font-size:
          clamp(
            24px,
            4vw,
            34px
          );

        line-height:
          1;

        white-space:
          nowrap;

      }


      #lmLevelLabel {

        opacity:
          .62;

        font-size:
          10px;

        white-space:
          nowrap;

      }


      .lm-tools,
      .lm-group {

        display:
          flex;

        align-items:
          center;

        gap:
          7px;

      }


      #lmStage {

        flex:
          1;

        min-height:
          0;

        position:
          relative;

        border:
          1px solid
          #ffffff24;

        border-radius:
          14px;

        overflow:
          hidden;

        background:
          #99c9dc;

      }


           #lmCanvas {

        display:
          block;

        width:
          100%;

        height:
          100%;

        touch-action:
          none;

      }


      #lmSpeedFx {

        position:
          absolute;

        inset:
          54% 0 0;

        pointer-events:
          none;

        opacity:
          0;

        background:
          repeating-linear-gradient(
            96deg,
            transparent 0 34px,
            rgba(
              255,
              255,
              255,
              .18
            ) 35px 37px,
            transparent 38px 72px
          );

        -webkit-mask-image:
          linear-gradient(
            to bottom,
            transparent,
            #000 35%,
            #000 78%,
            transparent
          );

        mask-image:
          linear-gradient(
            to bottom,
            transparent,
            #000 35%,
            #000 78%,
            transparent
          );

        will-change:
          background-position,
          opacity;

        mix-blend-mode:
          screen;

      }


      #lmHud,
      #lmLevelBadge {

        position:
          absolute;

        top:
          9px;

        padding:
          7px
          10px;

        border-radius:
          8px;

        pointer-events:
          none;

        white-space:
          nowrap;

      }


      #lmHud {

        left:
          10px;

        max-width:
          calc(
            100% -
            20px
          );

        background:
          #101a25dc;

        font-size:
          12px;

      }


      #lmLevelBadge {

        right:
          10px;

        background:
          #ffffffd8;

        color:
          #17212a;

        font-size:
          10px;

      }


      .lm-controls {

        display:
          flex;

        justify-content:
          space-between;

        gap:
          8px;

      }


      .lm-button {

        border:
          1px solid
          #ffffff3a;

        border-radius:
          10px;

        min-height:
          46px;

        padding:
          9px 13px;

        background:
          #30475c;

        color:
          #fff;

        font:
          900 12px
          system-ui;

        cursor:
          pointer;

        touch-action:
          none;

        user-select:
          none;

      }


      .lm-button:disabled {

        opacity:
          .42;

        cursor:
          default;

      }


      .lm-main {

        background:
          #c8ec42;

        color:
          #182015;

      }


      .lm-help {

        min-height:
          14px;

        text-align:
          center;

        opacity:
          .68;

        font-size:
          10px;

      }


      #lmVoice {

        position:
          relative;

      }


      @media (
        max-width:
        760px
      ) {

        #lagoMoto {

          padding:
            calc(
              5px +
              env(
                safe-area-inset-top
              )
            )
            5px
            calc(
              5px +
              env(
                safe-area-inset-bottom
              )
            );

          gap:
            5px;

        }


        .lm-head {

          min-height:
            40px;

        }


        .lm-head h2 {

          font-size:
            20px;

        }


        #lmLevelLabel {

          display:
            none;

        }


        .lm-button {

          min-height:
            44px;

          padding:
            7px 9px;

          font-size:
            11px;

        }


        .lm-controls,
        .lm-group {

          gap:
            5px;

        }


        .lm-help {

          display:
            none;

        }


        #lmVoice
        .lago-voice-panel {

          max-width:
            180px;

        }

      }


      @media (
        max-width:
        520px
      ) {

        .lm-tools
        #lmVoice {

          display:
            none;

        }


        .lm-button {

          padding:
            7px 8px;

        }


        #lmHud {

          font-size:
            10px;

        }


        #lmLevelBadge {

          font-size:
            9px;

        }

      }

    `;


    document.head.appendChild(
      style
    );


    overlay =
      document.createElement(
        "section"
      );


    overlay.id =
      "lagoMoto";


    overlay.innerHTML = `

      <header class="lm-head">

        <div class="lm-title-wrap">

          <h2>
            LAGO MOTO
          </h2>

          <span
            id="lmLevelLabel"
          ></span>

        </div>


        <div class="lm-tools">

          <div
            id="lmVoice"
          ></div>


          <button
            type="button"
            class="lm-button"
            id="lmClose"
          >
            ЗАКРЫТЬ ×
          </button>

        </div>

      </header>


      <div
        id="lmStage"
      >

               <canvas
          id="lmCanvas"
        ></canvas>


        <div
          id="lmSpeedFx"
        ></div>


        <div
          id="lmHud"
          role="status"
        >
          Загрузка…
        </div>


        <div
          id="lmLevelBadge"
        ></div>

      </div>


      <div class="lm-controls">

        <div class="lm-group">

          <button
            type="button"
            class="lm-button"
            data-hold="left"
          >
            ◀ НАКЛОН
          </button>


          <button
            type="button"
            class="lm-button"
            data-hold="right"
          >
            НАКЛОН ▶
          </button>


          <button
            type="button"
            class="lm-button"
            id="lmJump"
          >
            ПРЫЖОК
          </button>

        </div>


        <div class="lm-group">

          <button
            type="button"
            class="lm-button"
            data-hold="brake"
          >
            ТОРМОЗ
          </button>


          <button
            type="button"
            class="lm-button lm-main"
            data-hold="gas"
          >
            ГАЗ
          </button>


          <button
            type="button"
            class="lm-button"
            id="lmRestart"
            disabled
          >
            СТАРТ
          </button>

        </div>

      </div>


      <div class="lm-help">

        W / ↑ — газ ·
        S / ↓ — тормоз ·
        A / D — наклон ·
        Space — прыжок

      </div>

    `;


    document.body.appendChild(
      overlay
    );


    stage =
      overlay.querySelector(
        "#lmStage"
      );


    canvas =
      overlay.querySelector(
        "#lmCanvas"
      );


    overlay
      .querySelector(
        "#lmClose"
      )
      .addEventListener(
        "click",
        hide
      );

  }


  function disposeGroup(
    group
  ) {

    if (
      !group
    ) {

      return;

    }


    group.traverse(

      child => {

        if (
          !child.isMesh &&
          !child.isLine
        ) {

          return;

        }


        child.geometry
          ?.dispose
          ?.();


        const materials =

          Array.isArray(
            child.material
          )

            ? child.material

            : [
                child.material
              ];


        materials.forEach(

          material =>

            material
              ?.dispose
              ?.()

        );

      }

    );


    group.clear();

  }


  function createMountainLayer({
    color,
    z,
    height,
    width,
    spacing,
    offset
  }) {

    for (
      let x = -40;
      x <=
        level().length +
        80;
      x += spacing
    ) {

      const peakX =

        x +

        width *

        (
          .42 +

          .12 *

          Math.sin(
            x *
            .07 +
            offset
          )
        );


      const geometry =
        new THREE
          .BufferGeometry();


      geometry.setAttribute(

        "position",

        new THREE
          .BufferAttribute(

            new Float32Array([

              x -
              width *
              .55,

              -4.5,
              z,


              peakX,

              height +
              Math.sin(
                x *
                .031
              ) *
              1.4,

              z,


              x +
              width *
              .55,

              -4.5,
              z

            ]),

            3

          )

      );


      backgroundRoot.add(

        new THREE.Mesh(

          geometry,

          new THREE
            .MeshBasicMaterial({

              color,

              side:
                THREE.DoubleSide,

              depthWrite:
                false

            })

        )

      );

    }

  }


  function createBackground() {

    disposeGroup(
      backgroundRoot
    );


    scene.background =
      new THREE.Color(
        level().skyColor
      );


    const sun =
      new THREE.Mesh(

        new THREE
          .CircleGeometry(
            2.2,
            20
          ),

        new THREE
          .MeshBasicMaterial({

            color:
              0xf7e7ad,

            depthWrite:
              false

          })

      );


    sun.position.set(
      16,
      10,
      -12
    );


    backgroundRoot.add(
      sun
    );


    createMountainLayer({

      color:
        level()
          .farMountainColor,

      z:
        -10,

      height:
        5.2,

      width:
        18,

      spacing:
        13,

      offset:
        .4

    });


    createMountainLayer({

      color:
        level()
          .mountainColor,

      z:
        -7,

      height:
        3.8,

      width:
        13,

      spacing:
        10,

      offset:
        1.3

    });

  }


  function addTrackSegment(
    start,
    end
  ) {

    if (
      end -
      start <
      .5
    ) {

      return;

    }


    const config =
      level();


    const shape =
      new THREE.Shape();


    shape.moveTo(
      start,
      -14
    );


    shape.lineTo(

      start,

      nearestGround(
        start,
        config
      )

    );


    for (
      let x = start;
      x <= end;
      x += .28
    ) {

      const y =
        terrain(
          x,
          config
        );


      if (
        y !==
        null
      ) {

        shape.lineTo(
          x,
          y
        );

      }

    }


    shape.lineTo(

      end,

      nearestGround(
        end,
        config
      )

    );


    shape.lineTo(
      end,
      -14
    );


    shape.closePath();


    trackRoot.add(

      new THREE.Mesh(

        new THREE
          .ShapeGeometry(
            shape
          ),

        new THREE
          .MeshLambertMaterial({

            color:
              config
                .groundColor,

            side:
              THREE.DoubleSide

          })

      )

    );


    const points =
      [];


    for (
      let x = start;
      x <= end;
      x += .2
    ) {

      const y =
        terrain(
          x,
          config
        );


      if (
        y !==
        null
      ) {

        points.push(

          new THREE.Vector3(
            x,
            y + .055,
            .03
          )

        );

      }

    }


    if (
      points.length >
      1
    ) {

      trackRoot.add(

        new THREE.Line(

          new THREE
            .BufferGeometry()
            .setFromPoints(
              points
            ),

          new THREE
            .LineBasicMaterial({

              color:
                config
                  .lineColor

            })

        )

      );

    }

  }


  function addMarker(
    x,
    finish
  ) {

    const y =
      nearestGround(
        x
      );


    const post =
      new THREE.Mesh(

        new THREE
          .BoxGeometry(
            .08,
            2.5,
            .08
          ),

        new THREE
          .MeshBasicMaterial({
            color:
              0xf5f5f0
          })

      );


    post.position.set(
      x,
      y + 1.25,
      -.3
    );


    markerRoot.add(
      post
    );


    const flag =
      new THREE.Mesh(

        new THREE
          .PlaneGeometry(
            1.3,
            .55
          ),

        new THREE
          .MeshBasicMaterial({

            color:

              finish

                ? 0xccff00
                : 0xff725c,

            side:
              THREE.DoubleSide

          })

      );


    flag.position.set(
      x + .68,
      y + 2.15,
      -.3
    );


    markerRoot.add(
      flag
    );

  }


  function addObstacle(
    obstacle
  ) {

    const y =
      nearestGround(
        obstacle.x
      );


    let mesh =
      null;


    if (
      obstacle.type ===
      "log"
    ) {

      mesh =
        new THREE.Mesh(

          new THREE
            .CylinderGeometry(

              .34 *
              obstacle.size,

              .4 *
              obstacle.size,

              1.8 *
              obstacle.size,

              8

            ),

          new THREE
            .MeshLambertMaterial({
              color:
                0x68422b
            })

        );


      mesh.rotation.z =
        Math.PI /
        2;

    } else if (
      obstacle.type ===
      "barrier"
    ) {

      mesh =
        new THREE.Mesh(

          new THREE
            .BoxGeometry(

              1 *
              obstacle.size,

              .78 *
              obstacle.size,

              .55

            ),

          new THREE
            .MeshLambertMaterial({
              color:
                0xd56a3f
            })

        );

    } else {

      mesh =
        new THREE.Mesh(

          new THREE
            .DodecahedronGeometry(

              .58 *
              obstacle.size,

              0

            ),

          new THREE
            .MeshLambertMaterial({
              color:
                0x626b6d
            })

        );


      mesh.scale.set(
        1.35,
        .82,
        .68
      );

    }


    mesh.position.set(

      obstacle.x,

      y +
      .48 *
      obstacle.size,

      -.12

    );


    obstacleRoot.add(
      mesh
    );

  }


  function buildTrack() {

    disposeGroup(
      trackRoot
    );

    disposeGroup(
      obstacleRoot
    );

    disposeGroup(
      markerRoot
    );


    const config =
      level();


    let cursor =
      -20;


    for (
      const [
        gapStart,
        gapEnd
      ]
      of config.gaps
    ) {

      addTrackSegment(
        cursor,
        gapStart
      );


      cursor =
        gapEnd;

    }


    addTrackSegment(

      cursor,

      config.length +
      30

    );


    config.obstacles
      .forEach(
        addObstacle
      );


    config.checkpoints
      .forEach(

        x =>
          addMarker(
            x,
            false
          )

      );


    addMarker(
      config.length,
      true
    );


    createBackground();

    updateLevelUI();

  }


  function makeScene() {

    if (
      renderer
    ) {

      return;

    }


    renderer =
      new THREE
        .WebGLRenderer({

          canvas,

          antialias:
            window.innerWidth >
            760,

          alpha:
            false,

          powerPreference:
            "high-performance"

        });


    renderer.outputColorSpace =
      THREE.SRGBColorSpace;


    scene =
      new THREE.Scene();


    camera =
      new THREE
        .OrthographicCamera(

          -10,
          10,

          7,
          -7,

          .1,
          160

        );


    camera.position.set(
      START_X + 3,
      4.5,
      25
    );


    scene.add(

      new THREE
        .HemisphereLight(
          0xffffff,
          0x59644c,
          1.9
        )

    );


    const keyLight =
      new THREE
        .DirectionalLight(
          0xffffff,
          1.8
        );


    keyLight.position.set(
      -10,
      18,
      14
    );


    scene.add(
      keyLight
    );


    worldRoot =
      new THREE.Group();


    backgroundRoot =
      new THREE.Group();


    trackRoot =
      new THREE.Group();


    obstacleRoot =
      new THREE.Group();


    markerRoot =
      new THREE.Group();


    bikeRoot =
      new THREE.Group();


    riderRoot =
      new THREE.Group();


    riderRoot.position.set(
      -.18,
      1.28,
      .12
    );


    riderRoot.rotation.y =
      Math.PI /
      2;


    riderRoot.rotation.z =
      -.08;


    bikeRoot.add(
      riderRoot
    );


    worldRoot.add(
      backgroundRoot,
      trackRoot,
      obstacleRoot,
      markerRoot,
      bikeRoot
    );


    scene.add(
      worldRoot
    );


    buildTrack();

    resize();

  }

     function clearWheelVisuals() {

    for (
      const wheel
      of wheelVisuals
    ) {

      wheel.parent
        ?.remove(
          wheel
        );


      wheel.traverse(

        child => {

          child.geometry
            ?.dispose
            ?.();


          const materials =

            Array.isArray(
              child.material
            )

              ? child.material

              : [
                  child.material
                ];


          materials.forEach(

            material =>
              material
                ?.dispose
                ?.()

          );

        }

      );

    }


    wheelVisuals =
      [];

  }


  function createWheelVisual(
    x,
    y,
    z,
    radius
  ) {

    const wheel =
      new THREE.Group();


    wheel.position.set(
      x,
      y,
      z
    );


    const veilMaterial =
      new THREE.MeshBasicMaterial({

        color:
          0x1d2224,

        transparent:
          true,

        opacity:
          0,

        depthTest:
          false,

        depthWrite:
          false

      });


    const veil =
      new THREE.Mesh(

        new THREE.CircleGeometry(
          radius *
          .72,
          28
        ),

        veilMaterial

      );


    veil.position.z =
      .001;


    veil.renderOrder =
      70;


    wheel.add(
      veil
    );


    const positions =
      [];


    const spokeCount =
      8;


    for (
      let index = 0;
      index < spokeCount;
      index += 1
    ) {

      const angle =

        index /
        spokeCount *
        Math.PI *
        2;


      const inner =
        radius *
        .12;


      const outer =
        radius *
        .68;


      positions.push(

        Math.cos(
          angle
        ) *
        inner,

        Math.sin(
          angle
        ) *
        inner,

        .012,


        Math.cos(
          angle
        ) *
        outer,

        Math.sin(
          angle
        ) *
        outer,

        .012

      );

    }


    const spokeGeometry =
      new THREE.BufferGeometry();


    spokeGeometry.setAttribute(

      "position",

      new THREE.Float32BufferAttribute(
        positions,
        3
      )

    );


    const spokeMaterial =
      new THREE.LineBasicMaterial({

        color:
          0xb5bec0,

        transparent:
          true,

        opacity:
          0,

        depthTest:
          false,

        depthWrite:
          false

      });


    const spokes =
      new THREE.LineSegments(

        spokeGeometry,

        spokeMaterial

      );


    spokes.renderOrder =
      72;


    wheel.add(
      spokes
    );


    const hubMaterial =
      new THREE.MeshBasicMaterial({

        color:
          0x737c7e,

        transparent:
          true,

        opacity:
          0,

        depthTest:
          false,

        depthWrite:
          false

      });


    const hub =
      new THREE.Mesh(

        new THREE.CircleGeometry(
          radius *
          .105,
          14
        ),

        hubMaterial

      );


    hub.position.z =
      .016;


    hub.renderOrder =
      73;


    wheel.add(
      hub
    );


    const markerMaterial =
      new THREE.MeshBasicMaterial({

        color:
          0xe7eceb,

        transparent:
          true,

        opacity:
          0,

        depthTest:
          false,

        depthWrite:
          false

      });


    for (
      let index = 0;
      index < 3;
      index += 1
    ) {

      const angle =

        index /
        3 *
        Math.PI *
        2;


      const marker =
        new THREE.Mesh(

          new THREE.BoxGeometry(

            radius *
            .22,

            Math.max(
              .025,
              radius *
              .045
            ),

            .01

          ),

          markerMaterial

        );


      marker.position.set(

        Math.cos(
          angle
        ) *
        radius *
        .72,

        Math.sin(
          angle
        ) *
        radius *
        .72,

        .02

      );


      marker.rotation.z =
        angle;


      marker.renderOrder =
        74;


      wheel.add(
        marker
      );

    }


    wheel.userData
      .veilMaterial =
      veilMaterial;


    wheel.userData
      .spokeMaterial =
      spokeMaterial;


    wheel.userData
      .hubMaterial =
      hubMaterial;


    wheel.userData
      .markerMaterial =
      markerMaterial;


    bikeRoot.add(
      wheel
    );


    wheelVisuals.push(
      wheel
    );

  }


  function createWheelVisuals(
    fittedBounds
  ) {

    clearWheelVisuals();


    const size =
      fittedBounds.getSize(
        new THREE.Vector3()
      );


    const center =
      fittedBounds.getCenter(
        new THREE.Vector3()
      );


    const radius =

      Math.max(

        .34,

        Math.min(

          size.x *
          .15,

          size.y *
          .245

        )

      );


    wheelRadiusWorld =
      radius;


    const wheelY =

      fittedBounds.min.y +

      size.y *
      .235;


    const xOffset =

      size.x *
      .335;


    const wheelZ =

      fittedBounds.max.z +
      .025;


    createWheelVisual(

      center.x -
      xOffset,

      wheelY,

      wheelZ,

      radius

    );


    createWheelVisual(

      center.x +
      xOffset,

      wheelY,

      wheelZ,

      radius

    );

  }
  function loadBike() {

    if (
      modelPromise
    ) {

      return modelPromise;

    }


    const loader =
      new GLTFLoader();


    modelPromise =
      new Promise(

        resolve => {

          loader.load(

            MODEL_URL,


            gltf => {
                const model =
                gltf.scene;


              model.rotation.y =
                Math.PI;


              model.updateMatrixWorld(
                true
              );


              const bounds =
                new THREE
                  .Box3()
                  .setFromObject(
                    model
                  );


              const center =
                bounds.getCenter(
                  new THREE.Vector3()
                );


              const size =
                bounds.getSize(
                  new THREE.Vector3()
                );


              if (
                !Number.isFinite(
                  size.x
                ) ||

                size.x <
                .001
              ) {

                resolve(
                  false
                );

                return;

              }


                          const scale =

                3.35 /
                size.x;


              model.scale
                .setScalar(
                  scale
                );


              model.position.set(

                -center.x *
                scale,

                -bounds.min.y *
                scale,

                -center.z *
                scale

              );


              /*
               * ВАЖНО:
               * fittedBounds считаем ДО добавления model
               * внутрь bikeRoot.
               *
               * Тогда координаты колёс остаются локальными
               * относительно самого мотоцикла.
               */
              model.updateMatrixWorld(
                true
              );


              const fittedBounds =
                new THREE
                  .Box3()
                  .setFromObject(
                    model
                  );


              bikeRoot.add(
                model
              );


              createWheelVisuals(
                fittedBounds
              );



              modelReady =
                true;


              resolve(
                true
              );

            },


            undefined,


            () => {

              new THREE
                .TextureLoader()
                .load(

                  PREVIEW_URL,


                  texture => {

                    texture.colorSpace =
                      THREE
                        .SRGBColorSpace;


                    const preview =
                      new THREE.Mesh(

                        new THREE
                          .PlaneGeometry(
                            3.35,
                            3.35
                          ),

                        new THREE
                          .MeshBasicMaterial({

                            map:
                              texture,

                            transparent:
                              true,

                            side:
                              THREE
                                .DoubleSide

                          })

                      );


                    preview.position.y =
                      1.3;


                    preview.scale.x =
                      -1;


                    bikeRoot.add(
                      preview
                    );


                    modelReady =
                      true;


                    resolve(
                      true
                    );

                  },


                  undefined,


                  () =>
                    resolve(
                      false
                    )

                );

            }

          );

        }

      );


    return modelPromise;

  }


  function optimizeKnownCharacterUrl(
    value
  ) {

    const url =
      String(
        value ||
        ""
      ).trim();


    if (
      !url
    ) {

      return "";

    }


    const match =
      url.match(
        /assets\/model\/roster\/([^/?]+)\.glb/i
      );


    if (
      !match
    ) {

      return url;

    }


    const name =
      String(
        match[1] ||
        ""
      ).toLowerCase();


    if (
      !OPTIMIZED_CHARACTER_NAMES
        .has(
          name
        )
    ) {

      return url;

    }


    return (

      `./assets/model/game/characters/${name}.glb?v=1`

    );

  }


  function resolveRiderModelUrl(
    context = null
  ) {

    const selectedSkin =
      String(

        window
          .LAGO_ACCOUNT
          ?.getState
          ?.()
          ?.selectedSkin ||

        "default"

      );


    const registryCharacter =

      window
        .LAGO_CHARACTERS
        ?.getById
        ?.(selectedSkin) ||

      null;


    return optimizeKnownCharacterUrl(

      context
        ?.characterModel3d ||

      window
        .LAGO_CHARACTER_3D
        ?.getStatus
        ?.()
        ?.modelUrl ||

      registryCharacter
        ?.model3d ||

      DEFAULT_RIDER_MODEL

    );

  }


  function clearRider() {

    if (
      !riderRoot
    ) {

      return;

    }


    for (
      const child
      of [
        ...riderRoot.children
      ]
    ) {

      riderRoot.remove(
        child
      );


      child.traverse?.(

        node => {

          if (
            !node.isMesh ||
            !node.material
          ) {

            return;

          }


          const materials =

            Array.isArray(
              node.material
            )

              ? node.material

              : [
                  node.material
                ];


          materials.forEach(

            material =>

              material
                ?.dispose
                ?.()

          );

        }

      );

    }


    riderModelUrl =
      "";

  }


  function fitRiderToBike(
    model
  ) {

    model.position.set(
      0,
      0,
      0
    );


    model.rotation.set(
      0,
      0,
      0
    );


    model.scale.set(
      1,
      1,
      1
    );


    model.updateMatrixWorld(
      true
    );


    const firstBox =
      new THREE
        .Box3()
        .setFromObject(
          model
        );


    const size =
      firstBox.getSize(
        new THREE.Vector3()
      );


    if (
      !Number.isFinite(
        size.y
      ) ||

      size.y <
      .001
    ) {

      return;

    }


    const scale =

      1.52 /
      size.y;


    model.scale.setScalar(
      scale
    );


    model.updateMatrixWorld(
      true
    );


    const box =
      new THREE
        .Box3()
        .setFromObject(
          model
        );


    const center =
      box.getCenter(
        new THREE.Vector3()
      );


    model.position.x -=
      center.x;


    model.position.z -=
      center.z;


    model.position.y -=
      box.min.y;


    model.updateMatrixWorld(
      true
    );

  }


  async function loadRider(
    context = null
  ) {

    if (
      !riderRoot
    ) {

      return false;

    }


    const modelUrl =
      resolveRiderModelUrl(
        context
      );


    if (
      !modelUrl
    ) {

      return false;

    }


    if (
      riderModelUrl ===
        modelUrl &&

      riderRoot
        .children
        .length >
      0
    ) {

      return true;

    }


    const requestId =
      ++riderRequestId;


    try {

      let model =
        null;


      if (
        window
          .LAGO_CHARACTER_3D &&

        typeof window
          .LAGO_CHARACTER_3D
          .cloneModel ===
          "function"
      ) {

        model =

          await window
            .LAGO_CHARACTER_3D
            .cloneModel(
              modelUrl
            );

      } else {

        const gltf =

          await new GLTFLoader()
            .loadAsync(
              modelUrl
            );


        model =
          gltf.scene;

      }


      if (
        requestId !==
          riderRequestId ||

        !model
      ) {

        return false;

      }


      fitRiderToBike(
        model
      );


      clearRider();


      riderModelUrl =
        modelUrl;


      riderRoot.add(
        model
      );


      return true;

    } catch (
      error
    ) {

      if (
        requestId ===
        riderRequestId
      ) {

        clearRider();

      }


      console.error(
        "[LAGO MOTO] Rider model failed:",
        modelUrl,
        error
      );


      return false;

    }

  }


  function resize() {

    if (
      !renderer ||
      !stage ||
      !camera
    ) {

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


    renderer.setPixelRatio(

      Math.min(

        window.devicePixelRatio ||
        1,

        width <=
        760

          ? 1
          : 1.35

      )

    );


    renderer.setSize(
      width,
      height,
      false
    );


    const aspect =
      width /
      height;


    const spanX =
      Math.max(

        14,

        aspect *

        (
          width <=
          760

            ? 9.5
            : 10.5
        )

      );


    const spanY =
      spanX /
      aspect;


    camera.left =
      -spanX /
      2;


    camera.right =
      spanX /
      2;


    camera.top =
      spanY /
      2;


    camera.bottom =
      -spanY /
      2;


    camera
      .updateProjectionMatrix();

  }


  function setRunState({
    x = START_X,
    playing = false
  } = {}) {

    const ground =
      nearestGround(
        x
      );


    Object.assign(

      state,

      {

        x,

        y:
          ground +
          .08,

        vx:
          0,

        vy:
          0,

        pitch:
          terrainAngle(
            x
          ),

        grounded:
          true,

        playing,

        crashed:
          false,

        finished:
          false,

        elapsed:
          0,

        bestCheckpoint:
          x,

        crashReason:
          ""

      }

    );


    bikeRoot.position.set(
      state.x,
      state.y,
      0
    );


    bikeRoot.rotation.z =
      state.pitch;

  }


  function updatePrimaryButton() {

    const button =
      overlay
        ?.querySelector(
          "#lmRestart"
        );


    if (
      !button
    ) {

      return;

    }


    if (
      !modelReady
    ) {

      button.disabled =
        true;


      button.textContent =
        "ЗАГРУЗКА";


      return;

    }


    button.disabled =
      false;


    if (
      state.finished &&

      state.levelIndex <
      LEVELS.length -
      1
    ) {

      button.textContent =
        "СЛЕД. УРОВЕНЬ";

    } else if (
      state.finished
    ) {

      button.textContent =
        "СНАЧАЛА";

    } else if (
      state.playing ||
      state.crashed
    ) {

      button.textContent =
        "ЗАНОВО";

    } else {

      button.textContent =
        "СТАРТ";

    }

  }


  function updateLevelUI() {

    if (
      !overlay
    ) {

      return;

    }


    const config =
      level();


    const label =
      overlay.querySelector(
        "#lmLevelLabel"
      );


    const badge =
      overlay.querySelector(
        "#lmLevelBadge"
      );


    if (
      label
    ) {

      label.textContent =

        `УРОВЕНЬ ${config.id}/5 · ${config.name}`;

    }


    if (
      badge
    ) {

      badge.textContent =

        `${config.name} · ${config.difficulty}`;

    }


    updatePrimaryButton();

  }


  function startRun() {

    if (
      !modelReady ||
      state.playing ||
      state.finished
    ) {

      return;

    }


    state.playing =
      true;


    state.crashed =
      false;


    state.crashReason =
      "";


    updatePrimaryButton();

  }


  function restartLevel() {

    if (
      !modelReady
    ) {

      return;

    }


    setRunState({
      x:
        START_X,

      playing:
        true
    });


    updatePrimaryButton();

  }


  function nextLevel() {

    state.levelIndex =

      state.levelIndex <
      LEVELS.length -
      1

        ? state.levelIndex +
          1

        : 0;


    buildTrack();


    setRunState({

      x:
        START_X,

      playing:
        false

    });


    camera.position.set(
      START_X + 3,
      4.5,
      25
    );


    updatePrimaryButton();

  }


  function handlePrimaryAction() {

    if (
      state.finished
    ) {

      nextLevel();

      return;

    }


    restartLevel();

  }


  function jump() {

    if (
      !state.playing ||
      !state.grounded
    ) {

      return;

    }


    state.vy =
      level()
        .jumpPower;


    state.grounded =
      false;


    state.y +=
      .08;

  }


  function input(
    name
  ) {

    if (
      name ===
      "gas"
    ) {

      return (

        touch.gas ||

        keys.has(
          "KeyW"
        ) ||

        keys.has(
          "ArrowUp"
        )

      );

    }


    if (
      name ===
      "brake"
    ) {

      return (

        touch.brake ||

        keys.has(
          "KeyS"
        ) ||

        keys.has(
          "ArrowDown"
        )

      );

    }


    if (
      name ===
      "left"
    ) {

      return (

        touch.left ||

        keys.has(
          "KeyA"
        ) ||

        keys.has(
          "ArrowLeft"
        )

      );

    }


    if (
      name ===
      "right"
    ) {

      return (

        touch.right ||

        keys.has(
          "KeyD"
        ) ||

        keys.has(
          "ArrowRight"
        )

      );

    }


    return false;

  }


  function crash(
    reason
  ) {

    if (
      state.crashed ||
      state.finished
    ) {

      return;

    }


    state.crashed =
      true;


    state.playing =
      false;


    state.crashReason =
      reason ||
      "ПАДЕНИЕ";


    state.vx =
      0;


    updatePrimaryButton();

  }


  function checkObstacleCollision() {

    for (
      const obstacle
      of level()
        .obstacles
    ) {

      const distance =

        Math.abs(
          state.x -
          obstacle.x
        );


      if (
        distance >
        .95 *
        obstacle.size
      ) {

        continue;

      }


      const ground =
        nearestGround(
          obstacle.x
        );


      const obstacleTop =

        ground +

        (
          obstacle.type ===
          "barrier"

            ? .95
            : .78
        ) *

        obstacle.size;


      if (
        state.y <
          obstacleTop +
          .45 &&

        Math.abs(
          state.vx
        ) >
          2.2
      ) {

        crash(
          "СТОЛКНОВЕНИЕ"
        );


        return true;

      }

    }


    return false;

  }


  function updateCheckpoints() {

    for (
      const x
      of level()
        .checkpoints
    ) {

      if (
        state.x >=
          x &&

        x >
          state.bestCheckpoint
      ) {

        state.bestCheckpoint =
          x;

      }

    }

  }


  function step(
    dt
  ) {

    if (
      !state.playing
    ) {

      return;

    }


    const config =
      level();


    state.elapsed +=
      dt;


    const gas =
      input(
        "gas"
      );


    const brake =
      input(
        "brake"
      );


    if (
      gas
    ) {

      state.vx +=

        (
          state.grounded

            ? config
                .acceleration

            : config
                .acceleration *
              .28
        ) *

        dt;

    }


    if (
      brake
    ) {

      state.vx -=

        (
          state.grounded

            ? 12.5
            : 2.6
        ) *

        dt;

    }


    if (
      !gas &&
      !brake
    ) {

      state.vx *=

        state.grounded

          ? .988
          : .998;

    }


    state.vx =
      THREE.MathUtils.clamp(

        state.vx,

        -3.5,

        config.maxSpeed

      );


    state.x =
      Math.max(

        1,

        state.x +
        state.vx *
        dt

      );


    state.vy -=

      config.gravity *
      dt;


    state.y +=

      state.vy *
      dt;


    const rearGround =
      terrain(

        state.x -
        BIKE_HALF_LENGTH,

        config

      );


    const frontGround =
      terrain(

        state.x +
        BIKE_HALF_LENGTH,

        config

      );


    const hasGround =

      rearGround !==
        null ||

      frontGround !==
        null;


    const contactGround =

      hasGround

        ? Math.max(

            rearGround ??
            -Infinity,

            frontGround ??
            -Infinity

          )

        : null;


    const slope =
      terrainAngle(
        state.x,
        config
      );


    const tilt =

      Number(
        input(
          "right"
        )
      ) -

      Number(
        input(
          "left"
        )
      );


    if (
      contactGround !==
        null &&

      state.y <=
        contactGround +
        .08 &&

      state.vy <=
        0
    ) {

      const landingAngle =

        Math.abs(

          Math.atan2(

            Math.sin(

              state.pitch -
              slope

            ),

            Math.cos(

              state.pitch -
              slope

            )

          )

        );


      const wasAirborne =
        !state.grounded;


      if (
        wasAirborne &&

        landingAngle >
          config
            .landingLimit &&

        Math.abs(
          state.vx
        ) >
          4.2
      ) {

        crash(
          "ЖЁСТКОЕ ПРИЗЕМЛЕНИЕ"
        );


        return;

      }


      state.y =
        contactGround +
        .08;


      state.vy =
        0;


      state.grounded =
        true;


      state.pitch =
        THREE.MathUtils.lerp(

          state.pitch,

          slope +
          tilt *
          .22,

          Math.min(
            1,
            dt *
            8.5
          )

        );

    } else {

      state.grounded =
        false;


      state.pitch +=

        tilt *
        dt *

        (
          2.5 +
          config.id *
          .06
        );

    }


    if (
      !hasGround &&

      state.y <
      FALL_LIMIT_Y
    ) {

      crash(
        "ПРОПАСТЬ"
      );


      return;

    }


    if (
      checkObstacleCollision()
    ) {

      return;

    }


    updateCheckpoints();


    if (
      state.x >=
      config.length
    ) {

      state.finished =
        true;


      state.playing =
        false;


      state.vx =
        0;


      updatePrimaryButton();

    }

  }

    function updateBikeVisual(
    dt,
    now
  ) {

    if (
      !bikeRoot
    ) {

      return;

    }


    const speed =
      Math.abs(
        state.vx
      );


    const speedRatio =
      THREE.MathUtils.clamp(

        speed /
        Math.max(
          1,
          level().maxSpeed
        ),

        0,
        1

      );


    wheelSpin -=

      state.vx *
      dt /

      Math.max(
        .2,
        wheelRadiusWorld
      );


    const wheelOpacity =

      state.playing

        ? THREE.MathUtils.clamp(

            (
              speedRatio -
              .04
            ) *
            1.35,

            0,
            .92

          )

        : 0;


        for (
      const wheel
      of wheelVisuals
    ) {

      wheel.rotation.z =
        wheelSpin;


      if (
        wheel.userData
          .veilMaterial
      ) {

        wheel.userData
          .veilMaterial
          .opacity =

          wheelOpacity *
          .10;

      }


      if (
        wheel.userData
          .spokeMaterial
      ) {

        wheel.userData
          .spokeMaterial
          .opacity =

          wheelOpacity *
          .72;

      }


      if (
        wheel.userData
          .hubMaterial
      ) {

        wheel.userData
          .hubMaterial
          .opacity =

          wheelOpacity *
          .48;

      }


      if (
        wheel.userData
          .markerMaterial
      ) {

        wheel.userData
          .markerMaterial
          .opacity =

          wheelOpacity *
          .68;

      }

    }




    const vibration =

      state.playing &&
      state.grounded

        ? Math.sin(
            now *
            .034
          ) *
          .018 *
          speedRatio

        : 0;


    bikeRoot.position.set(

      state.x,

      state.y +
      vibration,

      0

    );


    bikeRoot.rotation.z =

      state.pitch +

      (
        state.playing &&
        state.grounded

          ? Math.sin(
              now *
              .027
            ) *
            .008 *
            speedRatio

          : 0
      );


    const speedFx =
      overlay
        ?.querySelector(
          "#lmSpeedFx"
        );


    if (
      speedFx
    ) {

      motionOffset +=

        state.vx *
        dt *
        24;


      speedFx.style
        .backgroundPosition =

        `${-motionOffset}px 0`;


      speedFx.style.opacity =

        String(
          state.playing

            ? Math.max(
                0,
                (
                  speedRatio -
                  .18
                ) *
                .72
              )

            : 0
        );

    }

  }


  function updateCamera() {

    const ground =
      nearestGround(
        state.x
      );

    const speedLookAhead =

      THREE.MathUtils.clamp(

        Math.abs(
          state.vx
        ) *
        .16,

        0,
        2.4

      );


    const desiredX =

      state.x +

      (
        window.innerWidth <=
        760

          ? 2.8
          : 4.2
      ) +

      speedLookAhead;


    const speedLift =

      Math.min(

        1.6,

        Math.abs(
          state.vx
        ) *
        .055

      );


    const desiredY =

      Math.max(

        ground +
        3.1,

        state.y +
        2.2

      ) +

      speedLift;


    camera.position.x +=

      (
        desiredX -
        camera.position.x
      ) *

      .09;


    camera.position.y +=

      (
        desiredY -
        camera.position.y
      ) *

      .08;


    camera.lookAt(
      camera.position.x,
      camera.position.y,
      0
    );


    if (
      backgroundRoot
    ) {
      backgroundRoot.position.x =

        camera.position.x *
        .68;

    }

  }


  function updateHud() {

    if (
      !overlay
    ) {

      return;

    }


    const config =
      level();


    const title =

      state.finished

        ? "ФИНИШ"

        : state.crashed

          ? state.crashReason ||
            "ПАДЕНИЕ"

          : state.playing

            ? "ГОНКА"

            : "ГОТОВ К СТАРТУ";


    const progress =
      THREE.MathUtils.clamp(

        state.x /
        config.length,

        0,
        1

      );


    const hud =
      overlay.querySelector(
        "#lmHud"
      );


    if (
      hud
    ) {

      hud.textContent =

        `${title} · ` +

        `${Math.round(
          progress *
          100
        )}% · ` +

        `${state.elapsed.toFixed(
          1
        )} с · ` +

        `${Math.abs(
          state.vx
        ).toFixed(
          1
        )} м/с`;

    }

  }


  function draw(
    now
  ) {

    if (
      !active
    ) {

      return;

    }


    const dt =
      Math.min(

        .05,

        Math.max(

          0,

          (
            now -
            lastTime
          ) /
          1000

        )

      );


    lastTime =
      now;


    accumulator +=
      dt;


    if (
      !state.playing &&

      !state.crashed &&

      !state.finished &&

      input(
        "gas"
      )
    ) {

      startRun();

    }


    while (
      accumulator >=
      1 /
      60
    ) {

      step(
        1 /
        60
      );


      accumulator -=
        1 /
        60;

    }

    updateBikeVisual(
      dt,
      now
    );

    updateCamera();

    updateHud();


    renderer.render(
      scene,
      camera
    );


    animationFrame =
      requestAnimationFrame(
        draw
      );

  }


  function releaseInputs() {

    keys.clear();


    Object.keys(
      touch
    )
      .forEach(

        key => {

          touch[
            key
          ] =
            false;

        }

      );

  }


  function bindControls() {

    controlsAbort
      ?.abort();


    controlsAbort =
      new AbortController();


    const options = {

      signal:
        controlsAbort
          .signal

    };


    window.addEventListener(
      "resize",
      resize,
      options
    );


    window.addEventListener(

      "keydown",

      event => {

        if (
          !active
        ) {

          return;

        }


        if (
          [
            "ArrowUp",
            "ArrowDown",
            "ArrowLeft",
            "ArrowRight",
            "Space"
          ]
            .includes(
              event.code
            )
        ) {

          event.preventDefault();

        }


        keys.add(
          event.code
        );


        if (
          (
            event.code ===
              "KeyW" ||

            event.code ===
              "ArrowUp"
          ) &&

          !state.playing &&

          !state.finished
        ) {

          startRun();

        }


        if (
          event.code ===
            "Space" &&

          !event.repeat
        ) {

          jump();

        }

      },

      options

    );


    window.addEventListener(

      "keyup",

      event =>
        keys.delete(
          event.code
        ),

      options

    );


    window.addEventListener(
      "blur",
      releaseInputs,
      options
    );


    overlay
      .querySelectorAll(
        "[data-hold]"
      )
      .forEach(

        button => {

          const name =
            button.dataset
              .hold;


          const release =
            () => {

              touch[
                name
              ] =
                false;

            };


          button.addEventListener(

            "pointerdown",

            event => {

              event.preventDefault();


              touch[
                name
              ] =
                true;


              if (
                name ===
                  "gas" &&

                !state.playing &&

                !state.finished
              ) {

                startRun();

              }


              button
                .setPointerCapture
                ?.(
                  event.pointerId
                );

            },

            options

          );


          for (
            const type
            of [
              "pointerup",
              "pointercancel",
              "lostpointercapture"
            ]
          ) {

            button.addEventListener(
              type,
              release,
              options
            );

          }

        }

      );


    overlay
      .querySelector(
        "#lmJump"
      )
      .addEventListener(
        "click",
        jump,
        options
      );


    overlay
      .querySelector(
        "#lmRestart"
      )
      .addEventListener(
        "click",
        handlePrimaryAction,
        options
      );

  }


  async function show(
    context = null
  ) {

    makeUI();

    makeScene();


    if (
      active
    ) {

      return;

    }


    active =
      true;


    overlay.classList.add(
      "active"
    );


    bindControls();

    resize();


    voicePanel =

      window
        .LAGO_GAME_VOICE
        ?.createPanel({

          gameId:
            GAME_ID,

          mount:
            overlay.querySelector(
              "#lmVoice"
            ),

          placement:
            "inline"

        }) ||

      null;


    setRunState({

      x:
        START_X,

      playing:
        false

    });


    updateLevelUI();


    lastTime =
      performance.now();


    accumulator =
      0;


    animationFrame =
      requestAnimationFrame(
        draw
      );


    const [
      bikeOk
    ] =

      await Promise.all([

        loadBike(),

        loadRider(
          context
        )

      ]);


    if (
      !active
    ) {

      return;

    }


    modelReady =
      Boolean(
        bikeOk
      );


    updatePrimaryButton();


    if (
      !bikeOk
    ) {

      overlay
        .querySelector(
          "#lmHud"
        )
        .textContent =

          "Модель мотоцикла не загрузилась";

    }

  }


  function hide() {

    if (
      !active
    ) {

      return;

    }


    active =
      false;


    state.playing =
      false;


    cancelAnimationFrame(
      animationFrame
    );


    controlsAbort
      ?.abort();


    controlsAbort =
      null;


    releaseInputs();


    voicePanel
      ?.destroy();


    voicePanel =
      null;


    overlay.classList.remove(
      "active"
    );

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

        void show(

          event.detail
            ?.context ||

          null

        );

      }

    }

  );


  window.LAGO_MOTO =
    Object.freeze({

      version:
        VERSION,

      show,

      hide

    });

})();

import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { rigTankModel } from "./lago-tank-rig.js?v=2";

(() => {
  "use strict";

  const VERSION = 31;
  const GAME_ID = "lago-tanks";

  const TEAM_BLUE_MODEL =
  "./assets/model/game/tanks/team-blue.glb?v=1";

const TEAM_RED_MODEL =
  "./assets/model/game/tanks/team-red.glb?v=1";

 const MAP_WIDTH = 116;
const MAP_DEPTH = 78;

  const MAP_HALF_X =
    MAP_WIDTH / 2 - 2;

  const MAP_HALF_Z =
    MAP_DEPTH / 2 - 2;

  const MOVE_SPEED = 6.0;
  const REVERSE_SPEED = 3.6;
  const TURN_SPEED = 2.25;
  const TANK_RADIUS = 1.25;

  const BULLET_SPEED = 21;
const BULLET_LIFE = 2.7;
const FIRE_COOLDOWN = 0.42;

const TANK_MAX_HP = 100;
const BULLET_DAMAGE = 34;
const TANK_HIT_RADIUS = 1.55;
const RESPAWN_DELAY_SECONDS = 3.0;

const BOT_MOVE_SPEED = 3.8;
const BOT_TURN_SPEED = 1.75;
const BOT_FIRE_COOLDOWN = 0.95;
const BOT_FIRE_RANGE = 32;
const BOT_STOP_DISTANCE = 8.5;

const MATCH_DURATION_SECONDS = 180;
const MATCH_SCORE_LIMIT = 10;

  const NETWORK_INPUT_HZ = 20;
const NETWORK_INPUT_INTERVAL =
  1 / NETWORK_INPUT_HZ;

const NETWORK_INTERPOLATION_MS = 100;
const NETWORK_SNAPSHOT_BUFFER_LIMIT = 20;
const NETWORK_RECONNECT_MAX_ATTEMPTS = 5;

  const TOUCH_DRIVE_RADIUS = 82;
  const TOUCH_DEAD_ZONE = 0.10;


  /*
   * =========================================================
   * MULTIPLAYER 4 VS 4 SPAWNS
   * =========================================================
   */

 const BLUE_SPAWNS =
  Object.freeze([

    Object.freeze({
      x: -7.2,
      z: 32.5,
      yaw: 0
    }),

    Object.freeze({
      x: -2.4,
      z: 32.5,
      yaw: 0
    }),

    Object.freeze({
      x: 2.4,
      z: 32.5,
      yaw: 0
    }),

    Object.freeze({
      x: 7.2,
      z: 32.5,
      yaw: 0
    })

  ]);


 const RED_SPAWNS =
  Object.freeze([

    Object.freeze({
      x: -7.2,
      z: -32.5,
      yaw: Math.PI
    }),

    Object.freeze({
      x: -2.4,
      z: -32.5,
      yaw: Math.PI
    }),

    Object.freeze({
      x: 2.4,
      z: -32.5,
      yaw: Math.PI
    }),

    Object.freeze({
      x: 7.2,
      z: -32.5,
      yaw: Math.PI
    })

  ]);

/*
 * =========================================================
 * 4V4 MAP LANES / BASE SAFETY
 * =========================================================
 */

const MAP_LANES =
  Object.freeze([

    Object.freeze({
      id: "west",
      x: -43,
      waypoints: Object.freeze([
        Object.freeze({ x: -18, z: 31 }),
        Object.freeze({ x: -42, z: 31 }),
        Object.freeze({ x: -43, z: 18 }),
        Object.freeze({ x: -43, z: 0 }),
        Object.freeze({ x: -43, z: -18 }),
        Object.freeze({ x: -42, z: -31 }),
        Object.freeze({ x: -18, z: -31 })
      ])
    }),

    Object.freeze({
      id: "center",
      x: 0,
      waypoints: Object.freeze([
        Object.freeze({ x: 0, z: 26 }),
        Object.freeze({ x: 0, z: 18 }),
        Object.freeze({ x: 0, z: 11 }),
        Object.freeze({ x: 12, z: 8 }),
        Object.freeze({ x: 12, z: 0 }),
        Object.freeze({ x: 12, z: -8 }),
        Object.freeze({ x: 0, z: -11 }),
        Object.freeze({ x: 0, z: -18 }),
        Object.freeze({ x: 0, z: -26 })
      ])
    }),

    Object.freeze({
      id: "east",
      x: 43,
      waypoints: Object.freeze([
        Object.freeze({ x: 18, z: 31 }),
        Object.freeze({ x: 42, z: 31 }),
        Object.freeze({ x: 43, z: 18 }),
        Object.freeze({ x: 43, z: 0 }),
        Object.freeze({ x: 43, z: -18 }),
        Object.freeze({ x: 42, z: -31 }),
        Object.freeze({ x: 18, z: -31 })
      ])
    })

  ]);

const SPAWN_PROTECTION_SECONDS =
  3.0;


const TEAM_BASES =
  Object.freeze({

    blue:
      Object.freeze({
        x: 0,
        z: 32.5,
        radius: 11
      }),

    red:
      Object.freeze({
        x: 0,
        z: -32.5,
        radius: 11
      })

  });
  
  /*
   * =========================================================
   * MAP TERRAIN
   * =========================================================
   */

 const HILLS =
  Object.freeze([]);

  const loader =
    new GLTFLoader();


  const tankTemplatePromises =
    new Map();


  let overlay = null;
  let canvas = null;

  let renderer = null;
  let scene = null;
  let camera = null;
  let clock = null;

  let resizeObserver =
    null;


 let player = null;
let playerVisual = null;
let aimMarker = null;

let playerTurretPivot = null;
let playerMuzzle = null;


  let animationFrame = 0;

  let phase =
    "idle";

  let context =
    null;

  let tankVoicePanel = null;


  let fireCooldown = 0;

  let bullets = [];
let impacts = [];
let solidRects = [];

const actors =
  new Map();

const botActors =
  [];

const teamScores = {
  blue: 0,
  red: 0
};

let localPlayerActor =
  null;

let combatTime =
  0;

const matchState = {

  status:
    "idle",

  timeRemaining:
    MATCH_DURATION_SECONDS,

  winner:
    null

};

let localInputSequence =
  0;

let localFireSequence =
  0;

let serverAuthorityEnabled =
  false;

let lastServerSnapshotAt =
  0;

  const networkSession = {

  status:
    "offline",

  roomId:
    null,

  playerId:
    null,

  transport:
    null,

  unsubscribeMessage:
    null,

  unsubscribeStatus:
    null,

  desiredOnline:
    false,

  reconnectAttempts:
    0,

  reconnectDelay:
    0,

  reconnectInFlight:
    false,

  inputAccumulator:
    0,

  snapshotBuffer:
    [],

  lastError:
    null

};
  
  const aimWorld =
    new THREE.Vector3(
      0,
      0,
      -10
    );


  let hasAim =
    false;


  /*
   * =========================================================
   * TOUCH CONTROL
   * =========================================================
   */

  let drivePointerId =
    null;

  let aimPointerId =
    null;


  let driveStartX = 0;
  let driveStartY = 0;


  let touchForward = 0;
  let touchTurn = 0;


  const keys =
    new Set();


  const mobile = {

    forward:
      false,

    back:
      false,

    left:
      false,

    right:
      false

  };


  const pointerNdc =
    new THREE.Vector2();


  const raycaster =
    new THREE.Raycaster();


  const groundPlane =
    new THREE.Plane(

      new THREE.Vector3(
        0,
        1,
        0
      ),

      0

    );


  function runtime() {

    return (
      window.LAGO_MINIGAMES ||
      null
    );

  }


  function el(
    id
  ) {

    return (
      overlay
        ?.querySelector(
          `#${id}`
        ) ||
      null
    );

  }


  function material(
    color,
    roughness = 0.78,
    metalness = 0.06
  ) {

    return new THREE
      .MeshStandardMaterial({

        color,
        roughness,
        metalness

      });

  }


  function box(
    x,
    y,
    z,
    color
  ) {

    const mesh =
      new THREE.Mesh(

        new THREE
          .BoxGeometry(
            x,
            y,
            z
          ),

        material(
          color
        )

      );


    mesh.castShadow =
      true;


    mesh.receiveShadow =
      true;


    return mesh;

  }


  /*
   * =========================================================
   * TERRAIN HEIGHT
   * =========================================================
   */

  function terrainHeight(
    x,
    z
  ) {

    let height =
      0;


    for (
      const hill
      of HILLS
    ) {

      const dx =
        x -
        hill.x;


      const dz =
        z -
        hill.z;


      const d2 =
        dx * dx +
        dz * dz;


      const sigma2 =
        hill.radius *
        hill.radius;


      height +=

        hill.height *

        Math.exp(

          -d2 /
          (
            2 *
            sigma2
          )

        );

    }


    return height;

  }


  function terrainSlope(
    x,
    z
  ) {

    const step =
      0.28;


    const hx =

      terrainHeight(
        x + step,
        z
      ) -

      terrainHeight(
        x - step,
        z
      );


    const hz =

      terrainHeight(
        x,
        z + step
      ) -

      terrainHeight(
        x,
        z - step
      );


    return {

      x:
        hx /
        (
          step *
          2
        ),

      z:
        hz /
        (
          step *
          2
        )

    };

  }


  /*
   * =========================================================
   * UI
   * =========================================================
   */

  function createUI() {

    if (overlay) {

      return;

    }


    const style =
      document
        .createElement(
          "style"
        );


    style.textContent = `

      #lagoTanksGame {

        position:
          fixed;

        inset:
          0;

        z-index:
          22000;

        display:
          none;


        padding:

          calc(
            10px +
            env(
              safe-area-inset-top
            )
          )

          10px

          calc(
            10px +
            env(
              safe-area-inset-bottom
            )
          );


        background:
          #07090c;

        color:
          #fff;


        font-family:
          Inter,
          system-ui,
          sans-serif;

      }


      #lagoTanksGame.active {

        display:
          block;

      }


      .lt-shell {

        width:
          min(
            1360px,
            100%
          );


        height:

          calc(

            100dvh -

            20px -

            env(
              safe-area-inset-top
            ) -

            env(
              safe-area-inset-bottom
            )

          );


        margin:
          auto;


        display:
          flex;


        flex-direction:
          column;


        min-height:
          0;

      }


      .lt-head {

        display:
          flex;


        align-items:
          flex-start;


        justify-content:
          space-between;


        gap:
          12px;

      }


      .lt-title {

        font-size:

          clamp(
            30px,
            4.6vw,
            54px
          );


        font-weight:
          1000;


        line-height:
          .92;


        letter-spacing:
          -.055em;

      }


      .lt-sub {

        margin-top:
          5px;


        color:
          rgba(
            255,
            255,
            255,
            .45
          );


        font-size:
          9px;


        font-weight:
          900;


        letter-spacing:
          .04em;

      }


      .lt-close {

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


      .lt-stage {

        position:
          relative;


        flex:
          1;


        min-height:
          0;


        margin-top:
          9px;


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
          18px;


        background:
          #11171c;

      }


      #lagoTanksCanvas {

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


      .lt-status {

        position:
          absolute;


        top:
          10px;


        left:
          50%;


        z-index:
          20;


        transform:
          translateX(
            -50%
          );


        max-width:
          76%;


        padding:
          7px 11px;


        border-radius:
          999px;


        background:

          rgba(
            4,
            7,
            9,
            .70
          );


        color:
          #ccff00;


        font-size:
          9px;


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

.lt-stage >
.lago-voice-panel {

  top:
    46px;

  right:
    10px;

  width:
    auto;

  max-width:
    245px;

  padding:
    5px;

  gap:
    4px;

  transform:
    scale(.86);

  transform-origin:
    top right;

}


.lt-stage >
.lago-voice-panel
.lago-voice-status {

  display:
    none;

}


.lt-stage >
.lago-voice-panel
button {

  min-height:
    31px;

  padding:
    6px 8px;

  font-size:
    10px;

}

      .lt-mobile {

        position:
          absolute;


        left:
          14px;


        bottom:
          14px;


        z-index:
          30;


        display:
          none;


        grid-template-columns:
          repeat(
            3,
            48px
          );


        grid-template-rows:
          repeat(
            2,
            48px
          );


        gap:
          5px;

      }


      .lt-mobile button {

        border:

          1px solid

          rgba(
            255,
            255,
            255,
            .16
          );


        border-radius:
          13px;


        background:

          rgba(
            7,
            12,
            15,
            .78
          );


        color:
          #fff;


        font-size:
          18px;


        font-weight:
          1000;


        touch-action:
          none;


        user-select:
          none;

      }


      .lt-mobile
      [data-control="forward"] {

        grid-column:
          2;


        grid-row:
          1;

      }


      .lt-mobile
      [data-control="left"] {

        grid-column:
          1;


        grid-row:
          2;

      }


      .lt-mobile
      [data-control="back"] {

        grid-column:
          2;


        grid-row:
          2;

      }


      .lt-mobile
      [data-control="right"] {

        grid-column:
          3;


        grid-row:
          2;

      }


      .lt-fire {

        position:
          absolute;


        right:
          18px;


        bottom:
          18px;


        z-index:
          32;


        display:
          none;


        width:
          82px;


        height:
          82px;


        border:

          1px solid

          rgba(
            204,
            255,
            0,
            .55
          );


        border-radius:
          50%;


        background:
          #ccff00;


        color:
          #130614;


        font-size:
          13px;


        font-weight:
          1000;


        touch-action:
          none;


        user-select:
          none;

      }


      .lt-panel {

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
          18px;


        background:

          rgba(
            5,
            7,
            9,
            .82
          );


        backdrop-filter:
          blur(
            12px
          );

      }


      .lt-panel[hidden] {

        display:
          none !important;

      }


      .lt-card {

        width:
          min(
            500px,
            100%
          );


        padding:
          22px;


        border:

          1px solid

          rgba(
            255,
            255,
            255,
            .10
          );


        border-radius:
          20px;


        background:
          #10151a;


        text-align:
          center;

      }


      .lt-card-title {

        font-size:
          28px;


        font-weight:
          1000;

      }


      .lt-card-copy {

        margin-top:
          9px;


        color:

          rgba(
            255,
            255,
            255,
            .58
          );


        font-size:
          11px;


        line-height:
          1.5;

      }


      .lt-actions {

        display:
          grid;


        gap:
          8px;


        margin-top:
          16px;

      }


      .lt-actions button {

        min-height:
          46px;


        border:
          0;


        border-radius:
          11px;


        background:
          #ccff00;


        color:
          #130614;


        font-weight:
          1000;


        cursor:
          pointer;

      }


      .lt-actions
      .secondary {

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
          760px
      ) {

        .lt-title {

          font-size:
            33px;

        }


        .lt-mobile {

          display:
            grid;

        }


        .lt-fire {

          display:
            block;

        }


        .lt-status {

          font-size:
            8px;

        }

      }

    `;


    document.head
      .appendChild(
        style
      );


    overlay =
      document
        .createElement(
          "div"
        );


    overlay.id =
      "lagoTanksGame";


    overlay.innerHTML = `

      <div
        class="lt-shell"
      >

        <header
          class="lt-head"
        >

          <div>

            <div
              class="lt-title"
            >
              LAGO TANKS
            </div>

            <div
              class="lt-sub"
            >
              MAP 01 · 4V4 ARENA FOUNDATION
            </div>

          </div>


          <button
            class="
              lt-close
              lago-overlay-close
            "
            id="ltClose"
            type="button"
            aria-label="Close"
          >

            <span
              class="lago-icon-slot"
              data-lago-icon="close"
            ></span>

          </button>

        </header>


        <main
          class="lt-stage"
          id="ltStage"
        >

          <canvas
            id="lagoTanksCanvas"
          ></canvas>


          <div
            class="lt-status"
            id="ltStatus"
          >

            4V4 MAP · BLUE BASE ↔ RED BASE

          </div>


          <div
            class="lt-mobile"
          >

            <button
              data-control="forward"
              type="button"
            >
              ▲
            </button>


            <button
              data-control="left"
              type="button"
            >
              ◀
            </button>


            <button
              data-control="back"
              type="button"
            >
              ▼
            </button>


            <button
              data-control="right"
              type="button"
            >
              ▶
            </button>

          </div>


          <button
            class="lt-fire"
            id="ltFire"
            type="button"
          >
            FIRE
          </button>


          <section
            class="lt-panel"
            id="ltPanel"
          >

            <div
              class="lt-card"
            >

             <div
  class="lt-card-title"
  id="ltPanelTitle"
>
  MAP 01 · VILLAGE
</div>


              <div
                class="lt-card-copy"
                id="ltPanelCopy"
              >

                Large 4v4 battlefield with two bases,
                roads, buildings, cover and terrain hills.

              </div>


              <div
                class="lt-actions"
              >

                <button
                  id="ltPrimary"
                  type="button"
                >
                  START LOCAL TEST
                </button>


                <button
                  class="secondary"
                  id="ltSecondary"
                  type="button"
                >
                  BACK TO GAMES
                </button>

              </div>

            </div>

          </section>

        </main>

      </div>

    `;


    document.body
      .appendChild(
        overlay
      );


    window.LAGO_UI
      ?.hydrate
      ?.(overlay);


    canvas =
      el(
        "lagoTanksCanvas"
      );


    el(
      "ltClose"
    )
      ?.addEventListener(
        "click",
        hide
      );


   el(
  "ltPrimary"
)
  ?.addEventListener(
    "click",
    handlePrimaryAction
  );


    el(
      "ltSecondary"
    )
      ?.addEventListener(

        "click",

        () => {

          hide();


          window.LAGO_GAMES
            ?.show
            ?.();

        }

      );


    bindControls();

  }


  /*
   * =========================================================
   * INPUT
   * =========================================================
   */

  function readLocalDriveInput() {

  const digitalForward =

    (
      keys.has(
        "KeyW"
      ) ||

      keys.has(
        "ArrowUp"
      ) ||

      mobile.forward
    )

      ? 1

      : (
          keys.has(
            "KeyS"
          ) ||

          keys.has(
            "ArrowDown"
          ) ||

          mobile.back
        )

        ? -1
        : 0;


  const digitalTurn =

    (
      keys.has(
        "KeyA"
      ) ||

      keys.has(
        "ArrowLeft"
      ) ||

      mobile.left
    )

      ? 1

      : (
          keys.has(
            "KeyD"
          ) ||

          keys.has(
            "ArrowRight"
          ) ||

          mobile.right
        )

        ? -1
        : 0;


  return {

    forward:

      Math.abs(
        touchForward
      ) >
      0.001

        ? touchForward
        : digitalForward,

    turn:

      Math.abs(
        touchTurn
      ) >
      0.001

        ? touchTurn
        : digitalTurn

  };

}


function getLocalInputSnapshot() {

  const drive =
    readLocalDriveInput();


  localInputSequence +=
    1;


  return {

    schemaVersion:
      1,

    sequence:
      localInputSequence,

    actorId:
      localPlayerActor
        ?.id ||
      null,

    forward:
      drive.forward,

    turn:
      drive.turn,

    aim: {

      x:
        aimWorld.x,

      y:
        aimWorld.y,

      z:
        aimWorld.z,

      active:
        hasAim

    },

    fireSequence:
      localFireSequence,

    clientTime:
      performance.now()

  };

}

  function bindControls() {

    window.addEventListener(

      "keydown",

      event => {

        keys.add(
          event.code
        );


        if (
          event.code ===
          "Space"
        ) {

          event.preventDefault();


          if (
            phase ===
            "running"
          ) {

            fire();

          }

        }

      }

    );


    window.addEventListener(

      "keyup",

      event => {

        keys.delete(
          event.code
        );

      }

    );


    function updatePointer(
      event
    ) {

      if (!canvas) {

        return;

      }


      const rect =
        canvas
          .getBoundingClientRect();


      if (
        rect.width <= 0 ||
        rect.height <= 0
      ) {

        return;

      }


      pointerNdc.x =

        (
          (
            event.clientX -
            rect.left
          ) /
          rect.width
        ) *

        2 -

        1;


      pointerNdc.y =

        -(

          (
            event.clientY -
            rect.top
          ) /

          rect.height

        ) *

        2 +

        1;

    }


    function updateDriveTouch(
      event
    ) {

      const dx =

        event.clientX -
        driveStartX;


      const dy =

        event.clientY -
        driveStartY;


      let turn =

        THREE.MathUtils
          .clamp(

            -dx /
            TOUCH_DRIVE_RADIUS,

            -1,
            1

          );


      let forward =

        THREE.MathUtils
          .clamp(

            -dy /
            TOUCH_DRIVE_RADIUS,

            -1,
            1

          );


      if (
        Math.abs(
          turn
        ) <
        TOUCH_DEAD_ZONE
      ) {

        turn =
          0;

      }


      if (
        Math.abs(
          forward
        ) <
        TOUCH_DEAD_ZONE
      ) {

        forward =
          0;

      }


      touchTurn =
        turn;


      touchForward =
        forward;

    }


    function releaseTouch(
      event
    ) {

      if (
        event.pointerId ===
        drivePointerId
      ) {

        drivePointerId =
          null;


        touchForward =
          0;


        touchTurn =
          0;

      }


      if (
        event.pointerId ===
        aimPointerId
      ) {

        aimPointerId =
          null;

      }


      try {

        canvas
          .releasePointerCapture
          ?.(event.pointerId);

      } catch (_) {}

    }


    canvas
      .addEventListener(

        "pointerdown",

        event => {

          if (
            event.pointerType ===
            "touch"
          ) {

            event.preventDefault();


            const rect =
              canvas
                .getBoundingClientRect();


            const localX =

              event.clientX -
              rect.left;


            /*
             * LEFT 55%:
             * analog tank movement.
             */

            if (
              localX <
              rect.width *
              0.55
            ) {

              if (
                drivePointerId ===
                null
              ) {

                drivePointerId =
                  event.pointerId;


                driveStartX =
                  event.clientX;


                driveStartY =
                  event.clientY;


                touchForward =
                  0;


                touchTurn =
                  0;


                canvas
                  .setPointerCapture
                  ?.(event.pointerId);

              }


              return;

            }


            /*
             * RIGHT 45%:
             * aiming.
             */

            if (
              aimPointerId ===
              null
            ) {

              aimPointerId =
                event.pointerId;


              updatePointer(
                event
              );


              canvas
                .setPointerCapture
                ?.(event.pointerId);

            }


            return;

          }


          updatePointer(
            event
          );


          if (
            phase ===
            "running"
          ) {

            fire();

          }

        }

      );


    canvas
      .addEventListener(

        "pointermove",

        event => {

          if (
            event.pointerType ===
            "touch"
          ) {

            if (
              event.pointerId ===
              drivePointerId
            ) {

              event.preventDefault();


              updateDriveTouch(
                event
              );


              return;

            }


            if (
              event.pointerId ===
              aimPointerId
            ) {

              event.preventDefault();


              updatePointer(
                event
              );

            }


            return;

          }


          updatePointer(
            event
          );

        }

      );


    canvas
      .addEventListener(
        "pointerup",
        releaseTouch
      );


    canvas
      .addEventListener(
        "pointercancel",
        releaseTouch
      );


    overlay
      .querySelectorAll(
        "[data-control]"
      )
      .forEach(
        button => {

          const control =
            button.dataset
              .control;


          const press =
            event => {

              event.preventDefault();


              mobile[
                control
              ] =
                true;


              button
                .setPointerCapture
                ?.(event.pointerId);

            };


          const release =
            event => {

              mobile[
                control
              ] =
                false;


              try {

                button
                  .releasePointerCapture
                  ?.(event?.pointerId);

              } catch (_) {}

            };


          button
            .addEventListener(
              "pointerdown",
              press
            );


          button
            .addEventListener(
              "pointerup",
              release
            );


          button
            .addEventListener(
              "pointercancel",
              release
            );

        }

      );


    el(
      "ltFire"
    )
      ?.addEventListener(

        "pointerdown",

        event => {

          event.preventDefault();


          if (
            phase ===
            "running"
          ) {

            fire();

          }

        }

      );

  }


  /*
   * =========================================================
   * THREE.JS
   * =========================================================
   */

  function createRenderer() {

    if (renderer) {

      return;

    }


    renderer =
      new THREE
        .WebGLRenderer({

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


    renderer.shadowMap.enabled =
      true;


    renderer.shadowMap.type =
      THREE.PCFSoftShadowMap;


    scene =
      new THREE.Scene();


   scene.background =
  new THREE.Color(
    0x8f9886
  );


  scene.fog =
  new THREE.Fog(
    0x8f9886,
    62,
    142
  );


    camera =
      new THREE
  .PerspectiveCamera(
    48,
    1,
    0.1,
    180
  );

   const hemiLight =
  new THREE.HemisphereLight(
    0xdcecff,
    0x6a705d,
    1.15
  );

scene.add(
  hemiLight
);


const sun =
  new THREE.DirectionalLight(
    0xffffff,
    1.25
  );

sun.position.set(
  28,
  42,
  22
);

sun.castShadow =
  true;

sun.shadow.mapSize.set(
  2048,
  2048
);

sun.shadow.camera.left =
  -90;

sun.shadow.camera.right =
  90;

sun.shadow.camera.top =
  90;

sun.shadow.camera.bottom =
  -90;

sun.shadow.camera.near =
  1;

sun.shadow.camera.far =
  160;

scene.add(
  sun
);

    clock =
      new THREE.Clock();


    buildMap01();

createPlayerShell();


createBotActors();


resizeObserver =
      new ResizeObserver(
        resize
      );


    resizeObserver.observe(
      el(
        "ltStage"
      )
    );


    resize();

  }


  /*
   * =========================================================
   * TERRAIN MESH
   * =========================================================
   */

  function createTerrain() {

    const geometry =
      new THREE
        .PlaneGeometry(

          MAP_WIDTH,
          MAP_DEPTH,

          48,
          36

        );


    const position =
      geometry
        .attributes
        .position;


    for (
      let i = 0;
      i < position.count;
      i += 1
    ) {

      const x =
        position.getX(
          i
        );


      const localY =
        position.getY(
          i
        );


      const worldZ =
        -localY;


      position.setZ(

        i,

        terrainHeight(
          x,
          worldZ
        )

      );

    }


    geometry
      .computeVertexNormals();


    const ground =
      new THREE.Mesh(

        geometry,

       material(
  0x73854f,
  0.98,
  0
)

      );


    ground.rotation.x =
      -Math.PI /
      2;


    ground.receiveShadow =
      true;


    scene.add(
      ground
    );

  }


  function addRoad(
  x,
  z,
  width,
  depth
) {

  const baseY =
    terrainHeight(
      x,
      z
    );


  const shoulder =
    new THREE.Mesh(

      new THREE
        .PlaneGeometry(
          width + 1.6,
          depth + 1.6
        ),

      new THREE
        .MeshStandardMaterial({

          color:
  0x9a7d5f,

          roughness:
            1,

          metalness:
            0,

          polygonOffset:
            true,

          polygonOffsetFactor:
            -1,

          polygonOffsetUnits:
            -1

        })

    );


  shoulder.rotation.x =
    -Math.PI /
    2;


  shoulder.position.set(
    x,
    baseY + 0.022,
    z
  );


  shoulder.receiveShadow =
    true;


  scene.add(
    shoulder
  );


  const road =
    new THREE.Mesh(

      new THREE
        .PlaneGeometry(
          width,
          depth
        ),

      new THREE
        .MeshStandardMaterial({

          color:
  0x4b4e4c,

          roughness:
            1,

          metalness:
            0,

          polygonOffset:
            true,

          polygonOffsetFactor:
            -2,

          polygonOffsetUnits:
            -2

        })

    );


  road.rotation.x =
    -Math.PI /
    2;


  road.position.set(
    x,
    baseY + 0.035,
    z
  );


  road.receiveShadow =
    true;


  scene.add(
    road
  );


  const horizontal =
    width >
    depth;


  const roadLength =
    horizontal
      ? width
      : depth;


  const dashLength =
    3.2;


  const dashGap =
    2.6;


  const step =
    dashLength +
    dashGap;


  const dashCount =
    Math.max(
      1,
      Math.floor(
        roadLength /
        step
      )
    );


  const markingMaterial =
    new THREE
      .MeshBasicMaterial({

        color:
  0xd8d5c6,

        transparent:
          true,

        opacity:
          0.72,

        depthWrite:
          false

      });


  for (
    let index = 0;
    index < dashCount;
    index += 1
  ) {

    const offset =

      -roadLength /
      2 +

      step *
      (
        index +
        0.5
      );


    const dash =
      new THREE.Mesh(

        new THREE
          .PlaneGeometry(

            horizontal
              ? dashLength
              : 0.13,

            horizontal
              ? 0.13
              : dashLength

          ),

        markingMaterial

      );


    dash.rotation.x =
      -Math.PI /
      2;


    dash.position.set(

      horizontal
        ? x + offset
        : x,

      baseY + 0.047,

      horizontal
        ? z
        : z + offset

    );


    scene.add(
      dash
    );

  }

}


function addGroundPatch(
  x,
  z,
  width,
  depth,
  rotation = 0,
  color = 0x7e705a
) {

  const patch =
    new THREE.Mesh(

      new THREE
        .CircleGeometry(
          1,
          18
        ),

      new THREE
        .MeshStandardMaterial({

          color,

          roughness:
            1,

          metalness:
            0,

          transparent:
            true,

          opacity:
            0.94,

          polygonOffset:
            true,

          polygonOffsetFactor:
            -3,

          polygonOffsetUnits:
            -3

        })

    );


  patch.rotation.x =
    -Math.PI /
    2;


  patch.rotation.z =
    rotation;


  patch.scale.set(
    width,
    depth,
    1
  );


  patch.position.set(

    x,

    terrainHeight(
      x,
      z
    ) +
    0.026,

    z

  );


  patch.receiveShadow =
    true;


  scene.add(
    patch
  );

}

  /*
   * =========================================================
   * COLLISION RECTS
   * =========================================================
   */

  function addSolidRect(
    x,
    z,
    halfX,
    halfZ
  ) {

    solidRects.push({

      minX:
        x -
        halfX,

      maxX:
        x +
        halfX,

      minZ:
        z -
        halfZ,

      maxZ:
        z +
        halfZ

    });

  }


  /*
   * =========================================================
   * BUILDINGS
   * =========================================================
   */

  function addBuilding(
  x,
  z,
  width,
  depth,
  height,
  color
) {

  const group =
    new THREE.Group();


  const baseY =
    terrainHeight(
      x,
      z
    );


  const body =
    box(
      width,
      height,
      depth,
      color
    );


  body.position.y =
    height /
    2;


  group.add(
    body
  );


  const foundation =
    box(

      width +
      0.35,

      0.34,

      depth +
      0.35,

      0x6b6257

    );


  foundation.position.y =
    0.17;


  group.add(
    foundation
  );


  const roof =
    new THREE.Mesh(

      new THREE
        .ConeGeometry(

          Math.max(
            width,
            depth
          ) *
          0.72,

          Math.max(
            1.0,
            height *
            0.25
          ),

          4

        ),

      material(
        0x584638,
        0.94,
        0
      )

    );


  roof.rotation.y =
    Math.PI /
    4;


  roof.position.y =
    height +
    0.52;


  roof.castShadow =
    true;


  roof.receiveShadow =
    true;


  group.add(
    roof
  );


  const door =
    box(

      Math.min(
        1.3,
        width *
        0.25
      ),

      Math.min(
        2.25,
        height *
        0.68
      ),

      0.16,

      0x59483b

    );


  door.position.set(

    0,

    Math.min(
      1.12,
      height *
      0.34
    ),

    depth /
    2 +
    0.09

  );


  group.add(
    door
  );


  const windowMaterial =
    material(
      0x6f8790,
      0.78,
      0.02
    );


  const windowWidth =
    Math.min(
      1.0,
      width *
      0.20
    );


  const windowHeight =
    Math.min(
      0.9,
      height *
      0.25
    );


  const windowY =
    Math.min(
      height *
      0.62,
      height -
      0.7
    );


  for (
    const side
    of [
      -1,
      1
    ]
  ) {

    const frontWindow =
      new THREE.Mesh(

        new THREE
          .BoxGeometry(
            windowWidth,
            windowHeight,
            0.12
          ),

        windowMaterial

      );


    frontWindow.position.set(

      side *
      width *
      0.27,

      windowY,

      depth /
      2 +
      0.07

    );


    group.add(
      frontWindow
    );


    const backWindow =
      frontWindow.clone();


    backWindow.position.z =
      -depth /
      2 -
      0.07;


    group.add(
      backWindow
    );

  }


  for (
    const side
    of [
      -1,
      1
    ]
  ) {

    const sideWindow =
      new THREE.Mesh(

        new THREE
          .BoxGeometry(
            0.12,
            windowHeight,
            Math.min(
              1.1,
              depth *
              0.24
            )
          ),

        windowMaterial

      );


    sideWindow.position.set(

      side *
      (
        width /
        2 +
        0.07
      ),

      windowY,

      0

    );


    group.add(
      sideWindow
    );

  }


  const chimney =
    box(
      0.52,
      1.35,
      0.52,
      0x62574d
    );


  chimney.position.set(

    width *
    0.22,

    height +
    0.95,

    -depth *
    0.12

  );


  group.add(
    chimney
  );


  group.position.set(
    x,
    baseY,
    z
  );


  scene.add(
    group
  );


  addSolidRect(

    x,
    z,

    width /
    2 +
    0.55,

    depth /
    2 +
    0.55

  );

}


function addWarehouse(
  x,
  z,
  width,
  depth,
  height
) {

  const group =
    new THREE.Group();


  const baseY =
    terrainHeight(
      x,
      z
    );


  const body =
    box(

      width,
      height,
      depth,

      0x777a72

    );


  body.position.y =
    height /
    2;


  group.add(
    body
  );


  const roof =
    box(

      width +
      0.35,

      0.38,

      depth +
      0.35,

      0x555b58

    );


  roof.position.y =
    height +
    0.19;


  group.add(
    roof
  );


  const largeDoor =
    box(

      Math.min(
        3.4,
        width *
        0.44
      ),

      Math.min(
        2.55,
        height *
        0.78
      ),

      0.18,

      0x4f5654

    );


  largeDoor.position.set(

    0,

    Math.min(
      1.28,
      height *
      0.39
    ),

    depth /
    2 +
    0.10

  );


  group.add(
    largeDoor
  );


  const upperWindowMaterial =
    material(
      0x718b91,
      0.8,
      0.03
    );


  for (
    const side
    of [
      -1,
      1
    ]
  ) {

    const window =
      new THREE.Mesh(

        new THREE
          .BoxGeometry(
            1.15,
            0.58,
            0.12
          ),

        upperWindowMaterial

      );


    window.position.set(

      side *
      width *
      0.30,

      height *
      0.70,

      depth /
      2 +
      0.07

    );


    group.add(
      window
    );

  }


  const vent =
    new THREE.Mesh(

      new THREE
        .CylinderGeometry(
          0.34,
          0.34,
          0.65,
          8
        ),

      material(
        0x666c69,
        0.86,
        0.08
      )

    );


  vent.position.set(
    width *
    0.22,
    height +
    0.70,
    0
  );


  vent.castShadow =
    true;


  group.add(
    vent
  );


  group.position.set(
    x,
    baseY,
    z
  );


  scene.add(
    group
  );


  addSolidRect(

    x,
    z,

    width /
    2 +
    0.6,

    depth /
    2 +
    0.6

  );

}


  function addWall(
    x,
    z,
    width,
    depth,
    rotation = 0
  ) {

    const wall =
      box(

        width,
        1.45,
        depth,

        0x8b8173

      );


    wall.position.set(

      x,

      terrainHeight(
        x,
        z
      ) +
      0.73,

      z

    );


    wall.rotation.y =
      rotation;


    scene.add(
      wall
    );


    if (
      Math.abs(
        rotation
      ) <
      0.1
    ) {

      addSolidRect(

        x,
        z,

        width /
        2 +
        0.35,

        depth /
        2 +
        0.35

      );

    } else {

      addSolidRect(

        x,
        z,

        depth /
        2 +
        0.35,

        width /
        2 +
        0.35

      );

    }

  }


  function addSpawnPad(
    spawn,
    color
  ) {

    const pad =
      new THREE.Mesh(

        new THREE
          .CylinderGeometry(

            2.15,
            2.15,
            0.08,
            32

          ),

        new THREE
          .MeshStandardMaterial({

            color,

            roughness:
              0.72,

            metalness:
              0.05,

            transparent:
              true,

            opacity:
              0.82

          })

      );


    pad.position.set(

      spawn.x,

      terrainHeight(
        spawn.x,
        spawn.z
      ) +
      0.04,

      spawn.z

    );


    pad.receiveShadow =
      true;


    scene.add(
      pad
    );

  }

  /*
 * =========================================================
 * LOW-POLY MAP PROPS
 * =========================================================
 */

function addTree(
  x,
  z,
  scale = 1
) {

  const group =
    new THREE.Group();


  const baseY =
    terrainHeight(
      x,
      z
    );


  const trunk =
    new THREE.Mesh(

      new THREE
        .CylinderGeometry(
          0.36 * scale,
          0.48 * scale,
          2.8 * scale,
          6
        ),

      material(
        0x75593f,
        1,
        0
      )

    );


  trunk.position.y =
    1.4 * scale;


  trunk.castShadow =
    true;

  trunk.receiveShadow =
    true;


  group.add(
    trunk
  );


  const crown =
    new THREE.Mesh(

      new THREE
        .DodecahedronGeometry(
          1.65 * scale,
          0
        ),

      material(
        0x607c50,
        1,
        0
      )

    );


  crown.scale.set(
    1,
    0.88,
    1
  );


  crown.position.y =
    3.55 * scale;


  crown.castShadow =
    true;

  crown.receiveShadow =
    true;


  group.add(
    crown
  );


  group.position.set(
    x,
    baseY,
    z
  );


  scene.add(
    group
  );


  addSolidRect(
    x,
    z,
    0.62 * scale,
    0.62 * scale
  );

}


function addRock(
  x,
  z,
  scale = 1,
  rotation = 0
) {

  const rock =
    new THREE.Mesh(

      new THREE
        .DodecahedronGeometry(
          1.15,
          0
        ),

      material(
        0x858780,
        1,
        0
      )

    );


  rock.scale.set(
    1.25 * scale,
    0.82 * scale,
    scale
  );


  rock.rotation.y =
    rotation;


  rock.position.set(

    x,

    terrainHeight(
      x,
      z
    ) +
    0.78 * scale,

    z

  );


  rock.castShadow =
    true;

  rock.receiveShadow =
    true;


  scene.add(
    rock
  );


  addSolidRect(
    x,
    z,
    1.35 * scale,
    1.1 * scale
  );

}


function addBush(
  x,
  z,
  scale = 1
) {

  const bush =
    new THREE.Mesh(

      new THREE
        .DodecahedronGeometry(
          0.9,
          0
        ),

      material(
        0x718b5e,
        1,
        0
      )

    );


  bush.scale.set(
    1.25 * scale,
    0.72 * scale,
    scale
  );


  bush.position.set(

    x,

    terrainHeight(
      x,
      z
    ) +
    0.55 * scale,

    z

  );


  bush.castShadow =
    true;

  bush.receiveShadow =
    true;


  scene.add(
    bush
  );

}


function addFence(
  x,
  z,
  length,
  rotation = 0
) {

  const group =
    new THREE.Group();


  const wood =
    material(
      0x71573f,
      1,
      0
    );


  const postCount =
    Math.max(
      2,
      Math.floor(
        length /
        2.2
      ) +
      1
    );


  for (
    let index = 0;
    index < postCount;
    index += 1
  ) {

    const t =
      index /
      (
        postCount -
        1
      );


    const localX =
      -length /
      2 +
      length *
      t;


    const post =
      new THREE.Mesh(

        new THREE
          .BoxGeometry(
            0.22,
            1.5,
            0.22
          ),

        wood

      );


    post.position.set(
      localX,
      0.75,
      0
    );


    post.castShadow =
      true;

    post.receiveShadow =
      true;


    group.add(
      post
    );

  }


  for (
    const y
    of [
      0.55,
      1.08
    ]
  ) {

    const rail =
      new THREE.Mesh(

        new THREE
          .BoxGeometry(
            length,
            0.18,
            0.18
          ),

        wood

      );


    rail.position.y =
      y;


    rail.castShadow =
      true;

    rail.receiveShadow =
      true;


    group.add(
      rail
    );

  }


  group.position.set(

    x,

    terrainHeight(
      x,
      z
    ),

    z

  );


  group.rotation.y =
    rotation;


  scene.add(
    group
  );


  if (
    Math.abs(
      Math.sin(
        rotation
      )
    ) <
    0.5
  ) {

    addSolidRect(
      x,
      z,
      length /
      2 +
      0.25,
      0.38
    );

  } else {

    addSolidRect(
      x,
      z,
      0.38,
      length /
      2 +
      0.25
    );

  }

}

  /*
   * =========================================================
   * MAP 01
   * =========================================================
   */

 function buildMap01() {

  solidRects =
    [];


  createTerrain();


  /*
   * =======================================================
   * REFERENCE MAP LAYOUT
   * =======================================================
   */


  function addFlatPatch(
    x,
    z,
    width,
    depth,
    color
  ) {

    const patch =
      new THREE.Mesh(

        new THREE
          .PlaneGeometry(
            width,
            depth
          ),

        new THREE
          .MeshStandardMaterial({

            color,

            roughness:
              1,

            metalness:
              0,

            polygonOffset:
              true,

            polygonOffsetFactor:
              -3,

            polygonOffsetUnits:
              -3

          })

      );


    patch.rotation.x =
      -Math.PI /
      2;


    patch.position.set(
      x,
      0.028,
      z
    );


    patch.receiveShadow =
      true;


    scene.add(
      patch
    );

  }


  function addPine(
    x,
    z,
    scale = 1
  ) {

    const group =
      new THREE.Group();


    const trunk =
      new THREE.Mesh(

        new THREE
          .CylinderGeometry(
            0.22 * scale,
            0.32 * scale,
            1.65 * scale,
            6
          ),

        material(
          0x684b35,
          1,
          0
        )

      );


    trunk.position.y =
      0.82 * scale;


    group.add(
      trunk
    );


    const dark =
      material(
        0x35553d,
        1,
        0
      );


    const light =
      material(
        0x496b43,
        1,
        0
      );


    for (
      const [
        y,
        radius,
        height,
        mat
      ]
      of [

        [1.65, 1.15, 2.4, dark],
        [2.55, 0.9, 2.15, light],
        [3.35, 0.62, 1.75, dark]

      ]
    ) {

      const crown =
        new THREE.Mesh(

          new THREE
            .ConeGeometry(
              radius * scale,
              height * scale,
              7
            ),

          mat

        );


      crown.position.y =
        y * scale;


      crown.castShadow =
        true;


      group.add(
        crown
      );

    }


    group.position.set(
      x,
      0,
      z
    );


    scene.add(
      group
    );


    addSolidRect(
      x,
      z,
      0.42 * scale,
      0.42 * scale
    );

  }


  function addBoundaryRock(
    x,
    z,
    scale = 1,
    rotation = 0
  ) {

    const rock =
      new THREE.Mesh(

        new THREE
          .DodecahedronGeometry(
            1.8,
            0
          ),

        material(
          0x666b61,
          1,
          0
        )

      );


    rock.scale.set(
      1.45 * scale,
      1.8 * scale,
      1.25 * scale
    );


    rock.rotation.y =
      rotation;


    rock.position.set(
      x,
      1.65 * scale,
      z
    );


    rock.castShadow =
      true;


    rock.receiveShadow =
      true;


    scene.add(
      rock
    );

  }


  function addCrateStack(
    x,
    z,
    count = 2
  ) {

    for (
      let index = 0;
      index < count;
      index += 1
    ) {

      const crate =
        box(
          1.15,
          1.05,
          1.15,
          0x846448
        );


      crate.position.set(

        x +
        (
          index %
          2
        ) *
        0.75,

        0.53 +
        Math.floor(
          index /
          2
        ) *
        1.02,

        z +
        (
          index %
          2
        ) *
        0.3

      );


      scene.add(
        crate
      );

    }


    addSolidRect(
      x + 0.35,
      z + 0.15,
      1.2,
      1.0
    );

  }


  function addGate(
    z,
    facing = 1
  ) {

    const postColor =
      0x8c8b80;


    for (
      const x
      of [
        -5.7,
        5.7
      ]
    ) {

      const pillar =
        box(
          1.25,
          5.4,
          1.6,
          postColor
        );


      pillar.position.set(
        x,
        2.7,
        z
      );


      scene.add(
        pillar
      );


      addSolidRect(
        x,
        z,
        0.9,
        1.15
      );

    }


    const beam =
      box(
        10.2,
        0.72,
        0.9,
        0x35383a
      );


    beam.position.set(
      0,
      4.65,
      z
    );


    scene.add(
      beam
    );


    for (
      let i = 0;
      i < 10;
      i += 1
    ) {

      const stripe =
        box(
          0.78,
          0.18,
          0.94,
          i % 2
            ? 0x222426
            : 0xe0b932
        );


      stripe.position.set(
        -4.05 +
        i *
        0.9,
        4.67,
        z -
        0.02 *
        facing
      );


      stripe.rotation.z =
        -0.55;


      scene.add(
        stripe
      );

    }

  }


  function addMonument() {

    addFlatPatch(
      0,
      0,
      11.5,
      10.5,
      0x718850
    );


    const base1 =
      box(
        6.2,
        0.75,
        5.8,
        0x77796f
      );


    base1.position.set(
      0,
      0.38,
      0
    );


    scene.add(
      base1
    );


    const base2 =
      box(
        4.4,
        0.8,
        4.0,
        0x8a8b82
      );


    base2.position.set(
      0,
      1.08,
      0
    );


    scene.add(
      base2
    );


    const pedestal =
      box(
        2.35,
        3.4,
        2.1,
        0x6c706c
      );


    pedestal.position.set(
      0,
      3.05,
      0
    );


    scene.add(
      pedestal
    );


    const cap =
      box(
        1.5,
        0.72,
        1.5,
        0x84867f
      );


    cap.position.set(
      0,
      5.05,
      0
    );


    scene.add(
      cap
    );


    addSolidRect(
      0,
      0,
      3.6,
      3.4
    );

  }


  /*
   * MAIN ROAD NETWORK
   */

  addRoad(
    0,
    0,
    7.2,
    75
  );


  addRoad(
    0,
    -18,
    90,
    7.2
  );


  addRoad(
    0,
    18,
    90,
    7.2
  );


  addRoad(
    -43,
    0,
    7.2,
    57
  );


  addRoad(
    43,
    0,
    7.2,
    57
  );


  addRoad(
    -27,
    -31,
    31,
    6.4
  );


  addRoad(
    27,
    -31,
    31,
    6.4
  );


  addRoad(
    -27,
    31,
    31,
    6.4
  );


  addRoad(
    27,
    31,
    31,
    6.4
  );


  addRoad(
    -12,
    0,
    18,
    6.2
  );


  addRoad(
    12,
    0,
    18,
    6.2
  );


  /*
   * SEVEN HOUSES
   */

  addBuilding(
    -37,
    -27,
    9.2,
    7.1,
    4.4,
    0x8e7559
  );


  addBuilding(
    -18,
    -26,
    6.0,
    5.8,
    3.8,
    0x8b7257
  );


  addBuilding(
    34,
    -27,
    9.6,
    7.0,
    4.5,
    0x887154
  );


  addBuilding(
    31,
    -8,
    9.6,
    7.0,
    4.45,
    0x8b7357
  );


  addBuilding(
    -36,
    26,
    10.0,
    7.4,
    4.6,
    0x8f765a
  );


  addBuilding(
    13,
    26,
    7.0,
    6.2,
    4.0,
    0x8a7156
  );


  addBuilding(
    37,
    26,
    9.8,
    7.2,
    4.6,
    0x897055
  );


  /*
   * CONCRETE WALLS
   */

  for (
    const wall
    of [

      [-28, -16, 10, .7, 0],
      [-19, -23, 7, .7, Math.PI / 2],

      [18, -25, 8, .7, 0],
      [22, -22, 7, .7, Math.PI / 2],

      [-30, -3, 8, .7, Math.PI / 2],
      [-25, 9, 10, .7, 0],
      [-14, 7, 7, .7, Math.PI / 2],

      [19, -8, 8, .7, Math.PI / 2],
      [30, 10, 10, .7, 0],

      [-13, 26, 8, .7, Math.PI / 2],
      [21, 27, 8, .7, Math.PI / 2],

      [-7, -5, 5, .7, 0],
      [7, 5, 5, .7, 0],

      [-7, 5, 5, .7, Math.PI / 2],
      [7, -5, 5, .7, Math.PI / 2]

    ]
  ) {

    addWall(
      wall[0],
      wall[1],
      wall[2],
      wall[3],
      wall[4]
    );

  }


  /*
   * CENTRAL MONUMENT
   */

  addMonument();


  /*
   * CRATES
   */

  for (
    const [
      x,
      z,
      count
    ]
    of [

      [-31, -23, 3],
      [-14, -22, 2],
      [29, -22, 3],
      [37, -12, 2],

      [-30, 18, 2],
      [10, 22, 3],
      [31, 21, 2],

      [-23, 7, 2],
      [24, 8, 2]

    ]
  ) {

    addCrateStack(
      x,
      z,
      count
    );

  }


  /*
   * WOODEN FENCES
   */

  for (
    const fence
    of [

      [-36, -34, 19, 0],
      [-47, -25, 14, Math.PI / 2],

      [34, -34, 22, 0],
      [47, -25, 14, Math.PI / 2],

      [-35, 34, 20, 0],
      [-48, 25, 15, Math.PI / 2],

      [36, 34, 22, 0],
      [49, 25, 15, Math.PI / 2],

      [-26, -11, 11, 0],
      [-25, 13, 11, 0],

      [31, -1, 12, 0],
      [30, 14, 10, 0],

      [-28, 22, 10, 0],
      [20, 20, 10, 0]

    ]
  ) {

    addFence(
      fence[0],
      fence[1],
      fence[2],
      fence[3]
    );

  }


  /*
   * PINE TREES
   */

  for (
    const [
      x,
      z,
      scale
    ]
    of [

      [-50, -30, .85],
      [-44, -17, .75],
      [-33, -14, .8],
      [-24, -31, .72],
      [-10, -31, .8],

      [13, -30, .75],
      [26, -13, .8],
      [43, -14, .9],
      [49, -27, .82],

      [-49, 12, .9],
      [-42, 19, .8],
      [-23, 16, .75],
      [-15, 30, .8],

      [7, 18, .72],
      [24, 20, .86],
      [47, 17, .8],
      [50, 31, .92],

      [-6, -8, .62],
      [6, 8, .62]

    ]
  ) {

    addPine(
      x,
      z,
      scale
    );

  }


  /*
   * ROCK GROUPS
   */

  for (
    const [
      x,
      z,
      scale,
      rotation
    ]
    of [

      [-49, -8, 1.15, .2],
      [-25, -7, .85, .6],
      [-10, -23, .72, -.3],

      [26, -21, .85, .4],
      [49, -8, 1.05, -.4],

      [-24, 22, .8, -.3],
      [-9, 28, .74, .3],

      [21, 24, 1.05, .5],
      [48, 8, .9, -.2]

    ]
  ) {

    addRock(
      x,
      z,
      scale,
      rotation
    );

  }


  /*
   * NORTH / SOUTH GATES
   */

  addGate(
    -36.2,
    1
  );


  addGate(
    36.2,
    -1
  );


  /*
   * OUTSIDE CLIFF WALL
   */

  for (
    let x = -55;
    x <= 55;
    x += 8
  ) {

    if (
      Math.abs(
        x
      ) >
      8
    ) {

      addBoundaryRock(
        x,
        -38.3,
        1.25,
        x * .07
      );


      addBoundaryRock(
        x,
        38.3,
        1.25,
        -x * .05
      );

    }

  }


  for (
    let z = -31;
    z <= 31;
    z += 7.5
  ) {

    addBoundaryRock(
      -56.2,
      z,
      1.3,
      z * .08
    );


    addBoundaryRock(
      56.2,
      z,
      1.3,
      -z * .08
    );

  }


  /*
   * SMALL VEGETATION
   */

  for (
    const [
      x,
      z,
      scale
    ]
    of [

      [-41, -13, .7],
      [-33, -11, .55],
      [-12, -15, .65],
      [12, -14, .55],
      [40, -16, .6],

      [-42, 12, .6],
      [-18, 12, .62],
      [15, 13, .56],
      [41, 12, .68],

      [-6, 6, .45],
      [6, -6, .45]

    ]
  ) {

    addBush(
      x,
      z,
      scale
    );

  }

}


/*
 * =========================================================
 * COMBAT ACTORS
 * =========================================================
 */

function createTankActor({
  id,
  team,
  spawnIndex,
  object3D,
  isBot = false,
  laneIndex = 1
}) {

  return {

    id,
    team,
    spawnIndex,
    object3D,

    isBot:
      Boolean(
        isBot
      ),

    visual:
      null,

    turretPivot:
      null,

    muzzle:
      null,

    targetId:
      null,

    nextThinkAt:
      0,

    nextFireAt:
      0,

    avoidUntil:
      0,

    avoidDirection:
      1,

    blockedFor:
      0,

    laneIndex:
      THREE.MathUtils.clamp(
        Number(
          laneIndex
        ) || 0,
        0,
        MAP_LANES.length - 1
      ),

    navWaypointIndex:
      0,

    navReadyAt:
      0,

    maxHp:
      TANK_MAX_HP,

    hp:
      TANK_MAX_HP,

    hitRadius:
      TANK_HIT_RADIUS,

    alive:
      true,

    protectedUntil:
      0,

    respawnAt:
      0,

    kills:
      0,

    deaths:
      0

  };

}


function getActorSpawn(
  actor
) {

  const spawns =

    actor.team ===
    "red"

      ? RED_SPAWNS
      : BLUE_SPAWNS;


  const index =
    THREE.MathUtils
      .clamp(

        Number(
          actor.spawnIndex ??
          0
        ),

        0,
        spawns.length - 1

      );


  return spawns[
    index
  ];

}


function spawnActor(
  actor
) {

  if (
    !actor ||
    !actor.object3D
  ) {

    return;

  }


  const spawn =
    getActorSpawn(
      actor
    );


  actor.hp =
    actor.maxHp;


  actor.alive =
    true;


  actor.respawnAt =
    0;


  actor.targetId =
    null;


  actor.nextThinkAt =
    0;


  actor.nextFireAt =

    combatTime +
    0.65;


  actor.avoidUntil =
    0;


  actor.avoidDirection =

    actor.spawnIndex %
    2 ===
    0

      ? 1
      : -1;


  actor.blockedFor =
    0;


  actor.navWaypointIndex =
    0;


  actor.navReadyAt =

    combatTime +

    (
      actor.isBot

        ? 0.18 +
          actor.spawnIndex *
          0.16

        : 0
    );


  actor.protectedUntil =

    combatTime +
    SPAWN_PROTECTION_SECONDS;


  actor.object3D.visible =
    true;


  actor.object3D.position.set(

    spawn.x,

    terrainHeight(
      spawn.x,
      spawn.z
    ),

    spawn.z

  );


  actor.object3D.rotation.set(
    0,
    spawn.yaw,
    0
  );

}

function actorIsProtected(
  actor
) {

  return Boolean(

    actor &&
    actor.alive &&
    combatTime <
    actor.protectedUntil

  );

}


function destroyActor(
  actor,
  sourceActorId = null
) {

  if (
    !actor ||
    !actor.alive
  ) {

    return;

  }


  actor.hp =
    0;


  actor.alive =
    false;


  actor.deaths +=
    1;


  actor.respawnAt =

    combatTime +
    RESPAWN_DELAY_SECONDS;


  if (
    actor.object3D
  ) {

    actor.object3D.visible =
      false;

  }


  const sourceActor =
    actors.get(
      sourceActorId
    );


  if (
  sourceActor &&
  sourceActor !==
  actor
) {

  sourceActor.kills +=
    1;


  if (
    sourceActor.team !==
    actor.team &&
    sourceActor.team in
    teamScores
  ) {

    teamScores[
      sourceActor.team
    ] +=
      1;

  }

}
}


function applyDamage(
  actor,
  amount,
  sourceActorId = null
) {

  if (
    !actor ||
    !actor.alive ||
    actorIsProtected(
      actor
    )
  ) {

    return false;

  }


  actor.hp =

    Math.max(

      0,

      actor.hp -
      Math.max(
        0,
        Number(
          amount
        ) ||
        0
      )

    );


  if (
    actor.hp <=
    0
  ) {

    destroyActor(
      actor,
      sourceActorId
    );

  }


  return true;

}


function updateCombatActors() {

if (
  matchState.status !==
  "running"
) {

  return;

}
  
  for (
    const actor
    of actors.values()
  ) {

    if (
      actor.alive ||
      combatTime <
      actor.respawnAt
    ) {

      continue;

    }


    spawnActor(
      actor
    );

  }

}

  function restoreStartPanel() {

  const title =
    el(
      "ltPanelTitle"
    );

  const copy =
    el(
      "ltPanelCopy"
    );

  const primary =
    el(
      "ltPrimary"
    );


  if (title) {

    title.textContent =
      "MAP 01 · VILLAGE";

  }


  if (copy) {

    copy.textContent =
      "4v4 local battle · first to 10 kills or highest score after 3 minutes.";

  }


  if (primary) {

    primary.disabled =
      false;

    primary.textContent =
      "START LOCAL MATCH";

  }

}


function showMatchResultPanel() {

  const panel =
    el(
      "ltPanel"
    );

  const title =
    el(
      "ltPanelTitle"
    );

  const copy =
    el(
      "ltPanelCopy"
    );

  const primary =
    el(
      "ltPrimary"
    );


  if (
    !panel ||
    !title ||
    !copy ||
    !primary
  ) {

    return;

  }


  const result =

    matchState.winner ===
    "draw"

      ? "DRAW"

      : String(
          matchState.winner ||
          ""
        ).toUpperCase() +
        " WINS";


  title.textContent =
    result;


  copy.textContent =

    "BLUE " +
    teamScores.blue +
    " · " +
    teamScores.red +
    " RED" +

    (
      localPlayerActor

        ? " · K " +
          localPlayerActor.kills +
          " / D " +
          localPlayerActor.deaths

        : ""
    );


  primary.textContent =

    serverAuthorityEnabled

      ? "WAIT FOR SERVER"
      : "REMATCH";


  primary.disabled =
    serverAuthorityEnabled;


  panel.hidden =
    false;

}


function handlePrimaryAction() {

  if (
    phase ===
      "running" &&
    matchState.status ===
      "ended"
  ) {

    if (
      restartMatch()
    ) {

      const panel =
        el(
          "ltPanel"
        );


      if (panel) {

        panel.hidden =
          true;

      }

    }


    return;

  }


  void startGame();

}

  function resetMatchState() {

  matchState.status =
    "running";


  matchState.timeRemaining =
    MATCH_DURATION_SECONDS;


  matchState.winner =
    null;

}


function endMatch(
  winner = null
) {

  if (
    matchState.status !==
    "running"
  ) {

    return;

  }


  matchState.status =
    "ended";


  matchState.winner =
    winner;


  clearCombatFX();


  showMatchResultPanel();

}


function updateMatch(
  dt
) {

  if (
    matchState.status !==
    "running"
  ) {

    return;

  }


  matchState.timeRemaining =

    Math.max(

      0,

      matchState.timeRemaining -
      dt

    );


  if (
    teamScores.blue >=
    MATCH_SCORE_LIMIT
  ) {

    endMatch(
      "blue"
    );

    return;

  }


  if (
    teamScores.red >=
    MATCH_SCORE_LIMIT
  ) {

    endMatch(
      "red"
    );

    return;

  }


  if (
    matchState.timeRemaining >
    0
  ) {

    return;

  }


  if (
    teamScores.blue >
    teamScores.red
  ) {

    endMatch(
      "blue"
    );

  } else if (
    teamScores.red >
    teamScores.blue
  ) {

    endMatch(
      "red"
    );

  } else {

    endMatch(
      "draw"
    );

  }

}

function updateCombatStatus() {

  const status =
    el(
      "ltStatus"
    );


  if (
    !status ||
    !localPlayerActor
  ) {

    return;

  }


  const minutes =
    Math.floor(
      matchState.timeRemaining /
      60
    );


  const seconds =
    Math.floor(
      matchState.timeRemaining %
      60
    );


  const timeText =

    String(
      minutes
    ) +
    ":" +
    String(
      seconds
    ).padStart(
      2,
      "0"
    );


  const scoreText =

    "BLUE " +
    teamScores.blue +
    " · " +
    teamScores.red +
    " RED";


  if (
    matchState.status ===
    "ended"
  ) {

    const result =

      matchState.winner ===
      "draw"

        ? "DRAW"

        : String(
            matchState.winner ||
            ""
          ).toUpperCase() +
          " WINS";


    status.textContent =

      scoreText +
      " · " +
      result;
    showMatchResultPanel();

    return;

  }


  if (
    !localPlayerActor.alive
  ) {

    const remaining =
      Math.max(

        0,

        localPlayerActor.respawnAt -
        combatTime

      );


    status.textContent =

      timeText +
      " · " +
      scoreText +
      " · RESPAWN " +
      remaining.toFixed(
        1
      ) +
      "s";


    return;

  }


  const protection =
    Math.max(

      0,

      localPlayerActor.protectedUntil -
      combatTime

    );


  status.textContent =

    timeText +
    " · " +
    scoreText +
    " · HP " +
    localPlayerActor.hp +
    "/" +
    localPlayerActor.maxHp +
    " · K " +
localPlayerActor.kills +
" D " +
localPlayerActor.deaths +

    (
      protection >
      0

        ? " · SHIELD " +
          protection.toFixed(
            1
          ) +
          "s"

        : ""
    );

}

  /*
   * =========================================================
   * PLAYER
   * =========================================================
   */

  function createPlayerShell() {

    player =
      new THREE.Group();


    player.rotation.order =
      "YXZ";


    playerVisual =
      new THREE.Group();


    player.add(
      playerVisual
    );


    /*
     * Because both Meshy tank files are
     * one single mesh, their real turret
     * cannot rotate separately.
     *
     * This marker represents aim direction.
     */

    aimMarker =
      new THREE.Group();


    const lineGeometry =

      new THREE
        .BufferGeometry()
        .setFromPoints([

          new THREE.Vector3(
            0,
            0.28,
            0
          ),

          new THREE.Vector3(
            0,
            0.28,
            -3.4
          )

        ]);


    const line =
      new THREE.Line(

        lineGeometry,

        new THREE
          .LineBasicMaterial({

            color:
              0xccff00,

            transparent:
              true,

            opacity:
              0.82

          })

      );


    aimMarker.add(
      line
    );


    player.add(
      aimMarker
    );


    scene.add(
  player
);


localPlayerActor =
  createTankActor({

    id:
      "blue-local-1",

    team:
      "blue",

    spawnIndex:
      1,

    object3D:
      player

  });


actors.set(
  localPlayerActor.id,
  localPlayerActor
);


resetPlayerToSpawn();
  }

  function createBotActors() {

  if (
    botActors.length >
    0
  ) {

    return;

  }


    const definitions = [

    {
      id: "blue-bot-1",
      team: "blue",
      spawnIndex: 0,
      laneIndex: 0
    },

    {
      id: "blue-bot-2",
      team: "blue",
      spawnIndex: 2,
      laneIndex: 1
    },

    {
      id: "blue-bot-3",
      team: "blue",
      spawnIndex: 3,
      laneIndex: 2
    },

    {
      id: "red-bot-1",
      team: "red",
      spawnIndex: 0,
      laneIndex: 0
    },

    {
      id: "red-bot-2",
      team: "red",
      spawnIndex: 1,
      laneIndex: 1
    },

    {
      id: "red-bot-3",
      team: "red",
      spawnIndex: 2,
      laneIndex: 1
    },

    {
      id: "red-bot-4",
      team: "red",
      spawnIndex: 3,
      laneIndex: 2
    }

  ];


  for (
    const definition
    of definitions
  ) {

    const root =
      new THREE.Group();


    root.rotation.order =
      "YXZ";


    root.visible =
      false;


    const visual =
      new THREE.Group();


    root.add(
      visual
    );


    scene.add(
      root
    );


    const actor =
      createTankActor({

        ...definition,

        object3D:
          root,

        isBot:
          true

      });


    actor.visual =
      visual;


    actors.set(
      actor.id,
      actor
    );


    botActors.push(
      actor
    );

  }

}


function resetCombatRoster() {

  teamScores.blue =
    0;


  teamScores.red =
    0;


  for (
    const actor
    of actors.values()
  ) {

    actor.kills =
      0;


    actor.deaths =
      0;


    actor.targetId =
      null;


    actor.nextThinkAt =
      0;

    actor.nextFireAt =
  0;


actor.avoidUntil =
  0;

    if (
      actor ===
      localPlayerActor
    ) {

      resetPlayerToSpawn();

    } else {

      spawnActor(
        actor
      );

    }

  }

}

function resetPlayerToSpawn() {

  if (
    !localPlayerActor
  ) {

    return;

  }


  spawnActor(
    localPlayerActor
  );


  aimMarker.rotation.y =
    0;


  hasAim =
    false;

}
  
  /*
   * =========================================================
   * GLB TANK
   * =========================================================
   */

  function normalizeTankModel(
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


    let box3 =
      new THREE
        .Box3()
        .setFromObject(
          model
        );


    let size =
      box3.getSize(
        new THREE.Vector3()
      );


    /*
     * Automatically rotate models
     * exported sideways.
     */

    if (
      size.x >
      size.z *
      1.15
    ) {

      model.rotation.y =
  -Math.PI /
  2;

      model.updateMatrixWorld(
        true
      );


      box3 =
        new THREE
          .Box3()
          .setFromObject(
            model
          );


      size =
        box3.getSize(
          new THREE.Vector3()
        );

    }


    const horizontal =
      Math.max(

        size.x,
        size.z,
        0.001

      );


    model.scale
      .setScalar(
        3.25 /
        horizontal
      );


    model.updateMatrixWorld(
      true
    );


    box3 =
      new THREE
        .Box3()
        .setFromObject(
          model
        );


    const center =
      box3.getCenter(
        new THREE.Vector3()
      );


    model.position.x -=
      center.x;


    model.position.z -=
      center.z;


    model.position.y -=
      box3.min.y;


    model.traverse(
      child => {

        if (
          !child.isMesh
        ) {

          return;

        }


        child.castShadow =
          true;


        child.receiveShadow =
          true;


        child.frustumCulled =
          false;


        const materials =

          Array.isArray(
            child.material
          )

            ? child.material
            : [
                child.material
              ];


        for (
          const item
          of materials
        ) {

          if (!item) {

            continue;

          }


          if (
            "roughness" in
            item
          ) {

            item.roughness =

              Math.max(

                0.42,

                Number(
                  item.roughness ??
                  0.7
                )

              );

          }


          item.needsUpdate =
            true;

        }

      }

    );


    model.updateMatrixWorld(
      true
    );

  }

  

  function loadTankTemplate(
    url
  ) {

    if (
      tankTemplatePromises
        .has(
          url
        )
    ) {

      return (
        tankTemplatePromises
          .get(
            url
          )
      );

    }


    const promise =

      new Promise(

        (
          resolve,
          reject
        ) => {

          loader.load(

            url,

            gltf => {

              const model =
                gltf
                  ?.scene;


              if (!model) {

                reject(

                  new Error(
                    `Tank GLB has no scene: ${url}`
                  )

                );


                return;

              }

rigTankModel(
  model,
  url
);
              
              normalizeTankModel(
                model
              );


              resolve(
                model
              );

            },

            undefined,

            reject

          );

        }

      );


    tankTemplatePromises
      .set(
        url,
        promise
      );


    return promise;

  }

async function mountPlayerTank() {

  playerVisual.clear();


  const template =

    await loadTankTemplate(
      TEAM_BLUE_MODEL
    );


  const model =
    template.clone(
      true
    );


  playerTurretPivot =
    model.getObjectByName(
      "TurretPivot"
    );


  playerMuzzle =
    model.getObjectByName(
      "Muzzle"
    );


  if (
    !playerTurretPivot ||
    !playerMuzzle
  ) {

    throw new Error(
      "Player tank rig is incomplete."
    );

  }


  playerVisual.add(
    model
  );


  if (
    localPlayerActor
  ) {

    localPlayerActor.visual =
      playerVisual;


    localPlayerActor.turretPivot =
      playerTurretPivot;


    localPlayerActor.muzzle =
      playerMuzzle;

  }

}


async function mountBotTank(
  actor
) {

  if (
    !actor ||
    !actor.visual
  ) {

    return;

  }


  actor.visual.clear();


  const modelUrl =

    actor.team ===
    "red"

      ? TEAM_RED_MODEL
      : TEAM_BLUE_MODEL;


  const template =

    await loadTankTemplate(
      modelUrl
    );


  const model =
    template.clone(
      true
    );


  actor.turretPivot =
    model.getObjectByName(
      "TurretPivot"
    );


  actor.muzzle =
    model.getObjectByName(
      "Muzzle"
    );


  if (
    !actor.turretPivot ||
    !actor.muzzle
  ) {

    throw new Error(
      `Bot tank rig is incomplete: ${actor.id}`
    );

  }


  actor.visual.add(
    model
  );

}


async function mountBotTanks() {

  await Promise.all(

    botActors
      .map(
        actor =>
          mountBotTank(
            actor
          )
      )

  );

}


function findNearestEnemyActor(
  actor
) {

  if (
    !actor ||
    !actor.alive ||
    !actor.object3D
  ) {

    return null;

  }


  let best =
    null;


  let bestDistanceSq =
    Infinity;


  for (
    const candidate
    of actors.values()
  ) {

    if (
      candidate ===
      actor ||
      !candidate.alive ||
      !candidate.object3D ||
      candidate.team ===
      actor.team
    ) {

      continue;

    }


    const distanceSq =
      actor.object3D
        .position
        .distanceToSquared(
          candidate.object3D
            .position
        );


    if (
      distanceSq <
      bestDistanceSq
    ) {

      best =
        candidate;


      bestDistanceSq =
        distanceSq;

    }

  }


  return best;

}


function aimBotTurretAt(
  actor,
  target
) {

  if (
    !actor ||
    !actor.turretPivot ||
    !actor.object3D ||
    !target ||
    !target.object3D
  ) {

    return;

  }


  const frame =
    actor.turretPivot.parent;


  if (!frame) {

    return;

  }


  actor.object3D
    .updateMatrixWorld(
      true
    );


  const worldPoint =
    target.object3D
      .position
      .clone();


  worldPoint.y +=
    0.8;


  const localTarget =
    frame.worldToLocal(
      worldPoint
    );


  const dx =

    localTarget.x -
    actor.turretPivot
      .position.x;


  const dz =

    localTarget.z -
    actor.turretPivot
      .position.z;


  if (
    Math.hypot(
      dx,
      dz
    ) <
    0.001
  ) {

    return;

  }


  actor.turretPivot.rotation.y =

    Math.atan2(
      dz,
      -dx
    );

}


function updateBotTargets() {

if (
  matchState.status !==
  "running"
) {

  return;

}
  
  for (
    const actor
    of botActors
  ) {

    if (
      !actor.alive ||
      combatTime <
      actor.nextThinkAt
    ) {

      continue;

    }


    actor.nextThinkAt =

      combatTime +
      0.4;


    const target =
      findNearestEnemyActor(
        actor
      );


    actor.targetId =

      target
        ?.id ||
      null;


    if (
      target
    ) {

      aimBotTurretAt(
        actor,
        target
      );

    }

  }

}

  /*
   * =========================================================
   * RESIZE
   * =========================================================
   */

  function resize() {

    if (
      !renderer ||
      !camera
    ) {

      return;

    }


    const stage =
      el(
        "ltStage"
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


    renderer
      .setPixelRatio(

        Math.min(

          window.devicePixelRatio ||
          1,

          width <
          760

            ? 1.05
            : 1.25

        )

      );


    renderer
      .setSize(

        width,
        height,
        false

      );


    camera.aspect =
      width /
      height;


    camera.fov =

  width <
  760

    ? 50
    : 43;


    camera
      .updateProjectionMatrix();

  }

  /*
   * =========================================================
   * COLLISION
   * =========================================================
   */

function collidesAt(
  x,
  z
) {

  if (
    Math.abs(
      x
    ) >
    MAP_HALF_X ||

    Math.abs(
      z
    ) >
    MAP_HALF_Z
  ) {

    return true;

  }


  return solidRects
    .some(
      rect =>

        x +
        TANK_RADIUS >
        rect.minX &&

        x -
        TANK_RADIUS <
        rect.maxX &&

        z +
        TANK_RADIUS >
        rect.minZ &&

        z -
        TANK_RADIUS <
        rect.maxZ

    );

}

  function actorCollidesAt(
  actor,
  x,
  z
) {

  if (
    collidesAt(
      x,
      z
    )
  ) {

    return true;

  }


  for (
    const other
    of actors.values()
  ) {

    if (
      other ===
      actor ||
      !other.alive ||
      !other.object3D
    ) {

      continue;

    }


    const dx =
      x -
      other.object3D.position.x;


    const dz =
      z -
      other.object3D.position.z;


    const minDistance =

      actor.hitRadius +
      other.hitRadius +
      0.35;


    if (
      dx * dx +
      dz * dz <
      minDistance *
      minDistance
    ) {

      return true;

    }

  }


  return false;

}


function normalizeAngle(
  angle
) {

  return Math.atan2(
    Math.sin(
      angle
    ),
    Math.cos(
      angle
    )
  );

}


function getBotLane(
  actor
) {

  const laneIndex =
    THREE.MathUtils.clamp(
      Number(
        actor?.laneIndex
      ) || 0,
      0,
      MAP_LANES.length - 1
    );


  return MAP_LANES[
    laneIndex
  ];

}


function getBotNavigationPoint(
  actor,
  target
) {

  if (
    !actor ||
    !actor.object3D
  ) {

    return null;

  }


  const lane =
    getBotLane(
      actor
    );


  const waypoints =
    lane?.waypoints ||
    [];


  const root =
    actor.object3D;


  const enemyDistance =

    target
      ?.object3D

      ? root.position.distanceTo(
          target.object3D.position
        )

      : Infinity;


  if (
    enemyDistance <
    12
  ) {

    return target
      .object3D
      .position
      .clone();

  }


  while (
    actor.navWaypointIndex <
    waypoints.length
  ) {

    const routeIndex =

      actor.team ===
      "red"

        ? waypoints.length -
          1 -
          actor.navWaypointIndex

        : actor.navWaypointIndex;


    const waypoint =
      waypoints[
        routeIndex
      ];


    const distance =
      Math.hypot(

        waypoint.x -
        root.position.x,

        waypoint.z -
        root.position.z

      );


    if (
      distance >
      3.2
    ) {

      return new THREE.Vector3(
        waypoint.x,
        0,
        waypoint.z
      );

    }


    actor.navWaypointIndex +=
      1;

  }


  return target
    ?.object3D
    ?.position
    ?.clone?.() ||
    null;

}


function getBotDirection(
  yaw
) {

  return new THREE.Vector3(
    0,
    0,
    -1
  )
    .applyAxisAngle(

      new THREE.Vector3(
        0,
        1,
        0
      ),

      yaw

    );

}


function updateBotMovement(
  dt
) {

  if (
    matchState.status !==
    "running"
  ) {

    return;

  }


  for (
    const actor
    of botActors
  ) {

    if (
      !actor.alive ||
      !actor.object3D ||
      combatTime <
      actor.navReadyAt
    ) {

      continue;

    }


    const target =
      actors.get(
        actor.targetId
      );


    if (
      !target ||
      !target.alive ||
      !target.object3D
    ) {

      continue;

    }


    const root =
      actor.object3D;


    const navigationPoint =
      getBotNavigationPoint(
        actor,
        target
      );


    if (
      !navigationPoint
    ) {

      continue;

    }


    const enemyDistance =
      root.position.distanceTo(
        target.object3D.position
      );


    const dx =
      navigationPoint.x -
      root.position.x;


    const dz =
      navigationPoint.z -
      root.position.z;


    const navigationDistance =
      Math.hypot(
        dx,
        dz
      );


    let desiredYaw =
      Math.atan2(
        -dx,
        -dz
      );


    if (
      combatTime <
      actor.avoidUntil
    ) {

      desiredYaw +=

        actor.avoidDirection *
        0.84;

    }


    const yawDelta =
      normalizeAngle(

        desiredYaw -
        root.rotation.y

      );


    root.rotation.y +=

      THREE.MathUtils.clamp(

        yawDelta,

        -BOT_TURN_SPEED *
        dt,

        BOT_TURN_SPEED *
        dt

      );


    if (
      enemyDistance <=
      BOT_STOP_DISTANCE &&
      navigationDistance <=
      13
    ) {

      actor.blockedFor =
        0;

      continue;

    }


    const forward =
      getBotDirection(
        root.rotation.y
      );


    const turnScale =
      THREE.MathUtils.clamp(

        1 -
        Math.abs(
          yawDelta
        ) /
        1.8,

        0.34,
        1

      );


    const moveDistance =

      BOT_MOVE_SPEED *
      turnScale *
      dt;


    const nextX =

      root.position.x +
      forward.x *
      moveDistance;


    const nextZ =

      root.position.z +
      forward.z *
      moveDistance;


    if (
      actorCollidesAt(
        actor,
        nextX,
        nextZ
      )
    ) {

      actor.blockedFor =

        (
          actor.blockedFor ||
          0
        ) +
        dt;


      const probeDistance =
        3.4;


      const leftDirection =
        getBotDirection(
          root.rotation.y +
          0.92
        );


      const rightDirection =
        getBotDirection(
          root.rotation.y -
          0.92
        );


      const leftBlocked =
        actorCollidesAt(

          actor,

          root.position.x +
          leftDirection.x *
          probeDistance,

          root.position.z +
          leftDirection.z *
          probeDistance

        );


      const rightBlocked =
        actorCollidesAt(

          actor,

          root.position.x +
          rightDirection.x *
          probeDistance,

          root.position.z +
          rightDirection.z *
          probeDistance

        );


      if (
        leftBlocked !==
        rightBlocked
      ) {

        actor.avoidDirection =

          leftBlocked
            ? -1
            : 1;

      } else if (
        actor.blockedFor >
        0.45
      ) {

        actor.avoidDirection =

          actor.avoidDirection ===
          1

            ? -1
            : 1;

      }


      actor.avoidUntil =

        combatTime +

        (
          actor.blockedFor >
          0.9

            ? 1.35
            : 0.9
        );


      root.rotation.y +=

        actor.avoidDirection *
        BOT_TURN_SPEED *
        dt *
        1.9;


      if (
        actor.blockedFor >
        0.9
      ) {

        const reverseX =

          root.position.x -
          forward.x *
          moveDistance *
          1.7;


        const reverseZ =

          root.position.z -
          forward.z *
          moveDistance *
          1.7;


        if (
          !actorCollidesAt(
            actor,
            reverseX,
            reverseZ
          )
        ) {

          root.position.x =
            reverseX;

          root.position.z =
            reverseZ;

        }

      }


      continue;

    }


    actor.blockedFor =
      0;


    root.position.x =
      nextX;


    root.position.z =
      nextZ;


    const groundY =
      terrainHeight(
        root.position.x,
        root.position.z
      );


    const slope =
      terrainSlope(
        root.position.x,
        root.position.z
      );


    root.position.y =
      groundY +
      0.03;


    root.rotation.x =

      THREE.MathUtils.clamp(

        slope.z *
        0.65,

        -0.24,
        0.24

      );


    root.rotation.z =

      THREE.MathUtils.clamp(

        -slope.x *
        0.65,

        -0.24,
        0.24

      );

  }

}
  /*
   * =========================================================
   * PLAYER MOVEMENT
   * =========================================================
   */

 function updatePlayer(
  dt
) {

  if (
    !player ||
    !localPlayerActor ||
    !localPlayerActor.alive ||
    matchState.status !==
    "running" ||
    serverAuthorityEnabled
  ) {

    return;

  }


  const input =
    readLocalDriveInput();


  const forward =
    input.forward;


  const turn =
    input.turn;


  player.rotation.y +=

    turn *
    TURN_SPEED *
    dt;


  const direction =
    new THREE.Vector3(
      0,
      0,
      -1
    )
      .applyAxisAngle(

        new THREE.Vector3(
          0,
          1,
          0
        ),

        player.rotation.y

      );


  const speed =

    forward >=
    0

      ? MOVE_SPEED
      : REVERSE_SPEED;


  const nextX =

    player.position.x +

    direction.x *
    forward *
    speed *
    dt;


  const nextZ =

    player.position.z +

    direction.z *
    forward *
    speed *
    dt;


  if (
    !collidesAt(
      nextX,
      player.position.z
    )
  ) {

    player.position.x =
      nextX;

  }


  if (
    !collidesAt(
      player.position.x,
      nextZ
    )
  ) {

    player.position.z =
      nextZ;

  }


  const groundY =
    terrainHeight(
      player.position.x,
      player.position.z
    );


  const slope =
    terrainSlope(
      player.position.x,
      player.position.z
    );


  player.position.y =
    groundY +
    0.03;


  player.rotation.x =

    THREE.MathUtils.clamp(

      slope.z *
      0.65,

      -0.24,
      0.24

    );


  player.rotation.z =

    THREE.MathUtils.clamp(

      -slope.x *
      0.65,

      -0.24,
      0.24

    );

}

  /*
   * =========================================================
   * AIM
   * =========================================================
   */

    function aimTurretAt(
  worldPoint
) {

  if (
    !player ||
    !playerTurretPivot ||
    !worldPoint
  ) {

    return;

  }


  const frame =
    playerTurretPivot.parent;


  if (!frame) {

    return;

  }


  /*
   * Ensure all parent transforms,
   * including terrain pitch/roll,
   * are current.
   */

  player.updateMatrixWorld(
    true
  );


  /*
   * Convert target from world space
   * into the original tank mesh space.
   */

  const localTarget =
    frame.worldToLocal(
      worldPoint.clone()
    );


  const dx =

    localTarget.x -

    playerTurretPivot
      .position.x;


  const dz =

    localTarget.z -

    playerTurretPivot
      .position.z;


  if (
    Math.hypot(
      dx,
      dz
    ) <
    0.001
  ) {

    return;

  }


  /*
   * Meshy barrel points toward local -X.
   */

  playerTurretPivot
    .rotation.y =

    Math.atan2(
      dz,
      -dx
    );

}

  function updateAim() {

    if (
      !player ||
      !camera
    ) {

      return;

    }


    raycaster
      .setFromCamera(

        pointerNdc,
        camera

      );


    const point =
      new THREE.Vector3();


    if (
      !raycaster
        .ray
        .intersectPlane(

          groundPlane,
          point

        )
    ) {

      return;

    }


    point.y =
      terrainHeight(
        point.x,
        point.z
      );


    aimWorld.copy(
      point
    );


    hasAim =
      true;


    const dx =

      point.x -
      player.position.x;


    const dz =

      point.z -
      player.position.z;


    const worldYaw =

      Math.atan2(
        -dx,
        -dz
      );


    aimMarker.rotation.y =

      worldYaw -
      player.rotation.y;

    aimTurretAt(
  point
);

  }


  /*
   * =========================================================
   * FIRE
   * =========================================================
   */

  function fireActorProjectile(
  actor,
  target
) {

  if (
    !actor ||
    !actor.alive ||
    !actor.muzzle ||
    !actor.object3D ||
    !target ||
    !target.alive ||
    !target.object3D ||
    matchState.status !==
    "running" ||
    combatTime <
    actor.nextFireAt
  ) {

    return false;

  }


  actor.object3D.updateMatrixWorld(
    true
  );


  const origin =
    new THREE.Vector3();


  actor.muzzle.getWorldPosition(
    origin
  );


  const targetPoint =
    target.object3D.position.clone();


  targetPoint.y +=
    0.85;


  const direction =

    targetPoint
      .sub(
        origin
      )
      .normalize();


  origin.addScaledVector(
    direction,
    0.18
  );


  const projectile =
    new THREE.Mesh(

      new THREE.SphereGeometry(
        0.14,
        10,
        7
      ),

      new THREE.MeshBasicMaterial({

        color:

          actor.team ===
          "red"

            ? 0xff6a5f
            : 0x6ca8ff

      })

    );


  projectile.position.copy(
    origin
  );


  scene.add(
    projectile
  );


  bullets.push({

    mesh:
      projectile,

    direction,

    ownerId:
      actor.id,

    team:
      actor.team,

    damage:
      BULLET_DAMAGE,

    age:
      0

  });


  actor.nextFireAt =

    combatTime +
    BOT_FIRE_COOLDOWN;


  return true;

}


function updateBotCombat() {

  if (
    matchState.status !==
    "running"
  ) {

    return;

  }


  for (
    const actor
    of botActors
  ) {

    if (
      !actor.alive ||
      actorIsProtected(
        actor
      )
    ) {

      continue;

    }


    const target =
      actors.get(
        actor.targetId
      );


    if (
      !target ||
      !target.alive ||
      !target.object3D ||
      target.team ===
      actor.team
    ) {

      continue;

    }


    const distance =
      actor.object3D.position.distanceTo(
        target.object3D.position
      );


    if (
      distance >
      BOT_FIRE_RANGE
    ) {

      continue;

    }


    aimBotTurretAt(
      actor,
      target
    );


    fireActorProjectile(
      actor,
      target
    );

  }

}

 function fire() {
if (
  phase !==
  "running" ||
  matchState.status !==
  "running" ||

    !player ||

   !playerMuzzle ||

!localPlayerActor ||
!localPlayerActor.alive ||

fireCooldown >
0
  ) {

    return;

  }

localFireSequence +=
  1;


if (
  serverAuthorityEnabled
) {

  return;

}


fireCooldown =
  FIRE_COOLDOWN;


  /*
   * Берём реальную мировую позицию
   * Muzzle внутри вращающейся башни.
   */

  player.updateMatrixWorld(
    true
  );


  const origin =
    new THREE.Vector3();


  playerMuzzle
    .getWorldPosition(
      origin
    );


  let direction;


  if (hasAim) {

    direction =

      aimWorld
        .clone()
        .sub(
          origin
        )
        .normalize();

  } else {

    /*
     * В исходном GLB ствол направлен
     * вдоль локальной оси -X.
     */

    const muzzleQuaternion =
      new THREE.Quaternion();


    playerMuzzle
      .getWorldQuaternion(
        muzzleQuaternion
      );


    direction =

      new THREE.Vector3(
        -1,
        0,
        0
      )
        .applyQuaternion(
          muzzleQuaternion
        )
        .normalize();

  }


  /*
   * Чуть выносим снаряд вперёд,
   * чтобы он появлялся уже за краем дула.
   */

  origin.addScaledVector(
    direction,
    0.18
  );


  const projectile =
    new THREE.Mesh(

      new THREE
        .SphereGeometry(
          0.14,
          10,
          7
        ),

      new THREE
        .MeshBasicMaterial({

          color:
            0xccff00

        })

    );


  projectile.position
    .copy(
      origin
    );


  scene.add(
    projectile
  );

bullets.push({

  mesh:
    projectile,

  direction,

  ownerId:
    localPlayerActor.id,

  team:
    localPlayerActor.team,

  damage:
    BULLET_DAMAGE,

  age:
    0

});

}
function findBulletActorHitBetween(
  bullet,
  from,
  to
) {

  if (
    !bullet ||
    !from ||
    !to
  ) {

    return null;

  }


  const segment =
    to.clone()
      .sub(
        from
      );


  const lengthSq =
    segment.lengthSq();


  if (
    lengthSq <=
    0
  ) {

    return null;

  }


  let best =
    null;


  for (
    const actor
    of actors.values()
  ) {

    if (
      !actor.alive ||
      !actor.object3D ||
      actor.id ===
        bullet.ownerId ||
      actor.team ===
        bullet.team
    ) {

      continue;

    }


    const target =
      actor.object3D
        .position
        .clone();


    target.y +=
      0.85;


    const offset =
      target.clone()
        .sub(
          from
        );


    const t =
      THREE.MathUtils
        .clamp(

          offset.dot(
            segment
          ) /
          lengthSq,

          0,
          1

        );


    const point =
      from.clone()
        .addScaledVector(
          segment,
          t
        );


    const dx =
      point.x -
      target.x;


    const dz =
      point.z -
      target.z;


    if (
      dx * dx +
      dz * dz >
      actor.hitRadius *
      actor.hitRadius
    ) {

      continue;

    }


    if (
      Math.abs(
        point.y -
        target.y
      ) >
      1.55
    ) {

      continue;

    }


    if (
      !best ||
      t <
      best.t
    ) {

      best = {
        actor,
        t,
        point
      };

    }

  }


  return best;

}

  function bulletHitsSolid(
    position
  ) {

    if (
      Math.abs(
        position.x
      ) >
      MAP_WIDTH /
      2 ||

      Math.abs(
        position.z
      ) >
      MAP_DEPTH /
      2
    ) {

      return true;

    }


    if (
      position.y <=

      terrainHeight(
        position.x,
        position.z
      ) +

      0.12
    ) {

      return true;

    }


    return solidRects
      .some(
        rect =>

          position.x >=
          rect.minX &&

          position.x <=
          rect.maxX &&

          position.z >=
          rect.minZ &&

          position.z <=
          rect.maxZ &&

          position.y <=
          5.5

      );

  }

  function findBulletSolidHitBetween(
  from,
  to
) {

  const distance =
    from.distanceTo(
      to
    );


  const steps =
    Math.max(

      1,

      Math.ceil(
        distance /
        0.28
      )

    );


  for (
    let step = 1;
    step <= steps;
    step += 1
  ) {

    const t =
      step /
      steps;


    const point =
      from.clone()
        .lerp(
          to,
          t
        );


    if (
      bulletHitsSolid(
        point
      )
    ) {

      return {
        t,
        point
      };

    }

  }


  return null;

}

  function createImpact(
    position
  ) {

    const impact =
      new THREE.Mesh(

        new THREE
          .SphereGeometry(
            0.18,
            10,
            7
          ),

        new THREE
          .MeshBasicMaterial({

            color:
              0xffc54d,

            transparent:
              true,

            opacity:
              1

          })

      );


    impact.position
      .copy(
        position
      );


    scene.add(
      impact
    );


    impacts.push({

      mesh:
        impact,

      age:
        0

    });

  }


  function removeBullet(
    index
  ) {

    const bullet =
      bullets[
        index
      ];


    if (!bullet) {

      return;

    }


    scene.remove(
      bullet.mesh
    );


    bullet.mesh
      .geometry
      ?.dispose
      ?.();


    bullet.mesh
      .material
      ?.dispose
      ?.();


   bullets.splice(
  index,
  1
);

}

function updateBullets(
  dt
) {

  for (

    let index =
      bullets.length -
      1;

    index >= 0;

    index -= 1

  ) {

    const bullet =
      bullets[
        index
      ];


    bullet.age +=
      dt;


    const from =
      bullet.mesh
        .position
        .clone();


    const to =
      from.clone()
        .addScaledVector(

          bullet.direction,

          BULLET_SPEED *
          dt

        );


    const actorHit =
      findBulletActorHitBetween(
        bullet,
        from,
        to
      );


    const solidHit =
      findBulletSolidHitBetween(
        from,
        to
      );


    const actorFirst =

      actorHit &&
      (
        !solidHit ||
        actorHit.t <=
        solidHit.t
      );


    if (
      actorFirst
    ) {

      bullet.mesh
        .position
        .copy(
          actorHit.point
        );


      applyDamage(
        actorHit.actor,
        bullet.damage,
        bullet.ownerId
      );


      createImpact(
        actorHit.point
      );


      removeBullet(
        index
      );


      continue;

    }


    if (
      solidHit
    ) {

      bullet.mesh
        .position
        .copy(
          solidHit.point
        );


      createImpact(
        solidHit.point
      );


      removeBullet(
        index
      );


      continue;

    }


    bullet.mesh
      .position
      .copy(
        to
      );


    if (
      bullet.age >=
      BULLET_LIFE
    ) {

      removeBullet(
        index
      );

    }

  }

}


  function updateImpacts(
    dt
  ) {

    for (

      let index =
        impacts.length -
        1;

      index >= 0;

      index -= 1

    ) {

      const impact =
        impacts[
          index
        ];


      impact.age +=
        dt;


      const progress =

        THREE.MathUtils
          .clamp(

            impact.age /
            0.24,

            0,
            1

          );


      impact.mesh.scale
        .setScalar(

          1 +
          progress *
          2.8

        );


      impact.mesh
        .material
        .opacity =

        1 -
        progress;


      if (
        progress >=
        1
      ) {

        scene.remove(
          impact.mesh
        );


        impact.mesh
          .geometry
          ?.dispose
          ?.();


        impact.mesh
          .material
          ?.dispose
          ?.();


        impacts.splice(
          index,
          1
        );

      }

    }

  }


  function clearCombatFX() {

    for (

      let index =
        bullets.length -
        1;

      index >= 0;

      index -= 1

    ) {

      removeBullet(
        index
      );

    }


    for (
      const impact
      of impacts
    ) {

      scene.remove(
        impact.mesh
      );


      impact.mesh
        .geometry
        ?.dispose
        ?.();


      impact.mesh
        .material
        ?.dispose
        ?.();

    }


    impacts =
      [];


    fireCooldown =
      0;

  }

  /*
 * =========================================================
 * NETWORK TRANSPORT / SESSION
 * =========================================================
 */

function createWebSocketTransport(
  url
) {

  let socket =
    null;


  const messageListeners =
    new Set();


  const statusListeners =
    new Set();


  function emitStatus(
    status
  ) {

    for (
      const listener
      of statusListeners
    ) {

      try {

        listener(
          status
        );

      } catch (
        error
      ) {

        console.error(
          "[LAGO TANKS NETWORK STATUS]",
          error
        );

      }

    }

  }


  function connect() {

    if (
      !url ||
      typeof url !==
      "string"
    ) {

      return Promise.reject(
        new Error(
          "WebSocket URL is required."
        )
      );

    }


    if (
      socket &&
      socket.readyState ===
      WebSocket.OPEN
    ) {

      return Promise.resolve(
        true
      );

    }


    if (
      socket &&
      socket.readyState ===
      WebSocket.CONNECTING
    ) {

      return new Promise(
        (
          resolve,
          reject
        ) => {

          socket.addEventListener(
            "open",
            () => resolve(
              true
            ),
            {
              once:
                true
            }
          );


          socket.addEventListener(
            "error",
            () => reject(
              new Error(
                "WebSocket connection failed."
              )
            ),
            {
              once:
                true
            }
          );

        }
      );

    }


    emitStatus(
      "connecting"
    );


    return new Promise(
      (
        resolve,
        reject
      ) => {

        let settled =
          false;


        socket =
          new WebSocket(
            url
          );


        socket.addEventListener(
          "open",
          () => {

            settled =
              true;


            emitStatus(
              "open"
            );


            resolve(
              true
            );

          }
        );


        socket.addEventListener(
          "message",
          event => {

            let payload =
              event.data;


            if (
              typeof payload ===
              "string"
            ) {

              try {

                payload =
                  JSON.parse(
                    payload
                  );

              } catch (_) {}

            }


            for (
              const listener
              of messageListeners
            ) {

              try {

                listener(
                  payload
                );

              } catch (
                error
              ) {

                console.error(
                  "[LAGO TANKS NETWORK MESSAGE]",
                  error
                );

              }

            }

          }
        );


        socket.addEventListener(
          "close",
          () => {

            emitStatus(
              "closed"
            );

          }
        );


        socket.addEventListener(
          "error",
          () => {

            emitStatus(
              "error"
            );


            if (
              !settled
            ) {

              settled =
                true;


              reject(
                new Error(
                  "WebSocket connection failed."
                )
              );

            }

          }
        );

      }
    );

  }


  function send(
    message
  ) {

    if (
      !socket ||
      socket.readyState !==
      WebSocket.OPEN
    ) {

      return false;

    }


    socket.send(

      typeof message ===
      "string"

        ? message
        : JSON.stringify(
            message
          )

    );


    return true;

  }


  function close() {

    if (!socket) {

      return;

    }


    try {

      socket.close();

    } catch (_) {}


    socket =
      null;

  }


  function subscribe(
    listener
  ) {

    messageListeners.add(
      listener
    );


    return () => {

      messageListeners.delete(
        listener
      );

    };

  }


  function subscribeStatus(
    listener
  ) {

    statusListeners.add(
      listener
    );


    return () => {

      statusListeners.delete(
        listener
      );

    };

  }


  return {

    connect,
    send,
    close,
    subscribe,
    subscribeStatus

  };

}


function detachNetworkTransport(
  closeTransport = false
) {

  networkSession
    .unsubscribeMessage
    ?.();


  networkSession
    .unsubscribeStatus
    ?.();


  networkSession.unsubscribeMessage =
    null;


  networkSession.unsubscribeStatus =
    null;


  if (
    closeTransport
  ) {

    networkSession.transport
      ?.close
      ?.();

  }


  networkSession.transport =
    null;

}


function handleNetworkTransportStatus(
  status
) {

  if (
    status ===
    "open"
  ) {

    if (
      networkSession.status ===
      "connecting" ||
      networkSession.status ===
      "reconnecting"
    ) {

      networkSession.status =
        "connected";

    }


    return;

  }


  if (
    (
      status ===
      "closed" ||
      status ===
      "error"
    ) &&
    networkSession.desiredOnline
  ) {

    scheduleNetworkReconnect();

  }

}


function attachNetworkTransport(
  transport
) {

  if (
    !transport ||
    typeof transport.send !==
    "function" ||
    typeof transport.subscribe !==
    "function"
  ) {

    return false;

  }


  detachNetworkTransport(
    true
  );


  networkSession.transport =
    transport;


  networkSession.unsubscribeMessage =
    transport.subscribe(
      receiveNetworkMessage
    );


  if (
    typeof transport.subscribeStatus ===
    "function"
  ) {

    networkSession.unsubscribeStatus =
      transport.subscribeStatus(
        handleNetworkTransportStatus
      );

  }


  return true;

}


function sendNetworkMessage(
  type,
  payload = {}
) {

  const transport =
    networkSession.transport;


  if (
    !transport ||
    typeof transport.send !==
    "function"
  ) {

    return false;

  }


  const sent =
    transport.send({

      schemaVersion:
        1,

      type,

      gameId:
        GAME_ID,

      roomId:
        networkSession.roomId,

      playerId:
        networkSession.playerId,

      ...payload

    });


  if (
    !sent &&
    networkSession.desiredOnline
  ) {

    scheduleNetworkReconnect();

  }


  return Boolean(
    sent
  );

}


function sendJoinRequest() {

  return sendNetworkMessage(
    "join",
    {

      mapId:
        "village-01",

      clientVersion:
        VERSION

    }
  );

}


function scheduleNetworkReconnect() {

  if (
    !networkSession.desiredOnline ||
    networkSession.reconnectInFlight
  ) {

    return;

  }


  if (
    networkSession.status ===
    "reconnecting" &&
    networkSession.reconnectDelay >
    0
  ) {

    return;

  }


  if (
    networkSession.reconnectAttempts >=
    NETWORK_RECONNECT_MAX_ATTEMPTS
  ) {

    networkSession.status =
      "failed";


    networkSession.lastError =
      "Reconnect limit reached.";


    return;

  }


  networkSession.reconnectAttempts +=
    1;


  networkSession.reconnectDelay =

    Math.min(

      8,

      0.75 *
      Math.pow(
        2,
        networkSession.reconnectAttempts -
        1
      )

    );


  networkSession.status =
    "reconnecting";

}


async function reconnectNetworkRoom() {

  if (
    !networkSession.desiredOnline ||
    !networkSession.transport ||
    networkSession.reconnectInFlight
  ) {

    return false;

  }


  networkSession.reconnectInFlight =
    true;


  networkSession.status =
    "connecting";


  try {

    await networkSession
      .transport
      .connect
      ?.();


    const sent =
      sendJoinRequest();


    if (!sent) {

      throw new Error(
        "Join request could not be sent."
      );

    }


    networkSession.status =
      "joining";


    networkSession.reconnectDelay =
      0;


    return true;

  } catch (
    error
  ) {

    networkSession.lastError =
      error
        ?.message ||
      String(
        error
      );


    return false;

  } finally {

    networkSession.reconnectInFlight =
      false;


    if (
      networkSession.status !==
      "joining" &&
      networkSession.desiredOnline
    ) {

      scheduleNetworkReconnect();

    }

  }

}


async function joinNetworkRoom({
  roomId,
  playerId,
  transport = null
} = {}) {

  if (
    transport &&
    !attachNetworkTransport(
      transport
    )
  ) {

    return false;

  }


  if (
    !networkSession.transport ||
    !roomId ||
    !playerId
  ) {

    return false;

  }


  networkSession.roomId =
    String(
      roomId
    );


  networkSession.playerId =
    String(
      playerId
    );


  networkSession.desiredOnline =
    true;


  networkSession.status =
    "connecting";


  networkSession.reconnectAttempts =
    0;


  networkSession.reconnectDelay =
    0;


  networkSession.inputAccumulator =
    0;


  networkSession.snapshotBuffer =
    [];


  networkSession.lastError =
    null;


  try {

    await networkSession
      .transport
      .connect
      ?.();


    if (
      !sendJoinRequest()
    ) {

      throw new Error(
        "Join request could not be sent."
      );

    }


    networkSession.status =
      "joining";


    return true;

  } catch (
    error
  ) {

    networkSession.lastError =
      error
        ?.message ||
      String(
        error
      );


    scheduleNetworkReconnect();


    return false;

  }

}


function leaveNetworkRoom({
  closeTransport = true
} = {}) {

  if (
    networkSession.transport &&
    networkSession.roomId
  ) {

    sendNetworkMessage(
      "leave"
    );

  }


  networkSession.desiredOnline =
    false;


  networkSession.status =
    "offline";


  networkSession.roomId =
    null;


  networkSession.playerId =
    null;


  networkSession.reconnectAttempts =
    0;


  networkSession.reconnectDelay =
    0;


  networkSession.reconnectInFlight =
    false;


  networkSession.inputAccumulator =
    0;


  networkSession.snapshotBuffer =
    [];


  setServerAuthority(
    false
  );


  if (
    closeTransport
  ) {

    detachNetworkTransport(
      true
    );

  }


  return true;

}


function queueNetworkSnapshot(
  snapshot
) {

  if (
    !snapshot ||
    typeof snapshot !==
    "object"
  ) {

    return false;

  }


  networkSession
    .snapshotBuffer
    .push({

      receivedAt:
        performance.now(),

      snapshot

    });


  if (
    networkSession
      .snapshotBuffer
      .length >
    NETWORK_SNAPSHOT_BUFFER_LIMIT
  ) {

    networkSession
      .snapshotBuffer
      .splice(

        0,

        networkSession
          .snapshotBuffer
          .length -
        NETWORK_SNAPSHOT_BUFFER_LIMIT

      );

  }


  return true;

}


function receiveNetworkMessage(
  message
) {

  let data =
    message;


  if (
    typeof data ===
    "string"
  ) {

    try {

      data =
        JSON.parse(
          data
        );

    } catch (_) {

      return false;

    }

  }


  if (
    !data ||
    typeof data !==
    "object"
  ) {

    return false;

  }


  if (
    data.gameId &&
    data.gameId !==
    GAME_ID
  ) {

    return false;

  }


  switch (
    data.type
  ) {

    case "joined":

      networkSession.status =
        "joined";


      networkSession.reconnectAttempts =
        0;


      networkSession.reconnectDelay =
        0;


      networkSession.lastError =
        null;


      setServerAuthority(
        true
      );


      if (
        data.snapshot
      ) {

        queueNetworkSnapshot(
          data.snapshot
        );

      }


      return true;


    case "snapshot":

      return queueNetworkSnapshot(

        data.snapshot ||
        data.payload

      );


    case "left":

      networkSession.status =
        "offline";


      networkSession.desiredOnline =
        false;


      setServerAuthority(
        false
      );


      return true;


    case "error":

      networkSession.lastError =

        data.message ||
        "Network error";


      return true;


    case "pong":

      return true;


    default:

      return false;

  }

}


function interpolateNetworkSnapshots() {

  const buffer =
    networkSession
      .snapshotBuffer;


  if (
    buffer.length ===
    0
  ) {

    return;

  }


  if (
    buffer.length ===
    1
  ) {

    applyAuthoritativeSnapshot(
      buffer[
        0
      ].snapshot
    );


    return;

  }


  const targetTime =

    performance.now() -
    NETWORK_INTERPOLATION_MS;


  while (
    buffer.length >=
    3 &&
    buffer[
      1
    ].receivedAt <=
    targetTime
  ) {

    buffer.shift();

  }


  const a =
    buffer[
      0
    ];


  const b =
    buffer[
      1
    ];


  if (!b) {

    applyAuthoritativeSnapshot(
      a.snapshot
    );


    return;

  }


  const span =

    Math.max(

      1,

      b.receivedAt -
      a.receivedAt

    );


  const alpha =
    THREE.MathUtils.clamp(

      (
        targetTime -
        a.receivedAt
      ) /
      span,

      0,
      1

    );


  const previousActors =
    new Map(

      (
        Array.isArray(
          a.snapshot
            ?.actors
        )

          ? a.snapshot.actors
          : []
      )
        .map(
          actor => [
            actor.id,
            actor
          ]
        )

    );


  const nextActors =

    (
      Array.isArray(
        b.snapshot
          ?.actors
      )

        ? b.snapshot.actors
        : []
    )
      .map(
        nextActor => {

          const previousActor =
            previousActors.get(
              nextActor.id
            );


          if (
            !previousActor ||
            !previousActor.position ||
            !nextActor.position ||
            !previousActor.rotation ||
            !nextActor.rotation
          ) {

            return nextActor;

          }


          return {

            ...nextActor,

            position: {

              x:
                THREE.MathUtils.lerp(
                  previousActor.position.x,
                  nextActor.position.x,
                  alpha
                ),

              y:
                THREE.MathUtils.lerp(
                  previousActor.position.y,
                  nextActor.position.y,
                  alpha
                ),

              z:
                THREE.MathUtils.lerp(
                  previousActor.position.z,
                  nextActor.position.z,
                  alpha
                )

            },

            rotation: {

              x:
                THREE.MathUtils.lerp(
                  previousActor.rotation.x,
                  nextActor.rotation.x,
                  alpha
                ),

              y:

                previousActor.rotation.y +
                normalizeAngle(

                  nextActor.rotation.y -
                  previousActor.rotation.y

                ) *
                alpha,

              z:
                THREE.MathUtils.lerp(
                  previousActor.rotation.z,
                  nextActor.rotation.z,
                  alpha
                )

            }

          };

        }
      );


  applyAuthoritativeSnapshot({

    ...b.snapshot,

    serverTime:

      Number.isFinite(
        a.snapshot
          ?.serverTime
      ) &&
      Number.isFinite(
        b.snapshot
          ?.serverTime
      )

        ? THREE.MathUtils.lerp(
            a.snapshot.serverTime,
            b.snapshot.serverTime,
            alpha
          )
        : b.snapshot
            ?.serverTime,

    actors:
      nextActors

  });

}


function updateNetwork(
  dt
) {

  if (
    networkSession.status ===
    "reconnecting"
  ) {

    networkSession.reconnectDelay =

      Math.max(

        0,

        networkSession.reconnectDelay -
        dt

      );


    if (
      networkSession.reconnectDelay <=
      0
    ) {

      void reconnectNetworkRoom();

    }

  }


  if (
    networkSession.status !==
    "joined"
  ) {

    return;

  }


  networkSession.inputAccumulator +=
    dt;


  if (
    networkSession.inputAccumulator >=
    NETWORK_INPUT_INTERVAL
  ) {

    networkSession.inputAccumulator %=
      NETWORK_INPUT_INTERVAL;


    sendNetworkMessage(
      "input",
      {

        input:
          getLocalInputSnapshot()

      }
    );

  }


  interpolateNetworkSnapshots();

}


function getNetworkSessionState() {

  return {

    status:
      networkSession.status,

    roomId:
      networkSession.roomId,

    playerId:
      networkSession.playerId,

    desiredOnline:
      networkSession.desiredOnline,

    reconnectAttempts:
      networkSession.reconnectAttempts,

    bufferedSnapshots:
      networkSession
        .snapshotBuffer
        .length,

    lastError:
      networkSession.lastError

  };

}

  /*
 * =========================================================
 * MATCH / NETWORK CONTRACT
 * =========================================================
 */

function getMatchState() {

  return {

    status:
      matchState.status,

    timeRemaining:
      matchState.timeRemaining,

    winner:
      matchState.winner,

    score: {

      blue:
        teamScores.blue,

      red:
        teamScores.red

    },

    scoreLimit:
      MATCH_SCORE_LIMIT,

    durationSeconds:
      MATCH_DURATION_SECONDS

  };

}


function getNetworkSnapshot() {

  return {

    schemaVersion:
      1,

    gameId:
      GAME_ID,

    mapId:
      "village-01",

    serverTime:
      combatTime,

    match:
      getMatchState(),

    actors:

      Array.from(
        actors.values()
      )
        .map(
          actor => ({

            id:
              actor.id,

            team:
              actor.team,

            spawnIndex:
              actor.spawnIndex,

            hp:
              actor.hp,

            maxHp:
              actor.maxHp,

            alive:
              actor.alive,

            kills:
              actor.kills,

            deaths:
              actor.deaths,

            protectedUntil:
              actor.protectedUntil,

            respawnAt:
              actor.respawnAt,

            position: {

              x:
                actor.object3D
                  ?.position.x ??
                0,

              y:
                actor.object3D
                  ?.position.y ??
                0,

              z:
                actor.object3D
                  ?.position.z ??
                0

            },

            rotation: {

              x:
                actor.object3D
                  ?.rotation.x ??
                0,

              y:
                actor.object3D
                  ?.rotation.y ??
                0,

              z:
                actor.object3D
                  ?.rotation.z ??
                0

            }

          })
        )

  };

}


function setServerAuthority(
  enabled
) {

  serverAuthorityEnabled =
    Boolean(
      enabled
    );


  if (
    serverAuthorityEnabled
  ) {

    clearCombatFX();

  }


  return serverAuthorityEnabled;

}


function applyAuthoritativeSnapshot(
  snapshot
) {

  if (
    !snapshot ||
    typeof snapshot !==
    "object"
  ) {

    return false;

  }


  if (
    Number.isFinite(
      snapshot.serverTime
    )
  ) {

    combatTime =
      snapshot.serverTime;

  }


  const remoteMatch =
    snapshot.match;


  if (
    remoteMatch &&
    typeof remoteMatch ===
    "object"
  ) {

    if (
      typeof remoteMatch.status ===
      "string"
    ) {

      matchState.status =
        remoteMatch.status;

    }


    if (
      Number.isFinite(
        remoteMatch.timeRemaining
      )
    ) {

      matchState.timeRemaining =
        Math.max(
          0,
          remoteMatch.timeRemaining
        );

    }


    matchState.winner =

      remoteMatch.winner ??
      null;


    const remoteScore =
      remoteMatch.score;


    if (
      remoteScore &&
      typeof remoteScore ===
      "object"
    ) {

      if (
        Number.isFinite(
          remoteScore.blue
        )
      ) {

        teamScores.blue =
          remoteScore.blue;

      }


      if (
        Number.isFinite(
          remoteScore.red
        )
      ) {

        teamScores.red =
          remoteScore.red;

      }

    }

  }


  if (
    Array.isArray(
      snapshot.actors
    )
  ) {

    for (
      const remote
      of snapshot.actors
    ) {

      const actor =
        actors.get(
          remote
            ?.id
        );


      if (
        !actor ||
        !actor.object3D
      ) {

        continue;

      }


      if (
        Number.isFinite(
          remote.hp
        )
      ) {

        actor.hp =
          THREE.MathUtils.clamp(
            remote.hp,
            0,
            actor.maxHp
          );

      }


      if (
        typeof remote.alive ===
        "boolean"
      ) {

        actor.alive =
          remote.alive;


        actor.object3D.visible =
          remote.alive;

      }


      if (
        Number.isFinite(
          remote.kills
        )
      ) {

        actor.kills =
          remote.kills;

      }


      if (
        Number.isFinite(
          remote.deaths
        )
      ) {

        actor.deaths =
          remote.deaths;

      }


      if (
        Number.isFinite(
          remote.protectedUntil
        )
      ) {

        actor.protectedUntil =
          remote.protectedUntil;

      }


      if (
        Number.isFinite(
          remote.respawnAt
        )
      ) {

        actor.respawnAt =
          remote.respawnAt;

      }


      const position =
        remote.position;


      if (
        position &&
        Number.isFinite(
          position.x
        ) &&
        Number.isFinite(
          position.y
        ) &&
        Number.isFinite(
          position.z
        )
      ) {

        actor.object3D.position.set(
          position.x,
          position.y,
          position.z
        );

      }


      const rotation =
        remote.rotation;


      if (
        rotation &&
        Number.isFinite(
          rotation.x
        ) &&
        Number.isFinite(
          rotation.y
        ) &&
        Number.isFinite(
          rotation.z
        )
      ) {

        actor.object3D.rotation.set(
          rotation.x,
          rotation.y,
          rotation.z
        );

      }

    }

  }


  lastServerSnapshotAt =
    performance.now();


  return true;

}


function restartMatch() {

  if (
    phase !==
    "running" ||
    serverAuthorityEnabled
  ) {

    return false;

  }


  clearCombatFX();


  combatTime =
    0;


  localInputSequence =
    0;


  localFireSequence =
    0;


  resetCombatRoster();


  resetMatchState();


  restoreStartPanel();


  const panel =
    el(
      "ltPanel"
    );


  if (panel) {

    panel.hidden =
      true;

  }


  return true;

}

  /*
   * =========================================================
   * CAMERA
   * =========================================================
   */

  function setOverviewCamera() {

  if (
    !camera
  ) {

    return;

  }


  camera.position.set(
    0,
    67,
    52
  );


  camera.lookAt(
    0,
    0,
    0
  );

}


function updateCamera(
  immediate = false
) {

  if (
    !player ||
    !camera
  ) {

    return;

  }


  const compact =

    window.innerWidth <
    760;


  /*
   * High tactical camera.
   * Камера значительно выше и
   * почти сверху, как в референсе.
   */

  const desired =
    new THREE.Vector3(

      player.position.x,

      player.position.y +

      (
        compact
          ? 31
          : 27
      ),

      player.position.z +

      (
        compact
          ? 10
          : 8.5
      )

    );


  if (
    immediate
  ) {

    camera.position
      .copy(
        desired
      );

  } else {

    camera.position
      .lerp(
        desired,
        0.12
      );

  }


  camera.lookAt(

    player.position.x,

    player.position.y,

    player.position.z -
    1.5

  );

}


  /*
   * =========================================================
   * GAME LOOP
   * =========================================================
   */

  function loop() {

    if (
      phase !==
      "running"
    ) {

      return;

    }


    const dt =

      Math.min(

        0.04,

        clock.getDelta()

      );

fireCooldown =

  Math.max(

    0,

    fireCooldown -
    dt

  );
if (
  !serverAuthorityEnabled
) {

  combatTime +=
    dt;

}


updateNetwork(
  dt
);


if (
  !serverAuthorityEnabled
) {

  updateMatch(
    dt
  );


  updateCombatActors();


  updateBotTargets();


  updateBotMovement(
    dt
  );


  updateBotCombat();

}


updateCombatStatus();


updatePlayer(
  dt
);

    updateAim();


    updateBullets(
      dt
    );


    updateImpacts(
      dt
    );


    updateCamera();


    renderer.render(
      scene,
      camera
    );


    animationFrame =

      requestAnimationFrame(
        loop
      );

  }


  /*
   * =========================================================
   * START
   * =========================================================
   */

  async function startGame() {

    if (
      phase ===
      "running" ||

      phase ===
      "loading"
    ) {

      return;

    }


    phase =
      "loading";

clearCombatFX();


combatTime =
  0;

    localInputSequence =
  0;


localFireSequence =
  0;


lastServerSnapshotAt =
  0;

    el(
      "ltPanelCopy"
    ).textContent =

      "Loading Team Blue tank GLB…";


    try {
      
await Promise.all([

  mountPlayerTank(),

  mountBotTanks()

]);


resetCombatRoster();

resetMatchState();


/*
 * Ставим игровую камеру сразу.
 * Не показываем ни одного кадра
 * из дефолтной позиции Three.js.
 */
updateCamera(
  true
);


renderer.render(
  scene,
  camera
);


el(
  "ltPanel"
).hidden =
  true;


      el(
        "ltStatus"
      ).textContent =

        window.innerWidth <
        760

          ? "LEFT TOUCH DRIVE · RIGHT TOUCH AIM · FIRE"

          : "WASD DRIVE · MOUSE AIM · CLICK / SPACE FIRE";


      phase =
        "running";


      clock.start();


      animationFrame =

        requestAnimationFrame(
          loop
        );

    } catch (
      error
    ) {

      console.error(
        "[LAGO TANKS]",
        error
      );


      phase =
        "idle";


      el(
        "ltPanelCopy"
      ).textContent =

        "Tank GLB could not load. Check assets/model/tanks/team-blue.glb.";

    }

  }


  /*
   * =========================================================
   * OPEN / CLOSE
   * =========================================================
   */

  function show(
    detail = {}
  ) {

    createUI();


    createRenderer();

    tankVoicePanel?.destroy();

tankVoicePanel = window.LAGO_GAME_VOICE?.createPanel({
  gameId: GAME_ID,
  mount: el("ltStage")
}) || null;


    context =

      detail.context ||

      runtime()
        ?.getContext
        ?.() ||

      null;


    overlay
      .classList
      .add(
        "active"
      );


    document.body
      .style
      .overflow =

      "hidden";


    phase =
      "idle";


    el(
      "ltPanel"
    ).hidden =
      false;

restoreStartPanel();


resize();


setOverviewCamera();


renderer.render(
  scene,
  camera
);

  }

function hide() {

  tankVoicePanel?.destroy();

  tankVoicePanel =
    null;


  if (
    networkSession.desiredOnline
  ) {

    leaveNetworkRoom();

  }


  if (
    animationFrame
  ) {

      cancelAnimationFrame(
        animationFrame
      );


      animationFrame =
        0;

    }


    phase =
      "idle";


    drivePointerId =
      null;


    aimPointerId =
      null;


    touchForward =
      0;


    touchTurn =
      0;


    hasAim =
      false;


    keys.clear();


    Object.keys(
      mobile
    )
      .forEach(
        key => {

          mobile[
            key
          ] =
            false;

        }
      );


    overlay
      ?.classList
      .remove(
        "active"
      );


    document.body
      .style
      .overflow =

      "";

  }


  /*
   * =========================================================
   * GAME EVENT
   * =========================================================
   */

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


  /*
   * =========================================================
   * PUBLIC API
   * =========================================================
   */

  window.LAGO_TANKS =
    Object.freeze({
version:
  VERSION,

show,

hide,

createWebSocketTransport,

attachNetworkTransport,

detachNetworkTransport,

joinNetworkRoom,

leaveNetworkRoom,

reconnectNetworkRoom,

receiveNetworkMessage,

getNetworkSessionState,

restartMatch,

getMatchState,

getNetworkSnapshot,

getLocalInputSnapshot,

setServerAuthority,

applyAuthoritativeSnapshot,


getNetworkStatus() {

  return {

    serverAuthority:
      serverAuthorityEnabled,

    lastServerSnapshotAt,

    session:
      getNetworkSessionState()

  };

},

/*
 * Multiplayer server will use
 * exactly this map layout later.
 */

getMultiplayerLayout() {

        return {

          mapId:
            "village-01",

          maxPlayers:
  8,

          match: {

  durationSeconds:
    MATCH_DURATION_SECONDS,

  scoreLimit:
    MATCH_SCORE_LIMIT

},

lanes:

  MAP_LANES
    .map(
      item => ({
        ...item
      })
    ),


spawnProtectionSeconds:
  SPAWN_PROTECTION_SECONDS,


bases: {

  blue: {
    ...TEAM_BASES.blue
  },

  red: {
    ...TEAM_BASES.red
  }

},


          teams: {

            blue:

              BLUE_SPAWNS
                .map(
                  item => ({
                    ...item
                  })
                ),


            red:

              RED_SPAWNS
                .map(
                  item => ({
                    ...item
                  })
                )

          },


          tankModels: {

            blue:
              TEAM_BLUE_MODEL,

            red:
              TEAM_RED_MODEL

          }

        };

      }

    });

})();

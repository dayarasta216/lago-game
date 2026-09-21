import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { rigTankModel } from "./lago-tank-rig.js?v=2";

(() => {
  "use strict";

  const VERSION = 20;
  const GAME_ID = "lago-tanks";

  const TEAM_BLUE_MODEL =
  "./assets/model/game/tanks/team-blue.glb?v=1";

const TEAM_RED_MODEL =
  "./assets/model/game/tanks/team-red.glb?v=1";

 const MAP_WIDTH = 104;
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
      x: -42,
      z: -12,
      yaw: -Math.PI / 2
    }),

    Object.freeze({
      x: -42,
      z: -4,
      yaw: -Math.PI / 2
    }),

    Object.freeze({
      x: -42,
      z: 4,
      yaw: -Math.PI / 2
    }),

    Object.freeze({
      x: -42,
      z: 12,
      yaw: -Math.PI / 2
    })

  ]);


 const RED_SPAWNS =
  Object.freeze([

    Object.freeze({
      x: 42,
      z: -12,
      yaw: Math.PI / 2
    }),

    Object.freeze({
      x: 42,
      z: -4,
      yaw: Math.PI / 2
    }),

    Object.freeze({
      x: 42,
      z: 4,
      yaw: Math.PI / 2
    }),

    Object.freeze({
      x: 42,
      z: 12,
      yaw: Math.PI / 2
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
      id: "north",
      z: -22
    }),

    Object.freeze({
      id: "center",
      z: 0
    }),

    Object.freeze({
      id: "south",
      z: 22
    })

  ]);


const SPAWN_PROTECTION_SECONDS =
  3.0;


const TEAM_BASES =
  Object.freeze({

    blue:
      Object.freeze({
        x: -42,
        z: 0,
        radius: 14
      }),

    red:
      Object.freeze({
        x: 42,
        z: 0,
        radius: 14
      })

  });
  
  /*
   * =========================================================
   * MAP TERRAIN
   * =========================================================
   */

  const HILLS =
    Object.freeze([

      Object.freeze({
        x: -18,
        z: -16,
        radius: 8.0,
        height: 2.5
      }),

      Object.freeze({
        x: -9,
        z: 15,
        radius: 7.0,
        height: 1.8
      }),

      Object.freeze({
        x: 15,
        z: -15,
        radius: 8.5,
        height: 2.3
      }),

      Object.freeze({
        x: 22,
        z: 13,
        radius: 7.0,
        height: 1.9
      }),

      Object.freeze({
        x: 1,
        z: 20,
        radius: 6.5,
        height: 1.3
      })

    ]);


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


  let fireCooldown = 0;

  let bullets = [];
  let impacts = [];
  let solidRects = [];


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
        startGame
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
        0x9cb6c3
      );


   scene.fog =
  new THREE.Fog(
    0x9cb6c3,
    58,
    138
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
          0x66785a,
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
            0x746b5b,

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
            0x565852,

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
          0xc5b98e,

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
     * Main crossing roads.
     */

    addRoad(
  0,
  0,
  96,
  7.0
);


addRoad(
  0,
  0,
  7.0,
  70
);

  /*
 * Three combat lanes.
 */

addRoad(
  0,
  -22,
  88,
  5.5
);


addRoad(
  0,
  22,
  88,
  5.5
);


/*
 * Rotation routes between lanes.
 */

addRoad(
  -28,
  0,
  5.0,
  48
);


addRoad(
  28,
  0,
  5.0,
  48
);

    /*
     * Team bases.
     */

    for (
      const spawn
      of BLUE_SPAWNS
    ) {

      addSpawnPad(
        spawn,
        0x4f88ff
      );

    }


    for (
      const spawn
      of RED_SPAWNS
    ) {

      addSpawnPad(
        spawn,
        0xff5d58
      );

    }


    /*
     * Blue-side village.
     */

    addBuilding(
      -18,
      -8,
      5.0,
      4.2,
      3.4,
      0xa28e72
    );


    addBuilding(
      -17,
      7,
      4.6,
      4.6,
      3.1,
      0x9b8266
    );


    addBuilding(
      -8,
      -13,
      4.4,
      5.2,
      3.2,
      0x8f7c66
    );


    addBuilding(
      -7,
      11,
      4.6,
      4.2,
      3.0,
      0x9f8a72
    );


    /*
     * Red-side village.
     */

    addBuilding(
      18,
      -8,
      5.0,
      4.2,
      3.4,
      0xa28e72
    );


    addBuilding(
      17,
      7,
      4.6,
      4.6,
      3.1,
      0x9b8266
    );


    addBuilding(
      8,
      -13,
      4.4,
      5.2,
      3.2,
      0x8f7c66
    );


    addBuilding(
      7,
      11,
      4.6,
      4.2,
      3.0,
      0x9f8a72
    );


    /*
     * Central warehouses.
     */

    addWarehouse(
      -1,
      -15,
      8.5,
      4.8,
      3.2
    );


    addWarehouse(
      1,
      15,
      8.5,
      4.8,
      3.2
    );


    /*
     * Defensive walls.
     */

    addWall(
      -12,
      0,
      6.0,
      0.65,
      0
    );


    addWall(
      12,
      0,
      6.0,
      0.65,
      0
    );


    addWall(
      0,
      -8,
      5.5,
      0.65,
      Math.PI /
      2
    );


    addWall(
      0,
      8,
      5.5,
      0.65,
      Math.PI /
      2
    );


    /*
     * Crates / cover.
     */

    for (
      const [
        x,
        z
      ]

      of [

        [-23, -17],
        [-23, 17],

        [23, -17],
        [23, 17],

        [-3, -4],
        [3, 4],

        [-4, 4],
        [4, -4]

      ]
    ) {

      const crate =
        box(
          1.9,
          1.5,
          1.9,
          0x7d684a
        );


      crate.position.set(

        x,

        terrainHeight(
          x,
          z
        ) +
        0.75,

        z

      );


      scene.add(
        crate
      );


      addSolidRect(
        x,
        z,
        1.25,
        1.25
      );

    }

/*
 * 4v4 route cover.
 *
 * Mirrored around X=0 so both teams
 * have equivalent battlefield cover.
 */


/*
 * Spawn approach shields.
 */

addWall(
  -35,
  -12,
  5.0,
  0.72,
  Math.PI /
  2
);


addWall(
  -35,
  12,
  5.0,
  0.72,
  Math.PI /
  2
);


addWall(
  35,
  -12,
  5.0,
  0.72,
  Math.PI /
  2
);


addWall(
  35,
  12,
  5.0,
  0.72,
  Math.PI /
  2
);


/*
 * North lane cover.
 */

addWall(
  -15,
  -22,
  4.6,
  0.70,
  0
);


addWall(
  15,
  -22,
  4.6,
  0.70,
  0
);


addRock(
  -5.5,
  -25,
  0.72,
  0.3
);


addRock(
  5.5,
  -25,
  0.72,
  -0.3
);


/*
 * South lane cover.
 */

addWall(
  -15,
  22,
  4.6,
  0.70,
  0
);


addWall(
  15,
  22,
  4.6,
  0.70,
  0
);


addRock(
  -5.5,
  25,
  0.72,
  -0.3
);


addRock(
  5.5,
  25,
  0.72,
  0.3
);


/*
 * Rotation-route cover.
 */

addWall(
  -28,
  -5,
  4.0,
  0.68,
  Math.PI /
  2
);


addWall(
  -28,
  5,
  4.0,
  0.68,
  Math.PI /
  2
);


addWall(
  28,
  -5,
  4.0,
  0.68,
  Math.PI /
  2
);


addWall(
  28,
  5,
  4.0,
  0.68,
  Math.PI /
  2
);
    
/*
 * Dirt and worn-ground patches.
 * Decorative only: no collision.
 */

addGroundPatch(
  -21,
  -8,
  7.8,
  4.3,
  0.18
);


addGroundPatch(
  -18,
  9,
  6.2,
  3.8,
  -0.22
);


addGroundPatch(
  21,
  -8,
  7.8,
  4.3,
  -0.18
);


addGroundPatch(
  18,
  9,
  6.2,
  3.8,
  0.22
);


addGroundPatch(
  -31,
  -22,
  5.0,
  3.1,
  0.48,
  0x776b57
);


addGroundPatch(
  31,
  -22,
  5.0,
  3.1,
  -0.48,
  0x776b57
);


addGroundPatch(
  -27,
  24,
  4.6,
  2.8,
  -0.35,
  0x82735c
);


addGroundPatch(
  27,
  24,
  4.6,
  2.8,
  0.35,
  0x82735c
);
    
    /*
 * Low-poly environment pass.
 * Symmetrical 4v4 decoration.
 */

for (
  const [
    x,
    z,
    scale
  ]

  of [

    [-35, -27, 1.05],
    [-30, 27, 0.95],
    [-24, 31, 1.10],
    [-34, 22, 0.90],

    [35, -27, 1.05],
    [30, 27, 0.95],
    [24, 31, 1.10],
    [34, 22, 0.90],

    [-12, -30, 0.88],
    [12, -30, 0.88],
    [-12, 30, 0.88],
    [12, 30, 0.88]

  ]
) {

  addTree(
    x,
    z,
    scale
  );

}


for (
  const [
    x,
    z,
    scale,
    rotation
  ]

  of [

    [-31, -19, 1.0, 0.25],
    [-28, 17, 0.8, -0.35],
    [-20, -26, 0.9, 0.6],

    [31, -19, 1.0, -0.25],
    [28, 17, 0.8, 0.35],
    [20, -26, 0.9, -0.6],

    [-7, 24, 0.72, 0.2],
    [7, 24, 0.72, -0.2]

  ]
) {

  addRock(
    x,
    z,
    scale,
    rotation
  );

}


for (
  const [
    x,
    z,
    scale
  ]

  of [

    [-37, -18, 0.9],
    [-33, 16, 0.8],
    [-26, -23, 0.75],
    [-20, 25, 0.85],

    [37, -18, 0.9],
    [33, 16, 0.8],
    [26, -23, 0.75],
    [20, 25, 0.85],

    [-10, 20, 0.72],
    [10, 20, 0.72]

  ]
) {

  addBush(
    x,
    z,
    scale
  );

}


addFence(
  -31,
  -8,
  8,
  0
);


addFence(
  -31,
  8,
  8,
  0
);


addFence(
  31,
  -8,
  8,
  0
);


addFence(
  31,
  8,
  8,
  0
);

    /*
     * Outer map walls.
     */

    const boundaryMaterial =
      material(
        0x6d746d,
        0.95,
        0
      );


    const boundaries = [

      [
        0,
        0.75,
        -MAP_DEPTH / 2,
        MAP_WIDTH,
        1.5,
        0.65
      ],

      [
        0,
        0.75,
        MAP_DEPTH / 2,
        MAP_WIDTH,
        1.5,
        0.65
      ],

      [
        -MAP_WIDTH / 2,
        0.75,
        0,
        0.65,
        1.5,
        MAP_DEPTH
      ],

      [
        MAP_WIDTH / 2,
        0.75,
        0,
        0.65,
        1.5,
        MAP_DEPTH
      ]

    ];


    for (
      const values
      of boundaries
    ) {

      const wall =
        new THREE.Mesh(

          new THREE
            .BoxGeometry(

              values[3],
              values[4],
              values[5]

            ),

          boundaryMaterial

        );


      wall.position.set(

        values[0],
        values[1],
        values[2]

      );


      wall.castShadow =
        true;


      wall.receiveShadow =
        true;


      scene.add(
        wall
      );

    }

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


    resetPlayerToSpawn();

  }


  function resetPlayerToSpawn() {

    const spawn =
      BLUE_SPAWNS[
        1
      ];


    player.position.set(

      spawn.x,

      terrainHeight(
        spawn.x,
        spawn.z
      ),

      spawn.z

    );


    player.rotation.set(
      0,
      spawn.yaw,
      0
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
    "Tank rig is incomplete."
  );

}


playerVisual.add(
  model
);

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

        ? 58
        : 48;


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

  /*
   * =========================================================
   * PLAYER MOVEMENT
   * =========================================================
   */

  function updatePlayer(
    dt
  ) {

    if (!player) {

      return;

    }


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


    const forward =

      Math.abs(
        touchForward
      ) >
      0.001

        ? touchForward
        : digitalForward;


    const turn =

      Math.abs(
        touchTurn
      ) >
      0.001

        ? touchTurn
        : digitalTurn;


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

      THREE.MathUtils
        .clamp(

          slope.z *
          0.65,

          -0.24,
          0.24

        );


    player.rotation.z =

      THREE.MathUtils
        .clamp(

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

 function fire() {

  if (
    phase !==
    "running" ||

    !player ||

    !playerMuzzle ||

    fireCooldown >
    0
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

    age:
      0

  });

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


      bullet.mesh
        .position
        .addScaledVector(

          bullet.direction,

          BULLET_SPEED *
          dt

        );


      if (
        bulletHitsSolid(
          bullet.mesh.position
        )
      ) {

        createImpact(
          bullet.mesh.position
        );


        removeBullet(
          index
        );


        continue;

      }


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
   * CAMERA
   * =========================================================
   */

  function updateCamera() {

    if (
      !player ||
      !camera
    ) {

      return;

    }


    const compact =

      window.innerWidth <
      760;


    const desired =
      new THREE.Vector3(

        player.position.x,

        player.position.y +

        (
          compact
            ? 17.5
            : 15.5
        ),

        player.position.z +

        (
          compact
            ? 14.0
            : 12.5
        )

      );


   const cameraDistance =
  camera.position
    .distanceTo(
      desired
    );


if (
  cameraDistance >
  22
) {

  camera.position
    .copy(
      desired
    );

} else {

  camera.position
    .lerp(
      desired,
      0.075
    );

}


    camera.lookAt(

      player.position.x,

      player.position.y +
      0.2,

      player.position.z

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


    resetPlayerToSpawn();


    el(
      "ltPanelCopy"
    ).textContent =

      "Loading Team Blue tank GLB…";


    try {

      await mountPlayerTank();


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


    el(
      "ltPanelCopy"
    ).textContent =

      "Map 01 is sized for 8 players: 4 Blue vs 4 Red. This checkpoint tests the new GLB tank and battlefield; networking comes after the map is stable.";


    resize();


    renderer.render(
      scene,
      camera
    );

  }


  function hide() {

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

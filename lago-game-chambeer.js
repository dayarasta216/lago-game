import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

(() => {
  "use strict";

  const VERSION = 1;
  const GAME_ID = "chambeer";

  const MODEL_URL =
    "./assets/model/game/chambeer/chambeer.glb?v=1";

  /*
   * Если после первого запуска медведь
   * смотрит не вправо, поправим только
   * эту константу.
   */
  const BEAR_YAW =
    Math.PI / 2;

  const START_X = 4;
  const MAX_HP = 100;

  const LOCATIONS =
    Object.freeze({

      street: {
        name: "CITY STREET",
        sky: 0xa9c9d8,
        ground: 0x656b72
      },

      building: {
        name: "APARTMENT BUILDING",
        sky: 0xd8cdbb,
        ground: 0x887967
      },

      forest: {
        name: "HUNTER FOREST",
        sky: 0x7e9b72,
        ground: 0x5f5037
      }

    });


  let overlay;
  let stage;
  let canvas;

  let renderer;
  let scene;
  let camera;

  let bearRoot;
  let bearVisual;
  let bearModelMount;

  let ground;
  let backdrop;
  let entitiesRoot;

  let voicePanel =
    null;

  let controlsAbort =
    null;

  let frame =
    0;

  let active =
    false;

  let lastTime =
    0;

  let oldOverflow =
    "";

  let modelPromise =
    null;

  let modelReady =
    false;


  const keys =
    new Set();


  const touch = {

    faster:
      false,

    slower:
      false

  };


  const entities =
    [];


  const state = {

    phase:
      "lobby",

    location:
      "street",

    x:
      START_X,

    y:
      0,

    vy:
      0,

    speed:
      8,

    grounded:
      true,

    hp:
      MAX_HP,

    score:
      0,

    eaten:
      0,

    distance:
      0,

    chomp:
      0,

    invulnerable:
      0,

    nextSpawnX:
      18

  };


  const $ =
    selector =>
      overlay
        ?.querySelector(
          selector
        ) ||
      null;


  function clamp(
    value,
    min,
    max
  ) {

    return Math.max(
      min,
      Math.min(
        max,
        value
      )
    );

  }


  /*
   * =====================================================
   * UI
   * =====================================================
   */

  function makeUI() {

    if (overlay) {
      return;
    }


    const style =
      document.createElement(
        "style"
      );


    style.textContent = `

      #lagoChamBeer {

        position:
          fixed;

        inset:
          0;

        z-index:
          23000;

        display:
          none;

        flex-direction:
          column;

        gap:
          8px;

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
          #090d12;

        color:
          #fff;

        font:
          700 13px
          system-ui,
          sans-serif;

      }


      #lagoChamBeer.active {

        display:
          flex;

      }


      .cb-head,
      .cb-tools,
      .cb-controls,
      .cb-group,
      .cb-locations {

        display:
          flex;

        align-items:
          center;

        flex-wrap:
          wrap;

        gap:
          7px;

      }


      .cb-head,
      .cb-controls {

        justify-content:
          space-between;

      }


      .cb-title {

        margin:
          0;

        font-size:
          clamp(
            26px,
            5vw,
            42px
          );

        font-weight:
          1000;

        letter-spacing:
          -.055em;

      }


      .cb-sub {

        color:
          rgba(
            255,
            255,
            255,
            .48
          );

        font-size:
          9px;

        font-weight:
          900;

      }


      .cb-tools {

        justify-content:
          flex-end;

      }


      #cbVoice {

        position:
          relative;

      }


      .cb-stage {

        position:
          relative;

        flex:
          1;

        min-height:
          0;

        overflow:
          hidden;

        border:
          1px solid
          rgba(
            255,
            255,
            255,
            .12
          );

        border-radius:
          16px;

        background:
          #768e6d;

      }


      #cbCanvas {

        display:
          block;

        width:
          100%;

        height:
          100%;

        touch-action:
          none;

      }


      .cb-hud {

        position:
          absolute;

        top:
          9px;

        left:
          9px;

        z-index:
          8;

        min-width:
          210px;

        padding:
          8px 10px;

        border-radius:
          10px;

        background:
          rgba(
            7,
            13,
            18,
            .86
          );

        pointer-events:
          none;

      }


      .cb-hp {

        width:
          185px;

        height:
          9px;

        margin-top:
          5px;

        overflow:
          hidden;

        border-radius:
          99px;

        background:
          rgba(
            255,
            255,
            255,
            .15
          );

      }


      #cbHpFill {

        width:
          100%;

        height:
          100%;

        background:
          #d6ef49;

        transform-origin:
          left center;

      }


      .cb-lobby {

        position:
          absolute;

        inset:
          0;

        z-index:
          15;

        display:
          grid;

        place-items:
          center;

        padding:
          16px;

        background:
          rgba(
            5,
            10,
            14,
            .65
          );

        backdrop-filter:
          blur(
            8px
          );

      }


      .cb-lobby[hidden],
      .cb-controls[hidden] {

        display:
          none !important;

      }


      .cb-card {

        width:
          min(
            620px,
            100%
          );

        padding:
          18px;

        border:
          1px solid
          rgba(
            255,
            255,
            255,
            .13
          );

        border-radius:
          17px;

        background:
          rgba(
            17,
            27,
            36,
            .93
          );

      }


      .cb-card h3 {

        margin:
          0 0 5px;

        font-size:
          23px;

      }


      .cb-copy {

        margin:
          0 0 14px;

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
          1.45;

      }


      .cb-button,
      .cb-location {

        min-height:
          43px;

        padding:
          9px 13px;

        border:
          1px solid
          rgba(
            255,
            255,
            255,
            .2
          );

        border-radius:
          10px;

        background:
          #2b4050;

        color:
          #fff;

        font:
          900 11px
          system-ui;

        cursor:
          pointer;

        touch-action:
          none;

        user-select:
          none;

      }


      .cb-location.selected {

        border-color:
          #d6ef49;

        background:
          #425329;

      }


      .cb-primary {

        width:
          100%;

        margin-top:
          12px;

        background:
          #d6ef49;

        color:
          #17200f;

      }


      .cb-danger {

        background:
          #d65442;

      }


      .cb-button:disabled {

        opacity:
          .45;

      }


      .cb-help {

        text-align:
          center;

        color:
          rgba(
            255,
            255,
            255,
            .52
          );

        font-size:
          10px;

      }


      @media (
        max-width:
        620px
      ) {

        .cb-button,
        .cb-location {

          min-width:
            48px;

          padding:
            9px;

          font-size:
            10px;

        }


        .cb-help {

          display:
            none;

        }


        .cb-hud {

          min-width:
            170px;

        }


        .cb-hp {

          width:
            145px;

        }


        #cbVoice
        .lago-voice-panel {

          max-width:
            205px;

        }

      }

    `;


    document.head
      .appendChild(
        style
      );


    overlay =
      document.createElement(
        "section"
      );


    overlay.id =
      "lagoChamBeer";


    overlay.innerHTML = `

      <header class="cb-head">

        <div>

          <h2 class="cb-title">
            ChamBeer
          </h2>

          <div class="cb-sub">
            EAT EVERYTHING ·
            SURVIVE AS LONG AS POSSIBLE
          </div>

        </div>


        <div class="cb-tools">

          <div id="cbVoice"></div>

          <button
            class="cb-button"
            id="cbClose"
            type="button"
          >
            ЗАКРЫТЬ ×
          </button>

        </div>

      </header>


      <div
        class="cb-stage"
        id="cbStage"
      >

        <canvas
          id="cbCanvas"
        ></canvas>


        <div class="cb-hud">

          <div id="cbHudText">
            LOBBY
          </div>

          <div class="cb-hp">

            <div id="cbHpFill"></div>

          </div>

        </div>


        <section
          class="cb-lobby"
          id="cbLobby"
        >

          <div class="cb-card">

            <h3 id="cbLobbyTitle">
              CHOOSE LOCATION
            </h3>

            <p
              class="cb-copy"
              id="cbLobbyCopy"
            >
              Жри людей, животных и предметы.
              Еда держит HP.
              Охотники, пули и ловушки отнимают жизнь.
            </p>


            <div
              class="cb-locations"
              id="cbLocations"
            ></div>


            <button
              class="cb-button cb-primary"
              id="cbStart"
              type="button"
              disabled
            >
              ЗАГРУЗКА МЕДВЕДЯ…
            </button>

          </div>

        </section>

      </div>


      <div
        class="cb-controls"
        id="cbControls"
        hidden
      >

        <div class="cb-group">

          <button
            class="cb-button"
            data-hold="slower"
            type="button"
          >
            ◀ МЕДЛЕННЕЕ
          </button>

          <button
            class="cb-button"
            id="cbJump"
            type="button"
          >
            ПРЫЖОК
          </button>

        </div>


        <div class="cb-group">

          <button
            class="cb-button cb-danger"
            id="cbChomp"
            type="button"
          >
            ЖРАТЬ
          </button>

          <button
            class="cb-button"
            data-hold="faster"
            type="button"
          >
            БЫСТРЕЕ ▶
          </button>

          <button
            class="cb-button"
            id="cbBack"
            type="button"
          >
            ЛОКАЦИИ
          </button>

        </div>

      </div>


      <div class="cb-help">

        D / → — быстрее ·
        A / ← — медленнее ·
        W / Space — прыжок ·
        E / Shift — жрать

      </div>

    `;


    document.body
      .appendChild(
        overlay
      );


    stage =
      $(
        "#cbStage"
      );


    canvas =
      $(
        "#cbCanvas"
      );


    for (
      const [
        id,
        location
      ]
      of Object.entries(
        LOCATIONS
      )
    ) {

      const button =
        document.createElement(
          "button"
        );


      button.type =
        "button";


      button.className =
        "cb-location";


      button.textContent =
        location.name;


      button.dataset.location =
        id;


      button.addEventListener(
        "click",
        () => {

          selectLocation(
            id
          );

        }
      );


      $(
        "#cbLocations"
      )
        .appendChild(
          button
        );

    }


    $(
      "#cbClose"
    )
      .addEventListener(
        "click",
        hide
      );


    $(
      "#cbStart"
    )
      .addEventListener(
        "click",
        startRun
      );


    $(
      "#cbJump"
    )
      .addEventListener(
        "click",
        jump
      );


    $(
      "#cbChomp"
    )
      .addEventListener(
        "click",
        chomp
      );


    $(
      "#cbBack"
    )
      .addEventListener(
        "click",
        showLobby
      );

  }


  /*
   * =====================================================
   * THREE.JS SCENE
   * =====================================================
   */

  function makeScene() {

    if (renderer) {
      return;
    }


    renderer =
      new THREE
        .WebGLRenderer({

          canvas,

          antialias:
            true

        });


    renderer.setPixelRatio(

      Math.min(
        window.devicePixelRatio ||
        1,
        1.5
      )

    );


    renderer.outputColorSpace =
      THREE.SRGBColorSpace;


    scene =
      new THREE.Scene();


    camera =
      new THREE
        .OrthographicCamera(
          -12,
          12,
          7,
          -5,
          .1,
          100
        );


    camera.position.set(
      START_X + 5.5,
      4,
      18
    );


    camera.lookAt(
      START_X + 5.5,
      2.3,
      0
    );


    scene.add(

      new THREE
        .HemisphereLight(
          0xffffff,
          0x4c4c3f,
          2.3
        )

    );


    const sun =
      new THREE
        .DirectionalLight(
          0xffffff,
          2
        );


    sun.position.set(
      -8,
      16,
      15
    );


    scene.add(
      sun
    );


    backdrop =
      new THREE.Mesh(

        new THREE
          .PlaneGeometry(
            150,
            28
          ),

        new THREE
          .MeshBasicMaterial()

      );


    backdrop.position.set(
      START_X + 35,
      7,
      -4
    );


    scene.add(
      backdrop
    );


    ground =
      new THREE.Mesh(

        new THREE
          .BoxGeometry(
            150,
            .7,
            5
          ),

        new THREE
          .MeshLambertMaterial()

      );


    ground.position.set(
      START_X + 35,
      -.35,
      0
    );


    scene.add(
      ground
    );


    entitiesRoot =
      new THREE.Group();


    scene.add(
      entitiesRoot
    );


    bearRoot =
      new THREE.Group();


    bearVisual =
      new THREE.Group();


    bearModelMount =
      new THREE.Group();


    bearVisual.add(
      bearModelMount
    );


    bearRoot.add(
      bearVisual
    );


    scene.add(
      bearRoot
    );


    applyLocation();
    resize();

  }


  function resize() {

    if (
      !renderer ||
      !stage
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


    const aspect =
      width /
      height;


    renderer.setSize(
      width,
      height,
      false
    );


    const half =
      6.2;


    camera.top =
      half;


    camera.bottom =
      -half;


    camera.left =
      -half *
      aspect;


    camera.right =
      half *
      aspect;


    camera
      .updateProjectionMatrix();

  }


  function applyLocation() {

    if (!scene) {
      return;
    }


    const location =
      LOCATIONS[
        state.location
      ];


    scene.background =
      new THREE.Color(
        location.sky
      );


    backdrop.material
      .color
      .setHex(
        location.sky
      );


    ground.material
      .color
      .setHex(
        location.ground
      );


    overlay
      ?.querySelectorAll(
        "[data-location]"
      )
      .forEach(
        button => {

          button.classList
            .toggle(

              "selected",

              button.dataset
                .location ===
              state.location

            );

        }
      );

  }


  function selectLocation(
    id
  ) {

    if (
      !LOCATIONS[
        id
      ]
    ) {

      return;

    }


    state.location =
      id;


    applyLocation();

  }


  /*
   * =====================================================
   * BEAR GLB
   * =====================================================
   */

  function loadBear() {

    if (modelPromise) {
      return modelPromise;
    }


    modelPromise =
      new Promise(
        resolve => {

          new GLTFLoader()
            .load(

              MODEL_URL,

              gltf => {

                const oriented =
                  new THREE.Group();


                oriented.rotation.y =
                  BEAR_YAW;


                oriented.add(
                  gltf.scene
                );


                bearModelMount
                  .add(
                    oriented
                  );


                bearModelMount
                  .updateMatrixWorld(
                    true
                  );


                let box =
                  new THREE
                    .Box3()
                    .setFromObject(
                      bearModelMount
                    );


                const size =
                  box.getSize(
                    new THREE
                      .Vector3()
                  );


                if (
                  !Number.isFinite(
                    size.y
                  ) ||
                  size.y <
                    .001
                ) {

                  resolve(
                    false
                  );

                  return;

                }


                bearModelMount
                  .scale
                  .setScalar(

                    2.75 /
                    size.y

                  );


                bearModelMount
                  .updateMatrixWorld(
                    true
                  );


                box =
                  new THREE
                    .Box3()
                    .setFromObject(
                      bearModelMount
                    );


                const center =
                  box.getCenter(
                    new THREE
                      .Vector3()
                  );


                bearModelMount
                  .position
                  .set(

                    -center.x,

                    -box.min.y,

                    -center.z

                  );


                modelReady =
                  true;


                resolve(
                  true
                );

              },

              undefined,

              error => {

                console.error(
                  "[ChamBeer] GLB load failed",
                  error
                );


                resolve(
                  false
                );

              }

            );

        }
      );


    return modelPromise;

  }


  /*
   * =====================================================
   * TEMP GAME OBJECTS
   *
   * These are only skeleton geometry.
   * We replace them with final assets later.
   * =====================================================
   */

  function material(
    color
  ) {

    return new THREE
      .MeshLambertMaterial({
        color
      });

  }


  function makePerson(
    hunter =
      false
  ) {

    const root =
      new THREE.Group();


    const body =
      new THREE.Mesh(

        new THREE
          .BoxGeometry(
            .65,
            1.25,
            .5
          ),

        material(
          hunter
            ? 0x394831
            : 0x476c8a
        )

      );


    const head =
      new THREE.Mesh(

        new THREE
          .SphereGeometry(
            .36,
            10,
            7
          ),

        material(
          0xd7b184
        )

      );


    body.position.y =
      .85;


    head.position.y =
      1.7;


    root.add(
      body,
      head
    );


    if (hunter) {

      const gun =
        new THREE.Mesh(

          new THREE
            .BoxGeometry(
              .95,
              .12,
              .12
            ),

          material(
            0x2b2520
          )

        );


      gun.position.set(
        -.55,
        1.12,
        0
      );


      root.add(
        gun
      );

    }


    return root;

  }


  function makeAnimal() {

    const root =
      new THREE.Group();


    const body =
      new THREE.Mesh(

        new THREE
          .BoxGeometry(
            1.05,
            .62,
            .55
          ),

        material(
          0x9a7654
        )

      );


    const head =
      new THREE.Mesh(

        new THREE
          .SphereGeometry(
            .35,
            10,
            7
          ),

        material(
          0x9a7654
        )

      );


    body.position.y =
      .48;


    head.position.set(
      .62,
      .66,
      0
    );


    root.add(
      body,
      head
    );


    return root;

  }


  function makeObject() {

    const colors = [

      0xf0c24b,
      0xc85f45,
      0x5a82a3,
      0xddddcf

    ];


    return new THREE.Mesh(

      new THREE
        .BoxGeometry(
          .9,
          .9,
          .8
        ),

      material(

        colors[
          Math.floor(
            Math.random() *
            colors.length
          )
        ]

      )

    );

  }


  function makeTrap() {

    const root =
      new THREE.Group();


    const base =
      new THREE.Mesh(

        new THREE
          .BoxGeometry(
            1.15,
            .16,
            .9
          ),

        material(
          0x3b3d3e
        )

      );


    base.position.y =
      .08;


    root.add(
      base
    );


    for (
      const x
      of [
        -.4,
        0,
        .4
      ]
    ) {

      const tooth =
        new THREE.Mesh(

          new THREE
            .ConeGeometry(
              .16,
              .55,
              6
            ),

          material(
            0x222526
          )

        );


      tooth.position.set(
        x,
        .38,
        0
      );


      root.add(
        tooth
      );

    }


    return root;

  }


  function addEntity(
    type,
    x
  ) {

    let root;
    let radius = .8;
    let heal = 0;
    let points = 0;
    let damage = 0;


    if (
      type ===
      "human"
    ) {

      root =
        makePerson();

      heal =
        13;

      points =
        100;

    } else if (
      type ===
      "animal"
    ) {

      root =
        makeAnimal();

      radius =
        .85;

      heal =
        16;

      points =
        130;

    } else if (
      type ===
      "object"
    ) {

      root =
        makeObject();

      radius =
        .7;

      heal =
        7;

      points =
        60;

    } else if (
      type ===
      "hunter"
    ) {

      root =
        makePerson(
          true
        );

      radius =
        .85;

      heal =
        18;

      points =
        220;

    } else {

      root =
        makeTrap();

      damage =
        26;

    }


    root.position.set(
      x,
      0,
      0
    );


    entitiesRoot.add(
      root
    );


    entities.push({

      type,
      root,
      x,

      y:
        0,

      radius,
      heal,
      points,
      damage,

      dead:
        false,

      fireIn:
        type ===
          "hunter"

          ? .7 +
            Math.random() *
            1.4

          : 0,

      vx:
        0

    });

  }


  function addBullet(
    hunter
  ) {

    const root =
      new THREE.Mesh(

        new THREE
          .SphereGeometry(
            .13,
            8,
            6
          ),

        new THREE
          .MeshBasicMaterial({
            color:
              0xffd45d
          })

      );


    const x =
      hunter.x -
      .8;


    const y =
      1.15;


    root.position.set(
      x,
      y,
      0
    );


    entitiesRoot.add(
      root
    );


    entities.push({

      type:
        "bullet",

      root,
      x,
      y,

      radius:
        .18,

      heal:
        0,

      points:
        0,

      damage:
        14,

      dead:
        false,

      fireIn:
        0,

      vx:
        -12

    });

  }


  function pickSpawnType() {

    const random =
      Math.random();


    if (
      state.location ===
      "forest"
    ) {

      return (
        random < .28
          ? "animal"
          : random < .47
            ? "human"
            : random < .64
              ? "hunter"
              : random < .80
                ? "trap"
                : "object"
      );

    }


    if (
      state.location ===
      "building"
    ) {

      return (
        random < .36
          ? "human"
          : random < .52
            ? "hunter"
            : random < .67
              ? "trap"
              : "object"
      );

    }


    return (
      random < .42
        ? "human"
        : random < .53
          ? "animal"
          : random < .68
            ? "hunter"
            : random < .78
              ? "trap"
              : "object"
    );

  }


  function spawnAhead() {

    while (
      state.nextSpawnX <
      state.x +
      55
    ) {

      state.nextSpawnX +=

        3.8 +

        Math.random() *
        4.6;


      addEntity(

        pickSpawnType(),

        state.nextSpawnX

      );

    }

  }


  function removeEntity(
    entity
  ) {

    entity.dead =
      true;


    entity.root
      .removeFromParent();

  }


  function clearEntities() {

    for (
      const entity
      of entities
    ) {

      entity.root
        .removeFromParent();

    }


    entities.length =
      0;

  }


  /*
   * =====================================================
   * GAMEPLAY
   * =====================================================
   */

  function damage(
    amount
  ) {

    if (
      state.phase !==
        "running" ||
      state.invulnerable >
        0
    ) {

      return;

    }


    state.hp =
      Math.max(
        0,
        state.hp -
        amount
      );


    state.invulnerable =
      .55;


    if (
      state.hp <=
      0
    ) {

      state.phase =
        "dead";


      showDeath();

    }

  }


  function eat(
    entity
  ) {

    state.hp =
      Math.min(

        MAX_HP,

        state.hp +
        entity.heal

      );


    state.score +=
      entity.points;


    state.eaten +=
      1;


    state.chomp =
      Math.max(
        state.chomp,
        .16
      );


    removeEntity(
      entity
    );

  }


  function jump() {

    if (
      state.phase !==
        "running" ||
      !state.grounded
    ) {

      return;

    }


    state.vy =
      8.7;


    state.grounded =
      false;

  }


  function chomp() {

    if (
      state.phase !==
      "running"
    ) {

      return;

    }


    state.chomp =
      .28;


    state.speed =
      Math.min(
        14.5,
        state.speed +
        .8
      );

  }


  function input(
    name
  ) {

    if (
      name ===
      "faster"
    ) {

      return (

        touch.faster ||

        keys.has(
          "KeyD"
        ) ||

        keys.has(
          "ArrowRight"
        )

      );

    }


    return (

      touch.slower ||

      keys.has(
        "KeyA"
      ) ||

      keys.has(
        "ArrowLeft"
      )

    );

  }


  function updateEntities(
    dt
  ) {

    const eatRadius =

      state.chomp >
      0

        ? 1.65
        : 1.15;


    const bearY =
      state.y +
      1.1;


    for (
      const entity
      of [
        ...entities
      ]
    ) {

      if (
        entity.dead
      ) {

        continue;

      }


      if (
        entity.type ===
        "bullet"
      ) {

        entity.x +=
          entity.vx *
          dt;


        entity.root
          .position
          .x =
            entity.x;

      }


      if (
        entity.type ===
        "hunter"
      ) {

        const distance =
          entity.x -
          state.x;


        entity.fireIn -=
          dt;


        if (
          distance >
            4 &&
          distance <
            22 &&
          entity.fireIn <=
            0
        ) {

          addBullet(
            entity
          );


          entity.fireIn =

            1.25 +

            Math.random() *
            1.25;

        }

      }


      const dx =
        entity.x -
        state.x;


      const dy =

        entity.y +
        .8 -
        bearY;


      const hit =

        Math.hypot(
          dx,
          dy
        ) <

        eatRadius +
        entity.radius;


      if (hit) {

        if (
          [
            "human",
            "animal",
            "object",
            "hunter"
          ]
            .includes(
              entity.type
            )
        ) {

          eat(
            entity
          );


          continue;

        }


        if (
          entity.type ===
            "trap" ||
          entity.type ===
            "bullet"
        ) {

          damage(
            entity.damage
          );


          removeEntity(
            entity
          );


          continue;

        }

      }


      if (
        entity.x <
        state.x -
        18
      ) {

        removeEntity(
          entity
        );

      }

    }


    for (
      let i =
        entities.length -
        1;

      i >= 0;

      i -= 1
    ) {

      if (
        entities[i]
          .dead
      ) {

        entities.splice(
          i,
          1
        );

      }

    }

  }


  function step(
    dt
  ) {

    if (
      state.phase !==
      "running"
    ) {

      return;

    }


    state.chomp =
      Math.max(
        0,
        state.chomp -
        dt
      );


    state.invulnerable =
      Math.max(
        0,
        state.invulnerable -
        dt
      );


    const targetSpeed =

      input(
        "faster"
      )

        ? 12.5

        : input(
            "slower"
          )

          ? 5.2
          : 8.4;


    state.speed +=

      (
        targetSpeed -
        state.speed
      ) *

      Math.min(
        1,
        dt *
        3.2
      );


    state.x +=
      state.speed *
      dt;


    state.distance =
      Math.max(
        0,
        state.x -
        START_X
      );


    state.score +=

      dt *
      state.speed *
      .7;


    state.vy -=
      22 *
      dt;


    state.y +=
      state.vy *
      dt;


    if (
      state.y <=
      0
    ) {

      state.y =
        0;


      state.vy =
        0;


      state.grounded =
        true;

    } else {

      state.grounded =
        false;

    }


    /*
     * HP continuously drains.
     * Eating is how the player stays alive.
     */
    state.hp =
      Math.max(

        0,

        state.hp -
        2.15 *
        dt

      );


    if (
      state.hp <=
      0
    ) {

      state.phase =
        "dead";


      showDeath();


      return;

    }


    spawnAhead();


    updateEntities(
      dt
    );

  }


  /*
   * =====================================================
   * RENDER
   * =====================================================
   */

  function updateVisuals(
    dt
  ) {

    bearRoot
      .position
      .set(

        state.x,

        state.y,

        0

      );


    const targetX =

      state.chomp >
      0

        ? 1.16
        : 1;


    const targetY =

      state.chomp >
      0

        ? .90
        : 1;


    bearVisual.scale.x +=

      (
        targetX -
        bearVisual.scale.x
      ) *

      Math.min(
        1,
        dt *
        15
      );


    bearVisual.scale.y +=

      (
        targetY -
        bearVisual.scale.y
      ) *

      Math.min(
        1,
        dt *
        15
      );


    bearRoot.rotation.z =

      state.grounded

        ? Math.sin(
            performance.now() *
            .018
          ) *
          .025 *
          clamp(
            state.speed /
            8,
            0,
            1.5
          )

        : clamp(
            -state.vy *
            .035,
            -.35,
            .35
          );


    const cameraX =
      state.x +
      5.5;


    camera.position.x +=

      (
        cameraX -
        camera.position.x
      ) *

      Math.min(
        1,
        dt *
        7
      );


    camera.lookAt(
      camera.position.x,
      2.3,
      0
    );


    ground.position.x =
      camera.position.x;


    backdrop.position.x =
      camera.position.x;

  }


  function updateHud() {

    $(
      "#cbHpFill"
    )
      .style
      .transform =

        `scaleX(${
          clamp(
            state.hp /
            MAX_HP,
            0,
            1
          )
        })`;


    if (
      state.phase ===
      "lobby"
    ) {

      $(
        "#cbHudText"
      )
        .textContent =

          `LOBBY · ${
            LOCATIONS[
              state.location
            ].name
          }`;


      return;

    }


    if (
      state.phase ===
      "dead"
    ) {

      $(
        "#cbHudText"
      )
        .textContent =

          `DEAD · ` +
          `${Math.floor(state.score)} SCORE · ` +
          `${state.eaten} EATEN`;


      return;

    }


    $(
      "#cbHudText"
    )
      .textContent =

        `${
          LOCATIONS[
            state.location
          ].name
        } · ` +

        `${Math.ceil(state.hp)} HP · ` +

        `${Math.floor(state.score)} SCORE · ` +

        `${Math.floor(state.distance)} m · ` +

        `${state.eaten} EATEN`;

  }


  function showDeath() {

    $(
      "#cbLobbyTitle"
    )
      .textContent =
        "МЕДВЕДЬ СДОХ";


    $(
      "#cbLobbyCopy"
    )
      .textContent =

        `Score ${Math.floor(state.score)} · ` +
        `Distance ${Math.floor(state.distance)} m · ` +
        `Eaten ${state.eaten}.`;


    $(
      "#cbStart"
    )
      .textContent =
        "ЕЩЁ РАЗ";


    $(
      "#cbStart"
    )
      .disabled =
        false;


    $(
      "#cbLobby"
    )
      .hidden =
        false;


    $(
      "#cbControls"
    )
      .hidden =
        true;

  }


  function startRun() {

    if (
      !modelReady
    ) {

      return;

    }


    clearEntities();


    Object.assign(
      state,
      {

        phase:
          "running",

        x:
          START_X,

        y:
          0,

        vy:
          0,

        speed:
          8,

        grounded:
          true,

        hp:
          MAX_HP,

        score:
          0,

        eaten:
          0,

        distance:
          0,

        chomp:
          0,

        invulnerable:
          0,

        nextSpawnX:
          16

      }
    );


    camera.position.x =
      START_X +
      5.5;


    bearRoot.position.set(
      START_X,
      0,
      0
    );


    $(
      "#cbLobby"
    )
      .hidden =
        true;


    $(
      "#cbControls"
    )
      .hidden =
        false;


    spawnAhead();

  }


  function showLobby() {

    state.phase =
      "lobby";


    clearEntities();


    $(
      "#cbLobbyTitle"
    )
      .textContent =
        "CHOOSE LOCATION";


    $(
      "#cbLobbyCopy"
    )
      .textContent =

        "Жри людей, животных и предметы. " +
        "Еда держит HP. " +
        "Охотники, пули и ловушки отнимают жизнь.";


    $(
      "#cbStart"
    )
      .textContent =

        modelReady
          ? "СТАРТ"
          : "ЗАГРУЗКА МЕДВЕДЯ…";


    $(
      "#cbStart"
    )
      .disabled =
        !modelReady;


    $(
      "#cbLobby"
    )
      .hidden =
        false;


    $(
      "#cbControls"
    )
      .hidden =
        true;


    applyLocation();

  }


  function loop(
    now
  ) {

    if (!active) {
      return;
    }


    const dt =
      Math.min(

        .04,

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


    step(
      dt
    );


    updateVisuals(
      dt
    );


    updateHud();


    renderer.render(
      scene,
      camera
    );


    frame =
      requestAnimationFrame(
        loop
      );

  }


  /*
   * =====================================================
   * CONTROLS
   * =====================================================
   */

  function bindControls() {

    controlsAbort
      ?.abort();


    controlsAbort =
      new AbortController();


    const options = {
      signal:
        controlsAbort.signal
    };


    window.addEventListener(
      "resize",
      resize,
      options
    );


    window.addEventListener(
      "keydown",
      event => {

        if (!active) {
          return;
        }


        if (
          [
            "ArrowLeft",
            "ArrowRight",
            "ArrowUp",
            "Space"
          ]
            .includes(
              event.code
            )
        ) {

          event.preventDefault();

        }


        if (
          event.code ===
          "Escape"
        ) {

          hide();
          return;

        }


        if (
          (
            event.code ===
              "KeyW" ||
            event.code ===
              "ArrowUp" ||
            event.code ===
              "Space"
          ) &&
          !event.repeat
        ) {

          jump();

        }


        if (
          (
            event.code ===
              "KeyE" ||
            event.code ===
              "ShiftLeft" ||
            event.code ===
              "ShiftRight"
          ) &&
          !event.repeat
        ) {

          chomp();

        }


        keys.add(
          event.code
        );

      },
      options
    );


    window.addEventListener(
      "keyup",
      event => {

        keys.delete(
          event.code
        );

      },
      options
    );


    window.addEventListener(
      "blur",
      () => {

        keys.clear();

        touch.faster =
          false;

        touch.slower =
          false;

      },
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

              button
                .setPointerCapture
                ?.(
                  event.pointerId
                );

            },
            options
          );


          [
            "pointerup",
            "pointercancel",
            "lostpointercapture"
          ]
            .forEach(
              type => {

                button
                  .addEventListener(
                    type,
                    release,
                    options
                  );

              }
            );

        }
      );

  }


  /*
   * =====================================================
   * OPEN / CLOSE
   * =====================================================
   */

  async function show() {

    makeUI();
    makeScene();


    if (active) {
      return;
    }


    active =
      true;


    oldOverflow =
      document.body
        .style
        .overflow;


    document.body
      .style
      .overflow =
        "hidden";


    overlay
      .classList
      .add(
        "active"
      );


    bindControls();


    voicePanel =
      window
        .LAGO_GAME_VOICE
        ?.createPanel({

          gameId:
            GAME_ID,

          mount:
            $(
              "#cbVoice"
            ),

          placement:
            "inline"

        }) ||
      null;


    showLobby();


    resize();


    lastTime =
      performance.now();


    frame =
      requestAnimationFrame(
        loop
      );


    const ok =
      await loadBear();


    if (!active) {
      return;
    }


    $(
      "#cbStart"
    )
      .disabled =
        !ok;


    $(
      "#cbStart"
    )
      .textContent =

        ok
          ? "СТАРТ"
          : "МОДЕЛЬ НЕ НАЙДЕНА";


    if (!ok) {

      $(
        "#cbLobbyCopy"
      )
        .textContent =

          "Не найден " +
          "assets/model/game/chambeer/chambeer.glb";

    }

  }


  function hide() {

    if (!active) {
      return;
    }


    active =
      false;


    state.phase =
      "lobby";


    cancelAnimationFrame(
      frame
    );


    controlsAbort
      ?.abort();


    controlsAbort =
      null;


    keys.clear();


    touch.faster =
      false;


    touch.slower =
      false;


    clearEntities();


    voicePanel
      ?.destroy();


    voicePanel =
      null;


    overlay
      .classList
      .remove(
        "active"
      );


    document.body
      .style
      .overflow =
        oldOverflow;

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

        void show();

      }

    }
  );


  window.LAGO_CHAMBEER =
    Object.freeze({

      version:
        VERSION,

      show,

      hide

    });

})();

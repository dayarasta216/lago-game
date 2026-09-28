import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

(() => {
  "use strict";

  const VERSION = 1;
  const GAME_ID = "cart-chaos";
  const LAPS = 3;

  const VEHICLES = [
    [
      "shopping-cart",
      "SHOPPING CART",
      "shopping-cart.glb",
      0
    ],

    [
      "turbo-wheelchair",
      "TURBO WHEELCHAIR",
      "turbo-wheelchair.glb",
      0
    ],

    [
      "turbo-toilet",
      "TURBO TOILET",
      "turbo-toilet.glb",
      Math.PI / 2
    ],

    [
      "vacuum-snail",
      "VACUUM SNAIL",
      "vacuum-snail.glb",
      0
    ],

    [
      "grumpy-scrubber",
      "GRUMPY SCRUBBER",
      "grumpy-scrubber.glb",
      Math.PI / 2
    ]

  ].map(
    (
      [
        id,
        name,
        file,
        yaw
      ]
    ) => ({

      id,
      name,
      yaw,

      url:
        `./assets/model/game/cart-chaos/${file}?v=1`

    })
  );


  const WAYPOINTS = [

    [0, 9],
    [17, 9],
    [19, 0],
    [17, -9],

    [0, -9],
    [-17, -9],
    [-19, 0],
    [-17, 9]

  ];


  const SPAWNS = [

    [-15.8, 8.2],
    [-13.6, 9.6],
    [-13.3, 7.0],
    [-11.0, 8.5]

  ];


  const BOOSTS = [

    [5, 9],
    [18, -2],
    [-4, -9],
    [-18, 2]

  ];


  const OBSTACLES = [

    [10, 9, "box"],
    [18, 5, "cone"],
    [14, -9, "box"],
    [3, -9, "cone"],
    [-12, -9, "box"],
    [-18, -4, "cone"],
    [-15, 9, "box"]

  ];


  let overlay;
  let stage;
  let canvas;

  let renderer;
  let scene;
  let camera;

  let worldRoot;
  let garageRoot;
  let garageVehicleRoot;

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

  let phase =
    "garage";

  let countdown =
    0;

  let raceTime =
    0;

  let selectedId =
    "shopping-cart";

  let garageToken =
    0;


  const loader =
    new GLTFLoader();


  const cache =
    new Map();


  const racers =
    [];


  const keys =
    new Set();


  const touch = {

    gas: false,
    brake: false,
    left: false,
    right: false

  };


  const $ =
    selector =>
      overlay
        ?.querySelector(
          selector
        );


  const clamp =
    (
      value,
      min,
      max
    ) =>

      Math.max(
        min,
        Math.min(
          max,
          value
        )
      );


  const normalizeAngle =
    value =>

      Math.atan2(
        Math.sin(
          value
        ),
        Math.cos(
          value
        )
      );


  function getVehicle(
    id
  ) {

    return (
      VEHICLES
        .find(
          item =>
            item.id ===
            id
        ) ||
      VEHICLES[0]
    );

  }


  function getPlayer() {

    return (
      racers
        .find(
          racer =>
            racer.player
        ) ||
      null
    );

  }


  /*
   * =======================================================
   * UI
   * =======================================================
   */

  function makeUI() {

    if (overlay) {
      return;
    }


    const style =
      document
        .createElement(
          "style"
        );


    style.textContent = `

      #lagoCartChaos {

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
          #080d12;

        color:
          #fff;

        font:
          700 13px
          system-ui,
          sans-serif;

      }


      #lagoCartChaos.active {

        display:
          flex;

      }


      .cc-head,
      .cc-tools,
      .cc-controls,
      .cc-group,
      .cc-list {

        display:
          flex;

        align-items:
          center;

        flex-wrap:
          wrap;

        gap:
          7px;

      }


      .cc-head,
      .cc-controls {

        justify-content:
          space-between;

      }


      .cc-title {

        margin:
          0;

        font-size:

          clamp(
            25px,
            5vw,
            42px
          );

        font-weight:
          1000;

        letter-spacing:
          -.055em;

      }


      .cc-sub {

        color:
          rgba(
            255,
            255,
            255,
            .46
          );

        font-size:
          9px;

        font-weight:
          900;

      }


      .cc-tools {

        justify-content:
          flex-end;

      }


      #ccVoice {

        position:
          relative;

      }


      .cc-stage {

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
            .13
          );

        border-radius:
          16px;

        background:
          #7f9660;

      }


      #ccCanvas {

        display:
          block;

        width:
          100%;

        height:
          100%;

        touch-action:
          none;

      }


      .cc-hud {

        position:
          absolute;

        top:
          9px;

        left:
          9px;

        z-index:
          8;

        padding:
          7px 10px;

        border-radius:
          9px;

        background:
          rgba(
            6,
            16,
            25,
            .85
          );

        color:
          #d8f34b;

        font-size:
          10px;

        font-weight:
          1000;

        pointer-events:
          none;

      }


      .cc-garage {

        position:
          absolute;

        inset:
          0;

        z-index:
          15;

        display:
          flex;

        flex-direction:
          column;

        justify-content:
          flex-end;

        gap:
          8px;

        padding:
          14px;

        background:

          linear-gradient(
            180deg,
            transparent 25%,
            rgba(
              7,
              16,
              24,
              .86
            )
            72%
          );

      }


      .cc-garage[hidden],
      .cc-controls[hidden] {

        display:
          none !important;

      }


      .cc-list {

        align-items:
          stretch;

      }


      .cc-vehicle {

        flex:
          1 1 150px;

        min-height:
          42px;

        border:

          1px solid
          rgba(
            255,
            255,
            255,
            .18
          );

        border-radius:
          10px;

        background:
          rgba(
            24,
            39,
            51,
            .9
          );

        color:
          #fff;

        padding:
          8px;

        font:
          900 10px
          system-ui;

        cursor:
          pointer;

      }


      .cc-vehicle.selected {

        border-color:
          #d8f34b;

        background:
          #405226;

      }


      .cc-button {

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
            .22
          );

        border-radius:
          10px;

        background:
          #293f51;

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


      .cc-button:disabled {

        opacity:
          .42;

      }


      .cc-primary {

        background:
          #d8f34b;

        color:
          #13200c;

      }


      .cc-chaos {

        background:
          #e85a43;

      }


      .cc-status {

        min-height:
          16px;

        font-size:
          10px;

      }


      .cc-help {

        text-align:
          center;

        color:
          rgba(
            255,
            255,
            255,
            .54
          );

        font-size:
          10px;

      }


      @media (
        max-width:
        640px
      ) {

        .cc-button {

          min-width:
            48px;

          padding:
            9px;

          font-size:
            10px;

        }


        .cc-help {

          display:
            none;

        }


        .cc-garage {

          padding:
            8px;

        }


        .cc-vehicle {

          flex:
            1 1 30%;

          min-height:
            38px;

          padding:
            6px;

          font-size:
            8px;

        }


        #ccVoice
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
      "lagoCartChaos";


    overlay.innerHTML = `

      <header class="cc-head">

        <div>

          <h2 class="cc-title">
            CART CHAOS
          </h2>

          <div class="cc-sub">
            3D ARCADE RACE ·
            4 RACERS ·
            MULTIPLAYER LATER
          </div>

        </div>


        <div class="cc-tools">

          <div id="ccVoice"></div>

          <button
            class="cc-button"
            id="ccClose"
            type="button"
          >
            ЗАКРЫТЬ ×
          </button>

        </div>

      </header>


      <div
        class="cc-stage"
        id="ccStage"
      >

        <canvas
          id="ccCanvas"
        ></canvas>


        <div
          class="cc-hud"
          id="ccHud"
        >
          GARAGE
        </div>


        <section
          class="cc-garage"
          id="ccGarage"
        >

          <div
            class="cc-status"
            id="ccStatus"
          >
            Выбери транспорт.
          </div>


          <div
            class="cc-list"
            id="ccList"
          ></div>


          <button
            class="cc-button cc-primary"
            id="ccStart"
            type="button"
            disabled
          >
            ЗАГРУЗКА МОДЕЛИ…
          </button>

        </section>

      </div>


      <div
        class="cc-controls"
        id="ccControls"
        hidden
      >

        <div class="cc-group">

          <button
            class="cc-button"
            data-hold="left"
            type="button"
          >
            ◀
          </button>


          <button
            class="cc-button"
            data-hold="right"
            type="button"
          >
            ▶
          </button>


          <button
            class="cc-button"
            data-hold="brake"
            type="button"
          >
            ТОРМОЗ
          </button>

        </div>


        <div class="cc-group">

          <button
            class="cc-button cc-chaos"
            id="ccChaos"
            type="button"
          >
            CHAOS
          </button>


          <button
            class="cc-button cc-primary"
            data-hold="gas"
            type="button"
          >
            ГАЗ
          </button>


          <button
            class="cc-button"
            id="ccRestart"
            type="button"
          >
            ГАРАЖ
          </button>

        </div>

      </div>


      <div class="cc-help">

        W / ↑ — газ ·
        S / ↓ — тормоз ·
        A / D — поворот ·
        Space — CHAOS

      </div>

    `;


    document.body
      .appendChild(
        overlay
      );


    stage =
      $(
        "#ccStage"
      );


    canvas =
      $(
        "#ccCanvas"
      );


    $(
      "#ccClose"
    )
      .addEventListener(
        "click",
        hide
      );


    const list =
      $(
        "#ccList"
      );


    VEHICLES
      .forEach(
        item => {

          const button =
            document.createElement(
              "button"
            );


          button.type =
            "button";


          button.className =
            "cc-vehicle";


          button.dataset.vehicle =
            item.id;


          button.textContent =
            item.name;


          button.addEventListener(
            "click",
            () => {

              void choose(
                item.id
              );

            }
          );


          list.appendChild(
            button
          );

        }
      );

  }


  /*
   * =======================================================
   * THREE.JS WORLD
   * =======================================================
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


    scene.background =
      new THREE.Color(
        0x91a96d
      );


    camera =
      new THREE
        .OrthographicCamera(
          -20,
          20,
          15,
          -15,
          .1,
          150
        );


    scene.add(

      new THREE
        .HemisphereLight(
          0xffffff,
          0x59633f,
          2.1
        )

    );


    const sun =
      new THREE
        .DirectionalLight(
          0xffffff,
          2
        );


    sun.position.set(
      -15,
      30,
      18
    );


    scene.add(
      sun
    );


    worldRoot =
      new THREE.Group();


    garageRoot =
      new THREE.Group();


    scene.add(
      worldRoot,
      garageRoot
    );


    buildTrack();
    buildGarage();


    worldRoot.visible =
      false;


    resize();

  }


  function buildTrack() {

    const grass =
      new THREE.Mesh(

        new THREE
          .PlaneGeometry(
            62,
            42
          ),

        new THREE
          .MeshLambertMaterial({
            color:
              0x718b55
          })

      );


    grass.rotation.x =
      -Math.PI / 2;


    grass.position.y =
      -.04;


    worldRoot.add(
      grass
    );


    const shape =
      new THREE.Shape();


    shape.moveTo(
      -24,
      -15
    );


    shape.lineTo(
      24,
      -15
    );


    shape.lineTo(
      24,
      15
    );


    shape.lineTo(
      -24,
      15
    );


    shape.closePath();


    const hole =
      new THREE.Path();


    hole.moveTo(
      -10,
      -5
    );


    hole.lineTo(
      -10,
      5
    );


    hole.lineTo(
      10,
      5
    );


    hole.lineTo(
      10,
      -5
    );


    hole.closePath();


    shape.holes.push(
      hole
    );


    const road =
      new THREE.Mesh(

        new THREE
          .ShapeGeometry(
            shape
          ),

        new THREE
          .MeshLambertMaterial({

            color:
              0x373c42,

            side:
              THREE.DoubleSide

          })

      );


    road.rotation.x =
      -Math.PI / 2;


    worldRoot.add(
      road
    );


    const island =
      new THREE.Mesh(

        new THREE
          .PlaneGeometry(
            19.5,
            9.5
          ),

        new THREE
          .MeshLambertMaterial({
            color:
              0x6c884f
          })

      );


    island.rotation.x =
      -Math.PI / 2;


    island.position.y =
      .015;


    worldRoot.add(
      island
    );


    BOOSTS.forEach(
      (
        [
          x,
          z
        ],
        index
      ) => {

        const boost =
          new THREE.Mesh(

            new THREE
              .PlaneGeometry(
                3.5,
                1.3
              ),

            new THREE
              .MeshBasicMaterial({

                color:
                  0xcff044,

                side:
                  THREE.DoubleSide

              })

          );


        boost.rotation.x =
          -Math.PI / 2;


        boost.rotation.z =
          index *
          Math.PI /
          2;


        boost.position.set(
          x,
          .04,
          z
        );


        worldRoot.add(
          boost
        );

      }
    );


    OBSTACLES.forEach(
      (
        [
          x,
          z,
          type
        ]
      ) => {

        const geometry =
          type ===
          "cone"

            ? new THREE
                .ConeGeometry(
                  .5,
                  1.35,
                  10
                )

            : new THREE
                .BoxGeometry(
                  1.35,
                  1.35,
                  1.35
                );


        const color =
          type ===
          "cone"

            ? 0xff7a35
            : 0x8a6040;


        const obstacle =
          new THREE.Mesh(

            geometry,

            new THREE
              .MeshLambertMaterial({
                color
              })

          );


        obstacle.position.set(
          x,
          .68,
          z
        );


        worldRoot.add(
          obstacle
        );

      }
    );

  }


  function buildGarage() {

    const floor =
      new THREE.Mesh(

        new THREE
          .CircleGeometry(
            5.3,
            48
          ),

        new THREE
          .MeshLambertMaterial({
            color:
              0x26333c
          })

      );


    floor.rotation.x =
      -Math.PI / 2;


    garageRoot.add(
      floor
    );


    const ring =
      new THREE.Mesh(

        new THREE
          .RingGeometry(
            4.1,
            4.35,
            48
          ),

        new THREE
          .MeshBasicMaterial({

            color:
              0xd8f34b,

            side:
              THREE.DoubleSide

          })

      );


    ring.rotation.x =
      -Math.PI / 2;


    ring.position.y =
      .02;


    garageRoot.add(
      ring
    );


    garageVehicleRoot =
      new THREE.Group();


    garageRoot.add(
      garageVehicleRoot
    );

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


    const racing =

      [
        "countdown",
        "running",
        "finished"
      ]
        .includes(
          phase
        );


    const half =

      racing

        ? Math.max(

            18,

            27 /
            Math.max(
              aspect,
              .4
            )

          )

        : 6.4;


    camera.left =
      -half *
      aspect;


    camera.right =
      half *
      aspect;


    camera.top =
      half;


    camera.bottom =
      -half;


    camera
      .updateProjectionMatrix();


    camera.position.set(

      0,

      racing
        ? 39
        : 7.5,

      racing
        ? 34
        : 10.5

    );


    camera.lookAt(

      0,

      racing
        ? 0
        : 1.1,

      0

    );

  }


  /*
   * =======================================================
   * GLB VEHICLES
   * =======================================================
   */

  function loadTemplate(
    item
  ) {

    if (
      cache.has(
        item.id
      )
    ) {

      return cache.get(
        item.id
      );

    }


    const promise =
      new Promise(
        (
          resolve,
          reject
        ) => {

          loader.load(

            item.url,

            gltf => {

              resolve(
                gltf.scene
              );

            },

            undefined,

            reject

          );

        }
      );


    cache.set(
      item.id,
      promise
    );


    promise.catch(
      () => {

        cache.delete(
          item.id
        );

      }
    );


    return promise;

  }


  async function makeVisual(
    item
  ) {

    const model =
      (
        await loadTemplate(
          item
        )
      )
        .clone(
          true
        );


    const visual =
      new THREE.Group();


    const oriented =
      new THREE.Group();


    oriented.rotation.y =
      item.yaw;


    oriented.add(
      model
    );


    visual.add(
      oriented
    );


    visual
      .updateMatrixWorld(
        true
      );


    let box =
      new THREE
        .Box3()
        .setFromObject(
          visual
        );


    const size =
      box.getSize(
        new THREE.Vector3()
      );


    visual.scale
      .setScalar(

        3.4 /
        Math.max(
          size.x,
          size.z,
          .001
        )

      );


    visual
      .updateMatrixWorld(
        true
      );


    box =
      new THREE
        .Box3()
        .setFromObject(
          visual
        );


    const center =
      box.getCenter(
        new THREE.Vector3()
      );


    visual.position.set(

      -center.x,

      -box.min.y,

      -center.z

    );


    return visual;

  }


  async function choose(
    id
  ) {

    const item =
      getVehicle(
        id
      );


    selectedId =
      item.id;


    const token =
      ++garageToken;


    overlay
      .querySelectorAll(
        "[data-vehicle]"
      )
      .forEach(
        button => {

          button.classList
            .toggle(

              "selected",

              button.dataset
                .vehicle ===
              id

            );

        }
      );


    const start =
      $(
        "#ccStart"
      );


    start.disabled =
      true;


    start.textContent =
      "ЗАГРУЗКА МОДЕЛИ…";


    $(
      "#ccStatus"
    )
      .textContent =
        `Загрузка ${item.name}…`;


    try {

      const visual =
        await makeVisual(
          item
        );


      if (
        !active ||
        token !==
          garageToken ||
        phase !==
          "garage"
      ) {

        return;

      }


      garageVehicleRoot
        .clear();


      garageVehicleRoot
        .add(
          visual
        );


      start.disabled =
        false;


      start.textContent =
        "СТАРТ ГОНКИ";


      $(
        "#ccStatus"
      )
        .textContent =
          `${item.name} готов.`;

    } catch (
      error
    ) {

      console.error(
        "[CART CHAOS] model load failed",
        error
      );


      start.textContent =
        "ОШИБКА МОДЕЛИ";


      $(
        "#ccStatus"
      )
        .textContent =
          `Не удалось загрузить ${item.name}.`;

    }

  }


  function clearRacers() {

    racers.forEach(
      racer => {

        racer.root
          ?.removeFromParent();

      }
    );


    racers.length =
      0;

  }


  /*
   * =======================================================
   * RACE START
   * =======================================================
   */

  async function startRace() {

    if (
      phase !==
      "garage"
    ) {

      return;

    }


    phase =
      "loading";


    $(
      "#ccStart"
    )
      .disabled =
        true;


    const selected =
      getVehicle(
        selectedId
      );


    const roster = [

      selected,

      ...VEHICLES
        .filter(
          item =>
            item.id !==
            selected.id
        )

    ]
      .slice(
        0,
        4
      );


    const visuals =
      [];


    try {

      for (
        let index = 0;
        index < roster.length;
        index += 1
      ) {

        $(
          "#ccStatus"
        )
          .textContent =

            `Загрузка ${index + 1}/4 · ` +
            roster[index].name;


        visuals.push(

          await makeVisual(
            roster[index]
          )

        );

      }

    } catch (
      error
    ) {

      console.error(
        "[CART CHAOS] race load failed",
        error
      );


      phase =
        "garage";


      $(
        "#ccStart"
      )
        .disabled =
          false;


      $(
        "#ccStatus"
      )
        .textContent =
          "Не удалось загрузить участников.";


      return;

    }


    if (!active) {
      return;
    }


    clearRacers();


    roster.forEach(
      (
        item,
        index
      ) => {

        const root =
          new THREE.Group();


        root.add(
          visuals[
            index
          ]
        );


        worldRoot.add(
          root
        );


        racers.push({

          id:
            index
              ? `bot-${index}`
              : "player",

          player:
            index === 0,

          root,

          x:
            SPAWNS[
              index
            ][0],

          z:
            SPAWNS[
              index
            ][1],

          heading:
            0,

          speed:
            0,

          lap:
            1,

          next:
            0,

          finished:
            false,

          finishTime:
            null,

          chaos:
            100,

          hit:
            0,

          pad:
            0

        });

      }
    );


    garageRoot.visible =
      false;


    worldRoot.visible =
      true;


    $(
      "#ccGarage"
    )
      .hidden =
        true;


    $(
      "#ccControls"
    )
      .hidden =
        false;


    raceTime =
      0;


    countdown =
      3;


    phase =
      "countdown";


    resize();

  }


  function backToGarage() {

    clearRacers();


    phase =
      "garage";


    worldRoot.visible =
      false;


    garageRoot.visible =
      true;


    $(
      "#ccGarage"
    )
      .hidden =
        false;


    $(
      "#ccControls"
    )
      .hidden =
        true;


    resize();


    void choose(
      selectedId
    );

  }


  /*
   * =======================================================
   * INPUT
   * =======================================================
   */

  function input(
    name
  ) {

    const map = {

      gas:
        [
          "KeyW",
          "ArrowUp"
        ],

      brake:
        [
          "KeyS",
          "ArrowDown"
        ],

      left:
        [
          "KeyA",
          "ArrowLeft"
        ],

      right:
        [
          "KeyD",
          "ArrowRight"
        ]

    };


    return (

      touch[
        name
      ] ||

      map[
        name
      ]
        .some(
          key =>
            keys.has(
              key
            )
        )

    );

  }


  function chaos() {

    const current =
      getPlayer();


    if (
      !current ||
      phase !==
        "running" ||
      current.finished ||
      current.chaos <
        35
    ) {

      return;

    }


    current.chaos -=
      35;


    current.speed =
      Math.min(

        20.5,

        current.speed +
        5.5

      );

  }


  /*
   * =======================================================
   * RACE PHYSICS
   * =======================================================
   */

  function isRoad(
    x,
    z
  ) {

    return (

      Math.abs(
        x
      ) <=
        24 &&

      Math.abs(
        z
      ) <=
        15 &&

      !(
        Math.abs(
          x
        ) <
          10 &&

        Math.abs(
          z
        ) <
          5
      )

    );

  }


  function drivePlayer(
    racer,
    dt
  ) {

    const gas =
      Number(
        input(
          "gas"
        )
      );


    const brake =
      Number(
        input(
          "brake"
        )
      );


    const steer =

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


    const road =
      isRoad(
        racer.x,
        racer.z
      );


    racer.speed +=

      gas *
      9.4 *
      dt -

      brake *
      11.5 *
      dt;


    if (
      !gas &&
      !brake
    ) {

      racer.speed *=
        Math.pow(
          .987,
          dt * 60
        );

    }


    if (!road) {

      racer.speed *=
        Math.pow(
          .958,
          dt * 60
        );

    }


    racer.speed =
      clamp(

        racer.speed,

        -3.8,

        road
          ? 15.5
          : 7.5

      );


    racer.heading +=

      steer *

      2.35 *

      clamp(

        Math.abs(
          racer.speed
        ) /
        6.2,

        .28,
        1

      ) *

      dt *

      (
        racer.speed >=
        0

          ? 1
          : -1
      );

  }


  function driveBot(
    racer,
    dt
  ) {

    const [
      targetX,
      targetZ
    ] =
      WAYPOINTS[
        racer.next
      ];


    const error =
      normalizeAngle(

        Math.atan2(

          targetZ -
          racer.z,

          targetX -
          racer.x

        ) -

        racer.heading

      );


    racer.heading +=

      clamp(

        error,

        -2.05 * dt,

        2.05 * dt

      );


    const targetSpeed =

      12.2 *

      clamp(

        1 -
        Math.abs(
          error
        ) *
        .38,

        .48,
        1

      );


    racer.speed +=

      clamp(

        targetSpeed -
        racer.speed,

        -8.5 * dt,

        7.8 * dt

      );


    if (
      !isRoad(
        racer.x,
        racer.z
      )
    ) {

      racer.speed *=
        Math.pow(
          .95,
          dt * 60
        );

    }

  }


  function updateWaypoint(
    racer
  ) {

    if (
      racer.finished
    ) {

      return;

    }


    const [
      targetX,
      targetZ
    ] =
      WAYPOINTS[
        racer.next
      ];


    if (

      (
        targetX -
        racer.x
      ) ** 2 +

      (
        targetZ -
        racer.z
      ) ** 2 >

      13.7

    ) {

      return;

    }


    racer.next +=
      1;


    if (
      racer.next <
      WAYPOINTS.length
    ) {

      return;

    }


    racer.next =
      0;


    racer.lap +=
      1;


    if (
      racer.lap >
      LAPS
    ) {

      racer.finished =
        true;


      racer.finishTime =
        raceTime;


      racer.speed *=
        .7;

    }

  }


  function environment(
    racer,
    dt
  ) {

    racer.hit =
      Math.max(
        0,
        racer.hit -
        dt
      );


    racer.pad =
      Math.max(
        0,
        racer.pad -
        dt
      );


    racer.chaos =
      Math.min(
        100,
        racer.chaos +
        7 * dt
      );


    racer.x =
      clamp(
        racer.x,
        -29,
        29
      );


    racer.z =
      clamp(
        racer.z,
        -19,
        19
      );


    if (!racer.hit) {

      for (
        const [
          x,
          z
        ]
        of OBSTACLES
      ) {

        if (

          (
            racer.x -
            x
          ) ** 2 +

          (
            racer.z -
            z
          ) ** 2 <

          2.1

        ) {

          racer.speed *=
            .42;


          racer.heading +=

            racer.x >=
            x

              ? .3
              : -.3;


          racer.hit =
            .55;


          break;

        }

      }

    }


    if (!racer.pad) {

      for (
        const [
          x,
          z
        ]
        of BOOSTS
      ) {

        if (

          (
            racer.x -
            x
          ) ** 2 +

          (
            racer.z -
            z
          ) ** 2 <

          2.8

        ) {

          racer.speed =
            Math.min(

              19,

              racer.speed +
              4.4

            );


          racer.pad =
            .9;


          break;

        }

      }

    }

  }


  function stepRacer(
    racer,
    dt
  ) {

    if (
      !racer.finished
    ) {

      if (
        racer.player
      ) {

        drivePlayer(
          racer,
          dt
        );

      } else {

        driveBot(
          racer,
          dt
        );

      }

    } else {

      racer.speed *=
        Math.pow(
          .97,
          dt * 60
        );

    }


    racer.x +=

      Math.cos(
        racer.heading
      ) *

      racer.speed *
      dt;


    racer.z +=

      Math.sin(
        racer.heading
      ) *

      racer.speed *
      dt;


    environment(
      racer,
      dt
    );


    updateWaypoint(
      racer
    );

  }


  function collisions() {

    for (
      let a = 0;
      a < racers.length;
      a += 1
    ) {

      for (
        let b = a + 1;
        b < racers.length;
        b += 1
      ) {

        const first =
          racers[a];


        const second =
          racers[b];


        const dx =
          second.x -
          first.x;


        const dz =
          second.z -
          first.z;


        const distance =
          Math.hypot(
            dx,
            dz
          );


        if (
          !distance ||
          distance >=
          2.35
        ) {

          continue;

        }


        const normalX =
          dx /
          distance;


        const normalZ =
          dz /
          distance;


        const overlap =
          (
            2.35 -
            distance
          ) /
          2;


        first.x -=
          normalX *
          overlap;


        first.z -=
          normalZ *
          overlap;


        second.x +=
          normalX *
          overlap;


        second.z +=
          normalZ *
          overlap;


        first.speed *=
          .84;


        second.speed *=
          .84;

      }

    }

  }


  function progress(
    racer
  ) {

    if (
      racer.finished
    ) {

      return (

        1000000 -

        (
          racer.finishTime ||
          0
        )

      );

    }


    const [
      targetX,
      targetZ
    ] =
      WAYPOINTS[
        racer.next
      ];


    return (

      (
        racer.lap -
        1
      ) *

      WAYPOINTS.length *
      1000 +

      racer.next *
      1000 -

      Math.hypot(

        targetX -
        racer.x,

        targetZ -
        racer.z

      )

    );

  }


  function ranking() {

    return [
      ...racers
    ]
      .sort(
        (
          a,
          b
        ) =>

          progress(
            b
          ) -

          progress(
            a
          )
      );

  }


  function update(
    dt
  ) {

    if (
      phase ===
      "countdown"
    ) {

      countdown -=
        dt;


      if (
        countdown <=
        0
      ) {

        countdown =
          0;


        phase =
          "running";

      }


      return;

    }


    if (
      phase !==
      "running"
    ) {

      return;

    }


    raceTime +=
      dt;


    racers.forEach(
      racer => {

        stepRacer(
          racer,
          dt
        );

      }
    );


    collisions();


    if (
      getPlayer()
        ?.finished
    ) {

      phase =
        "finished";

    }

  }


  function updateVisuals(
    dt
  ) {

    if (
      phase ===
      "garage"
    ) {

      garageVehicleRoot
        .rotation
        .y +=

          dt *
          .55;

    }


    racers.forEach(
      racer => {

        racer.root
          .position
          .set(

            racer.x,

            .08,

            racer.z

          );


        racer.root
          .rotation
          .y =

            -racer.heading;


        const lean =

          racer.player

            ? (
                Number(
                  input(
                    "right"
                  )
                ) -

                Number(
                  input(
                    "left"
                  )
                )
              ) *
              -.08

            : 0;


        racer.root
          .rotation
          .z +=

            (
              lean -

              racer.root
                .rotation
                .z
            ) *

            Math.min(
              1,
              dt * 8
            );

      }
    );

  }


  function updateHud() {

    const hud =
      $(
        "#ccHud"
      );


    if (
      phase ===
      "garage"
    ) {

      hud.textContent =
        `GARAGE · ${getVehicle(selectedId).name}`;


      return;

    }


    if (
      phase ===
      "loading"
    ) {

      hud.textContent =
        "LOADING RACERS…";


      return;

    }


    if (
      phase ===
      "countdown"
    ) {

      hud.textContent =

        `СТАРТ ЧЕРЕЗ ${

          Math.max(
            1,
            Math.ceil(
              countdown
            )
          )

        }`;


      return;

    }


    const current =
      getPlayer();


    if (!current) {
      return;
    }


    const place =

      ranking()
        .findIndex(
          racer =>
            racer.id ===
            current.id
        ) +

      1;


    if (
      phase ===
      "finished"
    ) {

      hud.textContent =

        `ФИНИШ · ` +
        `МЕСТО ${place}/4 · ` +
        `${raceTime.toFixed(2)} c`;


      return;

    }


    hud.textContent =

      `КРУГ ${Math.min(current.lap, LAPS)}/${LAPS} · ` +

      `МЕСТО ${place}/4 · ` +

      `${Math.max(0, current.speed * 8).toFixed(0)} SPEED · ` +

      `CHAOS ${Math.round(current.chaos)} · ` +

      `${raceTime.toFixed(1)} c`;

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


    update(
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
   * =======================================================
   * CONTROLS
   * =======================================================
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


    window
      .addEventListener(
        "resize",
        resize,
        options
      );


    window
      .addEventListener(
        "keydown",
        event => {

          if (!active) {
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


          if (
            event.code ===
            "Escape"
          ) {

            hide();
            return;

          }


          if (
            event.code ===
              "Space" &&
            !event.repeat
          ) {

            chaos();

          }


          keys.add(
            event.code
          );

        },
        options
      );


    window
      .addEventListener(
        "keyup",
        event => {

          keys.delete(
            event.code
          );

        },
        options
      );


    window
      .addEventListener(
        "blur",
        () => {

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


          button
            .addEventListener(
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


    $(
      "#ccChaos"
    )
      .addEventListener(
        "click",
        chaos,
        options
      );


    $(
      "#ccRestart"
    )
      .addEventListener(
        "click",
        backToGarage,
        options
      );


    $(
      "#ccStart"
    )
      .addEventListener(
        "click",
        () => {

          void startRace();

        },
        options
      );

  }


  /*
   * =======================================================
   * SHOW / HIDE
   * =======================================================
   */

  function show() {

    makeUI();
    makeScene();


    if (active) {
      return;
    }


    active =
      true;


    phase =
      "garage";


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
              "#ccVoice"
            ),

          placement:
            "inline"

        }) ||
      null;


    worldRoot.visible =
      false;


    garageRoot.visible =
      true;


    $(
      "#ccGarage"
    )
      .hidden =
        false;


    $(
      "#ccControls"
    )
      .hidden =
        true;


    resize();


    lastTime =
      performance.now();


    frame =
      requestAnimationFrame(
        loop
      );


    void choose(
      selectedId
    );

  }


  function hide() {

    if (!active) {
      return;
    }


    active =
      false;


    garageToken +=
      1;


    cancelAnimationFrame(
      frame
    );


    controlsAbort
      ?.abort();


    controlsAbort =
      null;


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


    voicePanel
      ?.destroy();


    voicePanel =
      null;


    clearRacers();


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


  document
    .addEventListener(
      "lago:mini-game-open",
      event => {

        if (
          event.detail
            ?.game
            ?.id ===
          GAME_ID
        ) {

          show();

        }

      }
    );


  window.LAGO_CART_CHAOS =
    Object.freeze({

      version:
        VERSION,

      show,

      hide

    });

})();

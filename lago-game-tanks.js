import * as THREE from "three";

(() => {
  "use strict";

  const VERSION = 1;
  const GAME_ID = "lago-tanks";

  const MOVE_SPEED = 4.2;
  const TURN_SPEED = 2.45;
  const ARENA_LIMIT = 10;

  let overlay = null;
  let canvas = null;

  let renderer = null;
  let scene = null;
  let camera = null;
  let clock = null;
  let resizeObserver = null;

  let tank = null;
  let turret = null;
  let commanderPivot = null;

  let animationFrame = 0;
  let phase = "idle";
  let context = null;

  const keys =
    new Set();

  const mobile = {
    forward: false,
    back: false,
    left: false,
    right: false
  };


  function runtime() {
    return window.LAGO_MINIGAMES || null;
  }


  function el(id) {

    return overlay
      ?.querySelector(
        `#${id}`
      ) || null;

  }


  function material(
    color,
    roughness = .72,
    metalness = .08
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

        material(color)

      );


    mesh.castShadow =
      true;

    mesh.receiveShadow =
      true;


    return mesh;

  }


  function createUI() {

    if (overlay) {
      return;
    }


    const style =
      document.createElement(
        "style"
      );


    style.textContent = `

      #lagoTanksGame {
        position: fixed;
        inset: 0;
        z-index: 22000;

        display: none;

        padding:
          calc(10px + env(safe-area-inset-top))
          10px
          calc(10px + env(safe-area-inset-bottom));

        background: #07090c;
        color: #fff;

        font-family:
          Inter,
          system-ui,
          sans-serif;
      }


      #lagoTanksGame.active {
        display: block;
      }


      .lt-shell {
        width:
          min(1280px,100%);

        height:
          calc(
            100dvh -
            20px -
            env(safe-area-inset-top) -
            env(safe-area-inset-bottom)
          );

        margin: auto;

        display: flex;
        flex-direction: column;

        min-height: 0;
      }


      .lt-head {
        display: flex;

        align-items:
          flex-start;

        justify-content:
          space-between;

        gap: 12px;
      }


      .lt-title {
        font-size:
          clamp(
            32px,
            5vw,
            58px
          );

        font-weight: 1000;
        line-height: .92;
        letter-spacing: -.055em;
      }


      .lt-sub {
        margin-top: 5px;

        color:
          rgba(
            255,
            255,
            255,
            .42
          );

        font-size: 9px;
        font-weight: 900;
      }


      .lt-close {
        width: 44px;
        height: 44px;

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

        border-radius: 50%;

        background:
          rgba(
            255,
            255,
            255,
            .06
          );

        color: #fff;

        cursor: pointer;
      }


      .lt-stage {
        position: relative;

        flex: 1;
        min-height: 0;

        margin-top: 10px;

        overflow: hidden;

        border:
          1px solid
          rgba(
            255,
            255,
            255,
            .08
          );

        border-radius: 20px;

        background: #11171c;
      }


      #lagoTanksCanvas {
        position: absolute;
        inset: 0;

        width: 100%;
        height: 100%;

        display: block;

        touch-action: none;
      }


      .lt-status {
        position: absolute;

        top: 12px;
        left: 50%;

        z-index: 20;

        transform:
          translateX(-50%);

        padding:
          8px 12px;

        border-radius: 999px;

        background:
          rgba(
            4,
            7,
            9,
            .7
          );

        color: #ccff00;

        font-size: 10px;
        font-weight: 1000;

        white-space: nowrap;

        pointer-events: none;

        backdrop-filter:
          blur(8px);
      }


      .lt-mobile {
        position: absolute;

        left: 14px;
        bottom: 14px;

        z-index: 30;

        display: none;

        grid-template-columns:
          repeat(3,48px);

        grid-template-rows:
          repeat(2,48px);

        gap: 5px;
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

        border-radius: 13px;

        background:
          rgba(
            7,
            12,
            15,
            .78
          );

        color: #fff;

        font-size: 18px;
        font-weight: 1000;

        touch-action: none;
        user-select: none;
      }


      .lt-mobile
      [data-control="forward"] {
        grid-column: 2;
        grid-row: 1;
      }


      .lt-mobile
      [data-control="left"] {
        grid-column: 1;
        grid-row: 2;
      }


      .lt-mobile
      [data-control="back"] {
        grid-column: 2;
        grid-row: 2;
      }


      .lt-mobile
      [data-control="right"] {
        grid-column: 3;
        grid-row: 2;
      }


      .lt-panel {
        position: absolute;
        inset: 0;

        z-index: 80;

        display: grid;
        place-items: center;

        padding: 20px;

        background:
          rgba(
            5,
            7,
            9,
            .82
          );

        backdrop-filter:
          blur(12px);
      }


      .lt-panel[hidden] {
        display:
          none !important;
      }


      .lt-card {
        width:
          min(470px,100%);

        padding: 24px;

        border:
          1px solid
          rgba(
            255,
            255,
            255,
            .1
          );

        border-radius: 22px;

        background: #10151a;

        text-align: center;
      }


      .lt-card-title {
        font-size: 28px;
        font-weight: 1000;
      }


      .lt-card-copy {
        margin-top: 10px;

        color:
          rgba(
            255,
            255,
            255,
            .56
          );

        font-size: 11px;
        line-height: 1.5;
      }


      .lt-actions {
        display: grid;

        gap: 8px;

        margin-top: 18px;
      }


      .lt-actions button {
        min-height: 48px;

        border: 0;
        border-radius: 12px;

        background: #ccff00;
        color: #130614;

        font-weight: 1000;

        cursor: pointer;
      }


      .lt-actions
      .secondary {
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

        color: #fff;
      }


      @media (
        max-width: 760px
      ) {

        .lt-title {
          font-size: 34px;
        }


        .lt-mobile {
          display: grid;
        }


        .lt-status {
          max-width: 75%;

          white-space: normal;
          text-align: center;

          font-size: 8px;
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
      "lagoTanksGame";


    overlay.innerHTML = `

      <div class="lt-shell">

        <header class="lt-head">

          <div>

            <div class="lt-title">
              LAGO TANKS
            </div>

            <div class="lt-sub">
              T1 · 3D MOVEMENT PROTOTYPE
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
            WASD / ARROWS · DRIVE THE TANK
          </div>


          <div class="lt-mobile">

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


          <section
            class="lt-panel"
            id="ltPanel"
          >

            <div class="lt-card">

              <div class="lt-card-title">
                LAGO TANKS
              </div>


              <div
                class="lt-card-copy"
                id="ltPanelCopy"
              >
                First playable checkpoint:
                tank movement, 3D arena,
                selected Lago character
                mounted as the commander.
              </div>


              <div class="lt-actions">

                <button
                  id="ltPrimary"
                  type="button"
                >
                  START SOLO
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


    document.body.appendChild(
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


  function bindControls() {

    window.addEventListener(
      "keydown",
      event => {

        keys.add(
          event.code
        );

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
              ] = true;


              button
                .setPointerCapture
                ?.(event.pointerId);

            };


          const release =
            event => {

              mobile[
                control
              ] = false;


              try {

                button
                  .releasePointerCapture
                  ?.(event?.pointerId);

              } catch (_) {}

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

        }
      );

  }


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
        0x11171c
      );


    scene.fog =
      new THREE.Fog(
        0x11171c,
        18,
        34
      );


    camera =
      new THREE
        .PerspectiveCamera(
          48,
          1,
          .1,
          70
        );


    camera.position.set(
      0,
      12,
      11
    );


    scene.add(
      new THREE
        .HemisphereLight(
          0xe9f3ff,
          0x172018,
          2.4
        )
    );


    const sun =
      new THREE
        .DirectionalLight(
          0xffffff,
          3
        );


    sun.position.set(
      -6,
      12,
      8
    );


    sun.castShadow =
      true;


    sun.shadow
      .mapSize
      .set(
        1024,
        1024
      );


    scene.add(
      sun
    );


    clock =
      new THREE.Clock();


    buildArena();

    buildTank();


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


  function buildArena() {

    const ground =
      new THREE.Mesh(

        new THREE
          .PlaneGeometry(
            24,
            24
          ),

        material(
          0x526649,
          .98
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


    const wallColor =
      0x73796f;


    [
      [0, .7, -11.2, 23, 1.4, .6],
      [0, .7, 11.2, 23, 1.4, .6],
      [-11.2, .7, 0, .6, 1.4, 23],
      [11.2, .7, 0, .6, 1.4, 23]
    ].forEach(
      values => {

        const wall =
          box(
            values[3],
            values[4],
            values[5],
            wallColor
          );


        wall.position.set(
          values[0],
          values[1],
          values[2]
        );


        scene.add(
          wall
        );

      }
    );


    [
      [-4, -3],
      [4, -4],
      [-3, 4],
      [4, 3],
      [0, 0]
    ].forEach(
      (
        [
          x,
          z
        ]
      ) => {

        const crate =
          box(
            1.8,
            1.5,
            1.8,
            0x806844
          );


        crate.position.set(
          x,
          .75,
          z
        );


        scene.add(
          crate
        );

      }
    );

  }


  function buildTank() {

    tank =
      new THREE.Group();


    const body =
      box(
        1.7,
        .48,
        2.25,
        0x4d8f68
      );


    body.position.y =
      .46;


    tank.add(
      body
    );


    [
      -.9,
      .9
    ].forEach(
      x => {

        const track =
          box(
            .32,
            .32,
            2.35,
            0x1b2023
          );


        track.position.set(
          x,
          .31,
          0
        );


        tank.add(
          track
        );

      }
    );


    turret =
      new THREE.Group();


    turret.position.y =
      .82;


    tank.add(
      turret
    );


    const turretBody =
      new THREE.Mesh(

        new THREE
          .CylinderGeometry(
            .57,
            .7,
            .38,
            24
          ),

        material(
          0xccff00,
          .62,
          .12
        )

      );


    turretBody.position.y =
      .12;


    turretBody.castShadow =
      true;


    turret.add(
      turretBody
    );


    const barrel =
      box(
        .17,
        .17,
        1.45,
        0x262c30
      );


    barrel.position.set(
      0,
      .16,
      -.92
    );


    turret.add(
      barrel
    );


    commanderPivot =
      new THREE.Group();


    commanderPivot.position.set(
      0,
      1.28,
      .38
    );


    tank.add(
      commanderPivot
    );


    tank.position.set(
      0,
      0,
      4
    );


    scene.add(
      tank
    );

  }


  async function mountCommander() {

    if (
      !commanderPivot
    ) {
      return;
    }


    commanderPivot.clear();


    const modelUrl =
      String(
        context
          ?.characterModel3d ||
        ""
      ).trim();


    const api =
      window.LAGO_CHARACTER_3D;


    if (
      !modelUrl ||
      !api ||
      typeof api.cloneModel !==
        "function"
    ) {

      console.warn(
        "[LAGO TANKS] Commander GLB unavailable"
      );

      return;

    }


    const model =
      await api.cloneModel(
        modelUrl
      );


    model.scale
      .multiplyScalar(
        .30
      );


    model.updateMatrixWorld(
      true
    );


    const bounds =
      new THREE.Box3()
        .setFromObject(
          model
        );


    const center =
      bounds.getCenter(
        new THREE.Vector3()
      );


    model.position.x -=
      center.x;


    model.position.z -=
      center.z;


    model.position.y -=
      bounds.min.y;


    model.traverse(
      child => {

        if (!child.isMesh) {
          return;
        }


        child.castShadow =
          true;


        child.receiveShadow =
          true;

      }
    );


    commanderPivot.add(
      model
    );

  }


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


    renderer.setPixelRatio(

      Math.min(

        window.devicePixelRatio ||
        1,

        width < 760
          ? 1.15
          : 1.4

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


    camera.fov =
      width < 760
        ? 56
        : 48;


    camera
      .updateProjectionMatrix();

  }


  function updateTank(
    dt
  ) {

    if (!tank) {
      return;
    }


    const forward =

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

          ? -.7
          : 0;


    const turn =

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


    tank.rotation.y +=
      turn *
      TURN_SPEED *
      dt;


    const direction =
      new THREE.Vector3(
        0,
        0,
        -1
      )
        .applyQuaternion(
          tank.quaternion
        );


    tank.position
      .addScaledVector(

        direction,

        forward *
        MOVE_SPEED *
        dt

      );


    tank.position.x =
      THREE.MathUtils.clamp(
        tank.position.x,
        -ARENA_LIMIT,
        ARENA_LIMIT
      );


    tank.position.z =
      THREE.MathUtils.clamp(
        tank.position.z,
        -ARENA_LIMIT,
        ARENA_LIMIT
      );

  }


  function updateCamera() {

    if (
      !tank ||
      !camera
    ) {
      return;
    }


    const compact =
      window.innerWidth <
      760;


    const desired =
      new THREE.Vector3(

        tank.position.x,

        compact
          ? 15
          : 12,

        tank.position.z +
        (
          compact
            ? 12
            : 10
        )

      );


    camera.position.lerp(
      desired,
      .08
    );


    camera.lookAt(
      tank.position.x,
      0,
      tank.position.z
    );

  }


  function loop() {

    if (
      phase !==
      "running"
    ) {
      return;
    }


    const dt =
      Math.min(
        .04,
        clock.getDelta()
      );


    updateTank(
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


  async function startGame() {

    if (
      phase ===
      "running"
    ) {
      return;
    }


    phase =
      "loading";


    el(
      "ltPanelCopy"
    ).textContent =
      "Loading commander GLB…";


    try {

      await mountCommander();


      el(
        "ltPanel"
      ).hidden =
        true;


      el(
        "ltStatus"
      ).textContent =
        window.innerWidth < 760

          ? "USE THE D-PAD TO DRIVE"

          : "WASD / ARROWS · DRIVE THE TANK";


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
        "Tank could not start. Retry.";

    }

  }


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


    overlay.classList.add(
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
      "T1: drive the tank around the 3D arena. Your selected GLB character is mounted on the tank as the commander.";


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


    keys.clear();


    Object.keys(
      mobile
    ).forEach(
      key => {

        mobile[key] =
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


  window.LAGO_TANKS =
    Object.freeze({

      version:
        VERSION,

      show,
      hide

    });

})();

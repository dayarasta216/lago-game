
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

(() => {
  "use strict";

  const VERSION = 1;
  const GAME_ID = "lago-moto";

  const MODEL_URL =
    "./assets/model/game/moto/red-dirt-bike.glb?v=1";

  const PREVIEW_URL =
    "./assets/model/game/moto/red-dirt-bike.png?v=1";

  const FINISH_X = 340;
  const CHECKPOINTS = [85, 170, 255];
  const ROCKS = [44, 112, 153, 205, 243, 292];

  let overlay;
  let stage;
  let canvas;
  let renderer;
  let scene;
  let camera;
  let bikeRoot;

  let voicePanel = null;
  let modelPromise = null;
  let modelReady = false;

  let animationFrame = 0;
  let controlsAbort = null;
  let lastTime = 0;
  let accumulator = 0;
  let active = false;

  const keys = new Set();

  const touch = {
    gas: false,
    brake: false,
    left: false,
    right: false
  };

  const state = {
    x: 4,
    y: 0,
    vx: 0,
    vy: 0,
    pitch: 0,
    grounded: true,
    playing: false,
    crashed: false,
    finished: false,
    elapsed: 0,
    checkpoint: 4
  };

  /*
   * TERRAIN
   */

  function terrain(x) {
    return (
      0.48 * Math.sin(x * 0.11) +
      0.83 * Math.sin(x * 0.042) +
      0.25 * Math.sin(x * 0.24)
    );
  }

  function terrainAngle(x) {
    return Math.atan2(
      terrain(x + 1) - terrain(x - 1),
      2
    );
  }

  /*
   * INTERFACE
   */

  function makeUI() {
    if (overlay) return;

    const style = document.createElement("style");

    style.textContent = `
      #lagoMoto {
        position: fixed;
        inset: 0;
        z-index: 23000;
        display: none;
        padding:
          calc(10px + env(safe-area-inset-top))
          10px
          calc(10px + env(safe-area-inset-bottom));
        background: #101722;
        color: #fff;
        font: 700 13px system-ui, sans-serif;
      }

      #lagoMoto.active {
        display: flex;
        flex-direction: column;
        gap: 9px;
      }

      .lm-head {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: space-between;
        gap: 9px;
      }

      .lm-head h2 {
        margin: 0;
        font-size: clamp(23px, 5vw, 38px);
      }

      .lm-tools {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 8px;
      }

      #lmStage {
        flex: 1;
        min-height: 0;
        position: relative;
        border: 1px solid #ffffff24;
        border-radius: 14px;
        overflow: hidden;
        background: #a4cad8;
      }

      #lmCanvas {
        display: block;
        width: 100%;
        height: 100%;
        touch-action: none;
      }

      #lmHud {
        position: absolute;
        top: 9px;
        left: 10px;
        padding: 7px 10px;
        background: #101a25d9;
        border-radius: 8px;
        pointer-events: none;
        font-size: 12px;
      }

      .lm-controls {
        display: flex;
        justify-content: space-between;
        gap: 8px;
      }

      .lm-group {
        display: flex;
        flex-wrap: wrap;
        gap: 7px;
      }

      .lm-button {
        border: 1px solid #ffffff45;
        border-radius: 10px;
        background: #30475c;
        color: white;
        min-height: 43px;
        padding: 9px 13px;
        font: 800 12px system-ui;
        cursor: pointer;
        touch-action: none;
        user-select: none;
      }

      .lm-button:disabled {
        opacity: .45;
        cursor: default;
      }

      .lm-main {
        background: #c8ec42;
        color: #182015;
      }

      .lm-help {
        font-size: 11px;
        opacity: .7;
        text-align: center;
      }

      #lmVoice {
        position: relative;
      }

      @media (max-width: 600px) {
        .lm-button {
          padding: 9px;
          min-width: 49px;
        }

        .lm-help {
          display: none;
        }

        #lmVoice .lago-voice-panel {
          max-width: 205px;
        }
      }
    `;

    document.head.appendChild(style);

    overlay = document.createElement("section");
    overlay.id = "lagoMoto";

    overlay.innerHTML = `
      <header class="lm-head">
        <h2>
          LAGO MOTO
          <small style="font-size:11px;opacity:.65">
            2D · RED DIRT BIKE
          </small>
        </h2>

        <div class="lm-tools">
          <div id="lmVoice"></div>

          <button
            type="button"
            class="lm-button"
            id="lmClose"
          >
            ЗАКРЫТЬ ×
          </button>
        </div>
      </header>

      <div id="lmStage">
        <canvas id="lmCanvas"></canvas>

        <div id="lmHud" role="status">
          Загрузка модели…
        </div>
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
        W / ↑ — газ · S / ↓ — тормоз ·
        A / D — наклон · Space — прыжок
      </div>
    `;

    document.body.appendChild(overlay);

    stage = overlay.querySelector("#lmStage");
    canvas = overlay.querySelector("#lmCanvas");

    overlay
      .querySelector("#lmClose")
      .addEventListener("click", hide);
  }

  /*
   * TRACK / SCENE
   */

  function makeScene() {
    if (renderer) return;

    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false
    });

    renderer.setPixelRatio(
      Math.min(window.devicePixelRatio || 1, 1.5)
    );

    renderer.outputColorSpace = THREE.SRGBColorSpace;

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xa7d4e5);

    camera = new THREE.OrthographicCamera(
      -10, 10, 7, -7, .1, 150
    );

    camera.position.set(4, 5, 25);

    scene.add(
      new THREE.HemisphereLight(
        0xffffff,
        0x6b7452,
        2
      )
    );

    const sun = new THREE.DirectionalLight(
      0xffffff,
      2
    );

    sun.position.set(-8, 18, 15);
    scene.add(sun);

    const contour = new THREE.Shape();

    contour.moveTo(-15, -12);

    for (
      let x = -15;
      x <= FINISH_X + 20;
      x += .35
    ) {
      contour.lineTo(x, terrain(x));
    }

    contour.lineTo(FINISH_X + 20, -12);
    contour.closePath();

    scene.add(
      new THREE.Mesh(
        new THREE.ShapeGeometry(contour),
        new THREE.MeshLambertMaterial({
          color: 0x7b674a,
          side: THREE.DoubleSide
        })
      )
    );

    const path = [];

    for (
      let x = -15;
      x <= FINISH_X + 20;
      x += .25
    ) {
      path.push(
        new THREE.Vector3(
          x,
          terrain(x) + .07,
          -.02
        )
      );
    }

    scene.add(
      new THREE.Line(
        new THREE.BufferGeometry()
          .setFromPoints(path),

        new THREE.LineBasicMaterial({
          color: 0xb8a078
        })
      )
    );

    for (const x of ROCKS) {
      const rock = new THREE.Mesh(
        new THREE.DodecahedronGeometry(.63, 0),

        new THREE.MeshLambertMaterial({
          color: 0x626f73
        })
      );

      rock.scale.set(1.35, .7, .55);

      rock.position.set(
        x,
        terrain(x) + .37,
        -.25
      );

      scene.add(rock);
    }

    for (const x of [...CHECKPOINTS, FINISH_X]) {
      const post = new THREE.Mesh(
        new THREE.BoxGeometry(.09, 3, .09),

        new THREE.MeshBasicMaterial({
          color: 0xf6f6f1
        })
      );

      post.position.set(
        x,
        terrain(x) + 1.5,
        -.5
      );

      scene.add(post);

      const flag = new THREE.Mesh(
        new THREE.PlaneGeometry(1.5, .64),

        new THREE.MeshBasicMaterial({
          color: x === FINISH_X
            ? 0xccff00
            : 0xff744c,

          side: THREE.DoubleSide
        })
      );

      flag.position.set(
        x + .75,
        terrain(x) + 2.7,
        -.5
      );

      scene.add(flag);
    }

    bikeRoot = new THREE.Group();
    scene.add(bikeRoot);

    resize();
  }

  /*
   * MOTORCYCLE MODEL
   */

  function loadBike() {
    if (modelPromise) return modelPromise;

    const loader = new GLTFLoader();

    modelPromise = new Promise(resolve => {
      loader.load(
        MODEL_URL,

        gltf => {
          const model = gltf.scene;

          const bounds = new THREE.Box3()
            .setFromObject(model);

          const center = bounds.getCenter(
            new THREE.Vector3()
          );

          const size = bounds.getSize(
            new THREE.Vector3()
          );

          if (
            !Number.isFinite(size.x) ||
            size.x < .001
          ) {
            resolve(false);
            return;
          }

          const scale = 3.35 / size.x;

          model.scale.setScalar(scale);

          model.position.set(
            -center.x * scale,
            -bounds.min.y * scale,
            -center.z * scale
          );

          bikeRoot.add(model);

          modelReady = true;
          resolve(true);
        },

        undefined,

        () => {
          // If GLB is not hosted yet, try the
          // supplied PNG as an interim 2D asset.

          new THREE.TextureLoader().load(
            PREVIEW_URL,

            texture => {
              texture.colorSpace =
                THREE.SRGBColorSpace;

              const preview = new THREE.Mesh(
                new THREE.PlaneGeometry(
                  3.35,
                  3.35
                ),

                new THREE.MeshBasicMaterial({
                  map: texture,
                  transparent: true,
                  side: THREE.DoubleSide
                })
              );

              preview.position.y = 1.3;

              bikeRoot.add(preview);

              modelReady = true;
              resolve(true);
            },

            undefined,

            () => resolve(false)
          );
        }
      );
    });

    return modelPromise;
  }

  /*
   * CAMERA
   */

  function resize() {
    if (!renderer || !stage) return;

    const width = Math.max(
      1,
      stage.clientWidth
    );

    const height = Math.max(
      1,
      stage.clientHeight
    );

    renderer.setSize(width, height, false);

    const aspect = width / height;

    const spanX = Math.max(
      15,
      12 * aspect
    );

    const spanY = spanX / aspect;

    camera.left = -spanX / 2;
    camera.right = spanX / 2;
    camera.top = spanY / 2;
    camera.bottom = -spanY / 2;

    camera.updateProjectionMatrix();
  }

  /*
   * MOTORCYCLE PHYSICS
   */

  function jump() {
    if (
      !state.playing ||
      !state.grounded
    ) {
      return;
    }

    state.vy = 10;
    state.grounded = false;
    state.y += .05;
  }

  function reset() {
    if (!modelReady) return;

    Object.assign(state, {
      x: 4,
      y: terrain(4) + .15,
      vx: 0,
      vy: 0,
      pitch: 0,
      grounded: true,
      playing: true,
      crashed: false,
      finished: false,
      elapsed: 0,
      checkpoint: 4
    });

    bikeRoot.position.set(
      state.x,
      state.y,
      0
    );

    bikeRoot.rotation.z = 0;

    overlay.querySelector("#lmRestart")
      .textContent = "ЗАНОВО";
  }

  function input(name) {
    if (name === "gas") {
      return touch.gas ||
        keys.has("KeyW") ||
        keys.has("ArrowUp");
    }

    if (name === "brake") {
      return touch.brake ||
        keys.has("KeyS") ||
        keys.has("ArrowDown");
    }

    if (name === "left") {
      return touch.left ||
        keys.has("KeyA") ||
        keys.has("ArrowLeft");
    }

    if (name === "right") {
      return touch.right ||
        keys.has("KeyD") ||
        keys.has("ArrowRight");
    }

    return false;
  }

  function step(dt) {
    if (!state.playing) return;

    state.elapsed += dt;

    if (input("gas")) {
      state.vx += (
        state.grounded ? 11 : 4
      ) * dt;
    }

    if (input("brake")) {
      state.vx -= (
        state.grounded ? 13 : 3
      ) * dt;
    }

    if (
      !input("gas") &&
      !input("brake")
    ) {
      state.vx *= state.grounded
        ? .987
        : .998;
    }

    state.vx = THREE.MathUtils.clamp(
      state.vx,
      -4,
      17
    );

    state.x = Math.max(
      2,
      state.x + state.vx * dt
    );

    state.vy -= 24 * dt;
    state.y += state.vy * dt;

    const ground = Math.max(
      terrain(state.x - 1.05),
      terrain(state.x + 1.05)
    );

    const slope = terrainAngle(state.x);

    const tilt =
      Number(input("right")) -
      Number(input("left"));

    if (
      state.y <= ground + .05 &&
      state.vy <= 0
    ) {
      const landingAngle = Math.abs(
        Math.atan2(
          Math.sin(state.pitch - slope),
          Math.cos(state.pitch - slope)
        )
      );

      if (
        !state.grounded &&
        landingAngle > 1.20 &&
        Math.abs(state.vx) > 4
      ) {
        state.crashed = true;
        state.playing = false;
      }

      state.y = ground + .05;
      state.vy = 0;
      state.grounded = true;

      state.pitch = THREE.MathUtils.lerp(
        state.pitch,
        slope + tilt * .3,
        Math.min(1, dt * 9)
      );
    } else {
      state.grounded = false;

      state.pitch +=
        tilt * dt * 2.7;
    }

    for (const x of ROCKS) {
      if (
        Math.abs(state.x - x) < 1.05 &&
        state.y < terrain(x) + 1.20 &&
        Math.abs(state.vx) > 2
      ) {
        state.crashed = true;
        state.playing = false;
        break;
      }
    }

    for (const x of CHECKPOINTS) {
      if (state.x >= x) {
        state.checkpoint = Math.max(
          state.checkpoint,
          x
        );
      }
    }

    if (state.x >= FINISH_X) {
      state.finished = true;
      state.playing = false;
    }
  }

  /*
   * MAIN LOOP
   */

  function draw(now) {
    if (!active) return;

    const dt = Math.min(
      .05,
      Math.max(
        0,
        (now - lastTime) / 1000
      )
    );

    lastTime = now;
    accumulator += dt;

    while (accumulator >= 1 / 60) {
      step(1 / 60);
      accumulator -= 1 / 60;
    }

    bikeRoot.position.set(
      state.x,
      state.y,
      0
    );

    bikeRoot.rotation.z = state.pitch;

    const desiredX = state.x + 4;

    const desiredY =
      terrain(state.x) + 2.4;

    camera.position.x +=
      (desiredX - camera.position.x) * .1;

    camera.position.y +=
      (desiredY - camera.position.y) * .1;

    camera.lookAt(
      camera.position.x,
      camera.position.y,
      0
    );

    renderer.render(scene, camera);

    const title = state.finished
      ? "ФИНИШ"
      : state.crashed
        ? "ПАДЕНИЕ"
        : state.playing
          ? "ГОНКА"
          : "ГОТОВ К СТАРТУ";

    overlay.querySelector("#lmHud")
      .textContent =
        `${title} · ` +
        `${Math.round(state.x / FINISH_X * 100)}% · ` +
        `${state.elapsed.toFixed(1)} с · ` +
        `${Math.abs(state.vx).toFixed(1)} м/с`;

    animationFrame = requestAnimationFrame(draw);
  }

  /*
   * DESKTOP / MOBILE CONTROLS
   */

  function bindControls() {
    controlsAbort?.abort();

    controlsAbort = new AbortController();

    const options = {
      signal: controlsAbort.signal
    };

    window.addEventListener(
      "resize",
      resize,
      options
    );

    window.addEventListener(
      "keydown",
      event => {
        if (!active) return;

        if (
          [
            "ArrowUp",
            "ArrowDown",
            "ArrowLeft",
            "ArrowRight",
            "Space"
          ].includes(event.code)
        ) {
          event.preventDefault();
        }

        keys.add(event.code);

        if (
          event.code === "Space" &&
          !event.repeat
        ) {
          jump();
        }
      },
      options
    );

    window.addEventListener(
      "keyup",
      event => keys.delete(event.code),
      options
    );

    window.addEventListener(
      "blur",
      () => {
        keys.clear();

        Object.keys(touch).forEach(
          key => {
            touch[key] = false;
          }
        );
      },
      options
    );

    overlay
      .querySelectorAll("[data-hold]")
      .forEach(button => {
        const name = button.dataset.hold;

        const release = () => {
          touch[name] = false;
        };

        button.addEventListener(
          "pointerdown",
          event => {
            event.preventDefault();

            touch[name] = true;

            button.setPointerCapture?.(
              event.pointerId
            );
          },
          options
        );

        for (
          const type of [
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
      });

    overlay
      .querySelector("#lmJump")
      .addEventListener(
        "click",
        jump,
        options
      );

    overlay
      .querySelector("#lmRestart")
      .addEventListener(
        "click",
        reset,
        options
      );
  }

  /*
   * OPEN / CLOSE
   */

  async function show() {
    makeUI();
    makeScene();

    if (active) return;

    active = true;

    overlay.classList.add("active");

    bindControls();
    resize();

    voicePanel =
      window.LAGO_GAME_VOICE?.createPanel({
        gameId: GAME_ID,
        mount: overlay.querySelector("#lmVoice"),
        placement: "inline"
      }) || null;

    state.y = terrain(state.x) + .05;

    lastTime = performance.now();

    animationFrame =
      requestAnimationFrame(draw);

    const ok = await loadBike();

    if (!active) return;

    const button =
      overlay.querySelector("#lmRestart");

    button.disabled = !ok;

    button.textContent = ok
      ? "СТАРТ"
      : "МОДЕЛЬ НЕ НАЙДЕНА";

    if (!ok) {
      overlay.querySelector("#lmHud")
        .textContent =
          "Загрузите red-dirt-bike.glb " +
          "или red-dirt-bike.png " +
          "в assets/model/game/moto/";
    }
  }

  function hide() {
    if (!active) return;

    active = false;
    state.playing = false;

    cancelAnimationFrame(animationFrame);

    controlsAbort?.abort();
    controlsAbort = null;

    keys.clear();

    Object.keys(touch).forEach(
      key => {
        touch[key] = false;
      }
    );

    voicePanel?.destroy();
    voicePanel = null;

    overlay.classList.remove("active");
  }

  document.addEventListener(
    "lago:mini-game-open",
    event => {
      if (event.detail?.game?.id === GAME_ID) {
        void show();
      }
    }
  );

  window.LAGO_MOTO = Object.freeze({
    version: VERSION,
    show,
    hide
  });
})();

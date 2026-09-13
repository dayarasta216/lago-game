import * as THREE from "three";

import {
  GLTFLoader
} from "three/addons/loaders/GLTFLoader.js";


(() => {
  "use strict";


  const VERSION =
    7;


  const BASE_LAGO_MODEL =
    "./assets/model/lago.glb?v=4";


  const BASE_IDS =
    new Set([
      "default",
      "lago"
    ]);


  /*
   * Source GLB:
   *
   * X = width
   * Y = depth
   * Z = height
   */
  const CHARACTER_ROTATION_X =
    -Math.PI /
    2;


  const loader =
    new GLTFLoader();


  /*
   * Parsed normalized models.
   */
  const modelCache =
    new Map();


  /*
   * Prevent same GLB from being loaded
   * several times simultaneously.
   */
  const modelPromiseCache =
    new Map();


  /*
   * =========================================================
   * MAIN RENDERER
   * =========================================================
   */


  let canvas =
    null;


  let renderer =
    null;


  let scene =
    null;


  let camera =
    null;


  let holder =
    null;


  let resizeObserver =
    null;


  let observedHost =
    null;


  let activeModel =
    null;


  let activeModelUrl =
    "";


  let requestedModelUrl =
    "";


  let requestNonce =
    0;


  let tapKick =
    0;


  /*
   * =========================================================
   * ONE SHARED PREVIEW RENDERER
   * =========================================================
   */


  let previewRenderer =
    null;


  let previewScene =
    null;


  let previewCamera =
    null;


  let previewHolder =
    null;


  const previewQueue =
    [];


  let previewBusy =
    false;


  /*
   * =========================================================
   * STATE
   * =========================================================
   */


  function selectedId() {

    const accountState =
      window.LAGO_ACCOUNT
        ?.getState
        ?.();


    if (
      accountState
        ?.selectedSkin
    ) {

      return String(
        accountState
          .selectedSkin
      );

    }


    return String(
      window.LAGO
        ?.getState
        ?.()
        ?.selectedSkin ||
      "default"
    );

  }


  function image() {

    return document
      .getElementById(
        "snail"
      );

  }


  function area() {

    return (
      document.getElementById(
        "modernSnailArea"
      ) ||
      image()
        ?.parentElement ||
      null
    );

  }


  function resolveTarget() {

    const id =
      selectedId();


    if (
      BASE_IDS.has(
        id
      )
    ) {

      return {

        id:
          "lago",

        name:
          "LAGO",

        url:
          BASE_LAGO_MODEL

      };

    }


    const character =
      window.LAGO_CHARACTERS
        ?.getById
        ?.(
          id
        );


    if (
      character
        ?.model3d
    ) {

      return {

        id:
          character.id,

        name:
          character.name,

        url:
          character.model3d

      };

    }


    /*
     * Lago skin without its own GLB.
     */
    return null;

  }


  /*
   * =========================================================
   * MODEL LOADING
   * =========================================================
   */


  function normalizeModel(
    object
  ) {

    object.rotation.set(
      CHARACTER_ROTATION_X,
      0,
      0
    );


    object.position.set(
      0,
      0,
      0
    );


    object.scale.set(
      1,
      1,
      1
    );


    object.updateMatrixWorld(
      true
    );


    const initialBox =
      new THREE.Box3()
        .setFromObject(
          object
        );


    const initialSize =
      initialBox.getSize(
        new THREE.Vector3()
      );


    const largest =
      Math.max(
        initialSize.x,
        initialSize.y,
        initialSize.z,
        0.001
      );


    const targetSize =
      2.35;


    const scale =
      targetSize /
      largest;


    object.scale.setScalar(
      scale
    );


    object.updateMatrixWorld(
      true
    );


    const scaledBox =
      new THREE.Box3()
        .setFromObject(
          object
        );


    const center =
      scaledBox.getCenter(
        new THREE.Vector3()
      );


    object.position.x -=
      center.x;


    object.position.y -=
      center.y;


    object.position.z -=
      center.z;


    object.position.y +=
      0.04;


    object.updateMatrixWorld(
      true
    );


    /*
     * Models are essentially static game characters.
     * Disable unnecessary automatic matrix work
     * inside individual meshes.
     */
    object.traverse(
      child => {

        if (
          child.isMesh
        ) {

          child.frustumCulled =
            true;

        }

      }
    );

  }


  function getTemplate(
    modelUrl
  ) {

    const key =
      String(
        modelUrl ||
        ""
      ).trim();


    if (
      !key
    ) {

      return Promise.reject(
        new Error(
          "Missing GLB URL"
        )
      );

    }


    if (
      modelCache.has(
        key
      )
    ) {

      return Promise.resolve(
        modelCache.get(
          key
        )
      );

    }


    if (
      modelPromiseCache.has(
        key
      )
    ) {

      return modelPromiseCache.get(
        key
      );

    }


    const promise =
      new Promise(
        (
          resolve,
          reject
        ) => {

          loader.load(

            key,


            gltf => {

              try {

                const template =
                  gltf.scene;


                normalizeModel(
                  template
                );


                modelCache.set(
                  key,
                  template
                );


                modelPromiseCache.delete(
                  key
                );


                resolve(
                  template
                );

              } catch (
                error
              ) {

                modelPromiseCache.delete(
                  key
                );


                reject(
                  error
                );

              }

            },


            undefined,


            error => {

              modelPromiseCache.delete(
                key
              );


              reject(
                error
              );

            }

          );

        }
      );


    modelPromiseCache.set(
      key,
      promise
    );


    return promise;

  }


  /*
   * =========================================================
   * VISIBILITY
   * =========================================================
   */


  function show2D(
    show
  ) {

    const element =
      image();


    if (
      !element
    ) {

      return;

    }


    element.style.display =
      show
        ? ""
        : "none";

  }


  function show3D(
    show
  ) {

    if (
      !canvas
    ) {

      return;

    }


    canvas.hidden =
      !show;


    canvas.style.display =
      show
        ? "block"
        : "none";

  }


  /*
   * =========================================================
   * MAIN HOST
   * =========================================================
   */


  function bindHost() {

    const host =
      area();


    if (
      !host ||
      !canvas
    ) {

      return false;

    }


    if (
      canvas.parentElement !==
      host
    ) {

      host.appendChild(
        canvas
      );

    }


    if (
      resizeObserver &&
      observedHost !==
      host
    ) {

      resizeObserver.disconnect();


      resizeObserver.observe(
        host
      );


      observedHost =
        host;

    }


    return true;

  }


  function desiredPixelRatio() {

    const dpr =
      window.devicePixelRatio ||
      1;


    /*
     * Retina 2–3x rendering is
     * needlessly expensive for animated GLB.
     *
     * 1.35–1.5 stays sharp while keeping
     * stable frame pacing.
     */
    const cap =
      window.innerWidth <=
      720

        ? 1.35

        : 1.5;


    return Math.min(
      dpr,
      cap
    );

  }


  function resize() {

    if (
      !renderer ||
      !camera
    ) {

      return;

    }


    bindHost();


    const host =
      area();


    if (
      !host
    ) {

      return;

    }


    const rect =
      host
        .getBoundingClientRect();


    const width =
      Math.max(
        1,
        Math.floor(
          rect.width
        )
      );


    const height =
      Math.max(
        1,
        Math.floor(
          rect.height
        )
      );


    renderer.setPixelRatio(
      desiredPixelRatio()
    );


    renderer.setSize(
      width,
      height,
      false
    );


    camera.aspect =
      width /
      height;


    camera.updateProjectionMatrix();

  }


  function mainOverlayOpen() {

    return Boolean(
      document.querySelector(
        [
          "#lagoShop.active",
          "#lagoCollection.active",
          "#lagoCreator.active",
          "#lagoGames.active",
          "#lagoProfile.active"
        ].join(
          ","
        )
      )
    );

  }


  function createRenderer() {

    const host =
      area();


    if (
      !host
    ) {

      return false;

    }


    canvas =
      document.createElement(
        "canvas"
      );


    canvas.className =
      "lago-character-3d-canvas";


    canvas.hidden =
      true;


    canvas.style.position =
      "absolute";


    canvas.style.inset =
      "0";


    canvas.style.width =
      "100%";


    canvas.style.height =
      "100%";


    canvas.style.zIndex =
      "2";


    canvas.style.display =
      "none";


    canvas.style.touchAction =
      "manipulation";


    host.appendChild(
      canvas
    );


    renderer =
      new THREE.WebGLRenderer({

        canvas,

        alpha:
          true,

        antialias:
          true,

        powerPreference:
          "high-performance"

      });


    renderer.outputColorSpace =
      THREE.SRGBColorSpace;


    renderer.setClearColor(
      0x000000,
      0
    );


    scene =
      new THREE.Scene();


    camera =
      new THREE.PerspectiveCamera(
        30,
        1,
        0.1,
        100
      );


    camera.position.set(
      0,
      0,
      5.35
    );


    camera.lookAt(
      0,
      0,
      0
    );


    scene.add(
      new THREE.HemisphereLight(
        0xffffff,
        0x33251a,
        2.25
      )
    );


    const key =
      new THREE.DirectionalLight(
        0xffffff,
        3
      );


    key.position.set(
      -3,
      4,
      5
    );


    scene.add(
      key
    );


    const fill =
      new THREE.DirectionalLight(
        0xffd9ef,
        1.15
      );


    fill.position.set(
      4,
      1,
      3
    );


    scene.add(
      fill
    );


    holder =
      new THREE.Group();


    scene.add(
      holder
    );


    resizeObserver =
      new ResizeObserver(
        resize
      );


    resizeObserver.observe(
      host
    );


    observedHost =
      host;


    /*
     * Safari / WebKit resilience.
     */
    canvas.addEventListener(
      "webglcontextlost",
      event => {

        event.preventDefault();


        show3D(
          false
        );


        show2D(
          true
        );

      }
    );


    canvas.addEventListener(
      "webglcontextrestored",
      () => {

        requestedModelUrl =
          "";


        activeModelUrl =
          "";


        resize();


        apply();

      }
    );


    resize();

/*
 * =========================================================
 * FRAME PACING
 * =========================================================
 *
 * MacBook Pro / iPhone Pro may run
 * requestAnimationFrame at 120 Hz.
 *
 * Lago does not need to render the same
 * GLB 120 times every second.
 *
 * Stable 60 FPS:
 * - lower GPU load
 * - lower Safari compositor load
 * - less heat
 * - more consistent frame delivery
 * - smoother UI transitions
 */

const TARGET_FPS =
  60;


const FRAME_INTERVAL =
  1000 /
  TARGET_FPS;


let lastRenderedAt =
  0;
  
   renderer.setAnimationLoop(
  now => {

    /*
     * Nothing visible =
     * zero GLB rendering work.
     */
    if (
      document.hidden ||
      canvas.hidden ||
      !activeModel ||
      mainOverlayOpen()
    ) {

      lastRenderedAt =
        now;

      return;

    }


    /*
     * Stable frame pacing.
     *
     * On a 120 Hz display this renders
     * every second display frame.
     */
    const elapsed =
      now -
      lastRenderedAt;


    if (
      elapsed <
      FRAME_INTERVAL
    ) {

      return;

    }


    /*
     * Prevent accumulated timing drift.
     */
    lastRenderedAt =
      now -
      (
        elapsed %
        FRAME_INTERVAL
      );


    const time =
      now *
      0.001;


    tapKick *=
      0.76;


    /*
     * Tiny idle motion.
     *
     * Keep movement visually alive,
     * but do not continuously swing
     * the whole model aggressively.
     */
    holder.position.y =
      Math.sin(
        time *
        1.45
      ) *
      0.026;


    holder.rotation.y =
      Math.sin(
        time *
        0.52
      ) *
      0.018;


    /*
     * Tap response.
     */
    holder.scale.set(

      1 +
        tapKick *
        0.04,

      1 -
        tapKick *
        0.03,

      1 +
        tapKick *
        0.016

    );


    renderer.render(
      scene,
      camera
    );

  }
);


    return true;

  }


  function ensureRenderer() {

    if (
      !renderer
    ) {

      return createRenderer();

    }


    bindHost();


    return true;

  }


  function clearModel() {

    if (
      activeModel &&
      holder
    ) {

      holder.remove(
        activeModel
      );

    }


    activeModel =
      null;


    activeModelUrl =
      "";

  }


  function installModel(
    template,
    modelUrl
  ) {

    clearModel();


    activeModel =
      template.clone(
        true
      );


    activeModelUrl =
      modelUrl;


    holder.add(
      activeModel
    );


    holder.position.set(
      0,
      0,
      0
    );


    holder.rotation.set(
      0,
      0,
      0
    );


    holder.scale.set(
      1,
      1,
      1
    );


    show2D(
      false
    );


    show3D(
      true
    );


    resize();

  }


  /*
   * =========================================================
   * MAIN CHARACTER LOAD
   * =========================================================
   */


  async function loadTarget(
    target
  ) {

    if (
      !target ||
      !ensureRenderer()
    ) {

      return;

    }


    const modelUrl =
      target.url;


    requestedModelUrl =
      modelUrl;


    if (
      activeModel &&
      activeModelUrl ===
        modelUrl
    ) {

      show2D(
        false
      );


      show3D(
        true
      );


      resize();


      return;

    }


    const nonce =
      ++requestNonce;


    /*
     * Keep 2D fallback visible only
     * while asynchronous GLB loads.
     */
    show3D(
      false
    );


    show2D(
      true
    );


    try {

      const template =
        await getTemplate(
          modelUrl
        );


      if (
        nonce !==
          requestNonce ||
        requestedModelUrl !==
          modelUrl
      ) {

        return;

      }


      const current =
        resolveTarget();


      if (
        !current ||
        current.url !==
          modelUrl
      ) {

        return;

      }


      installModel(
        template,
        modelUrl
      );

    } catch (
      error
    ) {

      if (
        requestedModelUrl ===
        modelUrl
      ) {

        clearModel();


        show3D(
          false
        );


        show2D(
          true
        );

      }


      console.error(
        "[LAGO 3D] GLB load failed:",
        modelUrl,
        error
      );

    }

  }


  /*
   * =========================================================
   * SHARED STATIC PREVIEW RENDERER
   * =========================================================
   */


  function ensurePreviewRenderer() {

    if (
      previewRenderer
    ) {

      return;

    }


    const offscreenCanvas =
      document.createElement(
        "canvas"
      );


    previewRenderer =
      new THREE.WebGLRenderer({

        canvas:
          offscreenCanvas,

        alpha:
          true,

        antialias:
          true,

        powerPreference:
          "low-power",

        preserveDrawingBuffer:
          true

      });


    previewRenderer.setPixelRatio(
      1
    );


    previewRenderer.outputColorSpace =
      THREE.SRGBColorSpace;


    previewRenderer.setClearColor(
      0x000000,
      0
    );


    previewScene =
      new THREE.Scene();


    previewCamera =
      new THREE.PerspectiveCamera(
        30,
        1,
        0.1,
        100
      );


    previewCamera.position.set(
      0,
      0,
      5.8
    );


    previewCamera.lookAt(
      0,
      0,
      0
    );


    previewScene.add(
      new THREE.HemisphereLight(
        0xffffff,
        0x33251a,
        2.25
      )
    );


    const key =
      new THREE.DirectionalLight(
        0xffffff,
        3
      );


    key.position.set(
      -3,
      4,
      5
    );


    previewScene.add(
      key
    );


    const fill =
      new THREE.DirectionalLight(
        0xffd9ef,
        1.1
      );


    fill.position.set(
      4,
      1,
      3
    );


    previewScene.add(
      fill
    );


    previewHolder =
      new THREE.Group();


    previewScene.add(
      previewHolder
    );

  }


  function destroyPreview(
    host
  ) {

    if (
      !host
    ) {

      return;

    }


    const controller =
      host
        ._lago3dPreviewController;


    if (
      controller
    ) {

      controller.destroyed =
        true;

    }


    delete host
      ._lago3dPreviewController;


    host
      .querySelectorAll(
        ".lago-glb-preview-image"
      )
      .forEach(
        element =>
          element.remove()
      );

  }


  function previewDimensions(
    host
  ) {

    const rect =
      host
        .getBoundingClientRect();


    const rawWidth =
      Math.max(
        180,
        rect.width ||
        280
      );


    const rawHeight =
      Math.max(
        180,
        rect.height ||
        280
      );


    /*
     * High enough for crisp cards,
     * low enough for fast Safari rendering.
     */
    const scale =
      Math.min(
        1.35,
        420 /
          Math.max(
            rawWidth,
            rawHeight
          )
      );


    return {

      width:
        Math.max(
          180,
          Math.round(
            rawWidth *
            scale
          )
        ),

      height:
        Math.max(
          180,
          Math.round(
            rawHeight *
            scale
          )
        )

    };

  }


  async function processPreviewTask(
    task
  ) {

    const {
      host,
      modelUrl,
      controller
    } =
      task;


    if (
      controller.destroyed ||
      !host.isConnected
    ) {

      return;

    }


    const template =
      await getTemplate(
        modelUrl
      );


    if (
      controller.destroyed ||
      !host.isConnected
    ) {

      return;

    }


    ensurePreviewRenderer();


    previewHolder.clear();


    const model =
      template.clone(
        true
      );


    previewHolder.add(
      model
    );


    previewHolder.position.set(
      0,
      0,
      0
    );


    previewHolder.rotation.set(
      0,
      0,
      0
    );


    previewHolder.scale.set(
      1,
      1,
      1
    );


    const {
      width,
      height
    } =
      previewDimensions(
        host
      );


    previewRenderer.setSize(
      width,
      height,
      false
    );


    previewCamera.aspect =
      width /
      height;


    previewCamera
      .updateProjectionMatrix();


    previewRenderer.render(
      previewScene,
      previewCamera
    );


    /*
     * Snapshot once.
     *
     * Card no longer owns a live
     * WebGL context afterwards.
     */
    const dataUrl =
      previewRenderer
        .domElement
        .toDataURL(
          "image/png"
        );


    if (
      controller.destroyed ||
      !host.isConnected
    ) {

      previewHolder.clear();

      return;

    }


    const previewImage =
      document.createElement(
        "img"
      );


    previewImage.className =
      "lago-glb-preview-image";


    previewImage.alt =
      "";


    previewImage.draggable =
      false;


    previewImage.src =
      dataUrl;


    previewImage.style.position =
      "absolute";


    previewImage.style.inset =
      "0";


    previewImage.style.width =
      "100%";


    previewImage.style.height =
      "100%";


    previewImage.style.objectFit =
      "contain";


    previewImage.style.pointerEvents =
      "none";


    host
      .querySelectorAll(
        ".lago-glb-preview-image"
      )
      .forEach(
        element =>
          element.remove()
      );


    host.appendChild(
      previewImage
    );


    controller.image =
      previewImage;


    previewHolder.clear();

  }


  async function pumpPreviewQueue() {

    if (
      previewBusy
    ) {

      return;

    }


    const task =
      previewQueue.shift();


    if (
      !task
    ) {

      return;

    }


    previewBusy =
      true;


    try {

      await processPreviewTask(
        task
      );

    } catch (
      error
    ) {

      if (
        !task.controller
          .destroyed
      ) {

        console.error(
          "[LAGO 3D] Preview failed:",
          task.modelUrl,
          error
        );

      }

    } finally {

      previewBusy =
        false;


      /*
       * Give Safari one frame
       * between heavy GLB previews.
       */
      requestAnimationFrame(
        pumpPreviewQueue
      );

    }

  }


  function mountPreview(
    host,
    modelUrl
  ) {

    if (
      !host ||
      typeof modelUrl !==
        "string" ||
      !modelUrl.trim()
    ) {

      return null;

    }


    destroyPreview(
      host
    );


    const controller = {

      destroyed:
        false,

      image:
        null,

      destroy() {

        controller.destroyed =
          true;


        controller.image
          ?.remove
          ?.();


        controller.image =
          null;

      }

    };


    host._lago3dPreviewController =
      controller;


    previewQueue.push({

      host,

      modelUrl:
        modelUrl.trim(),

      controller

    });


    pumpPreviewQueue();


    return controller;

  }


  /*
   * =========================================================
   * APPLY CURRENT CHARACTER
   * =========================================================
   */


  function apply() {

    const target =
      resolveTarget();


    if (
      !target
    ) {

      requestedModelUrl =
        "";


      requestNonce++;


      clearModel();


      show3D(
        false
      );


      show2D(
        true
      );


      return false;

    }


    loadTarget(
      target
    );


    return true;

  }


  /*
   * =========================================================
   * EVENTS
   * =========================================================
   */


  document.addEventListener(
    "lago:state",
    apply
  );


  document.addEventListener(
    "lago:account-state",
    apply
  );


  document.addEventListener(
    "lago:character-equipped",
    apply
  );


  document.addEventListener(
    "lago:character-unlocked",
    apply
  );


  document.addEventListener(
    "lago:modern-ready",
    apply
  );


  document.addEventListener(
    "visibilitychange",
    () => {

      if (
        document.visibilityState ===
        "visible"
      ) {

        resize();


        apply();

      }

    }
  );


  window.addEventListener(
    "resize",
    resize,
    {
      passive:
        true
    }
  );


  /*
   * =========================================================
   * TAP
   * =========================================================
   */


  function pulseTap() {

    tapKick =
      1;

  }


  /*
   * =========================================================
   * PUBLIC API
   * =========================================================
   */


  window.LAGO_CHARACTER_3D =
    Object.freeze({

      version:
        VERSION,

      apply,

      pulseTap,

      mountPreview,

      destroyPreview

    });


  /*
   * Initial render.
   */
  apply();


  document.dispatchEvent(
    new CustomEvent(
      "lago:character-3d-ready",
      {
        detail: {

          version:
            VERSION

        }
      }
    )
  );


})();

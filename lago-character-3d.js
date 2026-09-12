import * as THREE from "three";

import {
  GLTFLoader
} from "three/addons/loaders/GLTFLoader.js";


(() => {
  "use strict";


  const VERSION =
    6;


  const BASE_LAGO_MODEL =
    "./assets/model/lago.glb?v=4";


  const BASE_IDS =
    new Set([
      "default",
      "lago"
    ]);


  /*
   * =========================================================
   * MODEL ORIENTATION
   * =========================================================
   *
   * Canonical Lago GLBs are relief models.
   *
   * Source axes:
   *
   * X = horizontal width
   * Y = relief depth
   * Z = vertical height
   *
   * Three.js camera looks toward -Z.
   *
   * Therefore every canonical GLB must first
   * rotate -90 degrees around X:
   *
   * old Z -> screen Y
   * old -Y -> camera-facing Z
   *
   * Without this rotation the camera sees
   * only the thin edge of the relief.
   */

  const CHARACTER_ROTATION_X =
    -Math.PI /
    2;


  /*
   * GLB is the canonical character renderer.
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


  let loadNonce =
    0;


  let tapKick =
    0;


  const loader =
    new GLTFLoader();


  const modelCache =
    new Map();


  /*
   * =========================================================
   * CHARACTER SELECTION
   * =========================================================
   */

  function selectedId() {

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


    /*
     * Original Lago.
     */
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


    /*
     * Complete standalone character.
     */
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
     * Lago skin / creator item
     * without own GLB:
     * keep existing 2D fallback.
     */
    return null;

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
   * HOST
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


  /*
   * =========================================================
   * MODEL NORMALIZATION
   * =========================================================
   */

  function normalizeModel(
    object
  ) {

    if (
      !object
    ) {

      return;

    }


    /*
     * FIRST:
     * rotate the relief into its
     * canonical front-facing pose.
     *
     * This must happen BEFORE bounds
     * and scale are calculated.
     */
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


    /*
     * Read correctly rotated bounds.
     */
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


    /*
     * Canonical safe visual envelope.
     */
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


    /*
     * Recalculate bounds after scale.
     */
    const scaledBox =
      new THREE.Box3()
        .setFromObject(
          object
        );


    const center =
      scaledBox.getCenter(
        new THREE.Vector3()
      );


    /*
     * Center all axes.
     *
     * Previously Z was treated as
     * horizontal centering because
     * the model had not been rotated.
     *
     * After canonical rotation,
     * normal XYZ centering is correct.
     */
    object.position.x -=
      center.x;


    object.position.y -=
      center.y;


    object.position.z -=
      center.z;


    /*
     * Tiny optical lift.
     */
    object.position.y +=
      0.04;


    object.updateMatrixWorld(
      true
    );

  }


  /*
   * =========================================================
   * ACTIVE MODEL
   * =========================================================
   */

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


    /*
     * Holder remains neutral.
     *
     * Canonical front rotation is stored
     * inside the normalized model itself.
     */
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

  }


  /*
   * =========================================================
   * MAIN RENDERER
   * =========================================================
   */

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


    canvas.setAttribute(
      "aria-label",
      "Lago character 3D"
    );


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


    renderer.setPixelRatio(
      Math.min(
        window.devicePixelRatio ||
        1,
        2
      )
    );


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


    /*
     * Neutral front lighting.
     */

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


    resize();


    renderer.setAnimationLoop(
      () => {

        const time =
          performance.now() *
          0.001;


        tapKick *=
          0.82;


        if (
          activeModel
        ) {

          /*
           * Tiny idle motion.
           *
           * Rotation Y now means a
           * small left/right face turn,
           * because the model is finally
           * standing upright.
           */
          holder.position.y =
            Math.sin(
              time *
              1.8
            ) *
            0.045;


          holder.rotation.y =
            Math.sin(
              time *
              0.65
            ) *
            0.035;


          /*
           * Tap squash.
           */
          holder.scale.set(

            1 +
              tapKick *
              0.055,

            1 -
              tapKick *
              0.045,

            1 +
              tapKick *
              0.025

          );

        }


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


  /*
   * =========================================================
   * LOAD MAIN CHARACTER
   * =========================================================
   */

  function loadTarget(
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


    /*
     * Correct GLB already installed.
     */
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


    /*
     * Never show previous character
     * while another GLB is loading.
     */
    show3D(
      false
    );


    show2D(
      true
    );


    /*
     * Cached model.
     */
    if (
      modelCache.has(
        modelUrl
      )
    ) {

      installModel(
        modelCache.get(
          modelUrl
        ),
        modelUrl
      );


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
      ++loadNonce;


    loader.load(

      modelUrl,


      gltf => {

        const template =
          gltf.scene;


        normalizeModel(
          template
        );


        modelCache.set(
          modelUrl,
          template
        );


        /*
         * Ignore stale async result.
         */
        if (
          nonce !==
            loadNonce ||
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


        show2D(
          false
        );


        show3D(
          true
        );


        resize();

      },


      undefined,


      error => {

        if (
          requestedModelUrl ===
          modelUrl
        ) {

          clearModel();


          show3D(
            false
          );


          /*
           * Fail safely to 2D.
           */
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

    );

  }


  /*
   * =========================================================
   * STATIC GLB PREVIEW
   * =========================================================
   *
   * Shop and Collection use exactly
   * the same normalized GLB template.
   *
   * Therefore main character and cards
   * always have the same orientation.
   */

  function destroyPreview(
    host
  ) {

    const controller =
      host
        ?._lago3dPreviewController;


    if (
      controller
        ?.destroy
    ) {

      controller.destroy();

    }


    if (
      host
    ) {

      delete host
        ._lago3dPreviewController;

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


    const previewCanvas =
      document.createElement(
        "canvas"
      );


    previewCanvas.className =
      "lago-glb-preview-canvas";


    previewCanvas.style.position =
      "absolute";


    previewCanvas.style.inset =
      "0";


    previewCanvas.style.width =
      "100%";


    previewCanvas.style.height =
      "100%";


    previewCanvas.style.display =
      "block";


    previewCanvas.style.pointerEvents =
      "none";


    host.appendChild(
      previewCanvas
    );


    const previewRenderer =
      new THREE.WebGLRenderer({

        canvas:
          previewCanvas,

        alpha:
          true,

        antialias:
          true,

        powerPreference:
          "low-power"

      });


    previewRenderer.setPixelRatio(
      Math.min(
        window.devicePixelRatio ||
        1,
        1.5
      )
    );


    previewRenderer.outputColorSpace =
      THREE.SRGBColorSpace;


    previewRenderer.setClearColor(
      0x000000,
      0
    );


    const previewScene =
      new THREE.Scene();


    const previewCamera =
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


    const previewKey =
      new THREE.DirectionalLight(
        0xffffff,
        3
      );


    previewKey.position.set(
      -3,
      4,
      5
    );


    previewScene.add(
      previewKey
    );


    const previewFill =
      new THREE.DirectionalLight(
        0xffd9ef,
        1.15
      );


    previewFill.position.set(
      4,
      1,
      3
    );


    previewScene.add(
      previewFill
    );


    const previewHolder =
      new THREE.Group();


    previewScene.add(
      previewHolder
    );


    let destroyed =
      false;


    function drawPreview() {

      if (
        destroyed
      ) {

        return;

      }


      const rect =
        host
          .getBoundingClientRect();


      const width =
        Math.max(
          1,
          Math.round(
            rect.width
          )
        );


      const height =
        Math.max(
          1,
          Math.round(
            rect.height
          )
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

    }


    function installPreview(
      template
    ) {

      if (
        destroyed
      ) {

        return;

      }


      previewHolder.clear();


      const model =
        template.clone(
          true
        );


      previewHolder.add(
        model
      );


      /*
       * Static front pose.
       *
       * No idle rotation in cards.
       */
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


      drawPreview();

    }


    const observer =
      new ResizeObserver(
        drawPreview
      );


    observer.observe(
      host
    );


    const controller = {

      destroy() {

        if (
          destroyed
        ) {

          return;

        }


        destroyed =
          true;


        observer.disconnect();


        previewHolder.clear();


        previewRenderer.dispose();


        previewRenderer
          .forceContextLoss
          ?.();


        previewCanvas.remove();

      }

    };


    host._lago3dPreviewController =
      controller;


    const key =
      modelUrl.trim();


    /*
     * Same cache as main stage.
     */
    if (
      modelCache.has(
        key
      )
    ) {

      installPreview(
        modelCache.get(
          key
        )
      );


      return controller;

    }


    loader.load(

      key,


      gltf => {

        if (
          destroyed
        ) {

          return;

        }


        const template =
          gltf.scene;


        normalizeModel(
          template
        );


        modelCache.set(
          key,
          template
        );


        installPreview(
          template
        );

      },


      undefined,


      error => {

        if (
          destroyed
        ) {

          return;

        }


        console.error(
          "[LAGO 3D] Preview load failed:",
          key,
          error
        );

      }

    );


    return controller;

  }


  /*
   * =========================================================
   * APPLY CHARACTER
   * =========================================================
   */

  function apply() {

    bindHost();


    const target =
      resolveTarget();


    /*
     * Character has no GLB.
     */
    if (
      !target
    ) {

      requestedModelUrl =
        "";


      loadNonce++;


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
    "lago:character-equipped",
    apply
  );


  document.addEventListener(
    "lago:modern-ready",
    apply
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
   * TAP ANIMATION
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
   * Initial main character.
   */
  apply();


  /*
   * Collection / Shop may already
   * exist before this ES module loads.
   */
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

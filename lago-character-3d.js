import * as THREE from "three";

import {
  GLTFLoader
} from "three/addons/loaders/GLTFLoader.js";


(() => {
  "use strict";


 const VERSION =
  5;
  
  const BASE_LAGO_MODEL =
    "./assets/model/lago.glb?v=4";


  const BASE_IDS =
    new Set([
      "default",
      "lago"
    ]);


/*
 * GLB is the canonical character renderer.
 * There are no public URL switches.
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
     * Complete comic character.
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
     * Lago skins / creator characters
     * without their own GLB still use
     * the existing 2D fallback.
     */
    return null;

  }


  function show2D(
    show
  ) {

    const element =
      image();


    if (!element) {

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

    if (!canvas) {

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
   * The Modern UI may recreate / move the
   * character stage during migration.
   *
   * Always ensure that the canvas lives in
   * #modernSnailArea when it exists.
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


    if (!host) {

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


  function normalizeModel(
    object
  ) {

    /*
     * Current Lago GLBs are exported Z-up.
     * Convert to Three.js Y-up.
     */

    object.rotation.x =
      -Math.PI /
      2;


    object.updateMatrixWorld(
      true
    );


    let box =
      new THREE.Box3()
        .setFromObject(
          object
        );


    const size =
      box.getSize(
        new THREE.Vector3()
      );


    const largest =
      Math.max(
        size.x,
        size.y,
        size.z,
        0.0001
      );


    /*
     * Every character gets the same
     * normalized visual scale.
     */

    object.scale.setScalar(
      3.25 /
      largest
    );


    object.updateMatrixWorld(
      true
    );


    box =
      new THREE.Box3()
        .setFromObject(
          object
        );


    const center =
      box.getCenter(
        new THREE.Vector3()
      );


    object.position.sub(
      center
    );


    object.position.y -=
      0.06;


    object.updateMatrixWorld(
      true
    );

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


    /*
     * Static Lago relief GLBs can be cloned
     * directly. Original cached template
     * stays untouched.
     */

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

  }


  function createRenderer() {

    const host =
      area();


    if (!host) {

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


    /*
     * Critical layout properties live here
     * instead of relying on legacy CSS.
     */

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
      0.1,
      5.6
    );


    camera.lookAt(
      0,
      0.1,
      0
    );


    /*
     * Neutral lighting.
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


    /*
     * GLB character remains the real
     * Tap Lago interaction surface.
     */

    canvas.addEventListener(
      "pointerdown",
      event => {

        event.preventDefault();


        tapKick =
          1;


        window.LAGO_TAP_GAME
          ?.tap
          ?.(
            event
          );

      },
      {
        passive:
          false
      }
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
           * Very small idle motion.
           * The stage itself never moves.
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
            0.045;


          /*
           * TAP squash is applied only
           * to the model holder.
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
              0.055

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
     * Correct GLB is already installed.
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
     * Never display the previous character
     * while a new one is loading.
     *
     * Existing 2D asset becomes temporary
     * loading fallback only.
     */

    show3D(
      false
    );


    show2D(
      true
    );


    /*
     * Re-use already loaded GLBs.
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
         * Ignore stale asynchronous result
         * if player already selected another
         * character.
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
           * Fail closed to the existing
           * 2D asset. Character never
           * disappears completely.
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
 * Collection / Shop can render the real GLB directly.
 * No raster preview files are created.
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


  if (host) {

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
    0.1,
    5.6
  );


  previewCamera.lookAt(
    0,
    0.1,
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

    if (destroyed) {

      return;

    }


    const rect =
      host.getBoundingClientRect();


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

    if (destroyed) {

      return;

    }


    previewHolder.clear();


    previewHolder.add(
      template.clone(
        true
      )
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

      if (destroyed) {

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

      if (destroyed) {

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

      if (destroyed) {

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
  
  function apply() {

    bindHost();




    const target =
      resolveTarget();


    /*
     * Character has no GLB.
     * Keep its 2D runtime.
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
   * Re-evaluate renderer whenever
   * account / Collection changes.
   */

  document.addEventListener(
    "lago:state",
    apply
  );


  document.addEventListener(
    "lago:character-equipped",
    apply
  );


  /*
   * Optional future Modern UI lifecycle event.
   */
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

window.LAGO_CHARACTER_3D =
  Object.freeze({

    version:
      VERSION,

    apply,

    mountPreview,

    destroyPreview

  });


/*
 * Initial canonical 3D render.
 *
 * lago-modern.js has already created
 * #modernSnailArea before this module runs.
 */
apply();


/*
 * Collection may already exist before
 * this ES module finishes loading.
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

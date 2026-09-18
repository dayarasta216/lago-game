import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

(() => {
  "use strict";

  const VERSION = 30;
  const BASE_LAGO_MODEL = "./assets/model/roster/lago.glb?v=2";
  const BASE_IDS = new Set(["default", "lago"]);
  const TARGET_SIZE = 2.35;
  const PREVIEW_SIZE = 256;

  const loader = new GLTFLoader();
  const templateCache = new Map();
  const templatePromiseCache = new Map();
  const previewSnapshotCache = new Map();
  const previewQueue = [];

  let previewBusy = false;
  let previewRenderer = null;
  let previewScene = null;
  let previewCamera = null;
  let previewHolder = null;

  let canvas = null;
  let renderer = null;
  let scene = null;
  let camera = null;
  let holder = null;
  let resizeObserver = null;
  let observedHost = null;
  let activeModel = null;
  let activeModelUrl = "";
  let requestedModelUrl = "";
  let requestNonce = 0;
  let animationFrame = 0;
  let pulse = 0;
  let pulseVelocity = 0;
  let interactiveHost = null;
  let dragPointerId = null;
  let dragLastX = 0;
  let manualYaw = -0.12;

  
  const status = {
    main: "idle",
    modelUrl: "",
    lastError: ""
  };

  function area() {
    return document.getElementById("modernSnailArea");
  }

  function selectedId() {
    const account = window.LAGO_ACCOUNT?.getState?.();

    if (account?.selectedSkin) {
      return String(account.selectedSkin);
    }

    return String(
      window.LAGO?.getState?.()?.selectedSkin ||
      "default"
    );
  }

  function resolveTarget() {
    const id = selectedId();

    if (BASE_IDS.has(id)) {
      return {
        id: "lago",
        name: "LAGO",
        url: BASE_LAGO_MODEL
      };
    }

    const character =
      window.LAGO_CHARACTERS
        ?.getById
        ?.(id);

    if (character?.model3d) {
      return {
        id: character.id,
        name: character.name,
        url: String(character.model3d)
      };
    }

    return {
      id: "lago",
      name: "LAGO",
      url: BASE_LAGO_MODEL
    };
  }

  function prepareMaterial(material) {
    if (!material) {
      return;
    }

    if ("metalness" in material) {
      material.metalness = 0;
    }

    if ("roughness" in material) {
      material.roughness = 0.72;
    }

    material.side = THREE.DoubleSide;
    material.needsUpdate = true;
  }

  function normalizeModel(object) {
    object.position.set(0, 0, 0);
    object.rotation.set(0, 0, 0);
    object.scale.set(1, 1, 1);

    object.traverse(
      child => {
        if (!child.isMesh) {
          return;
        }

        const geometry =
          child.geometry;

        if (
          geometry
            ?.attributes
            ?.position &&
          !geometry
            .attributes
            .normal
        ) {
          geometry
            .computeVertexNormals();

          geometry
            .computeBoundingBox();

          geometry
            .computeBoundingSphere();
        }

        if (
          Array.isArray(
            child.material
          )
        ) {
          child.material
            .forEach(
              prepareMaterial
            );
        } else {
          prepareMaterial(
            child.material
          );
        }

        child.frustumCulled =
          false;
      }
    );

    object.updateMatrixWorld(
      true
    );

    const firstBox =
      new THREE.Box3()
        .setFromObject(
          object
        );

    const size =
      firstBox.getSize(
        new THREE.Vector3()
      );

    const largest =
      Math.max(
        size.x,
        size.y,
        size.z,
        0.001
      );

    object.scale
      .setScalar(
        TARGET_SIZE /
        largest
      );

    object.updateMatrixWorld(
      true
    );

    const box =
      new THREE.Box3()
        .setFromObject(
          object
        );

    const center =
      box.getCenter(
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
  }

  function loadTemplate(
    modelUrl
  ) {
    const key =
      String(
        modelUrl ||
        ""
      ).trim();

    if (!key) {
      return Promise.reject(
        new Error(
          "Missing GLB URL"
        )
      );
    }

    if (
      templateCache.has(
        key
      )
    ) {
      return Promise.resolve(
        templateCache.get(
          key
        )
      );
    }

    if (
      templatePromiseCache.has(
        key
      )
    ) {
      return templatePromiseCache.get(
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
                  gltf?.scene;

                if (!template) {
                  throw new Error(
                    `GLB has no scene: ${key}`
                  );
                }

                normalizeModel(
                  template
                );

                templateCache.set(
                  key,
                  template
                );

                templatePromiseCache.delete(
                  key
                );

                resolve(
                  template
                );
              } catch (
                error
              ) {
                templatePromiseCache.delete(
                  key
                );

                reject(
                  error
                );
              }
            },

            undefined,

            error => {
              templatePromiseCache.delete(
                key
              );

              reject(
                error
              );
            }
          );
        }
      );

    templatePromiseCache.set(
      key,
      promise
    );

    return promise;
  }

  function cloneTemplate(
    template
  ) {
    const clone =
      template.clone(
        true
      );

    clone.traverse(
      child => {
        if (
          !child.isMesh ||
          !child.material
        ) {
          return;
        }

        child.material =
          Array.isArray(
            child.material
          )

            ? child.material.map(
                material =>
                  material
                    ?.clone
                    ?.() ||
                  material
              )

            : child.material
                .clone
                ?.() ||
              child.material;
      }
    );

    return clone;
  }

  async function cloneModel(
    modelUrl
  ) {
    const template =
      await loadTemplate(
        modelUrl
      );

    return cloneTemplate(
      template
    );
  }

  function desiredPixelRatio() {
    return Math.min(
      window.devicePixelRatio ||
      1,

      window.innerWidth <=
      760

        ? 1.2

        : 1.4
    );
  }

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
      getComputedStyle(
        host
      ).position ===
      "static"
    ) {
      host.style.position =
        "relative";
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
      resizeObserver
        .disconnect();

      resizeObserver
        .observe(
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

    renderer
      .setPixelRatio(
        desiredPixelRatio()
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

    camera
      .updateProjectionMatrix();
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

  function animate(
    now =
      performance.now()
  ) {
    animationFrame =
      requestAnimationFrame(
        animate
      );

    if (
      !renderer ||
      !activeModel ||
      canvas?.hidden
    ) {
      return;
    }

    const dt =
      1 / 60;

    const time =
      now *
      0.001;

    pulseVelocity +=
      (
        -pulse * 190 -
        pulseVelocity * 12
      ) *
      dt;

    pulse +=
      pulseVelocity *
      dt;

    if (
      Math.abs(
        pulse
      ) <
        0.0008 &&
      Math.abs(
        pulseVelocity
      ) <
        0.015
    ) {
      pulse = 0;
      pulseVelocity = 0;
    }

    const bulge =
      THREE.MathUtils
        .clamp(
          pulse,
          -0.08,
          0.20
        );

    holder.position.y =
      Math.sin(
        time *
        1.35
      ) *
      0.018;

       holder.rotation.y =
      manualYaw +
      Math.sin(
        time *
        0.42
      ) *
      0.018;

    holder.scale.set(
      1 +
      bulge *
      0.50,

      1 +
      bulge *
      0.68,

      1 +
      bulge *
      0.46
    );

    renderer.render(
      scene,
      camera
    );
  }

  function createRenderer() {
    const host =
      area();

    if (!host) {
      return false;
    }

    if (
      getComputedStyle(
        host
      ).position ===
      "static"
    ) {
      host.style.position =
        "relative";
    }

    canvas =
      document
        .createElement(
          "canvas"
        );

    canvas.className =
      "lago-character-3d-canvas";

    canvas.hidden =
      true;

       Object.assign(
      canvas.style,
      {
        position:
          "absolute",

        inset:
          "0",

        width:
          "100%",

        height:
          "100%",

        display:
          "none",

        zIndex:
          "2",

        pointerEvents:
          "none",

        touchAction:
          "none"
      }
    );

    host.appendChild(
      canvas
    );

    try {
      renderer =
        new THREE
          .WebGLRenderer({
            canvas,
            alpha:
              true,
            antialias:
              true,
            powerPreference:
              "high-performance"
          });
    } catch (
      error
    ) {
      status.main =
        "renderer-error";

      status.lastError =
        String(
          error?.message ||
          error
        );

      console.error(
        "[LAGO 3D] WebGL renderer failed:",
        error
      );

      return false;
    }

    renderer.outputColorSpace =
      THREE.SRGBColorSpace;

    renderer.setClearColor(
      0x000000,
      0
    );

    scene =
      new THREE.Scene();

    camera =
      new THREE
        .PerspectiveCamera(
          30,
          1,
          0.1,
          100
        );

    camera.position.set(
      0,
      0.02,
      5.25
    );

    camera.lookAt(
      0,
      0.02,
      0
    );

    scene.add(
      new THREE
        .HemisphereLight(
          0xffffff,
          0x2a1c16,
          2.4
        )
    );

    const key =
      new THREE
        .DirectionalLight(
          0xffffff,
          3.0
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
      new THREE
        .DirectionalLight(
          0xffd8ef,
          1.0
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

    if (
      "ResizeObserver" in
      window
    ) {
      resizeObserver =
        new ResizeObserver(
          resize
        );

      resizeObserver
        .observe(
          host
        );

      observedHost =
        host;
    }

    window.addEventListener(
      "resize",
      resize,
      {
        passive:
          true
      }
    );

        resize();

    bindInteraction();

       if (!animationFrame) {
      animationFrame =
        requestAnimationFrame(
          animate
        );
    }

    return true;
  }


  function bindInteraction() {
    const host =
      area();

    if (!host) {
      return;
    }

    if (
      host ===
      interactiveHost
    ) {
      return;
    }

    interactiveHost =
      host;

    host.style.touchAction =
      "none";

    const release =
      event => {

        if (
          dragPointerId ===
          null
        ) {
          return;
        }

        if (
          event?.pointerId !==
            undefined &&
          event.pointerId !==
            dragPointerId
        ) {
          return;
        }

        try {
          host
            .releasePointerCapture
            ?.(dragPointerId);
        } catch (_) {}

        dragPointerId =
          null;
      };

    host.addEventListener(
      "pointerdown",
      event => {
        dragPointerId =
          event.pointerId;

        dragLastX =
          event.clientX;

        host
          .setPointerCapture
          ?.(event.pointerId);
      }
    );

    host.addEventListener(
      "pointermove",
      event => {
        if (
          event.pointerId !==
          dragPointerId
        ) {
          return;
        }

        const dx =
          event.clientX -
          dragLastX;

        dragLastX =
          event.clientX;

        manualYaw +=
          dx * 0.012;
      }
    );

    host.addEventListener(
      "pointerup",
      release
    );

    host.addEventListener(
      "pointercancel",
      release
    );

    host.addEventListener(
      "pointerleave",
      event => {
        if (
          event.buttons ===
          0
        ) {
          release(event);
        }
      }
    );
  }

  function ensureRenderer() {
    if (!renderer) {
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
      cloneTemplate(
        template
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

    pulse =
      0;

    pulseVelocity =
      0;

    show3D(
      true
    );

    resize();

    renderer.render(
      scene,
      camera
    );

    status.main =
      "ready";

    status.modelUrl =
      modelUrl;

    status.lastError =
      "";

    const host =
      area();

    if (host) {
      host.dataset
        .lago3dStatus =
        "ready";
    }
  }

  async function apply() {
    const target =
      resolveTarget();

    if (
      !target ||
      !ensureRenderer()
    ) {
      return false;
    }

    const modelUrl =
      String(
        target.url ||
        ""
      ).trim();

    if (!modelUrl) {
      return false;
    }

    requestedModelUrl =
      modelUrl;

    if (
      activeModel &&
      activeModelUrl ===
        modelUrl
    ) {
      show3D(
        true
      );

      return true;
    }

    const nonce =
      ++requestNonce;

    status.main =
      "loading";

    status.modelUrl =
      modelUrl;

    status.lastError =
      "";

    show3D(
      false
    );

    try {
      const template =
        await loadTemplate(
          modelUrl
        );

      if (
        nonce !==
          requestNonce ||
        requestedModelUrl !==
          modelUrl
      ) {
        return false;
      }

      installModel(
        template,
        modelUrl
      );

      return true;
    } catch (
      error
    ) {
      clearModel();

      show3D(
        false
      );

      status.main =
        "load-error";

      status.lastError =
        String(
          error?.message ||
          error
        );

      console.error(
        "[LAGO 3D] GLB load failed:",
        modelUrl,
        error
      );

      return false;
    }
  }

  function pulseTap() {
    pulseVelocity =
      Math.min(
        pulseVelocity +
        5.8,
        9.0
      );
  }

  function ensurePreviewRenderer() {
    if (previewRenderer) {
      return;
    }

    const offscreen =
      document
        .createElement(
          "canvas"
        );

    previewRenderer =
      new THREE
        .WebGLRenderer({
          canvas:
            offscreen,

          alpha:
            true,

          antialias:
            true,

          powerPreference:
            "low-power",

          preserveDrawingBuffer:
            true
        });

    previewRenderer
      .setPixelRatio(
        1
      );

    previewRenderer
      .setSize(
        PREVIEW_SIZE,
        PREVIEW_SIZE,
        false
      );

    previewRenderer.outputColorSpace =
      THREE.SRGBColorSpace;

    previewRenderer
      .setClearColor(
        0x000000,
        0
      );

    previewScene =
      new THREE.Scene();

    previewCamera =
      new THREE
        .PerspectiveCamera(
          30,
          1,
          0.1,
          100
        );

    previewCamera
      .position
      .set(
        0,
        0.02,
        5.65
      );

    previewCamera
      .lookAt(
        0,
        0.02,
        0
      );

    previewScene.add(
      new THREE
        .HemisphereLight(
          0xffffff,
          0x2a1c16,
          2.4
        )
    );

    const key =
      new THREE
        .DirectionalLight(
          0xffffff,
          3.0
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
      new THREE
        .DirectionalLight(
          0xffd8ef,
          1.0
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

  function attachPreview(
    host,
    src,
    controller
  ) {
    if (
      !host ||
      !host.isConnected ||
      controller.destroyed ||
      !src
    ) {
      return false;
    }

    if (
      getComputedStyle(
        host
      ).position ===
      "static"
    ) {
      host.style.position =
        "relative";
    }

    host
      .querySelectorAll(
        ".lago-glb-preview-image"
      )
      .forEach(
        node =>
          node.remove()
      );

    const image =
      document
        .createElement(
          "img"
        );

    image.className =
      "lago-glb-preview-image";

    image.alt =
      "";

    image.draggable =
      false;

    image.src =
      src;

    Object.assign(
      image.style,
      {
        position:
          "absolute",

        inset:
          "0",

        width:
          "100%",

        height:
          "100%",

        objectFit:
          "contain",

        pointerEvents:
          "none"
      }
    );

    host.appendChild(
      image
    );

    controller.image =
      image;

    return true;
  }

  function destroyPreview(
    host
  ) {
    if (!host) {
      return;
    }

    const controller =
      host
        ._lago3dPreviewController;

    if (controller) {
      controller.destroyed =
        true;
    }

    host
      .querySelectorAll(
        ".lago-glb-preview-image"
      )
      .forEach(
        node =>
          node.remove()
      );

    delete host
      ._lago3dPreviewController;

    delete host.dataset
      .lagoPreviewModel;
  }

  async function renderPreviewTask(
    task
  ) {
    const {
      host,
      modelUrl,
      controller
    } = task;

    if (
      controller.destroyed ||
      !host.isConnected
    ) {
      return;
    }

    const cached =
      previewSnapshotCache.get(
        modelUrl
      );

    if (cached) {
      attachPreview(
        host,
        cached,
        controller
      );

      return;
    }

    const template =
      await loadTemplate(
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

    previewHolder.add(
      cloneTemplate(
        template
      )
    );

    previewRenderer.render(
      previewScene,
      previewCamera
    );

    const src =
      previewRenderer
        .domElement
        .toDataURL(
          "image/png"
        );

    previewSnapshotCache.set(
      modelUrl,
      src
    );

    previewHolder.clear();

    attachPreview(
      host,
      src,
      controller
    );
  }

  async function pumpPreviewQueue() {
    if (previewBusy) {
      return;
    }

    const task =
      previewQueue.shift();

    if (!task) {
      return;
    }

    previewBusy =
      true;

    try {
      await renderPreviewTask(
        task
      );
    } catch (
      error
    ) {
      console.error(
        "[LAGO 3D] Preview failed:",
        task.modelUrl,
        error
      );
    } finally {
      previewBusy =
        false;

      if (
        previewQueue.length
      ) {
        requestAnimationFrame(
          pumpPreviewQueue
        );
      }
    }
  }

  function mountPreview(
    host,
    modelUrl
  ) {
    if (
      !host ||
      typeof modelUrl !==
        "string"
    ) {
      return null;
    }

    const key =
      modelUrl.trim();

    if (!key) {
      return null;
    }

    const existing =
      host
        ._lago3dPreviewController;

    if (
      existing &&
      !existing.destroyed &&
      host.dataset
        .lagoPreviewModel ===
        key
    ) {
      return existing;
    }

    destroyPreview(
      host
    );

    const controller = {
      destroyed:
        false,

      image:
        null,

      modelUrl:
        key,

      destroy() {
        destroyPreview(
          host
        );
      }
    };

    host
      ._lago3dPreviewController =
      controller;

    host.dataset
      .lagoPreviewModel =
      key;

    const cached =
      previewSnapshotCache.get(
        key
      );

    if (cached) {
      attachPreview(
        host,
        cached,
        controller
      );

      return controller;
    }

    previewQueue.push({
      host,
      modelUrl:
        key,
      controller
    });

    pumpPreviewQueue();

    return controller;
  }

  function getStatus() {
    return {
      version:
        VERSION,

      ...status
    };
  }

  window.LAGO_CHARACTER_3D =
    Object.freeze({
      version:
        VERSION,

      pulseTap,

      cloneModel,

      mountPreview,

      destroyPreview,

      apply,

      getStatus
    });

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

    function bootMainRenderer(
    attempt = 0
  ) {

    if (area()) {

      apply();

      return;

    }


    if (
      attempt >=
      240
    ) {

      status.main =
        "host-missing";


      status.lastError =
        "modernSnailArea was not created";


      console.error(
        "[LAGO 3D] Main character host was not created"
      );


      return;

    }


    requestAnimationFrame(
      () =>
        bootMainRenderer(
          attempt + 1
        )
    );

  }


  requestAnimationFrame(
    () =>
      bootMainRenderer(0)
  );
})();

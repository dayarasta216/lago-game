import * as THREE from "three";

import {
  GLTFLoader
} from "three/addons/loaders/GLTFLoader.js";


(() => {
  "use strict";


  const VERSION =
    1;


const MODEL_URL =
  "./assets/model/lago.glb?v=4";
  

  const STORAGE_KEY =
    "lago.character3d.enabled.v1";


  let enabled =
    localStorage.getItem(
      STORAGE_KEY
    ) === "1";


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

  let model =
    null;

  let ready =
    false;

  let loading =
    false;

  let tapKick =
    0;



  function selectedSkin() {

    return (
      window.LAGO
        ?.getState
        ?.()
        ?.selectedSkin ||
      "default"
    );

  }



  function isBaseLago() {

    const selected =
      selectedSkin();


    return (
      selected === "default" ||
      selected === "lago"
    );

  }



  function image() {

    return document
      .getElementById(
        "snail"
      );

  }



function area() {

  const modernArea =
    document.getElementById(
      "modernSnailArea"
    );


  if (modernArea) {

    return modernArea;

  }


  const snail =
    document.getElementById(
      "snail"
    );


  return (
    snail?.parentElement ||
    null
  );

}


  if (modernArea) {

    return modernArea;

  }


  const snail =
    document.getElementById(
      "snail"
    );


  return (
    snail?.parentElement ||
    null
  );

}


  function consumeURLToggle() {

    const url =
      new URL(
        location.href
      );


    if (
      !url.searchParams.has(
        "lago3d"
      )
    ) {

      return;

    }


    const value =
      url.searchParams.get(
        "lago3d"
      );


    if (
      value === "1"
    ) {

      enabled =
        true;


      localStorage.setItem(
        STORAGE_KEY,
        "1"
      );

    }


    if (
      value === "0"
    ) {

      enabled =
        false;


      localStorage.removeItem(
        STORAGE_KEY
      );

    }


    url.searchParams.delete(
      "lago3d"
    );


    history.replaceState(
      {},
      "",
      url.pathname +
      url.search +
      url.hash
    );

  }



  function show2D(
    show
  ) {

    const el =
      image();


    if (!el) {

      return;

    }


    el.style.display =
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

  }



  function resize() {

    if (
      !renderer ||
      !camera ||
      !area()
    ) {

      return;

    }


    const rect =
      area()
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
     * GLB master is Z-up.
     *
     * Convert once to
     * Three.js Y-up.
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


    canvas.setAttribute(
      "aria-label",
      "Lago 3D"
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
        devicePixelRatio ||
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
     * 3D Lago remains
     * a real Tap Lago button.
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


    new ResizeObserver(
      resize
    ).observe(
      host
    );


    resize();


    renderer.setAnimationLoop(
      () => {

        const time =
          performance.now() *
          0.001;


        if (model) {

          tapKick *=
            0.82;


          /*
           * Very light idle.
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
           * TAP squash.
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



  function loadModel() {

    if (
      ready ||
      loading
    ) {

      return;

    }


    if (
      !renderer &&
      !createRenderer()
    ) {

      return;

    }


    loading =
      true;


    new GLTFLoader()
      .load(

        MODEL_URL,


        gltf => {

          model =
            gltf.scene;


          normalizeModel(
            model
          );


          holder.add(
            model
          );


          loading =
            false;


          ready =
            true;


          apply();

        },


        undefined,


        error => {

          loading =
            false;


          console.error(
            "[LAGO 3D] GLB load failed",
            error
          );


          /*
           * Fail-safe:
           * never lose 2D Lago.
           */

          show3D(
            false
          );


          show2D(
            true
          );

        }

      );

  }



  function apply() {

    const use3D =
      enabled &&
      isBaseLago();


    /*
     * Comic character /
     * Lago skin:
     * keep existing 2D runtime.
     */

    if (!use3D) {

      show3D(
        false
      );


      show2D(
        true
      );


      return false;

    }


    /*
     * Keep the PNG visible
     * while the GLB loads.
     */

    if (!ready) {

      show3D(
        false
      );


      show2D(
        true
      );


      loadModel();


      return false;

    }


    show2D(
      false
    );


    show3D(
      true
    );


    resize();


    return true;

  }



  function enable() {

    enabled =
      true;


    localStorage.setItem(
      STORAGE_KEY,
      "1"
    );


    apply();


    return true;

  }



  function disable() {

    enabled =
      false;


    localStorage.removeItem(
      STORAGE_KEY
    );


    apply();


    return true;

  }



  consumeURLToggle();



  document.addEventListener(
    "lago:state",
    apply
  );


  document.addEventListener(
    "lago:character-equipped",
    apply
  );


  document.addEventListener(
    "DOMContentLoaded",
    apply
  );



  window.LAGO_CHARACTER_3D =
    Object.freeze({

      version:
        VERSION,

      enable,

      disable,

      enabled:
        () =>
          enabled,

      apply

    });



  apply();

})();

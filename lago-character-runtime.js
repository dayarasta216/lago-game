(() => {
  "use strict";


  const VERSION =
    2;


  const DEFAULT_ASSET =
    "./lago-snail.png";


  /*
   * =========================================================
   * CHARACTER FALLBACK RUNTIME
   * =========================================================
   *
   * GLB is the primary gameplay renderer.
   *
   * This module manages ONLY the hidden / emergency
   * 2D fallback image #snail.
   *
   * It must never decide whether 3D is visible.
   * lago-character-3d.js owns that responsibility.
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


  function character() {

    const id =
      selectedId();


    return (
      window.LAGO_CHARACTERS
        ?.getById
        ?.(
          id
        ) ||
      null
    );

  }


  function validAsset(
    value
  ) {

    return (
      typeof value ===
        "string" &&
      value.trim().length >
        0
    );

  }


  function apply() {

    const element =
      image();


    if (!element) {

      return false;

    }


    const selected =
      selectedId();


    const currentCharacter =
      character();


    /*
     * =====================================================
     * COMIC CHARACTER
     * =====================================================
     */

    if (
      currentCharacter
    ) {

      /*
       * Existing characters may still have
       * a temporary 2D preview asset.
       *
       * Future GLB-only characters do not need one.
       */
      const fallback =
        validAsset(
          currentCharacter.asset
        )
          ? currentCharacter.asset
          : DEFAULT_ASSET;


      if (
        element.getAttribute(
          "src"
        ) !==
        fallback
      ) {

        element.setAttribute(
          "src",
          fallback
        );

      }


      element.alt =
        currentCharacter.name ||
        "Lago character";


      element.dataset
        .lagoCharacter =
        currentCharacter.id;


      element.dataset
        .lagoRenderer =
        currentCharacter.model3d
          ? "glb-primary"
          : "2d";


      return true;

    }


    /*
     * =====================================================
     * LAGO / LAGO SKINS
     * =====================================================
     *
     * Original Lago GLB is primary for default Lago.
     *
     * Lago cosmetic skins may still be handled by
     * existing 2D compatibility until their future
     * character/skin renderer is migrated.
     */

    if (
      element.getAttribute(
        "src"
      ) !==
      DEFAULT_ASSET
    ) {

      element.setAttribute(
        "src",
        DEFAULT_ASSET
      );

    }


    element.alt =
      "LAGO";


    delete element.dataset
      .lagoCharacter;


    element.dataset
      .lagoRenderer =
      (
        selected ===
          "default" ||
        selected ===
          "lago"
      )
        ? "glb-primary"
        : "2d";


    return true;

  }


  /*
   * Account / Collection changes.
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
   * Modern UI can move #snail into
   * the canonical character stage.
   */

  document.addEventListener(
    "lago:modern-ready",
    apply
  );


  window.LAGO_CHARACTER_RUNTIME =
    Object.freeze({

      version:
        VERSION,

      apply

    });


  apply();

})();

(() => {
  "use strict";

  const VERSION = 1;

  const DEFAULT_ASSET =
    "./lago-snail.png";


  function getSelectedSkin() {

    return (
      window.LAGO
        ?.getState
        ?.()
        ?.selectedSkin ||
      "default"
    );

  }


  function resolveCharacter() {

    const selected =
      getSelectedSkin();

    return (
      window.LAGO_CHARACTERS
        ?.getById
        ?.(
          selected
        ) ||
      null
    );

  }


  function apply() {

    const image =
      document.getElementById(
        "snail"
      );

    if (!image)
      return false;


    const character =
      resolveCharacter();


    if (character) {

      image.setAttribute(
        "src",
        character.asset
      );

      image.alt =
        character.name;

      image.dataset
        .lagoCharacter =
        character.id;

    } else {

      image.setAttribute(
        "src",
        DEFAULT_ASSET
      );

      image.alt =
        "LAGO";

      delete image.dataset
        .lagoCharacter;

    }


    return true;

  }


  document.addEventListener(
    "lago:state",
    apply
  );


  document.addEventListener(
    "DOMContentLoaded",
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

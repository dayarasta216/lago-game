(() => {
  "use strict";


  /*
   * =========================================================
   * LAGO CHARACTER AUDIO
   * =========================================================
   *
   * Unique TAP feedback for every real character.
   *
   * Lago skins use the Lago sound because they are skins,
   * not separate characters.
   *
   * Future custom creatures can receive their own
   * audioProfile without changing Tap Lago.
   * =========================================================
   */


  const VERSION =
    1;


  function runtime() {

    return (
      window.LAGO_LEGACY_RUNTIME ||
      null
    );

  }


  function selectedCharacterId() {

    const selected =
      window.LAGO
        ?.getState
        ?.()
        ?.selectedSkin ||
      "default";


    if (
      window.LAGO_CHARACTERS
        ?.isComicCharacter
        ?.(
          selected
        ) ===
      true
    ) {

      return selected;

    }


    /*
     * default / lime / ocean /
     * galaxy / lava / gold /
     * void / diamond
     *
     * are all Lago.
     */
    return "lago";

  }


  function tone(
    frequency,
    duration,
    type = "sine",
    delay = 0
  ) {

    window.setTimeout(
      () => {

        runtime()
          ?.beep
          ?.(
            frequency,
            duration,
            type
          );

      },
      Math.max(
        0,
        delay
      )
    );

  }


  /*
   * =========================================================
   * LAGO
   *
   * Soft stupid plop.
   * =========================================================
   */

  function lagoTap() {

    tone(
      205,
      0.035,
      "sine"
    );

    tone(
      145,
      0.045,
      "triangle",
      26
    );

  }


  /*
   * =========================================================
   * NAREK
   *
   * Low comic dog/snail double bump.
   * =========================================================
   */

  function narekTap() {

    tone(
      125,
      0.045,
      "square"
    );

    tone(
      172,
      0.055,
      "triangle",
      38
    );

  }


  /*
   * =========================================================
   * SOLA
   *
   * Bright two-step chirp.
   * =========================================================
   */

  function solaTap() {

    tone(
      690,
      0.028,
      "sine"
    );

    tone(
      960,
      0.036,
      "sine",
      28
    );

  }


  /*
   * =========================================================
   * БАМБИНИ "ДОК"
   *
   * Nervous insect click.
   * =========================================================
   */

  function bambiniTap() {

    tone(
      330,
      0.016,
      "square"
    );

    tone(
      245,
      0.016,
      "square",
      18
    );

    tone(
      390,
      0.018,
      "square",
      36
    );

  }


  /*
   * =========================================================
   * МАРВИН
   *
   * Weird bird/giraffe squawk.
   * =========================================================
   */

  function marvinTap() {

    tone(
      510,
      0.025,
      "sawtooth"
    );

    tone(
      770,
      0.038,
      "triangle",
      25
    );

  }


  /*
   * =========================================================
   * ФАРИД
   *
   * Dry fennec yip.
   * =========================================================
   */

  function faridTap() {

    tone(
      440,
      0.020,
      "square"
    );

    tone(
      650,
      0.032,
      "sine",
      23
    );

  }


  const TAP_PROFILES =
    Object.freeze({

      lago:
        lagoTap,

      comic_dog_snail:
        narekTap,

      comic_pink_snail:
        solaTap,

      comic_cockroach:
        bambiniTap,

      comic_giraffe_bird:
        marvinTap,

      comic_fennec:
        faridTap

    });


  function playTap() {

    const id =
      selectedCharacterId();


    const player =
      TAP_PROFILES[id] ||
      TAP_PROFILES.lago;


    player();


    return id;

  }


  window.LAGO_CHARACTER_AUDIO =
    Object.freeze({

      version:
        VERSION,

      playTap,

      selectedCharacterId

    });

})();

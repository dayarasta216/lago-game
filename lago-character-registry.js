(() => {
  "use strict";


  const VERSION =
    1;


  /*
   * =========================================================
   * COMIC CHARACTER REGISTRY
   * =========================================================
   *
   * Stable technical IDs MUST NOT be renamed later.
   *
   * Display names may change without breaking saves.
   *
   * Comic characters are complete characters.
   * They are NOT donor parts for Creature Creator.
   */


  const CHARACTERS =
    Object.freeze([

      /*
       * =====================================================
       * NAREK
       * =====================================================
       */
      Object.freeze({

        id:
          "comic_dog_snail",

        name:
          "Narek",

        type:
          "comic",

        series:
          "comic-01",

        rarity:
          "LEGENDARY",

    
asset:
  "./assets/characters/comic-narek(5).svg?v=8",

        shop:
          Object.freeze({

            enabled:
              true,

            currency:
              "SP",

            /*
             * Temporary balance value.
             * Can be changed later
             * without changing character ID.
             */
            price:
              150000

          }),


        /*
         * Alternative FREE acquisition route.
         *
         * 1200 minutes = 20 active hours.
         */
        playtimeUnlock:
          Object.freeze({

            enabled:
              true,

            minutes:
              1200

          }),


        dailyReward:
          false

      }),



      /*
       * =====================================================
       * SOLA
       * =====================================================
       */
      Object.freeze({

        id:
          "comic_pink_snail",

        name:
          "Sola",

        type:
          "comic",

        series:
          "comic-01",

        rarity:
          "EPIC",

 asset:
  "./assets/characters/comic-sola(4).svg?v=8",

        shop:
          Object.freeze({

            enabled:
              true,

            currency:
              "SP",

            price:
              190000

          }),


        playtimeUnlock:
          Object.freeze({

            enabled:
              false,

            minutes:
              0

          }),


        dailyReward:
          false

      }),



      /*
       * =====================================================
       * БАМБИНИ "ДОК"
       * =====================================================
       */
      Object.freeze({

        id:
          "comic_cockroach",

        name:
          'Бамбини "Док"',

        type:
          "comic",

        series:
          "comic-01",

        rarity:
          "EPIC",

     asset:
  "./assets/characters/comic-bambini-doc(5).svg?v=8",

        shop:
          Object.freeze({

            enabled:
              true,

            currency:
              "SP",

            price:
              260000

          }),


        playtimeUnlock:
          Object.freeze({

            enabled:
              false,

            minutes:
              0

          }),


        dailyReward:
          false

      }),



      /*
       * =====================================================
       * МАРВИН
       * =====================================================
       */
      Object.freeze({

        id:
          "comic_giraffe_bird",

        name:
          "Марвин",

        type:
          "comic",

        series:
          "comic-01",

        rarity:
          "LEGENDARY",

     asset:
  "./assets/characters/comic-marvin(5).svg?v=8",
        
        shop:
          Object.freeze({

            enabled:
              true,

            currency:
              "SP",

            price:
              330000

          }),


        playtimeUnlock:
          Object.freeze({

            enabled:
              false,

            minutes:
              0

          }),


        dailyReward:
          false

      }),



      /*
       * =====================================================
       * ФАРИД
       * =====================================================
       */
      Object.freeze({

        id:
          "comic_fennec",

        name:
          "Фарид",

        type:
          "comic",

        series:
          "comic-01",

        rarity:
          "LEGENDARY",

asset:
  "./assets/characters/comic-farid(5).svg?v=8",

        shop:
          Object.freeze({

            enabled:
              true,

            currency:
              "SP",

            price:
              500000

          }),


        /*
         * 3000 minutes = 50 active hours.
         */
        playtimeUnlock:
          Object.freeze({

            enabled:
              true,

            minutes:
              3000

          }),


        dailyReward:
          false

      })

    ]);



  /*
   * =========================================================
   * HELPERS
   * =========================================================
   */


  function clone(
    value
  ) {

    return JSON.parse(
      JSON.stringify(
        value
      )
    );

  }



  function getAll() {

    return CHARACTERS
      .map(
        clone
      );

  }



  function getById(
    id
  ) {

    const key =
      String(
        id || ""
      )
        .trim();


    const character =
      CHARACTERS
        .find(
          item =>
            item.id ===
            key
        );


    return character
      ? clone(
          character
        )
      : null;

  }



  function getShopCharacters() {

    return getAll()
      .filter(
        character =>
          character
            .shop
            ?.enabled ===
          true
      );

  }



  function getPlaytimeUnlockCharacters() {

    return getAll()
      .filter(
        character =>

          character
            .playtimeUnlock
            ?.enabled ===
          true &&

          Number(
            character
              .playtimeUnlock
              ?.minutes
          ) > 0

      );

  }



  function isComicCharacter(
    id
  ) {

    return Boolean(
      getById(
        id
      )
    );

  }



  /*
   * =========================================================
   * DEVELOPMENT INTEGRITY GATE
   * =========================================================
   *
   * Duplicate IDs would corrupt ownership / saves.
   */


  const ids =
    CHARACTERS
      .map(
        character =>
          character.id
      );


  if (
    new Set(
      ids
    ).size !==
    ids.length
  ) {

    throw new Error(
      "[LAGO CHARACTERS] Duplicate character ID."
    );

  }



  window.LAGO_CHARACTERS =
    Object.freeze({

      version:
        VERSION,

      getAll,

      getById,

      getShopCharacters,

      getPlaytimeUnlockCharacters,

      isComicCharacter

    });


})();

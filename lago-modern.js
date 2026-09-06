(() => {

  "use strict";


  function $(id) {
    return document.getElementById(id);
  }


  let tapState =
  null;


let dumRefreshTimer =
  null;


const TAP_HINTS = [

  "TAP TAP",

  "BANANA",

  "HIT THE SNAIL",

  "PRESS ME",

  "WAKE THE SNAIL",

  "TOUCH THE SNAIL",

  "DO IT AGAIN"

];


let currentTapHint =
  "";


let lastTapHintChange =
  0;


function translate(
  text
) {

  return (
    window.LAGO_LANGUAGE
      ?.translate
      ?.(text) ??
    text
  );

}


function setTapHint(
  value = null,
  force = false
) {

  const element =
    $("lagoTapHint");


  if (!element) {
    return;
  }


  const now =
    Date.now();


  /*
   * Prevent Safari focus +
   * visibilitychange from changing
   * the text twice instantly.
   */

  if (
    !force &&
    now -
      lastTapHintChange <
      350
  ) {

    return;

  }


  let next =
    value;


  if (!next) {

    const available =
      TAP_HINTS.filter(
        item =>
          item !==
          currentTapHint
      );


    next =
      available[
        Math.floor(
          Math.random() *
          available.length
        )
      ] ||
      TAP_HINTS[0];

  }


  currentTapHint =
    next;


  lastTapHintChange =
    now;


  element.textContent =
    String(
      translate(next)
    ).toUpperCase();

}

function readTapState() {

  try {

    if (
      window.LAGO_TAP_GAME &&
      typeof window.LAGO_TAP_GAME.getState === "function"
    ) {

      return window.LAGO_TAP_GAME.getState();

    }

  } catch (error) {

    console.warn(
      "[LAGO MODERN] Could not read Tap Lago state:",
      error
    );

  }


  return tapState || {
    energy: 0,
    power: 1,
    auto: 0,
    shield: 0,
    days: 0,
    speech: ""
  };

}

/*
 * =========================================================
 * CANONICAL DUM ENERGY
 * =========================================================
 */

function readDumEnergy() {

  try {

    if (
      window.LAGO_ACCOUNT &&
      typeof window.LAGO_ACCOUNT
        .getDumEnergy ===
        "function"
    ) {

      return window.LAGO_ACCOUNT
        .getDumEnergy();

    }

  } catch (error) {

    console.warn(
      "[LAGO MODERN] Could not read DUM Energy:",
      error
    );

  }


  return {

    dum:
      0,

    max:
      100,

    tapCounter:
      0

  };

}


function renderDumEnergy() {

  const energy =
    readDumEnergy();


  $("modernEnergy")
    ?.replaceChildren(
      `${Math.floor(
        Number(
          energy.dum
        ) || 0
      )} / ${Math.floor(
        Number(
          energy.max
        ) || 100
      )}`
    );

}


/*
 * Keep visible DUM synchronized
 * with Account Core regeneration.
 */
function startDumRefresh() {

  if (
    dumRefreshTimer
  ) {

    return;

  }


  renderDumEnergy();


  dumRefreshTimer =
    setInterval(
      renderDumEnergy,
      1000
    );

}
  
  function createUI() {

    if (
      document.getElementById(
        "lagoModern"
      )
    ) return;


    const root =
      document.createElement("div");

    root.id =
      "lagoModern";


    root.innerHTML = `

      <!-- HEADER -->

      <header
        class="lago-modern-header"
      >

        <div class="lago-brand">

          <div
            class="lago-brand-name"
          >
            LAGO
          </div>

          <div
            class="lago-brand-tag"
          >
            BRAIN SNAIL
          </div>

        </div>


     <nav class="lago-main-nav">

  <button
    class="lago-nav-btn active"
    data-page="play"
  >
    <span
      class="lago-icon-slot"
      data-lago-icon="play"
    ></span>

    <span>PLAY</span>
  </button>


  <button
    class="lago-nav-btn"
    data-page="games"
  >
    <span
      class="lago-icon-slot"
      data-lago-icon="games"
    ></span>

    <span>GAMES</span>
  </button>


  <button
    class="lago-nav-btn"
    data-page="create"
  >
    <span
      class="lago-icon-slot"
      data-lago-icon="create"
    ></span>

    <span>CREATE</span>
  </button>


  <button
    class="lago-nav-btn"
    data-page="collection"
  >
    <span
      class="lago-icon-slot"
      data-lago-icon="collection"
    ></span>

    <span>COLLECTION</span>
  </button>


  <button
    class="lago-nav-btn"
    data-page="shop"
  >
    <span
      class="lago-icon-slot"
      data-lago-icon="shop"
    ></span>

    <span>SHOP</span>
  </button>

</nav>


       <button
  class="lago-profile"
  id="lagoProfileButton"
  type="button"
>

  <div
    class="lago-profile-icon"
    id="lagoHeaderAvatar"
  >
    🐌
  </div>

  <div class="lago-profile-text">

    <div
      class="lago-profile-level"
      id="lagoHeaderName"
    >
      LAGO PLAYER
    </div>

    <div class="lago-profile-value">
      LEVEL
      <span id="modernLevel">
        1
      </span>
    </div>

  </div>

</button>

      </header>


      <!-- STATS -->

      <section
        class="lago-statbar"
      >

        <div
          class="lago-stat-card"
        >

          <div class="lago-stat-label">

  <span
    class="lago-icon-slot"
    data-lago-icon="dum"
  ></span>

  <span>
    DUM ENERGY
  </span>

</div>
          <div
            class="lago-stat-value"
            id="modernEnergy"
          >
            0
          </div>

        </div>


        <div
          class="lago-stat-card"
        >

          <div class="lago-stat-label">

  <span
    class="lago-icon-slot"
    data-lago-icon="power"
  ></span>

  <span>
    CLICK POWER
  </span>

</div>

          <div
            class="lago-stat-value"
            id="modernPower"
          >
            1
          </div>

        </div>


        <div
          class="lago-stat-card"
        >

         <div class="lago-stat-label">

  <span
    class="lago-icon-slot"
    data-lago-icon="auto"
  ></span>

  <span>
    PER SECOND
  </span>

</div>

          <div
            class="lago-stat-value"
            id="modernAuto"
          >
            0
          </div>

        </div>


        <div
          class="lago-stat-card"
        >

          <div
  class="lago-stat-card"
>

  <div class="lago-stat-label">

    <span
      class="lago-icon-slot"
      data-lago-icon="sp"
    ></span>

    <span>
      SP
    </span>

  </div>

  <div
    class="lago-stat-value"
    id="modernSP"
  >
    0
  </div>

</div>


<div
  class="lago-stat-card"
>

  <div class="lago-stat-label">

    <span
      class="lago-icon-slot"
      data-lago-icon="upgrade"
    ></span>

    <span>
      LEVEL
    </span>

  </div>

  <div
    class="lago-stat-value"
    id="modernLevelStat"
  >
    1
  </div>

</div>


<div
  class="lago-stat-card"
>

  <div class="lago-stat-label">

    <span
      class="lago-icon-slot"
      data-lago-icon="dum"
    ></span>

    <span>
      TAP COST
    </span>

  </div>

  <div
    class="lago-stat-value"
    id="modernTapCost"
  >
    1 DUM / 5 TAPS
  </div>

</div>
      </section>


      <!-- GAME -->

      <main
        class="lago-game-area"
      >

        <!-- LEFT -->

        <aside
          class="lago-side"
        >

          <div
            class="lago-side-card"
          >

            <div
              class="lago-side-title"
            >
              NEXT LEVEL
            </div>

            <div
  class="lago-side-big"
  id="modernXP"
>
  0 SP
</div>
            <div
              class="lago-progress"
            >
              <i
                id="modernProgress"
              ></i>
            </div>

          </div>


          <button
            class="lago-action"
            data-action="upgrade"
          >

            <div
  class="lago-action-icon"
  data-lago-icon="upgrade"
></div>

            <div>

              <div
                class="lago-action-text"
              >
                UPGRADE
              </div>

              <div
                class="lago-action-sub"
              >
                Make Lago stupider
              </div>

            </div>

          </button>


          <button
  class="lago-action"
  data-action="steal"
>

  <div
    class="lago-action-icon"
    data-lago-icon="steal"
  ></div>

  <div>

    <div
      class="lago-action-text"
    >
      STEAL
    </div>

    <div
      class="lago-action-sub"
    >
      Do something illegal
    </div>

  </div>

</button>

        </aside>


        <!-- CENTER -->

        <section
          class="lago-center"
        >

          <div
  class="lago-center-title"
  id="lagoCharacterName"
>
  LAGO
</div>


          <div
            class="lago-center-sub"
          >
            THE DUMBEST SNAIL ON THE INTERNET
          </div>


          <div
            class="lago-modern-snail"
            id="modernSnailArea"
          ></div>


          <div
            class="lago-speech"
            id="modernSpeech"
          >
            I HAVE NO IDEA WHAT I'M DOING.
          </div>


         <div
  class="lago-tap-hint"
  id="lagoTapHint"
  aria-live="polite"
>
  TAP TAP
</div>

        </section>

<!-- RIGHT -->

<aside class="lago-side">

  <div class="lago-side-card">

    <div class="lago-side-title">
      YOUR LAGO
    </div>

    <div class="lago-side-big">
      🐌
    </div>

    <div class="lago-side-desc">
      Name it whatever you want.
      Nobody knows what Lago is.
    </div>

  </div>

</aside>

      </main>


      <!-- BOTTOM -->

    <nav class="lago-bottom">

  <button
    class="lago-bottom-btn active"
    data-page="play"
  >
    <span
      class="lago-icon-slot"
      data-lago-icon="play"
    ></span>

    <span>PLAY</span>
  </button>


  <button
    class="lago-bottom-btn"
    data-page="games"
  >
    <span
      class="lago-icon-slot"
      data-lago-icon="games"
    ></span>

    <span>GAMES</span>
  </button>


  <button
    class="lago-bottom-btn"
    data-page="create"
  >
    <span
      class="lago-icon-slot"
      data-lago-icon="create"
    ></span>

    <span>CREATE</span>
  </button>


  <button
    class="lago-bottom-btn"
    data-page="collection"
  >
    <span
      class="lago-icon-slot"
      data-lago-icon="collection"
    ></span>

    <span>COLLECTION</span>
  </button>


  <button
    class="lago-bottom-btn"
    data-page="shop"
  >
    <span
      class="lago-icon-slot"
      data-lago-icon="shop"
    ></span>

    <span>SHOP</span>
  </button>

</nav>

`;


document.body.appendChild(
  root
);
window.LAGO_UI
  ?.hydrate
  ?.(root);

    /*
     * Move the ORIGINAL snail
     * into our new center.
     */

    const snail =
      $("snail");


    const snailArea =
      $("modernSnailArea");


    if (
      snail &&
      snailArea
    ) {

      snailArea.appendChild(
        snail
      );

    }


    /*
 * Read the initial Tap Lago state
 * through the public game API.
 */

tapState =
  readTapState();


bind();

update(
  tapState
);


startDumRefresh();


setTapHint(
  null,
  true
);

}


function bind() {

  /*
   * Main TAP.
   */




  /*
   * Daily.
   */

  /*
   * Side actions.
   */

  document
    .querySelectorAll(
      "[data-action]"
    )
    .forEach(
      button => {

        button.addEventListener(
          "click",
          () => {

            const action =
              button.dataset.action;


            if (
              action ===
              "upgrade"
            ) {

              window.LAGO_TAP_GAME
                ?.openUpgrades
                ?.();

              return;

            }


            if (
              action ===
              "steal"
            ) {

              window.LAGO_TAP_GAME
                ?.steal
                ?.();

              return;

            }


          if (
  action ===
  "create"
) {

  window.LAGO_CREATOR
    ?.open
    ?.();

  return;

}

            if (
              action ===
              "collection"
            ) {

              window.LAGO_COLLECTION
                ?.show
                ?.();

            }

          }
        );

      }
    );


  /*
   * Navigation.
   */

  document
    .querySelectorAll(
      "[data-page]"
    )
    .forEach(
      button => {

        button.addEventListener(
          "click",
          () => {

            navigate(
              button.dataset.page
            );

          }
        );

      }
    );


  /*
   * Tap Lago publishes its own
   * state after every render.
   */

  document.addEventListener(
    "lago:tap-game-state",
    event => {

      tapState = {
        ...(tapState || {}),
        ...(event.detail || {})
      };

      update(
        tapState
      );

    }
  );


  /*
   * Account-level XP / level state.
   */

  document.addEventListener(
    "lago:state",
    () => {

      update();

    }
  );

document.addEventListener(
  "lago:language",
  () => {

    update(
      tapState
    );


    setTapHint(
      currentTapHint ||
      TAP_HINTS[0],
      true
    );

  }
);
    document.addEventListener(
  "visibilitychange",
  () => {

    if (
      document.visibilityState ===
      "visible"
    ) {

      setTapHint();

    }

  }
);


window.addEventListener(
  "focus",
  () => {

    setTapHint();

  }
);
    $("lagoProfileButton")
  ?.addEventListener(
    "click",
    () => {

      setTapHint();

    }
  );
  }

  function navigate(
  page
) {

  document
    .querySelectorAll(
      "[data-page]"
    )
    .forEach(
      button => {

        button.classList.toggle(
          "active",
          button.dataset.page ===
          page
        );

      }
    );

/*
 * When the player leaves Play,
 * prepare another stupid hint
 * for when they return.
 */

setTapHint();
    
  if (
  page === "games"
) {

  window.LAGO_GAMES
    ?.show
    ?.();

  return;

}


  if (
  page === "create"
) {

  window.LAGO_CREATOR
    ?.open
    ?.();

  return;

}

  if (
    page === "collection"
  ) {

    window.LAGO_COLLECTION
      ?.show
      ?.();

    return;

  }


  if (
    page === "shop"
  ) {

    window.LAGO_TAP_GAME
      ?.openUpgrades
      ?.();

  }

}

  function update(
  nextTapState = null
) {

  if (
    nextTapState &&
    typeof nextTapState === "object"
  ) {

    tapState = {
      ...(tapState || {}),
      ...nextTapState
    };

  }


  const game =
    tapState ||
    readTapState();


  tapState =
    game;


 /*
 * DUM comes only from
 * Account Core.
 *
 * Never render legacy
 * Tap Lago energy here.
 */

renderDumEnergy();


  /*
   * Account-level progress.
   */

 let level =
  1;

let sp =
  0;


try {

  const account =
    window.LAGO_ACCOUNT
      ?.getState
      ?.() ||
    window.LAGO
      ?.getState
      ?.();


  if (account) {

    level =
      Math.max(
        1,
        Math.floor(
          Number(
            account.economy
              ?.level ??
            account.level
          ) || 1
        )
      );


    sp =
      Math.max(
        0,
        Math.floor(
          Number(
            account.economy
              ?.sp ??
            account.xp
          ) || 0
        )
      );

  }

} catch (error) {

  console.warn(
    "[LAGO MODERN] Could not read account state:",
    error
  );

}


$("modernLevel")
  ?.replaceChildren(
    String(level)
  );


$("modernLevelStat")
  ?.replaceChildren(
    String(level)
  );


$("modernSP")
  ?.replaceChildren(
    String(sp)
  );


$("modernXP")
  ?.replaceChildren(
    `${sp} SP`
  );


const bar =
  $("modernProgress");


if (bar) {

  bar.style.width =
    `${Math.min(
      100,
      sp % 100
    )}%`;

}

  /*
   * Speech comes from Tap Lago state,
   * not from the legacy #cringe node.
   */

  if (
  game.speech &&
  $("modernSpeech")
) {

  const originalSpeech =
    String(
      game.speech
    ).trim();


 const translatedSpeech =
  window.LAGO_LANGUAGE
    ?.translate
    ?.(originalSpeech) ??
  originalSpeech;

  $("modernSpeech")
    .textContent =
    String(
      translatedSpeech
    )
      .trim()
      .toUpperCase();

}
/*
 * End update()
 */
}


if (
  document.readyState === "loading"
) {

  document.addEventListener(
    "DOMContentLoaded",
    createUI,
    {
      once: true
    }
  );

} else {

  createUI();

  }

})();

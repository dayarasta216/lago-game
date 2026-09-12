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

  let activeTapPointer =
  null;

  function beginCharacterTap(
  event
) {

  /*
   * Не принимаем искусственные
   * JS-generated события.
   */
  if (
    event.isTrusted !== true
  ) {

    return;

  }


  if (
    event.pointerType ===
      "mouse" &&
    event.button !== 0
  ) {

    return;

  }


  activeTapPointer = {

    id:
      event.pointerId,

    startedAt:
      performance.now(),

    pointerType:
      event.pointerType || "unknown",

    minPressure:
      Number(
        event.pressure
      ) || 0,

    maxPressure:
      Number(
        event.pressure
      ) || 0,

    maxArea:
      Math.max(
        1,

        (
          Number(
            event.width
          ) || 1
        ) *

        (
          Number(
            event.height
          ) || 1
        )
      )

  };

}


function updateCharacterTap(
  event
) {

  if (
    !activeTapPointer ||
    activeTapPointer.id !==
      event.pointerId
  ) {

    return;

  }


  const pressure =
    Number(
      event.pressure
    ) || 0;


  activeTapPointer.minPressure =
    Math.min(
      activeTapPointer.minPressure,
      pressure
    );


  activeTapPointer.maxPressure =
    Math.max(
      activeTapPointer.maxPressure,
      pressure
    );


  const area =
    Math.max(
      1,

      (
        Number(
          event.width
        ) || 1
      ) *

      (
        Number(
          event.height
        ) || 1
      )
    );


  activeTapPointer.maxArea =
    Math.max(
      activeTapPointer.maxArea,
      area
    );

}


function finishCharacterTap(
  event
) {

  if (
    !activeTapPointer ||
    activeTapPointer.id !==
      event.pointerId
  ) {

    return;

  }


  updateCharacterTap(
    event
  );


  const sample = {

    pointerType:
      activeTapPointer.pointerType,

    duration:
      Math.max(
        1,

        performance.now() -
          activeTapPointer.startedAt
      ),

    minPressure:
      activeTapPointer.minPressure,

    maxPressure:
      activeTapPointer.maxPressure,

    maxArea:
      activeTapPointer.maxArea

  };


  activeTapPointer =
    null;


  window.LAGO_CHARACTER_3D
    ?.pulseTap
    ?.();


  window.LAGO_TAP_GAME
    ?.tap
    ?.(
      event,
      sample
    );

}


function cancelCharacterTap(
  event
) {

  if (
    activeTapPointer?.id ===
      event.pointerId
  ) {

    activeTapPointer =
      null;

  }

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

    <div
      class="lago-stat-label"
    >

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
      0 / 100
    </div>

  </div>


  <div
    class="lago-stat-card"
  >

    <div
      class="lago-stat-label"
    >

      <span
        class="lago-icon-slot"
        data-lago-icon="power"
      ></span>

      <span>
        CLICKS
      </span>

    </div>

    <div
      class="lago-stat-value"
      id="modernClicks"
    >
      0
    </div>

  </div>


  <div
    class="lago-stat-card"
  >

    <div
      class="lago-stat-label"
    >

      <span
        class="lago-icon-slot"
        data-lago-icon="auto"
      ></span>

      <span>
        SP / SEC
      </span>

    </div>

    <div
      class="lago-stat-value"
      id="modernAutoRate"
    >
      0 SP/S
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
  class="lago-progress-meta"
>

  <div
    class="lago-side-title"
  >
    SP BALANCE
  </div>

  <div
    class="lago-level-chip"
  >
    LEVEL
    <span
      id="modernLevelStat"
    >
      1
    </span>
  </div>

</div>


<div
  class="lago-side-big"
  id="modernSPBalance"
>
  0 SP
</div>


<div
  class="lago-progress-caption"
>

  <span>
    LEVEL PROGRESS
  </span>

  <span
    id="modernLevelProgressText"
  >
    0 / 100 SP
  </span>

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
  Increase AUTO SP / SEC
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

<aside
  class="lago-side lago-right-dashboard"
>

  <div
    class="lago-side-card lago-dashboard-card"
  >

    <div
      class="lago-side-title"
    >
      DAILY BONUS
    </div>


    <div
      class="lago-dashboard-row"
    >

      <div
        class="lago-dashboard-icon"
      >
        <span
          class="lago-icon-slot"
          data-lago-icon="daily"
        ></span>
      </div>


      <div>

        <div
          class="lago-dashboard-status"
        >
          COMING NEXT
        </div>

        <div
          class="lago-side-desc"
        >
          Daily rewards and streak.
        </div>

      </div>

    </div>

  </div>


  <div
    class="lago-side-card lago-dashboard-card"
  >

    <div
      class="lago-side-title"
    >
      DAILY TASKS
    </div>


    <div
      class="lago-dashboard-value"
    >
      0 / 3
    </div>


    <div
      class="lago-side-desc"
    >
      Tap. Play. Complete tasks.
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

if (
  snailArea &&
  snailArea.dataset
    .physicalTapBound !==
    "1"
) {

  snailArea.dataset
    .physicalTapBound =
    "1";


  snailArea.addEventListener(
    "pointerdown",
    beginCharacterTap,
    {
      passive:
        true
    }
  );


  snailArea.addEventListener(
    "pointermove",
    updateCharacterTap,
    {
      passive:
        true
    }
  );


  snailArea.addEventListener(
    "pointerup",
    finishCharacterTap,
    {
      passive:
        true
    }
  );


  snailArea.addEventListener(
    "pointercancel",
    cancelCharacterTap,
    {
      passive:
        true
    }
  );

}
    
/*
 * =========================================================
 * CANONICAL TAP SURFACE
 * =========================================================
 *
 * One interaction surface for:
 * - GLB
 * - emergency 2D
 * - future characters
 */

if (
  snailArea &&
  snailArea.dataset
    .lagoTapBound !==
    "1"
) {

  snailArea.dataset
    .lagoTapBound =
    "1";


  snailArea.addEventListener(
    "pointerdown",
    event => {

      /*
       * Ignore secondary mouse buttons.
       */
      if (
        event.pointerType ===
          "mouse" &&
        event.button !==
          0
      ) {

        return;

      }


      event.preventDefault();


      window.LAGO_CHARACTER_3D
        ?.pulseTap
        ?.();
      
    },
    {
      passive:
        false
    }
  );

}

    snailArea.addEventListener(
  "pointerdown",
  beginCharacterTap,
  {
    passive:
      true
  }
);


snailArea.addEventListener(
  "pointermove",
  updateCharacterTap,
  {
    passive:
      true
  }
);


snailArea.addEventListener(
  "pointerup",
  finishCharacterTap,
  {
    passive:
      true
  }
);


snailArea.addEventListener(
  "pointercancel",
  cancelCharacterTap,
  {
    passive:
      true
  }
);
    
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

  window.LAGO_SHOP
    ?.show
    ?.();

  return;

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
 * Total successful Tap Lago clicks.
 */
$("modernClicks")
  ?.replaceChildren(
    Math.max(
      0,
      Math.floor(
        Number(
          game.totalClicks
        ) || 0
      )
    ).toLocaleString(
      "ru-RU"
    )
  );


/*
 * Canonical AUTO SP rate.
 *
 * AUTO runtime is still disabled
 * until its DUM consumption rule
 * is implemented.
 */
let autoSpPerSecond =
  0;


try {

  const auto =
    window.LAGO_ACCOUNT
      ?.getTapAutoState
      ?.();


  autoSpPerSecond =
    Math.max(
      0,

      Math.floor(
        Number(
          auto
            ?.spPerSecond
        ) || 0
      )
    );

} catch (error) {

  console.warn(
    "[LAGO MODERN] Could not read AUTO rate:",
    error
  );

}


$("modernAutoRate")
  ?.replaceChildren(
    `${autoSpPerSecond} SP/S`
  );
  /*
   * Account-level progress.
   */

let level =
  1;

let spBalance =
  0;

let lifetimeSp =
  0;


try {

  const spState =
    window.LAGO_ACCOUNT
      ?.getSPState
      ?.();


  if (spState) {

    level =
      Math.max(
        1,
        Math.floor(
          Number(
            spState.level
          ) || 1
        )
      );


    spBalance =
  Math.max(
    0,
    Math.round(
      (
        Number(
          spState.balance
        ) || 0
      ) *
      100
    ) /
    100
  );


    lifetimeSp =
      Math.max(
        0,
          Number(
            spState.lifetimeEarned
          ) || 0
        )
      );

  } else {

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


      spBalance =
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


      lifetimeSp =
        Math.max(
          spBalance,
          Math.floor(
            Number(
              account.lifetime
                ?.spEarned
            ) || 0
          )
        );

    }

  }

} catch (error) {

  console.warn(
    "[LAGO MODERN] Could not read SP/LEVEL state:",
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


`${spBalance.toLocaleString(
  "en-US",
  {
    minimumFractionDigits:
      Number.isInteger(
        spBalance
      )
        ? 0
        : 2,

    maximumFractionDigits:
      2
  }
)} SP`


const levelProgress =
  lifetimeSp % 100;


$("modernLevelProgressText")
  ?.replaceChildren(
    `${levelProgress} / 100 SP`
  );


const bar =
  $("modernProgress");


if (bar) {

  bar.style.width =
    `${levelProgress}%`;

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

let activeTapPointer =
  null;


function beginCharacterTap(
  event
) {

  if (
    event.isTrusted !==
      true
  ) {

    return;

  }


  if (
    event.pointerType ===
      "mouse" &&
    event.button !==
      0
  ) {

    return;

  }


  const target =
    event.currentTarget;


  target
    ?.setPointerCapture
    ?.(
      event.pointerId
    );


  activeTapPointer = {

    id:
      event.pointerId,

    startedAt:
      performance.now(),

    pointerType:
      event.pointerType || "unknown",

    minPressure:
      Number(
        event.pressure
      ) || 0,

    maxPressure:
      Number(
        event.pressure
      ) || 0,

    maxArea:
      Math.max(
        1,
        (
          Number(event.width) ||
          1
        ) *
        (
          Number(event.height) ||
          1
        )
      )

  };

}


function updateCharacterTap(
  event
) {

  if (
    !activeTapPointer ||
    activeTapPointer.id !==
      event.pointerId
  ) {

    return;

  }


  const pressure =
    Number(
      event.pressure
    ) || 0;


  activeTapPointer.minPressure =
    Math.min(
      activeTapPointer.minPressure,
      pressure
    );


  activeTapPointer.maxPressure =
    Math.max(
      activeTapPointer.maxPressure,
      pressure
    );


  activeTapPointer.maxArea =
    Math.max(
      activeTapPointer.maxArea,

      (
        Number(event.width) ||
        1
      ) *
      (
        Number(event.height) ||
        1
      )
    );

}


function finishCharacterTap(
  event
) {

  if (
    !activeTapPointer ||
    activeTapPointer.id !==
      event.pointerId
  ) {

    return;

  }


  updateCharacterTap(
    event
  );


  const sample = {

    pointerType:
      activeTapPointer.pointerType,

    duration:
      Math.max(
        1,
        performance.now() -
          activeTapPointer.startedAt
      ),

    minPressure:
      activeTapPointer.minPressure,

    maxPressure:
      activeTapPointer.maxPressure,

    maxArea:
      activeTapPointer.maxArea

  };


  activeTapPointer =
    null;


  window.LAGO_CHARACTER_3D
    ?.pulseTap
    ?.();


  window.LAGO_TAP_GAME
    ?.tap
    ?.(
      event,
      sample
    );

}


function cancelCharacterTap(
  event
) {

  if (
    activeTapPointer?.id ===
      event.pointerId
  ) {

    activeTapPointer =
      null;

  }

}
  
/*
 * index.html loads this script
 * after the legacy DOM exists.
 *
 * Build the canonical UI immediately,
 * before the ES-module 3D renderer runs.
 */
createUI();

})();

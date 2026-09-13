"use strict";


/* =========================================================
   LAGO — LEGACY COMPATIBILITY RUNTIME
   ========================================================= */

const tg =
  window.Telegram?.WebApp;


if (tg) {

  tg.ready();

  tg.expand();


  try {

    tg.setHeaderColor(
      "#1a0a1a"
    );

    tg.setBackgroundColor(
      "#1a0a1a"
    );

  } catch (
    error
  ) {

    console.warn(
      "[LAGO TELEGRAM]",
      error
    );

  }

}


const SAVE_KEY =
  "lago_brainrot_save_v1";


const PHRASES = [

  "Я устааал...",

  "Ты тупой?",

  "Пук! 💨",

  "Ой, всё!",

  "Зачем?",

  "Скучно...",

  "Ещё!",

  "Кто я?",

  "Я улитка",

  "Лаго тупит",

  "Загружаюсь..."

];


const defaultState = {

  energy:
    0,

  power:
    1,

  auto:
    0,

  shield:
    0,

  days:
    0,

  lastDay:
    new Date()
      .toDateString(),

  totalClicks:
    0,

  steals:
    0,

  memesCreated:
    0,

  upgrades: {

    click:
      0,

    auto:
      0,

    shield:
      0

  },

  memes:
    [],

  achievements:
    {},

  telegramUser:
    null,

  wallet:
    null

};


let state =
  loadState();


let audioCtx =
  null;


/* =========================================================
   STORAGE
   ========================================================= */


function loadState() {

  try {

    const saved =
      JSON.parse(
        localStorage.getItem(
          SAVE_KEY
        )
      );


    if (
      !saved
    ) {

      return structuredClone(
        defaultState
      );

    }


    return deepMerge(
      structuredClone(
        defaultState
      ),
      saved
    );

  } catch (
    error
  ) {

    console.warn(
      "[LAGO LEGACY LOAD]",
      error
    );


    return structuredClone(
      defaultState
    );

  }

}


function deepMerge(
  base,
  saved
) {

  for (
    const key in saved
  ) {

    if (
      saved[key] &&
      typeof saved[key] ===
        "object" &&
      !Array.isArray(
        saved[key]
      ) &&
      base[key]
    ) {

      base[key] =
        deepMerge(
          base[key],
          saved[key]
        );

    } else {

      base[key] =
        saved[key];

    }

  }


  return base;

}


function save() {

  localStorage.setItem(
    SAVE_KEY,
    JSON.stringify(
      state
    )
  );

}


/* =========================================================
   TELEGRAM
   ========================================================= */


function initTelegramUser() {

  const user =
    tg
      ?.initDataUnsafe
      ?.user;


  if (
    !user
  ) {

    return;

  }


  const nextTelegramUser = {

    id:
      user.id,

    first_name:
      user.first_name ||
      "",

    username:
      user.username ||
      ""

  };


  const previousTelegramUser =
    state.telegramUser &&
    typeof state.telegramUser ===
      "object"

      ? state.telegramUser
      : null;


  const changed =
    !previousTelegramUser ||
    String(
      previousTelegramUser.id ??
      ""
    ) !==
      String(
        nextTelegramUser.id ??
        ""
      ) ||
    String(
      previousTelegramUser.first_name ??
      ""
    ) !==
      nextTelegramUser.first_name ||
    String(
      previousTelegramUser.username ??
      ""
    ) !==
      nextTelegramUser.username;


  state.telegramUser =
    nextTelegramUser;


  /*
   * Legacy storage is now
   * change-driven instead of writing
   * to localStorage every 5 seconds.
   */
  if (
    changed
  ) {

    save();

  }


  /*
   * Production Telegram initData
   * verification belongs to backend.
   */

}


initTelegramUser();

function getCanonicalClickCount() {

  const accountState =
    window.LAGO_ACCOUNT
      ?.getState
      ?.();


  const accountClicks =
    Number(
      accountState
        ?.clicks
    );


  if (
    Number.isFinite(
      accountClicks
    )
  ) {

    return Math.max(
      0,
      Math.floor(
        accountClicks
      )
    );

  }


  /*
   * Startup / emergency fallback only.
   * Account Core remains canonical.
   */
  return Math.max(
    0,
    Math.floor(
      Number(
        state.totalClicks
      ) || 0
    )
  );

}

function telegramShare() {

  const spState =
    window.LAGO_ACCOUNT
      ?.getSPState
      ?.() || {};


  const sp =
    Math.max(
      0,
      Number(
        spState.balance
      ) || 0
    );


    const clicks =
    getCanonicalClickCount();


  const formattedSP =
    sp.toLocaleString(
      "en-US",
      {
        maximumFractionDigits:
          2
      }
    );


  const text =
    `🐌 LAGO — ${formattedSP} SP, ${clicks} кликов. Улитка всё ещё не поняла зачем.`;


  const url =
    "https://t.me/share/url?url=https://t.me/&text=" +
    encodeURIComponent(
      text
    );


  if (
    tg?.openTelegramLink
  ) {

    tg.openTelegramLink(
      url
    );


    return;

  }


  if (
    navigator.share
  ) {

    navigator
      .share({
        title:
          "LAGO",

        text
      })
      .catch(
        () => {}
      );


    return;

  }


  window.open(
    url,
    "_blank"
  );

}


/* =========================================================
   AUDIO
   ========================================================= */


function getAudioContext() {

  const AudioEngine =
    window.AudioContext ||
    window.webkitAudioContext;


  if (
    !AudioEngine
  ) {

    return null;

  }


  if (
    !audioCtx
  ) {

    audioCtx =
      new AudioEngine();

  }


  return audioCtx;

}


function unlockAudio() {

  try {

    const context =
      getAudioContext();


    if (
      !context
    ) {

      return;

    }


    if (
      context.state !==
      "running"
    ) {

      context
        .resume()
        .catch(
          () => {}
        );

    }


    /*
     * iOS Safari audio unlock.
     */

    const buffer =
      context.createBuffer(
        1,
        1,
        22050
      );


    const source =
      context
        .createBufferSource();


    const gain =
      context.createGain();


    source.buffer =
      buffer;


    gain.gain.value =
      0;


    source.connect(
      gain
    );


    gain.connect(
      context.destination
    );


    source.start(
      0
    );

  } catch (
    error
  ) {

    console.warn(
      "[LAGO AUDIO UNLOCK]",
      error
    );

  }

}


/*
 * Safari / iOS requires AudioContext
 * activation from a real gesture.
 */

document.addEventListener(
  "pointerdown",
  unlockAudio,
  {
    capture:
      true,

    passive:
      true
  }
);


document.addEventListener(
  "touchstart",
  unlockAudio,
  {
    capture:
      true,

    passive:
      true
  }
);


document.addEventListener(
  "keydown",
  unlockAudio,
  {
    capture:
      true
  }
);


function beep(
  freq = 440,
  duration = .06,
  type = "square"
) {

  try {

    const context =
      getAudioContext();


    if (
      !context
    ) {

      return;

    }


    const play =
      () => {

        const now =
          context.currentTime;


        const oscillator =
          context
            .createOscillator();


        const gain =
          context.createGain();


        oscillator.type =
          type;


        oscillator.frequency
          .setValueAtTime(
            freq,
            now
          );


        gain.gain
          .setValueAtTime(
            .055,
            now
          );


        gain.gain
          .exponentialRampToValueAtTime(
            .001,
            now +
            duration
          );


        oscillator.connect(
          gain
        );


        gain.connect(
          context.destination
        );


        oscillator.start(
          now
        );


        oscillator.stop(
          now +
          duration
        );

      };


    if (
      context.state !==
      "running"
    ) {

      context
        .resume()
        .then(
          play
        )
        .catch(
          error => {

            console.warn(
              "[LAGO AUDIO RESUME]",
              error
            );

          }
        );


      return;

    }


    play();

  } catch (
    error
  ) {

    console.warn(
      "[LAGO AUDIO]",
      error
    );

  }

}


/* =========================================================
   LEGACY TAP STATE ADAPTER
   ========================================================= */


const $ =
  id =>
    document.getElementById(
      id
    );


function getTapGameSnapshot() {

  const account =
    window.LAGO_ACCOUNT;


  const spState =
    account
      ?.getSPState
      ?.() || {};


  const dumState =
    account
      ?.getDumEnergy
      ?.() || {};


  const autoState =
    account
      ?.getTapAutoState
      ?.() || {};


  return {

    days:
      Math.max(
        0,

        Math.floor(
          Number(
            state.days
          ) || 0
        )
      ),

        totalClicks:
      getCanonicalClickCount(),
    steals:
      Math.max(
        0,

        Math.floor(
          Number(
            state.steals
          ) || 0
        )
      ),

    memesCreated:
      Math.max(
        0,

        Math.floor(
          Number(
            state.memesCreated
          ) || 0
        )
      ),

    sp:
      Math.max(
        0,
        Number(
          spState.balance
        ) || 0
      ),

    lifetimeSp:
      Math.max(
        0,
        Number(
          spState.lifetimeEarned
        ) || 0
      ),

    level:
      Math.max(
        1,

        Math.floor(
          Number(
            spState.level
          ) || 1
        )
      ),

    dum:
      Math.max(
        0,

        Math.floor(
          Number(
            dumState.dum
          ) || 0
        )
      ),

    maxDum:
      Math.max(
        1,

        Math.floor(
          Number(
            dumState.max
          ) || 100
        )
      ),

    autoLevel:
      Math.max(
        0,

        Math.floor(
          Number(
            autoState.level
          ) || 0
        )
      ),

    spPerSecond:
      Math.max(
        0,

        Math.floor(
          Number(
            autoState.spPerSecond
          ) || 0
        )
      ),

    speech:
      window.LAGO_UI
        ?.getSpeech
        ?.() ||
      ""

  };

}


/*
 * Legacy runtime no longer renders
 * the main game UI.
 *
 * lago-modern.js owns the interface.
 */
function render() {

}


/* =========================================================
   PUBLIC LEGACY RUNTIME ADAPTER
   ========================================================= */


window.LAGO_LEGACY_RUNTIME =
  Object.freeze({

    getState() {

      return state;

    },


    getTapState() {

      return getTapGameSnapshot();

    },


    getPhrases() {

      return [
        ...PHRASES
      ];

    },


    save() {

      save();

    },


    render() {

      render();

    },


    beep(
      frequency,
      duration,
      type
    ) {

      beep(
        frequency,
        duration,
        type
      );

    },


    checkAchievements() {

      checkAchievements();

    },


    gameOver() {

      gameOver();

    },


    share() {

      telegramShare();

    }

  });


/* =========================================================
   ACHIEVEMENTS
   ========================================================= */


const achievements = [

  [

    "energy100",

    "⚡ ПЕРВАЯ СОТНЯ",

    "Заработать 100 SP",

    () =>
      Number(
        window.LAGO_ACCOUNT
          ?.getSPState
          ?.()
          ?.lifetimeEarned
      ) >=
      100

  ],


  [

    "click1000",

    "👆 ПАЛЕЦ-БОГ",

    "Сделать 1000 кликов",

        () =>
      getCanonicalClickCount() >=
      1000

  ],


  [

    "meme5",

    "🎨 МЕМ-МАГНАТ",

    "Создать 5 мемов",

    () =>
      state.memesCreated >=
      5

  ],


  [

    "steal10",

    "👾 КРИПТО-ВОРО",

    "Успешно ограбить 10 раз",

    () =>
      state.steals >=
      10

  ],


  [

    "day7",

    "🧠 СЕМЬ ДНЕЙ БЕЗ ТУПОСТИ",

    "Дожить 7 дней",

    () =>
      state.days >=
      7

  ]

];


function checkAchievements() {

  achievements.forEach(
    achievement => {

      const [
        id,
        title,
        description,
        condition
      ] =
        achievement;


      void description;


      if (
        state.achievements[id] ||
        !condition()
      ) {

        return;

      }


      state.achievements[id] =
        true;


      window.LAGO_UI
        ?.toast
        ?.(
          `🏆 ${title}`
        );


      beep(
        880,
        .08
      );


      beep(
        1320,
        .1
      );


      save();

    }
  );

}

/*
 * =========================================================
 * ACCOUNT ACHIEVEMENT WATCH
 * =========================================================
 *
 * Account Core already emits
 * lago:account-state after canonical
 * account/economy mutations.
 *
 * Do not scan every legacy achievement
 * after every physical tap.
 */

let achievementWatchClicks =
  getCanonicalClickCount();


let achievementWatchLifetimeSP =
  Math.max(
    0,
    Number(
      window.LAGO_ACCOUNT
        ?.getSPState
        ?.()
        ?.lifetimeEarned
    ) || 0
  );


function handleAccountAchievementState(
  event
) {

  const detail =
    event?.detail &&
    typeof event.detail ===
      "object"

      ? event.detail
      : {};


  const rawClicks =
    Number(
      detail.clicks
    );


  const nextClicks =
    Number.isFinite(
      rawClicks
    )

      ? Math.max(
          0,
          Math.floor(
            rawClicks
          )
        )

      : getCanonicalClickCount();


  const rawLifetimeSP =
    Number(
      detail.lifetime
        ?.spEarned
    );


  const nextLifetimeSP =
    Number.isFinite(
      rawLifetimeSP
    )

      ? Math.max(
          0,
          rawLifetimeSP
        )

      : Math.max(
          0,
          Number(
            window.LAGO_ACCOUNT
              ?.getSPState
              ?.()
              ?.lifetimeEarned
          ) || 0
        );


  const crossedClick1000 =
    achievementWatchClicks <
      1000 &&
    nextClicks >=
      1000;


  const crossedSP100 =
    achievementWatchLifetimeSP <
      100 &&
    nextLifetimeSP >=
      100;


  achievementWatchClicks =
    nextClicks;


  achievementWatchLifetimeSP =
    nextLifetimeSP;


  if (
    crossedClick1000 ||
    crossedSP100
  ) {

    checkAchievements();

  }

}


document.addEventListener(
  "lago:account-state",
  handleAccountAchievementState
);


/*
 * Migration / startup catch-up.
 *
 * Existing players may already have
 * crossed an old achievement threshold
 * before this watcher existed.
 */
checkAchievements();

/* =========================================================
   DAYS
   ========================================================= */


function updateDays() {

  const today =
    new Date()
      .toDateString();


  if (
    state.lastDay ===
    today
  ) {

    return;

  }


  state.days++;


   state.lastDay =
    today;


  save();


  /*
   * DAY achievements are legacy state,
   * so check them only when DAY changes.
   */
  checkAchievements();

}

updateDays();


/* =========================================================
   GAME OVER
   ========================================================= */


function gameOver() {

  window.LAGO_UI
    ?.openPanel
    ?.(
      "gameOverPanel"
    );


  beep(
    70,
    .3,
    "sawtooth"
  );

}


const restartButton =
  $("restartBtn");


if (
  restartButton
) {

  restartButton.onclick =
    () => {

      /*
       * Only old temporary game-state
       * values are reset here.
       *
       * Account upgrades such as
       * DOUBLE CLICK live in
       * LAGO_ACCOUNT and survive.
       */

      state.energy =
        10;


      state.power =
        1;


      state.auto =
        0;


      state.shield =
        0;


      state.upgrades = {

        click:
          0,

        auto:
          0,

        shield:
          0

      };


      state.lastDay =
        new Date()
          .toDateString();


      window.LAGO_UI
        ?.closePanel
        ?.(
          "gameOverPanel"
        );


      window.LAGO_UI
        ?.toast
        ?.(
          "Лаго воскрес. К сожалению."
        );


      render();


      save();

    };

}


/* =========================================================
   RANDOM SPEECH
   ========================================================= */


setInterval(
  () => {

    if (
      Math.random() >=
      .55
    ) {

      return;

    }


    const phrase =
      PHRASES[
        Math.floor(
          Math.random() *
          PHRASES.length
        )
      ];


    window.LAGO_UI
      ?.setSpeech
      ?.(
        phrase
      );

  },
  2500
);


render();

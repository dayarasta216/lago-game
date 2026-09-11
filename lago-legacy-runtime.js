
"use strict";


/* =========================================================
   LAGO — вся игровая логика находится в одном HTML.
   ========================================================= */

const tg = window.Telegram?.WebApp;
if (tg) {
  tg.ready();
  tg.expand();
  try { tg.setHeaderColor("#1a0a1a"); tg.setBackgroundColor("#1a0a1a"); } catch(e){}
}

const SAVE_KEY = "lago_brainrot_save_v1";
const PHRASES = [
  "Я устааал...","Ты тупой?","Пук! 💨","Ой, всё!","Зачем?","Скучно...",
  "Ещё!","Кто я?","Я улитка","Лаго тупит","Загружаюсь..."
];

const defaultState = {
  energy: 0,
  power: 1,
  auto: 0,
  shield: 0,
  days: 0,
  lastDay: new Date().toDateString(),
  totalClicks: 0,
  steals: 0,
  memesCreated: 0,
  upgrades: {click:0, auto:0, shield:0},
  memes: [],
  achievements: {},
  telegramUser: null,
  wallet: null,
 
};

let state = loadState();
let audioCtx = null;



/* ---------- Хранилище ---------- */
function loadState(){
  try {
    const saved = JSON.parse(localStorage.getItem(SAVE_KEY));
    if (!saved) return structuredClone(defaultState);
    return deepMerge(structuredClone(defaultState), saved);
  } catch(e){ return structuredClone(defaultState); }
}
function deepMerge(base, saved){
  for(const k in saved){
    if(saved[k] && typeof saved[k]==="object" && !Array.isArray(saved[k]) && base[k]) base[k]=deepMerge(base[k],saved[k]);
    else base[k]=saved[k];
  }
  return base;
}
function save(){
  localStorage.setItem(SAVE_KEY, JSON.stringify(state));
}
setInterval(save,5000);

/* ---------- Telegram ---------- */
function initTelegramUser(){
  const u = tg?.initDataUnsafe?.user;
  if(u){
    state.telegramUser = {id:u.id, first_name:u.first_name||"", username:u.username||""};
    // В реальном продакшене initData должен проверяться на сервере.
  }
}
initTelegramUser();

function telegramShare(){

  const spState =
    window.LAGO_ACCOUNT
      ?.getSPState
      ?.() || {};


  const sp =
    Math.max(
      0,
      Math.floor(
        Number(
          spState.balance
        ) || 0
      )
    );


  const clicks =
    Math.max(
      0,
      Math.floor(
        Number(
          state.totalClicks
        ) || 0
      )
    );


  const text =
    `🐌 LAGO — ${sp} SP, ${clicks} кликов. Улитка всё ещё не поняла зачем.`;


  const url =
    "https://t.me/share/url?url=https://t.me/&text=" +
    encodeURIComponent(text);


  if(tg?.openTelegramLink) {

    tg.openTelegramLink(url);

  } else if(navigator.share) {

    navigator
      .share({
        title:
          "LAGO",

        text
      })
      .catch(
        () => {}
      );

  } else {

    window.open(
      url,
      "_blank"
    );

  }

}
/* ---------- Звук ---------- */

function getAudioContext() {

  const AudioEngine =
    window.AudioContext ||
    window.webkitAudioContext;


  if (!AudioEngine) {

    return null;

  }


  if (!audioCtx) {

    audioCtx =
      new AudioEngine();

  }


  return audioCtx;

}


function unlockAudio() {

  try {

    const context =
      getAudioContext();


    if (!context) {

      return;

    }


    if (
      context.state !==
      "running"
    ) {

      context
        .resume()
        .catch(() => {});

    }


    /*
     * iOS Safari audio unlock.
     *
     * A silent one-sample buffer
     * is started directly from the
     * user's gesture.
     */

    const buffer =
      context.createBuffer(
        1,
        1,
        22050
      );


    const source =
      context.createBufferSource();


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


    source.start(0);

  } catch (error) {

    console.warn(
      "[LAGO AUDIO UNLOCK]",
      error
    );

  }

}


/*
 * Safari/iOS requires audio context
 * activation from a real user gesture.
 */

document.addEventListener(
  "pointerdown",
  unlockAudio,
  {
    capture: true,
    passive: true
  }
);


document.addEventListener(
  "touchstart",
  unlockAudio,
  {
    capture: true,
    passive: true
  }
);


document.addEventListener(
  "keydown",
  unlockAudio,
  {
    capture: true
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


    if (!context) {

      return;

    }


    const play = () => {

      const now =
        context.currentTime;


      const oscillator =
        context.createOscillator();


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
          now + duration
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
        now + duration
      );

    };


    if (
      context.state !==
      "running"
    ) {

      context
        .resume()
        .then(play)
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

  } catch (error) {

    console.warn(
      "[LAGO AUDIO]",
      error
    );

  }

}

/* ---------- UI ---------- */
const $ = id => document.getElementById(id);

function getTapGameSnapshot(){

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
      Math.max(
        0,
        Math.floor(
          Number(
            state.totalClicks
          ) || 0
        )
      ),

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
        Math.floor(
          Number(
            spState.balance
          ) || 0
        )
      ),

    lifetimeSp:
      Math.max(
        0,
        Math.floor(
          Number(
            spState.lifetimeEarned
          ) || 0
        )
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
function render() {

  /*
   * Legacy runtime no longer renders
   * the application interface.
   *
   * Upgrade panel is the final
   * temporary legacy UI dependency.
   */
  window.LAGO_TAP_GAME
    ?.renderUpgrades
    ?.();

}

/*
 * =========================================================
 * TAP LAGO PUBLIC GAME API
 * R0.3
 *
 * This is the first step toward turning the old clicker
 * into Mini-Game #001 instead of using it as the whole app.
 *
 * UI modules must call this API.
 * They must NOT simulate clicks on hidden legacy buttons.
 * =========================================================
 */

/*
 * =========================================================
 * LEGACY RUNTIME ADAPTER
 * Temporary compatibility layer.
 *
 * New modules must NOT access legacy DOM directly.
 * =========================================================
 */

/*
 * Emergency 2D fallback remains tappable.
 * The listener follows #snail when Modern UI moves it.
 */
image()
  ?.addEventListener(
    "pointerdown",
    event => {

      event.preventDefault();

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

window.LAGO_LEGACY_RUNTIME =
  Object.freeze({

    /*
     * Temporary state bridge.
     * Removed when Tap Lago gets its
     * own canonical game state.
     */

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


    /*
     * Temporary audio bridge.
     */

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


    /*
     * UI is owned by LAGO_UI.
     */

   

   
    /*
     * Still legacy-owned for now.
     */

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
 

/* ---------- Достижения ---------- */
const achievements=[
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
    ) >= 100
],
  ["click1000","👆 ПАЛЕЦ-БОГ","Сделать 1000 кликов",()=>state.totalClicks>=1000],
  ["meme5","🎨 МЕМ-МАГНАТ","Создать 5 мемов",()=>state.memesCreated>=5],
  ["steal10","👾 КРИПТО-ВОРО","Успешно ограбить 10 раз",()=>state.steals>=10],
  ["day7","🧠 СЕМЬ ДНЕЙ БЕЗ ТУПОСТИ","Дожить 7 дней",()=>state.days>=7]
];
function checkAchievements(){
  achievements.forEach(a=>{
    if(!state.achievements[a[0]] && a[3]()){
    state.achievements[a[0]] =
  true;

window.LAGO_UI
  ?.toast
  ?.(
    `🏆 ${a[1]}`
  );

beep(
  880,
  .08
);

beep(
  1320,
  .1
);
    }
  });
}

/* ---------- Дни ---------- */
function updateDays(){
  const today=new Date().toDateString();
  if(state.lastDay!==today){
    state.days++;
    state.lastDay=today;
    save();
  }
}
updateDays();

/* ---------- Game Over ---------- */
function gameOver(){

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
$("restartBtn").onclick =
  () => {

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

/* ---------- Туториал ---------- */


/* ---------- Случайные фразы ---------- */

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



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
let toastTimer = null;


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
  const score = Math.floor(state.energy);
  const text = `🐌 LAGO — я собрал ${score} Мем-Энергии и всё ещё туплю. Попробуй побить мой рекорд!`;
  const url = "https://t.me/share/url?url=https://t.me/&text=" + encodeURIComponent(text);
  if(tg?.openTelegramLink) tg.openTelegramLink(url);
  else if(navigator.share) navigator.share({title:"LAGO",text}).catch(()=>{});
  else window.open(url,"_blank");
}

/* ---------- Звук ---------- */
function beep(
  freq = 440,
  duration = .06,
  type = "square"
) {

  try {

    const AudioEngine =
      window.AudioContext ||
      window.webkitAudioContext;


    if (!AudioEngine) {
      return;
    }


    audioCtx ||=
      new AudioEngine();


    const play = () => {

      const now =
        audioCtx.currentTime;


      const oscillator =
        audioCtx.createOscillator();


      const gain =
        audioCtx.createGain();


      oscillator.type =
        type;


      oscillator.frequency
        .setValueAtTime(
          freq,
          now
        );


      gain.gain
        .setValueAtTime(
          .04,
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
        audioCtx.destination
      );


      oscillator.start(
        now
      );


      oscillator.stop(
        now + duration
      );

    };


    if (
      audioCtx.state ===
      "suspended"
    ) {

      audioCtx
        .resume()
        .then(play)
        .catch(() => {});


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
function fmt(n){ return Math.floor(n).toLocaleString("ru-RU"); }
 function getTapGameSnapshot(){
  return {
    energy: Math.floor(state.energy),
    power: state.power,
    auto: state.auto,
    shield: state.shield,
    days: state.days,
    totalClicks: state.totalClicks,
    steals: state.steals,
    memesCreated: state.memesCreated,
    upgrades: {
      ...state.upgrades
    },
    speech:
      document.getElementById("cringe")
        ?.textContent
        ?.trim() || ""
  };
}
function render(){

  $("energy").textContent =
    fmt(state.energy);

  $("power").textContent =
    fmt(state.power);

  $("auto").textContent =
    fmt(state.auto);

  $("shield").textContent =
    Math.min(
      90,
      state.shield * 10
    ) + "%";

  $("days").textContent =
    `🧠 Дней без тупости: ${state.days}`;

  window.LAGO_TAP_GAME
  ?.renderUpgrades
  ?.();

renderMemes();

  /*
   * Publish Tap Lago state.
   *
   * Other UI modules must listen
   * to this event instead of reading
   * hidden legacy DOM elements.
   */
  document.dispatchEvent(
    new CustomEvent(
      "lago:tap-game-state",
      {
        detail:
          getTapGameSnapshot()
      }
    )
  );

}
function toast(msg){
  $("toast").textContent=msg;$("toast").classList.add("on");
  clearTimeout(toastTimer);toastTimer=setTimeout(()=>$("toast").classList.remove("on"),1800);
}
function openPanel(id){$(id).classList.add("show")}
function closePanel(id){$(id).classList.remove("show")}
document.querySelectorAll("[data-close]").forEach(b=>b.onclick=()=>closePanel(b.dataset.close));

/* =========================================================
   TAP LAGO GAMEPLAY

   Tap / Steal / Auto gameplay was extracted to:

   lago-tap-game.js

   Legacy runtime temporarily keeps only shared
   UI helpers until the old interface is removed.
   ========================================================= */


function spawnFloat(text, ev) {

  const wrap =
    $("snailWrap");

  if (!wrap) {
    return;
  }


  const r =
    wrap.getBoundingClientRect();


  const x =
    ev?.clientX
      ? ev.clientX - r.left
      : r.width / 2;


  const y =
    ev?.clientY
      ? ev.clientY - r.top
      : r.height / 2;


  const f =
    document.createElement(
      "div"
    );


  f.className =
    "float";


  f.textContent =
    text;


  f.style.left =
    x + "px";


  f.style.top =
    y + "px";


  wrap.appendChild(f);


  setTimeout(
    () => f.remove(),
    800
  );

}


/* ---------- Создание мемов ---------- */
const canvas=$("draw"),ctx=canvas.getContext("2d");
ctx.fillStyle="#170b19";ctx.fillRect(0,0,canvas.width,canvas.height);
ctx.fillStyle="#ccff00";ctx.font="bold 34px monospace";ctx.textAlign="center";ctx.fillText("НАРИСУЙ КРИНЖ",canvas.width/2,canvas.height/2);
let drawing=false,lastX=0,lastY=0;
function pos(e){const r=canvas.getBoundingClientRect();return {x:(e.clientX-r.left)*canvas.width/r.width,y:(e.clientY-r.top)*canvas.height/r.height}}
canvas.addEventListener("pointerdown",e=>{drawing=true;canvas.setPointerCapture(e.pointerId);let p=pos(e);lastX=p.x;lastY=p.y});
canvas.addEventListener("pointermove",e=>{if(!drawing)return;let p=pos(e);ctx.strokeStyle=["#ff44aa","#ccff00","#00e5ff","#fff"][Math.floor(Math.random()*4)];ctx.lineWidth=12;ctx.lineCap="round";ctx.beginPath();ctx.moveTo(lastX,lastY);ctx.lineTo(p.x,p.y);ctx.stroke();lastX=p.x;lastY=p.y});
canvas.addEventListener("pointerup",()=>drawing=false);
$("clearDraw").onclick=()=>{
  ctx.fillStyle="#170b19";ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.fillStyle="#ccff00";ctx.font="bold 34px monospace";ctx.textAlign="center";ctx.fillText("НАРИСУЙ КРИНЖ",canvas.width/2,canvas.height/2);
};
$("memeFile").onchange=e=>{
  const file=e.target.files?.[0]; if(!file)return;
  const reader=new FileReader();
  reader.onload=()=>{const im=new Image();im.onload=()=>{ctx.clearRect(0,0,canvas.width,canvas.height);ctx.drawImage(im,0,0,canvas.width,canvas.height)};im.src=reader.result};
  reader.readAsDataURL(file);
};
function saveMeme(){
  const name=($("memeName").value.trim()||"МЕМ ЛАГО").slice(0,24);
  const clickBonus=Math.floor(Math.random()*5)+1;
  const autoBonus=Math.random()<.35 ? Math.floor(Math.random()*3)+1 : 0;
  const data=canvas.toDataURL("image/jpeg",.55);
  state.memes.push({id:Date.now(),name,data,clickBonus,autoBonus,created:new Date().toISOString()});
  state.memesCreated++;
  $("memeName").value="";
  toast(`МЕМ СОЗДАН! +${clickBonus} к клику${autoBonus?` и +${autoBonus}/сек`:""}`);
  beep(800,.06);beep(1100,.08);
  checkAchievements();render();save();closePanel("createPanel");
}
$("saveMeme").onclick=saveMeme;
$("createBtn").onclick=()=>openPanel("createPanel");
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

window.LAGO_LEGACY_RUNTIME = {

  /*
   * Temporary mutable state access.
   *
   * This exists only while the old
   * runtime is being dismantled.
   *
   * Later state moves into the
   * unified Account / Game Core.
   */

  getState() {

    return state;

  },


  getPhrases() {

    return [
      ...PHRASES
    ];

  },


  /*
   * Shared persistence.
   */

  save() {

    save();

  },


  /*
   * Temporary legacy renderer.
   */

  render() {

    render();

  },


  /*
   * Feedback helpers.
   */

  toast(message) {

    toast(message);

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


  setSpeech(text) {

    const speech =
      $("cringe");


    if (speech) {

      speech.textContent =
        text;

    }

  },


  animateSnail() {

    const snail =
      $("snail");


    if (!snail) {
      return;
    }


    snail.classList.remove(
      "bonk"
    );


    void snail.offsetWidth;


    snail.classList.add(
      "bonk"
    );

  },


  spawnFloat(
    text,
    event
  ) {

    spawnFloat(
      text,
      event
    );

  },


  checkAchievements() {

    checkAchievements();

  },


  gameOver() {

    gameOver();

  },


  /*
   * Temporary legacy panels.
   */

  showPanel(id) {

  openPanel(
    id
  );

},

  openCreator() {

    openPanel(
      "createPanel"
    );

  },


  share() {

    telegramShare();

  }

};


 
function renderMemes(){
  if(!state.memes.length){
    $("memeList").innerHTML=`<div class="hint" style="grid-column:1/-1;padding:20px">Пока пусто. Создай первый абсолютно бесполезный мем.</div>`;
    return;
  }
  $("memeList").innerHTML=state.memes.map(m=>`
    <div class="meme">
      <img src="${m.data}" alt="">
      <b>${escapeHtml(m.name)}</b>
      <div class="badge">⚡ +${m.clickBonus}${m.autoBonus?` · 🤖 +${m.autoBonus}/с`:""}</div>
    </div>`).join("");
}
function escapeHtml(s){return s.replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[c]))}
$("memesBtn").onclick=()=>openPanel("memesPanel");

/* ---------- Достижения ---------- */
const achievements=[
  ["energy100","💎 ПЕРВАЯ СОТНЯ","Собрать 100 DUM",()=>state.energy>=100],
  ["click1000","👆 ПАЛЕЦ-БОГ","Сделать 1000 кликов",()=>state.totalClicks>=1000],
  ["meme5","🎨 МЕМ-МАГНАТ","Создать 5 мемов",()=>state.memesCreated>=5],
  ["steal10","👾 КРИПТО-ВОРО","Успешно ограбить 10 раз",()=>state.steals>=10],
  ["day7","🧠 СЕМЬ ДНЕЙ БЕЗ ТУПОСТИ","Дожить 7 дней",()=>state.days>=7]
];
function checkAchievements(){
  achievements.forEach(a=>{
    if(!state.achievements[a[0]] && a[3]()){
      state.achievements[a[0]]=true;toast(`🏆 ${a[1]}`);beep(880,.08);beep(1320,.1);
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
  $("gameOverPanel").classList.add("show");
  beep(70,.3,"sawtooth");
}
$("restartBtn").onclick=()=>{
  state.energy=10;state.power=1;state.auto=0;state.shield=0;
  state.upgrades={click:0,auto:0,shield:0};state.lastDay=new Date().toDateString();
  closePanel("gameOverPanel");toast("Лаго воскрес. К сожалению.");render();save();
};

/* ---------- Solana / Phantom ---------- */
let solanaProvider=null;
const MEMO_PROGRAM_ID="MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr";
function getProvider(){
  if(window.phantom?.solana?.isPhantom) return window.phantom.solana;
  if(window.solana?.isPhantom) return window.solana;
  return null;
}
function shortKey(k){return k ? k.slice(0,6)+"…"+k.slice(-6):""}
async function connectWallet(){
  const p=getProvider();
  if(!p){toast("Phantom не найден. Открой игру в браузере Phantom.");return}
  try{
    const resp=await p.connect();
    solanaProvider=p;
    state.wallet=resp.publicKey.toString();
    renderWallet();
    save();
    toast("SOLANA КОШЕЛЁК ПОДКЛЮЧЁН 🟣");
  }catch(e){toast("Подключение отменено")}
}
function renderWallet(){
  $("walletInfo").innerHTML=state.wallet
    ? `<div class="wallet">CONNECTED<br>${escapeHtml(state.wallet)}</div>`
    : `<div class="hint">Кошелёк пока не подключён.</div>`;
}
async function writeScoreOnChain(){
  if(!solanaProvider){await connectWallet();if(!solanaProvider)return}
  try{
    const connection=new solanaWeb3.Connection("https://api.mainnet-beta.solana.com","confirmed");
    const {blockhash,lastValidBlockHeight}=await connection.getLatestBlockhash();
    const tx=new solanaWeb3.Transaction({recentBlockhash:blockhash,feePayer:solanaProvider.publicKey});
    const memo=`LAGO|telegram=${state.telegramUser?.id||"guest"}|energy=${Math.floor(state.energy)}|clicks=${state.totalClicks}|memes=${state.memesCreated}`;
    tx.add(new solanaWeb3.TransactionInstruction({
      keys:[],programId:new solanaWeb3.PublicKey(MEMO_PROGRAM_ID),
      data:new TextEncoder().encode(memo)
    }));
    const signed=await solanaProvider.signAndSendTransaction(tx);
    await connection.confirmTransaction({signature:signed.signature,blockhash,lastValidBlockHeight},"confirmed");
    toast("РЕКОРД ЗАПИСАН В SOLANA ⛓️");
    $("walletInfo").innerHTML+=`<div class="wallet" style="margin-top:8px">TX: ${escapeHtml(signed.signature)}</div>`;
  }catch(e){
    console.error(e);toast("Solana-транзакция не прошла");
  }
}
$("walletBtn").onclick=()=>{renderWallet();openPanel("walletPanel")};
$("connectWallet").onclick=connectWallet;
$("onchainScore").onclick=writeScoreOnChain;

/* ---------- Поделиться ---------- */
$("shareBtn").onclick=telegramShare;

/* ---------- Туториал ---------- */


/* ---------- Случайные вспышки/кринж ---------- */
setInterval(()=>{
  if(Math.random()<.55){
    $("cringe").textContent=PHRASES[Math.floor(Math.random()*PHRASES.length)];
  }
  if(Math.random()<.15){
    document.querySelector(".app").animate(
      [{transform:"translateX(0)"},{transform:"translateX(-3px)"},{transform:"translateX(3px)"},{transform:"translateX(0)"}],
      {duration:180}
    );
  }
},2500);

render();


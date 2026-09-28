(() => {
  "use strict";

  const VERSION = 1;
  const GAME_ID = "lago-fights";

  const WIDTH = 960;
  const HEIGHT = 540;
  const FLOOR_Y = 420;
  const MAX_HP = 100;

  let overlay = null;
  let canvas = null;
  let ctx = null;

  let voicePanel = null;
  let controlsAbort = null;

  let animationFrame = 0;
  let active = false;
  let lastTime = 0;

  let previousOverflow = "";
  let phase = "lobby";

  let backgroundMode = "roof";
  let customBackground = null;
  let customBackgroundUrl = null;

  const keys = new Set();
  const held = new Set();

  const fighters = [
    createFighter(
      "p1",
      260,
      1
    ),

    createFighter(
      "p2",
      700,
      -1
    )
  ];


  function createFighter(
    id,
    x,
    facing
  ) {

    return {
      id,
      x,

      y: 0,

      vx: 0,
      vy: 0,

      facing,

      hp: MAX_HP,

      grounded: true,

      attackTime: 0,
      cooldown: 0,
      hurtTime: 0
    };

  }


  function $(
    selector
  ) {

    return (
      overlay
        ?.querySelector(
          selector
        ) ||
      null
    );

  }


  function clamp(
    value,
    min,
    max
  ) {

    return Math.max(
      min,
      Math.min(
        max,
        value
      )
    );

  }


  /*
   * =====================================================
   * UI
   * =====================================================
   */

  function makeUI() {

    if (overlay) {
      return;
    }


    const style =
      document.createElement(
        "style"
      );


    style.textContent = `

      #lagoStickFights {

        position:
          fixed;

        inset:
          0;

        z-index:
          23000;

        display:
          none;

        flex-direction:
          column;

        gap:
          8px;

        padding:

          calc(
            10px +
            env(
              safe-area-inset-top
            )
          )

          10px

          calc(
            10px +
            env(
              safe-area-inset-bottom
            )
          );

        background:
          #090d12;

        color:
          #fff;

        font:
          700 13px
          system-ui,
          sans-serif;

      }


      #lagoStickFights.active {

        display:
          flex;

      }


      .sf-head,
      .sf-tools,
      .sf-controls,
      .sf-player-controls,
      .sf-backgrounds {

        display:
          flex;

        align-items:
          center;

        flex-wrap:
          wrap;

        gap:
          7px;

      }


      .sf-head,
      .sf-controls {

        justify-content:
          space-between;

      }


      .sf-title {

        margin:
          0;

        font-size:

          clamp(
            25px,
            5vw,
            42px
          );

        font-weight:
          1000;

        letter-spacing:
          -.055em;

      }


      .sf-sub {

        color:
          rgba(
            255,
            255,
            255,
            .48
          );

        font-size:
          9px;

        font-weight:
          900;

      }


      .sf-tools {

        justify-content:
          flex-end;

      }


      #sfVoice {

        position:
          relative;

      }


      .sf-stage {

        position:
          relative;

        flex:
          1;

        min-height:
          0;

        overflow:
          hidden;

        border:

          1px solid
          rgba(
            255,
            255,
            255,
            .12
          );

        border-radius:
          16px;

        background:
          #ded9cd;

      }


      #sfCanvas {

        display:
          block;

        width:
          100%;

        height:
          100%;

        touch-action:
          none;

      }


      .sf-hud {

        position:
          absolute;

        top:
          9px;

        left:
          50%;

        z-index:
          8;

        transform:
          translateX(
            -50%
          );

        width:

          min(
            520px,
            calc(
              100% - 18px
            )
          );

        pointer-events:
          none;

      }


      .sf-score {

        display:
          flex;

        justify-content:
          space-between;

        gap:
          12px;

        margin-bottom:
          5px;

        color:
          #101319;

        font-size:
          10px;

        font-weight:
          1000;

        text-shadow:
          0 1px
          rgba(
            255,
            255,
            255,
            .8
          );

      }


      .sf-health-row {

        display:
          grid;

        grid-template-columns:
          1fr 1fr;

        gap:
          14px;

      }


      .sf-health {

        height:
          10px;

        overflow:
          hidden;

        border:
          2px solid
          #111;

        border-radius:
          999px;

        background:
          rgba(
            255,
            255,
            255,
            .65
          );

      }


      .sf-health > div {

        width:
          100%;

        height:
          100%;

        background:
          #111;

        transform-origin:
          left center;

      }


      #sfP2Hp {

        transform-origin:
          right center;

      }


      .sf-lobby {

        position:
          absolute;

        inset:
          0;

        z-index:
          15;

        display:
          grid;

        place-items:
          center;

        padding:
          16px;

        background:
          rgba(
            8,
            12,
            16,
            .58
          );

        backdrop-filter:
          blur(
            7px
          );

      }


      .sf-lobby[hidden],
      .sf-controls[hidden] {

        display:
          none !important;

      }


      .sf-card {

        width:

          min(
            650px,
            100%
          );

        padding:
          18px;

        border:

          1px solid
          rgba(
            255,
            255,
            255,
            .14
          );

        border-radius:
          17px;

        background:
          rgba(
            18,
            28,
            37,
            .94
          );

      }


      .sf-card h3 {

        margin:
          0 0 5px;

        font-size:
          23px;

      }


      .sf-copy {

        margin:
          0 0 14px;

        color:
          rgba(
            255,
            255,
            255,
            .6
          );

        font-size:
          11px;

        line-height:
          1.45;

      }


      .sf-button,
      .sf-background {

        min-height:
          42px;

        padding:
          9px 12px;

        border:

          1px solid
          rgba(
            255,
            255,
            255,
            .2
          );

        border-radius:
          10px;

        background:
          #2b4050;

        color:
          #fff;

        font:
          900 11px
          system-ui;

        cursor:
          pointer;

        touch-action:
          none;

        user-select:
          none;

      }


      .sf-background.selected {

        border-color:
          #d6ef49;

        background:
          #425329;

      }


      .sf-primary {

        width:
          100%;

        margin-top:
          12px;

        background:
          #d6ef49;

        color:
          #17200f;

      }


      .sf-attack {

        background:
          #d45444;

      }


      .sf-file {

        display:
          inline-flex;

        align-items:
          center;

        min-height:
          42px;

        padding:
          0 10px;

        border:

          1px solid
          rgba(
            255,
            255,
            255,
            .2
          );

        border-radius:
          10px;

        background:
          #2b4050;

        font-size:
          10px;

        font-weight:
          900;

        cursor:
          pointer;

      }


      .sf-file input {

        display:
          none;

      }


      .sf-player-controls {

        flex:
          1;

      }


      .sf-player-controls:last-child {

        justify-content:
          flex-end;

      }


      .sf-help {

        text-align:
          center;

        color:
          rgba(
            255,
            255,
            255,
            .52
          );

        font-size:
          10px;

      }


      @media (
        max-width:
        650px
      ) {

        .sf-button,
        .sf-background,
        .sf-file {

          min-width:
            46px;

          padding:
            8px;

          font-size:
            9px;

        }


        .sf-help {

          display:
            none;

        }


        #sfVoice
        .lago-voice-panel {

          max-width:
            205px;

        }

      }

    `;


    document.head
      .appendChild(
        style
      );


    overlay =
      document.createElement(
        "section"
      );


    overlay.id =
      "lagoStickFights";


    overlay.innerHTML = `

      <header class="sf-head">

        <div>

          <h2 class="sf-title">
            STICK FIGHTS
          </h2>

          <div class="sf-sub">
            BLACK STICK FIGHTERS ·
            LOCAL 1V1 ·
            MULTIPLAYER LATER
          </div>

        </div>


        <div class="sf-tools">

          <div id="sfVoice"></div>

          <button
            class="sf-button"
            id="sfClose"
            type="button"
          >
            ЗАКРЫТЬ ×
          </button>

        </div>

      </header>


      <div
        class="sf-stage"
        id="sfStage"
      >

        <canvas
          id="sfCanvas"
          width="960"
          height="540"
        ></canvas>


        <div class="sf-hud">

          <div class="sf-score">

            <span id="sfP1Text">
              P1 · 100 HP
            </span>

            <span id="sfStatus">
              READY
            </span>

            <span id="sfP2Text">
              P2 · 100 HP
            </span>

          </div>


          <div class="sf-health-row">

            <div class="sf-health">
              <div id="sfP1Hp"></div>
            </div>

            <div class="sf-health">
              <div id="sfP2Hp"></div>
            </div>

          </div>

        </div>


        <section
          class="sf-lobby"
          id="sfLobby"
        >

          <div class="sf-card">

            <h3 id="sfLobbyTitle">
              CHOOSE BACKGROUND
            </h3>

            <p
              class="sf-copy"
              id="sfLobbyCopy"
            >
              Два простых чёрных
              stick-персонажа.
              Выбери готовый фон
              или свою картинку.
            </p>


            <div class="sf-backgrounds">

              <button
                class="sf-background"
                data-background="roof"
                type="button"
              >
                ROOF
              </button>


              <button
                class="sf-background"
                data-background="dojo"
                type="button"
              >
                ROOM
              </button>


              <button
                class="sf-background"
                data-background="forest"
                type="button"
              >
                FOREST
              </button>


              <button
                class="sf-background"
                data-background="plain"
                type="button"
              >
                PLAIN
              </button>


              <label class="sf-file">

                MY IMAGE

                <input
                  id="sfBackgroundFile"
                  type="file"
                  accept="image/*"
                >

              </label>

            </div>


            <button
              class="sf-button sf-primary"
              id="sfStart"
              type="button"
            >
              START FIGHT
            </button>

          </div>

        </section>

      </div>


      <div
        class="sf-controls"
        id="sfControls"
        hidden
      >

        <div class="sf-player-controls">

          <strong>
            P1
          </strong>

          <button
            class="sf-button"
            data-hold="p1-left"
            type="button"
          >
            ◀
          </button>

          <button
            class="sf-button"
            data-action="p1-jump"
            type="button"
          >
            ↑
          </button>

          <button
            class="sf-button"
            data-hold="p1-right"
            type="button"
          >
            ▶
          </button>

          <button
            class="sf-button sf-attack"
            data-action="p1-attack"
            type="button"
          >
            HIT
          </button>

        </div>


        <div class="sf-player-controls">

          <strong>
            P2
          </strong>

          <button
            class="sf-button"
            data-hold="p2-left"
            type="button"
          >
            ◀
          </button>

          <button
            class="sf-button"
            data-action="p2-jump"
            type="button"
          >
            ↑
          </button>

          <button
            class="sf-button"
            data-hold="p2-right"
            type="button"
          >
            ▶
          </button>

          <button
            class="sf-button sf-attack"
            data-action="p2-attack"
            type="button"
          >
            HIT
          </button>

          <button
            class="sf-button"
            id="sfBack"
            type="button"
          >
            BACKGROUND
          </button>

        </div>

      </div>


      <div class="sf-help">

        P1:
        A / D / W / F ·

        P2:
        ← / → / ↑ / Enter

      </div>

    `;


    document.body
      .appendChild(
        overlay
      );


    canvas =
      $(
        "#sfCanvas"
      );


    ctx =
      canvas
        .getContext(
          "2d"
        );


    $(
      "#sfClose"
    )
      .addEventListener(
        "click",
        hide
      );


    $(
      "#sfStart"
    )
      .addEventListener(
        "click",
        startFight
      );


    $(
      "#sfBack"
    )
      .addEventListener(
        "click",
        showLobby
      );


    overlay
      .querySelectorAll(
        "[data-background]"
      )
      .forEach(
        button => {

          button
            .addEventListener(
              "click",
              () => {

                backgroundMode =
                  button.dataset
                    .background;


                updateBackgroundSelection();

              }
            );

        }
      );


    $(
      "#sfBackgroundFile"
    )
      .addEventListener(
        "change",
        handleBackgroundFile
      );


    updateBackgroundSelection();

  }


  /*
   * =====================================================
   * BACKGROUND
   * =====================================================
   */

  function updateBackgroundSelection() {

    overlay
      ?.querySelectorAll(
        "[data-background]"
      )
      .forEach(
        button => {

          button.classList
            .toggle(

              "selected",

              button.dataset
                .background ===
              backgroundMode

            );

        }
      );

  }


  function handleBackgroundFile(
    event
  ) {

    const file =
      event.target
        .files
        ?.[0];


    if (!file) {
      return;
    }


    if (
      !file.type
        .startsWith(
          "image/"
        )
    ) {

      $(
        "#sfLobbyCopy"
      )
        .textContent =
          "Нужен файл изображения.";


      return;

    }


    if (
      file.size >
      10 *
      1024 *
      1024
    ) {

      $(
        "#sfLobbyCopy"
      )
        .textContent =
          "Фон должен быть не больше 10 MB.";


      return;

    }


    if (
      customBackgroundUrl
    ) {

      URL.revokeObjectURL(
        customBackgroundUrl
      );

    }


    customBackgroundUrl =
      URL.createObjectURL(
        file
      );


    customBackground =
      null;


    const image =
      new Image();


    image.onload =
      () => {

        if (!active) {
          return;
        }


        customBackground =
          image;


        backgroundMode =
          "custom";


        updateBackgroundSelection();


        $(
          "#sfLobbyCopy"
        )
          .textContent =
            "Твой фон выбран. START FIGHT.";

      };


    image.onerror =
      () => {

        $(
          "#sfLobbyCopy"
        )
          .textContent =
            "Не удалось открыть изображение.";

      };


    image.src =
      customBackgroundUrl;

  }


  /*
   * =====================================================
   * FIGHT STATE
   * =====================================================
   */

  function resetFighters() {

    Object.assign(

      fighters[0],

      createFighter(
        "p1",
        260,
        1
      )

    );


    Object.assign(

      fighters[1],

      createFighter(
        "p2",
        700,
        -1
      )

    );

  }


  function startFight() {

    resetFighters();


    phase =
      "fighting";


    $(
      "#sfLobby"
    )
      .hidden =
        true;


    $(
      "#sfControls"
    )
      .hidden =
        false;


    $(
      "#sfStatus"
    )
      .textContent =
        "FIGHT";

  }


  function showLobby() {

    phase =
      "lobby";


    held.clear();


    $(
      "#sfLobbyTitle"
    )
      .textContent =
        "CHOOSE BACKGROUND";


    $(
      "#sfLobbyCopy"
    )
      .textContent =

        "Два простых чёрных stick-персонажа. " +
        "Выбери готовый фон или свою картинку.";


    $(
      "#sfStart"
    )
      .textContent =
        "START FIGHT";


    $(
      "#sfLobby"
    )
      .hidden =
        false;


    $(
      "#sfControls"
    )
      .hidden =
        true;


    $(
      "#sfStatus"
    )
      .textContent =
        "READY";

  }


  function movementPressed(
    player,
    side
  ) {

    const touchKey =
      `${player}-${side}`;


    if (
      held.has(
        touchKey
      )
    ) {

      return true;

    }


    if (
      player ===
      "p1"
    ) {

      return (
        side ===
        "left"

          ? keys.has(
              "KeyA"
            )

          : keys.has(
              "KeyD"
            )
      );

    }


    return (
      side ===
      "left"

        ? keys.has(
            "ArrowLeft"
          )

        : keys.has(
            "ArrowRight"
          )
    );

  }


  function jump(
    fighter
  ) {

    if (
      phase !==
        "fighting" ||
      !fighter.grounded ||
      fighter.hp <=
        0
    ) {

      return;

    }


    fighter.vy =
      650;


    fighter.grounded =
      false;

  }


  function attack(
    fighter,
    enemy
  ) {

    if (
      phase !==
        "fighting" ||
      fighter.cooldown >
        0 ||
      fighter.hp <=
        0
    ) {

      return;

    }


    fighter.cooldown =
      .34;


    fighter.attackTime =
      .16;


    const dx =
      enemy.x -
      fighter.x;


    const dy =
      enemy.y -
      fighter.y;


    const facingTarget =

      Math.sign(
        dx ||
        fighter.facing
      ) ===
      fighter.facing;


    if (
      facingTarget &&
      Math.abs(
        dx
      ) <
        92 &&
      Math.abs(
        dy
      ) <
        75
    ) {

      enemy.hp =
        Math.max(
          0,
          enemy.hp -
          12
        );


      enemy.hurtTime =
        .18;


      enemy.vx +=

        fighter.facing *
        260;


      if (
        enemy.hp <=
        0
      ) {

        phase =
          "roundover";


        $(
          "#sfStatus"
        )
          .textContent =

            fighter.id ===
            "p1"

              ? "P1 WINS"
              : "P2 WINS";


        window.setTimeout(
          () => {

            if (
              !active ||
              phase !==
                "roundover"
            ) {

              return;

            }


            $(
              "#sfLobbyTitle"
            )
              .textContent =

                fighter.id ===
                "p1"

                  ? "P1 WINS"
                  : "P2 WINS";


            $(
              "#sfLobbyCopy"
            )
              .textContent =

                "Skeleton fight complete. " +
                "Play again or change the background.";


            $(
              "#sfStart"
            )
              .textContent =
                "REMATCH";


            $(
              "#sfLobby"
            )
              .hidden =
                false;


            $(
              "#sfControls"
            )
              .hidden =
                true;

          },

          650
        );

      }

    }

  }


  function handleAction(
    action
  ) {

    if (
      action ===
      "p1-jump"
    ) {

      jump(
        fighters[0]
      );

      return;

    }


    if (
      action ===
      "p2-jump"
    ) {

      jump(
        fighters[1]
      );

      return;

    }


    if (
      action ===
      "p1-attack"
    ) {

      attack(
        fighters[0],
        fighters[1]
      );

      return;

    }


    if (
      action ===
      "p2-attack"
    ) {

      attack(
        fighters[1],
        fighters[0]
      );

    }

  }


  /*
   * =====================================================
   * PHYSICS
   * =====================================================
   */

  function updateFighter(
    fighter,
    enemy,
    dt
  ) {

    fighter.cooldown =
      Math.max(
        0,
        fighter.cooldown -
        dt
      );


    fighter.attackTime =
      Math.max(
        0,
        fighter.attackTime -
        dt
      );


    fighter.hurtTime =
      Math.max(
        0,
        fighter.hurtTime -
        dt
      );


    if (
      fighter.hp <=
      0
    ) {

      return;

    }


    const left =
      movementPressed(
        fighter.id,
        "left"
      );


    const right =
      movementPressed(
        fighter.id,
        "right"
      );


    const move =

      Number(
        right
      ) -

      Number(
        left
      );


    fighter.vx +=

      move *
      1200 *
      dt;


    if (!move) {

      fighter.vx *=
        Math.pow(
          .80,
          dt * 60
        );

    }


    fighter.vx =
      clamp(

        fighter.vx,

        -250,

        250

      );


    fighter.x +=
      fighter.vx *
      dt;


    fighter.vy -=
      1550 *
      dt;


    fighter.y +=
      fighter.vy *
      dt;


    if (
      fighter.y <=
      0
    ) {

      fighter.y =
        0;


      fighter.vy =
        0;


      fighter.grounded =
        true;

    } else {

      fighter.grounded =
        false;

    }


    fighter.x =
      clamp(

        fighter.x,

        45,

        WIDTH -
        45

      );


    if (
      Math.abs(
        enemy.x -
        fighter.x
      ) >
      5
    ) {

      fighter.facing =

        enemy.x >
        fighter.x

          ? 1
          : -1;

    }

  }


  function separateFighters() {

    const first =
      fighters[0];


    const second =
      fighters[1];


    const dx =
      second.x -
      first.x;


    const distance =
      Math.abs(
        dx
      );


    if (
      distance >=
        50 ||
      distance ===
        0
    ) {

      return;

    }


    const push =

      (
        50 -
        distance
      ) /
      2;


    const sign =
      Math.sign(
        dx
      );


    first.x -=
      sign *
      push;


    second.x +=
      sign *
      push;


    first.x =
      clamp(
        first.x,
        45,
        WIDTH - 45
      );


    second.x =
      clamp(
        second.x,
        45,
        WIDTH - 45
      );

  }


  function update(
    dt
  ) {

    if (
      phase !==
      "fighting"
    ) {

      return;

    }


    updateFighter(

      fighters[0],

      fighters[1],

      dt

    );


    updateFighter(

      fighters[1],

      fighters[0],

      dt

    );


    separateFighters();

  }


  /*
   * =====================================================
   * BACKGROUND DRAW
   * =====================================================
   */

  function drawCoverImage(
    image
  ) {

    const scale =
      Math.max(

        WIDTH /
        image.width,

        HEIGHT /
        image.height

      );


    const width =
      image.width *
      scale;


    const height =
      image.height *
      scale;


    ctx.drawImage(

      image,

      (
        WIDTH -
        width
      ) /
      2,

      (
        HEIGHT -
        height
      ) /
      2,

      width,

      height

    );

  }


  function drawBackground() {

    if (
      backgroundMode ===
        "custom" &&
      customBackground
    ) {

      drawCoverImage(
        customBackground
      );


      ctx.fillStyle =
        "rgba(255,255,255,.15)";


      ctx.fillRect(
        0,
        0,
        WIDTH,
        HEIGHT
      );

    } else if (
      backgroundMode ===
      "roof"
    ) {

      ctx.fillStyle =
        "#c4d2dc";


      ctx.fillRect(
        0,
        0,
        WIDTH,
        HEIGHT
      );


      ctx.fillStyle =
        "#8a96a0";


      for (
        let i = 0;
        i < 9;
        i += 1
      ) {

        const h =

          120 +

          (
            i %
            4
          ) *

          38;


        ctx.fillRect(

          i *
          125 -
          20,

          FLOOR_Y -
          h,

          90,

          h

        );

      }


      ctx.fillStyle =
        "#6d7277";


      ctx.fillRect(
        0,
        FLOOR_Y,
        WIDTH,
        HEIGHT -
        FLOOR_Y
      );

    } else if (
      backgroundMode ===
      "dojo"
    ) {

      ctx.fillStyle =
        "#e7dcc8";


      ctx.fillRect(
        0,
        0,
        WIDTH,
        HEIGHT
      );


      ctx.strokeStyle =
        "#9f8e78";


      ctx.lineWidth =
        5;


      for (
        let x = 0;
        x < WIDTH;
        x += 110
      ) {

        ctx.beginPath();

        ctx.moveTo(
          x,
          0
        );

        ctx.lineTo(
          x,
          FLOOR_Y
        );

        ctx.stroke();

      }


      ctx.fillStyle =
        "#b9a484";


      ctx.fillRect(
        0,
        FLOOR_Y,
        WIDTH,
        HEIGHT -
        FLOOR_Y
      );

    } else if (
      backgroundMode ===
      "forest"
    ) {

      ctx.fillStyle =
        "#b9cfad";


      ctx.fillRect(
        0,
        0,
        WIDTH,
        HEIGHT
      );


      ctx.fillStyle =
        "#6e8c61";


      for (
        let i = 0;
        i < 8;
        i += 1
      ) {

        const x =

          i *
          145 -
          15;


        ctx.fillRect(
          x,
          190,
          18,
          230
        );


        ctx.beginPath();


        ctx.arc(

          x + 9,

          170,

          60,

          0,

          Math.PI *
          2

        );


        ctx.fill();

      }


      ctx.fillStyle =
        "#91836b";


      ctx.fillRect(
        0,
        FLOOR_Y,
        WIDTH,
        HEIGHT -
        FLOOR_Y
      );

    } else {

      ctx.fillStyle =
        "#f0eee8";


      ctx.fillRect(
        0,
        0,
        WIDTH,
        HEIGHT
      );


      ctx.fillStyle =
        "#d7d2c8";


      ctx.fillRect(
        0,
        FLOOR_Y,
        WIDTH,
        HEIGHT -
        FLOOR_Y
      );

    }


    ctx.strokeStyle =
      "#222";


    ctx.lineWidth =
      3;


    ctx.beginPath();


    ctx.moveTo(
      0,
      FLOOR_Y
    );


    ctx.lineTo(
      WIDTH,
      FLOOR_Y
    );


    ctx.stroke();

  }


  /*
   * =====================================================
   * STICK FIGURES
   * =====================================================
   */

  function drawStick(
    fighter
  ) {

    const baseY =

      FLOOR_Y -
      fighter.y;


    const attacking =

      fighter.attackTime >
      0;


    const hurt =

      fighter.hurtTime >
      0;


    ctx.save();


    ctx.translate(
      fighter.x,
      baseY
    );


    if (hurt) {

      ctx.translate(

        Math.sin(
          performance.now() *
          .08
        ) *
        4,

        0

      );

    }


    ctx.strokeStyle =
      "#000";


    ctx.fillStyle =
      "#000";


    ctx.lineWidth =
      7;


    ctx.lineCap =
      "round";


    ctx.lineJoin =
      "round";


    ctx.beginPath();


    ctx.arc(
      0,
      -112,
      18,
      0,
      Math.PI * 2
    );


    ctx.stroke();


    ctx.beginPath();


    ctx.moveTo(
      0,
      -94
    );


    ctx.lineTo(
      0,
      -42
    );


    ctx.moveTo(
      0,
      -80
    );


    ctx.lineTo(

      -fighter.facing *
      24,

      -62

    );


    ctx.moveTo(
      0,
      -80
    );


    ctx.lineTo(

      fighter.facing *

      (
        attacking
          ? 78
          : 28
      ),

      attacking
        ? -82
        : -60

    );


    ctx.moveTo(
      0,
      -42
    );


    ctx.lineTo(
      -23,
      0
    );


    ctx.moveTo(
      0,
      -42
    );


    ctx.lineTo(
      24,
      0
    );


    ctx.stroke();


    ctx.font =
      "900 13px system-ui";


    ctx.textAlign =
      "center";


    ctx.fillText(

      fighter.id ===
      "p1"

        ? "P1"
        : "P2",

      0,

      -145

    );


    ctx.restore();

  }


  function render() {

    drawBackground();


    drawStick(
      fighters[0]
    );


    drawStick(
      fighters[1]
    );


    $(
      "#sfP1Text"
    )
      .textContent =

        `P1 · ${Math.ceil(
          fighters[0]
            .hp
        )} HP`;


    $(
      "#sfP2Text"
    )
      .textContent =

        `P2 · ${Math.ceil(
          fighters[1]
            .hp
        )} HP`;


    $(
      "#sfP1Hp"
    )
      .style
      .transform =

        `scaleX(${
          fighters[0]
            .hp /
          MAX_HP
        })`;


    $(
      "#sfP2Hp"
    )
      .style
      .transform =

        `scaleX(${
          fighters[1]
            .hp /
          MAX_HP
        })`;

  }


  /*
   * =====================================================
   * LOOP
   * =====================================================
   */

  function loop(
    now
  ) {

    if (!active) {
      return;
    }


    const dt =
      Math.min(

        .04,

        Math.max(
          0,
          (
            now -
            lastTime
          ) /
          1000
        )

      );


    lastTime =
      now;


    update(
      dt
    );


    render();


    animationFrame =
      requestAnimationFrame(
        loop
      );

  }


  /*
   * =====================================================
   * CONTROLS
   * =====================================================
   */

  function bindControls() {

    controlsAbort
      ?.abort();


    controlsAbort =
      new AbortController();


    const options = {
      signal:
        controlsAbort.signal
    };


    window.addEventListener(
      "keydown",
      event => {

        if (!active) {
          return;
        }


        if (
          [
            "ArrowLeft",
            "ArrowRight",
            "ArrowUp",
            "Enter"
          ]
            .includes(
              event.code
            )
        ) {

          event.preventDefault();

        }


        if (
          event.code ===
          "Escape"
        ) {

          hide();

          return;

        }


        if (
          !event.repeat
        ) {

          if (
            event.code ===
            "KeyW"
          ) {

            jump(
              fighters[0]
            );

          }


          if (
            event.code ===
            "ArrowUp"
          ) {

            jump(
              fighters[1]
            );

          }


          if (
            event.code ===
            "KeyF"
          ) {

            attack(
              fighters[0],
              fighters[1]
            );

          }


          if (
            event.code ===
            "Enter"
          ) {

            attack(
              fighters[1],
              fighters[0]
            );

          }

        }


        keys.add(
          event.code
        );

      },
      options
    );


    window.addEventListener(
      "keyup",
      event => {

        keys.delete(
          event.code
        );

      },
      options
    );


    window.addEventListener(
      "blur",
      () => {

        keys.clear();
        held.clear();

      },
      options
    );


    overlay
      .querySelectorAll(
        "[data-hold]"
      )
      .forEach(
        button => {

          const action =
            button.dataset
              .hold;


          const release =
            () => {

              held.delete(
                action
              );

            };


          button.addEventListener(
            "pointerdown",
            event => {

              event.preventDefault();


              held.add(
                action
              );


              button
                .setPointerCapture
                ?.(
                  event.pointerId
                );

            },
            options
          );


          [
            "pointerup",
            "pointercancel",
            "lostpointercapture"
          ]
            .forEach(
              type => {

                button
                  .addEventListener(
                    type,
                    release,
                    options
                  );

              }
            );

        }
      );


    overlay
      .querySelectorAll(
        "[data-action]"
      )
      .forEach(
        button => {

          button.addEventListener(
            "click",
            () => {

              handleAction(
                button.dataset
                  .action
              );

            },
            options
          );

        }
      );

  }


  /*
   * =====================================================
   * NETWORK CONTRACT FOUNDATION
   * =====================================================
   */

  function getMultiplayerContract() {

    return {

      schemaVersion:
        1,

      gameId:
        GAME_ID,

      maxPlayers:
        2,

      mode:
        "1v1",

      voice:
        true,

      inputs: [
        "left",
        "right",
        "jump",
        "attack"
      ],

      background: {

        presets: [
          "roof",
          "dojo",
          "forest",
          "plain"
        ],

        customLocalImage:
          true

      }

    };

  }


  function getState() {

    return {

      schemaVersion:
        1,

      gameId:
        GAME_ID,

      phase,

      backgroundMode,

      fighters:

        fighters.map(
          fighter => ({

            id:
              fighter.id,

            x:
              fighter.x,

            y:
              fighter.y,

            vx:
              fighter.vx,

            vy:
              fighter.vy,

            facing:
              fighter.facing,

            hp:
              fighter.hp,

            grounded:
              fighter.grounded

          })
        )

    };

  }


  /*
   * =====================================================
   * SHOW / HIDE
   * =====================================================
   */

  function show() {

    makeUI();


    if (active) {
      return;
    }


    active =
      true;


    previousOverflow =
      document.body
        .style
        .overflow;


    document.body
      .style
      .overflow =
        "hidden";


    overlay
      .classList
      .add(
        "active"
      );


    bindControls();


    voicePanel =

      window
        .LAGO_GAME_VOICE
        ?.createPanel({

          gameId:
            GAME_ID,

          mount:
            $(
              "#sfVoice"
            ),

          placement:
            "inline"

        }) ||
      null;


    showLobby();


    lastTime =
      performance.now();


    animationFrame =
      requestAnimationFrame(
        loop
      );

  }


  function hide() {

    if (!active) {
      return;
    }


    active =
      false;


    phase =
      "lobby";


    cancelAnimationFrame(
      animationFrame
    );


    controlsAbort
      ?.abort();


    controlsAbort =
      null;


    keys.clear();
    held.clear();


    voicePanel
      ?.destroy();


    voicePanel =
      null;


    overlay
      .classList
      .remove(
        "active"
      );


    document.body
      .style
      .overflow =
        previousOverflow;

  }


  document.addEventListener(
    "lago:mini-game-open",
    event => {

      if (
        event.detail
          ?.game
          ?.id ===
        GAME_ID
      ) {

        show();

      }

    }
  );


  window.LAGO_STICK_FIGHTS =
    Object.freeze({

      version:
        VERSION,

      show,

      hide,

      getState,

      getMultiplayerContract

    });

})();


(() => {
  "use strict";

  /*
   * LAGO GAME 2.0
   * R1.6B — AGENT PROGRESSION UI
   *
   * Borderless statistics.
   * Existing account data only.
   */

  const VERSION = 3;

  let mounted = false;
  let scheduled = false;
  let hpCard = null;
  let xpCard = null;
  let energyBar = null;
  let bondCard = null;

  function installStyles() {

    if (document.getElementById(
      "lgProgressionStyles"
    )) return;

    const style = document.createElement("style");

    style.id = "lgProgressionStyles";

    
    style.textContent = `

      /* R1.9C — Responsive progression UI */

      #lagoModern
      .lago-statbar.lg-progression-active {

        display: grid;

        grid-template-columns:
          repeat(5, minmax(0, 1fr));

        align-items: stretch;

        flex: 0 0 auto;

        width: min(1180px, calc(100% - 32px));

        min-width: 0;

        margin: 0 auto;

        gap: 12px;

      }

      #lagoModern .lg-progression-active
      .lago-stat-card {

        display: flex;
        flex-direction: column;

        justify-content: flex-start;

        min-width: 0;
        min-height: 0;

        padding: 8px 10px;

        background: transparent;

        border: none;
        border-radius: 0;

        box-shadow: none;

        contain: none;

      }


      /* STAT LABELS */

      #lagoModern .lg-progression-active
      .lago-stat-label {

        display: flex;

        align-items: center;

        gap: 6px;

        min-width: 0;

        color: var(--lg-text-secondary);

        font-family: var(--lg-font);

        font-size: 11px;
        font-weight: 650;

        line-height: 1.3;

        letter-spacing: .035em;

      }

      #lagoModern .lg-progression-active
      .lago-stat-label > span {

        min-width: 0;

        overflow-wrap: anywhere;

      }


      /* NUMERIC VALUES */

      #lagoModern .lg-progression-active
      .lago-stat-value {

        min-width: 0;

        margin-top: 5px;

        color: var(--lg-text);

        font-family: var(--lg-font);

        font-size: clamp(17px, 2vw, 26px);
        font-weight: 750;

        font-variant-numeric: tabular-nums;

        line-height: 1.2;

        letter-spacing: -.035em;

        overflow-wrap: anywhere;

        white-space: normal;

      }


      /* ICONS */

      #lagoModern .lg-progression-active
      .lago-icon-slot,

      #lagoModern .lg-progression-active
      .lg-progression-icon {

        width: 16px;
        height: 16px;

        flex: 0 0 16px;

      }


      /* PROGRESS TRACKS */

      .lg-progression-track {

        box-sizing: border-box;

        width: 100%;
        height: 4px;

        margin-top: 8px;

        background:
          var(--lg-surface-raised);

        border: none;

        border-radius: 999px;

        overflow: hidden;

      }

      .lg-progression-fill {

        display: block;

        width: 0;
        height: 100%;

        border-radius: inherit;

        transition: width 120ms ease-out;

      }


      /* HEALTH */

      .lg-hp-card .lg-progression-icon {

        color: var(--lg-success);

      }

      .lg-hp-card .lg-progression-fill {

        background: var(--lg-success);

      }

      #lagoModern
      .lg-hp-card[data-low="true"]
      .lg-progression-fill {

        background: var(--lg-danger);

      }

      #lagoModern
      .lg-hp-card[data-low="true"]
      .lago-stat-value {

        color: var(--lg-danger);

      }


      /* EXPERIENCE */

      .lg-xp-card .lg-progression-icon {

        color: var(--lg-ai);

      }

      .lg-xp-card .lg-progression-fill {

        background: var(--lg-ai);

      }


      /* ENERGY */

      .lg-energy-track
      .lg-progression-fill {

        background: var(--lg-accent);

      }


      /* TABLETS */

      @media (max-width: 899px) {

        #lagoModern
        .lago-statbar.lg-progression-active {

          grid-template-columns:
            repeat(5, minmax(0, 1fr));

          width: calc(100% - 24px);

          gap: 6px;

        }

        #lagoModern .lg-progression-active
        .lago-stat-card {

          padding: 5px;

        }

        #lagoModern .lg-progression-active
        .lago-stat-label {

          font-size: 10px;

        }

        #lagoModern .lg-progression-active
        .lago-stat-value {

          font-size: 18px;

        }

      }


      /* PHONES */

      @media (max-width: 600px) {

        #lagoModern
        .lago-statbar.lg-progression-active {

          grid-template-columns:
            repeat(3, minmax(0, 1fr));

          column-gap: 8px;
          row-gap: 4px;

        }

        #lagoModern .lg-progression-active
        .lago-stat-card {

          padding: 4px 5px;

        }

        #lagoModern .lg-progression-active
        .lago-stat-label {

          font-size: 10px;

          letter-spacing: 0;

        }

        #lagoModern .lg-progression-active
        .lago-stat-value {

          font-size: clamp(14px, 4vw, 18px);

          margin-top: 3px;

        }

        .lg-progression-track {

          margin-top: 5px;

          height: 3px;

        }

        #lagoModern .lg-progression-active
        .lago-icon-slot,

        #lagoModern .lg-progression-active
        .lg-progression-icon {

          width: 14px;
          height: 14px;

          flex-basis: 14px;

        }

      }


      /* EXTRA SMALL PHONES */

      @media (max-width: 340px) {

        #lagoModern
        .lago-statbar.lg-progression-active {

          width: calc(100% - 16px);

          gap: 4px;

        }

        #lagoModern .lg-progression-active
        .lago-stat-label {

          font-size: 9px;

          gap: 3px;

        }

        #lagoModern .lg-progression-active
        .lago-stat-value {

          font-size: 14px;

        }

      }


      /* SHORT DISPLAYS */

      @media (max-height: 650px) {

        #lagoModern .lg-progression-active
        .lago-stat-card {

          padding-top: 3px;
          padding-bottom: 3px;

        }

        .lg-progression-track {

          margin-top: 4px;

        }

      }


      /* R2.5H — Individual agent bond */

      .lg-bond-card .lg-progression-icon {

        color: var(--lg-ai);

      }

      #lagoModern
      .lg-bond-card
      .lago-stat-value {

        color: var(--lg-ai);

      }

      .lg-bond-card .lg-progression-fill {

        background: var(--lg-ai);

      }

      .lg-bond-rank {

        margin-top: 5px;

        color: var(--lg-text-secondary);

        font-size: 10px;

        font-weight: 500;

        line-height: 1.3;

        overflow-wrap: anywhere;

      }

      @media (min-width: 761px) {

        #lagoModern
        .lago-statbar.lg-progression-active {

          grid-template-columns:
            repeat(6, minmax(0, 1fr));

        }

      }

      @media (max-width: 760px) {

        #lagoModern
        .lago-statbar.lg-progression-active {

          grid-template-columns:
            repeat(3, minmax(0, 1fr));

        }

        .lg-bond-rank {

          font-size: 9px;

        }

      }



      /* ACCESSIBILITY */

      @media (prefers-reduced-motion: reduce) {

        .lg-progression-fill {

          transition: none;

        }

      }

    `;



    document.head.appendChild(style);

  }

  function createTrack(className = "") {

    const track = document.createElement("div");

    track.className =
      "lg-progression-track " + className;

    track.setAttribute("role", "progressbar");
    track.setAttribute("aria-valuemin", "0");
    track.setAttribute("aria-valuemax", "100");
    track.setAttribute("aria-valuenow", "0");

    const fill = document.createElement("i");

    fill.className = "lg-progression-fill";

    track.appendChild(fill);

    return track;

  }

  function createCard(type, label, icon) {

    const card = document.createElement("div");

    card.className =
      "lago-stat-card lg-" + type + "-card";

    card.innerHTML = `

      <div class="lago-stat-label">

        <svg
          class="lg-progression-icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          ${icon}
        </svg>

        <span>${label}</span>

      </div>

      <div class="lago-stat-value">
        —
      </div>

    `;

    const track = createTrack();

    track.setAttribute(
      "aria-label",
      type === "hp" ? "Health" : "Level progress"
    );

    card.appendChild(track);

    return card;

  }

  function mount() {

    if (mounted) return true;

    const statbar = document.querySelector(
      "#lagoModern .lago-statbar"
    );

    const energyCard = document
      .getElementById("modernEnergy")
      ?.closest(".lago-stat-card");

    if (
      !statbar ||
      !energyCard ||
      !window.LAGO_AGENT_PROGRESSION
    ) return false;

    installStyles();

    hpCard = createCard(
      "hp",
      "HP",
      `
        <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/>
        <path d="M3 12h5l2-4 3 8 2-4h6"/>
      `
    );

    xpCard = createCard(
      "xp",
      "XP",
      `
        <path d="m12 2 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1Z"/>
      `
    );

    statbar.insertBefore(
      hpCard,
      energyCard
    );

    energyCard.after(xpCard);

    
    /*
     * R2.5H — Bond progression card.
     */

    bondCard = createCard(

      "bond",

      "BOND",

      `
        <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/>
        <path d="m8 12 3 3 5-6"/>
      `

    );


    bondCard.querySelector(
      ".lg-progression-track"
    ).setAttribute(

      "aria-label",

      "Character bond progress"

    );


    const bondRank =
      document.createElement("div");

    bondRank.className =
      "lg-bond-rank";

    bondRank.textContent = "—";

    bondCard.appendChild(bondRank);

    statbar.appendChild(bondCard);



    energyBar = createTrack("lg-energy-track");

    energyBar.setAttribute(
      "aria-label",
      "Energy"
    );

    energyCard.appendChild(energyBar);

    statbar.classList.add(
      "lg-progression-active"
    );

    mounted = true;

    render();

    return true;

  }

  function format(value) {

    return Number(value || 0)
      .toLocaleString("en-US", {
        maximumFractionDigits: 1
      });

  }

  function setTrack(track, value) {

    const percent = Math.max(
      0,
      Math.min(100, Number(value) || 0)
    );

    track.querySelector(
      ".lg-progression-fill"
    ).style.width = percent + "%";

    track.setAttribute(
      "aria-valuenow",
      String(Math.round(percent))
    );

  }

  function render() {

    if (!mounted) return;

    const state =
      window.LAGO_AGENT_PROGRESSION
        ?.getState?.();

    if (!state?.ready) return;

    hpCard.querySelector(
      ".lago-stat-value"
    ).textContent =
      format(state.health.value) +
      "/" +
      format(state.health.max);

    hpCard.dataset.low = String(
      state.health.percent <= 25
    );

    setTrack(
      hpCard.querySelector(
        ".lg-progression-track"
      ),
      state.health.percent
    );

    xpCard.querySelector(
      ".lago-stat-value"
    ).textContent =
      format(state.experience.total);

    setTrack(
      xpCard.querySelector(
        ".lg-progression-track"
      ),
      state.experience.progressPercent
    );

   
    setTrack(
      energyBar,
      state.energy.percent
    );

    /*
     * R2.5H — Render persisted bond.
     */


    const bond =
      state.agent?.bond;

    const bondValue =
      bondCard.querySelector(
        ".lago-stat-value"
      );

    const bondTrack =
      bondCard.querySelector(
        ".lg-progression-track"
      );

    const bondRank =
      bondCard.querySelector(
        ".lg-bond-rank"
      );


    if (

      bond &&

      bond.characterId ===
        state.characterId &&

      Number.isFinite(bond.percent)

    ) {

      bondValue.textContent =
        format(bond.percent) + "%";


      bondRank.textContent =

        "Lv. " +

        bond.level +

        " · " +

        bond.title;


      setTrack(
        bondTrack,
        bond.percent
      );


      bondTrack.setAttribute(

        "aria-valuetext",

        bond.points +

        " of " +

        bond.maxPoints +

        " bond points"

      );


      bondCard.title =

        bond.points +

        " / " +

        bond.maxPoints +

        " BP";

    } else {

      bondValue.textContent = "—";

      bondRank.textContent =
        "Unavailable";

      setTrack(bondTrack, 0);

      bondTrack.setAttribute(

        "aria-valuetext",

        "Bond unavailable"

      );

      
      bondCard.removeAttribute("title");

    }

  }


  /*
   * Batch frequent account updates.
   * Avoid multiple renders during rapid taps.
   */

  function scheduleRender() {

    if (scheduled || !mounted) return;

    scheduled = true;

    requestAnimationFrame(() => {

      try {
        render();
      } finally {
        scheduled = false;
      }

    });

  }

  for (const event of [

    "lago:state",

    "lago:account-state",

    "lago:tap-game-state",

    "lago:character-equipped",

    "lago:agent-bond-state",

    "lago:agent-bond-runtime-ready",

    "lago:language"


  ]) {

    document.addEventListener(
      event,
      scheduleRender
    );

  }

  window.LAGO_AGENT_PROGRESSION_UI =
    Object.freeze({

      version: VERSION,

      mount,

      render: scheduleRender

    });

  if (!mount() && document.readyState === "loading") {

    document.addEventListener(
      "DOMContentLoaded",
      mount,
      { once: true }
    );

  }

})();

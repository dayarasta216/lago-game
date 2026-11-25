
(() => {
  "use strict";

  /*
   * LAGO GAME 2.0
   * R1.6B — AGENT PROGRESSION UI
   *
   * Borderless statistics.
   * Existing account data only.
   */

  const VERSION = 1;

  let mounted = false;
  let scheduled = false;
  let hpCard = null;
  let xpCard = null;
  let energyBar = null;

  function installStyles() {

    if (document.getElementById(
      "lgProgressionStyles"
    )) return;

    const style = document.createElement("style");

    style.id = "lgProgressionStyles";

    style.textContent = `

      #lagoModern .lago-statbar.lg-progression-active {
        grid-template-columns:
          repeat(5, minmax(0, 1fr));

        gap: 10px;
      }

      #lagoModern .lg-progression-active
      .lago-stat-card {
        min-width: 0;

        background: transparent;
        border: none;
        box-shadow: none;
      }

      #lagoModern .lg-progression-active
      .lago-stat-label {
        font-size: 10px;
        font-weight: 650;
        letter-spacing: .04em;
      }

      #lagoModern .lg-progression-active
      .lago-stat-value {
        font-size: clamp(16px, 2vw, 24px);
        font-weight: 750;
        font-variant-numeric: tabular-nums;

        overflow-wrap: anywhere;
      }

      .lg-progression-icon {
        width: 16px;
        height: 16px;
        flex: 0 0 16px;
      }

      .lg-progression-track {
        box-sizing: border-box;

        width: 100%;
        height: 4px;

        margin-top: 7px;

        background: var(--lg-surface-raised);
        border: none;
        border-radius: 999px;
        overflow: hidden;
      }

      .lg-progression-fill {
        display: block;

        width: 0;
        height: 100%;

        border-radius: inherit;

        transition:
          width var(--lg-motion-normal);
      }

      .lg-hp-card .lg-progression-icon {
        color: var(--lg-success);
      }

      .lg-hp-card .lg-progression-fill {
        background: var(--lg-success);
      }

      .lg-xp-card .lg-progression-icon {
        color: var(--lg-ai);
      }

      .lg-xp-card .lg-progression-fill {
        background: var(--lg-ai);
      }

      .lg-energy-track .lg-progression-fill {
        background: var(--lg-accent);
      }

      #lagoModern .lg-hp-card[data-low="true"]
      .lg-progression-fill {
        background: var(--lg-danger);
      }

      @media (max-width: 899px) {

        #lagoModern .lago-statbar.lg-progression-active {
          grid-template-columns:
            repeat(3, minmax(0, 1fr));

          column-gap: 8px;
          row-gap: 3px;
        }

        #lagoModern .lg-progression-active
        .lago-stat-card {
          padding: 5px 7px;
        }

        #lagoModern .lg-progression-active
        .lago-stat-label {
          font-size: 9px;
        }

        #lagoModern .lg-progression-active
        .lago-stat-value {
          font-size: 17px;
        }

        .lg-progression-track {
          margin-top: 4px;
          height: 3px;
        }

      }

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

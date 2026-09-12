(() => {
  "use strict";

 const VERSION =
  4;

const SPRITE =
  "./lago-icons.svg";

let toastTimer =
  null;

let currentSpeech =
  "";


  function escapeAttribute(
    value
  ) {

    return String(
      value || ""
    )
      .replaceAll("&", "&amp;")
      .replaceAll("\"", "&quot;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");

  }


  function icon(
    name,
    {
      className = "lago-icon",
      label = ""
    } = {}
  ) {

    const safeName =
      String(
        name || ""
      )
        .toLowerCase()
        .replace(
          /[^a-z0-9-]/g,
          ""
        );


    if (!safeName) {
      return "";
    }


    const accessible =
      label
        ? `
          role="img"
          aria-label="${escapeAttribute(label)}"
        `
        : `
          aria-hidden="true"
        `;


    return `
      <svg
        class="${escapeAttribute(className)}"
        viewBox="0 0 24 24"
        focusable="false"
        ${accessible}
      >
        <use
          href="${SPRITE}#icon-${safeName}"
        ></use>
      </svg>
    `;

  }


  function hydrate(
    root = document
  ) {

    const nodes = [];


    if (
      root instanceof Element &&
      root.matches(
        "[data-lago-icon]"
      )
    ) {

      nodes.push(
        root
      );

    }


    root
      ?.querySelectorAll
      ?.(
        "[data-lago-icon]"
      )
      .forEach(
        node => {

          nodes.push(
            node
          );

        }
      );


    nodes.forEach(
      node => {

        const name =
          node.dataset
            .lagoIcon;


        const className =
          node.dataset
            .lagoIconClass ||
          "lago-icon";


        const label =
          node.dataset
            .lagoIconLabel ||
          "";


        node.innerHTML =
          icon(
            name,
            {
              className,
              label
            }
          );

      }
    );

  }

function openPanel(
  id
) {

  const panel =
    document.getElementById(
      String(
        id || ""
      )
    );


  if (!panel) {

    return false;

  }


  panel.classList.add(
    "show"
  );


  return true;

}


function closePanel(
  id
) {

  const panel =
    document.getElementById(
      String(
        id || ""
      )
    );


  if (!panel) {

    return false;

  }


  panel.classList.remove(
    "show"
  );


  return true;

}


function toast(
  message
) {

  const element =
    document.getElementById(
      "toast"
    );


  if (!element) {

    return false;

  }


  element.textContent =
    String(
      message ?? ""
    )
      .trim();


  element.classList.add(
    "on"
  );


  window.clearTimeout(
    toastTimer
  );


  toastTimer =
    window.setTimeout(
      () => {

        element.classList.remove(
          "on"
        );

      },
      1800
    );


  return true;

}


function setSpeech(
  text
) {

  currentSpeech =
    String(
      text ?? ""
    )
      .trim();


  /*
   * Temporary compatibility mirror.
   * We will delete #cringe together
   * with the legacy app shell later.
   */
  const legacy =
    document.getElementById(
      "cringe"
    );


  if (legacy) {

    legacy.textContent =
      currentSpeech;

  }


  const modern =
    document.getElementById(
      "modernSpeech"
    );


  if (modern) {

    const translated =
      window.LAGO_LANGUAGE
        ?.translate
        ?.(
          currentSpeech
        ) ??
      currentSpeech;


    modern.textContent =
      String(
        translated
      )
        .trim()
        .toUpperCase();

  }


  return currentSpeech;

}


function getSpeech() {

  if (currentSpeech) {

    return currentSpeech;

  }


  return (
    document
      .getElementById(
        "cringe"
      )
      ?.textContent
      ?.trim() ||
    ""
  );

}


function animateTap() {

  const snail =
    document.getElementById(
      "snail"
    );


  const host =
    document.getElementById(
      "modernSnailArea"
    ) ||
    snail
      ?.closest(
        ".lago-modern-snail"
      ) ||
    null;


  /*
   * Animate 2D only when it is
   * actually being used as fallback.
   */
  if (snail) {

    const visible =
      !snail.hidden &&
      window
        .getComputedStyle(
          snail
        )
        .display !==
      "none";


    if (visible) {

      snail.classList.remove(
        "bonk"
      );


      void snail.offsetWidth;


      snail.classList.add(
        "bonk"
      );

    }

  }


  /*
   * Glow belongs to the stable stage.
   */
  if (host) {

    host.classList.remove(
      "tap-glow"
    );


    void host.offsetWidth;


    host.classList.add(
      "tap-glow"
    );


    window.setTimeout(
      () => {

        host.classList.remove(
          "tap-glow"
        );

      },
      260
    );

  }


  /*
   * Future/public GLB animation hook.
   */
  window.LAGO_CHARACTER_3D
    ?.pulseTap
    ?.();

}


function spawnFloat(
  text,
  event = null,
  feedback = null
) {

  const stage =
    document.getElementById(
      "modernSnailArea"
    );


  if (
    !stage
  ) {

    return;

  }


  const rect =
    stage.getBoundingClientRect();


  let x =
    rect.left +
    rect.width / 2;


  let y =
    rect.top +
    rect.height * 0.46;


  /*
   * Если есть координата
   * настоящего тапа —
   * показываем feedback
   * именно возле пальца.
   */
  if (
    Number.isFinite(
      event?.clientX
    ) &&
    Number.isFinite(
      event?.clientY
    )
  ) {

    x =
      event.clientX;

    y =
      event.clientY;

  }


  const element =
    document.createElement(
      "div"
    );


  element.className =
    "lago-tap-float";


  element.style.left =
    `${x}px`;

  element.style.top =
    `${y}px`;


  /*
   * Сохраняем strength в DOM,
   * чтобы CSS мог немного
   * усиливать MAX taps.
   */
  element.dataset.strength =
    String(
      Math.max(
        1,
        Math.min(
          5,
          Number(
            feedback?.strength
          ) || 1
        )
      )
    );


  /*
   * Основное начисление.
   */
  const main =
    document.createElement(
      "div"
    );


  main.className =
    "lago-tap-float-main";


  main.textContent =
    String(
      text || ""
    );


  element.appendChild(
    main
  );


  /*
   * Вторая строка:
   *
   * MAX · ×1.85 · DOUBLE ×2
   */
  const metaParts =
    [];


  if (
    feedback
      ?.strengthLabel
  ) {

    metaParts.push(
      feedback
        .strengthLabel
    );

  }


  if (
    feedback
      ?.tempoLabel
  ) {

    metaParts.push(
      feedback
        .tempoLabel
    );

  }


  if (
    feedback
      ?.doubleClickLabel
  ) {

    metaParts.push(
      feedback
        .doubleClickLabel
    );

  }


  /*
   * Не пишем игроку BOT.
   *
   * При срабатывании ограничения
   * просто показываем FAST LIMIT.
   */
  if (
    feedback
      ?.speedLimited
  ) {

    metaParts.length =
      0;


    metaParts.push(
      "FAST LIMIT"
    );

  }


  if (
    metaParts.length > 0
  ) {

    const meta =
      document.createElement(
        "div"
      );


    meta.className =
      "lago-tap-float-meta";


    meta.textContent =
      metaParts.join(
        " · "
      );


    element.appendChild(
      meta
    );

  }


  /*
   * BODY, а не GLB stage.
   *
   * Поэтому цифра не режется
   * canvas / overflow.
   */
  document.body.appendChild(
    element
  );


  element.addEventListener(
    "animationend",
    () => {

      element.remove();

    },
    {
      once:
        true
    }
  );


  /*
   * Emergency cleanup.
   */
  setTimeout(
    () => {

      element.remove();

    },
    1200
  );

}



window.LAGO_UI =
  Object.freeze({

    version:
      VERSION,

    icon,

    hydrate,

    openPanel,

    closePanel,

    toast,

    setSpeech,

    getSpeech,

    animateTap,

    spawnFloat

  });


document.addEventListener(
  "click",
  event => {

    const close =
      event.target
        ?.closest
        ?.('[data-close]');


    if (!close) {
      return;
    }


    closePanel(
      close.getAttribute(
        "data-close"
      )
    );

  }
);


document.dispatchEvent(
  new CustomEvent(
    "lago:ui-ready",
    {
      detail: {
        version:
          VERSION
      }
    }
  )
);

})();

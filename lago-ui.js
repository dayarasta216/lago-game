(() => {
  "use strict";

 const VERSION =
  2;

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
  event = null
) {

  const host =
    document.getElementById(
      "modernSnailArea"
    ) ||
    document.getElementById(
      "snailWrap"
    );


  if (!host) {

    return null;

  }


  const rect =
    host.getBoundingClientRect();


  const hasPointer =
    Number.isFinite(
      event?.clientX
    ) &&
    Number.isFinite(
      event?.clientY
    );


  const x =
    hasPointer
      ? event.clientX -
        rect.left
      : rect.width /
        2;


  const y =
    hasPointer
      ? event.clientY -
        rect.top
      : rect.height *
        0.42;


  const element =
    document.createElement(
      "div"
    );


  element.className =
    "lago-tap-float";


  element.textContent =
    String(
      text ?? ""
    );


  element.style.left =
    `${Math.max(
      0,
      Math.min(
        rect.width,
        x
      )
    )}px`;


  element.style.top =
    `${Math.max(
      0,
      Math.min(
        rect.height,
        y
      )
    )}px`;


  host.appendChild(
    element
  );


  window.setTimeout(
    () => {

      element.remove();

    },
    850
  );


  return element;

}


/*
 * One close handler for all temporary
 * compatibility panels.
 */
document.addEventListener(
  "click",
  event => {

    const button =
      event.target
        ?.closest
        ?.(
          "[data-close]"
        );


    if (!button) {

      return;

    }


    closePanel(
      button.dataset.close
    );

  }
);

  
window.LAGO_UI =
  Object.freeze({

    version:
      VERSION,

    icon,

    hydrate,

    sprite:
      SPRITE,

    toast,

    setSpeech,

    getSpeech,

    animateTap,

    spawnFloat,

    openPanel,

    closePanel

  });

})();

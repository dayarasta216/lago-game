(() => {
  "use strict";

  const snail = document.querySelector("#snail");

  if (!snail) return;

  /* =========================================
     LAGO LIFE
     Natural idle behavior
     ========================================= */

  let busy = false;

  const wait = ms =>
    new Promise(resolve => setTimeout(resolve, ms));

  const animate = (frames, options) =>
    snail.animate(frames, {
      fill: "forwards",
      ...options
    });

  async function blink() {
    if (busy) return;

    busy = true;

    animate(
      [
        { transform: "scaleY(1)" },
        { transform: "scaleY(.96)" },
        { transform: "scaleY(1)" }
      ],
      {
        duration: 280,
        easing: "ease-in-out"
      }
    );

    await wait(320);

    busy = false;
  }

  async function lookAround() {
    if (busy) return;

    busy = true;

    animate(
      [
        {
          transform:
            "translateX(0) rotate(0deg)"
        },
        {
          transform:
            "translateX(-7px) rotate(-1deg)"
        },
        {
          transform:
            "translateX(7px) rotate(1deg)"
        },
        {
          transform:
            "translateX(0) rotate(0deg)"
        }
      ],
      {
        duration: 1300,
        easing: "cubic-bezier(.2,.8,.2,1)"
      }
    );

    await wait(1350);

    busy = false;
  }

  async function happy() {
    if (busy) return;

    busy = true;

    animate(
      [
        {
          transform:
            "translateY(0) scale(1)"
        },
        {
          transform:
            "translateY(-18px) scale(1.06)"
        },
        {
          transform:
            "translateY(0) scale(.98)"
        },
        {
          transform:
            "translateY(-5px) scale(1.02)"
        },
        {
          transform:
            "translateY(0) scale(1)"
        }
      ],
      {
        duration: 900,
        easing: "cubic-bezier(.16,1,.3,1)"
      }
    );

    await wait(950);

    busy = false;
  }

  /* =========================================
     CLICK REACTION
     ========================================= */

  function clickReaction() {

    busy = true;

    animate(
      [
        {
          transform:
            "translateY(0) scale(1) rotate(0deg)"
        },
        {
          transform:
            "translateY(-16px) scale(1.10) rotate(-3deg)"
        },
        {
          transform:
            "translateY(3px) scale(.93) rotate(3deg)"
        },
        {
          transform:
            "translateY(-4px) scale(1.03) rotate(-1deg)"
        },
        {
          transform:
            "translateY(0) scale(1) rotate(0deg)"
        }
      ],
      {
        duration: 420,
        easing: "cubic-bezier(.16,1,.3,1)"
      }
    );

    setTimeout(() => {
      busy = false;
    }, 440);
  }

  snail.addEventListener(
    "click",
    clickReaction
  );

  /* =========================================
     RANDOM LIFE EVENTS
     ========================================= */

  function randomLife() {

    if (document.hidden) return;

    const roll = Math.random();

    if (roll < .34) {
      blink();
    } else if (roll < .67) {
      lookAround();
    } else {
      happy();
    }
  }

  function schedule() {

    const delay =
      3500 +
      Math.random() * 5000;

    setTimeout(() => {

      randomLife();

      schedule();

    }, delay);
  }

  /* =========================================
     FLOATING HEART / SPARK
     ========================================= */

  function createLifeParticle() {

    const wrap =
      snail.closest(".snail-wrap");

    if (!wrap) return;

    const particle =
      document.createElement("div");

    particle.textContent =
      Math.random() > .5
        ? "✦"
        : "♥";

    particle.style.position =
      "absolute";

    particle.style.left =
      `${42 + Math.random() * 16}%`;

    particle.style.top =
      `${35 + Math.random() * 20}%`;

    particle.style.zIndex =
      "20";

    particle.style.pointerEvents =
      "none";

    particle.style.fontSize =
      `${10 + Math.random() * 8}px`;

    particle.style.opacity =
      "0";

    particle.style.color =
      "#c9ff32";

    wrap.appendChild(particle);

    particle.animate(
      [
        {
          transform:
            "translateY(10px) scale(.5)",
          opacity: 0
        },
        {
          transform:
            "translateY(-10px) scale(1)",
          opacity: 1
        },
        {
          transform:
            "translateY(-42px) scale(.7)",
          opacity: 0
        }
      ],
      {
        duration: 1100,
        easing: "ease-out"
      }
    );

    setTimeout(
      () => particle.remove(),
      1150
    );
  }

  /* =========================================
     START
     ========================================= */

  setTimeout(
    schedule,
    2500
  );

  setInterval(
    () => {

      if (
        !document.hidden &&
        Math.random() > .45
      ) {
        createLifeParticle();
      }

    },
    7000
  );

})();

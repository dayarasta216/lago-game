(() => {
  "use strict";

  function replaceLago() {
    const snail = document.getElementById("snail");

    if (!snail) {
      setTimeout(replaceLago, 100);
      return;
    }

    // Новая Lago
    snail.src = "./lago-snail.png";

    snail.alt = "LAGO";

    snail.removeAttribute("srcset");

    snail.style.objectFit = "contain";
    snail.style.imageRendering = "auto";

    // Немного увеличиваем новую Lago
    // относительно старого изображения
    snail.style.transformOrigin = "center center";

    console.log("🐌 LAGO: new snail loaded");
  }

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      replaceLago
    );
  } else {
    replaceLago();
  }

})();

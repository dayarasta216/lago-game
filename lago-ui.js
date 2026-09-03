(() => {
  "use strict";

  const SPRITE =
    "./lago-icons.svg";


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


  window.LAGO_UI = {

    icon,

    hydrate,

    sprite:
      SPRITE

  };

})();

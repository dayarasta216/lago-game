(() => {
  "use strict";

  const STORAGE =
    "lago_user_profile_v1";


  let overlay = null;


  let profile =
    load();


  function defaults() {

    return {

      name:
        "Lago Player",

      avatar:
        "",

      wallet:
        "",

      walletSigned:
        false,

      signedAt:
        null

    };

  }


  function load() {

    try {

      return {

        ...defaults(),

        ...JSON.parse(
          localStorage.getItem(
            STORAGE
          ) || "{}"
        )

      };

    } catch {

      return defaults();

    }

  }


  function save() {

    localStorage.setItem(
      STORAGE,
      JSON.stringify(
        profile
      )
    );


    refresh();

  }


  function provider() {

    if (
      window.phantom
        ?.solana
        ?.isPhantom
    ) {

      return window.phantom.solana;

    }


    if (
      window.solana
        ?.isPhantom
    ) {

      return window.solana;

    }


    return null;

  }


  function shortWallet(
    value
  ) {

    if (!value) {
      return "NOT CONNECTED";
    }


    return (
      value.slice(0,6) +
      "…" +
      value.slice(-6)
    );

  }


  function create() {

    if (overlay) {
      return;
    }


    const style =
      document.createElement(
        "style"
      );


    style.textContent = `

      #lagoProfileOverlay {

        position: fixed;
        inset: 0;

        z-index: 25000;

        display: none;

        overflow-y: auto;

        padding:
          calc(24px + env(safe-area-inset-top))
          18px
          calc(28px + env(safe-area-inset-bottom));

        background:
          rgba(7,3,9,.96);

        backdrop-filter:
          blur(28px);

        color: white;

        font-family:
          Inter,
          system-ui,
          sans-serif;
      }


      #lagoProfileOverlay.active {
        display: block;
      }


      .lago-profile-shell {

        width:
          min(820px,100%);

        margin:
          0 auto;
      }


      .lago-profile-overlay-header {

        display: flex;

        justify-content:
          space-between;

        align-items: center;

        margin-bottom: 20px;
      }


      .lago-profile-overlay-title {

        font-size:
          clamp(34px,6vw,58px);

        font-weight: 1000;

        letter-spacing: -.06em;
      }


      .lago-profile-close {

        width: 44px;
        height: 44px;

        border-radius: 50%;

        border:
          1px solid
          rgba(255,255,255,.12);

        background:
          rgba(255,255,255,.06);

        color: white;

        cursor: pointer;
      }


      .lago-profile-section {

        margin-bottom: 12px;

        padding: 18px;

        border-radius: 20px;

        border:
          1px solid
          rgba(255,255,255,.08);

        background:
          rgba(255,255,255,.04);
      }


      .lago-profile-avatar {

        width: 100px;
        height: 100px;

        display: grid;
        place-items: center;

        overflow: hidden;

        border-radius: 24px;

        background:
          linear-gradient(
            135deg,
            #ff39ad,
            #a900ff
          );

        font-size: 52px;
      }


      .lago-profile-avatar img {

        width: 100%;
        height: 100%;

        object-fit: cover;
      }


      .lago-profile-input {

        width: 100%;

        margin-top: 9px;

        padding: 12px;

        border:
          1px solid
          rgba(255,255,255,.12);

        border-radius: 12px;

        background:
          rgba(0,0,0,.25);

        color: white;
      }


      .lago-profile-grid {

        display: grid;

        grid-template-columns:
          repeat(3,1fr);

        gap: 8px;

        margin-top: 14px;
      }


      .lago-profile-stat {

        padding: 12px;

        border-radius: 13px;

        background:
          rgba(255,255,255,.04);
      }


      .lago-profile-stat small {

        display: block;

        color:
          rgba(255,255,255,.4);
      }


      .lago-profile-stat strong {

        display: block;

        margin-top: 3px;

        font-size: 20px;
      }


      .lago-profile-action {

        width: 100%;

        margin-top: 8px;

        padding: 12px;

        border: 0;

        border-radius: 12px;

        background:
          rgba(255,255,255,.08);

        color: white;

        font-weight: 900;

        cursor: pointer;
      }


      .lago-profile-action.primary {

        background: #ccff00;

        color: #130614;
      }


      .lago-profile-muted {

        margin-top: 8px;

        color:
          rgba(255,255,255,.38);

        font-size: 11px;

        line-height: 1.45;
      }


      @media(max-width:560px) {

        .lago-profile-grid {

          grid-template-columns:
            1fr;

        }

      }

    `;


    document.head.appendChild(
      style
    );


    overlay =
      document.createElement(
        "div"
      );


    overlay.id =
      "lagoProfileOverlay";


    overlay.innerHTML = `

      <div class="lago-profile-shell">

        <div class="lago-profile-overlay-header">

          <div class="lago-profile-overlay-title">
            PROFILE
          </div>

          <button
            class="lago-profile-close"
            id="lagoProfileClose"
          >
            ×
          </button>

        </div>


        <section class="lago-profile-section">

          <div
            class="lago-profile-avatar"
            id="lagoProfileAvatar"
          >
            🐌
          </div>

          <input
            id="lagoProfileAvatarInput"
            type="file"
            accept="image/*"
            hidden
          >

          <button
            class="lago-profile-action"
            id="lagoUploadAvatar"
          >
            UPLOAD AVATAR
          </button>


          <input
            class="lago-profile-input"
            id="lagoProfileName"
            maxlength="24"
            placeholder="Player name"
          >

          <button
            class="lago-profile-action primary"
            id="lagoSaveProfile"
          >
            SAVE PROFILE
          </button>


          <div class="lago-profile-grid">

            <div class="lago-profile-stat">

              <small>LEVEL</small>

              <strong id="lagoProfileLevel">
                1
              </strong>

            </div>

            <div class="lago-profile-stat">

              <small>XP</small>

              <strong id="lagoProfileXP">
                0
              </strong>

            </div>

            <div class="lago-profile-stat">

              <small>MEM</small>

              <strong id="lagoProfileMEM">
                0
              </strong>

            </div>

          </div>

        </section>


        <section class="lago-profile-section">

          <strong>DAILY REWARD</strong>

          <button
            class="lago-profile-action primary"
            id="lagoProfileDaily"
          >
            CLAIM DAILY REWARD
          </button>

        </section>


        <section class="lago-profile-section">

          <strong>ACCOUNT & WALLET</strong>

          <div
            class="lago-profile-muted"
            id="lagoWalletStatus"
          >
            NOT CONNECTED
          </div>

          <button
            class="lago-profile-action"
            id="lagoConnectWallet"
          >
            CONNECT WALLET
          </button>

          <button
            class="lago-profile-action"
            id="lagoWalletSignIn"
          >
            SIGN IN WITH WALLET
          </button>

          <div class="lago-profile-muted">
            Wallet signature is currently
            stored locally. Secure server
            authentication will be added
            with the Lago backend.
          </div>

        </section>


        <section class="lago-profile-section">

          <strong>SETTINGS</strong>

          <button
            class="lago-profile-action"
            id="lagoProfileLanguage"
          >
            CHANGE LANGUAGE
          </button>

        </section>

      </div>

    `;


    document.body.appendChild(
      overlay
    );


    bind();


    render();

  }


  function bind() {

    overlay
      .querySelector(
        "#lagoProfileClose"
      )
      ?.addEventListener(
        "click",
        hide
      );


    overlay
      .querySelector(
        "#lagoUploadAvatar"
      )
      ?.addEventListener(
        "click",
        () => {

          overlay
            .querySelector(
              "#lagoProfileAvatarInput"
            )
            ?.click();

        }
      );


    overlay
      .querySelector(
        "#lagoProfileAvatarInput"
      )
      ?.addEventListener(
        "change",
        avatarChanged
      );


    overlay
      .querySelector(
        "#lagoSaveProfile"
      )
      ?.addEventListener(
        "click",
        () => {

          const value =
            overlay
              .querySelector(
                "#lagoProfileName"
              )
              ?.value
              ?.trim();


          if (value) {

            profile.name =
              value.slice(0,24);

          }


          save();

          render();

        }
      );


    overlay
      .querySelector(
        "#lagoProfileLanguage"
      )
      ?.addEventListener(
        "click",
        () => {

          window.LAGO_LANGUAGE
            ?.open
            ?.();

        }
      );


    overlay
      .querySelector(
        "#lagoProfileDaily"
      )
      ?.addEventListener(
        "click",
        () => {

          window.LAGO_REWARDS
            ?.claim
            ?.();

          render();

        }
      );


    overlay
      .querySelector(
        "#lagoConnectWallet"
      )
      ?.addEventListener(
        "click",
        connectWallet
      );


    overlay
      .querySelector(
        "#lagoWalletSignIn"
      )
      ?.addEventListener(
        "click",
        signInWallet
      );

  }


  async function avatarChanged(
    event
  ) {

    const file =
      event.target.files
        ?.[0];


    if (!file) {
      return;
    }


    const url =
      URL.createObjectURL(
        file
      );


    const image =
      new Image();


    image.onload =
      () => {

        const canvas =
          document.createElement(
            "canvas"
          );


        canvas.width =
          256;

        canvas.height =
          256;


        const context =
          canvas.getContext(
            "2d"
          );


        const side =
          Math.min(
            image.width,
            image.height
          );


        const sx =
          (
            image.width -
            side
          ) / 2;


        const sy =
          (
            image.height -
            side
          ) / 2;


        context.drawImage(
          image,
          sx,
          sy,
          side,
          side,
          0,
          0,
          256,
          256
        );


        profile.avatar =
          canvas.toDataURL(
            "image/jpeg",
            .86
          );


        URL.revokeObjectURL(
          url
        );


        save();

        render();

      };


    image.src =
      url;

  }


  async function connectWallet() {

    const wallet =
      provider();


    if (!wallet) {

      alert(
        "Phantom wallet not found."
      );

      return;

    }


    try {

      const result =
        await wallet.connect();


      profile.wallet =
        result.publicKey
          .toString();


      profile.walletSigned =
        false;


      save();

      render();

    } catch {

      return;

    }

  }


  async function signInWallet() {

    const wallet =
      provider();


    if (!wallet) {

      alert(
        "Phantom wallet not found."
      );

      return;

    }


    if (!profile.wallet) {

      await connectWallet();

    }


    if (
      typeof wallet.signMessage !==
      "function"
    ) {

      alert(
        "Wallet message signing is unavailable."
      );

      return;

    }


    try {

      const message =
        [
          "LAGO GAME LOGIN",
          location.host,
          new Date().toISOString(),
          crypto.randomUUID()
        ].join("\n");


      const bytes =
        new TextEncoder()
          .encode(
            message
          );


      await wallet.signMessage(
        bytes,
        "utf8"
      );


      profile.walletSigned =
        true;


      profile.signedAt =
        new Date()
          .toISOString();


      save();

      render();

    } catch {

      return;

    }

  }


  function render() {

    create();


    const account =
      window.LAGO_ACCOUNT
        ?.getState
        ?.() || {
          mem: 0,
          xp: 0,
          level: 1
        };


    const avatar =
      overlay.querySelector(
        "#lagoProfileAvatar"
      );


    avatar.innerHTML =
      profile.avatar

        ? `<img
             src="${profile.avatar}"
             alt=""
           >`

        : "🐌";


    overlay
      .querySelector(
        "#lagoProfileName"
      )
      .value =
      profile.name;


    overlay
      .querySelector(
        "#lagoProfileLevel"
      )
      .textContent =
      account.level;


    overlay
      .querySelector(
        "#lagoProfileXP"
      )
      .textContent =
      Math.floor(
        account.xp || 0
      );


    overlay
      .querySelector(
        "#lagoProfileMEM"
      )
      .textContent =
      Math.floor(
        account.mem || 0
      );


    overlay
      .querySelector(
        "#lagoWalletStatus"
      )
      .textContent =
      profile.walletSigned

        ? `SIGNED · ${shortWallet(
            profile.wallet
          )}`

        : shortWallet(
            profile.wallet
          );


    const daily =
      overlay.querySelector(
        "#lagoProfileDaily"
      );


    if (
      window.LAGO_REWARDS
        ?.canClaim
        ?.()
    ) {

      daily.disabled =
        false;

      daily.textContent =
        "CLAIM DAILY REWARD";

    } else {

      daily.disabled =
        true;

      daily.textContent =
        "CLAIMED TODAY";

    }


    refreshHeader();


    window.LAGO_LANGUAGE
      ?.translateDOM
      ?.(overlay);

  }


  function refreshHeader() {

    const avatar =
      document.getElementById(
        "lagoHeaderAvatar"
      );


    if (avatar) {

      avatar.innerHTML =
        profile.avatar

          ? `<img
               src="${profile.avatar}"
               alt=""
             >`

          : "🐌";

    }


    const name =
      document.getElementById(
        "lagoHeaderName"
      );


    if (name) {

      name.textContent =
        profile.name;

    }

  }


  function refresh() {

    if (overlay) {

      render();

    } else {

      refreshHeader();

    }

  }


  function show() {

    create();

    render();

    overlay.classList.add(
      "active"
    );

  }


  function hide() {

    overlay
      ?.classList.remove(
        "active"
      );

  }


  function init() {

    create();


    document
      .getElementById(
        "lagoProfileButton"
      )
      ?.addEventListener(
        "click",
        show
      );


    refresh();


    document.addEventListener(
      "lago:account-state",
      refresh
    );


    document.addEventListener(
      "lago:language",
      refresh
    );

  }


  window.LAGO_PROFILE = {
    show,
    hide,
    refresh
  };


  if (
    document.readyState ===
    "loading"
  ) {

    document.addEventListener(
      "DOMContentLoaded",
      init,
      {
        once: true
      }
    );

  } else {

    init();

  }

})();

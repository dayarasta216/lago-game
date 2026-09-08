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
  null,

telegramId:
  "",

telegramUsername:
  "",

telegramName:
  "",

telegramLinked:
  false

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
  class="lago-profile-close lago-overlay-close"
  id="lagoProfileClose"
  aria-label="Close"
>
  <span
    class="lago-icon-slot"
    data-lago-icon="close"
  ></span>
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
  <span
    class="lago-icon-slot"
    data-lago-icon="upload"
  ></span>

  <span>
    UPLOAD AVATAR
  </span>
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

              <small class="lago-profile-stat-label">

  <span
    class="lago-icon-slot"
    data-lago-icon="sp"
  ></span>

  <span>SP</span>

</small>
              
             <strong id="lagoProfileSP">
  0
</strong>

            </div>

            <div class="lago-profile-stat">

           <small class="lago-profile-stat-label">

  <span
    class="lago-icon-slot"
    data-lago-icon="dum"
  ></span>

  <span>
    DUM ENERGY
  </span>

</small>
              <strong id="lagoProfileDUM">
  0
</strong>

            </div>

          </div>

        </section>


        <section class="lago-profile-section">

         <strong class="lago-profile-section-title">

  <span
    class="lago-icon-slot"
    data-lago-icon="daily"
  ></span>

  <span>
    DAILY REWARD
  </span>

</strong>

         <button
  class="lago-profile-action primary"
  id="lagoProfileDaily"
>
  <span
    class="lago-icon-slot"
    data-lago-icon="daily"
  ></span>

  <span>
    CLAIM DAILY REWARD
  </span>
</button>

        </section>


        <section class="lago-profile-section">

         <strong class="lago-profile-section-title">

  <span
    class="lago-icon-slot"
    data-lago-icon="wallet"
  ></span>

  <span>
    ACCOUNT & WALLET
  </span>

</strong>

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
  <span
    class="lago-icon-slot"
    data-lago-icon="wallet"
  ></span>

  <span
  id="lagoConnectWalletText"
>
  CONNECT WALLET
</span>
</button>

         <button
  class="lago-profile-action"
  id="lagoTelegramSignIn"
>
  <span
    class="lago-icon-slot"
    data-lago-icon="profile"
  ></span>

  <span
    id="lagoTelegramSignInText"
  >
    SIGN IN WITH TELEGRAM
  </span>
</button>

        <div class="lago-profile-muted">
  Telegram is the Lago account login.
  Phantom is used only for Solana / $LAGO.
  Secure Telegram initData verification
  will be added with the Lago backend.
</div>
        </section>


        <section class="lago-profile-section">

          <strong class="lago-profile-section-title">

  <span
    class="lago-icon-slot"
    data-lago-icon="settings"
  ></span>

  <span>
    SETTINGS
  </span>

</strong>

          <button
  class="lago-profile-action"
  id="lagoProfileLanguage"
>
  <span
    class="lago-icon-slot"
    data-lago-icon="language"
  ></span>

  <span>
    CHANGE LANGUAGE
  </span>
</button>
        </section>

      </div>

    `;


    document.body.appendChild(
      overlay
    );
window.LAGO_UI
  ?.hydrate
  ?.(overlay);

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
    toggleWallet
  );


   overlay
  .querySelector(
    "#lagoTelegramSignIn"
  )
  ?.addEventListener(
    "click",
    signInTelegram
  );


document.addEventListener(
  "lago:wallet-state",
  render
);

    document.addEventListener(
  "lago:auth-state",
  render
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


 async function toggleWallet() {

  const walletApi =
    window.LAGO_WALLET;


  /*
   * Canonical wallet adapter.
   */
  if (
    walletApi &&
    typeof walletApi.getState ===
      "function" &&
    typeof walletApi.connect ===
      "function" &&
    typeof walletApi.disconnect ===
      "function"
  ) {

    const current =
      walletApi.getState();


    const result =
      current.connected

        ? await walletApi.disconnect()

        : await walletApi.connect();


    if (
      result?.reason ===
      "phantom_not_installed"
    ) {

      alert(
        "Phantom wallet not found."
      );

    }


    const next =
      walletApi.getState();

    if (
  next.connected &&
  next.publicKey &&
  window.LAGO_AUTH
    ?.bindConnectedWallet
) {

  const binding =
    await window.LAGO_AUTH
      .bindConnectedWallet();


  if (
    binding?.reason ===
    "wallet_mismatch"
  ) {

    alert(
      "Another Phantom wallet is already linked to this Lago account."
    );

  }

}

    profile.wallet =
      next.connected

        ? next.publicKey

        : "";


    /*
     * Wallet is no longer
     * Lago authentication.
     */
    profile.walletSigned =
      false;


    save();

    render();


    return (
      result?.ok ===
      true
    );

  }


  /*
   * Temporary fallback for builds
   * without LAGO_WALLET.
   */
  const wallet =
    provider();


  if (!wallet) {

    alert(
      "Phantom wallet not found."
    );

    return false;

  }


  try {

    /*
     * CONNECTED → DISCONNECT
     */
    if (
      wallet.isConnected ||
      profile.wallet
    ) {

      if (
        typeof wallet.disconnect ===
        "function"
      ) {

        await wallet.disconnect();

      }


      profile.wallet =
        "";


      profile.walletSigned =
        false;


      save();

      render();


      return true;

    }


    /*
     * DISCONNECTED → CONNECT
     */
    const result =
      await wallet.connect();


    profile.wallet =
      result.publicKey
        .toString();


    profile.walletSigned =
      false;


    save();

    render();


    return true;

  } catch {

    return false;

  }

}


/*
 * =========================================================
 * TELEGRAM LOGIN
 * =========================================================
 */

function getTelegramUser() {

  const tg =
    window.Telegram
      ?.WebApp;


  const user =
    tg
      ?.initDataUnsafe
      ?.user;


  const initData =
    String(
      tg?.initData ||
      ""
    ).trim();


  /*
   * No Telegram Mini App identity:
   * fail closed.
   */
  if (
    !tg ||
    !user ||
    !initData
  ) {

    return null;

  }


  return user;

}


async function signInTelegram() {

  const auth =
    window.LAGO_AUTH;


  if (
    !auth ||
    typeof auth
      .signInWithTelegram !==
      "function"
  ) {

    alert(
      "Lago authentication is not ready."
    );

    return false;

  }


  const result =
    await auth
      .signInWithTelegram();


  if (
    result?.reason ===
    "telegram_context_missing"
  ) {

    alert(
      "Open Lago inside Telegram to sign in."
    );

    return false;

  }


  if (!result?.ok) {

    alert(
      "Telegram sign in failed."
    );

    return false;

  }


  /*
   * Keep old Profile fields
   * only as temporary UI compatibility.
   */
  const authState =
    auth.getState();


  profile.telegramId =
    authState.telegramId;


  profile.telegramUsername =
    authState.telegramUsername;


  profile.telegramName =
    authState.telegramDisplayName;


  profile.telegramLinked =
    authState.telegramLinked;


  save();

  render();


  return true;

}


  function render() {

    create();


    const account =
  window.LAGO_ACCOUNT
    ?.getState
    ?.() || {

      level:
        1,

      economy: {

        sp:
          0,

        level:
          1

      },

      energy: {

        dum:
          0,

        max:
          100

      }

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

        : (
    window.LAGO_UI
      ?.icon
      ?.(
        "snail",
        {
          className:
            "lago-profile-avatar-fallback"
        }
      ) ||
    "LAGO"
  );


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
  Math.max(
    1,
    Math.floor(
      Number(
        account.economy
          ?.level ??
        account.level
      ) || 1
    )
  );

   overlay
  .querySelector(
    "#lagoProfileSP"
  )
  .textContent =
  Math.max(
    0,
    Math.floor(
      Number(
        account.economy
          ?.sp ??
        account.xp
      ) || 0
    )
  );

    overlay
  .querySelector(
    "#lagoProfileDUM"
  )
  .textContent =
  Math.max(
    0,
    Math.floor(
      Number(
        account.energy
          ?.dum
      ) || 0
    )
  );

    const walletState =
  window.LAGO_WALLET
    ?.getState
    ?.();


const walletConnected =
  walletState

    ? (
        walletState.connected ===
          true &&
        Boolean(
          walletState.publicKey
        )
      )

    : Boolean(
        profile.wallet
      );


const walletAddress =
  walletState

    ? (
        walletConnected

          ? walletState.publicKey

          : ""
      )

    : profile.wallet;


overlay
  .querySelector(
    "#lagoWalletStatus"
  )
  .textContent =
  shortWallet(
    walletAddress
  );


const walletButton =
  overlay.querySelector(
    "#lagoConnectWallet"
  );


const walletButtonText =
  overlay.querySelector(
    "#lagoConnectWalletText"
  );


if (walletButton) {

  walletButton.dataset.connected =
    walletConnected
      ? "true"
      : "false";

}


if (walletButtonText) {

  walletButtonText.textContent =
    walletConnected

      ? "DISCONNECT WALLET"

      : "CONNECT WALLET";

}


const telegramButton =
  overlay.querySelector(
    "#lagoTelegramSignIn"
  );


const telegramButtonText =
  overlay.querySelector(
    "#lagoTelegramSignInText"
  );


const authState =
  window.LAGO_AUTH
    ?.getState
    ?.();


const telegramLinked =
  authState

    ? authState.telegramLinked ===
        true

    : profile.telegramLinked ===
        true;


if (
  telegramButtonText
) {

  telegramButtonText.textContent =
    telegramLinked

      ? "TELEGRAM CONNECTED"

      : "SIGN IN WITH TELEGRAM";

}


if (
  telegramButton
) {

  telegramButton.dataset.connected =
    telegramLinked

      ? "true"

      : "false";

}


if (telegramButtonText) {

  telegramButtonText.textContent =
    profile.telegramLinked

      ? "TELEGRAM CONNECTED"

      : "SIGN IN WITH TELEGRAM";

}


if (telegramButton) {

  telegramButton.dataset.connected =
    profile.telegramLinked
      ? "true"
      : "false";

}

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

  /*
   * Header avatar.
   */

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


  /*
   * Header profile name.
   */

  const headerName =
    document.getElementById(
      "lagoHeaderName"
    );


  if (headerName) {

    headerName.textContent =
      profile.name;

  }


  /*
   * Character name above the snail.
   *
   * The profile name IS the snail's name.
   */

  const characterName =
    document.getElementById(
      "lagoCharacterName"
    );


  if (characterName) {

    characterName.textContent =
      profile.name;

  }


  /*
   * Main Tap button also uses
   * the selected character name.
   */

  const tapLabel =
    document.getElementById(
      "lagoTapButtonLabel"
    );


  if (tapLabel) {

    const tapWord =
      window.LAGO_LANGUAGE
        ?.translate
        ?.("TAP") ||
      "TAP";


    tapLabel.textContent =
      `${tapWord} ${profile.name}`;

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

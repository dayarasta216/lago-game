import {
  createHash,
  randomBytes
} from "node:crypto";


import {
  chmod,
  mkdir,
  readFile,
  rename,
  unlink,
  writeFile
} from "node:fs/promises";


import {
  dirname
} from "node:path";


import {
  fileURLToPath
} from "node:url";


const STORE_VERSION =
  1;


const DEFAULT_SESSION_TTL_SECONDS =
  60 * 60 * 24 * 30;


const MAX_SESSION_TTL_SECONDS =
  60 * 60 * 24 * 90;


const DEFAULT_STORE_FILE =
  fileURLToPath(
    new URL(
      "./data/lago-auth.json",
      import.meta.url
    )
  );


function emptyState() {

  return {

    version:
      STORE_VERSION,

    accounts:
      {},

    telegramIndex:
      {},

    walletIndex:
      {},

    sessions:
      {}

  };

}


function clone(
  value
) {

  return JSON.parse(
    JSON.stringify(
      value
    )
  );

}


function clean(
  value
) {

  return String(
    value ?? ""
  ).trim();

}


function isTelegramId(
  value
) {

  return /^\d+$/.test(
    clean(
      value
    )
  );

}


function isSolanaPublicKey(
  value
) {

  const text =
    clean(
      value
    );


  return (

    text.length >= 32 &&

    text.length <= 44 &&

    /^[1-9A-HJ-NP-Za-km-z]+$/
      .test(text)

  );

}


function newAccountId() {

  return (
    "lago_" +
    randomBytes(16)
      .toString(
        "base64url"
      )
  );

}


function newSessionToken() {

  return randomBytes(32)
    .toString(
      "base64url"
    );

}


function hashSessionToken(
  token
) {

  return createHash(
    "sha256"
  )
    .update(
      clean(
        token
      )
    )
    .digest(
      "hex"
    );

}


function isoFromMs(
  value
) {

  return new Date(
    value
  ).toISOString();

}


function publicAccount(
  account
) {

  if (!account) {

    return null;

  }


  return {

    accountId:
      account.accountId,

    telegram: {

      id:
        account.telegram.id,

      username:
        account.telegram.username,

      displayName:
        account.telegram.displayName

    },

    walletPublicKey:
      account.walletPublicKey ||
      "",

    createdAt:
      account.createdAt,

    updatedAt:
      account.updatedAt

  };

}


function sanitizeState(
  input
) {

  const next =
    emptyState();


  if (
    !input ||
    typeof input !==
      "object"
  ) {

    return next;

  }


  const accounts =
    input.accounts &&
    typeof input.accounts ===
      "object"

      ? input.accounts
      : {};


  for (
    const rawAccount
    of Object.values(
      accounts
    )
  ) {

    if (
      !rawAccount ||
      typeof rawAccount !==
        "object"
    ) {

      continue;

    }


    const accountId =
      clean(
        rawAccount.accountId
      );


    const telegramId =
      clean(
        rawAccount.telegram
          ?.id
      );


    if (
      !accountId ||
      !isTelegramId(
        telegramId
      )
    ) {

      continue;

    }


    const account = {

      accountId,

      telegram: {

        id:
          telegramId,

        username:
          clean(
            rawAccount.telegram
              ?.username
          ),

        displayName:
          clean(
            rawAccount.telegram
              ?.displayName
          ),

        verifiedAt:
          clean(
            rawAccount.telegram
              ?.verifiedAt
          )

      },

      walletPublicKey:
        isSolanaPublicKey(
          rawAccount.walletPublicKey
        )

          ? clean(
              rawAccount.walletPublicKey
            )

          : "",

      createdAt:
        clean(
          rawAccount.createdAt
        ),

      updatedAt:
        clean(
          rawAccount.updatedAt
        )

    };


    next.accounts[
      accountId
    ] =
      account;


    next.telegramIndex[
      telegramId
    ] =
      accountId;


    if (
      account.walletPublicKey
    ) {

      next.walletIndex[
        account.walletPublicKey
      ] =
        accountId;

    }

  }


  const sessions =
    input.sessions &&
    typeof input.sessions ===
      "object"

      ? input.sessions
      : {};


  for (
    const [
      sessionHash,
      rawSession
    ] of Object.entries(
      sessions
    )
  ) {

    if (
      !/^[a-f0-9]{64}$/
        .test(
          sessionHash
        ) ||
      !rawSession ||
      typeof rawSession !==
        "object"
    ) {

      continue;

    }


    const accountId =
      clean(
        rawSession.accountId
      );


    const expiresAt =
      clean(
        rawSession.expiresAt
      );


    if (
      !next.accounts[
        accountId
      ] ||
      !Number.isFinite(
        Date.parse(
          expiresAt
        )
      )
    ) {

      continue;

    }


    next.sessions[
      sessionHash
    ] = {

      accountId,

      createdAt:
        clean(
          rawSession.createdAt
        ),

      expiresAt,

      lastSeenAt:
        clean(
          rawSession.lastSeenAt
        )

    };

  }


  return next;

}


/*
 * =========================================================
 * STORE
 * =========================================================
 */

export function createLagoAccountSessionStore(
  {
    filePath =
      DEFAULT_STORE_FILE,

    now =
      () => Date.now()

  } = {}
) {

  let state =
    emptyState();


  let loaded =
    false;


  /*
   * Serialize mutations so two requests
   * do not overwrite each other inside
   * one Node process.
   */
  let mutationQueue =
    Promise.resolve();


  async function load() {

    if (
      loaded
    ) {

      return;

    }


    try {

      const raw =
        await readFile(
          filePath,
          "utf8"
        );


      state =
        sanitizeState(
          JSON.parse(
            raw
          )
        );

    } catch (
      error
    ) {

      if (
        error?.code !==
        "ENOENT"
      ) {

        throw error;

      }


      state =
        emptyState();

    }


    loaded =
      true;

  }


  async function persist() {

    const directory =
      dirname(
        filePath
      );


    await mkdir(
      directory,
      {
        recursive:
          true
      }
    );


    const temporary =
      `${filePath}.${process.pid}.${randomBytes(6)
        .toString("hex")}.tmp`;


    await writeFile(

      temporary,

      JSON.stringify(
        state,
        null,
        2
      ),

      {
        encoding:
          "utf8",

        mode:
          0o600
      }

    );


    await rename(
      temporary,
      filePath
    );


    /*
     * Best effort on platforms
     * supporting POSIX permissions.
     */
    try {

      await chmod(
        filePath,
        0o600
      );

    } catch {
      // Ignore permission incompatibility.
    }

  }


  function mutate(
    operation
  ) {

    const run =
      mutationQueue.then(
        async () => {

          await load();


          const result =
            await operation();


          await persist();


          return result;

        }
      );


    mutationQueue =
      run.catch(
        () => {}
      );


    return run;

  }


  async function readState() {

    await mutationQueue;

    await load();


    return state;

  }


  /*
   * =========================================================
   * VERIFIED TELEGRAM → LAGO ACCOUNT
   * =========================================================
   */

  async function upsertVerifiedTelegramUser(
    {
      id,
      username = "",
      displayName = ""
    } = {}
  ) {

    const telegramId =
      clean(
        id
      );


    if (
      !isTelegramId(
        telegramId
      )
    ) {

      return {

        ok:
          false,

        reason:
          "invalid_telegram_id"

      };

    }


    return mutate(
      async () => {

        const currentMs =
          now();


        const timestamp =
          isoFromMs(
            currentMs
          );


        const existingAccountId =
          state.telegramIndex[
            telegramId
          ];


        if (
          existingAccountId &&
          state.accounts[
            existingAccountId
          ]
        ) {

          const account =
            state.accounts[
              existingAccountId
            ];


          account.telegram.username =
            clean(
              username
            );


          account.telegram.displayName =
            clean(
              displayName
            );


          account.telegram.verifiedAt =
            timestamp;


          account.updatedAt =
            timestamp;


          return {

            ok:
              true,

            created:
              false,

            account:
              publicAccount(
                account
              )

          };

        }


        const accountId =
          newAccountId();


        const account = {

          accountId,

          telegram: {

            id:
              telegramId,

            username:
              clean(
                username
              ),

            displayName:
              clean(
                displayName
              ),

            verifiedAt:
              timestamp

          },

          walletPublicKey:
            "",

          createdAt:
            timestamp,

          updatedAt:
            timestamp

        };


        state.accounts[
          accountId
        ] =
          account;


        state.telegramIndex[
          telegramId
        ] =
          accountId;


        return {

          ok:
            true,

          created:
            true,

          account:
            publicAccount(
              account
            )

        };

      }
    );

  }


  /*
   * =========================================================
   * SESSION
   * =========================================================
   */

  async function createSession(
    accountId,
    {
      ttlSeconds =
        DEFAULT_SESSION_TTL_SECONDS
    } = {}
  ) {

    const id =
      clean(
        accountId
      );


    const ttl =
      Math.floor(
        Number(
          ttlSeconds
        )
      );


    if (
      !Number.isInteger(
        ttl
      ) ||
      ttl <= 0 ||
      ttl >
        MAX_SESSION_TTL_SECONDS
    ) {

      return {

        ok:
          false,

        reason:
          "invalid_session_ttl"

      };

    }


    return mutate(
      async () => {

        const account =
          state.accounts[
            id
          ];


        if (!account) {

          return {

            ok:
              false,

            reason:
              "account_not_found"

          };

        }


        const token =
          newSessionToken();


        const tokenHash =
          hashSessionToken(
            token
          );


        const currentMs =
          now();


        const expiresMs =
          currentMs +
          ttl * 1000;


        state.sessions[
          tokenHash
        ] = {

          accountId:
            id,

          createdAt:
            isoFromMs(
              currentMs
            ),

          expiresAt:
            isoFromMs(
              expiresMs
            ),

          lastSeenAt:
            isoFromMs(
              currentMs
            )

        };


        return {

          ok:
            true,

          /*
           * Raw token is returned ONCE.
           * It is never persisted.
           */
          token,

          expiresAt:
            isoFromMs(
              expiresMs
            ),

          account:
            publicAccount(
              account
            )

        };

      }
    );

  }


  async function restoreSession(
    sessionToken
  ) {

    const token =
      clean(
        sessionToken
      );


    if (!token) {

      return {

        ok:
          false,

        reason:
          "session_missing"

      };

    }


    return mutate(
      async () => {

        const hash =
          hashSessionToken(
            token
          );


        const session =
          state.sessions[
            hash
          ];


        if (!session) {

          return {

            ok:
              false,

            reason:
              "invalid_session"

          };

        }


        const currentMs =
          now();


        const expiresMs =
          Date.parse(
            session.expiresAt
          );


        if (
          !Number.isFinite(
            expiresMs
          ) ||
          expiresMs <=
            currentMs
        ) {

          delete state.sessions[
            hash
          ];


          return {

            ok:
              false,

            reason:
              "session_expired"

          };

        }


        const account =
          state.accounts[
            session.accountId
          ];


        if (!account) {

          delete state.sessions[
            hash
          ];


          return {

            ok:
              false,

            reason:
              "account_not_found"

          };

        }


        session.lastSeenAt =
          isoFromMs(
            currentMs
          );


        return {

          ok:
            true,

          account:
            publicAccount(
              account
            ),

          expiresAt:
            session.expiresAt

        };

      }
    );

  }


  async function revokeSession(
    sessionToken
  ) {

    const token =
      clean(
        sessionToken
      );


    if (!token) {

      return {

        ok:
          true,

        revoked:
          false

      };

    }


    return mutate(
      async () => {

        const hash =
          hashSessionToken(
            token
          );


        const existed =
          Boolean(
            state.sessions[
              hash
            ]
          );


        delete state.sessions[
          hash
        ];


        return {

          ok:
            true,

          revoked:
            existed

        };

      }
    );

  }


  /*
   * =========================================================
   * PHANTOM WALLET BINDING
   * =========================================================
   */

  async function bindWallet(
    accountId,
    publicKey
  ) {

    const id =
      clean(
        accountId
      );


    const wallet =
      clean(
        publicKey
      );


    if (
      !isSolanaPublicKey(
        wallet
      )
    ) {

      return {

        ok:
          false,

        reason:
          "invalid_wallet"

      };

    }


    return mutate(
      async () => {

        const account =
          state.accounts[
            id
          ];


        if (!account) {

          return {

            ok:
              false,

            reason:
              "account_not_found"

          };

        }


        const walletOwner =
          state.walletIndex[
            wallet
          ];


        /*
         * Same Phantom wallet cannot
         * silently belong to two
         * different Lago accounts.
         */
        if (
          walletOwner &&
          walletOwner !==
            id
        ) {

          return {

            ok:
              false,

            reason:
              "wallet_in_use"

          };

        }


        /*
         * Do not silently replace
         * an already linked wallet.
         */
        if (
          account.walletPublicKey &&
          account.walletPublicKey !==
            wallet
        ) {

          return {

            ok:
              false,

            reason:
              "wallet_mismatch",

            expectedWallet:
              account.walletPublicKey,

            connectedWallet:
              wallet

          };

        }


        account.walletPublicKey =
          wallet;


        account.updatedAt =
          isoFromMs(
            now()
          );


        state.walletIndex[
          wallet
        ] =
          id;


        return {

          ok:
            true,

          account:
            publicAccount(
              account
            )

        };

      }
    );

  }


  async function getAccount(
    accountId
  ) {

    const current =
      await readState();


    return publicAccount(
      current.accounts[
        clean(
          accountId
        )
      ]
    );

  }


  async function cleanupExpiredSessions() {

    return mutate(
      async () => {

        const currentMs =
          now();


        let removed =
          0;


        for (
          const [
            hash,
            session
          ] of Object.entries(
            state.sessions
          )
        ) {

          const expires =
            Date.parse(
              session.expiresAt
            );


          if (
            !Number.isFinite(
              expires
            ) ||
            expires <=
              currentMs
          ) {

            delete state.sessions[
              hash
            ];


            removed +=
              1;

          }

        }


        return {

          ok:
            true,

          removed

        };

      }
    );

  }


  /*
   * Test / maintenance only.
   */
  async function destroyStoreFile() {

    await mutationQueue;


    try {

      await unlink(
        filePath
      );

    } catch (
      error
    ) {

      if (
        error?.code !==
        "ENOENT"
      ) {

        throw error;

      }

    }


    state =
      emptyState();


    loaded =
      false;

  }


  return Object.freeze({

    version:
      STORE_VERSION,

    upsertVerifiedTelegramUser,

    createSession,

    restoreSession,

    revokeSession,

    bindWallet,

    getAccount,

    cleanupExpiredSessions,

    destroyStoreFile

  });

}

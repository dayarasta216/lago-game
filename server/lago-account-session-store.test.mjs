import test
  from "node:test";


import assert
  from "node:assert/strict";


import {
  mkdtemp,
  readFile,
  rm
} from "node:fs/promises";


import {
  tmpdir
} from "node:os";


import {
  join
} from "node:path";


import {
  createLagoAccountSessionStore
} from "./lago-account-session-store.mjs";


async function fixture() {

  const directory =
    await mkdtemp(
      join(
        tmpdir(),
        "lago-auth-"
      )
    );


  const filePath =
    join(
      directory,
      "auth.json"
    );


  let now =
    2_000_000_000_000;


  const store =
    createLagoAccountSessionStore({

      filePath,

      now:
        () => now

    });


  return {

    directory,

    filePath,

    store,

    advance(
      milliseconds
    ) {

      now +=
        milliseconds;

    },

    async cleanup() {

      await rm(
        directory,
        {
          recursive:
            true,

          force:
            true
        }
      );

    }

  };

}


test(
  "creates one persistent Lago account per Telegram id",
  async () => {

    const fx =
      await fixture();


    try {

      const first =
        await fx.store
          .upsertVerifiedTelegramUser({

            id:
              "123456789",

            username:
              "lago",

            displayName:
              "Lago"

          });


      assert.equal(
        first.ok,
        true
      );


      assert.equal(
        first.created,
        true
      );


      const secondStore =
        createLagoAccountSessionStore({

          filePath:
            fx.filePath

        });


      const second =
        await secondStore
          .upsertVerifiedTelegramUser({

            id:
              "123456789",

            username:
              "lago_new",

            displayName:
              "Lago Snail"

          });


      assert.equal(
        second.ok,
        true
      );


      assert.equal(
        second.created,
        false
      );


      assert.equal(
        second.account.accountId,
        first.account.accountId
      );


      assert.equal(
        second.account.telegram.username,
        "lago_new"
      );

    } finally {

      await fx.cleanup();

    }

  }
);


test(
  "creates and restores a valid server session",
  async () => {

    const fx =
      await fixture();


    try {

      const created =
        await fx.store
          .upsertVerifiedTelegramUser({

            id:
              "111"

          });


      const session =
        await fx.store
          .createSession(
            created.account.accountId,
            {
              ttlSeconds:
                60
            }
          );


      assert.equal(
        session.ok,
        true
      );


      assert.ok(
        session.token
      );


      const restored =
        await fx.store
          .restoreSession(
            session.token
          );


      assert.equal(
        restored.ok,
        true
      );


      assert.equal(
        restored.account.accountId,
        created.account.accountId
      );

    } finally {

      await fx.cleanup();

    }

  }
);


test(
  "never persists the raw session token",
  async () => {

    const fx =
      await fixture();


    try {

      const account =
        await fx.store
          .upsertVerifiedTelegramUser({

            id:
              "222"

          });


      const session =
        await fx.store
          .createSession(
            account.account.accountId
          );


      const disk =
        await readFile(
          fx.filePath,
          "utf8"
        );


      assert.equal(
        disk.includes(
          session.token
        ),
        false
      );

    } finally {

      await fx.cleanup();

    }

  }
);


test(
  "rejects an expired session",
  async () => {

    const fx =
      await fixture();


    try {

      const account =
        await fx.store
          .upsertVerifiedTelegramUser({

            id:
              "333"

          });


      const session =
        await fx.store
          .createSession(
            account.account.accountId,
            {
              ttlSeconds:
                10
            }
          );


      fx.advance(
        11_000
      );


      const restored =
        await fx.store
          .restoreSession(
            session.token
          );


      assert.equal(
        restored.ok,
        false
      );


      assert.equal(
        restored.reason,
        "session_expired"
      );

    } finally {

      await fx.cleanup();

    }

  }
);


test(
  "binds a Phantom wallet to a Lago account",
  async () => {

    const fx =
      await fixture();


    try {

      const account =
        await fx.store
          .upsertVerifiedTelegramUser({

            id:
              "444"

          });


      const wallet =
        "11111111111111111111111111111111";


      const result =
        await fx.store
          .bindWallet(
            account.account.accountId,
            wallet
          );


      assert.equal(
        result.ok,
        true
      );


      assert.equal(
        result.account.walletPublicKey,
        wallet
      );

    } finally {

      await fx.cleanup();

    }

  }
);


test(
  "does not allow one wallet on two Lago accounts",
  async () => {

    const fx =
      await fixture();


    try {

      const a =
        await fx.store
          .upsertVerifiedTelegramUser({

            id:
              "555"

          });


      const b =
        await fx.store
          .upsertVerifiedTelegramUser({

            id:
              "666"

          });


      const wallet =
        "11111111111111111111111111111111";


      const first =
        await fx.store
          .bindWallet(
            a.account.accountId,
            wallet
          );


      assert.equal(
        first.ok,
        true
      );


      const second =
        await fx.store
          .bindWallet(
            b.account.accountId,
            wallet
          );


      assert.equal(
        second.ok,
        false
      );


      assert.equal(
        second.reason,
        "wallet_in_use"
      );

    } finally {

      await fx.cleanup();

    }

  }
);


test(
  "revoked session cannot be restored",
  async () => {

    const fx =
      await fixture();


    try {

      const account =
        await fx.store
          .upsertVerifiedTelegramUser({

            id:
              "777"

          });


      const session =
        await fx.store
          .createSession(
            account.account.accountId
          );


      const revoked =
        await fx.store
          .revokeSession(
            session.token
          );


      assert.equal(
        revoked.ok,
        true
      );


      assert.equal(
        revoked.revoked,
        true
      );


      const restored =
        await fx.store
          .restoreSession(
            session.token
          );


      assert.equal(
        restored.ok,
        false
      );


      assert.equal(
        restored.reason,
        "invalid_session"
      );

    } finally {

      await fx.cleanup();

    }

  }
);

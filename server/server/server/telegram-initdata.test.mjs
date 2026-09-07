import test
  from "node:test";


import assert
  from "node:assert/strict";


import {
  createHmac
} from "node:crypto";


import {
  verifyTelegramInitData
} from "./telegram-initdata.mjs";


const BOT_TOKEN =
  "123456789:TEST_ONLY_FAKE_TOKEN";


function createSignedInitData(
  {
    user,
    authDate,
    extra = {}
  }
) {

  const values = {

    auth_date:
      String(
        authDate
      ),

    query_id:
      "TEST_QUERY",

    user:
      JSON.stringify(
        user
      ),

    ...extra

  };


  const dataCheckString =
    Object
      .entries(
        values
      )
      .sort(
        (
          [a],
          [b]
        ) =>
          a.localeCompare(
            b
          )
      )
      .map(
        (
          [
            key,
            value
          ]
        ) =>
          `${key}=${value}`
      )
      .join("\n");


  const secret =
    createHmac(
      "sha256",
      "WebAppData"
    )
      .update(
        BOT_TOKEN
      )
      .digest();


  const hash =
    createHmac(
      "sha256",
      secret
    )
      .update(
        dataCheckString
      )
      .digest(
        "hex"
      );


  const params =
    new URLSearchParams();


  for (
    const [
      key,
      value
    ] of Object.entries(
      values
    )
  ) {

    params.set(
      key,
      value
    );

  }


  params.set(
    "hash",
    hash
  );


  return params
    .toString();

}


test(
  "accepts valid Telegram initData",
  () => {

    const now =
      2_000_000_000;


    const initData =
      createSignedInitData({

        authDate:
          now - 10,

        user: {

          id:
            123456789,

          first_name:
            "Lago",

          username:
            "lagotest"

        }

      });


    const result =
      verifyTelegramInitData(
        initData,
        {

          botToken:
            BOT_TOKEN,

          nowSeconds:
            now

        }
      );


    assert.equal(
      result.ok,
      true
    );


    assert.equal(
      result.user.id,
      "123456789"
    );


    assert.equal(
      result.user.username,
      "lagotest"
    );

  }
);


test(
  "rejects tampered initData",
  () => {

    const now =
      2_000_000_000;


    const initData =
      createSignedInitData({

        authDate:
          now - 10,

        user: {

          id:
            123456789,

          first_name:
            "Lago"

        }

      })
        .replace(
          "Lago",
          "Hacker"
        );


    const result =
      verifyTelegramInitData(
        initData,
        {

          botToken:
            BOT_TOKEN,

          nowSeconds:
            now

        }
      );


    assert.equal(
      result.ok,
      false
    );


    assert.equal(
      result.reason,
      "invalid_hash"
    );

  }
);


test(
  "rejects expired initData",
  () => {

    const now =
      2_000_000_000;


    const initData =
      createSignedInitData({

        authDate:
          now - 1000,

        user: {

          id:
            123456789,

          first_name:
            "Lago"

        }

      });


    const result =
      verifyTelegramInitData(
        initData,
        {

          botToken:
            BOT_TOKEN,

          nowSeconds:
            now,

          maxAgeSeconds:
            300

        }
      );


    assert.equal(
      result.ok,
      false
    );


    assert.equal(
      result.reason,
      "init_data_expired"
    );

  }
);


test(
  "rejects wrong bot token",
  () => {

    const now =
      2_000_000_000;


    const initData =
      createSignedInitData({

        authDate:
          now,

        user: {

          id:
            123456789,

          first_name:
            "Lago"

        }

      });


    const result =
      verifyTelegramInitData(
        initData,
        {

          botToken:
            "WRONG_TOKEN",

          nowSeconds:
            now

        }
      );


    assert.equal(
      result.ok,
      false
    );


    assert.equal(
      result.reason,
      "invalid_hash"
    );

  }
);

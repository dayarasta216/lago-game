import {
  createHash,
  createHmac,
  timingSafeEqual
} from "node:crypto";


/*
 * =========================================================
 * LAGO — TELEGRAM MINI APP INITDATA VERIFIER
 * R0.5E5A
 * =========================================================
 *
 * SERVER SIDE ONLY.
 *
 * Telegram bot token must NEVER
 * be exposed to browser code.
 */


const DEFAULT_MAX_AGE_SECONDS =
  300;


const DEFAULT_FUTURE_SKEW_SECONDS =
  30;


const MAX_INIT_DATA_LENGTH =
  16_384;


/*
 * Prevent ambiguous duplicate
 * query-string fields.
 */
function parseUniqueParams(
  initData
) {

  const params =
    new URLSearchParams(
      initData
    );


  const seen =
    new Set();


  for (
    const [
      key
    ] of params
  ) {

    if (
      seen.has(
        key
      )
    ) {

      return {

        ok:
          false,

        reason:
          "duplicate_field",

        field:
          key

      };

    }


    seen.add(
      key
    );

  }


  return {

    ok:
      true,

    params

  };

}


/*
 * Telegram data-check-string:
 *
 * all received fields except hash,
 * sorted alphabetically,
 * joined with LF.
 */
function buildDataCheckString(
  params
) {

  const entries =
    [];


  for (
    const [
      key,
      value
    ] of params
  ) {

    if (
      key ===
      "hash"
    ) {

      continue;

    }


    entries.push([
      key,
      value
    ]);

  }


  entries.sort(
    (
      [a],
      [b]
    ) =>
      a.localeCompare(
        b
      )
  );


  return entries
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

}


/*
 * Telegram secret:
 *
 * HMAC_SHA256(
 *   key = "WebAppData",
 *   message = bot token
 * )
 */
function createTelegramSecret(
  botToken
) {

  return createHmac(
    "sha256",
    "WebAppData"
  )
    .update(
      botToken
    )
    .digest();

}


function verifyHash(
  {
    params,
    botToken
  }
) {

  const receivedHash =
    String(
      params.get(
        "hash"
      ) || ""
    )
      .trim()
      .toLowerCase();


  if (
    !/^[a-f0-9]{64}$/
      .test(
        receivedHash
      )
  ) {

    return false;

  }


  const dataCheckString =
    buildDataCheckString(
      params
    );


  const secretKey =
    createTelegramSecret(
      botToken
    );


  const calculatedHash =
    createHmac(
      "sha256",
      secretKey
    )
      .update(
        dataCheckString
      )
      .digest();


  const receivedBuffer =
    Buffer.from(
      receivedHash,
      "hex"
    );


  if (
    receivedBuffer.length !==
    calculatedHash.length
  ) {

    return false;

  }


  return timingSafeEqual(
    calculatedHash,
    receivedBuffer
  );

}


function parseTelegramUser(
  raw
) {

  if (!raw) {

    return null;

  }


  let user;


  try {

    user =
      JSON.parse(
        raw
      );

  } catch {

    return null;

  }


  if (
    !user ||
    typeof user !==
      "object"
  ) {

    return null;

  }


  const id =
    String(
      user.id ?? ""
    ).trim();


  if (
    !/^\d+$/
      .test(id)
  ) {

    return null;

  }


  return {

    id,

    username:
      String(
        user.username ??
        ""
      ).trim(),

    firstName:
      String(
        user.first_name ??
        ""
      ).trim(),

    lastName:
      String(
        user.last_name ??
        ""
      ).trim(),

    displayName:
      [
        user.first_name,
        user.last_name
      ]
        .filter(Boolean)
        .join(" ")
        .trim(),

    languageCode:
      String(
        user.language_code ??
        ""
      ).trim(),

    isPremium:
      user.is_premium ===
        true

  };

}


/*
 * =========================================================
 * PUBLIC VERIFIER
 * =========================================================
 */

export function verifyTelegramInitData(
  initData,
  {
    botToken,
    maxAgeSeconds =
      DEFAULT_MAX_AGE_SECONDS,

    futureSkewSeconds =
      DEFAULT_FUTURE_SKEW_SECONDS,

    nowSeconds =
      Math.floor(
        Date.now() /
        1000
      )

  } = {}
) {

  const raw =
    String(
      initData ??
      ""
    );


  const token =
    String(
      botToken ??
      ""
    ).trim();


  if (!token) {

    return {

      ok:
        false,

      reason:
        "bot_token_missing"

    };

  }


  if (!raw) {

    return {

      ok:
        false,

      reason:
        "init_data_missing"

    };

  }


  if (
    raw.length >
    MAX_INIT_DATA_LENGTH
  ) {

    return {

      ok:
        false,

      reason:
        "init_data_too_large"

    };

  }


  const parsed =
    parseUniqueParams(
      raw
    );


  if (!parsed.ok) {

    return parsed;

  }


  const {
    params
  } =
    parsed;


  if (
    !verifyHash({
      params,
      botToken:
        token
    })
  ) {

    return {

      ok:
        false,

      reason:
        "invalid_hash"

    };

  }


  /*
   * Only trust auth_date AFTER
   * cryptographic verification.
   */
  const authDate =
    Number(
      params.get(
        "auth_date"
      )
    );


  if (
    !Number.isInteger(
      authDate
    ) ||
    authDate <= 0
  ) {

    return {

      ok:
        false,

      reason:
        "invalid_auth_date"

    };

  }


  if (
    authDate >
    nowSeconds +
      futureSkewSeconds
  ) {

    return {

      ok:
        false,

      reason:
        "auth_date_in_future"

    };

  }


  const age =
    nowSeconds -
    authDate;


  if (
    age >
    maxAgeSeconds
  ) {

    return {

      ok:
        false,

      reason:
        "init_data_expired",

      ageSeconds:
        age

    };

  }


  const user =
    parseTelegramUser(
      params.get(
        "user"
      )
    );


  if (!user) {

    return {

      ok:
        false,

      reason:
        "invalid_user"

    };

  }


  /*
   * Useful later for:
   * logging,
   * replay/rate-limit cache,
   * audit trail.
   *
   * Not an authentication secret.
   */
  const fingerprint =
    createHash(
      "sha256"
    )
      .update(
        raw
      )
      .digest(
        "hex"
      );


  return {

    ok:
      true,

    user,

    authDate,

    ageSeconds:
      Math.max(
        0,
        age
      ),

    queryId:
      String(
        params.get(
          "query_id"
        ) || ""
      ),

    startParam:
      String(
        params.get(
          "start_param"
        ) || ""
      ),

    fingerprint

  };

}

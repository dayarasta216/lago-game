import {
  createServer
} from "node:http";


import {
  createReadStream
} from "node:fs";


import {
  stat
} from "node:fs/promises";


import {
  extname,
  join,
  normalize,
  resolve,
  sep
} from "node:path";


import {
  verifyTelegramInitData
} from "./telegram-initdata.mjs";


const SESSION_COOKIE =
  "lago_session";


const DEFAULT_SESSION_TTL_SECONDS =
  60 * 60 * 24 * 30;


const MAX_JSON_BODY_BYTES =
  32 * 1024;


const CONTENT_TYPES =
  Object.freeze({

    ".html":
      "text/html; charset=utf-8",

    ".css":
      "text/css; charset=utf-8",

    ".js":
      "text/javascript; charset=utf-8",

    ".json":
      "application/json; charset=utf-8",

    ".svg":
      "image/svg+xml",

    ".png":
      "image/png",

    ".jpg":
      "image/jpeg",

    ".jpeg":
      "image/jpeg",

    ".webp":
      "image/webp",

    ".gif":
      "image/gif",

    ".ico":
      "image/x-icon",

    ".woff":
      "font/woff",

    ".woff2":
      "font/woff2",

    ".mp3":
      "audio/mpeg",

    ".wav":
      "audio/wav"

  });


function clean(
  value
) {

  return String(
    value ?? ""
  ).trim();

}


function json(
  response,
  status,
  body,
  headers = {}
) {

  const data =
    JSON.stringify(
      body
    );


  response.writeHead(
    status,
    {

      "Content-Type":
        "application/json; charset=utf-8",

      "Content-Length":
        Buffer.byteLength(
          data
        ),

      "Cache-Control":
        "no-store",

      ...headers

    }
  );


  response.end(
    data
  );

}


function parseCookies(
  request
) {

  const header =
    clean(
      request.headers.cookie
    );


  const result =
    {};


  if (!header) {

    return result;

  }


  for (
    const part
    of header.split(";")
  ) {

    const index =
      part.indexOf("=");


    if (
      index <= 0
    ) {

      continue;

    }


    const key =
      part
        .slice(
          0,
          index
        )
        .trim();


    const value =
      part
        .slice(
          index + 1
        )
        .trim();


    if (!key) {

      continue;

    }


    try {

      result[key] =
        decodeURIComponent(
          value
        );

    } catch {

      result[key] =
        value;

    }

  }


  return result;

}


function sessionCookie(
  token,
  {
    secure,
    maxAgeSeconds
  }
) {

  const parts = [

    `${SESSION_COOKIE}=${encodeURIComponent(
      token
    )}`,

    "Path=/",

    "HttpOnly",

    "SameSite=Lax",

    `Max-Age=${Math.max(
      0,
      Math.floor(
        maxAgeSeconds
      )
    )}`

  ];


  if (
    secure
  ) {

    parts.push(
      "Secure"
    );

  }


  return parts
    .join("; ");

}


function clearSessionCookie(
  secure
) {

  return sessionCookie(
    "",
    {

      secure,

      maxAgeSeconds:
        0

    }
  );

}


async function readJSON(
  request
) {

  let size =
    0;


  const chunks =
    [];


  for await (
    const chunk
    of request
  ) {

    size +=
      chunk.length;


    if (
      size >
      MAX_JSON_BODY_BYTES
    ) {

      return {

        ok:
          false,

        reason:
          "body_too_large"

      };

    }


    chunks.push(
      chunk
    );

  }


  if (
    chunks.length ===
    0
  ) {

    return {

      ok:
        true,

      value:
        {}

    };

  }


  try {

    const value =
      JSON.parse(
        Buffer
          .concat(
            chunks
          )
          .toString(
            "utf8"
          )
      );


    if (
      !value ||
      typeof value !==
        "object" ||
      Array.isArray(
        value
      )
    ) {

      return {

        ok:
          false,

        reason:
          "invalid_json"

      };

    }


    return {

      ok:
        true,

      value

    };

  } catch {

    return {

      ok:
        false,

      reason:
        "invalid_json"

    };

  }

}


function requestOriginAllowed(
  request
) {

  const origin =
    clean(
      request.headers.origin
    );


  /*
   * curl / native requests may
   * legitimately omit Origin.
   */
  if (!origin) {

    return true;

  }


  const host =
    clean(
      request.headers.host
    );


  if (!host) {

    return false;

  }


  try {

    const parsed =
      new URL(
        origin
      );


    return (
      parsed.host ===
      host
    );

  } catch {

    return false;

  }

}


function isStateChanging(
  method
) {

  return (
    method === "POST" ||
    method === "PUT" ||
    method === "PATCH" ||
    method === "DELETE"
  );

}


function getSessionToken(
  request
) {

  return (
    parseCookies(
      request
    )[
      SESSION_COOKIE
    ] || ""
  );

}


function publicError(
  reason
) {

  /*
   * Never expose stack traces or
   * internal secrets to browser.
   */
  return {

    ok:
      false,

    error:
      reason

  };

}


function safeStaticPath(
  projectRoot,
  requestPath
) {

  let pathname;


  try {

    pathname =
      decodeURIComponent(
        requestPath
      );

  } catch {

    return null;

  }


  if (
    pathname === "/"
  ) {

    pathname =
      "/index.html";

  }


  const parts =
    pathname
      .split("/")
      .filter(Boolean);


  /*
   * Server source, runtime data,
   * Git metadata and secret files
   * must NEVER be public.
   */
  if (
    parts.some(
      part =>
        part === "server" ||
        part === ".git" ||
        part.startsWith(".env") ||
        part.startsWith(".")
    )
  ) {

    return null;

  }


  const relative =
    normalize(
      pathname
        .replace(
          /^\/+/,
          ""
        )
    );


  const target =
    resolve(
      projectRoot,
      relative
    );


  const root =
    resolve(
      projectRoot
    );


  if (
    target !== root &&
    !target.startsWith(
      root + sep
    )
  ) {

    return null;

  }


  return target;

}


async function serveStatic(
  request,
  response,
  projectRoot,
  pathname
) {

  if (
    request.method !==
      "GET" &&
    request.method !==
      "HEAD"
  ) {

    return false;

  }


  const target =
    safeStaticPath(
      projectRoot,
      pathname
    );


  if (!target) {

    response.writeHead(
      404
    );

    response.end(
      "Not found"
    );


    return true;

  }


  let info;


  try {

    info =
      await stat(
        target
      );

  } catch {

    response.writeHead(
      404
    );

    response.end(
      "Not found"
    );


    return true;

  }


  if (
    !info.isFile()
  ) {

    response.writeHead(
      404
    );

    response.end(
      "Not found"
    );


    return true;

  }


  const extension =
    extname(
      target
    )
      .toLowerCase();


  const contentType =
    CONTENT_TYPES[
      extension
    ] ||
    "application/octet-stream";


  response.writeHead(
    200,
    {

      "Content-Type":
        contentType,

      "Content-Length":
        info.size,

      /*
       * Development cache policy.
       * We can optimize production later.
       */
      "Cache-Control":
        "no-cache"

    }
  );


  if (
    request.method ===
    "HEAD"
  ) {

    response.end();

    return true;

  }


  createReadStream(
    target
  )
    .pipe(
      response
    );


  return true;

}


/*
 * =========================================================
 * HTTP APP
 * =========================================================
 */

export function createLagoHttpServer(
  {
    projectRoot,

    store,

    botToken,

    cookieSecure =
      false,

    sessionTtlSeconds =
      DEFAULT_SESSION_TTL_SECONDS

  }
) {

  if (
    !projectRoot
  ) {

    throw new Error(
      "projectRoot is required"
    );

  }


  if (
    !store
  ) {

    throw new Error(
      "account/session store is required"
    );

  }


  const telegramBotToken =
    clean(
      botToken
    );


  return createServer(
    async (
      request,
      response
    ) => {

      try {

        const baseUrl =
          `http://${request.headers.host || "localhost"}`;


        const url =
          new URL(
            request.url || "/",
            baseUrl
          );


        const pathname =
          url.pathname;


        const method =
          String(
            request.method ||
            "GET"
          )
            .toUpperCase();


        /*
         * Basic same-origin protection for
         * browser state-changing requests.
         */
        if (
          isStateChanging(
            method
          ) &&
          !requestOriginAllowed(
            request
          )
        ) {

          json(
            response,
            403,
            publicError(
              "origin_not_allowed"
            )
          );


          return;

        }


        /*
         * =====================================================
         * HEALTH
         * =====================================================
         */

        if (
          method === "GET" &&
          pathname ===
            "/api/health"
        ) {

          json(
            response,
            200,
            {

              ok:
                true,

              service:
                "lago-backend",

              authConfigured:
                Boolean(
                  telegramBotToken
                )

            }
          );


          return;

        }


        /*
         * =====================================================
         * TELEGRAM LOGIN
         * =====================================================
         */

        if (
          method === "POST" &&
          pathname ===
            "/api/auth/telegram"
        ) {

          if (
            !telegramBotToken
          ) {

            json(
              response,
              503,
              publicError(
                "telegram_auth_not_configured"
              )
            );


            return;

          }


          const body =
            await readJSON(
              request
            );


          if (
            !body.ok
          ) {

            json(
              response,
              body.reason ===
                "body_too_large"
                ? 413
                : 400,
              publicError(
                body.reason
              )
            );


            return;

          }


          const initData =
            clean(
              body.value
                .initData
            );


          const verified =
            verifyTelegramInitData(
              initData,
              {

                botToken:
                  telegramBotToken

              }
            );


          if (
            !verified.ok
          ) {

            json(
              response,
              401,
              publicError(
                "telegram_verification_failed"
              )
            );


            return;

          }


          const accountResult =
            await store
              .upsertVerifiedTelegramUser({

                id:
                  verified.user.id,

                username:
                  verified.user.username,

                displayName:
                  verified.user.displayName

              });


          if (
            !accountResult.ok
          ) {

            json(
              response,
              500,
              publicError(
                "account_creation_failed"
              )
            );


            return;

          }


          const session =
            await store
              .createSession(
                accountResult
                  .account
                  .accountId,
                {

                  ttlSeconds:
                    sessionTtlSeconds

                }
              );


          if (
            !session.ok
          ) {

            json(
              response,
              500,
              publicError(
                "session_creation_failed"
              )
            );


            return;

          }


          json(
            response,
            200,
            {

              ok:
                true,

              account:
                session.account

            },
            {

              "Set-Cookie":
                sessionCookie(
                  session.token,
                  {

                    secure:
                      cookieSecure,

                    maxAgeSeconds:
                      sessionTtlSeconds

                  }
                )

            }
          );


          return;

        }


        /*
         * =====================================================
         * RESTORE SESSION
         * =====================================================
         */

        if (
          method === "GET" &&
          pathname ===
            "/api/auth/session"
        ) {

          const token =
            getSessionToken(
              request
            );


          if (!token) {

            json(
              response,
              401,
              publicError(
                "not_authenticated"
              )
            );


            return;

          }


          const restored =
            await store
              .restoreSession(
                token
              );


          if (
            !restored.ok
          ) {

            json(
              response,
              401,
              publicError(
                "not_authenticated"
              ),
              {

                "Set-Cookie":
                  clearSessionCookie(
                    cookieSecure
                  )

              }
            );


            return;

          }


          json(
            response,
            200,
            {

              ok:
                true,

              account:
                restored.account

            }
          );


          return;

        }


        /*
         * =====================================================
         * LOGOUT
         * =====================================================
         */

        if (
          method === "POST" &&
          pathname ===
            "/api/auth/logout"
        ) {

          const token =
            getSessionToken(
              request
            );


          if (token) {

            await store
              .revokeSession(
                token
              );

          }


          json(
            response,
            200,
            {

              ok:
                true

            },
            {

              "Set-Cookie":
                clearSessionCookie(
                  cookieSecure
                )

            }
          );


          return;

        }


        /*
         * =====================================================
         * WALLET BINDING
         * =====================================================
         *
         * Intentionally unavailable.
         *
         * A publicKey alone does NOT prove
         * ownership of a Phantom wallet.
         *
         * Next checkpoint:
         *
         * challenge
         * → signMessage()
         * → Ed25519 verify
         * → wallet binding
         */

        if (
          pathname ===
            "/api/account/wallet"
        ) {

          json(
            response,
            501,
            publicError(
              "wallet_proof_required"
            )
          );


          return;

        }


        /*
         * API 404
         */
        if (
          pathname.startsWith(
            "/api/"
          )
        ) {

          json(
            response,
            404,
            publicError(
              "not_found"
            )
          );


          return;

        }


        /*
         * FRONTEND
         */
        await serveStatic(
          request,
          response,
          projectRoot,
          pathname
        );

      } catch (
        error
      ) {

        console.error(
          "[LAGO HTTP ERROR]",
          error
        );


        if (
          !response.headersSent
        ) {

          json(
            response,
            500,
            publicError(
              "internal_server_error"
            )
          );

        } else {

          response.end();

        }

      }

    }
  );

}

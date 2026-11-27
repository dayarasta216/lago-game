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

import {
  validSolanaSignature
} from "./lago-solana-payment-verifier.mjs";

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

  const data = JSON.stringify(body);

  const responseHeaders = {

    ...headers,

    "Content-Type":
      "application/json; charset=utf-8",

    "Content-Length":
      Buffer.byteLength(data),

    "Cache-Control":
      "no-store",

    "X-Content-Type-Options":
      "nosniff",

    "X-Frame-Options":
      "DENY",

    "Referrer-Policy":
      "no-referrer",

    "Cross-Origin-Resource-Policy":
      "same-origin"

  };

  /*
   * Close oversized request connections
   * after returning the HTTP response.
   */

  if (status === 413) {

    responseHeaders.Connection = "close";

  }

  response.writeHead(
    status,
    responseHeaders
  );

  response.end(data);

}


function parseCookies(request) {

  const header = clean(
    request.headers.cookie
  );

  /*
   * Null prototype prevents special
   * property names from affecting
   * cookie storage.
   */

  const result = Object.create(null);

  const duplicates = new Set();

  if (!header) {
    return result;
  }

  for (const part of header.split(";")) {

    const index = part.indexOf("=");

    if (index <= 0) {
      continue;
    }

    const key = part
      .slice(0, index)
      .trim();

    const value = part
      .slice(index + 1)
      .trim();

    if (
      !key ||
      !/^[A-Za-z0-9_.-]+$/.test(key)
    ) {
      continue;
    }

    /*
     * Reject ambiguous duplicate cookies.
     * Never silently select one session.
     */

    if (
      duplicates.has(key) ||
      Object.hasOwn(result, key)
    ) {

      duplicates.add(key);

      delete result[key];

      continue;

    }

    try {

      result[key] =
        decodeURIComponent(value);

    } catch {

      /*
       * Invalid encoding is not trusted.
       */

      duplicates.add(key);

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


async function readJSON(request) {

  /*
   * R2.7F3B — Bounded JSON body reader.
   *
   * Maximum body size: 32 KiB.
   *
   * Preserve the connection long enough
   * to send HTTP 413 when possible.
   */

  const contentLength =
    request.headers["content-length"];

  if (contentLength !== undefined) {

    if (

      typeof contentLength !== "string" ||

      !/^[0-9]+$/.test(contentLength)

    ) {

      return {
        ok: false,
        reason: "invalid_json"
      };

    }

    const declaredSize =
      Number(contentLength);

    if (

      !Number.isSafeInteger(declaredSize) ||

      declaredSize > MAX_JSON_BODY_BYTES

    ) {

      return {
        ok: false,
        reason: "body_too_large"
      };

    }

  }


  let size = 0;

  const chunks = [];


  try {

    /*
     * Node.js stream iterator.
     *
     * Do not automatically destroy
     * the stream when returning early.
     */

    const iterator = request.iterator({

      destroyOnReturn: false

    });


    for await (const chunk of iterator) {

      size += chunk.length;

      if (size > MAX_JSON_BODY_BYTES) {

        return {

          ok: false,

          reason: "body_too_large"

        };

      }

      chunks.push(chunk);

    }


    if (!request.complete) {

      return {

        ok: false,

        reason: "invalid_json"

      };

    }


    if (chunks.length === 0) {

      return {

        ok: true,

        value: {}

      };

    }


    /*
     * Reject malformed UTF-8 instead
     * of replacing invalid characters.
     */

    const decoder = new TextDecoder(

      "utf-8",

      { fatal: true }

    );

    const decoded = decoder.decode(

      Buffer.concat(chunks, size)

    );

    const value = JSON.parse(decoded);


    if (

      !value ||

      typeof value !== "object" ||

      Array.isArray(value)

    ) {

      return {

        ok: false,

        reason: "invalid_json"

      };

    }


    return {

      ok: true,

      value

    };

  } catch {

    return {

      ok: false,

      reason: "invalid_json"

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

    subscriptionServices = null,

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
         * =====================================================
         * R2.7F3 — SUBSCRIPTION HTTP API
         * =====================================================
         *
         * Server-authenticated subscription state.
         * Server-generated payment quotes.
         * Finalized payment confirmation.
         *
         * Disabled without trusted server services.
         * No client-side entitlement activation.
         */

        if (
          pathname === "/api/subscription/state" ||
          pathname === "/api/subscription/quote" ||
          pathname === "/api/subscription/confirm"
        ) {

          const stateRoute =
            pathname === "/api/subscription/state";

          const quoteRoute =
            pathname === "/api/subscription/quote";

          const expectedMethod =
            stateRoute ? "GET" : "POST";


          /*
           * 1. HTTP METHOD VALIDATION
           */

          if (method !== expectedMethod) {

            json(
              response,
              405,
              publicError("method_not_allowed"),
              {
                Allow: expectedMethod
              }
            );

            return;

          }


          /*
           * 2. NO PAYMENT DATA IN URL
           */

          if (url.search !== "") {

            json(
              response,
              400,
              publicError(
                "subscription_query_not_allowed"
              )
            );

            return;

          }


          /*
           * 3. STRICT SAME-ORIGIN PROTECTION
           *
           * Payment mutations require an explicit
           * matching browser Origin.
           */

          if (!stateRoute) {

            const origin =
              clean(request.headers.origin);

            const requestHost =
              clean(request.headers.host);

            const expectedOrigin =
              (cookieSecure ? "https://" : "http://") +
              requestHost;

            const fetchSite =
              clean(request.headers["sec-fetch-site"]);

            if (
              !requestHost ||
              !origin ||
              origin !== expectedOrigin ||
              (
                fetchSite &&
                fetchSite !== "same-origin"
              )
            ) {

              json(
                response,
                403,
                publicError("origin_not_allowed")
              );

              return;

            }

          }


          /*
           * 4. COOKIE-BASED AUTHENTICATION
           *
           * Never use accountId or sessionToken
           * supplied in the JSON body.
           */

          const sessionToken =
            getSessionToken(request);

          if (
            typeof sessionToken !== "string" ||
            sessionToken.trim().length === 0 ||
            sessionToken.length > 256
          ) {

            json(
              response,
              401,
              publicError("authentication_required")
            );

            return;

          }


          /*
           * 5. TRUSTED SERVER SERVICES
           */

          const entitlement =
            subscriptionServices?.entitlement;

          const quoteStore =
            subscriptionServices?.quoteStore;

          const authorization =
            subscriptionServices?.authorization;

          const serviceAvailable = stateRoute

            ? typeof entitlement?.getState === "function"

            : quoteRoute

              ? typeof quoteStore?.createQuote === "function"

              : typeof authorization?.confirmPayment ===
                  "function";


          if (!serviceAvailable) {

            json(
              response,
              503,
              publicError(
                "subscription_service_unavailable"
              )
            );

            return;

          }


          /*
           * 6. REQUEST BODY VALIDATION
           */

          let body = {};

          if (!stateRoute) {

            const contentType = clean(
              request.headers["content-type"]
            ).split(";")[0].trim().toLowerCase();

            if (contentType !== "application/json") {

              json(
                response,
                415,
                publicError(
                  "application_json_required"
                )
              );

              return;

            }

            const parsed =
              await readJSON(request);

            if (!parsed.ok) {

              json(
                response,
                parsed.reason === "body_too_large"
                  ? 413
                  : 400,
                publicError(parsed.reason)
              );

              return;

            }

            body = parsed.value;

            const allowedFields = quoteRoute

              ? []

              : [
                  "quoteId",
                  "transactionSignature"
                ];

            if (
              Object.keys(body).some(
                key => !allowedFields.includes(key)
              )
            ) {

              json(
                response,
                400,
                publicError(
                  "unexpected_payment_fields"
                )
              );

              return;

            }

            if (!quoteRoute) {

              if (
                typeof body.quoteId !== "string" ||
                !/^[a-f0-9]{32}$/.test(body.quoteId) ||
                typeof body.transactionSignature !==
                  "string" ||
                !validSolanaSignature(
  body.transactionSignature
)
              ) {

                json(
                  response,
                  400,
                  publicError(
                    "invalid_payment_request"
                  )
                );

                return;

              }

            }

          }


          /*
           * 7. EXECUTE AUTHORIZED OPERATION
           *
           * Services independently validate
           * the supplied server session.
           */

          try {

            let result;

            if (stateRoute) {

              result = await entitlement.getState({

                sessionToken

              });

            } else if (quoteRoute) {

              result = await quoteStore.createQuote({

                sessionToken

              });

            } else {

              result = await authorization.confirmPayment({

                sessionToken,

                quoteId: body.quoteId,

                transactionSignature:
                  body.transactionSignature

              });

            }


            /*
             * 8. SAFE ERROR MAPPING
             *
             * Never return internal provider
             * errors or exception messages.
             */

            if (result?.ok !== true) {

              const errors = {

                authentication_required: 401,

                session_expired: 401,

                payment_session_expired: 401,

                payment_session_changed: 401,

                invalid_payment_request: 400,

                payment_quote_not_found: 404,

                payment_already_used: 409,

                transaction_not_found: 409,

                transaction_not_finalized: 409,

                transaction_details_unavailable: 409,

                subscription_state_changed: 409,

                payment_context_not_verified: 422,

                payment_evidence_mismatch: 422,

                payment_not_verified: 422,

                active_quote_limit_reached: 429,

                payment_configuration_unavailable: 503,

                payment_context_unavailable: 503,

                quote_creation_unavailable: 503,

                solana_rpc_unavailable: 503,

                payment_verification_unavailable: 503,

                payment_authorization_unavailable: 503,

                payment_recording_unavailable: 503,

                payment_record_integrity_failed: 503,

                subscription_ledger_unavailable: 503,

                subscription_state_unavailable: 503,

                subscription_entitlement_unavailable: 503,

                entitlement_service_closed: 503,

                payment_service_closed: 503,

                quote_store_closed: 503

              };

              const knownReason =
                typeof result?.reason === "string" &&
                Object.hasOwn(errors, result.reason);

              const reason = knownReason

                ? result.reason

                : "subscription_service_unavailable";

              const status = knownReason

                ? errors[reason]

                : 503;


              json(
                response,
                status,
                {

                  ok: false,

                  error: reason,

                  retryable:
                    result?.retryable === true ||
                    status === 503 ||
                    status === 429

                }
              );

              return;

            }


            /*
             * 9. SUBSCRIPTION STATE RESPONSE
             */

            if (stateRoute) {

              json(
                response,
                200,
                {

                  ok: true,

                  subscription: result

                }
              );

              return;

            }


            /*
             * 10. SERVER QUOTE RESPONSE
             */

            if (quoteRoute) {

              if (
                result.quoteStored !== true ||
                !result.quote ||
                typeof result.memo !== "string"
              ) {

                json(
                  response,
                  503,
                  publicError(
                    "subscription_service_unavailable"
                  )
                );

                return;

              }

              json(
                response,
                201,
                {

                  ok: true,

                  quote: result.quote,

                  memo: result.memo,

                  paymentVerified: false,

                  entitled: false,

                  aiEnabled: false,

                  tradingAuthorized: false

                }
              );

              return;

            }


            /*
             * 11. CONFIRMED PAYMENT RESPONSE
             *
             * Recording payment does not
             * automatically authorize AI.
             */

            if (result.paymentRecorded !== true) {

              json(
                response,
                503,
                publicError(
                  "payment_recording_unavailable"
                )
              );

              return;

            }

            json(
              response,
              200,
              {

                ok: true,

                payment: result,

                paymentRecorded: true,

                entitled: false,

                aiEnabled: false,

                tradingAuthorized: false

              }
            );

            return;

          } catch {

            json(
              response,
              503,
              {

                ok: false,

                error:
                  "subscription_service_unavailable",

                retryable: true

              }
            );

            return;

          }

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

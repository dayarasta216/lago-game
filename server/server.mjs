import {
  dirname,
  resolve
} from "node:path";


import {
  fileURLToPath
} from "node:url";


import {
  createLagoAccountSessionStore
} from "./lago-account-session-store.mjs";


import {
  createLagoHttpServer
} from "./http-app.mjs";


const currentDirectory =
  dirname(
    fileURLToPath(
      import.meta.url
    )
  );


const projectRoot =
  resolve(
    currentDirectory,
    ".."
  );


const host =
  String(
    process.env.LAGO_HOST ||
    "127.0.0.1"
  );


const port =
  Number(
    process.env.PORT ||
    process.env.LAGO_PORT ||
    8787
  );


const botToken =
  String(
    process.env.LAGO_TELEGRAM_BOT_TOKEN ||
    ""
  ).trim();


const production =
  process.env.NODE_ENV ===
    "production";


const cookieSecure =
  production ||
  process.env.LAGO_COOKIE_SECURE ===
    "1";


const store =
  createLagoAccountSessionStore();


const server =
  createLagoHttpServer({

    projectRoot,

    store,

    botToken,

    cookieSecure

  });


server.listen(
  port,
  host,
  () => {

    console.log(
      ""
    );


    console.log(
      "=== LAGO BACKEND ==="
    );


    console.log(
      `URL: http://${host}:${port}`
    );


    console.log(
      `Telegram auth: ${
        botToken
          ? "CONFIGURED"
          : "NOT CONFIGURED"
      }`
    );


    console.log(
      `Cookie Secure: ${
        cookieSecure
          ? "YES"
          : "NO (LOCAL DEVELOPMENT)"
      }`
    );


    console.log(
      "===================="
    );


    console.log(
      ""
    );

  }
);


function shutdown(
  signal
) {

  console.log(
    `\n${signal}: shutting down Lago backend`
  );


  server.close(
    () => {

      process.exit(
        0
      );

    }
  );

}


process.on(
  "SIGINT",
  () =>
    shutdown(
      "SIGINT"
    )
);


process.on(
  "SIGTERM",
  () =>
    shutdown(
      "SIGTERM"
    )
);

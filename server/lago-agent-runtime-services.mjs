import { isAbsolute } from "node:path";

import {
  createLagoCharacterStore
} from "./lago-agent-character-store.mjs";

import {
  createLagoCharacterService
} from "./lago-agent-character-service.mjs";

import {
  createLagoRuntimeAccess
} from "./lago-agent-runtime-access.mjs";


/*
 * LAGO GAME
 * R2.8C6B — SERVER RUNTIME COMPOSITION
 *
 * Persistent character ownership.
 * Authenticated character operations.
 * Canonical runtime authorization.
 * Managed service lifecycle.
 *
 * Live AI activation remains locked.
 * No public HTTP endpoints.
 * No trusted character grants.
 * No trading execution.
 */

export const RUNTIME_SERVICES_VERSION = 1;


function validDirectory(value) {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.trim() === value &&
    !value.includes("\0") &&
    isAbsolute(value)
  );
}


/*
 * SERVER COMPOSITION ROOT
 */

export function createLagoRuntimeServices({

  env = process.env,

  projectRoot,

  sessionStore,

  entitlement = null,

  now = () => Date.now()

} = {}) {

  if (
    !env ||
    typeof env !== "object" ||
    Array.isArray(env)
  ) {
    throw new Error(
      "invalid_runtime_services_environment"
    );
  }


  /*
   * Production provider activation
   * must remain locked until consent,
   * request limits and HTTP security
   * are fully integrated.
   */

  const activation =
    env.LAGO_AI_PROVIDER_ENABLED;

  if (activation === "1") {
    throw new Error(
      "ai_provider_activation_not_ready"
    );
  }

  if (
    activation !== undefined &&
    activation !== "" &&
    activation !== "0"
  ) {
    throw new Error(
      "invalid_ai_provider_activation"
    );
  }


  /*
   * Explicit character storage.
   * Never create storage implicitly.
   */

  const directory =
    env.LAGO_CHARACTER_DATA_DIR;

  if (
    directory === undefined ||
    directory === ""
  ) {
    return null;
  }

  if (!validDirectory(directory)) {
    throw new Error(
      "invalid_character_storage_directory"
    );
  }

  if (!validDirectory(projectRoot)) {
    throw new Error(
      "invalid_runtime_project_root"
    );
  }

  if (
    typeof sessionStore?.restoreSession !==
      "function"
  ) {
    throw new Error(
      "runtime_session_store_required"
    );
  }

  if (
    entitlement !== null &&
    typeof entitlement.getSubscription !==
      "function"
  ) {
    throw new Error(
      "invalid_runtime_entitlement_service"
    );
  }

  if (typeof now !== "function") {
    throw new Error(
      "invalid_runtime_services_clock"
    );
  }


  /*
   * MANAGED RESOURCES
   */

  const managed = [];

  let closed = false;

  let characterService = null;

  let runtimeAccess = null;


  function closeManaged() {
    let failed = false;

    while (managed.length > 0) {
      const service = managed.pop();

      try {
        service.close();

      } catch {
        failed = true;
      }
    }

    return !failed;
  }


  /*
   * FAIL-CLOSED INITIALIZATION
   */

  try {

    /*
     * 1. Real persistent character store.
     */

    const characterStore =
      createLagoCharacterStore({
        directory,

        projectRoot,

        trustedGrantsEnabled: false,

        now
      });

    managed.push(characterStore);


    /*
     * 2. Authenticated character service.
     *
     * Account identity is derived
     * exclusively from server sessions.
     */

    characterService =
      createLagoCharacterService({
        sessionStore,

        characterStore,

        now
      });

    managed.push(characterService);


    /*
     * 3. Runtime authorization.
     *
     * Composition does not activate AI.
     */

    runtimeAccess =
      createLagoRuntimeAccess({
        sessionStore,

        getCharacterAccess:
          characterStore.getCharacterAccess,

        getSubscription:
          entitlement === null
            ? null
            : (input, options) =>
                entitlement.getSubscription(
                  input,
                  options
                ),

        runtimeEnabled: false,

        now
      });

  } catch {

    closeManaged();

    throw new Error(
      "runtime_services_bootstrap_failed"
    );
  }


  /*
   * CONTROLLED SHUTDOWN
   *
   * The borrowed session and entitlement
   * services belong to server.mjs.
   */

  function close() {
    if (closed) {
      return;
    }

    closed = true;

    if (!closeManaged()) {
      throw new Error(
        "runtime_services_shutdown_failed"
      );
    }
  }


  /*
   * INTERNAL SERVER INTERFACE
   *
   * No raw character store.
   * No ownership grant interface.
   * No direct provider adapter.
   */

  return Object.freeze({

    version:
      RUNTIME_SERVICES_VERSION,

    characterService,

    runtimeAccess,

    close,

    getPolicy() {
      return Object.freeze({

        characterStorageConfigured:
          true,

        characterServiceAvailable:
          !closed,

        subscriptionServiceConfigured:
          entitlement !== null,

        runtimeEnabled:
          false,

        providerActivationReady:
          false,

        providerEnabled:
          false,

        trustedCharacterGrantsEnabled:
          false,

        rawCharacterStoreExposed:
          false,

        maxActiveAgents:
          1,

        publicEndpointEnabled:
          false,

        tradingAuthorized:
          false,

        closed

      });
    }

  });
}

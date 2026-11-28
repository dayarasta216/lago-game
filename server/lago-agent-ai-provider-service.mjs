import {
  isAbsolute
} from "node:path";

import {
  createLagoAIGateway
} from "./lago-agent-ai-gateway.mjs";

import {
  createLagoOpenAIAdapter
} from "./lago-agent-openai-adapter.mjs";

import {
  createLagoAIUsageLedger
} from "./lago-agent-ai-usage-ledger.mjs";

import {
  AI_BUDGET_LIMITS
} from "./lago-agent-ai-budget.mjs";


/*
 * LAGO GAME
 * R2.8C6A — SECURE AI PROVIDER BOOTSTRAP
 *
 * Server-only composition root.
 *
 * Explicit provider activation.
 * Environment-only credentials.
 * Mandatory generation authorization.
 * Mandatory persistent usage accounting.
 * Controlled service lifecycle.
 *
 * No public HTTP endpoint.
 * No automatic provider activation.
 * No trading authorization.
 */

export const AI_PROVIDER_SERVICE_VERSION = 1;

const PROVIDER_ID = "openai";


/*
 * SAFE CONFIGURATION VALIDATION
 */

function validAPIKey(value) {
  return (
    typeof value === "string" &&

    /^[\x21-\x7E]{1,512}$/
      .test(value)
  );
}

function validModel(value) {
  return (
    typeof value === "string" &&

    /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/
      .test(value)
  );
}

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
 * PRIVATE SERVICE FACTORY
 */

export function createLagoAIProviderService({

  env = process.env,

  projectRoot,

  runtimeAccess,

  getProcessingConsent,

  limits = AI_BUDGET_LIMITS,

  now = () => Date.now(),

  fetchImpl = globalThis.fetch

} = {}) {

  if (
    !env ||
    typeof env !== "object" ||
    Array.isArray(env)
  ) {
    throw new Error(
      "invalid_ai_provider_environment"
    );
  }


  /*
   * Explicit activation only.
   *
   * Missing flag means disabled.
   */

  const activation =
    env.LAGO_AI_PROVIDER_ENABLED;

  if (
    activation === undefined ||

    activation === "" ||

    activation === "0"
  ) {
    return null;
  }

  if (activation !== "1") {
    throw new Error(
      "invalid_ai_provider_activation"
    );
  }


  /*
   * Validate prerequisites before
   * opening databases or adapters.
   */

  if (
    typeof runtimeAccess?.authorize !==
      "function"
  ) {
    throw new Error(
      "ai_runtime_access_required"
    );
  }

  if (
    typeof getProcessingConsent !==
      "function"
  ) {
    throw new Error(
      "ai_processing_consent_required"
    );
  }

  if (
    typeof now !== "function" ||

    typeof fetchImpl !== "function"
  ) {
    throw new Error(
      "invalid_ai_provider_dependencies"
    );
  }

  if (!validDirectory(projectRoot)) {
    throw new Error(
      "invalid_ai_provider_project_root"
    );
  }


  /*
   * SERVER ENVIRONMENT
   *
   * Never return or log credentials.
   */

  const apiKey =
    env.LAGO_OPENAI_API_KEY;

  const model =
    env.LAGO_OPENAI_MODEL;

  const directory =
    env.LAGO_AI_USAGE_DATA_DIR;

  if (!validAPIKey(apiKey)) {
    throw new Error(
      "invalid_ai_provider_api_key"
    );
  }

  if (!validModel(model)) {
    throw new Error(
      "invalid_ai_provider_model"
    );
  }

  if (!validDirectory(directory)) {
    throw new Error(
      "invalid_ai_provider_usage_directory"
    );
  }


  /*
   * MANAGED SERVICE LIFECYCLE
   *
   * Services are closed in
   * reverse initialization order.
   */

  const managedServices = [];

  let closed = false;

  function closeManagedServices() {
    let failed = false;

    while (managedServices.length > 0) {
      const service =
        managedServices.pop();

      try {
        service.close();

      } catch {
        failed = true;
      }
    }

    return !failed;
  }

  let gateway = null;


  /*
   * FAIL-CLOSED INITIALIZATION
   */

  try {

    /*
     * 1. Persistent usage ledger.
     */

    const usageLedger =
      createLagoAIUsageLedger({
        directory,

        projectRoot,

        limits,

        now
      });

    managedServices.push(
      usageLedger
    );


    /*
     * 2. Strict OpenAI adapter.
     *
     * The authorization barrier
     * cannot be disabled here.
     */

    const adapter =
      createLagoOpenAIAdapter({
        apiKey,

        model,

        enabled: true,

        requireGenerationAuthorization:
          true,

        fetchImpl
      });

    managedServices.push(
      adapter
    );


    /*
     * 3. Authorized AI gateway.
     *
     * Mandatory account entitlement.
     * Mandatory processing consent.
     * Mandatory usage reservation.
     */

    gateway = createLagoAIGateway({
      runtimeAccess,

      getProcessingConsent,

      providerId: PROVIDER_ID,

      model,

      generate: adapter.generate,

      usageLedger,

      enabled: true,

      requireGenerationAuthorization:
        true,

      now
    });

    managedServices.push(
      gateway
    );

  } catch {

    closeManagedServices();

    /*
     * Do not propagate raw errors
     * containing paths or credentials.
     */

    throw new Error(
      "ai_provider_bootstrap_failed"
    );
  }


  /*
   * SERVICE SHUTDOWN
   */

  function close() {
    if (closed) {
      return;
    }

    closed = true;

    if (!closeManagedServices()) {
      throw new Error(
        "ai_provider_shutdown_failed"
      );
    }
  }


  /*
   * SAFE SERVER INTERFACE
   *
   * The raw adapter and ledger
   * remain private.
   *
   * No direct provider invocation.
   */

  return Object.freeze({

    version:
      AI_PROVIDER_SERVICE_VERSION,

    execute(input) {
      return gateway.execute(input);
    },

    close,

    getPolicy() {
      return Object.freeze({
        ...gateway.getPolicy(),

        providerId: PROVIDER_ID,

        serviceClosed: closed,

        active: !closed,

        explicitActivationRequired:
          true,

        serverCredentialsOnly:
          true,

        apiKeyExposed:
          false,

        rawAdapterExposed:
          false,

        persistentUsageRequired:
          true,

        publicEndpointEnabled:
          false,

        tradingAuthorized:
          false
      });
    }

  });
}

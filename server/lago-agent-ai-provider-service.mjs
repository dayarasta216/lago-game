import { isAbsolute } from "node:path";

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

import {
  createLagoAIConsentStore,
  AI_CONSENT_VERSION
} from "./lago-agent-ai-consent-store.mjs";

import {
  createLagoAIRateLimiter,
  AI_RATE_LIMITS
} from "./lago-agent-ai-rate-limiter.mjs";


/*
 * LAGO GAME
 * R2.8C6C3B
 * MANDATORY SECURITY COMPOSITION
 *
 * Persistent authenticated consent.
 * Mandatory consent revision binding.
 * Persistent rate admission.
 * Atomic usage accounting.
 * Strict generation authorization.
 * Managed asynchronous shutdown.
 *
 * No public HTTP endpoint.
 * No automatic trading.
 */

export const AI_PROVIDER_SERVICE_VERSION = 1;

const PROVIDER_ID = "openai";


/*
 * VALIDATION
 */

function validAPIKey(value) {
  return (
    typeof value === "string" &&
    /^[\x21-\x7E]{1,512}$/.test(value)
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

function closedConsent() {
  return Object.freeze({
    ok: false,

    version: AI_CONSENT_VERSION,

    granted: false,

    revision: null,

    providerDispatchAuthorized: false,

    memoryAuthorized: false,

    externalModelTrainingAuthorized: false,

    tradingAuthorized: false,

    reason: "ai_consent_store_closed"
  });
}


/*
 * PRIVATE PROVIDER SERVICE
 */

export function createLagoAIProviderService({

  env = process.env,

  projectRoot,

  runtimeAccess,

  sessionStore,

  /*
   * Legacy callbacks and external
   * security overrides are forbidden.
   */

  getProcessingConsent,

  getProcessingConsentRevision,

  rateLimiter: externalRateLimiter,

  usageLedger: externalUsageLedger,

  limits = AI_BUDGET_LIMITS,

  rateLimits = AI_RATE_LIMITS,

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
   * EXPLICIT ACTIVATION
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
   * MANDATORY TRUSTED DEPENDENCIES
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
    typeof sessionStore?.restoreSession !==
      "function"
  ) {
    throw new Error(
      "ai_consent_session_store_required"
    );
  }

  if (
    getProcessingConsent !== undefined ||

    getProcessingConsentRevision !== undefined ||

    externalRateLimiter !== undefined ||

    externalUsageLedger !== undefined
  ) {
    throw new Error(
      "ai_security_override_forbidden"
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
   * PRIVATE ENVIRONMENT
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
   * MANAGED LIFECYCLE
   */

  const managedServices = [];

  const pendingOperations = new Set();

  let closed = false;

  let closing = null;

  let consentStore = null;

  let gateway = null;

  let adapter = null;


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


  function track(operation) {
    const task = Promise.resolve(
      operation()
    );

    pendingOperations.add(task);

    task.then(
      () => pendingOperations.delete(task),

      () => pendingOperations.delete(task)
    );

    return task;
  }


  /*
   * FAIL-CLOSED INITIALIZATION
   */

  try {

    /*
     * 1. Persistent token accounting.
     */

    const usageLedger =
      createLagoAIUsageLedger({
        directory,
        projectRoot,
        limits,
        now
      });

    managedServices.push(usageLedger);


    /*
     * 2. Persistent authenticated
     * processing consent.
     */

    consentStore =
      createLagoAIConsentStore({
        directory,

        projectRoot,

        sessionStore,

        model,

        now
      });

    managedServices.push(consentStore);


    /*
     * 3. Persistent account and global
     * request admission.
     */

    const rateLimiter =
      createLagoAIRateLimiter({
        directory,

        projectRoot,

        limits: rateLimits,

        now
      });

    managedServices.push(rateLimiter);


    /*
     * 4. Strict OpenAI adapter.
     */

    adapter = createLagoOpenAIAdapter({
      apiKey,

      model,

      enabled: true,

      requireGenerationAuthorization:
        true,

      fetchImpl
    });

    managedServices.push(adapter);


    /*
     * 5. Fully protected AI gateway.
     *
     * Security callbacks originate
     * exclusively from internal stores.
     */

    gateway = createLagoAIGateway({
      runtimeAccess,

      getProcessingConsent:
        consentStore.getProcessingConsent,

      getProcessingConsentRevision:
        consentStore.getProcessingConsentRevision,

      rateLimiter,

      usageLedger,

      providerId: PROVIDER_ID,

      model,

      generate: adapter.generate,

      enabled: true,

      requireGenerationAuthorization:
        true,

      now
    });

    managedServices.push(gateway);

  } catch {

    closeManagedServices();

    throw new Error(
      "ai_provider_bootstrap_failed"
    );
  }


  /*
   * SAFE INFERENCE EXECUTION
   */

  function execute(input) {
    if (closed) {
      return gateway.execute(input);
    }

    return track(
      () => gateway.execute(input)
    );
  }


  /*
   * AUTHENTICATED CONSENT MANAGEMENT
   *
   * These operations do not require
   * an active AI subscription.
   */

  function getConsentState(input) {
    if (closed) {
      return Promise.resolve(
        closedConsent()
      );
    }

    return track(
      () => consentStore.getConsentState(
        input
      )
    );
  }


  function setConsent(input) {
    if (closed) {
      return Promise.resolve(
        closedConsent()
      );
    }

    return track(
      () => consentStore.setConsent(
        input
      )
    );
  }


  /*
   * GRACEFUL ASYNCHRONOUS SHUTDOWN
   *
   * Stop admission immediately.
   * Abort active gateway and adapter calls.
   * Wait for tracked gateway cleanup.
   * Then close persistent databases.
   *
   * Uncertain reservations and unfinished
   * concurrency claims remain persisted.
   */

  function close() {
    if (closing !== null) {
      return closing;
    }

    closed = true;

    gateway.close();

    adapter.close();

    closing = Promise.allSettled(
      [...pendingOperations]
    ).then(() => {
      if (!closeManagedServices()) {
        throw new Error(
          "ai_provider_shutdown_failed"
        );
      }
    });

    return closing;
  }


  /*
   * SAFE INTERNAL SERVICE INTERFACE
   */

  return Object.freeze({

    version:
      AI_PROVIDER_SERVICE_VERSION,

    execute,

    getConsentState,

    setConsent,

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

        rawSecurityStoresExposed:
          false,

        persistentUsageRequired:
          true,

        persistentConsentRequired:
          true,

        persistentRateLimiterRequired:
          true,

        consentRevisionRequired:
          true,

        securityOverridesAllowed:
          false,

        authenticatedConsentManagement:
          true,

        asynchronousShutdown:
          true,

        publicEndpointEnabled:
          false,

        tradingAuthorized:
          false
      });
    }

  });
}


import {
  validateMemoryIdentity,
  validMemoryId,
  projectMemoryRecord,
  getMemoryCategories
} from "./lago-agent-memory-contract.mjs";


/*
 * LAGO GAME
 * R2.6G — PERSONAL MEMORY MANAGEMENT
 *
 * Owner-controlled memory operations.
 *
 * Fresh server authorization for
 * every operation.
 *
 * No subscription required for
 * owner data management.
 *
 * Internal server service only.
 */

export const MEMORY_MANAGEMENT_VERSION = 1;

const MAX_RECORDS = 200;


const POLICY = Object.freeze({

  ownerReviewEnabled: true,

  ownerExportEnabled: true,

  individualDeletionEnabled: true,

  completeDeletionEnabled: true,

  clearConfirmationRequired: true,

  subscriptionRequired: false,

  serverAuthenticationRequired: true,

  freshAuthorizationRequired: true,

  clientIdentityTrusted: false,

  crossAccountAccessEnabled: false,

  crossCharacterAccessEnabled: false,

  automaticCollectionEnabled: false,

  automaticDeletionEnabled: false,

  tradingAuthorizationGranted: false

});


/*
 * STANDARD ERROR RESPONSE
 */

function reject(reason) {

  return Object.freeze({

    ok: false,

    reason

  });

}


/*
 * SERVICE FACTORY
 */

export function createLagoMemoryManagement({

  access,

  memoryStore

} = {}) {

  if (

    typeof access?.authorize !==
      "function"

  ) {

    throw new Error(
      "memory_access_service_required"
    );

  }


  for (const method of [

    "list",

    "remove",

    "clear",

    "getPolicy"

  ]) {

    if (

      typeof memoryStore?.[method] !==
        "function"

    ) {

      throw new Error(
        "memory_store_required"
      );

    }

  }


  /*
   * AUTHORIZE OWNER OPERATION
   *
   * Never accept the owner identity
   * directly from the client.
   */

  async function authorizeOwner(

    sessionToken,

    characterId,

    action

  ) {

    const permission =
      await access.authorize({

        sessionToken,

        characterId,

        action

      });


    if (

      permission?.ok !== true ||

      permission.authorized !== true ||

      permission.ownerManagement !== true ||

      permission.action !== action ||

      permission.subscriptionRequired !==
        false ||

      !validateMemoryIdentity(
        permission.identity
      ) ||

      permission.identity.characterId !==
        characterId

    ) {

      return null;

    }


    return permission.identity;

  }


  /*
   * VALIDATE AND PROJECT STORED RECORDS
   */

  async function readOwnerRecords(identity) {

    const result =
      await memoryStore.list(
        identity
      );


    if (

      result?.ok !== true ||

      !Array.isArray(result.records) ||

      result.records.length >
        MAX_RECORDS ||

      result.count !==
        result.records.length

    ) {

      throw new Error(
        "invalid_memory_store_result"
      );

    }


    const records = [];

    const seen = new Set();


    for (const record of result.records) {

      const projected =
        projectMemoryRecord(

          record,

          identity

        );


      if (

        !projected ||

        seen.has(projected.memoryId)

      ) {

        throw new Error(
          "memory_integrity_check_failed"
        );

      }


      seen.add(
        projected.memoryId
      );

      records.push(
        projected
      );

    }


    records.sort((a, b) => {

      const difference =

        Date.parse(b.updatedAt) -

        Date.parse(a.updatedAt);


      if (difference !== 0) {

        return difference;

      }


      return a.memoryId.localeCompare(
        b.memoryId
      );

    });


    return Object.freeze(records);

  }


  /*
   * BUILD MEMORY STATISTICS
   */

  function summarize(records) {

    const categories =
      Object.fromEntries(

        getMemoryCategories().map(

          category => [category, 0]

        )

      );


    let contentCharacters = 0;


    for (const record of records) {

      categories[
        record.category
      ] += 1;


      contentCharacters +=
        record.content.length;

    }


    return Object.freeze({

      totalRecords:
        records.length,

      maxRecords:
        MAX_RECORDS,

      remainingRecords:

        MAX_RECORDS -
          records.length,

      usagePercent:

        records.length /
          MAX_RECORDS * 100,

      contentCharacters,

      categories:
        Object.freeze(categories)

    });

  }


  /*
   * REVIEW PRIVATE MEMORY
   */

  async function review({

    sessionToken,

    characterId

  } = {}) {

    try {

      const identity =
        await authorizeOwner(

          sessionToken,

          characterId,

          "review"

        );


      if (!identity) {

        return reject(
          "memory_access_denied"
        );

      }


      const records =
        await readOwnerRecords(
          identity
        );


      return Object.freeze({

        ok: true,

        version:
          MEMORY_MANAGEMENT_VERSION,

        characterId:
          identity.characterId,

        summary:
          summarize(records),

        records

      });

    } catch {

      return reject(
        "memory_management_unavailable"
      );

    }

  }


  /*
   * EXPORT PRIVATE MEMORY
   *
   * Returns canonical export data.
   * HTTP transport is implemented
   * separately.
   */

  async function exportMemory({

    sessionToken,

    characterId

  } = {}) {

    try {

      const identity =
        await authorizeOwner(

          sessionToken,

          characterId,

          "export"

        );


      if (!identity) {

        return reject(
          "memory_access_denied"
        );

      }


      const records =
        await readOwnerRecords(
          identity
        );


      const exportedAt =
        new Date().toISOString();


      const data = Object.freeze({

        format:
          "lago-personal-memory",

        exportVersion: 1,

        exportedAt,

        identity,

        summary:
          summarize(records),

        records

      });


      return Object.freeze({

        ok: true,

        filename:

          "lago-memory-" +

          identity.characterId +

          ".json",

        contentType:

          "application/json; charset=utf-8",

        data

      });

    } catch {

      return reject(
        "memory_export_unavailable"
      );

    }

  }


  /*
   * DELETE INDIVIDUAL MEMORY
   */

  async function deleteMemory({

    sessionToken,

    characterId,

    memoryId

  } = {}) {

    if (!validMemoryId(memoryId)) {

      return reject(
        "invalid_memory_id"
      );

    }


    try {

      const identity =
        await authorizeOwner(

          sessionToken,

          characterId,

          "delete"

        );


      if (!identity) {

        return reject(
          "memory_access_denied"
        );

      }


      const result =
        await memoryStore.remove(

          identity,

          memoryId

        );


      if (result?.ok !== true) {

        return reject(

          result?.reason ===
            "memory_not_found"

            ? "memory_not_found"

            : "memory_deletion_failed"

        );

      }


      if (

        result.deletedCount !== 1 ||

        !Number.isInteger(result.count) ||

        result.count < 0 ||

        result.count >= MAX_RECORDS

      ) {

        return reject(
          "invalid_memory_store_result"
        );

      }


      return Object.freeze({

        ok: true,

        characterId:
          identity.characterId,

        memoryId,

        deletedCount: 1,

        remainingRecords:
          result.count

      });

    } catch {

      return reject(
        "memory_deletion_unavailable"
      );

    }

  }


  /*
   * CLEAR CHARACTER MEMORY
   *
   * Requires explicit confirmation.
   * Does not delete the account,
   * character, subscription or XP.
   */

  async function clearMemory({

    sessionToken,

    characterId,

    confirmation

  } = {}) {

    if (

      confirmation !==
        "CLEAR_CHARACTER_MEMORY"

    ) {

      return reject(
        "clear_confirmation_required"
      );

    }


    try {

      const identity =
        await authorizeOwner(

          sessionToken,

          characterId,

          "clear"

        );


      if (!identity) {

        return reject(
          "memory_access_denied"
        );

      }


      const result =
        await memoryStore.clear(
          identity
        );


      if (

        result?.ok !== true ||

        result.count !== 0 ||

        !Number.isInteger(
          result.deletedCount
        ) ||

        result.deletedCount < 0 ||

        result.deletedCount >
          MAX_RECORDS

      ) {

        return reject(
          "memory_clear_failed"
        );

      }


      return Object.freeze({

        ok: true,

        characterId:
          identity.characterId,

        deletedCount:
          result.deletedCount,

        remainingRecords: 0,

        characterPreserved: true,

        accountPreserved: true,

        gameplayProgressPreserved: true

      });

    } catch {

      return reject(
        "memory_clear_unavailable"
      );

    }

  }


  /*
   * INTERNAL SERVER API
   */

  return Object.freeze({

    version:
      MEMORY_MANAGEMENT_VERSION,

    review,

    exportMemory,

    deleteMemory,

    clearMemory,

    getPolicy() {

      return POLICY;

    }

  });

}


import {
  createHash,
  createCipheriv,
  createDecipheriv,
  randomBytes
} from "node:crypto";

import {
  mkdir,
  realpath,
  open,
  writeFile,
  rename,
  unlink,
  stat
} from "node:fs/promises";

import { constants } from "node:fs";

import {
  resolve,
  join,
  sep,
  isAbsolute
} from "node:path";

import {
  createMemoryIdentity,
  validateMemoryIdentity,
  validateMemoryRecord,
  memoryBelongsTo,
  projectMemoryRecord,
  validMemoryId
} from "./lago-agent-memory-contract.mjs";


/*
 * LAGO GAME
 * R2.6E1 — ENCRYPTED MEMORY STORE
 *
 * AES-256-GCM encryption at rest.
 * Separate account-character partitions.
 * Atomic file replacement.
 * Single-process mutation queue.
 *
 * INTERNAL SERVER MODULE ONLY.
 *
 * Authentication, consent, subscription
 * and character access must be verified
 * by the calling server service.
 */

export const MEMORY_STORE_VERSION = 1;

const MAX_RECORDS = 200;

const MAX_FILE_BYTES =
  8 * 1024 * 1024;

const ALGORITHM = "aes-256-gcm";


function isInside(parent, target) {

  return (

    target === parent ||

    target.startsWith(
      parent.endsWith(sep)
        ? parent
        : parent + sep
    )

  );

}


function canonicalIdentity(identity) {

  if (!validateMemoryIdentity(identity)) {

    throw new Error("invalid_memory_identity");

  }

  return createMemoryIdentity(

    identity.accountId,

    identity.characterId

  );

}


function decodeBase64(value) {

  if (typeof value !== "string") {

    throw new Error("invalid_encrypted_memory");

  }

  const bytes = Buffer.from(
    value,
    "base64"
  );

  if (bytes.toString("base64") !== value) {

    throw new Error("invalid_encrypted_memory");

  }

  return bytes;

}


/*
 * STORE FACTORY
 */

export function createLagoAgentMemoryStore({

  directory,

  projectRoot,

  encryptionKey

} = {}) {

  if (

    typeof directory !== "string" ||

    typeof projectRoot !== "string" ||

    !isAbsolute(directory) ||

    !isAbsolute(projectRoot)

  ) {

    throw new Error(
      "absolute_memory_paths_required"
    );

  }


  if (

    !Buffer.isBuffer(encryptionKey) ||

    encryptionKey.length !== 32

  ) {

    throw new Error(
      "memory_encryption_key_required"
    );

  }


  const requestedDirectory =
    resolve(directory);

  const root =
    resolve(projectRoot);


  if (isInside(root, requestedDirectory)) {

    throw new Error(
      "memory_directory_inside_project"
    );

  }


  /*
   * Keep a private copy of the key.
   */

  const key = Buffer.from(encryptionKey);

  let directoryPromise = null;

  let queue = Promise.resolve();


  /*
   * PRIVATE DIRECTORY
   */

  function prepareDirectory() {

    if (!directoryPromise) {

      directoryPromise = (async () => {

        const actualRoot =
          await realpath(root);

        await mkdir(
          requestedDirectory,
          {
            recursive: true,
            mode: 0o700
          }
        );

        const actualDirectory =
          await realpath(requestedDirectory);

        if (

          isInside(
            actualRoot,
            actualDirectory
          )

        ) {

          throw new Error(
            "memory_directory_inside_project"
          );

        }

        const info =
          await stat(actualDirectory);

        if (!info.isDirectory()) {

          throw new Error(
            "invalid_memory_directory"
          );

        }

        if (

          process.platform !== "win32" &&

          (info.mode & 0o077) !== 0

        ) {

          throw new Error(
            "insecure_memory_directory_permissions"
          );

        }

        return actualDirectory;

      })();

    }

    return directoryPromise;

  }


  /*
   * SERIALIZED OPERATIONS
   */

  function execute(operation) {

    const result = queue.then(operation);

    queue = result.catch(() => {});

    return result;

  }


  /*
   * ISOLATED FILE PATH
   */

  async function getFile(identity) {

    const folder =
      await prepareDirectory();

    const partition =
      createHash("sha256")
        .update(identity.agentId, "utf8")
        .digest("hex");

    return join(

      folder,

      partition + ".memory"

    );

  }


  /*
   * AUTHENTICATED ENCRYPTION
   */

  function encrypt(identity, records) {

    const iv = randomBytes(12);

    const cipher =
      createCipheriv(
        ALGORITHM,
        key,
        iv
      );

    cipher.setAAD(

      Buffer.from(

        "lago-memory:v1:" +
          identity.agentId,

        "utf8"

      )

    );


    const plaintext =
      Buffer.from(

        JSON.stringify({

          version: MEMORY_STORE_VERSION,

          records

        }),

        "utf8"

      );


    const ciphertext =
      Buffer.concat([

        cipher.update(plaintext),

        cipher.final()

      ]);


    return JSON.stringify({

      version: MEMORY_STORE_VERSION,

      algorithm: ALGORITHM,

      iv: iv.toString("base64"),

      tag: cipher
        .getAuthTag()
        .toString("base64"),

      ciphertext:
        ciphertext.toString("base64")

    });

  }


  /*
   * AUTHENTICATED DECRYPTION
   */

  function decrypt(identity, raw) {

    try {

      const envelope = JSON.parse(raw);

      if (

        envelope.version !==
          MEMORY_STORE_VERSION ||

        envelope.algorithm !== ALGORITHM

      ) {

        throw new Error("invalid_envelope");

      }


      const iv =
        decodeBase64(envelope.iv);

      const tag =
        decodeBase64(envelope.tag);

      const ciphertext =
        decodeBase64(envelope.ciphertext);


      if (

        iv.length !== 12 ||

        tag.length !== 16

      ) {

        throw new Error("invalid_envelope");

      }


      const decipher =
        createDecipheriv(

          ALGORITHM,

          key,

          iv,

          { authTagLength: 16 }

        );


      decipher.setAAD(

        Buffer.from(

          "lago-memory:v1:" +
            identity.agentId,

          "utf8"

        )

      );


      decipher.setAuthTag(tag);


      const plaintext =
        Buffer.concat([

          decipher.update(ciphertext),

          decipher.final()

        ]);


      const data =
        JSON.parse(
          plaintext.toString("utf8")
        );


      if (

        data.version !==
          MEMORY_STORE_VERSION ||

        !Array.isArray(data.records) ||

        data.records.length >
          MAX_RECORDS

      ) {

        throw new Error("invalid_memory_data");

      }


      const ids = new Set();

      const records = [];


      for (const record of data.records) {

        const projected =
          projectMemoryRecord(

            record,

            identity

          );


        if (

          !projected ||

          ids.has(projected.memoryId)

        ) {

          throw new Error(
            "invalid_memory_record"
          );

        }


        ids.add(projected.memoryId);

        records.push(projected);

      }


      return records;

    } catch {

      /*
       * Never overwrite unreadable data.
       * Never expose private content.
       */

      throw new Error(
        "memory_integrity_check_failed"
      );

    }

  }


  /*
   * READ PRIVATE PARTITION
   */

  async function readRecords(identity) {

    const file =
      await getFile(identity);

    let handle;


    try {

      handle = await open(

        file,

        constants.O_RDONLY |
          (constants.O_NOFOLLOW || 0)

      );

    } catch (error) {

      if (error?.code === "ENOENT") {

        return [];

      }

      throw error;

    }


    let raw;

    try {

      const info =
        await handle.stat();


      if (

        !info.isFile() ||

        info.size > MAX_FILE_BYTES

      ) {

        throw new Error(
          "invalid_memory_file"
        );

      }


      raw = await handle.readFile("utf8");

    } finally {

      await handle.close();

    }


    return decrypt(
      identity,
      raw
    );

  }


  /*
   * ATOMIC ENCRYPTED WRITE
   */

  async function writeRecords(
    identity,
    records
  ) {

    if (

      records.length > MAX_RECORDS ||

      !records.every(

        record => memoryBelongsTo(
          record,
          identity
        )

      )

    ) {

      throw new Error(
        "invalid_memory_partition"
      );

    }


    const file =
      await getFile(identity);

    const encrypted =
      encrypt(identity, records);


    if (

      Buffer.byteLength(encrypted, "utf8") >
        MAX_FILE_BYTES

    ) {

      throw new Error(
        "memory_storage_limit"
      );

    }


    const temporary =

      file + "." +

      randomBytes(16)
        .toString("hex") +

      ".tmp";


    let created = false;


    try {

      await writeFile(

        temporary,

        encrypted,

        {

          encoding: "utf8",

          mode: 0o600,

          flag: "wx"

        }

      );

      created = true;

      await rename(
        temporary,
        file
      );

    } finally {

      if (created) {

        await unlink(temporary)
          .catch(() => {});

      }

    }

  }


  /*
   * LIST RECORDS
   */

  async function list(identity) {

    const owner =
      canonicalIdentity(identity);

    return execute(async () => {

      const records =
        await readRecords(owner);

      return Object.freeze({

        ok: true,

        count: records.length,

        records:
          Object.freeze(records)

      });

    });

  }


  /*
   * ADD CANONICAL RECORD
   */

  async function add(
    identity,
    record
  ) {

    const owner =
      canonicalIdentity(identity);


    if (!validateMemoryRecord(record)) {

      return {
        ok: false,
        reason: "invalid_memory_record"
      };

    }


    const entry =
      projectMemoryRecord(
        record,
        owner
      );


    if (!entry) {

      return {
        ok: false,
        reason: "identity_mismatch"
      };

    }


    return execute(async () => {

      const records =
        await readRecords(owner);


      if (

        records.some(

          item =>
            item.memoryId ===
            entry.memoryId

        )

      ) {

        return {

          ok: false,

          reason: "duplicate_memory_id"

        };

      }


      if (records.length >= MAX_RECORDS) {

        return {

          ok: false,

          reason: "memory_limit_reached"

        };

      }


      const next = [
        ...records,
        entry
      ];


      await writeRecords(
        owner,
        next
      );


      return Object.freeze({

        ok: true,

        record: entry,

        count: next.length

      });

    });

  }


  /*
   * DELETE ONE RECORD
   */

  async function remove(
    identity,
    memoryId
  ) {

    const owner =
      canonicalIdentity(identity);


    if (!validMemoryId(memoryId)) {

      return {

        ok: false,

        reason: "invalid_memory_id"

      };

    }


    return execute(async () => {

      const records =
        await readRecords(owner);

      const next =
        records.filter(

          item =>
            item.memoryId !== memoryId

        );


      if (next.length === records.length) {

        return {

          ok: false,

          reason: "memory_not_found"

        };

      }


      await writeRecords(owner, next);


      return Object.freeze({

        ok: true,

        deletedCount: 1,

        count: next.length

      });

    });

  }


  /*
   * CLEAR CHARACTER MEMORY
   */

  async function clear(identity) {

    const owner =
      canonicalIdentity(identity);


    return execute(async () => {

      const records =
        await readRecords(owner);


      await writeRecords(owner, []);


      return Object.freeze({

        ok: true,

        deletedCount: records.length,

        count: 0

      });

    });

  }


  /*
   * INTERNAL SERVER API
   */

  return Object.freeze({

    version: MEMORY_STORE_VERSION,

    list,

    add,

    remove,

    clear,

    getPolicy() {

      return Object.freeze({

        storage: "encrypted_files",

        encryption: ALGORITHM,

        scope: "account_character",

        maxRecordsPerAgent:
          MAX_RECORDS,

        maxFileBytes:
          MAX_FILE_BYTES,

        singleProcessOnly: true,

        publicDirectoryAllowed: false,

        serverAuthorizationRequired: true,

        automaticDeletionEnabled: false

      });

    }

  });

}


import {
  SUBSCRIPTION_POLICY
} from "./lago-agent-subscription-contract.mjs";

import {
  validAccountId
} from "./lago-agent-memory-contract.mjs";


/*
 * LAGO GAME
 * R2.7D — SOLANA PAYMENT VERIFIER
 *
 * Strict transaction evidence validation.
 *
 * Classic SPL Token Program.
 * TransferChecked + payment memo.
 * Pre/post token balance validation.
 *
 * Trusted RPC transport is separate.
 *
 * No private keys.
 * No transaction signing.
 * No automatic token transfers.
 * No entitlement activation.
 */

export const PAYMENT_VERIFIER_VERSION = 1;

const POLICY = SUBSCRIPTION_POLICY;


export const TOKEN_PROGRAM_ID =
  "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";

export const MEMO_PROGRAM_ID =
  "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr";


const BASE58 =
  "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

const MAX_U64 =
  18446744073709551615n;

const MAX_QUOTE_LIFETIME_SECONDS =
  900;


/*
 * STANDARD REJECTION
 */

function reject(reason) {

  return Object.freeze({

    ok: false,

    evidenceValid: false,

    serverVerified: false,

    entitled: false,

    aiEnabled: false,

    tradingAuthorized: false,

    reason

  });

}


/*
 * BASE58 VALIDATION
 */

function decodedBase58Length(value) {

  if (

    typeof value !== "string" ||

    value.length === 0 ||

    value.length > 88

  ) {

    return -1;

  }


  let number = 0n;


  for (const character of value) {

    const index =
      BASE58.indexOf(character);

    if (index < 0) {

      return -1;

    }

    number =
      number * 58n +
      BigInt(index);

  }


  let leadingZeros = 0;


  while (

    leadingZeros < value.length &&

    value[leadingZeros] === "1"

  ) {

    leadingZeros += 1;

  }


  let byteLength = 0;


  while (number > 0n) {

    byteLength += 1;

    number >>= 8n;

  }


  return leadingZeros + byteLength;

}


export function validSolanaPublicKey(value) {

  return decodedBase58Length(value) === 32;

}


export function validSolanaSignature(value) {

  return decodedBase58Length(value) === 64;

}


/*
 * EXACT TOKEN AMOUNTS
 */

function parseAmount(value) {

  if (

    typeof value !== "string" ||

    !/^(0|[1-9][0-9]{0,19})$/
      .test(value)

  ) {

    return null;

  }


  const amount = BigInt(value);


  return amount <= MAX_U64

    ? amount

    : null;

}


function validDecimals(value) {

  return (

    Number.isInteger(value) &&

    value >= 0 &&

    value <= 18

  );

}


function validQuoteId(value) {

  return (

    typeof value === "string" &&

    /^[a-f0-9]{32}$/.test(value)

  );

}


/*
 * PAYMENT MEMO
 *
 * Contains no private account data.
 * Quote identifiers must be generated
 * by a cryptographically secure server.
 */

export function buildPaymentMemo(quoteId) {

  if (!validQuoteId(quoteId)) {

    return null;

  }


  return "LAGO-SUB-V1:" + quoteId;

}


/*
 * TRUSTED SERVER QUOTE VALIDATION
 *
 * Quotes must originate from the
 * future server-side quote store.
 *
 * Structural validation alone does
 * not prove quote authenticity.
 */

export function validatePaymentQuote(quote) {

  if (

    !quote ||

    typeof quote !== "object" ||

    Array.isArray(quote) ||

    quote.schemaVersion !== 1 ||

    !validQuoteId(quote.quoteId) ||

    !validAccountId(quote.accountId) ||

    quote.product !== POLICY.product ||

    quote.billingModel !== "subscription" ||

    quote.billingInterval !== "month" ||

    quote.billingIntervalCount !== 1 ||

    quote.chain !== POLICY.chain ||

    quote.network !== POLICY.network ||

    quote.tokenMint !== POLICY.tokenMint ||

    quote.tokenProgram !== TOKEN_PROGRAM_ID ||

    !validSolanaPublicKey(
      quote.tokenMint
    ) ||

    !validSolanaPublicKey(
      quote.payerWallet
    ) ||

    !validSolanaPublicKey(
      quote.treasuryWallet
    ) ||

    !validSolanaPublicKey(
      quote.sourceTokenAccount
    ) ||

    !validSolanaPublicKey(
      quote.destinationTokenAccount
    ) ||

    quote.payerWallet ===
      quote.treasuryWallet ||

    quote.sourceTokenAccount ===
      quote.destinationTokenAccount ||

    !validDecimals(
      quote.tokenDecimals
    )

  ) {

    return false;

  }


  const amount =
    parseAmount(
      quote.amountBaseUnits
    );


  if (

    amount === null ||

    amount <= 0n ||

    !Number.isSafeInteger(
      quote.issuedAtSeconds
    ) ||

    !Number.isSafeInteger(
      quote.expiresAtSeconds
    ) ||

    quote.issuedAtSeconds <= 0 ||

    quote.expiresAtSeconds <=
      quote.issuedAtSeconds ||

    quote.expiresAtSeconds -
      quote.issuedAtSeconds >
      MAX_QUOTE_LIFETIME_SECONDS

  ) {

    return false;

  }


  return true;

}


/*
 * READ ONE TOKEN BALANCE
 *
 * Match by transaction account index.
 * Require unique matching metadata.
 */

function readTokenBalance({

  balances,

  accountIndex,

  owner,

  mint,

  decimals

}) {

  if (!Array.isArray(balances)) {

    return null;

  }


  const matches = balances.filter(

    item =>

      item?.accountIndex ===
        accountIndex

  );


  if (matches.length !== 1) {

    return null;

  }


  const entry = matches[0];


  if (

    entry.owner !== owner ||

    entry.mint !== mint ||

    entry.programId !==
      TOKEN_PROGRAM_ID ||

    entry.uiTokenAmount?.decimals !==
      decimals

  ) {

    return null;

  }


  return parseAmount(

    entry.uiTokenAmount.amount

  );

}


/*
 * VERIFY TRANSACTION EVIDENCE
 *
 * The transaction must be obtained
 * from trusted Solana RPC.
 *
 * Browser-supplied transaction JSON
 * must never be used as evidence.
 */

export function verifySolanaPaymentEvidence({

  quote,

  transactionSignature,

  transaction

} = {}) {

  try {

    /*
     * 1. QUOTE AND SIGNATURE
     */

    if (!validatePaymentQuote(quote)) {

      return reject(
        "invalid_payment_quote"
      );

    }


    if (

      !validSolanaSignature(
        transactionSignature
      )

    ) {

      return reject(
        "invalid_transaction_signature"
      );

    }


    if (

      !transaction ||

      !transaction.transaction ||

      !transaction.meta

    ) {

      return reject(
        "transaction_unavailable"
      );

    }


    /*
     * 2. SUCCESSFUL EXECUTION
     */

    if (transaction.meta.err !== null) {

      return reject(
        "transaction_failed"
      );

    }


    /*
     * V1 supports legacy transactions.
     */

    if (transaction.version !== "legacy") {

      return reject(
        "unsupported_transaction_version"
      );

    }


    /*
     * 3. PAYMENT TIME WINDOW
     */

    const blockTime =
      transaction.blockTime;


    if (

      !Number.isSafeInteger(blockTime) ||

      blockTime <
        quote.issuedAtSeconds ||

      blockTime >=
        quote.expiresAtSeconds

    ) {

      return reject(
        "transaction_outside_quote_window"
      );

    }


    /*
     * 4. TRANSACTION IDENTITY
     */

    const signatures =
      transaction.transaction.signatures;


    if (

      !Array.isArray(signatures) ||

      signatures.length !== 1 ||

      signatures[0] !==
        transactionSignature

    ) {

      return reject(
        "transaction_signature_mismatch"
      );

    }


    const message =
      transaction.transaction.message;

    const keys =
      message?.accountKeys;


    if (

      !Array.isArray(keys) ||

      keys.length === 0 ||

      keys.length > 64

    ) {

      return reject(
        "invalid_transaction_accounts"
      );

    }


    const addresses = keys.map(

      item => item?.pubkey

    );


    if (

      !addresses.every(
        validSolanaPublicKey
      ) ||

      new Set(addresses).size !==
        addresses.length

    ) {

      return reject(
        "invalid_transaction_accounts"
      );

    }


    /*
     * 5. PAYER AUTHORIZATION
     *
     * Require payer as the only signer
     * and transaction fee payer.
     */

    const signers = keys.filter(

      item => item.signer === true

    );


    if (

      signers.length !== 1 ||

      signers[0].pubkey !==
        quote.payerWallet ||

      keys[0].pubkey !==
        quote.payerWallet ||

      keys[0].writable !== true

    ) {

      return reject(
        "payer_signature_mismatch"
      );

    }


    const sourceIndex =
      addresses.indexOf(
        quote.sourceTokenAccount
      );

    const destinationIndex =
      addresses.indexOf(
        quote.destinationTokenAccount
      );


    if (

      sourceIndex < 0 ||

      destinationIndex < 0 ||

      sourceIndex === destinationIndex ||

      keys[sourceIndex].writable !== true ||

      keys[destinationIndex].writable !== true

    ) {

      return reject(
        "payment_token_account_mismatch"
      );

    }


    /*
     * 6. STRICT INSTRUCTION SET
     *
     * Exactly one memo and one
     * TransferChecked instruction.
     *
     * No arbitrary programs.
     * No extra token transfers.
     */

    const instructions =
      message.instructions;


    if (

      !Array.isArray(instructions) ||

      instructions.length !== 2

    ) {

      return reject(
        "unexpected_payment_instructions"
      );

    }


    const memo =
      instructions[0];

    const transfer =
      instructions[1];


    if (

      memo?.programId !==
        MEMO_PROGRAM_ID ||

      memo.parsed !==
        buildPaymentMemo(quote.quoteId)

    ) {

      return reject(
        "payment_memo_mismatch"
      );

    }


    if (

      transfer?.programId !==
        TOKEN_PROGRAM_ID ||

      transfer.parsed?.type !==
        "transferChecked"

    ) {

      return reject(
        "invalid_payment_instruction"
      );

    }


    /*
     * Reject nested instructions.
     */

    if (

      !Array.isArray(
        transaction.meta.innerInstructions
      ) ||

      transaction.meta.innerInstructions
        .length !== 0

    ) {

      return reject(
        "unexpected_inner_instructions"
      );

    }


    /*
     * 7. EXACT TRANSFER PARAMETERS
     */

    const info =
      transfer.parsed.info;


    if (

      !info ||

      info.authority !==
        quote.payerWallet ||

      info.source !==
        quote.sourceTokenAccount ||

      info.destination !==
        quote.destinationTokenAccount ||

      info.mint !== quote.tokenMint ||

      info.tokenAmount?.amount !==
        quote.amountBaseUnits ||

      info.tokenAmount?.decimals !==
        quote.tokenDecimals

    ) {

      return reject(
        "payment_transfer_mismatch"
      );

    }


    /*
     * 8. PRE AND POST TOKEN BALANCES
     */

    const source = {

      accountIndex: sourceIndex,

      owner: quote.payerWallet,

      mint: quote.tokenMint,

      decimals: quote.tokenDecimals

    };


    const destination = {

      accountIndex: destinationIndex,

      owner: quote.treasuryWallet,

      mint: quote.tokenMint,

      decimals: quote.tokenDecimals

    };


    const before =
      transaction.meta.preTokenBalances;

    const after =
      transaction.meta.postTokenBalances;


    const sourceBefore =
      readTokenBalance({

        ...source,

        balances: before

      });


    const sourceAfter =
      readTokenBalance({

        ...source,

        balances: after

      });


    const destinationBefore =
      readTokenBalance({

        ...destination,

        balances: before

      });


    const destinationAfter =
      readTokenBalance({

        ...destination,

        balances: after

      });


    if (

      sourceBefore === null ||

      sourceAfter === null ||

      destinationBefore === null ||

      destinationAfter === null

    ) {

      return reject(
        "payment_balance_evidence_unavailable"
      );

    }


    const expectedAmount =
      parseAmount(
        quote.amountBaseUnits
      );


    if (

      sourceBefore - sourceAfter !==
        expectedAmount ||

      destinationAfter -
        destinationBefore !==
        expectedAmount

    ) {

      return reject(
        "payment_balance_mismatch"
      );

    }


    /*
     * 9. CANONICAL PAYMENT EVIDENCE
     *
     * Valid transaction structure
     * is not yet a trusted receipt.
     *
     * Finality and RPC network
     * verification are separate.
     */

    const evidence = Object.freeze({

      accountId:
        quote.accountId,

      quoteId:
        quote.quoteId,

      transactionSignature,

      product:
        POLICY.product,

      chain:
        POLICY.chain,

      network:
        POLICY.network,

      tokenMint:
        POLICY.tokenMint,

      payerWallet:
        quote.payerWallet,

      treasuryWallet:
        quote.treasuryWallet,

      sourceTokenAccount:
        quote.sourceTokenAccount,

      destinationTokenAccount:
        quote.destinationTokenAccount,

      amountBaseUnits:
        quote.amountBaseUnits,

      tokenDecimals:
        quote.tokenDecimals,

      blockTime,

      memo:
        buildPaymentMemo(quote.quoteId)

    });


    return Object.freeze({

      ok: true,

      version:
        PAYMENT_VERIFIER_VERSION,

      evidenceValid: true,

      evidence,

      serverVerified: false,

      finalityVerified: false,

      entitled: false,

      aiEnabled: false,

      tradingAuthorized: false

    });

  } catch {

    return reject(
      "payment_verification_unavailable"
    );

  }

}


/*
 * VERIFIER POLICY
 */

export function getPaymentVerifierPolicy() {

  return Object.freeze({

    version:
      PAYMENT_VERIFIER_VERSION,

    chain: POLICY.chain,

    network: POLICY.network,

    tokenMint: POLICY.tokenMint,

    tokenProgram: TOKEN_PROGRAM_ID,

    memoProgram: MEMO_PROGRAM_ID,

    transactionVersion: "legacy",

    transferType: "transferChecked",

    requiredCommitment: "finalized",

    maxQuoteLifetimeSeconds:
      MAX_QUOTE_LIFETIME_SECONDS,

    exactAmountRequired: true,

    payerSignatureRequired: true,

    paymentMemoRequired: true,

    tokenBalanceVerificationRequired: true,

    trustedRpcRequired: true,

    serverQuoteRequired: true,

    automaticPaymentEnabled: false,

    entitlementActivationEnabled: false

  });

}

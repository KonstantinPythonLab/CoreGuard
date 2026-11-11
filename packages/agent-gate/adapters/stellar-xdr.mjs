/**
 * packages/agent-gate/adapters/stellar-xdr.mjs — AGENT-XDR/1
 *
 * Turns a signed Stellar envelope into the object AGENT-GATE/1 compares against
 * the authorized intent. This is the link between "we checked the proposal" and
 * "we checked what the wallet actually signed".
 *
 * Boundaries, deliberate and named:
 *   - it BUILDS unsigned envelopes and DECODES envelopes. It never signs, and it
 *     refuses an input shaped like a secret key (S… 56 chars).
 *   - it does not read Horizon or submit: sequencing is the caller's business.
 *   - fee-bump envelopes are refused rather than half-understood, because a
 *     fee-bump changes who pays and AGENT-GATE/1 does not yet model that.
 *   - a Stellar envelope does NOT carry its network. The passphrase is supplied
 *     by the caller and enters the transaction hash, so a testnet signature can
 *     never verify as mainnet — but the caller must be right about the network.
 *
 * Status: code BUILT, execution TEST_EXECUTED (offline, throwaway keypairs),
 * integration NOT_BUILT.
 */

import * as Stellar from "@stellar/stellar-sdk";

export const AGENT_XDR_VERSION = "AGENT-XDR/1";

export const NETWORK_PASSPHRASE = Object.freeze({
  testnet: Stellar.Networks.TESTNET,
  mainnet: Stellar.Networks.PUBLIC,
});

/** Map a network passphrase back to the name the gate uses. */
export function networkNameOf(passphrase) {
  for (const [name, value] of Object.entries(NETWORK_PASSPHRASE)) {
    if (value === passphrase) return name;
  }
  return null;
}

/**
 * A secret key must never reach this module. Rather than trust callers, the
 * functions refuse anything shaped like one — the S-prefixed key.
 */
export function looksLikeSecretKey(value) {
  return typeof value === "string" && /^S[A-Z2-7]{55}$/.test(value.trim());
}

function assetLabel(asset) {
  if (!asset) return null;
  if (typeof asset.isNative === "function" && asset.isNative()) return "XLM";
  if (asset.code && asset.issuer) return `${asset.code}:${asset.issuer}`;
  return String(asset);
}

function bytesOf(value) {
  if (Buffer.isBuffer(value)) return value;
  if (ArrayBuffer.isView(value)) return Buffer.from(value.buffer, value.byteOffset, value.byteLength);
  if (value && value.type === "Buffer" && Array.isArray(value.data)) return Buffer.from(value.data);
  return null;
}

function memoOf(tx) {
  const memo = tx.memo;
  if (!memo || memo.type === "none") return null;
  const bytes = bytesOf(memo.value);
  if (memo.type === "text") return bytes ? bytes.toString("utf8") : String(memo.value ?? "");
  return bytes ? bytes.toString("hex") : String(memo.value ?? "");
}

function operationRecord(op, fallbackSource, memo) {
  const base = { type: op.type, source: op.source || fallbackSource, memo };
  if (op.type === "payment") {
    return {
      ...base,
      destination: op.destination ?? null,
      amount: op.amount ?? null,
      asset: assetLabel(op.asset),
    };
  }
  // Anything else is carried but NOT interpreted. Conformance refuses it as an
  // operation-type mismatch, which is the honest answer for a gate that only
  // authorizes single payments today.
  return { ...base, unsupported: true, operationType: op.type };
}

/**
 * Decode envelope XDR into the execution shape `checkConformance()` consumes.
 *
 * @returns {{ok:true, execution:object} | {ok:false, error:string}}
 */
export function decodeEnvelope({ xdr, network = "testnet" } = {}) {
  const passphrase = NETWORK_PASSPHRASE[network];
  if (!passphrase) return { ok: false, error: `unknown network: ${network}` };

  if (looksLikeSecretKey(xdr)) {
    return { ok: false, error: "input is a secret key, not an envelope — refusing to read it" };
  }
  if (typeof xdr !== "string" || xdr.trim() === "") {
    return { ok: false, error: "xdr required" };
  }

  let tx;
  try {
    tx = Stellar.TransactionBuilder.fromXDR(xdr.trim(), passphrase);
  } catch (e) {
    return { ok: false, error: `decode failed: ${e && e.message ? e.message : e}` };
  }

  if (!tx) return { ok: false, error: "decode produced nothing" };
  if (tx.innerTransaction) {
    return {
      ok: false,
      error: "fee-bump envelopes are not supported by AGENT-GATE/1 — who pays the fee is part of what must be authorized",
    };
  }
  if (!Array.isArray(tx.operations)) {
    return { ok: false, error: "decoded envelope carries no operations" };
  }

  const memo = memoOf(tx);
  const operations = tx.operations.map((op) => operationRecord(op, tx.source, memo));
  const signatures = Array.isArray(tx.signatures) ? tx.signatures : [];
  const hashBytes = typeof tx.hash === "function" ? tx.hash() : null;
  const txHash = hashBytes ? Buffer.from(hashBytes).toString("hex") : null;

  return {
    ok: true,
    execution: {
      status: signatures.length > 0 ? "SIGNED_PENDING_SUBMIT" : "BUILT",
      network,
      source: tx.source,
      operations,
      memo,
      txHash,
      signatureCount: signatures.length,
      fee: String(tx.fee ?? ""),
      timeBounds: tx.timeBounds ?? null,
      envelopeType: "transaction",
      decodedFrom: AGENT_XDR_VERSION,
    },
  };
}

/**
 * Build an UNSIGNED payment envelope for the wallet to sign.
 *
 * `sequence` is required on purpose: reading it from Horizon is a network call
 * this package does not make, and inventing one would produce an envelope that
 * silently fails at submit time.
 */
export function buildPaymentEnvelope({
  source, sequence, destination, amount, asset = "XLM", memo = null,
  network = "testnet", fee = "100", timeoutSeconds = 180, maxTime = null,
} = {}) {
  const passphrase = NETWORK_PASSPHRASE[network];
  if (!passphrase) return { ok: false, error: `unknown network: ${network}` };
  // `maxTime` (unix seconds) makes a prepared envelope REPRODUCIBLE: the default
  // path derives the time bound from the wall clock, so two runs of the same
  // fields produce different bytes and a different transaction hash. Replay and
  // golden-vector work needs the explicit bound; real flows may keep the default.
  if (maxTime !== null && !(Number.isInteger(maxTime) && maxTime > 0)) {
    return { ok: false, error: "maxTime must be a positive integer of unix seconds" };
  }

  if (looksLikeSecretKey(source)) {
    return { ok: false, error: "source must be a PUBLIC key — this module never accepts a secret" };
  }
  for (const [field, value] of Object.entries({ source, destination, amount })) {
    if (typeof value !== "string" || value.trim() === "") return { ok: false, error: `${field} required` };
  }
  if (typeof sequence !== "string" || !/^\d+$/.test(sequence)) {
    return { ok: false, error: "sequence must be an integer string (read it from Horizon yourself)" };
  }

  let assetObject;
  try {
    if (asset === "XLM") assetObject = Stellar.Asset.native();
    else {
      const [code, issuer] = String(asset).split(":");
      if (!code || !issuer) return { ok: false, error: "non-native asset must be CODE:ISSUER" };
      assetObject = new Stellar.Asset(code, issuer);
    }
  } catch (e) {
    return { ok: false, error: `asset unusable: ${e && e.message ? e.message : e}` };
  }

  try {
    const account = new Stellar.Account(source, sequence);
    const builder = new Stellar.TransactionBuilder(account, {
      fee: String(fee),
      networkPassphrase: passphrase,
    })
      .addOperation(Stellar.Operation.payment({ destination, asset: assetObject, amount: String(amount) }));
    if (maxTime === null) builder.setTimeout(timeoutSeconds);
    else builder.setTimebounds(0, maxTime);
    if (memo) builder.addMemo(Stellar.Memo.text(String(memo)));
    const tx = builder.build();
    const hashBytes = tx.hash();
    return {
      ok: true,
      network,
      unsigned: true,
      xdr: tx.toXDR(),
      txHash: hashBytes ? Buffer.from(hashBytes).toString("hex") : null,
    };
  } catch (e) {
    return { ok: false, error: `build failed: ${e && e.message ? e.message : e}` };
  }
}

export function status() {
  return {
    version: AGENT_XDR_VERSION,
    runMode: "OFFLINE",
    builds: "unsigned payment envelopes",
    decodes: "transaction envelopes (fee-bump refused by name)",
    signs: "NOT_BUILT — signing belongs to the wallet",
    submits: "NOT_BUILT",
    integrationStatus: "NOT_BUILT",
  };
}

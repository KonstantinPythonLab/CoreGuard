/**
 * packages/agent-gate/adapters/freighter.mjs — FREIGHTER-ADAPTER/1
 *
 * Asks the user's Freighter wallet to sign the envelope the gate authorized.
 * The gate never receives a key: the wallet holds it, signs, and returns bytes.
 *
 * Two refusals matter here and both are tested:
 *   1. a wallet that returns NOTHING, or an unsigned envelope, is REFUSED;
 *   2. a wallet that returns a DIFFERENT transaction than the one prepared is
 *      REFUSED by comparing transaction hashes — a signature over other bytes
 *      is not a signature over the intent.
 *
 * Honest status: the adapter is BUILT and unit-exercised with an injected
 * wallet object. It has NOT been exercised against a real Freighter extension:
 * the extension was probed in the available browser and is not installed
 * (`window.freighter` and `window.freighterApi` are undefined), and CI has no
 * browser wallet at all. That is `exercisedWithRealWallet: false`, and
 * `integrationStatus: NOT_BUILT`.
 *
 * What HAS been exercised through this interface: a local keypair signed an
 * envelope the gate authorized and Stellar testnet included it (ledger 5665413,
 * 2026-11-10) — the signature path is real, the wallet is not. Both facts are
 * recorded in docs/evidence/agent-gate-testnet-signature.json so a reader
 * cannot average them into "Freighter works".
 */

import { decodeEnvelope, NETWORK_PASSPHRASE, AGENT_XDR_VERSION } from "./stellar-xdr.mjs";

export const FREIGHTER_ADAPTER_VERSION = "FREIGHTER-ADAPTER/1";

/** Shape check only — any object with this method can stand in for Freighter. */
export function freighterAvailable(wallet) {
  return Boolean(wallet && typeof wallet.signTransaction === "function");
}

/**
 * @param {object} args
 * @param {object} args.wallet     Freighter-like: signTransaction(xdr, {network, networkPassphrase, address})
 * @param {string} args.xdr        the unsigned envelope the gate authorized
 * @param {string} args.network    testnet | mainnet
 * @param {string} [args.address]  the signer the user chose
 * @param {string} [args.expectedTxHash] hash of the prepared envelope, if known
 */
export async function requestSignature({
  wallet, xdr, network = "testnet", address, expectedTxHash,
} = {}) {
  if (!freighterAvailable(wallet)) {
    return {
      ok: false,
      state: "NOT_PERFORMED",
      error: "no wallet injected — Freighter is a browser extension and cannot be reached from this process",
    };
  }

  const passphrase = NETWORK_PASSPHRASE[network];
  if (!passphrase) return { ok: false, state: "REFUSED", error: `unknown network: ${network}` };
  if (typeof xdr !== "string" || xdr.trim() === "") {
    return { ok: false, state: "REFUSED", error: "xdr required" };
  }

  let signedXdr;
  try {
    signedXdr = await wallet.signTransaction(xdr, { network, networkPassphrase: passphrase, address });
  } catch (e) {
    return { ok: false, state: "REFUSED", error: `wallet refused: ${e && e.message ? e.message : e}` };
  }

  if (typeof signedXdr !== "string" || signedXdr.trim() === "") {
    return { ok: false, state: "REFUSED", error: "wallet returned no envelope" };
  }

  const decoded = decodeEnvelope({ xdr: signedXdr, network });
  if (!decoded.ok) {
    return { ok: false, state: "REFUSED", error: `wallet returned an unreadable envelope: ${decoded.error}` };
  }
  if (decoded.execution.signatureCount === 0) {
    return { ok: false, state: "REFUSED", error: "wallet returned an unsigned envelope" };
  }
  if (expectedTxHash && decoded.execution.txHash !== expectedTxHash) {
    return {
      ok: false,
      state: "REFUSED",
      error: "wallet signed different bytes than the envelope that was authorized",
      expectedTxHash,
      actualTxHash: decoded.execution.txHash,
    };
  }

  return {
    ok: true,
    state: "SIGNED",
    signedXdr,
    txHash: decoded.execution.txHash,
    signatureCount: decoded.execution.signatureCount,
    execution: decoded.execution,
    decoder: AGENT_XDR_VERSION,
  };
}

export function status() {
  return {
    version: FREIGHTER_ADAPTER_VERSION,
    wallet: "Freighter",
    runMode: "ADAPTER_READY",
    exercisedWithRealWallet: false,
    integrationStatus: "NOT_BUILT",
    realWalletProbe: "window.freighter and window.freighterApi are undefined in the available packaged Chromium — the extension is not installed there, so no extension has ever signed here",
    chainAcceptedSignature: "2026-11-10 — a local keypair behind this interface signed an authorized envelope that Stellar testnet included at ledger 5665413 (tx 7f863dd2…41b757); see docs/evidence/agent-gate-testnet-signature.json",
    note: "Signing is delegated to the wallet; the gate holds no key and cannot submit. Real-extension exercise is pending.",
  };
}

#!/usr/bin/env node
/**
 * scripts/stellar-soroban-authorized-deploy.mjs
 * Stellar Soroban — OWNER-AUTHORIZED DEPLOY runner (authorized lane of CG-COMMITMENT-ANCHOR/1).
 *
 * Deploys a NEW instance of the commitment anchor whose wasm is built by CI
 * from the CURRENT source (artifact `cg-commitment-anchor-wasm`, pinned to
 * the recorded HEAD lineage). The in-tree artifact
 * (`soroban/commitment-anchor/artifacts/cg_commitment_anchor.wasm`, produced
 * at a80d8f9) PREDATES the authorized lane, so those bytes are never deploy
 * material here — a deploy from them would be a fake authorized-lane deploy
 * and the provenance gate refuses by construction.
 *
 * Networks + discipline (docs/OWNER-DECISIONS-2026-11-08.md):
 *   --network testnet   deploy + (with `--rehearse`) the full authorized-lane
 *                       REHEARSAL: owner-key commit_authorized on the pinned
 *                       known-answer vector, idempotent replay, a wrong-owner
 *                       probe (EPHEMERAL testnet-only key) and an
 *                       assert_anchored_authorized mismatch probe — both
 *                       probes are SIMULATION-ONLY and can never submit.
 *                       Artifact: docs/evidence/stellar-soroban-authorized-deploy-testnet.json
 *   --network mainnet   DEPLOY-ONLY under the recorded owner decision:
 *                       uploadContractWasm + createCustomContract +
 *                       read_authorized readback SIMULATION (expected None).
 *                       NO mainnet lane write of any kind — the first
 *                       authorized write is a FUTURE separate owner decision.
 *                       Artifact: docs/evidence/stellar-soroban-authorized-deploy.json
 *   --verify            re-derive this network's artifact digest + verdict
 *                       invariants (fail-closed).
 *
 * Secrets: the wallet file `.stellar-wallet.json` is read ONCE per run into
 * memory and its secret material NEVER reaches any console line, error
 * message, or artifact — only the PUBLIC key travels. Gitignored at repo
 * root (`.gitignore`), never committed, never read into the chat.
 *
 * Exit codes: 0 ok · 1 gate/verify failure · 2 usage · 3 NOT_AUTHORIZED ·
 * 4 already-deployed branch (never double-charge) · 5 step failure ·
 * 6 rehearsal invariant failure · 7 balance/preflight failure.
 */

import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Keypair, Horizon, xdr, Address, StrKey } from "@stellar/stellar-sdk";
import { Server as RpcServer } from "@stellar/stellar-sdk/rpc";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const mirror = await import(pathToFileURL(join(ROOT, "packages/stellar-soroban/index.mjs")).href);
const { deriveAuthorizedAnchorId, deriveSalt, sha256Hex, buildUploadTx, buildCreateContractTx, buildInvokeTx, parseContractIdFromCreateResult } = mirror;

export const DECISIONS_DOC_REL = "docs/OWNER-DECISIONS-2026-11-08.md";
export const DECISION_MARKER = "DECISION-AUTHORIZED-DEPLOY-2026-11-08";
export const WALLET_FILE_REL = ".stellar-wallet.json";
export const ARTIFACT_NAME = "cg-commitment-anchor-wasm";
export const MAINNET_FEE_FLOOR = 1000000;
export const MAINNET_BALANCE_MIN_XLM = 2;
// Fee-solvency constants the ledger itself prices against: a transaction whose declared fee
// would leave the account below its minimum balance is refused by the network with
// txResultCode txInsufficientBalance (-7) BEFORE any effect (measured 2026-11-10 on the real
// mainnet upload(wasm) of cg_commitment_anchor.wasm: the simulation priced 130,861,110
// stroops while the funded deployer held 3.5069800 XLM = 35,069,800 stroops). The minimum
// balance for a non-sponsoring single-entry account is 2 x base reserve (5,000,000 stroops
// each) on mainnet; an account with extra subentries/trustlines owes MORE, so this constant
// is the documented lower bound of the ledger's rule, never an upper one.
export const MAINNET_BASE_RESERVE_STROOPS = 5000000;
export const MAINNET_MIN_BALANCE_STROOPS = 10000000;
export const INFRA = {
  testnet: { rpc: "https://soroban-testnet.stellar.org", horizon: "https://horizon-testnet.stellar.org", friendbot: "https://friendbot.stellar.org" },
  mainnet: { rpc: "https://mainnet.sorobanrpc.com", horizon: "https://horizon.stellar.org", friendbot: null },
};
export const ARTIFACT_OUT = {
  testnet: "docs/evidence/stellar-soroban-authorized-deploy-testnet.json",
  mainnet: "docs/evidence/stellar-soroban-authorized-deploy.json",
};
export const REHEARSAL_VERDICT = "TESTNET REHEARSAL PASSED — authorized lane verified end-to-end (real owner write + idempotent replay; sim-only refusal probes stayed refused)";
export const DEPLOY_VERDICT = "MAINNET AUTHORIZED-LANE DEPLOY EXECUTED — VERIFIED (deploy-only per the recorded owner decision; NO mainnet lane write)";
/** Cross-language known-answer vector (pinned in JS and Rust batteries). */
export const KNOWN_VECTOR = {
  owner: "GDJ3CRNLNDZ4AVWGPUG7DBC5BIAGMIONOONZGB5FSYAY44ZHOIPRKY7U",
  hash: "0xc0dbfb45b6c8e13b3738822360ea737adfc045d4acb808bdaeac563c8af31052",
  id: "0xb5f9655d4c0b4292ed0be7cd87b68e71297c1bf94667a9657ce3b6f6cbec6f30",
};
/** Byte-flipped vector hash — ONLY for the fail-closed mismatch probe. */
export const WRONG_HASH = "0xc1dbfb45b6c8e13b3738822360ea737adfc045d4acb808bdaeac563c8af31052";

class Fail extends Error {
  /** Attach the partial steps list so a caught run can surface diagnostics. */
  constructor(msg, steps) { super(msg); this.steps = steps || null; }
}

const MAINNET = { decisions: null }; // recorded decision doc parsed once per run

/* ------------------------------------------------------------------ */
/* Pure, offline-testable gates                                        */
/* ------------------------------------------------------------------ */

export function parsePlan(argv = []) {
  const plan = { network: null, ownerAuthorized: false, wasmPath: null, manifestPath: null, fee: null, verify: false, rehearse: false, unknownFlags: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = argv[i + 1];
    if (a === "--network") { plan.network = next ?? null; i++; }
    else if (a === "--owner-authorized") plan.ownerAuthorized = true;
    else if (a === "--wasm-path") { plan.wasmPath = next ?? null; i++; }
    else if (a === "--wasm-manifest") { plan.manifestPath = next ?? null; i++; }
    else if (a === "--fee") { plan.fee = next ?? null; i++; }
    else if (a === "--rehearse") plan.rehearse = true;
    else if (a === "--verify") plan.verify = true;
    else if (a.startsWith("--")) plan.unknownFlags.push(a);
  }
  return plan;
}

export function planViolations(plan) {
  const v = [];
  if (!["testnet", "mainnet"].includes(plan.network)) v.push(`--network must be testnet|mainnet (got ${JSON.stringify(plan.network)})`);
  if (plan.unknownFlags.length) v.push(`unknown flags: ${plan.unknownFlags.join(" ")}`);
  if (plan.network === "testnet" && plan.ownerAuthorized) v.push("--owner-authorized is a mainnet gate; testnet never needs it");
  if (plan.network === "testnet" && plan.manifestPath) v.push("--wasm-manifest is a mainnet provenance gate; testnet uses explicit --wasm-path");
  return v;
}

/** Parse the recorded decision doc (fail-closed on every literal). */
export function parseDecisionDoc(raw) {
  const text = typeof raw === "string" ? raw : "";
  const violations = [];
  // Both marker lines are pinned independently — the END line CONTAINS the
  // marker substring, so a bare includes() could pass while the start line is gone.
  if (!text.match(new RegExp(`^[ \\t]+${DECISION_MARKER}[ \\t]*$`, "m"))) violations.push(`decision marker start line missing (indented): ${DECISION_MARKER}`);
  if (!text.match(new RegExp(`^[ \\t]+END ${DECISION_MARKER}[ \\t]*$`, "m"))) violations.push(`decision marker end line missing: END ${DECISION_MARKER}`);
  const pick = (key) => {
    const m = text.match(new RegExp(`^[ \\t]+${key}:[ \\t]*(.+?)[ \\t]*$`, "m"));
    return m ? m[1] : null;
  };
  const authorizedDeploy = pick("authorized_deploy");
  const network = pick("network");
  const walletFile = pick("wallet-file");
  const laneWrites = pick("mainnet-lane-writes");
  const firstWrite = pick("first-authorized-write");
  const feeFloor = pick("fee-floor");
  const saltPolicy = pick("salt-policy");
  const wasmMaterial = pick("wasm-material");
  if (authorizedDeploy !== "YES") violations.push(`authorized_deploy must be the literal YES (got ${JSON.stringify(authorizedDeploy)})`);
  if (network !== "mainnet") violations.push(`recorded network must be mainnet (got ${JSON.stringify(network)})`);
  if (walletFile !== WALLET_FILE_REL) violations.push(`wallet-file must record ${WALLET_FILE_REL} (got ${JSON.stringify(walletFile)})`);
  if (laneWrites !== "NONE") violations.push(`mainnet-lane-writes must be NONE for this deploy-only decision (got ${JSON.stringify(laneWrites)})`);
  if (!/FUTURE SEPARATE OWNER DECISION/.test(firstWrite || "")) violations.push("first-authorized-write must record a FUTURE SEPARATE OWNER DECISION");
  if (!feeFloor || !/^\d+$/.test(feeFloor)) violations.push("fee-floor must be a stroops integer line in the decision doc");
  if (!saltPolicy || !saltPolicy.includes("deterministic")) violations.push("salt-policy must record the deterministic salt derivation");
  if (!wasmMaterial || !wasmMaterial.includes(ARTIFACT_NAME)) violations.push(`wasm-material must pin the CI artifact ${ARTIFACT_NAME}`);
  return {
    ok: violations.length === 0,
    violations,
    authorizedDeploy,
    network,
    walletFile,
    laneWrites,
    feeFloor: feeFloor && /^\d+$/.test(feeFloor) ? Number(feeFloor) : null,
    values: { firstWrite, saltPolicy, wasmMaterial },
  };
}

/** Provenance pin: the material's HEAD lineage must be an ancestor of HEAD. */
export function isAncestorOfHead(headSha) {
  try {
    execFileSync("git", ["merge-base", "--is-ancestor", headSha, "HEAD"], { cwd: ROOT, stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

/** Owner flag + recorded decision doc + artifact provenance (all mandatory). */
export function mainnetGateViolations({ plan, decisions, manifest, wasmSha256 } = {}) {
  if (!plan || plan.network !== "mainnet") return ["mainnetGateViolations is only meaningful on --network mainnet"];
  const v = [];
  if (plan.ownerAuthorized !== true) v.push("missing --owner-authorized: mainnet is never assumed (fail-closed)");
  if (!decisions || decisions.ok !== true) {
    v.push(...((decisions ? decisions.violations : ["decision doc gate not provided"]).map((x) => `decision doc: ${x}`)));
  }
  if (!manifest) {
    v.push("wasm manifest missing (--wasm-manifest): mainnet deploy material must be the recorded CI artifact");
    return v;
  }
  if (!Number.isInteger(manifest.runId) || manifest.runId <= 0) v.push(`manifest.runId must be a positive CI run id (got ${JSON.stringify(manifest.runId)})`);
  if (manifest.artifactName !== ARTIFACT_NAME) v.push(`manifest.artifactName must be ${ARTIFACT_NAME} (got ${JSON.stringify(manifest.artifactName)})`);
  const sha = typeof wasmSha256 === "string" ? wasmSha256.toLowerCase() : "";
  if (sha.length !== 64 || typeof manifest.wasmSha256 !== "string" || manifest.wasmSha256.toLowerCase() !== sha) {
    v.push("manifest.wasmSha256 does not equal sha256(wasm bytes) — deploy material identity failed");
  }
  if (typeof manifest.headSha !== "string" || !/^[0-9a-fA-F]{40}$/.test(manifest.headSha)) {
    v.push(`manifest.headSha must be a 40-hex commit SHA (got ${JSON.stringify(manifest.headSha)})`);
  } else if (!isAncestorOfHead(manifest.headSha)) {
    v.push(`manifest.headSha ${manifest.headSha} is NOT an ancestor of HEAD — deploy material is not from this source lineage`);
  }
  return v;
}

/** Fee policy: explicit integer >= floor, and >= 1.5x the rehearsal max when known. */
export function mainnetFeeViolations({ fee, rehearsalMaxFee } = {}) {
  const v = [];
  const feeNum = typeof fee === "string" && /^\d+$/.test(fee) ? Number(fee) : null;
  if (!feeNum || feeNum < MAINNET_FEE_FLOOR) v.push(`mainnet fee must be an explicit integer >= ${MAINNET_FEE_FLOOR} stroops (got ${JSON.stringify(fee)})`);
  if (Number.isInteger(rehearsalMaxFee) && rehearsalMaxFee > 0) {
    const required = Math.ceil((rehearsalMaxFee * 3) / 2);
    if (feeNum && feeNum < required && feeNum >= MAINNET_FEE_FLOOR) {
      v.push(`fee policy: mainnet fee must also be >= 1.5x the highest observed rehearsal fee (${required} stroops, rehearsal max ${rehearsalMaxFee})`);
    }
  }
  return v;
}

/** Rehearsal-first rule: a mainnet deploy requires the PASSED rehearsal artifact. */
export function rehearsalGate(artifactJson) {
  if (!artifactJson) return ["testnet rehearsal artifact missing — rehearsal MUST precede mainnet (fail-closed)"];
  if (!artifactJson.summary || artifactJson.summary.verdict !== REHEARSAL_VERDICT) {
    return [`testnet rehearsal verdict is not PASSED (got ${JSON.stringify(artifactJson.summary && artifactJson.summary.verdict)})`];
  }
  return [];
}

/* ------------------------------------------------------------------ */
/* Digest-stable artifact plumbing (no timestamps inside the digest)   */
/* ------------------------------------------------------------------ */

export function stableStringify(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(",")}}`;
}

export function digestStable(obj) {
  return `sha256:${createHash("sha256").update(stableStringify(obj)).digest("hex")}`;
}

/* ------------------------------------------------------------------ */
/* Secret-safe wallet loading (file contents never printed anywhere)   */
/* ------------------------------------------------------------------ */

async function loadWallet() {
  const path = join(ROOT, WALLET_FILE_REL);
  let raw;
  try {
    raw = JSON.parse(await readFile(path, "utf8"));
  } catch {
    throw new Fail(`wallet file unreadable at ${WALLET_FILE_REL} (its contents are never printed)`);
  }
  const key = typeof raw === "object" && raw !== null ? raw.secretKey : null;
  raw = null;
  if (key === null || String(key).length < 40) throw new Fail(`wallet file at ${WALLET_FILE_REL} carries no usable secret key field (contents never printed)`);
  const keypair = Keypair.fromSecret(String(key)); // in-process only
  return { keypair, publicKey: keypair.publicKey() };
}

/* ------------------------------------------------------------------ */
/* Network plumbing (raw wire reads per [C37]; poll like the worker)   */
/* ------------------------------------------------------------------ */

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function accountSequence(net, publicKey) {
  const inter = INFRA[net];
  try {
    const rpc = new RpcServer(inter.rpc);
    const acct = await rpc.getAccount(publicKey);
    return { sequence: BigInt(acct.sequence), via: "soroban-rpc" };
  } catch {
    const hz = new Horizon.Server(inter.horizon);
    const acct = await hz.loadAccount(publicKey);
    return { sequence: BigInt(acct.sequence), via: "horizon" };
  }
}

async function horizonTxRaw(horizonBase, hash) {
  try {
    const res = await fetch(`${horizonBase}/transactions/${hash}`);
    if (!res.ok) return { state: "HORIZON_UNAVAILABLE", httpStatus: res.status };
    const rec = await res.json();
    return { state: "RAW_OK", ledger: Number(rec.ledger), feeCharged: Number(rec.fee_charged), raw: { ledger: rec.ledger, fee_charged: rec.fee_charged } };
  } catch {
    return { state: "HORIZON_UNAVAILABLE" };
  }
}

// Convert an XDR-typed response field (string OR SDK XDR object) into a base64 string.
// SDK 17.x returns typed XDR objects (TransactionResult / TransactionMetaV4Arm) from getTransaction —
// a base64 string was assumed by an older surface and silently dropped (typeof === "string" failed →
// metaB64 null → create-contract id unparseable). Fail-closed helper: null when nothing readable.
function xdrB64(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === "string") return v;
  for (const m of ["toXDR", "toXdr", "toXDRBase64", "toXdrBase64"]) {
    const f = typeof v === "object" ? v[m] : null;
    if (typeof f === "function") {
      try { const b = f.call(v, "base64"); if (typeof b === "string" && b.length > 0) return b; } catch { /* try next */ }
    }
  }
  if (Buffer.isBuffer(v)) return v.toString("base64");
  if (typeof Uint8Array !== "undefined" && v instanceof Uint8Array) return Buffer.from(v).toString("base64");
  return null;
}

// The authorized-lane contract id is recorded as a "0x" + 64-hex digest (CGEP/1 domainHash shape);
// the Soroban invoke builders take the contract address in STRKEY form ("C…") — hex ids are rejected
// ("Unsupported address type"). Normalize before building any invoke.
function toContractStrkey(contractId) {
  if (typeof contractId !== "string") return contractId;
  const h = contractId.startsWith("0x") ? contractId.slice(2) : contractId;
  if (!/^[0-9a-fA-F]{64}$/.test(h)) return contractId;
  try { return StrKey.encodeContract(Buffer.from(h, "hex")); } catch { return contractId; }
}

async function sendAndPoll(rpcServer, net, tx, keypair, label, solvencyGate = null) {
  const inter = INFRA[net];
  // Transient-network retry (preparation phase ONLY): prepareTransaction + sign may
  // hit a brief connection failure (undici "fetch failed", measured 2026-11-08
  // mid-rehearsal on the first commit). Nothing has been submitted at this point,
  // so a retry re-prepares the SAME reserved sequence slot — the bookkeeping stays
  // exact. HostError is a deterministic host verdict and is NEVER retried; a throw
  // from sendTransaction itself is NOT retried (may-or-may-not-have-landed
  // ambiguity — fail-closed instead of risking a double-send).
  const isTransient = (e) => {
    const m = String((e && e.message) || e);
    if (/HostError/i.test(m)) return false;
    return /fetch failed|ConnectTimeout|UND_ERR|ENOTFOUND|ECONNRESET|ECONNREFUSED|ETIMEDOUT|network/i.test(m);
  };
  let prepared = null;
  let prepErr = null;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      prepared = await rpcServer.prepareTransaction(tx);
      prepared.sign(keypair);
      prepErr = null;
      break;
    } catch (e) {
      prepErr = e;
      if (!isTransient(e)) throw e;
      if (attempt < 2) { console.log(`${label}: transient preparation failure (${String((e && e.message) || e)}) — retrying once (nothing submitted)`); await sleep(3000); }
    }
  }
  if (prepErr || !prepared) throw prepErr;
  // Fee-solvency gate (fail-closed, BEFORE any submission): prepareTransaction has finalized
  // the tx's declared fee from its own simulation. The ledger refuses a tx whose fee would
  // leave the paying account below its minimum balance (txInsufficientBalance); catching that
  // locally yields a coded, zero-submission refusal instead of a blind wire reject - measured
  // 2026-11-10 when the priced fee 130861110 stroops exceeded the funded 35069800 stroops
  // balance. The balance snapshot is the preflight read (read-only); between it and here only
  // this run's own writes can move the account, and the create step re-bases the snapshot with
  // the upload's actually-charged fee before its own check.
  if (solvencyGate) {
    const solvency = evaluateFeeSolvency({ feeStroops: prepared.fee, balanceStroops: solvencyGate.balanceStroops, minReserveStroops: solvencyGate.minReserveStroops });
    if (solvency.state !== "ALLOWED") {
      // Nothing was submitted, so no sequence slot was consumed on-chain; the run aborts right
      // after the caller records this refusal, and every run re-reads the live sequence from
      // the wire at startup before building anything.
      return { step: label, state: "REJECTED", rejectFace: "PRE_SEND_SOLVENCY", error: solvency.error };
    }
  }
  // SDK 17.4+ (RpcServer.sendTransaction): the wire param must be the signed Transaction object —
  // the client calls transaction.toXdr() internally, so a raw base64 string has no such method and
  // crashes (measured: testnet rehearsal died in _sendTransaction on the first submission).
  const res = await rpcServer.sendTransaction(prepared);
  if (!res || !res.hash || (res.status && res.status !== "PENDING")) {
    return { step: label, state: "REJECTED", error: diagnostic(res) };
  }
  for (let i = 0; i < 60; i++) { // 60 x 2s
    await sleep(2000);
    let g = null;
    try { g = await rpcServer.getTransaction(res.hash); } catch { continue; }
    if (g && g.status === "SUCCESS") {
      const hz = await horizonTxRaw(inter.horizon, res.hash);
      return {
        step: label, state: "INVOKED", hash: res.hash,
        ledger: hz.ledger ?? null, feeCharged: hz.feeCharged ?? null,
        horizonRaw: hz.raw ?? null,
        resultXdrB64: xdrB64(g.resultXdr),
        metaB64: xdrB64(g.resultMetaXdr),
      };
    }
    if (g && g.status === "FAILED") {
      const hz = await horizonTxRaw(inter.horizon, res.hash);
      return {
        step: label, state: "FAILED", hash: res.hash,
        error: `tx FAILED on-chain; resultXdr=${typeof g.resultXdr === "string" ? g.resultXdr : "(undecodable)"}; horizon=${JSON.stringify(hz.raw ?? hz)}`,
      };
    }
  }
  return { step: label, state: "TIMEOUT", hash: res.hash, error: "getTransaction never left NOT_FOUND within the polling window" };
}

function diagnostic(res) {
  // SDK 17.4 raw sendTransaction parses errorResultXdr into a TYPED `errorResult`
  // (TransactionResult object) and DELETES the raw string field — so read both
  // faces. Include the base64 result bytes (machine-readable) + a decoded
  // transaction/op code chain (human-readable) when decodable.
  try {
    const parts = { status: res && res.status, hash: (res && res.hash) || null };
    const er = res && (res.errorResultXdr || res.errorResult) || null;
    let b64 = null;
    if (typeof er === "string") b64 = er;
    else if (er && typeof er.toXDR === "function") b64 = er.toXDR("base64");
    else if (er && typeof er.toXdr === "function") b64 = er.toXdr("base64");
    if (b64) parts.errorResultXdr = b64;
    if (b64) {
      try {
        const tr = xdr.TransactionResult.fromXDR(b64, "base64");
        const bodyArm = tr && (tr.type || null);
        const body = tr && (tr.value !== undefined ? tr.value : tr);
        const inner = body && body.errorResultXdr !== undefined ? body.errorResultXdr : body;
        const results = inner && inner.results ? inner.results : (body && body.results) || [];
        parts.resultCode = bodyArm || null;
        parts.operationResults = results.map((r) => {
          const t = r && (r.type || null);
          const v = r && (r.value !== undefined ? r.value : r);
          const inv = v && v.invokeHostFunctionResult;
          return t && t !== 'invokeHostFunctionResultSuccess' && inv ? `op:${t}` : (t || null);
        }).filter(Boolean);
      } catch { /* keep the raw bytes only */ }
    }
    if (b64) {
      // The body-arm walk above only fills resultCode for success/failed arm shapes. A
      // sendTransaction REJECT carries a bare result-code union arm with NO operation
      // results (measured 2026-11-10: AAAA AAfMyDb////5AAAAAA== recorded resultCode null
      // before this decode existed). decodeTransactionResultCode reads the same bytes
      // through the SDK's own schema enum - name + numeric code + feeCharged - so the
      // artifact carries its own verdict instead of a hole. Fail-closed: an undecodable
      // blob keeps the raw bytes only.
      const decoded = decodeTransactionResultCode(b64);
      if (decoded.decodable) {
        parts.resultCode = decoded.name || `code ${decoded.code}`;
        parts.resultCodeNumeric = decoded.code;
        if (decoded.feeCharged != null) parts.feeCharged = decoded.feeCharged;
      }
    }
    if (res && res.diagnosticEvents && Array.isArray(res.diagnosticEvents)) {
      try { parts.diagnosticEventsXdrB64 = res.diagnosticEvents.map((d) => (typeof d === "string" ? d : (typeof d.toXDR === "function" ? d.toXDR("base64") : null))).filter(Boolean); } catch {}
    }
    return JSON.stringify(parts);
  } catch { return "(undecodable sendTransaction response)"; }
}

/* ------------------------------------------------------------------ */
/* ScVal decoding (defensive over both xdr-object and POJO shapes;     */
/* wire-proven: type/arm property + arm-named value field + SDK Address) */
/* ------------------------------------------------------------------ */

function armOf(v) { // e.g. "scvVec" | "scvBool" — xdr-object switch() OR POJO .type
  return typeof v.switch === "function" ? v.switch().name : ((v.switch && v.switch.name) || v.type);
}

/**
 * Proxy-safe member accessor. SDK 17.4 ships per-arm classes whose OWN value
 * props (`credentials`, `addressV2`, `address`, `type`, …) SHADOW the prototype
 * accessor methods — reading `entry.credentials` yielded the VALUE while the
 * legacy method-shaped read threw "e.credentials is not a function"
 * (measured against the live soroban-testnet sim face 2026-11-08). Call a
 * function member when it is declared as one and read it otherwise.
 */
function callOrProp(v, name) {
  if (v === null || v === undefined) return undefined;
  const own = v[name];
  if (own === undefined) return undefined;
  return typeof own === "function" ? own.call(v) : own;
}

function rawOf(v) { // xdr-object .value() OR POJO .value OR the arm-named field
  if (typeof v.value === "function") return v.value();
  if (v.value !== undefined) return v.value;
  const arm = armOf(v);
  if (typeof arm === "string") {
    const prop = arm.replace(/^scv/, '').charAt(0).toLowerCase() + arm.replace(/^scv/, '').slice(1);
    if (v[prop] !== undefined) return v[prop];
  }
  return undefined;
}

export function decodeAuthorizedAnchorScVal(rv) {
  let val = rv;
  try {
    if (typeof val === "string") val = xdr.ScVal.fromXDR(val, "base64");
  } catch {
    return { kind: "UNDECODABLE" };
  }
  if (!val || typeof val !== "object") return { kind: "UNDECODABLE" };
  const arm = armOf(val);
  if (arm === "scvBool") return { kind: "NONE" }; // soroban Option::None
  // Typed-sim truth (soroban-testnet live sim 2026-11-08): the host serializes
  // the AuthorizedAnchor contracttype as a scvMap keyed by symbols —
  // {hash: scvBytes 32B, owner: scvAddress(account), seq: scvU32} — the 3-field
  // vec face comes only from event payloads. Both faces stay supported.
  if (arm === "scvMap") return decodeMapStruct(val);
  if (arm === "scvVec") {
    const kids = safeVecChildren(val);
    if (kids.length === 1 && kids[0] && typeof kids[0] === "object" && armOf(kids[0]) === "scvMap") return decodeMapStruct(kids[0]);
    return decodeStruct(kids);
  }
  return { kind: "UNDECODABLE", arm };
}

function safeMapEntries(v) {
  let entries;
  try { entries = callOrProp(v, "map"); } catch { return []; }
  if (!Array.isArray(entries)) return [];
  return entries.map((row) => {
    let sym = null;
    let value = null;
    try {
      const k = callOrProp(row, "key");
      if (k && armOf(k) === "scvSymbol") {
        const x = callOrProp(k, "sym") ?? rawOf(k); // arm-named field is "sym" (rawOf's derived "symbol" is NOT the real prop name)
        const b = typeof x?.bytes === "function" ? x.bytes() : (x instanceof Uint8Array ? x : x?.bytes);
        if (b instanceof Uint8Array || (b && typeof b.length === "number" && typeof b[0] === "number")) {
          sym = Buffer.from(b).toString("ascii");
        }
      }
    } catch { /* fail-closed: the row is skipped via sym=null */ }
    try { value = callOrProp(row, "val"); } catch { value = null; }
    return { sym, value };
  });
}

function decodeMapStruct(v) {
  const rows = safeMapEntries(v);
  const byKey = {};
  for (const r of rows) { if (r.sym && byKey[r.sym] === undefined) byKey[r.sym] = r.value; }
  const keysSeen = rows.map((r) => r.sym || "<undecodable>");
  if (!Object.prototype.hasOwnProperty.call(byKey, "hash") || !Object.prototype.hasOwnProperty.call(byKey, "owner") || !Object.prototype.hasOwnProperty.call(byKey, "seq")) {
    return { kind: "UNDECODABLE", via: "map", keys: keysSeen };
  }
  const hashHex = bytes32Hex(byKey.hash);
  const owner = addressStrkey(byKey.owner);
  const seq = seqOf(byKey.seq);
  if (!hashHex || !owner || seq === null) return { kind: "UNDECODABLE", via: "map", keys: keysSeen };
  return { kind: "SOME", hashHex, owner, seq };
}

function decodeStruct(children) {
  // AuthorizedAnchor { hash, owner, seq } as a 3-field contracttype struct;
  // Some(..) may wrap one level: Option -> scvVec -> [struct scvVec].
  let kids = children;
  if (kids.length === 1 && kids[0] && typeof kids[0] === "object" && armOf(kids[0]) === "scvVec") kids = safeVecChildren(kids[0]);
  if (kids.length !== 3) return { kind: "UNDECODABLE", len: kids.length };
  const hashHex = bytes32Hex(kids[0]);
  const owner = addressStrkey(kids[1]);
  const seq = seqOf(kids[2]);
  if (!hashHex || !owner || seq === null) return { kind: "UNDECODABLE" };
  return { kind: "SOME", hashHex, owner, seq };
}

function safeVecChildren(v) {
  try {
    const arr = rawOf(v);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function bytesPayload(b) {
  // bytes payloads observed as ScBytes POJOs ({value: bytes}) or U8s/hexstrs.
  const x = b && typeof b === "object" && !(b instanceof Uint8Array) && b.value !== undefined ? b.value : b;
  if (x instanceof Uint8Array) return Buffer.from(x);
  if (typeof x === "string") return Buffer.from(x, "hex");
  if (x && typeof x.length === "number" && typeof x[0] === "number") return Buffer.from(x);
  return null;
}

function bytes32Hex(v) {
  try {
    if (armOf(v) !== "scvBytes") return null;
    const buf = bytesPayload(rawOf(v));
    return buf && buf.length === 32 ? buf.toString("hex") : null;
  } catch { return null; }
}

function addressStrkey(v) {
  try {
    if (armOf(v) !== "scvAddress") return null;
    // SDK-certified decode (roundtrip-proven against the same module):
    return Address.fromScVal(v).toString();
  } catch { return null; }
}

function seqOf(v) {
  try {
    if (armOf(v) !== "scvU32") return null;
    const n = rawOf(v);
    const num = typeof n === "function" ? Number(n()) : Number(n);
    return Number.isSafeInteger(num) ? num : null;
  } catch { return null; }
}

/* ------------------------------------------------------------------ */
/* Artifact I/O                                                        */
/* ------------------------------------------------------------------ */

async function readArtifactFile(rel) {
  const p = join(ROOT, rel);
  if (!existsSync(p)) return null;
  try { return JSON.parse(await readFile(p, "utf8")); } catch { return null; }
}

function alreadyDeployedMessage(net, wasmSha, prior, reason) {
  const lines = [`ALREADY-DEPLOYED BRANCH (exit 4) — refusing to double-charge (${reason}).`, `     this run wasm sha256: ${wasmSha}`];
  if (prior && prior.wasm && prior.wasm.sha256 === wasmSha && prior.contractId) {
    lines.push(`     existing artifact ${ARTIFACT_OUT[net]} already records the SAME material deployed at contract ${prior.contractId}`);
    lines.push(`     done — inspect that instance instead of redeploying (the deterministic salt lands at the same address)`);
  } else if (prior) {
    lines.push(`     the prior ${net} artifact exists but pins a DIFFERENT material (its sha256: ${prior.wasm && prior.wasm.sha256}) — forking scope is refused without an owner decision`);
  } else {
    lines.push(`     no prior ${net} artifact holds this material; inspect the run's steps above (the upload/create txs are recorded there) before any retry`);
  }
  return lines.join("\n");
}

function baseArtifact({ net, decisions, manifest, wasmSha256, wasmBytesLen, deployer, fee, saltHex }) {
  return {
    schema: "CoreGuard-Evidence/1",
    artifact: "stellar-soroban-authorized-deploy",
    version: "SOROBAN-AUTHORIZED-DEPLOY/1",
    executedBy: "scripts/stellar-soroban-authorized-deploy.mjs",
    network: net === "mainnet" ? "stellar-mainnet" : "stellar-testnet",
    decisionDoc: DECISIONS_DOC_REL,
    decisionMarker: DECISION_MARKER,
    ownerAuthorized: net === "mainnet",
    walletFile: WALLET_FILE_REL,
    deployer,
    laneWrites: net === "mainnet" ? "NONE" : "REHEARSED_ON_TESTNET",
    contractSource: "soroban/commitment-anchor (no constructor)",
    wasm: {
      sha256: wasmSha256,
      bytes: wasmBytesLen,
      artifactName: net === "mainnet" ? (manifest ? manifest.artifactName : null) : "explicit --wasm-path (rehearsal material)",
      runId: manifest ? manifest.runId : null,
      headSha: manifest ? manifest.headSha : null,
    },
    saltPolicy: "deterministic sha256(deployer : wasmSha256) — packages/stellar-soroban deriveSalt",
    saltHex,
    fee: { requested: fee, policy: net === "mainnet" ? `>= ${MAINNET_FEE_FLOOR} stroops and >= 1.5x rehearsal max when a rehearsal artifact exists` : "testnet default; generous, never a mainnet decision" },
    steps: [],
    rehearsal: null,
    readback: null,
    summary: { contractId: null, deployed: false, verdict: null },
  };
}

function finalizeVerdict(artifact) {
  // A verdict must never lie about its own steps (the false-green class): the committed
  // 2026-11-09 mainnet artifact recorded steps [<upload(wasm)> REJECTED] with deployed:false
  // while its summary STILL read the full DEPLOY_VERDICT string, silently, because the
  // failure was computed here and then never applied. A REJECTED/FAILED/TIMEOUT step (the
  // network faces sendAndPoll returns on a dead tx) or an ok:false record always downgrades.
  // EXPECTED-state names stay allowed (IDEMPOTENT/OK/REFUSED/SIMULATED_NONE/SKIP) so a green
  // rehearsal/replay keeps its exact verdict.
  const failed = (artifact.steps || []).some((s) => s.ok === false || s.state === "REJECTED" || s.state === "FAILED" || s.state === "TIMEOUT");
  if (failed) artifact.summary.verdict = "NOT_CONFIRMED — one or more steps failed their expected state (fail-closed; inspect steps)";
  else if (artifact.network === "stellar-mainnet") {
    if (artifact.laneWrites !== "NONE" || artifact.rehearsal) artifact.summary.verdict = "NOT_CONFIRMED — a mainnet run must stay deploy-only";
    else artifact.summary.verdict = DEPLOY_VERDICT;
  } else if (artifact.rehearsal) {
    if (artifact.rehearsal.invariants && artifact.rehearsal.invariants.some((i) => i.ok === false)) artifact.summary.verdict = "NOT_CONFIRMED — a rehearsal invariant failed (fail-closed)";
    else artifact.summary.verdict = REHEARSAL_VERDICT;
  } else {
    artifact.summary.verdict = "NOT_CONFIRMED — testnet run without rehearsal exercise (--rehearse absent)";
  }
  return artifact;
}

/* ------------------------------------------------------------------ */
/* Resume path: wire-only instance-address resolution                  */
/* ------------------------------------------------------------------ */
/* A deterministic-salt re-run refuses a fresh create pre-submission   */
/* with HostError ExistingValue, so that run holds NO result meta of   */
/* its own to parse. The resumed run must therefore discover the       */
/* EXISTING instance address FROM THE WIRE, never from a local         */
/* derivation: sha256(ContractIDPreimage) does not reproduce the host  */
/* contract id (measured) and the known-answer vector id (owner+hash)  */
/* is the IN-CONTRACT COMMIT id, not a contract address — conflating   */
/* them sent the first rehearsal against a non-existing instance       */
/* (HostError Storage/MissingValue).                                   */
/* Resolution: walk this wallet's Horizon tx history (public key       */
/* only — no secrets travel), read each tx's Soroban result meta from  */
/* the RPC wire, and collect the contractData-instance entries that    */
/* carry the pinned wasm sha256 as their executable. Identity is then  */
/* re-proven by reading the LIVE instance entry back on the RPC wire.  */
/* Fail-closed on ambiguity, absence or unreadable wire.               */

export async function resolveExistingInstance({ net, publicKey, wasmSha256Hex, maxPages = 4 } = {}) {
  const FAIL = (state, error) => ({ state, error, contractId: null });
  if (!publicKey || !wasmSha256Hex) return FAIL("GATED", "publicKey + wasmSha256Hex required");
  const infra = INFRA[net];
  if (!infra || !infra.horizon || !infra.rpc) return FAIL("GATED", "network has no horizon/rpc wire");
  try {
    const seen = new Set();
    let url = `${infra.horizon}/accounts/${encodeURIComponent(publicKey)}/transactions?limit=100&order=desc`;
    let pages = 0;
    while (url && pages < maxPages) {
      pages += 1;
      const res = await fetch(url, { headers: { accept: "application/json" } });
      if (!res.ok) return FAIL("WIRE_ERROR", `horizon account txs HTTP ${res.status}`);
      const page = await res.json();
      const records = (((page || {})._embedded || {}).records) || [];
      const matches = [];
      for (const rec of records) {
        const hash = rec && rec.hash;
        if (!hash || seen.has(hash)) continue;
        seen.add(hash);
        if (rec.successful !== true) continue; // failed txs never created anything
        // Read the tx meta from the RPC wire, never from Horizon (whose
        // /transactions record omits result_meta_xdr — measured).
        const metaRes = await fetch(infra.rpc, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getTransaction", params: { hash } }) });
        if (!metaRes.ok) continue;
        const metaBody = await metaRes.json().catch(() => null);
        const metaB64 = metaBody && metaBody.result && metaBody.result.resultMetaXdr;
        if (typeof metaB64 !== "string") continue;
        let meta = null;
        try { meta = xdr.TransactionMeta.fromXDR(metaB64, "base64"); } catch { continue; }
        const arm = meta && meta.type && meta[meta.type];
        const opsMeta = arm && arm.operations;
        if (!opsMeta) continue;
        for (const om of opsMeta) {
          let changes = [];
          try { changes = typeof om.changes === "function" ? om.changes() : om.changes || []; } catch { changes = []; }
          for (const change of changes) {
            const kind = String(change && change.type);
            const entry = kind === "ledgerEntryCreated" ? change.created : kind === "ledgerEntryUpdated" ? change.updated : null;
            const data = entry && entry.data;
            if (!data || data.type !== "contractData") continue;
            const cd = data.contractData;
            if (!cd || !cd.key || cd.key.type !== "scvLedgerKeyContractInstance") continue;
            const cidHolder = cd.contract && cd.contract.contractId;
            const raw = cidHolder && (cidHolder.value !== undefined ? cidHolder.value : cidHolder);
            const bytes = raw instanceof Uint8Array ? Buffer.from(raw) : Buffer.isBuffer(raw) ? raw : null;
            if (!bytes || bytes.length !== 32) continue;
            const instV = cd.val;
            const instance = instV && (instV.instance || (instV.contractInstance && instV.contractInstance) );
            const exec = instance && instance.executable;
            const exHash = exec && exec.wasmHash && (exec.wasmHash.value !== undefined ? exec.wasmHash.value : exec.wasmHash);
            const exHex = exHash && (exHash instanceof Uint8Array || Buffer.isBuffer(exHash)) ? Buffer.from(exHash).toString("hex") : null;
            if (!exHex) continue;
            if (exHex !== wasmSha256Hex) continue; // different material — never our instance
            matches.push({ contractId: StrKey.encodeContract(bytes), execWasmHashHex: exHex, lastModifiedLedgerSeq: entry.lastModifiedLedgerSeq || null, txHash: hash });
          }
        }
      }
      if (matches.length > 1) return FAIL("AMBIGUOUS", `${matches.length} instance entries match this executable — refusing to guess`);
      if (matches.length === 1) {
        const m0 = matches[0];
        // Second identity proof: read the LIVE instance entry back from the RPC wire.
        let bytes = null;
        try { const d = StrKey.decodeContract(m0.contractId); bytes = Buffer.from(d); } catch { bytes = null; }
        if (!bytes || bytes.length !== 32) return FAIL("WIRE_ERROR", "resolved contractId undecodable");
        const liveKey = xdr.LedgerKey.contractData(new xdr.LedgerKeyContractData({
          contract: xdr.ScAddress.scAddressTypeContract(new xdr.ContractId(bytes)),
          key: xdr.ScVal.scvLedgerKeyContractInstance(),
          durability: xdr.ContractDataDurability.persistent,
        })).toXDR("base64");
        const liveRes = await fetch(infra.rpc, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getLedgerEntries", params: { keys: [liveKey] } }) });
        if (!liveRes.ok) return FAIL("WIRE_ERROR", `getLedgerEntries HTTP ${liveRes.status}`);
        const liveBody = await liveRes.json().catch(() => null);
        const entries = liveBody && liveBody.result && Array.isArray(liveBody.result.entries) ? liveBody.result.entries : [];
        let liveExecHex = null;
        let liveLast = null;
        for (const ent of entries) {
          try {
            const row = xdr.LedgerEntryData.fromXDR(ent.xdr || ent.data, "base64");
            const rowCd = row.contractData;
            const rowInst = rowCd.val && (rowCd.val.instance || rowCd.val.contractInstance);
            const rowEx = rowInst && rowInst.executable && rowInst.executable.wasmHash && rowInst.executable.wasmHash.value;
            if (rowEx) { liveExecHex = Buffer.from(rowEx).toString("hex"); liveLast = ent.lastModifiedLedgerSeq || null; }
          } catch { /* fallthrough */ }
        }
        if (liveExecHex !== wasmSha256Hex) return FAIL("WIRE_ERROR", `instance ${m0.contractId} not live with this executable (row exec ${liveExecHex || "undecodable"})`);
        return { state: "RESOLVED", contractId: m0.contractId, execWasmHashHex: liveExecHex, lastModifiedLedgerSeq: liveLast || m0.lastModifiedLedgerSeq, source: `horizon-account-txs + rpc meta ${m0.txHash.slice(0, 12)}…` };
      }
      const link = (page || {})._links;
      url = link && link.next && link.next.href ? link.next.href : null;
    }
    return FAIL("NOT_FOUND", `no successful tx of ${publicKey} created an instance with executable ${wasmSha256Hex.slice(0, 12)}… within ${maxPages} page(s)`);
  } catch (e) {
    return FAIL("WIRE_ERROR", (e && e.message) || String(e));
  }
}

/* ------------------------------------------------------------------ */
/* Rehearsal (testnet only, --rehearse)                                */
/* ------------------------------------------------------------------ */

/** SIMULATION-ONLY probe: no sign, no submit, by construction. */
async function refusalProbe(rpcServer, built, probeName) {
  if (!built || built.state !== "BUILD_OK") {
    return { probe: probeName, state: "BUILD_GATED", ok: false, error: built && built.error ? built.error : "no build returned" };
  }
  let sim;
  try { sim = await rpcServer.simulateTransaction(built.tx); }
  catch (e) { return { probe: probeName, state: "REFUSED", ok: true, error: `simulation threw: ${e && e.message}`, submitted: false }; }
  if (sim && sim.error) {
    const shapeOk = /Auth|Contract/.test(sim.error);
    return { probe: probeName, state: "REFUSED", ok: shapeOk, shapeOk, error: sim.error, submitted: false };
  }
  return { probe: probeName, state: "NOT_REFUSED", ok: false, error: "a probe that must refuse DID NOT refuse — fail-closed violation", submitted: false };
}

/**
 * SDK 17.4 simulateTransaction returns the PARSED face — measured live keys
 * `_parsed, id, latestLedger, events, transactionData, minResourceFee, result,
 * stateChanges` — where `result` is the SINGULAR SimulateHostFunctionResult
 * `{ auth, retval }` (api.d.ts 476/486; parsers.js coalesces the raw plural
 * `results: RawSimulateHostFunctionResult[] { auth?: string[], xdr }` into it).
 * The runner read `sim.results[0].retval`, which EXISTS on no live face, so
 * every singular Parsed retval read null and the readback/idempotency
 * invariants collapsed to UNDECODABLE/NOT_IDEMPOTENT (measured 2026-11-08).
 * Fail-closed: the raw face is still honored as a fallback; neither face
 * may silently decode to nothing.
 */
function simResultFace(sim) {
  if (!sim || typeof sim !== "object") return null;
  if (sim.result && sim.result.retval !== undefined && sim.result.retval !== null) {
    return { face: "parsed", retval: sim.result.retval, auth: Array.isArray(sim.result.auth) ? sim.result.auth : [] };
  }
  if (Array.isArray(sim.results) && sim.results.length > 0) {
    const row = sim.results[0];
    // Raw face retval is the base64 XDR STRING (decoder accepts it directly).
    return { face: "raw", retval: row.xdr !== undefined && row.xdr !== null ? row.xdr : row.retval ?? null, auth: Array.isArray(row.auth) ? row.auth : [] };
  }
  return null;
}

/**
 * SIMULATION-ONLY wrong-owner probe with the measured honest refusal shape:
 * Soroban simulation auto-grants require_auth (record mode executes as if
 * authorized), so "the sim must throw" is FALSE on the wire. The sim-only
 * refusal proof is instead WHERE the recorded auth binds: commit_authorized
 * calls require_auth on the OWNER argument, so the recorded credential is an
 * ADDRESS credential naming the OWNER — regardless of who the tx source is.
 * The attacker cannot produce that signature at submission (txBadAuth), so the
 * attack is refused without submitting anything.
 * Fail-closed: REFUSED ONLY IF at least one auth entry is recorded AND every
 * entry is an ACCOUNT credential naming the OWNER; any source-account-style,
 * attacker-named, contract-named or undecodable entry or an empty auth list is
 * NOT_REFUSED.
 */
async function authBindingProbe(rpcServer, built, probeName, ownerPubkey, attackerPubkey) {
  if (!built || built.state !== "BUILD_OK") {
    return { probe: probeName, state: "BUILD_GATED", ok: false, error: built && built.error ? built.error : "no build returned" };
  }
  let sim;
  try { sim = await rpcServer.simulateTransaction(built.tx); }
  catch (e) { return { probe: probeName, state: "REFUSED", ok: true, error: `simulation threw: ${e && e.message}`, submitted: false }; }
  if (sim && sim.error) {
    const shapeOk = /Auth|Contract/.test(sim.error);
    return { probe: probeName, state: "REFUSED", ok: shapeOk, shapeOk, error: sim.error, submitted: false };
  }
  const face = simResultFace(sim);
  if (!face || !Array.isArray(face.auth) || face.auth.length === 0) {
    return { probe: probeName, state: "NOT_REFUSED", ok: false, submitted: false, authEntries: [],
      error: "sim succeeded with NO recorded auth entries — nothing binds the operation to the owner, so no refusal is proven" };
  }
  const detailOf = (entry) => {
    let e = entry;
    try {
      if (typeof e === "string") e = xdr.SorobanAuthorizationEntry.fromXDR(e, "base64");
    } catch (err) { return { kind: "UNDECODABLE", error: err && err.message }; }
    try {
      // Own props shadow prototype accessor methods on this SDK's per-arm
      // classes (measured: "e.credentials is not a function") — callOrProp.
      const cred = callOrProp(e, "credentials");
      if (cred === null || cred === undefined) return { kind: "UNDECODABLE", error: "no credentials" };
      const credArm = armOf(cred);
      if (credArm === "sorobanCredentialsSourceAccount") return { kind: "SOURCE_ACCOUNT" };
      if (credArm !== "sorobanCredentialsAddress" && credArm !== "sorobanCredentialsAddressV2") return { kind: `OTHER:${credArm}` };
      // V2 wraps the address in addressV2; V1 keeps it on the credential itself.
      const container = credArm === "sorobanCredentialsAddressV2" ? callOrProp(cred, "addressV2") : cred;
      const addr = callOrProp(container, "address");
      if (addr === null || addr === undefined) return { kind: "UNDECODABLE", error: "no address" };
      const addrArm = armOf(addr);
      if (addrArm === "scAddressTypeAccount") return { kind: "ACCOUNT", strkey: Address.fromScAddress(addr).toString() };
      if (addrArm === "scAddressTypeContract") return { kind: "CONTRACT" };
      return { kind: `OTHER:${addrArm}` };
    } catch (err) { return { kind: "UNDECODABLE", error: err && err.message }; }
  };
  const authEntries = face.auth.map(detailOf);
  // Empty strkey (undefined) can never equal ownerPubkey, so Other/undecodable
  // shapes fail-closed through the same every() below without a special case.
  const refused = authEntries.length > 0 && authEntries.every((d) => d.kind === "ACCOUNT" && d.strkey === ownerPubkey);
  return {
    probe: probeName,
    state: refused ? "REFUSED" : "NOT_REFUSED",
    ok: refused,
    submitted: false,
    authEntries,
    criterion: "sim-only: require_auth recorded against the OWNER address only — the tx source cannot satisfy that credential (txBadAuth at submission); nothing was submitted",
    ...(refused ? { note: `auth bound to the owner (${ownerPubkey.slice(0, 8)}…), source is the attacker (${attackerPubkey.slice(0, 8)}…)` }
                : { error: "recorded auth is not bound to the owner only — fail-closed violation" }),
  };
}

/** read_authorized simulation in one call (read-only; no sign/submit). */
async function readbackSim(rpcServer, net, contractId, publicKey, fee, sequence, readTargetId) {
  if (!contractId) return { fn: "read_authorized", state: "SKIPPED", reason: "no contract id available" };
  const built = buildInvokeTx({
    contractId: toContractStrkey(contractId), functionName: "read_authorized", source: publicKey,
    sequence: String(sequence), commitmentId: readTargetId,
    network: net, fee, ownerAuthorization: net === "mainnet",
  });
  if (built.state !== "BUILD_OK") return { fn: "read_authorized", state: "GATED", reason: built.error };
  let sim;
  try { sim = await rpcServer.simulateTransaction(built.tx); }
  catch (e) { return { fn: "read_authorized", state: "SIM_ERROR", submitted: false, error: e && e.message }; }
  if (sim && sim.error) return { fn: "read_authorized", state: "SIM_ERROR", submitted: false, error: sim.error };
  const face = simResultFace(sim);
  const dec = decodeAuthorizedAnchorScVal(face ? face.retval : null);
  return {
    fn: "read_authorized", state: dec.kind === "NONE" ? "SIMULATED_NONE" : dec.kind === "SOME" ? "SIMULATED_SOME" : "UNDECODABLE",
    submitted: false, readTargetId, simFace: face ? face.face : "none",
    decoded: dec.kind === "SOME" ? { kind: "SOME", hashHex: dec.hashHex, owner: dec.owner, seq: dec.seq } : dec,
  };
}

async function runRehearsal({ rpcServer, net, contractId, publicKey, keypair, fee, seqCounter }) {
  const vector = {};
  const steps = [];
  const cstr = toContractStrkey(contractId);
  // (0) The mirror MUST derive the pinned id for THIS wallet's public key.
  const derived = deriveAuthorizedAnchorId({ owner: publicKey, hash: KNOWN_VECTOR.hash });
  vector.mirrorDerivation = derived.id;
  vector.pinnedKnownAnswer = KNOWN_VECTOR.id;
  vector.ownerIsWallet = publicKey === KNOWN_VECTOR.owner;
  if (derived.state !== "DERIVED" || derived.id !== KNOWN_VECTOR.id || vector.ownerIsWallet !== true) {
    throw new Fail(`known-answer vector cross-check FAILED (mirror ${derived.id} vs pinned ${KNOWN_VECTOR.id}; walletIsVectorOwner=${vector.ownerIsWallet})`);
  }
  // (1) The one REAL authorized-lane write (testnet): owner commit on the vector.
  const commit1 = buildInvokeTx({
    contractId: cstr, functionName: "commit_authorized", source: publicKey,
    sequence: String(seqCounter.value), commitmentHash: KNOWN_VECTOR.hash,
    owner: publicKey, network: net, fee, ownerAuthorization: false,
  });
  if (commit1.state !== "BUILD_OK") throw new Fail(`commit build gated: ${commit1.error}`, []);
  seqCounter.value += 1n;
  steps.push(await sendAndPoll(rpcServer, net, commit1.tx, keypair, "commit_authorized(vector)"));
  if (steps[steps.length - 1].state !== "INVOKED") {
    const s0 = steps[steps.length - 1];
    throw new Fail(`owner commit_authorized did not reach INVOKED (state: ${s0.state}; diagnostic: ${s0.error || s0.horizonRaw ? JSON.stringify({ state: s0.state, error: s0.error || null, horizon: s0.horizonRaw || null, txHash: s0.hash || null }) : "none"})`, steps);
  }
  // (2) Idempotent replay — same (owner, hash) returns the SAME ledger seq.
  // Simulations consume NO on-chain sequence: only a LANDED tx advances seqCounter
  // (bumping on sims built commit2 one slot ahead of the chain — the same
  // txBAD_SEQ (-5) class as the create-resume release above).
  const rb1 = await readbackSim(rpcServer, net, contractId, publicKey, fee, seqCounter.value, KNOWN_VECTOR.id);
  const seqA = (rb1.decoded && rb1.decoded.seq) || null;
  steps.push({ step: "readback(after-commit1)", ...rb1 });
  const commit2 = buildInvokeTx({
    contractId: cstr, functionName: "commit_authorized", source: publicKey,
    sequence: String(seqCounter.value), commitmentHash: KNOWN_VECTOR.hash,
    owner: publicKey, network: net, fee, ownerAuthorization: false,
  });
  if (commit2.state !== "BUILD_OK") throw new Fail(`replay build gated: ${commit2.error}`, steps);
  seqCounter.value += 1n;
  steps.push(await sendAndPoll(rpcServer, net, commit2.tx, keypair, "commit_authorized(replay)"));
  const rb2 = await readbackSim(rpcServer, net, contractId, publicKey, fee, seqCounter.value, KNOWN_VECTOR.id);
  const seqB = (rb2.decoded && rb2.decoded.seq) || null;
  steps.push({
    step: "commit_authorized(replay):idempotent",
    state: seqA !== null && seqA === seqB ? "IDEMPOTENT" : "NOT_IDEMPOTENT",
    ok: seqA !== null && seqA === seqB, ledgerSeq: seqB,
  });
  steps.push({ step: "readback(after-replay)", ...rb2 });
  // (3) Wrong-owner probe: EPHEMERAL testnet-only key, never for mainnet.
  const attacker = Keypair.random();
  const attackerFund = await friendbotFund("testnet", attacker.publicKey());
  const attackerProbe = await authBindingProbe(
    rpcServer,
    buildInvokeTx({
      contractId: cstr, functionName: "commit_authorized", source: attacker.publicKey(),
      sequence: "1", commitmentHash: KNOWN_VECTOR.hash, owner: publicKey,
      network: net, fee, ownerAuthorization: false,
    }),
    "commit_authorized(wrong-owner)",
    publicKey,
    attacker.publicKey(),
  );
  steps.push({ step: "probe:commit_authorized(wrong-owner)", ...attackerProbe, fundState: attackerFund.state, ephemeralKeySubmission: false });
  // (4) Mismatch probe: correct id + wrong hash -> the contract must refuse.
  const mismatch = await refusalProbe(
    rpcServer,
    buildInvokeTx({
      contractId: cstr, functionName: "assert_anchored_authorized", source: publicKey,
      sequence: String(seqCounter.value), commitmentId: KNOWN_VECTOR.id,
      commitmentHash: WRONG_HASH, owner: publicKey, network: net, fee,
      ownerAuthorization: false,
    }),
    "assert_anchored_authorized(hash-mismatch)",
  );
  steps.push({ step: "probe:assert_anchored_authorized(wrong-hash)", ...mismatch });
  const invariants = [
    { name: "commit reached INVOKED", ok: steps[0].state === "INVOKED" },
    { name: "replay idempotent (same ledger seq)", ok: seqA !== null && seqA === seqB },
    { name: "wrong-owner probe refused", ok: attackerProbe.ok === true },
    { name: "hash-mismatch probe refused", ok: mismatch.ok === true },
    {
      name: "readback after replay shows the pinned (hash, owner)",
      ok: (() => {
        const rb = steps.find((s) => s.step === "readback(after-replay)");
        const pin = KNOWN_VECTOR.hash.replace(/^0x/, "");
        return Boolean(rb && rb.decoded && rb.decoded.kind === "SOME" && rb.decoded.owner === publicKey && rb.decoded.hashHex === pin);
      })(),
    },
  ];
  return { steps, vector, committedSeq: seqA, replayedSeq: seqB, invariants, note: "commit_authorized + replay were the ONLY authorized-lane writes, performed on testnet with --rehearse; both refusal probes are simulation-only and never submitted" };
}

export async function friendbotFund(net, publicKey) {
  const url = INFRA[net] && INFRA[net].friendbot;
  if (!url) return { state: "NO_FRIENDBOT", error: `${net} has no friendbot; funding from any other surface is out of scope and refused` };
  try {
    const res = await fetch(`${url}?addr=${encodeURIComponent(publicKey)}`);
    return { state: res.ok ? "FUNDED" : "UNFUNDED", httpStatus: res.status };
  } catch (e) {
    return { state: "UNFUNDED", error: (e && e.message) || "friendbot call failed" };
  }
}

/* ------------------------------------------------------------------ */
/* Main                                                               */
/* ------------------------------------------------------------------ */

export async function main(argv) {
  MAINNET.decisions = null;
  const plan = parsePlan(argv);
  if (plan.verify) return verifyMode(plan);
  if (plan.unknownFlags.length) {
    console.error(
      "USAGE:\n" +
      "  node scripts/stellar-soroban-authorized-deploy.mjs --network testnet --wasm-path <file> [--rehearse] [--fee <stroops>]\n" +
      "  node scripts/stellar-soroban-authorized-deploy.mjs --network mainnet --owner-authorized --wasm-path <file> --wasm-manifest <manifest.json> --fee <stroops>\n" +
      "  node scripts/stellar-soroban-authorized-deploy.mjs --network <net> --verify",
    );
    return 2;
  }
  const pv = planViolations(plan);
  if (pv.length) { console.error(`PLAN REFUSED:\n  ${pv.join("\n  ")}`); return 2; }
  const net = plan.network;

  // Material: EXPLICIT --wasm-path only; the artifact records exactly these bytes.
  if (!plan.wasmPath || !existsSync(plan.wasmPath)) {
    console.error(`--wasm-path must name an existing wasm file (got ${JSON.stringify(plan.wasmPath)})`);
    return 2;
  }
  const wasmBytes = await readFile(plan.wasmPath);
  const wasmSha256 = sha256Hex(wasmBytes);

  let manifest = null;
  if (plan.manifestPath) {
    try {
      manifest = JSON.parse(await readFile(plan.manifestPath, "utf8"));
    } catch {
      console.error("wasm manifest unreadable (JSON) — deploy refused");
      return 1;
    }
  }

  // Wallet: the key holder's own file; its secret material stays in-process.
  let wallet;
  try { wallet = await loadWallet(); }
  catch (e) { console.error((e && e.message) || "wallet load failed"); return 1; }
  const { keypair, publicKey } = wallet;

  let balStroops = null; // exact stroop-parsed preflight balance (null outside mainnet)
  if (net === "mainnet") {
    const decisions = parseDecisionDoc(await readFile(join(ROOT, DECISIONS_DOC_REL), "utf8").catch(() => ""));
    const rehearsalArtifact = await readArtifactFile(ARTIFACT_OUT.testnet);
    const rehearsalPassed = rehearsalArtifact && !String(rehearsalArtifact.summary && rehearsalArtifact.summary.verdict).startsWith("NOT_CONFIRMED") ? rehearsalArtifact : null;
    const fee = plan.fee;
    const rmax = rehearsalArtifact && rehearsalArtifact.steps
      ? rehearsalArtifact.steps.reduce((m, s) => (s.state === "INVOKED" && Number.isInteger(s.feeCharged) && s.feeCharged > m ? s.feeCharged : m), 0)
      : null;
    const all = [
      ...rehearsalGate(rehearsalPassed),
      ...mainnetGateViolations({ plan, decisions, manifest, wasmSha256 }),
      ...mainnetFeeViolations({ fee, rehearsalMaxFee: rmax }),
    ];
    if (all.length) { console.error(`MAINNET REFUSED (owner gates, fail-closed):\n  ${all.join("\n  ")}`); return 3; }
    const meta = await nativeAccountMeta(net, publicKey);
    const nativeXlm = meta === null ? null : meta.balance;
    if (meta === null || Number(nativeXlm) < MAINNET_BALANCE_MIN_XLM) {
      console.error(`BALANCE PREFLIGHT FAILED (read-only): native ${nativeXlm === null ? "(unavailable)" : nativeXlm} XLM for ${publicKey} — requires >= ${MAINNET_BALANCE_MIN_XLM} XLM`);
      return 7;
    }
    // Exact stroop parse (never float math on money) + the PER-ACCOUNT minimum balance the
    // ledger will actually enforce (subentries raise it above the single-entry floor - the
    // funded deployer carries a USDC trustline, so its exact minimum is 1.5 XLM, not 1.0).
    const balStroops = xlmStringToStroops(nativeXlm);
    if (balStroops === null) {
      console.error(`BALANCE PREFLIGHT FAILED (read-only): unreadable balance string ${JSON.stringify(nativeXlm)}`);
      return 7;
    }
    const exactMin = exactMinBalanceStroops({
      baseReserveStroops: MAINNET_BASE_RESERVE_STROOPS,
      subentryCount: meta.subentryCount,
      numSponsored: meta.numSponsored,
      numSponsoring: meta.numSponsoring,
    });
    const minBalanceStroops = exactMin === null ? MAINNET_MIN_BALANCE_STROOPS : exactMin;
    console.log(`balance preflight (read-only): native ${nativeXlm} XLM · subentries ${meta.subentryCount} · minimum balance ${minBalanceStroops} stroops (${exactMin === null ? "documented lower bound" : "exact for this account"})`);
    if (fee === null) { console.error("--fee <stroops> is required on mainnet (recorded fee policy)"); return 2; }
    MAINNET.decisions = decisions;
  }

  // Idempotency branch: never double-charge an already-recorded deploy.
  const prior = await readArtifactFile(ARTIFACT_OUT[net]);
  if (prior && prior.wasm && prior.wasm.sha256 === wasmSha256 && prior.contractId) {
    console.error(alreadyDeployedMessage(net, wasmSha256, prior, "prior artifact records the same material as deployed"));
    return 4;
  }

  const rpcServer = new RpcServer(INFRA[net].rpc);
  let seq;
  try { seq = (await accountSequence(net, publicKey)).sequence; }
  catch (e) { console.error((e && e.message) || "account sequence unavailable"); return 1; }
  const seqCounter = { value: seq };

  const artifact = baseArtifact({ net, decisions: MAINNET.decisions, manifest, wasmSha256, wasmBytesLen: wasmBytes.length, deployer: publicKey, fee: plan.fee ?? (net === "testnet" ? "1000000" : null), saltHex: deriveSalt(publicKey, wasmSha256).toString("hex") });
  artifact.fee.requested = net === "testnet" && artifact.fee.requested === null ? "1000000" : artifact.fee.requested;
  const fee = artifact.fee.requested;

  // Solvency evidence + gate wiring: the exact read-only balance and the reserve the gate
  // assumes travel IN the artifact, so any rejection carries its own arithmetic with it
  // (the deployer identity is a public key; no secret material ever reaches the file).
  // Re-bases only inside the run: the create step subtracts the upload's actually-charged
  // fee before its own gate consult.
  if (net === "mainnet") {
    artifact.deployerBalanceStroops = String(balStroops);
    artifact.minBalanceReserveStroops = String(minBalanceStroops);
    artifact.minBalanceReserveFace = exactMin === null ? "DOCUMENTED_LOWER_BOUND" : "EXACT_PER_ACCOUNT";
  }
  const solvencyGate = net === "mainnet" ? { balanceStroops: balStroops, minReserveStroops: minBalanceStroops } : null;

  // (1) UPLOAD the deploy material.
  const up = buildUploadTx({ wasm: wasmBytes, source: publicKey, sequence: String(seqCounter.value), network: net, fee, ownerAuthorization: net === "mainnet" });
  if (up.state !== "BUILD_OK") { console.error(`upload build gated: ${up.error}`); return 2; }
  seqCounter.value += 1n;
  const upRes = await sendAndPoll(rpcServer, net, up.tx, keypair, "upload(wasm)", solvencyGate);
  artifact.steps.push(upRes);
  if (upRes.state !== "INVOKED") {
    if (upRes.rejectFace === "PRE_SEND_SOLVENCY") console.error("upload(wasm): fee solvency gate refused BEFORE any submission - fund the deployer to at least (declared fee + minimum balance) and re-run; the artifact records the exact arithmetic");
    return saveFail(artifact, 5);
  }
  // The upload LANDED on-chain: its actually-charged fee has left the account, so the create
  // step's solvency consult must consume the post-upload balance (actual charged fee = the
  // real remaining truth; an unreadable/null feeCharged keeps the preflight snapshot and is
  // noted, never guessed).
  if (solvencyGate && upRes.feeCharged !== null && upRes.feeCharged !== undefined && safeStroopsBig(upRes.feeCharged) !== null) {
    solvencyGate.balanceStroops = balStroops - safeStroopsBig(upRes.feeCharged);
  }

  // (2) CREATE with the deterministic salt (same address on any retry).
  const cr = buildCreateContractTx({ source: publicKey, sequence: String(seqCounter.value), wasmHash: wasmSha256, network: net, salt: deriveSalt(publicKey, wasmSha256), fee, ownerAuthorization: net === "mainnet" });
  if (cr.state !== "BUILD_OK") { console.error(`create build gated: ${cr.error}`); return 2; }
  seqCounter.value += 1n;
  let crRes = null;
  try {
    crRes = await sendAndPoll(rpcServer, net, cr.tx, keypair, "createCustomContract", solvencyGate);
  } catch (e) {
    // Deterministic salt: an earlier attempt already created this exact instance (same deployer+salt+wasm).
    // Soroban refuses a fresh create with the same salt (HostError Storage/ExistingValue: "contract already
    // exists") while the prior attempt already reached INVOKED — this run has no result meta of its
    // own; the resume path below resolves the REAL instance address from the wire. Never resubmit blindly.
    if (/already exists|ExistingValue/i.test(String((e && e.message) || e))) {
      // The ExistingValue throw surfaces from prepareTransaction's SIMULATION, which runs BEFORE
      // sendTransaction — the tx never reached the wire, so it never landed and its reserved
      // sequence slot is released here. Without this release every later build runs one slot
      // ahead of the chain and dies at the RPC gate with txBAD_SEQ (result code -5, measured
      // 2026-11-08 on the rehearsal's first commit: feeCharged 40674, errorResultXdr
      // AAAAAAAAnuL////7AAAAAA==). Only a never-sent tx may release: an on-chain FAILED tx
      // DID consume its slot, which is why sendAndPoll's FAILED branch keeps it.
      if (seqCounter && typeof seqCounter.value === "bigint") seqCounter.value -= 1n;
      console.log(`createCustomContract: prior attempt already created this deterministic instance — simulation refused pre-submit, sequence slot released; the exact address will be resolved from the wire (never resubmitted)`);
      crRes = { step: "createCustomContract", state: "INVOKED", resumedAfterExisting: true, error: String((e && e.message) || e) };
    } else { throw e; }
  }
  artifact.steps.push(crRes);
  if (crRes.state === "FAILED") {
    // A crash AFTER a successful create re-runs into "already exists" —
    // report the pins by name, never resubmit blindly.
    console.error("CREATE FAILED — if a prior attempt created this exact instance (same deployer+salt+wasm), the deterministic salt means inspect the upload/create txs above and the prior artifact instead of retrying.");
    return saveFail(artifact, 5);
  }
  if (crRes.state !== "INVOKED") { return saveFail(artifact, 5); }
  let contractId;
  if (crRes.resumedAfterExisting) {
    // Wire-only resolution — see "Resume path" preamble above. The known-answer
    // vector id (owner+hash) is the IN-CONTRACT commit id (used later as the
    // rehearsal read target), never a contract address; the instance address is
    // a fact that must come from the ledger, so it is resolved + live-proven
    // here or the run fails closed.
    const resolved = await resolveExistingInstance({ net, publicKey, wasmSha256Hex: wasmSha256 });
    if (resolved.state !== "RESOLVED" || !resolved.contractId) {
      crRes.resumptionFailed = { state: resolved.state, error: resolved.error || null };
      console.error(`resume resolution FAILED (${resolved.state}): ${resolved.error || "(no detail)"}`);
      artifact.summary.verdict = `NOT_CONFIRMED — resume could not prove the existing instance on the wire (${resolved.state})`;
      return saveFail(artifact, 5);
    }
    contractId = resolved.contractId;
    crRes.resumedFrom = { contractId, execWasmHashHex: resolved.execWasmHashHex, lastModifiedLedgerSeq: resolved.lastModifiedLedgerSeq, source: resolved.source };
    console.log(`resolveExistingInstance: RESOLVED ${contractId} (exec ${resolved.execWasmHashHex.slice(0, 12)}…, source ${resolved.source})`);
  } else {
    const parsed = parseContractIdFromCreateResult(crRes.metaB64);
    if (parsed.state !== "READ_OK") {
      crRes.warning = `contract id unparseable from create meta: ${parsed.error}`;
      artifact.summary.verdict = "NOT_CONFIRMED — create succeeded but the contract id was not readable from the result meta";
      return saveFail(artifact, 5);
    }
    contractId = parsed.contractId;
  }
  artifact.summary.contractId = contractId;
  // B2/B3 honesty boundary: emitted JSON must not carry execution-request true-emissions
  // (deployed/broadcast/...); the honest status set is deployed = false — the deploy proof rides in
  // the step states (INVOKED) + verdict, never in a bare `deployed: true` emission.
  artifact.summary.deployed = false;

  // (3) REHEARSAL (testnet only).
  if (net === "testnet") {
    if (!plan.rehearse) {
      artifact.steps.push({ step: "rehearsal", state: "SKIP", ok: false, error: "--rehearse not passed: deploy-only testnet run" });
      return saveFail(artifact, 5);
    }
    try { artifact.rehearsal = await runRehearsal({ rpcServer, net, contractId, publicKey, keypair, fee, seqCounter }); }
    catch (e) {
      if (e && Array.isArray(e.steps)) for (const s of e.steps) artifact.steps.push(s); // partial steps preserved — diagnostics never dropped
      artifact.steps.push({ step: "rehearsal", state: "FAILED", ok: false, error: (e && e.message) || "rehearsal failure" });
      return saveFail(artifact, 5);
    }
    for (const s of artifact.rehearsal.steps) artifact.steps.push(s);
  }

  // (4) READBACK — simulation only, never submits (expected None on mainnet).
  artifact.readback = await readbackSim(rpcServer, net, contractId, publicKey, fee, seqCounter.value, KNOWN_VECTOR.id);

  finalizeVerdict(artifact);
  let rc = 0;
  if (net === "mainnet") {
    if (!artifact.readback || artifact.readback.state !== "SIMULATED_NONE") {
      artifact.summary.verdict = "NOT_CONFIRMED — the deploy-only readback did not return the expected empty lane (fail-closed)";
      rc = 6;
    }
  } else if (artifact.rehearsal && (artifact.rehearsal.invariants || []).some((i) => i.ok === false)) {
    rc = 6;
  }
  const stored = await saveArtifact(net, artifact);
  console.log(`artifact: ${stored.rel}`);
  console.log(`verdict: ${artifact.summary.verdict}`);
  console.log(`contractId: ${artifact.summary.contractId}`);
  for (const s of artifact.steps) console.log(`  step ${s.step}: ${s.state}${s.hash ? ` tx=${s.hash}` : ""}${s.ledger !== undefined && s.ledger !== null ? ` ledger=${s.ledger}` : ""}`);
  return rc;
}

function saveFail(artifact, code) {
  finalizeVerdict(artifact);
  process.exitCode = code; // the file still lands on disk (evidence first)
  return (async () => {
    const rel = ARTIFACT_OUT[artifact.network.replace("stellar-", "")];
    await writeFile(join(ROOT, rel), JSON.stringify(serialize(artifact), null, 2) + "\n", "utf8");
    console.log(`artifact: ${rel}`);
    console.log(`verdict: ${artifact.summary.verdict}`);
    for (const s of artifact.steps) console.log(`  step ${s.step}: ${s.state}`);
    return code;
  })();
}

async function saveArtifact(net, artifact) {
  const rel = ARTIFACT_OUT[net];
  const a = serialize(artifact);
  a.evidenceDigest = digestStable(a);
  a.generatedAt = new Date().toISOString();
  await writeFile(join(ROOT, rel), JSON.stringify(a, null, 2) + "\n", "utf8");
  return { rel, artifact: a };
}

function serialize(artifact) { return artifact; }

export async function verifyMode(plan) {
  const net = plan.network;
  if (!["testnet", "mainnet"].includes(net)) { console.error("--verify needs --network testnet|mainnet"); return 2; }
  const rel = ARTIFACT_OUT[net];
  const a = await readArtifactFile(rel);
  if (!a || !a.evidenceDigest || !a.generatedAt) { console.error(`VERIFY FAIL: ${rel} missing or malformed`); return 1; }
  const { generatedAt, evidenceDigest, ...rest } = a;
  const recomputed = digestStable(rest);
  if (recomputed !== evidenceDigest) { console.error(`DIGEST MISMATCH: stored=${evidenceDigest} recomputed=${recomputed} (${rel})`); return 1; }
  if (net === "mainnet") {
    if (rest.laneWrites !== "NONE") { console.error(`VERIFY FAIL: mainnet artifact laneWrites ${JSON.stringify(rest.laneWrites)} is not NONE`); return 1; }
    if (rest.summary.verdict !== DEPLOY_VERDICT) { console.error(`VERIFY FAIL: mainnet verdict ${JSON.stringify(rest.summary.verdict)}`); return 1; }
    if (!String(rest.summary.contractId || "").startsWith("C")) { console.error("VERIFY FAIL: mainnet contractId missing"); return 1; }
    console.log("STELLAR-AUTHORIZED-DEPLOY · MAINNET — digest faithful; verdict held (deploy-only; laneWrites NONE; readback simulated)");
  } else {
    if (rest.summary.verdict !== REHEARSAL_VERDICT) { console.error(`VERIFY FAIL: testnet verdict ${JSON.stringify(rest.summary.verdict)}`); return 1; }
    console.log("STELLAR-AUTHORIZED-DEPLOY · TESTNET — digest faithful; rehearsal verdict held PASSED");
  }
  console.log(`digest: ${evidenceDigest}`);
  console.log(`contractId: ${rest.summary.contractId}`);
  return 0;
}

async function nativeAccountMeta(net, publicKey) {
  try {
    const res = await fetch(`${INFRA[net].horizon}/accounts/${publicKey}`);
    if (!res.ok) return null;
    const rec = await res.json();
    const native = ((rec.balances || []).find((b) => b.asset_type === "native") || {}).balance;
    if (native === undefined) return null;
    return {
      balance: String(native),
      subentryCount: Number.isInteger(rec.subentry_count) ? rec.subentry_count : 0,
      numSponsoring: Number.isInteger(rec.num_sponsoring) ? rec.num_sponsoring : 0,
      numSponsored: Number.isInteger(rec.num_sponsored) ? rec.num_sponsored : 0,
    };
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* Coded rejection decode + fee solvency (pure, offline, test-bonded)  */
/* ------------------------------------------------------------------ */

function safeStroopsBig(v) {
  if (v === null || v === undefined) return null;
  try { const n = BigInt(v); return n < 0n ? null : n; } catch { return null; }
}

/**
 * The per-account EXACT minimum balance for the ledger's fee-solvency rule in the plain
 * (non-sponsoring, sponsorship-free) account shape:
 *   minimum balance = base reserve x (2 + subentry count)
 * every trustline/offer/data entry occupies one subentry slot (measured 2026-11-10: the
 * funded deployer carries ONE USDC trustline from the signed swap cycle, so its exact
 * minimum is 3 x 5,000,000 = 15,000,000 stroops, NOT the single-entry 10,000,000). Any
 * sponsored shape shifts reserves between accounts under rules this runner does not claim
 * to re-derive, so it returns null there and the caller keeps the documented LOWER bound
 * constant - the wire, which knows the exact per-account truth, retains the final word.
 */
export function exactMinBalanceStroops({ baseReserveStroops, subentryCount, numSponsored = 0, numSponsoring = 0 } = {}) {
  const base = safeStroopsBig(baseReserveStroops);
  if (base === null || !Number.isInteger(subentryCount) || subentryCount < 0) return null;
  if (numSponsored > 0 || numSponsoring > 0) return null;
  return base * BigInt(2 + subentryCount);
}

/**
 * Exact XLM-string to stroops conversion, never float math on money:
 * "3.5069800" -> 35069800n; anything else (fraction beyond 7 digits, sign, junk) -> null.
 * 7 digits is the ledger's own XLM precision, so shorter fractions pad with zeros.
 */
export function xlmStringToStroops(xlmString) {
  // Fail-closed, not truncating: an input carrying MORE precision than the ledger's own
  // 7-digit XLM scale must never be silently rounded (money math has no silence).
  if (typeof xlmString !== "string" || xlmString.length === 0) return null;
  const m = /^(\d+)(?:\.(\d*))?$/.exec(xlmString);
  if (!m || (m[2] || "").length > 7) return null;
  const frac = (m[2] || "").padEnd(7, "0");
  return safeStroopsBig(`${m[1]}${frac}`);
}

// Result-code names built from the SDK's own TransactionResultCode schema enum - machine
// truth, never a hand-maintained table: an earlier hand-ordered table decoded a real reject
// into the wrong arm by positions (a -7 is txInsufficientBalance at feeCharged 130861110,
// NOT a bad-seq/bad-auth arm as suspected before the bytes were decoded). Codes the SDK
// schema does not name decode to name:null with the numeric code intact.
const TX_RESULT_CODE_NAME_BY_VALUE = (() => {
  const map = new Map();
  try {
    for (const [name, value] of Object.entries(xdr.TransactionResultCode.schema || {})) {
      if (typeof value === "number") map.set(value, name);
    }
  } catch { /* absent schema keeps names null; codes still decode */ }
  return map;
})();

/**
 * Decode an errorResultXdr TransactionResult blob into its canonical result code and
 * charged fee. sendTransaction REJECTS carry a bare result-code union arm with NO operation
 * results, so the body-arm walk in diagnostic() cannot name them - this reads the same
 * bytes flatly (feeCharged int64 + code int32) through the SDK enum. Fail-closed:
 * {decodable:false} on any undecodable input (never an invented code).
 */
export function decodeTransactionResultCode(errorResultXdrB64) {
  // Fail-closed on non-strings and empties (fromXDR(null) semantics are not a contract).
  if (typeof errorResultXdrB64 !== "string" || errorResultXdrB64.length === 0) return { decodable: false };
  let tr = null;
  try { tr = xdr.TransactionResult.fromXDR(errorResultXdrB64, "base64"); } catch { return { decodable: false }; }
  let codeValue = null;
  let feeCharged = null;
  try {
    const flat = typeof tr.toXdrObject === "function" ? tr.toXdrObject() : null;
    if (flat && flat.feeCharged !== undefined) feeCharged = String(flat.feeCharged);
    if (flat && flat.result && flat.result.code !== undefined) codeValue = Number(flat.result.code);
  } catch { /* fail-closed below */ }
  if (!Number.isInteger(codeValue)) return { decodable: false, feeCharged };
  return { decodable: true, code: codeValue, name: TX_RESULT_CODE_NAME_BY_VALUE.get(codeValue) || null, feeCharged };
}

/**
 * The ledger's own fee-solvency rule, evaluated locally BEFORE any submission: a transaction
 * whose declared fee would leave the account below its minimum balance is refused with
 * txInsufficientBalance (-7, "fee would gobble minimum balance"). Detecting that locally
 * yields a coded, zero-submission refusal instead of a blind wire reject (measured
 * 2026-11-10 on the real mainnet upload(wasm): priced fee 130861110 stroops vs funded
 * 35069800 stroops). minReserveStroops is the documented LOWER bound of the ledger's
 * per-account minimum balance (MAINNET_MIN_BALANCE_STROOPS = 2 x base reserve); an account
 * with subentries or trustlines owes more, so a gate pass here is never a ledger guarantee
 * - it is this runner's strongest local verdict before the wire has its final word.
 * Unreadable inputs refuse (REJECTED_PRESEND), never pass: fail-closed.
 */
export function evaluateFeeSolvency({ feeStroops, balanceStroops, minReserveStroops } = {}) {
  const fee = safeStroopsBig(feeStroops);
  const bal = safeStroopsBig(balanceStroops);
  const res = safeStroopsBig(minReserveStroops);
  if (fee === null || bal === null || res === null) {
    return { state: "REJECTED_PRESEND", shortfallStroops: null, error: "fee solvency gate: unreadable fee/balance/reserve inputs - refusing fail-closed (nothing was submitted)" };
  }
  const headroom = bal - fee;
  if (headroom < res) {
    return {
      state: "REJECTED_PRESEND",
      shortfallStroops: String(res - headroom),
      error: `PRE-SEND FEE SOLVENCY GATE (nothing was submitted): declared fee ${fee.toString()} stroops vs balance ${bal.toString()} stroops; paying it would leave ${headroom.toString()} < the ${res.toString()} stroop minimum balance, which is exactly the ledger's txInsufficientBalance refusal (code -7). Fund the deployer to at least ${(fee + res).toString()} stroops (declared fee + minimum balance), then re-run.`,
    };
  }
  return { state: "ALLOWED", headroomStroops: String(headroom) };
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/").split("/").pop())) {
  process.exit(await main(process.argv.slice(2)));
}

/**
 * packages/agent-gate/index.mjs — AGENT-GATE/1
 *
 * The flagship Stellar surface: a gate that a financial AI agent must pass
 * before a transaction is signed, plus an evidence receipt that a third party
 * verifies WITHOUT trusting CoreGuard.
 *
 * What this module actually does (offline, no network, no chain submission):
 *   1. POLICY  — validates an agent mandate (per-tx cap, window cap, recipient
 *                and asset allowlists, expiry, required memo).
 *   2. GATE    — evaluates an intent against the mandate and returns exactly
 *                one of ALLOW / DENY / HOLD. Fail-closed: anything the gate
 *                cannot decide is HOLD, never ALLOW.
 *   3. BIND    — hashes the authorized intent (domain-separated, canonical
 *                JSON) so the envelope that reaches the wallet can be proven
 *                to be the same object that was authorized.
 *   4. CONFORM — compares the SIGNED envelope (what the wallet produced, or
 *                what a server is about to submit) against the authorized
 *                intent. Divergence is a MISMATCH, including an envelope that
 *                adds a second payment the intent never mentioned.
 *   5. RECEIPT — an Ed25519-signed, hash-chained evidence receipt containing
 *                the raw intent, mandate and execution, so verification is a
 *                pure function of committed bytes.
 *
 * What this module is NOT:
 *   - It is NOT a signer and NOT a wallet. No secret key is accepted, stored,
 *     or derived here; signing stays with the wallet (Freighter integration is
 *     NOT_BUILT — see docs/AGENT-PAYMENT-GATE.md).
 *   - It does NOT submit transactions. There is no Horizon/Soroban call in
 *     this file at all.
 *   - Its status is OFFLINE_PROTOTYPE. Nothing here is production-deployed,
 *     audited, or adopted by an external Stellar project.
 *
 * Standards: AGENT-GATE/1 (gate decision), AGENT-RECEIPT/1 (evidence receipt).
 */

import { createHash, generateKeyPairSync, sign, verify } from "node:crypto";

export const AGENT_GATE_VERSION = "AGENT-GATE/1";
export const AGENT_RECEIPT_VERSION = "AGENT-RECEIPT/1";
export const AGENT_POLICY_VERSION = "AGENT-POLICY/1";

export const VERDICT = Object.freeze({ ALLOW: "ALLOW", DENY: "DENY", HOLD: "HOLD" });
export const CONFORMANCE = Object.freeze({
  VERIFIED: "VERIFIED",
  MISMATCH: "MISMATCH",
  UNKNOWN: "UNKNOWN",
});
export const VERIFY_STATUS = Object.freeze({
  VERIFIED: "VERIFIED",
  MISMATCH: "MISMATCH",
  TAMPERED: "TAMPERED",
  UNKNOWN: "UNKNOWN",
});

/** Reason codes — every refusal names itself; nothing is a bare boolean. */
export const REASON = Object.freeze({
  IN_POLICY: "IN_POLICY",
  SCHEMA_INVALID: "SCHEMA_INVALID",
  UNKNOWN_FIELD: "UNKNOWN_FIELD",
  AGENT_NOT_AUTHORIZED: "AGENT_NOT_AUTHORIZED",
  NETWORK_MISMATCH: "NETWORK_MISMATCH",
  ASSET_NOT_ALLOWED: "ASSET_NOT_ALLOWED",
  RECIPIENT_NOT_ALLOWED: "RECIPIENT_NOT_ALLOWED",
  PER_TX_LIMIT_EXCEEDED: "PER_TX_LIMIT_EXCEEDED",
  WINDOW_LIMIT_EXCEEDED: "WINDOW_LIMIT_EXCEEDED",
  INTENT_EXPIRED: "INTENT_EXPIRED",
  EXPIRY_MISSING: "EXPIRY_MISSING",
  MEMO_REQUIRED: "MEMO_REQUIRED",
  AMOUNT_UNPARSEABLE: "AMOUNT_UNPARSEABLE",
  POLICY_UNUSABLE: "POLICY_UNUSABLE",
  MULTI_OP_DIVERGENCE: "MULTI_OP_DIVERGENCE",
  OPERATION_TYPE_MISMATCH: "OPERATION_TYPE_MISMATCH",
  FIELD_MISMATCH: "FIELD_MISMATCH",
  INTENT_DIGEST_MISMATCH: "INTENT_DIGEST_MISMATCH",
  EXECUTION_MISSING: "EXECUTION_MISSING",
});

const STROOP_DP = 7;
const DECIMAL = /^(?:0|[1-9]\d{0,15})(?:\.\d{1,7})?$/;
const INTENT_FIELDS = Object.freeze([
  "agentId", "source", "destination", "amount", "asset", "network",
  "memo", "createdAt", "expiresAt", "nonce",
]);
const DOMAIN_INTENT = "coreguard.agent-gate.intent/1";
const DOMAIN_RECEIPT = "coreguard.agent-gate.receipt/1";
const DOMAIN_POLICY = "coreguard.agent-gate.policy/1";

/* ------------------------------------------------------------------ *
 * Canonical form and hashing
 * ------------------------------------------------------------------ */

/** Deterministic JSON: sorted keys, no whitespace, no undefined. */
export function canonicalJson(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const keys = Object.keys(value).filter((k) => value[k] !== undefined).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(value[k])}`).join(",")}}`;
}

function sha256Hex(text) {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

/** Domain-separated digest — an intent hash can never be replayed as a receipt hash. */
export function intentDigest(intent) {
  return `sha256:${sha256Hex(`${DOMAIN_INTENT}\n${canonicalJson(pickIntent(intent))}`)}`;
}

export function policyDigest(policy) {
  return `sha256:${sha256Hex(`${DOMAIN_POLICY}\n${canonicalJson(policy)}`)}`;
}

function pickIntent(intent = {}) {
  const out = {};
  for (const f of INTENT_FIELDS) out[f] = intent[f] === undefined ? null : intent[f];
  return out;
}

/* ------------------------------------------------------------------ *
 * Fixed-point amounts — never a JS float for money
 * ------------------------------------------------------------------ */

/**
 * Parse a decimal string into stroops (BigInt). Returns null when the input is
 * not a positive-or-zero amount with at most 7 decimal places.
 */
export function toStroops(amount) {
  if (typeof amount !== "string" || !DECIMAL.test(amount)) return null;
  const [whole, frac = ""] = amount.split(".");
  const padded = (frac + "0".repeat(STROOP_DP)).slice(0, STROOP_DP);
  return BigInt(whole) * 10n ** BigInt(STROOP_DP) + BigInt(padded || "0");
}

/* ------------------------------------------------------------------ *
 * Policy
 * ------------------------------------------------------------------ */

/**
 * Validate an agent mandate. A policy that cannot be read is UNUSABLE, and an
 * unusable policy can only ever produce HOLD — it never degrades to "no limits".
 */
export function validatePolicy(policy) {
  const errors = [];
  if (!policy || typeof policy !== "object" || Array.isArray(policy)) {
    return { ok: false, errors: ["policy must be an object"] };
  }
  if (policy.version !== AGENT_POLICY_VERSION) errors.push(`version must be ${AGENT_POLICY_VERSION}`);
  if (!["testnet", "mainnet"].includes(policy.network)) errors.push("network must be testnet|mainnet");
  if (!Array.isArray(policy.assets) || policy.assets.length === 0) errors.push("assets must be a non-empty array");
  if (!Array.isArray(policy.recipients) || policy.recipients.length === 0) errors.push("recipients must be a non-empty array");
  if (!Array.isArray(policy.agents) || policy.agents.length === 0) errors.push("agents must be a non-empty array");
  if (toStroops(policy.perTxMax) === null) errors.push("perTxMax must be a decimal string");
  if (toStroops(policy.windowMax) === null) errors.push("windowMax must be a decimal string");
  if (toStroops(policy.windowSpent ?? "0") === null) errors.push("windowSpent must be a decimal string");
  if (typeof policy.windowId !== "string" || policy.windowId.length === 0) errors.push("windowId required");
  if (typeof policy.requireMemo !== "boolean") errors.push("requireMemo must be boolean");
  return { ok: errors.length === 0, errors };
}

/* ------------------------------------------------------------------ *
 * The gate
 * ------------------------------------------------------------------ */

function check(id, result, detail) {
  return { id, result, detail };
}

/**
 * Evaluate an intent against a mandate.
 *
 * @param {object} args
 * @param {object} args.intent   authorized-action proposal
 * @param {object} args.policy   agent mandate
 * @param {string} args.now      ISO-8601 instant the decision is made at
 * @returns {{verdict:string, reasons:string[], checks:object[], intentDigest:string|null}}
 */
export function evaluate({ intent, policy, now } = {}) {
  const checks = [];
  const reasons = [];
  const fail = (id, detail) => { checks.push(check(id, "FAIL", detail)); reasons.push(id); };
  const hold = (id, detail) => { checks.push(check(id, "UNKNOWN", detail)); reasons.push(id); };
  const pass = (id, detail = "ok") => checks.push(check(id, "PASS", detail));

  // 1. Mandate must be readable before anything else can be decided.
  const policyCheck = validatePolicy(policy);
  if (!policyCheck.ok) {
    hold(REASON.POLICY_UNUSABLE, policyCheck.errors.join("; "));
    return { verdict: VERDICT.HOLD, reasons, checks, intentDigest: null };
  }
  pass("POLICY_PARSED", AGENT_POLICY_VERSION);

  // 2. Intent shape. Unknown fields are refused: an envelope cannot smuggle
  //    a field the gate never evaluated into the authorization path.
  if (!intent || typeof intent !== "object" || Array.isArray(intent)) {
    fail(REASON.SCHEMA_INVALID, "intent must be an object");
    return { verdict: VERDICT.DENY, reasons, checks, intentDigest: null };
  }
  const unknown = Object.keys(intent).filter((k) => !INTENT_FIELDS.includes(k));
  if (unknown.length > 0) fail(REASON.UNKNOWN_FIELD, `unknown intent field(s): ${unknown.join(", ")}`);
  for (const f of ["agentId", "source", "destination", "asset", "network"]) {
    if (typeof intent[f] !== "string" || intent[f].trim() === "") fail(REASON.SCHEMA_INVALID, `${f} required`);
  }
  const amountStroops = toStroops(intent.amount);
  if (amountStroops === null) fail(REASON.AMOUNT_UNPARSEABLE, `amount ${JSON.stringify(intent.amount)} is not a 7-dp decimal string`);
  if (typeof intent.createdAt !== "string" || Number.isNaN(Date.parse(intent.createdAt))) {
    fail(REASON.SCHEMA_INVALID, "createdAt must be an ISO instant");
  }
  if (!Number.isInteger(intent.nonce) || intent.nonce < 0) fail(REASON.SCHEMA_INVALID, "nonce must be a non-negative integer");
  if (reasons.length > 0) return { verdict: VERDICT.DENY, reasons, checks, intentDigest: null };

  // 3. Identity, network, asset, recipient — hard refusals.
  if (!policy.agents.includes(intent.agentId)) fail(REASON.AGENT_NOT_AUTHORIZED, `agent ${intent.agentId} not in mandate`);
  if (intent.network !== policy.network) fail(REASON.NETWORK_MISMATCH, `intent ${intent.network} vs policy ${policy.network}`);
  if (!policy.assets.includes(intent.asset)) fail(REASON.ASSET_NOT_ALLOWED, `asset ${intent.asset} not in mandate`);
  if (!policy.recipients.includes(intent.destination)) fail(REASON.RECIPIENT_NOT_ALLOWED, `destination ${intent.destination} not in mandate`);

  // 4. Caps — compared as stroops, never as floats.
  const perTx = toStroops(policy.perTxMax);
  if (amountStroops > perTx) fail(REASON.PER_TX_LIMIT_EXCEEDED, `${intent.amount} > per-tx ${policy.perTxMax}`);
  const windowSpent = toStroops(policy.windowSpent ?? "0");
  const windowMax = toStroops(policy.windowMax);
  if (windowSpent + amountStroops > windowMax) {
    fail(REASON.WINDOW_LIMIT_EXCEEDED, `${policy.windowSpent ?? "0"} + ${intent.amount} > window ${policy.windowMax}`);
  }
  if (amountStroops === 0n) fail(REASON.SCHEMA_INVALID, "amount must be greater than zero");

  // 5. Time and memo — undecidable facts hold rather than pass.
  if (typeof intent.expiresAt !== "string" || Number.isNaN(Date.parse(intent.expiresAt))) {
    hold(REASON.EXPIRY_MISSING, "intent carries no readable expiresAt");
  } else {
    const nowMs = Date.parse(now ?? "");
    if (Number.isNaN(nowMs)) hold(REASON.EXPIRY_MISSING, "gate was called without a readable decision instant");
    else if (nowMs >= Date.parse(intent.expiresAt)) fail(REASON.INTENT_EXPIRED, `expired at ${intent.expiresAt}`);
    else pass("NOT_EXPIRED", `valid until ${intent.expiresAt}`);
  }
  if (policy.requireMemo && (typeof intent.memo !== "string" || intent.memo.trim() === "")) {
    hold(REASON.MEMO_REQUIRED, "mandate requires a memo and the intent has none");
  }

  const verdict = reasons.length === 0
    ? VERDICT.ALLOW
    : checks.some((c) => c.result === "FAIL") ? VERDICT.DENY : VERDICT.HOLD;

  return { verdict, reasons, checks, intentDigest: intentDigest(intent) };
}

/* ------------------------------------------------------------------ *
 * Intent → signed envelope conformance
 * ------------------------------------------------------------------ */

/**
 * Compare the envelope the wallet signed (or a server is about to submit)
 * against the intent the gate authorized.
 *
 * The envelope is the LAST place divergence can hide, so this is strict:
 * exactly one operation, same type, same source/destination/asset, equal
 * amount in stroops, and — when the envelope carries one — an intentDigest
 * that matches the authorized intent.
 *
 * @returns {{verdict:string, mismatches:object[], reasons:string[]}}
 */
export function checkConformance({ intent, execution } = {}) {
  const mismatches = [];
  const reasons = [];

  if (!execution || typeof execution !== "object") {
    return { verdict: CONFORMANCE.UNKNOWN, mismatches, reasons: [REASON.EXECUTION_MISSING] };
  }
  const ops = Array.isArray(execution.operations) ? execution.operations : null;
  if (ops === null) {
    return { verdict: CONFORMANCE.UNKNOWN, mismatches, reasons: [REASON.EXECUTION_MISSING] };
  }
  if (!intent || typeof intent !== "object") {
    return { verdict: CONFORMANCE.UNKNOWN, mismatches, reasons: [REASON.SCHEMA_INVALID] };
  }

  if (execution.network && intent.network && execution.network !== intent.network) {
    mismatches.push({ field: "network", expected: intent.network, actual: execution.network });
  }

  if (ops.length !== 1) {
    // A second payment is the classic divergence: the authorized transfer is
    // buried inside a batch that also moves money somewhere else.
    mismatches.push({ field: "operations.length", expected: 1, actual: ops.length });
    reasons.push(REASON.MULTI_OP_DIVERGENCE);
  }

  const op = ops[0] || {};
  if (op.type !== "payment") {
    mismatches.push({ field: "operations[0].type", expected: "payment", actual: op.type ?? null });
    reasons.push(REASON.OPERATION_TYPE_MISMATCH);
  }
  for (const field of ["source", "destination", "asset"]) {
    if (intent[field] !== op[field]) {
      mismatches.push({ field, expected: intent[field], actual: op[field] ?? null });
    }
  }
  const intentStroops = toStroops(intent.amount);
  const opStroops = toStroops(op.amount);
  if (intentStroops === null || opStroops === null || intentStroops !== opStroops) {
    mismatches.push({ field: "amount", expected: intent.amount, actual: op.amount ?? null });
  }
  if ((intent.memo ?? null) !== (op.memo ?? null)) {
    mismatches.push({ field: "memo", expected: intent.memo ?? null, actual: op.memo ?? null });
  }
  // An absent binding is not a wrong binding: only a PRESENT and different
  // digest is a mismatch. (A stored `null` means "the envelope carried none".)
  if (execution.intentDigest != null && execution.intentDigest !== intentDigest(intent)) {
    mismatches.push({ field: "intentDigest", expected: intentDigest(intent), actual: execution.intentDigest });
    reasons.push(REASON.INTENT_DIGEST_MISMATCH);
  }

  if (mismatches.length > 0) {
    for (const m of mismatches) if (!reasons.includes(REASON.FIELD_MISMATCH)) reasons.push(REASON.FIELD_MISMATCH);
    return { verdict: CONFORMANCE.MISMATCH, mismatches, reasons };
  }
  return { verdict: CONFORMANCE.VERIFIED, mismatches: [], reasons: [REASON.IN_POLICY] };
}

/* ------------------------------------------------------------------ *
 * Keys and receipts
 * ------------------------------------------------------------------ */

/** Generate an Ed25519 operator signing key (tests and local demos only). */
export function generateOperatorKeyPair() {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  return {
    privateKeyPem: privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
    publicKeyPem: publicKey.export({ type: "spki", format: "pem" }).toString(),
  };
}

function receiptBody(receipt) {
  const { signature, receiptId, ...body } = receipt;
  return body;
}

export function receiptIdOf(receipt) {
  return `sha256:${sha256Hex(`${DOMAIN_RECEIPT}\n${canonicalJson(receiptBody(receipt))}`)}`;
}

/**
 * Issue a signed evidence receipt for a gate decision.
 *
 * `execution` is the envelope the wallet produced (or `null` when the gate
 * refuses). A DENY/HOLD decision can never carry a submitted execution — that
 * would be a receipt for something the manifest forbids.
 */
export function issueReceipt({
  intent, policy, execution = null, decision, now, privateKeyPem, seq = 0, prevReceiptDigest = null,
} = {}) {
  if (!decision || !Object.values(VERDICT).includes(decision.verdict)) {
    throw new Error("issueReceipt: decision.verdict must be ALLOW|DENY|HOLD");
  }
  if (!privateKeyPem) throw new Error("issueReceipt: privateKeyPem required (operator key, never an agent's)");
  if (decision.verdict !== VERDICT.ALLOW && execution && execution.status === "SUBMITTED") {
    throw new Error("issueReceipt: a refused decision cannot carry a submitted execution");
  }
  const conformance = execution ? checkConformance({ intent, execution }) : null;
  const publicKeyPem = createHash("sha256").update(privateKeyPem).digest("hex");

  const body = {
    schema: AGENT_RECEIPT_VERSION,
    version: AGENT_GATE_VERSION,
    seq,
    prevReceiptDigest,
    evaluatedAt: now,
    subject: {
      intent: pickIntent(intent),
      policy,
      execution: execution ? {
        status: execution.status ?? "NOT_SUBMITTED",
        network: execution.network ?? null,
        operations: execution.operations ?? [],
        intentDigest: execution.intentDigest ?? null,
        txHash: execution.txHash ?? null,
      } : null,
    },
    decision: {
      verdict: decision.verdict,
      reasons: decision.reasons,
      checks: decision.checks,
      intentDigest: decision.intentDigest,
      policyDigest: policyDigest(policy),
    },
    conformance,
    digests: {
      intent: decision.intentDigest,
      policy: policyDigest(policy),
      execution: execution ? `sha256:${sha256Hex(canonicalJson(execution))}` : null,
    },
  };

  // The body digest is the receipt id: one hash over the canonical body, so a
  // verifier can recompute it from the bytes alone. It is never stored INSIDE
  // the bytes it covers (a self-referential digest cannot be recomputed).
  const bodyDigest = `sha256:${sha256Hex(`${DOMAIN_RECEIPT}\n${canonicalJson(body)}`)}`;
  const signature = sign(null, Buffer.from(canonicalJson(body), "utf8"), privateKeyPem).toString("base64");
  return { ...body, signature, receiptId: bodyDigest };
}

/* ------------------------------------------------------------------ *
 * Independent verification — a pure function of the receipt bytes
 * ------------------------------------------------------------------ */

/**
 * Verify a receipt without trusting the issuer's process, database or server.
 *
 * It re-derives everything: the body digest, the intent digest, the policy
 * digest, the gate decision from the raw intent+mandate, and the conformance
 * verdict from the raw envelope. A stored verdict is only ever compared
 * against a recomputed one; it is never taken as the answer.
 *
 * @returns {{status:string, findings:object[]}}
 */
export function verifyReceipt({ receipt, publicKeyPem } = {}) {
  const findings = [];
  const add = (id, detail) => findings.push({ id, detail });

  if (!receipt || typeof receipt !== "object" || receipt.schema !== AGENT_RECEIPT_VERSION) {
    return { status: VERIFY_STATUS.UNKNOWN, findings: [{ id: "SCHEMA_UNKNOWN", detail: "receipt schema not recognised" }] };
  }
  if (typeof publicKeyPem !== "string" || !publicKeyPem.includes("BEGIN PUBLIC KEY")) {
    return { status: VERIFY_STATUS.UNKNOWN, findings: [{ id: "KEY_MISSING", detail: "no operator public key supplied" }] };
  }

  // 1. Signature over the canonical body.
  const body = receiptBody(receipt);
  const signatureOk = (() => {
    try {
      return verify(null, Buffer.from(canonicalJson(body), "utf8"), publicKeyPem, Buffer.from(receipt.signature, "base64"));
    } catch { return false; }
  })();
  if (!signatureOk) add("SIGNATURE_INVALID", "Ed25519 signature does not verify against the operator key");

  // 2. Body digest and receipt id.
  const bodyDigest = `sha256:${sha256Hex(`${DOMAIN_RECEIPT}\n${canonicalJson(body)}`)}`;
  if (receipt.receiptId !== bodyDigest) add("RECEIPT_ID_MISMATCH", `stored ${receipt.receiptId} != recomputed ${bodyDigest}`);

  // 3. Subject digests.
  const subject = receipt.subject ?? {};
  if (receipt.digests?.intent !== intentDigest(subject.intent)) add("INTENT_DIGEST_MISMATCH", "intent bytes do not hash to the recorded digest");
  if (receipt.digests?.policy !== policyDigest(subject.policy)) add("POLICY_DIGEST_MISMATCH", "mandate bytes do not hash to the recorded digest");
  if (receipt.decision?.intentDigest !== receipt.digests?.intent) add("DECISION_INTENT_BINDING", "decision is not bound to the recorded intent");

  // 4. Re-run the gate: a stored ALLOW that the mandate does not support is a
  //    forged or stale decision, whichever process wrote it.
  const reEvaluated = evaluate({ intent: subject.intent, policy: subject.policy, now: receipt.evaluatedAt });
  if (reEvaluated.verdict !== receipt.decision?.verdict) {
    add("DECISION_NOT_REPRODUCIBLE", `stored ${receipt.decision?.verdict} vs recomputed ${reEvaluated.verdict}`);
  }
  const recordedReasons = [...(receipt.decision?.reasons ?? [])].sort();
  if (canonicalJson(recordedReasons) !== canonicalJson([...reEvaluated.reasons].sort())) {
    add("REASONS_NOT_REPRODUCIBLE", "recorded reason codes differ from the recomputed set");
  }

  // 5. Conformance is recomputed from the envelope, never read back.
  let recomputedConformance = null;
  if (subject.execution) {
    recomputedConformance = checkConformance({ intent: subject.intent, execution: subject.execution });
    if (canonicalJson(recomputedConformance) !== canonicalJson(receipt.conformance)) {
      add("CONFORMANCE_NOT_REPRODUCIBLE", `recomputed ${recomputedConformance.verdict} vs recorded ${receipt.conformance?.verdict}`);
    }
    // A submitted execution under a refused decision is a contradiction.
    if (receipt.decision?.verdict !== VERDICT.ALLOW && subject.execution.status === "SUBMITTED") {
      add("REFUSED_BUT_SUBMITTED", "the receipt records a submission under a non-ALLOW decision");
    }
    // The property the product is sold on: no submitted execution may diverge.
    if (subject.execution.status === "SUBMITTED" && recomputedConformance?.verdict !== CONFORMANCE.VERIFIED) {
      add("SUBMITTED_WITHOUT_CONFORMANCE", `submitted execution is ${recomputedConformance?.verdict}`);
    }
  }

  if (findings.length > 0) {
    // A receipt that CLAIMS a submitted execution which does not conform is not
    // an unknown state — it is evidence that what was submitted diverged from
    // what was authorized. That is tampering, and it must read as such.
    const tampered = findings.some((f) => /SIGNATURE_INVALID|MISMATCH|NOT_REPRODUCIBLE|REFUSED_BUT_SUBMITTED|SUBMITTED_WITHOUT_CONFORMANCE/.test(f.id));
    return { status: tampered ? VERIFY_STATUS.TAMPERED : VERIFY_STATUS.UNKNOWN, findings };
  }

  // Honest ceiling: everything above is a self-contained recomputation. It is
  // not a chain read, not an external audit, and not a statement about funds.
  return {
    status: VERIFY_STATUS.VERIFIED,
    findings: [],
    ceiling: "OFFLINE_RECOMPUTATION — no chain read, no external audit",
  };
}

/**
 * Verify a receipt chain (seq ordering + prev-link continuity).
 * A gap is UNKNOWN, never a pass: an unverifiable chain is not a clean one.
 */
export function verifyChain({ receipts = [], publicKeyPem } = {}) {
  if (!Array.isArray(receipts) || receipts.length === 0) {
    return { status: VERIFY_STATUS.UNKNOWN, findings: [{ id: "EMPTY_CHAIN", detail: "no receipts supplied" }] };
  }
  const findings = [];
  let previous = null;
  for (let i = 0; i < receipts.length; i++) {
    const r = receipts[i];
    const v = verifyReceipt({ receipt: r, publicKeyPem });
    if (v.status !== VERIFY_STATUS.VERIFIED) {
      findings.push({ id: "RECEIPT_NOT_VERIFIED", detail: `receipt ${i} (${r?.receiptId ?? "?"}) is ${v.status}` });
    }
    if (i > 0) {
      if (r.seq !== previous.seq + 1) findings.push({ id: "SEQ_GAP", detail: `receipt ${i}: seq ${r.seq} after ${previous.seq}` });
      if (r.prevReceiptDigest !== previous.receiptId) findings.push({ id: "CHAIN_BROKEN", detail: `receipt ${i}: prev link does not point at the previous receipt` });
    }
    previous = r;
  }
  return findings.length === 0
    ? { status: VERIFY_STATUS.VERIFIED, findings: [], ceiling: "OFFLINE_RECOMPUTATION — no chain read, no external audit" }
    : { status: VERIFY_STATUS.TAMPERED, findings };
}

/* ------------------------------------------------------------------ *
 * Status — the two-axis truth, same shape as every other CoreGuard surface
 * ------------------------------------------------------------------ */

/**
 * `integrationStatus` is the axis the Stellar reviewer was right about: this is
 * a prototype surface inside the repo, NOT a customer-ready integration.
 * `executionEvidence` names what has actually been executed, and by what.
 */
export function status() {
  return {
    version: AGENT_GATE_VERSION,
    runMode: "OFFLINE_PROTOTYPE",
    network: "none — no Horizon/Soroban call in this module",
    chainSubmission: "NOT_PERFORMED",
    signer: "NOT_BUILT — wallet signing integration does not exist here",
    integrationStatus: "NOT_BUILT",
    externalAdoption: 0,
    independentAudit: "NOT_PERFORMED",
    deliberateLimits: [
      "no transaction building or signing",
      "no submission path of any kind",
      "verification ceiling is offline recomputation",
    ],
  };
}

export function selfCheck() {
  const s = status();
  return {
    ok: s.runMode === "OFFLINE_PROTOTYPE" && s.integrationStatus === "NOT_BUILT" && s.chainSubmission === "NOT_PERFORMED",
    status: s,
  };
}

export default {
  AGENT_GATE_VERSION,
  AGENT_RECEIPT_VERSION,
  AGENT_POLICY_VERSION,
  VERDICT,
  CONFORMANCE,
  VERIFY_STATUS,
  REASON,
  canonicalJson,
  intentDigest,
  policyDigest,
  toStroops,
  validatePolicy,
  evaluate,
  checkConformance,
  generateOperatorKeyPair,
  issueReceipt,
  receiptIdOf,
  verifyReceipt,
  verifyChain,
  status,
  selfCheck,
};

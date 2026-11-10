#!/usr/bin/env node
/**
 * packages/agent-gate/demo.mjs — runnable AGENT-GATE/1 walkthrough (offline).
 *
 * Executes the whole chain on fixed inputs and fixed instants, so every run
 * prints the same verdict matrix:
 *
 *   agent proposes → mandate gate (ALLOW / DENY / HOLD)
 *                  → authorize (intent digest)
 *                  → wallet would sign → envelope conformance (blocked on drift)
 *                  → signed evidence receipt → independent re-verification
 *
 * No network, no keys of value, no submission. Exits 1 if any expected verdict
 * drifts, so the demo is also a self-check.
 *
 * Usage: node packages/agent-gate/demo.mjs
 */

import {
  evaluate,
  checkConformance,
  issueReceipt,
  verifyReceipt,
  verifyChain,
  generateOperatorKeyPair,
  status,
  VERDICT,
  CONFORMANCE,
  VERIFY_STATUS,
} from "./index.mjs";

const NOW = "2026-11-10T12:00:00.000Z";
const OPERATOR = "GDJ3CRNLNDZ4AVWGPUG7DBC5BIAGMIONOONZGB5FSYAY44ZHOIPRKY7U";
const MERCHANT = "GAIH3ULLFQ4DGSECF2AR555KZ4KNDGEKN4AFI4SU2M7B43MGK3QJZNSR";
const OTHER = "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";

const POLICY = {
  version: "AGENT-POLICY/1",
  network: "testnet",
  agents: ["agent-shopping-07"],
  assets: ["XLM"],
  recipients: [MERCHANT],
  perTxMax: "100",
  windowMax: "250",
  windowSpent: "0",
  windowId: "2026-11",
  requireMemo: false,
};

function intent(overrides = {}) {
  return {
    agentId: "agent-shopping-07",
    source: OPERATOR,
    destination: MERCHANT,
    amount: "80",
    asset: "XLM",
    network: "testnet",
    memo: null,
    createdAt: "2026-11-10T11:59:00.000Z",
    expiresAt: "2026-11-10T12:05:00.000Z",
    nonce: 1,
    ...overrides,
  };
}

function envelope(i, overrides = {}) {
  return {
    status: "SIGNED_PENDING_SUBMIT",
    network: i.network,
    intentDigest: undefined,
    operations: [{
      type: "payment",
      source: i.source,
      destination: i.destination,
      amount: i.amount,
      asset: i.asset,
      memo: i.memo,
    }],
    ...overrides,
  };
}

const results = [];
function record(name, expected, actual, detail = "") {
  results.push({ name, expected, actual, ok: expected === actual, detail });
}

function main() {
  const keys = generateOperatorKeyPair();

  // --- 1..5: the gate decides ------------------------------------------------
  const allow = evaluate({ intent: intent(), policy: POLICY, now: NOW });
  record("in-policy 80 XLM", VERDICT.ALLOW, allow.verdict, allow.reasons.join(","));

  const overCap = evaluate({ intent: intent({ amount: "150" }), policy: POLICY, now: NOW });
  record("over per-tx cap 150", VERDICT.DENY, overCap.verdict, overCap.reasons.join(","));

  const badDest = evaluate({ intent: intent({ destination: OTHER }), policy: POLICY, now: NOW });
  record("recipient not in mandate", VERDICT.DENY, badDest.verdict, badDest.reasons.join(","));

  const needsMemo = evaluate({ intent: intent(), policy: { ...POLICY, requireMemo: true }, now: NOW });
  record("memo required, none given", VERDICT.HOLD, needsMemo.verdict, needsMemo.reasons.join(","));

  const expired = evaluate({ intent: intent({ expiresAt: "2026-11-10T11:00:00.000Z" }), policy: POLICY, now: NOW });
  record("expired intent", VERDICT.DENY, expired.verdict, expired.reasons.join(","));

  const overWindow = evaluate({ intent: intent({ amount: "90" }), policy: { ...POLICY, windowSpent: "200" }, now: NOW });
  record("window cap 200+90 > 250", VERDICT.DENY, overWindow.verdict, overWindow.reasons.join(","));

  const unknownField = evaluate({ intent: { ...intent(), fee: "1" }, policy: POLICY, now: NOW });
  record("unknown intent field", VERDICT.DENY, unknownField.verdict, unknownField.reasons.join(","));

  // --- 6..8: the envelope must be the authorized one -------------------------
  const honest = checkConformance({ intent: intent(), execution: envelope(intent()) });
  record("envelope matches intent", CONFORMANCE.VERIFIED, honest.verdict);

  const drifted = checkConformance({
    intent: intent(),
    execution: envelope(intent(), {
      operations: [{ type: "payment", source: OPERATOR, destination: OTHER, amount: "95", asset: "XLM", memo: null }],
    }),
  });
  record("envelope drifts to 95 XLM → attacker", CONFORMANCE.MISMATCH, drifted.verdict, drifted.mismatches.map((m) => m.field).join(","));

  const batched = checkConformance({
    intent: intent(),
    execution: envelope(intent(), {
      operations: [
        { type: "payment", source: OPERATOR, destination: MERCHANT, amount: "80", asset: "XLM", memo: null },
        { type: "payment", source: OPERATOR, destination: OTHER, amount: "20", asset: "XLM", memo: null },
      ],
    }),
  });
  record("envelope hides a second payment", CONFORMANCE.MISMATCH, batched.verdict, batched.reasons.join(","));

  // --- 9..11: receipts, tampering, chain -------------------------------------
  const receipt = issueReceipt({
    intent: intent(),
    policy: POLICY,
    execution: envelope(intent()),
    decision: allow,
    now: NOW,
    privateKeyPem: keys.privateKeyPem,
    seq: 0,
  });
  const verified = verifyReceipt({ receipt, publicKeyPem: keys.publicKeyPem });
  record("receipt verifies independently", VERIFY_STATUS.VERIFIED, verified.status);

  const tampered = structuredClone(receipt);
  tampered.subject.intent.amount = "9";
  record("amount edited in a signed receipt", VERIFY_STATUS.TAMPERED,
    verifyReceipt({ receipt: tampered, publicKeyPem: keys.publicKeyPem }).status);

  const blocked = issueReceipt({
    intent: intent(),
    policy: POLICY,
    execution: { ...envelope(intent()), status: "BLOCKED" },
    decision: allow,
    now: NOW,
    privateKeyPem: keys.privateKeyPem,
    seq: 1,
    prevReceiptDigest: receipt.receiptId,
  });
  const second = issueReceipt({
    intent: intent({ nonce: 2, amount: "20" }),
    policy: { ...POLICY, windowSpent: "80" },
    execution: null,
    decision: evaluate({ intent: intent({ nonce: 2, amount: "20" }), policy: { ...POLICY, windowSpent: "80" }, now: NOW }),
    now: NOW,
    privateKeyPem: keys.privateKeyPem,
    seq: 2,
    prevReceiptDigest: blocked.receiptId,
  });
  const chain = verifyChain({ receipts: [receipt, blocked, second], publicKeyPem: keys.publicKeyPem });
  record("3-receipt chain intact", VERIFY_STATUS.VERIFIED, chain.status);

  const broken = [receipt, { ...blocked, prevReceiptDigest: "sha256:" + "0".repeat(64) }, second];
  record("chain link broken", VERIFY_STATUS.TAMPERED,
    verifyChain({ receipts: broken, publicKeyPem: keys.publicKeyPem }).status);

  // --- print -----------------------------------------------------------------
  const width = 40;
  console.log("\nAGENT-GATE/1 — offline walkthrough (no network, no submission)\n");
  console.log("  " + "case".padEnd(width) + "expected".padEnd(11) + "actual".padEnd(11) + "verdict");
  console.log("  " + "-".repeat(width + 34));
  for (const r of results) {
    console.log(
      "  " + r.name.padEnd(width) + r.expected.padEnd(11) + r.actual.padEnd(11) + (r.ok ? "ok" : "DRIFT " + r.detail),
    );
  }
  const failed = results.filter((r) => !r.ok);
  console.log(`\n  ${results.length - failed.length}/${results.length} cases match the declared matrix`);
  console.log(`  runMode: ${status().runMode} · chainSubmission: ${status().chainSubmission} · integration: ${status().integrationStatus}`);
  console.log("  ceiling: every VERIFIED above is offline recomputation — no chain read, no audit, no funds.\n");
  return failed.length === 0 ? 0 : 1;
}

process.exit(main());

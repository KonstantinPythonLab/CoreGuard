/**
 * test/integrations/agent-payment-gate.test.mjs
 *
 * AGENT-GATE/1 contract: the gate decides deterministically, an envelope that
 * diverges from the authorized intent is refused, and an evidence receipt is
 * only VERIFIED when its bytes recompute — including after tampering.
 *
 * Every case here is offline. No network, no key of value, no submission.
 */
import test from "node:test";
import assert from "node:assert/strict";

import {
  AGENT_GATE_VERSION,
  AGENT_POLICY_VERSION,
  VERDICT,
  CONFORMANCE,
  VERIFY_STATUS,
  REASON,
  toStroops,
  validatePolicy,
  evaluate,
  checkConformance,
  issueReceipt,
  verifyReceipt,
  verifyChain,
  generateOperatorKeyPair,
  status,
  selfCheck,
} from "../../packages/agent-gate/index.mjs";

const NOW = "2026-11-10T12:00:00.000Z";
const OPERATOR = "GDJ3CRNLNDZ4AVWGPUG7DBC5BIAGMIONOONZGB5FSYAY44ZHOIPRKY7U";
const MERCHANT = "GAIH3ULLFQ4DGSECF2AR555KZ4KNDGEKN4AFI4SU2M7B43MGK3QJZNSR";
const OTHER = "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";

const POLICY = {
  version: AGENT_POLICY_VERSION,
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

const intent = (o = {}) => ({
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
  ...o,
});

const envelope = (i, o = {}) => ({
  status: "SIGNED_PENDING_SUBMIT",
  network: i.network,
  operations: [{
    type: "payment", source: i.source, destination: i.destination,
    amount: i.amount, asset: i.asset, memo: i.memo,
  }],
  ...o,
});

const keys = generateOperatorKeyPair();

test("amounts are fixed-point stroops, never JS floats", () => {
  assert.equal(toStroops("1"), 10_000_000n);
  assert.equal(toStroops("0.0000001"), 1n);
  assert.equal(toStroops("4.9"), 49_000_000n);
  assert.equal(toStroops("0.1"), 1_000_000n);
  // 0.1 + 0.2 is the classic float trap; at 7 dp the strings must be exact.
  assert.equal(toStroops("0.1") + toStroops("0.2"), toStroops("0.3"));
  for (const bad of ["1.12345678", "-1", "1e3", "", 1, null, "01"]) {
    assert.equal(toStroops(bad), null, `must refuse ${JSON.stringify(bad)}`);
  }
});

test("an unreadable mandate holds — it never becomes 'no limits'", () => {
  const gate = evaluate({ intent: intent(), policy: { ...POLICY, perTxMax: 100 }, now: NOW });
  assert.equal(gate.verdict, VERDICT.HOLD);
  assert.deepEqual(gate.reasons, [REASON.POLICY_UNUSABLE]);
  assert.equal(validatePolicy({ ...POLICY, perTxMax: 100 }).ok, false);
  assert.equal(validatePolicy(POLICY).ok, true);
});

test("the gate returns ALLOW / DENY / HOLD with named reason codes", () => {
  assert.equal(evaluate({ intent: intent(), policy: POLICY, now: NOW }).verdict, VERDICT.ALLOW);

  const cases = [
    [{ amount: "150" }, POLICY, VERDICT.DENY, REASON.PER_TX_LIMIT_EXCEEDED],
    [{ amount: "90" }, { ...POLICY, windowSpent: "200" }, VERDICT.DENY, REASON.WINDOW_LIMIT_EXCEEDED],
    [{ destination: OTHER }, POLICY, VERDICT.DENY, REASON.RECIPIENT_NOT_ALLOWED],
    [{ asset: "USDC" }, POLICY, VERDICT.DENY, REASON.ASSET_NOT_ALLOWED],
    [{ network: "mainnet" }, POLICY, VERDICT.DENY, REASON.NETWORK_MISMATCH],
    [{ agentId: "unknown-agent" }, POLICY, VERDICT.DENY, REASON.AGENT_NOT_AUTHORIZED],
    [{ expiresAt: "2026-11-10T11:00:00.000Z" }, POLICY, VERDICT.DENY, REASON.INTENT_EXPIRED],
    [{ amount: "1.12345678" }, POLICY, VERDICT.DENY, REASON.AMOUNT_UNPARSEABLE],
    [{ amount: "0" }, POLICY, VERDICT.DENY, REASON.SCHEMA_INVALID],
    [{ memo: null }, { ...POLICY, requireMemo: true }, VERDICT.HOLD, REASON.MEMO_REQUIRED],
    [{ expiresAt: null }, POLICY, VERDICT.HOLD, REASON.EXPIRY_MISSING],
  ];
  for (const [patch, policy, expected, reason] of cases) {
    const out = evaluate({ intent: intent(patch), policy, now: NOW });
    assert.equal(out.verdict, expected, `${JSON.stringify(patch)} → ${out.verdict}`);
    assert.ok(out.reasons.includes(reason), `${JSON.stringify(patch)} must name ${reason}, got ${out.reasons}`);
  }
});

test("a field the gate never evaluated cannot enter the authorization path", () => {
  const out = evaluate({ intent: { ...intent(), fee: "1" }, policy: POLICY, now: NOW });
  assert.equal(out.verdict, VERDICT.DENY);
  assert.ok(out.reasons.includes(REASON.UNKNOWN_FIELD));
});

test("the gate is deterministic: same bytes, same decision and digest", () => {
  const a = evaluate({ intent: intent(), policy: POLICY, now: NOW });
  const b = evaluate({ intent: intent(), policy: POLICY, now: NOW });
  assert.deepEqual(a, b);
  assert.match(a.intentDigest, /^sha256:[0-9a-f]{64}$/);
  // A different authorized amount is a different authorization.
  const c = evaluate({ intent: intent({ amount: "81" }), policy: POLICY, now: NOW });
  assert.notEqual(c.intentDigest, a.intentDigest);
});

test("conformance refuses a drifted envelope and a batched one", () => {
  const honest = checkConformance({ intent: intent(), execution: envelope(intent()) });
  assert.equal(honest.verdict, CONFORMANCE.VERIFIED);

  const drift = checkConformance({
    intent: intent(),
    execution: envelope(intent(), {
      operations: [{ type: "payment", source: OPERATOR, destination: OTHER, amount: "95", asset: "XLM", memo: null }],
    }),
  });
  assert.equal(drift.verdict, CONFORMANCE.MISMATCH);
  const fields = drift.mismatches.map((m) => m.field).sort();
  assert.deepEqual(fields, ["amount", "destination"]);

  const batched = checkConformance({
    intent: intent(),
    execution: envelope(intent(), {
      operations: [
        { type: "payment", source: OPERATOR, destination: MERCHANT, amount: "80", asset: "XLM", memo: null },
        { type: "payment", source: OPERATOR, destination: OTHER, amount: "20", asset: "XLM", memo: null },
      ],
    }),
  });
  assert.equal(batched.verdict, CONFORMANCE.MISMATCH);
  assert.ok(batched.reasons.includes(REASON.MULTI_OP_DIVERGENCE));

  // Missing execution is UNKNOWN — an unverifiable envelope is not a pass.
  assert.equal(checkConformance({ intent: intent(), execution: null }).verdict, CONFORMANCE.UNKNOWN);
  assert.equal(checkConformance({ intent: intent(), execution: { network: "testnet" } }).verdict, CONFORMANCE.UNKNOWN);

  // An envelope bound to a different authorization is refused even if the
  // fields happen to look right.
  const rebound = checkConformance({
    intent: intent(),
    execution: envelope(intent(), { intentDigest: evaluate({ intent: intent({ amount: "1" }), policy: POLICY, now: NOW }).intentDigest }),
  });
  assert.equal(rebound.verdict, CONFORMANCE.MISMATCH);
  assert.ok(rebound.reasons.includes(REASON.INTENT_DIGEST_MISMATCH));
});

test("a receipt verifies from its bytes alone, and tampering is caught", () => {
  const decision = evaluate({ intent: intent(), policy: POLICY, now: NOW });
  const receipt = issueReceipt({
    intent: intent(), policy: POLICY, execution: envelope(intent()),
    decision, now: NOW, privateKeyPem: keys.privateKeyPem,
  });

  const ok = verifyReceipt({ receipt, publicKeyPem: keys.publicKeyPem });
  assert.equal(ok.status, VERIFY_STATUS.VERIFIED);
  assert.match(ok.ceiling, /OFFLINE_RECOMPUTATION/);

  // The public key must matter: a different operator key cannot bless it.
  const stranger = generateOperatorKeyPair();
  assert.equal(verifyReceipt({ receipt, publicKeyPem: stranger.publicKeyPem }).status, VERIFY_STATUS.TAMPERED);

  // Edit the authorized amount and keep every stored digest.
  const amountEdit = structuredClone(receipt);
  amountEdit.subject.intent.amount = "9";
  const r1 = verifyReceipt({ receipt: amountEdit, publicKeyPem: keys.publicKeyPem });
  assert.equal(r1.status, VERIFY_STATUS.TAMPERED);
  assert.ok(r1.findings.some((f) => f.id === "SIGNATURE_INVALID"));

  // Rewrite the decision to ALLOW while the mandate refuses it.
  const denyDecision = evaluate({ intent: intent({ amount: "150" }), policy: POLICY, now: NOW });
  const denied = issueReceipt({
    intent: intent({ amount: "150" }), policy: POLICY, execution: null,
    decision: denyDecision, now: NOW, privateKeyPem: keys.privateKeyPem,
  });
  assert.equal(verifyReceipt({ receipt: denied, publicKeyPem: keys.publicKeyPem }).status, VERIFY_STATUS.VERIFIED);
  const forged = structuredClone(denied);
  forged.decision.verdict = VERDICT.ALLOW;
  forged.decision.reasons = [];
  const r2 = verifyReceipt({ receipt: forged, publicKeyPem: keys.publicKeyPem });
  assert.equal(r2.status, VERIFY_STATUS.TAMPERED);
  assert.ok(r2.findings.some((f) => f.id === "DECISION_NOT_REPRODUCIBLE"));
});

test("a refused decision cannot carry a submitted execution", () => {
  const decision = evaluate({ intent: intent(), policy: POLICY, now: NOW });
  assert.throws(
    () => issueReceipt({
      intent: intent(), policy: POLICY,
      execution: { ...envelope(intent()), status: "SUBMITTED" },
      decision: { ...decision, verdict: VERDICT.DENY, reasons: [REASON.PER_TX_LIMIT_EXCEEDED] },
      now: NOW, privateKeyPem: keys.privateKeyPem,
    }),
    /refused decision cannot carry a submitted execution/,
  );

  // And a receipt that records one anyway is refused by the verifier.
  const allowReceipt = issueReceipt({
    intent: intent(), policy: POLICY, execution: { ...envelope(intent()), status: "SUBMITTED" },
    decision, now: NOW, privateKeyPem: keys.privateKeyPem,
  });
  const contradicting = structuredClone(allowReceipt);
  contradicting.subject.execution.operations[0].destination = OTHER;
  const out = verifyReceipt({ receipt: contradicting, publicKeyPem: keys.publicKeyPem });
  assert.equal(out.status, VERIFY_STATUS.TAMPERED);
  assert.ok(out.findings.some((f) => /SUBMITTED_WITHOUT_CONFORMANCE|CONFORMANCE_NOT_REPRODUCIBLE/.test(f.id)));
});

test("the receipt chain refuses a gap or a broken link", () => {
  const decision = evaluate({ intent: intent(), policy: POLICY, now: NOW });
  const first = issueReceipt({
    intent: intent(), policy: POLICY, execution: envelope(intent()),
    decision, now: NOW, privateKeyPem: keys.privateKeyPem, seq: 0,
  });
  const second = issueReceipt({
    intent: intent({ nonce: 2, amount: "20" }),
    policy: { ...POLICY, windowSpent: "80" },
    execution: null,
    decision: evaluate({ intent: intent({ nonce: 2, amount: "20" }), policy: { ...POLICY, windowSpent: "80" }, now: NOW }),
    now: NOW, privateKeyPem: keys.privateKeyPem, seq: 1, prevReceiptDigest: first.receiptId,
  });

  assert.equal(verifyChain({ receipts: [first, second], publicKeyPem: keys.publicKeyPem }).status, VERIFY_STATUS.VERIFIED);
  assert.equal(verifyChain({ receipts: [first, { ...second, prevReceiptDigest: null }], publicKeyPem: keys.publicKeyPem }).status, VERIFY_STATUS.TAMPERED);
  assert.equal(verifyChain({ receipts: [first, { ...second, seq: 7 }], publicKeyPem: keys.publicKeyPem }).status, VERIFY_STATUS.TAMPERED);
  assert.equal(verifyChain({ receipts: [], publicKeyPem: keys.publicKeyPem }).status, VERIFY_STATUS.UNKNOWN);
});

test("status is two-axis honest: offline prototype, integration NOT_BUILT", () => {
  const s = status();
  assert.equal(s.version, AGENT_GATE_VERSION);
  assert.equal(s.runMode, "OFFLINE_PROTOTYPE");
  assert.equal(s.integrationStatus, "NOT_BUILT");
  assert.equal(s.chainSubmission, "NOT_PERFORMED");
  assert.equal(s.signer.startsWith("NOT_BUILT"), true);
  assert.equal(s.externalAdoption, 0);
  assert.equal(selfCheck().ok, true);
});

/**
 * test/integrations/agent-gate-replay-determinism.test.mjs — REPLAY/1
 *
 * The claim: a receipt is a pure function of committed bytes. Same intent, same
 * mandate, same envelope, pinned clock → the SAME canonical bytes, digests and
 * Ed25519 signature, on every run and every runtime.
 *
 * How that is proven without trusting this machine:
 *   - the golden vector is COMMITTED (test/fixtures/agent-gate/canonical-vectors.json);
 *   - `buildReplayVector()` (the same module the fixture generator uses)
 *     recomputes every value from the pinned inputs, so a byte of drift is red;
 *   - the keypair comes from a FIXED 32-byte seed and the envelope carries a
 *     PINNED time bound — a random key or a wall-clock time bound would make
 *     the hash differ on every run, which is exactly what this closes.
 *
 * Honest ceiling: this file runs on ONE runtime here. CI runs it on Node 22 and
 * Node 24; the committed vector is what makes those two runs comparable.
 *
 * Controls (each assertion must be able to fail): one stroop, one destination,
 * one mandate field, or a different time bound each change the derived value.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  canonicalJson, intentDigest, policyDigest, checkConformance, verifyReceipt,
  issueReceipt, evaluate, CONFORMANCE, VERDICT,
} from "../../packages/agent-gate/index.mjs";
import { buildPaymentEnvelope, decodeEnvelope } from "../../packages/agent-gate/adapters/stellar-xdr.mjs";
import {
  buildReplayVector, deterministicKeyPair, PINNED_NOW, FIXED_SEED_HEX,
  VECTOR_MERCHANT, REPLAY_VECTOR_VERSION,
} from "../../packages/agent-gate/replay-vector.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, "..", "..");
const VECTORS = join(repo, "test", "fixtures", "agent-gate", "canonical-vectors.json");

const fixture = existsSync(VECTORS) ? JSON.parse(readFileSync(VECTORS, "utf8")) : null;

test("the committed golden vector exists, is versioned, and is the one this build reproduces", () => {
  assert.ok(fixture, `missing committed vector at ${VECTORS} — regenerate with: node scripts/agent-gate-replay-vector.mjs --write`);
  assert.equal(fixture.schema, REPLAY_VECTOR_VERSION);
  assert.deepEqual(buildReplayVector(), fixture,
    "canonical bytes drifted from the committed vector — a cross-runtime change, or a silent contract edit");
});

test("the vector's recorded inputs reproduce its own expected values (no hidden state)", () => {
  assert.ok(fixture);
  const replayed = buildReplayVector(fixture.inputs);
  assert.deepEqual(replayed.expected, fixture.expected,
    "the vector is not reproducible from its own recorded inputs");
});

test("nothing in the EXPECTED half depends on the wall clock, the machine or the runtime", () => {
  assert.ok(fixture);
  const serialized = JSON.stringify(fixture.expected);
  // The intent's createdAt/expiresAt instants are authorized CONTENT. What must
  // never appear is a MEASUREMENT stamp — that would turn the vector into a
  // snapshot of one machine instead of a statement about the code.
  for (const forbidden of ["measuredAt", "generatedAt", "capturedAt", "nodeVersion", "hostPlatform"]) {
    assert.equal(serialized.includes(forbidden), false, `${forbidden} must not enter the expected values`);
  }
  assert.equal(Object.prototype.hasOwnProperty.call(fixture, "measuredAtUtc"), false,
    "the vector carries no measurement stamp of any kind");
  assert.doesNotMatch(serialized, /node_version|process\.version/i, "no runtime version may enter the expected values");
  // The pinned instant travels in `inputs`, which is what makes it auditable.
  assert.equal(fixture.inputs.now, PINNED_NOW);
  assert.equal(fixture.inputs.seedHex, FIXED_SEED_HEX);
});

test("the same inputs produce the identical receipt twice (no hidden clock or randomness)", () => {
  const first = buildReplayVector();
  const second = buildReplayVector();
  assert.equal(first.expected.receiptId, second.expected.receiptId);
  assert.equal(first.expected.signature, second.expected.signature);
  assert.equal(first.expected.envelopeTxHash, second.expected.envelopeTxHash);
  assert.equal(first.expected.receiptSha256, second.expected.receiptSha256);
});

test("key order and absent optional fields cannot change the authorized digest", () => {
  const { intent } = buildReplayVector().inputs;
  const expected = intentDigest(intent);
  const reordered = {
    nonce: intent.nonce, expiresAt: intent.expiresAt, createdAt: intent.createdAt,
    memo: intent.memo, network: intent.network, asset: intent.asset, amount: intent.amount,
    destination: intent.destination, source: intent.source, agentId: intent.agentId,
  };
  assert.equal(canonicalJson(reordered), canonicalJson(intent));
  assert.equal(intentDigest(reordered), expected);
  // A field the gate never evaluated is not part of the authorized object.
  assert.equal(intentDigest({ ...intent, note: "smuggled" }), expected);
});

test("controls: one stroop, one field, one mandate field or one time bound all change the result", () => {
  assert.ok(fixture);
  const { intent, policy, maxTime } = fixture.inputs;

  const stroop = { ...intent, amount: "80.0000001" };
  assert.notEqual(intentDigest(stroop), fixture.expected.intentDigest);
  assert.notEqual(intentDigest({ ...intent, destination: VECTOR_MERCHANT.replace(/.$/, "X") }), fixture.expected.intentDigest);
  assert.notEqual(policyDigest({ ...policy, perTxMax: "101" }), fixture.expected.policyDigest);
  assert.notEqual(policyDigest({ ...policy, windowId: "2026-12" }), fixture.expected.policyDigest);

  // The time bound is INSIDE the transaction hash: shifting it one second moves
  // the hash, which is why an unpinned build cannot be replayed.
  const shifted = buildPaymentEnvelope({
    source: intent.source, sequence: fixture.inputs.sequence,
    destination: intent.destination, amount: intent.amount, network: "testnet",
    maxTime: maxTime + 1,
  });
  assert.equal(shifted.ok, true, shifted.error);
  assert.notEqual(shifted.txHash, fixture.expected.envelopeTxHash);

  // Omitting maxTime uses the wall clock, so today's bytes differ from the
  // pinned vector — a direct demonstration of why the pinned form exists.
  const unpinned = buildPaymentEnvelope({
    source: intent.source, sequence: fixture.inputs.sequence,
    destination: intent.destination, amount: intent.amount, network: "testnet",
  });
  assert.equal(unpinned.ok, true, unpinned.error);
  assert.notEqual(unpinned.txHash, fixture.expected.envelopeTxHash);
});

test("the receipt the vector describes verifies as VERIFIED, offline", () => {
  assert.ok(fixture);
  const { intent, policy, now, seedHex, merchant, sequence, amount } = fixture.inputs;
  const keys = deterministicKeyPair(seedHex);
  assert.equal(keys.publicKeyPem, fixture.expected.publicKeyPem);

  const built = buildPaymentEnvelope({
    source: merchant, sequence, destination: merchant, amount, network: "testnet", maxTime: fixture.inputs.maxTime,
  });
  assert.equal(built.xdr, fixture.expected.envelopeXdr, "the envelope bytes themselves must be stable");
  const execution = decodeEnvelope({ xdr: built.xdr, network: "testnet" }).execution;
  const conformance = checkConformance({ intent, execution });
  assert.equal(conformance.verdict, CONFORMANCE.VERIFIED);
  assert.equal(conformance.verdict, fixture.expected.conformanceVerdict);

  const decision = evaluate({ intent, policy, now });
  assert.equal(decision.verdict, VERDICT.ALLOW);
  const receipt = issueReceipt({
    intent, policy, execution, decision, now, privateKeyPem: keys.privateKeyPem, seq: 0,
  });
  assert.equal(receipt.receiptId, fixture.expected.receiptId);
  assert.equal(receipt.signature, fixture.expected.signature);

  const verdict = verifyReceipt({ receipt, publicKeyPem: keys.publicKeyPem });
  assert.equal(verdict.status, "VERIFIED");
  assert.equal(verdict.ceiling, "OFFLINE_RECOMPUTATION — no chain read, no external audit");
});

/**
 * test/integrations/agent-gate-field-tamper.test.mjs — TAMPER-MATRIX/1
 *
 * The product claim that matters is narrow and testable:
 *
 *   after the gate authorizes an intent, NO change to the transaction that
 *   actually gets signed may still verify.
 *
 * This file flips ONE field at a time. Each case builds a real Stellar testnet
 * envelope that differs from the authorized intent in exactly one field, signs
 * it with the real key (a compromised wallet or a hostile server does hold the
 * key), decodes it, and demands a refusal. Two independent bindings must bite:
 *
 *   1. the transaction hash the wallet was asked to sign (txHash) must change,
 *      so a swapped envelope can never be mistaken for the authorized one;
 *   2. checkConformance() must return MISMATCH naming the field.
 *
 * A control case asserts the untampered envelope verifies, so the matrix can
 * never go green by refusing everything.
 *
 * Offline: throwaway keypairs, testnet XDR, nothing submitted, no network.
 */
import test from "node:test";
import assert from "node:assert/strict";

import * as Stellar from "@stellar/stellar-sdk";

import {
  evaluate, checkConformance, issueReceipt, verifyReceipt, generateOperatorKeyPair,
  CONFORMANCE, REASON, VERDICT,
} from "../../packages/agent-gate/index.mjs";
import {
  buildPaymentEnvelope, decodeEnvelope, NETWORK_PASSPHRASE,
} from "../../packages/agent-gate/adapters/stellar-xdr.mjs";

const NOW = "2026-11-10T14:00:00.000Z";
const MERCHANT = "GAIH3ULLFQ4DGSECF2AR555KZ4KNDGEKN4AFI4SU2M7B43MGK3QJZNSR";
const ATTACKER = "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";

const signer = Stellar.Keypair.random();
const address = signer.publicKey();
/** A real attacker account: they hold their OWN key, never the user's. */
const attacker = Stellar.Keypair.random();

const policy = {
  version: "AGENT-POLICY/1",
  network: "testnet",
  agents: ["agent-tamper"],
  assets: ["XLM"],
  recipients: [MERCHANT],
  perTxMax: "100",
  windowMax: "250",
  windowSpent: "0",
  windowId: "2026-11",
  requireMemo: false,
};

const intent = {
  agentId: "agent-tamper",
  source: address,
  destination: MERCHANT,
  amount: "80",
  asset: "XLM",
  network: "testnet",
  memo: null,
  createdAt: "2026-11-10T13:59:30.000Z",
  expiresAt: "2026-11-10T14:05:00.000Z",
  nonce: 1,
};

/** The envelope the gate authorized. */
const authorized = buildPaymentEnvelope({
  source: address, sequence: "1", destination: MERCHANT, amount: "80", network: "testnet",
});

function signedXdrOf(xdr, keypair = signer) {
  const tx = Stellar.TransactionBuilder.fromXDR(xdr, NETWORK_PASSPHRASE.testnet);
  tx.sign(keypair);
  return tx.toXDR();
}

/** Sign, decode, conform — the same path a submitter must walk. */
function walk(xdr, { decodeNetwork = "testnet", keypair = signer } = {}) {
  const signed = signedXdrOf(xdr, keypair);
  const decoded = decodeEnvelope({ xdr: signed, network: decodeNetwork });
  assert.equal(decoded.ok, true, `envelope must decode: ${decoded.error}`);
  return {
    signed,
    execution: decoded.execution,
    conformance: checkConformance({ intent, execution: decoded.execution }),
  };
}

/** One tampered envelope per field: the ONLY difference is the named field. */
const CASES = [
  {
    field: "destination",
    build: () => buildPaymentEnvelope({
      source: address, sequence: "1", destination: ATTACKER, amount: "80", network: "testnet",
    }),
  },
  {
    field: "amount",
    build: () => buildPaymentEnvelope({
      source: address, sequence: "1", destination: MERCHANT, amount: "80.0000001", network: "testnet",
    }),
  },
  {
    field: "asset",
    build: () => buildPaymentEnvelope({
      source: address, sequence: "1", destination: MERCHANT, amount: "80",
      asset: `USDC:${MERCHANT}`, network: "testnet",
    }),
  },
  {
    field: "source",
    build: () => buildPaymentEnvelope({
      source: attacker.publicKey(), sequence: "1", destination: MERCHANT, amount: "80", network: "testnet",
    }),
    keypair: attacker,
  },
  {
    field: "memo",
    build: () => buildPaymentEnvelope({
      source: address, sequence: "1", destination: MERCHANT, amount: "80", memo: "INV-1", network: "testnet",
    }),
  },
];

test("control: the authorized envelope verifies, so the matrix cannot pass by refusing everything", () => {
  assert.equal(authorized.ok, true);
  const { execution, conformance } = walk(authorized.xdr, { decodeNetwork: "testnet" });
  assert.equal(conformance.verdict, CONFORMANCE.VERIFIED);
  assert.deepEqual(conformance.mismatches, []);
  assert.equal(execution.txHash, authorized.txHash, "signing must not change the authorized transaction hash");
  assert.equal(execution.signatureCount, 1);
});

test("every authorized field, flipped alone after authorization, is refused by name", () => {
  const observed = [];
  for (const c of CASES) {
    const built = c.build();
    assert.equal(built.ok, true, `${c.field}: envelope must build`);
    assert.notEqual(built.txHash, authorized.txHash,
      `${c.field}: the transaction hash must change — otherwise the wallet is signing the authorized bytes`);

    // A hostile signer can hold the key; the defense is the BINDING, not the key.
    const keypair = c.keypair ?? signer;
    const { execution, conformance } = walk(built.xdr, { keypair });
    assert.notEqual(execution.txHash, authorized.txHash,
      `${c.field}: the decoded hash must not equal the authorized hash`);
    assert.equal(conformance.verdict, CONFORMANCE.MISMATCH, `${c.field} was not refused`);
    assert.ok(conformance.mismatches.some((m) => m.field === c.field),
      `${c.field}: the refusal must name the field, got ${JSON.stringify(conformance.mismatches)}`);
    assert.ok(conformance.reasons.includes(REASON.FIELD_MISMATCH),
      `${c.field}: FIELD_MISMATCH must be in the reason set`);
    observed.push(c.field);
  }
  // [C35] discipline: the matrix must have actually walked every field.
  assert.deepEqual(observed, CASES.map((c) => c.field));
});

test("a reading under the wrong network passphrase is refused, not silently accepted", () => {
  // An envelope carries no network field: the same bytes read as mainnet yield a
  // DIFFERENT transaction hash. A caller that is wrong about the network must be
  // caught by conformance rather than trusted.
  const signed = signedXdrOf(authorized.xdr);
  const asMainnet = decodeEnvelope({ xdr: signed, network: "mainnet" });
  assert.equal(asMainnet.ok, true);
  assert.notEqual(asMainnet.execution.txHash, authorized.txHash);
  const conformance = checkConformance({ intent, execution: asMainnet.execution });
  assert.equal(conformance.verdict, CONFORMANCE.MISMATCH);
  assert.ok(conformance.mismatches.some((m) => m.field === "network"));
});

test("structural changes (a second payment, an unsupported op type) are refused", () => {
  // A batch that buries a second payment.
  const batch = new Stellar.TransactionBuilder(
    new Stellar.Account(address, "2"),
    { fee: "200", networkPassphrase: NETWORK_PASSPHRASE.testnet },
  )
    .addOperation(Stellar.Operation.payment({ destination: MERCHANT, asset: Stellar.Asset.native(), amount: "80" }))
    .addOperation(Stellar.Operation.payment({ destination: ATTACKER, asset: Stellar.Asset.native(), amount: "20" }))
    .setTimeout(180)
    .build();
  batch.sign(signer);
  const batched = checkConformance({
    intent,
    execution: decodeEnvelope({ xdr: batch.toXDR(), network: "testnet" }).execution,
  });
  assert.equal(batched.verdict, CONFORMANCE.MISMATCH);
  assert.ok(batched.reasons.includes(REASON.MULTI_OP_DIVERGENCE));

  // An operation type AGENT-GATE/1 does not authorize is refused, not ignored.
  const data = new Stellar.TransactionBuilder(
    new Stellar.Account(address, "3"),
    { fee: "100", networkPassphrase: NETWORK_PASSPHRASE.testnet },
  )
    .addOperation(Stellar.Operation.manageData({ name: "approval", value: "yes" }))
    .setTimeout(180)
    .build();
  data.sign(signer);
  const unsupported = checkConformance({
    intent,
    execution: decodeEnvelope({ xdr: data.toXDR(), network: "testnet" }).execution,
  });
  assert.equal(unsupported.verdict, CONFORMANCE.MISMATCH);
  assert.ok(unsupported.reasons.includes(REASON.OPERATION_TYPE_MISMATCH));
});

test("the refusal survives into the evidence layer: a receipt for a tampered envelope is TAMPERED", () => {
  const keys = generateOperatorKeyPair();
  const decision = evaluate({ intent, policy, now: NOW });
  assert.equal(decision.verdict, VERDICT.ALLOW);

  const clean = walk(authorized.xdr);
  const receipt = issueReceipt({
    intent, policy, execution: clean.execution, decision, now: NOW, privateKeyPem: keys.privateKeyPem, seq: 0,
  });
  assert.equal(verifyReceipt({ receipt, publicKeyPem: keys.publicKeyPem }).status, "VERIFIED");

  // A receipt issued for the TAMPERED envelope must record the divergence, not
  // smooth it over: the stored conformance is MISMATCH, and the moment the
  // execution claims SUBMITTED the receipt stops verifying.
  const tamperedExec = walk(CASES[0].build().xdr).execution;
  const honest = issueReceipt({
    intent, policy, execution: tamperedExec, decision, now: NOW, privateKeyPem: keys.privateKeyPem, seq: 0,
  });
  assert.equal(honest.conformance.verdict, CONFORMANCE.MISMATCH);
  assert.equal(verifyReceipt({ receipt: honest, publicKeyPem: keys.publicKeyPem }).status, "VERIFIED",
    "a receipt that faithfully records a MISMATCH is verifiable evidence OF the refusal");

  const claimed = issueReceipt({
    intent, policy, execution: { ...tamperedExec, status: "SUBMITTED" },
    decision, now: NOW, privateKeyPem: keys.privateKeyPem, seq: 1,
  });
  const verdict = verifyReceipt({ receipt: claimed, publicKeyPem: keys.publicKeyPem });
  assert.equal(verdict.status, "TAMPERED");
  assert.ok(verdict.findings.some((f) => f.id === "SUBMITTED_WITHOUT_CONFORMANCE"));
});

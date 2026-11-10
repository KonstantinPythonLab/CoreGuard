/**
 * test/integrations/agent-gate-envelope.test.mjs
 *
 * The signed envelope is the unit of verification: AGENT-XDR/1 decodes what the
 * wallet produced, FREIGHTER-ADAPTER/1 refuses a wallet that returns the wrong
 * bytes, and verify-cli.mjs keeps exit-code discipline a reviewer can script.
 *
 * Offline: throwaway keypairs, testnet XDR, nothing submitted.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import * as Stellar from "@stellar/stellar-sdk";

import {
  evaluate, checkConformance, issueReceipt, generateOperatorKeyPair,
  VERDICT, CONFORMANCE, REASON,
} from "../../packages/agent-gate/index.mjs";
import {
  buildPaymentEnvelope, decodeEnvelope, looksLikeSecretKey, NETWORK_PASSPHRASE, status as xdrStatus,
} from "../../packages/agent-gate/adapters/stellar-xdr.mjs";
import { requestSignature, freighterAvailable, status as freighterStatus } from "../../packages/agent-gate/adapters/freighter.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, "..", "..");
const CLI = join(repo, "packages", "agent-gate", "verify-cli.mjs");

const NOW = "2026-11-10T14:00:00.000Z";
const MERCHANT = "GAIH3ULLFQ4DGSECF2AR555KZ4KNDGEKN4AFI4SU2M7B43MGK3QJZNSR";
const ATTACKER = "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";

const signer = Stellar.Keypair.random();
const address = signer.publicKey();

const policy = {
  version: "AGENT-POLICY/1",
  network: "testnet",
  agents: ["agent-envelope"],
  assets: ["XLM"],
  recipients: [MERCHANT],
  perTxMax: "100",
  windowMax: "250",
  windowSpent: "0",
  windowId: "2026-11",
  requireMemo: false,
};

const intent = {
  agentId: "agent-envelope",
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

/** Freighter-shaped wallet: holds the key, returns signed XDR. */
function walletFor(keypair, override = null) {
  return {
    address: keypair.publicKey(),
    async signTransaction(xdr) {
      if (override) return override(xdr, keypair);
      const tx = Stellar.TransactionBuilder.fromXDR(xdr, NETWORK_PASSPHRASE.testnet);
      tx.sign(keypair);
      return tx.toXDR();
    },
  };
}

const built = buildPaymentEnvelope({
  source: address, sequence: "1", destination: MERCHANT, amount: "80", network: "testnet",
});

test("the builder refuses to be handed a secret key, and demands a real sequence", () => {
  const secret = Stellar.Keypair.random().secret();
  assert.equal(looksLikeSecretKey(secret), true);
  const refused = buildPaymentEnvelope({
    source: secret, sequence: "1", destination: MERCHANT, amount: "80",
  });
  assert.equal(refused.ok, false);
  assert.match(refused.error, /never accepts a secret/);

  assert.equal(buildPaymentEnvelope({ source: address, destination: MERCHANT, amount: "80" }).ok, false);
  assert.equal(buildPaymentEnvelope({ source: address, sequence: "1", destination: MERCHANT }).ok, false);
  assert.equal(built.ok, true);
  assert.equal(built.unsigned, true);
  assert.match(built.txHash, /^[0-9a-f]{64}$/);
});

test("decoding distinguishes an unsigned envelope from a signed one", () => {
  const unsigned = decodeEnvelope({ xdr: built.xdr, network: "testnet" });
  assert.equal(unsigned.ok, true);
  assert.equal(unsigned.execution.status, "BUILT");
  assert.equal(unsigned.execution.signatureCount, 0);

  const tx = Stellar.TransactionBuilder.fromXDR(built.xdr, NETWORK_PASSPHRASE.testnet);
  tx.sign(signer);
  const signed = decodeEnvelope({ xdr: tx.toXDR(), network: "testnet" });
  assert.equal(signed.ok, true);
  assert.equal(signed.execution.status, "SIGNED_PENDING_SUBMIT");
  assert.equal(signed.execution.signatureCount, 1);
  assert.equal(signed.execution.txHash, built.txHash, "signing must not change the transaction hash");
  assert.equal(signed.execution.operations.length, 1);
  assert.equal(signed.execution.operations[0].destination, MERCHANT);
  assert.equal(signed.execution.operations[0].asset, "XLM");
});

test("decoding fails closed on junk, a secret key, a wrong network and a fee-bump", () => {
  assert.equal(decodeEnvelope({ xdr: "not-xdr", network: "testnet" }).ok, false);
  assert.match(decodeEnvelope({ xdr: "not-xdr", network: "testnet" }).error, /decode failed/);

  const secret = Stellar.Keypair.random().secret();
  assert.match(decodeEnvelope({ xdr: secret, network: "testnet" }).error, /secret key/);

  assert.match(decodeEnvelope({ xdr: built.xdr, network: "regtest" }).error, /unknown network/);

  // An envelope carries NO network field. Reading the same bytes under the
  // mainnet passphrase succeeds and yields a DIFFERENT transaction hash, which
  // is precisely why a testnet signature cannot be replayed on mainnet. The
  // decoder must never pretend it can infer the network.
  const asMainnet = decodeEnvelope({ xdr: built.xdr, network: "mainnet" });
  assert.equal(asMainnet.ok, true);
  assert.notEqual(asMainnet.execution.txHash, built.txHash);
  assert.equal(decodeEnvelope({ xdr: built.xdr, network: "testnet" }).execution.txHash, built.txHash);

  const inner = Stellar.TransactionBuilder.fromXDR(built.xdr, NETWORK_PASSPHRASE.testnet);
  const feeBump = Stellar.TransactionBuilder.buildFeeBumpTransaction(
    signer, "200", inner, NETWORK_PASSPHRASE.testnet,
  );
  const feeBumpResult = decodeEnvelope({ xdr: feeBump.toXDR(), network: "testnet" });
  assert.equal(feeBumpResult.ok, false);
  assert.match(feeBumpResult.error, /fee-bump/);
});

test("conformance now runs on the SIGNED envelope, not on a description of it", () => {
  const tx = Stellar.TransactionBuilder.fromXDR(built.xdr, NETWORK_PASSPHRASE.testnet);
  tx.sign(signer);
  const execution = decodeEnvelope({ xdr: tx.toXDR(), network: "testnet" }).execution;
  const clean = checkConformance({ intent, execution });
  assert.equal(clean.verdict, CONFORMANCE.VERIFIED);

  // The attack: a second payment added before signing.
  const batch = new Stellar.TransactionBuilder(
    new Stellar.Account(address, "2"),
    { fee: "200", networkPassphrase: NETWORK_PASSPHRASE.testnet },
  )
    .addOperation(Stellar.Operation.payment({ destination: MERCHANT, asset: Stellar.Asset.native(), amount: "80" }))
    .addOperation(Stellar.Operation.payment({ destination: ATTACKER, asset: Stellar.Asset.native(), amount: "20" }))
    .setTimeout(180)
    .build();
  batch.sign(signer);
  const batched = checkConformance({ intent, execution: decodeEnvelope({ xdr: batch.toXDR(), network: "testnet" }).execution });
  assert.equal(batched.verdict, CONFORMANCE.MISMATCH);
  assert.ok(batched.reasons.includes(REASON.MULTI_OP_DIVERGENCE));

  // An operation type the gate does not authorize is refused, not ignored.
  const unsupported = checkConformance({
    intent,
    execution: {
      status: "SIGNED_PENDING_SUBMIT",
      network: "testnet",
      operations: [{ type: "manageData", source: address, unsupported: true, operationType: "manageData", memo: null }],
    },
  });
  assert.equal(unsupported.verdict, CONFORMANCE.MISMATCH);
  assert.ok(unsupported.reasons.includes(REASON.OPERATION_TYPE_MISMATCH));
});

test("the Freighter adapter never accepts a wallet that signs something else", async () => {
  assert.equal(freighterAvailable(undefined), false);

  const missing = await requestSignature({ xdr: built.xdr, network: "testnet" });
  assert.equal(missing.ok, false);
  assert.equal(missing.state, "NOT_PERFORMED");

  const throwing = await requestSignature({
    wallet: walletFor(signer, () => { throw new Error("user rejected"); }),
    xdr: built.xdr, network: "testnet",
  });
  assert.equal(throwing.state, "REFUSED");
  assert.match(throwing.error, /user rejected/);

  const empty = await requestSignature({ wallet: walletFor(signer, () => ""), xdr: built.xdr, network: "testnet" });
  assert.equal(empty.state, "REFUSED");

  const unsigned = await requestSignature({ wallet: walletFor(signer, (xdr) => xdr), xdr: built.xdr, network: "testnet" });
  assert.equal(unsigned.state, "REFUSED");
  assert.match(unsigned.error, /unsigned envelope/);

  const swapped = await requestSignature({
    wallet: walletFor(signer, (xdr, kp) => {
      const other = buildPaymentEnvelope({ source: address, sequence: "9", destination: ATTACKER, amount: "1", network: "testnet" });
      const tx = Stellar.TransactionBuilder.fromXDR(other.xdr, NETWORK_PASSPHRASE.testnet);
      tx.sign(kp);
      return tx.toXDR();
    }),
    xdr: built.xdr, network: "testnet", expectedTxHash: built.txHash,
  });
  assert.equal(swapped.state, "REFUSED");
  assert.match(swapped.error, /different bytes/);

  const good = await requestSignature({
    wallet: walletFor(signer), xdr: built.xdr, network: "testnet", expectedTxHash: built.txHash,
  });
  assert.equal(good.ok, true);
  assert.equal(good.state, "SIGNED");
  assert.equal(good.txHash, built.txHash);
  assert.equal(good.signatureCount, 1);
});

test("verify-cli keeps exit-code discipline: 0 / 2 / 3 / 4", () => {
  const dir = mkdtempSync(join(tmpdir(), "cg-verify-"));
  try {
    const keys = generateOperatorKeyPair();
    const keyPath = join(dir, "operator.pub");
    writeFileSync(keyPath, keys.publicKeyPem);

    const decision = evaluate({ intent, policy, now: NOW });
    assert.equal(decision.verdict, VERDICT.ALLOW);

    const tx = Stellar.TransactionBuilder.fromXDR(built.xdr, NETWORK_PASSPHRASE.testnet);
    tx.sign(signer);
    const signedXdr = tx.toXDR();
    const execution = decodeEnvelope({ xdr: signedXdr, network: "testnet" }).execution;

    const good = issueReceipt({
      intent, policy, execution, decision, now: NOW, privateKeyPem: keys.privateKeyPem, seq: 0,
    });
    const goodPath = join(dir, "good.json");
    writeFileSync(goodPath, JSON.stringify(good));
    const xdrPath = join(dir, "signed.xdr");
    writeFileSync(xdrPath, signedXdr);

    const run = (...args) => spawnSync(process.execPath, [CLI, ...args], { encoding: "utf8" });

    const verified = run("--receipt", goodPath, "--key", keyPath, "--xdr", xdrPath);
    assert.equal(verified.status, 0, verified.stdout + verified.stderr);
    assert.match(verified.stdout, /AGENT-GATE VERIFY — VERIFIED/);
    assert.match(verified.stdout, /envelope\s+MATCH/);

    // A refused execution recorded faithfully is exit 2, never 0.
    const drifted = buildPaymentEnvelope({ source: address, sequence: "2", destination: ATTACKER, amount: "95", network: "testnet" });
    const driftTx = Stellar.TransactionBuilder.fromXDR(drifted.xdr, NETWORK_PASSPHRASE.testnet);
    driftTx.sign(signer);
    const blocked = issueReceipt({
      intent, policy,
      execution: { ...decodeEnvelope({ xdr: driftTx.toXDR(), network: "testnet" }).execution, status: "BLOCKED" },
      decision, now: NOW, privateKeyPem: keys.privateKeyPem, seq: 1,
    });
    const blockedPath = join(dir, "blocked.json");
    writeFileSync(blockedPath, JSON.stringify(blocked));
    const refusal = run("--receipt", blockedPath, "--key", keyPath);
    assert.equal(refusal.status, 2, refusal.stdout + refusal.stderr);
    assert.match(refusal.stdout, /REFUSED execution/);

    // Tampering with the authorized amount must read as TAMPERED.
    const tampered = { ...good, subject: { ...good.subject, intent: { ...good.subject.intent, amount: "9" } } };
    const tamperedPath = join(dir, "tampered.json");
    writeFileSync(tamperedPath, JSON.stringify(tampered));
    assert.equal(run("--receipt", tamperedPath, "--key", keyPath).status, 3);

    // A receipt paired with an envelope it does not describe is tampered too.
    const other = buildPaymentEnvelope({ source: address, sequence: "3", destination: MERCHANT, amount: "81", network: "testnet" });
    const otherTx = Stellar.TransactionBuilder.fromXDR(other.xdr, NETWORK_PASSPHRASE.testnet);
    otherTx.sign(signer);
    const otherPath = join(dir, "other.xdr");
    writeFileSync(otherPath, otherTx.toXDR());
    const rebound = run("--receipt", goodPath, "--key", keyPath, "--xdr", otherPath);
    assert.equal(rebound.status, 3, rebound.stdout + rebound.stderr);
    assert.match(rebound.stdout, /ENVELOPE_NOT_THE_ONE_IN_THE_RECEIPT/);

    // Undecidable inputs are 4, never a green.
    assert.equal(run("--receipt", join(dir, "missing.json"), "--key", keyPath).status, 4);
    assert.equal(run("--receipt", goodPath).status, 4);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("both adapters report the same two-axis honesty as the rest of the repo", () => {
  const xdr = xdrStatus();
  assert.equal(xdr.integrationStatus, "NOT_BUILT");
  assert.match(xdr.signs, /NOT_BUILT/);
  assert.match(xdr.submits, /NOT_BUILT/);

  const wallet = freighterStatus();
  assert.equal(wallet.integrationStatus, "NOT_BUILT");
  assert.equal(wallet.exercisedWithRealWallet, false);
});

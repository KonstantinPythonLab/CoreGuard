/**
 * packages/agent-gate/replay-vector.mjs — AGENT-GATE-REPLAY-VECTOR/1
 *
 * One implementation of "derive every byte a verifier must reproduce", consumed
 * by two callers so they can never disagree:
 *
 *   - test/integrations/agent-gate-replay-determinism.test.mjs (asserts it)
 *   - scripts/agent-gate-replay-vector.mjs --write (regenerates the fixture)
 *
 * Determinism has two requirements, and both are explicit here:
 *   1. a FIXED Ed25519 seed (a random key would make the signature differ);
 *   2. a PINNED time bound on the envelope — `buildPaymentEnvelope()` otherwise
 *      derives `maxTime` from the wall clock, so the transaction hash (and thus
 *      the receipt) would change on every run. That is why the builder accepts
 *      an explicit `maxTime`.
 */

import { createHash, createPrivateKey, createPublicKey } from "node:crypto";

import {
  canonicalJson, intentDigest, policyDigest, evaluate, checkConformance,
  issueReceipt, AGENT_GATE_VERSION, AGENT_RECEIPT_VERSION, VERDICT,
} from "./index.mjs";
import { buildPaymentEnvelope, decodeEnvelope } from "./adapters/stellar-xdr.mjs";

export const REPLAY_VECTOR_VERSION = "AGENT-GATE-REPLAY-VECTOR/1";

/** Pinned decision instant. Nothing in the vector may read the wall clock. */
export const PINNED_NOW = "2026-11-10T14:00:00.000Z";

/** Fixed key material (RFC 8032). Not a secret: it exists to make bytes stable. */
export const FIXED_SEED_HEX = "9f2c1d7b3a5e6081c4d9e2f7a0b3c6d5e8f1a4b7c0d3e6f90213243546576879";

export const VECTOR_MERCHANT = "GAIH3ULLFQ4DGSECF2AR555KZ4KNDGEKN4AFI4SU2M7B43MGK3QJZNSR";

/** Ed25519 keypair from a fixed 32-byte seed (PKCS#8 prefix + seed). */
export function deterministicKeyPair(seedHex = FIXED_SEED_HEX) {
  const prefix = Buffer.from("302e020100300506032b657004220420", "hex");
  const key = createPrivateKey({
    key: Buffer.concat([prefix, Buffer.from(seedHex, "hex")]),
    format: "der",
    type: "pkcs8",
  });
  return {
    privateKeyPem: key.export({ type: "pkcs8", format: "pem" }).toString(),
    publicKeyPem: createPublicKey(key).export({ type: "spki", format: "pem" }).toString(),
  };
}

/**
 * Build the complete, self-describing vector for one pinned instant.
 * Returns `{schema, inputs, expected}` — `inputs` is enough to recompute
 * `expected` on any runtime, which is the whole point.
 */
export function buildReplayVector({
  now = PINNED_NOW,
  seedHex = FIXED_SEED_HEX,
  merchant = VECTOR_MERCHANT,
  sequence = "1",
  amount = "80",
} = {}) {
  const keys = deterministicKeyPair(seedHex);
  const maxTime = Math.floor(Date.parse(now) / 1000);

  const policy = {
    version: "AGENT-POLICY/1",
    network: "testnet",
    agents: ["agent-replay"],
    assets: ["XLM"],
    recipients: [merchant],
    perTxMax: "100",
    windowMax: "250",
    windowSpent: "0",
    windowId: "2026-11",
    requireMemo: false,
  };

  const intent = {
    agentId: "agent-replay",
    source: merchant,
    destination: merchant,
    amount,
    asset: "XLM",
    network: "testnet",
    memo: null,
    createdAt: "2026-11-10T13:59:30.000Z",
    expiresAt: "2026-11-10T14:05:00.000Z",
    nonce: 1,
  };

  const built = buildPaymentEnvelope({
    source: merchant, sequence, destination: merchant, amount, network: "testnet", maxTime,
  });
  if (!built.ok) throw new Error(`replay vector: envelope build failed: ${built.error}`);

  const execution = decodeEnvelope({ xdr: built.xdr, network: "testnet" }).execution;
  const decision = evaluate({ intent, policy, now });
  if (decision.verdict !== VERDICT.ALLOW) {
    throw new Error(`replay vector: the pinned inputs must be authorized, got ${decision.verdict}`);
  }

  const receipt = issueReceipt({
    intent, policy, execution, decision, now,
    privateKeyPem: keys.privateKeyPem, seq: 0,
  });

  return {
    schema: REPLAY_VECTOR_VERSION,
    inputs: {
      now,
      seedHex,
      merchant,
      sequence,
      amount,
      maxTime,
      intent,
      policy,
    },
    expected: {
      versions: { gate: AGENT_GATE_VERSION, receipt: AGENT_RECEIPT_VERSION },
      publicKeyPem: keys.publicKeyPem,
      envelopeXdr: built.xdr,
      envelopeTxHash: built.txHash,
      canonicalIntent: canonicalJson(intent),
      intentDigest: intentDigest(intent),
      policyDigest: policyDigest(policy),
      canonicalSubject: canonicalJson(receipt.subject),
      receiptId: receipt.receiptId,
      signature: receipt.signature,
      receiptSha256: `sha256:${createHash("sha256").update(JSON.stringify(receipt), "utf8").digest("hex")}`,
      conformanceVerdict: checkConformance({ intent, execution }).verdict,
    },
    ceiling: "OFFLINE_RECOMPUTATION — byte stability across runs and runtimes; not a chain read, not an audit",
  };
}

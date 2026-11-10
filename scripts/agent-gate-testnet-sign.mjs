#!/usr/bin/env node
/**
 * scripts/agent-gate-testnet-sign.mjs — AGENT-GATE/1 on the real Stellar testnet
 *
 * What this proves, and only this:
 *   1. an envelope BUILT by AGENT-XDR/1 is signed through the FREIGHTER-ADAPTER/1
 *      interface and ACCEPTED by Stellar testnet (a real ledger number),
 *   2. the hash the wallet returned is the hash the gate authorized,
 *   3. the SUBMITTED envelope replays through checkConformance() as VERIFIED and
 *      its Ed25519 receipt verifies from committed bytes alone.
 *
 * What it does NOT prove — stated here because the difference is the product:
 *   - that a real Freighter EXTENSION signed. The extension was probed in the
 *     available browser and is not installed (`window.freighter` is undefined),
 *     so the signer below is a local keypair behind the Freighter interface.
 *     The artifact records `wallet.kind`, not a marketing word.
 *   - adoption, an audit, or anything about funds beyond this one transfer.
 *
 * The signer key is generated IN MEMORY, funded by friendbot, used, and dropped.
 * It is never written to disk, never printed, and never read from `.env` — a
 * testnet run must not be able to touch the funded mainnet wallet.
 *
 * Modes:
 *   node scripts/agent-gate-testnet-sign.mjs --run     builds, signs, submits, writes the artifact
 *   node scripts/agent-gate-testnet-sign.mjs --verify  offline: re-derives the committed artifact
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import * as Stellar from "@stellar/stellar-sdk";

import { evaluate, checkConformance, issueReceipt, verifyReceipt, status as gateStatus } from "../packages/agent-gate/index.mjs";
import { buildPaymentEnvelope, decodeEnvelope, NETWORK_PASSPHRASE } from "../packages/agent-gate/adapters/stellar-xdr.mjs";
import { requestSignature, status as freighterStatus } from "../packages/agent-gate/adapters/freighter.mjs";

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..");
const ARTIFACT = join(REPO, "docs", "evidence", "agent-gate-testnet-signature.json");
const HORIZON = "https://horizon-testnet.stellar.org";
const FRIENDBOT = "https://friendbot.stellar.org";
const NETWORK = "testnet";
const AMOUNT = "0.0000001"; // one stroop: a real transfer, a negligible cost
const MEMO = "cg-agent-gate-e2e";

const sha256 = (text) => createHash("sha256").update(text, "utf8").digest("hex");

function horizon() {
  return new Stellar.Horizon.Server(HORIZON, { allowHttp: false });
}

async function accountSequence(publicKey) {
  const account = await horizon().accounts().accountId(publicKey).call();
  // SDK v17 exposes the sequence as a string property; older builds shipped a
  // sequenceNumber() method. Read whichever this install actually has.
  const sequence = account.sequence ?? (typeof account.sequenceNumber === "function" ? account.sequenceNumber() : null);
  return sequence === null || sequence === undefined ? null : String(sequence);
}

async function fund(publicKey) {
  const response = await fetch(`${FRIENDBOT}?addr=${encodeURIComponent(publicKey)}`);
  if (!response.ok && response.status !== 400) {
    throw new Error(`friendbot refused: HTTP ${response.status}`);
  }
  // friendbot returns 400 when the account already exists — not a failure here.
  const deadline = Date.now() + 30_000;
  let lastError = "no attempt recorded";
  while (Date.now() < deadline) {
    try {
      const sequence = await accountSequence(publicKey);
      if (sequence) return sequence;
      lastError = "account call returned an empty sequence";
    } catch (e) { lastError = e && e.message ? e.message : String(e); }
    await new Promise((resolve) => setTimeout(resolve, 1_500));
  }
  throw new Error(`friendbot funded nothing within 30s (last error: ${lastError})`);
}

/**
 * The signer is a local keypair behind the Freighter interface. It refuses any
 * envelope it did not itself decode, so a hash mismatch cannot be papered over.
 */
function localSignerBehindFreighterInterface(keypair) {
  return {
    kind: "local-keypair-behind-freighter-interface",
    async signTransaction(xdr, { networkPassphrase } = {}) {
      const tx = Stellar.TransactionBuilder.fromXDR(xdr, networkPassphrase);
      tx.sign(keypair);
      return tx.toXDR();
    },
  };
}

function probeObject() {
  return {
    windowFreighter: "undefined",
    windowFreighterApi: "undefined",
    note: "probed in the packaged Chromium before this run; the extension is not installed there",
    probedAt: new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
  };
}

async function run() {
  const signerKeys = Stellar.Keypair.random();   // in memory only
  const recipientKeys = Stellar.Keypair.random(); // in memory only
  const sequence = await fund(signerKeys.publicKey());
  // A payment cannot CREATE an account: an unfunded destination fails with
  // PAYMENT_NO_DESTINATION (-5), which the first run of this script hit. Both
  // sides are funded on testnet so the transfer exercises the payment rule and
  // not the account-creation rule.
  await fund(recipientKeys.publicKey());

  const now = new Date();
  const intent = {
    agentId: "agent://coreguard/e2e-1",
    source: signerKeys.publicKey(),
    destination: recipientKeys.publicKey(),
    amount: AMOUNT,
    asset: "XLM",
    network: NETWORK,
    memo: MEMO,
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + 10 * 60_000).toISOString(),
    nonce: 1,
  };
  const policy = {
    version: "AGENT-POLICY/1",
    network: NETWORK,
    assets: ["XLM"],
    recipients: [recipientKeys.publicKey()],
    agents: ["agent://coreguard/e2e-1"],
    perTxMax: "1",
    windowMax: "1",
    windowSpent: "0",
    windowId: `testnet-${now.toISOString().slice(0, 10)}`,
    requireMemo: true,
  };

  const decision = evaluate({ intent, policy, now: now.toISOString() });
  if (decision.verdict !== "ALLOW") {
    throw new Error(`gate refused its own test intent: ${decision.verdict} ${decision.reasons.join(",")}`);
  }

  const built = buildPaymentEnvelope({
    source: intent.source,
    sequence,
    destination: intent.destination,
    amount: intent.amount,
    asset: intent.asset,
    memo: intent.memo,
    network: NETWORK,
    fee: "100",
  });
  if (!built.ok) throw new Error(`envelope build failed: ${built.error}`);

  const wallet = localSignerBehindFreighterInterface(signerKeys);
  const signed = await requestSignature({
    wallet,
    xdr: built.xdr,
    network: NETWORK,
    address: intent.source,
    expectedTxHash: built.txHash,
  });
  if (!signed.ok) throw new Error(`adapter refused the signature: ${signed.error}`);

  const decoded = decodeEnvelope({ xdr: signed.signedXdr, network: NETWORK });
  if (!decoded.ok) throw new Error(`decode failed: ${decoded.error}`);

  const conformance = checkConformance({ intent, execution: decoded.execution });
  if (conformance.verdict !== "VERIFIED") {
    throw new Error(`conformance refused the signed envelope: ${JSON.stringify(conformance.mismatches)}`);
  }

  const tx = Stellar.TransactionBuilder.fromXDR(signed.signedXdr, NETWORK_PASSPHRASE[NETWORK]);
  let submitted;
  try {
    submitted = await horizon().submitTransaction(tx);
  } catch (e) {
    const codes = e?.response?.data?.extras?.result_codes ?? e?.response?.data?.result_codes ?? null;
    throw new Error(`testnet refused the submission: ${JSON.stringify(codes ?? (e && e.message ? e.message : e))}`);
  }

  // The receipt records a SUBMITTED execution: the one shape that is allowed to
  // claim a chain outcome, and only under an ALLOW decision.
  const submittedExecution = { ...decoded.execution, status: "SUBMITTED", txHash: signed.txHash, ledger: submitted.ledger };
  const operator = (await import("../packages/agent-gate/index.mjs")).generateOperatorKeyPair();
  const receipt = issueReceipt({
    intent,
    policy,
    execution: submittedExecution,
    decision,
    now: now.toISOString(),
    privateKeyPem: operator.privateKeyPem,
  });
  const verified = verifyReceipt({ receipt, publicKeyPem: operator.publicKeyPem });

  const artifact = {
    schema: "CoreGuard-Evidence/1",
    artifact: "agent-gate-testnet-signature",
    version: "AGENT-GATE/1",
    network: NETWORK,
    horizon: HORIZON,
    transfer: {
      source: intent.source,
      destination: intent.destination,
      amount: intent.amount,
      asset: intent.asset,
      memo: intent.memo,
    },
    gate: {
      verdict: decision.verdict,
      reasons: decision.reasons,
      intentDigest: decision.intentDigest,
      policyDigest: (await import("../packages/agent-gate/index.mjs")).policyDigest(policy),
    },
    envelope: {
      builtTxHash: built.txHash,
      signedTxHash: signed.txHash,
      hashMatch: built.txHash === signed.txHash,
      signatureCount: signed.signatureCount,
      fee: decoded.execution.fee,
      signedXdr: signed.signedXdr,
      signedXdrSha256: sha256(signed.signedXdr),
    },
    conformance: { verdict: conformance.verdict, mismatches: conformance.mismatches },
    submission: {
      hash: submitted.hash,
      ledger: submitted.ledger,
      successful: submitted.successful,
      feeCharged: String(submitted.fee_charged ?? ""),
      submittedAt: new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
      hashEqualsSigned: submitted.hash === signed.txHash,
    },
    receipt: {
      receiptId: receipt.receiptId,
      verifyStatus: verified.status,
      operatorPublicKeyPem: operator.publicKeyPem,
      receipt,
    },
    wallet: {
      kind: wallet.kind,
      adapter: freighterStatus().version,
      exercisedWithRealWallet: false,
      extensionProbe: probeObject(),
    },
    gateModuleStatus: {
      runMode: gateStatus().runMode,
      chainSubmission: gateStatus().chainSubmission,
      note: "this runner submits; the gate module itself still has no Horizon call",
    },
    costCeiling: "one testnet stroop plus the network fee; friendbot funded the signer, no mainnet key was read",
    ceiling:
      "Real testnet signature and real ledger inclusion, signed by a local keypair behind the Freighter interface. " +
      "A Freighter EXTENSION has still never signed here: window.freighter is undefined in the available browser. " +
      "This is not adoption, not an audit, and not a statement about funds beyond this single transfer.",
    generatedAt: new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
  };

  writeFileSync(ARTIFACT, `${JSON.stringify(artifact, null, 2)}\n`, "utf8");
  console.log(`gate verdict        : ${artifact.gate.verdict}`);
  console.log(`envelope hash match : ${artifact.envelope.hashMatch} (${artifact.envelope.signedTxHash})`);
  console.log(`conformance         : ${artifact.conformance.verdict}`);
  console.log(`submitted           : ${artifact.submission.successful} at ledger ${artifact.submission.ledger}`);
  console.log(`receipt             : ${artifact.receipt.verifyStatus} (${artifact.receipt.receiptId})`);
  console.log(`wallet              : ${artifact.wallet.kind} (real extension exercised: false)`);
  console.log(`artifact            : docs/evidence/agent-gate-testnet-signature.json`);
  if (!artifact.submission.successful || !artifact.envelope.hashMatch || artifact.receipt.verifyStatus !== "VERIFIED") {
    process.exitCode = 1;
  }
}

function verifyOffline() {
  if (!existsSync(ARTIFACT)) {
    console.error("no artifact to verify — run --run first");
    process.exit(2);
  }
  const artifact = JSON.parse(readFileSync(ARTIFACT, "utf8"));
  const problems = [];

  if (artifact.network !== NETWORK) problems.push(`network is ${artifact.network}, expected ${NETWORK}`);
  if (sha256(artifact.envelope.signedXdr) !== artifact.envelope.signedXdrSha256) {
    problems.push("signed XDR does not hash to the recorded digest");
  }

  const decoded = decodeEnvelope({ xdr: artifact.envelope.signedXdr, network: NETWORK });
  if (!decoded.ok) problems.push(`envelope does not decode: ${decoded.error}`);
  else {
    if (decoded.execution.txHash !== artifact.envelope.signedTxHash) {
      problems.push(`decoded hash ${decoded.execution.txHash} != recorded ${artifact.envelope.signedTxHash}`);
    }
    if (decoded.execution.source !== artifact.transfer.source) problems.push("decoded source differs from the artifact");
    const op = decoded.execution.operations[0] || {};
    if (op.destination !== artifact.transfer.destination) problems.push("decoded destination differs from the artifact");
    if (op.amount !== artifact.transfer.amount) problems.push("decoded amount differs from the artifact");
    if (op.asset !== artifact.transfer.asset) problems.push("decoded asset differs from the artifact");
    const rebuiltIntent = {
      ...artifact.transfer,
      agentId: artifact.receipt.receipt.subject.intent.agentId,
      network: artifact.network,
      memo: artifact.transfer.memo,
      createdAt: artifact.receipt.receipt.subject.intent.createdAt,
      expiresAt: artifact.receipt.receipt.subject.intent.expiresAt,
      nonce: artifact.receipt.receipt.subject.intent.nonce,
    };
    const conformance = checkConformance({ intent: rebuiltIntent, execution: decoded.execution });
    if (conformance.verdict !== "VERIFIED") {
      problems.push(`decoded envelope does not conform: ${JSON.stringify(conformance.mismatches)}`);
    }
  }

  const verified = verifyReceipt({
    receipt: artifact.receipt.receipt,
    publicKeyPem: artifact.receipt.operatorPublicKeyPem,
  });
  if (verified.status !== "VERIFIED") problems.push(`receipt verification: ${verified.status} ${JSON.stringify(verified.findings)}`);
  if (artifact.receipt.receipt.subject.execution?.status !== "SUBMITTED") {
    problems.push("receipt does not record a SUBMITTED execution");
  }
  if (artifact.wallet.exercisedWithRealWallet !== false) {
    problems.push("artifact claims a real wallet exercise — a probe says it was not performed");
  }

  if (problems.length > 0) {
    console.error("TESTNET-SIGNATURE-VERIFY: FAIL");
    for (const p of problems) console.error(`  - ${p}`);
    process.exit(1);
  }
  console.log("TESTNET-SIGNATURE-VERIFY: PASS");
  console.log(`  ledger ${artifact.submission.ledger} · tx ${artifact.submission.hash}`);
  console.log("  re-derived: envelope hash, operations, conformance, receipt signature");
  console.log("  ceiling: signed by a local keypair behind the Freighter interface — no extension signed this");
}

const mode = process.argv[2] ?? "";
if (mode === "--run") await run();
else if (mode === "--verify") verifyOffline();
else {
  console.log("usage: node scripts/agent-gate-testnet-sign.mjs --run | --verify");
  process.exitCode = 2;
}

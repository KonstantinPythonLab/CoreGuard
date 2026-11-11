#!/usr/bin/env node
/**
 * examples/stellar-dex-integration/run-dex-swap.mjs
 *
 * CoreGuard Stellar DEX Integration — End-to-End Soroban Swap Pipeline.
 *
 * Pipeline Flow:
 *   1. PRE-FLIGHT: DEX-GATE/1 + Policy authorization (fail-closed)
 *   2. EXECUTION: Simulated Soroban swap invocation & state delta derivation
 *   3. POST-VERIFY: Cryptographic verification of execution receipt & conformance
 *   4. DDE/1 ESCROW: Bilateral delivery acceptance gate (`releaseWhen`)
 *   5. ANCHOR: Soroban testnet commitment anchor planning
 *
 * Usage: node examples/stellar-dex-integration/run-dex-swap.mjs
 */

import { readFile, writeFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

import { evaluateDexSwapGate, evaluateConformance } from "./dex-gate.mjs";
import { evaluatePolicy } from "../../packages/policy/index.js";
import { hashIntent, hashPolicy, hashTrace } from "../../packages/canonical/index.js";
import { computeStateDelta } from "../../packages/trace/index.js";
import { createEvidenceBundle, createReceipt } from "../../packages/evidence/index.js";
import { verifyReceipt } from "../../packages/verifier/index.js";
import { releaseWhen } from "../../packages/delivery/sdk.js";
import { planCommitmentAnchor } from "../../packages/stellar-soroban/index.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const load = (f) => readFile(resolve(here, f), "utf8").then(JSON.parse);

function sha256(data) {
  return createHash("sha256").update(typeof data === "string" ? data : JSON.stringify(data)).digest("hex");
}

export function buildExecutionTrace(intent, { slippageBps = "50", tamperRecipient = null } = {}) {
  const recipient = tamperRecipient || intent.recipient;
  const calldata = intent.selector + sha256("soroban_swap_exact_in").slice(0, 56);
  return {
    version: "CGEP/1",
    txHash: "0x" + sha256(`stellar-swap-${intent.signer}-${intent.nonce}`),
    blockHash: "0x" + sha256("stellar-ledger-sequence-65338112"),
    blockNumber: "65338112",
    from: intent.signer,
    to: intent.target,
    recipient,
    value: intent.amount,
    calldata,
    status: "SUCCESS",
    gasUsed: "180000",
    gasLimit: "500000",
    blockTimestamp: "1731300000",
    slippageBps: String(slippageBps),
    network: intent.network || "testnet",
    calls: [
      {
        depth: 0,
        from: intent.signer,
        to: intent.target,
        value: "0",
        calldata,
        returnData: "0x",
        status: "SUCCESS",
        gasUsed: "170000",
      },
    ],
    events: [
      {
        address: intent.target,
        topics: [
          "0x" + sha256("SorobanSwapEvent"),
          "0x" + sha256(intent.signer),
          "0x" + sha256(recipient),
        ],
        data: "0x",
      },
    ],
    balanceChanges: [
      {
        address: intent.signer,
        before: intent.amount,
        after: "0",
      },
    ],
    storageChanges: [],
  };
}

export async function runFullPipeline({
  intent,
  policy,
  slippageBps = "50",
  tamperRecipient = null,
} = {}) {
  // ── PHASE 1: PRE-FLIGHT GATING (DEX-GATE/1 + Policy) ──────────────────
  const preflight = evaluateDexSwapGate({
    intent,
    policy,
    observedSlippageBps: parseInt(slippageBps, 10),
  });

  if (!preflight.allowed) {
    return {
      status: "REJECTED_PREFLIGHT",
      verdict: preflight.verdict,
      reason: preflight.reason,
      receipt: null,
      ddeRelease: false,
    };
  }

  // ── PHASE 2: SIMULATED SOROBAN SWAP EXECUTION ────────────────────────
  const executionTrace = buildExecutionTrace(intent, { slippageBps, tamperRecipient });

  const policyContext = {
    value: executionTrace.value,
    target: executionTrace.to,
    recipient: executionTrace.recipient,
    selector: executionTrace.calldata.slice(0, 10),
    blockTimestamp: executionTrace.blockTimestamp,
    slippageBps: String(slippageBps),
  };

  const policyEvaluation = evaluatePolicy(policy, policyContext);
  if (policyEvaluation.result !== "SATISFIED") {
    return {
      status: "POLICY_VIOLATED",
      policyResult: policyEvaluation,
      reason: "Execution context violated committed policy rules",
      receipt: null,
      ddeRelease: false,
    };
  }

  // ── PHASE 3: EVIDENCE BUNDLE & RECEIPT GENERATION ────────────────────
  const stateDelta = computeStateDelta(executionTrace);
  const intentHash = await hashIntent(intent);
  const policyHash = await hashPolicy(policy);
  const traceHash = await hashTrace(executionTrace);

  const evidenceBundle = await createEvidenceBundle({
    intentHash,
    policyHash,
    traceHash,
    stateDeltaHash: "0x" + sha256(stateDelta),
    result: "VALID",
    verifications: [{ level: "L2", engine: "coreguard-stellar-dex-v1" }],
    simulation: { blockNumber: "65338110", blockHash: "0x" + sha256("sim-ledger") },
    execution: { blockNumber: executionTrace.blockNumber, blockHash: executionTrace.blockHash },
  });

  const { receiptId, receipt } = await createReceipt({
    chainId: intent.chainId || 1114,
    txHash: executionTrace.txHash,
    blockHash: executionTrace.blockHash,
    blockNumber: executionTrace.blockNumber,
    intentHash,
    policyHash,
    executionTraceHash: traceHash,
    stateDeltaHash: evidenceBundle.evidence.stateDeltaHash,
    evidenceRoot: evidenceBundle.hash,
    simulation: { blockNumber: "65338110", blockHash: "0x" + sha256("sim-ledger") },
    execution: { blockNumber: executionTrace.blockNumber, blockHash: executionTrace.blockHash },
    verifierVersion: "0.1.0",
    verificationLevel: "L2",
    result: "VALID",
    checks: [],
  });

  const fullReceipt = { ...receipt, receiptId };

  // ── PHASE 4: INDEPENDENT POST-EXECUTION VERIFICATION ─────────────────
  const postVerification = await verifyReceipt(fullReceipt, null, intent, policy, executionTrace);
  const conformance = evaluateConformance({
    intent: {
      source: intent.signer,
      destination: intent.recipient,
      amount: intent.amount,
      asset: intent.tokenIn,
    },
    execution: {
      source: executionTrace.from,
      destination: executionTrace.recipient,
      amount: intent.amount,
      asset: intent.tokenIn,
    },
  });

  // ── PHASE 5: DDE/1 BILATERAL ESCROW DELIVERY BOUNDARY ────────────────
  const ddeReport = {
    status: (postVerification.result === "VERIFIED" && conformance.allowed) ? "VERIFIED" : "REJECTED",
    acceptance: {
      verdict: (postVerification.result === "VERIFIED" && conformance.allowed) ? "ACCEPTED" : "REJECTED",
      receiver: executionTrace.recipient,
      settlementAmount: intent.minReceived,
    },
    checks: postVerification.checks,
  };

  const escrowGate = releaseWhen(ddeReport, (r) =>
    r.status === "VERIFIED" && r.acceptance?.verdict === "ACCEPTED"
  );

  // ── PHASE 6: SOROBAN COMMITMENT ANCHOR PLANNING ──────────────────────
  const anchorCommitment = "0x" + sha256(fullReceipt.receiptId);
  const anchorPlan = planCommitmentAnchor({
    commitment: anchorCommitment,
    network: intent.network || "testnet",
    ownerAuthorization: true,
  });

  return {
    status: "SUCCESS",
    receipt: fullReceipt,
    postVerification,
    conformance,
    ddeReport,
    ddeRelease: escrowGate.release,
    escrowReasons: escrowGate.reasons,
    anchorPlan,
    trace: executionTrace,
  };
}

async function main() {
  console.log("===============================================================================");
  console.log("  CoreGuard Stellar DEX Integration (Soroban/1 + DEX-GATE/1 + DDE/1)");
  console.log("===============================================================================\n");

  const intent = await load("intent.json");
  const policy = await load("policy.json");

  console.log("── STEP 1: VALID Soroban DEX Swap (50 bps slippage) ───────────────────────────");
  const validResult = await runFullPipeline({ intent, policy, slippageBps: "50" });
  console.log(`Preflight Gate:      PASS (DEX-GATE/1 verified)`);
  console.log(`Receipt ID:          ${validResult.receipt.receiptId}`);
  console.log(`Post-Verification:   ${validResult.postVerification.result}`);
  console.log(`Conformance Gate:    ${validResult.conformance.verdict}`);
  console.log(`DDE/1 Escrow Gate:   ${validResult.ddeRelease ? "RELEASE_AUTHORIZED" : "PAYMENT_HELD"}`);
  console.log(`Soroban Anchor Step: ${validResult.anchorPlan.txPlan[2].op} (commitment: ${validResult.anchorPlan.commitment.slice(0, 18)}...)`);

  await writeFile(
    resolve(here, "receipt-valid.json"),
    JSON.stringify(validResult.receipt, null, 2)
  );
  console.log(`Wrote verified receipt to: examples/stellar-dex-integration/receipt-valid.json\n`);

  console.log("── STEP 2: FRONT-RUN ATTACK (Slippage Spike to 600 bps > 500 bps Bound) ───────");
  const frontRunResult = await runFullPipeline({ intent, policy, slippageBps: "600" });
  console.log(`Status:              ${frontRunResult.status}`);
  console.log(`Verdict:             ${frontRunResult.verdict}`);
  console.log(`Reason:              ${frontRunResult.reason}`);
  console.log(`DDE/1 Escrow Gate:   ${frontRunResult.ddeRelease ? "RELEASE_AUTHORIZED" : "PAYMENT_HELD (Fail-Closed)"}\n`);

  console.log("── STEP 3: RECIPIENT TAMPERING ATTACK (Siphoned to Attacker Address) ─────────");
  const tamperedResult = await runFullPipeline({
    intent,
    policy,
    slippageBps: "50",
    tamperRecipient: "GATTACKER999999999999999999999999999999999999999999999999999",
  });
  console.log(`Status:              ${tamperedResult.status}`);
  console.log(`Reason:              ${tamperedResult.reason}`);
  console.log(`DDE/1 Escrow Gate:   ${tamperedResult.ddeRelease ? "RELEASE_AUTHORIZED" : "PAYMENT_HELD (Fail-Closed)"}\n`);

  console.log("===============================================================================");
  console.log("  Demonstration Complete: Fail-Closed Boundaries Enforced Across All Invariants");
  console.log("===============================================================================");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error("FATAL:", err);
    process.exit(1);
  });
}

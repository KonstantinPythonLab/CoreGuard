#!/usr/bin/env node
/**
 * examples/stellar-dex-integration/test.mjs
 *
 * Test suite for CoreGuard Stellar DEX Integration (Issue #26).
 * Verifies all security invariants, adversarial cases, and fail-closed gates.
 *
 * Scenarios:
 *   1. Happy path: Valid Soroban swap → VERIFIED + DDE/1 release + Soroban anchor
 *   2. Adversarial: Front-run slippage violation (> 500 bps) → REJECTED_PREFLIGHT
 *   3. Adversarial: Calldata recipient redirection → POLICY_VIOLATED & conformance mismatch
 *   4. Adversarial: Receipt payload tampering → RECEIPT_COMMITMENT check FAIL
 *   5. Adversarial: Substitution under committed intent → TRACE_HASH check FAIL
 *
 * Usage: node examples/stellar-dex-integration/test.mjs
 */

import { readFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

import { runFullPipeline, buildExecutionTrace } from "./run-dex-swap.mjs";
import { evaluateDexSwapGate, evaluateConformance } from "./dex-gate.mjs";
import { verifyReceipt } from "../../packages/verifier/index.js";

const here = dirname(fileURLToPath(import.meta.url));
const load = (f) => readFile(resolve(here, f), "utf8").then(JSON.parse);

async function runTests() {
  console.log("===============================================================================");
  console.log("  Running Test Suite: CoreGuard Stellar DEX Integration (Soroban/1)");
  console.log("===============================================================================\n");

  const intent = await load("intent.json");
  const policy = await load("policy.json");
  let passed = 0;

  // Test 1: Happy path
  {
    console.log("Test 1: Happy path Soroban DEX swap");
    const res = await runFullPipeline({ intent, policy, slippageBps: "50" });
    assert.equal(res.status, "SUCCESS", "Pipeline should succeed for valid swap");
    assert.equal(res.postVerification.result, "VERIFIED", "Post-verification must be VERIFIED");
    assert.equal(res.conformance.verdict, "VERIFIED", "Conformance must be VERIFIED");
    assert.equal(res.ddeRelease, true, "DDE/1 escrow release must be true");
    assert.equal(res.anchorPlan.ok, true, "Soroban anchor plan must be ok");
    console.log("  ✓ PASS: Valid swap verified, escrow released, anchor planned\n");
    passed++;
  }

  // Test 2: Adversarial front-run slippage
  {
    console.log("Test 2: Front-running slippage attack (600 bps > 500 bps bound)");
    const res = await runFullPipeline({ intent, policy, slippageBps: "600" });
    assert.equal(res.status, "REJECTED_PREFLIGHT", "Should be rejected at preflight");
    assert.equal(res.verdict, "REJECTED", "Verdict must be REJECTED");
    assert.equal(res.ddeRelease, false, "Escrow must remain held");
    assert.equal(res.receipt, null, "No receipt may be issued for rejected swap");
    console.log("  ✓ PASS: Slippage violation blocked before broadcast\n");
    passed++;
  }

  // Test 3: Adversarial recipient redirection
  {
    console.log("Test 3: Recipient redirection / siphon attack");
    const attacker = "GATTACKER999999999999999999999999999999999999999999999999999";
    const res = await runFullPipeline({
      intent,
      policy,
      slippageBps: "50",
      tamperRecipient: attacker,
    });
    assert.equal(res.status, "POLICY_VIOLATED", "Policy must flag recipient mismatch");
    assert.equal(res.ddeRelease, false, "Escrow release must be denied");
    assert.equal(res.receipt, null, "Receipt generation halted");

    // Conformance check explicitly catches mismatch
    const conf = evaluateConformance({
      intent: { source: intent.signer, destination: intent.recipient, amount: intent.amount, asset: intent.tokenIn },
      execution: { source: intent.signer, destination: attacker, amount: intent.amount, asset: intent.tokenIn },
    });
    assert.equal(conf.allowed, false, "Conformance check must reject redirected destination");
    console.log("  ✓ PASS: Siphoning attempt blocked by policy & conformance gate\n");
    passed++;
  }

  // Test 4: Tampered receipt verification
  {
    console.log("Test 4: Tampered receipt commitment mismatch");
    const valid = await runFullPipeline({ intent, policy, slippageBps: "50" });
    const tamperedReceipt = { ...valid.receipt, result: "INVALID" };
    const verification = await verifyReceipt(tamperedReceipt, null, intent, policy, valid.trace);
    assert.equal(verification.result, "INVALID", "Tampered receipt must be INVALID");
    const commitmentCheck = verification.checks.find((c) => c.check === "RECEIPT_COMMITMENT");
    assert.equal(commitmentCheck.result, "FAIL", "RECEIPT_COMMITMENT check must FAIL");
    console.log("  ✓ PASS: Tampered receipt rejected fail-closed\n");
    passed++;
  }

  // Test 5: Trace substitution under committed intent
  {
    console.log("Test 5: Execution trace substitution under committed intent");
    const valid = await runFullPipeline({ intent, policy, slippageBps: "50" });
    const substitutedTrace = buildExecutionTrace(intent, { slippageBps: "50" });
    substitutedTrace.txHash = "0x" + "ff".repeat(32);
    const verification = await verifyReceipt(valid.receipt, null, intent, policy, substitutedTrace);
    assert.equal(verification.result, "INVALID", "Substituted trace must be INVALID");
    const traceCheck = verification.checks.find((c) => c.check === "TRACE_HASH");
    assert.equal(traceCheck.result, "FAIL", "TRACE_HASH check must FAIL");
    console.log("  ✓ PASS: Execution substitution detected and rejected\n");
    passed++;
  }

  console.log("===============================================================================");
  console.log(`  All ${passed}/5 Tests Passed with Exit Code 0`);
  console.log("===============================================================================");
  return 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runTests().catch((err) => {
    console.error("TEST FAILED:", err);
    process.exit(1);
  });
}

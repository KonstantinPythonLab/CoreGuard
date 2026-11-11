/**
 * examples/stellar-dex-integration/dex-gate.mjs
 *
 * CoreGuard Stellar Soroban DEX Preflight Gate (DEX-GATE/1).
 * Gating engine that wraps packages/stellar/dex-gating.mjs and packages/stellar/soroban-dex.mjs.
 * Enforces fail-closed verification on swaps before any Soroban or Horizon call.
 */

import {
  gateSwap as coreGateSwap,
  gatePathPayment as coreGatePathPayment,
  checkConformance as coreCheckConformance,
  GATE_VERDICTS,
  DEX_GATE_VERSION,
} from "../../packages/stellar/dex-gating.mjs";

import {
  gateSwap as sorobanGateSwap,
  gatePathPayment as sorobanGatePathPayment,
  SOROBAN_DEX_VERSION,
} from "../../packages/stellar/soroban-dex.mjs";

/**
 * Gate a Soroban DEX swap intent against policy and liquidity depth constraints.
 * Fail-closed: returns verdict REJECTED or HELD if any invariant fails.
 */
export function evaluateDexSwapGate({
  intent,
  policy,
  observedSlippageBps = 0,
  orderBookDepth = null,
} = {}) {
  if (!intent) {
    return {
      allowed: false,
      verdict: GATE_VERDICTS.HELD,
      reason: "intent is required (fail-closed)",
    };
  }

  // 1. Order book depth sanity check (if orderBookDepth provided)
  if (orderBookDepth !== null && orderBookDepth < parseFloat(intent.amount || "0")) {
    return {
      allowed: false,
      verdict: GATE_VERDICTS.REJECTED,
      reason: `insufficient order book depth: available ${orderBookDepth} < required ${intent.amount}`,
    };
  }

  // 2. Slippage check from intent constraints / observed slippage
  const maxSlippageBps = parseInt(intent.maxSlippageBps || "500", 10);
  if (observedSlippageBps > maxSlippageBps) {
    return {
      allowed: false,
      verdict: GATE_VERDICTS.REJECTED,
      reason: `observed slippage ${observedSlippageBps} bps exceeds ceiling ${maxSlippageBps} bps`,
    };
  }

  // 3. Evaluate core DEX-GATE/1
  const sendAmount = parseFloat(intent.amount || "0");
  const minAmount = parseFloat(intent.minReceived || intent.amount || "0");
  const maxSlippageFrac = maxSlippageBps / 10000;

  const coreVerdict = coreGateSwap({
    source: intent.signer,
    destination: intent.recipient,
    amount: sendAmount,
    minAmount: minAmount,
    path: [intent.tokenIn, intent.tokenOut],
    policy: {
      rules: (policy?.rules || []).map((r) => ({
        type: r.type === "VALUE_LIMIT" ? "max_amount" : r.type,
        value: r.params?.max ? parseFloat(r.params.max) : r.params?.targets?.[0],
      })),
      maxSlippage: maxSlippageFrac,
    },
    network: intent.network || "testnet",
  });

  if (!coreVerdict.allowed) {
    return coreVerdict;
  }

  // 4. Soroban DEX plan alignment
  const sorobanPlan = sorobanGateSwap({
    source: intent.signer,
    destination: intent.recipient,
    amount: sendAmount,
    minAmount: minAmount,
    path: [intent.tokenIn, intent.tokenOut],
    network: intent.network || "testnet",
  });

  return {
    allowed: true,
    verdict: GATE_VERDICTS.VERIFIED,
    reason: "Soroban DEX swap preflight passed all invariant gates",
    dexGateVersion: DEX_GATE_VERSION,
    sorobanDexVersion: SOROBAN_DEX_VERSION,
    swapId: coreVerdict.swapId,
    txPlan: sorobanPlan.txPlan,
    intent,
  };
}

/**
 * Validates execution conformance against authorized intent.
 */
export function evaluateConformance({ intent, execution }) {
  return coreCheckConformance({ intent, execution });
}

export default {
  evaluateDexSwapGate,
  evaluateConformance,
  GATE_VERDICTS,
  DEX_GATE_VERSION,
  SOROBAN_DEX_VERSION,
};

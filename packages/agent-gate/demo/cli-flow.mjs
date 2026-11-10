#!/usr/bin/env node
/**
 * packages/agent-gate/demo/cli-flow.mjs — the full loop, offline.
 *
 *   agent proposes → mandate gate → build unsigned envelope → WALLET signs
 *     → decode the SIGNED envelope → conformance → receipt → independent verify
 *
 * The wallet here is a local keypair wrapped in a Freighter-shaped object, so
 * `requestSignature()` exercises the real adapter contract. A local keypair is
 * NOT a Freighter extension: the browser path stays `exercisedWithRealWallet:
 * false`, and the output says so rather than implying a wallet demo happened.
 *
 * No network, no submission, no funds. Testnet XDR only, throwaway keys.
 *
 * Usage: node packages/agent-gate/demo/cli-flow.mjs
 */

import * as Stellar from "@stellar/stellar-sdk";

import {
  evaluate, checkConformance, issueReceipt, verifyReceipt, verifyChain,
  generateOperatorKeyPair, intentDigest, VERDICT, CONFORMANCE, VERIFY_STATUS,
} from "../index.mjs";
import { buildPaymentEnvelope, decodeEnvelope, NETWORK_PASSPHRASE } from "../adapters/stellar-xdr.mjs";
import { requestSignature, status as freighterStatus } from "../adapters/freighter.mjs";

const NOW = "2026-11-10T14:00:00.000Z";
const NETWORK = "testnet";
const MERCHANT = "GAIH3ULLFQ4DGSECF2AR555KZ4KNDGEKN4AFI4SU2M7B43MGK3QJZNSR";
const ATTACKER = "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";

/** A Freighter-shaped wallet: holds the key, signs bytes, returns XDR. */
function localWallet(keypair) {
  return {
    address: keypair.publicKey(),
    async signTransaction(xdr) {
      const tx = Stellar.TransactionBuilder.fromXDR(xdr, NETWORK_PASSPHRASE[NETWORK]);
      tx.sign(keypair);
      return tx.toXDR();
    },
  };
}

const rows = [];
function check(name, expected, actual, detail = "") {
  rows.push({ name, expected, actual, ok: expected === actual, detail });
}

async function main() {
  const operator = generateOperatorKeyPair();
  const walletKeypair = Stellar.Keypair.random();
  const address = walletKeypair.publicKey();
  const wallet = localWallet(walletKeypair);

  const policy = {
    version: "AGENT-POLICY/1",
    network: NETWORK,
    agents: ["agent-shopping-07"],
    assets: ["XLM"],
    recipients: [MERCHANT],
    perTxMax: "100",
    windowMax: "250",
    windowSpent: "0",
    windowId: "2026-11",
    requireMemo: false,
  };

  const intent = {
    agentId: "agent-shopping-07",
    source: address,
    destination: MERCHANT,
    amount: "80",
    asset: "XLM",
    network: NETWORK,
    memo: null,
    createdAt: "2026-11-10T13:59:30.000Z",
    expiresAt: "2026-11-10T14:05:00.000Z",
    nonce: 1,
  };

  // 1. Gate the proposal.
  const decision = evaluate({ intent, policy, now: NOW });
  check("gate decision for 80 XLM", VERDICT.ALLOW, decision.verdict, decision.reasons.join(","));

  // 2. Build the unsigned envelope the wallet is asked to sign.
  const built = buildPaymentEnvelope({
    source: address, sequence: "1", destination: MERCHANT, amount: intent.amount, network: NETWORK,
  });
  if (!built.ok) throw new Error(`build failed: ${built.error}`);
  check("unsigned envelope built", true, built.unsigned === true);

  // 3. The wallet signs; the gate never sees a key.
  const signed = await requestSignature({
    wallet, xdr: built.xdr, network: NETWORK, address, expectedTxHash: built.txHash,
  });
  check("wallet returns a signed envelope", "SIGNED", signed.state, signed.error ?? "");

  // 4. Decode what was actually signed, and bind it to the authorization.
  const decoded = decodeEnvelope({ xdr: signed.signedXdr, network: NETWORK });
  if (!decoded.ok) throw new Error(`decode failed: ${decoded.error}`);
  const conforming = checkConformance({ intent, execution: decoded.execution });
  check("signed envelope conforms", CONFORMANCE.VERIFIED, conforming.verdict,
    conforming.mismatches.map((m) => m.field).join(","));

  // 5. Receipt for the conforming envelope, verified offline.
  const receipt = issueReceipt({
    intent, policy, execution: decoded.execution, decision, now: NOW,
    privateKeyPem: operator.privateKeyPem, seq: 0,
  });
  const verified = verifyReceipt({ receipt, publicKeyPem: operator.publicKeyPem });
  check("receipt verifies independently", VERIFY_STATUS.VERIFIED, verified.status);

  // 6. The attack the product exists for: the envelope diverges from intent.
  const drifted = buildPaymentEnvelope({
    source: address, sequence: "2", destination: ATTACKER, amount: "95", network: NETWORK,
  });
  if (!drifted.ok) throw new Error(`drift build failed: ${drifted.error}`);
  const driftedSigned = await requestSignature({ wallet, xdr: drifted.xdr, network: NETWORK, address });
  const driftedDecoded = decodeEnvelope({ xdr: driftedSigned.signedXdr, network: NETWORK });
  const driftConformance = checkConformance({ intent, execution: driftedDecoded.execution });
  check("drifted envelope refused", CONFORMANCE.MISMATCH, driftConformance.verdict,
    driftConformance.mismatches.map((m) => m.field).join(","));

  const blockedReceipt = issueReceipt({
    intent, policy,
    execution: { ...driftedDecoded.execution, status: "BLOCKED" },
    decision, now: NOW, privateKeyPem: operator.privateKeyPem, seq: 1, prevReceiptDigest: receipt.receiptId,
  });
  const blockedVerified = verifyReceipt({ receipt: blockedReceipt, publicKeyPem: operator.publicKeyPem });
  check("refusal still verifies as evidence", VERIFY_STATUS.VERIFIED, blockedVerified.status);

  // 7. A second payment hidden in the same envelope.
  const batch = new Stellar.TransactionBuilder(
    new Stellar.Account(address, "3"),
    { fee: "200", networkPassphrase: NETWORK_PASSPHRASE[NETWORK] },
  )
    .addOperation(Stellar.Operation.payment({
      destination: MERCHANT, asset: Stellar.Asset.native(), amount: "80",
    }))
    .addOperation(Stellar.Operation.payment({
      destination: ATTACKER, asset: Stellar.Asset.native(), amount: "20",
    }))
    .setTimeout(180)
    .build();
  batch.sign(walletKeypair);
  const batched = decodeEnvelope({ xdr: batch.toXDR(), network: NETWORK });
  const batchConformance = checkConformance({ intent, execution: batched.execution });
  check("batched envelope refused", CONFORMANCE.MISMATCH, batchConformance.verdict,
    batchConformance.reasons.join(","));

  // 8. A wallet that signs different bytes than it was asked to.
  const swapWallet = {
    address,
    async signTransaction() {
      const other = buildPaymentEnvelope({
        source: address, sequence: "4", destination: ATTACKER, amount: "1", network: NETWORK,
      });
      const tx = Stellar.TransactionBuilder.fromXDR(other.xdr, NETWORK_PASSPHRASE[NETWORK]);
      tx.sign(walletKeypair);
      return tx.toXDR();
    },
  };
  const swapped = await requestSignature({
    wallet: swapWallet, xdr: built.xdr, network: NETWORK, address, expectedTxHash: built.txHash,
  });
  check("wallet swapping the transaction refused", "REFUSED", swapped.state, swapped.error ?? "");

  // 9. Chain continuity.
  const chain = verifyChain({ receipts: [receipt, blockedReceipt], publicKeyPem: operator.publicKeyPem });
  check("receipt chain intact", VERIFY_STATUS.VERIFIED, chain.status);

  // --- report ---------------------------------------------------------------
  const width = 40;
  console.log("\nAGENT-GATE/1 — signed-envelope loop (offline, no submission)\n");
  console.log("  " + "step".padEnd(width) + "expected".padEnd(11) + "actual".padEnd(11) + "verdict");
  console.log("  " + "-".repeat(width + 34));
  for (const r of rows) {
    console.log("  " + r.name.padEnd(width) + String(r.expected).padEnd(11) + String(r.actual).padEnd(11) + (r.ok ? "ok" : "DRIFT " + r.detail));
  }
  const failed = rows.filter((r) => !r.ok);
  console.log(`\n  ${rows.length - failed.length}/${rows.length} steps match the declared behaviour`);
  console.log(`  intent digest    ${intentDigest(intent)}`);
  console.log(`  signed tx hash   ${decoded.execution.txHash} (testnet XDR, never submitted)`);
  console.log(`  freighter        adapter ${freighterStatus().runMode}, real wallet exercised: ${freighterStatus().exercisedWithRealWallet}`);
  console.log("  ceiling: the wallet above is a local keypair in a Freighter-shaped object — a real extension is NOT exercised here.\n");
  return failed.length === 0 ? 0 : 1;
}

main().then((code) => process.exit(code)).catch((e) => {
  console.error("FLOW ERROR:", e.message);
  process.exit(1);
});

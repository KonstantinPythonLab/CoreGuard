#!/usr/bin/env node
/**
 * packages/agent-gate/verify-cli.mjs — the third-party verifier.
 *
 * Usage:
 *   node packages/agent-gate/verify-cli.mjs --receipt <file> --key <operator.pub> [--xdr <signed.xdr>] [--network testnet] [--json]
 *
 * Exit codes (the repo's discipline, not a boolean):
 *   0  VERIFIED    — the receipt recomputes, and (when --xdr is given) the
 *                    envelope on disk is the one the receipt describes
 *   2  MISMATCH    — the receipt faithfully records a refused execution
 *   3  TAMPERED    — signature, digest, decision or envelope binding fails
 *   4  UNKNOWN     — nothing here can decide (missing file, unreadable input)
 *
 * What it does NOT do: read a chain, contact a CoreGuard server, or judge
 * whether the transfer was a good idea. It recomputes bytes.
 */

import { readFileSync } from "node:fs";
import { verifyReceipt, VERIFY_STATUS, CONFORMANCE } from "./index.mjs";
import { decodeEnvelope } from "./adapters/stellar-xdr.mjs";

function parseArgs(argv) {
  const out = { network: "testnet", json: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--receipt") out.receipt = argv[++i];
    else if (arg === "--key") out.key = argv[++i];
    else if (arg === "--xdr") out.xdr = argv[++i];
    else if (arg === "--network") out.network = argv[++i];
    else if (arg === "--json") out.json = true;
    else if (arg.startsWith("--")) return { error: `unknown argument ${arg}` };
  }
  if (!out.receipt) return { error: "--receipt <file> is required" };
  if (!out.key) return { error: "--key <operator public key .pem> is required" };
  return out;
}

function die(message, code = 4) {
  console.error(`AGENT-GATE VERIFY: ${message}`);
  process.exit(code);
}

const args = parseArgs(process.argv.slice(2));
if (args.error) die(args.error, 4);

let receipt;
let publicKeyPem;
try {
  receipt = JSON.parse(readFileSync(args.receipt, "utf8"));
} catch (e) {
  die(`cannot read receipt: ${e.message}`, 4);
}
try {
  publicKeyPem = readFileSync(args.key, "utf8");
} catch (e) {
  die(`cannot read operator key: ${e.message}`, 4);
}

const verified = verifyReceipt({ receipt, publicKeyPem });
const report = {
  receiptId: receipt?.receiptId ?? null,
  decision: receipt?.decision?.verdict ?? null,
  recordedConformance: receipt?.conformance?.verdict ?? null,
  status: verified.status,
  findings: verified.findings,
  ceiling: verified.ceiling ?? null,
  envelopeBinding: "NOT_CHECKED",
};

// A receipt that faithfully records a refused envelope is valid evidence of a
// refusal — it is not a verification failure and must not exit 0 either.
const recordedRefusal = receipt?.conformance?.verdict === CONFORMANCE.MISMATCH;

if (args.xdr) {
  let signedXdr;
  try {
    signedXdr = readFileSync(args.xdr, "utf8").trim();
  } catch (e) {
    die(`cannot read envelope: ${e.message}`, 4);
  }
  const decoded = decodeEnvelope({ xdr: signedXdr, network: args.network });
  if (!decoded.ok) {
    report.envelopeBinding = `UNREADABLE: ${decoded.error}`;
    report.status = VERIFY_STATUS.UNKNOWN;
  } else {
    const recorded = receipt?.subject?.execution;
    const sameHash = Boolean(recorded?.txHash) && recorded.txHash === decoded.execution.txHash;
    const sameOps = JSON.stringify(recorded?.operations ?? []) === JSON.stringify(decoded.execution.operations);
    report.envelopeBinding = sameHash && sameOps ? "MATCH" : "MISMATCH";
    if (report.envelopeBinding === "MISMATCH") {
      report.findings = [...report.findings, {
        id: "ENVELOPE_NOT_THE_ONE_IN_THE_RECEIPT",
        detail: `hash recorded ${recorded?.txHash ?? "none"} vs on-disk ${decoded.execution.txHash ?? "none"}`,
      }];
      report.status = VERIFY_STATUS.TAMPERED;
    }
  }
}

if (args.json) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log(`AGENT-GATE VERIFY — ${report.status}`);
  console.log(`  receipt      ${report.receiptId}`);
  console.log(`  decision     ${report.decision}`);
  console.log(`  conformance  ${report.recordedConformance}`);
  if (args.xdr) console.log(`  envelope     ${report.envelopeBinding}`);
  for (const f of report.findings) console.log(`  finding      ${f.id}: ${f.detail}`);
  if (report.ceiling) console.log(`  ceiling      ${report.ceiling}`);
}

// The FINAL status, after the optional envelope binding — not the receipt-only
// verdict. (A receipt can verify while the envelope on disk is a different one.)
if (report.status === VERIFY_STATUS.TAMPERED) process.exit(3);
if (report.status === VERIFY_STATUS.UNKNOWN) process.exit(4);
if (recordedRefusal) {
  console.log("\nThis receipt records a REFUSED execution. Evidence of a refusal is a valid record, not a pass.");
  process.exit(2);
}
process.exit(0);

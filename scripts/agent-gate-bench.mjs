#!/usr/bin/env node
/**
 * scripts/agent-gate-bench.mjs — measured gate performance, no network.
 *
 * Measures the four in-process operations an integrator actually pays for:
 *   evaluate · checkConformance · issueReceipt · verifyReceipt
 *
 * Ceiling, printed with the numbers: this is a single-threaded offline
 * measurement on the machine that ran it. It is NOT a deployed-service latency,
 * NOT a chain confirmation time, and NOT a throughput claim.
 *
 * Usage:
 *   node scripts/agent-gate-bench.mjs                 # print a report
 *   node scripts/agent-gate-bench.mjs --iterations 5000
 *   node scripts/agent-gate-bench.mjs --write         # write docs/evidence/agent-gate-bench.json
 */

import { writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { cpus, platform, arch, release } from "node:os";

import {
  evaluate, checkConformance, issueReceipt, verifyReceipt, generateOperatorKeyPair,
} from "../packages/agent-gate/index.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..");
const OUT = resolve(repoRoot, "docs/evidence/agent-gate-bench.json");

const NOW = "2026-11-10T14:00:00.000Z";
const MERCHANT = "GAIH3ULLFQ4DGSECF2AR555KZ4KNDGEKN4AFI4SU2M7B43MGK3QJZNSR";

const policy = {
  version: "AGENT-POLICY/1",
  network: "testnet",
  agents: ["agent-bench"],
  assets: ["XLM"],
  recipients: [MERCHANT],
  perTxMax: "100",
  windowMax: "250",
  windowSpent: "0",
  windowId: "2026-11",
  requireMemo: false,
};

const intent = {
  agentId: "agent-bench",
  source: "GDJ3CRNLNDZ4AVWGPUG7DBC5BIAGMIONOONZGB5FSYAY44ZHOIPRKY7U",
  destination: MERCHANT,
  amount: "80",
  asset: "XLM",
  network: "testnet",
  memo: null,
  createdAt: "2026-11-10T13:59:30.000Z",
  expiresAt: "2026-11-10T14:05:00.000Z",
  nonce: 1,
};

const execution = {
  status: "SIGNED_PENDING_SUBMIT",
  network: "testnet",
  operations: [{
    type: "payment",
    source: intent.source,
    destination: intent.destination,
    amount: "80.0000000",
    asset: "XLM",
    memo: null,
  }],
};

function percentile(sortedNs, p) {
  if (sortedNs.length === 0) return null;
  const index = Math.min(sortedNs.length - 1, Math.max(0, Math.ceil((p / 100) * sortedNs.length) - 1));
  return Math.round(Number(sortedNs[index]) / 1000); // microseconds
}

function timed(fn) {
  const start = process.hrtime.bigint();
  const value = fn();
  return { us: Number(process.hrtime.bigint() - start), value };
}

export function runBenchmark(iterations = 2000) {
  const keys = generateOperatorKeyPair();
  const samples = { evaluate: [], conformance: [], issueReceipt: [], verifyReceipt: [] };

  for (let i = 0; i < iterations; i++) {
    const evaluated = timed(() => evaluate({ intent, policy, now: NOW }));
    samples.evaluate.push(evaluated.us);

    const conformed = timed(() => checkConformance({ intent, execution }));
    samples.conformance.push(conformed.us);

    const issued = timed(() => issueReceipt({
      intent, policy, execution, decision: evaluated.value, now: NOW,
      privateKeyPem: keys.privateKeyPem, seq: i,
    }));
    samples.issueReceipt.push(issued.us);

    const verified = timed(() => verifyReceipt({ receipt: issued.value, publicKeyPem: keys.publicKeyPem }));
    samples.verifyReceipt.push(verified.us);
    if (verified.value.status !== "VERIFIED") {
      throw new Error(`benchmark receipt failed verification at iteration ${i}: ${verified.value.status}`);
    }
  }

  const summarise = (list) => {
    const sorted = [...list].sort((a, b) => a - b);
    return {
      samples: sorted.length,
      p50_us: percentile(sorted, 50),
      p95_us: percentile(sorted, 95),
      p99_us: percentile(sorted, 99),
      max_us: percentile(sorted, 100),
    };
  };

  return {
    schema: "CoreGuard-Evidence/1",
    artifact: "agent-gate-bench",
    version: "AGENT-GATE/1",
    iterations,
    operations: Object.fromEntries(Object.entries(samples).map(([k, v]) => [k, summarise(v)])),
    machine: {
      node: process.version,
      platform: platform(),
      release: release(),
      arch: arch(),
      cpus: cpus().length,
    },
    ceiling: "In-process, single-threaded, offline. Not a deployed-service latency, not chain confirmation, not throughput.",
  };
}

async function main(argv) {
  const idx = argv.indexOf("--iterations");
  const iterations = idx >= 0 ? Number(argv[idx + 1]) : 2000;
  if (!Number.isInteger(iterations) || iterations < 1) {
    console.error("AGENT-GATE-BENCH: --iterations must be a positive integer");
    return 2;
  }
  const report = runBenchmark(iterations);

  if (argv.includes("--write")) {
    await mkdir(dirname(OUT), { recursive: true });
    await writeFile(OUT, JSON.stringify({ ...report, generatedAt: new Date().toISOString() }, null, 2) + "\n");
    console.log(OUT);
  }

  for (const [name, stats] of Object.entries(report.operations)) {
    console.log(
      `${name.padEnd(16)} p50 ${String(stats.p50_us).padStart(6)} µs · p95 ${String(stats.p95_us).padStart(6)} µs · p99 ${String(stats.p99_us).padStart(6)} µs  (${stats.samples} samples)`,
    );
  }
  console.log(`machine: node ${report.machine.node} · ${report.machine.platform}/${report.machine.arch} · ${report.machine.cpus} cpus`);
  console.log(`ceiling: ${report.ceiling}`);
  return 0;
}

const invokedDirectly = process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/").split("/").pop());
if (invokedDirectly) process.exit(await main(process.argv.slice(2)));

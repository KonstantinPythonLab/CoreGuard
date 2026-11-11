#!/usr/bin/env node
/**
 * scripts/agent-gate-replay-vector.mjs
 *
 * Regenerate or diff the committed replay vector. One implementation lives in
 * `packages/agent-gate/replay-vector.mjs`, so this script and the test can never
 * disagree about what "the same bytes" means.
 *
 *   node scripts/agent-gate-replay-vector.mjs           # compare, exit 1 on drift
 *   node scripts/agent-gate-replay-vector.mjs --write   # rewrite the fixture
 *
 * Exit: 0 = match (or written), 1 = drift, 2 = usage/error.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { buildReplayVector } from "../packages/agent-gate/replay-vector.mjs";

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(REPO, "test", "fixtures", "agent-gate", "canonical-vectors.json");

let vector;
try {
  vector = buildReplayVector();
} catch (e) {
  console.error(`REPLAY-VECTOR: could not derive the vector: ${e && e.message ? e.message : e}`);
  process.exit(2);
}

const json = `${JSON.stringify(vector, null, 2)}\n`;

if (process.argv.includes("--write")) {
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, json, "utf8");
  console.log(`REPLAY-VECTOR: wrote ${OUT.replace(REPO + "/", "").replace(REPO + "\\", "")}`);
  console.log(`  txHash    ${vector.expected.envelopeTxHash}`);
  console.log(`  receipt   ${vector.expected.receiptId}`);
  process.exit(0);
}

if (!existsSync(OUT)) {
  console.error(`REPLAY-VECTOR: DRIFT (no committed vector at ${OUT}) — run with --write after review`);
  process.exit(1);
}

const committed = readFileSync(OUT, "utf8");
if (committed.replace(/\r\n/g, "\n") !== json) {
  console.error("REPLAY-VECTOR: DRIFT — the committed vector no longer matches the derived bytes.");
  console.error("                review the diff, then regenerate with: node scripts/agent-gate-replay-vector.mjs --write");
  process.exit(1);
}

console.log("REPLAY-VECTOR: MATCH");
console.log(`  txHash    ${vector.expected.envelopeTxHash}`);
console.log(`  receipt   ${vector.expected.receiptId}`);
console.log("  ceiling   OFFLINE_RECOMPUTATION — byte stability, not a chain read");

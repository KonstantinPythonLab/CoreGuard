#!/usr/bin/env node
/**
 * verify-claims.mjs — Local bounty claim verification.
 *
 * Runs offline (no network) to validate a bounty claim before submitting a PR.
 * Usage:
 *   node scripts/verify-claims.mjs --claim CG-BTY-001 --pr-url https://github.com/coreguard-global/CoreGuard/pull/51
 *   node scripts/verify-claims.mjs --manifest-check  # validate docs/bounties.json structure
 *
 * Exit codes:
 *   0 = all checks pass
 *   1 = claim validation failed
 *   2 = manifest structure invalid
 *   3 = input error
 */

import { readFileSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..");
const BOUNTIES_FILE = join(REPO, "docs", "bounties.json");
const STATE_FILE = join(REPO, "docs", "state-snapshot.json");

const CLAIM_ID_RE = /^CG-BTY-\d{3}$/;
const URL_RE = /^https?:\/\/github\.com\/[^/]+\/[^/]+\/pull\/\d+$/;

function loadJson(path) {
  if (!existsSync(path)) {
    throw new Error(`File not found: ${path}`);
  }
  return JSON.parse(readFileSync(path, "utf8"));
}

function validateManifest(bounties) {
  const errors = [];
  if (!bounties.version || !bounties.schema) {
    errors.push("Missing version or schema");
  }
  if (!Array.isArray(bounties.bounties)) {
    errors.push("bounties must be an array");
    return errors;
  }
  const seenIds = new Set();
  for (const b of bounties.bounties) {
    if (!b.id || !CLAIM_ID_RE.test(b.id)) {
      errors.push(`Invalid or missing id: ${b.id}`);
    }
    if (seenIds.has(b.id)) {
      errors.push(`Duplicate id: ${b.id}`);
    }
    seenIds.add(b.id);
    if (!b.title || typeof b.title !== "string") {
      errors.push(`${b.id}: missing title`);
    }
    if (!Array.isArray(b.acceptanceCriteria)) {
      errors.push(`${b.id}: acceptanceCriteria must be array`);
    }
    if (b.status && !["OPEN", "CLAIMED", "MERGED", "CLOSED", "UNFUNDED"].includes(b.status)) {
      errors.push(`${b.id}: invalid status ${b.status}`);
    }
    if (b.pr !== null && b.pr !== undefined && typeof b.pr !== "number") {
      errors.push(`${b.id}: pr must be number or null`);
    }
    if (b.reward) {
      if (typeof b.reward.amount !== "number" && b.reward.amount !== null) {
        errors.push(`${b.id}: reward.amount must be number or null`);
      }
      if (b.reward.currency && typeof b.reward.currency !== "string") {
        errors.push(`${b.id}: reward.currency must be string`);
      }
      if (b.reward.status && !["PENDING_FUNDING", "UNFUNDED", "PAID", "WAIVED"].includes(b.reward.status)) {
        errors.push(`${b.id}: invalid reward.status ${b.reward.status}`);
      }
    }
  }
  return errors;
}

function validateClaim(claimId, prUrl, bounties, state) {
  const claim = bounties.bounties.find(b => b.id === claimId);
  if (!claim) {
    return [`Claim not found: ${claimId}`];
  }
  const errors = [];
  if (claim.status !== "CLAIMED" && claim.status !== "MERGED") {
    errors.push(`Claim status is ${claim.status}, expected CLAIMED or MERGED`);
  }
  if (!prUrl) {
    errors.push("PR URL required (--pr-url)");
  } else if (!URL_RE.test(prUrl)) {
    errors.push("PR URL must be a valid GitHub pull request URL");
  } else {
    const match = prUrl.match(/\/pull\/(\d+)$/);
    if (match && claim.pr !== null && Number(match[1]) !== claim.pr) {
      errors.push(`PR number mismatch: manifest has ${claim.pr}, URL has ${match[1]}`);
    }
  }
  // Check state snapshot exists (CI will enforce this)
  if (!existsSync(STATE_FILE)) {
    errors.push("docs/state-snapshot.json missing — run `npm test` then `node scripts/current-state.mjs --write --tests <count>`");
  } else {
    try {
      const st = JSON.parse(readFileSync(STATE_FILE, "utf8"));
      if (!st.testsTotal || !st.boundaryAudit) {
        errors.push("state-snapshot.json incomplete (missing testsTotal or boundaryAudit)");
      }
    } catch {
      errors.push("state-snapshot.json invalid JSON");
    }
  }
  // Check boundary audit passes (informational)
  const r = spawnSync(process.execPath, [join(REPO, "scripts", "boundary-audit.mjs")], { cwd: REPO, encoding: "utf8" });
  if (r.status !== 0) {
    errors.push("Boundary audit FAILS — run `npm run boundary:audit` to see violations");
  }
  return errors;
}

function main() {
  const args = process.argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) {
    console.log(`
verify-claims.mjs — Local bounty claim verification

Usage:
  node scripts/verify-claims.mjs --claim CG-BTY-001 --pr-url https://github.com/coreguard-global/CoreGuard/pull/51
  node scripts/verify-claims.mjs --manifest-check
  node scripts/verify-claims.mjs --help

Options:
  --claim <id>        Claim ID (format: CG-BTY-XXX)
  --pr-url <url>      GitHub PR URL for the claim
  --manifest-check    Validate docs/bounties.json structure only
  --help              Show this help
`);
    process.exit(0);
  }

  const manifestCheck = args.includes("--manifest-check");
  const claimIdx = args.indexOf("--claim");
  const prIdx = args.indexOf("--pr-url");
  const claimId = claimIdx >= 0 ? args[claimIdx + 1] : null;
  const prUrl = prIdx >= 0 ? args[prIdx + 1] : null;

  if (manifestCheck) {
    try {
      const bounties = loadJson(BOUNTIES_FILE);
      const errors = validateManifest(bounties);
      if (errors.length) {
        console.error("MANIFEST VALIDATION FAILED:");
        for (const e of errors) console.error("  - " + e);
        process.exit(2);
      }
      console.log("MANIFEST OK: docs/bounties.json structure valid");
      process.exit(0);
    } catch (err) {
      console.error("ERROR:", err.message);
      process.exit(2);
    }
  }

  if (!claimId) {
    console.error("ERROR: --claim <id> required (unless --manifest-check)");
    process.exit(3);
  }
  if (!CLAIM_ID_RE.test(claimId)) {
    console.error(`ERROR: Invalid claim ID format: ${claimId} (expected CG-BTY-XXX)`);
    process.exit(3);
  }

  try {
    const bounties = loadJson(BOUNTIES_FILE);
    const state = loadJson(STATE_FILE);
    const errors = validateClaim(claimId, prUrl, bounties, state);
    if (errors.length) {
      console.error(`CLAIM VALIDATION FAILED for ${claimId}:`);
      for (const e of errors) console.error("  - " + e);
      process.exit(1);
    }
    console.log(`CLAIM OK: ${claimId} passes local verification`);
    process.exit(0);
  } catch (err) {
    console.error("ERROR:", err.message);
    process.exit(3);
  }
}

main().catch(err => {
  console.error("FATAL:", err.message);
  process.exit(3);
});

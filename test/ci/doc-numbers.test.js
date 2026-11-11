/**
 * test/ci/doc-numbers.test.js
 *
 * THE single-source-of-truth bond for test-count claims across the repo's
 * reviewer-facing documents (owner mandate, 2026-11-07): every number a doc
 * states about the test suite must equal `docs/state-snapshot.json#testsTotal`
 * — the machine-measured total — and nothing may drift "because files were
 * updated asynchronously" (the exact defect this closes; the repo's first
 * live audit by an external reviewer flagged 1405/1436/1412/620 sitting side
 * by side without any rule).
 *
 * Scope EXCLUSIONS are deliberate and named, never a shrug:
 *   - docs/STATUS.md: row-bound by test/ci/status-truth.test.js (12 negative
 *     controls) — double-binding the same row from here would create TWO
 *     guards for one value with two failure vocabularies.
 *   - AGENTS.md: the operational-lessons chronicle; its numeric mentions are
 *     HISTORICAL lesson text (e.g. the "696/696" era in [C9]).
 *   - Dated instruments (allowlist below): docs that RECORD what a campaign/
 *     audit/packet/post measured at its own date. Their bodies are verbatim
 *     historical facts (some were already PUBLISHED — rewriting them would
 *     falsify the record), and they cannot be "current" by construction.
 *   - release/** and legacy-quarantine/**: hash-frozen trees never scanned.
 *
 * Design notes:
 *   - [C32] discipline: value-in-row binding is not possible for free prose,
 *     so the bond is: EVERY claim-shaped hit in a NON-allowlisted doc must
 *     equal testsTotal. A claim that a future doc writes with a deliberately
 *     different meaning (e.g. "73/73 adversarial benchmarks" — benchmarks,
 *     never tests) does NOT match the shapes, and adding a "tests"-worded
 *     subset claim must use the allowlist mechanism explicitly.
 *   - [C35] discipline: the scan enumerates the set itself — the guards below
 *     require a real, non-trivial hit count on the committed tree and at
 *     least one README hit, so a scanner that broke to ZERO hits can never
 *     masquerade as a green.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, "..", "..");

const snapshot = JSON.parse(readFileSync(join(repo, "docs", "state-snapshot.json"), "utf8"));
const TOTAL = Number(snapshot.testsTotal);

/** Dated/posted instrument docs + chronicles: verbatim historical claims. */
const ALLOWED = new Set([
  "AGENTS.md",
  "docs/FINAL-REPORT-2026-09-19.md",
  "docs/FINAL-REPORT-2026-11-07-ar.md", // hardening-batch final report, 2026-11-07 (SHA-pinned to ea7e154)
  "docs/FINAL-REPORT-2026-11-07.md", // hardening-batch final report, 2026-11-07 (SHA-pinned to ea7e154)
  "docs/FINAL-REPORT-2026-11-09-ar.md", // authorized-lane delivery final report: the 2026-11-09 rehearsal + refusal facts, and the 2026-11-10 decode addendum (dated instrument; this push)
  "docs/FINAL-REPORT-2026-11-09.md", // authorized-lane delivery final report, EN mirror (dated instrument; this push)
  "docs/OWNER-DECISIONS-2026-09-19.md",
  "docs/OWNER-DECISIONS-2026-11-08.md", // owner-authorized mainnet deploy decision, 2026-11-08 (the recorded instrument; the runner reads it, not the scanner)
  "docs/adoption/README.md",
  "docs/campaign-ops-outreach-kit-2026-09-25.md",
  "docs/current-state-audit-2026-09-25.md",
  "docs/elizaos-thread-replies-record-2026-09-23.md",
  "docs/funding-one-pager-2026-09.md",
  "docs/growth-execution-2026-11-11.md", // dated instrument: funding map + Wave/SCF timing verified 2026-11-11 (this push)
  "docs/sep-receipt-semantics-draft-2026-11-11.md", // dated instrument: SEP draft authored under owner delegation 2026-11-11 (this push)
  "docs/ceo-decisions-2026-11-11.md", // dated instrument: CEO delegated decisions - Wave/x402 price/submission policy (this push)
  "docs/master-launch-adoption-plan-v2-2026-09-25.md",
  "docs/owner-decisions-and-claimable-facts-2026-09.md",
  "docs/phase-a-people-court-followup-draft-2026-09-25.md",
  "docs/plan-90d-repo.md",
  "docs/SCF-46-INTEREST-FORM-READY-2026-11-06.md", // dated instrument: answers prepared 2026-11-06 for the 2026-11-09 deadline; the total it cites was the measured one at its own date
  "docs/scf-evidence-packet-2026-10.md",
  "docs/scf-evidence-packet-ar-2026-10.md",
]);

/** The claim shapes the repo actually writes (shapes are pinned by controls below). */
const SHAPES = [
  /(\d{3,4})\s*\/\s*(\d{3,4})\s+(?:unit\/integration\s+|engine\s+|suite\s+|adversarial\s+|repo\s+)*tests/gi,
  /\b(\d{3,4})\s+(?:unit\/integration\s+|engine\s+|suite\s+|adversarial\s+|repo\s+)*tests\b/g,
  /\btests?\s*[:=]\s*(\d{3,4})\b/gi,
  /(\d{3,4})\s*\/\s*(\d{3,4})\s+(?:pass|passing)\b/gi,
  /ℹ\s+tests\s+(\d{3,4})/g,
];

/** #[C19] the scanned surface list comes from the COMMITTED tree, not the disk. */
function listScannerFiles() {
  const out = execSync('git ls-files "*.md"', { cwd: repo, encoding: "utf8" })
    .split("\n").map((s) => s.trim()).filter(Boolean);
  return out.filter((f) =>
    f === "README.md" ||
    (f.startsWith("docs/") && f.endsWith(".md") && f !== "docs/STATUS.md")
  );
}

/** The claim-scanner, exported for the mutation controls (C32/C35 discipline). */
export function scanContent(relPath, content) {
  const offenders = [];
  const lines = String(content).split(/\r?\n/);
  lines.forEach((line, i) => {
    for (const shape of SHAPES) {
      const rx = new RegExp(shape.source, shape.flags);
      let m;
      while ((m = rx.exec(line)) !== null) {
        offenders.push({ file: relPath, line: i + 1, claim: m[0].trim().replace(/\s+/g, " "), numbers: m.slice(1).filter(Boolean).map(Number) });
      }
    }
  });
  return offenders;
}

test("the testsTotal the guard bonds to is real, measured and non-trivial", () => {
  assert.equal(typeof TOTAL, "number");
  assert.ok(Number.isInteger(TOTAL));
  assert.ok(TOTAL >= 1400, `the suite total regressed below the measured era: ${TOTAL}`);
});

test("no allowlisted path points at a file that no longer exists (stale-exemption trap)", () => {
  const vanished = [...ALLOWED].filter((f) => !existsSync(join(repo, f)));
  assert.deepEqual(vanished, [], "remove or rename stale allowlist entries by name");
});

test("every doc-number claim in a live doc equals the measured snapshot total", () => {
  const offenders = [];
  for (const f of listScannerFiles()) {
    if (ALLOWED.has(f)) continue;
    const content = readFileSync(join(repo, f), "utf8");
    for (const hit of scanContent(f, content)) {
      const wrong = hit.numbers.some((n) => n !== TOTAL);
      // e.g. "1436 / 1445" or "1405 tests": ANY component refusing the total
      // is a drifted claim. A claim is either exactly the measured truth or
      // it names itself as an allowlisted dated instrument.
      if (wrong || hit.numbers.length === 0) {
        offenders.push(`${f}:${hit.line}: "${hit.claim}" (snapshot total = ${TOTAL})`);
      }
    }
  }
  assert.deepEqual(offenders, [],
    "stale doc test-counts found — derive them from docs/state-snapshot.json or allowlist the dated instrument in this test by name"
  );
});

test("[C35] the enumeration is real: the scanner sees claims on the committed tree", () => {
  let hits = 0;
  let readmeHits = 0;
  let allowedHits = 0;
  for (const f of listScannerFiles()) {
    const content = readFileSync(join(repo, f), "utf8");
    const found = scanContent(f, content);
    hits += found.length;
    if (f === "README.md") readmeHits += found.length;
    if (ALLOWED.has(f)) allowedHits += found.length;
  }
  assert.ok(hits >= 20, `scanner found only ${hits} claim hits — the shapes went blind, this green means nothing`);
  assert.ok(readmeHits >= 1, "README must still carry a live suite-total claim (the front door)");
  assert.ok(allowedHits >= 1, "the allowlist must still cover real dated instruments (never silently empty)");
});

// ---- Mutation controls: the guard proves it can fail (applied AND bites) ----

test("[controls] each claim shape actually fails a corrupted value", () => {
  const samples = [
    `${TOTAL} / ${TOTAL} pass`,                      // row shape
    `${TOTAL} / ${TOTAL} passing`,                   // ARCHITECTURE shape
    `${TOTAL} tests`,                                // bare prose shape
    `${TOTAL}/1500 unit/integration tests`,          // qualified shape, one side wrong
    `tests: ${TOTAL}`,                               // tests[:=] shape
  ];
  for (const original of samples) {
    const corrupted = original.replace(String(TOTAL), String(TOTAL + 1));
    assert.notEqual(corrupted, original, "corruption did not change the sample");
    const flagged = scanContent("docs/CONTROL-SYNTHETIC.md", "line\n" + corrupted + "\nend")
      .some((h) => h.numbers.some((n) => n !== TOTAL));
    assert.ok(flagged, `shape failed to bite on: ${corrupted}`);
  }
});

test("[controls] the allowlist branch is exercised, not just declared", () => {
  // The pure scanner flags content regardless of path; the ENUMERATOR (the
  // live test's loop) does the exempting. Both halves are proven by hand on
  // the same input — the [C33] branch-loss trap inverted into a control.
  const text = "era text: 1405 tests\n";
  const flagged = scanContent("docs/funding-one-pager-2026-09.md", text);
  assert.equal(flagged.length, 1, "the scanner itself always flags legacy numbers");
  assert.ok(ALLOWED.has("docs/funding-one-pager-2026-09.md"), "the dated instrument must be in the allowlist for the live scan to skip it");
});

test("[controls] a claim in a live doc with a deliberately stale number fails by name", () => {
  const path = "docs/CONTROL-AS-LIVE-DOC.md";
  const flagged = scanContent(path, "the suite is 1405 tests today\n");
  assert.equal(flagged.length, 1);
  assert.equal(flagged[0].claim, "1405 tests");
});

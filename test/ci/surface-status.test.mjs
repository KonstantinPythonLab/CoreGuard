/**
 * test/ci/surface-status.test.mjs
 *
 * P0 guard for the defect an external reviewer named first (2026-11-10):
 *
 *   docs/EVIDENCE-MATRIX.md recorded Stellar mainnet executions as
 *   "MAINNET VERIFIED", while packages/stellar/README.md said
 *   "DRY_RUN / NOT_BUILT" and status() returned integrationStatus NOT_BUILT.
 *   Both statements were true about different questions, and no machine check
 *   stopped a reader from averaging them into "the integration works".
 *
 * The fix is structural: three separate axes (code / execution / integration)
 * in docs/surface-status.json, an EVIDENCE-MATRIX whose surface tables must
 * state all three, and this guard, which fails on any relapse.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { status as stellarStatus } from "../../packages/stellar/index.mjs";
import { status as agentGateStatus } from "../../packages/agent-gate/index.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, "..", "..");

const registry = JSON.parse(readFileSync(join(repo, "docs", "surface-status.json"), "utf8"));
const matrix = readFileSync(join(repo, "docs", "EVIDENCE-MATRIX.md"), "utf8");

/**
 * Labels that conflate the axes. `MAINNET VERIFIED` cannot distinguish "a
 * script we wrote sent a call" from "a customer can adopt this", which is how
 * the contradiction happened. Exported so the controls prove the detector bites.
 */
export const BANNED_COMBINED_LABELS = [
  "MAINNET VERIFIED",
  "MAINNET DEPLOYED",
  "TESTNET VERIFIED",
  "PRODUCTION ADOPTED",
  "ENTERPRISE READY",
  "PRODUCTION READY",
];

export function findLabelOffenders(markdown) {
  const offenders = [];
  const source = String(markdown);
  for (const label of BANNED_COMBINED_LABELS) {
    const rx = new RegExp(label.replace(/\s+/g, "\\s+"), "gi");
    let m;
    while ((m = rx.exec(source)) !== null) {
      const line = source.slice(0, m.index).split("\n").length;
      offenders.push({ line, label: m[0] });
    }
  }
  return offenders;
}

/** Parse markdown tables into { header, rows:[{line,cells}] } blocks. */
export function parseTables(markdown) {
  const lines = String(markdown).split(/\r?\n/);
  const tables = [];
  let current = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line.startsWith("|")) { current = null; continue; }
    const cells = line.slice(1, line.endsWith("|") ? -1 : undefined).split("|").map((c) => c.trim());
    if (!current) { current = { header: cells, rows: [] }; tables.push(current); continue; }
    if (/^[\s\-:|]+$/.test(cells.join(""))) continue; // separator row
    current.rows.push({ line: i + 1, cells });
  }
  return tables;
}

/** The surface tables: 5 columns, first header cell says "surface". */
export function surfaceTables(markdown) {
  return parseTables(markdown).filter((t) => t.header.length === 5 && /surface/i.test(t.header[0]));
}

const AXES = registry.axes;
const byId = new Map(registry.surfaces.map((s) => [s.id, s]));
const INTEGRATION_VALUES = new Set(AXES.integration);

test("the registry is well-formed and every axis value is in its vocabulary", () => {
  assert.equal(registry.schema, "coreguard.surface-status/1");
  assert.ok(registry.surfaces.length >= 8, "the registry collapsed below the real surface count");
  const ids = new Set();
  for (const s of registry.surfaces) {
    assert.ok(!ids.has(s.id), `duplicate surface id ${s.id}`);
    ids.add(s.id);
    for (const axis of ["code", "execution", "integration"]) {
      assert.ok(AXES[axis].includes(s[axis]), `${s.id}: ${axis}=${s[axis]} is not in the ${axis} vocabulary`);
    }
    assert.ok(typeof s.label === "string" && s.label.length > 0, `${s.id} needs a label`);
    assert.ok(existsSync(join(repo, s.path)), `${s.id}: path ${s.path} does not exist — the registry may not name phantoms`);
  }
});

test("no surface may claim adoption or a pilot without a named external party", () => {
  for (const s of registry.surfaces) {
    if (s.integration === "ADOPTED" || s.integration === "PILOT") {
      assert.ok(s.externalParty && s.externalParty.length > 0,
        `${s.id} claims integration=${s.integration} without a named external party`);
      assert.ok(Array.isArray(s.evidence) && s.evidence.length > 0,
        `${s.id} claims integration=${s.integration} without committed evidence`);
    }
  }
  const external = registry.surfaces.filter((s) => s.integration !== "NOT_BUILT");
  assert.deepEqual(external.map((s) => s.id), [], "no surface has an external adopter yet");
});

test("every executed claim carries an artifact that exists", () => {
  for (const s of registry.surfaces) {
    const executed = ["EXECUTED", "REAL_BOOK_EXECUTED", "POLICY_GATE_EXECUTED"].includes(s.execution);
    if (executed) assert.ok(s.evidence.length > 0, `${s.id} claims execution without an evidence artifact`);
    for (const e of s.evidence) {
      assert.ok(existsSync(join(repo, e)), `${s.id}: evidence ${e} is missing`);
    }
  }
});

test("the code's own status agrees with the registry — the original contradiction", () => {
  const adapter = byId.get("stellar-adapter");
  const stellar = stellarStatus();
  assert.equal(stellar.integrationStatus, adapter.integration,
    "packages/stellar/index.mjs status() disagrees with docs/surface-status.json");
  assert.equal(stellar.runMode, "DRY_RUN");

  const gate = byId.get("agent-gate");
  const gateStatus = agentGateStatus();
  assert.equal(gateStatus.integrationStatus, gate.integration);
  assert.equal(gateStatus.runMode, "OFFLINE_PROTOTYPE");
  assert.equal(gateStatus.chainSubmission, "NOT_PERFORMED");
});

test("EVIDENCE-MATRIX carries no combined verdict label at all", () => {
  const offenders = findLabelOffenders(matrix);
  assert.deepEqual(offenders, [],
    `combined labels re-entered the matrix: ${offenders.map((o) => `${o.label}@${o.line}`).join(", ")} — ` +
    "state code, execution and integration separately");
});

test("every surface row states three axes and cites evidence", () => {
  const tables = surfaceTables(matrix);
  assert.ok(tables.length >= 3, `only ${tables.length} surface tables found — the parse may be blind`);
  let rows = 0;
  for (const table of tables) {
    for (const row of table.rows) {
      rows += 1;
      assert.equal(row.cells.length, 5,
        `line ${row.line}: expected 5 columns (Surface | Code | Execution | Integration | Evidence), got ${row.cells.length}`);
      const integration = row.cells[3].replace(/[`*]/g, "").split(/\s|—|\//)[0].trim();
      assert.ok(INTEGRATION_VALUES.has(integration),
        `line ${row.line}: integration cell "${row.cells[3]}" is not one of ${[...INTEGRATION_VALUES].join("|")}`);
      assert.ok(row.cells[4].length > 0, `line ${row.line}: missing evidence cell`);
    }
  }
  assert.ok(rows >= 12, `the matrix parsed only ${rows} surface rows`);
});

test("every registry surface flagged matrixRow=true has a row in the matrix", () => {
  const names = surfaceTables(matrix).flatMap((t) => t.rows.map((r) => r.cells[0].toLowerCase()));
  for (const s of registry.surfaces.filter((x) => x.matrixRow)) {
    assert.ok(names.some((n) => n.includes(s.id.toLowerCase())),
      `surface ${s.id} has no EVIDENCE-MATRIX row — the registry and the matrix diverged`);
  }
});

test("the Stellar package README keeps its own honest label and points at the record", () => {
  const readme = readFileSync(join(repo, "packages/stellar/README.md"), "utf8");
  assert.match(readme, /DRY_RUN \/ NOT_BUILT/,
    "packages/stellar/README.md must keep the explicit DRY_RUN / NOT_BUILT label");
  assert.match(readme, /STELLAR-STATUS-UNIFICATION/,
    "packages/stellar/README.md must point at the unification record");
});

// ---- controls: the detector is proven to bite, not just declared ----

test("[controls] a relapsed combined label is detected by name and line", () => {
  const synthetic = "| Soroban anchor | BUILT | EXECUTED | NOT_BUILT | x |\n" +
    "| Mainnet payment | MAINNET VERIFIED | ... |\n";
  const found = findLabelOffenders(synthetic);
  assert.equal(found.length, 1);
  assert.equal(found[0].label, "MAINNET VERIFIED");
  assert.equal(found[0].line, 2);
});

test("[controls] a short row is rejected, and a clean row passes", () => {
  const clean = "| Surface | Code | Execution | Integration | Evidence |\n|---|---|---|---|---|\n| stellar-adapter | BUILT | NONE | NOT_BUILT | - |\n";
  const tables = surfaceTables(clean);
  assert.equal(tables.length, 1);
  assert.equal(tables[0].rows.length, 1);
  assert.equal(tables[0].rows[0].cells.length, 5);
  const broken = "| Surface | Status | Evidence |\n|---|---|---|\n| stellar-adapter | VERIFIED | - |\n";
  assert.equal(surfaceTables(broken).length, 0, "a 3-column table must not pass as a surface table");
});

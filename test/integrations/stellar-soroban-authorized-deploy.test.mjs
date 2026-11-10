/**
 * test/integrations/stellar-soroban-authorized-deploy.test.mjs
 * Offline contract battery for the OWNER-AUTHORIZED DEPLOY runner
 * (scripts/stellar-soroban-authorized-deploy.mjs).
 *
 * Every gate is proven BOTH directions: the green pass runs on the real
 * committed doc, and each mutation is applied AND bites (a control that
 * cannot fail is not a control - [C30]/[C32]). No network call ever leaves
 * this file, and NO wallet file is read: the runner's exported gates are
 * pure, so the secret-discipline contract is enforced on the SOURCE (no
 * console line may name the secret field) plus structural checks of the
 * recorded decision doc - the instrument the mainnet runner reads at gate
 * time.
 */
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { test } from "node:test";
import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { xdr, Address, StrKey } from "@stellar/stellar-sdk";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..");
const RUNNER_REL = "scripts/stellar-soroban-authorized-deploy.mjs";
const DOC_REL = "docs/OWNER-DECISIONS-2026-11-08.md";

const deploy = await import(pathToFileURL(join(ROOT, RUNNER_REL)).href);
const mirror = await import(pathToFileURL(join(ROOT, "packages/stellar-soroban/index.mjs")).href);
const DOC_TEXT = await readFile(join(ROOT, DOC_REL), "utf8");

const sha256hex = (s) => createHash("sha256").update(s).digest("hex");
const headSha = () => execFileSync("git", ["rev-parse", "HEAD"], { cwd: ROOT }).toString().trim();

test("the committed decision doc is present and parses GREEN on every recorded literal", () => {
  const d = deploy.parseDecisionDoc(DOC_TEXT);
  assert.deepEqual(d.violations, [], `the committed instrument must satisfy every gate: ${d.violations.join(" | ")}`);
  assert.equal(d.authorizedDeploy, "YES");
  assert.equal(d.network, "mainnet");
  assert.equal(d.walletFile, ".stellar-wallet.json");
  assert.equal(d.laneWrites, "NONE");
  assert.equal(d.feeFloor, 1000000);
});

test("mutation applies AND bites: authorized_deploy demoted from YES is refused", () => {
  const mutant = DOC_TEXT.replace(/authorized_deploy: YES/, "authorized_deploy: NO");
  assert.notEqual(mutant, DOC_TEXT, "the mutation must actually apply (a fake control proves nothing)");
  const d = deploy.parseDecisionDoc(mutant);
  assert.equal(d.ok, false);
  assert.ok(d.violations.some((v) => v.includes("authorized_deploy")), `the demotion must be named: ${d.violations.join(" | ")}`);
});

test("mutation applies AND bites: a dropped decision marker is refused", () => {
  const mutant = DOC_TEXT.replace(deploy.DECISION_MARKER, "NOT-A-RECORDED-DECISION");
  assert.notEqual(mutant, DOC_TEXT, "the mutation must actually apply");
  const d = deploy.parseDecisionDoc(mutant);
  assert.equal(d.ok, false);
  assert.ok(d.violations.some((v) => v.includes("decision marker start line missing")));
});

test("mainnet without the owner flag is refused, even with a perfect doc+manifest", () => {
  const w = sha256hex("not-any-real-wasm-bytes");
  const manifest = { runId: 4248, artifactName: deploy.ARTIFACT_NAME, wasmSha256: w, headSha: headSha() };
  const v = deploy.mainnetGateViolations({ plan: { network: "mainnet", ownerAuthorized: false }, decisions: deploy.parseDecisionDoc(DOC_TEXT), manifest, wasmSha256: w });
  assert.deepEqual(v, ["missing --owner-authorized: mainnet is never assumed (fail-closed)"], `with doc+manifest otherwise perfect, ONLY the flag violation may appear: ${v.join(" | ")}`);
});

test("mutation applies AND bites: a wrong artifactName is refused", () => {
  const w = sha256hex("not-any-real-wasm-bytes");
  const v = deploy.mainnetGateViolations({ plan: { network: "mainnet", ownerAuthorized: true }, decisions: deploy.parseDecisionDoc(DOC_TEXT), manifest: { runId: 42, artifactName: "wrong-artifact", wasmSha256: w, headSha: headSha() }, wasmSha256: w });
  assert.equal(v.length, 1, `exactly the artifactName violation must remain: ${v.join(" | ")}`);
  assert.ok(v[0].includes(deploy.ARTIFACT_NAME));
});

test("mutation applies AND bites: runId 0 is refused", () => {
  const w = sha256hex("not-any-real-wasm-bytes");
  const v = deploy.mainnetGateViolations({ plan: { network: "mainnet", ownerAuthorized: true }, decisions: deploy.parseDecisionDoc(DOC_TEXT), manifest: { runId: 0, artifactName: deploy.ARTIFACT_NAME, wasmSha256: w, headSha: headSha() }, wasmSha256: w });
  assert.equal(v.length, 1);
  assert.ok(v[0].includes("manifest.runId"));
});

test("mutation applies AND bites: wasmSha256 identity mismatch is refused", () => {
  const real = sha256hex("the bytes the runner just read");
  const v = deploy.mainnetGateViolations({ plan: { network: "mainnet", ownerAuthorized: true }, decisions: deploy.parseDecisionDoc(DOC_TEXT), manifest: { runId: 42, artifactName: deploy.ARTIFACT_NAME, wasmSha256: sha256hex("different bytes"), headSha: headSha() }, wasmSha256: real });
  assert.equal(v.length, 1);
  assert.ok(v[0].includes("manifest.wasmSha256"));
});

test("mutation applies AND bites: a headSha that is NOT an ancestor of HEAD is refused", () => {
  const w = sha256hex("not-any-real-wasm-bytes");
  const v = deploy.mainnetGateViolations({ plan: { network: "mainnet", ownerAuthorized: true }, decisions: deploy.parseDecisionDoc(DOC_TEXT), manifest: { runId: 42, artifactName: deploy.ARTIFACT_NAME, wasmSha256: w, headSha: "0".repeat(40) }, wasmSha256: w });
  assert.ok(v.some((x) => x.includes("NOT an ancestor of HEAD")), `the ancestor gate must be named: ${v.join(" | ")}`);
});

test("fee policy: floor alone, then the 1.5x rehearsal rule on top", () => {
  assert.deepEqual(deploy.mainnetFeeViolations({ fee: "1000000" }), []);
  const floor = deploy.mainnetFeeViolations({ fee: "999999" });
  assert.equal(floor.length, 1);
  assert.ok(floor[0].includes(String(deploy.MAINNET_FEE_FLOOR)));
  const policy = deploy.mainnetFeeViolations({ fee: "1000000", rehearsalMaxFee: 1000000 });
  assert.equal(policy.length, 1);
  assert.ok(policy[0].includes("1.5x"));
  assert.deepEqual(deploy.mainnetFeeViolations({ fee: "1500000", rehearsalMaxFee: 1000000 }), []);
});

test("rehearsal-first gate: no artifact and a non-PASSED artifact both refuse", () => {
  assert.equal(deploy.rehearsalGate(null).length, 1);
  assert.ok(deploy.rehearsalGate(null)[0].includes("testnet rehearsal artifact missing"));
  const mutant = { summary: { verdict: "NOT_CONFIRMED — a fake verdict" } };
  assert.equal(deploy.rehearsalGate(mutant).length, 1);
  assert.ok(deploy.rehearsalGate(mutant)[0].includes("not PASSED"));
  assert.deepEqual(deploy.rehearsalGate({ summary: { verdict: deploy.REHEARSAL_VERDICT } }), []);
});

test("digestStable is order-independent and timestamp-free (the artifact digest contract)", () => {
  const a = { x: 1, nested: { b: 2, arr: [1, { k: "v" }] } };
  const reordered = { nested: { arr: [1, { k: "v" }], b: 2 }, x: 1 };
  assert.equal(deploy.digestStable(a), deploy.digestStable(reordered));
  assert.equal(deploy.digestStable({ t: 1, g: 2 }), deploy.digestStable({ g: 2, t: 1 }));
  assert.equal(String(deploy.digestStable({})).startsWith("sha256:"), true);
});

test("cross-language truth: the mirror derives the pinned known-answer id for the wallet owner", () => {
  const derived = mirror.deriveAuthorizedAnchorId({ owner: deploy.KNOWN_VECTOR.owner, hash: deploy.KNOWN_VECTOR.hash });
  assert.equal(derived.state, "DERIVED");
  assert.equal(derived.id, deploy.KNOWN_VECTOR.id);
});

test("deterministic salt: same deployer+wasm lands at the same instance; a different deployer forks", () => {
  const wasm = sha256hex("one-artifact");
  const s1 = Buffer.from(mirror.deriveSalt(makeStrkey("GA"), wasm)).toString("hex");
  const s2 = Buffer.from(mirror.deriveSalt(makeStrkey("GA"), wasm)).toString("hex");
  assert.equal(s1, s2);
  const other = Buffer.from(mirror.deriveSalt(makeStrkey("GC"), wasm)).toString("hex");
  assert.notEqual(s1, other);
});

test("artifact surfaces: two networks, two files, the mainnet name is the recorded one", () => {
  assert.notEqual(deploy.ARTIFACT_OUT.testnet, deploy.ARTIFACT_OUT.mainnet);
  assert.ok(deploy.ARTIFACT_OUT.mainnet.endsWith("docs/evidence/stellar-soroban-authorized-deploy.json"));
  assert.ok(deploy.ARTIFACT_OUT.testnet.endsWith("docs/evidence/stellar-soroban-authorized-deploy-testnet.json"));
});

test("secret discipline on the runner SOURCE (applied and bites): no console line names the secret field", async () => {
  const scanner = (text) => text.split("\n").filter((l) => /console\.(log|error|warn)/.test(l)).filter((l) => l.includes("secretKey"));
  const source = await readFile(join(ROOT, RUNNER_REL), "utf8");
  const consoleLines = source.split("\n").filter((l) => /console\.(log|error|warn)/.test(l));
  assert.ok(consoleLines.length >= 5, `scanner sanity: expected real console usage, found ${consoleLines.length}`);
  assert.deepEqual(scanner(source), [], "no console line may ever carry the secret field name");
  const leak = "console.log(\"a leak that must be caught: secretKey\");\n";
  assert.equal(scanner(leak + source).length, 1, "the scanner must bite on an injected leak (applied-and-bite)");
});

test("readback decoder: Option None (scvBool false); undecodable inputs stay fail-closed", () => {
  assert.equal(deploy.decodeAuthorizedAnchorScVal(xdr.ScVal.scvBool(false)).kind, "NONE");
  assert.equal(deploy.decodeAuthorizedAnchorScVal(null).kind, "UNDECODABLE");
  assert.equal(deploy.decodeAuthorizedAnchorScVal("not-an-scval").kind, "UNDECODABLE");
  const d = deploy.decodeAuthorizedAnchorScVal(xdr.ScVal.scvU32(7));
  assert.notEqual(d.kind, "SOME", "a non-vec arm can never fabricate a SOME record");
});

test("readback decoder: the typed-sim scvMap face (soroban-testnet measured 2026-11-08) decodes SOME", () => {
  // Measured live truth: the typed fill the host serializes the AuthorizedAnchor
  // structured return as an scvMap keyed "hash"/"owner"/"seq" through per-arm
  // own-prop classes that carry NO switch() — the 3-field vec face comes only
  // from event payloads. This vector replays that exact shape offline through
  // the same builders as the wire face (roundtrip on fromXDR base64 included),
  // so the decoder can never silently regress to the vec face alone.
  const hashHex = "ab".repeat(32);
  const owner = StrKey.encodeEd25519PublicKey(Buffer.alloc(32, 0x0f));
  const map = xdr.ScVal.scvMap([
    new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol("hash"), val: xdr.ScVal.scvBytes(Buffer.from(hashHex, "hex")) }),
    new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol("owner"), val: new Address(owner).toScVal() }),
    new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol("seq"), val: xdr.ScVal.scvU32(5643172) }),
  ]);
  assert.deepEqual(deploy.decodeAuthorizedAnchorScVal(map), { kind: "SOME", hashHex, owner, seq: 5643172 });
  assert.deepEqual(deploy.decodeAuthorizedAnchorScVal(map.toXDR("base64")), { kind: "SOME", hashHex, owner, seq: 5643172 }, "the fromXDR base64 roundtrip stays on the same typed face");
  const partial = xdr.ScVal.scvMap([new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol("hash"), val: xdr.ScVal.scvBytes(Buffer.from(hashHex, "hex")) })]);
  assert.equal(deploy.decodeAuthorizedAnchorScVal(partial).kind, "UNDECODABLE", "a map missing any of the three fields stays fail-closed");
});

/* ---------------- authorized-lane rejection decode + fee solvency ---------------- */

test("committed mainnet artifact: REJECTED upload(wasm) decodes txInsufficientBalance from its OWN bytes (fresh-clone-reproducible Phase-3 root cause)", async () => {
  const artifact = JSON.parse(await readFile(join(ROOT, "docs/evidence/stellar-soroban-authorized-deploy.json"), "utf8"));
  assert.equal(artifact.steps.length, 1);
  const step = artifact.steps[0];
  assert.equal(step.step, "upload(wasm)");
  assert.equal(step.state, "REJECTED");
  assert.equal(artifact.summary.deployed, false);
  assert.equal(artifact.summary.contractId, null);
  const emitted = JSON.parse(step.error);
  assert.equal(emitted.resultCode, null, "the 2026-11-09-era runner left the code unnamed; the bytes carry the verdict instead");
  const decoded = deploy.decodeTransactionResultCode(emitted.errorResultXdr);
  assert.equal(decoded.decodable, true);
  assert.equal(decoded.code, -7);
  assert.equal(decoded.name, "txInsufficientBalance", "the ledger's own code: a fee that would gobble minimum balance (NEVER a bad-seq/bad-auth arm)");
  assert.equal(decoded.feeCharged, "130861110");
  // Composition provable from the artifact's own numbers: requested inclusion bid (1,000,000)
  // + simulation-priced resource fee (129,861,110) = the charged fee. WASM upload is priced
  // by the network, so the fix is funding, never a lower --fee.
  assert.equal(BigInt(decoded.feeCharged) - BigInt(artifact.fee.requested), 129861110n);
});

test("decode fail-closed: junk never invents a code, and the rehearsal's measured txBadSeq blob still names itself", () => {
  assert.equal(deploy.decodeTransactionResultCode("AAAAAA==").decodable, false, "a truncated blob is not a code");
  assert.equal(deploy.decodeTransactionResultCode("not-an-xdr").decodable, false);
  assert.equal(deploy.decodeTransactionResultCode(null).decodable, false);
  assert.equal(deploy.decodeTransactionResultCode("").decodable, false);
  // The rehearsal's first-commit reject, verbatim from the runner's resume-path comment
  // (feeCharged 40674): -5 = txBadSeq — which also binds the canonical enum positions that
  // name today's -7 rejection (txBadSeq -5, txBadAuth -6, txInsufficientBalance -7).
  const seqRehearsal = deploy.decodeTransactionResultCode("AAAAAAAAnuL////7AAAAAA==");
  assert.equal(seqRehearsal.decodable, true);
  assert.equal(seqRehearsal.code, -5);
  assert.equal(seqRehearsal.feeCharged, "40674");
  assert.equal(seqRehearsal.name, "txBadSeq");
});

test("fee solvency: the measured figures are refused PRE-SEND; exact fee+reserve boundary applied-and-bites", () => {
  const measured = deploy.evaluateFeeSolvency({ feeStroops: "130861110", balanceStroops: "35069800", minReserveStroops: "10000000" });
  assert.equal(measured.state, "REJECTED_PRESEND");
  assert.equal(measured.shortfallStroops, "105791310", "fee + minimum balance - funded balance");
  assert.ok(measured.error.includes("txInsufficientBalance"));
  assert.ok(measured.error.includes("nothing was submitted"));
  assert.ok(measured.error.includes("140861110"), "the remedy must name the exact solvent minimum (declared fee + reserve)");
  assert.equal(deploy.evaluateFeeSolvency({ feeStroops: "130861110", balanceStroops: "140861110", minReserveStroops: "10000000" }).state, "ALLOWED", "fee + exact reserve = solvent at zero headroom");
  assert.equal(deploy.evaluateFeeSolvency({ feeStroops: "130861110", balanceStroops: "140861109", minReserveStroops: "10000000" }).state, "REJECTED_PRESEND", "one stroop short must bite");
  assert.equal(deploy.evaluateFeeSolvency({}).state, "REJECTED_PRESEND", "unreadable inputs fail closed");
  assert.equal(deploy.evaluateFeeSolvency({ feeStroops: "130861110.5", balanceStroops: "350698000", minReserveStroops: "10000000" }).state, "REJECTED_PRESEND", "a fractional fee is unreadable stroops - refuse");
  // The per-account EXACT minimum (this deployer carries a USDC trustline => 3 base reserves):
  assert.equal(deploy.exactMinBalanceStroops({ baseReserveStroops: "5000000", subentryCount: 0 }), 10000000n);
  assert.equal(deploy.exactMinBalanceStroops({ baseReserveStroops: "5000000", subentryCount: 1 }), 15000000n, "the funded deployer's shape (1 USDC trustline measured on the live wire)");
  assert.equal(deploy.exactMinBalanceStroops({ baseReserveStroops: "5000000", subentryCount: 1, numSponsored: 1 }), null, "sponsored shapes are not re-derived - the wire keeps the final word");
  assert.equal(deploy.exactMinBalanceStroops({ baseReserveStroops: "5000000" }), null);
  const trustlineAware = deploy.evaluateFeeSolvency({ feeStroops: "130861110", balanceStroops: "35069800", minReserveStroops: "15000000" });
  assert.equal(trustlineAware.state, "REJECTED_PRESEND");
  assert.equal(trustlineAware.shortfallStroops, "110791310");
  assert.ok(trustlineAware.error.includes("145861110"), "the trustline-aware solvent minimum: 130,861,110 + 3 x 5,000,000");
  // Exact stroop money parity (the funded floor was satisfied at 2 XLM while the fee needed 14.59):
  assert.equal(deploy.xlmStringToStroops("3.5069800"), 35069800n);
  assert.equal(deploy.xlmStringToStroops("2.0000000"), 20000000n);
  assert.equal(deploy.xlmStringToStroops("1.5"), 15000000n);
  assert.equal(deploy.xlmStringToStroops("0.00000012"), null, "beyond the ledger's 7-digit precision: never truncate money");
  assert.equal(deploy.xlmStringToStroops("-3.5"), null);
  assert.equal(deploy.xlmStringToStroops(null), null);
});

test("source contract: the solvency consult precedes EVERY submission, and artifacts self-decode rejections", async () => {
  const source = await readFile(join(ROOT, RUNNER_REL), "utf8");
  const gateIdx = source.indexOf("if (solvencyGate)");
  const sendIdx = source.indexOf("const res = await rpcServer.sendTransaction(prepared)");
  assert.ok(gateIdx !== -1, "deleting the gate consult must bite here");
  assert.ok(sendIdx !== -1, "the submission site must exist");
  assert.ok(gateIdx < sendIdx, "the gate must be consulted before the FIRST sendTransaction");
  assert.ok(source.includes('rejectFace: "PRE_SEND_SOLVENCY"'), "the local refusal is machine-readable, distinct from wire rejects");
  assert.ok(source.includes('decodeTransactionResultCode(b64)'), "artifacts self-decode rejections - resultCode null can never return");
  assert.ok(source.includes('s.state === "REJECTED" || s.state === "FAILED" || s.state === "TIMEOUT"'), "a failed step always downgrades the verdict (the false-EXECUTED-VERIFIED class)");
  const mutant = source.replace("if (solvencyGate)", "if (false)");
  assert.notEqual(mutant, source, "the mutation must actually apply");
  assert.equal(mutant.indexOf("if (solvencyGate)"), -1, "the scanner is anchored to the exact consult literal, not a substring coincidence");
});

function makeStrkey(prefix) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let out = prefix;
  while (out.length < 56) out += chars[out.length % chars.length];
  return out;
}

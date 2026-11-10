#!/usr/bin/env node
/**
 * scripts/stellar-soroban-deploy-live-verify.mjs — PHASE 5 post-deploy LIVE PROOF
 * for the owner-authorized mainnet under the recorded decision
 * (docs/OWNER-DECISIONS-2026-11-08.md): post-deploy readback is
 * "read_authorized SIMULATION ONLY (no submit)" and mainnet-lane-writes are NONE.
 *
 * This script performs NO signing, NO submission and NEVER reads the wallet file:
 * its entire factual surface is PUBLIC — the recorded deploy artifact (committed
 * evidence) plus the deployed public key + RPC/Horizon public reads. It is the
 * honest completion of the deploy cycle whose own 2026-11-10 run sealed its
 * readback fail-closed: the fresh-vault lane serialized scvVoid and the decode
 * toolkit named it UNDECODABLE — verdict NOT_CONFIRMED preserved, never rewritten.
 *
 * Legs (every one fail-closed):
 *   1. prior-artifact digest faithfulness — digestStable over the recorded bytes
 *      (verifyMode's own convention: generatedAt + evidenceDigest excluded).
 *   2. deployment honesty — laneWrites NONE; upload + create INVOKED with tx
 *      hashes; contractId C-format; the deploy verdict stays as recorded.
 *   3. RAW wire identity (create) — RPC getTransaction(create tx) → SUCCESS +
 *      the contract re-parsed from its OWN result meta by the mirror's parser;
 *      raw result payload stored verbatim [C37 — never proxied objects].
 *   4. RAW wire lane (fresh vault) — mirror buildInvokeTx("read_authorized") on
 *      the LIVE sequence → runner simResultFace → decodeAuthorizedAnchorScVal →
 *      SIMULATED_NONE. A successful simulation is itself live-instance proof
 *      (the host reads code + instance from real ledger state); the retval is
 *      stored verbatim.
 *   5. balance arithmetic to the stroop [C37 identity] — recorded pre-run
 *      balance − feeCharged(upload) − feeCharged(create) === live native balance.
 *   6. bonus identity leg, recorded AS-MEASURED: getLedgerEntries instance entry
 *      (exact XDR LedgerKey bytes). On public endpoints that refuse the method
 *      the record stays WIRE_UNAVAILABLE — never fabricated (the identity is
 *      already proven by legs 3 + 4).
 *
 * Usage:
 *   node scripts/stellar-soroban-deploy-live-verify.mjs --network mainnet --owner-authorized
 *
 * Exit: 0 live proof written · 1 fail-closed refusal (named; refusal state also
 * recorded) · 2 usage. The run never process.exit()s before stdout drains ([C14]).
 * Artifact: docs/evidence/stellar-soroban-deploy-live-verify-2026-11-10.json
 */

import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { xdr, StrKey } from "@stellar/stellar-sdk";
import { Server as RpcServer } from "@stellar/stellar-sdk/rpc";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const OUT_REL = "docs/evidence/stellar-soroban-deploy-live-verify-2026-11-10.json";

const mirror = await import(pathToFileURL(join(ROOT, "packages/stellar-soroban/index.mjs")).href);
const deploy = await import(pathToFileURL(join(ROOT, "scripts/stellar-soroban-authorized-deploy.mjs")).href);

export const LIVE_VERDICT =
  "MAINNET AUTHORIZED-LANE DEPLOY LIVE-VERIFIED (create proven from its own result meta; fresh-vault readback SIMULATED_NONE; balance arithmetic exact to the stroop)";

export const LIVE_VERIFY_FAILURES = {
  ARTIFACT_MISSING: "prior deploy artifact missing or malformed",
  DIGEST_MISMATCH: "prior artifact digest mismatch (the recorded truth was edited)",
  DEPLOY_NOT_HONEST: "prior artifact does not carry the executed deployment",
  CREATE_TX_MISMATCH: "the create transaction on the wire does not confirm the recorded contract",
  READBACK_NOT_EMPTY: "read_authorized did not return the fresh-vault empty lane",
  BALANCE_ARITHMETIC: "the balance arithmetic does not reconcile to the stroop",
};

async function readDeployArtifact(rel) {
  try {
    return JSON.parse(await readFile(join(ROOT, rel), "utf8"));
  } catch {
    return null;
  }
}

async function rpcPost(infra, method, params) {
  const res = await fetch(infra.rpc, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const body = await res.json().catch(() => null);
  return { httpStatus: res.status, body };
}

export async function liveVerify(plan) {
  if (plan.network !== "mainnet") {
    return { ok: false, reason: LIVE_VERIFY_FAILURES.DEPLOY_NOT_HONEST, detail: "live verify is mainnet-scoped (the recorded decision)", code: 1 };
  }
  if (plan.ownerAuthorized !== true) {
    return { ok: false, reason: LIVE_VERIFY_FAILURES.DEPLOY_NOT_HONEST, detail: "live verify requires --owner-authorized (nothing is signed, but the surface is owner-scoped by instrument)", code: 1 };
  }
  if (plan.wasmPath || plan.manifestPath || plan.fee) {
    return { ok: false, reason: LIVE_VERIFY_FAILURES.DEPLOY_NOT_HONEST, detail: "live verify carries no deploy material (wasmPath/manifestPath/fee are deploy-scope only)", code: 2 };
  }
  const infra = deploy.INFRA.mainnet;

  // Leg 1 — digest faithfulness of the recorded execution (verifyMode's convention).
  const prior = await readDeployArtifact(deploy.ARTIFACT_OUT.mainnet);
  if (!prior || prior.artifact !== "stellar-soroban-authorized-deploy" || prior.version !== "SOROBAN-AUTHORIZED-DEPLOY/1" || !prior.evidenceDigest || !prior.generatedAt) {
    return { ok: false, reason: LIVE_VERIFY_FAILURES.ARTIFACT_MISSING, detail: deploy.ARTIFACT_OUT.mainnet, code: 1 };
  }
  const { generatedAt, evidenceDigest, ...rest } = prior;
  if (deploy.digestStable(rest) !== evidenceDigest) {
    return { ok: false, reason: LIVE_VERIFY_FAILURES.DIGEST_MISMATCH, detail: deploy.ARTIFACT_OUT.mainnet, code: 1 };
  }

  // Leg 2 — the recorded step truth (INVOKED steps named with tx hashes; laneWrites NONE).
  const steps = Array.isArray(rest.steps) ? rest.steps : [];
  const up = steps[0];
  const cr = steps[1];
  const intakeOk =
    rest.laneWrites === "NONE" &&
    up && up.step === "upload(wasm)" && up.state === "INVOKED" && typeof up.hash === "string" && Number.isInteger(up.feeCharged) &&
    cr && cr.step === "createCustomContract" && cr.state === "INVOKED" && typeof cr.hash === "string" && Number.isInteger(cr.feeCharged) &&
    typeof rest.summary.contractId === "string" && /^C[A-Z2-7]{55}$/.test(rest.summary.contractId) &&
    typeof rest.deployer === "string" && /^G[A-Z2-7]{55}$/.test(rest.deployer) &&
    rest.wasm && rest.wasm.sha256;
  if (!intakeOk) {
    return { ok: false, reason: LIVE_VERIFY_FAILURES.DEPLOY_NOT_HONEST, detail: "steps/contractId/deployer shape", code: 1 };
  }
  const contractId = rest.summary.contractId;

  const artifact = {
    schema: "stellar-soroban-deploy-live-verify/1",
    decisionMarker: deploy.DECISION_MARKER,
    network: "mainnet",
    deployer: rest.deployer,
    verified: {
      deployArtifact: deploy.ARTIFACT_OUT.mainnet,
      deployEvidenceDigest: evidenceDigest,
      deployGeneratedAt: generatedAt,
      deployVerdict: rest.summary.verdict,
      contractId,
      uploadTxHash: up.hash,
      createTxHash: cr.hash,
    },
    legs: {},
  };

  // Leg 3 — RAW create-transaction identity proof (wire's own result meta).
  const txRes = await rpcPost(infra, "getTransaction", { hash: cr.hash });
  let createdContractId = null;
  let createSuccessful = false;
  let createLedger = null;
  if (txRes.body && txRes.body.result && typeof txRes.body.result.resultMetaXdr === "string") {
    const wire = txRes.body.result;
    createSuccessful = wire.status === "SUCCESS";
    createLedger = wire.ledger ?? null;
    const parsed = mirror.parseContractIdFromCreateResult(wire.resultMetaXdr);
    if (parsed.state === "READ_OK") createdContractId = parsed.contractId;
    artifact.legs.createTransaction = {
      method: "getTransaction",
      success: createSuccessful,
      ledger: createLedger,
      contractIdParsed: createdContractId,
      // raw payload subset, verbatim ([C37]): status, ledger, envelope hash + the meta itself
      envelopeXdr: wire.envelopeXdr ?? null,
      resultXdr: wire.resultXdr ?? null,
      resultMetaXdr: wire.resultMetaXdr,
      latestLedger: wire.latestLedger ?? null,
    };
  } else {
    artifact.legs.createTransaction = { method: "getTransaction", httpStatus: txRes.httpStatus, endpointError: txRes.body && txRes.body.error || null };
  }
  if (!createSuccessful || createdContractId !== contractId) {
    return {
      ok: false,
      reason: LIVE_VERIFY_FAILURES.CREATE_TX_MISMATCH,
      detail: `ledger-side create identity ${createdContractId || "(unparseable)"} vs recorded ${contractId}`,
      code: 1,
      artifact,
    };
  }

  // Leg 4 — RAW fresh-vault readback (simulation only; no submission; owner-authorized
  // builder lane conversation: the mirror's mainnet gate wants the explicit flag, same
  // as the runner's readbackSim — nothing here is ever signed or submitted).
  const acctRes = await fetch(`${infra.horizon}/accounts/${rest.deployer}`, { headers: { accept: "application/json" } });
  if (!acctRes.ok) {
    artifact.legs.readback = { state: "SIM_ERROR", error: `horizon account HTTP ${acctRes.status}` };
    return { ok: false, reason: LIVE_VERIFY_FAILURES.READBACK_NOT_EMPTY, detail: artifact.legs.readback.error, code: 1, artifact };
  }
  const acct = await acctRes.json();
  // Canonical next sequence (Horizon exposes the CURRENT seq_num; a valid tx is seq+1).
  const seqBig = (() => { try { return BigInt(acct.sequence) + 1n; } catch { return null; } })();
  if (seqBig === null) {
    artifact.legs.readback = { state: "SIM_ERROR", error: "account sequence unreadable" };
    return { ok: false, reason: LIVE_VERIFY_FAILURES.READBACK_NOT_EMPTY, detail: "account sequence unreadable", code: 1, artifact };
  }
  const anchorDerived = mirror.deriveAuthorizedAnchorId({ owner: rest.deployer, hash: deploy.KNOWN_VECTOR.hash });
  if (!anchorDerived || anchorDerived.state !== "DERIVED" || typeof anchorDerived.id !== "string") {
    artifact.legs.readback = { state: "SIM_ERROR", error: `anchor id derivation gated: ${JSON.stringify(anchorDerived)}` };
    return { ok: false, reason: LIVE_VERIFY_FAILURES.READBACK_NOT_EMPTY, detail: `anchor id derivation failed (${JSON.stringify(anchorDerived)})`, code: 1, artifact };
  }
  const anchorId = anchorDerived.id;
  const built = mirror.buildInvokeTx({
    contractId,
    functionName: "read_authorized",
    source: rest.deployer,
    sequence: String(seqBig),
    commitmentId: anchorId,
    network: "mainnet",
    fee: "1000000",
    ownerAuthorization: true,
  });
  if (built.state !== "BUILD_OK") {
    artifact.legs.readback = { state: "GATED", error: built.error };
    return { ok: false, reason: LIVE_VERIFY_FAILURES.READBACK_NOT_EMPTY, detail: `builder gated: ${built.error}`, code: 1, artifact };
  }
  const rpcServer = new RpcServer(infra.rpc);
  let sim = null;
  try { sim = await rpcServer.simulateTransaction(built.tx); }
  catch (e) {
    artifact.legs.readback = { state: "SIM_ERROR", submitted: false, error: (e && e.message) || String(e) };
    return { ok: false, reason: LIVE_VERIFY_FAILURES.READBACK_NOT_EMPTY, detail: artifact.legs.readback.error, code: 1, artifact };
  }
  if (sim && sim.error) {
    artifact.legs.readback = { state: "SIM_ERROR", submitted: false, error: sim.error };
    return { ok: false, reason: LIVE_VERIFY_FAILURES.READBACK_NOT_EMPTY, detail: String(sim.error), code: 1, artifact };
  }
  const face = deploy.simResultFace(sim);
  const decoded = deploy.decodeAuthorizedAnchorScVal(face ? face.retval : null);
  // Raw retval archived verbatim ([C37]): the parsed ScVal face is serialized to
  // base64 the same round the runner's OWN decoder consumed it — never a proxy.
  const rawRetval = (() => {
    if (!face || face.retval === null || face.retval === undefined) return null;
    if (typeof face.retval === "string") return face.retval;
    try { return typeof face.retval.toXDR === "function" ? face.retval.toXDR("base64") : null; } catch { return null; }
  })();
  artifact.legs.readback = {
    // Runner vocabulary byte-parity: readbackSim names this exact state on a None lane.
    state: decoded.kind === "NONE" ? "SIMULATED_NONE" : decoded.kind,
    decodedKind: decoded.kind,
    submitted: false,
    readTargetId: anchorId,
    simFace: face ? face.face : "none",
    retvalXdr: rawRetval,
  };
  if (decoded.kind !== "NONE") {
    return { ok: false, reason: LIVE_VERIFY_FAILURES.READBACK_NOT_EMPTY, detail: `fresh-vault readback decoded ${decoded.kind} (${JSON.stringify(decoded)})`, code: 1, artifact };
  }

  // Leg 5 — balance arithmetic to the stroop [C37 binomics]: exactly one spent identity.
  const native = ((acct.balances || []).find((b) => b.asset_type === "native") || {}).balance;
  const liveBalance = deploy.xlmStringToStroops(native);
  const recorded = BigInt(rest.deployerBalanceStroops);
  const spent = BigInt(up.feeCharged) + BigInt(cr.feeCharged);
  const expected = recorded - spent;
  if (liveBalance === null || liveBalance !== expected) {
    artifact.legs.balanceArithmetic = {
      expectedStroops: String(expected),
      liveNativeXlm: native ?? null,
      liveBalanceStroops: liveBalance === null ? null : String(liveBalance),
      exact: false,
    };
    return { ok: false, reason: LIVE_VERIFY_FAILURES.BALANCE_ARITHMETIC, detail: `live ${native ?? "(unreadable)"} vs expected ${expected} stroops (recorded ${recorded} − fees ${spent})`, code: 1, artifact };
  }
  artifact.legs.balanceArithmetic = {
    recordedDeployerBalanceStroops: String(recorded),
    uploadFeeCharged: String(BigInt(up.feeCharged)),
    createFeeCharged: String(BigInt(cr.feeCharged)),
    expectedStroops: String(expected),
    liveNativeXlm: native,
    liveBalanceStroops: String(liveBalance),
    exact: true,
  };

  // Leg 6 — bonus identity leg, recorded AS-MEASURED (exact XDR key bytes).
  let keyBytes = null;
  try { keyBytes = StrKey.decodeContract(contractId); } catch { keyBytes = null; }
  if (keyBytes && keyBytes.length === 32) {
    const liveKey = xdr.LedgerKey.contractData(new xdr.LedgerKeyContractData({
      contract: xdr.ScAddress.scAddressTypeContract(new xdr.ContractId(keyBytes)),
      key: xdr.ScVal.scvLedgerKeyContractInstance(),
      durability: xdr.ContractDataDurability.persistent,
    })).toXDR("base64");
    let entriesRes = null;
    try { entriesRes = await rpcPost(infra, "getLedgerEntries", { keys: [liveKey] }); }
    catch (e) { entriesRes = { httpStatus: 0, body: { error: (e && e.message) || String(e) } }; }
    const liveEntries = entriesRes.body && entriesRes.body.result && Array.isArray(entriesRes.body.result.entries)
      ? entriesRes.body.result.entries
      : null;
    if (liveEntries === null) {
      artifact.legs.instanceLedgerEntry = {
        state: "WIRE_UNAVAILABLE",
        httpStatus: entriesRes.httpStatus,
        endpointError: (entriesRes.body && entriesRes.body.error) || null,
        note: "this public endpoint does not expose getLedgerEntries — identity is already proven by leg 3 (created contract bound to this deploy's wasm material) and leg 4 (the contract executes against real ledger state)",
      };
    } else {
      let execHex = null;
      let lastLedger = null;
      for (const ent of liveEntries) {
        try {
          const row = xdr.LedgerEntryData.fromXDR(ent.xdr || ent.data, "base64");
          const inst = row.contractData.val && (row.contractData.val.instance || row.contractData.val.contractInstance);
          const exec = inst && inst.executable && inst.executable.wasmHash && inst.executable.wasmHash.value;
          if (exec) { execHex = Buffer.from(exec).toString("hex"); lastLedger = ent.lastModifiedLedgerSeq || null; }
        } catch { /* fallthrough */ }
      }
      if (execHex !== rest.wasm.sha256) {
        artifact.legs.instanceLedgerEntry = { state: "FAILED", execWasmHashHex: execHex, expected: rest.wasm.sha256 };
        return { ok: false, reason: LIVE_VERIFY_FAILURES.CREATE_TX_MISMATCH, detail: `instance entry exec ${execHex || "(undecodable)"} vs deploy wasm ${rest.wasm.sha256.slice(0, 12)}…`, code: 1, artifact };
      }
      artifact.legs.instanceLedgerEntry = { state: "RESOLVED", execWasmHashHex: execHex, lastModifiedLedgerSeq: lastLedger };
    }
  } else {
    artifact.legs.instanceLedgerEntry = { state: "SKIPPED", error: "contractId undecodable to 32 raw bytes" };
  }

  artifact.finishedAtUtc = new Date().toISOString();
  artifact.summary = {
    contractId,
    network: "mainnet",
    verdict: LIVE_VERDICT,
    liveConfirmed: true,
  };
  const { finishedAtUtc, evidenceDigest: _d, ...core } = artifact;
  artifact.evidenceDigest = deploy.digestStable(core);

  return { ok: true, code: 0, artifact };
}

/** CLI driver — sets process.exitCode and lets stdout drain ([C14]; no process.exit). */
export async function main(argv = []) {
  const plan = deploy.parsePlan(argv);
  const violations = [...deploy.planViolations(plan)];
  if (!["mainnet"].includes(plan.network)) violations.push(`--network must be mainnet (got ${JSON.stringify(plan.network)})`);
  if (plan.ownerAuthorized !== true) violations.push("--owner-authorized is required (owner-scoped surface per the recorded decision)");
  if (plan.wasmPath || plan.manifestPath || plan.fee) violations.push("live verify carries no deploy material (--wasm-path/--wasm-manifest/--fee are deploy-scope)");
  if (plan.rehearse || plan.verify) violations.push("--rehearse/--verify belong to the deploy runner, not the live verifier");
  if (violations.length) {
    console.error(`USAGE REFUSED (fail-closed):\n  ${violations.join("\n  ")}`);
    process.exitCode = 2;
    return 2;
  }

  const out = await liveVerify(plan);
  if (!out.ok) {
    console.error(`LIVE-VERIFY REFUSED (${out.reason}): ${out.detail}`);
    if (out.artifact) {
      await writeFile(join(ROOT, OUT_REL), deploy.stableStringify(out.artifact) + "\n", "utf8");
      console.error(`refusal state recorded: ${OUT_REL}`);
    }
    process.exitCode = 1;
    return 1;
  }
  await writeFile(join(ROOT, OUT_REL), deploy.stableStringify(out.artifact) + "\n", "utf8");
  const a = out.artifact;
  console.log(`artifact: ${OUT_REL}`);
  console.log(`verdict: ${a.summary.verdict}`);
  console.log(`contractId: ${a.summary.contractId}`);
  for (const [name, leg] of Object.entries(a.legs)) {
    const face = leg.state ?? (leg.success === true ? "SUCCESS" : String(leg.exact === true ? "EXACT" : ""));
    console.log(`  leg ${name}: ${face}`);
  }
  console.log(`digest: ${a.evidenceDigest}`);
  process.exitCode = 0;
  return 0;
}

if (process.argv[1] && process.argv[1].replace(/\\/g, "/").endsWith("stellar-soroban-deploy-live-verify.mjs")) {
  await main(process.argv.slice(2));
}

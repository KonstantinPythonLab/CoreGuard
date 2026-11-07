import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  SOROBAN_VERSION,
  NETWORKS,
  status,
  selfCheck,
  buildUploadTx,
  buildCreateContractTx,
  buildInvokeTx,
  sha256Hex,
  parseContractIdFromCreateResult,
  executeAnchorFlow,
  AUTH_ANCHOR_DOMAIN,
  deriveAuthorizedAnchorId,
} from "../../packages/stellar-soroban/index.mjs";
import { Keypair, Networks, TransactionBuilder, StrKey, xdr } from "@stellar/stellar-sdk";

test("SOROBAN/1 exports", () => {
  assert.equal(SOROBAN_VERSION, "SOROBAN/1");
  assert.deepEqual(NETWORKS, { TESTNET: "Test SDF Network ; September 2015", MAINNET: "Public Global Stellar Network ; September 2015" });
});

test("status() honest", () => {
  const s = status();
  assert.equal(s.runMode, "DRY_RUN");
  assert.equal(s.hasCredentials, false);
  assert.equal(s.authorized, false);
  assert.equal(s.executed, false);
});

test("selfCheck() passes", () => {
  assert.equal(selfCheck().ok, true);
});

test("builders refuse mainnet fail-closed", () => {
  const kp = Keypair.random();
  assert.equal(buildUploadTx({ wasm: Buffer.alloc(10), source: kp.publicKey(), sequence: "1", network: "mainnet", fee: "100" }).state, "NOT_AUTHORIZED");
  assert.equal(buildCreateContractTx({ source: kp.publicKey(), wasmHash: "a".repeat(64), sequence: "1", network: "mainnet", fee: "100" }).state, "NOT_AUTHORIZED");
  assert.equal(buildInvokeTx({ source: kp.publicKey(), contractId: "CCERTRITP7A6U4PQ7NUKHXKWL2BNRMSBLVAAAWWMRAZTICUN7ZGC5Q4R", functionName: "commit", commitmentId: Buffer.alloc(32), commitmentHash: Buffer.alloc(32), sequence: "1", network: "mainnet", fee: "100" }).state, "NOT_AUTHORIZED");
});

test("parseContractIdFromCreateResult reads v4 returnValue", () => {
  // Fixture lives IN the tree (portable across machines/CI) — never a dev Temp path.
  const fixture = join(dirname(fileURLToPath(import.meta.url)), "..", "fixtures", "create-meta-v4.b64.txt");
  const b64 = readFileSync(fixture, "utf8");
  const r = parseContractIdFromCreateResult(b64.trim());
  assert.equal(r.state, "READ_OK");
  assert.ok(r.contractId && r.contractId.startsWith("C"));
});

test("sha256Hex stable", () => {
  const h = sha256Hex(Buffer.from("abc"));
  assert.equal(h.length, 64);
});

test("executeAnchorFlow requires submitter", async () => {
  const kp = Keypair.random();
  const r = await executeAnchorFlow({ keypair: kp, network: "testnet", server: {}, submitter: null, wasm: Buffer.alloc(10), commitment: { id: "1", hashHex: "a".repeat(64) } });
  assert.equal(r.state, "NOT_PERFORMED");
});

// ---- The executed mainnet commit (2026-11-06, owner-authorized) ----

const EXEC_PAIR = {
  contractId: "CCKA2GYVILX7YZVSXGVIHOPNLTRBBF2SSWKBTQBIE7M67N5N2QMMXPSP",
  proofId: "0xecd9e6b3d8780c55ca3d60e88b7ff79317b3cba187e43240a540891e4cada6b8",
  commitment: "0xc0dbfb45b6c8e13b3738822360ea737adfc045d4acb808bdaeac563c8af31052",
  txHash: "69044807410f65027c1227f4e525ad83f23a6cb1a2bb79790d82849c5dbc9fec",
  ledger: 65337373,
};

const byteHex = (x) => Buffer.from(Uint8Array.from(Object.values(x))).toString("hex");
const xdrStr = (x) => (typeof x === "string" ? x : (x && x.bytes ? Buffer.from(x.bytes).toString() : String(x)));

/** Decode a built/signed commit invoke and assert the exact wire op. */
function assertInvokeCommitOps(xdrBase64, passphrase) {
  const tx = TransactionBuilder.fromXDR(xdrBase64, passphrase); // wrong passphrase throws
  const op = tx.operations[0];
  assert.equal(op.type, "invokeHostFunction", "wire op must be the invoke host-function op");
  const hfObj = op.func.toXdrObject();
  assert.equal(hfObj.type, 0, "host fn must be invoke-contract");
  assert.equal(xdrStr(hfObj.invokeContract.functionName), "commit");
  assert.equal(byteHex(hfObj.invokeContract.contractAddress.contractId), byteHex(StrKey.decodeContract(EXEC_PAIR.contractId)), "contract id must match deployed anchor");
  const a = hfObj.invokeContract.args;
  assert.equal(a.length, 2);
  assert.equal(a[0].type, 13, "arg1 = SCVAL_BYTES");
  assert.equal(byteHex(a[0].bytes), EXEC_PAIR.proofId.slice(2), "arg1 = proofId bytes");
  assert.equal(a[1].type, 13, "arg2 = SCVAL_BYTES");
  assert.equal(byteHex(a[1].bytes), EXEC_PAIR.commitment.slice(2), "arg2 = commitment bytes");
  return tx;
}

test("status() carries the executed first commit facts (honest additive)", () => {
  const s = status();
  const c = s.firstCommitExecuted;
  assert.equal(c.state, "INVOKED");
  assert.equal(c.network, "mainnet");
  assert.equal(c.contractId, EXEC_PAIR.contractId);
  assert.equal(c.proofId, EXEC_PAIR.proofId);
  assert.equal(c.commitment, EXEC_PAIR.commitment);
  assert.equal(c.txHash, EXEC_PAIR.txHash);
  assert.equal(c.ledger, EXEC_PAIR.ledger);
  assert.equal(c.runner, "scripts/stellar-soroban-commit-executed.mjs");
  assert.equal(c.evidence, "docs/evidence/stellar-soroban-commit-executed.json");
});

test("mainnet builders build ONLY with ownerAuthorization (owner-authorized lane)", () => {
  const s = status(); // posture unchanged for the bare module
  assert.equal(s.runMode, "DRY_RUN");
  assert.equal(s.authorized, false);
  const kp = Keypair.random();
  const built = buildInvokeTx({
    contractId: EXEC_PAIR.contractId,
    functionName: "commit",
    source: kp.publicKey(),
    sequence: "999",
    commitmentId: EXEC_PAIR.proofId,
    commitmentHash: EXEC_PAIR.commitment,
    network: "mainnet",
    fee: "1000000",
    ownerAuthorization: true, // the owner's explicit decision passed by the caller
  });
  assert.equal(built.state, "BUILD_OK");
  // decoding the envelope with the PUBLIC passphrase proves the deferred-gated
  // mainnet lane resolves Networks.PUBLIC (never an undefined constant)
  assertInvokeCommitOps(built.tx.toXDR("base64"), Networks.PUBLIC);
});

test("executeAnchorFlow commit-only on mainnet -> INVOKED via injected submitter", async () => {
  let submits = 0;
  let sentXdr = null;
  const kp = Keypair.random();
  const res = await executeAnchorFlow({
    network: "mainnet",
    deployerKey: kp,
    commitmentId: EXEC_PAIR.proofId,
    commitmentHash: EXEC_PAIR.commitment,
    getSequence: async () => "999",
    submit: async (x) => { submits++; sentXdr = x; return { state: "SUBMITTED", hash: EXEC_PAIR.txHash }; },
    wait: async (h) => { assert.equal(h, EXEC_PAIR.txHash); return { state: "INVOKED", ledger: EXEC_PAIR.ledger }; },
    deployedContractId: EXEC_PAIR.contractId,
    ownerAuthorization: true,
    fee: "1000000",
  });
  assert.equal(res.state, "INVOKED");
  assert.equal(res.ownerAuthorized, true);
  assert.equal(res.contractId, EXEC_PAIR.contractId);
  assert.equal(res.commitHash, EXEC_PAIR.txHash);
  assert.equal(res.ledger, EXEC_PAIR.ledger);
  assert.equal(submits, 1);
  assert.equal(res.steps[res.steps.length - 1].step, "commit");
  assertInvokeCommitOps(sentXdr, Networks.PUBLIC);
  assert.ok(Buffer.from(sentXdr, "base64").includes(Buffer.from(EXEC_PAIR.proofId.slice(2), "hex")));
  assert.ok(Buffer.from(sentXdr, "base64").includes(Buffer.from(EXEC_PAIR.commitment.slice(2), "hex")));
});

test("executeAnchorFlow fail-closed defaults preserved (mainnet WITHOUT ownerAuth, no submitter, no wait, FAILED wait)", async () => {
  const kp = Keypair.random();
  let submits = 0;
  const noAuth = await executeAnchorFlow({
    network: "mainnet",
    deployerKey: kp,
    commitmentId: EXEC_PAIR.proofId,
    commitmentHash: EXEC_PAIR.commitment,
    deployedContractId: EXEC_PAIR.contractId,
    getSequence: async () => "1",
    submit: async () => { submits++; return { state: "SUBMITTED", hash: "h" }; },
  });
  assert.equal(noAuth.state, "NOT_AUTHORIZED");
  assert.deepEqual(noAuth.steps, []);
  assert.equal(submits, 0); // nothing left the room

  const noSubmitter = await executeAnchorFlow({
    network: "testnet",
    deployerKey: kp,
    commitmentId: EXEC_PAIR.proofId,
    commitmentHash: EXEC_PAIR.commitment,
    deployedContractId: EXEC_PAIR.contractId,
  });
  assert.equal(noSubmitter.state, "NOT_PERFORMED");

  const noWait = await executeAnchorFlow({
    network: "testnet",
    deployerKey: kp,
    commitmentId: EXEC_PAIR.proofId,
    commitmentHash: EXEC_PAIR.commitment,
    deployedContractId: EXEC_PAIR.contractId,
    getSequence: async () => "1",
    submit: async () => ({ state: "SUBMITTED", hash: "h2" }),
  });
  assert.equal(noWait.state, "SUBMITTED"); // honest intermediate: submitted, not confirmed

  const failed = await executeAnchorFlow({
    network: "testnet",
    deployerKey: kp,
    commitmentId: EXEC_PAIR.proofId,
    commitmentHash: EXEC_PAIR.commitment,
    deployedContractId: EXEC_PAIR.contractId,
    getSequence: async () => "1",
    submit: async () => ({ state: "SUBMITTED", hash: "h3" }),
    wait: async () => ({ state: "FAILED" }),
  });
  assert.equal(failed.state, "REJECTED");
});

// ---- AUTHORIZED anchor lane (additive; the identity-enforced surface) ----

const WORK_HASH = "0xc0dbfb45b6c8e13b3738822360ea737adfc045d4acb808bdaeac563c8af31052";
const VECTOR_ID = "0xb5f9655d4c0b4292ed0be7cd87b68e71297c1bf94667a9657ce3b6f6cbec6f30";
const OWNER_STRKEY = "GDJ3CRNLNDZ4AVWGPUG7DBC5BIAGMIONOONZGB5FSYAY44ZHOIPRKY7U";

/** Decode a built invoke envelope into {functionName, args} (SDK XDR objects). */
function decodeInvoke(xdrBase64, passphrase) {
  const tx = TransactionBuilder.fromXDR(xdrBase64, passphrase);
  const op = tx.operations[0];
  assert.equal(op.type, "invokeHostFunction", "wire op must be the invoke host-function op");
  const hfObj = op.func.toXdrObject();
  assert.equal(hfObj.type, 0, "host fn must be invoke-contract");
  const ic = hfObj.invokeContract;
  const names = { 13: "bytes", 18: "address" };
  const args = ic.args.map((a) => ({
    kind: names[a.type] || `type${a.type}`,
    bytes: a.bytes ? Buffer.from(a.bytes) : null,
    addressKind: a.address ? a.address.type : null, // 0 = account, 1 = contract
    accountId: a.address && a.address.accountId ? StrKey.encodeEd25519PublicKey(Buffer.from(Uint8Array.from(Object.values(a.address.accountId.ed25519)))) : null,
  }));
  return { functionName: String(ic.functionName), args, tx };
}

const buildAuthInvoke = (functionName, extra = {}) => buildInvokeTx({
  contractId: EXEC_PAIR.contractId,
  functionName,
  source: Keypair.random().publicKey(),
  sequence: "77",
  commitmentId: VECTOR_ID,
  commitmentHash: WORK_HASH,
  owner: OWNER_STRKEY,
  network: "testnet",
  fee: "100",
  ...extra,
});

test("auth lane derivation matches the cross-language known-answer vector", () => {
  assert.equal(AUTH_ANCHOR_DOMAIN, "coreguard-anchor-auth/1");
  const d0x = deriveAuthorizedAnchorId({ owner: OWNER_STRKEY, hash: WORK_HASH });
  assert.equal(d0x.state, "DERIVED");
  assert.equal(d0x.error, null);
  assert.equal(d0x.id, VECTOR_ID);
  // "0x"-prefix and bare-hex inputs derive the SAME canonical id.
  const dBare = deriveAuthorizedAnchorId({ owner: OWNER_STRKEY, hash: WORK_HASH.slice(2) });
  assert.equal(dBare.id, VECTOR_ID);
});

test("auth lane derivation is fail-closed on malformed inputs", () => {
  assert.equal(deriveAuthorizedAnchorId({}).state, "GATED");
  assert.equal(deriveAuthorizedAnchorId({ owner: OWNER_STRKEY }).state, "GATED");
  assert.equal(deriveAuthorizedAnchorId({ owner: OWNER_STRKEY, hash: "0x1234" }).state, "GATED");
  assert.equal(deriveAuthorizedAnchorId({ owner: "GDJ3", hash: WORK_HASH }).state, "GATED");
  // A 32-byte hex string that is not a valid strkey shape still gates.
  assert.equal(deriveAuthorizedAnchorId({ owner: "Z" + "A".repeat(55), hash: WORK_HASH }).state, "GATED");
});

test("the authorized id binds the OWNER and the HASH (front-run impossibility shape)", () => {
  // A stranger owner (their own valid ed25519 key) derives a DIFFERENT id
  // from the same content: the attacker cannot pre-register the owner's id,
  // they can only create their own. A different hash for the same owner is
  // likewise a different id: "right id, wrong value" has no derivation path.
  const attackerDerivation = deriveAuthorizedAnchorId({
    owner: Keypair.random().publicKey(),
    hash: WORK_HASH,
  });
  const ownerDerivation = deriveAuthorizedAnchorId({ owner: OWNER_STRKEY, hash: WORK_HASH });
  assert.notEqual(attackerDerivation.id, ownerDerivation.id);
  const otherHash = "0xc1" + WORK_HASH.slice(4);
  assert.notEqual(
    deriveAuthorizedAnchorId({ owner: OWNER_STRKEY, hash: otherHash }).id,
    ownerDerivation.id,
  );
});

test("commit_authorized envelope carries (owner, hash) — NO id argument exists", () => {
  const tx = buildAuthInvoke("commit_authorized", { commitmentId: undefined });
  assert.equal(tx.state, "BUILD_OK");
  const d = decodeInvoke(tx.tx.toXDR("base64"), Networks.TESTNET);
  assert.equal(d.functionName, "commit_authorized");
  assert.equal(d.args.length, 2, "two args only: owner + hash (no id to lie about)");
  assert.equal(d.args[0].kind, "address");
  assert.equal(d.args[0].addressKind, 0, "owner must be an ACCOUNT address");
  assert.equal(d.args[0].accountId, OWNER_STRKEY, "owner identity is the wallet strkey");
  assert.equal(d.args[1].kind, "bytes");
  assert.equal(d.args[1].bytes.toString("hex"), WORK_HASH.slice(2));
});

test("read_authorized envelope carries the derived id only", () => {
  const tx = buildAuthInvoke("read_authorized", { owner: undefined });
  assert.equal(tx.state, "BUILD_OK");
  const d = decodeInvoke(tx.tx.toXDR("base64"), Networks.TESTNET);
  assert.equal(d.functionName, "read_authorized");
  assert.equal(d.args.length, 1);
  assert.equal(d.args[0].kind, "bytes");
  assert.equal(d.args[0].bytes.toString("hex"), VECTOR_ID.slice(2), "the id read back is the derived one");
});

test("assert_anchored_authorized envelope carries (id, owner, hash)", () => {
  const tx = buildAuthInvoke("assert_anchored_authorized");
  assert.equal(tx.state, "BUILD_OK");
  const d = decodeInvoke(tx.tx.toXDR("base64"), Networks.TESTNET);
  assert.equal(d.functionName, "assert_anchored_authorized");
  assert.equal(d.args.length, 3);
  assert.equal(d.args[0].kind, "bytes");
  assert.equal(d.args[0].bytes.toString("hex"), VECTOR_ID.slice(2));
  assert.equal(d.args[1].kind, "address");
  assert.equal(d.args[1].addressKind, 0);
  assert.equal(d.args[1].accountId, OWNER_STRKEY);
  assert.equal(d.args[2].kind, "bytes");
  assert.equal(d.args[2].bytes.toString("hex"), WORK_HASH.slice(2));
});

test("authorized lane builders keep the mainnet fail-closed posture", () => {
  // No ownerAuthorization flag -> every authorized-lane builder refuses mainnet.
  for (const fn of ["commit_authorized", "read_authorized", "assert_anchored_authorized"]) {
    const refused = buildAuthInvoke(fn, { network: "mainnet", ownerAuthorization: false });
    assert.equal(refused.state, "NOT_AUTHORIZED", `mainnet must refuse ${fn} without the owner flag`);
  }
  // With the owner's explicit flag the envelope still builds (the DEPLOY
  // decision for the source's new lane stays a separate owner act).
  const built = buildAuthInvoke("commit_authorized", { network: "mainnet", ownerAuthorization: true });
  assert.equal(built.state, "BUILD_OK");
});

test("authorized lane builders gate malformed owners and unknown function names", () => {
  // Missing owner argument -> GATED (fail-closed, never a silent default).
  assert.equal(buildAuthInvoke("commit_authorized", { owner: undefined }).state, "GATED");
  assert.equal(buildAuthInvoke("assert_anchored_authorized", { owner: undefined }).state, "GATED");
  // A 56-char G-shape with an invalid CRC throws inside the SDK -> GATED.
  assert.equal(buildAuthInvoke("commit_authorized", { owner: "G" + "A".repeat(55) }).state, "GATED");
  // Misspelled function names never slip through as permissionless calls.
  assert.equal(buildAuthInvoke("commitz").state, "GATED");
  assert.equal(buildAuthInvoke("commit_authorizedX").state, "GATED");
});

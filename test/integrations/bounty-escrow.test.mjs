import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  ESCROW_VERSION,
  ESCROW_STATES,
  createBountyEscrow,
  escrowIdFor,
  signEvidence,
  assertAddress,
  assertAmount,
  selfCheck as escrowSelfCheck,
} from "../../packages/bounty-escrow/index.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));

const FUNDER = "G" + "A".repeat(55);
const MAINTAINER = "G" + "B".repeat(55);
const CONTRIBUTOR = "G" + "C".repeat(55);
const SECRET = "test-secret-not-a-real-key";
const AMOUNT = "2500000000";
const DIGEST = "ab".repeat(32);
const SWAPPED = "cd".repeat(32);
const FROZEN_CLOCK = () => 1750000000;

// Known-answer vectors (measured once, pinned here; a re-derivation that
// disagrees means the canonical form or the domain separation drifted).
const KNOWN_ID = "dd0cf4b869be072d2faf810e7fd5288506ecc78892963cf5b7632115bebc56e4";
const KNOWN_SIG = "ec64609a56b78723dc6f9f4a006fe0c28df76ec6caf38d1ab7e9f6dfe1bb7e9d";

function freshEscrow() {
  return createBountyEscrow({ maintainerSecret: SECRET, clock: FROZEN_CLOCK });
}

function seededEscrow({ digest = DIGEST, contributor = CONTRIBUTOR } = {}) {
  const h = freshEscrow();
  const opened = h.open({ bountyId: "CG-BTY-007", funder: FUNDER, maintainer: MAINTAINER, amount: AMOUNT });
  assert.equal(opened.ok, true);
  h.fund({ escrowId: opened.escrowId, funder: FUNDER, amount: AMOUNT });
  h.claim({ escrowId: opened.escrowId, contributor });
  h.deliver({ escrowId: opened.escrowId, contributor, evidenceDigest: digest });
  return { h, escrowId: opened.escrowId };
}

test("selfCheck: the mirror's own battery is all-green and non-empty", () => {
  const result = escrowSelfCheck();
  assert.equal(result.ok, true, result.cases.filter(([, pass]) => !pass).map(([label]) => label).join(" | "));
  assert.ok(result.cases.length >= 25, `expected a real battery, got ${result.cases.length} cases`);
  const labels = result.cases.map(([label]) => label);
  assert.ok(labels.some((l) => l.includes("evidence stays escrowed")), "the release-before-verify control must be named");
  assert.ok(labels.some((l) => l.includes("single-spend")), "the single-spend control must be named");
});

test("version and state vocabulary are the documented lifecycle", () => {
  assert.equal(ESCROW_VERSION, "ESCROW/1");
  assert.deepEqual([...ESCROW_STATES], ["OPEN", "FUNDED", "CLAIMED", "DELIVERED", "VERIFIED", "RELEASED", "REFUNDED"]);
});

test("known-answer vectors: the spec id and the maintainer signature re-derive byte-exactly", () => {
  const id = escrowIdFor({ bountyId: "CG-BTY-007", funder: FUNDER, maintainer: MAINTAINER, amount: AMOUNT });
  assert.equal(id, KNOWN_ID);
  assert.equal(escrowIdFor({ ...{ bountyId: "CG-BTY-007", funder: FUNDER, maintainer: MAINTAINER, amount: AMOUNT } }), KNOWN_ID);
  const sig = signEvidence({ secret: SECRET, escrowId: KNOWN_ID, evidenceDigest: DIGEST, contributor: CONTRIBUTOR, amount: AMOUNT });
  assert.equal(sig, KNOWN_SIG);
});

test("input validation: canonical amounts only, Stellar addresses only", () => {
  for (const bad of ["12.5", "-5", "007", "1e9", "", " 1", "١٢٣"]) {
    const gate = assertAmount(bad, "amount");
    assert.equal(gate.ok, false, `amount ${JSON.stringify(bad)} must be refused`);
    assert.equal(gate.code, "INVALID_AMOUNT");
  }
  assert.equal(assertAmount(2500000000, "amount").ok, false, "a number is never an amount");
  assert.equal(assertAmount("2500000000", "amount").ok, true);

  for (const bad of ["G" + "A".repeat(54), "G" + "A".repeat(56), "g" + "A".repeat(55), "0" + "A".repeat(55), "G" + "0".repeat(55), "G" + "1".repeat(55), "G" + "8".repeat(55), "G" + "9".repeat(55)]) {
    const gate = assertAddress(bad, "address");
    assert.equal(gate.ok, false, `address ${JSON.stringify(bad.slice(0, 8) + "...")} must be refused`);
    assert.equal(gate.code, "INVALID_ADDRESS");
  }
  assert.equal(assertAddress(FUNDER, "address").ok, true);

  const h = freshEscrow();
  assert.equal(h.open({ bountyId: "CG-BTY-007", funder: FUNDER, maintainer: MAINTAINER, amount: "0" }).code, "INVALID_AMOUNT", "a zero escrow is not an escrow");
  assert.equal(h.open({ bountyId: "", funder: FUNDER, maintainer: MAINTAINER, amount: AMOUNT }).code, "INVALID_BOUNTY");
});

test("full lifecycle: open, fund, claim, deliver, verify, release - one dense event trail", () => {
  const h = freshEscrow();
  const opened = h.open({ bountyId: "CG-BTY-007", funder: FUNDER, maintainer: MAINTAINER, amount: AMOUNT });
  assert.equal(opened.ok, true);
  assert.match(opened.escrowId, /^[0-9a-f]{64}$/);
  assert.equal(h.fund({ escrowId: opened.escrowId, funder: FUNDER, amount: AMOUNT }).state, "FUNDED");
  assert.equal(h.claim({ escrowId: opened.escrowId, contributor: CONTRIBUTOR }).state, "CLAIMED");
  assert.equal(h.deliver({ escrowId: opened.escrowId, contributor: CONTRIBUTOR, evidenceDigest: DIGEST }).state, "DELIVERED");
  const sig = signEvidence({ secret: SECRET, escrowId: opened.escrowId, evidenceDigest: DIGEST, contributor: CONTRIBUTOR, amount: AMOUNT });
  assert.equal(h.verify({ escrowId: opened.escrowId, signature: sig }).state, "VERIFIED");
  const released = h.release({ escrowId: opened.escrowId });
  assert.equal(released.ok, true);
  assert.equal(released.state, "RELEASED");
  assert.equal(released.to, CONTRIBUTOR);
  assert.equal(h.escrow(opened.escrowId).state, "RELEASED");
  const events = h.events();
  assert.equal(events.length, 6);
  assert.deepEqual(events.map((e) => e.to), ["OPEN", "FUNDED", "CLAIMED", "DELIVERED", "VERIFIED", "RELEASED"]);
  assert.ok(events.every((e) => e.at === 1750000000), "the frozen clock pins every transition");
});

test("funding discipline: exact amount, spec funder, one escrow per bounty", () => {
  const h = freshEscrow();
  const opened = h.open({ bountyId: "CG-BTY-007", funder: FUNDER, maintainer: MAINTAINER, amount: AMOUNT });
  assert.equal(h.fund({ escrowId: opened.escrowId, funder: FUNDER, amount: "1000000000" }).code, "AMOUNT_MISMATCH");
  assert.equal(h.fund({ escrowId: opened.escrowId, funder: FUNDER, amount: AMOUNT + "0" }).code, "AMOUNT_MISMATCH", "over-funding is not funding");
  assert.equal(h.fund({ escrowId: opened.escrowId, funder: MAINTAINER, amount: AMOUNT }).code, "WRONG_FUNDER");
  assert.equal(h.fund({ escrowId: opened.escrowId, funder: FUNDER, amount: AMOUNT }).state, "FUNDED");
  assert.equal(h.fund({ escrowId: opened.escrowId, funder: FUNDER, amount: AMOUNT }).code, "NOT_OPEN", "a second funding is a double-lock");
  assert.equal(h.open({ bountyId: "CG-BTY-007", funder: FUNDER, maintainer: MAINTAINER, amount: AMOUNT }).code, "BOUNTY_ALREADY_ESCROWED");
  const other = h.open({ bountyId: "CG-BTY-005", funder: FUNDER, maintainer: MAINTAINER, amount: AMOUNT });
  assert.equal(other.ok, true, "a different bounty opens its own escrow");
  assert.notEqual(other.escrowId, opened.escrowId);
});

test("negative control 1: release before verify is REFUSED - unverified evidence stays escrowed", () => {
  const { h, escrowId } = seededEscrow();
  const early = h.release({ escrowId });
  assert.equal(early.ok, false);
  assert.equal(early.code, "NOT_VERIFIED");
  assert.equal(h.escrow(escrowId).state, "DELIVERED", "the evidence stays escrowed, not released");
  assert.equal(h.metrics().releasedCount, 0);
  assert.equal(h.metrics().releasedAmount, "0", "the refused release moved nothing");
});

test("negative control 2: a signature over one digest never verifies a swapped one", () => {
  const honest = seededEscrow({ digest: DIGEST });
  const sig = signEvidence({ secret: SECRET, escrowId: honest.escrowId, evidenceDigest: DIGEST, contributor: CONTRIBUTOR, amount: AMOUNT });
  assert.equal(honest.h.verify({ escrowId: honest.escrowId, signature: sig }).ok, true, "the honest pair verifies first");

  const { h, escrowId } = seededEscrow({ digest: SWAPPED });
  assert.equal(escrowId, honest.escrowId, "same terms -> same id: two ledgers hold the same escrow identity");
  const swapped = h.verify({ escrowId, signature: sig });
  assert.equal(swapped.ok, false);
  assert.equal(swapped.code, "BAD_EVIDENCE_SIGNATURE");
  assert.equal(h.escrow(escrowId).state, "DELIVERED", "the swapped evidence stays escrowed");
});

test("negative control 3: the escrow pays the claimed contributor and nobody else", () => {
  const h = freshEscrow();
  const opened = h.open({ bountyId: "CG-BTY-007", funder: FUNDER, maintainer: MAINTAINER, amount: AMOUNT });
  h.fund({ escrowId: opened.escrowId, funder: FUNDER, amount: AMOUNT });
  h.claim({ escrowId: opened.escrowId, contributor: CONTRIBUTOR });
  assert.equal(h.claim({ escrowId: opened.escrowId, contributor: MAINTAINER }).code, "CONTRIBUTOR_LOCKED", "the claim is single-shot");
  assert.equal(h.deliver({ escrowId: opened.escrowId, contributor: MAINTAINER, evidenceDigest: DIGEST }).code, "WRONG_CONTRIBUTOR", "a stranger cannot deliver into a claimed escrow");
  assert.equal(h.deliver({ escrowId: opened.escrowId, contributor: CONTRIBUTOR, evidenceDigest: DIGEST }).ok, true);
  assert.equal(h.deliver({ escrowId: opened.escrowId, contributor: MAINTAINER, evidenceDigest: SWAPPED }).code, "EVIDENCE_LOCKED", "once evidence froze, even the real contributor cannot re-deliver");
  assert.equal(h.escrow(opened.escrowId).contributor, CONTRIBUTOR);
  const sig = signEvidence({ secret: SECRET, escrowId: opened.escrowId, evidenceDigest: DIGEST, contributor: CONTRIBUTOR, amount: AMOUNT });
  h.verify({ escrowId: opened.escrowId, signature: sig });
  const released = h.release({ escrowId: opened.escrowId });
  assert.equal(released.to, CONTRIBUTOR, "release credits the claimed contributor only");
});

test("negative control 4: release is single-spend", () => {
  const { h, escrowId } = seededEscrow();
  h.verify({ escrowId, signature: signEvidence({ secret: SECRET, escrowId, evidenceDigest: DIGEST, contributor: CONTRIBUTOR, amount: AMOUNT }) });
  assert.equal(h.release({ escrowId }).ok, true);
  const second = h.release({ escrowId });
  assert.equal(second.ok, false);
  assert.equal(second.code, "ALREADY_RELEASED");
  assert.equal(h.metrics().releasedCount, 0, "DRY_RUN: no payer confirmed, so the metrics moved nothing");
  assert.equal(h.metrics().releasedAmount, "0");
});

test("negative control 5: refund returns the FULL amount, then nothing further moves", () => {
  const h = freshEscrow();
  const opened = h.open({ bountyId: "CG-BTY-007", funder: FUNDER, maintainer: MAINTAINER, amount: AMOUNT });
  h.fund({ escrowId: opened.escrowId, funder: FUNDER, amount: AMOUNT });
  h.claim({ escrowId: opened.escrowId, contributor: CONTRIBUTOR });
  h.deliver({ escrowId: opened.escrowId, contributor: CONTRIBUTOR, evidenceDigest: DIGEST });
  const refunded = h.refund({ escrowId: opened.escrowId, reason: "no approved bounty funding exists" });
  assert.equal(refunded.ok, true);
  assert.equal(refunded.state, "REFUNDED");
  assert.equal(refunded.to, FUNDER);
  assert.equal(refunded.full, true, "the funder is made whole");
  assert.equal(h.verify({ escrowId: opened.escrowId, signature: signEvidence({ secret: SECRET, escrowId: opened.escrowId, evidenceDigest: DIGEST, contributor: CONTRIBUTOR, amount: AMOUNT }) }).ok, false, "after a refund nothing verifies");
  assert.equal(h.release({ escrowId: opened.escrowId }).code, "REFUNDED_ALREADY", "after a refund nothing releases");
  assert.equal(h.refund({ escrowId: opened.escrowId }).code, "ALREADY_REFUNDED", "refund is single-spend");
  assert.equal(h.metrics().refundedAmount, "0", "DRY_RUN: the metric counts payer-confirmed movements only");
});

test("verification discipline: fail-closed without a secret, forged signatures refused, evidence frozen at first delivery", () => {
  const noSecret = createBountyEscrow({ clock: FROZEN_CLOCK });
  const opened = noSecret.open({ bountyId: "CG-BTY-007", funder: FUNDER, maintainer: MAINTAINER, amount: AMOUNT });
  noSecret.fund({ escrowId: opened.escrowId, funder: FUNDER, amount: AMOUNT });
  noSecret.claim({ escrowId: opened.escrowId, contributor: CONTRIBUTOR });
  noSecret.deliver({ escrowId: opened.escrowId, contributor: CONTRIBUTOR, evidenceDigest: DIGEST });
  const attempted = noSecret.verify({ escrowId: opened.escrowId, signature: KNOWN_SIG });
  assert.equal(attempted.ok, false);
  assert.equal(attempted.code, "NO_MAINTAINER_SECRET", "fail-closed: no secret, no VERIFIED");

  const { h, escrowId } = seededEscrow();
  assert.equal(h.verify({ escrowId, signature: "0".repeat(64) }).code, "BAD_EVIDENCE_SIGNATURE", "a forged hex blob is refused");
  assert.equal(h.verify({ escrowId, signature: "" }).code, "BAD_EVIDENCE_SIGNATURE");
  assert.equal(h.deliver({ escrowId, contributor: CONTRIBUTOR, evidenceDigest: SWAPPED }).code, "EVIDENCE_LOCKED", "re-delivery would be a tamper surface");

  const badDigest = freshEscrow();
  const bOpen = badDigest.open({ bountyId: "CG-BTY-007", funder: FUNDER, maintainer: MAINTAINER, amount: AMOUNT });
  badDigest.fund({ escrowId: bOpen.escrowId, funder: FUNDER, amount: AMOUNT });
  badDigest.claim({ escrowId: bOpen.escrowId, contributor: CONTRIBUTOR });
  assert.equal(badDigest.deliver({ escrowId: bOpen.escrowId, contributor: CONTRIBUTOR, evidenceDigest: "not-hex" }).code, "INVALID_DIGEST");
  assert.equal(badDigest.deliver({ escrowId: bOpen.escrowId, contributor: CONTRIBUTOR, evidenceDigest: "AB".repeat(32) }).code, "INVALID_DIGEST", "uppercase hex is not the canonical form");
});

test("LIVE mode: the payer adapter is the only funds movement, and it must name its payment", () => {
  const paid = [];
  const live = createBountyEscrow({
    maintainerSecret: SECRET,
    clock: FROZEN_CLOCK,
    mode: "LIVE",
    payer: { pay: ({ to, amount, escrowId }) => { paid.push({ to, amount, escrowId }); return { paymentRef: "PAY-1" }; }, payFunder: () => ({ paymentRef: "REFUND-1" }) },
  });
  const opened = live.open({ bountyId: "CG-BTY-007", funder: FUNDER, maintainer: MAINTAINER, amount: AMOUNT });
  live.fund({ escrowId: opened.escrowId, funder: FUNDER, amount: AMOUNT });
  live.claim({ escrowId: opened.escrowId, contributor: CONTRIBUTOR });
  live.deliver({ escrowId: opened.escrowId, contributor: CONTRIBUTOR, evidenceDigest: DIGEST });
  live.verify({ escrowId: opened.escrowId, signature: signEvidence({ secret: SECRET, escrowId: opened.escrowId, evidenceDigest: DIGEST, contributor: CONTRIBUTOR, amount: AMOUNT }) });
  const released = live.release({ escrowId: opened.escrowId });
  assert.equal(released.ok, true);
  assert.equal(released.paymentRef, "PAY-1");
  assert.deepEqual(paid, [{ to: CONTRIBUTOR, amount: AMOUNT, escrowId: opened.escrowId }]);
  assert.equal(live.metrics().releasedCount, 1);
  assert.equal(live.metrics().releasedAmount, AMOUNT, "the metric counts payer-confirmed movement only");

  const blind = createBountyEscrow({
    maintainerSecret: SECRET,
    clock: FROZEN_CLOCK,
    mode: "LIVE",
    payer: { pay: () => ({}), payFunder: () => ({ paymentRef: "REFUND-1" }) },
  });
  const bOpen = blind.open({ bountyId: "CG-BTY-007", funder: FUNDER, maintainer: MAINTAINER, amount: AMOUNT });
  blind.fund({ escrowId: bOpen.escrowId, funder: FUNDER, amount: AMOUNT });
  blind.claim({ escrowId: bOpen.escrowId, contributor: CONTRIBUTOR });
  blind.deliver({ escrowId: bOpen.escrowId, contributor: CONTRIBUTOR, evidenceDigest: DIGEST });
  blind.verify({ escrowId: bOpen.escrowId, signature: signEvidence({ secret: SECRET, escrowId: bOpen.escrowId, evidenceDigest: DIGEST, contributor: CONTRIBUTOR, amount: AMOUNT }) });
  const bReleased = blind.release({ escrowId: bOpen.escrowId });
  assert.equal(bReleased.ok, false);
  assert.equal(bReleased.code, "NO_PAYMENT_REF", "a payer that cannot name a payment has not paid");
  assert.equal(blind.escrow(bOpen.escrowId).state, "VERIFIED", "the escrow stays VERIFIED - nothing is lost, nothing is double-spent");

  assert.throws(() => createBountyEscrow({ mode: "LIVE" }), /payer adapter/, "LIVE without a payer is a construction error");
  assert.throws(() => createBountyEscrow({ mode: "SOMETIMES" }), /mode must be DRY_RUN or LIVE/);
});

test("determinism: two frozen-clock runs produce identical ids and identical event trails", () => {
  const a = freshEscrow();
  const b = freshEscrow();
  const ia = a.open({ bountyId: "CG-BTY-007", funder: FUNDER, maintainer: MAINTAINER, amount: AMOUNT });
  const ib = b.open({ bountyId: "CG-BTY-007", funder: FUNDER, maintainer: MAINTAINER, amount: AMOUNT });
  assert.equal(ia.escrowId, ib.escrowId);
  for (const h of [a, b]) {
    h.fund({ escrowId: ia.escrowId, funder: FUNDER, amount: AMOUNT });
    h.claim({ escrowId: ia.escrowId, contributor: CONTRIBUTOR });
    h.deliver({ escrowId: ia.escrowId, contributor: CONTRIBUTOR, evidenceDigest: DIGEST });
  }
  const sig = signEvidence({ secret: SECRET, escrowId: ia.escrowId, evidenceDigest: DIGEST, contributor: CONTRIBUTOR, amount: AMOUNT });
  a.verify({ escrowId: ia.escrowId, signature: sig });
  b.verify({ escrowId: ib.escrowId, signature: sig });
  a.release({ escrowId: ia.escrowId });
  b.release({ escrowId: ib.escrowId });
  assert.deepEqual(a.events(), b.events());
});

test("package discipline: the mirror ships WITHOUT a package.json (the workspaces lockfile trap)", () => {
  const packageDir = join(HERE, "..", "..", "packages", "bounty-escrow");
  assert.equal(existsSync(join(packageDir, "package.json")), false, "a package.json here needs npm install + a committed lockfile or every npm ci leg dies; standalone surfaces ship relative imports only (x402/webhook precedent)");
  assert.equal(existsSync(join(packageDir, "index.mjs")), true);
});

/**
 * index.mjs — ESCROW/1, the CoreGuard bounty-escrow mirror (CG-BTY-007 / #55).
 *
 * What this is: a deterministic, dependency-light JavaScript mirror of the
 * Soroban bounty-escrow lifecycle specified in issue #55, so the lifecycle's
 * fail-closed rules are executable and testable in pure JS today, before any
 * contract deploy is authorized. Same discipline as X402/1: canonical bytes,
 * a domain-separated HMAC, an injected clock, an honest metrics surface.
 *
 * What this is NOT, and never becomes from inside this file:
 *   - it is NOT a contract. No Soroban deploy, no XDR, no RPC, no network
 *     call exists here; the on-chain deploy stays blocked on external human
 *     review plus the owner's broadcast sign-off (binding governance).
 *   - it is NOT money. metrics() reports releasedCount 0 and releasedAmount
 *     "0" until a caller's payer adapter confirms a real movement; there is
 *     no code path in this file that moves funds in DRY_RUN.
 *   - it is NOT key management. The maintainer signature is an injected,
 *     domain-separated HMAC exactly like X402/1's challenge signature; it
 *     proves the reviewed evidence digest, never which software held a key.
 *
 * The five fail-closed rules (each backed by a negative control in
 * test/integrations/bounty-escrow.test.mjs):
 *   1. release before verify is REFUSED - unverified evidence stays escrowed.
 *   2. a signature is bound to the escrow's OWN evidence digest; a swapped or
 *      tampered digest never verifies - release stays impossible.
 *   3. the escrow pays the CLAIMED contributor and nobody else; the claim is
 *      single-shot and the contributor is locked at claim time.
 *   4. release is single-spend - a second release is REFUSED.
 *   5. refund returns the FULL amount to the funder, and after a refund or a
 *      release nothing further can move.
 *
 * Amounts are validated canonical decimal STRINGS (^(0|[1-9]\d*)$) - never
 * floats, never user-supplied numbers - and compared with BigInt internally,
 * so the arithmetic identity the chain contract enforces is the arithmetic
 * this mirror enforces: the escrow holds exactly the funded amount, pays it
 * exactly once, or refunds it exactly whole.
 */

import { createHmac, timingSafeEqual } from "node:crypto";
import { canonicalize } from "../canonical/index.js";

export const ESCROW_VERSION = "ESCROW/1";
export const ID_DOMAIN = "ESCROW/1:ID";
export const VERIFY_DOMAIN = "ESCROW/1:VERIFY";
export const ASSET_DEFAULT = "USDC";

export const ESCROW_STATES = Object.freeze([
  "OPEN",
  "FUNDED",
  "CLAIMED",
  "DELIVERED",
  "VERIFIED",
  "RELEASED",
  "REFUNDED",
]);

const ADDRESS_RE = /^G[A-Z2-7]{55}$/; // Stellar account: G + 55 base32 chars, no 0/1/8/9
const AMOUNT_RE = /^(0|[1-9]\d*)$/; // canonical decimal string: no sign, no dot, no leading zero
const DIGEST_RE = /^[0-9a-f]{64}$/; // sha256 hex

function canonicalBytes(value) {
  return canonicalize(value);
}

function fail(field, code, detail) {
  return { ok: false, code, detail: `${field}: ${detail}` };
}

export function assertAddress(value, field = "address") {
  if (typeof value !== "string" || !ADDRESS_RE.test(value)) {
    return fail(field, "INVALID_ADDRESS", "expected a G-prefixed 56-character base32 Stellar address");
  }
  return { ok: true, code: null, detail: null };
}

export function assertAmount(value, field = "amount") {
  if (typeof value !== "string" || !AMOUNT_RE.test(value)) {
    return fail(field, "INVALID_AMOUNT", "expected a canonical decimal string like \"2500000000\" - no sign, no dot, no leading zero, never a number");
  }
  return { ok: true, code: null, detail: null };
}

/**
 * escrowIdFor — pure, spec-derived id (state never enters it, so two
 * ledgers holding the same terms hold the same id, and a swapped delivery
 * record on one of them is provable against the other).
 */
export function escrowIdFor({ bountyId, funder, maintainer, amount, asset = ASSET_DEFAULT } = {}) {
  const spec = { version: ESCROW_VERSION, bountyId, funder, maintainer, amount, asset };
  return createHmac("sha256", ID_DOMAIN).update(canonicalBytes(spec), "utf8").digest("hex");
}

/**
 * signEvidence — the maintainer's verification signature (X402/1 pattern):
 * a domain-separated HMAC over the canonical {escrowId, evidenceDigest,
 * contributor, amount}. The signature is bound to the evidence digest that
 * was reviewed, so a digest swapped afterwards cannot verify.
 */
export function signEvidence({ secret, escrowId, evidenceDigest, contributor, amount }) {
  if (typeof secret !== "string" || secret.length === 0) {
    throw new TypeError("signEvidence: secret (string) is required - no unsigned default exists");
  }
  const payload = { domain: VERIFY_DOMAIN, escrowId, evidenceDigest, contributor, amount };
  return createHmac("sha256", secret).update(canonicalBytes(payload), "utf8").digest("hex");
}

function evidenceSignatureValid({ secret, escrowId, evidenceDigest, contributor, amount, signature }) {
  if (typeof signature !== "string" || signature.length === 0) return false;
  const expected = signEvidence({ secret, escrowId, evidenceDigest, contributor, amount });
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(signature, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * createBountyEscrow — the integrator-facing surface (mirror of one escrow
 * ledger).
 *
 * @param {object}  opts
 * @param {string} [opts.maintainerSecret] injected HMAC secret; WITHOUT it
 *   nothing can ever reach VERIFIED (fail-closed by construction).
 * @param {function}[opts.clock] () => epoch seconds (injected, deterministic).
 * @param {string} [opts.mode] DRY_RUN (default) | LIVE.
 * @param {object} [opts.payer] LIVE-only adapter:
 *   { pay({to,amount,escrowId}) -> {paymentRef}, payFunder({...}) -> {paymentRef} }.
 *   REQUIRED for LIVE - there is no built-in funds movement.
 */
export function createBountyEscrow({ maintainerSecret = null, clock = () => Math.floor(Date.now() / 1000), mode = "DRY_RUN", payer = null } = {}) {
  if (mode !== "DRY_RUN" && mode !== "LIVE") {
    throw new TypeError("createBountyEscrow: mode must be DRY_RUN or LIVE");
  }
  if (mode === "LIVE" && (!payer || typeof payer.pay !== "function" || typeof payer.payFunder !== "function")) {
    throw new TypeError("createBountyEscrow: LIVE mode requires a payer adapter with pay() and payFunder() - there is no built-in funds movement");
  }

  const escrows = new Map();
  const log = [];
  const metrics = { escrows: 0, fundedCount: 0, verifiedCount: 0, releasedCount: 0, releasedAmount: 0n, refundedCount: 0, refundedAmount: 0n };
  let releasedSum = 0n;
  let refundedSum = 0n;

  function record(escrowId, from, to, extra = {}) {
    log.push({ at: Number(clock()), escrowId, from, to, ...extra });
  }

  function refused(escrowId, code, detail) {
    return { ok: false, state: escrowId && escrows.has(escrowId) ? escrows.get(escrowId).state : null, code, detail, metrics: snapshotMetrics() };
  }

  function snapshotMetrics() {
    return { ...metrics, releasedAmount: releasedSum.toString(), refundedAmount: refundedSum.toString() };
  }

  function open({ bountyId, funder, maintainer, amount, asset = ASSET_DEFAULT } = {}) {
    if (typeof bountyId !== "string" || bountyId.length === 0) {
      return fail("bountyId", "INVALID_BOUNTY", "a bounty id is required");
    }
    for (const [name, value] of [["funder", funder], ["maintainer", maintainer]]) {
      const gate = assertAddress(value, name);
      if (!gate.ok) return gate;
    }
    const amountGate = assertAmount(amount, "amount");
    if (!amountGate.ok) return amountGate;
    if (BigInt(amount) === 0n) {
      return fail("amount", "INVALID_AMOUNT", "a zero escrow is not an escrow");
    }
    if (escrows.size > 0) {
      for (const existing of escrows.values()) {
        if (existing.spec.bountyId === bountyId) {
          return fail("bountyId", "BOUNTY_ALREADY_ESCROWED", "one escrow per bounty - open a superseding bounty instead");
        }
      }
    }
    const escrowId = escrowIdFor({ bountyId, funder, maintainer, amount, asset });
    escrows.set(escrowId, {
      escrowId,
      spec: Object.freeze({ bountyId, funder, maintainer, amount, asset }),
      state: "OPEN",
      contributor: null,
      evidenceDigest: null,
      timeline: [{ at: Number(clock()), from: null, to: "OPEN" }],
    });
    metrics.escrows += 1;
    record(escrowId, null, "OPEN");
    return { ok: true, state: "OPEN", escrowId, metrics: snapshotMetrics() };
  }

  function getEscrow(escrowId) {
    if (typeof escrowId !== "string" || !escrows.has(escrowId)) return null;
    return escrows.get(escrowId);
  }

  function fund({ escrowId, funder, amount } = {}) {
    const e = getEscrow(escrowId);
    if (!e) return refused(escrowId, "NO_ESCROW", "no escrow holds this id");
    if (e.state !== "OPEN") return refused(escrowId, "NOT_OPEN", `escrow is ${e.state}, not OPEN - a second funding is a double-lock`);
    const funderGate = assertAddress(funder, "funder");
    if (!funderGate.ok) return funderGate;
    if (funder !== e.spec.funder) return refused(escrowId, "WRONG_FUNDER", "only the spec funder may lock the bounty");
    const amountGate = assertAmount(amount, "amount");
    if (!amountGate.ok) return amountGate;
    if (BigInt(amount) !== BigInt(e.spec.amount)) {
      return refused(escrowId, "AMOUNT_MISMATCH", `the escrow locks exactly ${e.spec.amount}; partial escrows are not escrows`);
    }
    e.state = "FUNDED";
    e.timeline.push({ at: Number(clock()), from: "OPEN", to: "FUNDED" });
    metrics.fundedCount += 1;
    record(escrowId, "OPEN", "FUNDED");
    return { ok: true, state: "FUNDED", escrowId, metrics: snapshotMetrics() };
  }

  function claim({ escrowId, contributor } = {}) {
    const e = getEscrow(escrowId);
    if (!e) return refused(escrowId, "NO_ESCROW", "no escrow holds this id");
    if (e.contributor !== null) {
      return refused(escrowId, "CONTRIBUTOR_LOCKED", "the claim is single-shot; the contributor was locked at claim time");
    }
    if (e.state !== "FUNDED") return refused(escrowId, "NOT_FUNDED", `escrow is ${e.state}; a claim needs locked funds`);
    const gate = assertAddress(contributor, "contributor");
    if (!gate.ok) return gate;
    e.contributor = contributor;
    e.state = "CLAIMED";
    e.timeline.push({ at: Number(clock()), from: "FUNDED", to: "CLAIMED" });
    record(escrowId, "FUNDED", "CLAIMED");
    return { ok: true, state: "CLAIMED", escrowId, contributor, metrics: snapshotMetrics() };
  }

  function deliver({ escrowId, contributor, evidenceDigest } = {}) {
    const e = getEscrow(escrowId);
    if (!e) return refused(escrowId, "NO_ESCROW", "no escrow holds this id");
    if (e.evidenceDigest !== null) {
      return refused(escrowId, "EVIDENCE_LOCKED", "the evidence digest froze at first delivery - re-delivery would be a tamper surface");
    }
    if (e.contributor !== null && contributor !== e.contributor) {
      return refused(escrowId, "WRONG_CONTRIBUTOR", "delivery is bound to the claimed contributor");
    }
    if (e.state !== "CLAIMED") return refused(escrowId, "NOT_CLAIMED", `escrow is ${e.state}; delivery needs a locked claim`);
    if (typeof evidenceDigest !== "string" || !DIGEST_RE.test(evidenceDigest)) {
      return fail("evidenceDigest", "INVALID_DIGEST", "expected a 64-hex sha256 digest of the delivered work's canonical record");
    }
    e.evidenceDigest = evidenceDigest;
    e.state = "DELIVERED";
    e.timeline.push({ at: Number(clock()), from: "CLAIMED", to: "DELIVERED" });
    record(escrowId, "CLAIMED", "DELIVERED");
    return { ok: true, state: "DELIVERED", escrowId, evidenceDigest, metrics: snapshotMetrics() };
  }

  function verify({ escrowId, signature } = {}) {
    const e = getEscrow(escrowId);
    if (!e) return refused(escrowId, "NO_ESCROW", "no escrow holds this id");
    if (e.state !== "DELIVERED") return refused(escrowId, "NOT_DELIVERED", `escrow is ${e.state}; verification needs delivered evidence`);
    if (typeof maintainerSecret !== "string" || maintainerSecret.length === 0) {
      return refused(escrowId, "NO_MAINTAINER_SECRET", "fail-closed: without an injected maintainer secret nothing can ever reach VERIFIED");
    }
    const valid = evidenceSignatureValid({
      secret: maintainerSecret,
      escrowId: e.escrowId,
      evidenceDigest: e.evidenceDigest,
      contributor: e.contributor,
      amount: e.spec.amount,
      signature,
    });
    if (!valid) {
      return refused(escrowId, "BAD_EVIDENCE_SIGNATURE", "the signature does not cover THIS escrow's stored digest, contributor and amount - evidence stays escrowed");
    }
    e.state = "VERIFIED";
    e.timeline.push({ at: Number(clock()), from: "DELIVERED", to: "VERIFIED" });
    metrics.verifiedCount += 1;
    record(escrowId, "DELIVERED", "VERIFIED");
    return { ok: true, state: "VERIFIED", escrowId, metrics: snapshotMetrics() };
  }

  function release({ escrowId } = {}) {
    const e = getEscrow(escrowId);
    if (!e) return refused(escrowId, "NO_ESCROW", "no escrow holds this id");
    if (e.state === "RELEASED") return refused(escrowId, "ALREADY_RELEASED", "release is single-spend - the escrow paid once");
    if (e.state === "REFUNDED") return refused(escrowId, "REFUNDED_ALREADY", "the escrow was refunded whole; nothing is left to release");
    if (e.state !== "VERIFIED") {
      return refused(escrowId, "NOT_VERIFIED", `escrow is ${e.state} - unverified evidence stays escrowed`);
    }
    if (mode === "LIVE") {
      let paid;
      try {
        paid = payer.pay({ to: e.contributor, amount: e.spec.amount, escrowId: e.escrowId });
      } catch (error) {
        return refused(escrowId, "PAYER_THREW", error && error.message ? String(error.message) : "payer threw");
      }
      if (!paid || typeof paid.paymentRef !== "string" || paid.paymentRef.length === 0) {
        return refused(escrowId, "NO_PAYMENT_REF", "a payer that cannot name a payment has not paid - the escrow stays VERIFIED");
      }
      e.paymentRef = paid.paymentRef;
      releasedSum += BigInt(e.spec.amount);
      metrics.releasedCount += 1;
    }
    e.state = "RELEASED";
    e.timeline.push({ at: Number(clock()), from: "VERIFIED", to: "RELEASED" });
    record(escrowId, "VERIFIED", "RELEASED");
    return { ok: true, state: "RELEASED", escrowId, to: e.contributor, paymentRef: e.paymentRef ?? null, metrics: snapshotMetrics() };
  }

  function refund({ escrowId, reason } = {}) {
    const e = getEscrow(escrowId);
    if (!e) return refused(escrowId, "NO_ESCROW", "no escrow holds this id");
    if (e.state === "REFUNDED") return refused(escrowId, "ALREADY_REFUNDED", "refund is single-spend - the funder was made whole once");
    if (e.state === "RELEASED") return refused(escrowId, "ALREADY_RELEASED", "the escrow paid out; a refund after release would be a double spend");
    if (e.state === "OPEN") return refused(escrowId, "NOTHING_FUNDED", "an unfunded escrow holds nothing to refund");
    if (reason !== undefined && typeof reason !== "string") {
      return fail("reason", "INVALID_REASON", "refund reason must be a string when given");
    }
    if (mode === "LIVE") {
      let paid;
      try {
        paid = payer.payFunder({ to: e.spec.funder, amount: e.spec.amount, escrowId: e.escrowId });
      } catch (error) {
        return refused(escrowId, "PAYER_THREW", error && error.message ? String(error.message) : "payer threw");
      }
      if (!paid || typeof paid.paymentRef !== "string" || paid.paymentRef.length === 0) {
        return refused(escrowId, "NO_PAYMENT_REF", "a payer that cannot name a payment has not paid - the escrow stays where it was");
      }
      e.refundRef = paid.paymentRef;
      refundedSum += BigInt(e.spec.amount);
      metrics.refundedCount += 1;
    }
    const from = e.state;
    e.state = "REFUNDED";
    e.timeline.push({ at: Number(clock()), from, to: "REFUNDED" });
    record(escrowId, from, "REFUNDED", reason === undefined ? {} : { reason });
    return { ok: true, state: "REFUNDED", escrowId, to: e.spec.funder, full: true, paymentRef: e.refundRef ?? null, metrics: snapshotMetrics() };
  }

  return Object.freeze({
    version: ESCROW_VERSION,
    mode,
    open,
    fund,
    claim,
    deliver,
    verify,
    release,
    refund,
    escrow: (escrowId) => {
      const e = getEscrow(escrowId);
      if (!e) return null;
      return Object.freeze(JSON.parse(JSON.stringify({ ...e, metrics: undefined })));
    },
    events: () => log.map((entry) => ({ ...entry })),
    metrics: snapshotMetrics,
  });
}

export function selfCheck() {
  const FUNDER = "G" + "A".repeat(55);
  const MAINTAINER = "G" + "B".repeat(55);
  const CONTRIBUTOR = "G" + "C".repeat(55);
  const SECRET = "selfcheck-secret-not-a-real-key";
  const AMOUNT = "2500000000";
  const DIGEST = "ab".repeat(32);
  const cases = [];

  // ids: deterministic, spec-derived
  const spec = { bountyId: "CG-BTY-007", funder: FUNDER, maintainer: MAINTAINER, amount: AMOUNT };
  cases.push(["the spec id is deterministic", escrowIdFor(spec) === escrowIdFor({ ...spec })]);
  cases.push(["a different bounty yields a different id", escrowIdFor(spec) !== escrowIdFor({ ...spec, bountyId: "CG-BTY-005" })]);

  // input validation, fail-closed
  const h = createBountyEscrow({ maintainerSecret: SECRET, clock: () => 1750000000 });
  const badAmount = h.open({ bountyId: "CG-BTY-007", funder: FUNDER, maintainer: MAINTAINER, amount: "12.5" });
  cases.push(["a non-canonical amount is refused", badAmount.ok === false && badAmount.code === "INVALID_AMOUNT"]);
  const numberAmount = h.open({ bountyId: "CG-BTY-007", funder: FUNDER, maintainer: MAINTAINER, amount: 2500000000 });
  cases.push(["a number is not an amount", numberAmount.ok === false && numberAmount.code === "INVALID_AMOUNT"]);
  const badAddress = h.open({ bountyId: "CG-BTY-007", funder: "G" + "A".repeat(50), maintainer: MAINTAINER, amount: AMOUNT });
  cases.push(["a short address is refused", badAddress.ok === false && badAddress.code === "INVALID_ADDRESS"]);
  const opened = h.open({ bountyId: "CG-BTY-007", funder: FUNDER, maintainer: MAINTAINER, amount: AMOUNT });
  cases.push(["a well-formed escrow opens with a 64-hex id", opened.ok === true && /^[0-9a-f]{64}$/.test(opened.escrowId)]);
  const dup = h.open({ bountyId: "CG-BTY-007", funder: FUNDER, maintainer: MAINTAINER, amount: AMOUNT });
  cases.push(["a second escrow for one bounty is refused", dup.ok === false && dup.code === "BOUNTY_ALREADY_ESCROWED"]);

  // funding discipline
  const under = h.fund({ escrowId: opened.escrowId, funder: FUNDER, amount: "1000000000" });
  cases.push(["a partial fund is refused", under.ok === false && under.code === "AMOUNT_MISMATCH"]);
  const stranger = h.fund({ escrowId: opened.escrowId, funder: MAINTAINER, amount: AMOUNT });
  cases.push(["only the spec funder may lock the bounty", stranger.ok === false && stranger.code === "WRONG_FUNDER"]);
  const funded = h.fund({ escrowId: opened.escrowId, funder: FUNDER, amount: AMOUNT });
  cases.push(["the exact amount locks the escrow", funded.ok === true && funded.state === "FUNDED"]);
  const refunder = createBountyEscrow({ maintainerSecret: SECRET, clock: () => 1750000000 });
  const unfunded = refunder.open({ bountyId: "CG-BTY-005", funder: FUNDER, maintainer: MAINTAINER, amount: AMOUNT });
  cases.push(["an unfunded escrow holds nothing to refund", refunder.refund({ escrowId: unfunded.escrowId, reason: "early" }).ok === false && refunder.metrics().refundedCount === 0]);

  // claim + deliver discipline
  const earlyClaim = createBountyEscrow({ maintainerSecret: SECRET, clock: () => 1750000000 });
  const openOnly = earlyClaim.open({ bountyId: "CG-BTY-007", funder: FUNDER, maintainer: MAINTAINER, amount: AMOUNT });
  cases.push(["a claim on an unfunded escrow is refused", earlyClaim.claim({ escrowId: openOnly.escrowId, contributor: CONTRIBUTOR }).ok === false]);
  const claimed = h.claim({ escrowId: opened.escrowId, contributor: CONTRIBUTOR });
  cases.push(["the claimed contributor is recorded", claimed.ok === true && claimed.state === "CLAIMED"]);
  const reClaim = h.claim({ escrowId: opened.escrowId, contributor: FUNDER });
  cases.push(["the claim is single-shot", reClaim.ok === false && reClaim.code === "CONTRIBUTOR_LOCKED"]);
  const wrongDeliver = h.deliver({ escrowId: opened.escrowId, contributor: MAINTAINER, evidenceDigest: DIGEST });
  cases.push(["delivery by anyone but the claimed contributor is refused", wrongDeliver.ok === false && wrongDeliver.code === "WRONG_CONTRIBUTOR"]);
  const delivered = h.deliver({ escrowId: opened.escrowId, contributor: CONTRIBUTOR, evidenceDigest: DIGEST });
  cases.push(["the claimed contributor delivers a 64-hex digest", delivered.ok === true && delivered.state === "DELIVERED"]);

  // verify discipline: fail-closed without the secret, bound to the digest
  const unsigned = createBountyEscrow({ clock: () => 1750000000 });
  const uOpen = unsigned.open({ bountyId: "CG-BTY-007", funder: FUNDER, maintainer: MAINTAINER, amount: AMOUNT });
  unsigned.fund({ escrowId: uOpen.escrowId, funder: FUNDER, amount: AMOUNT });
  unsigned.claim({ escrowId: uOpen.escrowId, contributor: CONTRIBUTOR });
  unsigned.deliver({ escrowId: uOpen.escrowId, contributor: CONTRIBUTOR, evidenceDigest: DIGEST });
  const uVerify = unsigned.verify({ escrowId: uOpen.escrowId, signature: signEvidence({ secret: SECRET, escrowId: uOpen.escrowId, evidenceDigest: DIGEST, contributor: CONTRIBUTOR, amount: AMOUNT }) });
  cases.push(["without an injected maintainer secret nothing reaches VERIFIED", uVerify.ok === false && uVerify.code === "NO_MAINTAINER_SECRET"]);
  const forged = h.verify({ escrowId: opened.escrowId, signature: "0".repeat(64) });
  cases.push(["a forged signature is refused", forged.ok === false && forged.code === "BAD_EVIDENCE_SIGNATURE"]);

  // rule 1: unverified evidence stays escrowed
  const earlyRelease = h.release({ escrowId: opened.escrowId });
  cases.push(["release before verify is REFUSED and evidence stays escrowed", earlyRelease.ok === false && earlyRelease.code === "NOT_VERIFIED" && h.escrow(opened.escrowId).state === "DELIVERED"]);
  cases.push(["the refused release moved nothing", h.metrics().releasedCount === 0 && h.metrics().releasedAmount === "0"]);

  // the honest release
  const sig = signEvidence({ secret: SECRET, escrowId: opened.escrowId, evidenceDigest: DIGEST, contributor: CONTRIBUTOR, amount: AMOUNT });
  const verified = h.verify({ escrowId: opened.escrowId, signature: sig });
  cases.push(["the maintainer's signature over the stored digest verifies", verified.ok === true && verified.state === "VERIFIED"]);
  const released = h.release({ escrowId: opened.escrowId });
  cases.push(["a verified escrow releases to the claimed contributor", released.ok === true && released.state === "RELEASED" && released.to === CONTRIBUTOR]);
  const again = h.release({ escrowId: opened.escrowId });
  cases.push(["release is single-spend", again.ok === false && again.code === "ALREADY_RELEASED"]);
  cases.push(["DRY_RUN moves no funds - releasedAmount stays 0", h.metrics().releasedAmount === "0" && h.metrics().releasedCount === 0]);

  // rule 2: a signature is bound to the escrow's OWN digest (same spec, same id)
  const twin = createBountyEscrow({ maintainerSecret: SECRET, clock: () => 1750000000 });
  const tOpen = twin.open({ bountyId: "CG-BTY-007", funder: FUNDER, maintainer: MAINTAINER, amount: AMOUNT });
  cases.push(["two ledgers holding the same terms hold the same id", tOpen.escrowId === opened.escrowId]);
  twin.fund({ escrowId: tOpen.escrowId, funder: FUNDER, amount: AMOUNT });
  twin.claim({ escrowId: tOpen.escrowId, contributor: CONTRIBUTOR });
  const tampered = "cd".repeat(32);
  twin.deliver({ escrowId: tOpen.escrowId, contributor: CONTRIBUTOR, evidenceDigest: tampered });
  const swapped = twin.verify({ escrowId: tOpen.escrowId, signature: sig });
  cases.push(["a signature over one digest never verifies a swapped one", swapped.ok === false && swapped.code === "BAD_EVIDENCE_SIGNATURE" && twin.escrow(tOpen.escrowId).state === "DELIVERED"]);

  // rule 5: refund full, then nothing further moves
  const r = createBountyEscrow({ maintainerSecret: SECRET, clock: () => 1750000000 });
  const rOpen = r.open({ bountyId: "CG-BTY-007", funder: FUNDER, maintainer: MAINTAINER, amount: AMOUNT });
  r.fund({ escrowId: rOpen.escrowId, funder: FUNDER, amount: AMOUNT });
  r.claim({ escrowId: rOpen.escrowId, contributor: CONTRIBUTOR });
  r.deliver({ escrowId: rOpen.escrowId, contributor: CONTRIBUTOR, evidenceDigest: DIGEST });
  const refunded = r.refund({ escrowId: rOpen.escrowId, reason: "no approved bounty funding exists" });
  cases.push(["refund returns the FULL amount to the funder", refunded.ok === true && refunded.state === "REFUNDED" && refunded.to === FUNDER && refunded.full === true]);
  const afterRefund = r.verify({ escrowId: rOpen.escrowId, signature: signEvidence({ secret: SECRET, escrowId: rOpen.escrowId, evidenceDigest: DIGEST, contributor: CONTRIBUTOR, amount: AMOUNT }) });
  cases.push(["after a refund nothing further can be verified", afterRefund.ok === false]);
  const afterRefundRelease = r.release({ escrowId: rOpen.escrowId });
  cases.push(["after a refund nothing can be released", afterRefundRelease.ok === false && afterRefundRelease.code === "REFUNDED_ALREADY"]);
  const doubleRefund = r.refund({ escrowId: rOpen.escrowId });
  cases.push(["refund is single-spend", doubleRefund.ok === false && doubleRefund.code === "ALREADY_REFUNDED"]);

  // LIVE discipline: the payer adapter is the only funds movement, and it must name its payment
  const livePaid = [];
  const live = createBountyEscrow({
    maintainerSecret: SECRET,
    clock: () => 1750000000,
    mode: "LIVE",
    payer: { pay: ({ to }) => { livePaid.push(to); return { paymentRef: "PAY-1" }; }, payFunder: () => ({ paymentRef: "REFUND-1" }) },
  });
  const lOpen = live.open({ bountyId: "CG-BTY-007", funder: FUNDER, maintainer: MAINTAINER, amount: AMOUNT });
  live.fund({ escrowId: lOpen.escrowId, funder: FUNDER, amount: AMOUNT });
  live.claim({ escrowId: lOpen.escrowId, contributor: CONTRIBUTOR });
  live.deliver({ escrowId: lOpen.escrowId, contributor: CONTRIBUTOR, evidenceDigest: DIGEST });
  live.verify({ escrowId: lOpen.escrowId, signature: signEvidence({ secret: SECRET, escrowId: lOpen.escrowId, evidenceDigest: DIGEST, contributor: CONTRIBUTOR, amount: AMOUNT }) });
  const lReleased = live.release({ escrowId: lOpen.escrowId });
  cases.push(["a LIVE payer that confirms is recorded once", lReleased.ok === true && live.metrics().releasedCount === 1 && live.metrics().releasedAmount === AMOUNT && livePaid.length === 1]);
  const blind = createBountyEscrow({
    maintainerSecret: SECRET,
    clock: () => 1750000000,
    mode: "LIVE",
    payer: { pay: () => ({}), payFunder: () => ({ paymentRef: "REFUND-1" }) },
  });
  const bOpen = blind.open({ bountyId: "CG-BTY-007", funder: FUNDER, maintainer: MAINTAINER, amount: AMOUNT });
  blind.fund({ escrowId: bOpen.escrowId, funder: FUNDER, amount: AMOUNT });
  blind.claim({ escrowId: bOpen.escrowId, contributor: CONTRIBUTOR });
  blind.deliver({ escrowId: bOpen.escrowId, contributor: CONTRIBUTOR, evidenceDigest: DIGEST });
  blind.verify({ escrowId: bOpen.escrowId, signature: signEvidence({ secret: SECRET, escrowId: bOpen.escrowId, evidenceDigest: DIGEST, contributor: CONTRIBUTOR, amount: AMOUNT }) });
  const bReleased = blind.release({ escrowId: bOpen.escrowId });
  cases.push(["a payer that names no payment has not paid - the escrow stays VERIFIED", bReleased.ok === false && bReleased.code === "NO_PAYMENT_REF" && blind.escrow(bOpen.escrowId).state === "VERIFIED"]);

  const ok = cases.every(([, pass]) => pass);
  return { ok, cases };
}

function main() {
  const args = process.argv.slice(2);
  if (args.includes("--self-check") || args.length === 0) {
    const result = selfCheck();
    console.log(`BOUNTY-ESCROW - ${ESCROW_VERSION} (mirror of CG-BTY-007 / #55; DRY_RUN, no key, no chain call, no funds moved)`);
    for (const [label, pass] of result.cases) console.log(`  ${pass ? "PASS" : "FAIL"}  ${label}`);
    const m = createBountyEscrow().metrics();
    console.log(`  metrics: escrows ${m.escrows} · funded ${m.fundedCount} · verified ${m.verifiedCount} · released ${m.releasedCount} · releasedAmount ${m.releasedAmount}`);
    console.log(`\nBOUNTY-ESCROW SELF-CHECK: ${result.ok ? "PASS" : "FAIL"}`);
    if (!result.ok) process.exitCode = 1;
    return;
  }
  if (args.includes("--status")) {
    console.log(`BOUNTY-ESCROW ${ESCROW_VERSION} - JS mirror of the Soroban escrow lifecycle (CG-BTY-007 / #55)`);
    console.log("  on-chain deploy: NOT PERFORMED - blocked on external human review + owner broadcast sign-off");
    console.log("  funds moved: 0 - the mirror transitions state; a payer adapter (LIVE mode) is the only movement surface");
    return;
  }
  console.log("usage: node packages/bounty-escrow/index.mjs --self-check | --status");
  process.exitCode = 2;
}

if (process.argv[1] && process.argv[1].endsWith("index.mjs")) main();

# Final Report — Closing the Authorized-Lane Delivery: Rehearsal Passed, Mainnet Refusal Now Carries Its CODED Root Cause

**Final status:** the authorized-lane delivery cycle closes at commit `f2d921f9748259b01e650e797bd6a42ab056eb07` — the testnet rehearsal passed end-to-end; the mainnet run correctly refused at the upload step (exit 5) under full owner authorization; and on **2026-11-10** the refusal was DECODED from its own committed bytes (`stellar-sdk` schema enum, no hand-built tables) to `txInsufficientBalance` (-7) — deterministic, not transient — and the runner was upgraded so the same failure now refuses locally BEFORE any submission. The full suite is green at **1472 / 1472**.

## Cycle summary

1. **Phase 2 — Testnet rehearsal PASSED:** the owner-authorized lane was exercised on testnet (`--rehearse`): upload INVOKED, createCustomContract INVOKED, `commit_authorized` INVOKED, readback SIMULATED_SOME, replay INVOKED (IDEMPOTENT), wrong-owner REFUSED, hash-mismatch REFUSED. The artifact `docs/evidence/stellar-soroban-authorized-deploy-testnet.json` recorded `summary.deployed = false`; laneWrites `REHEARSED_ON_TESTNET`; invariants all ok; idempotency ledgerSeq 5643172.

2. **Phase 3 — Mainnet run under full owner authorization (final execution):** the gate command was re-run after the funded balance passed the preflight (native **3.5069800 XLM** ≥ 2 XLM) → the `upload(wasm)` step was **REJECTED** (`errorResultXdr` `AAAAAAfMyDb////5AAAAAA==`) → **exit 5**. The deploy did not land (no create was attempted; `contractId` null; `summary.deployed = false`). No transaction was broadcast; the fail-closed posture held.

3. **2026-11-10 — the refusal decoded from the artifact's OWN bytes (fresh-clone-reproducible):**

   | Fact | Value |
   |---|---|
   | Result code | **`txInsufficientBalance` (-7)** — "fee would gobble minimum balance" (the ledger's own verdict, embedded in the committed bytes; never a `txBadSeq`/`txBadAuth` arm — the same canonical enum re-binds the rehearsal's 2026-11-08 blob to `-5/txBadSeq` at feeCharged 40674, fact-checking the runner's own resume-path comment) |
   | Charged fee (simulation-priced) | **130,861,110 stroops = 13.0861110 XLM** |
   | Composition | requested inclusion bid **1,000,000** + WASM-upload resource fee **129,861,110** (artifact-arithmetic-bound: 130,861,110 − 1,000,000 = 129,861,110) |
   | Funded balance at run time | **35,069,800 stroops = 3.5069800 XLM** (preflight floor ≥ 2 XLM passed — the fee requirement is a DIFFERENT, larger gate) |
   | Verdict | the fee cannot be paid (balance-after-fee would fall below minimum balance) → network refuses BEFORE any effect. Deterministic: re-running with the same balance rejects identically |
   | EXACT remedy | fund the deployer to ≥ **145,861,110 stroops = 14.5861110 XLM** (= priced fee 130,861,110 + the account's EXACT minimum balance 3 × 5,000,000 — the account carries one USDC trustline from the signed swap cycle, so `subentry_count` 1 raises the ledger minimum to 1.5 XLM). **Recommended funding: 16 XLM.** A lower `--fee` cannot fix this: the resource fee is priced by the network's own simulation |

4. **2026-11-10 — runner upgrades (`scripts/stellar-soroban-authorized-deploy.mjs`), every piece test-bonded (17 → 21 tests, all applied-and-bite):**

   - **Pre-send fee-solvency gate:** after `prepareTransaction` finalizes the declared fee, the gate compares the deposit account's score BEFORE ANY `sendTransaction` — a short account returns `REJECTED` with `rejectFace: PRE_SEND_SOLVENCY` and the exact arithmetic (`shortfallStroops`, the funded minimum). Zero submissions burned on a deterministically refundable failure.
   - **Per-account exact minimum:** read live from the wire (`subentry_count`); the single-entry constant (2 × 5,000,000) stays as the documented LOWER bound; sponsored shapes are not re-derived (the ledger keeps the final word).
   - **Artifacts self-decode rejections:** every future `errorResultXdr` in the artifact carries `resultCode` (canonical name), `resultCodeNumeric`, and `feeCharged` — the `resultCode: null` hole of the committed artifact can never return.
   - **Solvency evidence travels in the artifact:** `deployerBalanceStroops` / `minBalanceReserveStroops` / `minBalanceReserveFace` (`EXACT_PER_ACCOUNT` | `DOCUMENTED_LOWER_BOUND`).
   - **Verdict honesty fix:** `finalizeVerdict` no longer stamps the full `EXECUTED — VERIFIED` verdict over `REJECTED`/`FAILED`/`TIMEOUT` steps — the committed artifact itself measured this class: its steps read REJECTED with `deployed: false` under a VERIFIED summary line. A failed step always downgrades to `NOT_CONFIRMED` hereafter.
   - **Exact money math:** `xlmStringToStroops` never truncates beyond the ledger's own 7-digit precision and refuses non-string inputs.

## Measured final state (commit `f2d921f` facts; suite total as of the 2026-11-10 push — snapshot `docs/state-snapshot.json`)

| Surface | Value |
|---|---|
| Test suite | **1472 / 1472 pass** — pinned in snapshot, enforced by runner (+4 measured 2026-11-10 → 1472; the 2026-11-09 facts above were measured at 1468) |
| Boundary audit | **1077 files · 0 violations** |
| Docs-node contract | **120 executed · 79 skip-listed · 25 docs covered** |
| Claims audit (CG-CL/1) | **PASS** |

## Authorized lane proof

- Cross-language known-answer vector holds byte-certainly: SHA-256 over `utf8(domain) ++ utf8(strkey) ++ hash32` equals `0xb5f9655d4c0b4292ed0be7cd87b68e71297c1bf94667a9657ce3b6f6cbec6f30`.
- Commitment hash aligned to the byte-certain value; owner identifier aligned to a genuine issuer strkey; authorization mocking corrected.

## Remaining owner actions (the only blockers left)

1. **Approve PR #11** (state REVIEW_REQUIRED — merge requires the review; no bypass exists or is planned).
2. **Fund the deployer wallet** (`GDJ3CRNLNDZ4AVWGPUG7DBC5BIAGMIONOONZGB5FSYAY44ZHOIPRKY7U`) to **≥ 14.5861110 XLM — 16 XLM recommended** (priced fee + per-account minimum balance, measured 2026-11-10; the account currently holds 3.5069800 XLM).
3. **Re-run Phase 3 with the SAME command** once the funding lands — the NOW-upgraded runner pre-checks solvency and refuses locally with the exact arithmetic if the deposit is still short, and otherwise proceeds to upload → create → readback:
   `node scripts/stellar-soroban-authorized-deploy.mjs --network mainnet --owner-authorized --wasm-path .tmp-artifact/cg_commitment_anchor.wasm --wasm-manifest docs/evidence/stellar-soroban-wasm-manifest-42519059778.json --fee 1000000`
4. **Phase 5 (post-deploy evidence)** — executes automatically as the follow-up cycle once the deploy lands.

## Unclosed owner-gated boundaries

- No mainnet signing, broadcast, or new deployment beyond the recorded decision marker (Phase 3 ran under the recorded authorization and was refused BY THE NETWORK at the upload step — a priced fee, not a bypass, and now locally pre-checked).
- The owner wallet held 1.5069800 XLM at the first preflight and 3.5069800 XLM at the final execution; the ≥ 2 XLM policy floor was satisfied while the fee-solvency requirement (14.5861110 XLM for this account) was not — the two gates are different and both are now coded and enforced.

## As-landed honesty note

> Every value in this report is a dated fact: the rehearsal, refusal, and artifact composition were measured on `f2d921f9748259b01e650e797bd6a42ab056eb07` (2026-11-09, suite total 1468 at that moment); the decode, solvency gate, exact per-account minimum, and suite total 1472 are the 2026-11-10 push's measured truths (snapshot re-pinned in the SAME push). The live value of every number at any later moment is always `docs/STATUS.md` + `docs/state-snapshot.json` (CI-bonded). This file's Arabic original `docs/FINAL-REPORT-2026-11-09-ar.md` carries the same facts fact-for-fact.

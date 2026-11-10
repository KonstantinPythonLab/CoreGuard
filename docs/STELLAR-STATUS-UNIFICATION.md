# P0 — Unifying the Stellar status (2026-11-10)

**The defect, in one paragraph.** `docs/EVIDENCE-MATRIX.md` recorded Stellar
mainnet executions as `MAINNET VERIFIED`, while `packages/stellar/README.md`
opened with `DRY_RUN / NOT_BUILT`, `packages/stellar/index.mjs` returned
`integrationStatus: NOT_BUILT`, and `packages/stellar/dex-gating.mjs` produced
`PLAN_ONLY` plans it never sends. An external reviewer read both and drew the
only reasonable conclusion available to a reader: the repo contradicts itself
about what it has.

Both statements were true. They answer different questions:

- **"Did a call happen?"** Yes — a signed `commit(proofId, commitment)` reached
  Stellar mainnet at ledger 65,337,373, and a funded `pathPaymentStrictSend`
  settled at ledger 65,338,112, both with committed artifacts a third party
  re-derives offline.
- **"Can a customer adopt the integration?"** No — the adapter deliberately has
  no signer, no submission path, and no external consumer. `status()` was right
  and remains right.

The failure was **representation**, not fabrication. A single word per row let
two true statements be averaged into one false one.

## The fix: three axes, one registry

`docs/surface-status.json` is now the single machine-readable record. Every
surface carries:

| Axis | Meaning | Values |
|---|---|---|
| `code` | Does it exist in the committed tree? | `BUILT` · `BUILT_UNVERIFIED` · `PLAN_ONLY` · `NOT_BUILT` |
| `execution` | Was it run, with an artifact that proves it? | `EXECUTED` · `REAL_BOOK_EXECUTED` · `POLICY_GATE_EXECUTED` · `TEST_EXECUTED` · `NONE` |
| `integration` | Can an outside project adopt it today? | `ADOPTED` · `PILOT` · `NOT_BUILT` |

Old label → new statement:

| Old combined label | What it actually meant | Now written as |
|---|---|---|
| `MAINNET VERIFIED` | a script we wrote sent a call and an artifact proves it | `execution: EXECUTED` + `integration: NOT_BUILT` |
| `MAINNET DEPLOYED` | a contract exists on mainnet | `execution: EXECUTED` + `integration: NOT_BUILT` |
| `TESTNET VERIFIED` | the contract behaved on testnet | `execution: EXECUTED` (testnet) + `integration: NOT_BUILT` |
| `PRODUCTION ADOPTED` | *(never true)* | removed; requires a named external party |
| `POLICY-GATE EXECUTED` | a verdict matrix was computed offline | `execution: POLICY_GATE_EXECUTED` + `integration: NOT_BUILT` |

## What makes the fix structural, not editorial

1. **The registry is the authority.** `docs/surface-status.json` names a path
   for every surface; the guard fails if a named path stops existing, so the
   registry cannot rot into a list of phantoms.
2. **Code and docs are compared mechanically.** `test/ci/surface-status.test.js`
   imports `status()` from `packages/stellar/index.mjs` and from
   `packages/agent-gate/index.mjs` and asserts their `integrationStatus` equals
   the registry. The contradiction cannot be reintroduced quietly.
3. **The matrix cannot carry a combined label.** The guard rejects
   `MAINNET VERIFIED`, `MAINNET DEPLOYED`, `TESTNET VERIFIED`,
   `PRODUCTION ADOPTED`, `ENTERPRISE READY`, `PRODUCTION READY` anywhere in
   `docs/EVIDENCE-MATRIX.md`, and requires every row to state all three axes
   plus an evidence cell.
4. **Adoption is impossible to claim by accident.** A surface marked `ADOPTED`
   or `PILOT` must name an external party and cite committed evidence; today
   the guard also asserts that the set of non-`NOT_BUILT` surfaces is **empty**,
   so shipping an adopter is a deliberate change to that assertion.
5. **The controls prove the guard bites.** Synthetic relapsed labels and a
   3-column row are fed to the detectors in the same file; if the detectors go
   blind, the controls fail.

## The claim this unlocks

Instead of "we are a verified Stellar integration" the repo can now say, and
have machine-checked:

> CoreGuard produces execution evidence on Stellar mainnet that a third party
> re-derives offline, and it has no external adopter yet. The gate that would
> make it adoptable — an agent mandate check plus envelope conformance — is
> built and tested offline (`packages/agent-gate`), with wallet signing and a
> pilot explicitly `NOT_BUILT`.

That is a weaker sentence than the old matrix implied and a much stronger one
to defend in front of a reviewer who opens both files.

## What is still missing (and is not hidden here)

| Gap | Axis it blocks | Status |
|---|---|---|
| A signer a wallet controls (Freighter) | integration | NOT_BUILT — no browser wallet in CI, no credential path |
| A real external pilot | integration | NOT_BUILT — 0 named partners running it |
| Independent security audit | trust | NOT_PERFORMED — no auditor has signed anything |
| Measured latency/cost under load | evidence quality | NOT_MEASURED — no published benchmark for the gate itself |

Each row above is an input to `docs/ROADMAP-90-DAYS-2026-11.md`, not a caveat
tacked onto a claim.

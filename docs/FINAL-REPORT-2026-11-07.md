# Final Report — CoreGuard Hardening Batch — 2026-11-07

**Final status:** the three-gate hardening batch is closed, proven, and green on its final commit `ea7e154d0db8dff3555f101bd6374cac7db98703`.

## Batch summary

The owner mandated three hardening reviews:

1. **Soroban contract authorization gap:** the permissionless-lane identity hole was closed with an additive, fail-closed authorized lane (`commit_authorized`, `derive_authorized_id`, `assert_anchored_authorized`) in `soroban/commitment-anchor`.
2. **Execution-proof vs security-approval separation:** the claim taxonomy (`docs/CLAIMS-TAXONOMY.md`) now binds the two concepts without conflating them.
3. **Docs test-count unification:** the measured total (`docs/state-snapshot.json` → `testsTotal`) is now the single source of truth, enforced by `test/ci/doc-numbers.test.js`, surfaced via badge `ci-1451-tests.svg`, and re-pinned in `docs/STATUS.md`.

## Measured final state (final SHA `ea7e154d…`)

| Surface | Value |
|---|---|
| Test suite | **1451 / 1451 pass** — pinned in snapshot, enforced by runner |
| Boundary audit | **1050 files · 0 violations** |
| Docs-node contract | **120 executed · 75 skip-listed · 25 docs covered** |
| CI run `42413913560` | **ALL green** — incl. `Soroban contract (Rust tests)` → **success** |
| Pages | **built** on the final SHA |
| Post-push current-state check | **CHECK OK** at `ea7e154d` |

## Authorized lane proof

- Cross-language known-answer vector holds byte-certainly: SHA-256 over `utf8(domain) ++ utf8(strkey) ++ hash32` equals `0xb5f9655d4c0b4292ed0be7cd87b68e71297c1bf94667a9657ce3b6f6cbec6f30`.
- Commitment hash aligned to the byte-certain value; owner identifier aligned to a genuine issuer strkey; authorization mocking corrected.

## Unclosed owner-gated boundaries

- No mainnet signing, broadcast, or new authorization without owner decision.
- No new deployment of the authorized lane.
- npm publish remains double-gated pending token; SCF interest, payments, and pricing stay owner-gated at zero.

## As-landed honesty note

> Every value in this report is a dated fact measured on the tree of `ea7e154d0db8dff3555f101bd6374cac7db98703` exactly as written. When the report itself lands (this file plus its Arabic original `docs/FINAL-REPORT-2026-11-07-ar.md`), the two files join the committed tree and the boundary-audit count moves up by those two; the live value of every number at any later moment is always `docs/STATUS.md` + `docs/state-snapshot.json` (CI-bonded), and the values above stay as measured on 2026-11-07.

# Final Report — CoreGuard Authorized-Lane Delivery Cycle — 2026-11-09

**Final status:** the authorized-lane delivery cycle closes at commit `a6f30766b2365dd2f45beca8557261d9d9fe6622` — the testnet rehearsal passed end-to-end and the mainnet gate correctly refused at the balance floor; the full suite is green at **1468 / 1468**.

## Cycle summary

1. **Phase 2 — Testnet rehearsal PASSED:** the owner-authorized lane was exercised on testnet (`--rehearse`): upload INVOKED, createCustomContract INVOKED, `commit_authorized` INVOKED, readback SIMULATED_SOME, replay INVOKED (IDEMPOTENT), wrong-owner REFUSED, hash-mismatch REFUSED. The artifact `docs/evidence/stellar-soroban-authorized-deploy-testnet.json` recorded `summary.deployed = false`; laneWrites `REHEARSED_ON_TESTNET`; invariants all ok; idempotency ledgerSeq 5643172.

2. **Phase 3 — Mainnet fail-closed:** `node scripts/stellar-soroban-authorized-deploy.mjs --network mainnet --owner-authorized --wasm-path .tmp-artifact/cg_commitment_anchor.wasm --wasm-manifest docs/evidence/stellar-soroban-wasm-manifest-42519059778.json --fee 1000000` → **BALANCE PREFLIGHT FAILED (read-only): native 1.5069800 XLM for GDJ3CRNLNDZ4AVWGPUG7DBC5BIAGMIONOONZGB5FSYAY44ZHOIPRKY7U — requires >= 2 XLM** → **exit 7**. No transaction was submitted; nothing was broadcast; the fail-closed posture held.

## Measured final state (commit `a6f3076`)

| Surface | Value |
|---|---|
| Test suite | **1468 / 1468 pass** — pinned in snapshot, enforced by runner |
| Boundary audit | **1074 files · 0 violations** |
| Docs-node contract | **120 executed · 79 skip-listed · 25 docs covered** |
| Claims audit (CG-CL/1) | **PASS** |

## Authorized lane proof

- Cross-language known-answer vector holds byte-certainly: SHA-256 over `utf8(domain) ++ utf8(strkey) ++ hash32` equals `0xb5f9655d4c0b4292ed0be7cd87b68e71297c1bf94667a9657ce3b6f6cbec6f30`.
- Commitment hash aligned to the byte-certain value; owner identifier aligned to a genuine issuer strkey; authorization mocking corrected.

## Unclosed owner-gated boundaries

- No mainnet signing, broadcast, or new deployment without owner decision (Phase 3 refused at the balance floor — a gate, not a bypass).
- The owner wallet (GDJ3CRNLNDZ4AVWGPUG7DBC5BIAGMIONOONZGB5FSYAY44ZHOIPRKY7U) held 1.5069800 XLM; the mainnet deploy gate requires >= 2 XLM. Fund to >= 2 XLM, then re-run Phase 3.

## As-landed honesty note

> Every value in this report is a dated fact measured on the tree of `a6f30766b2365dd2f45beca8557261d9d9fe6622` exactly as written. When this report lands (this file plus its Arabic original `docs/FINAL-REPORT-2026-11-09-ar.md`), the two files join the committed tree and the boundary-audit count moves up by those two; the live value of every number at any later moment is always `docs/STATUS.md` + `docs/state-snapshot.json` (CI-bonded), and the values above stay as measured on 2026-11-09.

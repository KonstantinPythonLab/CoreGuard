# Stellar Community Fund Application — SCF #46

## Project: CoreGuard Global — Verifiable execution truth for Stellar payments

> **Arabic-first honesty note · الإقرار العربي:** كل رقم في هذه الوثيقة مربوط بمعاملة أو عقد أو قطعة مُهشَّمة داخل المستودع، وكل حالة فعل صريحة (DEPLOYED / INVOKED / CONFIRMED / BUILT / SHIPPED / credential-gated). لا أرباح، لا إيرادات، لا عملاء، لا شراكات — الجهود الموثقة أدناه منفّذة فعلاً على الشبكة الرئيسية، وتحققها الذاتي متاح للجميع بدون ثقة مسبقة.

### 1. Project Overview
CoreGuard extends its verifiable execution truth layer to Stellar: intent → policy → DEX-gate → execute → wire-verified receipt, with independently re-derivable evidence for every verdict. Payment is verified BEFORE submission, replayed deterministically AFTER submission, and fails closed: UNKNOWN → HELD.

### 2. Problem Statement
- Cross-border payments lack execution verification
- Payment failures are hard to diagnose
- No independently verifiable evidence of payment conformance
- Compliance teams trust, not verify

### 3. Solution — executed on Stellar mainnet, not planned
- **Soroban commitment anchor — MAINNET DEPLOYED**: `CCKA2GYVILX7YZVSXGVIHOPNLTRBBF2SSWKBTQBIE7M67N5N2QMMXPSP` — third-party listed (stellar.expert: creator = the CoreGuard wallet, wasm hash recorded), deployment untouched.
- **Payment verification BEFORE submission — REAL-BOOK EXECUTED**: DEX-GATE/1 issued five verdicts against the live XLM/USDC mainnet order book (issuer network-discovered, depth-derived ceiling); the owner-signed swap cleared both gates first.
- **Owner-authorized execution**: the anchor commit CALL is **INVOKED** (`commit(proofId, commitment)` — tx `69044807410f65027c1227f4e525ad83f23a6cb1a2bb79790d82849c5dbc9fec`, ledger 65,337,373, exact chainId-1116 pair, on-chain read-back `{hash, seq}` exact) and the **first SIGNED FUNDED DEX swap is CONFIRMED** (`pathPaymentStrictSend` — tx `ac2a7990b3387aab96b197c0c921d57756bd25d65ad0e75b93561ded640b9097`, ledger 65,338,112, trustline ledger 65,338,111; `4.0598146 XLM → 0.6306239 USDC` = 0.1553331 USDC/XLM; destMin `0.6011661` cleared).
- **Deterministic replay AFTER submission**: five offline `--verify` re-derivation runners (CI-exercised on every push) + wire cross-check `xlm_before − xlm_after − sendAmount == fee_charged` to the stroop.
- **Fail-closed: UNKNOWN → HELD**: STELLAR-AGENT/1 AI Agent Payment Gate EXECUTED (VERIFIED / REJECTED / HELD — submission stays credential-gated, never auto-pay) + universal DApp-shield arms (2 ALLOW · 2 REQUIRE_REVIEW · 1 DENY · 1 REFUSED).

### 4. Traction — measured, committed, self-verifiable
- ✅ Soroban anchor contract **MAINNET DEPLOYED** and third-party listed (stellar.expert).
- ✅ First **owner-authorized anchor commit CALL INVOKED on mainnet** — exact chainId-1116 pair; on-chain read-back exact.
- ✅ First **SIGNED FUNDED DEX swap CONFIRMED on the live mainnet order book** — DEX-GATE/1 preflight VERIFIED (both gates) → `pathPaymentStrictSend` CONFIRMED; wire read-back equals `fee_charged` to the stroop.
- ✅ 11/11 Soroban integration tests (`test/integrations/stellar-soroban.test.mjs`).
- ✅ Full suite **1436/1436 green** over 1047 files — CI-enforced via `docs/state-snapshot.json` (a stale number anywhere fails the build).
- ✅ Five offline `--verify` re-derivation runners: `stellar-soroban-commit-executed` · `stellar-dex-gate-real` · `stellar-dex-swap-executed` · `stellar-agent-gate-executed` · `universal-shield-executed`.
- ✅ Stellar docs SHIPPED: `STELLAR-KILLER-FEATURES` · `STELLAR-ECOSYSTEM-INTEGRATION` · `STELLAR-INTEGRATION-GUIDE` · `STELLAR-MAINNET-TX` · `INTENT-TO-EXECUTION-PROOF` · `EVIDENCE-MATRIX`.
- ✅ Public executed-truth surfaces: the organization profile README (⭐ Stellar section, commit `641ca2d3ad9399a61209f9c7fd8c1ff16e786db4`), the dedicated repo-README section, `docs/EVIDENCE-MATRIX.md#stellar`, and the community executed-truth announcement [discussion #3](https://github.com/coreguard-global/.github/discussions/3) (Arabic-first + EN mirror) carrying the five-runner self-verify walkthrough.

### 5. Grant Request
- **Amount**: $100,000
- **Duration**: 6 months
- **Use of funds**:
  - 2 engineers (6 months): $60,000
  - Stellar ecosystem integration: $20,000
  - Marketing & community: $10,000
  - Infrastructure: $10,000

### 6. Milestones
| Window | Milestone | Deliverable | Status |
|---|---|---|---|
| 1-2 | Mainnet deployment | Soroban contract on mainnet | **EXECUTED BEFORE THIS APPLICATION** — anchor MAINNET DEPLOYED (`CCKA2GYVILX7YZVSXGVIHOPNLTRBBF2SSWKBTQBIE7M67N5N2QMMXPSP`) + commit CALL INVOKED (ledger 65,337,373), committed digest-checked artifacts |
| 3-4 | Freighter integration | Wallet verification | BUILT — wrapper `packages/stellar/freighter.mjs`; E2E stays credential-gated until the owner signs off |
| 5-6 | Soroban-DEX gating | DEX transaction verification | **EXECUTED BEFORE THIS APPLICATION** — DEX-GATE/1 five real-book verdicts + STELLAR-AGENT/1 executed; the first SIGNED FUNDED swap CONFIRMED (ledger 65,338,112) |

*Over-delivery note: the mainnet deployment, the commit CALL and the first gated funded swap were completed BEFORE this application — no grant money has been spent on them; the fund scales what already works.*

### 7. Team
- Founder: EslaM-X (CoreGuard Global)
- GitHub: https://github.com/coreguard-global/CoreGuard
- LinkedIn: https://www.linkedin.com/company/coreguard-global

### 8. Links — public, pinned, self-verifiable
- Repo: https://github.com/coreguard-global/CoreGuard
- Organization hub: https://github.com/coreguard-global/.github (the executed-truth hub table)
- Executed-truth announcement: https://github.com/coreguard-global/.github/discussions/3
- Row-by-row Stellar truth: https://github.com/coreguard-global/CoreGuard/blob/main/docs/EVIDENCE-MATRIX.md#stellar
- Deliverable catalog §11 (Stellar): https://github.com/coreguard-global/CoreGuard/blob/main/docs/PRODUCTS.md
- Live Pages surfaces: https://coreguard-global.github.io/CoreGuard/ · [PLAYGROUND](https://coreguard-global.github.io/CoreGuard/PLAYGROUND.html) · [PRODUCTS](https://coreguard-global.github.io/CoreGuard/PRODUCTS.html)
- First funded swap artifact: `docs/evidence/stellar-dex-swap-executed.json` — digest `sha256:837d063903f4905ececb6f051d9b2f5638079c2f35f4cc03163e9443e553ac2c`
- Pitch Deck: docs/PITCH-DECK.md

### 9. Why Stellar?
Stellar is the leading cross-border payment network. CoreGuard adds the missing verification layer — and on Stellar this is not a promise: the Soroban anchor is deployed, the first owner-authorized anchor call is invoked with an exact on-chain read-back, and the first gated, signed, funded swap is CONFIRMED on the live mainnet order book. We want verifiable execution under every Stellar payment an agent makes.

### 10. What is NOT claimed (honor line)
- No signed mainnet transfers beyond the ONE owner-authorized anchor commit CALL and the ONE owner-authorized gated swap — every further execution stays a credential-gated owner decision.
- No npm SDK publication yet (double-gated pending `NPM_TOKEN` from the owner).
- No revenue, no customers, no partnerships, no endorsements — none; this application is the ask, not a claim of wins.

### 11. Contact
- Email: inquire@coredao.org
- GitHub: https://github.com/coreguard-global
- LinkedIn: https://www.linkedin.com/company/coreguard-global

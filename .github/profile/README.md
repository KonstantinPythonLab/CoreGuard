<div align="center">

<a href="https://github.com/coreguard-global/CoreGuard">
  <img src="https://raw.githubusercontent.com/coreguard-global/CoreGuard/main/assets/coreguard-logo-transparent.png" width="170" alt="CoreGuard">
</a>

# CoreGuard

**VERIFY&nbsp;•&nbsp;PROTECT&nbsp;•&nbsp;EMPOWER**

**The verifiable execution truth layer + fail-closed agent economy — for Bitcoin DeFi.**

*<sub>طبقة الحقيقة التنفيذية القابلة للتحقق لتمويل البيتكوين — ‏الحكم لا يستقر إلا حيث تثبتُه الأدلة</sub>*

CoreGuard tells you whether execution **conformed to what was authorized** — not merely why it looked plausible. Evidence is deterministic, independently replayable by anyone and audited on every push; **`UNKNOWN` stays HELD** until evidence closes it.

<br>

| | |
|---|---|
| 🔗 | [![Website](https://img.shields.io/badge/website-coreguard--global.github.io%2FCoreGuard-FF8A00?style=flat-square&labelColor=0B0F14)](https://coreguard-global.github.io/CoreGuard/) [![Core Mainnet](https://img.shields.io/badge/Core%20Mainnet-anchor%20·%20chainId%201116-FF8A00?style=flat-square&labelColor=0B0F14)](https://coreguard-global.github.io/CoreGuard/PRODUCTS.html) [![Stellar mainnet](https://img.shields.io/badge/Stellar%20mainnet-anchor%20deployed%20·%20call%20INVOKED%20·%20swap%20CONFIRMED-FF8A00?style=flat-square&labelColor=0B0F14)](https://github.com/coreguard-global/CoreGuard/blob/main/docs/EVIDENCE-MATRIX.md#stellar) [![Trust gate](https://img.shields.io/badge/trust%20gate-live%20anchor%20·%20independent--verify%20ladder-FF8A00?style=flat-square&labelColor=0B0F14)](https://github.com/coreguard-global/CoreGuard/blob/main/docs/TRUST.md) |
| 📊 | [![Tests](https://img.shields.io/badge/tests-1436%2F1436%20·%20machine--pinned-FF8A00?style=flat-square&labelColor=0B0F14)](https://github.com/coreguard-global/CoreGuard/blob/main/docs/STATUS.md) [![Boundary](https://img.shields.io/badge/boundary-1045%20files%20·%200%20violations-FF8A00?style=flat-square&labelColor=0B0F14)](https://github.com/coreguard-global/CoreGuard/blob/main/docs/STATUS.md) [![Benchmark](https://img.shields.io/badge/benchmark%2010k-0%20false%20accept%20·%200%20false%20reject-FF8A00?style=flat-square&labelColor=0B0F14)](https://github.com/coreguard-global/CoreGuard/blob/main/docs/STATUS.md) [![Mutation lab](https://img.shields.io/badge/mutation%20lab-1000%2F1000%20refused-FF8A00?style=flat-square&labelColor=0B0F14)](https://github.com/coreguard-global/CoreGuard/blob/main/docs/STATUS.md) |

<br>

**[▶ Live playground](https://coreguard-global.github.io/CoreGuard/PLAYGROUND.html) · [🛍 Product catalog](https://coreguard-global.github.io/CoreGuard/PRODUCTS.html) · [🛡 Bilingual brand kit](https://coreguard-global.github.io/CoreGuard/BRAND.html) · [📄 One source of truth](https://github.com/coreguard-global/CoreGuard/blob/main/docs/STATUS.md)**

</div>

---

## 🌐 The Trinity — one ladder, seven rungs, pinned per ecosystem

| Network | Entry | Status |
| --- | --- | --- |
| **Core DAO** | Per-network commitment anchor on Core (chainId 1116) · `0x037dF08F2d43c5D03759279Fe35664f6AFf9EA6E` | **LIVE** |
| **Stellar** | Soroban anchor contract MAINNET DEPLOYED (`CCKA2GYVILX7YZVSXGVIHOPNLTRBBF2SSWKBTQBIE7M67N5N2QMMXPSP`, stellar.expert-listed) · first commitment-anchor CALL INVOKED (owner-authorized `commit(proofId, commitment)`, tx `69044807410f65027c1227f4e525ad83f23a6cb1a2bb79790d82849c5dbc9fec`, ledger 65,337,373) · **first SIGNED funded DEX swap EXECUTED on the real mainnet order book (owner-authorized `pathPaymentStrictSend`, tx `ac2a7990b3387aab96b197c0c921d57756bd25d65ad0e75b93561ded640b9097`, ledger 65,338,112; `4.0598146 XLM → 0.6306239 USDC`)** · agent gate + REAL-BOOK DEX gate + shield arms EXECUTED with committed artifacts | `MAINNET LIVE (Soroban)` |
| **Pi Network** | Browser DApps · Pi Wallet · Pi Commerce shield | `DRY_RUN / PLAN_ONLY` |

## ⭐ Stellar mainnet — verified & executed · شبكة ستيلار الرئيسية — موثّقة ثم منفّذة

**Stellar is not a plan — it is executed.** The same execution-truth stack as Core, live on the Stellar public mainnet (Horizon `https://horizon.stellar.org`) — every row below pinned to a committed, digest-checked artifact in [`CoreGuard/docs/evidence/`](https://github.com/coreguard-global/CoreGuard/tree/main/docs/evidence):

| Stellar on-chain truth | Value |
| --- | --- |
| **Mainnet wallet — live** | `GDJ3CRNLNDZ4AVWGPUG7DBC5BIAGMIONOONZGB5FSYAY44ZHOIPRKY7U` — live Horizon account · first tx `0.1 XLM → SDF` at ledger **65,308,317** |
| **Soroban anchor — MAINNET DEPLOYED** | `CCKA2GYVILX7YZVSXGVIHOPNLTRBBF2SSWKBTQBIE7M67N5N2QMMXPSP` — stellar.expert-listed · creator = the CoreGuard wallet · deployment untouched, no re-deploy |
| **Anchor CALL — INVOKED** | owner-authorized `commit(proofId, commitment)` — tx `69044807410f65027c1227f4e525ad83f23a6cb1a2bb79790d82849c5dbc9fec` · ledger **65,337,373** · on-chain read-back `{hash, seq}` exact |
| **First SIGNED FUNDED swap — CONFIRMED** | DEX-GATE/1 preflight VERIFIED → owner-signed `pathPaymentStrictSend` on the REAL mainnet order book — tx `ac2a7990b3387aab96b197c0c921d57756bd25d65ad0e75b93561ded640b9097` · ledger **65,338,112** (trustline ledger 65,338,111) · `4.0598146 XLM → 0.6306239 USDC` (0.1553331 USDC/XLM) · destMin `0.6011661` cleared · evidence digest `sha256:837d0639…ac2c` |

**Executed gate surfaces:** **STELLAR-AGENT/1** AI Agent Payment Gate (VERIFIED / REJECTED / HELD · never auto-pay) · **DEX-GATE/1** real-book gate (five verdicts against the live XLM/USDC mainnet order book) · **universal DApp-shield arms** (2 ALLOW · 2 REQUIRE_REVIEW · 1 DENY · 1 REFUSED).

| Stellar products & services | Honest status |
| --- | --- |
| `packages/stellar` — intent → policy → gate engine (`index.mjs` · `dex-gating.mjs` · `soroban-dex.mjs` · `mainnet.mjs` · `mainnet-executor.mjs` · `freighter.mjs`) | EXERCISED ON MAINNET (the anchor call + the gated swap) · wrappers credential-gated |
| Stellar docs — [STELLAR-KILLER-FEATURES](https://github.com/coreguard-global/CoreGuard/blob/main/docs/STELLAR-KILLER-FEATURES.md) · [EVIDENCE-MATRIX](https://github.com/coreguard-global/CoreGuard/blob/main/docs/EVIDENCE-MATRIX.md) · [STELLAR-ECOSYSTEM-INTEGRATION](https://github.com/coreguard-global/CoreGuard/blob/main/docs/STELLAR-ECOSYSTEM-INTEGRATION.md) · [STELLAR-INTEGRATION-GUIDE](https://github.com/coreguard-global/CoreGuard/blob/main/docs/STELLAR-INTEGRATION-GUIDE.md) · [STELLAR-MAINNET-TX](https://github.com/coreguard-global/CoreGuard/blob/main/docs/STELLAR-MAINNET-TX.md) · [INTENT-TO-EXECUTION-PROOF](https://github.com/coreguard-global/CoreGuard/blob/main/docs/INTENT-TO-EXECUTION-PROOF.md) · [GRANT-APPLICATION-STELLAR](https://github.com/coreguard-global/CoreGuard/blob/main/docs/GRANT-APPLICATION-STELLAR.md) | SHIPPED |
| Offline verify — five re-derivation runners (`--verify`) | CI-EXERCISED on every push |

Row-by-row truth: [docs/EVIDENCE-MATRIX.md](https://github.com/coreguard-global/CoreGuard/blob/main/docs/EVIDENCE-MATRIX.md) · full deliverable catalog: [docs/PRODUCTS.md §11](https://github.com/coreguard-global/CoreGuard/blob/main/docs/PRODUCTS.md) · dedicated repo-README section: [CoreGuard/main/README.md](https://github.com/coreguard-global/CoreGuard/blob/main/README.md).
**Never claimed:** signed sweeps beyond the ONE owner-authorized anchor call + the ONE gated swap · npm publication · revenue, customers or partnerships.

**Stellar honesty mirror (what is NOT claimed):** signed mainnet funded transfers
beyond the ONE owner-authorized anchor commit CALL and the ONE owner-authorized
gated swap — credential-gated owner decisions · npm SDK publication — double-gated
pending `NPM_TOKEN` · SaaS live payment — owner rails pending · revenue, customers
or partnerships — none.

## ⚙️ What CoreGuard builds

| Surface | What it delivers |
| --- | --- |
| **CGEP/1 — execution truth receipts** | intent → policy → commitment → receipt → independent verifier → anchor |
| **Execution Firewall** | wrap any action (swap · lend · borrow · bridge · vote · agent proposal) with **ALLOW / DENY / HOLD** + verifiable commitment |
| **x402 reserve-before-sign** | payment-gated, escrowed, deterministic replay, on-chain commission |
| **AgentProof** | declared, signer-bound actor provenance — never a behavioral guess |
| **DDE/1 — dispute boundary** | execution vs acceptance disputes with deterministic, offline-runnable evidence packages |

## 📐 The trust gate · legal node · the lab · the bot — بوابة الثقة والعقد القانوني

| Artifact | Honest status | Why it matters |
| --- | --- | --- |
| [docs/TRUST.md](https://github.com/coreguard-global/CoreGuard/blob/main/docs/TRUST.md) | Investor portal — the live anchor, the seven-rung independent-verify ladder, the evidence matrix, and **what we never claim** | واجهة المستثمر الغيرة |
| [docs/VERIFY-BOT.md](https://github.com/coreguard-global/CoreGuard/blob/main/docs/VERIFY-BOT.md) | `PLAN_ONLY` — Telegram/Discord verification-bot specification, not deployed | مواصفة صادقة بلا ادعاء بتشغيل |
| [docs/LABS.md](https://github.com/coreguard-global/CoreGuard/blob/main/docs/LABS.md) | `DRAFT` — CoreGuard Labs evidence-lab operating plan | مخبر أدلة مستقبلي بحالة شفافة |
| [LICENSE.md](https://github.com/coreguard-global/CoreGuard/blob/main/LICENSE.md) | MIT code · `© 2026 coreguard-global · EslaM-X` — the shield & wordmark are protected | العقد القانوني يحمي الهوية |

## 🚫 What we never claim

**`UNKNOWN` stays HELD.** Every number above is CI-measured on every push and pinned as a re-derivable artifact. **Stellar is mainnet-verified and executed**: the Soroban anchor contract is deployed on Stellar mainnet, the first commitment-anchor CALL is INVOKED, the first SIGNED funded DEX swap is EXECUTED on the real mainnet order book (owner-authorized), and the agent/DEX/shield gate surfaces carry committed execution artifacts — while every later SIGNED money-moving sweep stays credential-gated by design. **Pi** sits at `DRY_RUN`/`PLAN_ONLY` by design. **No settlement authority for anyone, including the owner.** A claim without a replayable artifact is a red flag, not a feature.

## 🚪 Engage

1. **Integration pilots** — put the Execution Firewall in front of your real action flow.
2. **Grant-funded builds** — Core DAO · Stellar · Pi Network program participation.
3. **Strategic partnerships** — wallets · DEXs · exchanges · agents · auditors · insurers.

<div align="center">

**Founder** [EslaM-X](https://github.com/EslaM-X) · **GitHub** [coreguard-global](https://github.com/coreguard-global) · **LinkedIn** [coreguard-global](https://www.linkedin.com/company/coreguard-global) · **X** [CoreGuardGlobal](https://twitter.com/CoreGuardGlobal)

<br>

<sub>🛡 CoreGuard — VERIFY • PROTECT • EMPOWER · Core Orange `#FF8A00` · Deep Core `#0B0F14` · © 2026 coreguard-global · EslaM-X</sub>

</div>

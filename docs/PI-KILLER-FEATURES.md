# Pi Network — execution-truth layer (English · العربية)

> Pi Network is preparing for mainnet and an open developer ecosystem. CoreGuard provides the execution-truth layer for Pi transactions and Pi DApps. The adoption model is the same one proven on Core DAO and Stellar: intent → policy → commitment → receipt → independent verifier → on-chain commit.

## Killer features

| Rung | What it does for Pi Network |
|------|------------------------------|
| **Killer feature** | **Pi transaction execution-proof.** Every Pi transaction gets a deterministic replay hash and a verifiable execution receipt before settlement. The user (or the DApp) can present that receipt in a dispute or an audit. Fail-closed gate keeps UNKNOWN transactions HELD, never silently passed. |
| **Killer use** | **Pi Browser DApps + Pi Wallet use CoreGuard before settlement.** A Pi Browser DApp runs its transaction through CoreGuard first; the app presents the receipt to the user before the user approves the payment. A Pi Wallet can add a pre-sign verification overlay for every outgoing transaction. |
| **Killer on-chain** | **Pi mainnet commitment anchor (prepared for mainnet launch).** Same pattern already proven on Core DAO (chain 1116) and Stellar Soroban: an on-chain commitment anchor stores execution receipts so anyone can replay them. A stub registry contract and proof template are ready for the Pi mainnet launch. |
| **Killer utility** | **Pi ecosystem apps SDK.** Every Pi DApp, Pi Wallet service, agent platform and ecosystem service can use `@coreguard/sdk` to verify transactions on Pi Network. A Pi Browser extension can run one line of verification for every DApp the user visits. |
| **Killer adoption** | **One-line SDK integration.** `npm install @coreguard/sdk` gives a Pi Browser DApp or a Pi Wallet the same verifier used on Core and Stellar. The integration model is identical across the three networks, so ecosystem partners do not learn a new stack for each one. |
| **Killer reference** | **Pi Network apps reference CoreGuard for execution auditability and regulatory reporting.** The same verifier that proves a Core transaction and a Stellar swap also proves a Pi transaction once Pi mainnet is live. Cross-network execution truth is the differentiator. |
| **Killer customer** | **Pi wallet providers, Pi DApp builders, Pi agent platforms, Pi ecosystem services (oracles, data services, escrow), Pi community apps, Pi audit and compliance services.** Every one of them needs a receipt it can show a user, an auditor or a regulator. |

## Why Pi Network needs this

Pi Network moves real participation and real value toward a mainnet and an open developer ecosystem. Once users swap, pay, stake or interact with Pi DApps, the same question appears everywhere: **did the transaction do exactly what was authorised?** Existing Pi tools focus on access, wallets and DApp discovery. None of them publish a cross-DApp, cross-wallet execution-proof standard that a user, an auditor or a regulator can re-derive independently.

CoreGuard fills that missing layer: a deterministic, replayable proof of what was authorised versus what executed, before the transaction settles, fail-closed.

## Status (honest, evidence-first)

- **Pi ecosystem integration: DRY_RUN / PLAN_ONLY right now.** The SDK architecture is reused from Core and Stellar, the anchor pattern is prepared, and the integration points are specified. Nothing is live on Pi Network yet because Pi mainnet and the Pi DApp ecosystem are still opening.
- **Pi mainnet commitment anchor: prepared, not live.** A stub registry contract and a proof template are ready once Pi mainnet opens. No on-chain proof will be claimed before the mainnet is live and the anchor is deployed.
- **Pi Browser verification overlay: prototype, not live everywhere.** A demo overlay and SDK are prepared. They are not yet running on Pi DApps in production.
- **No revenue, customers, partners, funding or audits are claimed** for Pi Network until a named event with evidence exists. VERIFIED ≠ SAFE.

## Cross-network picture

| Network | Execution-truth status | Anchor | Example proof |
|---------|------------------------|--------|---------------|
| Core DAO | LIVE — EvidenceRegistry on chain 1116, verified across two independent RPCs | Live on-chain | Proof Artifact #1: agent execution on Core mainnet, L1 VERIFIED |
| Stellar | LIVE — Soroban anchor deployed, first funded swap confirmed, first commit CALL invoked | Soroban on-chain (preparing for Pi mainnet) | First funded swap: 4.0598146 XLM → 0.6306239 USDC, ledger 65,338,112 |
| Pi Network | Planned / DRY_RUN — SDK reused, anchor prepared, mainnet proof template ready | Prepared for Pi mainnet launch | Not live yet — no execution proof on Pi Network until mainnet opens |

## Integration points

1. **Pi Browser verification overlay.** A lightweight overlay (WebExtension or injected UI) runs a DApp transaction through CoreGuard and shows the user a one-line receipt summary before the user signs: “authorization recovered · policy satisfied · receipt ready · anchored (once Pi mainnet is live)”. UNKNOWN stays HELD.
2. **Pi Wallet pre-sign check.** Pi Wallet integration adds a pre-sign verification step: ALLOW / DENY / HOLD with a verifiable receipt, so a wallet never signs a transaction it cannot explain.
3. **Pi DApp SDK.** Pi DApps call the same verifier as Core and Stellar. The DApp can present an execution receipt to the user, store it for audit, and hand it to a dispute resolution flow when needed.
4. **Pi mainnet commitment anchor (prepared).** A stub registry contract and proof template are ready for the Pi mainnet launch. The anchor stores commitments and receipts so anyone can replay them once the mainnet is live.
5. **Pi ecosystem attestation service.** Pi ecosystem services (oracles, data services, escrow, agent platforms) use CoreGuard to issue execution attestations for the transactions they process, giving downstream users and auditors a verifiable record.

## Adoption playbook

1. **Step 1 — Pi Browser DApps integrate CoreGuard (one-line SDK).** Early adopters add the verifier to their Pi DApps. Each one gets a receipt it can show its users and an audit trail it can keep.
2. **Step 2 — Pi Wallet adds CoreGuard verification overlay.** The wallet shows a verification summary on every outgoing transaction, so users see what they are signing before they sign.
3. **Step 3 — Pi ecosystem services adopt CoreGuard attestation.** Oracles, escrow services, agent platforms and data services issue execution attestations for the transactions they process.
4. **Step 4 — Pi Network ecosystem adopts execution-proof as a standard.** The ecosystem converges on CoreGuard-style receipts so users, auditors and regulators share one verifiable record format.
5. **Step 5 — Cross-network anchor with Core + Stellar.** The same verifier and the same receipt format run on Core, Stellar and Pi. A multi-chain wallet, agent or auditor gets one proof format across all three networks.

## What is not claimed

- Pi mainnet execution proof is not live yet. The anchor pattern is prepared; nothing will be claimed on Pi mainnet before the mainnet is live and the anchor is deployed.
- Pi Browser verification overlay is a prototype; it is not live on all Pi DApps.
- Pi ecosystem partners are prospects, not signed partners.
- Pi Network funding and incubation are not confirmed. Any funding request is a proposal, not an award.
- No revenue, customers, audits or third-party endorsements are claimed for Pi Network until evidence exists.
- VERIFIED ≠ SAFE. The execution-proof layer proves what was authorised and what executed; it does not guarantee the transaction was profitable, safe or free of all exploits.

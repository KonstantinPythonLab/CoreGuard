# Pi Network Killer Features — English · العربية

> Execution truth for Pi Network — prepared for mainnet, not live.
> Same claim discipline as Core DAO and Stellar: no revenue, customers, partners,
> funding or audits claimed until a named event with evidence exists.
> VERIFIED ≠ SAFE.

## One-liner

CoreGuard gives Pi Network a deterministic, replayable proof of what was authorised
versus what executed — fail-closed, before the transaction settles — the same pattern
already proven on Core DAO and Stellar, now prepared for Pi mainnet.

## Killer table — Core · Stellar · Pi Network

| Rung | Core | Stellar | Pi Network |
| --- | --- | --- | --- |
| Killer feature | Execution receipts prove intent = execution | Fail-closed DEX gating + Soroban anchor | Pi transaction verification: deterministic replay before settlement, fail-closed |
| Killer use | Vault/rebalance execution proof | Signed swap gate (real swap executed) | Pi wallet DApp execution proof, Pi agent transactions proof |
| Killer on-chain | Core Mainnet anchor (chainId 1116) | Soroban anchor (MAINNET DEPLOYED) | Pi mainnet anchor (prepared for Pi mainnet opening) |
| Killer utility | Execution Firewall for any action | DApp-shield, agent gate, dispute packs | Pi ecosystem apps use CoreGuard SDK to verify transactions |
| Killer adoption | One-line SDK integration | Freighter / DEX integration | Pi Browser DApps, Pi wallet apps, Pi ecosystem services integrate CoreGuard |
| Killer reference | Deterministic replay-before-submit | Replay-verified swap + commit CALL | Pi Network applications reference CoreGuard for execution auditability |
| Killer customer | DeFi platforms, vault operators, agent platforms | Anchors, wallets, PSPs, auditors, trading agents | Pi wallets, Pi DApps, Pi ecosystem services, Pi community apps |

## 7 killer rungs (Pi Network)

### Killer feature — Pi transaction execution-proof

Every Pi transaction gets a deterministic replay hash and a verifiable execution
receipt before settlement. The user, an auditor or a regulator can re-derive it.
Fail-closed: UNKNOWN stays HELD, never silently passed.

**Prepared, not live.** No Pi mainnet transaction has been verified yet. The pattern
is proven on Core DAO and Stellar; the Pi mainnet anchor is prepared for Pi mainnet
opening.

### Killer use — Pi Browser DApps + Pi Wallet verify before settlement

A Pi DApp or Pi Wallet runs a transaction through CoreGuard and shows the user a
receipt before sign-off. UNKNOWN stays HELD.

**Prototype stage.** Pi Browser verification overlay and Pi DApp SDK prototype are
being prepared; they run on a test or staging environment and are clearly labelled as
a prototype, not production.

### Killer on-chain — Pi mainnet commitment anchor (prepared for mainnet launch)

Same pattern already proven on Core DAO and Stellar: an on-chain commitment anchor
stores execution receipts so anyone can replay them. Prepared for Pi mainnet; nothing
is claimed until Pi mainnet is live.

**Prepared, not deployed.** The anchor pattern is ready; deployment waits for Pi
mainnet to open for third-party integration.

### Killer utility — Pi ecosystem apps SDK

Every Pi DApp, Pi Wallet service, agent platform and ecosystem service can use
`@coreguard/sdk` to verify transactions on Pi Network. A Pi Browser extension can run
one line of verification for every DApp the user visits.

**Prepared for integration.** SDK reused from Core DAO and Stellar; identical
integration model across the three networks.

### Killer adoption — One-line SDK integration

`npm install @coreguard/sdk` gives a Pi Browser DApp or a Pi Wallet the same verifier
used on Core DAO and Stellar. The integration model is identical across the three
networks, so ecosystem partners do not learn a new stack for each one.

**Adoption path ready.** No Pi DApp has integrated yet; the integration path is
documented and reusable.

### Killer reference — Pi Network apps reference CoreGuard for execution auditability

The same verifier that proves a Core DAO transaction and a Stellar swap also proves a
Pi transaction once Pi mainnet is live. Cross-network execution truth is the
differentiator a funder, auditor or regulator can check without trusting CoreGuard.

**Reference claim — not yet live on Pi.** Applications do not reference CoreGuard yet
because Pi mainnet is not open for third-party integration. The claim is that they
will, not that they do.

### Killer customer — Pi wallet providers, Pi DApp builders, Pi agent platforms, Pi
ecosystem services, Pi community apps, Pi audit and compliance services

Every one of them needs a receipt it can show a user, an auditor or a regulator. That
is the customer.

**Prospects, not signed customers.** No Pi Network customer is signed yet; the claim
is about the customer profile, not about signed agreements.

## Killer table (compact, for portal submission)

- **Killer feature:** Pi transaction execution-proof — deterministic replay hash and
  verifiable receipt before settlement, fail-closed (prepared, not live).
- **Killer use:** Pi Browser DApps + Pi Wallet verify before settlement — receipt
  shown before sign-off (prototype).
- **Killer on-chain:** Pi mainnet commitment anchor — same pattern as Core DAO and
  Stellar, prepared for Pi mainnet opening (not deployed).
- **Killer utility:** Pi ecosystem apps SDK — every Pi DApp, wallet service, agent
  platform and ecosystem service uses `@coreguard/sdk` (prepared for integration).
- **Killer adoption:** One-line SDK integration — `npm install @coreguard/sdk`, reused
  from Core DAO and Stellar, identical model across the three networks.
- **Killer reference:** Pi Network applications reference CoreGuard for execution
  auditability — claim about future reference, not current usage (Pi mainnet not open).
- **Killer customer:** Pi wallet providers, Pi DApp builders, Pi agent platforms, Pi
  ecosystem services, Pi community apps, Pi audit and compliance services — prospects,
  not signed customers.

## What CoreGuard brings to Pi Network (9 offers)

1. **Pi Commerce Shield** — reserve-before-sign escrow + receipts for Pi merchant
   payments (`packages/pi-network`).
2. **Pi Wallet & Browser DApp guard** — firewall policies before a Pi Browser DApp asks
   the wallet to sign.
3. **Verified merchant badge** — Badge Shield for Pi stores, renders only from verified
   receipts, fails closed otherwise.
4. **Execution-truth layer (prepared)** — 7-run verification ladder from intent → policy
   → commitment → receipt → verifier → anchor. Same Core/Stellar pattern prepared for Pi
   mainnet. No Pi mainnet TX verified yet.
5. **Pi Browser verification overlay (prototype)** — prototype overlay that surfaces
   CoreGuard verification state next to every Pi Browser DApp action.
6. **Pi mainnet commitment anchor (prepared)** — commitment anchor prepared for Pi mainnet
   launch, ready to anchor receipts on-chain when Pi opens for third-party integration.
7. **Attestation service (planned)** — B2B attestation for Pi merchants, wallet operators
   and DApp publishers — signed, replayable, fail-closed.
8. **Cross-network anchor (Core + Stellar + Pi)** — CoreGuard's cross-network anchor
   pattern proven on Core (chain 1116) and Stellar (Soroban); Pi mainnet anchor prepared.
9. **Pi ecosystem attestation network (planned)** — Pi ecosystem services (oracles, data
   services, escrow, agent platforms) issue execution attestations, giving users and
   auditors a verifiable record.

## Programs we are pursuing (5 programs)

1. Pi Ecosystem Summit / Pi Next hackathon — Nov 17–19, 2026, $200,000 USDT prize pool.
2. Pi App Studio & ecosystem listing.
3. Funding request + incubation proposal + grant application (prepared, milestone-gated).
4. Ecosystem partner outreach (prospects — not signed).
5. Pi mainnet anchor deployment + pilot integrations (once Pi mainnet is live).

## Killer innovations that do not exist yet in the Pi ecosystem

These are prepared or planned; they are not live on Pi mainnet. They are presented as
what CoreGuard brings, not as what already exists.

- **Deterministic replay-before-settlement for Pi transactions** — no Pi service
  currently publishes a replayable receipt before a transaction settles; this is CoreGuard's
  pattern, prepared for Pi.
- **Fail-closed Pi Wallet pre-sign check** — a Pi Wallet step that runs ALLOW / DENY /
  HOLD with a verifiable receipt before signing; not available in the current Pi Wallet.
- **Pi Browser verification overlay** — an overlay that surfaces a one-line verification
  summary next to every DApp action; not available in the current Pi Browser.
- **Pi mainnet on-chain commitment anchor** — an on-chain anchor for execution receipts
  on Pi mainnet; not deployed yet because Pi mainnet is not open for third-party
  integration.
- **Pi ecosystem attestation service** — B2B attestations for Pi merchants, wallet
  operators and DApp publishers; not available yet.
- **Cross-network execution truth (Core + Stellar + Pi)** — the same verifier proves
  transactions on three networks; no Pi application references CoreGuard yet because Pi
  mainnet is not open.
- **One-line SDK for every Pi DApp** — `npm install @coreguard/sdk` reused from Core DAO
  and Stellar; no Pi DApp has integrated yet.
- **Verified merchant badge for Pi stores** — Badge Shield that renders only from verified
  receipts; not available for Pi stores yet.
- **Dispute evidence packs for Pi commerce** — DDE/1-style offline evidence packages for
  Pi payments disputes; not available yet.
- **Pi agent transaction proof** — verifiable receipts for Pi agent transactions (agents
  acting on behalf of users); not available yet.

Each innovation is labelled with its real status: PREPARED, PROTOTYPE, PLANNED, or
PREAMBLE (claim about future reference, not current usage). No innovation is claimed as
live on Pi Network.

## Cross-network truth table (Core · Stellar · Pi Network)

| Dimension | Core DAO | Stellar | Pi Network |
| --- | --- | --- | --- |
| Status | LIVE — EvidenceRegistry on chain 1116, verified across two independent RPCs | LIVE — Soroban anchor mainnet deployed, first signed swap executed (ledger 65,338,112) | DRY_RUN / PLAN_ONLY — execution-truth layer prepared, no Pi mainnet TX verified yet |
| Killer feature | Execution receipts prove intent = execution | Fail-closed DEX gating + Soroban anchor | Pi transaction verification: deterministic replay before settlement, fail-closed |
| Killer use | Vault/rebalance execution proof | Signed swap gate (real swap executed) | Pi wallet DApp execution proof, Pi agent transactions proof |
| Killer on-chain | Core Mainnet anchor (chainId 1116) | Soroban anchor (MAINNET DEPLOYED) | Pi mainnet anchor (prepared for Pi mainnet opening) |
| Killer utility | Execution Firewall for any action | DApp-shield, agent gate, dispute packs | Pi ecosystem apps use CoreGuard SDK to verify transactions |
| Killer adoption | One-line SDK integration | Freighter / DEX integration | Pi Browser DApps, Pi wallet apps, Pi ecosystem services integrate CoreGuard |
| Killer reference | Deterministic replay-before-submit | Replay-verified swap + commit CALL | Pi Network applications reference CoreGuard for execution auditability |
| Killer customer | DeFi platforms, vault operators, agent platforms | Anchors, wallets, PSPs, auditors, trading agents | Pi wallets, Pi DApps, Pi ecosystem services, Pi community apps |
| Evidence | `LINKS` + `PROOF` in `src/content/coreguard.ts`; evidence files in `docs/evidence/` | Same + `docs/PI-MAINNET-TX.md` | `docs/PI-MAINNET-TX.md` (proof template PREPARED), `src/content/pi.ts` |
| VERIFIED ≠ SAFE | YES — on-chain proof artifacts | YES — on-chain proof artifacts | PENDING — prepared, not live |

## Claim discipline for Pi Network

- Pi mainnet execution proof: **PREPARED, not live**
- Pi Browser verification overlay: **PROTOTYPE**
- Pi mainnet commitment anchor: **PREPARED, not deployed**
- Attestation service: **PLANNED**
- Pi ecosystem attestation network: **PLANNED**
- Pi Next hackathon: **CONFIRMED EVENT** (Pi Network official), $200,000 USDT prize pool, Nov 17–19, 2026
- Funding / incubation / grant: **PREPARED documents, no award claimed**
- Partners: **PROSPECTS, not signed**
- Customers: **PROSPECTS, not signed**
- Revenue / audits: **NOT claimed**
- References: claims about future reference, not current usage (Pi mainnet not open)

For Core DAO and Stellar, LIVE + VERIFIED claims are backed by on-chain proof artifacts
(see `LINKS` and `PROOF` in `src/content/coreguard.ts` and the evidence files in
`docs/evidence/`).

## Portal-ready one-liner (EN/AR)

- **EN:** Execution truth for Pi Network — prepared for mainnet; deterministic, replayable
  proof of what was authorised versus what executed, fail-closed, before settlement.
- **AR:** حقيقة التنفيذ لـ Pi Network — مستعدة للشبكة الرئيسية؛ إثبات حتمي وقابل لإعادة
  التحقق لما أُصرّح مقابل ما نُفّذ، فشل آمن، قبل التسوية.

## What a Pi Network funder, auditor or partner gets

- A deterministic replay hash and verifiable receipt for every transaction (prepared).
- A Pi Wallet pre-sign check that never signs what it cannot explain (prototype).
- A Pi Browser overlay that surfaces verification state next to every DApp action
  (prototype).
- An on-chain commitment anchor once Pi mainnet is live (prepared).
- An attestation service for Pi merchants, wallet operators and DApp publishers (planned).
- Cross-network execution truth with Core DAO and Stellar (proven on Core and Stellar,
  prepared for Pi).
- One-line SDK integration reused from Core DAO and Stellar (prepared for integration).
- A verified merchant badge for Pi stores (prepared).
- Dispute evidence packs for Pi commerce (prepared).
- Pi agent transaction proof (prepared).

Each is labelled with its real status. None is claimed as live on Pi Network.

## Arabic summary (ملخص عربي)

كورغارد بيقدم لـ Pi Network طبقة حقيقة تنفيذ مستعدة للشبكة الرئيسية — إثبات حتمي وإيصال قابل
لإعادة التحقق قبل التسوية، فشل آمن. 7 حلقات قاتلة: الميزة، الاستخدام، السلسلة، الفائدة، الانتشار،
المرجع، العميل. نفس النمط اتثبت على Core DAO و Stellar، ومستعد لـ Pi mainnet. لا شيء مُدّعى
كـ live على Pi حتى يفتح الشبكة الرئيسية للتكامل مع أطراف ثالثة. الـ Summit و hackathon و
$200K تم지갑ت. المنح والحضانة والتمويل مستعدة كمستندات، مش كجوائز. الشركاء والعملاء مرشحين، مش
موقّعين. VERIFIED ≠ SAFE.

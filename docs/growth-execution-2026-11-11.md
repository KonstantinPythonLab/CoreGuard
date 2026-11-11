# Growth execution pack - funding map, Wave readiness, innovation roadmap

**Dated instrument, 2026-11-11.** This records what the verified funding
landscape and the growth plan were ON THIS DATE. Supersede it with a newer
dated instrument rather than editing it. Baseline discipline is inherited from
`docs/funding-roadmap-2026.md` (never build a plan on a program that may be
closed; a page existing is not a window being open) and the SCF interest-form
pack (`docs/SCF-46-INTEREST-FORM-READY-2026-11-06.md`, the #46-era draft).

Honesty frame: this is an opportunity map, not a commitment list. No funding is
committed or approved anywhere in the project. Nothing here promises money,
users, adoption, or outcomes.

---

## 1. Honest baseline (what stands today, machine-measured)

- The measured state is the committed snapshot: `testsTotal` 1539, enforced by
  CI on every push; every reviewer-facing number reproduces from a clean clone.
- Community signal, same day: PR #51 (Stellar DEX integration) and PR #52
  (contributor program hub) merged; PR #53 rejected (a one-line change whose
  message would have auto-closed the program tracking issue).
- The bounty manifest (`docs/bounties.json`) is now fully mapped: CG-BTY-001
  MERGED (reward stays `PENDING_FUNDING`), CG-BTY-002 -> #27, CG-BTY-003 -> #28
  (reserved for @soundcake pending a funding decision), CG-BTY-004 -> #30,
  CG-BTY-005 -> #54 (this push), CG-BTY-006 -> #32, CG-BTY-007 -> #55 (this
  push, new). No bounty carries committed money.
- Revenue is zero. No users, no customers, no external audit. The pitch to any
  funder is the evidence machinery, not a traction story.

## 2. Verified funding map (as of 2026-11-11)

Primary sources checked on this date (grants.watch, communityfund.stellar.org,
stellar.org/grants-and-funding, the ecosystem weekly roundups). Re-verify every
window before use.

| Program | Award shape | Window (verified on this date) | Fit | Next action |
|---|---|---|---|---|
| Stellar Wave Program (Drips) | pooled monthly contribution rewards, SDF-funded; Wave 11 pool reported between 75,000 and 100,000 USDC across sources - verify on the Wave page before citing | Wave 11 sprints 2026-11-18 to 2026-11-25; monthly cadence (Wave 12 expected mid-December) | two-sided: earn as contributors now; onboard the repo so funded contributors clear our backlog | maintainer onboarding (owner click-through) + contributor sign-ups before 11-18 |
| SCF Build Award (next round) | up to 150,000 XLM, milestone tranches (MVP / testnet / mainnet) | SCF #46 closed 2026-11-08/09; rounds run roughly every six weeks; next round expected around mid-to-late December (verify when the round page appears) | the core grant | interest form now (rolling review); refresh the #46-era draft for the new round number and dates |
| SCF Public Goods Award | up to 50,000 XLM per proposal per quarter | invitation-only; review periods announced in the #scf-governance Discord channel | exact fit: open verification infrastructure for the ecosystem | join the Stellar developer Discord; become an SCF verified member; watch #scf-governance |
| SDF Academic Research Grants | up to 150,000 USD per proposal, quarterly | deadline 2026-12-31 | only realistic with an academic partner | optional |
| SDF Marketing Grants / Matching Fund / Enterprise Fund | grants and investment up to 500,000 USD | post-launch traction tracks | later, after real adoption exists | not now |
| Soroban Audit Bank | free security audit for SCF Build awardees | attached to Build awards | closes our one honest gap (no external audit) | arrives with the grant, if awarded |

## 3. Wave readiness (Stellar Wave Program, Drips)

The Wave Program funds contributors who resolve issues across approved Stellar
ecosystem repos ("Fix. Merge. Earn."). Two distinct paths, both real:

**Maintainer path (free to the project).** Steps, per the Drips maintainer docs
(docs.drips.network/wave): (1) sign in on drips.network with the org's GitHub
account; (2) add and verify the `coreguard-global` organization; (3) sync the
public repo(s); (4) apply the repo to the Stellar Wave Program; (5) wait for
organizer (SDF) approval; (6) add issues with a complexity level (Trivial /
Medium / High sets the point value), from the dashboard or with the Wave label
once the repo is approved. The repo-onboarding window for Wave 11 closed
2026-11-07, so the realistic target is Wave 12 (mid-December); onboarding can
start now.

**Contributor path (real money this month).** Wave 11 runs 2026-11-18 to
11-25. Anyone on the team or in the contributor community can link their
GitHub on Drips, browse approved Stellar repos' issues, ship fixes during the
sprint window, and earn a share of the pool. This is the fastest real-money
path available and requires no project funding.

**Wave-ready backlog (the shovels are already in the ground).** All items below
carry acceptance criteria in their issue bodies and in the manifest:

| Item | Issue | Suggested Wave complexity |
|---|---|---|
| CG-BTY-002 Stellar wallet integration example | #27 | Medium |
| CG-BTY-003 Reviewer kit (reserved for @soundcake pending funding decision) | #28 | High |
| CG-BTY-004 Fuzz/property tests for canonicalization/verifier | #30 | High |
| CG-BTY-005 Execution-receipt deep-dive + demo video + integration guides | #54 | Medium |
| CG-BTY-006 Reproducibility and supply-chain hardening | #32 | High |
| CG-BTY-007 On-chain bounty escrow contract (Soroban) | #55 | High |

## 4. SCF next-round interest form (refresh, not rewrite)

The #46-era answers (`docs/SCF-46-INTEREST-FORM-READY-2026-11-06.md`) remain
the base: name, summary, category, stage, why-Stellar, build plan, links are
already written and evidence-backed (deployed Soroban commitment anchor
third-party-listed on stellar.expert, owner-authorized anchor call, first
signed funded mainnet swap). What a #47 submission adds or updates:

1. Round number and its real deadline (verify from the SCF page when the round
   opens; do not carry #46's dates forward).
2. The contributor program as community evidence: two community PRs merged in
   one day, a mapped bounty manifest, and a fail-closed claim verifier.
3. The Wave Program engagement as it materializes (repo onboarding decision,
   any Wave-earned contributions) - only report what actually happened.
4. A sharper milestone set tied to measured state: M1 reviewer kit + escrow
   contract on testnet; M2 wallet/DEX integration pilots; M3 x402
   receipt-gated paid API on mainnet + the receipt-semantics SEP draft.
   Every milestone is verifiable from the snapshot, which no competitor offers.

## 5. x402 pricing memo (owner decision required)

`packages/x402` (X402/1) implements the payment-gated harness; the gate is
owner-locked by design - the price is a project decision, not an agent one.
Options to choose between:

- **Discovery tier:** free, rate-limited verification endpoint; paid tier for
  full receipts and offline re-derivation bundles.
- **Per-verification micropayment:** USDC cents-scale per gated call; x402 is
  already promoted on Stellar's own developer surfaces, so the payment rail
  story is native.
- **Bundled access:** monthly prepaid verification packs for integrators.

Choosing a price is a one-line edit plus the standard same-push snapshot
discipline; no revenue exists until a real call is paid, and none is claimed.

## 6. Innovation roadmap (gaps as far as I know, stated honestly)

Each item below is "not found, as far as I know, in the Stellar ecosystem
today" - verify before claiming externally, and build before claiming at all.

1. **Receipt-semantics SEP** - a Stellar Enhancement Proposal standardizing
   fail-closed execution-receipt semantics (VERIFIED / MISMATCH / UNKNOWN with
   named reasons) and offline re-derivation. If the standard ships CoreGuard-
   shaped, every adopter implements our model.
2. **On-chain bounty escrow (Soroban)** - tracked as CG-BTY-007 / #55 (this
   push). Turns the contributor program into atomic settlement and is reusable
   by every ecosystem project that runs bounties.
3. **Receipt-gated x402 paid API** - the first paid Stellar API that opens
   only behind a verified execution receipt (mechanism exists; price is the
   owner's decision).
4. **Trust layer for autonomous AI agents** - agents spending on Stellar need
   a gate that closes on proof of execution, not on promises. The agent
   payment gate exists; the position in the ecosystem is unoccupied.
5. **Adoption-by-PR** - verification lines contributed inside Soroswap /
   Aqua / Phoenix / Freighter repos, so adoption arrives through their own
   review process instead of through claims.
6. **Evidence passports for RWAs and anchors** - issuance-evidence packs in
   the `evidence-passport-v2` shape for the tokenized-asset era (bank-issued
   stablecoins and institutional tokenization are already landing on Stellar).
7. **Wallet-side verify widget** - a small library that renders a receipt
   verdict before a user signs, turning verification into a visual shield.

## 7. Owner-only decisions (nothing moves without them)

1. Approve the Wave Program org/repo onboarding (free; click-through with the
   org's GitHub identity).
2. Provide the entity/KYC identity for an SCF submission (the #46-era draft
   becomes paste-ready once refreshed for the new round).
3. Choose the x402 price (Section 5).
4. Approve any external submission before it leaves (standing rule).

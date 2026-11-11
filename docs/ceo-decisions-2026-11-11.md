# CEO delegated decisions - 2026-11-11

**Dated instrument, 2026-11-11.** The owner granted full delegation this date
("consider yourself CEO; all permissions granted"). This memo records what the
delegated authority DECIDED, what remains blocked on DATA only the owner
holds, and one self-correction. Nothing here promises funding, users, revenue,
or outcomes.

---

## Decision 1 - Stellar Wave Program onboarding: APPROVED

Approved under delegation. The runbook is mechanical and free:
sign in on drips.network with the org's GitHub identity, add and verify
`coreguard-global`, sync the repo, apply to the Stellar Wave Program, wait for
SDF organizer approval, then add Wave-eligible issues with a complexity level.

**Execution status: the click-through requires the org's GitHub login session
on drips.network, which no agent or checkout on this machine holds.** The
decision therefore lands as APPROVED and click-ready; the moment an owner
session exists, the steps above are the whole job. Realistic window: Wave 12
onboarding (mid-December); contributor participation in Wave 11 (Nov 18-25)
needs only individual GitHub accounts linked on Drips - that path is open to
the community today and requires nothing from the project.

## Decision 2 - x402 pricing: DECIDED, publication correctly gated

The delegated decision, now recorded as the project's price:

- **Discovery tier: free** - structural verdict, health, rate-limited.
- **Per-verification: 25 USDC cents ($0.25)** - full receipt with offline
  re-derivation bundle, paid per gated call over x402.
- **Bundled access: prepaid monthly verification packs** for integrators
  (per-tier pricing set with the first integrator; no number invented early).

**Self-correction (supersedes §5 of `docs/growth-execution-2026-11-11.md`
where it conflicts):** that document called the price flip "a one-line edit
plus snapshot discipline". That was wrong. `packages/pricing` is a
`1-hypothesis` module **by standing governance**: the README's Plans and
pricing section states pricing stays locked until the Decision Gate opens
**after Counterparty #1**, the machine stamps `gated: true`, and the
claims registry carries `CL-PRICES-LOCKED`, `CL-OWNER-SIGNOFF`, and
`CL-RELEASE-TRIGGER` as GATED claims with their own re-checks. The unlock
trigger is a FACT - the first real counterparty - not a preference, and no
counterparty exists (zero users, zero customers). Locking the menu now would
fabricate the trigger, which is precisely the claim class this repository's
machinery exists to prevent.

So the decided price is RECORDED here and becomes a mechanical, reviewed flip
(one governance change touching the pricing module + its tests + README + the
commercial packaging doc + the claims registry, all in one push) the day
Counterparty #1 exists. The mechanism itself is finished and tested today:
the harness builds canonical challenges only for owner-locked quotes,
settles in DRY_RUN only, and books zero revenue.

## Decision 3 - external submissions: delegated with a possession rule

Authority for repo-internal public content (issues, comments, docs) is
exercised under this delegation. Anything OFF-REPO (the SCF interest form,
the Wave dashboard, Discord, partner emails) stays per-step for one honest
reason: **possession, not authority** - those channels need the owner's
identity sessions and entity data, which no agent holds:

- SCF submission needs the entity/KYC data (legal name, contact, wallet for
  the award, beneficial-owner facts). NEVER fabricate it; the moment the
  owner supplies it, the #46-era draft refreshes to the live round and is
  paste-ready.
- Wave onboarding needs the org's GitHub session (Decision 1 above).
- No SEP submission happens without a separate owner sign-off, per the
  standing rule - the draft in this push is internal only.

## Decision 4 - the seven innovation items are now engineering units

The innovation roadmap is no longer a list of ideas:

- **SEP receipt semantics** - drafted this push
  (`docs/sep-receipt-semantics-draft-2026-11-11.md`), open-call issue filed.
- **On-chain bounty escrow** - already scoped as CG-BTY-007 / #55 with a
  fail-closed lifecycle and its negative-control suite.
- **Receipt-gated x402 paid API** - mechanism live; price decided (Decision
  2); publication gated on Counterparty #1.
- **Trust layer for AI agents** - the agent gate exists; positioning tracked
  as an open-call issue.
- **Adoption-by-PR inside DEXes/wallets** - open-call issue filed; every
  external touch stays per-step.
- **Evidence passports for RWAs/anchors** - open-call issue filed on the
  existing `evidence-passport-v2` model.
- **Wallet-side verify widget** - open-call issue filed with a fail-closed
  spec (UNKNOWN must never render as a checkmark).

# Owner click-runbook - 2026-11-11

**Dated instrument, 2026-11-11.** Authored under owner delegation. This runbook
covers every remaining step that is blocked on OWNER POSSESSION (identity
sessions, entity data, keys, accounts) - not on authority. Each step states
where it is, what to click or paste, and what it unlocks. Nothing here promises
funding, adoption, or outcomes. Every factual claim about the machinery was
measured against the committed tree on this date.

Commands are shown as inline text only. This document deliberately carries no
executable command blocks: the steps below are owner-side actions on external
websites and GitHub's web UI, and one repository verifier intentionally exits
with a non-zero code in the current honest state (explained in Step 3).

---

## Step 1 - Stellar Wave Program onboarding (drips.network)

Status: APPROVED under delegation (see `docs/ceo-decisions-2026-11-11.md`,
Decision 1). The click-through needs the org's GitHub login session, which no
agent or checkout holds.

Where: `drips.network` in a browser where you are signed in to GitHub as
`coreguard-global` (or an admin of the org).

The path, in order:

1. Sign in to drips.network with the GitHub identity that administers
   `coreguard-global`.
2. Add and verify the `coreguard-global` organization on the site.
3. Sync the `CoreGuard` repository into the site (the repo picker lists your
   org's repos once the org is verified).
4. Apply to the Stellar Wave Program for the repo.
5. Wait for the SDF organizer approval email - onboarding is free; nothing is
   charged at any point.
6. After approval, add Wave-eligible issues from the repo's tracker, each with
   a complexity level (level 1-3). The Wave-ready tracker items already exist:
   the bounty issues (#54, #55), the RFC (#56), and the open calls (#57, #58,
   #59) are written to be eligible as-is.

Timing facts (verified live on 2026-11-11): Wave 11 runs Nov 18-25 with
75,000 USDC for contributions - participating as a CONTRIBUTOR there needs
only individual GitHub accounts linked on Drips, open to anyone in the
community today, and requires nothing from the project. Realistic window for
this repo's own onboarding: Wave 12 (mid-December).

## Step 2 - Stellar Community Fund interest form (KYC entity data)

Status: the answers are drafted; the entity data is yours alone. NEVER let
anyone fabricate it.

Where: the SCF interest form (communityfund.stellar.org - Build Award track).

What you paste that no agent holds:

- the entity's legal name and registration facts,
- a contact email you check,
- the wallet address that would receive an award,
- beneficial-owner facts the form asks for.

Once you supply those, the prepared draft (`docs/SCF-46-INTEREST-FORM-READY-2026-11-06.md`
plus the evidence packet) refreshes to the live round and is paste-ready.
Timing facts (verified live on 2026-11-11): round #46 is in panel review
Nov 11-18 with the community vote Nov 23-Dec 3; round #47 is not announced and
the interest form is reviewed on a rolling basis, so submitting now positions
the project for the next cycle. Typical lifetime cap for the Build Award is
about 150,000 XLM (case-by-case up to about 300,000), paid in milestone
tranches.

## Step 3 - Freighter E2E: the one human promotion step

Status: everything agent-side is BUILT and CI-verified; the surface's registry
state is truthfully `BUILT_UNVERIFIED` and becomes `BUILT` only through this
step. The machinery is the three-gate promotion path merged in PR #49. What
follows is the exact human half.

1. In YOUR browser (Chrome or Firefox), install the real Freighter extension
   from freighter.app and create or import a wallet. Keep the keys with you -
   nothing in this flow ever asks you to paste a seed phrase anywhere.
2. Open the repository's browser demo (the agent-gate demo page under
   `examples/agent-gate-browser`, served locally or via the published pages
   site) and complete its record-a-signature step: the page hands you a
   signed envelope produced BY THE EXTENSION - a real Ed25519 signature from
   a real wallet key. The server refuses to write anything unless all three
   gates pass: the caller declares the extension (a local keypair is refused
   by name), the envelope conforms to the authorized intent, and the
   signature verifies against the declared wallet key.
3. Run the offline attestation verifier (inline text:
   `node scripts/agent-gate-freighter-attest.mjs --verify`). Today, before
   your step, it re-derives everything and exits 3 - that exit code IS the
   truthful state: the artifact exists, verifies structurally, and the
   surface stays `BUILT_UNVERIFIED` because no real extension signature was
   recorded yet. After your signature is recorded, the same verifier exits 0.
4. Only after a passing verify, run the promotion (inline text:
   `node scripts/agent-gate-freighter-attest.mjs --promote`). The registry
   flips `agent-gate-freighter` to `BUILT` - and only then does any document
   call the surface BUILT.

Honest ceiling of the artifact (it names it itself): it proves the declared
WALLET KEY signed the authorized intent. It does not prove which software
held the key, that anything was submitted on-chain, or that anyone adopted
the gate. No claim may be made beyond that.

## Step 4 - SDK publish (the designed lane: npmjs.org)

Status: the machinery is COMPLETE and gate-certified as of today - measured
against the committed tree:

- The publish gate (`npm run publish:check -- sdk`, or all 13 packages)
  passes: tarball contents, no escaped imports, dependency truth, and INSTALL
  PARITY - the packed 13-package closure installs into a scratch workspace
  and every public entrypoint imports and runs.
- The release lane is `.github/workflows/release.yml` (npm release, gated):
  it refuses to run without the confirm input typed exactly as RELEASE, and
  refuses without the NPM_TOKEN secret. It publishes all 13 packages in
  dependency order with npm provenance and public access to
  registry.npmjs.org.
- A publish attempt to GitHub Packages was measured today and is NOT the
  designed lane: npm.pkg.github.com maps the package scope to the GitHub
  account name, so `@coreguard/sdk` answered
  `403 ... permission_denied: create_package` (the scope `@coreguard` is
  neither `coreguard-global` nor `eslam-x`). The one GitHub Packages package
  this repo has published did so under the org-mapped scope
  `@coreguard-global/coreguard-badge` - renaming the whole 13-package
  closure to that convention would be a large governed refactor and is NOT
  required for the designed lane.

Your one-time possessions to unlock this:

1. Create an npmjs.com account (or org) that owns the `@coreguard` scope
   name on npmjs - registering a scope costs nothing and reserves the name.
2. Generate an npm automation or granular token with publish rights to that
   scope.
3. In the GitHub repo: Settings, then Environments, create/approve the
   `npm-release` environment; then Settings, then Secrets and variables, then
   Actions, add the secret named `NPM_TOKEN` with the npm token as its value.
4. Then Actions, then "npm release (gated)", Run workflow, type RELEASE in
   the confirm box, run. The gate runs first; if anything is not publishable
   the workflow stops before publishing anything (no half-published trees -
   the script is fail-closed by design).

That single dispatch publishes the SDK and its 12 dependency packages,
installable by anyone with `npm install @coreguard/sdk`.

## Step 5 - Package visibility flip (GitHub Packages, the badge package)

The GitHub Packages package `@coreguard-global/coreguard-badge` currently
sits at PRIVATE visibility. No API exists to change visibility (measured and
documented as the C38 lesson): the flip is YOUR web-UI one-click.

Where: github.com, then your org profile, then Packages, then the package,
then Package settings, then the Danger Zone, then Change visibility, then
Public. After the flip, anyone can `npm install` it against
npm.pkg.github.com.

## Step 6 - Authorized-lane contract deploy (the last external gate)

The Soroban authorized-lane deploy contract is built and its battery is
CI-enforced (decision-doc parse, owner-flag gate, CI-artifact manifest
identity, fee floor, rehearsal-first, digest order-independence, the
cross-language known-answer id). What it waits for, by binding governance:

1. An EXTERNAL human review of the contract and its gates - none has been
   performed to date, and no document may claim otherwise.
2. Your explicit broadcast sign-off.

Until both exist, the contract is NOT deployed and every status surface
reports that truthfully. Nothing in this runbook can substitute for either.

---

## What each step unlocks (one line each)

- Step 1: community bounty participation becomes payable through the Wave
  rails; the tracker is already Wave-ready.
- Step 2: the SCF application can be submitted in the next live cycle.
- Step 3: `agent-gate-freighter` becomes BUILT - with real evidence, not a
  claim.
- Step 4: `npm install @coreguard/sdk` becomes true for anyone.
- Step 5: the badge package becomes publicly installable.
- Step 6: the authorized-lane contract lands on mainnet with review + owner
  sign-off behind it.

Every step above is reversible or gated by its own refusal path. None of them
requires handing keys, data, or identity to an agent - that is the point.

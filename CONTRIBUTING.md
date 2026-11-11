# Contributing to CoreGuard

Thanks for your interest. CoreGuard is an execution-truth protocol for Bitcoin DeFi
on Core. Open source, deterministic, audit-friendly. Zero-dependency Node.js + one
tiny Solidity contract.

## Ground rules

1. **Determinism above all.** Verification must be reproducible by anyone, anywhere.
   No heuristics, no network calls inside the verifier, no mutable global state.
2. **Honesty in claims.** Never claim "100% secure", "audited", "prevents all exploits"
   or anything that attributes safety to CoreGuard that it does not provably provide.
3. **Scope discipline.** Guard against feature creep. If a feature belongs in the
   roadmap, say so instead of silently expanding v0.x.

## Development

```bash
npm install
npm test          # node --test — canonicalization, policy, tamper, P1 suites
npm run corpus    # regenerate the deterministic benchmark corpus
npm run benchmark # run all 73 adversarial scenarios
forge build       # Solidity registry
```

Tests must stay green and the benchmark count must stay 73/73 before merging.

## Conventional commits

- `feat:` new capability · `fix:` bug · `docs:` spec/docs · `test:` suites
- `spec:` changes to CGEP/1 and friends · `contract:` Solidity changes

## Code of conduct

Be respectful. Technical disagreement is welcome; personal attacks are not.

## Review

- **Engine changes** must keep the verifier RPC-free and deterministic.
- **Spec changes** must update `spec/` in the same commit.
- **Contract changes** must include the reason the commitment model (not the
  evidence model) changed.

Questions? Open an issue before a large PR.
---

## Bounty & Contributor Program

CoreGuard runs a transparent bounty/contributor program so developers, auditors,
and technical writers can ship high-impact work with clear expectations.

### Bounty tracks

| Track | Examples | Label |
|---|---|---|
| **Integrations** | Stellar wallet, DEX, Soroban dApp adapters | `integrations` |
| **Verification & DX** | Reviewer kit, `--verify` runners, docs, tutorials, sample apps | `verification` |
| **Security & Correctness** | Fuzz/property tests, negative-case corpus, threat models | `security` |
| **Ecosystem Content** | Deep-dives, demo videos, integration guides (EN/AR) | `content` |
| **CI/Tooling** | Reproducibility, supply-chain hardening, ergonomics | `ci-tooling` |

### How to claim a bounty

1. **Find an open bounty.** Browse [issues labeled `bounty`](https://github.com/coreguard-global/CoreGuard/labels/bounty)
   or [`good first issue`](https://github.com/coreguard-global/CoreGuard/labels/good%20first%20issue).
   Also check [`docs/bounties.json`](docs/bounties.json) for the full manifest with acceptance criteria.
2. **Open a Bounty Claim issue** using the "Bounty Claim" template, referencing the
   bounty issue number. State your plan and acceptance criteria.
3. **Wait for the maintainer's acknowledgment** (a `claim-in-progress` label on your
   claim issue, or a comment). Do not start work until your claim is acknowledged —
   this avoids duplicated effort.
4. **Fork the repo, create a branch, ship the work.** Follow the ground rules above.
5. **Open a PR with `Closes #<bounty-issue-number>`** in the description, link your
   claim issue, and fill the PR checklist.
6. **Run local verification** before requesting review:

```bash
node scripts/verify-claims.mjs --manifest-check           # validate the manifest
node scripts/verify-claims.mjs --claim CG-BTY-001 --pr-url https://github.com/coreguard-global/CoreGuard/pull/51
```

An `OPEN` claim intentionally fails verification (fail-closed): the command passes only once the claim's status is `CLAIMED` or `MERGED` and its `pr` matches the submitted PR URL.

### Acceptance criteria & review SLA

Every bounty lists explicit acceptance criteria (in the issue body and mirrored in
`docs/bounties.json`). Work is accepted when:

- [ ] All acceptance criteria are demonstrably met (with tests, artifacts, or
      executed commands — not prose claims).
- [ ] `npm test` stays green; `npm run boundary:audit` reports 0 violations.
- [ ] `docs/state-snapshot.json` is consistent (the suite count is machine-enforced).
- [ ] No over-claims: "execution proof ≠ security audit" per `docs/CLAIMS-TAXONOMY.md`.

**Review SLA (targets):** initial response ≤ 48h · first review pass ≤ 5 business
days · merge after approval ≤ 1 business day.

### Rewards — honest scope

- Bounties are paid **only** when scope, funding, and approval are all explicit in
  the bounty issue. `reward.status` in `docs/bounties.json` reflects the current
  funding state — `UNFUNDED` and `PENDING_FUNDING` bounties are **not** payable yet.
- Recognition: merged contributors are credited in `docs/bounties.json` and release
  notes. Evidence-backed badges (CG-BDG/1) may be issued at the owner's discretion.
- Execution proof ≠ security audit. Contributions must not introduce over-claims.

### Labels & board

- [`bounty`](https://github.com/coreguard-global/CoreGuard/labels/bounty) — funded or
  fundable bounty issues.
- [`good first issue`](https://github.com/coreguard-global/CoreGuard/labels/good%20first%20issue) —
  newcomer-friendly, small scope.
- [`open-call`](https://github.com/coreguard-global/CoreGuard/labels/open-call) —
  discussion/proposal issues, not yet scoped.
- [`claim-in-progress`](https://github.com/coreguard-global/CoreGuard/labels/claim-in-progress) —
  acknowledged claim; work underway.

Board query for all four labels (paste into the GitHub issues search box):

```
is:issue is:open label:bounty OR label:"good first issue" OR label:"open-call" OR label:"claim-in-progress"
```

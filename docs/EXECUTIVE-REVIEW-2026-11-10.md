# Executive review — recorded, with the actions it produced (2026-11-10)

An external reviewer read the repository in full and returned an assessment.
This file records it as an instrument: what was said, what it costs, what was
changed, and what is still open. It is not a rebuttal and not a summary that
softens the criticism.

## The assessment, as received

| Dimension | Verdict |
|---|---|
| Strength of the problem being solved | high |
| Architectural innovation | promising |
| Security idea | important |
| Documentation and evidence | good in volume, needs auditing |
| Stellar integration | components and mainnet experiments exist; the general integration is incomplete |
| Enterprise readiness | needs work |
| External adoption | not enough evidence found |
| Independent security audit | no proof of a completed independent audit found |

The reviewer's summary: *"I cannot describe it today as core infrastructure
adopted in Stellar, or guarantee $150k or SDF partnerships. What changes the
level of the project is moving from proving CoreGuard can verify operations to
proving independent applications rely on it to protect their users' money."*

That sentence is the acceptance criterion for this quarter.

## The finding that mattered most

> `docs/EVIDENCE-MATRIX.md` documents Stellar Mainnet execution, while
> `packages/stellar/README.md` says `DRY_RUN / NOT_BUILT`, no direct submission,
> no funds movement — and `dex-gating.mjs` emits `PLAN_ONLY` plans it never
> sends.

**Accepted in full.** Both statements were true and the representation made them
look like a contradiction or an inflation. The fix is not a reworded sentence:
three axes (`code` / `execution` / `integration`) in
`docs/surface-status.json`, an `EVIDENCE-MATRIX.md` that cannot carry a combined
label, and `test/ci/surface-status.test.mjs`, which compares the registry to
`status()` in the code and fails the build if a combined label returns.
Record: `docs/STELLAR-STATUS-UNIFICATION.md`.

## Findings, severities and status

| # | Finding | Severity | Action | Status |
|---|---|---|---|---|
| F1 | Code and docs contradict each other on Stellar status | P0 | three-axis registry + EVIDENCE-MATRIX rewrite + guard test | **closed** |
| F2 | Portfolio too wide; no clear flagship | P0 | `docs/PRODUCT-FOCUS.md`; one flagship (`AGENT-GATE/1`), supporting set, parked list | **closed as a decision** |
| F3 | Test volume is presented as integration readiness | P0 | axes separated everywhere; `integration: NOT_BUILT` asserted in the guard | **closed** |
| F4 | No proof that tested policies govern the transaction actually signed and sent | P0 | `packages/agent-gate`: intent digest + envelope conformance, refuses drift and a batched second payment, receipt re-verified offline | **prototype built and tested; wallet signing NOT_BUILT** |
| F5 | No external adoption | P1 | stated as `ADOPTED: 0` in the matrix; pilot is Phase 2 of the roadmap, before polishing | **open** |
| F6 | No independent audit | P1 | stated as `NOT_PERFORMED`; budgeted in Tranche 2 with a published-findings requirement | **open** |
| F7 | A funding ask not justified line by line | P1 | `docs/SCF-BUILD-APPLICATION-V2.md`: tranche gates, judge-testable artifact per deliverable | **drafted** |
| F8 | Deadlines: SCF #46 closed 2026-11-09, one day before this review | P2 | no round is assumed; prepare the next invitation, confirm with the SCF team | **open, external** |

## Where this repository agrees with the reviewer's own framing

The reviewer distinguished *"separate experiments run with custom scripts"* from
*"an integrated capability a customer can use"* and said the recorded Mainnet
transactions are not in doubt. That is exactly the split the three-axis model
now encodes, and it is why the fix was a status model rather than a retraction.

The reviewer also named the strongest opportunity precisely: **verifiable
security infrastructure for AI-driven financial execution on Stellar.** The
flagship is now that, and only that.

## What is explicitly not claimed after this review

- No revenue, no customers, no partners, no funding, no completed audit.
- No production readiness and no "core Stellar infrastructure" status.
- No claim that a recorded mainnet execution is an integration.
- No claim that `VERIFIED` (offline recomputation) means safe.

## The one number that decides the next review

| Question | Today | Target by day 90 |
|---|---|---|
| External projects running the gate | **0** | **1** (named, with a committed pilot record) |
| Wallet signing path | NOT_BUILT | built and demonstrated in a browser session |
| Independent review | NOT_PERFORMED | findings received and published, fixed or named |
| Measured gate latency / cost | NOT_MEASURED | p50/p95 published with the harness |

If the first row is still 0 at day 90, the honest conclusion is that the
product is not yet wanted in the form built — and the roadmap says to publish
that finding rather than extend the timeline quietly.

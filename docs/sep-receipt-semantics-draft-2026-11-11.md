# SEP draft: fail-closed execution-receipt semantics for Stellar

**DRAFT instrument, 2026-11-11.** Authored under owner-delegated authority
(the owner granted full delegation this date). This is a DRAFT proposal only:
it is NOT submitted to any standards body, and any external submission
requires the owner's per-step sign-off per standing rule. Supersede with a
newer dated instrument rather than editing.

Reference implementation: CoreGuard (this repository) - L1 receipt semantics
`verifyReceipt(receipt, commitment, chain)` as specified in
`docs/verification-and-integration-platform-2026-09-26.md` §1, with the live
Soroban commitment anchor on Stellar mainnet as the working authority.

---

## Abstract

This proposal defines one verdict vocabulary and one fail-closed rule for
"did this execution happen as authorized?" questions on Stellar. Every
integrated action (an agent payment, a DEX swap, a dispute filing) carries a
deterministic receipt; a verifier answers exactly one of three outcomes -
`VERIFIED`, `MISMATCH`, or `UNKNOWN` with a named reason code - and an
ecosystem in which wallets, explorers, DEXes, and AI agents all speak the same
three outcomes can compose trust without each party inventing its own.

## Motivation

Today the Stellar ecosystem has no shared semantics for execution-verification
verdicts. Each wallet, explorer, and service answers "was this executed?" with
ad-hoc language, and - critically - most implementations share one defect:
**a verification that cannot run is silently treated as a pass, or its
uncertainty is laundered into a softer success.** The most dangerous verdict
is not the failure; it is the unnamed green check ([C30]/[C31] lesson class,
measured repeatedly in this repository's own history).

CoreGuard has run these semantics in production-shaped code with a live
mainnet anchor (contract `CCKA2GYVILX7YZVSXGVIHOPNLTRBBF2SSWKBTQBIE7M67N5N2QMMXPSP`,
third-party-listed on stellar.expert) and a CI-enforced rule that the
documentation must restate the machine exactly. The proposal generalizes that
working surface into a standard any project can implement without CoreGuard.

## Specification

### 1. The receipt

A receipt is a canonical, byte-determinable record of one authorized action:
what was authorized (policy/allowlist/deadline/size judgment made BEFORE
submit), what happened (the execution record), and where it landed
(`txHash` + network). Its digest is computed over its canonical byte form;
two verifiers given the same receipt derive the same digest.

### 2. The verdict function

`verifyReceipt(receipt, commitment, chain) -> { verdict, code }` where `chain`
is a chain authority able to look up a `txHash`. The verdict turns on
**whether anyone was asked**, and there are exactly three outcomes:

| Verdict | Code | Meaning |
|---|---|---|
| `UNKNOWN` | `NO_CHAIN_EVIDENCE` | No authority was passed at all - nobody was asked. Absent evidence, never absolution. |
| `MISMATCH` | `TX_NOT_FOUND` | An authority WAS asked and does not know the claimed `txHash`. The only contradiction verdict - the system's strongest signal. |
| `UNKNOWN` | `EVIDENCE_INCONSISTENT` | The receipt is too malformed to ask an authority with. Absent evidence again - never a silent pass. |
| `VERIFIED` | (none) | The authority confirmed the `txHash` and the derived commitment matches. |

### 3. The fail-closed rule

1. `UNKNOWN` is never success. It may never be rendered by any wallet,
   explorer, or service as a checkmark, a pass, or an absence of warning.
2. `VERIFIED` requires an authority. A structurally perfect receipt nobody
   confirmed against a chain is `UNKNOWN/NO_CHAIN_EVIDENCE`, not `VERIFIED`.
3. `MISMATCH` is the loudest verdict, not the quietest: an authority that was
   asked and contradicted the claim must be surfaced as a contradiction,
   never folded into a generic "unverified" bucket alongside cases where
   nobody asked.
4. `NOT_APPLICABLE`/`ABSENT` never count as success for a mandatory check;
   a missing mandatory premise aborts, it does not skip.

### 4. Offline re-derivation

Any party must be able to re-derive the verdict from the receipt's own bytes
plus a committed canonical tree, without network access beyond the optional
authority lookup: the receipt records the raw wire data it is derived from -
never a client-library proxy object whose scalar fields may silently carry
callables instead of values - and a corroborating arithmetic identity
(amounts conserved to the base unit) belongs in the artifact so a proxy
substitution cannot lie silently.

### 5. Anchoring (optional strengthening)

A commitment anchor (Soroban contract) may bind a receipt digest on-chain,
giving the authority a second, independent path: the verdict may then be
re-derived from the anchor's stored digest alone. Anchoring strengthens
`VERIFIED` but is never a substitute for the three-outcome rule itself.

## Rationale

- **Three outcomes, not two.** Compressing the rule to "format-valid but
  unconfirmed = UNKNOWN" loses the `MISMATCH` branch - the strongest signal
  the system produces - behind its weakest verdict. Every compressed
  restatement this repository has ever shipped was measured to drop exactly
  that branch, which is why the rule here is spelled out per-branch.
- **Named reason codes.** A verdict a human cannot distinguish ("unknown"
  vs "unknown") cannot be composed by an agent, and agents are the primary
  new class of Stellar transactor.
- **Fail-closed by default.** The standard must make the silent pass the
  hardest thing to build, not the easiest.

## Testability

Each verdict is reproducible from a clean clone: the negative cases (no
authority; asked-and-contradicted; malformed evidence) are ordinary unit
tests, and the documentation of any implementation claiming conformance is
required to restate the three branches in the same paragraph - enforced in
this repository by a contract test that derives the codes from the module at
run time and fails the build when prose and machine diverge.

## Copyright

To be finalized under the license terms used by Stellar Enhancement
Proposals (Apache 2.0 pattern), on acceptance for submission.

# CoreGuard — Stellar institutional & SCF readiness audit

**Dated:** 2026-11-11 · **Method:** direct reading of the committed tree
(`docs/EVIDENCE-MATRIX.md`, `docs/surface-status.json`, `docs/claims-registry.json`,
`docs/state-snapshot.json`) — not the marketing pages. Every number below is
derived from a committed artifact; none is estimated.

**This document is not a funding claim.** It records what exists, what an SCF
reviewer is likely to accept, what they are likely to challenge, and the exact
work that closes each gap. No award, no partnership, and no adoption is asserted.

## 1. The three axes, measured

| Axis | What it answers | CoreGuard today |
|---|---|---|
| Code | Does the implementation exist? | Yes — 15 surfaces in `surface-status.json`, all `NOT_BUILT` on integration |
| Execution | Was it actually run? | Yes, with artifacts: Soroban anchor deployed and invoked on mainnet, DEX-GATE/1 against the real book, one signed funded XLM→USDC swap, a real testnet envelope signature carried through the Freighter adapter by a local keypair |
| Adoption | Does an external project use it? | **Zero.** No integrator, no pilot, no external verifier |

The third axis is the whole commercial story. Everything else is evidence that
the first two are honest.

## 2. What a Stellar reviewer will respect

- **Fail-closed by construction.** `UNKNOWN` never becomes `ALLOW`; an unreadable
  mandate yields `HOLD`; a refused decision cannot carry a submitted execution.
- **Receipts a third party can recompute.** `verify-cli.mjs` re-derives the gate
  decision, both digests, and conformance from committed bytes, with exit codes
  `0/2/3/4` that a script can branch on.
- **Declared ceilings.** Every artifact states what it does *not* prove. That is
  rare, and it is what makes the numbers believable.
- **A real tamper matrix.** `test/integrations/agent-gate-field-tamper.test.mjs`
  flips one field at a time — destination, amount (one stroop), asset, source,
  memo — and requires the transaction hash to change *and* conformance to name
  the field. Structural attacks (a second payment, a non-payment op, a wrong
  network, a fee-bump) are refused by name.
- **Deterministic replay.** A committed vector pins canonical bytes, digests and
  the Ed25519 signature for a pinned clock, so Node 22 and Node 24 must agree
  byte for byte (`test/fixtures/agent-gate/canonical-vectors.json`).

## 3. What an SCF reviewer will challenge

| # | Challenge | Honest answer | Closing work |
|---|---|---|---|
| C1 | "Who uses it?" | Nobody external. Adoption axis is 0. | One named pilot: a wallet, DEX, or agent platform running the gate in front of a real signing path |
| C2 | "A real wallet never signed." | True. `agent-gate-freighter` is `BUILT_UNVERIFIED`; the testnet signature came from a local keypair behind the adapter interface | Install Freighter, sign in the shipped browser demo, let the attest route write the artifact and promote the surface |
| C3 | "Tests are not an audit." | Correct. `independentAudit: NOT_PERFORMED` | External review scoped to the authorization→signing boundary |
| C4 | "The repo is broad." | It spans Core 1116, Stellar, Pi, and agent payments | Present one product: the agent payment gate; treat the rest as supporting surfaces |
| C5 | "Does verification replace Soroban auth?" | No. It is an independent layer *in front of* signing; it never replaces protocol-level authorization | Say exactly that in the application and the demo |
| C6 | "Is the demo reproducible?" | Yes, offline and in-browser, no key required | Record the 6-step demo (below) as the submission asset |

## 4. The demo that answers the objection

One scenario, end to end, in front of the reviewer:

1. The agent proposes a payment (amount, destination, asset, memo).
2. The gate evaluates the mandate → `ALLOW`, with the intent digest printed.
3. The envelope is built and handed to the wallet; the wallet signs.
4. An attacker flips the destination and signs the mutated bytes.
5. Conformance returns `MISMATCH` naming `destination`; the hash differs from
   the authorized one — the refusal is mechanical, not a policy opinion.
6. A receipt is issued for the clean run and verified offline by a CLI that has
   never talked to CoreGuard's process.

Why this lands: it demonstrates the *separation* — approved, executed, proven —
in ninety seconds, with a failure case that the reviewer can reproduce.

## 5. Priority order (highest risk first)

| Priority | Work | Why first |
|---|---|---|
| 1 | Canonicalization + signed-envelope verification (done: threat model, AC-01…AC-12, replay vector) | It is the security claim the product is sold on |
| 2 | Real Freighter extension signature (promotion path exists; the signature does not) | Turns `BUILT_UNVERIFIED` into `BUILT` with an artifact, not a paragraph |
| 3 | One DEX or wallet integration on testnet | Moves the adoption axis off zero |
| 4 | Property-based / fuzz testing over the envelope decoder | Decoders are where parsers die; a fuzzed `fromXDR` path is cheap credibility |
| 5 | Foundry invariant tests on the EVM evidence registry | Access control and replay invariants on the Core 1116 side |
| 6 | External security review | Converts "tested" into "reviewed" |

## 6. Funding posture (stated plainly)

The SCF Build Award is up to 150,000 USD-equivalent in XLM, paid in milestones.
A credible application here is **milestone-scoped**, not "the maximum", and it
should be read against the gap table above:

- milestone 1 — extension-verified signing + decoder fuzzing + independent review
  of the authorization boundary;
- milestone 2 — one named integrator in production-adjacent use (testnet pilot
  with published evidence);
- milestone 3 — SDK hardening, latency/cost measurements, and an operations
  document (SLA, limits, support).

Each milestone must ship an artifact this repository can verify — a receipt, a
tamper-matrix run, a signed extension attestation, an integration log — because
that is the only kind of claim this project makes.

## 7. Naming discipline

Reviewers read terminology before they read code. "Killer feature" and similar
labels read as marketing to protocol engineers; the same content phrased as a
capability ("intent-to-evidence binding", "pre-signature conformance gate")
reads as engineering. New documents use the engineering wording; the ladder
pages are a content decision for the owner, not an automatic rewrite of
published material.

## 8. What must never be claimed

- That CoreGuard replaces Soroban authorization or the Stellar protocol.
- That `VERIFIED` means safe, audited, or confirmed on-chain.
- That any external project, fund, or institution has adopted it.
- That an independent audit has happened.
- That a real Freighter extension has signed.

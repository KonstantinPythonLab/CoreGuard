# Product focus — one flagship, not forty equals (2026-11-10)

**The criticism.** The repository carries a wide portfolio (Stellar, Core DAO,
Pi Network, escrow arbitration, People's Court adapters, x402, badges, seven
standards, a dozen verification layers), presented with roughly equal weight.
A reader cannot tell what the product is, and a funding committee cannot tell
what it is paying for. Scope spread is now a first-order risk, not a feature.

**The decision.** One flagship, a small set of supporting surfaces that exist
only because the flagship needs them, and an explicit parked list that is not
being developed.

## Flagship

**`AGENT-GATE/1` — verifiable execution control for AI-driven payments on Stellar.**
Built on `packages/agent-gate`, specified in `docs/AGENT-PAYMENT-GATE.md`,
anchored by the Soroban commitment contract on Stellar mainnet.

Why this one: it is the only surface where an external party (a wallet, a
Soroban DApp, a payment platform) can integrate a check that does not exist
elsewhere — *the envelope that was signed is the intent that was authorized* —
and it produces evidence that survives an auditor's questions. Every other
surface either supports it or is a separate product with its own roadmap.

## Supporting (kept because the flagship needs them)

| Surface | Why it stays |
|---|---|
| `packages/evidence`, `packages/canonical`, `packages/intent` | the receipt format and canonical hashing the gate depends on |
| `packages/independent-verifier` | the "verify without trusting us" claim |
| `packages/policy`, `packages/mandate`, `packages/firewall` | mandate evaluation primitives |
| `soroban/commitment-anchor` | the on-chain anchor for receipts (mainnet, executed) |
| `packages/stellar` (adapter, DEX gating) | Stellar reads and preflight the gate calls |
| `docs/CLAIMS-TAXONOMY.md`, `surface-status.json`, release gate | the honesty machinery that keeps the flagship's claims checkable |

## Parked (documented, not developed further this cycle)

`packages/pi-network`, `packages/pi-killer`, `packages/peoples-court-adapter`,
`packages/agentic-escrow-arbitration`, `packages/x402`, `packages/badge`,
`packages/saas-gateway`, `packages/coredao-killer`, `packages/stellar-killer`,
`packages/coreguard-trinity`, `packages/recovery`, and the seven standards that
are not CGEP/1, EVP/1 or the agent-gate pair.

Parked means: no new work, no new claims, kept building and tested so nothing
rots. It does not mean deleted, and it does not mean "coming soon".

## What this changes in practice

1. **Every funding document asks for the flagship.** `docs/SCF-BUILD-APPLICATION-V2.md`
   supersedes the earlier $50k application and budgets the gate, its signer
   path, its audit and its pilot — nothing else.
2. **Every "what do you do?" answer is one sentence**, and the portfolio becomes
   supporting evidence rather than the pitch.
3. **New work is admitted only if it makes the gate adoptable.** A new adapter,
   a new standard, or a new chain is out of scope until the gate has a pilot.

## The risk this creates, stated plainly

A single-product story is only credible if that product reaches an external
user. If the 90-day plan ends with `integration: NOT_BUILT` still true, the
narrower focus has bought nothing. `docs/ROADMAP-90-DAYS-2026-11.md` therefore
puts the pilot before the polishing work, and treats an unsuccessful pilot
search as a finding to publish rather than a delay to hide.

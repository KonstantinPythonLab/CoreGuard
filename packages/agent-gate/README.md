# AGENT-GATE/1 — Stellar agent payment gate (offline prototype)

**Honest status: `OFFLINE_PROTOTYPE` · `chainSubmission: NOT_PERFORMED` · `integrationStatus: NOT_BUILT`.**
No wallet signing integration, no Horizon/Soroban call, no funds movement, no external adoption.

## What this surface is

A gate that a financial AI agent must pass before anything is signed, plus a
signed evidence receipt that a third party verifies without trusting CoreGuard.

| Step | Function | Refusal mode |
|---|---|---|
| Mandate is readable | `validatePolicy()` | unreadable mandate ⇒ `HOLD`, never "no limits" |
| Intent is decidable | `evaluate()` | unknown field / bad schema ⇒ `DENY`; undecidable fact ⇒ `HOLD` |
| Intent is bound | `intentDigest()` | domain-separated canonical hash |
| Envelope conforms | `checkConformance()` | extra op, other recipient, other amount ⇒ `MISMATCH` |
| Decision is evidenced | `issueReceipt()` | Ed25519, hash-chained, carries raw intent + mandate + envelope |
| Evidence is checkable | `verifyReceipt()` / `verifyChain()` | re-derives decision and conformance from bytes |

The property the surface exists to demonstrate: **the gate does not stop at
checking the proposal — it refuses an envelope that diverges from the intent it
authorized**, including a batch that buries a second payment.

## What it does not do

- **No signer.** Keys stay with the wallet; this module never accepts one.
  Freighter integration is `NOT_BUILT` (planned, Phase P1).
- **No submission.** There is no network call anywhere in the package.
- **No chain claim.** `VERIFIED` from `verifyReceipt()` means "these bytes
  recompute consistently". It is not a ledger read and not an audit.

## The signed envelope is the unit

`adapters/stellar-xdr.mjs` builds unsigned envelopes and decodes signed ones;
`adapters/freighter.mjs` asks the wallet to sign and refuses a wallet that
returns different bytes; `verify-cli.mjs` recomputes everything later.

| Refusal | Where |
|---|---|
| wallet returns another transaction | `REFUSED` (transaction hash compared) |
| wallet returns nothing / unsigned | `REFUSED` |
| envelope adds a second payment | `MISMATCH` / `MULTI_OP_DIVERGENCE` |
| fee-bump envelope | refused by name |
| on-disk envelope is not the receipt's | `TAMPERED` / `ENVELOPE_NOT_THE_ONE_IN_THE_RECEIPT` |

An envelope carries no network: the passphrase enters the transaction hash, so
testnet bytes cannot be replayed as mainnet — and the caller must be right about
the network it asks for.

## Run it

```bash
node packages/agent-gate/demo.mjs
```

Fourteen fixed cases (allow · per-tx cap · recipient · memo · expiry · window ·
unknown field · honest envelope · drifted envelope · batched envelope · receipt
tamper · chain break). Exit 1 if the verdict matrix drifts, so the demo doubles
as a self-check.

```bash
node packages/agent-gate/demo/cli-flow.mjs
```

The full offline loop: gate → build → wallet signs → decode → conformance →
receipt → verify, including the drift, batch and wallet-swap refusals. The wallet
is a local keypair in a Freighter-shaped object; the output states that a real
extension is not exercised.

## Verify a receipt yourself

```js
import { verifyReceipt } from "./packages/agent-gate/index.mjs";

const result = verifyReceipt({ receipt, publicKeyPem });
// VERIFIED · MISMATCH · TAMPERED · UNKNOWN — never a boolean
```

Verification needs only the receipt JSON and the operator's public key. No
CoreGuard server, database or API is consulted.

## Status provenance

The gate inherits the repo-wide two-axis status model in
[`docs/STELLAR-STATUS-UNIFICATION.md`](../../docs/STELLAR-STATUS-UNIFICATION.md):
*execution* (what has been run and evidenced) is separate from *integration*
(what an external project can adopt). This package is executed-by-test and
NOT integration-ready, and both facts are stated rather than averaged.

## Standards

`AGENT-GATE/1` (decision envelope) · `AGENT-RECEIPT/1` (evidence receipt) ·
`AGENT-POLICY/1` (agent mandate).

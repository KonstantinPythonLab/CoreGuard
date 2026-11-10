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

## Run it

```bash
node packages/agent-gate/demo.mjs
```

Eleven fixed cases (allow · per-tx cap · recipient · memo · expiry · window ·
unknown field · honest envelope · drifted envelope · batched envelope · receipt
tamper · chain break). Exit 1 if the verdict matrix drifts, so the demo doubles
as a self-check.

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

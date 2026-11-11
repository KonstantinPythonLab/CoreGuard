# Signed-envelope threat model — "authorized ≠ signed ≠ submitted"

**Scope:** the AGENT-GATE/1 authorization path (`packages/agent-gate/`) from the
moment a mandate authorizes an intent to the moment a signed Stellar envelope is
handed to a submitter. It answers one question and refuses to answer others:

> Is the transaction about to be signed exactly the transaction that was
> authorized — and can a third party prove that offline?

**Status (three axes, per `docs/EVIDENCE-MATRIX.md`):**

| Axis | State |
|---|---|
| Code | BUILT — builder, decoder, conformance, receipts, verifier CLI |
| Execution | TEST_EXECUTED — field-by-field tamper matrix, receipt recomputation, real testnet signature carried through the adapter by a local keypair |
| Integration | NOT_BUILT — no wallet, DEX, or agent platform has embedded it; a real Freighter extension has never signed here |

## 1. What is protected

| Asset | Why it matters | Broken when |
|---|---|---|
| The authorized intent | It is the only object the human/agent actually approved | A different payment can be signed under the same approval |
| The signed envelope | It is what the network executes | Bytes can be swapped between approval and signing |
| The evidence receipt | It is what a third party reads later | A receipt can describe something other than what happened |
| Time | An approval is only valid inside its window | An expired intent is executed because a clock was assumed |

**Non-assets (explicitly out of scope):** private keys, wallet custody, key
recovery, price/quote correctness, whether the approved payment was a *good
idea*, and anything about funds once the network accepts a transaction.

## 2. Adversaries and the boundary they attack

| # | Adversary | Capability assumed | Where the control lives |
|---|---|---|---|
| T1 | Compromised wallet or extension | Holds the key, can sign arbitrary bytes | `requestSignature()` compares the returned transaction hash to the prepared one; conformance re-decodes the result |
| T2 | Hostile server / submitter | Can replace the envelope before broadcast | Conformance runs on the *signed* bytes, not on a description of them |
| T3 | Batch smuggler | Adds a second payment beside the authorized one | Exactly-one-operation rule, `MULTI_OP_DIVERGENCE` |
| T4 | Type swapper | Substitutes a non-payment operation | `OPERATION_TYPE_MISMATCH`; unsupported ops are carried, never ignored |
| T5 | Amount/asset fiddler | Changes one stroop, or swaps XLM for a token | Amount compared in stroops (never floats); asset compared as a string identity |
| T6 | Memo stripper | Removes or alters a required memo | Memo compared field-by-field; a mandate can require one (`MEMO_REQUIRED`) |
| T7 | Cross-network replayer | Re-submits testnet bytes as mainnet | The caller supplies the network; the passphrase enters the hash, so the hash differs and conformance refuses |
| T8 | Fee-bump payer | Changes who pays the fee | Fee-bump envelopes are refused by name |
| T9 | Replay across approvals | Reuses an old authorization for a new intent | Domain-separated `intentDigest` bound into the receipt; a present-but-different digest is a mismatch |
| T10 | Receipt forger | Writes their own receipt claiming VERIFIED | `verifyReceipt()` re-runs the gate, re-derives digests, recomputes conformance and checks the Ed25519 signature |

## 3. Acceptance criteria (each one is a test, not a promise)

| ID | Criterion | Where it is proven |
|---|---|---|
| AC-01 | The unauthorized baseline verifies, so the matrix cannot pass by refusing everything | `test/integrations/agent-gate-field-tamper.test.mjs` |
| AC-02 | Destination, amount, asset, source, and memo each fail alone | same file, per-field matrix |
| AC-03 | Every tampered envelope also changes the transaction hash | same file (`built.txHash !== authorized.txHash`) |
| AC-04 | A wrong network reading is refused, never silently accepted | same file |
| AC-05 | A second payment is `MULTI_OP_DIVERGENCE` | same file |
| AC-06 | A non-payment operation is `OPERATION_TYPE_MISMATCH` | same file |
| AC-07 | A receipt recording a tampered envelope is not `VERIFIED` | same file, evidence-layer case |
| AC-08 | Same inputs + pinned clock → identical bytes, digests and signature | `test/integrations/agent-gate-replay-determinism.test.mjs` + committed vector |
| AC-09 | Key order and absent optional fields cannot change the digest | same file |
| AC-10 | One stroop / one field / one mandate field changes the digest | same file, controls |
| AC-11 | A verifier reproduces a `VERIFIED` receipt offline from bytes alone | same file |
| AC-12 | A wallet that returns different bytes is refused before conformance | `test/integrations/agent-gate-envelope.test.mjs` |

The deterministic vector lives at `test/fixtures/agent-gate/canonical-vectors.json`.
It contains no timestamp and no runtime version on purpose: CI runs the same test
on Node 22 and Node 24, and the vector is what makes those two runs comparable.

## 4. What this model does NOT prove

- **Consent.** A signature proves a key signed bytes; it does not prove the human
  read them. Phishing an intent is out of scope.
- **Custody.** No key is accepted, stored, or derived by this package.
- **Chain truth.** `VERIFIED` is an offline recomputation. It is not a ledger
  read, not confirmation, not an audit, and not a statement about funds.
- **Contract correctness.** A conforming envelope can still call a contract that
  behaves badly; only the payment fields are bound here.
- **Extension reality.** The Freighter adapter is exercised with an injected
  wallet and with a local keypair behind its interface. A real extension has
  never signed here, so `agent-gate-freighter` stays `BUILT_UNVERIFIED`.

## 5. Reproduce

    npm test                                                    # the whole bond
    node --test test/integrations/agent-gate-field-tamper.test.mjs
    node --test test/integrations/agent-gate-replay-determinism.test.mjs
    node packages/agent-gate/demo/cli-flow.mjs                   # gate → sign → verify

No network, no key, no money: every case builds and signs throwaway testnet
envelopes in-process.

# AGENT-GATE/1 — the one Stellar product (specification + honest status)

**Product line:** *Verifiable execution control for AI-driven payments on Stellar.*

One sentence: a financial agent cannot move money unless its proposal fits a
signed mandate, and the envelope the wallet signs is proven to be the same
object that was authorized — with an evidence receipt a third party re-derives
without trusting CoreGuard.

**Status (three axes, per `docs/surface-status.json`):**
`code: BUILT` · `execution: TEST_EXECUTED` · `integration: NOT_BUILT`.
No wallet signer, no submission, no chain read, no external adopter, no audit.

---

## 1. The scenario the product exists for

1. A user grants an agent a mandate: *up to 100 XLM per payment, 250 XLM this
   month, only these recipients, only XLM, expires in 10 minutes.*
2. The agent proposes: *80 XLM to an allowlisted merchant.*
3. The gate evaluates the proposal against the mandate.
4. Out of policy → **DENY**. Cannot decide → **HOLD**. In policy → **ALLOW**.
5. On ALLOW the intent is hashed and handed to the wallet for signing; the
   private key never leaves the wallet.
6. The signed envelope comes back and is compared to the authorized intent.
   A different recipient, a different amount, or a **second payment hidden in
   the same envelope** is a **MISMATCH** and the submission is refused.
7. A signed, hash-chained receipt records the decision and the envelope, and
   anyone can verify it offline.

Step 6 is the part the market is missing. Pre-signature checks alone stop a bad
proposal, not a bad envelope.

## 2. Verdicts and reason codes

| Verdict | Meaning | Examples |
|---|---|---|
| `ALLOW` | every check passed | in-policy amount, recipient, asset, unexpired |
| `DENY` | a hard rule failed | over per-tx cap, recipient not in mandate, expired, unknown intent field |
| `HOLD` | a fact is missing, so no one may sign | unreadable mandate, no expiry, memo required but absent |

Fail-closed rule: an unreadable mandate produces `HOLD`, never "no limits"; a
missing envelope produces `UNKNOWN`, never a pass. Every refusal names a reason
code (`PER_TX_LIMIT_EXCEEDED`, `MULTI_OP_DIVERGENCE`, `INTENT_DIGEST_MISMATCH`,
…) — no bare booleans.

## 3. Evidence receipt

`AGENT-RECEIPT/1` contains the raw intent, the raw mandate and the raw envelope,
the decision with its checks, the conformance result, domain-separated digests,
an Ed25519 signature and the previous receipt's id (hash chain).

`verifyReceipt({ receipt, publicKeyPem })` re-derives the decision and the
conformance verdict from those bytes and compares them to what was recorded. A
stored `ALLOW` the mandate does not support is refused as
`DECISION_NOT_REPRODUCIBLE`; an edited amount is refused as
`SIGNATURE_INVALID`. `verifyChain()` refuses a sequence gap or a broken link.

**Ceiling, stated in the API:** this is offline recomputation. It is not a
ledger read, not an audit, and not a statement about funds.

## 4. What exists today, and what does not

| Piece | State |
|---|---|
| Mandate validation, gate decision, reason codes | built, tested offline |
| Intent digest and envelope conformance (incl. multi-op divergence) | built, tested offline |
| Ed25519 receipts, chain, independent verifier | built, tested offline |
| Hardened fixed-point amounts (7 dp, BigInt, no floats) | built, tested |
| Wallet signing (Freighter) | **NOT_BUILT** — no browser wallet in CI, no credential path |
| Horizon / Soroban submission | **NOT_BUILT** — deliberately absent from this package |
| Soroban on-chain policy registry | **PLANNED** — contract not written |
| External pilot | **NOT_BUILT** — 0 named partners |
| Independent audit | **NOT_PERFORMED** |
| Latency/cost benchmark of the gate itself | **NOT_MEASURED** |

## 5. The signed envelope, not the proposal

Step 6 used to be tested against a hand-written execution object. It now runs on
what a wallet actually signs:

1. `buildPaymentEnvelope()` builds an **unsigned** envelope — it refuses a
   secret key and demands a sequence rather than inventing one.
2. `requestSignature()` hands that XDR to a Freighter-shaped wallet and reads
   back signed bytes. The gate never holds a key.
3. `decodeEnvelope()` turns the signed XDR into operations: payments and their
   memo are read; any other operation is carried as `unsupported` and refused by
   conformance rather than ignored.
4. `checkConformance()` compares those operations to the authorized intent.
5. `issueReceipt()` records the decision and the signed envelope;
   `verifyReceipt()` / `verify-cli.mjs` recompute both later.

| Case | Result |
|---|---|
| Wallet returns a **different** transaction than the prepared one | `REFUSED` — compared by transaction hash |
| Wallet returns nothing, or an unsigned envelope | `REFUSED` |
| Envelope carries a second payment | `MISMATCH` / `MULTI_OP_DIVERGENCE` |
| Envelope is a fee-bump (who pays changed) | refused by name, not half-understood |
| Envelope on disk is not the one in the receipt | `TAMPERED` / `ENVELOPE_NOT_THE_ONE_IN_THE_RECEIPT` |

**A fact worth knowing:** a Stellar envelope carries no network field. The
passphrase is supplied by the caller and enters the transaction hash, so a
testnet signature cannot be replayed as mainnet — but the caller must be right
about which network it asks for.

### Measured performance

`docs/evidence/agent-gate-bench.json` — 2000 in-process samples on
node v24.18.0, win32/x64, 12 CPUs (2026-11-10):

| Operation | p50 | p95 |
|---|---|---|
| `evaluate` (mandate gate) | 15 µs | 51 µs |
| `checkConformance` | 2 µs | 8 µs |
| `issueReceipt` (Ed25519) | 276 µs | 744 µs |
| `verifyReceipt` | 317 µs | 850 µs |

**Read the JSON, not the table:** in-process timings move with machine load. The
committed artifact carries the machine description and the sample count, and it
is the record; the table above is a convenience copy of it.

**Ceiling:** in-process, single-threaded, offline. Not a deployed-service
latency, not chain confirmation, not throughput. Reproduce on your own machine
with `node scripts/agent-gate-bench.mjs --iterations 2000`.

### Verify a receipt yourself

```text
node packages/agent-gate/verify-cli.mjs --receipt receipt.json --key operator.pub --xdr signed.xdr
```

Exit codes: `0` VERIFIED · `2` the receipt faithfully records a **refused**
execution · `3` TAMPERED · `4` UNKNOWN (missing or unreadable input).

(Example paths, not committed fixtures: a runnable receipt would have to ship an
operator private key, which this repo does not do. The exit-code behaviour is
exercised in `test/integrations/agent-gate-envelope.test.mjs`.)

## 6. Run it

```bash
node packages/agent-gate/demo.mjs
```

Fourteen fixed cases, exit 1 on any drift: allow, per-tx cap, recipient, memo,
expiry, window cap, unknown field, honest envelope, drifted envelope, batched
envelope, receipt verification, amount tampering, intact chain, broken chain.

```bash
node packages/agent-gate/demo/cli-flow.mjs
```

The full signed-envelope loop, offline: gate → build → wallet signs → decode →
conformance → receipt → verify, plus the drift, batch and wallet-swap refusals.
The wallet is a local keypair in a Freighter-shaped object, and the output says
so: **a real extension is not exercised here.**

## 7. What "done" means for the next phase

The gate becomes adoptable only when all four exist:

1. **Freighter signing path** — the envelope is signed in the user's wallet and
   returned; the gate never sees a key. Deliverable: a browser demo a judge can
   run, showing ALLOW and MISMATCH in the same session.
2. **Measured performance** — p50/p95 gate latency and cost per verification,
   published with the machine that produced them.
3. **One external pilot** — a Soroban DApp or wallet that calls the gate in its
   own flow, with a committed pilot record naming it.
4. **Independent review** — a third-party reviewer's signed findings, published
   with the fixes, or the finding left open and named.

Until then the honest label stays `integration: NOT_BUILT`, and the roadmap in
`docs/ROADMAP-90-DAYS-2026-11.md` treats those four as the only work that
changes it.

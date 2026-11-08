# Pi Network mainnet transaction proof (English · العربية)

> Pi Network mainnet is the next major milestone. This document is a prepared proof template for Pi mainnet execution proofs. Nothing is claimed on Pi mainnet yet; the template is ready so that once Pi mainnet is live, the first execution proof can be produced the same way Core DAO and Stellar proofs were produced: intent → policy → commitment → receipt → independent verifier → on-chain commit.

## What this template prepares

When Pi mainnet is live, CoreGuard will produce a Pi mainnet execution proof the same way it produces Core DAO and Stellar proofs:

1. **Intent + policy** are declared and committed before execution.
2. **Execution** is captured from Pi mainnet.
3. **Receipt** is pinned to a Pi mainnet block hash.
4. **Deterministic replay** is run, producing a replay hash, a diff and a report: MATCH / MISMATCH / UNKNOWN. UNKNOWN stays HELD.
5. **Independent verifier** (JS / Rust-WASM / Python) runs the same check with no RPC, no trust.
6. **On-chain commit** is placed on a Pi mainnet commitment anchor, so anyone can replay the proof on Pi mainnet.

The template below records the structure of that proof, the fields it will contain and the verifier steps it will run. All values will be filled once Pi mainnet is live.

## Proof template (prepared, not live)

| Field | Placeholder | Notes |
|-------|-------------|-------|
| Network | Pi mainnet | To be filled once Pi mainnet is live |
| Transaction | `<tx hash>` | Pi mainnet transaction hash, to be filled once live |
| Block | `<block number>` | Pi mainnet block number, to be filled once live |
| Sender | `<sender address>` | Pi mainnet sender address, to be filled once live |
| Recipient | `<recipient address>` | Pi mainnet recipient address, to be filled once live |
| Value | `<amount> Pi` | Pi mainnet transaction value, to be filled once live |
| Commitment anchor | `<anchor address>` | Pi mainnet commitment anchor address, to be filled once live |
| Receipt ID | `<receipt id>` | Pi mainnet receipt ID, to be filled once live |
| Commitment | `<commitment>` | Pi mainnet commitment, to be filled once live |
| Proof ID | `<proof id>` | Pi mainnet proof ID, to be filled once live |
| Intent ref | `<intent ref>` | Pi mainnet intent reference (EIP-712 style), to be filled once live |

## Verifier steps (prepared)

When Pi mainnet is live, the verifier runs the same steps used on Core DAO and Stellar:

1. **WS-1 authorisation** — recover the signer from the Pi mainnet transaction; verify the intent was signed by the recovered signer.
2. **Policy** — check VALUE, TARGET and DEADLINE (and any other active policy) against the declared intent and the observed execution.
3. **L1 verification** — verify the receipt integrity on Pi mainnet.
4. **Registry anchor** — verify the on-chain commitment anchor on Pi mainnet, preferably across two independent Pi mainnet RPC endpoints once available.
5. **TRACE_HASH** — not run unless a trace is provided; never fabricated.
6. **B-EXEC-2 selector** — not run on a plain value transfer (no calldata); only relevant for contract calls.
7. **B-EXEC-5 decision record** — not run unless a frozen PRE record is available; never fabricated.

Each step produces one of: OK / NA / NOT_RUN (with the reason). UNKNOWN stays HELD.

## How to reproduce it (once Pi mainnet is live)

```bash
git clone https://github.com/coreguard-global/CoreGuard
npm install && npm run demo:90s:live
```

Read-only. No funds, no keys. Full instructions will be in `docs/PI-MAINNET-TX.md` once Pi mainnet is live.

## How to verify it independently

Once Pi mainnet is live:

- Check the Pi mainnet transaction, block and addresses on the Pi mainnet explorer.
- Run the same verifier the repository ships: `npm run demo:90s:live` (Pi Network adapter) to re-derive the verdict offline.
- Verify the on-chain commitment anchor on Pi mainnet, ideally across two independent Pi mainnet RPC endpoints once available.

## Cross-network picture

| Network | Status | Anchor | Proof artifact |
|---------|--------|--------|----------------|
| Core DAO | LIVE — EvidenceRegistry on chain 1116, verified across two independent RPCs | Live on-chain | Proof Artifact #1: agent execution, L1 VERIFIED |
| Stellar | LIVE — Soroban anchor deployed, first funded swap confirmed, first commit CALL invoked | Soroban on-chain | First funded swap: 4.0598146 XLM → 0.6306239 USDC, ledger 65,338,112 |
| Pi Network | Prepared / DRY_RUN — proof template ready, anchor prepared for Pi mainnet launch | Prepared for Pi mainnet | Not live yet — no Pi mainnet proof until Pi mainnet is live |

## What is not claimed

- No Pi mainnet execution proof is claimed yet. The template is prepared; nothing will be filled or claimed until Pi mainnet is live.
- No Pi Browser verification overlay is live on all Pi DApps yet.
- No Pi ecosystem partners are claimed yet.
- No Pi Network funding, incubation or hackathon prize is claimed yet.
- No revenue, customers, audits or third-party endorsements are claimed for Pi Network until evidence exists.
- VERIFIED ≠ SAFE. The execution-proof layer proves what was authorised and what executed; it does not guarantee the transaction was profitable, safe or free of all exploits.

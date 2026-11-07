CG-COMMITMENT-ANCHOR/1 — Soroban commitment anchor (Stellar)

The L1 commitment anchor: a minimal, deterministic on-chain anchor that
binds a CoreGuard commitment id to its content hash at ledger sequence,
so an execution receipt's truth can be proven against the Stellar ledger.

## The deployed fact (never restated, always verifiable)

The instance on mainnet contract id
`CCKA2GYVILX7YZVSXGVIHOPNLTRBBF2SSWKBTQBIE7M67N5N2QMMXPSP` (deployed by
`GDJ3CRNLNDZ4AVWGPUG7DBC5BIAGMIONOONZGB5FSYAY44ZHOIPRKY7U`) serves the
ABI family `CG-COMMITMENT-ANCHOR/1` and protects the first owner-authorized
commit CALL made 2026-11-06:
`tx 69044807410f65027c1227f4e525ad83f23a6cb1a2bb79790d82849c5dbc9fec`,
ledger 65337373, `commit(proofId, commitment)` with the exact pair
`{hash: 0xc0dbfb45…1052}` — read back on-chain byte-exactly.
The artifact committed at `artifacts/cg_commitment_anchor.wasm` IS the
binary the live deployed instance runs. It is never rebuilt in place; a
next-deploy build of the source below is owner-gated.

## Legacy lane (permissionless — semantics unchanged)

- `commit(id: BytesN<32>, hash: BytesN<32>) -> Result<u32, CgError>` anchors
  a commitment id to its content hash at the current ledger sequence.
- `read(id) -> Option<Anchor>` returns the anchored record if present.
- `assert_anchored(id, hash) -> Result<u32, CgError>` verifies exact match,
  fail-closed.
- `version() -> String` returns the protocol constant.
- `auth_domain() -> String` (additive read-back of the derivation prefix).

Replay-safe by construction: first commit for an id wins and is never
rewritten; the same (id, hash) replays idempotently; a different hash for
the same id is rejected (HashMismatch).

**The honest gap (documented on purpose):** because `commit` binds ANY
caller's (id, hash) pair, a party that learns a target id before its owner
anchors it can pre-register a WRONG hash at that id (first-write wins).
It cannot corrupt an already-anchored id — the mismatch path rejects every
later different hash — but the pre-registration race exists. That is why
the AUTHORIZED lane below exists; identity-bearing deployments use it.

## The AUTHORIZED lane (additive; the identity-enforced surface)

Two independent walls close the race at the contract level:

1. IDENTITY IS DERIVED IN-CONTRACT. `commit_authorized(owner: Address,
   hash: BytesN<32>)` does NOT take an id from the caller — there is no id
   argument to lie about. The contract computes
   `id = sha256( utf8("coreguard-anchor-auth/1") ++ utf8(strkey(owner))
      ++ hash )`,
   so the id binds the content hash AND the owner. A wrong hash derives a
   DIFFERENT id: "occupy the right id with a wrong value" reduces to
   breaking SHA-256 preimage resistance, not to a race.

2. AUTHORIZATION IS HOST-ENFORCED. The write requires the owner's OWN
   signature via `owner.require_auth()`: an attacker cannot even front-run
   the derived id, because the only transaction that can write to
   `Key::AuthAnchor(sha256(…owner…))` must carry that owner's signature.
   Calling with their own address derives a different id — the two never
   shadow each other.

3. VERIFICATION STAYS PUBLIC AND FAIL-CLOSED.
   `assert_anchored_authorized(id, owner, hash)` needs no signature and
   re-checks the full triple (entry exists, id derives from (owner, hash),
   hash matches, owner matches); every failure is fail-closed
   (`HashMismatch` / explicit dead-man's-say `OwnerMismatch`).
   `read_authorized(id)` returns the record including `owner` — the lane
   is transparent about WHO anchored.

The two lanes are separate storage namespaces (the permissionless lane
never satisfies the authorized read-back and vice versa); the legacy lane
keeps its byte-identical semantics for the deployed/1 ABI family. The
on-ledger `version()` constant intentionally does NOT change: the deployed
instance is and remains `CG-COMMITMENT-ANCHOR/1`, and any claim that a new
build is live appears ONLY after an owner-gated deploy publishes the new
instance's own `version()` — none exists today.

## Cross-language identity (byte-certain BOTH sides)

The derivation mirror is enforced byte-for-byte in the Node adapter
(`packages/stellar-soroban/index.mjs` → `deriveAuthorizedAnchorId`) and
pinned by a known-answer vector in BOTH test batteries:

- preimage: `utf8("coreguard-anchor-auth/1")` (23 bytes) ++
  `utf8("GDJ3CRNLNDZ4AVWGPUG7DBC5BIAGMIONOONZGB5FSYAY44ZHOIPRKY7U")`
  (56 bytes) ++ the executed pair's commitment hash (32 bytes) = 111 bytes.
- known answer: `sha256 → 0xb5f9655d4c0b4292ed0be7cd87b68e71297c1bf94667a96
  57ce3b6f6cbec6f30`.
- the sides: `soroban/commitment-anchor/src/lib.rs` test
  `derive_matches_the_cross_language_known_answer_vector` and
  `test/integrations/stellar-soroban.test.mjs`
  `auth lane derivation matches…`. If the two ever disagree, both suites
  go red — fail-closed.

The envelope builders for the three new function names
(`commit_authorized`, `read_authorized`,
`assert_anchored_authorized`) live in
`packages/stellar-soroban/index.mjs` (`buildInvokeTx`) and are
XDR-decode-contract-tested on every push; mainnet gating is unchanged
(every builder refuses mainnet without the caller's explicit
`ownerAuthorization` flag, and the DEPLOY decision for a new lane instance
stays a separate owner act — invoking the new names against the live
deployed/1 instance fails on-chain by design).

## Status

- Built/tested for Soroban SDK 23; Rust tests run with
  `cargo test` (from `soroban/commitment-anchor/`).
- Honest toolchain note: on the primary dev box, Windows Application
  Control blocks executing freshly-built binaries
  (`os error 4551` — cargo build-scripts can never run there), so this
  crate's Rust tests are exercised in Rust-capable environments, and the
  CI run owns the Rust job on every push (`soroban-rust` job). The committed
  artifact wasm is unaffected either way.
- JS-side derivation + envelope shapes: executed on every push inside
  `npm test`.
- WASM artifact committed at `artifacts/cg_commitment_anchor.wasm`
  (the deployed/1 binary — never regenerated in place).
- Intended for owner-gated integrations via the CoreGuard Soroban
  adapter; nothing auto-deploys and nothing redeploys without the owner's
  explicit decision.

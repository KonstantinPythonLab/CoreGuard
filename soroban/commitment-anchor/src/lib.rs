//! CG-COMMITMENT-ANCHOR/1 — the CoreGuard commitment anchor for Stellar (Soroban).
//!
//! What this is: a minimal, deterministic on-chain anchor that binds a CoreGuard
//! commitment id to its content hash at a ledger sequence, so an execution
//! receipt's truth can be proven against the Stellar ledger (L1 evidence).
//!
//! What this is NOT:
//!   - it is NOT a wallet. It holds no keys and moves no funds.
//!   - it is NOT a settlement surface. It records a hash — payments and
//!     authority stay with the caller's own policy (CoreGuard AIPG/1).
//!
//! Replay-safe by construction: the first commit for a commitment id wins and
//! is never rewritten. Re-committing the same (id, hash) is idempotent and
//! returns the original ledger sequence; re-committing the same id with a
//! DIFFERENT hash is rejected (fail-closed), because silently overwriting an
//! anchor would let an execution be rewritten after the fact — exactly what
//! CoreGuard exists to prevent.
//!
//! LIVE FACT (never restated): the instance deployed on mainnet
//! (`CCKA2GYVILX7YZVSXGVIHOPNLTRBBF2SSWKBTQBIE7M67N5N2QMMXPSP`,
//! `version() == "CG-COMMITMENT-ANCHOR/1"`) is the binary committed at
//! `artifacts/cg_commitment_anchor.wasm` at deploy time. This source now
//! carries an ADDITIVE authorized lane (below) for FUTURE owner-gated
//! deploys; it changes nothing about the deployed legacy functions and is
//! never claimed as live until a new contract instance — deployed only on a
//! separate explicit owner decision — reports it on-chain.
//!
//! AUTHORIZED LANE (additive, fail-closed by construction):
//! The reviewer-visible gap in the permissionless lane is real and is stated
//! honestly here: because `commit(id, hash)` binds ANY caller's (id, hash)
//! pair, a party that learns a target id before its owner anchors it can
//! pre-register a WRONG hash at that id (first-write wins, fail-closed). It
//! cannot corrupt an already-anchored id — the mismatch path rejects every
//! later different hash — but pre-registration is possible. The authorized
//! lane closes exactly that hole:
//!   1. IDENTITY IS DERIVED IN-CONTRACT. `commit_authorized` does not take an
//!      id from the caller: it computes
//!      `id = sha256( utf8(AUTH_DOMAIN) ++ strkey(owner) ++ hash )`
//!      so the id binds the content hash. A wrong hash derives a DIFFERENT
//!      id — "occupy the right id with a wrong value" reduces to breaking
//!      SHA-256 preimage resistance, not to a race.
//!   2. AUTHORIZATION IS VERIFIED HOST-SIDE. `owner.require_auth()` makes the
//!      write require the owner's OWN signature: an attacker cannot even
//!      front-run the derived id, because the only tx that can write to
//!      `Key::AuthAnchor(sha256(..owner..))` must carry that owner's
//!      authorization. A stranger calling with their own address derives a
//!      different id (the id binds the owner too) and can never shadow the
//!      owner's lane.
//!   3. VERIFICATION STAYS PUBLIC AND FAIL-CLOSED.
//!      `assert_anchored_authorized(id, owner, hash)` needs no signature and
//!      re-checks the full triple: the entry must exist, its hash and owner
//!      must match, and the id must DERIVE from (owner, hash) — anything
//!      else fails closed with `HashMismatch`/`OwnerMismatch`.
//! The two lanes are separate storage namespaces (the permissionless lane
//! never satisfies the authorized read-back and vice versa); the legacy lane
//! keeps its byte-identical semantics for the deployed/1 ABI family.

#![no_std]

use soroban_sdk::{contract, contracterror, contractimpl, contracttype, Address, Bytes, BytesN, Env, String};

/// One anchored commitment: the content hash it binds and the ledger sequence
/// where the binding was first recorded.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Anchor {
    pub hash: BytesN<32>,
    pub seq: u32,
}

/// One AUTHORIZED anchor: adds the identity of the owner whose signature the
/// write required, so a read-back can prove WHO anchored the commitment.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AuthorizedAnchor {
    pub hash: BytesN<32>,
    pub owner: Address,
    pub seq: u32,
}

/// Domain separator for the in-contract id derivation of the authorized lane.
/// Fixed bytes of this constant are the PREFIX of the preimage
/// `utf8(AUTH_DOMAIN) ++ utf8(strkey(owner)) ++ hash_bytes[32]`; the strkey is
/// the canonical G…/C… Stellar string, identical in every SDK, so both the
/// contract and every off-chain mirror derive the same id for the same inputs.
pub const AUTH_DOMAIN: &str = "coreguard-anchor-auth/1";

/// Fail-closed error codes (never invent a success).
#[contracterror]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum CgError {
    HashMismatch = 1,
    /// The stored record's owner does not equal the one under verification.
    /// Unreachable without a SHA-256 collision on the derivation (the id
    /// binds the owner); kept as an explicit dead-man's-say to stay fail-closed.
    OwnerMismatch = 2,
}

/// Version constant rendered on-ledger so a read-back can prove which build
/// produced the anchor.
pub const VERSION: &str = "CG-COMMITMENT-ANCHOR/1";

// Storage keys (single-flight enum, so adding surfaces later is additive --
// exactly what this file did: `AuthAnchor` is a new variant, not a reshaping
// of the existing one, and the two lanes live in disjoint namespaces).
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
enum Key {
    Anchor(BytesN<32>),
    AuthAnchor(BytesN<32>),
}

#[contract]
pub struct CgCommitmentAnchor;

#[contractimpl]
impl CgCommitmentAnchor {
    /// Anchor a commitment id -> content hash at this ledger sequence.
    /// Public: anyone may anchor; authority lives with the caller's policy.
    /// First write wins; same (id, hash) replays idemtently; a different hash
    /// for the same id fails with HashMismatch (never overwritten).
    /// Pre-registration race documented honestly above: this lane is the
    /// demo/proof peer; identity-bearing callers use `commit_authorized`.
    pub fn commit(env: Env, id: BytesN<32>, hash: BytesN<32>) -> Result<u32, CgError> {
        let key = Key::Anchor(id);
        if let Some(existing) = env
            .storage()
            .persistent()
            .get::<Key, Anchor>(&key)
        {
            if existing.hash == hash {
                return Ok(existing.seq);
            }
            return Err(CgError::HashMismatch);
        }
        let seq = env.ledger().sequence();
        env.storage()
            .persistent()
            .set(&key, &Anchor { hash, seq });
        Ok(seq)
    }

    /// Read an anchor: None when the id was never anchored.
    pub fn read(env: Env, id: BytesN<32>) -> Option<Anchor> {
        let key = Key::Anchor(id);
        env.storage().persistent().get::<Key, Anchor>(&key)
    }

    /// Strict read: the anchor must exist and its hash must equal the caller's
    /// expectation, else the invocation fails (fail-closed verification).
    pub fn assert_anchored(env: Env, id: BytesN<32>, hash: BytesN<32>) -> Result<u32, CgError> {
        match Self::read(env, id) {
            Some(anchor) if anchor.hash == hash => Ok(anchor.seq),
            Some(_) => Err(CgError::HashMismatch),
            None => Err(CgError::HashMismatch),
        }
    }

    /// Version constant as an on-ledger String.
    pub fn version(env: Env) -> String {
        String::from_str(&env, VERSION)
    }

    /// The authorized lane's domain separator as an on-ledger String, so a
    /// third party can read the exact derivation prefix from the ledger
    /// itself instead of trusting a source file.
    pub fn auth_domain(env: Env) -> String {
        String::from_str(&env, AUTH_DOMAIN)
    }

    /// The canonical authorized-lane id, derived IN-CONTRACT:
    /// `sha256( utf8(AUTH_DOMAIN) ++ utf8(strkey(owner)) ++ hash )`.
    /// Exported as a public fn so a verifier can ask the ledger for the
    /// canonical id of an (owner, hash) pair and compare it against what was
    /// anchored — the derivation itself never trusts a caller's arithmetic.
    pub fn derive_authorized_id(env: Env, owner: Address, hash: BytesN<32>) -> BytesN<32> {
        let mut pre = Bytes::new(&env);
        pre.extend_from_array(b"coreguard-anchor-auth/1");
        let owner_label = owner.to_string();
        let owner_label_bytes: Bytes = owner_label.to_bytes();
        let mut chunk = [0u8; 1];
        for b in owner_label_bytes.iter() {
            chunk[0] = b;
            pre.extend_from_array(&chunk);
        }
        pre.extend_from_array(&hash.to_array());
        env.crypto().sha256(&pre).into()
    }

    /// AUTHORIZED anchor: id written ONLY through the owner's signature.
    /// The id is derived from (owner, hash) in-contract (above), so the
    /// function CHANGES the caller's id only by refusing to take one —
    /// there is no id argument to lie about. Fail-closed everywhere:
    ///   - missing owner authorization -> host rejects the tx (never reaches
    ///     storage),
    ///   - a record already exists with the same (owner, hash) -> idempotent
    ///     replay of the original ledger sequence,
    ///   - any other occupied-lane shape -> fail-closed error (cryptographic
    ///     dead code, kept for defense in depth).
    pub fn commit_authorized(env: Env, owner: Address, hash: BytesN<32>) -> Result<u32, CgError> {
        owner.require_auth();
        let id = Self::derive_authorized_id(env.clone(), owner.clone(), hash.clone());
        let key = Key::AuthAnchor(id);
        if let Some(existing) = env
            .storage()
            .persistent()
            .get::<Key, AuthorizedAnchor>(&key)
        {
            if existing.hash == hash {
                if existing.owner == owner {
                    return Ok(existing.seq);
                }
                return Err(CgError::OwnerMismatch);
            }
            return Err(CgError::HashMismatch);
        }
        let seq = env.ledger().sequence();
        env.storage()
            .persistent()
            .set(
                &key,
                &AuthorizedAnchor { hash, owner, seq },
            );
        Ok(seq)
    }

    /// Read an authorized anchor: None when never anchored. Returns the
    /// owner identity too — transparency lane (who anchored is public).
    pub fn read_authorized(env: Env, id: BytesN<32>) -> Option<AuthorizedAnchor> {
        env.storage().persistent().get(&Key::AuthAnchor(id))
    }

    /// Strict AUTHORIZED read-back (public, no signature required):
    /// the record must exist, the id must DERIVE from (owner, hash), the
    /// stored hash must equal the caller's hash and the stored owner must
    /// equal the caller's owner. Every failure is fail-closed.
    pub fn assert_anchored_authorized(
        env: Env,
        id: BytesN<32>,
        owner: Address,
        hash: BytesN<32>,
    ) -> Result<u32, CgError> {
        if id != Self::derive_authorized_id(env.clone(), owner.clone(), hash.clone()) {
            return Err(CgError::HashMismatch);
        }
        match Self::read_authorized(env.clone(), id) {
            Some(auth) if auth.hash == hash => {
                if auth.owner == owner {
                    Ok(auth.seq)
                } else {
                    Err(CgError::OwnerMismatch)
                }
            }
            Some(_) => Err(CgError::HashMismatch),
            None => Err(CgError::HashMismatch),
        }
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::Address;

    const VERSION_TEST: &str = VERSION;

    fn contract_address(env: &Env) -> Address {
        env.register(CgCommitmentAnchor, ())
    }

    #[test]
    fn version_is_the_protocol_constant() {
        let env = Env::default();
        let address = contract_address(&env);
        let client = CgCommitmentAnchorClient::new(&env, &address);
        assert_eq!(client.version(), String::from_str(&env, VERSION_TEST));
    }

    #[test]
    fn commit_anchors_at_the_ledger_sequence_and_reads_back() {
        let env = Env::default();
        let address = contract_address(&env);
        let client = CgCommitmentAnchorClient::new(&env, &address);
        let id = BytesN::from_array(&env, &[7u8; 32]);
        let hash = BytesN::from_array(&env, &[9u8; 32]);

        let seq = client.commit(&id, &hash);
        let anchor = client.read(&id).unwrap();
        assert_eq!(anchor.hash, hash);
        assert_eq!(anchor.seq, seq);
    }

    #[test]
    fn commit_is_idempotent_for_the_same_id_and_hash() {
        let env = Env::default();
        let address = contract_address(&env);
        let client = CgCommitmentAnchorClient::new(&env, &address);
        let id = BytesN::from_array(&env, &[7u8; 32]);
        let hash = BytesN::from_array(&env, &[9u8; 32]);

        let seq1 = client.commit(&id, &hash);
        let seq2 = client.commit(&id, &hash);
        assert_eq!(seq1, seq2);
    }

    #[test]
    fn commit_rejects_a_different_hash_for_the_same_id() {
        let env = Env::default();
        let address = contract_address(&env);
        let client = CgCommitmentAnchorClient::new(&env, &address);
        let id = BytesN::from_array(&env, &[7u8; 32]);
        let hash_a = BytesN::from_array(&env, &[9u8; 32]);
        let hash_b = BytesN::from_array(&env, &[11u8; 32]);

        client.commit(&id, &hash_a);
        assert_eq!(client.try_commit(&id, &hash_b), Err(Ok(CgError::HashMismatch)));
    }

    #[test]
    fn assert_anchored_passes_only_on_an_exact_match() {
        let env = Env::default();
        let address = contract_address(&env);
        let client = CgCommitmentAnchorClient::new(&env, &address);
        let id = BytesN::from_array(&env, &[7u8; 32]);
        let hash = BytesN::from_array(&env, &[9u8; 32]);

        let seq = client.commit(&id, &hash);
        assert_eq!(client.assert_anchored(&id, &hash), seq);

        let other = BytesN::from_array(&env, &[11u8; 32]);
        assert_eq!(
            client.try_assert_anchored(&id, &other),
            Err(Ok(CgError::HashMismatch))
        );
        let unknown = BytesN::from_array(&env, &[13u8; 32]);
        assert_eq!(
            client.try_assert_anchored(&unknown, &hash),
            Err(Ok(CgError::HashMismatch))
        );
    }

    // ---- Authorized lane (additive): identity derived in-contract ----

    fn wallet(env: &Env) -> Address {
        // The owner's real mainnet public key (public material — a strkey).
        Address::from_str(&env, "GDJ3CRNLNDZ4AVWGPUG7DBC5BIAGMIONOONZGB5FSYAY44ZHOIPRKY7U")
    }

    fn executed_hash(env: &Env) -> BytesN<32> {
        // The executed mainnet commitment hash (public evidence material).
        BytesN::from_array(
            &env,
            &[
                0xc0, 0xdb, 0xfb, 0x45, 0xb6, 0xc8, 0xe1, 0x3b,
                0x37, 0x38, 0x82, 0x23, 0x60, 0xea, 0x73, 0x7a,
                0xdf, 0xc0, 0x45, 0xd4, 0xac, 0xb8, 0x0b, 0xda,
                0xea, 0xc5, 0x63, 0xc8, 0xaf, 0x31, 0x05, 0x2b,
            ],
        )
    }

    /// Cross-language known-answer vector, byte-certain in BOTH
    /// implementations (Rust here, JS mirror in
    /// `test/integrations/stellar-soroban.test.mjs`):
    /// preimage = utf8("coreguard-anchor-auth/1") ++ utf8(strkey) ++ hash32
    /// (23 ++ 56 ++ 32 = 111 bytes) ->
    /// sha256 = 0xb5f9655d4c0b4292ed0be7cd87b68e71297c1bf94667a9657ce3b6f6cbec6f30
    #[test]
    fn derive_matches_the_cross_language_known_answer_vector() {
        let env = Env::default();
        let address = contract_address(&env);
        let client = CgCommitmentAnchorClient::new(&env, &address);
        let derived = client.derive_authorized_id(&wallet(&env), &executed_hash(&env));
        assert_eq!(
            derived.to_array(),
            [
                0xb5, 0xf9, 0x65, 0x5d, 0x4c, 0x0b, 0x42, 0x92,
                0xed, 0x0b, 0xe7, 0xcd, 0x87, 0xb6, 0x8e, 0x71,
                0x29, 0x7c, 0x1b, 0xf9, 0x46, 0x67, 0xa9, 0x65,
                0x7c, 0xe3, 0xb6, 0xf6, 0xcb, 0xec, 0x6f, 0x30,
            ]
        );
    }

    fn auth_client(env: &Env) -> Address {
        contract_address(env)
    }

    #[test]
    fn auth_domain_reads_the_derivation_prefix() {
        let env = Env::default();
        let address = auth_client(&env);
        let client = CgCommitmentAnchorClient::new(&env, &address);
        assert_eq!(client.auth_domain(), String::from_str(&env, AUTH_DOMAIN));
    }

    #[test]
    fn a_different_owner_or_hash_derives_a_different_id() {
        let env = Env::default();
        let address = auth_client(&env);
        let client = CgCommitmentAnchorClient::new(&env, &address);
        let owner_a = wallet(&env);
        let owner_b = Address::from_str(&env, "GA7QYNF7SOWQ3GLZR2B55IHTF2HLKO4GDYTHI5NHE7YJTZVC7ZLDTXWJ");
        let same_hash = executed_hash(&env);
        let other_hash = BytesN::from_array(&env, &[9u8; 32]);

        let id_a = client.derive_authorized_id(&owner_a, &same_hash);
        let id_b = client.derive_authorized_id(&owner_b, &same_hash);
        let id_a_alt = client.derive_authorized_id(&owner_a, &other_hash);
        // The front-run/identity property: nobody can arrive at the owner's id
        // with different content, because the id binds owner AND hash.
        assert_ne!(id_a, id_b);
        assert_ne!(id_a, id_a_alt);
    }

    #[test]
    fn commit_authorized_anchors_and_replays_idempotently() {
        let env = Env::default();
        let address = auth_client(&env);
        let client = CgCommitmentAnchorClient::new(&env, &address);
        let owner = wallet(&env);
        let hash = executed_hash(&env);

        // Env::default() mocks ALL auth in testutils, so the happy path runs;
        // the zero-auth branch is asserted separately below.
        let id = client.derive_authorized_id(&owner, &hash);
        let seq = client.commit_authorized(&owner, &hash);

        let anchor = client.read_authorized(&id).unwrap();
        assert_eq!(anchor.hash, hash);
        assert_eq!(anchor.owner, owner);
        assert_eq!(anchor.seq, seq);

        let replay = client.commit_authorized(&owner, &hash);
        assert_eq!(seq, replay);
    }

    #[test]
    fn without_owner_authorization_the_write_fails_host_side() {
        // Zero auth signatures: the host must reject commit_authorized BEFORE
        // any storage write. This is the branch that makes pre-registration
        // of the owner's derived id impossible (the attacker has no owner
        // signature to authorize the write).
        let env = Env::default();
        env.set_auths(&[]);
        let address = auth_client(&env);
        let client = CgCommitmentAnchorClient::new(&env, &address);
        let owner = wallet(&env);
        let hash = executed_hash(&env);

        client.try_commit_authorized(&owner, &hash).unwrap_err();
        // Fail-closed trace: nothing landed in the authorized lane.
        let id = client.derive_authorized_id(&owner, &hash);
        assert!(client.read_authorized(&id).is_none());
    }

    #[test]
    fn assert_anchored_authorized_is_exact_and_fail_closed() {
        let env = Env::default();
        let address = auth_client(&env);
        let client = CgCommitmentAnchorClient::new(&env, &address);
        let owner = wallet(&env);
        let hash = executed_hash(&env);

        let id = client.derive_authorized_id(&owner, &hash);
        let seq = client.commit_authorized(&owner, &hash);
        assert_eq!(client.assert_anchored_authorized(&id, &owner, &hash), seq);

        // Wrong hash -> HashMismatch.
        let wrong_hash = BytesN::from_array(&env, &[9u8; 32]);
        assert_eq!(
            client.try_assert_anchored_authorized(&id, &owner, &wrong_hash),
            Err(Ok(CgError::HashMismatch))
        );
        // Wrong owner -> HashMismatch via the derivation gate (the derived id
        // is not the anchored id).
        let other_owner = Address::from_str(&env, "GA7QYNF7SOWQ3GLZR2B55IHTF2HLKO4GDYTHI5NHE7YJTZVC7ZLDTXWJ");
        assert_eq!(
            client.try_assert_anchored_authorized(&id, &other_owner, &hash),
            Err(Ok(CgError::HashMismatch))
        );
        // Made-up id (right owner, right hash, wrong id) -> HashMismatch.
        let fake_id = BytesN::from_array(&env, &[13u8; 32]);
        assert_eq!(
            client.try_assert_anchored_authorized(&fake_id, &owner, &hash),
            Err(Ok(CgError::HashMismatch))
        );
        // Never-anchored id -> HashMismatch.
        let unknown = client.derive_authorized_id(&other_owner, &wrong_hash);
        assert_eq!(
            client.try_assert_anchored_authorized(&unknown, &other_owner, &wrong_hash),
            Err(Ok(CgError::HashMismatch))
        );
    }

    #[test]
    fn the_wrong_owner_cannot_occupy_the_owners_lane() {
        // The core reviewer scenario: a stranger that knows (owner, hash)
        // targets the owner's derived id. In the AUTHORIZED lane there is no
        // path: the attacker's own signature derives a DIFFERENT id, and the
        // owner's id can only be written by the owner's own tx.
        let env = Env::default();
        let address = auth_client(&env);
        let client = CgCommitmentAnchorClient::new(&env, &address);
        let owner = wallet(&env);
        let attacker = Address::from_str(&env, "GA7QYNF7SOWQ3GLZR2B55IHTF2HLKO4GDYTHI5NHE7YJTZVC7ZLDTXWJ");
        let hash = executed_hash(&env);

        let attacker_id = client.derive_authorized_id(&attacker, &hash);
        let owner_id = client.derive_authorized_id(&owner, &hash);
        // Distinct roots at the write surface, not just at derivation:
        assert_ne!(attacker_id, owner_id);
        let attacker_seq = client.commit_authorized(&attacker, &hash);
        let attacker_anchor = client.read_authorized(&attacker_id).unwrap();
        assert_eq!(attacker_anchor.owner, attacker);
        assert_eq!(attacker_anchor.seq, attacker_seq);
    }

    #[test]
    fn lanes_are_isolated_across_storage_namespaces() {
        // The permissionless lane never satisfies the authorized read-back
        // and vice versa: no shadowing, no cross-lane pollution, even for
        // identical content.
        let env = Env::default();
        let address = auth_client(&env);
        let client = CgCommitmentAnchorClient::new(&env, &address);
        let owner = wallet(&env);
        let hash = executed_hash(&env);

        let auth_id = client.derive_authorized_id(&owner, &hash);
        client.commit_authorized(&owner, &hash);
        // Legacy lane with the SAME 32-byte id and hash content: the legacy
        // read-back must NOT see the authorized record...
        assert_eq!(
            client.try_assert_anchored(&auth_id, &hash),
            Err(Ok(CgError::HashMismatch))
        );
        // ...and vice versa: a legacy entry cannot satisfy an authorized
        // read-back even with matching (owner, hash).
        let legacy_id = BytesN::from_array(&env, &[7u8; 32]);
        client.commit(&legacy_id, &hash);
        client
            .try_assert_anchored_authorized(&legacy_id, &owner, &hash)
            .unwrap_err();
    }
}

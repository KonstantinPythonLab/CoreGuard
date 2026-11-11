// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * EvidenceRegistryV3 — property-based (fuzz) and stateful invariant tests.
 *
 * The unit suite (EvidenceRegistryV3.t.sol) proves one example per rule. This
 * file tries to break the same contract over SEQUENCES of calls and over whole
 * input ranges, because the security claim of Core 1116 is not "each rule
 * fires once" but "no sequence of commits, anchors and withdrawals can land a
 * record the contract did not authorize":
 *
 *   - write-once: an intentId / proofId committed once can never be rewritten
 *     or re-pointed (replay resistance is a state property, not one revert);
 *   - binding: a stored proof always still names the intent commitment it was
 *     anchored against — it can never be re-attributed to another intent;
 *   - accounting: treasuryBalance is EXACTLY the sum of the commissions the
 *     contract actually collected, and the contract always holds at least that
 *     much (no phantom withdrawable value, no stranded value);
 *   - authorization: signing is bound to chainId, verifyingContract and every
 *     field, so a signature minted for any other tuple is refused.
 *
 * No forge-std on purpose: the suite keeps the repo's local `Vm` interface and
 * require() discipline, so `forge test` needs no submodule. The action
 * functions live ON the invariant test contract because that contract is the
 * invariant runner's default target — this avoids depending on the
 * `targetContract` cheatcode, which older/newer forge builds disagree about.
 * The test contract is also the registry's `feeTo`, so the withdraw path is
 * reachable by the same fuzzer.
 *
 * Run (CI, contracts job):  forge test --match-path "test/contract/*"
 * Invariants only:          forge test --match-path "test/contract/*invariant*"
 */

import { EvidenceRegistryV3 } from "../../contracts/EvidenceRegistryV3.sol";

interface Vm {
    function addr(uint256) external returns (address);
    function sign(uint256, bytes32) external returns (uint8, bytes32, bytes32);
    function warp(uint256) external;
    function chainId(uint256) external;
    function deal(address, uint256) external;
    function expectRevert(bytes4) external;
    function expectRevert(bytes calldata) external;
}

/* ------------------------------------------------------------------------- */
/* Stateful invariants — the test contract IS the handler                    */
/* ------------------------------------------------------------------------- */

contract EvidenceRegistryV3InvariantTest {
    Vm internal constant vm = Vm(address(0x7109709ECfa91a80626fF3989D68f67F5b1DD12D));

    bytes32 internal constant VERIFIER_V1 = keccak256("cg-verifier/0.1.0");
    uint256 internal constant WINDOW = 20; // bounded scan: last 20 records per invariant

    EvidenceRegistryV3 public registry;
    uint256 public fee;

    address[3] public actors;
    uint256[3] public keys;

    // Ghost ledger: what this contract BELIEVES it wrote, in call order.
    uint256 public commits;
    uint256 public anchors;
    uint256 public withdrawals;
    uint256 public collected;
    bytes32[] public intentIds;
    bytes32[] public proofIds;

    mapping(bytes32 => bytes32) public ghostCommitment;
    mapping(bytes32 => address) public ghostSigner;
    mapping(bytes32 => uint256) public ghostKey;
    mapping(bytes32 => uint256) public ghostValidUntil;
    mapping(bytes32 => bytes32) public ghostProofReceipt;
    mapping(bytes32 => uint8) public ghostProofResult;
    mapping(bytes32 => bytes32) public ghostProofIntent;
    mapping(bytes32 => address) public ghostProofSigner;

    function setUp() public {
        uint256[3] memory k;
        address[3] memory a;
        k[0] = 0x10;
        k[1] = 0x11;
        k[2] = 0x12;
        a[0] = vm.addr(k[0]);
        a[1] = vm.addr(k[1]);
        a[2] = vm.addr(k[2]);

        keys = k;
        actors = a;
        fee = 0.1 ether;
        // This contract is the registry's treasury: the withdraw path stays reachable.
        registry = new EvidenceRegistryV3(address(this), fee);
        vm.deal(address(this), 10_000 ether);
    }

    receive() external payable {}

    /* ----------------------------- actions ------------------------------ */

    /// @dev Commits an intent for a fuzzed actor / id / window. Reverts are
    ///      the contract's own refusals and are ignored by the invariant runner
    ///      (fail_on_revert = false), so illegal sequences are explored too.
    function commit(uint256 actorSeed, bytes32 intentSeed, uint256 ttlSeed) external {
        uint256 i = actorSeed % 3;
        bytes32 intentId = intentSeed;
        uint256 validUntil = block.timestamp + (ttlSeed % 10_000) + 1;
        address signer = actors[i];
        bytes32 commitment = keccak256(abi.encodePacked(intentId, i, commits));
        bytes memory sig = _sign(
            registry.commitIntentDigest(intentId, commitment, validUntil, signer),
            keys[i]
        );

        (bool ok, ) = address(registry).call(
            abi.encodeWithSelector(
                EvidenceRegistryV3.commitIntent.selector,
                intentId,
                commitment,
                signer,
                validUntil,
                sig
            )
        );
        if (!ok) return;

        commits += 1;
        intentIds.push(intentId);
        ghostCommitment[intentId] = commitment;
        ghostSigner[intentId] = signer;
        ghostKey[intentId] = keys[i];
        ghostValidUntil[intentId] = validUntil;
    }

    /// @dev Anchors a proof against an intent this run actually committed, paying
    ///      exactly the flat fee. Unknown intents are skipped here; the fuzz
    ///      suite asserts that the contract refuses them by name.
    function anchor(
        uint256 proofSeed,
        uint256 intentSeed,
        uint256 receiptSeed,
        uint8 resultSeed
    ) external {
        bytes32 intentId = bytes32(intentSeed);
        address signer = ghostSigner[intentId];
        if (signer == address(0)) return;

        bytes32 proofId = bytes32(proofSeed);
        bytes32 receiptId = keccak256(abi.encodePacked(bytes32(receiptSeed)));
        uint8 result = resultSeed % 3;
        bytes32 commitment = keccak256(abi.encodePacked(proofId, receiptId, result));
        bytes memory sig = _sign(
            registry.anchorProofDigest(proofId, intentId, receiptId, commitment, result, VERIFIER_V1),
            ghostKey[intentId]
        );

        (bool ok, ) = address(registry).call{ value: fee }(
            abi.encodeWithSelector(
                EvidenceRegistryV3.anchorProof.selector,
                proofId,
                intentId,
                receiptId,
                commitment,
                result,
                VERIFIER_V1,
                sig
            )
        );
        if (!ok) return;

        anchors += 1;
        collected += fee;
        proofIds.push(proofId);
        ghostProofReceipt[proofId] = receiptId;
        ghostProofResult[proofId] = result;
        ghostProofIntent[proofId] = intentId;
        ghostProofSigner[proofId] = signer;
    }

    /// @dev Withdraws the collected commission to a fuzzed address. This
    ///      contract is `feeTo`, so the only guard exercised is the payout path.
    function withdraw(uint256 toSeed) external {
        address to = address(uint160(uint256(keccak256(abi.encodePacked(toSeed)))));
        (bool ok, ) = address(registry).call(
            abi.encodeWithSelector(EvidenceRegistryV3.withdrawTreasury.selector, to)
        );
        if (!ok) return;
        withdrawals += 1;
        collected = 0; // a successful withdraw empties the whole ledger
    }

    /* ---------------------------- invariants ---------------------------- */

    /// @dev No phantom money: the ledger equals what was actually collected,
    ///      and the contract always holds at least the withdrawable amount.
    function invariant_treasuryIsExactlyTheCommissionLedger() public view {
        require(registry.treasuryBalance() == collected, "treasury ledger != collected commissions");
        require(
            address(registry).balance >= registry.treasuryBalance(),
            "contract balance is below its own ledger"
        );
    }

    /// @dev Write-once: a committed intent never changes commitment, signer or window.
    function invariant_intentsAreImmutableOnceCommitted() public view {
        uint256 n = intentIds.length;
        uint256 start = n > WINDOW ? n - WINDOW : 0;
        for (uint256 i = start; i < n; i++) {
            bytes32 id = intentIds[i];
            (bytes32 commitment, , , uint256 validUntil, address signer) = registry.intentCommits(id);
            require(commitment == ghostCommitment[id], "intent commitment was rewritten");
            require(signer == ghostSigner[id], "intent signer was rewritten");
            require(validUntil == ghostValidUntil[id], "intent window was rewritten");
        }
    }

    /// @dev A proof keeps naming the intent commitment it was anchored against,
    ///      the receipt it carried, its result code and the exact fee paid.
    function invariant_anchorsStayBoundToTheirIntent() public view {
        uint256 n = proofIds.length;
        uint256 start = n > WINDOW ? n - WINDOW : 0;
        for (uint256 i = start; i < n; i++) {
            bytes32 proofId = proofIds[i];
            (
                bytes32 receiptId,
                bytes32 intentCommitment,
                ,
                ,
                uint256 anchoredAt,
                uint8 result,
                address signer,
                uint256 commissionPaid
            ) = registry.proofAnchors(proofId);

            require(receiptId == ghostProofReceipt[proofId], "proof receipt was rewritten");
            require(result == ghostProofResult[proofId], "proof result was rewritten");
            require(signer == ghostProofSigner[proofId], "proof signer was rewritten");
            require(
                intentCommitment == ghostCommitment[ghostProofIntent[proofId]],
                "proof is no longer bound to its intent commitment"
            );
            require(commissionPaid == fee, "commission not recorded exactly");
            require(anchoredAt <= block.timestamp, "anchor timestamp is in the future");
            require(result <= uint8(EvidenceRegistryV3.ProofResult.UNVERIFIED), "result out of range");
        }
    }

    /// @dev No orphan proof: every stored anchor points at an intent that still
    ///      exists with a commitment this run wrote.
    function invariant_noAnchorWithoutItsIntent() public view {
        uint256 n = proofIds.length;
        uint256 start = n > WINDOW ? n - WINDOW : 0;
        for (uint256 i = start; i < n; i++) {
            bytes32 proofId = proofIds[i];
            bytes32 intentId = ghostProofIntent[proofId];
            (bytes32 commitment, , , , address signer) = registry.intentCommits(intentId);
            require(signer != address(0), "anchor points at a non-existent intent");
            require(commitment != bytes32(0), "anchored intent has no commitment");
        }
    }

    /// @dev Version, domain and feeTo are construction constants, never mutable state.
    function invariant_versionAndDomainArePinned() public view {
        require(registry.VERSION() == registry.VERSION_KECCAK(), "VERSION is not pinned");
        require(registry.domainSeparator() != bytes32(0), "domain separator is empty");
        require(registry.feeTo() == address(this), "feeTo drifted from construction");
    }

    /* ------------------------------ helpers ------------------------------ */

    function _sign(bytes32 digest, uint256 key) internal returns (bytes memory) {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(key, digest);
        return abi.encodePacked(r, s, v);
    }
}

/* ------------------------------------------------------------------------- */
/* Fuzz: single-call properties over whole input ranges                      */
/* ------------------------------------------------------------------------- */

contract EvidenceRegistryV3FuzzTest {
    Vm internal constant vm = Vm(address(0x7109709ECfa91a80626fF3989D68f67F5b1DD12D));

    EvidenceRegistryV3 internal registry;
    address internal alice;
    address internal treasury;

    uint256 internal constant ALICE_KEY = 0x10;
    uint256 internal constant FEE = 0.1 ether;
    uint256 internal constant NOW = 1_000_000;
    bytes32 internal constant VERIFIER_V1 = keccak256("cg-verifier/0.1.0");

    function setUp() public {
        treasury = address(0xBEEF);
        registry = new EvidenceRegistryV3(treasury, FEE);
        alice = vm.addr(ALICE_KEY);
        vm.warp(NOW);
        vm.deal(address(this), 1_000 ether);
    }

    /* ---------------------------- commission ----------------------------- */

    /// @dev The commission is exact: every value but the flat fee is refused by
    ///      name, and the accepted one lands in the ledger untouched.
    function testFuzz_anchorRequiresExactlyTheFlatFee(uint256 provided) public {
        provided = provided % (2 ether);
        bytes32 intentId = keccak256("intent-fee");
        _commit(intentId, NOW + 1000, keccak256("commitment-fee"));

        bytes memory sig = _anchorSig(
            keccak256("proof-fee"),
            intentId,
            keccak256("receipt-fee"),
            keccak256("proof-commitment-fee"),
            0
        );

        if (provided == FEE) {
            registry.anchorProof{ value: provided }(
                keccak256("proof-fee"),
                intentId,
                keccak256("receipt-fee"),
                keccak256("proof-commitment-fee"),
                0,
                VERIFIER_V1,
                sig
            );
            require(registry.treasuryBalance() == FEE, "fee was not collected exactly");
        } else {
            vm.expectRevert(
                abi.encodeWithSelector(EvidenceRegistryV3.CommissionMismatch.selector, FEE, provided)
            );
            registry.anchorProof{ value: provided }(
                keccak256("proof-fee"),
                intentId,
                keccak256("receipt-fee"),
                keccak256("proof-commitment-fee"),
                0,
                VERIFIER_V1,
                sig
            );
        }
    }

    /* ---------------------------- result code ---------------------------- */

    /// @dev VALID/INVALID/UNVERIFIED are the only storable codes; anything wider
    ///      is refused before it can enter the mapping, and the accepted code is
    ///      stored verbatim.
    function testFuzz_resultCodeIsBounded(uint8 result) public {
        bytes32 intentId = keccak256("intent-result");
        _commit(intentId, NOW + 1000, keccak256("commitment-result"));

        bytes32 proofId = keccak256("proof-result");
        bytes32 receiptId = keccak256("receipt-result");
        bytes32 commitment = keccak256("proof-commitment-result");
        bytes memory sig = _anchorSig(proofId, intentId, receiptId, commitment, result);

        if (result > uint8(EvidenceRegistryV3.ProofResult.UNVERIFIED)) {
            vm.expectRevert(
                abi.encodeWithSelector(EvidenceRegistryV3.InvalidResultCode.selector, result)
            );
            registry.anchorProof{ value: FEE }(
                proofId,
                intentId,
                receiptId,
                commitment,
                result,
                VERIFIER_V1,
                sig
            );
        } else {
            registry.anchorProof{ value: FEE }(
                proofId,
                intentId,
                receiptId,
                commitment,
                result,
                VERIFIER_V1,
                sig
            );
            (, , , , , uint8 stored, , ) = registry.proofAnchors(proofId);
            require(stored == result, "result not stored verbatim");
        }
    }

    /* ------------------------------ expiry ------------------------------- */

    /// @dev validUntil is inclusive: the last permitted second still anchors.
    function testFuzz_validUntilIsInclusive(uint32 ttl) public {
        uint256 validUntil = NOW + (uint256(ttl) % 100_000);
        bytes32 intentId = keccak256(abi.encodePacked("intent-inclusive", ttl));
        _commit(intentId, validUntil, keccak256(abi.encodePacked("commitment-inclusive", ttl)));

        vm.warp(validUntil);

        bytes32 proofId = keccak256(abi.encodePacked("proof-inclusive", ttl));
        bytes32 receiptId = keccak256("receipt-inclusive");
        bytes32 commitment = keccak256("proof-commitment-inclusive");
        registry.anchorProof{ value: FEE }(
            proofId,
            intentId,
            receiptId,
            commitment,
            0,
            VERIFIER_V1,
            _anchorSig(proofId, intentId, receiptId, commitment, 0)
        );
        require(registry.treasuryBalance() == FEE, "inclusive anchor did not land");
    }

    /// @dev One second past the window the anchor is refused, by name.
    function testFuzz_oneSecondPastTheWindowIsRefused(uint32 ttl) public {
        uint256 validUntil = NOW + (uint256(ttl) % 100_000);
        bytes32 intentId = keccak256(abi.encodePacked("intent-expired", ttl));
        _commit(intentId, validUntil, keccak256(abi.encodePacked("commitment-expired", ttl)));

        vm.warp(validUntil + 1);

        bytes32 proofId = keccak256(abi.encodePacked("proof-expired", ttl));
        bytes32 receiptId = keccak256("receipt-expired");
        bytes32 commitment = keccak256("proof-commitment-expired");
        // Sign BEFORE expectRevert: the cheatcode call must not be the next call.
        bytes memory sig = _anchorSig(proofId, intentId, receiptId, commitment, 0);
        vm.expectRevert(
            abi.encodeWithSelector(EvidenceRegistryV3.Expired.selector, validUntil + 1, validUntil)
        );
        registry.anchorProof{ value: FEE }(
            proofId,
            intentId,
            receiptId,
            commitment,
            0,
            VERIFIER_V1,
            sig
        );
    }

    /* --------------------------- authorization --------------------------- */

    /// @dev The signature is bound to every digest field: a signature minted
    ///      over a different (id, commitment, window) tuple is refused, while
    ///      the honest one is accepted in the same run.
    function testFuzz_signatureBindsEveryIntentField(
        bytes32 intentId,
        bytes32 commitment,
        uint96 ttl,
        uint8 field
    ) public {
        uint256 validUntil = NOW + (uint256(ttl) % 100_000) + 1;
        bytes32 tamperedId = field % 3 == 0
            ? keccak256(abi.encodePacked(intentId, "id"))
            : intentId;
        bytes32 tamperedCommitment = field % 3 == 1
            ? keccak256(abi.encodePacked(commitment, "commitment"))
            : commitment;
        uint256 tamperedWindow = field % 3 == 2 ? validUntil + 1 : validUntil;

        bytes memory wrongSig = _sign(
            registry.commitIntentDigest(tamperedId, tamperedCommitment, tamperedWindow, alice),
            ALICE_KEY
        );
        vm.expectRevert(EvidenceRegistryV3.InvalidAuthority.selector);
        registry.commitIntent(intentId, commitment, alice, validUntil, wrongSig);

        bytes memory honestSig = _sign(
            registry.commitIntentDigest(intentId, commitment, validUntil, alice),
            ALICE_KEY
        );
        registry.commitIntent(intentId, commitment, alice, validUntil, honestSig);
        (bytes32 stored, , , , address signer) = registry.intentCommits(intentId);
        require(stored == commitment && signer == alice, "honest commit did not land");
    }

    /// @dev The EIP-712 domain binds chainId: a signature for another chain never
    ///      authorizes this one, and the honest chain still works.
    function testFuzz_domainIsBoundToTheChainId(uint64 otherChainSeed) public {
        uint256 homeChain = 1116;
        uint256 otherChain = homeChain + 1 + (uint256(otherChainSeed) % 100_000);

        vm.chainId(otherChain);
        bytes32 intentId = keccak256("intent-chain");
        bytes32 commitment = keccak256("commitment-chain");
        uint256 validUntil = NOW + 1000;
        bytes memory foreignSig = _sign(
            registry.commitIntentDigest(intentId, commitment, validUntil, alice),
            ALICE_KEY
        );

        vm.chainId(homeChain);
        vm.expectRevert(EvidenceRegistryV3.InvalidAuthority.selector);
        registry.commitIntent(intentId, commitment, alice, validUntil, foreignSig);

        registry.commitIntent(
            intentId,
            commitment,
            alice,
            validUntil,
            _sign(registry.commitIntentDigest(intentId, commitment, validUntil, alice), ALICE_KEY)
        );
    }

    /// @dev An anchor for an intent that was never committed is refused, and the
    ///      refusal names the intent — never a silent no-op.
    function testFuzz_anchorForAnUnknownIntentIsRefused(bytes32 intentId) public {
        bytes32 proofId = keccak256(abi.encodePacked("proof-orphan", intentId));
        bytes32 receiptId = keccak256("receipt-orphan");
        bytes32 commitment = keccak256("proof-commitment-orphan");
        bytes memory sig = _anchorSig(proofId, intentId, receiptId, commitment, 0);
        vm.expectRevert(
            abi.encodeWithSelector(EvidenceRegistryV3.UnauthorizedIntention.selector, intentId)
        );
        registry.anchorProof{ value: FEE }(
            proofId,
            intentId,
            receiptId,
            commitment,
            0,
            VERIFIER_V1,
            sig
        );
    }

    /* ----------------------------- singletons ---------------------------- */

    /// @dev ids are singletons for every id the fuzzer can produce: the second
    ///      commit is refused and the first record survives untouched.
    function testFuzz_intentIdsAreSingletons(bytes32 intentId) public {
        bytes32 commitment = keccak256(abi.encodePacked("singleton", intentId));
        _commit(intentId, NOW + 1000, commitment);

        bytes memory sig = _sign(
            registry.commitIntentDigest(intentId, keccak256("other"), NOW + 2000, alice),
            ALICE_KEY
        );
        vm.expectRevert(
            abi.encodeWithSelector(EvidenceRegistryV3.AlreadyCommitted.selector, intentId)
        );
        registry.commitIntent(intentId, keccak256("other"), alice, NOW + 2000, sig);

        (bytes32 stored, , , uint256 validUntil, address signer) = registry.intentCommits(intentId);
        require(stored == commitment, "first commitment was overwritten");
        require(validUntil == NOW + 1000, "first window was overwritten");
        require(signer == alice, "first signer was overwritten");
    }

    /* ------------------------------ helpers ------------------------------ */

    function _commit(bytes32 intentId, uint256 validUntil, bytes32 commitment) internal {
        registry.commitIntent(
            intentId,
            commitment,
            alice,
            validUntil,
            _sign(registry.commitIntentDigest(intentId, commitment, validUntil, alice), ALICE_KEY)
        );
    }

    function _anchorSig(
        bytes32 proofId,
        bytes32 intentId,
        bytes32 receiptId,
        bytes32 commitment,
        uint8 result
    ) internal returns (bytes memory) {
        return
            _sign(
                registry.anchorProofDigest(
                    proofId,
                    intentId,
                    receiptId,
                    commitment,
                    result,
                    VERIFIER_V1
                ),
                ALICE_KEY
            );
    }

    function _sign(bytes32 digest, uint256 key) internal returns (bytes memory) {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(key, digest);
        return abi.encodePacked(r, s, v);
    }
}

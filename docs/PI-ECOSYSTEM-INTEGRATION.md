# Pi Network ecosystem integration (English · العربية)

> Pi Network is moving toward a mainnet and an open developer ecosystem with wallets, DApps and services. CoreGuard gives Pi Network an execution-truth layer that every wallet, DApp and service can use: a deterministic, replayable proof of what was authorised versus what executed, fail-closed, before the transaction settles.

## Where Pi Network is today

- **Pi Browser** is the gateway for Pi DApps and Pi ecosystem apps.
- **Pi Wallet** is the primary wallet experience for Pi holders.
- **Pi ecosystem apps** cover a growing set of use cases as the ecosystem opens up.
- **Pi mainnet** is the next major milestone; the developer platform, ecosystem initiatives and a new hackathon (Pi Next, with a $200,000 USDT prize pool) are already visible on the Pi Network side.

That is exactly the moment an execution-truth layer becomes useful: once value can move on Pi, every transaction needs a proof a user, an auditor or a regulator can re-derive.

## What CoreGuard brings to Pi Network

1. **Pi Browser verification overlay.** A lightweight overlay checks every DApp transaction through CoreGuard and shows the user, before sign-off: “authorisation recovered · policy satisfied · receipt ready · anchored (once Pi mainnet is live)”. UNKNOWN stays HELD.
2. **Pi Wallet pre-sign check.** A Pi Wallet integration adds a pre-sign verification step: ALLOW / DENY / HOLD with a verifiable receipt, so a wallet never signs a transaction it cannot explain to the user.
3. **Pi DApp SDK.** Pi DApps call the same verifier as Core DAO and Stellar. The DApp presents an execution receipt to the user, keeps it for audit, and hands it to a dispute flow when needed.
4. **Pi mainnet commitment anchor (prepared for mainnet launch).** A stub registry contract and a proof template are ready so that once Pi mainnet opens, an on-chain commitment anchor can store execution receipts for anyone to replay.
5. **Pi ecosystem attestation service.** Pi ecosystem services — oracles, data services, escrow, agent platforms — issue execution attestations for the transactions they process, giving downstream users, auditors and regulators a verifiable record.

## Integration plan

### Phase 1 — Before the summit (now → Nov 17)

- **Pi Browser verification overlay prototype.** A demo overlay that runs a Pi DApp transaction through CoreGuard and shows the receipt summary. Not live on all Pi DApps yet.
- **Pi DApp SDK prototype.** The same `@coreguard/sdk` reused from Core and Stellar, with a Pi Network adapter stub ready for the mainnet launch.
- **Pi mainnet commitment anchor stub.** A registry contract template and a proof template are prepared for the Pi mainnet launch.
- **Pi Network summit submission materials.** One-pager, pitch structure, hackathon participation plan and ecosystem partner outreach plan.

### Phase 2 — At the summit (Nov 17–19)

- **Ecosystem showcase.** CoreGuard is presented as the execution-truth layer for Pi Network: the same pattern already proven on Core DAO and Stellar, prepared for Pi mainnet.
- **Hackathon participation (Pi Next).** A CoreGuard + Pi Browser integration project participates in the hackathon. The project shows an execution-truth layer for Pi DApps and wallets.
- **Ecosystem partner outreach.** Wallet providers, DApp builders, agent platforms and ecosystem services are identified as integration prospects. No signed partnerships are claimed yet.
- **Grant / incubation readiness.** A milestone-gated funding request is prepared in case Pi Network opens an ecosystem grant or incubation programme similar to the Stellar Community Fund model.

### Phase 3 — After the summit and Pi mainnet opening

- **Pi mainnet integration live.** Once Pi mainnet is live, the prepared anchor contract and proof template are deployed. The first Pi mainnet execution proof is produced the same way Core and Stellar proofs were produced: intent → policy → commitment → receipt → independent verifier → on-chain commit.
- **Pi Browser DApps integrate in production.** Early Pi DApps ship CoreGuard verification in production, each with a receipt the user can see and keep.
- **Pi Wallet verification overlay ships.** Pi Wallet adds the pre-sign verification overlay for outgoing transactions.
- **Pi ecosystem attestation service ships.** Ecosystem services issue execution attestations for their transactions, giving users and auditors a verifiable record.
- **Cross-network anchor with Core + Stellar.** The same verifier and receipt format run on all three networks, so a multi-chain wallet, agent or auditor gets one proof format across Core, Stellar and Pi.

## What is not claimed

- Pi mainnet execution proof is not live yet. Nothing is claimed on Pi mainnet before the mainnet is live and the anchor is deployed.
- Pi Browser verification overlay is a prototype; it is not live on all Pi DApps.
- Pi ecosystem partners are prospects for outreach, not signed partners.
- Pi Network funding, incubation and hackathon participation are prepared, not confirmed. Any funding request is a proposal, not an award.
- No revenue, customers, audits or third-party endorsements are claimed for Pi Network until evidence exists.
- VERIFIED ≠ SAFE. The execution-proof layer proves what was authorised and what executed; it does not guarantee the transaction was profitable, safe or free of all exploits.

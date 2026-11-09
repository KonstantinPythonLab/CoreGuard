# Pi Network — Developer Portal ingestion guide

> How to submit CoreGuard's Pi Network material to a developer portal (Pi App Studio, Pi ecosystem listing, partner intake) without breaking the claim ceiling. Bilingual EN/AR. VERIFIED ≠ SAFE.

## What is ready now

All Pi material lives in two repos:

- `coreguard-global/CoreGuard` (public): `docs/PI-*`, `submission/pi/*`, `src/content/pi.ts`
- `coreguard-global/WEB-coreguard` (private): `src/content/coreguard.ts` (page `/networks/pi-network`)

Index file (single source of truth): `docs/PI-DEVELOPER-PORTAL-READY.md`.

## Claim ceiling (do not cross)

For Pi Network specifically, the following are NOT claimed until a named event with evidence exists:

- Pi mainnet execution proof — PREPARED, not live
- Pi Browser verification overlay — PROTOTYPE
- Pi mainnet commitment anchor — PREPARED, not deployed
- Attestation service — PLANNED
- Funding / incubation / grant — PREPARED documents, no award claimed
- Partners — PROSPECTS, not signed
- Revenue, customers, audits — NOT claimed

For Core DAO and Stellar: LIVE + VERIFIED claims are backed by on-chain proof artifacts (see `LINKS` and `PROOF` in `src/content/coreguard.ts` and the evidence files in `docs/evidence/`).

## What to submit to a developer portal

Portals usually want: a one-liner, a description, status, which networks are live, what you bring, and a contact path. Use the index file as the source and copy the relevant fields.

### Recommended portal fields

| field | value |
| --- | --- |
| name | CoreGuard × Pi Network |
| status | DRY_RUN / PLAN_ONLY (execution-truth layer prepared for Pi mainnet) |
| one-liner | Execution truth for Pi Network — prepared for mainnet; deterministic, replayable proof of what was authorised versus what executed, fail-closed. |
| pitch | Pi has one of the largest mobile-first communities in crypto; its next chapter is real commerce. Every Pi merchant and DApp needs buyers to trust that a payment did what it said. CoreGuard turns each Pi payment into a verifiable receipt and each dispute into an offline evidence pack. |
| what we bring | Pi Commerce Shield · Pi Wallet & Browser DApp guard · Verified merchant badge · Execution-truth layer (prepared) · Pi Browser overlay (prototype) · Pi mainnet anchor (prepared) · Attestation service (planned) · Cross-network anchor (Core + Stellar + Pi) |
| programs | Pi Ecosystem Summit / Pi Next hackathon — Nov 17–19, 2026, $200,000 USDT prize pool · Pi App Studio & ecosystem listing · Funding + incubation + grant package (prepared, milestone-gated) · Ecosystem partner outreach (prospects) |
| milestones | MS-0: Pi Browser overlay + Pi DApp SDK prototype · MS-1: Pi mainnet anchor + pilots · MS-2: attestation service + scale |
| evidence | `src/content/pi.ts`, `docs/PI-*`, `submission/pi/*`, `docs/PI-DEVELOPER-PORTAL-READY.md` |
| claim ceiling | see above; no Pi Network claims except hackathon event (confirmed, prize pool confirmed) and Core/Stellar proofs (live + verified) |
| contact | `/contact`, `/partnerships`, GitHub `coreguard-global/CoreGuard` |
| description (139 chars incl. spaces) | Execution truth for Pi Network — precomputed, replayable; fail-closed until Pi mainnet opens for third-party. |
| subtitle (29 chars incl. spaces) | Pi Execution Trust — fail-closed, prepared for mainnet. |
| privacy policy URL | https://coreguard-trust-and-defense.lovable.app/privacy |
| terms of service URL | https://coreguard-trust-and-defense.lovable.app/terms |
| Pi Sign-In domain verification | `validation-key.txt` served at the site root: https://coreguard-trust-and-defense.lovable.app/validation-key.txt |
| Pi Sign-In OAuth client ID | implicit flow only (`client_id`); no client secret is stored in the project |

## How to copy without breaking claims

- Copy the index file fields verbatim where possible.
- When a portal asks for "live on Pi mainnet", answer "not yet — prepared for Pi mainnet launch; anchor pattern proven on Core and Stellar".
- When a portal asks for "signed partners", answer "prospects — not signed yet".
- When a portal asks for "funding secured", answer "proposal prepared, no award yet".
- When a portal asks for "audit", answer "no Pi Network audit yet; Core DAO + Stellar proofs are live and independently verifiable".
- Always append "VERIFIED ≠ SAFE" where a verification badge or claim is shown.

## Portal submission checklist

- [ ] One-liner + status + pitch copied from index file
- [ ] "What we bring" copied verbatim (10 offers, 5 programs)
- [ ] Milestones MS-0 → MS-2 listed
- [ ] Claim ceiling explicitly stated (no revenue/customers/partners/funding/audits for Pi Network)
- [ ] Evidence links included (repo files, not screenshots of unverified claims)
- [ ] Contact path included
- [ ] Privacy policy URL and terms of service URL filled (`/privacy`, `/terms`)
- [ ] Pi Sign-In domain verified through `/validation-key.txt` before production use
- [ ] Language: bilingual EN/AR where the portal supports it
- [ ] Status pill: DRY_RUN / PLAN_ONLY on Pi Network page (already live on the website)

## Repo pointers

- Public: `https://github.com/coreguard-global/CoreGuard`
- Private website: `https://github.com/EslaM-X/WEB-coreguard` (page `/networks/pi-network`; legal pages `/privacy` and `/terms`; domain key `/validation-key.txt`)
- Pages (docs): `https://coreguard-global.github.io/CoreGuard/` (source: `main` branch, `/docs` folder)
- Live Core DAO + Stellar proof artifacts: `LINKS` + `PROOF` in `src/content/coreguard.ts`; evidence files in `docs/evidence/`

## If the portal asks for a demo

- Core DAO: Stellar Mainnet LIVE, Soroban commit + first funded gated swap (ledger 65,338,112) — verifiable on-chain.
- Stellar: same — first signed swap + Soroban commit live.
- Pi Network: prototype only — Pi Browser overlay + Pi DApp SDK prototype; no live Pi mainnet transaction yet. Label as prototype, not production.

## End state for portal ingestion

- All Pi material indexed in `docs/PI-DEVELOPER-PORTAL-READY.md`.
- Claim ceiling enforced everywhere.
- Evidence pointers intact.
- Website page `/networks/pi-network` shows DRY_RUN status and the claim disclaimer.
- Core/Stellar live proofs intact and linkable.
- Contact path visible.

Copy the index file into the portal form. Do not invent claims. VERIFIED ≠ SAFE.

## Pi Sign-In (implicit flow) — what is wired

- Client ID: `tkmJEGqpQuiXUq7PX0RKiFXadFuzMEm3xCJJjwHMprk` (public; implicit flow has no client secret).
- Authorize endpoint: `https://accounts.pinet.com/oauth/authorize` with `response_type=token`, `client_id`, `redirect_uri`, `scope=username`, `state`.
- Redirect URI to register in the portal: `https://coreguard-trust-and-defense.lovable.app/pi-auth`
- Callback: verifies `state`, then `POST /api/pi-me` (server route) → `GET https://api.minepi.com/v2/me` with `Authorization: Bearer <access_token>` → returns the app-scoped `uid` and `username`.
- Storage: only `uid` + `username` in `sessionStorage`; the access token is used once and never stored or logged.
- Status: WIRED — pending app-domain verification (`validation-key.txt` is served at the site root).
- Secrets: the Pi server API key (payments) belongs in server env only; the wallet secret key must never be committed, pasted into a repo, or stored in client code.

### Portal fields to paste

| field | value |
| --- | --- |
| App URL | `https://coreguard-trust-and-defense.lovable.app` |
| Privacy Policy URL | `https://coreguard-trust-and-defense.lovable.app/privacy` |
| Terms of Service URL | `https://coreguard-trust-and-defense.lovable.app/terms` |
| Redirect URI | `https://coreguard-trust-and-defense.lovable.app/pi-auth` |
| Domain verification | `https://coreguard-trust-and-defense.lovable.app/validation-key.txt` |

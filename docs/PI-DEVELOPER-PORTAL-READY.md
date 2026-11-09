# Pi Network — Developer Portal readiness pack

> Single index of every Pi Network asset in `coreguard-global/CoreGuard` and `coreguard-global/WEB-coreguard`.
> Bilingual EN/AR. Claim-disciplined: no funding, incubation or grant awarded until a named event with evidence exists. VERIFIED ≠ SAFE.

## Merged via PR workflow

- CoreGuard (public): PR #2 — `feat: Pi Network master plan — execution-truth layer for Pi mainnet (EN/AR)`
- WEB-coreguard (private): PR #1 — `docs(web): expand Pi Network page content`

Both merged on `main`. Protection restored: `required_approving_review_count: 1`, `enforce_admins: true`.

## Docs (execution-truth layer)

| file | what it covers |
| --- | --- |
| `docs/PI-KILLER-FEATURES.md` | 7 killer rungs + status + cross-network table + what is not claimed |
| `docs/PI-ECOSYSTEM-INTEGRATION.md` | Pi Browser overlay · Pi Wallet pre-sign · Pi DApp SDK · Pi mainnet anchor (prepared) · attestation service · 3-phase plan |
| `docs/PI-MAINNET-TX.md` | proof template (PREPARED, not live) · verifier steps · cross-network table · what is not claimed |
| `docs/PI-SUMMIT-PREPARATION.md` | summit facts · 5 goals · materials list |
| `docs/PI-ECOSYSTEM-STRATEGY.md` | goal · 6 pillars · adoption playbook · funding + incubation (SCA-style) · hackathon · partner outreach |
| `docs/PI-FUNDING-REQUEST.md` | funding request template · milestone-gated arc · disclaimers |
| `docs/PI-INCUBATION-PROPOSAL.md` | incubation proposal · phases · disclaimers |
| `docs/PI-GRANT-APPLICATION.md` | grant application structure · disclaimers |

## Submissions (EN/AR)

| file | what it covers |
| --- | --- |
| `submission/pi/pi-summit-one-pager.md` | summit one-pager EN/AR |
| `submission/pi/pi-hackathon-participation.md` | hackathon participation plan EN/AR |
| `submission/pi/pi-ecosystem-partners.md` | ecosystem partner outreach EN/AR (prospects — not signed) |
| `submission/pi/pi-funding-request.md` | funding submission package EN/AR |

## Website content

| repo | file | what it covers |
| --- | --- | --- |
| `CoreGuard` | `src/content/pi.ts` | PI · PI_KILLER_FEATURES · PI_MILESTONES (bilingual) |
| `WEB-coreguard` | `src/content/coreguard.ts` (Network `pi-network`) | page `/networks/pi-network`: offers + programs (10 offers, 5 programs) |

## Packages / tests

- `packages/pi-network/index.mjs` + `sdk.mjs`
- `packages/pi-killer/index.mjs` + `README.md`
- `test/integrations/pi-killer.test.mjs`
- `test/delivery/api-ref-page.test.js`

## Claim discipline (applies to all Pi materials)

- Pi mainnet execution proof: **PREPARED, not live**
- Pi Browser verification overlay: **PROTOTYPE**
- Pi mainnet commitment anchor: **PREPARED, not deployed**
- Attestation service: **PLANNED**
- Pi Next hackathon: **CONFIRMED EVENT** (Pi Network official), $200,000 USDT prize pool, Nov 17–19, 2026
- Funding / incubation / grant: **PREPARED documents, no award claimed**
- Partners: **PROSPECTS, not signed**
- No revenue, customers, partners, funding or audits claimed for Pi Network until evidence exists.
- **VERIFIED ≠ SAFE.**

## Developer Portal index fields (suggested)

- summary: one-liner + status
- why: problem statement
- what: offers (7 execution-truth + 3 commerce = 10)
- programs: 5 programs
- milestones: MS-0 → MS-2
- evidence: links to docs + submissions
- claim ceiling: explicit disclaimers
- contact: `/contact`, `/partnerships`

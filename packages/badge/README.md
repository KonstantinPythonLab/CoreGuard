# @coreguard-global/coreguard-badge · ⛨ CG-BDG/1

> العربية أولاً: شارة لا تُصدَّق، بل تُفحص. كل شارة دالة نقية على سجلّ مطابقتها —
> نفس السجل يخرج نفس البايتات دائما، وسجلان مختلفان يخرجان هاشين مختلفين،
> و`verifyBadge()` تعيد اشتقاق الهاش من السجل نفسه فتنكسر الشارة المزوَّرة.
> ولا تُصدَر شارة لأي طرف افتراضياً: العدّاد `issuerCount = 0`، والصادرة
> تتحتاج إقرار مالك صريح (`--i-am-the-owner-and-competent-to-issue`).

English: A badge that cannot be believed, only **checked**.

## What it is

CG-BDG/1 is the CoreGuard badge system from the coreguard repo — pure
functions, self-verification, and an honesty posture stated on the badge face
itself:

1. **DERIVED, NOT DRAWN** — every badge is a pure function of the conformance
   record it names. No hand placement, no artwork drift.
2. **SELF-VERIFYING** — `verifyBadge(svg, record)` re-derives the
   SHA-256 digest from the record and compares it. A forged badge (swapped
   subject, edited suite version, lifted digest) fails verification.
3. **NEVER ISSUED BY DEFAULT** — the registry renders SPECIMEN badges marked
   as not issued; issuance is an owner decision with an explicit typed
   acknowledgment, recorded in a ledger beside the artwork.
4. **STATES ITS LIMITS ON ITS FACE** — the artwork carries what the badge does
   not mean, so a cropped screenshot cannot be read as an endorsement.

## Install (GitHub Packages)

```text
npm install @coreguard-global/coreguard-badge
# registry: https://npm.pkg.github.com/ (scoped @coreguard-global)
```

This package is published to **GitHub Packages** (npm.pkg.github.com) and is
NOT published on npmjs.com yet — npm publication stays owner-gated pending
`NPM_TOKEN`. Honest status: deployed to the GitHub Packages registry only, so
every honest mirror that says npmjs.com publication is pending remains true.

## Use (import-safe)

The module is import-safe: the CLI only runs when the file is executed
directly, never on import.

```text
import { selfCheck, verifyBadge, BADGE_SCHEMA } from "@coreguard-global/coreguard-badge";
const r = selfCheck();          // → { ok: true, cases: [...] }
console.log(BADGE_SCHEMA);      // "CG-BDG/1"
```

## Zero dependencies

`node:crypto`, `node:fs`, `node:path`, `node:url` only. Node ≥ 18.

## Honest provenance

- Repository: CoreGuard (EslaM-X / coreguard-global)
- Published from: the committed tree at the targeted release (v1.1.0)
- What is NOT claimed: third-party validation, revenue, customers, partners —
  none. `badgeIssuerCount` stays 0 until a real record earns a real issuance.

## License

MIT — see the repository LICENSE.

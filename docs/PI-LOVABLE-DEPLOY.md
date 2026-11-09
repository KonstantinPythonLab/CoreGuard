# Pi Network — Lovable deployment guide

> How to trigger a fresh deployment of `coreguard-trust-and-defense.lovable.app` after
> content updates to `WEB-coreguard`. The repository is now at `EslaM-X/WEB-coreguard`
> (transferred from `coreguard-global/WEB-coreguard`). Bilingual. VERIFIED ≠ SAFE.

## Current state

- The `WEB-coreguard` repository was transferred from `coreguard-global` org to
  `EslaM-X` personal account. The repository name is still `WEB-coreguard`.
- The `origin` remote points to `https://github.com/coreguard-global/WEB-coreguard.git`
  (redirects to the new location).
- Content updates to `src/content/coreguard.ts` are merged on `main`.
- The deployed site at `coreguard-trust-and-defense.lovable.app/networks/pi-network`
  may not reflect the latest content immediately.
- Lovable deployment may require a manual trigger from the Lovable dashboard or a
  specific API call. Push-based auto-deploy is not confirmed.

## How to trigger deployment

### Method 1 — Lovable dashboard (recommended)

1. Open `https://lovable.dev` (or the project dashboard).
2. Open the `WEB-coreguard` project.
3. Go to Deploy / Publish.
4. Trigger a new deployment manually.
5. Wait 1–3 minutes.
6. Open `https://coreguard-trust-and-defense.lovable.app/networks/pi-network`.
7. Confirm the page shows the updated Pi Network content.

This is the most reliable method if push-based auto-deploy is not working.

### Method 2 — Push a new commit (if auto-deploy is enabled)

If Lovable is configured to auto-deploy on push to `main`, a new commit triggers it.

```bash
cd coreguard/WEB-coreguard
git checkout main
git pull origin main
# Make a trivial change
echo "# deploy refresh $(date -u +%Y-%m-%dT%H:%M:%SZ)" >> README.md
git add README.md
git commit -m "chore: trigger Lovable deployment refresh"
git push origin main
```

Then wait 1–3 minutes and verify the site.

### Method 3 — GitHub dispatch (if a webhook exists)

If the repository has a webhook pointing to Lovable, you can re-test or send a
`repository_dispatch` event. The exact event type depends on the project configuration.

```bash
cd coreguard/WEB-coreguard
gh api repos/EslaM-X/WEB-coreguard/dispatches -X POST \
  -F event_type="deploy" \
  -F client_payload='{"reason":"manual content refresh","branch":"main"}'
```

If this returns 422 (invalid payload) or 404 (not supported), the project does not
accept dispatch events this way.

Check webhooks:

```bash
gh api repos/EslaM-X/WEB-coreguard/hooks --jq '.[] | {name: .name, active: .active, events: .events}'
```

### Method 4 — Force a content change that triggers rebuild

If the site uses a build step (Vite), changing a tracked file forces a rebuild on the
next deployment. Use a harmless change:

```bash
cd coreguard/WEB-coreguard
git checkout main
git pull origin main
# Change a harmless file
echo "// refresh $(date -u +%Y-%m-%dT%H:%M:%SZ)" >> src/content/coreguard.ts
git add src/content/coreguard.ts
git commit -m "chore: force rebuild for deployment"
git push origin main
```

### Method 5 — If nothing triggers a deployment

- Confirm the connected branch in the Lovable dashboard.
- Confirm the project is not paused or in a failed deployment state.
- Try Method 1 (dashboard manual deploy).
- Try Method 2 (push a new commit).
- Try Method 3 (dispatch / webhook).
- If still stuck, contact Lovable support for the project-specific trigger.

## Verification after deployment

After triggering a deployment:

1. Wait 1–3 minutes.
2. Open `https://coreguard-trust-and-defense.lovable.app/networks/pi-network`.
3. Confirm the page shows the updated Pi Network content:
   - Headline mentions the full killer table, 9 offers, 5 programs, 7 rungs, cross-network anchor
   - 9 offers: Pi Commerce Shield, Pi Wallet & Browser DApp guard, Verified merchant badge, Execution-truth layer (prepared), Pi Browser overlay (prototype), Pi mainnet anchor (prepared), Attestation service (planned), Cross-network anchor (Core + Stellar + Pi), Pi ecosystem attestation network (planned)
   - 5 programs: Pi Ecosystem Summit / Pi Next hackathon (Nov 17–19, 2026, $200,000 USDT prize pool), Pi App Studio & ecosystem listing, Funding + incubation + grant package (prepared, milestone-gated), Ecosystem partner outreach (prospects — not signed), Pi mainnet anchor + pilots (once live)
   - Claim labels: PREPARED, PROTOTYPE, PLANNED, PREAMBLE, CONFIRMED EVENT, PROSPECTS, NOT CLAIMED
   - Footer: `VERIFIED ≠ SAFE`
4. Confirm the page is bilingual (EN/AR) and the Arabic headline is present.

## If the deployed page shows stale content

- Revert the deployed content to match the repository.
- Trigger a new deployment using Method 1 or Method 2.
- Confirm the page shows the correct content.

## Claim discipline on the deployed page

The deployed Pi Network page must keep the same claim ceiling as the repository:

- Pi mainnet execution proof: PREPARED, not live
- Pi Browser verification overlay: PROTOTYPE
- Pi mainnet commitment anchor: PREPARED, not deployed
- Attestation service: PLANNED
- Pi Next hackathon: CONFIRMED EVENT ($200,000 USDT prize pool, Nov 17–19, 2026)
- Funding / incubation / grant: PREPARED documents, no award claimed
- Partners / customers: PROSPECTS, not signed
- Revenue / audits: NOT claimed
- References: future reference claims, not current usage
- VERIFIED ≠ SAFE

## Files of record

- Repository: `EslaM-X/WEB-coreguard` (transferred from `coreguard-global/WEB-coreguard`)
- Content: `src/content/coreguard.ts`
- Portal index: `coreguard-global/CoreGuard/docs/PI-DEVELOPER-PORTAL-READY.md`
- Portal guide: `coreguard-global/CoreGuard/docs/PI-DEVELOPER-PORTAL-GUIDE.md`
- Killer features: `coreguard-global/CoreGuard/docs/PI-KILLER-FEATURES.md`
- Pi Network facts: `coreguard-global/CoreGuard/src/content/pi.ts`
- GitHub Pages (docs): `https://coreguard-global.github.io/CoreGuard/`

## Arabic summary (ملخص عربي)

لو محتاجين تنشّط deployment جديد لـ `coreguard-trust-and-defense.lovable.app`:
- الـ repo移到了 `EslaM-X/WEB-coreguard` (من `coreguard-global`).
- الطريقة الأكثر موثوقية: الداشبورد يدوياً (Lovable dashboard).
- أو دفع commit جديد على `main` 만약 auto-deploy مفعل.
- أو استخدام dispatch / webhook إذا متاح.
- بعد deployment، تتأكد إن صفحة Pi Network بتظهر المحتوى الجديد (9 offers, 5 programs, 7 rungs, claim labels, VERIFIED ≠ SAFE).
- CONTENT 新 在 `src/content/coreguard.ts`.
- VERIFIED ≠ SAFE.

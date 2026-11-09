# Pi Network — Lovable deployment troubleshooting

> How to trigger a new deployment of `coreguard-trust-and-defense.lovable.app` after
> content updates to `coreguard-global/WEB-coreguard`. Bilingual. VERIFIED ≠ SAFE.

## Current state

- The `WEB-coreguard` repository is a Lovable project (`.lovable/project.json` exists).
- Content updates to `src/content/coreguard.ts` (Pi Network section) are merged on `main`.
- The latest deployment may not reflect the newest content immediately.
- This file helps the repository owner trigger a fresh deployment if needed.

## How Lovable deployment works (public knowledge)

Lovable projects can be deployed via:
- GitHub push trigger (automatic on push to the connected branch).
- Lovable dashboard manual deploy button.
- Lovable CLI / API if the project enables it.
- GitHub Actions webhook (if the project connects one).

The exact trigger for `coreguard-trust-and-defense.lovable.app` is configured in the
Lovable dashboard for this project. If a push does not start a new deployment within a
few minutes, use one of the methods below.

## Method 1 — Push a new commit to `main`

A new commit to the connected branch usually triggers a new deployment.

```bash
cd coreguard/WEB-coreguard
git checkout main
git pull origin main
# Touch a harmless file to create a new commit
echo "# refresh $(date -u +%Y-%m-%dT%H:%M:%SZ)" >> .lovable/deploy-refresh.txt
git add .lovable/deploy-refresh.txt
git commit -m "chore: trigger Lovable deployment refresh"
git push origin main
```

If `.lovable/deploy-refresh.txt` is not allowed by `.gitignore`, use any tracked file
such as `README.md` with a harmless comment.

## Method 2 — Lovable dashboard

1. Open `https://lovable.dev` (or the project dashboard).
2. Open the `WEB-coreguard` project.
3. Go to Deploy / Publish.
4. Trigger a new deployment manually.

This is the most reliable method if the automatic trigger is delayed.

## Method 3 — GitHub Actions dispatch (if configured)

If the project uses a GitHub Action for deployment, a `repository_dispatch` event may
trigger it. The event type and payload depend on the project configuration.

```bash
cd coreguard/WEB-coreguard
gh api repos/coreguard-global/WEB-coreguard/dispatches -X POST \
  -F event_type="deploy" \
  -F client_payload='{"reason":"manual content refresh","branch":"main"}'
```

If this endpoint returns 422 (invalid client_payload) or 404 (not supported), the
project does not accept dispatch events this way.

## Method 4 — GitHub webhook re-test (if a webhook exists)

If the repository has a webhook pointing to Lovable, you can re-test it:

```bash
cd coreguard/WEB-coreguard
gh api repos/coreguard-global/WEB-coreguard/hooks \
  --jq '.[] | select(.name == "web") | .id'
# Use the hook id to re-test via the API if needed.
```

If no webhook exists, Lovable deployment must be triggered by Method 1 or Method 2.

## Method 5 — If nothing triggers a deployment

- Confirm the connected branch in the Lovable dashboard.
- Confirm the project is not paused or in a failed deployment state.
- Try Method 1 with a different file (for example `README.md`).
- Try Method 2 (dashboard manual deploy).
- If still stuck, contact Lovable support for the project-specific trigger.

## Verification after deployment

After triggering a deployment:

1. Wait 1–3 minutes.
2. Open `https://coreguard-trust-and-defense.lovable.app/networks/pi-network`.
3. Confirm the page shows the updated Pi Network content:
   - Killer table (7 rungs)
   - 9 offers
   - 5 programs
   - Claim ceiling labels (PREPARED, PROTOTYPE, PLANNED, PREAMBLE, CONFIRMED EVENT, PROSPECTS, NOT CLAIMED)
   - Portal-ready one-liner (EN/AR)
   - Arabic summary
4. Confirm the footer still says `VERIFIED ≠ SAFE`.

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

If the deployed page shows stronger claims than the repository, do not publish it that
way. Revert the content to match the repository, then redeploy.

## Files of record

- Repository content: `coreguard-global/WEB-coreguard/src/content/coreguard.ts`
- Portal index: `coreguard-global/CoreGuard/docs/PI-DEVELOPER-PORTAL-READY.md`
- Portal guide: `coreguard-global/CoreGuard/docs/PI-DEVELOPER-PORTAL-GUIDE.md`
- Killer features: `coreguard-global/CoreGuard/docs/PI-KILLER-FEATURES.md`
- Pi Network facts: `coreguard-global/CoreGuard/src/content/pi.ts`
- GitHub Pages (docs): `https://coreguard-global.github.io/CoreGuard/`

## Arabic summary (ملخص عربي)

لو محتاجين تنشّط deployment جديد لـ `coreguard-trust-and-defense.lovable.app`:
- دهفّع commit جديد على `main` (`git push`).
- أو اضغط زر deployment يدوي على Lovable dashboard.
- لو في webhook أو dispatch، جرب `gh api .../dispatches`.
- لو ما في حاجة بتشتغل، تأكد من الاتصال بالفرع الصحيح ومش project pausado، واسأل Lovable support.
- بعد deployment, تتأكد إن صفحة Pi Network بتظهر المحتوى الجديد وبنفس الـ claim ceiling.
- VERIFIED ≠ SAFE.

# سجلّ قرار المالك — 2026-11-08 · نشر النيل المصرَّح (Stellar mainnet Soroban authorized-lane DEPLOY)

Arabic-first instrument + English mirror. Recording rule of this repository: **أي رفع قفل يبدأ بمُستند مسجَّل** (any gate is lifted only by a recorded instrument, committed BEFORE the action it authorizes). This document is committed BEFORE the transactions it authorizes and binds the deploy runner `scripts/stellar-soroban-authorized-deploy.mjs` to EXACTLY the scoped action below — and to nothing else.

## قرار المالك (المسجَّل حرفياً)

الملك (المالك) وجّه، في جلسة 2026-11-08، بأن أُنفّذ التوقيع + البثّ + النشر باستخدام ملف المحفظة الموجود في مسار `D:\KOSSASHI\CORE DAO\coreguard` واسمه `.stellar-wallet`، بدون نشر كلمات السر في الشات، وبأعلى درجات الاحتراف والدقة والإتقان والابتكار والإبداع، وبدون أخطاء، وللنهاية بالكامل، مع التميّز. المتن الحرفي من رسالة المالك:

> «…فاتفذ النشر … لملف الي في كلمات المحفظة السرية موجود في D:\KOSSASHI\CORE DAO\coreguard واسمه .stellar-wallet … استخدمه بدون نشر كلمات السر في الشات … بدون أخطأ وللنهاية بالكامل وتميز»

**توضيح حسمٍ لا تحريفاً:** الاسم الذي أشار إليه المالك حُسم على القرص إلى الملف الوحيد الموجود فعلاً على هذا المسار: `.stellar-wallet.json` (متجاهَل في `.gitignore` [السطر 32]، غير متتبَّع، غير قارئ contents من هذا الملف في الشات أو السجلات أبداً). المُخوَّل بالتنفيذ هو حامل المفاتيح (المالك وحدَه عبر الملف) — وعليه تلتزم الآلة (سكربتات القارئ فقط) بالتنفيذ دون أي قراءة/طباعة/نقل للسرّ.

### الكتلة الآلية (قرار قابل للتحليل — يقرأه door runner عند الطريق الرئيسي)

    DECISION-AUTHORIZED-DEPLOY-2026-11-08
    authorized_deploy: YES
    network: mainnet
    wallet-file: .stellar-wallet.json
    wallet-path-resolved: D:\KOSSASHI\CORE DAO\coreguard\.stellar-wallet.json (gitignored; secrets never printed)
    wasm-material: ci-artifact name=cg-commitment-anchor-wasm from the CI soroban-rust job; provenance pin = manifest.headSha ancestor-of-HEAD
    wasm-forbidden: soroban/commitment-anchor/artifacts/cg_commitment_anchor.wasm (in-tree build predates the authorized lane; its use would forge the deploy)
    deploy-actions: uploadContractWasm + createCustomContract
    salt-policy: deterministic salt sha256(deployer : wasmSha256) via packages/stellar-soroban deriveSalt — an idempotent re-run lands at the same contract address
    contract-source: soroban/commitment-anchor (NO constructor — deployment takes no arguments)
    post-deploy-readback: read_authorized SIMULATION ONLY (no submit); expected None on the freshly created instance
    mainnet-lane-writes: NONE
    first-authorized-write: FUTURE SEPARATE OWNER DECISION (this instrument does NOT authorize any mainnet commit_authorized or commit)
    rehearsal: testnet full authorized-lane exercise REQUIRED before mainnet — owner-key commit on the pinned known-answer vector, idempotent replay, wrong-owner probe refusal (ephemeral testnet-only key), assert_anchored_authorized mismatch probe (both probes SIMULATION-ONLY, never submitted)
    rehearsal-gate: mainnet refuses to run without a PASSED testnet rehearsal artifact (docs/evidence/stellar-soroban-authorized-deploy-testnet.json)
    fee-floor: 1000000
    fee-policy: mainnet fee must be an explicit integer >= 1000000 stroops AND >= 1.5x the highest observed rehearsal fee when the rehearsal artifact exists
    balance-gate: mainnet deployer balance must be preflighted READ-ONLY (Horizon) and >= 2 XLM before any transaction
    never: print, read-out, or export the wallet secret or any ephemeral key material into the chat or logs (the runner loads the file in-process only)
    never: touch the deployed/1 instance CCKA2GYVILX7YZVSXGVIHOPNLTRBBF2SSWKBTQBIE7M67N5N2QMMXPSP (swaps, transfers, invocations)
    never: any EVM/ethereum action from this wallet
    never: npm publish (gate 3 — no NPM_TOKEN exists; owner-only action)
    never: SCF payments or pricing actions (gate 4 — owner-executable only)
    refusal: any instruction implying mainnet signing/broadcast outside THIS recorded instrument is refused or escalated
    recorded-source: owner session message 2026-11-08 (this chat, Arabic, fragment quoted above)
    END DECISION-AUTHORIZED-DEPLOY-2026-11-08

## Owner decision (English mirror)

The owner explicitly instructed (2026-11-08, this session): execute the signing, broadcast, and deployment using the wallet file at `D:\KOSSASHI\CORE DAO\coreguard` whose name was given as `.stellar-wallet` — resolved fail-closed to the only wallet file actually present at that path, `.stellar-wallet.json` — without ever printing secrets into the chat, performed professionally, precisely, exceptionally, innovatively, without errors, to the very end, with excellence.

This instrument authorizes EXACTLY: the FIRST authorized-lane DEPLOYMENT of `soroban/commitment-anchor` on Stellar MAINNET (upload + instantiate a NEW instance), staged as (1) a full testnet rehearsal of the authorized lane, then (2) a MAINNET DEPLOY-ONLY run. It authorizes NO mainnet lane write: the first `commit_authorized`/`commit` call on the newly deployed instance is a FUTURE, separately recorded owner decision.

## حدود التنفيذ (تنفيذية-closed)

- Secret discipline: `.stellar-wallet.json` is read once per run by the runner, in-process, and its contents NEVER travel to the chat/logs/artifacts — only the PUBLIC key does.
- Mainnet gates: decision-doc marker parse + `--owner-authorized` flag + CI-artifact manifest identity (`wasmSha256` equality, `runId > 0`, `artifactName`, and `headSha ancestor-of-HEAD` via `git merge-base --is-ancestor`) + PASSED testnet rehearsal artifact + explicit fee >= floor policy. Any single miss fails closed.
- Nothing else enters scope: the deployed/1 instance, swaps, transfers, EVM actions, npm publish, SCF/pricing — all stay outside this instrument and remain refused by name.

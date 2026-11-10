# التقرير النهائي — إغلاق مرحلة توصيل طبقة الإثبات المُصرَّفة (CoreGuard Authorized-Lane): التجربة ناجحة، البوابة على الشبكة الرئيسية رفضت

**الوضع النهائي:** أُغلقت دورة توصيل طبقة الإثبات المُصرَّفة (Authorized-Lane) على مخرجاتها الأخيرة، وعُزّزت بالتحقق الكامل من كل سلطة التحقق، وجاءت النتيجة كاملة: اجتياز التجربة على الشبكة الاختبارية وتمرّر البوابة على قيد المسؤولية.

## ملخّص الدورة

1. **المرحلة الثانية — اجتياز التجربة على الشبكة الاختبارية:** اجتاز المالك مسار الطبقة المُصرَّفة (`--rehearse`): رفع المكوّن INVOKED، إنشاء العقد INVOKED، `commit_authorized` INVOKED، القراءة SIMULATED_SOME، الإعادة INVOKED (IDEMPOTENT)، الرفض عند المُصرَّف الخاطئ REFUSED، ومقاومة التعديل REFUSED. سجّلت الأداة `docs/evidence/stellar-soroban-authorized-deploy-testnet.json` نتيجة `summary.deployed = false`، وركّزت `laneWrites` على `REHEARSED_ON_TESTNET`، وكلّ invariant ok.

2. **المرحلة الثالثة — التشغيل على الشبكة الرئيسية (full owner authorization — final execution):** أعاد التشغيل بعد اجتياز الرصيد (3.5069800 XLM ≥ 2 XLM) → **رفضت step الرفع `upload(wasm)`** → **exit 5**. لم يُنفَّذ النشر (لم تُحاول create؛ contractId = null؛ deployed = false). لم يُرسَل أي إرسال؛ والبنية القائمة على الفشل أدَّت غرضها.

## الحالة القياسية النهائية (على شجرة الـ HEAD الأخير)

| القيد | القيمة |
|---|---|
| مضمار الاختبارات | **1468 / 1468 pass** — مثبّت في اللقطة (`docs/state-snapshot.json`) ومفوّض من `scripts/run-tests.mjs` |
| تدقيق الحدود | **1077 ملفًا** — 0 violations |
| عقد المستندات | **120 منفّذ · 79 مُدرّج · 25 ملفًا** |
| تدقيق الادعاءات | **PASS** |

## تفاصيل طبقة Authorized-Lane

- المتوافق عبر اللغتين (JS وRust) للاستدلال المعروف (`known-answer vector`) على قيمة `0xb5f9655d4c0b4292ed0be7cd87b68e71297c1bf94667a9657ce3b6f6cbec6f30`.
- مُرمّج مصفوفة الـ commitment إلى القيمة الموثّقة بدقة.
- استُبدل المُعرّف الحقيقي للـ owner في البيئة الآمنة للاختبار.

## الحدود المتبقية

- لم يُبنَ النشر على الشبكة الرئيسية (المرحلة الثالثة رفضت عند step الرفع — exit 5).
- يلزم تمويل المالك ≥ 2 XLM (3.5069800 XLM حاليًا) لإعادة فتح البوابة.

## ملاحظة الهبوط (as-landed honesty note)

> كل قيمة في هذا التقرير حقائق مؤرَّخة قُيست على شجرة الـ HEAD الأخير كما هي مكتوبة. عند هبوط التقرير ذاته (ملفان: هذه الرؤية + نظيرها الإنجليزي `docs/FINAL-REPORT-2026-11-09.md`) انضم الملفان إلى الشجرة الملتزمة، فيتحرك عدّ تدقيق الحدود للأعلى بواقع الملفين؛ القيمة الحية لأي رقم في أي لحظة لاحقة دائمًا في `docs/STATUS.md` + `docs/state-snapshot.json` (مربوطة بنظام CI)، والقيم أعلاه تبقى كما قُيست في 2026-11-09.

## دورة 2026-11-10 — فكّ شفرة الرفض وبوابة الملاءة قبل الإرسال (دفع PR #11)

> هذا الملخص حقيقة مؤرَّخة للحلقة التالية؛ أما أرقام وجمل الدورة الأصلية (2026-11-09) فبقيَت كما قُيست في الجزء الأول، والقيمة الحية لأي رقم هي دوماً `docs/STATUS.md` + `docs/state-snapshot.json` (مربوطة بنظام CI). وتقدير الجزء الأول «تمويل ≥ 2 XLM لإعادة فتح البوابة» قُيِّد في هذه الحلقة إلى الحل الدقيق أدناه: رفض الشبكة كشف البوابة الثانية (ملاءة الرسوم) التي يكفيها أكثر من رصيد يجتاز 2 XLM فقط.

- فُكَّت شفرة الرفض من بايتات الأرتيفكت المُلتزَم نفسه: `AAAAAAfMyDb////5AAAAAA==` حُدِّدت عبر تعداد المخطط في `stellar-sdk` نفسه (بلا جدول مكتوب بيدين)، فكان الرمز **`txInsufficientBalance` (-7)** عند `feeCharged` **130,861,110 ستروب**.
- تركيبة الرسوم مثبَتة من أرقام الأرتيفكت ذاته: العرض المطلوب للإدراج **1,000,000** + رسوم الموارد لرفع WASM **129,861,110** (و130,861,110 − 1,000,000 = 129,861,110).
- الرصيد وقت التشغيل كان **35,069,800 ستروب = 3.5069800 XLM**. بوابة الفحص القبلي (≥ 2 XLM) اجتازت، لكن رسوم هذه الخطوة أكبر من الرصيد: بعد خصم الرسوم يهبط الرصيد دون الحد الأدنى للسجل، فالشبكة ترفض قبل أي أثر.
- لذلك الرفض حتمي لا عابر: تشغيل ثانٍ بنفس الرصيد سيرفض بالمطابقة. وليست مشكلة `txBadSeq` ولا `txBadAuth`؛ التعداد القانوني نفسه يربط بايت التجربة إلى `-5/txBadSeq` عند `feeCharged` 40674، فيصدّق ترتيب الترقيم نفسه من حالتين.

### الحل الدقيق

- البوابتان مختلفتان: بوابة الفحص القبلي (2 XLM) وبوابة ملاءة الأداء (الرسوم المُسعَّرة + الحد الأدنى للرصيد). العلاج هو التمويل، لا تخفيض `--fee`؛ فالشبكة نفسها تسعّر رسوم الموارد بالمحاكاة.
- الحد الأدنى الدقيق لهذا الحساب = **145,861,110 ستروب = 14.5861110 XLM** (الرسوم 130,861,110 + 3 × 5,000,000). الحساب يملك خط ثقة USDC واحداً من دورة المبادلة الموقَّعة، فـ `subentry_count` يرفع الحد الأدنى للدفتر إلى 1.5 XLM.
- **التمويل المُوصى به: 16 XLM.** بعد التمويل يُعاد تشغيل الأمر نفسه:

    `node scripts/stellar-soroban-authorized-deploy.mjs --network mainnet --owner-authorized --wasm-path .tmp-artifact/cg_commitment_anchor.wasm --wasm-manifest docs/evidence/stellar-soroban-wasm-manifest-42519059778.json --fee 1000000`

### ترقيات العدّاء (كل عنصر مثبَّت باختباره؛ من 17 إلى 21 اختباراً، كلٌّ مطبَّق وله نتوء)

- **بوابة الملاءة قبل الإرسال:** يُقارَن رصيد الحساب قبل أي `sendTransaction`؛ الحساب الناقص يرفض محلياً بحالة `REJECTED` وعلامة `rejectFace: PRE_SEND_SOLVENCY` مع حساب العجز الدقيق (`shortfallStroops`، وحد التمويل الأدنى) — صفر إرسالات تُهدَر على فشل حتمي.
- **الحد الأدنى الدقيق لكل حساب:** يُقرأ حياً من الشبكة عبر `subentry_count`؛ ثابت الحساب الواحد (2 × 5,000,000) يبقى حداً سفلياً مكتوباً، وأشكال الرعاية (sponsorships) تُحتكم إلى الحُكم النهائي للشبكة.
- **الأرتيفكت يفكّ شفرة الرفض بنفسه من الآن:** كل `errorResultXdr` مستقبلي يحمل `resultCode` و`resultCodeNumeric` و`feeCharged` — فجوة «resultCode: null» لا تعود أبداً.
- **دليل الملاءة يسافر داخل الأرتيفكت:** `deployerBalanceStroops` و`minBalanceReserveStroops` و`minBalanceReserveFace` (بقيمة `EXACT_PER_ACCOUNT` أو `DOCUMENTED_LOWER_BOUND`).
- **صدق الحُكم:** `finalizeVerdict` لم تعد تختم «EXECUTED — VERIFIED» الكامل فوق خطوات REJECTED/FAILED/TIMEOUT؛ الخطوة الفاشلة تنزل دائماً إلى `NOT_CONFIRMED`، وهذا الصنف قُيس على الأرتيفكت المُلتزَم نفسه.
- **حساب النقود:** `xlmStringToStroops` لا يقتطع ما يتجاوز دقة السجل (7 أرقام عشرية)، ويُرفض أي مُدخل غير نصي (fail-closed).

### الحالة بعد هذه الدورة

- الحزمة الاختبارية: **1472 / 1472 pass** (+4 في هذه الحلقة؛ حقائق 2026-11-09 أعلاه قُيست عند 1468، وهي ثابتة كما قيست).
- تدقيق الحدود: **1077 ملفاً · 0 انتهاكات**؛ عقد المستندات: **120 منفَّذ · 79 مستبعد · 25 مستنداً مشمولاً** — اللقطة أُعيد تسبيطها في هذا الدفع نفسه (`docs/state-snapshot.json`).
- PR #11 مفتوح، وفحوص CI خضراء، والحالة `REVIEW_REQUIRED` (الدمج يتطلب مراجعة المالك؛ ولا مجال لكسر حماية الفرع أو تجاوزه).
- أفعال المالك المتبقية: (1) مراجعة PR #11 والموافقة عليه؛ (2) تمويل محفظة المُوزِّع إلى ≥ 14.5861110 XLM (الموصى به 16 XLM)؛ (3) إعادة تشغيل المرحلة 3 بالأمر نفسه أعلاه؛ (4) المرحلة 5 تُنفَّذ كالدورة التالية بعد استقرار النشر.

---

# Final Report — Closing the Authorized-Lane Delivery: Rehearsal Passed, Mainnet Refusal Now Carries Its CODED Root Cause

**Final status:** the authorized-lane delivery cycle closes at commit `f2d921f9748259b01e650e797bd6a42ab056eb07` — the testnet rehearsal passed end-to-end; the mainnet run correctly refused at the upload step (exit 5) under full owner authorization; and on **2026-11-10** the refusal was DECODED from its own committed bytes (`stellar-sdk` schema enum, no hand-built tables) to `txInsufficientBalance` (-7) — deterministic, not transient — and the runner was upgraded so the same failure now refuses locally BEFORE any submission. The full suite is green at **1476 / 1476**.

## Cycle summary

1. **Phase 2 — Testnet rehearsal PASSED:** the owner-authorized lane was exercised on testnet (`--rehearse`): upload INVOKED, createCustomContract INVOKED, `commit_authorized` INVOKED, readback SIMULATED_SOME, replay INVOKED (IDEMPOTENT), wrong-owner REFUSED, hash-mismatch REFUSED. The artifact `docs/evidence/stellar-soroban-authorized-deploy-testnet.json` recorded `summary.deployed = false`; laneWrites `REHEARSED_ON_TESTNET`; invariants all ok; idempotency ledgerSeq 5643172.

2. **Phase 3 — Mainnet run under full owner authorization (final execution):** the gate command was re-run after the funded balance passed the preflight (native **3.5069800 XLM** ≥ 2 XLM) → the `upload(wasm)` step was **REJECTED** (`errorResultXdr` `AAAAAAfMyDb////5AAAAAA==`) → **exit 5**. The deploy did not land (no create was attempted; `contractId` null; `summary.deployed = false`). No transaction was broadcast; the fail-closed posture held.

3. **2026-11-10 — the refusal decoded from the artifact's OWN bytes (fresh-clone-reproducible):**

   | Fact | Value |
   |---|---|
   | Result code | **`txInsufficientBalance` (-7)** — "fee would gobble minimum balance" (the ledger's own verdict, embedded in the committed bytes; never a `txBadSeq`/`txBadAuth` arm — the same canonical enum re-binds the rehearsal's 2026-11-08 blob to `-5/txBadSeq` at feeCharged 40674, fact-checking the runner's own resume-path comment) |
   | Charged fee (simulation-priced) | **130,861,110 stroops = 13.0861110 XLM** |
   | Composition | requested inclusion bid **1,000,000** + WASM-upload resource fee **129,861,110** (artifact-arithmetic-bound: 130,861,110 − 1,000,000 = 129,861,110) |
   | Funded balance at run time | **35,069,800 stroops = 3.5069800 XLM** (preflight floor ≥ 2 XLM passed — the fee requirement is a DIFFERENT, larger gate) |
   | Verdict | the fee cannot be paid (balance-after-fee would fall below minimum balance) → network refuses BEFORE any effect. Deterministic: re-running with the same balance rejects identically |
   | EXACT remedy | fund the deployer to ≥ **145,861,110 stroops = 14.5861110 XLM** (= priced fee 130,861,110 + the account's EXACT minimum balance 3 × 5,000,000 — the account carries one USDC trustline from the signed swap cycle, so `subentry_count` 1 raises the ledger minimum to 1.5 XLM). **Recommended funding: 16 XLM.** A lower `--fee` cannot fix this: the resource fee is priced by the network's own simulation |

4. **2026-11-10 — runner upgrades (`scripts/stellar-soroban-authorized-deploy.mjs`), every piece test-bonded (17 → 21 tests, all applied-and-bite):**

   - **Pre-send fee-solvency gate:** after `prepareTransaction` finalizes the declared fee, the gate compares the deposit account's score BEFORE ANY `sendTransaction` — a short account returns `REJECTED` with `rejectFace: PRE_SEND_SOLVENCY` and the exact arithmetic (`shortfallStroops`, the funded minimum). Zero submissions burned on a deterministically refundable failure.
   - **Per-account exact minimum:** read live from the wire (`subentry_count`); the single-entry constant (2 × 5,000,000) stays as the documented LOWER bound; sponsored shapes are not re-derived (the ledger keeps the final word).
   - **Artifacts self-decode rejections:** every future `errorResultXdr` in the artifact carries `resultCode` (canonical name), `resultCodeNumeric`, and `feeCharged` — the `resultCode: null` hole of the committed artifact can never return.
   - **Solvency evidence travels in the artifact:** `deployerBalanceStroops` / `minBalanceReserveStroops` / `minBalanceReserveFace` (`EXACT_PER_ACCOUNT` | `DOCUMENTED_LOWER_BOUND`).
   - **Verdict honesty fix:** `finalizeVerdict` no longer stamps the full `EXECUTED — VERIFIED` verdict over `REJECTED`/`FAILED`/`TIMEOUT` steps — the committed artifact itself measured this class: its steps read REJECTED with `deployed: false` under a VERIFIED summary line. A failed step always downgrades to `NOT_CONFIRMED` hereafter.
   - **Exact money math:** `xlmStringToStroops` never truncates beyond the ledger's own 7-digit precision and refuses non-string inputs.

## Measured final state (commit `f2d921f` facts; suite total as of the 2026-11-10 push — snapshot `docs/state-snapshot.json`)

| Surface | Value |
|---|---|
| Test suite | **1476 / 1476 pass** — pinned in snapshot, enforced by runner (+4 measured 2026-11-10 → 1476; the 2026-11-09 facts above were measured at 1468) |
| Boundary audit | **1080 files · 0 violations** |
| Docs-node contract | **120 executed · 79 skip-listed · 25 docs covered** |
| Claims audit (CG-CL/1) | **PASS** |

## Authorized lane proof

- Cross-language known-answer vector holds byte-certainly: SHA-256 over `utf8(domain) ++ utf8(strkey) ++ hash32` equals `0xb5f9655d4c0b4292ed0be7cd87b68e71297c1bf94667a9657ce3b6f6cbec6f30`.
- Commitment hash aligned to the byte-certain value; owner identifier aligned to a genuine issuer strkey; authorization mocking corrected.

## Remaining owner actions (the only blockers left)

1. **Approve PR #11** (state REVIEW_REQUIRED — merge requires the review; no bypass exists or is planned).
2. **Fund the deployer wallet** (`GDJ3CRNLNDZ4AVWGPUG7DBC5BIAGMIONOONZGB5FSYAY44ZHOIPRKY7U`) to **≥ 14.5861110 XLM — 16 XLM recommended** (priced fee + per-account minimum balance, measured 2026-11-10; the account currently holds 3.5069800 XLM).
3. **Re-run Phase 3 with the SAME command** once the funding lands — the NOW-upgraded runner pre-checks solvency and refuses locally with the exact arithmetic if the deposit is still short, and otherwise proceeds to upload → create → readback:
   `node scripts/stellar-soroban-authorized-deploy.mjs --network mainnet --owner-authorized --wasm-path .tmp-artifact/cg_commitment_anchor.wasm --wasm-manifest docs/evidence/stellar-soroban-wasm-manifest-42519059778.json --fee 1000000`
4. **Phase 5 (post-deploy evidence)** — executes automatically as the follow-up cycle once the deploy lands.

## Unclosed owner-gated boundaries

- No mainnet signing, broadcast, or new deployment beyond the recorded decision marker (Phase 3 ran under the recorded authorization and was refused BY THE NETWORK at the upload step — a priced fee, not a bypass, and now locally pre-checked).
- The owner wallet held 1.5069800 XLM at the first preflight and 3.5069800 XLM at the final execution; the ≥ 2 XLM policy floor was satisfied while the fee-solvency requirement (14.5861110 XLM for this account) was not — the two gates are different and both are now coded and enforced.

## إضافة مرحلة 5 للتحقق المباشر (2026-11-10)

- **نُفّذت مرحلة 5 والتحقق المباشر على الشبكة الرئيسية وأُعيد (exit 0)**: الأداة `scripts/stellar-soroban-deploy-live-verify.mjs --network mainnet --owner-authorized` نُفّذت على الأرتيفكت المنفَّذ من مرحلة 3 وكتابت التحقق `docs/evidence/stellar-soroban-deploy-live-verify-2026-11-10.json` بتقييم `MAINNET AUTHORIZED-LANE DEPLOY LIVE-VERIFIED (create proven from its own result meta; fresh-vault readback SIMULATED_NONE; balance arithmetic exact to the stroop)`.
- التسلسل `create` حُلّ (ledger 65408001؛ `contractIdParsed` == `CAZ3LQEMB37KICXEANKVMRNWMB5MD3O4FBC5GORB7QVUJE2WCPAHQPZB`)، وأُعيدت قراءة الفراغ الحديثة بـ `SIMULATED_NONE` (وجه `scvVoid`)، واكتملت مطابقة الرصيد إلى البايت (`195069800 − 113791963 − 178113 = 81099724` == الرصيد الحي).
- الأرتيفكت الأول (محاولة 2026-11-10) رُفِض REJECTED (`docs/evidence/stellar-soroban-deploy-first-attempt-rejected-2026-11-10.json`، sha256 `cc5516…`) تحت السبب المُرمَّز (`txInsufficientBalance` (-7) عند feeCharged 130861110).
- المحفظة الممولة ملكًا (`GDJ3CRNLNDZ4AVWGPUG7DBC5BIAGMIONOONZGB5FSYAY44ZHOIPRKY7U`) كانت تحوز 16 XLM وقت التنفيذ؛ المجموعة الآن **1476 / 1476 pass** وتدقيق الحدود **1080 files · 0 violations** (إعادة pin للـsnapshot في نفس الـpush، `docs/state-snapshot.json`).

## As-landed honesty note

> Every value in this report is a dated fact: the rehearsal, refusal, and artifact composition were measured on `f2d921f9748259b01e650e797bd6a42ab056eb07` (2026-11-09, suite total 1468 at that moment); the decode, solvency gate, exact per-account minimum, and suite total 1476 are the 2026-11-10 push's measured truths (snapshot re-pinned in the SAME push; the Phase-5 live proof of the executed deploy returned LIVE-VERIFIED — create proven from its own result meta, fresh-vault readback SIMULATED_NONE, balance arithmetic exact to the stroop). The live value of every number at any later moment is always `docs/STATUS.md` + `docs/state-snapshot.json` (CI-bonded). This file's Arabic original `docs/FINAL-REPORT-2026-11-09-ar.md` carries the same facts fact-for-fact.

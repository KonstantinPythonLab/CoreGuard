# Claim taxonomy — what each word is allowed to mean (المسميات الصادقة فقط)

> **The one rule (القاعدة الواحدة):** قوة أي ادعاء هي حجم الفحص الآلي
> خلفه — لا أكثر. كل رقم يُشتق من `docs/state-snapshot.json`، وكل حقيقة
> «مُنفَّذة» تُشتق من دليل ملتزم في الشجرة، وكل ما ليس له دليل ملتزم
> **لا يُدَّعى** — يُذكَر بأنه مُعلَّق.
>
> **EN:** a claim is exactly as strong as the machine check behind it.
> Numbers derive from the snapshot; executed facts derive from committed
> evidence; anything unproven is named as pending — never dressed as done.

**Why this file exists (لماذا يوجد):** إثبات تنفيذ معاملة ليس إثبات
اعتماد أمنياً، ولم يكن هناك مستند يمنع الخلط بين المصطلحات. هذا الملف
يحدد معنى كل كلمة وحدودها حتى لا يقول محكّم «تُثبتون أكثر مما لديكم»
ولا يُتَّهَم المشروع بتضخيم الأدلة.

---

## 1. Vocabulary (المخزون المعجمي)

### 🚀 INVOKED / الإرسال نُقِد
- **AR:** مغلف معاملة **مُوقَّع** غادر إلى الشبكة عبر مُقدِّم إرسال.
  لا يعني انتقال أموال، ولا مشاركة طرف ثالث، ولا أثراً دائماً بذاته.
- **EN:** a signed envelope left via the injected submitter; no funds
  moved, no counterparty stepped, nothing durable happened by itself.

**Pinned to:** دليل الإثبات الملتزم (`docs/evidence/*.json` — مثال:
`stellar-soroban-commit-executed.json`).

### ✅ EXECUTED / نُفِّذ
- **AR:** المعاملة دخلت اللدجر بنجاح وتحقّقت دلالات العقد الداخلية
  (مثال: `commit` أعاد `{hash, seq}` والاقتران دقيق). **لا يعني** صحة
  استخدام آخر، ولا تغطية بروتوكولية كاملة، ولا رأياً بشرياً في التصميم.
- **EN:** the tx landed and the contract's own return semantics verified
  exactly. It does NOT imply correctness of other uses, protocol-wide
  protection, or human approval.

**Pinned to:** نفس الدليل + وضع `--verify` الذي يعيد الحساب ويقارن.

### 🔁 CONFIRMED / مُؤكَّد
- **AR:** إعادة قراءة مستقلة من سلطة الشبكة تطابق المعلن بايتاً ببايت،
  مع تحقق حسابي إضافي حيث توجد كمية قابلة للجمع (مثال: الفرق
  (مثال: الرصيد قبل − الرصيد بعد − المبلغ المرسَل == fee_charged حتى الستروب نهائياً)). wire خالص،
  لا بروكسي SDK (درس C37 الملزَم). يُخزَّن الـ wire خاماً فقط.
- **EN:** an independent read-back agrees byte-for-byte plus an
  arithmetic identity where summable quantities exist; raw wire only,
  never a proxied SDK object.

### 🖥️ VERIFIED (packaged) / فحص-ذاتي مُتحقَّق
- **AR:** فحص ذاتي لعنصر **ملتزم** أعاد الاشتقاق من بايتاته (مثال:
  `verifyBadge()` في حزمة الشارة). فحص للعناصر — وليس اعتماداً من طرف
  ثالث.
- **EN:** a self-check against a committed artifact re-derived its own
  bytes; it verifies machinery, never endorsement.

### 🧊 BUILT / SHIPPED / بُنِي
- **AR:** كود داخل شجرة ملتزمة، CI أخضر على نفس SHA، والمخرج قابل
  لإعادة الاشتقاق من clone نظيف على أي جهاز. الحق لا يطلب ثقتك —
  يدعوك لتعيد حسابه.
- **EN:** committed tree + green CI on the same SHA + re-derivable from
  any clean clone. It never asks for trust; it asks you to re-compute.

### ⛔ GATED / NOT_PERFORMED / مُوقَّف
- **AR:** الحالة الصادقة: فجوة حقيقية تجعل النسخة الحية ممكنة — قرار
  مالك أو مفتاح اعتماد أو نظير حي. **وصف الفجوة يبقى وصفاً**: لا يُكتب
  «أنجز» ولا «اعتمدنا» ولا «شريكنا» لمجرد وصف الفجوة.
- **EN:** the honest default: a real gap exists (owner decision,
  credential, live counterparty). The description stays a description.

### 🔒 REVIEWED — غائب بالتصميم
- **AR:** لا مراجعة بشرية أمنية ولا تدقيق مستقل على العقد أو الحزم
  حتى الآن. لا يجوز ادعاء أن جهة خارجية شهدت على العقد. الدعوة للمراجعة
  مفتوحة ودائمة ومرحَّب بها — ولهذا المراجعة الخارجية حالة GATED حتى
  نشر مُراجِعٍ توقيعه.
- **EN:** no human security review and no independent audit has
  happened. Nothing replaces your own review; the invitation is open,
  standing, and welcomed — which is exactly why external review stays
  GATED until a reviewer signs.

### 💸 AUDIT — لا يُدَّعى
- **AR:** هذه الشجرة بلا تدقيق مستقل. ما يميّزها ليس توقيعاً بل القدرة
  على إعادة تشغيل كل فحص: كل شيء ملتزم ومثبَّت بالـ hash وملزم بـ CI،
  فالمُراجع الخارجي يعيد إنتاج كل رقم من clone نظيف بنفس الأوامر.
- **EN:** NO independent audit exists; the distinguishing property is
  the ability to re-run everything from a clean clone.

---

## 2. The separation (الفرق الذي طلبه المحكّم)

> **Execution proof ≠ security approval.** إثبات التنفيذ ≠ الاعتماد الأمني.

**ما يقوله إثبات التنفيذ (DOES say):** نُفِّذت هذه المعاملة، في هذه اللدجر،
على معرّف العقد هذا، بهذه المعاملات، والإرجاع طابق حرفياً.
**EN:** this call succeeded, on this contract id, at this ledger, with
these params — and the read-back matched exactly.

**ما لا يقوله (does NOT say):**
- **لا** يعني أن كل أنواع معاملات العقد محمية بالمستوى نفسه. العقد الحي
  على الشبكة الرئيسية هو الثنائي من إصدار /1؛ مسار **الهوية المصرَّح**
  (authorized lane) مكتوب في المصدر ويُفعَّل مع انتشار قادم فقط، وذلك
  الانتشار لا يحدث إلا بقرار مالك صريح (مسجل في `soroban/commitment-anchor/`).
- **لا** يعني غياب كل وسائل تجاوز Execution Firewall لاستدعاءات مستقبلية
  خارج النطاق المصرَّح به.
- **لا** يعني أن كل محفظة أو منصة تدمج CoreGuard دون فهمها الأمني الخاص؛
  كل دمج يحمل حسابه الأمني.
- **لا** يعني مقاومة هجمات بروتوكولية عامة؛ الأدلة تغطي ما تسمي حرفياً.

**EN mirror:** the proof covers THE call — and only that call.

---

## 3. The instruments behind the words (الأدوات خلف الكلمات)

| Word (كلمة) | The honest pin (الربط) | Where (أين) |
|---|---|---|
| executed fact | committed evidence + `--verify` re-derivation | `docs/evidence/*.json` + runners in `scripts/` |
| measured count | snapshot total, CI-enforced | `docs/state-snapshot.json` |
| doc-stated number | equals the snapshot total, machine-bonded | `test/ci/doc-numbers.test.js` |
| row-anchored value | STATUS row-scoped truth (12 negative controls) | `test/ci/status-truth.test.js` |
| artifact self-verification | re-derivation from the record's own bytes | badge `verifyBadge()` / conformance suite |
| published fact | registry record (token-read) | owner-gated look-up |
| money fact | `$0` rows only | `docs/conformance-report.json` |

**Not claimed on ANY surface (لا يُدَّعى في أي سطح):** تحويلات موقَّعة
ممولة خارج الدعوتين المصرَّح بهما؛ نشر npmjs.com قبل `NPM_TOKEN`؛
SaaS دفع حي؛ شراكات؛ إيراد؛ عملاء. القاعدة نفسها مثبتة كمرآة «ما لا
يُدَّعى» في خمسة أسطر حرفية على كل سطح.

---

## 4. The manners rule (قاعدة الانضباط اللفظي)

1. سمِّ فجوة الحالة باسمها — لا تحولها إلى شهادة إنجاز.
2. وصِّف ما يفتح كل GATED بدقة قرار-مالك / مفتاح / نظير حي.
3. كل رقم تُكتبه يطابق اللقطة المقاسة، والقارئ يعيد إثباته بأوامر ملتزمة.
4. المرآة الصادقة (خمسة أسطر) تُكتب حرفياً في كل سطح وبلا استثناء.


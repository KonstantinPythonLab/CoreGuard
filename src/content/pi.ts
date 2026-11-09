// Pi Network facts for the CoreGuard website.
// Same claim discipline as Core and Stellar: no revenue, customers, partners, funding or audits
// are claimed until a named event with evidence exists. VERIFIED ≠ SAFE.

import type { Bi } from "@/lib/i18n";

export const PI = {
  slug: "pi-network",
  name: "Pi Network",
  status: "PLANNED", // DRY_RUN / PLAN_ONLY — prepared for Pi mainnet launch
  tone: "text-pi",
  headline: {
    en: "Execution truth for Pi Network — prepared for mainnet.",
    ar: "حقيقة التنفيذ لـ Pi Network — مستعدة للشبكة الرئيسية.",
  },
  pitch: {
    en: "Pi Network is moving toward mainnet and an open developer ecosystem. CoreGuard provides a deterministic, replayable proof of what was authorised versus what executed — fail-closed, before the transaction settles — the same pattern already proven on Core DAO and Stellar.",
    ar: "Pi Network يتحرّك نحو الشبكة الرئيسية ومنظومة مفتوحة للمطورين. CoreGuard بيقدم إثبات deterministic, قابل لإعادة التحقق، لما أُصرّح مقابل ما نُفّذ — فشل آمن، قبل ما تتسوّى المعاملة — نفس النمط اللي نُجِد على Core DAO وStellar.",
  },
  offers: [
    {
      title: { en: "Pi Commerce Shield", ar: "درع Pi Commerce" },
      body: {
        en: "Reserve-before-sign escrow + receipts for Pi merchant payments (packages/pi-network).",
        ar: "ضمان reserve-before-sign وإيصالات لمدفوعات تجار Pi (packages/pi-network).",
      },
    },
    {
      title: { en: "Pi Wallet & Browser DApp guard", ar: "حماية Pi Wallet وتطبيقات المتصفح" },
      body: {
        en: "Firewall policies before a Pi Browser DApp asks the wallet to sign.",
        ar: "سياسات Firewall قبل ما أي تطبيق في Pi Browser يطلب توقيع من المحفظة.",
      },
    },
    {
      title: { en: "Verified merchant badge", ar: "شارة التاجر الموثّق" },
      body: {
        en: "Badge Shield for Pi stores — renders only from verified receipts, fails closed otherwise.",
        ar: "Badge Shield لمتاجر Pi — بتظهر بس من إيصالات متحققة، وغير كده بتقفل.",
      },
    },
    {
      title: { en: "Execution-truth layer (prepared)", ar: "طبقة حقيقة التنفيذ (مستعدة)" },
      body: {
        en: "7-run verification ladder from intent → policy → commitment → receipt → verifier → anchor. Same Core/Stellar pattern prepared for Pi mainnet. No Pi mainnet TX verified yet.",
        ar: "سلم تحقق من 7 درجات: النية ← السياسة ← الالتزام ← الإيصال ← المُحقّق ← المرساة. نفس نمط Core و Stellar مستعد لـ Pi mainnet. لسه ما في أي Till आदेश Pi متحققة.",
      },
    },
    {
      title: { en: "Pi Browser verification overlay (prototype)", ar: "لوحة التحقق في Pi Browser (نموذج أولي)" },
      body: {
        en: "Prototype overlay that surfaces CoreGuard verification state next to every Pi Browser DApp action.",
        ar: "واجهة نموذجية تظهر حالة التحقق من CoreGuard جنب كل عملية في أي تطبيق Pi Browser.",
      },
    },
    {
      title: { en: "Pi mainnet commitment anchor (prepared)", ar: "مرساة الالتزام لـ Pi mainnet (مستعدة)" },
      body: {
        en: "Commitment anchor prepared for Pi mainnet launch — ready to anchor receipts on-chain when Pi opens for third-party integration.",
        ar: "مرساة التزام مستعدة لإطلاق Pi mainnet — جاهزة لتثبيت الإيصالات على السلسلة when Pi تفتح لدمج الأطراف الخارجية.",
      },
    },
    {
      title: { en: "Attestation service (planned)", ar: "خدمة التوثيق (مخطط لها)" },
      body: {
        en: "B2B attestation for Pi merchants, wallet operators and DApp publishers — signed, replayable, fail-closed.",
        ar: "توثيق بين المؤسسات لتجّار Pi ومشغّلي المحافظ وناشري التطبيقات — موقّع، قابل لإعادة التشغيل، وآمن عند الشك.",
      },
    },
    {
      title: { en: "Cross-network anchor (Core + Stellar + Pi)", ar: "مرساة بين الشبكات (Core + Stellar + Pi)" },
      body: {
        en: "CoreGuard's cross-network anchor pattern proven on Core (chain 1116) and Stellar (Soroban); Pi mainnet anchor prepared.",
        ar: "نمط المرساة بين الشبكات اتثبت على Core (chain 1116) و Stellar (Soroban)؛ ومرساة Pi mainnet مستعدة.",
      },
    },
    {
      title: { en: "Pi ecosystem attestation network (planned)", ar: "شبكة التوثيق لمنظومة Pi (مخطط لها)" },
      body: {
        en: "Pi ecosystem services (oracles, data services, escrow, agent platforms) issue execution attestations, giving users and auditors a verifiable record.",
        ar: "خدمات منظومة Pi (oracles, خدمات بيانات, حفظ, منصات وكلاء) بتصدر شهادات تنفيذ, عشان المستخدمين والمدققين ي 제공받아ون سجل قابل للتحقق.",
      },
    },
  ],
  programs: [
    { en: "Pi Browser verification overlay (prototype)", ar: "Overlay verify على Pi Browser (نموذج أولي)" },
    { en: "Pi DApp SDK (reused from Core and Stellar)", ar: "SDK لتطبيقات Pi DApp (مُستعمل من Core وStellar)" },
    { en: "Pi mainnet commitment anchor (prepared for mainnet launch)", ar: "مرساة التزام Pi mainnet (مستعدة لإطلاق الشبكة الرئيسية)" },
    { en: "Pi ecosystem attestation service (prepared)", ar: "خدمة شهادة تنفيذ لمنظومة Pi (مستعدة)" },
    { en: "Cross-network anchor with Core + Stellar", ar: "مرساة عابرة للشبكات مع Core + Stellar" },
  ],
};

export const PI_KILLER_FEATURES = [
  {
    k: "Killer feature",
    title: { en: "Pi transaction execution-proof", ar: "إثبات تنفيذ معاملة Pi" },
    body: {
      en: "Every Pi transaction gets a deterministic replay hash and a verifiable execution receipt before settlement. The user, an auditor or a regulator can re-derive it. Fail-closed: UNKNOWN stays HELD, never silently passed.",
      ar: "كل معاملة Pi بتحصل replay hash deterministic والإيصال قابل للتحقق قبل التسوية. المستخدم أو المدقق أو الجهة الرقابية بيعيد حسابه. فشل آمن: UNKNOWN يبقى HOLD، ما يمرّ silently.",
    },
  },
  {
    k: "Killer use",
    title: { en: "Pi Browser DApps + Pi Wallet verify before settlement", ar: "Pi Browser DApps + Pi Wallet تتحقق قبل التسوية" },
    body: {
      en: "A Pi DApp or Pi Wallet runs a transaction through CoreGuard and shows the user a receipt before sign-off. UNKNOWN stays HELD.",
      ar: "Pi DApp أو Pi Wallet بيشغّل معاملة عبر CoreGuard وبيظهر للمستخدم إيصال قبل التوقيع.UNKNOWN يبقى HOLD.",
    },
  },
  {
    k: "Killer on-chain",
    title: { en: "Pi mainnet commitment anchor (prepared for mainnet launch)", ar: "مرساة التزام Pi mainnet (مستعدة لإطلاق الشبكة الرئيسية)" },
    body: {
      en: "Same pattern already proven on Core DAO and Stellar: an on-chain commitment anchor stores execution receipts so anyone can replay them. Prepared for Pi mainnet; nothing is claimed until Pi mainnet is live.",
      ar: "نفس النمط اللي نُجِد على CoreDAO وStellar: مرساة التزام على السلسلة بتخزن إيصالات التنفيذ عشان أي حد يعيدها. مستعدة لـ Pi mainnet؛ ما في مدّعى حتى تفتح Pi mainnet.",
    },
  },
  {
    k: "Killer utility",
    title: { en: "Pi ecosystem apps SDK", ar: "SDK لتطبيقات منظومة Pi" },
    body: {
      en: "Every Pi DApp, Pi Wallet service, agent platform and ecosystem service can use @coreguard/sdk to verify transactions on Pi Network. A Pi Browser extension can run one line of verification for every DApp the user visits.",
      ar: "كل Pi DApp وخدمة Pi Wallet ومنصة وكلاء وخدمة منظومة Pi بيستخدموا @coreguard/sdk عشان يتحققوا من معاملات Pi Network. Extension على Pi Browser بيقدر يشغّل خطوة verify لوحده لكل DApp.",
    },
  },
  {
    k: "Killer adoption",
    title: { en: "One-line SDK integration", ar: "دمج SDK بسطر واحد" },
    body: {
      en: "npm install @coreguard/sdk gives a Pi Browser DApp or a Pi Wallet the same verifier used on Core and Stellar. The integration model is identical across the three networks.",
      ar: "npm install @coreguard/sdk بي给大家 Pi DApp أو Pi Wallet نفس المحقّق اللي على Core وStellar. نمط الدمج واحد عبر الثلاث شبكات.",
    },
  },
  {
    k: "Killer reference",
    title: { en: "Pi Network apps reference CoreGuard for execution auditability and regulatory reporting", ar: "تطبيقات Pi Network تُرجِع CoreGuard للتدقيق وإبـلغات رقابية" },
    body: {
      en: "The same verifier that proves a Core transaction and a Stellar swap also proves a Pi transaction once Pi mainnet is live. Cross-network execution truth is the differentiator.",
      ar: "نفس المحقّق اللي بيثبت معاملة Core وتبديل Stellar بيثبت معاملة Pi مرة تفتح Pi mainnet. حقيقة تنفيذ عابرة للشبكات دي الفرق.",
    },
  },
  {
    k: "Killer customer",
    title: { en: "Pi wallet providers, Pi DApp builders, Pi agent platforms, Pi ecosystem services, Pi community apps, Pi audit and compliance services", ar: "مقدّمي محافظ Pi، مبنيّ Pi DApp، منصات وكلاء Pi، خدمات منظومة Pi، تطبيقات مجتمع Pi، وخدمات تدقيق وامتثال Pi" },
    body: {
      en: "Every one of them needs a receipt it can show a user, an auditor or a regulator. That is the customer.",
      ar: "كل واحد فيهم محتاج إيصال يقدّمه للمستخدم أو المدقق أو الجهة الرقابية. دي اللي هو العميل.",
    },
  },
];

export const PI_MILESTONES = [
  {
    id: "MS-0",
    title: { en: "Pi Browser verification overlay + Pi DApp SDK prototype", ar: "نموذج أولي لـ overlay verify Pi Browser + SDK Pi DApp" },
    body: {
      en: "A Pi Browser overlay and a Pi DApp SDK prototype that run a Pi transaction through CoreGuard and show a receipt summary before sign-off. Runs on a test or staging environment; clearly labelled as a prototype.",
      ar: "Overlay Pi Browser و SDK Pi DApp تجريبيين بinsch a معاملة Pi عبر CoreGuard وبيظهروا ملخص إيصال قبل التوقيع. بشغّلوا على بيئة اختبار أو إعداد, واضعين كنموذج أولي.",
    },
  },
  {
    id: "MS-1",
    title: { en: "Pi mainnet commitment anchor + Pi DApp/Wallet pilots", ar: "مرساة التزام Pi mainnet + تجارب دمج Pi DApp/محفظة" },
    body: {
      en: "Once Pi mainnet is live, an on-chain commitment anchor is deployed on Pi mainnet and a small number of live integration pilots ship with Pi wallets, DApps or services. Reviewed and verified by Pi Network reviewers.",
      ar: "بعد ما تفتح Pi mainnet, مرساة التزام على السلسلة بتُنشر على Pi mainnet وبتدمج تجارب حية شوية مع محافظ وPi DApps أو خدمات. بتُرقَب وتُتحقّق من قبل مراجعين Pi Network.",
    },
  },
  {
    id: "MS-2",
    title: { en: "Pi ecosystem attestation service + adoption scale", ar: "خدمة شهادة تنفيذ لمنظومة Pi + توسيع الاعتماد" },
    body: {
      en: "Pi ecosystem services (oracles, data services, escrow, agent platforms) ship an attestation service and demonstrated adoption across a growing set of Pi DApps, wallets and services.",
      ar: "خدمات منظومة Pi (oracles, خدمات بيانات, حفظ, منصات وكلاء) بتشغّل خدمة شهادة وdemo توسيع الاعتماد عبر مجموعة متزايدة من Pi DApps و محافظ وخدمات.",
    },
  },
];

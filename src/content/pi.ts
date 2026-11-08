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
    ar: "Pi Network يتحرّك نحو الشبكة الرئيسية ومنظومة مفتوحة للمطورين. CoreGuard بيقدم إثبات deterministic, قابل لإعادة التحقق، لما أُصرّح contrasting لما نُفّذ — فشل آمن، قبل ما تتسوّى المعاملة — نفس النمط اللي نُجِد على Core DAO وStellar.",
  },
  offers: [
    {
      title: { en: "Pi Browser verification overlay", ar: " Overlay verify على Pi Browser" },
      body: {
        en: "Every Pi DApp transaction runs through CoreGuard and shows the user a one-line receipt summary before sign-off: authorisation recovered · policy satisfied · receipt ready · anchored once Pi mainnet is live.UNKNOWN stays HELD.",
        ar: "كل معاملة Pi DApp تجري عبر CoreGuard وتظهر للمستخدم ملخص إيصال قبل التوقيع: استُ restores الموقّع · السياسة محقّقة · الإيصال جاهز · يُثبت عندما تفتح Pi mainnet.UNKNOWN يبقى HOLD.",
      },
    },
    {
      title: { en: "Pi Wallet pre-sign check", ar: "فحص ما قبل التوقيع على Pi Wallet" },
      body: {
        en: "Pi Wallet adds a pre-sign verification step: ALLOW / DENY / HOLD with a verifiable receipt, so the wallet never signs a transaction it cannot explain to the user.",
        ar: "Pi Wallet بيضيف خطوة فحص قبل التوقيع: ALLOW / DENY / HOLD مع إيصال قابل للتحقق، عشان المحفظة ما تغيّر المعاملة ما فهمته للمستخدم.",
      },
    },
    {
      title: { en: "Pi DApp SDK", ar: "SDK لتطبيقات Pi DApp" },
      body: {
        en: "Pi DApps call the same verifier as Core DAO and Stellar. Each DApp presents a receipt to the user, keeps it for audit and hands it to a dispute flow when needed.",
        ar: "تطبيقات Pi DApp بتدور نفس المحقّق اللي على Core DAO وStellar. كل DApp تظهر إيصال للمستخدم، يحتفظ بيه للتدقيق وبيديه لسياق نزاع لما لازم.",
      },
    },
    {
      title: { en: "Pi mainnet commitment anchor (prepared)", ar: "مرساة التزام Pi mainnet (مستعدة)" },
      body: {
        en: "Once Pi mainnet is live, an on-chain commitment anchor stores execution receipts so anyone can replay them on Pi mainnet. The anchor pattern is prepared; nothing is claimed until Pi mainnet is live.",
        ar: "بعد ما تفتح Pi mainnet، مرساة التزام على السلسلة بتخزن إيصالات التنفيذ عشان أي حد يعيدها على Pi mainnet. نمط المرساة مستعد؛ ما في مدّعى حتى تفتح Pi mainnet.",
      },
    },
    {
      title: { en: "Pi ecosystem attestation service", ar: "خدمة شهادة تنفيذ لمنظومة Pi" },
      body: {
        en: "Pi ecosystem services (oracles, data services, escrow, agent platforms) issue execution attestations for the transactions they process, giving users and auditors a verifiable record.",
        ar: "خدمات منظومة Pi (oracles, خدمات بيانات, حفظ, منصات وكلاء) بتصدر شهادات تنفيذ للمعاملات اللي بتعالجها، عشان المستخدمين والمدققين ي 제공받아ون سجل قابل للتحقق.",
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
      ar: "نفس النمط اللي نُجِد على Core DAO وStellar: مرساة التزام على السلسلة بتخزن إيصالات التنفيذ عشان أي حد يعيدها. مستعدة لـ Pi mainnet؛ ما في مدّعى حتى تفتح Pi mainnet.",
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
      ar: "npm install @coreguard/sdk بيを与給 Pi DApp أو Pi Wallet نفس المحقّق اللي على Core وStellar. نمط الدمج واحد عبر الثلاث شبكات.",
    },
  },
  {
    k: "Killer reference",
    title: { en: "Pi Network apps reference CoreGuard for execution auditability and regulatory reporting", ar: "تطبيقات Pi Network تُرجِع CoreGuard للتدقيق وإ보고ات رقابية" },
    body: {
      en: "The same verifier that proves a Core transaction and a Stellar swap also proves a Pi transaction once Pi mainnet is live. Cross-network execution truth is the differentiator.",
      ar: "نفس المحقّق اللي بيثبت معاملة Core وتبديل Stellar بيثبت معاملة Pi مرة تفتح Pi mainnet. حقيقة تنفيذ عابرة للشبكات دي الفرق.",
    },
  },
  {
    k: "Killer customer",
    title: { en: "Pi wallet providers, Pi DApp builders, Pi agent platforms, Pi ecosystem services, Pi audit and compliance services", ar: "مقدّمي محافظ Pi، مبنيّ Pi DApp، منصات وكلاء Pi، خدمات منظومة Pi، وخدمات تدقيق وامتثال Pi" },
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
      ar: "Overlay Pi Browser و SDK Pi DApp تجريبيين بيinsch a معاملة Pi عبر CoreGuard وبيظهروا ملخص إيصال قبل التوقيع. بشغّلوا على بيئة اختبار أو إعداد، واضحين كنموذج أولي.",
    },
  },
  {
    id: "MS-1",
    title: { en: "Pi mainnet commitment anchor + Pi DApp/Wallet pilots", ar: "مرساة التزام Pi mainnet + تجارب دمج Pi DApp/Mحفظة" },
    body: {
      en: "Once Pi mainnet is live, an on-chain commitment anchor is deployed on Pi mainnet and a small number of live integration pilots ship with Pi wallets, DApps or services. Reviewed and verified by Pi Network reviewers.",
      ar: "بعد ما تفتح Pi mainnet، مرساة التزام على السلسلة بتُنشر على Pi mainnet وبتدمج تجارب حية شوية مع محافظ وPi DApps أو خدمات. بتُرقَب وتُتحقّق من قبل مراجعين Pi Network.",
    },
  },
  {
    id: "MS-2",
    title: { en: "Pi ecosystem attestation service + adoption scale", ar: "خدمة شهادة تنفيذ لمنظومة Pi + توسيع الاعتماد" },
    body: {
      en: "Pi ecosystem services (oracles, data services, escrow, agent platforms) ship an attestation service and demonstrated adoption across a growing set of Pi DApps, wallets and services.",
      ar: "خدمات منظومة Pi (oracles, خدمات بيانات, حفظ, منصات وكلاء) بتشغّل خدمة شهادة وت扩散 الاعتماد across مجموعة متزايدة من Pi DApps و محافظ وخدمات.",
    },
  },
];

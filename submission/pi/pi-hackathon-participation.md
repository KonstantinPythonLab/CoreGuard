# Pi Next hackathon participation plan — CoreGuard execution-truth layer for Pi Network

**EN**

## Project

A Pi DApp or Pi Wallet demo that integrates CoreGuard verification and shows a real execution receipt on a test or staging environment.

## Demo flow

1. User opens a Pi DApp or Pi Wallet on Pi Browser.
2. The DApp or Wallet builds an intent + policy for a Pi transaction.
3. CoreGuard runs the verifier: recover the signer, check the policy, produce a receipt.
4. The overlay shows the user a one-line receipt summary before the user signs: authorisation recovered · policy satisfied · receipt ready · anchored once Pi mainnet is live.
5. If the verifier returns UNKNOWN, the transaction stays HELD — never silently passed.
6. The user approves, the receipt is stored for audit, and (once Pi mainnet is live) the commitment is anchored on Pi mainnet.

## Proof structure

The demo shows the same proof structure as Core DAO and Stellar:

- Intent + policy (declared before execution)
- Execution (Pi mainnet or staging)
- Receipt (pinned to a Pi mainnet block hash once live)
- Deterministic replay (replay hash, diff and report: MATCH / MISMATCH / UNKNOWN)
- Independent verifier (JS SDK run locally, no RPC, no trust)
- On-chain commit (prepared for Pi mainnet launch)

## Disclosure

- The demo runs on a test or staging environment, not on real Pi mainnet funds, until Pi mainnet is live.
- The demo is clearly labelled as a prototype / DRY_RUN.
- No Pi mainnet execution proof is claimed yet.
- No revenue, customers, partners, funding or audits are claimed until a named event with evidence exists.
- VERIFIED ≠ SAFE.

**العربية**

## المشروع

تطبيق Pi DApp أو Pi Wallet تجريبي يدمج التحقق من CoreGuard ويظهر إيصال تنفيذ حقيقي على بيئة اختبار أو إعداد (staging).

## سير التقديم

1. المستخدم يفتح Pi DApp أو Pi Wallet على Pi Browser.
2. التطبيق أو المحفظة تبني نية + سياسة لمعاملة Pi.
3. CoreGuard يشغّل المحقّق: يست恢复 الموقّع، يتحقق من السياسة، ينتج إيصال.
4. الـ overlay يظهر للمستخدم ملخص الإيصال قبل التوقيع: استُ restaur الموقّع · السياسة محقّقة · الإيصال جاهز · ثابت عندما تفتح Pi mainnet.
5. لو المحقّق ردّ UNKNOWN، المعاملة تبقى HOLD — ما تمرّ silently.
6. المستخدم يوافق، الإيصال يُحفظ للتدقيق، و(بعد ما تفتح Pi mainnet) الالتزام يُثبت على Pi mainnet.

## بنية الإثبات

التقديم بيظهر نفس بنية الإثبات اللي على Core DAO وStellar:

- نية + سياسة (مُصرّح قبل التنفيذ)
- تنفيذ (Pi mainnet أو staging)
- إيصال (مُثبت على block hash của Pi mainnet بعد ما تفتح)
- إعادة تحقق حتمية (replay hash, diff و تقرير: MATCH / MISMATCH / UNKNOWN)
- محقّق مستقل (SDK جاّا locally, مافيش RPC, ما فيثق)
- التزام على السلسلة (مستعد لإطلاق Pi mainnet)

## الإفصاح

- التقديم يشغّل على بيئة اختبار أو إعداد، trên أموال Pi mainnet الحقيقية، حتى تفتح Pi mainnet.
- التقديم واضح كنموذج أولي / DRY_RUN.
- ما في إثبات تنفيذ Pi mainnet مُدّعى بعد.
- ما في إيرادات أو عملاء أو شركاء أو تمويل أو تدقيق مُدّعى حتى حدث مسمى مع دليل.
- VERIFIED ≠ SAFE.

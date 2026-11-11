# CoreGuard Stellar DEX Integration (Soroban/1 + DEX-GATE/1 + DDE/1)

<p align="center">
  <strong>Fail-closed Preflight Gating, Deterministic Post-Verification, and Escrow Settlement on Stellar Soroban</strong>
</p>

---

## English

### Overview

This example delivers an end-to-end integration of the **Stellar Soroban DEX** with CoreGuard's deterministic verification stack:
1. **DEX-GATE/1 Preflight Gating (`dex-gate.mjs`)**: Evaluates intents against liquidity depth, slippage bounds, and committed policy rules before any transaction is broadcast to the network.
2. **Deterministic Execution Verification (`run-dex-swap.mjs`)**: Captures execution trace, calldata, and state delta, issuing a cryptographic receipt (`CGEP/1:RECEIPT`) evaluated at level `L2`.
3. **DDE/1 Bilateral Escrow Boundary (`@coreguard/delivery/sdk`)**: Holds settlement hostage to evidence. Release is authorized if and only if post-verification succeeds and counterparty acceptance conditions are met.
4. **Soroban Commitment Anchor (`packages/stellar-soroban`)**: Derives deterministic on-chain anchor plans for the execution receipt proof on Stellar Soroban (`CG-COMMITMENT-ANCHOR/1`).
5. **Offline Independent Verifier (`verify-offline.mjs`)**: Re-derives all cryptographic digests, policy evaluations, and conformance checks completely offline with zero RPC or external dependencies.

---

### Architecture & Pipeline Flow

```
   ┌────────────────────────────────────────────────────────┐
   │ 1. PRE-FLIGHT GATING (DEX-GATE/1)                       │
   │    • Policy Evaluation (VALUE_LIMIT, SLIPPAGE_BPS)     │
   │    • Order book depth & slippage ceiling inspection    │
   │    Verdict: VERIFIED (or fail-closed REJECTED/HELD)    │
   └──────────────────────────┬─────────────────────────────┘
                              ▼
   ┌────────────────────────────────────────────────────────┐
   │ 2. SOROBAN EXECUTION SIMULATION                        │
   │    • Soroban DEX Swap exact-in invocation              │
   │    • Multi-account balance delta & call graph capture  │
   └──────────────────────────┬─────────────────────────────┘
                              ▼
   ┌────────────────────────────────────────────────────────┐
   │ 3. POST-EXECUTION VERIFICATION                         │
   │    • Receipt commitment (computeReceiptId)             │
   │    • Intent, Policy & Trace hash binding (L2 Profile)  │
   │    • Intent-to-Execution Conformance Check             │
   └──────────────────────────┬─────────────────────────────┘
                              ▼
   ┌────────────────────────────────────────────────────────┐
   │ 4. DDE/1 BILATERAL ESCROW SETTLEMENT                   │
   │    • Evaluates releaseWhen(report, predicate)          │
   │    • Releases funds iff verification = PASS            │
   │    • Holds payment on slippage spike or tampering      │
   └──────────────────────────┬─────────────────────────────┘
                              ▼
   ┌────────────────────────────────────────────────────────┐
   │ 5. SOROBAN COMMITMENT ANCHOR                           │
   │    • Plan on-chain anchor (commit proofId, digest)     │
   │    • Read-back commitment verification on Soroban      │
   └────────────────────────────────────────────────────────┘
```

---

### Running the Example

#### 1. Execute End-to-End Pipeline
Runs the complete swap flow, demonstrates valid execution, and tests adversarial scenarios (slippage spike and recipient redirection):
```bash
node examples/stellar-dex-integration/run-dex-swap.mjs
```

#### 2. Deterministic Offline Re-derivation
Verifies the generated receipt, state delta, and policy conformance completely offline without network calls:
```bash
node examples/stellar-dex-integration/verify-offline.mjs
```

#### 3. Run Test Suite
Executes the comprehensive 5-scenario test suite:
```bash
node examples/stellar-dex-integration/test.mjs
```

---

### Adversarial Defenses Enforced

| Threat Scenario | Attack Vector | CoreGuard Defense | Verdict |
|---|---|---|---|
| **Front-running / Sandwich** | Manipulated ask depth causing 600 bps slippage | `DEX-GATE/1` slippage ceiling preflight check | `REJECTED_PREFLIGHT` (Zero broadcast) |
| **Recipient Redirection** | Siphoning swap output to unauthorized address | `RECIPIENT_ALLOWLIST` & Conformance check | `POLICY_VIOLATED` (Payment held) |
| **Receipt Tampering** | Mutating execution result in receipt payload | `computeReceiptId` cryptographic check | `INVALID` (Digest mismatch) |
| **Trace Substitution** | Replaying fake execution under valid receipt | `TRACE_HASH` binding check | `INVALID` (Binding failure) |

---

### Honesty & Boundaries

- **Network Scope**: Demonstrations and tests operate in offline deterministic mode and against Stellar Testnet fixtures.
- **Capital Movement**: No mainnet capital is moved.
- **Fail-Closed**: Any unmodelable state or missing witness defaults to `HELD` or `REJECTED`.

---

## العربية (Arabic)

### نظرة عامة

يقدم هذا المثال تكاملاً شاملاً ومحكماً بين **منصة التداول اللامركزي Stellar Soroban DEX** وحزمة التحقق القطعي التابعة لـ CoreGuard:
1. **بوابة الفحص القبلي DEX-GATE/1 (`dex-gate.mjs`)**: تفحص النوايا مقارنة بعمق السيولة، حدود الانزلاق السعري (Slippage)، وقواعد السياسة المعتمدة قبل بث أي معاملة للشبكة.
2. **التحقق القطعي بعد التنفيذ (`run-dex-swap.mjs`)**: يسجل مسار التنفيذ وبيانات الاستدعاء والفروق في الأرصدة، ويصدر إيصالاً مشفراً (`CGEP/1:RECEIPT`) بمستوى تحقق `L2`.
3. **حدود الضمان والنزاع الثنائي DDE/1 (`@coreguard/delivery/sdk`)**: تجعل الإفراج عن أموال الصفقة رهينة بالدليل القاطع، حيث يُرفض الإفراج حتمياً عند حدوث تلاعب أو تجاوز للانزلاق المسموح.
4. **التثبيت على Soroban (`packages/stellar-soroban`)**: يولد خطة تثبيت قطعية لإثبات الإيصال على عقود Soroban الذكية (`CG-COMMITMENT-ANCHOR/1`).
5. **الفاحص المستقل غير المتصل (`verify-offline.mjs`)**: يعيد اشتقاق كافة البصمات المشفرة، تقييمات السياسة، ومطابقة النوايا دون أي اتصال بالشبكة أو مزودي RPC.

---

### طريقة التشغيل

```bash
# تنفيذ خط الأنابيب الكامل مع سيناريوهات الهجوم
node examples/stellar-dex-integration/run-dex-swap.mjs

# إعادة الاشتقاق والتحقق المستقل دون اتصال
node examples/stellar-dex-integration/verify-offline.mjs

# تشغيل حزمة الاختبارات الشاملة (5/5 اختبارات)
node examples/stellar-dex-integration/test.mjs
```

---

### الحماية ضد الهجمات

- **التصدي لهجمات الانزلاق (Front-running)**: البوابة ترفض مسبقاً أي معاملة يتجاوز انزلاقها السعري السقف المحدد (500 bps).
- **منع تحويل الوجهة**: فحص المطابقة والسياسة يمنع أي محاولة لتوجيه الأصول لعنوان غير مصرح به مع تجميد الضمان (Fail-Closed).
- **منع تزوير الإيصالات**: التشفير الرياضي للإيصال يكشف فوراً أي تعديل غير مصرح به.

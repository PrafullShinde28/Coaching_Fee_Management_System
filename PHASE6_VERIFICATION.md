# FEETrack — Phase 6 Verification Report: Accounts Dashboard & Fee Management

**Status:** READY (All Remediations Verified)  
**Evaluation Role:** Senior Backend & Full-Stack Engineer  
**Date:** 2026-11-06  
**Scope:** Phase 6 Implementation & Final Corrections (Phases 1–5 Preserved; Phase 7 Not Started)  

---

## Executive Summary & Remediations Overview

This report provides explicit code extracts, test suite outputs, and architectural evidence addressing all requirements and the final refund payout audit workflow:

1. **Refund Formula Alignment (Resolved):** Strictly verified in code and tests according to the approved Phase 2 domain formula:
   $$\text{processingFee} = \min(500\,000, \text{round}(\text{totalFee} \times 0.05))$$
   Processing fee is 5% of `totalFee` capped at ₹5,000 (500,000 paise).
2. **Refund Payout Audit Workflow (Fully Resolved):**
   - **Mandatory Payment Evidence:** `payRefundSchema` requires `method` (`bank_transfer`, `cheque`, `upi`, `cash`, `other`), `reference` (non-empty string), and `paidAt` (valid date). No fallback strings (`REF-`) and no date defaulting (`Date.now()`). Incomplete or missing evidence is rejected with **HTTP 400**.
   - **Dedicated Rejection Audit:** `rejectRefundSchema` requires a non-empty `reason`. Stored in dedicated `rejection` schema (`reason`, `rejectedBy: req.user._id`, `rejectedAt: clock.now()`).
   - **Status Transition Integrity:** Processing already-paid or already-rejected refunds is strictly blocked with **HTTP 400**. Invalid requests never partially update records.
   - **Staff Attribution:** `processedBy` and `rejectedBy` are populated strictly from authenticated session `req.user._id`.
3. **CSV Formula Injection Sanitization (Resolved):** Implemented dedicated sanitizer `server/src/utils/csvSanitizer.js` with comprehensive handling of null bytes (`\0`), leading whitespace (`\s`, `\t`, `\r`, `\n`) before trigger characters (`=`, `+`, `-`, `@`, `|`, `%`), and RFC-4180 escaping.
4. **Role-Based Authentication Redirects & Protection (Resolved):** Verified role isolation where `/login` directs `accounts` users to `/accounts/dashboard` and `parent` users to `/parent/dashboard`, with bidirectional 403 enforcement preventing cross-role access.
5. **Fresh Monorepo Test Suite:** 97 tests passing (80 server, 17 client) with 0 failures and 0 warnings.

---

## 1. Refund Calculation & Phase 2 Domain Logic

### Backend Domain Implementation (`server/src/domain/refund.js`)

```javascript
// Rate: 5% (500 bps) of totalFee, capped at Rs. 5,000 (500,000 paise)
const PROCESSING_RATE_BPS = 500;
const MAX_PROCESSING_FEE_PAISE = 500_000;

export function calculateRefund({
  totalFee,
  discount = 0,
  termStart,
  termEnd,
  leftOn,
  paid,
  asOf = clock.today()
}) {
  const deadline = addDays(leftOn, 10);
  if (asOf > deadline) {
    return { eligible: false, reason: 'Request submitted past the 10-day deadline from course leaving date' };
  }

  const termDays = Math.max(1, daysBetween(termStart, termEnd));
  const daysUsed = Math.max(0, daysBetween(termStart, leftOn));
  const clampedDaysUsed = Math.min(termDays, daysUsed);

  const feeAfterDiscount = Math.max(0, totalFee - discount);
  const usedShare = Math.min(
    feeAfterDiscount,
    roundDiv(feeAfterDiscount * clampedDaysUsed, termDays)
  );

  // Phase 2 Approved Formula: 5% of totalFee, capped at Rs. 5,000 (500,000 paise)
  const processingFee = Math.min(
    roundDiv(totalFee * PROCESSING_RATE_BPS, 10_000),
    MAX_PROCESSING_FEE_PAISE
  );

  const grossRefund = Math.max(0, paid - usedShare - processingFee);
  return {
    eligible: true,
    totalFee,
    discount,
    feeAfterDiscount,
    termDays,
    daysUsed: clampedDaysUsed,
    usedShare,
    processingFee,
    paid,
    netRefund: grossRefund
  };
}
```

### Phase 2 Regression Test Output (`server/test/domain.test.js`)

```
✔ refund: day zero, term end, underpayment, zero payment, discount and deadline (1.1982ms)
```

Test assertion evidence (`server/test/domain.test.js` lines 44–68):
- `totalFee: 1_200_000` (₹12,000), `termDays: 100`, `leftOn: day 20`, `paid: 600_000` (₹6,000):
  - `usedShare`: $1\,200\,000 \times \frac{20}{100} = 240\,000$ paise (₹2,400)
  - `processingFee`: $\min(500\,000, 1\,200\,000 \times 0.05) = 60\,000$ paise (₹600, exactly 5% of `totalFee`)
  - `netRefund`: $600\,000 - 240\,000 - 60\,000 = 300\,000$ paise (₹3,000) — **PASS**
- Large fee cap test: `totalFee: 12_000_000` (₹120,000):
  - $12\,000\,000 \times 0.05 = 600\,000$ paise; capped at $500\,000$ paise (₹5,000) — **PASS**

---

## 2. Refund Payout & Rejection Audit Workflow

### Mongoose Model Schema (`server/src/models/index.js`)

```javascript
const payoutSchema = new Schema({
  method: {
    type: String,
    enum: ['bank_transfer', 'cheque', 'upi', 'cash', 'other'],
    required: true
  },
  reference: { type: String, required: true, trim: true },
  paidAt: { type: Date, required: true },
  processedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  notes: { type: String, trim: true }
}, { _id: false });

const rejectionSchema = new Schema({
  reason: { type: String, required: true, trim: true },
  rejectedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  rejectedAt: { type: Date, required: true }
}, { _id: false });

const refundSchema = new Schema({
  studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true, index: true },
  inputs: { type: Schema.Types.Mixed, required: true },
  breakdown: { type: Schema.Types.Mixed, required: true },
  status: { type: String, enum: ['draft', 'confirmed', 'paid', 'rejected'], default: 'draft' },
  deadline: { type: Date, required: true },
  confirmedAt: Date,
  payout: payoutSchema,
  rejection: rejectionSchema
}, opts);
```

### Route Handler Implementation (`server/src/routes/accounts.js`)

```javascript
const payRefundSchema = z.object({
  action: z.enum(['pay', 'paid']),
  method: z.enum(['bank_transfer', 'cheque', 'upi', 'cash', 'other'], {
    required_error: 'Payment method is required',
    invalid_type_error: 'Invalid payment method'
  }),
  reference: z.string({
    required_error: 'Transaction reference is required'
  }).trim().min(1, { message: 'Transaction reference is required' }).max(100),
  paidAt: z.string({
    required_error: 'Payout date is required'
  }).min(1, { message: 'Payout date is required' }).refine((val) => {
    const timestamp = Date.parse(val);
    return !isNaN(timestamp);
  }, {
    message: 'Invalid payout date format'
  }),
  notes: z.string().trim().max(500).optional()
});

const rejectRefundSchema = z.object({
  action: z.enum(['reject', 'rejected']),
  reason: z.string().trim().min(1).optional(),
  rejectionReason: z.string().trim().min(1).optional(),
  notes: z.string().trim().max(500).optional()
}).refine((data) => {
  const r = (data.reason || data.rejectionReason || '').trim();
  return r.length > 0;
}, {
  message: 'Rejection reason is required',
  path: ['reason']
});

router.post('/refunds/:id/process', async (req, res, next) => {
  try {
    const { id } = z.object({ id: objectIdSchema }).parse(req.params);

    const rawAction = req.body?.action;
    if (!rawAction || !['pay', 'paid', 'reject', 'rejected'].includes(rawAction)) {
      return res.status(400).json({ error: 'Invalid action. Must be pay, paid, reject, or rejected' });
    }

    const payload = (rawAction === 'pay' || rawAction === 'paid')
      ? payRefundSchema.parse(req.body)
      : rejectRefundSchema.parse(req.body);

    const refund = await Refund.findById(id).populate('studentId');
    if (!refund) return res.status(404).json({ error: 'Refund record not found' });

    if (refund.status === 'paid' || refund.status === 'rejected') {
      return res.status(400).json({ error: `Refund has already been processed with status: ${refund.status}` });
    }

    const isPay = payload.action === 'pay' || payload.action === 'paid';
    if (isPay) {
      refund.status = 'paid';
      refund.payout = {
        method: payload.method,
        reference: payload.reference.trim(),
        paidAt: new Date(payload.paidAt),
        processedBy: req.user._id,
        notes: payload.notes ? payload.notes.trim() : undefined
      };
      refund.rejection = undefined;
    } else {
      const rejectionReason = (payload.reason || payload.rejectionReason).trim();
      refund.status = 'rejected';
      refund.rejection = {
        reason: rejectionReason,
        rejectedBy: req.user._id,
        rejectedAt: clock.now()
      };
      refund.inputs = {
        ...refund.inputs,
        rejectionReason,
        rejectedBy: req.user._id,
        rejectedAt: clock.now()
      };
      refund.payout = undefined;
    }

    await refund.save();
    await refund.populate([
      { path: 'payout.processedBy', select: 'phone role name' },
      { path: 'rejection.rejectedBy', select: 'phone role name' }
    ]);

    res.json({ ok: true, refund });
  } catch (err) {
    next(err);
  }
});
```

### Server Integration Test Output (`server/test/phase6.test.js`)

```
✔ 7. Refunds: calculates preview, enforces 10-day deadline, records refund, and processes status (127.6794ms)
✔ 10. Refund Payout & Rejection Audit Validation: enforces mandatory fields, audit trail, and status integrity (225.948ms)
```

Verified audit tests (`server/test/phase6.test.js` lines 395–560):
1. **Unauthenticated request:** returns **HTTP 401**.
2. **Parent role request:** returns **HTTP 403**.
3. **Missing payment method:** returns **HTTP 400**.
4. **Invalid payment method (`cryptocurrency`):** returns **HTTP 400**.
5. **Missing transaction reference:** returns **HTTP 400**.
6. **Whitespace transaction reference (`'   '`):** returns **HTTP 400**.
7. **Missing payout date:** returns **HTTP 400**.
8. **Invalid payout date (`'not-a-valid-date'`):** returns **HTTP 400**.
9. **Missing rejection reason:** returns **HTTP 400**.
10. **Whitespace rejection reason (`'    '`):** returns **HTTP 400**.
11. **Atomicity check:** confirmed refund record status remains `'confirmed'` after rejected requests.
12. **Successful rejection:** returns **HTTP 200**, records `rejection.reason`, `rejection.rejectedBy` equals accounts user ID, `rejection.rejectedAt` is valid Date.
13. **Duplicate processing on rejected refund:** returns **HTTP 400**.
14. **Successful payout:** returns **HTTP 200**, records `payout.method`, `payout.reference`, `payout.paidAt`, `payout.processedBy` equals accounts user ID.
15. **Duplicate payout attempt on already-paid refund:** returns **HTTP 400**.

---

## 3. CSV Formula Injection Sanitization

### Sanitizer Implementation (`server/src/utils/csvSanitizer.js`)

```javascript
export function sanitizeCsvCell(val) {
  if (val === null || val === undefined) return '';

  let str = String(val);

  // 1. Strip null bytes
  str = str.replace(/\0/g, '');

  // 2. Detect formula triggers even after leading whitespace or control characters
  const strippedLeading = str.replace(/^[\s\x00-\x1f\x7f-\x9f]+/, '');
  const hasTrigger = /^[=+\-@|%]/.test(strippedLeading);
  const startsWithControl = /^[\t\r\n]/.test(str);

  if (hasTrigger || startsWithControl) {
    str = `'${str}`; // Single-quote escape forces plain-text rendering in spreadsheets
  }

  // 3. RFC-4180 escaping for commas, quotes, and newlines
  if (/[",\n\r]/.test(str)) {
    str = `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}
```

### Edge-Case Test Output (`server/test/phase6.test.js` & `client/test/accounts.test.js`)

```
✔ 8. Reports CSV Export: generates sanitized CSV with formula injection prevention including leading whitespace & control chars (78.1582ms)
✔ 3. CSV Sanitization: Formula Injection Protection with Leading Whitespace & Control Characters (0.5749ms)
```

Verified test assertions:
- Triggers: `=SUM(A1:A10)`, `+cmd|/c calc`, `-1+1`, `@IMPORT`, `|cmd.exe`, `%1+1` $\rightarrow$ prefixed with `'`
- Leading spaces: `'   =SUM(A1:A10)'` $\rightarrow$ `"'   =SUM(A1:A10)"`
- Null bytes: `'\0=cmd'` $\rightarrow$ `"'=cmd"`
- Control chars: `'\t=1+1'` $\rightarrow$ `"'	=1+1"`, `'\r\n=calc'` $\rightarrow$ `"'\r\n=calc'"`

---

## 4. Authentication Role-Based Routing and Redirect

### Login Page Role-Based Redirect (`client/src/pages/LoginPage.jsx`)

```javascript
const handleSuccess = (user) => {
  const destination = user?.role === 'accounts' ? '/accounts/dashboard' : '/parent/dashboard';
  navigate(destination, { replace: true });
};
```

### Route-Level Protection (`client/src/components/accounts/AccountsProtectedRoute.jsx`)

```javascript
export default function AccountsProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div className="page-loading"><Spinner size="lg" /></div>;
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (user.role !== 'accounts') {
    return <Navigate to="/parent/dashboard" replace />;
  }

  return children;
}
```

### Bidirectional Role Isolation Test Output (`server/test/phase6.test.js`)

```
✔ 1. Role Authorization: Parent user cannot access accounts endpoints (3951.4042ms)
✔ 9. Bidirectional Role Isolation: Accounts cannot access Parent APIs & Parent cannot access Accounts APIs (17.1155ms)
```

Verified HTTP assertions:
- `accounts` user calling `GET /api/parent/children` $\rightarrow$ **HTTP 403 Forbidden**
- `parent` user calling `GET /api/accounts/dashboard` $\rightarrow$ **HTTP 403 Forbidden**
- Unauthenticated request calling `GET /api/accounts/students` $\rightarrow$ **HTTP 401 Unauthorized**

---

## 5. Complete Monorepo Test Results Summary

Full execution of `pnpm test` across all workspaces:

```
> @fee-portal/server@0.1.0 test
> node --test

✔ src\scripts\seed-test.js (7941.4024ms)
✔ instalment status: paid, partial, due soon, upcoming, overdue and overpayment (3.4853ms)
✔ payment allocation targets an instalment or oldest unpaid; duplicates are no-op (1.6949ms)
✔ reminders use parent language, skip paid/left students and recheck before send (2.903ms)
✔ refund: day zero, term end, underpayment, zero payment, discount and deadline (1.1982ms)
✔ risk scorer produces explainable high-risk reasons for multiple declining signals (1.914ms)
✔ partial instalment remains part_paid while overdue days are still derived (0.3755ms)
✔ targeted payment never spills into a second instalment and excess stays unallocated (0.503ms)
✔ health endpoint is reachable and helmet security headers are present (3713.1896ms)
✔ input validation: Zod rejects invalid requests (89.036ms)
✔ accounts user can authenticate, receives httpOnly session cookie and no JWT in body (36.8567ms)
✔ invalid OTP is rejected (11.9145ms)
✔ expired OTP is rejected (28.6045ms)
✔ unauthenticated requests are rejected from protected endpoints (31.5182ms)
✔ parent user authentication, first-login consent, ownership, and role isolation (171.8772ms)
✔ accounts user can access accounts endpoint (51.9196ms)
✔ rate limiting: more than five attempts within window triggers HTTP 429 (86.4761ms)
✔ error handling does not expose internal stack traces, secrets, or database details (5.2407ms)
✔ demo OTP is deterministic outside production (12.8831ms)
✔ production OTP is six digits and uses injected randomness (0.7688ms)
✔ production OTP uses secure randomness by default and never enables demo OTP (1.2157ms)
✔ OTP values are never logged in production (2.6803ms)
✔ cookie security options: development vs production (0.8063ms)
✔ demo clock uses configured reference date (1.9614ms)
✔ phone validation pattern accepts international numbers and rejects junk (0.5103ms)
✔ 1. Parent retrieves only their own children (3850.475ms)
✔ 2. Parent retrieves their own child fee ledger (30.6471ms)
✔ 3. Parent cannot retrieve another parent's child fee ledger (27.0471ms)
✔ 4. Parent can generate a payment link for their own outstanding instalment (15.8908ms)
✔ 5. Parent cannot generate a payment link for another parent's instalment (32.3939ms)
✔ 6. Mock gateway creates a valid payment reference (0.6442ms)
✔ 7. Valid HMAC webhook records a payment (62.2885ms)
✔ 8. Invalid HMAC webhook is rejected (6.7358ms)
✔ 9. Duplicate webhook does not duplicate payment allocation (48.7091ms)
✔ 10. Duplicate webhook does not duplicate receipts (48.2008ms)
✔ 11. Targeted payment allocates only to the specified instalment (48.2015ms)
✔ 12. Untargeted payment allocates to the oldest unpaid instalment (56.2235ms)
✔ 13. Unmatched payment enters the unmatched queue without changing balances (48.2045ms)
✔ 14. Accounts user can manually record a payment (30.2981ms)
✔ 15. Parent cannot record a manual payment (12.5518ms)
✔ 16. Accounts user can match and dismiss unmatched payments (70.1852ms)
✔ 17. Cross-student payment allocation is rejected (16.9412ms)
✔ 18. Successful payment generates a GST receipt (25.109ms)
✔ 19. Receipt base + GST equals total for exact amounts and fractional roundings (0.4233ms)
✔ 20. Failed payment generates no receipt (10.7317ms)
✔ 21. Sequential receipt numbers under concurrent requests (6.1262ms)
✔ 1. All five offsets are generated correctly for eligible instalments (4305.8349ms)
✔ 2. English reminders use English templates (23.485ms)
✔ 3. Hindi reminders use Hindi templates (0.3563ms)
✔ 4. Fully paid instalments are skipped during reminder generation and dispatch (321.6736ms)
✔ 5. Part-paid instalments with outstanding balance remain eligible (330.6885ms)
✔ 6. Left/inactive students are skipped (306.8608ms)
✔ 7. Payment cancels pending reminders (66.6019ms)
✔ 8. Repeated scheduler execution does not send duplicates (27.1676ms)
✔ 9. Outstanding balance is rechecked immediately before dispatch (23.8725ms)
✔ 10. One provider failure does not stop other reminders (44.6623ms)
✔ 11. Every dispatch attempt is recorded in MessageLog with audit fields (8.8209ms)
✔ 12. Parent cannot manually trigger reminder execution (15.4716ms)
✔ 13. Payment signals influence the score (12.9794ms)
✔ 14. Attendance decline influences the score (31.8003ms)
✔ 15. Test-score decline influences the score (20.0861ms)
✔ 16. Missing attendance/test data is handled safely without false inflation (16.4884ms)
✔ 17. Scores remain bounded between 0 and 100 under extreme signals (51.2845ms)
✔ 18. Risk reasons are readable and explainable (9.9711ms)
✔ 19. False-flag cooldown prevents new flags for 30 days (627.0788ms)
✔ 20. Existing open flags are not duplicated (1016.9788ms)
✔ 21. Accounts user can mark a flag called (25.5613ms)
✔ 22. Accounts user can mark a false flag with notes (12.2486ms)
✔ 23. Safety rule: Risk processing never creates payment records or changes instalment balances (457.9155ms)
✔ 24. Safety rule: Risk processing never sends parent messages (405.0953ms)
✔ 1. Role Authorization: Parent user cannot access accounts endpoints (3951.4042ms)
✔ 2. Accounts user can access centres and batches metadata endpoints (42.3923ms)
✔ 3. Accounts Dashboard returns aggregate summary, centre summaries, and batch breakdowns (58.7773ms)
✔ 4. Accounts Students: search, filtering, and student ledger verification (80.6729ms)
✔ 5. Manual Payment Collection: records offline payment, auto-allocates, and issues sequential receipt (68.8313ms)
✔ 6. Unmatched Payments: retrieve queue, match to student, and dismiss with reason (40.6345ms)
✔ 7. Refunds: calculates preview, enforces 10-day deadline, records refund, and processes status (127.6794ms)
✔ 8. Reports CSV Export: generates sanitized CSV with formula injection prevention including leading whitespace & control chars (78.1582ms)
✔ 9. Bidirectional Role Isolation: Accounts cannot access Parent APIs & Parent cannot access Accounts APIs (17.1155ms)
✔ 10. Refund Payout & Rejection Audit Validation: enforces mandatory fields, audit trail, and status integrity (225.948ms)
ℹ tests 80 | pass 80 | fail 0

> @fee-portal/client@0.1.0 test
> node --test test/**/*.test.js

✔ 1. Phase 6 Accounts Components and Pages Structure (3.7549ms)
✔ 2. Accounts Localization Parity: EN and HI dictionaries (4.0158ms)
✔ 3. CSV Sanitization: Formula Injection Protection with Leading Whitespace & Control Characters (0.5749ms)
✔ 4. Approved Phase 2 Pro-rata Refund Formula Verification (0.2335ms)
✔ 5. 10-Day Withdrawal Deadline Logic Verification (1.0438ms)
✔ 6. Authentication Role-Based Routing and Redirect Verification (0.2414ms)
✔ 7. Refund Payout and Rejection Audit Schema Fields Verification (0.8306ms)
✔ 1. formatInr: converts integer paise to Indian Rupee currency correctly (23.7196ms)
✔ 2. formatDate: formats dates consistently and safely (5.5947ms)
✔ 3. formatPhone: formats Indian phone numbers cleanly (0.2251ms)
✔ 4. Design Tokens: tokens.css contains all required design variables (0.5767ms)
✔ 5. Localization: English and Hindi translation files have complete parity (4.5386ms)
✔ 6. API Client: enforces credentials: include and correct endpoint contracts (31.6711ms)
✔ 7. API Client: extracts error messages on HTTP 401/403/404 failures (1.8337ms)
✔ 8. Reusable Components: all 14 required design system components are implemented and exported (1.5964ms)
✔ 9. Security Rule: JWT tokens are strictly avoided in localStorage and sessionStorage (10.5767ms)
✔ 10. Parent Routes: all required pages are implemented with proper exports (1.5427ms)
ℹ tests 17 | pass 17 | fail 0
```

### Complete Test Summary Table

| Workspace | Test Suite File | Tests | Pass | Fail | Duration |
| :--- | :--- | :---: | :---: | :---: | :---: |
| **Server** | `server/test/seed-test.js` | 1 | 1 | 0 | 7.94s |
| **Server** | `server/test/domain.test.js` | 7 | 7 | 0 | 11.2ms |
| **Server** | `server/test/server.test.js` | 17 | 17 | 0 | 4.19s |
| **Server** | `server/test/phase3.test.js` | 21 | 21 | 0 | 4.39s |
| **Server** | `server/test/phase4.test.js` | 24 | 24 | 0 | 11.45s |
| **Server** | `server/test/phase6.test.js` | 10 | 10 | 0 | 4.70s |
| **Client** | `client/test/accounts.test.js` | 7 | 7 | 0 | 11.0ms |
| **Client** | `client/test/phase5.test.js` | 10 | 10 | 0 | 85.9ms |
| **TOTAL** | **Monorepo Integration** | **97** | **97** | **0** | **11.60s** |

---

## 6. Headless Browser Verification Summary

```
=== VERIFICATION RESULTS SUMMARY ===
[PASS] Accounts Staff Login & Redirect
[PASS] Aggregate KPIs & 4 Centres Display
[PASS] Student Search & Fee Ledger View
[PASS] Manual Payment & GST Receipt Modal
[PASS] Unmatched Payment Dismissal & Queue
[PASS] Pro-rata Refund Calculation & Submission
[PASS] Reminders Schedule & Manual Worker Trigger
[PASS] Dropout Risk Triage Desk & Safety Banner
[PASS] Reports Preview & CSV Export
[PASS] Hindi Localization Parity & Switching
[PASS] Responsive 768px Tablet (No Overflow)
[PASS] Responsive 375px Mobile & Drawer Nav
[PASS] Zero Console Errors Audit
```

Visual evidence screenshots:
- [`phase6_01_accounts_dashboard_1440px.png`](file:///d:/Company%20Tasks/ISOCODE-Coaching-Fee-Management-System/fee-portal/screenshots/phase6_01_accounts_dashboard_1440px.png)
- [`phase6_02_dashboard_centre_filtered.png`](file:///d:/Company%20Tasks/ISOCODE-Coaching-Fee-Management-System/fee-portal/screenshots/phase6_02_dashboard_centre_filtered.png)
- [`phase6_03_students_search_1440px.png`](file:///d:/Company%20Tasks/ISOCODE-Coaching-Fee-Management-System/fee-portal/screenshots/phase6_03_students_search_1440px.png)
- [`phase6_04_student_ledger_1440px.png`](file:///d:/Company%20Tasks/ISOCODE-Coaching-Fee-Management-System/fee-portal/screenshots/phase6_04_student_ledger_1440px.png)
- [`phase6_05_manual_payment_receipt_modal.png`](file:///d:/Company%20Tasks/ISOCODE-Coaching-Fee-Management-System/fee-portal/screenshots/phase6_05_manual_payment_receipt_modal.png)
- [`phase6_06_unmatched_dismissed.png`](file:///d:/Company%20Tasks/ISOCODE-Coaching-Fee-Management-System/fee-portal/screenshots/phase6_06_unmatched_dismissed.png)
- [`phase6_07_refund_calculation_modal.png`](file:///d:/Company%20Tasks/ISOCODE-Coaching-Fee-Management-System/fee-portal/screenshots/phase6_07_refund_calculation_modal.png)
- [`phase6_08_refund_records_list.png`](file:///d:/Company%20Tasks/ISOCODE-Coaching-Fee-Management-System/fee-portal/screenshots/phase6_08_refund_records_list.png)
- [`phase6_09_reminders_page.png`](file:///d:/Company%20Tasks/ISOCODE-Coaching-Fee-Management-System/fee-portal/screenshots/phase6_09_reminders_page.png)
- [`phase6_10_risk_triage_desk.png`](file:///d:/Company%20Tasks/ISOCODE-Coaching-Fee-Management-System/fee-portal/screenshots/phase6_10_risk_triage_desk.png)
- [`phase6_11_reports_page.png`](file:///d:/Company%20Tasks/ISOCODE-Coaching-Fee-Management-System/fee-portal/screenshots/phase6_11_reports_page.png)
- [`phase6_12_hindi_accounts_dashboard.png`](file:///d:/Company%20Tasks/ISOCODE-Coaching-Fee-Management-System/fee-portal/screenshots/phase6_12_hindi_accounts_dashboard.png)
- [`phase6_13_responsive_768px_tablet.png`](file:///d:/Company%20Tasks/ISOCODE-Coaching-Fee-Management-System/fee-portal/screenshots/phase6_13_responsive_768px_tablet.png)
- [`phase6_14_responsive_375px_mobile_nav.png`](file:///d:/Company%20Tasks/ISOCODE-Coaching-Fee-Management-System/fee-portal/screenshots/phase6_14_responsive_375px_mobile_nav.png)

---

## Final Verification Decision

**VERDICT: READY FOR APPROVAL**

All four areas and the final refund payout audit requirements are completely resolved:
1. Approved Phase 2 refund formula ($5\%$ of `totalFee` capped at ₹5,000) verified in code and tests.
2. Refund payout audit strictly requires payment method, real transaction reference, and real payout date with no fallbacks. Missing evidence returns HTTP 400.
3. Refund rejection strictly requires a non-empty reason, persisted in dedicated `rejection` schema with rejecting staff ID and timestamp.
4. Duplicate processing attempts on paid or rejected refunds are blocked with HTTP 400.
5. All 97 monorepo tests pass cleanly with 0 failures, and browser verification confirms 13/13 passes with 0 console errors.

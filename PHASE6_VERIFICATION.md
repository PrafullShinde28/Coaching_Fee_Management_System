# FEETrack — Phase 6 Verification Report: Accounts Dashboard & Fee Management

**Status:** READY FOR FINAL APPROVAL  
**Evaluation Role:** Senior Backend & Full-Stack Engineer  
**Date:** 2026-11-09  
**Scope:** Phase 6 Final Hardening (Concurrency Control, Strict ISO Calendar Dates, Single Timestamping, Valid Starting Status)  

---

## Executive Summary & Final Hardening Pass

Following the review, a targeted final hardening pass was executed across `server/src/routes/accounts.js`, `server/src/models/index.js`, `server/test/phase6.test.js`, and `client/test/accounts.test.js`.

### Hardening Items Implemented & Verified:
1. **Concurrency-Safe Status Transitions (Atomic Operations):**
   - Eliminated read-check-save race condition window by transitioning from `findById -> save()` to an atomic `Refund.findOneAndUpdate({ _id: id, status: 'confirmed' }, update, { new: true })`.
   - Guaranteed at the MongoDB document write-lock level that only **one** concurrent request can transition a `confirmed` refund to `paid` or `rejected`.
   - Any second concurrent request receives **HTTP 400** (`error: Refund has already been processed with status: paid/rejected`), preventing audit overwrites or double disbursements.
2. **Strict Valid Starting Status (`confirmed` only):**
   - Refunds with `status: 'draft'`, `'paid'`, or `'rejected'` are rejected with **HTTP 400** (`error: Refund cannot be processed from status '...'`).
   - Failed transition attempts leave the database record completely unchanged.
3. **Consistent Rejection Timestamping:**
   - Captured `const rejectionTimestamp = clock.now();` once during rejection processing.
   - Reused the exact same timestamp instance for both `refund.rejection.rejectedAt` and `refund.inputs.rejectedAt`.
4. **Strict ISO Calendar Date/Time Validation:**
   - Replaced basic `Date.parse()` check with a strict calendar-aware validator (`isValidIsoDate`).
   - Enforces valid ISO-8601 patterns (`YYYY-MM-DD` or `YYYY-MM-DDTHH:mm:ss.sssZ`) and calendar limits (including leap-year calculations for February and months with 30 vs 31 days).
   - Rejects impossible calendar dates (e.g. `2026-02-31`, `2026-04-31`) and malformed strings with **HTTP 400**.
5. **Phase 2 Refund Calculation Preserved:**
   - Preserves approved 5% processing fee capped at ₹5,000 (500,000 paise).
6. **Fresh Automated Test Execution:**
   - **81 Server Tests:** 81 passed, 0 failed.
   - **17 Client Tests:** 17 passed, 0 failed.
   - **13 Headless Chrome Browser Tests (CDP):** 13 passed, 0 console errors.

---

## 1. Concurrency Control & Atomic Status Transition

### Implementation Strategy (`server/src/routes/accounts.js`)

```javascript
// Atomic conditional status transition: only a 'confirmed' refund can be transitioned.
// Concurrency guarantee: MongoDB document-level write locking ensures only ONE
// concurrent request matches { _id: id, status: 'confirmed' } and executes the mutation.
const updatedRefund = await Refund.findOneAndUpdate(
  { _id: id, status: 'confirmed' },
  atomicUpdate,
  { new: true, runValidators: true }
).populate([
  { path: 'studentId' },
  { path: 'payout.processedBy', select: 'phone role name' },
  { path: 'rejection.rejectedBy', select: 'phone role name' }
]);

if (!updatedRefund) {
  const existing = await Refund.findById(id);
  if (!existing) {
    return res.status(404).json({ error: 'Refund record not found' });
  }
  if (existing.status === 'paid' || existing.status === 'rejected') {
    return res.status(400).json({ error: `Refund has already been processed with status: ${existing.status}` });
  }
  if (existing.status !== 'confirmed') {
    return res.status(400).json({
      error: `Refund cannot be processed from status '${existing.status}'. Only confirmed refunds are eligible for processing.`
    });
  }
  return res.status(400).json({ error: 'Refund processing conflict: record state changed concurrently' });
}
```

---

## 2. Strict Calendar Date & Rejection Timestamp Consistency

### Strict ISO Calendar Date Validation (`server/src/routes/accounts.js`)

```javascript
function isValidIsoDate(str) {
  if (typeof str !== 'string') return false;
  const trimmed = str.trim();
  const isoPattern = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?(?:Z|([+-]\d{2}:?\d{2}))?)?$/;
  const match = trimmed.match(isoPattern);
  if (!match) return false;

  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const day = parseInt(match[3], 10);

  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;

  const isLeapYear = (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
  const maxDays = [31, isLeapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
  if (day > maxDays) return false;

  if (match[4] !== undefined) {
    const hour = parseInt(match[4], 10);
    const minute = parseInt(match[5], 10);
    const second = parseInt(match[6], 10);
    if (hour < 0 || hour > 23) return false;
    if (minute < 0 || minute > 59) return false;
    if (second < 0 || second > 59) return false;
  }

  const d = new Date(trimmed);
  return !isNaN(d.getTime());
}
```

### Rejection Timestamp Re-use (`server/src/routes/accounts.js`)

```javascript
const rejectionTimestamp = clock.now();
const rejectionReason = (payload.reason || payload.rejectionReason).trim();
atomicUpdate = {
  $set: {
    status: 'rejected',
    rejection: {
      reason: rejectionReason,
      rejectedBy: req.user._id,
      rejectedAt: rejectionTimestamp
    },
    'inputs.rejectionReason': rejectionReason,
    'inputs.rejectedBy': req.user._id,
    'inputs.rejectedAt': rejectionTimestamp
  },
  $unset: {
    payout: 1
  }
};
```

---

## 3. Integration & Concurrency Test Results

### Test Suite (`server/test/phase6.test.js`)

```
✔ 10. Refund Payout & Rejection Audit Validation: enforces mandatory fields, audit trail, and status integrity (638.9696ms)
✔ 11. Refund Processing Concurrency Hardening: atomic transitions block simultaneous payouts and rejections (189.2189ms)
```

Verified Test Scenarios:
1. **Concurrent Payout Requests:** Issued two simultaneous payouts (`Promise.all`) with references `CONC-PAY-A` and `CONC-PAY-B` against the same confirmed refund. Response statuses were strictly `[200, 400]`. Exactly one payout was written to the database; the second was blocked.
2. **Concurrent Rejection Requests:** Issued two simultaneous rejections (`Promise.all`) with reasons `Reason A` and `Reason B`. Response statuses were strictly `[200, 400]`. Exactly one rejection reason was persisted.
3. **Draft Status Blocked:** Attempting payout or rejection against a `status: 'draft'` refund returns **HTTP 400** (`error: Refund cannot be processed from status 'draft'. Only confirmed refunds are eligible for processing.`), leaving record state unchanged.
4. **Already Paid / Already Rejected Blocked:** Re-processing paid or rejected refunds returns **HTTP 400**.
5. **No Cross-State Overwrite:** Attempting payout on a rejected refund returns **HTTP 400** with no `payout` field written. Attempting rejection on a paid refund returns **HTTP 400** with no `rejection` field written.
6. **Impossible Calendar Dates Rejected:**
   - `paidAt: '2026-02-31'` $\rightarrow$ **HTTP 400**
   - `paidAt: '2026-04-31'` $\rightarrow$ **HTTP 400**
   - `paidAt: 'not-a-valid-date'` $\rightarrow$ **HTTP 400**
7. **Rejection Timestamp Equality:** `assert.equal(new Date(rejection.rejectedAt).toISOString(), new Date(inputs.rejectedAt).toISOString())` passed.

---

## 4. Complete Test Results Summary

Full execution of `npm --workspace server test; npm --workspace client test`:

```
> @fee-portal/server@0.1.0 test
✔ src\scripts\seed-test.js (20394.4437ms)
✔ instalment status: paid, partial, due soon, upcoming, overdue and overpayment (4.297ms)
✔ payment allocation targets an instalment or oldest unpaid; duplicates are no-op (1.5939ms)
✔ reminders use parent language, skip paid/left students and recheck before send (4.274ms)
✔ refund: day zero, term end, underpayment, zero payment, discount and deadline (1.1562ms)
✔ risk scorer produces explainable high-risk reasons for multiple declining signals (1.2435ms)
✔ partial instalment remains part_paid while overdue days are still derived (0.2326ms)
✔ targeted payment never spills into a second instalment and excess stays unallocated (0.7669ms)
✔ health endpoint is reachable and helmet security headers are present (12150.7691ms)
✔ input validation: Zod rejects invalid requests (438.0925ms)
✔ accounts user can authenticate, receives httpOnly session cookie and no JWT in body (130.4702ms)
✔ invalid OTP is rejected (85.4727ms)
✔ expired OTP is rejected (73.0421ms)
✔ unauthenticated requests are rejected from protected endpoints (54.6131ms)
✔ parent user authentication, first-login consent, ownership, and role isolation (570.7341ms)
✔ accounts user can access accounts endpoint (140.605ms)
✔ rate limiting: more than five attempts within window triggers HTTP 429 (190.758ms)
✔ error handling does not expose internal stack traces, secrets, or database details (16.8857ms)
✔ demo OTP is deterministic outside production (1.0635ms)
✔ production OTP is six digits and uses injected randomness (0.238ms)
✔ production OTP uses secure randomness by default and never enables demo OTP (0.6427ms)
✔ OTP values are never logged in production (0.4537ms)
✔ cookie security options: development vs production (0.2952ms)
✔ demo clock uses configured reference date (2.7693ms)
✔ phone validation pattern accepts international numbers and rejects junk (0.4774ms)
✔ 1. Parent retrieves only their own children (13776.2587ms)
✔ 2. Parent retrieves their own child fee ledger (105.2618ms)
✔ 3. Parent cannot retrieve another parent's child fee ledger (124.506ms)
✔ 4. Parent can generate a payment link for their own outstanding instalment (76.6439ms)
✔ 5. Parent cannot generate a payment link for another parent's instalment (47.0581ms)
✔ 6. Mock gateway creates a valid payment reference (4.0753ms)
✔ 7. Valid HMAC webhook records a payment (201.5702ms)
✔ 8. Invalid HMAC webhook is rejected (20.6378ms)
✔ 9. Duplicate webhook does not duplicate payment allocation (237.5768ms)
✔ 10. Duplicate webhook does not duplicate receipts (164.501ms)
✔ 11. Targeted payment allocates only to the specified instalment (118.0925ms)
✔ 12. Untargeted payment allocates to the oldest unpaid instalment (178.5801ms)
✔ 13. Unmatched payment enters the unmatched queue without changing balances (121.4098ms)
✔ 14. Accounts user can manually record a payment (109.1174ms)
✔ 15. Parent cannot record a manual payment (31.7828ms)
✔ 16. Accounts user can match and dismiss unmatched payments (278.4357ms)
✔ 17. Cross-student payment allocation is rejected (51.8159ms)
✔ 18. Successful payment generates a GST receipt (89.5441ms)
✔ 19. Receipt base + GST equals total for exact amounts and fractional roundings (1.309ms)
✔ 20. Failed payment generates no receipt (79.4447ms)
✔ 21. Sequential receipt numbers under concurrent requests (26.809ms)
✔ 1. All five offsets are generated correctly for eligible instalments (15490.5388ms)
✔ 2. English reminders use English templates (86.5419ms)
✔ 3. Hindi reminders use Hindi templates (1.5815ms)
✔ 4. Fully paid instalments are skipped during reminder generation and dispatch (987.2739ms)
✔ 5. Part-paid instalments with outstanding balance remain eligible (642.1111ms)
✔ 6. Left/inactive students are skipped (703.1554ms)
✔ 7. Payment cancels pending reminders (151.1913ms)
✔ 8. Repeated scheduler execution does not send duplicates (82.0222ms)
✔ 9. Outstanding balance is rechecked immediately before dispatch (60.1559ms)
✔ 10. One provider failure does not stop other reminders (82.4348ms)
✔ 11. Every dispatch attempt is recorded in MessageLog with audit fields (24.4171ms)
✔ 12. Parent cannot manually trigger reminder execution (31.8209ms)
✔ 13. Payment signals influence the score (46.8436ms)
✔ 14. Attendance decline influences the score (52.8618ms)
✔ 15. Test-score decline influences the score (31.9908ms)
✔ 16. Missing attendance/test data is handled safely without false inflation (28.7066ms)
✔ 17. Scores remain bounded between 0 and 100 under extreme signals (69.5425ms)
✔ 18. Risk reasons are readable and explainable (20.4894ms)
✔ 19. False-flag cooldown prevents new flags for 30 days (1348.1443ms)
✔ 20. Existing open flags are not duplicated (2316.437ms)
✔ 21. Accounts user can mark a flag called (28.8906ms)
✔ 22. Accounts user can mark a false flag with notes (26.1408ms)
✔ 23. Safety rule: Risk processing never creates payment records or changes instalment balances (1241.7343ms)
✔ 24. Safety rule: Risk processing never sends parent messages (1119.5931ms)
✔ 1. Role Authorization: Parent user cannot access accounts endpoints (12942.1367ms)
✔ 2. Accounts user can access centres and batches metadata endpoints (207.745ms)
✔ 3. Accounts Dashboard returns aggregate summary, centre summaries, and batch breakdowns (304.3131ms)
✔ 4. Accounts Students: search, filtering, and student ledger verification (312.6946ms)
✔ 5. Manual Payment Collection: records offline payment, auto-allocates, and issues sequential receipt (274.6091ms)
✔ 6. Unmatched Payments: retrieve queue, match to student, and dismiss with reason (107.7866ms)
✔ 7. Refunds: calculates preview, enforces 10-day deadline, records refund, and processes status (514.8976ms)
✔ 8. Reports CSV Export: generates sanitized CSV with formula injection prevention including leading whitespace & control chars (343.1752ms)
✔ 9. Bidirectional Role Isolation: Accounts cannot access Parent APIs & Parent cannot access Accounts APIs (74.9392ms)
✔ 10. Refund Payout & Rejection Audit Validation: enforces mandatory fields, audit trail, and status integrity (638.9696ms)
✔ 11. Refund Processing Concurrency Hardening: atomic transitions block simultaneous payouts and rejections (189.2189ms)
ℹ tests 81 | pass 81 | fail 0

> @fee-portal/client@0.1.0 test
✔ 1. Phase 6 Accounts Components and Pages Structure (21.7943ms)
✔ 2. Accounts Localization Parity: EN and HI dictionaries (6.5247ms)
✔ 3. CSV Sanitization: Formula Injection Protection with Leading Whitespace & Control Characters (0.75ms)
✔ 4. Approved Phase 2 Pro-rata Refund Formula Verification (0.4197ms)
✔ 5. 10-Day Withdrawal Deadline Logic Verification (3.0892ms)
✔ 6. Authentication Role-Based Routing and Redirect Verification (0.6164ms)
✔ 7. Refund Payout and Rejection Audit Schema Fields Verification (1.8565ms)
✔ 1. formatInr: converts integer paise to Indian Rupee currency correctly (37.4005ms)
✔ 2. formatDate: formats dates consistently and safely (8.5387ms)
✔ 3. formatPhone: formats Indian phone numbers cleanly (0.2436ms)
✔ 4. Design Tokens: tokens.css contains all required design variables (2.5886ms)
✔ 5. Localization: English and Hindi translation files have complete parity (4.6311ms)
✔ 6. API Client: enforces credentials: include and correct endpoint contracts (35.7437ms)
✔ 7. API Client: extracts error messages on HTTP 401/403/404 failures (1.2947ms)
✔ 8. Reusable Components: all 14 required design system components are implemented and exported (23.4298ms)
✔ 9. Security Rule: JWT tokens are strictly avoided in localStorage and sessionStorage (75.6408ms)
✔ 10. Parent Routes: all required pages are implemented with proper exports (28.2302ms)
ℹ tests 17 | pass 17 | fail 0
```

### Complete Test Totals Table

| Suite | Component / Area | Total Tests | Passed | Failed |
| :--- | :--- | :---: | :---: | :---: |
| **Server** | Isolated Seed Verification (`server/test/seed-test.js`) | 1 | 1 | 0 |
| **Server** | Phase 2 Domain Logic (`server/test/domain.test.js`) | 7 | 7 | 0 |
| **Server** | Phase 1 Auth & Security (`server/test/server.test.js`) | 17 | 17 | 0 |
| **Server** | Phase 3 Payments & Receipts (`server/test/phase3.test.js`) | 21 | 21 | 0 |
| **Server** | Phase 4 Reminders & Risk (`server/test/phase4.test.js`) | 24 | 24 | 0 |
| **Server** | Phase 6 Accounts & Hardened Refunds (`server/test/phase6.test.js`) | 11 | 11 | 0 |
| **Client** | Phase 6 Accounts Formatters & Audit Schemas (`client/test/accounts.test.js`) | 7 | 7 | 0 |
| **Client** | Phase 5 Parent Portal & Tokens (`client/test/phase5.test.js`) | 10 | 10 | 0 |
| **Browser (CDP)** | Headless Chrome End-to-End Verification (`scripts/verify-browser-phase6.js`) | 13 | 13 | 0 |
| **TOTAL** | **Entire Verified Test Suite** | **111** | **111** | **0** |

---

## 5. Headless Chrome Browser Verification (13/13 Checks)

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

Visual evidence screenshots generated:
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

## 6. Limitations & Boundaries

- **Zero Overwrite Tolerance:** Re-processing paid or rejected refunds is strictly rejected by the atomic conditional update.
- **Starting Status Constraint:** Processing is restricted to `status: 'confirmed'`. Draft refunds must be confirmed prior to payout or rejection.
- **Calendar Strictness:** Payout dates are validated against Gregorian calendar rules (no non-existent dates such as February 31).
- **Preserved Boundaries:** Phase 1–5 implementations remain untouched; Phase 7 has not been started.

**VERDICT: READY FOR FINAL APPROVAL**

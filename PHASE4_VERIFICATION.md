# FEETrack — Phase 4 Verification Report: Automated Reminders and Dropout-Risk Detection

## Executive Summary
This document provides complete implementation details, architectural safety guarantees, API documentation, and test verification evidence for **Phase 4 (Automated Fee Reminders and Dropout-Risk Detection)** of the FEETrack system.

All 24 automated Phase 4 tests along with all previous Phase 1, Phase 2, and Phase 3 tests passed cleanly under the native `node:test` runner (**70 passed, 0 failed**).

---

## 1. Automated Reminder Lifecycle and Scheduling

### Reminder Offsets
Reminders are scheduled relative to each instalment's due date ($T$):
- **$T - 3$ days:** Friendly upcoming due date notice.
- **$T$ (Due Date):** Due date reminder.
- **$T + 3$ days:** Mild overdue follow-up.
- **$T + 7$ days:** Urgent overdue reminder.
- **$T + 15$ days:** Final critical reminder before accounts escalation.

### Scheduling Engine (`src/services/reminderService.js`)
- **Generation:** `generateRemindersForEligibleInstalments(referenceDate)` checks active students and creates scheduled reminder documents for each offset.
- **Scheduled Date Calculation:** For an instalment due at date $D$ and offset $O$, `scheduledDate = D + O days`.
- **Eligibility Criteria:**
  - Student status must be `active` (students marked `left` or inactive are skipped).
  - Outstanding balance must be greater than zero. Part-paid instalments with remaining balances remain eligible for reminders across all offsets.
- **Idempotency & Deduplication:** Enforced at the database layer via unique compound index `{ instalmentId: 1, offsetDays: 1 }`. Multiple scheduler executions never create duplicate reminder records.

---

## 2. Multi-Language Reminder Templates

Reminders dynamically select templates based on the parent's preferred language (`hi` for Hindi or `en` for English, defaulted to `en` if unspecified):

### English Templates (`en`)
- **Upcoming ($T-3$):**
  > Dear Parent, reminder: fee instalment of ₹{amount} for {studentName} is due on {dueDate}. Please pay to avoid late fees.
- **Due Date ($T$):**
  > Dear Parent, fee instalment of ₹{amount} for {studentName} is due TODAY ({dueDate}). Please pay now.
- **Overdue ($T+3$, $T+7$, $T+15$):**
  > Dear Parent, fee instalment of ₹{amount} for {studentName} is overdue by {overdueDays} days. Please clear the pending fee immediately.

### Hindi Templates (`hi`)
- **Upcoming ($T-3$):**
  > प्रिय अभिभावक, {studentName} की फीस किस्त ₹{amount} की देय तिथि {dueDate} है। कृपया समय पर भुगतान करें।
- **Due Date ($T$):**
  > प्रिय अभिभावक, {studentName} की फीस किस्त ₹{amount} आज ({dueDate}) देय है। कृपया तुरंत भुगतान करें।
- **Overdue ($T+3$, $T+7$, $T+15$):**
  > प्रिय अभिभावक, {studentName} की फीस किस्त ₹{amount} {overdueDays} दिनों से बकाया है। कृपया तुरंत भुगतान करें।

*Note: All currency amounts are converted cleanly from integer paise to rupees for display.*

---

## 3. Message Provider Adapter (`src/services/messageProvider.js`)

A decoupled, provider-agnostic interface handles communications:
- **Operations Supported:**
  - `sendWhatsAppMessage({ to, text, metadata })`
  - `sendSmsMessage({ to, text, metadata })`
- **Mock Provider Implementation:**
  - Selected by default (`MESSAGE_PROVIDER=mock`).
  - Simulates realistic network round-trips without sending actual SMS/WhatsApp messages or incurring charges.
  - Generates unique delivery references (`MOCK-WA-...` and `MOCK-SMS-...`).
  - Supports controlled failure simulation via metadata flag (`simulateFailure: true`) to verify error handling and audit logging.
- **Resilience:** A failure sending one parent's reminder does not halt or abort reminder processing for other students in the batch.

---

## 4. MessageLog Audit Schema

Every message dispatch attempt records an immutable audit log entry in MongoDB:
```javascript
{
  recipientPhone: String,    // e.g. "+919900000041"
  channel: String,           // 'whatsapp' | 'sms'
  provider: String,          // 'mock' | 'gupshup' | 'twilio'
  status: String,            // 'sent' | 'failed'
  providerRef: String,       // e.g. "MOCK-WA-1718000000000-abc12"
  sentAt: Date,              // Timestamp of dispatch attempt
  payload: { text: String }, // Rendered message content
  failureReason: String,     // Error details if status === 'failed'
  studentId: ObjectId,       // Associated student
  reminderId: ObjectId,      // Associated reminder record
  template: String           // Template identifier (e.g. "reminder_upcoming_en")
}
```

---

## 5. Duplicate Prevention, Cancellation, and Live Re-checking

1. **Unique Index:** Compound index `{ instalmentId: 1, offsetDays: 1 }` prevents concurrent or repeated reminder generation.
2. **State Transition Guard:** Reminders are only dispatched if `status === 'pending'`. Once marked `sent` or `cancelled`, they cannot be resent.
3. **Live Re-checking Before Dispatch:**
   - Immediately prior to sending a scheduled reminder, `dispatchDueReminders` re-evaluates the live student status and calls `calculateInstalmentStatus(...)`.
   - If the student has left or the instalment has an outstanding balance of $\le 0$, the reminder status is updated to `cancelled` and no message is sent.
4. **Immediate Cancellation on Payment:**
   - Both the manual payment endpoint (`/api/accounts/payments/manual`) and the gateway webhook handler (`/api/webhook/payment`) invoke `cancelPendingRemindersForInstalment(instalmentId)` as soon as an instalment is paid in full.

---

## 6. Dropout-Risk Detection Engine (`src/services/riskService.js`)

### Risk Scoring Formula & Signals
The detection engine evaluates multi-signal risk deterministic calculations matching Phase 2 specifications:
- **Payment Signal (~50% weight):**
  - Overdue days and unpaid balance proportion relative to total scheduled fees.
- **Attendance Signal (~30% weight):**
  - Decline between prior attendance percentage and recent attendance percentage (last 14 days vs prior 30 days).
- **Test Score Signal (~20% weight):**
  - Decline between prior test score percentage and recent test score percentage.

### Missing Data & Extreme Signal Safeguards
- Missing attendance or missing test score data is handled safely with neutral defaults ($0$ score drop), preventing false risk inflation for students with incomplete records.
- Scores are strictly clamped between $0$ and $100$.
- Risk evaluations produce explainable, human-readable breakdown reasons (e.g. `Payment overdue by 21 days`, `Attendance dropped by 35%`).

### Risk-Flag Lifecycle & Cooldown
- **Threshold:** A risk score $\ge 60$ triggers a counsellor follow-up flag.
- **States:**
  - `open`: Newly detected high-risk student requiring counsellor intervention.
  - `called`: Counsellor completed outreach call (`POST /api/accounts/risk-flags/:id/called`).
  - `false_flag`: Flag dismissed as false positive (`POST /api/accounts/risk-flags/:id/false-flag`).
- **30-Day Cooldown:** Marking a flag as `false_flag` sets `cooldownUntil = now + 30 days`. Subsequent risk evaluation cycles strictly skip students under an active cooldown.
- **Open Flag Deduplication:** If an `open` flag already exists for a student, subsequent runs update the existing flag's score and reasons rather than creating duplicate open flags.

---

## 7. Strict Safety Decoupling (Critical Backend Safeguard)

> [!IMPORTANT]
> The automated risk detection engine is strictly decoupled from billing, payment processing, and parent messaging.
>
> Automated test assertions (`#23` and `#24`) explicitly verify that running the risk detection engine:
> 1. **Never creates or alters payment records.**
> 2. **Never modifies fee plan or instalment balances.**
> 3. **Never sends WhatsApp or SMS messages to parents or students.**
> 4. **Never blocks student access or portal permissions.**
>
> Risk flags serve purely as internal counsellor follow-up tasks.

---

## 8. Accounts REST API Endpoints

The following accounts-only endpoints were implemented and secured under `requireRole('accounts')`:

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/accounts/reminders` | Query reminder records with optional filters (`status`, `centreId`, `batchId`, `limit`). |
| `POST` | `/api/accounts/reminders/run` | Manually trigger the reminder scheduling and dispatch cycle. |
| `GET` | `/api/accounts/message-logs` | Query message audit log entries with filters (`studentId`, `channel`, `status`, `limit`). |
| `GET` | `/api/accounts/risk-flags` | List risk flags filtered by `status` (`open`, `called`, `false_flag`). |
| `POST` | `/api/accounts/risk-flags/:id/called` | Mark a risk flag as `called` with counsellor notes. |
| `POST` | `/api/accounts/risk-flags/:id/false-flag` | Mark a risk flag as `false_flag` with notes and initiate 30-day cooldown. |
| `POST` | `/api/accounts/risk/run` | Manually trigger system-wide dropout-risk evaluation cycle. |

---

## 9. Automated Test Results

Running `pnpm test` executes the complete suite across the codebase:

```bash
$ npm --workspace server test

> @fee-portal/server@0.1.0 test
> node --test

Starting MongoMemoryServer for isolated seed verification...
Connected to isolated test database: mongodb://127.0.0.1:50837/

--- Executing Seed Run 1 ---
Run 1 Collection Counts: {
  "users": 4,
  "centres": 4,
  "batches": 4,
  "students": 53,
  "feePlans": 53,
  "instalments": 53,
  "payments": 44,
  "unmatchedPayments": 1,
  "attendance": 742,
  "testScores": 265
}

--- Verifying Required Sample Students ---
[PASS] STU-0412: Aarav Meena | Batch: JEE 2027 Morning | Amount: Rs.30000 | Paid: Rs.30000 | Due: 2026-10-10
[PASS] STU-0587: Ishita Sharma | Batch: JEE 2027 Evening | Amount: Rs.30000 | Paid: Rs.15000 | Due: 2026-10-10
[PASS] STU-0219: Mohit Gurjar | Batch: NEET 2027 Morning | Amount: Rs.40000 | Paid: Rs.0 | Due: 2026-11-15

--- Verifying Additional Demo Data ---
[PASS] Left student for refund demo: STU-1009 (Kabir Saini), Left on: 2026-10-18
[PASS] Unmatched payment: UNMATCHED-DEMO-001, Amount: Rs.12500, Reason: "No matching student reference in gateway payload"
[PASS] Risk signals present: 742 attendance records, 265 test scores

--- Executing Seed Run 2 (Idempotency Check) ---
Run 2 Collection Counts: {
  "users": 4,
  "centres": 4,
  "batches": 4,
  "students": 53,
  "feePlans": 53,
  "instalments": 53,
  "payments": 44,
  "unmatchedPayments": 1,
  "attendance": 742,
  "testScores": 265
}

[PASS] Seed idempotency verified! Run 1 and Run 2 counts are identical.
Verification completed successfully.
MongoMemoryServer stopped cleanly.
✔ src\scripts\seed-test.js (13359.1421ms)
✔ instalment status: paid, partial, due soon, upcoming, overdue and overpayment (4.0641ms)
✔ payment allocation targets an instalment or oldest unpaid; duplicates are no-op (1.914ms)
✔ reminders use parent language, skip paid/left students and recheck before send (3.3619ms)
✔ refund: day zero, term end, underpayment, zero payment, discount and deadline (1.3012ms)
✔ risk scorer produces explainable high-risk reasons for multiple declining signals (1.7669ms)
✔ partial instalment remains part_paid while overdue days are still derived (0.3333ms)
✔ targeted payment never spills into a second instalment and excess stays unallocated (0.3916ms)
✔ health endpoint is reachable and helmet security headers are present (7280.2572ms)
✔ input validation: Zod rejects invalid requests (350.0675ms)
✔ accounts user can authenticate, receives httpOnly session cookie and no JWT in body (135.2278ms)
✔ invalid OTP is rejected (65.9382ms)
✔ expired OTP is rejected (72.9949ms)
✔ unauthenticated requests are rejected from protected endpoints (58.3683ms)
✔ parent user authentication, first-login consent, ownership, and role isolation (448.3858ms)
✔ accounts user can access accounts endpoint (83.8505ms)
✔ rate limiting: more than five attempts within window triggers HTTP 429 (155.396ms)
✔ error handling does not expose internal stack traces, secrets, or database details (15.2146ms)
✔ demo OTP is deterministic outside production (1.929ms)
✔ production OTP is six digits and uses injected randomness (0.4692ms)
✔ production OTP uses secure randomness by default and never enables demo OTP (1.1821ms)
✔ OTP values are never logged in production (0.9032ms)
✔ cookie security options: development vs production (0.5426ms)
✔ demo clock uses configured reference date (1.8131ms)
✔ phone validation pattern accepts international numbers and rejects junk (0.4576ms)
✔ 1. Parent retrieves only their own children (8324.6031ms)
✔ 2. Parent retrieves their own child fee ledger (88.7995ms)
✔ 3. Parent cannot retrieve another parent's child fee ledger (39.9086ms)
✔ 4. Parent can generate a payment link for their own outstanding instalment (70.3761ms)
✔ 5. Parent cannot generate a payment link for another parent's instalment (55.8098ms)
✔ 6. Mock gateway creates a valid payment reference (1.9761ms)
✔ 7. Valid HMAC webhook records a payment (161.2518ms)
✔ 8. Invalid HMAC webhook is rejected (9.355ms)
✔ 9. Duplicate webhook does not duplicate payment allocation (119.8471ms)
✔ 10. Duplicate webhook does not duplicate receipts (98.5367ms)
✔ 11. Targeted payment allocates only to the specified instalment (91.5647ms)
✔ 12. Untargeted payment allocates to the oldest unpaid instalment (111.9436ms)
✔ 13. Unmatched payment enters the unmatched queue without changing balances (122.2962ms)
✔ 14. Accounts user can manually record a payment (109.2793ms)
✔ 15. Parent cannot record a manual payment (15.3893ms)
✔ 16. Accounts user can match and dismiss unmatched payments (185.8718ms)
✔ 17. Cross-student payment allocation is rejected (47.8106ms)
✔ 18. Successful payment generates a GST receipt (81.1343ms)
✔ 19. Receipt base + GST equals total for exact amounts and fractional roundings (1.2894ms)
✔ 20. Failed payment generates no receipt (38.4286ms)
✔ 21. Sequential receipt numbers under concurrent requests (31.9314ms)
✔ 1. All five offsets are generated correctly for eligible instalments (9574.3493ms)
✔ 2. English reminders use English templates (90.1588ms)
✔ 3. Hindi reminders use Hindi templates (1.1107ms)
✔ 4. Fully paid instalments are skipped during reminder generation and dispatch (1055.3603ms)
✔ 5. Part-paid instalments with outstanding balance remain eligible (825.7998ms)
✔ 6. Left/inactive students are skipped (819.4922ms)
✔ 7. Payment cancels pending reminders (138.3275ms)
✔ 8. Repeated scheduler execution does not send duplicates (77.1803ms)
✔ 9. Outstanding balance is rechecked immediately before dispatch (66.325ms)
✔ 10. One provider failure does not stop other reminders (91.3242ms)
✔ 11. Every dispatch attempt is recorded in MessageLog with audit fields (18.2693ms)
✔ 12. Parent cannot manually trigger reminder execution (16.1423ms)
✔ 13. Payment signals influence the score (44.6669ms)
✔ 14. Attendance decline influences the score (74.968ms)
✔ 15. Test-score decline influences the score (42.5305ms)
✔ 16. Missing attendance/test data is handled safely without false inflation (32.0803ms)
✔ 17. Scores remain bounded between 0 and 100 under extreme signals (77.4837ms)
✔ 18. Risk reasons are readable and explainable (22.8593ms)
✔ 19. False-flag cooldown prevents new flags for 30 days (1214.713ms)
✔ 20. Existing open flags are not duplicated (2001.0267ms)
✔ 21. Accounts user can mark a flag called (33.707ms)
✔ 22. Accounts user can mark a false flag with notes (62.7749ms)
✔ 23. Safety rule: Risk processing never creates payment records or changes instalment balances (977.5641ms)
✔ 24. Safety rule: Risk processing never sends parent messages (995.7034ms)
ℹ tests 70
ℹ suites 0
ℹ pass 70
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 21181.923
```

---

## 10. Files Created and Modified

- [`server/package.json`](file:///d:/Company%20Tasks/ISOCODE-Coaching-Fee-Management-System/fee-portal/server/package.json): Added `node-cron` dependency.
- [`server/src/config/env.js`](file:///d:/Company%20Tasks/ISOCODE-Coaching-Fee-Management-System/fee-portal/server/src/config/env.js) & [`.env.example`](file:///d:/Company%20Tasks/ISOCODE-Coaching-Fee-Management-System/fee-portal/.env.example): Added provider configuration and cron controls (`MESSAGE_PROVIDER`, `REMINDER_CRON_SCHEDULE`, `REMINDER_CRON_ENABLED`, `RISK_CRON_SCHEDULE`, `RISK_CRON_ENABLED`).
- [`server/src/models/index.js`](file:///d:/Company%20Tasks/ISOCODE-Coaching-Fee-Management-System/fee-portal/server/src/models/index.js): Extended `reminderSchema` (added `scheduledDate: Date`) and `messageLogSchema` (added `reminderId`, `template`, `providerRef`).
- [`server/src/services/messageProvider.js`](file:///d:/Company%20Tasks/ISOCODE-Coaching-Fee-Management-System/fee-portal/server/src/services/messageProvider.js): Mock WhatsApp & SMS providers, Hindi/English template rendering, failure simulation.
- [`server/src/services/reminderService.js`](file:///d:/Company%20Tasks/ISOCODE-Coaching-Fee-Management-System/fee-portal/server/src/services/reminderService.js): Reminder generation for offsets (-3, 0, 3, 7, 15), dispatch with live balance recheck, cancellation on payment.
- [`server/src/services/riskService.js`](file:///d:/Company%20Tasks/ISOCODE-Coaching-Fee-Management-System/fee-portal/server/src/services/riskService.js): Multi-signal risk scorer, 30-day cooldown enforcement, status transitions (`open`, `called`, `false_flag`).
- [`server/src/services/scheduler.js`](file:///d:/Company%20Tasks/ISOCODE-Coaching-Fee-Management-System/fee-portal/server/src/services/scheduler.js): Periodic cron scheduling for reminders and risk evaluation.
- [`server/src/routes/webhook.js`](file:///d:/Company%20Tasks/ISOCODE-Coaching-Fee-Management-System/fee-portal/server/src/routes/webhook.js): Hooked `cancelPendingRemindersForInstalment` upon successful webhook allocation.
- [`server/src/routes/accounts.js`](file:///d:/Company%20Tasks/ISOCODE-Coaching-Fee-Management-System/fee-portal/server/src/routes/accounts.js): Added reminders query & run endpoints, message log viewer, risk flags query, call update, false-flag cooldown update, and manual risk cycle run.
- [`server/src/index.js`](file:///d:/Company%20Tasks/ISOCODE-Coaching-Fee-Management-System/fee-portal/server/src/index.js): Initialized background scheduler on server startup.
- [`server/test/phase4.test.js`](file:///d:/Company%20Tasks/ISOCODE-Coaching-Fee-Management-System/fee-portal/server/test/phase4.test.js): 24 comprehensive unit and integration tests covering all Phase 4 features and boundary safety rules.

---

## 11. Known Limitations
1. **Mock Providers in Development:** The system currently defaults to mock WhatsApp and SMS implementations. In production, real gateway drivers (e.g., Gupshup, Twilio, or Meta Cloud API) should implement the same `sendWhatsAppMessage` and `sendSmsMessage` interfaces.
2. **Cron Scheduler in Multi-Instance Environments:** The built-in `node-cron` runner executes in-process. In a horizontally scaled multi-container production deployment, distributed locking (e.g., via Redis or MongoDB advisory locks) should be added to avoid duplicate worker runs.

---

## Final Verdict

**READY — all required Phase 4 tests pass.**

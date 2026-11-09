# FEETrack — Engineering Assumptions & Decisions Register

This register documents all architectural, financial, domain, and operational assumptions made during the design and implementation of FEETrack.

---

## 1. Requirements vs. Assumptions: Formal Distinction

To ensure clarity for institute stakeholders, auditors, and future engineering teams:

| Category | Definition | Authority |
|---|---|---|
| **Hard Requirements** | Specified directly by institute operational briefs, statutory GST guidelines, or security standards. Non-negotiable without formal change requests. | Client Brief, Tax Law, OWASP Standards |
| **Engineering Assumptions** | Interpretations adopted to resolve ambiguities, establish deterministic algorithms, or unblock development where explicit institute policy had not been codified. | Engineering Architecture (Subject to Institute Sign-Off) |

---

## 2. Foundational System Assumptions

1. **Currency and Precision:** All monetary amounts in the database, API payloads, domain calculations, and ledgers are represented strictly as **integer paise** ($1\text{ INR} = 100\text{ paise}$). Seeded rupee values are converted to paise at the database ingestion boundary. IEEE-754 floating-point arithmetic is strictly prohibited in financial paths.
2. **Injectable Business Clock:** The system uses an injectable clock adapter (`server/src/config/clock.js`). When `DEMO_TODAY` is configured (defaulting to `2026-11-02` in demo environments), all business calculations evaluate against this reference date. In production, omitting `DEMO_TODAY` causes the clock to default directly to the host UTC system time.
3. **Parent Identity & Student Scoping:** A parent user account is linked to students via the `parentUserId` foreign key on the `Student` document. Authorization is strictly enforced based on authenticated session context (`req.user._id`), never on a client-supplied student ID alone. Parents cannot access, view, or pay for students linked to other parent accounts.
4. **Parental Consent Capture:** First-login consent records the authenticated user as `givenBy`, a UTC ISO timestamp as `at`, and a policy version string (e.g. `v1.0`). This satisfies digital compliance tracking for the portal MVP, but does not substitute for verifiable physical or digital signatures if required by regional educational regulations.
5. **Phone Number Formatting:** User and student contact numbers adhere to the international E.164 format with Indian country code (e.g. `+919900000001`). Validation uses a strict regex (`^\+?[1-9]\d{9,14}$`).
6. **Scale & Query Indexing:** Database schemas include compound indexes optimized for the anticipated query paths of 4 centres and ~2,600 students. Production deployments exceeding 10,000 students should undergo load and query execution plan reviews.

---

## 3. Fee Structure & Instalment Rules

1. **Sample Row Interpretation:** The sample instalment records provided in the initial brief (Aarav Meena ₹30,000 paid; Ishita Sharma ₹30,000 with ₹15,000 paid; Mohit Gurjar ₹40,000 unpaid) are treated as one active instalment each within an overall annual fee plan.
2. **Instalment Status Precedence:** The derived status of an instalment evaluates in strict precedence order:
   - `paid`: Outstanding balance is zero (`balance === 0`).
   - `part_paid`: At least 1 paise has been paid (`paidAmount > 0`), but a remaining balance exists (`balance > 0`).
   - `overdue`: Outstanding balance exists and the current date is strictly past the due date (`clock.today() > dueDate`). Note: `daysOverdue` is calculated for both unpaid and `part_paid` instalments (matching the Ishita Sharma example: part-paid and 23 days overdue).
   - `due_soon`: Outstanding balance exists and the instalment is due within 7 calendar days inclusive (`0 <= dueDate - clock.today() <= 7 days`).
   - `upcoming`: Outstanding balance exists and due date is more than 7 days in the future.
3. **Overpayment Handling:** If total payments allocated to an instalment exceed the instalment amount, the status evaluates as `paid` with a negative balance representing credit balance.

---

## 4. Approved Pro-Rata Refund Policy

> [!WARNING]
> **Legal Disclaimer:** The refund formula below represents an *engineered operational assumption* designed to model standard Indian coaching institute withdrawal practices. It does not constitute legal counsel or tax advice. The institute management must review and formally ratify this policy prior to commercial adoption.

### Exact Mathematical Specification
The refund calculation in `server/src/domain/refund.js` implements:

$$\text{clampedDaysUsed} = \min(\text{daysUsed}, \text{termDays})$$

$$\text{feeAfterDiscount} = \max(0, \text{totalFee} - \text{discount})$$

$$\text{usedShare} = \min\left(\text{feeAfterDiscount}, \text{roundDiv}\left(\text{feeAfterDiscount} \times \text{clampedDaysUsed}, \text{termDays}\right)\right)$$

$$\text{processingFee} = \min\left(\text{roundDiv}\left(\text{totalFee} \times 500, 10\,000\right), 500\,000\right)$$

$$\text{netRefund} = \max\left(0, \text{paid} - \text{usedShare} - \text{processingFee}\right)$$

$$\text{refundDeadline} = \text{leftOn} + 10 \text{ calendar days}$$

$$\text{where } \text{roundDiv}(n, d) = \left\lfloor \frac{n + \lfloor d / 2 \rfloor}{d} \right\rfloor$$

### Key Domain Principles
- **Processing Fee Basis:** The $5\%$ processing fee ($500\text{ basis points}$) is calculated on the pre-discount `totalFee` and capped at $500\,000\text{ paise}$ ($\text{\rupee}5,000$).
- **Used Share Basis:** The pro-rata tuition consumed by the student is calculated on the net payable tuition (`feeAfterDiscount`).
- **Enforced Deadline:** If `clock.today() > leftOn + 10 days`, the refund cannot be initiated and returns an explicit expiration error.
- **GST Apportionment:** GST is split proportionally from the refundable amount using the standard $18\%$ rate:
  $$\text{refundGst} = \text{roundDiv}(\text{netRefund} \times 18, 118), \quad \text{refundBase} = \text{netRefund} - \text{refundGst}$$

---

## 5. GST Treatment & Monotonic Receipts

1. **Inclusive GST:** Fee plans are GST-inclusive at $18\%$ for all tuition transactions, as specified in the institute brief.
2. **Rounding Invariant:** For every receipt and refund, integer paise math guarantees:
   $$\text{base} + \text{gst} \equiv \text{total}$$
   Fractional paise rounding uses half-up division (`roundDiv(amount * 18, 118)`).
3. **Monotonic Sequential Receipts:** Receipt numbers are generated monotonically via atomic MongoDB counter upserts using the format `RCP-YYYY-XXXXXX` (e.g. `RCP-2026-000001`). Failed, pending, or unmatched payments never generate receipts.

---

## 6. Payment Allocation Logic

1. **Targeted Payments:** When a payment explicitly specifies an `instalmentId`, the amount is allocated exclusively to that instalment. Excess funds never spill over into other instalments automatically; any surplus remains unallocated for accounts review.
2. **Untargeted Payments:** Offline or online payments without a specified instalment allocate automatically to the oldest unpaid or partially paid instalment first (FIFO).
3. **Cross-Student Prohibition:** A payment can only be credited to instalments belonging to the student referenced in the payment payload. Cross-student allocations are rejected by validation middleware.
4. **Unmatched Queue:** Payments received with missing, invalid, or unrecognized student reference numbers enter an `UnmatchedPayment` holding queue. They do not alter student ledger balances until an accounts staff member manually matches them to a student or dismisses them with an audit reason.

---

## 7. Automated Fee Reminder Engine

1. **Dispatch Offsets:** Reminders are scheduled at five fixed offsets relative to the instalment due date:
   - $T-3$ days (Pre-due reminder)
   - $T$ day (Due date reminder)
   - $T+3$ days (Grace period reminder)
   - $T+7$ days (First overdue notice)
   - $T+15$ days (Final urgent notice)
2. **Pre-Dispatch Balance Check:** The reminder scheduler re-queries the live database balance immediately before executing a dispatch attempt. If the student has paid, the instalment balance is zero, or the student is marked inactive/withdrawn, the reminder is skipped and cancelled.
3. **Idempotency:** A compound unique index on `(instalmentId, offsetDays)` in the `Reminder` collection prevents duplicate reminder records, even if the scheduler runs multiple times in a day.
4. **Bilingual Dispatch:** Messages are rendered in the parent's preferred language (`en` or `hi`) using localized templates.
5. **Audit Trail:** Every delivery attempt (success or simulated provider failure) is permanently recorded in `MessageLog` with timestamp, recipient phone, offset, and provider response.

---

## 8. Multi-Signal Dropout-Risk Scoring

1. **Pastoral Decoupling:** Risk evaluation is strictly a pastoral and academic triage aid for student counsellors. It **never** alters fee ledger balances, generates payment demands, blocks student access, or dispatches automated messages to parents.
2. **Deterministic Additive Heuristic:** The risk score ($0$ to $100$) is computed from three weighted signals:
   - **Payment Signals (Max 50 points):** Overdue days, partial payment status, and historical default frequency.
   - **Attendance Decline (Max 30 points):** Unexplained absences and declining attendance percentage over 30 days.
   - **Test Score Decline (Max 20 points):** Negative score trajectory across the last three internal mock exams.
3. **Risk Bands:**
   - Low Risk: $0$ to $34$
   - Medium Risk: $35$ to $64$
   - High Risk: $65$ to $100$
4. **False-Flag Cooldown:** When accounts or counselling staff mark a risk flag as a "False Flag" with notes, the student enters a mandatory 30-day cooldown period during which new automated flags for that category are suppressed.

---

## 9. Mock Provider Integration Boundaries

To maintain software engineering integrity:
- **Payment Gateway:** Configured via `PAYMENT_GATEWAY_PROVIDER=mock`. Creates deterministic simulation URLs (`https://checkout.feetrack-mock.test/pay/...`) and generates standard HMAC-SHA256 signatures for testing webhook receivers.
- **OTP Provider:** Configured via `MockOtpProvider`. Uses the deterministic code `246810` when `NODE_ENV !== 'production'`.
- **Messaging Provider:** Configured via `MockMessageProvider`. Logs simulated WhatsApp and SMS dispatches to database logs without incurring telecom charges or sending messages to real numbers.
- **Production Requirement:** Prior to real commercial usage, concrete adapters connecting to live aggregators (e.g. Razorpay, Cashfree, Gupshup, Twilio) must be instantiated and configured with production credentials.

---

## 10. Data Privacy & Synthetic Sample Directory

1. **Synthetic Data Guarantee:** All student names (Aarav Meena, Ishita Sharma, Mohit Gurjar, Kabir Saini, etc.), parent names, and staff identities are synthetic demo records created for system verification.
2. **Reserved Phone Number Space:** All telephone numbers in the seed database belong to the reserved synthetic testing range:
   - Accounts Staff: `+919900000001`
   - Parents: `+919900000041`, `+919900000058`, `+919900000021`
   - No real individuals or active phone numbers are stored in this codebase.
3. **Production Data Protection:** Live deployments must implement TLS in transit, database encryption at rest, role-based access controls, and strict audit logging to comply with the Digital Personal Data Protection Act (DPDP Act).

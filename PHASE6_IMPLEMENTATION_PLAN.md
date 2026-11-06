# FEETrack — Phase 6 Implementation Plan: Accounts Dashboard & Fee Management

## 1. Executive Summary & Codebase Audit

Phases 1–5 established the backend models, business domains, payment gateway/webhook processing, reminder scheduler, risk engine, and the parent portal frontend.

Phase 6 implements the internal **Accounts Staff Portal** to allow coaching institute administrative and accounts personnel to monitor financial metrics, record manual payments, reconcile unmatched transactions, manage student dropouts/refunds under written institute policy, triage dropout-risk flags, monitor reminder dispatches, and export audit-ready CSV reports.

---

## 2. Codebase Audit & Reusable Components

### Backend Models & Services (Phases 1–4)
- **Authentication**: JWT `httpOnly` cookie (`fee_portal_session`), role authorization middleware `requireRole('accounts')`. Accounts demo user: phone `+919900000001`.
- **Existing Models**: `User`, `Centre`, `Batch`, `Student`, `FeePlan`, `Instalment`, `Payment`, `Receipt`, `Refund`, `UnmatchedPayment`, `Reminder`, `MessageLog`, `RiskFlag`, `Attendance`, `TestScore`.
- **Existing Accounts APIs** in `server/src/routes/accounts.js`:
  - `GET /api/accounts/dashboard`: Summary totals (students, collected, expected, overdue, unmatched) and recent payments.
  - `GET /api/accounts/students`: Student directory with centre, batch, and fee metrics (`search`, `centreId`, `batchId`, `status`).
  - `GET /api/accounts/students/:studentId/ledger`: Detailed student ledger with fee plan, instalments, payments, receipts.
  - `GET /api/accounts/instalments`: Cross-centre instalments with status filtering.
  - `POST /api/accounts/payments/manual`: Record offline payment (cash, bank transfer), auto-allocate, generate sequential GST receipt.
  - `GET /api/accounts/unmatched-payments`: List unmatched transactions (`status: 'open' | 'matched' | 'dismissed'`).
  - `POST /api/accounts/unmatched-payments/:id/match`: Reconcile payment to student/instalment.
  - `POST /api/accounts/unmatched-payments/:id/dismiss`: Dismiss unmatched payment with recorded audit reason.
  - `GET /api/accounts/receipts`: All issued GST receipts with populated student and payment details.
  - `GET /api/accounts/reminders`: Reminder schedules query.
  - `POST /api/accounts/reminders/run`: Manually trigger reminder scheduling & dispatch cycle.
  - `GET /api/accounts/message-logs`: Message audit log query.
  - `GET /api/accounts/risk-flags`: Student dropout-risk flags query.
  - `POST /api/accounts/risk-flags/:id/called`: Mark risk flag as called.
  - `POST /api/accounts/risk-flags/:id/false-flag`: Dismiss flag as false positive (initiating 30-day cooldown).
  - `POST /api/accounts/risk/run`: Trigger risk evaluation cycle.

---

## 3. Critical Audit Finding: Refund Calculation Policy Comparison

> [!IMPORTANT]
> **Audit Comparison between Original Written Policy and Phase 2 Implementation:**
>
> 1. **Original Written Brief**:
>    - Formula: `usedShare = totalFee × daysUsed / termDays`
> 2. **Phase 2 Approved Implementation** ([`server/src/domain/refund.js`](file:///d:/Company%20Tasks/ISOCODE-Coaching-Fee-Management-System/fee-portal/server/src/domain/refund.js) & [`ASSUMPTIONS.md`](file:///d:/Company%20Tasks/ISOCODE-Coaching-Fee-Management-System/fee-portal/ASSUMPTIONS.md)):
>    - Formula: `usedShare = feeAfterDiscount × daysUsed / termDays`, where `feeAfterDiscount = Math.max(0, totalFee - discount)`.
>    - Processing fee: lesser of 5% of `totalFee` and ₹5,000 (`MAX_PROCESSING_FEE_PAISE = 500_000`).
>    - Gross refund: `max(0, paid - usedShare - processingFee)`.
>    - GST split: `refundGst = roundDiv(grossRefund * gstRatePct, 100 + gstRatePct)`.
>    - Deadline: `leftOn + 10 days`.
>
> **Decision & Policy Preservation**:
> Per the prompt's strict instruction ("*Do not silently alter it*"), we preserve the approved Phase 2 implementation in `server/src/domain/refund.js` and all existing unit tests in `server/test/domain.test.js`. The backend refund management endpoints will directly invoke `calculateProRataRefund` without modifying the core formula.

---

## 4. Backend Extensions Required in `server/src/routes/accounts.js`

To fully support the accounts portal UI without inventing endpoints, we will add the following validated endpoints to `server/src/routes/accounts.js`:

1. **Centres & Batches**:
   - `GET /api/accounts/centres`: Returns all centres (`_id`, `name`, `code`, `city`).
   - `GET /api/accounts/batches`: Returns batches with optional `centreId` filter.
2. **Dashboard Centre & Batch Summaries**:
   - Enhance `GET /api/accounts/dashboard` to return `centreSummaries` (name, total, collected, outstanding, collectionPct) and `batchSummaries` (name, centre, studentCount, total, collected, outstanding), supporting optional `centreId` and `batchId` query parameters.
3. **Refund Endpoints**:
   - `GET /api/accounts/refunds`: Returns existing refund records alongside left students who are eligible for refund processing.
   - `GET /api/accounts/refunds/calculate/:studentId`: Calculates a pro-rata refund preview using `calculateProRataRefund` and verifies the 10-day deadline from `student.leftOn`.
   - `POST /api/accounts/refunds`: Records a refund in MongoDB (`status: 'confirmed'`), strictly enforcing the 10-day deadline and preventing duplicate refunds for the same student.
   - `POST /api/accounts/refunds/:id/process`: Records the refund payout (`status: 'paid'` or `'rejected'`).
4. **Reports & CSV Exports**:
   - `GET /api/accounts/reports/export`: Returns sanitized CSV data for:
     - `centre_collections`
     - `batch_collections`
     - `outstanding_fees`
     - `overdue_instalments`
     - `payment_history`
     - `unmatched_payments`
     - `refund_history`
   - **Formula Injection Safeguard**: Prefixes any cell starting with `=`, `+`, `-`, or `@` with a single quote (`'`). Amounts formatted in INR.

---

## 5. Frontend Architecture & Accounts Portal Structure

We will implement the Accounts Portal under `client/src/pages/accounts/` and `client/src/components/accounts/`, reusing design tokens from `tokens.css`:

```
client/src/
├── components/
│   ├── accounts/
│   │   ├── AccountsLayout.jsx       # Accounts shell wrapping sidebar, header, and outlet
│   │   ├── AccountsSidebar.jsx      # Accounts navigation links
│   │   ├── AccountsHeader.jsx       # Staff profile, centre/batch quick filters, language toggle
│   │   ├── AccountsMobileNav.jsx    # Responsive mobile drawer for staff
│   │   └── AccountsProtectedRoute.jsx # Enforces authenticated user with role === 'accounts'
├── pages/
│   ├── accounts/
│   │   ├── AccountsDashboardPage.jsx  # Summary metrics, centre collection table, batch breakdown
│   │   ├── AccountsStudentsPage.jsx   # Student search, centre/batch/status filters, pagination
│   │   ├── AccountsStudentDetailPage.jsx # Student fee ledger, instalments, payments, receipts
│   │   ├── AccountsCollectionsPage.jsx # Manual payment entry form with real-time validation & receipt
│   │   ├── AccountsUnmatchedPage.jsx   # Unmatched payment queue, match modal, dismissal with reason
│   │   ├── AccountsRefundsPage.jsx     # Refund queue, 10-day deadline validation, calculation modal
│   │   ├── AccountsRemindersPage.jsx   # Reminder schedule status, logs view, manual run trigger
│   │   ├── AccountsRiskPage.jsx        # Dropout-risk queue, score bands, call action, false-flag modal
│   │   └── AccountsReportsPage.jsx     # Tabbed report viewer and secure CSV export downloads
```

### Route Guard & Login Redirection
- Update `LoginPage.jsx` so that accounts staff logging in with `+919900000001` are automatically redirected to `/accounts/dashboard`.
- If a parent attempts to visit `/accounts/*`, `AccountsProtectedRoute` denies access and redirects to `/parent/dashboard` (or displays an unauthorized alert).
- If an unauthenticated user attempts to visit `/accounts/*`, they are redirected to `/login`.

---

## 6. Internationalization (English & Hindi)

We will expand `src/locales/en/translation.json` and `src/locales/hi/translation.json` with full coverage for:
- Accounts navigation: `accountsNav.*`
- Accounts dashboard: `accountsDashboard.*`
- Manual collections: `accountsCollections.*`
- Unmatched reconciliation: `accountsUnmatched.*`
- Refunds: `accountsRefunds.*`
- Reminders: `accountsReminders.*`
- Risk flags: `accountsRisk.*`
- Reports & exports: `accountsReports.*`

---

## 7. Safety Decoupling & Security Boundaries

1. **Strict Financial Separation**:
   - Risk flags remain purely internal triage tasks. The frontend will never invoke any financial, payment, messaging, or student suspension actions from risk flags.
2. **Authority Stays on Backend**:
   - All financial math (instalment balance, pro-rata refund, receipt GST breakdown) is computed authoritatively on the backend in integer paise.
   - The frontend never calculates or overrides refund amounts or payment balances.
3. **No Credential Leaks**:
   - JWT tokens remain inside `httpOnly` cookies. No tokens or secrets are stored in `localStorage` or `sessionStorage`.

---

## 8. Testing Strategy

1. **Backend Integration Tests (`server/test/phase6.test.js`)**:
   - Access control: Parent cannot access accounts endpoints; accounts user can access.
   - Dashboard summary aggregates, centre summaries, batch summaries.
   - Centres & batches listing endpoints.
   - Student filtering by centre, batch, search term, and status.
   - Manual payment recording, auto-allocation, receipt creation, duplicate prevention.
   - Unmatched payment matching and dismissal (requiring mandatory reason).
   - Refund calculation preview, 10-day deadline enforcement, duplicate refund prevention.
   - Reminder query and manual run trigger.
   - Risk flag status transitions (`called`, `false_flag` with 30-day cooldown).
   - CSV export generation and formula injection sanitization.
2. **Frontend Tests (`client/test/accounts.test.js`)**:
   - Verification of accounts components, translation key parity, CSV sanitization, and route guards.
3. **Regression Tests**:
   - Run `pnpm test` ensuring all 80 existing tests continue to pass without regression.
4. **Browser Verification**:
   - Real Chrome CDP verification testing accounts dashboard, manual payments, unmatched reconciliation, refund processing, localization, and responsive viewports.

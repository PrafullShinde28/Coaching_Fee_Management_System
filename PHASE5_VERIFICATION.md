# FEETrack — Phase 5 Verification Report: Frontend Design System & Parent Portal

## Executive Summary
This document provides complete verification evidence for **Phase 5 (Frontend Design System & Parent Portal)** of the FEETrack coaching fee management system.

The frontend has been built using React, Vite, React Router, custom CSS design tokens, and `react-i18next`. All 10 frontend integration/unit tests pass cleanly, the production client build executes with zero errors, and all 70 backend integration tests (Phases 1–4) continue to pass without regression (**80 total tests passed, 0 failed**).

---

## 1. Files Created and Modified

### Frontend Architecture & Source Code
- [`package.json`](file:///d:/Company%20Tasks/ISOCODE-Coaching-Fee-Management-System/fee-portal/package.json): Added unified root scripts (`test:server`, `test:client`, `build:client`, `test`).
- [`client/package.json`](file:///d:/Company%20Tasks/ISOCODE-Coaching-Fee-Management-System/fee-portal/client/package.json): Added test runner script (`node --test test/**/*.test.js`).
- [`client/vite.config.js`](file:///d:/Company%20Tasks/ISOCODE-Coaching-Fee-Management-System/fee-portal/client/vite.config.js): Added development server proxy for `/api` pointing to `http://127.0.0.1:4000`.
- [`client/src/styles/tokens.css`](file:///d:/Company%20Tasks/ISOCODE-Coaching-Fee-Management-System/fee-portal/client/src/styles/tokens.css): Centralized design tokens (colors, typography, spacing, border radii, shadows).
- [`client/src/styles/global.css`](file:///d:/Company%20Tasks/ISOCODE-Coaching-Fee-Management-System/fee-portal/client/src/styles/global.css): Global reset, responsive grid system, typography, accessibility focus indicators.
- [`client/src/i18n.js`](file:///d:/Company%20Tasks/ISOCODE-Coaching-Fee-Management-System/fee-portal/client/src/i18n.js): `i18next` configuration with `localStorage` language persistence.
- [`client/src/locales/en/translation.json`](file:///d:/Company%20Tasks/ISOCODE-Coaching-Fee-Management-System/fee-portal/client/src/locales/en/translation.json): Complete English translation catalog.
- [`client/src/locales/hi/translation.json`](file:///d:/Company%20Tasks/ISOCODE-Coaching-Fee-Management-System/fee-portal/client/src/locales/hi/translation.json): Complete Hindi translation catalog with native coaching institute terminology.
- [`client/src/utils/formatters.js`](file:///d:/Company%20Tasks/ISOCODE-Coaching-Fee-Management-System/fee-portal/client/src/utils/formatters.js): Financial formatters (`formatInr` converting integer paise to formatted ₹), date formatting, phone number formatting.
- [`client/src/services/api.js`](file:///d:/Company%20Tasks/ISOCODE-Coaching-Fee-Management-System/fee-portal/client/src/services/api.js): Centralized API client with `credentials: 'include'`, error status extraction, and modular auth/parent methods.
- [`client/src/context/AuthContext.jsx`](file:///d:/Company%20Tasks/ISOCODE-Coaching-Fee-Management-System/fee-portal/client/src/context/AuthContext.jsx): Session management, login, logout, first-login consent tracking.
- [`client/src/context/ToastContext.jsx`](file:///d:/Company%20Tasks/ISOCODE-Coaching-Fee-Management-System/fee-portal/client/src/context/ToastContext.jsx): Toast notification queue.

### Reusable Components (`client/src/components/common/`)
- [`Button.jsx`](file:///d:/Company%20Tasks/ISOCODE-Coaching-Fee-Management-System/fee-portal/client/src/components/common/Button.jsx): Primary, secondary, outline, danger, loading states.
- [`Input.jsx`](file:///d:/Company%20Tasks/ISOCODE-Coaching-Fee-Management-System/fee-portal/client/src/components/common/Input.jsx): Accessible form inputs with labels, error states, and hints.
- [`Card.jsx`](file:///d:/Company%20Tasks/ISOCODE-Coaching-Fee-Management-System/fee-portal/client/src/components/common/Card.jsx): Surface card with title, subtitle, header action, and footer.
- [`Badge.jsx`](file:///d:/Company%20Tasks/ISOCODE-Coaching-Fee-Management-System/fee-portal/client/src/components/common/Badge.jsx): Status badges (Paid, Part Paid, Due Soon, Overdue, Upcoming, Active, Left) with symbols and colors.
- [`Modal.jsx`](file:///d:/Company%20Tasks/ISOCODE-Coaching-Fee-Management-System/fee-portal/client/src/components/common/Modal.jsx): Accessible modal with backdrop blur, keyboard escape handler, title, and footer actions.
- [`LoadingSpinner.jsx`](file:///d:/Company%20Tasks/ISOCODE-Coaching-Fee-Management-System/fee-portal/client/src/components/common/LoadingSpinner.jsx): SVG spinner with size variants.
- [`SkeletonLoader.jsx`](file:///d:/Company%20Tasks/ISOCODE-Coaching-Fee-Management-System/fee-portal/client/src/components/common/SkeletonLoader.jsx): Shimmer placeholders for cards, rows, and text.
- [`EmptyState.jsx`](file:///d:/Company%20Tasks/ISOCODE-Coaching-Fee-Management-System/fee-portal/client/src/components/common/EmptyState.jsx): Clean empty state with icon, title, description, and action.
- [`ErrorState.jsx`](file:///d:/Company%20Tasks/ISOCODE-Coaching-Fee-Management-System/fee-portal/client/src/components/common/ErrorState.jsx): Retryable error alert box.
- [`ConfirmDialog.jsx`](file:///d:/Company%20Tasks/ISOCODE-Coaching-Fee-Management-System/fee-portal/client/src/components/common/ConfirmDialog.jsx): Confirmation dialog with confirm/cancel buttons.
- [`ResponsiveTable.jsx`](file:///d:/Company%20Tasks/ISOCODE-Coaching-Fee-Management-System/fee-portal/client/src/components/common/ResponsiveTable.jsx): Responsive table wrapper with mobile scroll containment.
- [`Toast.jsx`](file:///d:/Company%20Tasks/ISOCODE-Coaching-Fee-Management-System/fee-portal/client/src/components/common/Toast.jsx): Floating toast notifications.
- [`LanguageSwitcher.jsx`](file:///d:/Company%20Tasks/ISOCODE-Coaching-Fee-Management-System/fee-portal/client/src/components/common/LanguageSwitcher.jsx): Fast English/Hindi toggle without page reload.

### Layout & Routing Components
- [`Sidebar.jsx`](file:///d:/Company%20Tasks/ISOCODE-Coaching-Fee-Management-System/fee-portal/client/src/components/layout/Sidebar.jsx): Desktop navigation with active route highlights.
- [`Header.jsx`](file:///d:/Company%20Tasks/ISOCODE-Coaching-Fee-Management-System/fee-portal/client/src/components/layout/Header.jsx): Header bar with institute name, mobile hamburger, phone display, language switcher, and logout.
- [`MobileNav.jsx`](file:///d:/Company%20Tasks/ISOCODE-Coaching-Fee-Management-System/fee-portal/client/src/components/layout/MobileNav.jsx): Responsive touch-friendly mobile drawer.
- [`ParentLayout.jsx`](file:///d:/Company%20Tasks/ISOCODE-Coaching-Fee-Management-System/fee-portal/client/src/components/layout/ParentLayout.jsx): App shell wrapping sidebar, header, and outlet.
- [`ProtectedRoute.jsx`](file:///d:/Company%20Tasks/ISOCODE-Coaching-Fee-Management-System/fee-portal/client/src/components/auth/ProtectedRoute.jsx): Route guard checking session and parent role.
- [`ConsentModal.jsx`](file:///d:/Company%20Tasks/ISOCODE-Coaching-Fee-Management-System/fee-portal/client/src/components/auth/ConsentModal.jsx): First-time login parental consent agreement modal.

### Application Pages (`client/src/pages/`)
- [`LoginPage.jsx`](file:///d:/Company%20Tasks/ISOCODE-Coaching-Fee-Management-System/fee-portal/client/src/pages/LoginPage.jsx): Two-step mobile OTP login with demo OTP helper for development.
- [`DashboardPage.jsx`](file:///d:/Company%20Tasks/ISOCODE-Coaching-Fee-Management-System/fee-portal/client/src/pages/parent/DashboardPage.jsx): Executive metrics, child summary cards, and recent payment history.
- [`ChildrenPage.jsx`](file:///d:/Company%20Tasks/ISOCODE-Coaching-Fee-Management-System/fee-portal/client/src/pages/parent/ChildrenPage.jsx): Directory of all enrolled children under the parent.
- [`StudentDetailPage.jsx`](file:///d:/Company%20Tasks/ISOCODE-Coaching-Fee-Management-System/fee-portal/client/src/pages/parent/StudentDetailPage.jsx): Child profile overview with fee ledger action.
- [`FeeLedgerPage.jsx`](file:///d:/Company%20Tasks/ISOCODE-Coaching-Fee-Management-System/fee-portal/client/src/pages/parent/FeeLedgerPage.jsx): Comprehensive fee ledger, instalment schedule, overdue indicators, payment history, and payment gateway modal.
- [`ReceiptsPage.jsx`](file:///d:/Company%20Tasks/ISOCODE-Coaching-Fee-Management-System/fee-portal/client/src/pages/parent/ReceiptsPage.jsx): GST tax receipts table and detailed breakdown modal.
- [`ProfilePage.jsx`](file:///d:/Company%20Tasks/ISOCODE-Coaching-Fee-Management-System/fee-portal/client/src/pages/parent/ProfilePage.jsx): Account information, verified phone, language preferences, and security details.
- [`NotFoundPage.jsx`](file:///d:/Company%20Tasks/ISOCODE-Coaching-Fee-Management-System/fee-portal/client/src/pages/NotFoundPage.jsx): Custom 404 page with navigation back to dashboard.
- [`App.jsx`](file:///d:/Company%20Tasks/ISOCODE-Coaching-Fee-Management-System/fee-portal/client/src/App.jsx): Top-level routing.
- [`main.jsx`](file:///d:/Company%20Tasks/ISOCODE-Coaching-Fee-Management-System/fee-portal/client/src/main.jsx): React 18 bootstrap with router, auth, and toast providers.
- [`client/test/frontend.test.js`](file:///d:/Company%20Tasks/ISOCODE-Coaching-Fee-Management-System/fee-portal/client/test/frontend.test.js): 10 frontend verification tests.

---

## 2. Design System Architecture

All visual styling adheres to `tokens.css`:
- **Primary Brand**: `#1e4a38` (Deep Forest Green)
- **Secondary**: `#2f6a52` (Emerald Green)
- **Background**: `#f7f9f7` (Soft Light Gray)
- **Surface**: `#ffffff` (White Card)
- **Text**: `#14221b` (Ink Dark), Muted: `#6b7e73`
- **Status Semantic Palette**:
  - `Paid` / `Active`: Green (`--color-success: #15803d`, BG: `#f0fdf4`)
  - `Part Paid`: Purple (`--color-part-paid: #6b21a8`, BG: `#faf5ff`)
  - `Due Soon`: Amber (`--color-warning: #b45309`, BG: `#fffbeb`)
  - `Overdue`: Red (`--color-danger: #b91c1c`, BG: `#fef2f2`)
  - `Upcoming`: Blue (`--color-info: #0369a1`, BG: `#f0f9ff`)
- **Accessibility Guarantee**: Statuses are never communicated by color alone. Every badge includes an explicit textual description and an associated symbol (`✓`, `!`, `⏱`, `◑`, `•`). Focus indicators (`:focus-visible`) use a 2px high-contrast outline.

---

## 3. Implemented Routes & Navigation

| Route | Component | Access | Description |
|---|---|---|---|
| `/login` | `LoginPage` | Public | OTP phone login with demo OTP helper. |
| `/parent/dashboard` | `DashboardPage` | Protected (Parent) | Overview of fees, children cards, recent payments. |
| `/parent/children` | `ChildrenPage` | Protected (Parent) | Directory of parent's children with fee status. |
| `/parent/children/:studentId` | `StudentDetailPage` | Protected (Parent) | Child profile and ledger jump point. |
| `/parent/children/:studentId/fees` | `FeeLedgerPage` | Protected (Parent) | Full fee ledger, instalments, and payment gateway modal. |
| `/parent/receipts` | `ReceiptsPage` | Protected (Parent) | GST receipts table and modal tax breakdown. |
| `/parent/profile` | `ProfilePage` | Protected (Parent) | Account phone, language switcher, consent status. |
| `*` | `NotFoundPage` | Public | 404 handler with return to dashboard. |

---

## 4. Integrated Backend APIs

All API calls are routed through `src/services/api.js` with `credentials: 'include'`:

| API Endpoint | Method | Role | Client Service Method | Used In Page/Component |
|---|---|---|---|---|
| `/api/auth/otp/request` | `POST` | Public | `api.auth.requestOtp(phone)` | `LoginPage` |
| `/api/auth/otp/verify` | `POST` | Public | `api.auth.verifyOtp(phone, otp)` | `LoginPage` |
| `/api/auth/me` | `GET` | Authenticated | `api.auth.getMe()` | `AuthContext` |
| `/api/auth/consent` | `POST` | Parent | `api.auth.submitConsent(version)` | `ConsentModal` |
| `/api/auth/logout` | `POST` | Authenticated | `api.auth.logout()` | `Sidebar`, `Header`, `ProfilePage` |
| `/api/parent/children` | `GET` | Parent | `api.parent.getChildren()` | `DashboardPage`, `ChildrenPage`, `ReceiptsPage` |
| `/api/parent/students/:id/ledger` | `GET` | Parent | `api.parent.getStudentLedger(id)` | `FeeLedgerPage`, `StudentDetailPage` |
| `/api/parent/students/:id/payments` | `GET` | Parent | `api.parent.getStudentPayments(id)` | `DashboardPage`, `FeeLedgerPage` |
| `/api/parent/students/:id/receipts` | `GET` | Parent | `api.parent.getStudentReceipts(id)` | `ReceiptsPage` |
| `/api/parent/instalments/:id/payment-link` | `POST` | Parent | `api.parent.createPaymentLink(id)` | `FeeLedgerPage` (Payment Modal) |

---

## 5. English and Hindi Localization

All parent-facing text is translated across `en/translation.json` and `hi/translation.json`:
- **Navigation**: Dashboard (`डैशबोर्ड`), My Children (`मेरे बच्चे`), Fees & Ledger (`फीस और लेज़र`), GST Receipts (`जीएसटी रसीदें`), Profile (`प्रोफ़ाइल`), Log Out (`लॉग आउट`).
- **Statuses**:
  - `Paid` $\to$ `भुगतान हो गया`
  - `Part Paid` $\to$ `आंशिक भुगतान`
  - `Due Soon` $\to$ `जल्द देय`
  - `Overdue` $\to$ `अतिदेय`
  - `Upcoming` $\to$ `आगामी`
- **Dynamic Language Switcher**: Persistent in `localStorage.getItem('feetrack_lang')` and updates immediately across the application without requiring a full page refresh.

---

## 6. Financial Integrity & Security Guarantees

1. **Integer Paise Storage & Conversion**:
   - The backend stores and transfers all currency values in integer paise.
   - The frontend never performs independent recalculations of balances. It strictly consumes backend-calculated `outstanding`, `paid`, and `daysOverdue`.
   - `formatInr(paise)` formats values into rupees with Indian grouping (`₹30,000`, `₹15,000.50`).
2. **Security & Session Management**:
   - `httpOnly` session cookies protect JWT tokens from JavaScript access.
   - Audited via `test/frontend.test.js`: zero instances of storing tokens in `localStorage` or `sessionStorage`.
3. **Payment Initiation & Webhook Source of Truth**:
   - Clicking "Pay Now" requests a payment link token from the backend.
   - The frontend displays the secure payment URL and allows redirecting to the gateway.
   - The frontend never marks a payment as successful on client redirect alone; ledger balances refresh against authoritative backend data.

---

## 7. Responsive Layout Verification

### Desktop Layout ($\ge 1024$px)
```
+------------------+-----------------------------------------------------------+
| FEETrack         | Apex Academy Jaipur           [🌐 हिन्दी]  +91 99000 00041 |
| Apex Academy     +-----------------------------------------------------------+
+------------------+  Dashboard                                                |
| 📊 Dashboard     |  [ Enrolled: 1 ]   [ Outstanding: ₹0 ]   [ Total: ₹30,000 ]|
| 👨‍🎓 My Children   |                                                           |
| 🧾 GST Receipts  |  My Children                                              |
| 👤 Profile       |  +-----------------------------------------------------+  |
|                  |  | Aarav Meena (STU-0412)             [ Active ]       |  |
|                  |  | Centre: Jaipur Central • Batch: JEE 2027 Morning    |  |
|                  |  | Fee Status: [ Paid ]    Outstanding: ₹0             |  |
|                  |  | Paid to Date: ₹30,000 / ₹30,000   [ View Ledger → ]  |  |
| 🚪 Log Out       |  +-----------------------------------------------------+  |
+------------------+-----------------------------------------------------------+
```

### Mobile Layout ($\le 768$px)
```
+-----------------------------------------------------------+
| [☰] Apex Academy Jaipur          [🌐 हिन्दी]  +91 99000 00041|
+-----------------------------------------------------------+
| Dashboard                                                 |
| [ Enrolled: 1 ]                                           |
| [ Outstanding: ₹0 ]                                       |
|                                                           |
| My Children                                               |
| +-------------------------------------------------------+ |
| | Aarav Meena                                           | |
| | STU-0412 • Jaipur Central                             | |
| | Fee Status: [ Paid ]                                  | |
| | Outstanding: ₹0                                       | |
| | [ View Fee Ledger → ]                                 | |
| +-------------------------------------------------------+ |
+-----------------------------------------------------------+
```
On mobile screens, wide tables are wrapped in a horizontally contained, touch-friendly scroll container (`ResponsiveTable`), ensuring zero horizontal overflow on the root document.

---

## 8. Test Execution Evidence

### 1. Client Production Build
```bash
$ npm --workspace client run build

> @fee-portal/client@0.1.0 build
> vite build

vite v6.4.5 building for production...
transforming...
✓ 84 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                   0.41 kB │ gzip:  0.29 kB
dist/assets/index-DbCk5BeZ.css    4.04 kB │ gzip:  1.34 kB
dist/assets/index-5T7mYej1.js   301.79 kB │ gzip: 88.15 kB
✓ built in 1.36s
```

### 2. Complete Workspace Test Suite (`pnpm test`)
```bash
$ npm --workspace server test && npm --workspace client test

> @fee-portal/server@0.1.0 test
> node --test

Starting MongoMemoryServer for isolated seed verification...
Connected to isolated test database: mongodb://127.0.0.1:64893/

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
✔ src\scripts\seed-test.js (6404.8407ms)
✔ instalment status: paid, partial, due soon, upcoming, overdue and overpayment (2.8698ms)
✔ payment allocation targets an instalment or oldest unpaid; duplicates are no-op (1.2774ms)
✔ reminders use parent language, skip paid/left students and recheck before send (2.341ms)
✔ refund: day zero, term end, underpayment, zero payment, discount and deadline (0.9683ms)
✔ risk scorer produces explainable high-risk reasons for multiple declining signals (1.8519ms)
✔ partial instalment remains part_paid while overdue days are still derived (0.3786ms)
✔ targeted payment never spills into a second instalment and excess stays unallocated (0.4175ms)
✔ health endpoint is reachable and helmet security headers are present (3198.952ms)
✔ input validation: Zod rejects invalid requests (94.2518ms)
✔ accounts user can authenticate, receives httpOnly session cookie and no JWT in body (36.5017ms)
✔ invalid OTP is rejected (23.9581ms)
✔ expired OTP is rejected (15.4835ms)
✔ unauthenticated requests are rejected from protected endpoints (15.1724ms)
✔ parent user authentication, first-login consent, ownership, and role isolation (143.4888ms)
✔ accounts user can access accounts endpoint (32.2157ms)
✔ rate limiting: more than five attempts within window triggers HTTP 429 (103.0425ms)
✔ error handling does not expose internal stack traces, secrets, or database details (16.3892ms)
✔ demo OTP is deterministic outside production (1.0721ms)
✔ production OTP is six digits and uses injected randomness (0.2203ms)
✔ production OTP uses secure randomness by default and never enables demo OTP (0.9944ms)
✔ OTP values are never logged in production (0.7999ms)
✔ cookie security options: development vs production (0.4289ms)
✔ demo clock uses configured reference date (1.2561ms)
✔ phone validation pattern accepts international numbers and rejects junk (0.2856ms)
✔ 1. Parent retrieves only their own children (3342.3395ms)
✔ 2. Parent retrieves their own child fee ledger (13.8256ms)
✔ 3. Parent cannot retrieve another parent's child fee ledger (13.7122ms)
✔ 4. Parent can generate a payment link for their own outstanding instalment (14.7152ms)
✔ 5. Parent cannot generate a payment link for another parent's instalment (15.0349ms)
✔ 6. Mock gateway creates a valid payment reference (0.3943ms)
✔ 7. Valid HMAC webhook records a payment (51.5494ms)
✔ 8. Invalid HMAC webhook is rejected (6.5742ms)
✔ 9. Duplicate webhook does not duplicate payment allocation (49.885ms)
✔ 10. Duplicate webhook does not duplicate receipts (47.1997ms)
✔ 11. Targeted payment allocates only to the specified instalment (26.176ms)
✔ 12. Untargeted payment allocates to the oldest unpaid instalment (36.9556ms)
✔ 13. Unmatched payment enters the unmatched queue without changing balances (36.2658ms)
✔ 14. Accounts user can manually record a payment (37.297ms)
✔ 15. Parent cannot record a manual payment (6.4785ms)
✔ 16. Accounts user can match and dismiss unmatched payments (73.6324ms)
✔ 17. Cross-student payment allocation is rejected (16.088ms)
✔ 18. Successful payment generates a GST receipt (26.1194ms)
✔ 19. Receipt base + GST equals total for exact amounts and fractional roundings (0.349ms)
✔ 20. Failed payment generates no receipt (19.2964ms)
✔ 21. Sequential receipt numbers under concurrent requests (9.6771ms)
✔ 1. All five offsets are generated correctly for eligible instalments (3685.4751ms)
✔ 2. English reminders use English templates (18.4423ms)
✔ 3. Hindi reminders use Hindi templates (0.4185ms)
✔ 4. Fully paid instalments are skipped during reminder generation and dispatch (250.713ms)
✔ 5. Part-paid instalments with outstanding balance remain eligible (248.6793ms)
✔ 6. Left/inactive students are skipped (193.9674ms)
✔ 7. Payment cancels pending reminders (76.3343ms)
✔ 8. Repeated scheduler execution does not send duplicates (27.1913ms)
✔ 9. Outstanding balance is rechecked immediately before dispatch (26.1525ms)
✔ 10. One provider failure does not stop other reminders (39.259ms)
✔ 11. Every dispatch attempt is recorded in MessageLog with audit fields (6.7553ms)
✔ 12. Parent cannot manually trigger reminder execution (5.5126ms)
✔ 13. Payment signals influence the score (9.4292ms)
✔ 14. Attendance decline influences the score (24.6058ms)
✔ 15. Test-score decline influences the score (16.2441ms)
✔ 16. Missing attendance/test data is handled safely without false inflation (10.7328ms)
✔ 17. Scores remain bounded between 0 and 100 under extreme signals (36.2716ms)
✔ 18. Risk reasons are readable and explainable (7.4628ms)
✔ 19. False-flag cooldown prevents new flags for 30 days (513.7204ms)
✔ 20. Existing open flags are not duplicated (771.6392ms)
✔ 21. Accounts user can mark a flag called (21.3837ms)
✔ 22. Accounts user can mark a false flag with notes (23.1986ms)
✔ 23. Safety rule: Risk processing never creates payment records or changes instalment balances (336.7454ms)
✔ 24. Safety rule: Risk processing never sends parent messages (306.4324ms)
ℹ tests 70
ℹ suites 0
ℹ pass 70
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 9240.7199

> @fee-portal/client@0.1.0 test
> node --test test/**/*.test.js

✔ 1. formatInr: converts integer paise to Indian Rupee currency correctly (19.4611ms)
✔ 2. formatDate: formats dates consistently and safely (4.5157ms)
✔ 3. formatPhone: formats Indian phone numbers cleanly (0.1923ms)
✔ 4. Design Tokens: tokens.css contains all required design variables (0.5443ms)
✔ 5. Localization: English and Hindi translation files have complete parity (0.8711ms)
✔ 6. API Client: enforces credentials: include and correct endpoint contracts (25.2699ms)
✔ 7. API Client: extracts error messages on HTTP 401/403/404 failures (0.7418ms)
✔ 8. Reusable Components: all 14 required design system components are implemented and exported (2.9259ms)
✔ 9. Security Rule: JWT tokens are strictly avoided in localStorage and sessionStorage (6.0927ms)
✔ 10. Parent Routes: all required pages are implemented with proper exports (1.1156ms)
ℹ tests 10
ℹ suites 0
ℹ pass 10
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 162.4321
```

---

## 9. Known Limitations
1. **PDF Download Generation**: The backend currently supplies structured JSON receipt objects (`number`, `base`, `gst`, `total`, `createdAt`, `paymentId`) rather than generating binary PDF documents on the server. The UI presents the complete receipt details in a modal and explicitly informs parents that physical copies can be printed at institute accounts.
2. **Phase Boundaries Respected**: Phase 5 covers the Parent Portal and Design System. In accordance with strict phase boundaries, Accounts management dashboards, accounts fee collections, refund processing, and counsellor task management remain reserved for Phase 6.

---

## Final Verdict

**READY — all required Phase 5 tests and builds pass.**

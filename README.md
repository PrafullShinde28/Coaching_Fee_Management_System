# FEETrack — Coaching Institute Fee Management System & Parent Portal

FEETrack is a specialized fee management and parent engagement platform engineered for multi-centre coaching institutes. Built to handle the operational scale of 4 coaching centres across Jaipur, ~2,600 enrolled students, 140 faculty and administrative staff, and an average annual tuition of ₹1.2 lakh distributed across 3–4 instalments per academic year.

The system replaces manual spreadsheets, unlinked paper receipts, and delayed bank reconciliations with an automated, auditable, and bilingual operations desk for accounts teams, alongside a friction-free parent fee portal.

---

## 1. Core Problem & Solution

### Operational Challenges
- **Reconciliation Delays:** Bank transfers and UPI payments with missing or truncated student reference numbers leave lakhs in untracked suspense accounts.
- **Cash & Offline Leakages:** Manual cash collection at front desks requires immediate physical paper receipts with monotonic GST compliance and instant ledger balancing.
- **Dropout & Attrition Blindspots:** Student dropouts often correlate with early fee payment defaults, unexplained attendance drops, and declining test scores. Institutes lack a unified triage desk to detect at-risk students before departure.
- **Refund Dispute Exposure:** Unclear withdrawal terms lead to disputes. An auditable, pro-rata refund mechanism with statutory GST accounting and strict departure deadlines is essential.

### The FEETrack Solution
- **Accounts Operations Portal:** Real-time collection metrics, centre and batch breakdowns, offline fee collection with instant receipt generation, unmatched transaction queue, pro-rata refund desk with atomic concurrency protection, automated fee reminder monitors, and dropout-risk triage desks.
- **Parent Portal:** Mobile-first, bilingual (English & Hindi) dashboard where parents can view fee ledgers, initiate payments via payment links, download sequential GST receipts, and track academic attendance and scores.
- **Zero Client-Side Token Storage:** High-security session model utilizing `httpOnly`, `SameSite=Lax`, `Secure` cookies with zero JWTs stored in browser `localStorage` or `sessionStorage`.

---

## 2. User Roles & Capabilities

| Role | Primary Interface | Capabilities |
|---|---|---|
| **Parent** | `/dashboard`, `/students/:id`, `/payments`, `/receipts`, `/profile` | Mobile-first portal. OTP login, first-login consent, multi-child switching, fee ledger inspection, online payment link initiation, instant GST receipt download, English/Hindi language toggle. |
| **Accounts Staff** | `/accounts/dashboard`, `/students`, `/collections`, `/refunds`, `/unmatched`, `/reminders`, `/risk`, `/reports` | Desktop-optimized desk. Aggregate collection KPIs, centre filtering, offline payment collection, unmatched payment matching/dismissal, pro-rata refund calculations and payout audits, dropout-risk triage, CSV report exports with injection sanitization. |

---

## 3. Technology Stack

### Frontend
- **Framework & Bundler:** React 18, Vite 6
- **Routing:** React Router DOM 6 (Declarative role-based routing guards)
- **Design System:** Custom CSS design tokens (`client/src/tokens.css`, `client/src/styles/tokens.css`), responsive layouts (1440px desktop, 768px tablet, 375px mobile)
- **Localization:** `react-i18next` with 1:1 parity between English (`en`) and Hindi (`hi`) dictionaries
- **Security:** Universal API client enforcing `credentials: 'include'` and zero token persistence in browser storage

### Backend
- **Runtime & Server:** Node.js 22 LTS, Express 4.21
- **ODM & Database:** Mongoose 8.9, MongoDB Atlas (production) / MongoDB Memory Server (isolated automated tests)
- **Validation & Security:** Zod 3.24 input validation schemas on all mutation routes, Helmet 8.0 security headers, CORS with credential allowlisting, Express Rate Limit (5 OTP attempts/min)
- **Background Jobs:** `node-cron` for automated reminder dispatch ($T-3, T, T+3, T+7, T+15$) and nightly dropout-risk scoring
- **Test Runner:** Built-in Node.js test runner (`node:test`, `node:assert`)

---

## 4. Architecture & Security Highlights

```
+-----------------------------------------------------------------------------------+
| CLIENT LAYER (React 18 SPA on Vercel Edge CDN)                                   |
| - Custom CSS Design Tokens (Themeable, lightweight, zero runtime CSS-in-JS)       |
| - English & Hindi Bilingual Engine (react-i18next)                                |
| - Security Rule: Zero JWTs in localStorage or sessionStorage                      |
+-----------------------------------------------------------------------------------+
                                           |
                        HTTPS (credentials: 'include')
                        Cookie Domain: .feetrack.in (Optional)
                                           v
+-----------------------------------------------------------------------------------+
| BACKEND API LAYER (Express 4.21 on Render Native Node.js 22 Runtime)             |
| - Security: Helmet, Rate-Limiting, CORS allowlist, httpOnly secure cookie parser  |
| - RBAC Guard: Bidirectional role isolation (requireRole('parent' | 'accounts'))    |
|                                                                                   |
| [Pure Domain Core] <-------------------> [Services & Controllers]                 |
| - instalment.js (status derivation)        - paymentGateway.js (mock adapter)     |
| - payment-allocation.js (FIFO & targeted)  - receipt.js (monotonic atomic counter)|
| - refund.js (pro-rata formula & caps)      - reminderService.js (T-3 to T+15)     |
| - risk-scorer.js (multi-signal triage)     - riskService.js (nightly evaluation)  |
| - csvSanitizer.js (OWASP formula defense)  - clock.js (injectable business clock) |
+-----------------------------------------------------------------------------------+
                                           |
                                  Mongoose Connection
                                           v
+-----------------------------------------------------------------------------------+
| DATA LAYER (MongoDB Atlas Replica Set Cluster)                                    |
| - 11 Mongoose Schemas with compound indexes and atomic concurrency controls       |
+-----------------------------------------------------------------------------------+
```

### Security Guarantees
1. **Integer Arithmetic:** All financial transactions, instalments, refunds, and GST breakdowns operate in integer **paise** ($1\text{ INR} = 100\text{ paise}$) with round-half-up division, eliminating IEEE-754 floating-point errors.
2. **Atomic Refund Concurrency:** Payouts and rejections enforce atomic status transitions using `findOneAndUpdate({ _id, status: 'confirmed' })`, mathematically preventing race conditions and double payouts.
3. **Webhook Verification:** Raw request body buffers are verified using HMAC-SHA256 and `crypto.timingSafeEqual` against timing attacks.
4. **CSV Injection Defense:** All exported spreadsheet cells are sanitized against OWASP formula injection by stripping leading whitespace/control characters and prefixing dangerous characters (`=`, `+`, `-`, `@`, `\t`, `\r`) with a single apostrophe (`'`).

---

## 5. Local Prerequisites & Installation

### Prerequisites
- **Node.js:** v20.x or v22.x or v24.x (Tested runtime: Node.js v24.19.0)
- **Package Manager:** `pnpm` v11.x (or `npm` v10+)
- **Database:** Local MongoDB instance or free MongoDB Atlas URI

### Setup Steps
1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd fee-portal
   ```

2. **Install dependencies:**
   ```bash
   # Using pnpm (authoritative workspace lockfile)
   pnpm install --frozen-lockfile

   # Or using npm
   npm install
   ```

3. **Configure environment variables:**
   ```bash
   cp .env.example .env
   ```
   *Edit `.env` to configure `MONGODB_URI` and ensure `JWT_SECRET` has at least 32 characters.*

4. **Seed deterministic demo data:**
   ```bash
   npm run seed
   ```

5. **Start the local development servers:**
   - **Backend API Server (Port 4000):**
     ```bash
     npm run dev:server
     ```
   - **Frontend Client (Port 5173):**
     ```bash
     npm --workspace client run dev
     ```
   - *Access the parent & accounts portal at `http://localhost:5173`.*

---

## 6. Verified Package Commands

Every script below has been verified directly against `package.json`, `server/package.json`, and `client/package.json`:

| Command | Working Directory | Action |
|---|---|---|
| `npm run seed` | Root | Populates MongoDB database with deterministic institutes, batches, students, ledgers, and demo users. |
| `npm run seed:test` | Root / Server | Runs double-run seed test against isolated in-memory MongoDB verifying record counts and idempotency. |
| `npm run test:server` | Root | Executes the complete server test suite (82 tests across 6 files). |
| `npm run test:client` | Root | Executes the complete client unit test suite (17 tests across 2 files). |
| `npm test` | Root | Executes server test suite followed by client test suite. |
| `npm run build:client` | Root | Bundles the React Vite frontend for production into `client/dist`. |
| `node scripts/verify-browser-phase6.js` | Root | Launches headless Chrome via CDP to run the 13-point browser E2E verification suite. |
| `node scripts/verify-backend-health.js` | Root | Runs backend socket binding, `/api/health` probe, and CORS preflight header validation. |

---

## 7. Demo Account Directory

When running in development or test mode (`NODE_ENV !== 'production'`), authentication uses the deterministic OTP **`246810`**.

| Role | Name | Phone Number | Accessible Scope | Primary Test Flow |
|---|---|---|---|---|
| **Accounts Staff** | Senior Accountant | `+919900000001` | All 4 centres, all batches, all students | Triage desk, manual payment recording, unmatched resolution, pro-rata refund desk, CSV reports. |
| **Parent** | Suresh Meena (Father of Aarav Meena) | `+919900000041` | Aarav Meena (STU-0412, JEE 2027 Morning) | Fully paid instalment (₹30,000 / ₹30,000 paid). GST receipt download. |
| **Parent** | Rajesh Sharma (Father of Ishita Sharma) | `+919900000058` | Ishita Sharma (STU-0587, JEE 2027 Evening) | Part-paid instalment (₹15,000 paid, ₹15,000 balance overdue). Generates payment link. Default Hindi locale. |
| **Parent** | Ramesh Gurjar (Father of Mohit Gurjar) | `+919900000021` | Mohit Gurjar (STU-0219, NEET 2027 Morning) | Unpaid upcoming instalment (₹40,000 balance). Generates payment link. |

*Note: In production mode (`NODE_ENV=production`), `DEMO_OTP` is strictly disabled, and OTPs must be dispatched through an external telecom SMS/WhatsApp gateway.*

---

## 8. Application Screenshots

The repository includes actual high-resolution verification screenshots captured during automated browser testing:

### Parent Portal
| View | Description | File Link |
|---|---|---|
| **Parent Login** | Mobile-first OTP login screen | [View Screenshot](screenshots/01_login_page_desktop.png) |
| **Parent Dashboard** | Student profile and fee summary (Aarav Meena) | [View Screenshot](screenshots/02_dashboard_aarav_desktop.png) |
| **Fee Ledger** | Detailed breakdown of fee instalments and balances | [View Screenshot](screenshots/04_fee_ledger_desktop.png) |
| **Payment Modal** | Online payment initiation link generator | [View Screenshot](screenshots/05_payment_modal_desktop.png) |
| **Receipts Desk** | Chronological list of issued GST receipts | [View Screenshot](screenshots/06_receipts_page_desktop.png) |
| **Hindi Localization** | Complete Hindi language toggle on parent profile | [View Screenshot](screenshots/08_localization_hindi_profile.png) |
| **Responsive Tablet** | Parent portal layout at 768px tablet viewport | [View Screenshot](screenshots/10_responsive_768px_tablet.png) |
| **Responsive Mobile** | Parent portal drawer navigation at 375px mobile viewport | [View Screenshot](screenshots/11_responsive_375px_mobile_drawer.png) |

### Accounts Portal
| View | Description | File Link |
|---|---|---|
| **Accounts Dashboard** | Institute-wide collection KPIs and batch summaries | [View Screenshot](screenshots/phase6_01_accounts_dashboard_1440px.png) |
| **Centre Filtering** | Real-time filtering by Jaipur branch centre | [View Screenshot](screenshots/phase6_02_dashboard_centre_filtered.png) |
| **Student Directory** | Search and ledger verification by student ID/name | [View Screenshot](screenshots/phase6_03_students_search_1440px.png) |
| **Manual Payment Modal** | Offline fee recording with instant GST receipt generation | [View Screenshot](screenshots/phase6_05_manual_payment_receipt_modal.png) |
| **Refund Calculation** | Pro-rata refund calculator with 10-day deadline warning | [View Screenshot](screenshots/phase6_07_refund_calculation_modal.png) |
| **Dropout Risk Triage** | Multi-signal pastoral risk triage desk (0–100 scale) | [View Screenshot](screenshots/phase6_10_risk_triage_desk.png) |
| **Accounts Hindi UI** | Accounts dashboard rendered in complete Hindi | [View Screenshot](screenshots/phase6_12_hindi_accounts_dashboard.png) |
| **Mobile Accounts Nav** | Bottom navigation bar on accounts mobile viewport | [View Screenshot](screenshots/phase6_14_responsive_375px_mobile_nav.png) |

---

## 9. MVP Limitations & Production Integration Boundaries

To maintain engineering accuracy, this codebase is formally classified as a **Deployable Demonstration / MVP (Category A)**:

| Component | MVP Implementation (Current State) | Production Requirement (Category B Pre-requisite) |
|---|---|---|
| **Payment Gateway** | `MockPaymentGateway` (`server/src/services/paymentGateway.js`) simulating payment links and HMAC-SHA256 signatures. | Real commercial merchant account with a licensed payment aggregator (e.g. Razorpay, Cashfree), API keys, webhook secret, and merchant banking KYC. |
| **OTP Delivery** | `MockOtpProvider` (`server/src/services/otpProvider.js`) using deterministic `DEMO_OTP` in non-prod or logging to console. | Indian Telecom TRAI DLT registration, approved SMS/WhatsApp transactional templates, and live SMS provider credentials (e.g. Gupshup, Twilio). |
| **Automated Reminders** | `MockMessageProvider` (`server/src/services/messageProvider.js`) logging dispatch attempts to database `MessageLog`. | Live WhatsApp Business API or SMS gateway adapter sending actual messages to parent phones. |
| **Scheduler Concurrency** | In-process `node-cron` schedulers. Single instance deployment. | Distributed lock (e.g. Redis Redlock or MongoDB collection lock) if horizontally scaling web containers to >1 instance. |
| **Student Data** | 53 synthetic students, synthetic phone numbers (+9199000000xx), and seed records. | Production database migration onboarding real student records, enrolled courses, and verified parent contacts. |

---

## 10. Verification Summary

- **Server Test Suite:** 82 passing tests (`node --test`).
- **Client Test Suite:** 17 passing tests (`node --test`).
- **Browser CDP Verification:** 13 verified browser checks (0 console errors).
- **Total Automated Checks:** **112 verified passing checks**.

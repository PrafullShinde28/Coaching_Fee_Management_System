# FEETrack — Phase 5 Implementation Plan: Frontend Design System & Parent Portal

## 1. Architectural Overview & Inspection

### Existing Backend Infrastructure (Phases 1–4)
The backend is an Express/Mongoose server running on port 4000 (configurable via `env.PORT`) with session authentication handled via `httpOnly` JWT cookies (`fee_portal_session`).

The relevant Phase 1–4 endpoints and schemas available for Phase 5:
- **Authentication (`/api/auth`)**:
  - `POST /api/auth/otp/request`: `{ phone: string }` $\to$ `{ ok: true, expiresInSeconds, demoOtp }`
  - `POST /api/auth/otp/verify`: `{ phone: string, otp: string }` $\to$ sets `httpOnly` cookie $\to$ `{ user: { id, role, phone, language, consentRequired } }`
  - `GET /api/auth/me`: Verifies cookie session $\to$ `{ user: { id, role, phone, language, consentRequired } }`
  - `POST /api/auth/consent`: `{ accepted: true, version: string }` $\to$ `{ ok: true, consent }`
  - `POST /api/auth/logout`: Clears cookie $\to$ `{ ok: true }`
- **Parent Portal (`/api/parent`)** [protected with `requireAuth` and `requireRole('parent')`]:
  - `GET /api/parent/children`: List authenticated parent's children with aggregated `feeSummary` (`total`, `paid`, `outstanding` in paise).
  - `GET /api/parent/students/:studentId/ledger`: Full fee ledger for a specific child (enriched instalments with derived `status`, `outstanding`, `daysOverdue`, `dueDate`, `amount`, `paid`).
  - `GET /api/parent/students/:studentId/payments`: Payment history for a child (`amount`, `source`, `gatewayRef`, `receivedAt`, `instalmentId`).
  - `GET /api/parent/students/:studentId/receipts`: GST receipts for a child (`number`, `base`, `gst`, `total`, `createdAt`, populated `paymentId`).
  - `POST /api/parent/instalments/:instalmentId/payment-link`: Generates/retrieves payment gateway link `{ id, url, amount, currency, status }`.

### Financial Precision & Display Rules
- All monetary values from the backend are in **integer paise**.
- The frontend will **never** calculate authoritative outstanding balances independently. It will strictly display backend-provided values.
- Formatting helper `formatInr(paise)` converts paise to formatted rupees (`₹30,000` or `₹15,000.50`) purely for UI presentation.

---

## 2. Frontend Architecture & Folder Structure

We will organize the `@fee-portal/client` workspace under `client/src`:
```
client/
├── index.html
├── package.json
├── vite.config.js
└── src/
    ├── main.jsx                     # Entry point with i18n & Router
    ├── App.jsx                      # Route definitions and layout tree
    ├── styles/
    │   ├── tokens.css               # Centralized CSS variables (colors, typography, spacing, shadows)
    │   └── global.css               # Global resets, typography, utility classes
    ├── locales/
    │   ├── en/translation.json      # English translations
    │   └── hi/translation.json      # Hindi translations
    ├── i18n.js                      # react-i18next setup with localStorage persistence
    ├── context/
    │   ├── AuthContext.jsx          # Session state, login, logout, consent status
    │   └── ToastContext.jsx         # Global notifications system
    ├── services/
    │   └── api.js                   # Centralized API client (fetch with credentials: 'include')
    ├── utils/
    │   └── formatters.js            # INR currency formatter (paise -> ₹) and date formatters
    ├── components/
    │   ├── common/
    │   │   ├── Button.jsx           # Variants: primary, secondary, outline, danger, disabled
    │   │   ├── Input.jsx            # Form input with label and validation errors
    │   │   ├── Card.jsx             # Surface card with header/body/footer
    │   │   ├── Badge.jsx            # Paid, Part Paid, Due Soon, Overdue, Upcoming
    │   │   ├── Modal.jsx            # Accessible overlay modal
    │   │   ├── LoadingSpinner.jsx   # Clean SVG spinner
    │   │   ├── SkeletonLoader.jsx   # Card & row skeleton states
    │   │   ├── EmptyState.jsx       # Icon + message empty placeholder
    │   │   ├── ErrorState.jsx       # Friendly retryable error display
    │   │   ├── ConfirmDialog.jsx    # Action confirmation dialog
    │   │   ├── ResponsiveTable.jsx  # Table that collapses cleanly on mobile
    │   │   ├── Toast.jsx            # Toast container and notification item
    │   │   └── LanguageSwitcher.jsx # English / Hindi toggle
    │   ├── layout/
    │   │   ├── Header.jsx           # User phone, language switcher, logout
    │   │   ├── Sidebar.jsx          # Desktop navigation
    │   │   ├── MobileNav.jsx        # Mobile drawer navigation
    │   │   └── ParentLayout.jsx     # Main responsive wrapper
    │   └── auth/
    │       ├── ProtectedRoute.jsx   # Checks parent role and authentication
    │       └── ConsentModal.jsx     # First-login consent compliance modal
    ├── pages/
    │   ├── LoginPage.jsx            # OTP phone authentication with demo OTP indicator
    │   ├── parent/
    │   │   ├── DashboardPage.jsx    # Parent overview, metrics, student summary cards
    │   │   ├── ChildrenPage.jsx     # All children directory
    │   │   ├── StudentDetailPage.jsx# Child overview redirecting/linking to fees & ledger
    │   │   ├── FeeLedgerPage.jsx    # Detailed fee ledger, instalments, and payment link modal
    │   │   ├── ReceiptsPage.jsx     # GST receipts listing with details modal
    │   │   └── ProfilePage.jsx      # Parent profile and language preference
    │   └── NotFoundPage.jsx
    └── test/
        └── frontend.test.js         # Frontend unit and component tests
```

---

## 3. Design System & Tokens (`src/styles/tokens.css`)

### Color Palette (Coaching Institute Theme)
- **Primary Brand**: `#1e4a38` (Deep Forest Green), Hover: `#16392b`
- **Secondary**: `#2f6a52` (Emerald Green)
- **Surface**: `#ffffff` (White), Background: `#f7f9f7` (Soft Light Gray)
- **Text**: `#14221b` (Ink Dark), Text Muted: `#5c6e64`
- **Line / Border**: `#e1e7e3`
- **States**:
  - `success`: `#168052` (Background: `#eaf7f0`)
  - `warning` / `due_soon`: `#b86200` (Background: `#fef5e7`)
  - `danger` / `overdue`: `#c52222` (Background: `#fdf0f0`)
  - `info` / `upcoming`: `#1a6896` (Background: `#edf6fb`)
  - `part_paid`: `#7a44a6` (Background: `#f6f0fb`)

### Typography & Spacing
- Font family: `Inter`, system-ui, -apple-system, sans-serif
- Scale: `xs` (12px), `sm` (14px), `base` (16px), `lg` (18px), `xl` (20px), `2xl` (24px), `3xl` (30px)
- Spacing scale: `4px`, `8px`, `12px`, `16px`, `24px`, `32px`, `48px`
- Border radius: `8px`, `12px`, `16px`, `24px`, `9999px` (Pill)
- Shadows: Multi-tiered subtle elevations (`shadow-sm`, `shadow-md`, `shadow-lg`)

---

## 4. Internationalization (English & Hindi)

Using `react-i18next`:
- English: `src/locales/en/translation.json`
- Hindi: `src/locales/hi/translation.json`
- All labels, table headers, statuses (`Paid`/`भुगतान हो गया`, `Part Paid`/`आंशिक भुगतान`, `Due Soon`/`जल्द देय`, `Overdue`/`अतिदेय`, `Upcoming`/`आगामी`), buttons, and error messages translated accurately into standard conversational Hindi.
- Switching language updates React state immediately and stores choice in `localStorage.getItem('feetrack_lang')`.

---

## 5. Payment Flow Integration

1. Parent views instalments on `/parent/children/:studentId/fees`.
2. When clicking **"Pay Now"** on an instalment with `outstanding > 0`:
   - Frontend calls `POST /api/parent/instalments/:instalmentId/payment-link`.
   - On response, a payment initiation dialog displays the secure gateway reference, payable amount in rupees, and payment link URL.
   - For demo/mock gateway, provides a direct action to complete mock payment or copy link.
   - Refreshes ledger upon modal close/confirmation.
   - Backend webhook remains the sole source of truth for actual ledger payment allocation.

---

## 6. Verification and Testing Strategy

1. **Lightweight Test Suite**:
   - Write comprehensive component and integration tests in `client/test/frontend.test.js` verifying formatting, token contracts, translations, state rendering, and API abstraction.
2. **Build Verification**:
   - Run `pnpm --filter @fee-portal/client run build` to verify zero compile or bundling errors.
3. **Backend Regression Verification**:
   - Run `pnpm test` (root test suite) to ensure 100% of the 70 existing Phase 1–4 tests continue to pass without regression.
4. **Deliverables**:
   - Generate `PHASE5_VERIFICATION.md` detailing all implemented components, routes, evidence, and final status.

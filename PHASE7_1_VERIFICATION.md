# FEETrack — Phase 7.1 Verification Report: Native Cloud Deployment Configuration

**Status:** Completed and Verified  
**Date:** 2026-11-09  
**Deployment Model:** Strictly Non-Containerized Native Cloud (Render Node.js Native Runtime + Vercel Edge CDN + MongoDB Atlas)  
**Package Manager:** pnpm v11.22.0  
**Target Runtime:** Node.js 22 LTS  

---

## 1. Executive Summary

Sub-Phase 7.1 has been implemented and verified. In accordance with architectural directives, **all Docker and containerization tools were excluded**. The system is configured for native cloud deployment:
1. **Backend (Render):** Express API running directly on Render's native Node.js 22 runtime, bound to `0.0.0.0` with `process.env.PORT` dynamically assigned, health checks on `/api/health`, and graceful shutdown handlers (`SIGTERM` / `SIGINT`).
2. **Frontend (Vercel):** React + Vite SPA with declarative routing rewrites (`client/vercel.json`), configurable API base URL (`VITE_API_BASE_URL`), and credentials-included fetch requests (`credentials: 'include'`).
3. **Cross-Origin Authentication:** Added optional `COOKIE_DOMAIN` support in `server/src/config/env.js` and `server/src/routes/auth.js`. Cookies are configured with `HttpOnly=true`, `Secure=true` (in production), `SameSite=Lax`, and dynamically scoped to the shared apex domain (e.g. `.feetrack.in`) when configured.

All 82 server tests, 17 client tests, the production Vite client build, and a live health/CORS probe passed with zero errors.

---

## 2. Files Changed and Created

| File | Change Type | Description |
|---|---|---|
| `server/src/config/env.js` | **Modified** | Added optional `COOKIE_DOMAIN` schema validation with string trimming and empty-string transformation to `undefined`. |
| `server/src/routes/auth.js` | **Modified** | Updated `getCookieOptions` and `getClearCookieOptions` to accept an optional `cookieDomain` parameter defaulting to `env.COOKIE_DOMAIN`, applying the `domain` attribute only when configured. |
| `server/src/index.js` | **Modified** | Bound server explicitly to `0.0.0.0:${env.PORT}` for Render compatibility and added `SIGTERM`/`SIGINT` graceful shutdown handlers. |
| `server/test/phase1.test.js` | **Modified** | Added unit tests verifying cookie options when `COOKIE_DOMAIN` is unconfigured (`domain` omitted) vs configured (`domain: '.feetrack.in'`). |
| `.env.example` | **Modified** | Documented optional `COOKIE_DOMAIN` environment variable. |
| `render.yaml` | **Created** | Render Blueprint specification for native Node.js web service with health check, pnpm build, and environment variables. |
| `client/vercel.json` | **Created** | Vercel SPA routing rewrite configuration redirecting all client routes to `/index.html`. |
| `client/.env.example` | **Created** | Frontend environment variable template documenting `VITE_API_BASE_URL`. |
| `scripts/verify-backend-health.js` | **Created** | Automated test harness proving backend socket binding on `0.0.0.0:4005`, HTTP 200 on `/api/health`, and CORS preflight OPTIONS headers. |

---

## 3. Native Render Deployment Configuration

### Service Blueprint (`render.yaml`)

```yaml
# Render Blueprint configuration for FEETrack Native Node.js Backend
services:
  - type: web
    name: feetrack-api
    runtime: node
    plan: starter
    region: oregon
    buildCommand: corepack enable && corepack prepare pnpm@11.22.0 --activate && pnpm install --frozen-lockfile
    startCommand: pnpm --filter @fee-portal/server start
    healthCheckPath: /api/health
    envVars:
      - key: NODE_ENV
        value: production
      - key: NODE_VERSION
        value: 22
      - key: PORT
        value: 10000
      - key: MONGODB_URI
        sync: false
      - key: JWT_SECRET
        generateValue: true
      - key: COOKIE_NAME
        value: fee_portal_session
      - key: COOKIE_DOMAIN
        sync: false
      - key: CLIENT_ORIGIN
        sync: false
      - key: PAYMENT_GATEWAY_PROVIDER
        value: mock
      - key: PAYMENT_WEBHOOK_SECRET
        generateValue: true
      - key: MESSAGE_PROVIDER
        value: mock
      - key: REMINDER_CRON_ENABLED
        value: "false"
      - key: RISK_CRON_ENABLED
        value: "false"
```

### Key Render Settings
- **Runtime:** Native Node.js (Version `22`).
- **Build Command:** `corepack enable && corepack prepare pnpm@11.22.0 --activate && pnpm install --frozen-lockfile` (reproducible dependency installation without drift).
- **Start Command:** `pnpm --filter @fee-portal/server start` (executes `node src/index.js` from `server/package.json`).
- **Health Check Endpoint:** `/api/health` (verified existing endpoint in `server/src/app.js`).
- **Socket Binding:** `0.0.0.0:${process.env.PORT}`.
- **Graceful Shutdown:** `SIGTERM` listener closes HTTP listener and terminates cleanly within 10 seconds.

---

## 4. Vercel Frontend Deployment Configuration

### Configuration (`client/vercel.json`)

```json
{
  "framework": "vite",
  "buildCommand": "vite build",
  "outputDirectory": "dist",
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

### Key Vercel Settings
- **Framework Preset:** Vite.
- **Root Directory:** `client` (when linking Git repository).
- **Build Command:** `vite build` (or `pnpm --filter @fee-portal/client run build` if deployed from monorepo root).
- **Output Directory:** `dist`.
- **SPA Routing:** Direct deep navigation (e.g. `/accounts/dashboard`, `/students/:id`) and browser refreshes are routed to `/index.html`.
- **API URL Configuration:** Managed via `VITE_API_BASE_URL` (e.g. `https://api.feetrack.in/api`).
- **Credentials:** `client/src/services/api.js` explicitly specifies `credentials: 'include'` on all `fetch` requests.

---

## 5. Cookie and CORS Implementation

### Cookie Domain Scoping
In `server/src/routes/auth.js`:
```javascript
export const getCookieOptions = (isProduction = env.NODE_ENV === 'production', cookieDomain = env.COOKIE_DOMAIN) => ({
  httpOnly: true,
  secure: isProduction,
  sameSite: 'lax',
  maxAge: 8 * 60 * 60 * 1000,
  path: '/',
  ...(cookieDomain ? { domain: cookieDomain } : {})
});
```

- **Unconfigured (`COOKIE_DOMAIN` unset):** The `domain` attribute is omitted. The browser scopes the session cookie strictly to the host that issued it.
- **Configured (`COOKIE_DOMAIN=.feetrack.in`):** The cookie is scoped across all subdomains under `.feetrack.in`.

### Intended Domain Topology (Example)
```
      Browser Client
    https://portal.feetrack.in (Frontend hosted on Vercel)
               |
               | Fetch with Credentials: 'include'
               v
    https://api.feetrack.in (Backend hosted on Render)
               |
     Response Cookie:
     Set-Cookie: fee_portal_session=...; Domain=.feetrack.in; Path=/; SameSite=Lax; Secure; HttpOnly
```

### CORS Verification
In `server/src/app.js`:
```javascript
app.use(cors({ origin: env.CLIENT_ORIGIN, credentials: true }));
```
- Restricts origin strictly to the exact value of `env.CLIENT_ORIGIN` (never wildcard `*`).
- Sets `Access-Control-Allow-Credentials: true`.
- Automatically responds to HTTP `OPTIONS` preflight checks with HTTP 204.

---

## 6. Exact Commands Executed & Test Results

### 1. Server Test Suite (82 Tests Passing)
```powershell
npm --workspace server test
```
**Output:**
```
✔ src\scripts\seed-test.js
✔ instalment status: paid, partial, due soon, upcoming, overdue and overpayment
✔ payment allocation targets an instalment or oldest unpaid; duplicates are no-op
✔ reminders use parent language, skip paid/left students and recheck before send
✔ refund: day zero, term end, underpayment, zero payment, discount and deadline
✔ risk scorer produces explainable high-risk reasons for multiple declining signals
✔ partial instalment remains part_paid while overdue days are still derived
✔ targeted payment never spills into a second instalment and excess stays unallocated
✔ health endpoint is reachable and helmet security headers are present
✔ input validation: Zod rejects invalid requests
✔ accounts user can authenticate, receives httpOnly session cookie and no JWT in body
✔ invalid OTP is rejected
✔ expired OTP is rejected
✔ unauthenticated requests are rejected from protected endpoints
✔ parent user authentication, first-login consent, ownership, and role isolation
✔ accounts user can access accounts endpoint
✔ rate limiting: more than five attempts within window triggers HTTP 429
✔ error handling does not expose internal stack traces, secrets, or database details
✔ demo OTP is deterministic outside production
✔ production OTP is six digits and uses injected randomness
✔ production OTP uses secure randomness by default and never enables demo OTP
✔ OTP values are never logged in production
✔ cookie security options: development vs production
✔ cookie domain options: unconfigured vs configured shared domain
✔ demo clock uses configured reference date
✔ phone validation pattern accepts international numbers and rejects junk
✔ 1. Parent retrieves only their own children
✔ 2. Parent retrieves their own child fee ledger
✔ 3. Parent cannot retrieve another parent's child fee ledger
✔ 4. Parent can generate a payment link for their own outstanding instalment
✔ 5. Parent cannot generate a payment link for another parent's instalment
✔ 6. Mock gateway creates a valid payment reference
✔ 7. Valid HMAC webhook records a payment
✔ 8. Invalid HMAC webhook is rejected
✔ 9. Duplicate webhook does not duplicate payment allocation
✔ 10. Duplicate webhook does not duplicate receipts
✔ 11. Targeted payment allocates only to the specified instalment
✔ 12. Untargeted payment allocates to the oldest unpaid instalment
✔ 13. Unmatched payment enters the unmatched queue without changing balances
✔ 14. Accounts user can manually record a payment
✔ 15. Parent cannot record a manual payment
✔ 16. Accounts user can match and dismiss unmatched payments
✔ 17. Cross-student payment allocation is rejected
✔ 18. Successful payment generates a GST receipt
✔ 19. Receipt base + GST equals total for exact amounts and fractional roundings
✔ 20. Failed payment generates no receipt
✔ 21. Sequential receipt numbers under concurrent requests
✔ 1. All five offsets are generated correctly for eligible instalments
✔ 2. English reminders use English templates
✔ 3. Hindi reminders use Hindi templates
✔ 4. Fully paid instalments are skipped during reminder generation and dispatch
✔ 5. Part-paid instalments with outstanding balance remain eligible
✔ 6. Left/inactive students are skipped
✔ 7. Payment cancels pending reminders
✔ 8. Repeated scheduler execution does not send duplicates
✔ 9. Outstanding balance is rechecked immediately before dispatch
✔ 10. One provider failure does not stop other reminders
✔ 11. Every dispatch attempt is recorded in MessageLog with audit fields
✔ 12. Parent cannot manually trigger reminder execution
✔ 13. Payment signals influence the score
✔ 14. Attendance decline influences the score
✔ 15. Test-score decline influences the score
✔ 16. Missing attendance/test data is handled safely without false inflation
✔ 17. Scores remain bounded between 0 and 100 under extreme signals
✔ 18. Risk reasons are readable and explainable
✔ 19. False-flag cooldown prevents new flags for 30 days
✔ 20. Existing open flags are not duplicated
✔ 21. Accounts user can mark a flag called
✔ 22. Accounts user can mark a false flag with notes
✔ 23. Safety rule: Risk processing never creates payment records or changes instalment balances
✔ 24. Safety rule: Risk processing never sends parent messages
✔ 1. Role Authorization: Parent user cannot access accounts endpoints
✔ 2. Accounts user can access centres and batches metadata endpoints
✔ 3. Accounts Dashboard returns aggregate summary, centre summaries, and batch breakdowns
✔ 4. Accounts Students: search, filtering, and student ledger verification
✔ 5. Manual Payment Collection: records offline payment, auto-allocates, and issues sequential receipt
✔ 6. Unmatched Payments: retrieve queue, match to student, and dismiss with reason
✔ 7. Refunds: calculates preview, enforces 10-day deadline, records refund, and processes status
✔ 8. Reports CSV Export: generates sanitized CSV with formula injection prevention including leading whitespace & control chars
✔ 9. Bidirectional Role Isolation: Accounts cannot access Parent APIs & Parent cannot access Accounts APIs
✔ 10. Refund Payout & Rejection Audit Validation: enforces mandatory fields, audit trail, and status integrity
✔ 11. Refund Processing Concurrency Hardening: atomic transitions block simultaneous payouts and rejections
ℹ tests 82
ℹ suites 0
ℹ pass 82
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 11323.6177
```

### 2. Client Test Suite (17 Tests Passing)
```powershell
npm --workspace client test
```
**Output:**
```
✔ 1. Phase 6 Accounts Components and Pages Structure
✔ 2. Accounts Localization Parity: EN and HI dictionaries
✔ 3. CSV Sanitization: Formula Injection Protection with Leading Whitespace & Control Characters
✔ 4. Approved Phase 2 Pro-rata Refund Formula Verification
✔ 5. 10-Day Withdrawal Deadline Logic Verification
✔ 6. Authentication Role-Based Routing and Redirect Verification
✔ 7. Refund Payout and Rejection Audit Schema Fields Verification
✔ 1. formatInr: converts integer paise to Indian Rupee currency correctly
✔ 2. formatDate: formats dates consistently and safely
✔ 3. formatPhone: formats Indian phone numbers cleanly
✔ 4. Design Tokens: tokens.css contains all required design variables
✔ 5. Localization: English and Hindi translation files have complete parity
✔ 6. API Client: enforces credentials: include and correct endpoint contracts
✔ 7. API Client: extracts error messages on HTTP 401/403/404 failures
✔ 8. Reusable Components: all 14 required design system components are implemented and exported
✔ 9. Security Rule: JWT tokens are strictly avoided in localStorage and sessionStorage
✔ 10. Parent Routes: all required pages are implemented with proper exports
ℹ tests 17
ℹ suites 0
ℹ pass 17
ℹ fail 0
ℹ duration_ms 272.2715
```

### 3. Frontend Production Build Verification
```powershell
npm --workspace client run build
```
**Output:**
```
vite v6.4.5 building for production...
transforming...
✓ 98 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                   0.41 kB │ gzip:   0.30 kB
dist/assets/index-DbCk5BeZ.css    4.04 kB │ gzip:   1.34 kB
dist/assets/index-D3UXJahJ.js   424.78 kB │ gzip: 110.99 kB
✓ built in 2.43s
```

### 4. Backend Startup, Health Check & CORS Probe Verification
```powershell
node scripts/verify-backend-health.js
```
**Output:**
```
--- Sub-Phase 7.1 Backend Health & CORS Probe ---
[PASS] Connected to in-memory database instance for verification
[PASS] Backend server successfully listening on 0.0.0.0:4005
[PASS] GET /api/health returned HTTP 200: {"ok":true,"service":"fee-portal-api"}
[PASS] CORS Preflight OPTIONS returned HTTP 204
       Access-Control-Allow-Origin: https://portal.feetrack.in
       Access-Control-Allow-Credentials: true
[PASS] Server closed and MongoDB disconnected cleanly.
--- Verification Complete: 100% Passed ---
```

---

## 7. Environment Variables Required for Deployment

### Backend (Render Dashboard)
| Variable | Required | Default / Example | Purpose |
|---|---|---|---|
| `NODE_ENV` | Yes | `production` | Enables production security guards and suppresses stack traces. |
| `NODE_VERSION` | Yes | `22` | Specifies the native Node.js runtime on Render. |
| `PORT` | Auto | `10000` | Injected dynamically by Render. Server binds to `0.0.0.0:${PORT}`. |
| `MONGODB_URI` | Yes | `mongodb+srv://...` | Connection URI for the MongoDB Atlas production cluster. |
| `JWT_SECRET` | Yes | Generated (>= 32 chars) | Secret key for signing and verifying session cookies. |
| `COOKIE_NAME` | No | `fee_portal_session` | Name of the authentication cookie. |
| `COOKIE_DOMAIN` | Optional | `.feetrack.in` | Scopes cookie across all subdomains under the shared custom domain. |
| `CLIENT_ORIGIN` | Yes | `https://portal.feetrack.in` | Exact frontend URL for CORS origin allowlisting (no trailing slash). |
| `PAYMENT_GATEWAY_PROVIDER` | No | `mock` | Payment gateway adapter (`mock` for MVP). |
| `PAYMENT_WEBHOOK_SECRET` | Yes | Generated | Secret for verifying payment gateway HMAC-SHA256 signatures. |
| `MESSAGE_PROVIDER` | No | `mock` | Messaging adapter (`mock` for MVP). |
| `REMINDER_CRON_ENABLED` | No | `false` | Set `true` on the designated worker instance to enable reminder job. |
| `RISK_CRON_ENABLED` | No | `false` | Set `true` on the designated worker instance to enable dropout-risk job. |

### Frontend (Vercel Dashboard)
| Variable | Required | Example | Purpose |
|---|---|---|---|
| `VITE_API_BASE_URL` | Yes | `https://api.feetrack.in/api` | Absolute URL pointing to the Render backend API. |

---

## 8. Remaining Manual Deployment Steps

1. **MongoDB Atlas Provisioning:**
   - Create an M10 or M0 cluster in the chosen region (e.g. AWS Mumbai `ap-south-1` or Singapore `ap-southeast-1`).
   - Create a dedicated database user with read/write permissions on `feetrack_production`.
   - Add Render's outbound IP ranges (or `0.0.0.0/0` with strong authentication) to the Atlas IP Access List.
   - Run `npm run seed` once against the production cluster if seeding demonstration accounts.
2. **Render Service Creation:**
   - Link the Git repository on the Render dashboard.
   - Choose **Blueprint** deployment using `render.yaml`, or create a **Web Service** manually with the build and start commands defined above.
   - Populate `MONGODB_URI` and `CLIENT_ORIGIN` in the Render environment settings.
3. **Vercel Project Setup:**
   - Import the Git repository into Vercel.
   - Set **Root Directory** to `client`.
   - Set the environment variable `VITE_API_BASE_URL=https://<your-render-service>.onrender.com/api` (or custom domain `https://api.feetrack.in/api`).
   - Deploy.
4. **Custom Domain Configuration (Optional):**
   - Configure DNS CNAME records for `portal.feetrack.in` (pointing to Vercel) and `api.feetrack.in` (pointing to Render).
   - Once DNS propagates, set `COOKIE_DOMAIN=.feetrack.in` in Render environment variables.

---

## 9. Known Limitations

1. **Third-Party Cross-Site Cookie Blocking:** If deployed on separate vendor subdomains (e.g. `feetrack.vercel.app` and `feetrack-api.onrender.com`) without a shared custom domain, modern browsers will block `SameSite=Lax` cookies on asynchronous fetch calls unless `SameSite=None; Secure` is used. For this reason, configuring a shared custom apex domain (`.feetrack.in`) is the documented and recommended production architecture.
2. **Horizontal Scaling of Schedulers:** Schedulers (`node-cron`) run in-process. If the Render web service is scaled to multiple concurrent instances, both instances will run the reminder and risk jobs. While the database's compound unique index `(instalmentId, offsetDays)` prevents duplicate reminder records, running jobs on a single dedicated instance (`REMINDER_CRON_ENABLED=true` on worker only) is recommended.
3. **Mock Providers in MVP:** Payment gateway, OTP, and messaging adapters currently run in mock mode. Live payment and telecom gateway credentials must be connected prior to real commercial operations.

---

## 10. Verification Conclusion

Sub-Phase 7.1 is complete. Native cloud deployment configurations for Render and Vercel are established, tested, and verified without containerization.

- **Server tests:** 82 passed.
- **Client tests:** 17 passed.
- **Production build:** Passed (dist size: 424.78 kB JS / 4.04 kB CSS).
- **Backend probe:** Passed (HTTP 200 on `/api/health`, CORS Preflight verified).

**Implementation stopped at Sub-Phase 7.1 boundary as instructed.** Awaiting formal review and approval before proceeding to Sub-Phase 7.2.

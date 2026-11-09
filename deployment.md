# FEETrack — Cloud Deployment Guide & Operations Manual

This guide provides practical, step-by-step instructions for deploying FEETrack to production using native cloud infrastructure:
- **Backend API:** Render (Native Node.js 22 Runtime)
- **Frontend SPA:** Vercel (Edge CDN Static Hosting)
- **Database:** MongoDB Atlas (Managed Replica Set Cluster)

> [!IMPORTANT]
> **Deployment Status:** This document specifies the *deployment configuration* for FEETrack. The application codebase is configured and tested for native cloud deployment, but is currently running in a local verification environment. This guide does not claim that a live commercial deployment has already been completed.

---

## 1. Cloud Architecture Overview

```
                          End User (Parent / Accounts Staff)
                                         |
                                         v
                         +-------------------------------+
                         | Vercel Edge Global CDN        |
                         | Host: portal.feetrack.in      |
                         | (or feetrack.vercel.app)      |
                         | Build: vite build (Static SPA)|
                         +-------------------------------+
                                         |
                        Credentials: 'include'
                        Cross-Origin or Same-Site Request
                                         |
                                         v
                         +-------------------------------+
                         | Render Web Service            |
                         | Host: api.feetrack.in         |
                         | (or feetrack-api.onrender.com)|
                         | Runtime: Native Node.js 22    |
                         | Port: 0.0.0.0:${PORT}         |
                         +-------------------------------+
                                         |
                                Mongoose Connection
                                         v
                         +-------------------------------+
                         | MongoDB Atlas                 |
                         | Cluster: M10 Replica Set      |
                         | TLS 1.3 / Strict IP Access    |
                         +-------------------------------+
```

---

## 2. Cookie & CORS Architecture

Understanding browser cookie transmission rules is essential to avoiding cross-origin authentication failures.

### A. Shared Custom Domain Architecture (Recommended)
When both frontend and backend share an apex/registrable domain (eTLD+1):
- **Frontend Origin:** `https://portal.feetrack.in`
- **Backend Origin:** `https://api.feetrack.in`
- **Cookie Configuration:**
  - `COOKIE_DOMAIN=.feetrack.in`
  - `SameSite=Lax`
  - `Secure=true`
  - `HttpOnly=true`
  - `Path=/`
- **Browser Behavior:** Requests between `portal.feetrack.in` and `api.feetrack.in` are classified as **Same-Site** by modern browsers (Chrome, Safari, Firefox). The cookie is accepted and transmitted on asynchronous `fetch` calls without being blocked by third-party cookie restrictions (Safari ITP or Chrome Privacy Sandbox).
- **Prerequisite:** You must configure custom DNS CNAME records and SSL certificates for both subdomains *before* enabling `COOKIE_DOMAIN`.

### B. Default Cloud Vendor Subdomains (Cross-Site Consideration)
When using default platform domains without a shared custom domain:
- **Frontend Origin:** `https://feetrack.vercel.app`
- **Backend Origin:** `https://feetrack-api.onrender.com`
- **Cookie Behavior:** These two domains have completely different registrable domains (`vercel.app` vs `onrender.com`). Modern browsers classify requests between them as **Cross-Site**.
  - A cookie set with `SameSite=Lax` will be **blocked** on cross-site fetch calls.
  - To support cross-site subdomains, the backend cookie would require `SameSite=None; Secure`. However, many browsers block third-party `SameSite=None` cookies unless partitioned.
  - **Host-Only API Cookies:** If the parent portal is accessed via an API proxy or the user visits the backend directly, host-only cookies (where `COOKIE_DOMAIN` is omitted) apply strictly to that host.
  - **Recommendation:** Deploy with a shared custom domain (`.feetrack.in`) for production, or deploy frontend and backend through a unified origin / reverse proxy.

### C. CORS Configuration
In `server/src/app.js`:
```javascript
app.use(cors({ origin: env.CLIENT_ORIGIN, credentials: true }));
```
- `CLIENT_ORIGIN` must match the exact frontend URL (e.g. `https://portal.feetrack.in`).
- Wildcards (`*`) are disallowed when `credentials: true` is enabled.
- Express automatically handles HTTP `OPTIONS` preflight requests, returning HTTP 204 with `Access-Control-Allow-Credentials: true`.

---

## 3. Local Setup & Verification

Before deploying to cloud environments, evaluators and engineers can run and verify the system locally:

1. **Prerequisites:** Node.js 20+ (Node 22 LTS recommended) and pnpm 11+ (or npm).
2. **Clone & Install Dependencies:**
   ```bash
   git clone https://github.com/PrafullShinde28/Coaching_Fee_Management_System.git
   cd fee-portal
   pnpm install --frozen-lockfile   # Or: npm install
   ```
3. **Environment Configuration:**
   ```bash
   cp .env.example .env
   ```
   Configure `MONGODB_URI` (local MongoDB or Atlas URI) and a `JWT_SECRET` (at least 32 characters).
4. **Seed Deterministic Demo Database:**
   ```bash
   npm run seed
   ```
5. **Start Local Development Services:**
   - **Backend API:** `npm run dev:server` (listens on `http://0.0.0.0:4000`)
   - **Frontend SPA:** `npm --workspace client run dev` (serves on `http://localhost:5173`)
6. **Execute Verification Test Harness:**
   - Seed Idempotency: `npm run seed:test`
   - Server Suite: `npm run test:server` (82 tests passing)
   - Client Suite: `npm run test:client` (17 tests passing)
   - Backend Health Probe: `node scripts/verify-backend-health.js`
   - Headless Chrome E2E Suite: `node scripts/verify-browser-phase6.js` (13 checks passing)

---

## 4. Step-by-Step Cloud Deployment Runbook

### Step 1: Provision MongoDB Atlas Cluster
1. Log in to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas).
2. Create an **M10** dedicated cluster (or M0 shared cluster for evaluation) in your target region (e.g. AWS Mumbai `ap-south-1`).
3. Under **Database Access**, create a database user:
   - Authentication Method: Password.
   - Built-in Roles: `readWriteAnyDatabase` or scoped to `jaipur_fee_portal`.
4. Under **Network Access**, configure IP access:
   - For Render web services (which use dynamic egress IPs), add `0.0.0.0/0` (Allow access from anywhere), guarded by strong database credentials.
5. Under **Deployment > Database**, click **Connect** and select **Drivers (Node.js)** to obtain the connection string.

### Step 2: Deploy Backend to Render (Native Node.js)
FEETrack includes a pre-configured Render Blueprint (`render.yaml`) in the repository root.

#### Option A: Deploy via Blueprint (Recommended)
1. Log in to the [Render Dashboard](https://dashboard.render.com/).
2. Click **New > Blueprint**.
3. Connect your FEETrack Git repository.
4. Render will detect `render.yaml` and configure the web service `feetrack-api`:
   - Runtime: Node.js 22
   - Build Command: `corepack enable && corepack prepare pnpm@11.22.0 --activate && pnpm install --frozen-lockfile`
   - Start Command: `pnpm --filter @fee-portal/server start`
   - Health Check Path: `/api/health`
5. Fill in the environment variables marked `sync: false` in the dashboard (see Environment Variables Reference below).
6. Click **Apply**.

#### Option B: Deploy Manually as a Web Service
1. Click **New > Web Service**.
2. Connect the Git repository.
3. Configure the settings:
   - **Environment:** Node
   - **Region:** Singapore or Oregon
   - **Branch:** master (or main)
   - **Root Directory:** (leave blank for repository root)
   - **Build Command:** `corepack enable && corepack prepare pnpm@11.22.0 --activate && pnpm install --frozen-lockfile`
   - **Start Command:** `pnpm --filter @fee-portal/server start`
   - **Health Check Path:** `/api/health`
4. In the **Environment Variables** tab, add all required variables listed below.

### Step 3: Deploy Frontend to Vercel
FEETrack includes a pre-configured `client/vercel.json` defining Vite framework settings and SPA rewrites.

1. Log in to [Vercel](https://vercel.com/).
2. Click **Add New > Project** and import the FEETrack Git repository.
3. In the project configuration screen:
   - **Framework Preset:** Vite
   - **Root Directory:** Click Edit and select `client`.
   - **Build Command:** `vite build` (or `pnpm run build`)
   - **Output Directory:** `dist`
4. Under **Environment Variables**, add:
   - `VITE_API_BASE_URL`: The full URL to your Render API (e.g. `https://api.feetrack.in/api` or `https://feetrack-api.onrender.com/api`).
5. Click **Deploy**.
6. Once deployed, copy your Vercel deployment URL (e.g. `https://portal.feetrack.in`) and ensure it is set as `CLIENT_ORIGIN` in the Render dashboard.

---

## 5. Environment Variables Reference

Only the **names** of environment variables are documented here. Secrets and sensitive values must be generated securely and injected via platform dashboards.

### Backend Environment Variables (Render)

| Variable Name | Required | Default / Format | Purpose |
|---|---|---|---|
| `NODE_ENV` | Yes | `production` | Enables production security guards, error masking, and cookie security flags. |
| `NODE_VERSION` | Yes | `22` | Specifies the native Node.js runtime version on Render. |
| `PORT` | Auto | Assigned by Render (e.g. `10000`) | The port the HTTP server binds to (`0.0.0.0:${PORT}`). |
| `MONGODB_URI` | Yes | `mongodb+srv://...` | Connection URI for the MongoDB Atlas database. |
| `JWT_SECRET` | Yes | String (>= 32 chars) | Cryptographic secret for signing and verifying session JWTs. |
| `COOKIE_NAME` | No | `fee_portal_session` | Name of the session cookie. |
| `COOKIE_DOMAIN` | Optional | `.feetrack.in` | Scopes cookie across subdomains. Only set when using a shared custom domain. |
| `CLIENT_ORIGIN` | Yes | `https://portal.feetrack.in` | Exact origin of the frontend for CORS validation (no trailing slash). |
| `PAYMENT_GATEWAY_PROVIDER` | No | `mock` | Payment gateway adapter (`mock` for demo/evaluation). |
| `PAYMENT_WEBHOOK_SECRET` | Yes | String | Secret key for verifying HMAC-SHA256 webhook signatures. |
| `MESSAGE_PROVIDER` | No | `mock` | Messaging adapter (`mock` for demo/evaluation). |
| `REMINDER_CRON_ENABLED` | No | `false` | Enables fee reminder cron scheduler. Only enable on a single instance. |
| `REMINDER_CRON_SCHEDULE` | No | `0 9 * * *` | Standard cron expression for reminder dispatch (defaults to 09:00 AM). |
| `RISK_CRON_ENABLED` | No | `false` | Enables dropout-risk evaluation scheduler. Only enable on a single instance. |
| `RISK_CRON_SCHEDULE` | No | `0 10 * * *` | Standard cron expression for risk scoring (defaults to 10:00 AM). |
| `DEMO_TODAY` | No | `YYYY-MM-DD` | Injected business reference date for demo evaluation. Unset in live production. |

### Frontend Environment Variables (Vercel)

| Variable Name | Required | Example | Purpose |
|---|---|---|---|
| `VITE_API_BASE_URL` | Yes | `https://api.feetrack.in/api` | Base URL used by `client/src/services/api.js` for all API calls. |

---

## 6. Health Check & Deployment Verification

### Verifying the Live Backend
Once the Render web service has deployed, verify its health endpoint:
```bash
curl -i https://<your-render-service>.onrender.com/api/health
```

**Expected Response:**
```http
HTTP/1.1 200 OK
Content-Type: application/json; charset=utf-8

{"ok":true,"service":"fee-portal-api"}
```

### Verifying CORS Preflight Headers
Test the CORS configuration using an OPTIONS preflight request:
```bash
curl -i -X OPTIONS https://<your-render-service>.onrender.com/api/auth/me \
  -H "Origin: https://portal.feetrack.in" \
  -H "Access-Control-Request-Method: GET" \
  -H "Access-Control-Request-Headers: Content-Type"
```

**Expected Headers:**
```http
HTTP/1.1 204 No Content
Access-Control-Allow-Origin: https://portal.feetrack.in
Access-Control-Allow-Credentials: true
```

---

## 7. Reviewer Demo Logins (Synthetic Accounts)

When evaluating a demo deployment where `NODE_ENV !== 'production'` or `DEMO_OTP` is enabled, use the fixed OTP **`246810`**.

| Role | Synthetic Phone | Student / Context | Notes |
|---|---|---|---|
| **Accounts** | `+919900000001` | All centres & branches | Full access to accounts dashboard, collections, refunds, risk desk. |
| **Parent** | `+919900000041` | Aarav Meena (STU-0412) | Fully paid instalment. Receipt download flow. |
| **Parent** | `+919900000058` | Ishita Sharma (STU-0587) | Part-paid instalment (overdue). Payment link flow. Default Hindi UI. |
| **Parent** | `+919900000021` | Mohit Gurjar (STU-0219) | Upcoming unpaid instalment. |

> [!WARNING]
> These phone numbers and student identities are synthetic records created by `server/src/scripts/seed.js` for reviewer evaluation. Do not seed demo data into live production databases.

---

## 8. Operational Troubleshooting

| Symptom | Root Cause | Solution |
|---|---|---|
| **Login succeeds but dashboard redirects to login** | Session cookie is blocked due to cross-site cookie policy. | Ensure `CLIENT_ORIGIN` matches the frontend URL. If using default vendor domains (`.vercel.app` and `.onrender.com`), configure a shared custom domain (`.feetrack.in`) and set `COOKIE_DOMAIN=.feetrack.in`. |
| **CORS error in browser console** | `CLIENT_ORIGIN` mismatch or trailing slash. | Check that `CLIENT_ORIGIN` in Render matches the browser origin exactly (e.g. `https://portal.feetrack.in` with no trailing `/`). |
| **Vercel direct navigation returns 404** | Missing SPA rewrite rule. | Confirm `client/vercel.json` exists with the rewrite rule `/(.*) -> /index.html`. |
| **Render build fails on pnpm** | Corepack not enabled or lockfile missing. | Ensure the Render build command starts with `corepack enable && corepack prepare pnpm@11.22.0 --activate`. |
| **Duplicate reminder messages sent** | Schedulers running on multiple horizontally scaled instances. | Set `REMINDER_CRON_ENABLED=false` on all instances except one dedicated background worker. |
| **MongoDB connection timeout** | Atlas IP access list does not permit connection. | Verify that Atlas Network Access allows `0.0.0.0/0` or the specific egress IP of the application host. |

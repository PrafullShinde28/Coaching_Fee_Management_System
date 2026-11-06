# Phase 3 Verification Report: API, Payment Gateway, Webhooks, and GST Receipts

## 1. Implemented API Endpoint List

### Authentication & Profile
- `POST /api/auth/otp/request` — Request 6-digit OTP for phone login (rate limited to 5 requests/minute).
- `POST /api/auth/otp/verify` — Verify OTP, establish `httpOnly` secure session cookie.
- `GET /api/auth/me` — Return sanitized user profile and parental consent status.
- `POST /api/auth/consent` — Persist parental consent (`givenBy`, `at`, `version`).
- `POST /api/auth/logout` — Clear session cookie with matching security flags.

### Parent APIs (`requireRole('parent')`)
- `GET /api/parent/children` — List authenticated parent's children with fee status summary.
- `GET /api/parent/students/:studentId/ledger` — Retrieve fee ledger, fee plan, and instalments with derived statuses.
- `GET /api/parent/students/:studentId/payments` — Retrieve payment history for child.
- `GET /api/parent/students/:studentId/receipts` — Retrieve GST receipts issued for child's payments.
- `POST /api/parent/instalments/:instalmentId/payment-link` — Generate or retrieve payment link for eligible outstanding instalment.

### Accounts APIs (`requireRole('accounts')`)
- `GET /api/accounts/dashboard` — Summary metrics (total collections, expected fees, outstanding, overdue, unmatched counts).
- `GET /api/accounts/students` — Filterable student directory with centre, batch, and fee metrics.
- `GET /api/accounts/students/:studentId/ledger` — Comprehensive student ledger with instalments, payments, and receipts.
- `GET /api/accounts/instalments` — Instalment list filtered by centre, batch, or status (`overdue`, `due_soon`, etc.).
- `POST /api/accounts/payments/manual` — Record manual payment (cash, bank transfer) and issue GST receipt.
- `GET /api/accounts/unmatched-payments` — Queue of unmatched payments (`status: 'open'`).
- `POST /api/accounts/unmatched-payments/:id/match` — Match an unmatched payment to a student and instalment.
- `POST /api/accounts/unmatched-payments/:id/dismiss` — Dismiss an unmatched payment with recorded audit reason.
- `GET /api/accounts/receipts` — Retrieve all issued receipts with payment and student metadata.

### Payment Webhooks
- `POST /api/webhooks/payment` — Secure webhook endpoint with HMAC-SHA256 signature verification and idempotent allocation.

---

## 2. Request & Response Examples

### A. Parent Retrieves Children
**Request:** `GET /api/parent/children`  
**Headers:** `Cookie: fee_portal_session=...`  
**Response (200 OK):**
```json
{
  "ok": true,
  "children": [
    {
      "id": "672458a1bcde000000000001",
      "studentId": "STU-0412",
      "name": "Aarav Meena",
      "status": "active",
      "centre": { "_id": "...", "name": "Jaipur Central", "code": "JPR-1" },
      "batch": { "_id": "...", "name": "JEE 2027 Morning" },
      "feeSummary": {
        "total": 12000000,
        "paid": 3000000,
        "outstanding": 9000000
      }
    }
  ]
}
```

### B. Parent Generates Payment Link
**Request:** `POST /api/parent/instalments/672458a1bcde000000000002/payment-link`  
**Headers:** `Cookie: fee_portal_session=...`  
**Response (200 OK):**
```json
{
  "ok": true,
  "paymentLink": {
    "orderId": "ORD_000002_1762412345000",
    "gatewayRef": "GW_MOCK_ORD_000002_1762412345000",
    "paymentUrl": "https://checkout.feetrack-mock.test/pay/demo-stu-0219?orderId=ORD_000002_1762412345000&amount=4000000",
    "amount": 4000000,
    "instalmentId": "672458a1bcde000000000002",
    "studentId": "672458a1bcde000000000003"
  }
}
```

### C. Secure Payment Webhook
**Request:** `POST /api/webhooks/payment`  
**Headers:**
- `Content-Type: application/json`
- `x-webhook-signature: 8f42d13b47...` (HMAC-SHA256 hex)

**Payload:**
```json
{
  "event": "payment.success",
  "gatewayRef": "GW-MOCK-1762412345",
  "amount": 3000000,
  "studentId": "672458a1bcde000000000001",
  "instalmentId": "672458a1bcde000000000002"
}
```
**Response (200 OK):**
```json
{
  "ok": true,
  "status": "matched",
  "paymentId": "672458a1bcde000000000099",
  "receiptNumber": "RCP-2026-000001",
  "allocations": [
    { "instalmentId": "672458a1bcde000000000002", "amount": 3000000 }
  ],
  "unallocated": 0
}
```

### D. Accounts Records Manual Payment
**Request:** `POST /api/accounts/payments/manual`  
**Headers:** `Cookie: fee_portal_session=...` (accounts user)  
**Payload:**
```json
{
  "studentId": "672458a1bcde000000000001",
  "instalmentId": "672458a1bcde000000000002",
  "amount": 1180000,
  "reference": "BANK-TRF-20261106-001",
  "receivedAt": "2026-11-06T10:00:00.000Z"
}
```
**Response (200 OK):**
```json
{
  "ok": true,
  "payment": {
    "_id": "672458a1bcde000000000101",
    "source": "manual",
    "status": "matched",
    "amount": 1180000,
    "gatewayRef": "BANK-TRF-20261106-001"
  },
  "receipt": {
    "number": "RCP-2026-000002",
    "base": 1000000,
    "gst": 180000,
    "total": 1180000
  },
  "allocations": [
    { "instalmentId": "672458a1bcde000000000002", "amount": 1180000 }
  ],
  "unallocated": 0
}
```

---

## 3. Payment Gateway Adapter Design

Located in [`server/src/services/paymentGateway.js`](file:///d:/Company%20Tasks/ISOCODE-Coaching-Fee-Management-System/fee-portal/server/src/services/paymentGateway.js):
- **Interface Abstraction:** Independent gateway interface defining `createPaymentLink`, `generateWebhookSignature`, and `verifyWebhookSignature`.
- **Configurable Provider Selection:** Swappable via `PAYMENT_GATEWAY_PROVIDER` environment variable (defaults to `mock`).
- **Mock Provider Implementation:** Produces deterministic, safe mock links (`https://checkout.feetrack-mock.test/pay/...`) and cryptographically sound HMAC signatures without calling external APIs.
- **Strict Role & Ownership Boundary:** Payment links require parent identity verification so parents can only request orders for their own children's unpaid instalments.

---

## 4. Webhook Signature Verification Approach

- **Raw Request Buffer Preservation:** Express body parser configured with `verify: (req, _res, buf) => { req.rawBody = buf; }` to preserve the exact raw payload bytes before JSON deserialization.
- **HMAC-SHA256:** Signatures are computed using the configured `PAYMENT_WEBHOOK_SECRET` over `req.rawBody`.
- **Constant-Time Comparison:** Signatures are compared using `crypto.timingSafeEqual` over equal-length buffers to eliminate timing side-channel attacks. Invalid or missing signatures return HTTP 401 (`Invalid or missing webhook signature`).

---

## 5. Payment Allocation and Idempotency Behavior

- **Phase 2 Domain Engine Reused:** Powered by [`server/src/domain/payment-allocation.js`](file:///d:/Company%20Tasks/ISOCODE-Coaching-Fee-Management-System/fee-portal/server/src/domain/payment-allocation.js).
- **Targeted Payments:** When `instalmentId` is provided, funds are allocated solely to that instalment. Excess funds never spill over into other instalments and remain recorded as `unallocated`.
- **Untargeted Payments:** Allocates funds starting with the oldest unpaid instalment by due date and sequence.
- **Idempotency Guarantee:** Every webhook check queries `Payment.findOne({ gatewayRef })`. If already processed, it returns `{ ok: true, duplicate: true }` without re-allocating or duplicating balances or receipts.
- **Failure Events (`payment.failed`):** Recorded with `status: 'reversed'` without marking instalments paid or issuing receipts.

---

## 6. Unmatched Payment Reconciliation Flow

- **Detection:** If a webhook payload references a missing or invalid student, or if payment cannot be allocated, the system records `Payment` with `status: 'unmatched'` and places an entry in `UnmatchedPayment` with `status: 'open'` and an explainable reason.
- **Review:** Accounts staff inspect the queue via `GET /api/accounts/unmatched-payments`.
- **Matching:** Accounts staff call `POST /api/accounts/unmatched-payments/:id/match` specifying the target student and instalment. The payment transitions to `status: 'matched'`, instalment balances are credited, a GST receipt is issued, and the queue entry is resolved.
- **Dismissal:** If the payment belongs elsewhere, staff call `POST /api/accounts/unmatched-payments/:id/dismiss` with an audit reason.

---

## 7. GST Receipt Calculation and Numbering

- Located in [`server/src/services/receipt.js`](file:///d:/Company%20Tasks/ISOCODE-Coaching-Fee-Management-System/fee-portal/server/src/services/receipt.js).
- **18% Inclusive GST Formula:**
  - `gst = Math.round(amount * 18 / 118)`
  - `base = amount - gst`
  - Guarantees `base + gst === total` exactly for all amounts down to 1 paise.
- **Sequential Receipt Numbers:** Monotonically increasing atomic sequence counter backed by MongoDB (`Counter` model): `RCP-YYYY-XXXXXX` (e.g. `RCP-2026-000001`).
- **No Duplicate Receipts:** Enforced via MongoDB unique index on `paymentId` in `receiptSchema` and idempotency guards.

---

## 8. Authorization and Validation Coverage

- **Role Enforcement:** All `/api/parent/*` routes require `role === 'parent'`; all `/api/accounts/*` routes require `role === 'accounts'`.
- **Parent Isolation:** Parents can only query or generate links for their own children (`student.parentUserId === req.user._id`). URL manipulation for another child or instalment returns HTTP 403.
- **Cross-Student Protection:** Manual payment recording verifies that the chosen instalment belongs to the chosen student.
- **Zod Validation:** All routes validate incoming parameters, query strings, and request bodies. Unsafe, negative, or zero monetary values are rejected.

---

## 9. Tests Executed and Actual Results

All unit and integration tests were executed via Node.js built-in `node:test` runner against an isolated in-memory test database.

```powershell
pnpm test
```

### Test Results Summary:
- **Total Tests:** 46
- **Passed:** 46
- **Failed:** 0
- **Duration:** ~6.98s

### Breakdown of Executed Test Suites:
1. `src\scripts\seed-test.js` — Two-run seed idempotency and count verification (PASS).
2. `test\domain.test.js` — Phase 2 domain logic pure functions (7 tests, all PASS).
3. `test\phase1.test.js` — Phase 1 OTP randomness, clock, and cookie options (7 tests, all PASS).
4. `test\phase1-integration.test.js` — Phase 1 end-to-end auth, role, consent, rate limit, error masking (10 tests, all PASS).
5. `test\phase3.test.js` — Phase 3 API, gateway, webhook, and receipt integration tests (21 tests, all PASS):
   - Parent retrieves only their own children (PASS)
   - Parent retrieves their own fee ledger (PASS)
   - Parent cannot retrieve another parent's fee ledger (PASS)
   - Parent can generate payment link for own outstanding instalment (PASS)
   - Parent cannot generate payment link for another parent's instalment (PASS)
   - Mock gateway creates valid payment reference (PASS)
   - Valid HMAC webhook records a payment (PASS)
   - Invalid HMAC webhook is rejected (PASS)
   - Duplicate webhook does not duplicate payment allocation (PASS)
   - Duplicate webhook does not duplicate receipts (PASS)
   - Targeted payment allocates only to the specified instalment (PASS)
   - Untargeted payment allocates to the oldest unpaid instalment (PASS)
   - Unmatched payment enters unmatched queue without changing balances (PASS)
   - Accounts user can manually record a payment (PASS)
   - Parent cannot record a manual payment (PASS)
   - Accounts user can match and dismiss unmatched payments (PASS)
   - Cross-student payment allocation is rejected (PASS)
   - Successful payment generates a GST receipt (PASS)
   - Receipt base + GST equals total (PASS)
   - Failed payment generates no receipt (PASS)
   - Sequential receipt numbers under concurrent requests (PASS)

---

## 10. Files Changed

- `server/src/config/env.js`: Added `PAYMENT_GATEWAY_PROVIDER` and `PAYMENT_WEBHOOK_SECRET` with safe defaults.
- `.env.example`: Added configuration placeholders.
- `server/src/models/index.js`: Added `Counter` model for atomic sequential receipt numbering.
- `server/src/services/receipt.js`: Created GST calculation (`calculateGst`) and atomic sequential receipt generator (`generateReceiptForPayment`).
- `server/src/services/paymentGateway.js`: Created `MockPaymentGateway` adapter with HMAC-SHA256 signature generation and timing-safe verification.
- `server/src/routes/webhook.js`: Created secure payment webhook endpoint with signature verification, idempotent allocation, and unmatched queue handling.
- `server/src/routes/parent.js`: Created parent REST endpoints for children list, fee ledgers, payment history, receipts, and payment link generation.
- `server/src/routes/accounts.js`: Created accounts REST endpoints for dashboard summary, student directory, ledgers, manual payment entry, unmatched reconciliation, and receipts.
- `server/src/app.js`: Configured raw body capture and mounted parent, accounts, and webhook routes.
- `server/test/phase3.test.js`: Comprehensive integration test suite covering all 21 Phase 3 test cases.
- `ASSUMPTIONS.md` & `README.md`: Documented Phase 3 architectural decisions and scope.

---

## 11. Known Limitations and Remaining Boundaries

1. **Phase 4 Scope Deferred:** Reminder dispatch workers, WhatsApp/SMS scheduling, and dropout risk triggers remain in Phase 4.
2. **Phase 5/6 Frontend Scope Deferred:** UI parent dashboard and accounts portals belong to Phase 5 and Phase 6.
3. **External Gateway:** Production gateway credentials and live webhooks will be configured when deploying to staging/production environments; test environments operate cleanly with the isolated mock adapter.

---

## Final Phase 3 Verdict

# READY — all required Phase 3 API and payment tests pass.

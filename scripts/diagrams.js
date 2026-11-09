// scripts/diagrams.js - SVG Vector Renderers for the 5 FEETrack Architecture Diagrams

export const diagrams = {
  systemArchitecture: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 520" width="100%" height="auto" style="font-family:system-ui,-apple-system,sans-serif;">
  <defs>
    <linearGradient id="gradHeader" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1e3a8a"/>
      <stop offset="100%" stop-color="#2563eb"/>
    </linearGradient>
    <filter id="shadow" x="-5%" y="-5%" width="110%" height="110%">
      <feDropShadow dx="0" dy="3" stdDeviation="4" flood-opacity="0.15"/>
    </filter>
  </defs>

  <!-- Background -->
  <rect width="900" height="520" rx="12" fill="#f8fafc" stroke="#e2e8f0" stroke-width="1.5"/>

  <!-- End Users -->
  <g transform="translate(300, 20)" filter="url(#shadow)">
    <rect width="300" height="50" rx="8" fill="url(#gradHeader)"/>
    <text x="150" y="31" fill="#ffffff" font-size="14" font-weight="700" text-anchor="middle">End Users (Parent / Accounts Staff)</text>
  </g>

  <!-- Arrow Users -> Vercel -->
  <path d="M 450 70 L 450 100" stroke="#64748b" stroke-width="2" marker-end="url(#arrow)"/>
  <text x="455" y="88" fill="#475569" font-size="10" font-weight="600">HTTPS + Cookies (SameSite=Lax)</text>

  <!-- Vercel Frontend -->
  <g transform="translate(250, 100)" filter="url(#shadow)">
    <rect width="400" height="60" rx="8" fill="#ffffff" stroke="#0ea5e9" stroke-width="2"/>
    <text x="200" y="28" fill="#0369a1" font-size="14" font-weight="700" text-anchor="middle">Vercel Edge Global CDN</text>
    <text x="200" y="46" fill="#64748b" font-size="11" text-anchor="middle">React 18 SPA + Vite 6 + Design Tokens + react-i18next (portal.feetrack.in)</text>
  </g>

  <!-- Arrow Vercel -> Render -->
  <path d="M 450 160 L 450 195" stroke="#64748b" stroke-width="2"/>
  <text x="455" y="180" fill="#475569" font-size="10" font-weight="600">REST API (credentials: 'include')</text>

  <!-- Render Web API Boundary -->
  <g transform="translate(40, 200)" filter="url(#shadow)">
    <rect width="820" height="190" rx="10" fill="#ffffff" stroke="#6366f1" stroke-width="2"/>
    <rect width="820" height="32" rx="10" fill="#ede9fe"/>
    <text x="410" y="21" fill="#4338ca" font-size="13" font-weight="700" text-anchor="middle">Render Native Node.js 22 Runtime — Express API (api.feetrack.in)</text>

    <!-- Sub-components inside Render -->
    <!-- Middleware -->
    <rect x="20" y="48" width="240" height="60" rx="6" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1.5"/>
    <text x="140" y="73" fill="#1e293b" font-size="12" font-weight="600" text-anchor="middle">Security & Middleware</text>
    <text x="140" y="92" fill="#64748b" font-size="10" text-anchor="middle">Helmet, CORS, CookieParser, RateLimit</text>

    <!-- RBAC & Controllers -->
    <rect x="290" y="48" width="240" height="60" rx="6" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1.5"/>
    <text x="410" y="73" fill="#1e293b" font-size="12" font-weight="600" text-anchor="middle">RBAC & API Routes</text>
    <text x="410" y="92" fill="#64748b" font-size="10" text-anchor="middle">/auth, /parent, /accounts, /webhooks</text>

    <!-- Pure Domain Core -->
    <rect x="560" y="48" width="240" height="60" rx="6" fill="#f0fdf4" stroke="#22c55e" stroke-width="1.5"/>
    <text x="680" y="73" fill="#15803d" font-size="12" font-weight="700" text-anchor="middle">Pure Domain Core (Paise Math)</text>
    <text x="680" y="92" fill="#475569" font-size="10" text-anchor="middle">instalment, payment, refund, risk-scorer</text>

    <!-- Background Schedulers -->
    <rect x="150" y="122" width="520" height="52" rx="6" fill="#fefce8" stroke="#eab308" stroke-width="1.5"/>
    <text x="410" y="144" fill="#854d0e" font-size="12" font-weight="600" text-anchor="middle">Background Workers (node-cron)</text>
    <text x="410" y="161" fill="#713f12" font-size="10" text-anchor="middle">Daily Fee Reminders (09:00 AM) &amp; Nightly Dropout-Risk Evaluator (02:00 AM)</text>
  </g>

  <!-- External Integrations Row -->
  <!-- MongoDB Atlas -->
  <g transform="translate(80, 420)" filter="url(#shadow)">
    <rect width="220" height="75" rx="8" fill="#ffffff" stroke="#10b981" stroke-width="2"/>
    <text x="110" y="32" fill="#047857" font-size="13" font-weight="700" text-anchor="middle">MongoDB Atlas Cluster</text>
    <text x="110" y="52" fill="#64748b" font-size="10" text-anchor="middle">16 Collections, M10 Replica Set</text>
    <text x="110" y="67" fill="#64748b" font-size="10" text-anchor="middle">TLS 1.3 / Strict IP Access</text>
  </g>
  <path d="M 230 390 L 190 420" stroke="#10b981" stroke-width="2"/>

  <!-- Mock Payment Gateway -->
  <g transform="translate(340, 420)" filter="url(#shadow)">
    <rect width="220" height="75" rx="8" fill="#ffffff" stroke="#f97316" stroke-width="2"/>
    <text x="110" y="32" fill="#c2410c" font-size="13" font-weight="700" text-anchor="middle">Mock Payment Gateway</text>
    <text x="110" y="52" fill="#64748b" font-size="10" text-anchor="middle">Simulated Hosted Checkout</text>
    <text x="110" y="67" fill="#64748b" font-size="10" text-anchor="middle">HMAC-SHA256 Signed Webhooks</text>
  </g>
  <path d="M 450 390 L 450 420" stroke="#f97316" stroke-width="2"/>

  <!-- Mock Messaging Provider -->
  <g transform="translate(600, 420)" filter="url(#shadow)">
    <rect width="220" height="75" rx="8" fill="#ffffff" stroke="#8b5cf6" stroke-width="2"/>
    <text x="110" y="32" fill="#6d28d9" font-size="13" font-weight="700" text-anchor="middle">Mock Message Provider</text>
    <text x="110" y="52" fill="#64748b" font-size="10" text-anchor="middle">Simulated WhatsApp &amp; SMS</text>
    <text x="110" y="67" fill="#64748b" font-size="10" text-anchor="middle">Audit trail logged to MessageLog</text>
  </g>
  <path d="M 670 390 L 710 420" stroke="#8b5cf6" stroke-width="2"/>
</svg>`,

  erd: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 680" width="100%" height="auto" style="font-family:system-ui,-apple-system,sans-serif;">
  <defs>
    <filter id="shadow2" x="-5%" y="-5%" width="110%" height="110%">
      <feDropShadow dx="0" dy="2" stdDeviation="3" flood-opacity="0.12"/>
    </filter>
  </defs>

  <rect width="1000" height="680" rx="12" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1.5"/>

  <!-- Title -->
  <text x="500" y="32" fill="#1e293b" font-size="16" font-weight="800" text-anchor="middle">FEETrack Data Architecture — 16 Mongoose Collections</text>

  <!-- Pillar 1: Identity & Structure -->
  <g transform="translate(30, 60)" filter="url(#shadow2)">
    <rect width="210" height="110" rx="6" fill="#ffffff" stroke="#3b82f6" stroke-width="2"/>
    <rect width="210" height="26" rx="6" fill="#dbeafe"/>
    <text x="105" y="18" fill="#1d4ed8" font-size="12" font-weight="700" text-anchor="middle">User (users)</text>
    <text x="15" y="46" fill="#334155" font-size="10">role: 'parent' | 'accounts'</text>
    <text x="15" y="62" fill="#334155" font-size="10">phone: E.164 (UK)</text>
    <text x="15" y="78" fill="#334155" font-size="10">language: 'en' | 'hi'</text>
    <text x="15" y="94" fill="#334155" font-size="10">consent: { givenBy, at, ver }</text>
  </g>

  <g transform="translate(30, 190)" filter="url(#shadow2)">
    <rect width="210" height="90" rx="6" fill="#ffffff" stroke="#3b82f6" stroke-width="2"/>
    <rect width="210" height="26" rx="6" fill="#dbeafe"/>
    <text x="105" y="18" fill="#1d4ed8" font-size="12" font-weight="700" text-anchor="middle">Centre (centres)</text>
    <text x="15" y="46" fill="#334155" font-size="10">code: string (UK, e.g. JPR-1)</text>
    <text x="15" y="62" fill="#334155" font-size="10">name: string</text>
    <text x="15" y="78" fill="#334155" font-size="10">city: 'Jaipur'</text>
  </g>

  <g transform="translate(30, 300)" filter="url(#shadow2)">
    <rect width="210" height="90" rx="6" fill="#ffffff" stroke="#3b82f6" stroke-width="2"/>
    <rect width="210" height="26" rx="6" fill="#dbeafe"/>
    <text x="105" y="18" fill="#1d4ed8" font-size="12" font-weight="700" text-anchor="middle">Batch (batches)</text>
    <text x="15" y="46" fill="#334155" font-size="10">name: string (e.g. JEE 2027)</text>
    <text x="15" y="62" fill="#334155" font-size="10">centreId: ObjectId (FK)</text>
    <text x="15" y="78" fill="#334155" font-size="10">academicYear: '2026-27'</text>
  </g>

  <!-- Pillar 2: Student & Core Plans -->
  <g transform="translate(270, 60)" filter="url(#shadow2)">
    <rect width="220" height="140" rx="6" fill="#ffffff" stroke="#10b981" stroke-width="2"/>
    <rect width="220" height="26" rx="6" fill="#d1fae5"/>
    <text x="110" y="18" fill="#047857" font-size="12" font-weight="700" text-anchor="middle">Student (students)</text>
    <text x="15" y="46" fill="#334155" font-size="10">studentId: string (UK, STU-xxxx)</text>
    <text x="15" y="62" fill="#334155" font-size="10">name: string</text>
    <text x="15" y="78" fill="#334155" font-size="10">centreId: ObjectId (FK)</text>
    <text x="15" y="94" fill="#334155" font-size="10">batchId: ObjectId (FK)</text>
    <text x="15" y="110" fill="#334155" font-size="10">parentUserId: ObjectId (FK)</text>
    <text x="15" y="126" fill="#334155" font-size="10">status: 'active' | 'left'</text>
  </g>

  <g transform="translate(270, 220)" filter="url(#shadow2)">
    <rect width="220" height="120" rx="6" fill="#ffffff" stroke="#10b981" stroke-width="2"/>
    <rect width="220" height="26" rx="6" fill="#d1fae5"/>
    <text x="110" y="18" fill="#047857" font-size="12" font-weight="700" text-anchor="middle">FeePlan (feeplans)</text>
    <text x="15" y="46" fill="#334155" font-size="10">studentId: ObjectId (FK)</text>
    <text x="15" y="62" fill="#334155" font-size="10">total: Number (Paise)</text>
    <text x="15" y="78" fill="#334155" font-size="10">instalmentCount: Number (1-4)</text>
    <text x="15" y="94" fill="#334155" font-size="10">gstRatePct: 18</text>
    <text x="15" y="110" fill="#334155" font-size="10">policyVersion: 'refund-assumption-v1'</text>
  </g>

  <g transform="translate(270, 360)" filter="url(#shadow2)">
    <rect width="220" height="130" rx="6" fill="#ffffff" stroke="#10b981" stroke-width="2"/>
    <rect width="220" height="26" rx="6" fill="#d1fae5"/>
    <text x="110" y="18" fill="#047857" font-size="12" font-weight="700" text-anchor="middle">Instalment (instalments)</text>
    <text x="15" y="46" fill="#334155" font-size="10">studentId: ObjectId (FK)</text>
    <text x="15" y="62" fill="#334155" font-size="10">feePlanId: ObjectId (FK)</text>
    <text x="15" y="78" fill="#334155" font-size="10">seq: Number (1..4)</text>
    <text x="15" y="94" fill="#334155" font-size="10">dueDate: Date</text>
    <text x="15" y="110" fill="#334155" font-size="10">amount / paid: Number (Paise)</text>
    <text x="15" y="126" fill="#334155" font-size="10">paymentLinkToken: string</text>
  </g>

  <!-- Pillar 3: Financials & Receipts -->
  <g transform="translate(520, 60)" filter="url(#shadow2)">
    <rect width="220" height="120" rx="6" fill="#ffffff" stroke="#f59e0b" stroke-width="2"/>
    <rect width="220" height="26" rx="6" fill="#fef3c7"/>
    <text x="110" y="18" fill="#b45309" font-size="12" font-weight="700" text-anchor="middle">Payment (payments)</text>
    <text x="15" y="46" fill="#334155" font-size="10">studentId / instalmentId: FK</text>
    <text x="15" y="62" fill="#334155" font-size="10">amount: Number (Paise)</text>
    <text x="15" y="78" fill="#334155" font-size="10">source: 'gateway' | 'manual'</text>
    <text x="15" y="94" fill="#334155" font-size="10">gatewayRef: string (UK sparse)</text>
    <text x="15" y="110" fill="#334155" font-size="10">status: 'matched' | 'unmatched'</text>
  </g>

  <g transform="translate(520, 200)" filter="url(#shadow2)">
    <rect width="220" height="100" rx="6" fill="#ffffff" stroke="#f59e0b" stroke-width="2"/>
    <rect width="220" height="26" rx="6" fill="#fef3c7"/>
    <text x="110" y="18" fill="#b45309" font-size="12" font-weight="700" text-anchor="middle">Receipt (receipts)</text>
    <text x="15" y="46" fill="#334155" font-size="10">number: 'RCP-YYYY-XXXXXX' (UK)</text>
    <text x="15" y="62" fill="#334155" font-size="10">base / gst / total: Paise</text>
    <text x="15" y="78" fill="#334155" font-size="10">paymentId: ObjectId (UK, FK)</text>
    <text x="15" y="94" fill="#334155" font-size="10">base + gst == total (Strict)</text>
  </g>

  <g transform="translate(520, 320)" filter="url(#shadow2)">
    <rect width="220" height="100" rx="6" fill="#ffffff" stroke="#f59e0b" stroke-width="2"/>
    <rect width="220" height="26" rx="6" fill="#fef3c7"/>
    <text x="110" y="18" fill="#b45309" font-size="12" font-weight="700" text-anchor="middle">UnmatchedPayment</text>
    <text x="15" y="46" fill="#334155" font-size="10">paymentId: ObjectId (UK, FK)</text>
    <text x="15" y="62" fill="#334155" font-size="10">reason: string</text>
    <text x="15" y="78" fill="#334155" font-size="10">status: 'open' | 'matched' | 'dismissed'</text>
    <text x="15" y="94" fill="#334155" font-size="10">resolvedBy / resolvedAt</text>
  </g>

  <g transform="translate(520, 440)" filter="url(#shadow2)">
    <rect width="220" height="120" rx="6" fill="#ffffff" stroke="#f59e0b" stroke-width="2"/>
    <rect width="220" height="26" rx="6" fill="#fef3c7"/>
    <text x="110" y="18" fill="#b45309" font-size="12" font-weight="700" text-anchor="middle">Refund (refunds)</text>
    <text x="15" y="46" fill="#334155" font-size="10">studentId: ObjectId (FK)</text>
    <text x="15" y="62" fill="#334155" font-size="10">status: 'confirmed' | 'paid' | 'rejected'</text>
    <text x="15" y="78" fill="#334155" font-size="10">deadline: leftOn + 10 days</text>
    <text x="15" y="94" fill="#334155" font-size="10">payout: { method, ref, paidAt }</text>
    <text x="15" y="110" fill="#334155" font-size="10">rejection: { reason, rejectedBy }</text>
  </g>

  <!-- Pillar 4: Risk, Reminders, Audits -->
  <g transform="translate(760, 60)" filter="url(#shadow2)">
    <rect width="210" height="100" rx="6" fill="#ffffff" stroke="#8b5cf6" stroke-width="2"/>
    <rect width="210" height="26" rx="6" fill="#ede9fe"/>
    <text x="105" y="18" fill="#6d28d9" font-size="12" font-weight="700" text-anchor="middle">Reminder (reminders)</text>
    <text x="15" y="46" fill="#334155" font-size="10">instalmentId: ObjectId (FK)</text>
    <text x="15" y="62" fill="#334155" font-size="10">offsetDays: -3, 0, 3, 7, 15</text>
    <text x="15" y="78" fill="#334155" font-size="10">language: 'en' | 'hi'</text>
    <text x="15" y="94" fill="#334155" font-size="10">status: 'pending' | 'sent' | 'cancelled'</text>
  </g>

  <g transform="translate(760, 180)" filter="url(#shadow2)">
    <rect width="210" height="100" rx="6" fill="#ffffff" stroke="#8b5cf6" stroke-width="2"/>
    <rect width="210" height="26" rx="6" fill="#ede9fe"/>
    <text x="105" y="18" fill="#6d28d9" font-size="12" font-weight="700" text-anchor="middle">RiskFlag (riskflags)</text>
    <text x="15" y="46" fill="#334155" font-size="10">studentId: ObjectId (FK)</text>
    <text x="15" y="62" fill="#334155" font-size="10">score: 0-100 (low/med/high)</text>
    <text x="15" y="78" fill="#334155" font-size="10">reasons: [String explainable]</text>
    <text x="15" y="94" fill="#334155" font-size="10">status: 'open' | 'called' | 'false_flag'</text>
  </g>

  <g transform="translate(760, 300)" filter="url(#shadow2)">
    <rect width="210" height="75" rx="6" fill="#ffffff" stroke="#8b5cf6" stroke-width="2"/>
    <rect width="210" height="26" rx="6" fill="#ede9fe"/>
    <text x="105" y="18" fill="#6d28d9" font-size="12" font-weight="700" text-anchor="middle">Attendance (attendances)</text>
    <text x="15" y="46" fill="#334155" font-size="10">studentId: ObjectId (FK)</text>
    <text x="15" y="62" fill="#334155" font-size="10">date: Date / present: Boolean</text>
  </g>

  <g transform="translate(760, 395)" filter="url(#shadow2)">
    <rect width="210" height="75" rx="6" fill="#ffffff" stroke="#8b5cf6" stroke-width="2"/>
    <rect width="210" height="26" rx="6" fill="#ede9fe"/>
    <text x="105" y="18" fill="#6d28d9" font-size="12" font-weight="700" text-anchor="middle">TestScore (testscores)</text>
    <text x="15" y="46" fill="#334155" font-size="10">studentId: ObjectId (FK)</text>
    <text x="15" y="62" fill="#334155" font-size="10">testName / date / score / max</text>
  </g>

  <g transform="translate(760, 490)" filter="url(#shadow2)">
    <rect width="210" height="85" rx="6" fill="#ffffff" stroke="#8b5cf6" stroke-width="2"/>
    <rect width="210" height="26" rx="6" fill="#ede9fe"/>
    <text x="105" y="18" fill="#6d28d9" font-size="12" font-weight="700" text-anchor="middle">MessageLog (messagelogs)</text>
    <text x="15" y="46" fill="#334155" font-size="10">channel: 'whatsapp' | 'sms' | 'mock'</text>
    <text x="15" y="62" fill="#334155" font-size="10">body / template / sentAt</text>
    <text x="15" y="78" fill="#334155" font-size="10">status: 'queued' | 'sent' | 'failed'</text>
  </g>

  <g transform="translate(270, 510)" filter="url(#shadow2)">
    <rect width="220" height="65" rx="6" fill="#ffffff" stroke="#64748b" stroke-width="2"/>
    <rect width="220" height="26" rx="6" fill="#f1f5f9"/>
    <text x="110" y="18" fill="#334155" font-size="12" font-weight="700" text-anchor="middle">Counter (counters)</text>
    <text x="15" y="46" fill="#334155" font-size="10">_id: 'receipt_2026' (PK)</text>
    <text x="15" y="60" fill="#334155" font-size="10">seq: Number ($inc: 1 atomic)</text>
  </g>
</svg>`,

  rbac: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 380" width="100%" height="auto" style="font-family:system-ui,-apple-system,sans-serif;">
  <defs>
    <filter id="shadow3" x="-5%" y="-5%" width="110%" height="110%">
      <feDropShadow dx="0" dy="2" stdDeviation="3" flood-opacity="0.12"/>
    </filter>
  </defs>
  <rect width="800" height="380" rx="10" fill="#f8fafc" stroke="#e2e8f0" stroke-width="1.5"/>

  <!-- Unauthenticated -->
  <g transform="translate(290, 20)" filter="url(#shadow3)">
    <rect width="220" height="50" rx="8" fill="#334155"/>
    <text x="110" y="31" fill="#ffffff" font-size="13" font-weight="700" text-anchor="middle">Unauthenticated Client</text>
  </g>

  <!-- Transitions down -->
  <path d="M 330 70 L 200 130" stroke="#0ea5e9" stroke-width="2"/>
  <text x="210" y="95" fill="#0369a1" font-size="10" font-weight="600">OTP Verify (role: 'parent')</text>

  <path d="M 470 70 L 600 130" stroke="#f59e0b" stroke-width="2"/>
  <text x="500" y="95" fill="#b45309" font-size="10" font-weight="600">OTP Verify (role: 'accounts')</text>

  <!-- Parent Realm -->
  <g transform="translate(60, 130)" filter="url(#shadow3)">
    <rect width="280" height="180" rx="8" fill="#ffffff" stroke="#0284c7" stroke-width="2"/>
    <rect width="280" height="30" rx="8" fill="#e0f2fe"/>
    <text x="140" y="20" fill="#0369a1" font-size="12" font-weight="700" text-anchor="middle">Authenticated Parent Realm</text>
    <text x="20" y="55" fill="#334155" font-size="11">✓ /api/parent/children (Own kids only)</text>
    <text x="20" y="75" fill="#334155" font-size="11">✓ /api/parent/students/:id/ledger</text>
    <text x="20" y="95" fill="#334155" font-size="11">✓ /api/parent/students/:id/receipts</text>
    <text x="20" y="115" fill="#334155" font-size="11">✓ Generate payment links</text>
    <line x1="20" y1="130" x2="260" y2="130" stroke="#e2e8f0" stroke-width="1"/>
    <text x="20" y="152" fill="#dc2626" font-size="11" font-weight="600">✗ Access /api/accounts/* -> HTTP 403</text>
    <text x="20" y="168" fill="#dc2626" font-size="11" font-weight="600">✗ Other parent's child -> HTTP 403</text>
  </g>

  <!-- Accounts Realm -->
  <g transform="translate(460, 130)" filter="url(#shadow3)">
    <rect width="280" height="180" rx="8" fill="#ffffff" stroke="#d97706" stroke-width="2"/>
    <rect width="280" height="30" rx="8" fill="#fef3c7"/>
    <text x="140" y="20" fill="#b45309" font-size="12" font-weight="700" text-anchor="middle">Authenticated Accounts Realm</text>
    <text x="20" y="55" fill="#334155" font-size="11">✓ /api/accounts/dashboard (Multi-centre)</text>
    <text x="20" y="75" fill="#334155" font-size="11">✓ Offline manual fee collections</text>
    <text x="20" y="95" fill="#334155" font-size="11">✓ Unmatched payments queue</text>
    <text x="20" y="115" fill="#334155" font-size="11">✓ Pro-rata refund processing desk</text>
    <line x1="20" y1="130" x2="260" y2="130" stroke="#e2e8f0" stroke-width="1"/>
    <text x="20" y="152" fill="#dc2626" font-size="11" font-weight="600">✗ Access /api/parent/* -> HTTP 403</text>
    <text x="20" y="168" fill="#15803d" font-size="11" font-weight="600">✓ Export OWASP Sanitized CSVs</text>
  </g>

  <!-- Logout arrows -->
  <path d="M 200 310 L 350 350" stroke="#64748b" stroke-width="1.5" stroke-dasharray="4"/>
  <path d="M 600 310 L 450 350" stroke="#64748b" stroke-width="1.5" stroke-dasharray="4"/>
  <text x="400" y="360" fill="#64748b" font-size="11" text-anchor="middle">POST /api/auth/logout (Clears httpOnly cookie)</text>
</svg>`,

  paymentWorkflow: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 850 480" width="100%" height="auto" style="font-family:system-ui,-apple-system,sans-serif;">
  <rect width="850" height="480" rx="10" fill="#f8fafc" stroke="#e2e8f0" stroke-width="1.5"/>

  <!-- Lifeline Headers -->
  <g transform="translate(50, 20)">
    <rect width="110" height="36" rx="6" fill="#1e3a8a"/>
    <text x="55" y="23" fill="#fff" font-size="11" font-weight="700" text-anchor="middle">Parent (Browser)</text>
    <line x1="55" y1="36" x2="55" y2="440" stroke="#cbd5e1" stroke-width="1.5" stroke-dasharray="4"/>
  </g>

  <g transform="translate(220, 20)">
    <rect width="110" height="36" rx="6" fill="#0284c7"/>
    <text x="55" y="23" fill="#fff" font-size="11" font-weight="700" text-anchor="middle">Express API</text>
    <line x1="55" y1="36" x2="55" y2="440" stroke="#cbd5e1" stroke-width="1.5" stroke-dasharray="4"/>
  </g>

  <g transform="translate(390, 20)">
    <rect width="110" height="36" rx="6" fill="#f59e0b"/>
    <text x="55" y="23" fill="#fff" font-size="11" font-weight="700" text-anchor="middle">Payment Gateway</text>
    <line x1="55" y1="36" x2="55" y2="440" stroke="#cbd5e1" stroke-width="1.5" stroke-dasharray="4"/>
  </g>

  <g transform="translate(560, 20)">
    <rect width="110" height="36" rx="6" fill="#10b981"/>
    <text x="55" y="23" fill="#fff" font-size="11" font-weight="700" text-anchor="middle">Webhook Receiver</text>
    <line x1="55" y1="36" x2="55" y2="440" stroke="#cbd5e1" stroke-width="1.5" stroke-dasharray="4"/>
  </g>

  <g transform="translate(710, 20)">
    <rect width="100" height="36" rx="6" fill="#334155"/>
    <text x="50" y="23" fill="#fff" font-size="11" font-weight="700" text-anchor="middle">MongoDB Atlas</text>
    <line x1="50" y1="36" x2="50" y2="440" stroke="#cbd5e1" stroke-width="1.5" stroke-dasharray="4"/>
  </g>

  <!-- Step 1: Pay Online -->
  <line x1="105" y1="80" x2="275" y2="80" stroke="#2563eb" stroke-width="2"/>
  <text x="190" y="73" fill="#1e40af" font-size="10" font-weight="600" text-anchor="middle">1. POST /api/parent/.../pay</text>

  <!-- Step 2: Create Gateway Link -->
  <line x1="275" y1="110" x2="445" y2="110" stroke="#d97706" stroke-width="2"/>
  <text x="360" y="103" fill="#b45309" font-size="10" font-weight="600" text-anchor="middle">2. createPaymentLink()</text>

  <!-- Step 3: Return Checkout URL -->
  <line x1="445" y1="140" x2="105" y2="140" stroke="#059669" stroke-width="2" stroke-dasharray="3"/>
  <text x="275" y="133" fill="#047857" font-size="10" font-weight="600" text-anchor="middle">3. Return paymentUrl (Checkout)</text>

  <!-- Step 4: Parent Completes Payment -->
  <line x1="105" y1="180" x2="445" y2="180" stroke="#2563eb" stroke-width="2"/>
  <text x="275" y="173" fill="#1e40af" font-size="10" font-weight="600" text-anchor="middle">4. Completes UPI / NetBanking transaction</text>

  <!-- Step 5: Webhook Dispatch with HMAC -->
  <line x1="445" y1="220" x2="615" y2="220" stroke="#dc2626" stroke-width="2"/>
  <text x="530" y="213" fill="#b91c1c" font-size="10" font-weight="700" text-anchor="middle">5. POST /api/webhooks/payment (HMAC Header)</text>

  <!-- Step 6: Verify Signature & Idempotency -->
  <rect x="575" y="240" width="80" height="30" rx="4" fill="#fee2e2" stroke="#ef4444"/>
  <text x="615" y="258" fill="#991b1b" font-size="9" font-weight="700" text-anchor="middle">Verify HMAC</text>

  <!-- Step 7: Check Duplicate -->
  <line x1="615" y1="290" x2="760" y2="290" stroke="#059669" stroke-width="2"/>
  <text x="687" y="283" fill="#047857" font-size="10" font-weight="600" text-anchor="middle">7. Check gatewayRef</text>

  <!-- Step 8: Update Ledger & Cancel Reminders -->
  <line x1="615" y1="330" x2="760" y2="330" stroke="#059669" stroke-width="2"/>
  <text x="687" y="323" fill="#047857" font-size="10" font-weight="600" text-anchor="middle">8. Credit Instalment &amp; cancel reminders</text>

  <!-- Step 9: Atomic Counter & GST Receipt -->
  <line x1="615" y1="370" x2="760" y2="370" stroke="#059669" stroke-width="2"/>
  <text x="687" y="363" fill="#047857" font-size="10" font-weight="600" text-anchor="middle">9. Counter.inc() -> Issue RCP-YYYY-XXXXXX</text>

  <!-- Step 10: 200 OK Response -->
  <line x1="615" y1="410" x2="445" y2="410" stroke="#059669" stroke-width="2" stroke-dasharray="3"/>
  <text x="530" y="403" fill="#047857" font-size="10" font-weight="600" text-anchor="middle">10. HTTP 200 { success: true }</text>
</svg>`,

  refundWorkflow: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 850 440" width="100%" height="auto" style="font-family:system-ui,-apple-system,sans-serif;">
  <rect width="850" height="440" rx="10" fill="#f8fafc" stroke="#e2e8f0" stroke-width="1.5"/>

  <!-- Lifeline Headers -->
  <g transform="translate(60, 20)">
    <rect width="110" height="36" rx="6" fill="#1e3a8a"/>
    <text x="55" y="23" fill="#fff" font-size="11" font-weight="700" text-anchor="middle">Accounts Staff</text>
    <line x1="55" y1="36" x2="55" y2="400" stroke="#cbd5e1" stroke-width="1.5" stroke-dasharray="4"/>
  </g>

  <g transform="translate(240, 20)">
    <rect width="120" height="36" rx="6" fill="#0284c7"/>
    <text x="60" y="23" fill="#fff" font-size="11" font-weight="700" text-anchor="middle">Accounts UI Desk</text>
    <line x1="60" y1="36" x2="60" y2="400" stroke="#cbd5e1" stroke-width="1.5" stroke-dasharray="4"/>
  </g>

  <g transform="translate(430, 20)">
    <rect width="110" height="36" rx="6" fill="#f59e0b"/>
    <text x="55" y="23" fill="#fff" font-size="11" font-weight="700" text-anchor="middle">Express API</text>
    <line x1="55" y1="36" x2="55" y2="400" stroke="#cbd5e1" stroke-width="1.5" stroke-dasharray="4"/>
  </g>

  <g transform="translate(590, 20)">
    <rect width="110" height="36" rx="6" fill="#15803d"/>
    <text x="55" y="23" fill="#fff" font-size="11" font-weight="700" text-anchor="middle">Domain (refund.js)</text>
    <line x1="55" y1="36" x2="55" y2="400" stroke="#cbd5e1" stroke-width="1.5" stroke-dasharray="4"/>
  </g>

  <g transform="translate(730, 20)">
    <rect width="90" height="36" rx="6" fill="#334155"/>
    <text x="45" y="23" fill="#fff" font-size="11" font-weight="700" text-anchor="middle">MongoDB</text>
    <line x1="45" y1="36" x2="45" y2="400" stroke="#cbd5e1" stroke-width="1.5" stroke-dasharray="4"/>
  </g>

  <!-- Step 1: Input calculation -->
  <line x1="115" y1="80" x2="300" y2="80" stroke="#2563eb" stroke-width="2"/>
  <text x="207" y="73" fill="#1e40af" font-size="10" font-weight="600" text-anchor="middle">1. Enters studentId &amp; daysUsed</text>

  <!-- Step 2: Preview API -->
  <line x1="300" y1="110" x2="485" y2="110" stroke="#2563eb" stroke-width="2"/>
  <text x="392" y="103" fill="#1e40af" font-size="10" font-weight="600" text-anchor="middle">2. POST /api/accounts/refunds/calculate</text>

  <!-- Step 3: Pure calculation -->
  <line x1="485" y1="140" x2="645" y2="140" stroke="#059669" stroke-width="2"/>
  <text x="565" y="133" fill="#047857" font-size="10" font-weight="600" text-anchor="middle">3. calculateProRataRefund()</text>
  <rect x="575" y="150" width="140" height="36" rx="4" fill="#f0fdf4" stroke="#22c55e"/>
  <text x="645" y="165" fill="#15803d" font-size="9" text-anchor="middle">netRefund = max(0, paid - usedShare - procFee)</text>
  <text x="645" y="178" fill="#15803d" font-size="9" text-anchor="middle">5% procFee capped at ₹5,000</text>

  <!-- Step 4: Preview returned -->
  <line x1="485" y1="210" x2="115" y2="210" stroke="#059669" stroke-width="2" stroke-dasharray="3"/>
  <text x="300" y="203" fill="#047857" font-size="10" font-weight="600" text-anchor="middle">4. Preview: Net ₹30,000, Deadline: leftOn+10d</text>

  <!-- Step 5: Staff Confirms Record -->
  <line x1="115" y1="250" x2="485" y2="250" stroke="#d97706" stroke-width="2"/>
  <text x="300" y="243" fill="#b45309" font-size="10" font-weight="600" text-anchor="middle">5. POST /api/accounts/refunds (status: 'confirmed')</text>

  <!-- Step 6: Insert DB -->
  <line x1="485" y1="280" x2="775" y2="280" stroke="#d97706" stroke-width="2"/>
  <text x="630" y="273" fill="#b45309" font-size="10" font-weight="600" text-anchor="middle">6. Insert Refund { status: 'confirmed' }</text>

  <!-- Step 7: Process Payout -->
  <line x1="115" y1="320" x2="485" y2="320" stroke="#7c3aed" stroke-width="2"/>
  <text x="300" y="313" fill="#6d28d9" font-size="10" font-weight="700" text-anchor="middle">7. POST /api/accounts/refunds/:id/pay (method, ref, paidAt)</text>

  <!-- Step 8: Atomic Transition -->
  <line x1="485" y1="360" x2="775" y2="360" stroke="#7c3aed" stroke-width="2"/>
  <text x="630" y="353" fill="#6d28d9" font-size="10" font-weight="700" text-anchor="middle">8. findOneAndUpdate({ status: 'confirmed' }) -> 'paid'</text>

  <!-- Step 9: Confirmed -->
  <line x1="485" y1="390" x2="115" y2="390" stroke="#059669" stroke-width="2" stroke-dasharray="3"/>
  <text x="300" y="383" fill="#047857" font-size="10" font-weight="600" text-anchor="middle">9. HTTP 200 (Atomic Transition Succeeded)</text>
</svg>`
};

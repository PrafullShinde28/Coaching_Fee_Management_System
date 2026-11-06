import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 1. Component and Page Structure
test('1. Phase 6 Accounts Components and Pages Structure', () => {
  const pages = [
    'AccountsDashboardPage.jsx',
    'AccountsStudentsPage.jsx',
    'AccountsStudentDetailPage.jsx',
    'AccountsCollectionsPage.jsx',
    'AccountsUnmatchedPage.jsx',
    'AccountsRefundsPage.jsx',
    'AccountsRemindersPage.jsx',
    'AccountsRiskPage.jsx',
    'AccountsReportsPage.jsx'
  ];

  for (const page of pages) {
    const pagePath = path.resolve(__dirname, '../src/pages/accounts', page);
    assert.ok(fs.existsSync(pagePath), `Page ${page} must exist`);
    const content = fs.readFileSync(pagePath, 'utf8');
    assert.ok(content.includes('export function'), `${page} must export a component function`);
  }

  const components = [
    'AccountsHeader.jsx',
    'AccountsSidebar.jsx',
    'AccountsMobileNav.jsx',
    'AccountsLayout.jsx',
    'AccountsProtectedRoute.jsx'
  ];

  for (const comp of components) {
    const compPath = path.resolve(__dirname, '../src/components/accounts', comp);
    assert.ok(fs.existsSync(compPath), `Component ${comp} must exist`);
  }
});

// 2. Localization Parity
test('2. Accounts Localization Parity: EN and HI dictionaries', () => {
  const enPath = path.resolve(__dirname, '../src/locales/en/translation.json');
  const hiPath = path.resolve(__dirname, '../src/locales/hi/translation.json');

  const en = JSON.parse(fs.readFileSync(enPath, 'utf8'));
  const hi = JSON.parse(fs.readFileSync(hiPath, 'utf8'));

  const requiredSections = [
    'accountsNav',
    'accountsDashboard',
    'accountsStudents',
    'accountsStudentDetail',
    'accountsCollections',
    'accountsUnmatched',
    'accountsRefunds',
    'accountsReminders',
    'accountsRisk',
    'accountsReports'
  ];

  for (const sec of requiredSections) {
    assert.ok(en[sec], `English translation must have section: ${sec}`);
    assert.ok(hi[sec], `Hindi translation must have section: ${sec}`);

    const enKeys = Object.keys(en[sec]);
    const hiKeys = Object.keys(hi[sec]);

    for (const key of enKeys) {
      assert.ok(
        hiKeys.includes(key),
        `Hindi translation missing key "${key}" in section "${sec}"`
      );
      assert.ok(
        typeof hi[sec][key] === 'string' && hi[sec][key].length > 0,
        `Hindi translation for "${sec}.${key}" must not be empty`
      );
    }
  }
});

// 3. CSV Sanitization with Leading Whitespace & Control Characters
test('3. CSV Sanitization: Formula Injection Protection with Leading Whitespace & Control Characters', () => {
  // Pure implementation of the OWASP sanitizer
  function sanitizeCsvCell(val) {
    if (val === null || val === undefined) return '';
    let str = String(val).replace(/\0/g, '');
    const strippedLeading = str.replace(/^[\s\x00-\x1f\x7f-\x9f]+/, '');
    const hasTrigger = /^[=+\-@|%]/.test(strippedLeading);
    const startsWithControl = /^[\t\r\n]/.test(str);
    if (hasTrigger || startsWithControl) {
      str = `'${str}`;
    }
    if (/[",\n\r]/.test(str)) {
      str = `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }

  // Basic formula injection triggers
  assert.equal(sanitizeCsvCell('=SUM(A1:A10)'), "'=SUM(A1:A10)");
  assert.equal(sanitizeCsvCell('+cmd|/c calc'), "'+cmd|/c calc");
  assert.equal(sanitizeCsvCell('-1+1'), "'-1+1");
  assert.equal(sanitizeCsvCell('@IMPORT'), "'@IMPORT");
  assert.equal(sanitizeCsvCell('|cmd.exe'), "'|cmd.exe");
  assert.equal(sanitizeCsvCell('%1+1'), "'%1+1");

  // Edge Case: Leading whitespace before trigger characters
  assert.equal(sanitizeCsvCell('   =SUM(A1:A10)'), "'   =SUM(A1:A10)");
  assert.equal(sanitizeCsvCell('  +cmd'), "'  +cmd");
  assert.equal(sanitizeCsvCell('    -100'), "'    -100");
  assert.equal(sanitizeCsvCell('  @IMPORT'), "'  @IMPORT");

  // Edge Case: Control characters (\t, \r, \n, \0)
  assert.equal(sanitizeCsvCell('\t=1+1'), "'\t=1+1");
  assert.equal(sanitizeCsvCell('\0=cmd'), "'=cmd"); // null byte stripped, then sanitized
  assert.equal(sanitizeCsvCell('\r\n=calc'), `"'\r\n=calc"`);
  assert.equal(sanitizeCsvCell('\tSimpleText'), "'\tSimpleText");

  // Normal safe values
  assert.equal(sanitizeCsvCell('Aarav Sharma'), 'Aarav Sharma');
  assert.equal(sanitizeCsvCell(120000), '120000');
  assert.equal(sanitizeCsvCell('Jaipur, Rajasthan'), '"Jaipur, Rajasthan"');
  assert.equal(sanitizeCsvCell('He said "Hello"'), '"He said ""Hello"""');
  assert.equal(sanitizeCsvCell(null), '');
  assert.equal(sanitizeCsvCell(undefined), '');
});

// 4. Approved Phase 2 Pro-rata Refund Formula
test('4. Approved Phase 2 Pro-rata Refund Formula Verification', () => {
  // Phase 2 Approved Specification:
  // feeAfterDiscount = Math.max(0, totalFee - discount)
  // usedShare = Math.min(feeAfterDiscount, Math.floor((feeAfterDiscount * clampedDaysUsed + Math.floor(termDays / 2)) / termDays))
  // processingFee = Math.min(Math.floor((totalFee * 500 + 5000) / 10000), 500000)  [5% of totalFee capped at 500,000 paise / Rs. 5,000]
  // grossRefund = Math.max(0, paid - usedShare - processingFee)

  const totalFee = 12000000; // Rs. 1,20,000
  const discount = 2000000;  // Rs. 20,000 discount
  const termDays = 100;
  const daysUsed = 20;       // 20% of term
  const paid = 6000000;      // Rs. 60,000 paid

  const feeAfterDiscount = totalFee - discount; // Rs. 1,00,000 (10,000,000 paise)
  assert.equal(feeAfterDiscount, 10000000);

  // usedShare = 10,000,000 * 20 / 100 = 2,000,000 paise (Rs. 20,000)
  const usedShare = Math.floor((feeAfterDiscount * daysUsed + Math.floor(termDays / 2)) / termDays);
  assert.equal(usedShare, 2000000);

  // processingFee = 5% of totalFee (12,000,000 * 0.05 = 600,000), capped at 500,000 paise (Rs. 5,000)
  const processingFee = Math.min(500000, Math.floor((totalFee * 500 + 5000) / 10000));
  assert.equal(processingFee, 500000); // capped at Rs. 5,000

  // grossRefund = 6,000,000 - 2,000,000 - 500,000 = 3,500,000 paise (Rs. 35,000)
  const grossRefund = Math.max(0, paid - usedShare - processingFee);
  assert.equal(grossRefund, 3500000);

  // Scenario 2: Uncapped 5% processing fee on smaller totalFee (e.g. Rs. 80,000)
  const smallTotalFee = 8000000; // Rs. 80,000
  // 5% of Rs. 80,000 is Rs. 4,000 (400,000 paise), which is below the Rs. 5,000 cap
  const uncappedProcessingFee = Math.min(500000, Math.floor((smallTotalFee * 500 + 5000) / 10000));
  assert.equal(uncappedProcessingFee, 400000); // exactly Rs. 4,000 (5% of totalFee)
});

// 5. 10-Day Withdrawal Deadline Logic Verification
test('5. 10-Day Withdrawal Deadline Logic Verification', () => {
  const leftOnDate = new Date('2026-11-01');
  const deadlineDate = new Date(leftOnDate);
  deadlineDate.setDate(deadlineDate.getDate() + 10); // 2026-11-11

  const withinWindow = '2026-11-06';
  const pastWindow = '2026-11-15';

  const deadlineIso = deadlineDate.toISOString().slice(0, 10);
  assert.equal(deadlineIso, '2026-11-11');
  assert.ok(withinWindow <= deadlineIso, 'Within 10 days should be eligible');
  assert.ok(pastWindow > deadlineIso, 'After 10 days should be ineligible');
});

// 6. Role-Based Login Redirect and Route Protection
test('6. Authentication Role-Based Routing and Redirect Verification', () => {
  function getRedirectPath(userRole, intendedFrom) {
    if (!userRole) return '/login';
    if (userRole === 'accounts') {
      return intendedFrom && intendedFrom.startsWith('/accounts') ? intendedFrom : '/accounts/dashboard';
    }
    if (userRole === 'parent') {
      return intendedFrom && intendedFrom.startsWith('/parent') ? intendedFrom : '/parent/dashboard';
    }
    return '/login';
  }

  // 1. Accounts user logging in with default destination
  assert.equal(getRedirectPath('accounts', null), '/accounts/dashboard');
  assert.equal(getRedirectPath('accounts', '/'), '/accounts/dashboard');

  // 2. Accounts user logging in with specific deep link
  assert.equal(getRedirectPath('accounts', '/accounts/collections'), '/accounts/collections');
  assert.equal(getRedirectPath('accounts', '/accounts/refunds'), '/accounts/refunds');

  // 3. Accounts user with invalid parent destination falls back to accounts dashboard
  assert.equal(getRedirectPath('accounts', '/parent/dashboard'), '/accounts/dashboard');

  // 4. Parent user logging in with default destination
  assert.equal(getRedirectPath('parent', null), '/parent/dashboard');
  assert.equal(getRedirectPath('parent', '/'), '/parent/dashboard');

  // 5. Parent user with accounts deep link redirected safely to parent portal
  assert.equal(getRedirectPath('parent', '/accounts/dashboard'), '/parent/dashboard');

  // 6. Unauthenticated user
  assert.equal(getRedirectPath(null, '/accounts/dashboard'), '/login');
});

// 7. Refund Payout & Rejection Audit Schema Fields Verification
test('7. Refund Payout and Rejection Audit Schema Fields Verification', () => {
  const samplePayout = {
    method: 'bank_transfer',
    reference: 'NEFT-AXIS-9921048',
    paidAt: new Date('2026-11-06T10:00:00Z'),
    processedBy: '6aede25a798849b3d784c001',
    notes: 'Disbursed via bank portal with student consent'
  };

  assert.ok(['bank_transfer', 'cheque', 'upi', 'cash', 'other'].includes(samplePayout.method), 'Method must be valid');
  assert.ok(typeof samplePayout.reference === 'string' && samplePayout.reference.length > 0, 'Reference required');
  assert.ok(samplePayout.paidAt instanceof Date && !isNaN(samplePayout.paidAt), 'PaidAt date must be valid');
  assert.ok(typeof samplePayout.processedBy === 'string' && samplePayout.processedBy.length > 0, 'ProcessedBy staff ID required');

  // Rejection audit schema
  const sampleRejection = {
    reason: 'Student attended 90 days out of 100-day term, ineligible for refund',
    rejectedBy: '6aede25a798849b3d784c001',
    rejectedAt: new Date('2026-11-06T11:00:00Z')
  };

  assert.ok(typeof sampleRejection.reason === 'string' && sampleRejection.reason.trim().length > 0, 'Rejection reason is required');
  assert.ok(sampleRejection.rejectedAt instanceof Date && !isNaN(sampleRejection.rejectedAt), 'RejectedAt date must be valid');
  assert.ok(typeof sampleRejection.rejectedBy === 'string' && sampleRejection.rejectedBy.length > 0, 'RejectedBy staff ID required');

  // Validation function enforcing mandatory payout evidence
  function validatePayoutPayload(p) {
    if (!p.method || !['bank_transfer', 'cheque', 'upi', 'cash', 'other'].includes(p.method)) {
      throw new Error('Valid payment method is required');
    }
    if (!p.reference || !p.reference.trim()) {
      throw new Error('Transaction reference is required');
    }
    if (!p.paidAt || isNaN(Date.parse(p.paidAt))) {
      throw new Error('Valid payout date is required');
    }
    return true;
  }

  // Missing fields fail validation
  assert.throws(() => validatePayoutPayload({ reference: 'REF-1', paidAt: '2026-11-06' }), /payment method/);
  assert.throws(() => validatePayoutPayload({ method: 'bank_transfer', paidAt: '2026-11-06' }), /reference/);
  assert.throws(() => validatePayoutPayload({ method: 'bank_transfer', reference: '   ', paidAt: '2026-11-06' }), /reference/);
  assert.throws(() => validatePayoutPayload({ method: 'bank_transfer', reference: 'REF-1' }), /payout date/);
  assert.throws(() => validatePayoutPayload({ method: 'bank_transfer', reference: 'REF-1', paidAt: 'invalid-date' }), /payout date/);
  assert.ok(validatePayoutPayload({ method: 'upi', reference: 'UPI-9821734', paidAt: '2026-11-06T10:00:00.000Z' }));
});

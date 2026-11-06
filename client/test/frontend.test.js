import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 1. Formatting tests
import { formatInr, formatDate, formatPhone } from '../src/utils/formatters.js';

test('1. formatInr: converts integer paise to Indian Rupee currency correctly', () => {
  // Exact whole amounts
  assert.equal(formatInr(3000000).replace(/\u00a0/g, ' '), '₹30,000');
  assert.equal(formatInr(1500000).replace(/\u00a0/g, ' '), '₹15,000');
  assert.equal(formatInr(4000000).replace(/\u00a0/g, ' '), '₹40,000');
  assert.equal(formatInr(0).replace(/\u00a0/g, ' '), '₹0');

  // Fractional paise amounts
  assert.equal(formatInr(1500050).replace(/\u00a0/g, ' '), '₹15,000.50');
  assert.equal(formatInr(1271186).replace(/\u00a0/g, ' '), '₹12,711.86');

  // Edge cases
  assert.equal(formatInr(null), '₹0');
  assert.equal(formatInr(undefined), '₹0');
  assert.equal(formatInr(NaN), '₹0');
});

test('2. formatDate: formats dates consistently and safely', () => {
  const formatted = formatDate('2026-10-10');
  assert.match(formatted, /10 Oct 2026/);
  assert.equal(formatDate(null), '—');
  assert.equal(formatDate('invalid-date'), '—');
});

test('3. formatPhone: formats Indian phone numbers cleanly', () => {
  assert.equal(formatPhone('+919900000041'), '+91 99000 00041');
  assert.equal(formatPhone('+919900000058'), '+91 99000 00058');
  assert.equal(formatPhone('9900000041'), '9900000041');
  assert.equal(formatPhone(''), '');
});

// 2. Design Tokens validation
test('4. Design Tokens: tokens.css contains all required design variables', () => {
  const tokensPath = path.resolve(__dirname, '../src/styles/tokens.css');
  assert.ok(fs.existsSync(tokensPath), 'tokens.css must exist');
  const css = fs.readFileSync(tokensPath, 'utf8');

  const requiredTokens = [
    '--color-primary',
    '--color-secondary',
    '--color-bg',
    '--color-surface',
    '--color-text',
    '--color-border',
    '--color-success',
    '--color-warning',
    '--color-danger',
    '--color-info',
    '--color-part-paid',
    '--font-size-base',
    '--space-4',
    '--radius-md',
    '--shadow-sm'
  ];

  for (const token of requiredTokens) {
    assert.ok(css.includes(token), `tokens.css must define ${token}`);
  }
});

// 3. Localization & i18n parity
test('5. Localization: English and Hindi translation files have complete parity', () => {
  const enPath = path.resolve(__dirname, '../src/locales/en/translation.json');
  const hiPath = path.resolve(__dirname, '../src/locales/hi/translation.json');

  assert.ok(fs.existsSync(enPath), 'English translation.json must exist');
  assert.ok(fs.existsSync(hiPath), 'Hindi translation.json must exist');

  const en = JSON.parse(fs.readFileSync(enPath, 'utf8'));
  const hi = JSON.parse(fs.readFileSync(hiPath, 'utf8'));

  function assertKeysMatch(enObj, hiObj, prefix = '') {
    for (const key of Object.keys(enObj)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      assert.ok(key in hiObj, `Missing Hindi translation for key: ${fullKey}`);
      if (typeof enObj[key] === 'object' && enObj[key] !== null) {
        assertKeysMatch(enObj[key], hiObj[key], fullKey);
      } else {
        assert.ok(typeof hiObj[key] === 'string' && hiObj[key].length > 0, `Hindi value for ${fullKey} must be a non-empty string`);
      }
    }
  }

  assertKeysMatch(en, hi);

  // Check critical fee statuses
  assert.equal(en.status.paid, 'Paid');
  assert.equal(hi.status.paid, 'भुगतान हो गया');
  assert.equal(en.status.part_paid, 'Part Paid');
  assert.equal(hi.status.part_paid, 'आंशिक भुगतान');
  assert.equal(en.status.overdue, 'Overdue');
  assert.equal(hi.status.overdue, 'अतिदेय');
  assert.equal(en.status.due_soon, 'Due Soon');
  assert.equal(hi.status.due_soon, 'जल्द देय');
});

// 4. Centralized API Client verification
test('6. API Client: enforces credentials: include and correct endpoint contracts', async () => {
  const calls = [];
  global.fetch = async (url, options) => {
    calls.push({ url, options });
    return {
      ok: true,
      status: 200,
      json: async () => ({ ok: true, data: 'mock' })
    };
  };

  const { api } = await import('../src/services/api.js');

  // 1. Auth requests
  await api.auth.requestOtp('+919900000041');
  assert.equal(calls[calls.length - 1].url, '/api/auth/otp/request');
  assert.equal(calls[calls.length - 1].options.credentials, 'include');
  assert.equal(calls[calls.length - 1].options.method, 'POST');

  await api.auth.verifyOtp('+919900000041', '246810');
  assert.equal(calls[calls.length - 1].url, '/api/auth/otp/verify');
  assert.equal(calls[calls.length - 1].options.credentials, 'include');

  await api.auth.getMe();
  assert.equal(calls[calls.length - 1].url, '/api/auth/me');
  assert.equal(calls[calls.length - 1].options.credentials, 'include');

  await api.auth.submitConsent('2026.1');
  assert.equal(calls[calls.length - 1].url, '/api/auth/consent');
  assert.equal(calls[calls.length - 1].options.credentials, 'include');

  await api.auth.logout();
  assert.equal(calls[calls.length - 1].url, '/api/auth/logout');
  assert.equal(calls[calls.length - 1].options.credentials, 'include');

  // 2. Parent requests
  await api.parent.getChildren();
  assert.equal(calls[calls.length - 1].url, '/api/parent/children');
  assert.equal(calls[calls.length - 1].options.credentials, 'include');

  await api.parent.getStudentLedger('6701a0000000000000000001');
  assert.equal(calls[calls.length - 1].url, '/api/parent/students/6701a0000000000000000001/ledger');
  assert.equal(calls[calls.length - 1].options.credentials, 'include');

  await api.parent.getStudentPayments('6701a0000000000000000001');
  assert.equal(calls[calls.length - 1].url, '/api/parent/students/6701a0000000000000000001/payments');
  assert.equal(calls[calls.length - 1].options.credentials, 'include');

  await api.parent.getStudentReceipts('6701a0000000000000000001');
  assert.equal(calls[calls.length - 1].url, '/api/parent/students/6701a0000000000000000001/receipts');
  assert.equal(calls[calls.length - 1].options.credentials, 'include');

  await api.parent.createPaymentLink('6701b0000000000000000001');
  assert.equal(calls[calls.length - 1].url, '/api/parent/instalments/6701b0000000000000000001/payment-link');
  assert.equal(calls[calls.length - 1].options.credentials, 'include');
});

test('7. API Client: extracts error messages on HTTP 401/403/404 failures', async () => {
  global.fetch = async () => ({
    ok: false,
    status: 403,
    json: async () => ({ error: 'You cannot access this student' })
  });

  const { api } = await import('../src/services/api.js');
  await assert.rejects(
    async () => {
      await api.parent.getStudentLedger('6701a0000000000000000099');
    },
    (err) => {
      assert.equal(err.status, 403);
      assert.equal(err.message, 'You cannot access this student');
      return true;
    }
  );
});

// 5. Component files exist and have proper exports
test('8. Reusable Components: all 14 required design system components are implemented and exported', () => {
  const componentFiles = [
    { file: 'src/components/common/Button.jsx', exportName: 'Button' },
    { file: 'src/components/common/Input.jsx', exportName: 'Input' },
    { file: 'src/components/common/Card.jsx', exportName: 'Card' },
    { file: 'src/components/common/Badge.jsx', exportName: 'Badge' },
    { file: 'src/components/common/Modal.jsx', exportName: 'Modal' },
    { file: 'src/components/common/LoadingSpinner.jsx', exportName: 'LoadingSpinner' },
    { file: 'src/components/common/SkeletonLoader.jsx', exportName: 'SkeletonLoader' },
    { file: 'src/components/common/EmptyState.jsx', exportName: 'EmptyState' },
    { file: 'src/components/common/ErrorState.jsx', exportName: 'ErrorState' },
    { file: 'src/components/common/ConfirmDialog.jsx', exportName: 'ConfirmDialog' },
    { file: 'src/components/common/ResponsiveTable.jsx', exportName: 'ResponsiveTable' },
    { file: 'src/components/common/Toast.jsx', exportName: 'ToastContainer' },
    { file: 'src/components/common/LanguageSwitcher.jsx', exportName: 'LanguageSwitcher' },
    { file: 'src/components/auth/ProtectedRoute.jsx', exportName: 'ProtectedRoute' }
  ];

  for (const { file, exportName } of componentFiles) {
    const fullPath = path.resolve(__dirname, '..', file);
    assert.ok(fs.existsSync(fullPath), `Component file ${file} must exist`);
    const content = fs.readFileSync(fullPath, 'utf8');
    assert.ok(
      content.includes(`export function ${exportName}`) ||
      content.includes(`export const ${exportName}`),
      `Component file ${file} must export ${exportName}`
    );
  }
});

// 6. Security check: No JWT stored in storage
test('9. Security Rule: JWT tokens are strictly avoided in localStorage and sessionStorage', () => {
  const clientSrcDir = path.resolve(__dirname, '../src');
  const files = [];

  function scanDir(dir) {
    for (const f of fs.readdirSync(dir)) {
      const full = path.join(dir, f);
      if (fs.statSync(full).isDirectory()) {
        scanDir(full);
      } else if (f.endsWith('.js') || f.endsWith('.jsx')) {
        files.push(full);
      }
    }
  }
  scanDir(clientSrcDir);

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    // Ensure no token storage
    assert.ok(
      !content.includes("localStorage.setItem('token'") &&
      !content.includes("localStorage.setItem('jwt'") &&
      !content.includes("sessionStorage.setItem('token'"),
      `File ${file} must never store JWT in browser storage`
    );
  }
});

// 7. Route and Page component implementation verification
test('10. Parent Routes: all required pages are implemented with proper exports', () => {
  const pageFiles = [
    { file: 'src/pages/LoginPage.jsx', exportName: 'LoginPage' },
    { file: 'src/pages/parent/DashboardPage.jsx', exportName: 'DashboardPage' },
    { file: 'src/pages/parent/ChildrenPage.jsx', exportName: 'ChildrenPage' },
    { file: 'src/pages/parent/StudentDetailPage.jsx', exportName: 'StudentDetailPage' },
    { file: 'src/pages/parent/FeeLedgerPage.jsx', exportName: 'FeeLedgerPage' },
    { file: 'src/pages/parent/ReceiptsPage.jsx', exportName: 'ReceiptsPage' },
    { file: 'src/pages/parent/ProfilePage.jsx', exportName: 'ProfilePage' },
    { file: 'src/pages/NotFoundPage.jsx', exportName: 'NotFoundPage' }
  ];

  for (const { file, exportName } of pageFiles) {
    const fullPath = path.resolve(__dirname, '..', file);
    assert.ok(fs.existsSync(fullPath), `Page file ${file} must exist`);
    const content = fs.readFileSync(fullPath, 'utf8');
    assert.ok(
      content.includes(`export function ${exportName}`) ||
      content.includes(`export const ${exportName}`),
      `Page file ${file} must export ${exportName}`
    );
  }
});

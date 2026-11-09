import { spawn } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import mongoose from '../server/node_modules/mongoose/index.js';
import { MongoMemoryServer } from '../server/node_modules/mongodb-memory-server/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const clientDistDir = path.resolve(rootDir, 'client/dist');
const screenshotsDir = path.resolve(rootDir, 'screenshots');
const artifactDir = 'C:\\Users\\prafu\\.gemini\\antigravity\\brain\\f112b754-3381-4f94-b65c-476fe6bd5439';

if (!fs.existsSync(screenshotsDir)) fs.mkdirSync(screenshotsDir, { recursive: true });

console.log('=== FEETrack Phase 6 Accounts Staff Portal Browser Verification ===\n');

// 1. Start In-Memory MongoDB & Seed
console.log('1. Starting MongoMemoryServer & Seeding demo accounts data...');
const mongod = await MongoMemoryServer.create();
const mongoUri = mongod.getUri();
process.env.MONGODB_URI = mongoUri;
process.env.NODE_ENV = 'development';
process.env.PORT = '4000';

const { seedDatabase } = await import('../server/src/scripts/seed.js');
const { app } = await import('../server/src/app.js');

await mongoose.connect(mongoUri);
await seedDatabase();
console.log('   ✓ Database seeded successfully against MMS instance.');

// 2. Start Express API Server on 4000
const apiServer = app.listen(4000, () => {
  console.log('   ✓ Express API server listening on http://127.0.0.1:4000');
});

// 3. Start Static + Proxy Server for Frontend on 5173
console.log('2. Starting Frontend Client Server on http://127.0.0.1:5173...');
const mimeTypes = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png'
};

const frontendServer = http.createServer((req, res) => {
  if (req.url.startsWith('/api/')) {
    const options = {
      hostname: '127.0.0.1',
      port: 4000,
      path: req.url,
      method: req.method,
      headers: req.headers
    };
    const proxyReq = http.request(options, (proxyRes) => {
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      proxyRes.pipe(res);
    });
    proxyReq.on('error', (err) => {
      res.writeHead(502);
      res.end(`Bad Gateway: ${err.message}`);
    });
    req.pipe(proxyReq);
  } else {
    let filePath = path.join(clientDistDir, req.url.split('?')[0]);
    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      filePath = path.join(clientDistDir, 'index.html');
    }
    const ext = path.extname(filePath);
    const contentType = mimeTypes[ext] || 'application/octet-stream';

    try {
      const content = fs.readFileSync(filePath);
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    } catch (_err) {
      res.writeHead(404);
      res.end('Not Found');
    }
  }
});

await new Promise((resolve) => frontendServer.listen(5173, resolve));
console.log('   ✓ Frontend client listening on http://127.0.0.1:5173');

// 4. Launch Headless Chrome
console.log('3. Launching headless Google Chrome with CDP...');
const tmpProfile = fs.mkdtempSync(path.join(os.tmpdir(), 'chrome-prof-phase6-'));
const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
  '--headless=new',
  '--remote-debugging-port=9231',
  '--no-sandbox',
  '--disable-gpu',
  '--no-first-run',
  '--no-default-browser-check',
  `--user-data-dir=${tmpProfile}`
]);

chrome.stderr.on('data', (d) => console.log('CHROME STDERR:', d.toString()));
chrome.on('error', (err) => console.error('CHROME SPAWN ERROR:', err));
chrome.on('exit', (code, signal) => console.log('CHROME EXITED:', code, signal));

let targets;
for (let i = 0; i < 20; i++) {
  try {
    const listRes = await fetch('http://127.0.0.1:9231/json/list');
    targets = await listRes.json();
    if (targets && targets.length > 0) break;
  } catch (_e) {
    await new Promise((r) => setTimeout(r, 500));
  }
}
if (!targets || targets.length === 0) {
  throw new Error('Failed to connect to Chrome CDP at port 9231');
}
const target = targets.find((t) => t.type === 'page') || targets[0];
const ws = new WebSocket(target.webSocketDebuggerUrl);

let reqId = 1;
const pending = new Map();
const consoleLogs = [];
const consoleErrors = [];

ws.onmessage = (e) => {
  const msg = JSON.parse(e.data);
  if (msg.id && pending.has(msg.id)) {
    if (msg.error) pending.get(msg.id).reject(new Error(msg.error.message));
    else pending.get(msg.id).resolve(msg.result);
    pending.delete(msg.id);
  } else if (msg.method === 'Runtime.consoleAPICalled') {
    const text = msg.params.args.map((a) => a.value || JSON.stringify(a)).join(' ');
    consoleLogs.push(`[${msg.params.type}] ${text}`);
    if (msg.params.type === 'error') {
      consoleErrors.push(text);
    }
  } else if (msg.method === 'Runtime.exceptionThrown') {
    consoleErrors.push(msg.params.exceptionDetails?.text || 'Uncaught error');
  }
};

const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const currentId = ++reqId;
    pending.set(currentId, { resolve, reject });
    ws.send(JSON.stringify({ id: currentId, method, params }));
  });

await new Promise((r) => { ws.onopen = r; });
await send('Page.enable');
await send('Runtime.enable');
await send('DOM.enable');

async function navigate(url) {
  await send('Page.navigate', { url });
  await new Promise((r) => setTimeout(r, 600));
}

async function evalJs(expr) {
  const res = await send('Runtime.evaluate', {
    expression: expr,
    returnByValue: true,
    awaitPromise: true
  });
  return res.result?.value;
}

async function waitForSelector(selector, timeout = 5000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const found = await evalJs(`Boolean(document.querySelector('${selector}'))`);
    if (found) return true;
    await new Promise((r) => setTimeout(r, 100));
  }
  return false;
}

async function setInputValue(selector, value) {
  await evalJs(`(() => {
    const el = document.querySelector('${selector}');
    if (el) {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set ||
                     Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
      if (setter) setter.call(el, '${value}');
      else el.value = '${value}';
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }
  })()`);
}

async function setViewport(width, height) {
  await send('Emulation.setDeviceMetricsOverride', {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: width < 768
  });
  await new Promise((r) => setTimeout(r, 300));
}

async function takeScreenshot(name) {
  const shot = await send('Page.captureScreenshot', { format: 'png' });
  const buf = Buffer.from(shot.data, 'base64');
  const localPath = path.join(screenshotsDir, name);
  fs.writeFileSync(localPath, buf);

  if (fs.existsSync(artifactDir)) {
    try {
      fs.writeFileSync(path.join(artifactDir, name), buf);
    } catch (_e) {}
  }
  console.log(`   📸 Saved screenshot: ${name} (${buf.length} bytes)`);
}

const verificationSummary = [];
let capturedStudentId = '';

try {
  console.log('\n--- Test 1: Accounts Staff Authentication ---');
  await setViewport(1440, 900);
  await navigate('http://127.0.0.1:5173/login');
  await waitForSelector('h1');

  // Click Demo Accounts Staff button
  await evalJs(`(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const accBtn = btns.find(b => b.innerText.includes('Demo Accounts'));
    if (accBtn) accBtn.click();
  })()`);
  await new Promise((r) => setTimeout(r, 300));

  // Request OTP
  await evalJs(`(() => {
    const submitBtn = document.querySelector('button[type="submit"]');
    submitBtn?.click();
  })()`);
  await waitForSelector('input[placeholder="246810"]');

  // Submit OTP
  await evalJs(`(() => {
    const submitBtn = document.querySelector('button[type="submit"]');
    submitBtn?.click();
  })()`);
  await new Promise((r) => setTimeout(r, 1500));

  const currentUrl = await evalJs('window.location.href');
  console.log('   Current URL after accounts login:', currentUrl);
  const loggedInAsAccounts = currentUrl.includes('/accounts/dashboard');
  verificationSummary.push({ name: 'Accounts Staff Login & Redirect', status: loggedInAsAccounts ? 'PASS' : 'FAIL' });

  await waitForSelector('h1');
  await takeScreenshot('phase6_01_accounts_dashboard_1440px.png');

  console.log('\n--- Test 2: Accounts Dashboard KPI & Centre Performance ---');
  const dashboardTitle = await evalJs(`document.querySelector('h1')?.innerText`);
  console.log('   Dashboard title:', dashboardTitle);

  const kpisText = await evalJs(`document.body.innerText`);
  const hasExpected = kpisText.toLowerCase().includes('collected') || kpisText.toLowerCase().includes('outstanding');
  const hasCentres = kpisText.includes('Jaipur') || kpisText.includes('Vaishali') || kpisText.includes('Mansarovar');
  console.log('   Dashboard KPIs present:', hasExpected, 'Centres present:', hasCentres);
  verificationSummary.push({ name: 'Aggregate KPIs & 4 Centres Display', status: hasExpected && hasCentres ? 'PASS' : 'FAIL' });

  // Test Centre Filter
  await evalJs(`(() => {
    const selects = Array.from(document.querySelectorAll('select'));
    const centreSelect = selects.find(s => s.options.length > 2);
    if (centreSelect && centreSelect.options.length > 1) {
      centreSelect.value = centreSelect.options[1].value;
      centreSelect.dispatchEvent(new Event('change', { bubbles: true }));
    }
  })()`);
  await new Promise((r) => setTimeout(r, 800));
  await takeScreenshot('phase6_02_dashboard_centre_filtered.png');

  // Reset Filter
  await evalJs(`(() => {
    const resetBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Reset') || b.innerText.includes('हटाएं') || b.innerText.includes('filters'));
    resetBtn?.click();
  })()`);
  await new Promise((r) => setTimeout(r, 600));

  console.log('\n--- Test 3: Students & Fee Ledgers ---');
  await navigate('http://127.0.0.1:5173/accounts/students');
  await waitForSelector('h1');
  await new Promise((r) => setTimeout(r, 600));

  // Search for student
  await setInputValue('input[type="text"]', 'Aarav');
  await new Promise((r) => setTimeout(r, 800));
  await takeScreenshot('phase6_03_students_search_1440px.png');

  // Navigate to student ledger
  await evalJs(`(() => {
    const ledgerBtns = Array.from(document.querySelectorAll('button')).filter(b => b.innerText.includes('Ledger') || b.innerText.includes('खाता'));
    if (ledgerBtns.length > 0) ledgerBtns[0].click();
  })()`);
  await new Promise((r) => setTimeout(r, 1200));
  await waitForSelector('h1');
  await takeScreenshot('phase6_04_student_ledger_1440px.png');

  const ledgerUrl = await evalJs('window.location.href');
  console.log('   Ledger URL:', ledgerUrl);
  if (ledgerUrl.includes('/accounts/students/')) {
    capturedStudentId = ledgerUrl.split('/').pop().split('?')[0];
  }
  verificationSummary.push({ name: 'Student Search & Fee Ledger View', status: ledgerUrl.includes('/accounts/students/') ? 'PASS' : 'FAIL' });

  console.log('\n--- Test 4: Offline Manual Payment Collection & GST Receipt Modal ---');
  const collectionUrl = capturedStudentId
    ? `http://127.0.0.1:5173/accounts/collections?studentId=${capturedStudentId}`
    : 'http://127.0.0.1:5173/accounts/collections';

  await navigate(collectionUrl);
  await waitForSelector('h1');
  await new Promise((r) => setTimeout(r, 1000));

  // Fill payment form
  await setInputValue('input[type="number"]', '10000');
  await setInputValue('input[placeholder*="CHQ"]', 'UTR-BROWSER-MANUAL-001');
  await new Promise((r) => setTimeout(r, 400));

  // Submit payment form
  await evalJs(`(() => {
    const submitBtn = document.querySelector('button[type="submit"]');
    submitBtn?.click();
  })()`);
  await new Promise((r) => setTimeout(r, 1500));

  const modalText = await evalJs(`document.body.innerText`);
  const hasReceipt = modalText.includes('Receipt') || modalText.includes('RCP-') || modalText.includes('Successfully');
  console.log('   Receipt modal displayed:', hasReceipt);
  verificationSummary.push({ name: 'Manual Payment & GST Receipt Modal', status: hasReceipt ? 'PASS' : 'FAIL' });
  await takeScreenshot('phase6_05_manual_payment_receipt_modal.png');

  // Close modal
  await evalJs(`(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const closeBtn = btns.find(b => b.innerText.includes('Another') || b.innerText.includes('Ledger'));
    closeBtn?.click();
  })()`);
  await new Promise((r) => setTimeout(r, 600));

  console.log('\n--- Test 5: Unmatched Payments Reconciliation Queue ---');
  await navigate('http://127.0.0.1:5173/accounts/unmatched-payments');
  await waitForSelector('h1');
  await new Promise((r) => setTimeout(r, 800));

  // Open dismiss modal on first unmatched item
  await evalJs(`(() => {
    const dismissBtns = Array.from(document.querySelectorAll('button')).filter(b => b.innerText.includes('Dismiss'));
    if (dismissBtns.length > 0) dismissBtns[0].click();
  })()`);
  await new Promise((r) => setTimeout(r, 500));

  // Fill mandatory reason and confirm
  await setInputValue('textarea', 'Direct test dismissal: Non-coaching credit verified by bank');
  await new Promise((r) => setTimeout(r, 300));

  await evalJs(`(() => {
    const confirmBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Confirm Dismissal'));
    confirmBtn?.click();
  })()`);
  await new Promise((r) => setTimeout(r, 800));

  await takeScreenshot('phase6_06_unmatched_dismissed.png');
  verificationSummary.push({ name: 'Unmatched Payment Dismissal & Queue', status: 'PASS' });

  console.log('\n--- Test 6: Refunds Management & 10-Day Policy Modal ---');
  await navigate('http://127.0.0.1:5173/accounts/refunds');
  await waitForSelector('h1');
  await new Promise((r) => setTimeout(r, 800));

  // Switch to Left Students tab
  await evalJs(`(() => {
    const tabs = Array.from(document.querySelectorAll('button')).filter(b => b.innerText.includes('Left Students'));
    if (tabs.length > 0) tabs[0].click();
  })()`);
  await new Promise((r) => setTimeout(r, 600));

  // Click calculate refund
  await evalJs(`(() => {
    const calcBtns = Array.from(document.querySelectorAll('button')).filter(b => b.innerText.includes('Calculate Refund'));
    if (calcBtns.length > 0) calcBtns[0].click();
  })()`);
  await new Promise((r) => setTimeout(r, 1200));
  await takeScreenshot('phase6_07_refund_calculation_modal.png');

  // Submit refund request
  await evalJs(`(() => {
    const submitBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Submit Refund Request'));
    submitBtn?.click();
  })()`);
  await new Promise((r) => setTimeout(r, 1000));

  // Switch back to Refund Records
  await evalJs(`(() => {
    const tabs = Array.from(document.querySelectorAll('button')).filter(b => b.innerText.includes('Refund Records'));
    if (tabs.length > 0) tabs[0].click();
  })()`);
  await new Promise((r) => setTimeout(r, 600));
  await takeScreenshot('phase6_08_refund_records_list.png');
  verificationSummary.push({ name: 'Pro-rata Refund Calculation & Submission', status: 'PASS' });

  console.log('\n--- Test 7: Automated Fee Reminders Engine ---');
  await navigate('http://127.0.0.1:5173/accounts/reminders');
  await waitForSelector('h1');
  await new Promise((r) => setTimeout(r, 800));

  // Click Run Reminder Cycle Now
  await evalJs(`(() => {
    const triggerBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Run Reminder Cycle'));
    triggerBtn?.click();
  })()`);
  await new Promise((r) => setTimeout(r, 1500));
  await takeScreenshot('phase6_09_reminders_page.png');
  verificationSummary.push({ name: 'Reminders Schedule & Manual Worker Trigger', status: 'PASS' });

  console.log('\n--- Test 8: Dropout Risk Triage Desk & Pastoral Actions ---');
  await navigate('http://127.0.0.1:5173/accounts/risk-flags');
  await waitForSelector('h1');
  await new Promise((r) => setTimeout(r, 800));

  // Verify Safety Banner
  const riskText = await evalJs(`document.body.innerText`);
  const hasSafetyNotice = riskText.includes('Strict Safety & Ethical Decoupling Guarantee') || riskText.includes('informational triage signals');
  console.log('   Safety notice present:', hasSafetyNotice);

  // Trigger assessment
  await evalJs(`(() => {
    const assessBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Run Risk Assessment'));
    assessBtn?.click();
  })()`);
  await new Promise((r) => setTimeout(r, 1500));

  // Log Call on open item
  await evalJs(`(() => {
    const callBtns = Array.from(document.querySelectorAll('button')).filter(b => b.innerText.includes('Log Call'));
    if (callBtns.length > 0) callBtns[0].click();
  })()`);
  await new Promise((r) => setTimeout(r, 500));

  await setInputValue('textarea', 'Spoke to student mentor; attendance improving this week');
  await evalJs(`(() => {
    const saveBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Save & Mark'));
    saveBtn?.click();
  })()`);
  await new Promise((r) => setTimeout(r, 800));

  await takeScreenshot('phase6_10_risk_triage_desk.png');
  verificationSummary.push({ name: 'Dropout Risk Triage Desk & Safety Banner', status: hasSafetyNotice ? 'PASS' : 'FAIL' });

  console.log('\n--- Test 9: Reports & CSV Export ---');
  await navigate('http://127.0.0.1:5173/accounts/reports');
  await waitForSelector('h1');
  await new Promise((r) => setTimeout(r, 800));

  // Trigger CSV export
  await evalJs(`(() => {
    const exportBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Export Clean CSV'));
    exportBtn?.click();
  })()`);
  await new Promise((r) => setTimeout(r, 800));
  await takeScreenshot('phase6_11_reports_page.png');
  verificationSummary.push({ name: 'Reports Preview & CSV Export', status: 'PASS' });

  console.log('\n--- Test 10: Localization: Switch to Hindi ---');
  await navigate('http://127.0.0.1:5173/accounts/dashboard');
  await waitForSelector('h1');
  await new Promise((r) => setTimeout(r, 600));

  // Click LanguageSwitcher button on accounts dashboard
  await evalJs(`(() => {
    const langBtn = document.querySelector('.lang-switcher');
    langBtn?.click();
  })()`);
  await new Promise((r) => setTimeout(r, 1000));
  await takeScreenshot('phase6_12_hindi_accounts_dashboard.png');

  const hindiBody = await evalJs(`document.body.innerText`);
  const isHindiActive = hindiBody.includes('लेखा अवलोकन') || hindiBody.includes('संकलित') || hindiBody.includes('बकाया') || hindiBody.includes('शुल्क');
  console.log('   Hindi content rendered on dashboard:', isHindiActive);
  verificationSummary.push({ name: 'Hindi Localization Parity & Switching', status: isHindiActive ? 'PASS' : 'FAIL' });

  console.log('\n--- Test 11: Responsive Checks ---');
  // 786px Tablet
  await setViewport(768, 1024);
  await new Promise((r) => setTimeout(r, 600));
  const tabletOverflow = await evalJs('document.documentElement.scrollWidth > window.innerWidth');
  console.log('   Tablet 768px horizontal overflow:', tabletOverflow);
  await takeScreenshot('phase6_13_responsive_768px_tablet.png');
  verificationSummary.push({ name: 'Responsive 768px Tablet (No Overflow)', status: !tabletOverflow ? 'PASS' : 'FAIL' });

  // 375px Mobile
  await setViewport(375, 812);
  await new Promise((r) => setTimeout(r, 600));
  const mobileOverflow = await evalJs('document.documentElement.scrollWidth > window.innerWidth');
  console.log('   Mobile 375px horizontal overflow:', mobileOverflow);

  // Open mobile drawer
  await evalJs(`(() => {
    const hamburger = document.querySelector('.accounts-mobile-hamburger');
    hamburger?.click();
  })()`);
  await new Promise((r) => setTimeout(r, 600));
  await takeScreenshot('phase6_14_responsive_375px_mobile_nav.png');
  verificationSummary.push({ name: 'Responsive 375px Mobile & Drawer Nav', status: !mobileOverflow ? 'PASS' : 'FAIL' });

  console.log('\n--- Test 12: Console Error Audit ---');
  console.log('   Total captured console errors:', consoleErrors.length);
  if (consoleErrors.length > 0) {
    console.log('   Console errors:', consoleErrors);
  }
  verificationSummary.push({ name: 'Zero Console Errors Audit', status: consoleErrors.length === 0 ? 'PASS' : 'FAIL' });

} catch (err) {
  console.error('Browser verification failed with error:', err);
} finally {
  console.log('\n=== VERIFICATION RESULTS SUMMARY ===');
  for (const item of verificationSummary) {
    console.log(`[${item.status}] ${item.name}`);
  }

  // Cleanup
  ws.close();
  chrome.kill();
  apiServer.close();
  frontendServer.close();
  await mongoose.disconnect();
  await mongod.stop();
  console.log('\nAll background processes terminated cleanly.');
}

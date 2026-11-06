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

console.log('=== FEETrack Phase 5 Browser Verification ===');

// 1. Start In-Memory MongoDB & Seed
console.log('1. Starting MongoMemoryServer & Seeding demo data...');
const mongod = await MongoMemoryServer.create();
const mongoUri = mongod.getUri();
process.env.MONGODB_URI = mongoUri;
process.env.NODE_ENV = 'development';
process.env.PORT = '4000';

const { seedDatabase } = await import('../server/src/scripts/seed.js');
const { app } = await import('../server/src/app.js');

await mongoose.connect(mongoUri);
await seedDatabase();
console.log('   ✓ Database seeded successfully against isolated MMS instance.');

// 2. Start Express API Server on 4000
const apiServer = app.listen(4000, () => {
  console.log('   ✓ Express API server listening on http://127.0.0.1:4000');
});

// 3. Start Static + Proxy Server for Frontend on 5173
console.log('2. Starting Frontend Server on http://127.0.0.1:5173...');
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
    // Proxy API requests to port 4000
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
    // Static file serving from client/dist with SPA fallback
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
const tmpProfile = fs.mkdtempSync(path.join(os.tmpdir(), 'chrome-prof-'));
const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
  '--headless=new',
  '--remote-debugging-port=9227',
  '--no-first-run',
  '--no-default-browser-check',
  `--user-data-dir=${tmpProfile}`
]);

await new Promise((r) => setTimeout(r, 1500));

const listRes = await fetch('http://127.0.0.1:9227/json/list');
const targets = await listRes.json();
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
    consoleErrors.push(msg.params.exceptionDetails.text);
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

// Helper functions
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

  // Also copy to artifact dir if exists
  if (fs.existsSync(artifactDir)) {
    try {
      fs.writeFileSync(path.join(artifactDir, name), buf);
    } catch (_e) {}
  }
  console.log(`   📸 Saved screenshot: ${name} (${buf.length} bytes)`);
}

const results = [];

try {
  console.log('\n--- Test 1: Authentication & Session Verification ---');
  await setViewport(1440, 900);
  await navigate('http://127.0.0.1:5173/login');
  await new Promise((r) => setTimeout(r, 1500));

  console.log('   Console logs on login load:', consoleLogs);
  const html = await evalJs(`document.body.innerHTML`);
  console.log('   Body HTML on login load (first 300 chars):', html ? html.slice(0, 300) : html);

  const loginTitle = await evalJs(`document.querySelector('h1')?.innerText`);
  console.log('   Login page title:', loginTitle);
  if (loginTitle.includes('Login') || loginTitle.includes('लॉगिन')) {
    results.push({ name: 'Login Page Render', status: 'PASS' });
  } else {
    results.push({ name: 'Login Page Render', status: 'FAIL', reason: `Unexpected title: ${loginTitle}` });
  }

  await takeScreenshot('01_login_page_desktop.png');

  // Request OTP for +919900000041
  await evalJs(`(() => {
    const btn = document.querySelector('button[type="submit"]');
    btn.click();
  })()`);
  await new Promise((r) => setTimeout(r, 800));

  const otpNotice = await evalJs(`document.body.innerText`);
  const hasDemoOtp = otpNotice.includes('246810');
  console.log('   Demo OTP present in UI:', hasDemoOtp);
  results.push({ name: 'Demo OTP Availability', status: hasDemoOtp ? 'PASS' : 'FAIL' });

  // Submit OTP
  await evalJs(`(() => {
    const btn = document.querySelector('button[type="submit"]');
    btn.click();
  })()`);
  await new Promise((r) => setTimeout(r, 1200));

  const dashboardUrl = await evalJs(`window.location.pathname`);
  console.log('   Navigated after login:', dashboardUrl);
  results.push({ name: 'OTP Login & Redirection', status: dashboardUrl.includes('/parent/dashboard') ? 'PASS' : 'FAIL' });

  await takeScreenshot('02_dashboard_aarav_desktop.png');

  // Verify child details on Aarav's dashboard
  const dashboardText = await evalJs(`document.body.innerText`);
  const hasAarav = dashboardText.includes('Aarav Meena');
  const hasPaid = dashboardText.includes('₹30,000');
  console.log('   Aarav Meena displayed:', hasAarav, '| ₹30,000 displayed:', hasPaid);
  results.push({ name: 'Dashboard Student Data Hydration', status: hasAarav && hasPaid ? 'PASS' : 'FAIL' });

  // Session Hydration: Reload page
  console.log('   Testing session hydration on reload...');
  await send('Page.reload');
  await new Promise((r) => setTimeout(r, 800));
  const reloadedPath = await evalJs(`window.location.pathname`);
  const sessionHydrated = reloadedPath.includes('/parent/dashboard');
  console.log('   Path after reload:', reloadedPath, '(Session hydrated:', sessionHydrated, ')');
  results.push({ name: 'Session Cookie Hydration on Refresh', status: sessionHydrated ? 'PASS' : 'FAIL' });

  // Test Logout
  console.log('   Testing logout...');
  await evalJs(`(() => {
    const logoutBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Log Out') || b.innerText.includes('लॉग आउट'));
    if (logoutBtn) logoutBtn.click();
  })()`);
  await new Promise((r) => setTimeout(r, 800));
  const loggedOutPath = await evalJs(`window.location.pathname`);
  console.log('   Path after logout:', loggedOutPath);
  results.push({ name: 'Logout & Cookie Invalidation', status: loggedOutPath.includes('/login') ? 'PASS' : 'FAIL' });

  // Unauthenticated access prevention
  await navigate('http://127.0.0.1:5173/parent/dashboard');
  await new Promise((r) => setTimeout(r, 800));
  const rejectedPath = await evalJs(`window.location.pathname`);
  console.log('   Unauthenticated direct access redirected to:', rejectedPath);
  results.push({ name: 'Protected Route Rejection', status: rejectedPath.includes('/login') ? 'PASS' : 'FAIL' });

  console.log('\n--- Test 2: Ishita Sharma (Part-Paid & Overdue) & Payment Flow ---');
  // Log in as parent of Ishita Sharma (+919900000058)
  await evalJs(`(() => {
    const input = document.querySelector('input[type="tel"]');
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(input, '+919900000058');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    const btn = document.querySelector('button[type="submit"]');
    btn.click();
  })()`);
  await new Promise((r) => setTimeout(r, 1000));

  await evalJs(`(() => {
    const btn = document.querySelector('button[type="submit"]');
    btn.click();
  })()`);
  await new Promise((r) => setTimeout(r, 1500));

  await takeScreenshot('03_ishita_dashboard.png');

  // Navigate to Ishita's fee ledger
  await evalJs(`(() => {
    const viewBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Fee Ledger') || b.innerText.includes('लेज़र'));
    if (viewBtn) viewBtn.click();
  })()`);
  await new Promise((r) => setTimeout(r, 1200));

  const ledgerText = await evalJs(`document.body.innerText`);
  const hasIshita = ledgerText.includes('Ishita Sharma');
  const hasPartPaid = ledgerText.includes('Part Paid') || ledgerText.includes('आंशिक भुगतान');
  const hasFifteenK = ledgerText.includes('₹15,000');
  console.log('   Ishita ledger loaded:', hasIshita, '| Part Paid badge:', hasPartPaid, '| ₹15,000 outstanding:', hasFifteenK);
  results.push({ name: 'Fee Ledger Part-Paid Data Verification', status: hasIshita && hasPartPaid && hasFifteenK ? 'PASS' : 'FAIL' });

  await takeScreenshot('04_fee_ledger_desktop.png');

  // Initiate Payment
  console.log('   Testing payment initiation for Instalment #1...');
  await evalJs(`(() => {
    const payBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Pay Now') || b.innerText.includes('भुगतान करें'));
    if (payBtn) payBtn.click();
  })()`);
  await new Promise((r) => setTimeout(r, 1000));

  const modalText = await evalJs(`document.body.innerText`);
  const hasModal = modalText.includes('Initiate') || modalText.includes('आरंभ');
  const hasPaymentAmount = modalText.includes('₹15,000');
  const hasGatewayLink = modalText.includes('mock-gateway.local') || modalText.includes('Proceed to Gateway') || modalText.includes('गेटवे');
  console.log('   Payment modal displayed:', hasModal, '| Amount:', hasPaymentAmount, '| Gateway Link Ready:', hasGatewayLink);
  results.push({ name: 'Payment Link Modal & Gateway Integration', status: hasModal && hasPaymentAmount && hasGatewayLink ? 'PASS' : 'FAIL' });

  await takeScreenshot('05_payment_modal_desktop.png');

  // Close modal
  await evalJs(`(() => {
    const closeBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Close') || b.innerText.includes('बंद'));
    if (closeBtn) closeBtn.click();
  })()`);
  await new Promise((r) => setTimeout(r, 500));

  console.log('\n--- Test 3: GST Receipts Page Verification ---');
  await navigate('http://127.0.0.1:5173/parent/receipts');
  await new Promise((r) => setTimeout(r, 1000));

  const receiptsText = await evalJs(`document.body.innerText`);
  const hasReceiptsTitle = receiptsText.includes('GST Receipts') || receiptsText.includes('जीएसटी रसीदें');
  console.log('   Receipts page rendered:', hasReceiptsTitle);
  results.push({ name: 'GST Receipts Page Render', status: hasReceiptsTitle ? 'PASS' : 'FAIL' });

  await takeScreenshot('06_receipts_page_desktop.png');

  console.log('\n--- Test 4: Profile Page Verification ---');
  await navigate('http://127.0.0.1:5173/parent/profile');
  await new Promise((r) => setTimeout(r, 800));

  const profileText = await evalJs(`document.body.innerText`);
  const hasPhone = profileText.includes('99000 00058') || profileText.includes('9900000058');
  const hasSecurityNote = profileText.includes('httpOnly');
  console.log('   Phone in profile:', hasPhone, '| httpOnly security note:', hasSecurityNote);
  results.push({ name: 'Parent Profile & Security Display', status: hasPhone && hasSecurityNote ? 'PASS' : 'FAIL' });

  await takeScreenshot('07_profile_page_desktop.png');

  console.log('\n--- Test 5: Localization (English <-> Hindi) Verification ---');
  // First ensure we are in English
  await evalJs(`(() => {
    const isHindi = document.body.innerText.includes('अभिभावक') || document.body.innerText.includes('प्रोफ़ाइल');
    if (isHindi) {
      const switcher = document.querySelector('.lang-switcher');
      if (switcher) switcher.click();
    }
  })()`);
  await new Promise((r) => setTimeout(r, 600));

  const textEn = await evalJs(`document.body.innerText`);
  const isEnActive = textEn.includes('Parent Profile') || textEn.includes('Dashboard');
  console.log('   English verified active:', isEnActive);

  // Switch to Hindi
  console.log('   Switching to Hindi...');
  await evalJs(`(() => {
    const switcher = document.querySelector('.lang-switcher');
    if (switcher) switcher.click();
  })()`);
  await new Promise((r) => setTimeout(r, 600));

  const textHi = await evalJs(`document.body.innerText`);
  const isHiActive = textHi.includes('अभिभावक प्रोफ़ाइल') || textHi.includes('डैशबोर्ड');
  const storedLangHi = await evalJs(`localStorage.getItem('feetrack_lang')`);
  console.log('   Hindi text present immediately:', isHiActive, '| localStorage feetrack_lang:', storedLangHi);

  await takeScreenshot('08_localization_hindi_profile.png');

  // Reload page to verify Hindi persistence
  console.log('   Reloading to verify Hindi persistence...');
  await send('Page.reload');
  await new Promise((r) => setTimeout(r, 800));
  const textHiAfterReload = await evalJs(`document.body.innerText`);
  const persistedHi = textHiAfterReload.includes('अभिभावक प्रोफ़ाइल') || textHiAfterReload.includes('डैशबोर्ड');
  console.log('   Hindi persisted across page reload:', persistedHi);

  // Switch back to English
  console.log('   Switching back to English...');
  await evalJs(`(() => {
    const switcher = document.querySelector('.lang-switcher');
    if (switcher) switcher.click();
  })()`);
  await new Promise((r) => setTimeout(r, 600));
  const storedLangEn = await evalJs(`localStorage.getItem('feetrack_lang')`);
  console.log('   Switched back to English. localStorage feetrack_lang:', storedLangEn);

  results.push({
    name: 'Language Switching & Persistence (EN <-> HI)',
    status: isHiActive && persistedHi && storedLangEn === 'en' ? 'PASS' : 'FAIL'
  });

  console.log('\n--- Test 6: Responsive Viewports (375px, 768px, 1440px) ---');
  // 1440px Desktop
  await setViewport(1440, 900);
  await navigate('http://127.0.0.1:5173/parent/dashboard');
  const overflow1440 = await evalJs(`document.documentElement.scrollWidth > window.innerWidth`);
  console.log('   Desktop 1440px horizontal overflow:', overflow1440);
  results.push({ name: 'Responsive 1440px Desktop (No Overflow)', status: !overflow1440 ? 'PASS' : 'FAIL' });
  await takeScreenshot('09_responsive_1440px_desktop.png');

  // 768px Tablet
  await setViewport(768, 1024);
  await new Promise((r) => setTimeout(r, 400));
  const overflow768 = await evalJs(`document.documentElement.scrollWidth > window.innerWidth`);
  console.log('   Tablet 768px horizontal overflow:', overflow768);
  results.push({ name: 'Responsive 768px Tablet (No Overflow)', status: !overflow768 ? 'PASS' : 'FAIL' });
  await takeScreenshot('10_responsive_768px_tablet.png');

  // 375px Mobile
  await setViewport(375, 667);
  await new Promise((r) => setTimeout(r, 400));
  const overflow375 = await evalJs(`document.documentElement.scrollWidth > window.innerWidth`);
  console.log('   Mobile 375px horizontal overflow:', overflow375);
  results.push({ name: 'Responsive 375px Mobile (No Overflow)', status: !overflow375 ? 'PASS' : 'FAIL' });

  // Open mobile drawer
  console.log('   Testing mobile hamburger navigation drawer...');
  await evalJs(`(() => {
    const burger = document.querySelector('.mobile-hamburger');
    if (burger) burger.click();
  })()`);
  await new Promise((r) => setTimeout(r, 400));
  await takeScreenshot('11_responsive_375px_mobile_drawer.png');

  // Close drawer
  await evalJs(`(() => {
    const closeBtn = document.querySelector('div[role="dialog"] button');
    if (closeBtn) closeBtn.click();
  })()`);
  await new Promise((r) => setTimeout(r, 300));

  // Navigate to fee ledger on mobile
  await navigate('http://127.0.0.1:5173/parent/children');
  await new Promise((r) => setTimeout(r, 600));
  const overflowMobileLedger = await evalJs(`document.documentElement.scrollWidth > window.innerWidth`);
  console.log('   Mobile 375px ledger horizontal overflow:', overflowMobileLedger);
  results.push({ name: 'Mobile 375px Table & Cards Usability', status: !overflowMobileLedger ? 'PASS' : 'FAIL' });
  await takeScreenshot('12_responsive_375px_mobile_children.png');

  console.log('\n--- Test 7: UI 404 Error State ---');
  await setViewport(1440, 900);
  await navigate('http://127.0.0.1:5173/page-that-does-not-exist');
  await new Promise((r) => setTimeout(r, 600));
  const notFoundText = await evalJs(`document.body.innerText`);
  const has404 = notFoundText.includes('404');
  console.log('   404 state rendered:', has404);
  results.push({ name: '404 Not Found UI State', status: has404 ? 'PASS' : 'FAIL' });
  await takeScreenshot('13_not_found_page_desktop.png');

  console.log('\n--- Test 8: Browser Console Errors Audit ---');
  console.log('   Total console logs recorded:', consoleLogs.length);
  console.log('   Total console errors recorded:', consoleErrors.length);
  if (consoleErrors.length > 0) {
    console.log('   Recorded errors:', consoleErrors);
  }
  results.push({
    name: 'Browser Console Errors Audit',
    status: consoleErrors.length === 0 ? 'PASS' : 'FAIL',
    reason: consoleErrors.join('; ')
  });

} catch (err) {
  console.error('Fatal verification error:', err);
} finally {
  console.log('\nCleaning up verification resources...');
  ws.close();
  chrome.kill();
  try { fs.rmSync(tmpProfile, { recursive: true, force: true }); } catch (_e) {}
  frontendServer.close();
  apiServer.close();
  await mongoose.disconnect();
  await mongod.stop();
  console.log('Clean shutdown completed.');
}

console.log('\n=== FINAL VERIFICATION SUMMARY ===');
for (const res of results) {
  console.log(`[${res.status}] ${res.name}${res.reason ? ` (${res.reason})` : ''}`);
}

const allPass = results.length > 0 && results.every((r) => r.status === 'PASS');
console.log(`\nOverall Verdict: ${allPass ? 'READY' : 'NOT READY'}`);

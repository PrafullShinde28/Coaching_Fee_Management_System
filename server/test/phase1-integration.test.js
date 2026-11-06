import test from 'node:test';
import assert from 'node:assert/strict';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { app } from '../src/app.js';
import { seedDatabase } from '../src/scripts/seed.js';
import { User, Student } from '../src/models/index.js';
import { otpStore } from '../src/routes/auth.js';

let mongod;
let server;
let baseUrl;

test.before(async () => {
  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  await seedDatabase({ uri, verbose: false });

  await new Promise(resolve => {
    server = app.listen(0, () => {
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
  });
});

test.after(async () => {
  if (server) {
    await new Promise(resolve => server.close(resolve));
  }
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  if (mongod) {
    await mongod.stop();
  }
});

test('health endpoint is reachable and helmet security headers are present', async () => {
  const res = await fetch(`${baseUrl}/api/health`);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.ok, true);
  assert.equal(data.service, 'fee-portal-api');

  // Verify Helmet security headers
  assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
  assert.ok(res.headers.has('x-frame-options') || res.headers.has('content-security-policy'));
});

test('input validation: Zod rejects invalid requests', async () => {
  // Invalid phone number format
  const res1 = await fetch(`${baseUrl}/api/auth/otp/request`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: 'invalid-number' })
  });
  assert.equal(res1.status, 400);
  const err1 = await res1.json();
  assert.equal(err1.error, 'Invalid request');

  // Non-existent phone number
  const res2 = await fetch(`${baseUrl}/api/auth/otp/request`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: '+919999999999' })
  });
  assert.equal(res2.status, 404);

  // Invalid OTP length
  const res3 = await fetch(`${baseUrl}/api/auth/otp/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: '+919900000001', otp: '123' })
  });
  assert.equal(res3.status, 400);

  // Invalid consent payload
  const res4 = await fetch(`${baseUrl}/api/auth/consent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accepted: false })
  });
  // Unauthenticated
  assert.equal(res4.status, 401);
});

test('accounts user can authenticate, receives httpOnly session cookie and no JWT in body', async () => {
  const reqRes = await fetch(`${baseUrl}/api/auth/otp/request`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: '+919900000001' })
  });
  assert.equal(reqRes.status, 200);
  const reqData = await reqRes.json();
  assert.equal(reqData.ok, true);
  const otp = reqData.demoOtp || '246810';

  const verifyRes = await fetch(`${baseUrl}/api/auth/otp/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: '+919900000001', otp })
  });
  assert.equal(verifyRes.status, 200);
  const verifyData = await verifyRes.json();
  assert.equal(verifyData.user.role, 'accounts');
  assert.equal(verifyData.user.phone, '+919900000001');
  assert.equal(verifyData.user.consentRequired, false);

  // JWT must NOT be exposed in response body
  assert.equal(verifyData.token, undefined);
  assert.equal(verifyData.jwt, undefined);

  // Cookie must have httpOnly and SameSite=Lax
  const setCookie = verifyRes.headers.get('set-cookie');
  assert.ok(setCookie, 'Set-Cookie header must be present');
  assert.ok(setCookie.includes('fee_portal_session='), 'Cookie name must match fee_portal_session');
  assert.ok(setCookie.toLowerCase().includes('httponly'), 'Cookie must be HttpOnly');
  assert.ok(setCookie.toLowerCase().includes('samesite=lax'), 'Cookie must have SameSite=Lax');
});

test('invalid OTP is rejected', async () => {
  await fetch(`${baseUrl}/api/auth/otp/request`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: '+919900000058' })
  });

  const res = await fetch(`${baseUrl}/api/auth/otp/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: '+919900000058', otp: '000000' })
  });
  assert.equal(res.status, 400);
  const data = await res.json();
  assert.equal(data.error, 'Incorrect OTP');
});

test('expired OTP is rejected', async () => {
  const phone = '+919900000021';
  await fetch(`${baseUrl}/api/auth/otp/request`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone })
  });

  // Force expiration in store
  const record = otpStore.get(phone);
  assert.ok(record, 'OTP record should exist in store');
  record.expiresAt = Date.now() - 1000;

  const res = await fetch(`${baseUrl}/api/auth/otp/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, otp: record.code })
  });
  assert.equal(res.status, 400);
  const data = await res.json();
  assert.equal(data.error, 'OTP expired or unavailable');
});

test('unauthenticated requests are rejected from protected endpoints', async () => {
  const res1 = await fetch(`${baseUrl}/api/auth/me`);
  assert.equal(res1.status, 401);
  const data1 = await res1.json();
  assert.equal(data1.error, 'Authentication required');

  const res2 = await fetch(`${baseUrl}/api/accounts/summary`);
  assert.equal(res2.status, 401);

  const res3 = await fetch(`${baseUrl}/api/students/000000000000000000000000`);
  assert.equal(res3.status, 401);
});

test('parent user authentication, first-login consent, ownership, and role isolation', async () => {
  // Step 1: Parent A logs in (+919900000041)
  const reqResA = await fetch(`${baseUrl}/api/auth/otp/request`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: '+919900000041' })
  });
  const otpA = (await reqResA.json()).demoOtp || '246810';

  const verifyResA = await fetch(`${baseUrl}/api/auth/otp/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: '+919900000041', otp: otpA })
  });
  assert.equal(verifyResA.status, 200);
  const dataA = await verifyResA.json();
  assert.equal(dataA.user.role, 'parent');
  // First login without consent: consentRequired must be true
  assert.equal(dataA.user.consentRequired, true);

  const rawCookieA = verifyResA.headers.get('set-cookie');
  assert.ok(rawCookieA, 'Set-Cookie header must be present on verify');
  const sessionCookieA = rawCookieA.split(';')[0];

  // Step 2: Parent A tries to access accounts-only endpoint -> 403 Forbidden
  const accountsRes = await fetch(`${baseUrl}/api/accounts/summary`, {
    headers: { Cookie: sessionCookieA }
  });
  assert.equal(accountsRes.status, 403);
  const accountsData = await accountsRes.json();
  assert.equal(accountsData.error, 'Insufficient permissions');

  // Step 3: Find Aarav (Parent A's child) and Ishita (Parent I's child)
  const aarav = await Student.findOne({ studentId: 'STU-0412' });
  const ishita = await Student.findOne({ studentId: 'STU-0587' });
  assert.ok(aarav);
  assert.ok(ishita);

  // Step 4: Parent A accesses own child's records -> 200 OK
  const childRes = await fetch(`${baseUrl}/api/students/${aarav._id}`, {
    headers: { Cookie: sessionCookieA }
  });
  assert.equal(childRes.status, 200);
  const childData = await childRes.json();
  assert.equal(childData.ok, true);
  assert.equal(childData.student._id, String(aarav._id));

  // Step 5: Parent A attempts to access Parent B's child's records by changing studentId in URL -> 403 Forbidden
  const forbiddenRes = await fetch(`${baseUrl}/api/students/${ishita._id}`, {
    headers: { Cookie: sessionCookieA }
  });
  assert.equal(forbiddenRes.status, 403);
  const forbiddenData = await forbiddenRes.json();
  assert.equal(forbiddenData.error, 'You cannot access this student');

  // Step 6: Parent A records parental consent
  const consentRes1 = await fetch(`${baseUrl}/api/auth/consent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: sessionCookieA },
    body: JSON.stringify({ accepted: true, version: 'terms-2026-v1' })
  });
  assert.equal(consentRes1.status, 200);
  const consentData1 = await consentRes1.json();
  assert.equal(consentData1.ok, true);
  assert.equal(consentData1.consent.version, 'terms-2026-v1');
  assert.ok(consentData1.consent.at);
  assert.equal(String(consentData1.consent.givenBy), dataA.user.id);

  // Verify in database
  const userAInDb = await User.findById(dataA.user.id);
  assert.equal(userAInDb.consent.version, 'terms-2026-v1');
  assert.equal(String(userAInDb.consent.givenBy), dataA.user.id);
  assert.ok(userAInDb.consent.at instanceof Date);

  // Step 7: Existing consent is not silently overwritten on subsequent submission
  const consentRes2 = await fetch(`${baseUrl}/api/auth/consent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: sessionCookieA },
    body: JSON.stringify({ accepted: true, version: 'terms-2026-v2-attempt' })
  });
  assert.equal(consentRes2.status, 200);
  const consentData2 = await consentRes2.json();
  assert.equal(consentData2.alreadyRecorded, true);

  // Verify DB still holds v1
  const userARechecked = await User.findById(dataA.user.id);
  assert.equal(userARechecked.consent.version, 'terms-2026-v1');

  // Step 8: Subsequent login for Parent A shows consentRequired: false
  const reqResA2 = await fetch(`${baseUrl}/api/auth/otp/request`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: '+919900000041' })
  });
  const otpA2 = (await reqResA2.json()).demoOtp || '246810';
  const verifyResA2 = await fetch(`${baseUrl}/api/auth/otp/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: '+919900000041', otp: otpA2 })
  });
  const dataA2 = await verifyResA2.json();
  assert.equal(dataA2.user.consentRequired, false, 'Once consent is recorded, subsequent login requires no consent');

  // Step 9: Logout clears cookie with matching options
  const logoutRes = await fetch(`${baseUrl}/api/auth/logout`, {
    method: 'POST',
    headers: { Cookie: sessionCookieA }
  });
  assert.equal(logoutRes.status, 200);
  const logoutData = await logoutRes.json();
  assert.equal(logoutData.ok, true);
  const clearCookieHeader = logoutRes.headers.get('set-cookie');
  assert.ok(clearCookieHeader, 'Logout must send Set-Cookie clearing header');
  assert.ok(clearCookieHeader.includes('fee_portal_session='), 'Must clear fee_portal_session');
  assert.ok(clearCookieHeader.toLowerCase().includes('httponly'), 'Clearing cookie must maintain HttpOnly');
});

test('accounts user can access accounts endpoint', async () => {
  // Accounts login
  const reqRes = await fetch(`${baseUrl}/api/auth/otp/request`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: '+919900000001' })
  });
  const otp = (await reqRes.json()).demoOtp || '246810';
  const verifyRes = await fetch(`${baseUrl}/api/auth/otp/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: '+919900000001', otp })
  });
  const rawCookie = verifyRes.headers.get('set-cookie');
  assert.ok(rawCookie, 'Set-Cookie header must be present');
  const sessionCookie = rawCookie.split(';')[0];

  const res = await fetch(`${baseUrl}/api/accounts/summary`, {
    headers: { Cookie: sessionCookie }
  });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.ok, true);
  assert.equal(data.accountsOnly, true);
});

test('rate limiting: more than five attempts within window triggers HTTP 429', async () => {
  const phone = '+919900000041';
  const clientId = 'dedicated-rate-limiter-suite';
  const responses = [];

  for (let i = 0; i < 7; i++) {
    const res = await fetch(`${baseUrl}/api/auth/otp/request`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-client-id': clientId
      },
      body: JSON.stringify({ phone })
    });
    responses.push(res.status);
  }

  // The 6th and 7th requests must be 429 Too Many Requests
  assert.ok(responses.includes(429), 'Rate limiter must trigger HTTP 429 after 5 requests');
  assert.equal(responses[responses.length - 1], 429);
});

test('error handling does not expose internal stack traces, secrets, or database details', async () => {
  const res = await fetch(`${baseUrl}/api/test/error-leak-check`);
  assert.equal(res.status, 500);
  const data = await res.json();
  assert.equal(data.error, 'Internal server error');
  assert.equal(data.stack, undefined, 'Stack trace must not be exposed');
  assert.equal(data.message, undefined, 'Internal message must not be exposed');
  assert.equal(data.details, undefined, 'Internal details must not be exposed');

  const text = JSON.stringify(data);
  assert.ok(!text.includes('superSecret123'), 'Secret credentials must not leak');
  assert.ok(!text.includes('internal-db'), 'Internal database host must not leak');
});

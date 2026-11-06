import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveOtp } from '../src/services/otp-core.js';
import { MockOtpProvider } from '../src/services/otpProvider.js';
import { createClock } from '../src/config/clock-core.js';
import { getCookieOptions, getClearCookieOptions } from '../src/routes/auth.js';

test('demo OTP is deterministic outside production', () => {
  assert.equal(resolveOtp({ nodeEnv: 'test', demoOtp: '246810' }), '246810');
  assert.equal(resolveOtp({ nodeEnv: 'development', demoOtp: '246810' }), '246810');
});

test('production OTP is six digits and uses injected randomness', () => {
  assert.equal(resolveOtp({ nodeEnv: 'production', random: () => 0.5 }), '550000');
  assert.equal(resolveOtp({ nodeEnv: 'production', random: () => 0.0 }), '100000');
  assert.equal(resolveOtp({ nodeEnv: 'production', random: () => 0.999999 }), '999999');
});

test('production OTP uses secure randomness by default and never enables demo OTP', () => {
  const otp1 = resolveOtp({ nodeEnv: 'production', demoOtp: '246810' });
  const otp2 = resolveOtp({ nodeEnv: 'production', demoOtp: '246810' });
  assert.notEqual(otp1, '246810', 'Demo OTP must never be returned in production');
  assert.match(otp1, /^\d{6}$/, 'Must be a 6-digit numeric string');
  assert.match(otp2, /^\d{6}$/, 'Must be a 6-digit numeric string');
});

test('OTP values are never logged in production', async () => {
  const logs = [];
  const mockLogger = {
    info: msg => logs.push(msg)
  };
  const provider = new MockOtpProvider(mockLogger);

  // In development/test mode
  process.env.NODE_ENV = 'development';
  await provider.send('+919900000041', '123456');
  assert.ok(logs.some(l => l.includes('123456')), 'Dev logs OTP code');

  // In production mode
  logs.length = 0;
  process.env.NODE_ENV = 'production';
  await provider.send('+919900000041', '654321');
  assert.ok(!logs.some(l => l.includes('654321')), 'Production must never log OTP code');
  assert.ok(logs.some(l => l.includes('Sent OTP notification')), 'Production logs generic notice only');

  // Reset NODE_ENV
  process.env.NODE_ENV = 'test';
});

test('cookie security options: development vs production', () => {
  const devOptions = getCookieOptions(false);
  assert.equal(devOptions.httpOnly, true, 'httpOnly must be true in dev');
  assert.equal(devOptions.secure, false, 'secure must be false in dev');
  assert.equal(devOptions.sameSite, 'lax', 'sameSite must be lax');
  assert.equal(devOptions.maxAge, 8 * 60 * 60 * 1000, 'maxAge must be 8 hours');
  assert.equal(devOptions.path, '/');

  const prodOptions = getCookieOptions(true);
  assert.equal(prodOptions.httpOnly, true, 'httpOnly must be true in prod');
  assert.equal(prodOptions.secure, true, 'secure must be true in prod');
  assert.equal(prodOptions.sameSite, 'lax', 'sameSite must be lax');
  assert.equal(prodOptions.maxAge, 8 * 60 * 60 * 1000, 'maxAge must be 8 hours');
  assert.equal(prodOptions.path, '/');

  const devClear = getClearCookieOptions(false);
  assert.equal(devClear.httpOnly, true);
  assert.equal(devClear.secure, false);
  assert.equal(devClear.sameSite, 'lax');
  assert.equal(devClear.path, '/');

  const prodClear = getClearCookieOptions(true);
  assert.equal(prodClear.httpOnly, true);
  assert.equal(prodClear.secure, true);
  assert.equal(prodClear.sameSite, 'lax');
  assert.equal(prodClear.path, '/');
});

test('demo clock uses configured reference date', () => {
  assert.equal(createClock({ demoToday: '2026-11-02' }).today(), '2026-11-02');
});

test('phone validation pattern accepts international numbers and rejects junk', () => {
  const phone = /^\+?[1-9]\d{9,14}$/;
  assert.equal(phone.test('+919900000041'), true);
  assert.equal(phone.test('not-a-phone'), false);
  assert.equal(phone.test('12345'), false);
});

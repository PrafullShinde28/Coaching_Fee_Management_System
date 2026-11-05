import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveOtp } from '../src/services/otp-core.js';
import { createClock } from '../src/config/clock-core.js';

test('demo OTP is deterministic outside production', () => { assert.equal(resolveOtp({ nodeEnv: 'test', demoOtp: '246810' }), '246810'); });
test('production OTP is six digits and uses injected randomness', () => { assert.equal(resolveOtp({ nodeEnv: 'production', random: () => 0.5 }), '550000'); });
test('demo clock uses configured reference date', () => { assert.equal(createClock({ demoToday: '2026-11-02' }).today(), '2026-11-02'); });
test('phone validation pattern accepts international numbers and rejects junk', () => {
  const phone = /^\+?[1-9]\d{9,14}$/;
  assert.equal(phone.test('+919900000041'), true);
  assert.equal(phone.test('not-a-phone'), false);
});

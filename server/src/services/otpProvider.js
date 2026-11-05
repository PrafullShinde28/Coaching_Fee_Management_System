import { env } from '../config/env.js';
import { resolveOtp } from './otp-core.js';
export class MockOtpProvider {
  async send(phone, code) { console.info(`[MOCK OTP] ${phone}: ${code}`); return { delivered: true, provider: 'mock' }; }
}
export const otpProvider = new MockOtpProvider();
export const generateOtp = () => resolveOtp({ nodeEnv: env.NODE_ENV, demoOtp: env.DEMO_OTP });

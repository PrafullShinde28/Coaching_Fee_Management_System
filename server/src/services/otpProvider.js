import { env } from '../config/env.js';
import { resolveOtp } from './otp-core.js';

export class MockOtpProvider {
  constructor(logger = console) {
    this.logger = logger;
  }

  async send(phone, code) {
    const isProd = (process.env.NODE_ENV || env.NODE_ENV) === 'production';
    if (!isProd) {
      this.logger.info(`[MOCK OTP] ${phone}: ${code}`);
    } else {
      this.logger.info(`[OTP] Sent OTP notification to ${phone}`);
    }
    return { delivered: true, provider: 'mock' };
  }
}

export const otpProvider = new MockOtpProvider();
export const generateOtp = () => resolveOtp({ nodeEnv: env.NODE_ENV, demoOtp: env.DEMO_OTP });


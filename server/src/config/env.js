import dotenv from 'dotenv';
import { z } from 'zod';
dotenv.config();
const schema = z.object({
  NODE_ENV: z.enum(['development','test','production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  MONGODB_URI: z.string().default('mongodb://127.0.0.1:27017/jaipur_fee_portal'),
  JWT_SECRET: z.string().min(24).default('development-only-change-this-secret-12345'),
  COOKIE_NAME: z.string().default('fee_portal_session'),
  DEMO_TODAY: z.string().optional(), DEMO_OTP: z.string().length(6).default('246810'),
  OTP_TTL_MINUTES: z.coerce.number().int().positive().default(5),
  CLIENT_ORIGIN: z.string().url().default('http://localhost:5173'),
  PAYMENT_GATEWAY_PROVIDER: z.string().default('mock'),
  PAYMENT_WEBHOOK_SECRET: z.string().default('mock-webhook-secret-key-12345'),
  MESSAGE_PROVIDER: z.string().default('mock'),
  REMINDER_CRON_SCHEDULE: z.string().default('0 9 * * *'),
  REMINDER_CRON_ENABLED: z.coerce.boolean().default(false),
  RISK_CRON_SCHEDULE: z.string().default('0 10 * * *'),
  RISK_CRON_ENABLED: z.coerce.boolean().default(false)
});
export const env = schema.parse(process.env);
if (env.NODE_ENV === 'production' && (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32)) throw new Error('JWT_SECRET must be at least 32 characters in production');

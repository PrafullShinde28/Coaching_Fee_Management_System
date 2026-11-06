import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { User } from '../models/index.js';
import { env } from '../config/env.js';
import { generateOtp, otpProvider } from '../services/otpProvider.js';
import { requireAuth } from '../middleware/auth.js';
import { clock } from '../config/clock.js';

const router = Router();
export const otpStore = new Map();
const phoneSchema = z.string().regex(/^\+?[1-9]\d{9,14}$/);

export const getCookieOptions = (isProduction = env.NODE_ENV === 'production') => ({
  httpOnly: true,
  secure: isProduction,
  sameSite: 'lax',
  maxAge: 8 * 60 * 60 * 1000,
  path: '/'
});

export const getClearCookieOptions = (isProduction = env.NODE_ENV === 'production') => ({
  httpOnly: true,
  secure: isProduction,
  sameSite: 'lax',
  path: '/'
});

export const otpLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 5,
  keyGenerator: (req) => req.headers['x-client-id'] || req.body?.phone || req.ip,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many OTP attempts. Try again later.' }
});

router.post('/otp/request', otpLimiter, async (req, res, next) => {
  try {
    const { phone } = z.object({ phone: phoneSchema }).parse(req.body);
    const user = await User.findOne({ phone, isActive: true });
    if (!user) return res.status(404).json({ error: 'No account found for this phone number' });
    const code = generateOtp();
    otpStore.set(phone, { code, expiresAt: Date.now() + env.OTP_TTL_MINUTES * 60 * 1000, attempts: 0 });
    await otpProvider.send(phone, code);
    res.json({ ok: true, expiresInSeconds: env.OTP_TTL_MINUTES * 60, ...(env.NODE_ENV !== 'production' ? { demoOtp: code } : {}) });
  } catch(e) { next(e); }
});

router.post('/otp/verify', otpLimiter, async (req, res, next) => {
  try {
    const { phone, otp } = z.object({ phone: phoneSchema, otp: z.string().length(6) }).parse(req.body);
    const record = otpStore.get(phone);
    if (!record || record.expiresAt < Date.now() || record.attempts >= 5) {
      otpStore.delete(phone);
      return res.status(400).json({ error: 'OTP expired or unavailable' });
    }
    record.attempts += 1;
    if (record.code !== otp) return res.status(400).json({ error: 'Incorrect OTP' });
    otpStore.delete(phone);
    const user = await User.findOne({ phone, isActive: true });
    if (!user) return res.status(404).json({ error: 'Account not found' });
    const token = jwt.sign({ sub: String(user._id), role: user.role }, env.JWT_SECRET, { expiresIn: '8h' });
    res.cookie(env.COOKIE_NAME, token, getCookieOptions(env.NODE_ENV === 'production'));
    res.json({ user: { id: user.id, role: user.role, phone: user.phone, language: user.language, consentRequired: user.role === 'parent' && !user.consent?.givenBy } });
  } catch(e) { next(e); }
});

router.get('/me', requireAuth, (req, res) => res.json({ user: { id: req.user.id, role: req.user.role, phone: req.user.phone, language: req.user.language, consentRequired: req.user.role === 'parent' && !req.user.consent?.givenBy } }));

router.post('/consent', requireAuth, async (req, res, next) => {
  try {
    if (req.user.role !== 'parent') return res.status(403).json({ error: 'Only parent accounts can provide parental consent' });
    const body = z.object({ accepted: z.literal(true), version: z.string().min(1).max(40) }).parse(req.body);
    if (req.user.consent?.givenBy) return res.json({ ok: true, alreadyRecorded: true });
    req.user.consent = { givenBy: req.user._id, at: clock.now(), version: body.version };
    await req.user.save();
    res.json({ ok: true, consent: req.user.consent });
  } catch(e) { next(e); }
});

router.post('/logout', (_req, res) => {
  res.clearCookie(env.COOKIE_NAME, getClearCookieOptions(env.NODE_ENV === 'production'));
  res.json({ ok: true });
});

export default router;


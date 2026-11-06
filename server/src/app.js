import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { env } from './config/env.js';
import authRoutes from './routes/auth.js';
import { requireAuth, requireRole, requireStudentAccess } from './middleware/auth.js';

export const app = express();
app.use(helmet());
app.use(cors({ origin: env.CLIENT_ORIGIN, credentials: true }));
app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());

app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'fee-portal-api' }));
app.use('/api/auth', authRoutes);

// Protected routes for Phase 1 role & student ownership authorization
app.get('/api/students/:studentId', requireAuth, requireStudentAccess, (req, res) => {
  res.json({ ok: true, student: req.student });
});

app.get('/api/accounts/summary', requireAuth, requireRole('accounts'), (_req, res) => {
  res.json({ ok: true, accountsOnly: true });
});

// Internal error simulation for security verification
if (process.env.NODE_ENV !== 'production') {
  app.get('/api/test/error-leak-check', () => {
    throw new Error('Database connection failed: mongodb://admin:superSecret123@internal-db:27017/fee_db');
  });
}

app.use((err, _req, res, _next) => {
  if (err?.name === 'ZodError') return res.status(400).json({ error: 'Invalid request', details: err.issues.map(i => ({ path: i.path.join('.'), message: i.message })) });
  return res.status(500).json({ error: 'Internal server error' });
});


import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { env } from './config/env.js';
import authRoutes from './routes/auth.js';
export const app = express();
app.use(helmet());
app.use(cors({ origin: env.CLIENT_ORIGIN, credentials: true }));
app.use(express.json({ limit: '100kb' })); app.use(cookieParser());
app.get('/api/health', (_req,res) => res.json({ ok: true, service: 'fee-portal-api' }));
app.use('/api/auth', authRoutes);
app.use((err, _req, res, _next) => {
  if (err?.name === 'ZodError') return res.status(400).json({ error: 'Invalid request', details: err.issues.map(i => ({ path: i.path.join('.'), message: i.message })) });
  console.error(err); return res.status(500).json({ error: 'Internal server error' });
});

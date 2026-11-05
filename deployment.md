# Deployment and reviewer access

## Local setup
1. Install Node.js 20+ and MongoDB 7+ (or create a MongoDB Atlas database).
2. Copy `.env.example` to `.env` and configure `MONGODB_URI` and a strong `JWT_SECRET`.
3. From the repository root run `npm install`.
4. Run `npm run seed` to create deterministic demo data (safe to rerun).
5. Run `npm run dev:server`.
6. Check `http://localhost:4000/api/health`.

## Environment variable names
`NODE_ENV`, `PORT`, `MONGODB_URI`, `JWT_SECRET`, `COOKIE_NAME`, `DEMO_TODAY`, `DEMO_OTP`, `OTP_TTL_MINUTES`, `CLIENT_ORIGIN`.

## Demo logins
Use the OTP `246810` in non-production mode.

| Role | Phone | Access |
|---|---|---|
| Accounts | +919900000001 | All centres and accounts operations |
| Parent — Aarav | +919900000041 | Aarav Meena only |
| Parent — Ishita | +919900000058 | Ishita Sharma only |
| Parent — Mohit | +919900000021 | Mohit Gurjar only |

These are synthetic demo accounts. Do not use them in production.

## Deployment notes
Deploy the Express API to Render or Railway with a managed MongoDB Atlas database. Set the environment variable names above in the hosting dashboard; never commit values. Configure the client origin for credentialed CORS and use HTTPS so the session cookie is `Secure`. The Vite client will be deployed separately to Vercel in a later phase. Configure a persistent process/cron strategy before enabling scheduled jobs.

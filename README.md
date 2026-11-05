# FeeTrack — Coaching Fee Tracking & Parent Portal

A mobile-first fee operations MVP for a Jaipur coaching institute. The build is phased; Phase 1 establishes the monorepo, MongoDB models, demo seed, OTP authentication, role/ownership primitives and parental-consent capture.

## Requirements
- Node.js 20+
- MongoDB 7+ (local) or MongoDB Atlas

## Quick start
1. `cp .env.example .env` and set a strong `JWT_SECRET`.
2. `npm install`
3. Start MongoDB locally, or set `MONGODB_URI` to Atlas.
4. `npm run seed`
5. `npm run dev:server`

API health: `http://localhost:4000/api/health`.

Demo OTP is `246810` when `NODE_ENV` is not production. Demo phones and accounts are documented in `deployment.md`.

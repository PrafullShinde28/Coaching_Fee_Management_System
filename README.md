# FeeTrack — Coaching Fee Tracking & Parent Portal

A mobile-first fee operations MVP for a Jaipur coaching institute. Phase 1 established foundational models, seed, OTP authentication, and consent capture. Phase 2 established domain pure functions for fee calculation, allocations, reminders, refunds, and risk scoring. Phase 3 provides REST APIs, mock payment gateway integration, secure HMAC webhooks, and GST receipts.

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

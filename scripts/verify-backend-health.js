import http from 'node:http';
import { MongoMemoryServer } from '../server/node_modules/mongodb-memory-server/index.js';
import mongoose from '../server/node_modules/mongoose/index.js';

async function main() {
  console.log('--- Sub-Phase 7.1 Backend Health & CORS Probe ---');
  
  // 1. Start in-memory MongoDB
  const mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  process.env.MONGODB_URI = uri;
  process.env.PORT = '4005';
  process.env.CLIENT_ORIGIN = 'https://portal.feetrack.in';
  process.env.NODE_ENV = 'production';
  process.env.JWT_SECRET = 'production-grade-very-secure-jwt-secret-at-least-32-chars';
  process.env.COOKIE_DOMAIN = '.feetrack.in';

  // 2. Connect DB and import app
  await mongoose.connect(uri);
  console.log('[PASS] Connected to in-memory database instance for verification');

  const { app } = await import('../server/src/app.js');
  const server = http.createServer(app);

  await new Promise((resolve) => server.listen(4005, '0.0.0.0', resolve));
  console.log('[PASS] Backend server successfully listening on 0.0.0.0:4005');

  // 3. Probe GET /api/health
  const healthRes = await fetch('http://127.0.0.1:4005/api/health');
  const healthData = await healthRes.json();
  console.log(`[PASS] GET /api/health returned HTTP ${healthRes.status}:`, JSON.stringify(healthData));
  if (!healthData.ok || healthData.service !== 'fee-portal-api') {
    throw new Error('Health check response mismatch');
  }

  // 4. Probe CORS preflight with matching CLIENT_ORIGIN
  const corsPreflightRes = await fetch('http://127.0.0.1:4005/api/auth/me', {
    method: 'OPTIONS',
    headers: {
      'Origin': 'https://portal.feetrack.in',
      'Access-Control-Request-Method': 'GET',
      'Access-Control-Request-Headers': 'Content-Type'
    }
  });
  console.log(`[PASS] CORS Preflight OPTIONS returned HTTP ${corsPreflightRes.status}`);
  console.log('       Access-Control-Allow-Origin:', corsPreflightRes.headers.get('access-control-allow-origin'));
  console.log('       Access-Control-Allow-Credentials:', corsPreflightRes.headers.get('access-control-allow-credentials'));

  if (corsPreflightRes.headers.get('access-control-allow-origin') !== 'https://portal.feetrack.in') {
    throw new Error('CORS Allow-Origin header mismatch');
  }
  if (corsPreflightRes.headers.get('access-control-allow-credentials') !== 'true') {
    throw new Error('CORS Allow-Credentials header mismatch');
  }

  // 5. Cleanup
  await new Promise((resolve) => server.close(resolve));
  await mongoose.disconnect();
  await mongod.stop();
  console.log('[PASS] Server closed and MongoDB disconnected cleanly.');
  console.log('--- Verification Complete: 100% Passed ---');
}

main().catch((err) => {
  console.error('Verification failed:', err);
  process.exit(1);
});

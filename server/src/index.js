import { app } from './app.js';
import { connectDB } from './config/db.js';
import { env } from './config/env.js';
import { startScheduler } from './services/scheduler.js';

await connectDB();
startScheduler();

const host = '0.0.0.0';
const server = app.listen(env.PORT, host, () => {
  console.info(`Fee portal API listening on ${host}:${env.PORT}`);
});

const gracefulShutdown = (signal) => {
  console.info(`Received ${signal}. Shutting down gracefully...`);
  server.close(() => {
    console.info('HTTP server closed.');
    process.exit(0);
  });
  setTimeout(() => {
    console.error('Forced shutdown due to timeout.');
    process.exit(1);
  }, 10000).unref();
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));


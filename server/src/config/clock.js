import { env } from './env.js';
import { createClock } from './clock-core.js';
export { createClock };
export const clock = createClock({ demoToday: env.DEMO_TODAY });

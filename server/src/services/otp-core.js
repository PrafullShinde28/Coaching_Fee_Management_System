import crypto from 'node:crypto';

export function resolveOtp({ nodeEnv, demoOtp = '246810', random = null }) {
  if (nodeEnv === 'production') {
    if (typeof random === 'function') {
      return String(Math.floor(100000 + random() * 900000));
    }
    return String(crypto.randomInt(100000, 1000000));
  }
  return demoOtp;
}


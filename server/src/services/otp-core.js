export function resolveOtp({ nodeEnv, demoOtp = '246810', random = Math.random }) {
  return nodeEnv === 'production' ? String(Math.floor(100000 + random() * 900000)) : demoOtp;
}

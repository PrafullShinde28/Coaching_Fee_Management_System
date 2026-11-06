const getApiBase = () => {
  try {
    if (typeof import.meta !== 'undefined' && import.meta?.env?.VITE_API_BASE_URL) {
      return import.meta.env.VITE_API_BASE_URL;
    }
  } catch (_e) {}
  if (typeof process !== 'undefined' && process.env?.VITE_API_BASE_URL) {
    return process.env.VITE_API_BASE_URL;
  }
  return '/api';
};

const API_BASE = getApiBase();

/**
 * Universal JSON request wrapper enforcing credentials (httpOnly cookie)
 * and consistent error extraction.
 */
async function request(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const config = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    },
    credentials: 'include' // Always send session cookie
  };

  if (config.body && typeof config.body === 'object' && !(config.body instanceof FormData)) {
    config.body = JSON.stringify(config.body);
  }

  let res;
  try {
    res = await fetch(url, config);
  } catch (err) {
    throw new Error('Network error. Unable to reach fee server. Please check your connection.');
  }

  let data;
  try {
    data = await res.json();
  } catch (_e) {
    data = null;
  }

  if (!res.ok) {
    const errorMsg = data?.error || data?.message || `Request failed with status ${res.status}`;
    const err = new Error(errorMsg);
    err.status = res.status;
    err.data = data;
    throw err;
  }

  return data;
}

export const api = {
  // Auth API
  auth: {
    requestOtp: (phone) => request('/auth/otp/request', { method: 'POST', body: { phone } }),
    verifyOtp: (phone, otp) => request('/auth/otp/verify', { method: 'POST', body: { phone, otp } }),
    getMe: () => request('/auth/me'),
    submitConsent: (version = '2026.1') => request('/auth/consent', { method: 'POST', body: { accepted: true, version } }),
    logout: () => request('/auth/logout', { method: 'POST' })
  },

  // Parent API
  parent: {
    getChildren: () => request('/parent/children'),
    getStudentLedger: (studentId) => request(`/parent/students/${studentId}/ledger`),
    getStudentPayments: (studentId) => request(`/parent/students/${studentId}/payments`),
    getStudentReceipts: (studentId) => request(`/parent/students/${studentId}/receipts`),
    createPaymentLink: (instalmentId) => request(`/parent/instalments/${instalmentId}/payment-link`, { method: 'POST' })
  }
};

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
  },

  // Accounts API
  accounts: {
    getDashboard: (params = {}) => {
      const q = new URLSearchParams(params).toString();
      return request(`/accounts/dashboard${q ? `?${q}` : ''}`);
    },
    getCentres: () => request('/accounts/centres'),
    getBatches: (params = {}) => {
      const q = new URLSearchParams(params).toString();
      return request(`/accounts/batches${q ? `?${q}` : ''}`);
    },
    getStudents: (params = {}) => {
      const q = new URLSearchParams(params).toString();
      return request(`/accounts/students${q ? `?${q}` : ''}`);
    },
    getStudentLedger: (studentId) => request(`/accounts/students/${studentId}/ledger`),
    getInstalments: (params = {}) => {
      const q = new URLSearchParams(params).toString();
      return request(`/accounts/instalments${q ? `?${q}` : ''}`);
    },
    recordPayment: (data) => {
      const body = {
        studentId: data.studentId,
        amount: data.amountPaise !== undefined ? data.amountPaise : data.amount,
        reference: data.reference,
        instalmentId: data.instalmentId || null,
        receivedAt: data.paidAt || data.receivedAt || null,
        notes: data.notes || ''
      };
      return request('/accounts/payments/manual', { method: 'POST', body });
    },
    recordManualPayment: (data) => {
      const body = {
        studentId: data.studentId,
        amount: data.amountPaise !== undefined ? data.amountPaise : data.amount,
        reference: data.reference,
        instalmentId: data.instalmentId || null,
        receivedAt: data.paidAt || data.receivedAt || null,
        notes: data.notes || ''
      };
      return request('/accounts/payments/manual', { method: 'POST', body });
    },
    getUnmatchedPayments: (params = {}) => {
      const q = new URLSearchParams(params).toString();
      return request(`/accounts/unmatched-payments${q ? `?${q}` : ''}`);
    },
    matchUnmatchedPayment: (id, data) => request(`/accounts/unmatched-payments/${id}/match`, { method: 'POST', body: data }),
    dismissUnmatchedPayment: (id, data) => request(`/accounts/unmatched-payments/${id}/dismiss`, { method: 'POST', body: data }),
    getReceipts: () => request('/accounts/receipts'),
    getRefunds: () => request('/accounts/refunds'),
    calculateRefund: (studentId) => request(`/accounts/refunds/calculate/${studentId}`),
    createRefund: (data) => request('/accounts/refunds', { method: 'POST', body: data }),
    processRefund: (id, data) => request(`/accounts/refunds/${id}/process`, { method: 'POST', body: data }),
    getReminders: (params = {}) => {
      const q = new URLSearchParams(params).toString();
      return request(`/accounts/reminders${q ? `?${q}` : ''}`);
    },
    triggerReminders: () => request('/accounts/reminders/run', { method: 'POST' }),
    runReminderCycle: () => request('/accounts/reminders/run', { method: 'POST' }),
    getMessageLogs: (params = {}) => {
      const q = new URLSearchParams(params).toString();
      return request(`/accounts/message-logs${q ? `?${q}` : ''}`);
    },
    getRiskFlags: (params = {}) => {
      const q = new URLSearchParams(params).toString();
      return request(`/accounts/risk-flags${q ? `?${q}` : ''}`);
    },
    updateRiskFlag: (id, data) => {
      if (data.status === 'false_flag' || data.status === 'false_positive') {
        return request(`/accounts/risk-flags/${id}/false-flag`, { method: 'POST', body: { notes: data.notes } });
      }
      return request(`/accounts/risk-flags/${id}/called`, { method: 'POST', body: { notes: data.notes } });
    },
    markRiskFlagCalled: (id, data) => request(`/accounts/risk-flags/${id}/called`, { method: 'POST', body: data }),
    markRiskFlagFalsePositive: (id, data) => request(`/accounts/risk-flags/${id}/false-flag`, { method: 'POST', body: data }),
    triggerRiskAssessment: () => request('/accounts/risk/run', { method: 'POST' }),
    runRiskCycle: () => request('/accounts/risk/run', { method: 'POST' }),
    exportReportCsv: async (params = {}) => {
      const q = new URLSearchParams(params).toString();
      const res = await fetch(`${API_BASE}/accounts/reports/export${q ? `?${q}` : ''}`, {
        credentials: 'include'
      });
      if (!res.ok) throw new Error('Failed to export CSV report');
      return res.blob();
    },
    getExportUrl: (type = 'centre_collections') => `${API_BASE}/accounts/reports/export?type=${type}`
  }
};

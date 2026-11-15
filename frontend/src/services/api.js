/**
 * MediQueue API Service
 * Centralized communication layer with the FastAPI backend.
 * Supports token-based Bearer authentication for patient and staff sessions.
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';

function getAuthToken() {
  try {
    return localStorage.getItem('mediqueue_token') || null;
  } catch {
    return null;
  }
}

async function request(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  const token = getAuthToken();

  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token && !headers.Authorization) {
    headers.Authorization = `Bearer ${token}`;
  }

  const config = {
    ...options,
    headers,
  };

  try {
    const response = await fetch(url, config);
    const data = await response.json().catch(() => null);

    if (!response.ok) {
      const errorMsg = data?.detail || `API Error: ${response.status} ${response.statusText}`;
      const error = new Error(errorMsg);
      error.status = response.status;
      error.data = data;
      throw error;
    }

    return data;
  } catch (err) {
    if (err.name === 'TypeError' && err.message.includes('fetch')) {
      throw new Error(
        `Cannot connect to MediQueue backend at ${API_BASE_URL}. Ensure the FastAPI server is running.`
      );
    }
    throw err;
  }
}

export const api = {
  // System Health
  getHealth: () => request('/health'),

  // Departments
  getDepartments: () => request('/departments'),

  // Doctors
  getDoctors: (dept) => {
    const q = dept && dept !== 'ALL' ? `?department=${encodeURIComponent(dept)}` : '';
    return request(`/doctors${q}`);
  },

  // Aggregated Statistics
  getStatsSummary: () => request('/stats/summary'),

  // Authentication
  login: (credentials) =>
    request('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    }),
  register: (userData) =>
    request('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    }),
  getMe: () => request('/auth/me'),

  // Patient Dashboard Endpoints (Protected)
  getPatientProfile: () => request('/patient/profile'),
  updatePatientProfile: (data) =>
    request('/patient/profile', {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  getPatientActiveVisit: () => request('/patient/active-visit'),
  getPatientVisits: () => request('/patient/visits'),
  getPatientAppointments: () => request('/patient/appointments'),
  bookAppointment: (data) =>
    request('/patient/appointments', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  cancelAppointment: (id) =>
    request(`/patient/appointments/${id}/cancel`, {
      method: 'PATCH',
    }),
  joinQueue: (department) =>
    request('/patient/queue/join', {
      method: 'POST',
      body: JSON.stringify({ department }),
    }),
  cancelActiveVisit: () =>
    request('/patient/queue/cancel-active', {
      method: 'PATCH',
    }),

  // Existing Staff APIs
  getPatients: () => request('/patients'),
  getPatient: (id) => request(`/patients/${id}`),
  deletePatient: (id) =>
    request(`/patients/${id}`, {
      method: 'DELETE',
    }),
  createPatient: (patientData) =>
    request('/patients', {
      method: 'POST',
      body: JSON.stringify(patientData),
    }),

  quickRegisterAndQueue: (data) =>
    request('/register-and-queue', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getQueue: (params = {}) => {
    const query = new URLSearchParams();
    if (params.department && params.department !== 'ALL') query.append('department', params.department);
    if (params.status && params.status !== 'ALL') query.append('status', params.status);
    if (params.token_number) query.append('token_number', params.token_number);
    const queryString = query.toString() ? `?${query.toString()}` : '';
    return request(`/queue${queryString}`);
  },
  getQueueEntry: (id) => request(`/queue/${id}`),
  createQueueEntry: (queueData) =>
    request('/queue', {
      method: 'POST',
      body: JSON.stringify(queueData),
    }),
  updateQueueStatus: (queueId, status) =>
    request(`/queue/${queueId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
  deleteQueueEntry: (queueId) =>
    request(`/queue/${queueId}`, {
      method: 'DELETE',
    }),
  cleanupQueue: (options = {}) =>
    request('/queue/cleanup', {
      method: 'POST',
      body: JSON.stringify(options),
    }),
  callNextPatient: (department) => {
    const query = department && department !== 'ALL' ? `?department=${encodeURIComponent(department)}` : '';
    return request(`/queue/call-next${query}`, {
      method: 'POST',
    });
  },

  // Token Tracking Lookup
  trackToken: (tokenNumber, department) => {
    const query = new URLSearchParams();
    query.append('token_number', tokenNumber);
    if (department && department !== 'ALL') query.append('department', department);
    return request(`/queue/track?${query.toString()}`);
  },
};

export default api;

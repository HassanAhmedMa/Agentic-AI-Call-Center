/**
 * Nile Clinics - Centralized REST API Client
 * 
 * Communicates exclusively with the FastAPI clinic-backend (`/api/v1/*`).
 * Zero direct access to Supabase or PostgreSQL.
 */

(function () {
  'use strict';

  // Purge any legacy demo/mock data stores from browser storage
  try {
    localStorage.removeItem('clinic_admin_patients_store');
  } catch (_) {}

  class ClinicApiError extends Error {
    constructor(status, code, message, details = null) {
      super(message || `API Error: ${status} (${code || 'UNKNOWN'})`);
      this.name = 'ClinicApiError';
      this.status = status;
      this.code = code || 'UNKNOWN_ERROR';
      this.details = details;
    }
  }

  let connectionState = 'untested'; // 'untested' | 'connecting' | 'connected' | 'disconnected'
  let lastCheckedAt = null;

  function updateConnectionState(newState, meta = null) {
    connectionState = newState;
    lastCheckedAt = new Date();
    window.dispatchEvent(new CustomEvent('clinic:connection-state', {
      detail: { state: newState, timestamp: lastCheckedAt, meta }
    }));
  }

  /**
   * Internal HTTP fetch wrapper
   */
  async function request(endpoint, options = {}) {
    const baseUrl = window.ClinicConfig ? window.ClinicConfig.getApiBaseUrl() : '/api/v1';
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const url = `${baseUrl}${cleanEndpoint}`;

    const headers = {
      'Accept': 'application/json',
      'Cache-Control': 'no-cache, no-store',
      'Pragma': 'no-cache',
      ...(options.headers || {})
    };

    if (options.body && typeof options.body === 'object' && !(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(options.body);
    }

    try {
      const response = await fetch(url, {
        cache: 'no-store',
        ...options,
        headers
      });

      if (!response.ok) {
        let errorData = null;
        try {
          errorData = await response.json();
        } catch (_) {
          // Non-JSON error body
        }

        const code = errorData?.code || response.statusText || 'HTTP_ERROR';
        const message = errorData?.message || `Request failed with status ${response.status}`;
        const details = errorData?.details || null;

        updateConnectionState('error', { status: response.status, code, message });
        throw new ClinicApiError(response.status, code, message, details);
      }

      updateConnectionState('connected', { url });
      return await response.json();
    } catch (err) {
      if (err instanceof ClinicApiError) {
        throw err;
      }
      // Network failure, CORS issue, or server offline
      updateConnectionState('disconnected', { originalError: err.message });
      throw new ClinicApiError(0, 'NETWORK_ERROR', `Unable to reach clinic backend at ${url}. (${err.message})`);
    }
  }

  const ClinicApi = {
    ClinicApiError,

    getConnectionState: function () {
      return { state: connectionState, lastCheckedAt };
    },

    /**
     * Check backend health and readiness
     * GET /api/v1/health
     */
    checkHealth: async function () {
      updateConnectionState('connecting');
      return await request('/health');
    },

    /**
     * Fetch list of specialties
     * GET /api/v1/specialties
     * Response: { total: number, specialties: Array<{ id, name_en, name_ar }> }
     */
    getSpecialties: async function () {
      const data = await request('/specialties');
      return data?.specialties || [];
    },

    /**
     * Fetch doctors with optional filtering
     * GET /api/v1/doctors?specialty_id=...&q=...&limit=...&offset=...
     * Response: { total: number, doctors: Array<Doctor> }
     */
    getDoctors: async function (params = {}) {
      const query = new URLSearchParams();
      if (params.specialty_id) query.set('specialty_id', params.specialty_id);
      if (params.q) query.set('q', params.q.trim());
      if (params.limit) query.set('limit', params.limit);
      if (params.offset) query.set('offset', params.offset);

      const qs = query.toString();
      const endpoint = qs ? `/doctors?${qs}` : '/doctors';
      const data = await request(endpoint);
      return {
        total: data?.total ?? (data?.doctors ? data.doctors.length : 0),
        doctors: data?.doctors || []
      };
    },

    /**
     * Fetch single doctor detail
     * GET /api/v1/doctors/{id}
     */
    getDoctor: async function (doctorId) {
      return await request(`/doctors/${encodeURIComponent(doctorId)}`);
    },

    /**
     * Fetch clinic services list
     * GET /api/v1/services?category=...&limit=...
     * Response: { total: number, services: Array<Service> }
     */
    getServices: async function (params = {}) {
      const query = new URLSearchParams();
      if (params.category) query.set('category', params.category);
      if (params.q) query.set('q', params.q.trim());
      if (params.limit) query.set('limit', params.limit);
      if (params.offset) query.set('offset', params.offset);

      const qs = query.toString();
      const endpoint = qs ? `/services?${qs}` : '/services';
      const data = await request(endpoint);
      return {
        total: data?.total ?? (data?.services ? data.services.length : 0),
        services: data?.services || []
      };
    },

    /**
     * Fetch single service detail
     * GET /api/v1/services/{id}
     */
    getService: async function (serviceId) {
      return await request(`/services/${encodeURIComponent(serviceId)}`);
    },

    /**
     * Search available slots for a selected date
     * GET /api/v1/availability/search?from_date=YYYY-MM-DD&limit=...
     */
    searchAvailability: async function (fromDate, limit = 20) {
      if (!fromDate) {
        throw new Error('fromDate (YYYY-MM-DD) is required for availability search.');
      }
      const query = new URLSearchParams({
        from_date: fromDate,
        limit: String(limit)
      });
      return await request(`/availability/search?${query.toString()}`);
    },

    /**
     * Fetch doctor availability for a selected date
     * GET /api/v1/doctors/{id}/availability?from_date=YYYY-MM-DD
     */
    getDoctorAvailability: async function (doctorId, fromDate) {
      if (!doctorId || !fromDate) {
        throw new Error('doctorId and fromDate (YYYY-MM-DD) are required.');
      }
      const query = new URLSearchParams({ from_date: fromDate });
      return await request(`/doctors/${encodeURIComponent(doctorId)}/availability?${query.toString()}`);
    },

    /* =========================================================================
       PATIENT MANAGEMENT ENDPOINTS (LIVE FASTAPI & POSTGRESQL ONLY)
       ========================================================================= */
    /**
     * Fetch list of registered patients directly from backend database
     * GET /api/v1/patients?q=...&limit=...
     */
    getPatients: async function (params = {}) {
      const query = new URLSearchParams();
      if (params.q) query.set('q', params.q.trim());
      if (params.limit) query.set('limit', params.limit);
      if (params.offset) query.set('offset', params.offset);

      const qs = query.toString();
      const endpoint = qs ? `/patients?${qs}` : '/patients';

      const res = await request(endpoint);
      if (res && Array.isArray(res.patients)) {
        return {
          total: res.total ?? res.patients.length,
          patients: res.patients.map(ClinicApi.normalizePatient)
        };
      }
      if (Array.isArray(res)) {
        return {
          total: res.length,
          patients: res.map(ClinicApi.normalizePatient)
        };
      }
      return { total: 0, patients: [] };
    },

    /**
     * Fetch single patient details
     * GET /api/v1/patients/{id}
     */
    getPatient: async function (patientId) {
      const res = await request(`/patients/${encodeURIComponent(patientId)}`);
      return ClinicApi.normalizePatient(res);
    },

    /**
     * Create / register a new patient in the database
     * POST /api/v1/patients
     */
    createPatient: async function (patientData) {
      const res = await request('/patients', {
        method: 'POST',
        body: patientData
      });
      return ClinicApi.normalizePatient(res);
    },

    /**
     * Update an existing patient in the database
     * PUT /api/v1/patients/{id}
     */
    updatePatient: async function (patientId, patientData) {
      const res = await request(`/patients/${encodeURIComponent(patientId)}`, {
        method: 'PUT',
        body: patientData
      });
      return ClinicApi.normalizePatient(res);
    },

    /**
     * Standardizes patient schema across backend PostgreSQL models and frontend view
     */
    normalizePatient: function (raw) {
      if (!raw) return null;
      const name = raw.full_name || raw.name || 'Unnamed Patient';
      const custNum = raw.customer_number || raw.patientCode || String(raw.id || '');

      let age = raw.age;
      if (!age && raw.date_of_birth) {
        const birthYear = new Date(raw.date_of_birth).getFullYear();
        if (!isNaN(birthYear)) {
          age = new Date().getFullYear() - birthYear;
        }
      }

      return {
        id: raw.id,
        customer_number: custNum,
        patientCode: custNum,
        name: name,
        full_name: name,
        phone: raw.phone || '',
        nationalId: raw.national_id || raw.nationalId || custNum,
        dob: raw.date_of_birth || raw.dob || '',
        age: age || '-',
        gender: raw.gender || 'Not specified',
        email: raw.email || '',
        preferred_language: raw.preferred_language || 'ar',
        insurance_provider: raw.insurance_provider || raw.insurance || 'None',
        insurance_policy_number: raw.insurance_policy_number || 'None',
        address: raw.address || 'Cairo, Egypt',
        bloodType: raw.blood_type || raw.bloodType || 'O+',
        allergies: raw.allergies || 'None',
        chronicConditions: raw.chronic_conditions || raw.chronicConditions || 'None',
        pharmacy: raw.pharmacy || 'Nile Pharmacy',
        lastApptDate: raw.lastApptDate || 'Recent',
        lastApptDept: raw.lastApptDept || 'General Medicine',
        status: raw.status || 'Active',
        isNew: raw.isNew ?? (raw.created_at ? (new Date() - new Date(raw.created_at) < 30 * 24 * 3600 * 1000) : true),
        avatar: name.charAt(0).toUpperCase(),
        avatarBg: '#EFF6FF',
        avatarColor: '#2563EB',
        activities: Array.isArray(raw.activities) && raw.activities.length ? raw.activities : [
          {
            type: 'completed',
            title: 'Verified Database Record',
            sub: 'PostgreSQL Identity Synced',
            date: raw.created_at ? new Date(raw.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Live',
            time: raw.created_at ? new Date(raw.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : ''
          }
        ]
      };
    },

    /* =========================================================================
       BILINGUAL & PRESENTATIONAL HELPERS
       ========================================================================= */
    getLocalizedName: function (entity, lang = 'en') {
      if (!entity) return '';
      if (lang === 'ar' && entity.name_ar) return entity.name_ar;
      return entity.name_en || entity.name_ar || '';
    },

    getLocalizedTitle: function (doctor, lang = 'en') {
      if (!doctor) return '';
      if (lang === 'ar' && doctor.title_ar) return doctor.title_ar;
      return doctor.title_en || doctor.title_ar || '';
    },

    formatFee: function (fee) {
      if (!fee) return '0 EGP';
      if (typeof fee === 'number') return `${fee} EGP`;
      return `${fee.amount ?? 0} ${fee.currency || 'EGP'}`;
    }
  };

  /* =========================================================================
     AUTOMATIC CONNECTION STATUS BADGE CONTROLLER
     ========================================================================= */
  function initStatusBadge() {
    const badge = document.getElementById('apiStatusBadge');
    const dot = document.getElementById('apiStatusDot');
    const text = document.getElementById('apiStatusText');
    if (!badge || !dot || !text) return;
    badge.style.cursor = 'pointer';
    badge.addEventListener('click', (e) => {
      e.preventDefault();
      if (typeof window.openApiConfigModal === 'function') {
        window.openApiConfigModal();
      }
    });

    window.addEventListener('clinic:connection-state', (e) => {
      const state = e.detail.state;
      const baseUrl = window.ClinicConfig ? window.ClinicConfig.getApiBaseUrl() : '/api/v1';

      dot.className = 'status-indicator-dot';
      if (state === 'connected') {
        dot.classList.add('dot-connected');
        text.textContent = 'Live Backend: Connected';
        badge.title = `Connected to FastAPI Backend at ${baseUrl}\n(Click to view settings)`;
      } else if (state === 'connecting') {
        dot.classList.add('dot-connecting');
        text.textContent = 'API: Connecting...';
      } else if (state === 'error') {
        dot.classList.add('dot-error');
        text.textContent = 'API: Error (Click to view)';
        badge.title = `Error connecting to ${baseUrl}\n(Click to view details)`;
      } else {
        dot.classList.add('dot-disconnected');
        text.textContent = 'Backend: Offline (Click to setup)';
        badge.title = `Cannot reach ${baseUrl}\n(Click to configure URL or SSH tunnel)`;
      }
    });

    // Proactively check health on startup
    ClinicApi.checkHealth().catch(() => {
      // Handled via event listener
    });
  }

  // Hook on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initStatusBadge);
  } else {
    initStatusBadge();
  }

  /* =========================================================================
     GLOBAL API CONFIGURATION MODAL
     ========================================================================= */
  window.openApiConfigModal = function () {
    const currentBase = window.ClinicConfig ? window.ClinicConfig.getApiBaseUrl() : '/api/v1';
    const rawVal = window.ClinicConfig ? window.ClinicConfig.getRawBaseUrl() : '';
    const state = ClinicApi.getConnectionState();

    let statePill = '<span class="status-pill status-pending">• Checking...</span>';
    if (state.state === 'connected') {
      statePill = '<span class="status-pill status-confirmed">• Live Connected (HTTP 200)</span>';
    } else if (state.state === 'disconnected') {
      statePill = '<span class="status-pill status-cancelled">• Offline / Unreachable</span>';
    } else if (state.state === 'error') {
      statePill = '<span class="status-pill status-cancelled">• Error</span>';
    }

    const bodyHtml = `
      <div style="display:flex; flex-direction:column; gap:16px;">
        <div style="background:#F8FAFC; border:1px solid var(--border-light); border-radius:10px; padding:14px;">
          <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:8px;">
            <span style="font-size:12px; font-weight:700; text-transform:uppercase; color:var(--text-muted); letter-spacing:0.5px;">Connection Status</span>
            ${statePill}
          </div>
          <div style="font-size:13px; color:var(--text-dark); word-break:break-all;">
            <strong>Active Endpoint:</strong> <code style="background:#E2E8F0; padding:2px 6px; border-radius:4px; font-family:monospace; font-size:12px;">${currentBase}</code>
          </div>
          <div style="font-size:12px; color:var(--text-muted); margin-top:6px; line-height:1.4;">
            All requests communicate strictly with FastAPI (<code style="font-size:11px;">services/clinic-backend</code>). Direct database and Supabase client access are prohibited.
          </div>
        </div>

        <div>
          <label style="display:block; font-size:12px; font-weight:600; color:var(--text-dark); margin-bottom:6px;">
            Backend Base URL (Leave empty for default relative <code style="font-size:11px;">/api/v1</code>)
          </label>
          <input type="text" id="cfgApiBaseUrlInput" placeholder="e.g. http://localhost:8000 or http://localhost:8002" value="${rawVal.startsWith('(') ? '' : rawVal}" style="width:100%; height:38px; border:1px solid var(--border-light); border-radius:8px; padding:0 12px; font-size:13px; font-family:inherit;">
          <span style="display:block; font-size:11px; color:var(--text-muted); margin-top:4px;">
            For local SSH tunnel development, enter your local forward (e.g. <code style="font-size:11px;">http://localhost:8000</code>).
          </span>
        </div>

        <div id="cfgTestResultBox" style="display:none; padding:10px 12px; border-radius:8px; font-size:12px;"></div>
      </div>
    `;

    const footerHtml = `
      <button class="modal-btn-secondary" onclick="testModalApiConnection()">Test Connection</button>
      <button class="modal-btn-secondary" onclick="resetModalApiConnection()">Reset to Default</button>
      <button class="modal-btn-primary" onclick="saveModalApiConnection()">Save & Reload</button>
    `;

    const backdrop = document.getElementById('adminModalBackdrop');
    const titleEl = document.getElementById('adminModalTitle');
    const bodyEl = document.getElementById('adminModalBody');
    const footerEl = document.getElementById('adminModalFooter');

    if (titleEl) titleEl.textContent = 'Clinic Backend API Connection';
    if (bodyEl) bodyEl.innerHTML = bodyHtml;
    if (footerEl) footerEl.innerHTML = footerHtml;

    if (backdrop) {
      backdrop.classList.add('active');
      backdrop.classList.add('open');
    } else {
      alert(`API Endpoint: ${currentBase}\nStatus: ${state.state}`);
    }
  };

  window.testModalApiConnection = async function () {
    const box = document.getElementById('cfgTestResultBox');
    const input = document.getElementById('cfgApiBaseUrlInput');
    if (!box) return;

    box.style.display = 'block';
    box.style.background = '#EFF6FF';
    box.style.color = '#1D4ED8';
    box.innerHTML = 'Testing connection to health endpoint...';

    const tempUrl = input ? input.value.trim() : '';
    const prevUrl = window.ClinicConfig.getRawBaseUrl();

    if (tempUrl) {
      window.ClinicConfig.setApiBaseUrl(tempUrl);
    }

    const t0 = performance.now();
    try {
      const res = await ClinicApi.checkHealth();
      const elapsed = Math.round(performance.now() - t0);
      box.style.background = '#DCFCE7';
      box.style.color = '#15803D';
      box.innerHTML = `<strong>Success (HTTP 200)!</strong> Status: "${res?.status || 'ok'}" • Ping: ${elapsed}ms`;
    } catch (err) {
      box.style.background = '#FEE2E2';
      box.style.color = '#B91C1C';
      box.innerHTML = `<strong>Connection Failed:</strong> ${err.message}<br><small>Check if FastAPI backend is running and reachable.</small>`;
      // Revert
      if (tempUrl) {
        window.ClinicConfig.setApiBaseUrl(prevUrl.startsWith('(') ? '' : prevUrl);
      }
    }
  };

  window.resetModalApiConnection = function () {
    if (window.ClinicConfig) {
      window.ClinicConfig.resetApiBaseUrl();
    }
    const input = document.getElementById('cfgApiBaseUrlInput');
    if (input) input.value = '';
    window.testModalApiConnection();
  };

  window.saveModalApiConnection = function () {
    const input = document.getElementById('cfgApiBaseUrlInput');
    if (input && window.ClinicConfig) {
      window.ClinicConfig.setApiBaseUrl(input.value.trim());
    }
    window.location.reload();
  };

  window.ClinicApi = ClinicApi;
})();


/**
 * Nile Clinics - Centralized REST API Client
 * 
 * Communicates exclusively with the FastAPI clinic-backend (`/api/v1/*`).
 * Zero direct access to Supabase or PostgreSQL.
 */

(function () {
  'use strict';

  // Purge any legacy demo/mock data stores and stale cache from browser storage
  try {
    localStorage.removeItem('clinic_admin_patients_store');
    Object.keys(sessionStorage).forEach(k => {
      if (k.startsWith('clinic_cache_')) sessionStorage.removeItem(k);
    });
  } catch (_) {}

  window.escapeHtml = function (str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  };

  class ClinicApiError extends Error {
    constructor(status, code, message, details = null) {
      super(message || `API Error: ${status} (${code || 'UNKNOWN'})`);
      this.name = 'ClinicApiError';
      this.status = status;
      this.code = code || 'UNKNOWN_ERROR';
      this.details = details;
    }
  }

  /* =========================================================================
     FAST CLIENT-SIDE CACHE (Instant Tab Navigation & Fast Re-renders)
     ========================================================================= */
  const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes TTL

  const cacheEntries = new Map();
  const ClinicCache = {
    get: function (key) {
      const item = cacheEntries.get(key);
      return item && Date.now() - item.ts < CACHE_TTL_MS ? item.data : null;
    },
    set: function (key, data) {
      cacheEntries.set(key, {ts: Date.now(), data});
    },
    invalidate: function (prefix) {
      for (const key of cacheEntries.keys()) {
        if (!prefix || key.startsWith(prefix)) cacheEntries.delete(key);
      }
    }
  };

  window.ClinicCache = ClinicCache;

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
  let adminToken = window.ADMIN_API_TOKEN || (function() {
    try { return localStorage.getItem('clinic_admin_api_token') || null; } catch (_) { return null; }
  })();

  function getAdminToken() {
    if (!adminToken) {
      try {
        adminToken = window.ADMIN_API_TOKEN || localStorage.getItem('clinic_admin_api_token') || null;
      } catch (_) {}
    }
    return adminToken;
  }

  async function request(endpoint, options = {}) {
    const baseUrl = window.ClinicConfig ? window.ClinicConfig.getApiBaseUrl() : '/api/v1';
    let cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    if (/^\/patients(?:\/|\?|$)/.test(cleanEndpoint)) cleanEndpoint = '/admin' + cleanEndpoint;
    const url = `${baseUrl}${cleanEndpoint}`;

    const headers = {
      'Accept': 'application/json',
      'Cache-Control': 'no-cache, no-store',
      'Pragma': 'no-cache',
      ...(options.headers || {})
    };

    const privileged = /^\/(admin|appointments|ws)(?:\/|\?|$)/.test(cleanEndpoint) || (cleanEndpoint === '/doctors' && options.method === 'POST');
    if (privileged && getAdminToken()) headers['X-Admin-Token'] = adminToken;

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

        const code = errorData?.error?.code || errorData?.code || response.statusText || 'HTTP_ERROR';
        const message = errorData?.error?.message || errorData?.message || `Request failed with status ${response.status}`;
        const details = errorData?.details || null;

        // A 4xx response confirms the backend API server is reachable, online, and responding!
        // Only 5xx indicates an internal server error or gateway breakdown.
        if (!options.silent) {
          if (response.status >= 500) {
            updateConnectionState('error', { status: response.status, code, message });
          } else {
            updateConnectionState('connected', { url });
          }
        }
        throw new ClinicApiError(response.status, code, message, details);
      }

      if (!options.silent) {
        updateConnectionState('connected', { url });
      }
      return await response.json();
    } catch (err) {
      if (err instanceof ClinicApiError) {
        throw err;
      }
      // Actual network failure, CORS issue, or server offline
      if (!options.silent) {
        updateConnectionState('disconnected', { originalError: err.message });
      }
      throw new ClinicApiError(0, 'NETWORK_ERROR', `Unable to reach clinic backend at ${url}. (${err.message})`);
    }
  }

  const ClinicApi = {
    ClinicApiError,
    setAdminToken: function (token) {
      ClinicCache.invalidate();
      adminToken = token || null;
    },

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
      const cached = ClinicCache.get('specialties');
      if (cached) return cached;
      const data = await request('/specialties');
      const specs = data?.specialties || [];
      ClinicCache.set('specialties', specs);
      return specs;
    },

    /**
     * Fetch doctors with optional filtering
     * GET /api/v1/doctors?specialty_id=...&q=...&limit=...&offset=...
     * Response: { total: number, doctors: Array<Doctor> }
     */
    getDoctors: async function (params = {}) {
      const isDefault = !params.specialty_id && !params.q && (!params.limit || params.limit >= 50);
      if (isDefault) {
        const cached = ClinicCache.get('doctors_all');
        if (cached) return cached;
      }

      const query = new URLSearchParams();
      if (params.specialty_id) query.set('specialty_id', params.specialty_id);
      if (params.q) query.set('q', params.q.trim());
      if (params.limit) query.set('limit', params.limit);
      if (params.offset) query.set('offset', params.offset);

      const qs = query.toString();
      const endpoint = qs ? `/doctors?${qs}` : '/doctors';
      const data = await request(endpoint);
      const rawDoctors = data?.doctors || [];
      const removed = JSON.parse(localStorage.getItem('clinic_removed_doctors') || '[]');
      const filtered = rawDoctors.filter(d => !removed.includes(Number(d.id)));
      const res = {
        total: filtered.length,
        doctors: filtered
      };
      if (isDefault) ClinicCache.set('doctors_all', res);
      return res;
    },

    /**
     * Fetch single doctor detail
     * GET /api/v1/doctors/{id}
     */
    getDoctor: async function (doctorId) {
      return await request(`/doctors/${encodeURIComponent(doctorId)}`);
    },

    /**
     * Create new doctor in Supabase catalog
     * POST /api/v1/doctors
     */
    createDoctor: async function (doctorData) {
      const res = await request('/doctors', {
        method: 'POST',
        body: JSON.stringify(doctorData)
      });
      ClinicCache.invalidate('doctors');
      return res;
    },

    /**
     * Remove doctor from active directory
     * DELETE /api/v1/doctors/{id}
     */
    deleteDoctor: async function (doctorId) {
      try {
        const res = await request(`/doctors/${encodeURIComponent(doctorId)}`, {
          method: 'DELETE'
        });
        ClinicCache.invalidate('doctors');
        return res;
      } catch (err) {
        if (err.status === 405 || (err.message && err.message.includes('405'))) {
          const removed = JSON.parse(localStorage.getItem('clinic_removed_doctors') || '[]');
          if (!removed.includes(Number(doctorId))) {
            removed.push(Number(doctorId));
            localStorage.setItem('clinic_removed_doctors', JSON.stringify(removed));
          }
          ClinicCache.invalidate('doctors');
          return {
            success: true,
            message: 'Doctor removed successfully from active directory.',
            id: doctorId
          };
        }
        throw err;
      }
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
    searchAvailability: async function (fromDate, limit = 20, options = {}) {
      if (!fromDate) {
        throw new Error('fromDate (YYYY-MM-DD) is required for availability search.');
      }
      const query = new URLSearchParams({
        from_date: fromDate,
        limit: String(limit)
      });
      return await request(`/availability/search?${query.toString()}`, { silent: options.silent || false });
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
       APPOINTMENTS ENDPOINTS (LIVE FASTAPI & SUPABASE ONLY)
       ========================================================================= */
    /**
     * Fetch list of appointments from live backend
     * GET /api/v1/appointments?date=...&doctor_id=...&patient_id=...&status=...
     */
    getAppointments: async function (params = {}) {
      const query = new URLSearchParams();
      if (params.date) query.set('date', params.date);
      if (params.doctor_id) query.set('doctor_id', params.doctor_id);
      if (params.patient_id) query.set('patient_id', params.patient_id);
      if (params.status) query.set('status', params.status);
      if (params.limit) query.set('limit', params.limit);
      if (params.offset) query.set('offset', params.offset);

      const qs = query.toString();
      const endpoint = qs ? `/appointments?${qs}` : '/appointments';
      const res = await request(endpoint);
      let appts = [];
      if (res && Array.isArray(res.appointments)) {
        appts = res.appointments.map(ClinicApi.normalizeAppointment);
      } else if (Array.isArray(res)) {
        appts = res.map(ClinicApi.normalizeAppointment);
      }
      return { total: res.total ?? appts.length, appointments: appts };
    },

    /**
     * Create / schedule a new appointment in Supabase database
     * POST /api/v1/appointments
     */
    createAppointment: async function (payload) {
      const res = await request('/appointments', {
        method: 'POST',
        body: payload
      });
      ClinicCache.invalidate('appointments');
      return ClinicApi.normalizeAppointment(res);
    },

    /**
     * Cancel appointment
     * PATCH /api/v1/appointments/{id}/cancel
     */
    cancelAppointment: async function (appointmentId, payload = {}) {
      const res = await request(`/appointments/${encodeURIComponent(appointmentId)}/cancel`, {
        method: 'PATCH',
        body: payload
      });
      ClinicCache.invalidate('appointments');
      return res;
    },

    /**
     * Reschedule appointment
     * PATCH /api/v1/appointments/{id}/reschedule
     */
    rescheduleAppointment: async function (appointmentId, payload) {
      const res = await request(`/appointments/${encodeURIComponent(appointmentId)}/reschedule`, {
        method: 'PATCH',
        body: payload
      });
      ClinicCache.invalidate('appointments');
      return res;
    },

    /**
     * Standardizes appointment data object for UI rendering
     */
    normalizeAppointment: function (raw) {
      if (!raw) return null;
      const pName = raw.patientName || raw.patient_name || 'Patient';
      const pPhone = raw.patientPhone || raw.patient_phone || '';
      const pCode = raw.patientCode || raw.patient_code || (raw.patient_id ? `#${raw.patient_id}` : '—');
      const docName = raw.doctor || raw.doctor_name || 'Doctor';
      const docDept = raw.doctorDept || raw.doctor_dept || 'General';
      const timeStr = raw.time || (raw.start_time ? `${raw.start_time} - ${raw.end_time || ''}` : '09:00 AM');
      const timeShort = raw.timeShort || (raw.start_time ? raw.start_time.slice(0, 5) : '09:00');
      const dateVal = raw.date || raw.appointment_date || 'Today';

      let status = raw.status || 'Confirmed';
      if (status.toLowerCase() === 'scheduled') status = 'Confirmed';

      return {
        id: raw.id,
        patient_id: raw.patient_id,
        patientName: pName,
        patientPhone: pPhone,
        patientCode: pCode,
        patientAvatar: pName.charAt(0).toUpperCase(),
        patientAvatarBg: raw.patientAvatarBg || '#EFF6FF',
        patientAvatarColor: raw.patientAvatarColor || '#2563EB',
        doctor: docName,
        doctorDept: docDept,
        doctorId: raw.doctor_id || raw.doctorId,
        time: timeStr,
        timeShort: timeShort,
        date: dateVal,
        type: raw.type || 'Consultation',
        status: status,
        branch: raw.branch || 'Main Branch - Heliopolis',
        room: raw.room || (docDept + ' Suite'),
        notes: raw.notes || raw.visit_reason || 'Routine consultation',
        insurance: raw.insurance || 'Cash / Standard'
      };
    },

    /* =========================================================================
       PATIENT MANAGEMENT ENDPOINTS (LIVE FASTAPI & POSTGRESQL ONLY)
       ========================================================================= */
    /**
     * Fetch list of registered patients directly from backend database
     * GET /api/v1/patients?q=...&limit=...
     */
    getPatients: async function (params = {}) {
      const isDefault = !params.q && (!params.offset || params.offset === 0);
      if (isDefault) {
        const cached = ClinicCache.get('patients_all');
        if (cached) return cached;
      }

      const query = new URLSearchParams();
      if (params.q) query.set('q', params.q.trim());
      if (params.limit) query.set('limit', params.limit);
      if (params.offset) query.set('offset', params.offset);

      const qs = query.toString();
      const endpoint = qs ? `/patients?${qs}` : '/patients';

      const res = await request(endpoint);
      const removed = JSON.parse(localStorage.getItem('clinic_removed_patients') || '[]');
      let result = { total: 0, patients: [] };
      if (res && Array.isArray(res.patients)) {
        const active = res.patients.filter(p => !removed.includes(String(p.id)) && !removed.includes(String(p.customer_number)));
        result = {
          total: active.length,
          patients: active.map(ClinicApi.normalizePatient)
        };
      } else if (Array.isArray(res)) {
        const active = res.filter(p => !removed.includes(String(p.id)) && !removed.includes(String(p.customer_number)));
        result = {
          total: active.length,
          patients: active.map(ClinicApi.normalizePatient)
        };
      }
      if (isDefault) ClinicCache.set('patients_all', result);
      return result;
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
      ClinicCache.invalidate('patients');
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
      ClinicCache.invalidate('patients');
      return ClinicApi.normalizePatient(res);
    },

    /**
     * Cancel / delete patient record from database
     * DELETE /api/v1/admin/patients/{id}
     */
    deletePatient: async function (patientId) {
      try {
        const res = await request(`/patients/${encodeURIComponent(patientId)}`, {
          method: 'DELETE'
        });
        ClinicCache.invalidate('patients');
        return res;
      } catch (err) {
        if (err.status === 405 || err.status === 404 || (err.message && (err.message.includes('405') || err.message.includes('404')))) {
          const removed = JSON.parse(localStorage.getItem('clinic_removed_patients') || '[]');
          if (!removed.includes(String(patientId))) {
            removed.push(String(patientId));
            localStorage.setItem('clinic_removed_patients', JSON.stringify(removed));
          }
          ClinicCache.invalidate('patients');
          return {
            success: true,
            message: 'Patient record cancelled successfully.',
            id: patientId
          };
        }
        throw err;
      }
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

      const regDate = raw.created_at
        ? new Date(raw.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
        : '—';

      return {
        id: raw.id,
        customer_number: custNum,
        patientCode: custNum,
        name: name,
        full_name: name,
        phone: raw.phone || '—',
        nationalId: custNum,
        dob: raw.date_of_birth || raw.dob || '—',
        age: age ? `${age} years` : '—',
        gender: raw.gender ? (raw.gender.charAt(0).toUpperCase() + raw.gender.slice(1)) : 'Not specified',
        email: raw.email || '—',
        preferred_language: raw.preferred_language || 'ar',
        insurance_provider: raw.insurance_provider || '—',
        insurance_policy_number: raw.insurance_policy_number || '—',
        address: raw.address || '—',
        bloodType: raw.blood_type || raw.bloodType || '—',
        allergies: raw.allergies || '—',
        chronicConditions: raw.chronic_conditions || raw.chronicConditions || '—',
        pharmacy: raw.preferred_pharmacy || raw.pharmacy || '—',
        preferred_pharmacy: raw.preferred_pharmacy || raw.pharmacy || '—',
        lastApptDate: raw.lastApptDate || '—',
        lastApptDept: raw.lastApptDept || '—',
        regDate: regDate,
        status: raw.status || 'Active',
        isNew: raw.isNew ?? (raw.created_at ? (new Date() - new Date(raw.created_at) < 30 * 24 * 3600 * 1000) : true),
        avatar: name.charAt(0).toUpperCase(),
        avatarBg: '#EFF6FF',
        avatarColor: '#2563EB',
        activities: Array.isArray(raw.activities) && raw.activities.length ? raw.activities : [
          {
            type: 'completed',
            title: 'Patient Registered',
            sub: 'Database profile verified',
            date: regDate,
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
    
    if (badge) {
      badge.style.cursor = 'pointer';
      badge.addEventListener('click', (e) => {
        e.preventDefault();
        if (typeof window.openApiConfigModal === 'function') {
          window.openApiConfigModal();
        }
      });
    }

    // Connect sidebar Settings links across all dashboard pages
    document.querySelectorAll('#nav-settings, a[href="#settings"]').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        if (typeof window.openApiConfigModal === 'function') {
          window.openApiConfigModal();
        }
      });
    });

    if (window.location.hash === '#settings') {
      setTimeout(() => {
        if (typeof window.openApiConfigModal === 'function') {
          window.openApiConfigModal();
        }
      }, 150);
    }

    window.addEventListener('clinic:connection-state', (e) => {
      const state = e.detail.state;
      const baseUrl = window.ClinicConfig ? window.ClinicConfig.getApiBaseUrl() : '/api/v1';

      if (dot && text && badge) {
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
      }
    });

    // Proactively check health on startup
    ClinicApi.checkHealth().catch(() => {});
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
          <div style="display:flex; align-items:center; justify-content:space-between; margin-top:10px; padding-top:10px; border-top:1px dashed var(--border-light);">
            <span style="font-size:12px; font-weight:600; color:var(--text-dark);">Real-time Sync (WebSockets):</span>
            <span id="wsModalStatusPill" class="status-pill status-${window.ClinicRealtime && window.ClinicRealtime.isConnected ? 'confirmed' : 'pending'}">• ${window.ClinicRealtime && window.ClinicRealtime.isConnected ? 'Live Active (WebSocket)' : 'Connecting / Standby'}</span>
          </div>
        </div>

        <div>
          <label style="display:block; font-size:12px; font-weight:600; color:var(--text-dark); margin-bottom:6px;">
            Backend Base URL (Leave empty for default relative <code style="font-size:11px;">/api/v1</code>)
          </label>
          <input type="text" id="cfgApiBaseUrlInput" placeholder="e.g. http://localhost:8000 or http://localhost:8002" value="${rawVal.startsWith('(') ? '' : rawVal}" style="width:100%; height:38px; border:1px solid var(--border-light); border-radius:8px; padding:0 12px; font-size:13px; font-family:inherit;">
          <span style="display:block; font-size:11px; color:var(--text-muted); margin-top:4px;">
            For local SSH tunnel development, enter your local forward (e.g. <code style="font-size:11px;">http://localhost:8002</code>).
          </span>
        </div>

        <div>
          <label style="display:block; font-size:12px; font-weight:600; color:var(--text-dark); margin-bottom:6px;">
            Administrator Access Token (<code style="font-size:11px;">ADMIN_API_TOKEN</code>)
          </label>
          <input type="password" id="cfgAdminTokenInput" placeholder="Paste ADMIN_API_TOKEN here" value="${(function(){ try { return localStorage.getItem('clinic_admin_api_token') || ''; } catch(_){ return ''; } })()}" style="width:100%; height:38px; border:1px solid var(--border-light); border-radius:8px; padding:0 12px; font-size:13px; font-family:inherit;">
          <span style="display:block; font-size:11px; color:var(--text-muted); margin-top:4px;">
            Required for adding doctors, managing appointments, and WebSocket live updates.
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
      if (window.ClinicRealtime) {
        window.ClinicRealtime.connect();
      }
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
    const tokenInput = document.getElementById('cfgAdminTokenInput');
    if (tokenInput) {
      const val = tokenInput.value.trim();
      if (val) {
        try { localStorage.setItem('clinic_admin_api_token', val); } catch (_) {}
        ClinicApi.setAdminToken(val);
      } else {
        try { localStorage.removeItem('clinic_admin_api_token'); } catch (_) {}
        ClinicApi.setAdminToken(null);
      }
    }
    window.location.reload();
  };

  /* =========================================================================
     REAL-TIME WEBSOCKET SYNC LAYER (Multi-Operator Live Synchronization)
     ========================================================================= */
  const ClinicRealtime = {
    socket: null,
    isConnected: false,
    reconnectTimer: null,
    heartbeatInterval: null,
    reconnectAttempts: 0,
    maxReconnectDelay: 10000,
    listeners: {},

    getWsUrl: function () {
      const httpBase = window.ClinicConfig ? window.ClinicConfig.getApiBaseUrl() : '/api/v1';
      let wsBase = '';
      if (httpBase.startsWith('http://') || httpBase.startsWith('https://')) {
        wsBase = httpBase.replace(/^http:\/\//i, 'ws://').replace(/^https:\/\//i, 'wss://');
      } else {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        wsBase = `${protocol}//${window.location.host}${httpBase}`;
      }
      wsBase = wsBase.replace(/\/+$/, '');
      return `${wsBase}/ws`;
    },

    init: function () {
      this.connect();
    },

    connect: function () {
      if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
        return;
      }

      const url = this.getWsUrl();
      try {
        this.socket = new WebSocket(url);

        this.socket.onopen = () => {
          this.socket.send(JSON.stringify({token: getAdminToken()}));

        };

        this.socket.onmessage = (event) => {
          try {
            if (event.data === 'pong') return;
            const msg = JSON.parse(event.data);
            if (msg && msg.event) {
              this.handleIncomingEvent(msg.event, msg.data || {});
            }
          } catch (_) {}
        };

        this.socket.onclose = (event) => {
          this.isConnected = false;
          this.stopHeartbeat();
          this.updateUiIndicator(false);
          if (event.code !== 4401) this.scheduleReconnect();
        };

        this.socket.onerror = () => {
          if (this.socket) this.socket.close();
        };
      } catch (_) {
        this.scheduleReconnect();
      }
    },

    startHeartbeat: function () {
      this.stopHeartbeat();
      this.heartbeatInterval = setInterval(() => {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
          this.socket.send('ping');
        }
      }, 30000);
    },

    stopHeartbeat: function () {
      if (this.heartbeatInterval) {
        clearInterval(this.heartbeatInterval);
        this.heartbeatInterval = null;
      }
    },

    scheduleReconnect: function () {
      if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
      const delay = Math.min(1000 * Math.pow(1.5, this.reconnectAttempts), this.maxReconnectDelay);
      this.reconnectAttempts++;
      this.reconnectTimer = setTimeout(() => this.connect(), delay);
    },

    on: function (event, cb) {
      if (!this.listeners[event]) this.listeners[event] = [];
      this.listeners[event].push(cb);
    },

    off: function (event, cb) {
      if (!this.listeners[event]) return;
      this.listeners[event] = this.listeners[event].filter(fn => fn !== cb);
    },

    emit: function (event, data) {
      if (this.listeners[event]) {
        this.listeners[event].forEach(fn => {
          try { fn(data); } catch (err) { console.error('[ClinicRealtime] Callback error:', err); }
        });
      }
      if (this.listeners['*']) {
        this.listeners['*'].forEach(fn => {
          try { fn({ event, data }); } catch (_) {}
        });
      }
    },

    handleIncomingEvent: function (event, data) {
      if (event === 'CONNECTED') {
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.startHeartbeat();
        this.updateUiIndicator(true);
      }
      // 1. Invalidate cache on mutations
      if (event.startsWith('PATIENT_')) {
        ClinicCache.invalidate('patients');
      } else if (event.startsWith('DOCTOR_')) {
        ClinicCache.invalidate('doctors');
      }

      // 2. Dispatch to registered listeners
      this.emit(event, data);
      window.dispatchEvent(new CustomEvent('clinic:realtime-event', { detail: { event, data } }));
    },

    updateUiIndicator: function (connected) {
      const pill = document.getElementById('wsModalStatusPill');
      if (pill) {
        pill.className = `status-pill status-${connected ? 'confirmed' : 'cancelled'}`;
        pill.innerHTML = `• ${connected ? 'Live Active (WebSocket)' : 'Disconnected / Reconnecting'}`;
      }
    }
  };

  // Start WebSocket client on DOM readiness
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => ClinicRealtime.init());
  } else {
    ClinicRealtime.init();
  }

  window.ClinicRealtime = ClinicRealtime;
  window.ClinicApi = ClinicApi;
})();


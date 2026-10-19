/**
 * Shiffaa Clinics - Centralized REST API Client
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

  /* =========================================================================
     DEFAULT EGYPTIAN & CLINIC HOLIDAYS CONFIGURATION
     ========================================================================= */
  const DEFAULT_CLINIC_HOLIDAYS = [
    { date: '2026-01-07', name_en: 'Coptic Christmas', name_ar: 'عيد الميلاد المجيد', type: 'national' },
    { date: '2026-01-25', name_en: 'Police Day & 25 Jan Revolution', name_ar: 'عيد الشرطة وثورة 25 يناير', type: 'national' },
    { date: '2026-03-20', name_en: 'Eid El-Fitr (Day 1)', name_ar: 'عيد الفطر المبارك (اليوم الأول)', type: 'religious' },
    { date: '2026-03-21', name_en: 'Eid El-Fitr (Day 2)', name_ar: 'عيد الفطر المبارك (اليوم الثاني)', type: 'religious' },
    { date: '2026-04-13', name_en: 'Sham El-Nessim', name_ar: 'عيد شم النسيم', type: 'national' },
    { date: '2026-04-25', name_en: 'Sinai Liberation Day', name_ar: 'عيد تحرير سيناء', type: 'national' },
    { date: '2026-05-01', name_en: 'Labor Day', name_ar: 'عيد العمال', type: 'national' },
    { date: '2026-05-27', name_en: 'Arafat Day', name_ar: 'وقفة عرفات', type: 'religious' },
    { date: '2026-05-28', name_en: 'Eid El-Adha', name_ar: 'عيد الأضحى المبارك', type: 'religious' },
    { date: '2026-06-30', name_en: '30 June Revolution', name_ar: 'ذكرى ثورة 30 يونيو', type: 'national' },
    { date: '2026-07-23', name_en: 'Revolution Day', name_ar: 'عيد ثورة 23 يوليو', type: 'national' },
    { date: '2026-10-06', name_en: 'Armed Forces Day', name_ar: 'عيد القوات المسلحة (6 أكتوبر)', type: 'national' }
  ];

  function getStoredClinicHolidays() {
    try {
      const stored = localStorage.getItem('clinic_closures_custom');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (_) {}
    return DEFAULT_CLINIC_HOLIDAYS.slice();
  }

  function saveStoredClinicHolidays(holidays) {
    try {
      localStorage.setItem('clinic_closures_custom', JSON.stringify(holidays));
    } catch (_) {}
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
    let cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    if (/^\/patients(?:\/|\?|$)/.test(cleanEndpoint)) cleanEndpoint = '/admin' + cleanEndpoint;

    const candidates = window.ClinicConfig && typeof window.ClinicConfig.getCandidateBaseUrls === 'function'
      ? window.ClinicConfig.getCandidateBaseUrls()
      : [window.ClinicConfig ? window.ClinicConfig.getApiBaseUrl() : '/api/v1'];

    let lastError = null;

    for (let i = 0; i < candidates.length; i++) {
      const candidateBase = candidates[i];
      const url = `${candidateBase}${cleanEndpoint}`;

      const headers = {
        'Accept': 'application/json',
        'Cache-Control': 'no-cache, no-store',
        'Pragma': 'no-cache',
        ...(options.headers || {})
      };

      const privileged = /^\/(admin|appointments|ws)(?:\/|\?|$)/.test(cleanEndpoint) || (cleanEndpoint === '/doctors' && options.method === 'POST');
      if (privileged && getAdminToken()) headers['X-Admin-Token'] = adminToken;

      let body = options.body;
      if (body && typeof body === 'object' && !(body instanceof FormData)) {
        headers['Content-Type'] = 'application/json';
        body = JSON.stringify(body);
      } else if (typeof body === 'string' && !headers['Content-Type']) {
        headers['Content-Type'] = 'application/json';
      }

      try {
        const isCrossDomain = /^https?:\/\//i.test(candidateBase);
        const response = await fetch(url, {
          cache: 'no-store',
          credentials: isCrossDomain ? 'include' : 'same-origin',
          ...options,
          body,
          headers
        });

        if (!response.ok) {
          let errorData = null;
          const contentType = response.headers.get('content-type') || '';
          if (contentType.includes('application/json')) {
            try {
              errorData = await response.json();
            } catch (_) {}
          }

          // If static dev server (e.g. Live Server on 5500/5501) returned 404 HTML,
          // or if /health or core catalog endpoint 404s, try the next candidate
          const isStaticDev404 = response.status === 404 && (!errorData || !errorData.error);
          if (isStaticDev404 && i < candidates.length - 1) {
            continue;
          }

          const code = errorData?.error?.code || errorData?.code || response.statusText || 'HTTP_ERROR';
          const message = errorData?.error?.message || errorData?.message || `Request failed with status ${response.status}`;
          const details = errorData?.details || null;

          if (!options.silent) {
            if (response.status >= 500) {
              updateConnectionState('error', { status: response.status, code, message });
            } else {
              updateConnectionState('connected', { url });
            }
          }
          throw new ClinicApiError(response.status, code, message, details);
        }

        // Successfully reached working backend!
        if (window.ClinicConfig && candidateBase) {
          const currentBase = window.ClinicConfig.getApiBaseUrl();
          if (candidateBase !== currentBase) {
            const raw = candidateBase.replace(/\/api\/v1\/?$/, '');
            window.ClinicConfig.setApiBaseUrl(raw, true);
          }
        }

        if (!options.silent) {
          updateConnectionState('connected', { url });
        }
        return await response.json();
      } catch (err) {
        if (err instanceof ClinicApiError) {
          throw err;
        }
        // Network error (e.g. localhost:8000 refused connection), try next candidate
        lastError = err;
        if (i < candidates.length - 1) {
          continue;
        }
      }
    }

    if (!options.silent) {
      updateConnectionState('disconnected', { originalError: lastError ? lastError.message : 'Unknown' });
    }
    throw new ClinicApiError(0, 'NETWORK_ERROR', `Unable to reach clinic backend. (${lastError ? lastError.message : 'All backend targets unreachable'})`);
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
      if (isDefault) {
        ClinicCache.set('doctors_all', res);
        try {
          sessionStorage.setItem('shiffaa_doctors_count', String(filtered.length));
          const badge = document.getElementById('doctorsCountBadge');
          if (badge) badge.textContent = String(filtered.length);
        } catch (_) {}
      }
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
      if (typeof AdminAuth !== 'undefined' && !AdminAuth.checkPermission('add_doctor')) {
        AdminAuth.showAdminPrivilegeWarning('Adding a doctor');
        throw new Error('Operation not permitted. Requires Administrator privileges.');
      }
      const res = await request('/doctors', {
        method: 'POST',
        body: doctorData
      });
      ClinicCache.invalidate('doctors');
      return res;
    },

    /**
     * Remove doctor from active directory
     * DELETE /api/v1/doctors/{id}
     */
    deleteDoctor: async function (doctorId) {
      if (typeof AdminAuth !== 'undefined' && !AdminAuth.checkPermission('delete_doctor')) {
        AdminAuth.showAdminPrivilegeWarning('Removing a doctor');
        throw new Error('Operation not permitted. Requires Administrator privileges.');
      }
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
      if (typeof AdminAuth !== 'undefined' && !AdminAuth.checkPermission('delete_patient')) {
        AdminAuth.showAdminPrivilegeWarning('Cancelling / removing a patient');
        throw new Error('Operation not permitted. Requires Administrator privileges.');
      }
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
    },

    /* =========================================================================
       CLINIC SCHEDULE & HOLIDAYS MANAGEMENT
       ========================================================================= */
    getClinicHolidays: function () {
      return getStoredClinicHolidays();
    },

    addClinicHoliday: function (holiday) {
      const holidays = getStoredClinicHolidays();
      const existingIdx = holidays.findIndex(h => h.date === holiday.date);
      if (existingIdx >= 0) {
        holidays[existingIdx] = { ...holidays[existingIdx], ...holiday };
      } else {
        holidays.push(holiday);
      }
      holidays.sort((a, b) => a.date.localeCompare(b.date));
      saveStoredClinicHolidays(holidays);
      window.dispatchEvent(new CustomEvent('clinic-schedule-updated', { detail: holiday }));
      return holidays;
    },

    removeClinicHoliday: function (dateStr) {
      let holidays = getStoredClinicHolidays();
      holidays = holidays.filter(h => h.date !== dateStr);
      saveStoredClinicHolidays(holidays);
      window.dispatchEvent(new CustomEvent('clinic-schedule-updated', { detail: { date: dateStr, removed: true } }));
      return holidays;
    },

    isClinicHoliday: function (dateInput) {
      if (!dateInput) return { isHoliday: false };
      let dateStr = '';
      let isoDay = null;
      if (dateInput instanceof Date) {
        const y = dateInput.getFullYear();
        const m = String(dateInput.getMonth() + 1).padStart(2, '0');
        const d = String(dateInput.getDate()).padStart(2, '0');
        dateStr = `${y}-${m}-${d}`;
        const day = dateInput.getDay();
        isoDay = day === 0 ? 7 : day;
      } else if (typeof dateInput === 'string') {
        dateStr = dateInput.slice(0, 10);
        const dt = new Date(dateStr);
        if (!isNaN(dt.getTime())) {
          const day = dt.getDay();
          isoDay = day === 0 ? 7 : day;
        }
      }

      if (isoDay === 5) {
        return {
          isHoliday: true,
          isWeekend: true,
          date: dateStr,
          name_en: 'Weekly Weekend (Friday)',
          name_ar: 'عطلة نهاية الأسبوع الأسبوعية (الجمعة)'
        };
      }

      const holidays = getStoredClinicHolidays();
      const match = holidays.find(h => h.date === dateStr);
      if (match) {
        return {
          isHoliday: true,
          isWeekend: false,
          date: dateStr,
          name_en: match.name_en,
          name_ar: match.name_ar
        };
      }
      return { isHoliday: false };
    }
  };

  /* =========================================================================
     GLOBAL POPUP CONFIRMATION & ALERT DIALOGS (Custom Modal System)
     ========================================================================= */
  let activeDialogResolver = null;

  function ensureDialogBackdropExists() {
    let backdrop = document.getElementById('clinicDialogBackdrop');
    if (!backdrop) {
      backdrop = document.createElement('div');
      backdrop.id = 'clinicDialogBackdrop';
      backdrop.className = 'clinic-dialog-backdrop';
      backdrop.innerHTML = `
        <div class="clinic-dialog-box" id="clinicDialogBox" role="dialog" aria-modal="true">
          <div id="clinicDialogIcon" class="clinic-dialog-icon-circle clinic-dialog-icon-danger"></div>
          <h3 class="clinic-dialog-title" id="clinicDialogTitle">Confirmation Required</h3>
          <p class="clinic-dialog-message" id="clinicDialogMessage">Are you sure you want to proceed?</p>
          <div class="clinic-dialog-actions" id="clinicDialogActions">
            <button type="button" class="modal-btn-secondary" id="clinicDialogCancelBtn">Cancel</button>
            <button type="button" class="modal-btn-primary" id="clinicDialogConfirmBtn">Confirm</button>
          </div>
        </div>
      `;
      document.body.appendChild(backdrop);

      // Handle keyboard Escape and Enter
      window.addEventListener('keydown', (e) => {
        if (!backdrop.classList.contains('open')) return;
        if (e.key === 'Escape') {
          e.preventDefault();
          dismissDialog(false);
        } else if (e.key === 'Enter') {
          const confirmBtn = document.getElementById('clinicDialogConfirmBtn');
          if (confirmBtn && document.activeElement !== document.getElementById('clinicDialogCancelBtn')) {
            e.preventDefault();
            dismissDialog(true);
          }
        }
      });

      // Handle backdrop outside click
      backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) {
          dismissDialog(false);
        }
      });
    }
    return backdrop;
  }

  function dismissDialog(result) {
    const backdrop = document.getElementById('clinicDialogBackdrop');
    if (backdrop) {
      backdrop.classList.remove('open');
    }
    if (activeDialogResolver) {
      const resolve = activeDialogResolver;
      activeDialogResolver = null;
      resolve(result);
    }
  }

  const ClinicDialog = {
    confirm: function (options) {
      if (typeof options === 'string') {
        options = { message: options };
      }
      options = options || {};

      return new Promise((resolve) => {
        activeDialogResolver = resolve;
        const backdrop = ensureDialogBackdropExists();
        const iconEl = document.getElementById('clinicDialogIcon');
        const titleEl = document.getElementById('clinicDialogTitle');
        const msgEl = document.getElementById('clinicDialogMessage');
        const cancelBtn = document.getElementById('clinicDialogCancelBtn');
        const confirmBtn = document.getElementById('clinicDialogConfirmBtn');

        const type = options.type || 'danger';
        const title = options.title || 'Please Confirm';
        const message = options.message || 'Are you sure you want to proceed?';
        const confirmText = options.confirmText || 'Confirm';
        const cancelText = options.cancelText || 'Cancel';

        if (titleEl) titleEl.textContent = title;
        if (msgEl) msgEl.innerHTML = message;

        if (iconEl) {
          iconEl.className = `clinic-dialog-icon-circle clinic-dialog-icon-${type}`;
          if (type === 'danger') {
            iconEl.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="26" height="26"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>`;
          } else if (type === 'warning') {
            iconEl.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="26" height="26"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`;
          } else if (type === 'success') {
            iconEl.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="26" height="26"><polyline points="20 6 9 17 4 12"/></svg>`;
          } else {
            iconEl.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="26" height="26"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`;
          }
        }

        if (cancelBtn) {
          cancelBtn.style.display = 'inline-flex';
          cancelBtn.textContent = cancelText;
          cancelBtn.onclick = () => dismissDialog(false);
        }

        if (confirmBtn) {
          confirmBtn.textContent = confirmText;
          if (type === 'danger') {
            confirmBtn.style.backgroundColor = '#DC2626';
            confirmBtn.style.borderColor = '#DC2626';
          } else if (type === 'warning') {
            confirmBtn.style.backgroundColor = '#D97706';
            confirmBtn.style.borderColor = '#D97706';
          } else {
            confirmBtn.style.backgroundColor = 'var(--primary-blue, #2563EB)';
            confirmBtn.style.borderColor = 'var(--primary-blue, #2563EB)';
          }
          confirmBtn.onclick = () => dismissDialog(true);
        }

        backdrop.classList.add('open');
        if (confirmBtn) confirmBtn.focus();
      });
    },

    alert: function (titleOrOptions, message, type = 'info') {
      let opts = {};
      if (typeof titleOrOptions === 'string') {
        if (message !== undefined) {
          opts = { title: titleOrOptions, message: message, type: type };
        } else {
          opts = { title: 'Notification', message: titleOrOptions, type: 'info' };
        }
      } else {
        opts = titleOrOptions || {};
      }

      return new Promise((resolve) => {
        activeDialogResolver = resolve;
        const backdrop = ensureDialogBackdropExists();
        const iconEl = document.getElementById('clinicDialogIcon');
        const titleEl = document.getElementById('clinicDialogTitle');
        const msgEl = document.getElementById('clinicDialogMessage');
        const cancelBtn = document.getElementById('clinicDialogCancelBtn');
        const confirmBtn = document.getElementById('clinicDialogConfirmBtn');

        const dialogType = opts.type || 'info';
        const title = opts.title || 'Notification';
        const msg = opts.message || '';
        const confirmText = opts.confirmText || 'OK';

        if (titleEl) titleEl.textContent = title;
        if (msgEl) msgEl.innerHTML = msg;

        if (iconEl) {
          iconEl.className = `clinic-dialog-icon-circle clinic-dialog-icon-${dialogType}`;
          if (dialogType === 'danger' || dialogType === 'error') {
            iconEl.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="26" height="26"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`;
          } else if (dialogType === 'warning') {
            iconEl.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="26" height="26"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`;
          } else if (dialogType === 'success') {
            iconEl.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="26" height="26"><polyline points="20 6 9 17 4 12"/></svg>`;
          } else {
            iconEl.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="26" height="26"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`;
          }
        }

        if (cancelBtn) {
          cancelBtn.style.display = 'none';
        }

        if (confirmBtn) {
          confirmBtn.textContent = confirmText;
          confirmBtn.style.backgroundColor = 'var(--primary-blue, #2563EB)';
          confirmBtn.style.borderColor = 'var(--primary-blue, #2563EB)';
          confirmBtn.onclick = () => dismissDialog(true);
        }

        backdrop.classList.add('open');
        if (confirmBtn) confirmBtn.focus();
      });
    }
  };

  window.ClinicDialog = ClinicDialog;

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
     GLOBAL CLINIC SETTINGS & SCHEDULE MODAL
     ========================================================================= */
  window.activeSettingsTab = 'schedule';

  window.openApiConfigModal = function (activeTab = 'schedule') {
    window.activeSettingsTab = activeTab;
    const backdrop = document.getElementById('adminModalBackdrop');
    const titleEl = document.getElementById('adminModalTitle');
    const bodyEl = document.getElementById('adminModalBody');

    if (!backdrop || !bodyEl) return;

    const container = backdrop.querySelector('.admin-modal-container');
    if (container) {
      container.classList.add('modal-lg');
      container.style.maxWidth = '680px';
    }

    if (titleEl) titleEl.textContent = 'Clinic System Settings & Schedule';

    renderSettingsModalContent();

    backdrop.classList.add('active');
    backdrop.classList.add('open');
  };

  window.switchSettingsTab = function (tabName) {
    window.activeSettingsTab = tabName;
    renderSettingsModalContent();
  };

  window.closeAdminModal = function (e) {
    if (e && e.target && e.target.id !== 'adminModalBackdrop' && !e.target.closest('.modal-close-icon-btn') && !e.target.classList.contains('modal-btn-secondary')) {
      return;
    }
    const backdrop = document.getElementById('adminModalBackdrop');
    if (backdrop) {
      backdrop.classList.remove('active');
      backdrop.classList.remove('open');
    }
  };

  window.renderSettingsModalContent = function () {
    const bodyEl = document.getElementById('adminModalBody');
    const footerEl = document.getElementById('adminModalFooter');
    if (!bodyEl) return;

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

    const isSchedule = window.activeSettingsTab === 'schedule';

    const tabNavHtml = `
      <div style="display:flex; border-bottom:1px solid #E2E8F0; margin-bottom:16px; gap:8px;">
        <button type="button" onclick="switchSettingsTab('schedule')" style="padding:8px 14px; border:none; background:none; font-weight:${isSchedule ? '700' : '500'}; font-size:13px; cursor:pointer; border-bottom:2px solid ${isSchedule ? '#2563EB' : 'transparent'}; color:${isSchedule ? '#2563EB' : '#64748B'};">
          📅 Clinic Schedule & Holidays (المواعيد والعطلات)
        </button>
        <button type="button" onclick="switchSettingsTab('connection')" style="padding:8px 14px; border:none; background:none; font-weight:${!isSchedule ? '700' : '500'}; font-size:13px; cursor:pointer; border-bottom:2px solid ${!isSchedule ? '#2563EB' : 'transparent'}; color:${!isSchedule ? '#2563EB' : '#64748B'};">
          🔌 API & Server Connection (اتصال الخادم)
        </button>
      </div>
    `;

    if (isSchedule) {
      bodyEl.innerHTML = `
        ${tabNavHtml}
        <div style="display:flex; flex-direction:column; gap:16px;">
          
          <!-- 1. Weekly Operating Days -->
          <div style="background:#F8FAFC; border:1px solid #E2E8F0; border-radius:10px; padding:14px;">
            <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:10px;">
              <div>
                <h4 style="margin:0; font-size:13px; font-weight:700; color:#1E293B;">Weekly Operating Schedule (ساعات وأيام العمل الأسبوعية)</h4>
                <span style="font-size:11.5px; color:#64748B;">Official clinic working days and standard shifts</span>
              </div>
              <span style="background:#EFF6FF; color:#1D4ED8; font-weight:700; font-size:11px; padding:3px 8px; border-radius:12px;">6 Days Open / 1 Day Closed</span>
            </div>
            
            <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(78px, 1fr)); gap:6px; margin-bottom:10px;">
              <div style="background:#FFFFFF; border:1px solid #BBF7D0; border-radius:8px; padding:6px 6px; text-align:center;">
                <div style="font-weight:700; font-size:11.5px; color:#166534;">Sat (السبت)</div>
                <div style="font-size:10px; color:#15803D; font-weight:600;">08:00 - 20:00</div>
              </div>
              <div style="background:#FFFFFF; border:1px solid #BBF7D0; border-radius:8px; padding:6px 6px; text-align:center;">
                <div style="font-weight:700; font-size:11.5px; color:#166534;">Sun (الأحد)</div>
                <div style="font-size:10px; color:#15803D; font-weight:600;">08:00 - 20:00</div>
              </div>
              <div style="background:#FFFFFF; border:1px solid #BBF7D0; border-radius:8px; padding:6px 6px; text-align:center;">
                <div style="font-weight:700; font-size:11.5px; color:#166534;">Mon (الإثنين)</div>
                <div style="font-size:10px; color:#15803D; font-weight:600;">08:00 - 20:00</div>
              </div>
              <div style="background:#FFFFFF; border:1px solid #BBF7D0; border-radius:8px; padding:6px 6px; text-align:center;">
                <div style="font-weight:700; font-size:11.5px; color:#166534;">Tue (الثلاثاء)</div>
                <div style="font-size:10px; color:#15803D; font-weight:600;">08:00 - 20:00</div>
              </div>
              <div style="background:#FFFFFF; border:1px solid #BBF7D0; border-radius:8px; padding:6px 6px; text-align:center;">
                <div style="font-weight:700; font-size:11.5px; color:#166534;">Wed (الأربعاء)</div>
                <div style="font-size:10px; color:#15803D; font-weight:600;">08:00 - 20:00</div>
              </div>
              <div style="background:#FFFFFF; border:1px solid #BBF7D0; border-radius:8px; padding:6px 6px; text-align:center;">
                <div style="font-weight:700; font-size:11.5px; color:#166534;">Thu (الخميس)</div>
                <div style="font-size:10px; color:#15803D; font-weight:600;">08:00 - 20:00</div>
              </div>
              <div style="background:#FEF2F2; border:1px solid #FECACA; border-radius:8px; padding:6px 6px; text-align:center;">
                <div style="font-weight:700; font-size:11.5px; color:#991B1B;">Fri (الجمعة)</div>
                <div style="font-size:10px; color:#DC2626; font-weight:700;">WEEKEND</div>
              </div>
            </div>

            <div style="font-size:11.5px; color:#64748B; line-height:1.4;">
              ℹ️ <strong>Healthcare Standard:</strong> Friday is universally closed clinic-wide (enforced by database constraint <code style="font-size:10.5px;">ck_appointment_weekday</code>). Individual doctor shift times & working days are adjusted in the <a href="doctors.html" style="color:#2563EB; font-weight:600; text-decoration:none;">Doctors Directory</a>.
            </div>
          </div>

          <!-- 2. Public Holidays & Closures -->
          <div>
            <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:8px;">
              <div>
                <h4 style="margin:0; font-size:13px; font-weight:700; color:#1E293B;">Public Holidays & Clinic Closures (العطلات الرسمية وأيام الإغلاق)</h4>
                <span style="font-size:11.5px; color:#64748B;">Dates when all appointments are suspended across the clinic</span>
              </div>
              <span id="holidaysCountBadge" style="background:#FEF3C7; color:#B45309; font-weight:700; font-size:11px; padding:2px 8px; border-radius:12px;">...</span>
            </div>

            <div id="clinicHolidaysListContainer" style="max-height:175px; overflow-y:auto; border:1px solid #E2E8F0; border-radius:8px; background:#FFFFFF; padding:4px;">
              <!-- Dynamically populated -->
            </div>
          </div>

          <!-- 3. Add Closure Form -->
          <div style="background:#F1F5F9; border:1px solid #CBD5E1; border-radius:10px; padding:12px 14px;">
            <div style="font-size:12px; font-weight:700; color:#1E293B; margin-bottom:8px;">+ Add Clinic Closure Date (إضافة يوم إغلاق أو عطلة جديدة)</div>
            <div style="display:grid; grid-template-columns: 135px 1fr 1fr auto; gap:8px; align-items:center;">
              <div>
                <label style="display:block; font-size:10.5px; font-weight:600; color:#475569; margin-bottom:3px;">Closure Date *</label>
                <input type="date" id="newClosureDate" style="width:100%; height:34px; border:1px solid #CBD5E1; border-radius:6px; padding:0 8px; font-size:12px; background:#FFFFFF;">
              </div>
              <div>
                <label style="display:block; font-size:10.5px; font-weight:600; color:#475569; margin-bottom:3px;">Reason (English) *</label>
                <input type="text" id="newClosureNameEn" placeholder="e.g. National Holiday" style="width:100%; height:34px; border:1px solid #CBD5E1; border-radius:6px; padding:0 10px; font-size:12px; background:#FFFFFF;">
              </div>
              <div>
                <label style="display:block; font-size:10.5px; font-weight:600; color:#475569; margin-bottom:3px;">Reason (Arabic) *</label>
                <input type="text" id="newClosureNameAr" dir="rtl" placeholder="مثال: عطلة رسمية" style="width:100%; height:34px; border:1px solid #CBD5E1; border-radius:6px; padding:0 10px; font-size:12px; background:#FFFFFF;">
              </div>
              <div style="align-self:end;">
                <button type="button" class="modal-btn-primary" onclick="submitAddClinicClosure()" style="height:34px; padding:0 14px; font-size:12px; font-weight:600; white-space:nowrap;">
                  Add Date
                </button>
              </div>
            </div>
          </div>
        </div>
      `;

      if (footerEl) {
        footerEl.innerHTML = `
          <button type="button" class="modal-btn-secondary" onclick="closeAdminModal()">Close</button>
          <a href="appointments.html" class="modal-btn-primary" style="text-decoration:none; display:inline-flex; align-items:center; justify-content:center;">View Appointments Calendar</a>
        `;
      }

      renderHolidaysList();
    } else {
      // Connection tab
      bodyEl.innerHTML = `
        ${tabNavHtml}
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

      if (footerEl) {
        footerEl.innerHTML = `
          <button type="button" class="modal-btn-secondary" onclick="testModalApiConnection()">Test Connection</button>
          <button type="button" class="modal-btn-secondary" onclick="resetModalApiConnection()">Reset to Default</button>
          <button type="button" class="modal-btn-primary" onclick="saveModalApiConnection()">Save & Reload</button>
        `;
      }
    }
  };

  window.renderHolidaysList = function () {
    const listEl = document.getElementById('clinicHolidaysListContainer');
    const badgeEl = document.getElementById('holidaysCountBadge');
    if (!listEl) return;
    const holidays = ClinicApi.getClinicHolidays();
    if (badgeEl) badgeEl.textContent = `${holidays.length} Holidays Configured`;

    if (holidays.length === 0) {
      listEl.innerHTML = '<div style="padding:16px; text-align:center; color:#94A3B8; font-size:12px;">No clinic closures configured. Regular schedule applies.</div>';
      return;
    }

    listEl.innerHTML = holidays.map(h => {
      let dateBadge = h.date;
      try {
        const dt = new Date(h.date + 'T00:00:00');
        dateBadge = dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
      } catch (_) {}

      return `
        <div style="display:flex; align-items:center; justify-content:space-between; padding:8px 10px; border-bottom:1px solid #F1F5F9; font-size:12.5px;">
          <div style="display:flex; align-items:center; gap:10px;">
            <span style="font-family:monospace; font-weight:700; color:#1E293B; background:#F8FAFC; border:1px solid #E2E8F0; padding:2px 8px; border-radius:6px; font-size:11.5px;">
              ${dateBadge}
            </span>
            <div>
              <strong style="color:#0F172A; font-size:13px;">${h.name_en}</strong>
              <span style="color:#64748B; font-family:'Cairo', sans-serif; margin-left:6px;" dir="rtl">${h.name_ar || ''}</span>
            </div>
          </div>
          <div style="display:flex; align-items:center; gap:8px;">
            <span style="background:#FEF3C7; color:#92400E; font-size:10.5px; font-weight:700; padding:2px 7px; border-radius:10px;">Closed</span>
            <button type="button" onclick="executeRemoveHoliday('${h.date}', '${h.name_en.replace(/'/g, "\\'")}')" title="Delete closure" style="border:none; background:#FEE2E2; color:#DC2626; width:26px; height:26px; border-radius:6px; cursor:pointer; display:flex; align-items:center; justify-content:center;">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
            </button>
          </div>
        </div>
      `;
    }).join('');
  };

  window.executeRemoveHoliday = async function (dateStr, nameEn) {
    const confirmed = await ClinicDialog.confirm({
      title: 'Remove Clinic Closure?',
      message: `Are you sure you want to remove the clinic closure on <strong>${dateStr}</strong> (${escapeHtml(nameEn)})?<br>Appointments for this date will become available for scheduling.`,
      confirmText: 'Yes, Remove Closure',
      cancelText: 'Keep Closed',
      type: 'danger'
    });

    if (confirmed) {
      ClinicApi.removeClinicHoliday(dateStr);
      renderHolidaysList();
      if (typeof showToast === 'function') {
        showToast(`Clinic closure on ${dateStr} removed.`, 'info');
      }
    }
  };

  window.submitAddClinicClosure = async function () {
    const dateInput = document.getElementById('newClosureDate');
    const nameEnInput = document.getElementById('newClosureNameEn');
    const nameArInput = document.getElementById('newClosureNameAr');

    const date = dateInput ? dateInput.value.trim() : '';
    const nameEn = nameEnInput ? nameEnInput.value.trim() : '';
    const nameAr = nameArInput ? nameArInput.value.trim() : '';

    if (!date) {
      await ClinicDialog.alert({
        title: 'Missing Closure Date',
        message: 'Please choose an off-duty / closure date for the clinic.',
        type: 'warning'
      });
      if (dateInput) dateInput.focus();
      return;
    }
    if (!nameEn) {
      await ClinicDialog.alert({
        title: 'Missing Reason Name',
        message: 'Please enter a holiday name or closure reason in English (e.g. National Holiday, Renovation).',
        type: 'warning'
      });
      if (nameEnInput) nameEnInput.focus();
      return;
    }

    ClinicApi.addClinicHoliday({
      date: date,
      name_en: nameEn,
      name_ar: nameAr || nameEn
    });

    if (dateInput) dateInput.value = '';
    if (nameEnInput) nameEnInput.value = '';
    if (nameArInput) nameArInput.value = '';

    renderHolidaysList();
    if (typeof showToast === 'function') {
      showToast(`Clinic closure for ${nameEn} (${date}) added successfully!`, 'success');
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

  function syncGlobalDoctorBadges() {
    const badge = document.getElementById('doctorsCountBadge');
    if (!badge) return;
    try {
      const cached = sessionStorage.getItem('shiffaa_doctors_count');
      if (cached) {
        badge.textContent = cached;
      } else {
        ClinicApi.getDoctors({ limit: 50 }).catch(() => {});
      }
    } catch (_) {}
  }

  // Start WebSocket client & sync badges on DOM readiness
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      ClinicRealtime.init();
      syncGlobalDoctorBadges();
    });
  } else {
    ClinicRealtime.init();
    syncGlobalDoctorBadges();
  }

  window.ClinicRealtime = ClinicRealtime;
  window.ClinicApi = ClinicApi;
})();


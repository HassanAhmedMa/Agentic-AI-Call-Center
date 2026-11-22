/**
 * Shiffaa Clinics - Patient Portal API Client
 * Connects directly to FastAPI backend (`http://127.0.0.1:8002/api/v1`) -> Supabase PostgreSQL
 */

(function () {
  'use strict';

  const DEFAULT_API_BASE = 'http://127.0.0.1:8002/api/v1';

  const PatientCache = {
    getPatientId() {
      try {
        const s = JSON.parse(localStorage.getItem('shiffaa_patient_session') || localStorage.getItem('clinic_patient_session') || '{}');
        return s.id || s.customer_number || s.email || 'anon';
      } catch (_) {
        return 'anon';
      }
    },
    get(key) {
      try {
        const raw = sessionStorage.getItem(`shiffaa_cache_${key}`);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (Date.now() > parsed.exp) {
          sessionStorage.removeItem(`shiffaa_cache_${key}`);
          return null;
        }
        return parsed.data;
      } catch (_) {
        return null;
      }
    },
    set(key, data, ttlMs = 120000) { // default 2 minutes
      try {
        sessionStorage.setItem(`shiffaa_cache_${key}`, JSON.stringify({
          exp: Date.now() + ttlMs,
          data
        }));
      } catch (_) {}
    },
    invalidate(key) {
      try {
        if (key) {
          sessionStorage.removeItem(`shiffaa_cache_${key}`);
        } else {
          const toRemove = [];
          for (let i = 0; i < sessionStorage.length; i++) {
            const k = sessionStorage.key(i);
            if (k && k.startsWith('shiffaa_cache_')) toRemove.push(k);
          }
          toRemove.forEach(k => sessionStorage.removeItem(k));
        }
      } catch (_) {}
    },
    clearAll() {
      try {
        const sKeys = [];
        for (let i = 0; i < sessionStorage.length; i++) {
          const k = sessionStorage.key(i);
          if (k && (k.startsWith('shiffaa_') || k.startsWith('clinic_'))) sKeys.push(k);
        }
        sKeys.forEach(k => sessionStorage.removeItem(k));

        const lKeys = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && (k.startsWith('shiffaa_') || k.startsWith('clinic_'))) lKeys.push(k);
        }
        lKeys.forEach(k => localStorage.removeItem(k));
      } catch (_) {}
    }
  };

  window.PatientCache = PatientCache;

  function getApiBaseUrl() {
    if (window.ClinicPortalAPI && typeof window.ClinicPortalAPI.getBaseUrl === 'function') {
      const base = window.ClinicPortalAPI.getBaseUrl();
      if (base) return `${base.replace(/\/+$/, '')}/api/v1`;
      return '/api/v1';
    }
    if (window.ClinicConfig && typeof window.ClinicConfig.getApiBaseUrl === 'function') {
      return window.ClinicConfig.getApiBaseUrl();
    }
    const saved = localStorage.getItem('clinic_portal_api_base_url') || localStorage.getItem('clinic_api_base_url') || localStorage.getItem('clinic_admin_api_base_url');
    if (saved) {
      const clean = saved.trim().replace(/\/+$/, '');
      return clean.endsWith('/api/v1') ? clean : `${clean}/api/v1`;
    }
    if (window.location && typeof window.location.pathname === 'string' && window.location.pathname.startsWith('/portal')) {
      return '/api/v1';
    }
    return DEFAULT_API_BASE;
  }

  async function request(endpoint, options = {}) {
    const base = getApiBaseUrl();
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const url = `${base}${cleanEndpoint}`;

    const headers = {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      ...(options.headers || {})
    };

    const token = localStorage.getItem('clinic_admin_api_token') || 'd6Fnv8GSJMzA8VXYGsltpNBAZQwdt43EjOe8OhG5iC-m_qvlPAqAb1GHz8TNRiz_';
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(url, {
      ...options,
      credentials: options.credentials || 'include',
      headers
    });

    if (!res.ok) {
      let errData = null;
      try { errData = await res.json(); } catch (_) {}
      const msg = errData?.error?.message || errData?.message || `API error ${res.status}`;
      throw new Error(msg);
    }

    return await res.json();
  }

  const UserApi = {
    getApiBaseUrl,
    PatientCache,

    async getSpecialties() {
      const cached = PatientCache.get('specialties');
      if (cached && Array.isArray(cached) && cached.length > 0) return cached;

      try {
        const res = await request('/portal/specialties');
        if (Array.isArray(res.specialties) && res.specialties.length > 0) {
          PatientCache.set('specialties', res.specialties, 3600000); // 1 hour TTL
          return res.specialties;
        }
      } catch (_) {}
      try {
        const res = await request('/specialties');
        if (Array.isArray(res.specialties) && res.specialties.length > 0) {
          PatientCache.set('specialties', res.specialties, 3600000); // 1 hour TTL
          return res.specialties;
        }
      } catch (_) {}
      const fallback = [
        { id: 1, name_en: 'Cardiology', name_ar: 'أمراض القلب' },
        { id: 2, name_en: 'Dermatology', name_ar: 'الأمراض الجلدية' },
        { id: 3, name_en: 'Pediatrics', name_ar: 'طب الأطفال' },
        { id: 4, name_en: 'Orthopedics', name_ar: 'جراحة العظام' },
        { id: 5, name_en: 'Internal Medicine', name_ar: 'الباطنة' }
      ];
      PatientCache.set('specialties', fallback, 3600000);
      return fallback;
    },

    async getDoctors() {
      const cached = PatientCache.get('doctors');
      if (cached && Array.isArray(cached) && cached.length > 0) return cached;

      let list = null;
      try {
        const res = await request('/portal/doctors');
        if (Array.isArray(res.doctors) && res.doctors.length > 0) {
          list = res.doctors.map(d => ({
            id: d.id,
            name_en: d.name_en || d.full_name_en,
            name_ar: d.name_ar || d.full_name_ar,
            full_name_en: d.name_en || d.full_name_en,
            full_name_ar: d.name_ar || d.full_name_ar,
            specialty_id: d.specialty_id || d.specialty?.id,
            specialty: d.specialty,
            shift_start: d.shift_start ? String(d.shift_start).substring(0, 5) : '09:00',
            shift_end: d.shift_end ? String(d.shift_end).substring(0, 5) : '17:00',
            working_days: d.working_days || [6, 7, 1, 2, 3],
            consultation_fee: d.consultation_fee?.amount || d.consultation_fee || 350
          }));
        }
      } catch (_) {}

      if (!list) {
        try {
          const res = await request('/doctors');
          if (Array.isArray(res.doctors) && res.doctors.length > 0) {
            list = res.doctors.map(d => ({
              id: d.id,
              name_en: d.name_en || d.full_name_en,
              name_ar: d.name_ar || d.full_name_ar,
              full_name_en: d.name_en || d.full_name_en,
              full_name_ar: d.name_ar || d.full_name_ar,
              specialty_id: d.specialty_id || d.specialty?.id,
              specialty: d.specialty,
              shift_start: d.shift_start ? String(d.shift_start).substring(0, 5) : '09:00',
              shift_end: d.shift_end ? String(d.shift_end).substring(0, 5) : '17:00',
              working_days: d.working_days || [6, 7, 1, 2, 3],
              consultation_fee: d.consultation_fee?.amount || d.consultation_fee || 350
            }));
          }
        } catch (_) {}
      }

      if (!list || list.length === 0) {
        list = [
          { id: 1, name_en: 'Dr. Amal Nour', name_ar: 'د. أمل نور', full_name_en: 'Dr. Amal Nour', full_name_ar: 'د. أمل نور', specialty_id: 1, specialty: { id: 1, name_en: 'Cardiology', name_ar: 'أمراض القلب' }, shift_start: '09:00', shift_end: '14:00' },
          { id: 2, name_en: 'Dr. Tarek Mansour', name_ar: 'د. طارق منصور', full_name_en: 'Dr. Tarek Mansour', full_name_ar: 'د. طارق منصور', specialty_id: 1, specialty: { id: 1, name_en: 'Cardiology', name_ar: 'أمراض القلب' }, shift_start: '09:00', shift_end: '14:00' },
          { id: 3, name_en: 'Dr. Mona Khalil', name_ar: 'د. منى خليل', full_name_en: 'Dr. Mona Khalil', full_name_ar: 'د. منى خليل', specialty_id: 2, specialty: { id: 2, name_en: 'Dermatology', name_ar: 'الأمراض الجلدية' }, shift_start: '09:00', shift_end: '14:00' },
          { id: 4, name_en: 'Dr. Youssef Fayed', name_ar: 'د. يوسف فايد', full_name_en: 'Dr. Youssef Fayed', full_name_ar: 'د. يوسف فايد', specialty_id: 3, specialty: { id: 3, name_en: 'Pediatrics', name_ar: 'طب الأطفال' }, shift_start: '09:00', shift_end: '14:00' },
          { id: 5, name_en: 'Dr. Nader El-Khatib', name_ar: 'د. نادر الخطيب', full_name_en: 'Dr. Nader El-Khatib', full_name_ar: 'د. نادر الخطيب', specialty_id: 4, specialty: { id: 4, name_en: 'Orthopedics', name_ar: 'جراحة العظام' }, shift_start: '09:00', shift_end: '14:00' }
        ];
      }

      PatientCache.set('doctors', list, 3600000); // 1 hour TTL
      return list;
    },

    async getAppointments(forceRefresh = false) {
      const patientId = PatientCache.getPatientId();
      const cacheKey = `appt_${patientId}`;

      if (!forceRefresh) {
        const cached = PatientCache.get(cacheKey);
        if (cached && Array.isArray(cached)) return cached;
      }

      let list = [];
      // 1. Try patient's own DB appointments via portal session
      try {
        const res = await request('/portal/appointments');
        if (Array.isArray(res.appointments)) {
          list = res.appointments;
          PatientCache.set(cacheKey, list, 120000); // 2 minutes TTL
          return list;
        }
      } catch (_) {}

      // 2. Try admin appointments endpoint if configured
      try {
        const res = await request('/appointments');
        const adminList = Array.isArray(res.appointments) ? res.appointments : (Array.isArray(res) ? res : []);
        if (adminList.length > 0) {
          list = adminList;
          PatientCache.set(cacheKey, list, 120000); // 2 minutes TTL
          return list;
        }
      } catch (_) {}

      // If user has no appointments in DB, return empty array
      PatientCache.set(cacheKey, [], 120000);
      return [];
    },

    async bookAppointment(payload) {
      let session = window.ClinicSession;
      if (!session) {
        try {
          session = JSON.parse(localStorage.getItem('shiffaa_patient_session') || localStorage.getItem('clinic_patient_session') || '{}');
        } catch (_) {
          session = {};
        }
      }
      const patientId = session?.id || session?.customer_number;
      const patientPhone = session?.phone;
      const patientName = session?.full_name || session?.first_name;
      const enriched = {
        patient_id: patientId,
        phone: patientPhone,
        patient_name: patientName,
        ...payload
      };

      const result = await request('/portal/appointments', {
        method: 'POST',
        body: JSON.stringify(enriched)
      });
      PatientCache.invalidate(`appt_${PatientCache.getPatientId()}`);
      return result;
    },

    async rescheduleAppointment(appointmentId, newDate, newTime, reason = 'Patient requested reschedule via portal') {
      const result = await request(`/portal/appointments/${appointmentId}/reschedule`, {
        method: 'PATCH',
        body: JSON.stringify({
          new_date: newDate,
          new_start_time: newTime,
          reason
        })
      });
      PatientCache.invalidate(`appt_${PatientCache.getPatientId()}`);
      return result;
    },

    async cancelAppointment(appointmentId, reason = 'Patient cancelled via portal') {
      const result = await request(`/portal/appointments/${appointmentId}/cancel`, {
        method: 'PATCH',
        body: JSON.stringify({ reason })
      });
      PatientCache.invalidate(`appt_${PatientCache.getPatientId()}`);
      return result;
    }
  };

  window.UserApi = UserApi;
})();

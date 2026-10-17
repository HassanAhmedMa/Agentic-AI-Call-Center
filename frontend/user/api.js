/**
 * Nile Clinics - Patient Portal API Client
 * Connects directly to FastAPI backend (`http://127.0.0.1:8002/api/v1`) -> Supabase PostgreSQL
 */

(function () {
  'use strict';

  const DEFAULT_API_BASE = 'http://127.0.0.1:8002/api/v1';

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

    async getSpecialties() {
      try {
        const res = await request('/specialties');
        return Array.isArray(res.specialties) ? res.specialties : [];
      } catch (_) {
        return [
          { id: 1, name_en: 'Cardiology', name_ar: 'أمراض القلب' },
          { id: 2, name_en: 'Dermatology', name_ar: 'الجلدية' },
          { id: 3, name_en: 'Orthopedics', name_ar: 'العظام' },
          { id: 4, name_en: 'Pediatrics', name_ar: 'طب الأطفال' },
          { id: 5, name_en: 'Ophthalmology', name_ar: 'الرمد والعيون' }
        ];
      }
    },

    async getDoctors() {
      try {
        const res = await request('/doctors');
        return Array.isArray(res.doctors) ? res.doctors : [];
      } catch (_) {
        return [
          { id: 1, full_name_en: 'Dr. Ahmed Mohamed', full_name_ar: 'د. أحمد محمد', specialty_id: 1 },
          { id: 2, full_name_en: 'Dr. Sara Elsayed', full_name_ar: 'د. سارة السيد', specialty_id: 2 },
          { id: 3, full_name_en: 'Dr. Mohamed Ali', full_name_ar: 'د. محمد علي', specialty_id: 3 }
        ];
      }
    },

    async getAppointments() {
      // 1. Try patient's own DB appointments via portal session
      try {
        const res = await request('/portal/appointments');
        if (Array.isArray(res.appointments)) return res.appointments;
      } catch (_) {}

      // 2. Try admin appointments endpoint if configured
      try {
        const res = await request('/appointments');
        const list = Array.isArray(res.appointments) ? res.appointments : (Array.isArray(res) ? res : []);
        if (list.length > 0) return list;
      } catch (_) {}

      // If user has no appointments in DB, return empty array (do NOT force fake appointments)
      return [];
    },

    async bookAppointment(payload) {
      try {
        return await request('/portal/appointments', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
      } catch (_) {
        return await request('/appointments', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
      }
    },

    async rescheduleAppointment(appointmentId, newDate, newTime, reason = 'Patient requested reschedule via portal') {
      try {
        return await request(`/portal/appointments/${appointmentId}/reschedule`, {
          method: 'PATCH',
          body: JSON.stringify({
            new_date: newDate,
            new_start_time: newTime,
            reason
          })
        });
      } catch (_) {
        return await request(`/appointments/${appointmentId}/reschedule`, {
          method: 'PATCH',
          body: JSON.stringify({
            new_date: newDate,
            new_start_time: newTime,
            reason
          })
        });
      }
    },

    async cancelAppointment(appointmentId, reason = 'Patient cancelled via portal') {
      try {
        return await request(`/portal/appointments/${appointmentId}/cancel`, {
          method: 'PATCH',
          body: JSON.stringify({ reason })
        });
      } catch (_) {
        return await request(`/appointments/${appointmentId}/cancel`, {
          method: 'PATCH',
          body: JSON.stringify({ reason })
        });
      }
    }
  };

  window.UserApi = UserApi;
})();

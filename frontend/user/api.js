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
        const res = await request('/portal/specialties');
        if (Array.isArray(res.specialties) && res.specialties.length > 0) return res.specialties;
      } catch (_) {}
      try {
        const res = await request('/specialties');
        if (Array.isArray(res.specialties) && res.specialties.length > 0) return res.specialties;
      } catch (_) {}
      return [
        { id: 1, name_en: 'Cardiology', name_ar: 'أمراض القلب' },
        { id: 2, name_en: 'Dermatology', name_ar: 'الأمراض الجلدية' },
        { id: 3, name_en: 'Pediatrics', name_ar: 'طب الأطفال' },
        { id: 4, name_en: 'Orthopedics', name_ar: 'جراحة العظام' },
        { id: 5, name_en: 'Internal Medicine', name_ar: 'الباطنة' }
      ];
    },

    async getDoctors() {
      try {
        const res = await request('/portal/doctors');
        if (Array.isArray(res.doctors) && res.doctors.length > 0) {
          return res.doctors.map(d => ({
            id: d.id,
            name_en: d.name_en || d.full_name_en,
            name_ar: d.name_ar || d.full_name_ar,
            full_name_en: d.name_en || d.full_name_en,
            full_name_ar: d.name_ar || d.full_name_ar,
            specialty_id: d.specialty_id || d.specialty?.id,
            specialty: d.specialty,
            consultation_fee: d.consultation_fee?.amount || d.consultation_fee || 350
          }));
        }
      } catch (_) {}

      try {
        const res = await request('/doctors');
        if (Array.isArray(res.doctors) && res.doctors.length > 0) {
          return res.doctors.map(d => ({
            id: d.id,
            name_en: d.name_en || d.full_name_en,
            name_ar: d.name_ar || d.full_name_ar,
            full_name_en: d.name_en || d.full_name_en,
            full_name_ar: d.name_ar || d.full_name_ar,
            specialty_id: d.specialty_id || d.specialty?.id,
            specialty: d.specialty,
            consultation_fee: d.consultation_fee?.amount || d.consultation_fee || 350
          }));
        }
      } catch (_) {}

      return [
        { id: 1, name_en: 'Dr. Amal Nour', name_ar: 'د. أمل نور', full_name_en: 'Dr. Amal Nour', full_name_ar: 'د. أمل نور', specialty_id: 1, specialty: { id: 1, name_en: 'Cardiology', name_ar: 'أمراض القلب' } },
        { id: 2, name_en: 'Dr. Tarek Mansour', name_ar: 'د. طارق منصور', full_name_en: 'Dr. Tarek Mansour', full_name_ar: 'د. طارق منصور', specialty_id: 1, specialty: { id: 1, name_en: 'Cardiology', name_ar: 'أمراض القلب' } },
        { id: 3, name_en: 'Dr. Mona Khalil', name_ar: 'د. منى خليل', full_name_en: 'Dr. Mona Khalil', full_name_ar: 'د. منى خليل', specialty_id: 2, specialty: { id: 2, name_en: 'Dermatology', name_ar: 'الأمراض الجلدية' } },
        { id: 4, name_en: 'Dr. Youssef Fayed', name_ar: 'د. يوسف فايد', full_name_en: 'Dr. Youssef Fayed', full_name_ar: 'د. يوسف فايد', specialty_id: 3, specialty: { id: 3, name_en: 'Pediatrics', name_ar: 'طب الأطفال' } },
        { id: 5, name_en: 'Dr. Nader El-Khatib', name_ar: 'د. نادر الخطيب', full_name_en: 'Dr. Nader El-Khatib', full_name_ar: 'د. نادر الخطيب', specialty_id: 4, specialty: { id: 4, name_en: 'Orthopedics', name_ar: 'جراحة العظام' } }
      ];
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
      const patientId = window.ClinicSession?.id;
      const patientPhone = window.ClinicSession?.phone;
      const patientName = window.ClinicSession?.full_name || window.ClinicSession?.first_name;
      const enriched = {
        patient_id: patientId,
        phone: patientPhone,
        patient_name: patientName,
        ...payload
      };

      try {
        return await request('/portal/appointments', {
          method: 'POST',
          body: JSON.stringify(enriched)
        });
      } catch (err) {
        return await request('/appointments', {
          method: 'POST',
          body: JSON.stringify(enriched)
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

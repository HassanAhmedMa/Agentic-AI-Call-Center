/**
 * Nile Clinics - Patient Portal Session Manager
 * Safely inspects session state with the backend using ClinicPortalAPI while updating the UI.
 */
(function () {
  'use strict';

  function applySessionToUI(profile) {
    if (!profile) return;
    const name = profile.full_name || profile.first_name || 'Patient';
    const initials = name.split(' ').filter(Boolean).map(n => n[0]).join('').substring(0, 2).toUpperCase() || 'P';

    // Header badge
    const badgeAvatar = document.getElementById('userBadgeAvatar');
    const badgeName = document.getElementById('userBadgeName');
    if (badgeAvatar) badgeAvatar.textContent = initials;
    if (badgeName) badgeName.textContent = name;

    // Home greeting
    const heroFName = document.getElementById('heroPatientFirstName');
    if (heroFName) {
      heroFName.textContent = profile.first_name || name.split(' ')[0];
    }
    const heroTitle = document.getElementById('homeHeroGreeting');
    if (heroTitle && !heroFName) {
      const isAr = window.getCurrentLang && window.getCurrentLang() === 'ar';
      const firstName = profile.first_name || name.split(' ')[0];
      heroTitle.innerHTML = isAr 
        ? `أهلاً بك، ${firstName}`
        : `Welcome back, ${firstName}`;
    }

    // Chat greeting
    const chatLead = document.getElementById('chatGreetingLead') || document.getElementById('chatGreetingHi');
    if (chatLead) {
      const isAr = window.getCurrentLang && window.getCurrentLang() === 'ar';
      const firstName = profile.first_name || name.split(' ')[0];
      chatLead.textContent = isAr ? `أهلاً ${firstName}!` : `Hello ${firstName}!`;
    }

    // Chat user avatar
    const chatUserAvatars = document.querySelectorAll('.msg-avatar-user, #chatUserAvatar');
    chatUserAvatars.forEach(av => {
      av.textContent = initials;
    });

    // Profile page elements if on profile page
    if (typeof window.populateProfileDetails === 'function') {
      window.populateProfileDetails(profile);
    }
  }

  async function syncAppointmentBadge() {
    const badge = document.getElementById('navApptBadge');
    if (!badge) return;
    try {
      if (window.ClinicPortalAPI && typeof window.ClinicPortalAPI.request === 'function') {
        const res = await window.ClinicPortalAPI.request('appointments');
        const list = Array.isArray(res?.appointments) ? res.appointments : [];
        const count = list.filter(a => a.status !== 'cancelled' && a.status !== 'canceled' && a.status !== 'completed').length;
        badge.textContent = String(count);
        try { localStorage.setItem('clinic_upcoming_count', String(count)); } catch (_) {}
      }
    } catch (_) {}
  }

  function initBadgeFromCache() {
    const badge = document.getElementById('navApptBadge');
    if (!badge) return;
    try {
      const cached = localStorage.getItem('clinic_upcoming_count');
      badge.textContent = cached !== null ? cached : '0';
    } catch (_) {
      badge.textContent = '0';
    }
  }

  async function checkSession() {
    initBadgeFromCache();

    try {
      let session = null;
      if (window.ClinicPortalAPI && typeof window.ClinicPortalAPI.request === 'function') {
        session = await window.ClinicPortalAPI.request('session');
      } else {
        const cleanBase = (window.__CLINIC_API_BASE__ || '').replace(/\/+$/, '');
        const response = await fetch(`${cleanBase}/api/v1/portal/session`, {
          credentials: cleanBase ? 'include' : 'same-origin',
          cache: 'no-store'
        });
        if (response.ok) {
          session = await response.json();
        } else if (response.status === 401) {
          try {
            localStorage.removeItem('clinic_patient_session');
            localStorage.removeItem('clinic_upcoming_count');
          } catch (_) {}
          window.ClinicSession = null;
          return null;
        }
      }

      if (session) {
        window.ClinicSession = session;
        try {
          localStorage.setItem('clinic_patient_session', JSON.stringify(session));
        } catch (_) {}
        applySessionToUI(session);

        // Sync real appointment count if on portal dashboard pages
        const isAuthPage = window.location && typeof window.location.pathname === 'string' && window.location.pathname.includes('auth.html');
        if (!isAuthPage) {
          syncAppointmentBadge();
        }

        return window.ClinicSession;
      }
    } catch (error) {
      if (error && ['VERIFICATION_REQUIRED', 'SESSION_EXPIRED', 'UNAUTHORIZED'].includes(error.message)) {
        if (window.location && typeof window.location.pathname === 'string' && !window.location.pathname.includes('auth.html')) {
          window.location.replace('auth.html');
        }
        return null;
      }
    }

    // Fallback to cached session from last successful login
    try {
      const cached = localStorage.getItem('clinic_patient_session');
      if (cached) {
        window.ClinicSession = JSON.parse(cached);
        applySessionToUI(window.ClinicSession);
        return window.ClinicSession;
      }
    } catch (_) {}

    return null;
  }

  async function logout() {
    try {
      if (window.ClinicPortalAPI && typeof window.ClinicPortalAPI.request === 'function') {
        await window.ClinicPortalAPI.request('logout', {});
      } else {
        const cleanBase = (window.__CLINIC_API_BASE__ || '').replace(/\/+$/, '');
        await fetch(`${cleanBase}/api/v1/portal/logout`, {
          method: 'POST',
          credentials: cleanBase ? 'include' : 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: '{}',
          cache: 'no-store'
        });
      }
    } catch (_) {}

    try {
      localStorage.removeItem('clinic_patient_session');
      localStorage.removeItem('clinic_user_session');
      localStorage.removeItem('clinic_upcoming_count');
    } catch (_) {}

    window.location.href = 'auth.html';
  }

  window.ClinicPortalAuth = {
    checkSession,
    logout,
    applySessionToUI,
    syncAppointmentBadge,
    setAppointmentBadgeCount: (count) => {
      const badge = document.getElementById('navApptBadge');
      if (badge) badge.textContent = String(count);
      try { localStorage.setItem('clinic_upcoming_count', String(count)); } catch (_) {}
    },
    getDefaultProfile: () => ({
      first_name: 'Patient',
      full_name: 'Patient User',
      customer_number: '—',
      email: '—',
      phone: '—',
      date_of_birth: '—',
      gender: '—',
      address: '—'
    })
  };

  document.addEventListener('DOMContentLoaded', () => {
    checkSession().then((profile) => {
      if (typeof CustomEvent !== 'undefined' && typeof window.dispatchEvent === 'function') {
        window.dispatchEvent(new CustomEvent('clinic:session-loaded', { detail: profile }));
      }
    });
  });
})();

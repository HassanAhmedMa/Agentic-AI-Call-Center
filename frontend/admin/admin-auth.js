/**
 * Shiffaa Clinics / SHIFFAA - Admin & Operator Role Session Manager
 *
 * Handles:
 * - Session state: Current user, role ('admin' | 'operator'), email, name, avatar
 * - Local storage persistence for session and operators list
 * - Default mock operators seed if none exist
 * - Permission checking (canDeletePatients, canDeleteDoctors, canAddDoctors, canAddPatients, canEditPatients, etc.)
 * - Auto-updating sidebar profile (Avatar, Name, Role badge)
 * - Restricting actions on UI with "Requires Administrator privileges" toast / alerts
 */

(function () {
  'use strict';

  const STORAGE_SESSION_KEY = 'clinic_admin_user_session';
  const STORAGE_OPERATORS_KEY = 'clinic_registered_operators';

  // Seed initial operators if empty
  const DEFAULT_OPERATORS = [
    {
      id: 1,
      name: 'Salma Khaled',
      email: 'salma@operator.clinic',
      gender: 'female',
      birthdate: '1996-04-15',
      role: 'operator',
      status: 'active',
      phone: '+20 102 345 6789',
      createdAt: '2026-01-10'
    },
    {
      id: 2,
      name: 'Tamer Adel',
      email: 'tamer@operator.clinic',
      gender: 'male',
      birthdate: '1993-08-22',
      role: 'operator',
      status: 'active',
      phone: '+20 114 987 6543',
      createdAt: '2026-02-01'
    }
  ];

  function getStoredOperators() {
    try {
      const stored = localStorage.getItem(STORAGE_OPERATORS_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (_) {}
    try {
      localStorage.setItem(STORAGE_OPERATORS_KEY, JSON.stringify(DEFAULT_OPERATORS));
    } catch (_) {}
    return DEFAULT_OPERATORS.slice();
  }

  function saveOperators(list) {
    try {
      localStorage.setItem(STORAGE_OPERATORS_KEY, JSON.stringify(list));
    } catch (_) {}
  }

  // Current session management
  const DEFAULT_ADMIN = {
    name: 'Ahmed Salah',
    email: 'ahmed.salah@shiffaa.app',
    role: 'admin', // 'admin' | 'operator'
    avatar: 'A'
  };

  function getCurrentUser() {
    try {
      const saved = localStorage.getItem(STORAGE_SESSION_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (_) {}
    return DEFAULT_ADMIN;
  }

  function setCurrentUser(user) {
    try {
      localStorage.setItem(STORAGE_SESSION_KEY, JSON.stringify(user));
    } catch (_) {}
    updateSidebarUserPill();
  }

  function isOperator() {
    const user = getCurrentUser();
    return (user.role || '').toLowerCase() === 'operator';
  }

  function isAdmin() {
    const user = getCurrentUser();
    return (user.role || '').toLowerCase() === 'admin';
  }

  function checkPermission(action) {
    if (isAdmin()) return true;

    // Operator limitations
    if (isOperator()) {
      switch (action) {
        case 'delete_patient':
        case 'delete_doctor':
        case 'add_doctor':
        case 'create_operator':
        case 'delete_operator':
          return false;
        case 'edit_patient':
        case 'add_patient':
        case 'view_patients':
        case 'view_doctors':
        case 'view_appointments':
        case 'edit_appointments':
          return true;
        default:
          return true;
      }
    }
    return true;
  }

  function showAdminPrivilegeWarning(actionName = 'This action') {
    const msg = 'Requires Administrator privileges. Operators cannot perform this action.';
    if (typeof window.showToast === 'function') {
      window.showToast(msg, 'warning');
    } else if (window.ClinicDialog) {
      window.ClinicDialog.alert({
        title: 'Access Restricted',
        message: msg,
        type: 'warning'
      });
    } else {
      alert(msg);
    }
  }

  function updateSidebarUserPill() {
    const user = getCurrentUser();
    const nameEls = document.querySelectorAll('.admin-user-name');
    const roleEls = document.querySelectorAll('.admin-user-role');
    const avatarEls = document.querySelectorAll('.admin-avatar-circle');

    const roleDisplayName = user.role === 'operator' ? 'Clinic Operator' : 'Administrator';
    const initial = (user.name || 'A').charAt(0).toUpperCase();

    nameEls.forEach(el => el.textContent = user.name || 'Ahmed Salah');
    roleEls.forEach(el => {
      el.textContent = roleDisplayName;
      if (user.role === 'operator') {
        el.style.color = '#2563EB';
        el.style.fontWeight = '600';
      } else {
        el.style.color = '';
        el.style.fontWeight = '';
      }
    });
    avatarEls.forEach(el => {
      el.textContent = initial;
      if (user.role === 'operator') {
        el.style.backgroundColor = '#2563EB';
      } else {
        el.style.backgroundColor = '';
      }
    });

    // Also update any operator badges count
    updateOperatorsCountBadge();
  }

  function updateOperatorsCountBadge() {
    const badge = document.getElementById('operatorsCountBadge');
    if (!badge) return;
    const ops = getStoredOperators();
    badge.textContent = ops.length;
  }

  function logout() {
    localStorage.removeItem(STORAGE_SESSION_KEY);
    window.location.href = 'login.html';
  }

  // Initialize UI on load
  document.addEventListener('DOMContentLoaded', () => {
    updateSidebarUserPill();
  });

  window.AdminAuth = {
    getCurrentUser,
    setCurrentUser,
    isOperator,
    isAdmin,
    checkPermission,
    showAdminPrivilegeWarning,
    updateSidebarUserPill,
    getStoredOperators,
    saveOperators,
    updateOperatorsCountBadge,
    logout
  };
})();

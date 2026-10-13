/**
 * Nile Clinics - Admin Dashboard Configuration Module
 * 
 * Centralized environment configuration for backend API connectivity.
 * Normalizes API base URL so the `/api/v1` prefix is attached exactly once.
 */

(function () {
  'use strict';

  // Read developer override from localStorage or global window object, fallback to relative origin
  const STORAGE_KEY = 'clinic_admin_api_base_url';

  /**
   * Normalizes a base URL string to guarantee it ends with `/api/v1` exactly once,
   * without duplicate slashes or repeated paths.
   *
   * Examples:
   *   "http://localhost:8000"         -> "http://localhost:8000/api/v1"
   *   "http://localhost:8000/"        -> "http://localhost:8000/api/v1"
   *   "http://localhost:8000/api/v1"  -> "http://localhost:8000/api/v1"
   *   "http://localhost:8000/api/v1/" -> "http://localhost:8000/api/v1"
   *   "" (relative origin)            -> "/api/v1"
   *   "/api/v1"                       -> "/api/v1"
   */
  function normalizeApiBaseUrl(raw) {
    if (!raw || typeof raw !== 'string') {
      return '/api/v1';
    }

    let trimmed = raw.trim().replace(/\/+$/, ''); // Remove trailing slashes

    // If it already ends with /api/v1, preserve it
    if (trimmed.endsWith('/api/v1')) {
      return trimmed;
    }

    // If it ends with /api, append /v1
    if (trimmed.endsWith('/api')) {
      return `${trimmed}/v1`;
    }

    // Otherwise append /api/v1
    return `${trimmed}/api/v1`;
  }

  // Initial detection: check window -> localStorage -> default relative
  let currentRawBaseUrl = window.CLINIC_API_BASE_URL || localStorage.getItem(STORAGE_KEY) || '';

  const ClinicConfig = {
    /**
     * Get the currently active, normalized API base URL ending in `/api/v1`.
     */
    getApiBaseUrl: function () {
      return normalizeApiBaseUrl(currentRawBaseUrl);
    },

    /**
     * Get raw configured URL (for display in settings modal).
     */
    getRawBaseUrl: function () {
      return currentRawBaseUrl || '(relative /api/v1)';
    },

    /**
     * Set a custom backend URL (e.g. for local dev tunnel: http://localhost:8000 or http://localhost:8002)
     */
    setApiBaseUrl: function (url) {
      currentRawBaseUrl = (url || '').trim();
      if (currentRawBaseUrl) {
        localStorage.setItem(STORAGE_KEY, currentRawBaseUrl);
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
      // Notify listeners (UI status badge, api client)
      window.dispatchEvent(new CustomEvent('clinic:config-changed', {
        detail: { apiBaseUrl: ClinicConfig.getApiBaseUrl() }
      }));
    },

    /**
     * Reset back to default relative origin.
     */
    resetApiBaseUrl: function () {
      ClinicConfig.setApiBaseUrl('');
    },

    /**
     * Check if a custom origin is active (vs relative default).
     */
    isCustomOrigin: function () {
      return Boolean(currentRawBaseUrl);
    }
  };

  window.ClinicConfig = ClinicConfig;
})();

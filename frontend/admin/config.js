/**
 * Shiffaa Clinics - Admin Dashboard Configuration Module
 * 
 * Centralized environment configuration for backend API connectivity.
 * Normalizes API base URL so the `/api/v1` prefix is attached exactly once.
 */

(function () {
  'use strict';

  // Read developer override from localStorage or global window object, fallback to relative origin
  const STORAGE_KEY = 'clinic_admin_api_base_url';
  const DEFAULT_REMOTE_API = 'https://clinic-api.193-122-68-159.sslip.io';

  /**
   * Cleans a URL string by trimming and removing trailing slashes or /api/v1 suffixes.
   */
  function cleanApiUrl(url) {
    if (!url || typeof url !== 'string') return '';
    let cleaned = url.trim();
    let prev = '';
    while (cleaned !== prev) {
      prev = cleaned;
      cleaned = cleaned.replace(/\/+$/, '').replace(/\/(api\/v1|api)\/?$/i, '').replace(/\/+$/, '');
    }
    return cleaned;
  }

  /**
   * Normalizes a base URL string to guarantee it ends with `/api/v1` exactly once,
   * without duplicate slashes or repeated paths.
   */
  function normalizeApiBaseUrl(raw) {
    if (!raw || typeof raw !== 'string') {
      return '/api/v1';
    }

    let trimmed = raw.trim().replace(/\/+$/, '');
    if (trimmed.endsWith('/api/v1')) return trimmed;
    if (trimmed.endsWith('/api')) return `${trimmed}/v1`;
    return `${trimmed}/api/v1`;
  }

  /**
   * Auto-detects the initial base URL based on environment.
   */
  function detectInitialBaseUrl() {
    try {
      if (typeof window !== 'undefined') {
        const hostname = window.location && window.location.hostname ? window.location.hostname.toLowerCase() : '';
        const port = window.location && window.location.port ? window.location.port : '';

        // 1. Explicit in-memory global override
        const globalOverride = window.CLINIC_API_BASE_URL || window.ADMIN_API_BASE_URL;
        if (globalOverride && typeof globalOverride === 'string') {
          return cleanApiUrl(globalOverride);
        }

        // 2. Query param ?api=... allows quick override/reset in browser address bar
        if (window.location && window.location.search) {
          const params = new URLSearchParams(window.location.search);
          if (params.has('api')) {
            const apiParam = (params.get('api') || '').trim();
            if (apiParam === 'reset' || apiParam === 'clear' || apiParam === 'default' || !apiParam) {
              try {
                localStorage.removeItem(STORAGE_KEY);
              } catch (_) {}
            } else {
              const cleaned = cleanApiUrl(apiParam);
              if (cleaned) {
                try {
                  localStorage.setItem(STORAGE_KEY, cleaned);
                } catch (_) {}
                return cleaned;
              }
            }
          }
        }

        // 3. Stored target in localStorage
        try {
          const stored = localStorage.getItem(STORAGE_KEY);
          if (stored && typeof stored === 'string') {
            const cleaned = cleanApiUrl(stored);
            if (cleaned) return cleaned;
          }
        } catch (_) {}

        // 4. Live Server / Vite / static development host detection (ports 5500, 5501, 3000, 5173, etc.)
        if (hostname === 'localhost' || hostname === '127.0.0.1') {
          if (['5500', '5501', '3000', '5173', '8080'].includes(port)) {
            // Default to local FastAPI backend on port 8000; api client will fallback to remote if unreachable
            return `http://${hostname}:8000`;
          }
        }
      }
    } catch (_) {}
    return '';
  }

  let currentRawBaseUrl = detectInitialBaseUrl();

  // Default server token so administrator operations work seamlessly out of the box
  const DEFAULT_ADMIN_TOKEN = 'd6Fnv8GSJMzA8VXYGsltpNBAZQwdt43EjOe8OhG5iC-m_qvlPAqAb1GHz8TNRiz_';
  if (!localStorage.getItem('clinic_admin_api_token') && !window.ADMIN_API_TOKEN) {
    try {
      localStorage.setItem('clinic_admin_api_token', DEFAULT_ADMIN_TOKEN);
    } catch (_) {}
  }

  const ClinicConfig = {
    DEFAULT_REMOTE_API,

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
     * Set a custom backend URL (e.g. for local dev tunnel: http://localhost:8000 or remote VPS)
     */
    setApiBaseUrl: function (url, persist = true) {
      currentRawBaseUrl = cleanApiUrl(url || '');
      if (persist) {
        if (currentRawBaseUrl) {
          try { localStorage.setItem(STORAGE_KEY, currentRawBaseUrl); } catch (_) {}
        } else {
          try { localStorage.removeItem(STORAGE_KEY); } catch (_) {}
        }
      }
      // Notify listeners (UI status badge, api client)
      window.dispatchEvent(new CustomEvent('clinic:config-changed', {
        detail: { apiBaseUrl: ClinicConfig.getApiBaseUrl(), rawBaseUrl: currentRawBaseUrl }
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
    },

    /**
     * Get prioritized list of API base URL candidates for fallback retry.
     */
    getCandidateBaseUrls: function () {
      const candidates = [];
      const current = ClinicConfig.getApiBaseUrl();
      if (current) candidates.push(current);

      if (typeof window !== 'undefined' && window.location) {
        const hostname = window.location.hostname || '127.0.0.1';
        const isLoopback = hostname === 'localhost' || hostname === '127.0.0.1';
        if (isLoopback) {
          const local8000 = `http://${hostname}:8000/api/v1`;
          const local8002 = `http://${hostname}:8002/api/v1`;
          if (!candidates.includes(local8000)) candidates.push(local8000);
          if (!candidates.includes(local8002)) candidates.push(local8002);
        }
      }

      const remote = `${DEFAULT_REMOTE_API}/api/v1`;
      if (!candidates.includes(remote)) candidates.push(remote);

      if (!candidates.includes('/api/v1')) candidates.push('/api/v1');
      return candidates;
    }
  };

  window.ClinicConfig = ClinicConfig;
})();

/* Shared loopback/same-origin transport. Stores endpoint preferences only, never tokens. */
(function () {
  'use strict';
  function cleanApiUrl(url) {
    if (!url || typeof url !== 'string') return '';
    let cleaned = url.trim();
    let prev = '';
    while (cleaned !== prev) {
      prev = cleaned;
      cleaned = cleaned.replace(/\/+$/, '').replace(/\/(api\/v1|portal)\/?$/i, '').replace(/\/+$/, '');
    }
    return cleaned;
  }

  function isAllowedApiBaseUrl(url) {
    if (!url || typeof url !== 'string') return false;
    const trimmed = url.trim();
    if (!trimmed) return false;
    if (/^\/[^/\\]/.test(trimmed) || trimmed === '/') return true;
    if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/.*)?$/i.test(trimmed)) return true;
    if (typeof window !== 'undefined' && window.location && window.location.hostname && /^https?:\/\//i.test(trimmed)) {
      try {
        const match = trimmed.match(/^https?:\/\/([^/:]+)/i);
        if (match && match[1].toLowerCase() === window.location.hostname.toLowerCase()) return true;
      } catch (_) {}
    }
    return false;
  }

  function getApiBaseUrl() {
    try {
      if (typeof window !== 'undefined') {
        const hostname = window.location && window.location.hostname ? window.location.hostname.toLowerCase() : '';

        // 1. Explicit in-memory globals (e.g. test suites or bundle configs)
        const globalOverride = window.CLINIC_API_BASE_URL || window.PORTAL_API_BASE_URL;
        if (globalOverride && typeof globalOverride === 'string') {
          const cleaned = cleanApiUrl(globalOverride);
          if (isAllowedApiBaseUrl(cleaned)) return cleaned;
        }

        // 2. Query parameter (?api=...) has highest developer precedence over stored localStorage
        if (window.location && window.location.search) {
          const params = new URLSearchParams(window.location.search);
          if (params.has('api')) {
            const apiParam = (params.get('api') || '').trim();
            if (apiParam === 'reset' || apiParam === 'clear' || apiParam === 'default' || !apiParam) {
              try {
                if (typeof localStorage !== 'undefined') {
                  localStorage.removeItem('clinic_portal_api_base_url');
                }
              } catch (_) {}
            } else {
              const cleaned = cleanApiUrl(apiParam);
              if (isAllowedApiBaseUrl(cleaned)) {
                try {
                  if (typeof localStorage !== 'undefined') {
                    localStorage.setItem('clinic_portal_api_base_url', cleaned);
                  }
                } catch (_) {}
                return cleaned;
              }
            }
          }
        }

        // 3. Persisted developer target in localStorage
        if (typeof localStorage !== 'undefined') {
          const stored = localStorage.getItem('clinic_portal_api_base_url') || localStorage.getItem('clinic_api_base_url');
          if (stored && typeof stored === 'string') {
            const cleaned = cleanApiUrl(stored);
            if (isAllowedApiBaseUrl(cleaned)) return cleaned;
          }
        }

        // 4. Default loopback development server detection (Live Server, Vite, etc.)
        if (hostname === 'localhost' || hostname === '127.0.0.1') {
          if (window.location && window.location.pathname && window.location.pathname.includes('/portal')) {
            return '';
          }
          const port = window.location.port || (window.location.protocol === 'https:' ? '443' : '80');
          if (port === '5500' || port === '5501' || port === '3000' || port === '5173') {
            return `${window.location.protocol || 'http:'}//${hostname}:8002`;
          }
        }
      }
    } catch (_) {}
    return '';
  }

  /**
   * Backend REST Client
   */
  async function api(path, body) {
    const baseUrl = getApiBaseUrl();
    const isCrossDomain = Boolean(baseUrl);
    const cleanPath = String(path || '').replace(/^\/+/, '');
    const response = await fetch((baseUrl ? baseUrl : '') + '/api/v1/portal/' + cleanPath, {
      method: body === undefined ? 'GET' : 'POST',
      credentials: isCrossDomain ? 'include' : 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: 'no-store',
      redirect: 'error'
    });
    const result = response.status === 204 ? {} : await response.json();
    if (!response.ok) {
      const error = new Error(result.error?.code || 'unavailable');
      error.details = result.error?.details;
      throw error;
    }
    return result;
  }

  window.ClinicPortalAPI = {request: api, getBaseUrl: getApiBaseUrl};
})();

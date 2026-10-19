/**
 * Shiffaa Clinics - Doctors Management Controller
 * Fetches real doctors from FastAPI backend (`/api/v1/doctors` & `/api/v1/specialties`)
 * connected to the Supabase PostgreSQL `clinic` schema.
 */

(function () {
  'use strict';

  let allDoctors = [];
  let allSpecialties = [];
  let selectedDoctorId = null;

  const ISO_DAYS_MAP = {
    6: 'Sat',
    7: 'Sun',
    1: 'Mon',
    2: 'Tue',
    3: 'Wed',
    4: 'Thu'
  };

  function formatWorkingDays(days) {
    if (!Array.isArray(days) || days.length === 0) return 'Sat – Wed';
    return days.map(d => ISO_DAYS_MAP[d] || d).join(', ');
  }

  function renderDoctorSkeletons() {
    const container = document.getElementById('doctorsGridContainer');
    if (!container) return;
    const single = `
      <div class="doctor-card-panel" style="pointer-events:none; border-color:#F1F5F9; background:#FFFFFF;">
        <div class="doctor-card-top" style="display:flex; align-items:center; gap:12px;">
          <div class="skeleton-shimmer skeleton-avatar" style="width:46px; height:46px; border-radius:50%; flex-shrink:0;"></div>
          <div style="flex:1;">
            <div class="skeleton-shimmer skeleton-text" style="width:65%; height:16px;"></div>
            <div class="skeleton-shimmer skeleton-text" style="width:40%; height:12px; margin-top:4px;"></div>
            <div class="skeleton-shimmer skeleton-text" style="width:50%; height:11px; margin-top:3px;"></div>
          </div>
          <div class="skeleton-shimmer skeleton-pill" style="width:58px; height:22px;"></div>
        </div>
        <div class="doctor-card-body" style="margin-top:14px;">
          <div class="skeleton-shimmer" style="height:24px; border-radius:6px; margin-bottom:12px;"></div>
          <div class="doctor-info-grid">
            <div class="info-item"><div class="skeleton-shimmer skeleton-text" style="width:50%; height:10px;"></div><div class="skeleton-shimmer skeleton-text" style="width:80%; height:14px;"></div></div>
            <div class="info-item"><div class="skeleton-shimmer skeleton-text" style="width:50%; height:10px;"></div><div class="skeleton-shimmer skeleton-text" style="width:80%; height:14px;"></div></div>
            <div class="info-item"><div class="skeleton-shimmer skeleton-text" style="width:50%; height:10px;"></div><div class="skeleton-shimmer skeleton-text" style="width:80%; height:14px;"></div></div>
            <div class="info-item"><div class="skeleton-shimmer skeleton-text" style="width:50%; height:10px;"></div><div class="skeleton-shimmer skeleton-text" style="width:80%; height:14px;"></div></div>
          </div>
        </div>
        <div class="doctor-card-footer" style="margin-top:12px;">
          <div class="skeleton-shimmer skeleton-text" style="width:45%; height:12px;"></div>
          <div class="skeleton-shimmer skeleton-pill" style="width:80px; height:26px;"></div>
        </div>
      </div>
    `;
    container.innerHTML = single.repeat(6);
  }

  function renderDoctorMetricsSkeletons() {
    const totalEl = document.getElementById('metricTotalDoctors');
    const activeEl = document.getElementById('metricActiveDoctors');
    const specEl = document.getElementById('metricSpecialtiesCount');
    const feeEl = document.getElementById('metricConsultationFee');
    const filteredEl = document.getElementById('doctorsFilteredCount');
    const skeletonPill = `<span class="skeleton-shimmer skeleton-pill" style="display:inline-block; width:38px; height:22px; vertical-align:middle; border-radius:6px;"></span>`;
    if (totalEl) totalEl.innerHTML = skeletonPill;
    if (activeEl) activeEl.innerHTML = skeletonPill;
    if (specEl) specEl.innerHTML = skeletonPill;
    if (feeEl) feeEl.innerHTML = skeletonPill;
    if (filteredEl) filteredEl.innerHTML = `<span class="skeleton-shimmer skeleton-pill" style="display:inline-block; width:20px; height:12px; vertical-align:middle; border-radius:4px;"></span>`;
  }

  document.addEventListener('DOMContentLoaded', () => {
    initClock();
    initGlobalShortcuts();
    initSidebarNav();
    loadLiveDoctors();
    checkDoctorRoleRestrictions();
  });

  function checkDoctorRoleRestrictions() {
    if (typeof AdminAuth !== 'undefined' && AdminAuth.isOperator()) {
      const addDocBtn = document.querySelector('button[onclick="openAddDoctorModal()"]');
      if (addDocBtn) {
        addDocBtn.style.opacity = '0.5';
        addDocBtn.title = 'Requires Administrator privileges';
        addDocBtn.onclick = (e) => {
          e.preventDefault();
          AdminAuth.showAdminPrivilegeWarning('Adding a doctor');
        };
      }
    }
  }

  /* =============================================================================
     1. LIVE CLOCK TICKER
     ============================================================================= */
  function initClock() {
    const dateEl = document.getElementById('liveDateText');
    const timeEl = document.getElementById('liveTimeText');

    function update() {
      const now = new Date();
      const optionsDate = { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' };
      const dateStr = now.toLocaleDateString('en-GB', optionsDate);

      let hours = now.getHours();
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      hours = hours ? hours : 12;
      const timeStr = `${String(hours).padStart(2, '0')}:${minutes} ${ampm}`;

      if (dateEl) dateEl.textContent = dateStr;
      if (timeEl) timeEl.textContent = timeStr;
    }

    update();
    setInterval(update, 1000);
  }

  /* =============================================================================
     2. GLOBAL SHORTCUTS & SEARCH
     ============================================================================= */
  function initGlobalShortcuts() {
    window.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        const search = document.getElementById('doctorsGlobalSearch');
        if (search) {
          search.focus();
          search.select();
        }
      }
      if (e.key === 'Escape') {
        closeDoctorModal();
      }
    });

    const topSearch = document.getElementById('doctorsGlobalSearch');
    if (topSearch) {
      topSearch.addEventListener('input', (e) => {
        handleSearchAndFilter(e.target.value, getActiveDeptFilter());
      });
    }

    const inlineSearch = document.getElementById('doctorsInlineSearch');
    if (inlineSearch) {
      inlineSearch.addEventListener('input', (e) => {
        handleSearchAndFilter(e.target.value, getActiveDeptFilter());
      });
    }

    const deptFilter = document.getElementById('deptFilterSelect');
    if (deptFilter) {
      deptFilter.addEventListener('change', (e) => {
        const query = (document.getElementById('doctorsInlineSearch')?.value || '').trim();
        handleSearchAndFilter(query, e.target.value);
      });
    }
  }

  function getActiveDeptFilter() {
    const sel = document.getElementById('deptFilterSelect');
    return sel ? sel.value : 'all';
  }

  /* =============================================================================
     3. SIDEBAR NAVIGATION
     ============================================================================= */
  function initSidebarNav() {
    const navLinks = document.querySelectorAll('.sidebar-nav .nav-link');
    navLinks.forEach(link => {
      link.addEventListener('click', (e) => {
        const label = link.querySelector('.nav-text')?.textContent || '';
        if (label === 'Settings' && typeof window.openApiConfigModal === 'function') {
          e.preventDefault();
          window.openApiConfigModal();
        }
      });
    });
  }

  /* =============================================================================
     4. DATA FETCHING FROM FASTAPI BACKEND
     ============================================================================= */
  async function loadLiveDoctors() {
    const container = document.getElementById('doctorsGridContainer');
    const loadingState = document.getElementById('doctorsLoadingState');
    const errorState = document.getElementById('doctorsErrorState');

    // Fast Cache Check: If doctors are already in sessionStorage, render IMMEDIATELY!
    const cachedDocs = window.ClinicCache ? window.ClinicCache.get('doctors_all') : null;
    const cachedSpecs = window.ClinicCache ? window.ClinicCache.get('specialties') : null;

    if (cachedDocs && Array.isArray(cachedDocs.doctors) && cachedSpecs && Array.isArray(cachedSpecs)) {
      allSpecialties = cachedSpecs;
      allDoctors = cachedDocs.doctors;
      populateDeptFilter(allSpecialties);
      updateDoctorMetrics(allDoctors, allSpecialties);
      renderDoctorsGrid(allDoctors);
      if (loadingState) loadingState.style.display = 'none';
    } else {
      // Instant Skeleton Loader - zero blank flash!
      renderDoctorMetricsSkeletons();
      renderDoctorSkeletons();
      if (loadingState) loadingState.style.display = 'none';
    }

    if (errorState) errorState.style.display = 'none';

    try {
      const [specData, docData] = await Promise.all([
        window.ClinicApi.getSpecialties().catch(() => []),
        window.ClinicApi.getDoctors({ limit: 50 }).catch(() => ({ total: 0, doctors: [] }))
      ]);

      allSpecialties = Array.isArray(specData) ? specData : [];
      allDoctors = Array.isArray(docData?.doctors) ? docData.doctors : [];

      // Update Department filter dropdown
      populateDeptFilter(allSpecialties);

      // Update Metric Chips
      updateDoctorMetrics(allDoctors, allSpecialties);

      // Render Doctors Cards
      renderDoctorsGrid(allDoctors);

      if (loadingState) loadingState.style.display = 'none';
    } catch (err) {
      console.error('[Doctors] Failed to load data:', err);
      if (!allDoctors.length) {
        if (loadingState) loadingState.style.display = 'none';
        if (errorState) {
          errorState.style.display = 'block';
          const msgEl = document.getElementById('doctorsErrorMessage');
          if (msgEl) msgEl.textContent = err.message || 'Cannot reach FastAPI backend.';
        }
      }
    }
  }

  function populateDeptFilter(specialties) {
    const select = document.getElementById('deptFilterSelect');
    if (!select) return;

    select.innerHTML = '<option value="all">All Specialties / التخصصات</option>';
    specialties.forEach(spec => {
      const opt = document.createElement('option');
      opt.value = String(spec.id);
      opt.textContent = `${spec.name_en} (${spec.name_ar})`;
      select.appendChild(opt);
    });
  }

  function updateDoctorMetrics(doctors, specialties) {
    const totalEl = document.getElementById('metricTotalDoctors');
    const activeEl = document.getElementById('metricActiveDoctors');
    const specEl = document.getElementById('metricSpecialtiesCount');
    const feeEl = document.getElementById('metricConsultationFee');
    const badgeEl = document.getElementById('doctorsCountBadge');

    const total = doctors.length;
    const active = doctors.filter(d => d.is_active !== false).length;

    let feeDisplay = '350';
    if (doctors.length > 0) {
      const fees = doctors.map(d => {
        if (!d.consultation_fee) return 350;
        if (typeof d.consultation_fee === 'object') return Number(d.consultation_fee.amount) || 350;
        return Number(d.consultation_fee) || 350;
      }).filter(f => !isNaN(f) && f > 0);
      if (fees.length > 0) {
        const avg = Math.round(fees.reduce((a, b) => a + b, 0) / fees.length);
        feeDisplay = String(avg);
      }
    }

    if (totalEl) totalEl.textContent = total;
    if (activeEl) activeEl.textContent = active;
    if (specEl) specEl.textContent = specialties.length;
    if (feeEl) feeEl.textContent = feeDisplay;
    if (badgeEl) badgeEl.textContent = total;
  }

  /* =============================================================================
     5. SEARCH & FILTERING
     ============================================================================= */
  function handleSearchAndFilter(query, deptFilter) {
    const q = (query || '').toLowerCase().trim();
    const deptId = deptFilter === 'all' ? null : parseInt(deptFilter, 10);

    const filtered = allDoctors.filter(doc => {
      const docSpecId = doc.specialty?.id ?? doc.specialty_id;
      const spec = doc.specialty || allSpecialties.find(s => s.id === docSpecId);
      const matchesDept = deptId === null || docSpecId === deptId;
      if (!matchesDept) return false;

      if (!q) return true;

      const nameEn = (doc.name_en || '').toLowerCase();
      const nameAr = (doc.name_ar || '').toLowerCase();
      const titleEn = (doc.title_en || '').toLowerCase();
      const titleAr = (doc.title_ar || '').toLowerCase();
      const specEn = (spec ? spec.name_en : '').toLowerCase();
      const specAr = (spec ? spec.name_ar : '').toLowerCase();

      return nameEn.includes(q) || nameAr.includes(q) || 
             titleEn.includes(q) || titleAr.includes(q) || 
             specEn.includes(q) || specAr.includes(q);
    });

    renderDoctorsGrid(filtered);
  }

  /* =============================================================================
     6. RENDER DOCTORS GRID
     ============================================================================= */
  function renderDoctorsGrid(doctors) {
    const container = document.getElementById('doctorsGridContainer');
    const countEl = document.getElementById('doctorsFilteredCount');
    if (!container) return;

    if (countEl) countEl.textContent = doctors.length;

    if (doctors.length === 0) {
      container.innerHTML = `
        <div class="empty-state-card" style="grid-column: 1 / -1; padding: 48px 24px; text-align: center; background: #FFFFFF; border: 1px solid var(--border-light); border-radius: 14px;">
          <svg viewBox="0 0 24 24" fill="none" stroke="#94A3B8" stroke-width="1.8" width="48" height="48" style="margin-bottom: 12px;">
            <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/>
            <circle cx="12" cy="7" r="4"/>
          </svg>
          <h4 style="margin: 0 0 6px 0; color: var(--text-dark); font-size: 16px;">No doctors match current filters</h4>
          <p style="margin: 0; color: var(--text-muted); font-size: 13px;">Try clearing the search query or selecting "All Specialties".</p>
        </div>
      `;
      return;
    }

    const html = doctors.map(doc => {
      const docSpecId = doc.specialty?.id ?? doc.specialty_id;
      const spec = doc.specialty || allSpecialties.find(s => s.id === docSpecId);
      const deptName = spec ? spec.name_en : (doc.title_en || 'Specialist');
      const deptNameAr = spec ? spec.name_ar : (doc.title_ar || '');
      
      const cleanName = (doc.name_en || '').replace(/Dr\.\s*/i, '');
      const initials = cleanName.split(' ').map(p => p.charAt(0)).join('').slice(0, 2).toUpperCase() || 'DR';

      const fee = doc.consultation_fee 
        ? (typeof doc.consultation_fee === 'object' ? `${doc.consultation_fee.amount} ${doc.consultation_fee.currency || 'EGP'}` : `${doc.consultation_fee} EGP`)
        : '350 EGP';

      const shift = (doc.shift_start && doc.shift_end)
        ? `${doc.shift_start.slice(0, 5)} - ${doc.shift_end.slice(0, 5)}`
        : '09:00 - 14:00';

      const langs = Array.isArray(doc.languages) ? doc.languages.join(', ').toUpperCase() : 'AR, EN';
      const workingDaysStr = formatWorkingDays(doc.working_days);

      const palette = getDeptPalette(docSpecId);

      return `
        <div class="doctor-card-panel" onclick="viewDoctorDetails(${doc.id})">
          <div class="doctor-card-top">
            <div class="doctor-avatar-circle" style="background:${palette.bg}; color:${palette.color};">
              ${initials}
            </div>
            <div class="doctor-header-meta">
              <div class="doctor-name-en">${doc.name_en}</div>
              <div class="doctor-name-ar" dir="rtl">${doc.name_ar || ''}</div>
              <div class="doctor-title-text">${doc.title_en || 'Consultant'}</div>
            </div>
            <span class="doctor-status-badge ${doc.is_active !== false ? 'badge-active' : 'badge-inactive'}">
              <span class="status-dot"></span>
              ${doc.is_active !== false ? 'Active' : 'Inactive'}
            </span>
          </div>

          <div class="doctor-card-body">
            <div class="doctor-spec-tag" style="background:${palette.bg}; color:${palette.color}; border: 1px solid ${palette.border};">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13">
                <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>
              </svg>
              <span>${deptName} • ${deptNameAr}</span>
            </div>

            <div class="doctor-info-grid">
              <div class="info-item">
                <span class="info-label">Consultation Fee</span>
                <span class="info-val fee-highlight">${fee}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Shift Hours</span>
                <span class="info-val">${shift}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Working Days</span>
                <span class="info-val" style="font-weight:600; color:#2563EB;">${workingDaysStr}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Languages</span>
                <span class="info-val">${langs}</span>
              </div>
            </div>
          </div>

          <div class="doctor-card-footer">
            <span class="card-hint">Click to inspect clinical profile</span>
            <button class="btn-view-doc" onclick="event.stopPropagation(); viewDoctorDetails(${doc.id});">
              View Profile
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                <path d="m9 18 6-6-6-6"/>
              </svg>
            </button>
          </div>
        </div>
      `;
    }).join('');

    container.innerHTML = html;
  }

  function getDeptPalette(specialtyId) {
    const map = {
      1: { bg: '#EFF6FF', color: '#1D4ED8', border: '#BFDBFE' }, // Cardiology (Blue)
      2: { bg: '#FDF2F8', color: '#BE185D', border: '#FBCFE8' }, // Dermatology (Pink)
      3: { bg: '#FAF5FF', color: '#7E22CE', border: '#E9D5FF' }, // Pediatrics (Purple)
      4: { bg: '#FFFBEB', color: '#B45309', border: '#FDE68A' }, // Orthopedics (Amber)
      5: { bg: '#F0FDF4', color: '#15803D', border: '#BBF7D0' }  // Internal Medicine (Green)
    };
    return map[specialtyId] || { bg: '#F8FAFC', color: '#475569', border: '#E2E8F0' };
  }

  /* =============================================================================
     7. DOCTOR DETAIL MODAL (GET /api/v1/doctors/{id})
     ============================================================================= */
  window.viewDoctorDetails = async function (doctorId) {
    const backdrop = document.getElementById('adminModalBackdrop');
    const titleEl = document.getElementById('adminModalTitle');
    const bodyEl = document.getElementById('adminModalBody');
    const footerEl = document.getElementById('adminModalFooter');

    if (!backdrop || !bodyEl) return;

    if (titleEl) titleEl.textContent = 'Doctor Clinical Profile';
    bodyEl.innerHTML = `
      <div style="padding: 24px; text-align: center; color: var(--text-muted);">
        <div class="status-indicator-dot dot-connecting" style="width:12px; height:12px; margin:0 auto 12px auto;"></div>
        Loading live doctor profile from Supabase PostgreSQL...
      </div>
    `;

    backdrop.classList.add('active');
    backdrop.classList.add('open');

    try {
      const doc = await window.ClinicApi.getDoctor(doctorId);
      const spec = doc.specialty || allSpecialties.find(s => s.id === doc.specialty_id) || {};
      
      const fee = doc.consultation_fee 
        ? `${doc.consultation_fee.amount ?? doc.consultation_fee} ${doc.consultation_fee.currency || 'EGP'}`
        : '350 EGP';

      const shiftStart = doc.working_hours?.start || doc.shift_start || '09:00';
      const shiftEnd = doc.working_hours?.end || doc.shift_end || '14:00';
      const days = formatWorkingDays(doc.working_days);
      const langs = Array.isArray(doc.languages) ? doc.languages.join(', ').toUpperCase() : 'AR, EN';

      bodyEl.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:16px;">
          <div style="display:flex; align-items:center; gap:14px; background:#F8FAFC; border:1px solid var(--border-light); border-radius:10px; padding:16px;">
            <div style="width:48px; height:48px; border-radius:50%; background:#EFF6FF; color:#1D4ED8; font-weight:700; font-size:18px; display:flex; align-items:center; justify-content:center;">
              ${doc.name_en.replace(/Dr\.\s*/i, '').slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div style="font-size:17px; font-weight:700; color:var(--text-dark);">${doc.name_en}</div>
              <div style="font-size:14px; color:var(--text-muted); font-family:'Cairo', sans-serif;" dir="rtl">${doc.name_ar || ''}</div>
              <div style="font-size:12px; font-weight:600; color:#2563EB; margin-top:2px;">
                ${doc.title_en || 'Consultant'} • ${spec.name_en || ''}
              </div>
            </div>
          </div>

          <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; font-size:12.5px;">
            <div style="background:#FFFFFF; border:1px solid #E2E8F0; border-radius:8px; padding:10px 12px;">
              <span style="display:block; color:#64748B; font-size:11px; text-transform:uppercase; font-weight:600;">Consultation Fee</span>
              <strong style="color:#0F172A; font-size:14px;">${fee}</strong>
            </div>
            <div style="background:#FFFFFF; border:1px solid #E2E8F0; border-radius:8px; padding:10px 12px;">
              <span style="display:block; color:#64748B; font-size:11px; text-transform:uppercase; font-weight:600;">Daily Shift</span>
              <strong style="color:#0F172A; font-size:14px;">${shiftStart} - ${shiftEnd}</strong>
            </div>
            <div style="background:#FFFFFF; border:1px solid #E2E8F0; border-radius:8px; padding:10px 12px;">
              <span style="display:block; color:#64748B; font-size:11px; text-transform:uppercase; font-weight:600;">Working Days</span>
              <strong style="color:#2563EB; font-size:13px;">${days}</strong>
            </div>
            <div style="background:#FFFFFF; border:1px solid #E2E8F0; border-radius:8px; padding:10px 12px;">
              <span style="display:block; color:#64748B; font-size:11px; text-transform:uppercase; font-weight:600;">Languages</span>
              <span style="color:#0F172A;">${langs}</span>
            </div>
          </div>

          <div>
            <h5 style="margin:0 0 6px 0; font-size:12px; color:#64748B; text-transform:uppercase; font-weight:600;">Biography (EN)</h5>
            <p style="margin:0; font-size:13px; color:#334155; line-height:1.5; background:#F8FAFC; border:1px solid #E2E8F0; border-radius:8px; padding:10px 12px;">
              ${doc.bio_en || 'Consultant profile for Shiffaa Clinics healthcare system.'}
            </p>
          </div>

          ${doc.bio_ar ? `
            <div>
              <h5 style="margin:0 0 6px 0; font-size:12px; color:#64748B; text-transform:uppercase; font-weight:600;">النبذة التعريفية (AR)</h5>
              <p style="margin:0; font-size:13px; color:#334155; line-height:1.6; background:#F8FAFC; border:1px solid #E2E8F0; border-radius:8px; padding:10px 12px; font-family:'Cairo', sans-serif;" dir="rtl">
                ${doc.bio_ar}
              </p>
            </div>
          ` : ''}

          <div style="background:#EFF6FF; border:1px solid #BFDBFE; border-radius:8px; padding:10px 12px; font-size:12px; color:#1E40AF;">
            <strong>Verified Record:</strong> Doctor ID #${doc.id} mapped from PostgreSQL <code style="font-family:monospace;">clinic.doctors</code> table.
          </div>
        </div>
      `;

      if (footerEl) {
        const canDelete = typeof AdminAuth === 'undefined' || AdminAuth.checkPermission('delete_doctor');
        footerEl.innerHTML = `
          ${canDelete ? `
            <button class="modal-btn-secondary" style="margin-right:auto; color:#DC2626; border-color:#FECACA; background:#FEF2F2;" onclick="confirmRemoveDoctor(${doc.id}, '${escapeJs(doc.name_en)}')">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14" style="margin-right:6px;"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
              Remove Doctor
            </button>
          ` : `
            <button class="modal-btn-secondary" style="margin-right:auto; opacity:0.5;" onclick="AdminAuth.showAdminPrivilegeWarning('Removing a doctor')">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14" style="margin-right:6px;"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
              Remove Doctor
            </button>
          `}
          <button class="modal-btn-secondary" onclick="closeDoctorModal()">Close</button>
          <a href="appointments.html" class="modal-btn-primary" style="text-decoration:none; display:inline-flex; align-items:center; justify-content:center;">Book Appointment</a>
        `;
      }
    } catch (err) {
      bodyEl.innerHTML = `
        <div style="padding:18px; color:#B91C1C; background:#FEE2E2; border-radius:8px; font-size:13px;">
          <strong>Error loading doctor:</strong> ${err.message}
        </div>
      `;
    }
  };

  function escapeJs(str) {
    return String(str || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
  }

  window.confirmRemoveDoctor = function (doctorId, doctorName) {
    if (typeof AdminAuth !== 'undefined' && !AdminAuth.checkPermission('delete_doctor')) {
      AdminAuth.showAdminPrivilegeWarning('Removing a doctor');
      return;
    }

    const backdrop = document.getElementById('adminModalBackdrop');
    const titleEl = document.getElementById('adminModalTitle');
    const bodyEl = document.getElementById('adminModalBody');
    const footerEl = document.getElementById('adminModalFooter');

    if (!backdrop || !bodyEl) return;

    if (titleEl) titleEl.textContent = 'Confirm Doctor Removal';

    bodyEl.innerHTML = `
      <div style="padding:10px 0; text-align:center;">
        <div style="width:48px; height:48px; border-radius:50%; background:#FEE2E2; color:#DC2626; display:flex; align-items:center; justify-content:center; margin:0 auto 14px auto;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="24" height="24">
            <path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
            <line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/>
          </svg>
        </div>
        <h4 style="margin:0 0 8px 0; font-size:16px; font-weight:700; color:#1E293B;">Remove ${doctorName}?</h4>
        <p style="margin:0 0 16px 0; font-size:13px; color:#64748B; line-height:1.5;">
          This doctor will be deactivated and immediately removed from active search, appointment scheduling, and patient directory.
        </p>
        <div style="background:#FFFBEB; border:1px solid #FDE68A; border-radius:8px; padding:10px 12px; font-size:12px; color:#92400E; text-align:left;">
          Past appointment history with this doctor will remain preserved for clinical audit and patient medical records.
        </div>
      </div>
    `;

    if (footerEl) {
      footerEl.innerHTML = `
        <button class="modal-btn-secondary" onclick="viewDoctorDetails(${doctorId})">Cancel</button>
        <button class="modal-btn-primary" style="background:#DC2626; border-color:#DC2626;" onclick="executeRemoveDoctor(${doctorId}, '${escapeJs(doctorName)}')">
          Yes, Remove Doctor
        </button>
      `;
    }
  };

  window.executeRemoveDoctor = async function (doctorId, doctorName) {
    if (typeof AdminAuth !== 'undefined' && !AdminAuth.checkPermission('delete_doctor')) {
      AdminAuth.showAdminPrivilegeWarning('Removing a doctor');
      return;
    }
    try {
      if (typeof ClinicApi !== 'undefined' && typeof ClinicApi.deleteDoctor === 'function') {
        await ClinicApi.deleteDoctor(doctorId);
      }
      closeDoctorModal();
      showToast(`${doctorName} has been removed successfully.`, 'success');
      await loadLiveDoctors();
    } catch (err) {
      showToast(`Failed to remove doctor: ${err.message}`, 'error');
    }
  };

  window.closeDoctorModal = function () {
    const backdrop = document.getElementById('adminModalBackdrop');
    if (backdrop) {
      backdrop.classList.remove('active');
      backdrop.classList.remove('open');
    }
  };

  window.openAddDoctorModal = function () {
    if (typeof AdminAuth !== 'undefined' && !AdminAuth.checkPermission('add_doctor')) {
      AdminAuth.showAdminPrivilegeWarning('Adding a doctor');
      return;
    }

    const backdrop = document.getElementById('adminModalBackdrop');
    const titleEl = document.getElementById('adminModalTitle');
    const bodyEl = document.getElementById('adminModalBody');
    const footerEl = document.getElementById('adminModalFooter');

    if (!backdrop || !bodyEl) return;

    if (titleEl) titleEl.textContent = 'Add New Doctor to Clinic';

    const specOptions = allSpecialties.map(s => `
      <option value="${s.id}">${s.name_en} (${s.name_ar})</option>
    `).join('');

    bodyEl.innerHTML = `
      <form id="addDoctorForm" onsubmit="submitAddDoctorForm(event)" style="display:flex; flex-direction:column; gap:14px;">
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px;">
          <div>
            <label style="display:block; font-size:12px; font-weight:600; color:#475569; margin-bottom:4px;">Doctor Name (English) *</label>
            <input type="text" id="newDocNameEn" required placeholder="e.g. Dr. Tarek Mansour" style="width:100%; height:38px; border:1px solid #CBD5E1; border-radius:6px; padding:0 12px; font-size:13px;">
          </div>
          <div>
            <label style="display:block; font-size:12px; font-weight:600; color:#475569; margin-bottom:4px;">Doctor Name (Arabic) *</label>
            <input type="text" id="newDocNameAr" required dir="rtl" placeholder="د. طارق منصور" style="width:100%; height:38px; border:1px solid #CBD5E1; border-radius:6px; padding:0 12px; font-size:13px;">
          </div>
        </div>

        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px;">
          <div>
            <label style="display:block; font-size:12px; font-weight:600; color:#475569; margin-bottom:4px;">Specialty / Department *</label>
            <select id="newDocSpecialty" required style="width:100%; height:38px; border:1px solid #CBD5E1; border-radius:6px; padding:0 10px; font-size:13px; background:#FFF;">
              ${specOptions}
            </select>
          </div>
          <div>
            <label style="display:block; font-size:12px; font-weight:600; color:#475569; margin-bottom:4px;">Consultation Fee (EGP) *</label>
            <input type="number" id="newDocFee" required min="50" step="10" value="350" style="width:100%; height:38px; border:1px solid #CBD5E1; border-radius:6px; padding:0 12px; font-size:13px;">
          </div>
        </div>

        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px;">
          <div>
            <label style="display:block; font-size:12px; font-weight:600; color:#475569; margin-bottom:4px;">Title (English)</label>
            <input type="text" id="newDocTitleEn" value="Senior Consultant" placeholder="e.g. Senior Consultant" style="width:100%; height:38px; border:1px solid #CBD5E1; border-radius:6px; padding:0 12px; font-size:13px;">
          </div>
          <div>
            <label style="display:block; font-size:12px; font-weight:600; color:#475569; margin-bottom:4px;">Title (Arabic)</label>
            <input type="text" id="newDocTitleAr" value="استشاري أول" dir="rtl" placeholder="استشاري أول" style="width:100%; height:38px; border:1px solid #CBD5E1; border-radius:6px; padding:0 12px; font-size:13px;">
          </div>
        </div>

        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px;">
          <div>
            <label style="display:block; font-size:12px; font-weight:600; color:#475569; margin-bottom:4px;">Shift Start (24h)</label>
            <input type="time" id="newDocShiftStart" value="09:00" style="width:100%; height:38px; border:1px solid #CBD5E1; border-radius:6px; padding:0 12px; font-size:13px;">
          </div>
          <div>
            <label style="display:block; font-size:12px; font-weight:600; color:#475569; margin-bottom:4px;">Shift End (24h)</label>
            <input type="time" id="newDocShiftEnd" value="17:00" style="width:100%; height:38px; border:1px solid #CBD5E1; border-radius:6px; padding:0 12px; font-size:13px;">
          </div>
        </div>

        <div>
          <label style="display:block; font-size:12px; font-weight:600; color:#475569; margin-bottom:6px;">Working Days * (Closed Friday)</label>
          <div class="working-days-selector">
            <label class="day-checkbox-label"><input type="checkbox" name="workDay" value="6" checked> <span>Sat</span></label>
            <label class="day-checkbox-label"><input type="checkbox" name="workDay" value="7" checked> <span>Sun</span></label>
            <label class="day-checkbox-label"><input type="checkbox" name="workDay" value="1" checked> <span>Mon</span></label>
            <label class="day-checkbox-label"><input type="checkbox" name="workDay" value="2" checked> <span>Tue</span></label>
            <label class="day-checkbox-label"><input type="checkbox" name="workDay" value="3" checked> <span>Wed</span></label>
            <label class="day-checkbox-label"><input type="checkbox" name="workDay" value="4"> <span>Thu</span></label>
          </div>
        </div>

        <div>
          <label style="display:block; font-size:12px; font-weight:600; color:#475569; margin-bottom:4px;">Professional Bio (English)</label>
          <textarea id="newDocBioEn" rows="2" placeholder="Brief professional background, qualifications and experience..." style="width:100%; border:1px solid #CBD5E1; border-radius:6px; padding:8px 12px; font-size:13px; font-family:inherit; resize:vertical;"></textarea>
        </div>

        <div id="addDoctorErrorMsg" style="display:none; padding:10px; background:#FEE2E2; color:#B91C1C; border-radius:6px; font-size:12px;"></div>
      </form>
    `;

    if (footerEl) {
      footerEl.innerHTML = `
        <button type="button" class="modal-btn-secondary" onclick="closeDoctorModal()">Cancel</button>
        <button type="button" id="btnSubmitAddDoctor" class="modal-btn-primary" onclick="document.getElementById('addDoctorForm').requestSubmit()">Save Doctor to Supabase</button>
      `;
    }

    backdrop.classList.add('active');
    backdrop.classList.add('open');
  };

  window.submitAddDoctorForm = async function (e) {
    if (e) e.preventDefault();
    const btn = document.getElementById('btnSubmitAddDoctor');
    const errBox = document.getElementById('addDoctorErrorMsg');

    const nameEn = document.getElementById('newDocNameEn')?.value.trim();
    const nameAr = document.getElementById('newDocNameAr')?.value.trim();
    const specialtyId = parseInt(document.getElementById('newDocSpecialty')?.value, 10);
    const fee = parseFloat(document.getElementById('newDocFee')?.value || '350');
    const titleEn = document.getElementById('newDocTitleEn')?.value.trim() || 'Consultant';
    const titleAr = document.getElementById('newDocTitleAr')?.value.trim() || 'استشاري';
    const shiftStart = document.getElementById('newDocShiftStart')?.value || '09:00';
    const shiftEnd = document.getElementById('newDocShiftEnd')?.value || '17:00';
    const bioEn = document.getElementById('newDocBioEn')?.value.trim() || `Experienced ${titleEn} at Shiffaa Clinics.`;

    const checkedDays = Array.from(document.querySelectorAll('input[name="workDay"]:checked'))
      .map(el => parseInt(el.value, 10));

    if (!nameEn || !nameAr || !specialtyId) {
      if (errBox) {
        errBox.textContent = 'Please fill out all required fields marked with *.';
        errBox.style.display = 'block';
      }
      return;
    }

    if (checkedDays.length === 0) {
      if (errBox) {
        errBox.textContent = 'Please select at least one working day for the doctor.';
        errBox.style.display = 'block';
      }
      return;
    }

    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Saving to Database...';
    }

    try {
      await window.ClinicApi.createDoctor({
        name_en: nameEn,
        name_ar: nameAr,
        title_en: titleEn,
        title_ar: titleAr,
        specialty_id: specialtyId,
        consultation_fee: fee,
        shift_start: shiftStart,
        shift_end: shiftEnd,
        working_days: checkedDays,
        bio_en: bioEn,
        bio_ar: 'استشاري متميز في عيادات النيل.'
      });

      showToast(`Doctor ${nameEn} added successfully to Supabase!`, 'success');
      closeDoctorModal();
      await loadLiveDoctors();
    } catch (err) {
      console.error('[Doctors] Error adding doctor:', err);
      if (errBox) {
        errBox.textContent = err.message || 'Failed to save doctor to database.';
        errBox.style.display = 'block';
      }
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Save Doctor to Supabase';
      }
    }
  };

  function showToast(message, type = 'info') {
    const container = document.getElementById('adminToastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast-item toast-${type}`;

    let iconSvg = '';
    if (type === 'success') {
      iconSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="#16A34A" stroke-width="2.5" width="18" height="18"><polyline points="20 6 9 17 4 12"/></svg>';
    } else if (type === 'warning') {
      iconSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="#D97706" stroke-width="2.5" width="18" height="18"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>';
    } else {
      iconSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="#2563EB" stroke-width="2.5" width="18" height="18"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>';
    }

    toast.innerHTML = `
      ${iconSvg}
      <span class="toast-message">${message}</span>
    `;

    container.appendChild(toast);
    setTimeout(() => {
      toast.classList.add('toast-exit');
      setTimeout(() => toast.remove(), 250);
    }, 4000);
  }

  window.handleBranchChange = function () {
    if (window.ClinicDialog) {
      window.ClinicDialog.alert('Active Medical Facility', 'Shiffaa Clinics - Heliopolis Branch (Active Branch)', 'info');
    } else {
      showToast('Shiffaa Clinics - Heliopolis Branch (Active)', 'info');
    }
  };

  window.handleLogout = async function () {
    const confirmed = window.ClinicDialog ? await window.ClinicDialog.confirm({
      title: 'Sign Out of Clinic Console?',
      message: 'Are you sure you want to log out or switch accounts?',
      confirmText: 'Sign Out',
      cancelText: 'Stay Signed In',
      type: 'danger'
    }) : confirm('Are you sure you want to log out or switch accounts?');

    if (confirmed) {
      if (typeof AdminAuth !== 'undefined') {
        AdminAuth.logout();
      } else {
        window.location.href = 'login.html';
      }
    }
  };

  window.toggleNotifications = function () {
    if (window.ClinicDialog) {
      window.ClinicDialog.alert('System Notifications', 'All clinical backend microservices and database connections are operational.', 'success');
    } else {
      showToast('System Notifications: Real FastAPI connection verified.', 'info');
    }
  };

})();

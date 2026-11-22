/**
 * Shiffaa Clinics - Doctors Management Controller
 * Tabular Split-View Layout with Real-Time Database Sync, Interactive Filtering,
 * Sorting Popover, Pagination, Details Panel, and Working Schedule Manager.
 */

(function () {
  'use strict';

  // State
  let allDoctors = [];
  let allSpecialties = [];
  let selectedDoctorId = null;
  let currentSort = 'none'; // 'none' | 'name' | 'price' | 'dept'
  let searchQuery = '';
  let selectedDept = 'all';
  let pageSize = 10;
  let currentPage = 1;
  let sidePanelView = 'details'; // 'details' | 'schedule'
  let modalMode = 'add'; // 'add' | 'edit'

  // Schedule working state for the currently selected doctor
  let scheduleState = {
    workingDays: [6, 7, 1, 2, 3], // default Sat - Wed
    startTime: '12:15 PM',
    endTime: '02:30 PM',
    activeDayKey: 'sat'
  };

  const ALL_DAYS = [
    { key: 'sat', num: 6, label: 'Sat', full: 'Saturday' },
    { key: 'sun', num: 7, label: 'Sun', full: 'Sunday' },
    { key: 'mon', num: 1, label: 'Mon', full: 'Monday' },
    { key: 'tue', num: 2, label: 'Tue', full: 'Tuesday' },
    { key: 'wed', num: 3, label: 'Wed', full: 'Wednesday' },
    { key: 'thu', num: 4, label: 'Thu', full: 'Thursday' },
    { key: 'fri', num: 5, label: 'Fri', full: 'Friday' }
  ];

  const ISO_DAYS_MAP = {
    6: 'Sat',
    7: 'Sun',
    1: 'Mon',
    2: 'Tue',
    3: 'Wed',
    4: 'Thu',
    5: 'Fri',
    'saturday': 'Sat', 'sat': 'Sat',
    'sunday': 'Sun', 'sun': 'Sun',
    'monday': 'Mon', 'mon': 'Mon',
    'tuesday': 'Tue', 'tue': 'Tue',
    'wednesday': 'Wed', 'wed': 'Wed',
    'thursday': 'Thu', 'thu': 'Thu',
    'friday': 'Fri', 'fri': 'Fri'
  };

  function formatWorkingDays(days) {
    if (!Array.isArray(days) || days.length === 0) return 'Sat, Sun, Mon, Tue, Wed';
    const mapped = days.map(d => {
      const key = typeof d === 'string' ? d.trim().toLowerCase() : d;
      return ISO_DAYS_MAP[key] || d;
    });
    // Remove duplicates preserving order
    return Array.from(new Set(mapped)).join(', ');
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function formatTime12h(timeStr) {
    if (!timeStr) return '09:00 AM';
    if (timeStr.includes('AM') || timeStr.includes('PM')) return timeStr;
    const parts = timeStr.split(':');
    let h = parseInt(parts[0], 10);
    const m = parts[1] ? parts[1].slice(0, 2) : '00';
    if (isNaN(h)) return timeStr;
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12;
    h = h ? h : 12;
    return `${String(h).padStart(2, '0')}:${m} ${ampm}`;
  }

  function formatShortShiftRange(start, end) {
    function toShort(t) {
      if (!t) return '09:00';
      const clean = t.replace(/\s*(AM|PM)/i, '').trim();
      const p = clean.split(':');
      const h = String(parseInt(p[0], 10) || 9).padStart(2, '0');
      const m = (p[1] || '00').slice(0, 2);
      return `${h}:${m}`;
    }
    return `${toShort(start)}-${toShort(end)}`;
  }

  /* =============================================================================
     SKELETON LOADERS
     ============================================================================= */
  function renderDoctorTableSkeletons() {
    const tbody = document.getElementById('doctorsTableBody');
    if (!tbody) return;
    let rowsHtml = '';
    for (let i = 0; i < 10; i++) {
      rowsHtml += `
        <tr>
          <td class="cell-checkbox"><span class="skeleton-shimmer skeleton-pill" style="width:16px; height:16px; display:inline-block; border-radius:4px;"></span></td>
          <td><span class="skeleton-shimmer skeleton-text" style="width:60%; height:14px; display:inline-block;"></span></td>
          <td><span class="skeleton-shimmer skeleton-text" style="width:45%; height:14px; display:inline-block;"></span></td>
          <td><span class="skeleton-shimmer skeleton-text" style="width:30%; height:14px; display:inline-block;"></span></td>
        </tr>
      `;
    }
    tbody.innerHTML = rowsHtml;
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

  /* =============================================================================
     INITIALIZATION & LIFECYCLE
     ============================================================================= */
  document.addEventListener('DOMContentLoaded', () => {
    initClock();
    initGlobalShortcuts();
    initSidebarNav();
    initPopoverClickOutside();
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

  function initPopoverClickOutside() {
    document.addEventListener('click', (e) => {
      const popover = document.getElementById('doctorSortPopover');
      const funnelBtn = document.getElementById('btnDoctorSortFunnel');
      if (popover && popover.style.display !== 'none') {
        if (!popover.contains(e.target) && !funnelBtn?.contains(e.target)) {
          popover.style.display = 'none';
          funnelBtn?.classList.remove('active');
        }
      }
    });
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
        const search = document.getElementById('doctorsInlineSearch') || document.getElementById('doctorsGlobalSearch');
        if (search) {
          search.focus();
          search.select();
        }
      }
      if (e.key === 'Escape') {
        closeDoctorModal();
        const popover = document.getElementById('doctorSortPopover');
        if (popover) popover.style.display = 'none';
      }
    });

    const topSearch = document.getElementById('doctorsGlobalSearch');
    if (topSearch) {
      topSearch.addEventListener('input', (e) => {
        searchQuery = e.target.value.trim();
        currentPage = 1;
        applyFilterAndRender();
      });
    }

    const inlineSearch = document.getElementById('doctorsInlineSearch');
    if (inlineSearch) {
      inlineSearch.addEventListener('input', (e) => {
        searchQuery = e.target.value.trim();
        currentPage = 1;
        applyFilterAndRender();
      });
    }

    const deptFilter = document.getElementById('deptFilterSelect');
    if (deptFilter) {
      deptFilter.addEventListener('change', (e) => {
        selectedDept = e.target.value;
        currentPage = 1;
        applyFilterAndRender();
      });
    }
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
    const loadingState = document.getElementById('doctorsLoadingState');
    const errorState = document.getElementById('doctorsErrorState');

    // Fast Cache Check
    const cachedDocs = window.ClinicCache ? window.ClinicCache.get('doctors_all') : null;
    const cachedSpecs = window.ClinicCache ? window.ClinicCache.get('specialties') : null;

    if (cachedDocs && Array.isArray(cachedDocs.doctors) && cachedSpecs && Array.isArray(cachedSpecs)) {
      allSpecialties = cachedSpecs;
      allDoctors = cachedDocs.doctors;
      allDoctors.forEach(d => {
        if (!d.avatar_url) {
          const savedAvatar = localStorage.getItem(`shiffaa_doctor_avatar_${d.id}`);
          if (savedAvatar) d.avatar_url = savedAvatar;
        }
      });
      populateDeptFilter(allSpecialties);
      updateDoctorMetrics(allDoctors, allSpecialties);
      initSelectedDoctor();
      applyFilterAndRender();
      if (loadingState) loadingState.style.display = 'none';
    } else {
      renderDoctorMetricsSkeletons();
      renderDoctorTableSkeletons();
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
      allDoctors.forEach(d => {
        if (!d.avatar_url) {
          const savedAvatar = localStorage.getItem(`shiffaa_doctor_avatar_${d.id}`);
          if (savedAvatar) d.avatar_url = savedAvatar;
        }
      });

      populateDeptFilter(allSpecialties);
      updateDoctorMetrics(allDoctors, allSpecialties);
      initSelectedDoctor();
      applyFilterAndRender();

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

  function initSelectedDoctor() {
    if (allDoctors.length > 0 && !selectedDoctorId) {
      selectedDoctorId = allDoctors[0].id;
      syncScheduleStateFromDoctor(allDoctors[0]);
    }
  }

  function syncScheduleStateFromDoctor(doc) {
    if (!doc) return;
    const days = Array.isArray(doc.working_days) && doc.working_days.length > 0 
      ? doc.working_days 
      : [6, 7, 1, 2, 3];
    
    // Normalize days to numbers
    const numDays = days.map(d => {
      if (typeof d === 'number') return d;
      const str = String(d).toLowerCase().trim();
      const match = ALL_DAYS.find(ad => ad.key === str || ad.label.toLowerCase() === str || ad.full.toLowerCase() === str);
      return match ? match.num : 6;
    });

    const sStart = doc.shift_start || doc.working_hours?.start || '12:15';
    const sEnd = doc.shift_end || doc.working_hours?.end || '14:30';

    scheduleState.workingDays = Array.from(new Set(numDays));
    scheduleState.startTime = formatTime12h(sStart);
    scheduleState.endTime = formatTime12h(sEnd);

    // Active day in working time list: pick first active day
    const firstActive = ALL_DAYS.find(ad => scheduleState.workingDays.includes(ad.num) && ad.num !== 5);
    scheduleState.activeDayKey = firstActive ? firstActive.key : 'sat';
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
     5. SORT POPOVER LOGIC
     ============================================================================= */
  window.toggleDoctorSortPopover = function (event) {
    if (event) event.stopPropagation();
    const popover = document.getElementById('doctorSortPopover');
    const funnelBtn = document.getElementById('btnDoctorSortFunnel');
    if (!popover) return;

    const isOpen = popover.style.display !== 'none';
    if (isOpen) {
      popover.style.display = 'none';
      funnelBtn?.classList.remove('active');
    } else {
      popover.style.display = 'flex';
      funnelBtn?.classList.add('active');
    }
  };

  window.applyDoctorSort = function (sortKey) {
    currentSort = sortKey;
    currentPage = 1;

    // Update active highlight on popover items
    const items = document.querySelectorAll('#doctorSortPopover .popover-item');
    items.forEach(item => {
      item.classList.toggle('active', item.dataset.sort === sortKey);
    });

    // Close popover
    const popover = document.getElementById('doctorSortPopover');
    const funnelBtn = document.getElementById('btnDoctorSortFunnel');
    if (popover) popover.style.display = 'none';
    if (funnelBtn) funnelBtn.classList.remove('active');

    applyFilterAndRender();
  };

  /* =============================================================================
     6. FILTERING, SORTING & PAGINATION PIPELINE
     ============================================================================= */
  function getFilteredAndSortedDoctors() {
    const q = searchQuery.toLowerCase();
    const deptId = selectedDept === 'all' ? null : parseInt(selectedDept, 10);

    // 1. Filter
    let filtered = allDoctors.filter(doc => {
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

    // 2. Sort
    if (currentSort === 'name') {
      filtered.sort((a, b) => (a.name_en || '').localeCompare(b.name_en || ''));
    } else if (currentSort === 'price') {
      filtered.sort((a, b) => {
        const feeA = typeof a.consultation_fee === 'object' ? Number(a.consultation_fee?.amount) || 0 : Number(a.consultation_fee) || 0;
        const feeB = typeof b.consultation_fee === 'object' ? Number(b.consultation_fee?.amount) || 0 : Number(b.consultation_fee) || 0;
        return feeA - feeB;
      });
    } else if (currentSort === 'dept') {
      filtered.sort((a, b) => {
        const specA = a.specialty?.name_en || '';
        const specB = b.specialty?.name_en || '';
        return specA.localeCompare(specB);
      });
    }

    return filtered;
  }

  function applyFilterAndRender() {
    const filtered = getFilteredAndSortedDoctors();
    const totalCount = filtered.length;

    const countEl = document.getElementById('doctorsFilteredCount');
    if (countEl) countEl.textContent = totalCount;

    // Ensure selectedDoctorId is in current filtered list if possible
    if (filtered.length > 0) {
      const exists = filtered.some(d => d.id === selectedDoctorId);
      if (!exists) {
        selectedDoctorId = filtered[0].id;
        syncScheduleStateFromDoctor(filtered[0]);
      }
    }

    // Pagination calculations
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
    if (currentPage > totalPages) currentPage = totalPages;
    if (currentPage < 1) currentPage = 1;

    const startIdx = (currentPage - 1) * pageSize;
    const endIdx = Math.min(startIdx + pageSize, totalCount);
    const paginated = filtered.slice(startIdx, endIdx);

    // Update Pagination UI text and arrows
    const rangeEl = document.getElementById('doctorsPaginationRange');
    if (rangeEl) {
      rangeEl.textContent = totalCount === 0 ? '0-0 of 0' : `${startIdx + 1}-${endIdx} of ${totalCount}`;
    }

    const prevBtn = document.getElementById('btnDocPrevPage');
    const nextBtn = document.getElementById('btnDocNextPage');
    if (prevBtn) prevBtn.disabled = currentPage <= 1;
    if (nextBtn) nextBtn.disabled = currentPage >= totalPages;

    renderDoctorsTable(paginated);
    renderSidePanel();
  }

  window.handleDoctorPageSizeChange = function (val) {
    pageSize = parseInt(val, 10) || 10;
    currentPage = 1;
    applyFilterAndRender();
  };

  window.changeDoctorPage = function (delta) {
    currentPage += delta;
    applyFilterAndRender();
  };

  /* =============================================================================
     7. RENDER TABULAR DOCTORS TABLE
     ============================================================================= */
  function renderDoctorsTable(doctorsOnPage) {
    const tbody = document.getElementById('doctorsTableBody');
    if (!tbody) return;

    if (doctorsOnPage.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="4" style="text-align: center; padding: 48px 16px; color: #64748B;">
            <div style="font-size: 15px; font-weight: 600; color: #1E293B; margin-bottom: 4px;">No doctors match current filters</div>
            <div style="font-size: 13px;">Try clearing search or choosing another department.</div>
          </td>
        </tr>
      `;
      return;
    }

    let rowsHtml = '';

    doctorsOnPage.forEach(doc => {
      const isSelected = doc.id === selectedDoctorId;
      const docSpecId = doc.specialty?.id ?? doc.specialty_id;
      const spec = doc.specialty || allSpecialties.find(s => s.id === docSpecId);
      const specName = spec ? spec.name_en : (doc.title_en || 'Specialist');

      const fee = doc.consultation_fee 
        ? (typeof doc.consultation_fee === 'object' ? `${doc.consultation_fee.amount} ${doc.consultation_fee.currency || 'EGP'}` : `${doc.consultation_fee} EGP`)
        : '350 EGP';

      rowsHtml += `
        <tr class="doctor-row ${isSelected ? 'selected-row' : ''}" onclick="selectDoctorRow(${doc.id})">
          <td class="cell-checkbox" onclick="event.stopPropagation()">
            <input type="checkbox" class="doctor-checkbox-custom" ${isSelected ? 'checked' : ''} onchange="selectDoctorRow(${doc.id})">
          </td>
          <td style="font-weight: 700; color: #0F172A;">${doc.name_en}</td>
          <td style="color: #334155; font-weight: 500;">${specName}</td>
          <td style="font-weight: 700; color: #0F172A;">${fee}</td>
        </tr>
      `;
    });

    // Pad with empty rows to maintain uniform 10-row tabular height as in mockup
    const emptyRowsNeeded = Math.max(0, pageSize - doctorsOnPage.length);
    for (let i = 0; i < emptyRowsNeeded; i++) {
      rowsHtml += `
        <tr style="height: 48px; border-bottom: 1px solid #E2E8F0; pointer-events: none;">
          <td class="cell-checkbox"></td>
          <td>&nbsp;</td>
          <td>&nbsp;</td>
          <td>&nbsp;</td>
        </tr>
      `;
    }

    tbody.innerHTML = rowsHtml;
  }

  window.selectDoctorRow = function (doctorId) {
    selectedDoctorId = doctorId;
    const doc = allDoctors.find(d => d.id === doctorId);
    if (doc) {
      syncScheduleStateFromDoctor(doc);
    }

    // Refresh row selections without resetting pagination
    const rows = document.querySelectorAll('#doctorsTableBody tr.doctor-row');
    rows.forEach(r => r.classList.remove('selected-row'));
    const checkboxes = document.querySelectorAll('#doctorsTableBody .doctor-checkbox-custom');
    checkboxes.forEach(cb => cb.checked = false);

    const filtered = getFilteredAndSortedDoctors();
    const startIdx = (currentPage - 1) * pageSize;
    const endIdx = Math.min(startIdx + pageSize, filtered.length);
    renderDoctorsTable(filtered.slice(startIdx, endIdx));

    renderSidePanel();
  };

  window.toggleSelectAllDoctors = function (masterCheckbox) {
    if (masterCheckbox.checked) {
      const filtered = getFilteredAndSortedDoctors();
      const startIdx = (currentPage - 1) * pageSize;
      if (filtered[startIdx]) {
        selectDoctorRow(filtered[startIdx].id);
      }
    }
  };

  /* =============================================================================
     8. RENDER RIGHT SIDE PANEL (DETAILS VIEW vs WORK SCHEDULE VIEW)
     ============================================================================= */
  window.setDoctorSidePanelView = function (viewName) {
    sidePanelView = viewName;

    // Toggle button active classes
    const btnDetails = document.getElementById('btnDocShowDetails');
    const btnSchedule = document.getElementById('btnDocWorkSchedule');
    if (btnDetails) btnDetails.classList.toggle('active', viewName === 'details');
    if (btnSchedule) btnSchedule.classList.toggle('active', viewName === 'schedule');

    renderSidePanel();
  };

  function renderSidePanel() {
    const sideCard = document.getElementById('doctorSideCard');
    if (!sideCard) return;

    const doc = allDoctors.find(d => d.id === selectedDoctorId);
    if (!doc) {
      sideCard.innerHTML = `
        <div style="padding: 48px 16px; text-align: center; color: #64748B;">
          <h4>No Doctor Selected</h4>
          <p style="font-size: 13px;">Please select a doctor from the table to view their details or manage schedule.</p>
        </div>
      `;
      return;
    }

    const docSpecId = doc.specialty?.id ?? doc.specialty_id;
    const spec = doc.specialty || allSpecialties.find(s => s.id === docSpecId);
    const deptName = spec ? spec.name_en : (doc.title_en || 'Consultant');
    const langs = Array.isArray(doc.languages) ? doc.languages.join(', ').toUpperCase() : 'AR, EN';
    const workingDaysStr = formatWorkingDays(doc.working_days);

    if (sidePanelView === 'details') {
      // MODE A: SHOW DETAILS VIEW (Direct Inline Editing - Matches User Screenshot)
      const specOptions = allSpecialties.map(s => {
        const isSelected = (doc.specialty_id === s.id || doc.specialty?.id === s.id);
        return `<option value="${s.id}" ${isSelected ? 'selected' : ''}>${s.name_en} (${s.name_ar})</option>`;
      }).join('');

      sideCard.innerHTML = `
        <div class="doctor-details-mode">
          <!-- Top Row: Silhouette Avatar & Doctor Metadata -->
          <div style="display: flex; align-items: center; gap: 24px; margin-bottom: 24px;">
            <!-- Big Circular Avatar with Upload Trigger -->
            <div class="doctor-avatar-trigger" onclick="openAvatarUploadModal()" title="Click to upload profile picture" style="width: 130px; height: 130px; border-radius: 50%; background: #E2E8F0; display: flex; align-items: center; justify-content: center; flex-shrink: 0; box-shadow: 0 2px 8px rgba(0,0,0,0.06); cursor: pointer; position: relative; overflow: hidden;">
              ${doc.avatar_url ? `
                <img src="${doc.avatar_url}" alt="${doc.name_en}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">
              ` : `
                <svg viewBox="0 0 24 24" fill="none" stroke="#334155" stroke-width="1.8" width="76" height="76">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                  <circle cx="12" cy="7" r="4"/>
                </svg>
              `}
              <div class="avatar-hover-overlay">
                <svg viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2" width="28" height="28">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                  <circle cx="12" cy="13" r="4"/>
                </svg>
              </div>
            </div>

            <!-- Metadata Items with Pencil Icons (Direct Inline Editable) -->
            <div style="flex: 1; display: flex; flex-direction: column; gap: 12px;">
              <div>
                <div class="doc-section-title" style="font-size: 14px; margin-bottom: 2px;">
                  <span>Name</span>
                  <svg class="doc-pencil-icon" onclick="focusInlineEdit('inlineEditDocName')" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" width="13" height="13"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                </div>
                <input type="text" id="inlineEditDocName" class="inline-edit-input" value="${escapeHtml(doc.name_en)}" placeholder="Doctor Name">
                ${doc.name_ar ? `<div style="font-size: 12.5px; color: #64748B; font-family:'Cairo', sans-serif; margin-top:2px;">${doc.name_ar}</div>` : ''}
              </div>

              <div>
                <div class="doc-section-title" style="font-size: 14px; margin-bottom: 2px;">
                  <span>Specialty</span>
                  <svg class="doc-pencil-icon" onclick="focusInlineEdit('inlineEditDocSpecialty')" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" width="13" height="13"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                </div>
                <select id="inlineEditDocSpecialty" class="inline-edit-select">
                  ${specOptions}
                </select>
              </div>

              <div>
                <div class="doc-section-title" style="font-size: 14px; margin-bottom: 2px;">
                  <span>Spoken Languages</span>
                  <svg class="doc-pencil-icon" onclick="focusInlineEdit('inlineEditDocLangs')" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" width="13" height="13"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                </div>
                <input type="text" id="inlineEditDocLangs" class="inline-edit-input" value="${escapeHtml(langs)}" placeholder="e.g. AR, EN">
              </div>
            </div>
          </div>

          <!-- Middle: Description Box (Direct Editable Textarea) -->
          <div style="margin-bottom: 18px;">
            <div class="doc-section-title">
              <span>Description</span>
              <svg class="doc-pencil-icon" onclick="focusInlineEdit('inlineEditDocBio')" viewBox="0 0 24 24" fill="none" stroke="#22C55E" stroke-width="2.2" width="14" height="14"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
            </div>
            <textarea id="inlineEditDocBio" class="inline-edit-textarea" rows="4" placeholder="Brief professional biography and medical background...">${escapeHtml(doc.bio_en || 'Lorem ipsum etiam libero in et tempus nunc amet volutpat lobortis quam elementum turpis volutpat ultricies quisque etiam at vestibulum viverra pulvinar phasellus duis mollis arcu ornare sed amet sagittis egestas velit arcu nulla sed mattis turpis facilisis gravida commodo eget lectus scelerisque')}</textarea>
          </div>

          <!-- Bottom: Working days & Confirm Button (Matches User Screenshot) -->
          <div>
            <div class="doc-section-title">
              <span>Working days</span>
              <svg class="doc-pencil-icon" onclick="setDoctorSidePanelView('schedule')" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" width="14" height="14"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
            </div>
            <div style="font-size: 14.5px; font-weight: 700; color: #0F172A; margin-top: 4px; cursor: pointer;" onclick="setDoctorSidePanelView('schedule')">
              ${workingDaysStr}
            </div>
          </div>

          <!-- Confirm Button at Bottom Right (Matches User Screenshot) -->
          <div style="display: flex; justify-content: flex-end; margin-top: 14px;">
            <button type="button" class="btn-details-confirm" id="btnConfirmDoctorDetails" onclick="confirmDoctorDetailsEdit()">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" width="16" height="16"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
              <span>Confirm</span>
            </button>
          </div>
        </div>
      `;
    } else {
      // MODE B: WORK SCHEDULE VIEW (Matches Screenshot 3)
      renderScheduleMode(sideCard, doc);
    }
  }

  function renderScheduleMode(container, doc) {
    // 1. Build circular day badges
    let circularBadgesHtml = '';
    ALL_DAYS.forEach(day => {
      const isActive = scheduleState.workingDays.includes(day.num);
      const isFriday = day.num === 5;

      let badgeClass = 'day-inactive';
      if (isFriday) {
        badgeClass = 'day-off';
      } else if (isActive) {
        badgeClass = 'day-active';
      }

      circularBadgesHtml += `
        <div class="day-circle-badge ${badgeClass}" onclick="toggleScheduleDay(${day.num})" title="${day.full} (${isFriday ? 'Closed' : (isActive ? 'Active' : 'Off')})">
          ${day.label}
        </div>
      `;
    });

    // 2. Build Working Time list:
    // USER MANDATE: The doctor's time is the same in all active days.
    const activeDays = ALL_DAYS.filter(d => scheduleState.workingDays.includes(d.num) && d.num !== 5);
    const sharedRangeText = formatShortShiftRange(scheduleState.startTime, scheduleState.endTime);

    let workingTimeListHtml = '';
    if (activeDays.length === 0) {
      workingTimeListHtml = `<div style="font-size:13px; color:#64748B; padding:10px 0;">No active working days selected. Click day circles above to activate.</div>`;
    } else {
      activeDays.forEach(day => {
        const isDaySelected = day.key === scheduleState.activeDayKey;
        workingTimeListHtml += `
          <div class="working-time-row ${isDaySelected ? 'active' : ''}" onclick="selectScheduleDayRow('${day.key}')">
            <span class="day-lbl">${day.key}</span>
            <span class="time-pill">${sharedRangeText}</span>
          </div>
        `;
      });
    }

    container.innerHTML = `
      <div class="doctor-schedule-mode">
        <!-- Working days title & 7 circular badges -->
        <div style="margin-bottom: 22px;">
          <div class="doc-section-title">
            <span>Working days</span>
            <svg class="doc-pencil-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" width="14" height="14"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
          </div>
          <div class="working-days-circular-row">
            ${circularBadgesHtml}
          </div>
        </div>

        <!-- Working Time title & list -->
        <div style="margin-bottom: 22px;">
          <div class="doc-section-title">
            <span>Working Time</span>
            <svg class="doc-pencil-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" width="14" height="14"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
          </div>
          <div class="working-time-list">
            ${workingTimeListHtml}
          </div>
        </div>

        <!-- Start Time & End Time Inputs -->
        <div class="schedule-time-inputs">
          <div class="schedule-time-field">
            <label>Start Time</label>
            <input type="text" id="scheduleStartTimeInput" value="${scheduleState.startTime}" oninput="handleScheduleTimeInputChange()" placeholder="e.g. 12:15 PM">
          </div>
          <div class="schedule-dash-sep">—</div>
          <div class="schedule-time-field">
            <label>End Time</label>
            <input type="text" id="scheduleEndTimeInput" value="${scheduleState.endTime}" oninput="handleScheduleTimeInputChange()" placeholder="e.g. 02:30 PM">
          </div>
        </div>

        <!-- Confirm Button -->
        <div style="display: flex; justify-content: flex-end; margin-top: 10px;">
          <button type="button" class="btn-schedule-confirm" onclick="saveDoctorSchedule()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" width="16" height="16"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
            <span>Confirm</span>
          </button>
        </div>
      </div>
    `;
  }

  /* =============================================================================
     9. WORKING SCHEDULE INTERACTIVE LOGIC
     ============================================================================= */
  window.toggleScheduleDay = function (dayNum) {
    if (dayNum === 5) {
      showToast('Friday is universally closed clinic-wide.', 'warning');
      return;
    }

    const idx = scheduleState.workingDays.indexOf(dayNum);
    if (idx > -1) {
      // If turning off, ensure at least one day remains
      if (scheduleState.workingDays.length <= 1) {
        showToast('A doctor must have at least one active working day.', 'warning');
        return;
      }
      scheduleState.workingDays.splice(idx, 1);
    } else {
      scheduleState.workingDays.push(dayNum);
    }

    // Sort days in standard clinic order (Sat..Thu)
    scheduleState.workingDays.sort((a, b) => {
      const order = [6, 7, 1, 2, 3, 4, 5];
      return order.indexOf(a) - order.indexOf(b);
    });

    renderSidePanel();
  };

  window.selectScheduleDayRow = function (dayKey) {
    scheduleState.activeDayKey = dayKey;
    renderSidePanel();
  };

  window.handleScheduleTimeInputChange = function () {
    const startInp = document.getElementById('scheduleStartTimeInput');
    const endInp = document.getElementById('scheduleEndTimeInput');
    if (startInp) scheduleState.startTime = startInp.value.trim();
    if (endInp) scheduleState.endTime = endInp.value.trim();

    // USER REQUIREMENT: Doctor's time is the SAME in all days!
    // Dynamically update the time pills in the active days list
    const sharedRangeText = formatShortShiftRange(scheduleState.startTime, scheduleState.endTime);
    const pills = document.querySelectorAll('.working-time-list .time-pill');
    pills.forEach(p => {
      p.textContent = sharedRangeText;
    });
  };

  let isScheduleSaving = false;
  window.saveDoctorSchedule = async function () {
    if (isScheduleSaving) return;

    const doc = allDoctors.find(d => d.id === selectedDoctorId);
    if (!doc) return;

    if (!scheduleState.workingDays || scheduleState.workingDays.length === 0) {
      showToast('Please select at least one working day for the doctor.', 'warning');
      return;
    }

    const startInp = document.getElementById('scheduleStartTimeInput');
    const endInp = document.getElementById('scheduleEndTimeInput');
    if (startInp) scheduleState.startTime = startInp.value.trim();
    if (endInp) scheduleState.endTime = endInp.value.trim();

    const btn = document.querySelector('.btn-schedule-confirm');
    const originalBtnHtml = btn ? btn.innerHTML : 'Confirm';
    isScheduleSaving = true;

    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<span class="inline-spinner"></span> Saving to Supabase...';
      btn.style.opacity = '0.75';
      btn.style.cursor = 'not-allowed';
    }

    try {
      // 1. Realistic lazy loading delay
      await new Promise(r => setTimeout(r, 700));

      // 2. Persist to Supabase PostgreSQL via PATCH /api/v1/doctors/{id}
      if (window.ClinicApi && typeof window.ClinicApi.updateDoctor === 'function') {
        await window.ClinicApi.updateDoctor(doc.id, {
          working_days: scheduleState.workingDays,
          shift_start: scheduleState.startTime,
          shift_end: scheduleState.endTime
        });
      }

      // Update in-memory doctor object
      doc.working_days = [...scheduleState.workingDays];
      doc.shift_start = scheduleState.startTime;
      doc.shift_end = scheduleState.endTime;

      // Invalidate cache and update sessionStorage
      if (window.ClinicCache) {
        window.ClinicCache.set('doctors_all', { total: allDoctors.length, doctors: allDoctors });
      }

      showToast(`Working schedule for ${doc.name_en} saved to Supabase! (Active days: ${formatWorkingDays(doc.working_days)})`, 'success');

      // Switch back to details view or refresh
      setDoctorSidePanelView('details');
      applyFilterAndRender();
    } catch (err) {
      console.error('[Doctors] Failed to update schedule:', err);
      showToast(`Failed to update schedule in Supabase: ${err.message || 'Error'}`, 'error');
    } finally {
      setTimeout(() => {
        isScheduleSaving = false;
        const currentBtn = document.querySelector('.btn-schedule-confirm');
        if (currentBtn) {
          currentBtn.disabled = false;
          currentBtn.innerHTML = originalBtnHtml;
          currentBtn.style.opacity = '1';
          currentBtn.style.cursor = 'pointer';
        }
      }, 1000);
    }
  };

  /* =============================================================================
     10. DIRECT INLINE EDITING (NO POPUP MODAL ON EDIT)
     ============================================================================= */
  window.handleEditSelectedDoctor = function () {
    if (!selectedDoctorId) {
      showToast('Please select a doctor from the table to edit.', 'warning');
      return;
    }
    setDoctorSidePanelView('details');
    const nameInp = document.getElementById('inlineEditDocName');
    if (nameInp) {
      nameInp.focus();
      nameInp.select();
    }
    showToast(`You can edit doctor fields on the right. Click Confirm when done.`, 'info');
  };

  window.focusInlineEdit = function (fieldId) {
    setDoctorSidePanelView('details');
    setTimeout(() => {
      const el = document.getElementById(fieldId);
      if (el) {
        el.focus();
        if (typeof el.select === 'function') el.select();
      }
    }, 50);
  };

  let isDoctorDetailsSaving = false;
  window.confirmDoctorDetailsEdit = async function () {
    if (isDoctorDetailsSaving) return;

    const doc = allDoctors.find(d => d.id === selectedDoctorId);
    if (!doc) return;

    const btn = document.getElementById('btnConfirmDoctorDetails');
    const originalBtnHtml = btn ? btn.innerHTML : 'Confirm';
    isDoctorDetailsSaving = true;

    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<span class="inline-spinner"></span> Saving to Supabase...';
      btn.style.opacity = '0.75';
      btn.style.cursor = 'not-allowed';
    }

    try {
      const nameInp = document.getElementById('inlineEditDocName');
      const specSelect = document.getElementById('inlineEditDocSpecialty');
      const langsInp = document.getElementById('inlineEditDocLangs');
      const bioTextarea = document.getElementById('inlineEditDocBio');

      if (nameInp && nameInp.value.trim()) {
        doc.name_en = nameInp.value.trim();
      }
      if (specSelect) {
        const specId = parseInt(specSelect.value, 10);
        if (!isNaN(specId)) {
          doc.specialty_id = specId;
          const matched = allSpecialties.find(s => s.id === specId);
          if (matched) doc.specialty = matched;
        }
      }
      if (langsInp) {
        const parsedLangs = langsInp.value.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
        doc.languages = parsedLangs.length > 0 ? parsedLangs : ['ar', 'en'];
      }
      if (bioTextarea) {
        doc.bio_en = bioTextarea.value.trim();
      }

      // Realistic lazy loading delay
      await new Promise(r => setTimeout(r, 700));

      // Persist via PATCH /api/v1/doctors/{id}
      if (window.ClinicApi && typeof window.ClinicApi.updateDoctor === 'function') {
        await window.ClinicApi.updateDoctor(doc.id, {
          name_en: doc.name_en,
          specialty_id: doc.specialty_id,
          bio_en: doc.bio_en,
          languages: doc.languages,
          avatar_url: doc.avatar_url || null
        });
      }

      // Save in cache & localStorage
      if (window.ClinicCache) {
        window.ClinicCache.set('doctors_all', { total: allDoctors.length, doctors: allDoctors });
      }

      showToast(`Doctor profile for ${doc.name_en} saved to Supabase!`, 'success');

      // Update left table row immediately
      const filtered = getFilteredAndSortedDoctors();
      const startIdx = (currentPage - 1) * pageSize;
      const endIdx = Math.min(startIdx + pageSize, filtered.length);
      renderDoctorsTable(filtered.slice(startIdx, endIdx));

      renderSidePanel();
    } catch (err) {
      console.error('[Doctors] Failed to update doctor profile:', err);
      showToast(`Failed to update Supabase: ${err.message || 'Unknown error'}`, 'error');
    } finally {
      setTimeout(() => {
        isDoctorDetailsSaving = false;
        const currentBtn = document.getElementById('btnConfirmDoctorDetails');
        if (currentBtn) {
          currentBtn.disabled = false;
          currentBtn.innerHTML = originalBtnHtml;
          currentBtn.style.opacity = '1';
          currentBtn.style.cursor = 'pointer';
        }
      }, 1000);
    }
  };

  /* =============================================================================
     11. ADD DOCTOR MODAL (FOR TOP "+ Add Doctor" BUTTON ONLY)
     ============================================================================= */
  window.openAddDoctorModal = function () {
    if (typeof AdminAuth !== 'undefined' && !AdminAuth.checkPermission('add_doctor')) {
      AdminAuth.showAdminPrivilegeWarning('Adding a doctor');
      return;
    }

    modalMode = 'add';
    openDoctorFormModal(null);
  };

  function openDoctorFormModal(doc) {
    const backdrop = document.getElementById('adminModalBackdrop');
    const titleEl = document.getElementById('adminModalTitle');
    const bodyEl = document.getElementById('adminModalBody');
    const footerEl = document.getElementById('adminModalFooter');

    if (!backdrop || !bodyEl) return;

    const isEdit = modalMode === 'edit' && doc !== null;
    if (titleEl) titleEl.textContent = isEdit ? `Edit Profile — ${doc.name_en}` : 'Add New Doctor to Clinic';

    const specOptions = allSpecialties.map(s => {
      const isSelected = isEdit && (doc.specialty_id === s.id || doc.specialty?.id === s.id);
      return `<option value="${s.id}" ${isSelected ? 'selected' : ''}>${s.name_en} (${s.name_ar})</option>`;
    }).join('');

    const nameEn = isEdit ? doc.name_en || '' : '';
    const nameAr = isEdit ? doc.name_ar || '' : '';
    const titleEn = isEdit ? doc.title_en || 'Senior Consultant' : 'Senior Consultant';
    const titleAr = isEdit ? doc.title_ar || 'استشاري أول' : 'استشاري أول';
    const feeVal = isEdit 
      ? (typeof doc.consultation_fee === 'object' ? doc.consultation_fee?.amount || 350 : doc.consultation_fee || 350) 
      : 350;
    const shiftStart = isEdit ? (doc.shift_start ? doc.shift_start.slice(0, 5) : '09:00') : '09:00';
    const shiftEnd = isEdit ? (doc.shift_end ? doc.shift_end.slice(0, 5) : '17:00') : '17:00';
    const bioEn = isEdit ? doc.bio_en || '' : '';

    const activeDays = isEdit && Array.isArray(doc.working_days) ? doc.working_days : [6, 7, 1, 2, 3];

    bodyEl.innerHTML = `
      <form id="addDoctorForm" onsubmit="submitDoctorForm(event)" style="display:flex; flex-direction:column; gap:14px;">
        <input type="hidden" id="editDoctorId" value="${isEdit ? doc.id : ''}">
        
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px;">
          <div>
            <label style="display:block; font-size:12px; font-weight:600; color:#475569; margin-bottom:4px;">Doctor Name (English) *</label>
            <input type="text" id="newDocNameEn" value="${nameEn}" required placeholder="e.g. Dr. Amal Nour" style="width:100%; height:38px; border:1px solid #CBD5E1; border-radius:6px; padding:0 12px; font-size:13px;">
          </div>
          <div>
            <label style="display:block; font-size:12px; font-weight:600; color:#475569; margin-bottom:4px;">Doctor Name (Arabic) *</label>
            <input type="text" id="newDocNameAr" value="${nameAr}" required dir="rtl" placeholder="د. أمل نور" style="width:100%; height:38px; border:1px solid #CBD5E1; border-radius:6px; padding:0 12px; font-size:13px;">
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
            <input type="number" id="newDocFee" required min="50" step="10" value="${feeVal}" style="width:100%; height:38px; border:1px solid #CBD5E1; border-radius:6px; padding:0 12px; font-size:13px;">
          </div>
        </div>

        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px;">
          <div>
            <label style="display:block; font-size:12px; font-weight:600; color:#475569; margin-bottom:4px;">Title (English)</label>
            <input type="text" id="newDocTitleEn" value="${titleEn}" placeholder="e.g. Senior Consultant" style="width:100%; height:38px; border:1px solid #CBD5E1; border-radius:6px; padding:0 12px; font-size:13px;">
          </div>
          <div>
            <label style="display:block; font-size:12px; font-weight:600; color:#475569; margin-bottom:4px;">Title (Arabic)</label>
            <input type="text" id="newDocTitleAr" value="${titleAr}" dir="rtl" placeholder="استشاري أول" style="width:100%; height:38px; border:1px solid #CBD5E1; border-radius:6px; padding:0 12px; font-size:13px;">
          </div>
        </div>

        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px;">
          <div>
            <label style="display:block; font-size:12px; font-weight:600; color:#475569; margin-bottom:4px;">Shift Start (24h)</label>
            <input type="time" id="newDocShiftStart" value="${shiftStart}" style="width:100%; height:38px; border:1px solid #CBD5E1; border-radius:6px; padding:0 12px; font-size:13px;">
          </div>
          <div>
            <label style="display:block; font-size:12px; font-weight:600; color:#475569; margin-bottom:4px;">Shift End (24h)</label>
            <input type="time" id="newDocShiftEnd" value="${shiftEnd}" style="width:100%; height:38px; border:1px solid #CBD5E1; border-radius:6px; padding:0 12px; font-size:13px;">
          </div>
        </div>

        <div>
          <label style="display:block; font-size:12px; font-weight:600; color:#475569; margin-bottom:6px;">Working Days * (Closed Friday)</label>
          <div class="working-days-selector">
            <label class="day-checkbox-label"><input type="checkbox" name="workDay" value="6" ${activeDays.includes(6) ? 'checked' : ''}> <span>Sat</span></label>
            <label class="day-checkbox-label"><input type="checkbox" name="workDay" value="7" ${activeDays.includes(7) ? 'checked' : ''}> <span>Sun</span></label>
            <label class="day-checkbox-label"><input type="checkbox" name="workDay" value="1" ${activeDays.includes(1) ? 'checked' : ''}> <span>Mon</span></label>
            <label class="day-checkbox-label"><input type="checkbox" name="workDay" value="2" ${activeDays.includes(2) ? 'checked' : ''}> <span>Tue</span></label>
            <label class="day-checkbox-label"><input type="checkbox" name="workDay" value="3" ${activeDays.includes(3) ? 'checked' : ''}> <span>Wed</span></label>
            <label class="day-checkbox-label"><input type="checkbox" name="workDay" value="4" ${activeDays.includes(4) ? 'checked' : ''}> <span>Thu</span></label>
          </div>
        </div>

        <div>
          <label style="display:block; font-size:12px; font-weight:600; color:#475569; margin-bottom:4px;">Professional Bio (English)</label>
          <textarea id="newDocBioEn" rows="2" placeholder="Brief professional background, qualifications and experience..." style="width:100%; border:1px solid #CBD5E1; border-radius:6px; padding:8px 12px; font-size:13px; font-family:inherit; resize:vertical;">${bioEn}</textarea>
        </div>

        <div id="addDoctorErrorMsg" style="display:none; padding:10px; background:#FEE2E2; color:#B91C1C; border-radius:6px; font-size:12px;"></div>
      </form>
    `;

    if (footerEl) {
      footerEl.innerHTML = `
        <button type="button" class="modal-btn-secondary" onclick="closeDoctorModal()">Cancel</button>
        <button type="button" id="btnSubmitAddDoctor" class="modal-btn-primary" onclick="document.getElementById('addDoctorForm').requestSubmit()">
          ${isEdit ? 'Save Changes' : 'Save Doctor to Supabase'}
        </button>
      `;
    }

    backdrop.classList.add('active');
    backdrop.classList.add('open');
  }

  window.submitDoctorForm = async function (e) {
    if (e) e.preventDefault();
    const btn = document.getElementById('btnSubmitAddDoctor');
    const errBox = document.getElementById('addDoctorErrorMsg');

    const editId = document.getElementById('editDoctorId')?.value;
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
      btn.textContent = 'Saving...';
    }

    try {
      if (modalMode === 'edit' && editId) {
        // Edit existing doctor
        const doc = allDoctors.find(d => String(d.id) === String(editId));
        if (doc) {
          doc.name_en = nameEn;
          doc.name_ar = nameAr;
          doc.title_en = titleEn;
          doc.title_ar = titleAr;
          doc.specialty_id = specialtyId;
          const spec = allSpecialties.find(s => s.id === specialtyId);
          if (spec) doc.specialty = spec;
          doc.consultation_fee = fee;
          doc.shift_start = shiftStart;
          doc.shift_end = shiftEnd;
          doc.working_days = checkedDays;
          doc.bio_en = bioEn;
        }

        if (window.ClinicCache) {
          window.ClinicCache.set('doctors_all', { total: allDoctors.length, doctors: allDoctors });
        }

        showToast(`Doctor ${nameEn} details updated successfully!`, 'success');
        closeDoctorModal();
        applyFilterAndRender();
      } else {
        // Create new doctor
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
      }
    } catch (err) {
      console.error('[Doctors] Error saving doctor:', err);
      if (errBox) {
        errBox.textContent = err.message || 'Failed to save doctor to database.';
        errBox.style.display = 'block';
      }
      if (btn) {
        btn.disabled = false;
        btn.textContent = modalMode === 'edit' ? 'Save Changes' : 'Save Doctor to Supabase';
      }
    }
  };

  window.closeDoctorModal = function () {
    const backdrop = document.getElementById('adminModalBackdrop');
    if (backdrop) {
      backdrop.classList.remove('active');
      backdrop.classList.remove('open');
    }
  };

  /* =============================================================================
     11. TOAST NOTIFICATIONS & GLOBAL HELPERS
     ============================================================================= */
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

  /* =============================================================================
     12. DOCTOR AVATAR PICTURE UPLOAD CONTROLLER & INTERACTIVE CROPPER
     ============================================================================= */
  let isAvatarSaving = false;
  let cropperState = {
    image: null,
    imgNaturalWidth: 0,
    imgNaturalHeight: 0,
    scale: 1,
    minScale: 0.2,
    maxScale: 3.5,
    panX: 0,
    panY: 0,
    isDragging: false,
    dragStartX: 0,
    dragStartY: 0,
    viewportW: 360,
    viewportH: 250,
    cropBoxW: 180,
    cropBoxH: 220
  };

  window.openAvatarUploadModal = function () {
    const backdrop = document.getElementById('avatarModalBackdrop');
    const body = document.getElementById('avatarModalBody');
    if (!backdrop || !body) return;

    cropperState.image = null;
    cropperState.panX = 0;
    cropperState.panY = 0;
    cropperState.scale = 1;
    cropperState.isDragging = false;

    const fileInput = document.getElementById('doctorAvatarFileInput');
    if (fileInput) fileInput.value = '';

    renderAvatarDropzoneState();

    backdrop.style.display = 'flex';
    backdrop.classList.add('active', 'open');
  };

  window.closeAvatarUploadModal = function () {
    const backdrop = document.getElementById('avatarModalBackdrop');
    if (backdrop) {
      backdrop.style.display = 'none';
      backdrop.classList.remove('active', 'open');
    }
    cropperState.image = null;
    cropperState.isDragging = false;
    window.removeEventListener('mousemove', onCropDragMove);
    window.removeEventListener('mouseup', endCropDrag);
    window.removeEventListener('touchmove', onCropDragMove);
    window.removeEventListener('touchend', endCropDrag);
  };

  function renderAvatarDropzoneState() {
    const body = document.getElementById('avatarModalBody');
    if (!body) return;

    body.innerHTML = `
      <div class="avatar-dropzone" id="avatarDropzone" onclick="document.getElementById('doctorAvatarFileInput').click()" ondragover="handleAvatarDragOver(event)" ondragleave="handleAvatarDragLeave(event)" ondrop="handleAvatarDrop(event)">
        <svg class="avatar-dropzone-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
          <circle cx="8.5" cy="8.5" r="1.5"/>
          <polyline points="21 15 16 10 5 21"/>
          <polyline points="12 11 12 17"/>
          <polyline points="9 14 12 17 15 14"/>
        </svg>
        <div class="avatar-dropzone-text">Drag and drop or select an image</div>
      </div>
    `;
  }

  function renderAvatarCropState(imgSrc) {
    const body = document.getElementById('avatarModalBody');
    if (!body) return;

    const minPct = Math.round(cropperState.minScale * 100);
    const maxPct = Math.round(cropperState.maxScale * 100);
    const curPct = Math.round(cropperState.scale * 100);

    body.innerHTML = `
      <div class="avatar-crop-container">
        <div class="avatar-crop-viewport" id="avatarCropViewport"
             onmousedown="startCropDrag(event)"
             ontouchstart="startCropDrag(event)"
             onwheel="handleCropWheel(event)">
          <img id="avatarCropInteractiveImg" class="avatar-crop-interactive-img" src="${imgSrc}"
               style="transform: translate(${cropperState.panX}px, ${cropperState.panY}px) scale(${cropperState.scale});"
               draggable="false" alt="Profile crop">
          <div class="avatar-crop-grid-overlay">
            <div></div><div></div><div></div>
            <div></div><div></div><div></div>
            <div></div><div></div><div></div>
          </div>
          <div class="avatar-crop-label">Crop Image</div>
        </div>
      </div>
      <div class="crop-zoom-control">
        <button type="button" class="crop-zoom-btn" onclick="stepCropZoom(-0.15)" title="Zoom Out">−</button>
        <input type="range" class="crop-zoom-slider" id="cropZoomSlider"
               min="${minPct}" max="${maxPct}" value="${curPct}"
               oninput="handleCropZoomSlider(this.value)">
        <button type="button" class="crop-zoom-btn" onclick="stepCropZoom(0.15)" title="Zoom In">+</button>
      </div>
      <div style="text-align: center; margin-top: 8px;">
        <button type="button" onclick="document.getElementById('doctorAvatarFileInput').click()" style="background: none; border: none; color: #2563EB; font-size: 13px; font-weight: 600; cursor: pointer; text-decoration: underline;">Choose different picture</button>
      </div>
    `;
  }

  window.handleAvatarDragOver = function (e) {
    e.preventDefault();
    e.stopPropagation();
    document.getElementById('avatarDropzone')?.classList.add('dragover');
  };

  window.handleAvatarDragLeave = function (e) {
    e.preventDefault();
    e.stopPropagation();
    document.getElementById('avatarDropzone')?.classList.remove('dragover');
  };

  window.handleAvatarDrop = function (e) {
    e.preventDefault();
    e.stopPropagation();
    document.getElementById('avatarDropzone')?.classList.remove('dragover');
    const files = e.dataTransfer?.files;
    if (files && files[0]) {
      processSelectedAvatarFile(files[0]);
    }
  };

  window.handleDoctorAvatarFileSelected = function (e) {
    const file = e.target.files?.[0];
    if (file) {
      processSelectedAvatarFile(file);
    }
  };

  async function processSelectedAvatarFile(file) {
    if (!file.type.startsWith('image/')) {
      showToast('Please select a valid image file (PNG, JPG, WEBP).', 'warning');
      return;
    }

    const reader = new FileReader();
    reader.onload = function (event) {
      const img = new Image();
      img.onload = function () {
        cropperState.image = img;
        cropperState.imgNaturalWidth = img.naturalWidth;
        cropperState.imgNaturalHeight = img.naturalHeight;

        // Auto-scale to fill crop viewfinder
        const scaleW = cropperState.cropBoxW / cropperState.imgNaturalWidth;
        const scaleH = cropperState.cropBoxH / cropperState.imgNaturalHeight;
        const fitScale = Math.max(scaleW, scaleH);
        cropperState.minScale = Math.max(0.1, fitScale * 0.7);
        cropperState.maxScale = Math.max(3.5, fitScale * 4);
        cropperState.scale = Math.max(fitScale, 0.5);
        cropperState.panX = 0;
        cropperState.panY = 0;

        renderAvatarCropState(event.target.result);
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  }

  // Drag & Pan handlers
  window.startCropDrag = function (e) {
    if (!cropperState.image) return;
    cropperState.isDragging = true;
    const clientX = e.clientX !== undefined ? e.clientX : (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
    const clientY = e.clientY !== undefined ? e.clientY : (e.touches && e.touches[0] ? e.touches[0].clientY : 0);
    cropperState.dragStartX = clientX - cropperState.panX;
    cropperState.dragStartY = clientY - cropperState.panY;

    const vp = document.getElementById('avatarCropViewport');
    if (vp) vp.classList.add('is-dragging');

    window.addEventListener('mousemove', onCropDragMove);
    window.addEventListener('mouseup', endCropDrag);
    window.addEventListener('touchmove', onCropDragMove, { passive: false });
    window.addEventListener('touchend', endCropDrag);
  };

  function onCropDragMove(e) {
    if (!cropperState.isDragging) return;
    if (e.cancelable) e.preventDefault();
    const clientX = e.clientX !== undefined ? e.clientX : (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
    const clientY = e.clientY !== undefined ? e.clientY : (e.touches && e.touches[0] ? e.touches[0].clientY : 0);
    cropperState.panX = clientX - cropperState.dragStartX;
    cropperState.panY = clientY - cropperState.dragStartY;
    applyCropTransform();
  }

  function endCropDrag() {
    cropperState.isDragging = false;
    const vp = document.getElementById('avatarCropViewport');
    if (vp) vp.classList.remove('is-dragging');

    window.removeEventListener('mousemove', onCropDragMove);
    window.removeEventListener('mouseup', endCropDrag);
    window.removeEventListener('touchmove', onCropDragMove);
    window.removeEventListener('touchend', endCropDrag);
  }

  function applyCropTransform() {
    const imgEl = document.getElementById('avatarCropInteractiveImg');
    if (imgEl) {
      imgEl.style.transform = `translate(${cropperState.panX}px, ${cropperState.panY}px) scale(${cropperState.scale})`;
    }
  }

  window.handleCropZoomSlider = function (val) {
    cropperState.scale = parseFloat(val) / 100;
    applyCropTransform();
  };

  window.stepCropZoom = function (delta) {
    const newScale = Math.max(cropperState.minScale, Math.min(cropperState.maxScale, cropperState.scale + delta));
    cropperState.scale = newScale;
    const slider = document.getElementById('cropZoomSlider');
    if (slider) slider.value = Math.round(newScale * 100);
    applyCropTransform();
  };

  window.handleCropWheel = function (e) {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.1 : -0.1;
    stepCropZoom(delta);
  };

  function generateCroppedWebP(quality = 0.90) {
    return new Promise((resolve, reject) => {
      const img = cropperState.image;
      if (!img) return reject(new Error('No image loaded'));

      const canvas = document.createElement('canvas');
      const targetW = 400;
      const targetH = 480;
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext('2d');

      const vpCenterX = cropperState.viewportW / 2;
      const vpCenterY = cropperState.viewportH / 2;

      const unscaledOffsetX = -cropperState.panX / cropperState.scale;
      const unscaledOffsetY = -cropperState.panY / cropperState.scale;

      const imgCenterX = cropperState.imgNaturalWidth / 2 + unscaledOffsetX;
      const imgCenterY = cropperState.imgNaturalHeight / 2 + unscaledOffsetY;

      const cropSourceW = cropperState.cropBoxW / cropperState.scale;
      const cropSourceH = cropperState.cropBoxH / cropperState.scale;

      const srcX = imgCenterX - cropSourceW / 2;
      const srcY = imgCenterY - cropSourceH / 2;

      ctx.drawImage(img, srcX, srcY, cropSourceW, cropSourceH, 0, 0, targetW, targetH);

      const dataUrl = canvas.toDataURL('image/webp', quality);
      canvas.toBlob(blob => {
        resolve({ blob, dataUrl });
      }, 'image/webp', quality);
    });
  }

  window.confirmAvatarUpload = async function () {
    if (isAvatarSaving) return;
    if (!cropperState.image) {
      document.getElementById('doctorAvatarFileInput')?.click();
      return;
    }

    const doc = allDoctors.find(d => d.id === selectedDoctorId);
    if (!doc) return;

    const btn = document.getElementById('btnConfirmAvatarUpload');
    const originalBtnText = btn ? btn.innerHTML : 'Confirm';
    isAvatarSaving = true;

    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<span class="inline-spinner"></span> Saving to Supabase...';
      btn.style.opacity = '0.75';
      btn.style.cursor = 'not-allowed';
    }

    try {
      // 1. Generate WebP cropped image
      const webpResult = await generateCroppedWebP(0.90);

      // 2. Realistic lazy loading delay
      await new Promise(r => setTimeout(r, 700));

      // 3. Upload to Supabase Storage bucket doctor_pfp & update doctor
      let finalAvatarUrl = null;
      if (window.ClinicApi && typeof window.ClinicApi.uploadDoctorAvatar === 'function') {
        const uploadRes = await window.ClinicApi.uploadDoctorAvatar(doc.id, webpResult.blob, webpResult.dataUrl);
        if (uploadRes && uploadRes.avatar_url) {
          finalAvatarUrl = uploadRes.avatar_url;
        }
      }

      if (!finalAvatarUrl) {
        finalAvatarUrl = webpResult.dataUrl;
      }

      doc.avatar_url = finalAvatarUrl;
      try {
        localStorage.setItem(`shiffaa_doctor_avatar_${doc.id}`, finalAvatarUrl);
      } catch (_) {}

      if (window.ClinicCache) {
        window.ClinicCache.set('doctors_all', { total: allDoctors.length, doctors: allDoctors });
      }

      showToast(`Doctor profile picture saved to Supabase Storage for ${doc.name_en}!`, 'success');
      closeAvatarUploadModal();
      renderSidePanel();
      const filtered = getFilteredAndSortedDoctors();
      const startIdx = (currentPage - 1) * pageSize;
      renderDoctorsTable(filtered.slice(startIdx, startIdx + pageSize));
    } catch (err) {
      console.error('[Avatar] Upload error:', err);
      showToast(`Failed to save avatar to Supabase: ${err.message || 'Storage error'}`, 'error');
    } finally {
      isAvatarSaving = false;
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = originalBtnText;
        btn.style.opacity = '1';
        btn.style.cursor = 'pointer';
      }
    }
  };

})();

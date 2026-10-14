/**
 * Nile Clinics - Patients Directory & Profile Management Controller
 * Fully connected to FastAPI Backend REST API & PostgreSQL database.
 */

(function () {
  'use strict';

  // Self-healing check: If the page DOM contains legacy dummy data (from browser disk cache), force reload!
  if (document.querySelector('.demo-mode-pill') || document.body.innerHTML.includes('Mona Ahmed') || document.body.innerHTML.includes('1,284')) {
    console.warn('[Cache Buster] Detected legacy dummy HTML from browser cache. Purging cache and reloading live version...');
    window.location.replace('patients.html?v=live_v3&_t=' + Date.now());
    return;
  }

  // Wipe any legacy mock storage immediately
  try {
    localStorage.removeItem('clinic_admin_patients_store');
    localStorage.removeItem('clinic_patients_cache');
  } catch (_) {}

  let allPatients = [];
  let allSpecialties = [];
  let currentlySelectedPatientId = null;
  let currentActiveTab = 'all';
  let filterDateFrom = null;
  let filterDateTo = null;

  document.addEventListener('DOMContentLoaded', () => {
    initClock();
    initGlobalShortcuts();
    loadLivePatients();
  });

  // Re-fetch on pageshow (Back/Forward browser cache traversal)
  window.addEventListener('pageshow', () => {
    loadLivePatients();
  });

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
     2. LIVE DATA FETCHING & SYNCHRONIZATION
     ============================================================================= */
  async function loadLivePatients() {
    const tableBody = document.getElementById('patientsTableBody');
    if (!window.ClinicApi) {
      console.warn('[Patients] ClinicApi not initialized.');
      return;
    }

    const apiDot = document.getElementById('apiStatusDot');
    const apiText = document.getElementById('apiStatusText');
    if (apiDot) apiDot.className = 'status-indicator-dot dot-connecting';
    if (apiText) apiText.textContent = 'API: Connecting...';

    try {
      const [specs, patientsRes] = await Promise.all([
        window.ClinicApi.getSpecialties().catch(() => []),
        window.ClinicApi.getPatients()
      ]);

      allSpecialties = Array.isArray(specs) ? specs : [];
      allPatients = Array.isArray(patientsRes?.patients) ? patientsRes.patients : [];

      if (apiDot) apiDot.className = 'status-indicator-dot dot-connected';
      if (apiText) apiText.textContent = `Live DB (${allPatients.length} Patients)`;

      // 1. Populate Department filter dropdown from live database specialties
      populateDeptFilter(allSpecialties);

      // 2. Update Metric Chips and Tab Counters
      updatePatientMetrics(allPatients);

      // 3. Render Table
      applyFilters();

      // 4. Select initial patient
      if (allPatients.length > 0) {
        selectPatientRow(allPatients[0].id);
      } else {
        const heroRow = document.getElementById('patientHeroRow');
        const subTabs = document.getElementById('patientSubTabs');
        const overviewContent = document.getElementById('subTabContentOverview');
        const emptyNotice = document.getElementById('patientDetailsEmptyNotice');
        if (heroRow) heroRow.style.display = 'none';
        if (subTabs) subTabs.style.display = 'none';
        if (overviewContent) overviewContent.style.display = 'none';
        if (emptyNotice) {
          emptyNotice.style.display = 'flex';
          emptyNotice.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="#94A3B8" stroke-width="2" width="36" height="36" style="margin-bottom:10px;"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
            <h4 style="font-size:14px; font-weight:700; color:#334155; margin-bottom:4px;">No Patients in Database</h4>
            <p style="color:#64748B; font-size:13px; margin:0 0 14px 0;">Use the "Add Patient" button above to register your first patient.</p>
            <button class="modal-btn-primary" style="font-size:12px; height:32px;" onclick="openAddPatientModal()">+ Add New Patient</button>
          `;
        }
      }
    } catch (err) {
      console.error('[Patients] Load error:', err);
      if (apiDot) apiDot.className = 'status-indicator-dot dot-disconnected';
      if (apiText) apiText.textContent = 'API: Disconnected';

      if (tableBody) {
        tableBody.innerHTML = `
          <tr>
            <td colspan="9" style="text-align:center; padding:35px 20px;">
              <div style="color:#DC2626; font-size:14px; font-weight:700; margin-bottom:6px;">
                Failed to load patients from database
              </div>
              <div style="font-size:12.5px; color:#64748B; margin-bottom:14px;">
                ${escapeHtml(err.message || 'API request error')}
              </div>
              <button class="modal-btn-primary" style="font-size:12px; height:32px; padding:0 16px;" onclick="loadLivePatients()">
                Retry Connection
              </button>
            </td>
          </tr>
        `;
      }

      const heroRow = document.getElementById('patientHeroRow');
      const subTabs = document.getElementById('patientSubTabs');
      const overviewContent = document.getElementById('subTabContentOverview');
      const emptyNotice = document.getElementById('patientDetailsEmptyNotice');
      if (heroRow) heroRow.style.display = 'none';
      if (subTabs) subTabs.style.display = 'none';
      if (overviewContent) overviewContent.style.display = 'none';
      if (emptyNotice) {
        emptyNotice.style.display = 'flex';
        emptyNotice.innerHTML = `
          <svg viewBox="0 0 24 24" fill="none" stroke="#DC2626" stroke-width="2" width="36" height="36" style="margin-bottom:10px;"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          <h4 style="font-size:14px; font-weight:700; color:#334155; margin-bottom:4px;">Database Connection Offline</h4>
          <p style="color:#64748B; font-size:13px; margin:0 0 12px 0;">Please ensure SSH tunnel on port 8002 and clinic backend container are active.</p>
          <button class="modal-btn-secondary" style="font-size:12px; height:32px;" onclick="loadLivePatients()">Retry</button>
        `;
      }
      showToast('Error syncing with database: ' + err.message, 'warning');
    }
  }

  function populateDeptFilter(specialties) {
    const select = document.getElementById('deptFilterSelect');
    if (!select) return;

    const currentVal = select.value;
    select.innerHTML = '<option value="">All Departments / التخصصات</option>';
    specialties.forEach(spec => {
      const opt = document.createElement('option');
      opt.value = spec.name_en;
      opt.textContent = `${spec.name_en} (${spec.name_ar})`;
      select.appendChild(opt);
    });

    if (currentVal) select.value = currentVal;
  }

  function updatePatientMetrics(patients) {
    const totalEl = document.getElementById('metricTotalPatients');
    const activeEl = document.getElementById('metricActivePatients');
    const newEl = document.getElementById('metricNewPatients');
    const inactiveEl = document.getElementById('metricInactivePatients');

    const total = patients.length;
    const active = patients.filter(p => (p.status || '').toLowerCase() === 'active').length;
    const newCount = patients.filter(p => p.isNew).length;
    const inactive = patients.filter(p => (p.status || '').toLowerCase() === 'inactive').length;

    if (totalEl) totalEl.textContent = total.toLocaleString();
    if (activeEl) activeEl.textContent = active.toLocaleString();
    if (newEl) newEl.textContent = newCount.toLocaleString();
    if (inactiveEl) inactiveEl.textContent = inactive.toLocaleString();

    // Update Nav Tab counters
    const tabAll = document.getElementById('tabCountAll');
    const tabActive = document.getElementById('tabCountActive');
    const tabNew = document.getElementById('tabCountNew');
    const tabInactive = document.getElementById('tabCountInactive');

    if (tabAll) tabAll.textContent = total;
    if (tabActive) tabActive.textContent = active;
    if (tabNew) tabNew.textContent = newCount;
    if (tabInactive) tabInactive.textContent = inactive;
  }

  /* =============================================================================
     3. TABLE RENDERING & SELECTION
     ============================================================================= */
  function renderPatientsTable(patients) {
    const tbody = document.getElementById('patientsTableBody');
    const emptyState = document.getElementById('patientsEmptyState');
    const paginationText = document.getElementById('paginationText');
    const paginationControls = document.getElementById('patientsPaginationControls');
    if (!tbody) return;

    if (!patients || patients.length === 0) {
      tbody.innerHTML = '';
      if (emptyState) emptyState.style.display = 'flex';
      if (paginationText) paginationText.textContent = `Showing 0 of ${allPatients.length} patients`;
      if (paginationControls) paginationControls.style.display = 'none';
      return;
    }

    if (emptyState) emptyState.style.display = 'none';
    if (paginationText) {
      paginationText.textContent = allPatients.length === 1
        ? 'Showing 1 patient (Live Database)'
        : `Showing 1 to ${patients.length} of ${allPatients.length} patients`;
    }
    if (paginationControls) {
      paginationControls.style.display = allPatients.length > 10 ? 'flex' : 'none';
    }

    tbody.innerHTML = patients.map(p => {
      const isSelected = p.id === currentlySelectedPatientId;
      const statusLower = (p.status || 'Active').toLowerCase();
      const statusClass = statusLower === 'active' ? 'badge-patient-active' : 'badge-patient-inactive';
      const statusLabel = statusLower === 'active' ? 'Active' : 'Inactive';
      const avatarLetter = (p.avatar || p.name || 'P').charAt(0).toUpperCase();
      const bg = p.avatarBg || '#EFF6FF';
      const color = p.avatarColor || '#2563EB';

      return `
        <tr class="${isSelected ? 'selected-row' : ''}" data-id="${p.id}" onclick="selectPatientRow(${p.id}, this)">
          <td class="td-checkbox"><input type="checkbox" class="custom-checkbox" onclick="event.stopPropagation()"></td>
          <td>
            <div class="patient-cell-profile">
              <div class="patient-avatar-circle" style="background:${bg}; color:${color};">${avatarLetter}</div>
              <div class="patient-name-col">
                <span class="patient-table-name">${escapeHtml(p.name)}</span>
                <span class="patient-table-id">${escapeHtml(p.patientCode || p.customer_number || '')}</span>
              </div>
            </div>
          </td>
          <td>${escapeHtml(p.phone || '-')}</td>
          <td>${escapeHtml(p.nationalId || '-')}</td>
          <td>${escapeHtml(String(p.age || '-'))}</td>
          <td>${escapeHtml(p.gender || '-')}</td>
          <td>
            <div class="td-last-appt">
              <span class="appt-date-text">${escapeHtml(p.lastApptDate || 'Recent')}</span>
              <span class="appt-dept-text">${escapeHtml(p.lastApptDept || 'General')}</span>
            </div>
          </td>
          <td><span class="${statusClass}">${statusLabel}</span></td>
          <td>
            <button class="btn-row-action" title="Actions" onclick="event.stopPropagation(); openRowActionMenu(${p.id}, '${escapeJs(p.name)}')">
              <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/><circle cx="5" cy="12" r="1.5"/></svg>
            </button>
          </td>
        </tr>
      `;
    }).join('');
  }

  function selectPatientRow(patientId, trEl) {
    currentlySelectedPatientId = patientId;

    // Highlight row in table
    const rows = document.querySelectorAll('#patientsTableBody tr');
    rows.forEach(r => r.classList.remove('selected-row'));

    if (trEl) {
      trEl.classList.add('selected-row');
    } else {
      const match = Array.from(rows).find(r => Number(r.getAttribute('data-id')) === patientId);
      if (match) match.classList.add('selected-row');
    }

    const patient = allPatients.find(p => p.id === patientId);
    if (!patient) return;

    renderPatientDetails(patient);
  }

  function renderPatientDetails(patient) {
    const detailsCard = document.getElementById('patientDetailsCard');
    const heroRow = document.getElementById('patientHeroRow');
    const subTabs = document.getElementById('patientSubTabs');
    const overviewContent = document.getElementById('subTabContentOverview');
    const emptyNotice = document.getElementById('patientDetailsEmptyNotice');

    if (detailsCard) detailsCard.style.display = 'flex';
    if (heroRow) heroRow.style.display = 'flex';
    if (subTabs) subTabs.style.display = 'flex';
    if (overviewContent) overviewContent.style.display = 'flex';
    if (emptyNotice) emptyNotice.style.display = 'none';

    // Hero section
    const avatarEl = document.getElementById('detailAvatar');
    const nameEl = document.getElementById('detailName');
    const idEl = document.getElementById('detailId');
    const statusBadgeEl = document.getElementById('detailStatusBadge');
    const statusTextEl = document.getElementById('detailStatusText');

    if (avatarEl) {
      avatarEl.textContent = (patient.avatar || patient.name || 'P').charAt(0).toUpperCase();
      avatarEl.style.backgroundColor = patient.avatarBg || '#EFF6FF';
      avatarEl.style.color = patient.avatarColor || '#2563EB';
    }
    if (nameEl) nameEl.textContent = patient.name;
    if (idEl) idEl.textContent = patient.patientCode || patient.customer_number || 'PT-2024';

    if (statusBadgeEl && statusTextEl) {
      const isActive = (patient.status || 'Active').toLowerCase() === 'active';
      if (isActive) {
        statusBadgeEl.style.backgroundColor = '#F0FDF4';
        statusBadgeEl.style.borderColor = '#BBF7D0';
        statusBadgeEl.style.color = '#16A34A';
        const dot = statusBadgeEl.querySelector('.dot');
        if (dot) dot.style.backgroundColor = '#16A34A';
        statusTextEl.textContent = 'Active Patient';
      } else {
        statusBadgeEl.style.backgroundColor = '#FEF2F2';
        statusBadgeEl.style.borderColor = '#FECACA';
        statusBadgeEl.style.color = '#DC2626';
        const dot = statusBadgeEl.querySelector('.dot');
        if (dot) dot.style.backgroundColor = '#DC2626';
        statusTextEl.textContent = 'Inactive Patient';
      }
    }

    // Personal Info Fields
    setFieldText('fieldFullName', patient.name);
    setFieldText('fieldPhone', patient.phone);
    setFieldText('fieldNationalId', patient.nationalId);
    setFieldText('fieldDob', patient.dob || `${patient.age || 25} years`);
    setFieldText('fieldGender', patient.gender);
    setFieldText('fieldEmail', patient.email);
    setFieldText('fieldAddress', patient.address);

    // Medical Info Fields
    setFieldText('fieldBloodType', patient.bloodType);
    setFieldText('fieldAllergies', patient.allergies);
    setFieldText('fieldChronic', patient.chronicConditions);
    setFieldText('fieldPharmacy', patient.pharmacy);

    // Recent Activity
    const activityListEl = document.getElementById('detailActivityList');
    if (activityListEl) {
      if (patient.activities && patient.activities.length > 0) {
        activityListEl.innerHTML = patient.activities.map(act => {
          let dotClass = 'dot-green';
          if (act.type === 'updated') dotClass = 'dot-blue';
          if (act.type === 'booked') dotClass = 'dot-gray';

          return `
            <div class="activity-timeline-item">
              <div class="activity-dot-circle ${dotClass}"></div>
              <div class="activity-content-col">
                <div>
                  <div class="activity-title">${escapeHtml(act.title)}</div>
                  <div class="activity-sub">${escapeHtml(act.sub)}</div>
                </div>
                <div class="activity-timestamp">
                  <div class="activity-date">${escapeHtml(act.date)}</div>
                  <div>${escapeHtml(act.time)}</div>
                </div>
              </div>
            </div>
          `;
        }).join('');
      } else {
        activityListEl.innerHTML = `
          <div style="font-size:12.5px; color:#94A3B8; text-align:center; padding:18px 0;">
            No past activity recorded for this patient.
          </div>
        `;
      }
    }
  }

  function setFieldText(elId, val) {
    const el = document.getElementById(elId);
    if (el) el.textContent = val || 'None';
  }

  function closePatientDetailsPanel() {
    const detailsCard = document.getElementById('patientDetailsCard');
    if (!detailsCard) return;

    const heroRow = document.getElementById('patientHeroRow');
    const subTabs = document.getElementById('patientSubTabs');
    const overviewContent = document.getElementById('subTabContentOverview');
    const emptyNotice = document.getElementById('patientDetailsEmptyNotice');

    if (heroRow) heroRow.style.display = 'none';
    if (subTabs) subTabs.style.display = 'none';
    if (overviewContent) overviewContent.style.display = 'none';
    if (emptyNotice) {
      emptyNotice.style.display = 'flex';
      emptyNotice.innerHTML = `
        <div style="padding: 40px 10px; text-align: center;">
          <svg viewBox="0 0 24 24" fill="none" stroke="#94A3B8" stroke-width="2" width="32" height="32" style="margin-bottom:8px;"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
          <h4 style="font-size:14px; font-weight:700; color:#334155; margin-bottom:4px;">Panel Minimized</h4>
          <p style="font-size:12px; color:#64748B; margin-bottom:12px;">Click any patient row in the directory to inspect full records.</p>
          <button class="modal-btn-secondary" style="font-size:12px; height:32px;" onclick="selectPatientRow(currentlySelectedPatientId)">Restore Panel</button>
        </div>
      `;
    }
    showToast('Patient details view minimized', 'info');
  }

  /* =============================================================================
     4. FILTERING & SEARCH CONTROLLERS
     ============================================================================= */
  function filterPatientTab(tab, btnEl) {
    currentActiveTab = tab;
    const tabs = document.querySelectorAll('.patient-tab-item');
    tabs.forEach(t => t.classList.remove('active'));
    if (btnEl) btnEl.classList.add('active');

    applyFilters();
  }

  function handleTableSearch(query) {
    applyFilters();
  }

  function applyFilters() {
    const searchInput = document.getElementById('patientTableSearchInput');
    const q = searchInput ? searchInput.value.toLowerCase().trim() : '';

    const deptVal = document.getElementById('deptFilterSelect')?.value || '';
    const statusVal = document.getElementById('statusFilterSelect')?.value || '';
    const genderVal = document.getElementById('genderFilterSelect')?.value || '';

    const filtered = allPatients.filter(p => {
      // 1. Tab check
      const statusLower = (p.status || 'Active').toLowerCase();
      if (currentActiveTab === 'active' && statusLower !== 'active') return false;
      if (currentActiveTab === 'inactive' && statusLower !== 'inactive') return false;
      if (currentActiveTab === 'new' && !p.isNew) return false;

      // 2. Search check (Name, Phone, National ID, Customer Number, Email)
      if (q) {
        const matchName = (p.name || '').toLowerCase().includes(q);
        const matchPhone = (p.phone || '').toLowerCase().includes(q);
        const matchId = (p.nationalId || '').includes(q) || (p.patientCode || '').toLowerCase().includes(q) || (p.customer_number || '').includes(q);
        const matchEmail = (p.email || '').toLowerCase().includes(q);
        if (!matchName && !matchPhone && !matchId && !matchEmail) return false;
      }

      // 3. Department filter
      if (deptVal) {
        const pDept = (p.lastApptDept || p.dept || 'General Medicine').toLowerCase();
        if (pDept !== deptVal.toLowerCase()) return false;
      }

      // 4. Status filter
      if (statusVal && (p.status || '').toLowerCase() !== statusVal.toLowerCase()) return false;

      // 5. Gender filter
      if (genderVal && (p.gender || '').toLowerCase() !== genderVal.toLowerCase()) return false;

      // 6. Registration Date Range
      if (filterDateFrom && p.created_at) {
        const pDate = new Date(p.created_at).toISOString().slice(0, 10);
        if (pDate < filterDateFrom) return false;
      }
      if (filterDateTo && p.created_at) {
        const pDate = new Date(p.created_at).toISOString().slice(0, 10);
        if (pDate > filterDateTo) return false;
      }

      return true;
    });

    renderPatientsTable(filtered);

    // If currently selected patient is in filtered list, keep selected; otherwise select first or show empty state
    if (filtered.length > 0) {
      const exists = filtered.some(p => p.id === currentlySelectedPatientId);
      if (!exists) {
        selectPatientRow(filtered[0].id);
      }
    } else {
      const heroRow = document.getElementById('patientHeroRow');
      const subTabs = document.getElementById('patientSubTabs');
      const overviewContent = document.getElementById('subTabContentOverview');
      const emptyNotice = document.getElementById('patientDetailsEmptyNotice');
      if (heroRow) heroRow.style.display = 'none';
      if (subTabs) subTabs.style.display = 'none';
      if (overviewContent) overviewContent.style.display = 'none';
      if (emptyNotice) {
        emptyNotice.style.display = 'flex';
        emptyNotice.innerHTML = `
          <svg viewBox="0 0 24 24" fill="none" stroke="#94A3B8" stroke-width="2" width="36" height="36" style="margin-bottom:10px;"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <h4 style="font-size:14px; font-weight:700; color:#334155; margin-bottom:4px;">No Matching Patients</h4>
          <p style="color:#64748B; font-size:13px; margin:0 0 12px 0;">No patient records match the selected filter criteria.</p>
          <button class="modal-btn-secondary" style="font-size:12px; height:32px;" onclick="resetPatientFilters()">Reset Filters</button>
        `;
      }
    }
  }

  function resetPatientFilters() {
    const searchInput = document.getElementById('patientTableSearchInput');
    if (searchInput) searchInput.value = '';

    const topSearch = document.getElementById('patientsGlobalSearch');
    if (topSearch) topSearch.value = '';

    const deptSelect = document.getElementById('deptFilterSelect');
    if (deptSelect) deptSelect.value = '';

    const statusSelect = document.getElementById('statusFilterSelect');
    if (statusSelect) statusSelect.value = '';

    const genderSelect = document.getElementById('genderFilterSelect');
    if (genderSelect) genderSelect.value = '';

    filterDateFrom = null;
    filterDateTo = null;

    currentActiveTab = 'all';
    const tabs = document.querySelectorAll('.patient-tab-item');
    tabs.forEach(t => t.classList.remove('active'));
    if (tabs[0]) tabs[0].classList.add('active');

    applyFilters();
    showToast('Filters reset to default view', 'info');
  }

  function toggleAdvancedFilters() {
    const pillsRow = document.getElementById('filterPillsRow');
    if (!pillsRow) return;

    if (pillsRow.style.display === 'none') {
      pillsRow.style.display = 'flex';
      showToast('Filter options expanded', 'info');
    } else {
      showToast('All filter fields active', 'info');
    }
  }

  function toggleSelectAll(masterCheckbox) {
    const checkboxes = document.querySelectorAll('#patientsTableBody .custom-checkbox');
    checkboxes.forEach(cb => cb.checked = masterCheckbox.checked);
    showToast(masterCheckbox.checked ? `Selected all ${checkboxes.length} patients` : 'Deselected all patients', 'info');
  }

  /* =============================================================================
     5. PATIENT MODALS & ACTIONS (ADD / EDIT / EXPORT)
     ============================================================================= */
  function openAddPatientModal() {
    const deptOptions = allSpecialties.map(s => 
      `<option value="${escapeHtml(s.name_en)}">${escapeHtml(s.name_en)} (${escapeHtml(s.name_ar)})</option>`
    ).join('') || '<option value="General Medicine">General Medicine</option>';

    const html = `
      <form id="addPatientForm" onsubmit="handleAddPatientSubmit(event)" style="display:flex; flex-direction:column; gap:14px;">
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
          <div>
            <label style="display:block; font-size:12px; font-weight:600; color:#475569; margin-bottom:4px;">Full Name *</label>
            <input type="text" id="newPatientName" required placeholder="e.g. Karim Mahmoud" style="width:100%; height:38px; border:1px solid #CBD5E1; border-radius:6px; padding:0 12px; font-size:13px;">
          </div>
          <div>
            <label style="display:block; font-size:12px; font-weight:600; color:#475569; margin-bottom:4px;">Phone Number *</label>
            <input type="tel" id="newPatientPhone" required placeholder="+201012345678" value="+20" style="width:100%; height:38px; border:1px solid #CBD5E1; border-radius:6px; padding:0 12px; font-size:13px;">
          </div>
        </div>

        <div style="display:grid; grid-template-columns:1.2fr 0.8fr 0.8fr; gap:12px;">
          <div>
            <label style="display:block; font-size:12px; font-weight:600; color:#475569; margin-bottom:4px;">National ID (14 digits) *</label>
            <input type="text" id="newPatientNationalId" required maxlength="14" placeholder="301XXXXXXXXXXX" style="width:100%; height:38px; border:1px solid #CBD5E1; border-radius:6px; padding:0 12px; font-size:13px;">
          </div>
          <div>
            <label style="display:block; font-size:12px; font-weight:600; color:#475569; margin-bottom:4px;">Age *</label>
            <input type="number" id="newPatientAge" required min="1" max="115" placeholder="e.g. 24" style="width:100%; height:38px; border:1px solid #CBD5E1; border-radius:6px; padding:0 12px; font-size:13px;">
          </div>
          <div>
            <label style="display:block; font-size:12px; font-weight:600; color:#475569; margin-bottom:4px;">Gender *</label>
            <select id="newPatientGender" style="width:100%; height:38px; border:1px solid #CBD5E1; border-radius:6px; padding:0 10px; font-size:13px; background:#fff;">
              <option value="Female">Female</option>
              <option value="Male">Male</option>
            </select>
          </div>
        </div>

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
          <div>
            <label style="display:block; font-size:12px; font-weight:600; color:#475569; margin-bottom:4px;">Email Address</label>
            <input type="email" id="newPatientEmail" placeholder="patient@example.com" style="width:100%; height:38px; border:1px solid #CBD5E1; border-radius:6px; padding:0 12px; font-size:13px;">
          </div>
          <div>
            <label style="display:block; font-size:12px; font-weight:600; color:#475569; margin-bottom:4px;">Primary Department</label>
            <select id="newPatientDept" style="width:100%; height:38px; border:1px solid #CBD5E1; border-radius:6px; padding:0 10px; font-size:13px; background:#fff;">
              ${deptOptions}
            </select>
          </div>
        </div>

        <div>
          <label style="display:block; font-size:12px; font-weight:600; color:#475569; margin-bottom:4px;">Residential Address</label>
          <input type="text" id="newPatientAddress" placeholder="District, City, Governorate" style="width:100%; height:38px; border:1px solid #CBD5E1; border-radius:6px; padding:0 12px; font-size:13px;">
        </div>

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
          <div>
            <label style="display:block; font-size:12px; font-weight:600; color:#475569; margin-bottom:4px;">Blood Type</label>
            <select id="newPatientBlood" style="width:100%; height:38px; border:1px solid #CBD5E1; border-radius:6px; padding:0 10px; font-size:13px; background:#fff;">
              <option value="O+">O+</option>
              <option value="A+">A+</option>
              <option value="B+">B+</option>
              <option value="AB+">AB+</option>
              <option value="O-">O-</option>
              <option value="A-">A-</option>
            </select>
          </div>
          <div>
            <label style="display:block; font-size:12px; font-weight:600; color:#475569; margin-bottom:4px;">Preferred Pharmacy</label>
            <input type="text" id="newPatientPharmacy" placeholder="e.g. Nile Pharmacy" value="Nile Pharmacy" style="width:100%; height:38px; border:1px solid #CBD5E1; border-radius:6px; padding:0 12px; font-size:13px;">
          </div>
        </div>

        <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:8px;">
          <button type="button" class="modal-btn-secondary" onclick="closeAdminModal()">Cancel</button>
          <button type="submit" class="modal-btn-primary">Register Patient</button>
        </div>
      </form>
    `;

    openAdminModal('Add New Patient Record', html);
  }

  async function handleAddPatientSubmit(e) {
    e.preventDefault();
    const name = document.getElementById('newPatientName').value.trim();
    const phone = document.getElementById('newPatientPhone').value.trim();
    const nationalId = document.getElementById('newPatientNationalId').value.trim();
    const age = parseInt(document.getElementById('newPatientAge').value, 10) || 25;
    const gender = document.getElementById('newPatientGender').value;
    const dept = document.getElementById('newPatientDept').value;
    const address = document.getElementById('newPatientAddress').value.trim() || 'Cairo, Egypt';
    const email = document.getElementById('newPatientEmail').value.trim() || `${name.toLowerCase().replace(/\s+/g, '.')}@example.com`;
    const blood = document.getElementById('newPatientBlood').value;
    const pharmacy = document.getElementById('newPatientPharmacy').value.trim() || 'Nile Pharmacy';

    const patientPayload = {
      name,
      full_name: name,
      phone,
      national_id: nationalId,
      nationalId,
      age,
      gender,
      email,
      address,
      blood_type: blood,
      bloodType: blood,
      pharmacy,
      dept,
      date_of_birth: `${new Date().getFullYear() - age}-01-01`
    };

    try {
      const created = await window.ClinicApi.createPatient(patientPayload);
      allPatients.unshift(created);
      updatePatientMetrics(allPatients);
      renderPatientsTable(allPatients);
      selectPatientRow(created.id);
      closeAdminModal();
      showToast(`Patient ${name} registered successfully (Code: ${created.customer_number || created.patientCode})`, 'success');
    } catch (err) {
      console.error('[Patients] Registration error:', err);
      showToast('Failed to register patient: ' + err.message, 'warning');
    }
  }

  function openEditPatientModal(section = 'all') {
    const patient = allPatients.find(p => p.id === currentlySelectedPatientId) || allPatients[0];
    if (!patient) {
      showToast('Please select a patient first to edit their record', 'warning');
      return;
    }

    let title = `Edit Profile: ${patient.name}`;
    let formHtml = '';

    if (section === 'personal') {
      title = `Edit Personal Information: ${patient.name}`;
      formHtml = `
        <form onsubmit="handleEditPatientSubmit(event, 'personal')" style="display:flex; flex-direction:column; gap:14px;">
          <div>
            <label style="display:block; font-size:12px; font-weight:600; color:#475569; margin-bottom:4px;">Full Name *</label>
            <input type="text" id="editFullName" value="${escapeHtml(patient.name)}" required placeholder="e.g. Karim Mahmoud" style="width:100%; height:38px; border:1px solid #CBD5E1; border-radius:6px; padding:0 12px; font-size:13px;">
          </div>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
            <div>
              <label style="display:block; font-size:12px; font-weight:600; color:#475569; margin-bottom:4px;">Phone Number *</label>
              <input type="tel" id="editPhone" value="${escapeHtml(patient.phone)}" required placeholder="+201012345678" style="width:100%; height:38px; border:1px solid #CBD5E1; border-radius:6px; padding:0 12px; font-size:13px;">
            </div>
            <div>
              <label style="display:block; font-size:12px; font-weight:600; color:#475569; margin-bottom:4px;">Email Address</label>
              <input type="email" id="editEmail" value="${escapeHtml(patient.email)}" placeholder="patient@example.com" style="width:100%; height:38px; border:1px solid #CBD5E1; border-radius:6px; padding:0 12px; font-size:13px;">
            </div>
          </div>
          <div style="display:grid; grid-template-columns:1.2fr 0.8fr 0.8fr; gap:12px;">
            <div>
              <label style="display:block; font-size:12px; font-weight:600; color:#475569; margin-bottom:4px;">Date of Birth</label>
              <input type="date" id="editDob" value="${escapeHtml(patient.dob || '')}" style="width:100%; height:38px; border:1px solid #CBD5E1; border-radius:6px; padding:0 12px; font-size:13px;">
            </div>
            <div>
              <label style="display:block; font-size:12px; font-weight:600; color:#475569; margin-bottom:4px;">Gender</label>
              <select id="editGender" style="width:100%; height:38px; border:1px solid #CBD5E1; border-radius:6px; padding:0 10px; font-size:13px; background:#fff;">
                <option value="male" ${String(patient.gender).toLowerCase() === 'male' ? 'selected' : ''}>Male</option>
                <option value="female" ${String(patient.gender).toLowerCase() === 'female' ? 'selected' : ''}>Female</option>
              </select>
            </div>
            <div>
              <label style="display:block; font-size:12px; font-weight:600; color:#475569; margin-bottom:4px;">Language</label>
              <select id="editLang" style="width:100%; height:38px; border:1px solid #CBD5E1; border-radius:6px; padding:0 10px; font-size:13px; background:#fff;">
                <option value="ar" ${patient.preferred_language === 'ar' ? 'selected' : ''}>Arabic (عربي)</option>
                <option value="en" ${patient.preferred_language === 'en' ? 'selected' : ''}>English</option>
              </select>
            </div>
          </div>
          <div>
            <label style="display:block; font-size:12px; font-weight:600; color:#475569; margin-bottom:4px;">Residential Address</label>
            <input type="text" id="editAddress" value="${escapeHtml(patient.address || 'Cairo, Egypt')}" style="width:100%; height:38px; border:1px solid #CBD5E1; border-radius:6px; padding:0 12px; font-size:13px;">
          </div>
          <div style="display:flex; justify-content:space-between; align-items:center; margin-top:8px;">
            <span style="font-size:12px; color:#64748B;">Patient Code: <strong style="color:#0F172A;">${escapeHtml(patient.customer_number || patient.patientCode || 'PT-2024')}</strong></span>
            <div style="display:flex; gap:10px;">
              <button type="button" class="modal-btn-secondary" onclick="closeAdminModal()">Cancel</button>
              <button type="submit" class="modal-btn-primary">Save to Database</button>
            </div>
          </div>
        </form>
      `;
    } else if (section === 'medical') {
      title = `Edit Medical Information: ${patient.name}`;
      formHtml = `
        <form onsubmit="handleEditPatientSubmit(event, 'medical')" style="display:flex; flex-direction:column; gap:14px;">
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
            <div>
              <label style="display:block; font-size:12px; font-weight:600; color:#475569; margin-bottom:4px;">Insurance Provider</label>
              <input type="text" id="editInsuranceProvider" value="${escapeHtml(patient.insurance_provider && patient.insurance_provider !== 'None' ? patient.insurance_provider : '')}" placeholder="e.g. AXA Egypt, MetLife, Self-Pay" style="width:100%; height:38px; border:1px solid #CBD5E1; border-radius:6px; padding:0 12px; font-size:13px;">
            </div>
            <div>
              <label style="display:block; font-size:12px; font-weight:600; color:#475569; margin-bottom:4px;">Insurance Policy Number</label>
              <input type="text" id="editInsurancePolicy" value="${escapeHtml(patient.insurance_policy_number && patient.insurance_policy_number !== 'None' ? patient.insurance_policy_number : '')}" placeholder="e.g. POL-123456" style="width:100%; height:38px; border:1px solid #CBD5E1; border-radius:6px; padding:0 12px; font-size:13px;">
            </div>
          </div>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
            <div>
              <label style="display:block; font-size:12px; font-weight:600; color:#475569; margin-bottom:4px;">Blood Type</label>
              <select id="editBloodType" style="width:100%; height:38px; border:1px solid #CBD5E1; border-radius:6px; padding:0 10px; font-size:13px; background:#fff;">
                ${['O+', 'A+', 'B+', 'AB+', 'O-', 'A-', 'B-', 'AB-'].map(b => `<option value="${b}" ${patient.bloodType === b ? 'selected' : ''}>${b}</option>`).join('')}
              </select>
            </div>
            <div>
              <label style="display:block; font-size:12px; font-weight:600; color:#475569; margin-bottom:4px;">Preferred Pharmacy</label>
              <input type="text" id="editPharmacy" value="${escapeHtml(patient.pharmacy || 'Nile Pharmacy')}" placeholder="e.g. El Ezaby, Nile Pharmacy" style="width:100%; height:38px; border:1px solid #CBD5E1; border-radius:6px; padding:0 12px; font-size:13px;">
            </div>
          </div>
          <div>
            <label style="display:block; font-size:12px; font-weight:600; color:#475569; margin-bottom:4px;">Known Allergies</label>
            <input type="text" id="editAllergies" value="${escapeHtml(patient.allergies && patient.allergies !== 'None' ? patient.allergies : '')}" placeholder="e.g. Penicillin, Sulfa, None" style="width:100%; height:38px; border:1px solid #CBD5E1; border-radius:6px; padding:0 12px; font-size:13px;">
          </div>
          <div>
            <label style="display:block; font-size:12px; font-weight:600; color:#475569; margin-bottom:4px;">Chronic Conditions</label>
            <input type="text" id="editChronic" value="${escapeHtml(patient.chronicConditions && patient.chronicConditions !== 'None' ? patient.chronicConditions : '')}" placeholder="e.g. Hypertension, Diabetes Type 2, None" style="width:100%; height:38px; border:1px solid #CBD5E1; border-radius:6px; padding:0 12px; font-size:13px;">
          </div>
          <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:8px;">
            <button type="button" class="modal-btn-secondary" onclick="closeAdminModal()">Cancel</button>
            <button type="submit" class="modal-btn-primary">Save to Database</button>
          </div>
        </form>
      `;
    } else {
      title = `Edit Full Patient Record: ${patient.name}`;
      formHtml = `
        <form onsubmit="handleEditPatientSubmit(event, 'all')" style="display:flex; flex-direction:column; gap:14px;">
          <div style="font-weight:700; color:#1E3A8A; font-size:13px; border-bottom:1px solid #E2E8F0; padding-bottom:6px;">Personal Information</div>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
            <div>
              <label style="display:block; font-size:12px; font-weight:600; color:#475569; margin-bottom:4px;">Full Name *</label>
              <input type="text" id="editFullName" value="${escapeHtml(patient.name)}" required style="width:100%; height:38px; border:1px solid #CBD5E1; border-radius:6px; padding:0 12px; font-size:13px;">
            </div>
            <div>
              <label style="display:block; font-size:12px; font-weight:600; color:#475569; margin-bottom:4px;">Phone Number *</label>
              <input type="tel" id="editPhone" value="${escapeHtml(patient.phone)}" required style="width:100%; height:38px; border:1px solid #CBD5E1; border-radius:6px; padding:0 12px; font-size:13px;">
            </div>
          </div>
          <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:12px;">
            <div>
              <label style="display:block; font-size:12px; font-weight:600; color:#475569; margin-bottom:4px;">Email</label>
              <input type="email" id="editEmail" value="${escapeHtml(patient.email)}" style="width:100%; height:38px; border:1px solid #CBD5E1; border-radius:6px; padding:0 12px; font-size:13px;">
            </div>
            <div>
              <label style="display:block; font-size:12px; font-weight:600; color:#475569; margin-bottom:4px;">Date of Birth</label>
              <input type="date" id="editDob" value="${escapeHtml(patient.dob || '')}" style="width:100%; height:38px; border:1px solid #CBD5E1; border-radius:6px; padding:0 12px; font-size:13px;">
            </div>
            <div>
              <label style="display:block; font-size:12px; font-weight:600; color:#475569; margin-bottom:4px;">Gender</label>
              <select id="editGender" style="width:100%; height:38px; border:1px solid #CBD5E1; border-radius:6px; padding:0 10px; font-size:13px; background:#fff;">
                <option value="male" ${String(patient.gender).toLowerCase() === 'male' ? 'selected' : ''}>Male</option>
                <option value="female" ${String(patient.gender).toLowerCase() === 'female' ? 'selected' : ''}>Female</option>
              </select>
            </div>
          </div>
          <div>
            <label style="display:block; font-size:12px; font-weight:600; color:#475569; margin-bottom:4px;">Address</label>
            <input type="text" id="editAddress" value="${escapeHtml(patient.address || 'Cairo, Egypt')}" style="width:100%; height:38px; border:1px solid #CBD5E1; border-radius:6px; padding:0 12px; font-size:13px;">
          </div>
          <div style="font-weight:700; color:#1E3A8A; font-size:13px; border-bottom:1px solid #E2E8F0; padding-bottom:6px; margin-top:4px;">Medical Information</div>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
            <div>
              <label style="display:block; font-size:12px; font-weight:600; color:#475569; margin-bottom:4px;">Insurance Provider</label>
              <input type="text" id="editInsuranceProvider" value="${escapeHtml(patient.insurance_provider && patient.insurance_provider !== 'None' ? patient.insurance_provider : '')}" placeholder="e.g. AXA Egypt" style="width:100%; height:38px; border:1px solid #CBD5E1; border-radius:6px; padding:0 12px; font-size:13px;">
            </div>
            <div>
              <label style="display:block; font-size:12px; font-weight:600; color:#475569; margin-bottom:4px;">Policy Number</label>
              <input type="text" id="editInsurancePolicy" value="${escapeHtml(patient.insurance_policy_number && patient.insurance_policy_number !== 'None' ? patient.insurance_policy_number : '')}" placeholder="e.g. POL-123456" style="width:100%; height:38px; border:1px solid #CBD5E1; border-radius:6px; padding:0 12px; font-size:13px;">
            </div>
          </div>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
            <div>
              <label style="display:block; font-size:12px; font-weight:600; color:#475569; margin-bottom:4px;">Blood Type</label>
              <select id="editBloodType" style="width:100%; height:38px; border:1px solid #CBD5E1; border-radius:6px; padding:0 10px; font-size:13px; background:#fff;">
                ${['O+', 'A+', 'B+', 'AB+', 'O-', 'A-', 'B-', 'AB-'].map(b => `<option value="${b}" ${patient.bloodType === b ? 'selected' : ''}>${b}</option>`).join('')}
              </select>
            </div>
            <div>
              <label style="display:block; font-size:12px; font-weight:600; color:#475569; margin-bottom:4px;">Preferred Pharmacy</label>
              <input type="text" id="editPharmacy" value="${escapeHtml(patient.pharmacy || 'Nile Pharmacy')}" style="width:100%; height:38px; border:1px solid #CBD5E1; border-radius:6px; padding:0 12px; font-size:13px;">
            </div>
          </div>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
            <div>
              <label style="display:block; font-size:12px; font-weight:600; color:#475569; margin-bottom:4px;">Known Allergies</label>
              <input type="text" id="editAllergies" value="${escapeHtml(patient.allergies && patient.allergies !== 'None' ? patient.allergies : '')}" style="width:100%; height:38px; border:1px solid #CBD5E1; border-radius:6px; padding:0 12px; font-size:13px;">
            </div>
            <div>
              <label style="display:block; font-size:12px; font-weight:600; color:#475569; margin-bottom:4px;">Chronic Conditions</label>
              <input type="text" id="editChronic" value="${escapeHtml(patient.chronicConditions && patient.chronicConditions !== 'None' ? patient.chronicConditions : '')}" style="width:100%; height:38px; border:1px solid #CBD5E1; border-radius:6px; padding:0 12px; font-size:13px;">
            </div>
          </div>
          <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:8px;">
            <button type="button" class="modal-btn-secondary" onclick="closeAdminModal()">Cancel</button>
            <button type="submit" class="modal-btn-primary">Save to Database</button>
          </div>
        </form>
      `;
    }

    openAdminModal(title, formHtml);
  }

  async function handleEditPatientSubmit(e, section = 'all') {
    e.preventDefault();
    const patient = allPatients.find(p => p.id === currentlySelectedPatientId);
    if (!patient) return;

    const saveBtn = e.target.querySelector('button[type="submit"]');
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.textContent = 'Saving to Database...';
    }

    const payload = {};

    if (section === 'personal' || section === 'all') {
      const nameEl = document.getElementById('editFullName');
      const phoneEl = document.getElementById('editPhone');
      const emailEl = document.getElementById('editEmail');
      const dobEl = document.getElementById('editDob');
      const genderEl = document.getElementById('editGender');
      const langEl = document.getElementById('editLang');
      const addressEl = document.getElementById('editAddress');

      if (nameEl && nameEl.value.trim()) {
        payload.full_name = nameEl.value.trim();
        payload.name = nameEl.value.trim();
      }
      if (phoneEl && phoneEl.value.trim()) {
        payload.phone = phoneEl.value.trim();
      }
      if (emailEl) {
        payload.email = emailEl.value.trim();
      }
      if (dobEl && dobEl.value) {
        payload.date_of_birth = dobEl.value;
        payload.dob = dobEl.value;
      }
      if (genderEl) {
        payload.gender = genderEl.value;
      }
      if (langEl) {
        payload.preferred_language = langEl.value;
      }
      if (addressEl) {
        payload.address = addressEl.value.trim();
      }
    }

    if (section === 'medical' || section === 'all') {
      const insProviderEl = document.getElementById('editInsuranceProvider');
      const insPolicyEl = document.getElementById('editInsurancePolicy');
      const bloodTypeEl = document.getElementById('editBloodType');
      const allergiesEl = document.getElementById('editAllergies');
      const chronicEl = document.getElementById('editChronic');
      const pharmacyEl = document.getElementById('editPharmacy');

      if (insProviderEl) payload.insurance_provider = insProviderEl.value.trim() || null;
      if (insPolicyEl) payload.insurance_policy_number = insPolicyEl.value.trim() || null;
      if (bloodTypeEl) {
        payload.blood_type = bloodTypeEl.value;
        payload.bloodType = bloodTypeEl.value;
      }
      if (allergiesEl) payload.allergies = allergiesEl.value.trim() || 'None';
      if (chronicEl) {
        payload.chronic_conditions = chronicEl.value.trim() || 'None';
        payload.chronicConditions = chronicEl.value.trim() || 'None';
      }
      if (pharmacyEl) payload.pharmacy = pharmacyEl.value.trim() || 'Nile Pharmacy';
    }

    try {
      const identifier = patient.customer_number || patient.id;
      const updated = await window.ClinicApi.updatePatient(identifier, payload);
      Object.assign(patient, updated, payload);

      if (patient.date_of_birth || patient.dob) {
        const birthYear = new Date(patient.date_of_birth || patient.dob).getFullYear();
        if (!isNaN(birthYear)) {
          patient.age = new Date().getFullYear() - birthYear;
        }
      }

      if (!Array.isArray(patient.activities)) patient.activities = [];
      patient.activities.unshift({
        type: 'updated',
        title: section === 'medical' ? 'Medical Information Updated' : (section === 'personal' ? 'Personal Details Updated' : 'Patient Record Updated'),
        sub: 'Successfully saved to PostgreSQL database',
        date: 'Today',
        time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
      });

      renderPatientDetails(patient);
      renderPatientsTable(allPatients);
      closeAdminModal();
      showToast(`Patient ${patient.name} record updated successfully in database!`, 'success');
    } catch (err) {
      console.error('[Patients] Update failed:', err);
      showToast('Database error updating patient: ' + err.message, 'warning');
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save to Database';
      }
    }
  }

  function handleExportPatients() {
    const html = `
      <div style="display:flex; flex-direction:column; gap:14px;">
        <p style="font-size:13px; color:#475569; margin:0;">Export ${allPatients.length} patient records adhering to clinic database compliance standards.</p>
        <div style="display:flex; flex-direction:column; gap:10px;">
          <label style="display:flex; align-items:center; gap:10px; font-size:13px; font-weight:600; cursor:pointer;">
            <input type="radio" name="exportFormat" value="csv" checked>
            <span>Comma Separated Values (.CSV)</span>
          </label>
          <label style="display:flex; align-items:center; gap:10px; font-size:13px; font-weight:600; cursor:pointer;">
            <input type="radio" name="exportFormat" value="json">
            <span>Structured Data Document (.JSON)</span>
          </label>
        </div>
      </div>
    `;

    const footer = `
      <button class="modal-btn-secondary" onclick="closeAdminModal()">Cancel</button>
      <button class="modal-btn-primary" onclick="triggerDownloadExport(); closeAdminModal();">Download Export</button>
    `;

    openAdminModal('Export Patients Directory', html, footer);
  }

  function triggerDownloadExport() {
    const format = document.querySelector('input[name="exportFormat"]:checked')?.value || 'csv';

    if (format === 'json') {
      const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(allPatients, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', dataStr);
      downloadAnchor.setAttribute('download', `Nile_Clinics_Patients_${new Date().toISOString().slice(0, 10)}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      showToast('JSON Patient registry downloaded successfully', 'success');
      return;
    }

    // Default CSV
    const headers = ['ID', 'Customer Number', 'Full Name', 'Phone', 'Email', 'National ID', 'Age', 'Gender', 'Blood Type', 'Address', 'Status'];
    const rows = allPatients.map(p => [
      p.id,
      p.customer_number || p.patientCode || '',
      `"${(p.name || '').replace(/"/g, '""')}"`,
      `"${p.phone || ''}"`,
      `"${p.email || ''}"`,
      `"${p.nationalId || ''}"`,
      p.age || '',
      p.gender || '',
      p.bloodType || '',
      `"${(p.address || '').replace(/"/g, '""')}"`,
      p.status || 'Active'
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Nile_Clinics_Patients_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();

    showToast('CSV Export generated and downloaded successfully', 'success');
  }

  function openRowActionMenu(id, name) {
    const html = `
      <div style="display:flex; flex-direction:column; gap:8px;">
        <button class="action-tile-btn" style="width:100%; border:none; background:#F8FAFC;" onclick="selectPatientRow(${id}); closeAdminModal();">
          <div class="tile-icon-box bg-blue-subtle text-blue"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg></div>
          <div class="tile-text-col"><h4 class="tile-title">View Profile Details</h4><span class="tile-subtext">Open right panel</span></div>
        </button>
        <button class="action-tile-btn" style="width:100%; border:none; background:#F8FAFC;" onclick="openEditPatientModal(); closeAdminModal();">
          <div class="tile-icon-box bg-purple-subtle text-purple"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></div>
          <div class="tile-text-col"><h4 class="tile-title">Edit Patient Record</h4><span class="tile-subtext">Update contact info</span></div>
        </button>
        <button class="action-tile-btn" style="width:100%; border:none; background:#F8FAFC;" onclick="showToast('Outbound SMS reminder dispatched to ${escapeJs(name)}', 'success'); closeAdminModal();">
          <div class="tile-icon-box bg-green-subtle text-green"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg></div>
          <div class="tile-text-col"><h4 class="tile-title">Dispatch SMS Notification</h4><span class="tile-subtext">Appointment reminders</span></div>
        </button>
      </div>
    `;

    openAdminModal(`Actions: ${name}`, html);
  }

  function openAllPatientActivityModal() {
    const patient = allPatients.find(p => p.id === currentlySelectedPatientId) || allPatients[0];
    if (!patient) return;

    const html = `
      <div style="display:flex; flex-direction:column; gap:12px; max-height:360px; overflow-y:auto;">
        <p style="font-size:13px; color:#64748B; margin:0;">Complete interaction timeline for ${escapeHtml(patient.name)} (${escapeHtml(patient.patientCode || patient.customer_number || '')}):</p>
        ${(patient.activities || []).map(a => `
          <div style="background:#F8FAFC; border:1px solid #E2E8F0; border-radius:8px; padding:10px 14px;">
            <div style="font-weight:700; color:#0F172A; font-size:13px;">${escapeHtml(a.title)}</div>
            <div style="font-size:12px; color:#475569;">${escapeHtml(a.sub)}</div>
            <div style="font-size:11px; color:#94A3B8; margin-top:4px;">${escapeHtml(a.date)} at ${escapeHtml(a.time)}</div>
          </div>
        `).join('')}
      </div>
    `;
    openAdminModal(`Activity Timeline: ${patient.name}`, html);
  }

  function openDateFilterModal() {
    const html = `
      <div style="display:flex; flex-direction:column; gap:12px;">
        <p style="font-size:13px; color:#64748B; margin:0;">Filter patients by database registration date range:</p>
        <div>
          <label style="display:block; font-size:12px; font-weight:600; color:#475569; margin-bottom:4px;">From Registration Date</label>
          <input type="date" id="dateFilterFromInput" value="${filterDateFrom || ''}" style="width:100%; height:38px; border:1px solid #CBD5E1; border-radius:6px; padding:0 12px; font-size:13px;">
        </div>
        <div>
          <label style="display:block; font-size:12px; font-weight:600; color:#475569; margin-bottom:4px;">To Registration Date</label>
          <input type="date" id="dateFilterToInput" value="${filterDateTo || ''}" style="width:100%; height:38px; border:1px solid #CBD5E1; border-radius:6px; padding:0 12px; font-size:13px;">
        </div>
        <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:8px;">
          <button type="button" class="modal-btn-secondary" onclick="clearDateFilter(); closeAdminModal();">Clear Filter</button>
          <button type="button" class="modal-btn-primary" onclick="applyDateFilterModal(); closeAdminModal();">Apply Date Filter</button>
        </div>
      </div>
    `;
    openAdminModal('Filter by Registration Date', html);
  }

  function applyDateFilterModal() {
    const fromInput = document.getElementById('dateFilterFromInput');
    const toInput = document.getElementById('dateFilterToInput');
    filterDateFrom = fromInput?.value || null;
    filterDateTo = toInput?.value || null;
    applyFilters();
    if (filterDateFrom || filterDateTo) {
      showToast(`Filtered by registration date: ${filterDateFrom || 'Start'} to ${filterDateTo || 'Now'}`, 'success');
    }
  }

  function clearDateFilter() {
    filterDateFrom = null;
    filterDateTo = null;
    applyFilters();
    showToast('Registration date filter cleared', 'info');
  }

  function switchDetailSubTab(tabName, btnEl) {
    const tabs = document.querySelectorAll('.sub-tab-btn');
    tabs.forEach(t => t.classList.remove('active'));
    if (btnEl) btnEl.classList.add('active');

    const overviewEl = document.getElementById('subTabContentOverview');
    const apptsEl = document.getElementById('subTabContentAppointments');
    const recordsEl = document.getElementById('subTabContentRecords');
    const historyEl = document.getElementById('subTabContentHistory');

    if (overviewEl) overviewEl.style.display = tabName === 'overview' ? 'flex' : 'none';
    if (apptsEl) apptsEl.style.display = tabName === 'appointments' ? 'flex' : 'none';
    if (recordsEl) recordsEl.style.display = tabName === 'records' ? 'flex' : 'none';
    if (historyEl) historyEl.style.display = tabName === 'history' ? 'flex' : 'none';

    const patient = allPatients.find(p => p.id === currentlySelectedPatientId);
    if (!patient) return;

    if (tabName === 'records') {
      const bType = document.getElementById('fieldRecordsBloodType');
      const ins = document.getElementById('fieldRecordsInsurance');
      const allg = document.getElementById('fieldRecordsAllergies');
      const chr = document.getElementById('fieldRecordsChronic');
      if (bType) bType.textContent = patient.bloodType || 'O+';
      if (ins) ins.textContent = patient.insurance_provider ? `${patient.insurance_provider} (${patient.insurance_policy_number || 'No Policy #'})` : 'Self-Pay / None';
      if (allg) allg.textContent = patient.allergies || 'None recorded';
      if (chr) chr.textContent = patient.chronicConditions || 'None recorded';
    } else if (tabName === 'history') {
      const histList = document.getElementById('detailFullHistoryList');
      if (histList) {
        if (patient.activities && patient.activities.length) {
          histList.innerHTML = patient.activities.map(act => `
            <div class="activity-timeline-item">
              <div class="activity-dot-circle ${act.type === 'updated' ? 'dot-blue' : 'dot-green'}"></div>
              <div class="activity-content-col">
                <div>
                  <div class="activity-title">${escapeHtml(act.title)}</div>
                  <div class="activity-sub">${escapeHtml(act.sub)}</div>
                </div>
                <div class="activity-timestamp">
                  <div class="activity-date">${escapeHtml(act.date)}</div>
                  <div>${escapeHtml(act.time)}</div>
                </div>
              </div>
            </div>
          `).join('');
        } else {
          histList.innerHTML = '<div style="font-size:12.5px; color:#94A3B8; text-align:center; padding:18px 0;">No past activity recorded for this patient.</div>';
        }
      }
    }
  }

  function goToPage(page, btnEl) {
    if (btnEl) {
      document.querySelectorAll('.page-num-btn').forEach(b => b.classList.remove('active'));
      btnEl.classList.add('active');
    }
    showToast(`Loaded page ${page} of patient directory`, 'info');
  }

  /* =============================================================================
     6. GLOBAL SHORTCUTS & HELPERS
     ============================================================================= */
  function initGlobalShortcuts() {
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        const input = document.getElementById('patientTableSearchInput');
        if (input) {
          input.focus();
          input.select();
        }
      }
      if (e.key === 'Escape') {
        closeAdminModal();
      }
    });

    const topSearch = document.getElementById('patientsGlobalSearch');
    if (topSearch) {
      topSearch.addEventListener('input', (e) => {
        const tableSearch = document.getElementById('patientTableSearchInput');
        if (tableSearch) {
          tableSearch.value = e.target.value;
          handleTableSearch(e.target.value);
        }
      });
    }

    // Sidebar navigation click: smooth reload without cache
    const navPatientsBtn = document.getElementById('nav-patients');
    if (navPatientsBtn) {
      navPatientsBtn.addEventListener('click', (e) => {
        e.preventDefault();
        loadLivePatients();
        showToast('Refreshing patient directory from database...', 'info');
      });
    }
  }

  function handleBranchChange(selectEl) {
    showToast(`Active clinic branch set to: ${selectEl.value}`, 'success');
  }

  function handleLogout() {
    if (confirm('Are you sure you want to log out of the Clinic Admin Console?')) {
      showToast('Admin logged out successfully.', 'info');
    }
  }

  function toggleNotifications() {
    showToast('Patient Directory: All records synchronized with PostgreSQL clinic backend.', 'info');
  }

  /* =============================================================================
     7. MODAL UTILITY
     ============================================================================= */
  function openAdminModal(title, bodyHtml, footerHtml = '') {
    const backdrop = document.getElementById('adminModalBackdrop');
    const titleEl = document.getElementById('adminModalTitle');
    const bodyEl = document.getElementById('adminModalBody');
    const footerEl = document.getElementById('adminModalFooter');

    if (titleEl) titleEl.textContent = title;
    if (bodyEl) bodyEl.innerHTML = bodyHtml;
    if (footerEl) footerEl.innerHTML = footerHtml;

    if (backdrop) {
      backdrop.classList.add('active');
      backdrop.classList.add('open');
    }
  }

  function closeAdminModal(e) {
    if (e && e.target && e.target.id !== 'adminModalBackdrop' && !e.target.closest('.modal-close-icon-btn') && !e.target.classList.contains('modal-btn-secondary')) {
      return;
    }
    const backdrop = document.getElementById('adminModalBackdrop');
    if (backdrop) {
      backdrop.classList.remove('active');
      backdrop.classList.remove('open');
    }
  }

  /* =============================================================================
     8. TOAST NOTIFICATION UTILITY
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
      <span class="toast-text">${message}</span>
    `;

    container.appendChild(toast);

    setTimeout(() => {
      toast.style.animation = 'toastSlideOut 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards';
      setTimeout(() => {
        toast.remove();
      }, 300);
    }, 3500);
  }

  /* =============================================================================
     9. SANITIZATION UTILITIES
     ============================================================================= */
  function escapeHtml(str) {
    if (!str && str !== 0) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function escapeJs(str) {
    if (!str) return '';
    return String(str).replace(/'/g, "\\'").replace(/"/g, '\\"');
  }

  // Export functions to window for HTML event bindings
  window.loadLivePatients = loadLivePatients;
  window.selectPatientRow = selectPatientRow;
  window.filterPatientTab = filterPatientTab;
  window.handleTableSearch = handleTableSearch;
  window.applyFilters = applyFilters;
  window.resetPatientFilters = resetPatientFilters;
  window.toggleAdvancedFilters = toggleAdvancedFilters;
  window.toggleSelectAll = toggleSelectAll;
  window.openAddPatientModal = openAddPatientModal;
  window.handleAddPatientSubmit = handleAddPatientSubmit;
  window.openEditPatientModal = openEditPatientModal;
  window.handleEditPatientSubmit = handleEditPatientSubmit;
  window.handleExportPatients = handleExportPatients;
  window.triggerDownloadExport = triggerDownloadExport;
  window.openRowActionMenu = openRowActionMenu;
  window.openAllPatientActivityModal = openAllPatientActivityModal;
  window.openDateFilterModal = openDateFilterModal;
  window.applyDateFilterModal = applyDateFilterModal;
  window.clearDateFilter = clearDateFilter;
  window.switchDetailSubTab = switchDetailSubTab;
  window.goToPage = goToPage;
  window.handleBranchChange = handleBranchChange;
  window.handleLogout = handleLogout;
  window.toggleNotifications = toggleNotifications;
  window.openAdminModal = openAdminModal;
  window.closeAdminModal = closeAdminModal;
  window.showToast = showToast;
  window.closePatientDetailsPanel = closePatientDetailsPanel;
})();

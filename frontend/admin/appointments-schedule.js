/**
 * Shiffaa Clinics - Appointments Schedule & Clinical Agenda Controller
 * 
 * Provides 3 high-efficiency clinical views:
 * 1. Doctor Roster & Daily Patient Feed (Master-Detail)
 * 2. Unified Clinical Agenda Table (Tabular List)
 * 3. Patient Flow Kanban Board (Status Pipeline)
 */

(function () {
  'use strict';

  // --- STATE ---
  let currentDate = '2026-11-22';
  let currentMode = 'roster'; // 'roster' | 'agenda' | 'kanban'
  let selectedDoctorId = null;
  let allDoctors = [];
  let allSpecialties = [];
  let allAppointments = [];
  let rosterSearchQuery = '';
  let globalSearchQuery = '';
  let selectedDeptFilter = '';
  let selectedStatusFilter = '';
  let agendaPage = 1;
  const agendaPageSize = 10;

  // --- INITIALIZATION ---
  document.addEventListener('DOMContentLoaded', async () => {
    initCurrentDate();
    initClock();
    setupSearchListeners();

    await loadCatalogAndAppointments();
  });

  function initCurrentDate() {
    const today = new Date();
    // Use simulated November 2026 date if in demo mode or real date
    const yyyy = today.getFullYear() === 2026 ? 2026 : 2026;
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    // Default to the active clinic seed date '2026-11-22'
    currentDate = '2026-11-22';

    const dateInp = document.getElementById('scheduleDateInput');
    if (dateInp) dateInp.value = currentDate;
  }

  function initClock() {
    const liveTimeText = document.getElementById('liveTimeText');
    const liveDateText = document.getElementById('liveDateText');

    function update() {
      const now = new Date();
      if (liveTimeText) {
        liveTimeText.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      }
      if (liveDateText) {
        liveDateText.textContent = now.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
      }
    }
    update();
    setInterval(update, 1000);
  }

  function setupSearchListeners() {
    const globalSearch = document.getElementById('scheduleGlobalSearch');
    if (globalSearch) {
      globalSearch.addEventListener('input', (e) => {
        globalSearchQuery = e.target.value.trim().toLowerCase();
        renderCurrentView();
      });
    }
  }

  // --- DATA LOADING ---
  async function loadCatalogAndAppointments() {
    try {
      const [specData, docData, apptData] = await Promise.all([
        window.ClinicApi.getSpecialties().catch(() => []),
        window.ClinicApi.getDoctors({ limit: 50 }).catch(() => ({ doctors: [] })),
        window.ClinicApi.getAppointments().catch(() => [])
      ]);

      allSpecialties = Array.isArray(specData) ? specData : [];
      allDoctors = Array.isArray(docData?.doctors) ? docData.doctors : [];
      allAppointments = Array.isArray(apptData) ? apptData : (apptData?.appointments || []);

      // Normalize appointments
      allAppointments = allAppointments.map(a => window.ClinicApi.normalizeAppointment(a)).filter(Boolean);

      // Populate department filter
      populateDeptFilter();

      // Default select first doctor
      if (allDoctors.length > 0 && !selectedDoctorId) {
        selectedDoctorId = allDoctors[0].id;
      }

      updateTopMetrics();
      renderCurrentView();
    } catch (err) {
      console.error('[Schedule] Failed to load data:', err);
      showToast('Could not load appointments from live backend.', 'error');
    }
  }

  function populateDeptFilter() {
    const select = document.getElementById('scheduleDeptFilter');
    if (!select) return;

    select.innerHTML = '<option value="">All Specialties / كل التخصصات</option>';
    allSpecialties.forEach(spec => {
      const opt = document.createElement('option');
      opt.value = spec.id;
      opt.textContent = `${spec.name_en} (${spec.name_ar})`;
      select.appendChild(opt);
    });
  }

  // --- METRICS CALCULATION ---
  function updateTopMetrics() {
    const dayAppts = allAppointments.filter(a => a.date === currentDate);
    const confirmedCount = dayAppts.filter(a => a.status.toLowerCase() === 'confirmed' || a.status.toLowerCase() === 'scheduled').length;
    const cancelledCount = dayAppts.filter(a => a.status.toLowerCase() === 'cancelled').length;

    // Active doctors today (distinct doctors who have shifts or appointments today)
    const activeDocIds = new Set(dayAppts.map(a => a.doctorId || a.doctor_id).filter(Boolean));
    const activeDocCount = activeDocIds.size || allDoctors.length;

    const elTotal = document.getElementById('metricTotalAppointments');
    const elConfirmed = document.getElementById('metricConfirmedAppointments');
    const elDocs = document.getElementById('metricActiveDoctorsCount');
    const elCancelled = document.getElementById('metricCancelledAppointments');

    if (elTotal) elTotal.textContent = dayAppts.length;
    if (elConfirmed) elConfirmed.textContent = confirmedCount;
    if (elDocs) elDocs.textContent = activeDocCount;
    if (elCancelled) elCancelled.textContent = cancelledCount;

    const totalLabel = document.getElementById('metricTotalLabel');
    if (totalLabel) {
      totalLabel.textContent = `Appointments for ${formatDateDisplay(currentDate)}`;
    }
  }

  // --- VIEW SWITCHING ---
  window.switchScheduleViewMode = function (mode) {
    currentMode = mode;

    const btnRoster = document.getElementById('btnModeDoctorRoster');
    const btnAgenda = document.getElementById('btnModeAgendaTable');
    const btnFlow = document.getElementById('btnModeFlowBoard');

    btnRoster?.classList.toggle('active', mode === 'roster');
    btnAgenda?.classList.toggle('active', mode === 'agenda');
    btnFlow?.classList.toggle('active', mode === 'kanban');

    document.getElementById('viewDoctorScheduleContainer').style.display = mode === 'roster' ? 'grid' : 'none';
    document.getElementById('viewAgendaTableContainer').style.display = mode === 'agenda' ? 'block' : 'none';
    document.getElementById('viewFlowBoardContainer').style.display = mode === 'kanban' ? 'grid' : 'none';

    renderCurrentView();
  };

  function renderCurrentView() {
    updateTopMetrics();
    if (currentMode === 'roster') {
      renderDoctorRosterView();
    } else if (currentMode === 'agenda') {
      renderAgendaTableView();
    } else if (currentMode === 'kanban') {
      renderFlowBoardView();
    }
  }

  // --- VIEW 1: DOCTOR ROSTER & CHRONOLOGICAL SCHEDULE ---
  function renderDoctorRosterView() {
    renderDoctorRosterList();
    renderSelectedDoctorTimeline();
  }

  function renderDoctorRosterList() {
    const listEl = document.getElementById('doctorRosterList');
    if (!listEl) return;

    let filtered = allDoctors;
    if (rosterSearchQuery) {
      filtered = filtered.filter(d => 
        (d.name_en && d.name_en.toLowerCase().includes(rosterSearchQuery)) ||
        (d.name_ar && d.name_ar.includes(rosterSearchQuery)) ||
        (d.specialty && d.specialty.name_en && d.specialty.name_en.toLowerCase().includes(rosterSearchQuery))
      );
    }
    if (selectedDeptFilter) {
      filtered = filtered.filter(d => d.specialty && (d.specialty.id == selectedDeptFilter || d.specialty_id == selectedDeptFilter));
    }

    if (filtered.length === 0) {
      listEl.innerHTML = '<div style="padding: 20px; text-align: center; color: #94A3B8; font-size: 13px;">No matching doctors found.</div>';
      return;
    }

    // Sort doctors: doctors who have appointments today appear on top
    const doctorsWithCounts = filtered.map(doc => {
      const apptCount = allAppointments.filter(a => a.date === currentDate && (a.doctorId === doc.id || a.doctor_id === doc.id)).length;
      return { doc, apptCount };
    });
    doctorsWithCounts.sort((a, b) => b.apptCount - a.apptCount);

    let html = '';
    doctorsWithCounts.forEach(({ doc, apptCount }) => {
      const isSelected = doc.id === selectedDoctorId;
      const specName = doc.specialty?.name_en || 'Consultant';
      const shiftStr = doc.shift_start && doc.shift_end ? `${doc.shift_start.slice(0, 5)} - ${doc.shift_end.slice(0, 5)}` : '09:00 - 14:00';
      const avatarHtml = doc.avatar_url 
        ? `<img src="${doc.avatar_url}" class="roster-doc-avatar" alt="${doc.name_en}">`
        : `<div class="roster-doc-avatar">${doc.name_en ? doc.name_en.replace(/^Dr\.\s*/i, '').charAt(0) : 'D'}</div>`;

      const pillHtml = apptCount > 0 
        ? `<span class="roster-appt-pill has-appts">${apptCount} Booked</span>`
        : `<span class="roster-appt-pill free">0 Patients</span>`;

      html += `
        <div class="doctor-roster-item ${isSelected ? 'active' : ''}" onclick="selectRosterDoctor(${doc.id})">
          ${avatarHtml}
          <div class="roster-doc-meta">
            <div class="roster-doc-name">${doc.name_en}</div>
            <div class="roster-doc-sub">
              <span>${specName}</span>
              <span>•</span>
              <span>${shiftStr}</span>
            </div>
          </div>
          ${pillHtml}
        </div>
      `;
    });

    listEl.innerHTML = html;
  }

  window.selectRosterDoctor = function (doctorId) {
    selectedDoctorId = doctorId;
    renderDoctorRosterView();
  };

  function renderSelectedDoctorTimeline() {
    const timelineEl = document.getElementById('doctorTimelinePanel');
    if (!timelineEl) return;

    const doc = allDoctors.find(d => d.id === selectedDoctorId) || allDoctors[0];
    if (!doc) {
      timelineEl.innerHTML = '<div style="padding: 40px; text-align: center; color: #94A3B8;">Please select a doctor from the roster.</div>';
      return;
    }

    const specName = doc.specialty?.name_en || 'Specialist';
    const feeStr = doc.consultation_fee ? `${doc.consultation_fee.amount || doc.consultation_fee} EGP` : '350 EGP';
    const shiftStr = doc.shift_start && doc.shift_end ? `${doc.shift_start.slice(0, 5)} - ${doc.shift_end.slice(0, 5)}` : '09:00 - 14:00';

    // Filter appointments for this doctor on selected date
    let docAppts = allAppointments.filter(a => 
      a.date === currentDate && 
      (a.doctorId === doc.id || a.doctor_id === doc.id)
    );

    if (globalSearchQuery) {
      docAppts = docAppts.filter(a => 
        (a.patientName && a.patientName.toLowerCase().includes(globalSearchQuery)) ||
        (a.patientPhone && a.patientPhone.includes(globalSearchQuery)) ||
        (a.patientCode && a.patientCode.includes(globalSearchQuery))
      );
    }

    if (selectedStatusFilter) {
      docAppts = docAppts.filter(a => a.status.toLowerCase() === selectedStatusFilter.toLowerCase());
    }

    // Sort chronologically by start time
    docAppts.sort((a, b) => (a.start_time || a.time || '').localeCompare(b.start_time || b.time || ''));

    // Hero Header
    const avatarHeaderHtml = doc.avatar_url
      ? `<img src="${doc.avatar_url}" class="doc-hero-img" alt="${doc.name_en}">`
      : `<div class="doc-hero-img" style="display:flex; align-items:center; justify-content:center; font-weight:800; color:#2563EB; font-size:20px;">${doc.name_en ? doc.name_en.replace(/^Dr\.\s*/i, '').charAt(0) : 'D'}</div>`;

    let feedHtml = '';
    if (docAppts.length === 0) {
      feedHtml = `
        <div style="background: #F8FAFC; border: 2px dashed #E2E8F0; border-radius: 12px; padding: 48px 24px; text-align: center; margin-top: 20px;">
          <div style="font-size: 36px; margin-bottom: 10px;">📋</div>
          <h4 style="font-size: 16px; font-weight: 700; color: #0F172A; margin: 0 0 6px 0;">No Appointments for ${doc.name_en}</h4>
          <p style="font-size: 13px; color: #64748B; margin: 0 0 16px 0;">This doctor has no booked appointments on ${formatDateDisplay(currentDate)}.</p>
          <button type="button" class="btn-new-appointment" onclick="openNewAppointmentModal(${doc.id})">
            + Schedule Patient for ${doc.name_en}
          </button>
        </div>
      `;
    } else {
      feedHtml = `<div class="timeline-feed-list">`;
      docAppts.forEach(appt => {
        const timeShort = appt.timeShort || appt.start_time || '10:00';
        const timeSpan = appt.time || `${appt.start_time} - ${appt.end_time || ''}`;
        const statusClass = appt.status.toLowerCase() === 'cancelled' ? 'status-cancelled' : (appt.status.toLowerCase() === 'completed' ? 'status-completed' : '');
        const pAvatarChar = appt.patientName ? appt.patientName.trim().charAt(0).toUpperCase() : 'P';
        const phone = appt.patientPhone || '';
        const visitReason = appt.visit_reason || appt.notes || 'Clinical Consultation';

        feedHtml += `
          <div class="timeline-appt-row">
            <div class="timeline-time-col">
              <span class="timeline-time-val">${timeShort}</span>
              <span class="timeline-time-dur">${timeSpan}</span>
            </div>

            <div class="timeline-card ${statusClass}">
              <div class="timeline-patient-group">
                <div class="patient-avatar-box">${pAvatarChar}</div>
                <div class="patient-info-col">
                  <div class="patient-name-link">
                    <span>${appt.patientName}</span>
                    <span class="patient-file-tag">${appt.patientCode}</span>
                    <span class="status-pill status-${appt.status.toLowerCase()}" style="font-size:11px; padding: 1px 7px;">${appt.status}</span>
                  </div>
                  <div class="patient-contact-row">
                    <span>📞 <a href="tel:${phone}">${phone}</a></span>
                    <span>•</span>
                    <span>Reason: <strong>${visitReason}</strong></span>
                  </div>
                </div>
              </div>

              <div class="timeline-actions-group">
                ${phone ? `<a href="https://wa.me/${phone.replace(/[^0-9]/g, '')}" target="_blank" class="btn-appt-action" title="Send WhatsApp Message">💬 WhatsApp</a>` : ''}
                <button type="button" class="btn-appt-action" onclick="openAppointmentDetails(${appt.id})">View Details</button>
                ${appt.status.toLowerCase() !== 'cancelled' ? `
                  <button type="button" class="btn-appt-action btn-appt-cancel" onclick="cancelAppointmentPrompt(${appt.id})">Cancel</button>
                ` : ''}
              </div>
            </div>
          </div>
        `;
      });
      feedHtml += `</div>`;
    }

    timelineEl.innerHTML = `
      <div class="doc-hero-header">
        <div class="doc-hero-left">
          ${avatarHeaderHtml}
          <div>
            <div class="doc-hero-title">${doc.name_en} <span style="font-size:14px; font-weight:600; color:#64748B;">(${doc.name_ar || ''})</span></div>
            <div class="doc-hero-badges">
              <span class="badge-specialty">${specName}</span>
              <span class="badge-shift">🕒 Shift: ${shiftStr}</span>
              <span class="badge-shift">💵 Fee: ${feeStr}</span>
              <span class="badge-specialty" style="background:#EFF6FF; color:#1E40AF;"><strong>${docAppts.length}</strong> Patients on ${formatDateDisplay(currentDate)}</span>
            </div>
          </div>
        </div>

        <div>
          <button type="button" class="btn-new-appointment" onclick="openNewAppointmentModal(${doc.id})">
            + Book Appointment
          </button>
        </div>
      </div>

      <div>
        <h4 style="font-size: 14px; font-weight: 700; color: #0F172A; margin: 0 0 14px 0;">
          Patient Schedule Timeline (${formatDateDisplay(currentDate)})
        </h4>
        ${feedHtml}
      </div>
    `;
  }

  // --- VIEW 2: CLINICAL AGENDA TABLE ---
  function renderAgendaTableView() {
    const tbody = document.getElementById('agendaTableBody');
    const badgeEl = document.getElementById('agendaTableTotalBadge');
    const pagText = document.getElementById('agendaPaginationText');
    if (!tbody) return;

    let filtered = allAppointments.filter(a => a.date === currentDate);

    if (globalSearchQuery) {
      filtered = filtered.filter(a => 
        (a.patientName && a.patientName.toLowerCase().includes(globalSearchQuery)) ||
        (a.doctor && a.doctor.toLowerCase().includes(globalSearchQuery)) ||
        (a.patientPhone && a.patientPhone.includes(globalSearchQuery))
      );
    }
    if (selectedDeptFilter) {
      filtered = filtered.filter(a => {
        const doc = allDoctors.find(d => d.id === a.doctorId || d.id === a.doctor_id);
        return doc && (doc.specialty_id == selectedDeptFilter || doc.specialty?.id == selectedDeptFilter);
      });
    }
    if (selectedStatusFilter) {
      filtered = filtered.filter(a => a.status.toLowerCase() === selectedStatusFilter.toLowerCase());
    }

    filtered.sort((a, b) => (a.start_time || a.time || '').localeCompare(b.start_time || b.time || ''));

    if (badgeEl) badgeEl.textContent = `${filtered.length} total entries on ${formatDateDisplay(currentDate)}`;

    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 40px; color: #94A3B8;">No appointments found for the selected date and filters.</td></tr>`;
      if (pagText) pagText.textContent = 'Showing 0–0 of 0';
      return;
    }

    const startIdx = (agendaPage - 1) * agendaPageSize;
    const pageRows = filtered.slice(startIdx, startIdx + agendaPageSize);

    if (pagText) {
      pagText.textContent = `Showing ${startIdx + 1}–${Math.min(startIdx + agendaPageSize, filtered.length)} of ${filtered.length}`;
    }

    let html = '';
    pageRows.forEach(a => {
      const docName = a.doctor || a.doctor_name || 'Dr. Medical';
      const docDept = a.doctorDept || a.doctor_dept || 'General';
      const statusClass = `status-${a.status.toLowerCase()}`;

      html += `
        <tr>
          <td><strong style="color:#0F172A;">${a.timeShort || a.start_time || '10:00 AM'}</strong></td>
          <td>
            <div style="font-weight: 700; color: #0F172A;">${a.patientName}</div>
            <div style="font-size: 11px; color: #64748B;">Code: ${a.patientCode} • Phone: <a href="tel:${a.patientPhone}" style="color:#2563EB; text-decoration:none;">${a.patientPhone}</a></div>
          </td>
          <td>
            <div style="font-weight: 600; color: #0F172A;">${docName}</div>
          </td>
          <td><span class="badge-specialty">${docDept}</span></td>
          <td style="color:#475569;">${a.visit_reason || a.notes || 'Consultation'}</td>
          <td><span class="status-pill ${statusClass}">${a.status}</span></td>
          <td style="text-align: right;">
            <button type="button" class="btn-appt-action" onclick="openAppointmentDetails(${a.id})">Details</button>
            ${a.status.toLowerCase() !== 'cancelled' ? `
              <button type="button" class="btn-appt-action btn-appt-cancel" onclick="cancelAppointmentPrompt(${a.id})">Cancel</button>
            ` : ''}
          </td>
        </tr>
      `;
    });

    tbody.innerHTML = html;
  }

  window.stepAgendaPage = function (delta) {
    agendaPage = Math.max(1, agendaPage + delta);
    renderAgendaTableView();
  };

  // --- VIEW 3: KANBAN PATIENT FLOW BOARD ---
  function renderFlowBoardView() {
    const stackConfirmed = document.getElementById('kanbanStackConfirmed');
    const stackWaiting = document.getElementById('kanbanStackWaiting');
    const stackInVisit = document.getElementById('kanbanStackInVisit');
    const stackCompleted = document.getElementById('kanbanStackCompleted');

    if (!stackConfirmed) return;

    const dayAppts = allAppointments.filter(a => a.date === currentDate && a.status.toLowerCase() !== 'cancelled');

    const confirmed = dayAppts.filter(a => a.status.toLowerCase() === 'confirmed' || a.status.toLowerCase() === 'scheduled');
    const waiting = dayAppts.filter(a => a.status.toLowerCase() === 'waiting' || a.status.toLowerCase() === 'arrived');
    const inVisit = dayAppts.filter(a => a.status.toLowerCase() === 'in_consultation' || a.status.toLowerCase() === 'in progress');
    const completed = dayAppts.filter(a => a.status.toLowerCase() === 'completed');

    document.getElementById('kanbanCountConfirmed').textContent = confirmed.length;
    document.getElementById('kanbanCountWaiting').textContent = waiting.length;
    document.getElementById('kanbanCountInVisit').textContent = inVisit.length;
    document.getElementById('kanbanCountCompleted').textContent = completed.length;

    stackConfirmed.innerHTML = renderKanbanCards(confirmed, 'Confirm');
    stackWaiting.innerHTML = renderKanbanCards(waiting, 'In Visit');
    stackInVisit.innerHTML = renderKanbanCards(inVisit, 'Complete');
    stackCompleted.innerHTML = renderKanbanCards(completed, 'Done');
  }

  function renderKanbanCards(list, nextStage) {
    if (list.length === 0) {
      return '<div style="padding: 30px 10px; text-align: center; color: #94A3B8; font-size: 12px;">No patients in this stage</div>';
    }

    return list.map(a => `
      <div class="kanban-card">
        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 6px;">
          <span style="font-size: 13px; font-weight: 700; color: #0F172A;">${a.patientName}</span>
          <span style="font-size: 11px; font-weight: 700; color: #2563EB; background: #EFF6FF; padding: 2px 6px; border-radius: 4px;">${a.timeShort || '10:00'}</span>
        </div>
        <div style="font-size: 12px; color: #475569; margin-bottom: 8px;">
          👨‍⚕️ ${a.doctor || a.doctor_name} (${a.doctorDept || 'Clinic'})
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 6px; border-top: 1px solid #F1F5F9;">
          <span style="font-size: 11px; color: #64748B;">Code: ${a.patientCode}</span>
          <button type="button" class="btn-appt-action" onclick="openAppointmentDetails(${a.id})" style="padding: 2px 8px; font-size: 11px;">View</button>
        </div>
      </div>
    `).join('');
  }

  // --- DATE CONTROLS ---
  window.handleScheduleDateChange = function (val) {
    if (!val) return;
    currentDate = val;
    agendaPage = 1;
    renderCurrentView();
  };

  window.stepScheduleDate = function (deltaDays) {
    const d = new Date(currentDate);
    d.setDate(d.getDate() + deltaDays);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    currentDate = `${yyyy}-${mm}-${dd}`;

    const dateInp = document.getElementById('scheduleDateInput');
    if (dateInp) dateInp.value = currentDate;

    updateQuickDateButtons();
    agendaPage = 1;
    renderCurrentView();
  };

  window.setQuickDate = function (type) {
    if (type === 'today') {
      currentDate = '2026-11-22';
    } else if (type === 'tomorrow') {
      currentDate = '2026-11-23';
    }
    const dateInp = document.getElementById('scheduleDateInput');
    if (dateInp) dateInp.value = currentDate;
    updateQuickDateButtons();
    agendaPage = 1;
    renderCurrentView();
  };

  function updateQuickDateButtons() {
    const btnToday = document.getElementById('btnQuickToday');
    const btnTom = document.getElementById('btnQuickTomorrow');
    if (btnToday) btnToday.classList.toggle('active', currentDate === '2026-11-22');
    if (btnTom) btnTom.classList.toggle('active', currentDate === '2026-11-23');
  }

  window.handleRosterSearch = function (val) {
    rosterSearchQuery = val.trim().toLowerCase();
    renderDoctorRosterList();
  };

  window.handleFilterChange = function () {
    const deptSelect = document.getElementById('scheduleDeptFilter');
    const statusSelect = document.getElementById('scheduleStatusFilter');
    selectedDeptFilter = deptSelect ? deptSelect.value : '';
    selectedStatusFilter = statusSelect ? statusSelect.value : '';
    agendaPage = 1;
    renderCurrentView();
  };

  window.resetScheduleFilters = function () {
    const deptSelect = document.getElementById('scheduleDeptFilter');
    const statusSelect = document.getElementById('scheduleStatusFilter');
    const searchInp = document.getElementById('scheduleGlobalSearch');
    const rosterInp = document.getElementById('rosterSearchInput');

    if (deptSelect) deptSelect.value = '';
    if (statusSelect) statusSelect.value = '';
    if (searchInp) searchInp.value = '';
    if (rosterInp) rosterInp.value = '';

    selectedDeptFilter = '';
    selectedStatusFilter = '';
    globalSearchQuery = '';
    rosterSearchQuery = '';
    agendaPage = 1;
    renderCurrentView();
    showToast('Filters reset.', 'info');
  };

  // --- APPOINTMENT ACTIONS & MODALS ---
  window.openAppointmentDetails = function (apptId) {
    const appt = allAppointments.find(a => a.id === apptId);
    if (!appt) return;

    const modalBackdrop = document.getElementById('adminModalBackdrop');
    const titleEl = document.getElementById('adminModalTitle');
    const bodyEl = document.getElementById('adminModalBody');
    const footerEl = document.getElementById('adminModalFooter');

    titleEl.textContent = `Appointment #${appt.id} Details`;
    bodyEl.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 14px;">
        <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; padding: 14px;">
          <div style="font-size: 16px; font-weight: 800; color: #0F172A; margin-bottom: 4px;">${appt.patientName}</div>
          <div style="font-size: 13px; color: #64748B;">Code: <strong>${appt.patientCode}</strong> • Phone: <strong>${appt.patientPhone}</strong></div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
          <div style="background: #EFF6FF; padding: 12px; border-radius: 8px;">
            <div style="font-size: 11px; font-weight: 700; color: #2563EB;">DOCTOR & SPECIALTY</div>
            <div style="font-size: 14px; font-weight: 700; color: #0F172A; margin-top: 4px;">${appt.doctor || appt.doctor_name}</div>
            <div style="font-size: 12px; color: #475569;">${appt.doctorDept || 'Clinical Department'}</div>
          </div>
          <div style="background: #F1F5F9; padding: 12px; border-radius: 8px;">
            <div style="font-size: 11px; font-weight: 700; color: #475569;">SCHEDULED TIME</div>
            <div style="font-size: 14px; font-weight: 700; color: #0F172A; margin-top: 4px;">${appt.date}</div>
            <div style="font-size: 12px; color: #475569;">${appt.time || appt.start_time}</div>
          </div>
        </div>

        <div>
          <div style="font-size: 12px; font-weight: 700; color: #475569; margin-bottom: 4px;">Visit Reason / Clinical Notes</div>
          <div style="background: #FFFFFF; border: 1px solid #CBD5E1; border-radius: 6px; padding: 10px; font-size: 13px; color: #0F172A;">
            ${appt.visit_reason || appt.notes || 'Routine consultation and checkup.'}
          </div>
        </div>

        <div style="display: flex; align-items: center; justify-content: space-between; padding-top: 8px;">
          <span style="font-size: 13px; color: #64748B;">Current Status:</span>
          <span class="status-pill status-${appt.status.toLowerCase()}">${appt.status}</span>
        </div>
      </div>
    `;

    footerEl.innerHTML = `
      <button type="button" class="btn-secondary" onclick="closeAdminModal()">Close</button>
      ${appt.status.toLowerCase() !== 'cancelled' ? `
        <button type="button" class="btn-danger" onclick="cancelAppointmentPrompt(${appt.id})" style="background:#EF4444; color:#fff; border:none; padding:8px 16px; border-radius:6px; cursor:pointer;">Cancel Booking</button>
      ` : ''}
    `;

    modalBackdrop.style.display = 'flex';
  };

  window.cancelAppointmentPrompt = async function (apptId) {
    if (!confirm('Are you sure you want to cancel this appointment?')) return;

    try {
      showToast('Cancelling appointment...', 'info');
      await window.ClinicApi.cancelAppointment(apptId, { reason: 'Cancelled by administrator via Schedule Console' });
      showToast(`Appointment #${apptId} has been cancelled.`, 'success');
      closeAdminModal();
      await loadCatalogAndAppointments();
    } catch (err) {
      console.error('[Schedule] Cancel failed:', err);
      showToast(`Failed to cancel: ${err.message || 'Server error'}`, 'error');
    }
  };

  window.openNewAppointmentModal = function (preselectedDocId = null) {
    const modalBackdrop = document.getElementById('adminModalBackdrop');
    const titleEl = document.getElementById('adminModalTitle');
    const bodyEl = document.getElementById('adminModalBody');
    const footerEl = document.getElementById('adminModalFooter');

    titleEl.textContent = 'Schedule New Appointment';

    let docOptionsHtml = '';
    allDoctors.forEach(d => {
      const isSel = (preselectedDocId && d.id === preselectedDocId) || (!preselectedDocId && d.id === selectedDoctorId);
      docOptionsHtml += `<option value="${d.id}" ${isSel ? 'selected' : ''}>${d.name_en} (${d.specialty?.name_en || 'Consultant'})</option>`;
    });

    bodyEl.innerHTML = `
      <form id="newApptForm" onsubmit="handleNewAppointmentSubmit(event)" style="display: flex; flex-direction: column; gap: 12px;">
        <div>
          <label style="font-size: 12px; font-weight: 700; color: #334155;">Patient Full Name</label>
          <input type="text" id="newApptPatientName" required placeholder="e.g. Youssef Nabil" style="width: 100%; height: 36px; border: 1px solid #CBD5E1; border-radius: 6px; padding: 0 10px; font-family: inherit;">
        </div>

        <div>
          <label style="font-size: 12px; font-weight: 700; color: #334155;">Phone Number (E.164 Egyptian mobile)</label>
          <input type="tel" id="newApptPatientPhone" required placeholder="+201012345678" style="width: 100%; height: 36px; border: 1px solid #CBD5E1; border-radius: 6px; padding: 0 10px; font-family: inherit;">
        </div>

        <div>
          <label style="font-size: 12px; font-weight: 700; color: #334155;">Select Doctor</label>
          <select id="newApptDoctorId" required style="width: 100%; height: 36px; border: 1px solid #CBD5E1; border-radius: 6px; padding: 0 10px; font-family: inherit;">
            ${docOptionsHtml}
          </select>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
          <div>
            <label style="font-size: 12px; font-weight: 700; color: #334155;">Appointment Date</label>
            <input type="date" id="newApptDate" value="${currentDate}" required style="width: 100%; height: 36px; border: 1px solid #CBD5E1; border-radius: 6px; padding: 0 10px; font-family: inherit;">
          </div>
          <div>
            <label style="font-size: 12px; font-weight: 700; color: #334155;">Start Time</label>
            <input type="time" id="newApptTime" value="10:00" required step="1800" style="width: 100%; height: 36px; border: 1px solid #CBD5E1; border-radius: 6px; padding: 0 10px; font-family: inherit;">
          </div>
        </div>

        <div>
          <label style="font-size: 12px; font-weight: 700; color: #334155;">Visit Reason</label>
          <input type="text" id="newApptReason" placeholder="e.g. Regular Checkup / Consultation" value="Regular Checkup" style="width: 100%; height: 36px; border: 1px solid #CBD5E1; border-radius: 6px; padding: 0 10px; font-family: inherit;">
        </div>
      </form>
    `;

    footerEl.innerHTML = `
      <button type="button" class="btn-secondary" onclick="closeAdminModal()">Cancel</button>
      <button type="submit" form="newApptForm" class="btn-primary" style="background:#2563EB; color:#fff; border:none; padding:8px 18px; border-radius:6px; font-weight:700; cursor:pointer;">Confirm Booking</button>
    `;

    modalBackdrop.style.display = 'flex';
  };

  window.handleNewAppointmentSubmit = async function (e) {
    e.preventDefault();
    const pName = document.getElementById('newApptPatientName').value.trim();
    const pPhone = document.getElementById('newApptPatientPhone').value.trim();
    const docId = parseInt(document.getElementById('newApptDoctorId').value, 10);
    const dateVal = document.getElementById('newApptDate').value;
    const timeVal = document.getElementById('newApptTime').value;
    const reason = document.getElementById('newApptReason').value.trim();

    try {
      showToast('Creating appointment...', 'info');
      await window.ClinicApi.createAppointment({
        patient_name: pName,
        patient_phone: pPhone,
        doctor_id: docId,
        appointment_date: dateVal,
        start_time: timeVal,
        visit_reason: reason
      });

      showToast(`Appointment successfully booked for ${pName}!`, 'success');
      closeAdminModal();
      await loadCatalogAndAppointments();
    } catch (err) {
      console.error('[Schedule] Booking failed:', err);
      showToast(`Failed to book appointment: ${err.message || 'Server error'}`, 'error');
    }
  };

  window.closeAdminModal = function () {
    const backdrop = document.getElementById('adminModalBackdrop');
    if (backdrop) backdrop.style.display = 'none';
  };

  // --- HELPERS ---
  function formatDateDisplay(yyyyMmDd) {
    if (!yyyyMmDd) return '';
    try {
      const parts = yyyyMmDd.split('-');
      const d = new Date(parts[0], parseInt(parts[1], 10) - 1, parts[2]);
      return d.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' });
    } catch (_) {
      return yyyyMmDd;
    }
  }

  function showToast(message, type = 'info') {
    const container = document.getElementById('adminToastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `admin-toast toast-${type}`;
    let icon = type === 'success' ? '✓' : (type === 'error' ? '✕' : 'ℹ');
    toast.innerHTML = `<span style="font-weight:800; margin-right:6px;">${icon}</span><span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('toast-exit');
      setTimeout(() => toast.remove(), 250);
    }, 3500);
  }

  window.handleBranchChange = function () {
    showToast('Active Medical Branch: Main Clinic (Heliopolis)', 'info');
  };

  window.handleLogout = function () {
    if (confirm('Sign out of admin console?')) {
      if (typeof AdminAuth !== 'undefined') AdminAuth.logout();
      else window.location.href = 'login.html';
    }
  };

  window.toggleNotifications = function () {
    showToast('Clinical backend microservices and database operational.', 'info');
  };

})();

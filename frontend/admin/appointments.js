/**
 * Nile Clinics - Appointments Management Controller
 * Handles Multi-doctor Schedule Grid, Mini-calendar, Agenda List, Filters, 
 * Appointment Details Drawer, and Modals (New Appointment, Reschedule, Cancel, Export).
 */

document.addEventListener('DOMContentLoaded', () => {
  initClock();
  initGlobalShortcuts();
  initAppointmentsStore();
  loadLiveCatalog();
  initRealtimeAppointmentsSync();
});

function initRealtimeAppointmentsSync() {
  if (!window.ClinicRealtime) return;
  window.ClinicRealtime.on('APPOINTMENT_BOOKED', (payload) => {
    loadLiveCatalog();
    if (typeof showToast === 'function') {
      const pName = payload?.patientName || payload?.patient_name || 'Patient';
      showToast(`Real-time: New appointment scheduled for ${pName}.`, 'success');
    }
  });
  window.ClinicRealtime.on('APPOINTMENT_CANCELLED', (payload) => {
    loadLiveCatalog();
    if (typeof showToast === 'function') {
      showToast(`Real-time: Appointment #${payload?.id || ''} was cancelled.`, 'warning');
    }
  });
  window.ClinicRealtime.on('APPOINTMENT_UPDATED', () => {
    loadLiveCatalog();
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
   2. GLOBAL KEYBOARD SHORTCUTS
   ============================================================================= */
function initGlobalShortcuts() {
  window.addEventListener('keydown', (e) => {
    // Ctrl + K or Cmd + K: Quick Search Focus
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      const searchInput = document.getElementById('globalApptSearchInput');
      if (searchInput) {
        searchInput.focus();
        searchInput.select();
      }
    }
    // Escape to close active modal
    if (e.key === 'Escape') {
      closeAdminModal();
    }
  });

  const searchInput = document.getElementById('globalApptSearchInput');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const term = e.target.value.toLowerCase().trim();
      handleSearchAppointments(term);
    });
  }
}

/* =============================================================================
   3. APPOINTMENTS DATA STORE
   ============================================================================= */
let appointmentsData = [];

let selectedAppointment = null;
let currentViewMode = 'calendar'; // 'calendar' | 'list'
let currentInterval = 'day'; // 'day' | 'week' | 'month'
let currentDateOffset = 0; // Days from 14 Nov 2024
let currentActiveDayNumber = 14;

function saveAppointmentsStore() {
  try {
    localStorage.setItem('nile_clinic_appointments_live_v2', JSON.stringify(appointmentsData));
  } catch (_) {}
}

function initAppointmentsStore() {
  try {
    const saved = localStorage.getItem('nile_clinic_appointments_live_v2');
    if (saved) {
      appointmentsData = JSON.parse(saved);
    }
  } catch (e) {}

  if (!appointmentsData || appointmentsData.length === 0) {
    appointmentsData = [
      {
        id: 101,
        patientName: "Hassan Metwaly",
        patientPhone: "+201122228646",
        patientCode: "324956",
        patientAvatar: "H",
        patientAvatarBg: "#EFF6FF",
        patientAvatarColor: "#2563EB",
        doctor: "Dr. Amal Nour",
        doctorDept: "Cardiology",
        doctorId: 1,
        time: "09:00 AM - 09:30 AM",
        timeShort: "09:00 AM",
        date: "Today",
        type: "Consultation",
        status: "Confirmed",
        branch: "Main Branch - Heliopolis",
        room: "Cardiology Suite 1",
        notes: "Cardiovascular consultation & baseline ECG examination.",
        insurance: "Cash / Standard"
      },
      {
        id: 102,
        patientName: "Ziad Ehab Tawfik",
        patientPhone: "+201019755937",
        patientCode: "166967",
        patientAvatar: "Z",
        patientAvatarBg: "#F0FDF4",
        patientAvatarColor: "#16A34A",
        doctor: "Dr. Salma Hany",
        doctorDept: "Dermatology",
        doctorId: 3,
        time: "11:00 AM - 11:30 AM",
        timeShort: "11:00 AM",
        date: "Today",
        type: "Follow-up",
        status: "Confirmed",
        branch: "Main Branch - Heliopolis",
        room: "Dermatology Clinic 2",
        notes: "Routine dermatological follow-up consultation.",
        insurance: "Standard Insurance"
      }
    ];
  }

  saveAppointmentsStore();
  renderScheduleGrid();
  if (appointmentsData.length > 0) {
    selectScheduleSlot(appointmentsData[0].id, null);
  }
}

function renderScheduleGrid() {
  const tbody = document.getElementById('scheduleGridBody');
  if (!tbody) return;

  const times = [
    '08:00 AM', '09:00 AM', '10:00 AM', '11:00 AM', '12:00 PM',
    '01:00 PM', '02:00 PM', '03:00 PM', '04:00 PM', '05:00 PM'
  ];

  const doctors = (Array.isArray(liveDoctorsCache) && liveDoctorsCache.length > 0)
    ? liveDoctorsCache.slice(0, 5)
    : [
        { name_en: 'Dr. Amal Nour', specialty_id: 1 },
        { name_en: 'Dr. Karim Salem', specialty_id: 1 },
        { name_en: 'Dr. Salma Hany', specialty_id: 2 },
        { name_en: 'Dr. Tarek Ali', specialty_id: 2 },
        { name_en: 'Dr. Mariam Adel', specialty_id: 3 }
      ];

  tbody.innerHTML = times.map(t => {
    let cellsHtml = `<td class="time-slot-cell">${t}</td>`;

    doctors.forEach(doc => {
      const match = appointmentsData.find(a => {
        const docIdMatch = a.doctorId && doc.id && Number(a.doctorId) === Number(doc.id);
        const docNameMatch = a.doctor && (
          a.doctor.toLowerCase().includes(doc.name_en.toLowerCase()) || 
          doc.name_en.toLowerCase().includes(a.doctor.toLowerCase())
        );
        if (!docIdMatch && !docNameMatch) return false;

        if (a.timeShort && (a.timeShort === t || a.timeShort.startsWith(t.slice(0, 5)))) return true;
        if (a.time && a.time.startsWith(t)) return true;

        const tHour = parseInt(t.slice(0, 2), 10) + (t.includes('PM') && !t.startsWith('12') ? 12 : 0);
        const aStart = a.start_time || (a.time ? a.time.slice(0, 5) : '');
        if (aStart) {
          const aHour = parseInt(aStart.slice(0, 2), 10);
          if (aHour === tHour) return true;
        }
        return false;
      });

      if (match) {
        let cardColorClass = 'card-confirmed-green';
        if (match.status === 'Pending') cardColorClass = 'card-orange';
        if (match.status === 'In Clinic') cardColorClass = 'card-blue';
        if (match.status === 'Cancelled') cardColorClass = 'card-purple';

        const isSelected = selectedAppointment && selectedAppointment.id === match.id ? 'selected-appt-card' : '';

        cellsHtml += `
          <td style="padding: 4px; vertical-align: top;">
            <div class="appt-slot-card ${cardColorClass} ${isSelected}" onclick="selectScheduleSlot(${match.id}, this)">
              <div class="slot-top-row">
                <span class="slot-time-text">${match.timeShort || t}</span>
                <span class="status-pill status-${match.status.toLowerCase().replace(/\s+/g, '')}">${match.status}</span>
              </div>
              <span class="slot-patient-name">${escapeHtml(match.patientName)}</span>
              <span class="slot-sub-type">${escapeHtml(match.type)} • ${escapeHtml(match.patientCode)}</span>
            </div>
          </td>
        `;
      } else {
        cellsHtml += `<td style="padding: 4px; text-align: center; vertical-align: middle;"></td>`;
      }
    });

    return `<tr>${cellsHtml}</tr>`;
  }).join('');

  // Update Metrics
  metricsState.total = appointmentsData.length;
  metricsState.confirmed = appointmentsData.filter(a => a.status === 'Confirmed').length;
  metricsState.pending = appointmentsData.filter(a => a.status === 'Pending').length;
  metricsState.cancelled = appointmentsData.filter(a => a.status === 'Cancelled').length;
  updateMetricsDisplay();

  // Render Right Column Upcoming List
  renderUpcomingList();
}

function renderUpcomingList() {
  const container = document.querySelector('.upcoming-items-list');
  const countEl = document.querySelector('.upcoming-title');
  if (!container) return;

  const upcoming = appointmentsData.filter(a => a.status !== 'Cancelled').slice(0, 5);
  if (countEl) countEl.textContent = `Upcoming (${upcoming.length})`;

  if (upcoming.length === 0) {
    container.innerHTML = '<div style="padding: 24px 12px; text-align: center; color: var(--text-muted); font-size: 13px;">No upcoming appointments scheduled</div>';
    return;
  }

  container.innerHTML = upcoming.map(appt => `
    <div class="upcoming-item-card" onclick="selectScheduleSlot(${appt.id}, null)" style="cursor: pointer; padding: 10px 12px; border-radius: 8px; border: 1px solid var(--border-light); margin-bottom: 8px; background: #FFFFFF; display: flex; align-items: center; justify-content: space-between;">
      <div style="display: flex; align-items: center; gap: 10px;">
        <div style="width: 34px; height: 34px; border-radius: 50%; background: ${appt.patientAvatarBg || '#EFF6FF'}; color: ${appt.patientAvatarColor || '#2563EB'}; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 12px;">
          ${appt.patientAvatar || appt.patientName.charAt(0)}
        </div>
        <div>
          <div style="font-weight: 700; font-size: 12.5px; color: var(--text-dark);">${escapeHtml(appt.patientName)}</div>
          <div style="font-size: 11px; color: var(--text-muted);">${escapeHtml(appt.doctor)} • ${escapeHtml(appt.doctorDept)}</div>
        </div>
      </div>
      <div style="text-align: right;">
        <div style="font-size: 11px; font-weight: 700; color: #2563EB;">${appt.timeShort}</div>
        <div style="font-size: 10px; color: var(--text-muted);">${appt.date}</div>
      </div>
    </div>
  `).join('');
}

/* =============================================================================
   4. APPOINTMENT SELECTION & DETAILS DRAWER
   ============================================================================= */
function selectScheduleSlot(apptId, element) {
  const found = appointmentsData.find(a => a.id === apptId);
  if (!found) return;

  selectedAppointment = found;

  // Update UI selection ring in table
  document.querySelectorAll('.appt-slot-card').forEach(card => {
    card.classList.remove('selected-appt-card');
  });
  if (element) {
    element.classList.add('selected-appt-card');
  }

  populateAppointmentDetails(selectedAppointment);
}

function populateAppointmentDetails(appt) {
  const emptyState = document.getElementById('apptDetailsEmptyState');
  const activeContent = document.getElementById('apptDetailsActiveContent');

  if (!appt) {
    if (emptyState) emptyState.style.display = 'block';
    if (activeContent) activeContent.style.display = 'none';
    return;
  }

  if (emptyState) emptyState.style.display = 'none';
  if (activeContent) activeContent.style.display = 'flex';

  const heroAvatar = document.getElementById('apptHeroAvatar');
  const heroName = document.getElementById('apptHeroName');
  const heroStatus = document.getElementById('apptHeroStatus');
  const heroPhone = document.getElementById('apptHeroPhone');

  const fieldDate = document.getElementById('apptFieldDate');
  const fieldTime = document.getElementById('apptFieldTime');
  const fieldDoctor = document.getElementById('apptFieldDoctor');
  const fieldDept = document.getElementById('apptFieldDept');
  const fieldType = document.getElementById('apptFieldType');
  const fieldBranch = document.getElementById('apptFieldBranch');
  const fieldNotes = document.getElementById('apptFieldNotes');

  if (heroAvatar) {
    heroAvatar.textContent = appt.patientAvatar || appt.patientName.charAt(0);
    heroAvatar.style.background = appt.patientAvatarBg || '#EFF6FF';
    heroAvatar.style.color = appt.patientAvatarColor || '#2563EB';
  }

  if (heroName) heroName.textContent = appt.patientName;
  if (heroPhone) heroPhone.textContent = appt.patientPhone;

  if (heroStatus) {
    heroStatus.textContent = `• ${appt.status}`;
    heroStatus.className = 'status-pill';
    if (appt.status === 'Confirmed') heroStatus.classList.add('status-confirmed');
    else if (appt.status === 'Pending') heroStatus.classList.add('status-pending');
    else if (appt.status === 'In Clinic') heroStatus.classList.add('status-inclinic');
    else if (appt.status === 'Cancelled') heroStatus.classList.add('status-cancelled');
    else heroStatus.classList.add('status-confirmed');
  }

  if (fieldDate) fieldDate.textContent = appt.date;
  if (fieldTime) fieldTime.textContent = appt.time;
  if (fieldDoctor) fieldDoctor.textContent = appt.doctor;
  if (fieldDept) fieldDept.textContent = appt.doctorDept;
  if (fieldType) fieldType.textContent = appt.type;
  if (fieldBranch) fieldBranch.textContent = appt.branch;
  if (fieldNotes) fieldNotes.textContent = appt.notes || 'No notes provided.';
}

/* =============================================================================
   5. UPCOMING APPOINTMENTS CLICK HANDLER
   ============================================================================= */
function loadUpcomingDetails(doctorName, dept, time, status) {
  const match = appointmentsData.find(a => 
    a.doctor.toLowerCase().includes(doctorName.toLowerCase()) || 
    (a.timeShort && a.timeShort.toLowerCase().includes(time.toLowerCase()))
  );

  if (match) {
    selectScheduleSlot(match.id, null);
    showToast(`Loaded details for ${match.patientName} with ${match.doctor}`, 'info');
  } else {
    // Generate synthetic on the fly if exact ID not found
    const synthetic = {
      id: 999,
      patientName: "Patient (" + doctorName + ")",
      patientPhone: "+20 100 000 0000",
      patientCode: "PT-2024-UPCOMING",
      patientAvatar: doctorName.charAt(0),
      patientAvatarBg: "#EFF6FF",
      patientAvatarColor: "#2563EB",
      doctor: "Dr. " + doctorName,
      doctorDept: dept,
      time: time + " - " + time,
      timeShort: time,
      date: "Thursday, 14 Nov 2024",
      type: "Consultation",
      status: status,
      branch: "Main Branch - Heliopolis",
      room: "Consultation Suite",
      notes: "Upcoming slot synced from clinic queue."
    };
    populateAppointmentDetails(synthetic);
    showToast(`Loaded upcoming slot for ${synthetic.doctor}`, 'info');
  }
}

/* =============================================================================
   6. DETAILS SUB TABS (Details, Patient Info, History, Notes)
   ============================================================================= */
function switchApptDetailTab(tab, btn) {
  document.querySelectorAll('.patient-sub-tabs .sub-tab-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');

  const container = document.getElementById('apptInfoGrid');
  if (!container || !selectedAppointment) return;

  if (tab === 'details') {
    container.innerHTML = `
      <div class="appt-info-block">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
        <div class="appt-info-text">
          <span class="appt-info-label">Date & Time</span>
          <span class="appt-info-value" id="apptFieldDate">${selectedAppointment.date}</span>
          <span class="appt-info-sub" id="apptFieldTime">${selectedAppointment.time}</span>
        </div>
      </div>
      <div class="appt-info-block">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
        <div class="appt-info-text">
          <span class="appt-info-label">Doctor</span>
          <span class="appt-info-value" id="apptFieldDoctor">${selectedAppointment.doctor}</span>
          <span class="appt-info-sub" id="apptFieldDept">${selectedAppointment.doctorDept}</span>
        </div>
      </div>
      <div class="appt-info-block">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        <div class="appt-info-text">
          <span class="appt-info-label">Type</span>
          <span class="appt-info-value" id="apptFieldType">${selectedAppointment.type}</span>
        </div>
      </div>
      <div class="appt-info-block">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
        <div class="appt-info-text">
          <span class="appt-info-label">Branch</span>
          <span class="appt-info-value" id="apptFieldBranch">${selectedAppointment.branch}</span>
        </div>
      </div>
    `;
  } else if (tab === 'patientInfo') {
    container.innerHTML = `
      <div class="appt-info-block" style="grid-column:span 2;">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
        <div class="appt-info-text">
          <span class="appt-info-label">Patient Record & Code</span>
          <span class="appt-info-value">${selectedAppointment.patientName} (${selectedAppointment.patientCode})</span>
          <span class="appt-info-sub">Phone: ${selectedAppointment.patientPhone}</span>
        </div>
      </div>
      <div class="appt-info-block" style="grid-column:span 2;">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
        <div class="appt-info-text">
          <span class="appt-info-label">Insurance Provider</span>
          <span class="appt-info-value">${selectedAppointment.insurance || 'Direct Cash / Non-insured'}</span>
          <span class="appt-info-sub">Coverage: 80% Co-pay verified</span>
        </div>
      </div>
    `;
  } else if (tab === 'history') {
    container.innerHTML = `
      <div class="appt-info-block" style="grid-column:span 2;">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 14 14"/></svg>
        <div class="appt-info-text">
          <span class="appt-info-label">Prior Visits (Last 6 Months)</span>
          <span class="appt-info-value">3 Completed Appointments</span>
          <span class="appt-info-sub">12 Oct 2024: Cardiology Routine Checkup</span>
          <span class="appt-info-sub">28 Aug 2024: General Consultation & Lab</span>
        </div>
      </div>
    `;
  } else if (tab === 'notes') {
    container.innerHTML = `
      <div class="appt-info-block" style="grid-column:span 2;">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
        <div class="appt-info-text">
          <span class="appt-info-label">Physician Clinical Notes</span>
          <span class="appt-info-value" style="font-weight:400; font-size:13px; line-height:1.5;">${selectedAppointment.notes}</span>
          <span class="appt-info-sub" style="margin-top:6px;">Room Assigned: ${selectedAppointment.room || 'General Clinic'}</span>
        </div>
      </div>
    `;
  }
}

/* =============================================================================
   7. VIEW MODE SWITCHER (Calendar View vs List View)
   ============================================================================= */
function switchScheduleView(mode, btn) {
  currentViewMode = mode;
  document.querySelectorAll('.schedule-view-tabs .view-tab-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');

  const calContainer = document.getElementById('calendarGridContainer');
  const listContainer = document.getElementById('listViewContainer');

  if (mode === 'calendar') {
    if (calContainer) calContainer.style.display = 'block';
    if (listContainer) listContainer.style.display = 'none';
  } else {
    if (calContainer) calContainer.style.display = 'none';
    if (listContainer) {
      listContainer.style.display = 'flex';
      renderListView();
    }
  }
}

function renderListView() {
  const container = document.getElementById('listViewContainer');
  if (!container) return;

  const filtered = getFilteredAppointments();

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="empty-state-card" style="padding:48px 24px; text-align:center; background:#FFFFFF; border:1px solid var(--border-light); border-radius:12px;">
        <svg viewBox="0 0 24 24" fill="none" stroke="#94A3B8" stroke-width="1.8" width="48" height="48" style="margin-bottom:12px;">
          <rect width="18" height="18" x="3" y="4" rx="2" ry="2"/>
          <line x1="16" y1="2" x2="16" y2="6"/>
          <line x1="8" y1="2" x2="8" y2="6"/>
          <line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
        <h4 style="margin:0 0 6px 0; color:var(--text-dark); font-size:16px;">No appointments match current filters</h4>
        <p style="margin:0; color:var(--text-muted); font-size:13px;">Try resetting the department, doctor, or status filter.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div style="background:#FFFFFF; border:1px solid var(--border-light); border-radius:12px; overflow:hidden;">
      <table style="width:100%; border-collapse:collapse; font-size:13px; text-align:left;">
        <thead>
          <tr style="background:#F8FAFC; border-bottom:1px solid var(--border-light); color:var(--text-muted); font-weight:600;">
            <th style="padding:12px 16px;">Time</th>
            <th style="padding:12px 16px;">Patient</th>
            <th style="padding:12px 16px;">Doctor & Department</th>
            <th style="padding:12px 16px;">Type</th>
            <th style="padding:12px 16px;">Status</th>
            <th style="padding:12px 16px;">Actions</th>
          </tr>
        </thead>
        <tbody>
          ${filtered.map(appt => `
            <tr style="border-bottom:1px solid #F1F5F9; transition:background 0.15s ease;" onmouseenter="this.style.background='#F8FAFC'" onmouseleave="this.style.background='transparent'">
              <td style="padding:12px 16px; font-weight:600; color:var(--text-dark);">${appt.timeShort}</td>
              <td style="padding:12px 16px;">
                <div style="font-weight:600; color:var(--text-dark);">${appt.patientName}</div>
                <div style="font-size:12px; color:var(--text-muted);">${appt.patientPhone}</div>
              </td>
              <td style="padding:12px 16px;">
                <div style="font-weight:600; color:var(--text-dark);">${appt.doctor}</div>
                <div style="font-size:12px; color:var(--brand-primary);">${appt.doctorDept}</div>
              </td>
              <td style="padding:12px 16px; color:var(--text-dark);">${appt.type}</td>
              <td style="padding:12px 16px;">
                <span class="status-pill status-${appt.status.toLowerCase().replace(' ', '')}">• ${appt.status}</span>
              </td>
              <td style="padding:12px 16px;">
                <button class="btn-primary-outline" style="padding:5px 10px; font-size:12px;" onclick="selectScheduleSlot(${appt.id}); switchScheduleView('calendar', document.getElementById('tabCalendarView'));">View</button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

/* =============================================================================
   8. INTERVAL & DATE SHIFTING
   ============================================================================= */
function switchInterval(interval, btn) {
  currentInterval = interval;
  document.querySelectorAll('.segmented-pill-group .seg-pill-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');

  const heading = document.getElementById('scheduleDayHeading');
  if (interval === 'day') {
    heading.textContent = 'Thursday, 14 November 2024';
  } else if (interval === 'week') {
    heading.textContent = 'Week 46 (10 Nov 2024 – 16 Nov 2024)';
  } else if (interval === 'month') {
    heading.textContent = 'November 2024 Schedule Overview';
  }
  showToast(`Switched view to ${interval.toUpperCase()} mode.`, 'info');
}

function goToTodaySchedule() {
  currentDateOffset = 0;
  currentActiveDayNumber = 14;
  updateDateHeading();
  highlightCalendarDay(14);
  showToast('Returned to Today (14 Nov 2024).', 'info');
}

function shiftScheduleDate(delta) {
  currentDateOffset += delta;
  currentActiveDayNumber = Math.max(1, Math.min(30, currentActiveDayNumber + delta));
  updateDateHeading();
  highlightCalendarDay(currentActiveDayNumber);
}

function updateDateHeading() {
  const heading = document.getElementById('scheduleDayHeading');
  const pillText = document.getElementById('activeDatePillText');
  const baseDate = new Date(2024, 10, 14); // 14 Nov 2024
  baseDate.setDate(baseDate.getDate() + currentDateOffset);

  const options = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
  const formatted = baseDate.toLocaleDateString('en-GB', options);
  const shortFormatted = baseDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

  if (heading) heading.textContent = formatted;
  if (pillText) pillText.textContent = shortFormatted;

  // Sync live availability for newly selected date
  syncLiveAvailability();
}

function shiftMiniMonth(delta) {
  const monthTitle = document.querySelector('.mini-cal-month-title');
  if (!monthTitle) return;
  if (delta > 0) {
    monthTitle.textContent = 'December 2024';
  } else {
    monthTitle.textContent = 'October 2024';
  }
  showToast(`Navigated calendar to ${monthTitle.textContent}`, 'info');
}

function selectCalendarDay(day, el) {
  currentActiveDayNumber = day;
  currentDateOffset = day - 14;
  highlightCalendarDay(day);
  updateDateHeading();
  showToast(`Selected date: ${day} Nov 2024`, 'info');
}

function highlightCalendarDay(day) {
  document.querySelectorAll('.mini-cal-grid .mini-day-cell').forEach(cell => {
    cell.classList.remove('active-day');
    if (parseInt(cell.textContent.trim()) === day && !cell.classList.contains('inactive-month')) {
      cell.classList.add('active-day');
    }
  });
}

/* =============================================================================
   8.5 LIVE FASTAPI CATALOG & AVAILABILITY SYNC
   ============================================================================= */
let liveDoctorsCache = [];
let liveSpecialtiesCache = [];

function getSelectedDateIso() {
  const baseDate = new Date(2024, 10, 14); // 14 Nov 2024
  baseDate.setDate(baseDate.getDate() + currentDateOffset);
  const yyyy = baseDate.getFullYear();
  const mm = String(baseDate.getMonth() + 1).padStart(2, '0');
  const dd = String(baseDate.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

async function loadLiveCatalog() {
  if (!window.ClinicApi) return;
  try {
    const [specData, docData, apptData] = await Promise.all([
      ClinicApi.getSpecialties().catch(e => {
        console.debug('[ClinicApi] Specialties fetch error:', e.message);
        return [];
      }),
      ClinicApi.getDoctors({ limit: 50 }).catch(e => {
        console.debug('[ClinicApi] Doctors fetch error:', e.message);
        return { total: 0, doctors: [] };
      }),
      ClinicApi.getAppointments().catch(e => {
        console.debug('[ClinicApi] Appointments fetch error:', e.message);
        return { total: 0, appointments: [] };
      })
    ]);

    if (Array.isArray(specData) && specData.length > 0) {
      liveSpecialtiesCache = specData;
      populateSpecialtiesFilter(specData);
    }

    if (docData && Array.isArray(docData.doctors) && docData.doctors.length > 0) {
      liveDoctorsCache = docData.doctors;
      populateDoctorsFilter(docData.doctors);
      updateDoctorScheduleColumns(docData.doctors);
    }

    if (apptData && Array.isArray(apptData.appointments) && apptData.appointments.length > 0) {
      appointmentsData = apptData.appointments;
      saveAppointmentsStore();
    }

    renderScheduleGrid();
    if (appointmentsData.length > 0 && (!selectedAppointment || !appointmentsData.some(a => a.id === selectedAppointment.id))) {
      selectScheduleSlot(appointmentsData[0].id, null);
    }

    // Sync live availability for the currently selected date
    syncLiveAvailability();
  } catch (err) {
    console.warn('[ClinicApi] Live catalog sync warning:', err.message);
  }
}

function populateSpecialtiesFilter(specialties) {
  const select = document.getElementById('deptSelectFilter');
  if (!select) return;
  const currentVal = select.value;

  select.innerHTML = '<option value="All Departments">All Departments</option>';
  specialties.forEach(spec => {
    const opt = document.createElement('option');
    opt.value = spec.name_en;
    opt.textContent = `${spec.name_en} (${spec.name_ar})`;
    select.appendChild(opt);
  });

  if (currentVal && Array.from(select.options).some(o => o.value === currentVal)) {
    select.value = currentVal;
  }
}

function populateDoctorsFilter(doctors) {
  const select = document.getElementById('doctorSelectFilter');
  if (!select) return;
  const currentVal = select.value;

  select.innerHTML = '<option value="All Doctors">All Doctors</option>';
  doctors.forEach(doc => {
    const opt = document.createElement('option');
    opt.value = doc.name_en;
    const spec = liveSpecialtiesCache.find(s => s.id === doc.specialty_id);
    const deptName = doc.specialty?.name_en || (spec ? spec.name_en : doc.title_en || 'Consultant');
    opt.textContent = `${doc.name_en} (${deptName})`;
    select.appendChild(opt);
  });

  if (currentVal && Array.from(select.options).some(o => o.value === currentVal)) {
    select.value = currentVal;
  }
}

function updateDoctorScheduleColumns(doctors) {
  const table = document.querySelector('.doctor-schedule-table');
  if (!table) return;

  const thElements = table.querySelectorAll('thead th');
  // First th is "Time" column, remaining th are doctors
  doctors.slice(0, 5).forEach((doc, idx) => {
    const th = thElements[idx + 1];
    if (!th) return;

    const nameEl = th.querySelector('.doctor-header-name');
    const deptEl = th.querySelector('.doctor-header-dept');
    const avatarEl = th.querySelector('.doctor-header-avatar');

    const spec = liveSpecialtiesCache.find(s => s.id === doc.specialty_id);
    const deptName = doc.specialty?.name_en || (spec ? spec.name_en : 'Consultant');

    if (nameEl) nameEl.textContent = doc.name_en;
    if (deptEl) deptEl.textContent = deptName;
    if (avatarEl) {
      const cleanName = doc.name_en.replace(/Dr\.\s*/i, '');
      const initials = cleanName.split(' ').map(p => p.charAt(0)).join('').slice(0, 2).toUpperCase();
      avatarEl.textContent = initials || 'DR';
    }
  });

  // Map appointmentsData to match real doctors
  if (Array.isArray(appointmentsData)) {
    appointmentsData.forEach((appt, idx) => {
      const doc = doctors[idx % doctors.length];
      if (doc) {
        const spec = liveSpecialtiesCache.find(s => s.id === doc.specialty_id);
        appt.doctor = doc.name_en;
        appt.doctorDept = doc.specialty?.name_en || (spec ? spec.name_en : appt.doctorDept);
      }
    });
  }

  // Update Right Panel Upcoming Agenda
  const upcomingDocs = document.querySelectorAll('.upcoming-doctor-text');
  const upcomingDepts = document.querySelectorAll('.upcoming-dept-text');
  upcomingDocs.forEach((el, idx) => {
    const doc = doctors[idx % doctors.length];
    if (doc) {
      el.textContent = doc.name_en;
      const spec = liveSpecialtiesCache.find(s => s.id === doc.specialty_id);
      if (upcomingDepts[idx]) {
        upcomingDepts[idx].textContent = doc.specialty?.name_en || (spec ? spec.name_en : 'Consultant');
      }
    }
  });

  // Update active selected appointment card if displayed
  const apptDoctorField = document.getElementById('apptFieldDoctor');
  const apptDeptField = document.getElementById('apptFieldDept');
  if (apptDoctorField && doctors[0]) {
    apptDoctorField.textContent = doctors[0].name_en;
    if (apptDeptField) {
      const spec = liveSpecialtiesCache.find(s => s.id === doctors[0].specialty_id);
      apptDeptField.textContent = doctors[0].specialty?.name_en || (spec ? spec.name_en : 'Cardiology');
    }
  }
}

async function syncLiveAvailability() {
  if (!window.ClinicApi) return;
  const dateIso = getSelectedDateIso();

  try {
    const result = await ClinicApi.searchAvailability(dateIso, 20);
    if (result && Array.isArray(result.slots) && result.slots.length > 0) {
      console.info(`[ClinicApi] Found ${result.slots.length} available slots for ${dateIso}`);
      const pill = document.getElementById('activeDatePillText');
      if (pill) {
        pill.title = `${result.slots.length} live available slots synced from FastAPI backend.`;
      }
    }
  } catch (err) {
    console.debug(`[ClinicApi] Availability endpoint for ${dateIso}:`, err.message);
  }
}

/* =============================================================================
   9. SCHEDULE FILTERING
   ============================================================================= */
function getFilteredAppointments() {
  const deptVal = document.getElementById('deptSelectFilter') ? document.getElementById('deptSelectFilter').value : 'All Departments';
  const doctorVal = document.getElementById('doctorSelectFilter') ? document.getElementById('doctorSelectFilter').value : 'All Doctors';
  const statusVal = document.getElementById('statusSelectFilter') ? document.getElementById('statusSelectFilter').value : 'All Statuses';
  const branchVal = document.getElementById('branchSelectFilter') ? document.getElementById('branchSelectFilter').value : 'All Branches';

  return appointmentsData.filter(appt => {
    const matchDept = (deptVal === 'All Departments' || appt.doctorDept === deptVal);
    const matchDoc = (doctorVal === 'All Doctors' || appt.doctor === doctorVal);
    const matchStatus = (statusVal === 'All Statuses' || appt.status === statusVal);
    const matchBranch = (branchVal === 'All Branches' || appt.branch.includes(branchVal));
    return matchDept && matchDoc && matchStatus && matchBranch;
  });
}

function filterSchedule() {
  const filtered = getFilteredAppointments();
  const allCards = document.querySelectorAll('.doctor-schedule-table .appt-slot-card');

  // Filter in Calendar View: hide or dim slots not matching
  allCards.forEach(card => {
    const onclickAttr = card.getAttribute('onclick') || '';
    const match = onclickAttr.match(/selectScheduleSlot\((\d+)/);
    if (match) {
      const id = parseInt(match[1]);
      const isVisible = filtered.some(a => a.id === id);
      if (isVisible) {
        card.style.display = 'block';
        card.style.opacity = '1';
      } else {
        card.style.display = 'none';
      }
    }
  });

  if (currentViewMode === 'list') {
    renderListView();
  }

  showToast(`Filtered: ${filtered.length} appointment(s) matching criteria.`, 'info');
}

function handleSearchAppointments(term) {
  if (!term) {
    document.querySelectorAll('.doctor-schedule-table .appt-slot-card').forEach(c => c.style.display = 'block');
    return;
  }
  document.querySelectorAll('.doctor-schedule-table .appt-slot-card').forEach(card => {
    const text = card.textContent.toLowerCase();
    if (text.includes(term)) {
      card.style.display = 'block';
      card.style.boxShadow = '0 0 0 2px var(--brand-primary)';
    } else {
      card.style.display = 'none';
      card.style.boxShadow = 'none';
    }
  });
}

/* =============================================================================
   10. METRICS COUNTER UPDATES
   ============================================================================= */
let metricsState = {
  total: 0,
  confirmed: 0,
  pending: 0,
  cancelled: 0
};

function updateMetricsDisplay() {
  const totalEl = document.getElementById('metricTodayCount');
  const confEl = document.getElementById('metricConfirmedCount');
  const pendEl = document.getElementById('metricPendingCount');
  const cancEl = document.getElementById('metricCancelledCount');

  if (totalEl) totalEl.textContent = metricsState.total;
  if (confEl) confEl.textContent = metricsState.confirmed;
  if (pendEl) pendEl.textContent = metricsState.pending;
  if (cancEl) cancEl.textContent = metricsState.cancelled;
}

/* =============================================================================
   11. MODAL DIALOGS
   ============================================================================= */

let livePatientsCache = [];

window.handleSelectRegisteredPatient = function(selectEl) {
  const selectedOpt = selectEl.options[selectEl.selectedIndex];
  if (!selectedOpt || !selectedOpt.value) return;

  const name = selectedOpt.getAttribute('data-name');
  const phone = selectedOpt.getAttribute('data-phone');
  const code = selectedOpt.getAttribute('data-code');

  const nameInput = document.getElementById('newPatientName');
  const phoneInput = document.getElementById('newPatientPhone');
  const codeInput = document.getElementById('newPatientCode');

  if (nameInput && name) nameInput.value = name;
  if (phoneInput && phone) phoneInput.value = phone;
  if (codeInput && code) codeInput.value = code;

  if (typeof showToast === 'function') {
    showToast(`Linked patient: ${name} (ID: ${code})`, 'success');
  }
};

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
window.escapeHtml = escapeHtml;

// Open New Appointment Modal
async function openNewAppointmentModal() {
  if (!livePatientsCache || livePatientsCache.length === 0) {
    if (window.ClinicApi) {
      try {
        const res = await window.ClinicApi.getPatients();
        if (res && Array.isArray(res.patients)) livePatientsCache = res.patients;
      } catch (_) {}
    }
  }

  if (!liveDoctorsCache || liveDoctorsCache.length === 0) {
    if (window.ClinicApi) {
      try {
        const dRes = await window.ClinicApi.getDoctors({ limit: 50 });
        if (dRes && Array.isArray(dRes.doctors)) liveDoctorsCache = dRes.doctors;
      } catch (_) {}
    }
  }

  let patientOptions = '<option value="">-- Choose Existing Patient (or enter new below) --</option>';
  if (Array.isArray(livePatientsCache) && livePatientsCache.length > 0) {
    patientOptions += livePatientsCache.map(p => {
      const code = p.customer_number || p.patientCode || String(p.id || '');
      const pName = p.full_name || p.name || 'Patient';
      const pPhone = p.phone || '';
      return `<option value="${p.id}" data-name="${escapeHtml(pName)}" data-phone="${escapeHtml(pPhone)}" data-code="${escapeHtml(code)}">${escapeHtml(pName)} (${escapeHtml(pPhone || 'No phone')}) — ID: ${escapeHtml(code)}</option>`;
    }).join('');
  }

  let doctorOptions = '';
  if (Array.isArray(liveDoctorsCache) && liveDoctorsCache.length > 0) {
    doctorOptions = liveDoctorsCache.map(doc => {
      const spec = liveSpecialtiesCache.find(s => s.id === doc.specialty_id);
      const dept = doc.specialty?.name_en || (spec ? spec.name_en : doc.title_en || 'General Medicine');
      return `<option value="${escapeHtml(doc.name_en)}|${escapeHtml(dept)}|${doc.id}">${escapeHtml(doc.name_en)} (${escapeHtml(dept)})</option>`;
    }).join('');
  } else {
    doctorOptions = `
      <option value="Dr. Ahmed Mohamed|Cardiology">Dr. Ahmed Mohamed (Cardiology)</option>
      <option value="Dr. Sara Elsayed|Dermatology">Dr. Sara Elsayed (Dermatology)</option>
      <option value="Dr. Mohamed Ali|Orthopedics">Dr. Mohamed Ali (Orthopedics)</option>
      <option value="Dr. Mona Khaled|Pediatrics">Dr. Mona Khaled (Pediatrics)</option>
      <option value="Dr. Youssef Hassan|ENT">Dr. Youssef Hassan (ENT)</option>
    `;
  }

  const todayIso = new Date().toISOString().slice(0, 10);

  const bodyHtml = `
    <form id="newApptForm" onsubmit="event.preventDefault(); submitNewAppointment();" style="display:flex; flex-direction:column; gap:14px;">
      
      <div style="background: #F0FDF4; border: 1px solid #BBF7D0; border-radius: 8px; padding: 12px;">
        <label style="display: flex; align-items: center; justify-content: space-between; font-size: 12px; font-weight: 700; color: #166534; margin-bottom: 6px;">
          <span>⚡ Link Registered Patient (Supabase DB)</span>
          <span style="font-size: 11px; font-weight: 500; color: #15803D;">Auto-fills details below</span>
        </label>
        <select id="selectRegisteredPatient" onchange="handleSelectRegisteredPatient(this)" style="width: 100%; height: 38px; border: 1px solid #86EFAC; border-radius: 6px; padding: 0 10px; font-size: 13px; background: #FFFFFF; font-family: inherit; color: #1E293B;">
          ${patientOptions}
        </select>
      </div>

      <div>
        <label style="display:block; font-size:12px; font-weight:600; color:var(--text-dark); margin-bottom:4px;">Patient Full Name *</label>
        <input type="text" id="newPatientName" placeholder="e.g. Hassan Metwaly" required style="width:100%; padding:9px 12px; border:1px solid var(--border-light); border-radius:8px; font-size:13px; font-family:inherit;">
      </div>
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
        <div>
          <label style="display:block; font-size:12px; font-weight:600; color:var(--text-dark); margin-bottom:4px;">Phone Number *</label>
          <input type="tel" id="newPatientPhone" placeholder="+20 100 000 0000" required style="width:100%; padding:9px 12px; border:1px solid var(--border-light); border-radius:8px; font-size:13px; font-family:inherit;">
        </div>
        <div>
          <label style="display:block; font-size:12px; font-weight:600; color:var(--text-dark); margin-bottom:4px;">Patient ID (Optional)</label>
          <input type="text" id="newPatientCode" placeholder="PT-2026-XXX" style="width:100%; padding:9px 12px; border:1px solid var(--border-light); border-radius:8px; font-size:13px; font-family:inherit;">
        </div>
      </div>
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
        <div>
          <label style="display:block; font-size:12px; font-weight:600; color:var(--text-dark); margin-bottom:4px;">Doctor (Database) *</label>
          <select id="newApptDoctor" style="width:100%; padding:9px 12px; border:1px solid var(--border-light); border-radius:8px; font-size:13px; font-family:inherit; background:#FFF;">
            ${doctorOptions}
          </select>
        </div>
        <div>
          <label style="display:block; font-size:12px; font-weight:600; color:var(--text-dark); margin-bottom:4px;">Appointment Type</label>
          <select id="newApptType" style="width:100%; padding:9px 12px; border:1px solid var(--border-light); border-radius:8px; font-size:13px; font-family:inherit; background:#FFF;">
            <option value="Consultation">Consultation</option>
            <option value="Follow-up">Follow-up</option>
            <option value="New Patient">New Patient</option>
            <option value="Urgent">Urgent / Emergency</option>
          </select>
        </div>
      </div>
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
        <div>
          <label style="display:block; font-size:12px; font-weight:600; color:var(--text-dark); margin-bottom:4px;">Date *</label>
          <input type="date" id="newApptDate" value="${todayIso}" style="width:100%; padding:9px 12px; border:1px solid var(--border-light); border-radius:8px; font-size:13px; font-family:inherit;">
        </div>
        <div>
          <label style="display:block; font-size:12px; font-weight:600; color:var(--text-dark); margin-bottom:4px;">Time Slot *</label>
          <select id="newApptTime" style="width:100%; padding:9px 12px; border:1px solid var(--border-light); border-radius:8px; font-size:13px; font-family:inherit; background:#FFF;">
            <option value="09:00">09:00 AM</option>
            <option value="09:30">09:30 AM</option>
            <option value="10:00">10:00 AM</option>
            <option value="10:30">10:30 AM</option>
            <option value="11:00">11:00 AM</option>
            <option value="11:30">11:30 AM</option>
            <option value="12:00">12:00 PM</option>
            <option value="12:30">12:30 PM</option>
            <option value="13:00">01:00 PM</option>
            <option value="13:30">01:30 PM</option>
            <option value="14:00">02:00 PM</option>
            <option value="14:30">02:30 PM</option>
            <option value="15:00">03:00 PM</option>
            <option value="15:30">03:30 PM</option>
            <option value="16:00">04:00 PM</option>
            <option value="16:30">04:30 PM</option>
            <option value="17:00">05:00 PM</option>
          </select>
        </div>
      </div>
      <div>
        <label style="display:block; font-size:12px; font-weight:600; color:var(--text-dark); margin-bottom:4px;">Clinical Notes / Chief Complaint</label>
        <textarea id="newApptNotes" rows="2" placeholder="Brief clinical summary or reason for visit..." style="width:100%; padding:9px 12px; border:1px solid var(--border-light); border-radius:8px; font-size:13px; font-family:inherit; resize:vertical;"></textarea>
      </div>
    </form>
  `;

  const footerHtml = `
    <button type="button" class="modal-btn-secondary" onclick="closeAdminModal()">Cancel</button>
    <button type="button" class="modal-btn-primary" onclick="submitNewAppointment()">Confirm Booking</button>
  `;

  openAdminModal('Schedule New Appointment', bodyHtml, footerHtml);
}

async function submitNewAppointment() {
  const selectPat = document.getElementById('selectRegisteredPatient');
  const selectedPatientId = selectPat ? selectPat.value : null;

  const name = document.getElementById('newPatientName').value.trim();
  const phone = document.getElementById('newPatientPhone').value.trim();
  const code = document.getElementById('newPatientCode').value.trim();
  const docVal = document.getElementById('newApptDoctor').value.split('|');
  const doctor = docVal[0];
  const dept = docVal[1] || 'General';
  const docId = docVal[2] ? parseInt(docVal[2], 10) : null;
  const type = document.getElementById('newApptType').value;
  const dateVal = document.getElementById('newApptDate').value;
  const time = document.getElementById('newApptTime').value;
  const notes = document.getElementById('newApptNotes').value.trim();

  if (!name || !phone) {
    alert('Please provide patient name and contact phone number.');
    return;
  }

  // Validate Friday closure
  if (dateVal) {
    const d = new Date(dateVal + 'T00:00:00');
    if (d.getDay() === 5) {
      alert('The clinic is closed on Fridays. Please choose another date.');
      return;
    }
  }

  const payload = {
    patient_id: selectedPatientId ? parseInt(selectedPatientId, 10) : undefined,
    patient_name: name,
    patient_phone: phone,
    doctor_id: docId || undefined,
    doctor: doctor,
    appointment_date: dateVal,
    start_time: time,
    type: type,
    visit_reason: notes || type || 'General Consultation'
  };

  try {
    if (window.ClinicApi) {
      const created = await window.ClinicApi.createAppointment(payload);
      closeAdminModal();
      showToast(`Successfully scheduled appointment in Supabase for ${name} with ${doctor}.`, 'success');
      await loadLiveCatalog();
      if (created && created.id) {
        selectScheduleSlot(created.id, null);
      }
    } else {
      closeAdminModal();
    }
  } catch (err) {
    console.error('[Appointments] Booking error:', err);
    alert('Failed to schedule appointment: ' + (err.message || 'Database error'));
  }
}

// Reschedule Modal
function openRescheduleModal() {
  if (!selectedAppointment) return;

  const todayIso = new Date().toISOString().slice(0, 10);

  const bodyHtml = `
    <div style="display:flex; flex-direction:column; gap:14px;">
      <div style="background:#F8FAFC; border:1px solid var(--border-light); border-radius:8px; padding:12px;">
        <div style="font-weight:700; color:var(--text-dark);">${selectedAppointment.patientName} (${selectedAppointment.patientCode})</div>
        <div style="font-size:12px; color:var(--text-muted); margin-top:2px;">Currently with ${selectedAppointment.doctor} at ${selectedAppointment.time}</div>
      </div>
      <div>
        <label style="display:block; font-size:12px; font-weight:600; color:var(--text-dark); margin-bottom:4px;">New Target Date</label>
        <input type="date" id="reschedDate" value="${todayIso}" style="width:100%; padding:9px 12px; border:1px solid var(--border-light); border-radius:8px; font-size:13px; font-family:inherit;">
      </div>
      <div>
        <label style="display:block; font-size:12px; font-weight:600; color:var(--text-dark); margin-bottom:4px;">New Time Slot</label>
        <select id="reschedTime" style="width:100%; padding:9px 12px; border:1px solid var(--border-light); border-radius:8px; font-size:13px; font-family:inherit; background:#FFF;">
          <option value="09:00">09:00 AM - 09:30 AM</option>
          <option value="09:30">09:30 AM - 10:00 AM</option>
          <option value="10:00">10:00 AM - 10:30 AM</option>
          <option value="10:30">10:30 AM - 11:00 AM</option>
          <option value="11:00">11:00 AM - 11:30 AM</option>
          <option value="11:30">11:30 AM - 12:00 PM</option>
          <option value="12:00">12:00 PM - 12:30 PM</option>
          <option value="12:30">12:30 PM - 01:00 PM</option>
          <option value="13:00">01:00 PM - 01:30 PM</option>
          <option value="13:30">01:30 PM - 02:00 PM</option>
          <option value="14:00">02:00 PM - 02:30 PM</option>
          <option value="14:30">02:30 PM - 03:00 PM</option>
          <option value="15:00">03:00 PM - 03:30 PM</option>
          <option value="15:30">03:30 PM - 04:00 PM</option>
          <option value="16:00">04:00 PM - 04:30 PM</option>
          <option value="16:30">04:30 PM - 05:00 PM</option>
        </select>
      </div>
      <div>
        <label style="display:block; font-size:12px; font-weight:600; color:var(--text-dark); margin-bottom:4px;">Reason for Rescheduling</label>
        <select id="reschedReason" style="width:100%; padding:9px 12px; border:1px solid var(--border-light); border-radius:8px; font-size:13px; font-family:inherit; background:#FFF;">
          <option value="Patient requested new time">Patient requested new time</option>
          <option value="Physician surgical schedule conflict">Physician surgical schedule conflict</option>
          <option value="Lab results delayed">Lab results delayed</option>
          <option value="Weather / Transit emergency">Weather / Transit emergency</option>
        </select>
      </div>
    </div>
  `;

  const footerHtml = `
    <button class="modal-btn-secondary" onclick="closeAdminModal()">Keep Current</button>
    <button class="modal-btn-primary" onclick="confirmRescheduleAppointment()">Save Rescheduled Slot</button>
  `;

  openAdminModal('Reschedule Appointment', bodyHtml, footerHtml);
}

async function confirmRescheduleAppointment() {
  const newDate = document.getElementById('reschedDate').value;
  const newTime = document.getElementById('reschedTime').value;
  const reason = document.getElementById('reschedReason').value;

  if (!selectedAppointment) return;

  try {
    if (window.ClinicApi) {
      await window.ClinicApi.rescheduleAppointment(selectedAppointment.id, {
        appointment_date: newDate,
        start_time: newTime,
        reason: reason
      });
      closeAdminModal();
      showToast(`Appointment rescheduled to ${newDate} (${newTime}).`, 'success');
      await loadLiveCatalog();
    }
  } catch (err) {
    console.error('[Appointments] Reschedule error:', err);
    alert('Failed to reschedule appointment: ' + (err.message || 'Database error'));
  }
}

// Cancel Appointment
async function handleCancelAppointment() {
  if (!selectedAppointment) return;

  if (confirm(`Are you sure you want to cancel the appointment for ${selectedAppointment.patientName} on ${selectedAppointment.date}?`)) {
    try {
      if (window.ClinicApi) {
        await window.ClinicApi.cancelAppointment(selectedAppointment.id, {
          reason: 'Cancelled by operator'
        });
        showToast(`Appointment #${selectedAppointment.id} for ${selectedAppointment.patientName} marked as Cancelled.`, 'warning');
        await loadLiveCatalog();
      }
    } catch (err) {
      console.error('[Appointments] Cancellation error:', err);
      alert('Failed to cancel appointment: ' + (err.message || 'Database error'));
    }
  }
}

// Start Call With Patient
function handleStartCallWithPatient() {
  if (!selectedAppointment) return;

  showToast(`Initiating direct audio call with ${selectedAppointment.patientName} (${selectedAppointment.patientPhone})...`, 'info');
  setTimeout(() => {
    window.location.href = `live-calls.html?caller=${encodeURIComponent(selectedAppointment.patientName)}&phone=${encodeURIComponent(selectedAppointment.patientPhone)}`;
  }, 1200);
}

// Export Appointments
function handleExportAppointments() {
  const rows = [
    ["ID", "Patient Name", "Phone", "Doctor", "Department", "Date", "Time", "Status", "Type"]
  ];

  appointmentsData.forEach(a => {
    rows.push([
      a.id,
      `"${a.patientName}"`,
      `"${a.patientPhone}"`,
      `"${a.doctor}"`,
      `"${a.doctorDept}"`,
      `"${a.date}"`,
      `"${a.time}"`,
      `"${a.status}"`,
      `"${a.type}"`
    ]);
  });

  const csvContent = "data:text/csv;charset=utf-8," + rows.map(e => e.join(",")).join("\n");
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `nile_clinics_appointments_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  showToast('Appointments schedule exported successfully as CSV.', 'success');
}

// Open All Upcoming Modal
function openAllUpcomingModal() {
  const bodyHtml = `
    <div style="display:flex; flex-direction:column; gap:10px; max-height:420px; overflow-y:auto; padding-right:4px;">
      ${appointmentsData.slice(0, 8).map(a => `
        <div style="display:flex; align-items:center; justify-content:space-between; padding:10px 14px; background:#F8FAFC; border:1px solid var(--border-light); border-radius:8px;">
          <div>
            <div style="font-weight:700; color:var(--text-dark); font-size:13px;">${a.patientName}</div>
            <div style="font-size:12px; color:var(--text-muted);">${a.time} • ${a.doctor} (${a.doctorDept})</div>
          </div>
          <span class="status-pill status-${a.status.toLowerCase().replace(' ', '')}">• ${a.status}</span>
        </div>
      `).join('')}
    </div>
  `;

  const footerHtml = `
    <button class="modal-btn-secondary" onclick="closeAdminModal()">Close</button>
  `;

  openAdminModal('All Upcoming Queue Today', bodyHtml, footerHtml);
}

// Edit Selected Appointment Modal
function openEditSelectedApptModal() {
  if (!selectedAppointment) return;

  const bodyHtml = `
    <div style="display:flex; flex-direction:column; gap:12px;">
      <div>
        <label style="display:block; font-size:12px; font-weight:600; color:var(--text-dark); margin-bottom:4px;">Patient Name</label>
        <input type="text" id="editApptName" value="${selectedAppointment.patientName}" style="width:100%; padding:9px 12px; border:1px solid var(--border-light); border-radius:8px; font-size:13px; font-family:inherit;">
      </div>
      <div>
        <label style="display:block; font-size:12px; font-weight:600; color:var(--text-dark); margin-bottom:4px;">Phone Number</label>
        <input type="tel" id="editApptPhone" value="${selectedAppointment.patientPhone}" style="width:100%; padding:9px 12px; border:1px solid var(--border-light); border-radius:8px; font-size:13px; font-family:inherit;">
      </div>
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
        <div>
          <label style="display:block; font-size:12px; font-weight:600; color:var(--text-dark); margin-bottom:4px;">Status</label>
          <select id="editApptStatus" style="width:100%; padding:9px 12px; border:1px solid var(--border-light); border-radius:8px; font-size:13px; font-family:inherit; background:#FFF;">
            <option value="Confirmed" ${selectedAppointment.status === 'Confirmed' ? 'selected' : ''}>Confirmed</option>
            <option value="Pending" ${selectedAppointment.status === 'Pending' ? 'selected' : ''}>Pending</option>
            <option value="In Clinic" ${selectedAppointment.status === 'In Clinic' ? 'selected' : ''}>In Clinic</option>
            <option value="Cancelled" ${selectedAppointment.status === 'Cancelled' ? 'selected' : ''}>Cancelled</option>
          </select>
        </div>
        <div>
          <label style="display:block; font-size:12px; font-weight:600; color:var(--text-dark); margin-bottom:4px;">Type</label>
          <select id="editApptType" style="width:100%; padding:9px 12px; border:1px solid var(--border-light); border-radius:8px; font-size:13px; font-family:inherit; background:#FFF;">
            <option value="Follow-up" ${selectedAppointment.type === 'Follow-up' ? 'selected' : ''}>Follow-up</option>
            <option value="Consultation" ${selectedAppointment.type === 'Consultation' ? 'selected' : ''}>Consultation</option>
            <option value="New Patient" ${selectedAppointment.type === 'New Patient' ? 'selected' : ''}>New Patient</option>
          </select>
        </div>
      </div>
      <div>
        <label style="display:block; font-size:12px; font-weight:600; color:var(--text-dark); margin-bottom:4px;">Clinical Notes</label>
        <textarea id="editApptNotes" rows="3" style="width:100%; padding:9px 12px; border:1px solid var(--border-light); border-radius:8px; font-size:13px; font-family:inherit; resize:vertical;">${selectedAppointment.notes || ''}</textarea>
      </div>
    </div>
  `;

  const footerHtml = `
    <button class="modal-btn-secondary" onclick="closeAdminModal()">Cancel</button>
    <button class="modal-btn-primary" onclick="saveEditedAppointment()">Save Changes</button>
  `;

  openAdminModal('Edit Appointment', bodyHtml, footerHtml);
}

function saveEditedAppointment() {
  if (!selectedAppointment) return;

  selectedAppointment.patientName = document.getElementById('editApptName').value.trim();
  selectedAppointment.patientPhone = document.getElementById('editApptPhone').value.trim();
  selectedAppointment.status = document.getElementById('editApptStatus').value;
  selectedAppointment.type = document.getElementById('editApptType').value;
  selectedAppointment.notes = document.getElementById('editApptNotes').value.trim();

  updateMetricsDisplay();
  populateAppointmentDetails(selectedAppointment);
  closeAdminModal();
  showToast(`Updated appointment details for ${selectedAppointment.patientName}.`, 'success');
}

/* =============================================================================
   12. BRANCH, NOTIFICATIONS, LOGOUT & GENERAL HELPERS
   ============================================================================= */
function handleBranchChange() {
  const current = document.getElementById('currentBranchName');
  if (!current) return;
  if (current.textContent.includes('Main')) {
    current.textContent = 'Zamalek Branch';
    showToast('Switched administrative view to Zamalek Branch.', 'info');
  } else {
    current.textContent = 'Main Clinic';
    showToast('Switched administrative view to Main Clinic.', 'info');
  }
}

function handleLogout() {
  if (confirm('Are you sure you want to log out of the Clinic Admin Console?')) {
    showToast('Admin logged out successfully.', 'info');
  }
}

function toggleNotifications() {
  showToast('Appointments System: 18 scheduled sessions today, doctor schedules synced.', 'info');
}

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

/**
 * Shiffaa Clinics - Appointments Management Controller
 * Handles Multi-doctor Schedule Grid, Mini-calendar, Agenda List, Filters, 
 * Appointment Details Drawer, and Modals (New Appointment, Reschedule, Cancel, Export).
 */

// Purge legacy mock storage immediately so we only display real Supabase database records
try {
  localStorage.removeItem('nile_clinic_appointments_live_v2');
  localStorage.removeItem('nile_clinic_appointments_store');
  localStorage.removeItem('clinic_admin_appointments_store');
} catch (_) {}

document.addEventListener('DOMContentLoaded', () => {
  // Synchronize doctors count badge from session cache if available
  try {
    const cachedDocCount = sessionStorage.getItem('shiffaa_doctors_count');
    if (cachedDocCount) {
      const badge = document.getElementById('doctorsCountBadge');
      if (badge) badge.textContent = cachedDocCount;
    }
  } catch (_) {}

  initClock();
  initGlobalShortcuts();
  updateDateHeading();
  initAppointmentsStore();
  loadLiveCatalog();
  initRealtimeAppointmentsSync();

  window.addEventListener('clinic-schedule-updated', () => {
    renderSchedule();
    updateDateHeading();
  });
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
let liveDoctorsCache = [];
let liveSpecialtiesCache = [];
let livePatientsCache = [];

let selectedAppointment = null;
let currentViewMode = 'calendar'; // 'calendar' | 'list'
let currentInterval = 'day'; // 'day' | 'week' | 'month'
let selectedDate = new Date(); // Active chosen date (defaults to today)
let miniCalYear = selectedDate.getFullYear();
let miniCalMonth = selectedDate.getMonth();

function saveAppointmentsStore() {
  try {
    localStorage.setItem('nile_clinic_appointments_live_v2', JSON.stringify(appointmentsData));
  } catch (_) {}
}

/* =============================================================================
   DATE & TIME UTILITIES
   ============================================================================= */
function parseApptDate(dateVal) {
  if (!dateVal) return null;
  if (dateVal instanceof Date) return dateVal;
  if (typeof dateVal === 'string') {
    const m = dateVal.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (m) {
      return new Date(parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10));
    }
    const d = new Date(dateVal);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function isSameDay(d1, d2) {
  if (!d1 || !d2) return false;
  return d1.getFullYear() === d2.getFullYear() &&
         d1.getMonth() === d2.getMonth() &&
         d1.getDate() === d2.getDate();
}

function formatDateIso(d) {
  if (!d) return '';
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function isDateInPast(d) {
  if (!d) return false;
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return target < today;
}

function getApptDateTime(appt) {
  if (!appt) return null;
  const d = parseApptDate(appt.appointment_date || appt.date);
  if (!d) return null;
  const tStr = appt.timeShort || appt.time || appt.start_time || '00:00';
  const t24 = parseSlotTo24h(tStr);
  const [h, m] = t24.split(':').map(Number);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), h || 0, m || 0);
}

const SCHEDULE_TIME_SLOTS = [
  '08:00 AM', '08:30 AM', '09:00 AM', '09:30 AM',
  '10:00 AM', '10:30 AM', '11:00 AM', '11:30 AM',
  '12:00 PM', '12:30 PM', '01:00 PM', '01:30 PM',
  '02:00 PM', '02:30 PM', '03:00 PM', '03:30 PM',
  '04:00 PM', '04:30 PM', '05:00 PM', '05:30 PM',
  '06:00 PM', '06:30 PM', '07:00 PM', '07:30 PM',
  '08:00 PM'
];

function parseSlotTo24h(slotTime) {
  if (!slotTime) return '00:00';
  const parts = slotTime.trim().split(/\s+/);
  const timeParts = parts[0].split(':');
  let h = parseInt(timeParts[0], 10);
  const m = timeParts[1] || '00';
  const ampm = (parts[1] || '').toUpperCase();
  if (ampm === 'PM' && h < 12) h += 12;
  if (ampm === 'AM' && h === 12) h = 0;
  return `${String(h).padStart(2, '0')}:${m}`;
}

function matchTimeSlot(appt, slotTime) {
  if (!appt) return false;
  const slot24 = parseSlotTo24h(slotTime);
  const aStart = (appt.start_time || appt.time || appt.timeShort || '').slice(0, 5);
  if (aStart === slot24) return true;
  if (appt.timeShort && appt.timeShort.toUpperCase() === slotTime.toUpperCase()) return true;
  return false;
}

const DAY_NAME_TO_ISO = {
  'monday': 1, 'mon': 1,
  'tuesday': 2, 'tue': 2,
  'wednesday': 3, 'wed': 3,
  'thursday': 4, 'thu': 4,
  'friday': 5, 'fri': 5,
  'saturday': 6, 'sat': 6,
  'sunday': 7, 'sun': 7
};

function getIsoWeekday(date) {
  const day = date.getDay();
  return day === 0 ? 7 : day; // 1=Mon ... 6=Sat, 7=Sun
}

function normalizeDoctorWorkingDays(workingDays) {
  if (!Array.isArray(workingDays) || workingDays.length === 0) return [];
  return workingDays.map(d => {
    if (typeof d === 'number') return d;
    if (typeof d === 'string') {
      const clean = d.trim().toLowerCase();
      return DAY_NAME_TO_ISO[clean] || null;
    }
    return null;
  }).filter(d => d !== null);
}

function isDoctorWorkingOnDate(doc, date) {
  if (!doc) return true;
  const isoDay = getIsoWeekday(date);
  if (isoDay === 5) return false; // Friday is clinic-wide off in Egyptian healthcare & database constraint ck_appointment_weekday!
  if (Array.isArray(doc.working_days) && doc.working_days.length > 0) {
    const normDays = normalizeDoctorWorkingDays(doc.working_days);
    if (normDays.length > 0) {
      return normDays.includes(isoDay);
    }
  }
  return true;
}

function getDoctorShift(doc) {
  if (!doc) return { start: '08:00', end: '17:00' };
  const start = (doc.shift_start || doc.working_hours?.start || '08:00').slice(0, 5);
  const end = (doc.shift_end || doc.working_hours?.end || '17:00').slice(0, 5);
  return { start, end };
}

function isSlotWithinDoctorShift(doc, slotTime) {
  if (!doc) return true;
  const slot24 = parseSlotTo24h(slotTime);
  const { start, end } = getDoctorShift(doc);
  return slot24 >= start && slot24 < end;
}

function formatDoctorWorkingDays(workingDays) {
  const normDays = normalizeDoctorWorkingDays(workingDays);
  if (normDays.length === 0) return 'Sat – Thu';
  const names = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  return normDays.map(d => names[d - 1]).join(', ');
}

function renderScheduleSkeletons() {
  const container = document.getElementById('calendarGridContainer');
  if (!container) return;

  const skeletonHeader = `
    <thead>
      <tr>
        <th class="time-col-header" style="width: 100px;">Time</th>
        ${[1, 2, 3, 4, 5].map(() => `
          <th>
            <div class="doctor-header-cell" style="display:flex; align-items:center; gap:8px;">
              <div class="skeleton-shimmer skeleton-avatar" style="width:32px; height:32px; border-radius:50%;"></div>
              <div style="flex:1;">
                <div class="skeleton-shimmer skeleton-text" style="width:70%; height:13px;"></div>
                <div class="skeleton-shimmer skeleton-text" style="width:45%; height:10px; margin-top:3px;"></div>
              </div>
            </div>
          </th>
        `).join('')}
      </tr>
    </thead>
  `;

  const dummyTimes = ['09:00 AM', '09:30 AM', '10:00 AM', '10:30 AM', '11:00 AM', '11:30 AM', '12:00 PM', '12:30 PM', '01:00 PM', '01:30 PM'];
  const skeletonBody = `
    <tbody>
      ${dummyTimes.map((t, idx) => `
        <tr>
          <td class="time-slot-cell">${t}</td>
          ${[1, 2, 3, 4, 5].map((col) => {
            if ((idx + col) % 3 === 0) {
              return `
                <td style="padding: 4px; vertical-align: top;">
                  <div class="skeleton-shimmer" style="height: 52px; border-radius: 8px;"></div>
                </td>
              `;
            }
            return `<td style="padding: 4px;"></td>`;
          }).join('')}
        </tr>
      `).join('')}
    </tbody>
  `;

  container.innerHTML = `<table class="doctor-schedule-table">${skeletonHeader}${skeletonBody}</table>`;
}

function renderMetricsSkeletons() {
  const totalEl = document.getElementById('metricTodayTotal') || document.getElementById('metricTodayCount');
  const confEl = document.getElementById('metricConfirmedCount');
  const pendEl = document.getElementById('metricPendingCount');
  const cancEl = document.getElementById('metricCancelledCount');

  const skeletonPill = `<span class="skeleton-shimmer skeleton-pill" style="display:inline-block; width:45px; height:24px; vertical-align:middle; border-radius:6px;"></span>`;
  if (totalEl) totalEl.innerHTML = skeletonPill;
  if (confEl) confEl.innerHTML = skeletonPill;
  if (pendEl) pendEl.innerHTML = skeletonPill;
  if (cancEl) cancEl.innerHTML = skeletonPill;
}

function renderUpcomingListSkeletons() {
  const container = document.querySelector('.upcoming-items-list');
  const countEl = document.querySelector('.upcoming-title');
  if (countEl) countEl.innerHTML = `Upcoming <span class="skeleton-shimmer skeleton-pill" style="display:inline-block; width:28px; height:16px; vertical-align:middle; border-radius:4px;"></span>`;
  if (!container) return;

  const skeletonItem = `
    <div style="padding: 10px 12px; border-radius: 8px; border: 1px solid var(--border-light); margin-bottom: 8px; background: #FFFFFF; display: flex; align-items: center; justify-content: space-between;">
      <div style="display: flex; align-items: center; gap: 10px;">
        <div class="skeleton-shimmer skeleton-avatar" style="width: 34px; height: 34px; border-radius: 50%;"></div>
        <div style="display:flex; flex-direction:column; gap:4px;">
          <div class="skeleton-shimmer skeleton-text" style="width: 90px; height: 13px;"></div>
          <div class="skeleton-shimmer skeleton-text" style="width: 120px; height: 10px;"></div>
        </div>
      </div>
      <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 4px;">
        <div class="skeleton-shimmer skeleton-text" style="width: 45px; height: 12px;"></div>
        <div class="skeleton-shimmer skeleton-text" style="width: 55px; height: 10px;"></div>
      </div>
    </div>
  `;

  container.innerHTML = skeletonItem.repeat(3);
}

function initAppointmentsStore() {
  selectedDate = new Date();
  miniCalYear = selectedDate.getFullYear();
  miniCalMonth = selectedDate.getMonth();
  updateDateHeading();
  renderMetricsSkeletons();
  renderMiniCalendar();
  renderScheduleSkeletons();
  renderUpcomingListSkeletons();
}

/* =============================================================================
   SCHEDULE RENDERING (DAY, WEEK, MONTH MODES)
   ============================================================================= */
function renderSchedule() {
  const isPast = isDateInPast(selectedDate);
  const pastBanner = document.getElementById('pastDateNoticeBanner');
  if (pastBanner) {
    if (isPast) {
      pastBanner.style.display = 'block';
      const formattedDate = selectedDate.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
      pastBanner.innerHTML = `
        <div style="background:#F1F5F9; border:1px solid #CBD5E1; border-radius:10px; padding:12px 16px; display:flex; align-items:center; gap:12px; color:#475569;">
          <svg viewBox="0 0 24 24" fill="none" stroke="#64748B" stroke-width="2" width="22" height="22" style="flex-shrink:0;"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          <div style="flex:1;">
            <strong style="display:block; font-size:14px; color:#1E293B;">Past Date (${escapeHtml(formattedDate)}) — Read-Only Audit Mode</strong>
            <span style="font-size:12px; color:#64748B;">This date has already passed. Historical appointments can be reviewed, but scheduling new bookings or modifying past records is locked.</span>
          </div>
          <button onclick="goToTodaySchedule()" class="modal-btn-secondary" style="font-size:12px; height:32px; padding:0 12px; background:#FFFFFF; border-color:#94A3B8; color:#1E293B; cursor:pointer; font-weight:600; white-space:nowrap;">
            Return to Today
          </button>
        </div>
      `;
    } else {
      pastBanner.style.display = 'none';
      pastBanner.innerHTML = '';
    }
  }

  if (currentViewMode === 'list') {
    renderListView();
  } else {
    if (currentInterval === 'day') {
      renderDaySchedule();
    } else if (currentInterval === 'week') {
      renderWeekSchedule();
    } else if (currentInterval === 'month') {
      renderMonthSchedule();
    }
  }

  // Update Metrics
  metricsState.total = appointmentsData.length;
  metricsState.confirmed = appointmentsData.filter(a => (a.status || '').toLowerCase() === 'confirmed' || (a.status || '').toLowerCase() === 'scheduled').length;
  metricsState.pending = appointmentsData.filter(a => (a.status || '').toLowerCase() === 'pending').length;
  metricsState.cancelled = appointmentsData.filter(a => (a.status || '').toLowerCase() === 'cancelled').length;
  updateMetricsDisplay();

  // Render Right Column Upcoming List
  renderUpcomingList();
}

// Fallback alias for legacy calls
function renderScheduleGrid() {
  renderSchedule();
}

/* 1. Day Schedule: Doctor Multi-Column Grid (30-Minute Dynamic Slots) */
function renderDaySchedule() {
  const container = document.getElementById('calendarGridContainer');
  if (!container) return;

  const times = SCHEDULE_TIME_SLOTS;

  // Active appointments on selectedDate
  const filteredAppointments = getFilteredAppointments();
  const dayAppointments = filteredAppointments.filter(a => {
    const aDate = parseApptDate(a.date);
    return isSameDay(aDate, selectedDate);
  });

  const doctorFilterVal = document.getElementById('doctorSelectFilter') ? document.getElementById('doctorSelectFilter').value : 'All Doctors';

  // Gather doctors to display
  let doctors = [];
  if (doctorFilterVal !== 'All Doctors') {
    const foundDoc = liveDoctorsCache.find(d => d.name_en === doctorFilterVal);
    if (foundDoc) {
      doctors = [foundDoc];
    } else {
      doctors = [{ name_en: doctorFilterVal, specialty_id: 1, shift_start: '09:00', shift_end: '17:00' }];
    }
  } else {
    // Collect all doctors from live cache
    if (liveDoctorsCache.length > 0) {
      doctors = liveDoctorsCache;
    } else {
      doctors = [
        { name_en: 'Dr. Amal Nour', specialty_id: 1, shift_start: '09:00', shift_end: '14:00', working_days: [6, 7, 1, 2, 3] },
        { name_en: 'Dr. Karim Salem', specialty_id: 1, shift_start: '14:00', shift_end: '20:00', working_days: [6, 7, 1, 2, 4] },
        { name_en: 'Dr. Salma Hany', specialty_id: 2, shift_start: '09:00', shift_end: '15:00', working_days: [7, 1, 2, 3, 4] },
        { name_en: 'Dr. Tarek Ali', specialty_id: 2, shift_start: '13:00', shift_end: '19:00', working_days: [6, 1, 2, 3, 4] },
        { name_en: 'Dr. Mariam Adel', specialty_id: 3, shift_start: '10:00', shift_end: '16:00', working_days: [6, 7, 1, 2, 3] }
      ];
    }
  }

  const isFriday = getIsoWeekday(selectedDate) === 5;
  const holidayCheck = (window.ClinicApi && typeof window.ClinicApi.isClinicHoliday === 'function')
    ? window.ClinicApi.isClinicHoliday(selectedDate)
    : { isHoliday: false };
  const isClinicClosed = isFriday || holidayCheck.isHoliday;

  // Render or hide the clinic closure / holiday notice banner
  const closureBanner = document.getElementById('clinicClosureNoticeBanner');
  if (closureBanner) {
    if (holidayCheck.isHoliday && !holidayCheck.isWeekend) {
      closureBanner.style.display = 'block';
      closureBanner.innerHTML = `
        <div style="background:#FFFBEB; border:1px solid #FDE68A; border-radius:10px; padding:12px 16px; display:flex; align-items:center; gap:12px; color:#92400E;">
          <svg viewBox="0 0 24 24" fill="none" stroke="#D97706" stroke-width="2" width="22" height="22" style="flex-shrink:0;"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><path d="m9 16 2 2 4-4"/></svg>
          <div style="flex:1;">
            <strong style="display:block; font-size:14px; color:#78350F;">Clinic Closed: ${escapeHtml(holidayCheck.name_en)} (${escapeHtml(holidayCheck.name_ar || '')})</strong>
            <span style="font-size:12px; color:#92400E;">This date is configured as an official clinic-wide closure. Regular doctor consultations and clinic appointments are suspended.</span>
          </div>
          <button onclick="if(typeof openApiConfigModal==='function') openApiConfigModal('schedule');" class="modal-btn-secondary" style="font-size:11.5px; height:30px; padding:0 10px; white-space:nowrap; background:#FFFFFF; border-color:#FCD34D; color:#92400E; cursor:pointer;">
            Manage Holidays
          </button>
        </div>
      `;
    } else if (isFriday) {
      closureBanner.style.display = 'block';
      closureBanner.innerHTML = `
        <div style="background:#FEF2F2; border:1px solid #FECACA; border-radius:10px; padding:12px 16px; display:flex; align-items:center; gap:12px; color:#991B1B;">
          <svg viewBox="0 0 24 24" fill="none" stroke="#DC2626" stroke-width="2" width="22" height="22" style="flex-shrink:0;"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
          <div style="flex:1;">
            <strong style="display:block; font-size:14px; color:#991B1B;">Weekly Weekend (Friday / عطلة الجمعة الأسبوعية)</strong>
            <span style="font-size:12px; color:#B91C1C;">The clinic is closed on Fridays in accordance with Egyptian healthcare operating standards.</span>
          </div>
          <button onclick="if(typeof openApiConfigModal==='function') openApiConfigModal('schedule');" class="modal-btn-secondary" style="font-size:11.5px; height:30px; padding:0 10px; white-space:nowrap; background:#FFFFFF; border-color:#FCA5A5; color:#991B1B; cursor:pointer;">
            View Clinic Hours
          </button>
        </div>
      `;
    } else {
      closureBanner.style.display = 'none';
      closureBanner.innerHTML = '';
    }
  }

  // Build the Table HTML
  let theadHtml = `
    <thead>
      <tr>
        <th class="time-col-header" style="min-width: 90px; width: 90px;">Time</th>
        ${doctors.map(doc => {
          const spec = liveSpecialtiesCache.find(s => s.id === doc.specialty_id);
          const deptName = doc.specialty?.name_en || (spec ? spec.name_en : doc.title_en || 'Consultant');
          const cleanName = (doc.name_en || 'Doctor').replace(/Dr\.\s*/i, '');
          const initials = cleanName.split(' ').map(p => p.charAt(0)).join('').slice(0, 2).toUpperCase() || 'DR';
          const onDutyToday = isDoctorWorkingOnDate(doc, selectedDate);
          const shiftText = doc.shift_start && doc.shift_end ? `${doc.shift_start.slice(0, 5)} - ${doc.shift_end.slice(0, 5)}` : '09:00 - 17:00';

          return `
            <th style="min-width: 170px;">
              <div class="doctor-header-cell">
                <div class="doctor-header-avatar">${initials}</div>
                <div class="doctor-header-info">
                  <div style="display: flex; align-items: center; gap: 4px;">
                    <span class="doctor-header-name">${escapeHtml(doc.name_en)}</span>
                    ${(!onDutyToday || isClinicClosed) ? '<span class="doctor-off-badge">' + (isClinicClosed ? 'Closed' : 'Off-Duty') + '</span>' : ''}
                  </div>
                  <span class="doctor-header-dept">${escapeHtml(deptName)} • <small style="color:var(--text-muted); font-size:10px;">${shiftText}</small></span>
                </div>
              </div>
            </th>
          `;
        }).join('')}
      </tr>
    </thead>
  `;

  let tbodyHtml = `
    <tbody id="scheduleGridBody">
      ${times.map(t => {
        let cellsHtml = `<td class="time-slot-cell">${t}</td>`;

        doctors.forEach(doc => {
          const onDutyToday = isDoctorWorkingOnDate(doc, selectedDate);

          if (!onDutyToday || isClinicClosed) {
            cellsHtml += `<td class="off-duty-cell" title="${isClinicClosed ? (holidayCheck.name_en || 'Clinic Weekend') : 'Doctor Off-Duty'}"></td>`;
            return;
          }

          const withinShift = isSlotWithinDoctorShift(doc, t);
          if (!withinShift) {
            cellsHtml += `<td class="off-shift-cell"></td>`;
            return;
          }

          const matches = dayAppointments.filter(a => {
            const docIdMatch = a.doctorId && doc.id && Number(a.doctorId) === Number(doc.id);
            const docNameMatch = a.doctor && (
              a.doctor.toLowerCase().includes(doc.name_en.toLowerCase()) ||
              doc.name_en.toLowerCase().includes(a.doctor.toLowerCase())
            );
            if (!docIdMatch && !docNameMatch) return false;
            return matchTimeSlot(a, t);
          });

          if (matches.length > 0) {
            cellsHtml += `<td style="padding: 4px; vertical-align: top;">`;
            matches.forEach(match => {
              let cardColorClass = 'card-confirmed-green';
              if (match.status === 'Pending') cardColorClass = 'card-orange';
              if (match.status === 'In Clinic') cardColorClass = 'card-blue';
              if (match.status === 'Cancelled') cardColorClass = 'card-purple';

              const isSelected = selectedAppointment && selectedAppointment.id === match.id ? 'selected-appt-card' : '';

              cellsHtml += `
                <div class="appt-slot-card ${cardColorClass} ${isSelected}" onclick="selectScheduleSlot(${match.id}, this)" style="margin-bottom: 4px;">
                  <div class="slot-top-row">
                    <span class="slot-time-text">${match.timeShort || t}</span>
                    <span class="status-pill status-${match.status.toLowerCase().replace(/\s+/g, '')}">${match.status}</span>
                  </div>
                  <span class="slot-patient-name">${escapeHtml(match.patientName)}</span>
                  <span class="slot-sub-type">${escapeHtml(match.type || 'Consultation')} • ${escapeHtml(match.patientCode || '')}</span>
                </div>
              `;
            });
            cellsHtml += `</td>`;
          } else {
            if (isDateInPast(selectedDate)) {
              cellsHtml += `
                <td class="past-locked-slot" style="padding: 4px; text-align: center; vertical-align: middle;" title="Past Slot: Scheduling locked for historical audit">
                  <span style="font-size: 11px; color: #94A3B8; font-weight: 600; display: inline-flex; align-items: center; gap: 4px;">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                    Locked
                  </span>
                </td>
              `;
            } else {
              // Available slot within shift
              cellsHtml += `
                <td class="available-shift-slot" style="padding: 4px; text-align: center; vertical-align: middle; cursor: pointer;" onclick="openNewAppointmentForSlot('${escapeHtml(doc.name_en)}', '${t}')" title="Available Slot: Click to book with ${escapeHtml(doc.name_en)} at ${t}">
                </td>
              `;
            }
          }
        });

        return `<tr>${cellsHtml}</tr>`;
      }).join('')}
    </tbody>
  `;

  container.innerHTML = `<table class="doctor-schedule-table">${theadHtml}${tbodyHtml}</table>`;
}

window.openNewAppointmentForSlot = function(doctorName, slotTime) {
  if (isDateInPast(selectedDate)) {
    if (window.ClinicDialog) {
      window.ClinicDialog.alert(
        'Past Date Locked',
        'Cannot schedule appointments on past dates. Please select today or a future date to book.',
        'warning'
      );
    } else {
      alert('Cannot schedule appointments on past dates.');
    }
    return;
  }
  openNewAppointmentModal();
  setTimeout(() => {
    const docSelect = document.getElementById('newApptDoctor');
    const dateInput = document.getElementById('newApptDate');

    if (dateInput) dateInput.value = formatDateIso(selectedDate);
    if (docSelect && doctorName) {
      for (let i = 0; i < docSelect.options.length; i++) {
        if (docSelect.options[i].value.includes(doctorName) || docSelect.options[i].text.includes(doctorName)) {
          docSelect.selectedIndex = i;
          break;
        }
      }
    }
    refreshNewApptTimeSlots(slotTime);
  }, 100);
};

/* 2. Week Schedule: 7-Day Matrix with Friday Off-Duty Handling */
function renderWeekSchedule() {
  const container = document.getElementById('calendarGridContainer');
  if (!container) return;

  const times = SCHEDULE_TIME_SLOTS;

  // Calculate 7 days of the week containing selectedDate (Sunday to Saturday)
  const startOfWeek = new Date(selectedDate);
  startOfWeek.setDate(selectedDate.getDate() - selectedDate.getDay());
  const weekDays = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(startOfWeek);
    d.setDate(startOfWeek.getDate() + i);
    weekDays.push(d);
  }

  const filteredAppointments = getFilteredAppointments();
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const today = new Date();

  const doctorFilterVal = document.getElementById('doctorSelectFilter') ? document.getElementById('doctorSelectFilter').value : 'All Doctors';
  const filteredDoc = doctorFilterVal !== 'All Doctors' ? liveDoctorsCache.find(d => d.name_en === doctorFilterVal) : null;

  let theadHtml = `
    <thead>
      <tr>
        <th class="time-col-header" style="min-width: 90px; width: 90px;">Time</th>
        ${weekDays.map((d, idx) => {
          const isActive = isSameDay(d, selectedDate);
          const isToday = isSameDay(d, today);
          const isFriday = getIsoWeekday(d) === 5;
          const activeClass = isActive ? 'active-week-col' : '';
          const dayNumStr = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
          const isDocOff = filteredDoc ? !isDoctorWorkingOnDate(filteredDoc, d) : false;

          return `
            <th class="${activeClass}" style="cursor: pointer; min-width: 140px;" onclick="selectCalendarDate(${d.getFullYear()}, ${d.getMonth()}, ${d.getDate()})">
              <div class="week-day-header">
                <span class="week-day-name">${dayNames[idx]}${isToday ? ' (Today)' : ''}${isFriday ? ' (Closed)' : isDocOff ? ' (Off)' : ''}</span>
                <span class="week-day-num">${dayNumStr}</span>
              </div>
            </th>
          `;
        }).join('')}
      </tr>
    </thead>
  `;

  let tbodyHtml = `
    <tbody>
      ${times.map(t => {
        let cellsHtml = `<td class="time-slot-cell">${t}</td>`;

        weekDays.forEach(d => {
          const isSelectedDay = isSameDay(d, selectedDate);
          const cellClass = isSelectedDay ? 'active-week-col-td' : '';
          const isFriday = getIsoWeekday(d) === 5;

          if (isFriday) {
            cellsHtml += `<td class="off-duty-cell ${cellClass}"></td>`;
            return;
          }

          if (filteredDoc) {
            if (!isDoctorWorkingOnDate(filteredDoc, d)) {
              cellsHtml += `<td class="off-duty-cell ${cellClass}"></td>`;
              return;
            }
            if (!isSlotWithinDoctorShift(filteredDoc, t)) {
              cellsHtml += `<td class="off-shift-cell ${cellClass}"></td>`;
              return;
            }
          }

          const matches = filteredAppointments.filter(a => {
            const aDate = parseApptDate(a.date);
            if (!isSameDay(aDate, d)) return false;
            return matchTimeSlot(a, t);
          });

          if (matches.length > 0) {
            cellsHtml += `<td class="${cellClass}" style="padding: 4px; vertical-align: top;">`;
            matches.forEach(match => {
              let cardColorClass = 'card-confirmed-green';
              if (match.status === 'Pending') cardColorClass = 'card-orange';
              if (match.status === 'In Clinic') cardColorClass = 'card-blue';
              if (match.status === 'Cancelled') cardColorClass = 'card-purple';

              const isSelected = selectedAppointment && selectedAppointment.id === match.id ? 'selected-appt-card' : '';

              cellsHtml += `
                <div class="appt-slot-card ${cardColorClass} ${isSelected}" onclick="selectScheduleSlot(${match.id}, this)" style="margin-bottom: 4px;">
                  <div class="slot-top-row">
                    <span class="slot-time-text">${match.timeShort || t}</span>
                    <span class="status-pill status-${match.status.toLowerCase().replace(/\s+/g, '')}">${match.status}</span>
                  </div>
                  <span class="slot-patient-name">${escapeHtml(match.patientName)}</span>
                  <span class="slot-sub-type">${escapeHtml(match.doctor)} • ${escapeHtml(match.type)}</span>
                </div>
              `;
            });
            cellsHtml += `</td>`;
          } else {
            cellsHtml += `<td class="${cellClass}" style="padding: 4px; text-align: center; vertical-align: middle;"></td>`;
          }
        });

        return `<tr>${cellsHtml}</tr>`;
      }).join('')}
    </tbody>
  `;

  container.innerHTML = `<table class="week-schedule-table">${theadHtml}${tbodyHtml}</table>`;
}

/* 3. Month Schedule: Full Monthly Grid */
function renderMonthSchedule() {
  const container = document.getElementById('calendarGridContainer');
  if (!container) return;

  const year = selectedDate.getFullYear();
  const month = selectedDate.getMonth();
  const today = new Date();

  const firstDayIndex = new Date(year, month, 1).getDay(); // 0 = Sun
  const totalDays = new Date(year, month + 1, 0).getDate();
  const prevMonthTotalDays = new Date(year, month, 0).getDate();

  const filteredAppointments = getFilteredAppointments();
  const dayHeaders = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  let cellsHtml = '';

  // Leading days from previous month
  for (let i = firstDayIndex - 1; i >= 0; i--) {
    const prevDay = prevMonthTotalDays - i;
    const prevDate = new Date(year, month - 1, prevDay);
    cellsHtml += `
      <div class="month-grid-cell inactive-month-cell" onclick="selectCalendarDate(${prevDate.getFullYear()}, ${prevDate.getMonth()}, ${prevDay}); switchInterval('day');">
        <div class="month-cell-top">
          <span class="month-cell-day-num">${prevDay}</span>
        </div>
      </div>
    `;
  }

  // Days of current month
  for (let d = 1; d <= totalDays; d++) {
    const dayDate = new Date(year, month, d);
    const isToday = isSameDay(dayDate, today);
    const isSelected = isSameDay(dayDate, selectedDate);

    let cellClasses = ['month-grid-cell'];
    if (isToday) cellClasses.push('today-month-cell');
    if (isSelected) cellClasses.push('selected-day-cell');

    const dayAppts = filteredAppointments.filter(a => {
      const aDate = parseApptDate(a.date);
      return isSameDay(aDate, dayDate);
    });

    let chipsHtml = '';
    const displayAppts = dayAppts.slice(0, 3);
    displayAppts.forEach(a => {
      let chipClass = 'chip-confirmed';
      const st = (a.status || '').toLowerCase();
      if (st === 'pending') chipClass = 'chip-pending';
      else if (st === 'in clinic') chipClass = 'chip-inclinic';
      else if (st === 'cancelled') chipClass = 'chip-cancelled';

      chipsHtml += `
        <div class="month-appt-chip ${chipClass}" onclick="event.stopPropagation(); selectScheduleSlot(${a.id}, null);" title="${escapeHtml(a.patientName)} (${a.timeShort}) - ${escapeHtml(a.doctor)}">
          <span style="font-weight:700;">${a.timeShort}</span>
          <span>${escapeHtml(a.patientName)}</span>
        </div>
      `;
    });

    if (dayAppts.length > 3) {
      chipsHtml += `<div class="month-chip-more">+${dayAppts.length - 3} more</div>`;
    }

    const countBadge = dayAppts.length > 0 ? `<span class="month-cell-count-badge">${dayAppts.length}</span>` : '';

    cellsHtml += `
      <div class="${cellClasses.join(' ')}" onclick="selectCalendarDate(${year}, ${month}, ${d}); switchInterval('day');" title="Click to view full schedule for this day">
        <div class="month-cell-top">
          <span class="month-cell-day-num">${d}</span>
          ${countBadge}
        </div>
        ${chipsHtml}
      </div>
    `;
  }

  // Trailing days from next month to complete row of 7
  const totalRendered = firstDayIndex + totalDays;
  const nextDaysNeeded = (7 - (totalRendered % 7)) % 7;
  for (let n = 1; n <= nextDaysNeeded; n++) {
    const nextDate = new Date(year, month + 1, n);
    cellsHtml += `
      <div class="month-grid-cell inactive-month-cell" onclick="selectCalendarDate(${nextDate.getFullYear()}, ${nextDate.getMonth()}, ${n}); switchInterval('day');">
        <div class="month-cell-top">
          <span class="month-cell-day-num">${n}</span>
        </div>
      </div>
    `;
  }

  container.innerHTML = `
    <div class="month-schedule-grid">
      <div class="month-grid-header">
        ${dayHeaders.map(h => `<span>${h}</span>`).join('')}
      </div>
      <div class="month-grid-body">
        ${cellsHtml}
      </div>
    </div>
  `;
}

/* =============================================================================
   DYNAMIC MINI CALENDAR (RIGHT PANEL WIDGET)
   ============================================================================= */
function renderMiniCalendar() {
  const monthTitle = document.getElementById('miniCalMonthTitle');
  const gridContainer = document.getElementById('miniCalGrid');
  if (!gridContainer) return;

  const monthDate = new Date(miniCalYear, miniCalMonth, 1);
  const monthName = monthDate.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  if (monthTitle) monthTitle.textContent = monthName;

  const firstDay = new Date(miniCalYear, miniCalMonth, 1).getDay(); // 0 = Sun
  const daysInMonth = new Date(miniCalYear, miniCalMonth + 1, 0).getDate();
  const prevDaysInMonth = new Date(miniCalYear, miniCalMonth, 0).getDate();

  const dayHeaders = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  let html = dayHeaders.map(h => `<span class="mini-day-head">${h}</span>`).join('');

  const now = new Date();
  const todayZero = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // Previous month trailing days
  for (let i = firstDay - 1; i >= 0; i--) {
    const pDay = prevDaysInMonth - i;
    const pDate = new Date(miniCalYear, miniCalMonth - 1, pDay);
    const isPast = pDate < todayZero;
    const pastClass = isPast ? 'past-day' : '';
    const title = isPast ? 'Past Date (Read-Only Mode)' : '';
    html += `<span class="mini-day-cell inactive-month ${pastClass}" title="${title}" onclick="selectCalendarDate(${pDate.getFullYear()}, ${pDate.getMonth()}, ${pDay})">${pDay}</span>`;
  }

  // Current month days
  for (let d = 1; d <= daysInMonth; d++) {
    const dayDate = new Date(miniCalYear, miniCalMonth, d);
    const isActive = isSameDay(dayDate, selectedDate);
    const isPast = dayDate < todayZero;
    const hasAppts = appointmentsData.some(a => {
      const aDate = parseApptDate(a.date);
      return isSameDay(aDate, dayDate) && (a.status || '').toLowerCase() !== 'cancelled';
    });

    const activeClass = isActive ? 'active-day' : '';
    const pastClass = isPast ? 'past-day' : '';
    const dotHtml = hasAppts ? '<span class="mini-day-dot"></span>' : '';
    const title = isPast ? 'Past Date (Read-Only Mode)' : '';

    html += `
      <span class="mini-day-cell ${activeClass} ${pastClass}" title="${title}" onclick="selectCalendarDate(${miniCalYear}, ${miniCalMonth}, ${d})">
        ${d}${dotHtml}
      </span>
    `;
  }

  // Next month leading days
  const totalCells = firstDay + daysInMonth;
  const nextDays = (7 - (totalCells % 7)) % 7;
  for (let n = 1; n <= nextDays; n++) {
    const nDate = new Date(miniCalYear, miniCalMonth + 1, n);
    const isPast = nDate < todayZero;
    const pastClass = isPast ? 'past-day' : '';
    const title = isPast ? 'Past Date (Read-Only Mode)' : '';
    html += `<span class="mini-day-cell inactive-month ${pastClass}" title="${title}" onclick="selectCalendarDate(${nDate.getFullYear()}, ${nDate.getMonth()}, ${n})">${n}</span>`;
  }

  gridContainer.innerHTML = html;
}

function shiftMiniMonth(delta) {
  miniCalMonth += delta;
  if (miniCalMonth < 0) {
    miniCalMonth = 11;
    miniCalYear--;
  } else if (miniCalMonth > 11) {
    miniCalMonth = 0;
    miniCalYear++;
  }
  renderMiniCalendar();
}

function selectCalendarDate(year, month, day) {
  selectedDate = new Date(year, month, day);
  miniCalYear = year;
  miniCalMonth = month;
  updateDateHeading();
  renderMiniCalendar();
  renderSchedule();
  syncLiveAvailability();
}

function selectCalendarDay(day) {
  selectCalendarDate(miniCalYear, miniCalMonth, day);
}

window.shiftMiniMonth = shiftMiniMonth;
window.selectCalendarDate = selectCalendarDate;
window.selectCalendarDay = selectCalendarDay;

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
  const headerActions = document.getElementById('apptDetailsHeaderActions');

  if (!appt || appt.status === 'Cancelled') {
    if (emptyState) emptyState.style.display = 'block';
    if (activeContent) activeContent.style.display = 'none';
    if (headerActions) headerActions.style.display = 'none';
    return;
  }

  if (emptyState) emptyState.style.display = 'none';
  if (activeContent) activeContent.style.display = 'flex';
  if (headerActions) headerActions.style.display = 'flex';

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
  if (btn) {
    btn.classList.add('active');
  } else {
    document.querySelectorAll('.segmented-pill-group .seg-pill-btn').forEach(b => {
      if (b.textContent.trim().toLowerCase() === interval.toLowerCase()) {
        b.classList.add('active');
      }
    });
  }

  updateDateHeading();
  renderSchedule();
  showToast(`Switched view to ${interval.toUpperCase()} mode.`, 'info');
}

function goToTodaySchedule() {
  selectedDate = new Date();
  miniCalYear = selectedDate.getFullYear();
  miniCalMonth = selectedDate.getMonth();
  updateDateHeading();
  renderMiniCalendar();
  renderSchedule();
  syncLiveAvailability();
  if (currentViewMode === 'list') {
    renderListView();
  }
  const formatted = selectedDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  showToast(`Returned to Today (${formatted}).`, 'info');
}

function shiftScheduleDate(delta) {
  if (currentInterval === 'day') {
    selectedDate.setDate(selectedDate.getDate() + delta);
  } else if (currentInterval === 'week') {
    selectedDate.setDate(selectedDate.getDate() + delta * 7);
  } else if (currentInterval === 'month') {
    selectedDate.setMonth(selectedDate.getMonth() + delta);
  }
  miniCalYear = selectedDate.getFullYear();
  miniCalMonth = selectedDate.getMonth();
  updateDateHeading();
  renderMiniCalendar();
  renderSchedule();
  syncLiveAvailability();
  if (currentViewMode === 'list') {
    renderListView();
  }
}

function getSelectedDate() {
  return selectedDate;
}

function getSelectedDateIso() {
  return formatDateIso(selectedDate);
}

function updateDateHeading() {
  const heading = document.getElementById('scheduleDayHeading');
  const pillText = document.getElementById('activeDatePillText');

  if (currentInterval === 'day') {
    const options = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
    const formatted = selectedDate.toLocaleDateString('en-GB', options);
    const shortFormatted = selectedDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    if (heading) heading.textContent = formatted;
    if (pillText) pillText.textContent = shortFormatted;
  } else if (currentInterval === 'week') {
    const startOfWeek = new Date(selectedDate);
    startOfWeek.setDate(selectedDate.getDate() - selectedDate.getDay());
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    const startStr = startOfWeek.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    const endStr = endOfWeek.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    if (heading) heading.textContent = `Week Schedule (${startStr} – ${endStr})`;
    if (pillText) pillText.textContent = `${startStr} – ${endStr}`;
  } else if (currentInterval === 'month') {
    const monthStr = selectedDate.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
    if (heading) heading.textContent = `${monthStr} Schedule Overview`;
    if (pillText) pillText.textContent = selectedDate.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
  }

  // Sync live availability for newly selected date (silent so it doesn't disturb connection indicator)
  syncLiveAvailability();
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
      const doctorsBadge = document.getElementById('doctorsCountBadge');
      if (doctorsBadge) {
        doctorsBadge.textContent = String(docData.doctors.length);
      }
      try {
        sessionStorage.setItem('shiffaa_doctors_count', String(docData.doctors.length));
      } catch (_) {}
    }

    if (apptData && Array.isArray(apptData.appointments)) {
      appointmentsData = apptData.appointments;
      saveAppointmentsStore();
    }

    renderSchedule();
    renderMiniCalendar();
    updateDateHeading();
    if (selectedAppointment) {
      const match = appointmentsData.find(a => a.id === selectedAppointment.id);
      if (!match || match.status === 'Cancelled') {
        selectedAppointment = null;
        populateAppointmentDetails(null);
      } else {
        selectedAppointment = match;
        populateAppointmentDetails(selectedAppointment);
      }
    } else {
      populateAppointmentDetails(null);
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
    const result = await ClinicApi.searchAvailability(dateIso, 20, { silent: true });
    const slots = result?.results || result?.slots || [];
    if (Array.isArray(slots) && slots.length > 0) {
      console.info(`[ClinicApi] Found ${slots.length} available slots for ${dateIso}`);
      const pill = document.getElementById('activeDatePillText');
      if (pill) {
        pill.title = `${slots.length} live available slots synced from FastAPI backend.`;
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
  renderSchedule();
  const filtered = getFilteredAppointments();
  showToast(`Filtered: ${filtered.length} appointment(s) matching criteria.`, 'info');
}

function handleSearchAppointments(term) {
  if (!term) {
    document.querySelectorAll('.appt-slot-card, .month-appt-chip').forEach(c => {
      c.style.display = 'block';
      c.style.boxShadow = 'none';
    });
    return;
  }
  document.querySelectorAll('.appt-slot-card, .month-appt-chip').forEach(card => {
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
  const totalEl = document.getElementById('metricTodayTotal') || document.getElementById('metricTodayCount');
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

  const now = new Date();
  const todayIso = formatDateIso(now);
  const maxDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const maxHorizonIso = formatDateIso(maxDate);

  const timeSlotOptions = [
    '08:00', '08:30', '09:00', '09:30', '10:00', '10:30',
    '11:00', '11:30', '12:00', '12:30', '13:00', '13:30',
    '14:00', '14:30', '15:00', '15:30', '16:00', '16:30',
    '17:00', '17:30', '18:00', '18:30', '19:00', '19:30'
  ].map(t => {
    const [hStr, mStr] = t.split(':');
    let h = parseInt(hStr, 10);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const displayH = h % 12 === 0 ? 12 : h % 12;
    const label = `${String(displayH).padStart(2, '0')}:${mStr} ${ampm}`;
    return `<option value="${t}">${label}</option>`;
  }).join('');

  const bodyHtml = `
    <form id="newApptForm" onsubmit="event.preventDefault(); submitNewAppointment();" style="display:flex; flex-direction:column; gap:14px;">
      
      <div style="background: #F0FDF4; border: 1px solid #BBF7D0; border-radius: 8px; padding: 12px;">
        <label style="display: flex; align-items: center; justify-content: space-between; font-size: 12px; font-weight: 700; color: #166534; margin-bottom: 6px;">
          <span style="display: inline-flex; align-items: center; gap: 5px;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
            Link Registered Patient
          </span>
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
          <label style="display:block; font-size:12px; font-weight:600; color:var(--text-dark); margin-bottom:4px;">Doctor *</label>
          <select id="newApptDoctor" onchange="refreshNewApptTimeSlots()" style="width:100%; padding:9px 12px; border:1px solid var(--border-light); border-radius:8px; font-size:13px; font-family:inherit; background:#FFF;">
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
          <input type="date" id="newApptDate" value="${todayIso}" min="${todayIso}" max="${maxHorizonIso}" onchange="refreshNewApptTimeSlots()" style="width:100%; padding:9px 12px; border:1px solid var(--border-light); border-radius:8px; font-size:13px; font-family:inherit;">
        </div>
        <div>
          <label style="display:block; font-size:12px; font-weight:600; color:var(--text-dark); margin-bottom:4px;">Time Slot (30 mins) *</label>
          <select id="newApptTime" style="width:100%; padding:9px 12px; border:1px solid var(--border-light); border-radius:8px; font-size:13px; font-family:inherit; background:#FFF;">
            ${timeSlotOptions}
          </select>
        </div>
      </div>
      <div id="newApptShiftInfo" style="margin-top:-6px;"></div>
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
  setTimeout(() => {
    refreshNewApptTimeSlots();
  }, 20);
}

function refreshNewApptTimeSlots(preferredSlot) {
  const docSelect = document.getElementById('newApptDoctor');
  const dateInput = document.getElementById('newApptDate');
  const timeSelect = document.getElementById('newApptTime');
  const infoContainer = document.getElementById('newApptShiftInfo');
  const submitBtn = document.querySelector('.admin-modal-footer .modal-btn-primary');

  if (!docSelect || !dateInput || !timeSelect) return;

  const docValParts = (docSelect.value || '').split('|');
  const doctorName = docValParts[0];
  const docId = docValParts[2] ? parseInt(docValParts[2], 10) : null;
  const docObj = liveDoctorsCache.find(d => (docId && d.id === docId) || d.name_en === doctorName);

  const dateVal = dateInput.value;
  const targetDate = parseApptDate(dateVal);

  if (!targetDate) {
    if (infoContainer) infoContainer.innerHTML = '';
    return;
  }

  // 1. Check clinic closed / Friday
  const isoDay = getIsoWeekday(targetDate);
  const holidayCheck = (window.ClinicApi && typeof window.ClinicApi.isClinicHoliday === 'function')
    ? window.ClinicApi.isClinicHoliday(dateVal)
    : { isHoliday: false };

  if (isoDay === 5 || holidayCheck.isHoliday) {
    const reason = holidayCheck.isHoliday ? `${holidayCheck.name_en} (${holidayCheck.name_ar || ''})` : 'Weekly Friday Weekend';
    if (infoContainer) {
      infoContainer.innerHTML = `
        <div style="padding: 7px 10px; background: #FEF2F2; color: #991B1B; border: 1px solid #FCA5A5; border-radius: 6px; font-size: 11.5px; display: flex; align-items: center; gap: 6px;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          <span><strong>Clinic Closed:</strong> ${escapeHtml(reason)}. Doctor appointments cannot be scheduled on clinic holidays.</span>
        </div>
      `;
    }
    timeSelect.innerHTML = `<option value="" disabled selected>Clinic Closed on this date</option>`;
    if (submitBtn) submitBtn.disabled = true;
    return;
  }

  const shift = getDoctorShift(docObj);
  const workingDaysFormatted = docObj ? formatDoctorWorkingDays(docObj.working_days) : 'Sat – Thu';

  // 2. Check if doctor is off-duty on this date
  if (docObj && !isDoctorWorkingOnDate(docObj, targetDate)) {
    const dayName = targetDate.toLocaleDateString('en-GB', { weekday: 'long' });
    if (infoContainer) {
      infoContainer.innerHTML = `
        <div style="padding: 7px 10px; background: #FFFBEB; color: #92400E; border: 1px solid #FDE68A; border-radius: 6px; font-size: 11.5px;">
          <div style="display:flex; align-items:center; gap:6px; font-weight:600;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            <span>Doctor Off-Duty: ${escapeHtml(docObj.name_en)} is off on ${dayName}s</span>
          </div>
          <div style="margin-top: 3px; font-size: 11px; color: #B45309;">
            Scheduled working days: <strong>${workingDaysFormatted}</strong> (Shift: ${shift.start} – ${shift.end})
          </div>
        </div>
      `;
    }
    timeSelect.innerHTML = `<option value="" disabled selected>Doctor is off-duty on ${dayName}s</option>`;
    if (submitBtn) submitBtn.disabled = true;
    return;
  }

  // 3. Doctor is on duty! Enable submit button
  if (submitBtn) submitBtn.disabled = false;

  if (infoContainer) {
    infoContainer.innerHTML = `
      <div style="padding: 6px 10px; background: #F0FDF4; color: #166534; border: 1px solid #BBF7D0; border-radius: 6px; font-size: 11px; display: flex; align-items: center; justify-content: space-between;">
        <span>Active Shift: <strong>${shift.start} – ${shift.end}</strong></span>
        <span style="color: #15803D;">Working days: ${workingDaysFormatted}</span>
      </div>
    `;
  }

  // Find appointments already booked for this doctor on this date
  const bookedSlots = new Set();
  if (Array.isArray(appointmentsData)) {
    appointmentsData.forEach(a => {
      if ((a.status || '').toLowerCase() === 'cancelled') return;
      const aDate = parseApptDate(a.date);
      if (!isSameDay(aDate, targetDate)) return;

      const docIdMatch = docId && a.doctorId && Number(a.doctorId) === Number(docId);
      const docNameMatch = doctorName && a.doctor && (
        a.doctor.toLowerCase().includes(doctorName.toLowerCase()) ||
        doctorName.toLowerCase().includes(a.doctor.toLowerCase())
      );
      if (docIdMatch || docNameMatch) {
        const slot24 = parseSlotTo24h(a.timeShort || a.start_time || a.time || '');
        if (slot24) bookedSlots.add(slot24);
      }
    });
  }

  // Generate 30-min slots strictly within [shift.start, shift.end)
  const [startH, startM] = shift.start.split(':').map(Number);
  const [endH, endM] = shift.end.split(':').map(Number);
  const startMinutes = (startH || 8) * 60 + (startM || 0);
  const endMinutes = (endH || 17) * 60 + (endM || 0);

  const validSlots = [];
  for (let m = startMinutes; m < endMinutes; m += 30) {
    const h = Math.floor(m / 60);
    const min = m % 60;
    const time24 = `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
    const ampm = h >= 12 ? 'PM' : 'AM';
    const displayH = h % 12 === 0 ? 12 : h % 12;
    const label = `${String(displayH).padStart(2, '0')}:${String(min).padStart(2, '0')} ${ampm}`;
    const isBooked = bookedSlots.has(time24);
    validSlots.push({ time24, label, isBooked });
  }

  if (validSlots.length === 0) {
    timeSelect.innerHTML = `<option value="" disabled selected>No shift slots available</option>`;
    if (submitBtn) submitBtn.disabled = true;
    return;
  }

  const targetPreferred = preferredSlot ? (preferredSlot.includes(':') ? parseSlotTo24h(preferredSlot) : preferredSlot) : timeSelect.value;

  let optionsHtml = '';
  let selectedFound = false;

  validSlots.forEach(slot => {
    const isMatch = (!selectedFound && (slot.time24 === targetPreferred || (!targetPreferred && !slot.isBooked)));
    if (isMatch && !slot.isBooked) {
      selectedFound = true;
    }
    if (slot.isBooked) {
      optionsHtml += `<option value="${slot.time24}" disabled style="color:#94A3B8;">${slot.label} (Booked)</option>`;
    } else {
      optionsHtml += `<option value="${slot.time24}" ${isMatch ? 'selected' : ''}>${slot.label}</option>`;
    }
  });

  timeSelect.innerHTML = optionsHtml;
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
    if (window.ClinicDialog) {
      await window.ClinicDialog.alert('Required Information', 'Please provide patient full name and contact phone number.', 'warning');
    } else {
      alert('Please provide patient name and contact phone number.');
    }
    return;
  }

  const targetDate = parseApptDate(dateVal);
  if (!targetDate) {
    if (window.ClinicDialog) {
      await window.ClinicDialog.alert('Invalid Date', 'Please select a valid appointment date.', 'warning');
    }
    return;
  }

  const now = new Date();
  const todayZero = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const selectedDateZero = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());

  // Rule 1: No Past Booking
  if (selectedDateZero < todayZero) {
    if (window.ClinicDialog) {
      await window.ClinicDialog.alert(
        'Past Date Booking Blocked',
        'Cannot schedule appointments on a past date. Please choose today or an upcoming clinic date.',
        'danger'
      );
    } else {
      alert('Cannot schedule appointments in the past.');
    }
    return;
  }

  // Rule 2: Booking Horizon (Max 30 days) - BOOKING_TOO_FAR_AHEAD
  const maxDate = new Date(todayZero.getTime() + 30 * 24 * 60 * 60 * 1000);
  if (selectedDateZero > maxDate) {
    if (window.ClinicDialog) {
      await window.ClinicDialog.alert(
        'Booking Horizon Exceeded (BOOKING_TOO_FAR_AHEAD)',
        'Appointments can only be scheduled up to 30 days in advance per clinic policy. Please select a date within the next 30 days.',
        'warning'
      );
    } else {
      alert('Appointments can only be scheduled up to 30 days ahead (BOOKING_TOO_FAR_AHEAD).');
    }
    return;
  }

  // Rule 3: 30-Minute Interval (:00 or :30) - INVALID_SLOT_TIME
  const [slotH, slotM] = (time || '').split(':').map(Number);
  if (![0, 30].includes(slotM)) {
    if (window.ClinicDialog) {
      await window.ClinicDialog.alert(
        'Invalid Slot Time (INVALID_SLOT_TIME)',
        'Appointments must be booked in 30-minute intervals aligned on :00 or :30.',
        'warning'
      );
    } else {
      alert('Invalid slot time. Appointments must be 30-minute slots starting on :00 or :30.');
    }
    return;
  }

  // Rule 4: Minimum Lead Time (1 hour) - BOOKING_TOO_SOON
  const slotDateTime = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), slotH, slotM);
  const minLeadDateTime = new Date(now.getTime() + 60 * 60 * 1000);
  if (slotDateTime < minLeadDateTime) {
    if (window.ClinicDialog) {
      await window.ClinicDialog.alert(
        'Booking Too Soon (BOOKING_TOO_SOON)',
        'Appointments must be scheduled with at least 1 hour advance notice. Please select a later time slot.',
        'warning'
      );
    } else {
      alert('Appointments must be scheduled with at least 1 hour advance notice (BOOKING_TOO_SOON).');
    }
    return;
  }

  // Rule 5: Clinic Closures & Friday Weekend - CLINIC_CLOSED
  const isoDay = getIsoWeekday(targetDate);
  const holidayCheck = (window.ClinicApi && typeof window.ClinicApi.isClinicHoliday === 'function')
    ? window.ClinicApi.isClinicHoliday(dateVal)
    : { isHoliday: false };
  if (isoDay === 5 || holidayCheck.isHoliday) {
    const reason = holidayCheck.isHoliday ? `${holidayCheck.name_en} (${holidayCheck.name_ar || ''})` : 'Weekly Friday Weekend';
    if (window.ClinicDialog) {
      await window.ClinicDialog.alert(
        'Clinic Closed (CLINIC_CLOSED)',
        `The clinic is closed on this date (${reason}). Regular doctor appointments cannot be scheduled on clinic holidays.`,
        'warning'
      );
    } else {
      alert(`The clinic is closed on this date (${reason}).`);
    }
    return;
  }

  // Rule 6: Doctor Availability & Shifts - DOCTOR_UNAVAILABLE
  const selectedDocObj = liveDoctorsCache.find(d => (docId && d.id === docId) || d.name_en === doctor);
  if (selectedDocObj) {
    if (!isDoctorWorkingOnDate(selectedDocObj, targetDate)) {
      if (window.ClinicDialog) {
        await window.ClinicDialog.alert(
          'Doctor Unavailable (DOCTOR_UNAVAILABLE)',
          `${escapeHtml(selectedDocObj.name_en)} does not work on ${targetDate.toLocaleDateString('en-GB', { weekday: 'long' })}. Please choose another working day or a different doctor.`,
          'warning'
        );
      } else {
        alert(`${selectedDocObj.name_en} is off-duty on this day.`);
      }
      return;
    }
    const slot24 = `${String(slotH).padStart(2, '0')}:${String(slotM).padStart(2, '0')}`;
    const startShift = (selectedDocObj.shift_start || '08:00').slice(0, 5);
    const endShift = (selectedDocObj.shift_end || '17:00').slice(0, 5);
    if (slot24 < startShift || slot24 >= endShift) {
      if (window.ClinicDialog) {
        await window.ClinicDialog.alert(
          'Outside Working Hours (DOCTOR_UNAVAILABLE)',
          `${escapeHtml(selectedDocObj.name_en)} working hours are ${startShift} – ${endShift}. Slot ${slot24} is outside their active shift.`,
          'warning'
        );
      } else {
        alert(`${selectedDocObj.name_en} working hours are ${startShift} – ${endShift}.`);
      }
      return;
    }
  }

  // Active appointments for this patient
  const patientActiveAppts = appointmentsData.filter(a => {
    if ((a.status || '').toLowerCase() === 'cancelled') return false;
    const patIdMatch = selectedPatientId && a.patient_id && String(a.patient_id) === String(selectedPatientId);
    const phoneMatch = phone && a.patientPhone && a.patientPhone.replace(/\D/g, '') === phone.replace(/\D/g, '');
    const nameMatch = name && a.patientName && a.patientName.trim().toLowerCase() === name.trim().toLowerCase();
    return patIdMatch || phoneMatch || nameMatch;
  });

  // Rule 7: Duplicate Doctor Same Day - DUPLICATE_DOCTOR_SAME_DAY
  const sameDayWithSameDoctor = patientActiveAppts.some(a => {
    const aDate = parseApptDate(a.date);
    if (!isSameDay(aDate, targetDate)) return false;
    const dMatch = (docId && a.doctorId && Number(a.doctorId) === Number(docId)) ||
                   (a.doctor && doctor && a.doctor.toLowerCase().includes(doctor.toLowerCase()));
    return dMatch;
  });
  if (sameDayWithSameDoctor) {
    if (window.ClinicDialog) {
      await window.ClinicDialog.alert(
        'Duplicate Doctor Booking (DUPLICATE_DOCTOR_SAME_DAY)',
        `This patient already has an active appointment with ${escapeHtml(doctor)} on ${dateVal}. Per safety policy, only 1 appointment per doctor per day is allowed.`,
        'warning'
      );
    } else {
      alert(`Already booked with this doctor that day (DUPLICATE_DOCTOR_SAME_DAY).`);
    }
    return;
  }

  // Rule 8: Max 2 Appointments per Day - DAILY_LIMIT_REACHED
  const sameDayCount = patientActiveAppts.filter(a => {
    const aDate = parseApptDate(a.date);
    return isSameDay(aDate, targetDate);
  }).length;
  if (sameDayCount >= 2) {
    if (window.ClinicDialog) {
      await window.ClinicDialog.alert(
        'Daily Limit Reached (DAILY_LIMIT_REACHED)',
        `This patient already has ${sameDayCount} appointments scheduled on ${dateVal}. The maximum allowed is 2 appointments per patient per day.`,
        'warning'
      );
    } else {
      alert('Daily appointment limit reached (DAILY_LIMIT_REACHED).');
    }
    return;
  }

  // Rule 9: Max 5 Active Appointments Overall - ACTIVE_LIMIT_REACHED
  if (patientActiveAppts.length >= 5) {
    if (window.ClinicDialog) {
      await window.ClinicDialog.alert(
        'Active Limit Reached (ACTIVE_LIMIT_REACHED)',
        `This patient already has ${patientActiveAppts.length} active scheduled appointments. The maximum allowed is 5 active appointments per patient account.`,
        'warning'
      );
    } else {
      alert('Active appointment limit reached (ACTIVE_LIMIT_REACHED).');
    }
    return;
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
      showToast(`Successfully scheduled appointment for ${name} with ${doctor}.`, 'success');
      await loadLiveCatalog();
      if (created && created.id) {
        selectScheduleSlot(created.id, null);
      }
    } else {
      closeAdminModal();
    }
  } catch (err) {
    console.error('[Appointments] Booking error:', err);
    let title = 'Booking Error';
    let msg = err.message || 'Database error';
    if (err.code === 'BOOKING_TOO_SOON') {
      title = 'Booking Too Soon (BOOKING_TOO_SOON)';
      msg = 'Appointments must be scheduled with at least 1 hour advance notice.';
    } else if (err.code === 'BOOKING_TOO_FAR_AHEAD') {
      title = 'Booking Horizon Exceeded (BOOKING_TOO_FAR_AHEAD)';
      msg = 'Appointments can only be scheduled up to 30 days ahead.';
    } else if (err.code === 'DUPLICATE_DOCTOR_SAME_DAY') {
      title = 'Duplicate Booking (DUPLICATE_DOCTOR_SAME_DAY)';
      msg = 'Already booked with this doctor that day.';
    } else if (err.code === 'DAILY_LIMIT_REACHED') {
      title = 'Daily Limit Reached (DAILY_LIMIT_REACHED)';
      msg = 'Patient has reached the 2 appointments per day limit.';
    } else if (err.code === 'ACTIVE_LIMIT_REACHED') {
      title = 'Active Limit Reached (ACTIVE_LIMIT_REACHED)';
      msg = 'Patient has reached the 5 active appointments limit.';
    } else if (err.code === 'CLINIC_CLOSED') {
      title = 'Clinic Closed (CLINIC_CLOSED)';
      msg = 'The clinic is closed on the selected date.';
    } else if (err.code === 'DOCTOR_UNAVAILABLE') {
      title = 'Doctor Unavailable (DOCTOR_UNAVAILABLE)';
      msg = 'Doctor is unavailable or off-duty at this slot.';
    } else if (err.code === 'SLOT_UNAVAILABLE') {
      title = 'Slot Unavailable (SLOT_UNAVAILABLE)';
      msg = 'This slot has just been booked by another patient. Please choose another slot.';
    }

    if (window.ClinicDialog) {
      await window.ClinicDialog.alert(title, msg, 'danger');
    } else {
      alert(`${title}: ${msg}`);
    }
  }
}

// Reschedule Modal
function openRescheduleModal() {
  if (!selectedAppointment) return;

  const apptDateTime = getApptDateTime(selectedAppointment);
  const now = new Date();
  if (apptDateTime) {
    const hoursNotice = (apptDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);
    if (hoursNotice < 4) {
      if (window.ClinicDialog) {
        window.ClinicDialog.alert(
          'Reschedule Window Closed (CHANGE_WINDOW_CLOSED)',
          `Appointments cannot be rescheduled within 4 hours of scheduled time (currently ${hoursNotice.toFixed(1)} hours away). Per clinic policy, changes require four hours notice.`,
          'warning'
        );
      } else {
        alert('Appointments cannot be rescheduled within 4 hours of scheduled time (CHANGE_WINDOW_CLOSED).');
      }
      return;
    }
  }

  const todayIso = formatDateIso(now);
  const maxDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const maxHorizonIso = formatDateIso(maxDate);

  const reschedTimeSlotOptions = [
    '08:00', '08:30', '09:00', '09:30', '10:00', '10:30',
    '11:00', '11:30', '12:00', '12:30', '13:00', '13:30',
    '14:00', '14:30', '15:00', '15:30', '16:00', '16:30',
    '17:00', '17:30', '18:00', '18:30', '19:00', '19:30'
  ].map(t => {
    const [hStr, mStr] = t.split(':');
    let h = parseInt(hStr, 10);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const displayH = h % 12 === 0 ? 12 : h % 12;
    const label = `${String(displayH).padStart(2, '0')}:${mStr} ${ampm}`;
    return `<option value="${t}">${label}</option>`;
  }).join('');

  const bodyHtml = `
    <div style="display:flex; flex-direction:column; gap:14px;">
      <div style="background:#F8FAFC; border:1px solid var(--border-light); border-radius:8px; padding:12px;">
        <div style="font-weight:700; color:var(--text-dark);">${escapeHtml(selectedAppointment.patientName)} (${escapeHtml(selectedAppointment.patientCode || '')})</div>
        <div style="font-size:12px; color:var(--text-muted); margin-top:2px;">Currently with ${escapeHtml(selectedAppointment.doctor)} on ${escapeHtml(selectedAppointment.date)} at ${escapeHtml(selectedAppointment.time)}</div>
      </div>
      <div>
        <label style="display:block; font-size:12px; font-weight:600; color:var(--text-dark); margin-bottom:4px;">New Target Date *</label>
        <input type="date" id="reschedDate" onchange="refreshReschedTimeSlots()" value="${todayIso}" min="${todayIso}" max="${maxHorizonIso}" style="width:100%; padding:9px 12px; border:1px solid var(--border-light); border-radius:8px; font-size:13px; font-family:inherit;">
      </div>
      <div>
        <label style="display:block; font-size:12px; font-weight:600; color:var(--text-dark); margin-bottom:4px;">New Time Slot (30 mins) *</label>
        <select id="reschedTime" style="width:100%; padding:9px 12px; border:1px solid var(--border-light); border-radius:8px; font-size:13px; font-family:inherit; background:#FFF;">
          ${reschedTimeSlotOptions}
        </select>
      </div>
      <div id="reschedShiftInfo" style="margin-top:-6px;"></div>
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
  setTimeout(() => {
    refreshReschedTimeSlots();
  }, 20);
}

function refreshReschedTimeSlots() {
  if (!selectedAppointment) return;
  const dateInput = document.getElementById('reschedDate');
  const timeSelect = document.getElementById('reschedTime');
  const infoContainer = document.getElementById('reschedShiftInfo');
  const submitBtn = document.querySelector('.admin-modal-footer .modal-btn-primary');

  if (!dateInput || !timeSelect) return;

  const dateVal = dateInput.value;
  const targetDate = parseApptDate(dateVal);
  if (!targetDate) return;

  const selectedDocObj = liveDoctorsCache.find(d => {
    if (selectedAppointment.doctorId && d.id === selectedAppointment.doctorId) return true;
    if (selectedAppointment.doctor && (
      d.name_en.toLowerCase().includes(selectedAppointment.doctor.toLowerCase()) ||
      selectedAppointment.doctor.toLowerCase().includes(d.name_en.toLowerCase())
    )) return true;
    return false;
  });

  // 1. Check Friday / Holiday
  const isoDay = getIsoWeekday(targetDate);
  const holidayCheck = (window.ClinicApi && typeof window.ClinicApi.isClinicHoliday === 'function')
    ? window.ClinicApi.isClinicHoliday(dateVal)
    : { isHoliday: false };

  if (isoDay === 5 || holidayCheck.isHoliday) {
    const reason = holidayCheck.isHoliday ? `${holidayCheck.name_en} (${holidayCheck.name_ar || ''})` : 'Weekly Friday Weekend';
    if (infoContainer) {
      infoContainer.innerHTML = `
        <div style="padding: 7px 10px; background: #FEF2F2; color: #991B1B; border: 1px solid #FCA5A5; border-radius: 6px; font-size: 11.5px; display: flex; align-items: center; gap: 6px;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          <span><strong>Clinic Closed:</strong> ${escapeHtml(reason)}. Cannot reschedule to clinic holidays.</span>
        </div>
      `;
    }
    timeSelect.innerHTML = `<option value="" disabled selected>Clinic Closed on this date</option>`;
    if (submitBtn) submitBtn.disabled = true;
    return;
  }

  const shift = getDoctorShift(selectedDocObj);
  const workingDaysFormatted = selectedDocObj ? formatDoctorWorkingDays(selectedDocObj.working_days) : 'Sat – Thu';

  // 2. Doctor off-duty
  if (selectedDocObj && !isDoctorWorkingOnDate(selectedDocObj, targetDate)) {
    const dayName = targetDate.toLocaleDateString('en-GB', { weekday: 'long' });
    if (infoContainer) {
      infoContainer.innerHTML = `
        <div style="padding: 7px 10px; background: #FFFBEB; color: #92400E; border: 1px solid #FDE68A; border-radius: 6px; font-size: 11.5px;">
          <div style="display:flex; align-items:center; gap:6px; font-weight:600;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            <span>Doctor Off-Duty: ${escapeHtml(selectedDocObj.name_en)} is off on ${dayName}s</span>
          </div>
          <div style="margin-top: 3px; font-size: 11px; color: #B45309;">
            Scheduled working days: <strong>${workingDaysFormatted}</strong> (Shift: ${shift.start} – ${shift.end})
          </div>
        </div>
      `;
    }
    timeSelect.innerHTML = `<option value="" disabled selected>Doctor is off-duty on ${dayName}s</option>`;
    if (submitBtn) submitBtn.disabled = true;
    return;
  }

  if (submitBtn) submitBtn.disabled = false;

  if (infoContainer) {
    infoContainer.innerHTML = `
      <div style="padding: 6px 10px; background: #F0FDF4; color: #166534; border: 1px solid #BBF7D0; border-radius: 6px; font-size: 11px; display: flex; align-items: center; justify-content: space-between;">
        <span>Active Shift: <strong>${shift.start} – ${shift.end}</strong></span>
        <span style="color: #15803D;">Working days: ${workingDaysFormatted}</span>
      </div>
    `;
  }

  // Find booked slots for this doctor on targetDate (excluding this appointment itself)
  const bookedSlots = new Set();
  if (Array.isArray(appointmentsData)) {
    appointmentsData.forEach(a => {
      if (a.id === selectedAppointment.id) return;
      if ((a.status || '').toLowerCase() === 'cancelled') return;
      const aDate = parseApptDate(a.date);
      if (!isSameDay(aDate, targetDate)) return;

      const docIdMatch = selectedAppointment.doctorId && a.doctorId && Number(a.doctorId) === Number(selectedAppointment.doctorId);
      const docNameMatch = selectedAppointment.doctor && a.doctor && (
        a.doctor.toLowerCase().includes(selectedAppointment.doctor.toLowerCase()) ||
        selectedAppointment.doctor.toLowerCase().includes(a.doctor.toLowerCase())
      );
      if (docIdMatch || docNameMatch) {
        const slot24 = parseSlotTo24h(a.timeShort || a.start_time || a.time || '');
        if (slot24) bookedSlots.add(slot24);
      }
    });
  }

  const [startH, startM] = shift.start.split(':').map(Number);
  const [endH, endM] = shift.end.split(':').map(Number);
  const startMinutes = (startH || 8) * 60 + (startM || 0);
  const endMinutes = (endH || 17) * 60 + (endM || 0);

  const validSlots = [];
  for (let m = startMinutes; m < endMinutes; m += 30) {
    const h = Math.floor(m / 60);
    const min = m % 60;
    const time24 = `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
    const ampm = h >= 12 ? 'PM' : 'AM';
    const displayH = h % 12 === 0 ? 12 : h % 12;
    const label = `${String(displayH).padStart(2, '0')}:${String(min).padStart(2, '0')} ${ampm}`;
    const isBooked = bookedSlots.has(time24);
    validSlots.push({ time24, label, isBooked });
  }

  if (validSlots.length === 0) {
    timeSelect.innerHTML = `<option value="" disabled selected>No shift slots available</option>`;
    if (submitBtn) submitBtn.disabled = true;
    return;
  }

  const currentSlot24 = parseSlotTo24h(selectedAppointment.timeShort || selectedAppointment.time || '');
  let optionsHtml = '';
  let selectedFound = false;

  validSlots.forEach(slot => {
    const isMatch = (!selectedFound && slot.time24 === currentSlot24 && !slot.isBooked);
    if (isMatch) selectedFound = true;

    if (slot.isBooked) {
      optionsHtml += `<option value="${slot.time24}" disabled style="color:#94A3B8;">${slot.label} (Booked)</option>`;
    } else {
      optionsHtml += `<option value="${slot.time24}" ${isMatch ? 'selected' : ''}>${slot.label}</option>`;
    }
  });

  timeSelect.innerHTML = optionsHtml;
}

async function confirmRescheduleAppointment() {
  if (!selectedAppointment) return;

  const newDate = document.getElementById('reschedDate').value;
  const newTime = document.getElementById('reschedTime').value;
  const reason = document.getElementById('reschedReason').value;

  const currentApptDateTime = getApptDateTime(selectedAppointment);
  const now = new Date();
  if (currentApptDateTime) {
    const hoursNotice = (currentApptDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);
    if (hoursNotice < 4) {
      if (window.ClinicDialog) {
        await window.ClinicDialog.alert(
          'Reschedule Window Closed (CHANGE_WINDOW_CLOSED)',
          `Appointments cannot be rescheduled within 4 hours of scheduled time (currently ${hoursNotice.toFixed(1)} hours away). Per clinic policy, changes require four hours notice.`,
          'warning'
        );
      } else {
        alert('Appointments cannot be rescheduled within 4 hours of scheduled time (CHANGE_WINDOW_CLOSED).');
      }
      return;
    }
  }

  const currentSlot24 = parseSlotTo24h(selectedAppointment.timeShort || selectedAppointment.time || '00:00');
  const currentApptDate = formatDateIso(parseApptDate(selectedAppointment.date));
  if (currentApptDate === newDate && currentSlot24 === newTime) {
    if (window.ClinicDialog) {
      await window.ClinicDialog.alert(
        'Same Slot (SAME_SLOT)',
        'The selected slot is identical to the current appointment time. Please choose a different date or time.',
        'warning'
      );
    } else {
      alert('The selected slot is identical to the current appointment time.');
    }
    return;
  }

  // Validate new slot
  const targetDate = parseApptDate(newDate);
  if (!targetDate) return;
  const todayZero = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const targetZero = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());

  if (targetZero < todayZero) {
    if (window.ClinicDialog) {
      await window.ClinicDialog.alert('Past Date Blocked', 'Cannot reschedule to a past date.', 'danger');
    }
    return;
  }

  const maxHorizon = new Date(todayZero.getTime() + 30 * 24 * 60 * 60 * 1000);
  if (targetZero > maxHorizon) {
    if (window.ClinicDialog) {
      await window.ClinicDialog.alert('Booking Horizon Exceeded', 'Appointments can only be scheduled up to 30 days ahead (BOOKING_TOO_FAR_AHEAD).', 'warning');
    }
    return;
  }

  const [reschedH, reschedM] = newTime.split(':').map(Number);
  const targetDateTime = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), reschedH, reschedM);
  const minLead = new Date(now.getTime() + 60 * 60 * 1000);
  if (targetDateTime < minLead) {
    if (window.ClinicDialog) {
      await window.ClinicDialog.alert('Booking Too Soon', 'Rescheduled appointments require at least 1 hour advance notice (BOOKING_TOO_SOON).', 'warning');
    }
    return;
  }

  // Clinic closure check
  const isFriday = getIsoWeekday(targetDate) === 5;
  const holidayCheck = (window.ClinicApi && typeof window.ClinicApi.isClinicHoliday === 'function')
    ? window.ClinicApi.isClinicHoliday(newDate)
    : { isHoliday: false };
  if (isFriday || holidayCheck.isHoliday) {
    const holidayName = holidayCheck.isHoliday ? `${holidayCheck.name_en} (${holidayCheck.name_ar || ''})` : 'Weekly Friday Weekend';
    if (window.ClinicDialog) {
      await window.ClinicDialog.alert('Clinic Closed (CLINIC_CLOSED)', `The clinic is closed on this date (${holidayName}). Please choose an open clinic date.`, 'warning');
    }
    return;
  }

  // Doctor availability & shift check
  const selectedDocObj = liveDoctorsCache.find(d => {
    if (selectedAppointment.doctorId && d.id === selectedAppointment.doctorId) return true;
    if (selectedAppointment.doctor && (
      d.name_en.toLowerCase().includes(selectedAppointment.doctor.toLowerCase()) ||
      selectedAppointment.doctor.toLowerCase().includes(d.name_en.toLowerCase())
    )) return true;
    return false;
  });

  if (selectedDocObj) {
    if (!isDoctorWorkingOnDate(selectedDocObj, targetDate)) {
      const workingDaysFormatted = formatDoctorWorkingDays(selectedDocObj.working_days);
      if (window.ClinicDialog) {
        await window.ClinicDialog.alert(
          'Doctor Unavailable (DOCTOR_UNAVAILABLE)',
          `${escapeHtml(selectedDocObj.name_en)} does not work on ${targetDate.toLocaleDateString('en-GB', { weekday: 'long' })}s. Scheduled working days: ${workingDaysFormatted}.`,
          'warning'
        );
      } else {
        alert(`${selectedDocObj.name_en} is off-duty on this day.`);
      }
      return;
    }
    const slot24 = `${String(reschedH).padStart(2, '0')}:${String(reschedM).padStart(2, '0')}`;
    const { start: startShift, end: endShift } = getDoctorShift(selectedDocObj);
    if (slot24 < startShift || slot24 >= endShift) {
      if (window.ClinicDialog) {
        await window.ClinicDialog.alert(
          'Outside Working Hours (DOCTOR_UNAVAILABLE)',
          `${escapeHtml(selectedDocObj.name_en)} working shift is ${startShift} – ${endShift}. Slot ${slot24} is outside their active shift.`,
          'warning'
        );
      } else {
        alert(`${selectedDocObj.name_en} working shift is ${startShift} – ${endShift}.`);
      }
      return;
    }
  }

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
    let title = 'Reschedule Failed';
    let msg = err.message || 'Database error';
    if (err.code === 'CHANGE_WINDOW_CLOSED') {
      title = 'Change Window Closed (CHANGE_WINDOW_CLOSED)';
      msg = 'Changes require four hours notice.';
    } else if (err.code === 'SAME_SLOT') {
      title = 'Same Slot (SAME_SLOT)';
      msg = 'Choose a different slot.';
    } else if (err.code === 'BOOKING_TOO_SOON') {
      title = 'Booking Too Soon (BOOKING_TOO_SOON)';
      msg = 'Choose a later slot at least 1 hour in advance.';
    } else if (err.code === 'BOOKING_TOO_FAR_AHEAD') {
      title = 'Booking Too Far Ahead (BOOKING_TOO_FAR_AHEAD)';
      msg = 'Choose a nearer slot within 30 days.';
    } else if (err.code === 'DOCTOR_UNAVAILABLE') {
      title = 'Doctor Unavailable (DOCTOR_UNAVAILABLE)';
      msg = 'Doctor is unavailable or off-duty at this slot.';
    } else if (err.code === 'SLOT_UNAVAILABLE') {
      title = 'Slot Unavailable (SLOT_UNAVAILABLE)';
      msg = 'This slot is already booked.';
    }

    if (window.ClinicDialog) {
      await window.ClinicDialog.alert(title, msg, 'danger');
    } else {
      alert(`${title}: ${msg}`);
    }
  }
}

// Cancel Appointment
async function handleCancelAppointment() {
  if (!selectedAppointment) return;

  const apptDateTime = getApptDateTime(selectedAppointment);
  const now = new Date();
  if (apptDateTime) {
    const hoursNotice = (apptDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);
    if (hoursNotice < 4) {
      if (window.ClinicDialog) {
        await window.ClinicDialog.alert(
          'Cancellation Window Closed (CHANGE_WINDOW_CLOSED)',
          `Appointments cannot be cancelled within 4 hours of scheduled time (currently ${hoursNotice.toFixed(1)} hours away). Per clinic policy, changes require four hours notice.`,
          'warning'
        );
      } else {
        alert('Appointments cannot be cancelled within 4 hours of scheduled time (CHANGE_WINDOW_CLOSED).');
      }
      return;
    }
  }

  const confirmed = window.ClinicDialog ? await window.ClinicDialog.confirm({
    title: 'Cancel Appointment?',
    message: `Are you sure you want to cancel the appointment for <strong>${escapeHtml(selectedAppointment.patientName)}</strong> on ${selectedAppointment.date} (${selectedAppointment.time})?`,
    confirmText: 'Yes, Cancel Appointment',
    cancelText: 'Keep Appointment',
    type: 'danger'
  }) : confirm(`Are you sure you want to cancel the appointment for ${selectedAppointment.patientName} on ${selectedAppointment.date}?`);

  if (confirmed) {
    try {
      if (window.ClinicApi) {
        try {
          await window.ClinicApi.cancelAppointment(selectedAppointment.id, {
            reason: 'Cancelled by operator'
          });
        } catch (apiErr) {
          if (apiErr.status === 404 || apiErr.code === 'APPOINTMENT_NOT_FOUND') {
            console.warn('[Appointments] Legacy local appointment removed:', selectedAppointment.id);
          } else {
            throw apiErr;
          }
        }
      }

      // Mark as Cancelled in memory
      const cancelledPatientName = selectedAppointment.patientName;
      const cancelledId = selectedAppointment.id;
      appointmentsData = appointmentsData.map(a => a.id === cancelledId ? { ...a, status: 'Cancelled' } : a);
      saveAppointmentsStore();

      // Deselect and clear details panel
      selectedAppointment = null;
      renderScheduleGrid();
      populateAppointmentDetails(null);
      showToast(`Appointment #${cancelledId} for ${cancelledPatientName} has been cancelled and removed from active schedule.`, 'warning');

      if (window.ClinicApi) {
        await loadLiveCatalog();
      }
    } catch (err) {
      console.error('[Appointments] Cancellation error:', err);
      let title = 'Cancellation Error';
      let msg = err.message || 'Database error';
      if (err.code === 'CHANGE_WINDOW_CLOSED') {
        title = 'Change Window Closed (CHANGE_WINDOW_CLOSED)';
        msg = 'Appointments cannot be cancelled within 4 hours of scheduled time.';
      }
      if (window.ClinicDialog) {
        await window.ClinicDialog.alert(title, msg, 'danger');
      } else {
        alert(`${title}: ${msg}`);
      }
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
  link.setAttribute("download", `shiffaa_clinics_appointments_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  showToast('Appointments schedule exported successfully as CSV.', 'success');
}

// Open All Upcoming Modal (Executive Queue View)
let upcomingModalFilter = 'all';

function openAllUpcomingModal() {
  upcomingModalFilter = 'all';
  const activeUpcoming = appointmentsData.filter(a => (a.status || '').toLowerCase() !== 'cancelled');

  const total = activeUpcoming.length;
  const confirmed = activeUpcoming.filter(a => (a.status || '').toLowerCase() === 'confirmed' || (a.status || '').toLowerCase() === 'scheduled').length;
  const pending = activeUpcoming.filter(a => (a.status || '').toLowerCase() === 'pending').length;
  const todayCount = activeUpcoming.filter(a => {
    const aDate = parseApptDate(a.date);
    return isSameDay(aDate, new Date());
  }).length;

  let bodyHtml = `
    <div class="upcoming-modal-wrapper">
      <div class="upcoming-modal-toolbar">
        <div class="upcoming-search-input-box">
          <svg viewBox="0 0 24 24" fill="none" stroke="#94A3B8" stroke-width="2" width="16" height="16">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input type="text" id="upcomingModalSearch" placeholder="Search by patient, phone, doctor, or department..." oninput="filterUpcomingModalList()">
        </div>
        <div class="upcoming-filter-pills">
          <button class="upcoming-filter-pill-btn active" data-filter="all" onclick="setUpcomingFilter('all', this)">All (${total})</button>
          <button class="upcoming-filter-pill-btn" data-filter="confirmed" onclick="setUpcomingFilter('confirmed', this)">Confirmed (${confirmed})</button>
          <button class="upcoming-filter-pill-btn" data-filter="pending" onclick="setUpcomingFilter('pending', this)">Pending (${pending})</button>
          <button class="upcoming-filter-pill-btn" data-filter="today" onclick="setUpcomingFilter('today', this)">Today (${todayCount})</button>
        </div>
      </div>

      <div class="upcoming-cards-container" id="upcomingCardsContainer">
        ${renderUpcomingCardsHtml(activeUpcoming)}
      </div>
    </div>
  `;

  const footerHtml = `
    <div style="margin-right:auto; font-size:12px; color:var(--text-muted); font-weight:600;" id="upcomingModalSummaryText">
      Showing ${total} upcoming appointment(s)
    </div>
    <button class="modal-btn-secondary" onclick="closeAdminModal()">Close</button>
    <button class="modal-btn-primary" onclick="closeAdminModal(); openNewAppointmentModal();" style="display:inline-flex; align-items:center; gap:6px;">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" width="15" height="15"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
      Schedule New
    </button>
  `;

  openAdminModal(`Upcoming Consultation Queue (${total})`, bodyHtml, footerHtml, 'modal-xl');
}

function renderUpcomingCardsHtml(list) {
  if (!list || list.length === 0) {
    return `
      <div style="padding: 40px 16px; text-align: center; color: var(--text-muted);">
        <svg viewBox="0 0 24 24" fill="none" stroke="#94A3B8" stroke-width="1.8" width="48" height="48" style="margin-bottom: 12px;">
          <rect width="18" height="18" x="3" y="4" rx="2" ry="2"/>
          <line x1="16" y1="2" x2="16" y2="6"/>
          <line x1="8" y1="2" x2="8" y2="6"/>
          <line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
        <div style="font-weight: 700; color: var(--text-dark); font-size: 15px; margin-bottom: 4px;">No Matching Appointments</div>
        <p style="font-size: 12.5px; margin: 0;">Try adjusting your search query or switching active filter tabs.</p>
      </div>
    `;
  }

  return list.map(a => {
    let statusClass = 'status-confirmed';
    const st = (a.status || '').toLowerCase();
    if (st === 'pending') statusClass = 'status-pending';
    else if (st === 'in clinic') statusClass = 'status-inclinic';

    const pAvatar = a.patientAvatar || (a.patientName ? a.patientName.charAt(0).toUpperCase() : 'P');
    const pCode = a.patientCode || `#${a.id}`;
    const pPhone = a.patientPhone || 'No contact provided';

    return `
      <div class="upcoming-card-row">
        <div class="upcoming-card-left">
          <div class="upcoming-card-avatar" style="background:${a.patientAvatarBg || '#EFF6FF'}; color:${a.patientAvatarColor || '#2563EB'};">
            ${pAvatar}
          </div>
          <div class="upcoming-card-meta">
            <div class="upcoming-card-name-row">
              <span class="upcoming-card-name">${escapeHtml(a.patientName)}</span>
              <span class="upcoming-card-id-badge">${escapeHtml(pCode)}</span>
              <span style="font-size:11.5px; color:var(--text-muted);">• ${escapeHtml(pPhone)}</span>
            </div>
            <div class="upcoming-card-doctor-row">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              <strong style="color:var(--text-dark);">${escapeHtml(a.doctor)}</strong>
              <span style="color:var(--primary-blue); font-weight:600;">(${escapeHtml(a.doctorDept)})</span>
              <span style="font-size:11px; color:#94A3B8;">— ${escapeHtml(a.type || 'Consultation')}</span>
            </div>
          </div>
        </div>

        <div class="upcoming-card-right">
          <div class="upcoming-card-timing">
            <div class="upcoming-card-time">${escapeHtml(a.timeShort || a.time)}</div>
            <div class="upcoming-card-date">${escapeHtml(a.date)}</div>
            <div><span class="status-pill ${statusClass}" style="margin-top:2px;">• ${escapeHtml(a.status)}</span></div>
          </div>
          <div class="upcoming-card-actions">
            <button type="button" class="upcoming-btn-action btn-primary-action" onclick="jumpToAppointment(${a.id})" title="Jump directly to this appointment on calendar">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              View on Grid
            </button>
            <button type="button" class="upcoming-btn-action" onclick="closeAdminModal(); selectScheduleSlot(${a.id}, null); handleStartCallWithPatient();" title="Start direct call with patient">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
              Call
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function filterUpcomingModalList() {
  const query = (document.getElementById('upcomingModalSearch') ? document.getElementById('upcomingModalSearch').value : '').toLowerCase().trim();
  const container = document.getElementById('upcomingCardsContainer');
  const summary = document.getElementById('upcomingModalSummaryText');
  if (!container) return;

  let list = appointmentsData.filter(a => (a.status || '').toLowerCase() !== 'cancelled');

  if (upcomingModalFilter === 'confirmed') {
    list = list.filter(a => (a.status || '').toLowerCase() === 'confirmed' || (a.status || '').toLowerCase() === 'scheduled');
  } else if (upcomingModalFilter === 'pending') {
    list = list.filter(a => (a.status || '').toLowerCase() === 'pending');
  } else if (upcomingModalFilter === 'today') {
    list = list.filter(a => {
      const aDate = parseApptDate(a.date);
      return isSameDay(aDate, new Date());
    });
  }

  if (query) {
    list = list.filter(a => 
      (a.patientName && a.patientName.toLowerCase().includes(query)) ||
      (a.patientPhone && a.patientPhone.toLowerCase().includes(query)) ||
      (a.doctor && a.doctor.toLowerCase().includes(query)) ||
      (a.doctorDept && a.doctorDept.toLowerCase().includes(query)) ||
      (a.patientCode && a.patientCode.toLowerCase().includes(query)) ||
      (String(a.id).includes(query))
    );
  }

  container.innerHTML = renderUpcomingCardsHtml(list);
  if (summary) summary.textContent = `Showing ${list.length} appointment(s)`;
}

function setUpcomingFilter(filterType, btn) {
  upcomingModalFilter = filterType;
  document.querySelectorAll('.upcoming-filter-pills .upcoming-filter-pill-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  filterUpcomingModalList();
}

function jumpToAppointment(apptId) {
  const found = appointmentsData.find(a => a.id === apptId);
  if (!found) return;

  const aDate = parseApptDate(found.date);
  if (aDate) {
    selectedDate = new Date(aDate);
    miniCalYear = selectedDate.getFullYear();
    miniCalMonth = selectedDate.getMonth();
  }

  // Switch to day view for that date
  currentInterval = 'day';
  document.querySelectorAll('.segmented-pill-group .seg-pill-btn').forEach(b => {
    b.classList.remove('active');
    if (b.textContent.trim().toLowerCase() === 'day') b.classList.add('active');
  });

  updateDateHeading();
  renderMiniCalendar();
  renderSchedule();

  selectScheduleSlot(found.id, null);
  closeAdminModal();
  showToast(`Navigated to appointment for ${found.patientName} on ${found.date}.`, 'success');
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

async function handleLogout() {
  const confirmed = window.ClinicDialog ? await window.ClinicDialog.confirm({
    title: 'Sign Out of Clinic Console?',
    message: 'Are you sure you want to log out of Shiffaa Clinics Admin Console?',
    confirmText: 'Sign Out',
    cancelText: 'Stay Signed In',
    type: 'danger'
  }) : confirm('Are you sure you want to log out of the Clinic Admin Console?');

  if (confirmed) {
    showToast('Admin logged out successfully. Redirecting...', 'info');
  }
}

function toggleNotifications() {
  showToast('Appointments System: 18 scheduled sessions today, doctor schedules synced.', 'info');
}

function openAdminModal(title, bodyHtml, footerHtml = '', sizeClass = '') {
  const backdrop = document.getElementById('adminModalBackdrop');
  const container = document.getElementById('adminModalContainer');
  const titleEl = document.getElementById('adminModalTitle');
  const bodyEl = document.getElementById('adminModalBody');
  const footerEl = document.getElementById('adminModalFooter');

  if (container) {
    container.classList.remove('modal-lg', 'modal-xl');
    if (sizeClass) container.classList.add(sizeClass);
  }

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
  const container = document.getElementById('adminModalContainer');
  if (container) {
    container.classList.remove('modal-lg', 'modal-xl');
  }
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

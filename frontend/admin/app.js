/**
 * Nile Clinics - Admin Dashboard Interactive Controller
 * Enterprise AI Call Center & Clinic Management Console
 */

document.addEventListener('DOMContentLoaded', () => {
  initClock();
  initLiveCallTimer();
  initGlobalShortcuts();
  initSidebarNav();
  initSearchFilter();
  loadLiveOverviewCatalog();
});

/* =============================================================================
   1. LIVE CLOCK & DATE TICKER
   ============================================================================= */
function initClock() {
  const dateEl = document.getElementById('liveDateText');
  const timeEl = document.getElementById('liveTimeText');

  function update() {
    const now = new Date();
    
    // Formatting matching reference: "Tue, 12 Nov 2024"
    const optionsDate = { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' };
    const dateStr = now.toLocaleDateString('en-GB', optionsDate);
    
    // Formatting matching reference: "10:24 AM"
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
   2. LIVE CALL TIMER & CONTROLS
   ============================================================================= */
let callTimerSeconds = 154; // 00:02:34 base matching reference
let callTimerInterval = null;
let isCallMuted = false;
let isCallOnHold = false;
let isCallActive = true;

function initLiveCallTimer() {
  const timerEl = document.getElementById('liveCallTimer');
  if (!timerEl) return;

  if (callTimerInterval) clearInterval(callTimerInterval);

  callTimerInterval = setInterval(() => {
    if (!isCallActive || isCallOnHold) return;
    callTimerSeconds++;
    
    const hrs = Math.floor(callTimerSeconds / 3600);
    const mins = Math.floor((callTimerSeconds % 3600) / 60);
    const secs = callTimerSeconds % 60;

    const formatted = `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    timerEl.textContent = formatted;
  }, 1000);
}

function toggleMuteCall(btn) {
  isCallMuted = !isCallMuted;
  if (isCallMuted) {
    btn.classList.add('active-ctrl-btn');
    btn.style.backgroundColor = '#FEE2E2';
    btn.style.color = '#DC2626';
    showToast('Microphone muted', 'warning');
  } else {
    btn.classList.remove('active-ctrl-btn');
    btn.style.backgroundColor = '';
    btn.style.color = '';
    showToast('Microphone unmuted', 'info');
  }
}

function toggleHoldCall(btn) {
  isCallOnHold = !isCallOnHold;
  const badge = document.getElementById('liveCallBadge');

  if (isCallOnHold) {
    btn.classList.add('active-ctrl-btn');
    btn.style.backgroundColor = '#FEF3C7';
    btn.style.color = '#D97706';
    if (badge) {
      badge.innerHTML = '<span class="live-blinking-dot" style="background:#D97706"></span><span>On Hold</span>';
      badge.style.background = '#FEF3C7';
      badge.style.color = '#B45309';
    }
    showToast('Call placed on hold', 'warning');
  } else {
    btn.classList.remove('active-ctrl-btn');
    btn.style.backgroundColor = '';
    btn.style.color = '';
    if (badge) {
      badge.innerHTML = '<span class="live-blinking-dot"></span><span>Live</span>';
      badge.style.background = '#DCFCE7';
      badge.style.color = '#15803D';
    }
    showToast('Call resumed', 'success');
  }
}

function endCurrentLiveCall() {
  isCallActive = false;
  const liveCallContent = document.getElementById('liveCallContent');
  const emptyState = document.getElementById('liveCallEmptyState');
  const badge = document.getElementById('liveCallBadge');
  const timer = document.getElementById('liveCallTimer');
  const metricActive = document.getElementById('metricActiveCalls');
  const sideBadge = document.getElementById('liveCallsCountBadge');

  if (liveCallContent) liveCallContent.style.display = 'none';
  if (emptyState) emptyState.style.display = 'flex';
  if (badge) {
    badge.innerHTML = '<span>Idle</span>';
    badge.style.background = '#F1F5F9';
    badge.style.color = '#64748B';
  }
  if (timer) timer.textContent = '00:00:00';
  if (metricActive) metricActive.textContent = '1';
  if (sideBadge) sideBadge.textContent = '1';

  showToast('Live call with Mona Ahmed ended and logged', 'info');
}

function simulateNewIncomingCall() {
  isCallActive = true;
  isCallMuted = false;
  isCallOnHold = false;
  callTimerSeconds = 3;

  const liveCallContent = document.getElementById('liveCallContent');
  const emptyState = document.getElementById('liveCallEmptyState');
  const badge = document.getElementById('liveCallBadge');
  const metricActive = document.getElementById('metricActiveCalls');
  const sideBadge = document.getElementById('liveCallsCountBadge');

  if (liveCallContent) liveCallContent.style.display = 'flex';
  if (emptyState) emptyState.style.display = 'none';
  if (badge) {
    badge.innerHTML = '<span class="live-blinking-dot"></span><span>Live</span>';
    badge.style.background = '#DCFCE7';
    badge.style.color = '#15803D';
  }
  if (metricActive) metricActive.textContent = '2';
  if (sideBadge) sideBadge.textContent = '2';

  initLiveCallTimer();
  showToast('Incoming call connected: Mona Ahmed (+20 101 234 5678)', 'success');
}

/* =============================================================================
   3. CALENDAR STRIP & APPOINTMENTS SELECTION
   ============================================================================= */
const dailyAppointmentsData = {
  10: [], // Empty state demonstration: Sunday has no clinic slots
  11: [
    { time: '09:00 AM', doctor: 'Dr. Mahmoud Taha', dept: 'Cardiology', status: 'confirmed' },
    { time: '11:00 AM', doctor: 'Dr. Mona Khaled', dept: 'Cardiology', status: 'confirmed' },
    { time: '01:30 PM', doctor: 'Dr. Youssef Hassan', dept: 'General Medicine', status: 'confirmed' }
  ],
  12: [
    { time: '09:00 AM', doctor: 'Ahmed Mohamed', dept: 'Cardiology', status: 'confirmed' },
    { time: '10:30 AM', doctor: 'Sara Elsaid', dept: 'Dermatology', status: 'inclinic' },
    { time: '12:00 PM', doctor: 'Mohamed Ali', dept: 'Orthopedics', status: 'confirmed' },
    { time: '02:30 PM', doctor: 'Mona Khaled', dept: 'Cardiology', status: 'pending' },
    { time: '04:00 PM', doctor: 'Youssef Hassan', dept: 'General Medicine', status: 'confirmed' }
  ],
  13: [
    { time: '10:00 AM', doctor: 'Sara Elsaid', dept: 'Dermatology', status: 'confirmed' },
    { time: '11:30 AM', doctor: 'Dr. Tarek Omar', dept: 'Pediatrics', status: 'confirmed' },
    { time: '03:00 PM', doctor: 'Ahmed Mohamed', dept: 'Cardiology', status: 'pending' }
  ],
  14: [
    { time: '09:30 AM', doctor: 'Dr. Ahmed Ezz', dept: 'Dentistry', status: 'confirmed' },
    { time: '02:00 PM', doctor: 'Dr. Mahmoud Taha', dept: 'Cardiology', status: 'confirmed' }
  ],
  15: [
    { time: '01:00 PM', doctor: 'Sara Elsaid', dept: 'Dermatology', status: 'confirmed' },
    { time: '03:30 PM', doctor: 'Mohamed Ali', dept: 'Orthopedics', status: 'confirmed' }
  ],
  16: [] // Empty state demonstration: Saturday clinic closed
};

function selectCalendarDay(dayNum, cellEl) {
  const allCells = document.querySelectorAll('.cal-day-cell');
  allCells.forEach(c => {
    c.classList.remove('active');
    const numSpan = c.querySelector('.day-num-active');
    if (numSpan) numSpan.className = 'day-num';
  });

  cellEl.classList.add('active');
  const targetNum = cellEl.querySelector('.day-num');
  if (targetNum) targetNum.className = 'day-num-active';

  const container = document.getElementById('appointmentsListContainer');
  const emptyState = document.getElementById('appointmentsEmptyState');
  const items = dailyAppointmentsData[dayNum] || [];

  if (items.length === 0) {
    if (container) container.style.display = 'none';
    if (emptyState) emptyState.style.display = 'flex';
  } else {
    if (emptyState) emptyState.style.display = 'none';
    if (container) {
      container.style.display = 'flex';
      renderAppointmentsList(items);
    }
  }
}

function renderAppointmentsList(items) {
  const container = document.getElementById('appointmentsListContainer');
  if (!container) return;

  container.innerHTML = items.map(item => {
    let statusClass = 'status-confirmed';
    let statusLabel = '• Confirmed';
    if (item.status === 'inclinic') {
      statusClass = 'status-inclinic';
      statusLabel = '• In Clinic';
    } else if (item.status === 'pending') {
      statusClass = 'status-pending';
      statusLabel = '• Pending';
    }

    return `
      <div class="appointment-row-item">
        <span class="appt-time-cell">${item.time}</span>
        <span class="appt-doctor-cell">${item.doctor}</span>
        <span class="appt-dept-cell">${item.dept}</span>
        <span class="status-pill ${statusClass}">${statusLabel}</span>
      </div>
    `;
  }).join('');
}

function shiftWeek(dir) {
  showToast(dir > 0 ? 'Viewing next week: Nov 17 - Nov 23' : 'Viewing previous week: Nov 03 - Nov 09', 'info');
}

/* =============================================================================
   3.5 LIVE FASTAPI CATALOG SYNC
   ============================================================================= */
async function loadLiveOverviewCatalog() {
  if (!window.ClinicApi) return;
  try {
    const docData = await ClinicApi.getDoctors({ limit: 50 });
    if (docData && Array.isArray(docData.doctors) && docData.doctors.length > 0) {
      const liveDoctors = docData.doctors;
      // Enrich schedule items with real doctor names and specialties from FastAPI
      Object.keys(dailyAppointmentsData).forEach((dayKey) => {
        const slots = dailyAppointmentsData[dayKey];
        slots.forEach((slot, idx) => {
          const doc = liveDoctors[idx % liveDoctors.length];
          if (doc) {
            slot.doctor = doc.name_en;
            if (doc.specialty) slot.dept = doc.specialty.name_en;
          }
        });
      });

      // Re-render currently active day
      const activeCell = document.querySelector('.cal-day-cell.active');
      if (activeCell) {
        const dayNum = parseInt(activeCell.textContent.trim());
        if (dayNum) selectCalendarDay(dayNum, activeCell);
      }
    }
  } catch (err) {
    console.debug('[ClinicApi] Overview catalog load warning:', err.message);
  }
}

/* =============================================================================
   4. MODALS & POPUPS
   ============================================================================= */
function openAdminModal(title, bodyHtml, footerHtml = '') {
  const backdrop = document.getElementById('adminModalBackdrop');
  const titleEl = document.getElementById('adminModalTitle');
  const bodyEl = document.getElementById('adminModalBody');
  const footerEl = document.getElementById('adminModalFooter');

  if (titleEl) titleEl.textContent = title;
  if (bodyEl) bodyEl.innerHTML = bodyHtml;
  if (footerEl) {
    footerEl.innerHTML = footerHtml || `
      <button class="modal-btn-secondary" onclick="closeAdminModal()">Close</button>
    `;
  }

  if (backdrop) backdrop.classList.add('open');
}

function closeAdminModal(e) {
  if (e && e.target && e.target.id !== 'adminModalBackdrop' && !e.target.closest('.modal-close-icon-btn') && !e.target.classList.contains('modal-btn-secondary')) {
    return;
  }
  const backdrop = document.getElementById('adminModalBackdrop');
  if (backdrop) backdrop.classList.remove('open');
}

// 4.1 Full Live Transcript Modal
function openFullTranscriptModal() {
  const html = `
    <div style="display:flex; flex-direction:column; gap:16px;">
      <div style="background:#F8FAFC; border:1px solid #E2E8F0; border-radius:10px; padding:12px 16px; display:flex; justify-content:space-between; align-items:center;">
        <div>
          <div style="font-weight:700; color:#0F172A;">Mona Ahmed (+20 101 234 5678)</div>
          <div style="font-size:12px; color:#64748B;">Channel: Voice Call (Arabic - Egyptian العامية) • Started 10:22:15 AM</div>
        </div>
        <span class="live-pill-badge" style="margin:0;"><span class="live-blinking-dot"></span><span>Streaming</span></span>
      </div>

      <div style="display:flex; flex-direction:column; gap:12px; max-height:360px; overflow-y:auto; padding-right:6px;">
        <div class="transcript-line caller-line">
          <div class="trans-speaker-badge caller-badge">
            <svg viewBox="0 0 24 24" fill="none" stroke="#2563EB" stroke-width="2" width="16" height="16"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91"/></svg>
          </div>
          <div class="trans-speech-bubble">
            <div class="speech-header-row"><span class="speaker-title">Caller (AR)</span><span class="speech-time">10:22:18 AM</span></div>
            <p class="arabic-speech-text">السلام عليكم، كنت عايزه اعرف مواعيد دكتور القلب لو سمحت؟</p>
          </div>
        </div>

        <div class="transcript-line agent-line">
          <div class="trans-speaker-badge agent-badge">
            <svg viewBox="0 0 24 24" fill="none" stroke="#7C3AED" stroke-width="2" width="16" height="16"><path d="M12 2v4"/><path d="m4.93 10.93 2.83-2.83"/><path d="M2 18h4"/><path d="M20 18h2"/><path d="m19.07 10.93-2.83-2.83"/><circle cx="12" cy="18" r="4"/></svg>
          </div>
          <div class="trans-speech-bubble">
            <div class="speech-header-row"><span class="speaker-title">AI Assistant</span><span class="speech-time">10:22:21 AM</span></div>
            <p class="agent-speech-text">وعليكم السلام يا أستاذة منى! أهلاً بحضرتك في عيادات النيل. دكتور محمود طه ودكتورة منى خالد استشاريين القلب متاحين يوم الخميس والسبت القادمين. تحبي معاد في أي فترة؟</p>
          </div>
        </div>

        <div class="transcript-line caller-line">
          <div class="trans-speaker-badge caller-badge">
            <svg viewBox="0 0 24 24" fill="none" stroke="#2563EB" stroke-width="2" width="16" height="16"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91"/></svg>
          </div>
          <div class="trans-speech-bubble">
            <div class="speech-header-row"><span class="speaker-title">Caller (AR)</span><span class="speech-time">10:22:34 AM</span></div>
            <p class="arabic-speech-text">عايزه احجز مع دكتور القلب يوم الخميس بعد الضهر</p>
          </div>
        </div>

        <div class="transcript-line agent-line">
          <div class="trans-speaker-badge agent-badge">
            <svg viewBox="0 0 24 24" fill="none" stroke="#7C3AED" stroke-width="2" width="16" height="16"><path d="M12 2v4"/><path d="m4.93 10.93 2.83-2.83"/><path d="M2 18h4"/><path d="M20 18h2"/><path d="m19.07 10.93-2.83-2.83"/><circle cx="12" cy="18" r="4"/></svg>
          </div>
          <div class="trans-speech-bubble">
            <div class="speech-header-row"><span class="speaker-title">AI Assistant</span><span class="speech-time">10:22:38 AM</span></div>
            <p class="agent-speech-text">تمام جداً يا فندم. متاح لحضرتك معادين يوم الخميس 14 نوفمبر: الساعة 2:30 بعد الضهر أو الساعة 4:15 عصراً مع دكتور محمود طه. أيهم أنسب لحضرتك؟</p>
          </div>
        </div>
      </div>
    </div>
  `;

  const footer = `
    <button class="modal-btn-secondary" onclick="closeAdminModal()">Close</button>
    <button class="modal-btn-primary" onclick="showToast('Transferring to senior human receptionist...', 'info'); closeAdminModal();">Transfer Call to Human</button>
  `;

  openAdminModal('Live Call Transcript & Audio Stream', html, footer);
}

// 4.2 Call Details from Recent Calls Table
function openCallDetailModal(callerName, phone, intent, dept, duration, status) {
  const html = `
    <div style="display:flex; flex-direction:column; gap:16px;">
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; background:#F8FAFC; border:1px solid #E2E8F0; padding:16px; border-radius:10px;">
        <div>
          <span style="font-size:11px; text-transform:uppercase; color:#64748B; font-weight:600;">Caller Information</span>
          <div style="font-size:15px; font-weight:700; color:#0F172A; margin-top:4px;">${callerName}</div>
          <div style="font-size:13px; color:#475569;">${phone}</div>
        </div>
        <div>
          <span style="font-size:11px; text-transform:uppercase; color:#64748B; font-weight:600;">Call Details</span>
          <div style="font-size:14px; font-weight:600; color:#0F172A; margin-top:4px;">${intent} (${dept})</div>
          <div style="font-size:13px; color:#475569;">Duration: ${duration} • Status: ${status}</div>
        </div>
      </div>

      <div>
        <h5 style="font-size:13px; font-weight:600; color:#0F172A; margin-bottom:8px;">Audio Recording</h5>
        <div style="background:#F1F5F9; border-radius:8px; padding:10px 14px; display:flex; align-items:center; gap:12px;">
          <button style="border:none; background:#2563EB; color:#fff; width:34px; height:34px; border-radius:50%; display:flex; align-items:center; justify-content:center; cursor:pointer;" onclick="showToast('Playing recorded voice session audio...', 'info')">
            <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          </button>
          <div style="flex:1; height:6px; background:#CBD5E1; border-radius:3px; position:relative;">
            <div style="width:40%; height:100%; background:#2563EB; border-radius:3px;"></div>
          </div>
          <span style="font-size:12px; font-weight:600; color:#475569;">${duration}</span>
        </div>
      </div>

      <div>
        <h5 style="font-size:13px; font-weight:600; color:#0F172A; margin-bottom:6px;">Automated Summary</h5>
        <p style="font-size:13px; line-height:1.5; color:#334155; margin:0; background:#FAFAFA; border:1px solid #E5E7EB; border-radius:8px; padding:12px;">
          Patient inquired regarding availability in the <strong>${dept}</strong> department for follow-up consultation. System confirmed insurance eligibility and offered slots. Resolution concluded successfully without human escalation.
        </p>
      </div>
    </div>
  `;

  const footer = `
    <button class="modal-btn-secondary" onclick="closeAdminModal()">Close</button>
    <button class="modal-btn-primary" onclick="showToast('Exported call summary & transcript PDF', 'success'); closeAdminModal();">Export PDF</button>
  `;

  openAdminModal(`Call Record: ${callerName}`, html, footer);
}

// 4.3 New Appointment Modal
function openNewAppointmentModal() {
  const html = `
    <form id="newApptForm" onsubmit="handleNewAppointmentSubmit(event)" style="display:flex; flex-direction:column; gap:14px;">
      <div>
        <label style="display:block; font-size:12px; font-weight:600; color:#475569; margin-bottom:6px;">Patient Full Name</label>
        <input type="text" id="apptPatientName" required placeholder="e.g. Mona Ahmed" style="width:100%; height:38px; border:1px solid #CBD5E1; border-radius:6px; padding:0 12px; font-size:13px;">
      </div>
      <div>
        <label style="display:block; font-size:12px; font-weight:600; color:#475569; margin-bottom:6px;">Phone Number</label>
        <input type="tel" id="apptPatientPhone" required placeholder="+20 10X XXX XXXX" value="+20 " style="width:100%; height:38px; border:1px solid #CBD5E1; border-radius:6px; padding:0 12px; font-size:13px;">
      </div>
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
        <div>
          <label style="display:block; font-size:12px; font-weight:600; color:#475569; margin-bottom:6px;">Department</label>
          <select id="apptDept" style="width:100%; height:38px; border:1px solid #CBD5E1; border-radius:6px; padding:0 10px; font-size:13px; background:#fff;">
            <option value="Cardiology">Cardiology</option>
            <option value="Dermatology">Dermatology</option>
            <option value="Orthopedics">Orthopedics</option>
            <option value="Pediatrics">Pediatrics</option>
            <option value="General Medicine">General Medicine</option>
          </select>
        </div>
        <div>
          <label style="display:block; font-size:12px; font-weight:600; color:#475569; margin-bottom:6px;">Doctor</label>
          <select id="apptDoctor" style="width:100%; height:38px; border:1px solid #CBD5E1; border-radius:6px; padding:0 10px; font-size:13px; background:#fff;">
            <option value="Ahmed Mohamed">Dr. Ahmed Mohamed</option>
            <option value="Sara Elsaid">Dr. Sara Elsaid</option>
            <option value="Mohamed Ali">Dr. Mohamed Ali</option>
            <option value="Mona Khaled">Dr. Mona Khaled</option>
            <option value="Youssef Hassan">Dr. Youssef Hassan</option>
          </select>
        </div>
      </div>
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
        <div>
          <label style="display:block; font-size:12px; font-weight:600; color:#475569; margin-bottom:6px;">Date</label>
          <input type="date" id="apptDate" required value="2024-11-14" style="width:100%; height:38px; border:1px solid #CBD5E1; border-radius:6px; padding:0 12px; font-size:13px;">
        </div>
        <div>
          <label style="display:block; font-size:12px; font-weight:600; color:#475569; margin-bottom:6px;">Time Slot</label>
          <select id="apptTime" style="width:100%; height:38px; border:1px solid #CBD5E1; border-radius:6px; padding:0 10px; font-size:13px; background:#fff;">
            <option value="09:00 AM">09:00 AM</option>
            <option value="10:30 AM">10:30 AM</option>
            <option value="12:00 PM">12:00 PM</option>
            <option value="02:30 PM">02:30 PM</option>
            <option value="04:00 PM">04:00 PM</option>
          </select>
        </div>
      </div>
      <div>
        <label style="display:block; font-size:12px; font-weight:600; color:#475569; margin-bottom:6px;">Clinical Notes</label>
        <textarea id="apptNotes" placeholder="Reason for visit, referral details..." style="width:100%; height:64px; border:1px solid #CBD5E1; border-radius:6px; padding:8px 12px; font-size:13px; resize:none;"></textarea>
      </div>
      <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:8px;">
        <button type="button" class="modal-btn-secondary" onclick="closeAdminModal()">Cancel</button>
        <button type="submit" class="modal-btn-primary">Confirm Booking</button>
      </div>
    </form>
  `;

  openAdminModal('Schedule New Appointment', html);
}

function handleNewAppointmentSubmit(e) {
  e.preventDefault();
  const name = document.getElementById('apptPatientName').value.trim();
  const doctor = document.getElementById('apptDoctor').value;
  const dept = document.getElementById('apptDept').value;
  const time = document.getElementById('apptTime').value;

  const metricToday = document.getElementById('metricTodayAppts');
  if (metricToday) {
    const current = parseInt(metricToday.textContent, 10) || 18;
    metricToday.textContent = current + 1;
  }

  // Prepend to appointments list
  const container = document.getElementById('appointmentsListContainer');
  if (container) {
    const newRow = document.createElement('div');
    newRow.className = 'appointment-row-item';
    newRow.innerHTML = `
      <span class="appt-time-cell">${time}</span>
      <span class="appt-doctor-cell">${doctor}</span>
      <span class="appt-dept-cell">${dept}</span>
      <span class="status-pill status-confirmed">• Confirmed</span>
    `;
    container.prepend(newRow);
  }

  closeAdminModal();
  showToast(`Appointment confirmed for ${name} at ${time}`, 'success');
}

// 4.4 Find Patient Modal
function openFindPatientModal() {
  const html = `
    <div style="display:flex; flex-direction:column; gap:14px;">
      <div style="position:relative;">
        <input type="text" id="patientFilterInput" oninput="filterPatientsList(this.value)" placeholder="Type patient name, phone, or National ID..." style="width:100%; height:40px; border:1px solid #CBD5E1; border-radius:8px; padding:0 14px 0 38px; font-size:13px;">
        <svg viewBox="0 0 24 24" fill="none" stroke="#94A3B8" stroke-width="2" width="18" height="18" style="position:absolute; left:12px; top:11px;"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
      </div>

      <div id="patientSearchResults" style="display:flex; flex-direction:column; gap:8px; max-height:300px; overflow-y:auto;">
        <div class="patient-record-row" style="display:flex; justify-content:space-between; align-items:center; padding:10px 12px; background:#F8FAFC; border:1px solid #E2E8F0; border-radius:8px;">
          <div>
            <div style="font-weight:700; color:#0F172A; font-size:13px;">Mona Ahmed</div>
            <div style="font-size:12px; color:#64748B;">+20 101 234 5678 • Last visit: 12 Oct 2024 (Cardiology)</div>
          </div>
          <button class="modal-btn-secondary" style="height:30px; font-size:12px;" onclick="showToast('Loading medical profile: Mona Ahmed', 'info'); closeAdminModal();">View Profile</button>
        </div>

        <div class="patient-record-row" style="display:flex; justify-content:space-between; align-items:center; padding:10px 12px; background:#F8FAFC; border:1px solid #E2E8F0; border-radius:8px;">
          <div>
            <div style="font-weight:700; color:#0F172A; font-size:13px;">Ahmed Mohamed</div>
            <div style="font-size:12px; color:#64748B;">+20 109 876 5432 • Last visit: Today 09:00 AM (Cardiology)</div>
          </div>
          <button class="modal-btn-secondary" style="height:30px; font-size:12px;" onclick="showToast('Loading medical profile: Ahmed Mohamed', 'info'); closeAdminModal();">View Profile</button>
        </div>

        <div class="patient-record-row" style="display:flex; justify-content:space-between; align-items:center; padding:10px 12px; background:#F8FAFC; border:1px solid #E2E8F0; border-radius:8px;">
          <div>
            <div style="font-weight:700; color:#0F172A; font-size:13px;">Sara Elsaid</div>
            <div style="font-size:12px; color:#64748B;">+20 112 345 6789 • Last visit: In Clinic Now (Dermatology)</div>
          </div>
          <button class="modal-btn-secondary" style="height:30px; font-size:12px;" onclick="showToast('Loading medical profile: Sara Elsaid', 'info'); closeAdminModal();">View Profile</button>
        </div>
      </div>
    </div>
  `;

  openAdminModal('Find Patient Records', html);
}

function filterPatientsList(query) {
  const q = query.toLowerCase();
  const rows = document.querySelectorAll('.patient-record-row');
  rows.forEach(r => {
    if (r.textContent.toLowerCase().includes(q)) {
      r.style.display = 'flex';
    } else {
      r.style.display = 'none';
    }
  });
}

// 4.5 Add Knowledge Modal
function openAddKnowledgeModal() {
  const html = `
    <form onsubmit="handleAddKnowledgeSubmit(event)" style="display:flex; flex-direction:column; gap:14px;">
      <div>
        <label style="display:block; font-size:12px; font-weight:600; color:#475569; margin-bottom:6px;">Document Title</label>
        <input type="text" id="kbTitle" required placeholder="e.g. Cardiology Clinic Fees & Doctors Schedule 2024" style="width:100%; height:38px; border:1px solid #CBD5E1; border-radius:6px; padding:0 12px; font-size:13px;">
      </div>
      <div>
        <label style="display:block; font-size:12px; font-weight:600; color:#475569; margin-bottom:6px;">Category</label>
        <select id="kbCategory" style="width:100%; height:38px; border:1px solid #CBD5E1; border-radius:6px; padding:0 10px; font-size:13px; background:#fff;">
          <option value="FAQ">Doctor Schedules & Availability</option>
          <option value="Prices">Consultation Fees & Insurance</option>
          <option value="Policies">Cancellation & Rescheduling Policies</option>
          <option value="Services">Laboratory & Radiology Prep Guidelines</option>
        </select>
      </div>
      <div>
        <label style="display:block; font-size:12px; font-weight:600; color:#475569; margin-bottom:6px;">Knowledge Content (English / Arabic)</label>
        <textarea id="kbContent" required placeholder="Paste clinic policies, doctor schedules, or guidelines for the AI orchestrator to answer patient queries..." style="width:100%; height:100px; border:1px solid #CBD5E1; border-radius:6px; padding:10px 12px; font-size:13px; resize:none;"></textarea>
      </div>
      <div style="border:2px dashed #CBD5E1; border-radius:8px; padding:18px; text-align:center; background:#F8FAFC;">
        <svg viewBox="0 0 24 24" fill="none" stroke="#64748B" stroke-width="2" width="28" height="28" style="margin-bottom:6px;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
        <div style="font-size:13px; font-weight:600; color:#334155;">Drag and drop PDF / DOCX policy files here</div>
        <div style="font-size:11px; color:#94A3B8; margin-top:2px;">Supports up to 25MB (Parsed & Indexed to RAG Knowledge Base)</div>
      </div>
      <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:6px;">
        <button type="button" class="modal-btn-secondary" onclick="closeAdminModal()">Cancel</button>
        <button type="submit" class="modal-btn-primary">Upload & Vectorize</button>
      </div>
    </form>
  `;

  openAdminModal('Add Knowledge Base Document', html);
}

function handleAddKnowledgeSubmit(e) {
  e.preventDefault();
  const title = document.getElementById('kbTitle').value.trim();
  closeAdminModal();
  showToast(`Document "${title}" uploaded and indexed into RAG memory`, 'success');
}

// 4.6 View Analytics Modal
function openAnalyticsModal() {
  const html = `
    <div style="display:flex; flex-direction:column; gap:16px;">
      <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:12px;">
        <div style="background:#F8FAFC; border:1px solid #E2E8F0; padding:12px; border-radius:8px; text-align:center;">
          <div style="font-size:11px; color:#64748B; font-weight:600;">AVG RESOLUTION TIME</div>
          <div style="font-size:20px; font-weight:800; color:#0F172A; margin-top:4px;">1m 48s</div>
          <div style="font-size:11px; color:#10B981; font-weight:600;">↓ 14% vs last week</div>
        </div>
        <div style="background:#F8FAFC; border:1px solid #E2E8F0; padding:12px; border-radius:8px; text-align:center;">
          <div style="font-size:11px; color:#64748B; font-weight:600;">AI CONTAINMENT RATE</div>
          <div style="font-size:20px; font-weight:800; color:#0F172A; margin-top:4px;">92.4%</div>
          <div style="font-size:11px; color:#10B981; font-weight:600;">↑ 3.2% vs target</div>
        </div>
        <div style="background:#F8FAFC; border:1px solid #E2E8F0; padding:12px; border-radius:8px; text-align:center;">
          <div style="font-size:11px; color:#64748B; font-weight:600;">ARABIC NLU ACCURACY</div>
          <div style="font-size:20px; font-weight:800; color:#0F172A; margin-top:4px;">98.1%</div>
          <div style="font-size:11px; color:#10B981; font-weight:600;">Egyptian Dialect</div>
        </div>
      </div>

      <div>
        <h5 style="font-size:13px; font-weight:600; color:#0F172A; margin-bottom:8px;">Top Call Inquiries by Department</h5>
        <div style="display:flex; flex-direction:column; gap:8px;">
          <div>
            <div style="display:flex; justify-content:space-between; font-size:12px; font-weight:600; margin-bottom:4px;">
              <span>Cardiology (Heart Care)</span>
              <span>42%</span>
            </div>
            <div style="height:6px; background:#E2E8F0; border-radius:3px; overflow:hidden;">
              <div style="width:42%; height:100%; background:#2563EB;"></div>
            </div>
          </div>
          <div>
            <div style="display:flex; justify-content:space-between; font-size:12px; font-weight:600; margin-bottom:4px;">
              <span>Dermatology</span>
              <span>28%</span>
            </div>
            <div style="height:6px; background:#E2E8F0; border-radius:3px; overflow:hidden;">
              <div style="width:28%; height:100%; background:#10B981;"></div>
            </div>
          </div>
          <div>
            <div style="display:flex; justify-content:space-between; font-size:12px; font-weight:600; margin-bottom:4px;">
              <span>Orthopedics</span>
              <span>18%</span>
            </div>
            <div style="height:6px; background:#E2E8F0; border-radius:3px; overflow:hidden;">
              <div style="width:18%; height:100%; background:#F59E0B;"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  const footer = `
    <button class="modal-btn-secondary" onclick="closeAdminModal()">Close</button>
    <button class="modal-btn-primary" onclick="showToast('Exporting executive report...', 'info'); closeAdminModal();">Download Full Report</button>
  `;

  openAdminModal('Call Center Performance & Analytics', html, footer);
}

// 4.7 View All Appointments
function openAllAppointmentsModal() {
  const html = `
    <div style="display:flex; flex-direction:column; gap:12px;">
      <p style="font-size:13px; color:#64748B; margin:0;">Listing all scheduled patient appointments across all clinic departments.</p>
      <div style="display:flex; flex-direction:column; gap:8px; max-height:340px; overflow-y:auto;">
        <div class="appointment-row-item">
          <span class="appt-time-cell">09:00 AM</span>
          <span class="appt-doctor-cell">Ahmed Mohamed</span>
          <span class="appt-dept-cell">Cardiology</span>
          <span class="status-pill status-confirmed">• Confirmed</span>
        </div>
        <div class="appointment-row-item">
          <span class="appt-time-cell">10:30 AM</span>
          <span class="appt-doctor-cell">Sara Elsaid</span>
          <span class="appt-dept-cell">Dermatology</span>
          <span class="status-pill status-inclinic">• In Clinic</span>
        </div>
        <div class="appointment-row-item">
          <span class="appt-time-cell">12:00 PM</span>
          <span class="appt-doctor-cell">Mohamed Ali</span>
          <span class="appt-dept-cell">Orthopedics</span>
          <span class="status-pill status-confirmed">• Confirmed</span>
        </div>
        <div class="appointment-row-item">
          <span class="appt-time-cell">02:30 PM</span>
          <span class="appt-doctor-cell">Mona Khaled</span>
          <span class="appt-dept-cell">Cardiology</span>
          <span class="status-pill status-pending">• Pending</span>
        </div>
        <div class="appointment-row-item">
          <span class="appt-time-cell">04:00 PM</span>
          <span class="appt-doctor-cell">Youssef Hassan</span>
          <span class="appt-dept-cell">General Medicine</span>
          <span class="status-pill status-confirmed">• Confirmed</span>
        </div>
      </div>
    </div>
  `;

  const footer = `
    <button class="modal-btn-secondary" onclick="closeAdminModal()">Close</button>
    <button class="modal-btn-primary" onclick="openNewAppointmentModal()">Add New Appointment</button>
  `;

  openAdminModal('All Appointments (18 Today)', html, footer);
}

// 4.8 View All Calls
function openAllCallsModal() {
  const html = `
    <div style="display:flex; flex-direction:column; gap:12px;">
      <p style="font-size:13px; color:#64748B; margin:0;">Complete call history handled by AI voice orchestrator and clinic operators.</p>
      <div style="background:#F8FAFC; border:1px solid #E2E8F0; border-radius:8px; padding:12px; font-size:13px; color:#334155;">
        Total 148 calls processed today • 96% AI Resolved • 4% Human Escalation Rate
      </div>
    </div>
  `;

  openAdminModal('Call Logs History', html);
}

/* =============================================================================
   5. SEARCH FILTER & KEYBOARD SHORTCUTS
   ============================================================================= */
function initGlobalShortcuts() {
  document.addEventListener('keydown', (e) => {
    // Ctrl + K or Cmd + K triggers global search
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      const searchInput = document.getElementById('adminGlobalSearch');
      if (searchInput) {
        searchInput.focus();
        searchInput.select();
      }
    }
    // Escape closes open modal
    if (e.key === 'Escape') {
      closeAdminModal();
    }
  });
}

function initSearchFilter() {
  const searchInput = document.getElementById('adminGlobalSearch');
  if (!searchInput) return;

  searchInput.addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase().trim();

    // Filter Recent Calls Table
    const tableRows = document.querySelectorAll('#recentCallsTbody tr');
    let matchedCalls = 0;
    tableRows.forEach(row => {
      const text = row.textContent.toLowerCase();
      if (!q || text.includes(q)) {
        row.style.display = '';
        matchedCalls++;
      } else {
        row.style.display = 'none';
      }
    });

    // Filter Appointments List
    const apptRows = document.querySelectorAll('#appointmentsListContainer .appointment-row-item');
    let matchedAppts = 0;
    apptRows.forEach(item => {
      const text = item.textContent.toLowerCase();
      if (!q || text.includes(q)) {
        item.style.display = 'grid';
        matchedAppts++;
      } else {
        item.style.display = 'none';
      }
    });
  });
}

/* =============================================================================
   6. SIDEBAR NAVIGATION & CLINIC CONTROLS
   ============================================================================= */
function initSidebarNav() {
  const navLinks = document.querySelectorAll('.sidebar-nav .nav-link');
  navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      navLinks.forEach(l => l.classList.remove('active'));
      link.classList.add('active');

      const label = link.querySelector('.nav-text')?.textContent || 'Section';
      if (label === 'Live Calls') {
        window.location.href = 'live-calls.html';
      } else if (label === 'Appointments') {
        openAllAppointmentsModal();
      } else if (label === 'Patients') {
        window.location.href = 'patients.html';
      } else if (label === 'Knowledge Base' || label === 'Documents') {
        openAddKnowledgeModal();
      } else if (label === 'Analytics') {
        openAnalyticsModal();
      } else if (label === 'Settings') {
        showToast('Settings panel opens configuration for Voice Provider & LLM Adapter', 'info');
      }
    });
  });
}

function handleBranchChange(selectEl) {
  showToast(`Switched active clinic branch to: ${selectEl.value}`, 'success');
}

function handleLogout() {
  if (confirm('Are you sure you want to log out of the Clinic Admin Console?')) {
    showToast('Admin logged out successfully. Redirecting...', 'info');
  }
}

function toggleNotifications() {
  showToast('No critical clinical alerts. All 2 active voice agents operating normally.', 'info');
}

/* =============================================================================
   7. TOAST NOTIFICATION UTILITY
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

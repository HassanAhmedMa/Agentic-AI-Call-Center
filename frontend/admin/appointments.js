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
let appointmentsData = [
  // Dr. Ahmed Mohamed (Cardiology)
  {
    id: 101,
    patientName: "Mona Ahmed",
    patientPhone: "+20 101 234 5678",
    patientCode: "PT-2024-001",
    patientAvatar: "M",
    patientAvatarBg: "#EDE9FE",
    patientAvatarColor: "#7C3AED",
    doctor: "Dr. Ahmed Mohamed",
    doctorDept: "Cardiology",
    time: "09:00 AM - 09:30 AM",
    timeShort: "09:00 AM",
    date: "Thursday, 14 Nov 2024",
    type: "Follow-up",
    status: "Confirmed",
    branch: "Main Branch - Heliopolis",
    room: "Examination Room 204",
    notes: "Patient reported improved resting ECG. Follow-up regarding beta-blocker dosage adjustment.",
    insurance: "Allianz Egypt Gold #AZ-9982"
  },
  {
    id: 102,
    patientName: "Khaled Mahmoud",
    patientPhone: "+20 102 345 6789",
    patientCode: "PT-2024-002",
    patientAvatar: "K",
    patientAvatarBg: "#EFF6FF",
    patientAvatarColor: "#2563EB",
    doctor: "Dr. Ahmed Mohamed",
    doctorDept: "Cardiology",
    time: "10:30 AM - 11:00 AM",
    timeShort: "10:30 AM",
    date: "Thursday, 14 Nov 2024",
    type: "New Patient",
    status: "Confirmed",
    branch: "Main Branch - Heliopolis",
    room: "Examination Room 204",
    notes: "Initial cardiac evaluation for hypertension and shortness of breath.",
    insurance: "Bupa Global Premium"
  },
  {
    id: 103,
    patientName: "Nour Ibrahim",
    patientPhone: "+20 103 456 7890",
    patientCode: "PT-2024-003",
    patientAvatar: "N",
    patientAvatarBg: "#FEF3C7",
    patientAvatarColor: "#D97706",
    doctor: "Dr. Ahmed Mohamed",
    doctorDept: "Cardiology",
    time: "12:00 PM - 12:30 PM",
    timeShort: "12:00 PM",
    date: "Thursday, 14 Nov 2024",
    type: "Consultation",
    status: "Pending",
    branch: "Main Branch - Heliopolis",
    room: "Consultation Suite A",
    notes: "Second opinion on catheterization recommendation.",
    insurance: "AXA Health Standard"
  },
  {
    id: 104,
    patientName: "Youssef Ali",
    patientPhone: "+20 104 567 8901",
    patientCode: "PT-2024-004",
    patientAvatar: "Y",
    patientAvatarBg: "#DCFCE7",
    patientAvatarColor: "#16A34A",
    doctor: "Dr. Ahmed Mohamed",
    doctorDept: "Cardiology",
    time: "02:00 PM - 02:30 PM",
    timeShort: "02:00 PM",
    date: "Thursday, 14 Nov 2024",
    type: "Follow-up",
    status: "Confirmed",
    branch: "Main Branch - Heliopolis",
    room: "Examination Room 204",
    notes: "Lipid profile and treadmill stress test review.",
    insurance: "Self Pay"
  },
  {
    id: 105,
    patientName: "Salma Hassan",
    patientPhone: "+20 105 678 9012",
    patientCode: "PT-2024-005",
    patientAvatar: "S",
    patientAvatarBg: "#EFF6FF",
    patientAvatarColor: "#2563EB",
    doctor: "Dr. Ahmed Mohamed",
    doctorDept: "Cardiology",
    time: "04:00 PM - 04:30 PM",
    timeShort: "04:00 PM",
    date: "Thursday, 14 Nov 2024",
    type: "Consultation",
    status: "Confirmed",
    branch: "Main Branch - Heliopolis",
    room: "Examination Room 204",
    notes: "Post-arrhythmia holter monitor telemetry check.",
    insurance: "MetLife Egypt Corporate"
  },

  // Dr. Sara Elsayed (Dermatology)
  {
    id: 201,
    patientName: "Ahmed Hassan",
    patientPhone: "+20 106 789 0123",
    patientCode: "PT-2024-006",
    patientAvatar: "A",
    patientAvatarBg: "#EFF6FF",
    patientAvatarColor: "#2563EB",
    doctor: "Dr. Sara Elsayed",
    doctorDept: "Dermatology",
    time: "09:30 AM - 10:00 AM",
    timeShort: "09:30 AM",
    date: "Thursday, 14 Nov 2024",
    type: "New Patient",
    status: "Confirmed",
    branch: "Main Branch - Heliopolis",
    room: "Dermatology Clinic 1",
    notes: "Dermatoscopy skin lesion screening.",
    insurance: "AXA Health Standard"
  },
  {
    id: 202,
    patientName: "Laila Mohamed",
    patientPhone: "+20 107 890 1234",
    patientCode: "PT-2024-007",
    patientAvatar: "L",
    patientAvatarBg: "#EDE9FE",
    patientAvatarColor: "#7C3AED",
    doctor: "Dr. Sara Elsayed",
    doctorDept: "Dermatology",
    time: "11:00 AM - 11:30 AM",
    timeShort: "11:00 AM",
    date: "Thursday, 14 Nov 2024",
    type: "Follow-up",
    status: "Confirmed",
    branch: "Main Branch - Heliopolis",
    room: "Dermatology Clinic 1",
    notes: "Acne regimen evaluation after 4 weeks of treatment.",
    insurance: "Allianz Egypt Silver"
  },
  {
    id: 203,
    patientName: "Omar Khaled",
    patientPhone: "+20 108 901 2345",
    patientCode: "PT-2024-008",
    patientAvatar: "O",
    patientAvatarBg: "#FEF3C7",
    patientAvatarColor: "#D97706",
    doctor: "Dr. Sara Elsayed",
    doctorDept: "Dermatology",
    time: "01:00 PM - 01:30 PM",
    timeShort: "01:00 PM",
    date: "Thursday, 14 Nov 2024",
    type: "Consultation",
    status: "Confirmed",
    branch: "Main Branch - Heliopolis",
    room: "Dermatology Clinic 1",
    notes: "Eczema flare-up review and topical therapy adjustment.",
    insurance: "Self Pay"
  },
  {
    id: 204,
    patientName: "Mona Samir",
    patientPhone: "+20 109 012 3456",
    patientCode: "PT-2024-009",
    patientAvatar: "M",
    patientAvatarBg: "#EFF6FF",
    patientAvatarColor: "#2563EB",
    doctor: "Dr. Sara Elsayed",
    doctorDept: "Dermatology",
    time: "03:30 PM - 04:00 PM",
    timeShort: "03:30 PM",
    date: "Thursday, 14 Nov 2024",
    type: "New Patient",
    status: "Confirmed",
    branch: "Main Branch - Heliopolis",
    room: "Dermatology Clinic 1",
    notes: "Allergy patch testing results discussion.",
    insurance: "Bupa Global Premium"
  },
  {
    id: 205,
    patientName: "Hassan Mostafa",
    patientPhone: "+20 110 123 4567",
    patientCode: "PT-2024-010",
    patientAvatar: "H",
    patientAvatarBg: "#F1F5F9",
    patientAvatarColor: "#64748B",
    doctor: "Dr. Sara Elsayed",
    doctorDept: "Dermatology",
    time: "04:30 PM - 05:00 PM",
    timeShort: "04:30 PM",
    date: "Thursday, 14 Nov 2024",
    type: "Follow-up",
    status: "Cancelled",
    branch: "Main Branch - Heliopolis",
    room: "Dermatology Clinic 1",
    notes: "Patient cancelled due to travel conflict.",
    insurance: "MetLife Egypt Corporate"
  },

  // Dr. Mohamed Ali (Orthopedics)
  {
    id: 301,
    patientName: "Sara Mohamed",
    patientPhone: "+20 111 234 5678",
    patientCode: "PT-2024-011",
    patientAvatar: "S",
    patientAvatarBg: "#FEF3C7",
    patientAvatarColor: "#D97706",
    doctor: "Dr. Mohamed Ali",
    doctorDept: "Orthopedics",
    time: "08:30 AM - 09:00 AM",
    timeShort: "08:30 AM",
    date: "Thursday, 14 Nov 2024",
    type: "Consultation",
    status: "Confirmed",
    branch: "Main Branch - Heliopolis",
    room: "Orthopedic Suite 102",
    notes: "Knee MRI scan review and physiotherapy planning.",
    insurance: "Allianz Egypt Gold"
  },
  {
    id: 302,
    patientName: "Tarek Ali",
    patientPhone: "+20 112 345 6789",
    patientCode: "PT-2024-012",
    patientAvatar: "T",
    patientAvatarBg: "#EFF6FF",
    patientAvatarColor: "#2563EB",
    doctor: "Dr. Mohamed Ali",
    doctorDept: "Orthopedics",
    time: "10:00 AM - 10:30 AM",
    timeShort: "10:00 AM",
    date: "Thursday, 14 Nov 2024",
    type: "Follow-up",
    status: "Confirmed",
    branch: "Main Branch - Heliopolis",
    room: "Orthopedic Suite 102",
    notes: "Shoulder impingement rehabilitation review.",
    insurance: "AXA Health Standard"
  },
  {
    id: 303,
    patientName: "Mariam Adel",
    patientPhone: "+20 113 456 7890",
    patientCode: "PT-2024-013",
    patientAvatar: "M",
    patientAvatarBg: "#EDE9FE",
    patientAvatarColor: "#7C3AED",
    doctor: "Dr. Mohamed Ali",
    doctorDept: "Orthopedics",
    time: "12:30 PM - 01:00 PM",
    timeShort: "12:30 PM",
    date: "Thursday, 14 Nov 2024",
    type: "New Patient",
    status: "In Clinic",
    branch: "Main Branch - Heliopolis",
    room: "Orthopedic Suite 102",
    notes: "Acute ankle sprain with weight-bearing difficulty.",
    insurance: "Self Pay"
  },
  {
    id: 304,
    patientName: "Ahmed Ibrahim",
    patientPhone: "+20 114 567 8901",
    patientCode: "PT-2024-014",
    patientAvatar: "A",
    patientAvatarBg: "#DCFCE7",
    patientAvatarColor: "#16A34A",
    doctor: "Dr. Mohamed Ali",
    doctorDept: "Orthopedics",
    time: "03:00 PM - 03:30 PM",
    timeShort: "03:00 PM",
    date: "Thursday, 14 Nov 2024",
    type: "Consultation",
    status: "Confirmed",
    branch: "Main Branch - Heliopolis",
    room: "Orthopedic Suite 102",
    notes: "Lumbar spine disc herniation evaluation.",
    insurance: "Bupa Global Premium"
  },

  // Dr. Mona Khaled (Pediatrics)
  {
    id: 401,
    patientName: "Malak Ahmed",
    patientPhone: "+20 115 678 9012",
    patientCode: "PT-2024-015",
    patientAvatar: "M",
    patientAvatarBg: "#EDE9FE",
    patientAvatarColor: "#7C3AED",
    doctor: "Dr. Mona Khaled",
    doctorDept: "Pediatrics",
    time: "09:00 AM - 09:30 AM",
    timeShort: "09:00 AM",
    date: "Thursday, 14 Nov 2024",
    type: "New Patient",
    status: "Confirmed",
    branch: "Main Branch - Heliopolis",
    room: "Pediatric Care Center",
    notes: "Routine 18-month developmental milestones check.",
    insurance: "Allianz Egypt Silver"
  },
  {
    id: 402,
    patientName: "Omar Samir",
    patientPhone: "+20 116 789 0123",
    patientCode: "PT-2024-016",
    patientAvatar: "O",
    patientAvatarBg: "#FEF3C7",
    patientAvatarColor: "#D97706",
    doctor: "Dr. Mona Khaled",
    doctorDept: "Pediatrics",
    time: "11:30 AM - 12:00 PM",
    timeShort: "11:30 AM",
    date: "Thursday, 14 Nov 2024",
    type: "Follow-up",
    status: "Confirmed",
    branch: "Main Branch - Heliopolis",
    room: "Pediatric Care Center",
    notes: "Pediatric asthma inhaler response assessment.",
    insurance: "AXA Health Standard"
  },
  {
    id: 403,
    patientName: "Nour Khaled",
    patientPhone: "+20 117 890 1234",
    patientCode: "PT-2024-017",
    patientAvatar: "N",
    patientAvatarBg: "#EFF6FF",
    patientAvatarColor: "#2563EB",
    doctor: "Dr. Mona Khaled",
    doctorDept: "Pediatrics",
    time: "02:00 PM - 02:30 PM",
    timeShort: "02:00 PM",
    date: "Thursday, 14 Nov 2024",
    type: "Consultation",
    status: "Pending",
    branch: "Main Branch - Heliopolis",
    room: "Pediatric Care Center",
    notes: "Persistent cough and mild low-grade fever.",
    insurance: "Self Pay"
  },
  {
    id: 404,
    patientName: "Salma Ali",
    patientPhone: "+20 118 901 2345",
    patientCode: "PT-2024-018",
    patientAvatar: "S",
    patientAvatarBg: "#FEE2E2",
    patientAvatarColor: "#DC2626",
    doctor: "Dr. Mona Khaled",
    doctorDept: "Pediatrics",
    time: "04:00 PM - 04:30 PM",
    timeShort: "04:00 PM",
    date: "Thursday, 14 Nov 2024",
    type: "Follow-up",
    status: "Confirmed",
    branch: "Main Branch - Heliopolis",
    room: "Pediatric Care Center",
    notes: "Urgent ear ache assessment - suspected acute otitis media.",
    insurance: "MetLife Egypt Corporate"
  },

  // Dr. Youssef Hassan (ENT)
  {
    id: 501,
    patientName: "Hassan Mohamed",
    patientPhone: "+20 119 012 3456",
    patientCode: "PT-2024-019",
    patientAvatar: "H",
    patientAvatarBg: "#DCFCE7",
    patientAvatarColor: "#16A34A",
    doctor: "Dr. Youssef Hassan",
    doctorDept: "ENT",
    time: "10:30 AM - 11:00 AM",
    timeShort: "10:30 AM",
    date: "Thursday, 14 Nov 2024",
    type: "Consultation",
    status: "Confirmed",
    branch: "Main Branch - Heliopolis",
    room: "ENT Examination Suite",
    notes: "Chronic sinusitis and nasal endoscopy assessment.",
    insurance: "AXA Health Standard"
  },
  {
    id: 502,
    patientName: "Dina Ahmed",
    patientPhone: "+20 120 123 4567",
    patientCode: "PT-2024-020",
    patientAvatar: "D",
    patientAvatarBg: "#EDE9FE",
    patientAvatarColor: "#7C3AED",
    doctor: "Dr. Youssef Hassan",
    doctorDept: "ENT",
    time: "12:00 PM - 12:30 PM",
    timeShort: "12:00 PM",
    date: "Thursday, 14 Nov 2024",
    type: "New Patient",
    status: "Confirmed",
    branch: "Main Branch - Heliopolis",
    room: "ENT Examination Suite",
    notes: "Hearing audiometry test and tympanometry.",
    insurance: "Bupa Global Premium"
  },
  {
    id: 503,
    patientName: "Mohamed Tarek",
    patientPhone: "+20 121 234 5678",
    patientCode: "PT-2024-021",
    patientAvatar: "M",
    patientAvatarBg: "#EFF6FF",
    patientAvatarColor: "#2563EB",
    doctor: "Dr. Youssef Hassan",
    doctorDept: "ENT",
    time: "02:30 PM - 03:00 PM",
    timeShort: "02:30 PM",
    date: "Thursday, 14 Nov 2024",
    type: "Follow-up",
    status: "Confirmed",
    branch: "Main Branch - Heliopolis",
    room: "ENT Examination Suite",
    notes: "Post-tonsillectomy healing inspection.",
    insurance: "Allianz Egypt Gold"
  }
];

let selectedAppointment = appointmentsData[0];
let currentViewMode = 'calendar'; // 'calendar' | 'list'
let currentInterval = 'day'; // 'day' | 'week' | 'month'
let currentDateOffset = 0; // Days from 14 Nov 2024
let currentActiveDayNumber = 14;

function initAppointmentsStore() {
  updateMetricsDisplay();
  populateAppointmentDetails(selectedAppointment);
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
  if (!appt) return;

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

  if (heroAvatar) {
    heroAvatar.textContent = appt.patientAvatar || appt.patientName.charAt(0);
    heroAvatar.style.background = appt.patientAvatarBg || '#EDE9FE';
    heroAvatar.style.color = appt.patientAvatarColor || '#7C3AED';
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

  // Reset tab to Details
  const defaultTab = document.querySelector('.patient-sub-tabs .sub-tab-btn');
  if (defaultTab) {
    document.querySelectorAll('.patient-sub-tabs .sub-tab-btn').forEach(b => b.classList.remove('active'));
    defaultTab.classList.add('active');
  }
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
    const [specData, docData] = await Promise.all([
      ClinicApi.getSpecialties().catch(e => {
        console.debug('[ClinicApi] Specialties fetch error:', e.message);
        return [];
      }),
      ClinicApi.getDoctors({ limit: 50 }).catch(e => {
        console.debug('[ClinicApi] Doctors fetch error:', e.message);
        return { total: 0, doctors: [] };
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
    const deptName = doc.specialty ? doc.specialty.name_en : '';
    opt.textContent = `${doc.name_en} (${deptName || doc.title_en})`;
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

    if (nameEl) nameEl.textContent = doc.name_en;
    if (deptEl && doc.specialty) deptEl.textContent = doc.specialty.name_en;
    if (avatarEl) {
      const cleanName = doc.name_en.replace(/Dr\.\s*/i, '');
      const initials = cleanName.split(' ').map(p => p.charAt(0)).join('').slice(0, 2).toUpperCase();
      avatarEl.textContent = initials || 'DR';
    }
  });
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
  total: 18,
  confirmed: 14,
  pending: 3,
  cancelled: 1
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

// Open New Appointment Modal
function openNewAppointmentModal() {
  const bodyHtml = `
    <form id="newApptForm" onsubmit="event.preventDefault(); submitNewAppointment();" style="display:flex; flex-direction:column; gap:14px;">
      <div>
        <label style="display:block; font-size:12px; font-weight:600; color:var(--text-dark); margin-bottom:4px;">Patient Full Name</label>
        <input type="text" id="newPatientName" placeholder="e.g. Tarek Zaki" required style="width:100%; padding:9px 12px; border:1px solid var(--border-light); border-radius:8px; font-size:13px; font-family:inherit;">
      </div>
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
        <div>
          <label style="display:block; font-size:12px; font-weight:600; color:var(--text-dark); margin-bottom:4px;">Phone Number</label>
          <input type="tel" id="newPatientPhone" placeholder="+20 100 000 0000" required style="width:100%; padding:9px 12px; border:1px solid var(--border-light); border-radius:8px; font-size:13px; font-family:inherit;">
        </div>
        <div>
          <label style="display:block; font-size:12px; font-weight:600; color:var(--text-dark); margin-bottom:4px;">Patient ID (Optional)</label>
          <input type="text" id="newPatientCode" placeholder="PT-2024-XXX" style="width:100%; padding:9px 12px; border:1px solid var(--border-light); border-radius:8px; font-size:13px; font-family:inherit;">
        </div>
      </div>
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
        <div>
          <label style="display:block; font-size:12px; font-weight:600; color:var(--text-dark); margin-bottom:4px;">Doctor</label>
          <select id="newApptDoctor" style="width:100%; padding:9px 12px; border:1px solid var(--border-light); border-radius:8px; font-size:13px; font-family:inherit; background:#FFF;">
            <option value="Dr. Ahmed Mohamed|Cardiology">Dr. Ahmed Mohamed (Cardiology)</option>
            <option value="Dr. Sara Elsayed|Dermatology">Dr. Sara Elsayed (Dermatology)</option>
            <option value="Dr. Mohamed Ali|Orthopedics">Dr. Mohamed Ali (Orthopedics)</option>
            <option value="Dr. Mona Khaled|Pediatrics">Dr. Mona Khaled (Pediatrics)</option>
            <option value="Dr. Youssef Hassan|ENT">Dr. Youssef Hassan (ENT)</option>
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
          <label style="display:block; font-size:12px; font-weight:600; color:var(--text-dark); margin-bottom:4px;">Date</label>
          <input type="date" id="newApptDate" value="2024-11-14" style="width:100%; padding:9px 12px; border:1px solid var(--border-light); border-radius:8px; font-size:13px; font-family:inherit;">
        </div>
        <div>
          <label style="display:block; font-size:12px; font-weight:600; color:var(--text-dark); margin-bottom:4px;">Time Slot</label>
          <select id="newApptTime" style="width:100%; padding:9px 12px; border:1px solid var(--border-light); border-radius:8px; font-size:13px; font-family:inherit; background:#FFF;">
            <option value="09:00 AM">09:00 AM</option>
            <option value="10:00 AM">10:00 AM</option>
            <option value="11:00 AM">11:00 AM</option>
            <option value="01:00 PM">01:00 PM</option>
            <option value="03:00 PM">03:00 PM</option>
            <option value="05:00 PM">05:00 PM</option>
          </select>
        </div>
      </div>
      <div>
        <label style="display:block; font-size:12px; font-weight:600; color:var(--text-dark); margin-bottom:4px;">Clinical Notes / Chief Complaint</label>
        <textarea id="newApptNotes" rows="2" placeholder="Brief clinical summary..." style="width:100%; padding:9px 12px; border:1px solid var(--border-light); border-radius:8px; font-size:13px; font-family:inherit; resize:vertical;"></textarea>
      </div>
    </form>
  `;

  const footerHtml = `
    <button class="modal-btn-secondary" onclick="closeAdminModal()">Cancel</button>
    <button class="modal-btn-primary" onclick="submitNewAppointment()">Confirm Booking</button>
  `;

  openAdminModal('Schedule New Appointment', bodyHtml, footerHtml);
}

function submitNewAppointment() {
  const name = document.getElementById('newPatientName').value.trim();
  const phone = document.getElementById('newPatientPhone').value.trim();
  const docVal = document.getElementById('newApptDoctor').value.split('|');
  const doctor = docVal[0];
  const dept = docVal[1];
  const type = document.getElementById('newApptType').value;
  const time = document.getElementById('newApptTime').value;
  const notes = document.getElementById('newApptNotes').value.trim();

  if (!name || !phone) {
    alert('Please provide patient name and contact phone number.');
    return;
  }

  const newAppt = {
    id: Date.now(),
    patientName: name,
    patientPhone: phone,
    patientCode: `PT-2024-${Math.floor(100 + Math.random() * 900)}`,
    patientAvatar: name.charAt(0).toUpperCase(),
    patientAvatarBg: "#EFF6FF",
    patientAvatarColor: "#2563EB",
    doctor: doctor,
    doctorDept: dept,
    time: `${time} - ${time.replace('00', '30')}`,
    timeShort: time,
    date: "Thursday, 14 Nov 2024",
    type: type,
    status: "Confirmed",
    branch: "Main Branch - Heliopolis",
    room: "Examination Room",
    notes: notes || "Newly scheduled patient appointment.",
    insurance: "Cash / Standard"
  };

  appointmentsData.unshift(newAppt);
  metricsState.total += 1;
  metricsState.confirmed += 1;
  updateMetricsDisplay();
  selectScheduleSlot(newAppt.id, null);
  closeAdminModal();
  showToast(`Successfully scheduled appointment for ${name} with ${doctor}.`, 'success');
}

// Reschedule Modal
function openRescheduleModal() {
  if (!selectedAppointment) return;

  const bodyHtml = `
    <div style="display:flex; flex-direction:column; gap:14px;">
      <div style="background:#F8FAFC; border:1px solid var(--border-light); border-radius:8px; padding:12px;">
        <div style="font-weight:700; color:var(--text-dark);">${selectedAppointment.patientName} (${selectedAppointment.patientCode})</div>
        <div style="font-size:12px; color:var(--text-muted); margin-top:2px;">Currently with ${selectedAppointment.doctor} at ${selectedAppointment.time}</div>
      </div>
      <div>
        <label style="display:block; font-size:12px; font-weight:600; color:var(--text-dark); margin-bottom:4px;">New Target Date</label>
        <input type="date" id="reschedDate" value="2024-11-15" style="width:100%; padding:9px 12px; border:1px solid var(--border-light); border-radius:8px; font-size:13px; font-family:inherit;">
      </div>
      <div>
        <label style="display:block; font-size:12px; font-weight:600; color:var(--text-dark); margin-bottom:4px;">New Time Slot</label>
        <select id="reschedTime" style="width:100%; padding:9px 12px; border:1px solid var(--border-light); border-radius:8px; font-size:13px; font-family:inherit; background:#FFF;">
          <option value="10:00 AM - 10:30 AM">10:00 AM - 10:30 AM</option>
          <option value="11:30 AM - 12:00 PM">11:30 AM - 12:00 PM</option>
          <option value="01:30 PM - 02:00 PM">01:30 PM - 02:00 PM</option>
          <option value="03:00 PM - 03:30 PM">03:00 PM - 03:30 PM</option>
          <option value="04:30 PM - 05:00 PM">04:30 PM - 05:00 PM</option>
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

function confirmRescheduleAppointment() {
  const newDate = document.getElementById('reschedDate').value;
  const newTime = document.getElementById('reschedTime').value;
  const reason = document.getElementById('reschedReason').value;

  if (selectedAppointment) {
    selectedAppointment.date = newDate;
    selectedAppointment.time = newTime;
    selectedAppointment.notes += ` [Rescheduled: ${reason}]`;
    populateAppointmentDetails(selectedAppointment);
  }

  closeAdminModal();
  showToast(`Appointment for ${selectedAppointment.patientName} rescheduled to ${newDate} (${newTime}).`, 'success');
}

// Cancel Appointment
function handleCancelAppointment() {
  if (!selectedAppointment) return;

  if (confirm(`Are you sure you want to cancel the appointment for ${selectedAppointment.patientName} on ${selectedAppointment.date}?`)) {
    selectedAppointment.status = 'Cancelled';
    if (metricsState.confirmed > 0) metricsState.confirmed -= 1;
    metricsState.cancelled += 1;
    updateMetricsDisplay();
    populateAppointmentDetails(selectedAppointment);
    showToast(`Appointment #${selectedAppointment.id} for ${selectedAppointment.patientName} marked as Cancelled.`, 'warning');
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

/**
 * Nile Clinics - Patients Directory & Profile Management Controller
 * Interactive Pair-Programming Solution matching Reference Mockup
 */

document.addEventListener('DOMContentLoaded', () => {
  initClock();
  initGlobalShortcuts();
  initPatientSelection();
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
   2. PATIENT DATA STORE (Deterministic Mock Data matching UI Specs)
   ============================================================================= */
const patientsDatabase = [
  {
    id: 1,
    name: "Mona Ahmed",
    patientCode: "PT-2024-001",
    phone: "+20 101 234 5678",
    nationalId: "30102123456789",
    age: 22,
    gender: "Female",
    dob: "14 March 2002 (22 years)",
    email: "mona.ahmed@example.com",
    address: "Heliopolis, Cairo, Egypt",
    bloodType: "O+",
    allergies: "None",
    chronicConditions: "None",
    pharmacy: "Nile Pharmacy - Heliopolis",
    lastApptDate: "14 Nov 2024",
    lastApptDept: "Cardiology",
    status: "Active",
    isNew: false,
    avatar: "M",
    avatarBg: "#EDE9FE",
    avatarColor: "#7C3AED",
    activities: [
      { type: "completed", title: "Appointment Completed", sub: "Cardiology - Dr. Ahmed Mohamed", date: "14 Nov 2024", time: "02:00 PM" },
      { type: "updated", title: "Medical Record Updated", sub: "Lab Results", date: "10 Nov 2024", time: "11:30 AM" },
      { type: "booked", title: "New Appointment Booked", sub: "Dermatology - Dr. Sara Elsayed", date: "01 Nov 2024", time: "04:00 PM" }
    ]
  },
  {
    id: 2,
    name: "Ahmed Hassan",
    patientCode: "PT-2024-002",
    phone: "+20 100 987 6543",
    nationalId: "29901098765432",
    age: 25,
    gender: "Male",
    dob: "22 August 1999 (25 years)",
    email: "ahmed.hassan@example.com",
    address: "Nasr City, Cairo, Egypt",
    bloodType: "A+",
    allergies: "Penicillin",
    chronicConditions: "None",
    pharmacy: "Seif Pharmacy - Nasr City",
    lastApptDate: "10 Nov 2024",
    lastApptDept: "Dermatology",
    status: "Active",
    isNew: true,
    avatar: "A",
    avatarBg: "#EFF6FF",
    avatarColor: "#2563EB",
    activities: [
      { type: "completed", title: "Appointment Completed", sub: "Dermatology - Dr. Sara Elsaid", date: "10 Nov 2024", time: "10:30 AM" },
      { type: "updated", title: "Prescription Issued", sub: "Topical Ointment 20mg", date: "10 Nov 2024", time: "10:45 AM" }
    ]
  },
  {
    id: 3,
    name: "Sara Mohamed",
    patientCode: "PT-2024-003",
    phone: "+20 106 543 2198",
    nationalId: "30203054321987",
    age: 28,
    gender: "Female",
    dob: "05 May 1996 (28 years)",
    email: "sara.mohamed@example.com",
    address: "Maadi, Cairo, Egypt",
    bloodType: "B+",
    allergies: "None",
    chronicConditions: "Mild Asthma",
    pharmacy: "El Ezaby - Maadi",
    lastApptDate: "12 Nov 2024",
    lastApptDept: "Orthopedics",
    status: "Active",
    isNew: false,
    avatar: "S",
    avatarBg: "#EFF6FF",
    avatarColor: "#2563EB",
    activities: [
      { type: "completed", title: "Consultation Completed", sub: "Orthopedics - Dr. Mohamed Ali", date: "12 Nov 2024", time: "12:00 PM" },
      { type: "updated", title: "X-Ray Report Uploaded", sub: "Left Knee Joint", date: "12 Nov 2024", time: "01:15 PM" }
    ]
  },
  {
    id: 4,
    name: "Youssef Ali",
    patientCode: "PT-2024-004",
    phone: "+20 112 345 6789",
    nationalId: "29802112345678",
    age: 26,
    gender: "Male",
    dob: "18 January 1998 (26 years)",
    email: "youssef.ali@example.com",
    address: "Dokki, Giza, Egypt",
    bloodType: "O-",
    allergies: "Sulfa drugs",
    chronicConditions: "None",
    pharmacy: "Roushdy Pharmacy - Dokki",
    lastApptDate: "05 Nov 2024",
    lastApptDept: "General Medicine",
    status: "Active",
    isNew: false,
    avatar: "Y",
    avatarBg: "#EEF2FF",
    avatarColor: "#4F46E5",
    activities: [
      { type: "completed", title: "Routine Checkup Done", sub: "General Medicine - Dr. Youssef Hassan", date: "05 Nov 2024", time: "04:00 PM" }
    ]
  },
  {
    id: 5,
    name: "Nour Khaled",
    patientCode: "PT-2024-005",
    phone: "+20 109 876 5432",
    nationalId: "30111098765432",
    age: 23,
    gender: "Female",
    dob: "11 November 2001 (23 years)",
    email: "nour.khaled@example.com",
    address: "6th of October City, Giza",
    bloodType: "AB+",
    allergies: "None",
    chronicConditions: "None",
    pharmacy: "19011 - Zayed",
    lastApptDate: "01 Nov 2024",
    lastApptDept: "Cardiology",
    status: "Inactive",
    isNew: false,
    avatar: "N",
    avatarBg: "#FEE2E2",
    avatarColor: "#DC2626",
    activities: [
      { type: "booked", title: "Follow-up Scheduled", sub: "Cardiology - Dr. Mona Khaled", date: "01 Nov 2024", time: "02:30 PM" }
    ]
  },
  {
    id: 6,
    name: "Omar Ibrahim",
    patientCode: "PT-2024-006",
    phone: "+20 120 456 7890",
    nationalId: "29904045678901",
    age: 24,
    gender: "Male",
    dob: "03 February 2000 (24 years)",
    email: "omar.ibrahim@example.com",
    address: "Mohandessin, Giza, Egypt",
    bloodType: "A-",
    allergies: "None",
    chronicConditions: "Allergic Rhinitis",
    pharmacy: "Misr Pharmacy - Gameat Dowal",
    lastApptDate: "08 Nov 2024",
    lastApptDept: "ENT",
    status: "Active",
    isNew: false,
    avatar: "O",
    avatarBg: "#DCFCE7",
    avatarColor: "#15803D",
    activities: [
      { type: "completed", title: "ENT Examination", sub: "Dr. Tarek Omar", date: "08 Nov 2024", time: "11:00 AM" }
    ]
  },
  {
    id: 7,
    name: "Salma Ahmed",
    patientCode: "PT-2024-007",
    phone: "+20 111 234 5678",
    nationalId: "30207012345678",
    age: 27,
    gender: "Female",
    dob: "19 July 1997 (27 years)",
    email: "salma.ahmed@example.com",
    address: "Zamalek, Cairo, Egypt",
    bloodType: "O+",
    allergies: "Latex",
    chronicConditions: "None",
    pharmacy: "Care Pharmacy - Zamalek",
    lastApptDate: "21 Oct 2024",
    lastApptDept: "Dermatology",
    status: "Inactive",
    isNew: false,
    avatar: "S",
    avatarBg: "#FEE2E2",
    avatarColor: "#DC2626",
    activities: [
      { type: "completed", title: "Skin Checkup", sub: "Dermatology - Dr. Sara Elsaid", date: "21 Oct 2024", time: "01:30 PM" }
    ]
  },
  {
    id: 8,
    name: "Hassan Mostafa",
    patientCode: "PT-2024-008",
    phone: "+20 115 678 9012",
    nationalId: "29803098765432",
    age: 29,
    gender: "Male",
    dob: "14 September 1995 (29 years)",
    email: "hassan.mostafa@example.com",
    address: "Shubra, Cairo, Egypt",
    bloodType: "B-",
    allergies: "None",
    chronicConditions: "None",
    pharmacy: "Nile Pharmacy - Downtown",
    lastApptDate: "04 Nov 2024",
    lastApptDept: "Orthopedics",
    status: "Active",
    isNew: true,
    avatar: "H",
    avatarBg: "#EDE9FE",
    avatarColor: "#7C3AED",
    activities: [
      { type: "completed", title: "Orthopedic Consult", sub: "Orthopedics - Dr. Mohamed Ali", date: "04 Nov 2024", time: "03:30 PM" }
    ]
  }
];

let currentlySelectedPatientId = 1;
let currentActiveTab = 'all';

/* =============================================================================
   3. PATIENT SELECTION & DETAILS RENDERING
   ============================================================================= */
function initPatientSelection() {
  selectPatientRow(1);
}

function selectPatientRow(patientId, trEl) {
  currentlySelectedPatientId = patientId;

  // Highlight row in table
  const rows = document.querySelectorAll('#patientsTableBody tr');
  rows.forEach(r => r.classList.remove('selected-row'));

  if (trEl) {
    trEl.classList.add('selected-row');
  } else {
    const target = rows[patientId - 1];
    if (target) target.classList.add('selected-row');
  }

  const patient = patientsDatabase.find(p => p.id === patientId);
  if (!patient) return;

  renderPatientDetails(patient);
}

function renderPatientDetails(patient) {
  // Ensure Details Card is visible
  const detailsCard = document.getElementById('patientDetailsCard');
  const emptyNotice = document.getElementById('patientDetailsEmptyNotice');
  const overviewContent = document.getElementById('subTabContentOverview');

  if (detailsCard) detailsCard.style.display = 'flex';
  if (emptyNotice) emptyNotice.style.display = 'none';
  if (overviewContent) overviewContent.style.display = 'flex';

  // Hero section
  const avatarEl = document.getElementById('detailAvatar');
  const nameEl = document.getElementById('detailName');
  const idEl = document.getElementById('detailId');
  const statusBadgeEl = document.getElementById('detailStatusBadge');
  const statusTextEl = document.getElementById('detailStatusText');

  if (avatarEl) {
    avatarEl.textContent = patient.avatar;
    avatarEl.style.backgroundColor = patient.avatarBg;
    avatarEl.style.color = patient.avatarColor;
  }
  if (nameEl) nameEl.textContent = patient.name;
  if (idEl) idEl.textContent = patient.patientCode;

  if (statusBadgeEl && statusTextEl) {
    if (patient.status === 'Active') {
      statusBadgeEl.style.backgroundColor = '#F0FDF4';
      statusBadgeEl.style.borderColor = '#BBF7D0';
      statusBadgeEl.style.color = '#16A34A';
      statusBadgeEl.querySelector('.dot').style.backgroundColor = '#16A34A';
      statusTextEl.textContent = 'Active Patient';
    } else {
      statusBadgeEl.style.backgroundColor = '#FEF2F2';
      statusBadgeEl.style.borderColor = '#FECACA';
      statusBadgeEl.style.color = '#DC2626';
      statusBadgeEl.querySelector('.dot').style.backgroundColor = '#DC2626';
      statusTextEl.textContent = 'Inactive Patient';
    }
  }

  // Personal Info Fields
  setFieldText('fieldFullName', patient.name);
  setFieldText('fieldPhone', patient.phone);
  setFieldText('fieldNationalId', patient.nationalId);
  setFieldText('fieldDob', patient.dob);
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
  if (activityListEl && patient.activities) {
    activityListEl.innerHTML = patient.activities.map(act => {
      let dotClass = 'dot-green';
      if (act.type === 'updated') dotClass = 'dot-blue';
      if (act.type === 'booked') dotClass = 'dot-gray';

      return `
        <div class="activity-timeline-item">
          <div class="activity-dot-circle ${dotClass}"></div>
          <div class="activity-content-col">
            <div>
              <div class="activity-title">${act.title}</div>
              <div class="activity-sub">${act.sub}</div>
            </div>
            <div class="activity-timestamp">
              <div class="activity-date">${act.date}</div>
              <div>${act.time}</div>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }
}

function setFieldText(elId, val) {
  const el = document.getElementById(elId);
  if (el) el.textContent = val || 'None';
}

function closePatientDetailsPanel() {
  const detailsCard = document.getElementById('patientDetailsCard');
  if (!detailsCard) return;

  const overviewContent = document.getElementById('subTabContentOverview');
  const emptyNotice = document.getElementById('patientDetailsEmptyNotice');

  if (overviewContent) overviewContent.style.display = 'none';
  if (emptyNotice) {
    emptyNotice.style.display = 'block';
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
   4. FILTERING & SEARCH CONTROLLERS (ZERO BLANK SPACE)
   ============================================================================= */
function filterPatientTab(tab, btnEl) {
  currentActiveTab = tab;
  const tabs = document.querySelectorAll('.patient-tab-item');
  tabs.forEach(t => t.classList.remove('active'));
  btnEl.classList.add('active');

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

  const tableBody = document.getElementById('patientsTableBody');
  const emptyState = document.getElementById('patientsEmptyState');
  const paginationText = document.getElementById('paginationText');

  let visibleCount = 0;

  patientsDatabase.forEach(p => {
    // 1. Tab check
    let passTab = true;
    if (currentActiveTab === 'active' && p.status !== 'Active') passTab = false;
    if (currentActiveTab === 'inactive' && p.status !== 'Inactive') passTab = false;
    if (currentActiveTab === 'new' && !p.isNew) passTab = false;

    // 2. Search check
    let passSearch = true;
    if (q) {
      const matchName = p.name.toLowerCase().includes(q);
      const matchPhone = p.phone.toLowerCase().includes(q);
      const matchId = p.nationalId.includes(q) || p.patientCode.toLowerCase().includes(q);
      passSearch = matchName || matchPhone || matchId;
    }

    // 3. Dropdowns
    let passDept = !deptVal || p.lastApptDept === deptVal;
    let passStatus = !statusVal || p.status === statusVal;
    let passGender = !genderVal || p.gender === genderVal;

    const tr = tableBody.children[p.id - 1];
    if (tr) {
      if (passTab && passSearch && passDept && passStatus && passGender) {
        tr.style.display = '';
        visibleCount++;
      } else {
        tr.style.display = 'none';
      }
    }
  });

  // Zero Blank Space handling
  if (visibleCount === 0) {
    if (emptyState) emptyState.style.display = 'flex';
    if (paginationText) paginationText.textContent = 'Showing 0 of 1,284 patients';
  } else {
    if (emptyState) emptyState.style.display = 'none';
    if (paginationText) paginationText.textContent = `Showing 1 to ${visibleCount} of 1,284 patients`;
  }
}

function resetPatientFilters() {
  const searchInput = document.getElementById('patientTableSearchInput');
  if (searchInput) searchInput.value = '';

  const deptSelect = document.getElementById('deptFilterSelect');
  if (deptSelect) deptSelect.value = '';

  const statusSelect = document.getElementById('statusFilterSelect');
  if (statusSelect) statusSelect.value = '';

  const genderSelect = document.getElementById('genderFilterSelect');
  if (genderSelect) genderSelect.value = '';

  filterPatientTab('all', document.querySelectorAll('.patient-tab-item')[0]);
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
  showToast(masterCheckbox.checked ? 'All 8 patients selected on this page' : 'Deselected all patients', 'info');
}

/* =============================================================================
   5. PATIENT MODALS & ACTIONS
   ============================================================================= */
function openAddPatientModal() {
  const html = `
    <form id="addPatientForm" onsubmit="handleAddPatientSubmit(event)" style="display:flex; flex-direction:column; gap:14px;">
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
        <div>
          <label style="display:block; font-size:12px; font-weight:600; color:#475569; margin-bottom:4px;">Full Name *</label>
          <input type="text" id="newPatientName" required placeholder="e.g. Karim Mahmoud" style="width:100%; height:38px; border:1px solid #CBD5E1; border-radius:6px; padding:0 12px; font-size:13px;">
        </div>
        <div>
          <label style="display:block; font-size:12px; font-weight:600; color:#475569; margin-bottom:4px;">Phone Number *</label>
          <input type="tel" id="newPatientPhone" required placeholder="+20 10X XXX XXXX" value="+20 " style="width:100%; height:38px; border:1px solid #CBD5E1; border-radius:6px; padding:0 12px; font-size:13px;">
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
            <option value="Cardiology">Cardiology</option>
            <option value="Dermatology">Dermatology</option>
            <option value="Orthopedics">Orthopedics</option>
            <option value="General Medicine">General Medicine</option>
            <option value="ENT">ENT</option>
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

function handleAddPatientSubmit(e) {
  e.preventDefault();
  const name = document.getElementById('newPatientName').value.trim();
  const phone = document.getElementById('newPatientPhone').value.trim();
  const nationalId = document.getElementById('newPatientNationalId').value.trim();
  const age = document.getElementById('newPatientAge').value;
  const gender = document.getElementById('newPatientGender').value;
  const dept = document.getElementById('newPatientDept').value;
  const address = document.getElementById('newPatientAddress').value || 'Cairo, Egypt';
  const email = document.getElementById('newPatientEmail').value || `${name.toLowerCase().replace(/\s+/g, '.')}@example.com`;
  const blood = document.getElementById('newPatientBlood').value;
  const pharmacy = document.getElementById('newPatientPharmacy').value;

  const newId = patientsDatabase.length + 1;
  const code = `PT-2024-00${newId}`;

  const newPatientObj = {
    id: newId,
    name: name,
    patientCode: code,
    phone: phone,
    nationalId: nationalId,
    age: parseInt(age, 10),
    gender: gender,
    dob: `2000 (${age} years)`,
    email: email,
    address: address,
    bloodType: blood,
    allergies: "None",
    chronicConditions: "None",
    pharmacy: pharmacy,
    lastApptDate: "Today",
    lastApptDept: dept,
    status: "Active",
    isNew: true,
    avatar: name.charAt(0).toUpperCase(),
    avatarBg: "#DCFCE7",
    avatarColor: "#15803D",
    activities: [
      { type: "booked", title: "Patient Registered", sub: "Clinic System Entry", date: "Today", time: "Just now" }
    ]
  };

  patientsDatabase.unshift(newPatientObj);

  // Prepend row to table
  const tbody = document.getElementById('patientsTableBody');
  if (tbody) {
    const tr = document.createElement('tr');
    tr.onclick = () => selectPatientRow(newId, tr);
    tr.innerHTML = `
      <td class="td-checkbox"><input type="checkbox" class="custom-checkbox" onclick="event.stopPropagation()"></td>
      <td>
        <div class="patient-cell-profile">
          <div class="patient-avatar-circle" style="background:${newPatientObj.avatarBg}; color:${newPatientObj.avatarColor};">${newPatientObj.avatar}</div>
          <div class="patient-name-col">
            <span class="patient-table-name">${name}</span>
            <span class="patient-table-id">${code}</span>
          </div>
        </div>
      </td>
      <td>${phone}</td>
      <td>${nationalId}</td>
      <td>${age}</td>
      <td>${gender}</td>
      <td>
        <div class="td-last-appt">
          <span class="appt-date-text">Today</span>
          <span class="appt-dept-text">${dept}</span>
        </div>
      </td>
      <td><span class="badge-patient-active">Active</span></td>
      <td>
        <button class="btn-row-action" title="Actions" onclick="event.stopPropagation(); openRowActionMenu(${newId}, '${name}')">
          <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/><circle cx="5" cy="12" r="1.5"/></svg>
        </button>
      </td>
    `;
    tbody.prepend(tr);
  }

  // Update metrics
  const totalMetric = document.getElementById('metricTotalPatients');
  if (totalMetric) totalMetric.textContent = '1,285';

  const newMetric = document.getElementById('metricNewPatients');
  if (newMetric) newMetric.textContent = '43';

  closeAdminModal();
  selectPatientRow(newId);
  showToast(`Patient ${name} successfully registered in Nile Clinics system`, 'success');
}

function openEditPatientModal(targetSection = 'all') {
  const patient = patientsDatabase.find(p => p.id === currentlySelectedPatientId) || patientsDatabase[0];

  const html = `
    <form onsubmit="handleEditPatientSubmit(event)" style="display:flex; flex-direction:column; gap:14px;">
      <div>
        <label style="display:block; font-size:12px; font-weight:600; color:#475569; margin-bottom:4px;">Full Name</label>
        <input type="text" id="editName" value="${patient.name}" required style="width:100%; height:38px; border:1px solid #CBD5E1; border-radius:6px; padding:0 12px; font-size:13px;">
      </div>
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
        <div>
          <label style="display:block; font-size:12px; font-weight:600; color:#475569; margin-bottom:4px;">Phone</label>
          <input type="text" id="editPhone" value="${patient.phone}" required style="width:100%; height:38px; border:1px solid #CBD5E1; border-radius:6px; padding:0 12px; font-size:13px;">
        </div>
        <div>
          <label style="display:block; font-size:12px; font-weight:600; color:#475569; margin-bottom:4px;">Email</label>
          <input type="email" id="editEmail" value="${patient.email}" style="width:100%; height:38px; border:1px solid #CBD5E1; border-radius:6px; padding:0 12px; font-size:13px;">
        </div>
      </div>
      <div>
        <label style="display:block; font-size:12px; font-weight:600; color:#475569; margin-bottom:4px;">Residential Address</label>
        <input type="text" id="editAddress" value="${patient.address}" style="width:100%; height:38px; border:1px solid #CBD5E1; border-radius:6px; padding:0 12px; font-size:13px;">
      </div>
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
        <div>
          <label style="display:block; font-size:12px; font-weight:600; color:#475569; margin-bottom:4px;">Blood Type</label>
          <input type="text" id="editBlood" value="${patient.bloodType}" style="width:100%; height:38px; border:1px solid #CBD5E1; border-radius:6px; padding:0 12px; font-size:13px;">
        </div>
        <div>
          <label style="display:block; font-size:12px; font-weight:600; color:#475569; margin-bottom:4px;">Preferred Pharmacy</label>
          <input type="text" id="editPharmacy" value="${patient.pharmacy}" style="width:100%; height:38px; border:1px solid #CBD5E1; border-radius:6px; padding:0 12px; font-size:13px;">
        </div>
      </div>
      <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:8px;">
        <button type="button" class="modal-btn-secondary" onclick="closeAdminModal()">Cancel</button>
        <button type="submit" class="modal-btn-primary">Save Changes</button>
      </div>
    </form>
  `;

  openAdminModal(`Edit Profile: ${patient.name}`, html);
}

function handleEditPatientSubmit(e) {
  e.preventDefault();
  const patient = patientsDatabase.find(p => p.id === currentlySelectedPatientId);
  if (patient) {
    patient.name = document.getElementById('editName').value;
    patient.phone = document.getElementById('editPhone').value;
    patient.email = document.getElementById('editEmail').value;
    patient.address = document.getElementById('editAddress').value;
    patient.bloodType = document.getElementById('editBlood').value;
    patient.pharmacy = document.getElementById('editPharmacy').value;

    renderPatientDetails(patient);
  }
  closeAdminModal();
  showToast('Patient profile updated successfully', 'success');
}

function handleExportPatients() {
  const html = `
    <div style="display:flex; flex-direction:column; gap:14px;">
      <p style="font-size:13px; color:#475569; margin:0;">Export patient medical directory records according to HIPAA & clinic compliance standards.</p>
      <div style="display:flex; flex-direction:column; gap:10px;">
        <label style="display:flex; align-items:center; gap:10px; font-size:13px; font-weight:600; cursor:pointer;">
          <input type="radio" name="exportFormat" value="csv" checked>
          <span>Comma Separated Values (.CSV)</span>
        </label>
        <label style="display:flex; align-items:center; gap:10px; font-size:13px; font-weight:600; cursor:pointer;">
          <input type="radio" name="exportFormat" value="xlsx">
          <span>Microsoft Excel Spreadsheet (.XLSX)</span>
        </label>
        <label style="display:flex; align-items:center; gap:10px; font-size:13px; font-weight:600; cursor:pointer;">
          <input type="radio" name="exportFormat" value="pdf">
          <span>Comprehensive Medical Registry (.PDF)</span>
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
  showToast('Export generated: Nile_Clinics_Patients_2024.csv', 'success');
}

function openRowActionMenu(id, name) {
  const html = `
    <div style="display:flex; flex-direction:column; gap:8px;">
      <button class="action-tile-btn" style="width:100%; border:none; background:#F8FAFC;" onclick="selectPatientRow(${id}); closeAdminModal();">
        <div class="tile-icon-box bg-blue-subtle text-blue"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg></div>
        <div class="tile-text-col"><h4 class="tile-title">View Profile Details</h4><span class="tile-subtext">Open right panel</span></div>
      </button>
      <button class="action-tile-btn" style="width:100%; border:none; background:#F8FAFC;" onclick="showToast('Initiating appointment booking for ${name}...', 'info'); closeAdminModal();">
        <div class="tile-icon-box bg-green-subtle text-green"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg></div>
        <div class="tile-text-col"><h4 class="tile-title">Book New Appointment</h4><span class="tile-subtext">Schedule clinical slot</span></div>
      </button>
      <button class="action-tile-btn" style="width:100%; border:none; background:#F8FAFC;" onclick="showToast('Outbound SMS reminder sent to ${name}', 'success'); closeAdminModal();">
        <div class="tile-icon-box bg-purple-subtle text-purple"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg></div>
        <div class="tile-text-col"><h4 class="tile-title">Dispatch SMS Notification</h4><span class="tile-subtext">Appointment reminders</span></div>
      </button>
    </div>
  `;

  openAdminModal(`Actions: ${name}`, html);
}

function openAllPatientActivityModal() {
  const patient = patientsDatabase.find(p => p.id === currentlySelectedPatientId) || patientsDatabase[0];
  const html = `
    <div style="display:flex; flex-direction:column; gap:12px; max-height:360px; overflow-y:auto;">
      <p style="font-size:13px; color:#64748B; margin:0;">Complete interaction timeline for ${patient.name} (${patient.patientCode}):</p>
      ${patient.activities.map(a => `
        <div style="background:#F8FAFC; border:1px solid #E2E8F0; border-radius:8px; padding:10px 14px;">
          <div style="font-weight:700; color:#0F172A; font-size:13px;">${a.title}</div>
          <div style="font-size:12px; color:#475569;">${a.sub}</div>
          <div style="font-size:11px; color:#94A3B8; margin-top:4px;">${a.date} at ${a.time}</div>
        </div>
      `).join('')}
    </div>
  `;
  openAdminModal(`Activity Timeline: ${patient.name}`, html);
}

function openDateFilterModal() {
  const html = `
    <div style="display:flex; flex-direction:column; gap:12px;">
      <div>
        <label style="display:block; font-size:12px; font-weight:600; color:#475569; margin-bottom:4px;">From Registration Date</label>
        <input type="date" value="2024-01-01" style="width:100%; height:38px; border:1px solid #CBD5E1; border-radius:6px; padding:0 12px; font-size:13px;">
      </div>
      <div>
        <label style="display:block; font-size:12px; font-weight:600; color:#475569; margin-bottom:4px;">To Registration Date</label>
        <input type="date" value="2024-11-12" style="width:100%; height:38px; border:1px solid #CBD5E1; border-radius:6px; padding:0 12px; font-size:13px;">
      </div>
      <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:8px;">
        <button class="modal-btn-secondary" onclick="closeAdminModal()">Clear</button>
        <button class="modal-btn-primary" onclick="showToast('Date range filter applied', 'info'); closeAdminModal();">Apply Date Filter</button>
      </div>
    </div>
  `;
  openAdminModal('Filter by Registration Date', html);
}

function switchDetailSubTab(tabName, btnEl) {
  const tabs = document.querySelectorAll('.sub-tab-btn');
  tabs.forEach(t => t.classList.remove('active'));
  btnEl.classList.add('active');

  const overview = document.getElementById('subTabContentOverview');
  if (tabName !== 'overview') {
    showToast(`Viewing ${btnEl.textContent} for ${document.getElementById('detailName').textContent}`, 'info');
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
   6. GLOBAL SHORTCUTS & SIDEBAR
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

  if (backdrop) backdrop.classList.add('open');
}

function closeAdminModal(e) {
  if (e && e.target && e.target.id !== 'adminModalBackdrop' && !e.target.closest('.modal-close-icon-btn') && !e.target.classList.contains('modal-btn-secondary')) {
    return;
  }
  const backdrop = document.getElementById('adminModalBackdrop');
  if (backdrop) backdrop.classList.remove('open');
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

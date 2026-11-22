/**
 * Shiffaa Clinics - AI Call Center Interaction Engine (User App)
 * Responsive across Desktop & Mobile (98+% Device Compatibility)
 * Strictly Zero Emojis - Vector SVG Icons & Clean Typography
 */

// Application State
let currentAppointment = {
  doctor: "Dr. Ahmed Mohamed",
  specialty: "Cardiology",
  avatar: "https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=100&h=100&fit=crop&crop=faces",
  date: "Thursday, 14 November 2024",
  day: "14",
  dayName: "THU",
  month: "Nov",
  time: "2:00 PM",
  branch: "Main Branch - Heliopolis",
  room: "Clinic 304, Floor 3",
  status: "Confirmed",
  fee: "450 EGP",
  patientName: "Patient User",
  patientPhone: "—",
  patientDOB: "—",
  patientEmail: "—",
  insurance: "Not added"
};

// DOM References
const chatMessages = document.getElementById("chatMessages");
const chatInput = document.getElementById("chatInput");
const sendBtn = document.getElementById("sendBtn");
const modalBackdrop = document.getElementById("modalBackdrop");
const modalTitle = document.getElementById("modalTitle");
const modalBody = document.getElementById("modalBody");
const modalFooter = document.getElementById("modalFooter");
const voiceCallOverlay = document.getElementById("voiceCallOverlay");
const toastContainer = document.getElementById("toastContainer");

// Suggested question banks
let bankIndex = 0;
const questionBanks = [
  [
    "What are your working hours?",
    "How can I reschedule my appointment?",
    "Do you accept health insurance?",
    "Where is the Heliopolis branch?",
    "What should I bring to my appointment?"
  ],
  [
    "Can I pay with credit card or cash?",
    "How do I request a prescription renewal?",
    "Do you offer pediatric cardiology?",
    "What is the cancellation policy?",
    "Is parking available at the main branch?"
  ]
];

// Initialize on DOM Ready
document.addEventListener("DOMContentLoaded", () => {
  scrollToBottom();

  if (chatInput) {
    chatInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleSendMessage();
      }
    });
  }
});

// Scroll Chat Helper
function scrollToBottom() {
  setTimeout(() => {
    if (chatMessages) {
      chatMessages.scrollTop = chatMessages.scrollHeight;
    }
  }, 60);
}

// -------------------------------------------------------------------------
// SLOT SELECTION & REAL-TIME STATE SYNC (Desktop & Mobile)
// -------------------------------------------------------------------------
window.selectDoctorSlot = function(doctorName, time) {
  let docAvatar = "https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=100&h=100&fit=crop&crop=faces";
  if (doctorName.includes("Sara")) {
    docAvatar = "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=100&h=100&fit=crop&crop=faces";
  } else if (doctorName.includes("Ali")) {
    docAvatar = "https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=100&h=100&fit=crop&crop=faces";
  }

  currentAppointment.doctor = doctorName;
  currentAppointment.time = time;
  currentAppointment.avatar = docAvatar;

  // Append Arabic user message confirming slot
  const arabicTime = time.replace("PM", "م").replace("AM", "ص");
  appendUserMessage(`احجز مع ${doctorName} الساعة ${arabicTime}`);

  // Update in-chat confirmation card
  setTimeout(() => {
    const bookedNameEl = document.getElementById("bookedDoctorName");
    const bookedDateTimeEl = document.getElementById("bookedDoctorDateTime");
    const embAvatarEl = document.getElementById("embDoctorAvatar");
    const embTimeEl = document.getElementById("embTime");

    if (bookedNameEl) bookedNameEl.textContent = `${doctorName} (Cardiology)`;
    if (bookedDateTimeEl) bookedDateTimeEl.textContent = `${currentAppointment.date} at ${time}`;
    if (embAvatarEl) embAvatarEl.src = docAvatar;
    if (embTimeEl) embTimeEl.textContent = time;

    // Update Desktop Right Panel widgets
    const sideDocName = document.getElementById("sideDocName");
    const sideDocAvatar = document.getElementById("sideDocAvatar");
    const sideDocTime = document.getElementById("sideDocTime");

    if (sideDocName) sideDocName.textContent = doctorName;
    if (sideDocAvatar) sideDocAvatar.src = docAvatar;
    if (sideDocTime) sideDocTime.textContent = time;

    showToast(`Appointment confirmed with ${doctorName}!`, "success");
    scrollToBottom();
  }, 300);
};

// -------------------------------------------------------------------------
// CHAT MESSAGE ENGINE
// -------------------------------------------------------------------------
window.handleSendMessage = function() {
  if (!chatInput) return;
  const text = chatInput.value.trim();
  if (!text) return;

  appendUserMessage(text);
  chatInput.value = "";

  setTimeout(() => {
    generateBotResponse(text);
  }, 450);
};

function appendUserMessage(text) {
  const now = getCurrentTime();
  const isArabic = /[\u0600-\u06FF]/.test(text);

  const row = document.createElement("div");
  row.className = "message-row user-row";
  row.innerHTML = `
    <div class="message-content-wrapper">
      <div class="user-bubble">
        <span class="${isArabic ? 'arabic-text' : ''}">${escapeHtml(text)}</span>
      </div>
      <div class="message-time-user">
        <span>${now}</span>
        <svg class="checkmarks-icon" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M18 6 7 17l-5-5"/>
          <path d="m22 10-7.5 7.5L13 16"/>
        </svg>
      </div>
    </div>
    <div class="user-avatar-small">P</div>
  `;
  chatMessages.appendChild(row);
  scrollToBottom();
}

function appendBotMessage(htmlContent) {
  const now = getCurrentTime();
  const row = document.createElement("div");
  row.className = "message-row bot-row";
  row.innerHTML = `
    <div class="bot-avatar-small">
      <svg class="robot-icon-small" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M16 4V7" stroke="#2563EB" stroke-width="2" stroke-linecap="round"/>
        <circle cx="16" cy="3.5" r="1.5" fill="#2563EB"/>
        <rect x="5" y="7" width="22" height="18" rx="6" fill="#2563EB"/>
        <circle cx="11.5" cy="14.5" r="2.5" fill="#FFFFFF"/>
        <circle cx="20.5" cy="14.5" r="2.5" fill="#FFFFFF"/>
        <path d="M11 20C12 21.5 20 21.5 21 20" stroke="#FFFFFF" stroke-width="1.8" stroke-linecap="round"/>
      </svg>
    </div>
    <div class="message-content-wrapper">
      <div class="bot-bubble">
        ${htmlContent}
      </div>
      <div class="message-time">${now}</div>
    </div>
  `;
  chatMessages.appendChild(row);
  scrollToBottom();
}

// Simulated Intelligent Assistant Replies
function generateBotResponse(userText) {
  const lower = userText.toLowerCase();

  if (lower.includes("working hours") || lower.includes("hours") || lower.includes("مواعيد")) {
    appendBotMessage(`
      <p><strong>Shiffaa Clinics Working Hours:</strong></p>
      <ul style="margin: 6px 0 6px 14px; font-size: 12.5px; line-height: 1.5;">
        <li><strong>Saturday – Thursday:</strong> 9:00 AM – 10:00 PM</li>
        <li><strong>Friday:</strong> 1:00 PM – 9:00 PM</li>
        <li><strong>Emergency Department:</strong> Open 24/7 at Heliopolis Branch</li>
      </ul>
      <p>Would you like to book a consultation during these hours?</p>
    `);
  } else if (lower.includes("insurance") || lower.includes("تأمين")) {
    appendBotMessage(`
      <p><strong>Accepted Health Insurance:</strong></p>
      <p style="margin-top:4px;">We currently partner with AXA, MetLife, Bupa, Allianz, MedNet, and NextCare.</p>
      <p style="margin-top:6px;">You can upload or link your policy card from the <strong>Your Profile</strong> widget!</p>
    `);
  } else if (lower.includes("reschedule") || lower.includes("تعديل") || lower.includes("تغيير")) {
    openRescheduleModal();
  } else if (lower.includes("cancel") || lower.includes("الغاء") || lower.includes("إلغاء")) {
    openCancelModal();
  } else if (lower.includes("heliopolis") || lower.includes("فرع") || lower.includes("عنوان")) {
    appendBotMessage(`
      <p><strong>Main Branch Location:</strong></p>
      <p style="margin-top:4px;">14 El-Thawra Street, Heliopolis, Cairo (Near Korba Square).</p>
      <p style="margin-top:4px; font-size:11.5px; color:#64748B;">Valet parking and wheelchair accessibility are available at the entrance.</p>
    `);
  } else if (lower.includes("bring") || lower.includes("احضر") || lower.includes("أوراق")) {
    appendBotMessage(`
      <p><strong>What to bring for your appointment:</strong></p>
      <ul style="margin: 6px 0 6px 14px; font-size: 12.5px; line-height: 1.5;">
        <li>National ID or Passport</li>
        <li>Insurance card (if covered)</li>
        <li>Previous lab results or ECG scans related to cardiology</li>
      </ul>
    `);
  } else {
    appendBotMessage(`
      <p>I have processed your inquiry: <em>"${escapeHtml(userText)}"</em>.</p>
      <p style="margin-top: 6px;">I can schedule appointments with our cardiologists, check doctor availability, or help with clinic inquiries. What would you like assistance with?</p>
    `);
  }
}

// Suggested Questions Click Handler
window.askSuggested = function(question) {
  if (chatInput) chatInput.value = question;
  handleSendMessage();
};

window.refreshQuestions = function() {
  bankIndex = (bankIndex + 1) % questionBanks.length;
  const list = document.getElementById("questionsList");
  if (!list) return;

  list.innerHTML = questionBanks[bankIndex].map(q => `
    <li onclick="askSuggested('${q}')">
      <span>${q}</span>
      <svg class="chevron-link-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="m9 18 6-6-6-6"/>
      </svg>
    </li>
  `).join("");

  showToast("Suggested questions refreshed", "info");
};

// -------------------------------------------------------------------------
// MODALS & BOTTOM SHEETS (Appointment, Profile, Reschedule, Cancel, Help)
// -------------------------------------------------------------------------
window.openAppointmentModal = function() {
  modalTitle.textContent = "Appointment Details";
  modalBody.innerHTML = `
    <div style="display:flex; align-items:center; gap:12px; margin-bottom:14px; padding-bottom:12px; border-bottom:1px solid #E2E8F0;">
      <img src="${currentAppointment.avatar}" style="width:48px; height:48px; border-radius:50%; object-fit:cover; border:1.5px solid #2563EB;">
      <div>
        <div style="font-size:15px; font-weight:700; color:#0F172A;">${currentAppointment.doctor}</div>
        <div style="font-size:12px; color:#64748B;">${currentAppointment.specialty}</div>
        <span style="display:inline-block; font-size:10.5px; font-weight:600; color:#059669; background:#ECFDF5; padding:2px 8px; border-radius:999px; margin-top:3px;">• ${currentAppointment.status}</span>
      </div>
    </div>
    <div style="display:flex; flex-direction:column; gap:8px; font-size:12.5px;">
      <div style="display:flex; justify-content:space-between; color:#334155;">
        <span style="color:#64748B;">Date & Time</span>
        <strong style="color:#0F172A;">${currentAppointment.date} at ${currentAppointment.time}</strong>
      </div>
      <div style="display:flex; justify-content:space-between; color:#334155;">
        <span style="color:#64748B;">Location</span>
        <strong>${currentAppointment.branch}</strong>
      </div>
      <div style="display:flex; justify-content:space-between; color:#334155;">
        <span style="color:#64748B;">Room</span>
        <strong>${currentAppointment.room}</strong>
      </div>
      <div style="display:flex; justify-content:space-between; color:#334155;">
        <span style="color:#64748B;">Consultation Fee</span>
        <strong style="color:#2563EB;">${currentAppointment.fee}</strong>
      </div>
    </div>
  `;

  modalFooter.innerHTML = `
    <button onclick="downloadCalendarInvite()" style="padding:10px; background:#2563EB; color:#fff; border:none; border-radius:8px; font-size:13px; font-weight:600; cursor:pointer;">Add to Calendar (.ics)</button>
    <button onclick="openRescheduleModal()" style="padding:10px; background:#EFF6FF; color:#2563EB; border:1px solid #BFDBFE; border-radius:8px; font-size:13px; font-weight:600; cursor:pointer;">Reschedule Appointment</button>
    <button onclick="openCancelModal()" style="padding:10px; background:#FEF2F2; color:#DC2626; border:1px solid #FECACA; border-radius:8px; font-size:13px; font-weight:600; cursor:pointer;">Cancel Appointment</button>
  `;

  openModalContainer();
};

window.openRescheduleModal = function() {
  modalTitle.textContent = "Reschedule Appointment";
  modalBody.innerHTML = `
    <p style="margin-bottom:12px; font-size:13px; color:#475569;">Select a new available time for <strong>${currentAppointment.doctor}</strong>:</p>
    <div style="display:flex; flex-direction:column; gap:8px;">
      <button onclick="confirmReschedule('Tomorrow, 15 Nov at 11:00 AM')" style="text-align:left; padding:10px; border:1px solid #E2E8F0; border-radius:8px; background:#fff; font-size:12.5px; cursor:pointer;">
        <strong>Friday, 15 November</strong> - 11:00 AM (Morning)
      </button>
      <button onclick="confirmReschedule('Saturday, 16 Nov at 5:00 PM')" style="text-align:left; padding:10px; border:1px solid #E2E8F0; border-radius:8px; background:#fff; font-size:12.5px; cursor:pointer;">
        <strong>Saturday, 16 November</strong> - 5:00 PM (Evening)
      </button>
      <button onclick="confirmReschedule('Sunday, 17 Nov at 2:00 PM')" style="text-align:left; padding:10px; border:1px solid #E2E8F0; border-radius:8px; background:#fff; font-size:12.5px; cursor:pointer;">
        <strong>Sunday, 17 November</strong> - 2:00 PM (Afternoon)
      </button>
    </div>
  `;
  modalFooter.innerHTML = `
    <button onclick="closeActiveModal()" style="padding:9px; background:#F1F5F9; border:none; border-radius:8px; font-size:12.5px; cursor:pointer;">Dismiss</button>
  `;
  openModalContainer();
};

window.confirmReschedule = function(newDateTime) {
  currentAppointment.date = newDateTime;
  const bookedDateTimeEl = document.getElementById("bookedDoctorDateTime");
  const sideDocTime = document.getElementById("sideDocTime");
  const embDate = document.getElementById("embDate");

  if (bookedDateTimeEl) bookedDateTimeEl.textContent = newDateTime;
  if (sideDocTime) sideDocTime.textContent = newDateTime;
  if (embDate) embDate.textContent = newDateTime;

  closeActiveModal();
  showToast(`Rescheduled to ${newDateTime}`, "success");
  appendBotMessage(`Your appointment has been successfully rescheduled to: <strong>${newDateTime}</strong>.`);
};

window.openCancelModal = function() {
  modalTitle.textContent = "Cancel Appointment";
  modalBody.innerHTML = `
    <p style="font-size:13px; color:#475569; margin-bottom:10px;">Are you sure you want to cancel your appointment with <strong>${currentAppointment.doctor}</strong>?</p>
    <p style="font-size:11.5px; color:#94A3B8;">Free cancellation is permitted up to 2 hours before the scheduled time slot.</p>
  `;
  modalFooter.innerHTML = `
    <button onclick="confirmCancelAppointment()" style="padding:10px; background:#DC2626; color:#fff; border:none; border-radius:8px; font-size:13px; font-weight:600; cursor:pointer;">Confirm Cancellation</button>
    <button onclick="closeActiveModal()" style="padding:9px; background:#F1F5F9; border:none; border-radius:8px; font-size:12.5px; cursor:pointer;">Keep Appointment</button>
  `;
  openModalContainer();
};

window.confirmCancelAppointment = function() {
  closeActiveModal();
  const sideDocStatus = document.getElementById("sideDocStatus");
  if (sideDocStatus) sideDocStatus.textContent = "Cancelled";
  showToast("Appointment cancelled", "info");
  appendBotMessage(`Your appointment with <strong>${currentAppointment.doctor}</strong> has been cancelled.`);
};

window.openProfileModal = function() {
  modalTitle.textContent = "Patient Profile";
  modalBody.innerHTML = `
    <div style="display:flex; align-items:center; gap:12px; margin-bottom:14px;">
      <div style="width:46px; height:46px; border-radius:50%; background:#DBEAFE; color:#1D4ED8; font-weight:700; display:flex; align-items:center; justify-content:center; font-size:14px;">P</div>
      <div>
        <div style="font-size:15px; font-weight:700; color:#0F172A;">${currentAppointment.patientName}</div>
        <div style="font-size:12px; color:#64748B;">${currentAppointment.patientPhone}</div>
      </div>
    </div>
    <div style="display:flex; flex-direction:column; gap:8px; font-size:12.5px;">
      <div style="display:flex; justify-content:space-between;">
        <span style="color:#64748B;">Date of Birth</span>
        <strong>${currentAppointment.patientDOB}</strong>
      </div>
      <div style="display:flex; justify-content:space-between;">
        <span style="color:#64748B;">Email</span>
        <strong>${currentAppointment.patientEmail}</strong>
      </div>
      <div style="display:flex; justify-content:space-between;">
        <span style="color:#64748B;">Insurance Policy</span>
        <strong style="color:#2563EB;">${currentAppointment.insurance}</strong>
      </div>
    </div>
  `;
  modalFooter.innerHTML = `
    <button onclick="openInsuranceModal()" style="padding:10px; background:#2563EB; color:#fff; border:none; border-radius:8px; font-size:13px; font-weight:600; cursor:pointer;">Link Insurance Policy</button>
    <button onclick="closeActiveModal()" style="padding:9px; background:#F1F5F9; border:none; border-radius:8px; font-size:12.5px; cursor:pointer;">Close</button>
  `;
  openModalContainer();
};

window.openInsuranceModal = function() {
  modalTitle.textContent = "Add Health Insurance";
  modalBody.innerHTML = `
    <p style="font-size:13px; color:#475569; margin-bottom:12px;">Select your health insurance carrier to verify direct billing coverage:</p>
    <select id="insuranceSelect" style="width:100%; padding:10px; border:1px solid #CBD5E1; border-radius:8px; font-size:13px; outline:none; margin-bottom:12px;">
      <option value="AXA Egypt (Gold Plan)">AXA Egypt (Gold Plan)</option>
      <option value="MetLife Egypt">MetLife Egypt</option>
      <option value="Bupa Global">Bupa Global</option>
      <option value="Allianz Care">Allianz Care</option>
    </select>
    <input type="text" id="policyNumberInput" placeholder="Enter Policy / Card Number" style="width:100%; padding:10px; border:1px solid #CBD5E1; border-radius:8px; font-size:13px; outline:none;">
  `;
  modalFooter.innerHTML = `
    <button onclick="saveInsurancePolicy()" style="padding:10px; background:#2563EB; color:#fff; border:none; border-radius:8px; font-size:13px; font-weight:600; cursor:pointer;">Save Policy</button>
    <button onclick="closeActiveModal()" style="padding:9px; background:#F1F5F9; border:none; border-radius:8px; font-size:12.5px; cursor:pointer;">Cancel</button>
  `;
  openModalContainer();
};

window.saveInsurancePolicy = function() {
  const sel = document.getElementById("insuranceSelect");
  const val = sel ? sel.value : "AXA Egypt (Gold Plan)";
  currentAppointment.insurance = val;

  const desktopStatus = document.getElementById("desktopInsuranceStatus");
  if (desktopStatus) desktopStatus.textContent = val;

  closeActiveModal();
  showToast("Insurance policy verified & linked", "success");
  appendBotMessage(`Your <strong>${val}</strong> policy has been linked to your patient profile.`);
};

window.openContactModal = function() {
  modalTitle.textContent = "Contact Human Support";
  modalBody.innerHTML = `
    <p style="font-size:13px; color:#475569; margin-bottom:12px;">Our patient support team is available 24/7 to assist with urgent medical requests:</p>
    <div style="display:flex; flex-direction:column; gap:8px; font-size:13px;">
      <div style="padding:10px; background:#F8FAFC; border-radius:8px; border:1px solid #E2E8F0;">
        <strong>Support Hotline:</strong> 19000 (Local Egypt)
      </div>
      <div style="padding:10px; background:#F8FAFC; border-radius:8px; border:1px solid #E2E8F0;">
        <strong>Emergency Care:</strong> +20 2 2415 0000
      </div>
    </div>
  `;
  modalFooter.innerHTML = `
    <button onclick="startVoiceCall()" style="padding:10px; background:#2563EB; color:#fff; border:none; border-radius:8px; font-size:13px; font-weight:600; cursor:pointer;">Talk to AI Voice Agent Now</button>
    <button onclick="closeActiveModal()" style="padding:9px; background:#F1F5F9; border:none; border-radius:8px; font-size:12.5px; cursor:pointer;">Close</button>
  `;
  openModalContainer();
};

window.openNotificationsModal = function() {
  modalTitle.textContent = "Notifications";
  modalBody.innerHTML = `
    <div style="display:flex; flex-direction:column; gap:10px; font-size:12.5px;">
      <div style="padding:10px; background:#EFF6FF; border-radius:8px; border-left:3px solid #2563EB;">
        <div style="font-weight:700; color:#1E40AF;">Appointment Reminder</div>
        <div style="color:#475569; font-size:11.5px; margin-top:2px;">Your appointment with Dr. Ahmed Mohamed is on Thursday at 2:00 PM.</div>
      </div>
      <div style="padding:10px; background:#F8FAFC; border-radius:8px; border-left:3px solid #CBD5E1;">
        <div style="font-weight:600; color:#0F172A;">Lab Results Ready</div>
        <div style="color:#64748B; font-size:11.5px; margin-top:2px;">Routine Lipid Profile results are available under Records.</div>
      </div>
    </div>
  `;
  modalFooter.innerHTML = `
    <button onclick="closeActiveModal()" style="padding:9px; background:#F1F5F9; border:none; border-radius:8px; font-size:12.5px; cursor:pointer;">Close</button>
  `;
  openModalContainer();
};

window.openOptionsModal = function() {
  modalTitle.textContent = "Chat Options";
  modalBody.innerHTML = `
    <div style="display:flex; flex-direction:column; gap:8px;">
      <button onclick="resetChat()" style="text-align:left; padding:10px; background:#fff; border:1px solid #E2E8F0; border-radius:8px; font-size:12.5px; cursor:pointer;">
        <strong>New Conversation</strong> - Reset conversation
      </button>
      <button onclick="startVoiceCall()" style="text-align:left; padding:10px; background:#fff; border:1px solid #E2E8F0; border-radius:8px; font-size:12.5px; cursor:pointer;">
        <strong>AI Voice Call</strong> - Interactive voice agent
      </button>
      <button onclick="openAppointmentModal()" style="text-align:left; padding:10px; background:#fff; border:1px solid #E2E8F0; border-radius:8px; font-size:12.5px; cursor:pointer;">
        <strong>View Current Booking</strong>
      </button>
    </div>
  `;
  modalFooter.innerHTML = `
    <button onclick="closeActiveModal()" style="padding:9px; background:#F1F5F9; border:none; border-radius:8px; font-size:12.5px; cursor:pointer;">Close</button>
  `;
  openModalContainer();
};

window.resetChat = function() {
  closeActiveModal();
  showToast("Chat reset to initial view", "info");
  location.reload();
};

function openModalContainer() {
  if (modalBackdrop) modalBackdrop.classList.add("active");
}

window.closeActiveModal = function(e) {
  if (!e || e.target === modalBackdrop || !e.target.closest("#modalContainer")) {
    if (modalBackdrop) modalBackdrop.classList.remove("active");
  }
};

// -------------------------------------------------------------------------
// VOICE CALL SIMULATION
// -------------------------------------------------------------------------
window.startVoiceCall = function() {
  closeActiveModal();
  if (voiceCallOverlay) voiceCallOverlay.classList.add("active");
};

window.endVoiceCall = function() {
  if (voiceCallOverlay) voiceCallOverlay.classList.remove("active");
  showToast("Voice call ended", "info");
};

window.toggleMuteVoice = function(btn) {
  const isMuted = btn.classList.toggle("muted");
  const span = btn.querySelector("span");
  if (span) span.textContent = isMuted ? "Unmute" : "Mute";
  showToast(isMuted ? "Microphone muted" : "Microphone unmuted", "info");
};

window.toggleSpeakerVoice = function(btn) {
  const isSpeaker = btn.classList.toggle("speaker-on");
  showToast(isSpeaker ? "Speakerphone active" : "Ear speaker active", "info");
};

// -------------------------------------------------------------------------
// MOBILE BOTTOM TAB NAVIGATION
// -------------------------------------------------------------------------
window.switchTab = function(tabName) {
  document.querySelectorAll(".nav-tab").forEach(tab => tab.classList.remove("active-tab"));
  
  if (tabName === "AIChat") {
    const el = document.getElementById("tabAIChat");
    if (el) el.classList.add("active-tab");
    showToast("AI Call Center Chat", "info");
  } else if (tabName === "Appointments") {
    const el = document.getElementById("tabAppointments");
    if (el) el.classList.add("active-tab");
    openAppointmentModal();
  } else if (tabName === "Profile") {
    const el = document.getElementById("tabProfile");
    if (el) el.classList.add("active-tab");
    openProfileModal();
  } else if (tabName === "Records") {
    const el = document.getElementById("tabRecords");
    if (el) el.classList.add("active-tab");
    modalTitle.textContent = "Medical Records";
    modalBody.innerHTML = `
      <div style="font-size:12.5px; color:#475569; display:flex; flex-direction:column; gap:8px;">
        <div style="padding:10px; background:#F8FAFC; border-radius:8px; border:1px solid #E2E8F0;">
          <strong>Cardiology Screening Report</strong>
          <div style="font-size:11px; color:#94A3B8;">12 October 2024 • Dr. Ahmed Mohamed</div>
        </div>
        <div style="padding:10px; background:#F8FAFC; border-radius:8px; border:1px solid #E2E8F0;">
          <strong>Complete Blood Count (CBC)</strong>
          <div style="font-size:11px; color:#94A3B8;">18 August 2024 • Heliopolis Central Lab</div>
        </div>
      </div>
    `;
    modalFooter.innerHTML = `<button onclick="closeActiveModal()" style="padding:9px; background:#F1F5F9; border:none; border-radius:8px; font-size:12.5px; cursor:pointer;">Close</button>`;
    openModalContainer();
  } else if (tabName === "Home") {
    const el = document.getElementById("tabHome");
    if (el) el.classList.add("active-tab");
    showToast("Shiffaa Clinics Home", "info");
  }
};

// -------------------------------------------------------------------------
// TOAST NOTIFICATIONS & CALENDAR INVITE
// -------------------------------------------------------------------------
function showToast(message, type = "info") {
  if (!toastContainer) return;
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(10px)";
    toast.style.transition = "all 0.25s ease";
    setTimeout(() => toast.remove(), 250);
  }, 2500);
}

window.downloadCalendarInvite = function() {
  const icsData = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Shiffaa Clinics//AI Scheduling//EN",
    "BEGIN:VEVENT",
    "SUMMARY:Cardiology Consultation - " + currentAppointment.doctor,
    "DESCRIPTION:Medical appointment booked via Shiffaa Clinics AI Assistant.",
    "LOCATION:" + currentAppointment.branch,
    "DTSTART:20241114T120000Z",
    "DTEND:20241114T123000Z",
    "STATUS:CONFIRMED",
    "END:VEVENT",
    "END:VCALENDAR"
  ].join("\r\n");

  const blob = new Blob([icsData], { type: "text/calendar;charset=utf-8" });
  const link = document.createElement("a");
  link.href = window.URL.createObjectURL(blob);
  link.setAttribute("download", "shiffaa_clinics_appointment.ics");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast("Calendar invite downloaded (.ics)", "success");
};

// Utilities
function getCurrentTime() {
  const d = new Date();
  let hours = d.getHours();
  const minutes = d.getMinutes().toString().padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12 || 12;
  return `${hours}:${minutes} ${ampm}`;
}

function escapeHtml(str) {
  return str.replace(/[&<>'"]/g, 
    tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
  );
}

/**
 * Nile Clinics - Appointments Page Controller
 * Connected Live to Supabase DB via FastAPI endpoints:
 *   GET /api/v1/portal/appointments
 *   POST /api/v1/portal/appointments
 *   PATCH /api/v1/portal/appointments/{id}/reschedule
 *   PATCH /api/v1/portal/appointments/{id}/cancel
 */

(function () {
  'use strict';

  let allAppointments = [];
  let allSpecialties = [];
  let allDoctors = [];
  let currentTab = 'upcoming';

  function parseApptDate(dateStr) {
    const dt = new Date(dateStr);
    if (isNaN(dt.getTime())) return { dayName: 'THU', dayNum: '14', month: 'NOV' };
    const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return {
      dayName: dayNames[dt.getDay()],
      dayNum: String(dt.getDate()).padStart(2, '0'),
      month: monthNames[dt.getMonth()]
    };
  }

  function getDoctorDisplayName(d, isAr) {
    if (!d) return isAr ? 'طبيب' : 'Doctor';
    if (isAr) {
      return d.name_ar || d.full_name_ar || d.name_en || d.full_name_en || 'د. استشاري';
    }
    return d.name_en || d.full_name_en || d.name_ar || d.full_name_ar || 'Doctor';
  }

  function getSpecialtyDisplayName(s, isAr) {
    if (!s) return '';
    if (isAr) {
      return s.name_ar || s.name_en || '';
    }
    return s.name_en || s.name_ar || '';
  }

  async function loadInitialData() {
    try {
      allSpecialties = await UserApi.getSpecialties();
      populateSpecialtyFilter(allSpecialties);
    } catch (_) {}

    try {
      allDoctors = await UserApi.getDoctors();
      populateDoctorFilter(allDoctors);
    } catch (_) {}

    await fetchAndRenderAppointments();
  }

  function populateSpecialtyFilter(specialties) {
    const sel = document.getElementById('apptSpecialtyFilter');
    if (!sel) return;
    const isAr = window.getCurrentLang && window.getCurrentLang() === 'ar';
    const cur = sel.value;
    sel.innerHTML = `<option value="">${isAr ? 'كل التخصصات' : 'All Departments'}</option>`;
    specialties.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s.id;
      opt.textContent = getSpecialtyDisplayName(s, isAr);
      sel.appendChild(opt);
    });
    sel.value = cur;
  }

  function populateDoctorFilter(doctors) {
    const sel = document.getElementById('apptDoctorFilter');
    if (!sel) return;
    const isAr = window.getCurrentLang && window.getCurrentLang() === 'ar';
    const cur = sel.value;
    sel.innerHTML = `<option value="">${isAr ? 'كل الأطباء' : 'All Doctors'}</option>`;
    doctors.forEach(d => {
      const opt = document.createElement('option');
      opt.value = d.id;
      opt.textContent = getDoctorDisplayName(d, isAr);
      sel.appendChild(opt);
    });
    sel.value = cur;
  }

  async function fetchAndRenderAppointments() {
    try {
      allAppointments = await UserApi.getAppointments();
    } catch (_) {
      allAppointments = [];
    }

    renderAppointmentsList();
    updateTabCounts();
  }

  function updateTabCounts() {
    const upcoming = allAppointments.filter(a => a.status !== 'cancelled' && a.status !== 'canceled' && a.status !== 'completed').length;
    const past = allAppointments.filter(a => a.status === 'completed').length;
    const canceled = allAppointments.filter(a => a.status === 'cancelled' || a.status === 'canceled').length;

    const bAppt = document.getElementById('navApptBadge');
    const bUp = document.getElementById('tabCountUpcoming');
    const bPast = document.getElementById('tabCountPast');
    const bCanc = document.getElementById('tabCountCanceled');

    if (bAppt) bAppt.textContent = String(upcoming);
    if (bUp) bUp.textContent = String(upcoming);
    if (bPast) bPast.textContent = String(past);
    if (bCanc) bCanc.textContent = String(canceled);

    try { localStorage.setItem('clinic_upcoming_count', String(upcoming)); } catch (_) {}
    if (window.ClinicPortalAuth && typeof window.ClinicPortalAuth.setAppointmentBadgeCount === 'function') {
      window.ClinicPortalAuth.setAppointmentBadgeCount(upcoming);
    }
  }

  function renderAppointmentsList() {
    const container = document.getElementById('appointmentsCardsList');
    if (!container) return;

    let filtered = allAppointments.filter((a) => {
      const st = (a.status || 'scheduled').toLowerCase();
      if (currentTab === 'upcoming') return st !== 'cancelled' && st !== 'canceled' && st !== 'completed';
      if (currentTab === 'past') return st === 'completed';
      if (currentTab === 'canceled') return st === 'cancelled' || st === 'canceled';
      return true;
    });

    // Specialty filter
    const specSel = document.getElementById('apptSpecialtyFilter');
    if (specSel && specSel.value) {
      const val = specSel.value;
      filtered = filtered.filter(a => 
        (a.specialty_id !== undefined && String(a.specialty_id) === String(val)) ||
        (a.specialty && String(a.specialty.id) === String(val)) ||
        (a.doctor && String(a.doctor.specialty_id) === String(val))
      );
    }

    // Doctor filter
    const docSel = document.getElementById('apptDoctorFilter');
    if (docSel && docSel.value) {
      const val = docSel.value;
      filtered = filtered.filter(a => 
        (a.doctor_id !== undefined && String(a.doctor_id) === String(val)) ||
        (a.doctor && String(a.doctor.id) === String(val))
      );
    }

    // Date filter
    const dateInput = document.getElementById('apptDateFilter');
    if (dateInput && dateInput.value) {
      filtered = filtered.filter(a => a.appointment_date === dateInput.value);
    }

    const isAr = window.getCurrentLang && window.getCurrentLang() === 'ar';

    if (filtered.length === 0) {
      container.innerHTML = `
        <div style="background:#FFFFFF; border:1px solid #E2E8F0; border-radius:14px; padding:40px 20px; text-align:center;">
          <p style="color:#64748B; font-size:14px; margin-bottom:14px;">
            ${isAr ? 'لا توجد مواعيد مسجلة في هذا القسم حالياً.' : 'No appointments found in this section.'}
          </p>
          <button class="btn-primary-action" onclick="openBookAppointmentModal()" style="display:inline-flex;">
            ${isAr ? '+ احجز كشف جديد' : '+ Book New Appointment'}
          </button>
        </div>
      `;
      return;
    }

    container.innerHTML = filtered.map((a) => {
      const dParts = parseApptDate(a.appointment_date);
      const docName = isAr ? (a.doctor_name_ar || a.doctor_name || 'طبيب استشاري') : (a.doctor_name || 'Consultant Doctor');
      const specName = isAr ? (a.specialty_name_ar || a.specialty_name || 'العيادة التخصصية') : (a.specialty_name || 'Specialty Clinic');
      const branch = isAr ? (a.branch_name_ar || a.branch_name || 'الفرع الرئيسي - مصر الجديدة') : (a.branch_name || 'Main Branch - Heliopolis');
      const timeStr = a.time_short || (a.start_time ? a.start_time.substring(0, 5) : '10:00 AM');
      const avatar = a.avatar || 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=120&h=120&fit=crop&crop=faces';

      const st = (a.status || 'scheduled').toLowerCase();
      const isCancelled = st === 'cancelled' || st === 'canceled';
      const badgeClass = isCancelled ? 'status-badge-red' : (st === 'pending' ? 'status-badge-amber' : 'status-badge-green');
      const badgeText = isCancelled ? (isAr ? 'ملغي' : 'Canceled') : (st === 'pending' ? (isAr ? 'قيد التأكيد' : 'Pending') : (isAr ? 'مؤكد' : 'Confirmed'));

      return `
        <div class="appt-item-card" data-appt-id="${a.id}">
          <div class="appt-left-col">
            <div class="appt-date-block">
              <span class="appt-day-name">${dParts.dayName}</span>
              <span class="appt-day-num">${dParts.dayNum}</span>
              <span class="appt-month-name">${dParts.month}</span>
            </div>
            <img class="appt-doc-avatar" src="${avatar}" alt="${docName}">
            <div class="appt-doc-info">
              <h4>${docName}</h4>
              <div class="appt-spec-text">${specName}</div>
              <div class="appt-meta-row">
                <span>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
                  ${branch}
                </span>
                <span>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                  ${timeStr}
                </span>
              </div>
            </div>
          </div>
          <div class="appt-right-col">
            <span class="${badgeClass}">
              <span class="dot-indicator"></span>
              ${badgeText}
            </span>
            ${!isCancelled ? `
              <div class="appt-btn-actions">
                <button class="btn-reschedule-outline" onclick="openRescheduleModal(${a.id}, '${escapeJs(docName)}', '${a.appointment_date}', '${timeStr}')">
                  ${isAr ? 'تعديل الميعاد' : 'Reschedule'}
                </button>
                <button class="btn-cancel-outline" onclick="openCancelModal(${a.id}, '${escapeJs(docName)}')">
                  ${isAr ? 'إلغاء' : 'Cancel'}
                </button>
              </div>
            ` : ''}
          </div>
        </div>
      `;
    }).join('');
  }

  window.filterAppointmentsByTab = function (tab) {
    currentTab = tab;
    document.querySelectorAll('#apptStatusTabs .tab-pill-btn').forEach(b => {
      b.classList.toggle('active', b.getAttribute('data-tab') === tab);
    });
    renderAppointmentsList();
  };

  window.onSpecialtyFilterChange = function () {
    const specSel = document.getElementById('apptSpecialtyFilter');
    const selectedSpecId = specSel ? specSel.value : '';
    
    // Filter doctors dropdown to only show doctors in this department
    const docSel = document.getElementById('apptDoctorFilter');
    if (docSel) {
      const filteredDocs = selectedSpecId 
        ? allDoctors.filter(d => (d.specialty_id == selectedSpecId || d.specialty?.id == selectedSpecId))
        : allDoctors;
      populateDoctorFilter(filteredDocs);
    }
    
    renderAppointmentsList();
  };

  window.applyAppointmentFilters = function () {
    renderAppointmentsList();
  };

  window.resetAppointmentFilters = function () {
    const s1 = document.getElementById('apptSpecialtyFilter');
    const s2 = document.getElementById('apptDoctorFilter');
    const s3 = document.getElementById('apptDateFilter');
    if (s1) s1.value = '';
    if (s2) s2.value = '';
    if (s3) s3.value = '';
    populateDoctorFilter(allDoctors);
    renderAppointmentsList();
  };

  // RESCHEDULE MODAL
  window.openRescheduleModal = function (apptId, doctorName, currentDate, currentTime) {
    const isAr = window.getCurrentLang && window.getCurrentLang() === 'ar';
    const title = isAr ? `تعديل ميعاد: ${doctorName}` : `Reschedule: ${doctorName}`;

    const body = `
      <div style="display:flex; flex-direction:column; gap:16px;">
        <div style="background:#EFF6FF; border:1px solid #BFDBFE; border-radius:10px; padding:12px; font-size:13px; color:#1E40AF;">
          <strong>${isAr ? 'الميعاد الحالي:' : 'Current Slot:'}</strong> ${currentDate} (${currentTime})
        </div>
        <div>
          <label style="display:block; font-size:12px; font-weight:600; color:#64748B; margin-bottom:6px;">
            ${isAr ? 'اختر التاريخ الجديد' : 'New Appointment Date'}
          </label>
          <input type="date" id="modalReschedDate" class="filter-date-input" value="${currentDate || new Date().toISOString().split('T')[0]}">
        </div>
        <div>
          <label style="display:block; font-size:12px; font-weight:600; color:#64748B; margin-bottom:6px;">
            ${isAr ? 'اختر الوقت الجديد' : 'New Time Slot'}
          </label>
          <select id="modalReschedTime" class="filter-select">
            <option value="10:00:00">10:00 AM</option>
            <option value="11:30:00">11:30 AM</option>
            <option value="14:00:00">02:00 PM</option>
            <option value="15:30:00">03:30 PM</option>
            <option value="17:00:00">05:00 PM</option>
            <option value="18:30:00">06:30 PM</option>
          </select>
        </div>
      </div>
    `;

    const footer = `
      <button class="btn-secondary-action" onclick="closeActiveModal()">
        ${isAr ? 'إلغاء' : 'Cancel'}
      </button>
      <button class="btn-primary-action" onclick="submitRescheduleModal(${apptId})">
        ${isAr ? 'حفظ الميعاد الجديد' : 'Confirm Reschedule'}
      </button>
    `;

    openModal(title, body, footer);
  };

  window.submitRescheduleModal = async function (apptId) {
    const newDate = document.getElementById('modalReschedDate')?.value;
    const newTime = document.getElementById('modalReschedTime')?.value;
    const isAr = window.getCurrentLang && window.getCurrentLang() === 'ar';

    try {
      await UserApi.rescheduleAppointment(apptId, newDate, newTime);
      closeActiveModal();
      showToast(isAr ? 'تم تعديل الميعاد في قاعدة البيانات بنجاح' : 'Appointment rescheduled in clinic database', 'success');
      await fetchAndRenderAppointments();
    } catch (err) {
      closeActiveModal();
      showToast(err.message || (isAr ? 'تعذر تعديل الميعاد' : 'Reschedule failed'), 'error');
    }
  };

  // CANCEL MODAL
  window.openCancelModal = function (apptId, doctorName) {
    const isAr = window.getCurrentLang && window.getCurrentLang() === 'ar';
    const title = isAr ? 'تأكيد إلغاء الكشف' : 'Cancel Appointment';

    const body = `
      <div style="text-align:center; padding:10px 0;">
        <div style="width:48px; height:48px; border-radius:50%; background:#FEE2E2; color:#DC2626; display:flex; align-items:center; justify-content:center; margin:0 auto 14px auto;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="24" height="24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </div>
        <h4 style="font-size:16px; font-weight:700; color:#1E293B; margin-bottom:8px;">
          ${isAr ? `متأكد من إلغاء ميعادك مع ${doctorName}؟` : `Cancel appointment with ${doctorName}?`}
        </h4>
        <p style="font-size:13px; color:#64748B; line-height:1.5;">
          ${isAr ? 'هذا الإجراء سيقوم بإلغاء الحجز في قاعدة بيانات العيادة وإتاحة الميعاد لمرضى آخرين.' : 'This will cancel the booking in the clinic database and make the slot available for other patients.'}
        </p>
      </div>
    `;

    const footer = `
      <button class="btn-secondary-action" onclick="closeActiveModal()">
        ${isAr ? 'رجوع' : 'Keep Appointment'}
      </button>
      <button class="btn-primary-action" style="background:#DC2626; border-color:#DC2626;" onclick="submitCancelModal(${apptId})">
        ${isAr ? 'نعم، قم بالإلغاء' : 'Yes, Cancel Appointment'}
      </button>
    `;

    openModal(title, body, footer);
  };

  window.submitCancelModal = async function (apptId) {
    const isAr = window.getCurrentLang && window.getCurrentLang() === 'ar';
    try {
      await UserApi.cancelAppointment(apptId);
      closeActiveModal();
      showToast(isAr ? 'تم إلغاء الميعاد بنجاح' : 'Appointment cancelled successfully', 'info');
      await fetchAndRenderAppointments();
    } catch (err) {
      closeActiveModal();
      showToast(err.message || (isAr ? 'تعذر إلغاء الميعاد' : 'Cancellation failed'), 'error');
    }
  };

  // BOOK NEW APPOINTMENT MODAL (Connected Live to Supabase DB)
  window.openBookAppointmentModal = async function () {
    const isAr = window.getCurrentLang && window.getCurrentLang() === 'ar';
    const title = isAr ? 'حجز ميعاد كشف جديد' : 'Book New Appointment';

    if (!allDoctors || allDoctors.length === 0) {
      try {
        allDoctors = await UserApi.getDoctors();
      } catch (_) {}
    }
    if (!allSpecialties || allSpecialties.length === 0) {
      try {
        allSpecialties = await UserApi.getSpecialties();
      } catch (_) {}
    }

    // Build department options
    const specOptions = (allSpecialties || []).map(s => {
      const sName = getSpecialtyDisplayName(s, isAr);
      return `<option value="${s.id}">${sName}</option>`;
    }).join('');

    // Build doctor options
    const docOptions = (allDoctors || []).map(d => {
      const dName = getDoctorDisplayName(d, isAr);
      const spec = isAr ? (d.specialty?.name_ar || d.specialty_name_ar || '') : (d.specialty?.name_en || d.specialty_name_en || '');
      return `<option value="${d.id}" data-spec-id="${d.specialty_id || d.specialty?.id || ''}">${dName} ${spec ? `(${spec})` : ''}</option>`;
    }).join('');

    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const defDate = tomorrow.toISOString().split('T')[0];

    const body = `
      <div style="display:flex; flex-direction:column; gap:14px;">
        <div>
          <label style="display:block; font-size:12px; font-weight:600; color:#64748B; margin-bottom:6px;">
            ${isAr ? 'التخصص الطبي (اختياري للتصفية)' : 'Medical Department (Filter)'}
          </label>
          <select id="modalBookSpecialty" class="filter-select" onchange="window.filterBookingDoctorsBySpecialty(this.value)">
            <option value="">${isAr ? 'جميع التخصصات المتاحة' : 'All Departments'}</option>
            ${specOptions}
          </select>
        </div>

        <div>
          <label style="display:block; font-size:12px; font-weight:600; color:#64748B; margin-bottom:6px;">
            ${isAr ? 'اختر الطبيب المعالج *' : 'Select Doctor *'}
          </label>
          <select id="modalBookDoctor" class="filter-select">
            ${docOptions || `<option value="1">${isAr ? 'د. أمل نور (أمراض القلب)' : 'Dr. Amal Nour (Cardiology)'}</option>`}
          </select>
        </div>

        <div>
          <label style="display:block; font-size:12px; font-weight:600; color:#64748B; margin-bottom:6px;">
            ${isAr ? 'تاريخ الكشف *' : 'Appointment Date *'}
          </label>
          <input type="date" id="modalBookDate" class="filter-date-input" min="${todayStr}" value="${defDate}">
        </div>

        <div>
          <label style="display:block; font-size:12px; font-weight:600; color:#64748B; margin-bottom:6px;">
            ${isAr ? 'الميعاد المناسب *' : 'Preferred Time Slot *'}
          </label>
          <select id="modalBookTime" class="filter-select">
            <option value="09:00:00">09:00 AM</option>
            <option value="10:00:00" selected>10:00 AM</option>
            <option value="11:30:00">11:30 AM</option>
            <option value="13:00:00">01:00 PM</option>
            <option value="14:00:00">02:00 PM</option>
            <option value="15:30:00">03:30 PM</option>
            <option value="17:00:00">05:00 PM</option>
            <option value="18:30:00">06:30 PM</option>
          </select>
        </div>

        <div>
          <label style="display:block; font-size:12px; font-weight:600; color:#64748B; margin-bottom:6px;">
            ${isAr ? 'سبب الكشف أو الاستشارة' : 'Reason for Consultation'}
          </label>
          <input type="text" id="modalBookReason" class="filter-select" placeholder="${isAr ? 'مثال: فحص دوري، متابعة علاج، فحص ضغط...' : 'e.g. Regular checkup, follow-up, consultation...'}">
        </div>
      </div>
    `;

    const footer = `
      <button class="btn-secondary-action" onclick="closeActiveModal()">
        ${isAr ? 'إلغاء' : 'Cancel'}
      </button>
      <button class="btn-primary-action" id="btnConfirmBookingSubmit" onclick="submitBookAppointmentModal()">
        ${isAr ? 'تأكيد الحجز وحفظه بالـ DB' : 'Confirm & Save Booking'}
      </button>
    `;

    openModal(title, body, footer);
  };

  window.filterBookingDoctorsBySpecialty = function (specId) {
    const docSel = document.getElementById('modalBookDoctor');
    if (!docSel) return;
    const isAr = window.getCurrentLang && window.getCurrentLang() === 'ar';
    const filtered = specId ? (allDoctors || []).filter(d => (d.specialty_id == specId || d.specialty?.id == specId)) : allDoctors;
    
    if (!filtered || filtered.length === 0) {
      docSel.innerHTML = `<option value="">${isAr ? 'لا يوجد أطباء في هذا التخصص حالياً' : 'No doctors in this specialty'}</option>`;
      return;
    }

    docSel.innerHTML = filtered.map(d => {
      const dName = getDoctorDisplayName(d, isAr);
      const spec = isAr ? (d.specialty?.name_ar || d.specialty_name_ar || '') : (d.specialty?.name_en || d.specialty_name_en || '');
      return `<option value="${d.id}">${dName} ${spec ? `(${spec})` : ''}</option>`;
    }).join('');
  };

  window.submitBookAppointmentModal = async function () {
    const docId = document.getElementById('modalBookDoctor')?.value;
    const dateVal = document.getElementById('modalBookDate')?.value;
    const timeVal = document.getElementById('modalBookTime')?.value;
    const reasonVal = document.getElementById('modalBookReason')?.value || 'Consultation via patient portal';
    const isAr = window.getCurrentLang && window.getCurrentLang() === 'ar';
    const submitBtn = document.getElementById('btnConfirmBookingSubmit');

    if (!docId || !dateVal || !timeVal) {
      showToast(isAr ? 'يرجى استكمال جميع بيانات الحجز' : 'Please fill all appointment details', 'error');
      return;
    }

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = isAr ? 'جاري الحفظ...' : 'Saving booking...';
    }

    try {
      await UserApi.bookAppointment({
        doctor_id: parseInt(docId, 10),
        appointment_date: dateVal,
        start_time: timeVal,
        visit_reason: reasonVal
      });

      closeActiveModal();
      showToast(isAr ? 'تم تأكيد حجزك بنجاح وحفظه في قاعدة البيانات!' : 'Appointment booked and saved in clinic database successfully!', 'success');
      await fetchAndRenderAppointments();
    } catch (err) {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = isAr ? 'تأكيد الحجز وحفظه بالـ DB' : 'Confirm & Save Booking';
      }
      showToast(err.message || (isAr ? 'فشل إتمام الحجز في قاعدة البيانات' : 'Failed to save appointment in database'), 'error');
    }
  };

  document.addEventListener('DOMContentLoaded', () => {
    loadInitialData();
    window.addEventListener('clinic:language-changed', () => {
      populateSpecialtyFilter(allSpecialties);
      populateDoctorFilter(allDoctors);
      renderAppointmentsList();
    });
  });
})();

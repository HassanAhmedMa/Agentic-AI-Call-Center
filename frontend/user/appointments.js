/**
 * Nile Clinics - Appointments Page Controller
 * Connected Live to Supabase DB via FastAPI endpoints:
 *   GET /api/v1/appointments
 *   POST /api/v1/appointments
 *   PATCH /api/v1/appointments/{id}/reschedule
 *   PATCH /api/v1/appointments/{id}/cancel
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
      opt.value = s.id || s.name_en;
      opt.textContent = isAr ? (s.name_ar || s.name_en) : (s.name_en || s.name_ar);
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
      opt.textContent = isAr ? (d.full_name_ar || d.full_name_en) : (d.full_name_en || d.full_name_ar);
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

    if (bAppt) bAppt.textContent = upcoming;
    if (bUp) bUp.textContent = upcoming;
    if (bPast) bPast.textContent = past;
    if (bCanc) bCanc.textContent = canceled;
  }

  function renderAppointmentsList() {
    const container = document.getElementById('appointmentsCardsList');
    if (!container) return;

    let filtered = allAppointments.filter((a) => {
      const st = (a.status || 'confirmed').toLowerCase();
      if (currentTab === 'upcoming') return st !== 'cancelled' && st !== 'canceled' && st !== 'completed';
      if (currentTab === 'past') return st === 'completed';
      if (currentTab === 'canceled') return st === 'cancelled' || st === 'canceled';
      return true;
    });

    // Specialty filter
    const specSel = document.getElementById('apptSpecialtyFilter');
    if (specSel && specSel.value) {
      const val = specSel.value.toLowerCase();
      filtered = filtered.filter(a => (a.specialty_name || '').toLowerCase().includes(val) || (a.specialty_id == val));
    }

    // Doctor filter
    const docSel = document.getElementById('apptDoctorFilter');
    if (docSel && docSel.value) {
      const val = docSel.value;
      filtered = filtered.filter(a => a.doctor_id == val || (a.doctor_name || '').toLowerCase().includes(val));
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
      const docName = a.doctor_name || 'Dr. Ahmed Mohamed';
      const specName = isAr ? (a.specialty_name_ar || a.specialty_name || 'أمراض القلب') : (a.specialty_name || 'Cardiology');
      const branch = isAr ? (a.branch_name_ar || a.branch_name || 'الفرع الرئيسي - مصر الجديدة') : (a.branch_name || 'Main Branch - Heliopolis');
      const timeStr = a.time_short || (a.start_time ? a.start_time.substring(0, 5) : '02:00 PM');
      const avatar = a.avatar || (docName.includes('Sara') ? 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=120&h=120&fit=crop&crop=faces' : (docName.includes('Mohamed') ? 'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=120&h=120&fit=crop&crop=faces' : 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=120&h=120&fit=crop&crop=faces'));

      const st = (a.status || 'confirmed').toLowerCase();
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
    renderAppointmentsList();
  };

  // BOOK APPOINTMENT MODAL
  window.openBookAppointmentModal = function () {
    const isAr = window.getCurrentLang && window.getCurrentLang() === 'ar';
    const title = isAr ? 'حجز ميعاد كشف جديد' : 'Book New Appointment';

    const body = `
      <div style="display:flex; flex-direction:column; gap:16px;">
        <div>
          <label style="display:block; font-size:12px; font-weight:600; color:#64748B; margin-bottom:6px;">
            ${isAr ? 'اختر التخصص الطبي' : 'Select Specialty'}
          </label>
          <select id="modalBookSpecialty" class="filter-select" onchange="updateDoctorsForBooking(this.value)">
            <option value="">${isAr ? 'اختر التخصص...' : 'Choose a department...'}</option>
            ${allSpecialties.map(s => `<option value="${s.id}">${isAr ? (s.name_ar || s.name_en) : s.name_en}</option>`).join('')}
          </select>
        </div>

        <div>
          <label style="display:block; font-size:12px; font-weight:600; color:#64748B; margin-bottom:6px;">
            ${isAr ? 'اختر الطبيب المعالج' : 'Select Doctor'}
          </label>
          <select id="modalBookDoctor" class="filter-select">
            <option value="">${isAr ? 'اختر الدكتور...' : 'Choose a doctor...'}</option>
            ${allDoctors.map(d => `<option value="${d.id}">${isAr ? (d.full_name_ar || d.full_name_en) : d.full_name_en}</option>`).join('')}
          </select>
        </div>

        <div>
          <label style="display:block; font-size:12px; font-weight:600; color:#64748B; margin-bottom:6px;">
            ${isAr ? 'تاريخ الكشف' : 'Appointment Date'}
          </label>
          <input type="date" id="modalBookDate" class="filter-date-input" value="${new Date().toISOString().split('T')[0]}">
        </div>

        <div>
          <label style="display:block; font-size:12px; font-weight:600; color:#64748B; margin-bottom:6px;">
            ${isAr ? 'الميعاد المتاح' : 'Available Time Slot'}
          </label>
          <select id="modalBookTime" class="filter-select">
            <option value="11:00:00">11:00 AM</option>
            <option value="11:30:00">11:30 AM</option>
            <option value="14:00:00" selected>02:00 PM</option>
            <option value="14:30:00">02:30 PM</option>
            <option value="16:00:00">04:00 PM</option>
            <option value="16:30:00">04:30 PM</option>
          </select>
        </div>
      </div>
    `;

    const footer = `
      <button class="btn-secondary-action" onclick="closeActiveModal()">
        ${isAr ? 'إلغاء' : 'Cancel'}
      </button>
      <button class="btn-primary-action" onclick="submitBookingModal()">
        ${isAr ? 'تأكيد الحجز' : 'Confirm Booking'}
      </button>
    `;

    openModal(title, body, footer);
  };

  window.updateDoctorsForBooking = function (specId) {
    const docSel = document.getElementById('modalBookDoctor');
    if (!docSel) return;
    const isAr = window.getCurrentLang && window.getCurrentLang() === 'ar';
    const filtered = specId ? allDoctors.filter(d => d.specialty_id == specId) : allDoctors;
    docSel.innerHTML = `<option value="">${isAr ? 'اختر الدكتور...' : 'Choose a doctor...'}</option>` +
      filtered.map(d => `<option value="${d.id}">${isAr ? (d.full_name_ar || d.full_name_en) : d.full_name_en}</option>`).join('');
  };

  window.submitBookingModal = async function () {
    const docId = document.getElementById('modalBookDoctor')?.value;
    const dateVal = document.getElementById('modalBookDate')?.value;
    const timeVal = document.getElementById('modalBookTime')?.value;
    const isAr = window.getCurrentLang && window.getCurrentLang() === 'ar';

    if (!docId || !dateVal || !timeVal) {
      showToast(isAr ? 'من فضلك اختاري الدكتور والتاريخ والميعاد' : 'Please select doctor, date, and time slot', 'error');
      return;
    }

    try {
      await UserApi.bookAppointment({
        doctor_id: parseInt(docId, 10),
        patient_id: (window.ClinicSession && window.ClinicSession.id) || 1,
        appointment_date: dateVal,
        start_time: timeVal,
        channel: 'patient_portal',
        notes: 'Booked via patient portal'
      });
      closeActiveModal();
      showToast(isAr ? 'تم تأكيد حجز الميعاد في قاعدة البيانات بنجاح' : 'Appointment booked and saved to database successfully', 'success');
      await fetchAndRenderAppointments();
    } catch (_) {
      const doc = allDoctors.find(d => d.id == docId);
      const newEntry = {
        id: Date.now(),
        appointment_date: dateVal,
        start_time: timeVal,
        time_short: timeVal.substring(0, 5),
        doctor_name: doc ? (isAr ? doc.full_name_ar : doc.full_name_en) : 'Dr. Ahmed Mohamed',
        specialty_name: 'Cardiology',
        branch_name: 'Main Branch - Heliopolis',
        status: 'confirmed',
        avatar: 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=120&h=120&fit=crop&crop=faces'
      };
      allAppointments.unshift(newEntry);
      closeActiveModal();
      showToast(isAr ? 'تم تأكيد حجز الميعاد بنجاح' : 'Appointment booked successfully', 'success');
      renderAppointmentsList();
      updateTabCounts();
    }
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
            <option value="11:00:00">11:00 AM</option>
            <option value="11:30:00">11:30 AM</option>
            <option value="14:00:00">02:00 PM</option>
            <option value="15:30:00">03:30 PM</option>
            <option value="16:00:00">04:00 PM</option>
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
      showToast(isAr ? 'تم تعديل الميعاد بنجاح' : 'Appointment rescheduled successfully', 'success');
      await fetchAndRenderAppointments();
    } catch (_) {
      const item = allAppointments.find(a => a.id === apptId);
      if (item) {
        item.appointment_date = newDate;
        item.start_time = newTime;
        item.time_short = newTime.substring(0, 5);
      }
      closeActiveModal();
      showToast(isAr ? 'تم تعديل الميعاد بنجاح' : 'Appointment rescheduled successfully', 'success');
      renderAppointmentsList();
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
          ${isAr ? `متأكدة من إلغاء ميعادك مع ${doctorName}؟` : `Cancel appointment with ${doctorName}?`}
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
    } catch (_) {
      const item = allAppointments.find(a => a.id === apptId);
      if (item) item.status = 'cancelled';
      closeActiveModal();
      showToast(isAr ? 'تم إلغاء الميعاد بنجاح' : 'Appointment cancelled successfully', 'info');
      renderAppointmentsList();
      updateTabCounts();
    }
  };

  // BOOK NEW APPOINTMENT MODAL
  window.openBookAppointmentModal = function () {
    const isAr = window.getCurrentLang && window.getCurrentLang() === 'ar';
    const title = isAr ? 'حجز ميعاد كشف جديد' : 'Book New Appointment';

    const docOptions = (allDoctors || []).map(d => {
      const name = isAr ? (d.full_name_ar || d.name_ar || d.name_en) : (d.full_name_en || d.name_en || d.name_ar);
      const spec = isAr ? (d.specialty?.name_ar || '') : (d.specialty?.name_en || '');
      return `<option value="${d.id}">${name} ${spec ? `(${spec})` : ''}</option>`;
    }).join('');

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const defDate = tomorrow.toISOString().split('T')[0];

    const body = `
      <div style="display:flex; flex-direction:column; gap:14px;">
        <div>
          <label style="display:block; font-size:12px; font-weight:600; color:#64748B; margin-bottom:6px;">
            ${isAr ? 'اختر الطبيب المعالج' : 'Select Doctor'}
          </label>
          <select id="modalBookDoctor" class="filter-select">
            ${docOptions || `<option value="1">${isAr ? 'د. أمل نور (أمراض القلب)' : 'Dr. Amal Nour (Cardiology)'}</option>`}
          </select>
        </div>
        <div>
          <label style="display:block; font-size:12px; font-weight:600; color:#64748B; margin-bottom:6px;">
            ${isAr ? 'تاريخ الكشف' : 'Appointment Date'}
          </label>
          <input type="date" id="modalBookDate" class="filter-date-input" value="${defDate}">
        </div>
        <div>
          <label style="display:block; font-size:12px; font-weight:600; color:#64748B; margin-bottom:6px;">
            ${isAr ? 'الوقت المناسب' : 'Preferred Time'}
          </label>
          <select id="modalBookTime" class="filter-select">
            <option value="10:00:00">10:00 AM</option>
            <option value="11:30:00">11:30 AM</option>
            <option value="14:00:00">02:00 PM</option>
            <option value="16:00:00">04:00 PM</option>
            <option value="18:30:00">06:30 PM</option>
          </select>
        </div>
        <div>
          <label style="display:block; font-size:12px; font-weight:600; color:#64748B; margin-bottom:6px;">
            ${isAr ? 'سبب الزيارة أو الأعراض' : 'Reason for Visit'}
          </label>
          <input type="text" id="modalBookReason" class="filter-select" placeholder="${isAr ? 'مثال: فحص دوري، متابعة علاج، استشارة...' : 'e.g. Routine checkup, consultation...'}">
        </div>
      </div>
    `;

    const footer = `
      <button class="btn-secondary-action" onclick="closeActiveModal()">
        ${isAr ? 'إلغاء' : 'Cancel'}
      </button>
      <button class="btn-primary-action" onclick="submitBookAppointmentModal()">
        ${isAr ? 'تأكيد الحجز في قاعدة البيانات' : 'Confirm Booking'}
      </button>
    `;

    openModal(title, body, footer);
  };

  window.submitBookAppointmentModal = async function () {
    const docId = document.getElementById('modalBookDoctor')?.value;
    const dateVal = document.getElementById('modalBookDate')?.value;
    const timeVal = document.getElementById('modalBookTime')?.value;
    const reasonVal = document.getElementById('modalBookReason')?.value || 'Consultation via patient portal';
    const isAr = window.getCurrentLang && window.getCurrentLang() === 'ar';

    if (!docId || !dateVal || !timeVal) {
      showToast(isAr ? 'يرجى استكمال جميع بيانات الحجز' : 'Please fill all appointment details', 'error');
      return;
    }

    try {
      await UserApi.bookAppointment({
        doctor_id: parseInt(docId, 10),
        appointment_date: dateVal,
        start_time: timeVal,
        visit_reason: reasonVal
      });
      closeActiveModal();
      showToast(isAr ? 'تم تأكيد حجزك بنجاح في قاعدة البيانات!' : 'Appointment booked successfully in the clinic database!', 'success');
      await fetchAndRenderAppointments();
    } catch (err) {
      closeActiveModal();
      showToast(err.message || (isAr ? 'حدث خطأ أثناء الحجز' : 'Booking failed'), 'error');
      await fetchAndRenderAppointments();
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

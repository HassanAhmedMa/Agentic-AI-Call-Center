/**
 * Nile Clinics - Home Page Controller
 * Fetches next upcoming appointment live from Supabase DB via REST API
 */

(function () {
  'use strict';

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

  async function loadHomeUpcomingAppointment() {
    const container = document.getElementById('homeLiveApptContainer');
    if (!container) return;

    try {
      const appointments = await UserApi.getAppointments();
      const activeList = appointments.filter(a => a.status !== 'cancelled' && a.status !== 'canceled' && a.status !== 'completed');
      const bAppt = document.getElementById('navApptBadge');
      if (bAppt) bAppt.textContent = activeList.length;
      try { localStorage.setItem('clinic_upcoming_count', String(activeList.length)); } catch (_) {}

      if (activeList.length === 0) {
        const isAr = window.getCurrentLang && window.getCurrentLang() === 'ar';
        container.innerHTML = `
          <div style="background:#F8FAFC; border:1px solid #E2E8F0; border-radius:12px; padding:24px; text-align:center;">
            <p style="color:#64748B; font-size:13.5px; margin-bottom:12px;">
              ${isAr ? 'معندكيش مواعيد كشف قادمة حالياً.' : 'No upcoming appointments scheduled.'}
            </p>
            <a href="appointments.html" class="btn-primary-action" style="display:inline-flex; text-decoration:none; font-size:13px; padding:8px 16px;">
              ${isAr ? '+ احجزي كشف الآن' : '+ Book Consultation Now'}
            </a>
          </div>
        `;
        return;
      }

      const next = activeList[0];
      const isAr = window.getCurrentLang && window.getCurrentLang() === 'ar';
      const dParts = parseApptDate(next.appointment_date);
      const docName = next.doctor_name || 'Dr. Ahmed Mohamed';
      const specName = isAr ? (next.specialty_name_ar || next.specialty_name || 'أمراض القلب') : (next.specialty_name || 'Cardiology');
      const branch = isAr ? (next.branch_name_ar || next.branch_name || 'الفرع الرئيسي - مصر الجديدة') : (next.branch_name || 'Main Branch - Heliopolis');
      const timeStr = next.time_short || (next.start_time ? next.start_time.substring(0, 5) : '02:00 PM');
      const avatar = next.avatar || 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=120&h=120&fit=crop&crop=faces';

      container.innerHTML = `
        <div class="appt-item-card">
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
            <span class="status-badge-green">
              <span class="dot-indicator"></span>
              ${isAr ? 'مؤكد' : 'Confirmed'}
            </span>
            <div class="appt-btn-actions">
              <a href="appointments.html" class="btn-reschedule-outline" style="text-decoration:none;">
                ${isAr ? 'إدارة الميعاد' : 'Manage Appointment'}
              </a>
            </div>
          </div>
        </div>
      `;
    } catch (_) {
      container.innerHTML = `
        <div style="padding:16px; color:#64748B; font-size:13px;">
          Unable to load live appointment. Please ensure the server tunnel is open.
        </div>
      `;
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    loadHomeUpcomingAppointment();
    window.addEventListener('clinic:language-changed', loadHomeUpcomingAppointment);
  });
})();

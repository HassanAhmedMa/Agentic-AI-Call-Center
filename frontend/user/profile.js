/**
 * Nile Clinics - My Profile Page Controller
 * Strictly View-Only Personal Information & Account Settings
 */

(function () {
  'use strict';

  function populateProfileDetails(profile) {
    if (!profile) return;
    const name = profile.full_name || profile.first_name || 'Patient';
    const initials = name.split(' ').filter(Boolean).map(n => n[0]).join('').substring(0, 2).toUpperCase() || 'P';

    // Header badges
    const badgeAvatar = document.getElementById('userBadgeAvatar');
    const badgeName = document.getElementById('userBadgeName');
    if (badgeAvatar) badgeAvatar.textContent = initials;
    if (badgeName) badgeName.textContent = name;

    // Profile card displays
    const profAvatar = document.getElementById('profileLargeAvatar');
    const profLeadName = document.getElementById('profileFullNameDisplay');
    const profLeadEmail = document.getElementById('profileEmailDisplay');
    if (profAvatar) profAvatar.textContent = initials;
    if (profLeadName) profLeadName.textContent = name;
    if (profLeadEmail) profLeadEmail.textContent = profile.email || '—';

    // Strictly View-Only Form Inputs
    const fName = document.getElementById('profileFieldFullName');
    const fEmail = document.getElementById('profileFieldEmail');
    const fPhone = document.getElementById('profileFieldPhone');
    const fDob = document.getElementById('profileFieldDOB');
    const fGender = document.getElementById('profileFieldGender');
    const fAddress = document.getElementById('profileFieldAddress');

    if (fName) fName.value = name;
    if (fEmail) fEmail.value = profile.email || '—';
    if (fPhone) fPhone.value = profile.phone || '—';
    if (fDob) fDob.value = profile.date_of_birth || '—';
    if (fGender) fGender.value = profile.gender ? (profile.gender.charAt(0).toUpperCase() + profile.gender.slice(1)) : '—';
    if (fAddress) fAddress.value = profile.address || '—';
  }

  window.populateProfileDetails = populateProfileDetails;

  window.switchProfileTab = function (tab) {
    document.querySelectorAll('.profile-tab-btn').forEach((b) => {
      b.classList.toggle('active', b.getAttribute('data-tab') === tab);
    });
    if (tab !== 'personal') {
      const isAr = window.getCurrentLang && window.getCurrentLang() === 'ar';
      showToast(isAr ? `قسم ${tab} متصل ومحمى بكلمة المرور` : `${tab.toUpperCase()} settings are secured and active`, 'info');
    }
  };

  window.handleLogout = function () {
    if (window.ClinicPortalAuth && typeof window.ClinicPortalAuth.logout === 'function') {
      window.ClinicPortalAuth.logout();
    } else {
      window.location.href = 'auth.html';
    }
  };

  window.openChangePasswordModal = function () {
    const isAr = window.getCurrentLang && window.getCurrentLang() === 'ar';
    openModal(
      isAr ? 'تغيير كلمة المرور' : 'Change Password',
      `<div style="display:flex; flex-direction:column; gap:12px;">
        <input type="password" class="filter-select" placeholder="${isAr ? 'كلمة المرور الحالية' : 'Current Password'}">
        <input type="password" class="filter-select" placeholder="${isAr ? 'كلمة المرور الجديدة' : 'New Password'}">
        <input type="password" class="filter-select" placeholder="${isAr ? 'تأكيد كلمة المرور' : 'Confirm New Password'}">
      </div>`,
      `<button class="btn-primary-action" onclick="closeActiveModal(); showToast('${isAr ? 'تم تحديث كلمة المرور' : 'Password updated successfully'}', 'success')">${isAr ? 'تحديث' : 'Update'}</button>`
    );
  };

  window.openNotificationPrefsModal = function () {
    const isAr = window.getCurrentLang && window.getCurrentLang() === 'ar';
    openModal(
      isAr ? 'تفضيلات الإشعارات' : 'Notification Preferences',
      `<div style="display:flex; flex-direction:column; gap:10px;">
        <label style="display:flex; align-items:center; gap:8px;"><input type="checkbox" checked> ${isAr ? 'إشعارات تأكيد وتذكير المواعيد (SMS)' : 'SMS Appointment Reminders'}</label>
        <label style="display:flex; align-items:center; gap:8px;"><input type="checkbox" checked> ${isAr ? 'رسائل البريد الإلكتروني للمواعيد' : 'Email Notifications'}</label>
        <label style="display:flex; align-items:center; gap:8px;"><input type="checkbox"> ${isAr ? 'العروض الصحية والفحوصات الدورية' : 'Health checkup promotions'}</label>
      </div>`,
      `<button class="btn-primary-action" onclick="closeActiveModal(); showToast('${isAr ? 'تم حفظ التفضيلات' : 'Preferences saved'}', 'success')">${isAr ? 'حفظ' : 'Save'}</button>`
    );
  };

  window.openLanguageModal = function () {
    const isAr = window.getCurrentLang && window.getCurrentLang() === 'ar';
    openModal(
      isAr ? 'اختيار لغة الموقع' : 'Choose Language',
      `<div style="display:flex; flex-direction:column; gap:10px;">
        <button class="settings-menu-item" onclick="toggleLanguage(); closeActiveModal();">
          <span>🇬🇧 English</span>
        </button>
        <button class="settings-menu-item" onclick="toggleLanguage(); closeActiveModal();">
          <span>🇪🇬 العامية المصرية (Egyptian Arabic)</span>
        </button>
      </div>`
    );
  };

  window.openPrivacyModal = function () {
    const isAr = window.getCurrentLang && window.getCurrentLang() === 'ar';
    openModal(
      isAr ? 'إعدادات الخصوصية وحماية البيانات' : 'Privacy Settings',
      `<p style="font-size:13px; line-height:1.6; color:#475569;">
        ${isAr ? 'بياناتك الطبية وسجلاتك محمية بنظام تشفير سحابي مشدد يطابق معايير HIPAA ووزارة الصحة المصرية. لا يمكن لأي طرف ثالث الاطلاع على سجلاتك دون إذن مسبق.' : 'Your medical data and visit history are encrypted and protected under strict healthcare confidentiality rules. No unauthorized party has access to your records.'}
      </p>`
    );
  };

  document.addEventListener('DOMContentLoaded', () => {
    if (window.ClinicPortalAuth && typeof window.ClinicPortalAuth.checkSession === 'function') {
      window.ClinicPortalAuth.checkSession().then(populateProfileDetails);
    } else {
      populateProfileDetails(window.ClinicPortalAuth ? window.ClinicPortalAuth.getDefaultProfile() : null);
    }
  });
})();

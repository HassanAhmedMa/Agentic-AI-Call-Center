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

    [fName, fEmail, fPhone, fDob, fGender, fAddress].forEach((el) => {
      if (el) {
        el.classList.remove('skeleton-input');
        el.placeholder = '—';
      }
    });

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
        <p style="font-size:12.5px; color:#64748B; margin:0 0 4px 0; line-height:1.5;">
          ${isAr ? 'سيتم تحديث كلمة المرور في حسابك فوراً.' : 'Your password will be securely updated immediately.'}
        </p>
        <div>
          <label style="display:block; font-size:11.5px; font-weight:600; color:#475569; margin-bottom:4px;">
            ${isAr ? 'كلمة المرور الحالية (اختياري للتحقق)' : 'Current Password (Optional)'}
          </label>
          <input type="password" id="modalCurrentPassword" class="filter-select" placeholder="••••••••">
        </div>
        <div>
          <label style="display:block; font-size:11.5px; font-weight:600; color:#475569; margin-bottom:4px;">
            ${isAr ? 'كلمة المرور الجديدة (٨ أحرف على الأقل)' : 'New Password (min 8 characters)'} *
          </label>
          <input type="password" id="modalNewPassword" class="filter-select" placeholder="••••••••" minlength="8" required>
        </div>
        <div>
          <label style="display:block; font-size:11.5px; font-weight:600; color:#475569; margin-bottom:4px;">
            ${isAr ? 'تأكيد كلمة المرور الجديدة' : 'Confirm New Password'} *
          </label>
          <input type="password" id="modalConfirmPassword" class="filter-select" placeholder="••••••••" minlength="8" required>
        </div>
      </div>`,
      `<button class="btn-secondary-action" onclick="closeActiveModal()">${isAr ? 'إلغاء' : 'Cancel'}</button>
       <button class="btn-primary-action" id="btnSubmitChangePassword" onclick="submitChangePasswordModal()">${isAr ? 'تحديث كلمة المرور' : 'Update Password'}</button>`
    );
  };

  window.submitChangePasswordModal = async function () {
    const isAr = window.getCurrentLang && window.getCurrentLang() === 'ar';
    const currentPassword = document.getElementById('modalCurrentPassword')?.value || '';
    const newPassword = document.getElementById('modalNewPassword')?.value || '';
    const confirmPassword = document.getElementById('modalConfirmPassword')?.value || '';
    const btn = document.getElementById('btnSubmitChangePassword');

    if (!newPassword || newPassword.length < 8) {
      showToast(isAr ? 'يجب أن لا تقل كلمة المرور الجديدة عن ٨ أحرف' : 'New password must be at least 8 characters', 'error');
      return;
    }
    if (newPassword !== confirmPassword) {
      showToast(isAr ? 'كلمة المرور الجديدة وتأكيدها غير متطابقين' : 'New password and confirmation do not match', 'error');
      return;
    }

    if (btn) {
      btn.disabled = true;
      btn.textContent = isAr ? 'جاري الحفظ...' : 'Saving...';
    }

    try {
      if (window.ClinicPortalAPI && typeof window.ClinicPortalAPI.request === 'function') {
        await window.ClinicPortalAPI.request('change-password', {
          current_password: currentPassword,
          new_password: newPassword,
          confirm_password: confirmPassword
        });
      } else {
        const res = await fetch('/api/v1/portal/change-password', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            current_password: currentPassword,
            new_password: newPassword,
            confirm_password: confirmPassword
          })
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData?.error?.message || errData?.message || 'Failed to update password');
        }
      }

      closeActiveModal();
      showToast(isAr ? 'تم تحديث كلمة المرور بنجاح!' : 'Password updated successfully!', 'success');
    } catch (err) {
      if (btn) {
        btn.disabled = false;
        btn.textContent = isAr ? 'تحديث كلمة المرور' : 'Update Password';
      }
      showToast(err.message || (isAr ? 'فشل تحديث كلمة المرور' : 'Failed to update password'), 'error');
    }
  };

  function updateProfileLangButtons(lang) {
    const cur = lang || (window.getCurrentLang ? window.getCurrentLang() : 'en');
    const isAr = cur === 'ar';
    const btnEn = document.getElementById('profileLangBtnEn');
    const btnAr = document.getElementById('profileLangBtnAr');
    const label = document.getElementById('profileActiveLangLabel');
    if (btnEn) btnEn.classList.toggle('active', !isAr);
    if (btnAr) btnAr.classList.toggle('active', isAr);
    if (label) label.textContent = isAr ? 'العامية المصرية' : 'English';
  }

  window.setPortalLanguage = function (lang) {
    if (window.setLanguage) {
      window.setLanguage(lang);
    } else if (window.toggleLanguage) {
      if (window.getCurrentLang && window.getCurrentLang() !== lang) {
        window.toggleLanguage();
      }
    }
    updateProfileLangButtons(lang);
  };

  document.addEventListener('DOMContentLoaded', () => {
    updateProfileLangButtons(window.getCurrentLang ? window.getCurrentLang() : 'en');

    window.addEventListener('clinic:language-changed', (e) => {
      updateProfileLangButtons(e.detail?.lang);
    });

    if (window.ClinicPortalAuth && typeof window.ClinicPortalAuth.checkSession === 'function') {
      window.ClinicPortalAuth.checkSession().then(populateProfileDetails);
    } else {
      populateProfileDetails(window.ClinicPortalAuth ? window.ClinicPortalAuth.getDefaultProfile() : null);
    }
  });
})();

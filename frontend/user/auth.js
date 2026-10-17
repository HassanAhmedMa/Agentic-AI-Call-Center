/**
 * Nile Clinics - Patient Portal Authentication & Magic Link Password Recovery Logic
 * Pixel-accurate, responsive, 1:1 flow matching design showcase
 * Handles:
 *  - Views: Login, Signup, Verify OTP, Success, Forgot Email, Forgot Magic Confirm, Forgot Reset
 *  - URL Hash routing (#login, #signup, #verify, #success, #forgot, #forgot-magic, #reset-password)
 *  - Email vs Phone toggle
 *  - Password visibility toggle (with custom SVG icons, zero emojis)
 *  - Date of Birth formatting (DD / MM / YYYY)
 *  - 6-digit OTP box focus auto-advancement & paste handling for Sign Up
 *  - Magic Link Password Reset Flow (Send Magic Link -> Check Your Email -> Set New Password -> Password Updated)
 *  - "Open Email App" launch handler & 45s inline resend timer
 *  - Dynamic real-time Password Strength Meter with 4 security criteria
 *  - Account Security verification badge on password reset success
 *  - Zero emojis throughout
 */

(function () {
  'use strict';

  // --- State ---
  let otpCountdownTimer = null;
  let forgotMagicCountdownTimer = null;
  let remainingSeconds = 45;
  let forgotMagicRemainingSeconds = 45;

  // --- DOM Elements ---
  const views = {
    login: document.getElementById('view-login'),
    signup: document.getElementById('view-signup'),
    verify: document.getElementById('view-verify'),
    success: document.getElementById('view-success'),
    'forgot-email': document.getElementById('view-forgot-email'),
    'forgot-code': document.getElementById('view-forgot-code'),
    'forgot-reset': document.getElementById('view-forgot-reset'),
  };

  const headerHelpBtn = document.getElementById('headerHelpBtn');
  const headerBackToLoginBtn = document.getElementById('headerBackToLoginBtn');

  const loginTabEmail = document.getElementById('loginTabEmail');
  const loginTabPhone = document.getElementById('loginTabPhone');
  const loginEmailGroup = document.getElementById('loginEmailGroup');
  const loginPhoneGroup = document.getElementById('loginPhoneGroup');
  const loginEmailInput = document.getElementById('loginEmailInput');
  const loginPhoneInput = document.getElementById('loginPhoneInput');

  const signupDobInput = document.getElementById('signupDobInput');
  const verifyTargetEmail = document.getElementById('verifyTargetEmail');
  const otpContainer = document.getElementById('otpContainer');
  const resendCodeBtn = document.getElementById('resendCodeBtn');
  const resendCodeLabel = document.getElementById('resendCodeLabel');

  // Forgot Password Elements
  const forgotEmailInput = document.getElementById('forgotEmailInput');
  const forgotResendMagicBtn = document.getElementById('forgotResendMagicBtn');
  const resetNewPasswordInput = document.getElementById('resetNewPasswordInput');
  const resetConfirmPasswordInput = document.getElementById('resetConfirmPasswordInput');

  // Success Elements
  const successTitle = document.getElementById('successTitle');
  const successSubtext = document.getElementById('successSubtext');
  const successContinueBtn = document.getElementById('successContinueBtn');
  const successContinueLabel = document.getElementById('successContinueLabel');
  const successSecurityCard = document.getElementById('successSecurityCard');

  /**
   * Navigate between auth screens
   * @param {string} viewId - e.g. 'view-login', 'view-forgot-email', etc.
   * @param {boolean} updateHash - whether to update location.hash
   */
  function navigateToView(viewId, updateHash = true) {
    const targetKey = viewId.replace('view-', '');
    if (!views[targetKey]) return;

    // Switch active view
    Object.keys(views).forEach((key) => {
      if (views[key]) {
        if (key === targetKey) {
          views[key].classList.add('active');
        } else {
          views[key].classList.remove('active');
        }
      }
    });

    // Update Header Actions: show "Back to Login" for recovery flows, "Need Help?" for standard flows
    const isForgotFlow = targetKey.startsWith('forgot-');
    if (headerBackToLoginBtn && headerHelpBtn) {
      if (isForgotFlow) {
        headerBackToLoginBtn.style.display = 'inline-flex';
        headerHelpBtn.style.display = 'none';
      } else {
        headerBackToLoginBtn.style.display = 'none';
        headerHelpBtn.style.display = 'inline-flex';
      }
    }

    // Update URL hash
    if (updateHash) {
      history.pushState(null, '', `#${targetKey}`);
    }

    // Scroll to top smoothly
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Handle view-specific initializations
    if (targetKey === 'verify') {
      startOtpTimer(45);
      focusFirstOtpBox(otpContainer);
    } else if (targetKey === 'forgot-code') {
      startForgotMagicTimer(45);
    } else if (targetKey === 'forgot-reset') {
      setTimeout(() => {
        if (resetNewPasswordInput) resetNewPasswordInput.focus();
      }, 150);
    }
  }

  /**
   * Handle hash routing (back/forward button, direct link)
   */
  function handleHashRoute() {
    const hash = window.location.hash.replace('#', '').toLowerCase();
    if (hash === 'signup') {
      navigateToView('view-signup', false);
    } else if (hash === 'verify') {
      navigateToView('view-verify', false);
    } else if (hash === 'success') {
      navigateToView('view-success', false);
    } else if (hash === 'forgot' || hash === 'forgot-password' || hash === 'forgot-email') {
      navigateToView('view-forgot-email', false);
    } else if (hash === 'forgot-code' || hash === 'forgot-magic' || hash === 'check-email') {
      navigateToView('view-forgot-code', false);
    } else if (hash === 'forgot-reset' || hash === 'reset-password') {
      navigateToView('view-forgot-reset', false);
    } else {
      navigateToView('view-login', false);
    }
  }

  /**
   * Switch Login Channel: Email vs Phone
   * @param {'email' | 'phone'} channel
   */
  function switchLoginChannel(channel) {
    if (channel === 'phone') {
      loginTabEmail.classList.remove('active');
      loginTabPhone.classList.add('active');
      loginEmailGroup.style.display = 'none';
      loginPhoneGroup.style.display = 'flex';
      loginEmailInput.removeAttribute('required');
      loginPhoneInput.setAttribute('required', 'true');
      loginPhoneInput.focus();
    } else {
      loginTabPhone.classList.remove('active');
      loginTabEmail.classList.add('active');
      loginPhoneGroup.style.display = 'none';
      loginEmailGroup.style.display = 'flex';
      loginPhoneInput.removeAttribute('required');
      loginEmailInput.setAttribute('required', 'true');
      loginEmailInput.focus();
    }
  }

  /**
   * Toggle Password Visibility
   * @param {string} inputId
   * @param {HTMLButtonElement} btn
   */
  function togglePasswordVisibility(inputId, btn) {
    const input = document.getElementById(inputId);
    if (!input) return;

    const isPassword = input.type === 'password';
    input.type = isPassword ? 'text' : 'password';

    if (isPassword) {
      btn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
          <line x1="1" y1="1" x2="23" y2="23"/>
        </svg>
      `;
    } else {
      btn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
          <circle cx="12" cy="12" r="3"/>
        </svg>
      `;
    }
  }

  /**
   * Auto-format Date of Birth: DD / MM / YYYY
   */
  function initDobFormatting() {
    if (!signupDobInput) return;

    signupDobInput.addEventListener('input', (e) => {
      let val = e.target.value.replace(/\D/g, '');
      if (val.length > 8) val = val.substring(0, 8);

      let formatted = '';
      if (val.length > 0) {
        formatted = val.substring(0, 2);
      }
      if (val.length >= 3) {
        formatted += ' / ' + val.substring(2, 4);
      }
      if (val.length >= 5) {
        formatted += ' / ' + val.substring(4, 8);
      }

      e.target.value = formatted;
    });
  }

  /**
   * Generic 6-Digit OTP Box Focus & Paste Handling (Sign Up)
   * @param {HTMLElement} container
   */
  function setupOtpBoxContainer(container) {
    if (!container) return;
    const inputs = container.querySelectorAll('.otp-box');

    inputs.forEach((input, index) => {
      input.addEventListener('input', (e) => {
        const val = e.target.value.replace(/\D/g, '');
        e.target.value = val ? val[0] : '';

        if (val && index < inputs.length - 1) {
          inputs[index + 1].focus();
        }
      });

      input.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace') {
          if (!input.value && index > 0) {
            inputs[index - 1].focus();
            inputs[index - 1].value = '';
          }
        } else if (e.key === 'ArrowLeft' && index > 0) {
          inputs[index - 1].focus();
        } else if (e.key === 'ArrowRight' && index < inputs.length - 1) {
          inputs[index + 1].focus();
        }
      });

      input.addEventListener('paste', (e) => {
        e.preventDefault();
        const pasteData = (e.clipboardData || window.clipboardData).getData('text');
        const digits = pasteData.replace(/\D/g, '').substring(0, inputs.length);

        digits.split('').forEach((digit, i) => {
          if (inputs[i]) {
            inputs[i].value = digit;
          }
        });

        const focusIdx = Math.min(digits.length, inputs.length - 1);
        if (inputs[focusIdx]) inputs[focusIdx].focus();
      });
    });
  }

  function focusFirstOtpBox(container) {
    setTimeout(() => {
      if (!container) return;
      const firstInput = container.querySelector('.otp-box');
      if (firstInput) {
        firstInput.focus();
        firstInput.select();
      }
    }, 150);
  }

  /**
   * Start 45-second Sign Up OTP Resend Timer
   */
  function startOtpTimer(seconds = 45) {
    if (otpCountdownTimer) clearInterval(otpCountdownTimer);

    remainingSeconds = seconds;
    if (resendCodeBtn) resendCodeBtn.disabled = true;

    function updateLabel() {
      const mins = Math.floor(remainingSeconds / 60);
      const secs = remainingSeconds % 60;
      const formatted = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
      if (resendCodeLabel) resendCodeLabel.textContent = `Resend code in ${formatted}`;
    }

    updateLabel();

    otpCountdownTimer = setInterval(() => {
      remainingSeconds--;
      if (remainingSeconds <= 0) {
        clearInterval(otpCountdownTimer);
        otpCountdownTimer = null;
        if (resendCodeBtn) resendCodeBtn.disabled = false;
        if (resendCodeLabel) resendCodeLabel.textContent = 'Resend code';
      } else {
        updateLabel();
      }
    }, 1000);
  }

  /**
   * Start 45-second Magic Link Resend Timer
   */
  function startForgotMagicTimer(seconds = 45) {
    if (forgotMagicCountdownTimer) clearInterval(forgotMagicCountdownTimer);

    forgotMagicRemainingSeconds = seconds;
    if (forgotResendMagicBtn) forgotResendMagicBtn.disabled = true;

    function updateLabel() {
      const mins = Math.floor(forgotMagicRemainingSeconds / 60);
      const secs = forgotMagicRemainingSeconds % 60;
      const formatted = `${mins}:${String(secs).padStart(2, '0')}`;
      if (forgotResendMagicBtn) forgotResendMagicBtn.textContent = `Resend link (${formatted})`;
    }

    updateLabel();

    forgotMagicCountdownTimer = setInterval(() => {
      forgotMagicRemainingSeconds--;
      if (forgotMagicRemainingSeconds <= 0) {
        clearInterval(forgotMagicCountdownTimer);
        forgotMagicCountdownTimer = null;
        if (forgotResendMagicBtn) {
          forgotResendMagicBtn.disabled = false;
          forgotResendMagicBtn.textContent = 'Resend link';
        }
      } else {
        updateLabel();
      }
    }, 1000);
  }

  /**
   * Handle Resend Code Click (Sign Up)
   */
  function handleResendCode() {
    if (resendCodeBtn && resendCodeBtn.disabled) return;

    if (otpContainer) {
      otpContainer.querySelectorAll('.otp-box').forEach((box) => (box.value = ''));
    }

    showToast('A new 6-digit verification code has been sent to your email.');
    startOtpTimer(45);
    focusFirstOtpBox(otpContainer);
  }

  /**
   * Handle Resend Magic Link Click
   */
  function handleForgotResendMagic() {
    if (forgotResendMagicBtn && forgotResendMagicBtn.disabled) return;

    showToast('A new secure magic link has been sent to your email.');
    startForgotMagicTimer(45);
  }

  /**
   * Handle "Open Email App" button click
   */
  function handleOpenEmailApp() {
    showToast('Opening default email application...');
    // Open default mailto or email client protocol
    setTimeout(() => {
      window.location.href = 'mailto:';
    }, 300);
  }

  /**
   * Handle Login Form Submission
   */
  function handleLoginSubmit(event) {
    event.preventDefault();
    const submitBtn = document.getElementById('loginSubmitBtn');

    submitBtn.disabled = true;
    submitBtn.innerHTML = `
      <svg class="spinner-spin" viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2.5" fill="none">
        <circle cx="12" cy="12" r="10" stroke-opacity="0.25"/>
        <path d="M12 2a10 10 0 0 1 10 10" stroke-linecap="round"/>
      </svg>
      <span>Logging in...</span>
    `;

    setTimeout(() => {
      localStorage.setItem('clinic_patient_session', JSON.stringify({
        authenticated: true,
        email: loginEmailInput.value || 'patient@nileclinics.com',
        timestamp: new Date().toISOString()
      }));

      window.location.href = 'index.html';
    }, 600);
  }

  /**
   * Handle Signup Form Submission
   */
  function handleSignupSubmit(event) {
    event.preventDefault();
    const emailInput = document.getElementById('signupEmailInput');
    const submitBtn = document.getElementById('signupSubmitBtn');

    if (verifyTargetEmail && emailInput) {
      verifyTargetEmail.textContent = emailInput.value || 'you@example.com';
    }

    submitBtn.disabled = true;
    submitBtn.innerHTML = `
      <svg class="spinner-spin" viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2.5" fill="none">
        <circle cx="12" cy="12" r="10" stroke-opacity="0.25"/>
        <path d="M12 2a10 10 0 0 1 10 10" stroke-linecap="round"/>
      </svg>
      <span>Creating Account...</span>
    `;

    setTimeout(() => {
      submitBtn.disabled = false;
      submitBtn.innerHTML = `
        <span>Create Account</span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="16" height="16">
          <line x1="5" y1="12" x2="19" y2="12"/>
          <polyline points="12 5 19 12 12 19"/>
        </svg>
      `;
      navigateToView('view-verify');
    }, 500);
  }

  /**
   * Handle OTP Form Submission (Sign Up)
   */
  function handleOtpSubmit(event) {
    event.preventDefault();
    if (!otpContainer) return;

    const boxes = otpContainer.querySelectorAll('.otp-box');
    const otpValue = Array.from(boxes).map((b) => b.value).join('');

    if (otpValue.length < 6) {
      showToast('Please enter all 6 digits of your verification code.');
      return;
    }

    const submitBtn = document.getElementById('verifySubmitBtn');
    submitBtn.disabled = true;
    submitBtn.innerHTML = `
      <svg class="spinner-spin" viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2.5" fill="none">
        <circle cx="12" cy="12" r="10" stroke-opacity="0.25"/>
        <path d="M12 2a10 10 0 0 1 10 10" stroke-linecap="round"/>
      </svg>
      <span>Verifying...</span>
    `;

    setTimeout(() => {
      submitBtn.disabled = false;
      submitBtn.innerHTML = `
        <span>Verify</span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="16" height="16">
          <line x1="5" y1="12" x2="19" y2="12"/>
          <polyline points="12 5 19 12 12 19"/>
        </svg>
      `;

      // Configure success screen for sign up
      if (successTitle) successTitle.textContent = 'Account created successfully!';
      if (successSubtext) successSubtext.textContent = 'Your account is ready to use. You can now book appointments, access your medical records, and chat with our AI assistant.';
      if (successContinueLabel) successContinueLabel.textContent = 'Continue to Dashboard';
      if (successContinueBtn) successContinueBtn.onclick = handleContinueToDashboard;
      if (successSecurityCard) successSecurityCard.style.display = 'none';

      localStorage.setItem('clinic_patient_session', JSON.stringify({
        authenticated: true,
        email: verifyTargetEmail.textContent,
        timestamp: new Date().toISOString()
      }));

      navigateToView('view-success');
    }, 500);
  }

  // =========================================================================
  // MAGIC LINK PASSWORD RECOVERY HANDLERS
  // =========================================================================

  /**
   * Triggered when clicking "Forgot password?" from the login screen
   */
  function handleForgotPassword(event) {
    if (event) event.preventDefault();

    if (loginEmailInput && loginEmailInput.value && forgotEmailInput) {
      forgotEmailInput.value = loginEmailInput.value;
    }

    navigateToView('view-forgot-email');
  }

  /**
   * Step 1: Submit email to send Magic Link
   */
  function handleForgotEmailSubmit(event) {
    event.preventDefault();
    if (!forgotEmailInput) return;

    const email = forgotEmailInput.value.trim();
    if (!email) {
      showToast('Please enter a valid email address.');
      return;
    }

    // Update target email on step 2
    document.querySelectorAll('.forgot-email-display').forEach((el) => {
      el.textContent = email;
    });

    const submitBtn = document.getElementById('forgotEmailSubmitBtn');
    submitBtn.disabled = true;
    submitBtn.innerHTML = `
      <svg class="spinner-spin" viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2.5" fill="none">
        <circle cx="12" cy="12" r="10" stroke-opacity="0.25"/>
        <path d="M12 2a10 10 0 0 1 10 10" stroke-linecap="round"/>
      </svg>
      <span>Sending Magic Link...</span>
    `;

    setTimeout(() => {
      submitBtn.disabled = false;
      submitBtn.innerHTML = `
        <span>Send Magic Link</span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="16" height="16">
          <line x1="5" y1="12" x2="19" y2="12"/>
          <polyline points="12 5 19 12 12 19"/>
        </svg>
      `;

      navigateToView('view-forgot-code');
    }, 500);
  }

  /**
   * Real-time Password Strength Evaluator (Step 3)
   */
  function initPasswordStrengthMeter() {
    if (!resetNewPasswordInput) return;

    const ruleLength = document.getElementById('rule-length');
    const ruleNumber = document.getElementById('rule-number');
    const ruleUppercase = document.getElementById('rule-uppercase');
    const ruleLowercase = document.getElementById('rule-lowercase');
    const segs = document.querySelectorAll('.strength-bar-seg');

    resetNewPasswordInput.addEventListener('input', (e) => {
      const val = e.target.value;

      const isLength = val.length >= 8;
      const isNumber = /\d/.test(val);
      const isUpper = /[A-Z]/.test(val);
      const isLower = /[a-z]/.test(val);

      if (ruleLength) ruleLength.classList.toggle('met', isLength);
      if (ruleNumber) ruleNumber.classList.toggle('met', isNumber);
      if (ruleUppercase) ruleUppercase.classList.toggle('met', isUpper);
      if (ruleLowercase) ruleLowercase.classList.toggle('met', isLower);

      const score = [isLength, isNumber, isUpper, isLower].filter(Boolean).length;

      segs.forEach((seg, idx) => {
        seg.className = 'strength-bar-seg';
        if (idx < score) {
          if (score === 1) seg.classList.add('active-weak');
          else if (score === 2) seg.classList.add('active-medium');
          else if (score === 3) seg.classList.add('active-good');
          else if (score === 4) seg.classList.add('active-strong');
        }
      });
    });
  }

  /**
   * Step 3: Set and confirm new password
   */
  function handleResetPasswordSubmit(event) {
    event.preventDefault();
    if (!resetNewPasswordInput || !resetConfirmPasswordInput) return;

    const newPass = resetNewPasswordInput.value;
    const confirmPass = resetConfirmPasswordInput.value;

    const isLength = newPass.length >= 8;
    const isNumber = /\d/.test(newPass);
    const isUpper = /[A-Z]/.test(newPass);
    const isLower = /[a-z]/.test(newPass);

    if (!isLength || !isNumber || !isUpper || !isLower) {
      showToast('Please fulfill all 4 password strength requirements.');
      resetNewPasswordInput.focus();
      return;
    }

    if (newPass !== confirmPass) {
      showToast('Passwords do not match. Please verify and try again.');
      resetConfirmPasswordInput.focus();
      return;
    }

    const submitBtn = document.getElementById('resetPasswordSubmitBtn');
    submitBtn.disabled = true;
    submitBtn.innerHTML = `
      <svg class="spinner-spin" viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2.5" fill="none">
        <circle cx="12" cy="12" r="10" stroke-opacity="0.25"/>
        <path d="M12 2a10 10 0 0 1 10 10" stroke-linecap="round"/>
      </svg>
      <span>Resetting Password...</span>
    `;

    setTimeout(() => {
      submitBtn.disabled = false;
      submitBtn.innerHTML = `
        <span>Reset Password</span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="16" height="16">
          <line x1="5" y1="12" x2="19" y2="12"/>
          <polyline points="12 5 19 12 12 19"/>
        </svg>
      `;

      // Configure success screen for password reset (Column 4 in showcase)
      if (successTitle) successTitle.textContent = 'Password updated successfully!';
      if (successSubtext) successSubtext.textContent = 'You can now log in to your account with your new password.';
      if (successContinueLabel) successContinueLabel.textContent = 'Go to Login';
      if (successContinueBtn) {
        successContinueBtn.onclick = () => {
          navigateToView('view-login');
        };
      }
      if (successSecurityCard) {
        successSecurityCard.style.display = 'flex';
      }

      navigateToView('view-success');
    }, 600);
  }

  /**
   * Handle Continue to Dashboard
   */
  function handleContinueToDashboard() {
    window.location.href = 'index.html';
  }

  /**
   * Handle Google Login
   */
  function handleGoogleLogin() {
    showToast('Connecting with Google authentication...');
    setTimeout(() => {
      localStorage.setItem('clinic_patient_session', JSON.stringify({
        authenticated: true,
        email: 'google.user@gmail.com',
        provider: 'google',
        timestamp: new Date().toISOString()
      }));
      window.location.href = 'index.html';
    }, 600);
  }

  /**
   * Clean accessible Toast notification (zero emojis)
   * @param {string} message
   */
  function showToast(message) {
    let toast = document.getElementById('authToast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'authToast';
      toast.className = 'auth-toast-notification';
      document.body.appendChild(toast);
    }

    toast.innerHTML = `
      <div class="toast-content">
        <svg viewBox="0 0 24 24" fill="none" stroke="#2563EB" stroke-width="2" width="16" height="16">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="16" x2="12" y2="12"/>
          <line x1="12" y1="8" x2="12.01" y2="8"/>
        </svg>
        <span>${message}</span>
      </div>
    `;

    toast.classList.add('show');
    clearTimeout(toast._timeout);
    toast._timeout = setTimeout(() => {
      toast.classList.remove('show');
    }, 3500);
  }

  // --- Expose Globals to Window for inline HTML onclick attributes ---
  window.navigateToView = navigateToView;
  window.switchLoginChannel = switchLoginChannel;
  window.togglePasswordVisibility = togglePasswordVisibility;
  window.handleLoginSubmit = handleLoginSubmit;
  window.handleSignupSubmit = handleSignupSubmit;
  window.handleOtpSubmit = handleOtpSubmit;
  window.handleResendCode = handleResendCode;
  window.handleContinueToDashboard = handleContinueToDashboard;
  window.handleGoogleLogin = handleGoogleLogin;
  window.handleForgotPassword = handleForgotPassword;
  window.handleForgotEmailSubmit = handleForgotEmailSubmit;
  window.handleForgotResendMagic = handleForgotResendMagic;
  window.handleOpenEmailApp = handleOpenEmailApp;
  window.handleResetPasswordSubmit = handleResetPasswordSubmit;

  // --- Initialization ---
  document.addEventListener('DOMContentLoaded', () => {
    initDobFormatting();
    setupOtpBoxContainer(otpContainer);
    initPasswordStrengthMeter();
    handleHashRoute();

    window.addEventListener('hashchange', handleHashRoute);
  });
})();

/**
 * Nile Clinics - Patient Portal Authentication Logic
 * Pixel-accurate, responsive, 1:1 flow matching design showcase
 * Handles:
 *  - 4 views: Login, Signup, Verify OTP, Success
 *  - URL Hash routing (#login, #signup, #verify, #success)
 *  - Email vs Phone toggle
 *  - Password visibility toggle (with custom SVG icons, zero emojis)
 *  - Date of Birth formatting (DD / MM / YYYY)
 *  - 6-digit OTP box focus auto-advancement & paste handling
 *  - 45s OTP countdown timer with resend capability
 *  - Zero emojis throughout
 */

(function () {
  'use strict';

  // --- State ---
  let otpCountdownTimer = null;
  let remainingSeconds = 45;

  // --- DOM Elements ---
  const views = {
    login: document.getElementById('view-login'),
    signup: document.getElementById('view-signup'),
    verify: document.getElementById('view-verify'),
    success: document.getElementById('view-success'),
  };

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

  /**
   * Navigate between auth screens
   * @param {string} viewId - 'view-login' | 'view-signup' | 'view-verify' | 'view-success'
   * @param {boolean} updateHash - whether to update location.hash
   */
  function navigateToView(viewId, updateHash = true) {
    const targetKey = viewId.replace('view-', '');
    if (!views[targetKey]) return;

    // Switch active view
    Object.keys(views).forEach((key) => {
      if (key === targetKey) {
        views[key].classList.add('active');
      } else {
        views[key].classList.remove('active');
      }
    });

    // Update URL hash
    if (updateHash) {
      history.pushState(null, '', `#${targetKey}`);
    }

    // Scroll to top smoothly
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Handle view-specific initializations
    if (targetKey === 'verify') {
      startOtpTimer(45);
      focusFirstOtpBox();
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

    // Update SVG icon (Eye vs Eye-Off)
    if (isPassword) {
      // Show Eye-Off (visible state -> click to hide)
      btn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
          <line x1="1" y1="1" x2="23" y2="23"/>
        </svg>
      `;
    } else {
      // Show Eye (hidden state -> click to view)
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
      // Strip everything except digits
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
   * Initialize 6-Digit OTP Box Focus & Paste Handling
   */
  function initOtpInputs() {
    if (!otpContainer) return;
    const inputs = otpContainer.querySelectorAll('.otp-box');

    inputs.forEach((input, index) => {
      // Allow only numbers and auto-advance
      input.addEventListener('input', (e) => {
        const val = e.target.value.replace(/\D/g, '');
        e.target.value = val ? val[0] : '';

        if (val && index < inputs.length - 1) {
          inputs[index + 1].focus();
        }
      });

      // Handle Backspace and Arrow navigation
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

      // Handle Paste event across all boxes
      input.addEventListener('paste', (e) => {
        e.preventDefault();
        const pasteData = (e.clipboardData || window.clipboardData).getData('text');
        const digits = pasteData.replace(/\D/g, '').substring(0, inputs.length);

        digits.split('').forEach((digit, i) => {
          if (inputs[i]) {
            inputs[i].value = digit;
          }
        });

        // Focus the last filled input or the next empty one
        const focusIdx = Math.min(digits.length, inputs.length - 1);
        if (inputs[focusIdx]) inputs[focusIdx].focus();
      });
    });
  }

  function focusFirstOtpBox() {
    setTimeout(() => {
      if (!otpContainer) return;
      const firstInput = otpContainer.querySelector('.otp-box');
      if (firstInput) {
        firstInput.focus();
        firstInput.select();
      }
    }, 150);
  }

  /**
   * Start 45-second OTP Resend Timer
   * @param {number} seconds
   */
  function startOtpTimer(seconds = 45) {
    if (otpCountdownTimer) {
      clearInterval(otpCountdownTimer);
    }

    remainingSeconds = seconds;
    resendCodeBtn.disabled = true;

    function updateLabel() {
      const mins = Math.floor(remainingSeconds / 60);
      const secs = remainingSeconds % 60;
      const formatted = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
      resendCodeLabel.textContent = `Resend code in ${formatted}`;
    }

    updateLabel();

    otpCountdownTimer = setInterval(() => {
      remainingSeconds--;
      if (remainingSeconds <= 0) {
        clearInterval(otpCountdownTimer);
        otpCountdownTimer = null;
        resendCodeBtn.disabled = false;
        resendCodeLabel.textContent = 'Resend code';
      } else {
        updateLabel();
      }
    }, 1000);
  }

  /**
   * Handle Resend Code Click
   */
  function handleResendCode() {
    if (resendCodeBtn.disabled) return;

    // Clear existing boxes
    if (otpContainer) {
      otpContainer.querySelectorAll('.otp-box').forEach((box) => (box.value = ''));
    }

    showToast('A new 6-digit verification code has been sent to your email.');
    startOtpTimer(45);
    focusFirstOtpBox();
  }

  /**
   * Handle Login Form Submission
   */
  function handleLoginSubmit(event) {
    event.preventDefault();
    const submitBtn = document.getElementById('loginSubmitBtn');
    const originalText = submitBtn.innerHTML;

    // Show loading state
    submitBtn.disabled = true;
    submitBtn.innerHTML = `
      <svg class="spinner-spin" viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2.5" fill="none">
        <circle cx="12" cy="12" r="10" stroke-opacity="0.25"/>
        <path d="M12 2a10 10 0 0 1 10 10" stroke-linecap="round"/>
      </svg>
      <span>Logging in...</span>
    `;

    // Simulated authentic authentication flow
    setTimeout(() => {
      // Save patient session token
      localStorage.setItem('clinic_patient_session', JSON.stringify({
        authenticated: true,
        email: loginEmailInput.value || 'patient@nileclinics.com',
        timestamp: new Date().toISOString()
      }));

      // Redirect to main patient dashboard
      window.location.href = 'index.html';
    }, 600);
  }

  /**
   * Handle Signup Form Submission
   */
  function handleSignupSubmit(event) {
    event.preventDefault();

    const nameInput = document.getElementById('signupNameInput');
    const emailInput = document.getElementById('signupEmailInput');
    const submitBtn = document.getElementById('signupSubmitBtn');

    // Update target email on verify screen
    if (verifyTargetEmail && emailInput) {
      verifyTargetEmail.textContent = emailInput.value || 'you@example.com';
    }

    // Show loading state
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
      // Navigate to Verify OTP screen
      navigateToView('view-verify');
    }, 500);
  }

  /**
   * Handle OTP Form Submission
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

      // Set session
      localStorage.setItem('clinic_patient_session', JSON.stringify({
        authenticated: true,
        email: verifyTargetEmail.textContent,
        timestamp: new Date().toISOString()
      }));

      // Navigate to Success screen
      navigateToView('view-success');
    }, 500);
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
   * Handle Forgot Password
   */
  function handleForgotPassword(event) {
    event.preventDefault();
    const email = loginEmailInput.value;
    if (email) {
      showToast(`Password reset link sent to ${email}`);
    } else {
      showToast('Please enter your email address to reset your password.');
      loginEmailInput.focus();
    }
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

  // --- Initialization ---
  document.addEventListener('DOMContentLoaded', () => {
    initDobFormatting();
    initOtpInputs();
    handleHashRoute();

    window.addEventListener('hashchange', handleHashRoute);
  });
})();

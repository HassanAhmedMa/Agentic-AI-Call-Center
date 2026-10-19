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
 *  - "Open Email App" launch handler & inline resend timers
 *  - Dynamic real-time Password Strength Meter
 *  - Bilingual Arabic / English localization
 *  - Secure HttpOnly same-origin session integration with clinic backend
 *  - Zero emojis throughout
 */

(function () {
  'use strict';

  // --- State Variables ---
  let language = 'en';
  let mode = 'email';
  let pending = null;
  let authenticated = false;
  let verifiedIdentity = false;
  let busy = false;
  let resendAt = 0;
  let otpCountdownTimer = null;
  let forgotMagicCountdownTimer = null;
  let remainingSeconds = 60;
  let forgotMagicRemainingSeconds = 45;

  const $ = id => document.getElementById(id);

  const digits = value => String(value)
    .replace(/[٠-٩]/g, c => String(c.charCodeAt(0) - 1632))
    .replace(/[۰-۹]/g, c => String(c.charCodeAt(0) - 1776));

  const messages = {
    PHONE_ALREADY_REGISTERED: ['This phone number is already registered.', 'رقم الموبايل ده متسجل بالفعل.'],
    EMAIL_ALREADY_REGISTERED: ['This email is already registered. Sign in or reset your password.', 'البريد ده متسجل بالفعل. سجّل دخولك أو غيّر كلمة السر.'],
    VERIFICATION_REQUIRED: ['Check your credentials or verification link and try again.', 'راجع بيانات الدخول أو لينك التأكيد وحاول تاني.'],
    SESSION_EXPIRED: ['Your session expired. Sign in again.', 'الجلسة انتهت. سجّل دخولك تاني.'],
    INVALID_CODE: ['Enter the correct verification code.', 'اكتب كود التأكيد الصحيح.'],
    VALIDATION_FAILED: ['Check your name, phone, date of birth, consent and matching passwords (at least 12 characters).', 'راجع الاسم والموبايل وتاريخ الميلاد والموافقة. كلمتا السر لازم يكونوا زي بعض ومن ١٢ حرف على الأقل.'],
    PASSWORD_MISMATCH: ['Passwords do not match.', 'كلمتا السر غير متطابقتين.'],
    PASSWORD_TOO_SHORT: ['Password must be at least 8 characters long.', 'يجب أن لا تقل كلمة السر عن ٨ أحرف.'],
    RATE_LIMITED: ['Too many attempts. Wait before trying again.', 'محاولات كتير. استنى شوية وحاول تاني.'],
    REGISTRATION_REQUIRED: ['Your email is verified. Complete your clinic profile first.', 'بريدك متأكد. كمّل بيانات حساب العيادة الأول.'],
    unavailable: ['The service is unavailable. Please try again.', 'الخدمة مش متاحة دلوقتي. حاول تاني.'],
    BACKEND_UNREACHABLE: ['Cannot connect to backend (ports 8000 & 8002). Make sure uvicorn or your tunnel is running.', 'مش قادرين نوصل للسيرفر (بورت 8000 و 8002). اتأكد إن سيرفر الـ backend أو الـ tunnel شغال.'],
    sent: ['Check your email for the verification code.', 'راجع بريدك علشان كود التأكيد.'],
    recovered: ['If this email has an account, a password-reset link will arrive shortly.', 'لو البريد ده ليه حساب، هيوصلك لينك تغيير كلمة السر.'],
    reset: ['Password updated. Sign in with your new password.', 'كلمة السر اتغيرت. سجّل دخولك بكلمة السر الجديدة.']
  };

  const translations = {
    'Your Health, Our Care': 'صحتك ورعايتك عندنا',
    'Need help?': 'محتاج مساعدة؟',
    'Back to Login': 'الرجوع لتسجيل الدخول',
    'Welcome Back': 'أهلاً بيك من جديد',
    'Access your healthcare, anytime': 'خدمات عيادتك في أي وقت',
    'Log in to book appointments, manage your medical records, and chat with our AI assistant.': 'سجّل دخولك للوصول لخدمات العيادة والمساعد الذكي.',
    'Book & manage appointments': 'احجز وتابع مواعيدك',
    'Access your medical records': 'تابع بيانات حسابك',
    'Get instant help from our AI assistant': 'اسأل المساعد الذكي',
    'Log in to your account': 'سجّل دخولك لحسابك',
    'Enter your email to continue to Nile Clinics.': 'اكتب بريدك وكلمة السر علشان تدخل لعيادات النيل.',
    'Access your appointments, medical records, and 24/7 AI support.': 'ادخل لحساب العيادة وخدمات المساعد الذكي.',
    'or continue with': 'أو كمّل باستخدام',
    'Continue with Google': 'كمّل بجوجل',
    "Don't have an account?": 'لسه معندكش حساب؟',
    'Join Nile Clinics': 'انضم لعيادات النيل',
    'Create your account to start booking appointments, access your records, and get 24/7 support.': 'سجّل بياناتك علشان تبدأ تستخدم خدمات العيادة.',
    'Easy appointment booking': 'حجز مواعيد بسهولة',
    'Secure access to your medical records': 'دخول آمن لحسابك',
    'AI assistant for instant help': 'مساعد ذكي يجاوبك',
    'Create your account': 'اعمل حسابك',
    'Fill in your details to get started.': 'اكتب بياناتك علشان تبدأ.',
    'Join Nile Clinics to book appointments, access your records, and get 24/7 support.': 'انضم لعيادات النيل واستعمل خدمات العيادة.',
    'Terms of Service': 'شروط الاستخدام',
    'Privacy Policy': 'سياسة الخصوصية',
    'Already have an account?': 'عندك حساب بالفعل؟',
    "Didn't receive the code?": 'الكود موصلكش؟',
    'You are signed in!': 'سجّلت دخولك بنجاح!',
    'Your verified clinic account is ready. Keep your customer number for future visits.': 'حسابك المتأكد جاهز. احتفظ برقم العميل للزيارات الجاية.',
    'Email': 'البريد الإلكتروني',
    'Phone': 'الموبايل',
    'Phone number': 'رقم الموبايل',
    'Email address': 'البريد الإلكتروني',
    'Password': 'كلمة السر',
    'Confirm password': 'تأكيد كلمة السر',
    'Full name': 'الاسم بالكامل',
    'Date of birth': 'تاريخ الميلاد',
    'Log In': 'سجّل دخولك',
    'Sign up': 'إنشاء حساب',
    'Log in': 'سجّل دخولك',
    'Create Account': 'إنشاء حساب',
    'Forgot password?': 'نسيت كلمة السر؟',
    'Verify your email': 'أكّد بريدك',
    'Verify': 'تأكيد',
    'Resend code': 'ابعت كود جديد',
    'Account created successfully!': 'حسابك جاهز!',
    'Continue to Dashboard': 'كمّل للصفحة الرئيسية',
    'Reset your password': 'غيّر كلمة السر',
    'Send reset link': 'ابعت لينك تغيير كلمة السر',
    'Send Magic Link': 'ابعت لينك الدخول السحري',
    'New password': 'كلمة السر الجديدة',
    'Save new password': 'احفظ كلمة السر الجديدة',
    'Save New Password': 'احفظ كلمة السر الجديدة',
    'Back to login': 'ارجع لتسجيل الدخول',
    'I agree to use these details to create my clinic account.': 'موافق على استخدام البيانات دي لإنشاء حساب العيادة.'
  };

  /**
   * Safe Toast Notification
   */
  function showToast(message) {
    let toast = $('authToast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'authToast';
      toast.className = 'auth-toast-notification';
      toast.setAttribute('role', 'status');
      document.body.appendChild(toast);
    }
    const text = messages[message] ? messages[message][language === 'ar' ? 1 : 0] : (translations[message] && language === 'ar' ? translations[message] : message);
    toast.textContent = text;
    toast.classList.add('show');
    clearTimeout(toast._timeout);
    toast._timeout = setTimeout(() => {
      toast.classList.remove('show');
    }, 4000);
  }

  /**
   * Resolve Backend API Base URL
   * Supports local development servers alongside same-origin portal hosting.
   */
  const api = (...args) => window.ClinicPortalAPI.request(...args);

  /**
   * Form Action Runner with Disabling and Error Handling
   */
  async function run(action) {
    if (busy) return;
    busy = true;
    document.querySelectorAll('button[type=submit]').forEach(button => { button.disabled = true; });
    try {
      await action();
    } catch (error) {
      if (error.message === 'RATE_LIMITED' && error.details?.retry_after) {
        const minutes = Math.max(1, Math.ceil(error.details.retry_after / 60));
        showToast(language === 'ar' ? `محاولات كتير. جرّب تاني بعد ${minutes} دقيقة.` : `Too many attempts. Try again in ${minutes} minute(s).`);
      } else {
        showToast(messages[error.message] ? error.message : 'unavailable');
      }
      if (error.details?.email_verified) {
        verifiedIdentity = true;
        if (error.details.email) {
          pending = { email: error.details.email };
          if ($('signupEmailInput')) {
            $('signupEmailInput').value = error.details.email;
            $('signupEmailInput').readOnly = true;
          }
        }
        if ($('signupPasswordInput')) $('signupPasswordInput').required = false;
        if ($('signupPasswordConfirm')) $('signupPasswordConfirm').required = false;
        ['signupPasswordInput', 'signupPasswordConfirm'].forEach(id => {
          const group = $(id)?.closest('.form-field-group');
          if (group) group.hidden = true;
        });
        navigateToView('view-signup');
      }
    } finally {
      busy = false;
      document.querySelectorAll('button[type=submit]').forEach(button => { button.disabled = false; });
    }
  }

  /**
   * Egyptian Phone Normalizer
   */
  function normalizePhone(value) {
    value = digits(value).replace(/[\s()-]/g, '');
    if (/^01[0125]\d{8}$/.test(value)) value = '+20' + value.slice(1);
    else if (/^1[0125]\d{8}$/.test(value)) value = '+20' + value;
    else if (value.startsWith('0020')) value = '+' + value.slice(2);
    if (!/^\+[1-9]\d{7,14}$/.test(value)) throw Error('VALIDATION_FAILED');
    return value;
  }

  /**
   * Egyptian Date of Birth Parser
   */
  function parseDOB(value) {
    let text = digits(value);
    if (/^\d{4}-\d{2}-\d{2}$/.test(text)) text = text.split('-').reverse().join(' / ');
    const match = text.match(/^(\d{2})\s*\/\s*(\d{2})\s*\/\s*(\d{4})$/);
    if (!match) throw Error('VALIDATION_FAILED');
    const [, day, month, year] = match;
    const date = new Date(Date.UTC(+year, +month - 1, +day));
    const today = new Date();
    const todayUTC = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
    const age = today.getFullYear() - +year - ((today.getMonth() + 1 < +month || (today.getMonth() + 1 === +month && today.getDate() < +day)) ? 1 : 0);
    if (
      date.getUTCFullYear() !== +year ||
      date.getUTCMonth() !== +month - 1 ||
      date.getUTCDate() !== +day ||
      date.getTime() >= todayUTC ||
      age > 120
    ) {
      throw Error('VALIDATION_FAILED');
    }
    return `${year}-${month}-${day}`;
  }

  /**
   * Open Date of Birth Picker
   */
  function openDobPicker() {
    const input = $('signupDobInput');
    if (!input) return;
    try {
      if (typeof input.showPicker === 'function') {
        input.showPicker();
        return;
      }
    } catch (_) {}
    input.focus();
  }

  /**
   * View Switcher with State Safeguards
   */
  function navigateToView(targetId, updateHash = true) {
    // Aliases
    if (targetId === 'view-forgot' || targetId === 'forgot') targetId = 'view-forgot-email';
    if (targetId === 'view-reset' || targetId === 'reset') targetId = 'view-forgot-reset';

    let cleanTarget = targetId.startsWith('view-') ? targetId : `view-${targetId}`;

    if (cleanTarget === 'view-verify' && !pending) cleanTarget = 'view-signup';
    if (cleanTarget === 'view-success' && !authenticated) cleanTarget = 'view-login';

    document.querySelectorAll('.auth-card-view').forEach(view => {
      if (view.id === cleanTarget) {
        view.classList.add('active');
      } else {
        view.classList.remove('active');
      }
    });

    const isForgotFlow = cleanTarget.startsWith('view-forgot');
    const headerBackToLoginBtn = $('headerBackToLoginBtn');
    const headerHelpBtn = $('headerHelpBtn');
    if (headerBackToLoginBtn && headerHelpBtn) {
      if (isForgotFlow) {
        headerBackToLoginBtn.style.display = 'inline-flex';
        headerHelpBtn.style.display = 'none';
      } else {
        headerBackToLoginBtn.style.display = 'none';
        headerHelpBtn.style.display = 'inline-flex';
      }
    }

    if (updateHash) {
      const hashName = cleanTarget.replace('view-', '');
      history.pushState(null, '', `#${hashName}`);
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });

    if (cleanTarget === 'view-verify') {
      startOtpTimer();
      focusFirstOtpBox();
    } else if (cleanTarget === 'view-forgot-code') {
      startForgotMagicTimer(45);
    } else if (cleanTarget === 'view-forgot-reset') {
      setTimeout(() => {
        const resetPass = $('resetPassword') || $('resetNewPasswordInput');
        if (resetPass) resetPass.focus();
      }, 150);
    }
  }

  /**
   * Handle Hash Route changes
   */
  function handleHashRoute() {
    const raw = window.location.hash.replace('#', '').toLowerCase();
    if (raw === 'signup') {
      navigateToView('view-signup', false);
    } else if (raw === 'verify') {
      navigateToView('view-verify', false);
    } else if (raw === 'success') {
      navigateToView('view-success', false);
    } else if (raw === 'forgot' || raw === 'forgot-password' || raw === 'forgot-email') {
      navigateToView('view-forgot-email', false);
    } else if (raw === 'forgot-code' || raw === 'forgot-magic' || raw === 'check-email') {
      navigateToView('view-forgot-code', false);
    } else if (raw === 'forgot-reset' || raw === 'reset' || raw === 'reset-password') {
      navigateToView('view-forgot-reset', false);
    } else {
      navigateToView('view-login', false);
    }
  }

  /**
   * Switch Login Channel: Email vs Phone
   */
  function switchLoginChannel(channel) {
    mode = channel;
    const tabEmail = $('loginTabEmail');
    const tabPhone = $('loginTabPhone');
    const groupEmail = $('loginEmailGroup');
    const groupPhone = $('loginPhoneGroup');
    const inputEmail = $('loginEmailInput');
    const inputPhone = $('loginPhoneInput');

    if (tabEmail && tabPhone) {
      tabEmail.classList.toggle('active', channel === 'email');
      tabPhone.classList.toggle('active', channel === 'phone');
    }
    if (groupEmail && groupPhone) {
      groupEmail.style.display = channel === 'email' ? 'flex' : 'none';
      groupPhone.style.display = channel === 'phone' ? 'flex' : 'none';
    }
    if (inputEmail) inputEmail.required = (channel === 'email');
    if (inputPhone) inputPhone.required = (channel === 'phone');
  }

  /**
   * Password Visibility Toggle (custom SVG icons, zero emojis)
   */
  function togglePasswordVisibility(inputId, btnEl) {
    const input = $(inputId);
    if (!input) return;

    const isPassword = input.type === 'password';
    input.type = isPassword ? 'text' : 'password';

    const button = btnEl || (input.parentElement ? input.parentElement.querySelector('.input-trailing-action-btn') : null);
    if (button) {
      button.innerHTML = isPassword
        ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
            <line x1="1" y1="1" x2="23" y2="23"/>
          </svg>`
        : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
            <circle cx="12" cy="12" r="3"/>
          </svg>`;
    }
  }

  /**
   * Clear 6-digit OTP Inputs
   */
  function clearCode() {
    const container = $('otpContainer');
    if (container) {
      container.querySelectorAll('input').forEach(box => { box.value = ''; });
    }
  }

  /**
   * Focus first OTP input
   */
  function focusFirstOtpBox() {
    const container = $('otpContainer');
    if (!container) return;
    const first = container.querySelector('input');
    if (first) {
      setTimeout(() => first.focus(), 100);
    }
  }

  /**
   * Start 60-second OTP countdown timer for Sign Up
   */
  function startOtpTimer(seconds = 60) {
    if (otpCountdownTimer) clearInterval(otpCountdownTimer);
    remainingSeconds = seconds;

    const timerVal = $('otpTimerVal');
    const resendBtn = $('resendOtpBtn');

    if (resendBtn) resendBtn.disabled = true;

    function update() {
      if (timerVal) {
        const mins = Math.floor(remainingSeconds / 60);
        const secs = remainingSeconds % 60;
        timerVal.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
      }

      if (remainingSeconds <= 0) {
        clearInterval(otpCountdownTimer);
        otpCountdownTimer = null;
        if (resendBtn) resendBtn.disabled = false;
      }
      remainingSeconds--;
    }

    update();
    otpCountdownTimer = setInterval(update, 1000);
  }

  /**
   * Start 45-second Magic Link recovery resend countdown timer
   */
  function startForgotMagicTimer(seconds = 45) {
    if (forgotMagicCountdownTimer) clearInterval(forgotMagicCountdownTimer);
    forgotMagicRemainingSeconds = seconds;

    const timerVal = $('forgotMagicTimerVal');
    const resendBtn = $('forgotResendMagicBtn');

    if (resendBtn) resendBtn.disabled = true;

    function update() {
      if (timerVal) {
        timerVal.textContent = forgotMagicRemainingSeconds.toString();
      }

      if (forgotMagicRemainingSeconds <= 0) {
        clearInterval(forgotMagicCountdownTimer);
        forgotMagicCountdownTimer = null;
        if (resendBtn) resendBtn.disabled = false;
      }
      forgotMagicRemainingSeconds--;
    }

    update();
    forgotMagicCountdownTimer = setInterval(update, 1000);
  }

  /**
   * Successful Auth Handler
   */
  function success(profile, isSignup = false) {
    authenticated = true;
    pending = null;
    verifiedIdentity = false;
    clearCode();
    const customerEl = $('customerNumber');
    if (customerEl && profile?.customer_number) {
      customerEl.textContent = profile.customer_number;
    }
    if (isSignup) {
      navigateToView('view-success');
    } else {
      window.location.assign('index.html');
    }
  }

  /**
   * Login Form Submission
   */
  function handleLoginSubmit(event) {
    if (event?.preventDefault) event.preventDefault();
    return run(async () => {
      const identifier = mode === 'phone'
        ? normalizePhone($('loginPhoneInput').value)
        : $('loginEmailInput').value.trim().toLowerCase();
      try {
        await api('login', {
          identifier,
          password: $('loginPasswordInput').value
        });
        window.location.assign('index.html');
      } finally {
        if ($('loginPasswordInput')) $('loginPasswordInput').value = '';
      }
    });
  }

  /**
   * Signup Form Submission
   */
  function handleSignupSubmit(event) {
    if (event?.preventDefault) event.preventDefault();
    return run(async () => {
      const password = $('signupPasswordInput').value;
      const confirm = $('signupPasswordConfirm') ? $('signupPasswordConfirm').value : password;
      const consentChecked = $('signupConsent') ? $('signupConsent').checked : true;

      if ((!verifiedIdentity && (password.length < 12 || password !== confirm)) || !consentChecked) {
        throw Error('VALIDATION_FAILED');
      }

      const registration = {
        full_name: $('signupNameInput').value.trim(),
        email: $('signupEmailInput').value.trim().toLowerCase(),
        phone: normalizePhone($('signupPhoneInput').value),
        date_of_birth: parseDOB($('signupDobInput').value),
        preferred_language: language,
        privacy_notice_accepted: true
      };

      if (!registration.full_name) throw Error('VALIDATION_FAILED');

      if (pending?.email !== registration.email) {
        verifiedIdentity = false;
        if (password.length < 12 || password !== confirm) throw Error('VALIDATION_FAILED');
      }

      pending = registration;

      try {
        if (verifiedIdentity) {
          success(await api('verify', { email: pending.email, code: '000000', registration: pending }), true);
          return;
        }

        await api('signup', { ...registration, password, password_confirm: confirm });

        if ($('verifyTargetEmail')) {
          $('verifyTargetEmail').textContent = pending.email;
        }

        resendAt = Date.now() + 60000;
        clearCode();
        startOtpTimer(60);
        navigateToView('view-verify');
        showToast('sent');
      } finally {
        if ($('signupPasswordInput')) $('signupPasswordInput').value = '';
        if ($('signupPasswordConfirm')) $('signupPasswordConfirm').value = '';
      }
    });
  }

  /**
   * OTP Verification Submission
   */
  function handleOtpSubmit(event) {
    if (event?.preventDefault) event.preventDefault();
    return run(async () => {
      if (!pending) throw Error('SESSION_EXPIRED');
      const boxes = $('otpContainer') ? [...$('otpContainer').querySelectorAll('input')] : [];
      const code = boxes.map(input => digits(input.value)).join('');
      clearCode();
      if (!/^\d{6}$/.test(code)) throw Error('INVALID_CODE');
      success(await api('verify', { email: pending.email, code, registration: pending }), true);
    });
  }

  /**
   * Resend Signup OTP
   */
  function handleResendCode() {
    if (Date.now() < resendAt || !pending) return;
    return run(async () => {
      await api('resend', { email: pending.email });
      resendAt = Date.now() + 60000;
      clearCode();
      startOtpTimer(60);
      showToast('sent');
    });
  }

  /**
   * Forgot Password - Send Recovery Magic Link
   */
  function handleForgotEmailSubmit(event) {
    if (event?.preventDefault) event.preventDefault();
    return run(async () => {
      const emailInput = $('forgotEmailInput') || $('recoveryEmail');
      const email = emailInput ? emailInput.value.trim().toLowerCase() : '';
      if (!email) throw Error('VALIDATION_FAILED');

      await api('recover', { email, return_path: window.location.pathname });

      const targetEmailEl = $('forgotMagicTargetEmail');
      if (targetEmailEl) targetEmailEl.textContent = email;

      const resetEmailEl = $('resetEmail');
      if (resetEmailEl) resetEmailEl.value = email;

      startForgotMagicTimer(45);
      navigateToView('view-forgot-code');
      showToast('recovered');
    });
  }

  function handleForgotPassword(event) {
    if (event?.preventDefault) event.preventDefault();
    const loginEmail = $('loginEmailInput') ? $('loginEmailInput').value : '';
    if ($('forgotEmailInput')) $('forgotEmailInput').value = loginEmail;
    if ($('recoveryEmail')) $('recoveryEmail').value = loginEmail;
    navigateToView('view-forgot-email');
  }

  function handleRecoverySubmit(event) {
    return handleForgotEmailSubmit(event);
  }

  function handleForgotResendMagic() {
    const emailInput = $('forgotEmailInput') || $('recoveryEmail');
    const email = emailInput ? emailInput.value.trim().toLowerCase() : '';
    if (!email) return;
    return run(async () => {
      await api('recover', { email, return_path: window.location.pathname });
      startForgotMagicTimer(45);
      showToast('recovered');
    });
  }

  /**
   * Reset Password Submission
   */
  function handleResetPasswordSubmit(event) {
    if (event?.preventDefault) event.preventDefault();
    return run(async () => {
      const emailEl = $('resetEmail') || $('forgotEmailInput') || $('recoveryEmail');
      const email = emailEl && emailEl.value ? emailEl.value.trim().toLowerCase() : (window._recoveryEmail || '');
      const passEl = $('resetNewPasswordInput') || $('resetPassword');
      const confirmEl = $('resetConfirmPasswordInput') || $('resetPasswordConfirm');

      const password = passEl ? passEl.value : '';
      const password_confirm = confirmEl ? confirmEl.value : '';

      if (password.length < 8) {
        throw Error('PASSWORD_TOO_SHORT');
      }
      if (password !== password_confirm) {
        throw Error('PASSWORD_MISMATCH');
      }

      try {
        await api('reset-password', { email, password, password_confirm });
        authenticated = false;
        navigateToView('view-login');
        showToast('reset');
      } finally {
        if (passEl) passEl.value = '';
        if (confirmEl) confirmEl.value = '';
      }
    });
  }
  function handleResetSubmit(event) {
    return handleResetPasswordSubmit(event);
  }

  /**
   * Continue to Dashboard Button
   */
  async function handleContinueToDashboard() {
    return run(async () => {
      await api('session');
      window.location.assign('index.html');
    });
  }

  /**
   * Social Google Login
   */
  function handleGoogleLogin() {
    return run(async () => {
      const result = await api('google', { return_path: window.location.pathname });
      window.location.assign(result.url);
    });
  }

  /**
   * Open Mail Client Protocol
   */
  function handleOpenEmailApp() {
    showToast(language === 'ar' ? 'جاري فتح تطبيق البريد...' : 'Opening email application...');
    setTimeout(() => {
      window.location.href = 'mailto:';
    }, 300);
  }

  /**
   * Language Switcher
   */
  function setLanguage() {
    language = language === 'en' ? 'ar' : 'en';
    if (document.documentElement) {
      document.documentElement.lang = language;
      document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
    }
    const langBtn = $('authLanguage');
    if (langBtn) {
      langBtn.textContent = language === 'ar' ? 'English' : 'العربية';
    }
    document.querySelectorAll('[data-en]').forEach(node => {
      node.textContent = language === 'ar' ? node.dataset.ar : node.dataset.en;
    });
  }
  /**
   * Expose public contract on window
   */
  Object.assign(window, {
    openDobPicker,
    navigateToView,
    switchLoginChannel,
    togglePasswordVisibility,
    handleLoginSubmit,
    handleSignupSubmit,
    handleOtpSubmit,
    handleResendCode,
    handleContinueToDashboard,
    handleGoogleLogin,
    handleForgotPassword,
    handleForgotEmailSubmit,
    handleForgotResendMagic,
    handleOpenEmailApp,
    handleResetPasswordSubmit,
    handleRecoverySubmit,
    handleResetSubmit
  });

  window.PortalAuthUtils = {
    normalizePhone,
    parseDOB
  };

  /**
   * DOM Initializer
   */
  document.addEventListener('DOMContentLoaded', async () => {
    try {
      localStorage.removeItem('clinic_patient_session');
    } catch (_) {}

    const langBtn = $('authLanguage');
    if (langBtn) {
      langBtn.addEventListener('click', setLanguage);
    }

    document.querySelectorAll('label, h1, h2, p, span, button, a').forEach(node => {
      const text = node.textContent.trim();
      if (translations[text] && node.children.length === 0) {
        node.dataset.en = text;
        node.dataset.ar = translations[text];
      }
    });
    const today = new Date();
    const isoDate = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const dobInput = $('signupDobInput');
    if (dobInput) {
      dobInput.max = isoDate(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1));
      dobInput.min = isoDate(new Date(today.getFullYear() - 121, today.getMonth(), today.getDate() + 1));
    }

    const otpContainer = $('otpContainer');
    if (otpContainer) {
      const boxes = [...otpContainer.querySelectorAll('input')];
      boxes.forEach((input, index) => {
        input.addEventListener('input', () => {
          input.value = digits(input.value).replace(/\D/g, '').slice(0, 1);
          if (input.value && boxes[index + 1]) boxes[index + 1].focus();
        });
        input.addEventListener('keydown', event => {
          if (event.key === 'Backspace' && !input.value && boxes[index - 1]) {
            boxes[index - 1].focus();
          }
        });
        input.addEventListener('paste', event => {
          event.preventDefault();
          const text = digits(event.clipboardData.getData('text')).replace(/\D/g, '').slice(0, 6);
          boxes.forEach((box, i) => { box.value = text[i] || ''; });
          if (boxes[Math.min(text.length, 5)]) boxes[Math.min(text.length, 5)].focus();
        });
      });
    }

    // Password strength meter live inspection
    const newPassInput = $('resetPassword') || $('resetNewPasswordInput');
    if (newPassInput) {
      newPassInput.addEventListener('input', () => {
        const val = newPassInput.value;
        const lenRule = $('rule-length');
        const numRule = $('rule-number');
        const upperRule = $('rule-uppercase');
        const lowerRule = $('rule-lowercase');

        const hasLen = val.length >= 8;
        const hasNum = /\d/.test(val);
        const hasUpper = /[A-Z]/.test(val);
        const hasLower = /[a-z]/.test(val);

        if (lenRule) lenRule.classList.toggle('passed', hasLen);
        if (numRule) numRule.classList.toggle('passed', hasNum);
        if (upperRule) upperRule.classList.toggle('passed', hasUpper);
        if (lowerRule) lowerRule.classList.toggle('passed', hasLower);

        const score = [hasLen, hasNum, hasUpper, hasLower].filter(Boolean).length;
        const segments = document.querySelectorAll('.strength-bar-seg');
        segments.forEach((seg, idx) => {
          seg.className = 'strength-bar-seg';
          if (idx < score) {
            if (score <= 1) seg.classList.add('weak');
            else if (score <= 3) seg.classList.add('medium');
            else seg.classList.add('strong');
          }
        });
      });
    }

    // Google OAuth Callback Handler
    const oauth = new URLSearchParams(window.location.search);
    if (oauth.has('code') || oauth.has('oauth_state') || oauth.has('error')) {
      history.replaceState(null, '', window.location.pathname);
      await run(async () => {
        if (!oauth.get('code') || !oauth.get('oauth_state') || oauth.has('error')) throw Error('VERIFICATION_REQUIRED');
        success(await api('google/exchange', { code: oauth.get('code'), state: oauth.get('oauth_state') }));
        window.location.assign('index.html');
      });
      return;
    }

    // Check URL for magic link recovery token callback: #access_token=...&type=recovery
    const hash = window.location.hash.slice(1);
    const callback = new URLSearchParams(hash);
    if (callback.has('access_token') || callback.has('error')) {
      history.replaceState(null, '', window.location.pathname + (window.location.search || ''));
      if (callback.get('type') !== 'recovery' || !callback.get('access_token')) {
        navigateToView('view-forgot-email');
        showToast('VERIFICATION_REQUIRED');
        return;
      }
      await run(async () => {
        const res = await api('recovery-session', { access_token: callback.get('access_token') });
        if (res && res.email) {
          window._recoveryEmail = res.email;
          if ($('resetEmail')) $('resetEmail').value = res.email;
          if ($('recoveryEmail')) $('recoveryEmail').value = res.email;
          if ($('forgotEmailInput')) $('forgotEmailInput').value = res.email;
        }
        navigateToView('view-forgot-reset');
      });
      return;
    }

    handleHashRoute();
    try {
      success(await api('session'));
    } catch (_) {}
    window.addEventListener('hashchange', handleHashRoute);
  });
})();

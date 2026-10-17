/* Patient credentials are exchanged only with the same-origin clinic backend. */
(function () {
  'use strict';
  let language = 'en';
  let mode = 'email';
  let pending = null;
  let authenticated = false;
  let verifiedIdentity = false;
  let busy = false;
  let resendAt = 0;
  let timer = null;
  const $ = id => document.getElementById(id);
  const digits = value => String(value).replace(/[٠-٩]/g, c => String(c.charCodeAt(0) - 1632)).replace(/[۰-۹]/g, c => String(c.charCodeAt(0) - 1776));
  const messages = {
    PHONE_ALREADY_REGISTERED: ['This phone number is already registered.', 'رقم الموبايل ده متسجل بالفعل.'],
    EMAIL_ALREADY_REGISTERED: ['This email is already registered. Sign in or reset your password.', 'البريد ده متسجل بالفعل. سجّل دخولك أو غيّر كلمة السر.'],
    VERIFICATION_REQUIRED: ['Check your credentials or verification link and try again.', 'راجع بيانات الدخول أو لينك التأكيد وحاول تاني.'],
    SESSION_EXPIRED: ['Your session expired. Sign in again.', 'الجلسة انتهت. سجّل دخولك تاني.'],
    INVALID_CODE: ['Enter the correct verification code.', 'اكتب كود التأكيد الصحيح.'],
    VALIDATION_FAILED: ['Check your name, phone, date of birth, consent and matching passwords (at least 12 characters).', 'راجع الاسم والموبايل وتاريخ الميلاد والموافقة. كلمتا السر لازم يكونوا زي بعض ومن ١٢ حرف على الأقل.'],
    RATE_LIMITED: ['Too many attempts. Wait before trying again.', 'محاولات كتير. استنى شوية وحاول تاني.'],
    REGISTRATION_REQUIRED: ['Your email is verified. Complete your clinic profile first.', 'بريدك متأكد. كمّل بيانات حساب العيادة الأول.'],
    unavailable: ['The service is unavailable. Please try again.', 'الخدمة مش متاحة دلوقتي. حاول تاني.'],
    sent: ['Check your email for the verification code.', 'راجع بريدك علشان كود التأكيد.'],
    recovered: ['If this email has an account, a password-reset link will arrive shortly.', 'لو البريد ده ليه حساب، هيوصلك لينك تغيير كلمة السر.'],
    reset: ['Password updated. Sign in with your new password.', 'كلمة السر اتغيرت. سجّل دخولك بكلمة السر الجديدة.']
  };
  function showToast(message) {
    let toast = $('authToast');
    if (!toast) {
      toast = document.createElement('div'); toast.id = 'authToast';
      toast.className = 'auth-toast-notification'; toast.setAttribute('role', 'status');
      document.body.appendChild(toast);
    }
    toast.textContent = messages[message] ? messages[message][language === 'ar' ? 1 : 0] : message;
    toast.classList.add('show');
  }
  async function api(path, body) {
    const response = await fetch('/api/v1/portal/' + path, {
      method: body === undefined ? 'GET' : 'POST', credentials: 'same-origin',
      headers: {'Content-Type': 'application/json'},
      body: body === undefined ? undefined : JSON.stringify(body), cache: 'no-store', redirect: 'error'
    });
    const result = response.status === 204 ? {} : await response.json();
    if (!response.ok) {
      const error = new Error(result.error?.code || 'unavailable');
      error.details = result.error?.details; throw error;
    }
    return result;
  }
  async function run(action) {
    if (busy) return;
    busy = true;
    document.querySelectorAll('button[type=submit]').forEach(button => { button.disabled = true; });
    try { await action(); } catch (error) {
      if (error.message === 'RATE_LIMITED' && error.details?.retry_after) {
        const minutes = Math.max(1, Math.ceil(error.details.retry_after/60));
        showToast(language === 'ar' ? `محاولات كتير. جرّب تاني بعد ${minutes} دقيقة.` : `Too many attempts. Try again in ${minutes} minute(s).`);
      } else showToast(messages[error.message] ? error.message : 'unavailable');
      if (error.details?.email_verified) { verifiedIdentity = true; if (error.details.email) { pending = {email: error.details.email}; $('signupEmailInput').value = error.details.email; } $('signupEmailInput').readOnly = true; ['signupPasswordInput','signupPasswordConfirm'].forEach(id => { $(id).required = false; $(id).closest('.form-field-group').hidden = true; }); navigateToView('view-signup'); }
    } finally {
      busy = false;
      document.querySelectorAll('button[type=submit]').forEach(button => { button.disabled = false; });
    }
  }
  function normalizePhone(value) {
    value = digits(value).replace(/[\s()-]/g, '');
    if (/^01[0125]\d{8}$/.test(value)) value = '+20' + value.slice(1);
    else if (/^1[0125]\d{8}$/.test(value)) value = '+20' + value;
    else if (value.startsWith('0020')) value = '+' + value.slice(2);
    if (!/^\+[1-9]\d{7,14}$/.test(value)) throw Error('VALIDATION_FAILED');
    return value;
  }
  function parseDOB(value) {
    let text = digits(value);
    if (/^\d{4}-\d{2}-\d{2}$/.test(text)) text = text.split('-').reverse().join(' / ');
    const match = text.match(/^(\d{2})\s*\/\s*(\d{2})\s*\/\s*(\d{4})$/);
    if (!match) throw Error('VALIDATION_FAILED');
    const [, day, month, year] = match;
    const date = new Date(Date.UTC(+year, +month - 1, +day));
    const today = new Date();
    const todayUTC = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
    const age = today.getFullYear() - +year - ((today.getMonth()+1 < +month || (today.getMonth()+1 === +month && today.getDate() < +day)) ? 1 : 0);
    if (date.getUTCFullYear() !== +year || date.getUTCMonth() !== +month - 1 || date.getUTCDate() !== +day || date.getTime() >= todayUTC || age > 120) throw Error('VALIDATION_FAILED');
    return `${year}-${month}-${day}`;
  }
  function openDobPicker() {
    const input = $('signupDobInput');
    try { if (typeof input.showPicker === 'function') { input.showPicker(); return; } } catch (_) {}
    input.focus();
  }
  function navigateToView(id, updateHash = true) {
    if (id === 'view-verify' && !pending) id = 'view-signup';
    if (id === 'view-success' && !authenticated) id = 'view-login';
    if (id === 'view-reset' && !$('view-reset').dataset.ready) id = 'view-forgot';
    document.querySelectorAll('.auth-card-view').forEach(view => view.classList.toggle('active', view.id === id));
    if (updateHash) history.pushState(null, '', '#' + id.replace('view-', ''));
    window.scrollTo({top: 0, behavior: 'smooth'});
    if (id === 'view-verify') $('otpContainer').querySelector('input')?.focus();
  }
  function startOtpTimer() {
    clearInterval(timer);
    function update() {
      const left = Math.max(0, Math.ceil((resendAt - Date.now()) / 1000));
      $('resendCodeBtn').disabled = busy || left > 0;
      $('resendCodeLabel').textContent = left ? (language === 'ar' ? `ابعت كود تاني بعد ${left} ثانية` : `Resend code in ${left}s`) : (language === 'ar' ? 'ابعت كود جديد' : 'Resend code');
    }
    update(); timer = setInterval(update, 1000);
  }
  function clearCode() { $('otpContainer').querySelectorAll('input').forEach(input => { input.value = ''; }); }
  function success(profile) {
    authenticated = true; pending = null; verifiedIdentity = false; clearCode();
    $('customerNumber').textContent = profile.customer_number;
    navigateToView('view-success');
  }
  function handleSignupSubmit(event) {
    event.preventDefault();
    return run(async () => {
      const password = $('signupPasswordInput').value;
      const confirm = $('signupPasswordConfirm').value;
      if ((!verifiedIdentity && (password.length < 12 || password !== confirm)) || !$('signupConsent').checked) throw Error('VALIDATION_FAILED');
      const registration = {
        full_name: $('signupNameInput').value.trim(), email: $('signupEmailInput').value.trim().toLowerCase(),
        phone: normalizePhone($('signupPhoneInput').value), date_of_birth: parseDOB($('signupDobInput').value),
        preferred_language: language, privacy_notice_accepted: true
      };
      if (!registration.full_name) throw Error('VALIDATION_FAILED');
      if (pending?.email !== registration.email) { verifiedIdentity = false; if (password.length < 12 || password !== confirm) throw Error('VALIDATION_FAILED'); }
      pending = registration;
      try {
        if (verifiedIdentity) {
          success(await api('verify', {email: pending.email, code: '000000', registration: pending})); return;
        }
        await api('signup', {...registration, password, password_confirm: confirm});
        $('verifyTargetEmail').textContent = pending.email;
        resendAt = Date.now() + 60000; clearCode(); startOtpTimer();
        navigateToView('view-verify'); showToast('sent');
      } finally {
        $('signupPasswordInput').value = ''; $('signupPasswordConfirm').value = '';
      }
    });
  }
  function handleLoginSubmit(event) {
    event.preventDefault();
    return run(async () => {
      const identifier = mode === 'phone' ? normalizePhone($('loginPhoneInput').value) : $('loginEmailInput').value.trim().toLowerCase();
      try { success(await api('login', {identifier, password: $('loginPasswordInput').value})); window.location.assign('index.html'); }
      finally { $('loginPasswordInput').value = ''; }
    });
  }
  function handleOtpSubmit(event) {
    event.preventDefault();
    return run(async () => {
      if (!pending) throw Error('SESSION_EXPIRED');
      const code = [...$('otpContainer').querySelectorAll('input')].map(input => digits(input.value)).join('');
      clearCode(); if (!/^\d{6}$/.test(code)) throw Error('INVALID_CODE');
      success(await api('verify', {email: pending.email, code, registration: pending}));
    });
  }
  function handleResendCode() {
    if (Date.now() < resendAt || !pending) return;
    return run(async () => {
      await api('resend', {email: pending.email});
      resendAt = Date.now() + 60000; clearCode(); startOtpTimer(); showToast('sent');
    });
  }
  function switchLoginChannel(channel) {
    mode = channel;
    $('loginTabEmail').classList.toggle('active', channel === 'email');
    $('loginTabPhone').classList.toggle('active', channel === 'phone');
    $('loginEmailGroup').style.display = channel === 'email' ? 'flex' : 'none';
    $('loginPhoneGroup').style.display = channel === 'phone' ? 'flex' : 'none';
    $('loginEmailInput').required = channel === 'email'; $('loginPhoneInput').required = channel === 'phone';
  }
  function togglePasswordVisibility(id) { const input = $(id); input.type = input.type === 'password' ? 'text' : 'password'; }
  function handleForgotPassword(event) { event.preventDefault(); $('recoveryEmail').value = $('loginEmailInput').value; navigateToView('view-forgot'); }
  function handleRecoverySubmit(event) { event.preventDefault(); return run(async () => { await api('recover', {email: $('recoveryEmail').value.trim().toLowerCase()}); showToast('recovered'); }); }
  function handleResetSubmit(event) {
    event.preventDefault(); return run(async () => {
      try {
        await api('reset-password', {email: $('resetEmail').value.trim().toLowerCase(), password: $('resetPassword').value, password_confirm: $('resetPasswordConfirm').value});
        $('view-reset').dataset.ready = ''; authenticated = false; navigateToView('view-login'); showToast('reset');
      } finally { $('resetPassword').value = ''; $('resetPasswordConfirm').value = ''; }
    });
  }
  async function handleContinueToDashboard() { return run(async () => { await api('session'); window.location.assign('index.html'); }); }
  function handleGoogleLogin() { return run(async () => { const result = await api('google', {}); window.location.assign(result.url); }); }
  function handleHashRoute() {
    const view = window.location.hash.slice(1);
    navigateToView(['signup','verify','success','forgot','reset'].includes(view) ? 'view-' + view : 'view-login', false);
  }
  const translations = {
    'Your Health, Our Care':'صحتك ورعايتك عندنا', 'Need help?':'محتاج مساعدة؟', 'Welcome Back':'أهلاً بيك من جديد',
    'Access your healthcare, anytime':'خدمات عيادتك في أي وقت',
    'Log in to book appointments, manage your medical records, and chat with our AI assistant.':'سجّل دخولك للوصول لخدمات العيادة والمساعد الذكي.',
    'Book & manage appointments':'احجز وتابع مواعيدك', 'Access your medical records':'تابع بيانات حسابك',
    'Get instant help from our AI assistant':'اسأل المساعد الذكي', 'Log in to your account':'سجّل دخولك لحسابك',
    'Enter your email to continue to Nile Clinics.':'اكتب بريدك وكلمة السر علشان تدخل لعيادات النيل.',
    'Access your appointments, medical records, and 24/7 AI support.':'ادخل لحساب العيادة وخدمات المساعد الذكي.',
    'or continue with':'أو كمّل باستخدام', 'Continue with Google':'كمّل بجوجل',
    "Don't have an account?":'لسه معندكش حساب؟', 'Join Nile Clinics':'انضم لعيادات النيل',
    'Create your account to start booking appointments, access your records, and get 24/7 support.':'سجّل بياناتك علشان تبدأ تستخدم خدمات العيادة.',
    'Easy appointment booking':'حجز مواعيد بسهولة', 'Secure access to your medical records':'دخول آمن لحسابك',
    'AI assistant for instant help':'مساعد ذكي يجاوبك', 'Create your account':'اعمل حسابك',
    'Fill in your details to get started.':'اكتب بياناتك علشان تبدأ.',
    'Join Nile Clinics to book appointments, access your records, and get 24/7 support.':'انضم لعيادات النيل واستعمل خدمات العيادة.',
    'Terms of Service':'شروط الاستخدام', 'Privacy Policy':'سياسة الخصوصية', 'Already have an account?':'عندك حساب بالفعل؟',
    "Didn't receive the code?":'الكود موصلكش؟', 'You are signed in!':'سجّلت دخولك بنجاح!',
    'Your verified clinic account is ready. Keep your customer number for future visits.':'حسابك المتأكد جاهز. احتفظ برقم العميل للزيارات الجاية.',
    'Email':'البريد الإلكتروني','Phone':'الموبايل','Phone number':'رقم الموبايل','Email address':'البريد الإلكتروني',
    'Password':'كلمة السر','Confirm password':'تأكيد كلمة السر','Full name':'الاسم بالكامل','Date of birth':'تاريخ الميلاد',
    'Log In':'سجّل دخولك','Sign up':'إنشاء حساب','Log in':'سجّل دخولك','Create Account':'إنشاء حساب',
    'Forgot password?':'نسيت كلمة السر؟','Verify your email':'أكّد بريدك','Verify':'تأكيد','Resend code':'ابعت كود جديد',
    'Account created successfully!':'حسابك جاهز!','Continue to Dashboard':'كمّل للصفحة الرئيسية',
    'Reset your password':'غيّر كلمة السر','Send reset link':'ابعت لينك تغيير كلمة السر','New password':'كلمة السر الجديدة',
    'Save new password':'احفظ كلمة السر الجديدة','Back to login':'ارجع لتسجيل الدخول',
    'I agree to use these details to create my clinic account.':'موافق على استخدام البيانات دي لإنشاء حساب العيادة.'
  };
  function setLanguage() {
    language = language === 'en' ? 'ar' : 'en';
    document.documentElement.lang = language; document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
    $('authLanguage').textContent = language === 'ar' ? 'English' : 'العربية';
    document.querySelectorAll('[data-en]').forEach(node => { node.textContent = language === 'ar' ? node.dataset.ar : node.dataset.en; });
  }
  Object.assign(window, {openDobPicker,navigateToView,switchLoginChannel,togglePasswordVisibility,handleLoginSubmit,handleSignupSubmit,handleOtpSubmit,handleResendCode,handleContinueToDashboard,handleGoogleLogin,handleForgotPassword,handleRecoverySubmit,handleResetSubmit});
  window.PortalAuthUtils = {normalizePhone,parseDOB};
  document.addEventListener('DOMContentLoaded', async () => {
    try { localStorage.removeItem('clinic_patient_session'); } catch (_) {}
    $('authLanguage').addEventListener('click', setLanguage);
    document.querySelectorAll('label, h1, h2, p, span, button, a').forEach(node => {
      const text = node.textContent.trim();
      if (translations[text] && node.children.length === 0) { node.dataset.en = text; node.dataset.ar = translations[text]; }
    });
    const today = new Date();
    const isoDate = date => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
    $('signupDobInput').max = isoDate(new Date(today.getFullYear(), today.getMonth(), today.getDate()-1));
    $('signupDobInput').min = isoDate(new Date(today.getFullYear()-121, today.getMonth(), today.getDate()+1));
    const boxes = [...$('otpContainer').querySelectorAll('input')];
    boxes.forEach((input,index) => {
      input.addEventListener('input', () => { input.value = digits(input.value).replace(/\D/g,'').slice(0,1); if(input.value) boxes[index+1]?.focus(); });
      input.addEventListener('keydown', event => { if(event.key==='Backspace' && !input.value) boxes[index-1]?.focus(); });
      input.addEventListener('paste', event => { event.preventDefault(); const text=digits(event.clipboardData.getData('text')).replace(/\D/g,'').slice(0,6); boxes.forEach((box,i)=>{box.value=text[i]||'';}); boxes[Math.min(text.length,5)].focus(); });
    });
    const oauth = new URLSearchParams(window.location.search);
    if (oauth.has('code') || oauth.has('oauth_state') || oauth.has('error')) {
      history.replaceState(null, '', window.location.pathname);
      await run(async () => {
        if (!oauth.get('code') || !oauth.get('oauth_state') || oauth.has('error')) throw Error('VERIFICATION_REQUIRED');
        success(await api('google/exchange', {code: oauth.get('code'), state: oauth.get('oauth_state')}));
        window.location.assign('index.html');
      });
      return;
    }
    const callback = new URLSearchParams(window.location.hash.slice(1));
    if (callback.has('access_token') || callback.has('error')) {
      history.replaceState(null, '', window.location.pathname);
      if (callback.get('type') !== 'recovery' || !callback.get('access_token')) { navigateToView('view-forgot'); showToast('VERIFICATION_REQUIRED'); return; }
      await run(async () => { await api('recovery-session', {access_token: callback.get('access_token')}); $('view-reset').dataset.ready='true'; navigateToView('view-reset'); });
      return;
    }
    handleHashRoute();
    try { success(await api('session')); } catch (_) {}
    window.addEventListener('hashchange', handleHashRoute);
  });
})();

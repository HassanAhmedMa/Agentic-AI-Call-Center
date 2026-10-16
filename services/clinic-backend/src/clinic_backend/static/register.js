/* Auth tokens and form data stay in memory and never enter the agent context. */
let language = 'ar';
let conversationToken = null;
let pendingForm = null;
let statusKey = '';
let authConfig = null;
let accessToken = null;
let resendAt = 0;
let working = false;
let loginMode = false;
const messages = {
  sending: ['بنبعت طلبك…', 'Sending your request…'],
  pending: ['راجع بريدك واكتب الكود هنا.', 'Check your email and enter the code here.'],
  verified: ['بريدك اتأكد بنجاح.', 'Your email was verified.'],
  IDENTITY_CONFLICT: ['الحساب محتاج مراجعة من خدمة العيادة.', 'Please contact the clinic to recover this account.'],
  SESSION_EXPIRED: ['الجلسة انتهت. ابدأ تسجيل الدخول من جديد.', 'Your session expired. Sign in again.'],
  VALIDATION_FAILED: ['راجع البيانات المطلوبة: البريد، رقم الموبايل بكود البلد، وتاريخ الميلاد.', 'Check your email, international phone number, and date of birth.'],
  INVALID_CODE: ['الكود مش صحيح. راجعه وحاول تاني.', 'The code is incorrect. Check it and try again.'],
  CHALLENGE_EXPIRED: ['الكود انتهت صلاحيته. اطلب كود جديد.', 'The code expired. Request a new code.'],
  NO_PENDING_CHALLENGE: ['مفيش كود مستني التأكيد. اطلب كود جديد.', 'There is no pending code. Request a new one.'],
  RATE_LIMITED: ['طلبات كتير في وقت قصير. استنى قبل ما تحاول تاني.', 'Too many requests. Wait before trying again.'],
  CONVERSATION_INVALID: ['الجلسة انتهت. حدّث الصفحة وابدأ من جديد.', 'Your session ended. Reload the page and start again.'],
  unavailable: ['الخدمة مش متاحة دلوقتي. حاول تاني بعد شوية.', 'The service is unavailable. Try again shortly.']
};
function status(key) {
  statusKey = key;
  document.querySelector('#status').textContent = (messages[key] || messages.unavailable)[language === 'ar' ? 0 : 1];
}
document.querySelector('#language').addEventListener('click', () => {
  language = language === 'ar' ? 'en' : 'ar';
  document.documentElement.lang = language;
  document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
  document.querySelector('#language').textContent = language === 'ar' ? 'English' : 'العربية';
  document.querySelectorAll('[data-ar]').forEach(node => { node.textContent = node.dataset[language]; });
  if (statusKey) status(statusKey);
});
async function api(path, body, token = null) {
  const headers = {'Content-Type': 'application/json'};
  if (conversationToken) headers['X-Conversation-Token'] = conversationToken;
  if (token) headers.Authorization = 'Bearer ' + token;
  const response = await fetch('/api/v1/' + path, {method: 'POST', headers, body: JSON.stringify(body), cache: 'no-store'});
  const result = response.status === 204 ? {} : await response.json();
  if (!response.ok) {
    const error = new Error(result.error?.code || 'unavailable');
    error.details = result.error?.details;
    throw error;
  }
  return result;
}
async function busy(action) {
  if (working) return;
  working = true;
  document.querySelectorAll('button').forEach(button => { button.disabled = true; });
  status('sending');
  try { await action(); } catch (error) {
    status(error.message);
    if (accessToken && ['VALIDATION_FAILED', 'REGISTRATION_REQUIRED'].includes(error.message)) {
      document.querySelector('#registration').hidden = false;
      document.querySelector('#verification').hidden = true;
      if (loginMode) toggleMode();
    }
    if (error.message === 'CHALLENGE_EXPIRED' || error.message === 'VERIFICATION_REQUIRED' || error.message === 'SESSION_EXPIRED' || error.message === 'CONVERSATION_INVALID' ||
        (error.message === 'INVALID_CODE' && error.details?.attempts_remaining === 0)) {
      pendingForm = null;
      accessToken = null;
      document.querySelector('#code').value = '';
      document.querySelector('#registration').reset();
      document.querySelector('#registration').hidden = false;
      document.querySelector('#mode').hidden = authConfig?.provider !== 'supabase';
      document.querySelector('#verification').hidden = true;
      if (error.message === 'CONVERSATION_INVALID') conversationToken = null;
    }
  }
  finally {
    working = false;
    document.querySelectorAll('button').forEach(button => { button.disabled = false; });
    document.querySelector('#resend').disabled = Date.now() < resendAt;
  }
}
async function loadAuthConfig() {
  if (authConfig) return authConfig;
  const response = await fetch('/api/v1/auth/config', {cache: 'no-store'});
  if (!response.ok) throw new Error('unavailable');
  authConfig = await response.json();
  if (!['clinic', 'supabase'].includes(authConfig.provider)) throw new Error('unavailable');
  const length = authConfig.otp_length || 6;
  const input = document.querySelector('#code');
  input.minLength = length; input.maxLength = length; input.pattern = `[0-9]{${length}}`;
  return authConfig;
}
async function supabase(path, body) {
  const config = await loadAuthConfig();
  const response = await fetch(config.url + '/auth/v1/' + path, {
    method: 'POST', headers: {'Content-Type': 'application/json', apikey: config.public_key},
    body: JSON.stringify(body), cache: 'no-store', redirect: 'error'
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(response.status === 429 ? 'RATE_LIMITED' : path === 'verify' ? 'INVALID_CODE' : 'unavailable');
  return result;
}
document.querySelector('#code').addEventListener('input', event => {
  event.target.value = event.target.value.replace(/[٠-٩]/g, digit => String(digit.charCodeAt(0) - 1632))
    .replace(/[۰-۹]/g, digit => String(digit.charCodeAt(0) - 1776));
});
setInterval(() => {
  document.querySelector('#resend').disabled = working || Date.now() < resendAt;
}, 1000);
async function requestCode() {
  const config = await loadAuthConfig();
  if (!conversationToken) {
    conversationToken = (await api('conversations', {channel: 'text'})).conversation_token;
  }
  if (config.provider === 'supabase') {
    if (Date.now() < resendAt) throw new Error('RATE_LIMITED');
    if (accessToken) {
      // Verification succeeded earlier; retry profile completion without sending another OTP.
      return completeSupabase();
    }
    await supabase('otp', {email: pendingForm.email.trim().toLowerCase(), create_user: !loginMode});
    resendAt = Date.now() + 60000;
  } else {
    await api('registrations', pendingForm);
  }
  document.querySelector('#registration').hidden = true;
  document.querySelector('#mode').hidden = true;
  document.querySelector('#verification').hidden = false;
  document.querySelector('#code').value = '';
  document.querySelector('#code').focus();
  status('pending');
}
document.querySelector('#registration').addEventListener('submit', event => {
  event.preventDefault();
  const form = new FormData(event.target);
  const previousEmail = pendingForm?.email?.trim().toLowerCase();
  if (accessToken && previousEmail !== String(form.get('email')).trim().toLowerCase()) accessToken = null;
  pendingForm = {full_name: form.get('full_name'), email: form.get('email'), phone: form.get('phone'), date_of_birth: form.get('date_of_birth'), preferred_language: language, privacy_notice_accepted: form.get('privacy_notice_accepted') === 'on'};
  busy(requestCode);
});
async function completeSupabase() {
  const result = await api(loginMode ? 'auth/bind' : 'auth/complete', loginMode ? {} : pendingForm, accessToken);
  showSuccess(result);
}
function showSuccess(result) {
  document.querySelector('#code').value = '';
  document.querySelector('#registration').reset();
  pendingForm = null;
  document.querySelector('#verification').hidden = true;
  document.querySelector('#success').hidden = false;
  document.querySelector('#number').textContent = result.customer_number;
  const successHeading = document.querySelector('#success h2');
  successHeading.dataset.ar = loginMode ? 'أهلاً بيك من جديد' : 'حسابك اتسجل';
  successHeading.dataset.en = loginMode ? 'Welcome back' : 'Your account is registered';
  successHeading.textContent = successHeading.dataset[language];
  document.querySelector('#logout').hidden = !accessToken;
  status('verified');
}
function toggleMode() {
  loginMode = !loginMode;
  for (const name of ['full_name','phone','date_of_birth','privacy_notice_accepted']) {
    const input = document.querySelector(`[name="${name}"]`);
    input.required = !loginMode;
    input.closest('label').hidden = loginMode;
  }
  document.querySelector('.privacy').hidden = loginMode;
  const heading = document.querySelector('h1');
  heading.dataset.ar = loginMode ? 'سجّل دخولك' : 'سجّل حسابك';
  heading.dataset.en = loginMode ? 'Sign in to your account' : 'Create your account';
  heading.textContent = heading.dataset[language];
  const toggle = document.querySelector('#mode');
  toggle.dataset.ar = loginMode ? 'إنشاء حساب جديد' : 'عندي حساب بالفعل';
  toggle.dataset.en = loginMode ? 'Create a new account' : 'I already have an account';
  toggle.textContent = toggle.dataset[language];
}
document.querySelector('#mode').addEventListener('click', toggleMode);
loadAuthConfig().then(config => {
  document.querySelector('#mode').hidden = config.provider !== 'supabase';
}).catch(() => status('unavailable'));
document.querySelector('#logout').addEventListener('click', () => busy(async () => {
  await api('auth/logout', {}, accessToken);
  accessToken = null; conversationToken = null;
  document.querySelector('#success').hidden = true;
  document.querySelector('#registration').hidden = false;
  document.querySelector('#mode').hidden = authConfig?.provider !== 'supabase';
  statusKey = ''; document.querySelector('#status').textContent = '';
}));
document.querySelector('#resend').addEventListener('click', () => busy(requestCode));
document.querySelector('#code-form').addEventListener('submit', event => {
  event.preventDefault();
  busy(async () => {
    const code = document.querySelector('#code').value;
    document.querySelector('#code').value = '';
    const config = await loadAuthConfig();
    if (config.provider === 'supabase') {
      if (!accessToken) {
        const session = await supabase('verify', {email: pendingForm.email.trim().toLowerCase(), token: code, type: 'email'});
        if (!session.access_token) throw new Error('unavailable');
        accessToken = session.access_token;
        resendAt = 0;
      }
      await completeSupabase();
    } else {
      showSuccess(await api('verification/verify', {purpose: 'registration', code}));
    }
  });
});

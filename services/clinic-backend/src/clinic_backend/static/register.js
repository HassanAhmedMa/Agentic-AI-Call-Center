/* Forms and codes go directly to the backend; no agent credentials or SDK. */
let language = 'ar';
let conversationToken = null;
let pendingForm = null;
let statusKey = '';
const messages = {
  sending: ['بنبعت طلبك…', 'Sending your request…'],
  pending: ['راجع بريدك واكتب الكود هنا.', 'Check your email and enter the code here.'],
  verified: ['بريدك اتأكد بنجاح.', 'Your email was verified.'],
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
async function api(path, body) {
  const headers = {'Content-Type': 'application/json'};
  if (conversationToken) headers['X-Conversation-Token'] = conversationToken;
  const response = await fetch('/api/v1/' + path, {method: 'POST', headers, body: JSON.stringify(body), cache: 'no-store'});
  const result = await response.json();
  if (!response.ok) {
    const error = new Error(result.error?.code || 'unavailable');
    error.details = result.error?.details;
    throw error;
  }
  return result;
}
async function busy(action) {
  document.querySelectorAll('button').forEach(button => { button.disabled = true; });
  status('sending');
  try { await action(); } catch (error) {
    status(error.message);
    if (error.message === 'CHALLENGE_EXPIRED' || error.message === 'CONVERSATION_INVALID' ||
        (error.message === 'INVALID_CODE' && error.details?.attempts_remaining === 0)) {
      pendingForm = null;
      document.querySelector('#code').value = '';
      document.querySelector('#registration').reset();
      document.querySelector('#registration').hidden = false;
      document.querySelector('#verification').hidden = true;
      if (error.message === 'CONVERSATION_INVALID') conversationToken = null;
    }
  }
  finally { document.querySelectorAll('button').forEach(button => { button.disabled = false; }); }
}
async function requestCode() {
  if (!conversationToken) {
    conversationToken = (await api('conversations', {channel: 'text'})).conversation_token;
  }
  await api('registrations', pendingForm);
  document.querySelector('#registration').hidden = true;
  document.querySelector('#verification').hidden = false;
  document.querySelector('#code').value = '';
  document.querySelector('#code').focus();
  status('pending');
}
document.querySelector('#registration').addEventListener('submit', event => {
  event.preventDefault();
  const form = new FormData(event.target);
  pendingForm = {full_name: form.get('full_name'), email: form.get('email'), phone: form.get('phone'), date_of_birth: form.get('date_of_birth'), preferred_language: language, privacy_notice_accepted: form.get('privacy_notice_accepted') === 'on'};
  busy(requestCode);
});
document.querySelector('#resend').addEventListener('click', () => busy(requestCode));
document.querySelector('#code-form').addEventListener('submit', event => {
  event.preventDefault();
  busy(async () => {
    const code = document.querySelector('#code').value;
    document.querySelector('#code').value = '';
    const result = await api('verification/verify', {purpose: 'registration', code});
    document.querySelector('#code').value = '';
    document.querySelector('#registration').reset();
    pendingForm = null;
    document.querySelector('#verification').hidden = true;
    document.querySelector('#success').hidden = false;
    document.querySelector('#number').textContent = result.customer_number;
    status('verified');
  });
});

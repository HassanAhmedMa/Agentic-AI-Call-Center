/**
 * Nile Clinics - AI Assistant Chat Page Controller
 * Interactive Conversational Interface with Egyptian Arabic (العامية المصرية) support
 */

(function () {
  'use strict';

  function scrollToBottom(smooth = false) {
    const stream = document.getElementById('chatMessages');
    if (!stream) return;
    try {
      if (smooth && typeof stream.scrollTo === 'function') {
        stream.scrollTo({ top: stream.scrollHeight, behavior: 'smooth' });
      } else {
        stream.scrollTop = stream.scrollHeight;
      }
    } catch (_) {
      stream.scrollTop = stream.scrollHeight;
    }
  }
  window.scrollChatToBottom = scrollToBottom;

  function appendChatUserMessage(text) {
    const stream = document.getElementById('chatMessages');
    if (!stream) return;
    const isAr = /[\u0600-\u06FF]/.test(text);

    const initials = (window.ClinicSession && (window.ClinicSession.full_name || window.ClinicSession.first_name))
      ? (window.ClinicSession.full_name || window.ClinicSession.first_name).split(' ').filter(Boolean).map(n => n[0]).join('').substring(0, 2).toUpperCase()
      : 'U';

    const row = document.createElement('div');
    row.className = 'msg-bubble-row user-row';
    row.innerHTML = `
      <div class="msg-balloon-wrapper">
        <div class="balloon-card user-balloon">
          <span class="${isAr ? 'arabic-text' : ''}">${escapeHtml(text)}</span>
        </div>
        <div class="msg-timestamp">
          <span>${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          <svg viewBox="0 0 24 24" fill="none" stroke="#2563EB" stroke-width="2.3" width="14" height="14"><path d="M18 6 7 17l-5-5"/><path d="m22 10-7.5 7.5L13 16"/></svg>
        </div>
      </div>
      <div class="msg-avatar-user">${initials}</div>
    `;
    stream.appendChild(row);
    scrollToBottom(true);
  }

  function appendChatBotMessage(html) {
    const stream = document.getElementById('chatMessages');
    if (!stream) return;

    const row = document.createElement('div');
    row.className = 'msg-bubble-row bot-row';
    row.innerHTML = `
      <div class="msg-avatar-bot">
        <svg viewBox="0 0 32 32" fill="none"><rect x="5" y="7" width="22" height="18" rx="6" fill="#2563EB"/><circle cx="11.5" cy="14.5" r="2.5" fill="#FFFFFF"/><circle cx="20.5" cy="14.5" r="2.5" fill="#FFFFFF"/></svg>
      </div>
      <div class="msg-balloon-wrapper">
        <div class="balloon-card bot-balloon">
          ${html}
        </div>
        <div class="msg-timestamp">${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
      </div>
    `;
    stream.appendChild(row);
    scrollToBottom(true);
  }

  window.sendChatMessage = function () {
    const input = document.getElementById('chatTextInput');
    if (!input) return;
    const text = input.value.trim();
    if (!text) return;

    appendChatUserMessage(text);
    input.value = '';

    setTimeout(() => {
      generateChatBotReply(text);
    }, 400);
  };

  function generateChatBotReply(text) {
    const isAr = (window.getCurrentLang && window.getCurrentLang() === 'ar') || /[\u0600-\u06FF]/.test(text);
    const lower = text.toLowerCase();

    if (lower.includes('حجز') || lower.includes('دكتور') || lower.includes('book') || lower.includes('appointment')) {
      appendChatBotMessage(`
        <p>${isAr ? 'أكيد يا فندم! متاح كشوفات عند دكتور أحمد محمد في قسم القلب يوم الخميس في فرع مصر الجديدة:' : 'Certainly! We have openings for cardiology consultations with Dr. Ahmed Mohamed on Thursday in Heliopolis branch:'}</p>
        <div class="chat-slots-pills-row">
          <button class="slot-pill-btn" onclick="selectSlotFromChat('Dr. Ahmed Mohamed', '2:00 PM')">2:00 PM</button>
          <button class="slot-pill-btn" onclick="selectSlotFromChat('Dr. Ahmed Mohamed', '2:30 PM')">2:30 PM</button>
          <button class="slot-pill-btn" onclick="selectSlotFromChat('Dr. Ahmed Mohamed', '3:30 PM')">3:30 PM</button>
          <button class="slot-pill-btn" onclick="selectSlotFromChat('Dr. Ahmed Mohamed', '4:00 PM')">4:00 PM</button>
        </div>
      `);
    } else if (lower.includes('عنوان') || lower.includes('فرع') || lower.includes('location') || lower.includes('branch')) {
      appendChatBotMessage(`
        <p><strong>${isAr ? 'فروع عيادات النيل:' : 'Nile Clinics Branches:'}</strong></p>
        <ul style="margin:6px 0 6px 14px; font-size:13px; line-height:1.5;">
          <li><strong>${isAr ? 'فرع مصر الجديدة:' : 'Heliopolis:'}</strong> 14 شارع الثورة، بجوار ميدان الكوربة.</li>
          <li><strong>${isAr ? 'فرع مدينة نصر:' : 'Nasr City:'}</strong> 22 شارع عباس العقاد.</li>
        </ul>
      `);
    } else if (lower.includes('مواعيد') || lower.includes('hours') || lower.includes('working')) {
      appendChatBotMessage(`
        <p><strong>${isAr ? 'مواعيد العمل الرسمية:' : 'Clinic Working Hours:'}</strong></p>
        <p style="font-size:13px; margin-top:4px;">
          ${isAr ? 'من السبت إلى الخميس: 9:00 ص – 10:00 م<br>الجمعة: 1:00 م – 9:00 م<br>قسم الطوارئ والإسعاف يعمل 24 ساعة يومياً.' : 'Saturday – Thursday: 9:00 AM – 10:00 PM<br>Friday: 1:00 PM – 9:00 PM<br>Emergency Care is available 24/7.'}
        </p>
      `);
    } else {
      appendChatBotMessage(`
        <p>${isAr ? `استلمت استفسارك: "<em>${escapeHtml(text)}</em>". أقدر أساعد حضرتك في حجز كشف طبي، معرفة مواعيد الأطباء، أو الإجابة عن خدمات عيادات النيل.` : `Thank you! I received your inquiry: "<em>${escapeHtml(text)}</em>". I can help you schedule consultations, look up available doctors, or provide information about clinic services.`}</p>
      `);
    }
  }

  window.selectSlotFromChat = function (doctorName, timeStr) {
    const isAr = window.getCurrentLang && window.getCurrentLang() === 'ar';
    appendChatUserMessage(isAr ? `احجز لي ميعاد الساعة ${timeStr} مع ${doctorName}` : `Book my slot for ${timeStr} with ${doctorName}`);
    setTimeout(() => {
      appendChatBotMessage(`
        <div style="background:#ECFDF5; border:1px solid #A7F3D0; border-radius:8px; padding:10px 12px; color:#065F46;">
          <strong>${isAr ? 'تم تأكيد حجز الميعاد بنجاح!' : 'Consultation Confirmed!'}</strong><br>
          ${isAr ? `تم تسجيل كشفك مع ${doctorName} الساعة ${timeStr}. تقدري تراجعيه في صفحة "مواعيدي".` : `Your appointment with ${doctorName} at ${timeStr} has been scheduled. You can manage it from the Appointments tab.`}
        </div>
      `);
      showToast(isAr ? `تم تأكيد حجزك مع ${doctorName}` : `Booked with ${doctorName}`, 'success');
    }, 450);
  };

  window.resetChat = function () {
    const stream = document.getElementById('chatMessages');
    if (!stream) return;
    const isAr = window.getCurrentLang && window.getCurrentLang() === 'ar';
    const patientName = (window.ClinicSession && (window.ClinicSession.first_name || window.ClinicSession.full_name?.split(' ')[0])) || '';
    const greetingLead = patientName 
      ? (isAr ? `أهلاً بك يا ${patientName}!` : `Hello ${patientName}!`)
      : (isAr ? 'أهلاً بك في عيادات النيل!' : 'Welcome to Nile Clinics!');

    stream.innerHTML = `
      <div class="msg-bubble-row bot-row">
        <div class="msg-avatar-bot">
          <svg viewBox="0 0 32 32" fill="none"><rect x="5" y="7" width="22" height="18" rx="6" fill="#2563EB"/><circle cx="11.5" cy="14.5" r="2.5" fill="#FFFFFF"/><circle cx="20.5" cy="14.5" r="2.5" fill="#FFFFFF"/></svg>
        </div>
        <div class="msg-balloon-wrapper">
          <div class="balloon-card bot-balloon">
            <p class="greeting-lead">${greetingLead}</p>
            <p class="sub-lead">${isAr ? 'أنا المساعد الذكي لعيادات النيل، أقدر أساعدك في إيه النهاردة؟' : "I'm the Nile Clinics AI Assistant. How can I assist you today?"}</p>
          </div>
          <div class="msg-timestamp">${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
        </div>
      </div>
    `;
    showToast(isAr ? 'تم بدء محادثة جديدة' : 'New chat started', 'info');
  };

  // Voice Call Simulation
  window.startVoiceCall = function () {
    const overlay = document.getElementById('voiceCallOverlay');
    if (overlay) overlay.classList.add('active');
  };

  window.endVoiceCall = function () {
    const overlay = document.getElementById('voiceCallOverlay');
    if (overlay) overlay.classList.remove('active');
  };

  window.toggleMuteVoice = function (btn) {
    const isMuted = btn.classList.toggle('muted');
    const isAr = window.getCurrentLang && window.getCurrentLang() === 'ar';
    btn.querySelector('span').textContent = isMuted ? (isAr ? 'صامت' : 'Muted') : (isAr ? 'كتم الصوت' : 'Mute');
  };

  document.addEventListener('DOMContentLoaded', () => {
    const input = document.getElementById('chatTextInput');
    if (input) {
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          sendChatMessage();
        }
      });
    }

    // Auto-scroll to latest message on page entry
    scrollToBottom(false);
    setTimeout(() => scrollToBottom(false), 60);
    setTimeout(() => scrollToBottom(false), 250);
  });

  window.addEventListener('load', () => scrollToBottom(false));
  window.addEventListener('pageshow', () => scrollToBottom(false));
})();

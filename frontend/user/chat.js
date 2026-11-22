/**
 * Shiffaa Clinics - AI Assistant Chat Page Controller
 * Interactive Conversational Interface with Multi-Thread Sessions, Auto-Titling & Egyptian Arabic support
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

  /* =========================================================================
     MULTI-CONVERSATION THREAD MANAGER
     ========================================================================= */
  let THREADS_STORAGE_KEY = null;
  let conversationHistory = [];

  function getThreadsData() {
    try {
      const raw = THREADS_STORAGE_KEY && localStorage.getItem(THREADS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.threads) && parsed.threads.length > 0) {
          return parsed;
        }
      }
    } catch (_) {}

    const isAr = window.getCurrentLang && window.getCurrentLang() === 'ar';
    const initialId = 'thread_' + Date.now() + '_' + Math.random().toString(36).slice(2);
    const initialData = {
      activeId: initialId,
      threads: [
        {
          id: initialId,
          title: isAr ? 'محادثة جديدة' : 'New Conversation',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          messages: []
        }
      ]
    };
    saveThreadsData(initialData);
    return initialData;
  }

  function saveThreadsData(data) {
    try {
      if (THREADS_STORAGE_KEY) localStorage.setItem(THREADS_STORAGE_KEY, JSON.stringify(data));
    } catch (_) {}
    updateThreadsCountBadge(data);
  }

  function updateThreadsCountBadge(data) {
    const badge = document.getElementById('chatThreadsCount');
    if (badge && data && Array.isArray(data.threads)) {
      badge.textContent = String(data.threads.length);
    }
  }

  function getActiveThread() {
    const data = getThreadsData();
    let active = data.threads.find(t => t.id === data.activeId);
    if (!active) {
      active = data.threads[0];
      data.activeId = active.id;
      saveThreadsData(data);
    }
    return active;
  }

  function formatRelativeTime(ts) {
    if (!ts) return '';
    const now = Date.now();
    const diffSec = Math.floor((now - ts) / 1000);
    const isAr = window.getCurrentLang && window.getCurrentLang() === 'ar';

    if (diffSec < 60) return isAr ? 'الآن' : 'Just now';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return isAr ? `منذ ${diffMin} د` : `${diffMin}m ago`;
    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) return isAr ? `منذ ${diffHour} س` : `${diffHour}h ago`;
    const diffDays = Math.floor(diffHour / 24);
    if (diffDays === 1) return isAr ? 'أمس' : 'Yesterday';
    return new Date(ts).toLocaleDateString([], { month: 'short', day: 'numeric' });
  }

  function renderThreadsList() {
    const container = document.getElementById('chatThreadsList');
    if (!container) return;
    const data = getThreadsData();
    const isAr = window.getCurrentLang && window.getCurrentLang() === 'ar';

    container.innerHTML = '';
    if (data.threads.length === 0) {
      container.innerHTML = `<div style="text-align:center; padding:30px 10px; color:var(--text-muted); font-size:13px;">${isAr ? 'لا توجد محادثات سابقة' : 'No conversations yet'}</div>`;
      return;
    }

    data.threads.forEach(thread => {
      const isActive = thread.id === data.activeId;
      const item = document.createElement('div');
      item.className = `thread-item ${isActive ? 'active' : ''}`;
      item.onclick = () => window.switchConversation(thread.id);

      item.innerHTML = `
        <div class="thread-info">
          <span class="thread-title" title="${escapeHtml(thread.title)}">${escapeHtml(thread.title)}</span>
          <span class="thread-time">${formatRelativeTime(thread.updatedAt || thread.createdAt)}</span>
        </div>
        <button class="thread-delete-btn" title="${isAr ? 'حذف المحادثة' : 'Delete conversation'}" onclick="window.deleteConversation('${thread.id}', event)">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
          </svg>
        </button>
      `;
      container.appendChild(item);
    });
  }

  window.toggleThreadsDrawer = function (force) {
    const drawer = document.getElementById('chatThreadsDrawer');
    const backdrop = document.getElementById('chatThreadsBackdrop');
    if (!drawer) return;

    const isOpen = drawer.classList.contains('open');
    const next = typeof force === 'boolean' ? force : !isOpen;

    if (next) {
      renderThreadsList();
      drawer.classList.add('open');
      if (backdrop) backdrop.classList.add('open');
    } else {
      drawer.classList.remove('open');
      if (backdrop) backdrop.classList.remove('open');
    }
  };

  window.createNewConversation = function () {
    if (chatSending) return;
    const data = getThreadsData();
    const isAr = window.getCurrentLang && window.getCurrentLang() === 'ar';
    const newId = 'thread_' + Date.now() + '_' + Math.random().toString(36).slice(2);
    const newThread = {
      id: newId,
      title: isAr ? 'محادثة جديدة' : 'New Conversation',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messages: []
    };
    data.threads.unshift(newThread);
    data.activeId = newId;
    saveThreadsData(data);

    conversationHistory = [];
    renderInitialGreeting();
    renderThreadsList();
    window.toggleThreadsDrawer(false);

    const input = document.getElementById('chatTextInput');
    if (input) {
      input.value = '';
      input.focus();
    }
    if (typeof showToast === 'function') {
      showToast(isAr ? 'تم بدء محادثة جديدة' : 'New chat started', 'info');
    }
  };

  window.switchConversation = function (threadId) {
    if (chatSending) return;
    const data = getThreadsData();
    const target = data.threads.find(t => t.id === threadId);
    if (!target) return;

    data.activeId = threadId;
    saveThreadsData(data);

    loadThreadMessages(target);
    renderThreadsList();
    window.toggleThreadsDrawer(false);

    const input = document.getElementById('chatTextInput');
    if (input) input.focus();
  };

  window.deleteConversation = function (threadId, e) {
    if (chatSending) return;
    if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
    const data = getThreadsData();
    const isAr = window.getCurrentLang && window.getCurrentLang() === 'ar';

    data.threads = data.threads.filter(t => t.id !== threadId);
    if (data.threads.length === 0) {
      const newId = 'thread_' + Date.now() + '_' + Math.random().toString(36).slice(2);
      data.threads = [{
        id: newId,
        title: isAr ? 'محادثة جديدة' : 'New Conversation',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        messages: []
      }];
      data.activeId = newId;
    } else if (data.activeId === threadId) {
      data.activeId = data.threads[0].id;
    }

    saveThreadsData(data);
    const active = getActiveThread();
    loadThreadMessages(active);
    renderThreadsList();

    if (typeof showToast === 'function') {
      showToast(isAr ? 'تم حذف المحادثة' : 'Conversation deleted', 'info');
    }
  };

  function renderInitialGreeting() {
    const stream = document.getElementById('chatMessages');
    if (!stream) return;
    const isAr = window.getCurrentLang && window.getCurrentLang() === 'ar';
    const patientName = (window.ClinicSession && (window.ClinicSession.first_name || window.ClinicSession.full_name?.split(' ')[0])) || '';
    const greetingLead = patientName 
      ? (isAr ? `أهلاً ${patientName}!` : `Hello ${patientName}!`)
      : (isAr ? 'أهلاً بحضرتك!' : 'Hello!');

    stream.innerHTML = `
      <div class="msg-bubble-row bot-row">
        <div class="msg-avatar-bot">
          <svg height="18" width="18" viewBox="0 0 32 32" fill="none">
            <rect x="5" y="7" width="22" height="18" rx="6" fill="#2563EB"/>
            <circle cx="11.5" cy="14.5" r="2.5" fill="#FFFFFF"/>
            <circle cx="20.5" cy="14.5" r="2.5" fill="#FFFFFF"/>
          </svg>
        </div>
        <div class="msg-balloon-wrapper">
          <div class="balloon-card bot-balloon">
            <p class="greeting-lead"><span id="chatGreetingLead">${greetingLead}</span></p>
            <p class="sub-lead" data-i18n="chat_greeting_body">${isAr ? 'أهلاً بك في عيادات شفاء، يسعدنا مساعدتك في:' : "Welcome to Shiffaa Clinics. We're here to assist you with:"}</p>
            <ul class="capability-list">
              <li>
                <svg height="18" viewBox="0 0 24 24" fill="none" stroke="#2563EB" stroke-width="2"><rect width="18" height="18" x="3" y="4" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                <span data-i18n="cap_1">${isAr ? 'حجز وتعديل وإلغاء مواعيد الكشف' : 'Booking, rescheduling, or canceling appointments'}</span>
              </li>
              <li>
                <svg height="18" viewBox="0 0 24 24" fill="none" stroke="#2563EB" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                <span data-i18n="cap_2">${isAr ? 'معرفة مواعيد الأطباء وأوقات عمل الفروع' : 'Checking doctor schedules and branch hours'}</span>
              </li>
              <li>
                <svg height="18" viewBox="0 0 24 24" fill="none" stroke="#2563EB" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                <span data-i18n="cap_3">${isAr ? 'الإجابة عن فروع وأسعار العيادات' : 'Answering questions about our services or policies'}</span>
              </li>
              <li>
                <svg height="18" viewBox="0 0 24 24" fill="none" stroke="#2563EB" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                <span data-i18n="cap_4">${isAr ? 'فتح طلب دعم فوري لمتابعة حالتك' : 'Creating support requests if you need further help'}</span>
              </li>
            </ul>
            <p class="closing-lead" data-i18n="chat_how_assist">${isAr ? 'أقدر أساعد حضرتك بإيه النهاردة؟' : 'How can I help you today?'}</p>
          </div>
          <div class="msg-timestamp" id="greetingTimestamp">${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
        </div>
      </div>
    `;
  }

  function loadThreadMessages(thread) {
    renderInitialGreeting();
    conversationHistory = [];

    if (!thread || !Array.isArray(thread.messages)) return;

    thread.messages.forEach(msg => {
      if (msg.role === 'user') {
        appendChatUserMessage(msg.content, msg.timestamp);
        conversationHistory.push({ role: 'user', content: msg.content });
      } else if (msg.role === 'assistant') {
        appendChatBotStaticMessage(msg.content, msg.widget, msg.timestamp);
        conversationHistory.push({ role: 'assistant', content: msg.content });
      }
    });

    scrollToBottom(false);
  }

  function appendChatUserMessage(text, customTime) {
    const stream = document.getElementById('chatMessages');
    if (!stream) return;
    const isAr = /[\u0600-\u06FF]/.test(text);

    const initials = (window.ClinicSession && (window.ClinicSession.full_name || window.ClinicSession.first_name))
      ? (window.ClinicSession.full_name || window.ClinicSession.first_name).split(' ').filter(Boolean).map(n => n[0]).join('').substring(0, 2).toUpperCase()
      : 'U';

    const timeStr = customTime || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const row = document.createElement('div');
    row.className = 'msg-bubble-row user-row';
    row.innerHTML = `
      <div class="msg-balloon-wrapper">
        <div class="balloon-card user-balloon">
          <span class="${isAr ? 'arabic-text' : ''}">${escapeHtml(text)}</span>
        </div>
        <div class="msg-timestamp">
          <span>${timeStr}</span>
          <svg viewBox="0 0 24 24" fill="none" stroke="#2563EB" stroke-width="2.3" width="14" height="14"><path d="M18 6 7 17l-5-5"/><path d="m22 10-7.5 7.5L13 16"/></svg>
        </div>
      </div>
      <div class="msg-avatar-user">${initials}</div>
    `;
    stream.appendChild(row);
    scrollToBottom(true);
  }

  function prettyDate(value) {
    if (!value) return '';
    const parsed = new Date(value + 'T12:00:00Z');
    if (Number.isNaN(parsed.getTime())) return value;
    const ar = window.getCurrentLang && window.getCurrentLang() === 'ar';
    return new Intl.DateTimeFormat(ar ? 'ar-EG' : 'en-GB', {day:'numeric',month:'short',year:'numeric',timeZone:'Africa/Cairo'}).format(parsed);
  }

  function renderSavedAction(container, data) {
    const isAr = window.getCurrentLang && window.getCurrentLang() === 'ar';
    const card = document.createElement('div');
    card.className = data.type === 'appointment_success' ? 'chat-action-success' : 'chat-booking-summary';
    const title = document.createElement('strong');
    const selected = data.selection || {};
    title.textContent = data.type === 'action_proposal'
      ? `${prettyDate(selected.date)} · ${selected.start_time || ''}`
      : '✓ ' + ({book:'Appointment booked',reschedule:'Appointment rescheduled',cancel:'Appointment cancelled'}[data.operation] || 'Appointment updated');
    card.appendChild(title);
    if (selected.doctor) {
      const identity = document.createElement('div');
      identity.className = 'chat-action-doctor';
      const doctorName = isAr ? selected.doctor.name_ar : selected.doctor.name_en;
      const specialty = selected.doctor.specialty || {};
      identity.textContent = doctorName + ' · ' + (isAr ? specialty.name_ar || '' : specialty.name_en || '');
      card.insertBefore(identity, title);
    }
    if (data.type === 'action_proposal') {
      const confirm = document.createElement('button');
      confirm.className = 'chat-doc-book-btn';
      confirm.textContent = (isAr ? 'تأكيد ' : 'Confirm ') + ({book:'booking',reschedule:'reschedule',cancel:'cancellation'}[selected.operation] || 'booking') + (selected.doctor ? ' · ' + (isAr ? selected.doctor.name_ar : selected.doctor.name_en) : '') + (selected.start_time ? ` · ${selected.start_time}` : '');
      confirm.onclick = () => {
        if (chatSending) return;
        confirm.disabled = true;
        confirm.textContent = isAr ? 'جارٍ التأكيد…' : 'Confirming…';
        document.getElementById('chatTextInput').value = 'Yes, please proceed with the pending action.';
        window.sendChatMessage({confirmationId: data.confirmation_id});
      };
      card.appendChild(confirm);
    }
    if (data.next_action) {
      const next = document.createElement('button');
      next.className = 'chat-doc-book-btn';
      next.textContent = (isAr ? 'متابعة تعديل الموعد: ' : 'Continue reschedule: ') + (data.next_action.doctor_name || '') + ' · ' + prettyDate(data.next_action.date) + ' · ' + data.next_action.start_time;
      next.onclick = () => {
        document.getElementById('chatTextInput').value = `Please propose rescheduling appointment ${data.next_action.appointment_id} to ${data.next_action.date} at ${data.next_action.start_time}.`;
        window.sendChatMessage();
      };
      card.appendChild(next);
    }
    const link = document.createElement('a');link.href='appointments.html';link.textContent=isAr?'عرض مواعيدي':'View my appointments';card.appendChild(link);
    container.appendChild(card);
  }


  function restoreWidget(container, widget) {
    const lang = (window.getCurrentLang && window.getCurrentLang()) || 'en';
    const data = widget;
    const botSlots = {widgetContainer:container};
    if (widget.type === 'bundle') {
      for (const item of widget.widgets || []) restoreWidget(container, item);
    } else if (widget.type === 'doctor_cards') {
      renderChatDoctorCards(container, widget.doctors);
    } else if (widget.type === 'doctor_recommendations') {
          const host = botSlots.widgetContainer.querySelector(`[data-doctor-id="${Number(data.doctor_id)}"] .chat-doctor-suggestions`);
          if (host) {
            host.replaceChildren();
            for (const slot of data.slots || []) {
              const choice = document.createElement('button');
              choice.className = 'slot-pill-btn';
              choice.textContent = slot.start_time + ' · ' + prettyDate(slot.date);
              choice.onclick = () => {
                document.getElementById('chatTextInput').value = `Please propose booking doctor_id ${data.doctor_id} on ${slot.date} at ${slot.start_time}.`;
                window.sendChatMessage();
              };
              host.appendChild(choice);
            }
            if (!(data.slots || []).length) host.textContent = data.unavailable
              ? (lang === 'ar' ? 'تعذر التحقق من المواعيد المقترحة.' : 'Suggested slots could not be checked.')
              : (lang === 'ar' ? 'لا توجد مواعيد متجاورة متاحة لهذا اليوم.' : 'No adjacent slots available on this day.');
          }

    } else if (widget.type === 'appointment_cards') {
          for (const appointment of data.appointments || []) {
            const card = document.createElement('div');
            card.className = 'chat-booking-summary';
            const label = document.createElement('p');
            const doctor = appointment.doctor;
            const name = lang === 'ar' ? doctor.name_ar : doctor.name_en;
            label.textContent = `${name} · ${prettyDate(appointment.date)} · ${appointment.start_time}`;
            card.appendChild(label);
            const change = document.createElement('button');
            change.className = 'chat-doc-book-btn';
            change.textContent = lang === 'ar' ? 'تعديل الموعد' : 'Reschedule';
            change.onclick = () => window.selectDoctorFromCard(name, doctor.id, appointment.id);
            card.appendChild(change);
            const cancel = document.createElement('button');
            cancel.className = 'chat-cancel-action';
            cancel.textContent = lang === 'ar' ? 'إلغاء الموعد' : 'Cancel appointment';
            cancel.onclick = () => {
              const input = document.getElementById('chatTextInput');
              input.value = `Please prepare cancellation of appointment ${appointment.id} with ${name} on ${appointment.date} at ${appointment.start_time}. Ask me to confirm first.`;
              window.sendChatMessage();
            };
            card.appendChild(cancel);
            botSlots.widgetContainer.appendChild(card);
          }

    } else if (['appointment_success','action_proposal'].includes(widget.type)) {
      renderSavedAction(container, widget);
    }
  }

  function appendChatBotStaticMessage(text, widget, customTime) {
    const stream = document.getElementById('chatMessages');
    if (!stream) return;

    const timeStr = customTime || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const row = document.createElement('div');
    row.className = 'msg-bubble-row bot-row';
    row.innerHTML = `
      <div class="msg-avatar-bot">
        <svg viewBox="0 0 32 32" fill="none"><rect x="5" y="7" width="22" height="18" rx="6" fill="#2563EB"/><circle cx="11.5" cy="14.5" r="2.5" fill="#FFFFFF"/><circle cx="20.5" cy="14.5" r="2.5" fill="#FFFFFF"/></svg>
      </div>
      <div class="msg-balloon-wrapper">
        <div class="balloon-card bot-balloon">
          <div class="bot-text-content">${escapeHtml(text).replace(/\n/g, '<br>')}</div>
          <div class="bot-widget-container"></div>
        </div>
        <div class="msg-timestamp">${timeStr}</div>
      </div>
    `;
    stream.appendChild(row);

    if (widget) restoreWidget(row.querySelector('.bot-widget-container'), widget);
    if (widget && widget.type === 'history_card') {
      const balloon = row.querySelector('.balloon-card');
      const restored = restoreCard(widget.tree);
      balloon.replaceChildren(...Array.from(restored.childNodes));
    }


    scrollToBottom(false);
  }

  function createStreamingBotRow() {
    const stream = document.getElementById('chatMessages');
    if (!stream) return null;

    const row = document.createElement('div');
    row.className = 'msg-bubble-row bot-row';
    row.innerHTML = `
      <div class="msg-avatar-bot">
        <svg viewBox="0 0 32 32" fill="none"><rect x="5" y="7" width="22" height="18" rx="6" fill="#2563EB"/><circle cx="11.5" cy="14.5" r="2.5" fill="#FFFFFF"/><circle cx="20.5" cy="14.5" r="2.5" fill="#FFFFFF"/></svg>
      </div>
      <div class="msg-balloon-wrapper">
        <div class="balloon-card bot-balloon">
          <div class="bot-text-content"><span class="chat-typing-dots" style="color:var(--text-muted); font-style:italic;">${(window.getCurrentLang && window.getCurrentLang() === 'ar') ? 'جارٍ التحقق…' : 'Checking…'}</span></div>
          <div class="bot-widget-container"></div>
        </div>
        <div class="msg-timestamp">${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
      </div>
    `;
    stream.appendChild(row);
    scrollToBottom(true);
    return {
      row: row,
      textContent: row.querySelector('.bot-text-content'),
      widgetContainer: row.querySelector('.bot-widget-container')
    };
  }

  let chatSending = false;
  window.sendChatMessage = async function (options = {}) {
    if (chatSending) return;
    const input = document.getElementById('chatTextInput');
    if (!input) return;
    const text = input.value.trim();
    if (!text) return;

    appendChatUserMessage(text);
    input.value = '';
    conversationHistory.push({ role: 'user', content: text });

    // Auto-titling & message saving for active thread
    const activeThread = getActiveThread();
    if (!activeThread.messages || activeThread.messages.length === 0 || activeThread.title === 'محادثة جديدة' || activeThread.title === 'New Conversation') {
      const clean = text.replace(/[\r\n]+/g, ' ').trim();
      activeThread.title = clean.length > 30 ? clean.substring(0, 30) + '...' : clean;
    }
    const userMsgTimestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    activeThread.messages.push({ role: 'user', content: text, timestamp: userMsgTimestamp });
    activeThread.updatedAt = Date.now();

    const threadsData = getThreadsData();
    const tIdx = threadsData.threads.findIndex(t => t.id === activeThread.id);
    if (tIdx !== -1) {
      threadsData.threads.splice(tIdx, 1);
      threadsData.threads.unshift(activeThread);
      saveThreadsData(threadsData);
      renderThreadsList();
    }

    const botSlots = createStreamingBotRow();
    if (!botSlots) return;

    const lang = (window.getCurrentLang && window.getCurrentLang() === 'ar') ? 'ar' : 'en';
    const rawBase = (typeof getApiBaseUrl === 'function' ? getApiBaseUrl() : '');
    const cleanBase = rawBase ? rawBase.replace(/\/+$/, '') : '';
    const chatUrl = cleanBase.endsWith('/api/v1') ? `${cleanBase}/portal/chat/message` : `${cleanBase}/api/v1/portal/chat/message`;

    const abort = new AbortController();
    const deadline = setTimeout(() => abort.abort(), 45000);
    chatSending = true;
    let fullAssistantText = '';
    let lastWidgetData = null;
    const widgets = [];

    try {
      const response = await fetch(chatUrl, {
        method: 'POST',
        credentials: 'include',
        signal: abort.signal,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream'
        },
        body: JSON.stringify({
          messages: activeThread.messages.filter(message => ['user','assistant'].includes(message.role) && message.content?.trim()).slice(-60).map(message => ({role:message.role, content:message.content})),
          thread_id: String(activeThread.id),
          confirmation_id: options.confirmationId || null,
          language: lang
        })
      });

      if (response.status === 401) {
        botSlots.textContent.textContent = lang === 'ar'
          ? 'انتهت جلسة تسجيل الدخول. سجّل الدخول مرة أخرى للمتابعة.'
          : 'Your sign-in session expired. Sign in again to continue.';
        const link = document.createElement('a');
        link.href = 'auth.html';
        link.textContent = lang === 'ar' ? ' تسجيل الدخول' : ' Sign in';
        botSlots.textContent.appendChild(link);
        return;
      }
      if (!response.ok) {
        const failure = await response.json().catch(() => ({}));
        botSlots.textContent.textContent = failure.error?.message || (lang === 'ar' ? 'تعذر إكمال الطلب. حاول مرة أخرى.' : 'The request failed. Please retry.');
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let streamFailed = false;
      const feed = window.ClinicChatStream.createParser((eventType, data) => {
        if (eventType === 'widget') widgets.push(data);
        if (eventType === 'status') {
          if (!fullAssistantText) botSlots.textContent.innerHTML = '<span class="chat-typing-dots">' + (lang === 'ar' ? 'نتحقق من المعلومات المباشرة…' : 'Checking live availability…') + '</span>';
        } else if (eventType === 'widget' && data.type === 'doctor_recommendations') {
          const host = botSlots.widgetContainer.querySelector(`[data-doctor-id="${Number(data.doctor_id)}"] .chat-doctor-suggestions`);
          if (host) {
            host.replaceChildren();
            for (const slot of data.slots || []) {
              const choice = document.createElement('button');
              choice.className = 'slot-pill-btn';
              choice.textContent = slot.start_time + ' · ' + prettyDate(slot.date);
              choice.onclick = () => {
                document.getElementById('chatTextInput').value = `Please propose booking doctor_id ${data.doctor_id} on ${slot.date} at ${slot.start_time}.`;
                window.sendChatMessage();
              };
              host.appendChild(choice);
            }
            if (!(data.slots || []).length) host.textContent = data.unavailable
              ? (lang === 'ar' ? 'تعذر التحقق من المواعيد المقترحة.' : 'Suggested slots could not be checked.')
              : (lang === 'ar' ? 'لا توجد مواعيد متجاورة متاحة لهذا اليوم.' : 'No adjacent slots available on this day.');
          }
        } else if (eventType === 'error') {
          streamFailed = true;
          botSlots.textContent.textContent = lang === 'ar'
            ? 'تعذر إكمال الطلب. حاول مرة أخرى.' : 'The request failed. Please retry.';
        } else if (eventType === 'token') {
          const chunk = data.text ?? data.token ?? '';
          fullAssistantText += chunk;
          botSlots.textContent.innerHTML = escapeHtml(fullAssistantText).replace(/\n/g, '<br>');
          scrollToBottom(true);
        } else if (eventType === 'widget' && data.type === 'appointment_cards') {
          for (const appointment of data.appointments || []) {
            const card = document.createElement('div');
            card.className = 'chat-booking-summary';
            const label = document.createElement('p');
            const doctor = appointment.doctor;
            const name = lang === 'ar' ? doctor.name_ar : doctor.name_en;
            label.textContent = `${name} · ${prettyDate(appointment.date)} · ${appointment.start_time}`;
            card.appendChild(label);
            const change = document.createElement('button');
            change.className = 'chat-doc-book-btn';
            change.textContent = lang === 'ar' ? 'تعديل الموعد' : 'Reschedule';
            change.onclick = () => window.selectDoctorFromCard(name, doctor.id, appointment.id);
            card.appendChild(change);
            const cancel = document.createElement('button');
            cancel.className = 'chat-cancel-action';
            cancel.textContent = lang === 'ar' ? 'إلغاء الموعد' : 'Cancel appointment';
            cancel.onclick = () => {
              const input = document.getElementById('chatTextInput');
              input.value = `Please prepare cancellation of appointment ${appointment.id} with ${name} on ${appointment.date} at ${appointment.start_time}. Ask me to confirm first.`;
              window.sendChatMessage();
            };
            card.appendChild(cancel);
            botSlots.widgetContainer.appendChild(card);
          }
        } else if (eventType === 'widget' && ['appointment_success','action_proposal'].includes(data.type)) {
          if (data.type === 'appointment_success' && data.operation === 'cancel') data.next_action = getActiveThread().resumeAction || null;
          lastWidgetData = data;
          renderSavedAction(botSlots.widgetContainer, data);
        } else if (eventType === 'widget' && data.type === 'doctor_cards') {
          lastWidgetData = data;
          renderChatDoctorCards(botSlots.widgetContainer, data.doctors);
        }
      });
      while (true) {
        const {value, done} = await reader.read();
        if (done) break;
        feed(decoder.decode(value, {stream: true}));
      }
      feed(decoder.decode());
      if (!fullAssistantText && !streamFailed) {
        botSlots.textContent.textContent = lang === 'ar'
          ? 'لم يصل رد من المساعد. حاول مرة أخرى.' : 'No response received. Please retry.';
      }

      if (fullAssistantText) {
        conversationHistory.push({ role: 'assistant', content: fullAssistantText });
        const currentThread = getActiveThread();
        currentThread.messages.push({
          role: 'assistant',
          content: fullAssistantText,
          widget: widgets.length ? {type: 'bundle', widgets} : lastWidgetData,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        });
        currentThread.updatedAt = Date.now();
        const tData = getThreadsData();
        const curIdx = tData.threads.findIndex(t => t.id === currentThread.id);
        if (curIdx !== -1) {
          tData.threads[curIdx] = currentThread;
          saveThreadsData(tData);
          renderThreadsList();
        }
      }

    } catch (err) {
      console.error('[Chat AI Stream Error]:', err);
      botSlots.textContent.innerHTML = `<span style="color:#DC2626;">تعذر الاتصال بالمساعد الذكي حالياً.</span>`;
    } finally {
      clearTimeout(deadline);
      chatSending = false;
      scrollToBottom(true);
    }
  };

  function renderChatDoctorCards(container, doctors) {
    if (!container || !doctors || doctors.length === 0) return;
    const isAr = (window.getCurrentLang && window.getCurrentLang() === 'ar');

    const grid = document.createElement('div');
    grid.className = 'chat-doctor-cards-grid';

    doctors.forEach(doc => {
      const card = document.createElement('div');
      card.className = 'chat-doc-card';
      card.dataset.doctorId = String(doc.id);
      const initials = (doc.name || 'د').split(' ').filter(Boolean).map(n => n[0]).join('').substring(0, 2);

      card.innerHTML = `
        <div class="chat-doc-header">
          <div class="chat-doc-avatar">${initials}</div>
          <div class="chat-doc-info">
            <h4>${escapeHtml(doc.name)}</h4>
            <p>${escapeHtml(doc.title || doc.specialty)}</p>
          </div>
        </div>
        <div class="chat-doc-meta">
          <span class="chat-doc-fee">${escapeHtml(doc.fee)}</span>
          <span class="chat-doc-shifts">${isAr ? 'المواعيد: ' : 'Shifts: '} ${escapeHtml(doc.shift_start)} - ${escapeHtml(doc.shift_end)}</span>
        </div>
        <button class="chat-doc-book-btn">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect width="18" height="18" x="3" y="4" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          <span>${isAr ? 'احجز ميعاد' : 'Book Appointment'}</span>
        </button>
      `;
      card.querySelector('.chat-doc-book-btn').onclick = () => window.selectDoctorFromCard(doc.name, Number(doc.id));
      const suggestions = document.createElement('div');
      suggestions.className = 'chat-doctor-suggestions';
      suggestions.textContent = isAr ? 'جارٍ البحث عن مواعيد متجاورة…' : 'Finding slots next to your visits…';
      card.appendChild(suggestions);
      grid.appendChild(card);
    });

    container.appendChild(grid);
  }

  function snapshotCard(node) {
    if (node.nodeType === 3) return {text: node.textContent};
    const tag = node.tagName?.toLowerCase();
    if (!['div','p','strong','span','button','a'].includes(tag)) return {text:node.textContent || ''};
    return {tag, className:node.className || '', href:tag === 'a' && node.getAttribute('href') === 'appointments.html' ? 'appointments.html' : null, children:Array.from(node.childNodes).map(snapshotCard)};
  }
  function restoreCard(tree, depth = 0) {
    if (!tree || depth > 20) return document.createTextNode('');
    if ('text' in tree) return document.createTextNode(String(tree.text));
    const tag = ['div','p','strong','span','button','a'].includes(tree.tag) ? tree.tag : 'span';
    const node = document.createElement(tag);
    node.className = String(tree.className || '');
    if (tag === 'button') {node.disabled=true;node.title='Previous selection';}
    if (tag === 'a' && tree.href === 'appointments.html') node.href=tree.href;
    for (const child of (tree.children || []).slice(0,500)) node.appendChild(restoreCard(child,depth+1));
    return node;
  }

  function persistDirectCard(card) {
    const threadId = getActiveThread().id;
    const id = 'card_' + Date.now() + '_' + Math.random().toString(36).slice(2);
    let timer;
    const save = () => {
      const data = getThreadsData();
      const thread = data.threads.find(item => item.id === threadId);
      if (!thread) return;
      const content = card.textContent.textContent.trim();
      if (!content.trim()) return;
      const message = {id, role:'assistant', content, widget:{type:'history_card', tree:snapshotCard(card.row.querySelector('.balloon-card'))}, timestamp:new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})};
      const index = thread.messages.findIndex(item => item.id === id);
      if (index < 0) thread.messages.push(message); else thread.messages[index] = message;
      saveThreadsData(data);
    };
    new MutationObserver(() => {clearTimeout(timer);timer=setTimeout(save,100);}).observe(card.row, {childList:true,subtree:true,characterData:true});
    window.addEventListener('pagehide', save, {once:true});
  }

  window.selectDoctorFromCard = async function (docName, docId, appointmentId = null) {
    const activeThreadIdForCard = getActiveThread().id;
    if (chatSending) return;
    const isAr = window.getCurrentLang && window.getCurrentLang() === 'ar';
    const row = createStreamingBotRow();
    if (!row) return;
    persistDirectCard(row);
    row.textContent.textContent = "Loading available appointments…";
    chatSending = true;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);
    const day = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit', day: '2-digit'
    }).format(new Date());
    const end = new Date(day + 'T12:00:00Z');
    end.setUTCDate(end.getUTCDate() + 6);
    const base = (typeof getApiBaseUrl === 'function' ? getApiBaseUrl() : '/api/v1').replace(/\/+$/, '');
    const api = base.endsWith('/api/v1') ? base : base + '/api/v1';
    try {
      const response = await fetch(`${api}/doctors/${Number(docId)}/availability?from_date=${day}&to_date=${end.toISOString().slice(0,10)}`, {
        credentials: 'include', signal: controller.signal
      });
      if (!response.ok) throw new Error('Availability unavailable');
      const result = await response.json();
      row.textContent.textContent = (isAr ? 'المواعيد المتاحة: ' : 'Available slots: ') + docName;
      let count = 0;
      const slotCandidates = [];
      for (const available of result.days || []) {
        if (!(available.slots || []).length) continue;
        const heading = document.createElement('p');
        heading.className = 'chat-slot-day';
        heading.textContent = new Intl.DateTimeFormat(isAr ? 'ar-EG' : 'en-GB', {weekday:'long', day:'numeric', month:'short'}).format(new Date(available.date + 'T12:00:00'));
        row.widgetContainer.appendChild(heading);
        for (const time of available.slots) {
          const button = document.createElement('button');
          button.className = 'slot-pill-btn';
          button.textContent = time;
          button.onclick = async () => {
            if (chatSending) return;
            const summary = createStreamingBotRow();
            if (!summary) return;
            persistDirectCard(summary);
            summary.textContent.textContent = "Preparing appointment…";
            chatSending = true;
            try {
              const proposalResponse = await fetch(`${api}/portal/chat/${appointmentId ? "propose-change" : "propose-booking"}`, {
                method: 'POST', credentials: 'include',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(appointmentId ? {operation:"reschedule", appointment_id:appointmentId, date:available.date, start_time:time} : {doctor_id: Number(docId), date: available.date, start_time: time})
              });
              const proposal = await proposalResponse.json();
              if (!proposalResponse.ok) {
                const failure = new Error(proposal.error?.message || 'Cannot prepare booking.');
                failure.details = proposal.error?.details;
                if (appointmentId && failure.details?.appointment_id) {
                  const stored = getThreadsData();
                  const thread = stored.threads.find(item => item.id === activeThreadIdForCard);
                  if (thread) thread.resumeAction = {appointment_id:appointmentId,date:available.date,start_time:time,doctor_name:docName};
                  saveThreadsData(stored);
                }
                throw failure;
              }
              summary.textContent.classList.add('chat-booking-summary');
              const doctorLabel = document.createElement('strong');
              doctorLabel.textContent = docName;
              const when = document.createElement('div');
              when.className = 'chat-booking-when';
              when.textContent = new Intl.DateTimeFormat(isAr ? 'ar-EG' : 'en-GB', {weekday:'short', day:'numeric', month:'long'}).format(new Date(available.date + 'T12:00:00')) + ' · ' + time;
              summary.textContent.replaceChildren(doctorLabel, when);
              const status = document.createElement('p');
              status.className = 'chat-booking-status';
              status.setAttribute('role', 'status');
              status.setAttribute('aria-live', 'polite');
              status.textContent = isAr ? 'راجع الموعد ثم اضغط تأكيد الحجز.' : 'Review your appointment, then confirm.';
              summary.widgetContainer.appendChild(status);
              const confirm = document.createElement('button');
              confirm.className = 'chat-doc-book-btn';
              confirm.textContent = appointmentId ? (isAr ? 'تأكيد تعديل الموعد' : 'Confirm reschedule') : (isAr ? 'تأكيد الحجز' : 'Confirm booking');
              let saving = false;
              confirm.onclick = async () => {
                if (saving) return;
                saving = true;
                confirm.disabled = true;
                confirm.classList.add('is-saving');
                confirm.setAttribute('aria-busy', 'true');
                confirm.textContent = isAr ? 'جارٍ الحفظ…' : 'Saving appointment…';
                status.className = 'chat-booking-status is-pending';
                status.textContent = isAr ? 'نتحقق من التوفر ونحفظ موعدك. يرجى الانتظار.' : 'Checking availability and saving your appointment. Please wait.';
                const saveController = new AbortController();
                const saveTimeout = setTimeout(() => saveController.abort(), 30000);
                try {
                  const response = await fetch(`${api}/portal/chat/confirm-booking`, {
                    method: 'POST', credentials: 'include',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({proposal: proposal.proposal}),
                    signal: saveController.signal
                  });
                  const result = await response.json();
                  if (!response.ok || !result.saved) {
                    const failure = new Error(result.error?.message || 'Booking was not saved.');
                    failure.code = result.error?.code;
                    failure.status = response.status;
                    throw failure;
                  }
                  status.textContent = isAr ? 'تم حفظ الموعد بنجاح.' : 'Appointment saved successfully.';
                  status.className = 'chat-booking-status is-success';
                  summary.textContent.textContent = (isAr ? 'تم الحجز بنجاح. رقم الموعد: ' : 'Booking saved. Appointment ID: ') + result.appointment.id;
                  summary.textContent.classList.add('chat-action-success');
                  confirm.remove();
                  const link = document.createElement('a');
                  link.href = 'appointments.html';
                  link.textContent = isAr ? 'عرض مواعيدي' : 'View my appointments';
                  summary.widgetContainer.appendChild(link);
                } catch (error) {
                  status.className = 'chat-booking-status is-error';
                  const uncertain = error.name === 'AbortError' || error instanceof TypeError;
                  status.textContent = uncertain
                    ? (isAr ? 'لم يصل التأكيد. راجع مواعيدي قبل إعادة المحاولة.' : 'Confirmation was not received. Check My Appointments before retrying.')
                    : error.message + (error.code ? ` (${error.code})` : '');
                  confirm.textContent = error.status === 409
                    ? (isAr ? 'اختر موعداً آخر' : 'Choose another slot')
                    : (isAr ? 'إعادة المحاولة' : 'Retry confirmation');
                  if (error.status === 409) {
                    confirm.onclick = () => window.selectDoctorFromCard(docName, docId);
                  }
                  confirm.disabled = false;
                } finally {
                  clearTimeout(saveTimeout);
                  saving = false;
                  confirm.classList.remove('is-saving');
                  confirm.removeAttribute('aria-busy');
                  scrollToBottom(true);
                }
              };
              summary.widgetContainer.appendChild(confirm);
            } catch (error) {
              summary.textContent.textContent = error.message;
              summary.textContent.classList.add('chat-conflict-summary');
              for (const option of error.details?.alternatives || []) {
                const choice = document.createElement('button');
                choice.className = 'slot-pill-btn';
                choice.textContent = (option.position === 'before' ? (isAr ? 'قبل: ' : 'Earlier: ') : (isAr ? 'بعد: ' : 'Later: ')) + option.start_time;
                choice.onclick = () => {
                  const candidate = slotCandidates.find(item => item.date === option.date && item.time === option.start_time);
                  if (candidate) candidate.button.click();
                };
                summary.widgetContainer.appendChild(choice);
              }
              if (error.details?.appointment_id) {
                const cancel = document.createElement('button');
                cancel.className = 'chat-cancel-action';
                cancel.textContent = (isAr ? 'طلب إلغاء موعد ' : 'Request cancellation: ') + error.details.doctor;
                cancel.onclick = () => {
                  document.getElementById('chatTextInput').value = `Please propose cancelling appointment ${error.details.appointment_id} with ${error.details.doctor}. Ask me to confirm first.`;
                  window.sendChatMessage();
                };
                summary.widgetContainer.appendChild(cancel);
              }
            } finally {
              chatSending = false;
              scrollToBottom(true);
            }
          };
          slotCandidates.push({date:available.date, time, button});
          row.widgetContainer.appendChild(button);
          count++;
        }
      }
      if (!count) row.textContent.textContent += isAr ? ' — لا توجد مواعيد خلال ٧ أيام.' : ' — No free slots in the next seven days.';
    } catch (error) {
      row.textContent.textContent = isAr ? 'تعذر تحميل المواعيد. حاول مرة أخرى.' : 'Could not load live slots. Please retry.';
    } finally {
      clearTimeout(timer);
      chatSending = false;
      scrollToBottom(true);
    }
  };

  window.selectSlotFromChat = function (doctorName, timeStr) {
    const isAr = window.getCurrentLang && window.getCurrentLang() === 'ar';
    const input = document.getElementById('chatTextInput');
    const msg = isAr ? `احجز لي ميعاد الساعة ${timeStr} مع ${doctorName}` : `Please book ${timeStr} with ${doctorName}`;
    if (input) {
      input.value = msg;
      sendChatMessage();
    }
  };

  window.resetChat = function () {
    window.createNewConversation();
  };

  // Voice Call Simulation
  window.startVoiceCall = function () {
    const modal = document.getElementById('voiceCallModal');
    if (!modal) return;
    modal.classList.add('active');
    initSimulatedVoicePulse();
  };

  window.endVoiceCall = function () {
    const modal = document.getElementById('voiceCallModal');
    if (!modal) return;
    modal.classList.remove('active');
    stopSimulatedVoicePulse();
  };

  window.toggleMuteVoice = function (btn) {
    if (!btn) return;
    btn.classList.toggle('muted');
    const isMuted = btn.classList.contains('muted');
    const label = btn.querySelector('span');
    const isAr = window.getCurrentLang && window.getCurrentLang() === 'ar';
    if (label) {
      label.textContent = isMuted 
        ? (isAr ? 'إلغاء الكتم' : 'Unmute')
        : (isAr ? 'كتم الصوت' : 'Mute');
    }
  };

  let pulseInterval = null;
  function initSimulatedVoicePulse() {
    const bars = document.querySelectorAll('.wave-bar');
    if (!bars || bars.length === 0) return;
    pulseInterval = setInterval(() => {
      bars.forEach(bar => {
        const h = Math.floor(Math.random() * 38) + 8;
        bar.style.height = `${h}px`;
      });
    }, 180);
  }

  function stopSimulatedVoicePulse() {
    if (pulseInterval) {
      clearInterval(pulseInterval);
      pulseInterval = null;
    }
    const bars = document.querySelectorAll('.wave-bar');
    bars.forEach(b => b.style.height = '12px');
  }

  /* =========================================================================
     FEATURE FLAG: PUBLIC COMING SOON OVERLAY
     ========================================================================= */
  async function initChatFeatureAvailability() {
    const hostname = window.location.hostname || '';
    const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0';

    try {
      const baseUrl = (typeof getApiBaseUrl === 'function' ? getApiBaseUrl() : '/api/v1');
      const res = await fetch(`${baseUrl}/public/status`);
      if (res.ok) {
        const data = await res.json();
        const serverSaysComingSoon = Boolean(data.chat_public_coming_soon);

        if (isLocalhost) {
          setComingSoonOverlay(false);
        } else {
          setComingSoonOverlay(serverSaysComingSoon);
        }
      } else {
        if (!isLocalhost) setComingSoonOverlay(false);
      }
    } catch (_) {
      if (!isLocalhost) setComingSoonOverlay(false);
    }

    initPublicChatWebSocket();
  }

  function setComingSoonOverlay(enable) {
    const overlay = document.getElementById('chatComingSoonOverlay');
    if (!overlay) return;
    overlay.style.display = enable ? 'flex' : 'none';
  }

  function initPublicChatWebSocket() {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${proto}//${host}/api/v1/public/ws`;

    try {
      const socket = new WebSocket(wsUrl);

      socket.onmessage = (event) => {
        try {
          if (event.data === 'pong') return;
          const msg = JSON.parse(event.data);
          if (msg.event === 'CHAT_FEATURE_STATUS_CHANGED' && msg.data) {
            setComingSoonOverlay(Boolean(msg.data.chat_public_coming_soon));
          } else if (msg.event === 'CONNECTED' && msg.data) {
            if (typeof msg.data.chat_public_coming_soon === 'boolean') {
              setComingSoonOverlay(msg.data.chat_public_coming_soon);
            }
          }
        } catch (_) {}
      };

      const timer = setInterval(() => {
        if (socket.readyState === WebSocket.OPEN) {
          socket.send('ping');
        }
      }, 25000);

      socket.onclose = () => {
        clearInterval(timer);
        setTimeout(initPublicChatWebSocket, 5000);
      };

      socket.onerror = () => {
        try { socket.close(); } catch (_) {}
      };
    } catch (e) {
      console.warn('[Chat WS] Public websocket init error:', e);
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    initChatFeatureAvailability();

    // Open history only after the server has verified the signed-in patient.
    window.addEventListener('clinic:session-loaded', event => {
      const profile = event.detail;
      const identity = profile && (profile.customer_number || profile.id);
      if (!identity) return;
      THREADS_STORAGE_KEY = 'shiffaa_chat_threads_v2:' + String(identity);
      loadThreadMessages(getActiveThread());
      renderThreadsList();
    });

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

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
  const THREADS_STORAGE_KEY = 'shiffaa_chat_threads_v1';
  let conversationHistory = [];

  function getThreadsData() {
    try {
      const raw = localStorage.getItem(THREADS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.threads) && parsed.threads.length > 0) {
          return parsed;
        }
      }
    } catch (_) {}

    const isAr = window.getCurrentLang && window.getCurrentLang() === 'ar';
    const initialId = 'thread_' + Date.now();
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
      localStorage.setItem(THREADS_STORAGE_KEY, JSON.stringify(data));
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
    const data = getThreadsData();
    const isAr = window.getCurrentLang && window.getCurrentLang() === 'ar';
    const newId = 'thread_' + Date.now();
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
    if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
    const data = getThreadsData();
    const isAr = window.getCurrentLang && window.getCurrentLang() === 'ar';

    data.threads = data.threads.filter(t => t.id !== threadId);
    if (data.threads.length === 0) {
      const newId = 'thread_' + Date.now();
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

    if (widget && widget.type === 'doctor_cards' && Array.isArray(widget.doctors)) {
      const widgetContainer = row.querySelector('.bot-widget-container');
      renderChatDoctorCards(widgetContainer, widget.doctors);
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
          <div class="bot-text-content"><span class="chat-typing-dots" style="color:var(--text-muted); font-style:italic;">جاري التحقق...</span></div>
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

  window.sendChatMessage = async function () {
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
    const chatUrl = cleanBase.endsWith('/api/v1') ? `${cleanBase}/chat/message` : `${cleanBase}/api/v1/chat/message`;

    let fullAssistantText = '';
    let lastWidgetData = null;

    try {
      const response = await fetch(chatUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream'
        },
        body: JSON.stringify({
          messages: conversationHistory,
          language: lang
        })
      });

      if (!response.ok) {
        botSlots.textContent.innerHTML = `<span style="color:#DC2626;">عذراً، حدث خطأ أثناء معالجة الطلب. يرجى المحاولة مرة أخرى.</span>`;
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;

          if (line.startsWith('event:')) {
            const eventType = line.slice(6).trim();
            const nextLine = lines[i + 1] ? lines[i + 1].trim() : '';

            if (nextLine.startsWith('data:')) {
              i++;
              const rawData = nextLine.slice(5).trim();
              try {
                const data = JSON.parse(rawData);

                if (eventType === 'token') {
                  const chunk = data.text !== undefined ? data.text : (data.token !== undefined ? data.token : '');
                  if (chunk) {
                    if (fullAssistantText === '') {
                      botSlots.textContent.textContent = '';
                    }
                    fullAssistantText += chunk;
                    botSlots.textContent.innerHTML = escapeHtml(fullAssistantText).replace(/\n/g, '<br>');
                    scrollToBottom(true);
                  }
                } else if (eventType === 'widget') {
                  if (data.type === 'doctor_cards' && Array.isArray(data.doctors)) {
                    lastWidgetData = data;
                    renderChatDoctorCards(botSlots.widgetContainer, data.doctors);
                    scrollToBottom(true);
                  }
                }
              } catch (_) {}
            }
          }
        }
      }

      if (fullAssistantText) {
        conversationHistory.push({ role: 'assistant', content: fullAssistantText });
        const currentThread = getActiveThread();
        currentThread.messages.push({
          role: 'assistant',
          content: fullAssistantText,
          widget: lastWidgetData,
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
        <button class="chat-doc-book-btn" onclick="selectDoctorFromCard('${escapeHtml(doc.name)}', ${doc.id})">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect width="18" height="18" x="3" y="4" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          <span>${isAr ? 'احجز ميعاد' : 'Book Appointment'}</span>
        </button>
      `;
      grid.appendChild(card);
    });

    container.appendChild(grid);
  }

  window.selectDoctorFromCard = function (docName, docId) {
    const input = document.getElementById('chatTextInput');
    const isAr = (window.getCurrentLang && window.getCurrentLang() === 'ar');
    const msg = isAr ? `عاوز احجز كشف مع دكتور ${docName}` : `I would like to book with Dr. ${docName}`;
    if (input) {
      input.value = msg;
      sendChatMessage();
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

    // Initialize multi-thread chat session
    const active = getActiveThread();
    loadThreadMessages(active);
    renderThreadsList();

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

/**
 * Nile Clinics - Live Calls Monitoring Controller
 * Real-time active call streaming, handling, and agent take-over operations
 */

document.addEventListener('DOMContentLoaded', () => {
  initClock();
  initGlobalShortcuts();
  initLiveCallTimers();
  renderLiveCallsSkeletons();
  checkUrlParamsForDirectCall();
  if (liveCallsDatabase.length > 0) selectLiveCallRow(liveCallsDatabase[0].id);
  initRealtimeLiveCallsSync();
});

function renderLiveCallsSkeletons() {
  const tableBody = document.getElementById('liveCallsTableBody');
  if (!tableBody) return;
  tableBody.innerHTML = `
    <tr>
      <td><div class="skeleton-shimmer" style="width:16px; height:16px; border-radius:4px;"></div></td>
      <td><div class="skeleton-shimmer skeleton-text" style="width:110px; height:14px;"></div></td>
      <td><div class="skeleton-shimmer skeleton-text" style="width:90px; height:14px;"></div></td>
      <td><div class="skeleton-shimmer skeleton-text" style="width:70px; height:14px;"></div></td>
      <td><div class="skeleton-shimmer skeleton-text" style="width:50px; height:14px;"></div></td>
      <td><div class="skeleton-shimmer skeleton-pill" style="width:70px; height:20px;"></div></td>
      <td><div class="skeleton-shimmer skeleton-text" style="width:120px; height:14px;"></div></td>
      <td><div class="skeleton-shimmer skeleton-text" style="width:150px; height:14px;"></div></td>
      <td><div class="skeleton-shimmer skeleton-pill" style="width:75px; height:24px;"></div></td>
    </tr>
  `;
}

function checkUrlParamsForDirectCall() {
  const urlParams = new URLSearchParams(window.location.search);
  const caller = urlParams.get('caller');
  const phone = urlParams.get('phone');
  if (caller) {
    const newCall = {
      id: 1,
      caller: caller,
      phone: phone || '+20 100 000 0000',
      avatar: caller.charAt(0).toUpperCase(),
      avatarBg: '#EFF6FF',
      avatarColor: '#2563EB',
      patientStatus: 'Known Patient',
      callerMeta: 'Booked Appointment • Consultation',
      dept: 'Cardiology',
      durationSeconds: 14,
      status: 'Live',
      confidence: '98%',
      intent: 'Appointment Confirmation & Directions',
      entityDept: 'Cardiology',
      entityDate: 'Today',
      entityTime: '10:30 AM',
      dialogue: [
        { sender: 'agent', text: 'أهلاً بحضرتك في عيادات النيل، بخصوص موعدك المسجل اليوم، هل تحب تأكيد الحجز أو الاستفسار عن شيء؟', time: '10:30 AM' },
        { sender: 'caller', text: 'أهلاً يا دكتور، أنا جاي في الطريق وعايز اتأكد من رقم العيادة والدور', time: '10:30 AM' },
        { sender: 'agent', text: 'تمام يا فندم! العيادة في الدور الثالث، مبنى أ، والعيادة جاهزة لاستقبالك.', time: '10:31 AM' }
      ]
    };
    liveCallsDatabase.unshift(newCall);
    renderCallsTable();
    selectLiveCallRow(1);
    const ongoingMetric = document.getElementById('metricOngoingCalls');
    if (ongoingMetric) ongoingMetric.textContent = '1';
    const pill = document.getElementById('ongoingPillCount');
    if (pill) pill.textContent = '1 ongoing call';
  } else {
    setTimeout(() => {
      const tableBody = document.getElementById('liveCallsTableBody');
      if (tableBody && liveCallsDatabase.length === 0) {
        tableBody.innerHTML = `
          <tr>
            <td colspan="9" style="text-align:center; padding:60px 20px; color:#64748B;">
              <div style="font-size:15px; font-weight:700; color:#334155; margin-bottom:6px;">No Active Live Calls</div>
              <div style="font-size:13px; max-width:400px; margin:0 auto;">All voice channels are currently in standby. Live caller streams will appear here dynamically.</div>
            </td>
          </tr>
        `;
      }
    }, 350);
  }
}

function renderCallsTable() {
  const tableBody = document.getElementById('liveCallsTableBody');
  if (!tableBody) return;
  tableBody.innerHTML = liveCallsDatabase.map(call => `
    <tr onclick="selectLiveCallRow(${call.id}, this)" style="cursor:pointer;">
      <td class="td-checkbox" onclick="event.stopPropagation()"><input type="checkbox" class="custom-checkbox"></td>
      <td>
        <div style="display:flex; align-items:center; gap:10px;">
          <div style="width:34px; height:34px; border-radius:50%; background:${call.avatarBg}; color:${call.avatarColor}; display:flex; align-items:center; justify-content:center; font-weight:700;">${call.avatar}</div>
          <div>
            <div style="font-weight:700; color:#0F172A;">${call.caller}</div>
            <div style="font-size:11px; color:#64748B;">${call.phone}</div>
          </div>
        </div>
      </td>
      <td><span class="badge-known-patient">${call.patientStatus}</span></td>
      <td><strong>${call.dept}</strong></td>
      <td><span id="timerRow${call.id}">00:${String(call.durationSeconds).padStart(2, '0')}</span></td>
      <td><span class="badge-status-ai">• ${call.status}</span></td>
      <td>${call.intent}</td>
      <td style="font-size:12px; color:#475569; max-width:200px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${call.dialogue[call.dialogue.length - 1]?.text || ''}</td>
      <td class="table-actions-cell" style="text-align:right;">
        <button class="btn-take-over-row" onclick="event.stopPropagation(); handleTakeOver(${call.id})">Take Over</button>
      </td>
    </tr>
  `).join('');
}

function initRealtimeLiveCallsSync() {
  if (!window.ClinicRealtime) return;
  window.ClinicRealtime.on('CALL_INCOMING', (call) => {
    if (typeof showToast === 'function') {
      showToast(`Incoming call from ${call?.caller || 'Patient'}`, 'info');
    }
  });
  window.ClinicRealtime.on('CALL_ENDED', () => {
    if (typeof showToast === 'function') {
      showToast('Live call completed and logged.', 'info');
    }
  });
}

/* =============================================================================
   1. LIVE CLOCK TICKER
   ============================================================================= */
function initClock() {
  const dateEl = document.getElementById('liveDateText');
  const timeEl = document.getElementById('liveTimeText');

  function update() {
    const now = new Date();
    const optionsDate = { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' };
    const dateStr = now.toLocaleDateString('en-GB', optionsDate);
    
    let hours = now.getHours();
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    const timeStr = `${String(hours).padStart(2, '0')}:${minutes} ${ampm}`;

    if (dateEl) dateEl.textContent = dateStr;
    if (timeEl) timeEl.textContent = timeStr;
  }

  update();
  setInterval(update, 1000);
}

/* =============================================================================
   2. LIVE CALLS DATA STORE (Deterministic Mock Data matching UI Specs)
   ============================================================================= */
const liveCallsDatabase = [];

let currentlySelectedLiveCallId = null;
let currentLiveCallsTab = 'all';
let isHandleMuted = false;
let isHandleOnHold = false;

/* =============================================================================
   3. RUNNING DURATION TIMERS
   ============================================================================= */
function initLiveCallTimers() {
  setInterval(() => {
    liveCallsDatabase.forEach(call => {
      call.durationSeconds++;
      
      // Update row timer
      const rowTimer = document.getElementById(`timerRow${call.id}`);
      if (rowTimer) {
        const mins = Math.floor(call.durationSeconds / 60);
        const secs = call.durationSeconds % 60;
        rowTimer.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
      }

      // Update right handle timer if selected
      if (call.id === currentlySelectedLiveCallId) {
        const handleTimer = document.getElementById('handleTimerCounter');
        if (handleTimer) {
          const hrs = Math.floor(call.durationSeconds / 3600);
          const mins = Math.floor((call.durationSeconds % 3600) / 60);
          const secs = call.durationSeconds % 60;
          handleTimer.textContent = `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
        }
      }
    });
  }, 1000);
}

/* =============================================================================
   4. ROW SELECTION & RIGHT PANEL RENDERING
   ============================================================================= */
function selectLiveCallRow(callId, trEl) {
  currentlySelectedLiveCallId = callId;

  // Highlight selected row
  const rows = document.querySelectorAll('#liveCallsTableBody tr');
  rows.forEach(r => r.classList.remove('selected-row'));

  if (trEl) {
    trEl.classList.add('selected-row');
  } else {
    const target = rows[callId - 1];
    if (target) target.classList.add('selected-row');
  }

  const call = liveCallsDatabase.find(c => c.id === callId);
  if (!call) return;

  renderLiveCallHandle(call);
}

function renderLiveCallHandle(call) {
  // Ensure Panel is open
  const panel = document.getElementById('liveCallHandlePanel');
  const emptyNotice = document.getElementById('liveHandleEmptyNotice');
  const convoTab = document.getElementById('tabContentConversation');

  if (panel) panel.style.display = 'flex';
  if (emptyNotice) emptyNotice.style.display = 'none';
  if (convoTab) convoTab.style.display = 'flex';

  // Hero Info
  const avatarEl = document.getElementById('handleAvatar');
  const nameEl = document.getElementById('handleCallerName');
  const phoneEl = document.getElementById('handleCallerPhone');
  const metaEl = document.getElementById('handleCallerMeta');
  const badgeEl = document.getElementById('handlePatientBadge');

  if (avatarEl) {
    avatarEl.textContent = call.avatar;
    avatarEl.style.backgroundColor = call.avatarBg;
    avatarEl.style.color = call.avatarColor;
  }
  if (nameEl) nameEl.textContent = call.caller;
  if (phoneEl) phoneEl.textContent = call.phone;
  if (metaEl) metaEl.textContent = call.callerMeta;

  if (badgeEl) {
    if (call.patientStatus === 'Known Patient') {
      badgeEl.style.display = 'inline-flex';
      badgeEl.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg><span>Known Patient</span>';
    } else {
      badgeEl.style.display = 'inline-flex';
      badgeEl.innerHTML = '<span>New Caller</span>';
      badgeEl.style.backgroundColor = '#F1F5F9';
      badgeEl.style.borderColor = '#CBD5E1';
      badgeEl.style.color = '#475569';
    }
  }

  // Intent Card
  const intentText = document.getElementById('handleIntentText');
  const confText = document.getElementById('handleConfidenceRate');
  if (intentText) intentText.textContent = call.intent;
  if (confText) confText.textContent = call.confidence;

  // Entities
  const entityDept = document.getElementById('handleEntityDept');
  const entityDate = document.getElementById('handleEntityDate');
  const entityTime = document.getElementById('handleEntityTime');
  if (entityDept) entityDept.textContent = call.entityDept;
  if (entityDate) entityDate.textContent = call.entityDate;
  if (entityTime) entityTime.textContent = call.entityTime;

  // Dialogue Stream
  const streamEl = document.getElementById('dialogueMessagesStream');
  if (streamEl && call.dialogue) {
    streamEl.innerHTML = call.dialogue.map(msg => {
      if (msg.sender === 'caller') {
        return `
          <div class="dialogue-bubble-row">
            <div class="dialogue-bubble-caller">
              <p class="dialogue-text-ar">${msg.text}</p>
              <span class="dialogue-timestamp-text">${msg.time}</span>
            </div>
          </div>
        `;
      } else {
        const isHuman = msg.sender === 'agent';
        return `
          <div class="dialogue-bubble-row">
            <div class="dialogue-avatar-ai" style="${isHuman ? 'background:#EFF6FF; color:#2563EB;' : ''}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4"/></svg>
            </div>
            <div class="dialogue-bubble-ai">
              <p class="dialogue-text-ar">${msg.text}</p>
              <span class="dialogue-timestamp-text">${msg.time}</span>
            </div>
          </div>
        `;
      }
    }).join('');
  }

  // Action Button in Right Panel
  const actionBtnText = document.getElementById('handleActionBtnText');
  const actionBtn = document.getElementById('btnHandleTakeOver');
  if (actionBtn && actionBtnText) {
    if (call.status === 'Human Agent') {
      actionBtn.style.backgroundColor = '#DC2626';
      actionBtnText.textContent = 'End Active Call';
    } else {
      actionBtn.style.backgroundColor = 'var(--primary-blue)';
      actionBtnText.textContent = 'Take Over Call';
    }
  }
}

/* =============================================================================
   5. CALL ACTIONS: TAKE OVER & END CALL
   ============================================================================= */
function handleTakeOver(callId) {
  const call = liveCallsDatabase.find(c => c.id === callId);
  if (!call) return;

  call.status = "Human Agent";

  // Update row in table
  const tr = document.querySelectorAll('#liveCallsTableBody tr')[callId - 1];
  if (tr) {
    const statusCell = tr.querySelector('.badge-status-ai, .badge-status-waiting, .badge-status-human');
    if (statusCell) {
      statusCell.className = 'badge-status-human';
      statusCell.textContent = '• Human Agent';
    }

    const actionsCell = tr.querySelector('.table-actions-cell');
    if (actionsCell) {
      actionsCell.innerHTML = `
        <button class="btn-end-call-row" onclick="event.stopPropagation(); handleEndCall(${callId})">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.42 19.42 0 0 1-3.33-2.67m-2.67-3.34a19.79 19.79 0 0 1-3.07-8.63A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91"/><line x1="22" y1="2" x2="2" y2="22"/></svg>
          <span>End Call</span>
        </button>
      `;
    }
  }

  // Update metric counters
  const humanMetric = document.getElementById('metricHumanAgents');
  if (humanMetric) humanMetric.textContent = '3';

  const aiMetric = document.getElementById('metricHandledAi');
  if (aiMetric) aiMetric.textContent = '5';

  selectLiveCallRow(callId);
  showToast(`Call taken over: Now speaking with ${call.caller}`, 'success');
}

function handleEndCall(callId) {
  const call = liveCallsDatabase.find(c => c.id === callId);
  if (!call) return;

  const tr = document.querySelectorAll('#liveCallsTableBody tr')[callId - 1];
  if (tr) {
    tr.style.opacity = '0.5';
    tr.style.pointerEvents = 'none';
    const actions = tr.querySelector('.table-actions-cell');
    if (actions) actions.innerHTML = '<span style="font-size:11px; font-weight:600; color:#64748B;">Call Ended</span>';
  }

  // Decrement ongoing count
  const ongoingMetric = document.getElementById('metricOngoingCalls');
  if (ongoingMetric) ongoingMetric.textContent = '7';

  const pillCount = document.getElementById('ongoingPillCount');
  if (pillCount) pillCount.textContent = '7 ongoing calls';

  const sideBadge = document.getElementById('liveCallsCountBadge');
  if (sideBadge) sideBadge.textContent = '7';

  showToast(`Live call with ${call.caller} terminated and saved to call records`, 'info');
}

function handlePrimaryCallAction() {
  const call = liveCallsDatabase.find(c => c.id === currentlySelectedLiveCallId);
  if (!call) return;

  if (call.status === 'Human Agent') {
    handleEndCall(call.id);
  } else {
    handleTakeOver(call.id);
  }
}

function toggleHandleMute(btn) {
  isHandleMuted = !isHandleMuted;
  if (isHandleMuted) {
    btn.classList.add('active');
    showToast('Operator microphone muted', 'warning');
  } else {
    btn.classList.remove('active');
    showToast('Operator microphone unmuted', 'info');
  }
}

function toggleHandleHold(btn) {
  isHandleOnHold = !isHandleOnHold;
  const tag = document.getElementById('handleLiveTag');
  const statusText = document.getElementById('handleStatusText');

  if (isHandleOnHold) {
    btn.classList.add('active');
    if (statusText) statusText.textContent = 'On Hold';
    if (tag) {
      tag.style.backgroundColor = '#FEF3C7';
      tag.style.color = '#B45309';
      tag.querySelector('.pulse-dot').style.backgroundColor = '#D97706';
    }
    showToast('Call placed on hold', 'warning');
  } else {
    btn.classList.remove('active');
    if (statusText) statusText.textContent = 'Live';
    if (tag) {
      tag.style.backgroundColor = '#DCFCE7';
      tag.style.color = '#15803D';
      tag.querySelector('.pulse-dot').style.backgroundColor = '#10B981';
    }
    showToast('Call resumed live', 'success');
  }
}

function minimizeHandlePanel() {
  const convoTab = document.getElementById('tabContentConversation');
  const emptyNotice = document.getElementById('liveHandleEmptyNotice');
  if (convoTab) convoTab.style.display = 'none';
  if (emptyNotice) emptyNotice.style.display = 'block';
  showToast('Live call handle panel minimized', 'info');
}

/* =============================================================================
   6. FILTERING & SEARCH CONTROLLERS (ZERO BLANK SPACE)
   ============================================================================= */
function filterLiveCallsTab(tab, btnEl) {
  currentLiveCallsTab = tab;
  document.querySelectorAll('.live-call-tab-btn').forEach(b => b.classList.remove('active'));
  btnEl.classList.add('active');

  applyLiveFilters();
}

function applyLiveFilters() {
  const searchInput = document.getElementById('liveCallsGlobalSearch');
  const q = searchInput ? searchInput.value.toLowerCase().trim() : '';
  const deptVal = document.getElementById('liveDeptFilter')?.value || '';

  const tableBody = document.getElementById('liveCallsTableBody');
  const emptyState = document.getElementById('liveCallsEmptyState');

  let visibleCount = 0;

  liveCallsDatabase.forEach((call, idx) => {
    let passTab = true;
    if (currentLiveCallsTab === 'ai' && call.status !== 'AI Handling') passTab = false;
    if (currentLiveCallsTab === 'human' && call.status !== 'Human Agent') passTab = false;
    if (currentLiveCallsTab === 'waiting' && call.status !== 'Waiting') passTab = false;

    let passSearch = true;
    if (q) {
      passSearch = call.caller.toLowerCase().includes(q) || call.phone.includes(q) || call.intent.toLowerCase().includes(q);
    }

    let passDept = !deptVal || call.dept === deptVal;

    const tr = tableBody.children[idx];
    if (tr) {
      if (passTab && passSearch && passDept) {
        tr.style.display = '';
        visibleCount++;
      } else {
        tr.style.display = 'none';
      }
    }
  });

  if (visibleCount === 0) {
    if (emptyState) emptyState.style.display = 'flex';
  } else {
    if (emptyState) emptyState.style.display = 'none';
  }
}

function resetLiveCallFilters() {
  const searchInput = document.getElementById('liveCallsGlobalSearch');
  if (searchInput) searchInput.value = '';

  const deptFilter = document.getElementById('liveDeptFilter');
  if (deptFilter) deptFilter.value = '';

  filterLiveCallsTab('all', document.querySelectorAll('.live-call-tab-btn')[0]);
  showToast('Live calls filter reset to default', 'info');
}

function toggleSelectAllLive(masterCheckbox) {
  const checkboxes = document.querySelectorAll('#liveCallsTableBody .custom-checkbox');
  checkboxes.forEach(cb => cb.checked = masterCheckbox.checked);
  showToast(masterCheckbox.checked ? 'All 8 calls selected' : 'Deselected all calls', 'info');
}

function sortLiveCallsByDuration() {
  const sortVal = document.getElementById('liveDurationSort')?.value;
  showToast(`Sorted live calls: ${sortVal}`, 'info');
}

function toggleDurationSort() {
  showToast('Toggled duration sort direction', 'info');
}

/* =============================================================================
   7. MODALS (GRID VIEW & EXPANDED DIALOGUE)
   ============================================================================= */
function openGridViewModal() {
  const html = `
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:14px; max-height:420px; overflow-y:auto;">
      ${liveCallsDatabase.map(c => `
        <div style="background:#F8FAFC; border:1px solid #E2E8F0; border-radius:10px; padding:12px; display:flex; flex-direction:column; gap:8px;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <div style="font-weight:700; color:#0F172A; font-size:13px;">${c.caller} (${c.dept})</div>
            <span class="badge-status-ai" style="font-size:10px;">${c.status}</span>
          </div>
          <div style="font-size:12px; color:#475569;">${c.phone} • Duration: ${Math.floor(c.durationSeconds/60)}m ${c.durationSeconds%60}s</div>
          <div style="font-size:11.5px; font-family:var(--font-arabic); color:#334155; direction:rtl; background:#fff; padding:6px 8px; border-radius:6px; border:1px solid #E2E8F0;">
            ${c.transcriptSnippet}
          </div>
          <div style="display:flex; justify-content:flex-end;">
            <button class="btn-take-over-row" onclick="selectLiveCallRow(${c.id}); closeAdminModal();">Open Console</button>
          </div>
        </div>
      `).join('')}
    </div>
  `;

  openAdminModal('Live Calls Grid View (8 Active Channels)', html);
}

function openExpandedDialogueModal() {
  const call = liveCallsDatabase.find(c => c.id === currentlySelectedLiveCallId) || liveCallsDatabase[0];
  const html = `
    <div style="display:flex; flex-direction:column; gap:14px;">
      <div style="background:#F8FAFC; border:1px solid #E2E8F0; padding:12px; border-radius:8px; display:flex; justify-content:space-between; align-items:center;">
        <div>
          <div style="font-weight:700; font-size:14px; color:#0F172A;">${call.caller} (${call.phone})</div>
          <div style="font-size:12px; color:#64748B;">Channel: Live Audio (Egyptian Arabic) • Intent: ${call.intent}</div>
        </div>
        <span class="live-tag-badge"><span class="pulse-dot"></span><span>Streaming</span></span>
      </div>

      <div style="display:flex; flex-direction:column; gap:10px; max-height:300px; overflow-y:auto;">
        ${call.dialogue.map(d => `
          <div style="background:${d.sender === 'caller' ? '#EFF6FF' : '#F8FAFC'}; border:1px solid ${d.sender === 'caller' ? '#BFDBFE' : '#E2E8F0'}; border-radius:8px; padding:10px; margin-${d.sender === 'caller' ? 'left' : 'right'}:20px;">
            <div style="display:flex; justify-content:space-between; margin-bottom:4px; font-size:11px; font-weight:700; color:${d.sender === 'caller' ? '#1D4ED8' : '#7C3AED'};">
              <span>${d.sender === 'caller' ? 'Caller' : 'AI Voice Agent'}</span>
              <span>${d.time}</span>
            </div>
            <p style="font-family:var(--font-arabic); font-size:13px; color:#0F172A; margin:0; direction:rtl;">${d.text}</p>
          </div>
        `).join('')}
      </div>
    </div>
  `;

  openAdminModal(`Full Streaming Transcript: ${call.caller}`, html);
}

function switchHandleTab(tab, btnEl) {
  document.querySelectorAll('.sub-tab-btn').forEach(b => b.classList.remove('active'));
  btnEl.classList.add('active');
  if (tab !== 'conversation') {
    showToast(`Viewing ${btnEl.textContent} for ${document.getElementById('handleCallerName').textContent}`, 'info');
  }
}

/* =============================================================================
   8. SHORTCUTS & UTILITIES
   ============================================================================= */
function initGlobalShortcuts() {
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      const input = document.getElementById('liveCallsGlobalSearch');
      if (input) {
        input.focus();
        input.select();
      }
    }
    if (e.key === 'Escape') {
      closeAdminModal();
    }
  });

  const search = document.getElementById('liveCallsGlobalSearch');
  if (search) {
    search.addEventListener('input', applyLiveFilters);
  }
}

function handleBranchChange() {
  showToast('Active clinic branch: Main Clinic (Synchronized)', 'success');
}

function handleLogout() {
  if (confirm('Are you sure you want to log out of the Clinic Admin Console?')) {
    showToast('Admin logged out successfully.', 'info');
  }
}

function toggleNotifications() {
  showToast('Live Call Center: 8 audio channels operating normally across WebRTC & SIP.', 'info');
}

function openAdminModal(title, bodyHtml, footerHtml = '') {
  const backdrop = document.getElementById('adminModalBackdrop');
  const titleEl = document.getElementById('adminModalTitle');
  const bodyEl = document.getElementById('adminModalBody');
  const footerEl = document.getElementById('adminModalFooter');

  if (titleEl) titleEl.textContent = title;
  if (bodyEl) bodyEl.innerHTML = bodyHtml;
  if (footerEl) footerEl.innerHTML = footerHtml;

  if (backdrop) {
    backdrop.classList.add('active');
    backdrop.classList.add('open');
  }
}

function closeAdminModal(e) {
  if (e && e.target && e.target.id !== 'adminModalBackdrop' && !e.target.closest('.modal-close-icon-btn') && !e.target.classList.contains('modal-btn-secondary')) {
    return;
  }
  const backdrop = document.getElementById('adminModalBackdrop');
  if (backdrop) {
    backdrop.classList.remove('active');
    backdrop.classList.remove('open');
  }
}

function showToast(message, type = 'info') {
  const container = document.getElementById('adminToastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast-item toast-${type}`;

  let iconSvg = '';
  if (type === 'success') {
    iconSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="#16A34A" stroke-width="2.5" width="18" height="18"><polyline points="20 6 9 17 4 12"/></svg>';
  } else if (type === 'warning') {
    iconSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="#D97706" stroke-width="2.5" width="18" height="18"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>';
  } else {
    iconSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="#2563EB" stroke-width="2.5" width="18" height="18"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>';
  }

  toast.innerHTML = `
    ${iconSvg}
    <span class="toast-text">${message}</span>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'toastSlideOut 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards';
    setTimeout(() => {
      toast.remove();
    }, 300);
  }, 3500);
}

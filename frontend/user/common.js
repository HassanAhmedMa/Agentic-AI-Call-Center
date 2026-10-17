/**
 * Nile Clinics - Common Shared Utilities & Translation Engine
 * Handles bilingual Egyptian Arabic (العامية المصرية) / English, Visibility, Modals & Shell
 */

(function () {
  'use strict';

  const TRANSLATIONS = {
    en: {
      brand_name: "Nile Clinics",
      brand_tagline: "Your Health, Our Care",
      nav_home: "Home",
      nav_appointments: "Appointments",
      nav_ai_chat: "AI Chat",
      nav_support: "Support & Inquiries",
      nav_clinic_info: "Clinic Information",
      nav_profile: "My Profile",
      help_title: "Need Help?",
      help_subtitle: "Prefer speaking to a human?",
      contact_support_btn: "Contact Support",
      search_placeholder: "Search doctors, specialties, or services...",
      hero_welcome: "Welcome back, ",
      hero_subtitle: "Your health journey starts here. Book appointments, manage and get instant support from our AI assistant.",
      hero_book_btn: "Book an Appointment",
      hero_chat_btn: "Chat with AI Assistant",
      quality_badge_title: "Quality Care",
      quality_badge_sub: "For a Healthier Tomorrow",
      action_book_title: "Book Appointment",
      action_book_desc: "Find and schedule with our doctors",
      action_my_appts_title: "My Appointments",
      action_my_appts_desc: "View and manage your scheduled consultations",
      action_ai_title: "AI Assistant",
      action_ai_desc: "Get instant answers to your questions",
      upcoming_appt_title: "Upcoming Appointment",
      upcoming_appt_sub: "Your next scheduled consultation",
      view_all: "View All",
      loading_appointments: "Loading your upcoming appointments from clinic database...",
      appointments_page_title: "Appointments",
      appointments_page_sub: "Find and manage your appointments with our doctors.",
      book_new_appt_btn: "Book New Appointment",
      tab_upcoming: "Upcoming",
      tab_past: "Past",
      tab_canceled: "Canceled",
      filter_dept_label: "Department",
      filter_doctor_label: "Doctor",
      filter_date_label: "Date",
      all_departments: "All Departments",
      all_doctors: "All Doctors",
      reset_filters: "Reset",
      ai_name: "Nile AI Assistant",
      ai_desc: "Your personal healthcare assistant",
      status_online: "Online",
      chat_greeting_hi: "Hello Mona!",
      chat_greeting_body: "I'm the Nile Clinics AI Assistant. I can help you with:",
      cap_1: "Booking, rescheduling, or canceling appointments",
      cap_2: "Checking doctor schedules and branch hours",
      cap_3: "Answering questions about our services or policies",
      cap_4: "Creating support requests if you need further help",
      chat_how_assist: "How can I assist you today?",
      chat_slots_intro: "Of course! Let me check the available cardiology appointments for Thursday, 14 November, in the afternoon. Here are the available slots:",
      chat_input_placeholder: "Type your message...",
      profile_page_title: "My Profile",
      profile_page_sub: "Manage your personal information and account settings.",
      profile_tab_personal: "Personal Information",
      profile_tab_security: "Security",
      profile_tab_preferences: "Preferences",
      profile_tab_notifications: "Notifications",
      view_only_badge: "Verified Record (View Only)",
      field_full_name: "Full Name",
      field_email: "Email Address",
      field_phone: "Phone Number",
      field_dob: "Date of Birth",
      field_gender: "Gender",
      field_address: "Address",
      account_settings_title: "Account Settings",
      setting_change_password: "Change Password",
      setting_notification_prefs: "Notification Preferences",
      setting_language: "Language",
      setting_visibility_customizer: "Customize Page Components",
      setting_privacy: "Privacy Settings",
      setting_help_support: "Help & Support",
      logout_btn: "Logout",
      voice_caller_name: "Nile AI Voice Assistant",
      voice_status: "Connected • Real-time Voice (Egyptian & MSA)",
      mute_btn: "Mute",
      end_call_btn: "End Call",
      support_page_title: "Support & Inquiries",
      support_page_sub: "We are here to assist you 24/7. Reach out via call or submit an inquiry.",
      support_hotline_title: "Clinic Hotline",
      support_email_title: "Email Support",
      clinic_info_title: "Clinic Information & Branches",
      clinic_info_sub: "Branch locations, working hours, specialized medical services, and insurance coverage.",
      branch_heliopolis_title: "Heliopolis Branch (Main Clinic)",
      branch_nasr_title: "Nasr City Branch",
      branch_hours_title: "Operating Hours",
      branch_hours_desc: "Saturday - Thursday: 8:00 AM - 11:00 PM | Friday: 1:00 PM - 10:00 PM (Emergency 24/7)",
      branch_phone_title: "Direct Phone",
      facilities_heading: "Specialized Medical Departments",
      insurance_heading: "Accepted Insurance Networks"
    },
    ar: {
      brand_name: "عيادات النيل",
      brand_tagline: "صحتك أولويتنا وراحتك تهمنا",
      nav_home: "الرئيسية",
      nav_appointments: "مواعيدي",
      nav_ai_chat: "المساعد الذكي",
      nav_support: "الدعم والاستفسارات",
      nav_clinic_info: "معلومات العيادة",
      nav_profile: "الملف الشخصي",
      help_title: "محتاج مساعدة؟",
      help_subtitle: "عايز تتكلم مع ممثل خدمة العملاء؟",
      contact_support_btn: "تواصل مع الدعم",
      search_placeholder: "ابحث عن دكتور، تخصص، أو كشف...",
      hero_welcome: "أهلاً بيكي تاني يا ",
      hero_subtitle: "صحتك معانا في أمان.. تقدري تحجزي كشفك في ثواني أو تسألي المساعد الذكي عن أي استفسار طبي.",
      hero_book_btn: "احجز ميعاد كشف",
      hero_chat_btn: "تحدث مع المساعد الذكي",
      quality_badge_title: "رعاية طبية متميزة",
      quality_badge_sub: "من أجل صحتك وصحة أسرتك",
      action_book_title: "حجز كشف جديد",
      action_book_desc: "اختاري التخصص والدكتور المناسب ليكي",
      action_my_appts_title: "متابعة مواعيدي",
      action_my_appts_desc: "إدارة وتعديل وإلغاء الكشوفات المسجلة",
      action_ai_title: "المساعد الذكي",
      action_ai_desc: "إجابات فورية لمساعدتك في كل خطوة",
      upcoming_appt_title: "كشفك القادم",
      upcoming_appt_sub: "ميعاد الاستشارة القادمة في العيادة",
      view_all: "عرض الكل",
      loading_appointments: "بنحمّل مواعيدك المحجوزة من قاعدة بيانات العيادة...",
      appointments_page_title: "مواعيدي وكشوفاتي",
      appointments_page_sub: "إدارة ومتابعة جميع حجوزاتك مع أطباء عيادات النيل.",
      book_new_appt_btn: "احجز كشف جديد",
      tab_upcoming: "القادمة",
      tab_past: "السابقة",
      tab_canceled: "الملغية",
      filter_dept_label: "التخصص",
      filter_doctor_label: "الدكتور",
      filter_date_label: "التاريخ",
      all_departments: "كل التخصصات",
      all_doctors: "كل الأطباء",
      reset_filters: "إعادة ضبط",
      ai_name: "مساعد النيل الذكي",
      ai_desc: "مساعدك الطبي الافتراضي على مدار الساعة",
      status_online: "متصل الآن",
      chat_greeting_hi: "أهلاً بيكي يا منى!",
      chat_greeting_body: "أنا المساعد الذكي لعيادات النيل، وأقدر أساعدك في:",
      cap_1: "حجز وتعديل وإلغاء مواعيد الكشف",
      cap_2: "معرفة مواعيد الأطباء وأوقات عمل الفروع",
      cap_3: "الإجابة عن فروع وأسعار العيادات",
      cap_4: "فتح طلب دعم فوري لمتابعة حالتك",
      chat_how_assist: "أقدر أساعد حضرتك بإيه النهاردة؟",
      chat_slots_intro: "أكيد تحت أمرك! دي المواعيد المتاحة عند دكاترة القلب يوم الخميس 14 نوفمبر بعد الضهر، اختاري الميعاد الأنسب ليكي:",
      chat_input_placeholder: "اكتبي رسالتك هنا...",
      profile_page_title: "الملف الشخصي",
      profile_page_sub: "عرض بياناتك الشخصية المسجلة وإعدادات الحساب.",
      profile_tab_personal: "البيانات الشخصية",
      profile_tab_security: "الأمان وكلمة المرور",
      profile_tab_preferences: "التفضيلات",
      profile_tab_notifications: "الإشعارات",
      view_only_badge: "بيانات معتمدة رسمياً (للعرض فقط)",
      field_full_name: "الاسم بالكامل",
      field_email: "البريد الإلكتروني",
      field_phone: "رقم الموبايل",
      field_dob: "تاريخ الميلاد",
      field_gender: "النوع",
      field_address: "العنوان المسجل",
      account_settings_title: "إعدادات الحساب",
      setting_change_password: "تغيير كلمة المرور",
      setting_notification_prefs: "تفضيلات الإشعارات",
      setting_language: "اللغة (Language)",
      setting_visibility_customizer: "تخصيص مكونات الصفحة (إخفاء / إظهار)",
      setting_privacy: "إعدادات الخصوصية",
      setting_help_support: "المساعدة والدعم الطبي",
      logout_btn: "تسجيل الخروج",
      voice_caller_name: "مساعد النيل الصوتي الذكي",
      voice_status: "متصل • محادثة صوتية فورية بالعامية المصرية",
      mute_btn: "كتم الصوت",
      end_call_btn: "إنهاء المكالمة",
      support_page_title: "الدعم والاستفسارات",
      support_page_sub: "إحنا جنبك ومعاكي 24 ساعة في اليوم.. تقدري تتصلي بينا أو تبعتي استفسارك وهيتم الرد فوراً.",
      support_hotline_title: "الخط الساخن للعيادات",
      support_email_title: "الدعم عبر البريد الإلكتروني",
      clinic_info_title: "معلومات العيادات وفروعنا",
      clinic_info_sub: "عناوين الفروع، مواعيد العمل، العيادات التخصصية، وشبكة التأمين الطبي المعتمدة.",
      branch_heliopolis_title: "فرع مصر الجديدة (المركز الرئيسي)",
      branch_nasr_title: "فرع مدينة نصر",
      branch_hours_title: "مواعيد العمل",
      branch_hours_desc: "السبت - الخميس: ٨:٠٠ ص - ١١:٠٠ م | الجمعة: ١:٠٠ م - ١٠:٠٠ م (طوارئ ٢٤ ساعة)",
      branch_phone_title: "التليفون المباشر",
      facilities_heading: "الأقسام والعيادات التخصصية",
      insurance_heading: "شركات وشبكات التأمين الطبي"
    }
  };

  let currentLang = localStorage.getItem('clinic_user_lang') || 'en';

  function applyLanguage(lang) {
    currentLang = lang;
    localStorage.setItem('clinic_user_lang', lang);
    const html = document.documentElement;
    const isAr = lang === 'ar';

    html.setAttribute('lang', isAr ? 'ar' : 'en');
    html.setAttribute('dir', isAr ? 'rtl' : 'ltr');

    const flagEl = document.getElementById('langFlagIcon');
    const labelEl = document.getElementById('langLabelText');
    const profileLangEl = document.getElementById('profileActiveLangLabel');
    if (flagEl) flagEl.textContent = isAr ? '🇬🇧' : '🇪🇬';
    if (labelEl) labelEl.textContent = isAr ? 'English' : 'العامية المصرية';
    if (profileLangEl) profileLangEl.textContent = isAr ? 'العامية المصرية (Egyptian Arabic)' : 'English';

    const dict = TRANSLATIONS[lang] || TRANSLATIONS.en;
    document.querySelectorAll('[data-i18n]').forEach((el) => {
      const key = el.getAttribute('data-i18n');
      if (dict[key]) {
        el.textContent = dict[key];
      }
    });

    document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
      const key = el.getAttribute('data-i18n-placeholder');
      if (dict[key]) {
        el.setAttribute('placeholder', dict[key]);
      }
    });

    // Notify listeners
    window.dispatchEvent(new CustomEvent('clinic:language-changed', { detail: { lang } }));
  }

  window.toggleLanguage = function () {
    const next = currentLang === 'en' ? 'ar' : 'en';
    applyLanguage(next);
    showToast(next === 'ar' ? 'تم تحويل الواجهة إلى العامية المصرية' : 'Switched to English successfully', 'info');
  };

  window.setLanguage = function (lang) {
    const target = lang === 'ar' ? 'ar' : 'en';
    applyLanguage(target);
    showToast(target === 'ar' ? 'تم تحويل الواجهة إلى العامية المصرية' : 'Switched to English successfully', 'info');
  };

  window.getCurrentLang = function () {
    return currentLang;
  };

  /* =============================================================================
     VISIBILITY CONTROLS
     ============================================================================= */
  const VISIBILITY_STORAGE_KEY = 'clinic_user_visibility_config';

  function loadVisibilityConfig() {
    try {
      const saved = localStorage.getItem(VISIBILITY_STORAGE_KEY);
      return saved ? JSON.parse(saved) : {};
    } catch (_) {
      return {};
    }
  }

  function applyVisibilityConfig() {
    const cfg = loadVisibilityConfig();
    Object.keys(cfg).forEach((ctrlId) => {
      const isHidden = Boolean(cfg[ctrlId]);
      const elements = document.querySelectorAll(`[data-ctrl="${ctrlId}"]`);
      elements.forEach((el) => {
        if (isHidden) {
          el.setAttribute('data-user-hidden', 'true');
        } else {
          el.removeAttribute('data-user-hidden');
        }
      });
    });
  }

  window.openVisibilityCustomizer = function () {
    const isAr = currentLang === 'ar';
    const cfg = loadVisibilityConfig();

    const controls = [
      { id: 'home-hero', label: isAr ? 'بانر الترحيب الرئيسي (Hero Banner)' : 'Welcome Hero Banner' },
      { id: 'home-quick-actions', label: isAr ? 'كروت الإجراءات السريعة (Quick Actions)' : 'Quick Action Cards' },
      { id: 'home-upcoming-section', label: isAr ? 'قسم الكشف القادم بالصفحة الرئيسية' : 'Upcoming Appointment Section' },
      { id: 'header-search', label: isAr ? 'شريط البحث في الهيدر (Search Bar)' : 'Header Search Bar' },
      { id: 'sidebar-help', label: isAr ? 'كارت الدعم البشري في القائمة' : 'Sidebar Support Card' },
      { id: 'book-new-appt-btn', label: isAr ? 'زر حجز كشف جديد في المواعيد' : 'Book New Appointment Button' },
      { id: 'appointments-filters', label: isAr ? 'شريط فلترة المواعيد (Filters)' : 'Appointments Filter Bar' },
      { id: 'chat-call-btn', label: isAr ? 'زر المكالمة الصوتية بالمساعد الذكي' : 'AI Voice Call Button' },
      { id: 'clinic-branches', label: isAr ? 'كروت فروع العيادة ومواعيدها' : 'Clinic Branches & Operating Hours' },
      { id: 'support-cards', label: isAr ? 'قنوات الدعم والخط الساخن' : 'Support Channels & Hotline' }
    ];

    const body = `
      <div>
        <p style="color:#64748B; font-size:13px; line-height:1.5; margin-bottom:16px;">
          ${isAr ? 'يمكنك إخفاء أو إظهار أي جزء أو زر في الصفحة بحرية حسب رغبتك:' : 'You can freely toggle the visibility of any section, button, or card across the portal:'}
        </p>
        <div style="display:flex; flex-direction:column; gap:12px;">
          ${controls.map(c => `
            <label style="display:flex; align-items:center; justify-content:space-between; background:#F8FAFC; border:1px solid #E2E8F0; padding:10px 14px; border-radius:8px; cursor:pointer;">
              <span style="font-size:13.5px; font-weight:600; color:#1E293B;">${c.label}</span>
              <input type="checkbox" id="chk_ctrl_${c.id}" ${!cfg[c.id] ? 'checked' : ''} style="width:18px; height:18px; cursor:pointer;">
            </label>
          `).join('')}
        </div>
      </div>
    `;

    const footer = `
      <button class="btn-secondary-action" onclick="resetAllVisibility()">
        ${isAr ? 'إعادة إظهار الكل' : 'Reset All to Visible'}
      </button>
      <button class="btn-primary-action" onclick="saveVisibilitySettings()">
        ${isAr ? 'حفظ التعديلات' : 'Save Changes'}
      </button>
    `;

    openModal(isAr ? 'تخصيص مكونات الصفحة' : 'Customize Page Components', body, footer);
  };

  window.saveVisibilitySettings = function () {
    const isAr = currentLang === 'ar';
    const cfg = {};
    document.querySelectorAll('[id^="chk_ctrl_"]').forEach((chk) => {
      const ctrlId = chk.id.replace('chk_ctrl_', '');
      cfg[ctrlId] = !chk.checked;
    });
    localStorage.setItem(VISIBILITY_STORAGE_KEY, JSON.stringify(cfg));
    applyVisibilityConfig();
    closeActiveModal();
    showToast(isAr ? 'تم حفظ تفضيلات الرؤية بنجاح' : 'Visibility preferences updated successfully', 'success');
  };

  window.resetAllVisibility = function () {
    localStorage.removeItem(VISIBILITY_STORAGE_KEY);
    applyVisibilityConfig();
    closeActiveModal();
    showToast(currentLang === 'ar' ? 'تمت استعادة جميع العناصر' : 'All elements restored to visible', 'info');
  };

  /* =============================================================================
     MODALS & DIALOGS
     ============================================================================= */
  function openModal(title, bodyHtml, footerHtml = '') {
    const backdrop = document.getElementById('modalBackdrop');
    const titleEl = document.getElementById('modalTitle');
    const bodyEl = document.getElementById('modalBody');
    const footerEl = document.getElementById('modalFooter');

    if (titleEl) titleEl.textContent = title;
    if (bodyEl) bodyEl.innerHTML = bodyHtml;
    if (footerEl) footerEl.innerHTML = footerHtml;

    if (backdrop) {
      backdrop.classList.add('active');
      backdrop.classList.add('open');
      backdrop.style.display = 'flex';
      backdrop.style.opacity = '1';
      backdrop.style.visibility = 'visible';
      backdrop.style.pointerEvents = 'auto';
    }
  }
  window.openModal = openModal;

  window.closeActiveModal = function () {
    const backdrop = document.getElementById('modalBackdrop');
    if (backdrop) {
      backdrop.classList.remove('active');
      backdrop.classList.remove('open');
      backdrop.style.display = 'none';
      backdrop.style.opacity = '0';
      backdrop.style.visibility = 'hidden';
      backdrop.style.pointerEvents = 'none';
    }
  };

  window.handleBackdropClick = function (e) {
    if (e.target.id === 'modalBackdrop') {
      closeActiveModal();
    }
  };

  /* =============================================================================
     TOAST NOTIFICATIONS
     ============================================================================= */
  function showToast(msg, type = 'info') {
    let container = document.getElementById('toastContainer');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toastContainer';
      container.className = 'toast-stack';
      document.body.appendChild(container);
    }
    const pill = document.createElement('div');
    pill.className = `toast-pill ${type}`;
    pill.textContent = msg;
    container.appendChild(pill);
    setTimeout(() => {
      pill.style.opacity = '0';
      pill.style.transition = 'opacity 0.3s ease';
      setTimeout(() => pill.remove(), 300);
    }, 3200);
  }
  window.showToast = showToast;

  /* =============================================================================
     GLOBAL HELPERS
     ============================================================================= */
  window.handleGlobalSearch = function (q) {
    if (!q) return;
    const lower = q.toLowerCase();
    if (lower.includes('appoint') || lower.includes('حجز') || lower.includes('ميعاد')) {
      window.location.href = 'appointments.html';
    } else if (lower.includes('chat') || lower.includes('مساعد') || lower.includes('سؤال')) {
      window.location.href = 'chat.html';
    } else if (lower.includes('profile') || lower.includes('حساب')) {
      window.location.href = 'profile.html';
    }
  };

  window.escapeHtml = function (str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  };

  window.escapeJs = function (str) {
    if (!str) return '';
    return String(str).replace(/'/g, "\\'").replace(/"/g, '\\"');
  };

  // DOM Ready Initializer
  document.addEventListener('DOMContentLoaded', () => {
    applyLanguage(currentLang);
    applyVisibilityConfig();

    // Global keyboard shortcut: Ctrl+K focus search
    window.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        const searchInput = document.getElementById('globalSearchInput');
        if (searchInput) searchInput.focus();
      }
    });
  });
})();

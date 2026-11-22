# UI/UX Design System Guidelines

> **PROJECT:** Agentic Clinic  
> **DOCUMENT:** Visual Language, Design System Tokens & Interface Standards  
> **PHASE:** Phase 0 Architecture Contract (Do NOT build full UI in Phase 0)

---

## 1. Design Philosophy: Modern Clinical Precision

The visual language of **Agentic Clinic** conveys trust, calm precision, and professional efficiency. It reflects a state-of-the-art medical technology platform rather than a cluttered legacy hospital portal or a trendy startup landing page.

### Guiding Principles:
- **Clarity Over Decoration:** Content and clinical context must always take precedence over decorative flourishes.
- **Calm, High-Contrast Palette:** Deep clinical slates, crisp whites, and purposeful medical blues/teals.
- **Accessible by Default:** All text and interactive controls must adhere to **WCAG 2.1 Level AA** contrast standards.
- **RTL & LTR Fluency:** Seamless support for right-to-left layout direction (Arabic) and left-to-right (English).
- **Graceful States:** Explicit and thoughtful empty states, skeleton loaders, and actionable error messages.

### What to Avoid:
- ❌ No excessive candy gradients, blurry glowing cards, or heavy glassmorphism.
- ❌ No jittery, gratuitous decorative animations.
- ❌ No nested cards inside cards that waste vertical screen space.
- ❌ No generic "AI-themed" neon aesthetics.

---

## 2. Conceptual Design Tokens

### 2.1. Color Tokens
```css
/* Neutral Palette */
--color-bg-canvas:        #F8FAFC; /* Slate 50: clean app background */
--color-bg-surface:       #FFFFFF; /* Pure white card/panel surface */
--color-bg-subtle:        #F1F5F9; /* Slate 100: muted row/hover */
--color-border-subtle:    #E2E8F0; /* Slate 200: standard borders */
--color-border-strong:    #CBD5E1; /* Slate 300: input borders */

--color-text-primary:     #0F172A; /* Slate 900: high-contrast headings & text */
--color-text-secondary:   #475569; /* Slate 600: descriptions & labels */
--color-text-muted:       #94A3B8; /* Slate 400: placeholders & timestamps */

/* Brand & Clinical Intent */
--color-primary-50:       #F0FDF4; /* Mint 50 */
--color-primary-500:      #0D9488; /* Clinical Teal: Primary action */
--color-primary-600:      #0F766E; /* Dark Teal: Hover state */
--color-primary-focus:    rgba(13, 148, 136, 0.2);

/* Semantic States */
--color-success-bg:       #ECFDF5;
--color-success-text:     #065F46;
--color-warning-bg:       #FFFBEB;
--color-warning-text:     #92400E;
--color-danger-bg:        #FEF2F2;
--color-danger-text:      #991B1B;
--color-info-bg:          #EFF6FF;
--color-info-text:        #1E40AF;
```

### 2.2. Typography Tokens
- **Font Stack (Latin):** `Inter`, `-apple-system`, `BlinkMacSystemFont`, `Segoe UI`, `sans-serif`
- **Font Stack (Arabic):** `IBM Plex Sans Arabic`, `Tajawal`, `sans-serif`
- **Scale:**
  - `text-xs`: 12px / 16px line-height (Badges, metadata)
  - `text-sm`: 14px / 20px line-height (Secondary details, table cells)
  - `text-base`: 16px / 24px line-height (Body copy, form inputs)
  - `text-lg`: 18px / 28px line-height (Subheadings, card titles)
  - `text-xl`: 20px / 28px line-height (Section headers)
  - `text-2xl`: 24px / 32px line-height (Page titles)

### 2.3. Spacing & Grid Tokens
- `space-1`: 4px | `space-2`: 8px | `space-3`: 12px | `space-4`: 16px
- `space-6`: 24px | `space-8`: 32px | `space-12`: 48px

### 2.4. Border Radius
- `radius-sm`: 4px (Chips, small badges)
- `radius-md`: 8px (Buttons, input fields, standard cards)
- `radius-lg`: 12px (Modals, major panel surfaces)
- `radius-full`: 9999px (Avatars, pills)

### 2.5. Elevation & Shadows
- `shadow-subtle`: `0 1px 2px 0 rgba(0, 0, 0, 0.05)`
- `shadow-card`: `0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1)`
- `shadow-modal`: `0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)`

### 2.6. Breakpoints
- `sm`: 640px (Mobile portrait to landscape)
- `md`: 768px (Tablets)
- `lg`: 1024px (Laptops / Small desktops)
- `xl`: 1280px (Standard clinic workstation displays)

### 2.7. Motion & Micro-Interactions
- `transition-fast`: `150ms cubic-bezier(0.4, 0, 0.2, 1)` (Hover, button clicks)
- `transition-base`: `250ms cubic-bezier(0.4, 0, 0.2, 1)` (Modal open, drawer slide)

---

## 3. Core Interface Surfaces (Planned for Phase 2+)

1. **Clinic Operations Dashboard:**
   - Real-time operational snapshot: today's appointments, doctor availability status, open support tickets, and live AI assistant activity.
2. **Patient Directory:**
   - Searchable table with profile modals, past appointment histories, and contact info.
3. **Doctor Rosters & Schedules:**
   - Weekly calendar grid showing booked vs. available slots by doctor and specialty.
4. **Appointments Manager:**
   - Status filters (`scheduled`, `completed`, `cancelled`), conflict resolution flags, and direct manual rescheduling controls.
5. **Medical Services & Pricing Catalog:**
   - Categorized card grid displaying fees, durations, and prep guidelines.
6. **Support Ticket Desk:**
   - Ticket queue with priority badges, status updates, and resolution notes.
7. **AI Conversational Interface:**
   - Split view featuring live conversation transcript (with Arabic/English bidirectional rendering), active voice waveform, real-time tool execution breadcrumbs, and human handoff button.
8. **System Health & Observability Monitor:**
   - Service uptime, STT/TTS latency metrics, and API error rates.

## Early browser forms

Phase 1 includes a minimal mobile-friendly text page with direct registration/consent and email-code forms, delivery acknowledgements and status messages. The full staff dashboard remains later; authenticated queue access is required alongside Phase 2 escalation. Forms use backend errors, never expose service credentials, and preserve the five-minute resume window.

# 08 - UI Information Architecture

This directory contains the user interface sitemap and screen hierarchy for **Agentic Clinic**.

---

## Diagram Preview

```mermaid
%%{init: {'theme': 'base', 'themeVariables': { 'primaryColor': '#ffffff', 'primaryTextColor': '#000000', 'primaryBorderColor': '#000000', 'lineColor': '#000000', 'secondaryColor': '#ffffff', 'tertiaryColor': '#ffffff', 'edgeLabelBackground':'#ffffff' }}}%%
flowchart TD
    Root["Agentic Clinic Portal Sitemap"]

    subgraph PublicPortal [" Public Patient & Caller Portal "]
        PublicHome["Home / Clinic Welcome"]
        VoiceWidget["Conversational Voice & Chat Assistant\n- Audio Stream Waveform\n- Real-time Bilingual Transcript\n- Emergency Escalation Trigger"]
        PublicServices["Public Services & Pricing Directory"]
        PublicDoctors["Doctor Profiles & Schedules"]
        
        PublicHome --> VoiceWidget
        PublicHome --> PublicServices
        PublicHome --> PublicDoctors
    end

    subgraph StaffPortal [" Clinic Operations & Staff Portal (Authenticated) "]
        Dashboard["Clinic Dashboard (Overview)\n- Today's Appointments\n- Active Escalation Queue\n- Doctor Availability Status"]
        
        PatientsView["Patients Directory\n- Patient Lookup & Profile\n- Appointment History\n- Associated Support Tickets"]
        
        DoctorsView["Doctor Roster & Schedules\n- Doctor Profiles & Specialties\n- Weekly Shifts & Working Days\n- Consultation Fees"]
        
        AppointmentsView["Appointments Manager\n- Daily / Weekly Calendar Grid\n- Status Filters (Scheduled/Completed/Cancelled)\n- Manual Booking & Rescheduling"]
        
        ServicesView["Service Catalog Manager\n- Procedure Names & Categories\n- Pricing & Duration\n- Fasting & Prep Instructions"]
        
        TicketsView["Support Tickets Desk\n- Open Inquiry Queue\n- Priority Tagging\n- Resolution Notes & Status Update"]
        
        ConversationsView["AI Dialogue & Audit Monitor\n- Live Transcript Feed\n- Tool Execution Logs\n- Latency & Fallback Metrics"]
        
        SettingsView["System Administration\n- Clinic Operating Hours\n- Emergency Contacts Config\n- Voice & Model Adapters Settings"]

        Dashboard --> PatientsView
        Dashboard --> DoctorsView
        Dashboard --> AppointmentsView
        Dashboard --> ServicesView
        Dashboard --> TicketsView
        Dashboard --> ConversationsView
        Dashboard --> SettingsView
    end

    Root --> PublicPortal
    Root --> StaffPortal
```

- **Source File:** [`ui-information-architecture.mmd`](ui-information-architecture.mmd)
- **Purpose:** Maps the product structure into two distinct portals:
  1. **Public Patient Portal:** Clean, accessible patient interface containing the conversational voice/text assistant widget, service directory, and doctor schedules.
  2. **Staff Operations Portal:** Operational dashboard for clinic receptionists and administrators to manage appointments, doctor rosters, support tickets, and live escalated calls.
- **Related Documentation:**
  - [UI/UX Design System Guidelines](../../product/ui-ux-guidelines.md)

# Clinic Backend REST API Contracts

> **PROJECT:** Agentic Clinic  
> **DOCUMENT:** Backend REST API Contract Specification  
> **BASE URL:** `/api/v1`  
> **FORMAT:** JSON (`Content-Type: application/json`)  
> **STATUS:** Phase 0 Architecture Contract (Do NOT implement in Phase 0)

---

## 1. Global Standards & Conventions

### 1.1. Common Error Response Envelope
All error responses adhere to the following JSON format:
```json
{
  "error": {
    "code": "RESOURCE_NOT_FOUND",
    "message": "Doctor with ID 42 was not found.",
    "details": {
      "doctor_id": 42
    },
    "timestamp": "2026-10-10T14:32:00Z"
  }
}
```

### 1.2. Standard HTTP Status Codes
- `200 OK`: Request succeeded, response body contains resource data.
- `201 Created`: Resource created successfully, `Location` header or body contains new resource.
- `400 Bad Request`: Validation failure, missing required fields, or ill-formed JSON.
- `401 Unauthorized`: Missing or invalid authentication token.
- `403 Forbidden`: Authenticated user lacks permission to access or modify resource.
- `404 Not Found`: Target resource does not exist.
- `409 Conflict`: Business rule violation (e.g., doctor already booked at specified time).
- `422 Unprocessable Entity`: Semantic validation failure (e.g., date is in the past).
- `500 Internal Server Error`: Unexpected server-side failure.

---

## 2. Patient Endpoints

### 2.1. GET `/patients/{patient_id}`
Retrieves details for a specific patient profile.

- **Method:** `GET`
- **Path:** `/api/v1/patients/{patient_id}`
- **Parameters:**
  - `patient_id` (Path, integer, required): Unique patient ID.
- **Request Body:** None
- **Validation Rules:**
  - `patient_id` must be a positive integer (> 0).
- **Responses:**
  - `200 OK`:
    ```json
    {
      "id": 101,
      "name": "Ahmed Mansour",
      "phone": "+201012345678",
      "email": "ahmed.mansour@example.com",
      "date_of_birth": "1988-04-15",
      "gender": "male",
      "insurance_provider": "Misr Insurance",
      "insurance_policy_number": "POL-99281",
      "created_at": "2026-01-10T09:00:00Z"
    }
    ```
  - `404 Not Found`: Patient not found.

---

### 2.2. GET `/patients/{patient_id}/appointments`
Lists all past and upcoming appointments for a patient.

- **Method:** `GET`
- **Path:** `/api/v1/patients/{patient_id}/appointments`
- **Parameters:**
  - `patient_id` (Path, integer, required): Unique patient ID.
  - `status` (Query, string, optional): Filter by status (`scheduled`, `completed`, `cancelled`, `rescheduled`).
  - `from_date` (Query, ISO-8601 date string, optional): e.g. `2026-10-10`.
- **Request Body:** None
- **Responses:**
  - `200 OK`:
    ```json
    {
      "patient_id": 101,
      "total": 1,
      "appointments": [
        {
          "id": 501,
          "doctor_id": 12,
          "doctor_name": "Dr. Sarah Farouk",
          "specialty": "Cardiology",
          "date": "2026-10-15",
          "time": "14:00",
          "status": "scheduled",
          "notes": "Follow-up ECG check",
          "created_at": "2026-10-01T10:00:00Z"
        }
      ]
    }
    ```
  - `404 Not Found`: Patient not found.

---

## 3. Doctor Endpoints

### 3.1. GET `/doctors`
Lists doctors with optional filtering by specialty or name.

- **Method:** `GET`
- **Path:** `/api/v1/doctors`
- **Parameters:**
  - `specialty` (Query, string, optional): e.g. `Cardiology`, `Dermatology`, `Pediatrics`.
  - `search` (Query, string, optional): Search query matching doctor name or bio.
  - `limit` (Query, integer, default: 20, max: 100).
  - `offset` (Query, integer, default: 0).
- **Request Body:** None
- **Responses:**
  - `200 OK`:
    ```json
    {
      "total": 2,
      "doctors": [
        {
          "id": 12,
          "name": "Dr. Sarah Farouk",
          "specialty": "Cardiology",
          "title": "Consultant Cardiologist",
          "description": "Specialist in heart disease, arrhythmias, and hypertension management.",
          "languages": ["Arabic", "English"],
          "consultation_fee": 350.00
        },
        {
          "id": 15,
          "name": "Dr. Tarek Hegazi",
          "specialty": "Cardiology",
          "title": "Senior Cardiology Specialist",
          "description": "Expert in non-invasive echocardiography and preventive cardiology.",
          "languages": ["Arabic", "English"],
          "consultation_fee": 300.00
        }
      ]
    }
    ```

---

### 3.2. GET `/doctors/{doctor_id}`
Retrieves detailed profile information for a specific doctor.

- **Method:** `GET`
- **Path:** `/api/v1/doctors/{doctor_id}`
- **Parameters:**
  - `doctor_id` (Path, integer, required): Unique doctor ID.
- **Request Body:** None
- **Responses:**
  - `200 OK`:
    ```json
    {
      "id": 12,
      "name": "Dr. Sarah Farouk",
      "specialty": "Cardiology",
      "title": "Consultant Cardiologist",
      "description": "Specialist in heart disease, arrhythmias, and hypertension management with 15 years experience.",
      "languages": ["Arabic", "English"],
      "consultation_fee": 350.00,
      "working_days": ["Monday", "Tuesday", "Wednesday", "Thursday"],
      "working_hours": {
        "start": "10:00",
        "end": "18:00"
      }
    }
    ```
  - `404 Not Found`: Doctor not found.

---

### 3.3. GET `/doctors/{doctor_id}/availability`
Retrieves available time slots for a doctor on a specific date.

- **Method:** `GET`
- **Path:** `/api/v1/doctors/{doctor_id}/availability`
- **Parameters:**
  - `doctor_id` (Path, integer, required): Doctor ID.
  - `date` (Query, string `YYYY-MM-DD`, required): Target date.
- **Validation Rules:**
  - `date` must be a valid future or current calendar date.
- **Responses:**
  - `200 OK`:
    ```json
    {
      "doctor_id": 12,
      "doctor_name": "Dr. Sarah Farouk",
      "date": "2026-10-15",
      "slot_duration_minutes": 30,
      "available_slots": [
        "14:00",
        "14:30",
        "15:00",
        "16:30"
      ]
    }
    ```
  - `400 Bad Request`: Invalid date format or date is in the past.
  - `404 Not Found`: Doctor not found.

---

## 4. Appointment Endpoints

### 4.1. GET `/appointments/{appointment_id}`
Retrieves a single appointment by ID.

- **Method:** `GET`
- **Path:** `/api/v1/appointments/{appointment_id}`
- **Parameters:**
  - `appointment_id` (Path, integer, required): Unique appointment ID.
- **Responses:**
  - `200 OK`:
    ```json
    {
      "id": 501,
      "patient_id": 101,
      "doctor_id": 12,
      "doctor_name": "Dr. Sarah Farouk",
      "date": "2026-10-15",
      "time": "14:00",
      "status": "scheduled",
      "notes": "Follow-up ECG check",
      "created_at": "2026-10-01T10:00:00Z",
      "updated_at": "2026-10-01T10:00:00Z"
    }
    ```
  - `404 Not Found`: Appointment not found.

---

### 4.2. POST `/appointments`
Creates and confirms a new appointment.

- **Method:** `POST`
- **Path:** `/api/v1/appointments`
- **Request Body:**
  ```json
  {
    "patient_id": 101,
    "doctor_id": 12,
    "date": "2026-10-15",
    "time": "14:00",
    "notes": "Follow-up consultation"
  }
  ```
- **Validation & Business Rules:**
  - `patient_id` must reference an existing patient.
  - `doctor_id` must reference an existing doctor.
  - `date` and `time` must be in the future.
  - The specified slot must be strictly unbooked for the doctor.
  - The patient must not already have an overlapping appointment.
- **Responses:**
  - `201 Created`:
    ```json
    {
      "id": 502,
      "patient_id": 101,
      "doctor_id": 12,
      "doctor_name": "Dr. Sarah Farouk",
      "date": "2026-10-15",
      "time": "14:00",
      "status": "scheduled",
      "notes": "Follow-up consultation",
      "created_at": "2026-10-04T20:00:00Z"
    }
    ```
  - `409 Conflict`: Slot is already booked or doctor is unavailable.
  - `422 Unprocessable Entity`: Patient or date validation failure.

---

### 4.3. PATCH `/appointments/{appointment_id}`
Reschedules or updates an existing appointment.

- **Method:** `PATCH`
- **Path:** `/api/v1/appointments/{appointment_id}`
- **Parameters:**
  - `appointment_id` (Path, integer, required).
- **Request Body:**
  ```json
  {
    "date": "2026-10-16",
    "time": "15:00",
    "notes": "Rescheduled by patient request"
  }
  ```
- **Validation Rules:**
  - Cannot reschedule an already `cancelled` or `completed` appointment.
  - New date and time must be available.
- **Responses:**
  - `200 OK`:
    ```json
    {
      "id": 501,
      "patient_id": 101,
      "doctor_id": 12,
      "date": "2026-10-16",
      "time": "15:00",
      "status": "rescheduled",
      "notes": "Rescheduled by patient request",
      "updated_at": "2026-10-04T20:05:00Z"
    }
    ```
  - `404 Not Found`: Appointment not found.
  - `409 Conflict`: Requested new slot is unavailable.

---

### 4.4. DELETE `/appointments/{appointment_id}`
Cancels an appointment.

- **Method:** `DELETE`
- **Path:** `/api/v1/appointments/{appointment_id}`
- **Parameters:**
  - `appointment_id` (Path, integer, required).
- **Request Body (optional reason):**
  ```json
  {
    "cancellation_reason": "Patient conflict"
  }
  ```
- **Business Rules:**
  - Updates appointment `status` to `cancelled` (soft-delete / status update).
  - Frees the slot for other patients.
- **Responses:**
  - `200 OK`:
    ```json
    {
      "id": 501,
      "status": "cancelled",
      "cancelled_at": "2026-10-04T20:10:00Z",
      "message": "Appointment 501 successfully cancelled."
    }
    ```
  - `404 Not Found`: Appointment not found.
  - `400 Bad Request`: Appointment is already cancelled or completed.

---

## 5. Clinic Service Endpoints

### 5.1. GET `/services`
Lists clinical services and examinations offered by the clinic.

- **Method:** `GET`
- **Path:** `/api/v1/services`
- **Parameters:**
  - `category` (Query, string, optional): e.g. `Diagnostic`, `Consultation`, `Laboratory`.
- **Responses:**
  - `200 OK`:
    ```json
    {
      "total": 3,
      "services": [
        {
          "id": 1,
          "name": "General Medical Consultation",
          "description": "Comprehensive evaluation by a general practitioner.",
          "price": 200.00,
          "duration_minutes": 20
        },
        {
          "id": 2,
          "name": "Echocardiogram (Echo)",
          "description": "Ultrasound test to assess heart structures and blood flow.",
          "price": 600.00,
          "duration_minutes": 45
        }
      ]
    }
    ```

---

### 5.2. GET `/services/{service_id}`
Retrieves specific details for a clinical service.

- **Method:** `GET`
- **Path:** `/api/v1/services/{service_id}`
- **Parameters:**
  - `service_id` (Path, integer, required).
- **Responses:**
  - `200 OK`:
    ```json
    {
      "id": 2,
      "name": "Echocardiogram (Echo)",
      "description": "Ultrasound test to assess heart structures and blood flow.",
      "price": 600.00,
      "duration_minutes": 45,
      "preparation_instructions": "Wear comfortable two-piece clothing. No fasting required."
    }
    ```
  - `404 Not Found`: Service not found.

---

## 6. Support Ticket Endpoints

### 6.1. POST `/tickets`
Creates a support ticket for non-clinical or technical issues.

- **Method:** `POST`
- **Path:** `/api/v1/tickets`
- **Request Body:**
  ```json
  {
    "patient_id": 101,
    "subject": "Billing inquiry regarding lab test",
    "description": "Patient requested clarification on insurance coverage for Echo exam.",
    "priority": "normal"
  }
  ```
- **Responses:**
  - `201 Created`:
    ```json
    {
      "id": 801,
      "patient_id": 101,
      "subject": "Billing inquiry regarding lab test",
      "description": "Patient requested clarification on insurance coverage for Echo exam.",
      "status": "open",
      "priority": "normal",
      "created_at": "2026-10-04T20:15:00Z",
      "updated_at": "2026-10-04T20:15:00Z"
    }
    ```
  - `400 Bad Request`: Missing required fields.

---

### 6.2. GET `/tickets/{ticket_id}`
Retrieves the status and conversation trail of a support ticket.

- **Method:** `GET`
- **Path:** `/api/v1/tickets/{ticket_id}`
- **Parameters:**
  - `ticket_id` (Path, integer, required).
- **Responses:**
  - `200 OK`:
    ```json
    {
      "id": 801,
      "patient_id": 101,
      "subject": "Billing inquiry regarding lab test",
      "status": "in_progress",
      "priority": "normal",
      "created_at": "2026-10-04T20:15:00Z",
      "updated_at": "2026-10-04T21:00:00Z"
    }
    ```
  - `404 Not Found`: Ticket not found.

---

### 6.3. PATCH `/tickets/{ticket_id}`
Updates the status or assigns a support ticket.

- **Method:** `PATCH`
- **Path:** `/api/v1/tickets/{ticket_id}`
- **Request Body:**
  ```json
  {
    "status": "resolved",
    "resolution_notes": "Insurance claim clarified with Misr Insurance."
  }
  ```
- **Validation Rules:**
  - `status` must be one of: `open`, `in_progress`, `resolved`, `closed`.
- **Responses:**
  - `200 OK`:
    ```json
    {
      "id": 801,
      "status": "resolved",
      "resolution_notes": "Insurance claim clarified with Misr Insurance.",
      "updated_at": "2026-10-04T21:30:00Z"
    }
    ```
  - `404 Not Found`: Ticket not found.

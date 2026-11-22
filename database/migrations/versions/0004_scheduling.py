"""Scheduling storage for availability. Frozen SQL, no application imports."""

from alembic import op

revision = "0004_scheduling"
down_revision = "0003_identity"
branch_labels = None
depends_on = None


def upgrade():
    statements = [
        (
            "CREATE TYPE appointment_status AS ENUM "
            "('scheduled','completed','cancelled','no_show')"
        ),
        (
            "CREATE TYPE appointment_event AS ENUM "
            "('created','time_changed','cancelled','completed','marked_no_show')"
        ),
        "CREATE TYPE actor_type AS ENUM ('patient','clinic_staff','system')",
        (
            "CREATE TABLE clinic_closures (\n            closure_date DATE"
            " PRIMARY KEY, reason_en VARCHAR(255) NOT NULL,\n            "
            "reason_ar VARCHAR(255) NOT NULL, created_at TIMESTAMPTZ NOT "
            "NULL DEFAULT now())"
        ),
        (
            "CREATE TABLE doctor_time_off (\n            id BIGSERIAL "
            "PRIMARY KEY, doctor_id BIGINT NOT NULL REFERENCES "
            "doctors(id) ON DELETE CASCADE,\n            off_date DATE NOT"
            " NULL, start_time TIME, end_time TIME, reason VARCHAR(255),"
            "\n            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),"
            "\n            CONSTRAINT ck_time_off_interval CHECK "
            "((start_time IS NULL AND end_time IS NULL)\n                "
            "OR (start_time IS NOT NULL AND end_time IS NOT NULL AND "
            "end_time > start_time\n                    AND EXTRACT(MINUTE"
            " FROM start_time) IN (0,30) AND EXTRACT(SECOND FROM "
            "start_time)=0\n                    AND EXTRACT(MINUTE FROM "
            "end_time) IN (0,30) AND EXTRACT(SECOND FROM end_time)=0)))"
        ),
        "CREATE INDEX idx_time_off_doctor_date ON doctor_time_off(doctor_id,off_date)",
        (
            "CREATE TABLE appointments (\n            id BIGSERIAL PRIMARY"
            " KEY, patient_id BIGINT NOT NULL REFERENCES patients(id) ON "
            "DELETE RESTRICT,\n            doctor_id BIGINT NOT NULL "
            "REFERENCES doctors(id) ON DELETE RESTRICT,\n            "
            "appointment_date DATE NOT NULL, start_time TIME NOT NULL, "
            "end_time TIME NOT NULL,\n            status "
            "appointment_status NOT NULL DEFAULT 'scheduled', "
            "visit_reason VARCHAR(300),\n            cancellation_reason "
            "VARCHAR(300), cancelled_at TIMESTAMPTZ, cancelled_by "
            "actor_type,\n            created_at TIMESTAMPTZ NOT NULL "
            "DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT "
            "now(),\n            CONSTRAINT ck_appointment_grid CHECK "
            "(EXTRACT(MINUTE FROM start_time) IN (0,30)\n                "
            "AND EXTRACT(SECOND FROM start_time)=0),\n            "
            "CONSTRAINT ck_appointment_duration CHECK "
            "(end_time=start_time + INTERVAL '30 minutes'),\n            "
            "CONSTRAINT ck_appointment_bounds CHECK (start_time>=TIME "
            "'07:00'\n                AND end_time<=TIME '22:00' AND "
            "end_time>start_time),\n            CONSTRAINT "
            "ck_appointment_weekday CHECK (EXTRACT(ISODOW FROM "
            "appointment_date)<>5),\n            CONSTRAINT "
            "ck_appointment_cancellation CHECK (\n                "
            "(status='cancelled' AND cancelled_at IS NOT NULL AND "
            "cancelled_by IS NOT NULL)\n                OR "
            "(status<>'cancelled' AND cancelled_at IS NULL AND "
            "cancelled_by IS NULL)))"
        ),
        (
            "CREATE UNIQUE INDEX uq_doctor_slot_active ON "
            "appointments(doctor_id,appointment_date,start_time) WHERE "
            "status='scheduled'"
        ),
        (
            "CREATE UNIQUE INDEX uq_patient_slot_active ON "
            "appointments(patient_id,appointment_date,start_time) WHERE "
            "status='scheduled'"
        ),
        (
            "CREATE INDEX idx_appointments_patient_date ON "
            "appointments(patient_id,appointment_date)"
        ),
        (
            "CREATE INDEX idx_appointments_doctor_date ON "
            "appointments(doctor_id,appointment_date)"
        ),
        (
            "CREATE TABLE appointment_history (\n            id BIGSERIAL "
            "PRIMARY KEY, appointment_id BIGINT NOT NULL REFERENCES "
            "appointments(id) ON DELETE CASCADE,\n            event "
            "appointment_event NOT NULL, previous_date DATE, "
            "previous_start_time TIME,\n            new_date DATE, "
            "new_start_time TIME, actor actor_type NOT NULL,\n            "
            "conversation_session_id UUID REFERENCES "
            "conversation_sessions(id) ON DELETE SET NULL,\n            "
            "created_at TIMESTAMPTZ NOT NULL DEFAULT now(),\n            "
            "CONSTRAINT ck_history_change CHECK (event<>'time_changed' OR"
            "\n                (previous_date IS NOT NULL AND "
            "previous_start_time IS NOT NULL\n                 AND "
            "new_date IS NOT NULL AND new_start_time IS NOT NULL)))"
        ),
        (
            "CREATE INDEX idx_history_appointment ON "
            "appointment_history(appointment_id,created_at)"
        ),
    ]
    for statement in statements:
        op.execute(statement)
    for table in [
        "clinic_closures",
        "doctor_time_off",
        "appointments",
        "appointment_history",
    ]:
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")
    op.execute(
        "DO $access$\n        DECLARE t text; s text := "
        "current_schema();\n        BEGIN\n          IF s='clinic' THEN"
        "\n            IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE "
        "rolname='clinic_runtime') THEN\n              RAISE EXCEPTION"
        " 'Provision clinic_runtime before private clinic "
        "migrations';\n            END IF;\n            FOREACH t IN "
        "ARRAY "
        "ARRAY['clinic_closures','doctor_time_off',"
        "'appointments','appointment_history']"
        " LOOP\n              EXECUTE format('REVOKE ALL ON TABLE "
        "%I.%I FROM PUBLIC',s,t);\n              IF EXISTS(SELECT 1 "
        "FROM pg_roles WHERE rolname='anon') THEN\n                "
        "EXECUTE format('REVOKE ALL ON TABLE %I.%I FROM anon',s,t);"
        "\n              END IF;\n              IF EXISTS(SELECT 1 FROM"
        " pg_roles WHERE rolname='authenticated') THEN"
        "\n                EXECUTE format('REVOKE ALL ON TABLE %I.%I "
        "FROM authenticated',s,t);\n              END IF;"
        "\n              EXECUTE format('CREATE POLICY backend_access "
        "ON %I.%I TO clinic_runtime USING (true) WITH CHECK "
        "(true)',s,t);\n              EXECUTE format('GRANT "
        "SELECT,INSERT,UPDATE,DELETE ON %I.%I TO "
        "clinic_runtime',s,t);\n            END LOOP;\n            "
        "GRANT USAGE,SELECT ON SEQUENCE "
        "clinic.doctor_time_off_id_seq,\n                "
        "clinic.appointments_id_seq,clinic.appointment_history_id_seq"
        " TO clinic_runtime;\n          END IF;\n        END $access$"
    )


def downgrade():
    for table in [
        "appointment_history",
        "appointments",
        "doctor_time_off",
        "clinic_closures",
    ]:
        op.drop_table(table)
    for name in ["actor_type", "appointment_event", "appointment_status"]:
        op.execute("DROP TYPE " + name)

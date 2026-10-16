FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app
COPY pyproject.toml ./
COPY services/clinic-backend/src services/clinic-backend/src
COPY packages/schemas/src packages/schemas/src
RUN pip install --no-cache-dir . && useradd --create-home clinic
COPY alembic.ini ./
COPY database/migrations database/migrations
COPY database/seed/catalog.json database/seed/catalog.json
COPY database/seed/scheduling.json database/seed/scheduling.json
RUN chmod -R a+rX /app/database/migrations /app/database/seed \
    && chmod a+r /app/pyproject.toml /app/alembic.ini
USER clinic
RUN python -c "from pathlib import Path; import clinic_backend; p=Path(clinic_backend.__file__).parent/'static/supabase-otp.html'; assert '{{ .Token }}' in p.read_text()"
EXPOSE 8000
CMD ["python", "-m", "uvicorn", "clinic_backend.app:create_app", "--factory", "--host", "0.0.0.0", "--port", "8000", "--workers", "1", "--no-proxy-headers"]

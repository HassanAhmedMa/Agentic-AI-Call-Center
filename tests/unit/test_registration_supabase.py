from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
STATIC = ROOT / "services/clinic-backend/src/clinic_backend/static"


def test_registration_uses_supabase_verification_without_persisting_tokens():
    source = (STATIC / "register.js").read_text(encoding="utf-8")
    assert "auth/config" in source
    assert "auth/complete" in source
    assert "type: 'email'" in source
    assert "localStorage" not in source and "sessionStorage" not in source
    html = (STATIC / "register.html").read_text(encoding="utf-8")
    assert "Nile Clinics" in html and 'id="language"' in html
    assert "We also emailed it" not in html

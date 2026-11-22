#!/usr/bin/env python3
"""
Agentic Clinic - Monorepo Foundation & Contract Validator

Runs in CI and local pre-commit checks to ensure repository integrity,
contract completeness, and zero secret leakage.
"""

import fnmatch
import subprocess
import sys
from pathlib import Path

REQUIRED_FILES = [
    # Root files
    "AGENTS.md",
    "README.md",
    "CONTRIBUTING.md",
    "docker-compose.yml",
    ".env.example",
    ".gitignore",
    "LICENSE",
    # GitHub templates & workflows
    ".github/workflows/ci.yml",
    ".github/ISSUE_TEMPLATE/bug_report.md",
    ".github/ISSUE_TEMPLATE/feature_request.md",
    ".github/ISSUE_TEMPLATE/task.md",
    ".github/PULL_REQUEST_TEMPLATE.md",
    ".github/CODEOWNERS",
    # Architecture contracts & feasibility
    "docs/architecture/system-architecture.md",
    "docs/architecture/api-contracts.md",
    "docs/architecture/tool-schemas.md",
    "docs/architecture/data-flow.md",
    "docs/architecture/database-schema.md",
    "docs/architecture/rag-contract.md",
    "docs/architecture/voice-architecture.md",
    "docs/architecture/feasibility-audit.md",
    # Architectural Decisions
    "docs/decisions/README.md",
    "docs/decisions/ADR-001-monorepo.md",
    "docs/decisions/ADR-002-technology-candidates-and-scope-simplification.md",
    # Diagrams & Visualizations
    "docs/diagrams/README.md",
    "docs/diagrams/requirements-traceability.md",
    "docs/diagrams/01-system-context/README.md",
    "docs/diagrams/02-use-cases/README.md",
    "docs/diagrams/03-architecture/README.md",
    "docs/diagrams/04-data/README.md",
    "docs/diagrams/05-sequence/README.md",
    "docs/diagrams/06-component/README.md",
    "docs/diagrams/07-deployment/README.md",
    "docs/diagrams/08-ui/README.md",
    # Development guidelines
    "docs/development/setup.md",
    "docs/development/git-workflow.md",
    "docs/development/coding-standards.md",
    "docs/development/testing-strategy.md",
    # Product specifications
    "docs/product/clinic-scope.md",
    "docs/product/requirements.md",
    "docs/product/ui-ux-guidelines.md",
    # Evaluation
    "docs/evaluation/evaluation-plan.md",
    "docs/evaluation/benchmark-categories.md",
    # Services
    "services/clinic-backend/AGENTS.md",
    "services/clinic-backend/README.md",
    "services/ai-agent/AGENTS.md",
    "services/ai-agent/README.md",
    "services/rag/AGENTS.md",
    "services/rag/README.md",
    "services/voice/AGENTS.md",
    "services/voice/README.md",
    # Packages
    "packages/schemas/README.md",
    "packages/shared/README.md",
    "packages/config/README.md",
    "packages/logging/README.md",
    # Database
    "database/README.md",
    "database/migrations/.gitkeep",
    "database/seed/README.md",
    # Tests
    "tests/integration/README.md",
    "tests/e2e/README.md",
    "tests/evaluation/README.md",
    # Scripts
    "scripts/README.md",
]

FORBIDDEN_FILES = [
    ".env",
    ".env.local",
    "*.pem",
    "*.key",
]


def repository_files(root_dir: Path) -> list[Path]:
    """Check tracked/unignored files, not installed vendor CA bundles or local env.

    --cached includes force-tracked ignored files so .gitignore cannot hide
    a credential that would actually be committed.
    """
    try:
        result = subprocess.run(
            ["git", "ls-files", "--cached", "--others", "--exclude-standard", "-z"],
            cwd=root_dir,
            check=True,
            capture_output=True,
        )
        return [
            root_dir / name.decode("utf-8")
            for name in result.stdout.split(b"\0")
            if name
        ]
    except (OSError, subprocess.CalledProcessError):
        # Exported source archives have no index; scan conservatively.
        vendor_dirs = {".git", ".venv", "venv", "node_modules"}
        return [
            file
            for file in root_dir.rglob("*")
            if file.is_file()
            and not vendor_dirs.intersection(file.relative_to(root_dir).parts)
        ]


def validate_repository(root_dir: Path) -> bool:
    print(f"[*] Validating Agentic Clinic monorepo foundation at: {root_dir}")
    all_passed = True

    # 1. Check required files
    print("\n[Step 1/3] Checking required foundation files and contracts...")
    missing_files = []
    for rel_path in REQUIRED_FILES:
        target = root_dir / rel_path
        if not target.exists():
            missing_files.append(rel_path)

    if missing_files:
        print(f"[-] FAILED: Missing {len(missing_files)} required file(s):")
        for m in missing_files:
            print(f"    - {m}")
        all_passed = False
    else:
        print(f"[+] PASSED: All {len(REQUIRED_FILES)} required foundation files exist.")

    # 2. Check forbidden files / secrets
    print("\n[Step 2/3] Checking for forbidden secret files...")
    secret_found = False
    candidates = repository_files(root_dir)
    for forbidden in FORBIDDEN_FILES:
        matches = [
            file for file in candidates if fnmatch.fnmatchcase(file.name, forbidden)
        ]
        if matches:
            relative_matches = [str(m.relative_to(root_dir)) for m in matches]
            print(f"[-] FAILED: Found forbidden sensitive file(s): {relative_matches}")
            secret_found = True
            all_passed = False

    if not secret_found:
        print("[+] PASSED: No forbidden secret files in repository candidates.")

    # 3. Verify .env.example content safety
    print("\n[Step 3/3] Inspecting .env.example for accidental real secrets...")
    env_example = root_dir / ".env.example"
    if env_example.exists():
        content = env_example.read_text(encoding="utf-8")
        suspicious_words = ["sk-live-", "ghp_", "xoxb-", "AIzaSy"]
        leaks = [word for word in suspicious_words if word in content]
        if leaks:
            print(f"[-] FAILED: Suspicious token pattern in .env.example: {leaks}")
            all_passed = False
        else:
            print("[+] PASSED: .env.example is clean of actual credentials.")

    print("\n" + "=" * 60)
    if all_passed:
        print("[SUCCESS] Repository foundation checks passed.")
        print("=" * 60)
        return True
    else:
        print("[FAILURE] Monorepo validation failed. Please fix the issues above.")
        print("=" * 60)
        return False


if __name__ == "__main__":
    repo_root = Path(__file__).resolve().parent.parent
    success = validate_repository(repo_root)
    sys.exit(0 if success else 1)

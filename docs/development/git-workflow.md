# Git Workflow & Collaboration Standard

> **PROJECT:** Agentic Clinic  
> **SCOPE:** All 5 Student Engineers & AI Coding Agents

---

## 1. Branch Strategy

### `main` is Protected
- `main` always represents stable, deployable code.
- **Direct commits to `main` are strictly prohibited.**
- All merges into `main` require an approved Pull Request and passing CI checks.

### Branches Represent Work, Not People
Branches must describe the specific feature, fix, or task being executed. Never name branches after developers (e.g. avoid `john-branch`, `ahmed-dev`).

### Branch Naming Taxonomy
```
<type>/<kebab-case-short-description>
```

| Type | Intended Work | Example |
| :--- | :--- | :--- |
| `feature/` | New functionality, API endpoints, or AI tools | `feature/doctor-availability-endpoint` |
| `fix/` | Bug fixes or contract corrections | `fix/double-booking-validation` |
| `refactor/` | Code refactoring without behavioral alterations | `refactor/redis-session-manager` |
| `test/` | Adding test suites or evaluation benchmarks | `test/egyptian-arabic-transcripts` |
| `docs/` | Architecture, ADRs, or guideline documentation | `docs/update-tool-schemas` |
| `experiment/` | Temporary spikes and provider benchmarks | `experiment/gemini-live-latency` |

---

## 2. Commit Message Standards (Conventional Commits)

All commits must follow this format:
```
<type>: <short imperative summary>

[optional body explaining why and what]

[optional reference, e.g., Closes #14]
```

### Commit Types:
- `feat:` Introduces a new feature or endpoint.
- `fix:` Patches a bug or resolves an unexpected issue.
- `refactor:` Code refactoring with no API/behavior changes.
- `test:` Introduces or amends test suites.
- `docs:` Documentation additions or updates.
- `chore:` Build scripts, repository housekeeping, dependency updates.
- `perf:` Performance or latency optimizations.
- `security:` Security fixes, secret scanning, or authorization hardening.

---

## 3. Pull Request & Review Protocol

1. **Self-Review:** Before requesting a review:
   - Check `git diff` for stray print statements, debug flags, or unexpected files.
   - Run `python scripts/validate_repo.py`.
   - Ensure zero secrets or real patient data are present.
2. **Open PR:** Use `.github/PULL_REQUEST_TEMPLATE.md`.
3. **Mandatory Peer Review:**
   - At least one human team member must review and approve the PR.
   - The author of the PR cannot approve or merge their own code.
   - Review duty rotates across the 5 team members to ensure shared ownership.
4. **Squash and Merge:** PRs are merged via "Squash and Merge" to maintain a clean linear history on `main`.

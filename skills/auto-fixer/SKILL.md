---
name: auto-fixer
version: 1.0.0
description: Autonomously finds issues in code and fixes them in a loop. Runs security_scan + complexity_score + find_todos, triages by severity, creates tasks for each issue, then fixes them one by one. Stops when health_score improves or all critical issues are resolved.
category: quality
autoTrigger:
  - "fix all issues"
  - "auto fix"
  - "clean up the code"
  - "resolve all warnings"
  - "fix everything"
  - "fix all bugs"
  - "automated cleanup"
requiredTools:
  - security_scan
  - find_secrets
  - complexity_score
  - find_todos
  - audit_file
  - task_create
  - health_score
outputFormat: markdown
estimatedMinutes: 10
---

# Auto Fixer

## Purpose
Run an autonomous scan-triage-fix-verify loop on a target path. Finds all detectable issues, prioritizes them by severity, and applies fixes in order — stopping only when all CRITICAL and HIGH issues are resolved or the health score has meaningfully improved.

## Steps

### 1. Baseline
Call `health_score` on the target path and record the result. This is the baseline score that all later improvements are measured against.

```
Baseline health score: {score}/100
```

### 2. Discovery
Run the following four tools in parallel (they are independent):
- `security_scan` — OWASP-pattern vulnerabilities
- `find_secrets` — hardcoded credentials, API keys, tokens
- `find_todos` — TODO, FIXME, HACK, XXX comments
- `complexity_score` — cyclomatic complexity per function

Collect all findings into a unified issue list before proceeding.

### 3. Triage
Sort the unified issue list by severity tier. Do not mix tiers:

| Tier | Criteria |
|------|----------|
| CRITICAL | Any finding from `security_scan` or `find_secrets` |
| HIGH | Cyclomatic complexity > 10, or any `audit_file` violation rated high |
| MEDIUM | Cyclomatic complexity 6–10, code quality violations rated medium |
| LOW | TODOs, style issues, minor quality findings |

Within each tier, sort by file path for deterministic ordering.

### 4. Task Creation
Call `task_create` for every CRITICAL and HIGH issue. Each task's `miniPrompt` must describe:
- The exact file and line number
- What the current code does that is wrong
- What the fix should produce
- How to verify the fix is complete

Skip task creation for MEDIUM and LOW — they are logged in the report but not fixed in this run unless no CRITICAL/HIGH issues exist.

### 5. Fix Loop
For each CRITICAL task, then each HIGH task (in severity order):

a. Call `get_context` on the affected file to load the full surrounding context
b. Apply the fix as described in the task's `miniPrompt`
c. Call `audit_file` on the modified file to verify:
   - The original issue is no longer present
   - No new issues were introduced by the fix
d. If `audit_file` finds a new issue, fix that immediately before moving to the next task
e. Mark the task status as done

If a fix cannot be applied safely (e.g., requires architectural change), flag it as DEFERRED and move on. Never leave a file in a broken state.

### 6. Verification
After all CRITICAL and HIGH tasks are resolved, call `health_score` again on the same target path. Calculate the delta:

```
Before: {baseline}/100
After:  {new_score}/100
Delta:  +{delta} points
```

If the delta is negative, something went wrong — surface the regression immediately and do not report success.

### 7. Report
Output a structured summary:

```
## Auto Fixer Report: {path}

### Score
- Before: {baseline}/100
- After: {new_score}/100
- Improvement: +{delta} points

### Fixed
- {N} CRITICAL issues resolved
- {M} HIGH issues resolved

### Remaining
- {K} MEDIUM issues (logged, not fixed this run)
- {J} LOW issues (logged, not fixed this run)
- {D} DEFERRED issues (require architectural change)

### Deferred Issues
{list with explanation for each}
```

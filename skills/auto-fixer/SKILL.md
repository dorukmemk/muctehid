---
name: auto-fixer
description: Autonomously scans, triages, and fixes code issues in severity order. Runs a full discovery scan (security, secrets, complexity, TODOs), creates a traceable task for each issue, then applies fixes in CRITICAL → HIGH → MEDIUM order with verification after each fix. Use when asked to "fix all issues", "clean up code", or "resolve warnings".
license: MIT
---

# Auto Fixer

Guessing what's broken is the fastest way to introduce new bugs. This skill never guesses — it scans first, builds a triage table, then fixes in strict severity order. The scan produces a baseline health score before any change is made. Every fix is verified against that baseline. If a fix introduces a regression, it is caught immediately before the next fix is attempted. The result is a code health improvement that is measurable, traceable, and never leaves the codebase in a worse state than it started.

## Core Principle

```
Scan everything  →  Triage by severity  →  Fix CRITICAL first
        ↓                    ↓                      ↓
  health_score          Sort: CRITICAL         Verify each fix
  (baseline)            HIGH, MEDIUM,          before next one
                        LOW
        ↓                    ↓                      ↓
  Never touch         Never fix LOW          Score after all
  without measuring   while CRITICAL         fixes > baseline
  first               exist
```

## Quick Start

- Run `health_score` on the target path first — record the baseline
- Run all 4 discovery tools in parallel: `security_scan`, `find_secrets`, `find_todos`, `complexity_score`
- Build the triage table: CRITICAL, HIGH, MEDIUM, LOW
- Fix CRITICAL first, then HIGH; create a `task_create` for each before fixing it

## File Purposes

| File | Purpose | When to Update |
|------|---------|----------------|
| Auto Fixer Report | Final output summarizing scores, fixes, and deferrals | After all CRITICAL and HIGH fixes complete |
| task_create entries | Traceability record for each issue | Before fixing (not after) |

## Critical Rules

### 1. Always Baseline Before Touching Anything
Call `health_score` on the target path before making any changes. Record the exact score. Every subsequent improvement is measured against this baseline. Without a baseline, there is no way to know whether the session improved or degraded code health. A negative delta is a failure, even if all "fixes" ran successfully.

### 2. Run Discovery in Parallel
All four discovery tools (`security_scan`, `find_secrets`, `find_todos`, `complexity_score`) are independent. Run them simultaneously. Do not run them sequentially — sequential execution wastes time and creates artificial ordering that can bias triage.

### 3. Triage Tier Is Immutable
The severity tier of an issue is determined at triage time and does not change. Do not upgrade a MEDIUM to HIGH because it "seems important." Do not downgrade a CRITICAL because fixing it is inconvenient. The tiers are:
- **CRITICAL**: Any `security_scan` or `find_secrets` finding. Unfixed CRITICALs mean the codebase has active security vulnerabilities. These are always fixed first.
- **HIGH**: Cyclomatic complexity > 10, or any `audit_file` violation rated HIGH. High-complexity code is hard to maintain and test — these are the highest-probability sources of future bugs.
- **MEDIUM**: Complexity 6–10, quality violations rated MEDIUM. Not urgent, but creates accumulating technical debt.
- **LOW**: TODOs, style issues, minor quality findings. Fix last, or not at all in this run if CRITICAL/HIGH exist.

### 4. Never Fix LOW While CRITICAL Exist
If CRITICAL issues exist, do not touch LOW or MEDIUM issues in the same run. Fixing a TODO while a SQL injection vulnerability exists is not "making progress" — it is noise. Severity ordering is absolute.

### 5. Create task_create Before Fixing (Not After)
Before applying any fix, create a task for the issue. The task must include: exact file, exact line, what's wrong, what the fix produces, how to verify. This provides traceability: if a fix is questioned later, the task record shows what was intended and why.

### 6. Verify Every Fix With audit_file
After each fix, call `audit_file` on the modified file. Verify:
(a) The original issue is gone
(b) No new issues were introduced
If `audit_file` finds a new issue introduced by the fix, resolve it immediately before moving to the next task. Never leave a fix-induced regression open.

### 7. DEFERRED Is a Valid Outcome
If a fix requires an architectural change, external approval, or touching code outside the task's scope, mark it DEFERRED. A DEFERRED issue is not a failed fix — it is an honest acknowledgment that the issue exists and was intentionally left for a future, appropriately scoped effort. Never force a fix that would destabilize unrelated systems.

## The 3-Strike Error Protocol

```
ATTEMPT 1: Apply the fix as described in the task's miniPrompt.
           Run audit_file. If it passes, mark done and move on.

ATTEMPT 2: If the fix caused a regression: revert the change.
           Analyze the regression — understand why the fix broke something.
           Apply a revised fix that addresses both the original issue and the regression.
           Run audit_file again.

ATTEMPT 3: If the second fix also causes a regression: revert again.
           Isolate the minimal code change needed to fix just the original issue.
           Apply the minimal fix. Run audit_file.

AFTER 3 FAILURES: Mark the issue DEFERRED with full context:
  "BLOCKED: Attempted 3 fixes for {issue}. Each attempt caused a regression in {file}.
   Root cause appears to be: {analysis}. Requires architectural change or user decision.
   Do not attempt a 4th approach without escalation."
```

## When to Use This Skill

**Use for:**
- "Fix all issues in src/"
- "Clean up the authentication code"
- "Resolve all warnings before the release"
- "Auto fix everything"
- Pre-release code hardening passes
- Post-merge cleanup after a large feature branch

**Skip for:**
- Single, specific bug fixes (just fix the bug directly)
- Style-only cleanup with no security or quality concerns (use a linter instead)
- Architectural refactors (use `refactor-planner` — auto-fixer makes local fixes, not structural changes)
- Tasks where the user already knows exactly what to fix (skip triage, apply the fix directly)

## Anti-Patterns

| Don't | Do Instead |
|-------|------------|
| Fix issues without a baseline health score | Always run health_score first — you need the before number |
| Run discovery tools one at a time | Run all 4 in parallel — they're independent |
| Fix LOW issues while CRITICAL exist | Finish all CRITICAL, then HIGH, then consider MEDIUM/LOW |
| Apply a fix without running audit_file after | Verify every single fix — regressions must be caught immediately |
| Create task_create after fixing | Create the task before fixing — traceability requires prior documentation |
| Declare "done" without a final health_score | Always produce the before/after delta — no delta = no proof |
| Force-fix a DEFERRED issue | Mark it DEFERRED with full context; don't break the codebase trying to fix what isn't fixable in scope |

---

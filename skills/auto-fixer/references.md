# References: Severity Triage and Single-Action Execution Methodology

These principles are adapted from the Manus AI agent design philosophy, applied specifically to automated code fixing. The core insight is that fixing issues without a systematic baseline, triage, and verification loop is indistinguishable from guessing — and guessing introduces as many problems as it solves.

---

## Principle 1: Severity Is Fixed at Discovery Time — Never Re-Triaged
> "Triage once. Fix in order. Never re-triage because a fix is inconvenient."

The severity tiers exist to eliminate subjective priority negotiations during the fix session. When triage is done correctly at discovery time — before any code is touched — every subsequent decision is mechanical: fix CRITICAL, then HIGH, then MEDIUM, then LOW. There is no case where a MEDIUM issue gets fixed before a CRITICAL one exists. There is no "but this TODO is really important" exception.

Re-triaging mid-fix is a failure mode that allows cognitive bias to enter: the issue currently being looked at always feels most important. Fix the tier, not the feeling.

The four tiers and their invariants:
- **CRITICAL:** Any security finding from `security_scan` or `find_secrets`. Unfixed CRITICALs mean active vulnerabilities in production. Always fixed first, no exceptions.
- **HIGH:** Cyclomatic complexity > 10, or HIGH-rated findings from `audit_file`. High-complexity code has disproportionately more bugs and is harder to test — these are the highest-probability future failure sources.
- **MEDIUM:** Complexity 6–10, MEDIUM-rated audit violations. Not urgent, but accumulating technical debt.
- **LOW:** TODOs, style issues, minor quality findings. Fix last, or defer entirely if CRITICAL/HIGH exist in this run.

---

## Principle 2: Single-Action Execution — One Fix, One Verify
> "Never apply two fixes simultaneously. Fix one issue. Verify. Then fix the next."

The single-action execution principle means: after each fix, `audit_file` runs before the next fix begins. This is not optional — it is the mechanism that catches regressions immediately, while the context of what was just changed is still fresh.

Why single-action matters:
- A fix that introduces a new issue is a net regression, even if the original issue is resolved
- If two fixes are applied simultaneously and a regression appears, it is impossible to know which fix caused it without reverting both
- Single-action execution makes every fix independently verifiable and independently reversible

The verification gate after each fix checks two conditions:
1. The original issue is gone (confirmed by `audit_file`)
2. No new issues were introduced (confirmed by the same `audit_file` run)

If condition 2 fails — a new issue was introduced — the regression must be resolved immediately before moving to the next task. Leaving a fix-induced regression open violates the invariant that the codebase after the run is in a better state than before.

---

## Principle 3: The Baseline-Delta Accountability Model
> "If you cannot show the before and after score, you cannot claim the codebase improved."

The `health_score` before/after delta is not a vanity metric — it is the accountability mechanism for the entire fix session. It answers the only question that matters: did this session make the codebase better or worse?

A session that fixed 10 LOW issues but left the health_score flat (or worse, let it regress) is a failed session regardless of how many commits were made. A session that fixed 1 CRITICAL and improved the health_score by 15 points is a successful session, regardless of the total issue count.

The delta also catches a subtle failure mode: fixing one issue while introducing two new ones produces a negative delta even though the count of "fixed" issues is positive. Without the delta, this failure is invisible.

The baseline must be recorded before any change is made. Without the before score, there is no delta to calculate.

---

## Principle 4: Preserve Failures — The DEFERRED Mechanism
> "A fix that destabilizes the codebase is worse than no fix. DEFERRED is a valid outcome."

Some issues should be fixed immediately. Others should be documented and deferred. The DEFERRED mechanism exists to prevent a specific failure mode: forcing a fix that requires architectural change, external approval, or scope expansion beyond the current task.

A DEFERRED issue is:
- Explicitly acknowledged (its severity is known and documented)
- Traceable (a `task_create` record exists with full context)
- Actionable (the record describes what would be required to fix it)
- Not a failure (the codebase is not worse for having left it DEFERRED with documentation)

DEFERRED is appropriate when:
- The fix requires refactoring a shared base class that other teams own
- The fix requires changing a public API contract without a migration plan
- Three fix attempts have each produced regressions (3-Strike Protocol)
- The fix is in code scheduled for replacement in the next sprint

DEFERRED is not appropriate for: avoidance, convenience, or "it's too hard." The 3-Strike Protocol is the mechanism that distinguishes legitimate deferrals from avoidance.

---

## Principle 5: Task-Per-Issue Traceability — Create Before Fixing
> "Create the task before the fix. The task is the paper trail that makes the fix auditable."

Each issue gets its own `task_create` call before any code is touched. The task must be created before (not after) the fix for three reasons:

1. **Audit trail**: If someone asks "why was line 47 changed?" in a code review or post-incident analysis, the task record explains the issue and the intended fix. A task created after the fix cannot serve as a prior record of intent.

2. **Interruption recovery**: If the fix session is interrupted mid-way through 8 issues, the open task list shows exactly which issues were fixed and which remain. Without pre-created tasks, the recovery requires re-running all discovery tools.

3. **Regression traceability**: If a fix introduces a regression discovered days later, the task record shows what was intended versus what was done — essential for diagnosis.

The task's description must be specific: exact file, exact line, before-state, after-state, verification method. Vague tasks ("fix the security issue in queries.ts") are not traceable — they cannot be independently verified or reviewed.

---

## Principle 6: Parallel Discovery, Sequential Fixing
> "Run discovery tools in parallel. Run fixes sequentially. Never mix the two patterns."

The discovery phase and the fix phase have opposite optimal strategies:

**Discovery must be parallel.** All four discovery tools (`security_scan`, `find_secrets`, `find_todos`, `complexity_score`) are independent — they examine the same codebase from different angles and produce non-overlapping findings. Running them sequentially wastes time and creates artificial ordering. Run all four simultaneously, collect all findings, then build the triage table.

**Fixing must be sequential.** Each fix modifies the codebase. The post-fix `audit_file` must run against the modified codebase, not the original. If two fixes are applied simultaneously and one introduces a regression, the audit cannot attribute the regression to the correct fix. Sequential execution — fix, verify, fix, verify — ensures full traceability and immediate regression detection.

The transition between the two phases is explicit: after the triage table is built and all tasks are created, the discovery phase is over and the sequential fix phase begins. These phases do not overlap.

---

## The Agent Loop in auto-fixer Context

```
ANALYZE  → health_score(baseline); run 4 discovery tools in parallel
THINK    → Build triage table; sort by CRITICAL → HIGH → MEDIUM → LOW
SELECT   → Pick the highest-severity unfixed issue; create task_create before touching code
EXECUTE  → Apply the fix to the single target file
OBSERVE  → audit_file on the modified file: original issue gone? no new issues?
ITERATE  → If clean: mark done, pick next. If regression: 3-Strike Protocol applies.
           After all CRITICAL+HIGH: health_score(final) → verify delta > 0
```

The loop has one non-negotiable invariant: `health_score(final) > health_score(baseline)`. A run that ends with a negative or zero delta is a failed run regardless of issue count.

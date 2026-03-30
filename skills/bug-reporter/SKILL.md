---
name: bug-reporter
version: 2.0.0
description: >-
  Root-cause analysis, fix proposal, and traceability for bugs. Combines stack trace analysis,
  git blame, semantic code search, security impact assessment, and regression risk scoring.
  Creates a structured bug report with a concrete fix and a tracked task.
  Use when: (1) there's a bug/error/crash/exception, (2) "bug", "broken", "fix", "hata",
  "error", "exception", "crash", "it's not working" are mentioned.
author: muctehid-mcp
category: quality
type: prompt
license: MIT
triggers:
  - "bug"
  - "broken"
  - "exception"
  - "crash"
  - "error"
  - "hata"
  - "it's not working"
  - "stack trace"
tools:
  - run_command
  - search_code
  - get_context
  - security_scan
parameters:
  symptom:
    type: string
    description: "The error message, stack trace, or symptom description"
  file:
    type: string
    description: "Primary file where the bug was observed (optional)"
output:
  format: markdown
---

# Bug Analysis & Fix Specialist

Guessing at root causes wastes time and introduces new bugs. This skill never guesses — it traces from symptom → root cause → fix with evidence from git history, code context, and security analysis. The output is a structured report with a concrete, minimal fix and a tracked task.

## Core Principle

```
Symptom → Stack Trace → Root Cause → Affected Scope → Fix → Verify
         ↑                ↑               ↑              ↑
     git blame      search_code      security_scan   regression test
```

## Quick Start

```
1. Run: python skills/bug-reporter/scripts/git_blame_analyzer.py {file} {line}
2. Use search_code to find similar patterns in the codebase
3. Check if the bug has security implications
4. Write the minimal fix
5. Create a task with task_create
```

## Critical Rules

### 1. Evidence Before Fix
Never propose a fix without first:
- Identifying the exact line(s) where the bug originates (not just where it manifests)
- Confirming via git blame when and why the bug was introduced
- Checking whether the same bug pattern exists elsewhere in the codebase

### 2. Root Cause ≠ Symptom
```
❌ Root cause: "The API returns 500"   (that's the symptom)
✅ Root cause: "JWT verify is called with null secret because JWT_SECRET is
                undefined in test environment — see auth.ts:47"
```

### 3. Minimal Fix Principle
The fix should change the minimum code necessary to resolve the root cause. No refactoring. No "while we're here" changes. A minimal fix is:
- Reviewable in one diff screen
- Tested by one or two new test cases
- Doesn't change any behavior except the one that was broken

### 4. Regression Risk Scoring
Every fix must include a regression risk score:
- **LOW**: Change is isolated to one function, full test coverage exists
- **MEDIUM**: Change touches shared utilities or middleware
- **HIGH**: Change touches auth, payments, data migrations, or public API contracts

### 5. Security Boundary Check
For every bug: ask — can this bug be triggered by an external actor?
- If YES → it's not just a bug, it may be a **vulnerability** → invoke `security-audit` skill
- If NO → standard bug severity applies

## Process Workflow

### Phase 1: Symptom Analysis
Parse the error/symptom to extract:
- Error type (TypeError, AuthenticationError, etc.)
- File + line number (from stack trace)
- The triggering condition (what input/state caused it)

### Phase 2: Git Blame Trace
```bash
python skills/bug-reporter/scripts/git_blame_analyzer.py {file} {start_line} {end_line}
```
Output:
- Which commit introduced the broken code
- Author and date
- The original intent (from commit message)
- Whether this was a regression (code was once correct)

### Phase 3: Codebase Impact Scan
Use `search_code` to find:
- Same bug pattern repeated elsewhere (copy-paste bug?)
- All callers of the buggy function (blast radius)
- Related test files (do tests exist? do they pass?)

### Phase 4: Security Assessment
Call `security_scan` on the buggy file. If the bug involves:
- User input validation → check for injection
- Authentication/authorization → check access control
- Data serialization → check for insecure deserialization

### Phase 5: Write the Fix
The fix must include:
1. Exact file + line to change
2. Before/after code snippet
3. One-sentence explanation of why this fixes the root cause
4. How to verify the fix (test command or manual steps)

### Phase 6: Create Task
```
task_create(
  title: "Bug: {one-line description}",
  category: "bug",
  severity: CRITICAL|HIGH|MEDIUM|LOW,
  file: "{filepath}:{line}",
  description: "{root cause}",
  fix: "{minimal fix description}",
  verification: "{how to verify}"
)
```

## Bug Report Template

```markdown
## Bug Report: {title}

**Severity:** {CRITICAL | HIGH | MEDIUM | LOW}
**Status:** Open → In Fix → Verified

### Symptom
{What was observed — exact error message or behavior}

### Root Cause
{The actual source of the bug — file, line, why it happens}

### Introduced In
- **Commit:** {hash from git blame}
- **Author:** {author}
- **Date:** {date}
- **Commit message:** {message — explains original intent}

### Affected Files
| File | Line | Role |
|------|------|------|
| {file} | {line} | Primary source |
| {file} | {line} | Affected caller |

### Security Impact
{NONE | Potential injection | Auth bypass | Data exposure — explain}

### Fix
**File:** {filepath}:{line}
**Change:**
\```diff
- {old code}
+ {new code}
\```
**Why this fixes it:** {one-sentence explanation}

### Regression Risk: {LOW | MEDIUM | HIGH}
{Explain why: what could break, what tests cover this}

### Verification
{Command or steps to verify the fix works}

### Same Pattern Elsewhere?
{List any other files with the same bug pattern}
```

## Severity Tiers

| Severity | When to Use |
|----------|-------------|
| **CRITICAL** | Data loss, security breach, production down |
| **HIGH** | Core feature broken, significant user impact |
| **MEDIUM** | Feature partially broken, workaround exists |
| **LOW** | Edge case, cosmetic issue, minor inconvenience |

## Anti-Patterns

| Don't | Do Instead |
|-------|------------|
| Fix the symptom without finding root cause | Trace from symptom to root cause before writing a fix |
| Write a fix larger than the bug requires | Minimal fix only — no refactoring alongside bug fixes |
| Skip git blame | Git blame tells you when it was introduced and why |
| Ignore similar patterns elsewhere | Search codebase for same bug before closing the report |
| Skip regression risk | Every fix has a regression risk score |

## Available Scripts

- `git_blame_analyzer.py`: Analyzes git blame for a file/line range, extracts commit metadata, identifies when code changed, and checks if it's a regression

---

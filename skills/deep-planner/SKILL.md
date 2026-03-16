---
name: deep-planner
description: Creates a persistent 3-file planning system under .plan/ for any complex, multi-step task. Use when a task has more than 3 sequential steps, multiple unknowns, or a risk of goal drift across sessions.
license: MIT
---

# Deep Planner

Complex tasks fail not because of bad code — they fail because context evaporates. The context window is volatile RAM: it disappears on `/clear`, on session restart, on context compression. The filesystem is persistent disk: it survives all of that. This skill externalizes the entire cognitive state of a task into three files so that any session, at any point, can reconstruct exactly where things stand and continue without loss. The goal is never "make a plan" — the goal is to make the plan a living document that guides every action and records every decision.

## Core Principle

```
Context Window (volatile RAM)  +  Filesystem (persistent disk)
          ↕                               ↕
  What you're thinking now        What actually happened
          ↓                               ↓
     Evaporates on /clear          Survives forever
                    ↓
         Write everything important to disk
         Read from disk before every major decision
```

## Quick Start

- Run `analyze_complexity` on the task description to determine phase count
- Create `.plan/task_plan.md` with Goal + Phases before writing a single line of code
- Create `.plan/findings.md` and `.plan/progress.md` immediately after
- Start Phase 1 — and after every 2 research operations, flush to `findings.md`

## File Purposes

| File | Purpose | When to Update |
|------|---------|----------------|
| `.plan/task_plan.md` | North-star goal + phase checkboxes | Only to check off completed items; never change the Goal sentence |
| `.plan/findings.md` | Research log, decisions, blockers, resources | Every 2 research operations (2-Action Rule); after every architectural decision |
| `.plan/progress.md` | Session-by-session action log | On session start (new header), after each completed sub-task, on session end |

## Critical Rules

### 1. Plan First, Code Never First
Create all three `.plan/` files before taking any implementation action. If you open a code file before `task_plan.md` exists, you are already operating without a plan. The files are not documentation — they are the working memory of the task.

### 2. The 2-Action Rule
After every 2 research operations (any call to `search_code`, `research_topic`, `get_context`, `audit_file`, `git_blame_context`, `commit_history_search`, or equivalent), immediately append to `.plan/findings.md`. Never defer this. Deferring means the finding may never get written if the session ends first.

### 3. Re-Read Before Every Major Decision
Before making any architectural decision, phase transition, or choosing between two implementation approaches — read `.plan/task_plan.md` first. This is an attention refresh: it re-anchors you to the Goal and prevents local-optimum decisions that drift from the original intent. The act of re-reading is not busywork; it is the mechanism that prevents drift.

### 4. Phase Gates Are Hard Stops
Do not begin Phase N+1 until every checkbox in Phase N is marked `[x]`. A half-finished phase is worse than no phase — it creates false confidence. If a phase sub-task turns out to be impossible, either decompose it further or explicitly mark it DEFERRED with a reason, then continue. A DEFERRED item is still a closed item.

### 5. Log All Errors, Even Resolved Ones
When something fails — a tool call returns an error, an approach doesn't work, a fix creates a regression — log it in `.plan/findings.md` under **Issues**, even after it's resolved. The resolved-error log is the most valuable part of the file: it prevents the same mistake from being made again later in the same task.

### 6. The Goal Sentence Is Immutable
The single Goal sentence in `task_plan.md` must never be edited after it is written. It is the anti-drift anchor. If the goal genuinely changes, start a new plan. Editing the goal mid-task means the task was re-scoped, and all prior decisions may be invalid.

## The 3-Strike Error Protocol

```
ATTEMPT 1: Try the original approach. Log the error in findings.md under Issues.
ATTEMPT 2: Try a different approach (different tool, different input, different strategy).
            Document what changed and why in findings.md.
ATTEMPT 3: Try a minimal reproduction — isolate the smallest failing case.
            Document the isolation result in findings.md.
AFTER 3 FAILURES: Stop. Write a clear escalation note in progress.md:
  "BLOCKED: {what I tried}, {what failed each time}, {what I need from the user}"
  Do not attempt a 4th approach autonomously. Escalate to User.
```

## When to Use This Skill

**Use for:**
- Tasks with 3 or more sequential phases
- Tasks with significant unknowns that require research before implementation
- Tasks that will span multiple sessions or likely exceed one context window
- Refactors, feature implementations, architectural changes
- Any task where the user says "plan this", "implement this", "build this", "architect this"

**Skip for:**
- Single-step operations (rename a variable, fix a typo)
- Tasks that can be completed in under 5 minutes with high certainty
- Pure research tasks with no implementation component (use `deep-dive` instead)
- Tasks already covered by an existing `.plan/` directory from a prior session (use `session-restore` instead)

## Anti-Patterns

| Don't | Do Instead |
|-------|------------|
| Start coding before creating task_plan.md | Create all 3 files first, then open the first code file |
| Keep findings in your head between tool calls | Flush to findings.md every 2 research operations |
| Edit the Goal sentence when scope changes | Create a new plan; note the scope change in the old progress.md |
| Skip phase gates to "save time" | Complete every checkbox; a DEFERRED item is better than a skipped one |
| Try a 4th approach after 3 failures | Escalate with a clear BLOCKED note — the user has context you don't |
| Create task_plan.md with vague phases like "do the backend" | Every phase must have 2–5 concrete, verifiable sub-task checkboxes |
| Log only successes in progress.md | Log every action, including failed attempts and what was learned |

---

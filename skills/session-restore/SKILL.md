---
name: session-restore
description: Restores full working context after a session reset, /clear command, context compression, or overnight break. Reads .plan/ files from disk back into active context and resumes work exactly where it stopped. Use at the start of any session that continues a prior task.
license: MIT
---

# Session Restore

The context window is RAM: fast, powerful, and completely erased the moment the session ends or `/clear` is issued. The `.plan/` files are disk: slow to write, but they survive everything. When RAM is wiped, you don't rebuild the machine — you read the disk back into RAM. That is exactly what this skill does: it reads task_plan.md, progress.md, and findings.md from disk and reconstructs the complete working context in under 60 seconds. The result is a precise answer to "where were we?" and a concrete first action to take — no re-research, no re-planning, no loss.

## Core Principle

```
/clear wipes the context window
         ↓
 Context = empty (RAM erased)
         ↓
.plan/ files still exist (disk intact)
         ↓
Read disk → reconstruct RAM
         ↓
Answer 5 questions → know exactly where to resume
         ↓
Append new session header → audit trail is continuous
```

## Quick Start

- Check if `.plan/` directory exists before doing anything else
- If it exists: read all 3 files, fill in the 5-Question Reboot Check, resume
- If it doesn't exist: run `deep-planner` first — there is no context to restore
- After restoring: append a new session header to `progress.md` (never overwrite)

## File Purposes

| File | What to Extract | Key Question Answered |
|------|----------------|----------------------|
| `.plan/task_plan.md` | Goal sentence + last incomplete phase | "Where am I going and what's left?" |
| `.plan/progress.md` | Last session block + open action items | "What was the last thing I did?" |
| `.plan/findings.md` | Decisions + Issues (especially open ones) | "What do I know and what's still blocked?" |

## Critical Rules

### 1. Always Check .plan/ First
Before any other action in a session that continues prior work, check if `.plan/` exists and contains valid files. Do not trust memory — do not assume you know where the task was. Read the files. This rule has no exceptions: even if you are 100% confident you remember, read the files anyway. Memory is exactly what gets wiped on session reset.

### 2. Answer the 5 Questions Verbatim
The 5-Question Reboot Check must be answered out loud (written out, not summarized). Every question matters:
- Q1 (Where am I?) — identifies the current phase and last sub-task
- Q2 (Where am I going?) — identifies all remaining work, preventing premature declaration of completion
- Q3 (What is the goal?) — reads the Goal sentence verbatim from task_plan.md, re-anchoring against drift
- Q4 (What have I learned?) — surfacing key findings prevents re-doing research
- Q5 (What have I done?) — reviewing completed work prevents re-doing implementation

Skipping or abbreviating any of these questions defeats the purpose of the restore.

### 3. Call task_next After Restoring
After reading the files and answering the 5 questions, call `task_next` to get the highest-priority pending task from the task system. Cross-reference this with the first unchecked item in the current phase of task_plan.md. If they conflict, task_plan.md takes priority (it has the full context), and the discrepancy should be noted in progress.md.

### 4. Append, Never Overwrite progress.md
The new session header must be appended to the bottom of `progress.md`. Never overwrite or truncate prior sessions. The full session history is the audit trail — it shows exactly when decisions were made, what was tried, and how the task evolved. Overwriting destroys this.

### 5. Verify Currency of Key Findings
If `findings.md` references external resources (API docs, library versions, specific code files) that may have changed since the last session, call `research_topic` or `get_context` to verify they are still current. A finding based on a stale library version can lead to implementing the wrong solution. This verification is especially important if more than 24 hours have passed since the last session.

### 6. If No .plan/ Files: Run deep-planner First
If `.plan/` doesn't exist, there is no disk state to restore from. This means either: (a) the task was never planned, or (b) the files were deleted. In either case, do not attempt a restore — invoke `deep-planner` to create the planning baseline, then begin the task fresh. Do not attempt to "reconstruct from memory" what the plan might have been.

## The 3-Strike Error Protocol

```
ATTEMPT 1: Read all 3 .plan/ files normally. Extract context. Answer 5 questions.
           If a file is missing: note which one is missing and what context is lost.

ATTEMPT 2: If task_plan.md is missing, use task_list + spec_list to reconstruct.
           If progress.md is missing, use findings.md + task_list for context.
           If findings.md is missing, use progress.md and re-run relevant research.

ATTEMPT 3: If all 3 files are missing or corrupted: run deep-planner from scratch.
           Document in new progress.md why a fresh start was needed.

AFTER 3 FAILURES: Escalate to User.
  "BLOCKED: .plan/ files are missing/corrupted. I cannot reconstruct the task state.
   To continue: please tell me (1) what we were building, (2) where we were in the process,
   (3) any key decisions already made. I will recreate the plan files from your input."
```

## When to Use This Skill

**Use for:**
- The first message of a new session that says "continue", "resume", "pick up where", "where were we"
- After any `/clear` command that wiped context mid-task
- After context compression (when earlier parts of the conversation are no longer in the active window)
- After an overnight or multi-day break from a task
- When the user returns to a task they started in a previous conversation

**Skip for:**
- New tasks (use `deep-planner` instead)
- Tasks without `.plan/` files (use `deep-planner` to create them)
- Single-session tasks that are completing within the same session
- When the user explicitly says they want to start over (don't restore — acknowledge and plan fresh)

## Anti-Patterns

| Don't | Do Instead |
|-------|------------|
| Trust your in-context memory of prior work | Read the .plan/ files — memory is exactly what gets wiped |
| Overwrite progress.md with a fresh start | Append a new session header; the old sessions are the audit trail |
| Skip the 5-Question Reboot Check | Answer all 5 questions in full — each one catches a different failure mode |
| Begin coding before answering the 5 questions | Restore context fully, then act |
| Assume task_plan.md is current without reading it | The goal or phase structure may have evolved — always read fresh |
| Re-run research that's already in findings.md | Check findings.md first — avoid duplicating completed work |
| Ignore open Issues in findings.md | Open issues are active blockers; review them before resuming |

---

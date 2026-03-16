---
name: session-restore
version: 1.0.0
description: Restores context after a session reset or context limit. Reads .plan/ files and answers the 5-Question Reboot Check to resume work exactly where it left off. Use when starting a new session on an existing task.
category: planning
autoTrigger:
  - "continue where"
  - "resume work"
  - "session restore"
  - "context reset"
  - "pick up where"
  - "where were we"
  - "what was I doing"
requiredTools:
  - task_list
  - task_next
  - spec_list
  - research_topic
outputFormat: markdown
estimatedMinutes: 1
---

# Session Restore

## Purpose
Reconstruct full working context at the start of a new session when a previous session was interrupted, the context window was compressed, or work is resuming after a gap. Produces a clear, actionable reboot state in under 60 seconds.

## Steps

### 1. Read Task Plan
Read `.plan/task_plan.md`. Extract:
- The **Goal** sentence
- Which phase is currently active (last phase with unchecked items)
- Which phases are fully complete (all `[x]`)
- Which phases remain (any unchecked `[ ]` items)

If `.plan/task_plan.md` does not exist, call `task_list` and `spec_list` to reconstruct the task landscape from the task system instead.

### 2. Read Progress Log
Read `.plan/progress.md`. Find the most recent session block. Extract:
- The last recorded action
- Any open `[ ]` action items that were not completed
- Any blockers or notes flagged in that session

### 3. Load Accumulated Knowledge
Read `.plan/findings.md`. Load all sections:
- **Requirements** — confirm they haven't changed
- **Research** — recall what was already discovered (avoids re-doing work)
- **Decisions** — recall architecture choices that must be honored
- **Issues** — check if any blockers are still unresolved

If a finding references a code file or external resource that may have changed, call `research_topic` to verify currency.

### 4. Answer the 5-Question Reboot Check
Output the reboot check filled in from the files read above:

```
## Session Restore — {ISO date}

### 5-Question Reboot Check
1. **Where am I?** {current phase name and last completed sub-task}
2. **Where am I going?** {remaining phases and their sub-tasks}
3. **What is the goal?** {goal sentence verbatim from task_plan.md}
4. **What have I learned?** {key findings summary from findings.md}
5. **What have I done?** {summary of completed checkboxes and last session actions}
```

### 5. Get Next Actions
Call `task_next` to retrieve the highest-priority pending task from the task system. Cross-reference with the first unchecked item in the current phase. Present both so there is no ambiguity about what to do next.

### 6. Resume
Append a new session header to `.plan/progress.md`:

```
## Session: {ISO date} — Restored

### Resuming from
Phase {N} — {sub-task description}

### Actions
- [ ] {first action}
```

Then proceed directly into the work — no further setup needed.

## Output
A filled-in 5-Question Reboot Check, the next concrete action, and an updated progress log header. Context is fully restored and work resumes immediately.

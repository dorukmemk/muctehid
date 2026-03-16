---
name: deep-planner
version: 1.0.0
description: Creates a persistent 3-file planning system for complex tasks. Generates task_plan.md (phases + checkboxes), findings.md (research log with 2-action rule), progress.md (session log). Prevents goal drift through structured phases.
category: planning
autoTrigger:
  - "complex task"
  - "multi-step"
  - "plan this"
  - "plan the implementation"
  - "break this down"
  - "I need to implement"
  - "architect this"
  - "design the system"
requiredTools:
  - spec_init
  - task_create
  - route_task
  - analyze_complexity
outputFormat: markdown
estimatedMinutes: 3
---

# Deep Planner

## Purpose
Bootstrap a persistent 3-file planning system under `.plan/` for any complex, multi-step task. All three files persist across sessions so context is never lost.

## Steps

### 1. Goal Statement
Write a single, precise north-star goal sentence to `.plan/task_plan.md`. This sentence must survive unchanged throughout the entire task — it is the anti-drift anchor.

```
## Goal
{One sentence describing what done looks like, measurable and unambiguous}
```

### 2. Phase Decomposition
Call `analyze_complexity` on the task description, then break the work into 3–7 sequential phases. Each phase gets 2–5 sub-task checkboxes. Write to `.plan/task_plan.md`:

```
## Phases

### Phase 1: {name}
- [ ] 1.1 {sub-task}
- [ ] 1.2 {sub-task}

### Phase 2: {name}
- [ ] 2.1 {sub-task}
...
```

Use `spec_init` if the task qualifies as a full feature spec (has requirements + design + tasks).

### 3. Findings Baseline
Create `.plan/findings.md` with the following section headers populated with initial context:

```
## Requirements
{What must be true when done}

## Research
{Links, findings, relevant code paths discovered}

## Decisions
{Architecture or approach decisions with rationale}

## Issues
{Blockers, unknowns, risks}

## Resources
{Files, docs, tools relevant to this task}
```

### 4. Progress Log
Create `.plan/progress.md` with a session header and the 5-Question Reboot Check pre-filled for the start of work:

```
## Session: {ISO date} — Start

### 5-Question Reboot Check
1. **Where am I?** Phase 1 — not yet started
2. **Where am I going?** Phases 1 through {N}
3. **What is the goal?** {goal sentence from task_plan.md}
4. **What have I learned?** Nothing yet — baseline session
5. **What have I done?** Created planning files

### Actions
- [ ] {first action to take}
```

### 5. 2-Action Rule
After every 2 research operations (any call to `search_code`, `research_topic`, `get_context`, `audit_file`, or similar), immediately append findings to `.plan/findings.md` under the appropriate section. Never defer this update.

### 6. Phase Execution
Work through phases top-to-bottom. For each completed sub-task:
- Mark the checkbox: `- [x]`
- Log the decision or outcome in `.plan/findings.md` under **Decisions**
- Append a one-line action entry to `.plan/progress.md`

Call `task_create` for any sub-task that requires more than 15 minutes of focused work. Call `route_task` to assign tasks that could be parallelized.

### 7. Completion Gate
Do not declare the task complete until:
- Every checkbox in `.plan/task_plan.md` is marked `[x]`
- `.plan/findings.md` contains at least one entry in **Decisions**
- `.plan/progress.md` has a closing session entry with a summary

Only then write the final summary and close.

## Output Files
- `.plan/task_plan.md` — phases and checkboxes
- `.plan/findings.md` — accumulated research and decisions
- `.plan/progress.md` — session-by-session action log

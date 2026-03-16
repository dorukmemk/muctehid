## Session Restore — {ISO date} — {Start | Restored | Post-clear | Morning}

### 5-Question Reboot Check

1. **Where am I?**
   Phase {N} ({phase name}) — last completed sub-task: {sub-task description}
   Next sub-task: {next [ ] item from task_plan.md}

2. **Where am I going?**
   Remaining phases:
   - Phase {N}: {remaining sub-tasks}
   - Phase {N+1}: {sub-tasks}
   - Phase {N+2}: {sub-tasks}
   (Total remaining: {count} sub-tasks across {count} phases)

3. **What is the goal?**
   {Goal sentence copied verbatim from .plan/task_plan.md — do not paraphrase}

4. **What have I learned?**
   Key findings from .plan/findings.md:
   - {Most important research finding}
   - {Key architectural decision}
   - {Critical constraint or gotcha discovered}

5. **What have I done?**
   Completed phases: {Phase 1, Phase 2, etc.}
   Completed sub-tasks this session: {list}
   Last action: {last [x] item from most recent session block in progress.md}

---

### Next Actions
1. {First concrete action — specific file, specific change}
2. {Second action if applicable}

### Notes
{Any open Issues from findings.md that need attention before resuming}
{Any findings that need currency verification (if session gap > 24 hours)}

<!-- INSTRUCTIONS:
- Copy this template to .plan/progress.md as a new session block (append, never overwrite)
- Fill every field from the actual .plan/ files — never from memory
- Q3 (goal) must be the exact verbatim text from task_plan.md
- Q4 (what I learned) must reference specific entries from findings.md, not vague summaries
-->

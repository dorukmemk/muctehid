# References: Code Review — Manus Principles Applied

## The 6 Manus Principles for Code Review

### 1. Understand Intent Before Judging Implementation
Code cannot be reviewed without understanding what it is supposed to do. Implementation choices are only wrong relative to requirements.

> "Read `get_context` before `audit_file`. A pattern that looks like an anti-pattern might be a deliberate architectural choice."

- Understand the PR's stated purpose before scanning for issues
- Distinguish between "wrong" (produces incorrect behavior) and "different" (violates convention)
- Ask: does this code do what it claims to do, safely and correctly?

### 2. Review at Multiple Levels Simultaneously
Good code review operates at four levels: correctness, security, maintainability, and consistency.

> "Never review only for style — that is linting, not reviewing. Never review only for security — that misses logic bugs."

| Level | Focus | Tools |
|-------|-------|-------|
| Correctness | Does it work? Edge cases handled? | `audit_file`, `search_code` |
| Security | Input validated? Auth enforced? Secrets safe? | `audit_diff`, `find_secrets` |
| Maintainability | Complexity acceptable? Naming clear? | `complexity_score`, `find_todos` |
| Consistency | Follows project patterns? Readable by teammates? | `get_context`, `find_references` |

### 3. Trace Side Effects
The most dangerous bugs in a review are not in the changed code — they are in how the change interacts with the rest of the system.

> "Use `find_references` to see everything that calls the changed function. The bug may be in the caller, not the callee."

- Check all callers when a function signature changes
- Check all dependents when a shared utility changes
- Check all consumers when an interface or contract changes

### 4. Separate Blockers from Suggestions
Not all review comments are equal. Conflating blockers with suggestions creates friction and reduces trust.

| Category | Meaning | Format |
|----------|---------|--------|
| Blocker | Must fix before merge — correctness, security, data loss | `task_create category="bug"` |
| Should-fix | Strong recommendation, not strictly blocking | `task_create category="tech-debt"` |
| Suggestion | Preference, style, improvement idea | Note in report, no task |
| Praise | Good pattern worth reinforcing | Note in report |

### 5. Be Constructive, Not Punitive
A review that only identifies problems without suggesting solutions is incomplete.

> "Every `audit_file` finding should come with: why it matters, what the risk is, and how to fix it."

- For every blocker: provide a concrete fix example
- For every suggestion: explain the tradeoff being made
- When complexity is high: use `run_skill skill="refactor-planner"` to provide an actual plan

### 6. Close the Loop with Tracked Tasks
Review comments that exist only as PR comments get forgotten. Critical findings must become tasks.

> "If it matters enough to mention, it matters enough to track. Use `task_create` for everything blocking or high-priority."

---

## Agent Loop: Code Review Steps

```
ANALYZE   → health_score + get_context (understand project + file context)
THINK     → identify review scope: what changed, what it touches, what could break
SELECT    → choose tools per review level: audit_file / complexity_score / find_references
EXECUTE   → systematic review at all four levels
OBSERVE   → categorize findings: blocker / should-fix / suggestion
ITERATE   → trace side effects, verify fixes, update task list
```

---

## Key Quotes

> "A code review that finds nothing is either a sign of excellent code or an insufficiently thorough reviewer. Calibrate accordingly."

> "The goal of code review is not to catch mistakes — it is to prevent future mistakes by spreading knowledge and enforcing shared standards."

> "Complexity score is not a proxy for quality. High complexity is a warning sign to look harder, not an automatic failure."

> "Read the test file before the implementation file. Tests document intent more honestly than comments."

---

## 3-Strike Protocol

When a review yields no significant findings after three passes:

1. **Strike 1:** Review the test file instead — bugs hide where tests don't reach
2. **Strike 2:** Run `complexity_score` and manually inspect the highest-scoring functions
3. **Strike 3:** Use `commit_history_search` to find similar code that had bugs historically — look for the same patterns

> "No findings after three passes is a green flag, not an excuse to stop early."

---

## Anti-Patterns Reference

| Anti-Pattern | Detection | Tool |
|-------------|-----------|------|
| God class / God function | File > 300 lines, function > 50 lines | `complexity_score` |
| Silent error swallowing | `catch (e) {}` or `catch (e) { return null }` | `search_code` |
| Callback hell | Deeply nested callbacks | `audit_file` |
| Magic numbers/strings | Unexplained literals in logic | `audit_file` |
| Premature optimization | Complexity added without profiling evidence | `audit_file` |
| Copy-paste code | Identical blocks in multiple files | `search_code` |
| Debug code in production | `console.log`, debug flags | `search_code` |
| Unenforced contracts | Functions that accept `any` | `search_code` + `audit_file` |

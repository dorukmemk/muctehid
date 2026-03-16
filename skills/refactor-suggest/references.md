# References: Refactor Suggest — Manus Principles Applied

## The 6 Manus Principles for Refactor Suggest

### 1. Measure First, Refactor Second
Refactoring without measurement is guessing. Every refactoring session begins with objective data.

> "Call `complexity_score` before forming any opinion about what needs refactoring. Your instincts will be wrong 40% of the time."

- Cyclomatic complexity reveals decision density — the real source of maintenance pain
- Lines of code is a weak proxy; high complexity in 50 lines is worse than low complexity in 200
- Use `health_score` to confirm refactoring will improve the metric, not just move code around

### 2. Understand the Blast Radius Before Cutting
Every refactoring changes an interface. Changing an interface affects callers. Callers live in production.

> "Use `find_references` before touching any function signature, class name, or module export. The blast radius determines the risk."

- Small blast radius (1-3 callers) → refactor freely
- Medium blast radius (4-20 callers) → refactor with a migration plan
- Large blast radius (20+ callers) → introduce an adapter pattern, migrate incrementally

### 3. Identify Responsibility, Not Just Complexity
A complex function that does one thing well is better than three simple functions that blur responsibilities.

> "The question is not 'how complex is this?' but 'how many reasons does this have to change?'"

- Apply the Single Responsibility Principle as a lens: if a function changes for two different reasons, it has two responsibilities
- Use `git_blame_context` to see if different responsibilities were added at different times — they usually were
- Cluster methods in a class by the data they operate on, not the feature they serve

### 4. Preserve Behavior Exactly
A refactoring that changes behavior is a bug, not a refactoring.

> "Every extract, rename, and decompose operation must leave observable behavior identical. If tests don't exist, write them before refactoring."

| Refactoring Type | Safety Check |
|-----------------|-------------|
| Extract function | Verify same inputs produce same outputs |
| Rename | Use `find_references` to update all call sites |
| Decompose class | Verify all public interface methods still exist |
| Move module | Update all imports, run `find_references` |

### 5. Refactor in Small, Committed Steps
Large refactors that touch 50 files at once are unmergeable. Small refactors that touch 2-3 files are safe.

> "Create one `task_create` per extraction. Commit after each task. Rollback is only possible when steps are small."

- Rule of thumb: one refactoring operation per commit
- Never mix refactoring commits with feature commits — they are impossible to review together
- Use `audit_diff` before each refactoring commit to catch unintended changes

### 6. Validate the Improvement
After refactoring, re-run the metrics. If the complexity score did not drop, the refactoring did not help.

> "Run `complexity_score` after refactoring the same path you scored before. The number must go down."

- If complexity moved but did not decrease: the problem was distributed, not solved
- If callers become more complex to use the refactored API: the interface design is wrong
- Use `generate_report` to document before/after state for future reference

---

## Agent Loop: Refactor Suggest Steps

```
ANALYZE   → complexity_score + health_score (get objective data first)
THINK     → identify single-responsibility violations and complexity hotspots
SELECT    → choose refactoring type: extract / rename / decompose / move
EXECUTE   → run_skill refactor-planner to get specific decomposition steps
OBSERVE   → validate blast radius with find_references before committing to approach
ITERATE   → task_create per step, apply incrementally, re-measure after each
```

---

## Key Quotes

> "Refactoring is not cleaning your room. It is restructuring your house so that cleaning your room takes less effort forever after."

> "If you cannot name the thing you are extracting without using 'and' or 'or', you have not found the right boundary yet."

> "The best refactoring is the one that makes the next feature trivially easy to add."

> "Complexity score is a symptom. The disease is unclear responsibility. Treat the disease."

---

## 3-Strike Protocol

When a refactoring plan does not reduce complexity after three attempts:

1. **Strike 1:** Re-examine the responsibility split — the boundaries may be wrong
2. **Strike 2:** Use `commit_history_search` to find the origin of the complexity — understanding why it grew reveals how to untangle it
3. **Strike 3:** Apply the Strangler Fig pattern — build the new structure alongside the old, migrate callers one by one, then delete the original

> "If direct refactoring fails three times, the architecture needs to change, not just the code."

---

## Refactoring Patterns Reference

| Pattern | When to Apply | Complexity Signal |
|---------|--------------|-------------------|
| Extract Function | Function > 20 lines with identifiable sub-steps | High cyclomatic complexity |
| Extract Class | Class has 2+ independent data clusters | Lines > 300, method count > 15 |
| Replace Conditional with Polymorphism | Switch/if-else on type field | High branch count |
| Introduce Parameter Object | Function takes 4+ primitive parameters | Many related params |
| Replace Magic Number with Constant | Unexplained literals in logic | `audit_file` findings |
| Extract Method Object | Complex function needs its own state | Very high complexity in one function |
| Decompose Conditional | Nested conditions > 3 deep | Deep nesting metric |
| Consolidate Duplicate Code | Same logic in 2+ places | `search_code` reveals copies |

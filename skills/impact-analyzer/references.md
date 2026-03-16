# References: Blast Radius Analysis and Safe Change Execution Principles

These principles are adapted from the Manus AI agent design philosophy, applied specifically to pre-change impact analysis. The central insight is that any code change without a prior blast radius analysis is a change made blind — and changes made blind in a large codebase reliably cause cascading failures that take longer to fix than the original change took to make.

---

## Principle 1: Never Act Without Mapping the Blast Radius
> "The first action before any rename, delete, or refactor is to discover what will break."

A symbol can appear to be "only used in a few places" based on a quick visual scan, and have 30 actual dependents across typed imports, type-only references, dynamic requires, and config files. Intuition about blast radius in a large codebase is systematically wrong — it always underestimates.

The three-strategy search approach exists because `find_references` alone finds only typed import references. Two entire layers of dependents — type-only references and string/dynamic references — are invisible to it. The impact analysis is incomplete until all three strategies have been executed:

1. `find_references` — typed imports and call sites
2. `search_code` with the symbol name — all text occurrences including string literals
3. `search_code` with the file path — barrel imports, webpack aliases, documentation references

Only after all three strategies return results can a blast radius be declared complete. A result of "0 dependents" from `find_references` alone is not a green light for deletion — it is an incomplete search.

---

## Principle 2: Never Repeat Failures — The Topological Execution Order
> "Update leaf files before their dependents. Update the source file last. This order has no exceptions."

The topological execution order exists to prevent a specific failure class: updating a file to use an interface that doesn't exist yet. If the source file (the renamed/refactored target) is changed first, every dependent file immediately fails to compile or run. This creates a broken intermediate state that can last for hours if the codebase is large.

The correct order is the inverse of the dependency graph:
- Leaf files (files that import the target but are not imported by other affected files) are updated first
- Files that depend on leaves are updated next
- The source file (the target of the rename/refactor/deletion) is updated last

This order ensures that at no point in the execution is any file pointing to a broken interface. Every change is locally safe: the file being changed is updated after all its downstream consumers are already correct.

The rule "update the source last" has no exceptions. If an exception seems necessary, it is a signal that the execution order was computed incorrectly.

---

## Principle 3: Context Isolation — Multi-Tier Risk Assessment
> "Not every dependent will break equally. BREAKING files will fail; SAFE files will not. Treat them differently."

The three-tier risk classification exists because treating all dependents identically wastes time on SAFE files and under-allocates attention to BREAKING ones. The tiers:

**BREAKING:** Files that directly import and call the target, or implement an interface defined in the target. These will fail at compile time or runtime if the target changes without a corresponding update. Every BREAKING file requires a task and a slot in the execution order.

**LIKELY:** Files that import the target but with indirect usage patterns — type-only imports, test mocks, re-exports, default argument patterns. TypeScript will often catch these at compile time, but they require review. Not all LIKELY files require changes — some may be compatible with the new signature.

**SAFE:** Files that reference the symbol as a string, in comments, or in documentation. These will not break at runtime. They may produce stale documentation or confusing logs, but they do not require changes to maintain correctness. Log them in the report; do not create tasks for them unless the codebase has strict documentation standards.

The `complexity_score` of each BREAKING file is part of the risk assessment, not just the count. A single BREAKING file with CC=18 carries more execution risk than five BREAKING files with CC=3 each.

---

## Principle 4: Estimate Before Committing
> "The impact report must include an effort estimate before any work begins."

The effort estimate in the impact report serves two purposes:

1. **Go/no-go decision input:** A rename that touches 3 leaf files takes 30 minutes. A rename that touches 45 files across 6 modules may warrant a dedicated sprint, a feature flag, or a deprecation strategy instead of a direct rename. Without the estimate, the developer cannot make an informed decision about approach.

2. **Complexity anchor:** If the actual execution takes 3x the estimate, that discrepancy is information. Either the estimate was wrong (and the model for future estimates should be updated) or the execution encountered unexpected dependencies (which should be documented in findings.md for future reference).

The estimate formula: N_BREAKING × (average minutes per BREAKING file) + N_LIKELY × (average minutes per LIKELY file). The per-file averages are informed by the complexity scores of the files involved — a BREAKING file with CC=15 takes longer to update safely than one with CC=3.

---

## Principle 5: Circular Dependencies as High-Risk Flags
> "A circular dependency in the blast radius is not just a code smell — it is a change risk multiplier."

When `get_dependencies` reveals circular dependencies involving the target, the impact analysis must treat them as special-case risks:

1. **Extraction circularity:** If extracting a utility from file A would create a circular dependency (A imports the new utility, the new utility imports A for a type), the extraction needs an interface seam before it can proceed.

2. **Rename circularity:** If the target is involved in a circular import chain, renaming it may require touching files in a non-trivial order that cannot be resolved by simple topological sorting.

3. **Deletion circularity:** If the target is in a circular chain and is deleted, the other files in the chain may unexpectedly fail even if they don't directly import the target.

Circular dependencies found during impact analysis must be flagged in the report as Risk Flags with a specific note: "circular dependency involving {file} — execution order requires additional analysis before proceeding."

---

## Principle 6: The Impact Report as a Pre-Change Contract
> "The impact report is not a suggestion. It is the contract that governs every change in the execution."

The impact report produced by this skill is not an advisory document — it is the specification that every subsequent change must follow. Specifically:

- The execution order in the report defines the order of changes. Deviating from this order without re-running the analysis violates the contract and may cause cascading failures.
- The task list in the report defines what must be changed. Skipping a BREAKING file because "it looks simple" is a contract violation — the file will break.
- The DEFERRED items in the report define what is explicitly out of scope. Expanding scope mid-execution without re-analysis is a contract violation — the blast radius may have changed.

The discipline of treating the impact report as a contract is the mechanism that prevents the most common refactor failure mode: starting a rename, getting partway through, discovering an unexpected dependent, improvising a fix, introducing a regression, and ending up with a codebase in a worse state than before the rename started.

---

## The Agent Loop in impact-analyzer Context

```
ANALYZE  → find_references + search_code (x3 strategies): build the full reference set
THINK    → get_dependencies: map circular deps + what the target imports
SELECT   → complexity_score on all BREAKING files: identify highest-risk changes
EXECUTE  → Classify every file into BREAKING / LIKELY / SAFE; compute topological order
OBSERVE  → task_create for each BREAKING and LIKELY file; include execution order position
ITERATE  → Produce the Impact Report: Summary, Effort Estimate, Risk Flags, Execution Order, Tasks
```

The loop's non-negotiable invariant: the execution order in the report must have the source file (the target of the change) last. Any execution order that places the source file earlier than its dependents is incorrect and must be recomputed before the report is delivered.

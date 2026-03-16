---
name: impact-analyzer
version: 1.0.0
description: Before any code change, analyzes the full impact across the codebase. Finds all files that import/use the target, estimates breaking changes, generates a safe execution order for changes. Use before renaming, refactoring, or deleting anything.
category: quality
autoTrigger:
  - "impact of changing"
  - "what will break"
  - "blast radius"
  - "safe to rename"
  - "safe to delete"
  - "dependencies of"
  - "what uses this"
  - "before I change"
  - "before I refactor"
requiredTools:
  - find_references
  - get_dependencies
  - search_code
  - complexity_score
  - task_create
outputFormat: markdown
estimatedMinutes: 3
---

# Impact Analyzer

## Purpose
Before any rename, refactor, deletion, or interface change, map the full blast radius across the codebase. Produce a prioritized list of affected files, a risk tier for each, and a safe topological execution order so changes can be applied without triggering cascading failures.

## Steps

### 1. Direct References
Call `find_references` on the target symbol, function, class, or file path. This finds:
- All explicit import statements
- All call sites
- All type annotations that reference the target
- All re-exports that forward the target

Record the full list of files returned as the **direct reference set**.

### 2. Dependency Graph
Call `get_dependencies` on the target file or module. Map:
- What the target itself imports (its dependencies — these may need to move with it if the target is relocated)
- Any circular dependencies involving the target (these are high-risk and must be noted)

Build a two-level dependency map: target → its deps, and target → its dependents (from step 1).

### 3. Semantic Search
Call `search_code` three times with different query strategies to find indirect usages that `find_references` may miss:
- Search for the symbol name as a string literal (dynamic imports, `require()`, config files)
- Search for the file path as a string (webpack aliases, barrel imports, documentation)
- Search for related identifiers (related type names, interface names, test file names)

Add any newly discovered files to the reference set, flagging them as indirect.

### 4. Risk Assessment
Categorize every file in the combined reference set into one of three tiers:

| Tier | Criteria |
|------|----------|
| BREAKING | Directly imports and calls the target, or implements an interface defined in the target |
| LIKELY | Imports the target but usage pattern is indirect (re-exports, type-only imports, test mocks) |
| SAFE | Found by semantic search only; references the name as a string or in comments |

Call `complexity_score` on all BREAKING files. High-complexity BREAKING files are the highest-risk changes in the entire operation.

### 5. Change Order
Generate a topological execution order based on the dependency graph:

- Start with **leaf files** (files that import the target but are not imported by other affected files)
- End with the **target itself** (rename/delete/refactor the source last, after all dependents are updated)
- Place test files immediately after each source file they test

This order ensures that at no point is a file updated to use an interface that doesn't exist yet.

```
Execution Order:
1. {file} — {reason: leaf, no dependents}
2. {file} — {reason: depends on file 1}
3. {file} — {reason: integration test for files 1-2}
...
N. {target file} — {reason: source, update last}
```

### 6. Task Generation
Call `task_create` for each BREAKING and LIKELY file. Each task must include:
- The file path
- The specific symbol or import that needs to change
- The exact change required (e.g., "rename `oldName` to `newName` in import and all 3 call sites")
- The position in the execution order

### 7. Impact Report

```
## Impact Report: {target symbol/file}

### Summary
- **BREAKING:** {N} files — will definitely fail if target changes without update
- **LIKELY:** {M} files — probably affected, needs review
- **SAFE:** {K} files — string/comment references only

### Estimated Effort
- {N} BREAKING × ~{avg minutes} min = {total} min
- {M} LIKELY × ~{avg minutes} min = {total} min
- **Total estimated:** {hours} hours

### Recommended Approach
{Incremental: update leaf files one at a time, run tests after each batch}
{OR Big-bang: all changes in one PR — justified if N < 5 and all files are in same module}

### Risk Flags
- {file}: complexity {score} — high risk of introducing bugs during update
- {circular dependency note if any}

### Safe Execution Order
1. {file} ({tier})
2. {file} ({tier})
...
{N}. {target} (source — update last)

### Tasks Created
- T-{id}: {file} — {change description}
```

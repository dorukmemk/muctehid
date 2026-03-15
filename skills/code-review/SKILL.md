---
name: code-review
version: 1.0.0
description: Code quality review — complexity, best practices, tech debt
author: code-audit-mcp
category: quality
type: pipeline
triggers:
  - "code review"
  - "review"
  - "quality"
  - "best practices"
tools:
  - audit_file
  - complexity_score
  - find_todos
parameters:
  include_complexity:
    type: boolean
    default: true
  include_todos:
    type: boolean
    default: true
output:
  format: markdown
  include_fixes: true
---

## Code Review Skill

Performs automated code quality review covering:

- **Cyclomatic Complexity** — identifies overly complex functions
- **Empty catch blocks** — swallowed exceptions
- **Debug logging** — console.log left in production code
- **TypeScript any** — type safety violations
- **var declarations** — function-scoped variable issues
- **TODO/FIXME/HACK** — technical debt markers

### Usage:
```
run_skill("code-review", { path: "src/" })
run_skill("code-review", { filepath: "src/index.ts" })
```

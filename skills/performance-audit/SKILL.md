---
name: performance-audit
version: 1.0.0
description: Identifies performance bottlenecks and optimization opportunities
author: code-audit-mcp
category: performance
type: pipeline
triggers:
  - "performance"
  - "slow"
  - "optimize"
  - "bottleneck"
tools:
  - search_code
  - audit_file
parameters:
  check_async:
    type: boolean
    default: true
  check_loops:
    type: boolean
    default: true
output:
  format: markdown
---

## Performance Audit Skill

Detects common performance issues:

- `async` inside `forEach` (should use `Promise.all + map`)
- `JSON.parse(JSON.stringify())` deep clone (use `structuredClone`)
- String concatenation in loops (use template literals)
- Blocking synchronous file operations in async context
- N+1 query patterns

### Usage:
```
run_skill("performance-audit", { path: "src/" })
```

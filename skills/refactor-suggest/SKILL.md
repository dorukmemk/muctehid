---
name: refactor-suggest
version: 1.0.0
description: Suggests refactoring opportunities for complex or duplicated code
author: code-audit-mcp
category: quality
type: prompt
triggers:
  - "refactor"
  - "restructure"
  - "clean up"
  - "improve code"
tools:
  - complexity_score
  - search_code
parameters:
  complexity_threshold:
    type: number
    default: 10
output:
  format: markdown
---

## Refactor Suggest Skill

Identifies refactoring opportunities:

1. Functions with high cyclomatic complexity (> 10)
2. Duplicated code patterns found via semantic search
3. Long parameter lists
4. Deep nesting levels

### Usage:
```
run_skill("refactor-suggest", { filepath: "src/utils.ts" })
```

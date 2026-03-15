---
name: doc-generator
version: 1.0.0
description: Generates JSDoc / docstring documentation for undocumented code
author: code-audit-mcp
category: docs
type: prompt
triggers:
  - "docs"
  - "documentation"
  - "jsdoc"
  - "docstring"
tools:
  - search_code
  - get_context
parameters:
  style:
    type: enum
    values: [jsdoc, tsdoc, google, numpy]
    default: jsdoc
output:
  format: markdown
---

## Doc Generator Skill

Automatically generates documentation:

- JSDoc/TSDoc for TypeScript/JavaScript
- Docstrings for Python (Google, NumPy style)
- README section generation
- API documentation

### Usage:
```
run_skill("doc-generator", { filepath: "src/api.ts" })
```

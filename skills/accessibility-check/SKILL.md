---
name: accessibility-check
version: 1.0.0
description: Checks frontend code for accessibility (a11y) issues
author: code-audit-mcp
category: quality
type: pipeline
triggers:
  - "accessibility"
  - "a11y"
  - "wcag"
  - "aria"
tools:
  - search_code
  - audit_file
parameters:
  wcag_level:
    type: enum
    values: [A, AA, AAA]
    default: AA
output:
  format: markdown
---

## Accessibility Check Skill

Scans frontend code for WCAG compliance:

- Missing `alt` attributes on images
- Missing ARIA labels on interactive elements
- Color contrast issues (pattern-based)
- Keyboard navigation patterns
- Form label associations

### Usage:
```
run_skill("accessibility-check", { path: "src/components/" })
```

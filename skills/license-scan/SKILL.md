---
name: license-scan
version: 1.0.0
description: Scans dependencies for license compliance issues
author: code-audit-mcp
category: compliance
type: pipeline
triggers:
  - "license"
  - "compliance"
  - "GPL"
  - "legal"
tools:
  - search_code
parameters:
  allowed_licenses:
    type: array
    default: [MIT, ISC, Apache-2.0, BSD-2-Clause, BSD-3-Clause]
  flag_copyleft:
    type: boolean
    default: true
output:
  format: markdown
---

## License Scan Skill

Checks dependency license compatibility:

- Identifies GPL/AGPL licenses (copyleft risk for commercial projects)
- Lists all dependency licenses
- Flags licenses not in your allowed list
- Generates license compliance report

### Usage:
```
run_skill("license-scan", { path: "." })
```

---
name: dependency-risk
version: 1.0.0
description: Analyzes npm/pip dependency risk — outdated packages, CVE exposure
author: code-audit-mcp
category: security
type: pipeline
triggers:
  - "dependency"
  - "npm audit"
  - "packages"
  - "CVE"
  - "vulnerabilities"
tools:
  - dependency_audit
parameters:
  check_outdated:
    type: boolean
    default: true
  severity_threshold:
    type: enum
    values: [low, medium, high, critical]
    default: high
output:
  format: markdown
---

## Dependency Risk Skill

Analyzes project dependencies:

- Lists all direct and dev dependencies
- Identifies potentially risky packages
- Recommends running `npm audit` for CVE scanning
- Flags packages with known security issues

### Usage:
```
run_skill("dependency-risk", { path: "." })
```

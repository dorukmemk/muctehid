---
name: security-audit
version: 1.2.0
description: OWASP Top 10 based security scanner with secret detection
author: code-audit-mcp
category: security
type: pipeline
triggers:
  - "security"
  - "vulnerability"
  - "OWASP"
  - "güvenlik"
  - "secure"
  - "pentest"
tools:
  - security_scan
  - find_secrets
  - search_code
  - audit_file
parameters:
  severity_threshold:
    type: enum
    values: [low, medium, high, critical]
    default: medium
  include_deps:
    type: boolean
    default: true
  owasp_categories:
    type: array
    default: [A01, A02, A03, A07]
hooks:
  pre_commit: true
  on_save: false
output:
  format: markdown
  include_fixes: true
  severity_color: true
---

## Security Audit Skill

This skill performs comprehensive security analysis using OWASP Top 10 patterns.

### What it checks:
- **A01** Broken Access Control — path traversal, admin bypasses
- **A02** Cryptographic Failures — weak hashes (MD5, SHA1), insecure random
- **A03** Injection — SQL, command, eval, XSS/innerHTML, NoSQL
- **A05** Security Misconfiguration — CORS wildcards, TLS disabled
- **A07** Authentication Failures — hardcoded credentials, weak JWT secrets
- **A08** Insecure Deserialization
- **A09** Security Logging Failures — sensitive data in logs
- **A10** SSRF — user-controlled URLs in HTTP requests

### Secret Detection:
Scans for AWS keys, GitHub tokens, Stripe keys, JWT tokens, SSH private keys, and more using regex + entropy analysis.

### Usage:
```
run_skill("security-audit", { path: "src/" })
run_skill("security-audit", { filepath: "src/auth.ts" })
```

## Output Depth

| Parameter | Behavior |
|-----------|----------|
| `depth: shallow` (default) | Summary: issue count, top 3 findings, recommendations |
| `depth: deep` | Full analysis: every finding with code excerpt, detailed fix steps, related CWE/OWASP refs |

To save output as .md file: `run_skill skill="security-audit" path="src/" depth="deep" save=true`

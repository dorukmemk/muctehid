# References: Security Audit — Manus Principles Applied

## The 6 Manus Principles for Security Audit

### 1. Understand Before Acting
Never scan blindly. Before running any security tool, understand what you are auditing.

> "Always call `get_context` before `audit_file`. Blind scanning produces noise; contextual scanning produces signal."

- Map the attack surface first: entry points (routes, APIs, webhooks), data flows, auth boundaries
- Use `health_score` to understand overall project posture before drilling down
- Use `search_code` to trace user input from entry point to persistence layer

### 2. Be Exhaustive, Not Superficial
A security audit that misses one critical path is worse than no audit — it creates false confidence.

> "Cover all OWASP Top 10 categories. Never stop after finding the first vulnerability."

- Injection (SQL, NoSQL, Command, LDAP)
- Broken Authentication (session fixation, weak JWT, no rate limiting)
- Sensitive Data Exposure (secrets in code, unencrypted PII)
- Security Misconfiguration (debug flags, open CORS, verbose errors)
- XSS, CSRF, SSRF, XXE, Insecure Deserialization

### 3. Trace Data, Not Just Code
Vulnerabilities live at the intersection of trust boundaries. Follow data, not functions.

> "A SQL injection is not in the query — it is in the unvalidated input that reaches the query."

- Use `find_references` to trace how user-controlled data propagates
- Always audit the path: `request input → validation → transformation → persistence → response`
- Check both sanitization (input) and escaping (output)

### 4. Prioritize by Impact × Exploitability
Not all findings are equal. Triage ruthlessly.

| Severity | Criteria | Action |
|----------|----------|--------|
| Critical | Remote code execution, auth bypass, credential exposure | `task_create` immediately |
| High | XSS, SQL injection, broken access control | `task_create` before deploy |
| Medium | Information disclosure, missing security headers | `task_create` this sprint |
| Low | Best practice deviation, verbose errors | Document, fix when convenient |

### 5. Evidence-Based Reporting
Every finding must have a reproducible example. Vague findings get ignored.

> "Never write 'potential XSS found'. Write: file, line, payload, impact, remediation."

- Use `generate_report` with specific paths to produce structured output
- Include: finding type, file location, line number, proof-of-concept, CVSS score, fix guidance
- Reference OWASP testing guides for each finding category

### 6. Close the Loop
A security audit without remediation tracking is a wasted effort.

> "Every `audit_file` finding must become a `task_create`. Findings without tasks get forgotten."

- Create tasks for every severity level (adjust priority accordingly)
- Re-run `security_scan` after fixes to verify remediation
- Run `audit_diff` before every commit during the fix cycle

---

## Agent Loop: Security Audit Steps

```
ANALYZE   → health_score + search_code (map attack surface)
THINK     → identify highest-risk entry points and data flows
SELECT    → choose audit tools: find_secrets / security_scan / audit_file
EXECUTE   → run scans systematically, layer by layer
OBSERVE   → triage findings by severity × exploitability
ITERATE   → trace each finding deeper, create tasks, verify fixes
```

---

## Key Quotes

> "Security is not a feature — it is an absence of exploitable flaws. Audit continuously, not once."

> "The 3-second rule: if a finding takes more than 3 seconds to explain, you don't understand it yet. Keep digging."

> "OWASP is a checklist, not a ceiling. Always ask: what did the checklist miss for this specific app?"

> "Secrets in code are not secrets. They are public announcements with a delay."

---

## 3-Strike Protocol

If a security scan returns no findings three times in a row on the same path:

1. **Strike 1:** Change search strategy — try different query terms in `search_code`
2. **Strike 2:** Escalate scope — run `security_scan` on the parent directory
3. **Strike 3:** Manual trace — pick the highest-risk entry point and trace it by hand using `get_context` + `find_references`

> "No findings does not mean no vulnerabilities. It means your search strategy needs revision."

---

## Tool Reference

| Tool | When to Use |
|------|-------------|
| `find_secrets` | First pass — catch hardcoded credentials, tokens, keys |
| `security_scan` | OWASP-aligned automated scanning of a path |
| `audit_file` | Deep single-file security analysis |
| `audit_diff` | Pre-commit gate — scan only changed code |
| `search_code` | Trace specific patterns (eval, innerHTML, raw SQL) |
| `find_references` | Follow a secret or vulnerability across the codebase |
| `dependency_audit` | Check for vulnerable dependencies (CVEs) |
| `task_create` | Convert every finding into a tracked remediation task |
| `generate_report` | Produce structured security report for stakeholders |

## Auto Fixer Triage Table — {path}

### Baseline Health Score
```
health_score: {score}/100 — recorded {ISO date/time}
```

### CRITICAL Issues (fix first — do not proceed to HIGH until all resolved)

| # | File | Line | Issue Type | Source Tool | Task ID |
|---|------|------|-----------|-------------|---------|
| C1 | {file} | {line} | SQL Injection | security_scan | T-{id} |
| C2 | {file} | {line} | Hardcoded secret | find_secrets | T-{id} |
| C3 | {file} | {line} | {issue description} | {tool} | T-{id} |

### HIGH Issues (fix after all CRITICAL resolved)

| # | File | Function | Issue Type | CC Score / Severity | Task ID |
|---|------|---------|-----------|---------------------|---------|
| H1 | {file} | {function} | Complexity > 10 | CC={score} | T-{id} |
| H2 | {file} | {line} | {high-severity quality issue} | HIGH | T-{id} |

### MEDIUM Issues (fix in this run only if no CRITICAL or HIGH remain)

| # | File | Issue | CC / Severity |
|---|------|-------|--------------|
| M1 | {file} | {description} | CC={score} |
| M2 | {file} | {description} | MEDIUM |

### LOW Issues (TODOs, style — fix last or defer)

| # | File | Line | Comment |
|---|------|------|---------|
| L1 | {file} | {line} | TODO: {text} |
| L2 | {file} | {line} | FIXME: {text} |

---

### Fix Log

| Task | File | Status | audit_file Result | Delta |
|------|------|--------|------------------|-------|
| T-{id} | {file} | DONE | ✓ No new issues | - |
| T-{id} | {file} | DEFERRED | N/A — architectural change required | - |
| T-{id} | {file} | DONE (3rd attempt) | ✓ Resolved after regression on attempts 1–2 | - |

### Final Health Score
```
Before: {baseline}/100
After:  {final}/100
Delta:  +{delta} points
```

<!-- INSTRUCTIONS:
- Fill this table BEFORE starting any fixes.
- Triage assignments are immutable once set. Do not re-triage mid-session.
- Log every fix attempt in Fix Log, including failed attempts (strikes).
- Task IDs must reference actual task_create calls made before fixing.
-->

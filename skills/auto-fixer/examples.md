# Examples: Auto Fixer in Action

## Example 1: Fixing All TypeScript Errors and Security Issues Before Release

**User Request:** "Fix all issues in src/ before the release."

### Loop 1: Baseline and parallel discovery — all 4 tools simultaneously
```bash
health_score path="src/"                                           # record baseline — required before any change
security_scan path="src/"                                          # discovery (run all 4 in parallel)
find_secrets path="src/"                                           # discovery
find_todos path="src/"                                             # discovery
complexity_score filepath="src/"                                   # discovery
```

### Loop 2: Triage and task creation (create tasks before fixing)
```bash
# Triage table from discovery:
# CRITICAL: find_secrets — AWS key hardcoded in src/config/defaults.ts
# HIGH: complexity_score — src/api/handlers/orderHandler.ts CC=17
# MEDIUM: audit violations in src/utils/formatter.ts (3 findings)
# LOW: 12 TODO comments across 5 files
task_create title="CRITICAL: Remove hardcoded AWS key in defaults.ts" category="security"
task_create title="HIGH: Reduce complexity in orderHandler.ts (CC=17 → target <10)" category="quality"
task_create title="MEDIUM: Fix audit violations in formatter.ts" category="quality"
# CRITICAL exists — do NOT touch MEDIUM or LOW until CRITICAL is clear
```

### Loop 3: Fix CRITICAL first, verify before moving on
```bash
get_context filepath="src/config/defaults.ts"                      # pre-edit hook
audit_file filepath="src/config/defaults.ts"                       # confirm exact finding + line
# Fix: move AWS key to environment variable reference
audit_file filepath="src/config/defaults.ts"                       # verify CRITICAL is gone, no regressions
find_secrets path="src/config/"                                    # confirm secrets are completely clear
```

### Loop 4: Fix HIGH, produce before/after delta
```bash
get_context filepath="src/api/handlers/orderHandler.ts"            # pre-edit hook
# Extract 3 sub-functions to reduce CC from 17 to under 10
audit_file filepath="src/api/handlers/orderHandler.ts"             # verify fix, no new issues
complexity_score filepath="src/api/handlers/orderHandler.ts"       # confirm CC now < 10
health_score path="src/"                                            # final score — must exceed baseline
audit_diff                                                          # full changeset pre-commit review
```

---

## Example 2: Fixing OWASP Security Issues Found by Audit

**User Request:** "The security audit found OWASP issues. Fix them all."

### Loop 1: Baseline and security-focused discovery
```bash
health_score path="src/"                                            # baseline score
security_scan path="src/"                                           # primary OWASP discovery
find_secrets path="src/"                                            # parallel secrets pass
audit_file filepath="src/api/auth/loginController.ts"              # spot-check the highest-risk surface
```

### Loop 2: Triage by OWASP category and create tasks before touching code
```bash
# CRITICAL: SQL injection in src/db/queryBuilder.ts (A03:2021)
# CRITICAL: Missing auth check on admin routes in src/api/admin/userController.ts (A01:2021)
# HIGH: XSS via unsanitized output in src/views/profileView.ts (A03:2021)
# MEDIUM: Insecure direct object reference in src/api/orders/getOrder.ts (A01:2021)
task_create title="CRITICAL: SQL injection in queryBuilder.ts — parameterize all queries" category="security"
task_create title="CRITICAL: Missing auth middleware on admin routes" category="security"
task_create title="HIGH: XSS in profileView — sanitize user-controlled output" category="security"
```

### Loop 3: Fix SQL injection (CRITICAL A03) — verify before next fix
```bash
get_context filepath="src/db/queryBuilder.ts"                       # pre-edit hook
research_topic topic="parameterized queries Node.js pg library placeholders"  # verify correct pattern
# Replace string concatenation with parameterized queries throughout
audit_file filepath="src/db/queryBuilder.ts"                        # verify A03 finding is cleared
security_scan path="src/db/"                                        # confirm no remaining injection patterns
```

### Loop 4: Fix missing auth middleware, then final delta
```bash
get_context filepath="src/api/admin/userController.ts"              # pre-edit hook
search_code query="requireAuth middleware admin route"              # find the correct middleware
# Add requireAuth to all admin routes
audit_file filepath="src/api/admin/userController.ts"               # verify A01 is cleared
health_score path="src/"                                            # final delta — must exceed baseline
audit_diff                                                           # pre-commit review
```

---

## Example 3: Auto-Fixing TODO Comments That Are Actually Bugs

**User Request:** "There are tons of TODO comments everywhere. Fix them properly."

### Loop 1: Full discovery — security check before working on LOWs
```bash
health_score path="src/"                                            # baseline
security_scan path="src/"                                           # MUST check: no CRITICALs before working on LOWs
find_secrets path="src/"                                            # same
find_todos path="src/"                                              # primary TODO discovery
search_code query="TODO FIXME HACK XXX"                             # catch all comment styles
```

### Loop 2: Triage — escalate TODOs that are actually security or quality issues
```bash
# Triage result — security scan is CLEAN, can work on TODOs:
# HIGH (escalated): src/auth/tokenRefresh.ts has "TODO: validate token expiry before refresh" — this is a bug
# MEDIUM: 3 TODOs are error handling gaps in profileService.ts and emailService.ts
# LOW: 9 style/cleanup TODOs — defer unless time permits
task_create title="HIGH: Implement token expiry validation in tokenRefresh.ts" category="bug"
task_create title="MEDIUM: Add error handling for null user in profileService.ts" category="quality"
task_create title="MEDIUM: Add error handling for timeout in emailService.ts" category="quality"
```

### Loop 3: Fix HIGH TODO — it is a real security gap
```bash
get_context filepath="src/auth/tokenRefresh.ts"                     # pre-edit hook
research_topic topic="JWT expiry validation before refresh Node.js jsonwebtoken"  # correct pattern
# Implement expiry validation before issuing refresh token
audit_file filepath="src/auth/tokenRefresh.ts"                      # verify clean — no new issues
# Remove the TODO comment — it is now implemented
```

### Loop 4: Fix MEDIUM TODOs and produce final report
```bash
get_context filepath="src/services/profileService.ts"               # pre-edit hook
# Add null guard for user param
audit_file filepath="src/services/profileService.ts"                # verify
get_context filepath="src/services/emailService.ts"                 # pre-edit hook
# Add timeout error handler
audit_file filepath="src/services/emailService.ts"                  # verify
health_score path="src/"                                             # final delta — must beat baseline
audit_diff                                                           # full pre-commit review
```

---

## Example 4: Fixing Complexity Issues Flagged by complexity_score

**User Request:** "complexity_score is showing red on 4 files. Fix them."

### Loop 1: Baseline and full discovery to check for higher-priority issues
```bash
health_score path="src/"                                             # baseline
complexity_score filepath="src/"                                     # confirm which files are red
security_scan path="src/"                                            # ensure no CRITICALs take priority
find_secrets path="src/"                                             # same — CRITICALs always first
```

### Loop 2: Triage by CC tier and create tasks before any edits
```bash
# CC results: invoiceGenerator.ts (CC=22), searchController.ts (CC=15),
#             aggregator.ts (CC=11), dateParser.ts (CC=10)
# All > 10 → HIGH tier; CC=22 fixed first (most severe)
task_create title="HIGH: Reduce invoiceGenerator.ts CC=22 to <10" category="quality"
task_create title="HIGH: Reduce searchController.ts CC=15 to <10" category="quality"
task_create title="HIGH: Reduce aggregator.ts CC=11 to <10" category="quality"
```

### Loop 3: Fix CC=22 — highest severity first, use refactor-planner
```bash
get_context filepath="src/billing/invoiceGenerator.ts"              # pre-edit hook
run_skill skill="refactor-planner" filepath="src/billing/invoiceGenerator.ts"  # get decomposition plan
# Extract: calculateLineItems(), applyDiscounts(), formatOutput() as separate functions
audit_file filepath="src/billing/invoiceGenerator.ts"               # quality check — no new issues
complexity_score filepath="src/billing/invoiceGenerator.ts"         # confirm CC now < 10
```

### Loop 4: Fix remaining files and produce before/after delta
```bash
get_context filepath="src/api/searchController.ts"                  # pre-edit hook
# Extract filter logic and pagination logic into named helpers
audit_file filepath="src/api/searchController.ts"                   # verify
complexity_score filepath="src/api/searchController.ts"             # confirm CC < 10
health_score path="src/"                                             # final — must beat baseline
audit_diff                                                           # pre-commit gate
```

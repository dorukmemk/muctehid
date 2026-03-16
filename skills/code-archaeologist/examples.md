# Examples: Code Archaeologist in Action

## Example 1: Understanding Why a Confusing Function Exists

**User Request:** "Why does `normalizeUserIdentifier()` exist? It looks redundant. Can we delete it?"

### Loop 1: Build the who/when layer first
```bash
git_blame_context filepath="src/utils/normalizeUserIdentifier.ts"              # who last touched each line?
commit_history_search query="normalizeUserIdentifier user identifier normalize" # full commit timeline
```

### Loop 2: Map dependents — what breaks if we delete it?
```bash
search_code query="normalizeUserIdentifier"                                    # all callers (text search)
find_references symbol="normalizeUserIdentifier"                               # typed import references
# 2 ops — flush findings: 4 callers found; oldest commit 2021-08 "handle legacy phone/email dual-format"
```

### Loop 3: Assess complexity trend and industry context
```bash
complexity_score filepath="src/utils/normalizeUserIdentifier.ts"               # built complex or accumulated?
research_topic topic="phone email dual identifier normalization user systems"   # known pattern?
# 2 ops — flush findings: CC=6, stable; pattern is standard for phone-only to email migration
```

### Loop 4: Compile and deliver the archaeological report
```bash
# Report:
# Origin: 2021-08-14, commit b3f9a1, "handle legacy phone/email dual-format users from mobile app migration"
# Evolution: 3 commits total — created, extended for international phone format, bug fix
# Current State: 4 active callers; CC=6 (stable, not accumulated); no duplicates in codebase
# Recommendation: KEEP
# Evidence: commit b3f9a1 (origin) + commit f2a8c3 (extension) + 4 find_references results
```

---

## Example 2: Tracing the History of an API Design Decision

**User Request:** "Why does our API return 200 with an error body instead of proper HTTP error codes? Who decided this?"

### Loop 1: Find where the pattern originated
```bash
commit_history_search query="200 error body response status code always"       # find the decision commit
git_blame_context filepath="src/api/responseBuilder.ts"                        # who last touched this file?
```

### Loop 2: Build the decision timeline
```bash
search_code query="status 200 error body ApiResponse envelope"                 # all files using this pattern
research_topic topic="JSON envelope pattern 200 with error body history"       # was this a known practice?
# 2 ops — flush findings
```

### Loop 3: Identify the original constraint and whether it still applies
```bash
commit_history_search query="responseBuilder ApiResponse Cordova XHR mobile"  # broader search
git_blame_context filepath="src/api/middleware/errorHandler.ts"                # related file archaeology
# 2 ops — flush findings: commit 2019-11 "per mobile team: always 200 to avoid Cordova XHR bug in iOS 12"
```

### Loop 4: Assess refactor feasibility and produce report
```bash
complexity_score filepath="src/api/responseBuilder.ts"                         # how hard is the refactor?
search_code query="Cordova cordova"                                             # is Cordova still in the codebase?
# Report:
# Origin: 2019-11-03, commit e8d1f2, "per mobile team: always 200 to avoid Cordova XHR bug in iOS 12"
# Key Decision: deliberate workaround, not a misunderstanding of HTTP
# Evolution: 12 files now depend on this pattern; Cordova dropped 2022 (0 references remain)
# Recommendation: REFACTOR — the original constraint no longer exists
# Evidence: commit e8d1f2 (origin) + search_code (0 Cordova refs) + 12 files in reference set
```

---

## Example 3: Finding Who Introduced a Security Vulnerability

**User Request:** "We have a SQL injection in the orders query. When was it introduced and by whom?"

### Loop 1: Identify the exact vulnerable lines and their origin
```bash
audit_file filepath="src/db/queries/orderQueries.ts"                           # confirm finding + exact lines
git_blame_context filepath="src/db/queries/orderQueries.ts"                    # who last touched those lines?
```

### Loop 2: Find the introduction commit and determine blast radius
```bash
commit_history_search query="orderQueries order filter search query"           # all changes to this file
search_code query="ORDER BY string concat interpolation raw query"             # find if pattern spread elsewhere
# 2 ops — flush findings: commit 9c3b2a "feat: add order search by customer name" introduced it
```

### Loop 3: Confirm blast radius and scan for siblings
```bash
search_code query="buildOrderQuery rawQuery"                                   # same pattern in other query builders?
find_references symbol="buildOrderQuery"                                       # all callers of the vulnerable function
# 2 ops — flush: 3 other query files use the same unsafe template literal pattern
security_scan path="src/db/queries/"                                           # confirm full scope
```

### Loop 4: Compile report and create remediation tasks
```bash
# Report:
# Vulnerability introduced: 2025-08-22, commit 9c3b2a, "feat: add order search by customer name"
# Root cause: template literal SQL concatenation replaced parameterized query for "performance"
# Spread: 3 additional files contain the same pattern (commits 9d4c1b, 9e5d2c, 9f6e3d — same sprint)
task_create title="CRITICAL: SQL injection in orderQueries.ts — commit 9c3b2a" category="security"
task_create title="CRITICAL: Same pattern in productQueries.ts" category="security"
task_create title="CRITICAL: Same pattern in customerQueries.ts" category="security"
```

---

## Example 4: Understanding Legacy Migration Patterns Before Deletion

**User Request:** "There's a whole CompatibilityLayer module that I've never understood. Is it safe to delete?"

### Loop 1: Full blame and history sweep
```bash
git_blame_context filepath="src/compat/CompatibilityLayer.ts"                  # original lines vs. modified
commit_history_search query="CompatibilityLayer compat migration legacy v1"    # creation and full evolution
```

### Loop 2: Map all dependents — typed, dynamic, and indirect
```bash
find_references symbol="CompatibilityLayer"                                    # typed imports
search_code query="CompatibilityLayer require compat legacy"                   # string/dynamic imports
# 2 ops — flush findings
search_code query="v1 api legacy format transform compatibility"               # indirect usage patterns
```

### Loop 3: Assess complexity trend against timeline
```bash
complexity_score filepath="src/compat/CompatibilityLayer.ts"                   # CC trend
research_topic topic="API versioning compatibility layer sunset patterns"       # industry precedent
# 2 ops — flush findings
```

### Loop 4: Produce deletion-safety assessment
```bash
# Report:
# Origin: 2020-03-01, commit a1b2c3, "add v1→v2 compatibility shim for mobile clients on old app versions"
# Evolution: 7 commits; last modified 2023-01 ("fix date format edge case")
# Current State: 2 direct importers (v1Router.ts, legacyWebhookHandler.ts); 0 indirect string refs
# Complexity: CC=8, stable — built intentionally complex, not accumulated
# Recommendation: DO NOT DELETE YET — 2 active importers must be decommissioned first
# Evidence: find_references (2 results) + commit a1b2c3 (origin) + search_code (0 indirect refs)
```

# Examples: Impact Analyzer in Action

## Example 1: Before Renaming a Widely-Used Function

**User Request:** "I want to rename `processOrder` to `fulfillOrder` across the codebase. Is it safe?"

### Loop 1: Direct reference mapping
```bash
find_references symbol="processOrder"                                         # all explicit call sites and imports
search_code query="processOrder"                                              # typed + untyped references
search_code query="\"processOrder\""                                          # string literals (dynamic imports, configs)
```

### Loop 2: Dependency graph + risk assessment
```bash
get_dependencies filepath="src/orders/orderProcessor.ts"                     # what does the function's file import?
complexity_score filepath="src/api/orderController.ts"                       # score the highest-risk BREAKING file
# 2 ops — flush to findings if .plan/ active
# Triage: 6 BREAKING (direct call sites), 2 LIKELY (type-only imports), 1 SAFE (README.md mention)
```

### Loop 3: Generate execution order and tasks
```bash
# Topological order: leaf files first, source last
# 1. src/workers/orderWorker.ts (BREAKING — imports and calls processOrder, not imported by other affected files)
# 2. src/api/orderController.ts (BREAKING — calls processOrder via worker interface)
# 3. tests/orders/orderProcessor.test.ts (test file for the source)
# 4. src/orders/orderProcessor.ts (SOURCE — rename last)
task_create title="Rename processOrder → fulfillOrder in orderWorker.ts" category="refactor"
task_create title="Rename processOrder → fulfillOrder in orderController.ts" category="refactor"
task_create title="Update processOrder references in orderProcessor.test.ts" category="refactor"
task_create title="Rename the function itself in orderProcessor.ts" category="refactor"
```

### Loop 4: Produce impact report
```bash
# Impact Report: processOrder
# BREAKING: 6 files — will fail at compile time if renamed without update
# LIKELY: 2 files — type-only imports, TypeScript will catch these
# SAFE: 1 file — README mention only
# Estimated Effort: 6 BREAKING × 5 min = 30 min; 2 LIKELY × 2 min = 4 min; Total: ~35 min
# Risk Flag: src/api/orderController.ts CC=13 — high complexity, introduce bugs easily
# Recommended Approach: Incremental — update leaf files one at a time, run tsc after each
```

---

## Example 2: Before Deleting a Module

**User Request:** "I think `src/analytics/legacyTracker.ts` is unused. Can I just delete it?"

### Loop 1: Verify "unused" claim with multiple search strategies
```bash
find_references symbol="legacyTracker"                                        # typed imports
search_code query="legacyTracker"                                             # all text references
search_code query="legacy-tracker legacytracker"                              # kebab-case, lowercase variants
```

### Loop 2: Check indirect and dynamic references
```bash
search_code query="analytics/legacyTracker"                                   # path-based references (webpack, barrel)
search_code query="require.*legacy"                                           # dynamic require() calls
get_dependencies filepath="src/analytics/legacyTracker.ts"                   # what does it import? (circular risk)
```

### Loop 3: Check non-code references
```bash
search_code query="legacyTracker"                                             # any config files, CI scripts
research_topic topic="analytics tracker safe deletion checklist"              # any non-obvious dependency types
```

### Loop 4: Produce deletion safety report
```bash
# Impact Report: src/analytics/legacyTracker.ts — DELETION ANALYSIS
# BREAKING: 0 files — no typed imports found
# LIKELY: 0 files — no indirect references
# SAFE: 2 files — legacyTracker mentioned in CHANGELOG.md and docs/analytics.md (comments only)
# Dependency check: legacyTracker imports EventEmitter and lodash — no circular deps; no other files import these via it
# Verdict: SAFE TO DELETE — no active dependents; 2 doc references will become stale but are not runtime concerns
# Task: delete src/analytics/legacyTracker.ts + update 2 doc files
task_create title="Delete legacyTracker.ts and update stale doc references" category="cleanup"
```

---

## Example 3: Before Changing an API Signature

**User Request:** "I need to add a required `options` parameter to `sendNotification(userId, message)`. What will break?"

### Loop 1: Find all call sites of the current signature
```bash
find_references symbol="sendNotification"                                      # all callers
search_code query="sendNotification("                                          # catch all call patterns
search_code query="\"sendNotification\""                                       # string references (event systems, mocks)
```

### Loop 2: Assess each caller's impact tier
```bash
get_dependencies filepath="src/notifications/notificationService.ts"          # what sendNotification depends on
complexity_score filepath="src/api/webhookController.ts"                      # highest-risk caller — check CC
complexity_score filepath="src/workers/emailWorker.ts"                        # second highest-risk caller
```

### Loop 3: Map transitive consumers (callers of callers)
```bash
search_code query="import.*notificationService"                                # who imports the module?
find_references symbol="sendNotification" filepath="src/api/webhookController.ts"  # callers of a caller
# Triage: BREAKING: 8 files (all pass only 2 args); LIKELY: 1 file (mocks the function); SAFE: 0
```

### Loop 4: Tasks and execution order
```bash
task_create title="Update sendNotification call in emailWorker.ts — add options param" category="refactor"
task_create title="Update sendNotification call in webhookController.ts — add options param" category="refactor"
task_create title="Update sendNotification call in smsWorker.ts — add options param" category="refactor"
task_create title="Update mock in tests/notifications/notificationService.mock.ts" category="refactor"
task_create title="Add options param to sendNotification signature in notificationService.ts" category="refactor"
# Execution order: workers and controllers first → mock → source last
# Risk Flag: webhookController.ts CC=16 — allocate extra review time
# Recommended Approach: make options optional first (default: {}), then migrate callers, then make required
```

---

## Example 4: Before Extracting a Shared Utility

**User Request:** "I want to extract the date formatting logic from 5 files into a shared `dateUtils.ts`. What's the impact?"

### Loop 1: Find all instances of the logic to be extracted
```bash
search_code query="format date toLocaleDateString Intl.DateTimeFormat"        # find the pattern across files
search_code query="moment format date-fns formatDate"                          # library-based variants
find_references symbol="formatDate"                                            # if a local function already exists in some files
```

### Loop 2: Map the 5 source files and their callers
```bash
get_dependencies filepath="src/components/InvoiceView.tsx"                    # does this file get imported by others?
get_dependencies filepath="src/reports/monthlyReport.ts"                      # same
get_dependencies filepath="src/api/exportController.ts"                       # same
complexity_score filepath="src/components/InvoiceView.tsx"                    # risk of touching it
```

### Loop 3: Identify circular dependency risk of the new utility
```bash
search_code query="import.*dateUtils"                                          # does dateUtils already exist?
research_topic topic="shared utility extraction circular dependency barrel exports TypeScript"
# Verify: none of the 5 source files will create a circular dep via the new dateUtils.ts
```

### Loop 4: Produce extraction plan and tasks
```bash
# Impact Report: Extract dateUtils.ts
# Files to modify: 5 source files (all BREAKING — they own the logic to be removed)
# New file to create: src/utils/dateUtils.ts
# Circular dep risk: 0 — utility has no imports from the 5 source files
# Execution order:
# 1. Create src/utils/dateUtils.ts (no deps on affected files)
# 2. src/reports/monthlyReport.ts (leaf — nothing else imports it from this set)
# 3. src/api/exportController.ts
# 4. src/components/InvoiceView.tsx (CC=11 — high risk, careful)
# 5. 2 remaining files
task_create title="Create src/utils/dateUtils.ts with shared formatting logic" category="refactor"
task_create title="Replace inline date formatting in monthlyReport.ts with dateUtils" category="refactor"
task_create title="Replace inline date formatting in exportController.ts with dateUtils" category="refactor"
task_create title="Replace inline date formatting in InvoiceView.tsx with dateUtils (CC=11 — review carefully)" category="refactor"
```

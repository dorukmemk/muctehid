# Examples: Refactor Suggest in Action

## Example 1: Decomposing a God Class

**User Request:** "Our UserService is getting massive and hard to maintain — suggest how to refactor it."

### Loop 1: Measure Before Touching
```bash
health_score                                        # get project health baseline
complexity_score filepath="src/services/UserService.js"   # measure complexity objectively
get_context filepath="src/services/UserService.js"        # load indexed knowledge of this file
find_references query="UserService"                        # find all callers (blast radius)
```

### Loop 2: Identify Responsibility Clusters
```bash
search_code query="class UserService" path="src/"         # find the class definition
audit_file filepath="src/services/UserService.js"         # get full structural analysis
search_code query="// --- " path="src/services/"          # find existing informal sections
git_blame_context filepath="src/services/UserService.js"  # understand growth history
```

### Loop 3: Structured Decomposition Plan
```bash
run_skill skill="refactor-planner" filepath="src/services/UserService.js"  # get AI plan
task_create title="Refactor: Extract UserAuthService from UserService" category="refactor"
task_create title="Refactor: Extract UserProfileService from UserService" category="refactor"
task_create title="Refactor: Extract UserNotificationService from UserService" category="refactor"
generate_report type="refactor" path="src/services/UserService.js"
```

---

## Example 2: Identifying and Fixing Hotspots Across the Codebase

**User Request:** "Find the most complex files and give me a refactoring roadmap."

### Loop 1: Hotspot Discovery
```bash
health_score                                  # overall quality health
complexity_score filepath="src/"              # rank all files by complexity
find_todos path="src/"                        # surface explicit tech debt markers
search_code query="// FIXME" path="src/"      # find known problem areas
search_code query="// HACK" path="src/"       # find workarounds that need cleanup
```

### Loop 2: Deep Analysis of Top 3 Hotspots
```bash
audit_file filepath="src/utils/dataTransformer.js"    # analyze #1 hotspot
audit_file filepath="src/api/handlers/orderHandler.js" # analyze #2 hotspot
audit_file filepath="src/db/queryBuilder.js"           # analyze #3 hotspot
get_context filepath="src/utils/dataTransformer.js"    # understand transformer context
```

### Loop 3: Prioritized Roadmap
```bash
run_skill skill="refactor-planner" filepath="src/utils/dataTransformer.js"
run_skill skill="refactor-planner" filepath="src/api/handlers/orderHandler.js"
task_create title="Refactor: Split dataTransformer into domain-specific transformers" category="refactor"
task_create title="Refactor: Extract order validation from orderHandler" category="refactor"
generate_report type="refactor" path="src/"
task_next                                             # begin with highest priority
```

---

## Example 3: Refactoring Deeply Nested Logic

**User Request:** "This checkout function has 8 levels of nesting — it's impossible to read."

### Loop 1: Structural Analysis
```bash
get_context filepath="src/checkout/processOrder.js"   # load context
complexity_score filepath="src/checkout/processOrder.js"   # confirm high complexity
audit_file filepath="src/checkout/processOrder.js"    # identify all nested decision points
search_code query="processOrder" path="src/"          # understand all call sites
```

### Loop 2: Pattern Identification
```bash
search_code query="if.*{" path="src/checkout/" glob="*.js"  # count conditional nesting
find_references query="processOrder"                   # who calls this and with what args?
commit_history_search query="processOrder" limit=10    # how did this function evolve?
git_blame_context filepath="src/checkout/processOrder.js"  # understand why it grew
```

### Loop 3: Decomposition Strategy
```bash
run_skill skill="refactor-planner" filepath="src/checkout/processOrder.js"  # get plan
task_create title="Refactor: Extract validateOrderItems() from processOrder" category="refactor"
task_create title="Refactor: Extract applyDiscounts() from processOrder" category="refactor"
task_create title="Refactor: Extract fulfillOrder() from processOrder" category="refactor"
task_create title="Refactor: Replace nested ifs with early returns in processOrder" category="refactor"
generate_report type="refactor" path="src/checkout/processOrder.js"
```

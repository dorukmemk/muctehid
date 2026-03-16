# Examples: Performance Audit in Action

## Example 1: Finding N+1 Query Problems in an ORM-Based Application

**User Request:** "Our API response times are degrading with scale — find any N+1 query problems."

### Loop 1: Query Pattern Discovery
```bash
health_score                                          # establish baseline
get_context filepath="src/models/"                    # load ORM model context
search_code query="findAll\|findOne\|findMany" path="src/"  # locate all ORM calls
search_code query="forEach.*await\|map.*await" path="src/"  # find async loops (N+1 signature)
```

### Loop 2: N+1 Pattern Identification
```bash
audit_file filepath="src/services/OrderService.js"    # audit most complex service
audit_file filepath="src/resolvers/userResolver.js"   # audit GraphQL resolvers (common N+1 source)
search_code query="for.*await\|await.*for" path="src/services/"  # find sequential awaits in loops
search_code query="include:\|populate(" path="src/"   # check for missing eager loading
find_references query="getOrders"                      # trace how orders are fetched
```

### Loop 3: Performance Task Creation
```bash
run_skill skill="performance-audit" filepath="src/services/OrderService.js"
task_create title="Perf: Replace N+1 in OrderService.getUserOrders with eager loading" category="performance"
task_create title="Perf: Add DataLoader to userResolver to batch DB calls" category="performance"
task_create title="Perf: Add query result caching to ProductService.getAll" category="performance"
generate_report type="performance" path="src/services/"
```

---

## Example 2: Identifying Loop Bottlenecks and Memory Leaks

**User Request:** "Our data processing job is eating all available memory and slowing down over time — please audit it."

### Loop 1: Processing Pipeline Analysis
```bash
get_context filepath="src/jobs/dataProcessor.js"      # load context
audit_file filepath="src/jobs/dataProcessor.js"       # full structural analysis
complexity_score filepath="src/jobs/dataProcessor.js" # measure complexity of processing logic
search_code query="while\|for.*of\|forEach\|reduce" path="src/jobs/"  # enumerate all loops
```

### Loop 2: Memory Pattern Detection
```bash
search_code query="\.push(" path="src/jobs/"           # find array accumulation patterns
search_code query="new Array\|new Map\|new Set" path="src/jobs/"  # find data structure creation in loops
search_code query="setInterval\|setTimeout" path="src/jobs/"      # find timer leaks
search_code query="addEventListener\|on(" path="src/jobs/"        # find listener accumulation
audit_file filepath="src/jobs/batchImporter.js"        # audit batch processing logic
```

### Loop 3: Optimization Planning
```bash
run_skill skill="performance-audit" filepath="src/jobs/"  # get comprehensive analysis
task_create title="Perf: Replace full-array accumulation with streaming in dataProcessor" category="performance"
task_create title="Perf: Add explicit listener cleanup in batchImporter" category="performance"
task_create title="Perf: Process in chunks of 1000 instead of loading all records" category="performance"
generate_report type="performance" path="src/jobs/"
task_next
```

---

## Example 3: Frontend Bundle and Render Performance Audit

**User Request:** "Our React app feels sluggish — audit it for performance issues."

### Loop 1: Component Structure Analysis
```bash
get_context filepath="src/components/"                 # load component context
search_code query="useEffect" path="src/components/"   # find effect hooks (re-render sources)
search_code query="useState" path="src/components/"    # find state declarations
audit_file filepath="src/components/Dashboard.tsx"     # audit most complex component
```

### Loop 2: Re-render and Bundle Analysis
```bash
search_code query="useEffect\(\(\) =>" path="src/"     # find effects without deps array
search_code query="\[\]" path="src/components/" glob="*.tsx"   # find empty dep arrays
search_code query="import.*from" path="src/" glob="*.tsx"      # find potentially heavy imports
search_code query="JSON.parse\|JSON.stringify" path="src/components/"  # find expensive ops in render
audit_file filepath="src/components/ProductList.tsx"   # audit large list rendering
```

### Loop 3: Optimization Task Generation
```bash
run_skill skill="performance-audit" filepath="src/components/"
task_create title="Perf: Memoize ProductList with React.memo to prevent re-renders" category="performance"
task_create title="Perf: Add dependency array to useEffect in Dashboard" category="performance"
task_create title="Perf: Virtualize long list in ProductList with react-window" category="performance"
task_create title="Perf: Lazy load heavy chart components with React.lazy" category="performance"
generate_report type="performance" path="src/components/"
```

# Examples: Test Generator in Action

## Example 1: Generating Unit Tests for a Service Layer

**User Request:** "Generate unit tests for our PaymentService — it has zero test coverage."

### Loop 1: Source Analysis
```bash
health_score                                          # get coverage baseline
get_context filepath="src/services/PaymentService.js" # load indexed knowledge
audit_file filepath="src/services/PaymentService.js"  # identify all public methods
find_references query="PaymentService"                # understand how service is consumed
```

### Loop 2: Edge Case Inference
```bash
search_code query="throw new Error" path="src/services/PaymentService.js"  # find error paths
search_code query="if.*amount" path="src/services/PaymentService.js"       # find numeric guards
search_code query="null\|undefined" path="src/services/PaymentService.js"  # find null checks
dependency_audit path="package.json"                  # understand testing framework available
```

### Loop 3: Test Scaffold Generation
```bash
run_skill skill="test-generator" filepath="src/services/PaymentService.js"  # generate tests
task_create title="Tests: Write edge case tests for PaymentService.charge()" category="testing"
task_create title="Tests: Write error path tests for PaymentService" category="testing"
generate_report type="coverage" path="src/services/"
task_next                                             # start writing tests in order
```

---

## Example 2: Writing Integration Tests for an API Endpoint

**User Request:** "We need integration tests for the /api/orders endpoint before we deploy."

### Loop 1: Endpoint Mapping
```bash
get_context filepath="src/routes/orders.js"           # load route context
audit_file filepath="src/routes/orders.js"            # analyze all route handlers
search_code query="router.get\|router.post\|router.put\|router.delete" path="src/routes/orders.js"  # list all endpoints
find_references query="ordersRouter"                  # find where routes are mounted
```

### Loop 2: Business Logic and Validation Rules
```bash
audit_file filepath="src/controllers/OrderController.js"     # find controller logic
audit_file filepath="src/validators/orderValidator.js"       # find validation rules (test boundaries)
search_code query="status.*400\|status.*422" path="src/controllers/"  # find validation error paths
search_code query="status.*404" path="src/controllers/"       # find not-found scenarios
search_code query="status.*403" path="src/controllers/"       # find auth-guarded scenarios
```

### Loop 3: Test Scenario Generation
```bash
run_skill skill="test-generator" filepath="src/routes/orders.js"  # generate integration test scaffold
task_create title="Tests: Happy path — create order with valid payload" category="testing"
task_create title="Tests: Validation error — create order with missing fields" category="testing"
task_create title="Tests: Auth error — create order without JWT" category="testing"
task_create title="Tests: Not found — get order with invalid ID" category="testing"
generate_report type="coverage" path="src/routes/"
```

---

## Example 3: Inferring Edge Cases from Complex Business Logic

**User Request:** "The discount calculation logic is business-critical — make sure it's fully tested."

### Loop 1: Logic Tracing
```bash
get_context filepath="src/pricing/discountCalculator.js"       # load context
audit_file filepath="src/pricing/discountCalculator.js"        # full structural analysis
complexity_score filepath="src/pricing/discountCalculator.js"  # measure complexity (= min test count)
search_code query="if\|switch\|ternary" path="src/pricing/discountCalculator.js"  # count branches
```

### Loop 2: Boundary and Rule Discovery
```bash
search_code query=">=\|<=\|===" path="src/pricing/discountCalculator.js"   # find comparison boundaries
search_code query="Math.min\|Math.max\|Math.floor" path="src/pricing/"     # find capping logic
search_code query="throw\|return null\|return 0" path="src/pricing/"       # find exit conditions
commit_history_search query="discount" limit=15       # find historical bugs in this area
git_blame_context filepath="src/pricing/discountCalculator.js"  # understand design intent
```

### Loop 3: Comprehensive Test Generation
```bash
run_skill skill="test-generator" filepath="src/pricing/discountCalculator.js"
task_create title="Tests: Discount at exact tier boundaries (0%, 10%, 20%)" category="testing"
task_create title="Tests: Stacked discounts — coupon + loyalty + seasonal" category="testing"
task_create title="Tests: Negative discount prevention" category="testing"
task_create title="Tests: Discount on zero-price items" category="testing"
generate_report type="coverage" path="src/pricing/"
task_next
```

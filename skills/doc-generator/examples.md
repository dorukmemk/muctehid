# Examples: Doc Generator in Action

## Example 1: Generating JSDoc for an Undocumented Utility Library

**User Request:** "Our utils folder has zero documentation — generate JSDoc for all of it."

### Loop 1: Coverage Assessment
```bash
health_score                                    # get documentation health baseline
search_code query="\/\*\*" path="src/utils/"    # find already-documented functions
search_code query="export function\|export const" path="src/utils/"  # find all exports
audit_file filepath="src/utils/dateHelpers.js"  # analyze first utility file
```

### Loop 2: Function Signature Extraction
```bash
get_context filepath="src/utils/dateHelpers.js"     # load indexed context
get_context filepath="src/utils/stringHelpers.js"   # load indexed context
get_context filepath="src/utils/arrayHelpers.js"    # load indexed context
find_references query="formatDate"                   # understand how functions are used in practice
find_references query="truncateString"               # usage patterns reveal intent
```

### Loop 3: Documentation Generation
```bash
run_skill skill="doc-generator" filepath="src/utils/"  # generate JSDoc for all utils
task_create title="Docs: Review and approve auto-generated JSDoc for utils" category="docs"
task_create title="Docs: Add @example sections to formatDate and formatCurrency" category="docs"
generate_report type="documentation" path="src/utils/"
task_next
```

---

## Example 2: Documenting a Public API Module

**User Request:** "We're open-sourcing the API client library — it needs complete documentation first."

### Loop 1: Public Interface Discovery
```bash
get_context filepath="src/api-client/"                 # load full module context
audit_file filepath="src/api-client/index.js"          # identify all public exports
search_code query="export" path="src/api-client/"      # enumerate every exported symbol
search_code query="@param\|@returns" path="src/api-client/"  # find existing partial docs
```

### Loop 2: Usage and Intent Analysis
```bash
find_references query="ApiClient"                      # see how the client is actually used
find_references query="createClient"                   # understand construction patterns
commit_history_search query="api-client" limit=20      # understand API evolution
search_code query="throw new Error" path="src/api-client/"   # document all error conditions
```

### Loop 3: Complete Documentation Generation
```bash
run_skill skill="doc-generator" filepath="src/api-client/"  # generate full docs
task_create title="Docs: Add @throws documentation for all API error codes" category="docs"
task_create title="Docs: Add @example for each public method" category="docs"
task_create title="Docs: Generate README from JSDoc" category="docs"
generate_report type="documentation" path="src/api-client/"
generate_report type="coverage" path="src/api-client/"
```

---

## Example 3: Documenting Complex Business Logic for Knowledge Transfer

**User Request:** "The original developer is leaving next week and this pricing engine has no docs. We need to document it urgently."

### Loop 1: Logic Archaeology
```bash
get_context filepath="src/pricing/"                         # load all pricing module context
git_blame_context filepath="src/pricing/pricingEngine.js"  # identify original author's intent
commit_history_search query="pricing engine" limit=30       # trace design decisions
audit_file filepath="src/pricing/pricingEngine.js"          # full structural analysis
```

### Loop 2: Business Rule Extraction
```bash
search_code query="\/\/ " path="src/pricing/"              # find informal inline comments
search_code query="RULE\|BUSINESS\|LOGIC" path="src/pricing/"  # find labeled business rules
find_references query="calculatePrice"                       # find all consumption patterns
find_references query="PricingEngine"                        # find class usage context
complexity_score filepath="src/pricing/pricingEngine.js"    # identify most opaque sections
```

### Loop 3: Urgent Documentation Sprint
```bash
run_skill skill="doc-generator" filepath="src/pricing/"  # generate documentation
task_create title="Docs: Document pricing tier logic in pricingEngine.js" category="docs"
task_create title="Docs: Add architecture decision record for pricing algorithm" category="docs"
task_create title="Docs: Create pricing module README with business rules" category="docs"
generate_report type="documentation" path="src/pricing/"
task_next                                                # prioritize by complexity order
```

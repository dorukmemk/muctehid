# Examples: Code Review in Action

## Example 1: Reviewing a Pull Request for Anti-Patterns

**User Request:** "Review this PR — it adds a new user authentication flow."

### Loop 1: Context Building
```bash
health_score                                    # understand project baseline before reviewing
get_context filepath="src/auth/"                # load indexed knowledge of auth module
get_context filepath="src/middleware/auth.js"   # understand existing auth middleware
search_code query="authenticate" path="src/"    # find all auth-related code patterns
```

### Loop 2: PR-Level Analysis
```bash
audit_diff                                      # scan diff for security issues and anti-patterns
audit_file filepath="src/auth/login.js"         # deep review of new login handler
audit_file filepath="src/auth/register.js"      # deep review of registration flow
complexity_score filepath="src/auth/login.js"   # check if login logic is too complex
```

### Loop 3: Pattern and Reference Checking
```bash
find_references query="hashPassword"            # verify password hashing is used everywhere
find_references query="sanitize"                # check input sanitization coverage
search_code query="TODO" path="src/auth/"       # find any deferred work left in PR
task_create title="Review: Simplify login handler (complexity score high)" category="review"
generate_report type="review" path="src/auth/"
```

---

## Example 2: Finding Anti-Patterns Across the Codebase

**User Request:** "Do a full code review — I suspect we have a lot of anti-patterns accumulating."

### Loop 1: Hotspot Identification
```bash
health_score                                    # get overall code quality score
complexity_score filepath="src/"                # find most complex files (hotspots)
find_todos path="src/"                          # surface deferred work and tech debt markers
search_code query="// HACK" path="src/"         # find explicitly marked hacks
search_code query="// FIXME" path="src/"        # find known broken code
```

### Loop 2: Anti-Pattern Deep Scan
```bash
audit_file filepath="src/services/UserService.js"   # audit largest service class
audit_file filepath="src/utils/helpers.js"           # audit utility sprawl
search_code query="any" path="src/" glob="*.ts"      # TypeScript: find type escapes
search_code query="console.log" path="src/"          # find debug logs left in production code
search_code query="catch (e) {}" path="src/"         # find swallowed errors (silent failures)
```

### Loop 3: Recommendations
```bash
run_skill skill="refactor-planner" filepath="src/services/UserService.js"  # get refactor plan
task_create title="Refactor: Break up UserService god class" category="tech-debt"
task_create title="Cleanup: Remove all console.log from production code" category="quality"
task_create title="Fix: Handle all empty catch blocks" category="bug"
generate_report type="review" path="src/"
```

---

## Example 3: Reviewing for Consistency and Standards

**User Request:** "New developer just submitted their first big feature — give me a thorough review."

### Loop 1: Standards Baseline
```bash
get_context filepath="src/features/dashboard/"  # load context for the feature area
search_code query="export default" path="src/features/" glob="*.tsx"  # check component patterns
search_code query="useEffect" path="src/features/dashboard/"  # find React hook usage
search_code query="async/await" path="src/features/dashboard/"  # check async patterns
```

### Loop 2: Quality and Correctness
```bash
audit_file filepath="src/features/dashboard/DashboardPage.tsx"   # review main component
audit_file filepath="src/features/dashboard/hooks/useData.ts"    # review custom hook
audit_file filepath="src/features/dashboard/api/dashboardApi.ts" # review API layer
complexity_score filepath="src/features/dashboard/"              # measure overall complexity
```

### Loop 3: Mentorship-Oriented Feedback
```bash
find_references query="DashboardPage"           # check how component is consumed
search_code query="PropTypes" path="src/features/dashboard/"     # check prop validation
search_code query="error boundary" path="src/features/dashboard/" # check error handling
task_create title="Review feedback: Dashboard — extract data fetching to service layer" category="review"
task_create title="Review feedback: Dashboard — add error boundary" category="review"
generate_report type="review" path="src/features/dashboard/"
```

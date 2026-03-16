# Examples: Security Audit in Action

## Example 1: Finding Secrets and Credentials in a Node.js API

**User Request:** "Can you check our API codebase for any exposed secrets or credentials?"

### Loop 1: Discovery Phase
```bash
health_score                              # establish baseline project health
find_secrets path="src/"                  # scan for hardcoded secrets, API keys, tokens
find_secrets path="config/"               # check config directories separately
search_code query="process.env" path="src/"  # find all env var usage patterns
```

### Loop 2: Deep Scan Phase
```bash
security_scan path="src/api/"             # OWASP-aligned scan on API layer
audit_file filepath="src/config/database.js"  # audit DB connection config
audit_file filepath="src/middleware/auth.js"  # audit authentication middleware
get_context filepath="src/utils/crypto.js"    # understand crypto utilities before auditing
```

### Loop 3: Reporting and Remediation
```bash
find_references query="SECRET_KEY"        # find all usages of known secret names
find_references query="API_KEY"           # find API key references
task_create title="Fix: Rotate exposed DB credentials" category="security"
task_create title="Fix: Move hardcoded tokens to env vars" category="security"
generate_report type="security" path="src/"  # generate full security report
```

---

## Example 2: OWASP Top 10 Scan on a Web Application

**User Request:** "Run a full OWASP security audit on our web app before we deploy."

### Loop 1: Reconnaissance
```bash
health_score                              # overall project health snapshot
get_context filepath="src/routes/"        # understand routing structure
search_code query="req.params" path="src/routes/"   # find user input entry points
search_code query="req.query" path="src/routes/"    # find query param usage
search_code query="req.body" path="src/routes/"     # find body parsing usage
```

### Loop 2: Injection Vulnerability Scanning
```bash
security_scan path="src/routes/"          # scan all routes for injection risks
search_code query="eval(" path="src/"     # find dangerous eval() usage
search_code query="innerHTML" path="src/" # find potential XSS vectors
search_code query="dangerouslySetInnerHTML" path="src/"  # React XSS check
audit_file filepath="src/db/queries.js"   # audit raw SQL query patterns
```

### Loop 3: Auth and Session Analysis
```bash
audit_file filepath="src/middleware/auth.js"   # check JWT/session handling
audit_file filepath="src/routes/auth.js"       # check login/register endpoints
search_code query="jwt.sign" path="src/"       # find JWT signing (check expiry)
search_code query="bcrypt" path="src/"         # verify password hashing
task_create title="Security: Add rate limiting to /login" category="security"
generate_report type="security" path="src/"
```

---

## Example 3: Pre-Commit Security Gate

**User Request:** "I'm about to commit changes to the payment module — check everything is safe."

### Loop 1: Diff-Level Audit
```bash
audit_diff                                # scan all uncommitted changes
find_secrets path="src/payments/"         # targeted secrets scan on payment module
audit_file filepath="src/payments/stripe.js"    # audit Stripe integration
audit_file filepath="src/payments/checkout.js"  # audit checkout flow
```

### Loop 2: Dependency and Input Validation
```bash
dependency_audit path="package.json"      # check for vulnerable payment-related deps
search_code query="stripe.charges.create" path="src/payments/"  # audit charge creation
search_code query="req.body.cardNumber" path="src/"  # find raw card data handling
security_scan path="src/payments/"        # full OWASP scan on payments dir
```

### Loop 3: Compliance Verification
```bash
search_code query="console.log" path="src/payments/"  # find any PCI-violating logs
find_references query="cardNumber"        # trace card data flow through codebase
task_create title="Security: Ensure no PCI data logged in payments" category="security"
generate_report type="security" path="src/payments/"
task_next                                 # confirm what to address before commit
```

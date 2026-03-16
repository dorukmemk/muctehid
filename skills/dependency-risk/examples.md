# Examples: Dependency Risk in Action

## Example 1: Pre-Release CVE Scan on a Node.js Application

**User Request:** "We're shipping v2.0 next week — scan all our dependencies for known vulnerabilities."

### Loop 1: Dependency Inventory
```bash
health_score                                          # establish baseline project health
dependency_audit path="package.json"                  # full CVE scan on all dependencies
dependency_audit path="package-lock.json"             # include transitive dependencies
search_code query="require(" path="src/" glob="*.js"  # find all runtime dependency usages
```

### Loop 2: Severity Classification
```bash
audit_file filepath="package.json"                    # analyze declared dependency structure
search_code query="devDependencies" path="package.json"  # separate dev from prod deps
find_references query="express"                        # understand express usage scope
find_references query="axios"                          # understand axios usage scope
find_references query="lodash"                         # understand lodash usage scope
```

### Loop 3: Remediation Planning
```bash
run_skill skill="dependency-risk" filepath="package.json"  # get full risk analysis
task_create title="Security: Upgrade lodash to 4.17.21 (prototype pollution CVE)" category="security"
task_create title="Security: Replace node-serialize (RCE vulnerability, no fix)" category="security"
task_create title="Security: Update express to latest patch (regex DoS CVE)" category="security"
generate_report type="dependencies" path="."
task_next
```

---

## Example 2: Identifying Abandoned and Risky Packages

**User Request:** "I want to know which of our dependencies are unmaintained or dangerously out of date."

### Loop 1: Dependency Age and Activity Analysis
```bash
get_context filepath="package.json"                   # load context
dependency_audit path="package.json"                  # full audit including maintenance status
audit_file filepath="package.json"                    # structural analysis of dependency tree
search_code query="\"version\"" path="package.json"   # review current declared versions
```

### Loop 2: Usage Impact Assessment
```bash
find_references query="moment"                        # find moment.js usage (known abandonware)
find_references query="request"                       # find 'request' library (deprecated)
find_references query="jquery"                        # find jQuery usage (often replaceable)
search_code query="import.*from" path="src/" glob="*.ts"   # TypeScript imports audit
```

### Loop 3: Migration Planning
```bash
run_skill skill="dependency-risk" filepath="package.json"
task_create title="Deps: Replace moment.js with date-fns (abandoned, 67KB lighter)" category="tech-debt"
task_create title="Deps: Replace deprecated 'request' library with axios" category="tech-debt"
task_create title="Deps: Audit and remove unused devDependencies" category="tech-debt"
generate_report type="dependencies" path="."
```

---

## Example 3: Supply Chain Security Audit

**User Request:** "We need a supply chain security review — check for dependency confusion and typosquatting risks."

### Loop 1: Package Namespace Analysis
```bash
health_score                                          # project health context
dependency_audit path="package.json"                  # full dependency audit
audit_file filepath="package.json"                    # examine all package names closely
find_secrets path="."                                 # check for secrets in npm config
```

### Loop 2: Scope and Source Verification
```bash
search_code query="@" path="package.json"             # find all scoped packages
search_code query="\"integrity\"" path="package-lock.json"   # verify integrity hashes exist
search_code query="\"resolved\"" path="package-lock.json"    # verify all sources resolve to npm
audit_file filepath=".npmrc"                          # check npm registry configuration
```

### Loop 3: Supply Chain Risk Tasks
```bash
run_skill skill="dependency-risk" filepath="package.json"
task_create title="Security: Enable npm audit in CI pipeline" category="security"
task_create title="Security: Pin all dependency versions (remove ^ and ~)" category="security"
task_create title="Security: Add Subresource Integrity checks for CDN scripts" category="security"
task_create title="Security: Verify all @scoped packages use official registry" category="security"
generate_report type="dependencies" path="."
task_next
```

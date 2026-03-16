# Examples: License Scan in Action

## Example 1: Pre-Release License Compatibility Check

**User Request:** "We're about to release our commercial SaaS product — make sure none of our dependencies have GPL licenses that would contaminate our code."

### Loop 1: License Inventory
```bash
health_score                                         # project health baseline
dependency_audit path="package.json"                 # get full dependency list with license metadata
audit_file filepath="package.json"                   # analyze dependency declarations
search_code query="license" path="package.json"      # find any license declarations
```

### Loop 2: GPL Contamination Check
```bash
run_skill skill="license-scan" filepath="package.json"   # comprehensive license scan
search_code query="GPL\|LGPL\|AGPL" path="node_modules/" glob="*/LICENSE*"  # direct GPL file check
find_references query="gpl"                          # search for GPL mentions in project files
audit_file filepath="LICENSE"                        # verify your own project's license
```

### Loop 3: Remediation and Documentation
```bash
task_create title="License: Replace GPL-licensed 'some-lib' with MIT alternative" category="legal"
task_create title="License: Document LGPL dependency usage and isolation strategy" category="legal"
task_create title="License: Add LICENSE files to all first-party packages" category="legal"
generate_report type="licenses" path="."
task_next
```

---

## Example 2: Open Source Project License Audit

**User Request:** "We're open-sourcing this project under MIT — audit all dependencies for compatibility."

### Loop 1: Compatibility Matrix Building
```bash
dependency_audit path="package.json"                 # full license metadata scan
audit_file filepath="package.json"                   # inventory of all dependencies
search_code query="\"license\"" path="node_modules/" glob="*/package.json"  # enumerate all licenses
find_secrets path="."                                # ensure no proprietary code mixed in
```

### Loop 2: Copyleft and Proprietary Detection
```bash
run_skill skill="license-scan" filepath="package.json"  # full scan
search_code query="UNLICENSED\|proprietary\|Proprietary" path="node_modules/"  # find non-OSS
search_code query="commercial" path="node_modules/" glob="*/LICENSE*"  # find commercial-only
audit_file filepath="package-lock.json"              # include transitive dependency licenses
```

### Loop 3: Attribution and Compliance
```bash
task_create title="License: Generate THIRD-PARTY-LICENSES.md for all dependencies" category="legal"
task_create title="License: Remove UNLICENSED package 'some-tool' or request permission" category="legal"
task_create title="License: Add copyright headers to all source files" category="legal"
generate_report type="licenses" path="."
task_next
```

---

## Example 3: Enterprise Procurement License Clearance

**User Request:** "Legal needs a complete license report for all dependencies before we can use this in our enterprise product."

### Loop 1: Complete Dependency Tree Analysis
```bash
health_score                                         # context
dependency_audit path="package.json"                 # full dependency + license data
dependency_audit path="package-lock.json"            # include all transitive dependencies
audit_file filepath="package.json"                   # analyze structure
```

### Loop 2: License Category Classification
```bash
run_skill skill="license-scan" filepath="package.json"  # comprehensive scan with categories
search_code query="Apache\|MIT\|BSD\|ISC" path="node_modules/" glob="*/LICENSE*"   # permissive
search_code query="MPL\|CDDL\|EPL" path="node_modules/" glob="*/LICENSE*"          # weak copyleft
search_code query="GPL\|AGPL\|LGPL" path="node_modules/" glob="*/LICENSE*"         # strong copyleft
find_references query="Creative Commons"             # find CC licenses (not for software)
```

### Loop 3: Legal Report Generation
```bash
task_create title="License: Create legal-approved dependency list for procurement" category="legal"
task_create title="License: Get legal review for 3 MPL-licensed dependencies" category="legal"
task_create title="License: Replace AGPL 'charting-lib' with commercial alternative" category="legal"
generate_report type="licenses" path="."
task_next
```

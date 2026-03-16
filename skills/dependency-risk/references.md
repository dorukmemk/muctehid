# References: Dependency Risk — Manus Principles Applied

## The 6 Manus Principles for Dependency Risk

### 1. Every Dependency Is Trusted Code You Did Not Write
Adding a dependency is a trust decision. Every package in your tree is code that runs in your production environment.

> "Before auditing CVEs, understand what each dependency actually does with `find_references`. A vulnerability in a package you use only for string formatting is less critical than one in your auth library."

- The risk of a vulnerability = (CVSS score) × (how centrally the package is used)
- A critical CVE in a devDependency that never ships to production has zero production impact
- Understand the blast radius: how many of your files import the vulnerable package?

### 2. Transitive Dependencies Are Your Responsibility
Your declared dependencies are the surface. The transitive graph is the attack surface.

> "Always run `dependency_audit path='package-lock.json'` to include transitive dependencies. The vulnerability is never in the package you know — it is in the package your package uses."

- The average npm package has 79 transitive dependencies
- A single direct dependency can pull in hundreds of transitive packages
- Lock files (`package-lock.json`, `yarn.lock`) must be committed and audited

### 3. Maintenance Status Is a Security Indicator
An unmaintained package with no known CVEs today will have an unpatched CVE tomorrow.

> "A package with its last commit 3 years ago and 47 open security issues is a ticking vulnerability, even if it has no CVEs today."

| Signal | Risk Level |
|--------|-----------|
| Last release > 2 years | High — unlikely to receive security patches |
| Deprecated on npm | Critical — use the recommended replacement |
| Repository archived | Critical — no security updates ever |
| Single maintainer | Medium — bus factor risk |
| Many open security issues | High — maintainer capacity risk |

### 4. Classify Vulnerabilities by Actual Exploitability
CVSS scores are generic. Your actual risk depends on how you use the package and whether the attack vector is reachable in your application.

> "A 9.8 CVSS SQL injection in a package you use only on the server side for a non-SQL operation has a real-world severity of zero."

| CVSS | Generic | Reachable? | Actual Priority |
|------|---------|-----------|----------------|
| 9.8 | Critical | No | Low |
| 9.8 | Critical | Yes | Critical — fix immediately |
| 6.5 | Medium | Yes, from internet | High |
| 6.5 | Medium | Only from auth users | Medium |
| 3.1 | Low | Any | Informational |

### 5. Prefer Removal Over Patching When Possible
The safest version of a dependency is the one that is not there.

> "Before upgrading a vulnerable package, ask: do we actually need this dependency? `find_references` will tell you. If it is used in one place for one utility function, replace it with 10 lines of native code."

- Every dependency removed reduces attack surface, bundle size, and maintenance burden
- Native platform APIs have grown significantly — many npm packages now have native equivalents
- Small utility packages (leftpad-style) should almost always be replaced with inline code

### 6. Automate Continuous Monitoring
A dependency audit done once before a release provides one-time assurance. Vulnerabilities are disclosed continuously.

> "Add `dependency_audit` to CI. A CVE disclosed the day after your release means you are vulnerable until your next audit cycle."

- Add `dependency_audit` to your pre-commit hook (via `audit_diff`)
- Schedule weekly automated dependency scans in CI
- Subscribe to security advisories for your most critical dependencies

---

## Agent Loop: Dependency Risk Steps

```
ANALYZE   → dependency_audit + audit_file on package.json (inventory + CVEs)
THINK     → classify by: severity × reachability × maintenance status
SELECT    → choose action: upgrade / replace / remove / accept (with documentation)
EXECUTE   → run_skill dependency-risk for comprehensive analysis
OBSERVE   → prioritize by production impact, not just CVSS score
ITERATE   → task_create per vulnerability, verify remediation, re-audit
```

---

## Key Quotes

> "You are responsible for your dependency tree, not just your code. Every npm install is an implicit trust decision."

> "The question is not 'does this package have a CVE?' — it is 'if this package is compromised, what can an attacker do in your system?'"

> "Dependencies that solve problems are assets. Dependencies that you forgot you added are liabilities."

> "A 100-line utility package with 3 million weekly downloads is more likely to be a supply chain attack target than your entire codebase."

---

## 3-Strike Protocol

When dependency audit returns no critical findings but performance/security issues persist:

1. **Strike 1:** Audit `package-lock.json` instead of `package.json` — transitive vulnerabilities are invisible at the manifest level
2. **Strike 2:** Search for `require()` calls with dynamic strings using `search_code` — dynamic requires can load packages not listed in package.json
3. **Strike 3:** Check `.npmrc` and CI pipeline for alternative registry configurations — private registry packages may not appear in public CVE databases

> "If three audit passes find nothing, consider whether your tooling has visibility into your full dependency graph, including monorepo workspaces and optional dependencies."

---

## Risk Classification Matrix

| Category | Action | Urgency |
|----------|--------|---------|
| Critical CVE + reachable from internet | Block deploy, fix immediately | Hours |
| Critical CVE + reachable only internally | Fix before next release | Days |
| High CVE + used in production | Fix this sprint | Week |
| Medium CVE + used in production | Add to backlog | Sprint |
| Low CVE | Document, fix opportunistically | Quarter |
| Abandoned package (no CVE) | Plan migration | Quarter |
| Deprecated package | Plan migration | Sprint |
| Outdated (2+ major versions behind) | Evaluate upgrade cost | Quarter |

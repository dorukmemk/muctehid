# References: License Scan — Manus Principles Applied

## The 6 Manus Principles for License Scan

### 1. Understand Your Own License First
Before auditing dependencies, know what obligations your own project's license creates. Your license determines which dependency licenses are compatible.

> "Run `audit_file filepath='LICENSE'` on your own project before scanning dependencies. Compatibility flows from your license outward, not inward."

| Your License | Compatible Dependencies | Incompatible |
|-------------|------------------------|--------------|
| MIT | MIT, BSD, Apache 2.0, ISC, LGPL | AGPL (if networked) |
| Apache 2.0 | MIT, BSD, ISC | GPL v2 |
| GPL v3 | MIT, BSD, Apache 2.0, LGPL, GPL | AGPL (depends) |
| Proprietary / Commercial | MIT, BSD, Apache 2.0, ISC, LGPL | GPL, AGPL, SSPL |

### 2. Transitive Licenses Matter as Much as Direct Ones
GPL contamination travels through the transitive dependency tree. Your MIT-licensed direct dependency may pull in a GPL package.

> "Always run `dependency_audit path='package-lock.json'` to get transitive dependency licenses. The direct dependencies are the visible layer — the transitive graph is the legal exposure."

- A GPL library in your transitive tree can trigger copyleft obligations even if you never directly import it
- LGPL is more permissive: dynamic linking is generally safe, but static linking triggers copyleft
- AGPL extends copyleft to network use — a SaaS product using AGPL code must open-source its server code

### 3. Classify Licenses by Copyleft Strength
Not all non-permissive licenses are equally restrictive. Understanding the spectrum prevents over-reaction and under-reaction.

| Category | Examples | Obligation |
|----------|---------|-----------|
| Permissive | MIT, BSD-2, BSD-3, ISC, Apache 2.0 | Attribution in NOTICE/README |
| Weak copyleft | LGPL, MPL 2.0, CDDL | Modifications to the library must be open-sourced |
| Strong copyleft | GPL v2, GPL v3 | Your entire combined work must be open-sourced |
| Network copyleft | AGPL v3, SSPL | Network use (SaaS) triggers copyleft |
| Non-commercial | CC BY-NC, custom | Cannot be used in commercial products |
| Proprietary | UNLICENSED, custom EULA | Rights explicitly restricted — requires permission |

### 4. Attribution Is a Legal Requirement, Not a Courtesy
Permissive licenses require attribution. Failing to include required copyright notices is a license violation, even for MIT.

> "Every permissive license requires you to include the copyright notice and license text in your distributions. Use `generate_report type='licenses'` to produce an attribution document."

- MIT: include copyright notice and license text in distributions
- Apache 2.0: include NOTICE file, credit modifications, include license text
- BSD: include copyright notice in source and binaries
- Create a `THIRD-PARTY-LICENSES.md` file that satisfies all attribution requirements

### 5. Isolate, Don't Just Identify
Finding a problematic license is only the first step. Isolation strategies can allow use of copyleft-licensed code without triggering full contamination.

> "LGPL code linked dynamically (as a shared library) is generally safe for proprietary use. Document the isolation strategy with `task_create category='legal'`."

| Isolation Strategy | Applicability |
|-------------------|--------------|
| Dynamic linking | LGPL — user can swap out the library |
| Service isolation | AGPL — run in a separate process with an API boundary |
| Remove and replace | Any — replace with a permissive-licensed alternative |
| Obtain commercial license | Any — buy the right to use without copyleft |
| Fork and re-license | Permissive originals only — not applicable to GPL |

### 6. License Compliance Is an Ongoing Process
New dependencies are added continuously. A one-time license audit is a snapshot that becomes stale immediately.

> "Add `run_skill skill='license-scan'` to your CI pipeline. A GPL dependency added by a new developer on day 2 is invisible until the next audit cycle."

- Add license-scan as a CI gate with a blocklist of prohibited license types
- Require legal approval for any new dependency with a non-permissive license
- Use `dependency_audit` before every `npm install` of a new package

---

## Agent Loop: License Scan Steps

```
ANALYZE   → dependency_audit + audit_file on LICENSE (inventory + own license)
THINK     → classify each license by category, identify compatibility conflicts
SELECT    → choose action per conflict: replace / isolate / get permission / accept
EXECUTE   → run_skill license-scan for comprehensive categorized report
OBSERVE   → verify no GPL contamination in proprietary code, check attribution requirements
ITERATE   → task_create per violation, generate attribution docs, add CI gate
```

---

## Key Quotes

> "A license is not a suggestion. It is a legal contract that governs how software may be used, modified, and distributed."

> "The viral nature of GPL is a feature, not a bug — for free software advocates. For commercial developers, it is a legal constraint that must be understood before using any GPL-licensed code."

> "UNLICENSED code is not public domain. It is all-rights-reserved by default. You cannot legally use it without explicit permission from the author."

> "Attribution requirements are the minimum obligation. Not meeting them is a license violation, even for MIT-licensed code."

---

## 3-Strike Protocol

When a license scan cannot determine the license of a dependency:

1. **Strike 1:** Check the package's `package.json` `"license"` field and `LICENSE` file directly with `audit_file`
2. **Strike 2:** Use `commit_history_search` to check if the package was ever given a license or if it changed licenses
3. **Strike 3:** Treat UNLICENSED as all-rights-reserved and `task_create` to either obtain a license or find a replacement

> "When in doubt, assume the most restrictive interpretation. Ask legal counsel for packages critical to your business model."

---

## License Compatibility Quick Reference

```
Permissive → Permissive  : COMPATIBLE
Permissive → GPL         : COMPATIBLE (can use MIT in GPL project)
GPL → Proprietary        : INCOMPATIBLE (cannot use GPL in proprietary without full open-source)
AGPL → SaaS              : INCOMPATIBLE (network use triggers AGPL copyleft)
LGPL → Dynamic link      : COMPATIBLE
LGPL → Static link       : INCOMPATIBLE
UNLICENSED → Any use     : REQUIRES PERMISSION
Non-commercial → Commercial : INCOMPATIBLE
```

## Archaeological Report: {file path}

### Origin
- **Created:** {date} by {author email}
- **First commit:** {hash} — "{commit message}"
- **Original purpose:** {inferred from first commit message and initial code structure}
- **Original size:** {approximate line count at creation} lines, {function count} functions

### Evolution Timeline

| Date | Hash | Author | Change Type | Summary |
|------|------|--------|-------------|---------|
| {date} | {hash} | {author} | Creation | {what the file was when first committed} |
| {date} | {hash} | {author} | Bug Fix | {what was broken and how it was fixed} |
| {date} | {hash} | {author} | Feature | {what capability was added} |
| {date} | {hash} | {author} | Refactor | {what structural change was made} |
| {date} | {hash} | {author} | Performance | {what performance change was made} |

### Key Decisions

- **{date} ({hash}):** {Decision made}. Rationale: {from commit message or [Inferred: reason]}.
- **{date} ({hash}):** {Decision made}. Rationale: {stated or inferred}.

*Note: Decisions where no commit rationale is available are marked [No rationale in git history].*

### Current State

- **Complexity score:** {highest function CC} peak (target: ≤10 per function)
- **Top contributors:** {author} ({N} lines, ~{%}%), {author} ({M} lines, ~{%}%)
- **Highest-complexity function:** `{function name}` (CC: {score})
  - CC at creation: {original CC} | CC today: {current CC} | Growth: {multiplier}x
- **Original core (unmodified since creation):** {list of lines or "none — all lines modified"}
- **High-churn zone:** {function or line range with most distinct authors}
- **Current purpose:** {what the file actually does today}
- **Scope drift:** {YES/NO} — Original: "{original scope}". Current: "{current scope}".

### Technical Debt

- **{Debt item}:** Accumulated because {reason from history — cite specific commits}.
- **{Debt item}:** Introduced in {commit hash} during {type of change}; not addressed since.

### Callers and Dependents

| File | Relationship | Notes |
|------|-------------|-------|
| {file} | Direct import + call | {what function it calls} |
| {file} | Type-only import | {what type it uses} |
| {file} | String reference | {where the name appears as a string} |

**Total callers:** {N} files across {M} distinct modules

### Recommendations

| Assessment | Rationale |
|------------|-----------|
| {Keep as-is / Refactor / Rewrite / Delete} | {Specific evidence: at least 2 sources} |

**If Keep:** {Reason it should remain unchanged}

**If Refactor:** Focus on `{function}` — CC grew from {N} to {M} without corresponding design review. Suggested extraction: {helper function names}.

**If Rewrite:** Original design predates {context (framework, compliance requirement, scale)}. A clean implementation would eliminate {specific complexity sources}.

**If Delete:** {N} search strategies found 0 references. Last commit ({hash}, {date}) explicitly marked for deletion. Safe to remove.

<!-- INSTRUCTIONS:
- Every claim in this report must cite a source (commit hash, blame line, search result).
- Label inferences explicitly: "[Inferred: reason]"
- Label absent evidence explicitly: "[No commit rationale available]"
- The recommendation must cite at least 2 pieces of evidence.
- Do not leave any section as "(not available)" without explaining why the data wasn't found.
-->

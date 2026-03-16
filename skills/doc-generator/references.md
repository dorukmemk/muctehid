# References: Doc Generator — Manus Principles Applied

## The 6 Manus Principles for Doc Generator

### 1. Understand Before Documenting
Documentation generated without understanding the code's purpose produces accurate descriptions of wrong behavior.

> "Use `get_context` and `git_blame_context` before generating any documentation. The original author's intent is more important than the current implementation."

- Code that looks like it does X might actually be a workaround for Y — document the intent, not just the mechanics
- Use `commit_history_search` to find the PR or commit that introduced the code — commit messages often contain the design rationale
- Check how code is actually used with `find_references` — usage reveals the real contract better than the signature

### 2. Document the Contract, Not the Implementation
A function's documentation should describe what it promises, not how it fulfills that promise.

> "The worst documentation is: 'This function loops over items and returns a result.' The best documentation describes: inputs, outputs, preconditions, postconditions, and failure modes."

| JSDoc Section | What to Document |
|--------------|-----------------|
| `@description` | What the function promises to do (not how) |
| `@param` | Type, name, constraints, and whether optional |
| `@returns` | Type and meaning of return value |
| `@throws` | Every error condition and when it occurs |
| `@example` | At least one realistic usage example |
| `@see` | Related functions, external references |

### 3. Prioritize by Value
Not all code deserves equal documentation effort. Focus on what others will need to understand.

> "A private helper used in one place needs a one-line comment. A public API method used by 50 callers needs complete JSDoc."

| Priority | Code Type | Documentation Level |
|----------|-----------|-------------------|
| Critical | Public API exports, library interfaces | Full JSDoc with examples |
| High | Service layer, complex business logic | Full JSDoc, architecture notes |
| Medium | Internal utilities, shared helpers | JSDoc signature + description |
| Low | Simple private helpers | Single line comment if complex |
| Skip | Self-explanatory trivial code | None |

### 4. Make Examples Concrete and Runnable
Abstract documentation is remembered. Concrete examples are used.

> "Every `@example` must show realistic input and expected output — not placeholder values like `someValue` or `exampleParam`."

- Use real domain values in examples: prices, dates, usernames — not `foo`, `bar`, `test`
- Show the error case in an example as well as the success case
- Examples should be copy-pasteable into a REPL and produce the documented output

### 5. Documentation Is a Product, Not a Chore
Documentation that no one reads has negative value — it creates maintenance burden without benefit.

> "Generate documentation in the format your team will actually consume: JSDoc for IDE hints, README for onboarding, architecture docs for decision-making."

- JSDoc provides inline IDE hints — highest daily value
- README.md provides module-level onboarding — highest new-developer value
- Architecture decision records (ADRs) provide why-not-just-X reasoning — highest long-term value

### 6. Keep Documentation Co-Located with Code
Documentation that drifts from the code it describes becomes actively harmful — it misleads.

> "The best documentation is in the source file, immediately before the code it describes. External docs drift. Inline docs are forced to stay close."

- Use `audit_diff` before commits to verify documentation was updated alongside code changes
- Track documentation debt with `task_create category="docs"` the same way you track code debt
- Use `generate_report type="documentation"` to measure coverage and set improvement targets

---

## Agent Loop: Doc Generator Steps

```
ANALYZE   → audit_file + get_context (understand structure and exports)
THINK     → prioritize: what needs docs most urgently?
SELECT    → choose doc level: JSDoc / inline comment / README / ADR
EXECUTE   → run_skill doc-generator to produce documentation scaffold
OBSERVE   → review generated docs for accuracy against actual behavior
ITERATE   → task_create for gaps, add @example sections, verify with find_references
```

---

## Key Quotes

> "Documentation is a love letter to your future self — and to every developer who comes after you."

> "The best time to write documentation is immediately after you understand the code. The second best time is before you forget you understood it."

> "If you need to read the implementation to understand what a function does, the documentation has already failed."

> "A function with a good name and no documentation is better than a function with a bad name and excellent documentation."

---

## 3-Strike Protocol

When doc generation produces inaccurate or incomplete documentation after three passes:

1. **Strike 1:** Use `commit_history_search` to find the original PR description — it often contains the design rationale that should be in the docs
2. **Strike 2:** Use `find_references` to observe actual usage patterns — if callers always pass the same combination of params, that pattern should be documented as the primary use case
3. **Strike 3:** Flag with `task_create category="docs"` for human-authored documentation — some business logic is too contextual for automated generation

> "When automated documentation fails three times, the code itself needs to be clearer. Refactor the names and structure so that documentation becomes less necessary."

---

## Documentation Coverage Targets

| Metric | Target | Tool |
|--------|--------|------|
| Public function JSDoc coverage | 100% | `generate_report type="documentation"` |
| @param documentation | 100% of params | `audit_file` |
| @returns documentation | 100% of non-void returns | `audit_file` |
| @throws documentation | 100% of documented throws | `search_code query="throw"` |
| @example coverage | 80% of public functions | `audit_file` |
| Module README existence | 100% of public modules | `search_code query="README"` |

# References: Test Generator — Manus Principles Applied

## The 6 Manus Principles for Test Generator

### 1. Read the Source Completely Before Writing Any Test
Tests written without full understanding of the source will miss the most important cases — the non-obvious ones.

> "Call `get_context` and `audit_file` on every file before generating tests. The complexity score tells you the minimum number of test cases required."

- Cyclomatic complexity N means at minimum N test paths to achieve branch coverage
- Read all error paths, null checks, and boundary conditions before writing a single `it()` block
- Understand what the function promises (its contract) before testing whether it keeps that promise

### 2. Test Behavior, Not Implementation
Tests that assert on internal state are fragile. Tests that assert on observable behavior survive refactoring.

> "Never test that a function called another function. Test that the system produced the correct output for a given input."

| Fragile Test | Robust Test |
|-------------|-------------|
| Assert `calculateTotal` called `applyDiscount` | Assert result equals expected price |
| Assert mock was called N times | Assert side effect happened (email sent, record created) |
| Assert internal state changed | Assert public interface reflects the change |

### 3. Cover Boundaries Exhaustively
Most bugs live at boundaries. The arithmetic average of a valid range is rarely buggy. The edges always are.

> "For every comparison operator in the source (`>`, `>=`, `===`, `<`, `<=`), write tests at: just below the boundary, exactly at the boundary, and just above the boundary."

- Use `search_code` with comparison operators to enumerate all boundaries systematically
- Test null, undefined, empty string, zero, negative numbers for all numeric/string parameters
- Test maximum values, minimum values, and overflow conditions

### 4. Test Every Error Path
Happy path tests are table stakes. The real value is in testing failure modes — because failures happen in production.

> "Use `search_code query='throw'` and `search_code query='return null'` to enumerate every error condition. Each one is a required test case."

- Every `throw new Error(...)` in source needs a test that triggers it
- Every early return (guard clause) in source needs a test that hits it
- Every try/catch block needs a test that forces the catch path

### 5. Make Tests Self-Documenting
A test that requires reading the source to understand is a bad test. Tests are the living documentation of expected behavior.

> "Test names should be complete sentences: `it('returns 0 when cart is empty')`, not `it('empty cart')`."

- Use describe blocks to group by scenario (not by method)
- Use it/test blocks to state the exact expected behavior
- Use `commit_history_search` to find historical bugs — those scenarios must have named tests

### 6. Generate Tests That Fail Before the Fix
A test generator that produces only passing tests on untested code is creating false confidence, not coverage.

> "Run generated tests immediately. If they all pass on untested code, the tests are not testing anything meaningful."

- A good generated test suite should initially fail on broken implementations
- Use `task_create` to track test gaps when auto-generation cannot infer enough context
- Re-run `generate_report type="coverage"` after implementing to confirm improvement

---

## Agent Loop: Test Generator Steps

```
ANALYZE   → audit_file + complexity_score (understand source structure and complexity)
THINK     → enumerate: happy paths, error paths, boundaries, null cases
SELECT    → choose test type: unit / integration / edge-case / property-based
EXECUTE   → run_skill test-generator to produce scaffolding
OBSERVE   → verify generated tests cover all identified paths
ITERATE   → task_create for gaps, add boundary tests manually for critical logic
```

---

## Key Quotes

> "The purpose of tests is not to prove code works. It is to document what 'works' means and alert you when it stops."

> "Complexity score is the minimum test count. Write more tests than the complexity number, not fewer."

> "Tests are the only documentation that cannot lie. Comments lie. Tests either pass or they don't."

> "Find the historical bugs with `commit_history_search`. Bugs that occurred once will occur again in the same place. Test those scenarios first."

---

## 3-Strike Protocol

When auto-generated tests do not reach acceptable coverage after three passes:

1. **Strike 1:** Use `commit_history_search` to find previous bug fixes in this file — every bug fix is an untested edge case
2. **Strike 2:** Use `audit_file` to enumerate all conditional branches manually, then write one test per branch
3. **Strike 3:** Use property-based testing — define invariants about the function's contract and generate random inputs to find counterexamples

> "If you cannot achieve coverage with three passes of test generation, the source code has too many responsibilities. Refactor first."

---

## Test Coverage Reference

| Coverage Type | What It Measures | Minimum Target |
|--------------|-----------------|----------------|
| Line coverage | Lines executed during tests | 80% |
| Branch coverage | Decision paths taken | 70% |
| Function coverage | Functions called during tests | 90% |
| Path coverage | Unique execution paths | Best-effort on critical modules |

### Edge Case Checklist (apply per function)

- [ ] Empty input (empty string, empty array, empty object)
- [ ] Null / undefined input
- [ ] Zero / negative numbers
- [ ] Maximum safe integer
- [ ] Single-element collection
- [ ] Exact boundary values (for all comparison operators)
- [ ] Concurrent execution (if async)
- [ ] All error paths (`throw` and early `return`)

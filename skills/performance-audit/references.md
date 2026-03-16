# References: Performance Audit — Manus Principles Applied

## The 6 Manus Principles for Performance Audit

### 1. Measure First — Never Optimize Blind
Performance optimization without measurement is guessing. Optimizing the wrong bottleneck is worse than not optimizing at all.

> "Run `health_score` and `complexity_score` before any performance work. The highest-complexity files are the most likely sources of performance problems."

- Identify the actual bottleneck before writing a line of optimization code
- Use `audit_file` to understand the algorithmic structure before assuming you know the problem
- Performance problems are almost always in 20% of the code — find that 20% first

### 2. Understand the Execution Context
A function that looks fast in isolation can be catastrophic inside a loop. Context is everything.

> "Use `find_references` to see where a function is called. If it is called inside a loop that runs 10,000 times, O(n) becomes O(n²)."

| Context | Performance Multiplier |
|---------|----------------------|
| Called once on startup | Low priority |
| Called per HTTP request | Medium priority |
| Called inside a loop | High priority |
| Called inside a nested loop | Critical priority |
| Called recursively | Extreme priority |

### 3. Classify the Problem Type Before Prescribing Solutions
Different performance problems require different solutions. Mis-classifying wastes effort.

| Problem Type | Signature | Solution Pattern |
|-------------|-----------|-----------------|
| N+1 queries | DB call inside a loop | Eager loading, DataLoader, batch queries |
| Memory leak | Growing memory over time | Listener cleanup, streaming, chunked processing |
| Expensive render | UI jank, high re-render count | Memoization, virtualization, lazy loading |
| Algorithmic complexity | Time grows with data size | Algorithm replacement, caching |
| Synchronous blocking | Event loop stalls | async/await, worker threads, queuing |
| Bundle size | Slow initial load | Code splitting, tree shaking, lazy imports |

### 4. Quantify the Impact Before Prioritizing
Not every performance issue is worth fixing. The expected improvement must justify the refactoring cost.

> "Use `find_references` to count how many times a slow function is called. Multiply by the per-call cost. That is the total impact."

- A 100ms optimization on a function called once per day saves 36.5 seconds per year
- The same optimization on a function called per request at 1000 req/s saves 36.5 hours per day
- Always estimate before committing: (call frequency) × (time saved per call) = total time saved

### 5. Fix Root Causes, Not Symptoms
Caching a slow query is a band-aid. Fixing the query is the cure.

> "Never `task_create` a caching task without first investigating whether the underlying operation can be made fast enough to not need caching."

- Premature caching introduces consistency bugs, invalidation complexity, and memory pressure
- An N+1 query cached is still N+1 database round trips initiated — fix the query structure
- Profile the hot path before adding infrastructure (CDN, cache layer, queue) to paper over it

### 6. Verify Improvements After Optimization
An optimization that was not measured after implementation may not have helped — or may have introduced regressions.

> "After every performance fix, run `generate_report type='performance'` on the same path. Compare before/after metrics."

- Re-run `complexity_score` after refactoring for performance — complexity and performance are correlated
- Confirm that the N+1 query count decreased by checking query logs or ORM instrumentation
- Use `audit_diff` before committing performance changes to catch unintended side effects

---

## Agent Loop: Performance Audit Steps

```
ANALYZE   → health_score + search_code (find loop patterns, async chains, ORM calls)
THINK     → classify problem type, estimate impact, identify root cause
SELECT    → choose audit tools per problem type: audit_file / find_references / complexity_score
EXECUTE   → run_skill performance-audit to get structured recommendations
OBSERVE   → prioritize findings by (frequency × severity)
ITERATE   → task_create per fix, apply smallest-impact fixes first, re-measure
```

---

## Key Quotes

> "The fastest code is code that runs once. The second fastest is code that runs efficiently. Never optimize code that should not run at all."

> "N+1 queries are not a performance problem — they are an architecture problem that manifests as performance degradation."

> "Memory leaks are not gradual — they are exponential. A 1MB leak per minute looks harmless until hour four when it takes down production."

> "Every `forEach` with an `await` inside it is a performance bug waiting to be discovered at scale."

---

## 3-Strike Protocol

When a performance audit finds no clear bottleneck after three passes:

1. **Strike 1:** Check async patterns — use `search_code query="await"` inside loop structures; sequential awaits in loops are the most commonly missed bottleneck
2. **Strike 2:** Escalate to `commit_history_search` — find when the performance regression was introduced, then diff what changed
3. **Strike 3:** Profile outside muctehid — attach a profiler (clinic.js for Node, React DevTools for frontend) to get a real execution flame graph

> "If static analysis misses the bottleneck three times, the problem is dynamic — it only appears under load. Move to runtime profiling."

---

## Performance Patterns Reference

### N+1 Query Signatures
```javascript
// Anti-pattern: DB call inside a loop
const users = await User.findAll();
for (const user of users) {
  user.orders = await Order.findAll({ where: { userId: user.id } }); // N+1!
}

// Fix: eager loading
const users = await User.findAll({ include: [Order] });
```

### Memory Leak Signatures
```javascript
// Anti-pattern: listener never removed
element.addEventListener('click', handler); // never removed = leak

// Anti-pattern: accumulating in loop without streaming
const results = [];
for (const batch of batches) {
  results.push(...await processBatch(batch)); // grows unbounded
}
```

### Render Performance Signatures
```javascript
// Anti-pattern: missing dependency array
useEffect(() => { fetchData(); }); // runs on every render!

// Anti-pattern: creating objects in render
const config = { color: 'red' }; // new object every render = re-renders children
```

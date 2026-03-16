# References: Git Archaeology and Context Compaction Techniques

These principles are adapted from the Manus AI agent design philosophy, applied specifically to historical code analysis. The central insight is that every line of code carries context that is not in the code itself: the commit that introduced it, the author's intent at that moment, the system constraints that shaped it, and the subsequent changes that transformed it. Recovering that context is an archaeological act — it requires primary sources, evidence standards, and honest acknowledgment of gaps.

---

## Principle 1: Git Blame Is a Map, Not an Accusation
> "Blame tells you who last touched a line and when. It does not tell you who is responsible for its quality."

The `git blame` command attributes each line to the most recent commit that modified it. This is a map of current ownership — not a timeline of the line's full history, and not an assignment of responsibility.

Key insights when reading blame output:

**The "original core" heuristic:** Lines written in the file's creation commit that have never been modified since are the original core. They survived all subsequent changes — either because they are correct and no one needed to touch them, or because no one dared to. Both cases are informative: correct originals are the design intent made permanent; untouched-but-risky originals are the most dangerous lines in the file.

**High-churn zones:** Lines with many distinct recent authors and commit hashes are contested territory. High churn signals unclear ownership, repeated fixes to the same logic, or a function that multiple people have tried to improve. High-churn + high complexity = the highest-risk area of the codebase.

**Recency bias:** The most recent commit wins in blame output. If a line was written by Alice in 2019 and reformatted (no logic change) by Bob in 2024, blame shows Bob. Always check the commit message: if the recent commit was formatting or style only, the logical author is the original creator.

---

## Principle 2: Commit Messages as Archaeological Artifacts
> "A commit message is the closest thing to the author's spoken rationale at a point in time."

Commit messages vary enormously in quality. Reading them archaeologically means extracting every available signal, even from poor messages:

**Categorize every commit by type:**
- `feat:` / `add` — a new capability was needed
- `fix:` / `bug:` / `hotfix:` — something was broken in production or testing
- `refactor:` — the code worked but the structure was improved
- `perf:` / `optimize:` — a performance concern drove the change (often where security debt enters)
- `chore:` / `style:` / `format:` — non-logical change (safe to treat as metadata-only)
- Compliance references ("GDPR", "SOC2", "audit") — explain why security-heavy or unusual logic exists
- "WIP", "temp", "quick fix", "hack" — the author knew this was not a proper solution

**Pattern recognition across commit clusters:**
- Multiple `fix:` commits on the same function in a short period = something was fundamentally wrong with the original approach
- `hotfix:` commits = production incidents; the fix was likely rushed under pressure
- `perf:` commits following `fix:` commits = performance was traded against correctness (this is where SQL injection often enters)
- A single commit with a large line count and a vague message = emergency change with minimal review

---

## Principle 3: Context Reduction Through Compaction — The Archaeological Report as a Summary
> "An archaeological report compacts git history into a decision-ready summary. Its value is proportional to its evidence density."

Git history for a file can span hundreds of commits over years. The archaeological report compacts this into a structured, decision-ready summary. The quality of this compaction determines the report's usefulness.

The compaction process:
1. **Filter:** Remove formatting commits, no-logic changes, and dependency bumps from the timeline. These are noise.
2. **Cluster:** Group remaining commits by type (feature additions, bug fixes, refactors, hotfixes) and identify patterns.
3. **Extract:** From each cluster, extract the key decision: what changed, why (from the commit message), and what it implies about the original design.
4. **Synthesize:** Combine the timeline into a narrative: Origin → Evolution → Current State.

The report is only as dense as the evidence supports. If 80% of commits are "minor fix" with no elaboration, the report says so. The act of compaction must not fill gaps with inference presented as fact.

---

## Principle 4: Three-Layer Semantic Context — What search_code Reveals
> "A file's purpose is defined by what it serves, not just what it contains."

`search_code` and `find_references` reveal three layers of semantic context that the file itself cannot contain:

**Layer 1 — Direct callers (import + call):**
Files that import the module and call its exported functions. These are the primary consumers. They define what the module is actually used for in practice — which may differ significantly from its stated purpose. A module called `AuthService` that is only imported by `AdminDashboard` is effectively an "AdminDashboard helper" regardless of its name.

**Layer 2 — Type references:**
Files that import types, interfaces, or enums from the module without calling its functions. These are structural dependencies — they need the module's type definitions but not its runtime behavior. Changing a type signature breaks these even when runtime logic is unchanged.

**Layer 3 — String references (dynamic imports, config, docs):**
Files that reference the module's name or path as a string — in dynamic `require()` calls, webpack configs, barrel import maps, README files, or documentation. These are invisible to typed import search and are the most common source of "I thought it was safe to rename/delete" regressions.

An archaeological analysis must search all three layers before declaring code unreferenced. A finding of "0 import references" is incomplete without a corresponding "0 string references across 3 search strategies."

---

## Principle 5: Evidence vs. Inference — The Archaeological Standard
> "A report says what the evidence shows. When evidence is absent, the report says so."

The difference between an archaeological report and an opinion:

| Opinion | Archaeological Standard |
|---------|------------------------|
| "This code was probably written quickly" | "Commit hotfix/auth-bypass (d8f3c21) contains 200 lines, message 'emergency fix', no ticket reference" |
| "The developer didn't understand security" | "No security review marker appears in any commit on this file prior to 2023" |
| "This function is a mess" | "validateSession grew from CC=3 (2022-01-14) to CC=14 (2024-01-22) across 6 commits" |
| "This can probably be deleted" | "0 import references across 3 search strategies; last commit: 'to be removed after v1 shutdown'" |

When evidence is absent or ambiguous, label the inference explicitly: `[Inferred from context: ...]` or `[No commit rationale available for this decision]`. An incomplete report that is honest about its gaps is more valuable than a complete report that fills gaps with speculation.

---

## Principle 6: Complexity as a Complexity Accumulation Detector
> "A function that was simple and is now complex accumulated debt. One that was always complex may be intentionally so."

Cross-referencing `complexity_score` against the commit timeline reveals the accumulation pattern:

**Organic growth (intentional complexity):**
- File created with CC=8–12; grows slowly with feature additions; commit messages explain each branch
- Assessment: complexity is domain-inherent; refactor only if there is a concrete pain point

**Debt accumulation (unintentional complexity):**
- File created with CC=2–4; complexity grows in bursts after `fix:` and `hotfix:` commits
- Each fix adds a conditional branch without reconsidering the overall structure
- Assessment: technical debt — the original design did not anticipate the full problem space

**Decay (complexity from neglect):**
- File was refactored to low complexity at some point, then gradually re-grew
- The refactor commit is visible in history; subsequent additions re-accumulated debt
- Assessment: the refactor addressed symptoms, not the root cause; a deeper redesign is needed

The distinction between these three patterns changes the recommendation entirely. Organic complexity warrants documentation. Debt accumulation warrants refactoring. Decay warrants a design review.

---

## The Agent Loop in code-archaeologist Context

```
ANALYZE  → git_blame_context: who owns each line? what is the original core?
THINK    → commit_history_search: what does the timeline reveal about intent?
SELECT   → search_code + find_references: what does this code serve?
EXECUTE  → complexity_score + research_topic: how did complexity evolve? is the pattern standard?
OBSERVE  → After every 2 research ops, flush findings to a structured report section
ITERATE  → Compile Origin → Evolution → Current State → Recommendation
           Every claim must cite a specific commit hash, blame line, or search result
```

The loop's non-negotiable invariant: every recommendation must be supported by at least two pieces of evidence from separate sources. A recommendation supported by a single commit message is an opinion. A recommendation supported by a commit message and a semantic search result is an evidence-backed conclusion.

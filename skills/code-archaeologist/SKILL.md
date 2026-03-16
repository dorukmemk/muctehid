---
name: code-archaeologist
description: Produces a deep historical analysis of a file or module by combining git blame (who), commit history (when/why), and semantic search (what it interacts with). Use when asked why code exists, who wrote it, when a bug was introduced, or whether legacy code is safe to delete.
license: MIT
---

# Code Archaeologist

Every line of code has a reason. The reason might be documented in a commit message, embedded in a bug report reference, recoverable from the author's context, or — occasionally — lost to history. This skill treats the git history as a primary source, not a secondary reference. Git blame tells you who last touched each line. Commit history tells you the story of why it changed. Semantic search tells you what the code serves. Complexity trends tell you whether it grew intentionally or accumulated. The output is an archaeological report: a reconstruction of origin, evolution, current state, and a recommendation grounded in evidence — not opinion.

## Core Principle

```
git_blame_context    = Who touched this? When? Which lines are "original core"?
         +
commit_history_search = What was the intent? What changed over time? Why?
         +
search_code          = What depends on this? What does it serve?
         +
complexity_score     = Did it grow clean or accumulate debt?
         ↓
Archaeological Report: Origin → Evolution → Current State → Recommendation
         ↓
Every claim backed by git evidence — no assumptions, no speculation
```

## Quick Start

- Start with `git_blame_context` to get the "who/when" layer
- Follow with `commit_history_search` to build the chronological timeline
- Use `search_code` to map all files that depend on the target (callers, importers)
- Use `complexity_score` to cross-reference complexity growth against the timeline

## File Purposes

| Output Section | Sources Used | Key Question |
|---------------|-------------|-------------|
| Origin | git_blame (oldest commit), commit_history (creation commit) | When did this appear and what was the stated intent? |
| Evolution Timeline | commit_history_search (all commits) | How did it change and why? |
| Key Decisions | commit messages, research_topic | What architectural choices were made and what drove them? |
| Current State | complexity_score, search_code | What does it actually do today vs. its original purpose? |
| Recommendations | All of the above | Keep, refactor, or rewrite — and why? |

## Critical Rules

### 1. Evidence First, Always
Every claim in the archaeological report must cite its source: a commit hash, a blame entry, a search result. "This code appears to be..." is not acceptable. "According to commit a3f2b9 (2023-04-12): 'add session validation for GDPR compliance'..." is acceptable. If the evidence doesn't exist, say so — "no commit message provides rationale for this decision."

### 2. Git Blame + Commit History Must Both Run
`git_blame_context` gives the line-level view (who last touched what). `commit_history_search` gives the file-level view (what the commits say). Neither alone is sufficient. Blame without history shows current ownership but misses the "why it changed." History without blame misses the "what exactly is this line doing and who owns it." Both must run.

### 3. Identify the Original Core
From the blame output, identify lines that have never been modified since the file was created (single author, oldest commit date). These are the "original core" — the surviving intent of the original author. They are the most reliable evidence of the original design. Code that has never been touched despite surrounding changes is either: (a) still perfectly correct, or (b) no one has dared to change it.

### 4. Complexity Trend Is Evidence of Accumulation
Cross-reference the complexity_score results against the commit timeline. A function that was CC=3 at creation and is now CC=14 accumulated debt over time — this is identifiable from the commits that added branches. A function that was CC=12 from the start was built complex intentionally (possibly because the domain requires it). These are two very different situations with very different recommendations.

### 5. Never Make Assumptions About Intent
If a commit message says "fix bug" without elaboration, the report says "bug fix (no elaboration in commit message)." Do not infer that "it was probably a null pointer issue" without evidence. Archaeological reports must distinguish between evidence and inference. When inferring, label it: "[Inferred from context]". When stating fact, cite the source.

### 6. The Recommendation Must Be Earned
The final recommendation (Keep / Refactor / Rewrite) must be supported by at least two pieces of evidence from the analysis. "Refactor" because complexity grew significantly (evidence: CC 3→14 over 8 commits) AND because the original design predates the current framework (evidence: commit a3f2b9, 2019). One-sentence recommendations with no backing are not archaeological — they are opinions.

## The 3-Strike Error Protocol

```
ATTEMPT 1: Run git_blame_context on the target file.
           If the file has no git history (untracked or new): note this and proceed with what's available.

ATTEMPT 2: If commit_history_search returns no results for the filename:
           Try searching by class name, function name, or module identifier.
           The file may have been renamed — search for the content, not the path.

ATTEMPT 3: If semantic search (search_code) returns no dependents:
           Search for the class name, module name, and exported function names separately.
           Dynamic imports and string references won't appear in a typed import search.

AFTER 3 FAILURES per step: Document what was attempted and what was not found.
  "INCOMPLETE: git history not available for this file. The following sections are based on
   static analysis only: [list]. The following sections cannot be completed: [list]."
  Produce a partial report rather than no report.
```

## When to Use This Skill

**Use for:**
- "Why does this code exist?"
- "Who wrote this and when?"
- "When was this security bug introduced?"
- "Is this legacy code safe to delete?"
- "What was the original intent of this module?"
- "Why is this function so complex?"
- Understanding code before a major refactor
- Investigating a regression to find its origin commit

**Skip for:**
- Active bugs that need immediate fixing (use `auto-fixer`)
- Impact analysis before a change (use `impact-analyzer`)
- Simple questions answerable by reading the code (just read it)
- Files with no git history (brand new code has no archaeology to do)

## Anti-Patterns

| Don't | Do Instead |
|-------|------------|
| Infer intent without citing evidence | Every claim needs a commit hash, blame line, or search result |
| Run only git_blame without commit history | Always run both — they answer different questions |
| Skip the semantic search | Callers reveal the purpose; a module with no callers is likely safe to delete |
| Report complexity without timeline context | CC=14 means different things if it was always 14 vs. grew from 2 |
| Give a recommendation without two evidence sources | Earn the recommendation — cite specific commits, specific findings |
| Assume a commit message explains the full context | Commit messages are often incomplete; research_topic provides the industry context |
| Declare code "safe to delete" without checking all reference types | Dynamic imports and config references won't appear in typed import search |

---

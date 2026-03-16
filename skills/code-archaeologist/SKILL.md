---
name: code-archaeologist
version: 1.0.0
description: Deep historical analysis of a file or module. Uses git blame, commit history search, and semantic search to answer "why does this code exist?", "who wrote this and when?", "what was the original intent?". Produces an archaeological report with timeline, key decisions, and current state assessment.
category: quality
autoTrigger:
  - "why does this exist"
  - "history of"
  - "who wrote"
  - "when was this added"
  - "understand the legacy"
  - "archaeological"
  - "origin of"
  - "why is this code here"
requiredTools:
  - git_blame_context
  - commit_history_search
  - search_code
  - research_topic
  - complexity_score
outputFormat: markdown
estimatedMinutes: 4
---

# Code Archaeologist

## Purpose
Produce a deep historical analysis of a target file or module. Answer the three fundamental legacy questions: why does this code exist, who wrote it and when, and what was the original intent versus what it has become. The output is an archaeological report with a chronological timeline, key decision trace, and current state assessment.

## Steps

### 1. Blame Analysis
Call `git_blame_context` on the target file. Extract:
- Top 3 contributors by line count
- The oldest commit hash and date visible in blame
- Functions or blocks with the most distinct authors (high churn signals contested or unclear ownership)
- Lines that have never been modified since the file was created (the "original core")

### 2. Commit Timeline
Call `commit_history_search` using the filename and any known module/class names as search terms. Build a chronological timeline:

```
{date} {hash} {author} — {commit message}
  Changed: {what changed in this file}
```

Sort oldest-first. Identify the following milestone commits:
- **Creation** — when the file first appeared
- **Major refactors** — commits that changed more than 30% of the file
- **Bug fixes** — commits with "fix", "bug", "hotfix" in the message
- **Feature additions** — commits that added new public functions or classes

### 3. Semantic Context
Call `search_code` to find all other files that reference the target module. This reveals:
- What depends on this code (callers, importers)
- What this code was designed to serve
- Whether it grew beyond its original scope

Search for the main class name, exported function names, and the file path itself (for dynamic imports or config references).

### 4. Architecture Research
Call `research_topic` with the module name and its apparent domain (e.g., "authentication middleware", "payment processor"). Use this to:
- Understand the pattern or standard the code was likely implementing
- Identify if the original implementation followed a known approach that has since drifted
- Surface any industry context that explains design decisions

### 5. Complexity Assessment
Call `complexity_score` on the target file. Compare per-function complexity against the commit timeline to identify:
- Which functions were simple at creation and grew complex over time (accumulated debt)
- Which functions were complex from the start (intentional or rushed original design)
- Functions with complexity > 10 that also have high blame-author turnover (danger zones)

### 6. Archaeological Report
Produce the final report in this structure:

```
## Archaeological Report: {file path}

### Origin
- **Created:** {date} by {author}
- **First commit:** {hash} — "{message}"
- **Original purpose:** {inferred from first commit and initial code structure}
- **Original size:** {line count at creation} lines

### Evolution Timeline
| Date | Author | Change Type | Summary |
|------|--------|-------------|---------|
| {date} | {author} | Creation | {summary} |
| {date} | {author} | Feature | {summary} |
| {date} | {author} | Refactor | {summary} |
| {date} | {author} | Bug Fix | {summary} |

### Key Decisions
- **{date}:** {decision} — Rationale: {inferred or stated rationale}

### Current State
- **Complexity score:** {score} (target: < 10 per function)
- **Top contributors:** {name} ({N} lines), {name} ({M} lines)
- **Highest-complexity function:** {name} (CC: {score})
- **Current purpose:** {what the code actually does today}
- **Scope drift:** {yes/no — original purpose vs. current responsibilities}

### Technical Debt
- {Specific debt item}: accumulated because {reason from history}

### Recommendations
| Assessment | Rationale |
|------------|-----------|
| Keep as-is / Refactor / Rewrite | {specific reasoning based on history and current state} |

**If Refactor:** Focus on {specific functions} — complexity grew without corresponding test coverage.
**If Rewrite:** Original design predates {context}; a clean implementation would be {N}% simpler.
```

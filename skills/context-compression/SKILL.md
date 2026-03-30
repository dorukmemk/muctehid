---
name: context-compression
version: 2.0.0
description: >-
  Compresses long-running session context using Anchored Iterative Summarization — preserving
  session intent, file modifications, decisions, and next steps while achieving 70-99% token reduction.
  Produces structured summaries that serve as implicit checklists. Use when: (1) context window
  is at 70-80% utilization, (2) session has been running for many turns, (3) planning to start
  a new session continuing prior work, (4) "compress session", "summarize context", "context too long" mentioned.
author: muctehid-mcp
category: performance
type: prompt
license: MIT
triggers:
  - "compress session"
  - "summarize context"
  - "context too long"
  - "start fresh"
  - "session summary"
  - "oturum özeti"
  - "bağlamı sıkıştır"
tools:
  - run_command
  - search_code
parameters:
  mode:
    type: string
    description: "Compression mode: anchored (default) | full | minimal"
    default: "anchored"
  output_path:
    type: string
    description: "Where to write the compressed summary (default: .plan/session_summary.md)"
    default: ".plan/session_summary.md"
output:
  format: markdown
---

# Context Compression Specialist

Sessions accumulate. Tool outputs, reasoning chains, intermediate results — all pile up until the context window is 90% full and quality starts to degrade. This skill compresses accumulated session context into a structured, dense summary that captures everything important while discarding everything redundant.

## Core Principle

```
Optimization target = tokens-per-TASK (start to finish)
                   ≠ tokens-per-REQUEST

Aggressive compression that loses critical details forces re-fetching.
Re-fetching = more tokens, not fewer.
Compress strategically. Never destructively.
```

## Quick Start

```
1. Run: python skills/context-compression/scripts/compress_session.py {session_file_or_dir}
2. Review the generated structured summary
3. Validate: probe 3 critical facts to verify they survived compression
4. Write compressed summary to .plan/session_summary.md
5. Start new context window with only the summary loaded
```

## The Three Compression Methods

| Method | Token Reduction | Quality Retention | When to Use |
|--------|----------------|-------------------|-------------|
| **Anchored Iterative** | 70-90% | Excellent | Standard sessions |
| **Regenerative Full** | 85-95% | Good | Starting fresh |
| **Opaque** | 99%+ | Poor (unverifiable) | Never recommended |

**Always use Anchored Iterative.** The other methods exist for reference only.

## Critical Rules

### 1. Trigger at 70-80% — Not 90%
```
< 70%: No action needed
70-80%: Compression recommended
80-90%: Compression required
> 90%: Quality already degraded — compress AND review last 5 turns for drift
```

### 2. Artifact Trail Integrity Is the Weakest Dimension
The #1 failure mode in context compression: losing track of which files were created, modified, or read. This scores 2.2-2.5/5.0 in independent evaluations — it is the hardest thing to preserve.

**Fix:** The summary MUST have a dedicated "Files Modified" section that lists every file touched, with what changed. This section is non-negotiable.

### 3. Structured Sections = Implicit Checklists
The compression template uses sections that double as checklists:
- If "Files Modified" is empty → verify nothing was changed (or that changes weren't tracked)
- If "Open Questions" is non-empty → these must be resolved before marking the task done
- If "Decisions Made" has items → they inform all future implementation choices

### 4. Probe-Based Quality Validation
After compression, verify quality by probing:
1. Ask: "What files were modified in this session?"
2. Ask: "What was the primary goal?"
3. Ask: "What's the next step?"

If any probe returns an incorrect or missing answer → the compression was lossy. Restore and try again.

### 5. Never Compress the System Prompt
The system prompt (CLAUDE.md / AGENTS.md) is not part of the session — it is configuration. Never include it in compression. It reloads independently.

### 6. Incremental Updates Beat Full Regeneration
```
❌ Regenerate full summary every 10 turns (loses incremental detail)
✅ Append new content to existing sections every 2-3 turns (preserves history)
```

Use the `anchored` mode: load the existing summary, append new sections, merge rather than replace.

## The Compression Template

```markdown
---
compressed_at: {timestamp}
turns_compressed: {N}
tokens_before: ~{estimate}
tokens_after: ~{estimate}
compression_ratio: {ratio}
---

## Session Intent
[One sentence: what is being accomplished in this session]

## Files Modified
| File | Change | Status |
|------|--------|--------|
| src/auth/middleware.ts | Added JWT validation | ✅ Complete |
| src/api/routes.ts | Updated POST /login handler | 🔄 In Progress |

## Files Read (Not Modified)
- src/types/index.ts — read for type reference
- package.json — verified dependencies

## Decisions Made
- **{Decision}**: {Rationale} [Session turn {N}]
- **{Decision}**: {Rationale} [Session turn {N}]

## Issues Encountered & Resolved
- **{Issue}**: {Root cause} → {How fixed}

## Current State
- Completed: {list what is done}
- In Progress: {list what is partially done}
- Blocked: {list any blockers with context}

## Next Steps (Ordered)
1. {Concrete next action}
2. {Following action}
3. {After that}

## Open Questions
- {Unresolved question that must carry forward}
- {Pending decision or external dependency}

## Key Context (Do Not Lose)
- {Critical fact 1 that future sessions must know}
- {Critical fact 2}
```

## Process Workflow

### Phase 1: Assess
Run the compression script to analyze current session size:
```bash
python skills/context-compression/scripts/compress_session.py {path} --analyze-only
```

### Phase 2: Compress
Generate the structured summary using the template above. For each section:
- **Session Intent**: One sentence maximum. The goal, not the method.
- **Files Modified**: Every file touched, with a 5-word description of the change.
- **Decisions Made**: Only decisions that constrain future work.
- **Current State**: What is actually done vs. what is in progress.
- **Next Steps**: Ordered list of concrete actions.

### Phase 3: Validate
Probe the compressed summary with 3 questions about critical facts. If any fail → add the missing fact explicitly.

### Phase 4: Write
```bash
python skills/context-compression/scripts/compress_session.py {path} --output .plan/session_summary.md
```

### Phase 5: Load in New Context
When resuming in a new session, load ONLY:
1. The system prompt (CLAUDE.md)
2. The session summary (.plan/session_summary.md)
3. The specific file(s) needed for the next step

Do not re-load the full conversation history.

## Anti-Patterns

| Don't | Do Instead |
|-------|------------|
| Wait until 90% utilization | Compress at 70-80% |
| Use opaque compression (99% reduction but unverifiable) | Use Anchored Iterative — sacrifice 10% compression for verifiability |
| Regenerate full summary each time | Append incrementally to preserve granular history |
| Omit file modification tracking | Files Modified section is mandatory — it's the most critical section |
| Compress without probe validation | Always probe 3 facts after compression to verify quality |
| Include system prompt in compression | System prompt is config, not session state |

## Available Scripts

- `compress_session.py`: Analyzes session files (.plan/ directory, conversation logs), generates compression candidates, and writes structured summary

---

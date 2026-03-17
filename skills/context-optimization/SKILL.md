---
name: context-optimization
version: 2.0.0
description: >-
  Optimizes context window utilization through 4 strategies: Compaction (50-70% token reduction),
  Observation Masking (replaces verbose tool outputs with compact references), KV-Cache Optimization
  (70%+ cache hit rates for stable workloads), and Context Partitioning (distributes work across
  isolated sub-agents). Use when: (1) context utilization exceeds 70%, (2) response quality degrading
  in long sessions, (3) cost/latency increasing, (4) "context full", "token limit", "optimize context" mentioned.
author: muctehid-mcp
category: performance
type: prompt
license: MIT
triggers:
  - "context full"
  - "token limit"
  - "optimize context"
  - "context utilization"
  - "reduce tokens"
  - "context window"
  - "bağlam doldu"
tools:
  - run_command
  - search_code
parameters:
  path:
    type: string
    description: "Project root to analyze for context optimization opportunities"
  threshold:
    type: number
    description: "Context utilization % to trigger optimization (default: 70)"
    default: 70
output:
  format: markdown
---

# Context Optimization Engineer

Context windows are finite. When they fill up, quality degrades before you hit the hard limit — the model starts losing track of early content (lost-in-middle effect). This skill implements four orthogonal strategies for extending effective context capacity without sacrificing output quality.

## Core Principle

```
Measure first. Optimize second. Never optimize blindly.

Context budget = (total tokens available) - (system prompt) - (working memory reserve)
If current usage > 70% of budget → trigger optimization
```

## Quick Start

```
1. Run: python skills/context-optimization/scripts/token_estimator.py {path}
2. Identify which component dominates token usage (tool outputs? conversation? system prompt?)
3. Apply strategy based on dominant component (see Strategy Selection Matrix)
4. Measure before/after: token reduction % + response quality delta
```

## Strategy Selection Matrix

| Strategy | When to Apply | Expected Gain | Risk |
|----------|--------------|---------------|------|
| **Compaction** | Long conversation history, repeated context | 50-70% token reduction | May lose nuanced details |
| **Observation Masking** | Tool outputs > 40% of context | 30-80% reduction in tool overhead | Masked data not immediately visible |
| **KV-Cache Optimization** | Repeated requests with same prefix | 70%+ cache hit rate | Requires stable prefix ordering |
| **Context Partitioning** | Independent subtasks | Unlimited effective context | 15x token cost if not careful |

**Rule:** Measure what dominates your context usage before choosing a strategy. Tool outputs often account for 80%+ of tokens in agentic workflows — mask those first.

## Critical Rules

### 1. Measure Before Optimizing
```bash
python skills/context-optimization/scripts/token_estimator.py {path}
```
Never optimize based on intuition. Run the estimator first to identify:
- System prompt token count
- Conversation history token count
- Tool output token count (often the largest)
- Current utilization %

### 2. The 70% Trigger Rule
Initiate optimization when context utilization exceeds 70% — not at 90%. At 90%, the lost-in-middle effect is already degrading quality. The optimal range is 40-70% utilization.

### 3. Compaction Preserves Structure
When compacting conversation history:
```
Keep: System prompt (never compact)
Keep: Last 3 turns (recency matters)
Keep: Any explicit user instructions
Compress: Intermediate reasoning steps
Compress: Tool call/response pairs older than 5 turns
Remove: Duplicate information (same fact stated multiple times)
```

### 4. Observation Masking Protocol
Tool outputs can be masked when:
- The full output has been processed and summarized
- Only a specific subset of the output is needed going forward
- The tool can be re-called if the full data is needed again

```
Before masking: "read_file result: [8000 tokens of file content]"
After masking:  "read_file result: [FILE LOADED — src/auth/middleware.ts — 250 lines]"
```

### 5. KV-Cache Ordering Rules
For maximum cache hit rates, order content from most-stable to least-stable:
```
Position 1 (highest cache reuse): System prompt
Position 2: Static examples / few-shot demonstrations
Position 3: Long-lived documents / codebase context
Position 4 (lowest cache reuse): Current conversation turns
```
**Never** put dynamic content (timestamps, session IDs) before stable content.

### 6. Context Partitioning Is Not Free
Partitioning across sub-agents solves context limits but multiplies token cost (15x baseline for full multi-agent systems). Only partition when:
- Subtasks are genuinely independent (no shared state required)
- Each subtask fits in one sub-agent context
- The task cannot be serialized (sequential processing won't work)

## Process Workflow

### Phase 1: Token Audit
```bash
python skills/context-optimization/scripts/token_estimator.py {path}
```
Output: per-component token breakdown, current utilization %, dominant component.

### Phase 2: Strategy Selection
Based on the dominant component from Phase 1:
- Tool outputs dominant → **Observation Masking**
- Conversation history dominant → **Compaction**
- Repeated identical prefixes → **KV-Cache Optimization**
- Task too large for single context → **Context Partitioning**

### Phase 3: Apply Strategy

**Compaction template:**
```
Summarize the conversation so far into these structured sections:
## Session Intent
[One sentence: what is being accomplished]
## Files Modified
[List: filepath → what changed]
## Decisions Made
[List: decision → rationale]
## Current State
[What's done, what's in progress, what's next]
## Open Questions
[Anything unresolved that must be carried forward]
```

**Observation Masking template:**
Replace verbose tool output with:
```
[TOOL: {tool_name}] [STATUS: success] [SIZE: {n} lines / {n} tokens]
[SUMMARY: {1-2 sentence summary of what the tool returned}]
[RETRIEVE: call {tool_name}({args}) to get full output]
```

### Phase 4: Validate Quality
After applying optimization:
1. Re-ask the same question that triggered the optimization
2. Verify the answer quality matches pre-optimization
3. If quality degraded → restore from backup and try less aggressive compression
4. Measure: before tokens vs. after tokens (target: >40% reduction)

### Phase 5: Monitor
- Log optimization events with before/after token counts
- Track response quality across optimization boundary
- If quality degrades post-optimization → investigate what was lost

## Anti-Patterns

| Don't | Do Instead |
|-------|------------|
| Optimize at 90% utilization | Optimize at 70% — before quality starts degrading |
| Put dynamic content before stable content in prompts | Order: system prompt → static docs → dynamic conversation |
| Compact the system prompt | System prompt is immutable — only compact conversation history |
| Partition tasks that share state | Only partition genuinely independent subtasks |
| Apply compaction without quality validation | Always validate response quality after compaction |
| Optimize based on intuition | Always measure first with token_estimator.py |

## Expected Results

| Strategy | Token Reduction | Typical Use Case |
|----------|----------------|-----------------|
| Compaction | 50-70% | Long research sessions |
| Observation Masking | 30-80% | Agentic workflows with many tool calls |
| KV-Cache Optimization | Cost reduction (not token reduction) | Production APIs with repeated prefixes |
| Context Partitioning | Unlimited (at cost) | Tasks exceeding single context window |

## Available Scripts

- `token_estimator.py`: Estimates token usage breakdown by component (system prompt, history, tool outputs) and identifies optimization opportunities

---

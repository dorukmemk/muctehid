---
name: context-degradation
version: 2.0.0
description: >-
  Detects and mitigates 5 context degradation patterns: Lost-in-Middle (10-40% recall drop for
  middle content), Context Poisoning (errors compounding), Context Distraction (irrelevant noise),
  Context Confusion (contradictory guidance), and Context Clash. Applies the 4-bucket mitigation
  framework: Write → Select → Compress → Isolate. Use when: (1) agent gives inconsistent answers
  in long sessions, (2) early context seems forgotten, (3) "degradation", "losing context",
  "forgetting", "inconsistent answers", "context health" are mentioned.
author: muctehid-mcp
category: performance
type: prompt
license: MIT
triggers:
  - "losing context"
  - "forgetting"
  - "inconsistent answers"
  - "context health"
  - "degradation"
  - "lost in middle"
  - "bağlam bozulması"
  - "unutuyor"
tools:
  - run_command
  - search_code
parameters:
  path:
    type: string
    description: "Session or project directory to analyze for degradation"
  context_size:
    type: number
    description: "Current context token count (for degradation threshold calculation)"
output:
  format: markdown
---

# Context Degradation Analyst

Context windows degrade before they fill. At 8,000-16,000 tokens, many models begin showing measurable performance drops — even models claiming 200k context windows. Only 50% of models claiming 32k+ context maintain satisfactory performance at their claimed limit. This skill diagnoses which degradation pattern is active and applies targeted mitigations.

## Core Principle

```
Larger context window ≠ uniform performance across that window

Performance degradation typically begins at:
  • 8,000-16,000 tokens: First signs for many models
  • 32,000+ tokens: Significant degradation for 50% of "32k" models
  • 64,000+ tokens: Severe degradation without mitigation strategies

Mitigation is architectural, not cosmetic.
```

## Quick Start

```
1. Run: python skills/context-degradation/scripts/degradation_check.py {path} --context-size {N}
2. Identify which degradation pattern(s) are active (see Pattern Diagnosis Matrix)
3. Apply targeted mitigation from the 4-Bucket Framework
4. Re-probe to verify improvement
```

## The 5 Degradation Patterns

### Pattern 1: Lost-in-Middle Effect
**What happens:** Information in the middle of a long context receives 10-40% lower recall than information at the start or end. This is well-documented across all major models.

**Symptoms:**
- Agent correctly recalls things mentioned recently or at the very start
- Agent misses or contradicts instructions given in the middle of the session
- Quality varies unpredictably across a long task

**Mitigation:**
```
Position critical information at START or END — never in the middle.
Repeat critical constraints every 20-30 turns.
Use structured headers to make middle content "findable."
```

### Pattern 2: Context Poisoning
**What happens:** An error, incorrect assumption, or hallucination gets incorporated into subsequent reasoning. Each turn that references the poisoned fact compounds the error.

**Symptoms:**
- Agent makes the same incorrect assumption repeatedly
- Corrections in one turn are "forgotten" two turns later
- Factual errors compound rather than resolve

**Mitigation:**
```
When a correction is made: explicitly overwrite the poisoned fact.
Use CORRECTION: markers: "CORRECTION: [fact X is wrong]. [Correct fact Y]."
If poisoning is severe: compress session, dropping the poisoned turns.
```

### Pattern 3: Context Distraction
**What happens:** Irrelevant context competes for model attention, reducing focus on what matters. The signal-to-noise ratio degrades as context grows.

**Symptoms:**
- Agent considers irrelevant previous topics when answering new questions
- Tool outputs from earlier tasks influence current task inappropriately
- Response quality improves when you ask the same question in a fresh context

**Mitigation:**
```
Apply Observation Masking to completed tool outputs.
Remove or compress completed task context before starting new tasks.
Use context partitioning: isolated sub-contexts for unrelated tasks.
```

### Pattern 4: Context Confusion
**What happens:** The model encounters multiple, potentially contradictory instructions or facts and becomes uncertain which applies. This manifests as hedging, inconsistency, or arbitrary selection.

**Symptoms:**
- Agent produces inconsistent behavior that varies turn-to-turn
- Agent hedges with "it depends" when the context should be clear
- Agent asks clarifying questions that were already answered

**Mitigation:**
```
Identify and remove contradictory instructions.
Use a single authoritative source for each type of fact.
When rules conflict: add explicit priority ordering.
```

### Pattern 5: Context Clash
**What happens:** Two or more explicit instructions directly contradict each other. Unlike confusion (ambiguity), this is a hard conflict between stated rules.

**Symptoms:**
- Agent behavior flips based on which instruction appears closest to the query
- Explicit instructions are being violated
- System prompt conflicts with user instructions

**Mitigation:**
```
Audit for instruction conflicts using the degradation_check.py script.
Establish explicit precedence: "Rule A overrides Rule B when..."
Remove or reconcile conflicting rules at their source.
```

## The 4-Bucket Mitigation Framework

For any degradation pattern, apply mitigations from these four buckets:

| Bucket | Action | Best For |
|--------|--------|----------|
| **Write** | Store context externally (.plan files, DB) | Lost-in-Middle, long sessions |
| **Select** | Filter to only relevant context | Distraction, large accumulated state |
| **Compress** | Summarize accumulated turns | All patterns in long sessions |
| **Isolate** | Sub-agent per task, clean context | Severe poisoning, clashing contexts |

Apply in order: Write → Select → Compress → Isolate (increasing cost/complexity).

## Degradation Thresholds by Model

| Model | First Degradation | Significant Degradation | Critical |
|-------|------------------|------------------------|---------|
| Claude Sonnet/Opus 4 | ~30k tokens | ~80k tokens | ~150k tokens |
| Claude Haiku 4 | ~20k tokens | ~50k tokens | ~100k tokens |
| GPT-4o | ~20k tokens | ~60k tokens | ~110k tokens |
| GPT-3.5 | ~8k tokens | ~14k tokens | ~16k tokens |

*These are approximate empirical thresholds — actual degradation varies by task type.*

## Process Workflow

### Phase 1: Diagnose
```bash
python skills/context-degradation/scripts/degradation_check.py {path} --context-size {N}
```
Output: Which patterns are likely active based on context size and session structure.

### Phase 2: Pattern-Specific Mitigation

**For Lost-in-Middle:**
1. Identify critical instructions buried in middle context
2. Move them to a dedicated "Critical Constraints" section at the top
3. Schedule periodic re-injection: "Reminder: [critical constraint]" every 20 turns

**For Context Poisoning:**
1. Identify the poisoned fact (the incorrect assumption being repeated)
2. Issue explicit correction: "CORRECTION: [X] is wrong. The correct answer is [Y]."
3. If correction doesn't hold → compress session, dropping poisoned turns

**For Context Distraction:**
1. Run `compress_session` skill to mask completed tool outputs
2. Apply Observation Masking to old tool results
3. Verify: re-ask the original question — does quality improve?

**For Context Confusion/Clash:**
1. Identify all instructions/rules in the current context
2. Find conflicts using the script
3. Remove duplicates, reconcile conflicts, add priority ordering

### Phase 3: Validate
After applying mitigation:
1. Re-probe with 3 questions spanning early, middle, and recent context
2. Verify recall quality matches at least 80% across all three periods
3. If middle-content recall is still < 80% → apply additional Write/Isolate mitigations

### Phase 4: Prevent Recurrence
For each degradation type encountered:
- Document the trigger condition (what caused it)
- Add a CLAUDE.md rule to prevent it in future sessions
- Schedule periodic context health checks (every 20 turns in long sessions)

## Anti-Patterns

| Don't | Do Instead |
|-------|------------|
| Assume larger context = better performance | Apply degradation mitigations regardless of model context window |
| Wait for visible quality degradation | Monitor at 70% utilization — degradation starts before you notice |
| Attempt 4th mitigation after 3 failures | Escalate — some degradation requires architectural changes |
| Place critical constraints in the middle of a long context | Position critical info at START or END |
| Ignore context poisoning (assume the model "knows" the correction | Explicitly overwrite poisoned facts with CORRECTION: markers |

## Available Scripts

- `degradation_check.py`: Analyzes session context for degradation risk factors, scores each pattern, estimates token thresholds, and recommends targeted mitigations

---

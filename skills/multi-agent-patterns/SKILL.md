---
name: multi-agent-patterns
version: 2.0.0
description: >-
  Design multi-agent systems using Supervisor, Peer-to-Peer (Swarm), and Hierarchical patterns.
  Addresses context isolation, handoff protocols, token economics (15x baseline cost), failure modes,
  and convergence constraints. Use when: (1) single-agent context limits are being hit, (2) parallelizing
  independent subtasks, (3) "design multi-agent", "supervisor pattern", "agent orchestration",
  "context isolation", "parallel agents" are mentioned.
author: muctehid-mcp
category: architecture
type: prompt
license: MIT
triggers:
  - "multi-agent"
  - "supervisor pattern"
  - "agent orchestration"
  - "context isolation"
  - "parallel agents"
  - "swarm"
  - "çok ajanlı"
tools:
  - run_command
  - search_code
  - get_context
parameters:
  pattern:
    type: string
    description: "Target pattern: supervisor | p2p | hierarchical | auto"
    default: "auto"
  task:
    type: string
    description: "Description of the task to be distributed across agents"
output:
  format: markdown
---

# Multi-Agent Architecture Specialist

Single agents hit context limits. Multi-agent systems solve this — but they introduce coordination overhead, token explosion (15x baseline), and failure modes that single agents never encounter. This skill designs the right pattern for the right problem, and protects against the critical failure modes.

## Core Principle

```
Sub-agents exist to ISOLATE CONTEXT — not to anthropomorphize role division.

Wrong: "I'll have a 'frontend agent' and a 'backend agent' because that sounds organized"
Right: "I'll isolate context because each agent needs a clean window for its subtask"
```

Context isolation is the fundamental benefit. Organizational role-playing is a secondary concern.

## Quick Start

```
1. Run: python skills/multi-agent-patterns/scripts/agent_graph.py {path}
2. Identify existing agent communication patterns
3. Select pattern: Supervisor | P2P | Hierarchical (see Pattern Selection Matrix)
4. Design explicit handoff protocol (prevents "telephone game" degradation)
5. Set convergence constraints and TTL limits before deployment
```

## Pattern Selection Matrix

| Pattern | When to Use | Key Risk | Solution |
|---------|------------|----------|----------|
| **Supervisor/Orchestrator** | Known subtask boundaries, sequential dependencies | Supervisor context accumulation | Direct pass-through, no paraphrasing |
| **Peer-to-Peer (Swarm)** | Exploratory tasks, flexible routing | Agent divergence, infinite loops | Convergence constraints + TTL |
| **Hierarchical** | Large systems, strategy → planning → execution | Coordination overhead | Minimize layers, direct comms where possible |

**Rule:** Token economics are brutal — multi-agent systems use roughly 15x baseline tokens. Model selection (Haiku vs Sonnet vs Opus) often yields larger gains than doubling agent count.

## Critical Rules

### 1. The Telephone Game Problem
When a supervisor paraphrases sub-agent responses before passing them to the next agent, information degrades at each hop. This is the #1 failure mode.

```
❌ Supervisor → "The auth agent found some issues" → Next Agent
✅ Supervisor → [raw auth agent output] → Next Agent (direct pass-through)
```

**Fix:** Implement pass-through mechanisms that preserve sub-agent output verbatim. Only the final synthesis step should involve paraphrasing.

### 2. Convergence Constraints Are Mandatory
P2P agents can enter infinite loops. Every P2P deployment must have:
- **Max iterations**: Hard cap on agent-to-agent messages (e.g., 10)
- **TTL**: Time limit per agent turn (e.g., 30s)
- **Consensus threshold**: What % of agents agreeing = done (e.g., 3/4)
- **Deadlock detector**: If no progress for N turns, escalate to supervisor

### 3. Validate Between Agents
Output from Agent A going into Agent B must be validated at the boundary:
- Schema validation (does the output match expected format?)
- Completeness check (did the agent finish, or did it time out?)
- Error propagation guard (don't pass an error as if it's a result)

```python
def safe_handoff(agent_output: dict) -> dict:
    if agent_output.get("status") == "error":
        raise AgentHandoffError(f"Agent failed: {agent_output['error']}")
    if not agent_output.get("result"):
        raise AgentHandoffError("Agent returned empty result")
    return agent_output["result"]
```

### 4. Token Budget Allocation
Before deploying multi-agent systems, allocate token budgets explicitly:

| Component | Recommended Budget |
|-----------|-------------------|
| Supervisor context | ≤ 4k tokens |
| Per sub-agent context | ≤ 8k tokens |
| Handoff payload | ≤ 2k tokens |
| Final synthesis | ≤ 4k tokens |

If any component exceeds budget, it's a signal to decompose further or apply context compression.

### 5. Weighted Voting for Consensus
When multiple agents produce conflicting outputs, use weighted voting:
```python
def consensus_vote(outputs: list[dict], weights: list[float]) -> dict:
    # Weight by: agent confidence score, task-specific reliability, recency
    scores = {}
    for output, weight in zip(outputs, weights):
        key = str(output.get("recommendation"))
        scores[key] = scores.get(key, 0) + weight
    return max(scores, key=scores.get)
```

## Process Workflow

### Phase 1: Task Decomposition
Analyze the task and identify:
- **Independent subtasks**: Can run in parallel (no data dependency)
- **Sequential subtasks**: Must run in order (B needs A's output)
- **Context size**: Would a single agent exceed context limits?

If all subtasks are sequential AND fit in one context → **don't use multi-agent**.

### Phase 2: Pattern Selection
```
Task is sequential and bounded → Supervisor (delegating orchestrator)
Task is exploratory and unbounded → P2P Swarm (with hard convergence constraints)
Task has clear strategic/tactical/execution layers → Hierarchical (≤3 layers)
```

### Phase 3: Handoff Protocol Design
Define each handoff explicitly:
```yaml
handoff:
  from: researcher_agent
  to: implementer_agent
  payload_schema:
    findings: string[]
    confidence: float  # 0.0-1.0
    sources: string[]
  validation:
    required_fields: [findings, confidence]
    min_confidence: 0.7
    on_failure: escalate_to_supervisor
```

### Phase 4: Failure Mode Hardening
For each agent in the system:
1. What does it return on success? (define schema)
2. What does it return on partial completion? (define degraded schema)
3. What does it return on failure? (define error schema)
4. Who handles each case? (define escalation path)

### Phase 5: Token Economics Audit
```bash
python skills/multi-agent-patterns/scripts/agent_graph.py {path} --token-audit
```
- Count total agent invocations in hot paths
- Estimate per-invocation token cost
- Flag any path with > 50k total tokens as requiring optimization

## Anti-Patterns

| Don't | Do Instead |
|-------|------------|
| Create agents for "role organization" without context need | Create agents only when context limits are actually hit |
| Let supervisor paraphrase sub-agent outputs | Pass through sub-agent outputs verbatim |
| P2P swarm without convergence constraints | Always set max_iterations + TTL before deployment |
| Ignore token economics in design | Budget tokens per component; use cheaper models for simple subtasks |
| Pass errors between agents as if they're results | Validate at every handoff; escalate on error |
| More than 3 hierarchical layers | Flatten to 2 layers; add direct comms where possible |

## Available Scripts

- `agent_graph.py`: Analyzes codebase for existing agent communication patterns, maps handoff chains, detects missing convergence constraints, estimates token cost

---

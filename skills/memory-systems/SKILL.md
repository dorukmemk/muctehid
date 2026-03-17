---
name: memory-systems
version: 2.0.0
description: >-
  Design, implement, and audit persistent memory architectures for AI agents.
  Covers Working/Short-term/Long-term/Temporal KG memory layers, hybrid retrieval
  (semantic + keyword + graph), and production frameworks (Mem0, Zep, Letta, Cognee).
  Use when: (1) building an agent that needs cross-session memory, (2) existing agent
  loses context between sessions, (3) user asks "how do I give the agent memory",
  (4) retrieval quality is degrading, (5) "memory", "remember", "persist context",
  "cross-session knowledge" are mentioned.
author: muctehid-mcp
category: architecture
type: prompt
license: MIT
triggers:
  - "agent memory"
  - "persist context"
  - "cross-session"
  - "memory architecture"
  - "long-term memory"
  - "memory systems"
  - "hafıza sistemi"
tools:
  - run_command
  - search_code
  - get_context
parameters:
  path:
    type: string
    description: "Root directory to audit for existing memory patterns"
  framework:
    type: string
    description: "Target memory framework: mem0 | zep | letta | cognee | langmem | custom"
    default: "custom"
output:
  format: markdown
---

# Memory Systems Architect

Context windows are volatile RAM. Everything the agent knows disappears on `/clear`, on session restart, on model switch. This skill externalizes agent knowledge into persistent, queryable memory layers — so future sessions begin with full context rather than a blank slate.

## Core Principle

```
Context Window (volatile)    +    Persistent Storage (durable)
        ↕                                    ↕
  What the agent knows now          What the agent learned before
        ↓                                    ↓
   Gone on session end             Survives forever
                    ↓
     Write important state to storage
     Load relevant state at session start
```

## Memory Layer Architecture

| Layer | Scope | Storage | Retrieval | Use Case |
|-------|-------|---------|-----------|----------|
| **Working** | Current context window | In-memory | Direct access | Immediate reasoning, active tool results |
| **Short-term** | Session-scoped | SQLite / Redis | Key lookup | Tool outputs, conversation turns, temp state |
| **Long-term** | Cross-session | Vector DB + Graph | Semantic search | User preferences, domain facts, decisions |
| **Temporal KG** | Cross-session + history | Bi-temporal graph | Graph traversal | Time-sensitive facts, "what was true when" |

## Quick Start

```
1. Run: python skills/memory-systems/scripts/memory_audit.py {path}
2. Review existing memory patterns in the codebase
3. Select framework based on requirements (see Framework Selection Matrix)
4. Design the 4-layer architecture for the use case
5. Implement retrieval strategy (hybrid > single-strategy)
```

## Framework Selection Matrix

| Framework | Best For | Architecture | Benchmark |
|-----------|----------|-------------|-----------|
| **Mem0** | Multi-tenant SaaS, broad integrations | Vector + Graph | Strong general |
| **Zep/Graphiti** | Enterprise, temporal queries | Bi-temporal KG | 90% latency reduction vs single-strategy |
| **Letta** | Deep agent introspection, self-editing | Tiered (in-context/core/archival) | 74% LoCoMo |
| **Cognee** | Evolving agent knowledge | Multi-layer semantic graph | — |
| **LangMem** | LangGraph workflows | LangGraph-native | — |
| **Custom** | Full control, no external dependencies | File + SQLite + Vector | Project-specific |

**Rule:** Start with file-system memory. Letta's basic file agents hit 74% on LoCoMo benchmarks — beating more elaborate systems. Add structure (graphs, temporal validity) only when retrieval quality actually demands it.

## Critical Rules

### 1. Never Stuff Everything Into Context
The most common mistake: loading all memory into the context window "just in case." This degrades performance and explodes token cost. Implement **just-in-time loading** — retrieve only what's relevant to the current query.

### 2. Hybrid Retrieval Beats Single-Strategy
- Semantic search alone misses exact keyword matches
- Keyword search alone misses conceptual similarity
- Graph traversal alone misses surface-form connections
- **Combine all three.** Zep's hybrid approach achieves 90% latency reduction while improving multi-hop reasoning accuracy.

### 3. Retrieval Quality > Storage Complexity
"Tool complexity matters less than reliable retrieval." A simple SQLite full-text-search that reliably returns the right facts beats a complex graph DB with mediocre recall. Measure retrieval accuracy before adding infrastructure.

### 4. Temporal Validity
Facts expire. "The auth endpoint is `/api/v1/login`" may be true today and false after a refactor. Every stored fact should carry:
- `created_at`: When was this learned?
- `valid_until`: When does this expire? (or null = indefinite)
- `source`: What tool call/session established this?

### 5. The Three-Write Rule
Write to long-term memory when a fact appears **3 or more times** across different sessions. Single-occurrence facts are noise. Repeated facts are signal.

## Process Workflow

### Phase 1: Memory Audit
```bash
python skills/memory-systems/scripts/memory_audit.py {path}
```
- Detect existing memory patterns (SQLite, files, Redis, vector stores)
- Identify what is currently volatile vs. persistent
- Map gaps: what's lost on session restart that shouldn't be

### Phase 2: Layer Design
Design each memory layer explicitly:

```yaml
working_memory:
  scope: current_context
  max_tokens: 4000
  eviction: LRU

short_term:
  scope: session
  backend: sqlite
  ttl: 24h
  schema: [session_id, key, value, timestamp]

long_term:
  scope: permanent
  backend: vector_db + sqlite_fts5
  retrieval: hybrid (semantic + keyword)
  schema: [id, content, embedding, source, created_at, valid_until, tags]

temporal_kg:
  scope: permanent + history
  backend: graph (nodes + edges + timestamps)
  query: "what was true at time T?"
```

### Phase 3: Retrieval Implementation
Implement the retrieval pipeline:

```
Query → Semantic Search (top-k) → Keyword Filter → Graph Traversal → Merge → Re-rank → Return top-5
```

Never return more than 5 memory fragments to the context window at once. Quality over quantity.

### Phase 4: Write Policy
Define explicit write triggers:
- ✅ User states a preference explicitly → write immediately
- ✅ Agent makes an architectural decision → write to long-term
- ✅ Fact appears 3rd time across sessions → promote to long-term
- ❌ Intermediate tool results → short-term only (TTL 24h)
- ❌ Error messages → log, do not memorize

### Phase 5: Validation
Run the memory audit script after implementation to verify:
- Read latency < 50ms for long-term memory
- Retrieval precision > 80% on known facts
- Zero context-stuffing (no full-dump retrieval)

## Anti-Patterns

| Don't | Do Instead |
|-------|------------|
| Load all memories at session start | Just-in-time load only what's relevant |
| Store every tool result permanently | Use short-term TTL for intermediate results |
| Single-strategy retrieval (semantic only) | Hybrid: semantic + keyword + graph |
| No expiration on facts | Add valid_until to every stored fact |
| Complex graph DB for simple use case | Start with SQLite FTS5, upgrade only when needed |
| Memory writes without source attribution | Every write must include source + timestamp |

## Available Scripts

- `memory_audit.py`: Scans a codebase for existing memory patterns, detects storage backends, maps volatile vs persistent state

---

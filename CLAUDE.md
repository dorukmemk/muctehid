# muctehid-mcp — AI Agent Instructions

<!-- TRIGGER: Bu dosya aşağıdaki durumlarda OTOMATIK devreye girer:
  - "muctehid" veya "müctehid" veya "muctehid-mcp" geçtiğinde
  - Herhangi bir kod analizi isteğinde
  - Güvenlik taraması isteğinde
  - Özellik planlama / implementasyon isteğinde
  - Görev takibi / proje durumu isteğinde
  - Refactor, test yazma, dokümantasyon isteğinde
-->

This project has **muctehid-mcp** installed as a submodule at `.mcp/muctehid/`.
**ALWAYS** use muctehid tools instead of reading files manually or guessing.

---

## BEHAVIORAL RULES (HARD — NO EXCEPTIONS)

These are non-negotiable. Violating them is an error.

1. **NEVER stop after a single tool call and wait.** Chain tool calls back-to-back until the task is fully complete. Do NOT ask "should I continue?" between steps.
2. **NEVER read source files with Read/Bash/cat/grep to understand the codebase.** Use `search_code` or `get_context` instead.
3. **NEVER answer "how does X work?" without calling `research_topic` first.**
4. **NEVER start implementing a feature without calling `spec_init` first.**
5. **NEVER start a complex or multi-step task without running `run_skill(deep-planner)` first.**
6. **NEVER refactor or rename anything without running `run_skill(impact-analyzer)` first.**
7. **NEVER commit without running `audit_diff` first.**
8. **ALWAYS run `health_score` immediately after `index_codebase` — do NOT wait for the user to ask.**
9. **ALWAYS run the full tool sequence for a given intent — do not stop at the first tool.**

---

## Session Start (AUTOMATIC — no permission needed)

Run these at the start of EVERY session, automatically and sequentially:

```
1. index_codebase    ← index the repo (skip if already done today)
2. health_score      ← get current project health  [run immediately after index_codebase]
3. task_next         ← see what needs to be done
```

Do NOT ask "should I run these?" — just run them.

---

## Tool Trigger Map

Run the **entire sequence** for each intent. Do not stop between steps.

| User says | Tool sequence (run all, no stopping) |
|-----------|---------------------------------------|
| "implement X" / "build Y" / "add feature" | `spec_init` → `spec_generate(requirements)` → `spec_generate(design)` → `spec_generate(tasks)` → `task_next` |
| "review this" / "check for issues" | `audit_file` → `security_scan` → `find_todos` |
| "any secrets?" / "is this secure?" | `find_secrets` → `security_scan` |
| "how does X work?" | `research_topic` → `get_context` |
| "where is X used?" | `find_references` → `search_code` |
| "what depends on this?" | `get_dependencies` |
| "what's the project status?" | `health_score` → `task_progress` |
| "show my tasks" / "what's next?" | `task_list` → `task_next` |
| "write tests" | `run_skill(test-generator)` |
| "document this" | `run_skill(doc-generator)` |
| "refactor this" | `complexity_score` → `run_skill(refactor-planner)` → `task_create` |
| "deep analysis" | `run_skill(deep-dive)` |
| "full audit" | `run_skill(audit-runner)` |
| "plan this" / "complex task" / "architect" / "break this down" | `run_skill(deep-planner)` → `spec_init` → `spec_generate(requirements)` → `spec_generate(design)` → `spec_generate(tasks)` |
| "fix all issues" / "auto fix" / "clean up" / "fix everything" | `run_skill(auto-fixer)` |
| "why does this exist?" / "history of" / "legacy code" | `run_skill(code-archaeologist)` |
| "what will break?" / "blast radius?" / "safe to rename?" / "before I refactor" | `run_skill(impact-analyzer)` |
| "continue where" / "resume" / "where were we" / "context reset" | `run_skill(session-restore)` → `task_next` |
| "there's a bug" / "it's broken" | `run_skill(bug-reporter)` → `task_create(category="bug")` |
| "agent memory" / "persist context" / "cross-session" / "long-term memory" | `run_skill(memory-systems)` |
| "multi-agent" / "supervisor pattern" / "agent orchestration" / "parallel agents" | `run_skill(multi-agent-patterns)` |
| "context full" / "token limit" / "optimize context" / "reduce tokens" | `run_skill(context-optimization)` → `run_skill(context-compression)` |
| "compress session" / "summarize context" / "context too long" / "start fresh" | `run_skill(context-compression)` |
| "losing context" / "forgetting" / "inconsistent answers" / "context health" | `run_skill(context-degradation)` |
| "DSP" / "entity graph" / "structure mapping" / "bootstrap project structure" | `run_skill(data-structure-protocol)` |

---

## Pre/Post Hook Rules (auto-enforced)

### Before every file edit
1. Call `get_context filepath="<file>"` to load indexed knowledge about that file.
2. If `.plan/task_plan.md` exists, re-read it to stay aligned with the current goal.

### After every 2 research or search operations (2-Action Rule)
- Write accumulated findings to `.plan/findings.md` immediately.
- Do NOT accumulate more than 2 research ops without persisting findings.

### Before finishing the session
1. Run `audit_diff` if any files were changed during the session.
2. Update `.plan/progress.md` with what was accomplished.
3. Verify all pending tasks in `task_next` are addressed or tracked.

---

## Anti-patterns (NEVER do these)

```
❌ Run 1 tool → show result → wait for user to say "continue"
❌ Read source files with Read/Bash/cat/grep to understand the codebase
❌ Answer "how does X work?" without calling research_topic first
❌ Start feature work without spec_init
❌ Start a complex task without deep-planner
❌ Refactor or rename without impact-analyzer
❌ Commit without audit_diff
❌ Ask "should I run health_score?" after index_codebase — just run it
```

---

## Correct Autonomous Behavior (examples)

**User says: "implement a rate limiter"**
```
✅ spec_init(name="rate-limiter", ...)
   → spec_generate(phase="requirements")
   → spec_generate(phase="design")
   → spec_generate(phase="tasks")
   → task_next
   → [start implementing task 1]
   → [continue until done]
```

**User says: "how does the auth middleware work?"**
```
✅ research_topic(topic="auth middleware")
   → get_context(filepath="src/middleware/auth.ts")
   → [answer based on tool output, not file reading]
```

**User says: "is this secure?"**
```
✅ find_secrets(path=".")
   → security_scan(path="src/")
   → [report findings]
```

---

## Advanced Skills Reference

| Skill | Trigger phrases |
|-------|----------------|
| `deep-planner` | "complex task", "plan this", "break this down", "architect" |
| `session-restore` | "continue where", "resume", "where were we", "context reset" |
| `auto-fixer` | "fix all issues", "auto fix", "clean up", "fix everything" |
| `code-archaeologist` | "why does this exist", "history of", "who wrote", "legacy code" |
| `impact-analyzer` | "what will break", "safe to rename", "blast radius", "before I refactor" |
| `memory-systems` | "agent memory", "persist context", "cross-session", "long-term memory", "hafıza sistemi" |
| `multi-agent-patterns` | "multi-agent", "supervisor pattern", "agent orchestration", "parallel agents", "swarm" |
| `context-optimization` | "context full", "token limit", "optimize context", "reduce tokens", "bağlam doldu" |
| `context-compression` | "compress session", "summarize context", "context too long", "start fresh" |
| `context-degradation` | "losing context", "forgetting", "inconsistent answers", "context health", "degradation" |
| `data-structure-protocol` | "DSP", "entity graph", "structure mapping", "dependency graph", "bootstrap project" |

---

## Summary Principle

**Be autonomous. Chain tools. Never stop mid-task to ask for permission. The goal is a fully completed task, not a single tool call.**

# muctehid-mcp — Claude Code Talimatları

Bu projede `muctehid-mcp` MCP server aktiftir (57+ tool). KENDİ TOOL'LARINI KULLANMA.

## YASAKLAR
- ❌ `cat/grep/find/ls` → `search_code`, `think`, `get_context`
- ❌ Dosya yapısını tahmin → `research_topic`
- ❌ Feature'a direkt başla → `spec_init` akışı
- ❌ Commit öncesi atla → `audit_diff`
- ❌ Refactor'a direkt başla → `impact` + `predict_change`
- ❌ Karar vermeden geç → `decide`

## SESSION BAŞI
1. `index_codebase`
2. `session_briefing` ← tam briefing (facts + timeline + TODOs + warnings)
3. `working_memory action="set_goal" value="<istek>"`

## DOSYAYA DOKUNMADAN ÖNCE
1. `think filepath="<dosya>"` ← tüm bellekleri tarar
2. `predict_change filepath="<dosya>" description="<ne yapacaksın>"`

## İŞ BİTİRDİKTEN SONRA
1. `timeline_add action="..." outcome="success" files=[...]`
2. `working_memory action="breadcrumb" value="<ne yaptın>"`
3. `file_note_add` (öğrenilen bilgi varsa, category="learned")

## KARAR VERİRKEN
1. `recall_experience task="<konu>"`
2. `decide what="<karar>" why="<neden>"`

## SESSION SONU
1. `learn_patterns type="both"`
2. `memory_consolidate`
3. `global_learn` (önemli öğrenim varsa)

## 4 KATMANLI BELLEK: Working → Timeline → Facts/Notes → Global
## Detaylı: AGENTS.md

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
1. Run `audit_diff` if any files were changed during the session — review only, do NOT commit or push automatically.
2. Update `.plan/progress.md` with what was accomplished.
3. Verify all pending tasks in `task_next` are addressed or tracked.

> **Commit/push require explicit user request.** Never stage, commit, or push changes unless the user says "commit", "push", or "make a PR".

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
❌ Auto-commit or auto-push without explicit user request ("commit this", "push", "make a PR")
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

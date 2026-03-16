# muctehid-mcp — Agent Instructions

> **Trigger:** Apply these instructions whenever keywords `muctehid`, `müctehid`, `muctehid-mcp` appear, or for any code analysis, security scan, feature planning, or task tracking request.

This project has **muctehid-mcp** installed as a submodule at `.mcp/muctehid/`.
Always use muctehid tools instead of reading files manually or guessing.

## Session Start (REQUIRED)

Run these at the beginning of EVERY session:

```
index_codebase    ← index the repo (skip if already done today)
health_score      ← get current project health
task_next         ← see what needs to be done
```

## When to Use Which Tool

### Before touching any code
- **Understanding a file** → `get_context filepath="src/..."` before reading
- **Finding code** → `search_code query="..."` before using grep/glob
- **How does X work?** → `research_topic topic="..."` before answering

### When user asks to build / implement something
1. `spec_init name="..." description="..."` — create spec
2. `spec_generate specId="..." phase="requirements"` — generate requirements
3. `spec_generate specId="..." phase="design"` — generate design
4. `spec_generate specId="..." phase="tasks"` — generate tasks
5. `task_next` — start working on tasks in order

### When user asks for security / quality check
- Single file → `audit_file filepath="..."`
- Full project → `run_skill skill="security-audit" path="src/"`
- Before commit → `audit_diff`
- Secrets check → `find_secrets path="."`

### When user mentions a bug / issue
- `run_skill skill="bug-reporter" filepath="..."` — analyze and report
- `task_create title="Fix: ..." category="bug"` — track it

### When user asks to refactor
- `complexity_score filepath="..."` — measure first
- `run_skill skill="refactor-planner" filepath="..."` — get a plan

### Before committing
- `audit_diff` — always run this before commit

## Tool → Trigger Mapping

| User says | Use |
|-----------|-----|
| "implement X" / "build Y" / "add feature" | `spec_init` → `spec_generate` × 3 |
| "review this" / "check for issues" | `audit_file` |
| "any secrets?" / "is this secure?" | `find_secrets` + `security_scan` |
| "how does X work?" | `research_topic` |
| "where is X used?" | `find_references` |
| "what depends on this?" | `get_dependencies` |
| "what's the project status?" | `health_score` + `task_progress` |
| "show my tasks" / "what's next?" | `task_list` + `task_next` |
| "write tests" | `run_skill skill="test-generator"` |
| "document this" | `run_skill skill="doc-generator"` |
| "refactor this" | `run_skill skill="refactor-planner"` |
| "deep analysis" | `run_skill skill="deep-dive"` |
| "full audit" | `run_skill skill="audit-runner"` |

## Hook Behavior (auto-enforced)

### PreToolUse — Before every file edit
1. Call `get_context filepath="<file>"` to load indexed knowledge
2. If `.plan/task_plan.md` exists, re-read it to stay on goal (prevents goal drift)

### PostToolUse — After every edit
1. Update `.plan/progress.md` with what was done
2. If 2+ search/research ops done → update `.plan/findings.md` (2-Action Rule)

### Session End — Before finishing
1. Verify all tasks in `task_next` are addressed
2. Run `audit_diff` if any files were changed

## Advanced Skills (new)

| Skill | Trigger phrases |
|-------|----------------|
| `deep-planner` | "complex task", "plan this", "break this down", "architect" |
| `session-restore` | "continue where", "resume", "where were we", "context reset" |
| `auto-fixer` | "fix all issues", "auto fix", "clean up", "fix everything" |
| `code-archaeologist` | "why does this exist", "history of", "who wrote", "legacy code" |
| `impact-analyzer` | "what will break", "safe to rename", "blast radius", "before I refactor" |

## Never Do Without muctehid

- Do NOT read files with cat/grep to understand the codebase — use `search_code`
- Do NOT guess about code structure — use `research_topic`
- Do NOT skip `audit_diff` before commits
- Do NOT start a feature without `spec_init`
- Do NOT start a complex task without `deep-planner`
- Do NOT refactor/rename without `impact-analyzer` first

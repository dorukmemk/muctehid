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
| **"what will break if I change X?"** | **`impact target="X" direction="upstream"`** |
| **"show me the call graph"** | **`context name="X"` → 360° view** |
| **"safe to rename X?"** | **`rename symbol_name="X" new_name="Y" dry_run=true`** |
| **"what changed in this commit?"** | **`detect_changes scope="staged"`** |

## 🆕 Enhanced Memory System (3-Layer)

### Timeline Memory (Episodic)
Tracks every action with timestamps. Use to learn from history.

| Tool | When to Use |
|------|-------------|
| `timeline_add` | **AUTO**: After every significant action (refactor, fix, feature) |
| `timeline_search` | "How did we handle X before?", "What validation changes did we make?" |
| `timeline_recent` | Session start to see recent work |

### File Notes (Semantic)
Annotations about specific files. Use to remember warnings, learnings, TODOs.

| Tool | When to Use |
|------|-------------|
| `file_note_add` | After complex refactor, bug fix, or learning something important |
| `file_note_get` | **AUTO**: When opening a file to see warnings/notes |
| `file_note_search` | "Where did we use regex validation?", "Find all TODO notes" |

**Categories**: `info`, `warning`, `todo`, `learned`

### Important Facts (Declarative)
Critical knowledge about the project. Use for architecture, security, business rules.

| Tool | When to Use |
|------|-------------|
| `fact_add` | When learning critical project knowledge |
| `fact_search` | Before making decisions, "What's our auth strategy?" |
| `fact_list` | **AUTO**: Session start to load top facts |

**Categories**: `architecture`, `security`, `business`, `technical`  
**Importance**: `low`, `medium`, `high`, `critical`

### Memory Usage Examples

```typescript
// After refactoring
timeline_add({
  action: "refactored UserService.validateUser",
  context: "Changed to Zod schema validation",
  files: ["src/services/user.ts"],
  outcome: "success",
  tags: ["refactor", "validation"]
})

// Add file warning
file_note_add({
  filepath: "src/services/user.ts",
  note: "validateUser uses Zod schema. Don't change without updating tests.",
  category: "warning"
})

// Add critical fact
fact_add({
  fact: "API uses JWT tokens with 24h expiration",
  category: "security",
  importance: "high"
})

// Search past work
timeline_search({
  query: "validation logic",
  timeRange: "last 30 days"
})
```

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

## 🆕 GitNexus Integration (Knowledge Graph)

### New Graph-Based Tools

| Tool | When to Use | Example |
|------|-------------|---------|
| `impact` | Before refactoring, to see blast radius | `impact({ target: "validateUser", direction: "upstream" })` |
| `context` | To understand a symbol's relationships | `context({ name: "validateUser", filepath: "src/auth/validate.ts" })` |
| `detect_changes` | Pre-commit impact analysis | `detect_changes({ scope: "staged" })` |
| `rename` | Multi-file safe rename | `rename({ symbol_name: "validateUser", new_name: "verifyUser", dry_run: true })` |
| `cypher` | Raw graph queries for complex analysis | `cypher({ query: "MATCH (fn)-[:CALLS]->(target) RETURN fn" })` |
| `list_processes` | See execution flows | `list_processes({ minSteps: 3 })` |
| `list_clusters` | See functional modules | `list_clusters({ minCohesion: 0.7 })` |

### When to Use Graph Tools

- **Before refactoring** → `impact` to see what will break
- **Before renaming** → `rename` with `dry_run: true` to preview changes
- **Understanding code flow** → `list_processes` to see execution paths
- **Finding related code** → `list_clusters` to see functional groupings
- **Pre-commit check** → `detect_changes` to see impact of your changes
- **Deep symbol analysis** → `context` for 360° view of a function/class

### Graph Tool Workflow

```
1. User: "I want to refactor validateUser"
2. Agent: impact({ target: "validateUser", direction: "upstream" })
3. → Shows: 3 direct callers, 2 processes affected, RISK: MEDIUM
4. Agent: context({ name: "validateUser" })
5. → Shows: incoming calls, outgoing calls, processes, cluster
6. Agent: "Safe to refactor, but test LoginFlow and RegistrationFlow"
```

## Never Do Without muctehid

- Do NOT read files with cat/grep to understand the codebase — use `search_code`
- Do NOT guess about code structure — use `research_topic`
- Do NOT skip `audit_diff` before commits
- Do NOT start a feature without `spec_init`
- Do NOT start a complex task without `deep-planner`
- Do NOT refactor/rename without `impact` first (graph-based analysis)
- Do NOT commit without `detect_changes` (impact analysis)
- Do NOT rename symbols manually — use `rename` tool (multi-file safe)

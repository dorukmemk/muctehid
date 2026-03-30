---
name: data-structure-protocol
version: 2.0.0
description: >-
  Build and navigate DSP (Data Structure Protocol) — a graph-based long-term structural memory
  of codebases for LLM agents. Stores entities (modules, functions), their dependencies (imports),
  public API (exports), and reasons for every connection. Use when: (1) project has a .dsp/ directory,
  (2) user asks to set up DSP or bootstrap project structure, (3) creating/modifying/deleting code files,
  (4) navigating dependencies, understanding why code exists, (5) "DSP", "dsp-cli", ".dsp",
  "structure mapping", "entity graph" are mentioned.
author: muctehid-mcp
category: architecture
type: prompt
license: MIT
triggers:
  - "DSP"
  - "dsp-cli"
  - "entity graph"
  - "structure mapping"
  - "dependency graph"
  - "why does this exist"
  - "bağımlılık grafiği"
tools:
  - run_command
  - search_code
  - get_context
parameters:
  path:
    type: string
    description: "Root directory to bootstrap or update DSP index"
  action:
    type: string
    description: "Action: bootstrap | update | search | validate"
    default: "bootstrap"
output:
  format: markdown
---

# Data Structure Protocol (DSP) Architect

Code without a structural memory degrades into archaeology. Every new developer (or AI agent) must re-discover: what does this module do, why does it exist, what does it depend on, and who depends on it? DSP externalizes this knowledge into a machine-readable graph that answers all four questions without requiring anyone to read the code.

**DSP is NOT documentation for humans or an AST dump.** It captures _meaning_ (purpose), _boundaries_ (imports/exports), and _reasons for connections_ (why).

## Core Principle

```
Before DSP:
  Agent reads file → guesses purpose → may be wrong → acts on wrong assumption

After DSP:
  Agent reads .dsp/obj-{uid}.json → reads description + imports + why → acts correctly

The .dsp/ directory is the agent's long-term structural memory of this codebase.
```

## Quick Start

```
1. Run: python skills/data-structure-protocol/scripts/dsp_bootstrap.py {path}
2. Review the generated .dsp/ directory
3. Verify entity descriptions are meaningful (not just filenames)
4. Register all exports as shared entities
5. Add @dsp: uid comments to source files
```

## DSP Entity Schema

Every entity in the graph has this structure:

```json
{
  "uid": "obj-a1b2c3d4",
  "type": "object | function | dependency",
  "name": "AuthMiddleware",
  "source_file": "src/middleware/auth.ts",
  "description": "Validates JWT tokens on incoming requests and attaches the decoded user to req.user. Rejects with 401 if token is absent or expired.",
  "imports": [
    {
      "from": "obj-99887766",
      "why": "Uses JWTService to decode and verify token signatures"
    }
  ],
  "exports": ["validateToken", "requireAuth"],
  "created_at": "2026-03-17",
  "last_updated": "2026-03-17"
}
```

## UID Format

| Entity Type | Format | Example |
|------------|--------|---------|
| Module/Object | `obj-<8 hex>` | `obj-a1b2c3d4` |
| Function | `func-<8 hex>` | `func-99887766` |
| External dep | `dep-<8 hex>` | `dep-npm-zod` |

UIDs are marked in source files with `// @dsp: obj-a1b2c3d4` comments. **Never change a UID** — it is the permanent identity of the entity.

## Critical Rules

### 1. Before Changing Code — Read DSP First
```
❌ Open file → read code → guess what it does → edit
✅ Read .dsp/obj-{uid}.json → understand purpose + deps → then open file → edit
```

The `.dsp/` directory is the agent's map. Read the map before entering the territory.

### 2. When Creating a File — Register It
Every new file/module must get a DSP entry immediately:
1. Generate a UID: `python skills/data-structure-protocol/scripts/dsp_bootstrap.py --new-uid`
2. Create `.dsp/obj-{uid}.json` with description + imports
3. Add `// @dsp: obj-{uid}` comment to the source file
4. Register all exports as shared entities

### 3. Description Quality Standard
The description must answer: **What does this do and why does it exist?**

```
❌ "Auth middleware file"                 (restates the filename)
❌ "Handles authentication"              (too vague)
✅ "Validates JWT tokens on incoming requests, attaches decoded user to req.user,
    rejects with 401 if token is absent/expired or if user is not found in DB."
```

### 4. Import Reasons Are Mandatory
Every import must have a `why` field:
```json
"imports": [
  {
    "from": "dep-npm-zod",
    "why": "Schema validation for request body before processing"
  }
]
```

Without `why`, the graph becomes a plain import graph (which AST tools already provide). The `why` is what makes DSP valuable — it captures the architectural reasoning.

### 5. Cascade on Delete
When a file is deleted:
1. Find its DSP entry
2. Find all entities that import it (reverse lookup)
3. Update those entities' import lists
4. Remove the deleted entity's `.dsp/` file
5. Mark affected entities as requiring review

### 6. UID Preservation on Rename/Move
When a file is moved/renamed:
1. Find its DSP entry (by searching for the old path)
2. Update `source_file` in the entry — keep the UID unchanged
3. Update the `@dsp:` comment in the moved file
4. No other changes needed — the UID is permanent

## Process Workflow

### Bootstrapping a New Project
```bash
python skills/data-structure-protocol/scripts/dsp_bootstrap.py {path} --action bootstrap
```

This script:
1. Walks the directory tree
2. Generates UIDs for each module/file
3. Extracts existing imports (AST-style regex)
4. Creates `.dsp/` entries with placeholder descriptions
5. Creates `.dsp/TOC.json` (table of contents)

After bootstrapping:
- Review every description — the script generates placeholder text, you must make it meaningful
- Add `why` fields to all detected imports
- Identify and register all exported functions/classes

### Updating After Code Changes
```bash
python skills/data-structure-protocol/scripts/dsp_bootstrap.py {path} --action update
```

Detects:
- New files without DSP entries → registers them
- Modified files → flags for description review
- Deleted files → removes entries + cascades

### Searching the Graph
```bash
python skills/data-structure-protocol/scripts/dsp_bootstrap.py {path} --action search --query "auth"
```

Returns all entities matching the query in name, description, or imports.

### Validating the Graph
```bash
python skills/data-structure-protocol/scripts/dsp_bootstrap.py {path} --action validate
```

Checks:
- All source files have DSP entries
- All entries point to existing files
- All imports reference valid UIDs
- All descriptions are non-placeholder (not empty)
- All imports have `why` fields

## DSP vs. Alternative Approaches

| Approach | What It Captures | What It Misses |
|----------|-----------------|----------------|
| **AST/Type Graph** | Structure, types, call graph | Purpose, why connections exist |
| **Documentation** | Human-readable explanation | Machine-queryable structure |
| **README** | High-level overview | Per-module detail |
| **DSP** | Purpose + boundaries + why | Implementation details (by design) |

## When to Update DSP

| Action | Update Required? |
|--------|-----------------|
| Add new file | ✅ Yes — register immediately |
| Add new export | ✅ Yes — add to shared list |
| Add import to existing file | ✅ Yes — add with why |
| Delete file | ✅ Yes — cascade cleanup |
| Rename/move file | ✅ Yes — update source_file path |
| Modify internal logic only | ❌ No — DSP captures boundaries, not internals |
| Fix a bug without changing interface | ❌ No |
| Add internal variable | ❌ No |

## Anti-Patterns

| Don't | Do Instead |
|-------|------------|
| Skip DSP entry for "small" files | All files get entries — size doesn't matter |
| Use filenames as descriptions | Write what the entity does, not what it's called |
| Omit `why` from imports | Every import must explain why it's needed |
| Change UIDs when moving files | UIDs are permanent — only update `source_file` |
| Let DSP drift (code changes, DSP doesn't) | Run `--action update` after every significant code change |

## Available Scripts

- `dsp_bootstrap.py`: Bootstrap, update, search, and validate the DSP graph for any codebase

---

# code-audit-mcp

> Autonomous MCP server for code auditing — hybrid BM25+vector memory, OWASP security scanning, skills system. **Zero Python. Zero cloud API. Zero subprocess.**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-20%2B-green.svg)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://typescriptlang.org)

## Features

- 🔍 **Hybrid Memory** — BM25 (SQLite FTS5) + vector search fused with Reciprocal Rank Fusion
- 🔒 **OWASP Top 10** security scanning with fix suggestions
- 🕵️ **Secret Detection** — AWS, GitHub, Stripe, JWT, SSH keys via regex + entropy
- 📊 **Health Score** — weighted 0-100 across security, quality, docs, tests, dependencies
- 🎯 **Skills System** — 9 built-in skills, install custom ones
- 🔧 **Git Integration** — diff audit, blame context, pre-commit hooks
- 📦 **Plugin Ecosystem** — npm-style extensibility
- 🖥️ **Cross-platform** — Windows / Mac / Linux
- ☁️ **Fully local** — no API keys, no cloud, no telemetry

## Quick Start

### As a submodule

```bash
git submodule add https://github.com/muctehid/code-audit-mcp .mcp/code-audit
cd .mcp/code-audit
npm install
npm run build
```

### Configure your IDE

**Cursor / Claude Desktop** — add to `.cursor/mcp.json` or `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "code-audit": {
      "command": "node",
      "args": [".mcp/code-audit/dist/index.js"],
      "env": {
        "REPO_ROOT": ".",
        "AUDIT_DATA_DIR": ".audit-data"
      }
    }
  }
}
```

### First use

```
index_codebase          ← index the repo
health_score            ← get 0-100 health score
list_skills             ← see available skills
run_skill("security-audit", { path: "src/" })
```

## Tools (30)

### Memory (6)
| Tool | Description |
|------|-------------|
| `index_codebase` | Index directory into hybrid BM25+vector memory |
| `search_code` | Semantic + keyword search across codebase |
| `add_memory` | Manually add context/notes to memory |
| `get_context` | Get indexed context for a file |
| `memory_stats` | Index statistics |
| `clear_memory` | Reset all indexed memory |

### Audit (8)
| Tool | Description |
|------|-------------|
| `audit_file` | Full security + quality audit of a file |
| `audit_diff` | Audit uncommitted git changes |
| `security_scan` | OWASP Top 10 pattern scan |
| `find_secrets` | Detect API keys and secrets |
| `find_todos` | Find TODO/FIXME/HACK comments |
| `complexity_score` | Cyclomatic complexity analysis |
| `dependency_audit` | npm/pip dependency risk |
| `health_score` | Overall repository health (0-100) |

### Skills (6)
| Tool | Description |
|------|-------------|
| `list_skills` | List available skills |
| `run_skill` | Execute a skill |
| `install_skill` | Install from a directory |
| `remove_skill` | Uninstall a skill |
| `skill_info` | Show skill details |
| `create_skill` | Generate a skill template |

### Git (5)
| Tool | Description |
|------|-------------|
| `git_diff_audit` | Audit uncommitted changes |
| `git_blame_context` | Git blame for a file |
| `pre_commit_check` | Pre-commit security gate |
| `commit_history_search` | Search commit messages |
| `install_hooks` | Install pre-commit/push hooks |

### Reports (3)
| Tool | Description |
|------|-------------|
| `generate_report` | Full audit report (markdown + JSON) |
| `export_report` | Export in markdown/json/html |
| `compare_reports` | Diff two audit reports |

### Context (2)
| Tool | Description |
|------|-------------|
| `find_references` | Find symbol usages |
| `get_dependencies` | Import/dependency graph |

## Built-in Skills (9)

| Skill | Category | What it does |
|-------|----------|-------------|
| `security-audit` | security | OWASP Top 10, secret detection |
| `code-review` | quality | Code quality, best practices |
| `refactor-suggest` | quality | Refactoring opportunities |
| `test-generator` | testing | Unit test scaffolding |
| `doc-generator` | docs | JSDoc/docstring generation |
| `performance-audit` | performance | Bottleneck detection |
| `dependency-risk` | security | Package vulnerability analysis |
| `license-scan` | compliance | License compatibility check |
| `accessibility-check` | quality | WCAG a11y pattern check |

## Health Score

```
Health Score (0-100)
├── Security     30%  → OWASP violations, secrets, CVE
├── Quality      25%  → complexity, dead code, patterns
├── Docs         20%  → comment coverage
├── Tests        15%  → test file ratio
└── Dependencies 10%  → outdated, vulnerable packages
```

| Score | Grade | Action |
|-------|-------|--------|
| 90-100 | Excellent | — |
| 70-89 | Good | Informational |
| 50-69 | Needs Attention | Warning |
| <50 | Critical | Block optional |

## Configuration

`.audit-config.json` in your repo root:

```json
{
  "version": "2.0",
  "memory": {
    "mode": "hybrid",
    "chunkSize": 150,
    "chunkOverlap": 20
  },
  "audit": {
    "owasp": true,
    "secrets": true
  },
  "hooks": {
    "preCommit": true,
    "prePush": false
  }
}
```

## Tech Stack

| Layer | Package | Why |
|-------|---------|-----|
| Runtime | Node.js 20+ / TypeScript | — |
| MCP | `@modelcontextprotocol/sdk` | stdio transport |
| BM25 | `better-sqlite3` + FTS5 | native, proven |
| Vectors | pure TypeScript | zero native deps |
| Embeddings | `@xenova/transformers` | ONNX, local, no API key |
| Config | `zod` | schema validation |
| Git | `simple-git` | cross-platform |

## Plugin System

```typescript
// my-plugin/index.ts
import { definePlugin } from 'code-audit-mcp/plugins';

export default definePlugin({
  name: '@my-org/my-plugin',
  version: '1.0.0',
  tools: [{
    name: 'my_tool',
    description: 'My custom tool',
    inputSchema: { type: 'object', properties: { path: { type: 'string' } } },
    handler: async ({ path }) => { /* ... */ },
  }],
});
```

## License

MIT — free for personal and commercial use.

---

*Built with ❤️ — open source, contributions welcome.*

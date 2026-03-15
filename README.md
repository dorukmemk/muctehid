# muctehid-mcp

> Herhangi bir Git reposuna submodule olarak eklenebilen, tam otonom MCP server. Hybrid BM25+vector memory, OWASP güvenlik taraması, Orchestrator, Spec Mode (Kiro-benzeri), Task/Todo sistemi, Research Engine. **Sıfır Python. Sıfır cloud API. Sıfır subprocess.**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-20%2B-green.svg)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://typescriptlang.org)

## Özellikler

- 🔍 **Hybrid Memory** — BM25 (SQLite FTS5) + vector search, RRF fusion ile birleştirilmiş
- 🔒 **OWASP Top 10** — 15 pattern, fix önerileriyle birlikte
- 🕵️ **Secret Detection** — AWS, GitHub, Stripe, JWT, SSH key tespiti (regex + entropy)
- 📊 **Health Score** — 0-100 ağırlıklı skor (security, quality, docs, tests, deps)
- 🎯 **Skills Sistemi** — 16 built-in skill, özel skill kurulabilir
- 🔧 **Git Entegrasyonu** — diff audit, blame context, pre-commit hook
- 📦 **Plugin Ekosistemi** — npm-style extensibility
- 🖥️ **Cross-platform** — Windows / Mac / Linux
- ☁️ **Tamamen local** — API key yok, cloud yok, telemetry yok

## Kurulum

### Submodule olarak ekle

```bash
git submodule add https://github.com/dorukmemk/muctehid .mcp/muctehid
cd .mcp/muctehid
npm install
npm run build
```

### IDE konfigürasyonu

**Cursor / Claude Desktop** — `.cursor/mcp.json` veya `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "muctehid": {
      "command": "node",
      "args": [".mcp/muctehid/dist/index.js"],
      "env": {
        "REPO_ROOT": ".",
        "AUDIT_DATA_DIR": ".audit-data"
      }
    }
  }
}
```

### İlk kullanım

```
index_codebase          ← repoyu indexle
health_score            ← 0-100 skor al
list_skills             ← skill'leri listele
run_skill("security-audit", { path: "src/" })
```

## Tools (52 — v2.0.0)

### Orchestrator (3)
| Tool | Açıklama |
|------|----------|
| `analyze_complexity` | İstek karmaşıklığını analiz et (trivial→epic) |
| `route_task` | Adım adım yürütme planı oluştur |
| `suggest_skill` | İstek için en uygun skill öner |

### Spec / Kiro-mode (5)
| Tool | Açıklama |
|------|----------|
| `spec_init` | Yeni spec workflow başlat |
| `spec_list` | Spec'leri listele |
| `spec_get` | Spec detaylarını getir |
| `spec_update_status` | Spec aşamasını güncelle |
| `spec_generate` | requirements / design / tasks üret |

### Tasks (8)
| Tool | Açıklama |
|------|----------|
| `task_create` | Görev oluştur |
| `task_list` | Görevleri filtrele |
| `task_get` | Görev detayı |
| `task_update` | Durum/öncelik güncelle |
| `task_delete` | Görevi sil |
| `task_timeline` | Görev zaman çizelgesi |
| `task_next` | Sonraki yapılabilir görevler |
| `task_progress` | İlerleme özeti + kritik yol |

### Research (2)
| Tool | Açıklama |
|------|----------|
| `research_topic` | Anti-hallüsinasyon araştırma |
| `verify_claim` | İddia doğrulama |

### Templates (3)
| Tool | Açıklama |
|------|----------|
| `template_list` | Şablonları listele |
| `template_render` | Şablon render et |
| `template_save` | Yeni şablon kaydet |

## Tools (30 — v1)

### Memory (6)
| Tool | Açıklama |
|------|----------|
| `index_codebase` | Dizini hybrid BM25+vector memory'ye indexle |
| `search_code` | Semantic + keyword arama |
| `add_memory` | Manuel not/context ekle |
| `get_context` | Dosya için indexli context getir |
| `memory_stats` | Index istatistikleri |
| `clear_memory` | Tüm indexi sıfırla |

### Audit (8)
| Tool | Açıklama |
|------|----------|
| `audit_file` | Tek dosya tam güvenlik + kalite analizi |
| `audit_diff` | Uncommitted git değişikliklerini denetle |
| `security_scan` | OWASP Top 10 pattern taraması |
| `find_secrets` | API key ve secret tespiti |
| `find_todos` | TODO/FIXME/HACK comment bul |
| `complexity_score` | Cyclomatic complexity analizi |
| `dependency_audit` | npm/pip bağımlılık riski |
| `health_score` | Repo genel sağlık skoru (0-100) |

### Skills (6)
| Tool | Açıklama |
|------|----------|
| `list_skills` | Mevcut skill'leri listele |
| `run_skill` | Skill çalıştır |
| `install_skill` | Dizinden skill kur |
| `remove_skill` | Skill kaldır |
| `skill_info` | Skill detayları |
| `create_skill` | Skill template oluştur |

### Git (5)
| Tool | Açıklama |
|------|----------|
| `git_diff_audit` | Uncommitted değişiklikleri denetle |
| `git_blame_context` | Dosya için git blame |
| `pre_commit_check` | Pre-commit güvenlik kapısı |
| `commit_history_search` | Commit mesajlarında arama |
| `install_hooks` | Pre-commit/push hook kur |

### Reports (3)
| Tool | Açıklama |
|------|----------|
| `generate_report` | Tam audit raporu (markdown + JSON) |
| `export_report` | markdown/json/html olarak export |
| `compare_reports` | İki raporu karşılaştır |

### Context (2)
| Tool | Açıklama |
|------|----------|
| `find_references` | Sembol kullanımlarını bul |
| `get_dependencies` | Import/dependency grafiği |

## Built-in Skills (16)

| Skill | Kategori | Ne yapıyor |
|-------|----------|------------|
| `security-audit` | security | OWASP Top 10, secret tespiti |
| `code-review` | quality | Kod kalitesi, best practices |
| `refactor-suggest` | quality | Yeniden yapılandırma önerileri |
| `test-generator` | testing | Birim test scaffolding |
| `doc-generator` | docs | JSDoc/docstring üretimi |
| `performance-audit` | performance | Bottleneck tespiti |
| `dependency-risk` | security | Paket güvenlik analizi |
| `license-scan` | compliance | Lisans uyumluluk kontrolü |
| `accessibility-check` | quality | WCAG a11y pattern kontrolü |
| `refactor-planner` | quality | Complexity analizi + refactor listesi |
| `doc-analyzer` | docs | Dokümantasyon kapsama analizi |
| `feature-planner` | planning | Spec mode ile özellik planı |
| `bug-reporter` | quality | Root cause + fix önerisi |
| `deep-dive` | quality | 360° dosya/modül analizi |
| `audit-runner` | security | Tam repo denetimi |
| `pitch-deck` | docs | Teknik sunum içeriği |

## Health Score

```
Health Score (0-100)
├── Security     30%  → OWASP ihlalleri, secrets, CVE
├── Quality      25%  → complexity, dead code, patterns
├── Docs         20%  → yorum yoğunluğu
├── Tests        15%  → test dosyası oranı
└── Dependencies 10%  → outdated, vulnerable paketler
```

| Skor | Durum | Aksiyon |
|------|-------|---------|
| 90-100 | Excellent | — |
| 70-89 | Good | Bilgilendirme |
| 50-69 | Needs Attention | Uyarı |
| <50 | Critical | Bloklama (opsiyonel) |

## Konfigürasyon

Repo root'una `.audit-config.json` ekle:

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

| Katman | Paket | Neden |
|--------|-------|-------|
| Runtime | Node.js 20+ / TypeScript | — |
| MCP | `@modelcontextprotocol/sdk` | stdio transport |
| BM25 | `better-sqlite3` + FTS5 | native, proven |
| Vectors | pure TypeScript | sıfır native dep |
| Embeddings | `@xenova/transformers` | ONNX, local, API key yok |
| Config | `zod` | schema validation |
| Git | `simple-git` | cross-platform |

## Plugin Sistemi

```typescript
// my-plugin/index.ts
import { definePlugin } from 'muctehid-mcp/plugins';

export default definePlugin({
  name: '@my-org/my-plugin',
  version: '1.0.0',
  tools: [{
    name: 'my_tool',
    description: 'Custom tool',
    inputSchema: { type: 'object', properties: { path: { type: 'string' } } },
    handler: async ({ path }) => { /* ... */ },
  }],
});
```

## Lisans

MIT — kişisel ve ticari kullanım serbesttir.

---

*Açık kaynak — katkılar beklenir.*

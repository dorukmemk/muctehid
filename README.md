# muctehid-mcp

> Herhangi bir Git reposuna submodule olarak eklenebilen, tam otonom MCP server. Hybrid BM25+vector memory, OWASP güvenlik taraması, Orchestrator, Spec Mode (Kiro-benzeri), Task/Todo sistemi, Research Engine. **Sıfır Python. Sıfır cloud API. Sıfır subprocess.**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-20%2B-green.svg)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://typescriptlang.org)

## Özellikler

- 🔍 **Hybrid Memory** — BM25 (SQLite FTS5) + vector search, RRF fusion ile birleştirilmiş
- 🕸️ **Knowledge Graph** — GitNexus-inspired AST-based code graph, impact analysis, blast radius
- 🧠 **4 Katmanlı Cognitive Memory** — Working (anlık) → Timeline (kısa) → Facts/Notes (uzun) → Global (projeler arası)
- 🤖 **İnsan Gibi Düşünme** — think, predict_change, recall_experience, decide, learn_patterns
- 🔒 **OWASP Top 10** — 15 pattern, fix önerileriyle birlikte
- 🕵️ **Secret Detection** — AWS, GitHub, Stripe, JWT, SSH key tespiti (regex + entropy)
- 📊 **Health Score** — 0-100 ağırlıklı skor (security, quality, docs, tests, deps)
- 🎯 **Skills Sistemi** — 16 built-in skill, özel skill kurulabilir
- 🤖 **Orchestrator** — complexity detection, otomatik skill seçimi, adım adım plan
- 📋 **Spec Mode** — Kiro-benzeri requirements → design → tasks workflow
- ✅ **Task Sistemi** — SQLite-backed, dependency graph, critical path
- 🔬 **Research Engine** — anti-hallüsinasyon guard, claim verification
- 🔧 **Git Entegrasyonu** — diff audit, blame context, pre-commit hook
- 🐍 **Python Desteği** — Tree-sitter tabanlı Python parser (graph tools)
- 🌍 **Cross-Project Memory** — Projeler arası öğrenim ve pattern paylaşımı
- 🖥️ **Cross-platform** — Windows / Mac / Linux
- ☁️ **Tamamen local** — API key yok, cloud yok, telemetry yok

---

## Kurulum

### 1. Submodule olarak ekle

```bash
git submodule add https://github.com/dorukmemk/muctehid .mcp/muctehid
cd .mcp/muctehid
npm install
npm run build
```

> **Not:** `dist/` klasörü `.gitignore`'da olduğu için her klonlamadan sonra `npm run build` gerekir. İlk kurulumda `npm install` bağımlılıkları indirir (~300MB, `@xenova/transformers` ONNX modeli dahil).

---

## IDE Konfigürasyonu

### Cursor

`.cursor/mcp.json` oluştur (proje root'unda):

```json
{
  "mcpServers": {
    "muctehid": {
      "command": "node",
      "args": [".mcp/muctehid/dist/index.js"],
      "env": {
        "REPO_ROOT": "${workspaceFolder}",
        "AUDIT_DATA_DIR": ".audit-data"
      }
    }
  }
}
```

Cursor'da **Settings → MCP** sekmesinden de ekleyebilirsin.

---

### Claude Desktop

`~/.config/claude/claude_desktop_config.json` (Mac/Linux) veya `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "muctehid": {
      "command": "node",
      "args": ["C:/Projects/myrepo/.mcp/muctehid/dist/index.js"],
      "env": {
        "REPO_ROOT": "C:/Projects/myrepo",
        "AUDIT_DATA_DIR": "C:/Projects/myrepo/.audit-data"
      }
    }
  }
}
```

---

### Kiro (AWS AI IDE) — Tam Kurulum + AutoApprove

Kiro, MCP server'ları `.kiro/settings/mcp.json` dosyasıyla yönetir.

**Adım 1 — `.kiro/settings/mcp.json` oluştur:**

```json
{
  "mcpServers": {
    "muctehid": {
      "command": "node",
      "args": [".mcp/muctehid/dist/index.js"],
      "env": {
        "REPO_ROOT": "${workspaceFolder}",
        "AUDIT_DATA_DIR": "${workspaceFolder}/.audit-data"
      },
      "autoApprove": [
        "index_codebase",
        "search_code",
        "add_memory",
        "get_context",
        "memory_stats",
        "clear_memory",
        "audit_file",
        "audit_diff",
        "security_scan",
        "find_secrets",
        "find_todos",
        "complexity_score",
        "dependency_audit",
        "health_score",
        "list_skills",
        "run_skill",
        "install_skill",
        "remove_skill",
        "skill_info",
        "create_skill",
        "git_diff_audit",
        "git_blame_context",
        "pre_commit_check",
        "commit_history_search",
        "install_hooks",
        "generate_report",
        "export_report",
        "compare_reports",
        "find_references",
        "get_dependencies",
        "analyze_complexity",
        "route_task",
        "suggest_skill",
        "spec_init",
        "spec_list",
        "spec_get",
        "spec_update_status",
        "spec_generate",
        "task_create",
        "task_list",
        "task_get",
        "task_update",
        "task_delete",
        "task_timeline",
        "task_next",
        "task_progress",
        "research_topic",
        "verify_claim",
        "template_list",
        "template_render",
        "template_save",
        "timeline_add",
        "timeline_search",
        "timeline_recent",
        "file_note_add",
        "file_note_get",
        "file_note_search",
        "fact_add",
        "fact_search",
        "fact_list",
        "memory_system_stats",
        "think",
        "predict_change",
        "recall_experience",
        "session_briefing",
        "working_memory",
        "decide",
        "memory_consolidate",
        "memory_decay",
        "learn_patterns",
        "global_learn",
        "global_recall",
        "graph_build",
        "impact",
        "graph_context",
        "graph_stats",
        "graph_query",
        "task_board"
      ]
    }
  }
}
```

**Adım 2 — Kiro'yu yeniden başlat** (MCP server'ı yüklemesi için).

**Adım 3 — Bağlantıyı doğrula:**
Kiro'da bir chat aç ve şunu yaz:
```
memory_stats
```
`Chunks: 0 | Files: 0` gibi bir cevap geliyorsa kurulum tamam.

**Adım 4 — İlk kullanım:**
```
index_codebase        ← tüm repoyu memory'ye al
health_score          ← 0-100 skor
list_skills           ← 16 skill listele
```

> **AutoApprove neden önemli?** Tüm tool'ları listeye ekleyince Kiro her araç çağrısında onay sormaz — ajan otomatik akışlarla çalışabilir.

---

### Claude Code (CLI)

`.claude/settings.json` dosyasına ekle:

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

Veya terminal'den direkt:

```bash
claude mcp add muctehid node .mcp/muctehid/dist/index.js \
  --env REPO_ROOT=. \
  --env AUDIT_DATA_DIR=.audit-data
```

---

## Hızlı Başlangıç

```
# 1. Repoyu indexle + knowledge graph oluştur
index_codebase buildGraph=true

# 2. Impact analysis (GitNexus-inspired)
impact target="validateUser" direction="upstream"
# → Shows: 3 direct callers, RISK: MEDIUM

# 3. 360° context
graph_context name="validateUser"
# → Shows: incoming calls, outgoing calls, cluster

# 4. Güvenlik taraması
run_skill("security-audit", { path: "src/" })

# 5. Yeni özellik planla (Spec Mode)
spec_init name="user-auth" description="JWT tabanlı kimlik doğrulama sistemi"
spec_generate specId="SPEC-001_user-auth" phase="requirements"
spec_generate specId="SPEC-001_user-auth" phase="design"
spec_generate specId="SPEC-001_user-auth" phase="tasks"

# 6. Görev yönetimi
task_list
task_next
task_progress

# 7. Araştırma
research_topic topic="authentication best practices"
```

---

## Tools (57+ — v2.1.0)

### 🧠 Cognitive Memory (6) — YENİ
| Tool | Açıklama |
|------|----------|
| `think` | Dosya hakkında tüm bellekleri tarar (notes + timeline + graph + facts) |
| `predict_change` | "Bunu değiştirirsem ne olur?" etki analizi |
| `recall_experience` | Benzer geçmiş deneyimleri hatırla |
| `session_briefing` | Session başı tam briefing |
| `working_memory` | Anlık bellek: hedef, görev, breadcrumb, drift detection |
| `decide` | Karar kayıt (neden + alternatifler) |

### 📝 Enhanced Memory (9) — YENİ
| Tool | Açıklama |
|------|----------|
| `timeline_add/search/recent` | Episodic memory — her işi timestamp ile kaydet |
| `file_note_add/get/search` | Dosya notları — warning, todo, learned |
| `fact_add/search/list` | Bilgi bankası — architecture, security, business, technical |

### 🔧 Memory Maintenance (3) — YENİ
| Tool | Açıklama |
|------|----------|
| `memory_consolidate` | Eski event'leri birleştir (timeline şişmesini önle) |
| `memory_decay` | 90+ günlük kullanılmayan event'leri temizle |
| `learn_patterns` | Hata ve tekrar pattern'lerini tespit et |

### 🌍 Cross-Project Memory (2) — YENİ
| Tool | Açıklama |
|------|----------|
| `global_learn` | Projeler arası öğrenim/pattern kaydet (~/.muctehid/) |
| `global_recall` | Diğer projelerden deneyim ara |

### 🆕 Graph / GitNexus (5)
| Tool | Açıklama |
|------|----------|
| `graph_build` | Knowledge graph oluştur (Tree-sitter AST parsing) |
| `impact` | Blast radius analizi — "bu fonksiyonu değiştirirsem ne kırılır?" |
| `graph_context` | 360° sembol görünümü (incoming/outgoing/cluster) |
| `graph_stats` | Graf istatistikleri |
| `graph_query` | Raw SQL sorguları |

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

### Memory (6)
| Tool | Açıklama |
|------|----------|
| `index_codebase` | Dizini hybrid BM25+vector memory'ye indexle (buildGraph=true ile knowledge graph da oluştur) |
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

---

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

---

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

---

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

---

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
| **Graph** | **`better-sqlite3`** | **SQLite-based knowledge graph** |
| **AST Parser** | **`tree-sitter`** | **TypeScript/JavaScript/Python parsing** |
| **Cross-Project** | **SQLite** | **~/.muctehid/global-memory.db** |

---

## 🆕 GitNexus Integration

müctehid artık GitNexus'un yaptığını yapabiliyor! Kod tabanını **knowledge graph** olarak görüyor ve yapısal ilişkileri anlıyor.

### Özellikler

- **Impact Analysis** — "Bu fonksiyonu değiştirirsem ne kırılır?"
- **360° Context** — Bir sembol için tüm incoming/outgoing ilişkileri
- **Blast Radius** — Risk scoring (LOW, MEDIUM, HIGH, CRITICAL)
- **AST-based** — Tree-sitter ile TypeScript/JavaScript parsing
- **SQLite-backed** — Sıfır external dependency

### Kullanım

```typescript
// 1. Build graph
index_codebase({ path: "src/", buildGraph: true })

// 2. Impact analysis
impact({ target: "validateUser", direction: "upstream" })
// Output:
// TARGET: Function validateUser (src/auth/validate.ts:15)
// UPSTREAM (what depends on this):
//   Depth 1 (WILL BREAK):
//     ✗ handleLogin [CALLS 90%] → src/api/auth.ts:12
//     ✗ handleRegister [CALLS 85%] → src/api/auth.ts:78
//   RISK: MEDIUM — 2 direct callers

// 3. 360° context
graph_context({ name: "validateUser" })
// Output:
// INCOMING (3): handleLogin, handleRegister, UserController
// OUTGOING (2): checkPassword, createSession
// CLUSTER: Authentication (cohesion: 87%)
```

Detaylı dokümantasyon: `GITNEXUS_INTEGRATION.md`

---

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

---

## Sorun Giderme

Yaygın sorunlar ve çözümleri için [TROUBLESHOOTING.md](TROUBLESHOOTING.md) dosyasına bakın.

Özellikle:
- Komutlar 30+ dakika boyunca takılıyorsa
- MCP tool'ları çalışmıyorsa
- Bellek sistemi yavaşsa

---

## Lisans

MIT — kişisel ve ticari kullanım serbesttir.

---

*Açık kaynak — katkılar beklenir.*

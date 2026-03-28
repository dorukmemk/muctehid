# GitNexus Integration Spec — müctehid-mcp

## Amaç

GitNexus'un temel yeteneklerini müctehid-mcp'ye entegre ederek, LLM'lerin kod tabanının yapısal ilişkilerini ve bağlamını daha iyi anlamasını sağlamak.

## Problem

Mevcut durumda müctehid-mcp:
- ✅ Hybrid BM25+vector search ile kod arama yapıyor
- ✅ OWASP güvenlik taraması yapıyor
- ✅ Task/spec yönetimi sağlıyor
- ❌ Kod yapısını (fonksiyon çağrıları, bağımlılıklar, sınıf ilişkileri) **graf olarak** görmüyor
- ❌ "Bu fonksiyonu değiştirirsem ne kırılır?" sorusuna cevap veremiyor
- ❌ Execution flow'ları (process) takip edemiyor
- ❌ Functional cluster'ları (ilişkili kod grupları) tespit edemiyor

GitNexus'un çözdüğü sorunlar:
1. **Knowledge Graph** — Her fonksiyon, sınıf, import ilişkisini graf olarak saklar
2. **Impact Analysis** — "X'i değiştirirsem ne etkilenir?" sorusuna depth-based cevap
3. **Process Detection** — Entry point'lerden başlayarak execution flow'ları çıkarır
4. **Cluster Detection** — Leiden algoritması ile functional modülleri tespit eder
5. **360° Context** — Bir sembol için tüm incoming/outgoing ilişkileri gösterir
6. **Multi-File Rename** — Graf + text search ile güvenli rename

## Hedef Yetenekler

### 1. Knowledge Graph Indexing
```typescript
// Mevcut: index_codebase → BM25 + vector
// Yeni: index_codebase → BM25 + vector + KNOWLEDGE GRAPH

index_codebase({
  path: "src/",
  mode: "hybrid",
  buildGraph: true  // ← YENİ: Tree-sitter ile AST parse + graf oluştur
})
```

**Çıktı:**
- Nodes: Function, Class, Interface, Variable
- Edges: CALLS, IMPORTS, EXTENDS, IMPLEMENTS, MEMBER_OF
- Confidence scores (0.0-1.0)

### 2. Impact Analysis Tool
```typescript
impact({
  target: "UserService.validateUser",
  direction: "upstream",  // veya "downstream"
  maxDepth: 3,
  minConfidence: 0.8
})
```

**Çıktı:**
```
TARGET: Function validateUser (src/services/user.ts:45)

UPSTREAM (what depends on this):
  Depth 1 (WILL BREAK):
    ✗ handleLogin [CALLS 90%] → src/api/auth.ts:12
    ✗ handleRegister [CALLS 85%] → src/api/auth.ts:78
  
  Depth 2 (LIKELY AFFECTED):
    ⚠ authRouter [IMPORTS] → src/routes/auth.ts:5

RISK: HIGH — 2 direct callers, 1 indirect
```

### 3. Process-Grouped Search
```typescript
// Mevcut: search_code → flat results
// Yeni: search_code → process-grouped results

search_code({
  query: "authentication middleware",
  groupByProcess: true  // ← YENİ
})
```

**Çıktı:**
```
PROCESSES:
  1. LoginFlow (priority: 0.042, 7 steps)
     - validateUser (step 2)
     - checkPassword (step 3)
     - createSession (step 5)
  
  2. RegistrationFlow (priority: 0.031, 5 steps)
     - validateUser (step 3)
     - hashPassword (step 4)

DEFINITIONS:
  - AuthConfig (Interface, src/types/auth.ts)
```

### 4. Context Tool Enhancement
```typescript
// Mevcut: get_context → file content
// Yeni: get_context → 360° symbol view

get_context({
  filepath: "src/auth/validate.ts",
  symbol: "validateUser"  // ← YENİ: sembol bazlı context
})
```

**Çıktı:**
```
SYMBOL: Function validateUser
  Location: src/auth/validate.ts:15-42
  Complexity: 8 (medium)

INCOMING (who calls this):
  - handleLogin (src/api/auth.ts:12)
  - handleRegister (src/api/auth.ts:78)
  - UserController (src/controllers/user.ts:23)

OUTGOING (what this calls):
  - checkPassword (src/utils/crypto.ts:5)
  - createSession (src/session/manager.ts:18)

PROCESSES:
  - LoginFlow (step 2/7)
  - RegistrationFlow (step 3/5)

CLUSTER: Authentication (cohesion: 0.87)
```

### 5. Detect Changes (Pre-Commit)
```typescript
// Mevcut: audit_diff → security issues
// Yeni: detect_changes → impact analysis

detect_changes({
  scope: "all"  // veya "staged"
})
```

**Çıktı:**
```
SUMMARY:
  Changed: 12 symbols
  Affected: 3 processes
  Risk: MEDIUM

CHANGED SYMBOLS:
  - validateUser (modified)
  - AuthService (modified)

AFFECTED PROCESSES:
  - LoginFlow (2 steps affected)
  - RegistrationFlow (1 step affected)

RECOMMENDATION:
  ⚠ Run integration tests for auth module
  ⚠ Review handleLogin and handleRegister
```

### 6. Multi-File Rename
```typescript
rename({
  symbol_name: "validateUser",
  new_name: "verifyUser",
  dry_run: true
})
```

**Çıktı:**
```
DRY RUN:
  Files affected: 5
  Total edits: 8
  
  Graph-based (high confidence):
    ✓ src/auth/validate.ts:15 (definition)
    ✓ src/api/auth.ts:12 (call)
    ✓ src/api/auth.ts:78 (call)
  
  Text search (review carefully):
    ? src/docs/api.md:45 (documentation)
    ? src/tests/auth.test.ts:23 (test name)

SAFE TO APPLY: YES (confidence: 0.92)
```

### 7. Cypher Query Tool
```typescript
cypher({
  query: `
    MATCH (c:Community {heuristicLabel: 'Authentication'})<-[:MEMBER_OF]-(fn)
    MATCH (caller)-[r:CALLS]->(fn)
    WHERE r.confidence > 0.8
    RETURN caller.name, fn.name, r.confidence
    ORDER BY r.confidence DESC
  `
})
```

## Teknik Mimari

### Yeni Bileşenler

```
src/lib/graph/
├── graph-builder.ts      # Tree-sitter AST → Graf dönüşümü
├── graph-store.ts        # LadybugDB (KuzuDB fork) entegrasyonu
├── impact-analyzer.ts    # Upstream/downstream analizi
├── process-detector.ts   # Entry point → execution flow
├── cluster-detector.ts   # Leiden community detection
└── cypher-engine.ts      # Cypher query executor

src/tools/
├── graph.ts              # impact, context, rename, cypher tools
└── index.ts              # Tool registry'ye ekle
```

### Veri Modeli (LadybugDB)

```cypher
// Nodes
(:Symbol {uid, name, kind, filepath, startLine, endLine})
(:Community {id, heuristicLabel, cohesion})

// Edges
(:Symbol)-[:CALLS {confidence}]->(:Symbol)
(:Symbol)-[:IMPORTS]->(:Symbol)
(:Symbol)-[:EXTENDS]->(:Symbol)
(:Symbol)-[:IMPLEMENTS]->(:Symbol)
(:Symbol)-[:MEMBER_OF]->(:Community)
```

### Tree-sitter Dil Desteği

**Öncelik 1 (MVP):**
- TypeScript
- JavaScript
- Python

**Öncelik 2:**
- Go
- Rust
- Java

### Performans

- **Indexing:** ~1000 dosya/dakika (paralel parsing)
- **Query:** <100ms (graf sorguları)
- **Storage:** ~5MB/1000 dosya (graf + metadata)

## Implementasyon Planı

### Faz 1: Graf Altyapısı (1 hafta)
- [ ] LadybugDB entegrasyonu
- [ ] Tree-sitter TypeScript/JavaScript parser
- [ ] AST → Graf dönüşümü (CALLS, IMPORTS)
- [ ] `index_codebase` tool'una `buildGraph: true` parametresi

### Faz 2: Impact Analysis (3 gün)
- [ ] Upstream/downstream traversal
- [ ] Confidence scoring
- [ ] `impact` tool implementasyonu

### Faz 3: Process Detection (3 gün)
- [ ] Entry point detection (main, exports, HTTP handlers)
- [ ] Call chain tracing
- [ ] Process-grouped search

### Faz 4: Context Enhancement (2 gün)
- [ ] 360° symbol view
- [ ] Cluster detection (Leiden)
- [ ] `get_context` tool enhancement

### Faz 5: Advanced Tools (1 hafta)
- [ ] `detect_changes` (git diff + impact)
- [ ] `rename` (multi-file)
- [ ] `cypher` (raw query)

### Faz 6: Dil Desteği Genişletme (1 hafta)
- [ ] Python parser
- [ ] Go parser
- [ ] Rust parser

## Başarı Kriterleri

1. **Doğruluk:** Impact analysis %90+ doğruluk (manuel test)
2. **Performans:** 1000 dosya indexing <60 saniye
3. **Kullanılabilirlik:** LLM'ler tool'ları doğru kullanabiliyor (prompt test)
4. **Güvenilirlik:** Rename %95+ güvenli (breaking change yok)

## Riskler ve Mitigasyon

| Risk | Olasılık | Etki | Mitigasyon |
|------|----------|------|------------|
| Tree-sitter parsing hataları | Orta | Yüksek | Fallback: regex-based parsing |
| LadybugDB performans sorunları | Düşük | Yüksek | Connection pooling, lazy loading |
| Dil desteği eksikliği | Yüksek | Orta | Önce TS/JS/Python, sonra diğerleri |
| Büyük repo'larda memory | Orta | Orta | Incremental indexing, pagination |

## Alternatifler

1. **Neo4j kullan** — Daha mature ama external dependency
2. **Sadece AST cache** — Graf yok, her sorguda parse — çok yavaş
3. **LSP kullan** — Daha doğru ama her dil için ayrı LSP server

**Seçim:** LadybugDB — embedded, sıfır config, vector + graf hybrid

## Referanslar

- GitNexus: https://github.com/abhigyanpatwari/GitNexus
- LadybugDB: https://github.com/kuzudb/kuzu (fork)
- Tree-sitter: https://tree-sitter.github.io/tree-sitter/
- Leiden Algorithm: https://www.nature.com/articles/s41598-019-41695-z

---

**Sonraki Adım:** Faz 1 implementasyonu için task breakdown

# GitNexus Integration — müctehid-mcp

## Özet

GitNexus'un knowledge graph yeteneklerini müctehid-mcp'ye entegre ediyoruz. Böylece LLM'ler:
- Kod yapısını **graf olarak** görebilecek
- "Bu fonksiyonu değiştirirsem ne kırılır?" sorusuna cevap verebilecek
- Execution flow'ları takip edebilecek
- Functional cluster'ları tespit edebilecek

## Yeni Tool'lar

### 1. `impact` — Blast Radius Analysis
```typescript
impact({
  target: "UserService.validateUser",
  direction: "upstream",  // ne buna bağlı?
  maxDepth: 3,
  minConfidence: 0.8
})
```

### 2. `context` — 360° Symbol View
```typescript
context({
  name: "validateUser",
  filepath: "src/auth/validate.ts"
})
```

### 3. `detect_changes` — Pre-Commit Impact
```typescript
detect_changes({
  scope: "staged"  // git diff + impact analysis
})
```

### 4. `rename` — Multi-File Safe Rename
```typescript
rename({
  symbol_name: "validateUser",
  new_name: "verifyUser",
  dry_run: true
})
```

### 5. `cypher` — Raw Graph Queries
```typescript
cypher({
  query: "MATCH (fn:Function)-[:CALLS]->(target) WHERE target.name = 'validateUser' RETURN fn"
})
```

### 6. `list_processes` — Execution Flows
```typescript
list_processes({
  minSteps: 3  // en az 3 adımlı flow'lar
})
```

### 7. `list_clusters` — Functional Modules
```typescript
list_clusters({
  minCohesion: 0.7  // en az %70 cohesion
})
```

## Teknik Stack

- **Graf DB:** LadybugDB (embedded, sıfır config)
- **Parser:** Tree-sitter (TypeScript, JavaScript, Python)
- **Clustering:** Leiden algorithm
- **Process Detection:** Entry point heuristics + call chain tracing

## Implementasyon Fazları

### Faz 1: Graf Altyapısı ✅
- LadybugDB entegrasyonu
- Tree-sitter TypeScript/JavaScript parser
- AST → Graf dönüşümü
- `index_codebase` tool'una `buildGraph: true` parametresi

### Faz 2: Impact Analysis 🔄
- Upstream/downstream traversal
- Confidence scoring
- `impact` tool

### Faz 3: Process Detection ⏳
- Entry point detection
- Call chain tracing
- `list_processes` tool

### Faz 4: Context Enhancement ⏳
- 360° symbol view
- Cluster detection
- `context` tool

### Faz 5: Advanced Tools ⏳
- `detect_changes`
- `rename`
- `cypher`

## Kullanım Senaryoları

### Senaryo 1: Refactoring Öncesi Risk Analizi
```
User: "validateUser fonksiyonunu refactor etmek istiyorum, güvenli mi?"

Agent:
1. impact({ target: "validateUser", direction: "upstream" })
2. → 3 direct caller, 2 process affected, RISK: MEDIUM
3. "Önce handleLogin ve handleRegister testlerini çalıştırın"
```

### Senaryo 2: Bug Investigation
```
User: "Login neden çalışmıyor?"

Agent:
1. list_processes({ filter: "login" })
2. → LoginFlow: 7 steps
3. context({ name: "validateUser" })
4. → validateUser calls checkPassword (step 3)
5. "checkPassword'de hata olabilir, kontrol edin"
```

### Senaryo 3: Code Review
```
User: "Bu PR'ı review et"

Agent:
1. detect_changes({ scope: "staged" })
2. → 12 symbols changed, 3 processes affected
3. impact({ target: "AuthService" })
4. → 8 callers, RISK: HIGH
5. "AuthService değişikliği kritik, integration test gerekli"
```

## Başarı Metrikleri

- ✅ Impact analysis %90+ doğruluk
- ✅ 1000 dosya indexing <60 saniye
- ✅ Rename %95+ güvenli
- ✅ LLM tool'ları doğru kullanıyor

## Detaylı Spec

Tam teknik spec: `.plan/gitnexus-integration-spec.md`

---

**Status:** 🚧 In Progress — Faz 1 tamamlandı, Faz 2 devam ediyor

# Enhanced Memory System — Spec

## Problem

Mevcut memory sistemi sadece kod indexleme için kullanılıyor. Müctehid:
- ❌ Önceki işlerini hatırlamıyor
- ❌ Dosyalar hakkında not bırakamıyor
- ❌ Önemli bilgileri tekrar tekrar soruyor
- ❌ Zaman içinde öğrenmiyor

## Çözüm: 3 Katmanlı Memory Sistemi

### 1. Timeline Memory (Episodic Memory)

**Ne:** Her işi zaman damgasıyla kaydeder, vektörel arama ile geçmişe bakar.

**Kullanım:**
```typescript
// Otomatik: Her tool çağrısından sonra
timeline_add({
  action: "refactored UserService.validateUser",
  context: "Changed validation logic to use regex",
  files: ["src/services/user.ts"],
  outcome: "success",
  tags: ["refactor", "validation"]
})

// Sorgulama
timeline_search({
  query: "validation logic changes",
  timeRange: "last 7 days",
  limit: 5
})
// → Returns: Similar past actions with context
```

**Veri Modeli:**
```sql
CREATE TABLE timeline_events (
  id TEXT PRIMARY KEY,
  timestamp INTEGER NOT NULL,
  action TEXT NOT NULL,
  context TEXT,
  files TEXT, -- JSON array
  outcome TEXT, -- success/failure/partial
  tags TEXT, -- JSON array
  embedding BLOB -- Vector for semantic search
)
```

**Tetikleyiciler:**
- Her tool çağrısından sonra otomatik
- Spec task tamamlandığında
- Commit öncesi özet

### 2. File Notes (Semantic Memory)

**Ne:** Dosyalar hakkında notlar, öğrenilen bilgiler, dikkat edilmesi gerekenler.

**Kullanım:**
```typescript
// Not ekleme
file_note_add({
  filepath: "src/services/user.ts",
  note: "validateUser uses regex for email validation. Don't change without updating tests.",
  category: "warning" // info/warning/todo/learned
})

// Not okuma
file_note_get({
  filepath: "src/services/user.ts"
})
// → Returns all notes for this file

// Otomatik: get_context çağrısında notları da göster
```

**Veri Modeli:**
```sql
CREATE TABLE file_notes (
  id TEXT PRIMARY KEY,
  filepath TEXT NOT NULL,
  note TEXT NOT NULL,
  category TEXT, -- info/warning/todo/learned
  timestamp INTEGER NOT NULL,
  embedding BLOB
)

CREATE INDEX idx_file_notes_filepath ON file_notes(filepath);
```

**Tetikleyiciler:**
- Manuel: Agent not bırakır
- Otomatik: Karmaşık refactor sonrası
- Otomatik: Bug fix sonrası ("learned" category)

### 3. Important Facts (Declarative Memory)

**Ne:** Proje hakkında önemli, sık kullanılacak bilgiler.

**Kullanım:**
```typescript
// Fact ekleme
fact_add({
  fact: "API uses JWT tokens with 24h expiration",
  category: "architecture",
  importance: "high"
})

// Fact arama
fact_search({
  query: "authentication",
  minImportance: "medium"
})

// Otomatik: Her session başında önemli fact'leri göster
```

**Veri Modeli:**
```sql
CREATE TABLE important_facts (
  id TEXT PRIMARY KEY,
  fact TEXT NOT NULL,
  category TEXT, -- architecture/security/business/technical
  importance TEXT, -- low/medium/high/critical
  timestamp INTEGER NOT NULL,
  lastUsed INTEGER,
  useCount INTEGER DEFAULT 0,
  embedding BLOB
)
```

**Kategoriler:**
- `architecture` — Sistem mimarisi
- `security` — Güvenlik kuralları
- `business` — İş kuralları
- `technical` — Teknik detaylar

**Tetikleyiciler:**
- Manuel: Agent önemli bilgi öğrendiğinde
- Otomatik: Session başında top 5 fact göster
- Otomatik: İlgili fact'leri tool çağrılarında hatırlat

## Implementasyon

### Yeni Dosyalar

```
src/lib/memory/
├── timeline-memory.ts      # Timeline events
├── file-notes.ts           # File-specific notes
├── important-facts.ts      # Critical knowledge
└── memory-manager.ts       # Unified interface

src/tools/
└── memory-tools.ts         # MCP tools
```

### Yeni Tools (9)

**Timeline (3):**
- `timeline_add` — Add event to timeline
- `timeline_search` — Search past events
- `timeline_recent` — Get recent N events

**File Notes (3):**
- `file_note_add` — Add note to file
- `file_note_get` — Get notes for file
- `file_note_search` — Search across all notes

**Facts (3):**
- `fact_add` — Add important fact
- `fact_search` — Search facts
- `fact_list` — List by category/importance

### Otomatik Entegrasyon

**1. Session Start Hook:**
```typescript
// Her session başında
const topFacts = await fact_search({ minImportance: "high", limit: 5 });
console.log("📌 Important Facts:", topFacts);
```

**2. Tool Execution Hook:**
```typescript
// Her tool çağrısından sonra
await timeline_add({
  action: `${toolName} executed`,
  context: JSON.stringify(args),
  outcome: success ? "success" : "failure"
});
```

**3. get_context Enhancement:**
```typescript
// Dosya context'ine notları ekle
const context = await getFileContext(filepath);
const notes = await file_note_get({ filepath });
return { ...context, notes };
```

## Kullanım Senaryoları

### Senaryo 1: Refactor Sonrası Not

```typescript
// Agent refactor yaptı
refactor("UserService.validateUser");

// Otomatik timeline kaydı
timeline_add({
  action: "refactored UserService.validateUser",
  files: ["src/services/user.ts"],
  outcome: "success"
});

// Manuel not
file_note_add({
  filepath: "src/services/user.ts",
  note: "Validation logic now uses Zod schema. Tests updated.",
  category: "learned"
});
```

### Senaryo 2: Benzer İş Arama

```typescript
// User: "How did we handle validation before?"
timeline_search({
  query: "validation logic",
  timeRange: "last 30 days"
});
// → Returns: Previous validation changes with context
```

### Senaryo 3: Dosya Açarken Notları Göster

```typescript
// Agent dosya açıyor
get_context({ filepath: "src/services/user.ts" });
// → Returns:
// - Code context
// - File notes: "⚠️ validateUser uses regex, don't change without tests"
// - Timeline: Last 3 changes to this file
```

### Senaryo 4: Session Başında Hatırlatma

```typescript
// Session start
fact_list({ importance: "high", limit: 5 });
// → Returns:
// 1. API uses JWT with 24h expiration
// 2. Database migrations must be reversible
// 3. All endpoints require authentication except /health
// 4. Redis cache TTL is 1 hour
// 5. Max file upload size is 10MB
```

## Başarı Kriterleri

1. ✅ Agent önceki işlerini hatırlıyor
2. ✅ Dosyalar hakkında not bırakabiliyor
3. ✅ Önemli bilgileri tekrar sormuyor
4. ✅ Zaman içinde öğreniyor (learned notes)
5. ✅ Session başında context yükleniyor

## Performans

- Timeline: ~1000 event/gün → 365K/yıl → ~50MB
- File Notes: ~100 note/proje → ~1MB
- Facts: ~50 fact/proje → ~100KB
- Vector search: <100ms

## Alternatifler

1. **Tek memory table** — Karmaşık, query zor
2. **External DB (Postgres)** — Dependency artışı
3. **File-based** — Yavaş, vector search yok

**Seçim:** SQLite + 3 ayrı table — basit, hızlı, vector search var

---

**Sonraki Adım:** Implementasyon başlat

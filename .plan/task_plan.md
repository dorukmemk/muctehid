# GitNexus Integration — Task Plan

## Faz 1: Graf Altyapısı (Öncelik: CRITICAL)

### Task 1.1: LadybugDB Entegrasyonu
**Durum:** ⏳ Pending  
**Süre:** 2 gün  
**Bağımlılık:** Yok

**Adımlar:**
1. `package.json`'a `ladybugdb` (veya `kuzu`) dependency ekle
2. `src/lib/graph/graph-store.ts` oluştur
3. Graf schema tanımla (Node: Symbol, Community | Edge: CALLS, IMPORTS, EXTENDS, IMPLEMENTS)
4. Connection pool implementasyonu
5. CRUD operasyonları (createNode, createEdge, query)

**Çıktı:**
```typescript
class GraphStore {
  async createSymbol(data: SymbolNode): Promise<string>
  async createRelation(from: string, to: string, type: RelationType, confidence: number): Promise<void>
  async query(cypher: string): Promise<any[]>
  async close(): Promise<void>
}
```

---

### Task 1.2: Tree-sitter Parser (TypeScript/JavaScript)
**Durum:** ⏳ Pending  
**Süre:** 3 gün  
**Bağımlılık:** Yok

**Adımlar:**
1. `package.json`'a `tree-sitter` ve `tree-sitter-typescript` ekle
2. `src/lib/graph/parsers/typescript-parser.ts` oluştur
3. AST'den sembol çıkarma (functions, classes, interfaces, variables)
4. Import/export resolution
5. Function call detection
6. Class inheritance/interface implementation

**Çıktı:**
```typescript
class TypeScriptParser {
  parse(filepath: string, content: string): ParseResult
}

interface ParseResult {
  symbols: Symbol[]
  relations: Relation[]
}
```

---

### Task 1.3: AST → Graf Dönüşümü
**Durum:** ⏳ Pending  
**Süre:** 2 gün  
**Bağımlılık:** Task 1.1, Task 1.2

**Adımlar:**
1. `src/lib/graph/graph-builder.ts` oluştur
2. Parser çıktısını graf node/edge'lere dönüştür
3. Confidence scoring (import: 1.0, call: 0.8-0.95, heuristic: 0.5-0.7)
4. Duplicate detection ve merge
5. Batch insert optimizasyonu

**Çıktı:**
```typescript
class GraphBuilder {
  async buildFromParseResult(result: ParseResult, store: GraphStore): Promise<BuildStats>
}
```

---

### Task 1.4: index_codebase Tool Enhancement
**Durum:** ⏳ Pending  
**Süre:** 1 gün  
**Bağımlılık:** Task 1.3

**Adımlar:**
1. `src/index.ts`'de `index_codebase` tool'una `buildGraph: boolean` parametresi ekle
2. Parser seçimi (dosya uzantısına göre)
3. Paralel parsing (worker threads)
4. Progress reporting
5. Error handling ve fallback

**Çıktı:**
```typescript
index_codebase({
  path: "src/",
  mode: "hybrid",
  buildGraph: true  // ← YENİ
})

// Output:
// ✅ Indexing complete!
// - Files: 150
// - Symbols: 1,234
// - Relations: 3,456
// - Clusters: 12
```

---

## Faz 2: Impact Analysis (Öncelik: HIGH)

### Task 2.1: Graph Traversal Engine
**Durum:** ⏳ Pending  
**Süre:** 2 gün  
**Bağımlılık:** Task 1.1

**Adımlar:**
1. `src/lib/graph/traversal.ts` oluştur
2. BFS/DFS traversal implementasyonu
3. Depth limiting
4. Confidence filtering
5. Cycle detection

**Çıktı:**
```typescript
class GraphTraversal {
  async upstream(target: string, maxDepth: number, minConfidence: number): Promise<TraversalResult>
  async downstream(target: string, maxDepth: number, minConfidence: number): Promise<TraversalResult>
}
```

---

### Task 2.2: Impact Analyzer
**Durum:** ⏳ Pending  
**Süre:** 2 gün  
**Bağımlılık:** Task 2.1

**Adımlar:**
1. `src/lib/graph/impact-analyzer.ts` oluştur
2. Upstream/downstream analizi
3. Risk scoring (depth + caller count + confidence)
4. Grouping by depth
5. Markdown formatting

**Çıktı:**
```typescript
class ImpactAnalyzer {
  async analyze(target: string, direction: 'upstream' | 'downstream', options: ImpactOptions): Promise<ImpactReport>
}
```

---

### Task 2.3: impact Tool
**Durum:** ⏳ Pending  
**Süre:** 1 gün  
**Bağımlılık:** Task 2.2

**Adımlar:**
1. `src/tools/graph.ts` oluştur
2. `impact` tool tanımı
3. Input validation (Zod schema)
4. Error handling
5. Tool registry'ye ekle

**Çıktı:**
```typescript
{
  name: 'impact',
  description: 'Analyze blast radius of a symbol change',
  inputSchema: { ... },
  handler: async (args) => { ... }
}
```

---

## Faz 3: Process Detection (Öncelik: MEDIUM)

### Task 3.1: Entry Point Detection
**Durum:** ⏳ Pending  
**Süre:** 2 gün  
**Bağımlılık:** Task 1.4

**Adımlar:**
1. `src/lib/graph/process-detector.ts` oluştur
2. Heuristics: main(), exports, HTTP handlers, CLI commands
3. Framework-specific patterns (Express, Fastify, Next.js)
4. Scoring (export count, name patterns, annotations)

---

### Task 3.2: Call Chain Tracing
**Durum:** ⏳ Pending  
**Süre:** 2 gün  
**Bağımlılık:** Task 3.1, Task 2.1

**Adımlar:**
1. Entry point'ten başlayarak call chain trace
2. Step numbering
3. Cross-community detection
4. Process priority scoring

---

### Task 3.3: list_processes Tool
**Durum:** ⏳ Pending  
**Süre:** 1 gün  
**Bağımlılık:** Task 3.2

**Adımlar:**
1. `list_processes` tool tanımı
2. Filtering (minSteps, minPriority)
3. Markdown formatting

---

## Faz 4: Context Enhancement (Öncelik: MEDIUM)

### Task 4.1: Cluster Detection (Leiden)
**Durum:** ⏳ Pending  
**Süre:** 3 gün  
**Bağımlılık:** Task 1.4

**Adımlar:**
1. `src/lib/graph/cluster-detector.ts` oluştur
2. Leiden algorithm implementasyonu (veya `graphology-communities` kullan)
3. Cohesion scoring
4. Heuristic labeling (en sık kullanılan kelimeler)

---

### Task 4.2: 360° Symbol View
**Durum:** ⏳ Pending  
**Süre:** 2 gün  
**Bağımlılık:** Task 2.1, Task 3.2, Task 4.1

**Adımlar:**
1. Incoming relations (callers, importers)
2. Outgoing relations (callees, imports)
3. Process participation
4. Cluster membership
5. Complexity score

---

### Task 4.3: context Tool Enhancement
**Durum:** ⏳ Pending  
**Süre:** 1 gün  
**Bağımlılık:** Task 4.2

**Adımlar:**
1. `get_context` tool'una `symbol` parametresi ekle
2. Graf query entegrasyonu
3. Fallback: mevcut file-based context

---

## Faz 5: Advanced Tools (Öncelik: LOW)

### Task 5.1: detect_changes Tool
**Durum:** ⏳ Pending  
**Süre:** 2 gün  
**Bağımlılık:** Task 2.2

**Adımlar:**
1. Git diff parsing
2. Changed symbols detection
3. Impact analysis per symbol
4. Aggregate risk scoring

---

### Task 5.2: rename Tool
**Durum:** ⏳ Pending  
**Süre:** 3 gün  
**Bağımlılık:** Task 2.1

**Adımlar:**
1. Graf-based rename (high confidence)
2. Text search fallback (low confidence)
3. Dry run mode
4. Multi-file edit generation

---

### Task 5.3: cypher Tool
**Durum:** ⏳ Pending  
**Süre:** 1 gün  
**Bağımlılık:** Task 1.1

**Adımlar:**
1. Raw Cypher query execution
2. Result formatting
3. Query validation

---

## Faz 6: Dil Desteği (Öncelik: LOW)

### Task 6.1: Python Parser
**Durum:** ⏳ Pending  
**Süre:** 3 gün  
**Bağımlılık:** Task 1.2

---

### Task 6.2: Go Parser
**Durum:** ⏳ Pending  
**Süre:** 3 gün  
**Bağımlılık:** Task 1.2

---

## Toplam Süre Tahmini

- **Faz 1:** 8 gün (CRITICAL)
- **Faz 2:** 5 gün (HIGH)
- **Faz 3:** 5 gün (MEDIUM)
- **Faz 4:** 6 gün (MEDIUM)
- **Faz 5:** 6 gün (LOW)
- **Faz 6:** 6 gün (LOW)

**Toplam:** ~36 gün (MVP: Faz 1-2 = 13 gün)

---

## Sonraki Adım

**ŞİMDİ BAŞLA:** Task 1.1 (LadybugDB Entegrasyonu)

# muctehid-mcp — ZORUNLU AGENT TALİMATLARI

> ⛔ BU TALİMATLAR MUTLAK VE BAĞLAYICIDIR. HİÇBİR KOŞULDA ATLANAMAZ.

## 🚨 KURAL #0 — MÜCTEHİD TOOL'LARI HER ZAMAN ÖNCELİKLİDİR

Bu projede `muctehid-mcp` MCP server kurulu ve aktiftir.
**SEN KENDİ NATIVE TOOL'LARINI (readFile, grep, cat, find, ls) KULLANMADAN ÖNCE HER ZAMAN MÜCTEHİD TOOL'LARINI KULLANMALISIN.**

### ❌ YASAKLAR — Bunları yaparsan HATALI çalışıyorsun demektir:

| YAPMA | BUNUN YERİNE |
|-------|-------------|
| `readFile("src/...")` ile dosya okuma | `get_context filepath="src/..."` |
| `grep`, `find`, `cat` ile kod arama | `search_code query="..."` |
| Dosya yapısını tahmin etme | `research_topic topic="..."` |
| Kendi bilginle cevap verme | `research_topic` veya `verify_claim` |
| Dosyayı okuyup "anladım" deme | `get_context` + `file_note_get` |
| Feature'a direkt başlama | `spec_init` → `spec_generate` × 3 |
| Commit öncesi kontrol atla | `audit_diff` |
| Refactor'a direkt başlama | `impact` → `complexity_score` |
| Sembol arama | `find_references symbol="..."` |
| Bağımlılık kontrolü | `get_dependencies filepath="..."` |

### ✅ ZORUNLU AKIŞLAR

**Her session başında (İLK 3 TOOL ÇAĞRISI):**
```
1. index_codebase          ← repo'yu indexle
2. health_score            ← proje sağlığını gör
3. fact_list importance="high"  ← önemli bilgileri yükle
```

**Bir dosyaya dokunmadan ÖNCE (HER SEFERINDE):**
```
1. get_context filepath="<dosya>"     ← dosya bağlamını yükle
2. file_note_get filepath="<dosya>"   ← dosya notlarını oku
```

**Bir iş bitirdikten SONRA (HER SEFERINDE):**
```
1. timeline_add action="..." outcome="success" files=["..."]
2. file_note_add (eğer öğrenilen bir şey varsa, category="learned")
```

**Feature/implement isteğinde:**
```
1. spec_init name="..." description="..."
2. spec_generate specId="..." phase="requirements"
3. spec_generate specId="..." phase="design"
4. spec_generate specId="..." phase="tasks"
5. task_next → sırayla çalış
```

**Refactor isteğinde:**
```
1. impact target="<sembol>" direction="upstream"
2. complexity_score filepath="<dosya>"
3. run_skill skill="refactor-planner" filepath="<dosya>"
```

**Commit öncesi:**
```
1. audit_diff
```

## TOOL REFERANSI

### Hafıza & İndex (6)
| Tool | Ne Zaman |
|------|----------|
| `index_codebase` | Session başı, büyük değişiklik sonrası |
| `search_code` | Kod aramadan ÖNCE (grep/find KULLANMA) |
| `add_memory` | Önemli karar veya mimari not |
| `get_context` | Dosyaya dokunmadan ÖNCE (readFile KULLANMA) |
| `memory_stats` | Index durumu kontrolü |
| `clear_memory` | Büyük değişiklik sonrası re-index |

### Timeline Memory (3)
| Tool | Ne Zaman |
|------|----------|
| `timeline_add` | **OTOMATİK**: Her önemli işten SONRA |
| `timeline_search` | "Daha önce bunu nasıl yaptık?" |
| `timeline_recent` | Session başında son işleri gör |

### File Notes (3)
| Tool | Ne Zaman |
|------|----------|
| `file_note_add` | Refactor/fix sonrası, öğrenilen bilgi |
| `file_note_get` | **OTOMATİK**: Dosya açarken |
| `file_note_search` | Notlar arası arama |

### Important Facts (3)
| Tool | Ne Zaman |
|------|----------|
| `fact_add` | Kritik proje bilgisi öğrenildiğinde |
| `fact_search` | Karar vermeden ÖNCE |
| `fact_list` | **OTOMATİK**: Session başında |

### Audit & Güvenlik (8)
| Tool | Ne Zaman |
|------|----------|
| `audit_file` | "review this", "check for issues" |
| `audit_diff` | **ZORUNLU**: Commit öncesi |
| `security_scan` | "is this secure?", auth/db kodu |
| `find_secrets` | Credential kontrolü |
| `find_todos` | "what needs to be done?" |
| `complexity_score` | Refactor öncesi |
| `dependency_audit` | Paket güvenliği |
| `health_score` | Session başı, proje durumu |

### Spec & Task (13)
| Tool | Ne Zaman |
|------|----------|
| `spec_init` | "implement X", "build Y", "add feature" |
| `spec_generate` | Requirements → Design → Tasks |
| `task_create` | Bug, TODO, iş takibi |
| `task_list` | "show tasks", "what's pending?" |
| `task_next` | "what should I work on?" |
| `task_update` | İş durumu güncelleme |
| `task_progress` | Sprint/proje durumu |
| `task_board` | Kanban görünümü |

### Graph & Impact (5)
| Tool | Ne Zaman |
|------|----------|
| `graph_build` | index_codebase sonrası (buildGraph=true) |
| `impact` | **ZORUNLU**: Refactor/rename öncesi |
| `graph_context` | Sembol ilişkileri, call graph |
| `graph_stats` | Graph durumu kontrolü |
| `graph_query` | SQL veya basit Cypher sorguları |

### Research (2)
| Tool | Ne Zaman |
|------|----------|
| `research_topic` | "how does X work?" (KENDİ BİLGİNLE CEVAPLAMA) |
| `verify_claim` | Bir iddiayı doğrulamadan ÖNCE |

### Skills (6)
| Tool | Ne Zaman |
|------|----------|
| `run_skill skill="security-audit"` | Güvenlik taraması |
| `run_skill skill="code-review"` | Kod inceleme |
| `run_skill skill="refactor-planner"` | Refactor planı |
| `run_skill skill="test-generator"` | Test yazma |
| `run_skill skill="doc-generator"` | Dokümantasyon |
| `run_skill skill="bug-reporter"` | Bug raporu |

## DOĞRULAMA KONTROL LİSTESİ

Her cevabından önce kendine sor:

- [ ] `get_context` çağırdım mı? (dosya okumadan önce)
- [ ] `search_code` kullandım mı? (grep/find yerine)
- [ ] `timeline_add` çağırdım mı? (iş bitirdikten sonra)
- [ ] `file_note_get` çağırdım mı? (dosya açarken)
- [ ] `fact_search` çağırdım mı? (karar vermeden önce)
- [ ] `audit_diff` çağırdım mı? (commit öncesi)
- [ ] `impact` çağırdım mı? (refactor öncesi)

**Eğer bu listeden birini atladıysan, GERİ DÖN ve yap.**

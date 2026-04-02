# muctehid-mcp — ZORUNLU AGENT TALİMATLARI

> ⛔ BU TALİMATLAR MUTLAK VE BAĞLAYICIDIR. HİÇBİR KOŞULDA ATLANAMAZ.

## 🚨 KURAL #0 — MÜCTEHİD TOOL'LARI HER ZAMAN ÖNCELİKLİDİR

Bu projede `muctehid-mcp` MCP server kurulu ve aktiftir.
**SEN KENDİ NATIVE TOOL'LARINI (readFile, grep, cat, find, ls) KULLANMADAN ÖNCE HER ZAMAN MÜCTEHİD TOOL'LARINI KULLANMALISIN.**

### ❌ YASAKLAR

| YAPMA | BUNUN YERİNE |
|-------|-------------|
| `readFile("src/...")` ile dosya okuma | `think filepath="src/..."` veya `get_context` |
| `grep`, `find`, `cat` ile kod arama | `search_code query="..."` |
| Dosya yapısını tahmin etme | `research_topic topic="..."` |
| Kendi bilginle cevap verme | `research_topic` veya `verify_claim` |
| Feature'a direkt başlama | `spec_init` → `spec_generate` × 3 |
| Commit öncesi kontrol atla | `audit_diff` |
| Refactor'a direkt başlama | `impact` → `predict_change` |
| Sembol arama | `find_references symbol="..."` |
| Bağımlılık kontrolü | `get_dependencies filepath="..."` |
| Karar vermeden geçme | `decide what="..." why="..."` |

## ✅ ZORUNLU AKIŞLAR

### Session Başı (İLK 3 ÇAĞRI)
```
1. index_codebase                    ← repo'yu indexle
2. session_briefing                  ← tam briefing (facts + timeline + TODOs + warnings + stats)
3. working_memory action="set_goal"  ← kullanıcının isteğini hedef olarak kaydet
```

### Dosyaya Dokunmadan ÖNCE
```
1. think filepath="<dosya>"                              ← tüm bellekleri tarar
2. predict_change filepath="<dosya>" description="..."   ← etki analizi
```

### İş Bitirdikten SONRA
```
1. timeline_add action="..." outcome="success" files=[...]
2. file_note_add (öğrenilen bilgi varsa, category="learned")
3. working_memory action="breadcrumb" value="<ne yaptın>"
```

### Karar Verirken
```
1. recall_experience task="<ne yapacaksın>"
2. fact_search query="<konu>"
3. decide what="<karar>" why="<neden>" alternatives=[...]
```

### Feature/Implement İsteğinde
```
1. spec_init → spec_generate (requirements → design → tasks)
2. task_next → sırayla çalış
```

### Refactor İsteğinde
```
1. impact target="<sembol>" direction="upstream"
2. predict_change filepath="<dosya>" description="..."
3. complexity_score filepath="<dosya>"
```

### Commit Öncesi
```
1. audit_diff
2. memory_consolidate (opsiyonel, çok event varsa)
```

### Session Sonu
```
1. learn_patterns type="both"        ← hata/tekrar pattern'lerini tespit et
2. memory_consolidate olderThanDays=3 ← eski event'leri birleştir
3. global_learn (önemli öğrenim varsa)
```

## TOOL REFERANSI (27 Memory + 30 Diğer = 57+ Tool)

### 🧠 Cognitive Tools (6) — İNSAN GİBİ DÜŞÜNME
| Tool | Ne Zaman |
|------|----------|
| `think` | **ZORUNLU**: Dosya düzenlemeden ÖNCE |
| `predict_change` | **ZORUNLU**: Değişiklik yapmadan ÖNCE |
| `recall_experience` | Görev başlamadan ÖNCE |
| `session_briefing` | **ZORUNLU**: Session başında |
| `working_memory` | Hedef/görev/breadcrumb/drift |
| `decide` | Karar verirken (neden + alternatifler) |

### 📝 Timeline Memory (3)
| Tool | Ne Zaman |
|------|----------|
| `timeline_add` | **OTOMATİK**: Her işten SONRA |
| `timeline_search` | "Daha önce bunu nasıl yaptık?" |
| `timeline_recent` | Son işleri gör |

### 📎 File Notes (3)
| Tool | Ne Zaman |
|------|----------|
| `file_note_add` | Refactor/fix sonrası |
| `file_note_get` | Dosya açarken |
| `file_note_search` | Notlar arası arama |

### 📌 Important Facts (3)
| Tool | Ne Zaman |
|------|----------|
| `fact_add` | Kritik bilgi öğrenildiğinde |
| `fact_search` | Karar vermeden ÖNCE |
| `fact_list` | Session başında |

### 🔧 Memory Maintenance (3)
| Tool | Ne Zaman |
|------|----------|
| `memory_consolidate` | Session sonu, eski event'leri birleştir |
| `memory_decay` | Aylık, 90+ günlük event'leri temizle |
| `learn_patterns` | Session sonu, hata/tekrar pattern'leri |

### 🌍 Cross-Project Memory (2)
| Tool | Ne Zaman |
|------|----------|
| `global_learn` | Projeler arası öğrenim kaydet |
| `global_recall` | Diğer projelerden deneyim ara |

### 📊 Memory Stats (1)
| Tool | Ne Zaman |
|------|----------|
| `memory_system_stats` | Bellek durumu kontrolü |

### 🔍 Hafıza & İndex (6)
| Tool | Ne Zaman |
|------|----------|
| `index_codebase` | Session başı |
| `search_code` | Kod arama (grep KULLANMA) |
| `add_memory` | Mimari not |
| `get_context` | Dosya bağlamı |
| `memory_stats` | Index durumu |
| `clear_memory` | Re-index |

### 🛡️ Audit & Güvenlik (8)
| Tool | Ne Zaman |
|------|----------|
| `audit_file` | Dosya inceleme |
| `audit_diff` | **ZORUNLU**: Commit öncesi |
| `security_scan` | Güvenlik taraması |
| `find_secrets` | Credential kontrolü |
| `find_todos` | TODO/FIXME bul |
| `complexity_score` | Refactor öncesi |
| `dependency_audit` | Paket güvenliği |
| `health_score` | Proje sağlığı |

### 📋 Spec & Task (13)
| Tool | Ne Zaman |
|------|----------|
| `spec_init` | Feature başlat |
| `spec_generate` | Requirements → Design → Tasks |
| `task_create/list/get/update/delete` | Görev yönetimi |
| `task_next` | Sonraki görev |
| `task_progress` | İlerleme |
| `task_board` | Kanban |

### 🕸️ Graph & Impact (5)
| Tool | Ne Zaman |
|------|----------|
| `graph_build` | index_codebase sonrası |
| `impact` | **ZORUNLU**: Refactor öncesi |
| `graph_context` | Sembol ilişkileri |
| `graph_stats` | Graph durumu |
| `graph_query` | SQL/Cypher sorguları |

### 🔬 Research (2)
| Tool | Ne Zaman |
|------|----------|
| `research_topic` | Konu araştırma |
| `verify_claim` | İddia doğrulama |

### 🎯 Skills (6)
| Tool | Ne Zaman |
|------|----------|
| `run_skill skill="security-audit"` | Güvenlik |
| `run_skill skill="code-review"` | Kod inceleme |
| `run_skill skill="refactor-planner"` | Refactor planı |
| `run_skill skill="test-generator"` | Test yazma |
| `run_skill skill="doc-generator"` | Dokümantasyon |
| `run_skill skill="bug-reporter"` | Bug raporu |

## DOĞRULAMA KONTROL LİSTESİ

- [ ] `think` çağırdım mı? (dosya düzenlemeden önce)
- [ ] `predict_change` çağırdım mı? (değişiklik yapmadan önce)
- [ ] `recall_experience` çağırdım mı? (görev başlamadan önce)
- [ ] `session_briefing` çağırdım mı? (session başında)
- [ ] `timeline_add` çağırdım mı? (iş bitirdikten sonra)
- [ ] `decide` çağırdım mı? (önemli karar verirken)
- [ ] `working_memory breadcrumb` çağırdım mı? (her adımda)
- [ ] `audit_diff` çağırdım mı? (commit öncesi)
- [ ] `impact` çağırdım mı? (refactor öncesi)
- [ ] `global_learn` çağırdım mı? (önemli öğrenim varsa)

**Eğer bu listeden birini atladıysan, GERİ DÖN ve yap.**

## ⚠️ KOMUT ÇALIŞTIRMA KURALLARI

### Uzun Süren Komutlar (Watch/Server Mode)

| Komut Tipi | YANLIŞ ❌ | DOĞRU ✅ |
|------------|----------|---------|
| Dev server | `executePwsh("npm run dev")` | `controlPwshProcess(action="start", command="npm run dev")` |
| Watch mode | `executePwsh("tsc --watch")` | `controlPwshProcess(action="start", command="tsc --watch")` |
| MCP server | `executePwsh("npm start")` | `controlPwshProcess(action="start", command="npm start")` |
| Test watch | `executePwsh("npm test")` | `executePwsh("npm run test:run")` veya timeout ekle |

### Timeout Kuralları

```typescript
// Kısa komutlar (build, lint, test) → 60 saniye timeout
executePwsh({
  command: "npm run build",
  timeout: 60000
})

// Orta komutlar (install, audit) → 120 saniye timeout
executePwsh({
  command: "npm install",
  timeout: 120000
})

// Uzun komutlar → controlPwshProcess kullan
controlPwshProcess({
  action: "start",
  command: "npm run dev"
})
```

### Yasaklı Komutlar (executePwsh ile)

- `npm run dev` (watch mode)
- `npm start` (server mode)
- `tsc --watch` (watch mode)
- `jest --watch` (watch mode)
- `nodemon` (watch mode)
- Herhangi bir `--watch` parametreli komut

### Sorun Giderme

Eğer bir komut 30+ dakika boyunca "devam ediyor" durumunda kalıyorsa:

1. Komut watch/server mode'da mı? → `controlPwshProcess` kullan
2. Timeout eklenmiş mi? → `timeout: 60000` ekle
3. Komut çıkış kodu dönüyor mu? → Komutu kontrol et
4. Arka planda bir şey bekliyor mu? → `listProcesses` ile kontrol et

**HATIRLA: Watch mode komutları ASLA `executePwsh` ile çalıştırma!**

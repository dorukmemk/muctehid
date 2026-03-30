---
inclusion: always
---

# muctehid-mcp Zorunlu Kullanım Kuralları

Bu projede `muctehid-mcp` MCP server aktiftir (27 bellek + 30 diğer = 57+ tool).

## MUTLAK KURALLAR

1. **Dosya düzenlemeden önce** → `think filepath="..."` (tüm bellekleri tarar)
2. **Değişiklik yapmadan önce** → `predict_change filepath="..." description="..."` (etki analizi)
3. **Kod aramadan önce** → `search_code query="..."` (grep/grepSearch KULLANMA)
4. **Feature başlatırken** → `spec_init` → `spec_generate` akışı
5. **Her iş bitiminde** → `timeline_add` + `working_memory breadcrumb`
6. **Session başında** → `session_briefing` (facts + timeline + TODOs + warnings)
7. **Refactor öncesi** → `impact` + `predict_change`
8. **Commit öncesi** → `audit_diff`
9. **Karar verirken** → `recall_experience` + `decide`
10. **Session sonunda** → `learn_patterns` + `memory_consolidate`

## 4 Katmanlı Bellek Sistemi

| Katman | Tool'lar | Süre |
|--------|----------|------|
| Anlık (Working) | `working_memory`, `decide` | Session boyunca |
| Kısa süreli (Timeline) | `timeline_add/search/recent` | Günler-haftalar |
| Uzun süreli (Facts+Notes) | `fact_add/search`, `file_note_add/get` | Kalıcı |
| Projeler arası (Global) | `global_learn`, `global_recall` | Tüm projeler |

## Cognitive Tools (İnsan Gibi Düşünme)

| Tool | İnsan Karşılığı |
|------|-----------------|
| `think` | Dosya açınca "ne biliyordum?" diye hatırlama |
| `predict_change` | "Bunu değiştirirsem ne bozulur?" düşünme |
| `recall_experience` | "Daha önce benzer bir şey yapmıştım" hatırlama |
| `session_briefing` | İşe başlarken "dün ne yapmıştım?" özeti |
| `decide` | Karar verirken neden + alternatifleri kaydetme |
| `learn_patterns` | Tekrarlayan hatalardan ders çıkarma |

## MCP Tool Eşleştirmesi

- Dosya anlama → `think` (readFile değil)
- Kod arama → `search_code` (grep değil)
- Referans bulma → `find_references` (grepSearch değil)
- Etki analizi → `predict_change` + `impact`
- Konu araştırma → `research_topic` (kendi bilginle cevaplama)
- Güvenlik → `audit_file`, `security_scan`, `find_secrets`
- Kalite → `complexity_score`, `health_score`
- Deneyim → `recall_experience`, `global_recall`

## Detaylı talimatlar için: #[[file:AGENTS.md]]

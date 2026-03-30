---
inclusion: always
---

# muctehid-mcp Zorunlu Kullanım Kuralları

Bu projede `muctehid-mcp` MCP server aktiftir. Tüm kod analizi, arama, dosya anlama işlemleri için müctehid tool'larını kullanmalısın.

## MUTLAK KURALLAR

1. **Dosya okumadan önce** → `get_context` MCP tool'unu çağır (readFile kullanma)
2. **Kod aramadan önce** → `search_code` MCP tool'unu çağır (grep kullanma)
3. **Feature başlatırken** → `spec_init` → `spec_generate` akışını takip et
4. **Her iş bitiminde** → `timeline_add` ile kaydet
5. **Dosya açarken** → `file_note_get` ile notları oku
6. **Session başında** → `fact_list` ile önemli bilgileri yükle
7. **Refactor öncesi** → `impact` ile blast radius analizi yap
8. **Commit öncesi** → `audit_diff` çalıştır

## MCP Tool Eşleştirmesi

- Dosya anlama → `get_context` (readFile değil)
- Kod arama → `search_code` (grep/grepSearch değil)
- Referans bulma → `find_references` (grepSearch değil)
- Bağımlılık → `get_dependencies` (readFile değil)
- Konu araştırma → `research_topic` (kendi bilginle cevaplama)
- Güvenlik → `audit_file`, `security_scan`, `find_secrets`
- Kalite → `complexity_score`, `health_score`

## Detaylı talimatlar için: #[[file:AGENTS.md]]

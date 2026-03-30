# muctehid-mcp — Claude Code Talimatları

Bu projede `muctehid-mcp` MCP server aktiftir. KENDİ TOOL'LARINI KULLANMA, müctehid tool'larını kullan.

## YASAKLAR
- ❌ `cat`, `grep`, `find`, `ls` ile kod okuma/arama → `search_code`, `get_context` kullan
- ❌ Dosya yapısını tahmin etme → `research_topic` kullan
- ❌ Feature'a direkt başlama → `spec_init` akışını takip et
- ❌ Commit öncesi kontrol atlama → `audit_diff` çalıştır
- ❌ Refactor'a direkt başlama → `impact` analizi yap

## SESSION BAŞI (İLK 3 ÇAĞRI)
1. `index_codebase`
2. `health_score`
3. `fact_list importance="high"`

## DOSYAYA DOKUNMADAN ÖNCE
1. `get_context filepath="<dosya>"`
2. `file_note_get filepath="<dosya>"`

## İŞ BİTİRDİKTEN SONRA
1. `timeline_add action="..." outcome="success"`
2. `file_note_add` (öğrenilen bilgi varsa)

## Detaylı talimatlar: AGENTS.md

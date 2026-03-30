# muctehid-mcp — Claude Code Talimatları

Bu projede `muctehid-mcp` MCP server aktiftir (57+ tool). KENDİ TOOL'LARINI KULLANMA.

## YASAKLAR
- ❌ `cat/grep/find/ls` → `search_code`, `think`, `get_context`
- ❌ Dosya yapısını tahmin → `research_topic`
- ❌ Feature'a direkt başla → `spec_init` akışı
- ❌ Commit öncesi atla → `audit_diff`
- ❌ Refactor'a direkt başla → `impact` + `predict_change`
- ❌ Karar vermeden geç → `decide`

## SESSION BAŞI
1. `index_codebase`
2. `session_briefing` ← tam briefing (facts + timeline + TODOs + warnings)
3. `working_memory action="set_goal" value="<istek>"`

## DOSYAYA DOKUNMADAN ÖNCE
1. `think filepath="<dosya>"` ← tüm bellekleri tarar
2. `predict_change filepath="<dosya>" description="<ne yapacaksın>"`

## İŞ BİTİRDİKTEN SONRA
1. `timeline_add action="..." outcome="success" files=[...]`
2. `working_memory action="breadcrumb" value="<ne yaptın>"`
3. `file_note_add` (öğrenilen bilgi varsa, category="learned")

## KARAR VERİRKEN
1. `recall_experience task="<konu>"`
2. `decide what="<karar>" why="<neden>"`

## SESSION SONU
1. `learn_patterns type="both"`
2. `memory_consolidate`
3. `global_learn` (önemli öğrenim varsa)

## 4 KATMANLI BELLEK: Working → Timeline → Facts/Notes → Global
## Detaylı: AGENTS.md

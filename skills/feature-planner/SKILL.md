---
name: feature-planner
version: 1.0.0
description: Yeni özellik planı oluşturur — Kiro-style spec (requirements → design → tasks) ile mini-promptlar
category: planning
autoTrigger:
  - "feature plan"
  - "özellik planla"
  - "spec oluştur"
  - "spec mode"
  - "requirements"
  - "gereksinim"
requiredTools:
  - spec_init
  - spec_update
  - task_create
  - search_code
  - get_context
outputFormat: markdown
estimatedMinutes: 5
---

# Feature Planner

## Amaç
Kullanıcı isteğini alarak tam bir spec workflow oluştur: requirements.md → design.md → tasks.md

## Adımlar

1. **Anlama** — `search_code` ve `get_context` ile mevcut kod yapısını anla
2. **Requirements** — `spec_init` ile workflow başlat, user story'leri çıkar
3. **Design** — Mimari kararları belge, bileşen listesi oluştur
4. **Tasks** — Her task için mini-prompt yaz, bağımlılıkları belirle
5. **Onay** — Kullanıcıya spec'i göster, geri bildirim iste

## Çıktı

Spec dosyaları oluşturulur:
- `.specs/{name}/requirements.md`
- `.specs/{name}/design.md`
- `.specs/{name}/tasks.md`

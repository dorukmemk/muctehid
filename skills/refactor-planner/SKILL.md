---
name: refactor-planner
version: 1.0.0
description: Yeniden yapılandırma planı oluşturur — complexity analizi, dead code tespiti, bağımlılık grafiği ile öncelikli refactor listesi çıkarır
category: quality
autoTrigger:
  - "refactor"
  - "yeniden yapılandır"
  - "temizle"
  - "clean up"
  - "technical debt"
requiredTools:
  - complexity_score
  - find_references
  - get_dependencies
  - search_code
outputFormat: markdown
estimatedMinutes: 3
---

# Refactor Planner

## Amaç
Verilen dosya veya dizin için kapsamlı bir refactoring planı çıkar.

## Adımlar

1. **Complexity Analizi** — `complexity_score` ile cyclomatic complexity haritası
2. **Dead Code** — `find_references` ile kullanılmayan sembolleri tespit et
3. **Bağımlılık Grafiği** — `get_dependencies` ile circular dependency ara
4. **Refactor Listesi** — Önceliğe göre sırala (complexity > dead code > style)
5. **Mini Prompt'lar** — Her refactor için uygulama talimatı yaz

## Çıktı Formatı

```
## Refactor Planı: {path}

### 🔴 Kritik (Hemen)
- [ ] T-001: {dosya}:{satır} — {sorun} ({complexity} CC)
  **Mini Prompt:** {uygulama talimatı}

### 🟡 Yüksek Öncelik
...

### 🟢 İyileştirme
...

## Tahmini Süre: {toplam} saat
```

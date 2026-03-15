---
name: pitch-deck
version: 1.0.0
description: Proje için teknik pitch deck içeriği oluşturur — mimari özet, özellik listesi, sağlık skoru, roadmap
category: docs
autoTrigger:
  - "pitch"
  - "sunum"
  - "presentation"
  - "proje özeti"
  - "pitch deck"
  - "demo"
requiredTools:
  - health_score
  - memory_stats
  - list_skills
  - generate_report
outputFormat: markdown
estimatedMinutes: 3
---

# Pitch Deck Generator

## Amaç
Projeyi paydaşlara veya takıma sunmak için yapılandırılmış içerik üret.

## Adımlar

1. **Proje Özeti** — Amaç, hedef kitle, temel özellikler
2. **Mimari** — Tech stack, veri akışı, güvenlik modeli
3. **Sağlık Skoru** — `health_score` ile güncel durum
4. **Özellik Listesi** — `list_skills` + tools inventory
5. **Roadmap** — Mevcut özellikler vs planlanmış (task listesinden)
6. **Demo Senaryoları** — Komut örnekleri, kullanım akışları

## Çıktı

Slayt başlıkları ve içerikleri markdown formatında:

```
# Slide 1: Proje Adı
## Slide 2: Problem
## Slide 3: Çözüm
## Slide 4: Mimari
## Slide 5: Özellikler
## Slide 6: Sağlık Durumu
## Slide 7: Roadmap
## Slide 8: Demo
```

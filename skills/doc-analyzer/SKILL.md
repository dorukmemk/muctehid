---
name: doc-analyzer
version: 1.0.0
description: Kod dokümantasyonu analizi — JSDoc/docstring kapsama, README kalitesi, API doc eksikliklerini bulur
category: docs
autoTrigger:
  - "dokümantasyon"
  - "documentation"
  - "jsdoc"
  - "docstring"
  - "readme"
  - "api docs"
requiredTools:
  - audit_file
  - search_code
  - health_score
outputFormat: markdown
estimatedMinutes: 2
---

# Doc Analyzer

## Amaç
Projenin dokümantasyon kalitesini analiz et ve eksiklikleri raporla.

## Adımlar

1. **Kapsama Taraması** — Public fonksiyon/class'ları bul, JSDoc/docstring var mı kontrol et
2. **README Kalitesi** — Installation, Usage, API sections mevcut mu?
3. **API Doc** — Export edilen sembollerin dokümantasyon yoğunluğu
4. **Eksik Listesi** — Belgelenmemiş semboller
5. **Otomatik Öneriler** — doc-generator skill'i ile üretilebilecek doc'ları işaretle

## Çıktı

```
## Dokümantasyon Raporu

- **Kapsama:** %{oran}
- **Belgelenmemiş Semboller:** {sayı}

### Kritik Eksikler
- `{sembol}` ({dosya}:{satır}) — {öneri}

### README Durumu: {✅/❌} {bölüm}
```

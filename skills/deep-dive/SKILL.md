---
name: deep-dive
version: 1.0.0
description: Bir dosya veya modül hakkında derin analiz — mimari, bağımlılıklar, test kapsamı, güvenlik, kalite skoru
category: quality
autoTrigger:
  - "deep dive"
  - "derin analiz"
  - "modül analizi"
  - "incele"
  - "analyze"
requiredTools:
  - audit_file
  - complexity_score
  - find_references
  - get_dependencies
  - git_blame_context
  - security_scan
  - find_secrets
outputFormat: markdown
estimatedMinutes: 4
---

# Deep Dive

## Amaç
Tek bir dosya veya modül hakkında 360° analiz raporu üret.

## Adımlar

1. **Kod Kalitesi** — `complexity_score`, `audit_file`
2. **Güvenlik** — `security_scan`, `find_secrets`
3. **Bağımlılıklar** — `get_dependencies`, `find_references`
4. **Git Geçmişi** — `git_blame_context` ile change frequency
5. **Test Kapsamı** — Test dosyası var mı, test oranı
6. **Özet Skor** — Her boyutta 0-10 skor, ağırlıklı toplam

## Çıktı

```
## Deep Dive: {dosya}

| Boyut | Skor | Detay |
|-------|------|-------|
| Kalite | {x}/10 | |
| Güvenlik | {x}/10 | |
| Testler | {x}/10 | |
| Bağımlılıklar | {x}/10 | |
| Değişim Sıklığı | {x}/10 | |

**Genel: {toplam}/10**

### Kritik Bulgular
...
```

## Output Depth

| Parameter | Behavior |
|-----------|----------|
| `depth: shallow` (default) | Summary: issue count, top 3 findings, recommendations |
| `depth: deep` | Full analysis: every finding with code excerpt, detailed fix steps, related CWE/OWASP refs |

To save output as .md file: `run_skill skill="deep-dive" path="src/" depth="deep" save=true`

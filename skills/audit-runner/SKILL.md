---
name: audit-runner
version: 1.0.0
description: Kapsamlı tam repo denetimi — OWASP, secret, kalite, bağımlılık, lisans taraması; health score ile öncelikli aksiyon listesi
category: security
autoTrigger:
  - "full audit"
  - "tam denetim"
  - "kapsamlı tarama"
  - "audit all"
  - "tüm repo tara"
requiredTools:
  - security_scan
  - find_secrets
  - dependency_audit
  - health_score
  - generate_report
  - find_todos
outputFormat: markdown
estimatedMinutes: 8
---

# Audit Runner

## Amaç
Reponun tamamını denetle, öncelikli aksiyon planı çıkar, rapor üret.

## Adımlar

1. **Güvenlik** — `security_scan` tüm kaynak dosyalar
2. **Sırlar** — `find_secrets` ile API key / credential tespiti
3. **Bağımlılıklar** — `dependency_audit` npm/pip paketleri
4. **Kalite** — `find_todos`, complexity hotspot'ları
5. **Skor** — `health_score` ile ağırlıklı değerlendirme
6. **Rapor** — `generate_report` ile markdown + JSON export

## Çıktı Formatı

Tam audit raporu (markdown) + aksiyon özeti:
- 🔴 Kritik bulgular (bloklanmalı)
- 🟡 Yüksek öncelik (1 sprint içinde)
- 🟢 İyileştirme önerileri

## Output Depth

| Parameter | Behavior |
|-----------|----------|
| `depth: shallow` (default) | Summary: issue count, top 3 findings, recommendations |
| `depth: deep` | Full analysis: every finding with code excerpt, detailed fix steps, related CWE/OWASP refs |

To save output as .md file: `run_skill skill="audit-runner" path="src/" depth="deep" save=true`

---
name: bug-reporter
version: 1.0.0
description: Hata raporu oluşturur — stack trace analizi, root cause tespiti, fix önerisi ve task oluşturma
category: quality
autoTrigger:
  - "bug"
  - "hata"
  - "error"
  - "exception"
  - "crash"
  - "fix"
  - "düzelt"
requiredTools:
  - audit_file
  - security_scan
  - git_blame_context
  - task_create
  - search_code
outputFormat: markdown
estimatedMinutes: 2
---

# Bug Reporter

## Amaç
Verilen hata veya semptom için kapsamlı bug raporu ve fix planı oluştur.

## Adımlar

1. **Hata Analizi** — Stack trace veya symptom'dan root cause bul
2. **Kod Bağlamı** — `git_blame_context` ile hangi commit'te girdi bul
3. **İlgili Kod** — `search_code` ile aynı pattern'i kullanan diğer yerleri bul
4. **Güvenlik Etkisi** — `security_scan` ile güvenlik boyutu var mı kontrol et
5. **Fix Önerisi** — Minimal, güvenli fix yaz
6. **Task** — `task_create` ile bug task'ı kaydet

## Çıktı

```
## Bug Raporu: {başlık}

**Severity:** {critical/high/medium/low}
**Root Cause:** {açıklama}
**Etkilenen Dosyalar:** {liste}
**Fix Önerisi:** {kod veya adımlar}
**Regression Risk:** {düşük/orta/yüksek}
```

---
name: RAPOR_TEMPLATE
version: 2.0.0
description: Structured bug/audit report template
variables: [title, severity, date, repoPath, summary, rootCause, affectedFiles, fix, taskId]
---

# {{title}}

**Tarih:** {{date}}
**Önem:** {{severity}}
**Repo:** `{{repoPath}}`
{{#if taskId}}**Task:** {{taskId}}{{/if}}

---

## Özet

{{summary}}

---

## Kök Neden Analizi

{{rootCause}}

---

## Etkilenen Dosyalar

{{#each affectedFiles}}- `{{this}}`
{{/each}}

---

## Önerilen Düzeltme

{{fix}}

---

## Zaman Çizelgesi

{{#each timeline}}- **{{timestamp}}** — {{event}}: {{detail}}
{{/each}}

---

*muctehid-mcp tarafından oluşturuldu — {{date}}*

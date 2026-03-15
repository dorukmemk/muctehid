---
name: TASK_TEMPLATE
version: 2.0.0
description: Individual task card template
variables: [taskId, title, status, priority, category, filepath, description, miniPrompt, dependsOn, references, timeline]
---

## {{status_emoji}} {{title}}

**ID:** {{taskId}} | **Öncelik:** {{priority}} | **Kategori:** {{category}}
**Durum:** {{status}} | **Tarih:** {{date}}

{{#if filepath}}
**Dosya:** `{{filepath}}`
{{/if}}

{{#if specId}}
**Spec:** {{specId}} → {{specTaskRef}}
{{/if}}

---

### Açıklama
{{description}}

{{#if miniPrompt}}
### Mini Prompt
```
{{miniPrompt}}
```
{{/if}}

{{#if dependsOn}}
### Bağımlılıklar
{{#each dependsOn}}- {{this}}
{{/each}}
{{/if}}

{{#if references}}
### Referanslar
{{#each references}}- [{{label}}]({{target}}){{#if line}} (satır {{line}}){{/if}}
{{/each}}
{{/if}}

### Zaman Çizelgesi
{{#each timeline}}- **{{event}}** — {{detail}} ({{timestamp}})
{{/each}}

---

*muctehid-mcp Task Manager*

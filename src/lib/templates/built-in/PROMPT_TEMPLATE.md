---
name: PROMPT_TEMPLATE
version: 2.0.0
description: Standardized mini-prompt template for agent task execution
variables: [taskTitle, taskDescription, context, acceptanceCriteria, affectedFiles, tools, constraints]
---

## Görev: {{taskTitle}}

### Bağlam
{{context}}

### Ne Yapılacak
{{taskDescription}}

### İlgili Dosyalar
{{#each affectedFiles}}- `{{this}}`
{{/each}}

### Kabul Kriterleri
{{#each acceptanceCriteria}}- [ ] {{this}}
{{/each}}

{{#if constraints}}
### Kısıtlar
{{#each constraints}}- {{this}}
{{/each}}
{{/if}}

### Kullanılabilir Tool'lar
{{tools}}

---
*Bu prompt muctehid-mcp tarafından otomatik oluşturuldu.*

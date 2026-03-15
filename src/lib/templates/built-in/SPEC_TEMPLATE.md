---
name: SPEC_TEMPLATE
version: 2.0.0
description: Full spec template with requirements, design, and tasks sections
variables: [specName, specId, date, overview, userStories, components, taskList]
---

# Spec: {{specName}}

**ID:** {{specId}}
**Tarih:** {{date}}
**Durum:** Taslak

---

## 1. Gereksinimler

### Genel Bakış
{{overview}}

### Kullanıcı Hikayeleri

| ID | Rol | İstek | Amaç | Öncelik |
|----|-----|-------|------|---------|
{{#each userStories}}| {{id}} | {{asA}} | {{iWant}} | {{soThat}} | {{priority}} |
{{/each}}

### Kapsam Dışı
{{outOfScope}}

### Varsayımlar
{{assumptions}}

---

## 2. Teknik Tasarım

### Mimari
{{architecture}}

### Bileşenler

{{#each components}}
#### {{name}}
- **Dosya:** `{{filePath}}`
- **Sorumluluk:** {{responsibility}}
- **Bağımlılıklar:** {{dependencies}}

{{/each}}

### Açık Sorular
{{openQuestions}}

---

## 3. Görevler

| ID | Başlık | Hikaye | Tahmin | Bağımlılık | Durum |
|----|--------|--------|--------|------------|-------|
{{#each taskList}}| {{id}} | {{title}} | {{storyRef}} | {{estimateHours}}s | {{dependsOn}} | {{status}} |
{{/each}}

---

*muctehid-mcp Spec Engine — {{date}}*

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { SpecWorkflow, SpecStatus } from '../../types/v2.js';
import { render } from '../templates/template-engine.js';

export class SpecEngine {
  private specsDir: string;
  private indexPath: string;
  private workflows: Map<string, SpecWorkflow> = new Map();

  constructor(dataDir: string) {
    this.specsDir = path.join(dataDir, 'specs');
    this.indexPath = path.join(this.specsDir, 'index.json');
    fs.mkdirSync(this.specsDir, { recursive: true });
    this.load();
  }

  private load(): void {
    if (!fs.existsSync(this.indexPath)) return;
    try {
      const arr = JSON.parse(fs.readFileSync(this.indexPath, 'utf-8')) as SpecWorkflow[];
      for (const w of arr) this.workflows.set(w.id, w);
    } catch { /* start fresh */ }
  }

  private save(): void {
    fs.writeFileSync(this.indexPath, JSON.stringify(Array.from(this.workflows.values()), null, 2));
  }

  create(name: string, description: string, repoRoot: string): SpecWorkflow {
    const id = `SPEC-${String(this.workflows.size + 1).padStart(3, '0')}_${name.replace(/[^a-z0-9]/gi, '-').slice(0, 30)}`;
    const specDir = path.join(this.specsDir, id);
    fs.mkdirSync(specDir, { recursive: true });

    const workflow: SpecWorkflow = {
      id,
      name,
      description,
      status: 'requirements',
      repoRoot,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      requirementsPath: path.join(specDir, 'requirements.md'),
      designPath: path.join(specDir, 'design.md'),
      tasksPath: path.join(specDir, 'tasks.md'),
      taskIds: [],
    };

    this.workflows.set(id, workflow);
    this.save();
    return workflow;
  }

  writeRequirements(specId: string, content: string): void {
    const workflow = this.getOrThrow(specId);
    fs.writeFileSync(workflow.requirementsPath, content, 'utf-8');
    this.updateStatus(specId, 'requirements');
  }

  writeDesign(specId: string, content: string): void {
    const workflow = this.getOrThrow(specId);
    fs.writeFileSync(workflow.designPath, content, 'utf-8');
    this.updateStatus(specId, 'design');
  }

  writeTasks(specId: string, content: string): void {
    const workflow = this.getOrThrow(specId);
    fs.writeFileSync(workflow.tasksPath, content, 'utf-8');
    this.updateStatus(specId, 'tasks');
  }

  generateRequirementsContent(name: string, description: string, codebaseContext: string): string {
    const date = new Date().toISOString().slice(0, 10);
    return `# Requirements: ${name}

**Tarih:** ${date}
**Açıklama:** ${description}

---

## Genel Bakış

${description}

## Codebase Bağlamı

${codebaseContext.slice(0, 1000)}

---

## Kullanıcı Hikayeleri

| ID | Rol | İstek | Amaç | Öncelik |
|----|-----|-------|------|---------|
| US-001 | geliştirici | [tanımlanacak] | [tanımlanacak] | must |

---

## Kapsam Dışı

- [tanımlanacak]

## Varsayımlar

- [tanımlanacak]

## Açık Sorular

- [tanımlanacak]

---

*muctehid-mcp Spec Engine — ${date}*
`;
  }

  generateDesignContent(specId: string, requirementsContent: string): string {
    const workflow = this.getOrThrow(specId);
    const date = new Date().toISOString().slice(0, 10);
    return `# Teknik Tasarım: ${workflow.name}

**Tarih:** ${date}
**Spec:** ${specId}

---

## Mimari

[Mevcut requirements.md'den türetilecek]

## Bileşenler

| Bileşen | Dosya | Sorumluluk |
|---------|-------|------------|
| [tanımlanacak] | [tanımlanacak] | [tanımlanacak] |

## Veri Modelleri

[tanımlanacak]

## API Kontratları

[tanımlanacak]

## Açık Sorular

[tanımlanacak]

---

*muctehid-mcp Spec Engine — ${date}*
`;
  }

  generateTasksContent(specId: string, phaseName: string, phases: string[]): string {
    const workflow = this.getOrThrow(specId);
    const date = new Date().toISOString().slice(0, 10);
    let content = `# Görev Listesi: ${workflow.name}

**Tarih:** ${date}
**Spec:** ${specId}

---

## Görevler

`;
    phases.forEach((phase, i) => {
      const tid = `T-${String(i + 1).padStart(3, '0')}`;
      content += `### ${tid} | ${phase}

**Durum:** ⏳ Bekliyor
**Öncelik:** Yüksek
**Spec:** ${specId}

**Mini Prompt:**
\`\`\`
${phase} görevini tamamla.
Önce oku: ${workflow.requirementsPath}
Sonra: ${workflow.designPath}
Hedef: Bölüm ${i + 1}/${phases.length} tamamlandı, breaking change yok.
\`\`\`

---

`;
    });

    return content + `*muctehid-mcp Spec Engine — ${date}*\n`;
  }

  get(id: string): SpecWorkflow | undefined {
    return this.workflows.get(id);
  }

  list(): SpecWorkflow[] {
    return Array.from(this.workflows.values());
  }

  updateStatus(id: string, status: SpecStatus): void {
    const w = this.workflows.get(id);
    if (!w) return;
    w.status = status;
    w.updatedAt = Date.now();
    this.save();
  }

  private getOrThrow(id: string): SpecWorkflow {
    const w = this.workflows.get(id);
    if (!w) throw new Error(`Spec "${id}" not found`);
    return w;
  }
}

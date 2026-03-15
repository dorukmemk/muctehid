import * as fs from 'fs';
import * as path from 'path';
import matter from 'gray-matter';
import { TemplateDefinition } from '../../types/v2.js';

export class TemplateRegistry {
  private templates: Map<string, TemplateDefinition> = new Map();
  private dirs: string[];

  constructor(dirs: string[]) {
    this.dirs = dirs;
    this.load();
  }

  private load(): void {
    for (const dir of this.dirs) {
      if (!fs.existsSync(dir)) continue;
      const entries = fs.readdirSync(dir).filter(f => f.endsWith('.md'));
      for (const entry of entries) {
        const filePath = path.join(dir, entry);
        try {
          const raw = fs.readFileSync(filePath, 'utf-8');
          const { data, content } = matter(raw);
          if (!data.name) continue;
          const variables = [...content.matchAll(/\{\{(\w+)\}\}/g)].map(m => m[1]);
          this.templates.set(data.name as string, {
            name: data.name as string,
            path: filePath,
            description: (data.description as string) ?? '',
            version: (data.version as string) ?? '1.0.0',
            variables: [...new Set(variables)],
          });
        } catch { /* skip */ }
      }
    }
  }

  get(name: string): TemplateDefinition | undefined {
    return this.templates.get(name);
  }

  list(): TemplateDefinition[] {
    return Array.from(this.templates.values());
  }

  register(def: TemplateDefinition): void {
    this.templates.set(def.name, def);
  }

  reload(): void {
    this.templates.clear();
    this.load();
  }
}

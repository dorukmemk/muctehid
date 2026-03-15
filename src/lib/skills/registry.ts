import * as fs from 'fs';
import * as path from 'path';
import { SkillDefinition } from '../../types/index.js';
import { parseSkill } from './parser.js';

export class SkillRegistry {
  private skills: Map<string, SkillDefinition> = new Map();
  private skillDirs: string[] = [];

  constructor(skillDirs: string[]) {
    this.skillDirs = skillDirs;
    this.load();
  }

  private load(): void {
    for (const dir of this.skillDirs) {
      if (!fs.existsSync(dir)) continue;
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const skillDir = path.join(dir, entry.name);
        const skill = parseSkill(skillDir);
        if (skill) {
          this.skills.set(skill.name, skill);
        }
      }
    }
  }

  reload(): void {
    this.skills.clear();
    this.load();
  }

  get(name: string): SkillDefinition | undefined {
    return this.skills.get(name);
  }

  list(): SkillDefinition[] {
    return Array.from(this.skills.values());
  }

  register(skill: SkillDefinition): void {
    this.skills.set(skill.name, skill);
  }

  unregister(name: string): boolean {
    return this.skills.delete(name);
  }

  findByTrigger(text: string): SkillDefinition[] {
    const lower = text.toLowerCase();
    return this.list().filter(s =>
      s.triggers.some(t => lower.includes(t.toLowerCase()))
    );
  }
}

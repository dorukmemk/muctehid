import * as fs from 'fs';
import * as path from 'path';
import matter from 'gray-matter';
import { SkillDefinition } from '../../types/index.js';

export function parseSkill(skillDir: string): SkillDefinition | null {
  const skillMdPath = path.join(skillDir, 'SKILL.md');

  if (!fs.existsSync(skillMdPath)) return null;

  try {
    const raw = fs.readFileSync(skillMdPath, 'utf-8');
    const { data, content } = matter(raw);

    return {
      name: String(data.name ?? path.basename(skillDir)),
      version: String(data.version ?? '1.0.0'),
      description: String(data.description ?? ''),
      author: String(data.author ?? 'unknown'),
      category: String(data.category ?? 'general'),
      type: data.type ?? 'tool',
      triggers: Array.isArray(data.triggers) ? data.triggers.map(String) : [],
      tools: Array.isArray(data.tools) ? data.tools.map(String) : [],
      parameters: data.parameters ?? {},
      hooks: data.hooks,
      output: data.output,
      instructions: content.trim(),
      dir: skillDir,
    };
  } catch {
    return null;
  }
}

export function validateSkill(skill: SkillDefinition): string[] {
  const errors: string[] = [];
  if (!skill.name) errors.push('name is required');
  if (!skill.description) errors.push('description is required');
  return errors;
}

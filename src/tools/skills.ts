import { SkillRegistry } from '../lib/skills/registry.js';
import { SkillRunner } from '../lib/skills/runner.js';
import { SkillInstaller } from '../lib/skills/installer.js';
import { SkillDefinition } from '../types/index.js';

export class SkillsManager {
  private runner: SkillRunner;
  private installer: SkillInstaller;

  constructor(public registry: SkillRegistry, installedDir: string) {
    this.runner = new SkillRunner();
    this.installer = new SkillInstaller(installedDir, registry);
  }

  async handleTool(name: string, args: Record<string, unknown>): Promise<string> {
    switch (name) {
      case 'list_skills': {
        const skills = this.registry.list();
        if (skills.length === 0) return 'No skills installed.';
        const rows = skills.map(s =>
          `| \`${s.name}\` | ${s.version} | ${s.category} | ${s.description} |`
        );
        return `## Available Skills (${skills.length})\n\n| Name | Version | Category | Description |\n|------|---------|----------|-------------|\n${rows.join('\n')}`;
      }

      case 'run_skill': {
        const skillName = args.skill as string;
        if (!skillName) throw new Error('skill name is required');
        const skill = this.registry.get(skillName);
        if (!skill) throw new Error(`Skill "${skillName}" not found. Run list_skills to see available skills.`);
        const result = await this.runner.run(skill, args);
        return result.output;
      }

      case 'skill_info': {
        const skillName = args.skill as string;
        const skill = this.registry.get(skillName);
        if (!skill) throw new Error(`Skill "${skillName}" not found.`);
        return formatSkillInfo(skill);
      }

      case 'install_skill': {
        const sourcePath = args.path as string;
        if (!sourcePath) throw new Error('path is required');
        const result = this.installer.install(sourcePath);
        return result.message;
      }

      case 'remove_skill': {
        const skillName = args.skill as string;
        if (!skillName) throw new Error('skill name is required');
        const result = this.installer.uninstall(skillName);
        return result.message;
      }

      case 'create_skill': {
        return createSkillTemplate(args);
      }

      default:
        throw new Error(`Unknown skills tool: ${name}`);
    }
  }
}

function formatSkillInfo(skill: SkillDefinition): string {
  let md = `## Skill: ${skill.name}\n\n`;
  md += `**Version:** ${skill.version}  \n`;
  md += `**Category:** ${skill.category}  \n`;
  md += `**Author:** ${skill.author}  \n`;
  md += `**Description:** ${skill.description}\n\n`;
  if (skill.triggers.length) md += `**Triggers:** ${skill.triggers.join(', ')}\n\n`;
  if (skill.tools.length) md += `**Tools used:** ${skill.tools.join(', ')}\n\n`;
  if (Object.keys(skill.parameters).length) {
    md += `**Parameters:**\n`;
    for (const [k, v] of Object.entries(skill.parameters)) {
      md += `- \`${k}\`: ${v.type}${v.default !== undefined ? ` (default: ${JSON.stringify(v.default)})` : ''}\n`;
    }
    md += '\n';
  }
  if (skill.instructions) md += `**Instructions:**\n${skill.instructions}\n`;
  return md;
}

function createSkillTemplate(args: Record<string, unknown>): string {
  const name = (args.name as string) ?? 'my-skill';
  const description = (args.description as string) ?? 'My custom skill';
  const category = (args.category as string) ?? 'general';

  return `## New Skill Template: ${name}

Create a directory \`skills/${name}/\` with:

### SKILL.md
\`\`\`yaml
---
name: ${name}
version: 1.0.0
description: ${description}
author: your-name
category: ${category}
triggers:
  - "${name}"
tools:
  - audit_file
  - search_code
parameters:
  severity_threshold:
    type: enum
    values: [low, medium, high, critical]
    default: medium
---

## Skill Instructions

Describe what this skill does when invoked...
\`\`\`

Then install with: \`install_skill({ path: "skills/${name}" })\``;
}

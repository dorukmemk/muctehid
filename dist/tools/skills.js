"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SkillsManager = void 0;
const runner_js_1 = require("../lib/skills/runner.js");
const installer_js_1 = require("../lib/skills/installer.js");
class SkillsManager {
    registry;
    runner;
    installer;
    constructor(registry, installedDir) {
        this.registry = registry;
        this.runner = new runner_js_1.SkillRunner();
        this.installer = new installer_js_1.SkillInstaller(installedDir, registry);
    }
    async handleTool(name, args) {
        switch (name) {
            case 'list_skills': {
                const skills = this.registry.list();
                if (skills.length === 0)
                    return 'No skills installed.';
                const rows = skills.map(s => `| \`${s.name}\` | ${s.version} | ${s.category} | ${s.description} |`);
                return `## Available Skills (${skills.length})\n\n| Name | Version | Category | Description |\n|------|---------|----------|-------------|\n${rows.join('\n')}`;
            }
            case 'run_skill': {
                const skillName = args.skill;
                if (!skillName)
                    throw new Error('skill name is required');
                const skill = this.registry.get(skillName);
                if (!skill)
                    throw new Error(`Skill "${skillName}" not found. Run list_skills to see available skills.`);
                const result = await this.runner.run(skill, args);
                return result.output;
            }
            case 'skill_info': {
                const skillName = args.skill;
                const skill = this.registry.get(skillName);
                if (!skill)
                    throw new Error(`Skill "${skillName}" not found.`);
                return formatSkillInfo(skill);
            }
            case 'install_skill': {
                const sourcePath = args.path;
                if (!sourcePath)
                    throw new Error('path is required');
                const result = this.installer.install(sourcePath);
                return result.message;
            }
            case 'remove_skill': {
                const skillName = args.skill;
                if (!skillName)
                    throw new Error('skill name is required');
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
exports.SkillsManager = SkillsManager;
function formatSkillInfo(skill) {
    let md = `## Skill: ${skill.name}\n\n`;
    md += `**Version:** ${skill.version}  \n`;
    md += `**Category:** ${skill.category}  \n`;
    md += `**Author:** ${skill.author}  \n`;
    md += `**Description:** ${skill.description}\n\n`;
    if (skill.triggers.length)
        md += `**Triggers:** ${skill.triggers.join(', ')}\n\n`;
    if (skill.tools.length)
        md += `**Tools used:** ${skill.tools.join(', ')}\n\n`;
    if (Object.keys(skill.parameters).length) {
        md += `**Parameters:**\n`;
        for (const [k, v] of Object.entries(skill.parameters)) {
            md += `- \`${k}\`: ${v.type}${v.default !== undefined ? ` (default: ${JSON.stringify(v.default)})` : ''}\n`;
        }
        md += '\n';
    }
    if (skill.instructions)
        md += `**Instructions:**\n${skill.instructions}\n`;
    return md;
}
function createSkillTemplate(args) {
    const name = args.name ?? 'my-skill';
    const description = args.description ?? 'My custom skill';
    const category = args.category ?? 'general';
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
//# sourceMappingURL=skills.js.map
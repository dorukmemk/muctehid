import * as fs from 'fs';
import * as path from 'path';
import { SkillRegistry } from './registry.js';
import { parseSkill } from './parser.js';

export class SkillInstaller {
  constructor(
    private installedDir: string,
    private registry: SkillRegistry,
  ) {
    fs.mkdirSync(installedDir, { recursive: true });
  }

  install(skillSourceDir: string): { success: boolean; message: string } {
    const skill = parseSkill(skillSourceDir);
    if (!skill) {
      return { success: false, message: `No valid SKILL.md found in ${skillSourceDir}` };
    }

    const destDir = path.join(this.installedDir, skill.name);
    if (fs.existsSync(destDir)) {
      return { success: false, message: `Skill "${skill.name}" is already installed. Use remove first.` };
    }

    try {
      this.copyDir(skillSourceDir, destDir);
      this.registry.register(skill);
      return { success: true, message: `Skill "${skill.name}" v${skill.version} installed successfully.` };
    } catch (e) {
      return { success: false, message: `Installation failed: ${e}` };
    }
  }

  uninstall(name: string): { success: boolean; message: string } {
    const destDir = path.join(this.installedDir, name);
    if (!fs.existsSync(destDir)) {
      return { success: false, message: `Skill "${name}" is not installed.` };
    }

    try {
      fs.rmSync(destDir, { recursive: true });
      this.registry.unregister(name);
      return { success: true, message: `Skill "${name}" removed.` };
    } catch (e) {
      return { success: false, message: `Removal failed: ${e}` };
    }
  }

  private copyDir(src: string, dest: string): void {
    fs.mkdirSync(dest, { recursive: true });
    const entries = fs.readdirSync(src, { withFileTypes: true });
    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);
      if (entry.isDirectory()) this.copyDir(srcPath, destPath);
      else fs.copyFileSync(srcPath, destPath);
    }
  }
}

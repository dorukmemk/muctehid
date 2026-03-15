import * as fs from 'fs';
import * as path from 'path';
import { SkillDefinition, SkillRunOptions, SkillRunResult, AuditIssue } from '../../types/index.js';
import { scanSecurity } from '../audit/security.js';
import { scanQuality } from '../audit/quality.js';
import { scanSecrets } from '../audit/secrets.js';
import { complexityIssues } from '../audit/complexity.js';
import { computeHealthScore } from '../audit/scorer.js';

export class SkillRunner {
  async run(skill: SkillDefinition, opts: SkillRunOptions): Promise<SkillRunResult> {
    const start = Date.now();

    try {
      const output = await this.execute(skill, opts);
      return {
        skill: skill.name,
        success: true,
        output,
        duration: Date.now() - start,
      };
    } catch (e) {
      return {
        skill: skill.name,
        success: false,
        output: `Error running skill "${skill.name}": ${e instanceof Error ? e.message : String(e)}`,
        duration: Date.now() - start,
      };
    }
  }

  private async execute(skill: SkillDefinition, opts: SkillRunOptions): Promise<string> {
    const target = (opts.path ?? opts.filepath ?? opts.file) as string | undefined;

    switch (skill.name) {
      case 'security-audit':
        return this.runSecurityAudit(target, opts);
      case 'code-review':
        return this.runCodeReview(target, opts);
      case 'dependency-risk':
        return this.runDependencyRisk(target, opts);
      case 'performance-audit':
        return this.runPerformanceAudit(target);
      default:
        // Generic: return skill instructions with context
        return this.runGeneric(skill, opts);
    }
  }

  private async runSecurityAudit(target: string | undefined, opts: SkillRunOptions): Promise<string> {
    const issues: AuditIssue[] = [];
    const files = this.resolveFiles(target);

    for (const file of files) {
      try {
        const content = fs.readFileSync(file, 'utf-8');
        issues.push(...scanSecurity(file, content));
        const secrets = scanSecrets(file, content);
        for (const s of secrets) {
          issues.push({
            id: `secret-${s.line}`,
            severity: 'critical',
            category: 'secret',
            title: `Secret: ${s.type}`,
            description: `Potential ${s.type} found`,
            filepath: file,
            line: s.line,
            fix: 'Move to environment variables.',
          });
        }
      } catch { /* skip */ }
    }

    return formatIssuesMarkdown('Security Audit', issues, files.length);
  }

  private async runCodeReview(target: string | undefined, _opts: SkillRunOptions): Promise<string> {
    const issues: AuditIssue[] = [];
    const files = this.resolveFiles(target);

    for (const file of files) {
      try {
        const content = fs.readFileSync(file, 'utf-8');
        issues.push(...scanQuality(file, content));
        issues.push(...complexityIssues(file));
      } catch { /* skip */ }
    }

    return formatIssuesMarkdown('Code Review', issues, files.length);
  }

  private async runDependencyRisk(target: string | undefined, _opts: SkillRunOptions): Promise<string> {
    const pkgPath = target
      ? path.join(target, 'package.json')
      : 'package.json';

    if (!fs.existsSync(pkgPath)) {
      return '## Dependency Risk\n\nNo package.json found.';
    }

    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };
      const count = Object.keys(deps).length;

      let output = `## Dependency Risk Analysis\n\n`;
      output += `**Total dependencies:** ${count}\n\n`;
      output += `**Recommendation:** Run \`npm audit\` for CVE scanning.\n\n`;
      output += `### Dependencies\n\`\`\`\n`;
      output += Object.entries(deps).map(([k, v]) => `${k}: ${v}`).join('\n');
      output += `\n\`\`\`\n`;
      return output;
    } catch {
      return '## Dependency Risk\n\nFailed to parse package.json.';
    }
  }

  private async runPerformanceAudit(target: string | undefined): Promise<string> {
    const patterns = [
      { pattern: /for.*of.*Object\.keys|for.*in\s+/, label: 'Potentially slow object iteration' },
      { pattern: /\.forEach\(.*async/, label: 'async in forEach (use Promise.all + map)' },
      { pattern: /JSON\.parse\(JSON\.stringify/, label: 'Expensive deep clone (use structuredClone)' },
      { pattern: /\+\s*['"`][^'"`]*['"`]\s*\+/, label: 'String concatenation in loop (use template literal)' },
    ];

    const files = this.resolveFiles(target);
    const results: string[] = [];

    for (const file of files) {
      try {
        const lines = fs.readFileSync(file, 'utf-8').split('\n');
        for (let i = 0; i < lines.length; i++) {
          for (const p of patterns) {
            if (p.pattern.test(lines[i])) {
              results.push(`- **${file}:${i + 1}** — ${p.label}`);
            }
          }
        }
      } catch { /* skip */ }
    }

    let output = `## Performance Audit\n\n`;
    output += `**Files analyzed:** ${files.length}\n\n`;
    if (results.length === 0) {
      output += '✅ No obvious performance issues detected.\n';
    } else {
      output += `### Issues Found (${results.length})\n\n${results.join('\n')}\n`;
    }
    return output;
  }

  private async runGeneric(skill: SkillDefinition, opts: SkillRunOptions): Promise<string> {
    return `## ${skill.name}\n\n${skill.instructions}\n\n**Parameters:** ${JSON.stringify(opts, null, 2)}`;
  }

  private resolveFiles(target: string | undefined): string[] {
    if (!target) return [];

    try {
      const stat = fs.statSync(target);
      if (stat.isFile()) return [target];
      if (stat.isDirectory()) {
        return this.walkDir(target);
      }
    } catch { /* target doesn't exist */ }
    return [];
  }

  private walkDir(dir: string): string[] {
    const results: string[] = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'dist') continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) results.push(...this.walkDir(full));
      else if (/\.(ts|tsx|js|jsx|py|go|rs|java|cs)$/.test(entry.name)) results.push(full);
    }
    return results;
  }
}

function formatIssuesMarkdown(title: string, issues: AuditIssue[], fileCount: number): string {
  const critical = issues.filter(i => i.severity === 'critical');
  const high = issues.filter(i => i.severity === 'high');
  const medium = issues.filter(i => i.severity === 'medium');
  const low = issues.filter(i => i.severity === 'low');

  let md = `## ${title}\n\n`;
  md += `**Files analyzed:** ${fileCount} | **Issues:** ${issues.length}`;
  md += ` (🔴 ${critical.length} critical, 🟠 ${high.length} high, 🟡 ${medium.length} medium, ⚪ ${low.length} low)\n\n`;

  if (issues.length === 0) {
    md += '✅ No issues found.\n';
    return md;
  }

  for (const severity of ['critical', 'high', 'medium', 'low'] as const) {
    const group = issues.filter(i => i.severity === severity);
    if (group.length === 0) continue;
    const emoji = { critical: '🔴', high: '🟠', medium: '🟡', low: '⚪' }[severity];
    md += `### ${emoji} ${severity.toUpperCase()} (${group.length})\n\n`;
    for (const issue of group) {
      md += `**${issue.title}**\n`;
      md += `- File: \`${issue.filepath}${issue.line ? ':' + issue.line : ''}\`\n`;
      if (issue.owaspCategory) md += `- OWASP: ${issue.owaspCategory}`;
      if (issue.cwe) md += ` | CWE: ${issue.cwe}`;
      if (issue.owaspCategory || issue.cwe) md += '\n';
      md += `- ${issue.description}\n`;
      if (issue.fix) md += `- **Fix:** ${issue.fix}\n`;
      if (issue.code) md += `\`\`\`\n${issue.code}\n\`\`\`\n`;
      md += '\n';
    }
  }

  return md;
}

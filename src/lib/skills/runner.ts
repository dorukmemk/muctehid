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
      case 'refactor-planner':
        return this.runRefactorPlanner(target);
      case 'doc-analyzer':
        return this.runDocAnalyzer(target);
      case 'feature-planner':
        return this.runGeneric(skill, opts);
      case 'bug-reporter':
        return this.runBugReporter(target, opts);
      case 'deep-dive':
        return this.runDeepDive(target);
      case 'audit-runner':
        return this.runAuditRunner(target, opts);
      case 'pitch-deck':
        return this.runGeneric(skill, opts);
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

  private async runRefactorPlanner(target: string | undefined): Promise<string> {
    const files = this.resolveFiles(target);
    const allIssues: string[] = [];

    for (const file of files) {
      try {
        const issues = complexityIssues(file);
        for (const i of issues) {
          allIssues.push(`- **${file}:${i.line}** — ${i.title} (complexity: ${i.description})`);
        }
      } catch { /* skip */ }
    }

    let output = `## Refactor Planı\n\n**Analiz edilen dosya:** ${files.length}\n\n`;
    if (allIssues.length === 0) {
      output += '✅ Refactor gerektiren kritik bölge bulunamadı.\n';
    } else {
      output += `### 🔴 Yüksek Complexity (${allIssues.length} bölge)\n\n${allIssues.join('\n')}\n\n`;
      output += `### Öneri\nEn yüksek complexity'li fonksiyonları küçük fonksiyonlara böl.\n`;
    }
    return output;
  }

  private async runDocAnalyzer(target: string | undefined): Promise<string> {
    const files = this.resolveFiles(target);
    let documented = 0;
    let total = 0;
    const missing: string[] = [];

    for (const file of files) {
      try {
        const content = fs.readFileSync(file, 'utf-8');
        const fnMatches = [...content.matchAll(/(?:export\s+)?(?:async\s+)?function\s+(\w+)/g)];
        const classMatches = [...content.matchAll(/(?:export\s+)?class\s+(\w+)/g)];
        const symbols = [...fnMatches, ...classMatches];
        total += symbols.length;
        for (const m of symbols) {
          const idx = content.indexOf(m[0]);
          const before = content.slice(Math.max(0, idx - 150), idx);
          if (/\/\*\*[\s\S]*?\*\/\s*$/.test(before) || /\/\/[^\n]*\n\s*$/.test(before)) {
            documented++;
          } else {
            missing.push(`- \`${m[1]}\` in ${file}`);
          }
        }
      } catch { /* skip */ }
    }

    const coverage = total > 0 ? Math.round((documented / total) * 100) : 100;
    let output = `## Dokümantasyon Analizi\n\n`;
    output += `**Kapsama:** %${coverage} (${documented}/${total} sembol)\n\n`;
    if (missing.length > 0) {
      output += `### Belgelenmemiş Semboller (${missing.length})\n${missing.slice(0, 20).join('\n')}\n`;
      if (missing.length > 20) output += `\n... ve ${missing.length - 20} daha.\n`;
    } else {
      output += '✅ Tüm public semboller belgelenmiş.\n';
    }
    return output;
  }

  private async runBugReporter(target: string | undefined, opts: SkillRunOptions): Promise<string> {
    const files = this.resolveFiles(target);
    const issues: AuditIssue[] = [];

    for (const file of files) {
      try {
        const content = fs.readFileSync(file, 'utf-8');
        issues.push(...scanSecurity(file, content));
      } catch { /* skip */ }
    }

    const criticalIssues = issues.filter(i => i.severity === 'critical' || i.severity === 'high');
    let output = `## Bug Raporu\n\n**Taranan dosya:** ${files.length}\n`;
    output += `**Kritik/Yüksek sorun:** ${criticalIssues.length}\n\n`;

    if (criticalIssues.length === 0) {
      output += '✅ Kritik bug pattern bulunmadı.\n';
    } else {
      for (const issue of criticalIssues.slice(0, 10)) {
        output += `### 🔴 ${issue.title}\n`;
        output += `- **Dosya:** \`${issue.filepath}:${issue.line}\`\n`;
        output += `- **Açıklama:** ${issue.description}\n`;
        if (issue.fix) output += `- **Fix:** ${issue.fix}\n`;
        output += '\n';
      }
    }
    return output;
  }

  private async runDeepDive(target: string | undefined): Promise<string> {
    if (!target) return '## Deep Dive\n\nLütfen bir dosya veya dizin belirtin.';
    const files = this.resolveFiles(target);
    const secIssues: AuditIssue[] = [];
    const qualIssues: AuditIssue[] = [];

    for (const file of files) {
      try {
        const content = fs.readFileSync(file, 'utf-8');
        secIssues.push(...scanSecurity(file, content));
        qualIssues.push(...scanQuality(file, content));
      } catch { /* skip */ }
    }

    const secScore = Math.max(0, 10 - Math.floor(secIssues.filter(i => i.severity === 'critical' || i.severity === 'high').length * 2));
    const qualScore = Math.max(0, 10 - Math.floor(qualIssues.length * 0.5));
    const overall = Math.round((secScore + qualScore) / 2);

    let output = `## Deep Dive: ${target}\n\n`;
    output += `| Boyut | Skor | Detay |\n|-------|------|-------|\n`;
    output += `| Güvenlik | ${secScore}/10 | ${secIssues.length} sorun |\n`;
    output += `| Kalite | ${qualScore}/10 | ${qualIssues.length} sorun |\n`;
    output += `\n**Genel: ${overall}/10**\n\n`;

    if (secIssues.filter(i => i.severity === 'critical').length > 0) {
      output += `### 🔴 Kritik Güvenlik Bulguları\n`;
      for (const i of secIssues.filter(x => x.severity === 'critical').slice(0, 5)) {
        output += `- **${i.title}** — \`${i.filepath}:${i.line}\`\n`;
      }
    }
    return output;
  }

  private async runAuditRunner(target: string | undefined, _opts: SkillRunOptions): Promise<string> {
    const files = this.resolveFiles(target);
    const secIssues: AuditIssue[] = [];
    const qualIssues: AuditIssue[] = [];

    for (const file of files) {
      try {
        const content = fs.readFileSync(file, 'utf-8');
        secIssues.push(...scanSecurity(file, content));
        qualIssues.push(...scanQuality(file, content));
      } catch { /* skip */ }
    }

    const critical = secIssues.filter(i => i.severity === 'critical');
    const high = secIssues.filter(i => i.severity === 'high');

    let output = `## Tam Audit Raporu\n\n`;
    output += `**Taranan dosya:** ${files.length}\n`;
    output += `**Güvenlik sorunları:** ${secIssues.length} (🔴 ${critical.length} kritik, 🟠 ${high.length} yüksek)\n`;
    output += `**Kalite sorunları:** ${qualIssues.length}\n\n`;

    if (critical.length > 0) {
      output += `### 🔴 Kritik Sorunlar (BLOKLA)\n\n`;
      for (const i of critical.slice(0, 10)) {
        output += `- **${i.title}** — \`${i.filepath}:${i.line}\`\n  ${i.description}\n`;
      }
      output += '\n';
    }
    if (high.length > 0) {
      output += `### 🟠 Yüksek Öncelik (1 Sprint)\n\n`;
      for (const i of high.slice(0, 10)) {
        output += `- **${i.title}** — \`${i.filepath}:${i.line}\`\n`;
      }
      output += '\n';
    }
    if (secIssues.length === 0 && qualIssues.length === 0) {
      output += '✅ Temiz repo! Önemli sorun bulunamadı.\n';
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

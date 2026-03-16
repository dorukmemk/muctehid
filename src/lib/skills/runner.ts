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
        return this.runRefactorPlanner(target, opts);
      case 'doc-analyzer':
        return this.runDocAnalyzer(target);
      case 'feature-planner':
        return this.runGeneric(skill, opts);
      case 'bug-reporter':
        return this.runBugReporter(target, opts);
      case 'deep-dive':
        return this.runDeepDive(target, opts);
      case 'audit-runner':
        return this.runAuditRunner(target, opts);
      case 'pitch-deck':
        return this.runGeneric(skill, opts);
      case 'deep-planner':
        return this.runDeepPlanner(target, opts);
      case 'session-restore':
        return this.runSessionRestore(target, opts);
      case 'auto-fixer':
        return this.runAutoFixer(target, opts);
      case 'code-archaeologist':
        return this.runCodeArchaeologist(target, opts);
      case 'impact-analyzer':
        return this.runImpactAnalyzer(target, opts);
      default:
        // Generic: return skill instructions with context
        return this.runGeneric(skill, opts);
    }
  }

  // ─── Helper: code context excerpt ────────────────────────────────────────────

  private getCodeContext(filepath: string, line: number | undefined, contextLines = 5): string {
    if (!line) return '';
    try {
      const lines = fs.readFileSync(filepath, 'utf-8').split('\n');
      const start = Math.max(0, line - contextLines - 1);
      const end = Math.min(lines.length, line + contextLines);
      const numbered = lines.slice(start, end).map((l, i) =>
        `${start + i + 1 === line ? '→' : ' '} ${start + i + 1}: ${l}`
      );
      return '```\n' + numbered.join('\n') + '\n```';
    } catch { return ''; }
  }

  // ─── Helper: OWASP category link ─────────────────────────────────────────────

  private owaspLink(category: string | undefined): string {
    if (!category) return '';
    const slug = category.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    return `[${category}](https://owasp.org/www-project-top-ten/${slug}/)`;
  }

  // ─── Skills ──────────────────────────────────────────────────────────────────

  private async runSecurityAudit(target: string | undefined, opts: SkillRunOptions): Promise<string> {
    const deep = opts.depth === 'deep';
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

    if (!deep) {
      return formatIssuesMarkdown('Security Audit', issues, files.length);
    }

    // ── deep mode ───────────────────────────────────────────────────────────────
    const critical = issues.filter(i => i.severity === 'critical');
    const high     = issues.filter(i => i.severity === 'high');
    const medium   = issues.filter(i => i.severity === 'medium');
    const low      = issues.filter(i => i.severity === 'low');

    let output = `## Security Audit (Deep Mode)\n\n`;
    output += `**Files analyzed:** ${files.length} | **Issues:** ${issues.length}`;
    output += ` (🔴 ${critical.length} critical, 🟠 ${high.length} high, 🟡 ${medium.length} medium, ⚪ ${low.length} low)\n\n`;

    // Summary table per file
    const fileMap = new Map<string, { critical: number; high: number; medium: number }>();
    for (const i of issues) {
      if (!fileMap.has(i.filepath)) fileMap.set(i.filepath, { critical: 0, high: 0, medium: 0 });
      const r = fileMap.get(i.filepath)!;
      if (i.severity === 'critical') r.critical++;
      else if (i.severity === 'high') r.high++;
      else if (i.severity === 'medium') r.medium++;
    }
    output += `### Summary Table\n\n| File | Critical | High | Medium |\n|------|----------|------|--------|\n`;
    for (const [fp, counts] of fileMap) {
      output += `| \`${fp}\` | ${counts.critical} | ${counts.high} | ${counts.medium} |\n`;
    }
    output += '\n';

    // Per-severity detailed findings with code excerpts + OWASP links + remediation
    for (const severity of ['critical', 'high', 'medium', 'low'] as const) {
      const group = issues.filter(i => i.severity === severity);
      if (group.length === 0) continue;
      const emoji = { critical: '🔴', high: '🟠', medium: '🟡', low: '⚪' }[severity];
      output += `### ${emoji} ${severity.toUpperCase()} (${group.length})\n\n`;
      for (const issue of group) {
        output += `#### ${issue.title}\n`;
        output += `- **File:** \`${issue.filepath}${issue.line ? ':' + issue.line : ''}\`\n`;
        if (issue.owaspCategory) output += `- **OWASP:** ${this.owaspLink(issue.owaspCategory)}\n`;
        if (issue.cwe) output += `- **CWE:** [CWE-${issue.cwe}](https://cwe.mitre.org/data/definitions/${issue.cwe}.html)\n`;
        output += `- **Description:** ${issue.description}\n\n`;

        const ctx = this.getCodeContext(issue.filepath, issue.line, 3);
        if (ctx) output += `**Vulnerable code:**\n${ctx}\n\n`;

        if (issue.fix) {
          output += `**Step-by-step remediation:**\n`;
          output += `1. Locate line ${issue.line ?? '?'} in \`${issue.filepath}\`.\n`;
          output += `2. ${issue.fix}\n`;
          output += `3. Re-run \`security_scan\` to confirm the issue is resolved.\n\n`;
        }
      }
    }

    // Recommended task order by blast radius (critical first, then high)
    output += `## Recommended Task Order\n\n`;
    output += `Fix issues in the following order based on severity and blast radius:\n\n`;
    let taskIdx = 1;
    for (const issue of [...critical, ...high].slice(0, 10)) {
      output += `${taskIdx++}. **${issue.title}** — \`${issue.filepath}:${issue.line ?? '?'}\` [${issue.severity.toUpperCase()}]\n`;
    }

    return output;
  }

  private async runCodeReview(target: string | undefined, opts: SkillRunOptions): Promise<string> {
    const deep = opts.depth === 'deep';
    const issues: AuditIssue[] = [];
    const files = this.resolveFiles(target);

    for (const file of files) {
      try {
        const content = fs.readFileSync(file, 'utf-8');
        issues.push(...scanQuality(file, content));
        issues.push(...complexityIssues(file));
      } catch { /* skip */ }
    }

    if (!deep) {
      return formatIssuesMarkdown('Code Review', issues, files.length);
    }

    // ── deep mode ───────────────────────────────────────────────────────────────
    const critical = issues.filter(i => i.severity === 'critical');
    const high     = issues.filter(i => i.severity === 'high');
    const medium   = issues.filter(i => i.severity === 'medium');
    const low      = issues.filter(i => i.severity === 'low');

    let output = `## Code Review (Deep Mode)\n\n`;
    output += `**Files analyzed:** ${files.length} | **Issues:** ${issues.length}`;
    output += ` (🔴 ${critical.length} critical, 🟠 ${high.length} high, 🟡 ${medium.length} medium, ⚪ ${low.length} low)\n\n`;

    // Pattern frequency table
    const patternCount = new Map<string, number>();
    for (const i of issues) {
      patternCount.set(i.category, (patternCount.get(i.category) ?? 0) + 1);
    }
    output += `### Pattern Frequency\n\n| Category | Count |\n|----------|-------|\n`;
    for (const [cat, cnt] of [...patternCount.entries()].sort((a, b) => b[1] - a[1])) {
      output += `| ${cat} | ${cnt} |\n`;
    }
    output += '\n';

    // Technical debt score per file
    const fileDebt = new Map<string, number>();
    for (const i of issues) {
      const weight = { critical: 10, high: 5, medium: 2, low: 1, info: 0 }[i.severity] ?? 0;
      fileDebt.set(i.filepath, (fileDebt.get(i.filepath) ?? 0) + weight);
    }
    const sortedByDebt = [...fileDebt.entries()].sort((a, b) => b[1] - a[1]);
    if (sortedByDebt.length > 0) {
      output += `### Technical Debt Score (per file)\n\n| File | Debt Score |\n|------|------------|\n`;
      for (const [fp, score] of sortedByDebt) {
        output += `| \`${fp}\` | ${score} |\n`;
      }
      output += '\n';
    }

    // Detailed findings with code excerpts + refactoring before/after hints
    for (const severity of ['critical', 'high', 'medium', 'low'] as const) {
      const group = issues.filter(i => i.severity === severity);
      if (group.length === 0) continue;
      const emoji = { critical: '🔴', high: '🟠', medium: '🟡', low: '⚪' }[severity];
      output += `### ${emoji} ${severity.toUpperCase()} (${group.length})\n\n`;
      for (const issue of group) {
        output += `#### ${issue.title}\n`;
        output += `- **File:** \`${issue.filepath}${issue.line ? ':' + issue.line : ''}\`\n`;
        output += `- **Description:** ${issue.description}\n\n`;

        const ctx = this.getCodeContext(issue.filepath, issue.line, 5);
        if (ctx) output += `**Problematic code block:**\n${ctx}\n\n`;

        if (issue.fix) {
          output += `**Refactoring suggestion:**\n`;
          output += `- Before: (see code block above)\n`;
          output += `- After: ${issue.fix}\n\n`;
        }
      }
    }

    return output;
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

  private async runRefactorPlanner(target: string | undefined, opts: SkillRunOptions): Promise<string> {
    const deep = opts.depth === 'deep';
    const files = this.resolveFiles(target);
    const allIssues: Array<{ file: string; issue: AuditIssue }> = [];

    for (const file of files) {
      try {
        const issues = complexityIssues(file);
        for (const i of issues) {
          allIssues.push({ file, issue: i });
        }
      } catch { /* skip */ }
    }

    if (!deep) {
      let output = `## Refactor Planı\n\n**Analiz edilen dosya:** ${files.length}\n\n`;
      if (allIssues.length === 0) {
        output += '✅ Refactor gerektiren kritik bölge bulunamadı.\n';
      } else {
        output += `### 🔴 Yüksek Complexity (${allIssues.length} bölge)\n\n`;
        output += allIssues.map(({ file, issue }) =>
          `- **${file}:${issue.line}** — ${issue.title} (complexity: ${issue.description})`
        ).join('\n') + '\n\n';
        output += `### Öneri\nEn yüksek complexity'li fonksiyonları küçük fonksiyonlara böl.\n`;
      }
      return output;
    }

    // ── deep mode ───────────────────────────────────────────────────────────────
    let output = `## Refactor Planı (Deep Mode)\n\n**Analiz edilen dosya:** ${files.length}\n\n`;

    if (allIssues.length === 0) {
      output += '✅ Refactor gerektiren kritik bölge bulunamadı.\n';
      return output;
    }

    // Show actual complex functions: name, line, description
    output += `### 🔴 Yüksek Complexity Fonksiyonlar (${allIssues.length})\n\n`;
    output += `| Dosya | Satır | Fonksiyon | Detay |\n|-------|-------|-----------|-------|\n`;
    for (const { file, issue } of allIssues) {
      output += `| \`${file}\` | ${issue.line ?? '?'} | ${issue.title} | ${issue.description} |\n`;
    }
    output += '\n';

    // Top 3 hotspots with before/after refactoring sketch and estimated hours
    const top3 = allIssues.slice(0, 3);
    output += `### Top 3 Hotspot — Refactor Taslağı\n\n`;
    for (let idx = 0; idx < top3.length; idx++) {
      const { file, issue } = top3[idx];
      output += `#### ${idx + 1}. ${issue.title} — \`${file}:${issue.line ?? '?'}\`\n`;
      output += `**Sorun:** ${issue.description}\n\n`;

      const ctx = this.getCodeContext(file, issue.line, 5);
      if (ctx) output += `**Mevcut kod:**\n${ctx}\n\n`;

      output += `**Önerilen refactor:**\n`;
      output += `- Fonksiyonu tek sorumluluk prensibine göre 2-3 küçük fonksiyona böl.\n`;
      output += `- Her dallanma (if/switch) için ayrı yardımcı fonksiyon çıkar.\n`;
      output += `- Döngü içi mantığı extract et.\n\n`;
      output += `**Tahmini süre:** ~${1 + idx} saat\n\n`;
    }

    output += `### Öneri\nEn yüksek complexity'li fonksiyonları küçük fonksiyonlara böl. Her adım için \`task_create\` çağrısı yap.\n`;
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
    const deep = opts.depth === 'deep';
    const files = this.resolveFiles(target);
    const issues: AuditIssue[] = [];

    for (const file of files) {
      try {
        const content = fs.readFileSync(file, 'utf-8');
        issues.push(...scanSecurity(file, content));
      } catch { /* skip */ }
    }

    const criticalIssues = issues.filter(i => i.severity === 'critical' || i.severity === 'high');

    if (!deep) {
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

    // ── deep mode ───────────────────────────────────────────────────────────────
    let output = `## Bug Raporu (Deep Mode)\n\n**Taranan dosya:** ${files.length}\n`;
    output += `**Kritik/Yüksek sorun:** ${criticalIssues.length}\n\n`;

    if (criticalIssues.length === 0) {
      output += '✅ Kritik bug pattern bulunmadı.\n';
      return output;
    }

    // Count files affected per issue category
    const categoryFiles = new Map<string, Set<string>>();
    for (const i of issues) {
      if (!categoryFiles.has(i.category)) categoryFiles.set(i.category, new Set());
      categoryFiles.get(i.category)!.add(i.filepath);
    }

    for (const issue of criticalIssues.slice(0, 10)) {
      const affectedFiles = categoryFiles.get(issue.category)?.size ?? 1;
      output += `### 🔴 ${issue.title}\n`;
      output += `- **Dosya:** \`${issue.filepath}:${issue.line ?? '?'}\`\n`;
      output += `- **Açıklama:** ${issue.description}\n\n`;

      // Code excerpt
      const ctx = this.getCodeContext(issue.filepath, issue.line, 3);
      if (ctx) output += `**İlgili kod:**\n${ctx}\n\n`;

      // Root cause analysis
      output += `**Kök neden analizi:**\n`;
      output += `Bu pattern genellikle güvenli olmayan kullanıcı girdisi doğrulamasından veya `;
      output += `eksik hata yönetiminden kaynaklanır. Kategori: \`${issue.category}\`.\n\n`;

      // Impact assessment
      output += `**Etki değerlendirmesi:**\n`;
      output += `Bu sorun \`${issue.category}\` kategorisindeki **${affectedFiles} dosyayı** etkiliyor.\n\n`;

      // Reproduction scenario
      output += `**Tetikleme senaryosu:**\n`;
      output += `1. \`${issue.filepath}\` dosyasının ${issue.line ?? '?'}. satırına kontrollü girdi gönderin.\n`;
      output += `2. ${issue.description}\n\n`;

      // Fix steps
      if (issue.fix) {
        output += `**Düzeltme adımları:**\n`;
        output += `1. \`${issue.filepath}\` dosyasını aç, satır ${issue.line ?? '?'} civarını incele.\n`;
        output += `2. Uygula: ${issue.fix}\n`;
        output += `3. Değişikliği kaydet ve \`security_scan\` ile doğrula.\n\n`;
      }
    }

    return output;
  }

  private async runDeepDive(target: string | undefined, opts: SkillRunOptions): Promise<string> {
    const deep = opts.depth === 'deep';
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

    if (!deep) {
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

    // ── deep mode ───────────────────────────────────────────────────────────────
    let output = `## Deep Dive (Deep Mode): ${target}\n\n`;
    output += `| Boyut | Skor | Detay |\n|-------|------|-------|\n`;
    output += `| Güvenlik | ${secScore}/10 | ${secIssues.length} sorun |\n`;
    output += `| Kalite | ${qualScore}/10 | ${qualIssues.length} sorun |\n`;
    output += `\n**Genel: ${overall}/10**\n\n`;

    // Full function inventory
    output += `### Fonksiyon Envanteri\n\n`;
    output += `| Dosya | Export | Fonksiyon | Satır Sayısı |\n|-------|--------|-----------|-------------|\n`;
    for (const file of files) {
      try {
        const content = fs.readFileSync(file, 'utf-8');
        const lines = content.split('\n');
        const fnMatches = [...content.matchAll(/(?:(export)\s+)?(?:async\s+)?function\s+(\w+)|(?:(export)\s+)?(?:const|let)\s+(\w+)\s*=\s*(?:async\s+)?\(/g)];
        for (const m of fnMatches) {
          const exported = !!(m[1] || m[3]);
          const name = m[2] ?? m[4] ?? '(anonymous)';
          // Estimate line count by finding next function or end of file
          const matchIdx = content.indexOf(m[0]);
          const startLine = content.slice(0, matchIdx).split('\n').length;
          const nextFnMatch = content.indexOf('\nfunction ', matchIdx + 1);
          const endLine = nextFnMatch > -1
            ? content.slice(0, nextFnMatch).split('\n').length
            : lines.length;
          const lineCount = Math.max(1, endLine - startLine);
          output += `| \`${file}\` | ${exported ? 'yes' : 'no'} | \`${name}\` | ~${lineCount} |\n`;
        }
      } catch { /* skip */ }
    }
    output += '\n';

    // Import/dependency graph
    output += `### Import Grafiği\n\n`;
    for (const file of files.slice(0, 10)) {
      try {
        const content = fs.readFileSync(file, 'utf-8');
        const imports = [...content.matchAll(/import\s+.*?from\s+['"]([^'"]+)['"]/g)].map(m => m[1]);
        if (imports.length > 0) {
          output += `**\`${file}\`** imports:\n`;
          for (const imp of imports) output += `  - \`${imp}\`\n`;
          output += '\n';
        }
      } catch { /* skip */ }
    }

    // Code age estimation based on style patterns
    output += `### Kod Yaşı Tahmini\n\n`;
    const ageHints: string[] = [];
    for (const file of files.slice(0, 5)) {
      try {
        const content = fs.readFileSync(file, 'utf-8');
        const hasVar = /\bvar\b/.test(content);
        const hasCallback = /function\s*\(err,/.test(content);
        const hasAsync = /\basync\b/.test(content);
        const hasOptionalChain = /\?\.[a-z]/.test(content);
        const era = hasVar && hasCallback ? 'Pre-ES6 (2015 öncesi)' :
          hasAsync && hasOptionalChain ? 'Modern ES2020+' :
          hasAsync ? 'ES2017+' : 'ES6-ES2017';
        ageHints.push(`- \`${file}\` — ${era}`);
      } catch { /* skip */ }
    }
    output += ageHints.join('\n') || '- (dosya okunamadı)';
    output += '\n\n';

    // Risk score breakdown
    const riskScore = Math.max(0, 10 - overall);
    output += `### Risk Skoru: ${riskScore}/10\n\n`;
    output += `| Bileşen | Puan | Açıklama |\n|---------|------|----------|\n`;
    output += `| Güvenlik açıkları | ${secIssues.filter(i => i.severity === 'critical').length * 3} | Kritik güvenlik sorunları |\n`;
    output += `| Kalite borcu | ${Math.min(10, qualIssues.length)} | Kalite sorunları |\n`;
    output += `| Dosya karmaşıklığı | ${Math.min(10, files.length)} | Dosya sayısı |\n\n`;

    // Top 3 most dangerous functions with full code
    const criticalSecIssues = secIssues.filter(i => i.severity === 'critical').slice(0, 3);
    if (criticalSecIssues.length > 0) {
      output += `### Top ${criticalSecIssues.length} En Tehlikeli Bölge\n\n`;
      for (let idx = 0; idx < criticalSecIssues.length; idx++) {
        const issue = criticalSecIssues[idx];
        output += `#### ${idx + 1}. ${issue.title} — \`${issue.filepath}:${issue.line ?? '?'}\`\n`;
        output += `${issue.description}\n\n`;
        const ctx = this.getCodeContext(issue.filepath, issue.line, 5);
        if (ctx) output += `${ctx}\n\n`;
      }
    }

    return output;
  }

  private async runAuditRunner(target: string | undefined, opts: SkillRunOptions): Promise<string> {
    const deep = opts.depth === 'deep';
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
    const high     = secIssues.filter(i => i.severity === 'high');

    if (!deep) {
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

    // ── deep mode ───────────────────────────────────────────────────────────────
    const medium   = secIssues.filter(i => i.severity === 'medium');
    const allIssues = [...secIssues, ...qualIssues];

    let output = `## Tam Audit Raporu (Deep Mode)\n\n`;
    output += `**Taranan dosya:** ${files.length}\n`;
    output += `**Güvenlik sorunları:** ${secIssues.length} (🔴 ${critical.length} kritik, 🟠 ${high.length} yüksek)\n`;
    output += `**Kalite sorunları:** ${qualIssues.length}\n\n`;

    // Per-file breakdown table
    const fileBreakdown = new Map<string, { critical: number; high: number; medium: number; low: number }>();
    for (const i of allIssues) {
      if (!fileBreakdown.has(i.filepath)) fileBreakdown.set(i.filepath, { critical: 0, high: 0, medium: 0, low: 0 });
      const r = fileBreakdown.get(i.filepath)!;
      if (i.severity === 'critical') r.critical++;
      else if (i.severity === 'high') r.high++;
      else if (i.severity === 'medium') r.medium++;
      else r.low++;
    }
    output += `### Dosya Bazlı Özet\n\n| Dosya | Critical | High | Medium | Low |\n|-------|----------|------|--------|-----|\n`;
    for (const [fp, counts] of fileBreakdown) {
      output += `| \`${fp}\` | ${counts.critical} | ${counts.high} | ${counts.medium} | ${counts.low} |\n`;
    }
    output += '\n';

    // All findings with code excerpts (not just top 10)
    if (critical.length > 0) {
      output += `### 🔴 Kritik Sorunlar (BLOKLA)\n\n`;
      for (const i of critical) {
        output += `#### ${i.title}\n`;
        output += `- **Dosya:** \`${i.filepath}:${i.line ?? '?'}\`\n`;
        output += `- ${i.description}\n\n`;
        const ctx = this.getCodeContext(i.filepath, i.line, 3);
        if (ctx) output += `${ctx}\n\n`;
        if (i.fix) output += `**Fix:** ${i.fix}\n\n`;
      }
    }
    if (high.length > 0) {
      output += `### 🟠 Yüksek Öncelik (Bu Hafta)\n\n`;
      for (const i of high) {
        output += `#### ${i.title}\n`;
        output += `- **Dosya:** \`${i.filepath}:${i.line ?? '?'}\`\n`;
        output += `- ${i.description}\n\n`;
        const ctx = this.getCodeContext(i.filepath, i.line, 3);
        if (ctx) output += `${ctx}\n\n`;
        if (i.fix) output += `**Fix:** ${i.fix}\n\n`;
      }
    }
    if (medium.length > 0) {
      output += `### 🟡 Orta Öncelik (Bu Sprint)\n\n`;
      for (const i of medium) {
        output += `- **${i.title}** — \`${i.filepath}:${i.line ?? '?'}\`\n`;
        output += `  ${i.description}${i.fix ? ' → ' + i.fix : ''}\n`;
      }
      output += '\n';
    }

    // Remediation timeline
    output += `### Düzeltme Zaman Çizelgesi\n\n`;
    output += `| Seviye | Hedef | Sorun Sayısı |\n|--------|-------|-------------|\n`;
    output += `| 🔴 Critical | Bugün | ${critical.length} |\n`;
    output += `| 🟠 High | Bu hafta | ${high.length} |\n`;
    output += `| 🟡 Medium | Bu sprint | ${medium.length} |\n\n`;

    if (secIssues.length === 0 && qualIssues.length === 0) {
      output += '✅ Temiz repo! Önemli sorun bulunamadı.\n';
    }

    // Suggested task_create calls for critical issues
    if (critical.length > 0) {
      output += `## Onerilen Task'lar\n\n`;
      output += 'Her kritik sorun için aşağıdaki komutları çalıştırın:\n\n';
      for (const issue of critical.slice(0, 5)) {
        output += `\`\`\`\ntask_create title="Fix: ${issue.title}" category="bug" priority="critical" filepath="${issue.filepath}"\n\`\`\`\n`;
      }
    }

    return output;
  }

  private async runDeepPlanner(target: string | undefined, opts: SkillRunOptions): Promise<string> {
    const planDir = target ? `${target}/.plan` : '.plan';
    const goal = (opts as Record<string, unknown>)['goal'] as string | undefined ?? 'Define your goal';

    const taskPlan = `# Task Plan\n\n## Goal\n${goal}\n\n## Current Phase\n1\n\n## Phases\n\n### Phase 1: Research & Discovery\n- [ ] Understand the codebase structure\n- [ ] Identify key files and dependencies\n- [ ] Document findings\n\n### Phase 2: Design\n- [ ] Define approach and architecture\n- [ ] Identify risks and edge cases\n- [ ] Finalize implementation plan\n\n### Phase 3: Implementation\n- [ ] Implement core functionality\n- [ ] Write tests\n- [ ] Review and refine\n\n### Phase 4: Verification\n- [ ] Run full audit\n- [ ] Verify all acceptance criteria met\n- [ ] Update documentation\n\n## Decisions Made\n| Decision | Rationale | Date |\n|----------|-----------|------|\n\n## Errors Encountered\n| Timestamp | Error | Attempt # | Resolution |\n|-----------|-------|-----------|------------|\n`;

    const findings = `# Findings\n\n## Requirements\n- (extract from user request)\n\n## Research Findings\n> **2-Action Rule**: After every 2 research operations, update this file immediately.\n\n## Technical Decisions\n\n## Issues Encountered\n\n## Resources\n`;

    const progress = `# Progress Log\n\n## Session: ${new Date().toISOString().split('T')[0]}\n\n### 5-Question Reboot Check\n1. **Where am I?** Phase 1 — Research\n2. **Where am I going?** Phases 2-4 remaining\n3. **What's the goal?** ${goal}\n4. **What have I learned?** (check findings.md)\n5. **What have I done?** Session just started\n\n### Actions\n`;

    try {
      fs.mkdirSync(planDir, { recursive: true });
      fs.writeFileSync(`${planDir}/task_plan.md`, taskPlan, 'utf-8');
      fs.writeFileSync(`${planDir}/findings.md`, findings, 'utf-8');
      fs.writeFileSync(`${planDir}/progress.md`, progress, 'utf-8');
    } catch { /* skip if can't write */ }

    return `## Deep Planner — Planning System Created\n\n**Files created:**\n- \`${planDir}/task_plan.md\` — phases + checkboxes\n- \`${planDir}/findings.md\` — research log (2-action rule)\n- \`${planDir}/progress.md\` — session log + reboot check\n\n**Goal:** ${goal}\n\n**Next step:** Update task_plan.md phases to match your specific task, then start Phase 1.\n\n**Remember:** After every 2 research operations → update findings.md immediately.`;
  }

  private async runSessionRestore(_target: string | undefined, _opts: SkillRunOptions): Promise<string> {
    const planDir = '.plan';
    let output = `## Session Restore — Context Recovery\n\n`;

    try {
      const taskPlan = fs.existsSync(`${planDir}/task_plan.md`)
        ? fs.readFileSync(`${planDir}/task_plan.md`, 'utf-8')
        : null;
      const progress = fs.existsSync(`${planDir}/progress.md`)
        ? fs.readFileSync(`${planDir}/progress.md`, 'utf-8')
        : null;

      if (!taskPlan && !progress) {
        return `## Session Restore\n\nNo .plan/ files found. Run \`deep-planner\` first to create a planning system.`;
      }

      output += `### 5-Question Reboot Check\n\n`;

      const phaseMatch = taskPlan?.match(/## Current Phase\n(\d+)/);
      const goalMatch = taskPlan?.match(/## Goal\n(.+)/);
      const phase = phaseMatch?.[1] ?? '?';
      const goal = goalMatch?.[1] ?? 'Unknown';

      output += `1. **Where am I?** Phase ${phase}\n`;
      output += `2. **Where am I going?** Check task_plan.md for remaining phases\n`;
      output += `3. **What's the goal?** ${goal}\n`;
      output += `4. **What have I learned?** See \`.plan/findings.md\`\n`;
      output += `5. **What have I done?** See \`.plan/progress.md\` last session\n\n`;

      if (taskPlan) {
        const pendingPhases = [...taskPlan.matchAll(/### (Phase \d+[^:]*)/g)].map(m => m[1]);
        output += `### Phases Overview\n${pendingPhases.map(p => `- ${p}`).join('\n')}\n\n`;
      }

      output += `### Next Steps\n1. Read \`.plan/findings.md\` to reload accumulated knowledge\n2. Call \`task_next\` to see actionable tasks\n3. Continue from Phase ${phase}\n`;
    } catch (e) {
      output += `Error reading plan files: ${e instanceof Error ? e.message : String(e)}`;
    }

    return output;
  }

  private async runAutoFixer(target: string | undefined, _opts: SkillRunOptions): Promise<string> {
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
    const total = secIssues.length + qualIssues.length;

    let output = `## Auto-Fixer — Otomatik Düzeltme Planı\n\n`;
    output += `**Taranan:** ${files.length} dosya | **Toplam sorun:** ${total}\n\n`;

    output += `### Triage Sonucu\n`;
    output += `| Seviye | Sayı | Aksiyon |\n|--------|------|----------|\n`;
    output += `| 🔴 CRITICAL | ${critical.length} | Hemen düzelt |\n`;
    output += `| 🟠 HIGH | ${high.length} | Bu sprintte düzelt |\n`;
    output += `| 🟡 MEDIUM | ${qualIssues.filter(i => i.severity === 'medium').length} | Sonraki sprint |\n`;
    output += `| ⚪ LOW | ${qualIssues.filter(i => i.severity === 'low').length} | Backlog |\n\n`;

    if (critical.length > 0) {
      output += `### 🔴 CRITICAL — Hemen Düzelt\n\n`;
      for (const issue of critical.slice(0, 5)) {
        output += `**${issue.title}** — \`${issue.filepath}:${issue.line}\`\n`;
        if (issue.fix) output += `→ Fix: ${issue.fix}\n`;
        output += '\n';
      }
    }

    if (high.length > 0) {
      output += `### 🟠 HIGH — Bu Sprint\n\n`;
      for (const issue of high.slice(0, 5)) {
        output += `- **${issue.title}** — \`${issue.filepath}:${issue.line}\`\n`;
      }
      output += '\n';
    }

    output += `### Sonraki Adım\nHer sorun için \`task_create\` çağrısı yap, sonra \`task_next\` ile sırayla düzelt.`;
    return output;
  }

  private async runCodeArchaeologist(target: string | undefined, _opts: SkillRunOptions): Promise<string> {
    if (!target) return `## Code Archaeologist\n\nBir dosya veya dizin belirtin.`;

    const files = this.resolveFiles(target);
    const secIssues: AuditIssue[] = [];

    for (const file of files.slice(0, 5)) {
      try {
        const content = fs.readFileSync(file, 'utf-8');
        secIssues.push(...scanSecurity(file, content));
      } catch { /* skip */ }
    }

    let output = `## Code Archaeologist — ${target}\n\n`;
    output += `### Analiz Özeti\n`;
    output += `**Taranan dosya:** ${files.length}\n`;
    output += `**Güvenlik sorunları:** ${secIssues.length}\n\n`;
    output += `### Arkeolojik Rapor\n`;
    output += `Bu araç tam git blame + commit history analizi için şu araçları kullanın:\n\n`;
    output += `1. \`git_blame_context filepath="${target}"\` — Katkıda bulunanlar\n`;
    output += `2. \`commit_history_search query="${path.basename(target)}"\` — Commit timeline\n`;
    output += `3. \`complexity_score filepath="${target}"\` — Complexity zamanla nasıl büyümüş\n`;
    output += `4. \`research_topic topic="${path.basename(target)} module purpose"\` — Semantic analiz\n\n`;
    output += `### Mevcut Bulgular\n`;
    if (secIssues.length > 0) {
      output += `**Birikmiş teknik borç:**\n`;
      for (const i of secIssues.slice(0, 5)) {
        output += `- \`${i.filepath}:${i.line}\` — ${i.title}\n`;
      }
    } else {
      output += `✅ Belirgin güvenlik teknik borcu yok.\n`;
    }
    return output;
  }

  private async runImpactAnalyzer(target: string | undefined, _opts: SkillRunOptions): Promise<string> {
    if (!target) return `## Impact Analyzer\n\nBir sembol, dosya veya dizin belirtin.`;

    const files = this.resolveFiles(target);
    let output = `## Impact Analyzer — ${target}\n\n`;
    output += `### Blast Radius Analizi\n\n`;
    output += `**Hedef:** \`${target}\`\n`;
    output += `**Doğrudan dosya:** ${files.length}\n\n`;
    output += `### Etki Değerlendirmesi\nTam analiz için şu araçları kullanın:\n\n`;
    output += `1. \`find_references symbol="${path.basename(target)}"\` — Tüm kullanımlar\n`;
    output += `2. \`get_dependencies filepath="${target}"\` — Dependency graph\n`;
    output += `3. \`search_code query="${path.basename(target)}"\` — Dolaylı referanslar\n\n`;
    output += `### Risk Kategorileri\n`;
    output += `| Kategori | Açıklama |\n|----------|----------|\n`;
    output += `| 🔴 BREAKING | Bu değişimde kesinlikle kırılır |\n`;
    output += `| 🟠 LIKELY | Muhtemelen etkilenir, review gerek |\n`;
    output += `| ✅ SAFE | Import ediyor ama direkt kullanmıyor |\n\n`;
    output += `### Önerilen Değişiklik Sırası\n`;
    output += `1. Önce leaf dosyaları güncelle (başka dosya import etmeyenler)\n`;
    output += `2. Sonra middleware/util katmanı\n`;
    output += `3. En son entry point ve index dosyaları\n\n`;
    output += `Bu sırayı belirlemek için \`get_dependencies\` sonucunu incele.`;
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

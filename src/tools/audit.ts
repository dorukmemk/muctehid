import * as fs from 'fs';
import * as path from 'path';
import { scanSecurity } from '../lib/audit/security.js';
import { scanQuality, scanTodos } from '../lib/audit/quality.js';
import { scanSecrets } from '../lib/audit/secrets.js';
import { complexityIssues } from '../lib/audit/complexity.js';
import { AuditIssue, Severity } from '../types/index.js';
import * as crypto from 'crypto';

export function auditFile(filepath: string): { issues: AuditIssue[]; markdown: string } {
  if (!fs.existsSync(filepath)) {
    return { issues: [], markdown: `File not found: ${filepath}` };
  }

  const content = fs.readFileSync(filepath, 'utf-8');
  const issues: AuditIssue[] = [
    ...scanSecurity(filepath, content),
    ...scanQuality(filepath, content),
    ...complexityIssues(filepath),
  ];

  const secrets = scanSecrets(filepath, content);
  for (const s of secrets) {
    issues.push({
      id: crypto.randomUUID(),
      severity: 'critical',
      category: 'secret',
      title: `Secret detected: ${s.type}`,
      description: `Potential ${s.type} at line ${s.line}`,
      filepath,
      line: s.line,
      fix: 'Move to environment variables.',
    });
  }

  const markdown = formatAuditMarkdown(filepath, issues);
  return { issues, markdown };
}

export function auditDiff(diffContent: string, parsedFiles: Array<{ filepath: string; hunks: import('../types/index.js').DiffHunk[] }>): AuditIssue[] {
  const issues: AuditIssue[] = [];

  for (const file of parsedFiles) {
    const addedLines = file.hunks
      .flatMap(h => h.lines.filter(l => l.type === 'add').map(l => l.content))
      .join('\n');

    if (addedLines.trim()) {
      issues.push(...scanSecurity(file.filepath, addedLines));
      const secrets = scanSecrets(file.filepath, addedLines);
      for (const s of secrets) {
        issues.push({
          id: crypto.randomUUID(),
          severity: 'critical',
          category: 'secret',
          title: `Secret in diff: ${s.type}`,
          description: `Potential ${s.type} being committed at line ${s.line}`,
          filepath: file.filepath,
          line: s.line,
          fix: 'Remove from diff before committing.',
        });
      }
    }
  }

  return issues;
}

function formatAuditMarkdown(filepath: string, issues: AuditIssue[]): string {
  const bySeverity = (s: Severity) => issues.filter(i => i.severity === s);
  let md = `# Audit: ${path.basename(filepath)}\n\n`;
  md += `**File:** \`${filepath}\`\n`;
  md += `**Total issues:** ${issues.length} (`;
  md += `🔴 ${bySeverity('critical').length} critical, `;
  md += `🟠 ${bySeverity('high').length} high, `;
  md += `🟡 ${bySeverity('medium').length} medium, `;
  md += `⚪ ${bySeverity('low').length} low)\n\n`;

  if (issues.length === 0) return md + '✅ No issues found.\n';

  for (const severity of ['critical', 'high', 'medium', 'low'] as Severity[]) {
    const group = bySeverity(severity);
    if (!group.length) continue;
    const emoji = { critical: '🔴', high: '🟠', medium: '🟡', low: '⚪', info: 'ℹ️' }[severity];
    md += `## ${emoji} ${severity.toUpperCase()}\n\n`;
    for (const i of group) {
      md += `### ${i.title}\n`;
      md += `- **Line:** ${i.line ?? 'N/A'}\n`;
      md += `- **Category:** ${i.category}\n`;
      if (i.owaspCategory) md += `- **OWASP:** ${i.owaspCategory}`;
      if (i.cwe) md += ` | **CWE:** ${i.cwe}`;
      if (i.owaspCategory || i.cwe) md += '\n';
      md += `- ${i.description}\n`;
      if (i.fix) md += `- **Fix:** ${i.fix}\n`;
      if (i.code) md += `\`\`\`\n${i.code}\n\`\`\`\n`;
      md += '\n';
    }
  }

  return md;
}

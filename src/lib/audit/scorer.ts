import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';
import { AuditIssue, HealthScore, Severity } from '../../types/index.js';
import { scanSecurity } from './security.js';
import { scanQuality } from './quality.js';
import { scanSecrets } from './secrets.js';
import { complexityIssues } from './complexity.js';

const SEVERITY_PENALTY: Record<Severity, number> = {
  critical: 25,
  high: 10,
  medium: 4,
  low: 1,
  info: 0,
};

export async function computeHealthScore(repoPath: string, files?: string[]): Promise<HealthScore> {
  const allFiles = files ?? await glob('**/*.{ts,tsx,js,jsx,py,go,rs,java,cs,php,rb}', {
    cwd: repoPath,
    absolute: true,
    ignore: ['**/node_modules/**', '**/dist/**', '**/.git/**', '**/.audit-data/**'],
  });

  const allIssues: AuditIssue[] = [];
  let totalLines = 0;
  let docLines = 0;
  let testFiles = 0;

  for (const file of allFiles) {
    try {
      const content = fs.readFileSync(file, 'utf-8');
      const lines = content.split('\n');
      totalLines += lines.length;

      // Count doc lines (comments)
      docLines += lines.filter(l => /^\s*(\/\*|\*|\/\/|#|"""|''')/.test(l)).length;

      // Test file detection
      if (/\.(test|spec)\.|__tests__|test\/|tests\//.test(file)) testFiles++;

      allIssues.push(
        ...scanSecurity(file, content),
        ...scanQuality(file, content),
        ...complexityIssues(file),
      );

      // Secrets as critical issues
      const secrets = scanSecrets(file, content);
      for (const s of secrets) {
        allIssues.push({
          id: `secret-${s.line}`,
          severity: 'critical',
          category: 'secret',
          title: `Secret detected: ${s.type}`,
          description: `Potential ${s.type} found at line ${s.line}`,
          filepath: file,
          line: s.line,
          fix: 'Move to environment variables or secrets manager.',
        });
      }
    } catch { /* skip unreadable files */ }
  }

  // Calculate component scores (0-100 each)
  const securityIssues = allIssues.filter(i => i.category === 'security' || i.category === 'secret');
  const qualityIssues = allIssues.filter(i => i.category === 'quality');

  const securityScore = Math.max(0, 100 - penaltySum(securityIssues));
  const qualityScore = Math.max(0, 100 - penaltySum(qualityIssues));
  const docsScore = totalLines > 0 ? Math.min(100, (docLines / totalLines) * 400) : 50;
  const testsScore = allFiles.length > 0 ? Math.min(100, (testFiles / allFiles.length) * 300) : 0;
  const depsScore = 70; // base score — improved by dependency-audit tool

  // Weighted total
  const total = Math.round(
    securityScore * 0.30 +
    qualityScore * 0.25 +
    docsScore * 0.20 +
    testsScore * 0.15 +
    depsScore * 0.10
  );

  return {
    total,
    security: Math.round(securityScore),
    quality: Math.round(qualityScore),
    docs: Math.round(docsScore),
    tests: Math.round(testsScore),
    dependencies: Math.round(depsScore),
    grade: gradeOf(total),
    issues: allIssues,
  };
}

function penaltySum(issues: AuditIssue[]): number {
  return issues.reduce((sum, i) => sum + (SEVERITY_PENALTY[i.severity] ?? 0), 0);
}

function gradeOf(score: number): HealthScore['grade'] {
  if (score >= 90) return 'excellent';
  if (score >= 70) return 'good';
  if (score >= 50) return 'needs-attention';
  return 'critical';
}

import { computeHealthScore } from '../lib/audit/scorer.js';

export async function getHealthScore(repoRoot: string, files?: string[]): Promise<string> {
  const health = await computeHealthScore(repoRoot, files);
  const grade = { excellent: '🟢 Excellent', good: '🟡 Good', 'needs-attention': '🟠 Needs Attention', critical: '🔴 Critical' }[health.grade];

  let md = `## Health Score: ${health.total}/100 — ${grade}\n\n`;
  md += `| Component | Score | Weight |\n|-----------|-------|--------|\n`;
  md += `| 🔒 Security | ${health.security}/100 | 30% |\n`;
  md += `| ✨ Quality | ${health.quality}/100 | 25% |\n`;
  md += `| 📚 Docs | ${health.docs}/100 | 20% |\n`;
  md += `| 🧪 Tests | ${health.tests}/100 | 15% |\n`;
  md += `| 📦 Dependencies | ${health.dependencies}/100 | 10% |\n\n`;

  const thresholds = [
    { min: 90, label: '✅ Repository is in excellent shape!' },
    { min: 70, label: '👍 Good overall, some room for improvement.' },
    { min: 50, label: '⚠️ Needs attention — address the issues below.' },
    { min: 0, label: '🚨 Critical state — immediate action required!' },
  ];

  for (const t of thresholds) {
    if (health.total >= t.min) {
      md += `${t.label}\n\n`;
      break;
    }
  }

  const critical = health.issues.filter(i => i.severity === 'critical');
  const high = health.issues.filter(i => i.severity === 'high');

  if (critical.length > 0) {
    md += `### 🔴 Critical Issues (${critical.length})\n\n`;
    for (const i of critical.slice(0, 5)) {
      md += `- **${i.title}** — \`${i.filepath}:${i.line ?? ''}\`\n`;
    }
    if (critical.length > 5) md += `- ...and ${critical.length - 5} more\n`;
    md += '\n';
  }

  if (high.length > 0) {
    md += `### 🟠 High Issues (${high.length})\n\n`;
    for (const i of high.slice(0, 3)) {
      md += `- **${i.title}** — \`${i.filepath}:${i.line ?? ''}\`\n`;
    }
    if (high.length > 3) md += `- ...and ${high.length - 3} more\n`;
    md += '\n';
  }

  md += `\n_Run \`generate_report\` for a full detailed report._\n`;
  return md;
}

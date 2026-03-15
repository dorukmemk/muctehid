import { getUncommittedDiff, getStagedDiff, parseDiff } from '../lib/git/diff.js';
import { getBlame, getCommitHistory } from '../lib/git/blame.js';
import { installHooks, removeHooks } from '../lib/git/hooks.js';
import { auditDiff } from './audit.js';

export class GitTools {
  constructor(private repoRoot: string) {}

  async handleTool(name: string, args: Record<string, unknown>): Promise<string> {
    switch (name) {
      case 'git_diff_audit': {
        const staged = args.staged as boolean ?? false;
        const diff = staged
          ? await getStagedDiff(this.repoRoot)
          : await getUncommittedDiff(this.repoRoot);

        if (!diff) return 'No changes detected.';

        const parsed = parseDiff(diff);
        const issues = auditDiff(diff, parsed);

        let md = `## Git Diff Audit\n\n`;
        md += `**Files changed:** ${parsed.length}\n`;
        md += `**Issues in diff:** ${issues.length}\n\n`;

        if (issues.length === 0) {
          md += '✅ No security issues in the diff.\n';
        } else {
          for (const issue of issues) {
            md += `### 🔴 ${issue.title}\n`;
            md += `- **File:** ${issue.filepath}:${issue.line ?? ''}\n`;
            md += `- ${issue.description}\n`;
            if (issue.fix) md += `- **Fix:** ${issue.fix}\n`;
            md += '\n';
          }
        }
        return md;
      }

      case 'git_blame_context': {
        const filepath = args.filepath as string;
        if (!filepath) throw new Error('filepath is required');
        const entries = await getBlame(this.repoRoot, filepath);
        if (entries.length === 0) return `No blame data for ${filepath}`;
        const lines = entries.slice(0, 50).map(e =>
          `${String(e.line).padStart(4)} | ${e.commit} | ${e.author.padEnd(20)} | ${e.content}`
        );
        return `## Git Blame: ${filepath}\n\n\`\`\`\n${lines.join('\n')}\n\`\`\``;
      }

      case 'pre_commit_check': {
        const diff = await getStagedDiff(this.repoRoot);
        if (!diff) return '✅ Nothing staged.';
        const parsed = parseDiff(diff);
        const issues = auditDiff(diff, parsed);
        const critical = issues.filter(i => i.severity === 'critical');
        const high = issues.filter(i => i.severity === 'high');

        let md = `## Pre-Commit Check\n\n`;
        md += `**Critical:** ${critical.length} | **High:** ${high.length}\n\n`;

        if (critical.length > 0) {
          md += `⛔ **COMMIT BLOCKED** — ${critical.length} critical issue(s) found:\n\n`;
          for (const i of critical) {
            md += `- ${i.title} (${i.filepath}:${i.line})\n`;
          }
        } else if (high.length > 0) {
          md += `⚠️ ${high.length} high severity issue(s) found. Review before committing.\n`;
        } else {
          md += '✅ Pre-commit check passed.\n';
        }
        return md;
      }

      case 'commit_history_search': {
        const query = args.query as string;
        const limit = (args.limit as number) ?? 50;
        const commits = await getCommitHistory(this.repoRoot, query, limit);
        if (commits.length === 0) return 'No commits found.';
        const rows = commits.map(c => `| \`${c.hash}\` | ${c.author} | ${c.date.slice(0, 10)} | ${c.message} |`);
        return `## Commit History${query ? ` (search: "${query}")` : ''}\n\n| Hash | Author | Date | Message |\n|------|--------|------|--------|\n${rows.join('\n')}`;
      }

      case 'install_hooks': {
        const result = installHooks(this.repoRoot, {
          preCommit: (args.preCommit as boolean) ?? true,
          prePush: (args.prePush as boolean) ?? false,
        });
        let md = `## Git Hook Installation\n\n`;
        if (result.installed.length) md += `✅ Installed: ${result.installed.join(', ')}\n`;
        if (result.errors.length) md += `❌ Errors:\n${result.errors.map(e => `- ${e}`).join('\n')}\n`;
        return md;
      }

      default:
        throw new Error(`Unknown git tool: ${name}`);
    }
  }
}

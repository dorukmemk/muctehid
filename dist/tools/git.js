"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GitTools = void 0;
const diff_js_1 = require("../lib/git/diff.js");
const blame_js_1 = require("../lib/git/blame.js");
const hooks_js_1 = require("../lib/git/hooks.js");
const audit_js_1 = require("./audit.js");
class GitTools {
    repoRoot;
    constructor(repoRoot) {
        this.repoRoot = repoRoot;
    }
    async handleTool(name, args) {
        switch (name) {
            case 'git_diff_audit': {
                const staged = args.staged ?? false;
                const diff = staged
                    ? await (0, diff_js_1.getStagedDiff)(this.repoRoot)
                    : await (0, diff_js_1.getUncommittedDiff)(this.repoRoot);
                if (!diff)
                    return 'No changes detected.';
                const parsed = (0, diff_js_1.parseDiff)(diff);
                const issues = (0, audit_js_1.auditDiff)(diff, parsed);
                let md = `## Git Diff Audit\n\n`;
                md += `**Files changed:** ${parsed.length}\n`;
                md += `**Issues in diff:** ${issues.length}\n\n`;
                if (issues.length === 0) {
                    md += '✅ No security issues in the diff.\n';
                }
                else {
                    for (const issue of issues) {
                        md += `### 🔴 ${issue.title}\n`;
                        md += `- **File:** ${issue.filepath}:${issue.line ?? ''}\n`;
                        md += `- ${issue.description}\n`;
                        if (issue.fix)
                            md += `- **Fix:** ${issue.fix}\n`;
                        md += '\n';
                    }
                }
                return md;
            }
            case 'git_blame_context': {
                const filepath = args.filepath;
                if (!filepath)
                    throw new Error('filepath is required');
                const entries = await (0, blame_js_1.getBlame)(this.repoRoot, filepath);
                if (entries.length === 0)
                    return `No blame data for ${filepath}`;
                const lines = entries.slice(0, 50).map(e => `${String(e.line).padStart(4)} | ${e.commit} | ${e.author.padEnd(20)} | ${e.content}`);
                return `## Git Blame: ${filepath}\n\n\`\`\`\n${lines.join('\n')}\n\`\`\``;
            }
            case 'pre_commit_check': {
                const diff = await (0, diff_js_1.getStagedDiff)(this.repoRoot);
                if (!diff)
                    return '✅ Nothing staged.';
                const parsed = (0, diff_js_1.parseDiff)(diff);
                const issues = (0, audit_js_1.auditDiff)(diff, parsed);
                const critical = issues.filter(i => i.severity === 'critical');
                const high = issues.filter(i => i.severity === 'high');
                let md = `## Pre-Commit Check\n\n`;
                md += `**Critical:** ${critical.length} | **High:** ${high.length}\n\n`;
                if (critical.length > 0) {
                    md += `⛔ **COMMIT BLOCKED** — ${critical.length} critical issue(s) found:\n\n`;
                    for (const i of critical) {
                        md += `- ${i.title} (${i.filepath}:${i.line})\n`;
                    }
                }
                else if (high.length > 0) {
                    md += `⚠️ ${high.length} high severity issue(s) found. Review before committing.\n`;
                }
                else {
                    md += '✅ Pre-commit check passed.\n';
                }
                return md;
            }
            case 'commit_history_search': {
                const query = args.query;
                const limit = args.limit ?? 50;
                const commits = await (0, blame_js_1.getCommitHistory)(this.repoRoot, query, limit);
                if (commits.length === 0)
                    return 'No commits found.';
                const rows = commits.map(c => `| \`${c.hash}\` | ${c.author} | ${c.date.slice(0, 10)} | ${c.message} |`);
                return `## Commit History${query ? ` (search: "${query}")` : ''}\n\n| Hash | Author | Date | Message |\n|------|--------|------|--------|\n${rows.join('\n')}`;
            }
            case 'install_hooks': {
                const result = (0, hooks_js_1.installHooks)(this.repoRoot, {
                    preCommit: args.preCommit ?? true,
                    prePush: args.prePush ?? false,
                });
                let md = `## Git Hook Installation\n\n`;
                if (result.installed.length)
                    md += `✅ Installed: ${result.installed.join(', ')}\n`;
                if (result.errors.length)
                    md += `❌ Errors:\n${result.errors.map(e => `- ${e}`).join('\n')}\n`;
                return md;
            }
            default:
                throw new Error(`Unknown git tool: ${name}`);
        }
    }
}
exports.GitTools = GitTools;
//# sourceMappingURL=git.js.map
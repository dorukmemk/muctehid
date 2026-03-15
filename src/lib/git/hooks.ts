import * as fs from 'fs';
import * as path from 'path';

const PRE_COMMIT_HOOK = `#!/bin/sh
# code-audit-mcp pre-commit hook
# Auto-installed by code-audit-mcp

echo "[code-audit] Running pre-commit security check..."
node "$(dirname "$0")/../../.mcp/code-audit/dist/index.js" --hook pre-commit 2>/dev/null || true
echo "[code-audit] Pre-commit check complete."
`;

const PRE_PUSH_HOOK = `#!/bin/sh
# code-audit-mcp pre-push hook
echo "[code-audit] Running pre-push security check..."
node "$(dirname "$0")/../../.mcp/code-audit/dist/index.js" --hook pre-push 2>/dev/null || true
`;

export function installHooks(repoPath: string, hooks: { preCommit?: boolean; prePush?: boolean }): { installed: string[]; errors: string[] } {
  const hooksDir = path.join(repoPath, '.git', 'hooks');
  const installed: string[] = [];
  const errors: string[] = [];

  if (!fs.existsSync(hooksDir)) {
    errors.push('.git/hooks directory not found. Are you in a git repository?');
    return { installed, errors };
  }

  if (hooks.preCommit) {
    try {
      const hookPath = path.join(hooksDir, 'pre-commit');
      fs.writeFileSync(hookPath, PRE_COMMIT_HOOK, { mode: 0o755 });
      installed.push('pre-commit');
    } catch (e) {
      errors.push(`Failed to install pre-commit hook: ${e}`);
    }
  }

  if (hooks.prePush) {
    try {
      const hookPath = path.join(hooksDir, 'pre-push');
      fs.writeFileSync(hookPath, PRE_PUSH_HOOK, { mode: 0o755 });
      installed.push('pre-push');
    } catch (e) {
      errors.push(`Failed to install pre-push hook: ${e}`);
    }
  }

  return { installed, errors };
}

export function removeHooks(repoPath: string): string[] {
  const hooksDir = path.join(repoPath, '.git', 'hooks');
  const removed: string[] = [];

  for (const hookName of ['pre-commit', 'pre-push']) {
    const hookPath = path.join(hooksDir, hookName);
    if (fs.existsSync(hookPath)) {
      const content = fs.readFileSync(hookPath, 'utf-8');
      if (content.includes('code-audit-mcp')) {
        fs.unlinkSync(hookPath);
        removed.push(hookName);
      }
    }
  }

  return removed;
}

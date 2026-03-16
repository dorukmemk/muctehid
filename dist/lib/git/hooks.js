"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.installHooks = installHooks;
exports.removeHooks = removeHooks;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
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
function installHooks(repoPath, hooks) {
    const hooksDir = path.join(repoPath, '.git', 'hooks');
    const installed = [];
    const errors = [];
    if (!fs.existsSync(hooksDir)) {
        errors.push('.git/hooks directory not found. Are you in a git repository?');
        return { installed, errors };
    }
    if (hooks.preCommit) {
        try {
            const hookPath = path.join(hooksDir, 'pre-commit');
            fs.writeFileSync(hookPath, PRE_COMMIT_HOOK, { mode: 0o755 });
            installed.push('pre-commit');
        }
        catch (e) {
            errors.push(`Failed to install pre-commit hook: ${e}`);
        }
    }
    if (hooks.prePush) {
        try {
            const hookPath = path.join(hooksDir, 'pre-push');
            fs.writeFileSync(hookPath, PRE_PUSH_HOOK, { mode: 0o755 });
            installed.push('pre-push');
        }
        catch (e) {
            errors.push(`Failed to install pre-push hook: ${e}`);
        }
    }
    return { installed, errors };
}
function removeHooks(repoPath) {
    const hooksDir = path.join(repoPath, '.git', 'hooks');
    const removed = [];
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
//# sourceMappingURL=hooks.js.map
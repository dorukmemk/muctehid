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
exports.auditFile = auditFile;
exports.auditDiff = auditDiff;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const security_js_1 = require("../lib/audit/security.js");
const quality_js_1 = require("../lib/audit/quality.js");
const secrets_js_1 = require("../lib/audit/secrets.js");
const complexity_js_1 = require("../lib/audit/complexity.js");
const crypto = __importStar(require("crypto"));
function auditFile(filepath) {
    if (!fs.existsSync(filepath)) {
        return { issues: [], markdown: `File not found: ${filepath}` };
    }
    const content = fs.readFileSync(filepath, 'utf-8');
    const issues = [
        ...(0, security_js_1.scanSecurity)(filepath, content),
        ...(0, quality_js_1.scanQuality)(filepath, content),
        ...(0, complexity_js_1.complexityIssues)(filepath),
    ];
    const secrets = (0, secrets_js_1.scanSecrets)(filepath, content);
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
function auditDiff(diffContent, parsedFiles) {
    const issues = [];
    for (const file of parsedFiles) {
        const addedLines = file.hunks
            .flatMap(h => h.lines.filter(l => l.type === 'add').map(l => l.content))
            .join('\n');
        if (addedLines.trim()) {
            issues.push(...(0, security_js_1.scanSecurity)(file.filepath, addedLines));
            const secrets = (0, secrets_js_1.scanSecrets)(file.filepath, addedLines);
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
function formatAuditMarkdown(filepath, issues) {
    const bySeverity = (s) => issues.filter(i => i.severity === s);
    let md = `# Audit: ${path.basename(filepath)}\n\n`;
    md += `**File:** \`${filepath}\`\n`;
    md += `**Total issues:** ${issues.length} (`;
    md += `🔴 ${bySeverity('critical').length} critical, `;
    md += `🟠 ${bySeverity('high').length} high, `;
    md += `🟡 ${bySeverity('medium').length} medium, `;
    md += `⚪ ${bySeverity('low').length} low)\n\n`;
    if (issues.length === 0)
        return md + '✅ No issues found.\n';
    for (const severity of ['critical', 'high', 'medium', 'low']) {
        const group = bySeverity(severity);
        if (!group.length)
            continue;
        const emoji = { critical: '🔴', high: '🟠', medium: '🟡', low: '⚪', info: 'ℹ️' }[severity];
        md += `## ${emoji} ${severity.toUpperCase()}\n\n`;
        for (const i of group) {
            md += `### ${i.title}\n`;
            md += `- **Line:** ${i.line ?? 'N/A'}\n`;
            md += `- **Category:** ${i.category}\n`;
            if (i.owaspCategory)
                md += `- **OWASP:** ${i.owaspCategory}`;
            if (i.cwe)
                md += ` | **CWE:** ${i.cwe}`;
            if (i.owaspCategory || i.cwe)
                md += '\n';
            md += `- ${i.description}\n`;
            if (i.fix)
                md += `- **Fix:** ${i.fix}\n`;
            if (i.code)
                md += `\`\`\`\n${i.code}\n\`\`\`\n`;
            md += '\n';
        }
    }
    return md;
}
//# sourceMappingURL=audit.js.map
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
exports.computeHealthScore = computeHealthScore;
const fs = __importStar(require("fs"));
const glob_1 = require("glob");
const security_js_1 = require("./security.js");
const quality_js_1 = require("./quality.js");
const secrets_js_1 = require("./secrets.js");
const complexity_js_1 = require("./complexity.js");
const SEVERITY_PENALTY = {
    critical: 25,
    high: 10,
    medium: 4,
    low: 1,
    info: 0,
};
async function computeHealthScore(repoPath, files) {
    const allFiles = files ?? await (0, glob_1.glob)('**/*.{ts,tsx,js,jsx,py,go,rs,java,cs,php,rb}', {
        cwd: repoPath,
        absolute: true,
        ignore: ['**/node_modules/**', '**/dist/**', '**/.git/**', '**/.audit-data/**'],
    });
    const allIssues = [];
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
            if (/\.(test|spec)\.|__tests__|test\/|tests\//.test(file))
                testFiles++;
            allIssues.push(...(0, security_js_1.scanSecurity)(file, content), ...(0, quality_js_1.scanQuality)(file, content), ...(0, complexity_js_1.complexityIssues)(file));
            // Secrets as critical issues
            const secrets = (0, secrets_js_1.scanSecrets)(file, content);
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
        }
        catch { /* skip unreadable files */ }
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
    const total = Math.round(securityScore * 0.30 +
        qualityScore * 0.25 +
        docsScore * 0.20 +
        testsScore * 0.15 +
        depsScore * 0.10);
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
function penaltySum(issues) {
    return issues.reduce((sum, i) => sum + (SEVERITY_PENALTY[i.severity] ?? 0), 0);
}
function gradeOf(score) {
    if (score >= 90)
        return 'excellent';
    if (score >= 70)
        return 'good';
    if (score >= 50)
        return 'needs-attention';
    return 'critical';
}
//# sourceMappingURL=scorer.js.map
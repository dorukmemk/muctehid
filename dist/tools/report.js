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
exports.ReportTools = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const crypto = __importStar(require("crypto"));
class ReportTools {
    reportsDir;
    repoRoot;
    constructor(reportsDir, repoRoot) {
        this.reportsDir = reportsDir;
        this.repoRoot = repoRoot;
        fs.mkdirSync(reportsDir, { recursive: true });
    }
    async handleTool(name, args) {
        switch (name) {
            case 'generate_report': {
                const { computeHealthScore } = await Promise.resolve().then(() => __importStar(require('../lib/audit/scorer.js')));
                const health = await computeHealthScore(this.repoRoot);
                const report = this.buildReport(health);
                const mdPath = path.join(this.reportsDir, `report-${report.id}.md`);
                const jsonPath = path.join(this.reportsDir, `report-${report.id}.json`);
                fs.writeFileSync(mdPath, this.toMarkdown(report));
                fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));
                return `## Report Generated\n\n**ID:** ${report.id}\n**Health Score:** ${health.total}/100 (${health.grade})\n**Total Issues:** ${report.summary.totalIssues}\n\n**Files:**\n- Markdown: \`${mdPath}\`\n- JSON: \`${jsonPath}\`\n\n${this.toMarkdown(report)}`;
            }
            case 'export_report': {
                const reportId = args.id;
                const format = args.format ?? 'markdown';
                const file = this.findReport(reportId);
                if (!file)
                    throw new Error(`Report ${reportId} not found.`);
                const jsonData = fs.readFileSync(file.json, 'utf-8');
                const report = JSON.parse(jsonData);
                if (format === 'json')
                    return jsonData;
                if (format === 'html')
                    return this.toHtml(report);
                return fs.readFileSync(file.md, 'utf-8');
            }
            case 'compare_reports': {
                const id1 = args.id1;
                const id2 = args.id2;
                const file1 = this.findReport(id1);
                const file2 = this.findReport(id2);
                if (!file1)
                    throw new Error(`Report ${id1} not found.`);
                if (!file2)
                    throw new Error(`Report ${id2} not found.`);
                const r1 = JSON.parse(fs.readFileSync(file1.json, 'utf-8'));
                const r2 = JSON.parse(fs.readFileSync(file2.json, 'utf-8'));
                const diff = r2.healthScore.total - r1.healthScore.total;
                const arrow = diff > 0 ? '⬆️' : diff < 0 ? '⬇️' : '➡️';
                return `## Report Comparison\n\n| Metric | Report A | Report B | Change |\n|--------|----------|----------|--------|\n` +
                    `| Health Score | ${r1.healthScore.total} | ${r2.healthScore.total} | ${arrow} ${Math.abs(diff)} |\n` +
                    `| Issues | ${r1.summary.totalIssues} | ${r2.summary.totalIssues} | ${r2.summary.totalIssues - r1.summary.totalIssues} |\n` +
                    `| Critical | ${r1.summary.critical} | ${r2.summary.critical} | ${r2.summary.critical - r1.summary.critical} |\n` +
                    `| High | ${r1.summary.high} | ${r2.summary.high} | ${r2.summary.high - r1.summary.high} |\n`;
            }
            default:
                throw new Error(`Unknown report tool: ${name}`);
        }
    }
    buildReport(health) {
        const id = crypto.randomUUID().slice(0, 8);
        const bySeverity = (s) => health.issues.filter(i => i.severity === s).length;
        return {
            id,
            title: `Code Audit Report`,
            timestamp: Date.now(),
            repoPath: this.repoRoot,
            healthScore: health,
            issues: health.issues,
            summary: {
                totalFiles: 0,
                totalIssues: health.issues.length,
                critical: bySeverity('critical'),
                high: bySeverity('high'),
                medium: bySeverity('medium'),
                low: bySeverity('low'),
            },
        };
    }
    toMarkdown(report) {
        const h = report.healthScore;
        const grade = { excellent: '🟢', good: '🟡', 'needs-attention': '🟠', critical: '🔴' }[h.grade];
        let md = `# Code Audit Report\n\n`;
        md += `**Date:** ${new Date(report.timestamp).toLocaleString()}  \n`;
        md += `**Repo:** \`${report.repoPath}\`\n\n`;
        md += `## Health Score: ${h.total}/100 ${grade} (${h.grade})\n\n`;
        md += `| Component | Score |\n|-----------|-------|\n`;
        md += `| Security | ${h.security}/100 |\n`;
        md += `| Quality | ${h.quality}/100 |\n`;
        md += `| Docs | ${h.docs}/100 |\n`;
        md += `| Tests | ${h.tests}/100 |\n`;
        md += `| Dependencies | ${h.dependencies}/100 |\n\n`;
        md += `## Summary\n\n`;
        md += `- **Total Issues:** ${report.summary.totalIssues}\n`;
        md += `- 🔴 Critical: ${report.summary.critical}\n`;
        md += `- 🟠 High: ${report.summary.high}\n`;
        md += `- 🟡 Medium: ${report.summary.medium}\n`;
        md += `- ⚪ Low: ${report.summary.low}\n\n`;
        return md;
    }
    toHtml(report) {
        const md = this.toMarkdown(report);
        return `<!DOCTYPE html><html><head><title>Audit Report</title><style>body{font-family:sans-serif;max-width:900px;margin:40px auto;padding:0 20px}pre{background:#f4f4f4;padding:10px;overflow:auto}</style></head><body><pre>${md.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre></body></html>`;
    }
    findReport(id) {
        const files = fs.readdirSync(this.reportsDir);
        const md = files.find(f => f.includes(id) && f.endsWith('.md'));
        const json = files.find(f => f.includes(id) && f.endsWith('.json'));
        if (!md || !json)
            return null;
        return {
            md: path.join(this.reportsDir, md),
            json: path.join(this.reportsDir, json),
        };
    }
}
exports.ReportTools = ReportTools;
//# sourceMappingURL=report.js.map
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
exports.SkillRunner = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const security_js_1 = require("../audit/security.js");
const quality_js_1 = require("../audit/quality.js");
const secrets_js_1 = require("../audit/secrets.js");
const complexity_js_1 = require("../audit/complexity.js");
class SkillRunner {
    async run(skill, opts) {
        const start = Date.now();
        try {
            const output = await this.execute(skill, opts);
            return {
                skill: skill.name,
                success: true,
                output,
                duration: Date.now() - start,
            };
        }
        catch (e) {
            return {
                skill: skill.name,
                success: false,
                output: `Error running skill "${skill.name}": ${e instanceof Error ? e.message : String(e)}`,
                duration: Date.now() - start,
            };
        }
    }
    async execute(skill, opts) {
        const target = (opts.path ?? opts.filepath ?? opts.file);
        switch (skill.name) {
            case 'security-audit':
                return this.runSecurityAudit(target, opts);
            case 'code-review':
                return this.runCodeReview(target, opts);
            case 'dependency-risk':
                return this.runDependencyRisk(target, opts);
            case 'performance-audit':
                return this.runPerformanceAudit(target);
            case 'refactor-planner':
                return this.runRefactorPlanner(target, opts);
            case 'doc-analyzer':
                return this.runDocAnalyzer(target);
            case 'feature-planner':
                return this.runGeneric(skill, opts);
            case 'bug-reporter':
                return this.runBugReporter(target, opts);
            case 'deep-dive':
                return this.runDeepDive(target, opts);
            case 'audit-runner':
                return this.runAuditRunner(target, opts);
            case 'pitch-deck':
                return this.runGeneric(skill, opts);
            case 'deep-planner':
                return this.runDeepPlanner(target, opts);
            case 'session-restore':
                return this.runSessionRestore(target, opts);
            case 'auto-fixer':
                return this.runAutoFixer(target, opts);
            case 'code-archaeologist':
                return this.runCodeArchaeologist(target, opts);
            case 'impact-analyzer':
                return this.runImpactAnalyzer(target, opts);
            case 'test-generator':
                return this.runTestGenerator(target, opts);
            case 'doc-generator':
                return this.runDocGenerator(target, opts);
            case 'accessibility-check':
                return this.runAccessibilityCheck(target, opts);
            case 'license-scan':
                return this.runLicenseScan(target, opts);
            case 'refactor-suggest':
                return this.runRefactorSuggest(target, opts);
            case 'feature-planner':
                return this.runFeaturePlanner(opts);
            default:
                // Generic: return skill instructions with context
                return this.runGeneric(skill, opts);
        }
    }
    // ─── Helper: code context excerpt ────────────────────────────────────────────
    getCodeContext(filepath, line, contextLines = 5) {
        if (!line)
            return '';
        try {
            const lines = fs.readFileSync(filepath, 'utf-8').split('\n');
            const start = Math.max(0, line - contextLines - 1);
            const end = Math.min(lines.length, line + contextLines);
            const numbered = lines.slice(start, end).map((l, i) => `${start + i + 1 === line ? '→' : ' '} ${start + i + 1}: ${l}`);
            return '```\n' + numbered.join('\n') + '\n```';
        }
        catch {
            return '';
        }
    }
    // ─── Helper: OWASP category link ─────────────────────────────────────────────
    owaspLink(category) {
        if (!category)
            return '';
        const slug = category.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        return `[${category}](https://owasp.org/www-project-top-ten/${slug}/)`;
    }
    // ─── Skills ──────────────────────────────────────────────────────────────────
    async runSecurityAudit(target, opts) {
        const deep = opts.depth === 'deep';
        const issues = [];
        const files = this.resolveFiles(target);
        for (const file of files) {
            try {
                const content = fs.readFileSync(file, 'utf-8');
                issues.push(...(0, security_js_1.scanSecurity)(file, content));
                const secrets = (0, secrets_js_1.scanSecrets)(file, content);
                for (const s of secrets) {
                    issues.push({
                        id: `secret-${s.line}`,
                        severity: 'critical',
                        category: 'secret',
                        title: `Secret: ${s.type}`,
                        description: `Potential ${s.type} found`,
                        filepath: file,
                        line: s.line,
                        fix: 'Move to environment variables.',
                    });
                }
            }
            catch { /* skip */ }
        }
        if (!deep) {
            return formatIssuesMarkdown('Security Audit', issues, files.length);
        }
        // ── deep mode ───────────────────────────────────────────────────────────────
        const critical = issues.filter(i => i.severity === 'critical');
        const high = issues.filter(i => i.severity === 'high');
        const medium = issues.filter(i => i.severity === 'medium');
        const low = issues.filter(i => i.severity === 'low');
        let output = `## Security Audit (Deep Mode)\n\n`;
        output += `**Files analyzed:** ${files.length} | **Issues:** ${issues.length}`;
        output += ` (🔴 ${critical.length} critical, 🟠 ${high.length} high, 🟡 ${medium.length} medium, ⚪ ${low.length} low)\n\n`;
        // Summary table per file
        const fileMap = new Map();
        for (const i of issues) {
            if (!fileMap.has(i.filepath))
                fileMap.set(i.filepath, { critical: 0, high: 0, medium: 0 });
            const r = fileMap.get(i.filepath);
            if (i.severity === 'critical')
                r.critical++;
            else if (i.severity === 'high')
                r.high++;
            else if (i.severity === 'medium')
                r.medium++;
        }
        output += `### Summary Table\n\n| File | Critical | High | Medium |\n|------|----------|------|--------|\n`;
        for (const [fp, counts] of fileMap) {
            output += `| \`${fp}\` | ${counts.critical} | ${counts.high} | ${counts.medium} |\n`;
        }
        output += '\n';
        // Per-severity detailed findings with code excerpts + OWASP links + remediation
        for (const severity of ['critical', 'high', 'medium', 'low']) {
            const group = issues.filter(i => i.severity === severity);
            if (group.length === 0)
                continue;
            const emoji = { critical: '🔴', high: '🟠', medium: '🟡', low: '⚪' }[severity];
            output += `### ${emoji} ${severity.toUpperCase()} (${group.length})\n\n`;
            for (const issue of group) {
                output += `#### ${issue.title}\n`;
                output += `- **File:** \`${issue.filepath}${issue.line ? ':' + issue.line : ''}\`\n`;
                if (issue.owaspCategory)
                    output += `- **OWASP:** ${this.owaspLink(issue.owaspCategory)}\n`;
                if (issue.cwe)
                    output += `- **CWE:** [CWE-${issue.cwe}](https://cwe.mitre.org/data/definitions/${issue.cwe}.html)\n`;
                output += `- **Description:** ${issue.description}\n\n`;
                const ctx = this.getCodeContext(issue.filepath, issue.line, 3);
                if (ctx)
                    output += `**Vulnerable code:**\n${ctx}\n\n`;
                if (issue.fix) {
                    output += `**Step-by-step remediation:**\n`;
                    output += `1. Locate line ${issue.line ?? '?'} in \`${issue.filepath}\`.\n`;
                    output += `2. ${issue.fix}\n`;
                    output += `3. Re-run \`security_scan\` to confirm the issue is resolved.\n\n`;
                }
            }
        }
        // Recommended task order by blast radius (critical first, then high)
        output += `## Recommended Task Order\n\n`;
        output += `Fix issues in the following order based on severity and blast radius:\n\n`;
        let taskIdx = 1;
        for (const issue of [...critical, ...high].slice(0, 10)) {
            output += `${taskIdx++}. **${issue.title}** — \`${issue.filepath}:${issue.line ?? '?'}\` [${issue.severity.toUpperCase()}]\n`;
        }
        return output;
    }
    async runCodeReview(target, opts) {
        const deep = opts.depth === 'deep';
        const issues = [];
        const files = this.resolveFiles(target);
        for (const file of files) {
            try {
                const content = fs.readFileSync(file, 'utf-8');
                issues.push(...(0, quality_js_1.scanQuality)(file, content));
                issues.push(...(0, complexity_js_1.complexityIssues)(file));
            }
            catch { /* skip */ }
        }
        if (!deep) {
            return formatIssuesMarkdown('Code Review', issues, files.length);
        }
        // ── deep mode ───────────────────────────────────────────────────────────────
        const critical = issues.filter(i => i.severity === 'critical');
        const high = issues.filter(i => i.severity === 'high');
        const medium = issues.filter(i => i.severity === 'medium');
        const low = issues.filter(i => i.severity === 'low');
        let output = `## Code Review (Deep Mode)\n\n`;
        output += `**Files analyzed:** ${files.length} | **Issues:** ${issues.length}`;
        output += ` (🔴 ${critical.length} critical, 🟠 ${high.length} high, 🟡 ${medium.length} medium, ⚪ ${low.length} low)\n\n`;
        // Pattern frequency table
        const patternCount = new Map();
        for (const i of issues) {
            patternCount.set(i.category, (patternCount.get(i.category) ?? 0) + 1);
        }
        output += `### Pattern Frequency\n\n| Category | Count |\n|----------|-------|\n`;
        for (const [cat, cnt] of [...patternCount.entries()].sort((a, b) => b[1] - a[1])) {
            output += `| ${cat} | ${cnt} |\n`;
        }
        output += '\n';
        // Technical debt score per file
        const fileDebt = new Map();
        for (const i of issues) {
            const weight = { critical: 10, high: 5, medium: 2, low: 1, info: 0 }[i.severity] ?? 0;
            fileDebt.set(i.filepath, (fileDebt.get(i.filepath) ?? 0) + weight);
        }
        const sortedByDebt = [...fileDebt.entries()].sort((a, b) => b[1] - a[1]);
        if (sortedByDebt.length > 0) {
            output += `### Technical Debt Score (per file)\n\n| File | Debt Score |\n|------|------------|\n`;
            for (const [fp, score] of sortedByDebt) {
                output += `| \`${fp}\` | ${score} |\n`;
            }
            output += '\n';
        }
        // Detailed findings with code excerpts + refactoring before/after hints
        for (const severity of ['critical', 'high', 'medium', 'low']) {
            const group = issues.filter(i => i.severity === severity);
            if (group.length === 0)
                continue;
            const emoji = { critical: '🔴', high: '🟠', medium: '🟡', low: '⚪' }[severity];
            output += `### ${emoji} ${severity.toUpperCase()} (${group.length})\n\n`;
            for (const issue of group) {
                output += `#### ${issue.title}\n`;
                output += `- **File:** \`${issue.filepath}${issue.line ? ':' + issue.line : ''}\`\n`;
                output += `- **Description:** ${issue.description}\n\n`;
                const ctx = this.getCodeContext(issue.filepath, issue.line, 5);
                if (ctx)
                    output += `**Problematic code block:**\n${ctx}\n\n`;
                if (issue.fix) {
                    output += `**Refactoring suggestion:**\n`;
                    output += `- Before: (see code block above)\n`;
                    output += `- After: ${issue.fix}\n\n`;
                }
            }
        }
        return output;
    }
    async runDependencyRisk(target, _opts) {
        const pkgPath = target
            ? (fs.existsSync(path.join(target, 'package.json')) ? path.join(target, 'package.json') : target)
            : 'package.json';
        if (!fs.existsSync(pkgPath)) {
            return '## Dependency Risk\n\npackage.json bulunamadı. `path` parametresi ile dizini belirtin.';
        }
        try {
            const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
            const prodDeps = (pkg.dependencies ?? {});
            const devDeps = (pkg.devDependencies ?? {});
            const allDeps = { ...prodDeps, ...devDeps };
            const count = Object.keys(allDeps).length;
            // Known risky packages / deprecated patterns
            const KNOWN_RISKY = {
                'event-stream': '⛔ Malware tarihi var (2018 supply chain saldırısı)',
                'node-uuid': '⚠️ Deprecated — uuid kullanın',
                'request': '⚠️ Archived/unmaintained — node-fetch veya undici kullanın',
                'lodash': '⚠️ Büyük bundle — tree-shake\'lenebilen lodash-es veya native kullanın',
                'moment': '⚠️ Deprecated — date-fns veya dayjs kullanın',
                'left-pad': '⚠️ Tarihi tehlike (2016 unpublish olayı) — String.padStart kullanın',
                'colors': '⚠️ Maintainer sabotaj yaşandı — chalk kullanın',
                'faker': '⚠️ Eski sürümler sabote edildi — @faker-js/faker kullanın',
                'crypto': '⚠️ Built-in Node.js ile çakışır — paket adını kontrol edin',
                'minimist': '⚠️ Prototype pollution CVE\'leri var — yeni sürüm veya yargs kullanın',
            };
            const risky = [];
            const pinned = [];
            const unpinned = [];
            for (const [name, version] of Object.entries(allDeps)) {
                if (KNOWN_RISKY[name]) {
                    risky.push({ name, version, reason: KNOWN_RISKY[name], isProd: name in prodDeps });
                }
                if (/^\d/.test(version) || version.startsWith('=')) {
                    pinned.push(`${name}@${version}`);
                }
                else if (version.startsWith('^') || version.startsWith('~')) {
                    // Fine — semver range
                }
                else if (version.startsWith('*') || version === 'latest') {
                    unpinned.push(`${name}@${version}`);
                }
            }
            let output = `## Dependency Risk Analizi\n\n`;
            output += `**Proje:** ${pkg.name ?? '(unknown)'} v${pkg.version ?? '?'}\n`;
            output += `**Toplam bağımlılık:** ${count} (prod: ${Object.keys(prodDeps).length}, dev: ${Object.keys(devDeps).length})\n\n`;
            // Risk summary table
            output += `### Risk Özeti\n\n| Kategori | Durum |\n|----------|-------|\n`;
            output += `| ⛔ Bilinen tehlikeli paket | ${risky.filter(r => r.reason.startsWith('⛔')).length} |\n`;
            output += `| ⚠️ Deprecated/riskli paket | ${risky.filter(r => r.reason.startsWith('⚠️')).length} |\n`;
            output += `| 📌 Sürüm sabitlenmiş (=x.y.z) | ${pinned.length} |\n`;
            output += `| ⚡ Wildcard sürüm (*,latest) | ${unpinned.length} |\n\n`;
            if (unpinned.length > 0) {
                output += `### ⚡ Wildcard Sürümler (RİSKLİ)\n\nBu paketler her install'da farklı sürüm yükleyebilir:\n\n`;
                for (const p of unpinned)
                    output += `- \`${p}\`\n`;
                output += '\n';
            }
            if (risky.length > 0) {
                output += `### ⚠️ Riskli / Deprecated Paketler\n\n| Paket | Sürüm | Risk | Prod? |\n|-------|-------|------|-------|\n`;
                for (const r of risky) {
                    output += `| \`${r.name}\` | ${r.version} | ${r.reason} | ${r.isProd ? 'Evet' : 'Hayır'} |\n`;
                }
                output += '\n';
            }
            if (risky.length === 0 && unpinned.length === 0) {
                output += `✅ Bilinen riskli paket bulunamadı.\n\n`;
            }
            output += `### Sonraki Adımlar\n`;
            output += `1. \`npm audit\` — CVE taraması yapın\n`;
            output += `2. \`npm outdated\` — Güncellenebilir paketleri görün\n`;
            output += `3. \`npx depcheck\` — Kullanılmayan bağımlılıkları tespit edin\n`;
            output += `4. \`npx license-checker\` — Lisans uyumluluğunu kontrol edin\n`;
            return output;
        }
        catch (e) {
            return `## Dependency Risk\n\npackage.json parse hatası: ${e instanceof Error ? e.message : String(e)}`;
        }
    }
    async runPerformanceAudit(target) {
        const patterns = [
            // Async anti-patterns
            { pattern: /\.forEach\s*\(\s*async/, severity: 'high', label: 'async forEach (Promise\'lar paralel çalışmaz)', fix: 'Promise.all(arr.map(async item => ...)) kullanın' },
            { pattern: /await.*for\s*\(.*of/, severity: 'medium', label: 'Seri await döngüsü (N+1 pattern)', fix: 'Promise.all ile paralelleştirin' },
            { pattern: /new Promise\s*\(\s*\(\s*resolve/, severity: 'low', label: 'Gereksiz Promise sarmalama', fix: 'Async/await veya doğrudan Promise döndürün' },
            // Memory/CPU
            { pattern: /JSON\.parse\s*\(\s*JSON\.stringify/, severity: 'high', label: 'Pahalı deep clone (JSON round-trip)', fix: 'structuredClone() kullanın (Node 17+)' },
            { pattern: /setInterval|setTimeout.*0[^)]/, severity: 'medium', label: 'setTimeout(fn, 0) — CPU busy wait', fix: 'setImmediate() veya queueMicrotask() kullanın' },
            { pattern: /while\s*\(\s*true\s*\)/, severity: 'critical', label: 'Sonsuz döngü (CPU %100 riski)', fix: 'Break condition veya async iteration kullanın' },
            // String/Array
            { pattern: /\+\s*['"`][^'"`]{0,50}['"`]\s*\+/, severity: 'low', label: 'String birleştirme (+ operator)', fix: 'Template literal kullanın: `${var}`' },
            { pattern: /\.filter\(.*\)\.map\(|\.map\(.*\)\.filter\(/, severity: 'medium', label: 'Zincirleme filter+map (çift iterasyon)', fix: '.reduce() veya tek geçişte işleyin' },
            { pattern: /Array\.from\s*\(\s*\{.*length/, severity: 'low', label: 'Array.from({length}) — alternatif var', fix: 'Array.from({length: n}, (_, i) => i) veya [...Array(n)]' },
            // DB / IO patterns
            { pattern: /for.*await.*find|for.*await.*query|for.*await.*get/, severity: 'critical', label: 'N+1 veritabanı sorgusu döngüsü', fix: 'Batch query veya JOIN kullanın' },
            { pattern: /readFileSync|writeFileSync/, severity: 'medium', label: 'Senkron dosya I/O (event loop bloklar)', fix: 'fs.promises.readFile / writeFile kullanın' },
            { pattern: /require\s*\(/, severity: 'low', label: 'CommonJS require (ES module\'de)', fix: 'import kullanın veya lazy load uygulayın' },
            // React specific
            { pattern: /useEffect\s*\([^,)]+\)/, severity: 'medium', label: 'useEffect dependency array eksik', fix: 'İkinci argüman olarak dependency array ekleyin' },
            { pattern: /style\s*=\s*\{\s*\{/, severity: 'low', label: 'Inline style object (her render\'da yeni obje)', fix: 'useMemo veya CSS class kullanın' },
        ];
        const files = this.resolveFiles(target);
        const findings = [];
        for (const file of files) {
            try {
                const lines = fs.readFileSync(file, 'utf-8').split('\n');
                for (let i = 0; i < lines.length; i++) {
                    const line = lines[i];
                    // Skip comment lines
                    if (/^\s*(\/\/|\/\*|\*)/.test(line))
                        continue;
                    for (const p of patterns) {
                        if (p.pattern.test(line)) {
                            findings.push({ file, line: i + 1, label: p.label, severity: p.severity, fix: p.fix });
                        }
                    }
                }
            }
            catch { /* skip */ }
        }
        const critical = findings.filter(f => f.severity === 'critical');
        const high = findings.filter(f => f.severity === 'high');
        const medium = findings.filter(f => f.severity === 'medium');
        const low = findings.filter(f => f.severity === 'low');
        let output = `## Performance Audit\n\n`;
        output += `**Taranan dosya:** ${files.length} | **Sorun:** ${findings.length}`;
        output += ` (🔴 ${critical.length} kritik, 🟠 ${high.length} yüksek, 🟡 ${medium.length} orta, ⚪ ${low.length} düşük)\n\n`;
        if (findings.length === 0) {
            output += '✅ Belirgin performans sorunu bulunamadı.\n';
            return output;
        }
        for (const [sev, group, emoji] of [
            ['critical', critical, '🔴'],
            ['high', high, '🟠'],
            ['medium', medium, '🟡'],
            ['low', low, '⚪'],
        ]) {
            if (group.length === 0)
                continue;
            output += `### ${emoji} ${sev.toUpperCase()} (${group.length})\n\n`;
            for (const f of group) {
                output += `- **\`${f.file}:${f.line}\`** — ${f.label}\n  → ${f.fix}\n`;
            }
            output += '\n';
        }
        output += `### Önerilen Düzeltme Sırası\n`;
        output += `1. N+1 sorgu döngülerini batch query ile değiştirin (en büyük etki)\n`;
        output += `2. async forEach'leri Promise.all ile paralelleştirin\n`;
        output += `3. Senkron dosya I/O'yu async'e taşıyın\n`;
        output += `4. JSON.stringify/parse deep clone'larını structuredClone'a taşıyın\n`;
        return output;
    }
    async runRefactorPlanner(target, opts) {
        const deep = opts.depth === 'deep';
        const files = this.resolveFiles(target);
        const allIssues = [];
        for (const file of files) {
            try {
                const issues = (0, complexity_js_1.complexityIssues)(file);
                for (const i of issues) {
                    allIssues.push({ file, issue: i });
                }
            }
            catch { /* skip */ }
        }
        if (!deep) {
            let output = `## Refactor Planı\n\n**Analiz edilen dosya:** ${files.length}\n\n`;
            if (allIssues.length === 0) {
                output += '✅ Refactor gerektiren kritik bölge bulunamadı.\n';
            }
            else {
                output += `### 🔴 Yüksek Complexity (${allIssues.length} bölge)\n\n`;
                output += allIssues.map(({ file, issue }) => `- **${file}:${issue.line}** — ${issue.title} (complexity: ${issue.description})`).join('\n') + '\n\n';
                output += `### Öneri\nEn yüksek complexity'li fonksiyonları küçük fonksiyonlara böl.\n`;
            }
            return output;
        }
        // ── deep mode ───────────────────────────────────────────────────────────────
        let output = `## Refactor Planı (Deep Mode)\n\n**Analiz edilen dosya:** ${files.length}\n\n`;
        if (allIssues.length === 0) {
            output += '✅ Refactor gerektiren kritik bölge bulunamadı.\n';
            return output;
        }
        // Show actual complex functions: name, line, description
        output += `### 🔴 Yüksek Complexity Fonksiyonlar (${allIssues.length})\n\n`;
        output += `| Dosya | Satır | Fonksiyon | Detay |\n|-------|-------|-----------|-------|\n`;
        for (const { file, issue } of allIssues) {
            output += `| \`${file}\` | ${issue.line ?? '?'} | ${issue.title} | ${issue.description} |\n`;
        }
        output += '\n';
        // Top 3 hotspots with before/after refactoring sketch and estimated hours
        const top3 = allIssues.slice(0, 3);
        output += `### Top 3 Hotspot — Refactor Taslağı\n\n`;
        for (let idx = 0; idx < top3.length; idx++) {
            const { file, issue } = top3[idx];
            output += `#### ${idx + 1}. ${issue.title} — \`${file}:${issue.line ?? '?'}\`\n`;
            output += `**Sorun:** ${issue.description}\n\n`;
            const ctx = this.getCodeContext(file, issue.line, 5);
            if (ctx)
                output += `**Mevcut kod:**\n${ctx}\n\n`;
            output += `**Önerilen refactor:**\n`;
            output += `- Fonksiyonu tek sorumluluk prensibine göre 2-3 küçük fonksiyona böl.\n`;
            output += `- Her dallanma (if/switch) için ayrı yardımcı fonksiyon çıkar.\n`;
            output += `- Döngü içi mantığı extract et.\n\n`;
            output += `**Tahmini süre:** ~${1 + idx} saat\n\n`;
        }
        output += `### Öneri\nEn yüksek complexity'li fonksiyonları küçük fonksiyonlara böl. Her adım için \`task_create\` çağrısı yap.\n`;
        return output;
    }
    async runDocAnalyzer(target) {
        const files = this.resolveFiles(target);
        let documented = 0;
        let total = 0;
        const missing = [];
        for (const file of files) {
            try {
                const content = fs.readFileSync(file, 'utf-8');
                const fnMatches = [...content.matchAll(/(?:export\s+)?(?:async\s+)?function\s+(\w+)/g)];
                const classMatches = [...content.matchAll(/(?:export\s+)?class\s+(\w+)/g)];
                const symbols = [...fnMatches, ...classMatches];
                total += symbols.length;
                for (const m of symbols) {
                    const idx = content.indexOf(m[0]);
                    const before = content.slice(Math.max(0, idx - 150), idx);
                    if (/\/\*\*[\s\S]*?\*\/\s*$/.test(before) || /\/\/[^\n]*\n\s*$/.test(before)) {
                        documented++;
                    }
                    else {
                        missing.push(`- \`${m[1]}\` in ${file}`);
                    }
                }
            }
            catch { /* skip */ }
        }
        const coverage = total > 0 ? Math.round((documented / total) * 100) : 100;
        let output = `## Dokümantasyon Analizi\n\n`;
        output += `**Kapsama:** %${coverage} (${documented}/${total} sembol)\n\n`;
        if (missing.length > 0) {
            output += `### Belgelenmemiş Semboller (${missing.length})\n${missing.slice(0, 20).join('\n')}\n`;
            if (missing.length > 20)
                output += `\n... ve ${missing.length - 20} daha.\n`;
        }
        else {
            output += '✅ Tüm public semboller belgelenmiş.\n';
        }
        return output;
    }
    async runBugReporter(target, opts) {
        const deep = opts.depth === 'deep';
        const files = this.resolveFiles(target);
        const issues = [];
        for (const file of files) {
            try {
                const content = fs.readFileSync(file, 'utf-8');
                issues.push(...(0, security_js_1.scanSecurity)(file, content));
            }
            catch { /* skip */ }
        }
        const criticalIssues = issues.filter(i => i.severity === 'critical' || i.severity === 'high');
        if (!deep) {
            let output = `## Bug Raporu\n\n**Taranan dosya:** ${files.length}\n`;
            output += `**Kritik/Yüksek sorun:** ${criticalIssues.length}\n\n`;
            if (criticalIssues.length === 0) {
                output += '✅ Kritik bug pattern bulunmadı.\n';
            }
            else {
                for (const issue of criticalIssues.slice(0, 10)) {
                    output += `### 🔴 ${issue.title}\n`;
                    output += `- **Dosya:** \`${issue.filepath}:${issue.line}\`\n`;
                    output += `- **Açıklama:** ${issue.description}\n`;
                    if (issue.fix)
                        output += `- **Fix:** ${issue.fix}\n`;
                    output += '\n';
                }
            }
            return output;
        }
        // ── deep mode ───────────────────────────────────────────────────────────────
        let output = `## Bug Raporu (Deep Mode)\n\n**Taranan dosya:** ${files.length}\n`;
        output += `**Kritik/Yüksek sorun:** ${criticalIssues.length}\n\n`;
        if (criticalIssues.length === 0) {
            output += '✅ Kritik bug pattern bulunmadı.\n';
            return output;
        }
        // Count files affected per issue category
        const categoryFiles = new Map();
        for (const i of issues) {
            if (!categoryFiles.has(i.category))
                categoryFiles.set(i.category, new Set());
            categoryFiles.get(i.category).add(i.filepath);
        }
        for (const issue of criticalIssues.slice(0, 10)) {
            const affectedFiles = categoryFiles.get(issue.category)?.size ?? 1;
            output += `### 🔴 ${issue.title}\n`;
            output += `- **Dosya:** \`${issue.filepath}:${issue.line ?? '?'}\`\n`;
            output += `- **Açıklama:** ${issue.description}\n\n`;
            // Code excerpt
            const ctx = this.getCodeContext(issue.filepath, issue.line, 3);
            if (ctx)
                output += `**İlgili kod:**\n${ctx}\n\n`;
            // Root cause analysis
            output += `**Kök neden analizi:**\n`;
            output += `Bu pattern genellikle güvenli olmayan kullanıcı girdisi doğrulamasından veya `;
            output += `eksik hata yönetiminden kaynaklanır. Kategori: \`${issue.category}\`.\n\n`;
            // Impact assessment
            output += `**Etki değerlendirmesi:**\n`;
            output += `Bu sorun \`${issue.category}\` kategorisindeki **${affectedFiles} dosyayı** etkiliyor.\n\n`;
            // Reproduction scenario
            output += `**Tetikleme senaryosu:**\n`;
            output += `1. \`${issue.filepath}\` dosyasının ${issue.line ?? '?'}. satırına kontrollü girdi gönderin.\n`;
            output += `2. ${issue.description}\n\n`;
            // Fix steps
            if (issue.fix) {
                output += `**Düzeltme adımları:**\n`;
                output += `1. \`${issue.filepath}\` dosyasını aç, satır ${issue.line ?? '?'} civarını incele.\n`;
                output += `2. Uygula: ${issue.fix}\n`;
                output += `3. Değişikliği kaydet ve \`security_scan\` ile doğrula.\n\n`;
            }
        }
        return output;
    }
    async runDeepDive(target, opts) {
        const deep = opts.depth === 'deep';
        if (!target)
            return '## Deep Dive\n\nLütfen bir dosya veya dizin belirtin.';
        const files = this.resolveFiles(target);
        const secIssues = [];
        const qualIssues = [];
        for (const file of files) {
            try {
                const content = fs.readFileSync(file, 'utf-8');
                secIssues.push(...(0, security_js_1.scanSecurity)(file, content));
                qualIssues.push(...(0, quality_js_1.scanQuality)(file, content));
            }
            catch { /* skip */ }
        }
        const secScore = Math.max(0, 10 - Math.floor(secIssues.filter(i => i.severity === 'critical' || i.severity === 'high').length * 2));
        const qualScore = Math.max(0, 10 - Math.floor(qualIssues.length * 0.5));
        const overall = Math.round((secScore + qualScore) / 2);
        if (!deep) {
            let output = `## Deep Dive: ${target}\n\n`;
            output += `| Boyut | Skor | Detay |\n|-------|------|-------|\n`;
            output += `| Güvenlik | ${secScore}/10 | ${secIssues.length} sorun |\n`;
            output += `| Kalite | ${qualScore}/10 | ${qualIssues.length} sorun |\n`;
            output += `\n**Genel: ${overall}/10**\n\n`;
            if (secIssues.filter(i => i.severity === 'critical').length > 0) {
                output += `### 🔴 Kritik Güvenlik Bulguları\n`;
                for (const i of secIssues.filter(x => x.severity === 'critical').slice(0, 5)) {
                    output += `- **${i.title}** — \`${i.filepath}:${i.line}\`\n`;
                }
            }
            return output;
        }
        // ── deep mode ───────────────────────────────────────────────────────────────
        let output = `## Deep Dive (Deep Mode): ${target}\n\n`;
        output += `| Boyut | Skor | Detay |\n|-------|------|-------|\n`;
        output += `| Güvenlik | ${secScore}/10 | ${secIssues.length} sorun |\n`;
        output += `| Kalite | ${qualScore}/10 | ${qualIssues.length} sorun |\n`;
        output += `\n**Genel: ${overall}/10**\n\n`;
        // Full function inventory
        output += `### Fonksiyon Envanteri\n\n`;
        output += `| Dosya | Export | Fonksiyon | Satır Sayısı |\n|-------|--------|-----------|-------------|\n`;
        for (const file of files) {
            try {
                const content = fs.readFileSync(file, 'utf-8');
                const lines = content.split('\n');
                const fnMatches = [...content.matchAll(/(?:(export)\s+)?(?:async\s+)?function\s+(\w+)|(?:(export)\s+)?(?:const|let)\s+(\w+)\s*=\s*(?:async\s+)?\(/g)];
                for (const m of fnMatches) {
                    const exported = !!(m[1] || m[3]);
                    const name = m[2] ?? m[4] ?? '(anonymous)';
                    // Estimate line count by finding next function or end of file
                    const matchIdx = content.indexOf(m[0]);
                    const startLine = content.slice(0, matchIdx).split('\n').length;
                    const nextFnMatch = content.indexOf('\nfunction ', matchIdx + 1);
                    const endLine = nextFnMatch > -1
                        ? content.slice(0, nextFnMatch).split('\n').length
                        : lines.length;
                    const lineCount = Math.max(1, endLine - startLine);
                    output += `| \`${file}\` | ${exported ? 'yes' : 'no'} | \`${name}\` | ~${lineCount} |\n`;
                }
            }
            catch { /* skip */ }
        }
        output += '\n';
        // Import/dependency graph
        output += `### Import Grafiği\n\n`;
        for (const file of files.slice(0, 10)) {
            try {
                const content = fs.readFileSync(file, 'utf-8');
                const imports = [...content.matchAll(/import\s+.*?from\s+['"]([^'"]+)['"]/g)].map(m => m[1]);
                if (imports.length > 0) {
                    output += `**\`${file}\`** imports:\n`;
                    for (const imp of imports)
                        output += `  - \`${imp}\`\n`;
                    output += '\n';
                }
            }
            catch { /* skip */ }
        }
        // Code age estimation based on style patterns
        output += `### Kod Yaşı Tahmini\n\n`;
        const ageHints = [];
        for (const file of files.slice(0, 5)) {
            try {
                const content = fs.readFileSync(file, 'utf-8');
                const hasVar = /\bvar\b/.test(content);
                const hasCallback = /function\s*\(err,/.test(content);
                const hasAsync = /\basync\b/.test(content);
                const hasOptionalChain = /\?\.[a-z]/.test(content);
                const era = hasVar && hasCallback ? 'Pre-ES6 (2015 öncesi)' :
                    hasAsync && hasOptionalChain ? 'Modern ES2020+' :
                        hasAsync ? 'ES2017+' : 'ES6-ES2017';
                ageHints.push(`- \`${file}\` — ${era}`);
            }
            catch { /* skip */ }
        }
        output += ageHints.join('\n') || '- (dosya okunamadı)';
        output += '\n\n';
        // Risk score breakdown
        const riskScore = Math.max(0, 10 - overall);
        output += `### Risk Skoru: ${riskScore}/10\n\n`;
        output += `| Bileşen | Puan | Açıklama |\n|---------|------|----------|\n`;
        output += `| Güvenlik açıkları | ${secIssues.filter(i => i.severity === 'critical').length * 3} | Kritik güvenlik sorunları |\n`;
        output += `| Kalite borcu | ${Math.min(10, qualIssues.length)} | Kalite sorunları |\n`;
        output += `| Dosya karmaşıklığı | ${Math.min(10, files.length)} | Dosya sayısı |\n\n`;
        // Top 3 most dangerous functions with full code
        const criticalSecIssues = secIssues.filter(i => i.severity === 'critical').slice(0, 3);
        if (criticalSecIssues.length > 0) {
            output += `### Top ${criticalSecIssues.length} En Tehlikeli Bölge\n\n`;
            for (let idx = 0; idx < criticalSecIssues.length; idx++) {
                const issue = criticalSecIssues[idx];
                output += `#### ${idx + 1}. ${issue.title} — \`${issue.filepath}:${issue.line ?? '?'}\`\n`;
                output += `${issue.description}\n\n`;
                const ctx = this.getCodeContext(issue.filepath, issue.line, 5);
                if (ctx)
                    output += `${ctx}\n\n`;
            }
        }
        return output;
    }
    async runAuditRunner(target, opts) {
        const deep = opts.depth === 'deep';
        const files = this.resolveFiles(target);
        const secIssues = [];
        const qualIssues = [];
        for (const file of files) {
            try {
                const content = fs.readFileSync(file, 'utf-8');
                secIssues.push(...(0, security_js_1.scanSecurity)(file, content));
                qualIssues.push(...(0, quality_js_1.scanQuality)(file, content));
            }
            catch { /* skip */ }
        }
        const critical = secIssues.filter(i => i.severity === 'critical');
        const high = secIssues.filter(i => i.severity === 'high');
        if (!deep) {
            let output = `## Tam Audit Raporu\n\n`;
            output += `**Taranan dosya:** ${files.length}\n`;
            output += `**Güvenlik sorunları:** ${secIssues.length} (🔴 ${critical.length} kritik, 🟠 ${high.length} yüksek)\n`;
            output += `**Kalite sorunları:** ${qualIssues.length}\n\n`;
            if (critical.length > 0) {
                output += `### 🔴 Kritik Sorunlar (BLOKLA)\n\n`;
                for (const i of critical.slice(0, 10)) {
                    output += `- **${i.title}** — \`${i.filepath}:${i.line}\`\n  ${i.description}\n`;
                }
                output += '\n';
            }
            if (high.length > 0) {
                output += `### 🟠 Yüksek Öncelik (1 Sprint)\n\n`;
                for (const i of high.slice(0, 10)) {
                    output += `- **${i.title}** — \`${i.filepath}:${i.line}\`\n`;
                }
                output += '\n';
            }
            if (secIssues.length === 0 && qualIssues.length === 0) {
                output += '✅ Temiz repo! Önemli sorun bulunamadı.\n';
            }
            return output;
        }
        // ── deep mode ───────────────────────────────────────────────────────────────
        const medium = secIssues.filter(i => i.severity === 'medium');
        const allIssues = [...secIssues, ...qualIssues];
        let output = `## Tam Audit Raporu (Deep Mode)\n\n`;
        output += `**Taranan dosya:** ${files.length}\n`;
        output += `**Güvenlik sorunları:** ${secIssues.length} (🔴 ${critical.length} kritik, 🟠 ${high.length} yüksek)\n`;
        output += `**Kalite sorunları:** ${qualIssues.length}\n\n`;
        // Per-file breakdown table
        const fileBreakdown = new Map();
        for (const i of allIssues) {
            if (!fileBreakdown.has(i.filepath))
                fileBreakdown.set(i.filepath, { critical: 0, high: 0, medium: 0, low: 0 });
            const r = fileBreakdown.get(i.filepath);
            if (i.severity === 'critical')
                r.critical++;
            else if (i.severity === 'high')
                r.high++;
            else if (i.severity === 'medium')
                r.medium++;
            else
                r.low++;
        }
        output += `### Dosya Bazlı Özet\n\n| Dosya | Critical | High | Medium | Low |\n|-------|----------|------|--------|-----|\n`;
        for (const [fp, counts] of fileBreakdown) {
            output += `| \`${fp}\` | ${counts.critical} | ${counts.high} | ${counts.medium} | ${counts.low} |\n`;
        }
        output += '\n';
        // All findings with code excerpts (not just top 10)
        if (critical.length > 0) {
            output += `### 🔴 Kritik Sorunlar (BLOKLA)\n\n`;
            for (const i of critical) {
                output += `#### ${i.title}\n`;
                output += `- **Dosya:** \`${i.filepath}:${i.line ?? '?'}\`\n`;
                output += `- ${i.description}\n\n`;
                const ctx = this.getCodeContext(i.filepath, i.line, 3);
                if (ctx)
                    output += `${ctx}\n\n`;
                if (i.fix)
                    output += `**Fix:** ${i.fix}\n\n`;
            }
        }
        if (high.length > 0) {
            output += `### 🟠 Yüksek Öncelik (Bu Hafta)\n\n`;
            for (const i of high) {
                output += `#### ${i.title}\n`;
                output += `- **Dosya:** \`${i.filepath}:${i.line ?? '?'}\`\n`;
                output += `- ${i.description}\n\n`;
                const ctx = this.getCodeContext(i.filepath, i.line, 3);
                if (ctx)
                    output += `${ctx}\n\n`;
                if (i.fix)
                    output += `**Fix:** ${i.fix}\n\n`;
            }
        }
        if (medium.length > 0) {
            output += `### 🟡 Orta Öncelik (Bu Sprint)\n\n`;
            for (const i of medium) {
                output += `- **${i.title}** — \`${i.filepath}:${i.line ?? '?'}\`\n`;
                output += `  ${i.description}${i.fix ? ' → ' + i.fix : ''}\n`;
            }
            output += '\n';
        }
        // Remediation timeline
        output += `### Düzeltme Zaman Çizelgesi\n\n`;
        output += `| Seviye | Hedef | Sorun Sayısı |\n|--------|-------|-------------|\n`;
        output += `| 🔴 Critical | Bugün | ${critical.length} |\n`;
        output += `| 🟠 High | Bu hafta | ${high.length} |\n`;
        output += `| 🟡 Medium | Bu sprint | ${medium.length} |\n\n`;
        if (secIssues.length === 0 && qualIssues.length === 0) {
            output += '✅ Temiz repo! Önemli sorun bulunamadı.\n';
        }
        // Suggested task_create calls for critical issues
        if (critical.length > 0) {
            output += `## Onerilen Task'lar\n\n`;
            output += 'Her kritik sorun için aşağıdaki komutları çalıştırın:\n\n';
            for (const issue of critical.slice(0, 5)) {
                output += `\`\`\`\ntask_create title="Fix: ${issue.title}" category="bug" priority="critical" filepath="${issue.filepath}"\n\`\`\`\n`;
            }
        }
        return output;
    }
    async runDeepPlanner(target, opts) {
        const planDir = target ? `${target}/.plan` : '.plan';
        const goal = opts['goal'] ?? 'Define your goal';
        const taskPlan = `# Task Plan\n\n## Goal\n${goal}\n\n## Current Phase\n1\n\n## Phases\n\n### Phase 1: Research & Discovery\n- [ ] Understand the codebase structure\n- [ ] Identify key files and dependencies\n- [ ] Document findings\n\n### Phase 2: Design\n- [ ] Define approach and architecture\n- [ ] Identify risks and edge cases\n- [ ] Finalize implementation plan\n\n### Phase 3: Implementation\n- [ ] Implement core functionality\n- [ ] Write tests\n- [ ] Review and refine\n\n### Phase 4: Verification\n- [ ] Run full audit\n- [ ] Verify all acceptance criteria met\n- [ ] Update documentation\n\n## Decisions Made\n| Decision | Rationale | Date |\n|----------|-----------|------|\n\n## Errors Encountered\n| Timestamp | Error | Attempt # | Resolution |\n|-----------|-------|-----------|------------|\n`;
        const findings = `# Findings\n\n## Requirements\n- (extract from user request)\n\n## Research Findings\n> **2-Action Rule**: After every 2 research operations, update this file immediately.\n\n## Technical Decisions\n\n## Issues Encountered\n\n## Resources\n`;
        const progress = `# Progress Log\n\n## Session: ${new Date().toISOString().split('T')[0]}\n\n### 5-Question Reboot Check\n1. **Where am I?** Phase 1 — Research\n2. **Where am I going?** Phases 2-4 remaining\n3. **What's the goal?** ${goal}\n4. **What have I learned?** (check findings.md)\n5. **What have I done?** Session just started\n\n### Actions\n`;
        try {
            fs.mkdirSync(planDir, { recursive: true });
            fs.writeFileSync(`${planDir}/task_plan.md`, taskPlan, 'utf-8');
            fs.writeFileSync(`${planDir}/findings.md`, findings, 'utf-8');
            fs.writeFileSync(`${planDir}/progress.md`, progress, 'utf-8');
        }
        catch { /* skip if can't write */ }
        return `## Deep Planner — Planning System Created\n\n**Files created:**\n- \`${planDir}/task_plan.md\` — phases + checkboxes\n- \`${planDir}/findings.md\` — research log (2-action rule)\n- \`${planDir}/progress.md\` — session log + reboot check\n\n**Goal:** ${goal}\n\n**Next step:** Update task_plan.md phases to match your specific task, then start Phase 1.\n\n**Remember:** After every 2 research operations → update findings.md immediately.`;
    }
    async runSessionRestore(_target, _opts) {
        const planDir = '.plan';
        let output = `## Session Restore — Context Recovery\n\n`;
        try {
            const taskPlan = fs.existsSync(`${planDir}/task_plan.md`)
                ? fs.readFileSync(`${planDir}/task_plan.md`, 'utf-8')
                : null;
            const progress = fs.existsSync(`${planDir}/progress.md`)
                ? fs.readFileSync(`${planDir}/progress.md`, 'utf-8')
                : null;
            if (!taskPlan && !progress) {
                return `## Session Restore\n\nNo .plan/ files found. Run \`deep-planner\` first to create a planning system.`;
            }
            output += `### 5-Question Reboot Check\n\n`;
            const phaseMatch = taskPlan?.match(/## Current Phase\n(\d+)/);
            const goalMatch = taskPlan?.match(/## Goal\n(.+)/);
            const phase = phaseMatch?.[1] ?? '?';
            const goal = goalMatch?.[1] ?? 'Unknown';
            output += `1. **Where am I?** Phase ${phase}\n`;
            output += `2. **Where am I going?** Check task_plan.md for remaining phases\n`;
            output += `3. **What's the goal?** ${goal}\n`;
            output += `4. **What have I learned?** See \`.plan/findings.md\`\n`;
            output += `5. **What have I done?** See \`.plan/progress.md\` last session\n\n`;
            if (taskPlan) {
                const pendingPhases = [...taskPlan.matchAll(/### (Phase \d+[^:]*)/g)].map(m => m[1]);
                output += `### Phases Overview\n${pendingPhases.map(p => `- ${p}`).join('\n')}\n\n`;
            }
            output += `### Next Steps\n1. Read \`.plan/findings.md\` to reload accumulated knowledge\n2. Call \`task_next\` to see actionable tasks\n3. Continue from Phase ${phase}\n`;
        }
        catch (e) {
            output += `Error reading plan files: ${e instanceof Error ? e.message : String(e)}`;
        }
        return output;
    }
    async runAutoFixer(target, _opts) {
        const files = this.resolveFiles(target);
        const secIssues = [];
        const qualIssues = [];
        for (const file of files) {
            try {
                const content = fs.readFileSync(file, 'utf-8');
                secIssues.push(...(0, security_js_1.scanSecurity)(file, content));
                qualIssues.push(...(0, quality_js_1.scanQuality)(file, content));
            }
            catch { /* skip */ }
        }
        const critical = secIssues.filter(i => i.severity === 'critical');
        const high = secIssues.filter(i => i.severity === 'high');
        const total = secIssues.length + qualIssues.length;
        let output = `## Auto-Fixer — Otomatik Düzeltme Planı\n\n`;
        output += `**Taranan:** ${files.length} dosya | **Toplam sorun:** ${total}\n\n`;
        output += `### Triage Sonucu\n`;
        output += `| Seviye | Sayı | Aksiyon |\n|--------|------|----------|\n`;
        output += `| 🔴 CRITICAL | ${critical.length} | Hemen düzelt |\n`;
        output += `| 🟠 HIGH | ${high.length} | Bu sprintte düzelt |\n`;
        output += `| 🟡 MEDIUM | ${qualIssues.filter(i => i.severity === 'medium').length} | Sonraki sprint |\n`;
        output += `| ⚪ LOW | ${qualIssues.filter(i => i.severity === 'low').length} | Backlog |\n\n`;
        if (critical.length > 0) {
            output += `### 🔴 CRITICAL — Hemen Düzelt\n\n`;
            for (const issue of critical.slice(0, 5)) {
                output += `**${issue.title}** — \`${issue.filepath}:${issue.line}\`\n`;
                if (issue.fix)
                    output += `→ Fix: ${issue.fix}\n`;
                output += '\n';
            }
        }
        if (high.length > 0) {
            output += `### 🟠 HIGH — Bu Sprint\n\n`;
            for (const issue of high.slice(0, 5)) {
                output += `- **${issue.title}** — \`${issue.filepath}:${issue.line}\`\n`;
            }
            output += '\n';
        }
        output += `### Sonraki Adım\nHer sorun için \`task_create\` çağrısı yap, sonra \`task_next\` ile sırayla düzelt.`;
        return output;
    }
    async runCodeArchaeologist(target, _opts) {
        if (!target)
            return `## Code Archaeologist\n\nBir dosya veya dizin belirtin.`;
        const files = this.resolveFiles(target).slice(0, 15);
        let output = `## Code Archaeologist — \`${target}\`\n\n`;
        // ── Code age estimation ───────────────────────────────────────────────────
        const ageReport = [];
        let totalLoc = 0;
        let totalFunctions = 0;
        let totalComments = 0;
        const legacySmells = [];
        const LEGACY_PATTERNS = [
            { pattern: /\bvar\b/, smell: 'var kullanımı (ES3/ES5)', suggestion: 'const/let kullanın' },
            { pattern: /\.prototype\./, smell: 'Prototype tabanlı kalıtım', suggestion: 'ES6 class kullanın' },
            { pattern: /require\s*\(/, smell: 'CommonJS require', suggestion: 'ES module import kullanın' },
            { pattern: /callback|cb\s*\(/, smell: 'Callback pattern', suggestion: 'async/await kullanın' },
            { pattern: /new Promise\s*\(\s*function/, smell: 'Promise constructor (eski stil)', suggestion: 'async function kullanın' },
            { pattern: /arguments\[/, smell: 'arguments objesi', suggestion: 'rest parameters (...args) kullanın' },
            { pattern: /===\s*null\s*\|\|\s*===\s*undefined/, smell: 'Null/undefined manuel kontrol', suggestion: 'Optional chaining (?.) kullanın' },
            { pattern: /Object\.assign\s*\(\s*\{/, smell: 'Object.assign ile spread', suggestion: 'Spread operator {...obj} kullanın' },
            { pattern: /\.then\s*\(.*\.catch\s*\(/, smell: 'Promise chaining (.then/.catch)', suggestion: 'async/await + try/catch kullanın' },
            { pattern: /\/\*[\s\S]*?TODO|FIXME|HACK|XXX/, smell: 'Block comment içinde TODO/FIXME/HACK', suggestion: 'Kaydedilmemiş teknik borç — task oluşturun' },
        ];
        for (const file of files) {
            try {
                const content = fs.readFileSync(file, 'utf-8');
                const lines = content.split('\n');
                totalLoc += lines.length;
                totalFunctions += (content.match(/(?:function|=>|async\s+function)/g) ?? []).length;
                totalComments += (content.match(/^\s*\/\//gm) ?? []).length;
                // Code age indicators
                const indicators = [];
                const hasVar = /\bvar\b/.test(content);
                const hasCallback = /\bcallback\b|\bcb\b\s*[,)]/.test(content);
                const hasRequire = /\brequire\s*\(/.test(content);
                const hasAsync = /\basync\b/.test(content);
                const hasOptChain = /\?\.[a-zA-Z]/.test(content);
                const hasNullish = /\?\?/.test(content);
                if (hasVar)
                    indicators.push('var (ES5)');
                if (hasCallback)
                    indicators.push('callbacks');
                if (hasRequire)
                    indicators.push('require()');
                if (hasAsync)
                    indicators.push('async/await');
                if (hasOptChain)
                    indicators.push('optional chaining');
                if (hasNullish)
                    indicators.push('nullish coalescing');
                const era = (hasVar || hasCallback) && !hasAsync ? 'ES5 öncesi / Node.js eski stil'
                    : hasAsync && hasOptChain && hasNullish ? 'Modern (ES2020+)'
                        : hasAsync ? 'ES2017+ (async/await çağı)'
                            : hasRequire ? 'ES6 / CommonJS geçiş dönemi'
                                : 'ES6 (2015-2017)';
                ageReport.push({ file, era, indicators });
                // Legacy smells
                for (let i = 0; i < lines.length; i++) {
                    if (/^\s*(\/\/|\/\*|\*)/.test(lines[i]))
                        continue;
                    for (const p of LEGACY_PATTERNS) {
                        if (p.pattern.test(lines[i])) {
                            legacySmells.push({ file, line: i + 1, smell: p.smell, suggestion: p.suggestion });
                            break; // one per line
                        }
                    }
                }
            }
            catch { /* skip */ }
        }
        // ── Summary ───────────────────────────────────────────────────────────────
        output += `### Codebase Profili\n\n`;
        output += `| Metrik | Değer |\n|--------|-------|\n`;
        output += `| Taranan dosya | ${files.length} |\n`;
        output += `| Toplam satır (LOC) | ${totalLoc} |\n`;
        output += `| Fonksiyon sayısı | ${totalFunctions} |\n`;
        output += `| Yorum satırı | ${totalComments} |\n`;
        output += `| Yorum oranı | %${totalLoc > 0 ? Math.round((totalComments / totalLoc) * 100) : 0} |\n`;
        output += `| Legacy smell sayısı | ${legacySmells.length} |\n\n`;
        // ── Code age per file ─────────────────────────────────────────────────────
        output += `### Kod Yaşı Analizi\n\n| Dosya | Dönem | Göstergeler |\n|-------|-------|-------------|\n`;
        for (const r of ageReport) {
            output += `| \`${r.file}\` | ${r.era} | ${r.indicators.join(', ') || '—'} |\n`;
        }
        output += '\n';
        // ── Legacy smells ─────────────────────────────────────────────────────────
        if (legacySmells.length > 0) {
            output += `### Legacy Code Kokuları (${legacySmells.length})\n\n`;
            const grouped = new Map();
            for (const s of legacySmells) {
                if (!grouped.has(s.smell))
                    grouped.set(s.smell, []);
                grouped.get(s.smell).push(s);
            }
            for (const [smell, instances] of grouped) {
                output += `**${smell}** (${instances.length} yer)\n`;
                output += `→ ${instances[0].suggestion}\n`;
                for (const inst of instances.slice(0, 3)) {
                    output += `  - \`${inst.file}:${inst.line}\`\n`;
                }
                if (instances.length > 3)
                    output += `  - ... ve ${instances.length - 3} daha\n`;
                output += '\n';
            }
        }
        else {
            output += `✅ Belirgin legacy code kokusu bulunamadı.\n\n`;
        }
        // ── Modernization roadmap ────────────────────────────────────────────────
        output += `### Modernizasyon Yol Haritası\n\n`;
        if (legacySmells.some(s => s.smell.includes('var')))
            output += `1. **var → const/let** migrasyonu: \`eslint --fix --rule 'no-var: error'\`\n`;
        if (legacySmells.some(s => s.smell.includes('require')))
            output += `2. **CommonJS → ES Modules**: package.json'a \`"type": "module"\` ekle, import'ları düzenle\n`;
        if (legacySmells.some(s => s.smell.includes('callback')))
            output += `3. **Callback → async/await** refactor'u: Her callback fonksiyonu için ayrı task oluşturun\n`;
        if (legacySmells.some(s => s.smell.includes('TODO')))
            output += `4. **TODO/FIXME temizliği**: \`find_todos path="${target}"\` ile hepsini listeleyin ve task'lara dönüştürün\n`;
        output += `\nDetaylı analiz için \`complexity_score filepath="${target}"\` çağrısı yapın.\n`;
        return output;
    }
    async runImpactAnalyzer(target, _opts) {
        if (!target)
            return `## Impact Analyzer\n\nBir sembol, dosya veya dizin belirtin.`;
        const targetFiles = this.resolveFiles(target);
        const targetBasenames = new Set(targetFiles.map(f => path.basename(f, path.extname(f))));
        const targetPaths = new Set(targetFiles.map(f => f.replace(/\\/g, '/')));
        // Scan entire codebase for references
        const scanRoot = fs.statSync(target).isDirectory() ? target : path.dirname(target);
        const allFiles = this.resolveFiles(scanRoot === target ? '.' : scanRoot);
        const breaking = [];
        const likely = [];
        const safe = [];
        for (const file of allFiles) {
            // Don't scan the target itself
            const normalFile = file.replace(/\\/g, '/');
            if (targetPaths.has(normalFile))
                continue;
            try {
                const lines = fs.readFileSync(file, 'utf-8').split('\n');
                for (let i = 0; i < lines.length; i++) {
                    const line = lines[i];
                    for (const basename of targetBasenames) {
                        if (!line.includes(basename))
                            continue;
                        const isImport = /^\s*(import|require|from)/.test(line);
                        const isDirectCall = new RegExp(`\\b${basename}\\s*[\\.\\(\\[]`).test(line);
                        const isTypeRef = new RegExp(`:\\s*${basename}|<${basename}>`).test(line);
                        if (isImport && isDirectCall) {
                            breaking.push({ file, line: i + 1, ref: line.trim().slice(0, 80) });
                        }
                        else if (isImport || isDirectCall) {
                            likely.push({ file, line: i + 1, ref: line.trim().slice(0, 80) });
                        }
                        else if (isTypeRef) {
                            safe.push({ file, line: i + 1, ref: line.trim().slice(0, 80) });
                        }
                    }
                }
            }
            catch { /* skip */ }
        }
        let output = `## Impact Analyzer — \`${target}\`\n\n`;
        output += `**Hedef dosya:** ${targetFiles.length} | **Taranan:** ${allFiles.length} dosya\n\n`;
        output += `### Blast Radius Özeti\n\n`;
        output += `| Risk | Dosya Sayısı | Açıklama |\n|------|-------------|----------|\n`;
        output += `| 🔴 BREAKING | ${new Set(breaking.map(r => r.file)).size} | Import + direkt kullanım — mutlaka güncellenmeli |\n`;
        output += `| 🟠 LIKELY | ${new Set(likely.map(r => r.file)).size} | Import veya çağrı var — büyük ihtimalle etkilenir |\n`;
        output += `| ✅ SAFE | ${new Set(safe.map(r => r.file)).size} | Sadece tip referansı — genelde güvenli |\n\n`;
        if (breaking.length > 0) {
            output += `### 🔴 BREAKING — Mutlaka Güncelle\n\n`;
            for (const r of breaking.slice(0, 10)) {
                output += `- **\`${r.file}:${r.line}\`**\n  \`${r.ref}\`\n`;
            }
            if (breaking.length > 10)
                output += `- ... ve ${breaking.length - 10} daha\n`;
            output += '\n';
        }
        if (likely.length > 0) {
            output += `### 🟠 LIKELY — İncele\n\n`;
            for (const r of likely.slice(0, 8)) {
                output += `- **\`${r.file}:${r.line}\`** — \`${r.ref}\`\n`;
            }
            if (likely.length > 8)
                output += `- ... ve ${likely.length - 8} daha\n`;
            output += '\n';
        }
        const totalImpact = new Set([...breaking, ...likely].map(r => r.file)).size;
        output += `### Önerilen Değişiklik Sırası\n\n`;
        output += `Toplam **${totalImpact} dosya** etkilenecek. Şu sırayla güncelleyin:\n\n`;
        output += `1. Önce leaf dosyaları (sadece import, başka dosyaya export etmeyen)\n`;
        output += `2. Sonra utility/lib katmanı\n`;
        output += `3. En son entry point ve index dosyaları\n\n`;
        if (totalImpact > 10) {
            output += `⚠️ **Yüksek etki** — Bu değişikliği feature branch'te yapın ve tam test suite'i çalıştırın.\n`;
        }
        else if (totalImpact === 0) {
            output += `✅ Hiçbir dosya bu hedefi import etmiyor — düşük blast radius.\n`;
        }
        return output;
    }
    async runTestGenerator(target, opts) {
        if (!target)
            return `## Test Generator\n\nBir dosya veya dizin belirtin.`;
        const framework = opts['framework'] ?? 'vitest';
        const files = this.resolveFiles(target).filter(f => /\.(ts|tsx|js|jsx)$/.test(f));
        if (files.length === 0)
            return `## Test Generator\n\nHedef konumda test üretmeye uygun dosya bulunamadı.`;
        let output = `## Test Generator — \`${target}\`\n\n`;
        output += `**Framework:** ${framework} | **Analiz edilen dosya:** ${files.length}\n\n`;
        const importLine = framework === 'jest'
            ? `import { describe, it, expect, beforeEach, jest } from '@jest/globals';`
            : framework === 'mocha'
                ? `import { describe, it } from 'mocha';\nimport { expect } from 'chai';`
                : `import { describe, it, expect, beforeEach, vi } from 'vitest';`;
        const allExports = [];
        for (const file of files) {
            // Skip test files themselves
            if (/\.(test|spec)\.(ts|tsx|js|jsx)$/.test(file))
                continue;
            try {
                const content = fs.readFileSync(file, 'utf-8');
                // Extract exported functions
                const fnMatches = [...content.matchAll(/export\s+(async\s+)?function\s+(\w+)\s*\(([^)]*)\)/g)];
                for (const m of fnMatches) {
                    allExports.push({ file, type: 'function', name: m[2], params: m[3], isAsync: !!m[1] });
                }
                // Extract exported arrow functions
                const arrowMatches = [...content.matchAll(/export\s+const\s+(\w+)\s*=\s*(async\s+)?\(([^)]*)\)/g)];
                for (const m of arrowMatches) {
                    allExports.push({ file, type: 'function', name: m[1], params: m[3], isAsync: !!m[2] });
                }
                // Extract exported classes
                const classMatches = [...content.matchAll(/export\s+(?:default\s+)?class\s+(\w+)/g)];
                for (const m of classMatches) {
                    allExports.push({ file, type: 'class', name: m[1], params: '', isAsync: false });
                }
            }
            catch { /* skip */ }
        }
        if (allExports.length === 0) {
            return output + 'Export edilen fonksiyon veya sınıf bulunamadı.';
        }
        output += `### Bulunan ${allExports.length} export\n\n`;
        output += `| Dosya | Tip | İsim | Async |\n|-------|-----|------|-------|\n`;
        for (const e of allExports.slice(0, 20)) {
            output += `| \`${e.file}\` | ${e.type} | \`${e.name}\` | ${e.isAsync ? 'evet' : 'hayır'} |\n`;
        }
        output += '\n';
        // Generate test templates for first 5 exports
        output += `### Üretilen Test Şablonları\n\n`;
        for (const e of allExports.slice(0, 5)) {
            const testFile = e.file.replace(/\.(ts|tsx|js|jsx)$/, '.test.$1');
            output += `#### \`${testFile}\`\n\n\`\`\`typescript\n`;
            output += `${importLine}\n`;
            output += `import { ${e.name} } from './${path.basename(e.file, path.extname(e.file))}';\n\n`;
            if (e.type === 'class') {
                output += `describe('${e.name}', () => {\n`;
                output += `  let instance: ${e.name};\n\n`;
                output += `  beforeEach(() => {\n    instance = new ${e.name}();\n  });\n\n`;
                output += `  it('should be instantiated', () => {\n    expect(instance).toBeDefined();\n  });\n\n`;
                output += `  it('should handle happy path', () => {\n    // TODO: test main method\n  });\n\n`;
                output += `  it('should handle edge cases', () => {\n    // TODO: null, empty, boundary\n  });\n`;
                output += `});\n`;
            }
            else {
                const params = e.params ? e.params.split(',').map(p => p.trim().split(':')[0].trim()).join(', ') : '';
                const awaitPrefix = e.isAsync ? 'await ' : '';
                output += `describe('${e.name}', () => {\n`;
                output += `  it('should return expected result for valid input', ${e.isAsync ? 'async ' : ''}() => {\n`;
                output += `    // Arrange\n    ${params ? `const [${params}] = [/* test values */];` : ''}\n`;
                output += `    // Act\n    const result = ${awaitPrefix}${e.name}(${params});\n`;
                output += `    // Assert\n    expect(result).toBeDefined();\n`;
                output += `  });\n\n`;
                output += `  it('should handle null/undefined input gracefully', ${e.isAsync ? 'async ' : ''}() => {\n`;
                output += `    await expect(${e.isAsync ? 'async () => ' : '() => '}${e.name}(${params ? 'null as unknown as any' : ''})).${e.isAsync ? 'rejects' : 'throws'};\n`;
                output += `  });\n\n`;
                output += `  it('should handle boundary values', ${e.isAsync ? 'async ' : ''}() => {\n    // TODO: empty string, 0, max int\n  });\n`;
                output += `});\n`;
            }
            output += `\`\`\`\n\n`;
        }
        if (allExports.length > 5) {
            output += `> ${allExports.length - 5} export daha var. Hepsini görmek için belirli dosya ile çalıştırın.\n\n`;
        }
        output += `### Coverage Hedefi\n`;
        output += `- ✅ Happy path (geçerli input)\n`;
        output += `- ✅ Edge cases (null, undefined, boş dizi, sınır değerleri)\n`;
        output += `- ✅ Error paths (exception, rejection)\n`;
        output += `\nTest dosyalarını oluşturduktan sonra: \`${framework === 'jest' ? 'jest --coverage' : 'vitest run --coverage'}\`\n`;
        return output;
    }
    async runDocGenerator(target, opts) {
        if (!target)
            return `## Doc Generator\n\nBir dosya veya dizin belirtin.`;
        const style = opts['style'] ?? 'jsdoc';
        const files = this.resolveFiles(target).filter(f => /\.(ts|tsx|js|jsx)$/.test(f));
        if (files.length === 0)
            return `## Doc Generator\n\nHedef konumda kaynak dosya bulunamadı.`;
        let output = `## Doc Generator — \`${target}\`\n\n`;
        output += `**Stil:** ${style} | **Analiz edilen dosya:** ${files.length}\n\n`;
        const undocumented = [];
        for (const file of files) {
            try {
                const content = fs.readFileSync(file, 'utf-8');
                const lines = content.split('\n');
                // Find exported functions/classes without JSDoc immediately before
                for (let i = 0; i < lines.length; i++) {
                    const line = lines[i];
                    const fnMatch = line.match(/^export\s+(async\s+)?function\s+(\w+)\s*(<[^>]*>)?\s*\(([^)]*)\)(?:\s*:\s*([^{]+))?/);
                    const arrowMatch = line.match(/^export\s+const\s+(\w+)\s*=\s*(async\s+)?\(([^)]*)\)(?:\s*:\s*([^=>{]+))?/);
                    const classMatch = line.match(/^export\s+(?:default\s+)?(?:abstract\s+)?class\s+(\w+)/);
                    let entry = null;
                    if (fnMatch) {
                        entry = { file, line: i + 1, name: fnMatch[2], type: 'function', params: fnMatch[4], returnType: fnMatch[5]?.trim() ?? 'unknown' };
                    }
                    else if (arrowMatch) {
                        entry = { file, line: i + 1, name: arrowMatch[1], type: 'function', params: arrowMatch[3], returnType: arrowMatch[4]?.trim() ?? 'unknown' };
                    }
                    else if (classMatch) {
                        entry = { file, line: i + 1, name: classMatch[1], type: 'class', params: '', returnType: '' };
                    }
                    if (entry) {
                        // Check if preceded by JSDoc comment (/** ... */)
                        const prevBlock = lines.slice(Math.max(0, i - 5), i).join('\n');
                        const hasJsDoc = /\/\*\*[\s\S]*?\*\/\s*$/.test(prevBlock);
                        const hasLineComment = /\/\/\s*\w+/.test(lines[i - 1] ?? '');
                        if (!hasJsDoc && !hasLineComment) {
                            undocumented.push(entry);
                        }
                    }
                }
            }
            catch { /* skip */ }
        }
        const coverage = Math.max(0, 100 - Math.round((undocumented.length / Math.max(1, undocumented.length * 1.5)) * 100));
        output += `### Dokümantasyon Durumu\n\n`;
        output += `**Belgelenmemiş sembol:** ${undocumented.length}\n\n`;
        if (undocumented.length === 0) {
            return output + '✅ Tüm export edilen semboller belgelenmiş.\n';
        }
        output += `### Üretilen JSDoc Şablonları\n\n`;
        for (const sym of undocumented.slice(0, 8)) {
            output += `**\`${sym.file}:${sym.line}\`** — ${sym.name}\n\n`;
            output += `\`\`\`typescript\n`;
            if (sym.type === 'class') {
                output += `/**\n * ${sym.name} — [Açıklama ekleyin]\n *\n * @example\n * const instance = new ${sym.name}();\n */\n`;
            }
            else {
                const paramDocs = sym.params
                    ? sym.params.split(',').map(p => {
                        const [name, type] = p.trim().split(':').map(s => s.trim());
                        return ` * @param ${name || 'param'} {${type || 'unknown'}} — [Açıklama]\n`;
                    }).join('')
                    : '';
                output += `/**\n * [Fonksiyon amacını yazın — bir cümlede]\n *\n`;
                if (paramDocs)
                    output += paramDocs;
                if (sym.returnType && sym.returnType !== 'void' && sym.returnType !== 'unknown') {
                    output += ` * @returns {${sym.returnType}} — [Ne döndürdüğünü açıklayın]\n`;
                }
                output += ` * @throws {Error} — [Hangi koşulda hata fırlatır?]\n`;
                output += ` * @example\n * const result = ${sym.name}(/* parametreler *\/);\n`;
                output += ` */\n`;
            }
            output += `\`\`\`\n\n`;
        }
        if (undocumented.length > 8) {
            output += `> ${undocumented.length - 8} sembol daha belgelenmemiş. Belirli dosya ile tekrar çalıştırın.\n\n`;
        }
        output += `### Toplu Belgeleme Yöntemi\n`;
        output += `\`\`\`bash\n# TypeScript: tsdoc + typedoc ile otomatik API docs\nnpx typedoc --entryPoints ${target} --out docs/api\n\`\`\`\n`;
        return output;
    }
    async runAccessibilityCheck(target, _opts) {
        if (!target)
            return `## Accessibility Check\n\nBir bileşen dizini belirtin (örn: src/components/).`;
        const files = this.resolveFiles(target).filter(f => /\.(tsx|jsx|html|htm|svelte|vue)$/.test(f));
        if (files.length === 0)
            return `## Accessibility Check\n\nHedef konumda frontend dosyası bulunamadı (.tsx/.jsx/.html).`;
        const RULES = [
            // Images
            { pattern: /<img(?![^>]*alt=)[^>]*>/, issue: 'img etiketi alt attribute eksik', fix: 'alt="" (dekoratif) veya alt="açıklama" ekleyin', wcag: '1.1.1 (A)', severity: 'critical' },
            { pattern: /<img[^>]*alt=\s*["'][^"']+["']/, issue: '', fix: '', wcag: '', severity: 'low' }, // false positive guard — skip
            // Interactive elements
            { pattern: /<(?:button|a|input|select|textarea)(?![^>]*(?:aria-label|aria-labelledby|title))[^>]*>/, issue: 'İnteraktif element erişilebilir label eksik', fix: 'aria-label, aria-labelledby veya title ekleyin', wcag: '4.1.2 (A)', severity: 'high' },
            { pattern: /<a(?![^>]*href)[^>]*>/, issue: '<a> elementi href eksik (button semantiği)', fix: '<button> kullanın veya href ekleyin', wcag: '2.1.1 (A)', severity: 'high' },
            { pattern: /onClick(?![^/]*(?:onKeyDown|onKeyPress|role=))/, issue: 'onClick var ama onKeyDown eksik (klavye erişimi)', fix: 'onKeyDown/onKeyPress handler ve role="button" ekleyin', wcag: '2.1.1 (A)', severity: 'high' },
            // Forms
            { pattern: /<input(?![^>]*(?:id=|aria-label=|aria-labelledby=))[^>]*>/, issue: '<input> için label ilişkilendirmesi eksik', fix: '<label htmlFor="id"> veya aria-label ekleyin', wcag: '1.3.1 (A)', severity: 'critical' },
            { pattern: /<form(?![^>]*(?:aria-label|aria-labelledby))[^>]*>/, issue: '<form> için aria-label eksik', fix: 'aria-label veya aria-labelledby ekleyin', wcag: '4.1.2 (A)', severity: 'medium' },
            // ARIA
            { pattern: /aria-hidden=["']true["'][^>]*(?:onClick|href)/, issue: 'aria-hidden="true" ama interaktif element içeriyor', fix: 'aria-hidden interaktif elementlerde kullanılmaz', wcag: '4.1.2 (A)', severity: 'critical' },
            { pattern: /tabIndex=["']-1["'](?![^/]*(?:aria-|role=))/, issue: 'tabIndex="-1" ama ARIA attribute eksik', fix: 'tabIndex="-1" kullanıyorsanız aria-hidden veya role ekleyin', wcag: '2.1.1 (A)', severity: 'medium' },
            { pattern: /role=["'](?:presentation|none)["'][^>]*(?:onClick|aria-label)/, issue: 'role="presentation" ama interaktif content var', fix: 'Semantik element kullanın', wcag: '1.3.1 (A)', severity: 'high' },
            // Color/focus
            { pattern: /outline\s*:\s*0|outline\s*:\s*none/, issue: 'CSS outline kaldırılmış (focus indicator silinmiş)', fix: 'focus-visible ile görünür focus indicator sağlayın', wcag: '2.4.7 (AA)', severity: 'high' },
            { pattern: /color\s*:\s*#[0-9a-f]{3,6}.*background\s*:\s*#[0-9a-f]{3,6}|background\s*:\s*#fff.*color\s*:\s*#[89ab]/i, issue: 'Potansiyel düşük renk kontrastı', fix: 'WCAG AA için min 4.5:1 kontrast oranı sağlayın', wcag: '1.4.3 (AA)', severity: 'medium' },
            // Language/title
            { pattern: /<html(?![^>]*lang=)[^>]*>/, issue: '<html> lang attribute eksik', fix: '<html lang="tr"> ekleyin', wcag: '3.1.1 (A)', severity: 'critical' },
            { pattern: /<(?:video|audio)(?![^>]*(?:controls|aria-label))[^>]*>/, issue: 'Media element controls ve label eksik', fix: 'controls attribute ve aria-label ekleyin', wcag: '1.2.1 (A)', severity: 'high' },
        ];
        const findings = [];
        for (const file of files) {
            try {
                const lines = fs.readFileSync(file, 'utf-8').split('\n');
                for (let i = 0; i < lines.length; i++) {
                    const line = lines[i];
                    for (const rule of RULES) {
                        if (!rule.issue)
                            continue; // skip guard rules
                        if (rule.pattern.test(line)) {
                            findings.push({ file, line: i + 1, issue: rule.issue, fix: rule.fix, wcag: rule.wcag, severity: rule.severity });
                        }
                    }
                }
            }
            catch { /* skip */ }
        }
        const critical = findings.filter(f => f.severity === 'critical');
        const high = findings.filter(f => f.severity === 'high');
        const medium = findings.filter(f => f.severity === 'medium');
        let output = `## Accessibility Check (WCAG 2.1)\n\n`;
        output += `**Taranan dosya:** ${files.length} | **Sorun:** ${findings.length}`;
        output += ` (🔴 ${critical.length} kritik, 🟠 ${high.length} yüksek, 🟡 ${medium.length} orta)\n\n`;
        if (findings.length === 0) {
            output += `✅ Pattern tabanlı a11y analizi temiz. Manuel test için:\n`;
            output += `- [axe DevTools](https://www.deque.com/axe/devtools/) tarayıcı eklentisi\n`;
            output += `- Yalnızca klavye ile tüm sayfaları test edin (Tab, Enter, Escape)\n`;
            output += `- Bir ekran okuyucu (NVDA, VoiceOver) ile test edin\n`;
            return output;
        }
        output += `### WCAG Uyum Durumu\n\n`;
        output += `| Seviye | Sorun Sayısı | Durum |\n|--------|-------------|-------|\n`;
        output += `| Level A (Zorunlu) | ${critical.length + high.length} | ${critical.length + high.length > 0 ? '❌ Başarısız' : '✅ Geçti'} |\n`;
        output += `| Level AA (Önerilen) | ${medium.length} | ${medium.length > 5 ? '⚠️ İyileştirme gerekli' : '✅ Geçti'} |\n\n`;
        for (const [sev, group, emoji] of [
            ['critical', critical, '🔴'],
            ['high', high, '🟠'],
            ['medium', medium, '🟡'],
        ]) {
            if (group.length === 0)
                continue;
            output += `### ${emoji} ${sev.toUpperCase()} — ${group.length} sorun\n\n`;
            for (const f of group) {
                output += `- **\`${f.file}:${f.line}\`** — ${f.issue}\n`;
                output += `  WCAG: \`${f.wcag}\` | Fix: ${f.fix}\n`;
            }
            output += '\n';
        }
        output += `### Manuel Test Kontrol Listesi\n\n`;
        output += `- [ ] Tüm sayfaları sadece Tab/Enter/Escape ile dolaşın\n`;
        output += `- [ ] Zoom %200'de tüm içerik okunabilir mi?\n`;
        output += `- [ ] Tüm formlar ekran okuyucu ile test edildi mi?\n`;
        output += `- [ ] Hata mesajları ARIA live region ile duyuruluyor mu?\n`;
        output += `- [ ] Her sayfa için <title> unique ve anlamlı mı?\n`;
        return output;
    }
    async runLicenseScan(target, opts) {
        const pkgPath = target
            ? (fs.existsSync(path.join(target, 'package.json')) ? path.join(target, 'package.json') : target)
            : 'package.json';
        if (!fs.existsSync(pkgPath)) {
            return '## License Scan\n\npackage.json bulunamadı.';
        }
        const allowedLicenses = opts['allowed_licenses']
            ?? ['MIT', 'ISC', 'Apache-2.0', 'BSD-2-Clause', 'BSD-3-Clause', '0BSD', 'CC0-1.0', 'Unlicense'];
        const flagCopyleft = opts['flag_copyleft'] ?? true;
        const COPYLEFT = ['GPL-2.0', 'GPL-3.0', 'AGPL-3.0', 'LGPL-2.0', 'LGPL-2.1', 'LGPL-3.0', 'EUPL-1.1', 'EUPL-1.2', 'MPL-2.0', 'OSL-3.0'];
        const RESTRICTIVE = ['CC-BY-SA-4.0', 'CC-BY-NC-4.0', 'SSPL-1.0', 'BUSL-1.1'];
        try {
            const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
            const deps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
            // Try to read licenses from node_modules
            const nodeModules = path.join(path.dirname(pkgPath), 'node_modules');
            const licenseMap = {};
            for (const dep of Object.keys(deps).slice(0, 100)) {
                const depPkgPath = path.join(nodeModules, dep, 'package.json');
                try {
                    if (fs.existsSync(depPkgPath)) {
                        const depPkg = JSON.parse(fs.readFileSync(depPkgPath, 'utf-8'));
                        licenseMap[dep] = (typeof depPkg.license === 'string' ? depPkg.license : 'UNKNOWN').toUpperCase().replace(/\s/g, '-');
                    }
                    else {
                        licenseMap[dep] = 'NOT_INSTALLED';
                    }
                }
                catch {
                    licenseMap[dep] = 'PARSE_ERROR';
                }
            }
            const violations = [];
            const warnings = [];
            const approved = [];
            for (const [dep, license] of Object.entries(licenseMap)) {
                const normalized = license.replace(/^\(|\)$/g, '').split(/\s+OR\s+/)[0];
                if (flagCopyleft && COPYLEFT.some(l => normalized.includes(l.replace(/-/g, '')))) {
                    violations.push({ dep, license, reason: 'Copyleft — ticari projede hukuki risk' });
                }
                else if (RESTRICTIVE.some(l => normalized.includes(l.replace(/-/g, '')))) {
                    warnings.push({ dep, license, reason: 'Kısıtlayıcı lisans — hukuki inceleme gerekli' });
                }
                else if (license === 'UNKNOWN' || license === 'NOT_INSTALLED') {
                    warnings.push({ dep, license, reason: 'Lisans bilgisi bulunamadı' });
                }
                else if (allowedLicenses.some(al => normalized.startsWith(al.replace(/-/g, '')))) {
                    approved.push(dep);
                }
                else {
                    warnings.push({ dep, license, reason: 'İzin listesinde yok — gözden geçirin' });
                }
            }
            let output = `## License Scan\n\n`;
            output += `**Proje:** ${pkg.name ?? '(unknown)'} | **Taranan:** ${Object.keys(licenseMap).length} paket\n\n`;
            output += `### Özet\n\n| Kategori | Sayı |\n|----------|------|\n`;
            output += `| ✅ Onaylı lisans | ${approved.length} |\n`;
            output += `| ⚠️ Uyarı (gözden geçir) | ${warnings.length} |\n`;
            output += `| 🔴 İhlal (copyleft/kısıtlayıcı) | ${violations.length} |\n\n`;
            if (violations.length > 0) {
                output += `### 🔴 Lisans İhlalleri\n\n`;
                output += `| Paket | Lisans | Sorun |\n|-------|--------|-------|\n`;
                for (const v of violations)
                    output += `| \`${v.dep}\` | \`${v.license}\` | ${v.reason} |\n`;
                output += '\n';
                output += `> ⚠️ **Hukuki önerim:** Copyleft lisanslı paketleri ticari projede kullanmadan önce bir hukuk danışmanıyla görüşün.\n\n`;
            }
            if (warnings.length > 0) {
                output += `### ⚠️ Gözden Geçirilmesi Gereken Paketler\n\n`;
                output += `| Paket | Lisans | Not |\n|-------|--------|-----|\n`;
                for (const w of warnings.slice(0, 15))
                    output += `| \`${w.dep}\` | \`${w.license}\` | ${w.reason} |\n`;
                if (warnings.length > 15)
                    output += `\n... ve ${warnings.length - 15} daha.\n`;
                output += '\n';
            }
            output += `### İzin Verilen Lisanslar\n\`${allowedLicenses.join('`, `')}\`\n\n`;
            output += `### Sonraki Adımlar\n`;
            output += `1. \`npx license-checker --json > licenses.json\` — Tam lisans raporu\n`;
            output += `2. \`npx license-checker --failOn "GPL"\` — CI/CD'de copyleft kontrolü\n`;
            output += violations.length > 0 ? `3. İhlal eden paket${violations.length > 1 ? 'ler' : ''} için alternatif arayın.\n` : '';
            return output;
        }
        catch (e) {
            return `## License Scan\n\nHata: ${e instanceof Error ? e.message : String(e)}`;
        }
    }
    async runRefactorSuggest(target, _opts) {
        if (!target)
            return `## Refactor Suggest\n\nBir dosya veya dizin belirtin.`;
        const files = this.resolveFiles(target);
        let output = `## Refactor Suggest — \`${target}\`\n\n`;
        const suggestions = [];
        const REFACTOR_PATTERNS = [
            {
                pattern: /if\s*\([^)]+\)\s*\{[^}]{0,30}\}\s*else\s*\{[^}]{0,30}\}/,
                category: 'Simplification',
                issue: 'if/else → ternary ile basitleştirilebilir',
                makeAfter: () => 'const result = condition ? valueA : valueB;',
                impact: 'low',
            },
            {
                pattern: /function\s+\w+\s*\([^)]*\)\s*\{[\s\S]{300,}/,
                category: 'Long Function',
                issue: 'Uzun fonksiyon — tek sorumluluk ihlali',
                makeAfter: () => '// Fonksiyonu 3-5 küçük, isimli yardımcıya böl',
                impact: 'high',
            },
            {
                pattern: /console\.log|console\.debug|console\.warn/,
                category: 'Debug Code',
                issue: 'Production\'da console.log — loglama kütüphanesi kullanın',
                makeAfter: () => "logger.debug('mesaj', { context });",
                impact: 'medium',
            },
            {
                pattern: /any\b(?!thing|where|one|time|more|way|how)/,
                category: 'Type Safety',
                issue: 'TypeScript any kullanımı — tip güvenliğini zayıflatır',
                makeAfter: () => '// unknown veya generic <T> kullanın',
                impact: 'medium',
            },
            {
                pattern: /catch\s*\([^)]*\)\s*\{\s*\}/,
                category: 'Error Handling',
                issue: 'Boş catch block — sessiz hata yutma',
                makeAfter: () => 'catch (e) { logger.error("Context", e); throw e; }',
                impact: 'high',
            },
            {
                pattern: /\?\.\s*\?\.\s*\?\./,
                category: 'Over-Chaining',
                issue: 'Aşırı optional chaining — veri yapısını gözden geçirin',
                makeAfter: () => '// Ara type guard veya default value kullanın',
                impact: 'low',
            },
            {
                pattern: /return\s+\{[\s\S]{200,}\}/,
                category: 'Large Return Object',
                issue: 'Büyük inline return objesi — interface + constructor kullanın',
                makeAfter: () => 'interface Result { ... }\nreturn new Result(params);',
                impact: 'medium',
            },
            {
                pattern: /==\s+null|!=\s+null|==\s+undefined|!=\s+undefined/,
                category: 'Loose Equality',
                issue: '== null yerine === null && === undefined veya ?. kullanın',
                makeAfter: () => 'if (value == null) { ... } // Bu aslında OK ama açık olsun',
                impact: 'low',
            },
            {
                pattern: /new Array\(|Array\((?!\d)/,
                category: 'Array Init',
                issue: 'new Array() yerine [] literal kullanın',
                makeAfter: () => 'const arr: string[] = [];',
                impact: 'low',
            },
            {
                pattern: /typeof\s+\w+\s*===\s*['"]undefined['"]|typeof\s+\w+\s*!==\s*['"]undefined['"]/,
                category: 'Type Check',
                issue: 'typeof x === "undefined" yerine x === undefined kullanın',
                makeAfter: () => 'if (x === undefined) { ... }',
                impact: 'low',
            },
        ];
        for (const file of files) {
            try {
                const lines = fs.readFileSync(file, 'utf-8').split('\n');
                for (let i = 0; i < lines.length; i++) {
                    if (/^\s*(\/\/|\/\*|\*)/.test(lines[i]))
                        continue;
                    for (const p of REFACTOR_PATTERNS) {
                        if (p.pattern.test(lines[i])) {
                            suggestions.push({
                                file,
                                line: i + 1,
                                category: p.category,
                                issue: p.issue,
                                before: lines[i].trim().slice(0, 80),
                                after: p.makeAfter(lines[i]),
                                impact: p.impact,
                            });
                            break; // one pattern per line
                        }
                    }
                }
            }
            catch { /* skip */ }
        }
        const high = suggestions.filter(s => s.impact === 'high');
        const medium = suggestions.filter(s => s.impact === 'medium');
        const low = suggestions.filter(s => s.impact === 'low');
        output += `**Taranan dosya:** ${files.length} | **Öneri:** ${suggestions.length}`;
        output += ` (🔴 ${high.length} yüksek etki, 🟡 ${medium.length} orta, ⚪ ${low.length} düşük)\n\n`;
        if (suggestions.length === 0) {
            return output + '✅ Yaygın refactor fırsatı bulunamadı.\n';
        }
        // Category summary
        const catCount = new Map();
        for (const s of suggestions)
            catCount.set(s.category, (catCount.get(s.category) ?? 0) + 1);
        output += `### Kategori Özeti\n\n| Kategori | Adet |\n|----------|------|\n`;
        for (const [cat, cnt] of [...catCount.entries()].sort((a, b) => b[1] - a[1])) {
            output += `| ${cat} | ${cnt} |\n`;
        }
        output += '\n';
        for (const [impact, group, emoji, label] of [
            ['high', high, '🔴', 'Yüksek Etki — Önce Bunları Yap'],
            ['medium', medium, '🟡', 'Orta Etki'],
            ['low', low, '⚪', 'Düşük Etki / Stil'],
        ]) {
            if (group.length === 0)
                continue;
            output += `### ${emoji} ${label} (${group.length})\n\n`;
            for (const s of group.slice(0, 6)) {
                output += `**\`${s.file}:${s.line}\`** — ${s.issue}\n`;
                output += `- Before: \`${s.before}\`\n`;
                output += `- After:  \`${s.after}\`\n\n`;
            }
            if (group.length > 6)
                output += `... ve ${group.length - 6} daha.\n\n`;
        }
        return output;
    }
    async runFeaturePlanner(opts) {
        const goal = opts['goal']
            ?? opts['description']
            ?? 'Özellik tanımlanmadı';
        let output = `## Feature Planner\n\n`;
        output += `**Hedef:** ${goal}\n\n`;
        output += `### Önerilen Uygulama Sırası\n\n`;
        output += `Bu özelliği Kiro-style spec workflow ile uygulayın:\n\n`;
        output += `\`\`\`\n`;
        output += `1. spec_init name="${goal.slice(0, 30)}" description="${goal}"\n`;
        output += `2. spec_generate specId="<id>" phase="requirements"\n`;
        output += `3. spec_generate specId="<id>" phase="design"\n`;
        output += `4. spec_generate specId="<id>" phase="tasks"\n`;
        output += `5. task_next  ← ilk göreve başla\n`;
        output += `\`\`\`\n\n`;
        output += `### Özellik Uygulama Kontrol Listesi\n\n`;
        output += `- [ ] Requirements yazıldı ve onaylandı\n`;
        output += `- [ ] Teknik tasarım gözden geçirildi\n`;
        output += `- [ ] Görevler oluşturuldu ve önceliklendirildi\n`;
        output += `- [ ] Mevcut kod impact analizi yapıldı (\`impact-analyzer\`)\n`;
        output += `- [ ] Test senaryoları tanımlandı (\`test-generator\`)\n`;
        output += `- [ ] Güvenlik açısından gözden geçirildi (\`security-audit\`)\n`;
        output += `- [ ] Kod commit'ten önce denetlendi (\`audit_diff\`)\n`;
        return output;
    }
    async runGeneric(skill, opts) {
        return `## ${skill.name}\n\n${skill.instructions}\n\n**Parameters:** ${JSON.stringify(opts, null, 2)}`;
    }
    resolveFiles(target) {
        if (!target)
            return [];
        try {
            const stat = fs.statSync(target);
            if (stat.isFile())
                return [target];
            if (stat.isDirectory()) {
                return this.walkDir(target);
            }
        }
        catch { /* target doesn't exist */ }
        return [];
    }
    walkDir(dir) {
        const results = [];
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
            if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'dist')
                continue;
            const full = path.join(dir, entry.name);
            if (entry.isDirectory())
                results.push(...this.walkDir(full));
            else if (/\.(ts|tsx|js|jsx|py|go|rs|java|cs)$/.test(entry.name))
                results.push(full);
        }
        return results;
    }
}
exports.SkillRunner = SkillRunner;
function formatIssuesMarkdown(title, issues, fileCount) {
    const critical = issues.filter(i => i.severity === 'critical');
    const high = issues.filter(i => i.severity === 'high');
    const medium = issues.filter(i => i.severity === 'medium');
    const low = issues.filter(i => i.severity === 'low');
    let md = `## ${title}\n\n`;
    md += `**Files analyzed:** ${fileCount} | **Issues:** ${issues.length}`;
    md += ` (🔴 ${critical.length} critical, 🟠 ${high.length} high, 🟡 ${medium.length} medium, ⚪ ${low.length} low)\n\n`;
    if (issues.length === 0) {
        md += '✅ No issues found.\n';
        return md;
    }
    for (const severity of ['critical', 'high', 'medium', 'low']) {
        const group = issues.filter(i => i.severity === severity);
        if (group.length === 0)
            continue;
        const emoji = { critical: '🔴', high: '🟠', medium: '🟡', low: '⚪' }[severity];
        md += `### ${emoji} ${severity.toUpperCase()} (${group.length})\n\n`;
        for (const issue of group) {
            md += `**${issue.title}**\n`;
            md += `- File: \`${issue.filepath}${issue.line ? ':' + issue.line : ''}\`\n`;
            if (issue.owaspCategory)
                md += `- OWASP: ${issue.owaspCategory}`;
            if (issue.cwe)
                md += ` | CWE: ${issue.cwe}`;
            if (issue.owaspCategory || issue.cwe)
                md += '\n';
            md += `- ${issue.description}\n`;
            if (issue.fix)
                md += `- **Fix:** ${issue.fix}\n`;
            if (issue.code)
                md += `\`\`\`\n${issue.code}\n\`\`\`\n`;
            md += '\n';
        }
    }
    return md;
}
//# sourceMappingURL=runner.js.map
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
exports.OWASP_PATTERNS = void 0;
exports.scanSecurity = scanSecurity;
const fs = __importStar(require("fs"));
const crypto = __importStar(require("crypto"));
const OWASP_PATTERNS = [
    // A01 - Broken Access Control
    {
        id: 'A01-001', category: 'A01', title: 'Hardcoded admin bypass',
        pattern: /if\s*\(\s*user\s*===?\s*['"]admin['"]/i,
        severity: 'critical', cwe: 'CWE-284',
        description: 'Hardcoded admin user check bypasses proper access control.',
        fix: 'Use role-based access control with proper permission checks.',
    },
    {
        id: 'A01-002', category: 'A01', title: 'Directory traversal risk',
        pattern: /path\.join\([^)]*req\.(body|query|params)/i,
        severity: 'high', cwe: 'CWE-22',
        description: 'User input used directly in path construction.',
        fix: 'Validate and sanitize path components. Use path.resolve() and check against allowed base directory.',
    },
    // A02 - Cryptographic Failures
    {
        id: 'A02-001', category: 'A02', title: 'Weak hash algorithm (MD5)',
        pattern: /createHash\(['"]md5['"]\)/i,
        severity: 'high', cwe: 'CWE-327',
        description: 'MD5 is cryptographically broken and unsuitable for security use.',
        fix: 'Use SHA-256 or stronger: crypto.createHash("sha256")',
    },
    {
        id: 'A02-002', category: 'A02', title: 'Weak hash algorithm (SHA1)',
        pattern: /createHash\(['"]sha1['"]\)/i,
        severity: 'medium', cwe: 'CWE-327',
        description: 'SHA-1 is deprecated for security use.',
        fix: 'Use SHA-256 or stronger.',
    },
    {
        id: 'A02-003', category: 'A02', title: 'Insecure random number generation',
        pattern: /Math\.random\(\)/,
        severity: 'medium', cwe: 'CWE-338',
        description: 'Math.random() is not cryptographically secure.',
        fix: 'Use crypto.randomBytes() or crypto.randomUUID() for security purposes.',
    },
    // A03 - Injection
    {
        id: 'A03-001', category: 'A03', title: 'SQL Injection risk',
        pattern: /['"`]\s*SELECT.*WHERE.*\+|query\s*\(\s*`[^`]*\$\{/i,
        severity: 'critical', cwe: 'CWE-89',
        description: 'String concatenation in SQL query can lead to SQL injection.',
        fix: 'Use parameterized queries or prepared statements.',
    },
    {
        id: 'A03-002', category: 'A03', title: 'Command injection risk',
        pattern: /exec\s*\(\s*[^)]*\+|exec\s*\(\s*`[^`]*\$\{/i,
        severity: 'critical', cwe: 'CWE-78',
        description: 'User input in shell command execution.',
        fix: 'Use execFile() with argument arrays, never build shell commands from user input.',
    },
    {
        id: 'A03-003', category: 'A03', title: 'eval() usage',
        pattern: /\beval\s*\(/,
        severity: 'critical', cwe: 'CWE-95',
        description: 'eval() executes arbitrary code and is a serious injection risk.',
        fix: 'Avoid eval(). Use JSON.parse() for data, or restructure code.',
    },
    {
        id: 'A03-004', category: 'A03', title: 'XSS risk - innerHTML',
        pattern: /\.innerHTML\s*=/,
        severity: 'high', cwe: 'CWE-79',
        description: 'Direct innerHTML assignment can lead to XSS.',
        fix: 'Use textContent for text, or DOMPurify to sanitize HTML.',
    },
    {
        id: 'A03-005', category: 'A03', title: 'NoSQL injection risk',
        pattern: /\$where\s*:|\.find\(\s*\{[^}]*req\.(body|query)/i,
        severity: 'high', cwe: 'CWE-943',
        description: 'User input in NoSQL query.',
        fix: 'Validate and sanitize all user input before using in database queries.',
    },
    // A05 - Security Misconfiguration
    {
        id: 'A05-001', category: 'A05', title: 'CORS wildcard',
        pattern: /Access-Control-Allow-Origin.*\*|cors\(\s*\)/,
        severity: 'medium', cwe: 'CWE-942',
        description: 'Wildcard CORS allows any origin to access resources.',
        fix: 'Specify allowed origins explicitly.',
    },
    {
        id: 'A05-002', category: 'A05', title: 'SSL/TLS verification disabled',
        pattern: /rejectUnauthorized\s*:\s*false|NODE_TLS_REJECT_UNAUTHORIZED\s*=\s*['"]0['"]/,
        severity: 'critical', cwe: 'CWE-295',
        description: 'TLS certificate verification is disabled.',
        fix: 'Never disable TLS verification in production.',
    },
    // A07 - Auth failures
    {
        id: 'A07-001', category: 'A07', title: 'Hardcoded credentials',
        pattern: /password\s*[:=]\s*['"][^'"]{3,}['"]|passwd\s*[:=]\s*['"][^'"]{3,}['"]/i,
        severity: 'critical', cwe: 'CWE-798',
        description: 'Hardcoded password found in source code.',
        fix: 'Use environment variables or a secrets manager.',
    },
    {
        id: 'A07-002', category: 'A07', title: 'JWT secret hardcoded',
        pattern: /jwt\.sign\([^,]+,\s*['"][^'"]{8,}['"]/,
        severity: 'critical', cwe: 'CWE-798',
        description: 'JWT signing secret is hardcoded.',
        fix: 'Load JWT secret from environment variable: process.env.JWT_SECRET',
    },
    {
        id: 'A07-003', category: 'A07', title: 'Weak session configuration',
        pattern: /secret\s*:\s*['"]change.?me|secret\s*:\s*['"]your.?secret/i,
        severity: 'high', cwe: 'CWE-521',
        description: 'Default or weak session secret detected.',
        fix: 'Use a strong random secret from environment variables.',
    },
    // A08 - Insecure Deserialization
    {
        id: 'A08-001', category: 'A08', title: 'Unsafe deserialization',
        pattern: /unserialize\(|pickle\.loads?\(|yaml\.load\s*\([^)]*Loader/,
        severity: 'high', cwe: 'CWE-502',
        description: 'Unsafe deserialization can lead to remote code execution.',
        fix: 'Use safe alternatives: yaml.safeLoad(), avoid unserialize() with user data.',
    },
    // A09 - Logging failures
    {
        id: 'A09-001', category: 'A09', title: 'Sensitive data in logs',
        pattern: /console\.log\([^)]*password|log\([^)]*token|log\([^)]*secret/i,
        severity: 'medium', cwe: 'CWE-532',
        description: 'Sensitive information logged to console.',
        fix: 'Never log passwords, tokens, or secrets. Redact sensitive fields.',
    },
    // A10 - SSRF
    {
        id: 'A10-001', category: 'A10', title: 'SSRF risk',
        pattern: /fetch\s*\(\s*req\.(body|query|params)|axios\.(get|post)\s*\(\s*req\.(body|query)/i,
        severity: 'high', cwe: 'CWE-918',
        description: 'User-controlled URL in HTTP request (SSRF).',
        fix: 'Validate URLs against an allowlist. Block internal IPs.',
    },
];
exports.OWASP_PATTERNS = OWASP_PATTERNS;
/** Strip regex literals and single-line comment tails to prevent self-referential false positives */
function stripNonCode(line) {
    // Remove inline // comments
    const commentIdx = line.indexOf('//');
    const stripped = commentIdx >= 0 ? line.slice(0, commentIdx) : line;
    // Remove regex literals: /pattern/flags
    return stripped.replace(/\/(?:[^\/\\\n]|\\.)+\/[gimsuy]*/g, '/**/');
}
function scanSecurity(filepath, content) {
    const issues = [];
    let src;
    try {
        src = content ?? fs.readFileSync(filepath, 'utf-8');
    }
    catch {
        return [];
    }
    const lines = src.split('\n');
    let inBlockComment = false;
    for (const pattern of OWASP_PATTERNS) {
        inBlockComment = false;
        for (let i = 0; i < lines.length; i++) {
            let line = lines[i];
            // Track block comments
            if (inBlockComment) {
                const end = line.indexOf('*/');
                if (end >= 0) {
                    inBlockComment = false;
                    line = line.slice(end + 2);
                }
                else
                    continue;
            }
            if (line.includes('/*')) {
                const start = line.indexOf('/*');
                const end = line.indexOf('*/');
                if (end > start) {
                    line = line.slice(0, start) + line.slice(end + 2);
                }
                else {
                    inBlockComment = true;
                    line = line.slice(0, start);
                }
            }
            const trimmed = line.trim();
            // Skip single-line comment lines
            if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('#'))
                continue;
            // Skip pattern-definition / metadata lines (prevents self-referential false positives)
            if (/^\s*(?:description|fix|title|cwe|id|category)\s*:/.test(line))
                continue;
            const testLine = stripNonCode(line);
            if (pattern.pattern.test(testLine)) {
                issues.push({
                    id: crypto.randomUUID(),
                    severity: pattern.severity,
                    category: 'security',
                    title: pattern.title,
                    description: pattern.description,
                    filepath,
                    line: i + 1,
                    code: line.trim().slice(0, 200),
                    fix: pattern.fix,
                    owaspCategory: pattern.category,
                    cwe: pattern.cwe,
                });
            }
        }
    }
    return issues;
}
//# sourceMappingURL=security.js.map
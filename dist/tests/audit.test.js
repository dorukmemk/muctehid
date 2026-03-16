"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const security_js_1 = require("../lib/audit/security.js");
const secrets_js_1 = require("../lib/audit/secrets.js");
const quality_js_1 = require("../lib/audit/quality.js");
// ─── security.ts ──────────────────────────────────────────────────────────────
(0, node_test_1.describe)('scanSecurity', () => {
    (0, node_test_1.it)('detects eval() in actual code', () => {
        const issues = (0, security_js_1.scanSecurity)('test.ts', `const result = eval(userInput);`);
        strict_1.default.ok(issues.some(i => i.title.includes('eval')), 'should flag eval in real code');
    });
    (0, node_test_1.it)('does NOT false-positive on its own pattern definitions', () => {
        const src = `
const OWASP_PATTERNS = [
  {
    id: 'A03-003',
    title: 'eval() usage',
    pattern: /\\beval\\s*\\(/,
    description: 'eval() executes arbitrary code and is a serious injection risk.',
    fix: 'Avoid eval(). Use JSON.parse() for data.',
  },
];`;
        const issues = (0, security_js_1.scanSecurity)('security.ts', src);
        strict_1.default.equal(issues.filter(i => i.title.includes('eval')).length, 0, 'pattern definition lines must not self-flag');
    });
    (0, node_test_1.it)('does NOT false-positive on description strings containing eval()', () => {
        const src = `  description: 'eval() executes arbitrary code',`;
        const issues = (0, security_js_1.scanSecurity)('test.ts', src);
        strict_1.default.equal(issues.filter(i => i.title.includes('eval')).length, 0, 'description metadata lines must not self-flag');
    });
    (0, node_test_1.it)('detects SQL injection', () => {
        const issues = (0, security_js_1.scanSecurity)('test.ts', 'const q = "SELECT * FROM users WHERE id = " + userId;');
        strict_1.default.ok(issues.some(i => i.title.toLowerCase().includes('sql')), 'should detect SQL injection');
    });
    (0, node_test_1.it)('detects hardcoded password', () => {
        const issues = (0, security_js_1.scanSecurity)('test.ts', `const password = 'hunter2secret';`);
        strict_1.default.ok(issues.some(i => i.title.toLowerCase().includes('credential') || i.category === 'security'));
    });
    (0, node_test_1.it)('skips single-line comment lines', () => {
        const src = `// eval() is dangerous — don't use it`;
        const issues = (0, security_js_1.scanSecurity)('test.ts', src);
        strict_1.default.equal(issues.filter(i => i.title.includes('eval')).length, 0, 'commented-out eval must not flag');
    });
    (0, node_test_1.it)('skips block comment content', () => {
        const src = `
/*
 * eval() should never be used
 */`;
        const issues = (0, security_js_1.scanSecurity)('test.ts', src);
        strict_1.default.equal(issues.filter(i => i.title.includes('eval')).length, 0, 'block-commented eval must not flag');
    });
});
// ─── secrets.ts ───────────────────────────────────────────────────────────────
(0, node_test_1.describe)('scanSecrets', () => {
    (0, node_test_1.it)('does NOT false-positive on PGP pattern definition line', () => {
        const src = `  { type: 'PGP Private Key', pattern: /-----BEGIN PGP PRIVATE KEY BLOCK-----/ },`;
        const secrets = (0, secrets_js_1.scanSecrets)('secrets.ts', src);
        strict_1.default.equal(secrets.filter(s => s.type === 'PGP Private Key').length, 0, 'pattern definition must not self-flag as a secret');
    });
    (0, node_test_1.it)('does NOT false-positive on SSH pattern definition', () => {
        const src = `  { type: 'SSH Private Key', pattern: /-----BEGIN (RSA|EC|DSA|OPENSSH) PRIVATE KEY-----/ },`;
        const secrets = (0, secrets_js_1.scanSecrets)('secrets.ts', src);
        strict_1.default.equal(secrets.filter(s => s.type === 'SSH Private Key').length, 0, 'SSH pattern definition must not self-flag');
    });
    (0, node_test_1.it)('detects AWS access key in real code', () => {
        const src = `const key = 'AKIAIOSFODNN7EXAMPLE'; // aws access key`;
        const secrets = (0, secrets_js_1.scanSecrets)('config.ts', src);
        strict_1.default.ok(secrets.some(s => s.type === 'AWS Access Key'), 'real AWS key must be flagged');
    });
    (0, node_test_1.it)('skips single-line comment lines', () => {
        const src = `// const pgpKey = '-----BEGIN PGP PRIVATE KEY BLOCK-----';`;
        const secrets = (0, secrets_js_1.scanSecrets)('test.ts', src);
        strict_1.default.equal(secrets.length, 0, 'commented-out secret must not flag');
    });
    (0, node_test_1.it)('skips block comment content', () => {
        const src = `
/*
 * Example: -----BEGIN PGP PRIVATE KEY BLOCK-----
 */`;
        const secrets = (0, secrets_js_1.scanSecrets)('test.ts', src);
        strict_1.default.equal(secrets.length, 0, 'block-comment secret must not flag');
    });
    (0, node_test_1.it)('does NOT flag low-entropy generic secrets', () => {
        // entropy too low to be real
        const src = `const token = 'aaaaaaaa';`;
        const secrets = (0, secrets_js_1.scanSecrets)('test.ts', src);
        strict_1.default.equal(secrets.filter(s => s.type === 'Generic Secret').length, 0, 'low-entropy value must not be flagged');
    });
});
// ─── scanTodos ────────────────────────────────────────────────────────────────
(0, node_test_1.describe)('scanTodos', () => {
    (0, node_test_1.it)('finds TODO comments', () => {
        const todos = (0, quality_js_1.scanTodos)('test.ts', `// TODO: refactor this function`);
        strict_1.default.equal(todos.length, 1);
        strict_1.default.equal(todos[0].type, 'TODO');
    });
    (0, node_test_1.it)('finds FIXME comments', () => {
        const todos = (0, quality_js_1.scanTodos)('test.ts', `// FIXME: this breaks on null input`);
        strict_1.default.equal(todos.length, 1);
        strict_1.default.equal(todos[0].type, 'FIXME');
    });
    (0, node_test_1.it)('returns empty for clean file', () => {
        const todos = (0, quality_js_1.scanTodos)('test.ts', `const x = 1;\nconst y = 2;`);
        strict_1.default.equal(todos.length, 0);
    });
});
//# sourceMappingURL=audit.test.js.map
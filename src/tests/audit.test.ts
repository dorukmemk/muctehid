import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { scanSecurity } from '../lib/audit/security.js';
import { scanSecrets } from '../lib/audit/secrets.js';
import { scanTodos } from '../lib/audit/quality.js';

// ─── security.ts ──────────────────────────────────────────────────────────────

describe('scanSecurity', () => {
  it('detects eval() in actual code', () => {
    const issues = scanSecurity('test.ts', `const result = eval(userInput);`);
    assert.ok(issues.some(i => i.title.includes('eval')), 'should flag eval in real code');
  });

  it('does NOT false-positive on its own pattern definitions', () => {
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
    const issues = scanSecurity('security.ts', src);
    assert.equal(issues.filter(i => i.title.includes('eval')).length, 0,
      'pattern definition lines must not self-flag');
  });

  it('does NOT false-positive on description strings containing eval()', () => {
    const src = `  description: 'eval() executes arbitrary code',`;
    const issues = scanSecurity('test.ts', src);
    assert.equal(issues.filter(i => i.title.includes('eval')).length, 0,
      'description metadata lines must not self-flag');
  });

  it('detects SQL injection', () => {
    const issues = scanSecurity('test.ts', 'const q = "SELECT * FROM users WHERE id = " + userId;');
    assert.ok(issues.some(i => i.title.toLowerCase().includes('sql')), 'should detect SQL injection');
  });

  it('detects hardcoded password', () => {
    const issues = scanSecurity('test.ts', `const password = 'hunter2secret';`);
    assert.ok(issues.some(i => i.title.toLowerCase().includes('credential') || i.category === 'security'));
  });

  it('skips single-line comment lines', () => {
    const src = `// eval() is dangerous — don't use it`;
    const issues = scanSecurity('test.ts', src);
    assert.equal(issues.filter(i => i.title.includes('eval')).length, 0,
      'commented-out eval must not flag');
  });

  it('skips block comment content', () => {
    const src = `
/*
 * eval() should never be used
 */`;
    const issues = scanSecurity('test.ts', src);
    assert.equal(issues.filter(i => i.title.includes('eval')).length, 0,
      'block-commented eval must not flag');
  });
});

// ─── secrets.ts ───────────────────────────────────────────────────────────────

describe('scanSecrets', () => {
  it('does NOT false-positive on PGP pattern definition line', () => {
    const src = `  { type: 'PGP Private Key', pattern: /-----BEGIN PGP PRIVATE KEY BLOCK-----/ },`;
    const secrets = scanSecrets('secrets.ts', src);
    assert.equal(secrets.filter(s => s.type === 'PGP Private Key').length, 0,
      'pattern definition must not self-flag as a secret');
  });

  it('does NOT false-positive on SSH pattern definition', () => {
    const src = `  { type: 'SSH Private Key', pattern: /-----BEGIN (RSA|EC|DSA|OPENSSH) PRIVATE KEY-----/ },`;
    const secrets = scanSecrets('secrets.ts', src);
    assert.equal(secrets.filter(s => s.type === 'SSH Private Key').length, 0,
      'SSH pattern definition must not self-flag');
  });

  it('detects AWS access key in real code', () => {
    const src = `const key = 'AKIAIOSFODNN7EXAMPLE'; // aws access key`;
    const secrets = scanSecrets('config.ts', src);
    assert.ok(secrets.some(s => s.type === 'AWS Access Key'), 'real AWS key must be flagged');
  });

  it('skips single-line comment lines', () => {
    const src = `// const pgpKey = '-----BEGIN PGP PRIVATE KEY BLOCK-----';`;
    const secrets = scanSecrets('test.ts', src);
    assert.equal(secrets.length, 0, 'commented-out secret must not flag');
  });

  it('skips block comment content', () => {
    const src = `
/*
 * Example: -----BEGIN PGP PRIVATE KEY BLOCK-----
 */`;
    const secrets = scanSecrets('test.ts', src);
    assert.equal(secrets.length, 0, 'block-comment secret must not flag');
  });

  it('does NOT flag low-entropy generic secrets', () => {
    // entropy too low to be real
    const src = `const token = 'aaaaaaaa';`;
    const secrets = scanSecrets('test.ts', src);
    assert.equal(secrets.filter(s => s.type === 'Generic Secret').length, 0,
      'low-entropy value must not be flagged');
  });
});

// ─── scanTodos ────────────────────────────────────────────────────────────────

describe('scanTodos', () => {
  it('finds TODO comments', () => {
    const todos = scanTodos('test.ts', `// TODO: refactor this function`);
    assert.equal(todos.length, 1);
    assert.equal(todos[0].type, 'TODO');
  });

  it('finds FIXME comments', () => {
    const todos = scanTodos('test.ts', `// FIXME: this breaks on null input`);
    assert.equal(todos.length, 1);
    assert.equal(todos[0].type, 'FIXME');
  });

  it('returns empty for clean file', () => {
    const todos = scanTodos('test.ts', `const x = 1;\nconst y = 2;`);
    assert.equal(todos.length, 0);
  });
});

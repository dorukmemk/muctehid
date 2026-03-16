import * as fs from 'fs';
import * as crypto from 'crypto';
import { SecretMatch } from '../../types/index.js';

interface SecretPattern {
  type: string;
  pattern: RegExp;
  minEntropy?: number;
}

const SECRET_PATTERNS: SecretPattern[] = [
  { type: 'AWS Access Key', pattern: /AKIA[0-9A-Z]{16}/, minEntropy: 3.5 },
  { type: 'AWS Secret Key', pattern: /aws_secret_access_key\s*=\s*['"]?([A-Za-z0-9/+=]{40})['"]?/i },
  { type: 'GitHub Token', pattern: /ghp_[A-Za-z0-9]{36}|github_pat_[A-Za-z0-9_]{82}/ },
  { type: 'GitHub OAuth', pattern: /gho_[A-Za-z0-9]{36}/ },
  { type: 'Slack Token', pattern: /xox[baprs]-([0-9a-zA-Z]{10,48})/ },
  { type: 'Stripe Secret Key', pattern: /sk_live_[0-9a-zA-Z]{24}/ },
  { type: 'Stripe Publishable Key', pattern: /pk_live_[0-9a-zA-Z]{24}/ },
  { type: 'Google API Key', pattern: /AIza[0-9A-Za-z\-_]{35}/ },
  { type: 'Google OAuth', pattern: /[0-9]+-[0-9A-Za-z_]{32}\.apps\.googleusercontent\.com/ },
  { type: 'JWT Token', pattern: /eyJ[A-Za-z0-9\-_]+\.eyJ[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+/ },
  { type: 'SSH Private Key', pattern: /-----BEGIN (RSA|EC|DSA|OPENSSH) PRIVATE KEY-----/ },
  { type: 'PGP Private Key', pattern: /-----BEGIN PGP PRIVATE KEY BLOCK-----/ },
  { type: 'Heroku API Key', pattern: /[hH]eroku.*[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}/i },
  { type: 'Twilio API Key', pattern: /SK[0-9a-fA-F]{32}/ },
  { type: 'SendGrid API Key', pattern: /SG\.[A-Za-z0-9\-_]{22}\.[A-Za-z0-9\-_]{43}/ },
  { type: 'Mailgun API Key', pattern: /key-[0-9a-zA-Z]{32}/ },
  { type: 'NPM Token', pattern: /npm_[A-Za-z0-9]{36}/ },
  { type: 'Generic Secret', pattern: /(?:secret|password|passwd|pwd|token|api[_-]?key)\s*[:=]\s*['"]([^'"]{8,})['"](?!\s*#\s*(example|placeholder|todo))/i, minEntropy: 3.0 },
];

// Shannon entropy calculation
function shannonEntropy(str: string): number {
  const freq: Record<string, number> = {};
  for (const ch of str) freq[ch] = (freq[ch] ?? 0) + 1;
  const len = str.length;
  return -Object.values(freq).reduce((sum, count) => {
    const p = count / len;
    return sum + p * Math.log2(p);
  }, 0);
}

const SKIP_VALUES = new Set([
  'example', 'placeholder', 'your_token', 'your_key', 'your_secret',
  'changeme', 'change_me', 'xxxxxxxx', 'password', 'secret', 'token',
  'undefined', 'null', 'test', 'demo', 'sample',
]);

export function scanSecrets(filepath: string, content?: string): SecretMatch[] {
  const matches: SecretMatch[] = [];
  let src: string;

  try {
    src = content ?? fs.readFileSync(filepath, 'utf-8');
  } catch {
    return [];
  }

  const lines = src.split('\n');
  let inBlockComment = false;

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];

    // Track /* ... */ block comments
    if (inBlockComment) {
      const end = line.indexOf('*/');
      if (end >= 0) { inBlockComment = false; line = line.slice(end + 2); }
      else continue;
    }
    if (line.includes('/*')) {
      const start = line.indexOf('/*');
      const end = line.indexOf('*/');
      if (end > start) { line = line.slice(0, start) + line.slice(end + 2); }
      else { inBlockComment = true; line = line.slice(0, start); }
    }

    // Skip single-line comments
    const trimmed = line.trim();
    if (trimmed.startsWith('//') || trimmed.startsWith('#') || trimmed.startsWith('*')) continue;
    // Skip pattern-definition lines (self-referential false positive prevention)
    if (/^\s*(?:type|pattern|description|fix)\s*:/.test(line)) continue;
    // Strip regex literals so patterns defined in code don't self-match
    const testLine = line.replace(/\/(?:[^\/\\\n]|\\.)+\/[gimsuy]*/g, '/**/');

    for (const sp of SECRET_PATTERNS) {
      const match = sp.pattern.exec(testLine);
      if (!match) continue;

      const value = match[1] ?? match[0];

      // Skip obviously fake values
      if (SKIP_VALUES.has(value.toLowerCase())) continue;
      if (value.length < 8) continue;

      // Check entropy if required
      if (sp.minEntropy && shannonEntropy(value) < sp.minEntropy) continue;

      matches.push({
        type: sp.type,
        value: value.slice(0, 8) + '...[REDACTED]',
        filepath,
        line: i + 1,
        entropy: shannonEntropy(value),
      });
    }
  }

  return matches;
}

import * as fs from 'fs';
import * as path from 'path';
import { AuditConfig } from '../types/index.js';

const DEFAULT_CONFIG: AuditConfig = {
  version: '2.0',
  memory: {
    mode: 'hybrid',
    embeddingModel: 'Xenova/all-MiniLM-L6-v2',
    chunkSize: 150,
    chunkOverlap: 20,
    exclude: ['node_modules', 'dist', '.git', '*.min.js', '*.lock', '*.map', '.audit-data'],
  },
  audit: {
    severity: ['critical', 'high', 'medium', 'low'],
    categories: ['security', 'quality', 'performance', 'docs'],
    owasp: true,
    secrets: true,
  },
  skills: {
    autoTrigger: true,
    installed: ['security-audit', 'code-review', 'dependency-risk'],
  },
  plugins: [],
  hooks: {
    preCommit: true,
    prePush: false,
    onSave: false,
  },
  report: {
    format: 'markdown',
    outputDir: '.audit-data/reports',
    autoGenerate: false,
  },
};

let cachedConfig: AuditConfig | null = null;
let configPath = '';

export function loadConfig(repoRoot: string): AuditConfig {
  const filePath = path.join(repoRoot, '.audit-config.json');
  configPath = filePath;

  if (cachedConfig && configPath === filePath) return cachedConfig;

  if (!fs.existsSync(filePath)) {
    cachedConfig = DEFAULT_CONFIG;
    return cachedConfig;
  }

  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(raw);
    cachedConfig = deepMerge(DEFAULT_CONFIG as unknown as Record<string, unknown>, parsed) as unknown as AuditConfig;
    return cachedConfig;
  } catch {
    return DEFAULT_CONFIG;
  }
}

export function getConfig(): AuditConfig {
  return cachedConfig ?? DEFAULT_CONFIG;
}

function deepMerge(target: Record<string, unknown>, source: Record<string, unknown>): Record<string, unknown> {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    if (
      source[key] !== null &&
      typeof source[key] === 'object' &&
      !Array.isArray(source[key]) &&
      typeof target[key] === 'object' &&
      !Array.isArray(target[key])
    ) {
      result[key] = deepMerge(target[key] as Record<string, unknown>, source[key] as Record<string, unknown>);
    } else {
      result[key] = source[key];
    }
  }
  return result;
}

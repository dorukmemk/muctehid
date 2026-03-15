// ─── Code Memory Types ────────────────────────────────────────────────────────

export interface CodeChunk {
  id: string;           // sha256(filepath + startLine)
  filepath: string;
  content: string;
  startLine: number;
  endLine: number;
  language: string;     // ts, py, go, rs, js, etc.
  symbols: string[];    // function/class names
  metadata: {
    size: number;
    lastModified: number;
    gitAuthor?: string;
  };
}

export interface SearchResult {
  chunk: CodeChunk;
  score: number;
  bm25Score?: number;
  vectorScore?: number;
}

export type SearchMode = 'bm25' | 'vector' | 'hybrid';

export interface SearchOptions {
  k?: number;
  mode?: SearchMode;
  filter?: {
    language?: string;
    filepath?: string;
  };
}

export interface MemoryStats {
  chunks: number;
  files: number;
  embeddingsReady: boolean;
  dbSize: number;
}

export interface IndexOptions {
  exclude?: string[];
  chunkSize?: number;
  overlap?: number;
  mode?: SearchMode;
}

// ─── Audit Types ──────────────────────────────────────────────────────────────

export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export interface AuditIssue {
  id: string;
  severity: Severity;
  category: 'security' | 'quality' | 'performance' | 'docs' | 'secret' | 'dependency';
  title: string;
  description: string;
  filepath: string;
  line?: number;
  column?: number;
  code?: string;
  fix?: string;
  owaspCategory?: string;
  cwe?: string;
}

export interface AuditResult {
  filepath: string;
  issues: AuditIssue[];
  healthScore: number;
  timestamp: number;
}

export interface HealthScore {
  total: number;           // 0-100
  security: number;        // 30%
  quality: number;         // 25%
  docs: number;            // 20%
  tests: number;           // 15%
  dependencies: number;    // 10%
  grade: 'excellent' | 'good' | 'needs-attention' | 'critical';
  issues: AuditIssue[];
}

// ─── Secret Types ─────────────────────────────────────────────────────────────

export interface SecretMatch {
  type: string;
  value: string;
  filepath: string;
  line: number;
  entropy?: number;
}

// ─── Skills Types ─────────────────────────────────────────────────────────────

export type SkillType = 'prompt' | 'tool' | 'pipeline' | 'hook' | 'composite';

export interface SkillDefinition {
  name: string;
  version: string;
  description: string;
  author: string;
  category: string;
  type?: SkillType;
  triggers: string[];
  tools: string[];
  parameters: Record<string, SkillParameter>;
  hooks?: {
    pre_commit?: boolean;
    on_save?: boolean;
  };
  output?: {
    format?: string;
    include_fixes?: boolean;
    severity_color?: boolean;
  };
  instructions: string;
  dir: string;
}

export interface SkillParameter {
  type: 'string' | 'number' | 'boolean' | 'enum' | 'array';
  values?: string[];
  default?: unknown;
  description?: string;
  required?: boolean;
}

export interface SkillRunOptions {
  [key: string]: unknown;
}

export interface SkillRunResult {
  skill: string;
  success: boolean;
  output: string;
  issues?: AuditIssue[];
  duration: number;
}

// ─── Git Types ────────────────────────────────────────────────────────────────

export interface DiffHunk {
  header: string;
  oldStart: number;
  newStart: number;
  lines: DiffLine[];
}

export interface DiffLine {
  type: 'add' | 'remove' | 'context';
  content: string;
  lineNumber?: number;
}

export interface GitBlameEntry {
  commit: string;
  author: string;
  date: string;
  line: number;
  content: string;
}

// ─── Config Types ─────────────────────────────────────────────────────────────

export interface AuditConfig {
  version: string;
  memory: {
    mode: SearchMode;
    embeddingModel: string;
    chunkSize: number;
    chunkOverlap: number;
    exclude: string[];
  };
  audit: {
    severity: Severity[];
    categories: string[];
    owasp: boolean;
    secrets: boolean;
  };
  skills: {
    autoTrigger: boolean;
    installed: string[];
  };
  plugins: string[];
  hooks: {
    preCommit: boolean;
    prePush: boolean;
    onSave: boolean;
  };
  report: {
    format: string;
    outputDir: string;
    autoGenerate: boolean;
  };
}

// ─── Plugin Types ─────────────────────────────────────────────────────────────

export interface PluginToolDef {
  name: string;
  description: string;
  inputSchema: unknown;
  handler: (args: unknown) => Promise<unknown>;
}

export interface PluginResourceDef {
  uri: string;
  name: string;
  handler: () => Promise<unknown>;
}

export interface PluginDefinition {
  name: string;
  version: string;
  tools?: PluginToolDef[];
  skills?: string[];
  resources?: PluginResourceDef[];
}

// ─── Report Types ─────────────────────────────────────────────────────────────

export interface Report {
  id: string;
  title: string;
  timestamp: number;
  repoPath: string;
  healthScore: HealthScore;
  issues: AuditIssue[];
  summary: {
    totalFiles: number;
    totalIssues: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
}

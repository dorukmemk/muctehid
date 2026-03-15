#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import * as path from 'path';
import * as fs from 'fs';

import { CodeMemory } from './lib/memory/code-memory.js';
import { SkillRegistry } from './lib/skills/registry.js';
import { SkillsManager } from './tools/skills.js';
import { GitTools } from './tools/git.js';
import { ReportTools } from './tools/report.js';
import { auditFile } from './tools/audit.js';
import { getHealthScore } from './tools/health.js';
import { scanSecrets } from './lib/audit/secrets.js';
import { scanTodos } from './lib/audit/quality.js';
import { complexityIssues } from './lib/audit/complexity.js';
import { getUncommittedDiff, parseDiff } from './lib/git/diff.js';
import { loadConfig } from './lib/config.js';
import { PluginRegistry } from './lib/plugins/registry.js';

// ─── Resolve paths ────────────────────────────────────────────────────────────
const REPO_ROOT = process.env.REPO_ROOT ?? process.cwd();
const AUDIT_DATA_DIR = process.env.AUDIT_DATA_DIR
  ? path.resolve(REPO_ROOT, process.env.AUDIT_DATA_DIR)
  : path.join(REPO_ROOT, '.audit-data');
const BUILTIN_SKILLS_DIR = path.join(__dirname, '..', 'skills');
const INSTALLED_SKILLS_DIR = path.join(AUDIT_DATA_DIR, 'installed-skills');
const REPORTS_DIR = path.join(AUDIT_DATA_DIR, 'reports');

fs.mkdirSync(AUDIT_DATA_DIR, { recursive: true });
fs.mkdirSync(INSTALLED_SKILLS_DIR, { recursive: true });
fs.mkdirSync(REPORTS_DIR, { recursive: true });

// ─── Load config ──────────────────────────────────────────────────────────────
const config = loadConfig(REPO_ROOT);

// ─── Initialize services ──────────────────────────────────────────────────────
let memory: CodeMemory | null = null;

async function getMemory(): Promise<CodeMemory> {
  if (!memory) {
    memory = await CodeMemory.open(AUDIT_DATA_DIR);
  }
  return memory;
}

const skillRegistry = new SkillRegistry([BUILTIN_SKILLS_DIR, INSTALLED_SKILLS_DIR]);
const skillsManager = new SkillsManager(skillRegistry, INSTALLED_SKILLS_DIR);
const gitTools = new GitTools(REPO_ROOT);
const reportTools = new ReportTools(REPORTS_DIR, REPO_ROOT);
const pluginRegistry = new PluginRegistry();

// Load plugins
if (config.plugins.length > 0) {
  pluginRegistry.load(config.plugins, REPO_ROOT).catch(e =>
    console.error('[code-audit] Plugin load error:', e)
  );
}

// ─── MCP Server ───────────────────────────────────────────────────────────────
const server = new Server(
  { name: 'code-audit-mcp', version: '1.0.0' },
  { capabilities: { tools: {} } }
);

// ─── Tool Definitions ─────────────────────────────────────────────────────────
const TOOLS = [
  // Memory
  { name: 'index_codebase', description: 'Index the entire codebase into hybrid BM25+vector memory', inputSchema: { type: 'object', properties: { path: { type: 'string', description: 'Directory to index (default: repo root)' }, mode: { type: 'string', enum: ['bm25', 'vector', 'hybrid'], description: 'Search mode (default: hybrid)' } } } },
  { name: 'search_code', description: 'Search indexed codebase using hybrid BM25+vector search', inputSchema: { type: 'object', required: ['query'], properties: { query: { type: 'string' }, k: { type: 'number', description: 'Number of results (default: 10)' }, mode: { type: 'string', enum: ['bm25', 'vector', 'hybrid'] }, language: { type: 'string', description: 'Filter by language' } } } },
  { name: 'add_memory', description: 'Manually add a note or context to memory', inputSchema: { type: 'object', required: ['content'], properties: { content: { type: 'string' }, filepath: { type: 'string' }, startLine: { type: 'number' }, endLine: { type: 'number' }, language: { type: 'string' } } } },
  { name: 'get_context', description: 'Get indexed context for a specific file', inputSchema: { type: 'object', required: ['filepath'], properties: { filepath: { type: 'string' } } } },
  { name: 'memory_stats', description: 'Show memory index statistics', inputSchema: { type: 'object', properties: {} } },
  { name: 'clear_memory', description: 'Clear all indexed memory', inputSchema: { type: 'object', properties: {} } },
  // Audit
  { name: 'audit_file', description: 'Full security and quality audit of a single file', inputSchema: { type: 'object', required: ['filepath'], properties: { filepath: { type: 'string' } } } },
  { name: 'audit_diff', description: 'Audit uncommitted git changes for security issues', inputSchema: { type: 'object', properties: { staged: { type: 'boolean', description: 'Audit staged changes only' } } } },
  { name: 'security_scan', description: 'OWASP Top 10 pattern scan on a file or directory', inputSchema: { type: 'object', required: ['path'], properties: { path: { type: 'string' } } } },
  { name: 'find_secrets', description: 'Detect API keys, tokens, and secrets in code', inputSchema: { type: 'object', required: ['path'], properties: { path: { type: 'string' } } } },
  { name: 'find_todos', description: 'Find all TODO/FIXME/HACK/BUG comments', inputSchema: { type: 'object', required: ['path'], properties: { path: { type: 'string' } } } },
  { name: 'complexity_score', description: 'Cyclomatic complexity analysis', inputSchema: { type: 'object', required: ['filepath'], properties: { filepath: { type: 'string' } } } },
  { name: 'dependency_audit', description: 'Analyze npm/pip dependency risk', inputSchema: { type: 'object', properties: { path: { type: 'string', description: 'Directory with package.json' } } } },
  { name: 'health_score', description: 'Compute overall repository health score (0-100)', inputSchema: { type: 'object', properties: { path: { type: 'string' } } } },
  // Skills
  { name: 'list_skills', description: 'List all available skills', inputSchema: { type: 'object', properties: {} } },
  { name: 'run_skill', description: 'Run a skill by name', inputSchema: { type: 'object', required: ['skill'], properties: { skill: { type: 'string' }, path: { type: 'string' }, filepath: { type: 'string' } } } },
  { name: 'install_skill', description: 'Install a skill from a directory path', inputSchema: { type: 'object', required: ['path'], properties: { path: { type: 'string' } } } },
  { name: 'remove_skill', description: 'Remove an installed skill', inputSchema: { type: 'object', required: ['skill'], properties: { skill: { type: 'string' } } } },
  { name: 'skill_info', description: 'Show details about a skill', inputSchema: { type: 'object', required: ['skill'], properties: { skill: { type: 'string' } } } },
  { name: 'create_skill', description: 'Generate a skill template', inputSchema: { type: 'object', properties: { name: { type: 'string' }, description: { type: 'string' }, category: { type: 'string' } } } },
  // Git
  { name: 'git_diff_audit', description: 'Audit uncommitted changes for security issues', inputSchema: { type: 'object', properties: { staged: { type: 'boolean' } } } },
  { name: 'git_blame_context', description: 'Get git blame for a file', inputSchema: { type: 'object', required: ['filepath'], properties: { filepath: { type: 'string' } } } },
  { name: 'pre_commit_check', description: 'Run pre-commit security checks on staged changes', inputSchema: { type: 'object', properties: {} } },
  { name: 'commit_history_search', description: 'Search commit history', inputSchema: { type: 'object', properties: { query: { type: 'string' }, limit: { type: 'number' } } } },
  { name: 'install_hooks', description: 'Install git hooks for automated auditing', inputSchema: { type: 'object', properties: { preCommit: { type: 'boolean' }, prePush: { type: 'boolean' } } } },
  // Reports
  { name: 'generate_report', description: 'Generate a full audit report', inputSchema: { type: 'object', properties: {} } },
  { name: 'export_report', description: 'Export a report in markdown/json/html format', inputSchema: { type: 'object', required: ['id'], properties: { id: { type: 'string' }, format: { type: 'string', enum: ['markdown', 'json', 'html'] } } } },
  { name: 'compare_reports', description: 'Compare two audit reports', inputSchema: { type: 'object', required: ['id1', 'id2'], properties: { id1: { type: 'string' }, id2: { type: 'string' } } } },
  // Context
  { name: 'find_references', description: 'Find all usages of a symbol in the codebase', inputSchema: { type: 'object', required: ['symbol'], properties: { symbol: { type: 'string' }, path: { type: 'string' } } } },
  { name: 'get_dependencies', description: 'Get import/dependency graph for a file', inputSchema: { type: 'object', required: ['filepath'], properties: { filepath: { type: 'string' } } } },
];

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOLS,
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args = {} } = request.params;

  try {
    let text = '';

    // Memory tools
    if (['index_codebase', 'search_code', 'add_memory', 'get_context', 'memory_stats', 'clear_memory'].includes(name)) {
      const mem = await getMemory();
      switch (name) {
        case 'index_codebase': {
          const targetPath = (args.path as string) ?? REPO_ROOT;
          const mode = (args.mode as 'bm25' | 'vector' | 'hybrid') ?? 'hybrid';
          const result = await mem.indexDirectory(targetPath, { mode, exclude: config.memory.exclude });
          text = `✅ Indexing complete!\n- Indexed: ${result.indexed} files\n- Skipped: ${result.skipped} files\n- Errors: ${result.errors}`;
          break;
        }
        case 'search_code': {
          const results = await mem.search(args.query as string, {
            k: (args.k as number) ?? 10,
            mode: (args.mode as 'bm25' | 'vector' | 'hybrid') ?? 'hybrid',
            filter: args.language ? { language: args.language as string } : undefined,
          });
          if (!results.length) { text = 'No results found.'; break; }
          text = results.map((r, i) =>
            `### ${i + 1}. ${r.chunk.filepath}:${r.chunk.startLine}-${r.chunk.endLine}\n\`\`\`${r.chunk.language}\n${r.chunk.content.slice(0, 600)}\n\`\`\``
          ).join('\n\n');
          break;
        }
        case 'add_memory': {
          const id = await mem.addChunk({
            filepath: (args.filepath as string) ?? 'manual',
            content: args.content as string,
            startLine: (args.startLine as number) ?? 0,
            endLine: (args.endLine as number) ?? 0,
            language: (args.language as string) ?? 'text',
          });
          text = `Memory added: ${id}`;
          break;
        }
        case 'get_context': {
          const results = await mem.search(args.filepath as string, { k: 5, mode: 'bm25' });
          text = results.map(r => `Lines ${r.chunk.startLine}-${r.chunk.endLine}:\n\`\`\`${r.chunk.language}\n${r.chunk.content}\n\`\`\``).join('\n\n') || 'No context found.';
          break;
        }
        case 'memory_stats': {
          const s = mem.stats();
          text = `## Memory Stats\n- Chunks: ${s.chunks}\n- Files: ${s.files}\n- Embeddings: ${s.embeddingsReady}`;
          break;
        }
        case 'clear_memory': {
          mem.clear();
          text = '🗑️ Memory cleared.';
          break;
        }
      }
    }

    // Audit tools
    else if (name === 'audit_file') {
      const result = auditFile(args.filepath as string);
      text = result.markdown;
    }
    else if (name === 'audit_diff') {
      text = await gitTools.handleTool('git_diff_audit', args);
    }
    else if (name === 'security_scan') {
      const { scanSecurity } = await import('./lib/audit/security.js');
      const target = args.path as string;
      const issues = scanSecurity(target);
      text = `## Security Scan: ${target}\n\n**Issues:** ${issues.length}\n\n` +
        issues.map(i => `- [${i.severity.toUpperCase()}] ${i.title} (line ${i.line})`).join('\n');
    }
    else if (name === 'find_secrets') {
      const target = args.path as string;
      const secrets = scanSecrets(target);
      text = secrets.length === 0
        ? `✅ No secrets found in ${target}`
        : `## Secrets Found (${secrets.length})\n\n` + secrets.map(s => `- **${s.type}** at line ${s.line}: \`${s.value}\``).join('\n');
    }
    else if (name === 'find_todos') {
      const target = args.path as string;
      const todos = scanTodos(target);
      text = todos.length === 0
        ? '✅ No TODO/FIXME comments found.'
        : `## TODOs (${todos.length})\n\n` + todos.map(t => `- **[${t.type}]** line ${t.line}: ${t.text}`).join('\n');
    }
    else if (name === 'complexity_score') {
      const issues = complexityIssues(args.filepath as string);
      text = issues.length === 0
        ? '✅ Complexity is within acceptable limits.'
        : `## Complexity Issues\n\n` + issues.map(i => `- **${i.title}** (line ${i.line}): ${i.description}`).join('\n');
    }
    else if (name === 'dependency_audit') {
      text = await skillsManager.handleTool('run_skill', { skill: 'dependency-risk', ...args });
    }
    else if (name === 'health_score') {
      text = await getHealthScore(REPO_ROOT);
    }

    // Skills tools
    else if (['list_skills', 'run_skill', 'install_skill', 'remove_skill', 'skill_info', 'create_skill'].includes(name)) {
      text = await skillsManager.handleTool(name, args);
    }

    // Git tools
    else if (['git_diff_audit', 'git_blame_context', 'pre_commit_check', 'commit_history_search', 'install_hooks'].includes(name)) {
      text = await gitTools.handleTool(name, args);
    }

    // Report tools
    else if (['generate_report', 'export_report', 'compare_reports'].includes(name)) {
      text = await reportTools.handleTool(name, args);
    }

    // Context tools
    else if (name === 'find_references') {
      const mem = await getMemory();
      const results = await mem.search(args.symbol as string, { k: 20, mode: 'bm25' });
      text = results.length === 0
        ? `No references found for "${args.symbol}"`
        : `## References: ${args.symbol}\n\n` + results.map(r => `- \`${r.chunk.filepath}:${r.chunk.startLine}\``).join('\n');
    }
    else if (name === 'get_dependencies') {
      const filepath = args.filepath as string;
      if (!fs.existsSync(filepath)) throw new Error(`File not found: ${filepath}`);
      const content = fs.readFileSync(filepath, 'utf-8');
      const imports = [...content.matchAll(/(?:import|require)\s*(?:\{[^}]*\}|\w+|\*\s+as\s+\w+)\s+from\s+['"]([^'"]+)['"]/g)]
        .map(m => m[1]);
      text = `## Dependencies: ${filepath}\n\n` + (imports.length === 0 ? 'No imports found.' : imports.map(i => `- \`${i}\``).join('\n'));
    }
    else {
      throw new Error(`Unknown tool: ${name}`);
    }

    return { content: [{ type: 'text', text }] };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: 'text', text: `❌ Error: ${message}` }],
      isError: true,
    };
  }
});

// ─── Start server ─────────────────────────────────────────────────────────────
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('[code-audit-mcp] Server running. Tools: ' + TOOLS.length);
}

main().catch((e) => {
  console.error('[code-audit-mcp] Fatal error:', e);
  process.exit(1);
});

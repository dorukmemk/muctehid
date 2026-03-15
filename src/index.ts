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
import { loadConfig } from './lib/config.js';
import { PluginRegistry } from './lib/plugins/registry.js';
import { TaskStore } from './lib/tasks/task-store.js';
import { SpecEngine } from './lib/spec/spec-engine.js';
import { ResearchEngine } from './lib/research/research-engine.js';
import { render as renderTemplate } from './lib/templates/template-engine.js';
import { TemplateRegistry } from './lib/templates/template-registry.js';
import { detectComplexity } from './lib/orchestrator/complexity-detector.js';
import { selectSkills } from './lib/orchestrator/skill-selector.js';
import { routeTask } from './lib/orchestrator/task-router.js';
import { TaskPriority, TaskCategory, TaskStatus } from './types/v2.js';

// ─── Resolve paths ────────────────────────────────────────────────────────────
const REPO_ROOT = process.env.REPO_ROOT ?? process.cwd();
const AUDIT_DATA_DIR = process.env.AUDIT_DATA_DIR
  ? path.resolve(REPO_ROOT, process.env.AUDIT_DATA_DIR)
  : path.join(REPO_ROOT, '.audit-data');
const BUILTIN_SKILLS_DIR = path.join(__dirname, '..', 'skills');
const INSTALLED_SKILLS_DIR = path.join(AUDIT_DATA_DIR, 'installed-skills');
const REPORTS_DIR = path.join(AUDIT_DATA_DIR, 'reports');
const BUILTIN_TEMPLATES_DIR = path.join(__dirname, '..', 'src', 'lib', 'templates', 'built-in');

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
const taskStore = new TaskStore(AUDIT_DATA_DIR);
const specEngine = new SpecEngine(AUDIT_DATA_DIR);
const templateRegistry = new TemplateRegistry([
  BUILTIN_TEMPLATES_DIR,
  path.join(REPO_ROOT, '.templates'),
]);

// Lazy ResearchEngine (needs memory)
let researchEngine: ResearchEngine | null = null;
async function getResearchEngine(): Promise<ResearchEngine> {
  if (!researchEngine) {
    const mem = await getMemory();
    researchEngine = new ResearchEngine(
      async (query: string, k: number) => {
        const results = await mem.search(query, { k, mode: 'hybrid' });
        return results.map(r => ({
          id: r.chunk.id,
          content: r.chunk.content,
          filepath: r.chunk.filepath,
          score: r.score,
          language: r.chunk.language,
        }));
      },
      async (query: string, k: number) => {
        const results = await mem.search(query, { k, mode: 'bm25' });
        return results.map(r => ({
          id: r.chunk.id,
          content: r.chunk.content,
          filepath: r.chunk.filepath,
          score: r.score,
        }));
      },
    );
  }
  return researchEngine;
}

// Load plugins
if (config.plugins.length > 0) {
  pluginRegistry.load(config.plugins, REPO_ROOT).catch(e =>
    console.error('[muctehid-mcp] Plugin load error:', e)
  );
}

// ─── MCP Server ───────────────────────────────────────────────────────────────
const server = new Server(
  { name: 'muctehid-mcp', version: '2.0.0' },
  { capabilities: { tools: {} } }
);

// ─── Tool Definitions ─────────────────────────────────────────────────────────
const TOOLS = [
  // ── Memory (6) ────────────────────────────────────────────────────────────
  { name: 'index_codebase', description: 'Index the entire codebase into hybrid BM25+vector memory', inputSchema: { type: 'object', properties: { path: { type: 'string' }, mode: { type: 'string', enum: ['bm25', 'vector', 'hybrid'] } } } },
  { name: 'search_code', description: 'Search indexed codebase using hybrid BM25+vector search', inputSchema: { type: 'object', required: ['query'], properties: { query: { type: 'string' }, k: { type: 'number' }, mode: { type: 'string', enum: ['bm25', 'vector', 'hybrid'] }, language: { type: 'string' } } } },
  { name: 'add_memory', description: 'Manually add a note or context to memory', inputSchema: { type: 'object', required: ['content'], properties: { content: { type: 'string' }, filepath: { type: 'string' }, startLine: { type: 'number' }, endLine: { type: 'number' }, language: { type: 'string' } } } },
  { name: 'get_context', description: 'Get indexed context for a specific file', inputSchema: { type: 'object', required: ['filepath'], properties: { filepath: { type: 'string' } } } },
  { name: 'memory_stats', description: 'Show memory index statistics', inputSchema: { type: 'object', properties: {} } },
  { name: 'clear_memory', description: 'Clear all indexed memory', inputSchema: { type: 'object', properties: {} } },
  // ── Audit (8) ─────────────────────────────────────────────────────────────
  { name: 'audit_file', description: 'Full security and quality audit of a single file', inputSchema: { type: 'object', required: ['filepath'], properties: { filepath: { type: 'string' } } } },
  { name: 'audit_diff', description: 'Audit uncommitted git changes', inputSchema: { type: 'object', properties: { staged: { type: 'boolean' } } } },
  { name: 'security_scan', description: 'OWASP Top 10 pattern scan on a file or directory', inputSchema: { type: 'object', required: ['path'], properties: { path: { type: 'string' } } } },
  { name: 'find_secrets', description: 'Detect API keys, tokens, and secrets in code', inputSchema: { type: 'object', required: ['path'], properties: { path: { type: 'string' } } } },
  { name: 'find_todos', description: 'Find all TODO/FIXME/HACK/BUG comments', inputSchema: { type: 'object', required: ['path'], properties: { path: { type: 'string' } } } },
  { name: 'complexity_score', description: 'Cyclomatic complexity analysis', inputSchema: { type: 'object', required: ['filepath'], properties: { filepath: { type: 'string' } } } },
  { name: 'dependency_audit', description: 'Analyze npm/pip dependency risk', inputSchema: { type: 'object', properties: { path: { type: 'string' } } } },
  { name: 'health_score', description: 'Compute overall repository health score (0-100)', inputSchema: { type: 'object', properties: { path: { type: 'string' } } } },
  // ── Skills (6) ────────────────────────────────────────────────────────────
  { name: 'list_skills', description: 'List all available skills', inputSchema: { type: 'object', properties: {} } },
  { name: 'run_skill', description: 'Run a skill by name', inputSchema: { type: 'object', required: ['skill'], properties: { skill: { type: 'string' }, path: { type: 'string' }, filepath: { type: 'string' } } } },
  { name: 'install_skill', description: 'Install a skill from a directory path', inputSchema: { type: 'object', required: ['path'], properties: { path: { type: 'string' } } } },
  { name: 'remove_skill', description: 'Remove an installed skill', inputSchema: { type: 'object', required: ['skill'], properties: { skill: { type: 'string' } } } },
  { name: 'skill_info', description: 'Show details about a skill', inputSchema: { type: 'object', required: ['skill'], properties: { skill: { type: 'string' } } } },
  { name: 'create_skill', description: 'Generate a skill template', inputSchema: { type: 'object', properties: { name: { type: 'string' }, description: { type: 'string' }, category: { type: 'string' } } } },
  // ── Git (5) ───────────────────────────────────────────────────────────────
  { name: 'git_diff_audit', description: 'Audit uncommitted changes for security issues', inputSchema: { type: 'object', properties: { staged: { type: 'boolean' } } } },
  { name: 'git_blame_context', description: 'Get git blame for a file', inputSchema: { type: 'object', required: ['filepath'], properties: { filepath: { type: 'string' } } } },
  { name: 'pre_commit_check', description: 'Run pre-commit security checks', inputSchema: { type: 'object', properties: {} } },
  { name: 'commit_history_search', description: 'Search commit history', inputSchema: { type: 'object', properties: { query: { type: 'string' }, limit: { type: 'number' } } } },
  { name: 'install_hooks', description: 'Install git hooks for automated auditing', inputSchema: { type: 'object', properties: { preCommit: { type: 'boolean' }, prePush: { type: 'boolean' } } } },
  // ── Reports (3) ───────────────────────────────────────────────────────────
  { name: 'generate_report', description: 'Generate a full audit report', inputSchema: { type: 'object', properties: {} } },
  { name: 'export_report', description: 'Export a report in markdown/json/html format', inputSchema: { type: 'object', required: ['id'], properties: { id: { type: 'string' }, format: { type: 'string', enum: ['markdown', 'json', 'html'] } } } },
  { name: 'compare_reports', description: 'Compare two audit reports', inputSchema: { type: 'object', required: ['id1', 'id2'], properties: { id1: { type: 'string' }, id2: { type: 'string' } } } },
  // ── Context (2) ───────────────────────────────────────────────────────────
  { name: 'find_references', description: 'Find all usages of a symbol', inputSchema: { type: 'object', required: ['symbol'], properties: { symbol: { type: 'string' }, path: { type: 'string' } } } },
  { name: 'get_dependencies', description: 'Get import/dependency graph for a file', inputSchema: { type: 'object', required: ['filepath'], properties: { filepath: { type: 'string' } } } },

  // ── Orchestrator (3) ──────────────────────────────────────────────────────
  { name: 'analyze_complexity', description: 'Bir isteğin karmaşıklığını analiz et ve uygun strateji öner', inputSchema: { type: 'object', required: ['request'], properties: { request: { type: 'string' }, context: { type: 'string' } } } },
  { name: 'route_task', description: 'Görevi analiz et ve yürütme planı oluştur (adım adım)', inputSchema: { type: 'object', required: ['request'], properties: { request: { type: 'string' }, context: { type: 'string' } } } },
  { name: 'suggest_skill', description: 'İstek için en uygun skill\'i öner', inputSchema: { type: 'object', required: ['request'], properties: { request: { type: 'string' }, topK: { type: 'number' } } } },

  // ── Spec / Kiro-mode (5) ──────────────────────────────────────────────────
  { name: 'spec_init', description: 'Yeni spec workflow başlat (requirements → design → tasks)', inputSchema: { type: 'object', required: ['name', 'description'], properties: { name: { type: 'string' }, description: { type: 'string' } } } },
  { name: 'spec_list', description: 'Mevcut spec workflow\'larını listele', inputSchema: { type: 'object', properties: {} } },
  { name: 'spec_get', description: 'Spec detaylarını getir', inputSchema: { type: 'object', required: ['specId'], properties: { specId: { type: 'string' } } } },
  { name: 'spec_update_status', description: 'Spec aşamasını güncelle', inputSchema: { type: 'object', required: ['specId', 'status'], properties: { specId: { type: 'string' }, status: { type: 'string', enum: ['requirements', 'design', 'tasks', 'executing', 'done'] } } } },
  { name: 'spec_generate', description: 'Spec için içerik üret (requirements / design / tasks)', inputSchema: { type: 'object', required: ['specId', 'phase'], properties: { specId: { type: 'string' }, phase: { type: 'string', enum: ['requirements', 'design', 'tasks'] }, context: { type: 'string' } } } },

  // ── Tasks (8) ─────────────────────────────────────────────────────────────
  { name: 'task_create', description: 'Yeni görev oluştur', inputSchema: { type: 'object', required: ['title', 'description'], properties: { title: { type: 'string' }, description: { type: 'string' }, priority: { type: 'string', enum: ['critical', 'high', 'medium', 'low'] }, category: { type: 'string', enum: ['feature', 'bug', 'refactor', 'docs', 'test', 'research', 'chore'] }, filepath: { type: 'string' }, estimateHours: { type: 'number' }, dependsOn: { type: 'array', items: { type: 'string' } }, tags: { type: 'array', items: { type: 'string' } }, miniPrompt: { type: 'string' }, specId: { type: 'string' } } } },
  { name: 'task_list', description: 'Görevleri listele', inputSchema: { type: 'object', properties: { status: { type: 'string', enum: ['pending', 'in-progress', 'done', 'blocked', 'cancelled'] }, priority: { type: 'string', enum: ['critical', 'high', 'medium', 'low'] }, category: { type: 'string' }, filepath: { type: 'string' }, specId: { type: 'string' } } } },
  { name: 'task_get', description: 'Görev detaylarını getir', inputSchema: { type: 'object', required: ['taskId'], properties: { taskId: { type: 'string' } } } },
  { name: 'task_update', description: 'Görevi güncelle', inputSchema: { type: 'object', required: ['taskId'], properties: { taskId: { type: 'string' }, status: { type: 'string', enum: ['pending', 'in-progress', 'done', 'blocked', 'cancelled'] }, priority: { type: 'string' }, notes: { type: 'string' }, actualHours: { type: 'number' } } } },
  { name: 'task_delete', description: 'Görevi sil', inputSchema: { type: 'object', required: ['taskId'], properties: { taskId: { type: 'string' } } } },
  { name: 'task_timeline', description: 'Görevin zaman çizelgesini getir', inputSchema: { type: 'object', required: ['taskId'], properties: { taskId: { type: 'string' } } } },
  { name: 'task_next', description: 'Sonraki yapılabilir görevleri getir', inputSchema: { type: 'object', properties: { limit: { type: 'number' } } } },
  { name: 'task_progress', description: 'Görev ilerleme özeti', inputSchema: { type: 'object', properties: { specId: { type: 'string' } } } },

  // ── Research (2) ──────────────────────────────────────────────────────────
  { name: 'research_topic', description: 'Kodebase\'de bir konuyu araştır — anti-hallüsinasyon güvencesi ile', inputSchema: { type: 'object', required: ['topic'], properties: { topic: { type: 'string' }, depth: { type: 'string', enum: ['quick', 'standard', 'deep'] } } } },
  { name: 'verify_claim', description: 'Bir iddiayı kodebase\'de doğrula', inputSchema: { type: 'object', required: ['claim'], properties: { claim: { type: 'string' } } } },

  // ── Templates (3) ─────────────────────────────────────────────────────────
  { name: 'template_list', description: 'Mevcut şablonları listele', inputSchema: { type: 'object', properties: {} } },
  { name: 'template_render', description: 'Şablonu değişkenlerle render et', inputSchema: { type: 'object', required: ['templateName', 'variables'], properties: { templateName: { type: 'string' }, variables: { type: 'object' } } } },
  { name: 'template_save', description: 'Yeni şablon kaydet', inputSchema: { type: 'object', required: ['name', 'content'], properties: { name: { type: 'string' }, content: { type: 'string' }, description: { type: 'string' } } } },
];

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args = {} } = request.params;

  try {
    let text = '';

    // ── Memory tools ──────────────────────────────────────────────────────────
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

    // ── Audit tools ───────────────────────────────────────────────────────────
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
      const content = fs.existsSync(target) ? fs.readFileSync(target, 'utf-8') : '';
      const issues = scanSecurity(target, content);
      text = `## Security Scan: ${target}\n\n**Issues:** ${issues.length}\n\n` +
        issues.map(i => `- [${i.severity.toUpperCase()}] ${i.title} (line ${i.line})`).join('\n');
    }
    else if (name === 'find_secrets') {
      const target = args.path as string;
      const content = fs.existsSync(target) ? fs.readFileSync(target, 'utf-8') : '';
      const secrets = scanSecrets(target, content);
      text = secrets.length === 0
        ? `✅ No secrets found in ${target}`
        : `## Secrets Found (${secrets.length})\n\n` + secrets.map(s => `- **${s.type}** at line ${s.line}: \`${s.value}\``).join('\n');
    }
    else if (name === 'find_todos') {
      const target = args.path as string;
      const content = fs.existsSync(target) ? fs.readFileSync(target, 'utf-8') : '';
      const todos = scanTodos(target, content);
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

    // ── Skills tools ──────────────────────────────────────────────────────────
    else if (['list_skills', 'run_skill', 'install_skill', 'remove_skill', 'skill_info', 'create_skill'].includes(name)) {
      text = await skillsManager.handleTool(name, args);
    }

    // ── Git tools ─────────────────────────────────────────────────────────────
    else if (['git_diff_audit', 'git_blame_context', 'pre_commit_check', 'commit_history_search', 'install_hooks'].includes(name)) {
      text = await gitTools.handleTool(name, args);
    }

    // ── Report tools ──────────────────────────────────────────────────────────
    else if (['generate_report', 'export_report', 'compare_reports'].includes(name)) {
      text = await reportTools.handleTool(name, args);
    }

    // ── Context tools ─────────────────────────────────────────────────────────
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

    // ── Orchestrator tools ────────────────────────────────────────────────────
    else if (name === 'analyze_complexity') {
      const intent = args.request as string;
      const analysis = detectComplexity(intent);
      text = `## Complexity Analysis\n\n` +
        `**Level:** ${analysis.level}\n` +
        `**Estimated Steps:** ${analysis.estimatedSteps}\n` +
        `**Requires Memory:** ${analysis.requiresMemory}\n` +
        `**Requires Research:** ${analysis.requiresResearch}\n` +
        `**Requires Spec:** ${analysis.requiresSpec}\n` +
        `**Confidence:** ${(analysis.confidence * 100).toFixed(0)}%\n` +
        `**Suggested Skills:** ${analysis.suggestedSkills.join(', ') || 'none'}\n\n` +
        `**Reasoning:** ${analysis.reasoning}`;
    }
    else if (name === 'route_task') {
      const intent = args.request as string;
      const analysis = detectComplexity(intent);
      const allSkills = skillRegistry.list();
      const selected = selectSkills(intent, allSkills, analysis);
      const decision = routeTask(intent, analysis, selected);
      text = `## Routing Decision\n\n` +
        `**Strategy:** ${decision.strategy}\n` +
        `**Primary Skill:** ${decision.primarySkill ?? 'none'}\n` +
        `**Requires Approval:** ${decision.requiresApproval}\n` +
        `**Rationale:** ${decision.rationale}\n\n` +
        `### Steps (${decision.steps.length})\n\n` +
        decision.steps.map(s =>
          `${s.order}. **${s.tool}** — ${s.description}${s.miniPrompt ? `\n   > ${s.miniPrompt.slice(0, 100)}` : ''}`
        ).join('\n');
    }
    else if (name === 'suggest_skill') {
      const intent = args.request as string;
      const topK = (args.topK as number) ?? 3;
      const analysis = detectComplexity(intent);
      const allSkills = skillRegistry.list();
      const selected = selectSkills(intent, allSkills, analysis);
      const top = selected.slice(0, topK);
      text = top.length === 0
        ? 'Uygun skill bulunamadı.'
        : `## Önerilen Skill'ler\n\n` + top.map((s, i) =>
          `${i + 1}. **${s.name}** — ${s.description}\n   Category: ${s.category}`
        ).join('\n\n');
    }

    // ── Spec tools ────────────────────────────────────────────────────────────
    else if (name === 'spec_init') {
      const spec = specEngine.create(args.name as string, args.description as string, REPO_ROOT);
      text = `✅ Spec oluşturuldu: **${spec.id}**\n\n` +
        `📋 Requirements: ${spec.requirementsPath}\n` +
        `🏗️ Design: ${spec.designPath}\n` +
        `✅ Tasks: ${spec.tasksPath}\n\n` +
        `Sonraki: \`spec_generate\` ile requirements üretin.`;
    }
    else if (name === 'spec_list') {
      const specs = specEngine.list();
      if (specs.length === 0) { text = 'Hiç spec yok. `spec_init` ile oluşturun.'; }
      else {
        text = specs.map(s =>
          `**${s.id}** — ${s.name}\n  Status: ${s.status} | Tasks: ${s.taskIds.length}\n  ${new Date(s.createdAt).toISOString().slice(0, 10)}`
        ).join('\n\n');
      }
    }
    else if (name === 'spec_get') {
      const spec = specEngine.get(args.specId as string);
      if (!spec) throw new Error(`Spec bulunamadı: ${args.specId}`);
      text = JSON.stringify(spec, null, 2);
    }
    else if (name === 'spec_update_status') {
      specEngine.updateStatus(args.specId as string, args.status as 'requirements' | 'design' | 'tasks' | 'executing' | 'done');
      text = `✅ Spec durumu güncellendi: ${args.specId} → ${args.status}`;
    }
    else if (name === 'spec_generate') {
      const spec = specEngine.get(args.specId as string);
      if (!spec) throw new Error(`Spec bulunamadı: ${args.specId}`);
      const ctx = args.context as string ?? '';
      switch (args.phase) {
        case 'requirements': {
          const content = specEngine.generateRequirementsContent(spec.name, spec.description, ctx);
          specEngine.writeRequirements(args.specId as string, content);
          text = `✅ requirements.md oluşturuldu: ${spec.requirementsPath}`;
          break;
        }
        case 'design': {
          const reqContent = fs.existsSync(spec.requirementsPath) ? fs.readFileSync(spec.requirementsPath, 'utf-8') : '';
          const content = specEngine.generateDesignContent(args.specId as string, reqContent);
          specEngine.writeDesign(args.specId as string, content);
          text = `✅ design.md oluşturuldu: ${spec.designPath}`;
          break;
        }
        case 'tasks': {
          const phases = ctx ? ctx.split('\n').filter(Boolean) : ['Temel uygulama', 'Test ve doğrulama', 'Dokümantasyon'];
          const content = specEngine.generateTasksContent(args.specId as string, spec.name, phases);
          specEngine.writeTasks(args.specId as string, content);
          text = `✅ tasks.md oluşturuldu: ${spec.tasksPath}`;
          break;
        }
        default:
          throw new Error(`Geçersiz phase: ${args.phase}`);
      }
    }

    // ── Task tools ────────────────────────────────────────────────────────────
    else if (name === 'task_create') {
      const task = taskStore.create({
        title: args.title as string,
        description: args.description as string,
        priority: ((args.priority as string) ?? 'medium') as TaskPriority,
        category: ((args.category as string) ?? 'feature') as TaskCategory,
        status: 'pending',
        filepath: args.filepath as string | undefined,
        estimateHours: args.estimateHours as number | undefined,
        dependsOn: (args.dependsOn as string[]) ?? [],
        tags: (args.tags as string[]) ?? [],
        miniPrompt: args.miniPrompt as string | undefined,
        specId: args.specId as string | undefined,
        createdBy: 'user',
      });
      text = `✅ Görev oluşturuldu: **${task.id}**\n\nTitle: ${task.title}\nPriority: ${task.priority} | Category: ${task.category}`;
    }
    else if (name === 'task_list') {
      const tasks = taskStore.list({
        status: args.status as TaskStatus | undefined,
        priority: args.priority as TaskPriority | undefined,
        category: args.category as TaskCategory | undefined,
        filepath: args.filepath as string | undefined,
        specId: args.specId as string | undefined,
      });
      if (tasks.length === 0) { text = 'Görev bulunamadı.'; }
      else {
        text = tasks.map(t =>
          `**${t.id}** [${t.priority.toUpperCase()}] ${t.title}\n  Status: ${t.status} | ${t.estimateHours ?? '?'}h | ${t.category}`
        ).join('\n\n');
      }
    }
    else if (name === 'task_get') {
      const task = taskStore.getById(args.taskId as string);
      if (!task) throw new Error(`Görev bulunamadı: ${args.taskId}`);
      text = JSON.stringify(task, null, 2);
    }
    else if (name === 'task_update') {
      const task = taskStore.update(args.taskId as string, {
        ...(args.status ? { status: args.status as TaskStatus } : {}),
        ...(args.priority ? { priority: args.priority as TaskPriority } : {}),
        ...(args.notes ? { notes: args.notes as string } : {}),
        ...(args.actualHours !== undefined ? { actualHours: args.actualHours as number } : {}),
      });
      if (!task) throw new Error(`Görev bulunamadı: ${args.taskId}`);
      text = `✅ Güncellendi: ${task.title} → ${task.status}`;
    }
    else if (name === 'task_delete') {
      const ok = taskStore.delete(args.taskId as string);
      text = ok ? `✅ Silindi: ${args.taskId}` : `Görev bulunamadı: ${args.taskId}`;
    }
    else if (name === 'task_timeline') {
      const timeline = taskStore.getTimeline(args.taskId as string);
      if (timeline.length === 0) { text = 'Timeline boş.'; }
      else {
        text = timeline.map(e =>
          `[${new Date(e.timestamp).toISOString()}] **${e.event}**${e.detail ? `: ${e.detail}` : ''}`
        ).join('\n');
      }
    }
    else if (name === 'task_next') {
      // Find pending tasks with all deps done
      const done = new Set(taskStore.list({ status: 'done' }).map(t => t.id));
      const pending = taskStore.list({ status: 'pending' });
      const actionable = pending.filter(t => t.dependsOn.every(d => done.has(d)));
      const prio = { critical: 0, high: 1, medium: 2, low: 3 };
      actionable.sort((a, b) => prio[a.priority] - prio[b.priority]);
      const limit = (args.limit as number) ?? 5;
      const top = actionable.slice(0, limit);
      if (top.length === 0) { text = 'Yapılabilir görev yok.'; }
      else {
        text = top.map((t, i) =>
          `${i + 1}. **${t.id}** [${t.priority}] ${t.title}\n   ${t.estimateHours ?? '?'}h — ${t.description.slice(0, 80)}`
        ).join('\n\n');
      }
    }
    else if (name === 'task_progress') {
      const specId = args.specId as string | undefined;
      const tasks = specId ? taskStore.list({ specId }) : taskStore.list();
      const active = tasks.filter(t => t.status !== 'cancelled');
      const done = active.filter(t => t.status === 'done');
      const inProgress = active.filter(t => t.status === 'in-progress');
      const blocked = active.filter(t => t.status === 'blocked');
      const pending = active.filter(t => t.status === 'pending');
      const pct = active.length > 0 ? Math.round((done.length / active.length) * 100) : 0;
      const remaining = active.filter(t => t.status !== 'done').reduce((s, t) => s + (t.estimateHours ?? 1), 0);
      text = `## Görev İlerlemesi\n\n` +
        `- **Toplam:** ${active.length}\n` +
        `- **Tamamlandı:** ${done.length} (%${pct})\n` +
        `- **Devam ediyor:** ${inProgress.length}\n` +
        `- **Bekliyor:** ${pending.length}\n` +
        `- **Bloklandı:** ${blocked.length}\n` +
        `- **Kalan tahmini:** ${remaining.toFixed(1)}h`;
    }

    // ── Research tools ────────────────────────────────────────────────────────
    else if (name === 'research_topic') {
      const eng = await getResearchEngine();
      const maxSources = args.depth === 'quick' ? 5 : args.depth === 'deep' ? 30 : 15;
      const result = await eng.research(args.topic as string, { maxSources });
      text = `## Araştırma: ${result.topic}\n\n` +
        `**Güven Skoru:** ${(result.confidence * 100).toFixed(0)}%\n` +
        `**Kaynak Sayısı:** ${result.sourcesUsed.length}\n\n` +
        `${result.hallucinationReport.flaggedText}\n\n` +
        (result.caveats.length > 0 ? `### Uyarılar\n${result.caveats.map(c => `- ${c}`).join('\n')}` : '');
    }
    else if (name === 'verify_claim') {
      const eng = await getResearchEngine();
      const result = await eng.research(args.claim as string, { maxSources: 10 });
      const status = result.confidence > 0.7 ? '✅ Doğrulandı' : result.confidence > 0.4 ? '⚠️ Kısmen' : '❌ Doğrulanamadı';
      text = `## İddia Doğrulama\n\n` +
        `**İddia:** ${args.claim}\n` +
        `**Sonuç:** ${status} (${(result.confidence * 100).toFixed(0)}%)\n\n` +
        (result.findings.length > 0
          ? `**Kanıtlar:**\n${result.findings.slice(0, 3).map(f => `- ${f.evidence.slice(0, 200)}`).join('\n')}`
          : '**Kanıt bulunamadı.**');
    }

    // ── Template tools ────────────────────────────────────────────────────────
    else if (name === 'template_list') {
      const templates = templateRegistry.list();
      if (templates.length === 0) { text = 'Şablon bulunamadı.'; }
      else {
        text = templates.map(t =>
          `**${t.name}** (v${t.version})\n  ${t.description}\n  Değişkenler: ${t.variables.join(', ')}`
        ).join('\n\n');
      }
    }
    else if (name === 'template_render') {
      const tmpl = templateRegistry.get(args.templateName as string);
      if (!tmpl) throw new Error(`Şablon bulunamadı: ${args.templateName}`);
      const content = fs.readFileSync(tmpl.path, 'utf-8');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      text = renderTemplate(content, (args.variables as any) ?? {});
    }
    else if (name === 'template_save') {
      const dir = path.join(REPO_ROOT, '.templates');
      fs.mkdirSync(dir, { recursive: true });
      const filepath = path.join(dir, `${args.name}.md`);
      const content = args.content as string;
      const hasFrontmatter = content.startsWith('---');
      const final = hasFrontmatter ? content
        : `---\nname: ${args.name}\nversion: 1.0.0\ndescription: ${(args.description as string) ?? args.name}\n---\n\n${content}`;
      fs.writeFileSync(filepath, final, 'utf-8');
      templateRegistry.reload();
      text = `✅ Şablon kaydedildi: ${filepath}`;
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
  console.error(`[muctehid-mcp] v2.0.0 ready. Tools: ${TOOLS.length}`);
}

main().catch((e) => {
  console.error('[muctehid-mcp] Fatal error:', e);
  process.exit(1);
});

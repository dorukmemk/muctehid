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
import { GraphTools } from './tools/graph.js';
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
import { TaskPriority, TaskCategory, TaskStatus } from './types/v2.js';
import { SessionStore } from './lib/orchestrator/session-store.js';
import { Conductor } from './lib/orchestrator/conductor.js';
import { handleOrchestratorTool, ORCHESTRATOR_TOOL_NAMES, ORCHESTRATOR_TOOL_DEFS } from './tools/orchestrator.js';
import { buildReport, saveReport } from './lib/reporter/deep-reporter.js';
import { memoryTools } from './tools/memory-tools.js';

// ─── Collect files (single file or recursive dir walk) ────────────────────────
function collectFiles(target: string, extensions: string[]): string[] {
  if (!fs.existsSync(target)) return [];
  const stat = fs.statSync(target);
  if (stat.isFile()) return [target];
  const results: string[] = [];
  const walk = (dir: string) => {
    let entries: fs.Dirent[];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (e.isDirectory() && !e.name.startsWith('.') && e.name !== 'node_modules' && e.name !== 'dist') {
        walk(path.join(dir, e.name));
      } else if (e.isFile() && extensions.some(ext => e.name.endsWith(ext))) {
        results.push(path.join(dir, e.name));
      }
    }
  };
  walk(target);
  return results;
}

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
const graphTools = new GraphTools(AUDIT_DATA_DIR);
const pluginRegistry = new PluginRegistry();
const taskStore = new TaskStore(AUDIT_DATA_DIR);
const sessionStore = new SessionStore(AUDIT_DATA_DIR);
const conductor = new Conductor(sessionStore, taskStore);
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
  { name: 'index_codebase', description: 'ALWAYS call this at the start of every session and after major file changes. Indexes the entire codebase into hybrid BM25+vector memory so all other tools have context. Respects .gitignore rules automatically. Set buildGraph=true to also build knowledge graph for impact analysis.', inputSchema: { type: 'object', properties: { path: { type: 'string' }, mode: { type: 'string', enum: ['bm25', 'vector', 'hybrid'] }, buildGraph: { type: 'boolean', description: 'Build knowledge graph for impact analysis (default: false)' } } } },
  { name: 'search_code', description: 'Use BEFORE reading any file to find relevant code. Use when the user asks "where is X", "find the code that does Y", "how does Z work", or before editing to understand existing patterns.', inputSchema: { type: 'object', required: ['query'], properties: { query: { type: 'string' }, k: { type: 'number' }, mode: { type: 'string', enum: ['bm25', 'vector', 'hybrid'] }, language: { type: 'string' } } } },
  { name: 'add_memory', description: 'Use when the user mentions an important decision, architectural note, or context that should persist across sessions.', inputSchema: { type: 'object', required: ['content'], properties: { content: { type: 'string' }, filepath: { type: 'string' }, startLine: { type: 'number' }, endLine: { type: 'number' }, language: { type: 'string' } } } },
  { name: 'get_context', description: 'Use when about to edit a specific file — retrieves all indexed chunks for that file to understand its full structure before making changes.', inputSchema: { type: 'object', required: ['filepath'], properties: { filepath: { type: 'string' } } } },
  { name: 'memory_stats', description: 'Use to check if codebase has been indexed yet (chunks: 0 means not indexed). Also shows timeline, file notes, and facts statistics.', inputSchema: { type: 'object', properties: {} } },
  { name: 'clear_memory', description: 'Use when the codebase has changed significantly and a full re-index is needed.', inputSchema: { type: 'object', properties: {} } },
  
  // ── Enhanced Memory (10) ──────────────────────────────────────────────────
  { name: 'timeline_add', description: 'Add event to timeline memory. Use AUTOMATICALLY after every significant action to build episodic memory. Tracks what was done, when, and outcome.', inputSchema: { type: 'object', required: ['action', 'outcome'], properties: { action: { type: 'string' }, context: { type: 'string' }, files: { type: 'array', items: { type: 'string' } }, outcome: { type: 'string', enum: ['success', 'failure', 'partial'] }, tags: { type: 'array', items: { type: 'string' } } } } },
  { name: 'timeline_search', description: 'Search timeline for past events. Use when user asks "what did we do before", "how did we handle X", or to learn from history.', inputSchema: { type: 'object', properties: { query: { type: 'string' }, timeRange: { type: 'string', enum: ['last 24h', 'last 7 days', 'last 30 days', 'all'] }, tags: { type: 'array', items: { type: 'string' } }, outcome: { type: 'string', enum: ['success', 'failure', 'partial'] }, limit: { type: 'number' } } } },
  { name: 'timeline_recent', description: 'Get recent timeline events. Use at session start to see what was done recently.', inputSchema: { type: 'object', properties: { limit: { type: 'number' } } } },
  { name: 'file_note_add', description: 'Add note to a file. Use to remember warnings, learnings, TODOs about specific files. Category: info/warning/todo/learned.', inputSchema: { type: 'object', required: ['filepath', 'note', 'category'], properties: { filepath: { type: 'string' }, note: { type: 'string' }, category: { type: 'string', enum: ['info', 'warning', 'todo', 'learned'] } } } },
  { name: 'file_note_get', description: 'Get all notes for a file. Use AUTOMATICALLY when opening a file to see important information.', inputSchema: { type: 'object', required: ['filepath'], properties: { filepath: { type: 'string' } } } },
  { name: 'file_note_search', description: 'Search across all file notes. Use to find relevant notes across the codebase.', inputSchema: { type: 'object', required: ['query'], properties: { query: { type: 'string' }, limit: { type: 'number' } } } },
  { name: 'fact_add', description: 'Add important fact about the project. Use for critical knowledge (architecture, security, business rules) that should be remembered.', inputSchema: { type: 'object', required: ['fact', 'category', 'importance'], properties: { fact: { type: 'string' }, category: { type: 'string', enum: ['architecture', 'security', 'business', 'technical'] }, importance: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] } } } },
  { name: 'fact_search', description: 'Search important facts. Use before making decisions to recall relevant knowledge.', inputSchema: { type: 'object', required: ['query'], properties: { query: { type: 'string' }, minImportance: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] }, limit: { type: 'number' } } } },
  { name: 'fact_list', description: 'List important facts. Use at session start to load critical knowledge.', inputSchema: { type: 'object', properties: { category: { type: 'string', enum: ['architecture', 'security', 'business', 'technical'] }, importance: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] }, limit: { type: 'number' } } } },
  { name: 'memory_system_stats', description: 'Get statistics about all memory systems (timeline, file notes, facts).', inputSchema: { type: 'object', properties: {} } },
  // ── Audit (8) ─────────────────────────────────────────────────────────────
  { name: 'audit_file', description: 'Use when user says "review this file", "check for issues", "is this secure", or after writing new code to validate it. Runs OWASP + complexity + quality checks.', inputSchema: { type: 'object', required: ['filepath'], properties: { filepath: { type: 'string' } } } },
  { name: 'audit_diff', description: 'Use automatically before every commit or when user says "check my changes", "review what I wrote". Audits all uncommitted git changes.', inputSchema: { type: 'object', properties: { staged: { type: 'boolean' } } } },
  { name: 'security_scan', description: 'Use when user asks "is this secure", "any vulnerabilities", "OWASP check", or when reviewing authentication/authorization/database code. Scans for OWASP Top 10.', inputSchema: { type: 'object', required: ['path'], properties: { path: { type: 'string' } } } },
  { name: 'find_secrets', description: 'Use when user shares code with credentials, before committing, or when asked "any secrets leaked". Detects API keys, tokens, passwords via regex + entropy.', inputSchema: { type: 'object', required: ['path'], properties: { path: { type: 'string' } } } },
  { name: 'find_todos', description: 'Use when user asks "what needs to be done", "any TODOs", or at the start of a work session to understand pending work.', inputSchema: { type: 'object', required: ['path'], properties: { path: { type: 'string' } } } },
  { name: 'complexity_score', description: 'Use when a function feels hard to understand, user asks "is this too complex", or before refactoring. High cyclomatic complexity = refactor candidate.', inputSchema: { type: 'object', required: ['filepath'], properties: { filepath: { type: 'string' } } } },
  { name: 'dependency_audit', description: 'Use when user asks about package security, before deploying, or when adding new dependencies.', inputSchema: { type: 'object', properties: { path: { type: 'string' } } } },
  { name: 'health_score', description: 'Use at the start of a session, when user asks "how is the codebase", or for a project overview. Returns 0-100 score across security/quality/docs/tests/deps.', inputSchema: { type: 'object', properties: { path: { type: 'string' } } } },
  // ── Skills (6) ────────────────────────────────────────────────────────────
  { name: 'list_skills', description: 'Use when unsure which skill to run, or when user asks what capabilities are available.', inputSchema: { type: 'object', properties: {} } },
  { name: 'run_skill', description: 'Use when user asks for: "security audit" → security-audit, "code review" → code-review, "refactor" → refactor-planner, "write tests" → test-generator, "document this" → doc-generator, "plan feature" → feature-planner, "report bug" → bug-reporter, "deep analysis" → deep-dive, "full audit" → audit-runner.', inputSchema: { type: 'object', required: ['skill'], properties: { skill: { type: 'string' }, path: { type: 'string' }, filepath: { type: 'string' }, depth: { type: 'string', enum: ['shallow', 'deep'], description: 'shallow=summary (default), deep=full analysis with code excerpts' }, save: { type: 'boolean', description: 'If true, save skill output as .md file to .audit-data/reports/' } } } },
  { name: 'install_skill', description: 'Use when user wants to add a custom skill from a local directory.', inputSchema: { type: 'object', required: ['path'], properties: { path: { type: 'string' } } } },
  { name: 'remove_skill', description: 'Use when user wants to uninstall a previously installed skill.', inputSchema: { type: 'object', required: ['skill'], properties: { skill: { type: 'string' } } } },
  { name: 'skill_info', description: 'Use to see what a specific skill does, its steps, and expected output before running it.', inputSchema: { type: 'object', required: ['skill'], properties: { skill: { type: 'string' } } } },
  { name: 'create_skill', description: 'Use when user wants to create a reusable workflow or automation for a repeated task.', inputSchema: { type: 'object', properties: { name: { type: 'string' }, description: { type: 'string' }, category: { type: 'string' } } } },
  // ── Git (5) ───────────────────────────────────────────────────────────────
  { name: 'git_diff_audit', description: 'Use before every commit automatically, or when user says "check my changes". Same as audit_diff but focused on security.', inputSchema: { type: 'object', properties: { staged: { type: 'boolean' } } } },
  { name: 'git_blame_context', description: 'Use when user asks "who wrote this", "why was this changed", or to understand the history of a problematic file.', inputSchema: { type: 'object', required: ['filepath'], properties: { filepath: { type: 'string' } } } },
  { name: 'pre_commit_check', description: 'Use as a gate before committing — runs all security checks on staged files.', inputSchema: { type: 'object', properties: {} } },
  { name: 'commit_history_search', description: 'Use when user asks "when was this added", "find commits about X", or to understand when a bug was introduced.', inputSchema: { type: 'object', properties: { query: { type: 'string' }, limit: { type: 'number' } } } },
  { name: 'install_hooks', description: 'Use once during project setup to add pre-commit security gates.', inputSchema: { type: 'object', properties: { preCommit: { type: 'boolean' }, prePush: { type: 'boolean' } } } },
  // ── Reports (3) ───────────────────────────────────────────────────────────
  { name: 'generate_report', description: 'Use when user asks for a full project audit, status report, or before a release/review.', inputSchema: { type: 'object', properties: { save: { type: 'boolean', description: 'If true, write report to .audit-data/reports/ as .md file' }, depth: { type: 'string', enum: ['shallow', 'deep'], description: 'shallow=summary, deep=full analysis with code excerpts' } } } },
  { name: 'export_report', description: 'Use when user wants to share the audit report as markdown, JSON, or HTML.', inputSchema: { type: 'object', required: ['id'], properties: { id: { type: 'string' }, format: { type: 'string', enum: ['markdown', 'json', 'html'] } } } },
  { name: 'compare_reports', description: 'Use when user asks "has the code quality improved", "compare before/after refactor", or tracking progress over time.', inputSchema: { type: 'object', required: ['id1', 'id2'], properties: { id1: { type: 'string' }, id2: { type: 'string' } } } },
  // ── Context (2) ───────────────────────────────────────────────────────────
  { name: 'find_references', description: 'Use when user asks "where is this function used", "find all callers of X", or before renaming/deleting a symbol.', inputSchema: { type: 'object', required: ['symbol'], properties: { symbol: { type: 'string' }, path: { type: 'string' } } } },
  { name: 'get_dependencies', description: 'Use when user asks "what does this file depend on", "show imports", or to understand module relationships before refactoring.', inputSchema: { type: 'object', required: ['filepath'], properties: { filepath: { type: 'string' } } } },

  // ── Orchestrator (8) ──────────────────────────────────────────────────────
  ...ORCHESTRATOR_TOOL_DEFS,

  // ── Spec / Kiro-mode (5) ──────────────────────────────────────────────────
  { name: 'spec_init', description: 'Use when user wants to build a new feature — creates a structured requirements→design→tasks workflow. Trigger on: "implement X", "build Y", "add feature Z", "I want to create...".', inputSchema: { type: 'object', required: ['name', 'description'], properties: { name: { type: 'string' }, description: { type: 'string' } } } },
  { name: 'spec_list', description: 'Use at the start of a session to see ongoing features and their current phase.', inputSchema: { type: 'object', properties: {} } },
  { name: 'spec_get', description: 'Use to load the full context of a specific feature spec before working on it.', inputSchema: { type: 'object', required: ['specId'], properties: { specId: { type: 'string' } } } },
  { name: 'spec_update_status', description: 'Use when advancing a spec from one phase to the next (requirements → design → tasks → executing → done).', inputSchema: { type: 'object', required: ['specId', 'status'], properties: { specId: { type: 'string' }, status: { type: 'string', enum: ['requirements', 'design', 'tasks', 'executing', 'done'] } } } },
  { name: 'spec_generate', description: 'Two-mode tool. WITHOUT content param: returns an expert prompt instructing the LLM what to write for that phase — LLM writes the content and calls back. WITH content param: saves the LLM-generated content to file. Flow: call without content → LLM generates → call again with content to save. Phases in order: requirements → design → tasks.', inputSchema: { type: 'object', required: ['specId', 'phase'], properties: { specId: { type: 'string' }, phase: { type: 'string', enum: ['requirements', 'design', 'tasks'] }, content: { type: 'string', description: 'The markdown content to save. Omit on first call to get the writing prompt.' }, context: { type: 'string' } } } },

  // ── Tasks (8) ─────────────────────────────────────────────────────────────
  { name: 'task_create', description: 'Use when user mentions work to be done, a bug to fix, or a TODO that should be tracked. Also use after spec_generate to create implementation tasks.', inputSchema: { type: 'object', required: ['title', 'description'], properties: { title: { type: 'string' }, description: { type: 'string' }, priority: { type: 'string', enum: ['critical', 'high', 'medium', 'low'] }, category: { type: 'string', enum: ['feature', 'bug', 'refactor', 'docs', 'test', 'research', 'chore'] }, filepath: { type: 'string' }, estimateHours: { type: 'number' }, dependsOn: { type: 'array', items: { type: 'string' } }, tags: { type: 'array', items: { type: 'string' } }, miniPrompt: { type: 'string' }, specId: { type: 'string' } } } },
  { name: 'task_list', description: 'Use when user asks "what are my tasks", "show pending work", or at session start to understand what needs doing.', inputSchema: { type: 'object', properties: { status: { type: 'string', enum: ['pending', 'in-progress', 'done', 'blocked', 'cancelled'] }, priority: { type: 'string', enum: ['critical', 'high', 'medium', 'low'] }, category: { type: 'string' }, filepath: { type: 'string' }, specId: { type: 'string' } } } },
  { name: 'task_get', description: 'Use to load full task context before starting implementation.', inputSchema: { type: 'object', required: ['taskId'], properties: { taskId: { type: 'string' } } } },
  { name: 'task_update', description: 'Use when starting a task (status=in-progress), finishing (status=done), or when blocked. Always update status to keep progress accurate.', inputSchema: { type: 'object', required: ['taskId'], properties: { taskId: { type: 'string' }, status: { type: 'string', enum: ['pending', 'in-progress', 'done', 'blocked', 'cancelled'] }, priority: { type: 'string' }, notes: { type: 'string' }, actualHours: { type: 'number' } } } },
  { name: 'task_delete', description: 'Use when a task is no longer relevant or was created by mistake.', inputSchema: { type: 'object', required: ['taskId'], properties: { taskId: { type: 'string' } } } },
  { name: 'task_timeline', description: 'Use to see the full history of a task — when it was created, started, updated.', inputSchema: { type: 'object', required: ['taskId'], properties: { taskId: { type: 'string' } } } },
  { name: 'task_next', description: 'Use at the start of a work session to find what to work on next. Returns tasks whose dependencies are all done.', inputSchema: { type: 'object', properties: { limit: { type: 'number' } } } },
  { name: 'task_progress', description: 'Use when user asks "how much is done", "project status", or for a sprint summary.', inputSchema: { type: 'object', properties: { specId: { type: 'string' } } } },
  { name: 'task_board', description: 'Use to see visual kanban board of all tasks with progress. Always call after task_create or task_update to confirm changes.', inputSchema: { type: 'object', properties: {} } },

  // ── Research (2) ──────────────────────────────────────────────────────────
  { name: 'research_topic', description: 'Use BEFORE answering questions about how the codebase works — searches memory and verifies findings to avoid hallucination. Use when asked "how does X work", "explain Y", "why does Z happen".', inputSchema: { type: 'object', required: ['topic'], properties: { topic: { type: 'string' }, depth: { type: 'string', enum: ['quick', 'standard', 'deep'] } } } },
  { name: 'verify_claim', description: 'Use before stating something as fact about the codebase. Checks the claim against indexed code and returns a confidence score.', inputSchema: { type: 'object', required: ['claim'], properties: { claim: { type: 'string' } } } },

  // ── Templates (3) ─────────────────────────────────────────────────────────
  { name: 'template_list', description: 'Use when user asks for report templates, document templates, or to see available document formats.', inputSchema: { type: 'object', properties: {} } },
  { name: 'template_render', description: 'Use to generate structured documents (bug reports, audit reports, spec documents) from templates.', inputSchema: { type: 'object', required: ['templateName', 'variables'], properties: { templateName: { type: 'string' }, variables: { type: 'object' } } } },
  { name: 'template_save', description: 'Use when user wants to save a reusable document template for future use.', inputSchema: { type: 'object', required: ['name', 'content'], properties: { name: { type: 'string' }, content: { type: 'string' }, description: { type: 'string' } } } },

  // ── Graph / GitNexus (5) ──────────────────────────────────────────────────
  { name: 'graph_build', description: 'Build knowledge graph from codebase using Tree-sitter AST parsing. Call this ONCE after index_codebase to enable impact analysis, context queries, and graph-based tools. Required before using impact, graph_context, or graph_query.', inputSchema: { type: 'object', properties: { path: { type: 'string', description: 'Directory to build graph from (default: repo root)' }, extensions: { type: 'array', items: { type: 'string' }, description: 'File extensions to parse (default: [.ts, .tsx, .js, .jsx])' } } } },
  { name: 'impact', description: 'CRITICAL: Use BEFORE any refactoring or renaming to see blast radius. Shows what will break if you change a symbol. Direction: upstream = what depends on this (callers), downstream = what this depends on (callees). Use when user asks "what will break", "safe to change", "blast radius", "who calls this".', inputSchema: { type: 'object', required: ['target'], properties: { target: { type: 'string', description: 'Symbol name to analyze (e.g., "validateUser", "AuthService")' }, direction: { type: 'string', enum: ['upstream', 'downstream'], description: 'upstream = callers (default), downstream = callees' }, maxDepth: { type: 'number', description: 'Max traversal depth (default: 3)' }, minConfidence: { type: 'number', description: 'Min confidence score 0-1 (default: 0.0)' } } } },
  { name: 'graph_context', description: 'Get 360° view of a symbol: all incoming calls, outgoing calls, cluster membership. Use when user asks "show me the call graph", "what does X call", "who calls X", "explain this function". More detailed than get_context.', inputSchema: { type: 'object', required: ['name'], properties: { name: { type: 'string', description: 'Symbol name (e.g., "validateUser")' }, filepath: { type: 'string', description: 'Optional: filter by filepath if multiple symbols with same name' } } } },
  { name: 'graph_stats', description: 'Show graph statistics: number of symbols, relations, communities. Use to verify graph is built.', inputSchema: { type: 'object', properties: {} } },
  { name: 'graph_query', description: 'Execute raw Cypher query on knowledge graph. For advanced users. Use when standard tools are not enough.', inputSchema: { type: 'object', required: ['query'], properties: { query: { type: 'string', description: 'Cypher query (e.g., "MATCH (fn:Function)-[:CALLS]->(target) RETURN fn")' } } } },
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
          const buildGraph = (args.buildGraph as boolean) ?? false;
          
          const result = await mem.indexDirectory(targetPath, { mode, exclude: config.memory.exclude });
          text = `✅ Indexing complete!\n- New: ${result.indexed} files\n- Updated: ${result.updated} files\n- Skipped (unchanged): ${result.skipped} files\n- Errors: ${result.errors}`;
          
          // Build knowledge graph if requested
          if (buildGraph) {
            text += `\n\n🔄 Building knowledge graph...`;
            try {
              const graphResult = await graphTools.handleTool('graph_build', { path: targetPath });
              text += `\n${graphResult}`;
            } catch (error) {
              text += `\n⚠️ Graph build failed: ${error instanceof Error ? error.message : String(error)}`;
            }
          } else {
            text += `\n\n💡 Tip: Add \`buildGraph: true\` to enable impact analysis and graph-based tools.`;
          }
          break;
        }
        case 'search_code': {
          const results = await mem.search(args.query as string, {
            k: (args.k as number) ?? 10,
            mode: (args.mode as 'bm25' | 'vector' | 'hybrid') ?? 'hybrid',
            filter: args.language ? { language: args.language as string } : undefined,
          });
          if (!results.length) {
            // Memory empty or not indexed yet — fallback: grep actual files
            const grepRoot = REPO_ROOT;
            const grepFiles = collectFiles(grepRoot, ['.ts','.tsx','.js','.jsx','.py','.go','.rs','.java']);
            const query = (args.query as string).toLowerCase();
            const terms = query.split(/\s+/).filter(t => t.length > 2);
            const hits: string[] = [];
            for (const file of grepFiles) {
              if (hits.length >= 10) break;
              try {
                const lines = fs.readFileSync(file, 'utf-8').split('\n');
                for (let i = 0; i < lines.length; i++) {
                  const lower = lines[i].toLowerCase();
                  if (terms.every(t => lower.includes(t))) {
                    const excerpt = lines.slice(Math.max(0, i - 1), Math.min(lines.length, i + 5)).join('\n');
                    hits.push(`### ${path.relative(REPO_ROOT, file)}:${i + 1}\n\`\`\`\n${excerpt}\n\`\`\``);
                    if (hits.length >= 10) break;
                  }
                }
              } catch { /* skip */ }
            }
            text = hits.length > 0
              ? `> ⚠️ Index boş — dosyalardan doğrudan arama yapıldı. \`index_codebase\` çalıştırarak daha iyi sonuç alın.\n\n${hits.join('\n\n')}`
              : `Sonuç bulunamadı. Önce \`index_codebase\` çalıştırın.`;
            break;
          }
          text = `**${results.length} sonuç** — "${args.query}"\n\n` +
            results.map((r, i) => {
              const highlight = r.highlight ? `\n> 🎯 **Eşleşen satır:** \`${r.highlight}\`` : '';
              const score = r.score.toFixed(3);
              return `### ${i + 1}. \`${r.chunk.filepath}:${r.chunk.startLine}-${r.chunk.endLine}\` (skor: ${score})${highlight}\n\`\`\`${r.chunk.language}\n${r.chunk.content.slice(0, 1000)}\n\`\`\``;
            }).join('\n\n');
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
          const filepath = args.filepath as string;
          const parts: string[] = [];

          // 1. Try to read the actual file directly (most reliable)
          const candidates = [
            filepath,
            path.join(REPO_ROOT, filepath),
            path.join(process.cwd(), filepath),
          ];
          let fileContent: string | null = null;
          let resolvedPath: string | null = null;
          for (const candidate of candidates) {
            try {
              if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
                fileContent = fs.readFileSync(candidate, 'utf-8');
                resolvedPath = candidate;
                break;
              }
            } catch { /* try next */ }
          }

          if (fileContent) {
            const lines = fileContent.split('\n');
            const ext = path.extname(resolvedPath!).slice(1) || 'text';
            // Extract structure: imports, exports, function/class names
            const structure: string[] = [];
            for (let i = 0; i < lines.length; i++) {
              const l = lines[i];
              if (/^(import|export|class|function|const|interface|type|enum)\s/.test(l.trim())) {
                structure.push(`  ${i + 1}: ${l.trim().slice(0, 100)}`);
              }
            }
            parts.push(`## 📄 ${filepath} (${lines.length} satır)\n\`\`\`${ext}\n${fileContent.slice(0, 3000)}${fileContent.length > 3000 ? '\n// ... (truncated)' : ''}\n\`\`\``);
            if (structure.length > 0) {
              parts.push(`### Yapı (import/export/class/function)\n\`\`\`\n${structure.slice(0, 30).join('\n')}\n\`\`\``);
            }
          }

          // 2. Supplement with memory index (additional cross-reference context)
          try {
            const memResults = await mem.search(filepath, { k: 5, mode: 'bm25' });
            if (memResults.length > 0 && !fileContent) {
              parts.push(`### Index'ten bağlam (dosya okunamadı — index kullanılıyor)\n` +
                memResults.map(r => `Lines ${r.chunk.startLine}-${r.chunk.endLine}:\n\`\`\`${r.chunk.language}\n${r.chunk.content.slice(0, 800)}\n\`\`\``).join('\n\n'));
            } else if (memResults.length > 0) {
              // Show indexed symbols for this file as quick reference
              const symbols = [...new Set(memResults.flatMap(r => r.chunk.symbols ?? []))].slice(0, 20);
              if (symbols.length > 0) {
                parts.push(`### Index'teki semboller\n${symbols.map(s => `- \`${s}\``).join('\n')}`);
              }
            }
          } catch { /* index not ready */ }

          text = parts.join('\n\n') || `Dosya bulunamadı: ${filepath}\nÖnce \`index_codebase\` çalıştırın.`;
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

    // ── Enhanced Memory tools ─────────────────────────────────────────────────
    else if (['timeline_add', 'timeline_search', 'timeline_recent', 'file_note_add', 'file_note_get', 'file_note_search', 'fact_add', 'fact_search', 'fact_list', 'memory_system_stats'].includes(name)) {
      const tool = memoryTools.find(t => t.name === name);
      if (!tool) throw new Error(`Memory tool not found: ${name}`);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await tool.handler(args as any, AUDIT_DATA_DIR);
      text = result.content[0].text;
    }

    // ── Audit tools ───────────────────────────────────────────────────────────
    else if (name === 'audit_file') {
      const result = auditFile(args.filepath as string);
      text = result.markdown;
      text += `\n\n---\n> 💾 Detaylı rapor için: \`generate_report filepath="${args.filepath as string}" save=true\``;
    }
    else if (name === 'audit_diff') {
      text = await gitTools.handleTool('git_diff_audit', args);
    }
    else if (name === 'security_scan') {
      const { scanSecurity } = await import('./lib/audit/security.js');
      const target = args.path as string;
      const files = collectFiles(target, ['.ts', '.js', '.tsx', '.jsx', '.py', '.php', '.rb', '.go', '.java', '.cs']);
      const allIssues = files.flatMap(f => {
        try { return scanSecurity(f, fs.readFileSync(f, 'utf-8')); } catch { return []; }
      });
      text = `## Security Scan: ${target}\n\n**Files scanned:** ${files.length} | **Issues:** ${allIssues.length}\n\n` +
        (allIssues.length === 0 ? '✅ No issues found.' :
          allIssues.map(i => `- [${i.severity.toUpperCase()}] **${i.title}** \`${path.relative(process.cwd(), i.filepath)}:${i.line}\``).join('\n'));
      text += `\n\n---\n> 💾 Detaylı rapor için: \`generate_report save=true\``;
    }
    else if (name === 'find_secrets') {
      const target = args.path as string;
      const files = collectFiles(target, ['.ts', '.js', '.tsx', '.jsx', '.py', '.env', '.json', '.yaml', '.yml', '.rb', '.go', '.java', '.cs', '.php', '.sh']);
      const allSecrets = files.flatMap(f => {
        try { return scanSecrets(f, fs.readFileSync(f, 'utf-8')); } catch { return []; }
      });
      text = allSecrets.length === 0
        ? `✅ No secrets found in ${target} (${files.length} files scanned)`
        : `## Secrets Found (${allSecrets.length}) in ${files.length} files\n\n` +
          allSecrets.map(s => `- **${s.type}** \`${path.relative(process.cwd(), s.filepath)}:${s.line}\` → \`${s.value}\``).join('\n');
    }
    else if (name === 'find_todos') {
      const target = args.path as string;
      const files = collectFiles(target, ['.ts', '.js', '.tsx', '.jsx', '.py', '.go', '.java', '.cs', '.rb', '.php', '.rs', '.swift', '.kt']);
      const allTodos = files.flatMap(f => {
        try {
          return scanTodos(f, fs.readFileSync(f, 'utf-8')).map(t => ({ ...t, filepath: f }));
        } catch { return []; }
      });
      text = allTodos.length === 0
        ? `✅ No TODO/FIXME comments found in ${target} (${files.length} files scanned)`
        : `## TODOs (${allTodos.length}) across ${files.length} files\n\n` +
          allTodos.map(t => `- **[${t.type}]** \`${path.relative(process.cwd(), (t as any).filepath)}:${t.line}\` — ${t.text}`).join('\n');
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
      text += `\n\n> Detaylı rapor için \`generate_report save=true\` çağırın`;
    }

    // ── Skills tools ──────────────────────────────────────────────────────────
    else if (['list_skills', 'run_skill', 'install_skill', 'remove_skill', 'skill_info', 'create_skill'].includes(name)) {
      text = await skillsManager.handleTool(name, args);
      if (name === 'run_skill') {
        const skillName = args.skill as string;
        const depth = args.depth as string | undefined;
        const save = args.save === true || args.save === 'true';
        if (save) {
          const reportName = `skill_${skillName}`;
          const savedPath = saveReport(text, AUDIT_DATA_DIR, reportName);
          text = `✅ Rapor kaydedildi: \`${savedPath}\`\n\n${text}`;
        } else {
          const targetHint = (args.filepath as string) ?? (args.path as string) ?? '';
          const depthHint = depth === 'deep' ? ' depth="deep"' : '';
          text += `\n\n---\n> 💾 Detaylı rapor için: \`run_skill skill="${skillName}"${targetHint ? ` path="${targetHint}"` : ''}${depthHint} save=true\``;
        }
      }
    }

    // ── Git tools ─────────────────────────────────────────────────────────────
    else if (['git_diff_audit', 'git_blame_context', 'pre_commit_check', 'commit_history_search', 'install_hooks'].includes(name)) {
      text = await gitTools.handleTool(name, args);
    }

    // ── Report tools ──────────────────────────────────────────────────────────
    else if (['generate_report', 'export_report', 'compare_reports'].includes(name)) {
      if (name === 'generate_report') {
        const save = args.save === true || args.save === 'true';
        const depth = (args.depth as string) ?? 'shallow';
        // Get the base report content from reportTools
        const baseReport = await reportTools.handleTool('generate_report', args);
        if (save) {
          const reportContent = buildReport({
            title: 'Code Audit Report',
            metadata: {
              Depth: depth,
              'Repo Root': REPO_ROOT,
            },
            sections: [
              {
                heading: 'Audit Results',
                content: baseReport,
                level: 2,
              },
            ],
          });
          const savedPath = saveReport(reportContent, AUDIT_DATA_DIR, 'audit');
          text = `✅ Rapor kaydedildi: \`${savedPath}\`\n\n${reportContent}`;
        } else {
          text = baseReport;
          text += `\n\n---\n> 💾 Raporu kaydetmek için: \`generate_report save=true\``;
        }
      } else {
        text = await reportTools.handleTool(name, args);
      }
    }

    // ── Context tools ─────────────────────────────────────────────────────────
    else if (name === 'find_references') {
      const symbol = args.symbol as string;
      const searchRoot = (args.path as string) ?? REPO_ROOT;
      const findings: Array<{ file: string; line: number; content: string; context: string }> = [];

      // 1. Grep actual files (primary — always works, no index needed)
      const srcFiles = collectFiles(searchRoot, ['.ts','.tsx','.js','.jsx','.py','.go','.java','.cs','.rb','.php','.rs','.swift','.kt']);
      const symEscaped = symbol.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const symRegex = new RegExp(`\\b${symEscaped}\\b`);

      for (const file of srcFiles) {
        if (findings.length >= 30) break;
        try {
          const lines = fs.readFileSync(file, 'utf-8').split('\n');
          for (let i = 0; i < lines.length; i++) {
            if (symRegex.test(lines[i])) {
              const ctx = lines.slice(Math.max(0, i - 1), Math.min(lines.length, i + 3)).join('\n');
              findings.push({
                file: path.relative(REPO_ROOT, file),
                line: i + 1,
                content: lines[i].trim().slice(0, 120),
                context: ctx,
              });
              if (findings.length >= 30) break;
            }
          }
        } catch { /* skip */ }
      }

      // 2. Supplement with memory search for broader semantic coverage
      try {
        const mem = await getMemory();
        const memResults = await mem.search(symbol, { k: 10, mode: 'bm25' });
        for (const r of memResults) {
          const relPath = path.relative(REPO_ROOT, r.chunk.filepath);
          // Only add if not already found by direct grep
          if (!findings.some(f => f.file === relPath && Math.abs(f.line - r.chunk.startLine) < 5)) {
            findings.push({
              file: relPath,
              line: r.chunk.startLine,
              content: r.chunk.content.slice(0, 120).replace(/\n/g, ' '),
              context: r.chunk.content.slice(0, 300),
            });
          }
        }
      } catch { /* index not ready */ }

      if (findings.length === 0) {
        text = `"${symbol}" için referans bulunamadı (${srcFiles.length} dosya tarandı).`;
      } else {
        // Group by file
        const byFile = new Map<string, typeof findings>();
        for (const f of findings) {
          if (!byFile.has(f.file)) byFile.set(f.file, []);
          byFile.get(f.file)!.push(f);
        }
        text = `## Referanslar: \`${symbol}\`\n\n**${findings.length} kullanım** — ${byFile.size} dosyada\n\n`;
        for (const [file, refs] of byFile) {
          text += `### \`${file}\` (${refs.length} kullanım)\n`;
          for (const r of refs) {
            text += `\`\`\`\n:${r.line}: ${r.content}\n\`\`\`\n`;
          }
          text += '\n';
        }
      }
    }
    else if (name === 'get_dependencies') {
      const filepath = args.filepath as string;
      const candidates = [filepath, path.join(REPO_ROOT, filepath)];
      let resolved: string | null = null;
      for (const c of candidates) {
        if (fs.existsSync(c) && fs.statSync(c).isFile()) { resolved = c; break; }
      }
      if (!resolved) throw new Error(`Dosya bulunamadı: ${filepath}`);

      const content = fs.readFileSync(resolved, 'utf-8');
      const lines = content.split('\n');

      // Parse full import statements (named, default, namespace, side-effect)
      const importDetails: Array<{ what: string; from: string; isLocal: boolean; line: number }> = [];
      for (let i = 0; i < lines.length; i++) {
        const m = lines[i].match(/^import\s*((?:\{[^}]*\}|\w+|\*\s+as\s+\w+|type\s+\{[^}]*\})?)\s*(?:,\s*(?:\{[^}]*\}|\w+))?\s*from\s+['"]([^'"]+)['"]/);
        if (m) {
          importDetails.push({ what: m[1].trim() || '(side-effect)', from: m[2], isLocal: m[2].startsWith('.'), line: i + 1 });
        }
      }

      // Show exported symbols from this file
      const exports: string[] = [];
      for (const l of lines) {
        const em = l.match(/^export\s+(?:default\s+)?(?:(?:async\s+)?function|class|const|let|var|type|interface|enum)\s+(\w+)/);
        if (em) exports.push(em[1]);
      }

      const relPath = path.relative(REPO_ROOT, resolved);
      text = `## Bağımlılıklar: \`${relPath}\`\n\n`;
      text += `**Import:** ${importDetails.length} | **Export:** ${exports.length} sembol\n\n`;

      if (importDetails.length > 0) {
        const local = importDetails.filter(i => i.isLocal);
        const external = importDetails.filter(i => !i.isLocal);

        if (local.length > 0) {
          text += `### Yerel Import'lar (${local.length})\n\n`;
          text += `| Satır | Nereden | Ne İmport Ediliyor |\n|-------|---------|-------------------|\n`;
          for (const i of local) {
            text += `| ${i.line} | \`${i.from}\` | \`${i.what.slice(0, 60)}\` |\n`;
          }
          text += '\n';
        }

        if (external.length > 0) {
          text += `### Dış Paket Import'ları (${external.length})\n\n`;
          text += external.map(i => `- \`${i.from}\` → \`${i.what.slice(0, 60)}\``).join('\n');
          text += '\n\n';
        }
      }

      if (exports.length > 0) {
        text += `### Bu Dosyanın Export'ları (${exports.length})\n\n`;
        text += exports.map(e => `- \`${e}\``).join('\n');
      }
    }

    // ── Orchestrator tools ────────────────────────────────────────────────────
    else if ((ORCHESTRATOR_TOOL_NAMES as readonly string[]).includes(name)) {
      text = await handleOrchestratorTool(name, args, conductor, skillRegistry, REPO_ROOT);
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
      const providedContent = args.content as string | undefined;

      switch (args.phase) {
        case 'requirements': {
          if (providedContent) {
            specEngine.writeRequirements(args.specId as string, providedContent);
            text = `✅ **requirements.md** kaydedildi\n\n📋 \`${spec.requirementsPath}\`\n\nSonraki: \`spec_generate specId="${args.specId as string}" phase="design"\``;
          } else {
            // Gather codebase context for the prompt
            let codebaseCtx = '';
            try {
              const mem = await getMemory();
              const results = await mem.search(spec.name + ' ' + spec.description, { k: 8, mode: 'hybrid' });
              if (results.length > 0) {
                codebaseCtx = results.map(r =>
                  `// ${path.relative(REPO_ROOT, r.chunk.filepath)}:${r.chunk.startLine}\n${r.chunk.content.slice(0, 250)}`
                ).join('\n\n');
              }
            } catch { /* no index — proceed without */ }
            if (!codebaseCtx) {
              const slug = spec.name.replace(/[^a-z0-9]/gi, '-').toLowerCase();
              const relFiles = collectFiles(REPO_ROOT, ['.ts', '.tsx', '.js', '.jsx'])
                .filter(f => f.toLowerCase().includes(slug.slice(0, 8))).slice(0, 4);
              if (relFiles.length > 0) {
                codebaseCtx = relFiles.map(f => {
                  try { return `// ${path.relative(REPO_ROOT, f)}\n${fs.readFileSync(f, 'utf-8').slice(0, 300)}`; }
                  catch { return ''; }
                }).filter(Boolean).join('\n\n');
              }
            }
            const topFiles = collectFiles(REPO_ROOT, ['.ts', '.tsx']).slice(0, 20)
              .map(f => `  - ${path.relative(REPO_ROOT, f)}`).join('\n');
            text = buildRequirementsPrompt(spec.name, spec.description, args.specId as string, codebaseCtx, topFiles);
          }
          break;
        }
        case 'design': {
          if (providedContent) {
            specEngine.writeDesign(args.specId as string, providedContent);
            text = `✅ **design.md** kaydedildi\n\n🏗️ \`${spec.designPath}\`\n\nSonraki: \`spec_generate specId="${args.specId as string}" phase="tasks"\``;
          } else {
            const reqContent = fs.existsSync(spec.requirementsPath)
              ? fs.readFileSync(spec.requirementsPath, 'utf-8')
              : `**Açıklama:** ${spec.description}`;
            // Detect architectural patterns in the codebase
            const srcFiles = collectFiles(path.join(REPO_ROOT, 'src'), ['.ts', '.tsx']).slice(0, 50);
            const patterns: string[] = [];
            if (srcFiles.some(f => f.includes('repository'))) patterns.push('Repository pattern mevcut');
            if (srcFiles.some(f => f.includes('/hooks/'))) patterns.push('React hooks kullanılıyor');
            if (srcFiles.some(f => f.includes('/api/'))) patterns.push('Next.js API routes mevcut');
            if (fs.existsSync(path.join(REPO_ROOT, 'prisma', 'schema.prisma'))) patterns.push('Prisma ORM kullanılıyor');
            if (srcFiles.some(f => f.includes('middleware'))) patterns.push('Middleware katmanı mevcut');
            if (fs.existsSync(path.join(REPO_ROOT, 'drizzle.config.ts')) || fs.existsSync(path.join(REPO_ROOT, 'drizzle.config.js'))) patterns.push('Drizzle ORM kullanılıyor');
            const archContext = patterns.join(', ');
            text = buildDesignPrompt(spec.name, args.specId as string, reqContent, spec.designPath, archContext);
          }
          break;
        }
        case 'tasks': {
          if (providedContent) {
            specEngine.writeTasks(args.specId as string, providedContent);
            text = `✅ **tasks.md** kaydedildi\n\n📝 \`${spec.tasksPath}\`\n\nSonraki: \`task_next\` ile göreve başla`;
          } else {
            const reqContent = fs.existsSync(spec.requirementsPath)
              ? fs.readFileSync(spec.requirementsPath, 'utf-8').slice(0, 2000)
              : spec.description;
            const designContent = fs.existsSync(spec.designPath)
              ? fs.readFileSync(spec.designPath, 'utf-8').slice(0, 2000)
              : '';
            text = buildTasksPrompt(spec.name, args.specId as string, reqContent, designContent, spec.tasksPath);
          }
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

    else if (name === 'task_board') {
      const allTasks = taskStore.list();
      const groups: Record<string, typeof allTasks> = {
        'in-progress': [],
        pending: [],
        done: [],
        blocked: [],
        cancelled: [],
      };
      for (const t of allTasks) {
        (groups[t.status] ?? groups['pending']).push(t);
      }

      // Sort pending by priority
      const prioOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
      groups['pending'].sort((a, b) => (prioOrder[a.priority] ?? 2) - (prioOrder[b.priority] ?? 2));

      const active = allTasks.filter(t => t.status !== 'cancelled');
      const doneCount = groups['done'].length;
      const total = active.length;
      const pct = total > 0 ? Math.round((doneCount / total) * 100) : 0;
      const filled = Math.round(pct / 10);
      const bar = '█'.repeat(filled) + '░'.repeat(10 - filled);

      const fmtTask = (t: (typeof allTasks)[number]) => {
        const loc = t.filepath ? ` — ${t.filepath}` : '';
        const mini = t.miniPrompt ? `\n  Mini-prompt: ${t.miniPrompt}` : '';
        return `- [${t.id}] **${t.title}** \`${t.category}\` \`${t.priority}\`${loc}${mini}`;
      };

      const section = (emoji: string, label: string, items: typeof allTasks) => {
        if (items.length === 0) return `## ${emoji} ${label} (0)`;
        return `## ${emoji} ${label} (${items.length})\n${items.map(fmtTask).join('\n')}`;
      };

      const nextTask = groups['in-progress'][0] ?? groups['pending'][0];
      const nextHint = nextTask
        ? `\`task_update id="${nextTask.id}" status="done"\` to complete current task`
        : 'All tasks complete!';

      text = [
        '# Task Board',
        '',
        `## Progress: ${doneCount}/${total} (${pct}%) ${bar}`,
        '',
        section('🔄', 'In Progress', groups['in-progress']),
        '',
        section('⏳', 'Pending', groups['pending']) + (groups['pending'].length > 0 ? ' — sorted by priority' : ''),
        '',
        section('✅', 'Done', groups['done']),
        '',
        section('🚫', 'Blocked', groups['blocked']),
        '',
        section('❌', 'Cancelled', groups['cancelled']),
        '',
        '---',
        `Next: ${nextHint}`,
      ].join('\n');
    }

    // ── Research tools ────────────────────────────────────────────────────────
    else if (name === 'research_topic') {
      const topic = args.topic as string;
      const maxSources = args.depth === 'quick' ? 5 : args.depth === 'deep' ? 30 : 15;

      // 1. Direct file search (always reliable)
      const srcFiles = collectFiles(REPO_ROOT, ['.ts','.tsx','.js','.jsx','.py','.go','.java','.cs','.md']);
      const terms = topic.toLowerCase().split(/\s+/).filter(t => t.length > 2);
      const directHits: Array<{ file: string; line: number; excerpt: string; score: number }> = [];

      for (const file of srcFiles) {
        if (directHits.length >= maxSources) break;
        try {
          const lines = fs.readFileSync(file, 'utf-8').split('\n');
          for (let i = 0; i < lines.length; i++) {
            const lower = lines[i].toLowerCase();
            const matchCount = terms.filter(t => lower.includes(t)).length;
            if (matchCount >= Math.min(2, terms.length)) {
              const excerpt = lines.slice(Math.max(0, i - 1), Math.min(lines.length, i + 6)).join('\n');
              directHits.push({
                file: path.relative(REPO_ROOT, file),
                line: i + 1,
                excerpt,
                score: matchCount / terms.length,
              });
              if (directHits.length >= maxSources) break;
            }
          }
        } catch { /* skip */ }
      }

      // 2. Memory search for semantic coverage
      const memHits: Array<{ file: string; line: number; excerpt: string; score: number }> = [];
      try {
        const eng = await getResearchEngine();
        const result = await eng.research(topic, { maxSources });
        for (const f of result.findings.slice(0, 8)) {
          const relPath = path.relative(REPO_ROOT, f.source.filepath ?? '');
          if (!directHits.some(h => h.file === relPath)) {
            memHits.push({
              file: relPath,
              line: 0,
              excerpt: f.evidence.slice(0, 400),
              score: f.confidence,
            });
          }
        }
      } catch { /* index empty */ }

      const allHits = [...directHits, ...memHits].sort((a, b) => b.score - a.score).slice(0, maxSources);

      if (allHits.length === 0) {
        text = `## Araştırma: ${topic}\n\n"${topic}" konusunda ilgili kod bulunamadı.\n\nÖneri: \`index_codebase\` çalıştırın ve daha spesifik terimler deneyin.`;
      } else {
        text = `## Araştırma: ${topic}\n\n**${allHits.length} ilgili bulgu** — doğrudan dosya taraması + index\n\n`;
        for (let i = 0; i < allHits.length; i++) {
          const h = allHits[i];
          const loc = h.line > 0 ? `:${h.line}` : '';
          text += `### ${i + 1}. \`${h.file}${loc}\`\n\`\`\`\n${h.excerpt.slice(0, 500)}\n\`\`\`\n\n`;
        }
      }
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

    // ── Graph tools ───────────────────────────────────────────────────────────
    else if (['graph_build', 'impact', 'graph_context', 'graph_stats', 'graph_query'].includes(name)) {
      text = await graphTools.handleTool(name, args);
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

// ─── Spec prompt builders (LLM generates content, MCP saves it) ───────────────

function buildRequirementsPrompt(
  name: string,
  description: string,
  specId: string,
  codebaseCtx: string,
  repoFiles: string,
): string {
  // Extract search keywords from name and description
  const keywords = [name, ...description.split(/\s+/).filter(w => w.length > 4)].slice(0, 5);
  const searchTerms = keywords.map(k => `\`search_code("${k}")\``).join(', ');

  return `# SPEC REQUIREMENTS PHASE — "${name}"

> Spec ID: \`${specId}\`
> Description: ${description}

---

## ⚠️ MANDATORY: RESEARCH BEFORE WRITING

**You MUST call the following tools BEFORE writing a single word of requirements.md.**
Do NOT skip this phase. Do NOT write requirements based on assumptions.

### Step 1 — Search for existing related code

Call these tools NOW, in sequence:

1. \`search_code("${name}")\` — find files related to this feature by name
2. \`search_code("${keywords[0]}")\` — find usages of the core concept
${keywords[1] ? `3. \`search_code("${keywords[1]}")\` — find related patterns` : ''}
${keywords[2] ? `4. \`search_code("${keywords[2]}")\` — find adjacent functionality` : ''}

### Step 2 — Read the most relevant files

After search results come back:
- Call \`get_context(filepath="<most relevant file from results>")\` for the TOP 2-3 most relevant files
- If you find an existing similar feature, read its implementation file fully

### Step 3 — Check what already exists

- Call \`find_references("${name.split(/[-_\s]/)[0]}")\` — see where the core entity is referenced
- Look for: existing types, existing routes/handlers, existing DB schema, existing components

### Step 4 — Synthesize findings (REQUIRED before writing)

Before writing requirements, explicitly state in your response:
- "I found these related files: ..."
- "The existing codebase already has: ..."
- "These patterns are used: ..."
- "This feature will need to integrate with: ..."

Only AFTER completing Steps 1-4, proceed to writing.

---
${codebaseCtx ? `\n## Initial Context (pre-fetched by MCP)\n\`\`\`\n${codebaseCtx.slice(0, 1500)}\n\`\`\`\n` : ''}
${repoFiles ? `\n## Repository Files (start your research here)\n${repoFiles}\n` : ''}

---

## Writing Requirements

After your research, write \`requirements.md\` using ONLY information grounded in:
1. What you found in the codebase
2. The feature description above
3. Reasonable inference clearly marked as such

**Format:**

\`\`\`markdown
# Requirements Document

## Introduction

[3-5 sentences grounded in reality. Reference ACTUAL files/patterns you found.
E.g.: "This feature extends the existing UserRepository at src/lib/user/repository.ts..."
NOT generic filler. If you didn't find related code, say that explicitly.]

## Requirements

### Requirement 1: [Title derived from the description — not generic]

**User Story:** As a [specific role found or inferred from context], I want [specific capability from description], so that [concrete benefit].

#### Acceptance Criteria

1. WHEN [specific event matching this codebase's patterns] THEN the system SHALL [measurable response]
2. WHEN [event] AND [precondition] THEN the system SHALL [response]
3. IF [error condition specific to this feature] THEN the system SHALL [specific error handling]
4. WHEN [edge case] THEN the system SHALL [graceful behavior]

### Requirement 2: [Next functional area]

**User Story:** As a [role], I want [capability], so that [benefit].

#### Acceptance Criteria

1. WHEN [event] THEN the system SHALL [response]
2. IF [precondition] THEN the system SHALL [response]
3. WHEN [failure scenario] THEN the system SHALL [error response]

[Add Requirement 3, 4, etc. for each distinct functional concern — min 3, max 8]
\`\`\`

---

## Rules

1. **EARS format only**: \`WHEN/THEN SHALL\`, \`IF/THEN SHALL\`, \`WHILE/SHALL\` — no "Given/When/Then"
2. **No placeholders** — if you don't know, say "TBD: [reason]", not "[something]"
3. **Grounded in research** — reference actual files/patterns you found in Steps 1-4
4. **Language**: match the description language (Turkish → Turkish, English → English)
5. **Min 3 requirements, each with min 3 acceptance criteria**
6. **Cover errors**: every happy path needs at least one failure/edge-case criterion

---

## ✅ Save When Done

After completing research AND writing, call:
\`\`\`
spec_generate specId="${specId}" phase="requirements" content="<your complete markdown>"
\`\`\`

**Then immediately call \`spec_generate specId="${specId}" phase="design"\` to get the design prompt.**`;
}

function buildDesignPrompt(
  name: string,
  specId: string,
  requirementsContent: string,
  _designPath: string,
  archContext: string,
): string {
  return `# SPEC DESIGN PHASE — "${name}"

> Spec ID: \`${specId}\`

---

## ⚠️ MANDATORY: DEEP CODEBASE RESEARCH BEFORE DESIGNING

You MUST investigate the actual codebase architecture before writing design.md.
Do NOT design based on assumptions. Every component path must be real.

### Step 1 — Understand existing architecture

Call these tools NOW:

1. \`get_context(filepath="src")\` or \`search_code("repository")\` — find the architectural pattern (repository? service layer? server actions? tRPC?)
2. \`search_code("interface")\` — find how TypeScript types/interfaces are defined in this codebase
3. \`search_code("api")\` or \`search_code("route")\` — find how API endpoints/routes are structured

### Step 2 — Find similar existing features

Call these tools:
1. Look at the requirements below — find the core entity name. Call \`search_code("<entity>")\`
2. Call \`get_context(filepath="<most-similar-existing-feature-file>")\` — read a similar feature's implementation
3. Check: Does this project use Prisma? Drizzle? Raw SQL? Call \`search_code("schema")\` to verify

### Step 3 — Map the real file structure

Before writing the Components table, call:
1. \`find_references("<CoreEntityName>")\` — see where similar entities are imported/used
2. Look at how existing similar features are organized (what folders, what file naming convention)

### Step 4 — State your findings

Before writing design.md, explicitly say:
- "This codebase uses [pattern] architecture"
- "Existing similar feature: [file path]"
- "ORM/DB: [Prisma/Drizzle/other]"
- "API pattern: [Next.js routes/tRPC/Express/etc]"
- "Auth: [how it's done]"

---

## Approved Requirements

\`\`\`markdown
${requirementsContent.slice(0, 2500)}
\`\`\`
${archContext ? `\n## MCP-Detected Patterns\n${archContext}\n(Verify these with your own research above)\n` : ''}

---

## Writing the Design

After research, write \`design.md\` using ONLY real file paths and patterns you verified:

\`\`\`markdown
# Design Document: ${name}

> Spec ID: ${specId}

## Overview

[3-5 sentences. What approach? Why? What are the key decisions?
Reference ACTUAL patterns you found: "Following the same Repository + Service pattern as src/lib/[existing]..."]

## Architecture

\`\`\`mermaid
graph TD
    [Real component names you found] --> [Real service names]
    [Service] --> [(Real DB/ORM)]
\`\`\`

**Pattern:** [The ACTUAL pattern used in this codebase — from your research]
**Layers:** [Actual layer names matching existing code]

Architectural decisions:
- [Decision] — chosen because [found evidence in codebase]
- [Decision] — rationale based on [existing pattern at file X]

## Components and Interfaces

| File Path | Component | Responsibility | Interface |
|-----------|-----------|----------------|-----------|
| \`[REAL path matching codebase conventions]\` | [Component] | [What it does] | [Interface name] |
[Every path must follow the naming convention you found in your research. Min 3 rows.]

## Data Models

\`\`\`typescript
// Matching the type convention at [actual file you found]
interface ${name.replace(/[-\s]/g, '')} {
  id: string; // or number — match what the ORM uses
  // Fields derived from acceptance criteria in requirements
  createdAt: Date;
  updatedAt: Date;
}

type Create${name.replace(/[-\s]/g, '')}Input = Omit<${name.replace(/[-\s]/g, '')}, 'id' | 'createdAt' | 'updatedAt'>;
type Update${name.replace(/[-\s]/g, '')}Input = Partial<Create${name.replace(/[-\s]/g, '')}Input>;
\`\`\`

## Error Handling

| Scenario | Error Type | HTTP Status | Message | Recovery |
|----------|-----------|-------------|---------|----------|
| Validation failure | \`ValidationError\` | 400 | Field-specific errors | Fix and retry |
| Not found | \`NotFoundError\` | 404 | "Not found" | Empty state |
| Unauthorized | \`AuthError\` | 401 | "Auth required" | Redirect login |
| Forbidden | \`PermissionError\` | 403 | "Insufficient permissions" | Show error |
| Server error | \`InternalError\` | 500 | "Something went wrong" | Retry |

## Testing Strategy

### Unit Tests
- \`[Real path].test.ts\` — [what is tested]

### Integration Tests
- \`[Real path].test.ts\` — full request/response cycle

### Test Cases
1. Happy path for each operation
2. Validation failures (per acceptance criteria)
3. Auth enforcement
4. Error propagation

## Open Questions

- [Unresolved decision or blocker — or "None" if none]
\`\`\`

---

## Rules

1. **Real file paths only** — match naming conventions you found in Step 2-3
2. **No generic placeholders** — every component row needs a real path
3. **Mermaid diagram is required** if more than 2 components interact
4. **Decisions cite evidence** — "chosen because [found at file X]"
5. **Language**: match the requirements document language

---

## ✅ Save When Done

\`\`\`
spec_generate specId="${specId}" phase="design" content="<your complete markdown>"
\`\`\`

**Then immediately call \`spec_generate specId="${specId}" phase="tasks"\` to get the tasks prompt.**`;
}

function buildTasksPrompt(
  name: string,
  specId: string,
  requirementsContent: string,
  designContent: string,
  _tasksPath: string,
): string {
  return `# SPEC TASKS PHASE — "${name}"

> Spec ID: \`${specId}\`

---

## ⚠️ MANDATORY: VERIFY IMPLEMENTATION PATTERNS BEFORE WRITING

You are about to write an implementation plan. Every task must reference REAL files.
Do NOT invent file paths. Research first.

### Step 1 — Verify file paths from design.md

The design listed component file paths. Verify they follow actual codebase conventions:
1. \`search_code("test")\` or \`search_code(".test.ts")\` — find how tests are organized in this project
2. \`get_context(filepath="<first component path from design>")\` — does this pattern exist?
3. Look for: existing test files, existing similar feature tests

### Step 2 — Find testing patterns

1. Call \`search_code("describe")\` or \`search_code("it(")\` — find test style (jest/vitest/etc.)
2. Note the test file naming: \`*.test.ts\`? \`*.spec.ts\`? Adjacent or in \`__tests__\`?

### Step 3 — Check build/run commands

1. Does this codebase have a \`package.json\` test script? What is it?
2. Note this for "Verify" sections in tasks

---

## Approved Requirements

\`\`\`markdown
${requirementsContent.slice(0, 1200)}
\`\`\`

## Approved Design

\`\`\`markdown
${designContent.slice(0, 1400)}
\`\`\`

---

## Writing the Implementation Plan

Write tasks as **prompts for a code-generation agent** that will implement each step.
Each task = one complete coding concern. TDD order: types → data layer → business logic → API → UI → wire-up.

\`\`\`markdown
# Implementation Plan: ${name}

> Spec ID: ${specId}

---

- [ ] 1. Set up types and contracts
  - Create \`[path from design]/types.ts\` with all TypeScript interfaces from design.md
  - Export: main entity type, Create/Update input types, response shape
  - No implementation — types only
  - _Requirements: 1.1, 1.2_

- [ ] 2. Implement data layer
  - [ ] 2.1 Create repository
    - Implement \`[path from design]/repository.ts\` with CRUD methods
    - Use [ORM from design] — match pattern of \`[existing similar repo file]\`
    - Write unit tests in \`[test path]\` covering: create, findById, findAll, update, delete, not-found
    - _Requirements: [specific IDs]_

  - [ ] 2.2 Add validation
    - Add input validation using [validation library found in codebase]
    - Cover: required fields, format rules, boundary values from acceptance criteria
    - Unit test: valid inputs pass, invalid inputs throw with correct message
    - _Requirements: [specific IDs]_

- [ ] 3. Business logic
  - [ ] 3.1 Service layer
    - Implement \`[path from design]/service.ts\` — orchestrates repository + validation
    - Business rules: [specific rules from requirements acceptance criteria]
    - Error mapping: ValidationError → 400, NotFoundError → 404, etc.
    - Unit tests mocking repository — test each business rule
    - _Requirements: [specific IDs]_

  - [ ] 3.2 Auth integration
    - Wire auth check matching \`[existing auth pattern found in research]\`
    - Test: authenticated user succeeds, unauthenticated gets 401
    - _Requirements: [specific IDs]_

- [ ] 4. API/interface layer
  - [ ] 4.1 Create route handler
    - Implement \`[path from design]/route.ts\` (or equivalent)
    - Parse body → validate → call service → shape response matching existing API format
    - _Requirements: [specific IDs]_

  - [ ] 4.2 Integration tests
    - Test full request → response cycle with test DB/mocks
    - Cover: 200 success, 400 validation, 404 not-found, 401 auth
    - _Requirements: [all relevant]_

- [ ] 5. UI layer (if required by design)
  - [ ] 5.1 Data hook
    - \`[path from design]/use-[name].ts\` — loading/error/data states
    - _Requirements: [specific IDs]_

  - [ ] 5.2 Form/display component
    - Implement with real data (no mocks), validation feedback
    - _Requirements: [specific IDs]_

- [ ] 6. End-to-end integration
  - Connect all layers: UI → hook → API → service → repository
  - Verify all acceptance criteria from requirements.md are covered by at least one test
  - _Requirements: all_
\`\`\`

---

## Task Writing Rules

1. **Checkbox format**: every item is \`- [ ] N.\` or \`- [ ] N.M\`
2. **Real file paths**: every path must come from design.md or your research
3. **TDD order**: types → data → business logic → API → UI → wiring
4. **Each task references requirements**: \`_Requirements: X.X, Y.Y_\`
5. **Tests are in the same task** as the code they test — not a separate step
6. **No orphaned code** — everything created must be consumed by the final task
7. **No non-coding tasks** (no deployment, no user testing, no docs)
8. **Max 2 levels** of hierarchy

---

## ✅ Save When Done

\`\`\`
spec_generate specId="${specId}" phase="tasks" content="<your complete markdown>"
\`\`\`

After saving, call \`task_next\` to begin implementation.`;
}

function _DELETED_buildDesignPrompt_OLD(
  name: string,
  specId: string,
  requirementsContent: string,
  _designPath: string,
  archContext: string,
): string {
  return `# Feature Spec — Design Phase

You are a senior software architect. The requirements have been approved. Now write a comprehensive technical design document.

## Approved Requirements

\`\`\`markdown
${requirementsContent.slice(0, 2500)}
\`\`\`
${archContext ? `\n## Detected Codebase Patterns\n${archContext}\nAlign your design with these existing patterns.\n` : ''}

---

## Your Task

Before writing, mentally research and consider:
- How does this feature fit into the existing architecture?
- What existing code/patterns can be reused vs. what must be created?
- What are the data flow and state management implications?
- What are the failure modes and how will they be handled?
- What is the minimum surface area to implement this correctly?

Then write the complete \`design.md\` document.

---

## Required Format

\`\`\`markdown
# Design Document: ${name}

> Spec ID: ${specId}

## Overview

[3-5 sentences. What is the high-level approach? Why this architecture? What are the key design decisions?
Summarize the chosen pattern and explain why it fits this feature better than alternatives.]

## Architecture

[Describe the overall architecture. Include a Mermaid diagram if the data flow is non-trivial.]

\`\`\`mermaid
graph TD
    A[Component A] --> B[Service B]
    B --> C[(Database)]
    B --> D[Component D]
\`\`\`

**Pattern:** [e.g., Repository + Service + API Route / React Component + Hook + Server Action / etc.]
**Layers:** [e.g., Types → Repository → Service → Controller → Client]

Key architectural decisions:
- [Decision and why it was chosen over alternatives]
- [Decision and rationale]

## Components and Interfaces

| File Path | Component | Responsibility | Interface |
|-----------|-----------|----------------|-----------|
| \`src/types/feature.ts\` | Feature Types | All TypeScript interfaces and enums | Exported types |
| \`src/lib/feature/repository.ts\` | Feature Repository | Database CRUD, query building | \`FeatureRepository\` interface |
| \`src/lib/feature/service.ts\` | Feature Service | Business logic, validation, orchestration | \`FeatureService\` interface |
| \`src/app/api/feature/route.ts\` | API Handler | HTTP parsing, auth check, response shaping | Next.js Route Handler |
[Use REAL file paths matching the actual codebase structure. Min 3, max 10 components.]

## Data Models

\`\`\`typescript
// Core entity — all fields derived from requirements
interface FeatureName {
  id: string;
  // --- business fields (feature-specific, not generic) ---
  // derived from requirements acceptance criteria
  createdAt: Date;
  updatedAt: Date;
}

// Input DTOs
type CreateFeatureNameInput = Omit<FeatureName, 'id' | 'createdAt' | 'updatedAt'>;
type UpdateFeatureNameInput = Partial<CreateFeatureNameInput>;

// API response shape (may differ from DB model)
type FeatureNameResponse = FeatureName & {
  // any computed/joined fields
};
\`\`\`

[Add more interfaces for related entities, enums for status fields, etc.]

## Error Handling

Define how every failure mode is handled:

| Scenario | Error Type | HTTP Status | User-Facing Message | Recovery |
|----------|-----------|-------------|---------------------|----------|
| Validation failure | \`ValidationError\` | 400 | Field-specific error messages | Fix input and retry |
| Not found | \`NotFoundError\` | 404 | "Resource not found" | Redirect or show empty state |
| Unauthorized | \`AuthError\` | 401 | "Authentication required" | Redirect to login |
| Forbidden | \`PermissionError\` | 403 | "Insufficient permissions" | Show permission error |
| Conflict | \`ConflictError\` | 409 | Specific conflict description | Resolve conflict |
| Server error | \`InternalError\` | 500 | Generic "Something went wrong" | Retry or contact support |

Error propagation strategy: [describe how errors bubble up from repository → service → handler]

## Testing Strategy

### Unit Tests
- \`src/lib/feature/service.test.ts\` — business logic, validation rules, edge cases
- \`src/lib/feature/repository.test.ts\` — DB query correctness (mock DB or test DB)

### Integration Tests
- \`src/app/api/feature/route.test.ts\` — full request/response cycle with test DB

### Test Cases to Cover
1. Happy path for each CRUD operation
2. Validation failures (missing fields, invalid formats, boundary values)
3. Auth/permission enforcement
4. Concurrent operations / race conditions (if applicable)
5. Error propagation from repository to HTTP response

**Testing approach:** [TDD / test-after / e2e only — choose one and justify]

## Open Questions

- [Unresolved technical decision that blocks implementation]
- [Dependency on another team or external system]
- [Performance/scalability concern that needs measurement]
\`\`\`

---

## Writing Rules

1. **All file paths must be real** — match the actual codebase structure detected above.
2. **TypeScript interfaces must reflect requirements** — include every field mentioned in acceptance criteria.
3. **Error Handling section is mandatory** — do not omit or write "standard error handling".
4. **Testing Strategy section is mandatory** — name specific test files and test cases.
5. **Mermaid diagram** — include one if architecture has more than 2 components interacting.
6. **Design decisions must cite tradeoffs** — "we chose X over Y because Z".
7. **No placeholders** — every section must contain real, feature-specific content.

## Save Instructions

After writing the complete document, call:
\`spec_generate specId="${specId}" phase="design" content="<your full markdown here>"\`

Do not summarize or explain — write the full document and save it immediately.`;
}

function _DELETED_buildTasksPrompt_OLD(
  name: string,
  specId: string,
  requirementsContent: string,
  designContent: string,
  _tasksPath: string,
): string {
  return `# Feature Spec — Implementation Plan Phase

You are a senior software engineer converting an approved design into an actionable implementation plan for a code-generation agent.

## Approved Requirements

\`\`\`markdown
${requirementsContent.slice(0, 1400)}
\`\`\`
${designContent ? `\n## Approved Design\n\`\`\`markdown\n${designContent.slice(0, 1400)}\n\`\`\`` : ''}

---

## Your Task

Convert the feature design into a series of **prompts for a code-generation LLM** that will implement each step in a test-driven manner.

Core principle: **incremental progress with early validation**. Each task must:
- Build on the previous task's output
- Be verifiable (has a test or observable output)
- Leave no orphaned code — everything gets wired up by the end

---

## Required Format

\`\`\`markdown
# Implementation Plan: ${name}

> Spec ID: ${specId}

---

- [ ] 1. Set up types and project structure
  - Create \`src/types/feature.ts\` with all TypeScript interfaces from the design
  - Define \`FeatureName\`, \`CreateFeatureNameInput\`, \`UpdateFeatureNameInput\` interfaces
  - Export all types — no implementation yet, just contracts
  - _Requirements: 1.1, 1.2_

- [ ] 2. Implement data layer
  - [ ] 2.1 Create repository with database operations
    - Implement \`src/lib/feature/repository.ts\` with \`create\`, \`findById\`, \`findAll\`, \`update\`, \`delete\` methods
    - Use existing ORM/DB pattern from codebase (match existing repository files)
    - Write unit tests in \`src/lib/feature/repository.test.ts\` covering happy path and not-found cases
    - _Requirements: 2.1, 2.2_

  - [ ] 2.2 Add validation layer
    - Implement input validation using existing validation library (Zod/class-validator/etc.)
    - Cover all acceptance criteria constraints (required fields, format rules, length limits)
    - Write unit tests for each validation rule — valid and invalid inputs
    - _Requirements: 2.3, 3.1_

- [ ] 3. Implement business logic
  - [ ] 3.1 Create service layer
    - Implement \`src/lib/feature/service.ts\` calling repository methods
    - Add business rules: [specific rules from requirements]
    - Implement error handling per the design's error table (ValidationError, NotFoundError, etc.)
    - Write unit tests mocking the repository, covering each business rule
    - _Requirements: 3.1, 3.2, 3.3_

  - [ ] 3.2 Wire service to existing auth/permission system
    - Add permission checks matching existing auth pattern
    - Test: authorized user can proceed, unauthorized gets 401/403
    - _Requirements: 4.1_

- [ ] 4. Implement API/interface layer
  - [ ] 4.1 Create API route handler
    - Implement \`src/app/api/feature/route.ts\` (or equivalent)
    - Parse and validate request body, call service, shape response
    - Match existing API response format in the codebase
    - _Requirements: 1.1, 2.1_

  - [ ] 4.2 Integration test the full request/response cycle
    - Write integration tests hitting the actual handler with a test database
    - Cover: success case, validation error (400), not found (404), auth error (401)
    - _Requirements: 1.1, 1.2, 2.1, 3.1_

- [ ] 5. Implement UI (if applicable)
  - [ ] 5.1 Create data-fetching hook
    - Implement \`src/hooks/use-feature.ts\` with loading/error/data states
    - _Requirements: 1.1_

  - [ ] 5.2 Build form component
    - Implement form with validation feedback matching design wireframes
    - Connect to hook — no mock data
    - _Requirements: 1.2, 2.3_

- [ ] 6. End-to-end wiring and final tests
  - Connect all components: UI → hook → API → service → repository
  - Write E2E test or manual test checklist covering the primary user journey
  - Verify all acceptance criteria from requirements.md are covered by at least one test
  - _Requirements: all_
\`\`\`

---

## Task Generation Rules

1. **Checkbox format only** — every item must be \`- [ ] N.\` or \`- [ ] N.M\` (decimal sub-tasks).
2. **Each task = one coding concern** — "implement feature" is not a task. "implement repository.ts CRUD methods" is.
3. **Test-driven sequence**: for each implementation task, the test comes in the same task or immediately after.
4. **Requirements traceability**: every task ends with \`_Requirements: X.X, Y.Y_\` citing the specific criteria it satisfies.
5. **No orphaned code**: if you create a repository in task 2.1, it must be called by something before the plan ends.
6. **Incremental complexity**: no big jumps. Each task should be completable in 1-4 hours by a skilled developer.
7. **Max 2 hierarchy levels**: top-level tasks (epics) and sub-tasks only. No deeper nesting.
8. **Only coding tasks** — explicitly DO NOT include:
   - Deployment to staging/production
   - Performance metrics gathering or load testing
   - User acceptance testing or user feedback sessions
   - Documentation writing (unless it's code comments/JSDoc)
   - Business process changes

## Save Instructions

After writing the complete implementation plan, call:
\`spec_generate specId="${specId}" phase="tasks" content="<your full markdown here>"\`

Do not summarize or explain — write the full plan and save it immediately.`;
}

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

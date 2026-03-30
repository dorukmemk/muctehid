/**
 * Memory Tools — Timeline, File Notes, Important Facts, Cognitive Engine
 */

import { z } from 'zod';
import * as path from 'path';
import { MemoryManager } from '../lib/memory/memory-manager.js';
import type { TimelineSearchOptions } from '../lib/memory/timeline-memory.js';
import { GraphStore } from '../lib/graph/graph-store.js';
import { CrossProjectMemory, ContextOptimizer } from '../lib/memory/cross-project.js';

let memoryManager: MemoryManager | null = null;
let _graphStore: GraphStore | null = null;
let _repoRoot: string = process.cwd();

export function setMemoryDeps(graphStore: GraphStore | null, repoRoot: string): void {
  _graphStore = graphStore;
  _repoRoot = repoRoot;
}

function getMemoryManager(dataDir: string): MemoryManager {
  if (!memoryManager) {
    memoryManager = new MemoryManager(dataDir, _graphStore, _repoRoot);
  }
  return memoryManager;
}

// ============================================================================
// TIMELINE TOOLS
// ============================================================================

export const timelineAddTool = {
  name: 'timeline_add',
  description: 'Add an event to timeline memory. Use this after completing any significant action to build episodic memory.',
  inputSchema: z.object({
    action: z.string().describe('Brief description of the action taken'),
    context: z.string().optional().describe('Additional context about the action'),
    files: z.array(z.string()).optional().describe('Files involved in this action'),
    outcome: z.enum(['success', 'failure', 'partial']).describe('Outcome of the action'),
    tags: z.array(z.string()).optional().describe('Tags for categorization (e.g., refactor, bug-fix, feature)'),
  }),
  handler: async (args: {
    action: string;
    context?: string;
    files?: string[];
    outcome: 'success' | 'failure' | 'partial';
    tags?: string[];
  }, dataDir: string) => {
    const memory = getMemoryManager(dataDir);
    const id = await memory.timeline.add(args);
    
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({
            success: true,
            id,
            message: 'Event added to timeline',
            action: args.action,
          }, null, 2),
        },
      ],
    };
  },
};

export const timelineSearchTool = {
  name: 'timeline_search',
  description: 'Search timeline memory for past events. Use this to recall similar past actions or learn from history.',
  inputSchema: z.object({
    query: z.string().optional().describe('Search query (searches in action and context)'),
    timeRange: z.enum(['last 24h', 'last 7 days', 'last 30 days', 'all']).optional().describe('Time range filter'),
    tags: z.array(z.string()).optional().describe('Filter by tags'),
    outcome: z.enum(['success', 'failure', 'partial']).optional().describe('Filter by outcome'),
    limit: z.number().optional().describe('Maximum number of results (default: 10)'),
  }),
  handler: async (args: TimelineSearchOptions, dataDir: string) => {
    const memory = getMemoryManager(dataDir);
    const events = await memory.timeline.search(args);
    
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({
            count: events.length,
            events: events.map(e => ({
              ...e,
              timestamp: new Date(e.timestamp).toISOString(),
            })),
          }, null, 2),
        },
      ],
    };
  },
};

export const timelineRecentTool = {
  name: 'timeline_recent',
  description: 'Get recent timeline events. Use this at session start to see what was done recently.',
  inputSchema: z.object({
    limit: z.number().optional().describe('Number of recent events to retrieve (default: 10)'),
  }),
  handler: async (args: { limit?: number }, dataDir: string) => {
    const memory = getMemoryManager(dataDir);
    const events = await memory.timeline.recent(args.limit);
    
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({
            count: events.length,
            events: events.map(e => ({
              ...e,
              timestamp: new Date(e.timestamp).toISOString(),
            })),
          }, null, 2),
        },
      ],
    };
  },
};

// ============================================================================
// FILE NOTES TOOLS
// ============================================================================

export const fileNoteAddTool = {
  name: 'file_note_add',
  description: 'Add a note to a file. Use this to remember important information about files (warnings, learnings, TODOs).',
  inputSchema: z.object({
    filepath: z.string().describe('Path to the file'),
    note: z.string().describe('The note content'),
    category: z.enum(['info', 'warning', 'todo', 'learned']).describe('Note category'),
  }),
  handler: async (args: {
    filepath: string;
    note: string;
    category: 'info' | 'warning' | 'todo' | 'learned';
  }, dataDir: string) => {
    const memory = getMemoryManager(dataDir);
    const id = await memory.fileNotes.add(args);
    
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({
            success: true,
            id,
            message: 'Note added to file',
            filepath: args.filepath,
            category: args.category,
          }, null, 2),
        },
      ],
    };
  },
};

export const fileNoteGetTool = {
  name: 'file_note_get',
  description: 'Get all notes for a specific file. Use this when opening a file to see important information.',
  inputSchema: z.object({
    filepath: z.string().describe('Path to the file'),
  }),
  handler: async (args: { filepath: string }, dataDir: string) => {
    const memory = getMemoryManager(dataDir);
    const notes = memory.fileNotes.get(args.filepath);
    
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({
            filepath: args.filepath,
            count: notes.length,
            notes: notes.map(n => ({
              ...n,
              timestamp: new Date(n.timestamp).toISOString(),
            })),
          }, null, 2),
        },
      ],
    };
  },
};

export const fileNoteSearchTool = {
  name: 'file_note_search',
  description: 'Search across all file notes using semantic search. Use this to find relevant notes across the codebase.',
  inputSchema: z.object({
    query: z.string().describe('Search query'),
    limit: z.number().optional().describe('Maximum number of results (default: 10)'),
  }),
  handler: async (args: { query: string; limit?: number }, dataDir: string) => {
    const memory = getMemoryManager(dataDir);
    const notes = await memory.fileNotes.search(args.query, args.limit);
    
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({
            query: args.query,
            count: notes.length,
            notes: notes.map(n => ({
              ...n,
              timestamp: new Date(n.timestamp).toISOString(),
            })),
          }, null, 2),
        },
      ],
    };
  },
};

// ============================================================================
// IMPORTANT FACTS TOOLS
// ============================================================================

export const factAddTool = {
  name: 'fact_add',
  description: 'Add an important fact about the project. Use this for critical knowledge that should be remembered (architecture, security, business rules).',
  inputSchema: z.object({
    fact: z.string().describe('The fact to remember'),
    category: z.enum(['architecture', 'security', 'business', 'technical']).describe('Fact category'),
    importance: z.enum(['low', 'medium', 'high', 'critical']).describe('Importance level'),
  }),
  handler: async (args: {
    fact: string;
    category: 'architecture' | 'security' | 'business' | 'technical';
    importance: 'low' | 'medium' | 'high' | 'critical';
  }, dataDir: string) => {
    const memory = getMemoryManager(dataDir);
    const id = await memory.facts.add(args);
    
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({
            success: true,
            id,
            message: 'Fact added to knowledge base',
            category: args.category,
            importance: args.importance,
          }, null, 2),
        },
      ],
    };
  },
};

export const factSearchTool = {
  name: 'fact_search',
  description: 'Search important facts using semantic search. Use this to recall relevant knowledge before making decisions.',
  inputSchema: z.object({
    query: z.string().describe('Search query'),
    minImportance: z.enum(['low', 'medium', 'high', 'critical']).optional().describe('Minimum importance level'),
    limit: z.number().optional().describe('Maximum number of results (default: 10)'),
  }),
  handler: async (args: {
    query: string;
    minImportance?: 'low' | 'medium' | 'high' | 'critical';
    limit?: number;
  }, dataDir: string) => {
    const memory = getMemoryManager(dataDir);
    const facts = await memory.facts.search(args.query, {
      minImportance: args.minImportance,
      limit: args.limit,
    });
    
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({
            query: args.query,
            count: facts.length,
            facts: facts.map(f => ({
              ...f,
              timestamp: new Date(f.timestamp).toISOString(),
              lastUsed: f.lastUsed ? new Date(f.lastUsed).toISOString() : null,
            })),
          }, null, 2),
        },
      ],
    };
  },
};

export const factListTool = {
  name: 'fact_list',
  description: 'List important facts by category or importance. Use this at session start to load critical knowledge.',
  inputSchema: z.object({
    category: z.enum(['architecture', 'security', 'business', 'technical']).optional().describe('Filter by category'),
    importance: z.enum(['low', 'medium', 'high', 'critical']).optional().describe('Filter by importance'),
    limit: z.number().optional().describe('Maximum number of results (default: 20)'),
  }),
  handler: async (args: {
    category?: 'architecture' | 'security' | 'business' | 'technical';
    importance?: 'low' | 'medium' | 'high' | 'critical';
    limit?: number;
  }, dataDir: string) => {
    const memory = getMemoryManager(dataDir);
    const facts = memory.facts.list(args);
    
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({
            count: facts.length,
            facts: facts.map(f => ({
              ...f,
              timestamp: new Date(f.timestamp).toISOString(),
              lastUsed: f.lastUsed ? new Date(f.lastUsed).toISOString() : null,
            })),
          }, null, 2),
        },
      ],
    };
  },
};

// ============================================================================
// MEMORY STATS
// ============================================================================

export const memoryStatsTool = {
  name: 'memory_stats',
  description: 'Get statistics about all memory systems. Use this to understand memory usage.',
  inputSchema: z.object({}),
  handler: async (_args: Record<string, never>, dataDir: string) => {
    const memory = getMemoryManager(dataDir);
    
    const timelineStats = memory.timeline.stats();
    const fileNotesStats = memory.fileNotes.stats();
    const factsStats = memory.facts.stats();
    
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({
            timeline: timelineStats,
            fileNotes: fileNotesStats,
            facts: factsStats,
          }, null, 2),
        },
      ],
    };
  },
};

// ============================================================================
// COGNITIVE TOOLS
// ============================================================================

export const thinkTool = {
  name: 'think',
  description: 'Recall everything known about a file before working on it. Returns file notes, recent changes, graph connections, related facts. Use AUTOMATICALLY before editing any file.',
  inputSchema: z.object({
    filepath: z.string().describe('File path to recall context for'),
  }),
  handler: async (args: { filepath: string }, dataDir: string) => {
    const memory = getMemoryManager(dataDir);
    const result = await memory.cognitive.recallForFile(args.filepath);
    const parts: string[] = [];
    if (result.context) parts.push(result.context);
    if (result.warnings.length > 0) {
      parts.push('\n## ⚠️ Uyarilar');
      result.warnings.forEach((w: string) => parts.push(`- ${w}`));
    }
    if (result.suggestions.length > 0) {
      parts.push('\n## 💡 Oneriler');
      result.suggestions.forEach((s: string) => parts.push(`- ${s}`));
    }
    return { content: [{ type: 'text' as const, text: parts.join('\n') || 'Bu dosya hakkinda kayitli bilgi yok.' }] };
  },
};

export const predictChangeTool = {
  name: 'predict_change',
  description: 'Predict what will happen if you change a file. Shows affected files, risk level, warnings from past failures. Use BEFORE making any significant change.',
  inputSchema: z.object({
    filepath: z.string().describe('File to change'),
    description: z.string().describe('What change you plan to make'),
  }),
  handler: async (args: { filepath: string; description: string }, dataDir: string) => {
    const memory = getMemoryManager(dataDir);
    const impact = await memory.cognitive.predictChange(args.filepath, args.description);
    const riskEmoji = impact.riskLevel === 'critical' ? '🔴' : impact.riskLevel === 'high' ? '🟠' : impact.riskLevel === 'medium' ? '🟡' : '🟢';
    const lines: string[] = [
      `## Degisiklik Tahmini: ${args.filepath}`,
      `**Risk:** ${riskEmoji} ${impact.riskLevel.toUpperCase()}`,
      `**Etkilenen dosya:** ${impact.affectedFiles.length}`,
      `**Etkilenen sembol:** ${impact.affectedSymbols.length}`,
    ];
    if (impact.affectedFiles.length > 0) {
      lines.push('\n### Etkilenen Dosyalar');
      impact.affectedFiles.slice(0, 10).forEach((f: string) => lines.push(`- ${f}`));
    }
    if (impact.affectedSymbols.length > 0) {
      lines.push('\n### Etkilenen Semboller');
      impact.affectedSymbols.slice(0, 10).forEach((s: string) => lines.push(`- ${s}`));
    }
    if (impact.warnings.length > 0) {
      lines.push('\n### ⚠️ Uyarilar');
      impact.warnings.forEach((w: string) => lines.push(`- ${w}`));
    }
    if (impact.suggestions.length > 0) {
      lines.push('\n### 💡 Oneriler');
      impact.suggestions.forEach((s: string) => lines.push(`- ${s}`));
    }
    return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
  },
};

export const recallExperienceTool = {
  name: 'recall_experience',
  description: 'Search all memory layers for past experience related to a task. Returns similar past actions, related facts, file notes. Use before starting any task to learn from history.',
  inputSchema: z.object({
    task: z.string().describe('Description of the task or topic to recall experience for'),
  }),
  handler: async (args: { task: string }, dataDir: string) => {
    const memory = getMemoryManager(dataDir);
    const result = await memory.cognitive.recallExperience(args.task);
    return { content: [{ type: 'text' as const, text: result }] };
  },
};

export const sessionBriefingTool = {
  name: 'session_briefing',
  description: 'Get a full session briefing: top facts, recent activity, open TODOs, warnings, memory stats. Use at the START of every session.',
  inputSchema: z.object({}),
  handler: async (_args: Record<string, never>, dataDir: string) => {
    const memory = getMemoryManager(dataDir);
    const briefing = await memory.cognitive.getSessionBriefing();
    return { content: [{ type: 'text' as const, text: briefing }] };
  },
};

export const workingMemoryTool = {
  name: 'working_memory',
  description: 'Manage working memory: set active goal/task, record breadcrumbs, check for goal drift. Keeps track of what you are doing RIGHT NOW.',
  inputSchema: z.object({
    action: z.enum(['set_goal', 'set_task', 'clear_task', 'breadcrumb', 'status', 'reset']).describe('Action to perform'),
    value: z.string().optional().describe('Value for set_goal, set_task, or breadcrumb'),
    taskId: z.string().optional().describe('Task ID for set_task'),
    file: z.string().optional().describe('File for breadcrumb'),
  }),
  handler: async (args: { action: string; value?: string; taskId?: string; file?: string }, dataDir: string) => {
    const memory = getMemoryManager(dataDir);
    const wm = memory.working;
    let text = '';
    switch (args.action) {
      case 'set_goal':
        wm.setGoal(args.value ?? '');
        text = `🎯 Goal set: ${args.value}`;
        break;
      case 'set_task':
        wm.setActiveTask(args.value ?? '', args.taskId);
        text = `📋 Active task: ${args.value}`;
        break;
      case 'clear_task':
        wm.clearTask();
        text = '✅ Task cleared';
        break;
      case 'breadcrumb':
        wm.addBreadcrumb(args.value ?? '', args.file);
        text = `👣 Breadcrumb: ${args.value}`;
        break;
      case 'status':
        text = wm.getSummary();
        const drift = wm.checkDrift();
        if (drift) text += `\n\n${drift}`;
        break;
      case 'reset':
        wm.reset();
        text = '🗑️ Working memory reset';
        break;
    }
    return { content: [{ type: 'text' as const, text }] };
  },
};

export const decideTool = {
  name: 'decide',
  description: 'Record a decision with reasoning. Builds decision history so you can recall WHY something was done a certain way.',
  inputSchema: z.object({
    what: z.string().describe('What was decided'),
    why: z.string().describe('Why this decision was made'),
    alternatives: z.array(z.string()).optional().describe('What alternatives were considered'),
  }),
  handler: async (args: { what: string; why: string; alternatives?: string[] }, dataDir: string) => {
    const memory = getMemoryManager(dataDir);
    memory.working.recordDecision(args.what, args.why, args.alternatives);
    return { content: [{ type: 'text' as const, text: `🧠 Decision recorded: ${args.what}\nReason: ${args.why}` }] };
  },
};

export const consolidateTool = {
  name: 'memory_consolidate',
  description: 'Consolidate old timeline events into summaries. Reduces noise, keeps memory efficient. Run periodically or at session end.',
  inputSchema: z.object({
    olderThanDays: z.number().optional().describe('Consolidate events older than N days (default: 7)'),
  }),
  handler: async (args: { olderThanDays?: number }, dataDir: string) => {
    const memory = getMemoryManager(dataDir);
    const result = memory.timeline.consolidate(args.olderThanDays);
    return { content: [{ type: 'text' as const, text: JSON.stringify({ message: 'Memory consolidated', ...result }, null, 2) }] };
  },
};

export const memoryDecayTool = {
  name: 'memory_decay',
  description: 'Archive/delete very old events. Keeps memory lean. Run monthly.',
  inputSchema: z.object({
    olderThanDays: z.number().optional().describe('Delete events older than N days (default: 90)'),
  }),
  handler: async (args: { olderThanDays?: number }, dataDir: string) => {
    const memory = getMemoryManager(dataDir);
    const result = memory.timeline.decay(args.olderThanDays);
    return { content: [{ type: 'text' as const, text: JSON.stringify({ message: 'Memory decay complete', ...result }, null, 2) }] };
  },
};

export const learnPatternsTool = {
  name: 'learn_patterns',
  description: 'Detect failure patterns and frequent action patterns from timeline. Helps avoid repeating mistakes.',
  inputSchema: z.object({
    type: z.enum(['failures', 'frequent', 'both']).optional().describe('Pattern type to detect (default: both)'),
  }),
  handler: async (args: { type?: string }, dataDir: string) => {
    const memory = getMemoryManager(dataDir);
    const t = args.type ?? 'both';
    const parts: string[] = [];

    if (t === 'failures' || t === 'both') {
      const failures = memory.timeline.detectFailurePatterns();
      if (failures.length > 0) {
        parts.push('## Failure Patterns');
        for (const f of failures) {
          parts.push(`- ${f.file}: ${f.failureCount} failures. Actions: ${f.commonActions.join(', ')}`);
        }
      } else {
        parts.push('## No failure patterns detected');
      }
    }

    if (t === 'frequent' || t === 'both') {
      const frequent = memory.timeline.detectFrequentPatterns();
      if (frequent.length > 0) {
        parts.push('\n## Frequent Patterns');
        for (const f of frequent) {
          parts.push(`- "${f.action}" (${f.count}x, ${f.avgOutcome})`);
        }
      }
    }

    return { content: [{ type: 'text' as const, text: parts.join('\n') || 'No patterns detected.' }] };
  },
};

let crossProjectMemory: CrossProjectMemory | null = null;
function getCrossProject(): CrossProjectMemory {
  if (!crossProjectMemory) crossProjectMemory = new CrossProjectMemory();
  return crossProjectMemory;
}

export const globalLearnTool = {
  name: 'global_learn',
  description: 'Save a learning or pattern to global cross-project memory. Persists across all projects.',
  inputSchema: z.object({
    type: z.enum(['pattern', 'learning']).describe('Type of knowledge'),
    content: z.string().describe('The pattern or learning'),
    description: z.string().optional().describe('Description (for patterns)'),
    category: z.string().optional().describe('Category (for patterns): coding, architecture, debugging, testing'),
  }),
  handler: async (args: { type: string; content: string; description?: string; category?: string }, _dataDir: string) => {
    const cp = getCrossProject();
    const project = path.basename(_repoRoot);
    let id: string;
    if (args.type === 'pattern') {
      id = cp.addPattern(args.content, args.description ?? args.content, args.category ?? 'coding', project);
    } else {
      id = cp.addLearning(args.content, args.description, project);
    }
    return { content: [{ type: 'text' as const, text: `Global ${args.type} saved: ${id}` }] };
  },
};

export const globalRecallTool = {
  name: 'global_recall',
  description: 'Search cross-project memory for patterns and learnings from other projects.',
  inputSchema: z.object({
    query: z.string().describe('Search query'),
    type: z.enum(['patterns', 'learnings', 'both']).optional().describe('What to search (default: both)'),
  }),
  handler: async (args: { query: string; type?: string }, _dataDir: string) => {
    const cp = getCrossProject();
    const t = args.type ?? 'both';
    const parts: string[] = [];

    if (t === 'patterns' || t === 'both') {
      const patterns = cp.searchPatterns(args.query);
      if (patterns.length > 0) {
        parts.push('## Global Patterns');
        for (const p of patterns) {
          parts.push(`- [${p.category}] ${p.pattern}: ${p.description} (from: ${p.projectSource ?? 'unknown'}, used ${p.useCount}x)`);
        }
      }
    }

    if (t === 'learnings' || t === 'both') {
      const learnings = cp.searchLearnings(args.query);
      if (learnings.length > 0) {
        parts.push('\n## Global Learnings');
        for (const l of learnings) {
          parts.push(`- ${l.learning} (from: ${l.projectSource ?? 'unknown'})`);
        }
      }
    }

    return { content: [{ type: 'text' as const, text: parts.join('\n') || 'No global memories found for: ' + args.query }] };
  },
};

export const memoryTools = [
  timelineAddTool,
  timelineSearchTool,
  timelineRecentTool,
  fileNoteAddTool,
  fileNoteGetTool,
  fileNoteSearchTool,
  factAddTool,
  factSearchTool,
  factListTool,
  memoryStatsTool,
  thinkTool,
  predictChangeTool,
  recallExperienceTool,
  sessionBriefingTool,
  workingMemoryTool,
  decideTool,
  consolidateTool,
  memoryDecayTool,
  learnPatternsTool,
  globalLearnTool,
  globalRecallTool,
];

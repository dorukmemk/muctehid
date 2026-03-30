/**
 * Memory Tools — Timeline, File Notes, Important Facts, Cognitive Engine
 */

import { z } from 'zod';
import { MemoryManager } from '../lib/memory/memory-manager.js';
import type { TimelineSearchOptions } from '../lib/memory/timeline-memory.js';
import { GraphStore } from '../lib/graph/graph-store.js';

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
];

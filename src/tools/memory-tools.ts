/**
 * Memory Tools — Timeline, File Notes, Important Facts
 */

import { z } from 'zod';
import { MemoryManager } from '../lib/memory/memory-manager.js';
import type { TimelineEvent, TimelineSearchOptions } from '../lib/memory/timeline-memory.js';
import type { FileNote } from '../lib/memory/file-notes.js';
import type { ImportantFact } from '../lib/memory/important-facts.js';

let memoryManager: MemoryManager | null = null;

function getMemoryManager(dataDir: string): MemoryManager {
  if (!memoryManager) {
    memoryManager = new MemoryManager(dataDir);
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
];

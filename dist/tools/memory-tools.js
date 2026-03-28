"use strict";
/**
 * Memory Tools — Timeline, File Notes, Important Facts
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.memoryTools = exports.memoryStatsTool = exports.factListTool = exports.factSearchTool = exports.factAddTool = exports.fileNoteSearchTool = exports.fileNoteGetTool = exports.fileNoteAddTool = exports.timelineRecentTool = exports.timelineSearchTool = exports.timelineAddTool = void 0;
const zod_1 = require("zod");
const memory_manager_js_1 = require("../lib/memory/memory-manager.js");
let memoryManager = null;
function getMemoryManager(dataDir) {
    if (!memoryManager) {
        memoryManager = new memory_manager_js_1.MemoryManager(dataDir);
    }
    return memoryManager;
}
// ============================================================================
// TIMELINE TOOLS
// ============================================================================
exports.timelineAddTool = {
    name: 'timeline_add',
    description: 'Add an event to timeline memory. Use this after completing any significant action to build episodic memory.',
    inputSchema: zod_1.z.object({
        action: zod_1.z.string().describe('Brief description of the action taken'),
        context: zod_1.z.string().optional().describe('Additional context about the action'),
        files: zod_1.z.array(zod_1.z.string()).optional().describe('Files involved in this action'),
        outcome: zod_1.z.enum(['success', 'failure', 'partial']).describe('Outcome of the action'),
        tags: zod_1.z.array(zod_1.z.string()).optional().describe('Tags for categorization (e.g., refactor, bug-fix, feature)'),
    }),
    handler: async (args, dataDir) => {
        const memory = getMemoryManager(dataDir);
        const id = await memory.timeline.add(args);
        return {
            content: [
                {
                    type: 'text',
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
exports.timelineSearchTool = {
    name: 'timeline_search',
    description: 'Search timeline memory for past events. Use this to recall similar past actions or learn from history.',
    inputSchema: zod_1.z.object({
        query: zod_1.z.string().optional().describe('Search query (searches in action and context)'),
        timeRange: zod_1.z.enum(['last 24h', 'last 7 days', 'last 30 days', 'all']).optional().describe('Time range filter'),
        tags: zod_1.z.array(zod_1.z.string()).optional().describe('Filter by tags'),
        outcome: zod_1.z.enum(['success', 'failure', 'partial']).optional().describe('Filter by outcome'),
        limit: zod_1.z.number().optional().describe('Maximum number of results (default: 10)'),
    }),
    handler: async (args, dataDir) => {
        const memory = getMemoryManager(dataDir);
        const events = await memory.timeline.search(args);
        return {
            content: [
                {
                    type: 'text',
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
exports.timelineRecentTool = {
    name: 'timeline_recent',
    description: 'Get recent timeline events. Use this at session start to see what was done recently.',
    inputSchema: zod_1.z.object({
        limit: zod_1.z.number().optional().describe('Number of recent events to retrieve (default: 10)'),
    }),
    handler: async (args, dataDir) => {
        const memory = getMemoryManager(dataDir);
        const events = await memory.timeline.recent(args.limit);
        return {
            content: [
                {
                    type: 'text',
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
exports.fileNoteAddTool = {
    name: 'file_note_add',
    description: 'Add a note to a file. Use this to remember important information about files (warnings, learnings, TODOs).',
    inputSchema: zod_1.z.object({
        filepath: zod_1.z.string().describe('Path to the file'),
        note: zod_1.z.string().describe('The note content'),
        category: zod_1.z.enum(['info', 'warning', 'todo', 'learned']).describe('Note category'),
    }),
    handler: async (args, dataDir) => {
        const memory = getMemoryManager(dataDir);
        const id = await memory.fileNotes.add(args);
        return {
            content: [
                {
                    type: 'text',
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
exports.fileNoteGetTool = {
    name: 'file_note_get',
    description: 'Get all notes for a specific file. Use this when opening a file to see important information.',
    inputSchema: zod_1.z.object({
        filepath: zod_1.z.string().describe('Path to the file'),
    }),
    handler: async (args, dataDir) => {
        const memory = getMemoryManager(dataDir);
        const notes = memory.fileNotes.get(args.filepath);
        return {
            content: [
                {
                    type: 'text',
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
exports.fileNoteSearchTool = {
    name: 'file_note_search',
    description: 'Search across all file notes using semantic search. Use this to find relevant notes across the codebase.',
    inputSchema: zod_1.z.object({
        query: zod_1.z.string().describe('Search query'),
        limit: zod_1.z.number().optional().describe('Maximum number of results (default: 10)'),
    }),
    handler: async (args, dataDir) => {
        const memory = getMemoryManager(dataDir);
        const notes = await memory.fileNotes.search(args.query, args.limit);
        return {
            content: [
                {
                    type: 'text',
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
exports.factAddTool = {
    name: 'fact_add',
    description: 'Add an important fact about the project. Use this for critical knowledge that should be remembered (architecture, security, business rules).',
    inputSchema: zod_1.z.object({
        fact: zod_1.z.string().describe('The fact to remember'),
        category: zod_1.z.enum(['architecture', 'security', 'business', 'technical']).describe('Fact category'),
        importance: zod_1.z.enum(['low', 'medium', 'high', 'critical']).describe('Importance level'),
    }),
    handler: async (args, dataDir) => {
        const memory = getMemoryManager(dataDir);
        const id = await memory.facts.add(args);
        return {
            content: [
                {
                    type: 'text',
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
exports.factSearchTool = {
    name: 'fact_search',
    description: 'Search important facts using semantic search. Use this to recall relevant knowledge before making decisions.',
    inputSchema: zod_1.z.object({
        query: zod_1.z.string().describe('Search query'),
        minImportance: zod_1.z.enum(['low', 'medium', 'high', 'critical']).optional().describe('Minimum importance level'),
        limit: zod_1.z.number().optional().describe('Maximum number of results (default: 10)'),
    }),
    handler: async (args, dataDir) => {
        const memory = getMemoryManager(dataDir);
        const facts = await memory.facts.search(args.query, {
            minImportance: args.minImportance,
            limit: args.limit,
        });
        return {
            content: [
                {
                    type: 'text',
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
exports.factListTool = {
    name: 'fact_list',
    description: 'List important facts by category or importance. Use this at session start to load critical knowledge.',
    inputSchema: zod_1.z.object({
        category: zod_1.z.enum(['architecture', 'security', 'business', 'technical']).optional().describe('Filter by category'),
        importance: zod_1.z.enum(['low', 'medium', 'high', 'critical']).optional().describe('Filter by importance'),
        limit: zod_1.z.number().optional().describe('Maximum number of results (default: 20)'),
    }),
    handler: async (args, dataDir) => {
        const memory = getMemoryManager(dataDir);
        const facts = memory.facts.list(args);
        return {
            content: [
                {
                    type: 'text',
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
exports.memoryStatsTool = {
    name: 'memory_stats',
    description: 'Get statistics about all memory systems. Use this to understand memory usage.',
    inputSchema: zod_1.z.object({}),
    handler: async (_args, dataDir) => {
        const memory = getMemoryManager(dataDir);
        const timelineStats = memory.timeline.stats();
        const fileNotesStats = memory.fileNotes.stats();
        const factsStats = memory.facts.stats();
        return {
            content: [
                {
                    type: 'text',
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
exports.memoryTools = [
    exports.timelineAddTool,
    exports.timelineSearchTool,
    exports.timelineRecentTool,
    exports.fileNoteAddTool,
    exports.fileNoteGetTool,
    exports.fileNoteSearchTool,
    exports.factAddTool,
    exports.factSearchTool,
    exports.factListTool,
    exports.memoryStatsTool,
];
//# sourceMappingURL=memory-tools.js.map
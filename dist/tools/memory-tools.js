"use strict";
/**
 * Memory Tools — Timeline, File Notes, Important Facts, Cognitive Engine
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.memoryTools = exports.globalRecallTool = exports.globalLearnTool = exports.learnPatternsTool = exports.memoryDecayTool = exports.consolidateTool = exports.decideTool = exports.workingMemoryTool = exports.sessionBriefingTool = exports.recallExperienceTool = exports.predictChangeTool = exports.thinkTool = exports.memoryStatsTool = exports.factListTool = exports.factSearchTool = exports.factAddTool = exports.fileNoteSearchTool = exports.fileNoteGetTool = exports.fileNoteAddTool = exports.timelineRecentTool = exports.timelineSearchTool = exports.timelineAddTool = void 0;
exports.setMemoryDeps = setMemoryDeps;
const zod_1 = require("zod");
const path = __importStar(require("path"));
const memory_manager_js_1 = require("../lib/memory/memory-manager.js");
const cross_project_js_1 = require("../lib/memory/cross-project.js");
let memoryManager = null;
let _graphStore = null;
let _repoRoot = process.cwd();
function setMemoryDeps(graphStore, repoRoot) {
    _graphStore = graphStore;
    _repoRoot = repoRoot;
}
function getMemoryManager(dataDir) {
    if (!memoryManager) {
        memoryManager = new memory_manager_js_1.MemoryManager(dataDir, _graphStore, _repoRoot);
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
    name: 'memory_system_stats',
    description: 'Get statistics about all memory systems (timeline, file notes, facts). Use this to understand memory usage.',
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
// ============================================================================
// COGNITIVE TOOLS
// ============================================================================
exports.thinkTool = {
    name: 'think',
    description: 'Recall everything known about a file before working on it. Returns file notes, recent changes, graph connections, related facts. Use AUTOMATICALLY before editing any file.',
    inputSchema: zod_1.z.object({
        filepath: zod_1.z.string().describe('File path to recall context for'),
    }),
    handler: async (args, dataDir) => {
        const memory = getMemoryManager(dataDir);
        const result = await memory.cognitive.recallForFile(args.filepath);
        const parts = [];
        if (result.context)
            parts.push(result.context);
        if (result.warnings.length > 0) {
            parts.push('\n## ⚠️ Uyarilar');
            result.warnings.forEach((w) => parts.push(`- ${w}`));
        }
        if (result.suggestions.length > 0) {
            parts.push('\n## 💡 Oneriler');
            result.suggestions.forEach((s) => parts.push(`- ${s}`));
        }
        return { content: [{ type: 'text', text: parts.join('\n') || 'Bu dosya hakkinda kayitli bilgi yok.' }] };
    },
};
exports.predictChangeTool = {
    name: 'predict_change',
    description: 'Predict what will happen if you change a file. Shows affected files, risk level, warnings from past failures. Use BEFORE making any significant change.',
    inputSchema: zod_1.z.object({
        filepath: zod_1.z.string().describe('File to change'),
        description: zod_1.z.string().describe('What change you plan to make'),
    }),
    handler: async (args, dataDir) => {
        const memory = getMemoryManager(dataDir);
        const impact = await memory.cognitive.predictChange(args.filepath, args.description);
        const riskEmoji = impact.riskLevel === 'critical' ? '🔴' : impact.riskLevel === 'high' ? '🟠' : impact.riskLevel === 'medium' ? '🟡' : '🟢';
        const lines = [
            `## Degisiklik Tahmini: ${args.filepath}`,
            `**Risk:** ${riskEmoji} ${impact.riskLevel.toUpperCase()}`,
            `**Etkilenen dosya:** ${impact.affectedFiles.length}`,
            `**Etkilenen sembol:** ${impact.affectedSymbols.length}`,
        ];
        if (impact.affectedFiles.length > 0) {
            lines.push('\n### Etkilenen Dosyalar');
            impact.affectedFiles.slice(0, 10).forEach((f) => lines.push(`- ${f}`));
        }
        if (impact.affectedSymbols.length > 0) {
            lines.push('\n### Etkilenen Semboller');
            impact.affectedSymbols.slice(0, 10).forEach((s) => lines.push(`- ${s}`));
        }
        if (impact.warnings.length > 0) {
            lines.push('\n### ⚠️ Uyarilar');
            impact.warnings.forEach((w) => lines.push(`- ${w}`));
        }
        if (impact.suggestions.length > 0) {
            lines.push('\n### 💡 Oneriler');
            impact.suggestions.forEach((s) => lines.push(`- ${s}`));
        }
        return { content: [{ type: 'text', text: lines.join('\n') }] };
    },
};
exports.recallExperienceTool = {
    name: 'recall_experience',
    description: 'Search all memory layers for past experience related to a task. Returns similar past actions, related facts, file notes. Use before starting any task to learn from history.',
    inputSchema: zod_1.z.object({
        task: zod_1.z.string().describe('Description of the task or topic to recall experience for'),
    }),
    handler: async (args, dataDir) => {
        const memory = getMemoryManager(dataDir);
        const result = await memory.cognitive.recallExperience(args.task);
        return { content: [{ type: 'text', text: result }] };
    },
};
exports.sessionBriefingTool = {
    name: 'session_briefing',
    description: 'Get a full session briefing: top facts, recent activity, open TODOs, warnings, memory stats. Use at the START of every session.',
    inputSchema: zod_1.z.object({}),
    handler: async (_args, dataDir) => {
        const memory = getMemoryManager(dataDir);
        const briefing = await memory.cognitive.getSessionBriefing();
        return { content: [{ type: 'text', text: briefing }] };
    },
};
exports.workingMemoryTool = {
    name: 'working_memory',
    description: 'Manage working memory: set active goal/task, record breadcrumbs, check for goal drift. Keeps track of what you are doing RIGHT NOW.',
    inputSchema: zod_1.z.object({
        action: zod_1.z.enum(['set_goal', 'set_task', 'clear_task', 'breadcrumb', 'status', 'reset']).describe('Action to perform'),
        value: zod_1.z.string().optional().describe('Value for set_goal, set_task, or breadcrumb'),
        taskId: zod_1.z.string().optional().describe('Task ID for set_task'),
        file: zod_1.z.string().optional().describe('File for breadcrumb'),
    }),
    handler: async (args, dataDir) => {
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
                if (drift)
                    text += `\n\n${drift}`;
                break;
            case 'reset':
                wm.reset();
                text = '🗑️ Working memory reset';
                break;
        }
        return { content: [{ type: 'text', text }] };
    },
};
exports.decideTool = {
    name: 'decide',
    description: 'Record a decision with reasoning. Builds decision history so you can recall WHY something was done a certain way.',
    inputSchema: zod_1.z.object({
        what: zod_1.z.string().describe('What was decided'),
        why: zod_1.z.string().describe('Why this decision was made'),
        alternatives: zod_1.z.array(zod_1.z.string()).optional().describe('What alternatives were considered'),
    }),
    handler: async (args, dataDir) => {
        const memory = getMemoryManager(dataDir);
        memory.working.recordDecision(args.what, args.why, args.alternatives);
        return { content: [{ type: 'text', text: `🧠 Decision recorded: ${args.what}\nReason: ${args.why}` }] };
    },
};
exports.consolidateTool = {
    name: 'memory_consolidate',
    description: 'Consolidate old timeline events into summaries. Reduces noise, keeps memory efficient. Run periodically or at session end.',
    inputSchema: zod_1.z.object({
        olderThanDays: zod_1.z.number().optional().describe('Consolidate events older than N days (default: 7)'),
    }),
    handler: async (args, dataDir) => {
        const memory = getMemoryManager(dataDir);
        const result = memory.timeline.consolidate(args.olderThanDays);
        return { content: [{ type: 'text', text: JSON.stringify({ message: 'Memory consolidated', ...result }, null, 2) }] };
    },
};
exports.memoryDecayTool = {
    name: 'memory_decay',
    description: 'Archive/delete very old events. Keeps memory lean. Run monthly.',
    inputSchema: zod_1.z.object({
        olderThanDays: zod_1.z.number().optional().describe('Delete events older than N days (default: 90)'),
    }),
    handler: async (args, dataDir) => {
        const memory = getMemoryManager(dataDir);
        const result = memory.timeline.decay(args.olderThanDays);
        return { content: [{ type: 'text', text: JSON.stringify({ message: 'Memory decay complete', ...result }, null, 2) }] };
    },
};
exports.learnPatternsTool = {
    name: 'learn_patterns',
    description: 'Detect failure patterns and frequent action patterns from timeline. Helps avoid repeating mistakes.',
    inputSchema: zod_1.z.object({
        type: zod_1.z.enum(['failures', 'frequent', 'both']).optional().describe('Pattern type to detect (default: both)'),
    }),
    handler: async (args, dataDir) => {
        const memory = getMemoryManager(dataDir);
        const t = args.type ?? 'both';
        const parts = [];
        if (t === 'failures' || t === 'both') {
            const failures = memory.timeline.detectFailurePatterns();
            if (failures.length > 0) {
                parts.push('## Failure Patterns');
                for (const f of failures) {
                    parts.push(`- ${f.file}: ${f.failureCount} failures. Actions: ${f.commonActions.join(', ')}`);
                }
            }
            else {
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
        return { content: [{ type: 'text', text: parts.join('\n') || 'No patterns detected.' }] };
    },
};
let crossProjectMemory = null;
function getCrossProject() {
    if (!crossProjectMemory)
        crossProjectMemory = new cross_project_js_1.CrossProjectMemory();
    return crossProjectMemory;
}
exports.globalLearnTool = {
    name: 'global_learn',
    description: 'Save a learning or pattern to global cross-project memory. Persists across all projects.',
    inputSchema: zod_1.z.object({
        type: zod_1.z.enum(['pattern', 'learning']).describe('Type of knowledge'),
        content: zod_1.z.string().describe('The pattern or learning'),
        description: zod_1.z.string().optional().describe('Description (for patterns)'),
        category: zod_1.z.string().optional().describe('Category (for patterns): coding, architecture, debugging, testing'),
    }),
    handler: async (args, _dataDir) => {
        const cp = getCrossProject();
        const project = path.basename(_repoRoot);
        let id;
        if (args.type === 'pattern') {
            id = cp.addPattern(args.content, args.description ?? args.content, args.category ?? 'coding', project);
        }
        else {
            id = cp.addLearning(args.content, args.description, project);
        }
        return { content: [{ type: 'text', text: `Global ${args.type} saved: ${id}` }] };
    },
};
exports.globalRecallTool = {
    name: 'global_recall',
    description: 'Search cross-project memory for patterns and learnings from other projects.',
    inputSchema: zod_1.z.object({
        query: zod_1.z.string().describe('Search query'),
        type: zod_1.z.enum(['patterns', 'learnings', 'both']).optional().describe('What to search (default: both)'),
    }),
    handler: async (args, _dataDir) => {
        const cp = getCrossProject();
        const t = args.type ?? 'both';
        const parts = [];
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
        return { content: [{ type: 'text', text: parts.join('\n') || 'No global memories found for: ' + args.query }] };
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
    exports.thinkTool,
    exports.predictChangeTool,
    exports.recallExperienceTool,
    exports.sessionBriefingTool,
    exports.workingMemoryTool,
    exports.decideTool,
    exports.consolidateTool,
    exports.memoryDecayTool,
    exports.learnPatternsTool,
    exports.globalLearnTool,
    exports.globalRecallTool,
];
//# sourceMappingURL=memory-tools.js.map
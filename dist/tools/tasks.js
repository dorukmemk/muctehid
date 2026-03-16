"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerTaskTools = registerTaskTools;
const types_js_1 = require("@modelcontextprotocol/sdk/types.js");
const task_store_js_1 = require("../lib/tasks/task-store.js");
const task_manager_js_1 = require("../lib/tasks/task-manager.js");
const TASK_TOOLS = [
    'task_create',
    'task_list',
    'task_update',
    'task_get',
    'task_next',
    'task_progress',
    'task_delete',
    'task_timeline',
];
function registerTaskTools(server, deps) {
    const store = new task_store_js_1.TaskStore(deps.dataDir);
    const manager = new task_manager_js_1.TaskManager(store);
    server.setRequestHandler(types_js_1.CallToolRequestSchema, async (req) => {
        const { name, arguments: args = {} } = req.params;
        if (!TASK_TOOLS.includes(name)) {
            throw new Error(`Unknown task tool: ${name}`);
        }
        try {
            if (name === 'task_create') {
                const title = args.title;
                const description = args.description;
                if (!title)
                    throw new Error('title is required');
                if (!description)
                    throw new Error('description is required');
                const task = store.create({
                    title,
                    description,
                    priority: (args.priority ?? 'medium'),
                    category: (args.category ?? 'feature'),
                    status: 'pending',
                    filepath: args.filepath,
                    estimateHours: args.estimateHours,
                    dependsOn: args.dependsOn ?? [],
                    tags: args.tags ?? [],
                    miniPrompt: args.miniPrompt,
                    specId: args.specId,
                    createdBy: 'user',
                });
                return {
                    content: [{
                            type: 'text',
                            text: `Görev oluşturuldu: **${task.id}**\n\n` +
                                `Title: ${task.title}\nPriority: ${task.priority}\nCategory: ${task.category}`,
                        }],
                };
            }
            if (name === 'task_list') {
                const tasks = store.list({
                    status: args.status,
                    priority: args.priority,
                    category: args.category,
                    filepath: args.filepath,
                    specId: args.specId,
                });
                if (tasks.length === 0) {
                    return { content: [{ type: 'text', text: 'Görev bulunamadı.' }] };
                }
                const lines = tasks.map(t => `**${t.id}** [${t.priority.toUpperCase()}] ${t.title}\n  Status: ${t.status} | ${t.estimateHours ?? '?'}h | ${t.category}`);
                return { content: [{ type: 'text', text: lines.join('\n\n') }] };
            }
            if (name === 'task_update') {
                const taskId = args.taskId;
                if (!taskId)
                    throw new Error('taskId is required');
                const update = {};
                if (args.status)
                    update.status = args.status;
                if (args.priority)
                    update.priority = args.priority;
                if (args.notes)
                    update.notes = args.notes;
                if (args.actualHours !== undefined)
                    update.actualHours = args.actualHours;
                const task = store.update(taskId, update);
                if (!task) {
                    return {
                        content: [{ type: 'text', text: `Görev bulunamadı: ${taskId}` }],
                        isError: true,
                    };
                }
                return {
                    content: [{ type: 'text', text: `Güncellendi: ${task.title} → ${task.status}` }],
                };
            }
            if (name === 'task_get') {
                const taskId = args.taskId;
                if (!taskId)
                    throw new Error('taskId is required');
                const task = store.getById(taskId);
                if (!task) {
                    return {
                        content: [{ type: 'text', text: `Bulunamadı: ${taskId}` }],
                        isError: true,
                    };
                }
                return { content: [{ type: 'text', text: JSON.stringify(task, null, 2) }] };
            }
            if (name === 'task_next') {
                const limit = args.limit ?? 5;
                const tasks = manager.getNextTasks(limit);
                if (tasks.length === 0) {
                    return { content: [{ type: 'text', text: 'Yapılabilir görev yok.' }] };
                }
                const lines = tasks.map((t, i) => `${i + 1}. **${t.id}** [${t.priority}] ${t.title}\n   ${t.estimateHours ?? '?'}h — ${t.description.slice(0, 80)}`);
                return { content: [{ type: 'text', text: lines.join('\n\n') }] };
            }
            if (name === 'task_progress') {
                const specId = args.specId;
                const progress = manager.computeProgress(specId);
                const text = `## Görev İlerlemesi\n\n` +
                    `- **Toplam:** ${progress.total}\n` +
                    `- **Tamamlandı:** ${progress.done} (%${progress.percentComplete})\n` +
                    `- **Devam ediyor:** ${progress.inProgress}\n` +
                    `- **Bekliyor:** ${progress.pending}\n` +
                    `- **Bloklandı:** ${progress.blocked}\n` +
                    `- **Kalan tahmini:** ${progress.estimatedRemainingHours.toFixed(1)}h\n` +
                    `- **Kritik yol:** ${progress.criticalPath.join(' → ') || 'Yok'}`;
                return { content: [{ type: 'text', text }] };
            }
            if (name === 'task_delete') {
                const taskId = args.taskId;
                if (!taskId)
                    throw new Error('taskId is required');
                const ok = store.delete(taskId);
                return {
                    content: [{ type: 'text', text: ok ? `Silindi: ${taskId}` : `Bulunamadı: ${taskId}` }],
                };
            }
            if (name === 'task_timeline') {
                const taskId = args.taskId;
                if (!taskId)
                    throw new Error('taskId is required');
                const timeline = store.getTimeline(taskId);
                if (timeline.length === 0) {
                    return { content: [{ type: 'text', text: 'Timeline boş.' }] };
                }
                const lines = timeline.map(e => `[${new Date(e.timestamp).toISOString()}] **${e.event}**${e.detail ? `: ${e.detail}` : ''}`);
                return { content: [{ type: 'text', text: lines.join('\n') }] };
            }
            throw new Error(`Unhandled task tool: ${name}`);
        }
        catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            return { content: [{ type: 'text', text: `Hata: ${msg}` }], isError: true };
        }
    });
}
//# sourceMappingURL=tasks.js.map
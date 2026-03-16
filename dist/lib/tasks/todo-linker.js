"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TodoLinker = void 0;
const quality_js_1 = require("../audit/quality.js");
class TodoLinker {
    store;
    constructor(store) {
        this.store = store;
    }
    // Import TODO/FIXME/HACK from source files as tasks
    async importFromFile(filepath, content) {
        const todos = (0, quality_js_1.scanTodos)(filepath, content);
        const linked = [];
        for (const todo of todos) {
            // Check if already linked (same file+line)
            const existing = this.store.list({ filepath }).find(t => t.startLine === todo.line && t.symbol === todo.type);
            if (existing) {
                linked.push({ task: existing, file: filepath, line: todo.line, type: todo.type, text: todo.text });
                continue;
            }
            const priority = todo.type === 'FIXME' || todo.type === 'HACK' ? 'high' : 'medium';
            const category = todo.type === 'FIXME' ? 'bug' : todo.type === 'HACK' ? 'refactor' : 'chore';
            const task = this.store.create({
                title: `${todo.type}: ${todo.text.slice(0, 60)}`,
                description: `Auto-imported from ${filepath}:${todo.line}\n\n${todo.text}`,
                status: 'pending',
                priority,
                category,
                filepath,
                startLine: todo.line,
                symbol: todo.type,
                dependsOn: [],
                tags: ['todo', 'auto-import'],
                createdBy: 'agent',
            });
            this.store.addReference({
                taskId: task.id,
                type: 'code',
                label: `${todo.type} at line ${todo.line}`,
                target: filepath,
                line: todo.line,
            });
            linked.push({ task, file: filepath, line: todo.line, type: todo.type, text: todo.text });
        }
        return linked;
    }
    // List tasks linked to a specific file
    getTasksForFile(filepath) {
        return this.store.list({ filepath });
    }
    // Summary of todo-linked tasks
    summary() {
        const tasks = this.store.list({ tag: 'auto-import' });
        const byType = {};
        for (const t of tasks) {
            const type = t.symbol ?? 'TODO';
            byType[type] = (byType[type] ?? 0) + 1;
        }
        return { totalTodos: tasks.length, byType };
    }
}
exports.TodoLinker = TodoLinker;
//# sourceMappingURL=todo-linker.js.map
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { TaskStore } from '../lib/tasks/task-store.js';
import { TaskManager } from '../lib/tasks/task-manager.js';
import { TaskCategory, TaskPriority, TaskStatus } from '../types/v2.js';

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

export function registerTaskTools(
  server: Server,
  deps: { dataDir: string }
): void {
  const store = new TaskStore(deps.dataDir);
  const manager = new TaskManager(store);

  server.setRequestHandler(
    CallToolRequestSchema,
    async (req) => {
      const { name, arguments: args = {} } = req.params;

      if (!TASK_TOOLS.includes(name)) {
        throw new Error(`Unknown task tool: ${name}`);
      }

      try {
        if (name === 'task_create') {
          const title = args.title as string;
          const description = args.description as string;
          if (!title) throw new Error('title is required');
          if (!description) throw new Error('description is required');

          const task = store.create({
            title,
            description,
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
          return {
            content: [{
              type: 'text' as const,
              text: `Görev oluşturuldu: **${task.id}**\n\n` +
                `Title: ${task.title}\nPriority: ${task.priority}\nCategory: ${task.category}`,
            }],
          };
        }

        if (name === 'task_list') {
          const tasks = store.list({
            status: args.status as TaskStatus | undefined,
            priority: args.priority as TaskPriority | undefined,
            category: args.category as TaskCategory | undefined,
            filepath: args.filepath as string | undefined,
            specId: args.specId as string | undefined,
          });
          if (tasks.length === 0) {
            return { content: [{ type: 'text' as const, text: 'Görev bulunamadı.' }] };
          }
          const lines = tasks.map(t =>
            `**${t.id}** [${t.priority.toUpperCase()}] ${t.title}\n  Status: ${t.status} | ${t.estimateHours ?? '?'}h | ${t.category}`
          );
          return { content: [{ type: 'text' as const, text: lines.join('\n\n') }] };
        }

        if (name === 'task_update') {
          const taskId = args.taskId as string;
          if (!taskId) throw new Error('taskId is required');

          const update: Parameters<typeof store.update>[1] = {};
          if (args.status) update.status = args.status as TaskStatus;
          if (args.priority) update.priority = args.priority as TaskPriority;
          if (args.notes) update.notes = args.notes as string;
          if (args.actualHours !== undefined) update.actualHours = args.actualHours as number;

          const task = store.update(taskId, update);
          if (!task) {
            return {
              content: [{ type: 'text' as const, text: `Görev bulunamadı: ${taskId}` }],
              isError: true,
            };
          }
          return {
            content: [{ type: 'text' as const, text: `Güncellendi: ${task.title} → ${task.status}` }],
          };
        }

        if (name === 'task_get') {
          const taskId = args.taskId as string;
          if (!taskId) throw new Error('taskId is required');
          const task = store.getById(taskId);
          if (!task) {
            return {
              content: [{ type: 'text' as const, text: `Bulunamadı: ${taskId}` }],
              isError: true,
            };
          }
          return { content: [{ type: 'text' as const, text: JSON.stringify(task, null, 2) }] };
        }

        if (name === 'task_next') {
          const limit = (args.limit as number) ?? 5;
          const tasks = manager.getNextTasks(limit);
          if (tasks.length === 0) {
            return { content: [{ type: 'text' as const, text: 'Yapılabilir görev yok.' }] };
          }
          const lines = tasks.map((t, i) =>
            `${i + 1}. **${t.id}** [${t.priority}] ${t.title}\n   ${t.estimateHours ?? '?'}h — ${t.description.slice(0, 80)}`
          );
          return { content: [{ type: 'text' as const, text: lines.join('\n\n') }] };
        }

        if (name === 'task_progress') {
          const specId = args.specId as string | undefined;
          const progress = manager.computeProgress(specId);
          const text = `## Görev İlerlemesi\n\n` +
            `- **Toplam:** ${progress.total}\n` +
            `- **Tamamlandı:** ${progress.done} (%${progress.percentComplete})\n` +
            `- **Devam ediyor:** ${progress.inProgress}\n` +
            `- **Bekliyor:** ${progress.pending}\n` +
            `- **Bloklandı:** ${progress.blocked}\n` +
            `- **Kalan tahmini:** ${progress.estimatedRemainingHours.toFixed(1)}h\n` +
            `- **Kritik yol:** ${progress.criticalPath.join(' → ') || 'Yok'}`;
          return { content: [{ type: 'text' as const, text }] };
        }

        if (name === 'task_delete') {
          const taskId = args.taskId as string;
          if (!taskId) throw new Error('taskId is required');
          const ok = store.delete(taskId);
          return {
            content: [{ type: 'text' as const, text: ok ? `Silindi: ${taskId}` : `Bulunamadı: ${taskId}` }],
          };
        }

        if (name === 'task_timeline') {
          const taskId = args.taskId as string;
          if (!taskId) throw new Error('taskId is required');
          const timeline = store.getTimeline(taskId);
          if (timeline.length === 0) {
            return { content: [{ type: 'text' as const, text: 'Timeline boş.' }] };
          }
          const lines = timeline.map(e =>
            `[${new Date(e.timestamp).toISOString()}] **${e.event}**${e.detail ? `: ${e.detail}` : ''}`
          );
          return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
        }

        throw new Error(`Unhandled task tool: ${name}`);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        return { content: [{ type: 'text' as const, text: `Hata: ${msg}` }], isError: true };
      }
    }
  );
}

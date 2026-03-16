import { TaskStore } from './task-store.js';
import { Task, TaskProgress } from '../../types/v2.js';

export class TaskManager {
  constructor(private store: TaskStore) {}

  // Topological sort — respects dependsOn, returns ordered task IDs
  getExecutionOrder(taskIds?: string[]): string[] {
    const tasks = taskIds
      ? taskIds.map(id => this.store.getById(id)).filter(Boolean) as Task[]
      : this.store.list();

    const taskMap = new Map(tasks.map(t => [t.id, t]));
    const visited = new Set<string>();
    const result: string[] = [];

    const visit = (id: string, ancestors: Set<string>): void => {
      if (visited.has(id)) return;
      if (ancestors.has(id)) return; // cycle — skip
      ancestors.add(id);
      const task = taskMap.get(id);
      if (task) {
        for (const dep of task.dependsOn) {
          if (taskMap.has(dep)) visit(dep, new Set(ancestors));
        }
      }
      visited.add(id);
      result.push(id);
    };

    for (const task of tasks) visit(task.id, new Set());
    return result;
  }

  // Next actionable tasks: pending, no unresolved deps
  getNextTasks(limit = 5): Task[] {
    const all = this.store.list({ status: 'pending' });
    const done = new Set(this.store.list({ status: 'done' }).map(t => t.id));
    const actionable = all.filter(t => t.dependsOn.every(d => done.has(d)));
    // Sort: critical > high > medium > low, then by estimateHours asc
    const priority = { critical: 0, high: 1, medium: 2, low: 3 };
    actionable.sort((a, b) => {
      const pd = priority[a.priority] - priority[b.priority];
      if (pd !== 0) return pd;
      return (a.estimateHours ?? 999) - (b.estimateHours ?? 999);
    });
    return actionable.slice(0, limit);
  }

  // Critical path: longest chain of remaining tasks by estimate
  getCriticalPath(): string[] {
    const remaining = this.store.list().filter(t => t.status !== 'done' && t.status !== 'cancelled');
    const taskMap = new Map(remaining.map(t => [t.id, t]));

    // Topological order
    const order = this.getExecutionOrder(remaining.map(t => t.id));

    // Longest path by hours
    const dist = new Map<string, number>();
    const prev = new Map<string, string>();

    for (const id of order) {
      const task = taskMap.get(id);
      if (!task) continue;
      const h = task.estimateHours ?? 1;
      let best = 0;
      let bestPrev = '';
      for (const dep of task.dependsOn) {
        const d = dist.get(dep) ?? 0;
        if (d > best) { best = d; bestPrev = dep; }
      }
      dist.set(id, best + h);
      if (bestPrev) prev.set(id, bestPrev);
    }

    // Find end of longest path
    let maxId = '';
    let maxDist = 0;
    for (const [id, d] of dist) {
      if (d > maxDist) { maxDist = d; maxId = id; }
    }

    // Trace back
    const path: string[] = [];
    let cur = maxId;
    while (cur) {
      path.unshift(cur);
      cur = prev.get(cur) ?? '';
    }
    return path;
  }

  computeProgress(specId?: string): TaskProgress {
    const tasks = specId ? this.store.list({ specId }) : this.store.list();
    const byStatus = { pending: 0, 'in-progress': 0, done: 0, blocked: 0, cancelled: 0 };
    let totalEstimate = 0;
    let doneEstimate = 0;

    for (const t of tasks) {
      byStatus[t.status] = (byStatus[t.status] ?? 0) + 1;
      const h = t.estimateHours ?? 1;
      totalEstimate += h;
      if (t.status === 'done') doneEstimate += h;
    }

    const active = tasks.filter(t => t.status !== 'cancelled');
    const done = active.filter(t => t.status === 'done');
    const remaining = totalEstimate - doneEstimate;

    return {
      total: active.length,
      done: byStatus.done,
      inProgress: byStatus['in-progress'],
      blocked: byStatus.blocked,
      pending: byStatus.pending,
      percentComplete: active.length > 0 ? Math.round((done.length / active.length) * 100) : 0,
      estimatedRemainingHours: remaining,
      criticalPath: this.getCriticalPath(),
    };
  }

  markStarted(id: string): void {
    this.store.update(id, { status: 'in-progress' });
    this.store.addTimeline(id, 'started');
  }

  markDone(id: string, actualHours?: number): void {
    this.store.update(id, { status: 'done', completedAt: Date.now(), ...(actualHours ? { actualHours } : {}) });
    this.store.addTimeline(id, 'completed');

    // Unblock tasks that were waiting on this one
    const allPending = this.store.list({ status: 'pending' });
    const allBlocked = this.store.list({ status: 'blocked' });
    const doneTasks = new Set(this.store.list({ status: 'done' }).map(t => t.id));

    for (const task of [...allPending, ...allBlocked]) {
      if (task.dependsOn.includes(id)) {
        // Check if ALL dependencies are now done
        const allDepsDone = task.dependsOn.every(depId => doneTasks.has(depId));
        if (allDepsDone && task.status === 'blocked') {
          this.store.update(task.id, { status: 'pending' });
          this.store.addTimeline(task.id, 'note', `Unblocked: dependency ${id} completed`);
        }
      }
    }
  }

  markBlocked(id: string, reason: string): void {
    this.store.update(id, { status: 'blocked' });
    this.store.addTimeline(id, 'blocked', reason);
  }

  addNote(id: string, note: string): void {
    const task = this.store.getById(id);
    if (!task) return;
    const notes = task.notes ? task.notes + '\n' + note : note;
    this.store.update(id, { notes });
    this.store.addTimeline(id, 'note', note);
  }
}

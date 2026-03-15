import Database, { Database as DB } from 'better-sqlite3';
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';
import { Task, TaskReference, TaskTimelineEntry, TaskStatus, TaskPriority, TaskCategory } from '../../types/v2.js';

export class TaskStore {
  private db: DB;

  constructor(dataDir: string) {
    fs.mkdirSync(dataDir, { recursive: true });
    this.db = new Database(path.join(dataDir, 'tasks.db'));
    this.db.pragma('journal_mode = WAL');
    this.init();
  }

  private init(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        mini_prompt TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        priority TEXT NOT NULL DEFAULT 'medium',
        category TEXT NOT NULL DEFAULT 'feature',
        spec_id TEXT,
        spec_task_ref TEXT,
        filepath TEXT,
        start_line INTEGER,
        end_line INTEGER,
        symbol TEXT,
        depends_on TEXT NOT NULL DEFAULT '[]',
        tags TEXT NOT NULL DEFAULT '[]',
        estimate_hours REAL,
        actual_hours REAL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        completed_at INTEGER,
        created_by TEXT NOT NULL DEFAULT 'user',
        notes TEXT
      );

      CREATE INDEX IF NOT EXISTS tasks_status ON tasks(status);
      CREATE INDEX IF NOT EXISTS tasks_priority ON tasks(priority);
      CREATE INDEX IF NOT EXISTS tasks_filepath ON tasks(filepath);
      CREATE INDEX IF NOT EXISTS tasks_spec_id ON tasks(spec_id);

      CREATE TABLE IF NOT EXISTS task_references (
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL,
        type TEXT NOT NULL,
        label TEXT,
        target TEXT NOT NULL,
        line INTEGER,
        FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS task_timeline (
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL,
        event TEXT NOT NULL,
        detail TEXT,
        timestamp INTEGER NOT NULL,
        FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS task_timeline_task_id ON task_timeline(task_id);
      CREATE INDEX IF NOT EXISTS task_timeline_timestamp ON task_timeline(timestamp);
    `);
  }

  create(data: Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'references'>): Task {
    const id = crypto.randomUUID();
    const now = Date.now();
    this.db.prepare(`
      INSERT INTO tasks (id, title, description, mini_prompt, status, priority, category,
        spec_id, spec_task_ref, filepath, start_line, end_line, symbol,
        depends_on, tags, estimate_hours, created_at, updated_at, created_by, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, data.title, data.description, data.miniPrompt ?? null,
      data.status, data.priority, data.category,
      data.specId ?? null, data.specTaskRef ?? null,
      data.filepath ?? null, data.startLine ?? null, data.endLine ?? null, data.symbol ?? null,
      JSON.stringify(data.dependsOn), JSON.stringify(data.tags),
      data.estimateHours ?? null, now, now, data.createdBy, data.notes ?? null
    );
    this.addTimeline(id, 'created', `Task created: ${data.title}`);
    return this.getById(id)!;
  }

  update(id: string, data: Partial<Omit<Task, 'id' | 'createdAt' | 'references'>>): Task | null {
    const existing = this.getById(id);
    if (!existing) return null;

    const now = Date.now();
    const fields: string[] = [];
    const values: unknown[] = [];

    if (data.title !== undefined) { fields.push('title = ?'); values.push(data.title); }
    if (data.description !== undefined) { fields.push('description = ?'); values.push(data.description); }
    if (data.miniPrompt !== undefined) { fields.push('mini_prompt = ?'); values.push(data.miniPrompt); }
    if (data.status !== undefined) { fields.push('status = ?'); values.push(data.status); }
    if (data.priority !== undefined) { fields.push('priority = ?'); values.push(data.priority); }
    if (data.category !== undefined) { fields.push('category = ?'); values.push(data.category); }
    if (data.filepath !== undefined) { fields.push('filepath = ?'); values.push(data.filepath); }
    if (data.startLine !== undefined) { fields.push('start_line = ?'); values.push(data.startLine); }
    if (data.endLine !== undefined) { fields.push('end_line = ?'); values.push(data.endLine); }
    if (data.symbol !== undefined) { fields.push('symbol = ?'); values.push(data.symbol); }
    if (data.dependsOn !== undefined) { fields.push('depends_on = ?'); values.push(JSON.stringify(data.dependsOn)); }
    if (data.tags !== undefined) { fields.push('tags = ?'); values.push(JSON.stringify(data.tags)); }
    if (data.estimateHours !== undefined) { fields.push('estimate_hours = ?'); values.push(data.estimateHours); }
    if (data.actualHours !== undefined) { fields.push('actual_hours = ?'); values.push(data.actualHours); }
    if (data.notes !== undefined) { fields.push('notes = ?'); values.push(data.notes); }
    if (data.completedAt !== undefined) { fields.push('completed_at = ?'); values.push(data.completedAt); }

    fields.push('updated_at = ?');
    values.push(now);
    values.push(id);

    if (fields.length > 1) {
      this.db.prepare(`UPDATE tasks SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    }

    if (data.status && data.status !== existing.status) {
      this.addTimeline(id, 'updated', `Status: ${existing.status} → ${data.status}`);
    }

    return this.getById(id);
  }

  delete(id: string): boolean {
    const result = this.db.prepare('DELETE FROM tasks WHERE id = ?').run(id);
    return result.changes > 0;
  }

  getById(id: string): Task | null {
    const row = this.db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    if (!row) return null;
    return this.rowToTask(row);
  }

  list(filter?: { status?: TaskStatus; priority?: TaskPriority; category?: TaskCategory; filepath?: string; specId?: string; tag?: string }): Task[] {
    let sql = 'SELECT * FROM tasks WHERE 1=1';
    const params: unknown[] = [];

    if (filter?.status) { sql += ' AND status = ?'; params.push(filter.status); }
    if (filter?.priority) { sql += ' AND priority = ?'; params.push(filter.priority); }
    if (filter?.category) { sql += ' AND category = ?'; params.push(filter.category); }
    if (filter?.filepath) { sql += ' AND filepath = ?'; params.push(filter.filepath); }
    if (filter?.specId) { sql += ' AND spec_id = ?'; params.push(filter.specId); }
    if (filter?.tag) { sql += ' AND tags LIKE ?'; params.push(`%${filter.tag}%`); }

    sql += ' ORDER BY CASE priority WHEN "critical" THEN 0 WHEN "high" THEN 1 WHEN "medium" THEN 2 ELSE 3 END, created_at ASC';

    const rows = this.db.prepare(sql).all(...params) as Record<string, unknown>[];
    return rows.map(r => this.rowToTask(r));
  }

  addReference(ref: Omit<TaskReference, 'id'>): TaskReference {
    const id = crypto.randomUUID();
    this.db.prepare(`
      INSERT INTO task_references (id, task_id, type, label, target, line)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, ref.taskId, ref.type, ref.label ?? null, ref.target, ref.line ?? null);
    return { ...ref, id };
  }

  getReferences(taskId: string): TaskReference[] {
    const rows = this.db.prepare('SELECT * FROM task_references WHERE task_id = ?').all(taskId) as Record<string, unknown>[];
    return rows.map(r => ({
      id: r.id as string,
      taskId: r.task_id as string,
      type: r.type as TaskReference['type'],
      label: r.label as string | undefined,
      target: r.target as string,
      line: r.line as number | undefined,
    }));
  }

  addTimeline(taskId: string, event: TaskTimelineEntry['event'], detail?: string): void {
    const id = crypto.randomUUID();
    this.db.prepare(`
      INSERT INTO task_timeline (id, task_id, event, detail, timestamp)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, taskId, event, detail ?? null, Date.now());
  }

  getTimeline(taskId: string): TaskTimelineEntry[] {
    const rows = this.db.prepare('SELECT * FROM task_timeline WHERE task_id = ? ORDER BY timestamp ASC').all(taskId) as Record<string, unknown>[];
    return rows.map(r => ({
      id: r.id as string,
      taskId: r.task_id as string,
      event: r.event as TaskTimelineEntry['event'],
      detail: r.detail as string | undefined,
      timestamp: r.timestamp as number,
    }));
  }

  stats(): { total: number; byStatus: Record<string, number>; byPriority: Record<string, number> } {
    const total = (this.db.prepare('SELECT COUNT(*) as cnt FROM tasks').get() as { cnt: number }).cnt;
    const byStatus: Record<string, number> = {};
    const byPriority: Record<string, number> = {};

    const statusRows = this.db.prepare('SELECT status, COUNT(*) as cnt FROM tasks GROUP BY status').all() as Array<{ status: string; cnt: number }>;
    for (const r of statusRows) byStatus[r.status] = r.cnt;

    const priRows = this.db.prepare('SELECT priority, COUNT(*) as cnt FROM tasks GROUP BY priority').all() as Array<{ priority: string; cnt: number }>;
    for (const r of priRows) byPriority[r.priority] = r.cnt;

    return { total, byStatus, byPriority };
  }

  private rowToTask(row: Record<string, unknown>): Task {
    const refs = this.getReferences(row.id as string);
    return {
      id: row.id as string,
      title: row.title as string,
      description: row.description as string,
      miniPrompt: row.mini_prompt as string | undefined,
      status: row.status as TaskStatus,
      priority: row.priority as TaskPriority,
      category: row.category as TaskCategory,
      specId: row.spec_id as string | undefined,
      specTaskRef: row.spec_task_ref as string | undefined,
      filepath: row.filepath as string | undefined,
      startLine: row.start_line as number | undefined,
      endLine: row.end_line as number | undefined,
      symbol: row.symbol as string | undefined,
      dependsOn: JSON.parse(row.depends_on as string || '[]'),
      tags: JSON.parse(row.tags as string || '[]'),
      estimateHours: row.estimate_hours as number | undefined,
      actualHours: row.actual_hours as number | undefined,
      createdAt: row.created_at as number,
      updatedAt: row.updated_at as number,
      completedAt: row.completed_at as number | undefined,
      createdBy: row.created_by as Task['createdBy'],
      references: refs,
      notes: row.notes as string | undefined,
    };
  }

  close(): void { this.db.close(); }
}

import Database, { Database as DB } from 'better-sqlite3';
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';

// ─── Local Types ──────────────────────────────────────────────────────────────

export interface OrchStep {
  id: string;
  order: number;
  description: string;
  tool: string;
  args: Record<string, unknown>;
  status: 'pending' | 'running' | 'done' | 'failed' | 'skipped';
  result?: string;
  dependsOn: string[];
  miniPrompt?: string;
}

export interface OrchEvent {
  id: string;
  sessionId: string;
  type: 'tool_call' | 'tool_result' | 'task_created' | 'error' | 'note' | 'step_complete' | 'blocked';
  tool?: string;
  args?: string;
  result?: string;
  timestamp: number;
}

export interface OrchSession {
  id: string;
  intent: string;
  status: 'active' | 'done' | 'blocked' | 'cancelled';
  strategy: string;
  steps: OrchStep[];
  currentStepIdx: number;
  tasksCreated: string[];
  context: string;
  createdAt: number;
  updatedAt: number;
}

const SESSION_TTL_MS = 8 * 60 * 60 * 1000; // 8 hours

// ─── SessionStore ─────────────────────────────────────────────────────────────

export class SessionStore {
  private db: DB;

  constructor(dataDir: string) {
    fs.mkdirSync(dataDir, { recursive: true });
    this.db = new Database(path.join(dataDir, 'orchestrator.db'));
    this.db.pragma('journal_mode = WAL');
    this.init();
  }

  private init(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS orch_sessions (
        id TEXT PRIMARY KEY,
        intent TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        strategy TEXT NOT NULL DEFAULT 'direct',
        steps_json TEXT NOT NULL DEFAULT '[]',
        current_step_idx INTEGER NOT NULL DEFAULT 0,
        tasks_created TEXT NOT NULL DEFAULT '[]',
        context TEXT NOT NULL DEFAULT '',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS orch_events (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        type TEXT NOT NULL,
        tool TEXT,
        args_json TEXT,
        result TEXT,
        timestamp INTEGER NOT NULL,
        FOREIGN KEY (session_id) REFERENCES orch_sessions(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_orch_events_session ON orch_events(session_id);
      CREATE INDEX IF NOT EXISTS idx_orch_sessions_status ON orch_sessions(status);
    `);
  }

  createSession(intent: string, strategy: string, steps: OrchStep[]): OrchSession {
    const id = crypto.randomUUID();
    const now = Date.now();
    this.db.prepare(`
      INSERT INTO orch_sessions (id, intent, status, strategy, steps_json, current_step_idx, tasks_created, context, created_at, updated_at)
      VALUES (?, ?, 'active', ?, ?, 0, '[]', '', ?, ?)
    `).run(id, intent, strategy, JSON.stringify(steps), now, now);
    return this.getSession(id)!;
  }

  getSession(id: string): OrchSession | null {
    const row = this.db.prepare('SELECT * FROM orch_sessions WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    if (!row) return null;
    return this.rowToSession(row);
  }

  getActive(): OrchSession | null {
    const row = this.db.prepare(
      "SELECT * FROM orch_sessions WHERE status = 'active' ORDER BY updated_at DESC LIMIT 1"
    ).get() as Record<string, unknown> | undefined;
    if (!row) return null;
    const session = this.rowToSession(row);
    // Auto-cancel stale sessions
    if (Date.now() - session.updatedAt > SESSION_TTL_MS) {
      this.updateStatus(session.id, 'cancelled');
      return null;
    }
    return session;
  }

  cleanupStale(): number {
    const cutoff = Date.now() - SESSION_TTL_MS;
    const result = this.db.prepare(
      "UPDATE orch_sessions SET status = 'cancelled', updated_at = ? WHERE status = 'active' AND updated_at < ?"
    ).run(Date.now(), cutoff);
    return result.changes;
  }

  logEvent(
    sessionId: string,
    type: OrchEvent['type'],
    data?: { tool?: string; args?: string; result?: string },
  ): void {
    const id = crypto.randomUUID();
    this.db.prepare(`
      INSERT INTO orch_events (id, session_id, type, tool, args_json, result, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, sessionId, type, data?.tool ?? null, data?.args ?? null, data?.result ?? null, Date.now());
  }

  appendContext(sessionId: string, text: string): void {
    const session = this.getSession(sessionId);
    if (!session) return;
    const combined = session.context + (session.context ? '\n' : '') + text;
    // Keep the LAST 4000 chars — most recent context is most valuable
    const trimmed = combined.length > 4000 ? combined.slice(combined.length - 4000) : combined;
    const now = Date.now();
    this.db.prepare('UPDATE orch_sessions SET context = ?, updated_at = ? WHERE id = ?')
      .run(trimmed, now, sessionId);
  }

  markStepDone(sessionId: string, stepId: string, result: string): void {
    const session = this.getSession(sessionId);
    if (!session) return;
    const steps = session.steps.map(s =>
      s.id === stepId ? { ...s, status: 'done' as const, result } : s
    );
    // Advance currentStepIdx to next pending step
    const nextIdx = steps.findIndex((s, i) => i > session.currentStepIdx && s.status === 'pending');
    const newIdx = nextIdx === -1 ? session.currentStepIdx + 1 : nextIdx;
    const now = Date.now();
    this.db.prepare('UPDATE orch_sessions SET steps_json = ?, current_step_idx = ?, updated_at = ? WHERE id = ?')
      .run(JSON.stringify(steps), newIdx, now, sessionId);
    this.logEvent(sessionId, 'step_complete', { tool: steps.find(s => s.id === stepId)?.tool, result });
  }

  markStepFailed(sessionId: string, stepId: string, error: string): void {
    const session = this.getSession(sessionId);
    if (!session) return;
    const steps = session.steps.map(s =>
      s.id === stepId ? { ...s, status: 'failed' as const, result: error } : s
    );
    const now = Date.now();
    this.db.prepare('UPDATE orch_sessions SET steps_json = ?, updated_at = ? WHERE id = ?')
      .run(JSON.stringify(steps), now, sessionId);
    this.logEvent(sessionId, 'error', { tool: steps.find(s => s.id === stepId)?.tool, result: error });
  }

  addTaskCreated(sessionId: string, taskId: string): void {
    const session = this.getSession(sessionId);
    if (!session) return;
    const tasks = [...session.tasksCreated, taskId];
    const now = Date.now();
    this.db.prepare('UPDATE orch_sessions SET tasks_created = ?, updated_at = ? WHERE id = ?')
      .run(JSON.stringify(tasks), now, sessionId);
    this.logEvent(sessionId, 'task_created', { result: taskId });
  }

  updateStatus(sessionId: string, status: OrchSession['status']): void {
    const now = Date.now();
    this.db.prepare('UPDATE orch_sessions SET status = ?, updated_at = ? WHERE id = ?')
      .run(status, now, sessionId);
  }

  nextPendingStep(sessionId: string): OrchStep | null {
    const session = this.getSession(sessionId);
    if (!session) return null;
    return session.steps.find(s => s.status === 'pending') ?? null;
  }

  getEvents(sessionId: string, limit = 20): OrchEvent[] {
    const rows = this.db.prepare(
      'SELECT * FROM orch_events WHERE session_id = ? ORDER BY timestamp DESC LIMIT ?'
    ).all(sessionId, limit) as Record<string, unknown>[];
    return rows.reverse().map(r => ({
      id: r.id as string,
      sessionId: r.session_id as string,
      type: r.type as OrchEvent['type'],
      tool: r.tool as string | undefined,
      args: r.args_json as string | undefined,
      result: r.result as string | undefined,
      timestamp: r.timestamp as number,
    }));
  }

  getRecentEvents(sessionId: string, limit: number): OrchEvent[] {
    const rows = this.db.prepare(
      'SELECT * FROM orch_events WHERE session_id = ? ORDER BY timestamp DESC LIMIT ?'
    ).all(sessionId, limit) as Record<string, unknown>[];
    return rows.reverse().map(r => ({
      id: r.id as string,
      sessionId: r.session_id as string,
      type: r.type as OrchEvent['type'],
      tool: r.tool as string | undefined,
      args: r.args_json as string | undefined,
      result: r.result as string | undefined,
      timestamp: r.timestamp as number,
    }));
  }

  listSessions(limit = 20): OrchSession[] {
    const rows = this.db.prepare(
      'SELECT * FROM orch_sessions ORDER BY updated_at DESC LIMIT ?'
    ).all(limit) as Record<string, unknown>[];
    return rows.map(r => this.rowToSession(r));
  }

  private rowToSession(row: Record<string, unknown>): OrchSession {
    return {
      id: row.id as string,
      intent: row.intent as string,
      status: row.status as OrchSession['status'],
      strategy: row.strategy as string,
      steps: JSON.parse((row.steps_json as string) || '[]') as OrchStep[],
      currentStepIdx: row.current_step_idx as number,
      tasksCreated: JSON.parse((row.tasks_created as string) || '[]') as string[],
      context: (row.context as string) || '',
      createdAt: row.created_at as number,
      updatedAt: row.updated_at as number,
    };
  }

  close(): void {
    this.db.close();
  }
}

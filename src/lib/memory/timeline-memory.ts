import Database from 'better-sqlite3';
import * as path from 'path';

export interface TimelineEvent {
  id: string;
  timestamp: number;
  action: string;
  context?: string;
  files?: string[];
  outcome: 'success' | 'failure' | 'partial';
  tags?: string[];
}

export interface TimelineSearchOptions {
  query?: string;
  timeRange?: 'last 24h' | 'last 7 days' | 'last 30 days' | 'all';
  tags?: string[];
  outcome?: 'success' | 'failure' | 'partial';
  limit?: number;
}

export class TimelineMemory {
  private db: Database.Database;

  constructor(dataDir: string) {
    const dbPath = path.join(dataDir, 'timeline.db');
    this.db = new Database(dbPath);
    this.init();
  }

  private init(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS timeline_events (
        id TEXT PRIMARY KEY,
        timestamp INTEGER NOT NULL,
        action TEXT NOT NULL,
        context TEXT,
        files TEXT,
        outcome TEXT NOT NULL,
        tags TEXT,
        embedding BLOB
      );

      CREATE INDEX IF NOT EXISTS idx_timeline_timestamp ON timeline_events(timestamp);
      CREATE INDEX IF NOT EXISTS idx_timeline_outcome ON timeline_events(outcome);
    `);
  }

  async add(event: Omit<TimelineEvent, 'id' | 'timestamp'>): Promise<string> {
    const id = `evt_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    const timestamp = Date.now();

    const stmt = this.db.prepare(`
      INSERT INTO timeline_events (id, timestamp, action, context, files, outcome, tags, embedding)
      VALUES (?, ?, ?, ?, ?, ?, ?, NULL)
    `);

    stmt.run(
      id,
      timestamp,
      event.action,
      event.context ?? null,
      event.files ? JSON.stringify(event.files) : null,
      event.outcome,
      event.tags ? JSON.stringify(event.tags) : null
    );

    return id;
  }

  async search(options: TimelineSearchOptions): Promise<TimelineEvent[]> {
    const {
      query,
      timeRange = 'all',
      tags,
      outcome,
      limit = 10,
    } = options;

    // Calculate time filter
    let minTimestamp = 0;
    const now = Date.now();
    switch (timeRange) {
      case 'last 24h':
        minTimestamp = now - 24 * 60 * 60 * 1000;
        break;
      case 'last 7 days':
        minTimestamp = now - 7 * 24 * 60 * 60 * 1000;
        break;
      case 'last 30 days':
        minTimestamp = now - 30 * 24 * 60 * 60 * 1000;
        break;
    }

    // Simple text search for now (can add vector search later)
    let sql = 'SELECT * FROM timeline_events WHERE timestamp >= ?';
    const params: any[] = [minTimestamp];

    if (query) {
      sql += ' AND (action LIKE ? OR context LIKE ?)';
      params.push(`%${query}%`, `%${query}%`);
    }

    if (outcome) {
      sql += ' AND outcome = ?';
      params.push(outcome);
    }

    if (tags && tags.length > 0) {
      const tagConditions = tags.map(() => 'tags LIKE ?').join(' OR ');
      sql += ` AND (${tagConditions})`;
      tags.forEach(tag => params.push(`%"${tag}"%`));
    }

    sql += ' ORDER BY timestamp DESC LIMIT ?';
    params.push(limit);

    const rows = this.db.prepare(sql).all(...params) as any[];
    return rows.map(this.rowToEvent);
  }

  async recent(limit: number = 10): Promise<TimelineEvent[]> {
    const rows = this.db.prepare(`
      SELECT * FROM timeline_events
      ORDER BY timestamp DESC
      LIMIT ?
    `).all(limit) as any[];

    return rows.map(this.rowToEvent);
  }

  async getByFile(filepath: string, limit: number = 5): Promise<TimelineEvent[]> {
    const rows = this.db.prepare(`
      SELECT * FROM timeline_events
      WHERE files LIKE ?
      ORDER BY timestamp DESC
      LIMIT ?
    `).all(`%"${filepath}"%`, limit) as any[];

    return rows.map(this.rowToEvent);
  }

  private vectorSearch(
    queryEmbedding: number[],
    options: { minTimestamp: number; tags?: string[]; outcome?: string; limit: number }
  ): TimelineEvent[] {
    let sql = 'SELECT * FROM timeline_events WHERE timestamp >= ? AND embedding IS NOT NULL';
    const params: any[] = [options.minTimestamp];

    if (options.outcome) {
      sql += ' AND outcome = ?';
      params.push(options.outcome);
    }

    if (options.tags && options.tags.length > 0) {
      const tagConditions = options.tags.map(() => 'tags LIKE ?').join(' OR ');
      sql += ` AND (${tagConditions})`;
      options.tags.forEach(tag => params.push(`%"${tag}"%`));
    }

    const rows = this.db.prepare(sql).all(...params) as any[];

    // Calculate cosine similarity
    const results = rows.map((row: any) => {
      const embedding = new Float32Array(row.embedding.buffer);
      const similarity = this.cosineSimilarity(queryEmbedding, Array.from(embedding));
      return { ...row, similarity };
    });

    // Sort by similarity and return top N
    results.sort((a, b) => b.similarity - a.similarity);
    return results.slice(0, options.limit).map(this.rowToEvent);
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  private rowToEvent(row: any): TimelineEvent {
    return {
      id: row.id,
      timestamp: row.timestamp,
      action: row.action,
      context: row.context,
      files: row.files ? JSON.parse(row.files) : undefined,
      outcome: row.outcome,
      tags: row.tags ? JSON.parse(row.tags) : undefined,
    };
  }

  stats(): { totalEvents: number; last24h: number; last7days: number } {
    const now = Date.now();
    const total = this.db.prepare('SELECT COUNT(*) as count FROM timeline_events').get() as any;
    const last24h = this.db.prepare('SELECT COUNT(*) as count FROM timeline_events WHERE timestamp >= ?').get(now - 24 * 60 * 60 * 1000) as any;
    const last7days = this.db.prepare('SELECT COUNT(*) as count FROM timeline_events WHERE timestamp >= ?').get(now - 7 * 24 * 60 * 60 * 1000) as any;

    return {
      totalEvents: total.count,
      last24h: last24h.count,
      last7days: last7days.count,
    };
  }

  close(): void {
    this.db.close();
  }
}

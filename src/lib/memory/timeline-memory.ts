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

  // ── Memory Consolidation ────────────────────────────────────────────────
  /**
   * Consolidate old events: group similar events into summaries.
   * Keeps recent events (< olderThanDays) intact, consolidates older ones.
   */
  consolidate(olderThanDays: number = 7): { consolidated: number; removed: number; summariesCreated: number } {
    const cutoff = Date.now() - olderThanDays * 24 * 60 * 60 * 1000;
    
    // Group old events by file
    const oldEvents = this.db.prepare(
      'SELECT * FROM timeline_events WHERE timestamp < ? ORDER BY timestamp ASC'
    ).all(cutoff) as any[];

    if (oldEvents.length < 5) return { consolidated: 0, removed: 0, summariesCreated: 0 };

    // Group by file
    const byFile = new Map<string, any[]>();
    const noFile: any[] = [];
    for (const evt of oldEvents) {
      const files = evt.files ? JSON.parse(evt.files) : [];
      if (files.length > 0) {
        const key = files[0];
        if (!byFile.has(key)) byFile.set(key, []);
        byFile.get(key)!.push(evt);
      } else {
        noFile.push(evt);
      }
    }

    let removed = 0;
    let summariesCreated = 0;
    const deleteStmt = this.db.prepare('DELETE FROM timeline_events WHERE id = ?');
    const insertStmt = this.db.prepare(
      'INSERT INTO timeline_events (id, timestamp, action, context, files, outcome, tags, embedding) VALUES (?, ?, ?, ?, ?, ?, ?, NULL)'
    );

    // Consolidate per file
    for (const [file, events] of byFile) {
      if (events.length < 3) continue;

      const successes = events.filter((e: any) => e.outcome === 'success').length;
      const failures = events.filter((e: any) => e.outcome === 'failure').length;
      const actions = [...new Set(events.map((e: any) => e.action))].slice(0, 5);
      const allTags = [...new Set(events.flatMap((e: any) => e.tags ? JSON.parse(e.tags) : []))];
      const firstTs = events[0].timestamp;
      const lastTs = events[events.length - 1].timestamp;

      const summary = `[CONSOLIDATED] ${events.length} events on ${file}: ${actions.join('; ')}. Success: ${successes}, Failures: ${failures}`;
      const id = `cons_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

      // Delete old events
      for (const evt of events) {
        deleteStmt.run(evt.id);
        removed++;
      }

      // Insert summary
      insertStmt.run(
        id, lastTs, summary,
        `Consolidated from ${firstTs} to ${lastTs}`,
        JSON.stringify([file]),
        failures > successes ? 'partial' : 'success',
        allTags.length > 0 ? JSON.stringify(allTags) : null
      );
      summariesCreated++;
    }

    // Consolidate no-file events in batches of 10
    for (let i = 0; i < noFile.length - 2; i += 10) {
      const batch = noFile.slice(i, i + 10);
      if (batch.length < 3) continue;

      const actions = batch.map((e: any) => e.action).slice(0, 5);
      const summary = `[CONSOLIDATED] ${batch.length} misc events: ${actions.join('; ')}`;
      const id = `cons_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

      for (const evt of batch) { deleteStmt.run(evt.id); removed++; }
      insertStmt.run(id, batch[batch.length - 1].timestamp, summary, null, null, 'success', null);
      summariesCreated++;
    }

    return { consolidated: oldEvents.length, removed, summariesCreated };
  }

  // ── Memory Decay ────────────────────────────────────────────────────────
  /**
   * Archive/delete very old events that are unlikely to be useful.
   */
  decay(olderThanDays: number = 90): { archived: number; deleted: number } {
    const cutoff = Date.now() - olderThanDays * 24 * 60 * 60 * 1000;

    // Keep consolidated summaries and failures (they're valuable)
    // Delete only old success events that aren't consolidated
    const result = this.db.prepare(
      `DELETE FROM timeline_events 
       WHERE timestamp < ? 
       AND outcome = 'success' 
       AND action NOT LIKE '[CONSOLIDATED]%'`
    ).run(cutoff);

    return { archived: 0, deleted: result.changes };
  }

  // ── Pattern Learning ────────────────────────────────────────────────────
  /**
   * Detect failure patterns: files that repeatedly cause failures.
   */
  detectFailurePatterns(minOccurrences: number = 2): Array<{
    file: string;
    failureCount: number;
    lastFailure: number;
    commonActions: string[];
  }> {
    const failures = this.db.prepare(
      `SELECT * FROM timeline_events WHERE outcome = 'failure' ORDER BY timestamp DESC LIMIT 100`
    ).all() as any[];

    const byFile = new Map<string, any[]>();
    for (const evt of failures) {
      const files = evt.files ? JSON.parse(evt.files) : [];
      for (const f of files) {
        if (!byFile.has(f)) byFile.set(f, []);
        byFile.get(f)!.push(evt);
      }
    }

    const patterns: Array<{ file: string; failureCount: number; lastFailure: number; commonActions: string[] }> = [];
    for (const [file, events] of byFile) {
      if (events.length >= minOccurrences) {
        const actions = [...new Set(events.map((e: any) => e.action))].slice(0, 3);
        patterns.push({
          file,
          failureCount: events.length,
          lastFailure: events[0].timestamp,
          commonActions: actions,
        });
      }
    }

    return patterns.sort((a, b) => b.failureCount - a.failureCount);
  }

  /**
   * Detect repeated action patterns (things done frequently).
   */
  detectFrequentPatterns(minOccurrences: number = 3): Array<{
    action: string;
    count: number;
    avgOutcome: string;
    files: string[];
  }> {
    // Normalize actions and count
    const events = this.db.prepare(
      'SELECT action, outcome, files FROM timeline_events ORDER BY timestamp DESC LIMIT 200'
    ).all() as any[];

    const actionMap = new Map<string, { count: number; successes: number; failures: number; files: Set<string> }>();
    for (const evt of events) {
      // Normalize: remove specific identifiers
      const normalized = evt.action.replace(/["'][^"']+["']/g, '<id>').replace(/\d+/g, '<n>');
      if (!actionMap.has(normalized)) {
        actionMap.set(normalized, { count: 0, successes: 0, failures: 0, files: new Set() });
      }
      const entry = actionMap.get(normalized)!;
      entry.count++;
      if (evt.outcome === 'success') entry.successes++;
      if (evt.outcome === 'failure') entry.failures++;
      const files = evt.files ? JSON.parse(evt.files) : [];
      for (const f of files) entry.files.add(f);
    }

    return [...actionMap.entries()]
      .filter(([, v]) => v.count >= minOccurrences)
      .map(([action, v]) => ({
        action,
        count: v.count,
        avgOutcome: v.successes > v.failures ? 'mostly success' : v.failures > v.successes ? 'mostly failure' : 'mixed',
        files: [...v.files].slice(0, 5),
      }))
      .sort((a, b) => b.count - a.count);
  }

  close(): void {
    this.db.close();
  }
}

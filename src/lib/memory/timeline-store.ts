import { Database as DB } from 'better-sqlite3';
import * as crypto from 'crypto';
import { ChunkTimelineEntry } from '../../types/v2.js';

export class TimelineStore {
  constructor(private db: DB) {
    this.init();
  }

  private init(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS chunk_timeline (
        id TEXT PRIMARY KEY,
        chunk_id TEXT NOT NULL,
        event TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        metadata TEXT
      );
      CREATE INDEX IF NOT EXISTS chunk_timeline_chunk_id ON chunk_timeline(chunk_id);
      CREATE INDEX IF NOT EXISTS chunk_timeline_timestamp ON chunk_timeline(timestamp);
    `);
  }

  record(chunkId: string, event: ChunkTimelineEntry['event'], metadata?: ChunkTimelineEntry['metadata']): void {
    this.db.prepare(`
      INSERT INTO chunk_timeline (id, chunk_id, event, timestamp, metadata)
      VALUES (?, ?, ?, ?, ?)
    `).run(crypto.randomUUID(), chunkId, event, Date.now(), metadata ? JSON.stringify(metadata) : null);
  }

  getHistory(chunkId: string): ChunkTimelineEntry[] {
    const rows = this.db.prepare('SELECT * FROM chunk_timeline WHERE chunk_id = ? ORDER BY timestamp ASC').all(chunkId) as Record<string, unknown>[];
    return rows.map(r => this.rowToEntry(r));
  }

  getRecentChanges(since: number, limit = 50): ChunkTimelineEntry[] {
    const rows = this.db.prepare('SELECT * FROM chunk_timeline WHERE timestamp > ? ORDER BY timestamp DESC LIMIT ?').all(since, limit) as Record<string, unknown>[];
    return rows.map(r => this.rowToEntry(r));
  }

  getAccessPattern(chunkId: string): { totalAccesses: number; lastAccess: number; firstIndexed: number } {
    const rows = this.db.prepare('SELECT event, timestamp FROM chunk_timeline WHERE chunk_id = ? ORDER BY timestamp ASC').all(chunkId) as Array<{ event: string; timestamp: number }>;
    const accesses = rows.filter(r => r.event === 'accessed').length;
    const indexed = rows.find(r => r.event === 'indexed');
    const last = rows.filter(r => r.event === 'accessed').at(-1);
    return {
      totalAccesses: accesses,
      lastAccess: last?.timestamp ?? 0,
      firstIndexed: indexed?.timestamp ?? 0,
    };
  }

  private rowToEntry(row: Record<string, unknown>): ChunkTimelineEntry {
    return {
      id: row.id as string,
      chunkId: row.chunk_id as string,
      event: row.event as ChunkTimelineEntry['event'],
      timestamp: row.timestamp as number,
      metadata: row.metadata ? JSON.parse(row.metadata as string) : undefined,
    };
  }
}

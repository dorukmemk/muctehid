import Database, { Database as DB } from 'better-sqlite3';
import * as path from 'path';
import * as fs from 'fs';

interface VectorEntry {
  id: string;
  vector: Float32Array;
  metadata: Record<string, unknown>;
}

// SQLite-backed vector store with in-memory cache for fast cosine similarity search.
// Replaces the JSON file approach: no full file rewrite on every upsert, 4x less RAM
// (Float32Array vs number[]), and WAL mode for concurrent write performance.
export class VectorStore {
  private db: DB;
  private cache: Map<string, VectorEntry> = new Map();

  constructor(dataDir: string) {
    fs.mkdirSync(dataDir, { recursive: true });
    this.db = new Database(path.join(dataDir, 'vectors.db'));
    this.db.pragma('journal_mode = WAL');
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS vectors (
        id TEXT PRIMARY KEY,
        vector BLOB NOT NULL,
        metadata TEXT NOT NULL DEFAULT '{}'
      )
    `);
    this.loadCache();
  }

  private loadCache(): void {
    // Load all vectors into memory on startup — acceptable because cosine similarity
    // requires a full scan anyway, and Float32Array keeps the footprint small.
    const rows = this.db
      .prepare('SELECT id, vector, metadata FROM vectors')
      .all() as { id: string; vector: Buffer; metadata: string }[];
    for (const row of rows) {
      this.cache.set(row.id, {
        id: row.id,
        vector: new Float32Array(
          row.vector.buffer,
          row.vector.byteOffset,
          row.vector.byteLength / 4,
        ),
        metadata: JSON.parse(row.metadata) as Record<string, unknown>,
      });
    }
  }

  upsert(id: string, vector: number[], metadata: Record<string, unknown> = {}): void {
    const f32 = new Float32Array(vector);
    const buf = Buffer.from(f32.buffer);
    this.db
      .prepare('INSERT OR REPLACE INTO vectors (id, vector, metadata) VALUES (?, ?, ?)')
      .run(id, buf, JSON.stringify(metadata));
    this.cache.set(id, { id, vector: f32, metadata });
  }

  delete(id: string): void {
    this.db.prepare('DELETE FROM vectors WHERE id = ?').run(id);
    this.cache.delete(id);
  }

  clear(): void {
    this.db.exec('DELETE FROM vectors');
    this.cache.clear();
  }

  search(
    queryVector: number[],
    k: number,
    filter?: Record<string, unknown>,
  ): Array<{ id: string; score: number }> {
    const qf32 = new Float32Array(queryVector);
    const results: Array<{ id: string; score: number }> = [];

    for (const entry of this.cache.values()) {
      if (filter) {
        let match = true;
        for (const [key, val] of Object.entries(filter)) {
          if (entry.metadata[key] !== val) {
            match = false;
            break;
          }
        }
        if (!match) continue;
      }
      const score = cosineSimilarity(qf32, entry.vector);
      results.push({ id: entry.id, score });
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, k);
  }

  has(id: string): boolean {
    return this.cache.has(id);
  }

  size(): number {
    return this.cache.size;
  }

  close(): void {
    this.db.close();
  }
}

function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

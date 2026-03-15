import * as path from 'path';
import * as fs from 'fs';

interface VectorEntry {
  id: string;
  vector: number[];
  metadata: Record<string, unknown>;
}

// Pure TypeScript in-memory vector store with disk persistence
// Replaces vectra to avoid native dependency issues
export class VectorStore {
  private entries: Map<string, VectorEntry> = new Map();
  private storePath: string;

  constructor(storePath: string) {
    this.storePath = storePath;
    fs.mkdirSync(storePath, { recursive: true });
    this.load();
  }

  private load(): void {
    const file = path.join(this.storePath, 'vectors.json');
    if (!fs.existsSync(file)) return;
    try {
      const raw = JSON.parse(fs.readFileSync(file, 'utf-8')) as VectorEntry[];
      for (const e of raw) this.entries.set(e.id, e);
    } catch {
      // corrupt file — start fresh
    }
  }

  private save(): void {
    const file = path.join(this.storePath, 'vectors.json');
    fs.writeFileSync(file, JSON.stringify(Array.from(this.entries.values())));
  }

  upsert(id: string, vector: number[], metadata: Record<string, unknown> = {}): void {
    this.entries.set(id, { id, vector, metadata });
    this.save();
  }

  delete(id: string): void {
    this.entries.delete(id);
    this.save();
  }

  clear(): void {
    this.entries.clear();
    this.save();
  }

  search(queryVector: number[], k: number, filter?: Record<string, unknown>): Array<{ id: string; score: number }> {
    const results: Array<{ id: string; score: number }> = [];

    for (const entry of this.entries.values()) {
      if (filter) {
        let match = true;
        for (const [key, val] of Object.entries(filter)) {
          if (entry.metadata[key] !== val) { match = false; break; }
        }
        if (!match) continue;
      }
      const score = cosineSimilarity(queryVector, entry.vector);
      results.push({ id: entry.id, score });
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, k);
  }

  has(id: string): boolean {
    return this.entries.has(id);
  }

  size(): number {
    return this.entries.size;
  }
}

function cosineSimilarity(a: number[], b: number[]): number {
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

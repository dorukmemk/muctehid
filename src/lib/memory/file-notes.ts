import Database from 'better-sqlite3';
import * as path from 'path';
import { embed } from './embedder.js';

export interface FileNote {
  id: string;
  filepath: string;
  note: string;
  category: 'info' | 'warning' | 'todo' | 'learned';
  timestamp: number;
}

export class FileNotes {
  private db: Database.Database;

  constructor(dataDir: string) {
    const dbPath = path.join(dataDir, 'file-notes.db');
    this.db = new Database(dbPath);
    this.init();
  }

  private init(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS file_notes (
        id TEXT PRIMARY KEY,
        filepath TEXT NOT NULL,
        note TEXT NOT NULL,
        category TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        embedding BLOB
      );

      CREATE INDEX IF NOT EXISTS idx_file_notes_filepath ON file_notes(filepath);
      CREATE INDEX IF NOT EXISTS idx_file_notes_category ON file_notes(category);
    `);
  }

  async add(note: Omit<FileNote, 'id' | 'timestamp'>): Promise<string> {
    const id = `note_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    const timestamp = Date.now();

    // Create embedding
    const embedding = await embed(note.note);

    const stmt = this.db.prepare(`
      INSERT INTO file_notes (id, filepath, note, category, timestamp, embedding)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      note.filepath,
      note.note,
      note.category,
      timestamp,
      Buffer.from(new Float32Array(embedding).buffer)
    );

    return id;
  }

  get(filepath: string): FileNote[] {
    const rows = this.db.prepare(`
      SELECT * FROM file_notes
      WHERE filepath = ?
      ORDER BY timestamp DESC
    `).all(filepath) as any[];

    return rows.map(this.rowToNote);
  }

  async search(query: string, limit: number = 10): Promise<FileNote[]> {
    const queryEmbedding = await embed(query);
    const rows = this.db.prepare('SELECT * FROM file_notes WHERE embedding IS NOT NULL').all() as any[];

    // Calculate similarity
    const results = rows.map((row: any) => {
      const embedding = new Float32Array(row.embedding.buffer);
      const similarity = this.cosineSimilarity(queryEmbedding, Array.from(embedding));
      return { ...row, similarity };
    });

    // Sort and return top N
    results.sort((a, b) => b.similarity - a.similarity);
    return results.slice(0, limit).map(this.rowToNote);
  }

  getByCategory(category: string): FileNote[] {
    const rows = this.db.prepare(`
      SELECT * FROM file_notes
      WHERE category = ?
      ORDER BY timestamp DESC
    `).all(category) as any[];

    return rows.map(this.rowToNote);
  }

  delete(id: string): void {
    this.db.prepare('DELETE FROM file_notes WHERE id = ?').run(id);
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

  private rowToNote(row: any): FileNote {
    return {
      id: row.id,
      filepath: row.filepath,
      note: row.note,
      category: row.category,
      timestamp: row.timestamp,
    };
  }

  stats(): { totalNotes: number; byCategory: Record<string, number> } {
    const total = this.db.prepare('SELECT COUNT(*) as count FROM file_notes').get() as any;
    const byCategory = this.db.prepare(`
      SELECT category, COUNT(*) as count
      FROM file_notes
      GROUP BY category
    `).all() as any[];

    return {
      totalNotes: total.count,
      byCategory: Object.fromEntries(byCategory.map((r: any) => [r.category, r.count])),
    };
  }

  close(): void {
    this.db.close();
  }
}

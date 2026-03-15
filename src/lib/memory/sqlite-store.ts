import Database, { Database as DB } from 'better-sqlite3';
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';
import { CodeChunk } from '../../types/index.js';

export interface BM25Result {
  id: string;
  rank: number;
}

export class SQLiteStore {
  private db: DB;

  constructor(dbPath: string) {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    this.db = new Database(dbPath);
    this.init();
  }

  private init(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS chunks (
        id TEXT PRIMARY KEY,
        filepath TEXT NOT NULL,
        content TEXT NOT NULL,
        start_line INTEGER NOT NULL,
        end_line INTEGER NOT NULL,
        language TEXT NOT NULL,
        symbols TEXT NOT NULL DEFAULT '[]',
        size INTEGER NOT NULL DEFAULT 0,
        last_modified INTEGER NOT NULL DEFAULT 0,
        git_author TEXT
      );

      CREATE VIRTUAL TABLE IF NOT EXISTS chunks_fts USING fts5(
        id UNINDEXED,
        filepath,
        content,
        symbols,
        language UNINDEXED,
        content='chunks',
        content_rowid='rowid'
      );

      CREATE TRIGGER IF NOT EXISTS chunks_ai AFTER INSERT ON chunks BEGIN
        INSERT INTO chunks_fts(rowid, id, filepath, content, symbols, language)
        VALUES (new.rowid, new.id, new.filepath, new.content, new.symbols, new.language);
      END;

      CREATE TRIGGER IF NOT EXISTS chunks_ad AFTER DELETE ON chunks BEGIN
        INSERT INTO chunks_fts(chunks_fts, rowid, id, filepath, content, symbols, language)
        VALUES ('delete', old.rowid, old.id, old.filepath, old.content, old.symbols, old.language);
      END;

      CREATE TRIGGER IF NOT EXISTS chunks_au AFTER UPDATE ON chunks BEGIN
        INSERT INTO chunks_fts(chunks_fts, rowid, id, filepath, content, symbols, language)
        VALUES ('delete', old.rowid, old.id, old.filepath, old.content, old.symbols, old.language);
        INSERT INTO chunks_fts(rowid, id, filepath, content, symbols, language)
        VALUES (new.rowid, new.id, new.filepath, new.content, new.symbols, new.language);
      END;
    `);
  }

  upsert(chunk: CodeChunk): void {
    const existing = this.db.prepare('SELECT id FROM chunks WHERE id = ?').get(chunk.id);
    if (existing) {
      this.db.prepare(`
        UPDATE chunks SET filepath=?, content=?, start_line=?, end_line=?,
        language=?, symbols=?, size=?, last_modified=?, git_author=? WHERE id=?
      `).run(
        chunk.filepath, chunk.content, chunk.startLine, chunk.endLine,
        chunk.language, JSON.stringify(chunk.symbols),
        chunk.metadata.size, chunk.metadata.lastModified,
        chunk.metadata.gitAuthor ?? null, chunk.id
      );
    } else {
      this.db.prepare(`
        INSERT INTO chunks (id, filepath, content, start_line, end_line, language, symbols, size, last_modified, git_author)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        chunk.id, chunk.filepath, chunk.content, chunk.startLine, chunk.endLine,
        chunk.language, JSON.stringify(chunk.symbols),
        chunk.metadata.size, chunk.metadata.lastModified,
        chunk.metadata.gitAuthor ?? null
      );
    }
  }

  delete(id: string): void {
    this.db.prepare('DELETE FROM chunks WHERE id = ?').run(id);
  }

  deleteByFilepath(filepath: string): void {
    this.db.prepare('DELETE FROM chunks WHERE filepath = ?').run(filepath);
  }

  clear(): void {
    this.db.exec('DELETE FROM chunks');
  }

  getById(id: string): CodeChunk | null {
    const row = this.db.prepare('SELECT * FROM chunks WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    return row ? this.rowToChunk(row) : null;
  }

  bm25Search(query: string, k: number, language?: string): BM25Result[] {
    try {
      const ftsQuery = query.replace(/[^\w\s]/g, ' ').trim().split(/\s+/).filter(Boolean).join(' OR ');
      if (!ftsQuery) return [];

      let sql = `
        SELECT c.id, bm25(chunks_fts) as rank
        FROM chunks_fts
        JOIN chunks c ON c.id = chunks_fts.id
        WHERE chunks_fts MATCH ?
      `;
      const params: unknown[] = [ftsQuery];

      if (language) {
        sql += ' AND c.language = ?';
        params.push(language);
      }

      sql += ' ORDER BY rank LIMIT ?';
      params.push(k);

      return this.db.prepare(sql).all(...params) as BM25Result[];
    } catch {
      return [];
    }
  }

  getChunksByIds(ids: string[]): CodeChunk[] {
    if (ids.length === 0) return [];
    const placeholders = ids.map(() => '?').join(',');
    const rows = this.db.prepare(`SELECT * FROM chunks WHERE id IN (${placeholders})`).all(...ids) as Record<string, unknown>[];
    return rows.map(r => this.rowToChunk(r));
  }

  stats(): { chunks: number; files: number; dbSize: number } {
    const chunks = (this.db.prepare('SELECT COUNT(*) as cnt FROM chunks').get() as { cnt: number }).cnt;
    const files = (this.db.prepare('SELECT COUNT(DISTINCT filepath) as cnt FROM chunks').get() as { cnt: number }).cnt;
    return { chunks, files, dbSize: 0 };
  }

  private rowToChunk(row: Record<string, unknown>): CodeChunk {
    return {
      id: row.id as string,
      filepath: row.filepath as string,
      content: row.content as string,
      startLine: row.start_line as number,
      endLine: row.end_line as number,
      language: row.language as string,
      symbols: JSON.parse(row.symbols as string || '[]'),
      metadata: {
        size: row.size as number,
        lastModified: row.last_modified as number,
        gitAuthor: row.git_author as string | undefined,
      },
    };
  }

  close(): void {
    this.db.close();
  }
}

export function makeChunkId(filepath: string, startLine: number): string {
  return crypto.createHash('sha256').update(`${filepath}:${startLine}`).digest('hex').slice(0, 16);
}

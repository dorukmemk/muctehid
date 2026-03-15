import { Database as DB } from 'better-sqlite3';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { Document } from '../../types/v2.js';

const DOC_EXTENSIONS = new Set(['.md', '.txt', '.rst', '.adoc', '.org']);
const DOC_TYPE_MAP: Record<string, Document['docType']> = {
  'readme': 'readme', 'changelog': 'changelog', 'changes': 'changelog',
  'requirements': 'requirements', 'design': 'design', 'spec': 'spec',
  'tasks': 'tasks',
};

export class DocumentStore {
  constructor(private db: DB) {
    this.init();
  }

  private init(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS documents (
        id TEXT PRIMARY KEY,
        filepath TEXT NOT NULL UNIQUE,
        title TEXT,
        doc_type TEXT NOT NULL DEFAULT 'other',
        content TEXT NOT NULL,
        summary TEXT,
        word_count INTEGER NOT NULL DEFAULT 0,
        indexed_at INTEGER NOT NULL,
        last_modified INTEGER NOT NULL,
        tags TEXT NOT NULL DEFAULT '[]'
      );

      CREATE VIRTUAL TABLE IF NOT EXISTS documents_fts USING fts5(
        id UNINDEXED,
        filepath,
        title,
        content,
        tags,
        content='documents',
        content_rowid='rowid'
      );

      CREATE TRIGGER IF NOT EXISTS documents_ai AFTER INSERT ON documents BEGIN
        INSERT INTO documents_fts(rowid, id, filepath, title, content, tags)
        VALUES (new.rowid, new.id, new.filepath, COALESCE(new.title,''), new.content, new.tags);
      END;

      CREATE TRIGGER IF NOT EXISTS documents_ad AFTER DELETE ON documents BEGIN
        INSERT INTO documents_fts(documents_fts, rowid, id, filepath, title, content, tags)
        VALUES ('delete', old.rowid, old.id, old.filepath, COALESCE(old.title,''), old.content, old.tags);
      END;

      CREATE TRIGGER IF NOT EXISTS documents_au AFTER UPDATE ON documents BEGIN
        INSERT INTO documents_fts(documents_fts, rowid, id, filepath, title, content, tags)
        VALUES ('delete', old.rowid, old.id, old.filepath, COALESCE(old.title,''), old.content, old.tags);
        INSERT INTO documents_fts(rowid, id, filepath, title, content, tags)
        VALUES (new.rowid, new.id, new.filepath, COALESCE(new.title,''), new.content, new.tags);
      END;
    `);
  }

  upsert(filepath: string): Document | null {
    if (!DOC_EXTENSIONS.has(path.extname(filepath).toLowerCase())) return null;
    let content: string;
    let stat: fs.Stats;
    try {
      content = fs.readFileSync(filepath, 'utf-8');
      stat = fs.statSync(filepath);
    } catch { return null; }

    const id = crypto.createHash('sha256').update(filepath).digest('hex').slice(0, 16);
    const title = this.extractTitle(content) ?? path.basename(filepath, path.extname(filepath));
    const docType = this.detectDocType(filepath);
    const wordCount = content.split(/\s+/).filter(Boolean).length;
    const now = Date.now();

    const existing = this.db.prepare('SELECT id FROM documents WHERE filepath = ?').get(filepath);
    if (existing) {
      this.db.prepare(`
        UPDATE documents SET content=?, title=?, word_count=?, last_modified=? WHERE filepath=?
      `).run(content, title, wordCount, stat.mtimeMs, filepath);
    } else {
      this.db.prepare(`
        INSERT INTO documents (id, filepath, title, doc_type, content, word_count, indexed_at, last_modified, tags)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, '[]')
      `).run(id, filepath, title, docType, content, wordCount, now, stat.mtimeMs);
    }

    return this.getByFilepath(filepath);
  }

  search(query: string, k = 10): Document[] {
    try {
      const ftsQuery = query.replace(/[^\w\s]/g, ' ').trim().split(/\s+/).filter(Boolean).join(' OR ');
      if (!ftsQuery) return [];
      const rows = this.db.prepare(`
        SELECT d.* FROM documents_fts
        JOIN documents d ON d.id = documents_fts.id
        WHERE documents_fts MATCH ?
        ORDER BY bm25(documents_fts) LIMIT ?
      `).all(ftsQuery, k) as Record<string, unknown>[];
      return rows.map(r => this.rowToDoc(r));
    } catch { return []; }
  }

  getByFilepath(filepath: string): Document | null {
    const row = this.db.prepare('SELECT * FROM documents WHERE filepath = ?').get(filepath) as Record<string, unknown> | undefined;
    return row ? this.rowToDoc(row) : null;
  }

  getById(id: string): Document | null {
    const row = this.db.prepare('SELECT * FROM documents WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    return row ? this.rowToDoc(row) : null;
  }

  list(docType?: Document['docType']): Document[] {
    const rows = docType
      ? this.db.prepare('SELECT * FROM documents WHERE doc_type = ? ORDER BY last_modified DESC').all(docType) as Record<string, unknown>[]
      : this.db.prepare('SELECT * FROM documents ORDER BY last_modified DESC').all() as Record<string, unknown>[];
    return rows.map(r => this.rowToDoc(r));
  }

  delete(filepath: string): void {
    this.db.prepare('DELETE FROM documents WHERE filepath = ?').run(filepath);
  }

  updateSummary(id: string, summary: string): void {
    this.db.prepare('UPDATE documents SET summary = ? WHERE id = ?').run(summary, id);
  }

  stats(): { total: number; byType: Record<string, number>; totalWords: number } {
    const total = (this.db.prepare('SELECT COUNT(*) as cnt FROM documents').get() as { cnt: number }).cnt;
    const totalWords = (this.db.prepare('SELECT SUM(word_count) as s FROM documents').get() as { s: number }).s ?? 0;
    const byType: Record<string, number> = {};
    const rows = this.db.prepare('SELECT doc_type, COUNT(*) as cnt FROM documents GROUP BY doc_type').all() as Array<{ doc_type: string; cnt: number }>;
    for (const r of rows) byType[r.doc_type] = r.cnt;
    return { total, byType, totalWords };
  }

  private extractTitle(content: string): string | null {
    const match = /^#\s+(.+)$/m.exec(content);
    return match ? match[1].trim() : null;
  }

  private detectDocType(filepath: string): Document['docType'] {
    const base = path.basename(filepath).toLowerCase().replace(/\.[^.]+$/, '');
    for (const [key, type] of Object.entries(DOC_TYPE_MAP)) {
      if (base.includes(key)) return type;
    }
    return 'other';
  }

  private rowToDoc(row: Record<string, unknown>): Document {
    return {
      id: row.id as string,
      filepath: row.filepath as string,
      title: row.title as string | undefined,
      docType: row.doc_type as Document['docType'],
      content: row.content as string,
      summary: row.summary as string | undefined,
      wordCount: row.word_count as number,
      indexedAt: row.indexed_at as number,
      lastModified: row.last_modified as number,
      tags: JSON.parse(row.tags as string || '[]'),
    };
  }

  static isDocFile(filepath: string): boolean {
    return DOC_EXTENSIONS.has(path.extname(filepath).toLowerCase());
  }
}

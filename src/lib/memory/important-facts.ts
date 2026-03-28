import Database from 'better-sqlite3';
import * as path from 'path';
import { embed } from './embedder.js';

export interface ImportantFact {
  id: string;
  fact: string;
  category: 'architecture' | 'security' | 'business' | 'technical';
  importance: 'low' | 'medium' | 'high' | 'critical';
  timestamp: number;
  lastUsed?: number;
  useCount: number;
}

export class ImportantFacts {
  private db: Database.Database;

  constructor(dataDir: string) {
    const dbPath = path.join(dataDir, 'important-facts.db');
    this.db = new Database(dbPath);
    this.init();
  }

  private init(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS important_facts (
        id TEXT PRIMARY KEY,
        fact TEXT NOT NULL,
        category TEXT NOT NULL,
        importance TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        lastUsed INTEGER,
        useCount INTEGER DEFAULT 0,
        embedding BLOB
      );

      CREATE INDEX IF NOT EXISTS idx_facts_category ON important_facts(category);
      CREATE INDEX IF NOT EXISTS idx_facts_importance ON important_facts(importance);
    `);
  }

  async add(fact: Omit<ImportantFact, 'id' | 'timestamp' | 'useCount'>): Promise<string> {
    const id = `fact_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    const timestamp = Date.now();

    // Create embedding
    const embedding = await embed(fact.fact);

    const stmt = this.db.prepare(`
      INSERT INTO important_facts (id, fact, category, importance, timestamp, lastUsed, useCount, embedding)
      VALUES (?, ?, ?, ?, ?, ?, 0, ?)
    `);

    stmt.run(
      id,
      fact.fact,
      fact.category,
      fact.importance,
      timestamp,
      fact.lastUsed ?? null,
      Buffer.from(new Float32Array(embedding).buffer)
    );

    return id;
  }

  async search(query: string, options: { minImportance?: string; limit?: number } = {}): Promise<ImportantFact[]> {
    const { minImportance, limit = 10 } = options;
    const queryEmbedding = await embed(query);

    let sql = 'SELECT * FROM important_facts WHERE embedding IS NOT NULL';
    const params: any[] = [];

    if (minImportance) {
      const importanceLevels = ['low', 'medium', 'high', 'critical'];
      const minIndex = importanceLevels.indexOf(minImportance);
      const allowedLevels = importanceLevels.slice(minIndex);
      sql += ` AND importance IN (${allowedLevels.map(() => '?').join(',')})`;
      params.push(...allowedLevels);
    }

    const rows = this.db.prepare(sql).all(...params) as any[];

    // Calculate similarity
    const results = rows.map((row: any) => {
      const embedding = new Float32Array(row.embedding.buffer);
      const similarity = this.cosineSimilarity(queryEmbedding, Array.from(embedding));
      return { ...row, similarity };
    });

    // Sort by similarity
    results.sort((a, b) => b.similarity - a.similarity);
    const topResults = results.slice(0, limit);

    // Update lastUsed and useCount
    const now = Date.now();
    const updateStmt = this.db.prepare('UPDATE important_facts SET lastUsed = ?, useCount = useCount + 1 WHERE id = ?');
    for (const result of topResults) {
      updateStmt.run(now, result.id);
    }

    return topResults.map(this.rowToFact);
  }

  list(options: { category?: string; importance?: string; limit?: number } = {}): ImportantFact[] {
    const { category, importance, limit = 20 } = options;

    let sql = 'SELECT * FROM important_facts WHERE 1=1';
    const params: any[] = [];

    if (category) {
      sql += ' AND category = ?';
      params.push(category);
    }

    if (importance) {
      sql += ' AND importance = ?';
      params.push(importance);
    }

    sql += ' ORDER BY importance DESC, useCount DESC, timestamp DESC LIMIT ?';
    params.push(limit);

    const rows = this.db.prepare(sql).all(...params) as any[];
    return rows.map(this.rowToFact);
  }

  getTopFacts(limit: number = 5): ImportantFact[] {
    const rows = this.db.prepare(`
      SELECT * FROM important_facts
      WHERE importance IN ('high', 'critical')
      ORDER BY 
        CASE importance
          WHEN 'critical' THEN 4
          WHEN 'high' THEN 3
          WHEN 'medium' THEN 2
          ELSE 1
        END DESC,
        useCount DESC,
        timestamp DESC
      LIMIT ?
    `).all(limit) as any[];

    return rows.map(this.rowToFact);
  }

  update(id: string, updates: Partial<Pick<ImportantFact, 'fact' | 'category' | 'importance'>>): void {
    const fields: string[] = [];
    const params: any[] = [];

    if (updates.fact) {
      fields.push('fact = ?');
      params.push(updates.fact);
    }
    if (updates.category) {
      fields.push('category = ?');
      params.push(updates.category);
    }
    if (updates.importance) {
      fields.push('importance = ?');
      params.push(updates.importance);
    }

    if (fields.length > 0) {
      params.push(id);
      this.db.prepare(`UPDATE important_facts SET ${fields.join(', ')} WHERE id = ?`).run(...params);
    }
  }

  delete(id: string): void {
    this.db.prepare('DELETE FROM important_facts WHERE id = ?').run(id);
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

  private rowToFact(row: any): ImportantFact {
    return {
      id: row.id,
      fact: row.fact,
      category: row.category,
      importance: row.importance,
      timestamp: row.timestamp,
      lastUsed: row.lastUsed,
      useCount: row.useCount,
    };
  }

  stats(): { totalFacts: number; byCategory: Record<string, number>; byImportance: Record<string, number> } {
    const total = this.db.prepare('SELECT COUNT(*) as count FROM important_facts').get() as any;
    const byCategory = this.db.prepare(`
      SELECT category, COUNT(*) as count
      FROM important_facts
      GROUP BY category
    `).all() as any[];
    const byImportance = this.db.prepare(`
      SELECT importance, COUNT(*) as count
      FROM important_facts
      GROUP BY importance
    `).all() as any[];

    return {
      totalFacts: total.count,
      byCategory: Object.fromEntries(byCategory.map((r: any) => [r.category, r.count])),
      byImportance: Object.fromEntries(byImportance.map((r: any) => [r.importance, r.count])),
    };
  }

  close(): void {
    this.db.close();
  }
}

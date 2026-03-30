import Database from 'better-sqlite3';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

/**
 * Cross-Project Memory - Projeler arasi paylasilan bellek.
 * ~/.muctehid/global-memory.db konumunda saklanir.
 */
export class CrossProjectMemory {
  private db: Database.Database;

  constructor() {
    const globalDir = path.join(os.homedir(), '.muctehid');
    if (!fs.existsSync(globalDir)) fs.mkdirSync(globalDir, { recursive: true });
    const dbPath = path.join(globalDir, 'global-memory.db');
    this.db = new Database(dbPath);
    this.init();
  }

  private init(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS global_patterns (
        id TEXT PRIMARY KEY,
        pattern TEXT NOT NULL,
        description TEXT NOT NULL,
        category TEXT NOT NULL,
        projectSource TEXT,
        confidence REAL DEFAULT 0.5,
        useCount INTEGER DEFAULT 0,
        timestamp INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS global_learnings (
        id TEXT PRIMARY KEY,
        learning TEXT NOT NULL,
        context TEXT,
        projectSource TEXT,
        timestamp INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_gp_category ON global_patterns(category);
      CREATE INDEX IF NOT EXISTS idx_gl_project ON global_learnings(projectSource);
    `);
  }

  addPattern(pattern: string, description: string, category: string, project?: string): string {
    const id = 'gp_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
    this.db.prepare(
      'INSERT INTO global_patterns (id, pattern, description, category, projectSource, timestamp) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(id, pattern, description, category, project ?? null, Date.now());
    return id;
  }

  addLearning(learning: string, context?: string, project?: string): string {
    const id = 'gl_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
    this.db.prepare(
      'INSERT INTO global_learnings (id, learning, context, projectSource, timestamp) VALUES (?, ?, ?, ?, ?)'
    ).run(id, learning, context ?? null, project ?? null, Date.now());
    return id;
  }

  searchPatterns(query: string, limit: number = 5): Array<{ id: string; pattern: string; description: string; category: string; projectSource: string | null; useCount: number }> {
    const rows = this.db.prepare(
      'SELECT * FROM global_patterns WHERE pattern LIKE ? OR description LIKE ? ORDER BY useCount DESC, timestamp DESC LIMIT ?'
    ).all('%' + query + '%', '%' + query + '%', limit) as any[];
    // Update use count
    const upd = this.db.prepare('UPDATE global_patterns SET useCount = useCount + 1 WHERE id = ?');
    for (const r of rows) upd.run(r.id);
    return rows;
  }

  searchLearnings(query: string, limit: number = 5): Array<{ id: string; learning: string; context: string | null; projectSource: string | null }> {
    return this.db.prepare(
      'SELECT * FROM global_learnings WHERE learning LIKE ? OR context LIKE ? ORDER BY timestamp DESC LIMIT ?'
    ).all('%' + query + '%', '%' + query + '%', limit) as any[];
  }

  getPatternsByCategory(category: string): Array<{ pattern: string; description: string; useCount: number }> {
    return this.db.prepare(
      'SELECT pattern, description, useCount FROM global_patterns WHERE category = ? ORDER BY useCount DESC LIMIT 20'
    ).all(category) as any[];
  }

  stats(): { patterns: number; learnings: number } {
    const p = this.db.prepare('SELECT COUNT(*) as c FROM global_patterns').get() as any;
    const l = this.db.prepare('SELECT COUNT(*) as c FROM global_learnings').get() as any;
    return { patterns: p.c, learnings: l.c };
  }

  close(): void { this.db.close(); }
}

/**
 * Context Optimizer - LLM context window'unu verimli kullanma.
 * Relevance scoring ile sadece ilgili bilgileri dondurur.
 */
export class ContextOptimizer {
  /**
   * Score relevance of a text to a query using keyword overlap.
   */
  static relevanceScore(text: string, query: string): number {
    const queryTerms = query.toLowerCase().split(/\s+/).filter(t => t.length > 2);
    if (queryTerms.length === 0) return 0;
    const textLower = text.toLowerCase();
    let matches = 0;
    for (const term of queryTerms) {
      if (textLower.includes(term)) matches++;
    }
    return matches / queryTerms.length;
  }

  /**
   * Filter and rank items by relevance, return only top N.
   */
  static filterByRelevance<T>(
    items: T[],
    getText: (item: T) => string,
    query: string,
    maxItems: number = 10,
    minScore: number = 0.1
  ): T[] {
    const scored = items.map(item => ({
      item,
      score: ContextOptimizer.relevanceScore(getText(item), query),
    }));
    return scored
      .filter(s => s.score >= minScore)
      .sort((a, b) => b.score - a.score)
      .slice(0, maxItems)
      .map(s => s.item);
  }

  /**
   * Truncate text to fit within token budget (rough estimate: 4 chars = 1 token).
   */
  static truncateToTokens(text: string, maxTokens: number = 2000): string {
    const maxChars = maxTokens * 4;
    if (text.length <= maxChars) return text;
    return text.substring(0, maxChars) + '\n... (truncated to fit context window)';
  }

  /**
   * Build an optimized context string from multiple sources.
   * Prioritizes by importance and relevance.
   */
  static buildOptimizedContext(
    sections: Array<{ title: string; content: string; priority: number }>,
    maxTokens: number = 4000
  ): string {
    // Sort by priority (higher = more important)
    const sorted = [...sections].sort((a, b) => b.priority - a.priority);
    const parts: string[] = [];
    let usedTokens = 0;
    const tokenBudget = maxTokens;

    for (const section of sorted) {
      const sectionTokens = Math.ceil(section.content.length / 4);
      if (usedTokens + sectionTokens > tokenBudget) {
        // Truncate this section to fit
        const remaining = tokenBudget - usedTokens;
        if (remaining > 100) {
          parts.push('## ' + section.title);
          parts.push(ContextOptimizer.truncateToTokens(section.content, remaining));
        }
        break;
      }
      parts.push('## ' + section.title);
      parts.push(section.content);
      usedTokens += sectionTokens;
    }

    return parts.join('\n\n');
  }
}
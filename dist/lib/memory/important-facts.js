"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ImportantFacts = void 0;
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const path = __importStar(require("path"));
const embedder_js_1 = require("./embedder.js");
class ImportantFacts {
    db;
    constructor(dataDir) {
        const dbPath = path.join(dataDir, 'important-facts.db');
        this.db = new better_sqlite3_1.default(dbPath);
        this.init();
    }
    init() {
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
    async add(fact) {
        const id = `fact_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
        const timestamp = Date.now();
        // Create embedding
        const embedding = await (0, embedder_js_1.embed)(fact.fact);
        const stmt = this.db.prepare(`
      INSERT INTO important_facts (id, fact, category, importance, timestamp, lastUsed, useCount, embedding)
      VALUES (?, ?, ?, ?, ?, ?, 0, ?)
    `);
        stmt.run(id, fact.fact, fact.category, fact.importance, timestamp, fact.lastUsed ?? null, Buffer.from(new Float32Array(embedding).buffer));
        return id;
    }
    async search(query, options = {}) {
        const { minImportance, limit = 10 } = options;
        const queryEmbedding = await (0, embedder_js_1.embed)(query);
        let sql = 'SELECT * FROM important_facts WHERE embedding IS NOT NULL';
        const params = [];
        if (minImportance) {
            const importanceLevels = ['low', 'medium', 'high', 'critical'];
            const minIndex = importanceLevels.indexOf(minImportance);
            const allowedLevels = importanceLevels.slice(minIndex);
            sql += ` AND importance IN (${allowedLevels.map(() => '?').join(',')})`;
            params.push(...allowedLevels);
        }
        const rows = this.db.prepare(sql).all(...params);
        // Calculate similarity
        const results = rows.map((row) => {
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
    list(options = {}) {
        const { category, importance, limit = 20 } = options;
        let sql = 'SELECT * FROM important_facts WHERE 1=1';
        const params = [];
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
        const rows = this.db.prepare(sql).all(...params);
        return rows.map(this.rowToFact);
    }
    getTopFacts(limit = 5) {
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
    `).all(limit);
        return rows.map(this.rowToFact);
    }
    update(id, updates) {
        const fields = [];
        const params = [];
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
    delete(id) {
        this.db.prepare('DELETE FROM important_facts WHERE id = ?').run(id);
    }
    cosineSimilarity(a, b) {
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
    rowToFact(row) {
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
    stats() {
        const total = this.db.prepare('SELECT COUNT(*) as count FROM important_facts').get();
        const byCategory = this.db.prepare(`
      SELECT category, COUNT(*) as count
      FROM important_facts
      GROUP BY category
    `).all();
        const byImportance = this.db.prepare(`
      SELECT importance, COUNT(*) as count
      FROM important_facts
      GROUP BY importance
    `).all();
        return {
            totalFacts: total.count,
            byCategory: Object.fromEntries(byCategory.map((r) => [r.category, r.count])),
            byImportance: Object.fromEntries(byImportance.map((r) => [r.importance, r.count])),
        };
    }
    close() {
        this.db.close();
    }
}
exports.ImportantFacts = ImportantFacts;
//# sourceMappingURL=important-facts.js.map
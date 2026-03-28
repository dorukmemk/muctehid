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
exports.TimelineMemory = void 0;
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const path = __importStar(require("path"));
class TimelineMemory {
    db;
    constructor(dataDir) {
        const dbPath = path.join(dataDir, 'timeline.db');
        this.db = new better_sqlite3_1.default(dbPath);
        this.init();
    }
    init() {
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
    async add(event) {
        const id = `evt_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
        const timestamp = Date.now();
        const stmt = this.db.prepare(`
      INSERT INTO timeline_events (id, timestamp, action, context, files, outcome, tags, embedding)
      VALUES (?, ?, ?, ?, ?, ?, ?, NULL)
    `);
        stmt.run(id, timestamp, event.action, event.context ?? null, event.files ? JSON.stringify(event.files) : null, event.outcome, event.tags ? JSON.stringify(event.tags) : null);
        return id;
    }
    async search(options) {
        const { query, timeRange = 'all', tags, outcome, limit = 10, } = options;
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
        const params = [minTimestamp];
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
        const rows = this.db.prepare(sql).all(...params);
        return rows.map(this.rowToEvent);
    }
    async recent(limit = 10) {
        const rows = this.db.prepare(`
      SELECT * FROM timeline_events
      ORDER BY timestamp DESC
      LIMIT ?
    `).all(limit);
        return rows.map(this.rowToEvent);
    }
    async getByFile(filepath, limit = 5) {
        const rows = this.db.prepare(`
      SELECT * FROM timeline_events
      WHERE files LIKE ?
      ORDER BY timestamp DESC
      LIMIT ?
    `).all(`%"${filepath}"%`, limit);
        return rows.map(this.rowToEvent);
    }
    vectorSearch(queryEmbedding, options) {
        let sql = 'SELECT * FROM timeline_events WHERE timestamp >= ? AND embedding IS NOT NULL';
        const params = [options.minTimestamp];
        if (options.outcome) {
            sql += ' AND outcome = ?';
            params.push(options.outcome);
        }
        if (options.tags && options.tags.length > 0) {
            const tagConditions = options.tags.map(() => 'tags LIKE ?').join(' OR ');
            sql += ` AND (${tagConditions})`;
            options.tags.forEach(tag => params.push(`%"${tag}"%`));
        }
        const rows = this.db.prepare(sql).all(...params);
        // Calculate cosine similarity
        const results = rows.map((row) => {
            const embedding = new Float32Array(row.embedding.buffer);
            const similarity = this.cosineSimilarity(queryEmbedding, Array.from(embedding));
            return { ...row, similarity };
        });
        // Sort by similarity and return top N
        results.sort((a, b) => b.similarity - a.similarity);
        return results.slice(0, options.limit).map(this.rowToEvent);
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
    rowToEvent(row) {
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
    stats() {
        const now = Date.now();
        const total = this.db.prepare('SELECT COUNT(*) as count FROM timeline_events').get();
        const last24h = this.db.prepare('SELECT COUNT(*) as count FROM timeline_events WHERE timestamp >= ?').get(now - 24 * 60 * 60 * 1000);
        const last7days = this.db.prepare('SELECT COUNT(*) as count FROM timeline_events WHERE timestamp >= ?').get(now - 7 * 24 * 60 * 60 * 1000);
        return {
            totalEvents: total.count,
            last24h: last24h.count,
            last7days: last7days.count,
        };
    }
    close() {
        this.db.close();
    }
}
exports.TimelineMemory = TimelineMemory;
//# sourceMappingURL=timeline-memory.js.map
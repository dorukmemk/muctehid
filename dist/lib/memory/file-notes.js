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
exports.FileNotes = void 0;
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const path = __importStar(require("path"));
const embedder_js_1 = require("./embedder.js");
class FileNotes {
    db;
    constructor(dataDir) {
        const dbPath = path.join(dataDir, 'file-notes.db');
        this.db = new better_sqlite3_1.default(dbPath);
        this.init();
    }
    init() {
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
    async add(note) {
        const id = `note_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
        const timestamp = Date.now();
        // Create embedding
        const embedding = await (0, embedder_js_1.embed)(note.note);
        const stmt = this.db.prepare(`
      INSERT INTO file_notes (id, filepath, note, category, timestamp, embedding)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
        stmt.run(id, note.filepath, note.note, note.category, timestamp, Buffer.from(new Float32Array(embedding).buffer));
        return id;
    }
    get(filepath) {
        const rows = this.db.prepare(`
      SELECT * FROM file_notes
      WHERE filepath = ?
      ORDER BY timestamp DESC
    `).all(filepath);
        return rows.map(this.rowToNote);
    }
    async search(query, limit = 10) {
        const queryEmbedding = await (0, embedder_js_1.embed)(query);
        const rows = this.db.prepare('SELECT * FROM file_notes WHERE embedding IS NOT NULL').all();
        // Calculate similarity
        const results = rows.map((row) => {
            const embedding = new Float32Array(row.embedding.buffer);
            const similarity = this.cosineSimilarity(queryEmbedding, Array.from(embedding));
            return { ...row, similarity };
        });
        // Sort and return top N
        results.sort((a, b) => b.similarity - a.similarity);
        return results.slice(0, limit).map(this.rowToNote);
    }
    getByCategory(category) {
        const rows = this.db.prepare(`
      SELECT * FROM file_notes
      WHERE category = ?
      ORDER BY timestamp DESC
    `).all(category);
        return rows.map(this.rowToNote);
    }
    delete(id) {
        this.db.prepare('DELETE FROM file_notes WHERE id = ?').run(id);
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
    rowToNote(row) {
        return {
            id: row.id,
            filepath: row.filepath,
            note: row.note,
            category: row.category,
            timestamp: row.timestamp,
        };
    }
    stats() {
        const total = this.db.prepare('SELECT COUNT(*) as count FROM file_notes').get();
        const byCategory = this.db.prepare(`
      SELECT category, COUNT(*) as count
      FROM file_notes
      GROUP BY category
    `).all();
        return {
            totalNotes: total.count,
            byCategory: Object.fromEntries(byCategory.map((r) => [r.category, r.count])),
        };
    }
    close() {
        this.db.close();
    }
}
exports.FileNotes = FileNotes;
//# sourceMappingURL=file-notes.js.map
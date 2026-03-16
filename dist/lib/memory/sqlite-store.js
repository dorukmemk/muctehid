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
exports.SQLiteStore = void 0;
exports.makeChunkId = makeChunkId;
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const crypto = __importStar(require("crypto"));
class SQLiteStore {
    db;
    constructor(dbPath) {
        fs.mkdirSync(path.dirname(dbPath), { recursive: true });
        this.db = new better_sqlite3_1.default(dbPath);
        this.init();
    }
    init() {
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
    upsert(chunk) {
        const existing = this.db.prepare('SELECT id FROM chunks WHERE id = ?').get(chunk.id);
        if (existing) {
            this.db.prepare(`
        UPDATE chunks SET filepath=?, content=?, start_line=?, end_line=?,
        language=?, symbols=?, size=?, last_modified=?, git_author=? WHERE id=?
      `).run(chunk.filepath, chunk.content, chunk.startLine, chunk.endLine, chunk.language, JSON.stringify(chunk.symbols), chunk.metadata.size, chunk.metadata.lastModified, chunk.metadata.gitAuthor ?? null, chunk.id);
        }
        else {
            this.db.prepare(`
        INSERT INTO chunks (id, filepath, content, start_line, end_line, language, symbols, size, last_modified, git_author)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(chunk.id, chunk.filepath, chunk.content, chunk.startLine, chunk.endLine, chunk.language, JSON.stringify(chunk.symbols), chunk.metadata.size, chunk.metadata.lastModified, chunk.metadata.gitAuthor ?? null);
        }
    }
    delete(id) {
        this.db.prepare('DELETE FROM chunks WHERE id = ?').run(id);
    }
    deleteByFilepath(filepath) {
        this.db.prepare('DELETE FROM chunks WHERE filepath = ?').run(filepath);
    }
    clear() {
        this.db.exec('DELETE FROM chunks');
    }
    getById(id) {
        const row = this.db.prepare('SELECT * FROM chunks WHERE id = ?').get(id);
        return row ? this.rowToChunk(row) : null;
    }
    bm25Search(query, k, language) {
        try {
            const ftsQuery = query.replace(/[^\w\s]/g, ' ').trim().split(/\s+/).filter(Boolean).join(' OR ');
            if (!ftsQuery)
                return [];
            let sql = `
        SELECT c.id, bm25(chunks_fts) as rank
        FROM chunks_fts
        JOIN chunks c ON c.id = chunks_fts.id
        WHERE chunks_fts MATCH ?
      `;
            const params = [ftsQuery];
            if (language) {
                sql += ' AND c.language = ?';
                params.push(language);
            }
            sql += ' ORDER BY rank LIMIT ?';
            params.push(k);
            return this.db.prepare(sql).all(...params);
        }
        catch {
            return [];
        }
    }
    getChunksByIds(ids) {
        if (ids.length === 0)
            return [];
        const placeholders = ids.map(() => '?').join(',');
        const rows = this.db.prepare(`SELECT * FROM chunks WHERE id IN (${placeholders})`).all(...ids);
        return rows.map(r => this.rowToChunk(r));
    }
    getFileMeta(filepath) {
        const row = this.db.prepare('SELECT MAX(last_modified) as lm FROM chunks WHERE filepath = ?').get(filepath);
        return (row && row.lm) ? { lastModified: row.lm } : null;
    }
    stats() {
        const chunks = this.db.prepare('SELECT COUNT(*) as cnt FROM chunks').get().cnt;
        const files = this.db.prepare('SELECT COUNT(DISTINCT filepath) as cnt FROM chunks').get().cnt;
        return { chunks, files, dbSize: 0 };
    }
    rowToChunk(row) {
        return {
            id: row.id,
            filepath: row.filepath,
            content: row.content,
            startLine: row.start_line,
            endLine: row.end_line,
            language: row.language,
            symbols: JSON.parse(row.symbols || '[]'),
            metadata: {
                size: row.size,
                lastModified: row.last_modified,
                gitAuthor: row.git_author,
            },
        };
    }
    close() {
        this.db.close();
    }
}
exports.SQLiteStore = SQLiteStore;
function makeChunkId(filepath, startLine) {
    return crypto.createHash('sha256').update(`${filepath}:${startLine}`).digest('hex').slice(0, 16);
}
//# sourceMappingURL=sqlite-store.js.map
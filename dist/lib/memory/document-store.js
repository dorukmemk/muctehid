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
Object.defineProperty(exports, "__esModule", { value: true });
exports.DocumentStore = void 0;
const crypto = __importStar(require("crypto"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const DOC_EXTENSIONS = new Set(['.md', '.txt', '.rst', '.adoc', '.org']);
const DOC_TYPE_MAP = {
    'readme': 'readme', 'changelog': 'changelog', 'changes': 'changelog',
    'requirements': 'requirements', 'design': 'design', 'spec': 'spec',
    'tasks': 'tasks',
};
class DocumentStore {
    db;
    constructor(db) {
        this.db = db;
        this.init();
    }
    init() {
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
    upsert(filepath) {
        if (!DOC_EXTENSIONS.has(path.extname(filepath).toLowerCase()))
            return null;
        let content;
        let stat;
        try {
            content = fs.readFileSync(filepath, 'utf-8');
            stat = fs.statSync(filepath);
        }
        catch {
            return null;
        }
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
        }
        else {
            this.db.prepare(`
        INSERT INTO documents (id, filepath, title, doc_type, content, word_count, indexed_at, last_modified, tags)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, '[]')
      `).run(id, filepath, title, docType, content, wordCount, now, stat.mtimeMs);
        }
        return this.getByFilepath(filepath);
    }
    search(query, k = 10) {
        try {
            const ftsQuery = query.replace(/[^\w\s]/g, ' ').trim().split(/\s+/).filter(Boolean).join(' OR ');
            if (!ftsQuery)
                return [];
            const rows = this.db.prepare(`
        SELECT d.* FROM documents_fts
        JOIN documents d ON d.id = documents_fts.id
        WHERE documents_fts MATCH ?
        ORDER BY bm25(documents_fts) LIMIT ?
      `).all(ftsQuery, k);
            return rows.map(r => this.rowToDoc(r));
        }
        catch {
            return [];
        }
    }
    getByFilepath(filepath) {
        const row = this.db.prepare('SELECT * FROM documents WHERE filepath = ?').get(filepath);
        return row ? this.rowToDoc(row) : null;
    }
    getById(id) {
        const row = this.db.prepare('SELECT * FROM documents WHERE id = ?').get(id);
        return row ? this.rowToDoc(row) : null;
    }
    list(docType) {
        const rows = docType
            ? this.db.prepare('SELECT * FROM documents WHERE doc_type = ? ORDER BY last_modified DESC').all(docType)
            : this.db.prepare('SELECT * FROM documents ORDER BY last_modified DESC').all();
        return rows.map(r => this.rowToDoc(r));
    }
    delete(filepath) {
        this.db.prepare('DELETE FROM documents WHERE filepath = ?').run(filepath);
    }
    updateSummary(id, summary) {
        this.db.prepare('UPDATE documents SET summary = ? WHERE id = ?').run(summary, id);
    }
    stats() {
        const total = this.db.prepare('SELECT COUNT(*) as cnt FROM documents').get().cnt;
        const totalWords = this.db.prepare('SELECT SUM(word_count) as s FROM documents').get().s ?? 0;
        const byType = {};
        const rows = this.db.prepare('SELECT doc_type, COUNT(*) as cnt FROM documents GROUP BY doc_type').all();
        for (const r of rows)
            byType[r.doc_type] = r.cnt;
        return { total, byType, totalWords };
    }
    extractTitle(content) {
        const match = /^#\s+(.+)$/m.exec(content);
        return match ? match[1].trim() : null;
    }
    detectDocType(filepath) {
        const base = path.basename(filepath).toLowerCase().replace(/\.[^.]+$/, '');
        for (const [key, type] of Object.entries(DOC_TYPE_MAP)) {
            if (base.includes(key))
                return type;
        }
        return 'other';
    }
    rowToDoc(row) {
        return {
            id: row.id,
            filepath: row.filepath,
            title: row.title,
            docType: row.doc_type,
            content: row.content,
            summary: row.summary,
            wordCount: row.word_count,
            indexedAt: row.indexed_at,
            lastModified: row.last_modified,
            tags: JSON.parse(row.tags || '[]'),
        };
    }
    static isDocFile(filepath) {
        return DOC_EXTENSIONS.has(path.extname(filepath).toLowerCase());
    }
}
exports.DocumentStore = DocumentStore;
//# sourceMappingURL=document-store.js.map
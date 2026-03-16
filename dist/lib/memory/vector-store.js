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
exports.VectorStore = void 0;
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
// SQLite-backed vector store with in-memory cache for fast cosine similarity search.
// Replaces the JSON file approach: no full file rewrite on every upsert, 4x less RAM
// (Float32Array vs number[]), and WAL mode for concurrent write performance.
class VectorStore {
    db;
    cache = new Map();
    constructor(dataDir) {
        fs.mkdirSync(dataDir, { recursive: true });
        this.db = new better_sqlite3_1.default(path.join(dataDir, 'vectors.db'));
        this.db.pragma('journal_mode = WAL');
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS vectors (
        id TEXT PRIMARY KEY,
        vector BLOB NOT NULL,
        metadata TEXT NOT NULL DEFAULT '{}'
      )
    `);
        this.loadCache();
    }
    loadCache() {
        // Load all vectors into memory on startup — acceptable because cosine similarity
        // requires a full scan anyway, and Float32Array keeps the footprint small.
        const rows = this.db
            .prepare('SELECT id, vector, metadata FROM vectors')
            .all();
        for (const row of rows) {
            this.cache.set(row.id, {
                id: row.id,
                vector: new Float32Array(row.vector.buffer, row.vector.byteOffset, row.vector.byteLength / 4),
                metadata: JSON.parse(row.metadata),
            });
        }
    }
    upsert(id, vector, metadata = {}) {
        const f32 = new Float32Array(vector);
        const buf = Buffer.from(f32.buffer);
        this.db
            .prepare('INSERT OR REPLACE INTO vectors (id, vector, metadata) VALUES (?, ?, ?)')
            .run(id, buf, JSON.stringify(metadata));
        this.cache.set(id, { id, vector: f32, metadata });
    }
    delete(id) {
        this.db.prepare('DELETE FROM vectors WHERE id = ?').run(id);
        this.cache.delete(id);
    }
    clear() {
        this.db.exec('DELETE FROM vectors');
        this.cache.clear();
    }
    search(queryVector, k, filter) {
        const qf32 = new Float32Array(queryVector);
        const results = [];
        for (const entry of this.cache.values()) {
            if (filter) {
                let match = true;
                for (const [key, val] of Object.entries(filter)) {
                    if (entry.metadata[key] !== val) {
                        match = false;
                        break;
                    }
                }
                if (!match)
                    continue;
            }
            const score = cosineSimilarity(qf32, entry.vector);
            results.push({ id: entry.id, score });
        }
        results.sort((a, b) => b.score - a.score);
        return results.slice(0, k);
    }
    has(id) {
        return this.cache.has(id);
    }
    size() {
        return this.cache.size;
    }
    close() {
        this.db.close();
    }
}
exports.VectorStore = VectorStore;
function cosineSimilarity(a, b) {
    if (a.length !== b.length)
        return 0;
    let dot = 0, normA = 0, normB = 0;
    for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
    }
    if (normA === 0 || normB === 0)
        return 0;
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}
//# sourceMappingURL=vector-store.js.map
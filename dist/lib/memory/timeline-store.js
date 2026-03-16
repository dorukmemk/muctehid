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
exports.TimelineStore = void 0;
const crypto = __importStar(require("crypto"));
class TimelineStore {
    db;
    constructor(db) {
        this.db = db;
        this.init();
    }
    init() {
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS chunk_timeline (
        id TEXT PRIMARY KEY,
        chunk_id TEXT NOT NULL,
        event TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        metadata TEXT
      );
      CREATE INDEX IF NOT EXISTS chunk_timeline_chunk_id ON chunk_timeline(chunk_id);
      CREATE INDEX IF NOT EXISTS chunk_timeline_timestamp ON chunk_timeline(timestamp);
    `);
    }
    record(chunkId, event, metadata) {
        this.db.prepare(`
      INSERT INTO chunk_timeline (id, chunk_id, event, timestamp, metadata)
      VALUES (?, ?, ?, ?, ?)
    `).run(crypto.randomUUID(), chunkId, event, Date.now(), metadata ? JSON.stringify(metadata) : null);
    }
    getHistory(chunkId) {
        const rows = this.db.prepare('SELECT * FROM chunk_timeline WHERE chunk_id = ? ORDER BY timestamp ASC').all(chunkId);
        return rows.map(r => this.rowToEntry(r));
    }
    getRecentChanges(since, limit = 50) {
        const rows = this.db.prepare('SELECT * FROM chunk_timeline WHERE timestamp > ? ORDER BY timestamp DESC LIMIT ?').all(since, limit);
        return rows.map(r => this.rowToEntry(r));
    }
    getAccessPattern(chunkId) {
        const rows = this.db.prepare('SELECT event, timestamp FROM chunk_timeline WHERE chunk_id = ? ORDER BY timestamp ASC').all(chunkId);
        const accesses = rows.filter(r => r.event === 'accessed').length;
        const indexed = rows.find(r => r.event === 'indexed');
        const last = rows.filter(r => r.event === 'accessed').at(-1);
        return {
            totalAccesses: accesses,
            lastAccess: last?.timestamp ?? 0,
            firstIndexed: indexed?.timestamp ?? 0,
        };
    }
    rowToEntry(row) {
        return {
            id: row.id,
            chunkId: row.chunk_id,
            event: row.event,
            timestamp: row.timestamp,
            metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
        };
    }
}
exports.TimelineStore = TimelineStore;
//# sourceMappingURL=timeline-store.js.map
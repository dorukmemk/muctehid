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
exports.GraphStore = void 0;
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
class GraphStore {
    db;
    dbPath;
    constructor(dataDir) {
        this.dbPath = path.join(dataDir, 'graph.db');
        const dbDir = path.dirname(this.dbPath);
        if (!fs.existsSync(dbDir)) {
            fs.mkdirSync(dbDir, { recursive: true });
        }
        this.db = new better_sqlite3_1.default(this.dbPath);
    }
    async init() {
        // Create symbols table
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS symbols (
        uid TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        kind TEXT NOT NULL,
        filepath TEXT NOT NULL,
        startLine INTEGER NOT NULL,
        endLine INTEGER NOT NULL,
        complexity INTEGER DEFAULT 0
      )
    `);
        // Create relations table
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS relations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        fromUid TEXT NOT NULL,
        toUid TEXT NOT NULL,
        type TEXT NOT NULL,
        confidence REAL DEFAULT 1.0,
        FOREIGN KEY (fromUid) REFERENCES symbols(uid),
        FOREIGN KEY (toUid) REFERENCES symbols(uid)
      )
    `);
        // Create communities table
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS communities (
        id TEXT PRIMARY KEY,
        heuristicLabel TEXT NOT NULL,
        cohesion REAL NOT NULL,
        memberCount INTEGER NOT NULL
      )
    `);
        // Create symbol_community junction table
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS symbol_community (
        symbolUid TEXT NOT NULL,
        communityId TEXT NOT NULL,
        PRIMARY KEY (symbolUid, communityId),
        FOREIGN KEY (symbolUid) REFERENCES symbols(uid),
        FOREIGN KEY (communityId) REFERENCES communities(id)
      )
    `);
        // Create indexes
        this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_symbols_name ON symbols(name);
      CREATE INDEX IF NOT EXISTS idx_relations_from ON relations(fromUid);
      CREATE INDEX IF NOT EXISTS idx_relations_to ON relations(toUid);
      CREATE INDEX IF NOT EXISTS idx_relations_type ON relations(type);
    `);
    }
    async createSymbol(data) {
        const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO symbols (uid, name, kind, filepath, startLine, endLine, complexity)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
        stmt.run(data.uid, data.name, data.kind, data.filepath, data.startLine, data.endLine, data.complexity ?? 0);
    }
    async createRelation(from, to, type, confidence = 1.0) {
        // Check if both symbols exist first
        const fromExists = this.db.prepare('SELECT 1 FROM symbols WHERE uid = ?').get(from);
        const toExists = this.db.prepare('SELECT 1 FROM symbols WHERE uid = ?').get(to);
        if (!fromExists || !toExists) {
            return false;
        }
        // Check for duplicate
        const existing = this.db.prepare('SELECT 1 FROM relations WHERE fromUid = ? AND toUid = ? AND type = ?').get(from, to, type);
        if (existing) {
            // Update confidence if higher
            this.db.prepare('UPDATE relations SET confidence = MAX(confidence, ?) WHERE fromUid = ? AND toUid = ? AND type = ?').run(confidence, from, to, type);
            return false; // not a new relation
        }
        try {
            this.db.prepare('INSERT INTO relations (fromUid, toUid, type, confidence) VALUES (?, ?, ?, ?)').run(from, to, type, confidence);
            return true;
        }
        catch (error) {
            console.warn(`[GraphStore] Failed to create relation ${from} -> ${to}:`, error);
            return false;
        }
    }
    async getAllSymbols() {
        const rows = this.db.prepare('SELECT * FROM symbols').all();
        return rows.map((row) => ({
            uid: row.uid,
            name: row.name,
            kind: row.kind,
            filepath: row.filepath,
            startLine: row.startLine,
            endLine: row.endLine,
            complexity: row.complexity,
        }));
    }
    async createCommunity(data) {
        const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO communities (id, heuristicLabel, cohesion, memberCount)
      VALUES (?, ?, ?, ?)
    `);
        stmt.run(data.id, data.heuristicLabel, data.cohesion, data.memberCount);
    }
    async addToCommunity(symbolUid, communityId) {
        const stmt = this.db.prepare(`
      INSERT OR IGNORE INTO symbol_community (symbolUid, communityId)
      VALUES (?, ?)
    `);
        stmt.run(symbolUid, communityId);
    }
    async getSymbol(uid) {
        const stmt = this.db.prepare('SELECT * FROM symbols WHERE uid = ?');
        const row = stmt.get(uid);
        if (!row)
            return null;
        return {
            uid: row.uid,
            name: row.name,
            kind: row.kind,
            filepath: row.filepath,
            startLine: row.startLine,
            endLine: row.endLine,
            complexity: row.complexity,
        };
    }
    async findSymbolsByName(name) {
        // Exact match first
        const exact = this.db.prepare('SELECT * FROM symbols WHERE name = ?').all(name);
        if (exact.length > 0) {
            return exact.map(this.rowToSymbol);
        }
        // Case-insensitive match
        const caseInsensitive = this.db.prepare('SELECT * FROM symbols WHERE name = ? COLLATE NOCASE').all(name);
        if (caseInsensitive.length > 0) {
            return caseInsensitive.map(this.rowToSymbol);
        }
        // Partial match (name contains the search term)
        const partial = this.db.prepare('SELECT * FROM symbols WHERE name LIKE ? COLLATE NOCASE').all(`%${name}%`);
        return partial.map(this.rowToSymbol);
    }
    rowToSymbol(row) {
        return {
            uid: row.uid,
            name: row.name,
            kind: row.kind,
            filepath: row.filepath,
            startLine: row.startLine,
            endLine: row.endLine,
            complexity: row.complexity,
        };
    }
    async upstream(target, maxDepth = 3, minConfidence = 0.0) {
        const nodes = [];
        const relations = [];
        const visited = new Set();
        const queue = [{ uid: target, depth: 0 }];
        while (queue.length > 0) {
            const { uid, depth } = queue.shift();
            if (visited.has(uid) || depth > maxDepth)
                continue;
            visited.add(uid);
            // Find callers
            const stmt = this.db.prepare(`
        SELECT s.*, r.type, r.confidence
        FROM relations r
        JOIN symbols s ON r.fromUid = s.uid
        WHERE r.toUid = ? AND r.confidence >= ?
      `);
            const rows = stmt.all(uid, minConfidence);
            for (const row of rows) {
                const caller = {
                    uid: row.uid,
                    name: row.name,
                    kind: row.kind,
                    filepath: row.filepath,
                    startLine: row.startLine,
                    endLine: row.endLine,
                    complexity: row.complexity,
                };
                nodes.push(caller);
                relations.push({
                    from: row.uid,
                    to: uid,
                    type: row.type,
                    confidence: row.confidence,
                });
                if (depth < maxDepth) {
                    queue.push({ uid: row.uid, depth: depth + 1 });
                }
            }
        }
        return { nodes, relations, depth: maxDepth };
    }
    async downstream(target, maxDepth = 3) {
        const nodes = [];
        const relations = [];
        const visited = new Set();
        const queue = [{ uid: target, depth: 0 }];
        while (queue.length > 0) {
            const { uid, depth } = queue.shift();
            if (visited.has(uid) || depth > maxDepth)
                continue;
            visited.add(uid);
            // Find callees
            const stmt = this.db.prepare(`
        SELECT s.*, r.type, r.confidence
        FROM relations r
        JOIN symbols s ON r.toUid = s.uid
        WHERE r.fromUid = ?
      `);
            const rows = stmt.all(uid);
            for (const row of rows) {
                const callee = {
                    uid: row.uid,
                    name: row.name,
                    kind: row.kind,
                    filepath: row.filepath,
                    startLine: row.startLine,
                    endLine: row.endLine,
                    complexity: row.complexity,
                };
                nodes.push(callee);
                relations.push({
                    from: uid,
                    to: row.uid,
                    type: row.type,
                    confidence: row.confidence,
                });
                if (depth < maxDepth) {
                    queue.push({ uid: row.uid, depth: depth + 1 });
                }
            }
        }
        return { nodes, relations, depth: maxDepth };
    }
    async getContext(symbolUid) {
        const symbol = await this.getSymbol(symbolUid);
        if (!symbol)
            return { symbol: null, incoming: [], outgoing: [], community: null };
        // Incoming relations
        const incomingStmt = this.db.prepare(`
      SELECT fromUid, toUid, type, confidence
      FROM relations
      WHERE toUid = ?
    `);
        const incomingRows = incomingStmt.all(symbolUid);
        const incoming = incomingRows.map((row) => ({
            from: row.fromUid,
            to: row.toUid,
            type: row.type,
            confidence: row.confidence,
        }));
        // Outgoing relations
        const outgoingStmt = this.db.prepare(`
      SELECT fromUid, toUid, type, confidence
      FROM relations
      WHERE fromUid = ?
    `);
        const outgoingRows = outgoingStmt.all(symbolUid);
        const outgoing = outgoingRows.map((row) => ({
            from: row.fromUid,
            to: row.toUid,
            type: row.type,
            confidence: row.confidence,
        }));
        // Community
        const communityStmt = this.db.prepare(`
      SELECT c.*
      FROM communities c
      JOIN symbol_community sc ON c.id = sc.communityId
      WHERE sc.symbolUid = ?
      LIMIT 1
    `);
        const communityRow = communityStmt.get(symbolUid);
        const community = communityRow ? {
            id: communityRow.id,
            heuristicLabel: communityRow.heuristicLabel,
            cohesion: communityRow.cohesion,
            memberCount: communityRow.memberCount,
        } : null;
        return { symbol, incoming, outgoing, community };
    }
    async query(sql, params = []) {
        const stmt = this.db.prepare(sql);
        return stmt.all(...params);
    }
    async clear() {
        this.db.exec('DELETE FROM symbol_community');
        this.db.exec('DELETE FROM relations');
        this.db.exec('DELETE FROM communities');
        this.db.exec('DELETE FROM symbols');
    }
    async close() {
        this.db.close();
    }
    async stats() {
        const symbolsRow = this.db.prepare('SELECT COUNT(*) as count FROM symbols').get();
        const relationsRow = this.db.prepare('SELECT COUNT(*) as count FROM relations').get();
        const communitiesRow = this.db.prepare('SELECT COUNT(*) as count FROM communities').get();
        return {
            symbols: symbolsRow.count,
            relations: relationsRow.count,
            communities: communitiesRow.count,
        };
    }
}
exports.GraphStore = GraphStore;
//# sourceMappingURL=graph-store.js.map
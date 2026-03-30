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
            // Split query into words and match each word independently (AND logic)
            const words = query.trim().split(/\s+/).filter(w => w.length > 0);
            if (words.length === 1) {
                sql += ' AND (action LIKE ? OR context LIKE ?)';
                params.push(`%${words[0]}%`, `%${words[0]}%`);
            }
            else {
                // Each word must appear somewhere in action OR context
                const wordConditions = words.map(() => '(action LIKE ? OR context LIKE ?)').join(' AND ');
                sql += ` AND (${wordConditions})`;
                words.forEach(w => params.push(`%${w}%`, `%${w}%`));
            }
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
    // ── Memory Consolidation ────────────────────────────────────────────────
    /**
     * Consolidate old events: group similar events into summaries.
     * Keeps recent events (< olderThanDays) intact, consolidates older ones.
     */
    consolidate(olderThanDays = 7) {
        const cutoff = Date.now() - olderThanDays * 24 * 60 * 60 * 1000;
        // Group old events by file
        const oldEvents = this.db.prepare('SELECT * FROM timeline_events WHERE timestamp < ? ORDER BY timestamp ASC').all(cutoff);
        if (oldEvents.length < 5)
            return { consolidated: 0, removed: 0, summariesCreated: 0 };
        // Group by file
        const byFile = new Map();
        const noFile = [];
        for (const evt of oldEvents) {
            const files = evt.files ? JSON.parse(evt.files) : [];
            if (files.length > 0) {
                const key = files[0];
                if (!byFile.has(key))
                    byFile.set(key, []);
                byFile.get(key).push(evt);
            }
            else {
                noFile.push(evt);
            }
        }
        let removed = 0;
        let summariesCreated = 0;
        const deleteStmt = this.db.prepare('DELETE FROM timeline_events WHERE id = ?');
        const insertStmt = this.db.prepare('INSERT INTO timeline_events (id, timestamp, action, context, files, outcome, tags, embedding) VALUES (?, ?, ?, ?, ?, ?, ?, NULL)');
        // Consolidate per file
        for (const [file, events] of byFile) {
            if (events.length < 3)
                continue;
            const successes = events.filter((e) => e.outcome === 'success').length;
            const failures = events.filter((e) => e.outcome === 'failure').length;
            const actions = [...new Set(events.map((e) => e.action))].slice(0, 5);
            const allTags = [...new Set(events.flatMap((e) => e.tags ? JSON.parse(e.tags) : []))];
            const firstTs = events[0].timestamp;
            const lastTs = events[events.length - 1].timestamp;
            const summary = `[CONSOLIDATED] ${events.length} events on ${file}: ${actions.join('; ')}. Success: ${successes}, Failures: ${failures}`;
            const id = `cons_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
            // Delete old events
            for (const evt of events) {
                deleteStmt.run(evt.id);
                removed++;
            }
            // Insert summary
            insertStmt.run(id, lastTs, summary, `Consolidated from ${firstTs} to ${lastTs}`, JSON.stringify([file]), failures > successes ? 'partial' : 'success', allTags.length > 0 ? JSON.stringify(allTags) : null);
            summariesCreated++;
        }
        // Consolidate no-file events in batches of 10
        for (let i = 0; i < noFile.length - 2; i += 10) {
            const batch = noFile.slice(i, i + 10);
            if (batch.length < 3)
                continue;
            const actions = batch.map((e) => e.action).slice(0, 5);
            const summary = `[CONSOLIDATED] ${batch.length} misc events: ${actions.join('; ')}`;
            const id = `cons_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
            for (const evt of batch) {
                deleteStmt.run(evt.id);
                removed++;
            }
            insertStmt.run(id, batch[batch.length - 1].timestamp, summary, null, null, 'success', null);
            summariesCreated++;
        }
        return { consolidated: oldEvents.length, removed, summariesCreated };
    }
    // ── Memory Decay ────────────────────────────────────────────────────────
    /**
     * Archive/delete very old events that are unlikely to be useful.
     */
    decay(olderThanDays = 90) {
        const cutoff = Date.now() - olderThanDays * 24 * 60 * 60 * 1000;
        // Keep consolidated summaries and failures (they're valuable)
        // Delete only old success events that aren't consolidated
        const result = this.db.prepare(`DELETE FROM timeline_events 
       WHERE timestamp < ? 
       AND outcome = 'success' 
       AND action NOT LIKE '[CONSOLIDATED]%'`).run(cutoff);
        return { archived: 0, deleted: result.changes };
    }
    // ── Pattern Learning ────────────────────────────────────────────────────
    /**
     * Detect failure patterns: files that repeatedly cause failures.
     */
    detectFailurePatterns(minOccurrences = 2) {
        const failures = this.db.prepare(`SELECT * FROM timeline_events WHERE outcome = 'failure' ORDER BY timestamp DESC LIMIT 100`).all();
        const byFile = new Map();
        for (const evt of failures) {
            const files = evt.files ? JSON.parse(evt.files) : [];
            for (const f of files) {
                if (!byFile.has(f))
                    byFile.set(f, []);
                byFile.get(f).push(evt);
            }
        }
        const patterns = [];
        for (const [file, events] of byFile) {
            if (events.length >= minOccurrences) {
                const actions = [...new Set(events.map((e) => e.action))].slice(0, 3);
                patterns.push({
                    file,
                    failureCount: events.length,
                    lastFailure: events[0].timestamp,
                    commonActions: actions,
                });
            }
        }
        return patterns.sort((a, b) => b.failureCount - a.failureCount);
    }
    /**
     * Detect repeated action patterns (things done frequently).
     */
    detectFrequentPatterns(minOccurrences = 3) {
        // Normalize actions and count
        const events = this.db.prepare('SELECT action, outcome, files FROM timeline_events ORDER BY timestamp DESC LIMIT 200').all();
        const actionMap = new Map();
        for (const evt of events) {
            // Normalize: remove specific identifiers
            const normalized = evt.action.replace(/["'][^"']+["']/g, '<id>').replace(/\d+/g, '<n>');
            if (!actionMap.has(normalized)) {
                actionMap.set(normalized, { count: 0, successes: 0, failures: 0, files: new Set() });
            }
            const entry = actionMap.get(normalized);
            entry.count++;
            if (evt.outcome === 'success')
                entry.successes++;
            if (evt.outcome === 'failure')
                entry.failures++;
            const files = evt.files ? JSON.parse(evt.files) : [];
            for (const f of files)
                entry.files.add(f);
        }
        return [...actionMap.entries()]
            .filter(([, v]) => v.count >= minOccurrences)
            .map(([action, v]) => ({
            action,
            count: v.count,
            avgOutcome: v.successes > v.failures ? 'mostly success' : v.failures > v.successes ? 'mostly failure' : 'mixed',
            files: [...v.files].slice(0, 5),
        }))
            .sort((a, b) => b.count - a.count);
    }
    close() {
        this.db.close();
    }
}
exports.TimelineMemory = TimelineMemory;
//# sourceMappingURL=timeline-memory.js.map
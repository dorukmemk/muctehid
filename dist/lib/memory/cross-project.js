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
exports.ContextOptimizer = exports.CrossProjectMemory = void 0;
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
/**
 * Cross-Project Memory - Projeler arasi paylasilan bellek.
 * ~/.muctehid/global-memory.db konumunda saklanir.
 */
class CrossProjectMemory {
    db;
    constructor() {
        const globalDir = path.join(os.homedir(), '.muctehid');
        if (!fs.existsSync(globalDir))
            fs.mkdirSync(globalDir, { recursive: true });
        const dbPath = path.join(globalDir, 'global-memory.db');
        this.db = new better_sqlite3_1.default(dbPath);
        this.init();
    }
    init() {
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
    addPattern(pattern, description, category, project) {
        const id = 'gp_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
        this.db.prepare('INSERT INTO global_patterns (id, pattern, description, category, projectSource, timestamp) VALUES (?, ?, ?, ?, ?, ?)').run(id, pattern, description, category, project ?? null, Date.now());
        return id;
    }
    addLearning(learning, context, project) {
        const id = 'gl_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
        this.db.prepare('INSERT INTO global_learnings (id, learning, context, projectSource, timestamp) VALUES (?, ?, ?, ?, ?)').run(id, learning, context ?? null, project ?? null, Date.now());
        return id;
    }
    searchPatterns(query, limit = 5) {
        const rows = this.db.prepare('SELECT * FROM global_patterns WHERE pattern LIKE ? OR description LIKE ? ORDER BY useCount DESC, timestamp DESC LIMIT ?').all('%' + query + '%', '%' + query + '%', limit);
        // Update use count
        const upd = this.db.prepare('UPDATE global_patterns SET useCount = useCount + 1 WHERE id = ?');
        for (const r of rows)
            upd.run(r.id);
        return rows;
    }
    searchLearnings(query, limit = 5) {
        return this.db.prepare('SELECT * FROM global_learnings WHERE learning LIKE ? OR context LIKE ? ORDER BY timestamp DESC LIMIT ?').all('%' + query + '%', '%' + query + '%', limit);
    }
    getPatternsByCategory(category) {
        return this.db.prepare('SELECT pattern, description, useCount FROM global_patterns WHERE category = ? ORDER BY useCount DESC LIMIT 20').all(category);
    }
    stats() {
        const p = this.db.prepare('SELECT COUNT(*) as c FROM global_patterns').get();
        const l = this.db.prepare('SELECT COUNT(*) as c FROM global_learnings').get();
        return { patterns: p.c, learnings: l.c };
    }
    close() { this.db.close(); }
}
exports.CrossProjectMemory = CrossProjectMemory;
/**
 * Context Optimizer - LLM context window'unu verimli kullanma.
 * Relevance scoring ile sadece ilgili bilgileri dondurur.
 */
class ContextOptimizer {
    /**
     * Score relevance of a text to a query using keyword overlap.
     */
    static relevanceScore(text, query) {
        const queryTerms = query.toLowerCase().split(/\s+/).filter(t => t.length > 2);
        if (queryTerms.length === 0)
            return 0;
        const textLower = text.toLowerCase();
        let matches = 0;
        for (const term of queryTerms) {
            if (textLower.includes(term))
                matches++;
        }
        return matches / queryTerms.length;
    }
    /**
     * Filter and rank items by relevance, return only top N.
     */
    static filterByRelevance(items, getText, query, maxItems = 10, minScore = 0.1) {
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
    static truncateToTokens(text, maxTokens = 2000) {
        const maxChars = maxTokens * 4;
        if (text.length <= maxChars)
            return text;
        return text.substring(0, maxChars) + '\n... (truncated to fit context window)';
    }
    /**
     * Build an optimized context string from multiple sources.
     * Prioritizes by importance and relevance.
     */
    static buildOptimizedContext(sections, maxTokens = 4000) {
        // Sort by priority (higher = more important)
        const sorted = [...sections].sort((a, b) => b.priority - a.priority);
        const parts = [];
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
exports.ContextOptimizer = ContextOptimizer;
//# sourceMappingURL=cross-project.js.map
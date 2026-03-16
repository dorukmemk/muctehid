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
exports.CodeMemory = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const glob_1 = require("glob");
const ignore_1 = __importDefault(require("ignore"));
const sqlite_store_js_1 = require("./sqlite-store.js");
const vector_store_js_1 = require("./vector-store.js");
const embedder_js_1 = require("./embedder.js");
const chunker_js_1 = require("./chunker.js");
const hybrid_search_js_1 = require("./hybrid-search.js");
// ── Batch parallel embedding ──────────────────────────────────────────────────
const EMBED_CONCURRENCY = 8;
async function embedBatch(chunks, embedFn) {
    const results = new Array(chunks.length).fill(null);
    for (let i = 0; i < chunks.length; i += EMBED_CONCURRENCY) {
        const batch = chunks.slice(i, i + EMBED_CONCURRENCY);
        const vectors = await Promise.all(batch.map(c => embedFn(c.content.slice(0, 512)).catch(() => null)));
        for (let j = 0; j < vectors.length; j++) {
            results[i + j] = vectors[j];
        }
    }
    return results;
}
// ── Gitignore-based exclusion ─────────────────────────────────────────────────
function loadGitignore(repoRoot) {
    const ig = (0, ignore_1.default)();
    const gitignorePath = path.join(repoRoot, '.gitignore');
    if (fs.existsSync(gitignorePath)) {
        try {
            ig.add(fs.readFileSync(gitignorePath, 'utf-8'));
        }
        catch { /* skip */ }
    }
    // Always ignore these
    ig.add(['node_modules', 'dist', '.git', '.audit-data', '*.lock', '*.log']);
    return ig;
}
class CodeMemory {
    sqlite;
    vectors;
    dataDir;
    constructor(dataDir) {
        this.dataDir = dataDir;
        this.sqlite = new sqlite_store_js_1.SQLiteStore(path.join(dataDir, 'memory.db'));
        this.vectors = new vector_store_js_1.VectorStore(path.join(dataDir, 'vectors'));
    }
    static async open(dataDir) {
        fs.mkdirSync(dataDir, { recursive: true });
        return new CodeMemory(dataDir);
    }
    async indexDirectory(dirPath, opts = {}) {
        const exclude = opts.exclude ?? ['node_modules', 'dist', '.git', '.audit-data'];
        const chunkSize = opts.chunkSize ?? 150;
        const overlap = opts.overlap ?? 20;
        const mode = opts.mode ?? 'hybrid';
        // Load .gitignore rules (augmented with hard-coded excludes)
        const ig = loadGitignore(dirPath);
        const files = await (0, glob_1.glob)('**/*', {
            cwd: dirPath,
            nodir: true,
            absolute: true,
            ignore: exclude.map(p => `**/${p}/**`),
        });
        let indexed = 0, updated = 0, skipped = 0, errors = 0;
        for (const file of files) {
            // Check gitignore rules first, then fall back to shouldSkip for non-relative paths
            const relPath = path.relative(dirPath, file).replace(/\\/g, '/');
            if (ig.ignores(relPath)) {
                skipped++;
                continue;
            }
            try {
                const stat = fs.statSync(file);
                if (stat.size > 1_000_000) {
                    skipped++;
                    continue;
                } // skip files > 1MB
                const chunks = (0, chunker_js_1.chunkFile)(file, chunkSize, overlap);
                if (chunks.length === 0) {
                    skipped++;
                    continue;
                }
                // Incremental indexing: skip unchanged files
                const stored = this.sqlite.getFileMeta(file);
                if (stored && stored.lastModified >= stat.mtimeMs) {
                    skipped++;
                    continue;
                }
                // File is new or changed — delete old chunks before re-indexing
                const isUpdate = stored !== null;
                if (isUpdate) {
                    this.sqlite.deleteByFilepath(file);
                }
                // Upsert all chunks to SQLite first (BM25 works immediately)
                for (const raw of chunks) {
                    const id = (0, sqlite_store_js_1.makeChunkId)(raw.filepath, raw.startLine);
                    const chunk = {
                        id,
                        filepath: raw.filepath,
                        content: raw.content,
                        startLine: raw.startLine,
                        endLine: raw.endLine,
                        language: raw.language,
                        symbols: raw.symbols,
                        metadata: {
                            size: stat.size,
                            lastModified: stat.mtimeMs,
                        },
                    };
                    this.sqlite.upsert(chunk);
                }
                // Embed all chunks for this file in parallel (batches of EMBED_CONCURRENCY)
                if (mode !== 'bm25') {
                    const vectors = await embedBatch(chunks, embedder_js_1.embed);
                    for (let i = 0; i < chunks.length; i++) {
                        const vec = vectors[i];
                        if (vec !== null) {
                            const id = (0, sqlite_store_js_1.makeChunkId)(chunks[i].filepath, chunks[i].startLine);
                            this.vectors.upsert(id, vec, { language: chunks[i].language, filepath: chunks[i].filepath });
                        }
                    }
                }
                if (isUpdate) {
                    updated++;
                }
                else {
                    indexed++;
                }
            }
            catch {
                errors++;
            }
        }
        return { indexed, updated, skipped, errors };
    }
    async search(query, opts = {}) {
        return (0, hybrid_search_js_1.hybridSearch)(query, this.sqlite, this.vectors, opts);
    }
    async addChunk(data) {
        const id = (0, sqlite_store_js_1.makeChunkId)(data.filepath, data.startLine);
        const chunk = {
            id,
            filepath: data.filepath,
            content: data.content,
            startLine: data.startLine,
            endLine: data.endLine,
            language: data.language ?? 'text',
            symbols: data.symbols ?? [],
            metadata: {
                size: data.content.length,
                lastModified: Date.now(),
            },
        };
        this.sqlite.upsert(chunk);
        try {
            const vector = await (0, embedder_js_1.embed)(data.content);
            this.vectors.upsert(id, vector, { language: chunk.language });
        }
        catch { /* ok */ }
        return id;
    }
    delete(id) {
        this.sqlite.delete(id);
        this.vectors.delete(id);
    }
    deleteByFilepath(filepath) {
        this.sqlite.deleteByFilepath(filepath);
    }
    clear() {
        this.sqlite.clear();
        this.vectors.clear();
    }
    stats() {
        const { chunks, files, dbSize } = this.sqlite.stats();
        return {
            chunks,
            files,
            embeddingsReady: this.vectors.size() > 0,
            dbSize,
        };
    }
    close() {
        this.sqlite.close();
    }
}
exports.CodeMemory = CodeMemory;
//# sourceMappingURL=code-memory.js.map
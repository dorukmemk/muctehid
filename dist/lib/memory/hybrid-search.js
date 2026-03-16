"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.hybridSearch = hybridSearch;
const embedder_js_1 = require("./embedder.js");
const RRF_K = 60;
function highlightMatch(query, content, maxLen = 200) {
    const terms = query.toLowerCase().split(/\s+/).filter(t => t.length > 2);
    const lines = content.split('\n');
    // Find the line with most term matches
    let bestLine = '';
    let bestScore = 0;
    for (const line of lines) {
        const lower = line.toLowerCase();
        const score = terms.filter(t => lower.includes(t)).length;
        if (score > bestScore) {
            bestScore = score;
            bestLine = line.trim();
        }
    }
    if (!bestLine)
        return content.slice(0, maxLen);
    return bestLine.length > maxLen ? bestLine.slice(0, maxLen) + '...' : bestLine;
}
async function hybridSearch(query, sqliteStore, vectorStore, options = {}) {
    const k = options.k ?? 10;
    const mode = options.mode ?? 'hybrid';
    const language = options.filter?.language;
    if (mode === 'bm25') {
        return bm25Only(query, sqliteStore, k, language);
    }
    if (mode === 'vector') {
        return vectorOnly(query, vectorStore, sqliteStore, k, options.filter);
    }
    // Hybrid: RRF fusion
    const [bm25Results, vectorResults] = await Promise.all([
        bm25Only(query, sqliteStore, k * 2, language),
        vectorOnly(query, vectorStore, sqliteStore, k * 2, options.filter),
    ]);
    return rrfFusion(query, bm25Results, vectorResults, k);
}
async function bm25Only(query, store, k, language) {
    const raw = store.bm25Search(query, k, language);
    const chunks = store.getChunksByIds(raw.map(r => r.id));
    const chunkMap = new Map(chunks.map(c => [c.id, c]));
    return raw
        .filter(r => chunkMap.has(r.id))
        .map((r, idx) => ({
        chunk: chunkMap.get(r.id),
        score: 1 / (RRF_K + idx + 1),
        bm25Score: Math.abs(r.rank),
    }));
}
async function vectorOnly(query, vectorStore, sqliteStore, k, filter) {
    let queryVector;
    try {
        queryVector = await (0, embedder_js_1.embed)(query);
    }
    catch {
        return [];
    }
    const vectorFilter = {};
    if (filter?.language)
        vectorFilter.language = filter.language;
    const raw = vectorStore.search(queryVector, k, Object.keys(vectorFilter).length > 0 ? vectorFilter : undefined);
    const chunks = sqliteStore.getChunksByIds(raw.map(r => r.id));
    const chunkMap = new Map(chunks.map(c => [c.id, c]));
    return raw
        .filter(r => chunkMap.has(r.id))
        .map((r, idx) => ({
        chunk: chunkMap.get(r.id),
        score: 1 / (RRF_K + idx + 1),
        vectorScore: r.score,
    }));
}
function rrfFusion(query, bm25, vector, k) {
    const scoreMap = new Map();
    bm25.forEach((r, idx) => {
        scoreMap.set(r.chunk.id, { bm25Rank: idx, chunk: r.chunk, bm25Score: r.bm25Score });
    });
    vector.forEach((r, idx) => {
        const existing = scoreMap.get(r.chunk.id);
        if (existing) {
            existing.vectorRank = idx;
            existing.vectorScore = r.vectorScore;
        }
        else {
            scoreMap.set(r.chunk.id, { vectorRank: idx, chunk: r.chunk, vectorScore: r.vectorScore });
        }
    });
    const results = [];
    for (const [, entry] of scoreMap) {
        const bm25Score = entry.bm25Rank !== undefined ? 1 / (RRF_K + entry.bm25Rank + 1) : 0;
        const vecScore = entry.vectorRank !== undefined ? 1 / (RRF_K + entry.vectorRank + 1) : 0;
        results.push({
            chunk: entry.chunk,
            score: bm25Score + vecScore,
            bm25Score: entry.bm25Score,
            vectorScore: entry.vectorScore,
        });
    }
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, k).map(r => ({
        ...r,
        highlight: highlightMatch(query, r.chunk.content),
    }));
}
//# sourceMappingURL=hybrid-search.js.map
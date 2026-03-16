"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.optimizeContext = optimizeContext;
exports.estimateContextTokens = estimateContextTokens;
// ~4 chars per token heuristic
function estimateTokens(text) {
    return Math.ceil(text.length / 4);
}
function optimizeContext(chunks, docs, budget, accessCounts) {
    const available = budget.maxTokens - budget.reservedForResponse;
    let remaining = available;
    const selectedChunkIds = [];
    const selectedDocIds = [];
    let dropped = 0;
    // Rank chunks by combined score (relevance + freshness + access frequency)
    const rankedChunks = chunks.map(({ chunk, score }) => {
        const accesses = accessCounts?.get(chunk.id) ?? 0;
        const freshnessScore = Math.min(1.0, chunk.metadata.lastModified / Date.now());
        const accessScore = Math.min(1.0, accesses / 10);
        return {
            chunk,
            relevanceScore: score,
            freshnessScore,
            combinedScore: score * 0.6 + freshnessScore * 0.2 + accessScore * 0.2,
        };
    });
    rankedChunks.sort((a, b) => b.combinedScore - a.combinedScore);
    for (const { chunk } of rankedChunks) {
        const tokens = estimateTokens(chunk.content);
        if (tokens <= remaining) {
            selectedChunkIds.push(chunk.id);
            remaining -= tokens;
        }
        else {
            dropped++;
        }
    }
    // Rank docs by score
    const rankedDocs = docs.map(({ doc, score }) => ({
        doc,
        relevanceScore: score,
        combinedScore: score,
    }));
    rankedDocs.sort((a, b) => b.combinedScore - a.combinedScore);
    for (const { doc } of rankedDocs) {
        const tokens = estimateTokens(doc.content);
        if (tokens <= remaining) {
            selectedDocIds.push(doc.id);
            remaining -= tokens;
        }
        else {
            dropped++;
        }
    }
    const totalUsed = available - remaining;
    let summary;
    if (dropped > 0) {
        summary = `${dropped} chunk(s)/doc(s) omitted due to token budget (${totalUsed}/${available} tokens used).`;
    }
    return {
        chunkIds: selectedChunkIds,
        documentIds: selectedDocIds,
        totalTokensEstimated: totalUsed,
        dropped,
        summary,
    };
}
function estimateContextTokens(chunks, docs) {
    const chunkTokens = chunks.reduce((s, c) => s + estimateTokens(c.content), 0);
    const docTokens = docs.reduce((s, d) => s + estimateTokens(d.content), 0);
    return chunkTokens + docTokens;
}
//# sourceMappingURL=token-optimizer.js.map
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerResearchTools = registerResearchTools;
const types_js_1 = require("@modelcontextprotocol/sdk/types.js");
const research_engine_js_1 = require("../lib/research/research-engine.js");
const RESEARCH_TOOLS = ['research_topic', 'verify_claim'];
function registerResearchTools(server, deps) {
    // Bind the memory's search functions to ResearchEngine's expected signatures
    const searchFn = async (query, k) => {
        const results = await deps.memory.search(query, { k, mode: 'hybrid' });
        return results.map(r => ({
            id: r.chunk.id,
            content: r.chunk.content,
            filepath: r.chunk.filepath,
            score: r.score,
            language: r.chunk.language,
        }));
    };
    const docSearchFn = async (query, k) => {
        const results = await deps.memory.search(query, { k, mode: 'bm25' });
        return results.map(r => ({
            id: r.chunk.id,
            content: r.chunk.content,
            filepath: r.chunk.filepath,
            score: r.score,
        }));
    };
    const engine = new research_engine_js_1.ResearchEngine(searchFn, docSearchFn);
    server.setRequestHandler(types_js_1.CallToolRequestSchema, async (req) => {
        const { name, arguments: args = {} } = req.params;
        if (!RESEARCH_TOOLS.includes(name)) {
            throw new Error(`Unknown research tool: ${name}`);
        }
        try {
            if (name === 'research_topic') {
                const topic = args.topic;
                if (!topic)
                    throw new Error('topic is required');
                const depth = args.depth ?? 'standard';
                const opts = {
                    maxSources: depth === 'quick' ? 5 : depth === 'deep' ? 30 : 15,
                    includeCodebase: true,
                };
                const result = await engine.research(topic, opts);
                const text = `## Araştırma: ${result.topic}\n\n` +
                    `**Güven Skoru:** ${(result.confidence * 100).toFixed(0)}%\n` +
                    `**Kaynak Sayısı:** ${result.sourcesUsed.length}\n\n` +
                    `### Özet\n${result.synthesis}\n\n` +
                    `### Bulgular\n${result.findings.map(f => `- **${(f.confidence * 100).toFixed(0)}%** ${f.claim}\n  _Kaynak: ${f.source.label}_`).join('\n')}\n\n` +
                    (result.contradictions.length > 0
                        ? `### Çelişkiler\n${result.contradictions.map(c => `- ${c.description}`).join('\n')}\n\n`
                        : '') +
                    `### Güvenilirlik\n` +
                    `Doğrulanan: ${result.hallucinationReport.verifiedClaims.length} | ` +
                    `Doğrulanmamış: ${result.hallucinationReport.unverifiedClaims.length} | ` +
                    `Öneri: **${result.hallucinationReport.recommendation}**\n\n` +
                    (result.caveats.length > 0
                        ? `### Uyarılar\n${result.caveats.map(c => `- ${c}`).join('\n')}`
                        : '');
                return { content: [{ type: 'text', text }] };
            }
            if (name === 'verify_claim') {
                const claim = args.claim;
                if (!claim)
                    throw new Error('claim is required');
                // Research the claim as a topic and use hallucination report as verification
                const result = await engine.research(claim, { maxSources: 10, includeCodebase: true });
                const confidence = result.hallucinationReport.trustScore;
                const status = confidence > 0.7 ? 'Doğrulandı' : confidence > 0.4 ? 'Kısmen' : 'Doğrulanamadı';
                const text = `## İddia Doğrulama\n\n` +
                    `**İddia:** ${claim}\n` +
                    `**Sonuç:** ${status} (${(confidence * 100).toFixed(0)}%)\n\n` +
                    (result.findings.length > 0
                        ? `**Kanıtlar:**\n${result.findings.slice(0, 3).map(f => `- ${f.evidence.slice(0, 200)}`).join('\n')}`
                        : '**Kanıt bulunamadı.**');
                return { content: [{ type: 'text', text }] };
            }
            throw new Error(`Unhandled research tool: ${name}`);
        }
        catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            return { content: [{ type: 'text', text: `Hata: ${msg}` }], isError: true };
        }
    });
}
//# sourceMappingURL=research.js.map
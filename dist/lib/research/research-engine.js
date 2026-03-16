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
exports.ResearchEngine = void 0;
const crypto = __importStar(require("crypto"));
class ResearchEngine {
    searchFn;
    docSearchFn;
    constructor(searchFn, docSearchFn) {
        this.searchFn = searchFn;
        this.docSearchFn = docSearchFn;
    }
    async research(topic, opts = {}) {
        const maxSources = opts.maxSources ?? 15;
        // Decompose topic into sub-questions
        const subQuestions = decomposeQuery(topic);
        const allFindings = [];
        const allSources = [];
        // Search codebase
        if (opts.includeCodebase !== false) {
            for (const q of subQuestions) {
                const results = await this.searchFn(q, Math.ceil(maxSources / subQuestions.length));
                for (const r of results) {
                    const source = {
                        id: crypto.randomUUID().slice(0, 8),
                        type: 'codebase',
                        label: `${r.filepath} (${r.language})`,
                        filepath: r.filepath,
                        excerpt: r.content.slice(0, 300),
                        credibilityScore: 0.9, // codebase is high credibility
                    };
                    allSources.push(source);
                    allFindings.push({
                        id: crypto.randomUUID().slice(0, 8),
                        claim: `In ${r.filepath}: ${r.content.slice(0, 150)}`,
                        evidence: r.content.slice(0, 500),
                        source,
                        confidence: r.score,
                        corroborated: false,
                    });
                }
            }
        }
        // Search docs
        for (const q of subQuestions) {
            const docs = await this.docSearchFn(q, 5);
            for (const d of docs) {
                const source = {
                    id: crypto.randomUUID().slice(0, 8),
                    type: 'docs',
                    label: d.filepath,
                    filepath: d.filepath,
                    excerpt: d.content.slice(0, 300),
                    credibilityScore: 0.8,
                };
                allSources.push(source);
                allFindings.push({
                    id: crypto.randomUUID().slice(0, 8),
                    claim: d.content.slice(0, 150),
                    evidence: d.content.slice(0, 500),
                    source,
                    confidence: d.score,
                    corroborated: false,
                });
            }
        }
        // Mark corroborated findings (same claim from 2+ sources)
        markCorroborated(allFindings);
        // Detect contradictions
        const contradictions = detectContradictions(allFindings);
        // Synthesize
        const synthesis = synthesize(topic, allFindings);
        // Hallucination guard
        const hallucinationReport = checkHallucinations(synthesis, allFindings);
        const confidence = allFindings.length > 0
            ? allFindings.reduce((s, f) => s + f.confidence, 0) / allFindings.length
            : 0;
        const caveats = [];
        if (contradictions.length > 0)
            caveats.push(`${contradictions.length} contradiction(s) found in sources.`);
        if (hallucinationReport.unverifiedClaims.length > 0)
            caveats.push(`${hallucinationReport.unverifiedClaims.length} unverified claim(s) flagged.`);
        if (allFindings.length < 3)
            caveats.push('Limited evidence found — results may be incomplete.');
        return {
            id: crypto.randomUUID().slice(0, 8),
            topic,
            findings: allFindings,
            synthesis: hallucinationReport.flaggedText,
            confidence,
            sourcesUsed: allSources,
            contradictions,
            caveats,
            hallucinationReport,
            timestamp: Date.now(),
        };
    }
}
exports.ResearchEngine = ResearchEngine;
function decomposeQuery(topic) {
    const words = topic.split(/\s+/);
    if (words.length <= 5)
        return [topic];
    // Create 2-3 sub-queries covering different aspects
    const half = Math.ceil(words.length / 2);
    return [
        words.slice(0, half).join(' '),
        words.slice(half).join(' '),
        topic, // also search the full topic
    ];
}
function markCorroborated(findings) {
    for (let i = 0; i < findings.length; i++) {
        for (let j = i + 1; j < findings.length; j++) {
            if (findings[i].source.id === findings[j].source.id)
                continue;
            const similarity = roughSimilarity(findings[i].claim, findings[j].claim);
            if (similarity > 0.5) {
                findings[i].corroborated = true;
                findings[j].corroborated = true;
            }
        }
    }
}
function detectContradictions(findings) {
    const contradictions = [];
    for (let i = 0; i < findings.length; i++) {
        for (let j = i + 1; j < findings.length; j++) {
            if (findings[i].source.id === findings[j].source.id)
                continue;
            const sim = roughSimilarity(findings[i].claim, findings[j].claim);
            if (sim > 0.3 && sim < 0.6) {
                // Similar topic, potentially contradictory details
                contradictions.push({
                    finding1: findings[i],
                    finding2: findings[j],
                    description: `Potentially conflicting information about the same topic`,
                });
            }
        }
    }
    return contradictions.slice(0, 5);
}
function synthesize(topic, findings) {
    if (findings.length === 0)
        return `No relevant information found for: ${topic}`;
    const topFindings = findings
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, 5);
    let synthesis = `## Araştırma: ${topic}\n\n`;
    synthesis += `**Bulunan kanıt sayısı:** ${findings.length} | **Doğrulanan:** ${findings.filter(f => f.corroborated).length}\n\n`;
    synthesis += `### Özet Bulgular\n\n`;
    for (const f of topFindings) {
        synthesis += `- ${f.claim}\n`;
        synthesis += `  > *Kaynak: ${f.source.label}*\n\n`;
    }
    return synthesis;
}
function checkHallucinations(synthesis, findings) {
    const sentences = synthesis.split(/[.!?]\s+/).filter(s => s.length > 20);
    const verified = [];
    const unverified = [];
    const evidenceTexts = findings.map(f => f.evidence.toLowerCase());
    for (const sentence of sentences) {
        const lower = sentence.toLowerCase();
        const hasEvidence = evidenceTexts.some(e => roughSimilarity(lower, e.slice(0, 200)) > 0.3);
        if (hasEvidence)
            verified.push(sentence);
        else
            unverified.push(sentence);
    }
    const trustScore = sentences.length > 0 ? verified.length / sentences.length : 1;
    let flaggedText = synthesis;
    for (const u of unverified) {
        flaggedText = flaggedText.replace(u, `${u} [DOĞRULANMADI]`);
    }
    return {
        trustScore,
        verifiedClaims: verified,
        unverifiedClaims: unverified,
        flaggedText,
        recommendation: trustScore > 0.8 ? 'accept' : trustScore > 0.5 ? 'review' : 'reject',
    };
}
function roughSimilarity(a, b) {
    const wordsA = new Set(a.toLowerCase().split(/\W+/).filter(w => w.length > 3));
    const wordsB = new Set(b.toLowerCase().split(/\W+/).filter(w => w.length > 3));
    if (wordsA.size === 0 || wordsB.size === 0)
        return 0;
    let common = 0;
    for (const w of wordsA)
        if (wordsB.has(w))
            common++;
    return common / Math.max(wordsA.size, wordsB.size);
}
//# sourceMappingURL=research-engine.js.map
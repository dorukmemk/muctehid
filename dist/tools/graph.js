"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GraphTools = void 0;
const graph_store_js_1 = require("../lib/graph/graph-store.js");
const graph_builder_js_1 = require("../lib/graph/graph-builder.js");
const impact_analyzer_js_1 = require("../lib/graph/impact-analyzer.js");
class GraphTools {
    dataDir;
    store = null;
    builder = null;
    analyzer = null;
    constructor(dataDir) {
        this.dataDir = dataDir;
    }
    async init() {
        if (!this.store) {
            this.store = new graph_store_js_1.GraphStore(this.dataDir);
            await this.store.init();
            this.builder = new graph_builder_js_1.GraphBuilder(this.store);
            this.analyzer = new impact_analyzer_js_1.ImpactAnalyzer(this.store);
        }
    }
    async handleTool(name, args) {
        await this.init();
        switch (name) {
            case 'graph_build':
                return await this.buildGraph(args);
            case 'impact':
                return await this.impact(args);
            case 'graph_context':
                return await this.context(args);
            case 'graph_stats':
                return await this.stats();
            case 'graph_query':
                return await this.query(args);
            default:
                return `Unknown graph tool: ${name}`;
        }
    }
    async buildGraph(args) {
        const path = args.path;
        const extensions = args.extensions ?? ['.ts', '.tsx', '.js', '.jsx'];
        console.log(`[GraphTools] Building graph from ${path}...`);
        const stats = await this.builder.buildFromDirectory(path, extensions);
        return `## Graph Build Complete\n\n` +
            `- Files processed: ${stats.filesProcessed}\n` +
            `- Symbols created: ${stats.symbolsCreated}\n` +
            `- Relations created: ${stats.relationsCreated}\n` +
            `- Errors: ${stats.errors}\n\n` +
            `✅ Knowledge graph is ready! Use \`impact\`, \`graph_context\`, or \`graph_query\` to explore.`;
    }
    async impact(args) {
        const target = args.target;
        const direction = args.direction ?? 'upstream';
        const maxDepth = args.maxDepth ?? 3;
        const minConfidence = args.minConfidence ?? 0.0;
        // Find symbol by name
        const symbols = await this.store.findSymbolsByName(target);
        if (symbols.length === 0) {
            return `❌ Symbol not found: \`${target}\`\n\nTip: Make sure the graph is built first with \`graph_build\`.`;
        }
        // Use first match (or let user specify filepath)
        const targetSymbol = symbols[0];
        const report = await this.analyzer.analyze(targetSymbol.uid, direction, {
            maxDepth,
            minConfidence,
            includeTests: false,
        });
        return report.markdown;
    }
    async context(args) {
        const name = args.name;
        const filepath = args.filepath;
        // Find symbol
        let symbols = await this.store.findSymbolsByName(name);
        if (filepath) {
            symbols = symbols.filter(s => s.filepath.includes(filepath));
        }
        if (symbols.length === 0) {
            return `❌ Symbol not found: \`${name}\`${filepath ? ` in \`${filepath}\`` : ''}`;
        }
        const symbol = symbols[0];
        const context = await this.store.getContext(symbol.uid);
        const lines = [];
        lines.push(`## 360° Context: ${symbol.name}`);
        lines.push('');
        lines.push(`**Symbol:** \`${symbol.kind}\` \`${symbol.name}\``);
        lines.push(`**Location:** \`${symbol.filepath}:${symbol.startLine}-${symbol.endLine}\``);
        if (symbol.complexity) {
            lines.push(`**Complexity:** ${symbol.complexity}`);
        }
        lines.push('');
        // Incoming
        if (context.incoming.length > 0) {
            lines.push(`### Incoming (${context.incoming.length})`);
            lines.push('Who calls/imports this:');
            lines.push('');
            for (const rel of context.incoming.slice(0, 10)) {
                const fromSymbol = await this.store.getSymbol(rel.from);
                if (fromSymbol) {
                    const confidence = rel.confidence ? ` (${Math.round(rel.confidence * 100)}%)` : '';
                    lines.push(`- **${fromSymbol.name}** [${rel.type}${confidence}] \`${fromSymbol.filepath}:${fromSymbol.startLine}\``);
                }
            }
            if (context.incoming.length > 10) {
                lines.push(`  ... and ${context.incoming.length - 10} more`);
            }
            lines.push('');
        }
        // Outgoing
        if (context.outgoing.length > 0) {
            lines.push(`### Outgoing (${context.outgoing.length})`);
            lines.push('What this calls/imports:');
            lines.push('');
            for (const rel of context.outgoing.slice(0, 10)) {
                const toSymbol = await this.store.getSymbol(rel.to);
                if (toSymbol) {
                    const confidence = rel.confidence ? ` (${Math.round(rel.confidence * 100)}%)` : '';
                    lines.push(`- **${toSymbol.name}** [${rel.type}${confidence}] \`${toSymbol.filepath}:${toSymbol.startLine}\``);
                }
            }
            if (context.outgoing.length > 10) {
                lines.push(`  ... and ${context.outgoing.length - 10} more`);
            }
            lines.push('');
        }
        // Community
        if (context.community) {
            lines.push(`### Cluster`);
            lines.push(`**${context.community.heuristicLabel}** (cohesion: ${Math.round(context.community.cohesion * 100)}%, ${context.community.memberCount} members)`);
            lines.push('');
        }
        return lines.join('\n');
    }
    async stats() {
        const stats = await this.store.stats();
        return `## Graph Stats\n\n` +
            `- Symbols: ${stats.symbols}\n` +
            `- Relations: ${stats.relations}\n` +
            `- Communities: ${stats.communities}`;
    }
    async query(args) {
        const queryStr = args.query;
        // Translate common Cypher-like patterns to SQL for convenience
        const sql = this.translateQuery(queryStr);
        try {
            const results = await this.store.query(sql);
            if (results.length === 0) {
                return `## Query Results\n\nNo results found.\n\n**Tip:** Use \`graph_stats\` to verify the graph is built, or try:\n- \`SELECT name, kind, filepath FROM symbols LIMIT 20\`\n- \`SELECT s1.name as caller, s2.name as callee, r.type FROM relations r JOIN symbols s1 ON r.fromUid=s1.uid JOIN symbols s2 ON r.toUid=s2.uid LIMIT 20\``;
            }
            const truncated = results.slice(0, 50);
            return `## Query Results (${results.length} rows${results.length > 50 ? ', showing first 50' : ''})\n\n\`\`\`json\n${JSON.stringify(truncated, null, 2)}\n\`\`\``;
        }
        catch (error) {
            return `❌ Query error: ${error instanceof Error ? error.message : String(error)}\n\n**Note:** graph_query uses SQLite SQL syntax. Tables: \`symbols\`, \`relations\`, \`communities\`.\n\n**Examples:**\n- \`SELECT name, kind FROM symbols WHERE name LIKE '%User%'\`\n- \`SELECT s1.name as from_name, s2.name as to_name, r.type FROM relations r JOIN symbols s1 ON r.fromUid=s1.uid JOIN symbols s2 ON r.toUid=s2.uid\`\n- \`SELECT name, kind, filepath FROM symbols WHERE kind='Function' LIMIT 20\``;
        }
    }
    /**
     * Translate common Cypher-like patterns to SQL.
     * If it's already valid SQL, pass through.
     */
    translateQuery(query) {
        const q = query.trim();
        // If it starts with SELECT/INSERT/UPDATE/DELETE, it's already SQL
        if (/^(SELECT|INSERT|UPDATE|DELETE|WITH|PRAGMA)/i.test(q)) {
            return q;
        }
        // MATCH (fn:Function) RETURN fn → SELECT * FROM symbols WHERE kind='Function'
        const matchReturn = q.match(/^MATCH\s*\((\w+):(\w+)\)\s*RETURN\s+/i);
        if (matchReturn) {
            const kind = matchReturn[2];
            return `SELECT * FROM symbols WHERE kind='${kind}' LIMIT 50`;
        }
        // MATCH (fn)-[:CALLS]->(target) RETURN fn, target
        const matchRelation = q.match(/^MATCH\s*\(\w+\)\s*-\[:(\w+)\]->\s*\(\w+\)\s*RETURN/i);
        if (matchRelation) {
            const relType = matchRelation[1];
            return `SELECT s1.name as caller, s1.kind as caller_kind, s2.name as callee, s2.kind as callee_kind, r.confidence FROM relations r JOIN symbols s1 ON r.fromUid=s1.uid JOIN symbols s2 ON r.toUid=s2.uid WHERE r.type='${relType}' LIMIT 50`;
        }
        // MATCH (fn {name: "X"}) → SELECT * FROM symbols WHERE name='X'
        const matchName = q.match(/^MATCH\s*\(\w+\s*\{name:\s*["']([^"']+)["']\}\)/i);
        if (matchName) {
            return `SELECT * FROM symbols WHERE name='${matchName[1]}'`;
        }
        // Fallback: treat as SQL
        return q;
    }
    async close() {
        if (this.store) {
            await this.store.close();
        }
    }
}
exports.GraphTools = GraphTools;
//# sourceMappingURL=graph.js.map
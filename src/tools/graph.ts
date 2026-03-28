import { GraphStore } from '../lib/graph/graph-store.js';
import { GraphBuilder } from '../lib/graph/graph-builder.js';
import { ImpactAnalyzer } from '../lib/graph/impact-analyzer.js';

export class GraphTools {
  private store: GraphStore | null = null;
  private builder: GraphBuilder | null = null;
  private analyzer: ImpactAnalyzer | null = null;

  constructor(private dataDir: string) {}

  async init(): Promise<void> {
    if (!this.store) {
      this.store = new GraphStore(this.dataDir);
      await this.store.init();
      this.builder = new GraphBuilder(this.store);
      this.analyzer = new ImpactAnalyzer(this.store);
    }
  }

  async handleTool(name: string, args: Record<string, any>): Promise<string> {
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

  private async buildGraph(args: Record<string, any>): Promise<string> {
    const path = args.path as string;
    const extensions = (args.extensions as string[]) ?? ['.ts', '.tsx', '.js', '.jsx'];

    console.log(`[GraphTools] Building graph from ${path}...`);
    const stats = await this.builder!.buildFromDirectory(path, extensions);

    return `## Graph Build Complete\n\n` +
      `- Files processed: ${stats.filesProcessed}\n` +
      `- Symbols created: ${stats.symbolsCreated}\n` +
      `- Relations created: ${stats.relationsCreated}\n` +
      `- Errors: ${stats.errors}\n\n` +
      `✅ Knowledge graph is ready! Use \`impact\`, \`graph_context\`, or \`graph_query\` to explore.`;
  }

  private async impact(args: Record<string, any>): Promise<string> {
    const target = args.target as string;
    const direction = (args.direction as 'upstream' | 'downstream') ?? 'upstream';
    const maxDepth = (args.maxDepth as number) ?? 3;
    const minConfidence = (args.minConfidence as number) ?? 0.0;

    // Find symbol by name
    const symbols = await this.store!.findSymbolsByName(target);
    if (symbols.length === 0) {
      return `❌ Symbol not found: \`${target}\`\n\nTip: Make sure the graph is built first with \`graph_build\`.`;
    }

    // Use first match (or let user specify filepath)
    const targetSymbol = symbols[0];
    const report = await this.analyzer!.analyze(targetSymbol.uid, direction, {
      maxDepth,
      minConfidence,
      includeTests: false,
    });

    return report.markdown;
  }

  private async context(args: Record<string, any>): Promise<string> {
    const name = args.name as string;
    const filepath = args.filepath as string | undefined;

    // Find symbol
    let symbols = await this.store!.findSymbolsByName(name);
    if (filepath) {
      symbols = symbols.filter(s => s.filepath.includes(filepath));
    }

    if (symbols.length === 0) {
      return `❌ Symbol not found: \`${name}\`${filepath ? ` in \`${filepath}\`` : ''}`;
    }

    const symbol = symbols[0];
    const context = await this.store!.getContext(symbol.uid);

    const lines: string[] = [];
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
        const fromSymbol = await this.store!.getSymbol(rel.from);
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
        const toSymbol = await this.store!.getSymbol(rel.to);
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

  private async stats(): Promise<string> {
    const stats = await this.store!.stats();
    return `## Graph Stats\n\n` +
      `- Symbols: ${stats.symbols}\n` +
      `- Relations: ${stats.relations}\n` +
      `- Communities: ${stats.communities}`;
  }

  private async query(args: Record<string, any>): Promise<string> {
    const cypher = args.query as string;
    
    try {
      const results = await this.store!.query(cypher);
      return `## Query Results\n\n\`\`\`json\n${JSON.stringify(results, null, 2)}\n\`\`\``;
    } catch (error) {
      return `❌ Query error: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  async close(): Promise<void> {
    if (this.store) {
      await this.store.close();
    }
  }
}

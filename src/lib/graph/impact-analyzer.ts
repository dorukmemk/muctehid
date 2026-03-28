import { GraphStore, SymbolNode, Relation } from './graph-store.js';

export interface ImpactOptions {
  maxDepth?: number;
  minConfidence?: number;
  includeTests?: boolean;
}

export interface ImpactReport {
  target: SymbolNode | null;
  direction: 'upstream' | 'downstream';
  affectedSymbols: Array<{
    symbol: SymbolNode;
    depth: number;
    confidence: number;
    relationType: string;
  }>;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  summary: string;
  markdown: string;
}

export class ImpactAnalyzer {
  constructor(private store: GraphStore) {}

  async analyze(
    targetUid: string,
    direction: 'upstream' | 'downstream',
    options: ImpactOptions = {}
  ): Promise<ImpactReport> {
    const {
      maxDepth = 3,
      minConfidence = 0.0,
      includeTests = false,
    } = options;

    // Get target symbol
    const target = await this.store.getSymbol(targetUid);
    if (!target) {
      return {
        target: null,
        direction,
        affectedSymbols: [],
        riskLevel: 'LOW',
        summary: `Symbol not found: ${targetUid}`,
        markdown: `## Impact Analysis\n\n❌ Symbol not found: \`${targetUid}\``,
      };
    }

    // Traverse graph
    const traversalResult = direction === 'upstream'
      ? await this.store.upstream(targetUid, maxDepth, minConfidence)
      : await this.store.downstream(targetUid, maxDepth);

    // Group by depth
    const byDepth = new Map<number, SymbolNode[]>();
    for (const node of traversalResult.nodes) {
      // Filter out test files if needed
      if (!includeTests && this.isTestFile(node.filepath)) {
        continue;
      }

      // Find depth for this node
      const depth = this.findDepth(node.uid, targetUid, traversalResult.relations, direction);
      if (!byDepth.has(depth)) {
        byDepth.set(depth, []);
      }
      byDepth.get(depth)!.push(node);
    }

    // Build affected symbols list
    const affectedSymbols = traversalResult.nodes
      .filter(n => !includeTests ? !this.isTestFile(n.filepath) : true)
      .map(node => {
        const depth = this.findDepth(node.uid, targetUid, traversalResult.relations, direction);
        const relation = traversalResult.relations.find(r =>
          direction === 'upstream' ? r.to === targetUid || r.from === node.uid : r.from === targetUid || r.to === node.uid
        );
        return {
          symbol: node,
          depth,
          confidence: relation?.confidence ?? 0.5,
          relationType: relation?.type ?? 'UNKNOWN',
        };
      })
      .sort((a, b) => a.depth - b.depth || b.confidence - a.confidence);

    // Calculate risk level
    const riskLevel = this.calculateRisk(affectedSymbols, maxDepth);

    // Generate summary
    const summary = this.generateSummary(target, direction, affectedSymbols, riskLevel);

    // Generate markdown
    const markdown = this.generateMarkdown(target, direction, affectedSymbols, byDepth, riskLevel);

    return {
      target,
      direction,
      affectedSymbols,
      riskLevel,
      summary,
      markdown,
    };
  }

  private findDepth(
    nodeUid: string,
    targetUid: string,
    relations: Relation[],
    direction: 'upstream' | 'downstream'
  ): number {
    // BFS to find shortest path
    const queue: Array<{ uid: string; depth: number }> = [{ uid: direction === 'upstream' ? nodeUid : targetUid, depth: 0 }];
    const visited = new Set<string>();
    const endUid = direction === 'upstream' ? targetUid : nodeUid;

    while (queue.length > 0) {
      const { uid, depth } = queue.shift()!;
      if (uid === endUid) return depth;
      if (visited.has(uid)) continue;
      visited.add(uid);

      const neighbors = relations
        .filter(r => r.from === uid)
        .map(r => r.to);

      for (const neighbor of neighbors) {
        queue.push({ uid: neighbor, depth: depth + 1 });
      }
    }

    return 1; // Default depth
  }

  private calculateRisk(
    affectedSymbols: Array<{ symbol: SymbolNode; depth: number; confidence: number }>,
    maxDepth: number
  ): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    const directCallers = affectedSymbols.filter(a => a.depth === 1).length;
    const totalAffected = affectedSymbols.length;

    if (directCallers >= 10 || totalAffected >= 30) return 'CRITICAL';
    if (directCallers >= 5 || totalAffected >= 15) return 'HIGH';
    if (directCallers >= 2 || totalAffected >= 5) return 'MEDIUM';
    return 'LOW';
  }

  private generateSummary(
    target: SymbolNode,
    direction: string,
    affectedSymbols: Array<{ symbol: SymbolNode; depth: number }>,
    riskLevel: string
  ): string {
    const directCount = affectedSymbols.filter(a => a.depth === 1).length;
    const totalCount = affectedSymbols.length;

    return `${target.name} (${target.kind}) has ${directCount} direct ${direction === 'upstream' ? 'callers' : 'callees'} and ${totalCount} total affected symbols. Risk: ${riskLevel}`;
  }

  private generateMarkdown(
    target: SymbolNode,
    direction: string,
    affectedSymbols: Array<{ symbol: SymbolNode; depth: number; confidence: number; relationType: string }>,
    byDepth: Map<number, SymbolNode[]>,
    riskLevel: string
  ): string {
    const lines: string[] = [];

    lines.push(`## Impact Analysis: ${target.name}`);
    lines.push('');
    lines.push(`**Target:** \`${target.kind}\` \`${target.name}\` (\`${target.filepath}:${target.startLine}\`)`);
    lines.push(`**Direction:** ${direction === 'upstream' ? 'Upstream (what depends on this)' : 'Downstream (what this depends on)'}`);
    lines.push(`**Risk Level:** ${this.getRiskEmoji(riskLevel)} **${riskLevel}**`);
    lines.push('');

    if (affectedSymbols.length === 0) {
      lines.push('✅ No affected symbols found. Safe to modify.');
      return lines.join('\n');
    }

    lines.push(`**Total Affected:** ${affectedSymbols.length} symbols`);
    lines.push('');

    // Group by depth
    const depths = Array.from(byDepth.keys()).sort((a, b) => a - b);
    for (const depth of depths) {
      const symbols = byDepth.get(depth)!;
      const label = depth === 1 ? 'WILL BREAK' : depth === 2 ? 'LIKELY AFFECTED' : 'MAY BE AFFECTED';
      
      lines.push(`### Depth ${depth} (${label})`);
      lines.push('');

      for (const symbol of symbols.slice(0, 10)) { // Limit to 10 per depth
        const affected = affectedSymbols.find(a => a.symbol.uid === symbol.uid);
        const confidence = affected ? Math.round(affected.confidence * 100) : 50;
        const relType = affected?.relationType ?? 'UNKNOWN';
        
        lines.push(`- ${this.getSymbolEmoji(symbol.kind)} **${symbol.name}** [${relType} ${confidence}%]`);
        lines.push(`  \`${symbol.filepath}:${symbol.startLine}\``);
      }

      if (symbols.length > 10) {
        lines.push(`  ... and ${symbols.length - 10} more`);
      }
      lines.push('');
    }

    // Recommendations
    lines.push('### Recommendations');
    lines.push('');
    if (riskLevel === 'CRITICAL' || riskLevel === 'HIGH') {
      lines.push('⚠️ **High risk change!**');
      lines.push('- Run full integration tests');
      lines.push('- Review all affected files');
      lines.push('- Consider breaking into smaller changes');
    } else if (riskLevel === 'MEDIUM') {
      lines.push('⚠️ **Medium risk change**');
      lines.push('- Run unit tests for affected modules');
      lines.push('- Review direct callers');
    } else {
      lines.push('✅ **Low risk change**');
      lines.push('- Standard testing should be sufficient');
    }

    return lines.join('\n');
  }

  private getRiskEmoji(risk: string): string {
    switch (risk) {
      case 'CRITICAL': return '🔴';
      case 'HIGH': return '🟠';
      case 'MEDIUM': return '🟡';
      case 'LOW': return '🟢';
      default: return '⚪';
    }
  }

  private getSymbolEmoji(kind: string): string {
    switch (kind) {
      case 'Function': return '🔧';
      case 'Class': return '📦';
      case 'Method': return '⚙️';
      case 'Interface': return '📋';
      case 'Variable': return '📌';
      default: return '•';
    }
  }

  private isTestFile(filepath: string): boolean {
    return /\.(test|spec)\.(ts|tsx|js|jsx)$/.test(filepath) || filepath.includes('__tests__');
  }
}

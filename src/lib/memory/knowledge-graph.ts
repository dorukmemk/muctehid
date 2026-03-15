import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { KGNode, KGEdge } from '../../types/v2.js';

export class KnowledgeGraph {
  private nodes: Map<string, KGNode> = new Map();
  private edges: Map<string, KGEdge> = new Map();
  private graphPath: string;

  constructor(dataDir: string) {
    this.graphPath = path.join(dataDir, 'knowledge-graph.json');
    this.load();
  }

  private load(): void {
    if (!fs.existsSync(this.graphPath)) return;
    try {
      const raw = JSON.parse(fs.readFileSync(this.graphPath, 'utf-8'));
      for (const n of raw.nodes ?? []) this.nodes.set(n.id, n);
      for (const e of raw.edges ?? []) this.edges.set(e.id, e);
    } catch { /* start fresh */ }
  }

  private save(): void {
    fs.writeFileSync(this.graphPath, JSON.stringify({
      nodes: Array.from(this.nodes.values()),
      edges: Array.from(this.edges.values()),
    }));
  }

  addNode(node: Omit<KGNode, 'id'> & { id?: string }): KGNode {
    const id = node.id ?? crypto.createHash('sha256').update(`${node.type}:${node.label}:${node.filepath ?? ''}`).digest('hex').slice(0, 12);
    const n: KGNode = { ...node, id };
    this.nodes.set(id, n);
    this.save();
    return n;
  }

  addEdge(edge: Omit<KGEdge, 'id'>): KGEdge {
    const id = crypto.createHash('sha256').update(`${edge.source}:${edge.type}:${edge.target}`).digest('hex').slice(0, 12);
    if (this.edges.has(id)) return this.edges.get(id)!;
    const e: KGEdge = { ...edge, id };
    this.edges.set(id, e);
    this.save();
    return e;
  }

  getNode(id: string): KGNode | undefined {
    return this.nodes.get(id);
  }

  findNode(label: string, type?: KGNode['type']): KGNode | undefined {
    for (const node of this.nodes.values()) {
      if (node.label === label && (!type || node.type === type)) return node;
    }
    return undefined;
  }

  neighbors(nodeId: string, edgeType?: KGEdge['type']): KGNode[] {
    const result: KGNode[] = [];
    for (const edge of this.edges.values()) {
      if (edge.source !== nodeId && edge.target !== nodeId) continue;
      if (edgeType && edge.type !== edgeType) continue;
      const otherId = edge.source === nodeId ? edge.target : edge.source;
      const other = this.nodes.get(otherId);
      if (other) result.push(other);
    }
    return result;
  }

  subgraph(nodeId: string, depth = 2): { nodes: KGNode[]; edges: KGEdge[] } {
    const visitedNodes = new Set<string>([nodeId]);
    const visitedEdges = new Set<string>();
    let frontier = [nodeId];

    for (let d = 0; d < depth; d++) {
      const next: string[] = [];
      for (const nid of frontier) {
        for (const edge of this.edges.values()) {
          if (edge.source !== nid && edge.target !== nid) continue;
          visitedEdges.add(edge.id);
          const otherId = edge.source === nid ? edge.target : edge.source;
          if (!visitedNodes.has(otherId)) {
            visitedNodes.add(otherId);
            next.push(otherId);
          }
        }
      }
      frontier = next;
    }

    return {
      nodes: Array.from(visitedNodes).map(id => this.nodes.get(id)!).filter(Boolean),
      edges: Array.from(visitedEdges).map(id => this.edges.get(id)!).filter(Boolean),
    };
  }

  buildFromImports(filepath: string, imports: string[]): void {
    const fileNode = this.addNode({ type: 'file', label: path.basename(filepath), filepath, metadata: {} });
    for (const imp of imports) {
      const impNode = this.addNode({ type: 'module', label: imp, metadata: {} });
      this.addEdge({ source: fileNode.id, target: impNode.id, type: 'imports', weight: 1.0 });
    }
  }

  stats(): { nodes: number; edges: number; byNodeType: Record<string, number> } {
    const byNodeType: Record<string, number> = {};
    for (const n of this.nodes.values()) {
      byNodeType[n.type] = (byNodeType[n.type] ?? 0) + 1;
    }
    return { nodes: this.nodes.size, edges: this.edges.size, byNodeType };
  }

  clear(): void {
    this.nodes.clear();
    this.edges.clear();
    this.save();
  }
}

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
exports.KnowledgeGraph = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const crypto = __importStar(require("crypto"));
class KnowledgeGraph {
    nodes = new Map();
    edges = new Map();
    graphPath;
    constructor(dataDir) {
        this.graphPath = path.join(dataDir, 'knowledge-graph.json');
        this.load();
    }
    load() {
        if (!fs.existsSync(this.graphPath))
            return;
        try {
            const raw = JSON.parse(fs.readFileSync(this.graphPath, 'utf-8'));
            for (const n of raw.nodes ?? [])
                this.nodes.set(n.id, n);
            for (const e of raw.edges ?? [])
                this.edges.set(e.id, e);
        }
        catch { /* start fresh */ }
    }
    save() {
        fs.writeFileSync(this.graphPath, JSON.stringify({
            nodes: Array.from(this.nodes.values()),
            edges: Array.from(this.edges.values()),
        }));
    }
    addNode(node) {
        const id = node.id ?? crypto.createHash('sha256').update(`${node.type}:${node.label}:${node.filepath ?? ''}`).digest('hex').slice(0, 12);
        const n = { ...node, id };
        this.nodes.set(id, n);
        this.save();
        return n;
    }
    addEdge(edge) {
        const id = crypto.createHash('sha256').update(`${edge.source}:${edge.type}:${edge.target}`).digest('hex').slice(0, 12);
        if (this.edges.has(id))
            return this.edges.get(id);
        const e = { ...edge, id };
        this.edges.set(id, e);
        this.save();
        return e;
    }
    getNode(id) {
        return this.nodes.get(id);
    }
    findNode(label, type) {
        for (const node of this.nodes.values()) {
            if (node.label === label && (!type || node.type === type))
                return node;
        }
        return undefined;
    }
    neighbors(nodeId, edgeType) {
        const result = [];
        for (const edge of this.edges.values()) {
            if (edge.source !== nodeId && edge.target !== nodeId)
                continue;
            if (edgeType && edge.type !== edgeType)
                continue;
            const otherId = edge.source === nodeId ? edge.target : edge.source;
            const other = this.nodes.get(otherId);
            if (other)
                result.push(other);
        }
        return result;
    }
    subgraph(nodeId, depth = 2) {
        const visitedNodes = new Set([nodeId]);
        const visitedEdges = new Set();
        let frontier = [nodeId];
        for (let d = 0; d < depth; d++) {
            const next = [];
            for (const nid of frontier) {
                for (const edge of this.edges.values()) {
                    if (edge.source !== nid && edge.target !== nid)
                        continue;
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
            nodes: Array.from(visitedNodes).map(id => this.nodes.get(id)).filter(Boolean),
            edges: Array.from(visitedEdges).map(id => this.edges.get(id)).filter(Boolean),
        };
    }
    buildFromImports(filepath, imports) {
        const fileNode = this.addNode({ type: 'file', label: path.basename(filepath), filepath, metadata: {} });
        for (const imp of imports) {
            const impNode = this.addNode({ type: 'module', label: imp, metadata: {} });
            this.addEdge({ source: fileNode.id, target: impNode.id, type: 'imports', weight: 1.0 });
        }
    }
    stats() {
        const byNodeType = {};
        for (const n of this.nodes.values()) {
            byNodeType[n.type] = (byNodeType[n.type] ?? 0) + 1;
        }
        return { nodes: this.nodes.size, edges: this.edges.size, byNodeType };
    }
    clear() {
        this.nodes.clear();
        this.edges.clear();
        this.save();
    }
}
exports.KnowledgeGraph = KnowledgeGraph;
//# sourceMappingURL=knowledge-graph.js.map
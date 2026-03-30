import Database from 'better-sqlite3';
import * as path from 'path';
import * as fs from 'fs';

export interface SymbolNode {
  uid: string;
  name: string;
  kind: 'Function' | 'Class' | 'Interface' | 'Variable' | 'Method' | 'Property';
  filepath: string;
  startLine: number;
  endLine: number;
  complexity?: number;
}

export interface CommunityNode {
  id: string;
  heuristicLabel: string;
  cohesion: number;
  memberCount: number;
}

export type RelationType = 'CALLS' | 'IMPORTS' | 'EXTENDS' | 'IMPLEMENTS' | 'MEMBER_OF';

export interface Relation {
  from: string;
  to: string;
  type: RelationType;
  confidence: number;
}

export interface TraversalResult {
  nodes: SymbolNode[];
  relations: Relation[];
  depth: number;
}

export class GraphStore {
  private db: Database.Database;
  private dbPath: string;

  constructor(dataDir: string) {
    this.dbPath = path.join(dataDir, 'graph.db');
    const dbDir = path.dirname(this.dbPath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
    this.db = new Database(this.dbPath);
  }

  async init(): Promise<void> {
    // Create symbols table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS symbols (
        uid TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        kind TEXT NOT NULL,
        filepath TEXT NOT NULL,
        startLine INTEGER NOT NULL,
        endLine INTEGER NOT NULL,
        complexity INTEGER DEFAULT 0
      )
    `);

    // Create relations table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS relations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        fromUid TEXT NOT NULL,
        toUid TEXT NOT NULL,
        type TEXT NOT NULL,
        confidence REAL DEFAULT 1.0,
        FOREIGN KEY (fromUid) REFERENCES symbols(uid),
        FOREIGN KEY (toUid) REFERENCES symbols(uid)
      )
    `);

    // Create communities table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS communities (
        id TEXT PRIMARY KEY,
        heuristicLabel TEXT NOT NULL,
        cohesion REAL NOT NULL,
        memberCount INTEGER NOT NULL
      )
    `);

    // Create symbol_community junction table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS symbol_community (
        symbolUid TEXT NOT NULL,
        communityId TEXT NOT NULL,
        PRIMARY KEY (symbolUid, communityId),
        FOREIGN KEY (symbolUid) REFERENCES symbols(uid),
        FOREIGN KEY (communityId) REFERENCES communities(id)
      )
    `);

    // Create indexes
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_symbols_name ON symbols(name);
      CREATE INDEX IF NOT EXISTS idx_relations_from ON relations(fromUid);
      CREATE INDEX IF NOT EXISTS idx_relations_to ON relations(toUid);
      CREATE INDEX IF NOT EXISTS idx_relations_type ON relations(type);
    `);
  }

  async createSymbol(data: SymbolNode): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO symbols (uid, name, kind, filepath, startLine, endLine, complexity)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      data.uid,
      data.name,
      data.kind,
      data.filepath,
      data.startLine,
      data.endLine,
      data.complexity ?? 0
    );
  }

  async createRelation(from: string, to: string, type: RelationType, confidence: number = 1.0): Promise<boolean> {
    // Check if both symbols exist first
    const fromExists = this.db.prepare('SELECT 1 FROM symbols WHERE uid = ?').get(from);
    const toExists = this.db.prepare('SELECT 1 FROM symbols WHERE uid = ?').get(to);

    if (!fromExists || !toExists) {
      return false;
    }

    // Check for duplicate
    const existing = this.db.prepare(
      'SELECT 1 FROM relations WHERE fromUid = ? AND toUid = ? AND type = ?'
    ).get(from, to, type);

    if (existing) {
      // Update confidence if higher
      this.db.prepare(
        'UPDATE relations SET confidence = MAX(confidence, ?) WHERE fromUid = ? AND toUid = ? AND type = ?'
      ).run(confidence, from, to, type);
      return false; // not a new relation
    }

    try {
      this.db.prepare(
        'INSERT INTO relations (fromUid, toUid, type, confidence) VALUES (?, ?, ?, ?)'
      ).run(from, to, type, confidence);
      return true;
    } catch (error) {
      console.warn(`[GraphStore] Failed to create relation ${from} -> ${to}:`, error);
      return false;
    }
  }

  async getAllSymbols(): Promise<SymbolNode[]> {
    const rows = this.db.prepare('SELECT * FROM symbols').all() as any[];
    return rows.map((row: any) => ({
      uid: row.uid,
      name: row.name,
      kind: row.kind,
      filepath: row.filepath,
      startLine: row.startLine,
      endLine: row.endLine,
      complexity: row.complexity,
    }));
  }

  async createCommunity(data: CommunityNode): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO communities (id, heuristicLabel, cohesion, memberCount)
      VALUES (?, ?, ?, ?)
    `);
    stmt.run(data.id, data.heuristicLabel, data.cohesion, data.memberCount);
  }

  async addToCommunity(symbolUid: string, communityId: string): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT OR IGNORE INTO symbol_community (symbolUid, communityId)
      VALUES (?, ?)
    `);
    stmt.run(symbolUid, communityId);
  }

  async getSymbol(uid: string): Promise<SymbolNode | null> {
    const stmt = this.db.prepare('SELECT * FROM symbols WHERE uid = ?');
    const row = stmt.get(uid) as any;
    if (!row) return null;
    return {
      uid: row.uid,
      name: row.name,
      kind: row.kind,
      filepath: row.filepath,
      startLine: row.startLine,
      endLine: row.endLine,
      complexity: row.complexity,
    };
  }

  async findSymbolsByName(name: string): Promise<SymbolNode[]> {
    // Exact match first
    const exact = this.db.prepare('SELECT * FROM symbols WHERE name = ?').all(name) as any[];
    if (exact.length > 0) {
      return exact.map(this.rowToSymbol);
    }

    // Case-insensitive match
    const caseInsensitive = this.db.prepare('SELECT * FROM symbols WHERE name = ? COLLATE NOCASE').all(name) as any[];
    if (caseInsensitive.length > 0) {
      return caseInsensitive.map(this.rowToSymbol);
    }

    // Partial match (name contains the search term)
    const partial = this.db.prepare('SELECT * FROM symbols WHERE name LIKE ? COLLATE NOCASE').all(`%${name}%`) as any[];
    return partial.map(this.rowToSymbol);
  }

  private rowToSymbol(row: any): SymbolNode {
    return {
      uid: row.uid,
      name: row.name,
      kind: row.kind,
      filepath: row.filepath,
      startLine: row.startLine,
      endLine: row.endLine,
      complexity: row.complexity,
    };
  }

  async upstream(target: string, maxDepth: number = 3, minConfidence: number = 0.0): Promise<TraversalResult> {
    const nodes: SymbolNode[] = [];
    const relations: Relation[] = [];
    const visited = new Set<string>();
    const queue: Array<{ uid: string; depth: number }> = [{ uid: target, depth: 0 }];

    while (queue.length > 0) {
      const { uid, depth } = queue.shift()!;
      if (visited.has(uid) || depth > maxDepth) continue;
      visited.add(uid);

      // Find callers
      const stmt = this.db.prepare(`
        SELECT s.*, r.type, r.confidence
        FROM relations r
        JOIN symbols s ON r.fromUid = s.uid
        WHERE r.toUid = ? AND r.confidence >= ?
      `);
      const rows = stmt.all(uid, minConfidence) as any[];

      for (const row of rows) {
        const caller: SymbolNode = {
          uid: row.uid,
          name: row.name,
          kind: row.kind,
          filepath: row.filepath,
          startLine: row.startLine,
          endLine: row.endLine,
          complexity: row.complexity,
        };
        nodes.push(caller);
        relations.push({
          from: row.uid,
          to: uid,
          type: row.type,
          confidence: row.confidence,
        });

        if (depth < maxDepth) {
          queue.push({ uid: row.uid, depth: depth + 1 });
        }
      }
    }

    return { nodes, relations, depth: maxDepth };
  }

  async downstream(target: string, maxDepth: number = 3): Promise<TraversalResult> {
    const nodes: SymbolNode[] = [];
    const relations: Relation[] = [];
    const visited = new Set<string>();
    const queue: Array<{ uid: string; depth: number }> = [{ uid: target, depth: 0 }];

    while (queue.length > 0) {
      const { uid, depth } = queue.shift()!;
      if (visited.has(uid) || depth > maxDepth) continue;
      visited.add(uid);

      // Find callees
      const stmt = this.db.prepare(`
        SELECT s.*, r.type, r.confidence
        FROM relations r
        JOIN symbols s ON r.toUid = s.uid
        WHERE r.fromUid = ?
      `);
      const rows = stmt.all(uid) as any[];

      for (const row of rows) {
        const callee: SymbolNode = {
          uid: row.uid,
          name: row.name,
          kind: row.kind,
          filepath: row.filepath,
          startLine: row.startLine,
          endLine: row.endLine,
          complexity: row.complexity,
        };
        nodes.push(callee);
        relations.push({
          from: uid,
          to: row.uid,
          type: row.type,
          confidence: row.confidence,
        });

        if (depth < maxDepth) {
          queue.push({ uid: row.uid, depth: depth + 1 });
        }
      }
    }

    return { nodes, relations, depth: maxDepth };
  }

  async getContext(symbolUid: string): Promise<{
    symbol: SymbolNode | null;
    incoming: Relation[];
    outgoing: Relation[];
    community: CommunityNode | null;
  }> {
    const symbol = await this.getSymbol(symbolUid);
    if (!symbol) return { symbol: null, incoming: [], outgoing: [], community: null };

    // Incoming relations
    const incomingStmt = this.db.prepare(`
      SELECT fromUid, toUid, type, confidence
      FROM relations
      WHERE toUid = ?
    `);
    const incomingRows = incomingStmt.all(symbolUid) as any[];
    const incoming: Relation[] = incomingRows.map((row: any) => ({
      from: row.fromUid,
      to: row.toUid,
      type: row.type,
      confidence: row.confidence,
    }));

    // Outgoing relations
    const outgoingStmt = this.db.prepare(`
      SELECT fromUid, toUid, type, confidence
      FROM relations
      WHERE fromUid = ?
    `);
    const outgoingRows = outgoingStmt.all(symbolUid) as any[];
    const outgoing: Relation[] = outgoingRows.map((row: any) => ({
      from: row.fromUid,
      to: row.toUid,
      type: row.type,
      confidence: row.confidence,
    }));

    // Community
    const communityStmt = this.db.prepare(`
      SELECT c.*
      FROM communities c
      JOIN symbol_community sc ON c.id = sc.communityId
      WHERE sc.symbolUid = ?
      LIMIT 1
    `);
    const communityRow = communityStmt.get(symbolUid) as any;
    const community = communityRow ? {
      id: communityRow.id,
      heuristicLabel: communityRow.heuristicLabel,
      cohesion: communityRow.cohesion,
      memberCount: communityRow.memberCount,
    } : null;

    return { symbol, incoming, outgoing, community };
  }

  async query(sql: string, params: any[] = []): Promise<any[]> {
    const stmt = this.db.prepare(sql);
    return stmt.all(...params) as any[];
  }

  async clear(): Promise<void> {
    this.db.exec('DELETE FROM symbol_community');
    this.db.exec('DELETE FROM relations');
    this.db.exec('DELETE FROM communities');
    this.db.exec('DELETE FROM symbols');
  }

  async close(): Promise<void> {
    this.db.close();
  }

  async stats(): Promise<{ symbols: number; relations: number; communities: number }> {
    const symbolsRow = this.db.prepare('SELECT COUNT(*) as count FROM symbols').get() as any;
    const relationsRow = this.db.prepare('SELECT COUNT(*) as count FROM relations').get() as any;
    const communitiesRow = this.db.prepare('SELECT COUNT(*) as count FROM communities').get() as any;

    return {
      symbols: symbolsRow.count,
      relations: relationsRow.count,
      communities: communitiesRow.count,
    };
  }
}

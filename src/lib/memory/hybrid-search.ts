import { SearchResult, SearchOptions } from '../../types/index.js';
import { SQLiteStore, BM25Result } from './sqlite-store.js';
import { VectorStore } from './vector-store.js';
import { embed } from './embedder.js';

const RRF_K = 60;

export async function hybridSearch(
  query: string,
  sqliteStore: SQLiteStore,
  vectorStore: VectorStore,
  options: SearchOptions = {}
): Promise<SearchResult[]> {
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

  return rrfFusion(bm25Results, vectorResults, k);
}

async function bm25Only(
  query: string,
  store: SQLiteStore,
  k: number,
  language?: string
): Promise<SearchResult[]> {
  const raw = store.bm25Search(query, k, language);
  const chunks = store.getChunksByIds(raw.map(r => r.id));
  const chunkMap = new Map(chunks.map(c => [c.id, c]));

  return raw
    .filter(r => chunkMap.has(r.id))
    .map((r, idx) => ({
      chunk: chunkMap.get(r.id)!,
      score: 1 / (RRF_K + idx + 1),
      bm25Score: Math.abs(r.rank),
    }));
}

async function vectorOnly(
  query: string,
  vectorStore: VectorStore,
  sqliteStore: SQLiteStore,
  k: number,
  filter?: SearchOptions['filter']
): Promise<SearchResult[]> {
  let queryVector: number[];
  try {
    queryVector = await embed(query);
  } catch {
    return [];
  }

  const vectorFilter: Record<string, unknown> = {};
  if (filter?.language) vectorFilter.language = filter.language;

  const raw = vectorStore.search(queryVector, k, Object.keys(vectorFilter).length > 0 ? vectorFilter : undefined);
  const chunks = sqliteStore.getChunksByIds(raw.map(r => r.id));
  const chunkMap = new Map(chunks.map(c => [c.id, c]));

  return raw
    .filter(r => chunkMap.has(r.id))
    .map((r, idx) => ({
      chunk: chunkMap.get(r.id)!,
      score: 1 / (RRF_K + idx + 1),
      vectorScore: r.score,
    }));
}

function rrfFusion(bm25: SearchResult[], vector: SearchResult[], k: number): SearchResult[] {
  const scoreMap = new Map<string, { bm25Rank?: number; vectorRank?: number; chunk: SearchResult['chunk']; bm25Score?: number; vectorScore?: number }>();

  bm25.forEach((r, idx) => {
    scoreMap.set(r.chunk.id, { bm25Rank: idx, chunk: r.chunk, bm25Score: r.bm25Score });
  });

  vector.forEach((r, idx) => {
    const existing = scoreMap.get(r.chunk.id);
    if (existing) {
      existing.vectorRank = idx;
      existing.vectorScore = r.vectorScore;
    } else {
      scoreMap.set(r.chunk.id, { vectorRank: idx, chunk: r.chunk, vectorScore: r.vectorScore });
    }
  });

  const results: SearchResult[] = [];
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
  return results.slice(0, k);
}

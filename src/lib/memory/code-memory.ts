import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';
import ignore from 'ignore';
import { CodeChunk, SearchResult, SearchOptions, MemoryStats, IndexOptions } from '../../types/index.js';
import { SQLiteStore, makeChunkId } from './sqlite-store.js';
import { VectorStore } from './vector-store.js';
import { embed } from './embedder.js';
import { chunkFile, shouldSkip } from './chunker.js';
import { hybridSearch } from './hybrid-search.js';

// ── Batch parallel embedding ──────────────────────────────────────────────────
const EMBED_CONCURRENCY = 8;

interface RawChunk {
  filepath: string;
  content: string;
  startLine: number;
  endLine: number;
  language: string;
  symbols: string[];
}

async function embedBatch(chunks: RawChunk[], embedFn: (text: string) => Promise<number[]>): Promise<Array<number[] | null>> {
  const results: Array<number[] | null> = new Array(chunks.length).fill(null);
  for (let i = 0; i < chunks.length; i += EMBED_CONCURRENCY) {
    const batch = chunks.slice(i, i + EMBED_CONCURRENCY);
    const vectors = await Promise.all(
      batch.map(c => embedFn(c.content.slice(0, 512)).catch(() => null))
    );
    for (let j = 0; j < vectors.length; j++) {
      results[i + j] = vectors[j];
    }
  }
  return results;
}

// ── Gitignore-based exclusion ─────────────────────────────────────────────────
function loadGitignore(repoRoot: string): ReturnType<typeof ignore> {
  const ig = ignore();
  const gitignorePath = path.join(repoRoot, '.gitignore');
  if (fs.existsSync(gitignorePath)) {
    try {
      ig.add(fs.readFileSync(gitignorePath, 'utf-8'));
    } catch { /* skip */ }
  }
  // Always ignore these
  ig.add(['node_modules', 'dist', '.git', '.audit-data', '*.lock', '*.log']);
  return ig;
}

export class CodeMemory {
  private sqlite: SQLiteStore;
  private vectors: VectorStore;
  private dataDir: string;

  private constructor(dataDir: string) {
    this.dataDir = dataDir;
    this.sqlite = new SQLiteStore(path.join(dataDir, 'memory.db'));
    this.vectors = new VectorStore(path.join(dataDir, 'vectors'));
  }

  static async open(dataDir: string): Promise<CodeMemory> {
    fs.mkdirSync(dataDir, { recursive: true });
    return new CodeMemory(dataDir);
  }

  async indexDirectory(dirPath: string, opts: IndexOptions = {}): Promise<{ indexed: number; updated: number; skipped: number; errors: number }> {
    const exclude = opts.exclude ?? ['node_modules', 'dist', '.git', '.audit-data'];
    const chunkSize = opts.chunkSize ?? 150;
    const overlap = opts.overlap ?? 20;
    const mode = opts.mode ?? 'hybrid';

    // Load .gitignore rules (augmented with hard-coded excludes)
    const ig = loadGitignore(dirPath);

    const files = await glob('**/*', {
      cwd: dirPath,
      nodir: true,
      absolute: true,
      ignore: exclude.map(p => `**/${p}/**`),
    });

    let indexed = 0, updated = 0, skipped = 0, errors = 0;

    for (const file of files) {
      // Check gitignore rules first, then fall back to shouldSkip for non-relative paths
      const relPath = path.relative(dirPath, file).replace(/\\/g, '/');
      if (ig.ignores(relPath)) { skipped++; continue; }

      try {
        const stat = fs.statSync(file);
        if (stat.size > 1_000_000) { skipped++; continue; } // skip files > 1MB

        const chunks = chunkFile(file, chunkSize, overlap);
        if (chunks.length === 0) { skipped++; continue; }

        // Incremental indexing: skip unchanged files
        const stored = this.sqlite.getFileMeta(file);
        if (stored && stored.lastModified >= stat.mtimeMs) {
          skipped++;
          continue;
        }

        // File is new or changed — delete old chunks before re-indexing
        const isUpdate = stored !== null;
        if (isUpdate) {
          this.sqlite.deleteByFilepath(file);
        }

        // Upsert all chunks to SQLite first (BM25 works immediately)
        for (const raw of chunks) {
          const id = makeChunkId(raw.filepath, raw.startLine);
          const chunk: CodeChunk = {
            id,
            filepath: raw.filepath,
            content: raw.content,
            startLine: raw.startLine,
            endLine: raw.endLine,
            language: raw.language,
            symbols: raw.symbols,
            metadata: {
              size: stat.size,
              lastModified: stat.mtimeMs,
            },
          };
          this.sqlite.upsert(chunk);
        }

        // Embed all chunks for this file in parallel (batches of EMBED_CONCURRENCY)
        if (mode !== 'bm25') {
          const vectors = await embedBatch(chunks, embed);
          for (let i = 0; i < chunks.length; i++) {
            const vec = vectors[i];
            if (vec !== null) {
              const id = makeChunkId(chunks[i].filepath, chunks[i].startLine);
              this.vectors.upsert(id, vec, { language: chunks[i].language, filepath: chunks[i].filepath });
            }
          }
        }

        if (isUpdate) {
          updated++;
        } else {
          indexed++;
        }
      } catch {
        errors++;
      }
    }

    return { indexed, updated, skipped, errors };
  }

  async search(query: string, opts: SearchOptions = {}): Promise<SearchResult[]> {
    return hybridSearch(query, this.sqlite, this.vectors, opts);
  }

  async addChunk(data: {
    filepath: string;
    content: string;
    startLine: number;
    endLine: number;
    language?: string;
    symbols?: string[];
  }): Promise<string> {
    const id = makeChunkId(data.filepath, data.startLine);
    const chunk: CodeChunk = {
      id,
      filepath: data.filepath,
      content: data.content,
      startLine: data.startLine,
      endLine: data.endLine,
      language: data.language ?? 'text',
      symbols: data.symbols ?? [],
      metadata: {
        size: data.content.length,
        lastModified: Date.now(),
      },
    };
    this.sqlite.upsert(chunk);
    try {
      const vector = await embed(data.content);
      this.vectors.upsert(id, vector, { language: chunk.language });
    } catch { /* ok */ }
    return id;
  }

  delete(id: string): void {
    this.sqlite.delete(id);
    this.vectors.delete(id);
  }

  deleteByFilepath(filepath: string): void {
    this.sqlite.deleteByFilepath(filepath);
  }

  clear(): void {
    this.sqlite.clear();
    this.vectors.clear();
  }

  stats(): MemoryStats {
    const { chunks, files, dbSize } = this.sqlite.stats();
    return {
      chunks,
      files,
      embeddingsReady: this.vectors.size() > 0,
      dbSize,
    };
  }

  close(): void {
    this.sqlite.close();
  }
}

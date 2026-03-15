import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';
import { CodeChunk, SearchResult, SearchOptions, MemoryStats, IndexOptions } from '../../types/index.js';
import { SQLiteStore, makeChunkId } from './sqlite-store.js';
import { VectorStore } from './vector-store.js';
import { embed } from './embedder.js';
import { chunkFile, shouldSkip } from './chunker.js';
import { hybridSearch } from './hybrid-search.js';

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

  async indexDirectory(dirPath: string, opts: IndexOptions = {}): Promise<{ indexed: number; skipped: number; errors: number }> {
    const exclude = opts.exclude ?? ['node_modules', 'dist', '.git', '.audit-data'];
    const chunkSize = opts.chunkSize ?? 150;
    const overlap = opts.overlap ?? 20;
    const mode = opts.mode ?? 'hybrid';

    const files = await glob('**/*', {
      cwd: dirPath,
      nodir: true,
      absolute: true,
      ignore: exclude.map(p => `**/${p}/**`),
    });

    let indexed = 0, skipped = 0, errors = 0;

    for (const file of files) {
      if (shouldSkip(file, exclude)) { skipped++; continue; }

      try {
        const stat = fs.statSync(file);
        if (stat.size > 1_000_000) { skipped++; continue; } // skip files > 1MB

        const chunks = chunkFile(file, chunkSize, overlap);
        if (chunks.length === 0) { skipped++; continue; }

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

          if (mode !== 'bm25') {
            try {
              const vector = await embed(raw.content);
              this.vectors.upsert(id, vector, { language: raw.language, filepath: raw.filepath });
            } catch {
              // embedding failed — BM25 still works
            }
          }
        }
        indexed++;
      } catch {
        errors++;
      }
    }

    return { indexed, skipped, errors };
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

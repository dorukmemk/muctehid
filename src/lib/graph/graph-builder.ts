import { GraphStore, SymbolNode } from './graph-store.js';
import { TypeScriptParser, ParseResult, RawRelation } from './parsers/typescript-parser.js';
import { PythonParser } from './parsers/python-parser.js';
import * as path from 'path';
import * as fs from 'fs';
import { glob } from 'glob';

export interface BuildStats {
  filesProcessed: number;
  symbolsCreated: number;
  relationsCreated: number;
  relationsSkipped: number;
  errors: number;
}

export class GraphBuilder {
  private store: GraphStore;
  private tsParser: TypeScriptParser;
  private pyParser: PythonParser;

  constructor(store: GraphStore) {
    this.store = store;
    this.tsParser = new TypeScriptParser();
    this.pyParser = new PythonParser();
  }

  async buildFromDirectory(
    dirPath: string,
    extensions: string[] = ['.ts', '.tsx', '.js', '.jsx', '.py']
  ): Promise<BuildStats> {
    const stats: BuildStats = {
      filesProcessed: 0,
      symbolsCreated: 0,
      relationsCreated: 0,
      relationsSkipped: 0,
      errors: 0,
    };

    // Find all files
    const patterns = extensions.map(ext => `**/*${ext}`);
    const files: string[] = [];
    for (const pattern of patterns) {
      const matches = await glob(pattern, {
        cwd: dirPath,
        absolute: true,
        ignore: ['**/node_modules/**', '**/dist/**', '**/.git/**', '**/build/**'],
      });
      files.push(...matches);
    }

    console.log(`[GraphBuilder] Found ${files.length} files to process`);

    // ── PASS 1: Parse all files, create all symbols ────────────────────────
    const allParseResults: ParseResult[] = [];

    for (const file of files) {
      try {
        const content = fs.readFileSync(file, 'utf-8');
        const ext = path.extname(file);
        let result: ParseResult;

        if (['.py'].includes(ext)) {
          result = await this.pyParser.parse(file, content);
        } else {
          result = this.tsParser.parse(file, content);
        }

        for (const symbol of result.symbols) {
          await this.store.createSymbol(symbol);
          stats.symbolsCreated++;
        }

        allParseResults.push(result);
        stats.filesProcessed++;
      } catch (error) {
        console.error(`[GraphBuilder] Error processing ${file}:`, error);
        stats.errors++;
      }
    }

    console.log(`[GraphBuilder] Pass 1: ${stats.symbolsCreated} symbols created from ${stats.filesProcessed} files`);

    // Build a name → uid[] lookup from the store for fast resolution
    // We load all symbols once and index by name
    const nameIndex = await this.buildNameIndex();
    console.log(`[GraphBuilder] Name index built: ${nameIndex.size} unique names`);

    // ── PASS 2: Resolve raw relations and insert ───────────────────────────
    for (const result of allParseResults) {
      for (const raw of result.rawRelations) {
        const resolvedToUid = this.resolveToUid(raw, nameIndex);
        if (!resolvedToUid) {
          stats.relationsSkipped++;
          continue;
        }

        const created = await this.store.createRelation(
          raw.fromUid,
          resolvedToUid,
          raw.type,
          raw.confidence
        );
        if (created) {
          stats.relationsCreated++;
        } else {
          stats.relationsSkipped++;
        }
      }
    }

    console.log(`[GraphBuilder] Pass 2: ${stats.relationsCreated} relations created, ${stats.relationsSkipped} skipped`);
    return stats;
  }

  /**
   * Build a map of symbol name → list of UIDs.
   * Used for O(1) lookup during relation resolution.
   */
  private async buildNameIndex(): Promise<Map<string, string[]>> {
    const allSymbols = await this.store.getAllSymbols();
    const index = new Map<string, string[]>();

    for (const sym of allSymbols) {
      // Index by simple name
      const existing = index.get(sym.name) ?? [];
      existing.push(sym.uid);
      index.set(sym.name, existing);

      // Also index by last segment of dotted name (e.g. "MyClass.myMethod" → "myMethod")
      const dotIdx = sym.name.lastIndexOf('.');
      if (dotIdx !== -1) {
        const shortName = sym.name.slice(dotIdx + 1);
        const existingShort = index.get(shortName) ?? [];
        existingShort.push(sym.uid);
        index.set(shortName, existingShort);
      }
    }

    return index;
  }

  /**
   * Resolve a RawRelation's toName to a concrete UID.
   * Strategy:
   *  1. If toFile is known, prefer symbols from that file
   *  2. Otherwise pick the best match by name
   */
  private resolveToUid(raw: RawRelation, nameIndex: Map<string, string[]>): string | null {
    const candidates = nameIndex.get(raw.toName);
    if (!candidates || candidates.length === 0) return null;

    if (candidates.length === 1) return candidates[0];

    // If we know the source file, prefer symbols from that file
    if (raw.toFile) {
      // Try exact path match and common extension variants
      const variants = [
        raw.toFile,
        raw.toFile + '.ts',
        raw.toFile + '.tsx',
        raw.toFile + '.js',
        raw.toFile + '.jsx',
        raw.toFile + '/index.ts',
        raw.toFile + '/index.tsx',
      ];
      for (const variant of variants) {
        const match = candidates.find(uid => uid.startsWith(variant + ':'));
        if (match) return match;
      }
    }

    // Fallback: return first candidate (most likely same-file definition)
    return candidates[0];
  }
}

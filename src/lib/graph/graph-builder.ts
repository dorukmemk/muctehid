import { GraphStore, SymbolNode, Relation } from './graph-store.js';
import { TypeScriptParser, ParseResult } from './parsers/typescript-parser.js';
import * as path from 'path';
import * as fs from 'fs';
import { glob } from 'glob';

export interface BuildStats {
  filesProcessed: number;
  symbolsCreated: number;
  relationsCreated: number;
  errors: number;
}

export class GraphBuilder {
  private store: GraphStore;
  private tsParser: TypeScriptParser;

  constructor(store: GraphStore) {
    this.store = store;
    this.tsParser = new TypeScriptParser();
  }

  async buildFromDirectory(dirPath: string, extensions: string[] = ['.ts', '.tsx', '.js', '.jsx']): Promise<BuildStats> {
    const stats: BuildStats = {
      filesProcessed: 0,
      symbolsCreated: 0,
      relationsCreated: 0,
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

    // TWO-PASS APPROACH
    // Pass 1: Create all symbols first
    const parseResults: ParseResult[] = [];
    
    for (const file of files) {
      try {
        const content = fs.readFileSync(file, 'utf-8');
        const ext = path.extname(file);
        
        let result: ParseResult | null = null;

        // Select parser based on extension
        if (['.ts', '.tsx'].includes(ext)) {
          result = this.tsParser.parse(file, content);
        } else if (['.js', '.jsx'].includes(ext)) {
          result = this.tsParser.parse(file, content);
        }

        if (result) {
          // Create symbols only
          for (const symbol of result.symbols) {
            await this.store.createSymbol(symbol);
            stats.symbolsCreated++;
          }
          
          parseResults.push(result);
          stats.filesProcessed++;
        }
      } catch (error) {
        console.error(`[GraphBuilder] Error processing ${file}:`, error);
        stats.errors++;
      }
    }

    console.log(`[GraphBuilder] Pass 1 complete: ${stats.symbolsCreated} symbols created`);

    // Pass 2: Create all relations (now all symbols exist)
    for (const result of parseResults) {
      for (const relation of result.relations) {
        try {
          await this.store.createRelation(
            relation.from,
            relation.to,
            relation.type,
            relation.confidence
          );
          stats.relationsCreated++;
        } catch (error) {
          // Log but don't fail
          // console.warn(`[GraphBuilder] Relation error: ${relation.from} -> ${relation.to}`);
        }
      }
    }

    console.log(`[GraphBuilder] Pass 2 complete: ${stats.relationsCreated} relations created`);
    console.log(`[GraphBuilder] Build complete:`, stats);
    return stats;
  }

  async buildFromParseResult(result: ParseResult): Promise<void> {
    // Create symbols
    for (const symbol of result.symbols) {
      await this.store.createSymbol(symbol);
    }

    // Create relations
    for (const relation of result.relations) {
      try {
        await this.store.createRelation(
          relation.from,
          relation.to,
          relation.type,
          relation.confidence
        );
      } catch (error) {
        // Ignore relation errors (target might not exist yet)
        // This is expected for cross-file references
      }
    }
  }

  async buildClusters(): Promise<void> {
    // TODO: Implement Leiden clustering
    // For now, create a simple heuristic-based clustering
    console.log('[GraphBuilder] Cluster detection not yet implemented');
  }
}

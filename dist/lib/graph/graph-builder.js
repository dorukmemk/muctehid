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
exports.GraphBuilder = void 0;
const typescript_parser_js_1 = require("./parsers/typescript-parser.js");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const glob_1 = require("glob");
class GraphBuilder {
    store;
    tsParser;
    constructor(store) {
        this.store = store;
        this.tsParser = new typescript_parser_js_1.TypeScriptParser();
    }
    async buildFromDirectory(dirPath, extensions = ['.ts', '.tsx', '.js', '.jsx']) {
        const stats = {
            filesProcessed: 0,
            symbolsCreated: 0,
            relationsCreated: 0,
            errors: 0,
        };
        // Find all files
        const patterns = extensions.map(ext => `**/*${ext}`);
        const files = [];
        for (const pattern of patterns) {
            const matches = await (0, glob_1.glob)(pattern, {
                cwd: dirPath,
                absolute: true,
                ignore: ['**/node_modules/**', '**/dist/**', '**/.git/**', '**/build/**'],
            });
            files.push(...matches);
        }
        console.log(`[GraphBuilder] Found ${files.length} files to process`);
        // Process files
        for (const file of files) {
            try {
                const content = fs.readFileSync(file, 'utf-8');
                const ext = path.extname(file);
                let result = null;
                // Select parser based on extension
                if (['.ts', '.tsx'].includes(ext)) {
                    result = this.tsParser.parse(file, content);
                }
                else if (['.js', '.jsx'].includes(ext)) {
                    // Use TypeScript parser for JavaScript too (it handles both)
                    result = this.tsParser.parse(file, content);
                }
                if (result) {
                    await this.buildFromParseResult(result);
                    stats.filesProcessed++;
                    stats.symbolsCreated += result.symbols.length;
                    stats.relationsCreated += result.relations.length;
                }
            }
            catch (error) {
                console.error(`[GraphBuilder] Error processing ${file}:`, error);
                stats.errors++;
            }
        }
        console.log(`[GraphBuilder] Build complete:`, stats);
        return stats;
    }
    async buildFromParseResult(result) {
        // Create symbols
        for (const symbol of result.symbols) {
            await this.store.createSymbol(symbol);
        }
        // Create relations
        for (const relation of result.relations) {
            try {
                await this.store.createRelation(relation.from, relation.to, relation.type, relation.confidence);
            }
            catch (error) {
                // Ignore relation errors (target might not exist yet)
                // This is expected for cross-file references
            }
        }
    }
    async buildClusters() {
        // TODO: Implement Leiden clustering
        // For now, create a simple heuristic-based clustering
        console.log('[GraphBuilder] Cluster detection not yet implemented');
    }
}
exports.GraphBuilder = GraphBuilder;
//# sourceMappingURL=graph-builder.js.map
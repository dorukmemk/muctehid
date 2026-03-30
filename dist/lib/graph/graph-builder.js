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
const python_parser_js_1 = require("./parsers/python-parser.js");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const glob_1 = require("glob");
class GraphBuilder {
    store;
    tsParser;
    pyParser;
    constructor(store) {
        this.store = store;
        this.tsParser = new typescript_parser_js_1.TypeScriptParser();
        this.pyParser = new python_parser_js_1.PythonParser();
    }
    async buildFromDirectory(dirPath, extensions = ['.ts', '.tsx', '.js', '.jsx', '.py']) {
        const stats = {
            filesProcessed: 0,
            symbolsCreated: 0,
            relationsCreated: 0,
            relationsSkipped: 0,
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
        // ── PASS 1: Parse all files, create all symbols ────────────────────────
        const allParseResults = [];
        for (const file of files) {
            try {
                const content = fs.readFileSync(file, 'utf-8');
                const ext = path.extname(file);
                let result;
                if (['.py'].includes(ext)) {
                    result = await this.pyParser.parse(file, content);
                }
                else {
                    result = this.tsParser.parse(file, content);
                }
                for (const symbol of result.symbols) {
                    await this.store.createSymbol(symbol);
                    stats.symbolsCreated++;
                }
                allParseResults.push(result);
                stats.filesProcessed++;
            }
            catch (error) {
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
                const created = await this.store.createRelation(raw.fromUid, resolvedToUid, raw.type, raw.confidence);
                if (created) {
                    stats.relationsCreated++;
                }
                else {
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
    async buildNameIndex() {
        const allSymbols = await this.store.getAllSymbols();
        const index = new Map();
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
    resolveToUid(raw, nameIndex) {
        const candidates = nameIndex.get(raw.toName);
        if (!candidates || candidates.length === 0)
            return null;
        if (candidates.length === 1)
            return candidates[0];
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
                if (match)
                    return match;
            }
        }
        // Fallback: return first candidate (most likely same-file definition)
        return candidates[0];
    }
}
exports.GraphBuilder = GraphBuilder;
//# sourceMappingURL=graph-builder.js.map
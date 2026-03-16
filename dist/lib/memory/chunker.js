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
exports.detectLanguage = detectLanguage;
exports.chunkFile = chunkFile;
exports.shouldSkip = shouldSkip;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const LANGUAGE_MAP = {
    '.ts': 'typescript', '.tsx': 'typescript',
    '.js': 'javascript', '.jsx': 'javascript', '.mjs': 'javascript',
    '.py': 'python',
    '.go': 'go',
    '.rs': 'rust',
    '.java': 'java',
    '.cs': 'csharp',
    '.cpp': 'cpp', '.cc': 'cpp', '.cxx': 'cpp',
    '.c': 'c', '.h': 'c',
    '.rb': 'ruby',
    '.php': 'php',
    '.swift': 'swift',
    '.kt': 'kotlin',
    '.scala': 'scala',
    '.sh': 'shell', '.bash': 'shell',
    '.sql': 'sql',
    '.html': 'html', '.htm': 'html',
    '.css': 'css', '.scss': 'scss',
    '.json': 'json',
    '.yaml': 'yaml', '.yml': 'yaml',
    '.md': 'markdown',
    '.toml': 'toml',
};
function detectLanguage(filepath) {
    const ext = path.extname(filepath).toLowerCase();
    return LANGUAGE_MAP[ext] ?? 'text';
}
function chunkFile(filepath, chunkSize = 150, overlap = 20) {
    let content;
    try {
        content = fs.readFileSync(filepath, 'utf-8');
    }
    catch {
        return [];
    }
    const language = detectLanguage(filepath);
    const lines = content.split('\n');
    // Try smart chunking first (by function/class boundaries)
    const smartChunks = smartChunk(filepath, lines, language, chunkSize);
    if (smartChunks.length > 0)
        return smartChunks;
    // Fall back to line-based chunking
    return lineBasedChunk(filepath, lines, language, chunkSize, overlap);
}
function smartChunk(filepath, lines, language, maxSize) {
    const patterns = getSmartPatterns(language);
    if (patterns.length === 0)
        return [];
    const boundaries = [0];
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        for (const pattern of patterns) {
            if (pattern.test(line)) {
                if (i > 0)
                    boundaries.push(i);
                break;
            }
        }
    }
    boundaries.push(lines.length);
    const chunks = [];
    for (let b = 0; b < boundaries.length - 1; b++) {
        const start = boundaries[b];
        const end = boundaries[b + 1];
        const segmentLines = lines.slice(start, end);
        // Split large segments
        if (segmentLines.length > maxSize) {
            for (let i = 0; i < segmentLines.length; i += maxSize - 10) {
                const chunkLines = segmentLines.slice(i, i + maxSize);
                if (chunkLines.length === 0)
                    break;
                chunks.push({
                    filepath,
                    content: chunkLines.join('\n'),
                    startLine: start + i + 1,
                    endLine: start + i + chunkLines.length,
                    language,
                    symbols: extractSymbols(chunkLines.join('\n'), language),
                });
            }
        }
        else if (segmentLines.length > 0) {
            chunks.push({
                filepath,
                content: segmentLines.join('\n'),
                startLine: start + 1,
                endLine: end,
                language,
                symbols: extractSymbols(segmentLines.join('\n'), language),
            });
        }
    }
    return chunks;
}
function lineBasedChunk(filepath, lines, language, chunkSize, overlap) {
    const chunks = [];
    let i = 0;
    while (i < lines.length) {
        const end = Math.min(i + chunkSize, lines.length);
        const chunkLines = lines.slice(i, end);
        chunks.push({
            filepath,
            content: chunkLines.join('\n'),
            startLine: i + 1,
            endLine: end,
            language,
            symbols: extractSymbols(chunkLines.join('\n'), language),
        });
        i += chunkSize - overlap;
        if (i >= lines.length)
            break;
    }
    return chunks;
}
function getSmartPatterns(language) {
    switch (language) {
        case 'typescript':
        case 'javascript':
            return [
                /^(export\s+)?(default\s+)?(async\s+)?function\s+\w+/,
                /^(export\s+)?(default\s+)?(abstract\s+)?class\s+\w+/,
                /^(export\s+)?const\s+\w+\s*=\s*(async\s+)?\(/,
                /^(export\s+)?(interface|type|enum)\s+\w+/,
            ];
        case 'python':
            return [
                /^def\s+\w+/,
                /^async\s+def\s+\w+/,
                /^class\s+\w+/,
            ];
        case 'go':
            return [
                /^func\s+/,
                /^type\s+\w+\s+struct/,
                /^type\s+\w+\s+interface/,
            ];
        case 'rust':
            return [
                /^(pub\s+)?(async\s+)?fn\s+\w+/,
                /^(pub\s+)?struct\s+\w+/,
                /^(pub\s+)?enum\s+\w+/,
                /^impl\s+/,
            ];
        case 'java':
        case 'csharp':
            return [
                /^(public|private|protected|static|abstract).*\s+\w+\s*\(/,
                /^(public|private|protected).*class\s+\w+/,
            ];
        default:
            return [];
    }
}
function extractSymbols(content, language) {
    const symbols = [];
    const patterns = [];
    switch (language) {
        case 'typescript':
        case 'javascript':
            patterns.push(/(?:function|class|interface|type|enum)\s+(\w+)/g, /(?:const|let|var)\s+(\w+)\s*=/g, /(?:export\s+default\s+)(\w+)/g);
            break;
        case 'python':
            patterns.push(/(?:def|class)\s+(\w+)/g);
            break;
        case 'go':
            patterns.push(/func\s+(?:\(\w+\s+\*?\w+\)\s+)?(\w+)/g, /type\s+(\w+)/g);
            break;
        default:
            patterns.push(/(?:function|class|def|fn|func)\s+(\w+)/g);
    }
    for (const pattern of patterns) {
        let match;
        while ((match = pattern.exec(content)) !== null) {
            if (match[1] && !symbols.includes(match[1])) {
                symbols.push(match[1]);
            }
        }
    }
    return symbols.slice(0, 20);
}
function shouldSkip(filepath, excludePatterns) {
    const normalized = filepath.replace(/\\/g, '/');
    for (const pattern of excludePatterns) {
        if (pattern.startsWith('*.')) {
            if (normalized.endsWith(pattern.slice(1)))
                return true;
        }
        else if (normalized.includes(pattern)) {
            return true;
        }
    }
    return false;
}
//# sourceMappingURL=chunker.js.map
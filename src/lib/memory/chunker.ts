import * as fs from 'fs';
import * as path from 'path';

export interface RawChunk {
  filepath: string;
  content: string;
  startLine: number;
  endLine: number;
  language: string;
  symbols: string[];
}

const LANGUAGE_MAP: Record<string, string> = {
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

export function detectLanguage(filepath: string): string {
  const ext = path.extname(filepath).toLowerCase();
  return LANGUAGE_MAP[ext] ?? 'text';
}

export function chunkFile(filepath: string, chunkSize = 150, overlap = 20): RawChunk[] {
  let content: string;
  try {
    content = fs.readFileSync(filepath, 'utf-8');
  } catch {
    return [];
  }

  const language = detectLanguage(filepath);
  const lines = content.split('\n');

  // Try smart chunking first (by function/class boundaries)
  const smartChunks = smartChunk(filepath, lines, language, chunkSize);
  if (smartChunks.length > 0) return smartChunks;

  // Fall back to line-based chunking
  return lineBasedChunk(filepath, lines, language, chunkSize, overlap);
}

function smartChunk(filepath: string, lines: string[], language: string, maxSize: number): RawChunk[] {
  const patterns = getSmartPatterns(language);
  if (patterns.length === 0) return [];

  const boundaries: number[] = [0];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    for (const pattern of patterns) {
      if (pattern.test(line)) {
        if (i > 0) boundaries.push(i);
        break;
      }
    }
  }
  boundaries.push(lines.length);

  const chunks: RawChunk[] = [];

  for (let b = 0; b < boundaries.length - 1; b++) {
    const start = boundaries[b];
    const end = boundaries[b + 1];
    const segmentLines = lines.slice(start, end);

    // Split large segments
    if (segmentLines.length > maxSize) {
      for (let i = 0; i < segmentLines.length; i += maxSize - 10) {
        const chunkLines = segmentLines.slice(i, i + maxSize);
        if (chunkLines.length === 0) break;
        chunks.push({
          filepath,
          content: chunkLines.join('\n'),
          startLine: start + i + 1,
          endLine: start + i + chunkLines.length,
          language,
          symbols: extractSymbols(chunkLines.join('\n'), language),
        });
      }
    } else if (segmentLines.length > 0) {
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

function lineBasedChunk(filepath: string, lines: string[], language: string, chunkSize: number, overlap: number): RawChunk[] {
  const chunks: RawChunk[] = [];
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
    if (i >= lines.length) break;
  }

  return chunks;
}

function getSmartPatterns(language: string): RegExp[] {
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

function extractSymbols(content: string, language: string): string[] {
  const symbols: string[] = [];

  const patterns: RegExp[] = [];
  switch (language) {
    case 'typescript':
    case 'javascript':
      patterns.push(
        /(?:function|class|interface|type|enum)\s+(\w+)/g,
        /(?:const|let|var)\s+(\w+)\s*=/g,
        /(?:export\s+default\s+)(\w+)/g,
      );
      break;
    case 'python':
      patterns.push(
        /(?:def|class)\s+(\w+)/g,
      );
      break;
    case 'go':
      patterns.push(
        /func\s+(?:\(\w+\s+\*?\w+\)\s+)?(\w+)/g,
        /type\s+(\w+)/g,
      );
      break;
    default:
      patterns.push(/(?:function|class|def|fn|func)\s+(\w+)/g);
  }

  for (const pattern of patterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(content)) !== null) {
      if (match[1] && !symbols.includes(match[1])) {
        symbols.push(match[1]);
      }
    }
  }

  return symbols.slice(0, 20);
}

export function shouldSkip(filepath: string, excludePatterns: string[]): boolean {
  const normalized = filepath.replace(/\\/g, '/');
  for (const pattern of excludePatterns) {
    if (pattern.startsWith('*.')) {
      if (normalized.endsWith(pattern.slice(1))) return true;
    } else if (normalized.includes(pattern)) {
      return true;
    }
  }
  return false;
}

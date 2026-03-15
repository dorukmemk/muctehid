import * as fs from 'fs';
import { AuditIssue } from '../../types/index.js';
import * as crypto from 'crypto';

interface ComplexityResult {
  filepath: string;
  functions: FunctionComplexity[];
  avgComplexity: number;
  maxComplexity: number;
}

interface FunctionComplexity {
  name: string;
  line: number;
  complexity: number;
}

// Control flow keywords that add to cyclomatic complexity
const COMPLEXITY_PATTERNS = [
  /\bif\b/, /\belse if\b/, /\belif\b/, /\bfor\b/, /\bwhile\b/,
  /\bdo\b/, /\bcase\b/, /\bcatch\b/, /\b&&\b/, /\b\|\|\b/,
  /\?\s*[^:]+:/, // ternary
  /\bswitch\b/,
];

export function analyzeComplexity(filepath: string): ComplexityResult {
  let src: string;
  try {
    src = fs.readFileSync(filepath, 'utf-8');
  } catch {
    return { filepath, functions: [], avgComplexity: 0, maxComplexity: 0 };
  }

  const lines = src.split('\n');
  const functions: FunctionComplexity[] = [];
  let currentFunc: { name: string; line: number; complexity: number } | null = null;
  let braceDepth = 0;
  let funcBraceStart = 0;

  const funcPattern = /(?:function\s+(\w+)|(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?(?:function|\()|(async\s+)?(\w+)\s*\([^)]*\)\s*(?::\s*\w+)?\s*\{|def\s+(\w+)|func\s+(\w+))/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const funcMatch = funcPattern.exec(line);

    if (funcMatch && braceDepth === 0) {
      const name = funcMatch[1] ?? funcMatch[2] ?? funcMatch[4] ?? funcMatch[5] ?? funcMatch[6] ?? 'anonymous';
      currentFunc = { name, line: i + 1, complexity: 1 };
      funcBraceStart = braceDepth;
    }

    if (currentFunc) {
      for (const pattern of COMPLEXITY_PATTERNS) {
        if (pattern.test(line)) currentFunc.complexity++;
      }
    }

    // Track brace depth
    for (const ch of line) {
      if (ch === '{') braceDepth++;
      if (ch === '}') {
        braceDepth--;
        if (currentFunc && braceDepth <= funcBraceStart) {
          functions.push({ ...currentFunc });
          currentFunc = null;
        }
      }
    }
  }

  if (functions.length === 0) return { filepath, functions: [], avgComplexity: 0, maxComplexity: 0 };

  const avg = functions.reduce((s, f) => s + f.complexity, 0) / functions.length;
  const max = Math.max(...functions.map(f => f.complexity));

  return { filepath, functions, avgComplexity: avg, maxComplexity: max };
}

export function complexityIssues(filepath: string): AuditIssue[] {
  const result = analyzeComplexity(filepath);
  const issues: AuditIssue[] = [];

  for (const fn of result.functions) {
    if (fn.complexity >= 20) {
      issues.push({
        id: crypto.randomUUID(),
        severity: 'high',
        category: 'quality',
        title: `Very high cyclomatic complexity: ${fn.name}`,
        description: `Function "${fn.name}" has cyclomatic complexity of ${fn.complexity}. Very hard to test and maintain.`,
        filepath,
        line: fn.line,
        fix: 'Break this function into smaller, focused functions.',
      });
    } else if (fn.complexity >= 10) {
      issues.push({
        id: crypto.randomUUID(),
        severity: 'medium',
        category: 'quality',
        title: `High cyclomatic complexity: ${fn.name}`,
        description: `Function "${fn.name}" has cyclomatic complexity of ${fn.complexity}.`,
        filepath,
        line: fn.line,
        fix: 'Consider refactoring to reduce complexity.',
      });
    }
  }

  return issues;
}

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
exports.analyzeComplexity = analyzeComplexity;
exports.complexityIssues = complexityIssues;
const fs = __importStar(require("fs"));
const crypto = __importStar(require("crypto"));
// Control flow keywords that add to cyclomatic complexity
const COMPLEXITY_PATTERNS = [
    /\bif\b/, /\belse if\b/, /\belif\b/, /\bfor\b/, /\bwhile\b/,
    /\bdo\b/, /\bcase\b/, /\bcatch\b/, /\b&&\b/, /\b\|\|\b/,
    /\?\s*[^:]+:/, // ternary
    /\bswitch\b/,
];
function analyzeComplexity(filepath) {
    let src;
    try {
        src = fs.readFileSync(filepath, 'utf-8');
    }
    catch {
        return { filepath, functions: [], avgComplexity: 0, maxComplexity: 0 };
    }
    const lines = src.split('\n');
    const functions = [];
    let currentFunc = null;
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
                if (pattern.test(line))
                    currentFunc.complexity++;
            }
        }
        // Track brace depth
        for (const ch of line) {
            if (ch === '{')
                braceDepth++;
            if (ch === '}') {
                braceDepth--;
                if (currentFunc && braceDepth <= funcBraceStart) {
                    functions.push({ ...currentFunc });
                    currentFunc = null;
                }
            }
        }
    }
    if (functions.length === 0)
        return { filepath, functions: [], avgComplexity: 0, maxComplexity: 0 };
    const avg = functions.reduce((s, f) => s + f.complexity, 0) / functions.length;
    const max = Math.max(...functions.map(f => f.complexity));
    return { filepath, functions, avgComplexity: avg, maxComplexity: max };
}
function complexityIssues(filepath) {
    const result = analyzeComplexity(filepath);
    const issues = [];
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
        }
        else if (fn.complexity >= 10) {
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
//# sourceMappingURL=complexity.js.map
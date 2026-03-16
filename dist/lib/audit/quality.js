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
exports.scanQuality = scanQuality;
exports.scanTodos = scanTodos;
const fs = __importStar(require("fs"));
const crypto = __importStar(require("crypto"));
const QUALITY_PATTERNS = [
    {
        pattern: /TODO|FIXME|HACK|XXX|BUG|WORKAROUND/,
        title: 'Technical debt marker',
        description: 'TODO/FIXME/HACK comment indicates unfinished work.',
        fix: 'Address the issue described in the comment.',
        severity: 'low',
    },
    {
        pattern: /console\.log\(|console\.debug\(|print\(/,
        title: 'Debug logging in code',
        description: 'Debug log statement should be removed before production.',
        fix: 'Remove debug logs or replace with proper structured logging.',
        severity: 'low',
    },
    {
        pattern: /catch\s*\([^)]*\)\s*\{\s*\}/,
        title: 'Empty catch block',
        description: 'Swallowed exception — errors are silently ignored.',
        fix: 'Log or handle the exception properly.',
        severity: 'medium',
    },
    {
        pattern: /catch\s*\([^)]*\)\s*\{\s*\/\//,
        title: 'Catch block with only comment',
        description: 'Exception is silently swallowed (only a comment inside catch).',
        fix: 'Handle or re-throw the exception.',
        severity: 'low',
    },
    {
        pattern: /\bany\b/,
        title: 'TypeScript any usage',
        description: 'Using "any" type defeats TypeScript type safety.',
        fix: 'Use proper types or unknown instead of any.',
        severity: 'low',
    },
    {
        pattern: /var\s+\w+/,
        title: 'var declaration',
        description: 'var has function scope and can cause bugs. Prefer const/let.',
        fix: 'Replace var with const or let.',
        severity: 'low',
    },
    {
        pattern: /==\s*null|null\s*==/,
        title: 'Loose null comparison',
        description: 'Use strict equality (===) for null comparisons.',
        fix: 'Use === null instead of == null (unless intentional nullish check).',
        severity: 'low',
    },
];
function scanQuality(filepath, content) {
    const issues = [];
    let src;
    try {
        src = content ?? fs.readFileSync(filepath, 'utf-8');
    }
    catch {
        return [];
    }
    const lines = src.split('\n');
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        for (const qp of QUALITY_PATTERNS) {
            if (qp.pattern.test(line)) {
                issues.push({
                    id: crypto.randomUUID(),
                    severity: qp.severity,
                    category: 'quality',
                    title: qp.title,
                    description: qp.description,
                    filepath,
                    line: i + 1,
                    code: line.trim().slice(0, 200),
                    fix: qp.fix,
                });
            }
        }
    }
    return issues;
}
function scanTodos(filepath, content) {
    const todos = [];
    let src;
    try {
        src = content ?? fs.readFileSync(filepath, 'utf-8');
    }
    catch {
        return [];
    }
    const lines = src.split('\n');
    const todoPattern = /\b(TODO|FIXME|HACK|XXX|BUG|WORKAROUND|NOTE|OPTIMIZE)\b[:\s]*(.*)/i;
    for (let i = 0; i < lines.length; i++) {
        const match = todoPattern.exec(lines[i]);
        if (match) {
            todos.push({
                line: i + 1,
                type: match[1].toUpperCase(),
                text: match[2].trim() || lines[i].trim(),
            });
        }
    }
    return todos;
}
//# sourceMappingURL=quality.js.map
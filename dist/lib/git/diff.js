"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUncommittedDiff = getUncommittedDiff;
exports.getStagedDiff = getStagedDiff;
exports.parseDiff = parseDiff;
const simple_git_1 = __importDefault(require("simple-git"));
async function getUncommittedDiff(repoPath) {
    const git = (0, simple_git_1.default)(repoPath);
    try {
        const diff = await git.diff(['HEAD']);
        return diff || await git.diff();
    }
    catch {
        return await git.diff().catch(() => '');
    }
}
async function getStagedDiff(repoPath) {
    const git = (0, simple_git_1.default)(repoPath);
    return git.diff(['--staged']).catch(() => '');
}
function parseDiff(diff) {
    const files = [];
    if (!diff)
        return files;
    const fileBlocks = diff.split(/^diff --git/m).filter(Boolean);
    for (const block of fileBlocks) {
        const filenameMatch = /b\/(.+)$/m.exec(block);
        if (!filenameMatch)
            continue;
        const filepath = filenameMatch[1].trim();
        const hunks = [];
        const hunkBlocks = block.split(/^@@/m).slice(1);
        for (const hunk of hunkBlocks) {
            const headerMatch = /^([^@]+)@@/.exec(hunk);
            const header = headerMatch ? `@@${headerMatch[1]}@@` : '';
            const rangeMatch = /-(\d+)(?:,\d+)? \+(\d+)/.exec(hunk);
            const oldStart = rangeMatch ? parseInt(rangeMatch[1]) : 0;
            const newStart = rangeMatch ? parseInt(rangeMatch[2]) : 0;
            const lines = [];
            const hunkLines = hunk.split('\n').slice(1); // skip header line
            let lineNum = newStart;
            for (const line of hunkLines) {
                if (line.startsWith('+') && !line.startsWith('+++')) {
                    lines.push({ type: 'add', content: line.slice(1), lineNumber: lineNum++ });
                }
                else if (line.startsWith('-') && !line.startsWith('---')) {
                    lines.push({ type: 'remove', content: line.slice(1) });
                }
                else if (line.startsWith(' ')) {
                    lines.push({ type: 'context', content: line.slice(1), lineNumber: lineNum++ });
                }
            }
            hunks.push({ header, oldStart, newStart, lines });
        }
        files.push({ filepath, hunks });
    }
    return files;
}
//# sourceMappingURL=diff.js.map
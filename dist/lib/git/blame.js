"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getBlame = getBlame;
exports.getCommitHistory = getCommitHistory;
const simple_git_1 = __importDefault(require("simple-git"));
async function getBlame(repoPath, filepath) {
    const git = (0, simple_git_1.default)(repoPath);
    const entries = [];
    try {
        const result = await git.raw(['blame', '--line-porcelain', filepath]);
        const lines = result.split('\n');
        let i = 0;
        while (i < lines.length) {
            const commitLine = lines[i];
            if (!/^[0-9a-f]{40}/.test(commitLine)) {
                i++;
                continue;
            }
            const commit = commitLine.slice(0, 40);
            const lineNum = parseInt(commitLine.split(' ')[2] ?? '0');
            let author = '';
            let date = '';
            while (i < lines.length && !lines[i].startsWith('\t')) {
                if (lines[i].startsWith('author '))
                    author = lines[i].slice(7);
                if (lines[i].startsWith('author-time ')) {
                    date = new Date(parseInt(lines[i].slice(12)) * 1000).toISOString();
                }
                i++;
            }
            const content = lines[i]?.startsWith('\t') ? lines[i].slice(1) : '';
            entries.push({ commit: commit.slice(0, 8), author, date, line: lineNum, content });
            i++;
        }
    }
    catch { /* git blame may fail on new files */ }
    return entries;
}
async function getCommitHistory(repoPath, searchQuery, limit = 50) {
    const git = (0, simple_git_1.default)(repoPath);
    try {
        const log = await git.log([`--max-count=${limit}`, '--format=%H|%an|%ai|%s']);
        const commits = log.all.map(c => ({
            hash: c.hash.slice(0, 8),
            author: c.author_name,
            date: c.date,
            message: c.message,
        }));
        if (!searchQuery)
            return commits;
        const lower = searchQuery.toLowerCase();
        return commits.filter(c => c.message.toLowerCase().includes(lower) || c.author.toLowerCase().includes(lower));
    }
    catch {
        return [];
    }
}
//# sourceMappingURL=blame.js.map
import simpleGit from 'simple-git';
import { GitBlameEntry } from '../../types/index.js';

export async function getBlame(repoPath: string, filepath: string): Promise<GitBlameEntry[]> {
  const git = simpleGit(repoPath);
  const entries: GitBlameEntry[] = [];

  try {
    const result = await git.raw(['blame', '--line-porcelain', filepath]);
    const lines = result.split('\n');
    let i = 0;

    while (i < lines.length) {
      const commitLine = lines[i];
      if (!/^[0-9a-f]{40}/.test(commitLine)) { i++; continue; }

      const commit = commitLine.slice(0, 40);
      const lineNum = parseInt(commitLine.split(' ')[2] ?? '0');

      let author = '';
      let date = '';

      while (i < lines.length && !lines[i].startsWith('\t')) {
        if (lines[i].startsWith('author ')) author = lines[i].slice(7);
        if (lines[i].startsWith('author-time ')) {
          date = new Date(parseInt(lines[i].slice(12)) * 1000).toISOString();
        }
        i++;
      }

      const content = lines[i]?.startsWith('\t') ? lines[i].slice(1) : '';
      entries.push({ commit: commit.slice(0, 8), author, date, line: lineNum, content });
      i++;
    }
  } catch { /* git blame may fail on new files */ }

  return entries;
}

export async function getCommitHistory(repoPath: string, searchQuery?: string, limit = 50): Promise<Array<{ hash: string; author: string; date: string; message: string }>> {
  const git = simpleGit(repoPath);

  try {
    const log = await git.log([`--max-count=${limit}`, '--format=%H|%an|%ai|%s']);
    const commits = log.all.map(c => ({
      hash: c.hash.slice(0, 8),
      author: c.author_name,
      date: c.date,
      message: c.message,
    }));

    if (!searchQuery) return commits;
    const lower = searchQuery.toLowerCase();
    return commits.filter(c => c.message.toLowerCase().includes(lower) || c.author.toLowerCase().includes(lower));
  } catch {
    return [];
  }
}

import simpleGit, { SimpleGit } from 'simple-git';
import { DiffHunk, DiffLine } from '../../types/index.js';

export async function getUncommittedDiff(repoPath: string): Promise<string> {
  const git: SimpleGit = simpleGit(repoPath);
  try {
    const diff = await git.diff(['HEAD']);
    return diff || await git.diff();
  } catch {
    return await git.diff().catch(() => '');
  }
}

export async function getStagedDiff(repoPath: string): Promise<string> {
  const git: SimpleGit = simpleGit(repoPath);
  return git.diff(['--staged']).catch(() => '');
}

export function parseDiff(diff: string): Array<{ filepath: string; hunks: DiffHunk[] }> {
  const files: Array<{ filepath: string; hunks: DiffHunk[] }> = [];
  if (!diff) return files;

  const fileBlocks = diff.split(/^diff --git/m).filter(Boolean);

  for (const block of fileBlocks) {
    const filenameMatch = /b\/(.+)$/m.exec(block);
    if (!filenameMatch) continue;

    const filepath = filenameMatch[1].trim();
    const hunks: DiffHunk[] = [];
    const hunkBlocks = block.split(/^@@/m).slice(1);

    for (const hunk of hunkBlocks) {
      const headerMatch = /^([^@]+)@@/.exec(hunk);
      const header = headerMatch ? `@@${headerMatch[1]}@@` : '';

      const rangeMatch = /-(\d+)(?:,\d+)? \+(\d+)/.exec(hunk);
      const oldStart = rangeMatch ? parseInt(rangeMatch[1]) : 0;
      const newStart = rangeMatch ? parseInt(rangeMatch[2]) : 0;

      const lines: DiffLine[] = [];
      const hunkLines = hunk.split('\n').slice(1); // skip header line
      let lineNum = newStart;

      for (const line of hunkLines) {
        if (line.startsWith('+') && !line.startsWith('+++')) {
          lines.push({ type: 'add', content: line.slice(1), lineNumber: lineNum++ });
        } else if (line.startsWith('-') && !line.startsWith('---')) {
          lines.push({ type: 'remove', content: line.slice(1) });
        } else if (line.startsWith(' ')) {
          lines.push({ type: 'context', content: line.slice(1), lineNumber: lineNum++ });
        }
      }

      hunks.push({ header, oldStart, newStart, lines });
    }

    files.push({ filepath, hunks });
  }

  return files;
}

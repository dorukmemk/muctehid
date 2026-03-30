#!/usr/bin/env python3
"""
git_blame_analyzer.py — Analyzes git blame for a file to trace bug origins.
Extracts: commit hash, author, date, commit message for each line.
Identifies: when broken code was introduced, regression detection, commit intent.

Usage:
  python git_blame_analyzer.py <file> [start_line] [end_line]
  python git_blame_analyzer.py <file> --line 47
  python git_blame_analyzer.py <file> --recent 10    # last 10 changed lines

Output: JSON with blame data, commit metadata, and regression indicators.
"""

import os
import re
import sys
import json
import subprocess
from pathlib import Path
from datetime import datetime


def run_git_command(args: list, cwd: str = None) -> tuple:
    """Run a git command and return (stdout, stderr, returncode)."""
    try:
        result = subprocess.run(
            ["git"] + args,
            cwd=cwd,
            capture_output=True,
            text=True,
            timeout=30,
        )
        return result.stdout, result.stderr, result.returncode
    except subprocess.TimeoutExpired:
        return "", "Command timed out", 1
    except FileNotFoundError:
        return "", "git not found in PATH", 1
    except Exception as e:
        return "", str(e), 1


def find_git_root(filepath: str) -> str | None:
    """Find the git repository root from a file path."""
    current = Path(filepath).parent if Path(filepath).is_file() else Path(filepath)
    while current != current.parent:
        if (current / ".git").exists():
            return str(current)
        current = current.parent
    return None


def parse_blame_output(blame_output: str) -> list:
    """Parse git blame --porcelain output."""
    entries = []
    lines = blame_output.split("\n")

    current_commit = {}
    current_line_num = None

    for line in lines:
        # Commit hash line: 40-char hex + line numbers
        hash_match = re.match(r"^([0-9a-f]{40})\s+(\d+)\s+(\d+)", line)
        if hash_match:
            current_commit = {"hash": hash_match.group(1)}
            current_line_num = int(hash_match.group(3))
            continue

        # Metadata lines
        if line.startswith("author "):
            current_commit["author"] = line[7:].strip()
        elif line.startswith("author-mail "):
            current_commit["author_email"] = line[12:].strip().strip("<>")
        elif line.startswith("author-time "):
            ts = int(line[12:].strip())
            current_commit["date"] = datetime.fromtimestamp(ts).strftime("%Y-%m-%d")
        elif line.startswith("summary "):
            current_commit["commit_message"] = line[8:].strip()
        elif line.startswith("\t"):
            # Content line — marks end of entry
            if current_commit and current_line_num:
                current_commit["line_num"] = current_line_num
                current_commit["content"] = line[1:]  # strip leading tab
                entries.append(dict(current_commit))
            current_commit = {}
            current_line_num = None

    return entries


def get_commit_details(commit_hash: str, git_root: str) -> dict:
    """Get detailed info about a specific commit."""
    stdout, _, rc = run_git_command(
        ["show", "--stat", "--format=%H%n%an%n%ae%n%ai%n%s%n%b", commit_hash + "^..HEAD"],
        cwd=git_root,
    )

    if rc != 0:
        # Try single commit
        stdout, _, rc = run_git_command(
            ["show", "--stat", "--format=%H|%an|%ai|%s", "-s", commit_hash],
            cwd=git_root,
        )

    details = {"hash": commit_hash}
    if stdout:
        first_line = stdout.strip().split("\n")[0]
        parts = first_line.split("|")
        if len(parts) >= 4:
            details["author"] = parts[1]
            details["date"] = parts[2][:10]
            details["message"] = parts[3]

    return details


def detect_regression(entries: list, git_root: str) -> dict:
    """Check if the bug code is a regression (was it working before?)."""
    if not entries:
        return {"is_regression": False, "evidence": "No blame data"}

    # Get unique commits in the blame range
    commits = list({e["hash"]: e for e in entries if e.get("hash")}.values())
    if len(commits) <= 1:
        return {"is_regression": False, "evidence": "Code appears in only one commit"}

    # Sort by date
    commits_with_dates = [c for c in commits if c.get("date")]
    if not commits_with_dates:
        return {"is_regression": False, "evidence": "No date information available"}

    sorted_commits = sorted(commits_with_dates, key=lambda x: x.get("date", ""), reverse=True)
    most_recent = sorted_commits[0]
    oldest = sorted_commits[-1]

    return {
        "is_regression": len(sorted_commits) > 1,
        "introduced_in": most_recent.get("hash", "")[:8],
        "introduced_date": most_recent.get("date", ""),
        "introduced_by": most_recent.get("author", ""),
        "commit_message": most_recent.get("commit_message", ""),
        "original_version_date": oldest.get("date", ""),
        "evidence": (
            f"Code was last changed in {most_recent.get('date', 'unknown')} "
            f"by {most_recent.get('author', 'unknown')} "
            f"(commit: {most_recent.get('hash', '')[:8]})"
        ),
    }


def analyze_blame(filepath: str, start_line: int = None, end_line: int = None) -> dict:
    """Main blame analysis function."""
    abs_path = os.path.abspath(filepath)

    if not os.path.exists(abs_path):
        return {"error": f"File not found: {filepath}"}

    git_root = find_git_root(abs_path)
    if not git_root:
        return {"error": "Not a git repository", "file": filepath}

    rel_path = os.path.relpath(abs_path, git_root)

    # Build blame command
    blame_args = ["blame", "--porcelain"]
    if start_line and end_line:
        blame_args += [f"-L{start_line},{end_line}"]
    elif start_line:
        blame_args += [f"-L{start_line},{start_line + 10}"]

    blame_args.append(rel_path)

    stdout, stderr, rc = run_git_command(blame_args, cwd=git_root)

    if rc != 0:
        return {"error": f"git blame failed: {stderr}", "file": filepath}

    entries = parse_blame_output(stdout)

    if not entries:
        return {"error": "No blame data returned", "file": filepath}

    # Aggregate by commit
    commits_seen = {}
    for entry in entries:
        h = entry.get("hash", "")[:8]
        if h not in commits_seen:
            commits_seen[h] = {
                "hash": entry.get("hash", ""),
                "short_hash": h,
                "author": entry.get("author", ""),
                "date": entry.get("date", ""),
                "commit_message": entry.get("commit_message", ""),
                "lines": [],
            }
        commits_seen[h]["lines"].append(entry.get("line_num"))

    commits_list = sorted(commits_seen.values(), key=lambda x: x.get("date", ""), reverse=True)

    regression = detect_regression(entries, git_root)

    # Recent file log
    log_stdout, _, _ = run_git_command(
        ["log", "--oneline", "-5", rel_path],
        cwd=git_root,
    )
    recent_commits = [line.strip() for line in log_stdout.strip().split("\n") if line.strip()]

    return {
        "file": filepath,
        "git_root": git_root,
        "lines_analyzed": len(entries),
        "commits_in_range": len(commits_list),
        "commits": commits_list[:5],
        "most_recent_change": commits_list[0] if commits_list else None,
        "regression": regression,
        "recent_file_history": recent_commits,
        "summary": (
            f"Bug introduced by {regression.get('introduced_by', '?')} "
            f"on {regression.get('introduced_date', '?')} "
            f"(commit: {regression.get('introduced_in', '?')}) — "
            f'"{regression.get("commit_message", "")}"'
            if regression.get("is_regression")
            else "Code appears in original commit — not a regression"
        ),
    }


def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Usage: python git_blame_analyzer.py <file> [start_line] [end_line]"}, indent=2))
        sys.exit(1)

    filepath = sys.argv[1]
    start_line = None
    end_line = None

    # Parse --line flag
    for i, arg in enumerate(sys.argv):
        if arg == "--line" and i + 1 < len(sys.argv):
            try:
                start_line = int(sys.argv[i + 1])
                end_line = start_line + 10
            except ValueError:
                pass

    # Positional line args
    if len(sys.argv) >= 3 and sys.argv[2].isdigit():
        start_line = int(sys.argv[2])
    if len(sys.argv) >= 4 and sys.argv[3].isdigit():
        end_line = int(sys.argv[3])

    result = analyze_blame(filepath, start_line, end_line)
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()

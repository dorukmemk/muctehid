#!/usr/bin/env python3
"""
compress_session.py — Analyzes session state files and generates compression summaries.
Reads .plan/ directory, conversation logs, and any structured session files.
Produces a structured Anchored Iterative Summary that can replace the full session.

Usage:
  python compress_session.py <path>              # analyze + compress
  python compress_session.py <path> --analyze-only  # show stats without writing
  python compress_session.py <path> --output <out>  # write to specific file

Output: Structured session summary in Markdown format.
"""

import os
import re
import sys
import json
from pathlib import Path
from datetime import datetime

CHARS_PER_TOKEN = 4

# Files that contain compressible session state
SESSION_FILE_PATTERNS = {
    "task_plan": r"task_plan\.md$",
    "findings": r"findings\.md$",
    "progress": r"progress\.md$",
    "session_summary": r"session_summary\.md$",
    "conversation": r"conversation\.(json|md)$",
}

# Patterns to extract structured info from session files
EXTRACTION_PATTERNS = {
    "file_modifications": [
        r"(?:modified|changed|updated|created|wrote|edited)[:\s]+([`\"]?[\w./\\-]+\.[a-z]+[`\"]?)",
        r"Edit(?:ed)?\s+([`\"]?[\w./\\-]+\.[a-z]+[`\"]?)",
        r"Write\s+.*?([`\"]?src/[\w./\\-]+\.[a-z]+[`\"]?)",
    ],
    "decisions": [
        r"(?:decided|decision|chose|choosing|going with)[:\s]+(.{20,100})",
        r"✅\s+(.{10,80})",
    ],
    "blockers": [
        r"(?:BLOCKED|blocked|blocker)[:\s]+(.{10,100})",
        r"(?:error|failed|broken)[:\s]+(.{10,100})",
    ],
    "next_steps": [
        r"(?:next[:\s]+|TODO[:\s]+|next step[:\s]+)(.{10,80})",
        r"\[ \]\s+(.{10,80})",
        r"- \[ \]\s+(.{10,80})",
    ],
    "completed_tasks": [
        r"\[x\]\s+(.{10,80})",
        r"- \[x\]\s+(.{10,80})",
        r"✅\s+(.{10,80})",
    ],
}


def read_file_safe(filepath: str) -> str:
    """Read a file, returning empty string on error."""
    try:
        with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
            return f.read()
    except Exception:
        return ""


def estimate_tokens(text: str) -> int:
    return max(1, len(text) // CHARS_PER_TOKEN)


def extract_patterns(content: str, category: str) -> list:
    """Extract structured information from content using regex patterns."""
    results = []
    for pattern in EXTRACTION_PATTERNS.get(category, []):
        matches = re.finditer(pattern, content, re.IGNORECASE | re.MULTILINE)
        for m in matches:
            item = m.group(1).strip().rstrip(".,;")
            if item and item not in results:
                results.append(item)
    return results[:10]  # limit to 10 per category


def find_session_files(root_dir: str) -> dict:
    """Find all session-relevant files in the given directory."""
    root = Path(root_dir)
    found = {}

    # Check .plan/ directory
    plan_dir = root / ".plan"
    if plan_dir.exists():
        for f in plan_dir.iterdir():
            if f.is_file() and f.suffix in {".md", ".json", ".txt"}:
                found[f.name] = str(f)

    # Check root for session files
    for filename, pattern in SESSION_FILE_PATTERNS.items():
        for f in root.rglob("*"):
            if re.search(pattern, str(f), re.IGNORECASE):
                if str(f) not in found.values():
                    found[filename] = str(f)
                break

    return found


def analyze_session(root_dir: str) -> dict:
    """Analyze session state and extract compressible content."""
    session_files = find_session_files(root_dir)

    all_content = ""
    file_stats = {}

    for name, filepath in session_files.items():
        content = read_file_safe(filepath)
        tokens = estimate_tokens(content)
        file_stats[name] = {"path": filepath, "tokens": tokens, "chars": len(content)}
        all_content += f"\n\n=== {name} ===\n{content}"

    total_tokens = sum(s["tokens"] for s in file_stats.values())

    # Extract structured information
    extracted = {
        "file_modifications": extract_patterns(all_content, "file_modifications"),
        "decisions": extract_patterns(all_content, "decisions"),
        "blockers": extract_patterns(all_content, "blockers"),
        "next_steps": extract_patterns(all_content, "next_steps"),
        "completed_tasks": extract_patterns(all_content, "completed_tasks"),
    }

    return {
        "session_files": file_stats,
        "total_tokens": total_tokens,
        "extracted": extracted,
        "raw_content": all_content,
    }


def generate_summary(analysis: dict, goal_hint: str = "") -> str:
    """Generate a structured compression summary from analysis results."""
    now = datetime.now().strftime("%Y-%m-%d %H:%M")
    total_tokens = analysis["total_tokens"]
    extracted = analysis["extracted"]

    # Build file modifications table
    mods = extracted["file_modifications"]
    if mods:
        mod_rows = "\n".join(f"| {f} | (detected) | ❓ Verify |" for f in mods[:8])
        files_section = f"""## Files Modified
| File | Change | Status |
|------|--------|--------|
{mod_rows}
"""
    else:
        files_section = "## Files Modified\n_No file modifications detected — verify manually._\n"

    # Build decisions section
    decisions = extracted["decisions"]
    decisions_section = "## Decisions Made\n"
    if decisions:
        decisions_section += "\n".join(f"- {d}" for d in decisions[:5]) + "\n"
    else:
        decisions_section += "_No explicit decisions detected._\n"

    # Build next steps
    next_steps = extracted["next_steps"]
    next_section = "## Next Steps (Ordered)\n"
    if next_steps:
        next_section += "\n".join(f"{i+1}. {s}" for i, s in enumerate(next_steps[:5])) + "\n"
    else:
        next_section += "1. _Review session state and determine next action_\n"

    # Build completed tasks
    completed = extracted["completed_tasks"]
    state_section = "## Current State\n"
    if completed:
        state_section += "**Completed:**\n" + "\n".join(f"- ✅ {t}" for t in completed[:5]) + "\n"

    # Build blockers
    blockers = extracted["blockers"]
    if blockers:
        state_section += "\n**Blocked:**\n" + "\n".join(f"- 🚫 {b}" for b in blockers[:3]) + "\n"

    # Estimate compressed size
    summary_template_tokens = 400  # approximate template overhead
    extracted_tokens = sum(len(items) * 15 for items in extracted.values())
    compressed_tokens = summary_template_tokens + extracted_tokens
    ratio = round(total_tokens / max(compressed_tokens, 1), 1)

    summary = f"""---
compressed_at: {now}
tokens_before: ~{total_tokens}
tokens_after: ~{compressed_tokens}
compression_ratio: {ratio}x
source_files: {len(analysis['session_files'])}
---

## Session Intent
{goal_hint if goal_hint else "_Review .plan/task_plan.md for the original goal sentence_"}

{files_section}
## Files Read (Not Modified)
_Review session files to identify read-only access patterns_

{decisions_section}
## Issues Encountered & Resolved
_Review findings.md → Issues section for logged errors_

{state_section}
{next_section}
## Open Questions
_Review progress.md for any BLOCKED or DEFERRED items_

## Key Context (Do Not Lose)
{chr(10).join(f"- {item}" for item in (completed + next_steps)[:4]) if (completed + next_steps) else "- _Review source files for critical facts_"}
"""

    return summary


def main():
    if len(sys.argv) < 2:
        print("Usage: python compress_session.py <path> [--analyze-only] [--output <file>]")
        sys.exit(1)

    root_dir = sys.argv[1]
    analyze_only = "--analyze-only" in sys.argv
    output_path = None

    for i, arg in enumerate(sys.argv):
        if arg == "--output" and i + 1 < len(sys.argv):
            output_path = sys.argv[i + 1]

    if not os.path.exists(root_dir):
        print(json.dumps({"error": f"Path not found: {root_dir}"}, indent=2))
        sys.exit(1)

    analysis = analyze_session(root_dir)

    if analyze_only:
        # Just print stats
        stats = {
            "session_files_found": len(analysis["session_files"]),
            "total_tokens_estimated": analysis["total_tokens"],
            "files": {name: s["tokens"] for name, s in analysis["session_files"].items()},
            "extracted_counts": {k: len(v) for k, v in analysis["extracted"].items()},
        }
        print(json.dumps(stats, indent=2))
        return

    summary = generate_summary(analysis)

    if output_path:
        os.makedirs(os.path.dirname(output_path) if os.path.dirname(output_path) else ".", exist_ok=True)
        with open(output_path, "w", encoding="utf-8") as f:
            f.write(summary)
        print(json.dumps({"status": "written", "path": output_path}, indent=2))
    else:
        print(summary)


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""
dsp_bootstrap.py — Bootstrap, update, search, and validate a DSP graph.
Creates/maintains the .dsp/ directory as a structural memory index for LLM agents.

Actions:
  bootstrap  — Initial index creation for a new project
  update     — Sync DSP with code changes (detect new/deleted/modified files)
  search     — Query the graph by name, description, or imports
  validate   — Check graph integrity (missing entries, broken refs, empty descriptions)
  --new-uid  — Generate a new random UID

Usage:
  python dsp_bootstrap.py <path> --action bootstrap
  python dsp_bootstrap.py <path> --action update
  python dsp_bootstrap.py <path> --action search --query "auth"
  python dsp_bootstrap.py <path> --action validate
  python dsp_bootstrap.py --new-uid
"""

import os
import re
import sys
import json
import hashlib
import random
from pathlib import Path
from datetime import date

TODAY = date.today().isoformat()
CHARS_PER_TOKEN = 4

# File types to index
TARGET_EXTENSIONS = {".ts", ".js", ".tsx", ".jsx", ".py", ".go", ".rs", ".mjs"}

# Import detection patterns
IMPORT_PATTERNS = [
    r"import\s+(?:[\w*{}\s,]+)\s+from\s+[\"']([\w./\\@-]+)[\"']",
    r"(?:const|let|var)\s+\w+\s*=\s*require\([\"']([\w./\\@-]+)[\"']\)",
    r"from\s+([\w./\\-]+)\s+import",  # Python
]

# Export detection patterns
EXPORT_PATTERNS = [
    r"^export\s+(?:default\s+)?(?:class|function|const|interface|type|enum)\s+(\w+)",
    r"^export\s+\{([^}]+)\}",
    r"^def\s+(\w+)",               # Python public functions
    r"^class\s+(\w+)",             # Python classes
    r"^pub\s+fn\s+(\w+)",          # Rust
    r"^func\s+([A-Z]\w*)",         # Go public functions
]

SKIP_DIRS = {"node_modules", ".git", "__pycache__", "dist", ".next", "build", "coverage", ".dsp"}
SKIP_FILES = {"package-lock.json", "yarn.lock", "pnpm-lock.yaml"}


def generate_uid(prefix: str = "obj") -> str:
    """Generate a random 8-hex-char UID."""
    return f"{prefix}-{random.randint(0, 0xFFFFFFFF):08x}"


def stable_uid(filepath: str) -> str:
    """Generate a deterministic UID from file path (for reproducibility)."""
    h = hashlib.md5(filepath.encode()).hexdigest()[:8]
    return f"obj-{h}"


def extract_imports(content: str) -> list:
    """Extract import paths from source content."""
    imports = []
    for pattern in IMPORT_PATTERNS:
        matches = re.finditer(pattern, content, re.MULTILINE)
        for m in matches:
            imp = m.group(1).strip()
            # Skip relative paths for external deps detection
            if imp not in imports:
                imports.append(imp)
    return imports[:20]  # cap at 20 imports per file


def extract_exports(content: str) -> list:
    """Extract exported symbols from source content."""
    exports = []
    for pattern in EXPORT_PATTERNS:
        matches = re.finditer(pattern, content, re.MULTILINE)
        for m in matches:
            names_raw = m.group(1)
            # Handle grouped exports: { A, B, C }
            names = [n.strip().split(" as ")[0].strip() for n in names_raw.split(",")]
            for name in names:
                if name and re.match(r"^\w+$", name) and name not in exports:
                    exports.append(name)
    return exports[:15]


def generate_placeholder_description(filepath: str, exports: list, imports: list) -> str:
    """Generate a placeholder description that must be replaced by a human/agent."""
    filename = Path(filepath).stem
    hint = ""
    if exports:
        hint = f" Exports: {', '.join(exports[:3])}."
    if imports:
        ext_deps = [i for i in imports if not i.startswith(".")]
        if ext_deps:
            hint += f" Uses: {', '.join(ext_deps[:2])}."
    return f"[PLACEHOLDER] {filename} module.{hint} — REPLACE with: what this does and why it exists."


def build_entry(filepath: str, rel_path: str, content: str) -> dict:
    """Build a DSP entry for a source file."""
    uid = stable_uid(rel_path)
    imports_raw = extract_imports(content)
    exports = extract_exports(content)

    # Build import objects with placeholder 'why'
    import_objects = []
    for imp in imports_raw:
        # Classify: relative = internal dep, otherwise external
        dep_type = "internal" if imp.startswith(".") else "external"
        import_objects.append({
            "from": imp,
            "type": dep_type,
            "why": "[PLACEHOLDER] — Replace with: why this import is needed",
        })

    return {
        "uid": uid,
        "type": "object",
        "name": Path(filepath).stem,
        "source_file": rel_path,
        "description": generate_placeholder_description(rel_path, exports, imports_raw),
        "imports": import_objects,
        "exports": exports,
        "created_at": TODAY,
        "last_updated": TODAY,
        "dsp_version": "2.0",
    }


def bootstrap(root_dir: str) -> dict:
    """Create DSP entries for all source files."""
    root = Path(root_dir)
    dsp_dir = root / ".dsp"
    dsp_dir.mkdir(exist_ok=True)

    entries = {}
    stats = {"created": 0, "skipped": 0, "errors": 0}

    for filepath in root.rglob("*"):
        if any(skip in filepath.parts for skip in SKIP_DIRS):
            continue
        if filepath.name in SKIP_FILES:
            continue
        if filepath.suffix not in TARGET_EXTENSIONS:
            continue
        if not filepath.is_file():
            continue

        rel_path = str(filepath.relative_to(root)).replace("\\", "/")

        try:
            with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
                content = f.read()

            entry = build_entry(str(filepath), rel_path, content)
            uid = entry["uid"]

            # Write entry file
            entry_file = dsp_dir / f"{uid}.json"
            with open(entry_file, "w", encoding="utf-8") as f:
                json.dump(entry, f, indent=2)

            entries[rel_path] = uid
            stats["created"] += 1

        except Exception as e:
            stats["errors"] += 1

    # Write Table of Contents
    toc = {
        "version": "2.0",
        "generated_at": TODAY,
        "total_entities": len(entries),
        "entities": entries,
    }
    with open(dsp_dir / "TOC.json", "w", encoding="utf-8") as f:
        json.dump(toc, f, indent=2)

    return {
        "action": "bootstrap",
        "dsp_dir": str(dsp_dir),
        "stats": stats,
        "message": (
            f"Bootstrap complete. {stats['created']} entries created. "
            f"IMPORTANT: All descriptions are placeholders — review and replace each one."
        ),
    }


def update(root_dir: str) -> dict:
    """Sync DSP with current codebase state."""
    root = Path(root_dir)
    dsp_dir = root / ".dsp"

    if not dsp_dir.exists():
        return {"error": "No .dsp/ directory found. Run --action bootstrap first."}

    # Load existing TOC
    toc_file = dsp_dir / "TOC.json"
    if toc_file.exists():
        with open(toc_file, "r") as f:
            toc = json.load(f)
        known_files = set(toc.get("entities", {}).keys())
    else:
        known_files = set()

    # Find current source files
    current_files = set()
    for filepath in root.rglob("*"):
        if any(skip in filepath.parts for skip in SKIP_DIRS):
            continue
        if filepath.suffix not in TARGET_EXTENSIONS:
            continue
        if filepath.is_file():
            rel_path = str(filepath.relative_to(root)).replace("\\", "/")
            current_files.add(rel_path)

    new_files = current_files - known_files
    deleted_files = known_files - current_files
    stats = {"new": 0, "deleted": 0, "errors": 0}

    # Register new files
    for rel_path in new_files:
        abs_path = root / rel_path
        try:
            with open(abs_path, "r", encoding="utf-8", errors="ignore") as f:
                content = f.read()
            entry = build_entry(str(abs_path), rel_path, content)
            entry_file = dsp_dir / f"{entry['uid']}.json"
            with open(entry_file, "w", encoding="utf-8") as f:
                json.dump(entry, f, indent=2)
            stats["new"] += 1
        except Exception:
            stats["errors"] += 1

    # Flag deleted files
    deleted_entries = []
    for rel_path in deleted_files:
        deleted_entries.append(rel_path)
        # Find and remove corresponding DSP entry
        if toc_file.exists():
            with open(toc_file, "r") as f:
                toc = json.load(f)
            uid = toc.get("entities", {}).get(rel_path)
            if uid:
                entry_file = dsp_dir / f"{uid}.json"
                if entry_file.exists():
                    entry_file.unlink()
                del toc["entities"][rel_path]
                with open(toc_file, "w") as f:
                    json.dump(toc, f, indent=2)
        stats["deleted"] += 1

    return {
        "action": "update",
        "stats": stats,
        "new_files": list(new_files)[:10],
        "deleted_files": deleted_entries[:10],
        "message": f"Update complete. {stats['new']} new, {stats['deleted']} removed.",
    }


def search(root_dir: str, query: str) -> dict:
    """Search DSP entries by name, description, or imports."""
    root = Path(root_dir)
    dsp_dir = root / ".dsp"

    if not dsp_dir.exists():
        return {"error": "No .dsp/ directory found."}

    results = []
    query_lower = query.lower()

    for entry_file in dsp_dir.glob("obj-*.json"):
        try:
            with open(entry_file, "r") as f:
                entry = json.load(f)

            score = 0
            if query_lower in entry.get("name", "").lower():
                score += 3
            if query_lower in entry.get("description", "").lower():
                score += 2
            if query_lower in entry.get("source_file", "").lower():
                score += 2
            for imp in entry.get("imports", []):
                if query_lower in imp.get("from", "").lower():
                    score += 1
            for exp in entry.get("exports", []):
                if query_lower in exp.lower():
                    score += 2

            if score > 0:
                results.append({"score": score, "entry": entry})

        except Exception:
            pass

    results.sort(key=lambda x: x["score"], reverse=True)

    return {
        "action": "search",
        "query": query,
        "result_count": len(results),
        "results": [
            {
                "uid": r["entry"]["uid"],
                "name": r["entry"]["name"],
                "source_file": r["entry"]["source_file"],
                "description": r["entry"]["description"][:100],
                "score": r["score"],
            }
            for r in results[:10]
        ],
    }


def validate(root_dir: str) -> dict:
    """Validate DSP graph integrity."""
    root = Path(root_dir)
    dsp_dir = root / ".dsp"

    if not dsp_dir.exists():
        return {"error": "No .dsp/ directory found."}

    issues = []
    stats = {"total": 0, "valid": 0, "with_issues": 0}

    for entry_file in dsp_dir.glob("obj-*.json"):
        try:
            with open(entry_file, "r") as f:
                entry = json.load(f)

            stats["total"] += 1
            entry_issues = []

            # Check description quality
            desc = entry.get("description", "")
            if not desc or "PLACEHOLDER" in desc or len(desc) < 30:
                entry_issues.append("description is placeholder or too short")

            # Check source file exists
            source = entry.get("source_file", "")
            if source and not (root / source).exists():
                entry_issues.append(f"source_file not found: {source}")

            # Check imports have 'why' fields
            for imp in entry.get("imports", []):
                if "PLACEHOLDER" in imp.get("why", "") or not imp.get("why"):
                    entry_issues.append(f"import '{imp.get('from', '?')}' missing 'why'")
                    break  # only report once per entity

            if entry_issues:
                issues.append({
                    "uid": entry.get("uid"),
                    "file": entry.get("source_file"),
                    "issues": entry_issues,
                })
                stats["with_issues"] += 1
            else:
                stats["valid"] += 1

        except Exception as e:
            issues.append({"file": str(entry_file), "issues": [f"parse error: {e}"]})

    return {
        "action": "validate",
        "stats": stats,
        "issues": issues[:20],
        "health": "good" if stats["with_issues"] == 0 else f"{stats['with_issues']}/{stats['total']} entries need attention",
    }


def main():
    if "--new-uid" in sys.argv:
        print(json.dumps({"uid": generate_uid("obj"), "func_uid": generate_uid("func")}, indent=2))
        return

    if len(sys.argv) < 2:
        print(json.dumps({"error": "Usage: python dsp_bootstrap.py <path> --action <bootstrap|update|search|validate>"}, indent=2))
        sys.exit(1)

    root_dir = sys.argv[1]
    action = "bootstrap"
    query = ""

    for i, arg in enumerate(sys.argv):
        if arg == "--action" and i + 1 < len(sys.argv):
            action = sys.argv[i + 1]
        if arg == "--query" and i + 1 < len(sys.argv):
            query = sys.argv[i + 1]

    if not os.path.isdir(root_dir):
        print(json.dumps({"error": f"Not a directory: {root_dir}"}, indent=2))
        sys.exit(1)

    if action == "bootstrap":
        result = bootstrap(root_dir)
    elif action == "update":
        result = update(root_dir)
    elif action == "search":
        if not query:
            result = {"error": "Provide --query for search action"}
        else:
            result = search(root_dir, query)
    elif action == "validate":
        result = validate(root_dir)
    else:
        result = {"error": f"Unknown action: {action}. Use: bootstrap | update | search | validate"}

    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()

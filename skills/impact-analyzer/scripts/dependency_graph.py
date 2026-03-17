#!/usr/bin/env python3
"""
dependency_graph.py — Advanced dependency analysis engine.
Features: import graph, reverse dependency lookup, circular dependency detection,
transitive dependency chains, blast radius calculation.

Usage:
  python dependency_graph.py <root_dir>                    # full graph
  python dependency_graph.py <root_dir> --file <path>      # blast radius for specific file
  python dependency_graph.py <root_dir> --cycles           # detect circular deps only
  python dependency_graph.py <root_dir> --reverse <path>   # who depends on this file

Output: JSON graph with optional targeted analysis.
"""

import os
import re
import sys
import json
from pathlib import Path
from collections import defaultdict, deque

# Import detection patterns for multiple languages
IMPORT_PATTERNS = [
    # TypeScript/JavaScript ESM
    r"import\s+(?:[\w*{}\s,]+)\s+from\s+[\"'](\.{1,2}/[\w./\\-]+|[\w@][\w./\\-]*)[\"']",
    # CommonJS require
    r"(?:const|let|var)\s+[\w{}\s,]+\s*=\s*require\s*\(\s*[\"'](\.{1,2}/[\w./\\-]+)[\"']\s*\)",
    # Dynamic import
    r"import\s*\(\s*[\"'](\.{1,2}/[\w./\\-]+)[\"']\s*\)",
    # Python
    r"^from\s+(\.{0,2}[\w./]+)\s+import",
    r"^import\s+([\w.]+)",
]

EXPORT_PATTERNS = [
    r"^export\s+(?:default\s+)?(?:class|function|const|let|var|interface|type|enum|abstract)\s+(\w+)",
    r"^export\s*\{([^}]+)\}",
    r"^module\.exports\s*=",
    r"^exports\.\w+\s*=",
    r"^def\s+([A-Z_]\w*)",  # Python public
    r"^class\s+([A-Z]\w*)",
    r"^pub\s+(?:fn|struct|enum|trait)\s+(\w+)",  # Rust
    r"^func\s+([A-Z]\w+)",  # Go public
]

SKIP_DIRS = {"node_modules", ".git", "dist", "__pycache__", ".next", "build", "coverage", ".dsp"}
TARGET_EXTS = {".ts", ".js", ".tsx", ".jsx", ".py", ".go", ".rs", ".mjs"}


def normalize_import(imp: str, current_file: str, root_dir: str) -> str | None:
    """Resolve relative import to canonical path."""
    if not imp.startswith("."):
        return f"[external:{imp}]"

    current_dir = os.path.dirname(current_file)
    resolved = os.path.normpath(os.path.join(current_dir, imp))
    resolved = os.path.relpath(resolved, root_dir).replace("\\", "/")

    # Try with common extensions if no extension given
    if "." not in os.path.basename(resolved):
        for ext in [".ts", ".tsx", ".js", ".jsx", ".py"]:
            candidate = resolved + ext
            if os.path.exists(os.path.join(root_dir, candidate)):
                return candidate
        # Try as index file
        for ext in [".ts", ".tsx", ".js", ".jsx"]:
            candidate = resolved + "/index" + ext
            if os.path.exists(os.path.join(root_dir, candidate)):
                return candidate

    return resolved


def extract_imports(content: str, filepath: str, root_dir: str) -> list:
    """Extract and normalize imports from source content."""
    imports = []
    for pattern in IMPORT_PATTERNS:
        matches = re.finditer(pattern, content, re.MULTILINE)
        for m in matches:
            raw = m.group(1).strip()
            resolved = normalize_import(raw, filepath, root_dir)
            if resolved and resolved not in imports:
                imports.append(resolved)
    return imports


def extract_exports(content: str) -> list:
    """Extract exported symbols."""
    exports = []
    for pattern in EXPORT_PATTERNS:
        matches = re.finditer(pattern, content, re.MULTILINE)
        for m in matches:
            name_raw = m.group(1)
            names = [n.strip().split(" as ")[0].strip() for n in name_raw.split(",")]
            for name in names:
                if name and re.match(r"^\w+$", name) and name not in exports:
                    exports.append(name)
    return exports[:20]


def build_graph(root_dir: str) -> dict:
    """Build full forward dependency graph."""
    root = Path(root_dir)
    graph = {}  # file -> {imports: [], exports: [], is_external: False}

    for filepath in root.rglob("*"):
        if any(skip in filepath.parts for skip in SKIP_DIRS):
            continue
        if filepath.suffix not in TARGET_EXTS:
            continue
        if not filepath.is_file():
            continue

        rel_path = str(filepath.relative_to(root)).replace("\\", "/")

        try:
            with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
                content = f.read()

            imports = extract_imports(content, rel_path, root_dir)
            exports = extract_exports(content)
            graph[rel_path] = {
                "imports": imports,
                "exports": exports,
                "is_public": bool(exports),
            }
        except Exception:
            pass

    return graph


def build_reverse_graph(graph: dict) -> dict:
    """Build reverse dependency graph: who imports each file."""
    reverse = defaultdict(list)
    for file, data in graph.items():
        for imp in data.get("imports", []):
            if not imp.startswith("[external:"):
                reverse[imp].append(file)
    return dict(reverse)


def detect_cycles(graph: dict) -> list:
    """Detect circular dependencies using DFS."""
    # Only consider internal (non-external) edges
    visited = set()
    rec_stack = set()
    cycles = []

    def dfs(node: str, path: list):
        visited.add(node)
        rec_stack.add(node)

        for imp in graph.get(node, {}).get("imports", []):
            if imp.startswith("[external:"):
                continue
            if imp not in graph:
                continue
            if imp not in visited:
                dfs(imp, path + [imp])
            elif imp in rec_stack:
                # Found cycle
                cycle_start = path.index(imp) if imp in path else 0
                cycle = path[cycle_start:] + [imp]
                cycle_str = " → ".join(cycle)
                if cycle_str not in [" → ".join(c) for c in cycles]:
                    cycles.append(cycle)

        rec_stack.discard(node)

    for node in list(graph.keys()):
        if node not in visited:
            dfs(node, [node])

    return cycles[:20]  # cap at 20 cycles


def blast_radius(file_path: str, graph: dict, reverse_graph: dict) -> dict:
    """Calculate blast radius for a specific file change."""
    # Direct dependents (who imports this file)
    direct = reverse_graph.get(file_path, [])

    # Transitive dependents (BFS)
    all_affected = set(direct)
    queue = deque(direct)
    while queue:
        current = queue.popleft()
        for dep in reverse_graph.get(current, []):
            if dep not in all_affected:
                all_affected.add(dep)
                queue.append(dep)

    # Categorize risk
    file_data = graph.get(file_path, {})
    is_public_api = file_data.get("is_public", False)
    export_count = len(file_data.get("exports", []))

    if is_public_api and len(all_affected) > 10:
        risk = "CRITICAL"
    elif is_public_api or len(all_affected) > 5:
        risk = "HIGH"
    elif len(all_affected) > 2:
        risk = "MEDIUM"
    else:
        risk = "LOW"

    return {
        "target_file": file_path,
        "is_public_api": is_public_api,
        "exported_symbols": file_data.get("exports", []),
        "direct_dependents": direct,
        "transitive_dependents": sorted(all_affected - set(direct)),
        "total_affected": len(all_affected),
        "risk": risk,
        "risk_reason": (
            f"Exported API with {len(all_affected)} transitive dependents"
            if is_public_api
            else f"{len(all_affected)} files affected by change"
        ),
    }


def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Usage: python dependency_graph.py <root> [--file F] [--cycles] [--reverse F]"}, indent=2))
        sys.exit(1)

    root_dir = sys.argv[1]
    target_file = None
    show_cycles = "--cycles" in sys.argv
    reverse_target = None

    for i, arg in enumerate(sys.argv):
        if arg == "--file" and i + 1 < len(sys.argv):
            target_file = sys.argv[i + 1]
        if arg == "--reverse" and i + 1 < len(sys.argv):
            reverse_target = sys.argv[i + 1]

    if not os.path.isdir(root_dir):
        print(json.dumps({"error": f"Not a directory: {root_dir}"}, indent=2))
        sys.exit(1)

    graph = build_graph(root_dir)
    reverse_graph = build_reverse_graph(graph)

    if show_cycles:
        cycles = detect_cycles(graph)
        print(json.dumps({
            "cycle_count": len(cycles),
            "cycles": cycles,
            "verdict": "CLEAN" if not cycles else f"{len(cycles)} circular dependency chains detected",
        }, indent=2))
        return

    if target_file:
        result = blast_radius(target_file, graph, reverse_graph)
        print(json.dumps(result, indent=2))
        return

    if reverse_target:
        deps = reverse_graph.get(reverse_target, [])
        print(json.dumps({
            "file": reverse_target,
            "imported_by": deps,
            "count": len(deps),
        }, indent=2))
        return

    # Full graph output with summary
    cycles = detect_cycles(graph)
    most_depended = sorted(
        [(f, len(reverse_graph.get(f, []))) for f in graph],
        key=lambda x: x[1],
        reverse=True
    )[:10]

    print(json.dumps({
        "summary": {
            "total_files": len(graph),
            "circular_dependency_count": len(cycles),
            "most_depended_on": [{"file": f, "dependents": n} for f, n in most_depended],
        },
        "cycles": cycles,
        "graph": {
            f: {"imports": d["imports"], "exports": d["exports"]}
            for f, d in list(graph.items())[:50]  # cap output for large repos
        },
    }, indent=2))


if __name__ == "__main__":
    main()

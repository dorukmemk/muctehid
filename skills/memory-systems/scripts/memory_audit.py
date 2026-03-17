#!/usr/bin/env python3
"""
memory_audit.py — Scans a codebase for existing memory/storage patterns.
Detects: SQLite, Redis, vector DBs, file-based storage, in-memory patterns.
Maps which data is volatile (context-only) vs persistent (survives session restart).

Usage: python memory_audit.py <root_dir>
Output: JSON report with detected patterns, gaps, and recommendations.
"""

import os
import re
import sys
import json
from pathlib import Path

# Storage backend detection patterns
STORAGE_PATTERNS = {
    "sqlite": [
        r"better-sqlite3|sqlite3|Database\(",
        r"\.db[\"'\s]|\.sqlite[\"'\s]",
        r"createConnection.*sqlite",
    ],
    "redis": [
        r"ioredis|redis\.createClient|createClient\(",
        r"\.set\(|\.get\(|\.hset\(|\.hget\(",
        r"REDIS_URL|redis://",
    ],
    "vector_db": [
        r"vectra|chromadb|pinecone|weaviate|qdrant",
        r"addItem.*vector|similarity.*search|embedding",
        r"LocalIndex|VectorStore|EmbeddingStore",
    ],
    "file_storage": [
        r"fs\.writeFile|fs\.readFile|writeFileSync|readFileSync",
        r"\.json[\"'\s]|\.md[\"'\s]|\.txt[\"'\s]",
        r"path\.join.*plan|\.plan/|memory/",
    ],
    "in_memory": [
        r"new Map\(\)|new Set\(\)|const cache\s*=\s*\{",
        r"lruCache|LRUCache|NodeCache",
        r"sessionStorage|localStorage",
    ],
    "external_api": [
        r"mem0|Mem0|zep-cloud|Zep\(",
        r"langmem|LangMem|cognee",
        r"graphiti|Graphiti",
    ],
}

# Memory-related semantic patterns
MEMORY_CONCEPTS = {
    "session_state": [
        r"sessionId|session_id|conversationId",
        r"chatHistory|conversation_history|messages\s*=\s*\[",
    ],
    "persistence_intent": [
        r"remember|persist|save.*context|store.*memory",
        r"recall|retrieve.*memory|load.*context",
    ],
    "volatile_risk": [
        r"const\s+\w+\s*=\s*\[\].*\/\/.*context",  # arrays used as context storage
        r"process\.env\.\w+.*cache",
        r"global\.\w+\s*=",  # global mutable state
    ],
}

def scan_file(filepath: str) -> dict:
    """Scan a single file for memory patterns."""
    results = {
        "storage": {},
        "concepts": {},
        "lines": {}
    }

    try:
        with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
            content = f.read()
            lines = content.split("\n")

        for category, patterns in STORAGE_PATTERNS.items():
            hits = []
            for pattern in patterns:
                for i, line in enumerate(lines, 1):
                    if re.search(pattern, line, re.IGNORECASE):
                        hits.append({"line": i, "match": line.strip()[:100]})
            if hits:
                results["storage"][category] = hits

        for concept, patterns in MEMORY_CONCEPTS.items():
            hits = []
            for pattern in patterns:
                for i, line in enumerate(lines, 1):
                    if re.search(pattern, line, re.IGNORECASE):
                        hits.append({"line": i, "match": line.strip()[:100]})
            if hits:
                results["concepts"][concept] = hits

    except Exception as e:
        results["error"] = str(e)

    return results


def audit_directory(root_dir: str) -> dict:
    """Walk directory and aggregate all memory pattern findings."""
    root = Path(root_dir)
    all_findings = {}
    summary = {
        "total_files_scanned": 0,
        "files_with_storage": 0,
        "detected_backends": set(),
        "volatile_risk_files": [],
        "persistence_gaps": [],
    }

    skip_dirs = {"node_modules", ".git", "dist", "__pycache__", ".next", "build", "coverage"}
    target_exts = {".ts", ".js", ".tsx", ".jsx", ".py", ".mjs", ".cjs"}

    for filepath in root.rglob("*"):
        if any(skip in filepath.parts for skip in skip_dirs):
            continue
        if filepath.suffix not in target_exts:
            continue

        summary["total_files_scanned"] += 1
        rel_path = str(filepath.relative_to(root))
        result = scan_file(str(filepath))

        if result.get("storage") or result.get("concepts"):
            all_findings[rel_path] = result
            summary["files_with_storage"] += 1

            for backend in result.get("storage", {}):
                summary["detected_backends"].add(backend)

            if "volatile_risk" in result.get("concepts", {}):
                summary["volatile_risk_files"].append(rel_path)

            # Flag: has persistence_intent but no storage backend
            has_intent = "persistence_intent" in result.get("concepts", {})
            has_backend = bool(result.get("storage"))
            if has_intent and not has_backend:
                summary["persistence_gaps"].append(rel_path)

    summary["detected_backends"] = sorted(list(summary["detected_backends"]))

    return {
        "summary": summary,
        "findings": all_findings,
        "recommendations": generate_recommendations(summary),
    }


def generate_recommendations(summary: dict) -> list:
    """Generate actionable recommendations based on audit findings."""
    recs = []
    backends = set(summary["detected_backends"])

    if not backends:
        recs.append({
            "severity": "HIGH",
            "finding": "No persistent storage detected",
            "recommendation": "All agent state is volatile. Implement at minimum SQLite for short-term + file-based long-term memory.",
            "action": "Add better-sqlite3 and implement a MemoryStore class with get/set/search methods.",
        })

    if "in_memory" in backends and "sqlite" not in backends:
        recs.append({
            "severity": "HIGH",
            "finding": "In-memory caching without persistence",
            "recommendation": "In-memory caches evaporate on restart. Back with SQLite or Redis.",
            "action": "Add write-through persistence: every in-memory write also writes to SQLite.",
        })

    if "vector_db" in backends and "sqlite" not in backends:
        recs.append({
            "severity": "MEDIUM",
            "finding": "Vector DB without structured metadata store",
            "recommendation": "Vector DB stores embeddings but metadata (timestamps, sources, TTL) needs a relational store.",
            "action": "Add SQLite alongside vector DB for metadata management.",
        })

    if summary["volatile_risk_files"]:
        recs.append({
            "severity": "MEDIUM",
            "finding": f"{len(summary['volatile_risk_files'])} files using global/volatile state as memory",
            "recommendation": "Global mutable state is reset on process restart. Convert to persistent storage.",
            "files": summary["volatile_risk_files"][:5],
        })

    if summary["persistence_gaps"]:
        recs.append({
            "severity": "HIGH",
            "finding": f"{len(summary['persistence_gaps'])} files intend to persist data but have no storage backend",
            "recommendation": "Files have persistence intent (remember/store/save) but no actual storage layer detected.",
            "files": summary["persistence_gaps"][:5],
        })

    if not recs:
        recs.append({
            "severity": "LOW",
            "finding": "Memory architecture appears functional",
            "recommendation": "Verify hybrid retrieval (semantic + keyword) is implemented. Single-strategy retrieval degrades quality.",
        })

    return recs


def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Usage: python memory_audit.py <root_dir>"}, indent=2))
        sys.exit(1)

    root_dir = sys.argv[1]
    if not os.path.isdir(root_dir):
        print(json.dumps({"error": f"Not a directory: {root_dir}"}, indent=2))
        sys.exit(1)

    result = audit_directory(root_dir)
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""
token_estimator.py — Estimates token usage breakdown for an AI agent project.
Analyzes: system prompts, conversation files, tool outputs, plan files.
Identifies dominant token consumers and optimization opportunities.

Usage:
  python token_estimator.py <root_dir>
  python token_estimator.py <root_dir> --threshold 70

Output: JSON breakdown of token usage by component with recommendations.
"""

import os
import re
import sys
import json
from pathlib import Path

# Rough token estimation: 1 token ≈ 4 chars (GPT/Claude approximation)
CHARS_PER_TOKEN = 4

# Context window sizes for common models
CONTEXT_WINDOWS = {
    "claude-opus-4": 200_000,
    "claude-sonnet-4": 200_000,
    "claude-haiku-4": 200_000,
    "claude-sonnet-3.5": 200_000,
    "gpt-4o": 128_000,
    "gpt-4": 128_000,
    "gpt-3.5-turbo": 16_385,
    "default": 200_000,
}

# File categories for component detection
COMPONENT_PATTERNS = {
    "system_prompt": [
        r"CLAUDE\.md$",
        r"system[-_]prompt\.(md|txt|json)$",
        r"AGENTS\.md$",
        r"\.cursorrules$",
    ],
    "conversation_history": [
        r"conversation\.(json|md)$",
        r"chat[-_]history",
        r"messages\.(json|md)$",
        r"session[-_]\d+",
    ],
    "plan_files": [
        r"\.plan/",
        r"task_plan\.md$",
        r"findings\.md$",
        r"progress\.md$",
    ],
    "tool_outputs": [
        r"tool[-_]results?/",
        r"\.tool[-_]output",
        r"scan[-_]results?\.json$",
    ],
    "skill_prompts": [
        r"skills/.*SKILL\.md$",
        r"\.skill$",
    ],
    "source_code": [
        r"\.(ts|js|tsx|jsx|py|go|rs)$",
    ],
    "documentation": [
        r"README\.md$",
        r"docs/.*\.md$",
        r"\.md$",
    ],
}


def estimate_tokens(text: str) -> int:
    """Rough token estimate using character count."""
    # Adjust for code (higher token density) vs prose (lower)
    return max(1, len(text) // CHARS_PER_TOKEN)


def categorize_file(filepath: str) -> str:
    """Determine which component category a file belongs to."""
    normalized = filepath.replace("\\", "/")

    for category, patterns in COMPONENT_PATTERNS.items():
        for pattern in patterns:
            if re.search(pattern, normalized, re.IGNORECASE):
                return category

    return "other"


def scan_file(filepath: str) -> dict:
    """Read file and estimate token count."""
    try:
        with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
            content = f.read()
        return {
            "chars": len(content),
            "tokens": estimate_tokens(content),
            "lines": content.count("\n") + 1,
        }
    except Exception as e:
        return {"chars": 0, "tokens": 0, "lines": 0, "error": str(e)}


def audit_directory(root_dir: str, threshold: int = 70) -> dict:
    """Walk directory and build token breakdown by component."""
    root = Path(root_dir)
    skip_dirs = {"node_modules", ".git", "__pycache__", "coverage", ".next"}

    components = {
        "system_prompt": {"files": [], "total_tokens": 0},
        "conversation_history": {"files": [], "total_tokens": 0},
        "plan_files": {"files": [], "total_tokens": 0},
        "tool_outputs": {"files": [], "total_tokens": 0},
        "skill_prompts": {"files": [], "total_tokens": 0},
        "source_code": {"files": [], "total_tokens": 0},
        "documentation": {"files": [], "total_tokens": 0},
        "other": {"files": [], "total_tokens": 0},
    }

    total_files = 0
    text_exts = {".md", ".ts", ".js", ".tsx", ".jsx", ".py", ".json", ".txt", ".yaml", ".yml"}

    for filepath in root.rglob("*"):
        if any(skip in filepath.parts for skip in skip_dirs):
            continue
        if not filepath.is_file():
            continue
        if filepath.suffix not in text_exts:
            continue

        total_files += 1
        rel_path = str(filepath.relative_to(root))
        category = categorize_file(rel_path)
        stats = scan_file(str(filepath))

        components[category]["files"].append({
            "path": rel_path,
            "tokens": stats["tokens"],
            "lines": stats["lines"],
        })
        components[category]["total_tokens"] += stats["tokens"]

    # Sort files by token count descending within each component
    for comp in components.values():
        comp["files"].sort(key=lambda x: x["tokens"], reverse=True)
        comp["files"] = comp["files"][:10]  # top 10 per component

    total_tokens = sum(c["total_tokens"] for c in components.values())

    # Detect model being used
    model = detect_model_from_project(root_dir)
    context_window = CONTEXT_WINDOWS.get(model, CONTEXT_WINDOWS["default"])

    # Build ranked breakdown
    breakdown = []
    for name, data in components.items():
        if data["total_tokens"] > 0:
            pct = round(data["total_tokens"] / max(total_tokens, 1) * 100, 1)
            breakdown.append({
                "component": name,
                "total_tokens": data["total_tokens"],
                "percentage": pct,
                "top_files": data["files"][:3],
            })
    breakdown.sort(key=lambda x: x["total_tokens"], reverse=True)

    utilization = round(total_tokens / context_window * 100, 1)

    return {
        "summary": {
            "total_files_scanned": total_files,
            "total_tokens_estimated": total_tokens,
            "model": model,
            "context_window": context_window,
            "utilization_pct": utilization,
            "status": _utilization_status(utilization, threshold),
        },
        "breakdown": breakdown,
        "dominant_component": breakdown[0]["component"] if breakdown else "none",
        "recommendations": generate_recommendations(breakdown, utilization, threshold),
    }


def detect_model_from_project(root_dir: str) -> str:
    """Try to detect which model the project uses."""
    search_files = [
        os.path.join(root_dir, "CLAUDE.md"),
        os.path.join(root_dir, "package.json"),
        os.path.join(root_dir, ".env"),
    ]

    for filepath in search_files:
        if not os.path.exists(filepath):
            continue
        try:
            with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
                content = f.read()
            for model_name in CONTEXT_WINDOWS:
                if model_name in content:
                    return model_name
        except Exception:
            pass

    return "default"


def _utilization_status(utilization: float, threshold: int) -> str:
    if utilization < threshold * 0.7:
        return "healthy"
    if utilization < threshold:
        return "approaching_limit"
    if utilization < 90:
        return "optimization_required"
    return "critical"


def generate_recommendations(breakdown: list, utilization: float, threshold: int) -> list:
    """Generate actionable optimization recommendations."""
    recs = []

    if utilization >= threshold:
        dominant = breakdown[0] if breakdown else None
        if dominant:
            recs.append({
                "severity": "HIGH",
                "strategy": get_strategy_for_component(dominant["component"]),
                "component": dominant["component"],
                "tokens": dominant["total_tokens"],
                "percentage": dominant["percentage"],
                "expected_reduction": get_expected_reduction(dominant["component"]),
            })

    # Check for tool outputs eating too much
    tool_comp = next((b for b in breakdown if b["component"] == "tool_outputs"), None)
    if tool_comp and tool_comp["percentage"] > 40:
        recs.append({
            "severity": "HIGH",
            "strategy": "observation_masking",
            "component": "tool_outputs",
            "message": f"Tool outputs account for {tool_comp['percentage']}% of tokens. Apply Observation Masking.",
            "expected_reduction": "30-80%",
        })

    # Check system prompt size
    sys_comp = next((b for b in breakdown if b["component"] == "system_prompt"), None)
    if sys_comp and sys_comp["total_tokens"] > 8000:
        recs.append({
            "severity": "MEDIUM",
            "strategy": "system_prompt_trim",
            "component": "system_prompt",
            "message": f"System prompt is {sys_comp['total_tokens']} tokens. Consider trimming redundant rules.",
        })

    if not recs:
        recs.append({
            "severity": "LOW",
            "message": f"Context utilization at {utilization}% — within healthy range. No immediate action needed.",
        })

    return recs


def get_strategy_for_component(component: str) -> str:
    strategies = {
        "conversation_history": "compaction",
        "tool_outputs": "observation_masking",
        "system_prompt": "system_prompt_trim",
        "plan_files": "compaction",
        "documentation": "selective_loading",
        "source_code": "context_partitioning",
    }
    return strategies.get(component, "compaction")


def get_expected_reduction(component: str) -> str:
    reductions = {
        "conversation_history": "50-70%",
        "tool_outputs": "30-80%",
        "system_prompt": "10-30%",
        "plan_files": "40-60%",
        "documentation": "20-50%",
        "source_code": "varies (use partitioning)",
    }
    return reductions.get(component, "20-50%")


def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Usage: python token_estimator.py <root_dir> [--threshold N]"}, indent=2))
        sys.exit(1)

    root_dir = sys.argv[1]
    threshold = 70

    # Parse --threshold flag
    for i, arg in enumerate(sys.argv):
        if arg == "--threshold" and i + 1 < len(sys.argv):
            try:
                threshold = int(sys.argv[i + 1])
            except ValueError:
                pass

    if not os.path.isdir(root_dir):
        print(json.dumps({"error": f"Not a directory: {root_dir}"}, indent=2))
        sys.exit(1)

    result = audit_directory(root_dir, threshold)
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()

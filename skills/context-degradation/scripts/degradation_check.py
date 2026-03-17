#!/usr/bin/env python3
"""
degradation_check.py — Analyzes session context for degradation risk.
Detects: Lost-in-Middle, Context Poisoning, Context Distraction,
Context Confusion, and Context Clash patterns.

Usage:
  python degradation_check.py <session_dir>
  python degradation_check.py <session_dir> --context-size 50000

Output: JSON risk report with active patterns and mitigation recommendations.
"""

import os
import re
import sys
import json
from pathlib import Path
from collections import defaultdict

CHARS_PER_TOKEN = 4

# Model degradation thresholds (tokens)
DEGRADATION_THRESHOLDS = {
    "claude-opus": {"first": 30_000, "significant": 80_000, "critical": 150_000},
    "claude-sonnet": {"first": 30_000, "significant": 80_000, "critical": 150_000},
    "claude-haiku": {"first": 20_000, "significant": 50_000, "critical": 100_000},
    "gpt-4o": {"first": 20_000, "significant": 60_000, "critical": 110_000},
    "gpt-4": {"first": 15_000, "significant": 40_000, "critical": 90_000},
    "gpt-3.5": {"first": 8_000, "significant": 14_000, "critical": 16_000},
    "default": {"first": 20_000, "significant": 60_000, "critical": 130_000},
}

# Poisoning indicators — error/incorrect assumptions repeated
POISONING_PATTERNS = [
    r"(?:sorry|apologize|correction|mistake)[,:\s]+(.{20,80})",
    r"(?:actually|wait|no)[,:\s]+(?:that's|that is) (?:wrong|incorrect|not right)",
    r"CORRECTION[:\s]+(.{20,80})",
    r"(?:I was wrong|I made an error|that was incorrect)",
]

# Distraction indicators — unrelated tool outputs still in context
DISTRACTION_PATTERNS = [
    r"(?:earlier|previously|before)[,:\s]+(?:I|we|you) (?:found|noted|mentioned)",
    r"(?:from the previous|in the last) (?:search|scan|result)",
    r"as (?:I|we) (?:discussed|found|noted) (?:earlier|above|previously)",
]

# Confusion indicators — hedging/uncertainty
CONFUSION_PATTERNS = [
    r"(?:it depends|unclear|not sure|I'm not certain)",
    r"(?:either|or|could be either of)",
    r"(?:conflicting|contradictory|inconsistent) (?:instructions?|rules?|requirements?)",
    r"which (?:rule|instruction|requirement) (?:takes|should|applies)",
]

# Clash indicators — explicit instruction conflicts
CLASH_PATTERNS = [
    r"NEVER .{5,50} BUT (?:ALSO )?(?:ALWAYS|DO)",
    r"(?:ALWAYS|DO) .{5,50} NEVER",
    r"(?:rule|requirement|constraint) .{5,30} (?:contradicts?|conflicts? with|overrides?)",
]

# Instruction-like patterns in markdown files
INSTRUCTION_PATTERNS = [
    r"^#{1,3}\s+(.{10,60})",           # Markdown headers = sections of instructions
    r"^(?:ALWAYS|NEVER|DO NOT|MUST)[:\s]+(.{10,80})",
    r"^\d+\.\s+\*\*(.{10,60})\*\*",    # Numbered bold rules
]


def read_session_files(root_dir: str) -> dict:
    """Read all session-related files."""
    root = Path(root_dir)
    files = {}

    search_paths = [
        root / ".plan",
        root,
    ]

    for search_path in search_paths:
        if not search_path.exists():
            continue
        for f in search_path.iterdir():
            if f.is_file() and f.suffix in {".md", ".json", ".txt"}:
                try:
                    with open(f, "r", encoding="utf-8", errors="ignore") as fh:
                        content = fh.read()
                    files[str(f.relative_to(root))] = content
                except Exception:
                    pass

    return files


def detect_poisoning(files: dict) -> dict:
    """Detect context poisoning signals."""
    all_corrections = []

    for filepath, content in files.items():
        for pattern in POISONING_PATTERNS:
            matches = re.finditer(pattern, content, re.IGNORECASE | re.MULTILINE)
            for m in matches:
                all_corrections.append({
                    "file": filepath,
                    "snippet": m.group(0)[:100],
                })

    # Multiple corrections = higher poisoning risk
    severity = "LOW"
    if len(all_corrections) >= 5:
        severity = "HIGH"
    elif len(all_corrections) >= 2:
        severity = "MEDIUM"

    return {
        "pattern": "context_poisoning",
        "severity": severity,
        "evidence_count": len(all_corrections),
        "evidence": all_corrections[:3],
        "mitigation": (
            "Issue explicit CORRECTION: markers for each wrong fact. "
            "If > 5 corrections: compress session, dropping poisoned turns."
        ) if severity != "LOW" else None,
    }


def detect_distraction(files: dict, context_size: int) -> dict:
    """Detect context distraction signals."""
    distractions = []

    for filepath, content in files.items():
        for pattern in DISTRACTION_PATTERNS:
            matches = re.finditer(pattern, content, re.IGNORECASE)
            for m in matches:
                distractions.append({"file": filepath, "snippet": m.group(0)[:100]})

    # Large context + many cross-references = distraction risk
    severity = "LOW"
    if context_size > 40_000 and len(distractions) >= 3:
        severity = "HIGH"
    elif context_size > 20_000 and len(distractions) >= 2:
        severity = "MEDIUM"
    elif len(distractions) >= 5:
        severity = "MEDIUM"

    return {
        "pattern": "context_distraction",
        "severity": severity,
        "evidence_count": len(distractions),
        "evidence": distractions[:3],
        "mitigation": (
            "Apply Observation Masking to completed tool outputs. "
            "Compress session state for completed tasks."
        ) if severity != "LOW" else None,
    }


def detect_confusion(files: dict) -> dict:
    """Detect context confusion signals."""
    confusion_signals = []

    for filepath, content in files.items():
        for pattern in CONFUSION_PATTERNS:
            matches = re.finditer(pattern, content, re.IGNORECASE)
            for m in matches:
                confusion_signals.append({"file": filepath, "snippet": m.group(0)[:100]})

    severity = "LOW"
    if len(confusion_signals) >= 4:
        severity = "HIGH"
    elif len(confusion_signals) >= 2:
        severity = "MEDIUM"

    return {
        "pattern": "context_confusion",
        "severity": severity,
        "evidence_count": len(confusion_signals),
        "evidence": confusion_signals[:3],
        "mitigation": (
            "Identify all instructions/rules currently in context. "
            "Remove duplicates. Add explicit priority ordering for any conflicts."
        ) if severity != "LOW" else None,
    }


def detect_clash(files: dict) -> dict:
    """Detect context clash — explicit instruction conflicts."""
    clashes = []

    # Extract all instruction-like statements
    instructions = defaultdict(list)
    for filepath, content in files.items():
        for pattern in INSTRUCTION_PATTERNS:
            matches = re.finditer(pattern, content, re.IGNORECASE | re.MULTILINE)
            for m in matches:
                instructions[filepath].append(m.group(1).strip()[:80])

    # Check for explicit clash patterns
    all_content = "\n".join(files.values())
    for pattern in CLASH_PATTERNS:
        matches = re.finditer(pattern, all_content, re.IGNORECASE)
        for m in matches:
            clashes.append({"snippet": m.group(0)[:120]})

    # Check for NEVER + ALWAYS near each other (simple heuristic)
    never_positions = [m.start() for m in re.finditer(r"\bNEVER\b", all_content)]
    always_positions = [m.start() for m in re.finditer(r"\bALWAYS\b", all_content)]

    proximity_clashes = 0
    for npos in never_positions:
        for apos in always_positions:
            if abs(npos - apos) < 500:  # within ~500 chars = proximity conflict risk
                proximity_clashes += 1

    severity = "LOW"
    if clashes or proximity_clashes > 3:
        severity = "HIGH"
    elif proximity_clashes > 1:
        severity = "MEDIUM"

    return {
        "pattern": "context_clash",
        "severity": severity,
        "evidence_count": len(clashes) + proximity_clashes,
        "instruction_count": sum(len(v) for v in instructions.values()),
        "evidence": clashes[:3],
        "mitigation": (
            "Reconcile conflicting instructions. "
            "Add explicit precedence: 'Rule A overrides Rule B when...'"
        ) if severity != "LOW" else None,
    }


def detect_lost_in_middle(context_size: int, model: str = "default") -> dict:
    """Assess lost-in-middle risk based on context size."""
    thresholds = DEGRADATION_THRESHOLDS.get(model, DEGRADATION_THRESHOLDS["default"])

    severity = "LOW"
    recall_impact = "negligible"

    if context_size >= thresholds["critical"]:
        severity = "CRITICAL"
        recall_impact = "40%+ recall drop for middle content"
    elif context_size >= thresholds["significant"]:
        severity = "HIGH"
        recall_impact = "20-40% recall drop for middle content"
    elif context_size >= thresholds["first"]:
        severity = "MEDIUM"
        recall_impact = "10-20% recall drop for middle content"

    return {
        "pattern": "lost_in_middle",
        "severity": severity,
        "context_size": context_size,
        "thresholds": thresholds,
        "recall_impact": recall_impact,
        "mitigation": (
            "Move critical constraints to START or END. "
            "Re-inject critical reminders every 20-30 turns. "
            "Apply context compression to reduce total size."
        ) if severity not in ("LOW",) else None,
    }


def detect_model(root_dir: str) -> str:
    """Try to detect model from project files."""
    for filename in ["CLAUDE.md", "package.json", ".env"]:
        filepath = os.path.join(root_dir, filename)
        if not os.path.exists(filepath):
            continue
        try:
            with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
                content = f.read()
            for model in DEGRADATION_THRESHOLDS:
                if model in content.lower():
                    return model
        except Exception:
            pass
    return "default"


def overall_risk(patterns: list) -> str:
    """Calculate overall degradation risk."""
    severity_scores = {"CRITICAL": 4, "HIGH": 3, "MEDIUM": 2, "LOW": 1}
    max_score = max(severity_scores.get(p["severity"], 0) for p in patterns)
    high_count = sum(1 for p in patterns if p["severity"] in ("HIGH", "CRITICAL"))

    if max_score >= 4 or high_count >= 3:
        return "CRITICAL"
    if max_score >= 3 or high_count >= 2:
        return "HIGH"
    if max_score >= 2:
        return "MEDIUM"
    return "LOW"


def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Usage: python degradation_check.py <session_dir> [--context-size N]"}, indent=2))
        sys.exit(1)

    root_dir = sys.argv[1]
    context_size = 0

    for i, arg in enumerate(sys.argv):
        if arg == "--context-size" and i + 1 < len(sys.argv):
            try:
                context_size = int(sys.argv[i + 1])
            except ValueError:
                pass

    if not os.path.exists(root_dir):
        print(json.dumps({"error": f"Path not found: {root_dir}"}, indent=2))
        sys.exit(1)

    # If no context size provided, estimate from files
    if context_size == 0:
        files = read_session_files(root_dir)
        total_chars = sum(len(c) for c in files.values())
        context_size = total_chars // CHARS_PER_TOKEN
    else:
        files = read_session_files(root_dir)

    model = detect_model(root_dir)

    patterns = [
        detect_lost_in_middle(context_size, model),
        detect_poisoning(files),
        detect_distraction(files, context_size),
        detect_confusion(files),
        detect_clash(files),
    ]

    # Only include actionable mitigations
    active_patterns = [p for p in patterns if p["severity"] != "LOW"]
    mitigations = [
        {"pattern": p["pattern"], "severity": p["severity"], "action": p["mitigation"]}
        for p in active_patterns
        if p.get("mitigation")
    ]

    report = {
        "summary": {
            "context_size_tokens": context_size,
            "model": model,
            "overall_risk": overall_risk(patterns),
            "active_pattern_count": len(active_patterns),
        },
        "patterns": patterns,
        "mitigations": mitigations,
        "recommended_action": (
            "Apply context-compression skill immediately"
            if overall_risk(patterns) in ("CRITICAL", "HIGH")
            else "Monitor — no immediate action required"
        ),
    }

    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()

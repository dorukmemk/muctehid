#!/usr/bin/env python3
"""
agent_graph.py — Analyzes a codebase for multi-agent patterns.
Detects: agent invocations, handoff chains, convergence constraints, token estimates.
Maps supervisor/P2P/hierarchical patterns and flags missing safety mechanisms.

Usage:
  python agent_graph.py <root_dir>
  python agent_graph.py <root_dir> --token-audit

Output: JSON report with agent topology, handoff chains, and recommendations.
"""

import os
import re
import sys
import json
from pathlib import Path
from collections import defaultdict

# Agent invocation patterns
AGENT_PATTERNS = {
    "agent_create": [
        r"new Agent\(|createAgent\(|Agent\.create\(",
        r"spawn.*agent|agent.*spawn",
        r"Claude|anthropic.*messages\.create",
        r"openai\.(chat|completions)",
        r"LangChain|LangGraph|langgraph",
        r"run_skill\(|invoke_skill\(",
    ],
    "supervisor_pattern": [
        r"supervisor|orchestrat|coordinator",
        r"delegate.*agent|agent.*delegate",
        r"dispatch.*to.*agent|route.*to.*agent",
    ],
    "p2p_pattern": [
        r"swarm|peer.*peer|p2p.*agent",
        r"agent.*message.*agent|handoff.*agent",
        r"broadcast.*agents|agents.*consensus",
    ],
    "hierarchical_pattern": [
        r"parent.*agent|child.*agent|sub.*agent",
        r"nested.*agent|layer.*agent",
        r"strategy.*planning.*execution",
    ],
    "handoff": [
        r"handoff|hand_off|pass.*result.*agent",
        r"agent.*output.*next|forward.*agent",
        r"\.invoke\(|\.run\(|\.execute\(",
    ],
    "convergence_guard": [
        r"max_iterations|maxIterations|max_turns",
        r"timeout|time_limit|ttl.*agent",
        r"consensus|convergence|agreement",
        r"stop_condition|termination",
    ],
    "validation": [
        r"validate.*output|output.*validate",
        r"schema.*agent|agent.*schema",
        r"check.*result|verify.*agent",
    ],
}

# Token cost estimation (rough approximations)
MODEL_COSTS = {
    "claude-opus": {"input": 15.0, "output": 75.0},   # per 1M tokens
    "claude-sonnet": {"input": 3.0, "output": 15.0},
    "claude-haiku": {"input": 0.25, "output": 1.25},
    "gpt-4": {"input": 30.0, "output": 60.0},
    "gpt-3.5": {"input": 0.5, "output": 1.5},
    "default": {"input": 3.0, "output": 15.0},
}


def detect_model(content: str) -> str:
    """Detect which model is being used."""
    if re.search(r"claude-opus|opus-4|opus-3", content, re.IGNORECASE):
        return "claude-opus"
    if re.search(r"claude-sonnet|sonnet-4|sonnet-3", content, re.IGNORECASE):
        return "claude-sonnet"
    if re.search(r"claude-haiku|haiku", content, re.IGNORECASE):
        return "claude-haiku"
    if re.search(r"gpt-4", content, re.IGNORECASE):
        return "gpt-4"
    if re.search(r"gpt-3\.5", content, re.IGNORECASE):
        return "gpt-3.5"
    return "default"


def scan_file(filepath: str) -> dict:
    """Scan a single file for agent patterns."""
    results = {"patterns": {}, "model": "unknown", "agent_calls_estimate": 0}

    try:
        with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
            content = f.read()
            lines = content.split("\n")

        results["model"] = detect_model(content)

        for category, patterns in AGENT_PATTERNS.items():
            hits = []
            for pattern in patterns:
                for i, line in enumerate(lines, 1):
                    if re.search(pattern, line, re.IGNORECASE):
                        hits.append({"line": i, "snippet": line.strip()[:100]})
            if hits:
                results["patterns"][category] = hits

        # Estimate agent call count
        agent_call_count = len(results["patterns"].get("agent_create", []))
        handoff_count = len(results["patterns"].get("handoff", []))
        results["agent_calls_estimate"] = agent_call_count + handoff_count

    except Exception as e:
        results["error"] = str(e)

    return results


def build_agent_topology(findings: dict) -> dict:
    """Analyze all findings to build topology map."""
    topology = {
        "pattern_type": "unknown",
        "agent_files": [],
        "handoff_files": [],
        "has_convergence_guards": False,
        "has_output_validation": False,
        "missing_safety": [],
        "total_agent_call_estimates": 0,
    }

    has_supervisor = False
    has_p2p = False
    has_hierarchical = False

    for filepath, data in findings.items():
        patterns = data.get("patterns", {})

        if patterns.get("agent_create"):
            topology["agent_files"].append(filepath)
            topology["total_agent_call_estimates"] += data.get("agent_calls_estimate", 0)

        if patterns.get("handoff"):
            topology["handoff_files"].append(filepath)

        if patterns.get("supervisor_pattern"):
            has_supervisor = True

        if patterns.get("p2p_pattern"):
            has_p2p = True

        if patterns.get("hierarchical_pattern"):
            has_hierarchical = True

        if patterns.get("convergence_guard"):
            topology["has_convergence_guards"] = True

        if patterns.get("validation"):
            topology["has_output_validation"] = True

    # Determine primary pattern
    if has_hierarchical:
        topology["pattern_type"] = "hierarchical"
    elif has_p2p:
        topology["pattern_type"] = "p2p_swarm"
    elif has_supervisor:
        topology["pattern_type"] = "supervisor"
    elif topology["agent_files"]:
        topology["pattern_type"] = "single_agent"

    # Check for missing safety mechanisms
    if has_p2p and not topology["has_convergence_guards"]:
        topology["missing_safety"].append("P2P pattern detected but NO convergence guards (max_iterations/TTL)")

    if topology["handoff_files"] and not topology["has_output_validation"]:
        topology["missing_safety"].append("Handoffs detected but NO output validation between agents")

    if topology["total_agent_call_estimates"] > 20:
        topology["missing_safety"].append(
            f"High agent call estimate ({topology['total_agent_call_estimates']}) — token budget likely exceeds 15x baseline"
        )

    return topology


def estimate_token_cost(topology: dict, findings: dict) -> dict:
    """Estimate total token cost for the multi-agent system."""
    # Rough: each agent call averages 2k input + 500 output tokens
    avg_input_tokens = 2000
    avg_output_tokens = 500

    # Detect dominant model
    model_counts = defaultdict(int)
    for data in findings.values():
        model_counts[data.get("model", "default")] += 1

    dominant_model = max(model_counts, key=model_counts.get) if model_counts else "default"
    costs = MODEL_COSTS.get(dominant_model, MODEL_COSTS["default"])

    total_calls = topology["total_agent_call_estimates"]
    input_cost = (total_calls * avg_input_tokens / 1_000_000) * costs["input"]
    output_cost = (total_calls * avg_output_tokens / 1_000_000) * costs["output"]

    return {
        "dominant_model": dominant_model,
        "estimated_agent_calls": total_calls,
        "estimated_input_tokens": total_calls * avg_input_tokens,
        "estimated_output_tokens": total_calls * avg_output_tokens,
        "estimated_cost_usd": round(input_cost + output_cost, 4),
        "baseline_multiplier_estimate": max(1, total_calls // 3),
        "recommendation": (
            "Consider using claude-haiku for sub-agents to reduce cost by ~10x"
            if dominant_model in ("claude-opus", "gpt-4", "claude-sonnet")
            else "Token economics look reasonable"
        ),
    }


def generate_recommendations(topology: dict) -> list:
    """Generate actionable architectural recommendations."""
    recs = []

    if topology["missing_safety"]:
        for issue in topology["missing_safety"]:
            recs.append({"severity": "HIGH", "issue": issue})

    if topology["pattern_type"] == "unknown" and topology["agent_files"]:
        recs.append({
            "severity": "MEDIUM",
            "issue": "Agent files detected but no clear pattern (Supervisor/P2P/Hierarchical)",
            "recommendation": "Explicit pattern selection prevents architectural drift. Define one dominant coordination pattern.",
        })

    if topology["pattern_type"] == "hierarchical":
        agent_file_count = len(topology["agent_files"])
        if agent_file_count > 6:
            recs.append({
                "severity": "MEDIUM",
                "issue": f"Hierarchical pattern with {agent_file_count} agent files — coordination overhead risk",
                "recommendation": "Limit hierarchical systems to ≤3 layers. Add direct agent-to-agent communication where possible.",
            })

    if not recs:
        recs.append({"severity": "LOW", "issue": "Multi-agent architecture appears well-structured"})

    return recs


def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Usage: python agent_graph.py <root_dir> [--token-audit]"}, indent=2))
        sys.exit(1)

    root_dir = sys.argv[1]
    token_audit = "--token-audit" in sys.argv

    if not os.path.isdir(root_dir):
        print(json.dumps({"error": f"Not a directory: {root_dir}"}, indent=2))
        sys.exit(1)

    root = Path(root_dir)
    all_findings = {}
    skip_dirs = {"node_modules", ".git", "dist", "__pycache__", ".next", "build"}
    target_exts = {".ts", ".js", ".tsx", ".jsx", ".py", ".mjs"}

    for filepath in root.rglob("*"):
        if any(skip in filepath.parts for skip in skip_dirs):
            continue
        if filepath.suffix not in target_exts:
            continue

        rel_path = str(filepath.relative_to(root))
        result = scan_file(str(filepath))
        if result.get("patterns"):
            all_findings[rel_path] = result

    topology = build_agent_topology(all_findings)
    report = {
        "topology": topology,
        "recommendations": generate_recommendations(topology),
        "files_with_agent_patterns": len(all_findings),
    }

    if token_audit:
        report["token_economics"] = estimate_token_cost(topology, all_findings)

    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()

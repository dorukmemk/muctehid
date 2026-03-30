#!/usr/bin/env python3
"""
coverage_checker.py — Analyzes test coverage reports and identifies branch/line gaps.
Supports: Istanbul/V8 JSON (coverage-summary.json), Jest coverage, Python coverage.xml.
Identifies: uncovered branches, low-coverage files, missing test scenarios.

Usage:
  python coverage_checker.py <project_root>
  python coverage_checker.py <project_root> --threshold 80
  python coverage_checker.py <project_root> --report-path coverage/coverage-summary.json

Output: JSON analysis with coverage gaps, branch misses, and test generation priorities.
"""

import os
import re
import sys
import json
from pathlib import Path

# Default threshold for coverage warnings
DEFAULT_THRESHOLD = 80


def load_istanbul_summary(filepath: str) -> dict:
    """Load Istanbul/V8 coverage-summary.json format."""
    with open(filepath, "r", encoding="utf-8") as f:
        data = json.load(f)
    return data


def load_istanbul_detailed(coverage_dir: str) -> dict:
    """Load detailed Istanbul coverage (coverage-final.json)."""
    detailed_path = os.path.join(coverage_dir, "coverage-final.json")
    if os.path.exists(detailed_path):
        with open(detailed_path, "r", encoding="utf-8") as f:
            return json.load(f)
    return {}


def parse_coverage_xml(filepath: str) -> dict:
    """Parse Python coverage.xml format."""
    import xml.etree.ElementTree as ET

    tree = ET.parse(filepath)
    root = tree.getroot()

    files = {}
    for package in root.findall(".//package"):
        for cls in package.findall(".//class"):
            filename = cls.get("filename", "unknown")
            branch_rate = float(cls.get("branch-rate", 0)) * 100
            line_rate = float(cls.get("line-rate", 0)) * 100

            uncovered_lines = []
            for line in cls.findall(".//line"):
                hits = int(line.get("hits", 0))
                if hits == 0:
                    uncovered_lines.append(int(line.get("number", 0)))

            files[filename] = {
                "line_pct": round(line_rate, 1),
                "branch_pct": round(branch_rate, 1),
                "uncovered_lines": uncovered_lines[:20],
            }

    return files


def analyze_istanbul_summary(data: dict, threshold: int) -> dict:
    """Analyze Istanbul summary format."""
    files_analysis = {}
    total_covered = 0
    total_total = 0
    gaps = []

    for filepath, metrics in data.items():
        if filepath == "total":
            continue

        line_data = metrics.get("lines", {})
        branch_data = metrics.get("branches", {})
        stmt_data = metrics.get("statements", {})

        line_pct = line_data.get("pct", 100)
        branch_pct = branch_data.get("pct", 100)
        stmt_pct = stmt_data.get("pct", 100)

        # Calculate uncovered counts
        lines_total = line_data.get("total", 0)
        lines_covered = line_data.get("covered", 0)
        branches_total = branch_data.get("total", 0)
        branches_covered = branch_data.get("covered", 0)
        uncovered_branches = branches_total - branches_covered

        total_covered += lines_covered
        total_total += lines_total

        priority = "LOW"
        issues = []

        if branch_pct < threshold:
            priority = "HIGH" if branch_pct < 50 else "MEDIUM"
            issues.append(f"Branch coverage {branch_pct:.1f}% (need {threshold}%)")

        if line_pct < threshold:
            priority = "HIGH" if line_pct < 50 else max(priority, "MEDIUM")
            issues.append(f"Line coverage {line_pct:.1f}% (need {threshold}%)")

        if uncovered_branches > 0:
            issues.append(f"{uncovered_branches} uncovered branches")

        if issues:
            gaps.append({
                "file": filepath,
                "priority": priority,
                "line_pct": round(line_pct, 1),
                "branch_pct": round(branch_pct, 1),
                "uncovered_branches": uncovered_branches,
                "uncovered_lines": lines_total - lines_covered,
                "issues": issues,
            })

        files_analysis[filepath] = {
            "line_pct": round(line_pct, 1),
            "branch_pct": round(branch_pct, 1),
            "stmt_pct": round(stmt_pct, 1),
            "uncovered_branches": uncovered_branches,
        }

    # Sort gaps by priority
    priority_order = {"HIGH": 0, "MEDIUM": 1, "LOW": 2}
    gaps.sort(key=lambda x: (priority_order.get(x["priority"], 3), -x.get("uncovered_branches", 0)))

    # Overall stats
    total_line_pct = round(total_covered / max(total_total, 1) * 100, 1)

    return {
        "overall_line_pct": total_line_pct,
        "files_analyzed": len(files_analysis),
        "files_below_threshold": len(gaps),
        "gaps": gaps[:20],
    }


def infer_test_scenarios(file_path: str, uncovered_branches: int) -> list:
    """Generate test scenario hints based on file path and coverage gaps."""
    scenarios = []
    name = Path(file_path).stem.lower()

    # Auth-related files
    if any(kw in name for kw in ["auth", "login", "token", "password", "jwt"]):
        scenarios += [
            "Test with invalid/expired token → expect 401",
            "Test with missing token → expect 401",
            "Test with valid credentials → expect success",
            "Test with wrong password → expect 401",
        ]

    # Middleware files
    if any(kw in name for kw in ["middleware", "guard", "interceptor"]):
        scenarios += [
            "Test middleware short-circuit (unauthorized request)",
            "Test middleware pass-through (authorized request)",
            "Test error propagation to next(err)",
        ]

    # Service/handler files
    if any(kw in name for kw in ["service", "handler", "controller", "resolver"]):
        scenarios += [
            "Test success path with valid inputs",
            "Test with missing required fields → expect validation error",
            "Test with DB error → expect 500 or graceful error",
        ]

    # Utility/helper files
    if any(kw in name for kw in ["util", "helper", "format", "parse", "validate"]):
        scenarios += [
            "Test with null/undefined inputs",
            "Test boundary values (empty string, 0, negative numbers)",
            "Test invalid type inputs",
        ]

    # Generic branch coverage hints
    if uncovered_branches > 0:
        scenarios.append(f"Add {uncovered_branches} test case(s) targeting uncovered branches (error paths, edge cases)")

    return scenarios[:6]


def find_coverage_report(root_dir: str) -> tuple:
    """Auto-detect coverage report in common locations."""
    root = Path(root_dir)

    # Istanbul/Jest locations
    candidates = [
        root / "coverage" / "coverage-summary.json",
        root / "coverage" / "coverage-final.json",
        root / ".nyc_output" / "coverage-summary.json",
        root / "coverage.json",
    ]
    for c in candidates:
        if c.exists():
            return str(c), "istanbul"

    # Python coverage.xml
    py_candidates = [
        root / "coverage.xml",
        root / "htmlcov" / "coverage.xml",
    ]
    for c in py_candidates:
        if c.exists():
            return str(c), "python"

    return None, None


def check_coverage(project_root: str, threshold: int = DEFAULT_THRESHOLD, report_path: str = None) -> dict:
    """Main coverage analysis entry point."""

    if report_path and not os.path.exists(report_path):
        return {"status": "error", "message": f"Report not found: {report_path}"}

    if not report_path:
        report_path, report_type = find_coverage_report(project_root)
    else:
        report_type = "istanbul" if report_path.endswith(".json") else "python"

    if not report_path:
        return {
            "status": "no_report",
            "message": "No coverage report found. Run tests with coverage first.",
            "how_to_generate": {
                "jest": "npx jest --coverage",
                "vitest": "npx vitest run --coverage",
                "pytest": "pytest --cov=. --cov-report=xml",
                "node_v8": "npx c8 npm test",
            },
        }

    try:
        if report_type == "istanbul":
            data = load_istanbul_summary(report_path)
            analysis = analyze_istanbul_summary(data, threshold)
        elif report_type == "python":
            files_data = parse_coverage_xml(report_path)
            gaps = []
            for fp, metrics in files_data.items():
                if metrics["line_pct"] < threshold or metrics["branch_pct"] < threshold:
                    gaps.append({
                        "file": fp,
                        "priority": "HIGH" if metrics["line_pct"] < 50 else "MEDIUM",
                        "line_pct": metrics["line_pct"],
                        "branch_pct": metrics["branch_pct"],
                        "uncovered_lines": len(metrics["uncovered_lines"]),
                        "issues": [f"Coverage at {metrics['line_pct']}%"],
                    })
            analysis = {
                "overall_line_pct": sum(m["line_pct"] for m in files_data.values()) / max(len(files_data), 1),
                "files_analyzed": len(files_data),
                "files_below_threshold": len(gaps),
                "gaps": sorted(gaps, key=lambda x: x["line_pct"])[:20],
            }
        else:
            return {"status": "error", "message": "Unknown report format"}

    except Exception as e:
        return {"status": "error", "message": str(e)}

    # Augment gaps with test scenario hints
    for gap in analysis.get("gaps", []):
        gap["suggested_test_scenarios"] = infer_test_scenarios(
            gap["file"],
            gap.get("uncovered_branches", 0)
        )

    return {
        "status": "success",
        "report_path": report_path,
        "threshold": threshold,
        "analysis": analysis,
        "verdict": (
            f"✅ Coverage at {analysis.get('overall_line_pct', 0):.1f}% — above {threshold}% threshold"
            if analysis.get("overall_line_pct", 0) >= threshold
            else f"❌ Coverage at {analysis.get('overall_line_pct', 0):.1f}% — below {threshold}% threshold. {analysis.get('files_below_threshold', 0)} files need tests."
        ),
    }


def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Usage: python coverage_checker.py <root> [--threshold N] [--report-path P]"}, indent=2))
        sys.exit(1)

    root_dir = sys.argv[1]
    threshold = DEFAULT_THRESHOLD
    report_path = None

    for i, arg in enumerate(sys.argv):
        if arg == "--threshold" and i + 1 < len(sys.argv):
            try:
                threshold = int(sys.argv[i + 1])
            except ValueError:
                pass
        if arg == "--report-path" and i + 1 < len(sys.argv):
            report_path = sys.argv[i + 1]

    result = check_coverage(root_dir, threshold, report_path)
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()

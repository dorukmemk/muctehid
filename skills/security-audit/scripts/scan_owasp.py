#!/usr/bin/env python3
"""
scan_owasp.py — OWASP Top 10 + CWE-aligned static security scanner.
Performs regex-based pattern matching for 20+ vulnerability categories.
Maps every finding to OWASP Top 10 (2021) and CWE IDs.

Usage: python scan_owasp.py <file_or_dir> [--severity HIGH|MEDIUM|LOW]
Output: JSON findings with file, line, type, severity, cwe, owasp_category, snippet, fix_hint
"""

import os
import re
import sys
import json
from pathlib import Path

# ─────────────────────────────────────────────────────────────────────────────
# VULNERABILITY PATTERNS
# Format: { "TYPE": { "pattern": regex, "severity": H/M/L, "cwe": "CWE-XXX",
#                     "owasp": "A0X:2021 - Name", "fix": "brief fix hint" } }
# ─────────────────────────────────────────────────────────────────────────────
PATTERNS = {
    # ── A01: Broken Access Control ────────────────────────────────────────────
    "IDOR_DIRECT_OBJECT": {
        "pattern": r"(?:req\.params|req\.query|req\.body)\.\w+.*(?:findById|findOne|update|delete)\(",
        "severity": "HIGH",
        "cwe": "CWE-639",
        "owasp": "A01:2021 - Broken Access Control",
        "fix": "Verify ownership before performing DB operations. Check req.user.id === resource.userId.",
    },
    "MISSING_AUTH_MIDDLEWARE": {
        "pattern": r"(?:router|app)\.(get|post|put|delete|patch)\s*\(\s*[\"'][^\"']+[\"']\s*,\s*(?:async\s*)?\(",
        "severity": "MEDIUM",
        "cwe": "CWE-862",
        "owasp": "A01:2021 - Broken Access Control",
        "fix": "Ensure authentication middleware is applied before route handlers.",
    },

    # ── A02: Cryptographic Failures ───────────────────────────────────────────
    "WEAK_HASH_MD5": {
        "pattern": r"(?:createHash|hashlib\.new|md5)\s*\(\s*[\"']md5[\"']",
        "severity": "HIGH",
        "cwe": "CWE-327",
        "owasp": "A02:2021 - Cryptographic Failures",
        "fix": "Replace MD5 with SHA-256 or bcrypt for password hashing.",
    },
    "WEAK_HASH_SHA1": {
        "pattern": r"(?:createHash|hashlib\.new)\s*\(\s*[\"']sha1[\"']",
        "severity": "HIGH",
        "cwe": "CWE-327",
        "owasp": "A02:2021 - Cryptographic Failures",
        "fix": "Replace SHA-1 with SHA-256 minimum. Use bcrypt/argon2 for passwords.",
    },
    "HARDCODED_SECRET": {
        "pattern": r"(?:password|passwd|api_key|apikey|secret|token|private_key|access_key)\s*[:=]\s*[\"'][A-Za-z0-9+/=_\-]{10,}[\"']",
        "severity": "CRITICAL",
        "cwe": "CWE-798",
        "owasp": "A02:2021 - Cryptographic Failures",
        "fix": "Move all secrets to environment variables. Never hardcode credentials.",
    },
    "HTTP_INSTEAD_OF_HTTPS": {
        "pattern": r"[\"']http://(?!localhost|127\.0\.0\.1|0\.0\.0\.0)[^\"']{5,}[\"']",
        "severity": "MEDIUM",
        "cwe": "CWE-319",
        "owasp": "A02:2021 - Cryptographic Failures",
        "fix": "Use HTTPS for all external communications.",
    },
    "WEAK_RANDOM": {
        "pattern": r"Math\.random\(\)|random\.random\(\)|rand\(\)",
        "severity": "MEDIUM",
        "cwe": "CWE-338",
        "owasp": "A02:2021 - Cryptographic Failures",
        "fix": "Use cryptographically secure random: crypto.randomBytes() (Node) or secrets.token_bytes() (Python).",
    },

    # ── A03: Injection ────────────────────────────────────────────────────────
    "SQL_INJECTION_TEMPLATE": {
        "pattern": r"(?:query|execute|raw)\s*\(\s*[`\"'](?:[^`\"']*)\$\{[^}]+\}[`\"']",
        "severity": "CRITICAL",
        "cwe": "CWE-89",
        "owasp": "A03:2021 - Injection",
        "fix": "Use parameterized queries or an ORM. Never concatenate user input into SQL.",
    },
    "SQL_INJECTION_CONCAT": {
        "pattern": r"(?:query|execute)\s*\(\s*[\"'].*?\s*\+\s*(?:req\.|user\.|params\.|body\.)",
        "severity": "CRITICAL",
        "cwe": "CWE-89",
        "owasp": "A03:2021 - Injection",
        "fix": "Use parameterized queries. Never string-concatenate user input into SQL.",
    },
    "SHELL_INJECTION_EXEC": {
        "pattern": r"(?:child_process\.exec|exec|popen|subprocess\.call|subprocess\.run)\s*\([^)]*(?:req\.|params\.|body\.|user\.)",
        "severity": "CRITICAL",
        "cwe": "CWE-78",
        "owasp": "A03:2021 - Injection",
        "fix": "Never pass user input to shell commands. Use execFile() with argument arrays instead of exec().",
    },
    "EVAL_CODE_INJECTION": {
        "pattern": r"\beval\s*\([^)]*(?:req\.|params\.|body\.|user\.|input)",
        "severity": "CRITICAL",
        "cwe": "CWE-95",
        "owasp": "A03:2021 - Injection",
        "fix": "Never call eval() with user input. Remove eval() entirely.",
    },
    "PATH_TRAVERSAL": {
        "pattern": r"(?:readFile|createReadStream|readFileSync|open)\s*\([^)]*(?:req\.|params\.|body\.|\.\.\/)",
        "severity": "HIGH",
        "cwe": "CWE-22",
        "owasp": "A03:2021 - Injection",
        "fix": "Validate and sanitize file paths. Use path.resolve() and verify paths stay within allowed directory.",
    },

    # ── A04: Insecure Design ──────────────────────────────────────────────────
    "MASS_ASSIGNMENT": {
        "pattern": r"(?:Object\.assign|\.update|\.create)\s*\([^,]+,\s*req\.body\s*\)",
        "severity": "HIGH",
        "cwe": "CWE-915",
        "owasp": "A04:2021 - Insecure Design",
        "fix": "Whitelist allowed fields explicitly instead of spreading req.body.",
    },

    # ── A05: Security Misconfiguration ────────────────────────────────────────
    "CORS_WILDCARD": {
        "pattern": r"(?:origin|Access-Control-Allow-Origin)[\"'\s:]+[\"']\*[\"']",
        "severity": "MEDIUM",
        "cwe": "CWE-942",
        "owasp": "A05:2021 - Security Misconfiguration",
        "fix": "Specify allowed origins explicitly. Never use wildcard (*) in production.",
    },
    "DEBUG_ENABLED_PROD": {
        "pattern": r"(?:app\.set|DEBUG|debug)\s*\(\s*[\"']debug[\"']\s*,\s*true\s*\)",
        "severity": "MEDIUM",
        "cwe": "CWE-489",
        "owasp": "A05:2021 - Security Misconfiguration",
        "fix": "Disable debug mode in production. Use NODE_ENV=production.",
    },
    "VERBOSE_ERROR_DISCLOSURE": {
        "pattern": r"res\.(?:json|send)\s*\(\s*\{[^}]*(?:stack|err\.message|error\.stack)[^}]*\}\s*\)",
        "severity": "MEDIUM",
        "cwe": "CWE-209",
        "owasp": "A05:2021 - Security Misconfiguration",
        "fix": "Never expose stack traces or internal error details to clients. Log server-side only.",
    },

    # ── A07: Identification & Authentication Failures ─────────────────────────
    "JWT_NONE_ALGORITHM": {
        "pattern": r"(?:algorithm|alg)\s*:\s*[\"']none[\"']",
        "severity": "CRITICAL",
        "cwe": "CWE-347",
        "owasp": "A07:2021 - Identification and Authentication Failures",
        "fix": "Never allow 'none' algorithm for JWT. Explicitly specify HS256 or RS256.",
    },
    "JWT_VERIFY_SKIP": {
        "pattern": r"jwt\.(?:decode|verify)\s*\([^,]+,\s*(?:null|undefined|false)",
        "severity": "CRITICAL",
        "cwe": "CWE-347",
        "owasp": "A07:2021 - Identification and Authentication Failures",
        "fix": "Always verify JWT signature. Never skip verification with null secret.",
    },
    "WEAK_PASSWORD_POLICY": {
        "pattern": r"password\.length\s*(?:>=|>)\s*[1-5]\b",
        "severity": "MEDIUM",
        "cwe": "CWE-521",
        "owasp": "A07:2021 - Identification and Authentication Failures",
        "fix": "Enforce minimum password length of 12 characters and require complexity.",
    },

    # ── A08: Software and Data Integrity Failures ─────────────────────────────
    "DESERIALIZE_UNSAFE": {
        "pattern": r"(?:unserialize|pickle\.loads|yaml\.load\b|marshal\.loads)\s*\(",
        "severity": "HIGH",
        "cwe": "CWE-502",
        "owasp": "A08:2021 - Software and Data Integrity Failures",
        "fix": "Use yaml.safe_load() instead of yaml.load(). Avoid deserializing untrusted data.",
    },

    # ── A10: SSRF ─────────────────────────────────────────────────────────────
    "SSRF_USER_URL": {
        "pattern": r"(?:fetch|axios\.get|axios\.post|http\.get|request)\s*\([^)]*(?:req\.|params\.|body\.|query\.)\w+",
        "severity": "HIGH",
        "cwe": "CWE-918",
        "owasp": "A10:2021 - Server-Side Request Forgery",
        "fix": "Validate and whitelist allowed URL destinations. Block internal/private IP ranges.",
    },

    # ── XSS ───────────────────────────────────────────────────────────────────
    "XSS_DANGEROUS_HTML": {
        "pattern": r"dangerouslySetInnerHTML\s*=\s*\{",
        "severity": "HIGH",
        "cwe": "CWE-79",
        "owasp": "A03:2021 - Injection (XSS)",
        "fix": "Avoid dangerouslySetInnerHTML. If required, sanitize with DOMPurify.",
    },
    "XSS_INNERHTML": {
        "pattern": r"\.innerHTML\s*=\s*(?!\"\")",
        "severity": "HIGH",
        "cwe": "CWE-79",
        "owasp": "A03:2021 - Injection (XSS)",
        "fix": "Use textContent instead of innerHTML. If HTML is needed, sanitize first.",
    },
}

SEVERITY_ORDER = {"CRITICAL": 0, "HIGH": 1, "MEDIUM": 2, "LOW": 3}


def scan_file(filepath: str, min_severity: str = "LOW") -> list:
    """Scan a single file for all vulnerability patterns."""
    findings = []
    min_level = SEVERITY_ORDER.get(min_severity.upper(), 3)

    try:
        with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
            content = f.read()
            lines = content.split("\n")
    except Exception as e:
        return [{"error": str(e), "file": filepath}]

    for vuln_type, config in PATTERNS.items():
        severity_level = SEVERITY_ORDER.get(config["severity"], 3)
        if severity_level > min_level:
            continue

        try:
            matches = list(re.finditer(config["pattern"], content, re.IGNORECASE))
        except re.error:
            continue

        for match in matches:
            line_no = content.count("\n", 0, match.start()) + 1
            findings.append({
                "type": vuln_type,
                "severity": config["severity"],
                "cwe": config["cwe"],
                "owasp": config["owasp"],
                "line": line_no,
                "snippet": match.group(0).strip()[:120],
                "fix": config["fix"],
            })

    return findings


def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Usage: python scan_owasp.py <file_or_dir> [--severity HIGH|MEDIUM|LOW]"}, indent=2))
        sys.exit(1)

    target = sys.argv[1]
    min_severity = "LOW"
    for i, arg in enumerate(sys.argv):
        if arg == "--severity" and i + 1 < len(sys.argv):
            min_severity = sys.argv[i + 1].upper()

    all_findings = {}
    total_count = 0

    if os.path.isfile(target):
        findings = scan_file(target, min_severity)
        if findings:
            all_findings[target] = findings
            total_count = len(findings)

    elif os.path.isdir(target):
        skip_dirs = {"node_modules", ".git", "dist", "__pycache__", ".next", "build"}
        target_exts = {".ts", ".js", ".tsx", ".jsx", ".py", ".go", ".rs"}

        for filepath in Path(target).rglob("*"):
            if any(skip in filepath.parts for skip in skip_dirs):
                continue
            if filepath.suffix not in target_exts:
                continue
            if not filepath.is_file():
                continue

            findings = scan_file(str(filepath), min_severity)
            if findings:
                all_findings[str(filepath)] = findings
                total_count += len(findings)

    # Build summary
    severity_counts = {"CRITICAL": 0, "HIGH": 0, "MEDIUM": 0, "LOW": 0}
    owasp_counts = {}
    for findings in all_findings.values():
        for f in findings:
            sev = f.get("severity", "LOW")
            severity_counts[sev] = severity_counts.get(sev, 0) + 1
            owasp = f.get("owasp", "Unknown")
            owasp_counts[owasp] = owasp_counts.get(owasp, 0) + 1

    output = {
        "summary": {
            "total_findings": total_count,
            "files_with_findings": len(all_findings),
            "severity_breakdown": severity_counts,
            "owasp_breakdown": owasp_counts,
        },
        "findings": all_findings,
    }

    print(json.dumps(output, indent=2))


if __name__ == "__main__":
    main()

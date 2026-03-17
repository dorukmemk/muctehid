import os
import re
import sys
import json

# Common security patterns (SQLi, XSS, DangerouslySet, Hardcoded secrets)
PATTERNS = {
    "SQL_INJECTION": r"(query|execute)\s*\(\s*[`\"'].*?\$\{.*?\}",
    "XSS_REACT": r"dangerouslySetInnerHTML",
    "SHELL_EXECUTION": r"(child_process\.(exec|spawn)|eval\s*\()",
    "HARDCODED_SECRET": r"(password|api_key|secret|token)\s*[:=]\s*[`\"'][A-Za-z0-9_-]{10,}[`\"']",
    "WEAK_CRYPTO": r"(md5|sha1)\("
}

def scan_file(filepath):
    findings = []
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
            for name, pattern in PATTERNS.items():
                matches = re.finditer(pattern, content, re.IGNORECASE)
                for match in matches:
                    line_no = content.count('\n', 0, match.start()) + 1
                    findings.append({
                        "type": name,
                        "line": line_no,
                        "snippet": match.group(0).strip()
                    })
    except Exception as e:
        return {"error": str(e)}
    return findings

def main():
    if len(sys.argv) < 2:
        print("Usage: python scan_owasp.py <file_or_dir>")
        sys.exit(1)

    target = sys.argv[1]
    all_findings = {}

    if os.path.isfile(target):
        all_findings[target] = scan_file(target)
    elif os.path.isdir(target):
        for root, _, files in os.walk(target):
            for file in files:
                if file.endswith(('.ts', '.js', '.tsx', '.jsx', '.py')):
                    path = os.path.join(root, file)
                    f = scan_file(path)
                    if f: all_findings[path] = f

    print(json.dumps(all_findings, indent=2))

if __name__ == "__main__":
    main()

import os
import re
import sys
import json

def get_imports(filepath):
    imports = []
    # Simplified regex for TS/JS and Python imports
    patterns = [
        r"import\s+.*?\s+from\s+[`\"'](.*?)[`\"']",
        r"import\s+[`\"'](.*?)[`\"']",
        r"require\s*\(\s*[`\"'](.*?)[`\"']\s*\)",
        r"from\s+(.*?)\s+import",
        r"import\s+([A-Za-z0-9_., ]+)"
    ]
    
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
            for p in patterns:
                matches = re.finditer(p, content)
                for m in matches:
                    imports.append(m.group(1).strip())
    except:
        pass
    return imports

def build_graph(root_dir):
    graph = {}
    for root, _, files in os.walk(root_dir):
        for file in files:
            if file.endswith(('.ts', '.js', '.tsx', '.jsx', '.py')):
                full_path = os.path.join(root, file)
                rel_path = os.path.relpath(full_path, root_dir)
                graph[rel_path] = get_imports(full_path)
    return graph

def main():
    root = sys.argv[1] if len(sys.argv) > 1 else "."
    print(json.dumps(build_graph(root), indent=2))

if __name__ == "__main__":
    main()

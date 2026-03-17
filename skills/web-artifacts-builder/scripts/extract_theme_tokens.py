import os
import re
import sys
import json

def extract_tokens(project_root):
    tokens = {
        "colors": {},
        "spacing": {},
        "found_tailwind": False
    }
    
    # Check tailwind.config.js
    tw_path = os.path.join(project_root, 'tailwind.config.js')
    if os.path.exists(tw_path):
        tokens["found_tailwind"] = True
        with open(tw_path, 'r') as f:
            content = f.read()
            # Crude regex for major colors
            color_matches = re.findall(r"['\"]?(.*?)['\"]?\s*:\s*['\"](#?[A-Za-z0-9]+)['\"]", content)
            for k, v in color_matches:
                tokens["colors"][k] = v

    # Check CSS variables in index.css or globals.css
    for css_file in ['index.css', 'globals.css', 'src/index.css', 'src/app/globals.css']:
        path = os.path.join(project_root, css_file)
        if os.path.exists(path):
            with open(path, 'r') as f:
                content = f.read()
                vars = re.findall(r"--(.*?)\s*:\s*(.*?);", content)
                for k, v in vars:
                    tokens["colors"][k.strip()] = v.strip()
                    
    return tokens

def main():
    root = sys.argv[1] if len(sys.argv) > 1 else "."
    print(json.dumps(extract_tokens(root), indent=2))

if __name__ == "__main__":
    main()

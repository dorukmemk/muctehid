import sys
import json
import os

try:
    from docx import Document
except ImportError:
    print("Error: python-docx not found. Please install with 'pip install python-docx'")
    sys.exit(1)

def extract_comments(docx_path):
    # python-docx doesn't natively expose comments easily in the top-level API
    # but we can look at the part relationships
    try:
        doc = Document(docx_path)
        # This is a placeholder for a more complex XML crawl if needed
        # Standard approach for 'Expert' is to parse 'word/comments.xml' manually
        return {
            "status": "ready",
            "message": "Comment extraction requires direct XML parsing of word/comments.xml. Use unpack.py first.",
            "file": docx_path
        }
    except Exception as e:
        return {"error": str(e)}

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python extract_comments.py <file.docx>")
    else:
        print(json.dumps(extract_comments(sys.argv[1]), indent=2))

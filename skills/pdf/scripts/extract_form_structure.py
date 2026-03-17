import json
import sys
import os

try:
    import pdfplumber
except ImportError:
    print("Error: pdfplumber not found. Please install with 'pip install pdfplumber'")
    sys.exit(1)

def extract_form_structure(pdf_path):
    structure = {
        "pages": [],
        "labels": [],
        "lines": [],
        "checkboxes": [],
        "row_boundaries": []
    }

    with pdfplumber.open(pdf_path) as pdf:
        for page_num, page in enumerate(pdf.pages, 1):
            structure["pages"].append({
                "page_number": page_num,
                "width": float(page.width),
                "height": float(page.height)
            })

            # Extract words with coordinates
            words = page.extract_words()
            for word in words:
                structure["labels"].append({
                    "page": page_num,
                    "text": word["text"],
                    "x0": round(float(word["x0"]), 1),
                    "top": round(float(word["top"]), 1),
                    "x1": round(float(word["x1"]), 1),
                    "bottom": round(float(word["bottom"]), 1)
                })

            # Extract horizontal lines (likely row separators)
            for line in page.lines:
                if abs(float(line["x1"]) - float(line["x0"])) > page.width * 0.3:
                    structure["lines"].append({
                        "page": page_num,
                        "y": round(float(line["top"]), 1),
                        "x0": round(float(line["x0"]), 1),
                        "x1": round(float(line["x1"]), 1)
                    })

            # Detect potential checkboxes (small squares)
            for rect in page.rects:
                w = float(rect["x1"]) - float(rect["x0"])
                h = float(rect["bottom"]) - float(rect["top"])
                if 5 <= w <= 20 and 5 <= h <= 20 and abs(w - h) < 3:
                    structure["checkboxes"].append({
                        "page": page_num,
                        "x0": round(float(rect["x0"]), 1),
                        "top": round(float(rect["top"]), 1),
                        "x1": round(float(rect["x1"]), 1),
                        "bottom": round(float(rect["bottom"]), 1)
                    })

    return structure

def main():
    if len(sys.argv) < 2:
        print("Usage: python extract_form_structure.py <input.pdf> [output.json]")
        sys.exit(1)

    pdf_path = sys.argv[1]
    output_path = sys.argv[2] if len(sys.argv) > 2 else "structure_out.json"

    if not os.path.exists(pdf_path):
        print(f"Error: File {pdf_path} not found.")
        sys.exit(1)

    print(json.dumps(extract_form_structure(pdf_path), indent=2))

if __name__ == "__main__":
    main()

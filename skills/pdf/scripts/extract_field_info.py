import sys
import json
import os

try:
    import pypdf
except ImportError:
    print("Error: pypdf not found. Please install with 'pip install pypdf'")
    sys.exit(1)

def get_form_fields(pdf_path):
    fields_info = []
    try:
        reader = pypdf.PdfReader(pdf_path)
        fields = reader.get_fields()
        if not fields:
            return {"status": "no_fields", "fields": []}
            
        for name, field in fields.items():
            fields_info.append({
                "name": name,
                "type": str(field.get('/FT', 'Unknown')),
                "value": field.get('/V', ''),
                "raw": str(field)
            })
        return {"status": "success", "fields": fields_info}
    except Exception as e:
        return {"error": str(e)}

def main():
    if len(sys.argv) < 2:
        print("Usage: python extract_field_info.py <input.pdf>")
        sys.exit(1)
    
    print(json.dumps(get_form_fields(sys.argv[1]), indent=2))

if __name__ == "__main__":
    main()

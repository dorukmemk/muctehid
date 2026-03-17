import sys
import os

try:
    from pptx import Presentation
    from pptx.util import Inches, Pt
except ImportError:
    print("Error: python-pptx not found. Please install with 'pip install python-pptx'")
    sys.exit(1)

def add_slide_with_content(pptx_path, title, content):
    if os.path.exists(pptx_path):
        prs = Presentation(pptx_path)
    else:
        prs = Presentation()
    
    # Using a standard Title and Content layout (usually index 1)
    slide_layout = prs.slide_layouts[1]
    slide = prs.slides.add_slide(slide_layout)
    
    title_placeholder = slide.shapes.title
    title_placeholder.text = title
    
    body_placeholder = slide.placeholders[1]
    tf = body_placeholder.text_frame
    tf.text = content
    
    prs.save(pptx_path)
    print(f"Successfully added slide to {pptx_path}")

def main():
    if len(sys.argv) < 4:
        print("Usage: python add_slide.py <file.pptx> <title> <body_content>")
        sys.exit(1)
        
    path = sys.argv[1]
    title = sys.argv[2]
    body = sys.argv[3]
    add_slide_with_content(path, title, body)

if __name__ == "__main__":
    main()

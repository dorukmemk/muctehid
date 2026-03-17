import zipfile
import os
import sys
import shutil

def unpack_office_file(file_path, output_dir):
    """
    XLSX, PPTX, and DOCX are essentially ZIP files containing XMLs.
    This script unpacks them for deep auditing/editing.
    """
    if not os.path.exists(file_path):
        print(f"Error: {file_path} not found.")
        return False
        
    if os.path.exists(output_dir):
        shutil.rmtree(output_dir)
    
    os.makedirs(output_dir)
    
    try:
        with zipfile.ZipFile(file_path, 'r') as zip_ref:
            zip_ref.extractall(output_dir)
        print(f"Successfully unpacked {file_path} into {output_dir}")
        return True
    except Exception as e:
        print(f"Error unpacking: {e}")
        return False

def main():
    if len(sys.argv) < 3:
        print("Usage: python unpack.py <input_file> <output_dir>")
        sys.exit(1)
        
    source = sys.argv[1]
    dest = sys.argv[2]
    unpack_office_file(source, dest)

if __name__ == "__main__":
    main()

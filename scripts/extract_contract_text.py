"""
Contract PDF Text Extraction Script

Extracts text content from PDF contracts for full-text search indexing.
Uses pypdf library for reliable Korean text extraction.

Usage:
    python scripts/extract_contract_text.py <pdf_path>
    python scripts/extract_contract_text.py C:/path/to/contract.pdf
"""

from pypdf import PdfReader
import json
import sys
import os


def extract_contract_text(pdf_path: str) -> dict:
    """
    Extract text from contract PDF for full-text search.

    Args:
        pdf_path: Absolute path to PDF file

    Returns:
        Dictionary containing:
        - total_pages: Number of pages in PDF
        - text_content: Extracted text from all pages
        - metadata: PDF metadata (title, author, creation date)
        - file_size: File size in bytes
    """
    if not os.path.exists(pdf_path):
        raise FileNotFoundError(f"PDF file not found: {pdf_path}")

    try:
        reader = PdfReader(pdf_path)

        extracted_data = {
            "total_pages": len(reader.pages),
            "text_content": "",
            "metadata": {},
            "file_size": os.path.getsize(pdf_path)
        }

        # Extract text from all pages
        for page_num, page in enumerate(reader.pages, start=1):
            page_text = page.extract_text()
            if page_text:
                extracted_data["text_content"] += f"[Page {page_num}]\n{page_text}\n\n"

        # Extract PDF metadata
        if reader.metadata:
            extracted_data["metadata"] = {
                "title": reader.metadata.get("/Title", ""),
                "author": reader.metadata.get("/Author", ""),
                "creation_date": reader.metadata.get("/CreationDate", ""),
                "producer": reader.metadata.get("/Producer", "")
            }

        return extracted_data

    except Exception as e:
        raise RuntimeError(f"Failed to extract text from PDF: {str(e)}")


def main():
    """CLI entry point for testing PDF extraction"""
    if len(sys.argv) < 2:
        print("Usage: python extract_contract_text.py <pdf_path>")
        sys.exit(1)

    pdf_path = sys.argv[1]

    try:
        result = extract_contract_text(pdf_path)

        print("=" * 80)
        print(f"PDF Text Extraction Results")
        print("=" * 80)
        print(f"File: {pdf_path}")
        print(f"Total Pages: {result['total_pages']}")
        print(f"File Size: {result['file_size']:,} bytes")
        print(f"Text Length: {len(result['text_content'])} characters")
        print()
        print("Metadata:")
        print(json.dumps(result['metadata'], indent=2, ensure_ascii=False))
        print()
        print("Extracted Text (first 500 chars):")
        print("-" * 80)
        print(result['text_content'][:500])
        print("-" * 80)

        # Output full JSON for API usage
        output_file = pdf_path.replace('.pdf', '_extracted.json')
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(result, f, ensure_ascii=False, indent=2)

        print(f"\nFull extraction saved to: {output_file}")

    except Exception as e:
        print(f"Error: {str(e)}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()

"""
DocMind AI - Table Extractor
Structured table extraction from PDF pages using pdfplumber
"""

from utils.logger import get_logger

logger = get_logger(__name__)


def extract_tables_from_page(page) -> list:
    """
    Extract tables from a pdfplumber page object.
    
    Args:
        page: pdfplumber page object
        
    Returns:
        List of table dicts: [{headers, rows, row_count, col_count}]
    """
    tables = []
    try:
        raw_tables = page.extract_tables()
        if not raw_tables:
            return []

        for table_idx, raw_table in enumerate(raw_tables):
            if not raw_table:
                continue

            # Clean table data: remove None values, strip whitespace
            cleaned_rows = []
            for row in raw_table:
                cleaned_row = [str(cell).strip() if cell is not None else "" for cell in row]
                cleaned_rows.append(cleaned_row)

            if not cleaned_rows:
                continue

            # First row as header if it looks like a header
            headers = cleaned_rows[0] if cleaned_rows else []
            data_rows = cleaned_rows[1:] if len(cleaned_rows) > 1 else []

            tables.append({
                "table_index": table_idx,
                "headers": headers,
                "rows": data_rows,
                "row_count": len(cleaned_rows),
                "col_count": len(headers) if headers else 0,
            })

    except Exception as e:
        logger.error(f"Table extraction error: {e}")

    return tables


def tables_to_text(tables: list) -> str:
    """Convert extracted tables to readable text format for embedding."""
    if not tables:
        return ""

    parts = []
    for table in tables:
        headers = table.get("headers", [])
        rows = table.get("rows", [])

        if headers:
            parts.append(" | ".join(headers))
            parts.append("-" * 40)

        for row in rows:
            parts.append(" | ".join(row))

        parts.append("")

    return "\n".join(parts)

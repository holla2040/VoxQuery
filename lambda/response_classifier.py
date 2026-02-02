"""
Response classifier for determining visualization type.
Parses SQL comments to extract TABLE/MAP/CHART designation.
"""

import re


def classify_response(sql: str, columns: list = None, rows: list = None) -> str:
    """
    Determine the appropriate visualization type for query results.

    Priority:
    1. Explicit SQL comment (-- TABLE, -- MAP, -- CHART)
    2. Column-based inference (lat/lon = MAP, aggregations = CHART)
    3. Default to TABLE

    Args:
        sql: The SQL query (may contain visualization comment)
        columns: List of column names in results
        rows: List of result rows

    Returns:
        One of: "TABLE", "MAP", "CHART"
    """
    # Check for explicit comment
    first_line = sql.strip().split('\n')[0].upper()

    if first_line.startswith('-- MAP'):
        # Verify we have lat/lon columns
        if columns and has_geo_columns(columns):
            return "MAP"
        # Fall back to TABLE if no geo columns
        return "TABLE"

    if first_line.startswith('-- CHART'):
        # Verify we have chartable data
        if columns and is_chartable(columns, rows):
            return "CHART"
        return "TABLE"

    if first_line.startswith('-- TABLE'):
        return "TABLE"

    # Infer from columns if no explicit comment
    if columns:
        if has_geo_columns(columns) and rows and len(rows) > 0:
            return "MAP"
        if is_chartable(columns, rows):
            return "CHART"

    return "TABLE"


def has_geo_columns(columns: list) -> bool:
    """Check if result has latitude/longitude columns."""
    col_lower = [c.lower() for c in columns]
    has_lat = any(c in col_lower for c in ['latitude', 'lat'])
    has_lon = any(c in col_lower for c in ['longitude', 'lon', 'lng'])
    return has_lat and has_lon


def is_chartable(columns: list, rows: list) -> bool:
    """
    Determine if results are suitable for charting.

    Chartable data typically has:
    - A categorical column (labels)
    - A numeric column (values)
    - Reasonable number of data points (2-50)
    """
    if not rows or len(rows) < 2 or len(rows) > 50:
        return False

    if len(columns) < 2:
        return False

    # Check for aggregation patterns in column names
    agg_patterns = ['count', 'sum', 'avg', 'average', 'total', 'min', 'max']
    col_lower = [c.lower() for c in columns]

    has_agg = any(
        any(pattern in col for pattern in agg_patterns)
        for col in col_lower
    )

    if has_agg:
        return True

    # Check if we have category + numeric pattern
    if rows:
        first_row = rows[0]
        has_text = False
        has_number = False

        for col in columns:
            value = first_row.get(col)
            if value is not None:
                try:
                    float(value)
                    has_number = True
                except (ValueError, TypeError):
                    if isinstance(value, str) and value:
                        has_text = True

        return has_text and has_number

    return False


def get_chart_config(columns: list, rows: list) -> dict:
    """
    Generate chart configuration based on data.

    Returns:
        dict with:
            - type: "bar" or "line"
            - x_column: Column name for x-axis
            - y_column: Column name for y-axis
    """
    if not columns or len(columns) < 2:
        return {"type": "bar", "x_column": columns[0] if columns else "", "y_column": ""}

    # Find the label (categorical) column - usually first non-numeric
    # Find the value (numeric) column - usually has aggregation name or is numeric

    x_column = columns[0]
    y_column = columns[1] if len(columns) > 1 else columns[0]

    # Look for aggregation column
    agg_patterns = ['count', 'sum', 'avg', 'average', 'total', 'min', 'max', 'salary']
    for col in columns:
        if any(pattern in col.lower() for pattern in agg_patterns):
            y_column = col
            break

    # The other column is likely the label
    for col in columns:
        if col != y_column:
            x_column = col
            break

    # Determine chart type
    # Use line chart for time-based data, bar for categories
    chart_type = "bar"
    time_patterns = ['date', 'month', 'year', 'quarter', 'week', 'day']
    if any(pattern in x_column.lower() for pattern in time_patterns):
        chart_type = "line"

    return {
        "type": chart_type,
        "x_column": x_column,
        "y_column": y_column
    }


def get_map_config(columns: list) -> dict:
    """
    Generate map configuration based on columns.

    Returns:
        dict with lat/lon column mappings and popup fields
    """
    col_lower = {c.lower(): c for c in columns}

    lat_col = None
    lon_col = None

    for key, original in col_lower.items():
        if key in ['latitude', 'lat']:
            lat_col = original
        elif key in ['longitude', 'lon', 'lng']:
            lon_col = original

    # Popup fields are all other columns
    popup_fields = [c for c in columns if c not in [lat_col, lon_col]]

    return {
        "lat_column": lat_col,
        "lon_column": lon_col,
        "popup_fields": popup_fields
    }

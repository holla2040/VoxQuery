"""
Query self-healing module.
Handles automatic retry and correction of failed SQL queries.
"""

from athena_service import execute_query, AthenaQueryError
from bedrock_service import fix_failed_query
from response_classifier import classify_response

# Maximum retry attempts
MAX_RETRY_ATTEMPTS = 2


class QueryResult:
    """Container for query execution results."""

    def __init__(self):
        self.success = False
        self.sql = None
        self.visualization_type = None
        self.columns = []
        self.rows = []
        self.query_id = None
        self.execution_time_ms = 0
        self.attempts = 0
        self.errors = []

    def to_dict(self):
        return {
            "success": self.success,
            "sql": self.sql,
            "visualization_type": self.visualization_type,
            "columns": self.columns,
            "rows": self.rows,
            "query_id": self.query_id,
            "execution_time_ms": self.execution_time_ms,
            "row_count": len(self.rows),
            "attempts": self.attempts,
            "errors": self.errors if not self.success else []
        }


def execute_with_self_heal(
    sql: str,
    question: str,
    visualization_type: str = "TABLE",
    max_attempts: int = MAX_RETRY_ATTEMPTS
) -> QueryResult:
    """
    Execute a SQL query with automatic self-healing on failure.

    The self-healing process:
    1. Execute the original SQL
    2. If it fails, send the error to Bedrock for analysis
    3. Bedrock generates a corrected SQL query
    4. Retry with the corrected query
    5. Repeat up to max_attempts times

    Args:
        sql: The SQL query to execute
        question: The original natural language question
        visualization_type: Initial visualization type (TABLE/MAP/CHART)
        max_attempts: Maximum number of retry attempts

    Returns:
        QueryResult object with execution results
    """
    result = QueryResult()
    result.sql = sql
    result.visualization_type = visualization_type

    current_sql = sql
    attempt = 0

    while attempt <= max_attempts:
        attempt += 1
        result.attempts = attempt

        try:
            # Execute query
            query_result = execute_query(current_sql)

            # Success!
            result.success = True
            result.sql = current_sql
            result.columns = query_result.get("columns", [])
            result.rows = query_result.get("rows", [])
            result.query_id = query_result.get("query_id")
            result.execution_time_ms = query_result.get("execution_time_ms", 0)

            # Re-classify visualization type based on actual results
            result.visualization_type = classify_response(
                current_sql,
                columns=result.columns,
                rows=result.rows
            )

            return result

        except AthenaQueryError as e:
            error_msg = str(e)
            result.errors.append({
                "attempt": attempt,
                "sql": current_sql,
                "error": error_msg
            })

            # If we have more attempts, try to fix the query
            if attempt <= max_attempts:
                try:
                    corrected_sql = fix_failed_query(
                        original_sql=current_sql,
                        error_message=error_msg,
                        question=question
                    )

                    # Only use corrected SQL if it's different
                    if corrected_sql and corrected_sql != current_sql:
                        current_sql = corrected_sql
                    else:
                        # No new suggestion, stop retrying
                        break

                except Exception as fix_error:
                    # Failed to get correction, stop retrying
                    result.errors.append({
                        "attempt": attempt,
                        "error": f"Failed to generate correction: {str(fix_error)}"
                    })
                    break

    return result


def analyze_error(error_message: str) -> dict:
    """
    Analyze an Athena error message to determine the issue type.

    Returns:
        dict with:
            - error_type: Category of error
            - suggestion: Potential fix
            - is_recoverable: Whether self-healing might help
    """
    error_lower = error_message.lower()

    # Column not found errors
    if "column" in error_lower and ("not found" in error_lower or "cannot be resolved" in error_lower):
        return {
            "error_type": "column_not_found",
            "suggestion": "Check column names against schema",
            "is_recoverable": True
        }

    # Table not found errors
    if "table" in error_lower and ("not found" in error_lower or "does not exist" in error_lower):
        return {
            "error_type": "table_not_found",
            "suggestion": "Use fully qualified table name: voice_chat_db.employees",
            "is_recoverable": True
        }

    # Syntax errors
    if "syntax error" in error_lower or "parse error" in error_lower:
        return {
            "error_type": "syntax_error",
            "suggestion": "Check SQL syntax",
            "is_recoverable": True
        }

    # Type mismatch
    if "type mismatch" in error_lower or "cannot be applied" in error_lower:
        return {
            "error_type": "type_mismatch",
            "suggestion": "Check data types in comparisons",
            "is_recoverable": True
        }

    # Function errors
    if "function" in error_lower and "not found" in error_lower:
        return {
            "error_type": "function_not_found",
            "suggestion": "Use Athena-compatible functions",
            "is_recoverable": True
        }

    # Timeout or resource errors (not recoverable by fixing SQL)
    if "timeout" in error_lower or "resource" in error_lower:
        return {
            "error_type": "resource_error",
            "suggestion": "Query may be too complex or data too large",
            "is_recoverable": False
        }

    # Permission errors (not recoverable)
    if "access denied" in error_lower or "permission" in error_lower:
        return {
            "error_type": "permission_error",
            "suggestion": "Check IAM permissions",
            "is_recoverable": False
        }

    # Unknown error
    return {
        "error_type": "unknown",
        "suggestion": "Review the error message",
        "is_recoverable": True
    }

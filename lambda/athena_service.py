"""
Athena query execution service.
Executes SQL queries and polls for results.
"""

import os
import time
import boto3
from botocore.exceptions import ClientError

# Configuration
DATABASE = os.environ.get("ATHENA_DATABASE", "voice_chat_db")
OUTPUT_LOCATION = os.environ.get("ATHENA_OUTPUT_LOCATION", "")
MAX_POLL_ATTEMPTS = 60  # 60 seconds max wait
POLL_INTERVAL = 1  # 1 second between polls


class AthenaQueryError(Exception):
    """Custom exception for Athena query errors."""
    def __init__(self, message, query_id=None, state=None):
        super().__init__(message)
        self.query_id = query_id
        self.state = state


def get_athena_client():
    """Get Athena client."""
    return boto3.client("athena", region_name=os.environ.get("AWS_REGION", "us-west-2"))


def execute_query(sql: str, database: str = None) -> dict:
    """
    Execute an Athena SQL query and return results.

    Args:
        sql: The SQL query to execute
        database: Optional database name override

    Returns:
        dict with keys:
            - columns: List of column names
            - rows: List of row dicts
            - query_id: Athena query execution ID
            - execution_time_ms: Query execution time in milliseconds
    """
    athena = get_athena_client()
    db = database or DATABASE

    if not OUTPUT_LOCATION:
        raise AthenaQueryError("ATHENA_OUTPUT_LOCATION environment variable not set")

    # Start query execution
    try:
        response = athena.start_query_execution(
            QueryString=sql,
            QueryExecutionContext={"Database": db},
            ResultConfiguration={"OutputLocation": OUTPUT_LOCATION},
        )
        query_id = response["QueryExecutionId"]
    except ClientError as e:
        raise AthenaQueryError(f"Failed to start query: {e}")

    # Poll for completion
    state = None
    execution_time_ms = 0

    for attempt in range(MAX_POLL_ATTEMPTS):
        try:
            status = athena.get_query_execution(QueryExecutionId=query_id)
            state = status["QueryExecution"]["Status"]["State"]

            if state == "SUCCEEDED":
                stats = status["QueryExecution"].get("Statistics", {})
                execution_time_ms = stats.get("TotalExecutionTimeInMillis", 0)
                break
            elif state in ("FAILED", "CANCELLED"):
                reason = status["QueryExecution"]["Status"].get(
                    "StateChangeReason", "Unknown error"
                )
                raise AthenaQueryError(
                    f"Query {state}: {reason}",
                    query_id=query_id,
                    state=state
                )

            time.sleep(POLL_INTERVAL)

        except ClientError as e:
            raise AthenaQueryError(f"Failed to get query status: {e}", query_id=query_id)

    if state != "SUCCEEDED":
        raise AthenaQueryError(
            f"Query timed out after {MAX_POLL_ATTEMPTS} seconds",
            query_id=query_id,
            state=state
        )

    # Get results
    try:
        results = get_query_results(athena, query_id)
        results["query_id"] = query_id
        results["execution_time_ms"] = execution_time_ms
        return results
    except ClientError as e:
        raise AthenaQueryError(f"Failed to get query results: {e}", query_id=query_id)


def get_query_results(athena, query_id: str, max_rows: int = 1000) -> dict:
    """
    Fetch query results with pagination support.

    Args:
        athena: Boto3 Athena client
        query_id: Query execution ID
        max_rows: Maximum number of rows to return

    Returns:
        dict with columns and rows
    """
    columns = []
    rows = []
    next_token = None
    is_first_page = True

    while True:
        kwargs = {"QueryExecutionId": query_id, "MaxResults": min(max_rows, 1000)}
        if next_token:
            kwargs["NextToken"] = next_token

        response = athena.get_query_results(**kwargs)

        # Extract column names from first page
        if is_first_page:
            column_info = response["ResultSet"]["ResultSetMetadata"]["ColumnInfo"]
            columns = [col["Name"] for col in column_info]
            # Skip header row on first page
            result_rows = response["ResultSet"]["Rows"][1:]
            is_first_page = False
        else:
            result_rows = response["ResultSet"]["Rows"]

        # Convert rows to dicts
        for row in result_rows:
            row_data = {}
            for i, cell in enumerate(row.get("Data", [])):
                value = cell.get("VarCharValue")
                row_data[columns[i]] = value
            rows.append(row_data)

            if len(rows) >= max_rows:
                break

        # Check for more pages
        next_token = response.get("NextToken")
        if not next_token or len(rows) >= max_rows:
            break

    return {"columns": columns, "rows": rows}


def get_table_schema(table_name: str = "employees", database: str = None) -> dict:
    """
    Get schema information for a table.

    Returns:
        dict with column names and types
    """
    db = database or DATABASE
    sql = f"DESCRIBE {db}.{table_name}"

    try:
        result = execute_query(sql, database=db)
        schema = {}
        for row in result["rows"]:
            col_name = row.get("col_name", "")
            data_type = row.get("data_type", "")
            if col_name and not col_name.startswith("#"):
                schema[col_name] = data_type
        return schema
    except AthenaQueryError:
        # Return hardcoded schema as fallback
        return {
            "employee_id": "int",
            "first_name": "string",
            "last_name": "string",
            "email": "string",
            "department": "string",
            "job_title": "string",
            "salary": "int",
            "hire_date": "date",
            "city": "string",
            "state": "string",
            "latitude": "double",
            "longitude": "double",
            "status": "string",
        }

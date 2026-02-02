"""
Bedrock service for SQL generation and NL summary.
Uses Claude to convert natural language to SQL and generate summaries.
"""

import os
import json
import boto3
from botocore.exceptions import ClientError

# Configuration
MODEL_ID = os.environ.get("BEDROCK_MODEL_ID", "anthropic.claude-haiku-4-5-20251001-v1:0")
MAX_TOKENS = 2048

# Schema definition for the employees table
TABLE_SCHEMA = """
Table: voice_chat_db.employees
Columns:
  - employee_id (INT): Unique employee identifier
  - first_name (STRING): Employee's first name
  - last_name (STRING): Employee's last name
  - email (STRING): Employee's email address
  - department (STRING): Department name (Engineering, Product, Design, Marketing, Sales, HR, Finance, Operations)
  - job_title (STRING): Job title
  - salary (INT): Annual salary in USD
  - hire_date (DATE): Date employee was hired (format: YYYY-MM-DD)
  - city (STRING): City of employment (San Francisco, Los Angeles, Seattle, New York, Austin, Denver, Chicago, Boston, Miami, Portland)
  - state (STRING): State of employment (California, Washington, New York, Texas, Colorado, Illinois, Massachusetts, Florida, Oregon)
  - latitude (DOUBLE): Geographic latitude
  - longitude (DOUBLE): Geographic longitude
  - status (STRING): Employment status ('active' or 'inactive')
"""

SQL_GENERATION_PROMPT = """You are an expert SQL analyst. Generate Athena-compatible SQL for the user's question.

{schema}

RULES:
1. ALWAYS start with a SQL comment indicating visualization type:
   -- TABLE: For listing data, counts, or when no geographic/trend data
   -- MAP: ONLY when query returns latitude, longitude columns AND user asks about locations/geography
   -- CHART: For aggregations that show comparisons (GROUP BY with COUNT, AVG, SUM)

2. Use standard SQL compatible with AWS Athena (Presto)
3. Always qualify table: voice_chat_db.employees
4. For name searches, use LOWER() for case-insensitive matching
5. Limit results to 100 rows unless user specifies otherwise
6. For "show all" or "list" queries without filters, add LIMIT 100

{conversation_context}

User question: {question}

Respond with ONLY the SQL query (including the visualization comment). No explanations."""


def get_bedrock_client():
    """Get Bedrock Runtime client."""
    return boto3.client(
        "bedrock-runtime",
        region_name=os.environ.get("AWS_REGION", "us-west-2")
    )


def generate_sql(question: str, conversation_history: list = None) -> dict:
    """
    Generate SQL from natural language question.

    Args:
        question: The user's natural language question
        conversation_history: Optional list of previous exchanges

    Returns:
        dict with keys:
            - sql: The generated SQL query
            - visualization_type: TABLE, MAP, or CHART
    """
    bedrock = get_bedrock_client()

    # Format conversation context
    context = ""
    if conversation_history:
        context = "Previous conversation:\n"
        for exchange in conversation_history[-5:]:  # Last 5 exchanges
            context += f"User: {exchange.get('question', '')}\n"
            context += f"SQL: {exchange.get('sql', '')}\n"
        context += "\nUse this context to understand references like 'that', 'those', 'filter further', etc.\n"

    prompt = SQL_GENERATION_PROMPT.format(
        schema=TABLE_SCHEMA,
        conversation_context=context,
        question=question
    )

    try:
        response = bedrock.invoke_model(
            modelId=MODEL_ID,
            contentType="application/json",
            accept="application/json",
            body=json.dumps({
                "anthropic_version": "bedrock-2023-05-31",
                "max_tokens": MAX_TOKENS,
                "messages": [
                    {"role": "user", "content": prompt}
                ]
            })
        )

        response_body = json.loads(response["body"].read())
        sql = response_body["content"][0]["text"].strip()

        # Extract visualization type from SQL comment
        visualization_type = "TABLE"  # default
        if sql.startswith("-- MAP"):
            visualization_type = "MAP"
        elif sql.startswith("-- CHART"):
            visualization_type = "CHART"

        return {
            "sql": sql,
            "visualization_type": visualization_type
        }

    except ClientError as e:
        raise Exception(f"Bedrock API error: {e}")


def generate_summary(question: str, sql: str, results: dict, visualization_type: str) -> dict:
    """
    Generate natural language summary and follow-up suggestions.

    Args:
        question: Original user question
        sql: The executed SQL query
        results: Query results with columns and rows
        visualization_type: TABLE, MAP, or CHART

    Returns:
        dict with keys:
            - summary: Natural language summary (2-3 sentences)
            - follow_ups: List of 3 follow-up question suggestions
    """
    bedrock = get_bedrock_client()

    # Prepare results preview (first 10 rows)
    rows_preview = results.get("rows", [])[:10]
    total_rows = len(results.get("rows", []))

    prompt = f"""You are a helpful data analyst. Summarize the query results for the user.

User's question: {question}

SQL executed:
{sql}

Results preview (showing {len(rows_preview)} of {total_rows} rows):
{json.dumps(rows_preview, indent=2)}

Visualization type: {visualization_type}

Provide:
1. A 2-3 sentence summary that:
   - Directly answers the user's question
   - Includes specific numbers/counts from the data
   - Highlights any notable patterns

2. Three diverse follow-up questions the user might ask next. Make them:
   - Build on the current results
   - Explore different dimensions (filter, aggregate, compare)
   - Be natural and conversational

Respond in this exact JSON format:
{{
    "summary": "Your summary here...",
    "follow_ups": [
        "First follow-up question?",
        "Second follow-up question?",
        "Third follow-up question?"
    ]
}}"""

    try:
        response = bedrock.invoke_model(
            modelId=MODEL_ID,
            contentType="application/json",
            accept="application/json",
            body=json.dumps({
                "anthropic_version": "bedrock-2023-05-31",
                "max_tokens": MAX_TOKENS,
                "messages": [
                    {"role": "user", "content": prompt}
                ]
            })
        )

        response_body = json.loads(response["body"].read())
        content = response_body["content"][0]["text"].strip()

        # Parse JSON response
        try:
            result = json.loads(content)
            return {
                "summary": result.get("summary", "Query completed successfully."),
                "follow_ups": result.get("follow_ups", [])
            }
        except json.JSONDecodeError:
            # If JSON parsing fails, extract text as summary
            return {
                "summary": content[:500],
                "follow_ups": []
            }

    except ClientError as e:
        return {
            "summary": f"Query returned {total_rows} results.",
            "follow_ups": []
        }


def fix_failed_query(original_sql: str, error_message: str, question: str) -> str:
    """
    Attempt to fix a failed SQL query based on error message.

    Args:
        original_sql: The SQL that failed
        error_message: The error message from Athena
        question: The original user question

    Returns:
        Corrected SQL query
    """
    bedrock = get_bedrock_client()

    prompt = f"""You are an expert SQL analyst. The following SQL query failed. Fix it.

{TABLE_SCHEMA}

Original question: {question}

Failed SQL:
{original_sql}

Error message:
{error_message}

Common fixes:
- Column name typos
- Missing table qualification (use voice_chat_db.employees)
- String literals need single quotes
- Date comparisons use 'YYYY-MM-DD' format
- LIKE patterns need % wildcards

Respond with ONLY the corrected SQL query (including visualization comment). No explanations."""

    try:
        response = bedrock.invoke_model(
            modelId=MODEL_ID,
            contentType="application/json",
            accept="application/json",
            body=json.dumps({
                "anthropic_version": "bedrock-2023-05-31",
                "max_tokens": MAX_TOKENS,
                "messages": [
                    {"role": "user", "content": prompt}
                ]
            })
        )

        response_body = json.loads(response["body"].read())
        return response_body["content"][0]["text"].strip()

    except ClientError as e:
        raise Exception(f"Bedrock API error during query fix: {e}")

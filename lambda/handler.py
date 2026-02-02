"""
Lambda handler for VoxQuery.
Routes requests to appropriate services.
"""

import json
import os
import traceback

from athena_service import execute_query, AthenaQueryError
from bedrock_service import generate_sql, generate_summary, fix_failed_query
from response_classifier import classify_response, get_chart_config, get_map_config, get_surface_config

# Response headers (CORS handled by Lambda Function URL config)
RESPONSE_HEADERS = {
    "Content-Type": "application/json"
}

# Maximum self-heal retry attempts
MAX_RETRY_ATTEMPTS = 2


def handler(event, context):
    """Main Lambda handler."""
    # Handle CORS preflight
    if event.get("requestContext", {}).get("http", {}).get("method") == "OPTIONS":
        return {
            "statusCode": 200,
            "headers": RESPONSE_HEADERS,
            "body": ""
        }

    try:
        # Parse request
        path = event.get("rawPath", "/")
        method = event.get("requestContext", {}).get("http", {}).get("method", "GET")

        # Parse body
        body = {}
        if event.get("body"):
            try:
                body = json.loads(event["body"])
            except json.JSONDecodeError:
                return error_response(400, "Invalid JSON body")

        # Route request
        if path == "/query" and method == "POST":
            return handle_text_query(body)
        elif path == "/voice-query" and method == "POST":
            return handle_voice_query(body)
        elif path == "/health" and method == "GET":
            return success_response({"status": "healthy"})
        elif path == "/schema" and method == "GET":
            return handle_schema_request()
        else:
            return error_response(404, f"Not found: {method} {path}")

    except Exception as e:
        traceback.print_exc()
        return error_response(500, str(e))


def handle_text_query(body: dict) -> dict:
    """
    Handle text-based query request.

    Expected body:
    {
        "question": "Show me all employees in Engineering",
        "conversation_history": [...] // optional
    }
    """
    question = body.get("question", "").strip()
    if not question:
        return error_response(400, "Missing 'question' field")

    conversation_history = body.get("conversation_history", [])

    try:
        # Generate SQL from question
        sql_result = generate_sql(question, conversation_history)
        sql = sql_result["sql"]
        visualization_type = sql_result["visualization_type"]

        # Execute query with self-healing
        results = None
        attempts = 0
        last_error = None

        while attempts <= MAX_RETRY_ATTEMPTS:
            try:
                results = execute_query(sql)
                break
            except AthenaQueryError as e:
                last_error = str(e)
                attempts += 1

                if attempts <= MAX_RETRY_ATTEMPTS:
                    # Try to fix the query
                    sql = fix_failed_query(sql, last_error, question)
                    # Re-classify after fix
                    visualization_type = classify_response(
                        sql,
                        columns=None,
                        rows=None
                    )

        if results is None:
            return error_response(400, f"Query failed after {attempts} attempts: {last_error}")

        # Re-classify based on actual results
        visualization_type = classify_response(
            sql,
            columns=results.get("columns", []),
            rows=results.get("rows", [])
        )

        # Generate NL summary
        summary_result = generate_summary(
            question=question,
            sql=sql,
            results=results,
            visualization_type=visualization_type
        )

        # Build response
        response_data = {
            "success": True,
            "question": question,
            "sql": sql,
            "visualization_type": visualization_type,
            "columns": results.get("columns", []),
            "rows": results.get("rows", []),
            "row_count": len(results.get("rows", [])),
            "execution_time_ms": results.get("execution_time_ms", 0),
            "summary": summary_result.get("summary", ""),
            "follow_ups": summary_result.get("follow_ups", []),
            "attempts": attempts + 1
        }

        # Add visualization config
        if visualization_type == "CHART":
            response_data["chart_config"] = get_chart_config(
                results.get("columns", []),
                results.get("rows", [])
            )
        elif visualization_type == "MAP":
            response_data["map_config"] = get_map_config(results.get("columns", []))
        elif visualization_type == "SURFACE":
            response_data["surface_config"] = get_surface_config(
                results.get("columns", []),
                results.get("rows", [])
            )

        return success_response(response_data)

    except Exception as e:
        traceback.print_exc()
        return error_response(500, f"Query processing failed: {str(e)}")


def handle_voice_query(body: dict) -> dict:
    """
    Handle voice-based query request.
    Transcribes audio then processes as text query.

    Expected body:
    {
        "audio_data": "base64-encoded-audio",
        "audio_format": "audio/webm" // optional, defaults to webm
        "conversation_history": [...] // optional
    }
    """
    # Import here to avoid circular dependency
    from transcribe_service import transcribe_audio

    audio_data = body.get("audio_data", "")
    if not audio_data:
        return error_response(400, "Missing 'audio_data' field")

    audio_format = body.get("audio_format", "audio/webm")
    conversation_history = body.get("conversation_history", [])

    try:
        # Transcribe audio
        transcript = transcribe_audio(audio_data, audio_format)

        if not transcript:
            return error_response(400, "Could not transcribe audio")

        # Process as text query
        result = handle_text_query({
            "question": transcript,
            "conversation_history": conversation_history
        })

        # Add transcript to response
        if result["statusCode"] == 200:
            response_body = json.loads(result["body"])
            response_body["transcript"] = transcript
            result["body"] = json.dumps(response_body)

        return result

    except Exception as e:
        traceback.print_exc()
        return error_response(500, f"Voice query processing failed: {str(e)}")


def handle_schema_request() -> dict:
    """Return table schema for frontend autocomplete."""
    from athena_service import get_table_schema

    try:
        schema = get_table_schema()
        return success_response({
            "table": "voice_chat_db.employees",
            "columns": schema
        })
    except Exception as e:
        return error_response(500, f"Failed to get schema: {str(e)}")


def success_response(data: dict) -> dict:
    """Build success response."""
    return {
        "statusCode": 200,
        "headers": RESPONSE_HEADERS,
        "body": json.dumps(data)
    }


def error_response(status_code: int, message: str) -> dict:
    """Build error response."""
    return {
        "statusCode": status_code,
        "headers": RESPONSE_HEADERS,
        "body": json.dumps({
            "success": False,
            "error": message
        })
    }

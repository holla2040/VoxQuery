# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Run Commands

### Infrastructure Deployment
```bash
cd infrastructure
./deploy.sh              # Deploy Lambda via SAM
./setup-aws.sh           # Create Athena table and upload data
```

### Frontend Development
```bash
cd frontend/athena-voice-chat
npm install
export REACT_APP_API_URL=https://your-lambda-url.lambda-url.us-west-2.on.aws/
npm start                # Dev server at localhost:3000
npm run build            # Production build for /voxquery/ subdirectory
```

### Production Deployment (EC2/Apache)
```bash
# Build and deploy to server
cd frontend/athena-voice-chat
npm run build
rsync -avz frontend/athena-voice-chat/build/* o:/home/holla/hollabaugh/voxquery/
```

### Testing
```bash
# Health check
curl ${FUNCTION_URL}health

# Text query
curl -X POST ${FUNCTION_URL}query \
  -H "Content-Type: application/json" \
  -d '{"question": "Show me all employees in Engineering"}'

# View Lambda logs
aws logs tail /aws/lambda/voxquery-handler --follow
```

## Architecture

VoxQuery is a voice-enabled natural language to SQL application:

```
React Frontend ──► Lambda Function URL ──► Athena (SQL)
                         │
                   ┌─────┴─────┐
                   ▼           ▼
              Bedrock      Transcribe
              (SQL Gen)    (Voice)
```

### Request Flow
1. User submits text/voice query via React frontend
2. Lambda receives request at `/query` or `/voice-query`
3. Voice queries: Transcribe converts audio to text first
4. `bedrock_service.generate_sql()` converts NL to SQL with visualization hint (`-- TABLE/MAP/CHART`)
5. `athena_service.execute_query()` runs SQL, polls for results
6. On failure: `query_self_heal` retries with Bedrock-corrected SQL (up to 2 attempts)
7. `response_classifier` determines final visualization type from SQL comment + actual columns
8. `bedrock_service.generate_summary()` creates NL summary and follow-up suggestions
9. Frontend renders result as table (default), map (Leaflet), or chart (Plotly)

### Conversation Context
- Frontend tracks last 5 exchanges in `conversationHistory` state
- Sent with each request to enable follow-ups like "now filter to California"
- Backend formats history into Bedrock prompt via `conversation_context.py`

## Key Patterns

### Visualization Detection
SQL must start with a comment: `-- TABLE`, `-- MAP`, or `-- CHART`. The `response_classifier` validates against actual result columns (e.g., MAP requires lat/lon columns).

### Lambda Response Format
All responses include CORS headers and follow this structure:
```json
{
  "success": true,
  "visualization_type": "TABLE|MAP|CHART",
  "columns": [...],
  "rows": [...],
  "summary": "NL description",
  "follow_ups": ["suggested question 1", ...]
}
```

### Frontend State
`App.jsx` manages: `messages` (chat history), `conversationHistory` (for API), `result` (current query result), `loading`, `error`. ResultsPanel conditionally renders MapResult or ChartResult based on `visualization_type`.

## Environment Variables

Lambda:
- `ATHENA_DATABASE`: Database name (default: voice_chat_db)
- `ATHENA_OUTPUT_LOCATION`: S3 path for results
- `AUDIO_BUCKET`: S3 bucket for voice uploads
- `BEDROCK_MODEL_ID`: Model for SQL generation (default: anthropic.claude-haiku-4-5-20251001-v1:0)

Frontend:
- `REACT_APP_API_URL`: Lambda Function URL

## Important Notes

- **CORS**: Handled entirely by Lambda Function URL config, not in Lambda code. Do not add CORS headers in handler.py.
- **Model Activation**: First-time Bedrock users must activate Claude Haiku 4.5 via AWS Console → Bedrock → Playgrounds → Chat before Lambda can use it.
- **AWS_REGION**: Do not set in Lambda environment variables - it's reserved and auto-set by Lambda.
- **Voice Input**: Requires HTTPS or localhost. Frontend auto-detects browser audio format (WebM, Ogg, MP4, WAV) and sends format to backend for Transcribe.
- **Browser Compatibility**: Chrome/Firefox work best. Brave requires allowing microphone in Shields settings.

## Setup Guide

See [SETUP_GUIDE.md](SETUP_GUIDE.md) for complete deployment instructions and troubleshooting.

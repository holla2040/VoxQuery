# VoxQuery

Voice-enabled Athena chat application with text/voice input, SQL generation via Bedrock Claude, and results rendered as tables, maps, or charts.

## Architecture

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────┐
│   React     │────▶│  Lambda Function │────▶│   Athena    │
│   Frontend  │◀────│  (Function URL)  │◀────│   (Presto)  │
└─────────────┘     └──────────────────┘     └─────────────┘
                            │
                    ┌───────┴───────┐
                    ▼               ▼
             ┌──────────┐    ┌────────────┐
             │  Bedrock │    │ Transcribe │
             │  Claude  │    │  (Voice)   │
             └──────────┘    └────────────┘
```

## Prerequisites

- AWS CLI configured with appropriate credentials
- SAM CLI installed (`pip install aws-sam-cli`)
- Node.js 18+ and npm
- Python 3.10+

> **Note:** For detailed setup instructions and troubleshooting, see [SETUP_GUIDE.md](SETUP_GUIDE.md).

## Quick Start

### 1. Deploy Infrastructure

```bash
cd infrastructure

# Deploy Lambda and S3 bucket
./deploy.sh

# Set up Athena database and sample data
./setup-aws.sh
```

### 2. Start Frontend

```bash
cd frontend/athena-voice-chat

# Install dependencies
npm install

# Set API URL (from deploy output)
export REACT_APP_API_URL=https://your-lambda-url.lambda-url.us-west-2.on.aws/

# Start development server
npm start
```

### 3. Access Application

Open http://localhost:3000 in your browser.

## Features

- **Text Input**: Natural language queries about employee data
- **Voice Input**: Push-to-talk voice queries (auto-detects browser audio format)
- **Smart Visualizations**:
  - Tables for list data
  - Maps for geographic data (Leaflet)
  - Charts for aggregations (Plotly)
- **Conversation Context**: Follow-up queries understand previous context
- **Self-Healing Queries**: Automatic retry with corrected SQL
- **NL Summaries**: AI-generated explanations of results
- **Mobile Responsive**: Bottom navigation, optimized touch targets

## Sample Queries

| Query | Visualization |
|-------|---------------|
| "Show me all employees" | Table |
| "Show all employees on a map" | Map |
| "Average salary by department" | Chart |
| "Who are the top 10 earners?" | Table |
| "Now filter to California" | Table (contextual) |

## Project Structure

```
VoxQuery/
├── data/
│   └── generate_employees.py      # Mock data generator
├── infrastructure/
│   ├── template.yaml              # SAM template
│   ├── athena-setup.sql           # DDL for Athena
│   ├── setup-aws.sh               # Data setup script
│   └── deploy.sh                  # Deployment script
├── lambda/
│   ├── handler.py                 # Lambda entry point
│   ├── athena_service.py          # Query execution
│   ├── bedrock_service.py         # SQL generation + summaries
│   ├── transcribe_service.py      # Voice transcription
│   ├── query_self_heal.py         # Retry logic
│   ├── conversation_context.py    # History management
│   ├── response_classifier.py     # Visualization detection
│   └── requirements.txt
└── frontend/athena-voice-chat/
    ├── src/
    │   ├── App.jsx                # Main layout
    │   ├── App.css                # Dark theme
    │   ├── config.js              # Configuration
    │   ├── components/            # React components
    │   ├── hooks/                 # Custom hooks
    │   └── services/api.js        # API client
    └── package.json
```

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `ATHENA_DATABASE` | voice_chat_db | Athena database name |
| `ATHENA_OUTPUT_LOCATION` | - | S3 path for query results |
| `AUDIO_BUCKET` | - | S3 bucket for voice audio |
| `BEDROCK_MODEL_ID` | anthropic.claude-haiku-4-5-20251001-v1:0 | Claude Haiku 4.5 |
| `AWS_REGION` | us-west-2 | AWS region |

### Frontend Config

Edit `frontend/athena-voice-chat/src/config.js`:

```javascript
export const API_BASE_URL = 'https://your-lambda-url/';
```

## Testing

### Local Testing

1. **Health Check**:
   ```bash
   curl ${FUNCTION_URL}health
   ```

2. **Text Query**:
   ```bash
   curl -X POST ${FUNCTION_URL}query \
     -H "Content-Type: application/json" \
     -d '{"question": "Show me all employees in Engineering"}'
   ```

### Test Scenarios

#### Basic Queries
- [ ] "Show me all employees" → Table
- [ ] "How many employees in each department?" → Chart
- [ ] "Show all employees on a map" → Map

#### Conversation Context
- [ ] "Show me all engineers"
- [ ] "Now just the ones in California" (builds on previous)
- [ ] "Sort by salary descending" (builds on previous)

#### Self-Healing
- [ ] Ambiguous query that might generate invalid SQL
- [ ] Verify retry count in response

#### Voice Input
- [ ] Record and submit voice query
- [ ] Verify transcript appears and is editable

#### Mobile
- [ ] Test on iPhone viewport (Chrome DevTools)
- [ ] Verify tab navigation works
- [ ] Test PTT button (64px target)

## Troubleshooting

### Common Issues

1. **Athena query timeout**: Check S3 data location and table DDL
2. **Bedrock access denied**: Ensure model access is enabled in AWS console
3. **Voice not working**: Check browser microphone permissions
4. **CORS errors**: Verify Lambda Function URL CORS settings

### Logs

```bash
# View Lambda logs
aws logs tail /aws/lambda/voxquery-handler --follow
```

## Cost Considerations

- **Athena**: Charged per TB scanned ($5/TB)
- **Bedrock Claude**: ~$0.003 per 1K input tokens
- **Transcribe**: $0.024 per minute
- **Lambda**: Free tier covers most development usage

## Production Deployment

### Deploy to EC2/Apache

1. **Build the frontend:**
   ```bash
   cd frontend/athena-voice-chat
   npm run build
   ```

2. **Copy to server:**
   ```bash
   scp -r build/* user@your-server.com:/var/www/html/voxquery/
   ```

3. **Apache configuration** (for SPA routing):
   ```apache
   <Directory /var/www/html/voxquery>
       RewriteEngine On
       RewriteBase /voxquery/
       RewriteRule ^index\.html$ - [L]
       RewriteCond %{REQUEST_FILENAME} !-f
       RewriteCond %{REQUEST_FILENAME} !-d
       RewriteRule . /voxquery/index.html [L]
   </Directory>
   ```

> **Note:** HTTPS is required for voice input (microphone access).

## Browser Compatibility

| Browser | Voice Support | Notes |
|---------|--------------|-------|
| Chrome | Full | Recommended |
| Firefox | Full | |
| Brave | Requires setup | Allow mic in Shields settings |
| Safari | Full | |
| Edge | Full | |

**Voice requirements:**
- HTTPS or localhost (secure context)
- Microphone permission granted
- Supported audio formats: WebM, Ogg, MP4, WAV

## Security Notes

- Lambda Function URL has no authentication (AuthType: NONE)
- For production, consider adding API Gateway with authentication
- Audio files are automatically deleted after 1 day
- Athena results are deleted after 7 days

## License

MIT

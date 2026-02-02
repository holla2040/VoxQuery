# Voice-Enabled Athena Chat Application — Development Plan

## Overview

Build a full-stack web application that lets users query an AWS Athena database using either text or voice (push-to-talk). The system transcribes voice input via Amazon Transcribe, generates SQL via Amazon Bedrock (Claude), executes it on Athena, and renders results as tables, maps, or charts depending on the query context. The app supports conversational follow-ups, natural language result summaries, smart query suggestions, and is fully responsive across desktop and mobile.

---

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                   Frontend (React + Responsive)               │
│  ┌───────────┐  ┌───────────┐  ┌──────────────────────────┐ │
│  │ Chat Input │  │ PTT Button│  │    Results Panel          │ │
│  │ (text +    │  │ (voice)   │  │ Table / Map / Chart       │ │
│  │ typeahead) │  │           │  │ + NL Summary              │ │
│  └─────┬─────┘  └─────┬─────┘  │ + Follow-up Suggestions   │ │
│  ┌─────┴───────────────┘        └────────────▲──────────────┘ │
│  │  Canned Query Tiles / Favorites Bar       │               │
│  └───────────────────────────────────────────┘               │
└──────────────────────────┬───────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│                Lambda Function URL (CORS enabled)             │
│                                                               │
│  1. (voice only) Upload audio to S3                           │
│  2. (voice only) Call Amazon Transcribe                       │
│  3. Build Bedrock prompt with conversation history context     │
│  4. Send to Bedrock (Claude) → Generate SQL                   │
│  5. Execute SQL on Athena                                     │
│  6. If Athena error → auto-retry: send error back to Bedrock  │
│  7. Send results back to Bedrock → NL summary + follow-ups    │
│  8. Classify result type (table/map/chart)                    │
│  9. Return structured response to frontend                    │
└──────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Mock Data & Athena Setup

### 1.1 Generate Mock Dataset

Create a CSV file `employees.csv` with **200 rows** and the following columns:

| Column            | Type    | Description                          | Example Values                                                     |
| ----------------- | ------- | ------------------------------------ | ------------------------------------------------------------------ |
| `employee_id`     | INT     | Unique identifier                    | 1, 2, 3...                                                        |
| `first_name`      | STRING  | First name                           | Alice, Bob, Carlos                                                 |
| `last_name`       | STRING  | Last name                            | Smith, Johnson, Williams                                           |
| `age`             | INT     | Age in years                         | 22–65                                                              |
| `gender`          | STRING  | Gender                               | Male, Female, Non-binary                                           |
| `latitude`        | DOUBLE  | Latitude of home/office location     | Spread across US (25.0–48.0)                                       |
| `longitude`       | DOUBLE  | Longitude of home/office location    | Spread across US (-125.0 to -70.0)                                 |
| `city`            | STRING  | City name matching lat/lon           | New York, San Francisco, Chicago, Austin, Denver, Seattle, Miami   |
| `state`           | STRING  | US state                             | NY, CA, IL, TX, CO, WA, FL                                        |
| `profession`      | STRING  | Job title/role                       | Engineer, Designer, Manager, Analyst, Sales Rep, HR Specialist     |
| `department`      | STRING  | Department                           | Engineering, Design, Sales, HR, Finance, Marketing                 |
| `salary`          | INT     | Annual salary in USD                 | 45000–220000                                                       |
| `evaluation_score`| DOUBLE  | Last performance evaluation (1–5)    | 1.0–5.0 (one decimal)                                              |
| `years_at_company`| INT     | Tenure in years                      | 0–25                                                               |
| `hire_date`       | STRING  | Date hired (YYYY-MM-DD)             | 2000-01-15 through 2025-01-01                                      |

**Requirements:**
- Use Python `faker` + `random` to generate realistic data.
- Cluster lat/lon around ~10 real US cities so map results look realistic.
- Ensure salary correlates loosely with years_at_company and profession.
- Include enough variety in professions and departments for interesting queries.

### 1.2 Upload to S3

- Create S3 bucket: `athena-voice-chat-data-{account_id}` (or parameterized name).
- Upload `employees.csv` to `s3://{bucket}/data/employees/employees.csv`.

### 1.3 Create Athena Table

Create Glue database `voice_chat_db` and table `employees`:

```sql
CREATE EXTERNAL TABLE voice_chat_db.employees (
  employee_id INT,
  first_name STRING,
  last_name STRING,
  age INT,
  gender STRING,
  latitude DOUBLE,
  longitude DOUBLE,
  city STRING,
  state STRING,
  profession STRING,
  department STRING,
  salary INT,
  evaluation_score DOUBLE,
  years_at_company INT,
  hire_date STRING
)
ROW FORMAT DELIMITED
FIELDS TERMINATED BY ','
STORED AS TEXTFILE
LOCATION 's3://{bucket}/data/employees/'
TBLPROPERTIES ('skip.header.line.count'='1');
```

### 1.4 Athena Query Results Bucket

- Create or designate `s3://{bucket}/athena-results/` for Athena query output.

---

## Phase 2: Lambda Backend

### 2.1 Lambda Function: `athena-voice-chat-handler`

**Runtime:** Python 3.12  
**Timeout:** 120 seconds  
**Memory:** 512 MB  

**IAM Role Permissions:**
- `s3:PutObject`, `s3:GetObject` on the data bucket
- `transcribe:StartTranscriptionJob`, `transcribe:GetTranscriptionJob`
- `bedrock:InvokeModel` (for Claude model)
- `athena:StartQueryExecution`, `athena:GetQueryExecution`, `athena:GetQueryResults`
- `glue:GetTable`, `glue:GetDatabase`
- CloudWatch Logs

### 2.2 Lambda Handler Structure

```
lambda/
├── handler.py              # Main entry point with route dispatch
├── transcribe_service.py   # Audio → text via Amazon Transcribe
├── bedrock_service.py      # Text → SQL via Bedrock Claude (+ NL summary + follow-ups)
├── athena_service.py       # SQL → results via Athena
├── response_classifier.py  # Determine result type (table/map/chart)
├── conversation_context.py # Manages conversation history for follow-ups
├── query_self_heal.py      # Retry failed queries by sending error back to Bedrock
└── requirements.txt        # boto3 (bundled), urllib3
```

### 2.3 Route: POST /query

**Input:**
```json
{
  "message": "Show me all engineers in California with salary over 150000",
  "conversation_history": [
    {
      "role": "user",
      "content": "Show me all engineers"
    },
    {
      "role": "assistant",
      "sql": "SELECT * FROM voice_chat_db.employees WHERE profession = 'Engineer' LIMIT 500",
      "summary": "Found 34 engineers across all locations."
    }
  ]
}
```

**Processing:**
1. Build Bedrock prompt including conversation history for follow-up context.
2. Send to Bedrock service for SQL generation.
3. Execute SQL on Athena.
4. **If Athena returns an error → self-heal:** send the SQL + error message back to Bedrock with instructions to fix, retry up to 2 times.
5. Classify result type.
6. **Send results back to Bedrock for NL summary and follow-up suggestions.**
7. Return structured response.

### 2.4 Route: POST /voice-query

**Input:** Base64-encoded audio blob in JSON body.
```json
{
  "audio": "<base64-encoded-webm>",
  "format": "webm",
  "conversation_history": []
}
```

**Processing:**
1. Decode base64 audio, upload to S3 (`s3://{bucket}/audio/{uuid}.webm`).
2. Start Transcribe job, poll until complete (expect 2–8 seconds for short clips).
3. Extract transcript text.
4. Continue with same flow as `/query` (steps 1–7 above).

### 2.5 Bedrock SQL Generation

**Model:** `anthropic.claude-3-sonnet-20240229-v1:0` (or latest available Claude on Bedrock)

**System Prompt for Bedrock — SQL Generation (critical — include in code):**

```
You are a SQL query generator for Amazon Athena. You translate natural language questions into valid Athena SQL queries.

The database is `voice_chat_db` with one table: `employees`.

Schema:
- employee_id (INT): unique identifier
- first_name (STRING): employee first name
- last_name (STRING): employee last name
- age (INT): age in years
- gender (STRING): Male, Female, or Non-binary
- latitude (DOUBLE): location latitude
- longitude (DOUBLE): location longitude
- city (STRING): city name
- state (STRING): US state abbreviation
- profession (STRING): job title — one of: Engineer, Designer, Manager, Analyst, Sales Rep, HR Specialist, Data Scientist, Product Manager, DevOps Engineer, Marketing Specialist
- department (STRING): department — one of: Engineering, Design, Sales, HR, Finance, Marketing
- salary (INT): annual salary in USD
- evaluation_score (DOUBLE): performance score 1.0–5.0
- years_at_company (INT): years of tenure
- hire_date (STRING): hire date in YYYY-MM-DD format

Rules:
1. Return ONLY the SQL query, no explanation, no markdown, no backticks.
2. Always use fully qualified table name: voice_chat_db.employees
3. When location/city/state is part of the query, ALWAYS include latitude and longitude in the SELECT.
4. For aggregation queries that could be visualized as a line or bar chart (trends over time, distributions, grouped comparisons), add an "-- CHART" comment at the end of the SQL.
5. For queries that involve location/geography/maps, add an "-- MAP" comment at the end.
6. For all other queries, add an "-- TABLE" comment at the end.
7. Limit results to 500 rows max unless the user specifies otherwise.
8. Use standard Athena/Presto SQL syntax.
9. If the user's message is a follow-up (e.g., "now filter that to California", "sort those by salary", "just the women"), use the conversation history to understand what "that/those/it" refers to and modify the previous SQL accordingly.
10. If the user's message is ambiguous, make your best interpretation rather than failing.
```

**Conversation history is included in the user message for follow-up context:**
```
Previous conversation:
- User: "Show me all engineers"
- SQL: SELECT * FROM voice_chat_db.employees WHERE profession = 'Engineer' LIMIT 500
- User: "now just the ones in California"

Generate the SQL for the latest user message.
```

### 2.6 Bedrock Query Self-Healing

When Athena returns a query error, automatically retry:

```
The following SQL query failed on Amazon Athena:

SQL: {failed_sql}
Error: {athena_error_message}

Fix the SQL query so it runs successfully. Return ONLY the corrected SQL, no explanation.
```

- Retry up to **2 times**. If still failing after 2 retries, return the error to the user.
- Log each attempt for debugging.

### 2.7 Bedrock NL Summary & Follow-Up Suggestions

After a successful query, make a **second Bedrock call** to generate a natural language summary and follow-up suggestions.

**System Prompt for NL Summary:**

```
You are a data analyst assistant. Given a SQL query and its results, provide:
1. A concise natural language summary of the results (2-3 sentences max). Include key numbers, averages, min/max, or notable patterns. Be specific with data, not vague.
2. Exactly 3 follow-up questions the user might want to ask next, based on the current results and query context. Make them diverse — one drill-down, one comparison, one different angle.

Respond in this exact JSON format:
{
  "summary": "...",
  "follow_ups": ["question 1", "question 2", "question 3"]
}
```

**User message:**
```
SQL: {executed_sql}
Column names: {columns}
Row count: {row_count}
First 10 rows: {sample_rows_json}
```

- Keep the sample to first 10 rows to limit token usage.
- Parse the JSON response. If parsing fails, return a generic summary.

### 2.8 Athena Query Execution

1. Call `athena.start_query_execution()` with the generated SQL.
2. Poll `athena.get_query_execution()` until state is `SUCCEEDED` or `FAILED`.
3. On failure → trigger self-heal (Section 2.6).
4. On success, call `athena.get_query_results()` to retrieve rows.
5. Format results as list of dicts with column headers.

### 2.9 Response Classifier & Response Format

Parse the `-- MAP`, `-- CHART`, or `-- TABLE` comment from the generated SQL.

**Response JSON structure:**

```json
{
  "transcript": "Show me all engineers in California",
  "sql": "SELECT first_name, last_name, ... FROM voice_chat_db.employees WHERE ...",
  "result_type": "table | map | chart",
  "columns": ["first_name", "last_name", "salary"],
  "rows": [
    {"first_name": "Alice", "last_name": "Smith", "salary": 155000}
  ],
  "chart_config": {
    "x_column": "department",
    "y_column": "avg_salary",
    "chart_type": "bar | line",
    "title": "Average Salary by Department"
  },
  "summary": "Found 23 engineers in California with an average salary of $162,000. The highest paid is Maria Chen at $215,000 in San Francisco.",
  "follow_ups": [
    "How does this compare to engineers in New York?",
    "What are their average evaluation scores?",
    "Show me these engineers on a map"
  ],
  "self_heal_attempts": 0,
  "error": null
}
```

- `chart_config` is only present when `result_type` is `chart`.
- When `result_type` is `map`, the `rows` must contain `latitude` and `longitude` fields.
- `summary` is always present on success.
- `follow_ups` is always an array of 3 strings on success.
- `self_heal_attempts` tracks how many retries were needed (0 = first attempt succeeded).

### 2.10 Error Handling

- If Transcribe fails → return `{"error": "Could not transcribe audio. Please try again or type your query."}`
- If Bedrock generates invalid SQL and self-heal exhausts retries → return error with the attempted SQL and Athena error for debugging.
- If Athena query fails after retries → return `{"error": "Query failed after retries", "sql": "...", "athena_error": "..."}`.
- Always return the transcript (for voice) and generated SQL in the response for transparency.

---

## Phase 3: API Gateway / Lambda Function URL

### 3.1 Lambda Function URL Setup

**⚠️ CRITICAL:** API Gateway REST and HTTP APIs have a **29–30 second timeout**. Since Transcribe + Bedrock (×2 calls) + Athena can exceed this, we use **Lambda Function URLs** which support up to 15 minutes.

- Configure Function URL with `AUTH_TYPE=NONE` (for dev) or `AWS_IAM` (for prod).
- Enable CORS in Function URL config:
  - `AllowOrigins`: `["*"]` for dev, specific domain for prod.
  - `AllowMethods`: `["POST"]`
  - `AllowHeaders`: `["Content-Type"]`

### 3.2 Route Dispatch

Since Lambda Function URLs expose a single endpoint, use a `route` field in the JSON body to dispatch:

```python
def lambda_handler(event, context):
    body = json.loads(event['body'])
    route = body.get('route')
    
    if route == 'query':
        return handle_text_query(body)
    elif route == 'voice-query':
        return handle_voice_query(body)
    else:
        return {'statusCode': 400, 'body': json.dumps({'error': 'Unknown route'})}
```

---

## Phase 4: Frontend (React)

### 4.1 Project Setup

```
npx create-react-app athena-voice-chat
cd athena-voice-chat
npm install plotly.js react-plotly.js leaflet react-leaflet
```

### 4.2 File Structure

```
src/
├── App.jsx                    # Main layout with responsive shell
├── App.css                    # Global styles + responsive breakpoints
├── config.js                  # API endpoint URL
├── components/
│   ├── ChatPanel.jsx          # Chat history display
│   ├── ChatInput.jsx          # Text input + PTT button + typeahead
│   ├── PTTButton.jsx          # Push-to-talk button with recording logic
│   ├── ResultsPanel.jsx       # Routes result to correct renderer
│   ├── TableResult.jsx        # Renders query results as HTML table
│   ├── MapResult.jsx          # Renders map with pinned locations
│   ├── ChartResult.jsx        # Renders Plotly chart
│   ├── NLSummary.jsx          # Displays natural language summary
│   ├── FollowUpChips.jsx      # Clickable follow-up suggestion chips
│   ├── CannedQueries.jsx      # Quick-access preset query tiles
│   ├── FavoritesBar.jsx       # Saved/bookmarked queries
│   ├── Typeahead.jsx          # Schema-aware autocomplete dropdown
│   ├── SQLDisplay.jsx         # Shows generated SQL (collapsible)
│   ├── TranscriptBanner.jsx   # Shows voice transcript with edit option
│   ├── MobileNav.jsx          # Bottom tab navigation for mobile
│   └── LoadingSpinner.jsx     # Loading indicator
├── hooks/
│   ├── useAudioRecorder.js    # Custom hook for MediaRecorder logic
│   ├── useConversationHistory.js # Manages conversation context state
│   └── useFavorites.js        # Manages favorites in localStorage
└── services/
    └── api.js                 # API call functions
```

### 4.3 Layout Design — Desktop (≥1024px)

```
┌──────────────────────────────────────────────────────────────────────┐
│  🎙️ Athena Voice Chat                              ⭐ Favorites ▾  │
├────────────────────────────────┬─────────────────────────────────────┤
│                                │                                     │
│   Canned Query Tiles           │   NL Summary                        │
│  ┌──────┐ ┌──────┐ ┌──────┐   │  ┌─────────────────────────────┐    │
│  │Top 10│ │By    │ │Salary│   │  │ "Found 23 engineers in CA   │    │
│  │Earner│ │Dept  │ │Map   │   │  │  with avg salary $162K..."  │    │
│  └──────┘ └──────┘ └──────┘   │  └─────────────────────────────┘    │
│                                │                                     │
│   Chat History                 │   Results Panel                     │
│   ┌──────────────────────┐     │   ┌─────────────────────────────┐   │
│   │ 👤 Show me all       │     │   │                             │   │
│   │    engineers in CA    │     │   │   Table / Map / Chart       │   │
│   ├──────────────────────┤     │   │   (rendered result)         │   │
│   │ 🤖 Found 23 results  │     │   │                             │   │
│   │    SQL ▸ (expand)     │     │   │                             │   │
│   ├──────────────────────┤     │   │                             │   │
│   │ 👤 now sort by salary │     │   │                             │   │
│   ├──────────────────────┤     │   └─────────────────────────────┘   │
│   │ 🤖 Sorted. Top earner│     │                                     │
│   │    is Maria Chen...   │     │   Follow-up Suggestions             │
│   └──────────────────────┘     │  ┌────────────┐┌──────────────────┐ │
│                                │  │Compare to  ││Show on a map     │ │
│  ┌──────────────────────┬───┐  │  │NY engineers ││                  │ │
│  │ Type or ask...        │🎤│  │  └────────────┘└──────────────────┘ │
│  └──────────────────────┴───┘  │                                     │
└────────────────────────────────┴─────────────────────────────────────┘
```

**Two-panel layout:** Left 40% (chat + input), Right 60% (summary + results + follow-ups).

### 4.4 Layout Design — Mobile (<1024px)

On mobile, the two-panel layout collapses to a **single-column tabbed view** with bottom tab navigation.

```
┌──────────────────────────┐
│  🎙️ Athena Voice Chat    │
├──────────────────────────┤
│                          │
│  (Active Tab Content)    │
│                          │
│  💬 Chat Tab:            │
│  - Chat history          │
│  - Canned query tiles    │
│    (horizontal scroll)   │
│  - Input bar + PTT       │
│                          │
│  📊 Results Tab:         │
│  - NL Summary            │
│  - Table/Map/Chart       │
│  - Follow-up chips       │
│                          │
├──────────────────────────┤
│  [💬 Chat] [📊 Results]  │ ← Bottom tab bar
└──────────────────────────┘
```

**Mobile-specific behaviors:**
- When a new result arrives, auto-switch to the Results tab.
- PTT button expands to full-width on mobile for easy thumb access.
- Canned query tiles scroll horizontally.
- Tables become horizontally scrollable.
- Charts use `responsive: true` and `useResizeHandler: true` in Plotly config.
- Maps fill available width with touch-friendly zoom controls.

### 4.5 Responsive Breakpoints

```css
/* Mobile first */
@media (max-width: 767px)  { /* Phone: single column, bottom tabs */ }
@media (min-width: 768px) and (max-width: 1023px) { /* Tablet: single column, larger elements */ }
@media (min-width: 1024px) { /* Desktop: two-panel side by side */ }
```

**Implementation approach:**
- Use CSS Grid with `grid-template-columns: 1fr` on mobile → `40fr 60fr` on desktop.
- All components use relative units (`rem`, `%`, `vh/vw`), no fixed pixel widths.
- Touch targets minimum 44×44px on mobile (Apple HIG guideline).
- PTT button: 48px on desktop, 64px on mobile.

### 4.6 Component Specifications

#### `App.jsx`
- Responsive two-column (desktop) / tabbed single-column (mobile) layout.
- State: `chatHistory[]`, `currentResult`, `isLoading`, `isRecording`, `conversationHistory[]`, `favorites[]`, `activeTab` (mobile).
- Dark theme with professional styling.
- Detects viewport width to toggle between desktop and mobile layout.

#### `ChatInput.jsx`
- Text input field with submit on Enter or button click.
- **Typeahead dropdown** appears on typing, suggesting column names and values from the schema.
- PTT button next to the input (desktop) or below it (mobile).
- When loading, disable both inputs and show spinner.
- On mobile: input is sticky at bottom of chat tab with PTT below it.

#### `Typeahead.jsx`
- Triggers on typing after 2+ characters.
- Searches against a **static schema dictionary** (hardcoded from the table schema):
  - Column names: "salary", "department", "profession", "city", "state", "evaluation_score", etc.
  - Known values: department names, profession names, state abbreviations, city names.
- Displays dropdown below input with matching suggestions.
- Clicking a suggestion inserts it into the input text.
- Dismiss on Escape or click outside.
- On mobile: dropdown appears above the keyboard.

**Schema dictionary (include in frontend):**
```javascript
const SCHEMA_HINTS = {
  columns: ['employee_id', 'first_name', 'last_name', 'age', 'gender', 'latitude', 'longitude', 'city', 'state', 'profession', 'department', 'salary', 'evaluation_score', 'years_at_company', 'hire_date'],
  departments: ['Engineering', 'Design', 'Sales', 'HR', 'Finance', 'Marketing'],
  professions: ['Engineer', 'Designer', 'Manager', 'Analyst', 'Sales Rep', 'HR Specialist', 'Data Scientist', 'Product Manager', 'DevOps Engineer', 'Marketing Specialist'],
  cities: ['New York', 'San Francisco', 'Chicago', 'Austin', 'Denver', 'Seattle', 'Miami', 'Los Angeles', 'Boston', 'Portland'],
  states: ['NY', 'CA', 'IL', 'TX', 'CO', 'WA', 'FL', 'MA', 'OR']
};
```

#### `CannedQueries.jsx`
- Row of clickable tiles/buttons with preset queries.
- Displayed above the chat history.
- On mobile: horizontal scrolling row.
- Clicking a tile sends it immediately as a query (same as typing and hitting Enter).

**Default canned queries:**
```javascript
const CANNED_QUERIES = [
  { label: "🏆 Top 10 Earners", query: "Who are the top 10 highest paid employees?" },
  { label: "📊 Salary by Dept", query: "What is the average salary by department?" },
  { label: "🗺️ Employee Map", query: "Show all employees on a map" },
  { label: "⭐ Top Performers", query: "Show employees with evaluation score above 4.5" },
  { label: "📈 Hiring Trend", query: "Show number of employees hired each year" },
  { label: "👥 Headcount", query: "How many employees are in each department?" }
];
```

#### `FavoritesBar.jsx`
- Dropdown or collapsible section in the header showing saved queries.
- Each favorite shows the query text and a delete button.
- Clicking a favorite re-runs the query.
- "Save" button (⭐) appears next to each query in the chat history.
- Stored in **localStorage** — no backend needed.
- On mobile: accessible via header menu icon.

#### `useFavorites.js` Hook
```javascript
// Returns: { favorites, addFavorite(query), removeFavorite(id), isFavorite(query) }
// Persists to localStorage under key 'athena-chat-favorites'
// Each favorite: { id, query, timestamp, label? }
// Max 20 favorites. Show warning if limit reached.
```

#### `PTTButton.jsx`
- **Mouse/touch behavior:** Hold to record, release to send.
- Visual states: idle (gray mic icon), recording (red pulsing), processing (spinner).
- Uses `useAudioRecorder` hook.
- On release: calls `api.sendVoiceQuery(audioBlob, conversationHistory)`.
- On mobile: larger touch target (64px), centered below the text input.

#### `useAudioRecorder.js` Hook
```javascript
// Returns: { startRecording, stopRecording, isRecording }
// Uses navigator.mediaDevices.getUserMedia({ audio: true })
// MediaRecorder with mimeType: 'audio/webm;codecs=opus'
// On stop: collects chunks into Blob, returns via callback
```

- Handle permissions gracefully — show message if mic access denied.
- Clean up MediaStream tracks on stop.

#### `useConversationHistory.js` Hook
```javascript
// Returns: { conversationHistory, addExchange(userMessage, sql, summary), clearHistory }
// Maintains an array of the last 5 exchanges:
// [{ role: 'user', content: '...' }, { role: 'assistant', sql: '...', summary: '...' }]
// Older exchanges are dropped to keep Bedrock context manageable.
// clearHistory resets the conversation (e.g., user clicks "New Conversation" button).
```

- Conversation history is sent with every API request.
- History enables follow-up queries like "now filter that to California" or "sort those by salary".
- Provide a "New Conversation" button that clears the history.

#### `NLSummary.jsx`
- Displays the `summary` field from the API response.
- Appears above the results panel as a highlighted card.
- Styled as a soft-background callout box with an info icon.
- Fades in with a subtle animation on new results.
- On mobile: appears between tab header and results.

#### `FollowUpChips.jsx`
- Renders the 3 `follow_ups` as clickable chip/pill buttons.
- Displayed below the results panel.
- Clicking a chip sends it as the next query (preserving conversation context).
- Chips should wrap responsively.
- On mobile: stack vertically, full width, with enough padding for touch.

#### `TranscriptBanner.jsx`
- For voice queries, shows: "🎤 You said: [transcript text]" in an editable banner above the result.
- User can click to edit the transcript and re-submit if Transcribe got it wrong.
- "Re-run" button appears after editing.
- Dismissed after re-run or on next query.

#### `ResultsPanel.jsx`
- Receives `currentResult` prop.
- Renders in order: `NLSummary` → result visualization → `FollowUpChips`.
- Switches on `result_type`:
  - `"table"` → renders `<TableResult />`
  - `"map"` → renders `<MapResult />`
  - `"chart"` → renders `<ChartResult />`
- Shows "Ask a question to see results" placeholder when empty.
- On mobile: this is the content of the "Results" tab.

#### `TableResult.jsx`
- Renders a styled HTML `<table>` with sticky header.
- Sortable columns (click header to sort).
- Max height with vertical scroll for large result sets.
- Show row count.
- Zebra striping for readability.
- On mobile: horizontal scroll enabled with shadow indicators showing more content.

#### `MapResult.jsx`
- Uses **Leaflet** via `react-leaflet`.
- Centers map to fit all markers.
- Each marker shows a popup with employee details (name, profession, salary, etc.).
- Marker clustering if many points overlap (optional, use `react-leaflet-markercluster` if needed).
- Tile layer: OpenStreetMap.
- On mobile: fills available width, touch-friendly zoom, popup text scaled for readability.

```jsx
// Key implementation:
// - Parse rows for latitude, longitude
// - Create markers with Popup showing relevant row data
// - Use fitBounds to auto-zoom to show all markers
```

#### `ChartResult.jsx`
- Uses **Plotly.js** via `react-plotly.js`.
- Reads `chart_config` from response to determine:
  - `x_column` and `y_column` for axes.
  - `chart_type` → Plotly trace type (`bar`, `scatter+lines`).
- **Responsive:** uses `useResizeHandler={true}` and `style={{ width: '100%', height: '100%' }}`.
- Clean layout with title from `chart_config.title`.
- For line charts: use `type: 'scatter', mode: 'lines+markers'`.
- For bar charts: use `type: 'bar'`.
- On mobile: disable drag-to-zoom (confusing on touch), keep pinch-to-zoom.

```jsx
// Plotly responsive config:
const config = {
  responsive: true,
  displayModeBar: isMobile ? false : true,
  scrollZoom: false
};
```

#### `SQLDisplay.jsx`
- Collapsible section showing the generated SQL.
- Syntax-highlighted if possible (or just monospace font in a code block).
- Shows transcript for voice queries: "🎤 You said: ..."
- Shows self-heal info if retries occurred: "⚠️ Query was auto-corrected (1 retry)."

#### `ChatPanel.jsx`
- Scrollable list of chat messages.
- Each entry shows:
  - User message (text or transcript).
  - NL summary from the assistant.
  - Generated SQL (collapsible).
  - ⭐ Save to favorites button.
  - Brief result indicator ("23 results as table", "Chart rendered", "12 pins on map").
- Auto-scrolls to bottom on new message.
- Clicking a past message re-renders its result in the right panel (desktop) or switches to Results tab (mobile).

#### `MobileNav.jsx`
- Bottom tab bar, visible only on mobile (<1024px).
- Two tabs: 💬 Chat | 📊 Results.
- Active tab highlighted.
- Badge on Results tab when new results arrive while viewing Chat.

### 4.7 API Service (`services/api.js`)

```javascript
const API_URL = process.env.REACT_APP_API_URL; // Lambda Function URL

export async function sendTextQuery(message, conversationHistory = []) {
  const response = await fetch(`${API_URL}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ route: 'query', message, conversation_history: conversationHistory })
  });
  return response.json();
}

export async function sendVoiceQuery(audioBlob, conversationHistory = []) {
  const base64 = await blobToBase64(audioBlob);
  const response = await fetch(`${API_URL}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ route: 'voice-query', audio: base64, format: 'webm', conversation_history: conversationHistory })
  });
  return response.json();
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
```

### 4.8 Styling Requirements
- Dark theme (dark gray background `#1a1a2e`, light text `#e0e0e0`).
- Accent color for interactive elements (blue `#4361ee` or similar).
- PTT button: large, round, with clear visual feedback. Red pulse animation when recording.
- Loading state: skeleton loader or spinner in results panel.
- **Fully responsive** — see breakpoints in Section 4.5.
- All transitions smooth (300ms ease).
- Use CSS modules or styled-components — no UI framework required.
- Font: system font stack for performance (`-apple-system, BlinkMacSystemFont, 'Segoe UI', ...`).
- Minimum font size 16px on mobile (prevents iOS zoom on input focus).
- Safe area insets for notched phones: `env(safe-area-inset-bottom)` on bottom nav.

---

## Phase 5: Infrastructure as Code (Optional but Recommended)

### 5.1 AWS SAM Template

```yaml
Resources:
  DataBucket:
    Type: AWS::S3::Bucket

  ChatFunction:
    Type: AWS::Serverless::Function
    Properties:
      Handler: handler.lambda_handler
      Runtime: python3.12
      Timeout: 120
      MemorySize: 512
      FunctionUrlConfig:
        AuthType: NONE
        Cors:
          AllowOrigins: ["*"]
          AllowMethods: ["POST"]
          AllowHeaders: ["Content-Type"]
      Policies:
        - S3CrudPolicy:
            BucketName: !Ref DataBucket
        - Statement:
            - Effect: Allow
              Action:
                - transcribe:*
                - bedrock:InvokeModel
                - athena:*
                - glue:GetTable
                - glue:GetDatabase
              Resource: "*"
```

---

## Phase 6: Testing & Example Queries

### 6.1 Test Queries — All Three Result Types

**Table results:**
- "Show me all employees in the Engineering department"
- "Who are the top 10 highest paid employees?"
- "List all employees with evaluation score above 4.5"
- "Find employees named Smith"

**Map results:**
- "Show me where all the engineers are located"
- "Where are employees in Texas?"
- "Map all employees with salary over 180000"
- "Show locations of all managers"

**Chart results:**
- "What is the average salary by department?"
- "Show me the number of employees hired each year"
- "Compare average evaluation scores across professions"
- "What's the salary distribution by age group?"

### 6.2 Test Queries — Follow-Up Context

Test these as **sequential conversations** (do not clear history between):

**Sequence 1: Drill-down**
1. "Show me all engineers" → table
2. "Now just the ones in California" → filtered table
3. "Sort those by salary descending" → sorted table
4. "Show them on a map" → map

**Sequence 2: Pivot**
1. "What's the average salary by department?" → chart
2. "Now break it down by gender too" → chart
3. "Which department has the biggest gender pay gap?" → table

**Sequence 3: Pronoun resolution**
1. "Show employees hired in 2024" → table
2. "How many of them are in Engineering?" → table (count)
3. "What's their average evaluation score?" → table

### 6.3 Test Queries — Self-Healing

Intentionally test queries that might produce ambiguous SQL:
- "Show me employee trends" (vague — should still produce something reasonable)
- "Compare Q1 and Q2" (no quarter data exists — should handle gracefully)

### 6.4 Test Queries — NL Summary Quality

For each query result, verify:
- Summary includes specific numbers (counts, averages, ranges).
- Summary is 2-3 sentences, not generic.
- Follow-up suggestions are relevant and diverse (not repetitive).

### 6.5 Test Queries — Canned Queries & Favorites

- Click each canned query tile, verify results.
- Save a query to favorites, refresh page, verify it persists.
- Run a favorite, verify it works.
- Delete a favorite, verify removal.

### 6.6 Voice Test Cases
- Record and submit queries via PTT button.
- Verify transcript accuracy.
- Edit a transcript in the TranscriptBanner, re-run, verify corrected query.
- Verify identical results to text input.

### 6.7 Responsive Test Cases

**Desktop (≥1024px):**
- Two-panel layout renders correctly.
- Chat and results visible simultaneously.
- Typeahead dropdown positions below input.

**Tablet (768–1023px):**
- Single-column layout with tabs.
- All interactive elements have adequate size.
- Charts and maps resize properly.

**Mobile (≤767px):**
- Bottom tab navigation appears.
- PTT button is large and thumb-friendly.
- Tables scroll horizontally with shadow indicators.
- Canned queries scroll horizontally.
- Input doesn't zoom on focus (font ≥16px).
- Safe area padding on notched devices.
- Follow-up chips stack vertically.
- Auto-switches to Results tab on new result.

### 6.8 Error Cases
- Submit empty text → show validation message.
- Submit very short audio (< 0.5s) → handle gracefully.
- Ask a question unrelated to the data → should return helpful message.
- Deny microphone permissions → show helpful message.
- Network error → show retry option.
- Self-heal exhausted → show error with SQL and Athena error message for debugging.

---

## Implementation Order

1. **Phase 1** — Generate mock data CSV, upload to S3, create Athena table, verify with a manual query in Athena console.
2. **Phase 2 (core)** — Build Lambda with text query flow: Bedrock SQL generation + Athena execution. No Transcribe, no NL summary yet. Test via curl.
3. **Phase 4 (core desktop)** — Build frontend with text input, desktop two-panel layout, table rendering only. Verify end-to-end text → SQL → results → table.
4. **Phase 2 (self-heal)** — Add query self-healing to Lambda. Test with intentionally tricky queries.
5. **Phase 2 (NL summary)** — Add second Bedrock call for NL summary + follow-up generation. Update response format.
6. **Phase 4 (NL + follow-ups)** — Add NLSummary and FollowUpChips components to frontend.
7. **Phase 2 (context)** — Add conversation history handling to Lambda. Update Bedrock prompt.
8. **Phase 4 (context)** — Add useConversationHistory hook, send history with requests. Test follow-up sequences.
9. **Phase 2 (voice)** — Add Transcribe integration to Lambda.
10. **Phase 4 (PTT)** — Add PTT button, TranscriptBanner, and voice flow to frontend.
11. **Phase 4 (map + chart)** — Add MapResult and ChartResult components.
12. **Phase 4 (query UX)** — Add CannedQueries, Typeahead, FavoritesBar components.
13. **Phase 4 (mobile)** — Add responsive breakpoints, MobileNav, mobile-specific layouts and touch optimizations.
14. **Phase 6** — Full integration testing across all query types, devices, and scenarios.

---

## Environment Variables

### Lambda
```
DATA_BUCKET=athena-voice-chat-data-{id}
ATHENA_DATABASE=voice_chat_db
ATHENA_OUTPUT_LOCATION=s3://{bucket}/athena-results/
BEDROCK_MODEL_ID=anthropic.claude-3-sonnet-20240229-v1:0
SELF_HEAL_MAX_RETRIES=2
```

### Frontend
```
REACT_APP_API_URL=https://{lambda-function-url-id}.lambda-url.{region}.on.aws/
```

---

## Key Constraints & Notes

- **API Gateway 30s timeout:** This is why we use Lambda Function URLs instead. Two Bedrock calls + Transcribe + Athena can total 15–30 seconds.
- **Bedrock token budget:** The NL summary call adds ~1-2 seconds and ~500 tokens. Acceptable for the UX improvement.
- **Conversation history size:** Cap at 5 exchanges to keep Bedrock prompt under control. Older context is dropped.
- **Transcribe job naming:** Use UUID for each job name to avoid conflicts.
- **Athena cold start:** First query may be slower. Subsequent queries are faster.
- **Audio format:** WebM/Opus is natively supported by both browsers and Transcribe.
- **CORS:** Lambda Function URL handles CORS. Set `AllowOrigins` appropriately.
- **Bedrock region availability:** Ensure the region supports both Bedrock Claude and Transcribe.
- **Clean up S3 audio files:** Add lifecycle policy to delete audio files after 1 day.
- **No authentication for MVP.** For production, add Cognito or API keys.
- **localStorage for favorites:** No backend persistence needed for MVP. Favorites are device-local.
- **Mobile viewport:** Include `<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">` to prevent unintended zoom.
- **Plotly bundle size:** Plotly.js is large (~3MB). Consider using `plotly.js-basic-dist` for smaller bundle if only bar/line/scatter are needed.

# VoxQuery Setup Guide

A complete step-by-step guide for deploying the VoxQuery voice-enabled Athena chat template.

## Prerequisites

- AWS CLI configured with credentials
- Node.js 18+
- Python 3.10+
- SAM CLI (will be installed if missing)

## Step 1: Install SAM CLI

```bash
pip install aws-sam-cli
```

## Step 2: Clone/Create Project

```bash
git clone git@github.com:holla2040/VoxQuery.git
cd VoxQuery
```

## Step 3: Deploy Backend Infrastructure

```bash
cd infrastructure
./deploy.sh
```

**What this does:**
- Builds Lambda function with SAM
- Creates CloudFormation stack with:
  - S3 bucket for data and audio
  - Lambda function with Function URL
  - IAM roles with permissions for Athena, Bedrock, Transcribe, S3, Glue, Marketplace

**Expected output:**
```
Lambda Function URL: https://xxxxx.lambda-url.us-west-2.on.aws/
Data Bucket: voxquery-data-ACCOUNT_ID
```

## Step 4: Setup Athena Data

```bash
./setup-aws.sh
```

**What this does:**
- Generates 200 employee records (CSV)
- Uploads to S3
- Creates Glue database `voice_chat_db`
- Creates Athena table `employees`

## Step 5: Enable Bedrock Model Access

**IMPORTANT:** First-time Anthropic model users must activate the model:

1. Go to AWS Console → Bedrock → Playgrounds → Chat
2. Select **Claude Haiku 4.5**
3. Send any test message (e.g., "Hello")
4. This completes the one-time subscription

The Lambda role has marketplace permissions but the initial subscription must be triggered by a console user.

## Step 6: Install Frontend Dependencies

```bash
cd ../frontend/athena-voice-chat
npm install
```

## Step 7: Configure Frontend API URL

Edit `src/config.js`:
```javascript
export const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://YOUR-FUNCTION-URL.lambda-url.us-west-2.on.aws';
```

Or set environment variable:
```bash
export REACT_APP_API_URL=https://YOUR-FUNCTION-URL.lambda-url.us-west-2.on.aws
```

## Step 8: Start Frontend

```bash
npm start
```

Opens http://localhost:3000

## Step 9: Test

1. Type: "How many employees?"
2. Expected: Table showing count of 200
3. Try: "Show all employees on a map" (map visualization)
4. Try: "Average salary by department" (chart visualization)

---

## Troubleshooting

### Issue: CORS "multiple values" error

**Symptom:**
```
The 'Access-Control-Allow-Origin' header contains multiple values '*, *'
```

**Fix:** Remove CORS headers from Lambda handler code - Lambda Function URL already handles CORS.

In `lambda/handler.py`, change:
```python
CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    ...
}
```
To:
```python
RESPONSE_HEADERS = {
    "Content-Type": "application/json"
}
```

### Issue: SAM build fails - Python version

**Symptom:**
```
Binary validation failed for python... did not satisfy constraints for runtime: python3.11
```

**Fix:** Update `infrastructure/template.yaml`:
```yaml
Runtime: python3.10  # Match your local Python version
```

### Issue: Bedrock AccessDeniedException

**Symptom:**
```
Model access is denied due to IAM user or service role is not authorized to perform the required AWS Marketplace actions
```

**Fixes:**
1. Ensure Lambda role has marketplace permissions (already in template)
2. Activate model from Bedrock console playground first
3. Broaden Bedrock permissions to `Resource: '*'`

### Issue: SAM template validation fails

**Symptom:**
```
'AWS_REGION' is a reserved variable name
'OPTIONS' is not one of ['GET', 'PUT', 'HEAD', 'POST', 'PATCH', 'DELETE', '*']
```

**Fixes:**
- Remove `AWS_REGION` from Lambda environment variables (auto-set by Lambda)
- Remove `OPTIONS` from CORS AllowMethods (handled automatically by Function URL)

---

## Key Configuration Files

| File | Purpose |
|------|---------|
| `infrastructure/template.yaml` | SAM/CloudFormation template |
| `infrastructure/deploy.sh` | Deployment script |
| `infrastructure/setup-aws.sh` | Data setup script |
| `lambda/bedrock_service.py` | Model ID configuration |
| `frontend/src/config.js` | API URL configuration |

## Model Configuration

Current model: **Claude Haiku 4.5**
```
Model ID: anthropic.claude-haiku-4-5-20251001-v1:0
```

To change model, update:
1. `infrastructure/template.yaml` - BedrockModelId parameter default
2. `lambda/bedrock_service.py` - MODEL_ID fallback

## IAM Permissions Required

The Lambda execution role needs:
- `s3:*` on data bucket
- `athena:StartQueryExecution`, `GetQueryExecution`, `GetQueryResults`
- `glue:GetDatabase`, `GetTable`, `GetTables`, `GetPartitions`
- `bedrock:InvokeModel`, `InvokeModelWithResponseStream`
- `transcribe:StartTranscriptionJob`, `GetTranscriptionJob`, `DeleteTranscriptionJob`
- `aws-marketplace:ViewSubscriptions`, `Subscribe`, `Unsubscribe`, `GetEntitlements`

## Redeployment

After code changes:
```bash
cd infrastructure
sam build && sam deploy --stack-name voxquery --region us-west-2 --capabilities CAPABILITY_IAM --resolve-s3 --no-confirm-changeset
```

## Cleanup

To delete all resources:
```bash
aws cloudformation delete-stack --stack-name voxquery --region us-west-2
aws s3 rb s3://voxquery-data-ACCOUNT_ID --force
```

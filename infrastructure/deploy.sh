#!/bin/bash
# VoxQuery Deployment Script
# Deploys the Lambda function and infrastructure using SAM

set -e

STACK_NAME="${STACK_NAME:-voxquery}"
AWS_REGION="${AWS_REGION:-us-west-2}"
TEMPLATE_FILE="template.yaml"

echo "=========================================="
echo "VoxQuery Deployment"
echo "=========================================="
echo "Stack: ${STACK_NAME}"
echo "Region: ${AWS_REGION}"
echo ""

# Check for AWS CLI
if ! command -v aws &> /dev/null; then
    echo "Error: AWS CLI not found. Please install it first."
    exit 1
fi

# Check for SAM CLI
if ! command -v sam &> /dev/null; then
    echo "Error: SAM CLI not found. Please install it first."
    echo "  pip install aws-sam-cli"
    exit 1
fi

# Check AWS credentials
echo "Checking AWS credentials..."
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text 2>/dev/null)
if [ -z "$AWS_ACCOUNT_ID" ]; then
    echo "Error: Unable to get AWS account ID. Check your credentials."
    exit 1
fi
echo "AWS Account: ${AWS_ACCOUNT_ID}"

# Change to infrastructure directory
cd "$(dirname "$0")"

# Build the application
echo ""
echo "Building Lambda function..."
sam build --template-file "${TEMPLATE_FILE}" --use-container 2>/dev/null || sam build --template-file "${TEMPLATE_FILE}"

# Deploy
echo ""
echo "Deploying stack..."
sam deploy \
    --stack-name "${STACK_NAME}" \
    --region "${AWS_REGION}" \
    --capabilities CAPABILITY_IAM \
    --resolve-s3 \
    --no-confirm-changeset \
    --no-fail-on-empty-changeset

# Get outputs
echo ""
echo "=========================================="
echo "Deployment Complete!"
echo "=========================================="
echo ""

FUNCTION_URL=$(aws cloudformation describe-stacks \
    --stack-name "${STACK_NAME}" \
    --region "${AWS_REGION}" \
    --query 'Stacks[0].Outputs[?OutputKey==`FunctionUrl`].OutputValue' \
    --output text)

BUCKET_NAME=$(aws cloudformation describe-stacks \
    --stack-name "${STACK_NAME}" \
    --region "${AWS_REGION}" \
    --query 'Stacks[0].Outputs[?OutputKey==`DataBucketName`].OutputValue' \
    --output text)

echo "Lambda Function URL: ${FUNCTION_URL}"
echo "Data Bucket: ${BUCKET_NAME}"
echo ""
echo "Next steps:"
echo "  1. Run setup-aws.sh to upload employee data"
echo "  2. Update frontend config with Function URL:"
echo "     export REACT_APP_API_URL=${FUNCTION_URL}"
echo "  3. Start frontend:"
echo "     cd ../frontend/athena-voice-chat && npm install && npm start"
echo ""
echo "Test the API:"
echo "  curl ${FUNCTION_URL}health"

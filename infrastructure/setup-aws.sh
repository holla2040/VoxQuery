#!/bin/bash
# VoxQuery AWS Setup Script
# This script creates the necessary AWS resources for VoxQuery

set -e

# Get AWS account ID
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
AWS_REGION=${AWS_REGION:-us-west-2}
BUCKET_NAME="voxquery-data-${AWS_ACCOUNT_ID}"

echo "Setting up VoxQuery infrastructure..."
echo "AWS Account: ${AWS_ACCOUNT_ID}"
echo "Region: ${AWS_REGION}"
echo "Bucket: ${BUCKET_NAME}"

# Step 1: Create S3 bucket
echo ""
echo "Step 1: Creating S3 bucket..."
if aws s3 ls "s3://${BUCKET_NAME}" 2>&1 | grep -q 'NoSuchBucket'; then
    aws s3 mb "s3://${BUCKET_NAME}" --region "${AWS_REGION}"
    echo "Created bucket: ${BUCKET_NAME}"
else
    echo "Bucket ${BUCKET_NAME} already exists"
fi

# Step 2: Generate employee data
echo ""
echo "Step 2: Generating employee data..."
cd "$(dirname "$0")/../data"
python3 generate_employees.py
echo "Generated employees.csv"

# Step 3: Upload CSV to S3
echo ""
echo "Step 3: Uploading data to S3..."
aws s3 cp employees.csv "s3://${BUCKET_NAME}/data/employees/"
echo "Uploaded employees.csv to s3://${BUCKET_NAME}/data/employees/"

# Step 4: Create Athena results directory
echo ""
echo "Step 4: Setting up Athena results location..."
aws s3api put-object --bucket "${BUCKET_NAME}" --key "athena-results/" --content-length 0 || true
echo "Created athena-results/ prefix"

# Step 5: Create Glue database via Athena
echo ""
echo "Step 5: Creating Glue database..."
QUERY_ID=$(aws athena start-query-execution \
    --query-string "CREATE DATABASE IF NOT EXISTS voice_chat_db" \
    --result-configuration "OutputLocation=s3://${BUCKET_NAME}/athena-results/" \
    --query "QueryExecutionId" \
    --output text)

echo "Waiting for database creation (Query ID: ${QUERY_ID})..."
aws athena get-query-execution --query-execution-id "${QUERY_ID}" --query "QueryExecution.Status.State" --output text
sleep 3

# Step 6: Create employees table
echo ""
echo "Step 6: Creating employees table..."

# Update the SQL file with actual bucket name
SQL_TEMPLATE=$(cat "$(dirname "$0")/athena-setup.sql" | sed "s/YOUR_BUCKET_NAME/${BUCKET_NAME}/g")

# Extract just the CREATE TABLE statement
CREATE_TABLE_SQL=$(echo "$SQL_TEMPLATE" | grep -A 20 "CREATE EXTERNAL TABLE" | head -20)

QUERY_ID=$(aws athena start-query-execution \
    --query-string "CREATE EXTERNAL TABLE IF NOT EXISTS voice_chat_db.employees (
    employee_id INT,
    first_name STRING,
    last_name STRING,
    email STRING,
    department STRING,
    job_title STRING,
    salary INT,
    hire_date DATE,
    city STRING,
    state STRING,
    latitude DOUBLE,
    longitude DOUBLE,
    status STRING
)
ROW FORMAT DELIMITED
FIELDS TERMINATED BY ','
LINES TERMINATED BY '\n'
LOCATION 's3://${BUCKET_NAME}/data/employees/'
TBLPROPERTIES (
    'skip.header.line.count'='1',
    'serialization.null.format'=''
)" \
    --result-configuration "OutputLocation=s3://${BUCKET_NAME}/athena-results/" \
    --query "QueryExecutionId" \
    --output text)

echo "Waiting for table creation (Query ID: ${QUERY_ID})..."
sleep 5
STATUS=$(aws athena get-query-execution --query-execution-id "${QUERY_ID}" --query "QueryExecution.Status.State" --output text)
echo "Table creation status: ${STATUS}"

# Step 7: Verify setup
echo ""
echo "Step 7: Verifying setup..."
QUERY_ID=$(aws athena start-query-execution \
    --query-string "SELECT COUNT(*) as total_employees FROM voice_chat_db.employees" \
    --result-configuration "OutputLocation=s3://${BUCKET_NAME}/athena-results/" \
    --query "QueryExecutionId" \
    --output text)

echo "Waiting for verification query..."
sleep 5
STATUS=$(aws athena get-query-execution --query-execution-id "${QUERY_ID}" --query "QueryExecution.Status.State" --output text)
echo "Query status: ${STATUS}"

if [ "$STATUS" = "SUCCEEDED" ]; then
    RESULT=$(aws athena get-query-results --query-execution-id "${QUERY_ID}" --query "ResultSet.Rows[1].Data[0].VarCharValue" --output text)
    echo "Total employees in table: ${RESULT}"
fi

echo ""
echo "============================================"
echo "VoxQuery AWS setup complete!"
echo "============================================"
echo ""
echo "Resources created:"
echo "  - S3 Bucket: ${BUCKET_NAME}"
echo "  - Athena Database: voice_chat_db"
echo "  - Athena Table: voice_chat_db.employees"
echo ""
echo "Next steps:"
echo "  1. Deploy Lambda function: cd infrastructure && sam build && sam deploy --guided"
echo "  2. Update frontend config with Lambda Function URL"
echo "  3. Start frontend: cd frontend/athena-voice-chat && npm start"

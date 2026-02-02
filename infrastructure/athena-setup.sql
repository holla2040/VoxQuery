-- VoxQuery Athena Setup
-- Run these commands in the AWS Athena console or via AWS CLI

-- Create database
CREATE DATABASE IF NOT EXISTS voice_chat_db;

-- Create employees table (external table pointing to S3)
-- Replace YOUR_BUCKET_NAME with your actual bucket name
CREATE EXTERNAL TABLE IF NOT EXISTS voice_chat_db.employees (
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
LOCATION 's3://YOUR_BUCKET_NAME/data/employees/'
TBLPROPERTIES (
    'skip.header.line.count'='1',
    'serialization.null.format'=''
);

-- Verify table creation
-- SELECT * FROM voice_chat_db.employees LIMIT 10;

-- Sample queries to test:
-- SELECT department, COUNT(*) as count FROM voice_chat_db.employees GROUP BY department;
-- SELECT city, AVG(salary) as avg_salary FROM voice_chat_db.employees GROUP BY city ORDER BY avg_salary DESC;
-- SELECT * FROM voice_chat_db.employees WHERE state = 'California';

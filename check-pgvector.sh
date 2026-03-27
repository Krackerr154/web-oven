#!/bin/bash
# Check if x01_db PostgreSQL container supports pgvector extension
# RUN THIS ON YOUR VPS where x01_db container is running

echo "=== Checking PostgreSQL version ==="
docker exec x01_db psql -U oven_user -d ap_lab_db -c "SELECT version();"

echo ""
echo "=== Checking if pgvector extension is available ==="
docker exec x01_db psql -U oven_user -d ap_lab_db -c "SELECT * FROM pg_available_extensions WHERE name = 'vector';"

echo ""
echo "=== Attempting to create pgvector extension in ap_lab_db ==="
docker exec x01_db psql -U oven_user -d ap_lab_db -c "CREATE EXTENSION IF NOT EXISTS vector;"

echo ""
echo "=== Verifying pgvector is installed ==="
docker exec x01_db psql -U oven_user -d ap_lab_db -c "SELECT * FROM pg_extension WHERE extname = 'vector';"

echo ""
echo "=== Testing vector operations ==="
docker exec x01_db psql -U oven_user -d ap_lab_db -c "SELECT '[1,2,3]'::vector;"

echo ""
echo "=== DONE ==="
echo "If you see 'vector' extension listed and the test vector worked, you're good to go!"
echo "If not, you'll need to install pgvector in your x01_db container."

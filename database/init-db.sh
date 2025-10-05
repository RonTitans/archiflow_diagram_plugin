#!/bin/bash
set -e

echo "Initializing ArchiFlow Database..."

# Wait for PostgreSQL to be ready
until pg_isready -U $POSTGRES_USER -d $POSTGRES_DB; do
    echo "Waiting for PostgreSQL to be ready..."
    sleep 2
done

# Create database if it doesn't exist
psql -U $POSTGRES_USER <<EOF
CREATE DATABASE IF NOT EXISTS archiflow;
EOF

# Connect to the database and run initialization
psql -U $POSTGRES_USER -d archiflow <<EOF

-- Create schema
CREATE SCHEMA IF NOT EXISTS archiflow;

-- Run base schema
\i /docker-entrypoint-initdb.d/schema.sql

-- Run network schema
\i /docker-entrypoint-initdb.d/network-schema.sql

-- Run all migrations in order
\i /docker-entrypoint-initdb.d/migrations/002_ip_management_and_devices.sql

EOF

echo "Database initialization complete!"
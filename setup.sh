#!/bin/bash

echo "==================================="
echo "ArchiFlow Network Diagram Plugin Setup"
echo "==================================="

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

echo "✅ Docker and Docker Compose found"

# Navigate to docker directory
cd docker || exit

echo "🔄 Stopping any existing containers..."
docker-compose down

echo "🗑️ Cleaning up old data (if any)..."
docker-compose down -v

echo "🏗️ Building containers..."
docker-compose build

echo "🚀 Starting services..."
docker-compose up -d

echo "⏳ Waiting for services to be ready..."
sleep 10

# Check if PostgreSQL is ready
echo "🔍 Checking PostgreSQL..."
until docker exec archiflow-postgres pg_isready -U archiflow_user -d archiflow; do
    echo "Waiting for PostgreSQL..."
    sleep 2
done

echo "📊 Applying database migrations..."
docker exec archiflow-postgres psql -U archiflow_user -d archiflow -f /docker-entrypoint-initdb.d/migrations/002_ip_management_and_devices.sql

echo "✅ PostgreSQL is ready"

# Check backend
echo "🔍 Checking backend..."
until curl -f http://localhost:3333/health 2>/dev/null || [ $? -eq 7 ]; do
    echo "Waiting for backend..."
    sleep 2
done
echo "✅ Backend is ready"

# Check frontend
echo "🔍 Checking frontend..."
until curl -f http://localhost:8081 2>/dev/null; do
    echo "Waiting for frontend..."
    sleep 2
done
echo "✅ Frontend is ready"

echo ""
echo "==================================="
echo "✨ Setup Complete!"
echo "==================================="
echo ""
echo "Access the application at:"
echo "🌐 Frontend: http://localhost:8081"
echo "🔌 Backend WebSocket: ws://localhost:3333"
echo "🗄️ Database: localhost:5432"
echo "📊 Adminer (DB UI): http://localhost:8082"
echo ""
echo "Default credentials:"
echo "DB User: archiflow_user"
echo "DB Password: archiflow_pass"
echo "DB Name: archiflow"
echo ""
echo "To view logs:"
echo "docker-compose logs -f [service-name]"
echo ""
echo "Services: archiflow-frontend, archiflow-backend, archiflow-postgres, archiflow-adminer"
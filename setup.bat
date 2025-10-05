@echo off
echo ===================================
echo ArchiFlow Network Diagram Plugin Setup
echo ===================================

REM Check if Docker is installed
docker --version >nul 2>&1
if %errorlevel% neq 0 (
    echo Error: Docker is not installed. Please install Docker Desktop first.
    pause
    exit /b 1
)

REM Check if Docker Compose is installed
docker-compose --version >nul 2>&1
if %errorlevel% neq 0 (
    echo Error: Docker Compose is not installed. Please install Docker Compose first.
    pause
    exit /b 1
)

echo Docker and Docker Compose found
echo.

REM Navigate to docker directory
cd docker

echo Stopping any existing containers...
docker-compose down

echo.
echo Cleaning up old data if any...
docker-compose down -v

echo.
echo Building containers...
docker-compose build

echo.
echo Starting services...
docker-compose up -d

echo.
echo Waiting for services to be ready...
timeout /t 10 /nobreak >nul

echo.
echo Applying database migrations...
timeout /t 5 /nobreak >nul
docker exec archiflow-postgres psql -U archiflow_user -d archiflow -f /docker-entrypoint-initdb.d/migrations/002_ip_management_and_devices.sql 2>nul

echo.
echo ===================================
echo Setup Complete!
echo ===================================
echo.
echo Access the application at:
echo Frontend: http://localhost:8081
echo Backend WebSocket: ws://localhost:3333
echo Database: localhost:5432
echo Adminer (DB UI): http://localhost:8082
echo.
echo Default credentials:
echo DB User: archiflow_user
echo DB Password: archiflow_pass
echo DB Name: archiflow
echo.
echo To view logs:
echo docker-compose logs -f [service-name]
echo.
echo Services: archiflow-frontend, archiflow-backend, archiflow-postgres, archiflow-adminer
echo.
pause
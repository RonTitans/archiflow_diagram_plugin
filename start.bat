@echo off
echo ========================================
echo   ArchiFlow Network Diagram Plugin
echo   Starting Docker Environment...
echo ========================================
echo.

cd docker

echo Starting Docker containers...
docker-compose up -d

echo.
echo Waiting for services to be ready...
timeout /t 5 /nobreak > nul

echo.
echo ========================================
echo   Services Status:
echo ========================================
docker-compose ps

echo.
echo ========================================
echo   Application URLs:
echo ========================================
echo   Frontend:  http://localhost:8081
echo   Test Page: http://localhost:8081/test-postmessage.html
echo   WebSocket: ws://localhost:3333
echo   Database:  localhost:5432
echo.
echo ========================================
echo   Useful Commands:
echo ========================================
echo   View logs:    docker-compose logs -f
echo   Stop:         docker-compose down
echo   Restart:      docker-compose restart
echo   Database CLI: docker exec -it archiflow-postgres psql -U archiflow_user -d archiflow
echo ========================================
echo.
echo Press any key to open the application in your browser...
pause > nul

start http://localhost:8081

echo.
echo Application started! Check your browser.
echo To stop the services, run: docker-compose down
echo.
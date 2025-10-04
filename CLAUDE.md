# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ArchiFlow Network Diagram Plugin is a standalone web application that integrates Draw.io for creating and managing network diagrams with PostgreSQL database storage and WebSocket-based real-time updates. The application uses Draw.io's embed mode via postMessage protocol for all diagram operations.

## Key Architecture Decisions

### Draw.io Integration
- **CRITICAL**: Always use `embed.diagrams.net` for production (never local Draw.io)
- All communication with Draw.io happens via postMessage protocol
- Never modify Draw.io core source code
- The iframe integration is in `frontend/index.html` and `frontend/app.js`

### Database Architecture
- PostgreSQL with schema `archiflow` containing three main tables:
  - `diagrams`: Stores diagram data and metadata
  - `diagram_versions`: Version history tracking
  - `sites`: Site information management
- **CRITICAL**: Always set `DB_MODE=postgresql` in environment variables
- Store diagrams as TEXT not VARCHAR in database

### WebSocket Communication
- WebSocket server (`backend/websocket-server.js`) handles all backend operations
- Runs on port 3333 by default
- Handles diagram save/load, version management, and real-time updates
- Uses PostgreSQL connection via `backend/database.js`

## Common Development Commands

### Docker Development (Recommended)
```bash
# Start all services
cd docker
docker-compose up -d

# View logs
docker logs -f archiflow-backend  # WebSocket server
docker logs -f archiflow-postgres  # Database
docker logs -f archiflow-frontend  # Frontend

# Stop services
docker-compose down

# Reset database
docker-compose down -v  # Removes volumes too
```

### Manual Development
```bash
# Backend
cd backend
npm install
npm start    # Runs websocket-server.js
npm run dev  # Runs with nodemon for auto-reload

# Frontend
cd frontend
npm install
npm start    # Runs simple-server.js on port 8081
```

### Testing
```bash
# Test postMessage protocol
# Open browser to: http://localhost:8081/test-postmessage.html

# Database operations
docker exec -it archiflow-postgres psql -U archiflow_user -d archiflow
```

## Critical Implementation Notes

1. **PostMessage Protocol**: All Draw.io operations use postMessage - see `frontend/app.js` for implementation patterns
2. **Auto-save**: Implemented with 30-second intervals in frontend
3. **Version Control**: Automatic version tracking on each save operation
4. **WebSocket Protocol**: Message format is JSON with `action` field determining operation type
5. **Database Schema**: Located in `database/schema.sql` - auto-applied via Docker

## Service Ports

- Frontend: 8081
- WebSocket Server: 3333
- PostgreSQL: 5432
- Adminer (DB UI): 8082

## Environment Variables

Required for backend (`backend/.env` or Docker environment):
- `DB_MODE=postgresql` (CRITICAL - must be postgresql, not mock)
- `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`
- `WS_PORT` (default 3333)
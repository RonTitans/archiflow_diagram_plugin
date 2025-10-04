# ArchiFlow Network Diagram Plugin - Implementation Summary

## Project Overview
ArchiFlow is a standalone network diagram plugin that integrates Draw.io (diagrams.net) embedded via iframe with a PostgreSQL backend for persistence. After 3 days of debugging, we successfully implemented a working save/load system with proper data format handling.

## Core Architecture

### Technology Stack
- **Frontend**: Vanilla JavaScript with Draw.io embedded iframe
- **Backend**: Node.js WebSocket server
- **Database**: PostgreSQL with custom schema
- **Containerization**: Docker Compose for orchestration
- **Communication**: WebSocket for real-time operations, postMessage API for Draw.io integration

## Critical Implementation Details

### 1. Draw.io Integration (The 3-Day Bug Solution)

#### The Problem
Draw.io sends and expects different XML formats depending on context:
- **When saving**: Sends full `<mxfile>` wrapper containing `<mxGraphModel>`
- **When loading**: Expects ONLY `<mxGraphModel>` without the wrapper

#### The Solution
```javascript
// On Save - Extract mxGraphModel from mxfile wrapper
case 'save':
    let xmlToSave = msg.xml;
    if (msg.xml && msg.xml.includes('<mxfile')) {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(msg.xml, 'text/xml');
        const graphModel = xmlDoc.querySelector('mxGraphModel');
        if (graphModel) {
            xmlToSave = new XMLSerializer().serializeToString(graphModel);
        }
    }
    this.currentDiagramData = xmlToSave;
    break;

// On Load - Send only mxGraphModel content
if (diagram.content) {
    if (diagram.content.includes('<mxfile')) {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(diagram.content, 'text/xml');
        const graphModel = xmlDoc.querySelector('mxGraphModel');
        if (graphModel) {
            const graphModelXml = new XMLSerializer().serializeToString(graphModel);
            this.drawioFrame.contentWindow.postMessage(JSON.stringify({
                action: 'load',
                xml: graphModelXml
            }), '*');
        }
    } else {
        // Already in correct format
        this.drawioFrame.contentWindow.postMessage(JSON.stringify({
            action: 'load',
            xml: diagram.content
        }), '*');
    }
}
```

### 2. UUID Generation (Frontend)
Database requires proper UUIDs, not timestamp-based IDs:
```javascript
generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}
```

### 3. Site ID Handling (Backend)
Frontend sends site slugs, database needs integer IDs:
```javascript
// Convert site slug to integer ID
let actualSiteId = siteId;
if (typeof siteId === 'string' && isNaN(parseInt(siteId))) {
    const siteQuery = `SELECT id FROM archiflow.sites WHERE slug = $1 OR name = $1`;
    const siteResult = await db.query(siteQuery, [siteId]);
    if (siteResult.rows.length > 0) {
        actualSiteId = siteResult.rows[0].id;
    } else {
        actualSiteId = 1; // Default to site ID 1
    }
} else {
    actualSiteId = parseInt(siteId) || 1;
}
```

### 4. Draw.io Initialization
Draw.io doesn't send a JSON init message - it sends the string 'init':
```javascript
window.addEventListener('message', (event) => {
    if (event.data === 'init') {
        this.isReady = true;
        this.initializeEditor();
        return;
    }
    // Handle other messages...
});
```

## Database Schema

```sql
-- Main diagrams table
CREATE TABLE archiflow.diagrams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id INTEGER REFERENCES archiflow.sites(id),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    diagram_data TEXT,  -- Stores mxGraphModel XML
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(100),
    modified_by VARCHAR(100),
    metadata JSONB
);

-- Version tracking
CREATE TABLE archiflow.diagram_versions (
    id SERIAL PRIMARY KEY,
    diagram_id UUID REFERENCES archiflow.diagrams(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    diagram_data TEXT,
    change_summary TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(100)
);

-- Sites for multi-tenancy
CREATE TABLE archiflow.sites (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    status VARCHAR(50) DEFAULT 'active'
);
```

## WebSocket Protocol

### Message Format
```javascript
// Client to Server
{
    action: 'save_diagram',
    diagramId: 'uuid-here',
    content: '<mxGraphModel>...</mxGraphModel>',
    title: 'Diagram Title',
    siteId: 'main',  // or 1
    siteName: 'Main Site',
    description: 'Optional description'
}

// Server to Client
{
    type: 'save_success',
    action: 'diagram_saved',
    diagramId: 'uuid-here',
    message: 'Diagram saved successfully'
}
```

### Supported Actions
- `save_diagram` - Save or update a diagram
- `load_diagram` - Load a specific diagram by ID
- `list_diagrams` - Get all diagrams for a site
- `list_sites` - Get available sites
- `create_version` - Create a new version
- `get_versions` - Get version history
- `delete_diagram` - Delete a diagram

## Docker Configuration

### docker-compose.yml
```yaml
services:
  archiflow-postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: archiflow
      POSTGRES_USER: archiflow_user
      POSTGRES_PASSWORD: archiflow_pass
    volumes:
      - ./init.sql:/docker-entrypoint-initdb.d/init.sql
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U archiflow_user"]

  archiflow-backend:
    build:
      context: ../backend
      dockerfile: ../docker/Dockerfile.backend
    environment:
      DB_MODE: postgresql  # CRITICAL - must be 'postgresql'
      WS_PORT: 3333
      DB_HOST: archiflow-postgres
      DB_NAME: archiflow
      DB_USER: archiflow_user
      DB_PASSWORD: archiflow_pass
    depends_on:
      archiflow-postgres:
        condition: service_healthy

  archiflow-frontend:
    build:
      context: ../frontend
      dockerfile: ../docker/Dockerfile.frontend
    ports:
      - "3000:80"
```

## Current Features

### Working
✅ Draw.io embed integration
✅ Create new diagrams with UUID
✅ Save diagrams to PostgreSQL
✅ Load diagrams from database
✅ List all diagrams
✅ Site selection (multi-tenancy)
✅ Edit diagram title and description
✅ WebSocket real-time communication
✅ Autosave functionality
✅ Connection status indicator
✅ Docker containerization

### UI Components
- **Toolbar**: Save, Load, New, Versions, Export buttons
- **Sidebar**: Collapsible diagram list (currently hidden)
- **Modals**: New diagram, Load diagram, Edit title, Version history
- **Status Indicators**: Connection status, Save indicator

## Environment Variables

### Backend (Required)
```bash
DB_MODE=postgresql      # MUST be 'postgresql' for real DB
DB_HOST=archiflow-postgres
DB_NAME=archiflow
DB_USER=archiflow_user
DB_PASSWORD=archiflow_pass
DB_PORT=5432
WS_PORT=3333
NODE_ENV=development
```

## Common Issues and Solutions

### Issue 1: "Not a diagram file" Error
**Cause**: Draw.io embed expects mxGraphModel, not mxfile
**Solution**: Extract mxGraphModel from mxfile wrapper

### Issue 2: "Invalid input syntax for type uuid"
**Cause**: Frontend generating timestamp IDs instead of UUIDs
**Solution**: Implement proper UUID v4 generation

### Issue 3: "Invalid input syntax for type integer"
**Cause**: Sending site slug instead of integer ID
**Solution**: Backend converts slug to ID before database operations

### Issue 4: Container not updating after code changes
**Cause**: Docker using cached image
**Solution**: `docker-compose build --no-cache archiflow-backend`

## File Structure
```
ArchiflowDiagramPlugin/
├── frontend/
│   ├── index.html       # Main HTML with Draw.io iframe
│   ├── app.js          # Core JavaScript logic
│   └── styles.css      # UI styling
├── backend/
│   ├── websocket-server.js  # WebSocket server
│   ├── database.js          # Database manager
│   └── package.json         # Node dependencies
├── docker/
│   ├── docker-compose.yml   # Container orchestration
│   ├── Dockerfile.backend   # Backend container
│   ├── Dockerfile.frontend  # Frontend container
│   └── init.sql            # Database initialization
├── database/
│   └── schema.sql          # PostgreSQL schema
└── docs/
    └── IMPLEMENTATION_SUMMARY.md  # This file
```

## Next Steps - Network Features
Now that save/load is working, we can implement network-specific features:
1. Custom shape libraries for network devices (routers, switches, firewalls)
2. Device property panels (IP addresses, VLANs, interfaces)
3. Connection validation (port types, cable types)
4. Auto-layout for network topologies
5. Integration with network management tools
6. Export to network documentation formats
7. Real-time collaboration features
8. Network simulation capabilities

## Testing Commands

### Direct WebSocket Test
```javascript
const ws = new WebSocket('ws://localhost:3333');
ws.on('open', () => {
    ws.send(JSON.stringify({
        action: 'load_diagram',
        diagramId: 'your-uuid-here'
    }));
});
```

### Docker Management
```bash
# Rebuild backend with fresh code
cd docker
docker-compose build --no-cache archiflow-backend
docker-compose up -d

# View logs
docker logs archiflow-backend -f

# Connect to database
# http://localhost:8080 (Adminer)
# System: PostgreSQL
# Server: archiflow-postgres
# Username: archiflow_user
# Password: archiflow_pass
# Database: archiflow
```

## Success Metrics
- ✅ Can create new diagram with custom name
- ✅ Can save diagram to database
- ✅ Can load diagram from database
- ✅ Can see saved diagram in Adminer
- ✅ No "Not a diagram file" errors
- ✅ No UUID format errors
- ✅ No integer type errors
- ✅ Autosave works without errors

---
*This implementation took significant debugging but now provides a solid foundation for building network-specific features on top of Draw.io's powerful diagramming engine.*
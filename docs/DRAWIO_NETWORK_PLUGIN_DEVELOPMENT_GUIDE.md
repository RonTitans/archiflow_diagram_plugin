# 🚀 Draw.io Network Plugin Development Guide
## Building a Production-Ready Network Diagram Plugin with Database Integration

### Table of Contents
1. [Architecture Overview](#architecture-overview)
2. [Core Integration Principles](#core-integration-principles)
3. [Database Design](#database-design)
4. [Docker Architecture](#docker-architecture)
5. [Draw.io Integration Methods](#drawio-integration-methods)
6. [Implementation Roadmap](#implementation-roadmap)
7. [Lessons Learned & Pitfalls](#lessons-learned--pitfalls)

---

## 📐 Architecture Overview

### The Stack We're Building
```
┌─────────────────────────────────────────────────┐
│                   NetBox                         │
│         (Django Plugin: netbox-archiflow)        │
└────────────────────┬────────────────────────────┘
                     │ HTTP/REST API
┌────────────────────┴────────────────────────────┐
│           WebSocket Server (Node.js)             │
│         (Real-time diagram operations)           │
└────────────────────┬────────────────────────────┘
                     │ WebSocket
┌────────────────────┴────────────────────────────┐
│          Draw.io Integration Layer               │
│    (PostMessage Protocol / embed.diagrams.net)   │
└────────────────────┬────────────────────────────┘
                     │ SQL
┌────────────────────┴────────────────────────────┐
│            PostgreSQL Database                   │
│         (archiflow schema + diagrams)            │
└─────────────────────────────────────────────────┘
```

### Key Components
1. **NetBox Plugin**: Python/Django plugin for NetBox integration
2. **WebSocket Server**: Node.js real-time communication layer
3. **Draw.io Frontend**: HTML/JavaScript integration using postMessage
4. **PostgreSQL**: Persistent storage with proper schema design
5. **Docker**: Containerized deployment for all services

---

## 🎯 Core Integration Principles

### 1. PostMessage is THE Standard
**IMPORTANT**: After extensive research, the **postMessage protocol** is the industry-standard way to integrate with Draw.io. This is used by:
- embed.diagrams.net (official)
- Confluence integration
- Jira integration
- Google Drive integration

**Never try to**:
- Modify Draw.io's save dialog directly
- Inject code into Draw.io's core
- Use URL-based data passing for large diagrams

### 2. The Correct PostMessage Flow
```javascript
// 1. Initialize Draw.io
iframe.onload = function() {
    // Wait for Draw.io to be ready
    setTimeout(() => {
        iframe.contentWindow.postMessage(JSON.stringify({
            action: 'init',
            bounds: {x: 0, y: 0, width: 10000, height: 10000}
        }), '*');
    }, 1000);
};

// 2. Handle the init confirmation
window.addEventListener('message', function(evt) {
    const msg = JSON.parse(evt.data);
    if (msg.event === 'init') {
        // Now Draw.io is ready - load diagram
        iframe.contentWindow.postMessage(JSON.stringify({
            action: 'load',
            autosave: 1,
            xml: diagramXmlData
        }), '*');
    }
});

// 3. Handle save events
if (msg.event === 'save') {
    // User saved - msg.xml contains the diagram
    saveToDatabase(msg.xml);
}

// 4. Request export when needed
iframe.contentWindow.postMessage(JSON.stringify({
    action: 'export',
    format: 'xml'
}), '*');
```

### 3. Use embed.diagrams.net for Production
For production, use `https://embed.diagrams.net/` instead of local Draw.io:
- Handles CORS properly
- Supports full postMessage protocol
- Always up-to-date
- No maintenance required

---

## 💾 Database Design

### Schema Structure (What Actually Works)
```sql
-- Main diagrams table (stores actual diagram data)
CREATE TABLE archiflow.diagrams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id INTEGER NOT NULL,
    site_name VARCHAR(255) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    diagram_data TEXT NOT NULL,  -- The actual Draw.io XML
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    modified_at TIMESTAMP DEFAULT NOW(),
    created_by VARCHAR(100) NOT NULL
);

-- Version history table (for future versioning)
CREATE TABLE archiflow.diagram_versions (
    id SERIAL PRIMARY KEY,
    diagram_id UUID REFERENCES diagrams(id),
    version_number INTEGER,
    diagram_xml TEXT,
    change_summary TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    created_by VARCHAR(100)
);

-- Sites table (from NetBox)
CREATE TABLE archiflow.sites (
    id INTEGER PRIMARY KEY,
    name VARCHAR(255),
    slug VARCHAR(50),
    status VARCHAR(50),
    description TEXT
);
```

### Important Database Lessons
1. **Use `diagram_data` column name** - This is what existing data uses
2. **Store raw Draw.io XML** - Don't try to parse or modify it
3. **Use JSONB for metadata** - Flexible for future features
4. **UUID for diagram IDs** - Globally unique, no collisions
5. **Keep version history separate** - Main table for current state only

---

## 🐳 Docker Architecture

### docker-compose.yml Structure
```yaml
services:
  # NetBox + Dependencies
  netbox:
    image: netboxcommunity/netbox:v4.0-2.9.1
    environment:
      DB_HOST: netbox-postgres
      # ... other settings
    volumes:
      - ./netbox-archiflow-plugin:/opt/netbox/netbox-archiflow-plugin:ro
    networks:
      - netbox-backend
      - archiflow-network

  # ArchiFlow Database
  archiflow-postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: archiflow
      POSTGRES_USER: archiflow_user
      POSTGRES_PASSWORD: archiflow_pass
    volumes:
      - ./schema.sql:/docker-entrypoint-initdb.d/01-schema.sql

  # WebSocket Server
  archiflow-backend:
    image: node:18-alpine
    command: sh -c "npm install && node websocket-server.js"
    environment:
      - DB_MODE=postgresql  # CRITICAL: Must be postgresql, not mock!
      - DB_SCHEMA=archiflow
    networks:
      - archiflow-network

  # Static File Server
  archiflow-drawio:
    image: node:18-alpine
    command: sh -c "npm install && node simple-server.js"
    ports:
      - "8081:8081"
```

### Critical Docker Lessons
1. **Use `DB_MODE=postgresql`** - Without this, WebSocket uses mock data
2. **Mount schema.sql as init script** - Auto-creates database structure
3. **Use separate networks** - Isolate backend from frontend
4. **Health checks are essential** - Ensure services start in order
5. **Use Alpine images** - Smaller, faster, more secure

---

## 🔧 Draw.io Integration Methods

### Method 1: embed.diagrams.net (Recommended)
```javascript
const EMBED_URL = 'https://embed.diagrams.net/';
const iframe = document.createElement('iframe');

// Build URL with parameters
const params = new URLSearchParams({
    embed: '1',
    ui: 'atlas',
    spin: 'true',
    libraries: '1',
    noExitBtn: '1',
    noSaveBtn: '1',  // We handle saving ourselves
    configure: '1'
});

iframe.src = EMBED_URL + '?' + params.toString();
```

### Method 2: Local Draw.io (Development Only)
```javascript
// Only for development/testing
const DRAWIO_URL = '/webapp/index.html';
iframe.src = DRAWIO_URL + '?embed=1&ui=atlas&libraries=1';

// Note: Local Draw.io may not fully support postMessage protocol
// Use test-postmessage.html to verify message handling
```

### Method 3: Popup Window (NetBox CSP Workaround)
```javascript
// NetBox has strict Content Security Policy
// Solution: Open Draw.io in a popup window
const drawioWindow = window.open(
    `http://localhost:8081/integrated-drawio.html?diagram_id=${diagramId}`,
    'archiflow-editor',
    'width=1200,height=800'
);

// Communicate with popup via postMessage
drawioWindow.postMessage({action: 'load', diagramId: id}, '*');
```

---

## 📋 Implementation Roadmap

### Phase 1: Core Infrastructure ✅
- [x] Set up Docker environment
- [x] Create PostgreSQL database with schema
- [x] Build WebSocket server
- [x] Verify database connectivity

### Phase 2: Basic Draw.io Integration 🔄
- [x] Implement postMessage protocol
- [x] Test with embed.diagrams.net
- [x] Handle save/load operations
- [ ] Fix XML parsing issues

### Phase 3: NetBox Plugin Development
```python
# netbox-archiflow-plugin structure
netbox_archiflow/
├── __init__.py
├── models.py         # Django models for diagrams
├── views.py          # Views for diagram list/edit
├── templates/        # HTML templates
├── api/              # REST API endpoints
│   ├── serializers.py
│   └── views.py
└── navigation.py     # NetBox menu integration
```

### Phase 4: Network Features
- [ ] Device library (routers, switches, firewalls)
- [ ] Auto-discovery from NetBox devices
- [ ] IP allocation visualization
- [ ] Connection validation
- [ ] Export to various formats

### Phase 5: Advanced Features
- [ ] Version control for diagrams
- [ ] Collaborative editing
- [ ] Change tracking
- [ ] Automated documentation
- [ ] Network simulation

---

## 🚨 Lessons Learned & Pitfalls

### Critical Pitfalls to Avoid

#### 1. Don't Try to Modify Draw.io Core
**What we tried**: Modifying Draw.io's save dialog to add "ArchiFlow Database"
**Why it failed**: Draw.io's code is minified, complex, and updates break modifications
**Correct approach**: Use postMessage protocol to handle save/load externally

#### 2. Database Connection Issues
**Problem**: WebSocket server using mock data instead of real database
**Solution**: Must set `DB_MODE=postgresql` in environment variables
```javascript
// Check connection in logs
docker logs archiflow-backend | grep "Database"
// Should show: "[Database] Running in POSTGRESQL mode"
```

#### 3. XML Parsing Errors
**Problem**: "Not a diagram file" error when loading
**Root cause**: Database column mismatch (diagram_data vs diagram_xml)
**Solution**: Map column names correctly in database layer
```javascript
// In loadDiagram function
return {
    diagram_xml: diagram.diagram_data,  // Map to expected name
    diagram_data: diagram.diagram_data  // Also include original
}
```

#### 4. CSP (Content Security Policy) Issues
**Problem**: NetBox blocks iframe content from different origins
**Solution**: Open Draw.io in popup window instead of iframe
```javascript
// NetBox template
window.open(drawioUrl, 'editor', 'width=1200,height=800');
```

#### 5. Docker File Mounting
**Problem**: Files not updating in container
**Solution**: Use proper volume mounts and restart containers
```yaml
volumes:
  - ./local-folder:/container-path:ro  # :ro for read-only
```

### Small but Important Details

1. **Always check WebSocket connection first**
   ```javascript
   if (ws && ws.readyState === WebSocket.OPEN) {
       // Send message
   } else {
       // Reconnect first
   }
   ```

2. **Use proper CORS headers**
   ```javascript
   res.setHeader('Access-Control-Allow-Origin', '*');
   ```

3. **Handle both string and object messages**
   ```javascript
   const msg = typeof evt.data === 'string' ?
                JSON.parse(evt.data) : evt.data;
   ```

4. **Wait for Draw.io initialization**
   ```javascript
   // Don't send messages immediately
   setTimeout(() => { /* send init */ }, 1000);
   ```

5. **Store diagrams as TEXT not VARCHAR**
   ```sql
   diagram_data TEXT NOT NULL  -- TEXT has no length limit
   ```

---

## 🎯 Best Practices Summary

### Do's ✅
- Use postMessage protocol for all Draw.io communication
- Store complete Draw.io XML without modification
- Use WebSocket for real-time updates
- Implement proper error handling and reconnection
- Use Docker for consistent deployment
- Test with embed.diagrams.net first
- Handle messages from Draw.io asynchronously
- Use UUIDs for diagram identifiers

### Don'ts ❌
- Don't modify Draw.io source code
- Don't use URL parameters for large diagrams
- Don't assume Draw.io is ready immediately
- Don't parse/modify the XML unless necessary
- Don't use mock data in production
- Don't ignore CORS and CSP policies
- Don't store diagrams in cookies or localStorage
- Don't skip health checks in Docker

---

## 🚀 Quick Start Checklist

1. **Set up PostgreSQL with correct schema**
   ```bash
   docker exec -it archiflow-postgres psql -U archiflow_user -d archiflow
   \dt archiflow.*  # Should show diagrams, sites, etc.
   ```

2. **Verify WebSocket is using PostgreSQL**
   ```bash
   docker logs archiflow-backend | grep "POSTGRESQL mode"
   ```

3. **Test postMessage protocol**
   - Open test-postmessage.html
   - Click "Test embed.diagrams.net"
   - Verify init → load → save flow

4. **Check existing data**
   ```sql
   SELECT id, title, LENGTH(diagram_data) FROM archiflow.diagrams;
   ```

5. **Start with embed.diagrams.net**
   - Use for production
   - Fallback to local only for offline development

---

## 📚 Resources & References

### Official Documentation
- [Draw.io Embed Mode](https://www.diagrams.net/doc/faq/embed-mode)
- [Draw.io PostMessage Protocol](https://www.diagrams.net/doc/faq/embed-postmessage)
- [NetBox Plugin Development](https://docs.netbox.dev/en/stable/plugins/development/)

### Working Examples
- `test-postmessage.html` - PostMessage protocol tester
- `integrated-drawio.html` - Full integration example
- `simple-working.html` - Basic save/load implementation

### Database Queries
```sql
-- Find valid diagrams
SELECT id, title, site_name
FROM archiflow.diagrams
WHERE LENGTH(diagram_data) > 100;

-- Check database mode
SHOW search_path;  -- Should include 'archiflow'
```

---

## 💡 Final Recommendations

1. **Start with embed.diagrams.net** - It just works
2. **Build incrementally** - Get save/load working before adding features
3. **Use existing data** - You have 19 diagrams to test with
4. **Monitor everything** - Use debug logs extensively
5. **Document API endpoints** - Future you will thank you
6. **Test in isolation** - Test each component separately first
7. **Version your diagrams** - Implement history from day one
8. **Plan for scale** - Consider performance with 1000+ diagrams

---

*This guide is based on actual implementation experience with ArchiFlow. Every recommendation comes from real debugging sessions and solved problems.*
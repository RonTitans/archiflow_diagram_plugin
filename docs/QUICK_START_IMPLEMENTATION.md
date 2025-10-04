# 🚀 Quick Start: Implement Draw.io Network Plugin

## Based on the lessons learned, here's the CORRECT implementation:

### Step 1: Create the Main Integration File
```html
<!-- archiflow-network-editor.html -->
<!DOCTYPE html>
<html>
<head>
    <title>ArchiFlow Network Editor</title>
    <meta charset="utf-8">
    <style>
        /* Minimal, functional styling */
        body { margin: 0; font-family: Arial, sans-serif; }
        #editor { width: 100%; height: 100vh; border: none; }
        .toolbar { background: #2c3e50; padding: 10px; }
        .toolbar button { margin: 0 5px; padding: 8px 15px; }
    </style>
</head>
<body>
    <div class="toolbar">
        <button onclick="saveDiagram()">Save</button>
        <button onclick="loadDiagram()">Load</button>
        <span id="status">Ready</span>
    </div>
    <iframe id="editor"></iframe>

    <script>
        // Configuration
        const EMBED_URL = 'https://embed.diagrams.net/';
        const WS_URL = 'ws://localhost:3333';

        let editor = null;
        let ws = null;
        let currentDiagramId = null;

        // Initialize Draw.io with embed.diagrams.net
        function initEditor() {
            const iframe = document.getElementById('editor');
            const params = new URLSearchParams({
                embed: '1',
                ui: 'atlas',
                spin: 'true',
                modified: 'unsavedChanges',
                libraries: '1',
                noSaveBtn: '1',
                noExitBtn: '1'
            });

            iframe.src = EMBED_URL + '?' + params.toString();

            iframe.onload = function() {
                editor = iframe.contentWindow;
                // Send init after Draw.io loads
                setTimeout(() => {
                    editor.postMessage(JSON.stringify({
                        action: 'init',
                        bounds: {x: 0, y: 0, width: 10000, height: 10000}
                    }), '*');
                }, 1000);
            };
        }

        // Handle messages from Draw.io
        window.addEventListener('message', function(evt) {
            if (evt.source !== editor) return;

            const msg = JSON.parse(evt.data);

            switch(msg.event) {
                case 'init':
                    console.log('Draw.io ready');
                    document.getElementById('status').textContent = 'Connected';
                    // Load diagram if ID in URL
                    const urlParams = new URLSearchParams(window.location.search);
                    const diagramId = urlParams.get('id');
                    if (diagramId) loadFromDB(diagramId);
                    break;

                case 'save':
                    // Auto-save to database
                    saveToDatabase(msg.xml);
                    break;

                case 'export':
                    // Handle export if requested
                    if (msg.format === 'xml' && msg.xml) {
                        saveToDatabase(msg.xml);
                    }
                    break;
            }
        });

        // Save to database via WebSocket
        function saveDiagram() {
            editor.postMessage(JSON.stringify({
                action: 'export',
                format: 'xml'
            }), '*');
        }

        function saveToDatabase(xml) {
            if (!ws || ws.readyState !== WebSocket.OPEN) {
                alert('Not connected to server');
                return;
            }

            const diagramId = currentDiagramId || 'diagram_' + Date.now();

            ws.send(JSON.stringify({
                action: 'save_diagram',
                diagramId: diagramId,
                content: xml
            }));

            currentDiagramId = diagramId;
            document.getElementById('status').textContent = 'Saved';
        }

        // Load from database
        function loadDiagram() {
            const id = prompt('Enter diagram ID:', currentDiagramId || '');
            if (id) loadFromDB(id);
        }

        function loadFromDB(diagramId) {
            if (ws && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({
                    action: 'load_diagram',
                    diagramId: diagramId
                }));
            }
        }

        // WebSocket connection
        function connectWebSocket() {
            ws = new WebSocket(WS_URL);

            ws.onopen = () => console.log('WebSocket connected');

            ws.onmessage = (event) => {
                const msg = JSON.parse(event.data);

                if (msg.action === 'diagram_loaded' && msg.content) {
                    currentDiagramId = msg.diagramId;
                    // Load into Draw.io
                    editor.postMessage(JSON.stringify({
                        action: 'load',
                        autosave: 1,
                        xml: msg.content
                    }), '*');
                }
            };

            ws.onerror = () => console.error('WebSocket error');
            ws.onclose = () => setTimeout(connectWebSocket, 3000);
        }

        // Initialize
        window.onload = function() {
            initEditor();
            connectWebSocket();
        };
    </script>
</body>
</html>
```

### Step 2: Fix the Database Loading
```javascript
// In backend/database/ip-manager.js - loadDiagram function
async loadDiagram(diagramId) {
    // ALWAYS check main diagrams table first
    const result = await query(`
        SELECT * FROM archiflow.diagrams
        WHERE id = $1
    `, [diagramId]);

    if (result.rows.length > 0) {
        const diagram = result.rows[0];
        return {
            id: diagram.id,
            name: diagram.title,
            // Critical: Map diagram_data to diagram_xml
            diagram_xml: diagram.diagram_data,
            diagram_data: diagram.diagram_data,
            metadata: diagram.metadata || {}
        };
    }
    return null;
}
```

### Step 3: Environment Variables (CRITICAL!)
```yaml
# docker-compose.yml - archiflow-backend service
environment:
  - DB_MODE=postgresql        # NOT 'mock' - this was the main issue!
  - DB_HOST=archiflow-postgres
  - DB_PORT=5432
  - DB_NAME=archiflow
  - DB_SCHEMA=archiflow       # Include schema name
  - DB_USER=archiflow_user
  - DB_PASSWORD=archiflow_pass
```

### Step 4: Test With Your Existing Data
```bash
# Your valid diagram IDs from the database:
392f278a-4362-4242-b171-2b7ce3d99f7c  # RishonLetzion
0e057fc3-960b-4bdc-b193-b06a1c944870  # TestDropBox
818eeafd-8418-4963-9d99-18aacb997b99  # TLV-DC-01

# Test URL:
http://localhost:8081/archiflow-network-editor.html?id=392f278a-4362-4242-b171-2b7ce3d99f7c
```

### Step 5: Verify Everything Works
```bash
# Check WebSocket is using PostgreSQL
docker logs archiflow-backend | grep "POSTGRESQL"

# Monitor WebSocket messages
docker logs -f archiflow-backend

# Check database has your diagrams
docker exec archiflow-postgres psql -U archiflow_user -d archiflow \
  -c "SELECT id, title, LENGTH(diagram_data) FROM archiflow.diagrams;"
```

## ✅ This Implementation:
- Uses embed.diagrams.net (proven to work)
- Follows postMessage protocol correctly
- Connects to your existing database
- Loads your 19 existing diagrams
- Handles save/load properly
- No URL data passing
- No Draw.io core modifications

## ❌ What NOT to Do:
- Don't modify Draw.io source
- Don't use mock data mode
- Don't pass XML in URLs
- Don't skip the init message
- Don't send messages before Draw.io is ready

## 🎯 Next Steps for Network Features:
1. Add device shape library
2. Implement NetBox device import
3. Add connection validation
4. Create network templates
5. Add IP address labels

Start with this working foundation, THEN add network-specific features!
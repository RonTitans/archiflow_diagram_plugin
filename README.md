# ArchiFlow Network Diagram Plugin

A standalone network diagram plugin that integrates Draw.io for creating, editing, and managing network diagrams with PostgreSQL database storage and version control.

## Features

- ✅ **Draw.io Integration**: Embedded diagram editor using postMessage protocol
- ✅ **Database Storage**: PostgreSQL backend for persistent diagram storage
- ✅ **Version Control**: Automatic version history tracking
- ✅ **Real-time Communication**: WebSocket server for instant updates
- ✅ **Docker Support**: Containerized deployment for easy setup
- ✅ **Auto-save**: Automatic diagram saving every 30 seconds
- ✅ **Multiple Diagrams**: Support for multiple sites and diagrams
- ✅ **Network Device Management**: Complete device templates with Cisco switches
- ✅ **IP Address Management**: Automatic IP allocation from pools with auto-naming
- ✅ **VLAN Support**: VLAN configuration and tracking
- ✅ **Device Templates**: Pre-configured network device templates with images

## Quick Start

### Prerequisites

- Docker and Docker Compose
- Node.js 18+ (for local development)
- Modern web browser (Chrome, Firefox, Edge)

### Installation

1. **Clone the repository**:
```bash
git clone https://github.com/RonTitans/archiflow_diagram_plugin.git
cd archiflow_diagram_plugin
```

2. **Start with Docker Compose** (Recommended):
```bash
cd docker
docker-compose up -d
```

This will start:
- PostgreSQL database on port 5432 (with full schema automatically initialized)
- WebSocket backend on port 3333
- Frontend server on port 8081
- Adminer (DB UI) on port 8082
- Draw.io on port 8083

**First-time setup**: The database will automatically:
- Create all required tables (13 tables)
- Load device templates (11 templates including Cisco C9200-24P)
- Create IP pools and VLANs
- Populate 1,270+ IP addresses ready for allocation
- Set up sample sites with auto-naming

3. **Access the application**:
Open your browser and navigate to:
```
http://localhost:8081
```

4. **Clean deployment** (if you need to start fresh):
```bash
cd docker
docker-compose down -v  # Remove all containers and volumes
docker-compose up -d    # Start fresh with clean database
```

### Manual Setup (Without Docker)

1. **Install PostgreSQL**:
   - Create database named `archiflow`
   - Create user `archiflow_user` with password `archiflow_pass`
   - Run the complete initialization script: `database/init-complete.sql`

2. **Start Backend Server**:
```bash
cd backend
npm install
npm start
```

3. **Start Frontend Server**:
```bash
cd frontend
npm install
npm start
```

4. **Access the application**: http://localhost:8081

## Usage

### Basic Operations

1. **Create New Diagram**:
   - Click "New" button in toolbar
   - Start drawing using Draw.io tools
   - Diagram auto-saves every 30 seconds

2. **Save Diagram**:
   - Click "Save" button or press Ctrl+S
   - Diagram is saved to PostgreSQL database

3. **Load Diagram**:
   - Click "Load" button
   - Enter diagram ID or select from recent list
   - Diagram loads into editor

4. **Version History**:
   - Click "Versions" button
   - View all saved versions
   - Load any previous version

### Testing

1. **Test PostMessage Protocol**:
   Open http://localhost:8081/test-postmessage.html
   - Click "Test embed.diagrams.net"
   - Verify initialization and save/load operations

2. **Sample Diagram IDs** (if using sample data):
   - Use the diagram ID from the database after creating your first diagram

## Architecture

```
┌─────────────────────────────────────────┐
│         Frontend (HTML/JS)               │
│    (Draw.io iframe + PostMessage)        │
└────────────────┬────────────────────────┘
                 │ WebSocket
┌────────────────┴────────────────────────┐
│      WebSocket Server (Node.js)          │
│         (Real-time operations)           │
└────────────────┬────────────────────────┘
                 │ SQL
┌────────────────┴────────────────────────┐
│         PostgreSQL Database              │
│      (Diagrams + Version History)        │
└─────────────────────────────────────────┘
```

## File Structure

```
ArchiflowDiagramPlugin/
├── backend/
│   ├── websocket-server.js    # WebSocket server
│   ├── database.js             # Database connection
│   └── package.json            # Backend dependencies
├── frontend/
│   ├── index.html              # Main editor page
│   ├── app.js                  # PostMessage handler
│   ├── styles.css              # UI styles
│   ├── simple-server.js        # Static file server
│   ├── test-postmessage.html   # Protocol tester
│   └── package.json            # Frontend dependencies
├── database/
│   └── schema.sql              # PostgreSQL schema
├── docker/
│   ├── docker-compose.yml      # Container orchestration
│   └── Dockerfile.backend      # Backend container
└── .env                        # Environment config
```

## Configuration

Edit `.env` file to change default settings:

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=archiflow
DB_USER=archiflow_user
DB_PASSWORD=archiflow_pass
WS_PORT=3333
FRONTEND_PORT=8081
```

## Database Schema

The application uses 13 main tables:

**Core Tables:**
- `diagrams`: Stores diagram data and metadata
- `diagram_versions`: Tracks version history
- `sites`: Manages site information with auto-naming codes

**Network Device Tables:**
- `network_devices`: Network device inventory
- `device_templates`: Pre-configured device templates with images
- `device_diagram_mapping`: Maps devices to diagram cells
- `device_counters`: Auto-naming counters per site/device type

**IP Management Tables:**
- `ip_pools`: Network IP pool definitions
- `ip_addresses`: Pre-populated IP addresses for each pool (~1,270 IPs)
- `ip_allocations`: Device IP allocations
- `vlans`: VLAN configurations

**Connection Tables:**
- `port_connections`: Physical device connections
- `schema_migrations`: Database version tracking

## Troubleshooting

### WebSocket Connection Issues
- Verify WebSocket server is running: `docker logs archiflow-backend`
- Check DB_MODE is set to `postgresql` in environment

### Database Connection Failed
- Ensure PostgreSQL is running: `docker ps`
- Verify database credentials in `.env`
- Check database logs: `docker logs archiflow-postgres`

### Draw.io Not Loading
- Clear browser cache
- Verify internet connection (for embed.diagrams.net)
- Check browser console for errors

## Development

### Running Tests
```bash
# Open test page
http://localhost:8081/test-postmessage.html
```

### Viewing Logs
```bash
# WebSocket server logs
docker logs -f archiflow-backend

# Database logs
docker logs -f archiflow-postgres

# Frontend logs
docker logs -f archiflow-frontend
```

### Database Queries
```bash
# Connect to database
docker exec -it archiflow-postgres psql -U archiflow_user -d archiflow

# View diagrams
SELECT id, title, site_name FROM archiflow.diagrams;

# View versions
SELECT * FROM archiflow.diagram_versions WHERE diagram_id = 'YOUR_ID';
```

## Important Notes

1. **CRITICAL**: Always set `DB_MODE=postgresql` in environment variables
2. Use `embed.diagrams.net` for production (not local Draw.io)
3. Store diagrams as TEXT not VARCHAR in database
4. Use postMessage protocol for all Draw.io communication
5. Never modify Draw.io core source code

## License

MIT

## Support

For issues or questions, please refer to the development guides:
- `DRAWIO_NETWORK_PLUGIN_DEVELOPMENT_GUIDE.md`
- `QUICK_START_IMPLEMENTATION.md`
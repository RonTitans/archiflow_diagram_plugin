# ArchiFlow System Architecture

## Table of Contents
1. [Overview](#overview)
2. [Technology Stack](#technology-stack)
3. [Component Architecture](#component-architecture)
4. [Database Schema](#database-schema)
5. [Service Communication](#service-communication)
6. [Docker Network Architecture](#docker-network-architecture)
7. [Security Architecture](#security-architecture)

---

## Overview

ArchiFlow is a standalone web application that provides visual network diagram management with database persistence and IPAM integration. The system uses Draw.io's embed mode for diagram editing and PostgreSQL for data storage.

**Key Design Principles:**
- Separation of concerns (frontend/backend/database)
- Real-time communication via WebSockets
- Database-driven configuration (no hardcoded data)
- Modular architecture for easy integration

---

## Technology Stack

### Frontend
- **Draw.io Embed**: Embedded iframe for diagram editing
- **Vanilla JavaScript**: No framework dependencies for simplicity
- **PostMessage Protocol**: Communication with Draw.io iframe
- **WebSocket Client**: Real-time connection to backend

### Backend
- **Node.js**: JavaScript runtime for server-side logic
- **WebSocket Server (ws)**: Real-time bidirectional communication
- **xml2js**: XML parsing for Draw.io diagram format
- **pg (node-postgres)**: PostgreSQL database client
- **uuid**: UUID generation for entities

### Database
- **PostgreSQL 15**: Relational database with JSONB support
- **INET/CIDR Types**: Network address data types
- **Triggers**: Automatic timestamp updates
- **Functions**: Business logic (IP allocation, device naming)

### Infrastructure
- **Docker**: Containerization for all services
- **Docker Compose**: Multi-container orchestration
- **Adminer**: Web-based database management
- **Nginx (optional)**: Reverse proxy for production

---

## Component Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER BROWSER                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                    Frontend Application                     │ │
│  │                   (index.html + app.js)                     │ │
│  │                                                              │ │
│  │  ┌─────────────────────────┐  ┌──────────────────────────┐ │ │
│  │  │   Draw.io Iframe        │  │   WebSocket Client       │ │ │
│  │  │  (embed.diagrams.net)   │  │   (ws://localhost:3333)  │ │ │
│  │  │                         │  │                          │ │ │
│  │  │  • Diagram Editor       │  │  • Save/Load Commands    │ │ │
│  │  │  • Device Shapes        │  │  • Real-time Updates     │ │ │
│  │  │  • PostMessage Protocol │  │  • Status Notifications  │ │ │
│  │  └─────────────────────────┘  └──────────────────────────┘ │ │
│  │              ↕ postMessage              ↕ WebSocket         │ │
│  └──────────────────────────────────────────────────────────────┘ │
│                                                                   │
└───────────────────────────────────────┬───────────────────────────┘
                                        │
                    ┌───────────────────┴────────────────────┐
                    │                                        │
            ┌───────▼──────────┐                    ┌────────▼────────┐
            │  Static Server   │                    │  WebSocket      │
            │   (port 8081)    │                    │    Server       │
            │                  │                    │  (port 3333)    │
            │  • Serve HTML    │                    │                 │
            │  • Serve JS      │                    │  Core Modules:  │
            │  • Serve Assets  │                    │  ──────────────  │
            └──────────────────┘                    │                 │
                                                     │  • websocket-   │
                                                     │    server.js    │
                                                     │                 │
                                                     │  • diagram-     │
                                                     │    parser.js    │
                                                     │                 │
                                                     │  • device-      │
                                                     │    persistence  │
                                                     │    .js          │
                                                     │                 │
                                                     │  • database.js  │
                                                     │                 │
                                                     └────────┬────────┘
                                                              │
                                                              │ SQL Queries
                                                              │
                                                     ┌────────▼────────┐
                                                     │   PostgreSQL    │
                                                     │   Database      │
                                                     │  (port 5432)    │
                                                     │                 │
                                                     │  Schema:        │
                                                     │  archiflow      │
                                                     │                 │
                                                     │  • diagrams     │
                                                     │  • devices      │
                                                     │  • ip_addresses │
                                                     │  • ip_pools     │
                                                     │  • sites        │
                                                     │  • vlans        │
                                                     │  • etc...       │
                                                     └─────────────────┘
```

---

## Database Schema

### Schema Overview

The ArchiFlow database uses PostgreSQL with the `archiflow` schema containing 13 interconnected tables:

```
┌─────────────────────────────────────────────────────────────────┐
│                        ARCHIFLOW SCHEMA                          │
└─────────────────────────────────────────────────────────────────┘

┌──────────────────┐         ┌──────────────────┐
│   sites          │◄────┬───│  diagrams        │
│────────────────  │     │   │──────────────────│
│ id (PK)          │     │   │ id (PK)          │
│ name             │     │   │ site_id (FK)     │
│ slug             │     │   │ site_name        │
│ site_code        │     │   │ title            │
│ status           │     │   │ diagram_data     │
│ description      │     │   │ status           │
│ metadata         │     │   │ created_at       │
└──────────────────┘     │   │ modified_at      │
                         │   └──────────────────┘
                         │            │
                         │            │ 1:N
                         │            │
                         │   ┌────────▼─────────┐
                         │   │diagram_versions  │
                         │   │──────────────────│
                         │   │ id (PK)          │
                         │   │ diagram_id (FK)  │
                         │   │ version_number   │
                         │   │ diagram_xml      │
                         │   │ created_at       │
                         │   └──────────────────┘
                         │
                         │
                         │   ┌──────────────────┐
                         └───┤network_devices   │
                             │──────────────────│
                             │ id (PK)          │
                             │ site_id (FK)     │
                         ┌───│ name             │
                         │   │ device_type      │
                         │   │ manufacturer     │
                         │   │ model            │
                         │   │ serial_number    │
                         │   │ status           │
                         │   │ metadata         │
                         │   └──────────────────┘
                         │            │
                         │            │ M:N
                         │            │
                         │   ┌────────▼─────────────┐
                         │   │device_diagram_       │
                         │   │mapping               │
                         │   │──────────────────────│
                         │   │ id (PK)              │
                         │   │ device_id (FK)       │
                         │   │ diagram_id (FK)      │
                         │   │ cell_id              │
                         │   │ x_position           │
                         │   │ y_position           │
                         │   │ style                │
                         │   └──────────────────────┘
                         │
                         │
                         │   ┌──────────────────┐
                         ├───┤ ip_pools         │
                         │   │──────────────────│
                         │   │ id (PK)          │
                         │   │ site_id (FK)     │
                         │   │ name             │
                         │   │ network (CIDR)   │
                         │   │ gateway (INET)   │
                         │   │ vlan_id          │
                         │   │ pool_type        │
                         │   └──────────────────┘
                         │            │
                         │            │ 1:N
                         │            │
                         │   ┌────────▼─────────┐
                         │   │ ip_addresses     │
                         │   │──────────────────│
                         │   │ id (PK)          │
                         │   │ pool_id (FK)     │◄──┐
                         │   │ device_id (FK)   │   │
                         │   │ ip_address (INET)│   │
                         │   │ device_name      │   │
                         │   │ is_gateway       │   │
                         │   │ is_reserved      │   │
                         │   │ allocated_at     │   │
                         │   └──────────────────┘   │
                         │                           │
                         └───────────────────────────┘

┌──────────────────┐         ┌──────────────────┐
│ vlans            │         │device_templates  │
│──────────────────│         │──────────────────│
│ id (PK)          │         │ id (PK)          │
│ name             │         │ name             │
│ description      │         │ device_type      │
│ site_id (FK)     │         │ manufacturer     │
│ is_active        │         │ model            │
└──────────────────┘         │ default_ports    │
                             │ port_naming      │
                             │ image_url        │
┌──────────────────┐         │ metadata         │
│port_connections  │         └──────────────────┘
│──────────────────│
│ id (PK)          │         ┌──────────────────┐
│ source_device_id │         │device_counters   │
│ source_port      │         │──────────────────│
│ target_device_id │         │ site_id (FK)     │
│ target_port      │         │ device_type      │
│ connection_type  │         │ prefix           │
│ bandwidth        │         │ last_number      │
│ vlan_ids         │         └──────────────────┘
│ is_trunk         │
└──────────────────┘
```

### Key Relationships

1. **Sites → Diagrams**: One site has many diagrams
2. **Diagrams → Versions**: One diagram has many versions
3. **Sites → Devices**: One site has many devices
4. **Devices ↔ Diagrams**: Many-to-many through `device_diagram_mapping`
5. **Devices → IP Addresses**: One device can have many IPs
6. **IP Pools → IP Addresses**: One pool contains many IPs
7. **Sites → IP Pools**: One site has many IP pools
8. **Sites → VLANs**: One site has many VLANs

### Critical Tables

#### `diagrams`
Stores the complete Draw.io XML for each diagram.

```sql
CREATE TABLE archiflow.diagrams (
    id UUID PRIMARY KEY,
    site_id INTEGER REFERENCES sites(id),
    site_name VARCHAR(255),  -- Denormalized for quick access
    title VARCHAR(255),
    diagram_data TEXT,  -- Full Draw.io XML
    status VARCHAR(50),  -- draft, live, archived
    metadata JSONB,
    created_at TIMESTAMP,
    modified_at TIMESTAMP
);
```

#### `network_devices`
Core device inventory extracted from diagrams.

```sql
CREATE TABLE archiflow.network_devices (
    id UUID PRIMARY KEY,
    name VARCHAR(255),
    device_type VARCHAR(50),  -- router, switch, firewall, etc.
    manufacturer VARCHAR(100),
    model VARCHAR(100),
    serial_number VARCHAR(255) UNIQUE,
    site_id INTEGER REFERENCES sites(id),
    status VARCHAR(50),  -- active, inactive, maintenance, decommissioned
    metadata JSONB
);
```

#### `ip_addresses`
Pre-populated IP addresses from pools with allocation tracking.

```sql
CREATE TABLE archiflow.ip_addresses (
    id UUID PRIMARY KEY,
    pool_id UUID REFERENCES ip_pools(id),
    device_id UUID REFERENCES network_devices(id),
    ip_address INET UNIQUE,
    device_name VARCHAR(255),
    is_gateway BOOLEAN,
    is_reserved BOOLEAN,
    allocated_at TIMESTAMP,
    notes TEXT
);
```

#### `device_diagram_mapping`
Links devices to their visual representation in diagrams.

```sql
CREATE TABLE archiflow.device_diagram_mapping (
    id UUID PRIMARY KEY,
    device_id UUID REFERENCES network_devices(id),
    diagram_id UUID REFERENCES diagrams(id),
    cell_id VARCHAR(255),  -- Draw.io cell ID
    x_position NUMERIC,
    y_position NUMERIC,
    width NUMERIC,
    height NUMERIC,
    style TEXT,  -- Draw.io style string
    UNIQUE(device_id, diagram_id)
);
```

---

## Service Communication

### WebSocket Protocol

The backend WebSocket server uses a JSON-based message protocol:

```javascript
// Message Structure
{
    "action": "string",  // Command type
    "diagramId": "uuid",
    "siteId": 123,
    "content": "...",    // Diagram XML for save operations
    // ... additional action-specific fields
}
```

### Supported Actions

#### Client → Server

1. **getDiagramList**
```json
{
    "action": "getDiagramList"
}
```
Response: Array of all diagrams with metadata

2. **loadDiagram**
```json
{
    "action": "loadDiagram",
    "diagramId": "uuid"
}
```
Response: Complete diagram XML and metadata

3. **saveDiagram**
```json
{
    "action": "saveDiagram",
    "diagramId": "uuid",
    "siteId": 123,
    "title": "Network Diagram",
    "content": "<mxfile>...</mxfile>"
}
```
Response: Success confirmation with device extraction results

4. **getSites**
```json
{
    "action": "getSites"
}
```
Response: Array of all available sites

5. **getDeviceTemplates**
```json
{
    "action": "getDeviceTemplates"
}
```
Response: Array of device templates with image URLs

6. **allocateIP**
```json
{
    "action": "allocateIP",
    "pool_id": "uuid",
    "device_name": "SW-MAIN-01"
}
```
Response: Allocated IP address

#### Server → Client

1. **Status Updates**
```json
{
    "action": "status",
    "message": "Diagram saved successfully"
}
```

2. **Error Messages**
```json
{
    "action": "error",
    "message": "Database connection failed"
}
```

### PostMessage Protocol (Frontend ↔ Draw.io)

Communication with embedded Draw.io iframe:

```javascript
// Frontend → Draw.io
{
    "action": "load",
    "xml": "<mxfile>...</mxfile>",
    "autosave": 1
}

// Draw.io → Frontend
{
    "event": "save",
    "xml": "<mxfile>...</mxfile>"
}

{
    "event": "export",
    "format": "png",
    "data": "base64..."
}
```

---

## Docker Network Architecture

### Container Network Topology

```
┌────────────────────────────────────────────────────────────────┐
│                      HOST MACHINE                              │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │            Docker Bridge Network: archiflow-network       │ │
│  │                    Subnet: 172.18.0.0/16                  │ │
│  │                                                            │ │
│  │  ┌─────────────────┐      ┌─────────────────┐           │ │
│  │  │ archiflow-      │      │ archiflow-      │           │ │
│  │  │ frontend        │      │ backend         │           │ │
│  │  │                 │      │                 │           │ │
│  │  │ IP: 172.18.0.2  │      │ IP: 172.18.0.3  │           │ │
│  │  │ Port: 8081      │      │ Port: 3333      │           │ │
│  │  └─────────────────┘      └────────┬────────┘           │ │
│  │                                     │                     │ │
│  │                                     │ pg client           │ │
│  │                                     ▼                     │ │
│  │  ┌─────────────────┐      ┌─────────────────┐           │ │
│  │  │ archiflow-      │      │ archiflow-      │           │ │
│  │  │ drawio          │      │ postgres        │           │ │
│  │  │                 │      │                 │           │ │
│  │  │ IP: 172.18.0.4  │      │ IP: 172.18.0.5  │           │ │
│  │  │ Port: 8083      │      │ Port: 5432      │           │ │
│  │  └─────────────────┘      └─────────────────┘           │ │
│  │                                     ▲                     │ │
│  │                                     │                     │ │
│  │  ┌─────────────────┐               │ SQL                │ │
│  │  │ archiflow-      │               │                     │ │
│  │  │ adminer         │───────────────┘                     │ │
│  │  │                 │                                     │ │
│  │  │ IP: 172.18.0.6  │                                     │ │
│  │  │ Port: 8082      │                                     │ │
│  │  └─────────────────┘                                     │ │
│  │                                                            │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                 │
│  Port Mappings (Host:Container):                               │
│  • 8081:8081  → Frontend                                       │
│  • 3333:3333  → Backend WebSocket                              │
│  • 5432:5432  → PostgreSQL                                     │
│  • 8082:8080  → Adminer                                        │
│  • 8083:8080  → Draw.io                                        │
└────────────────────────────────────────────────────────────────┘
```

### Container Dependencies

```
archiflow-postgres (no dependencies)
    ↓
archiflow-backend (depends_on: postgres - healthy)
    ↓
archiflow-frontend (depends_on: backend)
archiflow-adminer (depends_on: postgres)
archiflow-drawio (no dependencies)
```

### Healthchecks

**PostgreSQL:**
```yaml
healthcheck:
  test: ["CMD-SHELL", "pg_isready -U archiflow_user -d archiflow"]
  interval: 10s
  timeout: 5s
  retries: 5
```

**Backend:**
```yaml
healthcheck:
  test: ["CMD", "wget", "--spider", "http://localhost:3333/health"]
  interval: 10s
  timeout: 5s
  retries: 3
  start_period: 10s
```

---

## Security Architecture

### Authentication & Authorization

**Current Implementation:**
- No user authentication (single-user/trusted network model)
- Database credentials stored in environment variables
- WebSocket connections open to localhost only

**Production Recommendations:**
1. Implement JWT-based authentication
2. Add role-based access control (RBAC)
3. Integrate with LDAP/Active Directory
4. Use SSL/TLS for all connections

### Network Security

**Docker Network Isolation:**
- Internal bridge network for container communication
- Only necessary ports exposed to host
- Database port should not be exposed in production

**Firewall Rules (Production):**
```bash
# Allow only frontend access from internal network
iptables -A INPUT -p tcp --dport 8081 -s 10.0.0.0/8 -j ACCEPT

# Allow WebSocket from internal network
iptables -A INPUT -p tcp --dport 3333 -s 10.0.0.0/8 -j ACCEPT

# Block database from external access
iptables -A INPUT -p tcp --dport 5432 -j DROP
```

### Data Security

**Database Security:**
1. Separate user for application (archiflow_user) with limited permissions
2. Password stored in environment variables (never in code)
3. Connection pooling to prevent exhaustion
4. Regular backups with encryption

**Diagram Data:**
- Stored as TEXT in PostgreSQL
- Version history for audit trail
- JSONB metadata for flexible storage
- Input sanitization on save operations

### SSL/TLS Configuration (Production)

**Nginx Reverse Proxy:**
```nginx
server {
    listen 443 ssl http2;
    server_name archiflow.company.local;

    ssl_certificate /etc/ssl/certs/archiflow.crt;
    ssl_certificate_key /etc/ssl/private/archiflow.key;

    # Frontend
    location / {
        proxy_pass http://localhost:8081;
    }

    # WebSocket (with upgrade headers)
    location /ws {
        proxy_pass http://localhost:3333;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

---

## Deployment Architecture

### Development Environment

```
Developer Machine
├── Docker Desktop
│   ├── archiflow-frontend (live reload)
│   ├── archiflow-backend (nodemon)
│   ├── archiflow-postgres (persistent volume)
│   ├── archiflow-adminer
│   └── archiflow-drawio
└── Source Code (mounted volumes)
```

### Production Environment (On-Premises)

```
Enterprise Server
├── Docker Engine
│   ├── Nginx Reverse Proxy (SSL termination)
│   ├── ArchiFlow Frontend (static files)
│   ├── ArchiFlow Backend (WebSocket server)
│   ├── PostgreSQL (persistent storage)
│   └── NetBox (IPAM integration)
├── Backup Server (automated backups)
├── Monitoring (Prometheus + Grafana)
└── LDAP/Active Directory (authentication)
```

### High Availability Setup (Optional)

```
Load Balancer (HAProxy/Nginx)
    ↓
┌────────────────┬────────────────┐
│   Node 1       │   Node 2       │
│  Frontend      │  Frontend      │
│  Backend       │  Backend       │
└────────┬───────┴────────┬───────┘
         │                │
         └────────┬───────┘
                  ↓
         PostgreSQL Cluster
         (Primary + Replica)
```

---

## Module Breakdown

### Backend Modules

**websocket-server.js** (Main Server)
- WebSocket connection handling
- Message routing
- Database operations coordination
- Error handling and logging

**diagram-parser.js** (XML Processing)
- Parse Draw.io XML structure
- Extract device information from cells
- Handle HTML-encoded values
- Decode Object metadata

**device-persistence.js** (Database Operations)
- Create/update devices in network_devices
- Link devices to diagrams via device_diagram_mapping
- Update IP allocations with device_id
- Handle database transactions

**database.js** (Database Connection)
- PostgreSQL connection pool
- Query execution wrapper
- Connection health monitoring
- Error handling

### Frontend Modules

**app.js** (Main Application)
- WebSocket client initialization
- PostMessage protocol with Draw.io
- UI event handlers
- Auto-save functionality

**index.html** (Application Shell)
- Draw.io iframe embed
- Control panel UI
- Modal dialogs
- Site/diagram selectors

---

## Performance Considerations

### Database Optimization

1. **Indexes**: Created on frequently queried columns
   - `idx_network_devices_site` for site filtering
   - `idx_ip_addresses_device_id` for device lookups
   - `idx_diagrams_site_id` for diagram queries

2. **Connection Pooling**: Reuse database connections
   ```javascript
   const pool = new Pool({
       max: 20,  // Maximum connections
       idleTimeoutMillis: 30000,
       connectionTimeoutMillis: 2000
   });
   ```

3. **Query Optimization**: Use prepared statements and batch operations

### WebSocket Performance

- Single persistent connection per client
- Binary data transfer for large diagrams (future enhancement)
- Message queue for high-volume operations
- Connection pooling for multiple clients

### Frontend Performance

- Lazy loading of device templates
- Debounced auto-save (30 seconds)
- Minimal DOM manipulation
- Efficient postMessage handling

---

## Future Enhancements

1. **Multi-Tenant Support**: Site-based isolation with user permissions
2. **Real-Time Collaboration**: Multiple users editing same diagram
3. **API Gateway**: REST API for external integrations
4. **Caching Layer**: Redis for frequently accessed data
5. **Microservices**: Separate device management, IP allocation services
6. **Message Queue**: RabbitMQ/Kafka for async operations
7. **GraphQL API**: Flexible data queries for frontend

---

## Conclusion

ArchiFlow's architecture is designed for simplicity, maintainability, and extensibility. The modular design allows for easy integration with external systems like NetBox while maintaining clear separation of concerns. The Docker-based deployment ensures consistency across development and production environments.

For detailed integration with NetBox, see [NETBOX_INTEGRATION.md](./NETBOX_INTEGRATION.md).

For deployment procedures, see [ON_PREMISES_DEPLOYMENT.md](./ON_PREMISES_DEPLOYMENT.md).

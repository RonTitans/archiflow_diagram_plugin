# On-Premises Deployment Guide

## Overview

This guide provides comprehensive instructions for deploying the ArchiFlow + NetBox integrated system entirely on-premises within your company's infrastructure. All components run locally with no external dependencies after initial installation.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [System Requirements](#system-requirements)
3. [Deployment Options](#deployment-options)
4. [Docker Compose Deployment](#docker-compose-deployment)
5. [Network Configuration](#network-configuration)
6. [Security Setup](#security-setup)
7. [User Authentication](#user-authentication)
8. [Backup & Disaster Recovery](#backup--disaster-recovery)
9. [Monitoring & Maintenance](#monitoring--maintenance)
10. [Troubleshooting](#troubleshooting)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                   COMPANY INTERNAL NETWORK                           │
│                   (Private IP Range: 10.0.0.0/8)                    │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │              APPLICATION SERVER (Linux)                     │   │
│  │              IP: 10.100.50.10                               │   │
│  ├────────────────────────────────────────────────────────────┤   │
│  │                                                             │   │
│  │  ┌──────────────────┐        ┌──────────────────────┐     │   │
│  │  │  ARCHIFLOW       │        │  NETBOX              │     │   │
│  │  │  CONTAINER STACK │◄──────►│  CONTAINER STACK     │     │   │
│  │  ├──────────────────┤        ├──────────────────────┤     │   │
│  │  │ • Nginx :8081    │        │ • Nginx :8000        │     │   │
│  │  │ • Node.js :3333  │  HTTP  │ • Django             │     │   │
│  │  │ • PostgreSQL     │  API   │ • PostgreSQL         │     │   │
│  │  │ • Draw.io        │        │ • Redis              │     │   │
│  │  └──────────────────┘        └──────────────────────┘     │   │
│  │                                                             │   │
│  │  ┌────────────────────────────────────────────────────┐   │   │
│  │  │  Docker Network Bridge: 172.20.0.0/16              │   │   │
│  │  │  • archiflow-frontend: 172.20.0.10                 │   │   │
│  │  │  • archiflow-backend:  172.20.0.11                 │   │   │
│  │  │  • archiflow-postgres: 172.20.0.12                 │   │   │
│  │  │  • netbox:             172.20.0.20                 │   │   │
│  │  │  • netbox-postgres:    172.20.0.21                 │   │   │
│  │  │  • netbox-redis:       172.20.0.22                 │   │   │
│  │  └────────────────────────────────────────────────────┘   │   │
│  └────────────────────────────────────────────────────────────┘   │
│                              ↑                                      │
│                              │ LAN Access                           │
│  ┌───────────────────────────┴────────────────────────────────┐   │
│  │              REVERSE PROXY (Optional)                       │   │
│  │              Nginx/HAProxy with SSL                         │   │
│  │              https://archiflow.company.local                │   │
│  │              https://netbox.company.local                   │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                              ↑                                      │
│                              │                                      │
│  ┌───────────────────────────┴────────────────────────────────┐   │
│  │              USER WORKSTATIONS                              │   │
│  │              • Network Engineers                            │   │
│  │              • System Administrators                        │   │
│  │              • IT Operations Team                           │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │              AUTHENTICATION (Optional)                       │   │
│  │              • LDAP/Active Directory Server                  │   │
│  │              • IP: 10.100.50.5                               │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │              BACKUP SERVER                                   │   │
│  │              • Daily PostgreSQL dumps                        │   │
│  │              • Automated backup scripts                      │   │
│  │              • IP: 10.100.50.100                             │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘

                              FIREWALL
                 (No outbound internet access required)
```

---

## System Requirements

### Minimum Requirements (Small Deployment)

**Single Server:**
- **CPU:** 4 cores (2.5 GHz+)
- **RAM:** 16 GB
- **Storage:** 200 GB SSD
- **OS:** Ubuntu 22.04 LTS, Rocky Linux 9, or similar
- **Network:** 1 Gbps NIC

**Supports:** ~50 devices, 5 concurrent users

### Recommended Requirements (Production)

**Single Server:**
- **CPU:** 8 cores (3.0 GHz+)
- **RAM:** 32 GB
- **Storage:** 500 GB SSD (RAID 1 recommended)
- **OS:** Ubuntu 22.04 LTS (recommended)
- **Network:** 1 Gbps NIC

**Supports:** ~500 devices, 20+ concurrent users

### Enterprise Requirements (High Availability)

**Multi-Server Cluster:**
- **Application Servers:** 2x (load balanced)
- **Database Server:** 1x (with replication)
- **Each Server:**
  - CPU: 16 cores
  - RAM: 64 GB
  - Storage: 1 TB SSD (RAID 10)

**Supports:** 1000+ devices, 100+ concurrent users

### Software Prerequisites

All servers require:
- **Docker Engine:** 24.0+
- **Docker Compose:** 2.20+
- **Git:** 2.30+ (for initial clone)
- **OpenSSL:** 1.1.1+ (for SSL certificates)

Optional:
- **Nginx/HAProxy** (if using reverse proxy)
- **LDAP client libraries** (for AD integration)

---

## Deployment Options

### Option 1: Single-Server Docker Compose (Recommended)

**Best for:** Most deployments, easy to manage

**Pros:**
- ✅ Simple setup (one command)
- ✅ All components on one machine
- ✅ Easy backup/restore
- ✅ Low maintenance

**Cons:**
- ⚠️ Single point of failure
- ⚠️ Limited scalability

### Option 2: Multi-Server with Separate Databases

**Best for:** High availability requirements

**Pros:**
- ✅ Database isolation
- ✅ Independent scaling
- ✅ Better performance

**Cons:**
- ⚠️ More complex setup
- ⚠️ Higher resource usage

### Option 3: Kubernetes/Docker Swarm

**Best for:** Enterprise deployments, large scale

**Pros:**
- ✅ High availability
- ✅ Auto-scaling
- ✅ Rolling updates
- ✅ Service discovery

**Cons:**
- ⚠️ Complex infrastructure
- ⚠️ Requires K8s expertise

---

## Docker Compose Deployment

This is the **recommended approach** for most on-premises deployments.

### Step 1: Prepare the Server

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
newgrp docker

# Install Docker Compose
sudo apt install docker-compose-plugin -y

# Verify installation
docker --version
docker compose version
```

### Step 2: Clone Repository

```bash
# Clone ArchiFlow repository
cd /opt
sudo git clone https://github.com/RonTitans/archiflow_diagram_plugin.git
cd archiflow_diagram_plugin
```

### Step 3: Configure Environment

Create unified environment file:

```bash
# Create environment file
sudo nano /opt/archiflow_diagram_plugin/.env
```

```bash
# ===== ARCHIFLOW CONFIGURATION =====
ARCHIFLOW_URL=http://10.100.50.10:8081
DB_MODE=postgresql
DB_HOST=archiflow-postgres
DB_PORT=5432
DB_NAME=archiflow
DB_USER=archiflow_user
DB_PASSWORD=CHANGE_ME_SECURE_PASSWORD_1
DB_SCHEMA=archiflow
WS_PORT=3333
NODE_ENV=production

# ===== NETBOX CONFIGURATION =====
NETBOX_URL=http://10.100.50.10:8000
NETBOX_TOKEN=  # Will be generated after NetBox setup
NETBOX_SUPERUSER_NAME=admin
NETBOX_SUPERUSER_EMAIL=admin@company.local
NETBOX_SUPERUSER_PASSWORD=CHANGE_ME_SECURE_PASSWORD_2
NETBOX_SUPERUSER_API_TOKEN=  # Will be auto-generated
NETBOX_SECRET_KEY=CHANGE_ME_RANDOM_50_CHARS
NETBOX_DB_HOST=netbox-postgres
NETBOX_DB_NAME=netbox
NETBOX_DB_USER=netbox
NETBOX_DB_PASSWORD=CHANGE_ME_SECURE_PASSWORD_3
NETBOX_REDIS_HOST=netbox-redis
NETBOX_REDIS_PORT=6379

# ===== LDAP CONFIGURATION (Optional) =====
# LDAP_SERVER_URI=ldap://10.100.50.5
# LDAP_BIND_DN=CN=netbox,OU=ServiceAccounts,DC=company,DC=local
# LDAP_BIND_PASSWORD=CHANGE_ME_LDAP_PASSWORD
# LDAP_USER_SEARCH_BASE=OU=Users,DC=company,DC=local
```

**Security Note:** Generate secure passwords:
```bash
# Generate random passwords
openssl rand -base64 32

# Generate NetBox secret key
python3 -c "import secrets; print(secrets.token_urlsafe(50))"
```

### Step 4: Create Unified Docker Compose File

```bash
sudo nano /opt/archiflow_diagram_plugin/docker-compose.production.yml
```

```yaml
version: '3.8'

networks:
  archiflow-netbox-network:
    driver: bridge
    ipam:
      config:
        - subnet: 172.20.0.0/16

volumes:
  archiflow-postgres-data:
  netbox-postgres-data:
  netbox-redis-data:
  netbox-media-files:
  netbox-reports-files:
  netbox-scripts-files:

services:
  # ===== ARCHIFLOW SERVICES =====
  archiflow-postgres:
    image: postgres:15-alpine
    container_name: archiflow-postgres
    networks:
      archiflow-netbox-network:
        ipv4_address: 172.20.0.12
    environment:
      POSTGRES_DB: ${DB_NAME}
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - archiflow-postgres-data:/var/lib/postgresql/data
      - ./database/init-complete.sql:/docker-entrypoint-initdb.d/init.sql:ro
    restart: unless-stopped
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_USER}"]
      interval: 10s
      timeout: 5s
      retries: 5

  archiflow-backend:
    build:
      context: ./backend
      dockerfile: ../docker/Dockerfile.backend
    container_name: archiflow-backend
    networks:
      archiflow-netbox-network:
        ipv4_address: 172.20.0.11
    environment:
      DB_MODE: ${DB_MODE}
      DB_HOST: ${DB_HOST}
      DB_PORT: ${DB_PORT}
      DB_NAME: ${DB_NAME}
      DB_SCHEMA: ${DB_SCHEMA}
      DB_USER: ${DB_USER}
      DB_PASSWORD: ${DB_PASSWORD}
      WS_PORT: ${WS_PORT}
      NODE_ENV: ${NODE_ENV}
      NETBOX_URL: ${NETBOX_URL}
      NETBOX_TOKEN: ${NETBOX_TOKEN}
    ports:
      - "3333:3333"
    depends_on:
      archiflow-postgres:
        condition: service_healthy
    restart: unless-stopped

  archiflow-frontend:
    build:
      context: ./frontend
      dockerfile: ../docker/Dockerfile.frontend
    container_name: archiflow-frontend
    networks:
      archiflow-netbox-network:
        ipv4_address: 172.20.0.10
    ports:
      - "8081:8081"
    depends_on:
      - archiflow-backend
    restart: unless-stopped

  archiflow-drawio:
    image: jgraph/drawio:latest
    container_name: archiflow-drawio
    networks:
      - archiflow-netbox-network
    ports:
      - "8083:8080"
    restart: unless-stopped

  # ===== NETBOX SERVICES =====
  netbox-postgres:
    image: postgres:15-alpine
    container_name: netbox-postgres
    networks:
      archiflow-netbox-network:
        ipv4_address: 172.20.0.21
    environment:
      POSTGRES_DB: ${NETBOX_DB_NAME}
      POSTGRES_USER: ${NETBOX_DB_USER}
      POSTGRES_PASSWORD: ${NETBOX_DB_PASSWORD}
    volumes:
      - netbox-postgres-data:/var/lib/postgresql/data
    restart: unless-stopped
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${NETBOX_DB_USER}"]
      interval: 10s
      timeout: 5s
      retries: 5

  netbox-redis:
    image: redis:7-alpine
    container_name: netbox-redis
    networks:
      archiflow-netbox-network:
        ipv4_address: 172.20.0.22
    command: redis-server --appendonly yes
    volumes:
      - netbox-redis-data:/data
    restart: unless-stopped

  netbox-redis-cache:
    image: redis:7-alpine
    container_name: netbox-redis-cache
    networks:
      - archiflow-netbox-network
    command: redis-server
    restart: unless-stopped

  netbox:
    image: netboxcommunity/netbox:latest
    container_name: netbox
    networks:
      archiflow-netbox-network:
        ipv4_address: 172.20.0.20
    ports:
      - "8000:8080"
    environment:
      SUPERUSER_NAME: ${NETBOX_SUPERUSER_NAME}
      SUPERUSER_EMAIL: ${NETBOX_SUPERUSER_EMAIL}
      SUPERUSER_PASSWORD: ${NETBOX_SUPERUSER_PASSWORD}
      SUPERUSER_API_TOKEN: ${NETBOX_SUPERUSER_API_TOKEN}
      SECRET_KEY: ${NETBOX_SECRET_KEY}
      DB_HOST: ${NETBOX_DB_HOST}
      DB_NAME: ${NETBOX_DB_NAME}
      DB_USER: ${NETBOX_DB_USER}
      DB_PASSWORD: ${NETBOX_DB_PASSWORD}
      REDIS_HOST: ${NETBOX_REDIS_HOST}
      REDIS_PORT: ${NETBOX_REDIS_PORT}
      REDIS_CACHE_HOST: netbox-redis-cache
      REDIS_CACHE_PORT: 6379
    volumes:
      - netbox-media-files:/opt/netbox/netbox/media
      - netbox-reports-files:/opt/netbox/netbox/reports
      - netbox-scripts-files:/opt/netbox/netbox/scripts
    depends_on:
      netbox-postgres:
        condition: service_healthy
      netbox-redis:
        condition: service_started
      netbox-redis-cache:
        condition: service_started
    restart: unless-stopped

  netbox-worker:
    image: netboxcommunity/netbox:latest
    container_name: netbox-worker
    networks:
      - archiflow-netbox-network
    command: /opt/netbox/venv/bin/python /opt/netbox/netbox/manage.py rqworker
    environment:
      SECRET_KEY: ${NETBOX_SECRET_KEY}
      DB_HOST: ${NETBOX_DB_HOST}
      DB_NAME: ${NETBOX_DB_NAME}
      DB_USER: ${NETBOX_DB_USER}
      DB_PASSWORD: ${NETBOX_DB_PASSWORD}
      REDIS_HOST: ${NETBOX_REDIS_HOST}
      REDIS_PORT: ${NETBOX_REDIS_PORT}
      REDIS_CACHE_HOST: netbox-redis-cache
      REDIS_CACHE_PORT: 6379
    volumes:
      - netbox-media-files:/opt/netbox/netbox/media
      - netbox-reports-files:/opt/netbox/netbox/reports
      - netbox-scripts-files:/opt/netbox/netbox/scripts
    depends_on:
      - netbox
    restart: unless-stopped

  # ===== OPTIONAL: ADMINER FOR DATABASE MANAGEMENT =====
  adminer:
    image: adminer:latest
    container_name: adminer
    networks:
      - archiflow-netbox-network
    ports:
      - "8082:8080"
    environment:
      ADMINER_DEFAULT_SERVER: archiflow-postgres
    restart: unless-stopped
```

### Step 5: Start Services

```bash
# Start all services
cd /opt/archiflow_diagram_plugin
sudo docker compose -f docker-compose.production.yml up -d

# Wait for services to initialize (2-3 minutes)
sleep 180

# Check service status
sudo docker compose -f docker-compose.production.yml ps

# View logs
sudo docker compose -f docker-compose.production.yml logs -f
```

### Step 6: Verify Deployment

```bash
# Check ArchiFlow
curl http://10.100.50.10:8081

# Check NetBox
curl http://10.100.50.10:8000

# Check databases
sudo docker exec archiflow-postgres pg_isready -U archiflow_user
sudo docker exec netbox-postgres pg_isready -U netbox
```

**Access URLs:**
- ArchiFlow: `http://10.100.50.10:8081`
- NetBox: `http://10.100.50.10:8000`
- Adminer (DB UI): `http://10.100.50.10:8082`

**Default NetBox Login:**
- Username: `admin` (from `.env`)
- Password: Set in `NETBOX_SUPERUSER_PASSWORD`

### Step 7: Generate NetBox API Token

1. Log into NetBox: `http://10.100.50.10:8000`
2. Navigate to: User Icon (top right) → Profile → API Tokens
3. Click "Add Token"
4. Enable "Write enabled"
5. Copy token
6. Update `.env` file:
   ```bash
   NETBOX_TOKEN=your_generated_token_here
   ```
7. Restart ArchiFlow backend:
   ```bash
   sudo docker compose -f docker-compose.production.yml restart archiflow-backend
   ```

---

## Network Configuration

### Firewall Rules

**Internal Access Only:**
```bash
# Allow from company network (example: 10.0.0.0/8)
sudo ufw allow from 10.0.0.0/8 to any port 8081 proto tcp comment 'ArchiFlow'
sudo ufw allow from 10.0.0.0/8 to any port 8000 proto tcp comment 'NetBox'
sudo ufw allow from 10.0.0.0/8 to any port 3333 proto tcp comment 'ArchiFlow WebSocket'

# Block all external access
sudo ufw default deny incoming
sudo ufw default allow outgoing

# Enable firewall
sudo ufw enable
```

### DNS Configuration

Add internal DNS records:
```
# /etc/hosts or company DNS server
10.100.50.10  archiflow.company.local
10.100.50.10  netbox.company.local
```

### Reverse Proxy (Optional)

For SSL termination and unified access point:

```nginx
# /etc/nginx/sites-available/archiflow-netbox
upstream archiflow {
    server 127.0.0.1:8081;
}

upstream netbox {
    server 127.0.0.1:8000;
}

server {
    listen 443 ssl http2;
    server_name archiflow.company.local;

    ssl_certificate /etc/nginx/ssl/company.crt;
    ssl_certificate_key /etc/nginx/ssl/company.key;

    location / {
        proxy_pass http://archiflow;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /ws {
        proxy_pass http://127.0.0.1:3333;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}

server {
    listen 443 ssl http2;
    server_name netbox.company.local;

    ssl_certificate /etc/nginx/ssl/company.crt;
    ssl_certificate_key /etc/nginx/ssl/company.key;

    client_max_body_size 25m;

    location / {
        proxy_pass http://netbox;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

## Security Setup

### SSL Certificates

**Option 1: Internal CA Certificate**
```bash
# Generate private key
openssl genrsa -out company.key 2048

# Generate CSR
openssl req -new -key company.key -out company.csr \
  -subj "/C=US/ST=State/L=City/O=Company/CN=*.company.local"

# Sign with internal CA (submit to your company's CA)
# Receive company.crt back
```

**Option 2: Self-Signed (Development Only)**
```bash
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout company.key -out company.crt \
  -subj "/CN=*.company.local"
```

### Database Encryption

Enable PostgreSQL SSL:
```yaml
# docker-compose.production.yml
archiflow-postgres:
  command: >
    postgres
    -c ssl=on
    -c ssl_cert_file=/etc/ssl/certs/server.crt
    -c ssl_key_file=/etc/ssl/private/server.key
  volumes:
    - ./ssl/server.crt:/etc/ssl/certs/server.crt:ro
    - ./ssl/server.key:/etc/ssl/private/server.key:ro
```

### Container Security

```yaml
# Add security options to all services
services:
  archiflow-backend:
    security_opt:
      - no-new-privileges:true
    read_only: true
    tmpfs:
      - /tmp
    cap_drop:
      - ALL
    cap_add:
      - NET_BIND_SERVICE
```

---

## User Authentication

### LDAP/Active Directory Integration

NetBox supports LDAP authentication out of the box.

**1. Create LDAP Configuration:**

```bash
# Create configuration file
sudo nano /opt/archiflow_diagram_plugin/netbox-ldap.py
```

```python
import ldap
from django_auth_ldap.config import LDAPSearch, GroupOfNamesType

# LDAP Server
AUTH_LDAP_SERVER_URI = "ldap://10.100.50.5"
AUTH_LDAP_BIND_DN = "CN=netbox,OU=ServiceAccounts,DC=company,DC=local"
AUTH_LDAP_BIND_PASSWORD = "LDAP_PASSWORD"

# User Search
AUTH_LDAP_USER_SEARCH = LDAPSearch(
    "OU=Users,DC=company,DC=local",
    ldap.SCOPE_SUBTREE,
    "(sAMAccountName=%(user)s)"
)

# User Attributes
AUTH_LDAP_USER_ATTR_MAP = {
    "first_name": "givenName",
    "last_name": "sn",
    "email": "mail"
}

# Group Permissions
AUTH_LDAP_GROUP_SEARCH = LDAPSearch(
    "OU=Groups,DC=company,DC=local",
    ldap.SCOPE_SUBTREE,
    "(objectClass=group)"
)

AUTH_LDAP_GROUP_TYPE = GroupOfNamesType()

# Map LDAP groups to NetBox permissions
AUTH_LDAP_USER_FLAGS_BY_GROUP = {
    "is_staff": "CN=NetBox Users,OU=Groups,DC=company,DC=local",
    "is_superuser": "CN=NetBox Admins,OU=Groups,DC=company,DC=local"
}

# Cache LDAP lookups for 1 hour
AUTH_LDAP_CACHE_TIMEOUT = 3600
```

**2. Mount LDAP Config:**

```yaml
# docker-compose.production.yml
netbox:
  volumes:
    - ./netbox-ldap.py:/etc/netbox/config/ldap_config.py:ro
```

**3. Enable LDAP in NetBox:**

```bash
# Add to .env
REMOTE_AUTH_ENABLED=True
REMOTE_AUTH_BACKEND=netbox.authentication.LDAPBackend
```

**4. Restart NetBox:**
```bash
sudo docker compose -f docker-compose.production.yml restart netbox
```

### User Roles

**NetBox Permissions:**
- **Network Engineers**: Read/Write devices, IPs, sites
- **Operations Team**: Read-only access
- **Admins**: Full access including user management

**ArchiFlow Permissions** (future feature):
- **Diagram Editors**: Create/edit diagrams
- **Deployers**: Can deploy to NetBox
- **Viewers**: Read-only diagram access

---

## Backup & Disaster Recovery

### Automated Backup Script

```bash
#!/bin/bash
# /opt/backups/backup-archiflow-netbox.sh

BACKUP_DIR="/opt/backups"
DATE=$(date +%Y%m%d_%H%M%S)

# Backup ArchiFlow database
docker exec archiflow-postgres pg_dump -U archiflow_user archiflow | \
  gzip > "$BACKUP_DIR/archiflow_db_$DATE.sql.gz"

# Backup NetBox database
docker exec netbox-postgres pg_dump -U netbox netbox | \
  gzip > "$BACKUP_DIR/netbox_db_$DATE.sql.gz"

# Backup NetBox media files
tar -czf "$BACKUP_DIR/netbox_media_$DATE.tar.gz" \
  -C /var/lib/docker/volumes/archiflow_diagram_plugin_netbox-media-files/_data .

# Keep only last 30 days
find "$BACKUP_DIR" -name "*.gz" -mtime +30 -delete

echo "Backup completed: $DATE"
```

**Schedule Daily Backups:**
```bash
# Add to crontab
sudo crontab -e

# Run daily at 2 AM
0 2 * * * /opt/backups/backup-archiflow-netbox.sh >> /var/log/backup.log 2>&1
```

### Restore Procedure

```bash
# Stop services
cd /opt/archiflow_diagram_plugin
sudo docker compose -f docker-compose.production.yml down

# Restore ArchiFlow database
gunzip < /opt/backups/archiflow_db_YYYYMMDD_HHMMSS.sql.gz | \
  docker exec -i archiflow-postgres psql -U archiflow_user archiflow

# Restore NetBox database
gunzip < /opt/backups/netbox_db_YYYYMMDD_HHMMSS.sql.gz | \
  docker exec -i netbox-postgres psql -U netbox netbox

# Restore NetBox media
tar -xzf /opt/backups/netbox_media_YYYYMMDD_HHMMSS.tar.gz \
  -C /var/lib/docker/volumes/archiflow_diagram_plugin_netbox-media-files/_data

# Restart services
sudo docker compose -f docker-compose.production.yml up -d
```

---

## Monitoring & Maintenance

### Health Checks

```bash
#!/bin/bash
# /opt/scripts/health-check.sh

# Check ArchiFlow
if curl -sf http://localhost:8081 > /dev/null; then
    echo "✓ ArchiFlow is healthy"
else
    echo "✗ ArchiFlow is down"
fi

# Check NetBox
if curl -sf http://localhost:8000 > /dev/null; then
    echo "✓ NetBox is healthy"
else
    echo "✗ NetBox is down"
fi

# Check databases
docker exec archiflow-postgres pg_isready -U archiflow_user
docker exec netbox-postgres pg_isready -U netbox

# Check disk space
df -h /var/lib/docker
```

### Log Management

```bash
# View logs
sudo docker compose -f docker-compose.production.yml logs -f --tail=100 archiflow-backend
sudo docker compose -f docker-compose.production.yml logs -f --tail=100 netbox

# Configure log rotation
sudo nano /etc/docker/daemon.json
```

```json
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  }
}
```

### Updates

```bash
# Update ArchiFlow
cd /opt/archiflow_diagram_plugin
sudo git pull origin main
sudo docker compose -f docker-compose.production.yml build
sudo docker compose -f docker-compose.production.yml up -d

# Update NetBox
sudo docker pull netboxcommunity/netbox:latest
sudo docker compose -f docker-compose.production.yml up -d netbox
```

---

## Troubleshooting

### Common Issues

#### Services Won't Start

```bash
# Check Docker daemon
sudo systemctl status docker

# Check container logs
sudo docker compose -f docker-compose.production.yml logs

# Check resource usage
docker stats

# Check disk space
df -h
```

#### Database Connection Errors

```bash
# Test database connection
docker exec archiflow-backend nc -zv archiflow-postgres 5432

# Check database logs
docker logs archiflow-postgres

# Verify credentials
docker exec archiflow-postgres psql -U archiflow_user -d archiflow -c "SELECT 1;"
```

#### NetBox API Errors

```bash
# Test API connection
curl -H "Authorization: Token YOUR_TOKEN" http://localhost:8000/api/

# Check NetBox logs
docker logs netbox

# Verify token permissions
# Log into NetBox UI → Profile → API Tokens → Check "Write enabled"
```

#### Performance Issues

```bash
# Check resource usage
docker stats

# Increase container resources
# Edit docker-compose.production.yml
services:
  netbox:
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 4G
```

---

## Air-Gapped Deployment

For environments with **no internet access**:

### 1. Pre-Download Docker Images

**On internet-connected machine:**
```bash
# Pull images
docker pull postgres:15-alpine
docker pull redis:7-alpine
docker pull netboxcommunity/netbox:latest
docker pull jgraph/drawio:latest
docker pull adminer:latest

# Save images
docker save postgres:15-alpine | gzip > postgres.tar.gz
docker save redis:7-alpine | gzip > redis.tar.gz
docker save netboxcommunity/netbox:latest | gzip > netbox.tar.gz
docker save jgraph/drawio:latest | gzip > drawio.tar.gz
docker save adminer:latest | gzip > adminer.tar.gz

# Transfer files to air-gapped server (USB, internal network, etc.)
```

**On air-gapped server:**
```bash
# Load images
docker load < postgres.tar.gz
docker load < redis.tar.gz
docker load < netbox.tar.gz
docker load < drawio.tar.gz
docker load < adminer.tar.gz

# Proceed with normal deployment
```

### 2. Install Dependencies Offline

```bash
# On internet-connected machine
apt-get download docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Transfer .deb files to air-gapped server
sudo dpkg -i *.deb
```

---

## Next Steps

After successful deployment:

1. **Configure NetBox:**
   - Create sites, device types, device roles
   - Configure IP pools and VLANs
   - Set up user accounts

2. **Configure ArchiFlow:**
   - Add NetBox API token
   - Configure site mappings
   - Test single device deployment

3. **Train Users:**
   - Network diagram creation
   - Device management
   - Deployment workflow

4. **Set Up Monitoring:**
   - Enable health checks
   - Configure alerting
   - Set up log aggregation

5. **Document Your Setup:**
   - Server IPs and hostnames
   - Credentials (store securely)
   - Custom configurations
   - Contact information

---

## Support & Resources

- **ArchiFlow Repository:** https://github.com/RonTitans/archiflow_diagram_plugin
- **NetBox Documentation:** https://docs.netbox.dev/
- **Docker Documentation:** https://docs.docker.com/

---

**Document Version:** 1.0
**Last Updated:** October 8, 2024
**Target Platform:** On-Premises Linux Servers

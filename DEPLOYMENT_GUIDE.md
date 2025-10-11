# ArchiFlow Network Diagram Plugin - Deployment Guide

## 🚀 Quick Start (Fresh Deployment)

This guide ensures a smooth deployment with all recent improvements integrated.

### Prerequisites

- Docker & Docker Compose installed
- NetBox v4.0+ instance running (optional but recommended)
- Ports available: 3333 (backend), 8081 (frontend), 5432 (postgres), 8082 (adminer)

---

## 📋 Step-by-Step Deployment

### 1. Clone Repository

```bash
git clone <repository-url>
cd archiflow_diagram_plugin-main
```

### 2. Configure NetBox Connection (Optional)

Edit `backend/.env` or set environment variables in `docker/docker-compose.yml`:

```env
# NetBox Configuration
NETBOX_URL=http://netbox:8080  # or your NetBox URL
NETBOX_TOKEN=your_netbox_api_token_here
```

### 3. Start All Services

```bash
cd docker
docker-compose up -d
```

This will automatically:
- ✅ Create PostgreSQL database with complete schema
- ✅ Initialize NetBox cache tables
- ✅ Start WebSocket backend server
- ✅ Start frontend file server
- ✅ Start Adminer (database UI)

### 4. Verify Services are Running

```bash
docker-compose ps
```

All services should show `Up` and `healthy`:
```
archiflow-backend    Up (healthy)
archiflow-frontend   Up
archiflow-postgres   Up (healthy)
archiflow-adminer    Up
```

### 5. Sync NetBox Data (If Using NetBox)

```bash
curl -X POST http://localhost:3333/api/netbox/sync
```

This syncs:
- Sites
- Device Types & Roles
- IP Prefixes (IP Pools)
- VLANs
- **Existing Devices** (for name collision detection)
- **IP Addresses** (for allocation tracking)

### 6. Access ArchiFlow

Open browser to: **http://localhost:8081**

---

## 🔧 Recent Improvements (What's Fixed)

### ✅ Bug #1: Device Disappears After Switching Diagrams
**Fix**: Auto-save diagram before deployment
- Location: `frontend/app.js` (lines 905-917)
- Behavior: Diagram is saved automatically when you click Deploy

### ✅ Bug #2: Duplicate Device Names
**Fix**: Check NetBox + local database before naming
- Backend: `backend/network-device-manager.js` (lines 764-818)
- Frontend: `frontend/archiflow-network-plugin.js` (lines 31-110)
- WebSocket handler: `backend/websocket-server.js` (lines 1231-1263)
- Behavior: Devices are named uniquely (e.g., SW-MAIN-01, SW-MAIN-02, SW-MAIN-03)

### ✅ Bug #3: Allocated IPs Show as Available
**Fix**: Query NetBox cache for real-time IP status
- Location: `backend/network-device-manager.js` (lines 595-610)
- Behavior: IPs allocated in NetBox show as unavailable in ArchiFlow

### ✅ Bug #4: Deployment Status Not Showing
**Fix**: Update `deployment_status` column correctly
- Location: `backend/netbox/deployment-service.js` (lines 417-456)
- Behavior: Diagrams show "Deployed" status after successful deployment

### ✅ NetBox Real-Time Integration
**New Feature**: Sync devices and IPs from NetBox
- Sync service: `backend/netbox/sync-service.js` (lines 428-568)
- Cache tables: `database/netbox-devices-ips-cache.sql`
- Behavior: Device names and IP allocations reflect NetBox state

---

## 📊 Database Schema

### Core Tables
- `diagrams` - Diagram metadata and XML data
- `diagram_versions` - Version history
- `sites` - Site/location information
- `network_devices` - Device inventory
- `ip_addresses` - IP allocation tracking
- `vlans` - VLAN configuration

### NetBox Cache Tables (New!)
- `netbox_sites` - Synced sites from NetBox
- `netbox_device_types` - Device type catalog
- `netbox_device_roles` - Device role definitions
- `netbox_prefixes` - IP prefixes/pools
- `netbox_vlans` - VLAN definitions
- `netbox_devices` - **Existing devices for name checking**
- `netbox_ip_addresses` - **IP allocations for availability**
- `netbox_sync_status` - Sync tracking

---

## 🔄 NetBox Sync Schedule (Recommended)

For production, set up periodic sync to keep cache fresh:

### Option 1: Cron Job
```bash
# Every 15 minutes
*/15 * * * * curl -X POST http://localhost:3333/api/netbox/sync

# Or every hour
0 * * * * curl -X POST http://localhost:3333/api/netbox/sync
```

### Option 2: NetBox Webhook (Future Enhancement)
Configure NetBox to POST to `http://archiflow:3333/api/netbox/sync` on:
- Device create/update/delete
- IP address assignment/removal
- VLAN/Prefix changes

---

## 🐛 Troubleshooting

### Issue: Containers won't start
```bash
# Check logs
docker-compose logs archiflow-backend
docker-compose logs archiflow-postgres

# Restart services
docker-compose restart
```

### Issue: Database tables missing
```bash
# Manually run migrations
docker exec -i archiflow-postgres psql -U archiflow_user -d archiflow < ../database/netbox-devices-ips-cache.sql
```

### Issue: VLANs/IP Pools not showing
```bash
# Sync NetBox data
curl -X POST http://localhost:3333/api/netbox/sync

# Check sync status
docker exec archiflow-postgres psql -U archiflow_user -d archiflow -c "SELECT * FROM archiflow.netbox_sync_status;"
```

### Issue: Device names still duplicate
```bash
# Verify NetBox devices cache
docker exec archiflow-postgres psql -U archiflow_user -d archiflow -c "SELECT name FROM archiflow.netbox_devices;"

# If empty, sync again
curl -X POST http://localhost:3333/api/netbox/sync
```

### Issue: IPs showing as available when they're allocated in NetBox
```bash
# Check IP cache
docker exec archiflow-postgres psql -U archiflow_user -d archiflow -c "SELECT address, device_name FROM archiflow.netbox_ip_addresses WHERE device_name IS NOT NULL;"

# Re-sync if empty
curl -X POST http://localhost:3333/api/netbox/sync
```

---

## 📁 File Structure

```
archiflow_diagram_plugin-main/
├── backend/
│   ├── websocket-server.js       # Main WebSocket server
│   ├── network-device-manager.js # Device & IP management
│   ├── netbox/
│   │   ├── client.js              # NetBox API client
│   │   ├── sync-service.js        # NetBox data sync
│   │   └── deployment-service.js  # Deploy to NetBox
│   └── database/
│       └── index.js               # PostgreSQL connection
├── frontend/
│   ├── index.html                 # Main application
│   ├── app.js                     # Application logic
│   ├── network-devices.js         # Device management UI
│   └── archiflow-network-plugin.js # Draw.io plugin
├── database/
│   ├── init-complete.sql          # Full schema initialization
│   ├── netbox-cache-schema.sql    # NetBox cache tables
│   └── netbox-devices-ips-cache.sql # Device/IP cache (NEW!)
└── docker/
    ├── docker-compose.yml         # Service orchestration
    └── Dockerfile.backend         # Backend image
```

---

## ✅ Pre-Deployment Checklist

Before presenting tomorrow:

- [ ] All Docker containers start successfully
- [ ] Database migrations run automatically
- [ ] NetBox sync completes without errors
- [ ] Can create a diagram and add devices
- [ ] Device names are unique (check NetBox)
- [ ] IP pools and VLANs load in dropdown
- [ ] Allocated IPs show as unavailable
- [ ] Can deploy devices to NetBox
- [ ] Deployment status shows correctly
- [ ] Can switch between diagrams without losing data

---

## 🎯 Demo Flow for Presentation

1. **Start Services**
   ```bash
   docker-compose up -d
   curl -X POST http://localhost:3333/api/netbox/sync
   ```

2. **Create Diagram**
   - Open http://localhost:8081
   - Click "New Diagram"
   - Select site from dropdown

3. **Add Devices**
   - Click "Add Device"
   - Select device type (Cisco Catalyst 9300)
   - **Show**: Device name auto-generated uniquely (e.g., SW-TEST-01)
   - Select IP pool and VLAN from dropdowns
   - **Show**: Allocated IPs are greyed out
   - Click "Add to Diagram"

4. **Deploy to NetBox**
   - Click "Deploy" button
   - **Show**: Auto-save happens first
   - **Show**: Device created in NetBox
   - **Show**: Diagram status changes to "Deployed"

5. **Verify in NetBox**
   - Open NetBox UI
   - Navigate to Devices → Show new device
   - Check IP assignment
   - Verify VLAN configuration

---

## 📞 Support

For issues during presentation:
1. Check Docker logs: `docker-compose logs -f`
2. Verify database: http://localhost:8082 (Adminer)
3. Check NetBox sync status
4. Restart services if needed: `docker-compose restart`

---

## 🔐 Security Notes

**For Production Deployment:**
- Change default database password in `docker-compose.yml`
- Use environment variables for NetBox token (don't commit!)
- Enable HTTPS for frontend
- Restrict database port access (remove `ports` mapping)
- Set up firewall rules for WebSocket port

---

## 📝 Environment Variables

### Backend (`docker-compose.yml` or `backend/.env`)

```env
# Database
DB_MODE=postgresql
DB_HOST=archiflow-postgres
DB_PORT=5432
DB_NAME=archiflow
DB_SCHEMA=archiflow
DB_USER=archiflow_user
DB_PASSWORD=archiflow_pass

# WebSocket
WS_PORT=3333
NODE_ENV=development

# NetBox (Optional)
NETBOX_URL=http://netbox:8080
NETBOX_TOKEN=your_api_token_here
```

---

**Last Updated**: October 11, 2025
**Version**: 2.0.0 with NetBox Real-Time Integration

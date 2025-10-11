# NetBox Integration Documentation

## Overview

ArchiFlow integrates with NetBox v4.0+ to provide bidirectional synchronization between network diagrams and NetBox's Source of Truth database. This document outlines the integration architecture, data flows, and deployment processes.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Data Flow](#data-flow)
3. [NetBox Sync Service](#netbox-sync-service)
4. [Device Deployment](#device-deployment)
5. [API Integration](#api-integration)
6. [Troubleshooting](#troubleshooting)

---

## Architecture Overview

### Components

```
┌─────────────────┐      WebSocket      ┌──────────────────┐
│                 │ ◄──────────────────► │                  │
│  ArchiFlow      │                      │  Backend         │
│  Frontend       │                      │  (Node.js)       │
│  (Draw.io)      │                      │                  │
└─────────────────┘                      └────────┬─────────┘
                                                  │
                                         ┌────────▼─────────┐
                                         │                  │
                                         │  PostgreSQL      │
                                         │  Database        │
                                         │                  │
                                         └────────┬─────────┘
                                                  │
                                         ┌────────▼─────────┐
                                         │                  │
                                         │  NetBox v4       │
                                         │  API             │
                                         │                  │
                                         └──────────────────┘
```

### Key Services

1. **NetBox Sync Service** (`backend/netbox/sync-service.js`)
   - Caches NetBox data locally in PostgreSQL
   - Periodic synchronization of Sites, VLANs, IP Prefixes, Device Types, Roles
   - Provides fast lookup for frontend operations

2. **NetBox Deployment Service** (`backend/netbox/deployment-service.js`)
   - Deploys devices from diagrams to NetBox
   - Creates devices, interfaces, IP assignments
   - Maintains ArchiFlow ↔ NetBox ID mappings

3. **NetBox Client** (`backend/netbox/client.js`)
   - REST API wrapper for NetBox v4
   - Handles authentication and error handling

---

## Data Flow

### 1. NetBox → ArchiFlow (Sync)

**Frequency**: On-demand via `/api/netbox/sync` endpoint or on frontend load

**Process**:
```
NetBox API → Sync Service → PostgreSQL Cache → Frontend WebSocket
```

**Tables Synced**:
- `archiflow.netbox_sites` - Network sites/locations
- `archiflow.netbox_device_types` - Device models (Cisco, Juniper, etc.)
- `archiflow.netbox_device_roles` - Device roles (Router, Switch, Firewall)
- `archiflow.netbox_vlans` - VLANs for network segmentation
- `archiflow.netbox_prefixes` - IP address pools/subnets

**Sync Algorithm**:
```javascript
1. DELETE child tables (prefixes, vlans) - respects FK constraints
2. DELETE parent tables (sites, device_types, roles)
3. FETCH fresh data from NetBox API
4. INSERT new data into cache tables
5. UPDATE sync status and timestamp
```

### 2. ArchiFlow → NetBox (Deployment)

**Trigger**: User clicks "Deploy" button on diagram

**Process**:
```
Draw.io Diagram → Extract Devices → Validate → Deploy to NetBox → Update Diagram Status
```

**Deployment Flow**:

```
┌─────────────────────────────────────────────────────────────┐
│ 1. User Creates Diagram                                     │
│    - Add device from palette                                │
│    - Assign IP from pool                                    │
│    - Select VLAN                                            │
│    - Save diagram (status: "draft")                         │
└────────────────────────────┬────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────┐
│ 2. Click Deploy Button                                      │
│    - Modal shows: Site, Device count                        │
│    - Confirm deployment                                     │
└────────────────────────────┬────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────┐
│ 3. Backend Extracts Diagram Data                            │
│    - Parse Draw.io XML                                      │
│    - Extract device metadata (name, IP, VLAN, template)     │
│    - Load from pendingDevices or saved diagram              │
└────────────────────────────┬────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────┐
│ 4. Deploy Each Device to NetBox                             │
│    ┌──────────────────────────────────────────────────┐    │
│    │ Step 1: Get/Create Device Role                   │    │
│    │         - Use device type as role name           │    │
│    │         - Create if doesn't exist                │    │
│    └──────────────────────────────────────────────────┘    │
│    ┌──────────────────────────────────────────────────┐    │
│    │ Step 2: Create Device                            │    │
│    │         POST /api/dcim/devices/                  │    │
│    │         {                                        │    │
│    │           name: "DEV-SITE-01",                   │    │
│    │           device_type: 1,  // NetBox template ID │    │
│    │           role: 3,          // NetBox role ID    │    │
│    │           site: 2,          // NetBox site ID    │    │
│    │           status: "active"                       │    │
│    │         }                                        │    │
│    └──────────────────────────────────────────────────┘    │
│    ┌──────────────────────────────────────────────────┐    │
│    │ Step 3: Create Management Interface              │    │
│    │         POST /api/dcim/interfaces/               │    │
│    │         {                                        │    │
│    │           device: 5,                             │    │
│    │           name: "Management",                    │    │
│    │           type: "virtual",                       │    │
│    │           enabled: true,                         │    │
│    │           mode: "access",    // VLAN mode        │    │
│    │           untagged_vlan: 1   // ⭐ VLAN HERE!   │    │
│    │         }                                        │    │
│    └──────────────────────────────────────────────────┘    │
│    ┌──────────────────────────────────────────────────┐    │
│    │ Step 4: Assign IP to Interface                   │    │
│    │         POST /api/ipam/ip-addresses/             │    │
│    │         {                                        │    │
│    │           address: "172.16.10.4/32",             │    │
│    │           assigned_object_type: "dcim.interface",│    │
│    │           assigned_object_id: 5,                 │    │
│    │           status: "active"                       │    │
│    │         }                                        │    │
│    └──────────────────────────────────────────────────┘    │
│    ┌──────────────────────────────────────────────────┐    │
│    │ Step 5: Set Primary IP on Device                 │    │
│    │         PATCH /api/dcim/devices/5/               │    │
│    │         {                                        │    │
│    │           primary_ip4: 3  // IP address ID       │    │
│    │         }                                        │    │
│    └──────────────────────────────────────────────────┘    │
│    ┌──────────────────────────────────────────────────┐    │
│    │ Step 6: Store ArchiFlow ↔ NetBox Mapping         │    │
│    │         INSERT INTO archiflow.netbox_device_map  │    │
│    │         - Links diagram device to NetBox ID      │    │
│    └──────────────────────────────────────────────────┘    │
└────────────────────────────┬────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────┐
│ 5. Update Diagram Status                                    │
│    - Set status to "deployed"                               │
│    - Set deployed_at timestamp                              │
│    - Send success message to frontend                       │
└─────────────────────────────────────────────────────────────┘
```

---

## NetBox Sync Service

### Sync Tables and Foreign Key Order

**Critical**: Tables must be deleted and synced in the correct order to avoid FK constraint violations.

**Deletion Order** (child → parent):
1. `netbox_prefixes` (references sites, vlans)
2. `netbox_vlans` (references sites)
3. `netbox_sites` (parent table)
4. `netbox_device_types` (independent)
5. `netbox_device_roles` (independent)

**Sync Order** (parent → child):
1. `netbox_sites`
2. `netbox_device_types`
3. `netbox_device_roles`
4. `netbox_prefixes`
5. `netbox_vlans`

### Sync Service Methods

```javascript
// Full sync of all NetBox data
syncAll()

// Individual entity syncs
syncSites()
syncDeviceTypes()
syncDeviceRoles()
syncPrefixes()
syncVLANs()

// Utility
updateSyncStatus(entity, status, message)
```

---

## Device Deployment

### Metadata Structure

Devices in Draw.io diagrams store metadata in XML format:

```xml
<object label="DEV-SITE-01" id="2">
  <mxCell style="shape=mxgraph.cisco..." vertex="1" parent="1">
    <mxGeometry x="100" y="100" width="120" height="80" as="geometry"/>
  </mxCell>
  <Object
    template_id="1"
    device_type="c9200-24p"
    name="DEV-SITE-01"
    manufacturer="Cisco"
    model="c9200-24p"
    ip_address="172.16.10.4"
    pool_id="1"
    vlan_id="1"
    as="archiflowDevice"
  />
</object>
```

### ID Mapping Strategy

**Problem**: ArchiFlow uses local database IDs, NetBox has its own IDs

**Solution**: Maintain mapping table

```sql
CREATE TABLE archiflow.netbox_device_map (
    id SERIAL PRIMARY KEY,
    diagram_id UUID NOT NULL,
    device_cell_id VARCHAR(50) NOT NULL,
    device_name VARCHAR(255) NOT NULL,
    netbox_device_id INTEGER NOT NULL,
    netbox_interface_id INTEGER,
    netbox_ip_id INTEGER,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(diagram_id, device_cell_id)
);
```

This allows:
- Looking up NetBox ID from diagram device
- Updating NetBox devices when diagram changes
- Preventing duplicate deployments

### VLAN Assignment (NetBox v4)

**⚠️ Critical Discovery**: In NetBox v4, VLANs are NOT assigned to IP addresses directly!

**Correct Approach**:
```javascript
// ❌ WRONG - NetBox ignores this
{
  address: "172.16.10.4/32",
  vlan: 1  // This does nothing!
}

// ✅ CORRECT - Assign VLAN to interface
{
  device: 5,
  name: "Management",
  type: "virtual",
  mode: "access",           // Access mode for single VLAN
  untagged_vlan: 1          // VLAN assigned HERE
}
```

**VLAN Modes**:
- `mode: "access"` → Single VLAN via `untagged_vlan`
- `mode: "tagged"` → Multiple VLANs via `tagged_vlans` array

### Duplicate Handling

**IP Addresses**:
```javascript
try {
  // Try to create IP
  await netbox.createIPAddress(ipData);
} catch (error) {
  if (error.response?.data?.address?.includes('Duplicate')) {
    // Find existing IP
    const existingIPs = await netbox.getIPAddresses({ address: ipAddress });
    // Update it with new interface assignment
    await netbox.updateIPAddress(existingIPs[0].id, {
      assigned_object_type: 'dcim.interface',
      assigned_object_id: interfaceId
    });
  }
}
```

**Devices**:
- Check by name before creating
- Use existing device if found
- Prevents duplicate device errors

---

## API Integration

### NetBox Client Methods

**Devices**:
```javascript
getDevices(params)          // GET /api/dcim/devices/
getDeviceByName(name)       // GET /api/dcim/devices/?name=...
createDevice(deviceData)    // POST /api/dcim/devices/
updateDevice(id, data)      // PATCH /api/dcim/devices/{id}/
```

**Interfaces**:
```javascript
createInterface(data)       // POST /api/dcim/interfaces/
getInterfaces(params)       // GET /api/dcim/interfaces/
```

**IP Addresses**:
```javascript
createIPAddress(data)       // POST /api/ipam/ip-addresses/
getIPAddresses(params)      // GET /api/ipam/ip-addresses/
updateIPAddress(id, data)   // PATCH /api/ipam/ip-addresses/{id}/
```

**Sites, VLANs, Prefixes**:
```javascript
getSites()                  // GET /api/dcim/sites/
getVLANs(params)            // GET /api/ipam/vlans/
getPrefixes(params)         // GET /api/ipam/prefixes/
getDeviceTypes()            // GET /api/dcim/device-types/
getDeviceRoles()            // GET /api/dcim/device-roles/
```

### NetBox v4 API Format Changes

**Device Creation** (v3 → v4):
```javascript
// v3
{ device_role: 1 }

// v4
{ role: 1 }  // Field renamed!
```

**IP Assignment** (v3 → v4):
```javascript
// v3
{
  device: 1,
  interface: 1
}

// v4
{
  assigned_object_type: 'dcim.interface',
  assigned_object_id: 1
}
```

---

## Troubleshooting

### Common Issues

#### 1. FK Constraint Violation on Sync

**Error**: `violates foreign key constraint "netbox_prefixes_site_id_fkey"`

**Cause**: Trying to delete parent table (sites) before child tables (prefixes, vlans)

**Solution**: Delete in correct order (child → parent):
```javascript
await db.query('DELETE FROM archiflow.netbox_prefixes');
await db.query('DELETE FROM archiflow.netbox_vlans');
await db.query('DELETE FROM archiflow.netbox_sites');
```

#### 2. IP Address Not Showing in NetBox

**Error**: IP created but not visible on device page

**Causes**:
- IP not set as primary IP → Fix: Call `setPrimaryIP()`
- IP not assigned to interface → Fix: Use `assigned_object_type` + `assigned_object_id`

#### 3. Duplicate IP Address

**Error**: `Duplicate IP address found in global table`

**Solution**: Check for existing IP and update instead of create:
```javascript
const existingIPs = await netbox.getIPAddresses({ address: ipAddress });
if (existingIPs.length > 0) {
  await netbox.updateIPAddress(existingIPs[0].id, updateData);
}
```

#### 4. VLAN Not Showing on Device

**Error**: VLAN assigned but not visible in NetBox

**Cause**: Trying to assign VLAN to IP instead of interface

**Solution**: Assign VLAN to interface:
```javascript
{
  device: deviceId,
  name: 'Management',
  mode: 'access',
  untagged_vlan: vlanId  // ✅ Correct location
}
```

#### 5. Template ID Undefined

**Error**: `device_type: ['This field is required.']`

**Cause**: Metadata structure mismatch

**Solution**: Extract from nested metadata:
```javascript
const templateId = deviceData.metadata?.template_id || deviceData.template_id;
```

---

## Verification Steps

### After Deployment, Verify in NetBox UI:

1. **Device Page** (`/dcim/devices/{id}/`)
   - ✅ Device name displayed
   - ✅ Site assigned
   - ✅ Device type/model shown
   - ✅ Role assigned
   - ✅ Primary IPv4 displayed

2. **Interfaces Tab** (`/dcim/devices/{id}/#interfaces`)
   - ✅ "Management" interface exists
   - ✅ Type: Virtual
   - ✅ Mode: Access (if VLAN assigned)
   - ✅ Untagged VLAN: Management (10) ← **Check here for VLAN!**
   - ✅ IP Address: 172.16.10.4/32

3. **IP Addresses** (`/ipam/ip-addresses/`)
   - ✅ IP address exists
   - ✅ Status: Active
   - ✅ Assigned Object Type: dcim.interface
   - ✅ Assigned Object: Device > Management

---

## Database Schema

### Mapping Table
```sql
-- Stores ArchiFlow to NetBox ID mappings
CREATE TABLE archiflow.netbox_device_map (
    id SERIAL PRIMARY KEY,
    diagram_id UUID NOT NULL REFERENCES archiflow.diagrams(id) ON DELETE CASCADE,
    device_cell_id VARCHAR(50) NOT NULL,
    device_name VARCHAR(255) NOT NULL,
    netbox_device_id INTEGER NOT NULL,
    netbox_interface_id INTEGER,
    netbox_ip_id INTEGER,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(diagram_id, device_cell_id)
);
```

### Cache Tables
```sql
-- NetBox sites cache
CREATE TABLE archiflow.netbox_sites (...)

-- NetBox device types cache
CREATE TABLE archiflow.netbox_device_types (...)

-- NetBox device roles cache
CREATE TABLE archiflow.netbox_device_roles (...)

-- NetBox VLANs cache
CREATE TABLE archiflow.netbox_vlans (...)

-- NetBox IP prefixes/pools cache
CREATE TABLE archiflow.netbox_prefixes (...)
```

---

## Future Enhancements

### Planned Features

1. **Bidirectional Updates**
   - Detect changes in NetBox
   - Update diagrams automatically
   - Conflict resolution UI

2. **Bulk Operations**
   - Deploy entire diagram (all devices)
   - Update multiple devices
   - Rollback deployments

3. **Advanced VLAN Management**
   - Trunk interfaces with multiple VLANs
   - VLAN inheritance from site
   - Auto-assign VLAN from IP pool

4. **Cable/Connection Deployment**
   - Deploy physical connections
   - Create cables between interfaces
   - Topology validation

5. **Validation & Compliance**
   - Pre-deployment validation
   - IP conflict detection
   - Naming convention enforcement

---

## API Endpoints

### WebSocket Actions

```javascript
// Sync NetBox data to cache
{
  action: 'sync_netbox'
}

// Deploy pending devices
{
  action: 'deploy_to_netbox',
  diagramId: 'uuid',
  devices: [...],
  siteId: 2
}

// Deploy from saved diagram
{
  action: 'deploy_diagram_to_netbox',
  diagramId: 'uuid',
  siteId: 2
}
```

### HTTP Endpoints

```
POST   /api/netbox/sync              - Trigger NetBox sync
GET    /api/netbox/devices           - List cached devices
GET    /api/netbox/sites             - List cached sites
GET    /api/netbox/vlans             - List cached VLANs
GET    /api/netbox/prefixes          - List cached IP pools
```

---

## Configuration

### Environment Variables

```bash
# NetBox Connection
NETBOX_URL=http://netbox:8080
NETBOX_TOKEN=0123456789abcdef0123456789abcdef01234567

# Database
DB_MODE=postgresql
DB_HOST=postgres
DB_PORT=5432
DB_NAME=archiflow
DB_USER=archiflow_user
DB_PASSWORD=archiflow_pass

# WebSocket
WS_PORT=3333
```

---

## Key Learnings & Best Practices

### 1. NetBox v4 API Format
- Always use `assigned_object_type` + `assigned_object_id` for IP assignments
- Use `role` not `device_role` for device creation
- VLANs are assigned to interfaces, not IPs

### 2. Data Integrity
- Respect FK constraints when syncing (delete child → parent)
- Use transactions for multi-step deployments
- Handle duplicate entries gracefully

### 3. ID Mapping
- Never assume ArchiFlow IDs match NetBox IDs
- Always maintain mapping table
- Use UUIDs for diagram references

### 4. Error Handling
- Check for duplicate resources before creating
- Provide clear error messages to users
- Log all NetBox API interactions

---

## Testing Commands

### Manual NetBox API Testing

```bash
# Get device
curl -H "Authorization: Token YOUR_TOKEN" \
  http://netbox:8080/api/dcim/devices/5/

# Check interface VLAN
curl -H "Authorization: Token YOUR_TOKEN" \
  http://netbox:8080/api/dcim/interfaces/5/

# Verify IP assignment
curl -H "Authorization: Token YOUR_TOKEN" \
  http://netbox:8080/api/ipam/ip-addresses/3/

# Check VLAN details
curl -H "Authorization: Token YOUR_TOKEN" \
  http://netbox:8080/api/ipam/vlans/1/
```

### Backend Logs

```bash
# Watch deployment logs
docker logs -f archiflow-backend

# Check sync errors
docker logs archiflow-backend | grep "Sync.*failed"

# View deployment payloads
docker logs archiflow-backend | grep "payload"
```

---

## Version History

### v1.0 (Current)
- ✅ NetBox v4 integration
- ✅ Device deployment with interfaces
- ✅ IP address assignment
- ✅ VLAN assignment via interfaces
- ✅ Site association
- ✅ Device type/role mapping
- ✅ Duplicate handling
- ✅ ArchiFlow ↔ NetBox ID mapping

### Known Limitations
- Single interface per device (Management only)
- No cable/connection deployment
- No update existing devices from diagram edits
- VLANs must exist in NetBox (not auto-created)

---

## Support & Documentation

- **NetBox API Docs**: https://demo.netbox.dev/api/docs/
- **ArchiFlow Docs**: `/docs` directory
- **Issue Tracking**: See `docs/USER_FLOW.md`

---

*Last Updated: 2025-10-11*
*NetBox Version: v4.0-2.9.1*
*ArchiFlow Version: 1.0*

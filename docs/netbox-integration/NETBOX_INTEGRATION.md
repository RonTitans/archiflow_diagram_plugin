# NetBox Integration Guide

## Overview

This document provides a comprehensive guide for integrating ArchiFlow Network Diagram Plugin with NetBox, the industry-standard open-source IPAM (IP Address Management) and DCIM (Data Center Infrastructure Management) solution.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [NetBox Data Model](#netbox-data-model)
3. [API Integration](#api-integration)
4. [Data Mapping](#data-mapping)
5. [Deployment Workflow](#deployment-workflow)
6. [Implementation Phases](#implementation-phases)
7. [Code Examples](#code-examples)
8. [Error Handling](#error-handling)
9. [Testing & Validation](#testing--validation)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     ARCHIFLOW SYSTEM                             │
│  ┌────────────────┐          ┌──────────────────────┐          │
│  │  Frontend UI   │          │  Backend Services    │          │
│  │  - Draw.io     │◄────────►│  - WebSocket Server  │          │
│  │  - Diagram     │          │  - Device Parser     │          │
│  │  - Deploy UI   │          │  - NetBox Adapter    │          │
│  └────────────────┘          └──────────┬───────────┘          │
│                                          │                       │
│                               ┌──────────▼────────────┐         │
│                               │  PostgreSQL Database  │         │
│                               │  - network_devices    │         │
│                               │  - ip_addresses       │         │
│                               │  - deployments        │         │
│                               └───────────────────────┘         │
└─────────────────────────────────────────────────────────────────┘
                                    │
                                    │ HTTPS REST API
                                    │ (Token Authentication)
                                    ↓
┌─────────────────────────────────────────────────────────────────┐
│                      NETBOX SYSTEM                               │
│  ┌────────────────┐          ┌──────────────────────┐          │
│  │   REST API     │◄────────►│  Django Application  │          │
│  │  /api/dcim/    │          │  - DCIM Models       │          │
│  │  /api/ipam/    │          │  - IPAM Models       │          │
│  └────────────────┘          └──────────┬───────────┘          │
│                                          │                       │
│                               ┌──────────▼────────────┐         │
│                               │  PostgreSQL Database  │         │
│                               │  - dcim_device        │         │
│                               │  - dcim_interface     │         │
│                               │  - ipam_ipaddress     │         │
│                               └───────────────────────┘         │
└─────────────────────────────────────────────────────────────────┘
```

### Integration Principles

1. **NetBox as Source of Truth**: NetBox is the authoritative system for production network data
2. **ArchiFlow as Visual Interface**: ArchiFlow provides visual planning and diagram-driven deployment
3. **Unidirectional Sync (Phase 1)**: Data flows from ArchiFlow → NetBox on deployment
4. **Bi-directional Sync (Future)**: Pull changes from NetBox to update diagrams

---

## NetBox Data Model

### Core DCIM Models

#### 1. Device
```json
{
  "id": 123,
  "name": "SW-BACKUP-01",
  "device_type": {
    "id": 45,
    "manufacturer": "Cisco",
    "model": "Catalyst C9200-24P"
  },
  "device_role": {
    "id": 3,
    "name": "Access Switch"
  },
  "site": {
    "id": 2,
    "name": "Backup Site"
  },
  "status": "active",
  "serial": "FCW2223A0123",
  "asset_tag": "ASSET-12345",
  "primary_ip4": {
    "id": 456,
    "address": "172.16.40.3/24"
  }
}
```

**Required Fields:**
- `name`: Device hostname (unique within site)
- `device_type`: Foreign key to DeviceType
- `device_role`: Foreign key to DeviceRole
- `site`: Foreign key to Site

**Optional Fields:**
- `status`: active, offline, planned, staged, failed, decommissioning
- `serial`: Serial number
- `asset_tag`: Asset tracking ID
- `platform`: Operating system
- `location`: Specific location within site
- `rack`, `position`: Physical rack location

#### 2. Interface
```json
{
  "id": 789,
  "device": 123,
  "name": "GigabitEthernet1/0/1",
  "type": "1000base-t",
  "enabled": true,
  "mtu": 1500,
  "mac_address": "00:1A:2B:3C:4D:5E",
  "description": "Management Interface"
}
```

**Required Fields:**
- `device`: Foreign key to Device
- `name`: Interface name
- `type`: Interface type (1000base-t, 10gbase-x, etc.)

**Common Types:**
- `1000base-t`: Gigabit Ethernet (RJ45)
- `10gbase-x-sfpp`: 10G SFP+
- `25gbase-x-sfp28`: 25G SFP28
- `virtual`: Virtual interface

#### 3. IP Address
```json
{
  "id": 456,
  "address": "172.16.40.3/24",
  "status": "active",
  "assigned_object_type": "dcim.interface",
  "assigned_object_id": 789,
  "dns_name": "sw-backup-01.company.local",
  "description": "Management IP"
}
```

**Required Fields:**
- `address`: IP address with CIDR notation

**Key Fields:**
- `assigned_object_type`: Type of object (dcim.interface, virtualization.vminterface)
- `assigned_object_id`: ID of the assigned interface
- `status`: active, reserved, deprecated, dhcp

### Supporting Models

#### DeviceType
Pre-configured hardware models with default components

```json
{
  "id": 45,
  "manufacturer": "Cisco",
  "model": "Catalyst C9200-24P",
  "slug": "c9200-24p",
  "u_height": 1,
  "is_full_depth": true
}
```

#### DeviceRole
Functional role of devices

```json
{
  "id": 3,
  "name": "Access Switch",
  "slug": "access-switch",
  "color": "2196f3"
}
```

#### Site
Physical locations

```json
{
  "id": 2,
  "name": "Backup Site",
  "slug": "backup-site",
  "status": "active"
}
```

---

## API Integration

### Authentication

NetBox uses token-based authentication via HTTP headers.

#### Creating an API Token

**Via Web UI:**
1. Navigate to user profile → API Tokens
2. Click "Add Token"
3. Set permissions (write enabled for integration)
4. Copy token value

**Via API:**
```bash
curl -X POST \
  -H "Content-Type: application/json" \
  https://netbox.company.local/api/users/tokens/provision/ \
  --data '{
    "username": "archiflow_service",
    "password": "secure_password"
  }'
```

**Response:**
```json
{
  "id": 12,
  "key": "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0",
  "write_enabled": true,
  "created": "2024-10-08T14:30:00Z"
}
```

#### Using the Token

Include in Authorization header:
```bash
Authorization: Token a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0
```

### API Endpoints

#### Devices

**List Devices:**
```http
GET /api/dcim/devices/
GET /api/dcim/devices/?site_id=2
GET /api/dcim/devices/?name=SW-BACKUP-01
```

**Create Device:**
```http
POST /api/dcim/devices/
Content-Type: application/json

{
  "name": "SW-BACKUP-01",
  "device_type": 45,
  "device_role": 3,
  "site": 2,
  "status": "active"
}
```

**Update Device:**
```http
PATCH /api/dcim/devices/123/
Content-Type: application/json

{
  "status": "offline",
  "comments": "Maintenance"
}
```

**Set Primary IP:**
```http
PATCH /api/dcim/devices/123/
Content-Type: application/json

{
  "primary_ip4": 456
}
```

#### Interfaces

**Create Interface:**
```http
POST /api/dcim/interfaces/
Content-Type: application/json

{
  "device": 123,
  "name": "Management",
  "type": "1000base-t",
  "enabled": true
}
```

**List Interfaces for Device:**
```http
GET /api/dcim/interfaces/?device_id=123
```

#### IP Addresses

**Create IP Address:**
```http
POST /api/ipam/ip-addresses/
Content-Type: application/json

{
  "address": "172.16.40.3/24",
  "status": "active",
  "dns_name": "sw-backup-01.company.local"
}
```

**Assign IP to Interface:**
```http
PATCH /api/ipam/ip-addresses/456/
Content-Type: application/json

{
  "assigned_object_type": "dcim.interface",
  "assigned_object_id": 789
}
```

**List Available IPs in Prefix:**
```http
GET /api/ipam/prefixes/10/available-ips/
```

### Bulk Operations

NetBox supports bulk creation for efficiency:

```http
POST /api/dcim/devices/
Content-Type: application/json

[
  {
    "name": "SW-BACKUP-01",
    "device_type": 45,
    "device_role": 3,
    "site": 2
  },
  {
    "name": "SW-BACKUP-02",
    "device_type": 45,
    "device_role": 3,
    "site": 2
  }
]
```

**Response includes array of created objects:**
```json
[
  {"id": 123, "name": "SW-BACKUP-01", ...},
  {"id": 124, "name": "SW-BACKUP-02", ...}
]
```

---

## Data Mapping

### ArchiFlow → NetBox Field Mapping

#### Devices

| ArchiFlow Field | NetBox Field | Transformation | Required |
|----------------|--------------|----------------|----------|
| `network_devices.name` | `dcim_device.name` | Direct | ✓ |
| `network_devices.device_type` | Lookup via mapping | "switch" → role_id | ✓ |
| `network_devices.manufacturer` + `model` | Lookup `device_type` | Combined lookup | ✓ |
| `network_devices.site_id` | Lookup via mapping | site_id → netbox_site_id | ✓ |
| `network_devices.status` | `dcim_device.status` | "active" → "active" | ✓ |
| `network_devices.serial_number` | `dcim_device.serial` | Direct | ✗ |
| `network_devices.asset_id` | `dcim_device.asset_tag` | Direct | ✗ |

#### IP Addresses

| ArchiFlow Field | NetBox Field | Transformation | Required |
|----------------|--------------|----------------|----------|
| `ip_addresses.ip_address` | `ipam_ipaddress.address` | Ensure CIDR format | ✓ |
| `ip_addresses.device_id` | Via interface lookup | device → interface → IP | ✓ |
| `ip_addresses.device_name` | `ipam_ipaddress.dns_name` | Convert to FQDN | ✗ |
| `ip_addresses.allocated_at` | `ipam_ipaddress.created` | Timestamp | ✗ |

### Mapping Configuration

Store mappings in `netbox_mappings` table:

```sql
-- Example mappings
INSERT INTO archiflow.netbox_mappings (mapping_type, archiflow_key, netbox_id, netbox_name)
VALUES
  ('site', '2', 2, 'Backup Site'),
  ('device_type', 'Cisco C9200-24P', 45, 'Catalyst C9200-24P'),
  ('device_role', 'switch', 3, 'Access Switch'),
  ('device_role', 'router', 4, 'Core Router'),
  ('device_role', 'firewall', 5, 'Firewall');
```

---

## Deployment Workflow

### Complete Sync Process

```javascript
async function deployToNetBox(deploymentId) {
  // 1. Initialize deployment
  const deployment = await getDeployment(deploymentId);
  const devices = await getDevicesFromDiagram(deployment.diagram_id);

  await updateDeployment(deploymentId, {
    netbox_sync_status: 'syncing',
    netbox_sync_started_at: new Date()
  });

  const results = [];

  // 2. Process each device
  for (const device of devices) {
    try {
      // Step 2.1: Check if device exists
      const existing = await netbox.getDeviceByName(
        device.name,
        deployment.site_id
      );

      let netboxDeviceId;

      if (existing) {
        // Step 2.2a: Update existing device
        await netbox.updateDevice(existing.id, {
          device_type: await getMappedDeviceType(device),
          device_role: await getMappedDeviceRole(device),
          status: 'active'
        });
        netboxDeviceId = existing.id;
        results.push({
          archiflow_id: device.id,
          netbox_id: netboxDeviceId,
          status: 'updated'
        });
      } else {
        // Step 2.2b: Create new device
        const created = await netbox.createDevice({
          name: device.name,
          device_type: await getMappedDeviceType(device),
          device_role: await getMappedDeviceRole(device),
          site: await getMappedSite(deployment.site_id),
          status: 'active',
          serial: device.serial_number,
          asset_tag: device.asset_id
        });
        netboxDeviceId = created.id;
        results.push({
          archiflow_id: device.id,
          netbox_id: netboxDeviceId,
          status: 'created'
        });
      }

      // Step 2.3: Create management interface
      const managementInterface = await netbox.createInterface({
        device: netboxDeviceId,
        name: 'Management',
        type: '1000base-t',
        enabled: true,
        description: 'Created by ArchiFlow'
      });

      // Step 2.4: Handle IP address
      if (device.ip_address) {
        // Ensure CIDR notation
        const ipWithCIDR = device.ip_address.includes('/')
          ? device.ip_address
          : `${device.ip_address}/24`;

        // Check if IP already exists
        let ipAddress = await netbox.getIPAddress(ipWithCIDR);

        if (!ipAddress) {
          // Create new IP
          ipAddress = await netbox.createIPAddress({
            address: ipWithCIDR,
            status: 'active',
            dns_name: `${device.name.toLowerCase()}.company.local`,
            description: `Allocated from ArchiFlow deployment ${deploymentId}`
          });
        }

        // Step 2.5: Assign IP to interface
        await netbox.assignIPToInterface(
          ipAddress.id,
          managementInterface.id
        );

        // Step 2.6: Set as primary IP
        await netbox.setDevicePrimaryIP(netboxDeviceId, ipAddress.id);
      }

    } catch (error) {
      console.error(`Failed to sync device ${device.name}:`, error);
      results.push({
        archiflow_id: device.id,
        status: 'error',
        error: error.message,
        stack: error.stack
      });
    }
  }

  // 3. Update deployment status
  const successCount = results.filter(r => r.status === 'created' || r.status === 'updated').length;
  const errorCount = results.filter(r => r.status === 'error').length;

  await updateDeployment(deploymentId, {
    netbox_sync_status: errorCount > 0 ? 'partial' : 'completed',
    netbox_sync_completed_at: new Date(),
    devices_synced: results,
    devices_created: results.filter(r => r.status === 'created').length,
    devices_updated: results.filter(r => r.status === 'updated').length,
    sync_errors: results.filter(r => r.status === 'error')
  });

  return {
    success: errorCount === 0,
    total: devices.length,
    created: results.filter(r => r.status === 'created').length,
    updated: results.filter(r => r.status === 'updated').length,
    errors: errorCount,
    results
  };
}
```

### Sequential API Calls Per Device

```
Device: SW-BACKUP-01 with IP 172.16.40.3
         ↓
1. GET /api/dcim/devices/?name=SW-BACKUP-01&site_id=2
   → Check if exists
         ↓
2a. If EXISTS:
    PATCH /api/dcim/devices/123/
    → Update device
         ↓
2b. If NOT EXISTS:
    POST /api/dcim/devices/
    → Create device (returns ID: 123)
         ↓
3. POST /api/dcim/interfaces/
   {device: 123, name: "Management", type: "1000base-t"}
   → Create interface (returns ID: 789)
         ↓
4. GET /api/ipam/ip-addresses/?address=172.16.40.3/24
   → Check if IP exists
         ↓
5a. If EXISTS:
    Get existing IP ID: 456
         ↓
5b. If NOT EXISTS:
    POST /api/ipam/ip-addresses/
    → Create IP (returns ID: 456)
         ↓
6. PATCH /api/ipam/ip-addresses/456/
   {assigned_object_type: "dcim.interface", assigned_object_id: 789}
   → Assign IP to interface
         ↓
7. PATCH /api/dcim/devices/123/
   {primary_ip4: 456}
   → Set as primary IP
         ↓
✅ Device fully synced to NetBox
```

---

## Implementation Phases

### Phase 1: Foundation (Week 1-2)

**Components:**
- NetBox API client module
- Configuration manager
- Basic HTTP client with retry logic
- Token validation

**Deliverables:**
- Can authenticate with NetBox
- Can query existing devices
- Can create single device

**Code Modules:**
```
backend/
├── netbox/
│   ├── client.js           # REST API wrapper
│   ├── config.js          # Configuration management
│   ├── mappings.js        # Data mappings
│   └── errors.js          # Custom error types
```

### Phase 2: Core Sync (Week 3-4)

**Components:**
- Deployment orchestrator
- Device sync logic
- Interface creation
- IP assignment
- Error handling & rollback

**Deliverables:**
- Full device-to-NetBox sync
- Deployment tracking
- Error recovery

**Code Modules:**
```
backend/
├── netbox/
│   ├── sync.js            # Sync orchestrator
│   ├── device-sync.js     # Device-specific logic
│   └── validators.js      # Pre-deployment validation
├── deployments/
│   └── manager.js         # Deployment lifecycle
```

### Phase 3: UI Integration (Week 5-6)

**Components:**
- Deploy button UI
- Deployment modal
- Status tracking
- History view
- Configuration UI

**Deliverables:**
- Complete user workflow
- Real-time status updates
- Deployment history

**Code Modules:**
```
frontend/
├── deployment-manager.js   # UI component
├── deployment-status.js    # Status tracking
└── netbox-settings.js      # Configuration UI
```

### Phase 4: Polish & Testing (Week 7-8)

**Components:**
- Comprehensive error messages
- Validation rules
- Dry-run mode
- Bulk operations
- Performance optimization

**Deliverables:**
- Production-ready integration
- Complete test coverage
- User documentation

---

## Code Examples

### NetBox Client Implementation

```javascript
// backend/netbox/client.js
const axios = require('axios');

class NetBoxClient {
  constructor(config) {
    this.baseURL = config.url;
    this.token = config.token;

    this.axios = axios.create({
      baseURL: this.baseURL,
      headers: {
        'Authorization': `Token ${this.token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json; indent=4'
      },
      timeout: 30000
    });
  }

  // Devices
  async getDevices(filters = {}) {
    const response = await this.axios.get('/api/dcim/devices/', { params: filters });
    return response.data.results;
  }

  async getDeviceByName(name, siteId) {
    const devices = await this.getDevices({ name, site_id: siteId });
    return devices.length > 0 ? devices[0] : null;
  }

  async createDevice(data) {
    const response = await this.axios.post('/api/dcim/devices/', data);
    return response.data;
  }

  async updateDevice(id, data) {
    const response = await this.axios.patch(`/api/dcim/devices/${id}/`, data);
    return response.data;
  }

  // Interfaces
  async createInterface(data) {
    const response = await this.axios.post('/api/dcim/interfaces/', data);
    return response.data;
  }

  async getInterfacesByDevice(deviceId) {
    const response = await this.axios.get('/api/dcim/interfaces/', {
      params: { device_id: deviceId }
    });
    return response.data.results;
  }

  // IP Addresses
  async getIPAddress(address) {
    const response = await this.axios.get('/api/ipam/ip-addresses/', {
      params: { address }
    });
    return response.data.results.length > 0 ? response.data.results[0] : null;
  }

  async createIPAddress(data) {
    const response = await this.axios.post('/api/ipam/ip-addresses/', data);
    return response.data;
  }

  async assignIPToInterface(ipId, interfaceId) {
    const response = await this.axios.patch(`/api/ipam/ip-addresses/${ipId}/`, {
      assigned_object_type: 'dcim.interface',
      assigned_object_id: interfaceId
    });
    return response.data;
  }

  async setDevicePrimaryIP(deviceId, ipId) {
    const response = await this.axios.patch(`/api/dcim/devices/${deviceId}/`, {
      primary_ip4: ipId
    });
    return response.data;
  }

  // Lookups
  async getDeviceTypes(filters = {}) {
    const response = await this.axios.get('/api/dcim/device-types/', { params: filters });
    return response.data.results;
  }

  async getDeviceRoles(filters = {}) {
    const response = await this.axios.get('/api/dcim/device-roles/', { params: filters });
    return response.data.results;
  }

  async getSites(filters = {}) {
    const response = await this.axios.get('/api/dcim/sites/', { params: filters });
    return response.data.results;
  }

  // Utility
  async testConnection() {
    try {
      await this.axios.get('/api/status/');
      return { success: true, message: 'Connected to NetBox' };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }
}

module.exports = NetBoxClient;
```

### Configuration Manager

```javascript
// backend/netbox/config.js
const db = require('../database');

class NetBoxConfig {
  constructor() {
    this.url = process.env.NETBOX_URL;
    this.token = process.env.NETBOX_TOKEN;
    this.mappings = new Map();
  }

  async loadMappings() {
    const result = await db.query(
      'SELECT * FROM archiflow.netbox_mappings'
    );

    for (const row of result.rows) {
      const key = `${row.mapping_type}:${row.archiflow_key}`;
      this.mappings.set(key, {
        netbox_id: row.netbox_id,
        netbox_name: row.netbox_name,
        netbox_data: row.netbox_data
      });
    }
  }

  getMappedSite(archiflowSiteId) {
    const mapping = this.mappings.get(`site:${archiflowSiteId}`);
    if (!mapping) {
      throw new Error(`No NetBox site mapping found for ArchiFlow site ${archiflowSiteId}`);
    }
    return mapping.netbox_id;
  }

  getMappedDeviceType(manufacturer, model) {
    const key = `device_type:${manufacturer} ${model}`;
    const mapping = this.mappings.get(key);
    if (!mapping) {
      throw new Error(`No NetBox device type mapping found for ${manufacturer} ${model}`);
    }
    return mapping.netbox_id;
  }

  getMappedDeviceRole(deviceType) {
    const mapping = this.mappings.get(`device_role:${deviceType}`);
    if (!mapping) {
      throw new Error(`No NetBox device role mapping found for ${deviceType}`);
    }
    return mapping.netbox_id;
  }
}

module.exports = NetBoxConfig;
```

---

## Error Handling

### Common Errors

#### Authentication Errors
```javascript
try {
  await netbox.getDevices();
} catch (error) {
  if (error.response?.status === 401) {
    throw new Error('Invalid NetBox API token');
  }
  if (error.response?.status === 403) {
    throw new Error('NetBox token does not have required permissions');
  }
}
```

#### Validation Errors
```javascript
try {
  await netbox.createDevice(data);
} catch (error) {
  if (error.response?.status === 400) {
    // NetBox returns detailed validation errors
    const errors = error.response.data;
    console.error('Validation errors:', errors);
    // Example: {"device_type": ["This field is required"]}
  }
}
```

#### Conflict Errors
```javascript
try {
  await netbox.createDevice({ name: 'SW-01', ... });
} catch (error) {
  if (error.response?.status === 409) {
    // Device with this name already exists
    console.warn('Device already exists, updating instead');
    const existing = await netbox.getDeviceByName('SW-01');
    await netbox.updateDevice(existing.id, data);
  }
}
```

### Retry Logic

```javascript
async function withRetry(fn, maxRetries = 3, delay = 1000) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxRetries) throw error;

      // Don't retry client errors (4xx)
      if (error.response?.status >= 400 && error.response?.status < 500) {
        throw error;
      }

      console.warn(`Attempt ${attempt} failed, retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
      delay *= 2; // Exponential backoff
    }
  }
}

// Usage
await withRetry(() => netbox.createDevice(data));
```

---

## Testing & Validation

### Pre-Deployment Validation

```javascript
async function validateDeployment(diagram_id) {
  const errors = [];

  // Check devices exist
  const devices = await getDevicesFromDiagram(diagram_id);
  if (devices.length === 0) {
    errors.push('No devices found in diagram');
  }

  // Check all devices have IPs
  for (const device of devices) {
    if (!device.ip_address) {
      errors.push(`Device ${device.name} has no IP address allocated`);
    }
  }

  // Check mappings exist
  const missingMappings = [];
  for (const device of devices) {
    try {
      await config.getMappedDeviceType(device.manufacturer, device.model);
    } catch (e) {
      missingMappings.push(`Device type: ${device.manufacturer} ${device.model}`);
    }
  }

  if (missingMappings.length > 0) {
    errors.push(`Missing NetBox mappings: ${missingMappings.join(', ')}`);
  }

  return {
    valid: errors.length === 0,
    errors,
    deviceCount: devices.length
  };
}
```

### Dry-Run Mode

```javascript
async function dryRunDeployment(deployment_id) {
  const deployment = await getDeployment(deployment_id);
  const devices = await getDevicesFromDiagram(deployment.diagram_id);

  const plan = [];

  for (const device of devices) {
    const existing = await netbox.getDeviceByName(device.name, deployment.site_id);

    plan.push({
      device: device.name,
      action: existing ? 'UPDATE' : 'CREATE',
      ip_address: device.ip_address,
      netbox_id: existing?.id,
      changes: existing ? compareDevices(existing, device) : null
    });
  }

  return {
    total_devices: devices.length,
    new_devices: plan.filter(p => p.action === 'CREATE').length,
    updated_devices: plan.filter(p => p.action === 'UPDATE').length,
    plan
  };
}
```

### Integration Tests

```javascript
describe('NetBox Integration', () => {
  let netbox;

  beforeAll(async () => {
    netbox = new NetBoxClient({
      url: process.env.NETBOX_TEST_URL,
      token: process.env.NETBOX_TEST_TOKEN
    });
  });

  it('should authenticate successfully', async () => {
    const result = await netbox.testConnection();
    expect(result.success).toBe(true);
  });

  it('should create device, interface, and IP', async () => {
    // Create device
    const device = await netbox.createDevice({
      name: 'TEST-SW-01',
      device_type: 45,
      device_role: 3,
      site: 2,
      status: 'active'
    });
    expect(device.id).toBeDefined();

    // Create interface
    const interface = await netbox.createInterface({
      device: device.id,
      name: 'Management',
      type: '1000base-t'
    });
    expect(interface.id).toBeDefined();

    // Create and assign IP
    const ip = await netbox.createIPAddress({
      address: '192.168.1.100/24',
      status: 'active'
    });
    await netbox.assignIPToInterface(ip.id, interface.id);
    await netbox.setDevicePrimaryIP(device.id, ip.id);

    // Verify
    const updatedDevice = await netbox.getDeviceByName('TEST-SW-01', 2);
    expect(updatedDevice.primary_ip4.id).toBe(ip.id);

    // Cleanup
    await netbox.axios.delete(`/api/dcim/devices/${device.id}/`);
  });
});
```

---

## Configuration Examples

### Environment Variables

```bash
# .env
NETBOX_URL=https://netbox.company.local
NETBOX_TOKEN=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0
NETBOX_TIMEOUT=30000
NETBOX_RETRY_ATTEMPTS=3
```

### Mapping Configuration

```sql
-- Initial setup: Map ArchiFlow sites to NetBox sites
INSERT INTO archiflow.netbox_mappings (mapping_type, archiflow_key, netbox_id, netbox_name)
SELECT 'site', id::text, id, name
FROM archiflow.sites;

-- Map device types
INSERT INTO archiflow.netbox_mappings (mapping_type, archiflow_key, netbox_id, netbox_name)
VALUES
  ('device_type', 'Cisco C9200-24P', 45, 'Catalyst C9200-24P'),
  ('device_type', 'Cisco ISR4331', 46, 'ISR 4331');

-- Map device roles
INSERT INTO archiflow.netbox_mappings (mapping_type, archiflow_key, netbox_id, netbox_name)
VALUES
  ('device_role', 'switch', 3, 'Access Switch'),
  ('device_role', 'router', 4, 'Core Router'),
  ('device_role', 'firewall', 5, 'Firewall');
```

---

## Next Steps

1. **Review** this document with your team
2. **Configure** NetBox test instance
3. **Create** API token with write permissions
4. **Set up** mapping table
5. **Implement** Phase 1 (Foundation)
6. **Test** with single device deployment
7. **Iterate** based on real-world usage

---

## References

- [NetBox Official Documentation](https://docs.netbox.dev/)
- [NetBox REST API Guide](https://docs.netbox.dev/en/stable/integrations/rest-api/)
- [NetBox GitHub Repository](https://github.com/netbox-community/netbox)
- [ArchiFlow Project Repository](https://github.com/RonTitans/archiflow_diagram_plugin)

---

**Document Version:** 1.0
**Last Updated:** October 8, 2024
**Author:** ArchiFlow Development Team

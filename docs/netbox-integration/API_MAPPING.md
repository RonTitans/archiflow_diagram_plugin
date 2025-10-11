# ArchiFlow ↔ NetBox API Mapping Reference

## Table of Contents
1. [Overview](#overview)
2. [Site Mapping](#site-mapping)
3. [Device Mapping](#device-mapping)
4. [Device Type Mapping](#device-type-mapping)
5. [Interface Mapping](#interface-mapping)
6. [IP Address Mapping](#ip-address-mapping)
7. [VLAN Mapping](#vlan-mapping)
8. [Custom Fields](#custom-fields)
9. [Example API Payloads](#example-api-payloads)
10. [Conflict Resolution](#conflict-resolution)

---

## Overview

This document provides a complete field-by-field mapping between ArchiFlow's database schema and NetBox's REST API. Each section includes:

- **ArchiFlow Field**: Column name and data type
- **NetBox API Field**: JSON field name and expected format
- **Transformation**: Any data conversion required
- **Required/Optional**: Whether the field is mandatory
- **Default Value**: Fallback if ArchiFlow field is null
- **Example Payload**: Actual JSON structure for API calls

---

## Site Mapping

### Table: `archiflow.sites` → NetBox API: `/api/dcim/sites/`

| ArchiFlow Field | Type | NetBox Field | NetBox Type | Required | Transformation | Notes |
|----------------|------|--------------|-------------|----------|----------------|-------|
| `id` | INTEGER | `custom_fields.archiflow_id` | Integer | No | Direct copy | Store ArchiFlow ID in custom field |
| `name` | VARCHAR(255) | `name` | String | **Yes** | Direct copy | Must be unique in NetBox |
| `slug` | VARCHAR(50) | `slug` | String | **Yes** | Direct copy or generate | Auto-generated from name if null |
| `site_code` | VARCHAR(10) | `custom_fields.site_code` | String | No | Direct copy | Store in custom field |
| `status` | VARCHAR(50) | `status` | String | **Yes** | Map values | active→active, inactive→planned |
| `description` | TEXT | `description` | String | No | Direct copy | Long text field |
| `metadata` | JSONB | `custom_fields.*` | Various | No | Flatten to custom fields | Extract key-value pairs |

### Status Mapping

| ArchiFlow Status | NetBox Status | Description |
|-----------------|---------------|-------------|
| `active` | `active` | Operational site |
| `inactive` | `planned` | Site not yet active |
| `decommissioned` | `decommissioned` | Site shut down |

### Example API Call

**Create Site:**
```http
POST /api/dcim/sites/
Content-Type: application/json
Authorization: Token abc123...

{
    "name": "Backup Site",
    "slug": "backup-site",
    "status": "active",
    "description": "Disaster recovery site",
    "custom_fields": {
        "archiflow_id": 2,
        "site_code": "BACKUP"
    }
}
```

**Response:**
```json
{
    "id": 5,
    "url": "https://netbox.local/api/dcim/sites/5/",
    "name": "Backup Site",
    "slug": "backup-site",
    "status": {
        "value": "active",
        "label": "Active"
    },
    "custom_fields": {
        "archiflow_id": 2,
        "site_code": "BACKUP"
    }
}
```

---

## Device Mapping

### Table: `archiflow.network_devices` → NetBox API: `/api/dcim/devices/`

| ArchiFlow Field | Type | NetBox Field | NetBox Type | Required | Transformation | Notes |
|----------------|------|--------------|-------------|----------|----------------|-------|
| `id` | UUID | `custom_fields.archiflow_id` | String | No | Convert to string | Store UUID as string |
| `name` | VARCHAR(255) | `name` | String | **Yes** | Direct copy | Must be unique per site |
| `device_type` | VARCHAR(50) | `device_type` | Object | **Yes** | Map to device type slug | Must exist in NetBox |
| `manufacturer` | VARCHAR(100) | N/A | - | - | Used to match device_type | Not directly mapped |
| `model` | VARCHAR(100) | N/A | - | - | Used to match device_type | Not directly mapped |
| `serial_number` | VARCHAR(255) | `serial` | String | No | Direct copy | Must be unique if provided |
| `asset_id` | VARCHAR(100) | `asset_tag` | String | No | Direct copy | Must be unique if provided |
| `status` | VARCHAR(50) | `status` | String | **Yes** | Map values | See status mapping below |
| `location` | VARCHAR(255) | `location` | Object | No | Map to location slug | Must exist in NetBox |
| `rack_position` | VARCHAR(50) | `position` | Number | No | Parse to integer | Requires rack assignment |
| `site_id` | INTEGER | `site` | Object | **Yes** | Map to site slug | Must exist in NetBox |
| `metadata` | JSONB | `custom_fields.*` | Various | No | Flatten to custom fields | Extract key-value pairs |
| `created_at` | TIMESTAMP | `custom_fields.created_at` | Date | No | ISO 8601 format | Store in custom field |
| `created_by` | VARCHAR(100) | `custom_fields.created_by` | String | No | Direct copy | Store in custom field |

### Device Status Mapping

| ArchiFlow Status | NetBox Status | Description |
|-----------------|---------------|-------------|
| `active` | `active` | Device is operational |
| `inactive` | `offline` | Device is not running |
| `maintenance` | `planned` | Device under maintenance |
| `decommissioned` | `decommissioning` | Device being removed |

### Device Type Mapping

| ArchiFlow `device_type` | NetBox `device_type.slug` | NetBox `device_role` |
|------------------------|---------------------------|---------------------|
| `router` | `{model-slug}` (e.g., `cisco-isr-4331`) | `router` |
| `switch` | `{model-slug}` (e.g., `cisco-c9200-24p`) | `switch` |
| `firewall` | `{model-slug}` (e.g., `fortigate-60f`) | `firewall` |
| `server` | `{model-slug}` (e.g., `dell-poweredge-r740`) | `server` |
| `load_balancer` | `{model-slug}` (e.g., `f5-bigip-ve`) | `load-balancer` |
| `access_point` | `{model-slug}` (e.g., `cisco-ap-3802i`) | `access-point` |
| `workstation` | `{model-slug}` (e.g., `generic-workstation`) | `endpoint` |

**Note:** Device types and manufacturers must be pre-created in NetBox before devices can be added.

### Example API Call

**Create Device:**
```http
POST /api/dcim/devices/
Content-Type: application/json
Authorization: Token abc123...

{
    "name": "SW-BACKUP-01",
    "device_type": {
        "slug": "cisco-c9200-24p"
    },
    "device_role": {
        "slug": "switch"
    },
    "site": {
        "slug": "backup-site"
    },
    "status": "active",
    "serial": "FCW1234ABCD",
    "asset_tag": "ASSET-001",
    "custom_fields": {
        "archiflow_id": "6e46b5db-7279-40b7-b6c6-929bb96d0817",
        "archiflow_diagram": "f7a3c2d1-8b9e-4f5a-a1b2-c3d4e5f6a7b8",
        "created_at": "2025-10-08T10:20:17Z",
        "created_by": "system"
    }
}
```

**Response:**
```json
{
    "id": 42,
    "url": "https://netbox.local/api/dcim/devices/42/",
    "name": "SW-BACKUP-01",
    "device_type": {
        "id": 15,
        "url": "https://netbox.local/api/dcim/device-types/15/",
        "manufacturer": {
            "id": 2,
            "name": "Cisco"
        },
        "model": "C9200-24P",
        "slug": "cisco-c9200-24p"
    },
    "device_role": {
        "id": 3,
        "name": "Switch",
        "slug": "switch"
    },
    "site": {
        "id": 5,
        "name": "Backup Site",
        "slug": "backup-site"
    },
    "status": {
        "value": "active",
        "label": "Active"
    },
    "serial": "FCW1234ABCD",
    "asset_tag": "ASSET-001",
    "primary_ip4": null,
    "primary_ip6": null,
    "custom_fields": {
        "archiflow_id": "6e46b5db-7279-40b7-b6c6-929bb96d0817",
        "archiflow_diagram": "f7a3c2d1-8b9e-4f5a-a1b2-c3d4e5f6a7b8",
        "created_at": "2025-10-08T10:20:17Z",
        "created_by": "system"
    }
}
```

---

## Device Type Mapping

### Table: `archiflow.device_templates` → NetBox API: `/api/dcim/device-types/`

| ArchiFlow Field | Type | NetBox Field | NetBox Type | Required | Transformation | Notes |
|----------------|------|--------------|-------------|----------|----------------|-------|
| `id` | UUID | `custom_fields.archiflow_template_id` | String | No | Convert to string | Store UUID as string |
| `name` | VARCHAR(255) | `model` | String | **Yes** | Direct copy | Device model name |
| `device_type` | VARCHAR(50) | N/A | - | - | Not mapped | Used for filtering |
| `manufacturer` | VARCHAR(100) | `manufacturer` | Object | **Yes** | Map to manufacturer slug | Must exist in NetBox |
| `model` | VARCHAR(100) | `model` | String | **Yes** | Use if different from name | Usually same as name |
| `default_ports` | INTEGER | N/A | - | - | Not directly mapped | Used to create interfaces |
| `port_naming_pattern` | VARCHAR(100) | N/A | - | - | Not directly mapped | Used for interface naming |
| `default_width` | INTEGER | `u_height` | Number | No | Divide by 44.45 (mm to U) | 1U ≈ 44.45mm |
| `default_height` | INTEGER | N/A | - | - | Not mapped | Visual only |
| `category` | VARCHAR(50) | N/A | - | - | Not mapped | ArchiFlow-specific |
| `metadata` | JSONB | `custom_fields.*` | Various | No | Flatten to custom fields | Extract key-value pairs |

### Manufacturer Mapping

| ArchiFlow Manufacturer | NetBox Manufacturer Slug | Notes |
|-----------------------|-------------------------|-------|
| `Cisco` | `cisco` | Network equipment |
| `Fortinet` | `fortinet` | Security appliances |
| `Dell` | `dell` | Servers and storage |
| `HP` / `HPE` | `hpe` | Enterprise equipment |
| `F5` | `f5-networks` | Load balancers |
| `Juniper` | `juniper` | Network equipment |
| `Arista` | `arista` | Data center switches |
| `Palo Alto` | `palo-alto-networks` | Firewalls |
| `Generic` | `generic` | Generic devices |

### Example API Call

**Create Device Type:**
```http
POST /api/dcim/device-types/
Content-Type: application/json
Authorization: Token abc123...

{
    "manufacturer": {
        "slug": "cisco"
    },
    "model": "C9200-24P",
    "slug": "cisco-c9200-24p",
    "u_height": 1,
    "is_full_depth": true,
    "custom_fields": {
        "archiflow_template_id": "template-uuid-123",
        "default_ports": 24,
        "port_naming_pattern": "GigabitEthernet1/0/{port}"
    }
}
```

**Response:**
```json
{
    "id": 15,
    "url": "https://netbox.local/api/dcim/device-types/15/",
    "manufacturer": {
        "id": 2,
        "name": "Cisco",
        "slug": "cisco"
    },
    "model": "C9200-24P",
    "slug": "cisco-c9200-24p",
    "u_height": 1,
    "is_full_depth": true,
    "custom_fields": {
        "archiflow_template_id": "template-uuid-123",
        "default_ports": 24,
        "port_naming_pattern": "GigabitEthernet1/0/{port}"
    }
}
```

---

## Interface Mapping

### Table: `archiflow.port_connections` → NetBox API: `/api/dcim/interfaces/`

| ArchiFlow Field | Type | NetBox Field | NetBox Type | Required | Transformation | Notes |
|----------------|------|--------------|-------------|----------|----------------|-------|
| `id` | UUID | `custom_fields.archiflow_connection_id` | String | No | Convert to string | Store UUID as string |
| `source_device_id` | UUID | `device` | Object | **Yes** | Map to NetBox device ID | Device must exist |
| `source_port` | VARCHAR(50) | `name` | String | **Yes** | Direct copy | Interface name |
| `connection_type` | VARCHAR(50) | `type` | String | **Yes** | Map to interface type | See type mapping below |
| `bandwidth` | VARCHAR(20) | `speed` | Integer | No | Parse to Kbps | "1G" → 1000000 |
| `duplex` | VARCHAR(20) | `duplex` | String | No | Map values | full/half/auto |
| `vlan_ids` | INTEGER[] | `untagged_vlan` / `tagged_vlans` | Objects | No | Map to VLAN objects | VLANs must exist |
| `is_trunk` | BOOLEAN | `mode` | String | No | true→tagged, false→access | Interface mode |
| `status` | VARCHAR(50) | `enabled` | Boolean | **Yes** | active→true, inactive→false | Simple boolean |

### Interface Type Mapping

| ArchiFlow `connection_type` | NetBox `interface.type` | Speed (default) |
|----------------------------|------------------------|-----------------|
| `ethernet` | `1000base-t` | 1 Gbps |
| `fiber` | `10gbase-x-sfpp` | 10 Gbps |
| `wireless` | `ieee802.11ac` | N/A |
| `vpn` | `virtual` | N/A |
| `internet` | `other` | N/A |
| `serial` | `serial` | N/A |
| `console` | `console` | N/A |

### Example API Call

**Create Interface:**
```http
POST /api/dcim/interfaces/
Content-Type: application/json
Authorization: Token abc123...

{
    "device": 42,
    "name": "GigabitEthernet1/0/1",
    "type": "1000base-t",
    "enabled": true,
    "mode": "access",
    "untagged_vlan": {
        "id": 10
    },
    "description": "Connection to FW-BACKUP-01",
    "custom_fields": {
        "archiflow_connection_id": "conn-uuid-456"
    }
}
```

**Response:**
```json
{
    "id": 101,
    "url": "https://netbox.local/api/dcim/interfaces/101/",
    "device": {
        "id": 42,
        "name": "SW-BACKUP-01"
    },
    "name": "GigabitEthernet1/0/1",
    "type": {
        "value": "1000base-t",
        "label": "1000BASE-T (1GE)"
    },
    "enabled": true,
    "mode": {
        "value": "access",
        "label": "Access"
    },
    "untagged_vlan": {
        "id": 10,
        "name": "DMZ"
    },
    "tagged_vlans": [],
    "description": "Connection to FW-BACKUP-01",
    "custom_fields": {
        "archiflow_connection_id": "conn-uuid-456"
    }
}
```

**Create Cable Connection:**
```http
POST /api/dcim/cables/
Content-Type: application/json
Authorization: Token abc123...

{
    "a_terminations": [
        {
            "object_type": "dcim.interface",
            "object_id": 101
        }
    ],
    "b_terminations": [
        {
            "object_type": "dcim.interface",
            "object_id": 102
        }
    ],
    "type": "cat6",
    "status": "connected",
    "label": "Connection: SW-BACKUP-01 → FW-BACKUP-01"
}
```

---

## IP Address Mapping

### Table: `archiflow.ip_addresses` → NetBox API: `/api/ipam/ip-addresses/`

| ArchiFlow Field | Type | NetBox Field | NetBox Type | Required | Transformation | Notes |
|----------------|------|--------------|-------------|----------|----------------|-------|
| `id` | UUID | `custom_fields.archiflow_ip_id` | String | No | Convert to string | Store UUID as string |
| `ip_address` | INET | `address` | String | **Yes** | Add CIDR prefix if missing | Must include /prefix |
| `device_id` | UUID | `assigned_object_id` | Integer | No | Map to NetBox device ID | Device must exist |
| `device_name` | VARCHAR(255) | `dns_name` | String | No | Convert to FQDN | device-name.domain.com |
| `is_gateway` | BOOLEAN | `role` | String | No | true→gateway, false→null | Special role |
| `is_reserved` | BOOLEAN | `status` | String | No | true→reserved, false→active | Status field |
| `allocated_at` | TIMESTAMP | `custom_fields.allocated_at` | Date | No | ISO 8601 format | Store in custom field |
| `notes` | TEXT | `description` | String | No | Direct copy | Long text field |

### IP Status Mapping

| ArchiFlow Condition | NetBox `status` | Description |
|--------------------|----------------|-------------|
| `is_reserved=true` | `reserved` | IP reserved for special use |
| `is_gateway=true` | `active` (role=gateway) | Gateway IP |
| `device_id IS NOT NULL` | `active` | IP assigned to device |
| `device_id IS NULL` | `available` | IP not yet allocated |

### CIDR Prefix Handling

```javascript
// ArchiFlow stores IPs as INET (may not include prefix)
// NetBox requires CIDR notation with prefix

function formatIPForNetBox(archiflowIP, poolNetwork) {
    // If IP already has prefix: "172.16.40.3/24" → use as-is
    if (archiflowIP.includes('/')) {
        return archiflowIP;
    }

    // Otherwise, get prefix from pool
    // poolNetwork: "172.16.40.0/24" → extract "/24"
    const prefix = poolNetwork.split('/')[1];
    return `${archiflowIP}/${prefix}`;
}

// Example:
// Input: "172.16.40.3" (ArchiFlow)
// Pool: "172.16.40.0/24"
// Output: "172.16.40.3/24" (NetBox)
```

### Example API Call

**Create IP Address:**
```http
POST /api/ipam/ip-addresses/
Content-Type: application/json
Authorization: Token abc123...

{
    "address": "172.16.40.3/24",
    "status": "active",
    "role": null,
    "assigned_object_type": "dcim.interface",
    "assigned_object_id": 101,
    "dns_name": "sw-backup-01.company.local",
    "description": "Primary IP for SW-BACKUP-01",
    "custom_fields": {
        "archiflow_ip_id": "ip-uuid-789",
        "allocated_at": "2025-10-08T10:20:17Z",
        "pool_name": "DMZ Network"
    }
}
```

**Response:**
```json
{
    "id": 201,
    "url": "https://netbox.local/api/ipam/ip-addresses/201/",
    "address": "172.16.40.3/24",
    "vrf": null,
    "status": {
        "value": "active",
        "label": "Active"
    },
    "role": null,
    "assigned_object_type": "dcim.interface",
    "assigned_object_id": 101,
    "assigned_object": {
        "id": 101,
        "url": "https://netbox.local/api/dcim/interfaces/101/",
        "device": {
            "id": 42,
            "name": "SW-BACKUP-01"
        },
        "name": "GigabitEthernet1/0/1"
    },
    "dns_name": "sw-backup-01.company.local",
    "description": "Primary IP for SW-BACKUP-01",
    "custom_fields": {
        "archiflow_ip_id": "ip-uuid-789",
        "allocated_at": "2025-10-08T10:20:17Z",
        "pool_name": "DMZ Network"
    }
}
```

**Set as Primary IP:**
```http
PATCH /api/dcim/devices/42/
Content-Type: application/json
Authorization: Token abc123...

{
    "primary_ip4": 201
}
```

---

## VLAN Mapping

### Table: `archiflow.vlans` → NetBox API: `/api/ipam/vlans/`

| ArchiFlow Field | Type | NetBox Field | NetBox Type | Required | Transformation | Notes |
|----------------|------|--------------|-------------|----------|----------------|-------|
| `id` | INTEGER | `vid` | Integer | **Yes** | Direct copy | VLAN ID (1-4094) |
| `name` | VARCHAR(255) | `name` | String | **Yes** | Direct copy | VLAN name |
| `description` | TEXT | `description` | String | No | Direct copy | Long text field |
| `site_id` | INTEGER | `site` | Object | No | Map to site slug | Must exist in NetBox |
| `is_active` | BOOLEAN | `status` | String | **Yes** | true→active, false→deprecated | Status field |

### Example API Call

**Create VLAN:**
```http
POST /api/ipam/vlans/
Content-Type: application/json
Authorization: Token abc123...

{
    "vid": 40,
    "name": "DMZ",
    "description": "Demilitarized Zone",
    "site": {
        "slug": "backup-site"
    },
    "status": "active"
}
```

**Response:**
```json
{
    "id": 10,
    "url": "https://netbox.local/api/ipam/vlans/10/",
    "vid": 40,
    "name": "DMZ",
    "description": "Demilitarized Zone",
    "site": {
        "id": 5,
        "name": "Backup Site",
        "slug": "backup-site"
    },
    "status": {
        "value": "active",
        "label": "Active"
    }
}
```

---

## Custom Fields

### Required Custom Fields in NetBox

To enable full integration, create these custom fields in NetBox:

#### 1. Device Custom Fields

```python
# NetBox custom field definitions
DEVICE_CUSTOM_FIELDS = [
    {
        "name": "archiflow_id",
        "label": "ArchiFlow Device ID",
        "type": "text",
        "content_types": ["dcim.device"],
        "description": "UUID of device in ArchiFlow database"
    },
    {
        "name": "archiflow_diagram",
        "label": "ArchiFlow Diagram ID",
        "type": "text",
        "content_types": ["dcim.device"],
        "description": "UUID of diagram where device was created"
    },
    {
        "name": "created_at",
        "label": "Creation Date",
        "type": "date",
        "content_types": ["dcim.device"],
        "description": "Device creation timestamp from ArchiFlow"
    },
    {
        "name": "created_by",
        "label": "Created By",
        "type": "text",
        "content_types": ["dcim.device"],
        "description": "User who created device in ArchiFlow"
    }
]
```

#### 2. IP Address Custom Fields

```python
IP_ADDRESS_CUSTOM_FIELDS = [
    {
        "name": "archiflow_ip_id",
        "label": "ArchiFlow IP ID",
        "type": "text",
        "content_types": ["ipam.ipaddress"],
        "description": "UUID of IP address in ArchiFlow database"
    },
    {
        "name": "allocated_at",
        "label": "Allocation Date",
        "type": "date",
        "content_types": ["ipam.ipaddress"],
        "description": "IP allocation timestamp from ArchiFlow"
    },
    {
        "name": "pool_name",
        "label": "IP Pool Name",
        "type": "text",
        "content_types": ["ipam.ipaddress"],
        "description": "Name of IP pool in ArchiFlow"
    }
]
```

#### 3. Site Custom Fields

```python
SITE_CUSTOM_FIELDS = [
    {
        "name": "archiflow_id",
        "label": "ArchiFlow Site ID",
        "type": "integer",
        "content_types": ["dcim.site"],
        "description": "Site ID in ArchiFlow database"
    },
    {
        "name": "site_code",
        "label": "Site Code",
        "type": "text",
        "content_types": ["dcim.site"],
        "description": "Short site code for device naming"
    }
]
```

### Creating Custom Fields via API

```http
POST /api/extras/custom-fields/
Content-Type: application/json
Authorization: Token abc123...

{
    "name": "archiflow_id",
    "label": "ArchiFlow Device ID",
    "type": "text",
    "content_types": ["dcim.device"],
    "description": "UUID of device in ArchiFlow database",
    "required": false,
    "ui_visible": "always",
    "ui_editable": "yes"
}
```

---

## Example API Payloads

### Complete Device Sync Payload

This example shows the complete sequence of API calls to sync a device from ArchiFlow to NetBox.

#### 1. Check if Device Exists

```http
GET /api/dcim/devices/?name=SW-BACKUP-01
Authorization: Token abc123...
```

**Response (not found):**
```json
{
    "count": 0,
    "next": null,
    "previous": null,
    "results": []
}
```

#### 2. Create Device

```http
POST /api/dcim/devices/
Content-Type: application/json
Authorization: Token abc123...

{
    "name": "SW-BACKUP-01",
    "device_type": {
        "slug": "cisco-c9200-24p"
    },
    "device_role": {
        "slug": "switch"
    },
    "site": {
        "slug": "backup-site"
    },
    "status": "active",
    "serial": "FCW1234ABCD",
    "asset_tag": "ASSET-001",
    "rack": null,
    "position": null,
    "face": null,
    "comments": "Synced from ArchiFlow diagram 'DMZ Network Diagram'",
    "custom_fields": {
        "archiflow_id": "6e46b5db-7279-40b7-b6c6-929bb96d0817",
        "archiflow_diagram": "f7a3c2d1-8b9e-4f5a-a1b2-c3d4e5f6a7b8",
        "created_at": "2025-10-08",
        "created_by": "system"
    }
}
```

**Response:**
```json
{
    "id": 42,
    "url": "https://netbox.local/api/dcim/devices/42/",
    "name": "SW-BACKUP-01",
    "device_type": {
        "id": 15,
        "manufacturer": {
            "id": 2,
            "name": "Cisco",
            "slug": "cisco"
        },
        "model": "C9200-24P",
        "slug": "cisco-c9200-24p"
    },
    "device_role": {
        "id": 3,
        "name": "Switch",
        "slug": "switch"
    },
    "site": {
        "id": 5,
        "name": "Backup Site",
        "slug": "backup-site"
    },
    "status": {
        "value": "active",
        "label": "Active"
    },
    "serial": "FCW1234ABCD",
    "asset_tag": "ASSET-001",
    "primary_ip4": null,
    "primary_ip6": null,
    "custom_fields": {
        "archiflow_id": "6e46b5db-7279-40b7-b6c6-929bb96d0817",
        "archiflow_diagram": "f7a3c2d1-8b9e-4f5a-a1b2-c3d4e5f6a7b8",
        "created_at": "2025-10-08",
        "created_by": "system"
    }
}
```

#### 3. Create Interface

```http
POST /api/dcim/interfaces/
Content-Type: application/json
Authorization: Token abc123...

{
    "device": 42,
    "name": "GigabitEthernet1/0/1",
    "type": "1000base-t",
    "enabled": true,
    "mtu": 1500,
    "mode": "access",
    "untagged_vlan": {
        "vid": 40,
        "site": {
            "slug": "backup-site"
        }
    },
    "description": "Primary interface"
}
```

**Response:**
```json
{
    "id": 101,
    "url": "https://netbox.local/api/dcim/interfaces/101/",
    "device": {
        "id": 42,
        "name": "SW-BACKUP-01"
    },
    "name": "GigabitEthernet1/0/1",
    "type": {
        "value": "1000base-t",
        "label": "1000BASE-T (1GE)"
    },
    "enabled": true,
    "mtu": 1500,
    "mode": {
        "value": "access",
        "label": "Access"
    },
    "untagged_vlan": {
        "id": 10,
        "vid": 40,
        "name": "DMZ"
    }
}
```

#### 4. Create IP Address

```http
POST /api/ipam/ip-addresses/
Content-Type: application/json
Authorization: Token abc123...

{
    "address": "172.16.40.3/24",
    "vrf": null,
    "status": "active",
    "role": null,
    "assigned_object_type": "dcim.interface",
    "assigned_object_id": 101,
    "nat_inside": null,
    "dns_name": "sw-backup-01.company.local",
    "description": "Primary IP address",
    "custom_fields": {
        "archiflow_ip_id": "ip-uuid-789",
        "allocated_at": "2025-10-08",
        "pool_name": "DMZ Network"
    }
}
```

**Response:**
```json
{
    "id": 201,
    "url": "https://netbox.local/api/ipam/ip-addresses/201/",
    "address": "172.16.40.3/24",
    "status": {
        "value": "active",
        "label": "Active"
    },
    "assigned_object_type": "dcim.interface",
    "assigned_object_id": 101,
    "assigned_object": {
        "id": 101,
        "url": "https://netbox.local/api/dcim/interfaces/101/",
        "device": {
            "id": 42,
            "name": "SW-BACKUP-01"
        },
        "name": "GigabitEthernet1/0/1"
    },
    "dns_name": "sw-backup-01.company.local",
    "description": "Primary IP address",
    "custom_fields": {
        "archiflow_ip_id": "ip-uuid-789",
        "allocated_at": "2025-10-08",
        "pool_name": "DMZ Network"
    }
}
```

#### 5. Set Primary IP

```http
PATCH /api/dcim/devices/42/
Content-Type: application/json
Authorization: Token abc123...

{
    "primary_ip4": 201
}
```

**Response:**
```json
{
    "id": 42,
    "name": "SW-BACKUP-01",
    "primary_ip4": {
        "id": 201,
        "address": "172.16.40.3/24"
    },
    "primary_ip6": null
}
```

#### 6. Update ArchiFlow with NetBox IDs

```sql
-- Store NetBox IDs back in ArchiFlow
UPDATE archiflow.network_devices
SET metadata = jsonb_set(
    jsonb_set(metadata, '{netbox_id}', '42'),
    '{netbox_synced_at}',
    to_jsonb(NOW())
)
WHERE id = '6e46b5db-7279-40b7-b6c6-929bb96d0817';

UPDATE archiflow.ip_addresses
SET metadata = jsonb_set(
    jsonb_set(metadata, '{netbox_id}', '201'),
    '{netbox_synced_at}',
    to_jsonb(NOW())
)
WHERE ip_address = '172.16.40.3';
```

---

## Conflict Resolution

### Conflict Scenarios and Resolution Strategies

#### Conflict 1: Device Name Already Exists

**Scenario:**
```
ArchiFlow Device: SW-BACKUP-01
NetBox Query: GET /api/dcim/devices/?name=SW-BACKUP-01
NetBox Result: Device exists (ID: 99) but no archiflow_id match
```

**Resolution Options:**

1. **Update Existing Device (Recommended)**
```javascript
// Check if NetBox device is orphaned (no archiflow_id)
const netboxDevice = await netboxClient.getDevice('SW-BACKUP-01');

if (!netboxDevice.custom_fields.archiflow_id) {
    // Orphaned NetBox device - link to ArchiFlow
    await netboxClient.updateDevice(netboxDevice.id, {
        custom_fields: {
            archiflow_id: archiflowDevice.id,
            archiflow_diagram: diagramId
        }
    });

    // Store NetBox ID in ArchiFlow
    await db.query(`
        UPDATE archiflow.network_devices
        SET metadata = jsonb_set(metadata, '{netbox_id}', $1)
        WHERE id = $2
    `, [netboxDevice.id, archiflowDevice.id]);

    return { action: 'linked', netbox_id: netboxDevice.id };
}
```

2. **Prompt User for Action**
```javascript
// NetBox device belongs to different ArchiFlow device
throw new ConflictError({
    message: `Device name 'SW-BACKUP-01' already exists in NetBox`,
    archiflow_device: archiflowDevice.id,
    netbox_device: netboxDevice.id,
    options: [
        { action: 'rename', label: 'Rename ArchiFlow device' },
        { action: 'update', label: 'Update NetBox device (overwrites)' },
        { action: 'skip', label: 'Skip this device' }
    ]
});
```

3. **Auto-Rename (Fallback)**
```javascript
// Automatically append site code and increment
let newName = `${archiflowDevice.name}-${site.site_code}`;
let counter = 1;

while (await netboxClient.deviceExists(newName)) {
    newName = `${archiflowDevice.name}-${site.site_code}-${counter}`;
    counter++;
}

await netboxClient.createDevice({
    ...devicePayload,
    name: newName
});

// Update ArchiFlow with new name
await db.query(`
    UPDATE archiflow.network_devices
    SET name = $1
    WHERE id = $2
`, [newName, archiflowDevice.id]);
```

#### Conflict 2: IP Address Already Assigned

**Scenario:**
```
ArchiFlow IP: 172.16.40.3
NetBox Query: GET /api/ipam/ip-addresses/?address=172.16.40.3/24
NetBox Result: IP assigned to different device
```

**Resolution:**

```javascript
const netboxIP = await netboxClient.getIPAddress('172.16.40.3/24');

if (netboxIP && netboxIP.assigned_object_id) {
    // IP already assigned to another device
    if (netboxIP.custom_fields.archiflow_ip_id === archiflowIP.id) {
        // Same IP, just update assignment
        await netboxClient.updateIPAddress(netboxIP.id, {
            assigned_object_id: newInterfaceId
        });
        return { action: 'reassigned' };
    } else {
        // IP conflict - must resolve
        throw new ConflictError({
            message: `IP 172.16.40.3 already assigned to ${netboxIP.assigned_object.device.name}`,
            options: [
                { action: 'deallocate', label: 'Release IP from other device' },
                { action: 'allocate_new', label: 'Allocate different IP' },
                { action: 'skip', label: 'Skip IP allocation' }
            ]
        });
    }
}
```

#### Conflict 3: Device Type Not Found

**Scenario:**
```
ArchiFlow Device Type: cisco-c9200-24p
NetBox Query: GET /api/dcim/device-types/?slug=cisco-c9200-24p
NetBox Result: Not found
```

**Resolution:**

```javascript
// Try to find by manufacturer + model
const deviceTypes = await netboxClient.getDeviceTypes({
    manufacturer: 'cisco',
    model: 'C9200-24P'
});

if (deviceTypes.length === 0) {
    // Device type doesn't exist - must create or use generic
    throw new ValidationError({
        message: `Device type 'Cisco C9200-24P' not found in NetBox`,
        options: [
            {
                action: 'create_type',
                label: 'Create device type in NetBox',
                payload: {
                    manufacturer: 'cisco',
                    model: 'C9200-24P',
                    u_height: 1,
                    is_full_depth: true
                }
            },
            {
                action: 'use_generic',
                label: 'Use generic switch type',
                slug: 'generic-switch-24port'
            },
            {
                action: 'skip',
                label: 'Skip this device'
            }
        ]
    });
}
```

#### Conflict 4: Serial Number Duplicate

**Scenario:**
```
ArchiFlow Serial: FCW1234ABCD
NetBox Query: GET /api/dcim/devices/?serial=FCW1234ABCD
NetBox Result: Serial already exists
```

**Resolution:**

```javascript
const existingDevice = await netboxClient.getDeviceBySerial('FCW1234ABCD');

if (existingDevice) {
    if (existingDevice.name === archiflowDevice.name) {
        // Same device, update it
        return await netboxClient.updateDevice(existingDevice.id, devicePayload);
    } else {
        // Different device with same serial - clear serial in ArchiFlow
        console.warn(`Serial number conflict: ${archiflowDevice.serial} already used by ${existingDevice.name}`);

        // Create device without serial
        const newDevice = await netboxClient.createDevice({
            ...devicePayload,
            serial: null  // Clear conflicting serial
        });

        // Log conflict for manual resolution
        await logConflict({
            type: 'serial_conflict',
            archiflow_device: archiflowDevice.id,
            netbox_device: existingDevice.id,
            serial: archiflowDevice.serial
        });

        return newDevice;
    }
}
```

---

## Data Transformation Utilities

### JavaScript Helper Functions

```javascript
class NetBoxMapper {
    /**
     * Convert ArchiFlow device to NetBox device payload
     */
    static mapDevice(archiflowDevice, site, deviceType) {
        return {
            name: archiflowDevice.name,
            device_type: {
                slug: this.getDeviceTypeSlug(archiflowDevice)
            },
            device_role: {
                slug: this.mapDeviceRole(archiflowDevice.device_type)
            },
            site: {
                slug: site.slug
            },
            status: this.mapStatus(archiflowDevice.status),
            serial: archiflowDevice.serial_number || null,
            asset_tag: archiflowDevice.asset_id || null,
            comments: `Synced from ArchiFlow`,
            custom_fields: {
                archiflow_id: archiflowDevice.id,
                archiflow_diagram: archiflowDevice.diagram_id,
                created_at: archiflowDevice.created_at?.toISOString().split('T')[0],
                created_by: archiflowDevice.created_by
            }
        };
    }

    /**
     * Convert ArchiFlow IP to NetBox IP address payload
     */
    static mapIPAddress(archiflowIP, pool, interfaceId) {
        const address = this.ensureCIDR(archiflowIP.ip_address, pool.network);

        return {
            address: address,
            status: this.mapIPStatus(archiflowIP),
            role: archiflowIP.is_gateway ? 'gateway' : null,
            assigned_object_type: interfaceId ? 'dcim.interface' : null,
            assigned_object_id: interfaceId || null,
            dns_name: this.generateFQDN(archiflowIP.device_name),
            description: archiflowIP.notes || `Synced from ArchiFlow pool '${pool.name}'`,
            custom_fields: {
                archiflow_ip_id: archiflowIP.id,
                allocated_at: archiflowIP.allocated_at?.toISOString().split('T')[0],
                pool_name: pool.name
            }
        };
    }

    /**
     * Ensure IP address has CIDR prefix
     */
    static ensureCIDR(ipAddress, poolNetwork) {
        if (ipAddress.includes('/')) {
            return ipAddress;
        }

        const prefix = poolNetwork.split('/')[1];
        return `${ipAddress}/${prefix}`;
    }

    /**
     * Generate FQDN from device name
     */
    static generateFQDN(deviceName, domain = 'company.local') {
        if (!deviceName) return null;

        const hostname = deviceName.toLowerCase().replace(/[^a-z0-9-]/g, '-');
        return `${hostname}.${domain}`;
    }

    /**
     * Map ArchiFlow device_type to NetBox device_role
     */
    static mapDeviceRole(deviceType) {
        const roleMap = {
            'router': 'router',
            'switch': 'switch',
            'firewall': 'firewall',
            'server': 'server',
            'load_balancer': 'load-balancer',
            'access_point': 'access-point',
            'workstation': 'endpoint'
        };

        return roleMap[deviceType] || 'other';
    }

    /**
     * Map ArchiFlow status to NetBox status
     */
    static mapStatus(archiflowStatus) {
        const statusMap = {
            'active': 'active',
            'inactive': 'offline',
            'maintenance': 'planned',
            'decommissioned': 'decommissioning'
        };

        return statusMap[archiflowStatus] || 'active';
    }

    /**
     * Map ArchiFlow IP conditions to NetBox status
     */
    static mapIPStatus(archiflowIP) {
        if (archiflowIP.is_reserved) return 'reserved';
        if (archiflowIP.device_id) return 'active';
        return 'available';
    }

    /**
     * Get NetBox device type slug from ArchiFlow device
     */
    static getDeviceTypeSlug(archiflowDevice) {
        const manufacturer = (archiflowDevice.manufacturer || 'generic').toLowerCase();
        const model = (archiflowDevice.model || archiflowDevice.device_type).toLowerCase()
            .replace(/\s+/g, '-')
            .replace(/[^a-z0-9-]/g, '');

        return `${manufacturer}-${model}`;
    }
}

// Usage Example:
const archiflowDevice = {
    id: '6e46b5db-7279-40b7-b6c6-929bb96d0817',
    name: 'SW-BACKUP-01',
    device_type: 'switch',
    manufacturer: 'Cisco',
    model: 'C9200-24P',
    status: 'active',
    serial_number: 'FCW1234ABCD',
    created_at: new Date('2025-10-08T10:20:17Z')
};

const netboxPayload = NetBoxMapper.mapDevice(archiflowDevice, site, deviceType);
console.log(netboxPayload);
// Output: { name: "SW-BACKUP-01", device_type: { slug: "cisco-c9200-24p" }, ... }
```

---

## Conclusion

This API mapping reference provides all necessary information to implement the ArchiFlow ↔ NetBox integration. Each field mapping includes transformation logic, validation rules, and conflict resolution strategies.

**Key Takeaways:**
1. Always include custom fields to maintain bidirectional sync
2. Validate all foreign keys (sites, device types, VLANs) before creating resources
3. Handle conflicts gracefully with user prompts or automatic resolution
4. Store NetBox IDs back in ArchiFlow for efficient updates
5. Use proper CIDR notation for IP addresses
6. Map status values correctly between systems

For implementation details, see [NETBOX_INTEGRATION.md](./NETBOX_INTEGRATION.md).
For data flow, see [DATA_FLOW.md](./DATA_FLOW.md).
For system architecture, see [ARCHITECTURE.md](./ARCHITECTURE.md).

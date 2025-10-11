# ArchiFlow Data Flow Documentation

## Table of Contents
1. [Overview](#overview)
2. [Diagram Creation Flow](#diagram-creation-flow)
3. [Diagram Save Flow](#diagram-save-flow)
4. [Device Extraction Flow](#device-extraction-flow)
5. [IP Allocation Flow](#ip-allocation-flow)
6. [Deployment Sync Flow](#deployment-sync-flow)
7. [Real-World Example](#real-world-example)
8. [Error Handling](#error-handling)

---

## Overview

This document describes the complete data flow through the ArchiFlow system, from diagram creation to NetBox deployment. Each section includes detailed step-by-step processes with actual data examples from production testing.

---

## Diagram Creation Flow

### Step-by-Step Process

```
1. User Opens Application
   ↓
2. Frontend Loads (index.html + app.js)
   ↓
3. WebSocket Connection Established
   ↓
4. Frontend Sends: { action: "getSites" }
   ↓
5. Backend Queries: SELECT * FROM archiflow.sites
   ↓
6. Backend Returns: [
      { id: 1, name: "Main Data Center", site_code: "MAIN" },
      { id: 2, name: "Backup Site", site_code: "BACKUP" },
      { id: 3, name: "Cloud Region US-East", site_code: "CLOUD" }
   ]
   ↓
7. Frontend Populates Site Dropdown
   ↓
8. User Selects Site (e.g., "Backup Site")
   ↓
9. Frontend Sends: { action: "getDiagramList" }
   ↓
10. Backend Queries: SELECT * FROM archiflow.diagrams WHERE site_id = 2
    ↓
11. Backend Returns: [
       { id: "uuid-123", title: "Network Topology", status: "draft" },
       { id: "uuid-456", title: "Backup Network", status: "live" }
    ]
    ↓
12. Frontend Populates Diagram Dropdown
    ↓
13. User Clicks "New Diagram"
    ↓
14. Frontend Sends: { action: "getDeviceTemplates" }
    ↓
15. Backend Queries: SELECT * FROM archiflow.device_templates
    ↓
16. Backend Returns: [
       { name: "Cisco C9200-24P", device_type: "switch", image_url: "..." },
       { name: "Fortinet Firewall", device_type: "firewall", image_url: "..." },
       ...
    ]
    ↓
17. Frontend Loads Empty Diagram into Draw.io Iframe
    ↓
18. User Begins Editing
```

### Data Flow Diagram

```
┌─────────┐     WebSocket     ┌─────────┐      SQL       ┌──────────┐
│         │ ───────────────►  │         │ ─────────────► │          │
│ Browser │                   │ Backend │                │PostgreSQL│
│         │ ◄─────────────── │         │ ◄───────────── │          │
└─────────┘     JSON          └─────────┘    Rows        └──────────┘
```

---

## Diagram Save Flow

### Detailed Process

#### Phase 1: User Triggers Save

```
1. User Edits Diagram in Draw.io
   - Adds devices (switches, routers, etc.)
   - Draws connections
   - Adds labels and IP addresses
   ↓
2. Auto-Save Timer (30s) or Manual Save Button
   ↓
3. Frontend Sends PostMessage to Draw.io Iframe
   Message: { action: "export", format: "xml" }
   ↓
4. Draw.io Returns XML via PostMessage
   Event: { event: "export", format: "xml", xml: "<mxfile>...</mxfile>" }
   ↓
5. Frontend Receives XML and Validates
   - Check if XML is not empty
   - Verify mxfile structure
```

#### Phase 2: WebSocket Transmission

```
6. Frontend Sends to Backend via WebSocket
   {
       "action": "saveDiagram",
       "diagramId": "f7a3c2d1-8b9e-4f5a-a1b2-c3d4e5f6a7b8",
       "siteId": 2,
       "siteName": "Backup Site",
       "title": "DMZ Network Diagram",
       "content": "<mxfile>...</mxfile>",
       "status": "draft"
   }
```

#### Phase 3: Backend Processing

```
7. websocket-server.js Receives Message
   ↓
8. Log: [Save] Received save request for diagram f7a3c2d1...
   ↓
9. Validate Site ID Exists
   Query: SELECT name FROM archiflow.sites WHERE id = 2
   Result: { name: "Backup Site" }
   ↓
10. Determine if New or Update
    Query: SELECT id FROM archiflow.diagrams WHERE id = 'f7a3c2d1...'
    Result: Empty (new diagram)
    ↓
11. Insert New Diagram
    Query: INSERT INTO archiflow.diagrams (
        id, site_id, site_name, title, diagram_data, status, created_by
    ) VALUES (
        'f7a3c2d1-8b9e-4f5a-a1b2-c3d4e5f6a7b8',
        2,
        'Backup Site',
        'DMZ Network Diagram',
        '<mxfile>...</mxfile>',
        'draft',
        'system'
    )
    ↓
12. Log: [Save] Diagram saved successfully
```

#### Phase 4: Device Extraction (Parallel)

```
13. Start Device Extraction Process
    Log: [Save] Extracting devices from diagram...
    ↓
14. Call DiagramParser.extractDevices(xml)
    (See detailed flow in next section)
    ↓
15. Call DevicePersistence.saveDevices(diagramId, devices, siteId)
    Log: [Save] Found 3 devices, saving to database...
    ↓
16. Device Persistence Complete
    Log: [Save] Device persistence results: {
        created: 2,
        updated: 1,
        errors: 0
    }
```

#### Phase 5: Response

```
17. Backend Sends Success Response
    {
        "action": "status",
        "success": true,
        "message": "Diagram saved successfully",
        "diagramId": "f7a3c2d1-8b9e-4f5a-a1b2-c3d4e5f6a7b8",
        "devicesExtracted": 3,
        "devicesCreated": 2,
        "devicesUpdated": 1
    }
    ↓
18. Frontend Displays Success Notification
    "✓ Diagram saved - 3 devices extracted"
```

### Error Scenarios

**Scenario 1: Site Not Found**
```
Query: SELECT name FROM archiflow.sites WHERE id = 999
Result: Empty
↓
Backend Throws: Error("Site not found: 999")
↓
Response: { action: "error", message: "Site not found: 999" }
↓
Frontend Displays: "❌ Save failed: Site not found"
```

**Scenario 2: Database Connection Lost**
```
Insert Query Fails: Connection refused
↓
Backend Catches Error
↓
Response: { action: "error", message: "Database error: Connection refused" }
↓
Frontend Displays: "❌ Save failed: Database connection lost"
```

**Scenario 3: Device Extraction Fails**
```
DiagramParser Throws: XML parsing error
↓
Backend Logs Warning: [Save] Error saving devices: XML parsing error
↓
Diagram Save Continues (non-blocking)
↓
Response: { success: true, message: "Diagram saved (device extraction failed)" }
```

---

## Device Extraction Flow

### Detailed XML Parsing Process

#### Phase 1: XML Parsing

```
1. DiagramParser Receives XML String
   Input: "<mxfile>...<mxGraphModel>...<root>...</root>...</mxGraphModel>...</mxfile>"
   ↓
2. Decode HTML Entities
   Before: "&lt;div&gt;SW-BACKUP-01&lt;/div&gt;"
   After: "<div>SW-BACKUP-01</div>"
   ↓
3. Parse XML to JavaScript Object
   Using xml2js.Parser
   ↓
4. Navigate to Cell Array
   Path: mxfile.diagram.mxGraphModel.root.mxCell
```

#### Phase 2: Cell Iteration

```
5. Loop Through Each Cell
   For cell in cells:
       ↓
       Check if cell.style exists
       ↓
       Check for ArchiFlow device indicators:
       - cell.Object metadata
       - style contains "shape=image"
       - value contains "archiflow_device"
       ↓
       If device found:
           Extract device data
       Else:
           Skip to next cell
```

#### Phase 3: Device Data Extraction

**Example Cell Data:**
```javascript
{
    id: "cell-123",
    value: "<div>SW-BACKUP-01</div><div>172.16.40.3/24</div>",
    style: "shape=image;image=/images/devices/cisco-c9200-24p-real.svg;...",
    mxGeometry: { x: 340, y: 220, width: 340, height: 35 },
    Object: {
        name: "SW-BACKUP-01",
        device_type: "switch",
        manufacturer: "Cisco",
        model: "C9200-24P",
        ip_address: "172.16.40.3/24",
        pool_name: "DMZ Network",
        site_name: "Backup Site"
    }
}
```

**Extraction Steps:**
```
6. Extract Text from HTML Value
   Input: "<div>SW-BACKUP-01</div><div>172.16.40.3/24</div>"
   ↓
   Remove HTML tags: "SW-BACKUP-01 172.16.40.3/24"
   ↓
   Split by whitespace: ["SW-BACKUP-01", "172.16.40.3/24"]
   ↓
   deviceName = "SW-BACKUP-01"
   ipAddress = "172.16.40.3/24"
   ↓
7. Check for Object Metadata
   If cell.Object exists:
       Use Object.name (overrides parsed name)
       Use Object.ip_address (overrides parsed IP)
       Use Object.device_type, manufacturer, model
   ↓
8. Extract Position and Size
   x_position = 340
   y_position = 220
   width = 340
   height = 35
   ↓
9. Create Device Object
   {
       cell_id: "cell-123",
       name: "SW-BACKUP-01",
       device_type: "switch",
       manufacturer: "Cisco",
       model: "C9200-24P",
       ip_address: "172.16.40.3/24",
       x_position: 340,
       y_position: 220,
       width: 340,
       height: 35,
       style: "shape=image;image=/images/...",
       metadata: { pool_name: "DMZ Network", site_name: "Backup Site" }
   }
```

#### Phase 4: Return Device Array

```
10. After Processing All Cells
    Return: [
        { name: "SW-BACKUP-01", device_type: "switch", ... },
        { name: "FW-BACKUP-01", device_type: "firewall", ... },
        { name: "RTR-BACKUP-01", device_type: "router", ... }
    ]
    ↓
11. Log: [DiagramParser] Extracted 3 devices from diagram
```

---

## Device Persistence Flow

### Detailed Database Operations

#### Phase 1: Check Existing Devices

```
1. DevicePersistence Receives Device Array
   Input: [
       { name: "SW-BACKUP-01", cell_id: "cell-123", ... },
       { name: "FW-BACKUP-01", cell_id: "cell-456", ... }
   ]
   ↓
2. For Each Device:
   ↓
3. Check if Device Already Mapped to This Diagram
   Query: SELECT d.*, ddm.id as mapping_id
          FROM archiflow.device_diagram_mapping ddm
          JOIN archiflow.network_devices d ON ddm.device_id = d.id
          WHERE ddm.diagram_id = 'f7a3c2d1...'
            AND ddm.cell_id = 'cell-123'
   ↓
4. Decision Point:
   If device found:
       → Update existing device
   Else:
       → Create new device
```

#### Phase 2: Create New Device

**Example: SW-BACKUP-01 (First Time)**

```
5. Generate UUID for Device
   deviceId = gen_random_uuid()
   Result: "6e46b5db-7279-40b7-b6c6-929bb96d0817"
   ↓
6. Insert into network_devices Table
   Query: INSERT INTO archiflow.network_devices (
       id,
       name,
       device_type,
       manufacturer,
       model,
       site_id,
       status,
       metadata
   ) VALUES (
       '6e46b5db-7279-40b7-b6c6-929bb96d0817',
       'SW-BACKUP-01',
       'switch',
       'Cisco',
       'C9200-24P',
       2,
       'active',
       '{"pool_name": "DMZ Network", "site_name": "Backup Site"}'::jsonb
   )
   ↓
7. Log: [DevicePersistence] Created new device: SW-BACKUP-01 (UUID: 6e46b5db...)
```

#### Phase 3: Create Device-Diagram Mapping

```
8. Insert into device_diagram_mapping Table
   Query: INSERT INTO archiflow.device_diagram_mapping (
       id,
       device_id,
       diagram_id,
       cell_id,
       x_position,
       y_position,
       width,
       height,
       style
   ) VALUES (
       gen_random_uuid(),
       '6e46b5db-7279-40b7-b6c6-929bb96d0817',
       'f7a3c2d1-8b9e-4f5a-a1b2-c3d4e5f6a7b8',
       'cell-123',
       340,
       220,
       340,
       35,
       'shape=image;image=/images/devices/cisco-c9200-24p-real.svg;...'
   )
   ↓
9. Log: [DevicePersistence] Created device-diagram mapping for SW-BACKUP-01
```

#### Phase 4: Link IP Address

```
10. Check if Device Has IP Address
    If device.ip_address exists:
        ↓
11. Clean IP Address (Remove CIDR Suffix)
    Input: "172.16.40.3/24"
    Output: "172.16.40.3"
    ↓
12. Update ip_addresses Table
    Query: UPDATE archiflow.ip_addresses
           SET
               device_id = '6e46b5db-7279-40b7-b6c6-929bb96d0817',
               device_name = 'SW-BACKUP-01',
               allocated_at = COALESCE(allocated_at, NOW())
           WHERE (
               host(ip_address) = '172.16.40.3'
               OR (device_name = 'SW-BACKUP-01' AND device_id IS NULL)
           )
    ↓
13. Check Result
    If rowCount > 0:
        Log: [DevicePersistence] Linked IP 172.16.40.3 to device SW-BACKUP-01
    Else:
        Log: [DevicePersistence] Warning: IP 172.16.40.3 not found in pool
```

#### Phase 5: Return Results

```
14. After Processing All Devices
    Return: {
        created: 2,  // SW-BACKUP-01, FW-BACKUP-01
        updated: 1,  // RTR-BACKUP-01 (already existed)
        errors: 0,
        devices: [
            { id: "6e46b5db...", name: "SW-BACKUP-01", isNew: true },
            { id: "a1b2c3d4...", name: "FW-BACKUP-01", isNew: true },
            { id: "e5f6a7b8...", name: "RTR-BACKUP-01", isNew: false }
        ]
    }
```

---

## IP Allocation Flow

### Manual IP Allocation (From UI)

```
1. User Opens IP Allocation Panel
   ↓
2. Frontend Sends: { action: "getIPPools" }
   ↓
3. Backend Queries: SELECT * FROM archiflow.ip_pools WHERE site_id = 2
   ↓
4. Backend Returns: [
      { id: "pool-uuid-1", name: "DMZ Network", network: "172.16.40.0/24" },
      { id: "pool-uuid-2", name: "Management", network: "192.168.1.0/24" }
   ]
   ↓
5. User Selects Pool: "DMZ Network"
   ↓
6. Frontend Sends: { action: "getAvailableIPs", pool_id: "pool-uuid-1" }
   ↓
7. Backend Queries: SELECT ip_address
                     FROM archiflow.ip_addresses
                     WHERE pool_id = 'pool-uuid-1'
                       AND device_id IS NULL
                       AND is_reserved = false
                     ORDER BY ip_address
                     LIMIT 50
   ↓
8. Backend Returns: ["172.16.40.2", "172.16.40.3", "172.16.40.4", ...]
   ↓
9. User Selects IP: "172.16.40.3"
   ↓
10. User Enters Device Name: "SW-BACKUP-01"
    ↓
11. Frontend Sends: {
       action: "allocateIP",
       pool_id: "pool-uuid-1",
       ip_address: "172.16.40.3",
       device_name: "SW-BACKUP-01"
    }
    ↓
12. Backend Updates: UPDATE archiflow.ip_addresses
                     SET device_name = 'SW-BACKUP-01',
                         allocated_at = NOW()
                     WHERE pool_id = 'pool-uuid-1'
                       AND host(ip_address) = '172.16.40.3'
    ↓
13. Backend Returns: {
       action: "status",
       success: true,
       message: "IP 172.16.40.3 allocated to SW-BACKUP-01"
    }
    ↓
14. Frontend Updates Diagram Label
    Device label now shows: "SW-BACKUP-01\n172.16.40.3"
```

### Automatic IP Linking (During Save)

```
1. Diagram Saved with Device "SW-BACKUP-01\n172.16.40.3"
   ↓
2. Device Extraction Finds IP in Label
   ↓
3. DevicePersistence.updateIPAllocation() Called
   ↓
4. Clean IP: "172.16.40.3/24" → "172.16.40.3"
   ↓
5. Query: UPDATE archiflow.ip_addresses
          SET device_id = '6e46b5db-7279-40b7-b6c6-929bb96d0817',
              device_name = 'SW-BACKUP-01',
              allocated_at = COALESCE(allocated_at, NOW())
          WHERE host(ip_address) = '172.16.40.3'
             OR (device_name = 'SW-BACKUP-01' AND device_id IS NULL)
   ↓
6. Result: IP now linked to device UUID
```

---

## Deployment Sync Flow

### Complete NetBox Sync Process

#### Phase 1: Deployment Preparation

```
1. User Opens Diagram (Status: draft)
   ↓
2. User Clicks "Deploy to NetBox" Button
   ↓
3. Frontend Shows Confirmation Modal
   "Deploy 'DMZ Network Diagram' to NetBox?
    This will sync 3 devices and 5 IP addresses."
   ↓
4. User Confirms
   ↓
5. Frontend Sends: {
       action: "deployToNetBox",
       diagramId: "f7a3c2d1-8b9e-4f5a-a1b2-c3d4e5f6a7b8"
   }
```

#### Phase 2: Pre-Deployment Validation

```
6. Backend Validates Diagram Data
   ↓
7. Query Devices: SELECT * FROM archiflow.network_devices d
                  JOIN archiflow.device_diagram_mapping ddm
                    ON d.id = ddm.device_id
                  WHERE ddm.diagram_id = 'f7a3c2d1...'
   Result: 3 devices
   ↓
8. Query IPs: SELECT * FROM archiflow.ip_addresses
              WHERE device_id IN (device_ids)
   Result: 5 IP addresses
   ↓
9. Validate Required Fields
   For each device:
       - name (required)
       - device_type (required)
       - site_id (required)
   ↓
10. Check NetBox Connection
    NetBoxClient.testConnection()
    Result: ✓ Connected
```

#### Phase 3: Device Synchronization

**For Each Device:**

```
11. Check if Device Exists in NetBox
    GET /api/dcim/devices/?name=SW-BACKUP-01
    ↓
12. Decision Point:
    If device exists:
        → Update existing device (PUT)
    Else:
        → Create new device (POST)
```

**Create Device in NetBox:**

```
13. Prepare Device Payload
    {
        "name": "SW-BACKUP-01",
        "device_type": {
            "slug": "c9200-24p"  // Must exist in NetBox
        },
        "site": {
            "slug": "backup-site"  // Mapped from ArchiFlow site
        },
        "status": "active",
        "custom_fields": {
            "archiflow_id": "6e46b5db-7279-40b7-b6c6-929bb96d0817",
            "archiflow_diagram": "f7a3c2d1-8b9e-4f5a-a1b2-c3d4e5f6a7b8"
        }
    }
    ↓
14. Send POST Request
    POST /api/dcim/devices/
    Headers: {
        "Authorization": "Token abc123...",
        "Content-Type": "application/json"
    }
    ↓
15. NetBox Returns
    {
        "id": 42,
        "name": "SW-BACKUP-01",
        "url": "https://netbox.local/dcim/devices/42/"
    }
    ↓
16. Store NetBox ID in ArchiFlow
    UPDATE archiflow.network_devices
    SET metadata = jsonb_set(
        metadata,
        '{netbox_id}',
        '42'
    )
    WHERE id = '6e46b5db...'
```

#### Phase 4: Interface Creation

```
17. Get Device Interfaces from NetBox
    GET /api/dcim/devices/42/
    Response includes default interfaces
    ↓
18. Create Additional Interfaces if Needed
    For port_name in ["GigabitEthernet1/0/1", "GigabitEthernet1/0/2", ...]:
        ↓
        POST /api/dcim/interfaces/
        {
            "device": 42,
            "name": "GigabitEthernet1/0/1",
            "type": "1000base-t",
            "enabled": true
        }
        ↓
        Response: { "id": 101, "name": "GigabitEthernet1/0/1" }
```

#### Phase 5: IP Address Assignment

```
19. For Each IP Address Allocated to Device
    IP: 172.16.40.3/24
    ↓
20. Check if IP Exists in NetBox
    GET /api/ipam/ip-addresses/?address=172.16.40.3/24
    ↓
21. If IP Doesn't Exist:
    POST /api/ipam/ip-addresses/
    {
        "address": "172.16.40.3/24",
        "status": "active",
        "assigned_object_type": "dcim.interface",
        "assigned_object_id": 101,  // Interface ID
        "dns_name": "sw-backup-01.company.local"
    }
    ↓
    Response: { "id": 201, "address": "172.16.40.3/24" }
    ↓
22. Store NetBox IP ID
    UPDATE archiflow.ip_addresses
    SET metadata = jsonb_set(
        metadata,
        '{netbox_id}',
        '201'
    )
    WHERE ip_address = '172.16.40.3'
```

#### Phase 6: Set Primary IP

```
23. Designate Primary IP for Device
    PATCH /api/dcim/devices/42/
    {
        "primary_ip4": 201  // IP address ID
    }
    ↓
24. NetBox Confirms Update
    {
        "id": 42,
        "name": "SW-BACKUP-01",
        "primary_ip4": {
            "id": 201,
            "address": "172.16.40.3/24"
        }
    }
```

#### Phase 7: Record Deployment

```
25. Insert Deployment Record
    INSERT INTO archiflow.deployments (
        id,
        diagram_id,
        diagram_title,
        site_id,
        site_name,
        deployed_by,
        deployment_status,
        devices_synced,
        ips_synced,
        netbox_ids
    ) VALUES (
        gen_random_uuid(),
        'f7a3c2d1-8b9e-4f5a-a1b2-c3d4e5f6a7b8',
        'DMZ Network Diagram',
        2,
        'Backup Site',
        'system',
        'success',
        3,
        5,
        '{"devices": [42, 43, 44], "ips": [201, 202, 203, 204, 205]}'::jsonb
    )
    ↓
26. Update Diagram Status
    UPDATE archiflow.diagrams
    SET status = 'live',
        metadata = jsonb_set(
            metadata,
            '{last_deployment}',
            to_jsonb(NOW())
        )
    WHERE id = 'f7a3c2d1...'
```

#### Phase 8: Response

```
27. Backend Sends Success Response
    {
        "action": "deploymentComplete",
        "success": true,
        "deployment_id": "deployment-uuid",
        "devices_synced": 3,
        "ips_synced": 5,
        "netbox_urls": {
            "SW-BACKUP-01": "https://netbox.local/dcim/devices/42/",
            "FW-BACKUP-01": "https://netbox.local/dcim/devices/43/",
            "RTR-BACKUP-01": "https://netbox.local/dcim/devices/44/"
        }
    }
    ↓
28. Frontend Displays Success
    "✓ Deployment Complete
     3 devices synced to NetBox
     5 IP addresses assigned
     View in NetBox →"
```

---

## Real-World Example

### Complete Flow: From Diagram to NetBox

**Scenario:** Network engineer creates a new DMZ network diagram for Backup Site

#### Step 1: Create Diagram (10:00 AM)

```
User: Opens ArchiFlow → Selects "Backup Site" → Clicks "New Diagram"
System: Creates empty diagram in Draw.io iframe
User: Titles diagram "DMZ Network Diagram"
```

#### Step 2: Add Devices (10:05 AM)

```
User: Clicks "Add Device" → Selects "Cisco C9200-24P Switch"
System: Inserts device shape into diagram at position (340, 220)
User: Double-clicks device → Names it "SW-BACKUP-01"
User: Repeats for firewall and router
```

#### Step 3: Allocate IPs (10:10 AM)

```
User: Opens IP Allocation Panel
System: Displays available pools:
    - DMZ Network (172.16.40.0/24) - 250 available IPs
    - Management (192.168.1.0/24) - 200 available IPs

User: Selects "DMZ Network" pool
System: Displays available IPs starting from 172.16.40.2

User: Assigns IPs:
    - SW-BACKUP-01: 172.16.40.3
    - FW-BACKUP-01: 172.16.40.4
    - RTR-BACKUP-01: 172.16.40.5

System: Updates device labels to show IPs
```

#### Step 4: Draw Connections (10:15 AM)

```
User: Draws connections between devices:
    - RTR-BACKUP-01 [eth0] → FW-BACKUP-01 [port1]
    - FW-BACKUP-01 [port2] → SW-BACKUP-01 [GigE1/0/1]

System: Stores connection data in diagram XML
```

#### Step 5: Save Diagram (10:20 AM)

```
User: Clicks "Save" button

Frontend:
    ↓ PostMessage to Draw.io: { action: "export", format: "xml" }
    ↓ Receives XML: "<mxfile>...</mxfile>"
    ↓ WebSocket to Backend: { action: "saveDiagram", content: "..." }

Backend (websocket-server.js):
    ↓ [10:20:15] [Save] Received save request for diagram f7a3c2d1...
    ↓ [10:20:15] [Save] Validating site ID 2...
    ↓ [10:20:15] [Save] Site found: Backup Site
    ↓ [10:20:15] [Save] Inserting new diagram...
    ↓ [10:20:16] [Save] Diagram saved successfully
    ↓ [10:20:16] [Save] Extracting devices from diagram...

Backend (diagram-parser.js):
    ↓ [10:20:16] [DiagramParser] Parsing XML...
    ↓ [10:20:16] [DiagramParser] Found 3 cells with device data
    ↓ [10:20:17] [DiagramParser] Extracted device: SW-BACKUP-01 (switch)
    ↓ [10:20:17] [DiagramParser] Extracted device: FW-BACKUP-01 (firewall)
    ↓ [10:20:17] [DiagramParser] Extracted device: RTR-BACKUP-01 (router)
    ↓ [10:20:17] [DiagramParser] Extraction complete: 3 devices

Backend (device-persistence.js):
    ↓ [10:20:17] [DevicePersistence] Saving device: SW-BACKUP-01
    ↓ [10:20:17] [DevicePersistence] Created new device: SW-BACKUP-01 (UUID: 6e46b5db...)
    ↓ [10:20:17] [DevicePersistence] Created device-diagram mapping
    ↓ [10:20:17] [DevicePersistence] Linking IP 172.16.40.3 to device...
    ↓ [10:20:18] [DevicePersistence] Linked IP 172.16.40.3 to device SW-BACKUP-01
    ↓ [10:20:18] [DevicePersistence] Saving device: FW-BACKUP-01
    ↓ [10:20:18] [DevicePersistence] Created new device: FW-BACKUP-01 (UUID: a1b2c3d4...)
    ↓ [10:20:18] [DevicePersistence] Linked IP 172.16.40.4 to device FW-BACKUP-01
    ↓ [10:20:19] [DevicePersistence] Saving device: RTR-BACKUP-01
    ↓ [10:20:19] [DevicePersistence] Created new device: RTR-BACKUP-01 (UUID: e5f6a7b8...)
    ↓ [10:20:19] [DevicePersistence] Linked IP 172.16.40.5 to device RTR-BACKUP-01
    ↓ [10:20:19] [DevicePersistence] All devices saved successfully

Backend:
    ↓ [10:20:19] [Save] Device persistence results: {
        created: 3,
        updated: 0,
        errors: 0
    }
    ↓ [10:20:19] [Save] Complete

Frontend:
    ↓ Receives success response
    ↓ Displays: "✓ Diagram saved - 3 devices extracted"
```

#### Step 6: Verify in Database (10:25 AM)

```
User: Opens Adminer (http://localhost:8082)

Query 1: SELECT * FROM archiflow.diagrams WHERE site_id = 2
Result:
    id                  | site_id | site_name   | title              | status
    ────────────────────┼─────────┼─────────────┼────────────────────┼────────
    f7a3c2d1-8b9e-...   | 2       | Backup Site | DMZ Network Diagram| draft

Query 2: SELECT name, device_type, manufacturer FROM archiflow.network_devices
                WHERE site_id = 2
Result:
    name          | device_type | manufacturer
    ──────────────┼─────────────┼─────────────
    SW-BACKUP-01  | switch      | Cisco
    FW-BACKUP-01  | firewall    | Fortinet
    RTR-BACKUP-01 | router      | Cisco

Query 3: SELECT ip_address, device_name, allocated_at
         FROM archiflow.ip_addresses
         WHERE device_name LIKE '%BACKUP%'
Result:
    ip_address    | device_name   | allocated_at
    ──────────────┼───────────────┼─────────────────────
    172.16.40.3   | SW-BACKUP-01  | 2025-10-08 10:20:17
    172.16.40.4   | FW-BACKUP-01  | 2025-10-08 10:20:18
    172.16.40.5   | RTR-BACKUP-01 | 2025-10-08 10:20:19

Query 4: SELECT device_id, diagram_id, cell_id, x_position, y_position
         FROM archiflow.device_diagram_mapping
Result:
    device_id         | diagram_id        | cell_id  | x_position | y_position
    ──────────────────┼───────────────────┼──────────┼────────────┼────────────
    6e46b5db-7279-... | f7a3c2d1-8b9e-... | cell-123 | 340        | 220
    a1b2c3d4-5e6f-... | f7a3c2d1-8b9e-... | cell-456 | 340        | 320
    e5f6a7b8-9c0d-... | f7a3c2d1-8b9e-... | cell-789 | 340        | 420
```

#### Step 7: Deploy to NetBox (11:00 AM)

```
User: Reviews diagram → Clicks "Deploy to NetBox"
System: Shows confirmation modal with deployment summary
User: Confirms deployment

Backend (netbox-sync.js):
    ↓ [11:00:05] [NetBoxSync] Starting deployment for diagram f7a3c2d1...
    ↓ [11:00:05] [NetBoxSync] Validating diagram data...
    ↓ [11:00:05] [NetBoxSync] Found 3 devices, 5 IPs to sync
    ↓ [11:00:06] [NetBoxSync] Testing NetBox connection...
    ↓ [11:00:06] [NetBoxSync] ✓ Connected to NetBox

    ↓ [11:00:07] [NetBoxSync] Syncing device: SW-BACKUP-01
    ↓ [11:00:07] [NetBoxClient] GET /api/dcim/devices/?name=SW-BACKUP-01
    ↓ [11:00:07] [NetBoxClient] Device not found, creating new...
    ↓ [11:00:07] [NetBoxClient] POST /api/dcim/devices/
    ↓ [11:00:08] [NetBoxClient] ✓ Device created: ID 42
    ↓ [11:00:08] [NetBoxSync] Creating interface: GigabitEthernet1/0/1
    ↓ [11:00:08] [NetBoxClient] POST /api/dcim/interfaces/
    ↓ [11:00:09] [NetBoxClient] ✓ Interface created: ID 101
    ↓ [11:00:09] [NetBoxSync] Assigning IP: 172.16.40.3/24
    ↓ [11:00:09] [NetBoxClient] POST /api/ipam/ip-addresses/
    ↓ [11:00:10] [NetBoxClient] ✓ IP assigned: ID 201
    ↓ [11:00:10] [NetBoxSync] Setting primary IP...
    ↓ [11:00:10] [NetBoxClient] PATCH /api/dcim/devices/42/
    ↓ [11:00:11] [NetBoxClient] ✓ Primary IP set

    ↓ [11:00:11] [NetBoxSync] Syncing device: FW-BACKUP-01
    ↓ [11:00:11] [NetBoxClient] GET /api/dcim/devices/?name=FW-BACKUP-01
    ↓ [11:00:11] [NetBoxClient] Device not found, creating new...
    ↓ [11:00:11] [NetBoxClient] POST /api/dcim/devices/
    ↓ [11:00:12] [NetBoxClient] ✓ Device created: ID 43
    ↓ [11:00:12] [NetBoxSync] Creating interface: port1
    ↓ [11:00:12] [NetBoxClient] POST /api/dcim/interfaces/
    ↓ [11:00:13] [NetBoxClient] ✓ Interface created: ID 102
    ↓ [11:00:13] [NetBoxSync] Assigning IP: 172.16.40.4/24
    ↓ [11:00:13] [NetBoxClient] POST /api/ipam/ip-addresses/
    ↓ [11:00:14] [NetBoxClient] ✓ IP assigned: ID 202
    ↓ [11:00:14] [NetBoxSync] Setting primary IP...
    ↓ [11:00:14] [NetBoxClient] PATCH /api/dcim/devices/43/
    ↓ [11:00:15] [NetBoxClient] ✓ Primary IP set

    ↓ [11:00:15] [NetBoxSync] Syncing device: RTR-BACKUP-01
    ↓ [11:00:15] [NetBoxClient] GET /api/dcim/devices/?name=RTR-BACKUP-01
    ↓ [11:00:15] [NetBoxClient] Device not found, creating new...
    ↓ [11:00:15] [NetBoxClient] POST /api/dcim/devices/
    ↓ [11:00:16] [NetBoxClient] ✓ Device created: ID 44
    ↓ [11:00:16] [NetBoxSync] Creating interface: eth0
    ↓ [11:00:16] [NetBoxClient] POST /api/dcim/interfaces/
    ↓ [11:00:17] [NetBoxClient] ✓ Interface created: ID 103
    ↓ [11:00:17] [NetBoxSync] Assigning IP: 172.16.40.5/24
    ↓ [11:00:17] [NetBoxClient] POST /api/ipam/ip-addresses/
    ↓ [11:00:18] [NetBoxClient] ✓ IP assigned: ID 203
    ↓ [11:00:18] [NetBoxSync] Setting primary IP...
    ↓ [11:00:18] [NetBoxClient] PATCH /api/dcim/devices/44/
    ↓ [11:00:19] [NetBoxClient] ✓ Primary IP set

    ↓ [11:00:19] [NetBoxSync] Recording deployment...
    ↓ [11:00:19] [NetBoxSync] INSERT INTO archiflow.deployments...
    ↓ [11:00:20] [NetBoxSync] Updating diagram status to 'live'...
    ↓ [11:00:20] [NetBoxSync] ✓ Deployment complete

Frontend:
    ↓ Receives deployment complete response
    ↓ Displays success modal:
        "✓ Deployment Complete
         3 devices synced to NetBox
         5 IP addresses assigned

         View Devices:
         • SW-BACKUP-01 → https://netbox.local/dcim/devices/42/
         • FW-BACKUP-01 → https://netbox.local/dcim/devices/43/
         • RTR-BACKUP-01 → https://netbox.local/dcim/devices/44/"
```

#### Step 8: Verify in NetBox (11:05 AM)

```
User: Opens NetBox web interface (https://netbox.local)

Navigation: DCIM → Devices → Filter by Site: "Backup Site"
Result: 3 devices found

Device Details: SW-BACKUP-01
    - Name: SW-BACKUP-01
    - Device Type: Cisco C9200-24P
    - Site: Backup Site
    - Status: Active
    - Primary IPv4: 172.16.40.3/24
    - Interfaces: GigabitEthernet1/0/1 (Active)
    - Custom Fields:
        - archiflow_id: 6e46b5db-7279-40b7-b6c6-929bb96d0817
        - archiflow_diagram: f7a3c2d1-8b9e-4f5a-a1b2-c3d4e5f6a7b8

Navigation: IPAM → IP Addresses → Filter by Network: 172.16.40.0/24
Result:
    IP Address    | Status | Assigned To           | DNS Name
    ──────────────┼────────┼───────────────────────┼─────────────────────────
    172.16.40.1   | Active | Gateway               | -
    172.16.40.3   | Active | SW-BACKUP-01 (eth0)   | sw-backup-01.company.local
    172.16.40.4   | Active | FW-BACKUP-01 (port1)  | fw-backup-01.company.local
    172.16.40.5   | Active | RTR-BACKUP-01 (eth0)  | rtr-backup-01.company.local
```

---

## Error Handling

### Diagram Save Errors

**Error 1: Site Not Found**
```
Trigger: User tries to save diagram with invalid site_id
Detection: Backend query returns empty result
Action: Throw error immediately, don't proceed with save
Response: { action: "error", message: "Site not found: 999" }
User Experience: Red notification "Save failed: Site not found"
```

**Error 2: Empty Diagram**
```
Trigger: User tries to save diagram with no content
Detection: Frontend validates XML before sending
Action: Prevent save, show warning
Response: Local validation (no backend call)
User Experience: Orange notification "Cannot save empty diagram"
```

**Error 3: Database Connection Lost**
```
Trigger: PostgreSQL container stopped during save
Detection: db.query() throws connection error
Action: Catch error, log, return error response
Response: { action: "error", message: "Database error: Connection refused" }
User Experience: Red notification "Save failed: Database connection lost"
Recovery: User can retry save once database is back
```

### Device Extraction Errors

**Error 4: XML Parsing Failed**
```
Trigger: Corrupted or invalid XML in diagram_data
Detection: xml2js.Parser throws exception
Action: Log error, continue with diagram save (non-blocking)
Response: Success with warning
User Experience: Yellow notification "Diagram saved (device extraction failed)"
Recovery: User can re-save diagram after fixing corruption
```

**Error 5: Device Missing Required Fields**
```
Trigger: Device has no name or device_type
Detection: Validation in device-persistence.js
Action: Skip device, continue with others, log warning
Response: Success with partial results
User Experience: "Diagram saved - 2 of 3 devices extracted (1 invalid)"
Recovery: User should add missing fields to device and re-save
```

### NetBox Sync Errors

**Error 6: NetBox Connection Failed**
```
Trigger: NetBox API unreachable
Detection: HTTP request timeout or connection refused
Action: Stop deployment, rollback if needed
Response: { action: "deploymentFailed", message: "NetBox API unreachable" }
User Experience: Red notification "Deployment failed: Cannot connect to NetBox"
Recovery: Check NetBox service status, retry deployment
```

**Error 7: Device Already Exists (Conflict)**
```
Trigger: Device name exists in NetBox but no archiflow_id match
Detection: NetBox returns 409 Conflict or duplicate found in GET
Action: Prompt user for resolution (update, rename, or skip)
Response: { action: "deploymentConflict", device: "SW-BACKUP-01", netbox_id: 99 }
User Experience: Modal "Device SW-BACKUP-01 already exists in NetBox. Update or rename?"
Recovery Options:
    - Update: Link existing NetBox device to ArchiFlow device
    - Rename: Change device name in ArchiFlow and retry
    - Skip: Don't sync this device
```

**Error 8: IP Already Assigned**
```
Trigger: IP 172.16.40.3 already assigned to different device in NetBox
Detection: NetBox API returns error on IP assignment
Action: Log conflict, continue with other IPs
Response: Partial success with conflict list
User Experience: "Deployment completed with warnings: 1 IP conflict"
Recovery: User must manually resolve IP conflict in NetBox
```

**Error 9: Missing Device Type in NetBox**
```
Trigger: Device type "C9200-24P" doesn't exist in NetBox
Detection: NetBox API returns 400 Bad Request (invalid device_type slug)
Action: Log error, skip device, suggest creating device type
Response: { action: "deploymentFailed", message: "Device type 'c9200-24p' not found in NetBox" }
User Experience: "Deployment failed: Device type 'C9200-24P' must be created in NetBox first"
Recovery: Create device type in NetBox, then retry deployment
```

### Rollback Procedures

**Partial Deployment Failure:**
```
Scenario: 2 of 3 devices synced, then NetBox connection lost

Rollback Options:

1. Complete Rollback (Delete all created resources):
   - Delete NetBox device 42
   - Delete NetBox device 43
   - Remove archiflow.metadata.netbox_id from devices
   - Delete deployment record
   - Set diagram status back to 'draft'

2. Partial Rollback (Keep synced devices):
   - Mark deployment as 'partial'
   - Record which devices succeeded
   - Allow user to retry remaining devices
   - Don't delete already-created NetBox resources

3. No Rollback (Manual cleanup):
   - Mark deployment as 'failed'
   - Record partial progress
   - User manually cleans up NetBox
   - User retries full deployment
```

**Implementation:**
```javascript
async function rollbackDeployment(deploymentId, rollbackType) {
    const deployment = await getDeploymentById(deploymentId);

    if (rollbackType === 'complete') {
        // Delete all NetBox resources
        for (const deviceId of deployment.netbox_ids.devices) {
            await netboxClient.deleteDevice(deviceId);
        }
        for (const ipId of deployment.netbox_ids.ips) {
            await netboxClient.deleteIPAddress(ipId);
        }

        // Clear ArchiFlow metadata
        await db.query(`
            UPDATE archiflow.network_devices
            SET metadata = metadata - 'netbox_id'
            WHERE id = ANY($1)
        `, [deployment.device_ids]);

        // Delete deployment record
        await db.query(`
            DELETE FROM archiflow.deployments WHERE id = $1
        `, [deploymentId]);

        // Reset diagram status
        await db.query(`
            UPDATE archiflow.diagrams
            SET status = 'draft'
            WHERE id = $1
        `, [deployment.diagram_id]);

        return { success: true, message: "Deployment rolled back completely" };
    }

    // Other rollback types...
}
```

---

## Performance Optimization

### Caching Strategies

**1. Site and Template Caching:**
```javascript
// Cache sites for 5 minutes (rarely change)
const siteCache = new Map();
const SITE_CACHE_TTL = 5 * 60 * 1000;

async function getSites() {
    const now = Date.now();
    const cached = siteCache.get('all');

    if (cached && (now - cached.timestamp) < SITE_CACHE_TTL) {
        return cached.data;
    }

    const sites = await db.query('SELECT * FROM archiflow.sites ORDER BY name');
    siteCache.set('all', { data: sites.rows, timestamp: now });
    return sites.rows;
}
```

**2. Batch Operations:**
```javascript
// Instead of updating IPs one by one:
for (const device of devices) {
    await updateIPAllocation(device.id, device.ip_address);  // ❌ Slow
}

// Batch update:
const values = devices.map(d => `('${d.id}', '${d.ip_address}')`).join(',');
await db.query(`
    UPDATE archiflow.ip_addresses AS ip
    SET device_id = v.device_id,
        allocated_at = NOW()
    FROM (VALUES ${values}) AS v(device_id, ip_address)
    WHERE host(ip.ip_address) = v.ip_address
`);  // ✓ Fast
```

### NetBox Sync Optimization

**1. Parallel Device Sync:**
```javascript
// Instead of sequential:
for (const device of devices) {
    await syncDeviceToNetBox(device);  // ❌ Slow (15s total for 3 devices)
}

// Parallel sync:
await Promise.all(devices.map(device => syncDeviceToNetBox(device)));  // ✓ Fast (5s total)
```

**2. Conditional Sync (Only Changed Devices):**
```javascript
async function syncDeviceToNetBox(device) {
    // Check if device changed since last sync
    const lastSyncHash = device.metadata?.netbox_sync_hash;
    const currentHash = hashDeviceData(device);

    if (lastSyncHash === currentHash) {
        console.log(`Device ${device.name} unchanged, skipping sync`);
        return { skipped: true };
    }

    // Proceed with sync...
}
```

---

## Conclusion

This data flow documentation provides a complete reference for understanding how data moves through the ArchiFlow system, from user interaction to database persistence to NetBox integration. The real-world example demonstrates the entire process with actual data from production testing.

For implementation details, see [NETBOX_INTEGRATION.md](./NETBOX_INTEGRATION.md) and [ARCHITECTURE.md](./ARCHITECTURE.md).

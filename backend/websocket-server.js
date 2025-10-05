const WebSocket = require('ws');
const http = require('http');
const { v4: uuidv4 } = require('uuid');
const DatabaseManager = require('./database');
const NetworkDeviceManager = require('./network-device-manager');

// Environment configuration
const WS_PORT = process.env.WS_PORT || 3333;
const DB_MODE = process.env.DB_MODE || 'postgresql';
const NODE_ENV = process.env.NODE_ENV || 'development';

console.log(`[Server] Starting ArchiFlow WebSocket Server...`);
console.log(`[Server] Database Mode: ${DB_MODE}`);
console.log(`[Server] Environment: ${NODE_ENV}`);

// Validate critical configuration
if (DB_MODE !== 'postgresql') {
    console.warn('[Server] WARNING: DB_MODE is not set to postgresql. Using mock mode.');
}

// Initialize database
const db = new DatabaseManager();
const networkDevices = new NetworkDeviceManager(db);

// Create HTTP server for health checks
const server = http.createServer((req, res) => {
    if (req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('OK');
    } else {
        res.writeHead(404);
        res.end();
    }
});

// Create WebSocket server
const wss = new WebSocket.Server({ server });

// Client tracking
const clients = new Map();

// WebSocket connection handler
wss.on('connection', (ws, req) => {
    const clientId = uuidv4();
    const clientIp = req.socket.remoteAddress;

    console.log(`[WebSocket] New connection from ${clientIp} (ID: ${clientId})`);

    // Store client
    clients.set(clientId, {
        ws,
        id: clientId,
        connectedAt: new Date(),
        lastActivity: new Date()
    });

    // Send welcome message
    ws.send(JSON.stringify({
        type: 'connection',
        clientId,
        message: 'Connected to ArchiFlow WebSocket Server',
        dbMode: DB_MODE
    }));

    // Message handler
    ws.on('message', async (data) => {
        try {
            const message = JSON.parse(data.toString());
            console.log(`[WebSocket] Received: ${message.action} from ${clientId}`);

            // Update last activity
            const client = clients.get(clientId);
            if (client) {
                client.lastActivity = new Date();
            }

            // Handle different actions
            switch (message.action) {
                case 'ping':
                    ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
                    break;

                case 'save_diagram':
                    await handleSaveDiagram(ws, message);
                    break;

                case 'load_diagram':
                    await handleLoadDiagram(ws, message);
                    break;

                case 'list_diagrams':
                    await handleListDiagrams(ws, message);
                    break;

                case 'create_version':
                    await handleCreateVersion(ws, message);
                    break;

                case 'get_versions':
                    await handleGetVersions(ws, message);
                    break;

                case 'delete_diagram':
                    await handleDeleteDiagram(ws, message);
                    break;

                case 'list_sites':
                    await handleListSites(ws, message);
                    break;

                case 'deploy_diagram':
                    await handleDeployDiagram(ws, message);
                    break;

                // Network Device Management
                case 'get_network_devices':
                    await handleGetNetworkDevices(ws, message);
                    break;

                case 'get_network_device':
                    await handleGetNetworkDevice(ws, message);
                    break;

                case 'create_network_device':
                    await handleCreateNetworkDevice(ws, message);
                    break;

                case 'update_network_device':
                    await handleUpdateNetworkDevice(ws, message);
                    break;

                case 'delete_network_device':
                    await handleDeleteNetworkDevice(ws, message);
                    break;

                case 'allocate_ip':
                    await handleAllocateIP(ws, message);
                    break;

                case 'release_ip':
                    await handleReleaseIP(ws, message);
                    break;

                case 'get_device_connections':
                    await handleGetDeviceConnections(ws, message);
                    break;

                case 'create_connection':
                    await handleCreateConnection(ws, message);
                    break;

                case 'delete_connection':
                    await handleDeleteConnection(ws, message);
                    break;

                case 'get_device_templates':
                    await handleGetDeviceTemplates(ws, message);
                    break;

                case 'get_vlans':
                    await handleGetVLANs(ws, message);
                    break;

                case 'get_ip_pools':
                    await handleGetIPPools(ws, message);
                    break;

                case 'get_pool_ips':
                    await handleGetPoolIPs(ws, message);
                    break;

                case 'allocate_ip_from_pool':
                    await handleAllocateIPFromPool(ws, message);
                    break;

                case 'release_ip_from_pool':
                    await handleReleaseIPFromPool(ws, message);
                    break;

                case 'cleanup_orphaned_ips':
                    await handleCleanupOrphanedIPs(ws, message);
                    break;

                case 'map_device_to_diagram':
                    await handleMapDeviceToDiagram(ws, message);
                    break;

                case 'get_devices_in_diagram':
                    await handleGetDevicesInDiagram(ws, message);
                    break;

                default:
                    ws.send(JSON.stringify({
                        type: 'error',
                        message: `Unknown action: ${message.action}`
                    }));
            }
        } catch (error) {
            console.error('[WebSocket] Error processing message:', error);
            ws.send(JSON.stringify({
                type: 'error',
                message: 'Failed to process message',
                error: error.message
            }));
        }
    });

    // Error handler
    ws.on('error', (error) => {
        console.error(`[WebSocket] Client ${clientId} error:`, error);
    });

    // Close handler
    ws.on('close', (code, reason) => {
        console.log(`[WebSocket] Client ${clientId} disconnected (code: ${code})`);
        clients.delete(clientId);
    });
});

// Handle save diagram
async function handleSaveDiagram(ws, message) {
    try {
        const { diagramId, content, title, siteId, siteName, description } = message;

        if (!content) {
            throw new Error('Diagram content is required');
        }

        // Generate ID if not provided
        const id = diagramId || uuidv4();

        // Look up site ID from slug if needed
        let actualSiteId = siteId;
        if (typeof siteId === 'string' && isNaN(parseInt(siteId))) {
            // It's a slug, look up the ID
            const siteQuery = `SELECT id FROM archiflow.sites WHERE slug = $1 OR name = $1`;
            const siteResult = await db.query(siteQuery, [siteId]);
            if (siteResult.rows.length > 0) {
                actualSiteId = siteResult.rows[0].id;
            } else {
                actualSiteId = 1; // Default to site ID 1
            }
        } else {
            actualSiteId = parseInt(siteId) || 1;
        }

        // Save to database
        const result = await db.saveDiagram({
            id,
            siteId: actualSiteId,
            siteName: siteName || 'Default Site',
            title: title || 'Untitled Diagram',
            description: description || '',
            diagramData: content,
            modifiedBy: message.userId || 'system'
        });

        console.log(`[Save] Diagram saved: ${id}`);

        ws.send(JSON.stringify({
            type: 'save_success',
            action: 'diagram_saved',
            diagramId: result.id,
            message: 'Diagram saved successfully'
        }));
    } catch (error) {
        console.error('[Save] Error:', error);
        ws.send(JSON.stringify({
            type: 'error',
            action: 'save_failed',
            message: error.message
        }));
    }
}

// Handle load diagram
async function handleLoadDiagram(ws, message) {
    try {
        const { diagramId } = message;

        if (!diagramId) {
            throw new Error('Diagram ID is required');
        }

        // Load from database
        const diagram = await db.loadDiagram(diagramId);

        if (!diagram) {
            throw new Error(`Diagram not found: ${diagramId}`);
        }

        console.log(`[Load] Diagram loaded: ${diagramId}`);
        console.log(`[Load] Diagram data type:`, typeof diagram.diagram_data);
        console.log(`[Load] Diagram data starts with:`, diagram.diagram_data ? diagram.diagram_data.substring(0, 100) : 'NULL');

        ws.send(JSON.stringify({
            type: 'load_success',
            action: 'diagram_loaded',
            diagramId: diagram.id,
            title: diagram.title,
            content: diagram.diagram_data || diagram.diagram_xml,
            metadata: diagram.metadata || {}
        }));
    } catch (error) {
        console.error('[Load] Error:', error);
        ws.send(JSON.stringify({
            type: 'error',
            action: 'load_failed',
            message: error.message
        }));
    }
}

// Handle list diagrams
async function handleListDiagrams(ws, message) {
    try {
        const { siteId, status } = message;

        const diagrams = await db.listDiagrams({
            siteId,
            status: status || 'all'
        });

        console.log(`[List] Found ${diagrams.length} diagrams`);

        ws.send(JSON.stringify({
            type: 'list_success',
            action: 'diagrams_listed',
            diagrams,
            count: diagrams.length
        }));
    } catch (error) {
        console.error('[List] Error:', error);
        ws.send(JSON.stringify({
            type: 'error',
            action: 'list_failed',
            message: error.message
        }));
    }
}

// Handle create version
async function handleCreateVersion(ws, message) {
    try {
        const { diagramId, versionType, changeSummary } = message;

        if (!diagramId) {
            throw new Error('Diagram ID is required');
        }

        const version = await db.createVersion({
            diagramId,
            versionType: versionType || 'manual',
            changeSummary: changeSummary || 'Manual save',
            createdBy: message.userId || 'system'
        });

        console.log(`[Version] Created version for diagram: ${diagramId}`);

        ws.send(JSON.stringify({
            type: 'version_success',
            action: 'version_created',
            versionId: version.id,
            versionNumber: version.version_number
        }));
    } catch (error) {
        console.error('[Version] Error:', error);
        ws.send(JSON.stringify({
            type: 'error',
            action: 'version_failed',
            message: error.message
        }));
    }
}

// Handle list sites
async function handleListSites(ws) {
    try {
        const query = `SELECT id, name, slug, status FROM archiflow.sites WHERE status = 'active' ORDER BY name`;
        const result = await db.query(query);

        console.log(`[Sites] Found ${result.rows.length} sites`);

        ws.send(JSON.stringify({
            type: 'sites_listed',
            sites: result.rows
        }));
    } catch (error) {
        console.error('[Sites] Error:', error);
        ws.send(JSON.stringify({
            type: 'error',
            message: 'Failed to list sites'
        }));
    }
}

// Handle get versions
async function handleGetVersions(ws, message) {
    try {
        const { diagramId } = message;

        if (!diagramId) {
            throw new Error('Diagram ID is required');
        }

        const versions = await db.getVersions(diagramId);

        console.log(`[Versions] Found ${versions.length} versions for diagram: ${diagramId}`);

        ws.send(JSON.stringify({
            type: 'versions_success',
            action: 'versions_retrieved',
            diagramId,
            versions,
            count: versions.length
        }));
    } catch (error) {
        console.error('[Versions] Error:', error);
        ws.send(JSON.stringify({
            type: 'error',
            action: 'versions_failed',
            message: error.message
        }));
    }
}

// Handle delete diagram
async function handleDeleteDiagram(ws, message) {
    try {
        const { diagramId } = message;

        if (!diagramId) {
            throw new Error('Diagram ID is required');
        }

        await db.deleteDiagram(diagramId);

        console.log(`[Delete] Diagram deleted: ${diagramId}`);

        ws.send(JSON.stringify({
            type: 'delete_success',
            action: 'diagram_deleted',
            diagramId
        }));
    } catch (error) {
        console.error('[Delete] Error:', error);
        ws.send(JSON.stringify({
            type: 'error',
            action: 'delete_failed',
            message: error.message
        }));
    }
}

// Handle deploy diagram
async function handleDeployDiagram(ws, message) {
    try {
        const { diagramId, siteId } = message;

        if (!diagramId) {
            throw new Error('Diagram ID is required');
        }

        // Update deployment status in database
        const query = `
            UPDATE archiflow.diagrams
            SET deployment_status = 'deployed',
                deployed_at = CURRENT_TIMESTAMP,
                deployed_by = $1
            WHERE id = $2
            RETURNING id, title, deployment_status
        `;

        const result = await db.query(query, [message.userId || 'system', diagramId]);

        if (result.rows.length === 0) {
            throw new Error('Diagram not found');
        }

        console.log(`[Deploy] Diagram deployed: ${diagramId}`);

        ws.send(JSON.stringify({
            type: 'deploy_success',
            diagramId: result.rows[0].id,
            title: result.rows[0].title,
            message: 'Diagram deployed successfully'
        }));

        // In the future, this would trigger IPAM API sync
        // await syncWithIPAM(diagramId);

    } catch (error) {
        console.error('[Deploy] Error:', error);
        ws.send(JSON.stringify({
            type: 'error',
            message: error.message
        }));
    }
}

// Periodic cleanup of inactive clients
setInterval(() => {
    const now = new Date();
    const timeout = 60000; // 1 minute

    clients.forEach((client, id) => {
        if (now - client.lastActivity > timeout) {
            console.log(`[Cleanup] Removing inactive client: ${id}`);
            client.ws.close();
            clients.delete(id);
        }
    });
}, 30000);

// Start server
server.listen(WS_PORT, () => {
    console.log(`[Server] WebSocket server listening on port ${WS_PORT}`);
    console.log(`[Server] Health check available at http://localhost:${WS_PORT}/health`);
});

// =====================================================
// Network Device Handler Functions
// =====================================================

async function handleGetNetworkDevices(ws, message) {
    try {
        const devices = await networkDevices.getDevices(message.filters || {});

        ws.send(JSON.stringify({
            type: 'network_devices',
            action: 'devices_loaded',
            devices,
            count: devices.length
        }));
    } catch (error) {
        console.error('[NetworkDevices] Error getting devices:', error);
        ws.send(JSON.stringify({
            type: 'error',
            action: 'get_devices_failed',
            message: error.message
        }));
    }
}

async function handleGetNetworkDevice(ws, message) {
    try {
        const { deviceId } = message;
        if (!deviceId) throw new Error('Device ID is required');

        const device = await networkDevices.getDevice(deviceId);

        ws.send(JSON.stringify({
            type: 'network_device',
            action: 'device_loaded',
            device
        }));
    } catch (error) {
        console.error('[NetworkDevice] Error getting device:', error);
        ws.send(JSON.stringify({
            type: 'error',
            action: 'get_device_failed',
            message: error.message
        }));
    }
}

async function handleCreateNetworkDevice(ws, message) {
    try {
        const device = await networkDevices.createDevice(message.device);

        ws.send(JSON.stringify({
            type: 'device_created',
            action: 'device_created',
            device,
            message: 'Network device created successfully'
        }));
    } catch (error) {
        console.error('[CreateDevice] Error:', error);
        ws.send(JSON.stringify({
            type: 'error',
            action: 'create_device_failed',
            message: error.message
        }));
    }
}

async function handleUpdateNetworkDevice(ws, message) {
    try {
        const { deviceId, updates } = message;
        if (!deviceId) throw new Error('Device ID is required');

        const device = await networkDevices.updateDevice(deviceId, updates);

        ws.send(JSON.stringify({
            type: 'device_updated',
            action: 'device_updated',
            device,
            message: 'Device updated successfully'
        }));
    } catch (error) {
        console.error('[UpdateDevice] Error:', error);
        ws.send(JSON.stringify({
            type: 'error',
            action: 'update_device_failed',
            message: error.message
        }));
    }
}

async function handleDeleteNetworkDevice(ws, message) {
    try {
        const { deviceId } = message;
        if (!deviceId) throw new Error('Device ID is required');

        const result = await networkDevices.deleteDevice(deviceId);

        ws.send(JSON.stringify({
            type: 'device_deleted',
            action: 'device_deleted',
            deviceId,
            message: 'Device deleted successfully'
        }));
    } catch (error) {
        console.error('[DeleteDevice] Error:', error);
        ws.send(JSON.stringify({
            type: 'error',
            action: 'delete_device_failed',
            message: error.message
        }));
    }
}

async function handleAllocateIP(ws, message) {
    try {
        const { deviceId, ipData } = message;
        if (!deviceId) throw new Error('Device ID is required');

        const allocation = await networkDevices.allocateIP(deviceId, ipData);

        ws.send(JSON.stringify({
            type: 'ip_allocated',
            action: 'ip_allocated',
            allocation,
            message: 'IP address allocated successfully'
        }));
    } catch (error) {
        console.error('[AllocateIP] Error:', error);
        ws.send(JSON.stringify({
            type: 'error',
            action: 'allocate_ip_failed',
            message: error.message
        }));
    }
}

async function handleReleaseIP(ws, message) {
    try {
        const { allocationId } = message;
        if (!allocationId) throw new Error('Allocation ID is required');

        const result = await networkDevices.releaseIP(allocationId);

        ws.send(JSON.stringify({
            type: 'ip_released',
            action: 'ip_released',
            result,
            message: 'IP address released successfully'
        }));
    } catch (error) {
        console.error('[ReleaseIP] Error:', error);
        ws.send(JSON.stringify({
            type: 'error',
            action: 'release_ip_failed',
            message: error.message
        }));
    }
}

async function handleGetDeviceConnections(ws, message) {
    try {
        const { deviceId } = message;
        if (!deviceId) throw new Error('Device ID is required');

        const connections = await networkDevices.getDeviceConnections(deviceId);

        ws.send(JSON.stringify({
            type: 'device_connections',
            action: 'connections_loaded',
            connections,
            count: connections.length
        }));
    } catch (error) {
        console.error('[GetConnections] Error:', error);
        ws.send(JSON.stringify({
            type: 'error',
            action: 'get_connections_failed',
            message: error.message
        }));
    }
}

async function handleCreateConnection(ws, message) {
    try {
        const connection = await networkDevices.createConnection(message.connection);

        ws.send(JSON.stringify({
            type: 'connection_created',
            action: 'connection_created',
            connection,
            message: 'Connection created successfully'
        }));
    } catch (error) {
        console.error('[CreateConnection] Error:', error);
        ws.send(JSON.stringify({
            type: 'error',
            action: 'create_connection_failed',
            message: error.message
        }));
    }
}

async function handleDeleteConnection(ws, message) {
    try {
        const { connectionId } = message;
        if (!connectionId) throw new Error('Connection ID is required');

        const result = await networkDevices.deleteConnection(connectionId);

        ws.send(JSON.stringify({
            type: 'connection_deleted',
            action: 'connection_deleted',
            result,
            message: 'Connection deleted successfully'
        }));
    } catch (error) {
        console.error('[DeleteConnection] Error:', error);
        ws.send(JSON.stringify({
            type: 'error',
            action: 'delete_connection_failed',
            message: error.message
        }));
    }
}

async function handleGetDeviceTemplates(ws, message) {
    try {
        console.log('[GetTemplates] Fetching device templates, category:', message.category);
        const templates = await networkDevices.getDeviceTemplates(message.category);
        console.log('[GetTemplates] Found templates:', templates.length);

        ws.send(JSON.stringify({
            type: 'device_templates',
            action: 'templates_loaded',
            templates,
            count: templates.length
        }));
    } catch (error) {
        console.error('[GetTemplates] Error:', error);
        ws.send(JSON.stringify({
            type: 'error',
            action: 'get_templates_failed',
            message: error.message
        }));
    }
}

async function handleGetVLANs(ws, message) {
    try {
        console.log('[GetVLANs] Fetching VLANs for site:', message.siteId);
        const vlans = await networkDevices.getVLANs(message.siteId);
        console.log('[GetVLANs] Found VLANs:', vlans.length);

        ws.send(JSON.stringify({
            type: 'vlans',
            action: 'vlans_loaded',
            vlans,
            count: vlans.length
        }));
    } catch (error) {
        console.error('[GetVLANs] Error:', error);
        ws.send(JSON.stringify({
            type: 'error',
            action: 'get_vlans_failed',
            message: error.message
        }));
    }
}

async function handleGetIPPools(ws, message) {
    try {
        console.log('[GetIPPools] Fetching IP pools for site:', message.siteId);
        const pools = await networkDevices.getIPPools(message.siteId);
        console.log('[GetIPPools] Found pools:', pools.length);

        ws.send(JSON.stringify({
            type: 'ip_pools',
            action: 'pools_loaded',
            pools,
            count: pools.length
        }));
    } catch (error) {
        console.error('[GetIPPools] Error:', error);
        ws.send(JSON.stringify({
            type: 'error',
            action: 'get_pools_failed',
            message: error.message
        }));
    }
}

async function handleGetPoolIPs(ws, message) {
    try {
        const { poolId } = message;
        console.log('[GetPoolIPs] Fetching IPs for pool:', poolId);

        const result = await networkDevices.getPoolIPAddresses(poolId);
        console.log('[GetPoolIPs] Found IPs:', result.ips.length);

        ws.send(JSON.stringify({
            type: 'pool_ips',
            action: 'pool_ips_loaded',
            pool: result.pool,
            ips: result.ips
        }));
    } catch (error) {
        console.error('[GetPoolIPs] Error:', error);
        ws.send(JSON.stringify({
            type: 'error',
            action: 'get_pool_ips_failed',
            message: error.message
        }));
    }
}

async function handleAllocateIPFromPool(ws, message) {
    try {
        const { ipAddress, deviceName, poolId } = message;
        console.log('[AllocateIP] Allocating IP:', ipAddress, 'to device:', deviceName);

        const result = await networkDevices.allocateIPFromPool(ipAddress, deviceName, poolId);

        ws.send(JSON.stringify({
            type: 'ip_allocated',
            action: 'ip_allocated_success',
            ip: result,
            ipAddress,
            deviceName
        }));
    } catch (error) {
        console.error('[AllocateIP] Error:', error);
        ws.send(JSON.stringify({
            type: 'error',
            action: 'allocate_ip_failed',
            message: error.message
        }));
    }
}

async function handleReleaseIPFromPool(ws, message) {
    try {
        const { ipAddress, deviceName } = message;
        console.log('[ReleaseIP] Releasing IP:', ipAddress, 'from device:', deviceName);

        const result = await networkDevices.releaseIPFromPool(ipAddress);

        ws.send(JSON.stringify({
            type: 'ip_released',
            action: 'ip_released_success',
            ip: result,
            ipAddress,
            deviceName
        }));

        console.log('[ReleaseIP] IP released successfully:', ipAddress);
    } catch (error) {
        console.error('[ReleaseIP] Error:', error);
        ws.send(JSON.stringify({
            type: 'error',
            action: 'release_ip_failed',
            message: error.message
        }));
    }
}

async function handleCleanupOrphanedIPs(ws, message) {
    try {
        console.log('[CleanupIPs] Cleaning up orphaned IP allocations');

        // Call the cleanup function
        const query = 'SELECT archiflow.cleanup_orphaned_ips() as released_count';
        const result = await db.query(query);
        const releasedCount = result.rows[0].released_count;

        ws.send(JSON.stringify({
            type: 'orphaned_ips_cleaned',
            action: 'cleanup_success',
            releasedCount
        }));

        console.log(`[CleanupIPs] Released ${releasedCount} orphaned IPs`);
    } catch (error) {
        console.error('[CleanupIPs] Error:', error);
        ws.send(JSON.stringify({
            type: 'error',
            action: 'cleanup_failed',
            message: error.message
        }));
    }
}

async function handleMapDeviceToDiagram(ws, message) {
    try {
        const { deviceId, diagramId, cellData } = message;
        if (!deviceId || !diagramId) throw new Error('Device ID and Diagram ID are required');

        const mapping = await networkDevices.mapDeviceToDiagram(deviceId, diagramId, cellData);

        ws.send(JSON.stringify({
            type: 'device_mapped',
            action: 'device_mapped',
            mapping,
            message: 'Device mapped to diagram successfully'
        }));
    } catch (error) {
        console.error('[MapDevice] Error:', error);
        ws.send(JSON.stringify({
            type: 'error',
            action: 'map_device_failed',
            message: error.message
        }));
    }
}

async function handleGetDevicesInDiagram(ws, message) {
    try {
        const { diagramId } = message;
        if (!diagramId) throw new Error('Diagram ID is required');

        const devices = await networkDevices.getDevicesInDiagram(diagramId);

        ws.send(JSON.stringify({
            type: 'diagram_devices',
            action: 'diagram_devices_loaded',
            devices,
            count: devices.length
        }));
    } catch (error) {
        console.error('[GetDiagramDevices] Error:', error);
        ws.send(JSON.stringify({
            type: 'error',
            action: 'get_diagram_devices_failed',
            message: error.message
        }));
    }
}

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('[Server] SIGTERM received, closing connections...');

    // Close all client connections
    clients.forEach(client => {
        client.ws.close();
    });

    // Close WebSocket server
    wss.close(() => {
        console.log('[Server] WebSocket server closed');

        // Close database connection
        db.close().then(() => {
            console.log('[Server] Database connection closed');
            process.exit(0);
        });
    });
});

// Error handling
process.on('uncaughtException', (error) => {
    console.error('[Server] Uncaught Exception:', error);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('[Server] Unhandled Rejection at:', promise, 'reason:', reason);
});
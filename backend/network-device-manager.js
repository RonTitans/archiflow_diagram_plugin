const { v4: uuidv4 } = require('uuid');

class NetworkDeviceManager {
    constructor(db) {
        this.db = db;
    }

    // =====================================================
    // Device CRUD Operations
    // =====================================================

    async getDevices(filters = {}) {
        try {
            let query = `
                SELECT
                    d.*,
                    s.name as site_name,
                    array_agg(DISTINCT jsonb_build_object(
                        'id', ip.id,
                        'ip_address', ip.ip_address,
                        'subnet', ip.subnet,
                        'vlan_id', ip.vlan_id,
                        'interface_name', ip.interface_name,
                        'is_primary', ip.is_primary
                    )) FILTER (WHERE ip.id IS NOT NULL) as ip_addresses
                FROM archiflow.network_devices d
                LEFT JOIN archiflow.sites s ON d.site_id = s.id
                LEFT JOIN archiflow.ip_allocations ip ON d.id = ip.device_id
                WHERE 1=1
            `;

            const params = [];
            let paramCount = 0;

            if (filters.device_type) {
                paramCount++;
                query += ` AND d.device_type = $${paramCount}`;
                params.push(filters.device_type);
            }

            if (filters.status) {
                paramCount++;
                query += ` AND d.status = $${paramCount}`;
                params.push(filters.status);
            }

            if (filters.site_id) {
                paramCount++;
                query += ` AND d.site_id = $${paramCount}`;
                params.push(filters.site_id);
            }

            query += ` GROUP BY d.id, s.name ORDER BY d.name`;

            const result = await this.db.query(query, params);
            return result.rows;
        } catch (error) {
            console.error('[NetworkDeviceManager] Error getting devices:', error);
            throw error;
        }
    }

    async getDevice(deviceId) {
        try {
            const query = `
                SELECT
                    d.*,
                    s.name as site_name,
                    array_agg(DISTINCT jsonb_build_object(
                        'id', ip.id,
                        'ip_address', ip.ip_address,
                        'subnet', ip.subnet,
                        'vlan_id', ip.vlan_id,
                        'interface_name', ip.interface_name,
                        'is_primary', ip.is_primary
                    )) FILTER (WHERE ip.id IS NOT NULL) as ip_addresses
                FROM archiflow.network_devices d
                LEFT JOIN archiflow.sites s ON d.site_id = s.id
                LEFT JOIN archiflow.ip_allocations ip ON d.id = ip.device_id
                WHERE d.id = $1
                GROUP BY d.id, s.name
            `;

            const result = await this.db.query(query, [deviceId]);
            return result.rows[0];
        } catch (error) {
            console.error('[NetworkDeviceManager] Error getting device:', error);
            throw error;
        }
    }

    async createDevice(deviceData) {
        try {
            const {
                name,
                device_type,
                manufacturer,
                model,
                serial_number,
                asset_id,
                status = 'active',
                location,
                rack_position,
                site_id,
                metadata = {},
                created_by = 'system'
            } = deviceData;

            const query = `
                INSERT INTO archiflow.network_devices (
                    name, device_type, manufacturer, model,
                    serial_number, asset_id, status, location,
                    rack_position, site_id, metadata, created_by
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                RETURNING *
            `;

            const params = [
                name, device_type, manufacturer, model,
                serial_number, asset_id, status, location,
                rack_position, site_id, JSON.stringify(metadata), created_by
            ];

            const result = await this.db.query(query, params);
            return result.rows[0];
        } catch (error) {
            console.error('[NetworkDeviceManager] Error creating device:', error);
            throw error;
        }
    }

    async updateDevice(deviceId, updates) {
        try {
            const allowedFields = [
                'name', 'device_type', 'manufacturer', 'model',
                'serial_number', 'asset_id', 'status', 'location',
                'rack_position', 'site_id', 'metadata', 'modified_by'
            ];

            const setClauses = [];
            const params = [];
            let paramCount = 1;

            for (const [key, value] of Object.entries(updates)) {
                if (allowedFields.includes(key)) {
                    setClauses.push(`${key} = $${paramCount}`);
                    params.push(key === 'metadata' ? JSON.stringify(value) : value);
                    paramCount++;
                }
            }

            if (setClauses.length === 0) {
                return null;
            }

            params.push(deviceId);
            const query = `
                UPDATE archiflow.network_devices
                SET ${setClauses.join(', ')}, modified_at = NOW()
                WHERE id = $${paramCount}
                RETURNING *
            `;

            const result = await this.db.query(query, params);
            return result.rows[0];
        } catch (error) {
            console.error('[NetworkDeviceManager] Error updating device:', error);
            throw error;
        }
    }

    async deleteDevice(deviceId) {
        try {
            const query = `
                DELETE FROM archiflow.network_devices
                WHERE id = $1
                RETURNING id, name
            `;

            const result = await this.db.query(query, [deviceId]);
            return result.rows[0];
        } catch (error) {
            console.error('[NetworkDeviceManager] Error deleting device:', error);
            throw error;
        }
    }

    // =====================================================
    // IP Address Management
    // =====================================================

    async allocateIP(deviceId, ipData) {
        try {
            const {
                ip_address,
                subnet,
                vlan_id,
                interface_name,
                mac_address,
                is_primary = false,
                allocation_type = 'static',
                dns_servers,
                gateway
            } = ipData;

            const query = `
                INSERT INTO archiflow.ip_allocations (
                    device_id, ip_address, subnet, vlan_id,
                    interface_name, mac_address, is_primary,
                    allocation_type, dns_servers, gateway
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                RETURNING *
            `;

            const params = [
                deviceId, ip_address, subnet, vlan_id,
                interface_name, mac_address, is_primary,
                allocation_type, dns_servers, gateway
            ];

            const result = await this.db.query(query, params);
            return result.rows[0];
        } catch (error) {
            console.error('[NetworkDeviceManager] Error allocating IP:', error);
            throw error;
        }
    }

    async releaseIP(allocationId) {
        try {
            const query = `
                DELETE FROM archiflow.ip_allocations
                WHERE id = $1
                RETURNING *
            `;

            const result = await this.db.query(query, [allocationId]);
            return result.rows[0];
        } catch (error) {
            console.error('[NetworkDeviceManager] Error releasing IP:', error);
            throw error;
        }
    }

    async getNextAvailableIP(poolId) {
        try {
            const query = `SELECT archiflow.get_next_available_ip($1) as next_ip`;
            const result = await this.db.query(query, [poolId]);
            return result.rows[0]?.next_ip;
        } catch (error) {
            console.error('[NetworkDeviceManager] Error getting next available IP:', error);
            throw error;
        }
    }

    // Allocate an IP from ip_addresses table
    async allocateIPFromPool(ipAddress, deviceName, poolId = null) {
        try {
            // Build the WHERE clause based on what we know
            let whereClause = "ip_address = $1";
            const params = [ipAddress + '/24']; // Add subnet mask

            if (poolId) {
                whereClause += " AND pool_id = $2";
                params.push(poolId);
            }

            const query = `
                UPDATE archiflow.ip_addresses
                SET
                    device_name = $${params.length + 1},
                    allocated_at = NOW()
                WHERE ${whereClause}
                    AND device_name IS NULL
                    AND is_gateway = false
                    AND is_reserved = false
                RETURNING *
            `;

            params.push(deviceName);

            const result = await this.db.query(query, params);

            if (result.rows.length === 0) {
                console.log('[NetworkDeviceManager] IP already allocated or not found:', ipAddress);
                return null;
            }

            console.log('[NetworkDeviceManager] IP allocated successfully:', ipAddress, 'to', deviceName);
            return result.rows[0];
        } catch (error) {
            console.error('[NetworkDeviceManager] Error allocating IP:', error);
            throw error;
        }
    }

    // Release an IP back to the pool
    async releaseIPFromPool(ipAddress) {
        try {
            const query = `
                UPDATE archiflow.ip_addresses
                SET
                    device_id = NULL,
                    device_name = NULL,
                    allocated_at = NULL
                WHERE ip_address = $1
                RETURNING *
            `;

            const result = await this.db.query(query, [ipAddress + '/24']);

            if (result.rows.length === 0) {
                console.log('[NetworkDeviceManager] IP not found:', ipAddress);
                return null;
            }

            console.log('[NetworkDeviceManager] IP released successfully:', ipAddress);
            return result.rows[0];
        } catch (error) {
            console.error('[NetworkDeviceManager] Error releasing IP:', error);
            throw error;
        }
    }

    // =====================================================
    // Port Connection Management
    // =====================================================

    async createConnection(connectionData) {
        try {
            const {
                source_device_id,
                source_port,
                target_device_id,
                target_port,
                connection_type = 'ethernet',
                bandwidth,
                duplex = 'full',
                vlan_ids,
                is_trunk = false,
                status = 'active'
            } = connectionData;

            const query = `
                INSERT INTO archiflow.port_connections (
                    source_device_id, source_port, target_device_id,
                    target_port, connection_type, bandwidth, duplex,
                    vlan_ids, is_trunk, status
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                RETURNING *
            `;

            const params = [
                source_device_id, source_port, target_device_id,
                target_port, connection_type, bandwidth, duplex,
                vlan_ids, is_trunk, status
            ];

            const result = await this.db.query(query, params);
            return result.rows[0];
        } catch (error) {
            console.error('[NetworkDeviceManager] Error creating connection:', error);
            throw error;
        }
    }

    async getDeviceConnections(deviceId) {
        try {
            const query = `
                SELECT
                    c.*,
                    sd.name as source_device_name,
                    td.name as target_device_name
                FROM archiflow.port_connections c
                JOIN archiflow.network_devices sd ON c.source_device_id = sd.id
                JOIN archiflow.network_devices td ON c.target_device_id = td.id
                WHERE c.source_device_id = $1 OR c.target_device_id = $1
                ORDER BY c.created_at DESC
            `;

            const result = await this.db.query(query, [deviceId]);
            return result.rows;
        } catch (error) {
            console.error('[NetworkDeviceManager] Error getting connections:', error);
            throw error;
        }
    }

    async deleteConnection(connectionId) {
        try {
            const query = `
                DELETE FROM archiflow.port_connections
                WHERE id = $1
                RETURNING *
            `;

            const result = await this.db.query(query, [connectionId]);
            return result.rows[0];
        } catch (error) {
            console.error('[NetworkDeviceManager] Error deleting connection:', error);
            throw error;
        }
    }

    async isPortAvailable(deviceId, portName) {
        try {
            const query = `SELECT archiflow.is_port_available($1, $2) as available`;
            const result = await this.db.query(query, [deviceId, portName]);
            return result.rows[0]?.available || false;
        } catch (error) {
            console.error('[NetworkDeviceManager] Error checking port availability:', error);
            throw error;
        }
    }

    // =====================================================
    // Template Management
    // =====================================================

    async getDeviceTemplates(category = null) {
        try {
            let query = `
                SELECT * FROM archiflow.device_templates
                WHERE 1=1
            `;

            const params = [];
            if (category) {
                query += ` AND category = $1`;
                params.push(category);
            }

            query += ` ORDER BY category, name`;

            const result = await this.db.query(query, params);
            return result.rows;
        } catch (error) {
            console.error('[NetworkDeviceManager] Error getting templates:', error);
            throw error;
        }
    }

    async createDeviceFromTemplate(templateId, deviceData) {
        try {
            // Get template
            const templateQuery = `
                SELECT * FROM archiflow.device_templates
                WHERE id = $1
            `;
            const templateResult = await this.db.query(templateQuery, [templateId]);
            const template = templateResult.rows[0];

            if (!template) {
                throw new Error('Template not found');
            }

            // Merge template data with provided data
            const mergedData = {
                device_type: template.device_type,
                manufacturer: template.manufacturer,
                model: template.model,
                ...deviceData,
                metadata: {
                    ...template.metadata,
                    ...deviceData.metadata,
                    template_id: templateId
                }
            };

            return await this.createDevice(mergedData);
        } catch (error) {
            console.error('[NetworkDeviceManager] Error creating device from template:', error);
            throw error;
        }
    }

    // =====================================================
    // VLAN Management
    // =====================================================

    async getVLANs(siteId = null) {
        try {
            let query = `
                SELECT * FROM archiflow.vlans
                WHERE is_active = true
            `;

            const params = [];
            if (siteId) {
                query += ` AND site_id = $1`;
                params.push(siteId);
            }

            query += ` ORDER BY id`;

            const result = await this.db.query(query, params);
            return result.rows;
        } catch (error) {
            console.error('[NetworkDeviceManager] Error getting VLANs:', error);
            throw error;
        }
    }

    // =====================================================
    // IP Pool Management
    // =====================================================

    async getIPPools(siteId = null) {
        try {
            let query = `
                SELECT
                    p.*,
                    COUNT(DISTINCT ip.id) as allocated_count
                FROM archiflow.ip_pools p
                LEFT JOIN archiflow.ip_allocations ip ON ip.subnet = p.network
                WHERE 1=1
            `;

            const params = [];
            if (siteId) {
                query += ` AND p.site_id = $1`;
                params.push(siteId);
            }

            query += ` GROUP BY p.id ORDER BY p.name`;

            const result = await this.db.query(query, params);
            return result.rows;
        } catch (error) {
            console.error('[NetworkDeviceManager] Error getting IP pools:', error);
            throw error;
        }
    }

    async getPoolIPAddresses(poolId, limit = 100) {
        try {
            // Get pool details
            const poolQuery = `SELECT * FROM archiflow.ip_pools WHERE id = $1`;
            const poolResult = await this.db.query(poolQuery, [poolId]);

            if (poolResult.rows.length === 0) {
                throw new Error('IP Pool not found');
            }

            const pool = poolResult.rows[0];

            // Get all IPs from ip_addresses table for this pool
            const ipsQuery = `
                SELECT
                    ip.ip_address,
                    ip.is_gateway,
                    ip.is_reserved,
                    ip.device_id,
                    ip.device_name,
                    ip.allocated_at,
                    ip.notes,
                    d.device_type
                FROM archiflow.ip_addresses ip
                LEFT JOIN archiflow.network_devices d ON ip.device_id = d.id
                WHERE ip.pool_id = $1
                ORDER BY ip.ip_address
                LIMIT $2
            `;
            const ipsResult = await this.db.query(ipsQuery, [poolId, limit]);

            // Format IPs for frontend
            const ips = ipsResult.rows.map(row => {
                // Extract just the IP without the subnet mask
                const ipStr = row.ip_address.split('/')[0];

                return {
                    ip_address: ipStr,
                    is_allocated: row.device_id !== null || row.device_name !== null,
                    is_gateway: row.is_gateway,
                    is_reserved: row.is_reserved,
                    device_id: row.device_id,
                    device_name: row.device_name,
                    device_type: row.device_type,
                    allocated_at: row.allocated_at,
                    notes: row.notes
                };
            });

            return {
                pool,
                ips
            };
        } catch (error) {
            console.error('[NetworkDeviceManager] Error getting pool IPs:', error);
            throw error;
        }
    }

    // =====================================================
    // Diagram Integration
    // =====================================================

    async mapDeviceToDiagram(deviceId, diagramId, cellData) {
        try {
            const {
                cell_id,
                x_position,
                y_position,
                width,
                height,
                style
            } = cellData;

            const query = `
                INSERT INTO archiflow.device_diagram_mapping (
                    device_id, diagram_id, cell_id,
                    x_position, y_position, width, height, style
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                ON CONFLICT (device_id, diagram_id)
                DO UPDATE SET
                    cell_id = $3,
                    x_position = $4,
                    y_position = $5,
                    width = $6,
                    height = $7,
                    style = $8,
                    modified_at = NOW()
                RETURNING *
            `;

            const params = [
                deviceId, diagramId, cell_id,
                x_position, y_position, width, height, style
            ];

            const result = await this.db.query(query, params);
            return result.rows[0];
        } catch (error) {
            console.error('[NetworkDeviceManager] Error mapping device to diagram:', error);
            throw error;
        }
    }

    async getDevicesInDiagram(diagramId) {
        try {
            const query = `
                SELECT
                    d.*,
                    m.cell_id,
                    m.x_position,
                    m.y_position,
                    m.width,
                    m.height,
                    m.style,
                    array_agg(DISTINCT jsonb_build_object(
                        'id', ip.id,
                        'ip_address', ip.ip_address,
                        'vlan_id', ip.vlan_id,
                        'interface_name', ip.interface_name
                    )) FILTER (WHERE ip.id IS NOT NULL) as ip_addresses
                FROM archiflow.device_diagram_mapping m
                JOIN archiflow.network_devices d ON m.device_id = d.id
                LEFT JOIN archiflow.ip_allocations ip ON d.id = ip.device_id
                WHERE m.diagram_id = $1
                GROUP BY d.id, m.cell_id, m.x_position, m.y_position, m.width, m.height, m.style
            `;

            const result = await this.db.query(query, [diagramId]);
            return result.rows;
        } catch (error) {
            console.error('[NetworkDeviceManager] Error getting devices in diagram:', error);
            throw error;
        }
    }
}

module.exports = NetworkDeviceManager;